import { useState } from 'react';

const CHIP_COLORS = ['#2563eb', '#059669', '#7c3aed', '#ea580c'];
const YELLOW = '#eab308';
const SLOW = '#dc2626';
const ABSENT = 'rgba(0, 0, 0, 0.08)';
const INK = '#1f2937';
const INK_SOFT = 'rgba(31, 41, 55, 0.6)';
const CARD_BG = 'rgba(255, 255, 255, 0.35)';
const CARD_BORDER = 'rgba(31, 41, 55, 0.18)';

const CELL = 14;
const GAP = 2;
const B = 4;
const E = 2;
const NUM_CHIPS = 4;

const STEPS = [
  {
    caption:
      'Rest. Each chip stores its W shard — the row of W matching its FSDP rank. Y is empty. Horizontal arrows are the fast intra-node FSDP axis; vertical arrows are the slow inter-node DP axis.',
    layerLabel: null,
    wMat: false,
    yShown: false,
    gShown: false,
    gPartial: false,
    fastActive: false,
    slowActive: false,
    fastLabel: null,
    slowLabel: null,
    agNextLayer: null,
    playheadX: 0,
    fastCount: 0,
    slowCount: 0,
  },
  {
    caption:
      'Layer 1: all-gather W on the FAST axis fires. Chips swap W rows with their FSDP-paired sibling. W is in flight; compute waits.',
    layerLabel: null,
    wMat: false,
    yShown: false,
    gShown: false,
    gPartial: false,
    fastActive: true,
    slowActive: false,
    fastLabel: 'AG W₁',
    slowLabel: null,
    agNextLayer: 1,
    playheadX: 0.5,
    fastCount: 1,
    slowCount: 0,
  },
  {
    caption:
      'AG L1 complete — W is now materialized on every chip (yellow). The fast link has gone quiet; compute is about to start.',
    layerLabel: 'W₁ ready',
    wMat: true,
    yShown: false,
    gShown: false,
    gPartial: false,
    fastActive: false,
    slowActive: false,
    fastLabel: null,
    slowLabel: null,
    agNextLayer: null,
    playheadX: 1.05,
    fastCount: 1,
    slowCount: 0,
  },
  {
    caption:
      "Layer 1 computes with W₁ (yellow). Meanwhile, W₂'s all-gather is filling a SECOND buffer on the fast link — look for the dashed mini-W₂ on each chip. Compute and comm are happening at the same time.",
    layerLabel: 'W₁',
    wMat: true,
    yShown: true,
    gShown: false,
    gPartial: false,
    fastActive: true,
    slowActive: false,
    fastLabel: 'AG W₂',
    slowLabel: null,
    agNextLayer: 2,
    playheadX: 1.5,
    fastCount: 2,
    slowCount: 0,
  },
  {
    caption:
      "Layer 2 computes with W₂; W₃'s all-gather fills the next buffer on the same fast link. Three AGs fired so far. The slow link is still asleep.",
    layerLabel: 'W₂',
    wMat: true,
    yShown: true,
    gShown: false,
    gPartial: false,
    fastActive: true,
    slowActive: false,
    fastLabel: 'AG W₃',
    slowLabel: null,
    agNextLayer: 3,
    playheadX: 2.5,
    fastCount: 3,
    slowCount: 0,
  },
  {
    caption:
      'Layer 3 computes — the final forward matmul. No more AGs to fire (no layer 4 to fetch), so no overlap this tick. Forward pass complete. The slow link has been silent the whole time.',
    layerLabel: 'W₃',
    wMat: true,
    yShown: true,
    gShown: false,
    gPartial: false,
    fastActive: false,
    slowActive: false,
    fastLabel: null,
    slowLabel: null,
    agNextLayer: null,
    playheadX: 3.5,
    fastCount: 3,
    slowCount: 0,
  },
];

const TOTAL_STEPS = STEPS.length;

const BLOCKS = [
  { id: 'ag1', lane: 'fast', x: 0, dur: 1, label: 'AG L1', activeAt: 1 },
  { id: 'mm1', lane: 'compute', x: 1, dur: 1, label: 'mm L1', activeAt: 3 },
  { id: 'ag2', lane: 'fast', x: 1, dur: 1, label: 'AG L2', activeAt: 3 },
  { id: 'mm2', lane: 'compute', x: 2, dur: 1, label: 'mm L2', activeAt: 4 },
  { id: 'ag3', lane: 'fast', x: 2, dur: 1, label: 'AG L3', activeAt: 4 },
  { id: 'mm3', lane: 'compute', x: 3, dur: 1, label: 'mm L3', activeAt: 5 },
];

const fsdpRank = (chipIdx) => chipIdx % 2;
const dpRank = (chipIdx) => Math.floor(chipIdx / 2);

const ownsBatchRow = (chipIdx, row) =>
  Math.floor(row / (B / 2)) === dpRank(chipIdx);
const ownsWRow = (chipIdx, row) => row === fsdpRank(chipIdx);

function Cell({ fill, stripe }) {
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
        border: '1px solid rgba(31, 41, 55, 0.2)',
        transition: 'background 200ms ease',
      }}
    />
  );
}

function TensorGrid({ name, subtitle, rows, cols, getFill, containerHeight }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
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
      <div
        style={{
          fontSize: 10,
          color: INK_SOFT,
          fontFamily: 'monospace',
          textAlign: 'center',
          lineHeight: 1.1,
          minHeight: 22,
        }}
      >
        <div>{name}</div>
        <div style={{ fontSize: 8.5, fontStyle: 'italic', opacity: subtitle ? 0.9 : 0 }}>
          {subtitle || '·'}
        </div>
      </div>
    </div>
  );
}

function OpSymbol({ children, containerHeight }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div
        style={{
          height: containerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          color: INK_SOFT,
          fontWeight: 500,
          minWidth: 8,
        }}
      >
        {children}
      </div>
      <div style={{ fontSize: 10, visibility: 'hidden', minHeight: 22 }}>·</div>
    </div>
  );
}

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
    if (!ownsWRow(chipIdx, r)) return { fill: ABSENT };
    return { fill: chipColor, stripe: s.gPartial };
  };

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
              subtitle={s.gPartial ? 'mid-AR' : 'FSDP-sharded'}
              rows={E}
              cols={E}
              getFill={gFill}
              containerHeight={containerHeight}
            />
          </>
        )}
      </div>
      {s.agNextLayer && <AgNextBuffer chipIdx={chipIdx} layer={s.agNextLayer} />}
    </div>
  );
}

const MINI_CELL = 10;

function MiniCell({ fill, stripe }) {
  const bg = stripe
    ? `repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 1.5px, transparent 1.5px 4px), ${fill}`
    : fill;
  return (
    <div
      style={{
        width: MINI_CELL,
        height: MINI_CELL,
        background: bg,
        borderRadius: 2,
        boxSizing: 'border-box',
        border: '1px solid rgba(31, 41, 55, 0.2)',
      }}
    />
  );
}

function AgNextBuffer({ chipIdx, layer }) {
  const chipColor = CHIP_COLORS[chipIdx];
  // Local row already present (solid); peer's row being received (striped).
  const cellFor = (r) =>
    ownsWRow(chipIdx, r) ? { fill: chipColor } : { fill: chipColor, stripe: true };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 6px',
        borderRadius: 6,
        background: 'rgba(234, 179, 8, 0.12)',
        border: `1px dashed ${YELLOW}`,
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: '#8a6a08',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          letterSpacing: '0.04em',
        }}
      >
        AG W₍{layer}₎ →
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {Array.from({ length: E }, (_, r) => (
          <div key={r} style={{ display: 'flex', gap: 1.5 }}>
            {Array.from({ length: E }, (_, c) => (
              <MiniCell key={c} {...cellFor(r)} />
            ))}
          </div>
        ))}
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
        <line
          x1="10"
          y1="7"
          x2="66"
          y2="7"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <polygon points="2,7 12,2 12,12" fill={color} />
        <polygon points="74,7 64,2 64,12" fill={color} />
      </svg>
      <div
        style={{
          fontSize: 9,
          color: active ? color : 'transparent',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          letterSpacing: '0.04em',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          minHeight: 12,
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
        <line
          x1="7"
          y1="8"
          x2="7"
          y2="34"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={dash}
        />
        <polygon points="7,2 2,10 12,10" fill={color} />
        <polygon points="7,40 2,32 12,32" fill={color} />
      </svg>
      <div
        style={{
          fontSize: 9,
          color: active ? color : 'transparent',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          letterSpacing: '0.04em',
          fontWeight: 600,
          whiteSpace: 'nowrap',
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
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 3,
            background: YELLOW,
            borderRadius: 2,
          }}
        />
        fast comm: <strong style={{ color: YELLOW, minWidth: 14, textAlign: 'right' }}>{s.fastCount}×</strong>
      </span>
      <span style={{ color: INK_SOFT }}>·</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 3,
            background: SLOW,
            borderRadius: 2,
          }}
        />
        slow comm: <strong style={{ color: SLOW, minWidth: 14, textAlign: 'right' }}>{s.slowCount}×</strong>
      </span>
    </div>
  );
}

const LANES = [
  { id: 'compute', label: 'compute' },
  { id: 'fast', label: 'fast · FSDP' },
  { id: 'slow', label: 'slow · DP' },
];

const TIMELINE_PAD_LEFT = 110;
const TIMELINE_PAD_RIGHT = 16;
const LANE_HEIGHT = 30;
const LANE_GAP = 10;
const TIMELINE_PAD_TOP = 24;
const TIMELINE_PAD_BOTTOM = 8;
const TICKS = 4;

function Timeline({ step }) {
  const s = STEPS[step];
  const width = 680;
  const innerWidth = width - TIMELINE_PAD_LEFT - TIMELINE_PAD_RIGHT;
  const unit = innerWidth / TICKS;
  const height =
    TIMELINE_PAD_TOP +
    LANES.length * LANE_HEIGHT +
    (LANES.length - 1) * LANE_GAP +
    TIMELINE_PAD_BOTTOM;

  const laneY = (idx) =>
    TIMELINE_PAD_TOP + idx * (LANE_HEIGHT + LANE_GAP);

  const playheadX = TIMELINE_PAD_LEFT + s.playheadX * unit;

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

      {LANES.map((lane, i) => (
        <text
          key={lane.id}
          x={TIMELINE_PAD_LEFT - 12}
          y={laneY(i) + LANE_HEIGHT / 2 + 4}
          textAnchor="end"
          fontSize={11}
          fill={INK_SOFT}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {lane.label}
        </text>
      ))}

      {BLOCKS.map((b) => {
        if (step < b.activeAt) return null;
        const active = step === b.activeAt;
        const laneIdx = LANES.findIndex((l) => l.id === b.lane);
        const x = TIMELINE_PAD_LEFT + b.x * unit;
        const w = b.dur * unit - 4;
        const y = laneY(laneIdx) + 2;
        const isFast = b.lane === 'fast';
        const isSlow = b.lane === 'slow';
        const isCompute = b.lane === 'compute';
        const blockColor = isFast ? YELLOW : isSlow ? SLOW : CHIP_COLORS[0];
        return (
          <g key={b.id}>
            <rect
              x={x + 2}
              y={y}
              width={w}
              height={LANE_HEIGHT - 4}
              rx={5}
              fill={blockColor}
              fillOpacity={isCompute ? (active ? 1 : 0.75) : active ? 0.32 : 0.18}
              stroke={active ? (isCompute ? YELLOW : blockColor) : isCompute ? 'none' : blockColor}
              strokeWidth={active ? 2.5 : 1.5}
              strokeDasharray={isCompute ? 'none' : '4 3'}
            />
            <text
              x={x + 2 + w / 2}
              y={y + (LANE_HEIGHT - 4) / 2 + 4}
              textAnchor="middle"
              fontSize={9.5}
              fontWeight={600}
              fill={isCompute ? '#ffffff' : blockColor}
              fontFamily="ui-monospace, SFMono-Regular, monospace"
            >
              {b.label}
            </text>
          </g>
        );
      })}

      {/* playhead */}
      <line
        x1={playheadX}
        y1={TIMELINE_PAD_TOP - 6}
        x2={playheadX}
        y2={height - TIMELINE_PAD_BOTTOM}
        stroke={YELLOW}
        strokeWidth={1.5}
        strokeDasharray="3 2"
        opacity={0.8}
      />
      <polygon
        points={`${playheadX - 5},${TIMELINE_PAD_TOP - 6} ${playheadX + 5},${TIMELINE_PAD_TOP - 6} ${playheadX},${TIMELINE_PAD_TOP - 1}`}
        fill={YELLOW}
        opacity={0.9}
      />
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

function MeshLegend() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 18,
        justifyContent: 'center',
        fontSize: 11,
        color: INK_SOFT,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <svg width="22" height="10" viewBox="0 0 22 10">
          <line x1="3" y1="5" x2="19" y2="5" stroke={YELLOW} strokeWidth={3} strokeLinecap="round" />
        </svg>
        fast intra-node (FSDP)
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <svg width="22" height="10" viewBox="0 0 22 10">
          <line x1="3" y1="5" x2="19" y2="5" stroke={SLOW} strokeWidth={2.5} strokeLinecap="round" strokeDasharray="3 2" />
        </svg>
        slow inter-node (DP replica)
      </span>
    </div>
  );
}

export default function HybridStaircase() {
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
        <strong style={{ letterSpacing: '0.02em' }}>
          Hybrid FSDP — Forward pass on a 2×2 mesh
        </strong>
        <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6, lineHeight: 1.5 }}>
          Step through the forward pass and watch the fast axis fire every layer while the slow
          axis stays silent. (Backward and the slow-axis all-reduce land later in the post.)
        </div>
      </div>

      <MeshLegend />
      <Mesh step={step} />
      <Counter step={step} />
      <Timeline step={step} />

      <div
        style={{
          fontSize: 12,
          color: INK_SOFT,
          textAlign: 'center',
          lineHeight: 1.55,
          minHeight: 52,
          padding: '0 12px',
        }}
      >
        {STEPS[step].caption}
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
