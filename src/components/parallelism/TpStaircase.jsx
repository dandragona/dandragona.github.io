import { useState } from 'react';

const CHIP_COLORS = ['#2563eb', '#059669'];
const ABSENT = 'rgba(0, 0, 0, 0.08)';
const HIGHLIGHT = '#eab308';
const INK = '#1f2937';
const INK_SOFT = 'rgba(31, 41, 55, 0.6)';
const CARD_BG = 'rgba(255, 255, 255, 0.35)';
const CARD_BORDER = 'rgba(31, 41, 55, 0.18)';

const CELL = 16;
const GAP = 2;
const NUM_CHIPS = 2;
const B = 4;
const E = 2;
const NUM_CHUNKS = B;
const TOTAL_STEPS = NUM_CHUNKS + 2;

const STEP_CAPTIONS = [
  'Step 0 — Chunk 1 begins computing on each chip. No comm yet — the first partial is still being produced.',
  "Step 1 — Chunk 2 computes while chunk 1's partial reduce-scatters across chips. The overlap has started.",
  "Step 2 — Chunk 3 computes; chunk 2's reduce-scatter overlaps the compute lane.",
  "Step 3 — Chunk 4 computes; chunk 3's reduce-scatter overlaps.",
  "Step 4 — Compute is done. Chunk 4's reduce-scatter runs alone — the unavoidable tail.",
  'Step 5 — All reduce-scatters complete. Y is fully assembled; each chip owns one column.',
];

function yState(rowIdx, step) {
  if (step < rowIdx) return 'absent';
  if (step <= rowIdx + 1) return 'partial';
  return 'done';
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
          ? `2px solid ${HIGHLIGHT}`
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

  const xFill = (r, c) => {
    if (c !== chipIdx) return { fill: ABSENT };
    const highlight = r === step && step < NUM_CHUNKS;
    return { fill: chipColor, highlight };
  };

  const wFill = (r) => {
    return r === chipIdx ? { fill: chipColor } : { fill: ABSENT };
  };

  const yFill = (r, c) => {
    const state = yState(r, step);
    if (state === 'absent') return { fill: ABSENT };
    if (state === 'partial') {
      const highlight = r === step && step < NUM_CHUNKS;
      return { fill: chipColor, stripe: true, highlight };
    }
    return c === chipIdx ? { fill: chipColor } : { fill: ABSENT };
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
        <OpSymbol containerHeight={containerHeight}>@</OpSymbol>
        <TensorGrid name="W" rows={E} cols={E} getFill={wFill} containerHeight={containerHeight} />
        <OpSymbol containerHeight={containerHeight}>=</OpSymbol>
        <TensorGrid name="Y" rows={B} cols={E} getFill={yFill} containerHeight={containerHeight} />
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
        reduce-scatter
      </text>

      {Array.from({ length: NUM_CHUNKS }, (_, i) => {
        if (step < i) return null;
        const active = step === i;
        const x = TIMELINE_PAD_LEFT + i * blockWidth;
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
              stroke={active ? HIGHLIGHT : 'none'}
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

      {Array.from({ length: NUM_CHUNKS }, (_, i) => {
        if (step < i + 1) return null;
        const active = step === i + 1;
        const x = TIMELINE_PAD_LEFT + (i + 1) * blockWidth;
        return (
          <g key={`rs-${i}`}>
            <rect
              x={x + 3}
              y={commY + 2}
              width={blockWidth - 6}
              height={LANE_HEIGHT - 4}
              rx={5}
              fill={CHIP_COLORS[0]}
              fillOpacity={0.16}
              stroke={active ? HIGHLIGHT : CHIP_COLORS[0]}
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
              RS c{i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function buttonStyle(disabled, primary) {
  return {
    padding: '6px 14px',
    borderRadius: 6,
    background: disabled
      ? 'rgba(255,255,255,0.2)'
      : primary
      ? 'rgba(37, 99, 235, 0.22)'
      : 'rgba(255, 255, 255, 0.4)',
    color: disabled ? INK_SOFT : INK,
    border: `1px solid ${primary && !disabled ? 'rgba(37, 99, 235, 0.45)' : CARD_BORDER}`,
    fontSize: 13,
    cursor: disabled ? 'default' : 'pointer',
    fontWeight: 500,
    transition: 'background 180ms ease',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };
}

export default function TpStaircase() {
  const [step, setStep] = useState(0);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '20px 16px',
        borderRadius: 16,
        background: 'rgba(255, 255, 255, 0.18)',
        border: `1px solid ${CARD_BORDER}`,
        margin: '28px 0',
        color: INK,
      }}
    >
      <div style={{ textAlign: 'center', fontSize: 13, color: INK }}>
        <strong style={{ letterSpacing: '0.02em' }}>TP — Build the within-layer staircase</strong>
        <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6, lineHeight: 1.5 }}>
          Split the matmul into chunks along the batch dim. Step through the algorithm; the yellow
          ring marks the chunk being computed this tick, and the dashed block marks the chunk being
          reduce-scattered at the same time.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {Array.from({ length: NUM_CHIPS }, (_, i) => (
          <ChipMatmul key={i} chipIdx={i} step={step} />
        ))}
      </div>

      <Timeline step={step} />

      <div
        style={{
          fontSize: 12,
          color: INK_SOFT,
          textAlign: 'center',
          lineHeight: 1.5,
          minHeight: 36,
          padding: '0 12px',
        }}
      >
        {STEP_CAPTIONS[step]}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          style={buttonStyle(step === 0, false)}
        >
          ← Prev
        </button>
        <div
          style={{
            fontSize: 12,
            color: INK_SOFT,
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            minWidth: 90,
            textAlign: 'center',
          }}
        >
          Step {step} / {TOTAL_STEPS - 1}
        </div>
        <button
          onClick={() => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1))}
          disabled={step === TOTAL_STEPS - 1}
          style={buttonStyle(step === TOTAL_STEPS - 1, true)}
        >
          Next →
        </button>
        <button
          onClick={() => setStep(0)}
          style={{ ...buttonStyle(false, false), marginLeft: 8 }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
