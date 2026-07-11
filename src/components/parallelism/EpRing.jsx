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

// Ring of experts (forward). The structural mirror of RingAttention — W takes
// the K,V seat: the small expert weights rotate one seat around the ring per
// step while the tokens stay home. Cell color marks the EXPERT a token is
// routed to (expert e's weights originate on device e), so the visiting
// weight block and the token row it will serve share a color and the match
// is readable at a glance. Unlike attention's online softmax there is no
// accumulation to keep rescaling: each token needs exactly ONE expert, so its
// output lands solid and final the moment its expert visits.

const P = 4;
const SPT = 4; // S/P local tokens per device (S = 16)
const CELL = 14;
const GAP = 2;
const ROW_H = 136;
const ROW_GAP = 12;
const TOTAL_STEPS = 5; // 4 rotations (0..3) + done (4)

// Balanced Latin-square, top-1 routing: device d's local token row j is
// routed to expert (d - j + P) % P — chosen so the weights arriving in order
// E_d, E_{d-1}, E_{d-2}, ... serve row j exactly at step j. Every device
// holds exactly one token per expert, and every expert serves exactly one
// token per device per step.
const expert = (d, j) => (d - j + P) % P;

// Weights rotate d -> d+1 per step; expert resident on device d at step t.
const resident = (d, t) => (d - t + P) % P;

// expert(d, j) === resident(d, t) exactly when j === t: the row a weight
// block serves is the same index as the step on which it arrives.
const rowAtStep = (step) => step; // j_t
const stepForRow = (row) => row; // t_j

const CAPTIONS = [
  'Every device starts with its OWN expert — the local token routed to expert d computes immediately, zero communication. Underneath, W_d is already copying to the clockwise neighbor (device 3 wraps to device 0).',
  "First hop landed: the arriving weights light up the one matching token row, and its output lands solid and final — each token needs exactly one expert, so nothing rescales the way attention's online softmax does. The next hop is already in flight beneath the matmul.",
  'Rotation continues, hop hidden inside the FFN block — the compute lane never stalls.',
  'The last expert arrives and the final token on every device computes. Nothing left to send: P−1 hops total.',
  'Done. Every token met its expert without ever leaving home. What traveled was ~(P−1)·E² of weights per device, all hidden under compute; the all-to-all ships ~2·B·S·E/P of activations per device and hides none of it. That is the whole trade.',
];

// Left rail: the ring drawn as hop arrows between the stacked device rows,
// plus a wraparound from the bottom device back to the top. Yellow while a
// weight hop is in flight (steps 0..P-2), faint once the ring goes quiet.
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
        {active ? 'W hops →' : 'ring idle'}
      </text>
    </svg>
  );
}

function DeviceRow({ d, step }) {
  const color = CHIP_COLORS[d];
  const res = resident(d, Math.min(step, P - 1));
  const containerHeight = SPT * CELL + (SPT - 1) * GAP; // 62
  const done = step >= TOTAL_STEPS - 1;
  const activeRow = rowAtStep(step);
  const doneCount = Math.min(step + 1, P);

  const xFill = (r) => ({
    fill: CHIP_COLORS[expert(d, r)],
    highlight: !done && r === activeRow,
  });
  const wFill = () => ({ fill: CHIP_COLORS[res], highlight: !done });
  const yFill = (r) => {
    const tj = stepForRow(r);
    if (step < tj) return { fill: ABSENT };
    return { fill: CHIP_COLORS[expert(d, r)], highlight: !done && step === tj };
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
        <TensorGrid
          name={`X${d}`}
          subtitle="[S/P, E]"
          rows={SPT}
          cols={2}
          getFill={xFill}
          containerHeight={containerHeight}
          cellSize={CELL}
        />
        <OpSymbol containerHeight={containerHeight}>@</OpSymbol>
        <TensorGrid
          name="W"
          subtitle={done ? `E_${res} · done` : `E_${res}`}
          rows={2}
          cols={2}
          getFill={wFill}
          containerHeight={containerHeight}
          cellSize={CELL}
        />
        <OpSymbol containerHeight={containerHeight}>→</OpSymbol>
        <TensorGrid
          name={`Y${d}`}
          subtitle={done ? 'done' : `${doneCount}/4 tokens`}
          rows={SPT}
          cols={2}
          getFill={yFill}
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
    const e = resident(0, t);
    return {
      lane: 'ffn',
      start: t,
      dur: 1,
      label: `ffn E${e}`,
      color: CHIP_COLORS[e],
      kind: 'compute',
      visible: step >= t,
      active: step === t && !done,
    };
  });
  const comm = Array.from({ length: P - 1 }, (_, t) => {
    const e = resident(0, t);
    return {
      lane: 'hop',
      start: t + 0.2,
      dur: 0.6,
      label: `hop E${e}`,
      color: CHIP_COLORS[e],
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
        { id: 'ffn', label: 'expert FFN' },
        { id: 'hop', label: 'weight hop' },
      ]}
      blocks={[...compute, ...comm]}
      footnote="Device 0's schedule — all four devices run the same pattern at once, each starting from its own expert; every hop sits strictly inside the FFN block that hides it — the ring moves ~(P−1)·E² of weights per device and exposes none of it, where the all-to-all above moved ~2·B·S·E/P of activations per device and exposed all of it."
    />
  );
}

export default function EpRing() {
  const [step, setStep] = useState(0);

  return (
    <WidgetShell
      title="Ring of experts — tokens stay home, expert weights rotate"
      subtitle="Four devices, four experts, S = 16 tokens — four per device, one per expert: the balanced case that keeps every step of the ring evenly busy (its total per-device work is fixed regardless; balance is just what makes each step tidy). Every step a device applies the expert weights it currently holds to the one local token routed to that expert, then forwards those weights to the next device — while the next expert is already arriving. W takes the K,V seat from ring attention."
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
          { fill: CHIP_COLORS[0], label: 'routed to expert 0 (lives on device 0)' },
          { fill: CHIP_COLORS[1], label: 'expert 1' },
          { fill: CHIP_COLORS[2], label: 'expert 2' },
          { fill: CHIP_COLORS[3], label: 'expert 3' },
          { fill: CHIP_COLORS[0], ring: true, label: 'active this tick' },
          { fill: ABSENT, label: 'not yet computed' },
        ]}
      />

      <Caption>{CAPTIONS[step]}</Caption>
      <StepControls step={step} totalSteps={TOTAL_STEPS} setStep={setStep} />
    </WidgetShell>
  );
}
