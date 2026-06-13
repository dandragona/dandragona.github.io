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

// Context Parallelism — the DeepSpeed-Ulysses variant.
// Each device projects its sequence slice into per-head Q/K/V; the all-to-all
// acts on those projections (and on the attention output on the way back), not
// on a generic activation tensor. Pictured as a grid of (sequence chunk) ×
// (head group), the all-to-all transposes which axis is sharded:
// sequence-sharded (each device owns a ROW — its positions, all heads) ⇄
// head-sharded (each device owns a COLUMN — all positions, its heads). With
// the full sequence in hand for its heads, each device runs attention locally;
// a second all-to-all transposes back. The cell color marks the owning device,
// so the transpose reads as a literal flip of rows ⇄ columns.

const P = 4;
const A2A = '#0891b2';
const CELL = 26;
const GAP = 3;
const LABEL = 20;

// owner device + flags for the cell at (sequence row s, head column h) at step t.
function cellState(s, h, step) {
  if (step <= 0) return { dev: s, ring: false, inset: false }; // sequence-sharded
  if (step === 1) return { dev: h, ring: false, inset: false }; // head-sharded
  if (step === 2) return { dev: h, ring: true, inset: false }; // local attention
  return { dev: s, ring: false, inset: true }; // 3,4 — back to sequence-sharded
}

const PHASES = [
  { label: 'sequence-sharded · all heads', accent: INK_SOFT, a2a: null },
  { label: 'all-to-all · seq → heads', accent: A2A, a2a: 'seq → heads' },
  { label: 'full attention · local', accent: YELLOW, a2a: null },
  { label: 'all-to-all · heads → seq', accent: A2A, a2a: 'heads → seq' },
  { label: 'done', accent: INK_SOFT, a2a: null },
];

const STEPS = [
  'Step 0 — sequence-sharded: each device holds its slice of the positions, with all of the attention heads.',
  'Step 1 — the first all-to-all transposes the layout: gather the full sequence, scatter the heads, so each device owns one head group across every position.',
  'Step 2 — with the whole sequence in hand for its head group, each device runs full-sequence attention locally, with no communication.',
  'Step 3 — the second all-to-all transposes back: scatter the sequence, gather the heads, returning to the sequence-sharded layout.',
  'Step 4 — back to sequence-sharded and attention-complete, ready for the FFN and the next layer.',
];

function Cell({ dev, ring, inset }) {
  return (
    <div
      style={{
        width: CELL,
        height: CELL,
        borderRadius: 4,
        background: CHIP_COLORS[dev],
        border: ring ? `2px solid ${YELLOW}` : '1px solid rgba(31,41,55,0.22)',
        boxShadow: inset ? 'inset 0 0 0 2px rgba(255,255,255,0.85)' : 'none',
        boxSizing: 'border-box',
        transition: 'background 240ms ease, border 200ms ease, box-shadow 200ms ease',
      }}
    />
  );
}

function A2AGlyph({ dir }) {
  const active = !!dir;
  const W = 168;
  const H = 42;
  const topY = 9;
  const botY = H - 9;
  const xs = Array.from({ length: P }, (_, i) => 18 + i * ((W - 36) / (P - 1)));
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
            strokeWidth={active ? 1.3 : 0.9}
            opacity={active ? 0.8 : 0.45}
          />
        ))
      )}
      {xs.map((x, i) => (
        <g key={`n-${i}`}>
          <circle cx={x} cy={topY} r={3.5} fill={CHIP_COLORS[i]} />
          <circle cx={x} cy={botY} r={3.5} fill={CHIP_COLORS[i]} />
        </g>
      ))}
      {active && (
        <text
          x={W / 2}
          y={H / 2 + 3}
          textAnchor="middle"
          fontSize={8.5}
          fontWeight={700}
          fill={A2A}
          fontFamily="ui-monospace, SFMono-Regular, monospace"
        >
          {dir}
        </text>
      )}
    </svg>
  );
}

const axisLabel = {
  fontSize: 9.5,
  color: INK_SOFT,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  letterSpacing: '0.04em',
};

function Grid({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* sequence axis title (vertical) */}
      <div
        style={{
          ...axisLabel,
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        sequence ↓
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* heads axis title + column headers */}
        <div style={{ ...axisLabel, textTransform: 'uppercase', fontWeight: 600, marginLeft: LABEL + GAP, textAlign: 'center' }}>
          heads →
        </div>
        <div style={{ display: 'flex', gap: GAP, marginLeft: LABEL + GAP }}>
          {Array.from({ length: P }, (_, h) => (
            <div key={h} style={{ width: CELL, textAlign: 'center', ...axisLabel }}>
              h{h}
            </div>
          ))}
        </div>

        {/* rows */}
        {Array.from({ length: P }, (_, s) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: GAP }}>
            <div style={{ width: LABEL, textAlign: 'right', ...axisLabel }}>s{s}</div>
            {Array.from({ length: P }, (_, h) => (
              <Cell key={h} {...cellState(s, h, step)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CpUlysses() {
  const [step, setStep] = useState(0);
  const phase = PHASES[step];
  const owns = step === 1 || step === 2 ? 'a head group (one column)' : 'a sequence chunk (one row)';

  return (
    <WidgetShell
      title="CP — Ulysses transposes the sharded axis with all-to-all"
      subtitle="The grid is the attention's per-head Q/K/V, laid out as sequence (rows) × heads (columns); a cell's color is the device that owns it. An all-to-all flips which axis is sharded — sequence-sharded (own a row) becomes head-sharded (own a column) — so each device can run full attention over the whole sequence for its heads, then a second all-to-all flips back."
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: phase.accent,
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            minHeight: 16,
          }}
        >
          {phase.label}
        </div>
        <A2AGlyph dir={phase.a2a} />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '12px 14px',
          borderRadius: 12,
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
        }}
      >
        <Grid step={step} />
      </div>

      <div style={{ textAlign: 'center', fontSize: 11, color: INK_SOFT, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
        each device owns {owns}
      </div>

      <Caption>{STEPS[step]}</Caption>
      <StepControls step={step} totalSteps={STEPS.length} setStep={setStep} />
    </WidgetShell>
  );
}
