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
    linkLabel: null,
    arPhase: 'idle',
  },
  {
    caption:
      "Backward computes ∂W locally on each chip. Each chip holds the full ∂W shape, but the values DISAGREE — these are partial sums waiting to be combined.",
    gShown: true,
    gMode: 'local',
    linkActive: false,
    linkLabel: null,
    arPhase: 'idle',
  },
  {
    caption:
      'Reduce-scatter ∂W. Chips sum partials pairwise and each ends up owning one column-strip of the summed gradient (yellow). First half of the all-reduce.',
    gShown: true,
    gMode: 'rs_done',
    linkActive: true,
    linkLabel: 'RS ∂W',
    arPhase: 'half',
  },
  {
    caption:
      "All-gather broadcasts each chip's strip to the others. Every chip now holds the full summed ∂W — identical shape and values on every replica. RS + AG = one all-reduce.",
    gShown: true,
    gMode: 'averaged',
    linkActive: true,
    linkLabel: 'AG ∂W',
    arPhase: 'done',
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

  const gFill = (r, c) => {
    if (!s.gShown) return { fill: ABSENT };
    if (s.gMode === 'local') return { fill: chipColor, stripe: true };
    if (s.gMode === 'rs_done') {
      // Each chip owns one column-strip of the summed gradient.
      return c === chipIdx ? { fill: YELLOW } : { fill: ABSENT };
    }
    if (s.gMode === 'averaged') return { fill: YELLOW };
    return { fill: ABSENT };
  };

  const gSubtitle =
    s.gMode === 'local'
      ? 'local · disagrees'
      : s.gMode === 'rs_done'
      ? `col ${chipIdx} owned`
      : s.gMode === 'averaged'
      ? 'full · averaged'
      : null;

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

function CommLink({ active, label }) {
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
          whiteSpace: 'nowrap',
          transition: 'color 200ms ease',
        }}
      >
        {label || ' '}
      </div>
    </div>
  );
}

function Counter({ step }) {
  const s = STEPS[step];
  const arText =
    s.arPhase === 'half'
      ? 'all-reduce in progress (RS done · AG pending)'
      : s.arPhase === 'done'
      ? 'all-reduce: 1× (= RS + AG)'
      : 'all-reduce: 0×';
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
        <span style={{ color: s.arPhase === 'idle' ? INK_SOFT : undefined }}>{arText}</span>
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
      subtitle="W is replicated, so every chip computed a local ∂W from its batch slice. One all-reduce — really a reduce-scatter followed by an all-gather — combines them. That is the entire backward-pass communication budget for DP."
    >
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
        <ChipMatmul chipIdx={0} step={step} />
        <CommLink active={s.linkActive} label={s.linkLabel} />
        <ChipMatmul chipIdx={1} step={step} />
      </div>
      <Counter step={step} />
      <Caption>{s.caption}</Caption>
      <StepControls step={step} totalSteps={STEPS.length} setStep={setStep} />
    </WidgetShell>
  );
}
