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

// Single-layer mirror of FSDP forward: AG W → compute ∂W full-shape → RS ∂W
// back to the FSDP-sharded layout. The DP-backward chip-pair pattern carries
// the visual; the multi-layer pipelining argument lives in the forward
// OverlapTimeline and the DP-backward subsection above.
const STEPS = [
  {
    caption: 'Start: W is sharded across chips, ∂W not yet computed.',
    wMat: false,
    gShown: false,
    gMode: 'absent',
    commActive: false,
    commLabel: null,
  },
  {
    caption: 'All-gather W so the layer can run backward.',
    wMat: false,
    gShown: false,
    gMode: 'absent',
    commActive: true,
    commLabel: 'AG W',
  },
  {
    caption: 'W is materialized. Each chip computes ∂W at full shape from its batch slice.',
    wMat: true,
    gShown: true,
    gMode: 'full',
    commActive: false,
    commLabel: null,
  },
  {
    caption: 'Reduce-scatter ∂W back to the FSDP shard layout — the mirror of forward’s all-gather.',
    wMat: false,
    gShown: true,
    gMode: 'sharded',
    commActive: true,
    commLabel: 'RS ∂W',
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

  const yFill = (r) =>
    ownsBatchRow(chipIdx, r) ? { fill: chipColor } : { fill: ABSENT };

  const gFill = (r) => {
    if (!s.gShown) return { fill: ABSENT };
    if (s.gMode === 'full') return { fill: chipColor, stripe: true };
    if (s.gMode === 'sharded') {
      return ownsWRow(chipIdx, r) ? { fill: chipColor } : { fill: ABSENT };
    }
    return { fill: ABSENT };
  };

  const gSubtitle =
    s.gMode === 'full'
      ? 'full · partial sum'
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

export default function FsdpBackward() {
  const [step, setStep] = useState(0);
  const s = STEPS[step];

  return (
    <WidgetShell
      title="FSDP backward — reduce-scatter in place of forward's all-gather"
      subtitle="One layer, end-to-end. Same chip-pair mirror as DP backward above; per-layer pipelining matches the forward FSDP overlap."
    >
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
        <ChipMatmul chipIdx={0} step={step} />
        <CommLink active={s.commActive} label={s.commLabel} />
        <ChipMatmul chipIdx={1} step={step} />
      </div>
      <Caption>{s.caption}</Caption>
      <StepControls step={step} totalSteps={STEPS.length} setStep={setStep} />
    </WidgetShell>
  );
}
