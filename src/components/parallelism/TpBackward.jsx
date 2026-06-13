import { useState } from 'react';
import {
  CHIP_COLORS,
  YELLOW,
  ABSENT,
  INK,
  INK_SOFT,
  CARD_BG,
  CARD_BORDER,
  StepControls,
  WidgetShell,
  Caption,
} from './staircase-shared.jsx';

// Inline primitives mirror the forward TpStaircase (CELL=16) so the backward
// diagram sits visually next to its forward sibling. Shared Cell/TensorGrid
// don't expose the yellow-ring highlight this widget needs.
const CELL = 16;
const GAP = 2;
const NUM_CHIPS = 2;
const B = 4;
const E = 2;
const NUM_CHUNKS = B;
const TOTAL_STEPS = NUM_CHUNKS + 2; // 6, mirrors forward TpStaircase

const STEP_CAPTIONS = [
  'Step 0 — ∂Y arrives column-sharded. The diagonal of ∂W is fully local — chip i already has X[:, i] and ∂Y[:, i] — so it lands here in one shot, with no AG dependency. AG of row 1 fires concurrently to start staging the off-diagonal.',
  'Step 1 — Row 1 of ∂Y has landed; chunk 1 contributes the first partial sum to the off-diagonal of ∂W. AG of row 2 runs in parallel.',
  'Step 2 — Chunk 2 contributes to the off-diagonal; AG of row 3 runs in parallel.',
  'Step 3 — Chunk 3 contributes to the off-diagonal; AG of row 4 runs in parallel.',
  'Step 4 — All ∂Y rows have landed; chunk 4 closes out the off-diagonal — the unavoidable tail.',
  "Step 5 — Staircase done; each chip's row of ∂W is complete.",
];

// ∂Y row state from chip i's perspective at step t.
// Comm leads compute by one tick (mirror of forward, time-reversed):
//   step t in [1, NUM_CHUNKS+1]: rows 0..t-1 gathered; other rows not yet
// The "in flight" tick lives on the timeline (the AG lane), not on the chip
// panel — the off-column cell has no value until AG lands, so painting a
// stripe (the partial-sum convention) before it lands would lie.
function dyGathered(rowIdx, step) {
  return step >= 1 && rowIdx < step;
}

// Active compute chunk = row currently being multiplied for the off-diagonal
// of ∂W. -1 at step 0 (the off-diagonal is gated on AG and hasn't started yet
// — the local diagonal compute happens here instead) and at the post-staircase
// rest tick.
function activeChunk(step) {
  return step >= 1 && step <= NUM_CHUNKS ? step - 1 : -1;
}

function Cell({ fill, stripe, highlight }) {
  const bg = stripe
    ? `repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 5px), ${fill}`
    : fill;
  return (
    <div
      style={{
        width: CELL,
        height: CELL,
        background: bg,
        borderRadius: 3,
        boxSizing: 'border-box',
        border: highlight
          ? `2px solid ${YELLOW}`
          : '1px solid rgba(31, 41, 55, 0.2)',
        transition: 'background 200ms ease, border 200ms ease',
      }}
    />
  );
}

function TensorGrid({ name, rows, cols, getFill, containerHeight }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div
        style={{
          height: containerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} style={{ display: 'flex', gap: GAP }}>
              {Array.from({ length: cols }, (_, c) => (
                <Cell key={c} {...getFill(r, c)} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 11, color: INK_SOFT, fontFamily: 'monospace' }}>{name}</div>
    </div>
  );
}

function OpSymbol({ children, containerHeight }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div
        style={{
          height: containerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          color: INK_SOFT,
          fontWeight: 500,
          minWidth: 12,
        }}
      >
        {children}
      </div>
      <div style={{ fontSize: 11, visibility: 'hidden' }}>·</div>
    </div>
  );
}

function ChipMatmul({ chipIdx, step }) {
  const chipColor = CHIP_COLORS[chipIdx];
  const maxRows = Math.max(B, E);
  const containerHeight = maxRows * CELL + (maxRows - 1) * GAP;
  const chunkRow = activeChunk(step);
  const isLocalStep = step === 0;

  // X (B × E): column-sharded by chip. At step 0 the whole owned column is
  // the active region (it feeds the local diagonal dot product); after that,
  // only the active chunk row is highlighted.
  const xFill = (r, c) => {
    if (c !== chipIdx) return { fill: ABSENT };
    return { fill: chipColor, highlight: isLocalStep || r === chunkRow };
  };

  // ∂Y (B × E): chip's own column is always solid (chip starts with it). The
  // other column is absent until AG lands, then solid — no in-flight stripe,
  // since stripe = partial sum everywhere else in the post. At step 0 the
  // whole owned column is highlighted (feeds the local diagonal compute);
  // after that, the active chunk row is highlighted across both columns.
  const dyFill = (r, c) => {
    const isOwnCol = c === chipIdx;
    if (isOwnCol) {
      return { fill: chipColor, highlight: isLocalStep || r === chunkRow };
    }
    if (dyGathered(r, step)) return { fill: chipColor, highlight: r === chunkRow };
    return { fill: ABSENT };
  };

  // ∂W (E × E): row-sharded by chip — chip i owns row i. Split per cell:
  //   - Diagonal cell ∂W[i, i] = X[:, i]^⊤ · ∂Y[:, i] is fully local (chip i
  //     starts with both factors), so it lands at step 0 with no comm
  //     dependency and no partial-sum staging.
  //   - Off-diagonal cell ∂W[i, j≠i] needs the other chip's ∂Y column, which
  //     arrives row-by-row via AG; the cell accumulates as striped partial
  //     sums through the staircase and settles to solid at the post tick.
  const dwFill = (r, c) => {
    if (r !== chipIdx) return { fill: ABSENT };
    const isDiag = c === chipIdx;
    if (isDiag) {
      return { fill: chipColor, highlight: isLocalStep };
    }
    if (step === 0) return { fill: ABSENT };
    if (step <= NUM_CHUNKS) return { fill: chipColor, stripe: true };
    return { fill: chipColor };
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '10px 8px',
        borderRadius: 14,
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        alignItems: 'center',
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.12em',
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
        <TensorGrid name="∂Y" rows={B} cols={E} getFill={dyFill} containerHeight={containerHeight} />
        <OpSymbol containerHeight={containerHeight}>=</OpSymbol>
        <TensorGrid name="∂W" rows={E} cols={E} getFill={dwFill} containerHeight={containerHeight} />
      </div>
    </div>
  );
}

const TIMELINE_PAD_LEFT = 110;
const TIMELINE_PAD_RIGHT = 16;
const LANE_HEIGHT = 34;
const LANE_GAP = 12;
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
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <text
        x={TIMELINE_PAD_LEFT + innerWidth}
        y={TIMELINE_PAD_TOP - 10}
        textAnchor="end"
        fontSize={10}
        fill={INK_SOFT}
      >
        time →
      </text>
      <line
        x1={TIMELINE_PAD_LEFT}
        y1={TIMELINE_PAD_TOP - 4}
        x2={TIMELINE_PAD_LEFT + innerWidth}
        y2={TIMELINE_PAD_TOP - 4}
        stroke="rgba(31,41,55,0.18)"
      />

      <text
        x={TIMELINE_PAD_LEFT - 12}
        y={computeY + LANE_HEIGHT / 2 + 4}
        textAnchor="end"
        fontSize={11}
        fill={INK_SOFT}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        compute
      </text>
      <text
        x={TIMELINE_PAD_LEFT - 12}
        y={commY + LANE_HEIGHT / 2 + 4}
        textAnchor="end"
        fontSize={11}
        fill={INK_SOFT}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        all-gather
      </text>

      {/* Local-diagonal compute at column 0: ∂W[i, i] = X[:, i]^⊤ · ∂Y[:, i].
          Fully local, no AG dependency — fires concurrently with the first AG. */}
      <g key="mm-local">
        <rect
          x={TIMELINE_PAD_LEFT + 3}
          y={computeY + 2}
          width={blockWidth - 6}
          height={LANE_HEIGHT - 4}
          rx={5}
          fill={CHIP_COLORS[0]}
          fillOpacity={step === 0 ? 1 : 0.7}
          stroke={step === 0 ? YELLOW : 'none'}
          strokeWidth={2}
        />
        <text
          x={TIMELINE_PAD_LEFT + blockWidth / 2}
          y={computeY + LANE_HEIGHT / 2 + 4}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          fill="#ffffff"
          fontFamily="ui-monospace, SFMono-Regular, monospace"
        >
          local
        </text>
      </g>

      {/* Off-diagonal chunks: chunk i (0-indexed) computes at step i+1, column i+1. */}
      {Array.from({ length: NUM_CHUNKS }, (_, i) => {
        if (step < i + 1) return null;
        const active = step === i + 1;
        const x = TIMELINE_PAD_LEFT + (i + 1) * blockWidth;
        return (
          <g key={`mm-${i}`}>
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
              fill="#ffffff"
              fontFamily="ui-monospace, SFMono-Regular, monospace"
            >
              mm c{i + 1}
            </text>
          </g>
        );
      })}

      {/* AG blocks: row i (0-indexed) is all-gathered at step i, so column i. */}
      {Array.from({ length: NUM_CHUNKS }, (_, i) => {
        if (step < i) return null;
        const active = step === i;
        const x = TIMELINE_PAD_LEFT + i * blockWidth;
        return (
          <g key={`ag-${i}`}>
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
              AG r{i + 1}
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
      title="TP backward — all-gather in place of reduce-scatter"
      subtitle="∂W = Xᵀ · ∂Y, chunked along the batch dim. The diagonal entry of ∂W is fully local on each chip (chip i already has X[:, i] and ∂Y[:, i]), so it lands at step 0 with no comm dependency. The off-diagonal entry needs the other chip's ∂Y column; that AG is pipelined per-row, with each landed row feeding one chunk of the off-diagonal staircase. The yellow ring marks the active region; off-column ∂Y cells are absent until their AG lands, then pop solid; ∂W stripes mean off-diagonal partial sums."
    >
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
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
