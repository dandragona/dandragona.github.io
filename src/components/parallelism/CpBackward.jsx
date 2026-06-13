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

// CP backward — mirror of CpStaircase. The K/V ring runs the other way,
// carrying ∂K/∂V partials. Each device assembles the complete gradient for
// its own sequence block by summing the partials that ring back to it.

const P = 4;
const NUM_STEPS = P + 1;

// Counter-clockwise: the block whose ∂K/∂V partial sits on device d at step t.
const carried = (d, t) => (d + t) % P;
const hopActive = (t) => t < P - 1;

const STEPS = [
  'Step 0 — each device forms the local ∂K/∂V from the block it currently holds.',
  "Step 1 — partials ring one hop back; each device folds in another device's ∂K/∂V contribution.",
  'Step 2 — another partial rings in and is summed, while the next hop is already moving.',
  "Step 3 — the last partial lands and each block's ∂K/∂V is fully summed.",
  'Step 4 — every device owns the complete ∂K/∂V for its own sequence block.',
];

const NODE_R = 13;
const RING_R = 52;
const RING_SIZE = 2 * (RING_R + NODE_R) + 26;

function nodePos(d) {
  const angle = (-90 + d * (360 / P)) * (Math.PI / 180);
  return {
    cx: RING_SIZE / 2 + RING_R * Math.cos(angle),
    cy: RING_SIZE / 2 + RING_R * Math.sin(angle),
  };
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
      {/* counter-clockwise hop arcs (gradients ring back the other way) */}
      {Array.from({ length: P }, (_, d) => {
        const a = nodePos(d);
        const b = nodePos((d - 1 + P) % P);
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

      {Array.from({ length: P }, (_, d) => {
        const { cx, cy } = nodePos(d);
        const src = carried(d, step);
        const holding = step < P;
        return (
          <g key={`node-${d}`}>
            <circle
              cx={cx}
              cy={cy}
              r={NODE_R}
              fill={holding ? CHIP_COLORS[src] : CHIP_COLORS[d]}
              fillOpacity={0.92}
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
        {hopActive(step) ? '∂K/∂V →' : step < P ? 'sum in' : 'done'}
      </text>
    </svg>
  );
}

function AccCell({ color, ring }) {
  return (
    <div
      style={{
        width: 16,
        height: 16,
        borderRadius: 3,
        background: color || ABSENT,
        border: ring ? `2px solid ${YELLOW}` : '1px solid rgba(31,41,55,0.2)',
        boxSizing: 'border-box',
        transition: 'background 220ms ease, border 220ms ease',
      }}
    />
  );
}

function DeviceCard({ d, step }) {
  const chipColor = CHIP_COLORS[d];
  const src = carried(d, step);
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
          carries
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
          {step < P ? `∂kv${src}` : '✓'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from({ length: P }, (_, k) => {
            // cell k = the partial summed in at step k → from device (d + k) mod P
            const cellSrc = (d + k) % P;
            const integrated = k <= Math.min(step, P - 1);
            const isActive = k === step && step < P;
            return (
              <AccCell
                key={k}
                color={integrated ? CHIP_COLORS[cellSrc] : null}
                ring={isActive && integrated}
              />
            );
          })}
        </div>
        <span style={{ fontSize: 8.5, color: INK_SOFT, fontFamily: 'ui-monospace, monospace' }}>
          ∂K/∂V{d}
        </span>
      </div>
    </div>
  );
}

export default function CpBackward() {
  const [step, setStep] = useState(0);

  return (
    <WidgetShell
      title="CP backward — the K/V ring runs in reverse"
      subtitle="Same four-device ring as the forward pass, the other way around. Each block's ∂K/∂V is a sum of contributions from every device that attended to it, so the partials ring back and accumulate. The yellow ring marks the partial summed in this tick."
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
