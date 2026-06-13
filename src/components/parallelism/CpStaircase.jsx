import { useState } from 'react';
import {
  CHIP_COLORS,
  YELLOW,
  ABSENT,
  INK_SOFT,
  CARD_BG,
  CARD_BORDER,
  StepControls,
  WidgetShell,
  Caption,
} from './staircase-shared.jsx';

// Context Parallelism — ring attention.
// P devices each own a sequence chunk's queries (Q_d) and start holding their
// own K/V block. Each step, every K/V block hops one device clockwise around
// the ring; the device folds the freshly-arrived block into its running
// attention output. The next hop is sent while the current block is still
// being attended to — that is the overlap.

const P = 4; // devices in the ring
const NUM_STEPS = P + 1; // 0..3 integrate the four blocks, 4 = complete

// Block index resident on device d at step t (clockwise rotation).
const resident = (d, t) => (d - t + P) % P;

// Source block folded into device d's output this step.
const activeSource = (d, t) => (t < P ? resident(d, t) : -1);

// True while a K/V block is in flight to the next device (overlapping compute).
const hopActive = (t) => t < P - 1; // steps 0,1,2

const STEPS = [
  'Step 0 — each device attends to its own K/V block while the first ring hop sends every block on to the next device.',
  "Step 1 — the blocks have hopped once, so each device folds in its neighbor's K/V while the next hop is already in flight.",
  'Step 2 — another block lands and folds in, the attention matmul and the K/V transfer running concurrently.',
  "Step 3 — the last K/V block lands and folds in, with no hop left to send — the ring's tail.",
  'Step 4 — every device has now seen all four K/V blocks and each query block has its complete attention output.',
];

const NODE_R = 13;
const RING_R = 52;
const RING_SIZE = 2 * (RING_R + NODE_R) + 26;

// Compass placement: D0 top, then clockwise (right, bottom, left).
function nodePos(d) {
  const angle = (-90 + d * (360 / P)) * (Math.PI / 180);
  const cx = RING_SIZE / 2 + RING_R * Math.cos(angle);
  const cy = RING_SIZE / 2 + RING_R * Math.sin(angle);
  return { cx, cy };
}

function RingMini({ step }) {
  const active = hopActive(step);
  const arcColor = active ? YELLOW : 'rgba(31,41,55,0.22)';
  return (
    <svg
      width={RING_SIZE}
      height={RING_SIZE}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* clockwise hop arcs between adjacent devices */}
      {Array.from({ length: P }, (_, d) => {
        const a = nodePos(d);
        const b = nodePos((d + 1) % P);
        // shorten endpoints so the line sits between node circles
        const dx = b.cx - a.cx;
        const dy = b.cy - a.cy;
        const len = Math.hypot(dx, dy);
        const ux = dx / len;
        const uy = dy / len;
        const x1 = a.cx + ux * (NODE_R + 3);
        const y1 = a.cy + uy * (NODE_R + 3);
        const x2 = b.cx - ux * (NODE_R + 7);
        const y2 = b.cy - uy * (NODE_R + 7);
        return (
          <g key={`arc-${d}`}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={arcColor}
              strokeWidth={active ? 2.5 : 1.5}
              strokeLinecap="round"
            />
            <polygon
              points={`${x2},${y2} ${x2 - ux * 7 - uy * 4},${y2 - uy * 7 + ux * 4} ${x2 - ux * 7 + uy * 4},${y2 - uy * 7 - ux * 4}`}
              fill={arcColor}
            />
          </g>
        );
      })}

      {/* device nodes, each tinted by the K/V block it currently holds */}
      {Array.from({ length: P }, (_, d) => {
        const { cx, cy } = nodePos(d);
        const src = resident(d, step);
        const holding = step < P;
        return (
          <g key={`node-${d}`}>
            <circle
              cx={cx}
              cy={cy}
              r={NODE_R}
              fill={holding ? `${CHIP_COLORS[src]}` : CHIP_COLORS[d]}
              fillOpacity={holding ? 0.92 : 0.92}
              stroke={CHIP_COLORS[d]}
              strokeWidth={2.5}
            />
            <text
              x={cx}
              y={cy + 3.5}
              textAnchor="middle"
              fontSize={10}
              fontWeight={700}
              fill="#ffffff"
              fontFamily="ui-monospace, SFMono-Regular, monospace"
            >
              D{d}
            </text>
          </g>
        );
      })}

      <text
        x={RING_SIZE / 2}
        y={RING_SIZE / 2 + 3}
        textAnchor="middle"
        fontSize={9}
        fill={INK_SOFT}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {hopActive(step) ? 'K/V →' : step < P ? 'fold in' : 'done'}
      </text>
    </svg>
  );
}

function AccCell({ color }) {
  const filled = !!color;
  return (
    <div
      style={{
        width: 16,
        height: 16,
        borderRadius: 3,
        background: filled ? color.bg : ABSENT,
        border: color?.ring ? `2px solid ${YELLOW}` : '1px solid rgba(31,41,55,0.2)',
        boxSizing: 'border-box',
        transition: 'background 220ms ease, border 220ms ease',
      }}
    />
  );
}

function DeviceCard({ d, step }) {
  const chipColor = CHIP_COLORS[d];
  const src = resident(d, step);
  const active = activeSource(d, step);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 7,
        padding: '10px 10px',
        borderRadius: 12,
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        minWidth: 96,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: chipColor,
          fontWeight: 700,
        }}
      >
        Device {d}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 9.5, color: INK_SOFT, fontFamily: 'ui-monospace, monospace' }}>
          Q{d}
        </span>
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            background: chipColor,
            border: '1px solid rgba(31,41,55,0.2)',
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 9.5, color: INK_SOFT, fontFamily: 'ui-monospace, monospace' }}>
          holds
        </span>
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            background: step < P ? CHIP_COLORS[src] : 'transparent',
            border: step < P ? `2px solid ${YELLOW}` : '1px dashed rgba(31,41,55,0.25)',
            boxSizing: 'border-box',
            transition: 'background 220ms ease',
          }}
        />
        <span style={{ fontSize: 9, color: INK_SOFT, fontFamily: 'ui-monospace, monospace' }}>
          {step < P ? `kv${src}` : '✓'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from({ length: P }, (_, k) => {
            // cell k = the block folded in at step k → source (d - k) mod P
            const cellSrc = (d - k + P) % P;
            const integrated = k <= Math.min(step, P - 1);
            const isActive = k === step && active === cellSrc;
            return (
              <AccCell
                key={k}
                color={integrated ? { bg: CHIP_COLORS[cellSrc], ring: isActive } : null}
              />
            );
          })}
        </div>
        <span style={{ fontSize: 8.5, color: INK_SOFT, fontFamily: 'ui-monospace, monospace' }}>
          O{d} (attn out)
        </span>
      </div>
    </div>
  );
}

export default function CpStaircase() {
  const [step, setStep] = useState(0);

  return (
    <WidgetShell
      title="CP — ring attention accumulates over the sequence"
      subtitle="Four devices, each owning one chunk of the sequence. A device keeps its query block Q_d fixed and rotates K/V blocks clockwise around the ring, folding each arriving block into its running attention output O_d. The yellow ring marks the block being attended to this tick; while it computes, the next K/V block is already hopping to the neighbor."
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <RingMini step={step} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {Array.from({ length: P }, (_, d) => (
            <DeviceCard key={d} d={d} step={step} />
          ))}
        </div>
      </div>
      <Caption>{STEPS[step]}</Caption>
      <StepControls step={step} totalSteps={NUM_STEPS} setStep={setStep} />
    </WidgetShell>
  );
}
