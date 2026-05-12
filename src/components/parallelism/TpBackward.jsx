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
const NUM_CHUNKS = B;
// Forward TP: reduce-scatter on Y produced one column per chip.
// Backward TP: dual. We start with ∂Y sharded (chip i owns column i).
// To compute ∂W, we need the FULL ∂Y on every chip — so we ALL-GATHER ∂Y.
// Then each chip locally computes its row of ∂W from X_i^T @ ∂Y_full.
// The all-gather can be chunked just like the forward RS — staircase.

const TOTAL_STEPS = NUM_CHUNKS + 2; // mirror of forward staircase

const STEP_CAPTIONS = [
  'Forward complete: ∂Y arrives SHARDED — each chip owns one column. Backward needs the full ∂Y on every chip, so the dual collective is an ALL-GATHER (mirror of forward\'s reduce-scatter).',
  "Chunk 1 of the backward begins. Chip 0 and chip 1 swap their ∂Y columns for batch row 0 on the fast link — the staircase's first AG fires.",
  'Chunk 2: gather ∂Y for row 1 while chunk 1\'s local matmul (∂W contribution from row 0) starts. The overlap pattern is the SAME staircase, just with AG replacing RS.',
  "Chunk 3 gathers; chunk 2 computes. Each chip is accumulating its own row of ∂W.",
  'Chunk 4 gathers; chunk 3 computes. The final chunk is in flight.',
  "Compute is done. Last chunk's AG finishes alone — the unavoidable tail of the staircase.",
  '∂W on each chip is the chip\'s row of the full gradient — no further communication needed (X was sharded along E, so each chip already owns the right X slice to compute its W row). Forward-RS\'s dual is complete.',
];

// State per chunk: at time t
//   ∂Y_full row i state (the chip's "full" ∂Y for row i):
//     t < i: absent
//     t == i: AG in progress for row i (partial — only own column visible)
//     t == i+1: AG done, compute starts (full row materialized, yellow during this tick)
//     t > i+1: row's ∂Y has been used, ∂W contribution accumulated
//
//   For chip's ∂W: rows of ∂W accumulate as compute happens.
//     chunk i's compute (∂W contribution from batch row i) finishes at t == i+1.
//     So ∂W has accumulated chunks 0..t-1 (those whose compute step has passed) at step t.

function dyState(rowIdx, step) {
  // ∂Y row state from this chip's perspective.
  // step < rowIdx: not yet started
  // step == rowIdx: AG in progress for this row (partial visible)
  // step == rowIdx + 1: AG done, compute consuming it (full visible, highlighted)
  // step > rowIdx + 1: consumed (back to absent — chunk's contribution lives in ∂W now)
  if (step < rowIdx) return 'absent';
  if (step === rowIdx) return 'partial';
  if (step === rowIdx + 1) return 'full';
  return 'consumed';
}

function dwAccumulated(rowIdx, step, chipIdx) {
  // ∂W is sized [E, E]. Chip i owns row i (matches W's row-sharding from forward).
  // ∂W accumulates as chunks complete: a chunk's contribution to ∂W lands at step == chunk_idx + 1
  // and stays.
  if (rowIdx !== chipIdx) return false;
  // Did ANY chunk's compute land by `step`? Chunk k's compute completes at step k+1.
  // So ∂W (chip's row) is populated once step >= 2 (the first chunk's compute step).
  return step >= 2;
}

function ChipMatmul({ chipIdx, step }) {
  const chipColor = CHIP_COLORS[chipIdx];
  const maxRows = Math.max(B, E);
  const containerHeight = maxRows * CELL + (maxRows - 1) * GAP;

  // X: TP row-parallel had X sharded along E (chip i owns column i).
  // Same in backward — X hasn't moved.
  const xFill = (r, c) =>
    c === chipIdx ? { fill: chipColor } : { fill: ABSENT };

  // W: row-sharded, chip i owns row i. Unchanged.
  const wFill = (r) =>
    r === chipIdx ? { fill: chipColor } : { fill: ABSENT };

  // ∂Y: shape [B, E]. We render the per-row state.
  // For each batch row r, the chip's view of ∂Y[r,:] depends on dyState.
  const dyFill = (r, c) => {
    const state = dyState(r, step);
    if (state === 'absent' || state === 'consumed') return { fill: ABSENT };
    if (state === 'partial') {
      // Mid-AG: chip's own column is solid; peer's column is striped (incoming).
      return c === chipIdx ? { fill: chipColor } : { fill: chipColor, stripe: true };
    }
    // 'full': both columns colored (the gathered row), highlighted.
    return { fill: chipColor };
  };

  // ∂W: shape [E, E]. Chip owns its row. Cell colored once any compute has landed.
  const dwFill = (r) =>
    dwAccumulated(r, step, chipIdx) ? { fill: chipColor } : { fill: ABSENT };

  // ∂W subtitle: how many chunks have accumulated
  const chunksAccumulated = Math.max(0, Math.min(NUM_CHUNKS, step - 1));
  const dwSubtitle = chunksAccumulated > 0 ? `${chunksAccumulated}/${NUM_CHUNKS} chunks` : null;

  // ∂Y subtitle: which row is currently in flight
  let dySubtitle = null;
  for (let r = 0; r < B; r++) {
    if (dyState(r, step) === 'partial') {
      dySubtitle = `AG row ${r}`;
      break;
    }
    if (dyState(r, step) === 'full') {
      dySubtitle = `row ${r} ready`;
      break;
    }
  }

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
        <OpSymbol containerHeight={containerHeight}>·</OpSymbol>
        <TensorGrid name="W" rows={E} cols={E} getFill={wFill} containerHeight={containerHeight} />
        <OpSymbol containerHeight={containerHeight}>↓</OpSymbol>
        <TensorGrid
          name="∂Y"
          subtitle={dySubtitle}
          rows={B}
          cols={E}
          getFill={dyFill}
          containerHeight={containerHeight}
        />
        <OpSymbol containerHeight={containerHeight}>→</OpSymbol>
        <TensorGrid
          name="∂W"
          subtitle={dwSubtitle}
          rows={E}
          cols={E}
          getFill={dwFill}
          containerHeight={containerHeight}
        />
      </div>
    </div>
  );
}

const TIMELINE_PAD_LEFT = 110;
const TIMELINE_PAD_RIGHT = 16;
const LANE_HEIGHT = 32;
const LANE_GAP = 10;
const TIMELINE_PAD_TOP = 26;
const TIMELINE_PAD_BOTTOM = 8;

function Timeline({ step }) {
  const width = 600;
  const innerWidth = width - TIMELINE_PAD_LEFT - TIMELINE_PAD_RIGHT;
  const blockWidth = innerWidth / TOTAL_STEPS;
  const height = TIMELINE_PAD_TOP + 2 * LANE_HEIGHT + LANE_GAP + TIMELINE_PAD_BOTTOM;
  const computeY = TIMELINE_PAD_TOP;
  const commY = TIMELINE_PAD_TOP + LANE_HEIGHT + LANE_GAP;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      <text x={TIMELINE_PAD_LEFT + innerWidth} y={TIMELINE_PAD_TOP - 10} textAnchor="end" fontSize={10} fill={INK_SOFT}>
        time →
      </text>
      <line
        x1={TIMELINE_PAD_LEFT}
        y1={TIMELINE_PAD_TOP - 4}
        x2={TIMELINE_PAD_LEFT + innerWidth}
        y2={TIMELINE_PAD_TOP - 4}
        stroke="rgba(31,41,55,0.18)"
      />

      <text x={TIMELINE_PAD_LEFT - 10} y={computeY + LANE_HEIGHT / 2 + 4} textAnchor="end" fontSize={11} fill={INK_SOFT}>
        compute
      </text>
      <text x={TIMELINE_PAD_LEFT - 10} y={commY + LANE_HEIGHT / 2 + 4} textAnchor="end" fontSize={11} fill={INK_SOFT}>
        all-gather
      </text>

      {Array.from({ length: NUM_CHUNKS }, (_, i) => {
        const computeStep = i + 1; // chunk i's compute is active at step i+1
        if (step < computeStep) return null;
        const active = step === computeStep;
        const x = TIMELINE_PAD_LEFT + (i + 1) * blockWidth;
        return (
          <g key={`c${i}`}>
            <rect
              x={x + 3}
              y={computeY + 2}
              width={blockWidth - 6}
              height={LANE_HEIGHT - 4}
              rx={5}
              fill={CHIP_COLORS[0]}
              fillOpacity={active ? 1 : 0.7}
              stroke={active ? YELLOW : 'none'}
              strokeWidth={2}
            />
            <text
              x={x + blockWidth / 2}
              y={computeY + LANE_HEIGHT / 2 + 4}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="#fff"
              fontFamily="ui-monospace, SFMono-Regular, monospace"
            >
              bw c{i + 1}
            </text>
          </g>
        );
      })}

      {Array.from({ length: NUM_CHUNKS }, (_, i) => {
        const agStep = i; // chunk i's AG is active at step i
        if (step < agStep) return null;
        const active = step === agStep;
        const x = TIMELINE_PAD_LEFT + i * blockWidth;
        return (
          <g key={`g${i}`}>
            <rect
              x={x + 3}
              y={commY + 2}
              width={blockWidth - 6}
              height={LANE_HEIGHT - 4}
              rx={5}
              fill={CHIP_COLORS[0]}
              fillOpacity={0.16}
              stroke={active ? YELLOW : CHIP_COLORS[0]}
              strokeWidth={active ? 2.5 : 1.5}
              strokeDasharray="4 3"
            />
            <text
              x={x + blockWidth / 2}
              y={commY + LANE_HEIGHT / 2 + 4}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill={CHIP_COLORS[0]}
              fontFamily="ui-monospace, SFMono-Regular, monospace"
            >
              AG c{i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function TpBackward() {
  const [step, setStep] = useState(0);

  return (
    <WidgetShell
      title="TP backward — within-layer dual staircase (AG instead of RS)"
      subtitle="Forward's reduce-scatter on Y is mirrored by an all-gather on ∂Y. The matmul work is chunked along the batch dim again; AG of the next chunk overlaps with backward compute of the current chunk."
    >
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
        {Array.from({ length: NUM_CHIPS }, (_, i) => (
          <ChipMatmul key={i} chipIdx={i} step={step} />
        ))}
      </div>
      <Timeline step={step} />
      <Caption>{STEP_CAPTIONS[step]}</Caption>
      <StepControls step={step} totalSteps={TOTAL_STEPS} setStep={setStep} />
    </WidgetShell>
  );
}
