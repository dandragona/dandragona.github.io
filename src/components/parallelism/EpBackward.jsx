import { useState } from 'react';
import {
  CHIP_COLORS,
  YELLOW,
  INK_SOFT,
  CARD_BG,
  CARD_BORDER,
  StepControls,
  WidgetShell,
  Caption,
} from './staircase-shared.jsx';

// EP backward — mirror of EpRouting. The same all-to-all pair re-routes the
// gradients: the output gradient ∂Y is shipped to each expert, the expert
// computes its weight and input gradients locally, and a second all-to-all
// returns each input gradient ∂X to the token's origin device.

const P = 3;
const A2A = '#0891b2';

const ASSIGN = [
  [0, 1, 2],
  [1, 2, 0],
  [2, 0, 1],
];

function holdings(d, step) {
  if (step <= 0) return ASSIGN[d].map((c) => ({ color: c, processed: false }));
  if (step === 1) return [d, d, d].map((c) => ({ color: c, processed: false }));
  if (step === 2) return [d, d, d].map((c) => ({ color: c, processed: true }));
  return ASSIGN[d].map((c) => ({ color: c, processed: true })); // steps 3,4
}

const PHASES = [
  { label: '∂Y for own tokens', accent: INK_SOFT, a2a: null, ffn: false },
  { label: 'all-to-all ∂Y to experts', accent: A2A, a2a: 'down', ffn: false },
  { label: 'expert grads · local', accent: YELLOW, a2a: null, ffn: true },
  { label: 'all-to-all ∂X back', accent: A2A, a2a: 'up', ffn: false },
  { label: 'done', accent: INK_SOFT, a2a: null, ffn: false },
];

const STEPS = [
  'Step 0 — each device starts with the output gradient ∂Y for its own tokens.',
  'Step 1 — an all-to-all ships each ∂Y to the device that ran its expert.',
  'Step 2 — each expert computes its weight gradient and the token input gradients locally.',
  "Step 3 — a second all-to-all returns each input gradient to the token's origin device.",
  'Step 4 — every device holds ∂X for its own tokens.',
];

function Token({ color, processed }) {
  return (
    <div
      style={{
        width: 18,
        height: 18,
        borderRadius: 4,
        background: CHIP_COLORS[color],
        border: '1px solid rgba(31,41,55,0.25)',
        boxShadow: processed ? 'inset 0 0 0 2px rgba(255,255,255,0.85)' : 'none',
        boxSizing: 'border-box',
        transition: 'background 220ms ease, box-shadow 220ms ease',
      }}
    />
  );
}

function A2AGlyph({ dir }) {
  const active = !!dir;
  const W = 188;
  const H = 46;
  const topY = 10;
  const botY = H - 10;
  const xs = Array.from({ length: P }, (_, i) => 22 + i * ((W - 44) / (P - 1)));
  const color = active ? A2A : 'rgba(31,41,55,0.18)';
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {xs.map((sx, si) =>
        xs.map((dx, di) => (
          <line
            key={`${si}-${di}`}
            x1={sx}
            y1={topY}
            x2={dx}
            y2={botY}
            stroke={color}
            strokeWidth={active ? 1.4 : 1}
            opacity={active ? 0.85 : 0.5}
          />
        ))
      )}
      {xs.map((x, i) => (
        <g key={`n-${i}`}>
          <circle cx={x} cy={topY} r={4} fill={CHIP_COLORS[i]} />
          <circle cx={x} cy={botY} r={4} fill={CHIP_COLORS[i]} />
        </g>
      ))}
      {active && (
        <text
          x={W / 2}
          y={H / 2 + 3.5}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          fill={A2A}
          fontFamily="ui-monospace, SFMono-Regular, monospace"
        >
          {dir === 'down' ? '∂Y ↓' : '∂X ↑'}
        </text>
      )}
    </svg>
  );
}

function DeviceCard({ d, step }) {
  const chipColor = CHIP_COLORS[d];
  const phase = PHASES[step];
  const tokens = holdings(d, step);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        borderRadius: 12,
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        minWidth: 104,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: chipColor,
          fontWeight: 700,
        }}
      >
        Device {d} · E{d}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 9.5, color: INK_SOFT, fontFamily: 'ui-monospace, monospace' }}>
          ∂FFN{d}
        </span>
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 3,
            background: phase.ffn ? YELLOW : chipColor,
            border: phase.ffn ? `2px solid ${YELLOW}` : '1px solid rgba(31,41,55,0.2)',
            boxSizing: 'border-box',
            transition: 'background 200ms ease, border 200ms ease',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {tokens.map((t, i) => (
          <Token key={i} color={t.color} processed={t.processed} />
        ))}
      </div>
      <span style={{ fontSize: 8.5, color: INK_SOFT, fontFamily: 'ui-monospace, monospace' }}>
        {step >= 3 ? '∂X' : '∂Y'}
      </span>
    </div>
  );
}

export default function EpBackward() {
  const [step, setStep] = useState(0);
  const phase = PHASES[step];

  return (
    <WidgetShell
      title="EP backward — the same all-to-all pair, re-routing gradients"
      subtitle="Dispatch and combine swap roles. The output gradient ∂Y all-to-alls to the device that owns each token's expert, the expert grads compute locally, and a second all-to-all returns each input gradient ∂X home."
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: phase.accent === INK_SOFT ? INK_SOFT : phase.accent,
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            minHeight: 16,
          }}
        >
          {phase.label}
        </div>
        <A2AGlyph dir={phase.a2a} />
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        {Array.from({ length: P }, (_, d) => (
          <DeviceCard key={d} d={d} step={step} />
        ))}
      </div>

      <Caption>{STEPS[step]}</Caption>
      <StepControls step={step} totalSteps={STEPS.length} setStep={setStep} />
    </WidgetShell>
  );
}
