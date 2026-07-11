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

// Single-layer mirror of FSDP forward, three beats: all-gather W (backward
// needs the full weight for ∂X = ∂Y·Wᵀ), compute ∂W at full shape, then
// reduce-scatter ∂W back to the FSDP shard layout — the transpose of forward's
// per-layer all-gather. The DP-backward chip-pair pattern carries the visual;
// the multi-layer pipelining lives in the fsdp-bwd OverlapTimeline below.

const B = 4;
const E = 2;
const NUM_CHIPS = 2;

const STEPS = [
  {
    caption:
      'Backward reaches this layer. W is still sharded — chip i holds one row-strip — but computing ∂X = ∂Y·Wᵀ needs the full W, exactly as the forward matmul did.',
    wMode: 'shard',
    gMode: null,
    commActive: false,
    commLabel: null,
    ledger: 'comm this layer: none yet',
  },
  {
    caption:
      'All-gather W: the same collective the forward pass ran, re-materializing the full weight (yellow) on every chip.',
    wMode: 'mat',
    gMode: null,
    commActive: true,
    commLabel: 'AG W',
    ledger: 'AG W in flight — same collective as forward',
  },
  {
    caption:
      'Compute at full shape: ∂X flows to the layer below, and ∂W = Xᵀ·∂Y lands as a full E×E grid. Striped — each chip computed it from its own batch slice, so the copies disagree.',
    wMode: 'mat',
    gMode: 'full',
    commActive: false,
    commLabel: null,
    ledger: 'comm idle — compute at full shape',
  },
  {
    caption:
      'Reduce-scatter ∂W: one collective sums the partials across chips and leaves each chip owning only its row-strip — DP’s all-reduce job plus FSDP’s re-shard. The gathered W is freed.',
    wMode: 'shard',
    gMode: 'sharded',
    commActive: true,
    commLabel: 'RS ∂W',
    ledger: 'RS ∂W in flight — sum + re-shard in one collective',
  },
  {
    caption:
      'Done: memory is back to the sharded footprint, and each chip holds the summed gradient for exactly the rows it owns. The timeline below shows the next layer’s gather hiding under this layer’s compute.',
    wMode: 'shard',
    gMode: 'sharded',
    commActive: false,
    commLabel: null,
    ledger: 'bill per layer: 1× AG (W) + 1× RS (∂W)',
  },
];

const ownsWRow = (chipIdx, row) => row === chipIdx;
const ownsBatchRow = (chipIdx, row) => Math.floor(row / (B / NUM_CHIPS)) === chipIdx;

function ChipMatmul({ chipIdx, step }) {
  const chipColor = CHIP_COLORS[chipIdx];
  const s = STEPS[step];
  const maxRows = Math.max(B, E);
  const containerHeight = maxRows * CELL + (maxRows - 1) * GAP;

  const xFill = (r) => (ownsBatchRow(chipIdx, r) ? { fill: chipColor } : { fill: ABSENT });

  const wFill = (r) => {
    if (s.wMode === 'mat') return { fill: YELLOW, highlight: step === 1 };
    return ownsWRow(chipIdx, r) ? { fill: chipColor } : { fill: ABSENT };
  };

  const yFill = (r) => (ownsBatchRow(chipIdx, r) ? { fill: chipColor } : { fill: ABSENT });

  const gFill = (r) => {
    if (s.gMode === 'full') return { fill: chipColor, stripe: true };
    if (s.gMode === 'sharded') {
      return ownsWRow(chipIdx, r) ? { fill: chipColor, highlight: step === 3 } : { fill: ABSENT };
    }
    return { fill: ABSENT };
  };

  const gSubtitle =
    s.gMode === 'full' ? 'full · partial sum' : s.gMode === 'sharded' ? `row ${chipIdx} · summed` : null;

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
      <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: INK_SOFT, fontWeight: 600 }}>
        Chip {chipIdx}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
        <TensorGrid name="X" rows={B} cols={E} getFill={xFill} containerHeight={containerHeight} />
        <OpSymbol containerHeight={containerHeight}>@</OpSymbol>
        <TensorGrid name="W" rows={E} cols={E} getFill={wFill} containerHeight={containerHeight} />
        <OpSymbol containerHeight={containerHeight}>=</OpSymbol>
        <TensorGrid name="Y" rows={B} cols={E} getFill={yFill} containerHeight={containerHeight} />
        {s.gMode && (
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
        <line x1="10" y1="7" x2="90" y2="7" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
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

function Ledger({ text }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: 12,
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        color: 'inherit',
      }}
    >
      <span style={{ display: 'inline-block', width: 10, height: 3, background: YELLOW, borderRadius: 2 }} />
      <span>{text}</span>
    </div>
  );
}

export default function FsdpBackward() {
  const [step, setStep] = useState(0);
  const s = STEPS[step];

  return (
    <WidgetShell
      title="FSDP backward — gather, compute, reduce-scatter"
      subtitle="One layer on two chips. Forward's all-gather returns — backward needs the full W too — and the reduce-scatter of ∂W is its transpose: DP's all-reduce and FSDP's re-shard in one collective."
    >
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
        <ChipMatmul chipIdx={0} step={step} />
        <CommLink active={s.commActive} label={s.commLabel} />
        <ChipMatmul chipIdx={1} step={step} />
      </div>
      <Ledger text={s.ledger} />
      <Caption>{s.caption}</Caption>
      <StepControls step={step} totalSteps={STEPS.length} setStep={setStep} />
    </WidgetShell>
  );
}
