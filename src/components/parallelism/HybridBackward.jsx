import { useState } from 'react';
import {
  CHIP_COLORS,
  YELLOW,
  SLOW,
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
const NUM_CHIPS = 4;

const STEPS = [
  {
    caption:
      'Forward done. Y is filled on every chip. W back to sharded across the FSDP axis. Both axes are quiet. Time to compute gradients.',
    layerLabel: 'forward done',
    wMat: false,
    yShown: true,
    gShown: false,
    gMode: 'absent',
    fastActive: false,
    slowActive: false,
    fastLabel: null,
    slowLabel: null,
    fastCount: 0,
    slowCount: 0,
  },
  {
    caption:
      'Backward begins on layer 3. Compute ∂W₃ from each chip\'s batch slice — produces a FULL-shape ∂W on every chip. Chips DISAGREE because they saw different batch rows.',
    layerLabel: 'bw L3 · full ∂W',
    wMat: true,
    yShown: true,
    gShown: true,
    gMode: 'full',
    fastActive: false,
    slowActive: false,
    fastLabel: null,
    slowLabel: null,
    fastCount: 0,
    slowCount: 0,
  },
  {
    caption:
      "Reduce-scatter ∂W on the FAST axis. Chips paired by DP rank (0↔1 and 2↔3) sum and split their gradient — each chip keeps its FSDP row. This happens once per layer, pipelined with the next layer's backward compute.",
    layerLabel: 'RS ∂W₃ · fast',
    wMat: false,
    yShown: true,
    gShown: true,
    gMode: 'rs-fast-inflight',
    fastActive: true,
    slowActive: false,
    fastLabel: 'RS ∂W₃',
    slowLabel: null,
    fastCount: 1,
    slowCount: 0,
  },
  {
    caption:
      'Skip ahead: backward L2 and L1 follow the same per-layer dance — RS ∂W on the fast axis after each layer\'s compute. Three layers ⇒ three fast-axis RS calls total. Slow axis still silent.',
    layerLabel: 'all layers done',
    wMat: false,
    yShown: true,
    gShown: true,
    gMode: 'fsdp-sharded',
    fastActive: false,
    slowActive: false,
    fastLabel: null,
    slowLabel: null,
    fastCount: 3,
    slowCount: 0,
  },
  {
    caption:
      "But chips on DIFFERENT DP replicas (0↔2, 1↔3) still hold different gradients — they processed different batches. One all-reduce on the SLOW axis averages them. The slow link finally wakes up.",
    layerLabel: 'AR · slow',
    wMat: false,
    yShown: true,
    gShown: true,
    gMode: 'ar-slow-inflight',
    fastActive: false,
    slowActive: true,
    fastLabel: null,
    slowLabel: 'AR ∂W',
    fastCount: 3,
    slowCount: 1,
  },
  {
    caption:
      'Step complete. ∂W is identical across DP replicas, FSDP-sharded within each replica. Fast comm fired 3× (one per layer); slow comm fired exactly 1× (end of step).',
    layerLabel: 'done',
    wMat: false,
    yShown: true,
    gShown: true,
    gMode: 'final',
    fastActive: false,
    slowActive: false,
    fastLabel: null,
    slowLabel: null,
    fastCount: 3,
    slowCount: 1,
  },
];

const fsdpRank = (chipIdx) => chipIdx % 2;
const dpRank = (chipIdx) => Math.floor(chipIdx / 2);
const ownsBatchRow = (chipIdx, row) =>
  Math.floor(row / (B / 2)) === dpRank(chipIdx);
const ownsWRow = (chipIdx, row) => row === fsdpRank(chipIdx);

function ChipMatmul({ chipIdx, step }) {
  const chipColor = CHIP_COLORS[chipIdx];
  const s = STEPS[step];
  const maxRows = Math.max(B, E);
  const containerHeight = maxRows * CELL + (maxRows - 1) * GAP;

  const xFill = (r) => (ownsBatchRow(chipIdx, r) ? { fill: chipColor } : { fill: ABSENT });

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
    if (s.gMode === 'rs-fast-inflight') {
      // Chip's owned FSDP row solid; peer's row striped (mid-RS).
      return ownsWRow(chipIdx, r)
        ? { fill: chipColor }
        : { fill: chipColor, stripe: true };
    }
    if (s.gMode === 'fsdp-sharded') {
      return ownsWRow(chipIdx, r) ? { fill: chipColor } : { fill: ABSENT };
    }
    if (s.gMode === 'ar-slow-inflight') {
      // Mid-AR on slow axis. Chip's owned row striped (in flight to/from DP partner).
      return ownsWRow(chipIdx, r)
        ? { fill: chipColor, stripe: true }
        : { fill: ABSENT };
    }
    if (s.gMode === 'final') {
      return ownsWRow(chipIdx, r) ? { fill: YELLOW } : { fill: ABSENT };
    }
    return { fill: ABSENT };
  };

  const gSubtitle =
    s.gMode === 'full'
      ? 'full ∂W'
      : s.gMode === 'rs-fast-inflight'
      ? 'mid-RS (fast)'
      : s.gMode === 'fsdp-sharded'
      ? 'FSDP-sharded'
      : s.gMode === 'ar-slow-inflight'
      ? 'mid-AR (slow)'
      : s.gMode === 'final'
      ? 'averaged'
      : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px 8px 10px',
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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
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
      <svg width="76" height="14" viewBox="0 0 76 14">
        <line x1="10" y1="7" x2="66" y2="7" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
        <polygon points="2,7 12,2 12,12" fill={color} />
        <polygon points="74,7 64,2 64,12" fill={color} />
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

function SlowLink({ active, label }) {
  const color = active ? SLOW : 'rgba(31,41,55,0.22)';
  const stroke = active ? 2.5 : 1.5;
  const dash = active ? 'none' : '4 3';
  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <svg width="14" height="42" viewBox="0 0 14 42">
        <line x1="7" y1="8" x2="7" y2="34" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={dash} />
        <polygon points="7,2 2,10 12,10" fill={color} />
        <polygon points="7,40 2,32 12,32" fill={color} />
      </svg>
      <div
        style={{
          fontSize: 9,
          color: active ? color : 'transparent',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontWeight: 600,
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          minWidth: 10,
          transition: 'color 200ms ease',
        }}
      >
        {label || ' '}
      </div>
    </div>
  );
}

function Mesh({ step }) {
  const s = STEPS[step];
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto auto auto',
          gridTemplateRows: 'auto auto auto',
          alignItems: 'center',
          justifyItems: 'center',
          rowGap: 4,
          columnGap: 4,
        }}
      >
        <ChipMatmul chipIdx={0} step={step} />
        <FastLink active={s.fastActive} label={s.fastLabel} />
        <ChipMatmul chipIdx={1} step={step} />

        <SlowLink active={s.slowActive} label={s.slowLabel} />
        <div />
        <SlowLink active={s.slowActive} label={s.slowLabel} />

        <ChipMatmul chipIdx={2} step={step} />
        <FastLink active={s.fastActive} label={s.fastLabel} />
        <ChipMatmul chipIdx={3} step={step} />
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
        gap: 16,
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: 12,
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        color: INK,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ display: 'inline-block', width: 10, height: 3, background: YELLOW, borderRadius: 2 }} />
        fast comm: <strong style={{ color: YELLOW, minWidth: 14, textAlign: 'right' }}>{s.fastCount}×</strong>
      </span>
      <span style={{ color: INK_SOFT }}>·</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ display: 'inline-block', width: 10, height: 3, background: SLOW, borderRadius: 2 }} />
        slow comm: <strong style={{ color: SLOW, minWidth: 14, textAlign: 'right' }}>{s.slowCount}×</strong>
      </span>
    </div>
  );
}

export default function HybridBackward() {
  const [step, setStep] = useState(0);

  return (
    <WidgetShell
      title="Hybrid backward — fast-axis RS per layer + one slow-axis AR at the end"
      subtitle="The full backward pass on the 2×2 mesh: per-layer reduce-scatter on the fast axis (FSDP), then a single all-reduce on the slow axis (DP replicas) when all layers are done."
    >
      <Mesh step={step} />
      <Counter step={step} />
      <Caption>{STEPS[step].caption}</Caption>
      <StepControls step={step} totalSteps={STEPS.length} setStep={setStep} />
    </WidgetShell>
  );
}
