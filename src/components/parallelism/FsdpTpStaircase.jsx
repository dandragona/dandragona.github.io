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

const FSDP_COLOR = YELLOW;     // yellow — AG of next layer's W on the FSDP axis
const TP_COLOR = '#0891b2';    // cyan — RS of this layer's Y chunks on the TP axis
const COMPUTE_COLOR = CHIP_COLORS[0];
const COMPUTE_RING = INK;      // dark ring marks the chunk being computed this tick
                                // (yellow now exclusive to L2 W shard arrival)

const FOCAL_CHIP_IDX = 0;       // we zoom into one chip — all four do the same thing
const NUM_CHUNKS = 4;
const TOTAL_STEPS = NUM_CHUNKS + 2; // 6 steps total (0..5)
const TICKS = NUM_CHUNKS + 1;        // 5 timeline ticks

const fsdpRank = (chipIdx) => Math.floor(chipIdx / 2);
const tpRank = (chipIdx) => chipIdx % 2;

// AG of L2's W completes during step 3. Fraction filled at end of step k.
function agProgress(step) {
  return step <= NUM_CHUNKS - 1 ? (step + 1) / NUM_CHUNKS : 1;
}

// Playhead in tick units — centers on the active tick; lands at the right edge once compute & RS are done.
const PLAYHEAD = [0.5, 1.5, 2.5, 3.5, 4.5, 5];

const STEP_CAPTIONS = [
  "Step 0 — Chunk 1 of L1 begins computing. Simultaneously, L2's W starts gathering on the FSDP axis. No partial is ready yet, so the TP axis is still idle.",
  "Step 1 — Chunk 2 computes. AG of L2's W continues on the FSDP axis. Chunk 1's partial reduce-scatters on the TP axis. All three streams are now active in parallel.",
  "Step 2 — Chunk 3 computes. AG continues on the FSDP axis. Chunk 2 reduce-scatters on the TP axis. Compute, FSDP traffic, and TP traffic all running concurrently — the steady state of the staircase.",
  "Step 3 — Chunk 4 computes. L2's W AG completes — the next layer's weights are now in place. Chunk 3 reduce-scatters on the TP axis.",
  "Step 4 — Compute is done. Chunk 4's reduce-scatter runs alone on the TP axis — the unavoidable tail. L2's W is already in place, waiting.",
  "Step 5 — L1 finished, L2's W in place. The next layer can start its first chunk immediately, with no AG stall.",
];

// chunkState(i, step):
//   empty:   step < i        — not yet computed
//   compute: step == i       — chunk i is computing this tick (yellow ring, partial fill)
//   rs:      step == i + 1   — chunk i is reduce-scattering this tick (cyan ring, partial fill)
//   done:    step >= i + 2   — chip owns its TP slice of this chunk (solid)
function chunkState(chunkIdx, step) {
  if (step < chunkIdx) return 'empty';
  if (step === chunkIdx) return 'compute';
  if (step === chunkIdx + 1) return 'rs';
  return 'done';
}

const CELL = 24;
const W_CELL = 20;

const ROW_LABEL_STYLE = {
  fontSize: 10,
  color: INK_SOFT,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  letterSpacing: '0.08em',
  minWidth: 32,
  textAlign: 'right',
  textTransform: 'uppercase',
  fontWeight: 600,
};

function ChunkCells({ chipIdx, step }) {
  const chipColor = CHIP_COLORS[chipIdx];
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: NUM_CHUNKS }, (_, i) => {
        const state = chunkState(i, step);
        let bg = ABSENT;
        let border = '1px solid rgba(31,41,55,0.2)';
        let stripe = false;
        if (state === 'compute') {
          bg = chipColor;
          stripe = true;
          border = `2.5px solid ${COMPUTE_RING}`;
        } else if (state === 'rs') {
          bg = chipColor;
          stripe = true;
          border = `2.5px solid ${TP_COLOR}`;
        } else if (state === 'done') {
          bg = chipColor;
        }
        const fill = stripe
          ? `repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 5px), ${bg}`
          : bg;
        return (
          <div
            key={i}
            style={{
              width: CELL,
              height: CELL,
              background: fill,
              border,
              borderRadius: 3,
              boxSizing: 'border-box',
              transition: 'background 220ms ease, border 220ms ease',
            }}
          />
        );
      })}
    </div>
  );
}

// One cell per AG tick of progress. The cell currently being filled pulses
// with a soft yellow ring; once all four cells are solid, L2's W is fully
// gathered and the next layer can use it without waiting.
function WCells({ step }) {
  const ticksDone = Math.min(step + 1, NUM_CHUNKS);
  const activeIdx = step < NUM_CHUNKS ? step : -1;
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: NUM_CHUNKS }, (_, i) => {
        const filled = i < ticksDone;
        const active = i === activeIdx;
        return (
          <div
            key={i}
            style={{
              width: W_CELL,
              height: W_CELL,
              background: filled ? FSDP_COLOR : 'rgba(234, 179, 8, 0.12)',
              border: `1px solid ${filled ? FSDP_COLOR : 'rgba(234, 179, 8, 0.35)'}`,
              borderRadius: 3,
              boxSizing: 'border-box',
              boxShadow: active ? `0 0 0 2px ${FSDP_COLOR}55` : 'none',
              transition: 'background 220ms ease, border 220ms ease, box-shadow 220ms ease',
            }}
          />
        );
      })}
    </div>
  );
}

function FocalChip({ step }) {
  const chipIdx = FOCAL_CHIP_IDX;
  const chipColor = CHIP_COLORS[chipIdx];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        padding: '14px 20px',
        borderRadius: 12,
        background: CARD_BG,
        border: `1.5px solid ${chipColor}55`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: chipColor,
          fontWeight: 700,
        }}
      >
        Chip {chipIdx} · F{fsdpRank(chipIdx)} T{tpRank(chipIdx)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={ROW_LABEL_STYLE}>L1 Y</span>
          <ChunkCells chipIdx={chipIdx} step={step} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={ROW_LABEL_STYLE}>L2 W</span>
          <WCells step={step} />
        </div>
      </div>
    </div>
  );
}

// Tiny static schematic just for orientation: where the focal chip sits in
// the 2×2 mesh, and which physical direction is FSDP vs TP. No animation —
// the timeline is the source of truth for what's firing this tick.
function MiniMesh() {
  const labelStyle = {
    fontSize: 9,
    color: INK_SOFT,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <div style={labelStyle}>← TP →</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div
          style={{
            ...labelStyle,
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
          }}
        >
          ← FSDP →
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: 3 }}>
          {[0, 1, 2, 3].map((i) => {
            const focal = i === FOCAL_CHIP_IDX;
            return (
              <div
                key={i}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 2,
                  background: focal ? CHIP_COLORS[i] : 'rgba(31,41,55,0.08)',
                  border: focal
                    ? `1.5px solid ${CHIP_COLORS[i]}`
                    : '1px solid rgba(31,41,55,0.2)',
                }}
              />
            );
          })}
        </div>
      </div>
      <div
        style={{
          fontSize: 9,
          color: INK_SOFT,
          fontStyle: 'italic',
          marginTop: 2,
        }}
      >
        all four do the same
      </div>
    </div>
  );
}

function ChipView({ step }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 28,
        flexWrap: 'wrap',
      }}
    >
      <MiniMesh />
      <FocalChip step={step} />
    </div>
  );
}

const TIMELINE_PAD_LEFT = 130;
const TIMELINE_PAD_RIGHT = 16;
const LANE_HEIGHT = 30;
const LANE_GAP = 8;
const TIMELINE_PAD_TOP = 28;
const TIMELINE_PAD_BOTTOM = 14;

function Timeline({ step }) {
  const width = 720;
  const innerWidth = width - TIMELINE_PAD_LEFT - TIMELINE_PAD_RIGHT;
  const blockWidth = innerWidth / TICKS;
  const height =
    TIMELINE_PAD_TOP + 3 * LANE_HEIGHT + 2 * LANE_GAP + TIMELINE_PAD_BOTTOM;

  const computeY = TIMELINE_PAD_TOP;
  const fsdpY = TIMELINE_PAD_TOP + LANE_HEIGHT + LANE_GAP;
  const tpY = TIMELINE_PAD_TOP + 2 * (LANE_HEIGHT + LANE_GAP);

  const agActive = step <= NUM_CHUNKS - 1;
  const agProgressFrac = agProgress(step);
  const playheadX = TIMELINE_PAD_LEFT + PLAYHEAD[step] * blockWidth;
  const agBarBaseWidth = NUM_CHUNKS * blockWidth - 6;
  const agBarFillWidth = agProgressFrac * agBarBaseWidth;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <clipPath id="fsdp-tp-ag-clip">
          <rect
            x={TIMELINE_PAD_LEFT + 3}
            y={fsdpY + 2}
            width={agBarFillWidth}
            height={LANE_HEIGHT - 4}
          />
        </clipPath>
      </defs>

      <text x={TIMELINE_PAD_LEFT + innerWidth} y={TIMELINE_PAD_TOP - 12} textAnchor="end" fontSize={10} fill={INK_SOFT}>
        time →
      </text>
      <line
        x1={TIMELINE_PAD_LEFT}
        y1={TIMELINE_PAD_TOP - 4}
        x2={TIMELINE_PAD_LEFT + innerWidth}
        y2={TIMELINE_PAD_TOP - 4}
        stroke="rgba(31,41,55,0.18)"
      />

      <text x={TIMELINE_PAD_LEFT - 12} y={computeY + LANE_HEIGHT / 2 + 4} textAnchor="end" fontSize={11} fill={INK_SOFT}>
        compute
      </text>
      <text x={TIMELINE_PAD_LEFT - 12} y={fsdpY + LANE_HEIGHT / 2 + 4} textAnchor="end" fontSize={11} fill={INK_SOFT}>
        FSDP axis
      </text>
      <text x={TIMELINE_PAD_LEFT - 12} y={tpY + LANE_HEIGHT / 2 + 4} textAnchor="end" fontSize={11} fill={INK_SOFT}>
        TP axis
      </text>

      {Array.from({ length: NUM_CHUNKS }, (_, i) => {
        if (step < i) return null;
        const active = step === i;
        const x = TIMELINE_PAD_LEFT + i * blockWidth;
        return (
          <g key={`mm${i}`}>
            <rect
              x={x + 3}
              y={computeY + 2}
              width={blockWidth - 6}
              height={LANE_HEIGHT - 4}
              rx={5}
              fill={COMPUTE_COLOR}
              fillOpacity={active ? 1 : 0.7}
              stroke={active ? YELLOW : 'none'}
              strokeWidth={2}
            />
            <text
              x={x + blockWidth / 2}
              y={computeY + LANE_HEIGHT / 2 + 4}
              textAnchor="middle"
              fontSize={10.5}
              fontWeight={600}
              fill="#fff"
              fontFamily="ui-monospace, SFMono-Regular, monospace"
            >
              mm c{i + 1}
            </text>
          </g>
        );
      })}

      {/* AG L2 W — faint base bar; opaque overlay fills L→R as the gather progresses */}
      <rect
        x={TIMELINE_PAD_LEFT + 3}
        y={fsdpY + 2}
        width={agBarBaseWidth}
        height={LANE_HEIGHT - 4}
        rx={5}
        fill={FSDP_COLOR}
        fillOpacity={0.14}
        stroke={FSDP_COLOR}
        strokeWidth={agActive ? 2.5 : 1.5}
        strokeDasharray="4 3"
      />
      {agProgressFrac > 0 && (
        <rect
          x={TIMELINE_PAD_LEFT + 3}
          y={fsdpY + 2}
          width={agBarBaseWidth}
          height={LANE_HEIGHT - 4}
          rx={5}
          fill={FSDP_COLOR}
          fillOpacity={0.5}
          clipPath="url(#fsdp-tp-ag-clip)"
        />
      )}
      <text
        x={TIMELINE_PAD_LEFT + agBarBaseWidth / 2 + 3}
        y={fsdpY + LANE_HEIGHT / 2 + 4}
        textAnchor="middle"
        fontSize={10.5}
        fontWeight={700}
        fill="#7a5f00"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
      >
        AG L2 W
      </text>

      {Array.from({ length: NUM_CHUNKS }, (_, i) => {
        if (step < i + 1) return null;
        const active = step === i + 1;
        const x = TIMELINE_PAD_LEFT + (i + 1) * blockWidth;
        return (
          <g key={`rs${i}`}>
            <rect
              x={x + 3}
              y={tpY + 2}
              width={blockWidth - 6}
              height={LANE_HEIGHT - 4}
              rx={5}
              fill={TP_COLOR}
              fillOpacity={active ? 0.42 : 0.22}
              stroke={TP_COLOR}
              strokeWidth={active ? 2.5 : 1.5}
              strokeDasharray="4 3"
            />
            <text
              x={x + blockWidth / 2}
              y={tpY + LANE_HEIGHT / 2 + 4}
              textAnchor="middle"
              fontSize={10.5}
              fontWeight={600}
              fill={TP_COLOR}
              fontFamily="ui-monospace, SFMono-Regular, monospace"
            >
              RS c{i + 1}
            </text>
          </g>
        );
      })}

      {/* Playhead — dashed vertical line + downward triangle, anchored to the active tick */}
      <line
        x1={playheadX}
        y1={TIMELINE_PAD_TOP - 6}
        x2={playheadX}
        y2={height - TIMELINE_PAD_BOTTOM}
        stroke="rgba(31,41,55,0.55)"
        strokeWidth={1.5}
        strokeDasharray="3 2"
        opacity={0.75}
      />
      <polygon
        points={`${playheadX - 5},${TIMELINE_PAD_TOP - 7} ${playheadX + 5},${TIMELINE_PAD_TOP - 7} ${playheadX},${TIMELINE_PAD_TOP - 1}`}
        fill="rgba(31,41,55,0.6)"
        opacity={0.9}
      />
    </svg>
  );
}

function Legend() {
  const Item = ({ swatch, label }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: INK }}>
      <span style={{ width: 14, height: 14, borderRadius: 3, ...swatch }} />
      {label}
    </span>
  );
  return (
    <div
      style={{
        display: 'flex',
        gap: 18,
        justifyContent: 'center',
        flexWrap: 'wrap',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <Item
        swatch={{ background: COMPUTE_COLOR, border: `2.5px solid ${COMPUTE_RING}` }}
        label="chunk computing"
      />
      <Item
        swatch={{ background: COMPUTE_COLOR, border: `2.5px solid ${TP_COLOR}` }}
        label="chunk reduce-scattering"
      />
      <Item
        swatch={{ background: COMPUTE_COLOR, border: '1px solid rgba(31,41,55,0.2)' }}
        label="chunk done (TP slice owned)"
      />
      <Item
        swatch={{ background: FSDP_COLOR, border: `1px solid ${FSDP_COLOR}` }}
        label="L2 W shard arrived"
      />
    </div>
  );
}

export default function FsdpTpStaircase() {
  const [step, setStep] = useState(0);

  return (
    <WidgetShell
      title="FSDP + TP — three streams in parallel on a 2×2 mesh"
      subtitle="Steady state, mid-pipeline. L1's W has already been gathered; its matmul is chunked and reduce-scattered along the TP axis while L2's W prefetches along the FSDP axis. Compute and both axes run concurrently — step through to watch them overlap."
    >
      <ChipView step={step} />
      <Legend />
      <Timeline step={step} />
      <Caption>{STEP_CAPTIONS[step]}</Caption>
      <StepControls step={step} totalSteps={TOTAL_STEPS} setStep={setStep} />
    </WidgetShell>
  );
}
