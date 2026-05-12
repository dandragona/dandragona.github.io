import { useState } from 'react';
import {
  CHIP_COLORS,
  YELLOW,
  ABSENT,
  INK_SOFT,
  CARD_BG,
  CARD_BORDER,
  CELL,
  GAP,
  TensorGrid,
  OpSymbol,
  StepControls,
  WidgetShell,
  Caption,
} from './staircase-shared.jsx';

const B = 4;
const E = 2;
const NUM_CHIPS = 2;

const STEPS = [
  {
    caption:
      'Forward done. Each chip has its slice of Y, computed with the replicated W (yellow). No gradients yet.',
    gShown: false,
    gMode: 'absent',
    linkActive: false,
    arCount: 0,
  },
  {
    caption:
      "Backward computes ∂W locally on each chip. Since chip 0 processed different examples than chip 1, their gradients DISAGREE — that's what the all-reduce will fix.",
    gShown: true,
    gMode: 'local',
    linkActive: false,
    arCount: 0,
  },
  {
    caption:
      'All-reduce ∂W. Every chip sums its gradient with the others (mid-flight: striped). Exactly one collective for the entire training step.',
    gShown: true,
    gMode: 'inflight',
    linkActive: true,
    arCount: 1,
  },
  {
    caption:
      'AR done. ∂W is identical on every chip (yellow — the same shape and same value as the replicated W is about to receive). The optimizer steps every replica in lockstep.',
    gShown: true,
    gMode: 'averaged',
    linkActive: false,
    arCount: 1,
  },
];

function ChipMatmul({ chipIdx, step }) {
  const chipColor = CHIP_COLORS[chipIdx];
  const s = STEPS[step];
  const maxRows = Math.max(B, E);
  const containerHeight = maxRows * CELL + (maxRows - 1) * GAP;

  const xFill = (r) =>
    Math.floor(r / (B / NUM_CHIPS)) === chipIdx
      ? { fill: chipColor }
      : { fill: ABSENT };

  const wFill = () => ({ fill: YELLOW });

  const yFill = (r) =>
    Math.floor(r / (B / NUM_CHIPS)) === chipIdx
      ? { fill: chipColor }
      : { fill: ABSENT };

  const gFill = () => {
    if (!s.gShown) return { fill: ABSENT };
    if (s.gMode === 'inflight') return { fill: chipColor, stripe: true };
    if (s.gMode === 'averaged') return { fill: YELLOW };
    return { fill: chipColor };
  };

  const gSubtitle =
    s.gMode === 'local' ? 'local' : s.gMode === 'inflight' ? 'mid-AR' : s.gMode === 'averaged' ? 'averaged' : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px 10px',
        borderRadius: 12,
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        alignItems: 'center',
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: INK_SOFT,
          fontWeight: 600,
        }}
      >
        Chip {chipIdx}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
        <TensorGrid name="X" rows={B} cols={E} getFill={xFill} containerHeight={containerHeight} />
        <OpSymbol containerHeight={containerHeight}>@</OpSymbol>
        <TensorGrid name="W" rows={E} cols={E} getFill={wFill} containerHeight={containerHeight} />
        <OpSymbol containerHeight={containerHeight}>=</OpSymbol>
        <TensorGrid name="Y" rows={B} cols={E} getFill={yFill} containerHeight={containerHeight} />
        {s.gShown && (
          <>
            <OpSymbol containerHeight={containerHeight}>·</OpSymbol>
            <TensorGrid
              name="∂W"
              subtitle={gSubtitle}
              rows={E}
              cols={E}
              getFill={gFill}
              containerHeight={containerHeight}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ArLink({ active }) {
  const color = active ? YELLOW : 'rgba(31,41,55,0.22)';
  const stroke = active ? 3 : 2;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <svg width="80" height="14" viewBox="0 0 80 14">
        <line
          x1="10"
          y1="7"
          x2="70"
          y2="7"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <polygon points="2,7 12,2 12,12" fill={color} />
        <polygon points="78,7 68,2 68,12" fill={color} />
      </svg>
      <div
        style={{
          fontSize: 9,
          color: active ? color : 'transparent',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontWeight: 600,
          minHeight: 12,
          transition: 'color 200ms ease',
        }}
      >
        AR ∂W
      </div>
    </div>
  );
}

function Counter({ step }) {
  const s = STEPS[step];
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: 12,
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        color: 'inherit',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ display: 'inline-block', width: 10, height: 3, background: YELLOW, borderRadius: 2 }} />
        all-reduces:
        <strong style={{ color: YELLOW, minWidth: 14, textAlign: 'right' }}>{s.arCount}×</strong>
      </span>
    </div>
  );
}

export default function DpBackward() {
  const [step, setStep] = useState(0);
  const s = STEPS[step];

  return (
    <WidgetShell
      title="DP backward — one all-reduce, end of step"
      subtitle="W is replicated, so every chip computed a local ∂W from its batch slice. One AR sums them. That is the entire backward-pass communication budget for DP."
    >
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
        <ChipMatmul chipIdx={0} step={step} />
        <ArLink active={s.linkActive} />
        <ChipMatmul chipIdx={1} step={step} />
      </div>
      <Counter step={step} />
      <Caption>{s.caption}</Caption>
      <StepControls step={step} totalSteps={STEPS.length} setStep={setStep} />
    </WidgetShell>
  );
}
