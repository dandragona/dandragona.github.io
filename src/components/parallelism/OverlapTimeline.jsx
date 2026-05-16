import { useState } from 'react';

const LAYER_COLORS = ['#2563eb', '#7c3aed', '#ea580c', '#059669'];
const INK = '#1f2937';
const INK_SOFT = 'rgba(31, 41, 55, 0.6)';
const CARD_BORDER = 'rgba(31, 41, 55, 0.18)';

const SCHEMAS = {
  dp: {
    title: 'Data Parallelism — Backward Pass Overlap',
    blurb:
      "Forward needs no comm at all. The interesting overlap is in backward: each layer's gradient all-reduce can run while earlier layers' backwards are still computing.",
    lanes: [
      { id: 'compute', label: 'compute' },
      { id: 'comm', label: 'all-reduce' },
    ],
    duration: 22,
    modes: {
      default: {
        compute: [
          { idx: 3, start: 0, dur: 4, op: 'bwd', tag: 'L4' },
          { idx: 2, start: 4, dur: 4, op: 'bwd', tag: 'L3' },
          { idx: 1, start: 8, dur: 4, op: 'bwd', tag: 'L2' },
          { idx: 0, start: 12, dur: 4, op: 'bwd', tag: 'L1' },
        ],
        comm: [
          { idx: 3, start: 4, dur: 3, op: 'AR', tag: 'g4' },
          { idx: 2, start: 8, dur: 3, op: 'AR', tag: 'g3' },
          { idx: 1, start: 12, dur: 3, op: 'AR', tag: 'g2' },
          { idx: 0, start: 16, dur: 3, op: 'AR', tag: 'g1' },
        ],
      },
    },
  },
  fsdp: {
    title: 'FSDP — Pipelined All-Gather',
    blurb:
      "Layer N+1's weights are gathered during layer N's matmul. As long as the all-gather is shorter than the matmul, compute never waits.",
    lanes: [
      { id: 'compute', label: 'compute' },
      { id: 'comm', label: 'all-gather' },
    ],
    duration: 20,
    toggleable: true,
    modes: {
      overlapped: {
        label: 'Overlapped',
        compute: [
          { idx: 0, start: 4, dur: 4, op: 'matmul', tag: 'L1' },
          { idx: 1, start: 8, dur: 4, op: 'matmul', tag: 'L2' },
          { idx: 2, start: 12, dur: 4, op: 'matmul', tag: 'L3' },
          { idx: 3, start: 16, dur: 4, op: 'matmul', tag: 'L4' },
        ],
        comm: [
          { idx: 0, start: 0, dur: 4, op: 'AG', tag: 'W1' },
          { idx: 1, start: 4, dur: 4, op: 'AG', tag: 'W2' },
          { idx: 2, start: 8, dur: 4, op: 'AG', tag: 'W3' },
          { idx: 3, start: 12, dur: 4, op: 'AG', tag: 'W4' },
        ],
      },
      naive: {
        label: 'Naive (non-overlapped)',
        duration: 32,
        warn: 'Total time roughly doubles. Compute waits for each all-gather to finish.',
        compute: [
          { idx: 0, start: 4, dur: 4, op: 'matmul', tag: 'L1' },
          { idx: 1, start: 12, dur: 4, op: 'matmul', tag: 'L2' },
          { idx: 2, start: 20, dur: 4, op: 'matmul', tag: 'L3' },
          { idx: 3, start: 28, dur: 4, op: 'matmul', tag: 'L4' },
        ],
        comm: [
          { idx: 0, start: 0, dur: 4, op: 'AG', tag: 'W1' },
          { idx: 1, start: 8, dur: 4, op: 'AG', tag: 'W2' },
          { idx: 2, start: 16, dur: 4, op: 'AG', tag: 'W3' },
          { idx: 3, start: 24, dur: 4, op: 'AG', tag: 'W4' },
        ],
      },
    },
  },
  tp: {
    title: 'Tensor Parallelism — Within-Layer Staircase',
    blurb:
      "TP cannot overlap between layers — the next layer's input is this layer's reduced output. The overlap lives inside the layer: each matmul partial runs while the previous partial reduce-scatters.",
    lanes: [
      { id: 'compute', label: 'compute' },
      { id: 'comm', label: 'reduce-scatter' },
    ],
    duration: 16,
    modes: {
      default: {
        compute: [
          { idx: 0, start: 0, dur: 3, op: 'matmul', tag: 'p1' },
          { idx: 1, start: 3, dur: 3, op: 'matmul', tag: 'p2' },
          { idx: 2, start: 6, dur: 3, op: 'matmul', tag: 'p3' },
          { idx: 3, start: 9, dur: 3, op: 'matmul', tag: 'p4' },
        ],
        comm: [
          { idx: 0, start: 3, dur: 3, op: 'RS', tag: '1' },
          { idx: 1, start: 6, dur: 3, op: 'RS', tag: '2' },
          { idx: 2, start: 9, dur: 3, op: 'RS', tag: '3' },
          { idx: 3, start: 12, dur: 3, op: 'RS', tag: '4' },
        ],
      },
    },
  },
};

const PAD_LEFT = 110;
const PAD_RIGHT = 24;
const PAD_TOP = 36;
const PAD_BOTTOM = 16;
const LANE_HEIGHT = 56;
const LANE_GAP = 14;
const BLOCK_HEIGHT = 38;

function isCommOp(op) {
  return op === 'AG' || op === 'RS' || op === 'AR';
}

function Block({ block, x, y, width }) {
  const color = LAYER_COLORS[block.idx % LAYER_COLORS.length];
  const comm = isCommOp(block.op);
  const labelW = Math.max(width - 12, 0);
  const showLabel = labelW > 36;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={BLOCK_HEIGHT}
        rx={6}
        fill={color}
        fillOpacity={comm ? 0.14 : 0.95}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray={comm ? '4 3' : 'none'}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + BLOCK_HEIGHT / 2 + 4}
          textAnchor="middle"
          fontSize={11}
          fontFamily="ui-monospace, SFMono-Regular, monospace"
          fill={comm ? color : '#ffffff'}
          fontWeight={600}
        >
          {`${block.op} ${block.tag}`}
        </text>
      )}
    </g>
  );
}

function Lane({ label, blocks, y, scale }) {
  return (
    <g>
      <text
        x={PAD_LEFT - 14}
        y={y + BLOCK_HEIGHT / 2 + 4}
        textAnchor="end"
        fontSize={11}
        fill={INK_SOFT}
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight={500}
      >
        {label}
      </text>
      <line
        x1={PAD_LEFT}
        y1={y + BLOCK_HEIGHT / 2}
        x2={PAD_LEFT - 6}
        y2={y + BLOCK_HEIGHT / 2}
        stroke="rgba(31, 41, 55, 0.2)"
        strokeWidth={1}
      />
      {blocks.map((b, i) => (
        <Block key={i} block={b} x={PAD_LEFT + b.start * scale} y={y} width={b.dur * scale} />
      ))}
    </g>
  );
}

function modeButtonStyle(active) {
  return {
    padding: '6px 14px',
    borderRadius: 6,
    background: active ? 'rgba(37, 99, 235, 0.18)' : 'rgba(255, 255, 255, 0.35)',
    color: active ? '#1e40af' : INK_SOFT,
    border: `1px solid ${active ? 'rgba(37, 99, 235, 0.45)' : CARD_BORDER}`,
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 500,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    transition: 'background 180ms ease, color 180ms ease, border 180ms ease',
  };
}

export default function OverlapTimeline({ strategy = 'fsdp', width = 760 }) {
  const schema = SCHEMAS[strategy] ?? SCHEMAS.fsdp;
  const modeKeys = Object.keys(schema.modes);
  const initialMode = modeKeys.includes('overlapped') ? 'overlapped' : modeKeys[0];
  const [mode, setMode] = useState(initialMode);

  const active = schema.modes[mode];
  const duration = active.duration ?? schema.duration;

  const numLanes = schema.lanes.length;
  const height =
    PAD_TOP +
    numLanes * LANE_HEIGHT +
    (numLanes - 1) * LANE_GAP +
    PAD_BOTTOM;
  const innerWidth = width - PAD_LEFT - PAD_RIGHT;
  const scale = innerWidth / duration;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '20px 16px',
        borderRadius: 16,
        background: 'rgba(255, 255, 255, 0.18)',
        border: `1px solid ${CARD_BORDER}`,
        margin: '28px 0',
        color: INK,
      }}
    >
      <div style={{ textAlign: 'center', fontSize: 13, color: INK }}>
        <strong style={{ letterSpacing: '0.02em' }}>{schema.title}</strong>
        <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6, lineHeight: 1.5 }}>
          {schema.blurb}
        </div>
      </div>

      {schema.toggleable && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {modeKeys.map((key) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              style={modeButtonStyle(mode === key)}
            >
              {schema.modes[key].label ?? key}
            </button>
          ))}
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ display: 'block', overflow: 'visible' }}
        role="img"
        aria-label={`${schema.title} timeline`}
      >
        <line
          x1={PAD_LEFT}
          y1={PAD_TOP - 12}
          x2={PAD_LEFT + innerWidth}
          y2={PAD_TOP - 12}
          stroke="rgba(31, 41, 55, 0.18)"
          strokeWidth={1}
        />
        <text
          x={PAD_LEFT + innerWidth}
          y={PAD_TOP - 18}
          textAnchor="end"
          fontSize={10}
          fill={INK_SOFT}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          time →
        </text>

        {schema.lanes.map((lane, i) => {
          const y = PAD_TOP + i * (LANE_HEIGHT + LANE_GAP) + (LANE_HEIGHT - BLOCK_HEIGHT) / 2;
          return (
            <Lane
              key={lane.id}
              label={lane.label}
              blocks={active[lane.id] ?? []}
              y={y}
              scale={scale}
            />
          );
        })}
      </svg>

      {active.warn && (
        <div
          style={{
            fontSize: 12,
            color: '#92400e',
            textAlign: 'center',
            padding: '6px 12px',
            borderRadius: 6,
            background: 'rgba(234, 179, 8, 0.18)',
            border: '1px solid rgba(234, 179, 8, 0.4)',
          }}
        >
          {active.warn}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 18,
          justifyContent: 'center',
          fontSize: 11,
          color: INK_SOFT,
          flexWrap: 'wrap',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 16,
              height: 10,
              background: LAYER_COLORS[0],
              borderRadius: 2,
            }}
          />
          compute
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 16,
              height: 10,
              background: 'transparent',
              border: `1.5px dashed ${LAYER_COLORS[0]}`,
              borderRadius: 2,
            }}
          />
          communication
        </span>
      </div>
    </div>
  );
}
