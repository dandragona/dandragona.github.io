import { useState } from 'react';
import {
  CHIP_COLORS,
  YELLOW,
  ABSENT,
  INK_SOFT,
  CARD_BG,
  CARD_BORDER,
  TensorGrid,
  OpSymbol,
  StepControls,
  WidgetShell,
  Caption,
  Legend,
} from './staircase-shared.jsx';
import { LaneTimeline } from './comm-shared.jsx';

// Ring attention (forward). Four devices, each owning S/P of the sequence.
// Q stays home; the K,V block rotates one seat around the ring per step. Every
// step a device attends its queries against the block it currently holds and
// folds the result into a running (online-softmax) output, while the block it
// just used is already hopping to the next device. Color = the device a block
// ORIGINATED on, so a block is traceable as it travels.

const P = 4;
const SP = 2; // S/P sequence positions per device (H = 2)
const CELL = 14;
const GAP = 2;
const ROW_H = 104;
const ROW_GAP = 12;
const TOTAL_STEPS = 5; // 4 folds (0..3) + done (4)

// Block resident on device d at step t (blocks move d -> d+1 each hop).
const resident = (d, t) => (d - t + P) % P;

const CAPTIONS = [
  'Every device attends its own K,V block first — the S/P positions it already holds — so compute starts with no communication. Underneath, each block is already copying to its clockwise neighbor (device 3 wraps to device 0).',
  'One hop landed: device d now holds block d−1 and folds those keys into its output. O stays striped because the online softmax keeps rescaling as new keys arrive — and the next hop is already in flight beneath the matmul.',
  'Rotate again — three of the four key blocks are now covered on every device. Each hop so far has finished inside the attention block that hid it; the compute lane never stalled.',
  'The last block arrives and folds in. There is nothing left to send: the ring needed only P−1 hops, and the first block was local, so there was never an exposed tail either.',
  'Done. The stripes drop: every O_d is the exact attention output for its queries over the full S=8 sequence, and no device ever held the whole sequence of K,V — only the block it was attending to, plus the next already streaming in.',
];

// Left rail: the ring drawn as hop arrows between the stacked device rows,
// plus a wraparound from the bottom device back to the top. Yellow while a hop
// is in flight (steps 0..P-2), faint once the ring goes quiet.
function RingRail({ active }) {
  const W = 48;
  const H = P * ROW_H + (P - 1) * ROW_GAP;
  const cy = (d) => d * (ROW_H + ROW_GAP) + ROW_H / 2;
  const col = active ? YELLOW : 'rgba(31,41,55,0.22)';
  const x = 34;
  const downTip = (px, py) => `${px - 4},${py - 8} ${px + 4},${py - 8} ${px},${py}`;
  const upTip = (px, py) => `${px - 4},${py + 8} ${px + 4},${py + 8} ${px},${py}`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible', flexShrink: 0 }}>
      {Array.from({ length: P - 1 }, (_, d) => {
        const y1 = cy(d) + 22;
        const y2 = cy(d + 1) - 22;
        return (
          <g key={d}>
            <line x1={x} y1={y1} x2={x} y2={y2} stroke={col} strokeWidth={2.5} />
            <polygon points={downTip(x, y2)} fill={col} />
          </g>
        );
      })}
      {/* wraparound: bottom device -> top device, bowing out to the left */}
      <path
        d={`M ${x} ${cy(P - 1) - 22} C 8 ${cy(P - 1) - 46}, 8 ${cy(0) + 46}, ${x} ${cy(0) + 22}`}
        fill="none"
        stroke={col}
        strokeWidth={2.5}
      />
      <polygon points={upTip(x, cy(0) + 22)} fill={col} />
      <text
        x={12}
        y={H / 2}
        fontSize={9}
        fill={col}
        textAnchor="middle"
        transform={`rotate(-90 12 ${H / 2})`}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {active ? 'K,V hops →' : 'ring idle'}
      </text>
    </svg>
  );
}

function DeviceRow({ d, step }) {
  const color = CHIP_COLORS[d];
  const res = resident(d, Math.min(step, P - 1));
  const containerHeight = SP * CELL + (SP - 1) * GAP; // 30
  const done = step >= TOTAL_STEPS - 1;
  const coveredAt = (j) => (d - j + P) % P; // step at which block j folds in on device d
  const seen = Math.min(step + 1, P) * SP;

  const qFill = () => ({ fill: color });
  const kvFill = () => ({ fill: CHIP_COLORS[res], highlight: !done });
  const stripFill = (_r, c) => {
    const j = Math.floor(c / SP);
    const at = coveredAt(j);
    if (step < at) return { fill: ABSENT };
    return { fill: CHIP_COLORS[j], stripe: !done, highlight: !done && at === step };
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: ROW_H,
        boxSizing: 'border-box',
        padding: '8px 12px',
        borderRadius: 12,
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color, fontWeight: 700 }}>
        Device {d}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
        <TensorGrid name={`Q${d}`} subtitle="[S/P, H]" rows={SP} cols={2} getFill={qFill} containerHeight={containerHeight} cellSize={CELL} />
        <OpSymbol containerHeight={containerHeight}>⊛</OpSymbol>
        <TensorGrid
          name="K,V"
          subtitle={done ? `blk ${res} · done` : `blk ${res}`}
          rows={SP}
          cols={2}
          getFill={kvFill}
          containerHeight={containerHeight}
          cellSize={CELL}
        />
        <OpSymbol containerHeight={containerHeight}>→</OpSymbol>
        <TensorGrid
          name={`O${d} · keys folded`}
          subtitle={done ? '8/8 keys · done' : `${seen}/8 keys`}
          rows={1}
          cols={P * SP}
          getFill={stripFill}
          containerHeight={containerHeight}
          cellSize={CELL}
        />
      </div>
    </div>
  );
}

function Timeline({ step }) {
  const done = step >= TOTAL_STEPS - 1;
  const compute = Array.from({ length: P }, (_, t) => {
    const j = resident(0, t);
    return {
      lane: 'attn',
      start: t,
      dur: 1,
      label: `attn blk${j}`,
      color: CHIP_COLORS[j],
      kind: 'compute',
      visible: step >= t,
      active: step === t && !done,
    };
  });
  const comm = Array.from({ length: P - 1 }, (_, t) => {
    const j = resident(0, t);
    return {
      lane: 'hop',
      start: t + 0.2,
      dur: 0.6,
      label: `hop blk${j}`,
      color: CHIP_COLORS[j],
      kind: 'comm',
      visible: step >= t,
      active: step === t && !done,
    };
  });

  return (
    <LaneTimeline
      width={600}
      duration={P}
      lanes={[
        { id: 'attn', label: 'attention' },
        { id: 'hop', label: 'ring hop' },
      ]}
      blocks={[...compute, ...comm]}
      footnote="Device 0's schedule (all four devices run it at once). Each hop sits strictly inside the attention block that hides it — zero exposed communication, and the final block needs no hop."
    />
  );
}

export default function RingAttention() {
  const [step, setStep] = useState(0);

  return (
    <WidgetShell
      title="Ring attention — Q stays home, K,V rotates"
      subtitle="Four devices, each owning S/P of the sequence. Every step a device attends its queries against the K,V block it currently holds, folds the result into its running output, and forwards that block to the next device — while the next block is already arriving. Cell color marks the device a block originated on."
    >
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'flex-start' }}>
        <RingRail active={step < P - 1} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: ROW_GAP }}>
          {Array.from({ length: P }, (_, d) => (
            <DeviceRow key={d} d={d} step={step} />
          ))}
        </div>
      </div>

      <Timeline step={step} />

      <Legend
        items={[
          { fill: CHIP_COLORS[0], label: 'block from device 0' },
          { fill: CHIP_COLORS[1], label: 'device 1' },
          { fill: CHIP_COLORS[2], label: 'device 2' },
          { fill: CHIP_COLORS[3], label: 'device 3' },
          { fill: CHIP_COLORS[0], stripe: true, label: 'O still rescaling' },
          { fill: CHIP_COLORS[0], ring: true, label: 'active this tick' },
        ]}
      />

      <Caption>{CAPTIONS[step]}</Caption>
      <StepControls step={step} totalSteps={TOTAL_STEPS} setStep={setStep} />
    </WidgetShell>
  );
}
