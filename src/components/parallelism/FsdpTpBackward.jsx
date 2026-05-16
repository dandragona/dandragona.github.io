import { useState } from 'react';

const CHIP_COLORS = ['#2563eb', '#059669', '#7c3aed', '#ea580c'];
const FSDP_COLOR = '#eab308';
const TP_COLOR = '#0891b2';
const INK = '#1f2937';
const INK_SOFT = 'rgba(31, 41, 55, 0.6)';
const CARD_BG = 'rgba(255, 255, 255, 0.55)';
const CARD_BORDER = 'rgba(31, 41, 55, 0.18)';
const AXIS_LABEL = 'rgba(31, 41, 55, 0.55)';

// Backward on FSDP + TP mirrors the forward. Where forward fired AG along the
// FSDP axis (to materialize W) and RS along the TP axis (to reduce-scatter the
// partial-sum output), backward fires AG along the TP axis (to broadcast the
// upstream ∂Y) and RS along the FSDP axis (to reduce-scatter the full-shape
// ∂W back into the FSDP layout).
const STEPS = [
  {
    chipLabel: '∂Y shard',
    dYAct: false,
    dYFull: false,
    dWFull: false,
    dWSharded: false,
    fsdpActive: false,
    tpActive: false,
    fsdpLabel: null,
    tpLabel: null,
    agCount: 0,
    rsCount: 0,
    caption:
      'Forward done. ∂Y arrives sharded across both axes — same layout as the forward Y. Now backward walks the layer in reverse.',
  },
  {
    chipLabel: 'AG ∂Y (TP)',
    dYAct: true,
    dYFull: false,
    dWFull: false,
    dWSharded: false,
    fsdpActive: false,
    tpActive: true,
    fsdpLabel: null,
    tpLabel: 'AG ∂Y',
    agCount: 1,
    rsCount: 0,
    caption:
      "AG along the TP axis — the mirror of forward's RS_Y. Chips with the same FSDP rank pool their ∂Y columns; horizontal links light up. Each chip will end up with the full ∂Y for its batch slice.",
  },
  {
    chipLabel: 'bw L1',
    dYAct: false,
    dYFull: true,
    dWFull: true,
    dWSharded: false,
    fsdpActive: false,
    tpActive: false,
    fsdpLabel: null,
    tpLabel: null,
    agCount: 1,
    rsCount: 0,
    caption:
      'Backward compute: each chip uses its (TP-gathered) ∂Y and its batch slice of X to produce ∂W at FULL output shape — partial along the FSDP axis (every chip has an opinion on every row of W).',
  },
  {
    chipLabel: 'RS ∂W (FSDP)',
    dYAct: false,
    dYFull: true,
    dWFull: true,
    dWSharded: false,
    fsdpActive: true,
    tpActive: false,
    fsdpLabel: 'RS ∂W',
    tpLabel: null,
    agCount: 1,
    rsCount: 1,
    caption:
      "RS along the FSDP axis — the mirror of forward's AG_W. Chips with the same TP rank sum-and-scatter their ∂W partials; vertical links light up. ∂W lands back in the FSDP-sharded layout.",
  },
  {
    chipLabel: '∂W shard',
    dYAct: false,
    dYFull: false,
    dWFull: false,
    dWSharded: true,
    fsdpActive: false,
    tpActive: false,
    fsdpLabel: null,
    tpLabel: null,
    agCount: 1,
    rsCount: 1,
    caption:
      'Backward done. ∂W is sharded along both axes, exactly matching W\'s storage layout. Per layer the backward fires one AG along TP and one RS along FSDP — the forward\'s collectives, swapped.',
  },
];

const TOTAL_STEPS = STEPS.length;

const PLAYHEAD = [0, 0.5, 1.5, 2.5, 3];
const TICKS = 4;

const BLOCKS = [
  { id: 'ag', lane: 'tp', x: 0, dur: 1, label: 'AG ∂Y', activeAt: 1 },
  { id: 'bw', lane: 'compute', x: 1, dur: 1, label: 'bw L1', activeAt: 2 },
  { id: 'rs', lane: 'fsdp', x: 2, dur: 1, label: 'RS ∂W', activeAt: 3 },
];

const LANES = [
  { id: 'compute', label: 'compute', color: CHIP_COLORS[0] },
  { id: 'fsdp', label: 'FSDP axis', color: FSDP_COLOR },
  { id: 'tp', label: 'TP axis', color: TP_COLOR },
];

const fsdpRank = (chipIdx) => Math.floor(chipIdx / 2);
const tpRank = (chipIdx) => chipIdx % 2;

function StateDot({ dYAct, dYFull, dWFull, dWSharded, fsdpActive, tpActive }) {
  let bg = 'rgba(31, 41, 55, 0.15)';
  let border = CARD_BORDER;
  let ring = null;
  if (tpActive) {
    bg = 'transparent';
    border = TP_COLOR;
    ring = `0 0 0 2px ${TP_COLOR}33`;
  } else if (fsdpActive) {
    bg = 'transparent';
    border = FSDP_COLOR;
    ring = `0 0 0 2px ${FSDP_COLOR}33`;
  } else if (dWFull) {
    bg = `repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 5px), ${FSDP_COLOR}`;
    border = FSDP_COLOR;
  } else if (dWSharded) {
    bg = FSDP_COLOR;
    border = FSDP_COLOR;
  } else if (dYFull) {
    bg = TP_COLOR;
    border = TP_COLOR;
  } else if (dYAct) {
    bg = `repeating-linear-gradient(45deg, ${TP_COLOR} 0 2px, transparent 2px 5px)`;
    border = TP_COLOR;
  }
  return (
    <span
      style={{
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: bg,
        border: `1.5px solid ${border}`,
        boxShadow: ring ?? 'none',
        transition: 'background 200ms ease, border 200ms ease, box-shadow 200ms ease',
      }}
    />
  );
}

function ChipCard({ chipIdx, step }) {
  const chipColor = CHIP_COLORS[chipIdx];
  const s = STEPS[step];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '10px 12px',
        borderRadius: 10,
        background: CARD_BG,
        border: `1.5px solid ${chipColor}55`,
        minWidth: 130,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: chipColor,
          fontWeight: 700,
        }}
      >
        Chip {chipIdx} · F{fsdpRank(chipIdx)} T{tpRank(chipIdx)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StateDot
          dYAct={s.dYAct}
          dYFull={s.dYFull}
          dWFull={s.dWFull}
          dWSharded={s.dWSharded}
          fsdpActive={s.fsdpActive}
          tpActive={s.tpActive}
        />
        <span
          style={{
            fontSize: 11,
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            color: INK,
            letterSpacing: '0.01em',
          }}
        >
          {s.chipLabel}
        </span>
      </div>
    </div>
  );
}

function HArrow({ active, label }) {
  const color = active ? TP_COLOR : 'rgba(31,41,55,0.22)';
  const stroke = active ? 3 : 2;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <svg width="64" height="14" viewBox="0 0 64 14">
        <line
          x1="8"
          y1="7"
          x2="56"
          y2="7"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <polygon points="2,7 10,2 10,12" fill={color} />
        <polygon points="62,7 54,2 54,12" fill={color} />
      </svg>
      <div
        style={{
          fontSize: 9,
          color: active ? color : 'transparent',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          letterSpacing: '0.04em',
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

function VArrow({ active, label }) {
  const color = active ? FSDP_COLOR : 'rgba(31,41,55,0.22)';
  const stroke = active ? 3 : 2;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <svg width="14" height="36" viewBox="0 0 14 36">
        <line
          x1="7"
          y1="6"
          x2="7"
          y2="30"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <polygon points="7,2 2,9 12,9" fill={color} />
        <polygon points="7,34 2,27 12,27" fill={color} />
      </svg>
      <div
        style={{
          fontSize: 9,
          color: active ? color : 'transparent',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontWeight: 600,
          minWidth: 38,
          transition: 'color 200ms ease',
        }}
      >
        {label || ' '}
      </div>
    </div>
  );
}

function AxisLabel({ children, vertical }) {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: AXIS_LABEL,
        fontWeight: 600,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        writingMode: vertical ? 'vertical-rl' : 'horizontal-tb',
        transform: vertical ? 'rotate(180deg)' : 'none',
      }}
    >
      {children}
    </div>
  );
}

function Mesh({ step }) {
  const s = STEPS[step];
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <AxisLabel vertical>← FSDP axis →</AxisLabel>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <AxisLabel>← TP axis →</AxisLabel>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto auto auto',
              gridTemplateRows: 'auto auto auto',
              alignItems: 'center',
              justifyItems: 'center',
              rowGap: 6,
              columnGap: 6,
            }}
          >
            <ChipCard chipIdx={0} step={step} />
            <HArrow active={s.tpActive} label={s.tpLabel} />
            <ChipCard chipIdx={1} step={step} />

            <VArrow active={s.fsdpActive} label={s.fsdpLabel} />
            <div />
            <VArrow active={s.fsdpActive} label={s.fsdpLabel} />

            <ChipCard chipIdx={2} step={step} />
            <HArrow active={s.tpActive} label={s.tpLabel} />
            <ChipCard chipIdx={3} step={step} />
          </div>
        </div>
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
        flexWrap: 'wrap',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{ display: 'inline-block', width: 10, height: 3, background: TP_COLOR, borderRadius: 2 }}
        />
        AG (TP axis):{' '}
        <strong style={{ color: TP_COLOR, minWidth: 14, textAlign: 'right' }}>{s.agCount}×</strong>
      </span>
      <span style={{ color: INK_SOFT }}>·</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{ display: 'inline-block', width: 10, height: 3, background: FSDP_COLOR, borderRadius: 2 }}
        />
        RS (FSDP axis):{' '}
        <strong style={{ color: FSDP_COLOR, minWidth: 14, textAlign: 'right' }}>{s.rsCount}×</strong>
      </span>
    </div>
  );
}

const TIMELINE_PAD_LEFT = 130;
const TIMELINE_PAD_RIGHT = 16;
const LANE_HEIGHT = 28;
const LANE_GAP = 10;
const TIMELINE_PAD_TOP = 30;
const TIMELINE_PAD_BOTTOM = 16;

function Timeline({ step }) {
  const width = 720;
  const innerWidth = width - TIMELINE_PAD_LEFT - TIMELINE_PAD_RIGHT;
  const unit = innerWidth / TICKS;
  const height =
    TIMELINE_PAD_TOP +
    LANES.length * LANE_HEIGHT +
    (LANES.length - 1) * LANE_GAP +
    TIMELINE_PAD_BOTTOM;

  const laneY = (idx) => TIMELINE_PAD_TOP + idx * (LANE_HEIGHT + LANE_GAP);
  const playheadX = TIMELINE_PAD_LEFT + PLAYHEAD[step] * unit;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <text
        x={TIMELINE_PAD_LEFT + innerWidth}
        y={TIMELINE_PAD_TOP - 14}
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
        const lane = LANES[laneIdx];
        const x = TIMELINE_PAD_LEFT + b.x * unit;
        const w = Math.max(b.dur * unit - 4, 6);
        const y = laneY(laneIdx) + 2;
        const isCompute = lane.id === 'compute';
        const blockColor = lane.color;
        return (
          <g key={b.id}>
            <rect
              x={x + 2}
              y={y}
              width={w}
              height={LANE_HEIGHT - 4}
              rx={5}
              fill={blockColor}
              fillOpacity={isCompute ? (active ? 1 : 0.75) : active ? 0.4 : 0.22}
              stroke={active ? blockColor : isCompute ? 'none' : blockColor}
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

      <line
        x1={playheadX}
        y1={TIMELINE_PAD_TOP - 6}
        x2={playheadX}
        y2={height - TIMELINE_PAD_BOTTOM}
        stroke={TP_COLOR}
        strokeWidth={1.5}
        strokeDasharray="3 2"
        opacity={0.85}
      />
      <polygon
        points={`${playheadX - 5},${TIMELINE_PAD_TOP - 6} ${playheadX + 5},${TIMELINE_PAD_TOP - 6} ${playheadX},${TIMELINE_PAD_TOP - 1}`}
        fill={TP_COLOR}
        opacity={0.95}
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

export default function FsdpTpBackward() {
  const [step, setStep] = useState(0);
  const s = STEPS[step];

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
        <strong style={{ letterSpacing: '0.02em' }}>FSDP + TP backward — collectives swapped</strong>
        <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6, lineHeight: 1.5 }}>
          Forward fired AG along the FSDP axis, then RS along the TP axis. Backward fires the opposite collective on each — AG along TP, then RS along FSDP — for the same per-layer cost.
        </div>
      </div>

      <Mesh step={step} />
      <Counter step={step} />
      <Timeline step={step} />

      <div
        style={{
          fontSize: 12,
          color: INK_SOFT,
          textAlign: 'center',
          lineHeight: 1.55,
          minHeight: 56,
          padding: '0 12px',
        }}
      >
        {s.caption}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
        <button
          onClick={() => setStep((v) => Math.max(0, v - 1))}
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
          onClick={() => setStep((v) => Math.min(TOTAL_STEPS - 1, v + 1))}
          disabled={step === TOTAL_STEPS - 1}
          style={buttonStyle(step === TOTAL_STEPS - 1, true)}
        >
          Next →
        </button>
        <button onClick={() => setStep(0)} style={{ ...buttonStyle(false, false), marginLeft: 8 }}>
          Reset
        </button>
      </div>
    </div>
  );
}
