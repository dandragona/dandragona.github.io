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

// Backward visits layers in reverse: L3, L2, L1.
// Each layer: AG W (need full W for ∂X, ∂W computation), backward compute, RS ∂W.
// The pipeline runs in reverse order. Below: simplified steps to surface the pattern.
const STEPS = [
  {
    caption:
      'Forward done. Every chip holds its batch slice of Y. W is back to sharded (each chip owns its FSDP row). Now we walk the layers in REVERSE.',
    layerLabel: 'sharded',
    wMat: false,
    yShown: true,
    gShown: false,
    gMode: 'absent',
    fastActive: false,
    fastLabel: null,
    fastCount: 0,
  },
  {
    caption:
      'Layer 3 backward begins. First, all-gather W₃ — we need the full W to compute ∂W₃ and the upstream ∂X. (If the forward cached it, this AG may be skipped.)',
    layerLabel: 'AG W₃',
    wMat: false,
    yShown: true,
    gShown: false,
    gMode: 'absent',
    fastActive: true,
    fastLabel: 'AG W₃',
    fastCount: 1,
  },
  {
    caption:
      'W₃ materialized (yellow). Compute backward L3: each chip produces ∂W₃ at FULL shape from its batch slice. The chips disagree on values — that\'s why we reduce-scatter next.',
    layerLabel: 'W₃',
    wMat: true,
    yShown: true,
    gShown: true,
    gMode: 'full',
    fastActive: false,
    fastLabel: null,
    fastCount: 1,
  },
  {
    caption:
      "Reduce-scatter ∂W₃ on the fast axis: chip 0 keeps row 0, chip 1 keeps row 1 — the gradient ends up FSDP-sharded, matching W's storage. Layer 2's AG can overlap here.",
    layerLabel: 'RS ∂W₃ · AG W₂',
    wMat: false,
    yShown: true,
    gShown: true,
    gMode: 'rs-inflight',
    fastActive: true,
    fastLabel: 'RS ∂W₃ + AG W₂',
    fastCount: 3,
  },
  {
    caption:
      "Layer 2 backward computes ∂W₂; meanwhile RS ∂W₂ overlaps with AG W₁ for layer 1. Same pipeline as forward, just in reverse and with RS replacing the role of AG.",
    layerLabel: 'W₂ · RS ∂W₂ · AG W₁',
    wMat: true,
    yShown: true,
    gShown: true,
    gMode: 'sharded',
    fastActive: true,
    fastLabel: 'RS ∂W₂ + AG W₁',
    fastCount: 5,
  },
  {
    caption:
      'Final layer: ∂W₁ is computed, reduce-scattered, and we are done with the backward. Each chip now owns its FSDP shard of every layer\'s gradient.',
    layerLabel: 'all sharded',
    wMat: false,
    yShown: true,
    gShown: true,
    gMode: 'sharded',
    fastActive: true,
    fastLabel: 'RS ∂W₁',
    fastCount: 6,
  },
  {
    caption:
      "Backward complete. Every gradient lives in the same shape as its parameter — one row per chip. The optimizer can step W without ever holding the whole tensor on one device. That's the FSDP invariant, preserved.",
    layerLabel: 'done',
    wMat: false,
    yShown: true,
    gShown: true,
    gMode: 'sharded',
    fastActive: false,
    fastLabel: null,
    fastCount: 6,
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
    if (s.gMode === 'full') return { fill: chipColor };
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

function FastLink({ active, label }) {
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
        fast comm:
        <strong style={{ color: YELLOW, minWidth: 14, textAlign: 'right' }}>{s.fastCount}×</strong>
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
        <FastLink active={s.fastActive} label={s.fastLabel} />
        <ChipMatmul chipIdx={1} step={step} />
      </div>
      <Counter step={step} />
      <Caption>{s.caption}</Caption>
      <StepControls step={step} totalSteps={STEPS.length} setStep={setStep} />
    </WidgetShell>
  );
}
