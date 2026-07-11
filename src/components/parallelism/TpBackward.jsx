import { useState } from 'react';
import {
  CHIP_COLORS,
  ABSENT,
  INK_SOFT,
  CARD_BG,
  CARD_BORDER,
  TensorGrid,
  OpSymbol,
  StepControls,
  WidgetShell,
  Caption,
  Legend,
} from './staircase-shared.jsx';
import { LaneTimeline } from './comm-shared.jsx';

// TP backward — the forward within-layer staircase, transposed.
// ∂W = Xᵀ · ∂Y, chunked along the batch. The diagonal entry ∂W[i,i] is fully
// local (chip i already holds X[:,i] and ∂Y[:,i]) so it fires at step 0 with no
// comm. The off-diagonal needs the other chip's ∂Y column, all-gathered
// row-by-row; each landed row feeds one chunk, pipelined under the matmul.
// Rendered at CELL=16 through the shared primitives so it sits next to the
// forward TpStaircase.

const CELL = 16;
const NUM_CHIPS = 2;
const B = 4;
const E = 2;
const NUM_CHUNKS = B;
const TOTAL_STEPS = NUM_CHUNKS + 2; // 6
const RAMP = [0.55, 0.7, 0.85, 1]; // off-diagonal accumulation, steps 1..4

const CAPTIONS = [
  '∂Y arrives column-sharded. Chip i already owns X[:, i] and ∂Y[:, i] — everything the diagonal entry ∂W[i,i] needs — so it computes immediately, with zero communication. The first AG row is already in flight underneath.',
  'Row 1 of the other column lands. The off-diagonal ∂W[i,j] starts accumulating (striped: a partial sum over the chunks seen so far) while AG row 2 runs under it.',
  'Chunk 2 folds into the off-diagonal; AG row 3 in flight. Every gather is hidden under a matmul chunk.',
  'Chunk 3 folds in; AG row 4 is the last gather.',
  'The final chunk closes the sum. Only this last matmul had no gather left to hide — the staircase tail.',
  'Done. Each chip owns its complete row of ∂W: the diagonal cost no comm at all, and the off-diagonal paid one all-gather of ∂Y, pipelined under the chunked compute.',
];

const dyGathered = (rowIdx, step) => step >= 1 && rowIdx < step;
const activeChunk = (step) => (step >= 1 && step <= NUM_CHUNKS ? step - 1 : -1);

function ChipMatmul({ chipIdx, step }) {
  const chipColor = CHIP_COLORS[chipIdx];
  const maxRows = Math.max(B, E);
  const containerHeight = maxRows * CELL + (maxRows - 1) * 2;
  const chunkRow = activeChunk(step);
  const isLocalStep = step === 0;

  const xFill = (r, c) => {
    if (c !== chipIdx) return { fill: ABSENT };
    return { fill: chipColor, highlight: isLocalStep || r === chunkRow };
  };

  // ∂Y: own column is always solid; the other column is absent until its AG
  // row lands, then solid — never striped, since stripe = partial sum here.
  const dyFill = (r, c) => {
    if (c === chipIdx) return { fill: chipColor, highlight: isLocalStep || r === chunkRow };
    if (dyGathered(r, step)) return { fill: chipColor, highlight: r === chunkRow };
    return { fill: ABSENT };
  };

  // ∂W: diagonal is local (solid from step 0); off-diagonal accumulates as a
  // striped partial with a rising alpha as AG rows land, settling solid.
  const dwFill = (r, c) => {
    if (r !== chipIdx) return { fill: ABSENT };
    if (c === chipIdx) return { fill: chipColor, highlight: isLocalStep };
    if (step === 0) return { fill: ABSENT };
    if (step <= NUM_CHUNKS) return { fill: chipColor, stripe: true, alpha: RAMP[step - 1], highlight: true };
    return { fill: chipColor };
  };

  const dySub = step === 0 ? 'own col local' : step <= NUM_CHUNKS ? 'AG rows landing' : 'fully gathered';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 12px',
        borderRadius: 14,
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        alignItems: 'center',
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: INK_SOFT, fontWeight: 600 }}>
        Chip {chipIdx}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
        <TensorGrid name="X" subtitle={`col ${chipIdx} local`} rows={B} cols={E} getFill={xFill} containerHeight={containerHeight} cellSize={CELL} />
        <OpSymbol containerHeight={containerHeight}>·</OpSymbol>
        <TensorGrid name="∂Y" subtitle={dySub} rows={B} cols={E} getFill={dyFill} containerHeight={containerHeight} cellSize={CELL} />
        <OpSymbol containerHeight={containerHeight}>=</OpSymbol>
        <TensorGrid name="∂W" subtitle={`row ${chipIdx} owned`} rows={E} cols={E} getFill={dwFill} containerHeight={containerHeight} cellSize={CELL} />
      </div>
    </div>
  );
}

function Timeline({ step }) {
  const compute = [
    { lane: 'compute', start: 0, dur: 1, label: 'mm diag', color: CHIP_COLORS[0], kind: 'compute', visible: true, active: step === 0 },
    ...Array.from({ length: NUM_CHUNKS }, (_, i) => ({
      lane: 'compute',
      start: i + 1,
      dur: 1,
      label: `mm c${i + 1}`,
      color: CHIP_COLORS[0],
      kind: 'compute',
      visible: step >= i + 1,
      active: step === i + 1,
    })),
  ];
  const ag = Array.from({ length: NUM_CHUNKS }, (_, i) => ({
    lane: 'comm',
    start: i,
    dur: 1,
    label: `AG r${i + 1}`,
    color: CHIP_COLORS[0],
    kind: 'comm',
    visible: step >= i,
    active: step === i,
  }));
  return (
    <LaneTimeline
      width={620}
      duration={TOTAL_STEPS}
      lanes={[
        { id: 'compute', label: 'compute' },
        { id: 'comm', label: 'all-gather' },
      ]}
      blocks={[...compute, ...ag]}
    />
  );
}

export default function TpBackward() {
  const [step, setStep] = useState(0);

  return (
    <WidgetShell
      title="TP backward — all-gather in place of reduce-scatter"
      subtitle="The forward staircase, transposed: ∂W = Xᵀ·∂Y chunked along the batch, with the all-gather of ∂Y pipelined under the matmul chunks. The diagonal of ∂W never waits on the network."
    >
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {Array.from({ length: NUM_CHIPS }, (_, i) => (
          <ChipMatmul key={i} chipIdx={i} step={step} />
        ))}
      </div>
      <Timeline step={step} />
      <Legend
        items={[
          { fill: CHIP_COLORS[0], label: 'owned / diagonal (local)' },
          { fill: CHIP_COLORS[0], stripe: true, label: 'off-diagonal partial sum' },
          { fill: CHIP_COLORS[0], ring: true, label: 'active this tick' },
          { fill: 'rgba(31,41,55,0.15)', label: 'not gathered yet' },
        ]}
      />
      <Caption>{CAPTIONS[step]}</Caption>
      <StepControls step={step} totalSteps={TOTAL_STEPS} setStep={setStep} />
    </WidgetShell>
  );
}
