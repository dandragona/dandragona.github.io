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

// Expert Parallelism — each device hosts one expert (color = device color).
// A local router tags every token with its target expert. A dispatch
// all-to-all ships each token to the device that owns its expert; the expert
// FFN runs locally; a combine all-to-all returns each result to its origin.

const P = 3; // devices / experts
const A2A = '#0891b2'; // cyan — the routing collective

// Original token → target-expert assignment per device (balanced: after
// dispatch each device receives exactly one token from every device).
const ASSIGN = [
  [0, 1, 2],
  [1, 2, 0],
  [2, 0, 1],
];

// Tokens device d currently holds: { color (target expert), processed }.
function holdings(d, step) {
  if (step <= 0) return ASSIGN[d].map((c) => ({ color: c, processed: false }));
  if (step === 1) return [d, d, d].map((c) => ({ color: c, processed: false }));
  if (step === 2) return [d, d, d].map((c) => ({ color: c, processed: true }));
  return ASSIGN[d].map((c) => ({ color: c, processed: true })); // steps 3,4
}

const PHASES = [
  { label: 'router tags tokens', accent: INK_SOFT, a2a: null, ffn: false },
  { label: 'dispatch all-to-all', accent: A2A, a2a: 'down', ffn: false },
  { label: 'expert FFN · local', accent: YELLOW, a2a: null, ffn: true },
  { label: 'combine all-to-all', accent: A2A, a2a: 'up', ffn: false },
  { label: 'done', accent: INK_SOFT, a2a: null, ffn: false },
];

const STEPS = [
  'Step 0 — the router tags each token with its expert (color), and every device holds a mix.',
  'Step 1 — the dispatch all-to-all sends every token to the device that owns its expert.',
  'Step 2 — each device runs its own expert FFN locally, with no communication.',
  'Step 3 — the combine all-to-all returns each result to the device the token came from.',
  'Step 4 — every device is back to its own tokens, now expert-processed.',
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

// Bipartite all-to-all glyph: every device sends to every device.
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
          {dir === 'down' ? 'dispatch ↓' : 'combine ↑'}
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
          FFN{d}
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
        tokens
      </span>
    </div>
  );
}

export default function EpRouting() {
  const [step, setStep] = useState(0);
  const phase = PHASES[step];

  return (
    <WidgetShell
      title="EP — route tokens to experts with all-to-all"
      subtitle="Three devices, each holding one expert. The router assigns every token to an expert (its color). A dispatch all-to-all gathers each expert's tokens onto its device; the expert FFN runs locally; a combine all-to-all scatters the results back. A token with a white inset has been through its expert."
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
