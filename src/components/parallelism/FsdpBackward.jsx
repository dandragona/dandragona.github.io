import { useState } from 'react';
import {
  CHIP_COLORS,
  YELLOW,
  ABSENT,
  INK,
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

// Backward visits layers in reverse: L4, L3, L2, L1 (matches the L1-L4 forward
// pipeline shown in OverlapTimeline strategy="fsdp"). Each layer: AG W (need
// full W for ∂X and ∂W), backward compute, RS ∂W. Steps below bundle compute
// with the AG/RS overlap that follows it.
const STEPS = [
  {
    caption:
      'Forward done. Every chip holds its batch slice of Y. W is back to sharded (each chip owns its FSDP row). Now we walk the layers in REVERSE.',
    layerLabel: 'sharded',
    wMat: false,
    yShown: true,
    gShown: false,
    gMode: 'absent',
    commActive: false,
    commLabel: null,
    commCount: 0,
  },
  {
    caption:
      'Layer 4 backward begins. First, all-gather W₄ — we need the full W to compute ∂W₄ and the upstream ∂X. (If the forward cached it, this AG may be skipped.)',
    layerLabel: 'AG W₄',
    wMat: false,
    yShown: true,
    gShown: false,
    gMode: 'absent',
    commActive: true,
    commLabel: 'AG W₄',
    commCount: 1,
  },
  {
    caption:
      'W₄ materialized (yellow). Compute backward L4: each chip produces ∂W₄ at FULL shape from its batch slice. The chips disagree on values — that\'s why we reduce-scatter next.',
    layerLabel: 'W₄',
    wMat: true,
    yShown: true,
    gShown: true,
    gMode: 'full',
    commActive: false,
    commLabel: null,
    commCount: 1,
  },
  {
    caption:
      "Reduce-scatter ∂W₄: chip 0 keeps row 0, chip 1 keeps row 1 — the gradient ends up FSDP-sharded, matching W's storage. Layer 3's AG can overlap here.",
    layerLabel: 'RS ∂W₄ · AG W₃',
    wMat: false,
    yShown: true,
    gShown: true,
    gMode: 'rs-inflight',
    commActive: true,
    commLabel: 'RS ∂W₄ + AG W₃',
    commCount: 3,
  },
  {
    caption:
      "Layer 3 backward computes ∂W₃; meanwhile RS ∂W₃ overlaps with AG W₂ for layer 2. Same pipeline as forward, just in reverse and with RS replacing the role of AG.",
    layerLabel: 'W₃ · RS ∂W₃ · AG W₂',
    wMat: true,
    yShown: true,
    gShown: true,
    gMode: 'sharded',
    commActive: true,
    commLabel: 'RS ∂W₃ + AG W₂',
    commCount: 5,
  },
  {
    caption:
      "Layer 2 backward computes ∂W₂; RS ∂W₂ overlaps with AG W₁. The middle of the staircase looks the same on every layer.",
    layerLabel: 'W₂ · RS ∂W₂ · AG W₁',
    wMat: true,
    yShown: true,
    gShown: true,
    gMode: 'sharded',
    commActive: true,
    commLabel: 'RS ∂W₂ + AG W₁',
    commCount: 7,
  },
  {
    caption:
      'Final layer: ∂W₁ is computed and reduce-scattered. Nothing left to prefetch — the tail of the staircase runs alone.',
    layerLabel: 'all sharded',
    wMat: false,
    yShown: true,
    gShown: true,
    gMode: 'sharded',
    commActive: true,
    commLabel: 'RS ∂W₁',
    commCount: 8,
  },
  {
    caption:
      "Backward complete. Every gradient lives in the same shape as its parameter — one row per chip. The optimizer can step W without ever holding the whole tensor on one device. That's the FSDP invariant, preserved.",
    layerLabel: 'done',
    wMat: false,
    yShown: true,
    gShown: true,
    gMode: 'sharded',
    commActive: false,
    commLabel: null,
    commCount: 8,
  },
];

const ownsWRow = (chipIdx, row) => row === chipIdx;
const ownsBatchRow = (chipIdx, row) =>
  Math.floor(row / (B / NUM_CHIPS)) === chipIdx;

function ChipMatmul({ chipIdx, step }) {
  const chipColor = CHIP_COLORS[chipIdx];
  const s = STEPS[step];
  const maxRows = Math.max(B, E);
  const containerHeight = maxRows * CELL + (maxRows - 1) * GAP;

  const xFill = (r) =>
    ownsBatchRow(chipIdx, r) ? { fill: chipColor } : { fill: ABSENT };

  const wFill = (r) => {
    if (s.wMat) return { fill: YELLOW };
    return ownsWRow(chipIdx, r) ? { fill: chipColor } : { fill: ABSENT };
  };

  const yFill = (r) => {
    if (!s.yShown) return { fill: ABSENT };
    return ownsBatchRow(chipIdx, r) ? { fill: chipColor } : { fill: ABSENT };
  };

  const gFill = (r) => {
    if (!s.gShown) return { fill: ABSENT };
    if (s.gMode === 'full') return { fill: chipColor, stripe: true };
    if (s.gMode === 'rs-inflight') {
      return ownsWRow(chipIdx, r)
        ? { fill: chipColor }
        : { fill: chipColor, stripe: true };
    }
    if (s.gMode === 'sharded') {
      return ownsWRow(chipIdx, r) ? { fill: chipColor } : { fill: ABSENT };
    }
    return { fill: ABSENT };
  };

  const gSubtitle =
    s.gMode === 'full'
      ? 'full ∂W'
      : s.gMode === 'rs-inflight'
      ? 'mid-RS'
      : s.gMode === 'sharded'
      ? 'FSDP-sharded'
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
        <TensorGrid
          name="W"
          subtitle={s.layerLabel}
          rows={E}
          cols={E}
          getFill={wFill}
          containerHeight={containerHeight}
        />
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
      <svg width="100" height="14" viewBox="0 0 100 14">
        <line
          x1="10"
          y1="7"
          x2="90"
          y2="7"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <polygon points="2,7 12,2 12,12" fill={color} />
        <polygon points="98,7 88,2 88,12" fill={color} />
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
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: 12,
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: INK }}>
        <span style={{ display: 'inline-block', width: 10, height: 3, background: YELLOW, borderRadius: 2 }} />
        collectives:
        <strong style={{ color: YELLOW, minWidth: 14, textAlign: 'right' }}>{s.commCount}×</strong>
      </span>
    </div>
  );
}

export default function FsdpBackward() {
  const [step, setStep] = useState(0);
  const s = STEPS[step];

  return (
    <WidgetShell
      title="FSDP backward — per-layer reduce-scatter, mirror of the forward gather"
      subtitle="Backward walks the layers in reverse. Each layer: gather W (if not cached), compute ∂W full-shape, then reduce-scatter to the FSDP storage layout. The next layer's AG can overlap with the current RS."
    >
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
        <ChipMatmul chipIdx={0} step={step} />
        <CommLink active={s.commActive} label={s.commLabel} />
        <ChipMatmul chipIdx={1} step={step} />
      </div>
      <Counter step={step} />
      <Caption>{s.caption}</Caption>
      <StepControls step={step} totalSteps={STEPS.length} setStep={setStep} />
    </WidgetShell>
  );
}
