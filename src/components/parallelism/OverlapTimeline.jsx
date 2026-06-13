import { useState } from 'react';
import { WidgetShell, StepControls, Caption } from './staircase-shared.jsx';

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
    stepped: true,
    modes: {
      default: {
        compute: [
          { idx: 3, start: 0, dur: 4, op: '', tag: '∂W4', label: '∂Y3, ∂W4' },
          { idx: 2, start: 4, dur: 4, op: '', tag: '∂W3', label: '∂Y2, ∂W3' },
          { idx: 1, start: 8, dur: 4, op: '', tag: '∂W2', label: '∂Y1, ∂W2' },
          { idx: 0, start: 12, dur: 4, op: '', tag: '∂W1', label: '∂W1' },
        ],
        comm: [
          { idx: 3, start: 4, dur: 3, op: 'AR', tag: '∂W4' },
          { idx: 2, start: 8, dur: 3, op: 'AR', tag: '∂W3' },
          { idx: 1, start: 12, dur: 3, op: 'AR', tag: '∂W2' },
          { idx: 0, start: 16, dur: 3, op: 'AR', tag: '∂W1' },
        ],
        steps: [
          {
            caption: 'Backward pass about to start; no gradients yet.',
            computeTags: [],
            commTags: [],
          },
          {
            caption: 'Layer 4 backward produces ∂Y3 (feeds layer 3) and ∂W4; ∂W4’s all-reduce starts.',
            computeTags: ['∂W4'],
            commTags: ['∂W4'],
          },
          {
            caption: "Layer 3 backward produces ∂Y2 and ∂W3 while ∂W4's all-reduce is still in flight — the first overlap.",
            computeTags: ['∂W4', '∂W3'],
            commTags: ['∂W4', '∂W3'],
          },
          {
            caption: "Layer 2 backward produces ∂Y1 and ∂W2 while ∂W3's all-reduce overlaps it.",
            computeTags: ['∂W4', '∂W3', '∂W2'],
            commTags: ['∂W4', '∂W3', '∂W2'],
          },
          {
            caption:
              'Layer 1 backward produces ∂W1; every ∂W all-reduce hides behind the next layer’s backward — the full staircase.',
            computeTags: ['∂W4', '∂W3', '∂W2', '∂W1'],
            commTags: ['∂W4', '∂W3', '∂W2', '∂W1'],
          },
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
    initialMode: 'naive',
    modes: {
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
    },
  },
  'fsdp-bwd': {
    title: 'FSDP — Backward Pass Overlap',
    blurb:
      "The mirror of forward FSDP, walked in reverse. Per layer: all-gather W, compute ∂W at full shape, reduce-scatter ∂W. The next layer's AG W overlaps the current layer's RS ∂W — the same pipeline, with AG↔RS swapped.",
    lanes: [
      { id: 'compute', label: 'compute' },
      { id: 'comm', label: 'communication' },
    ],
    duration: 27,
    stepped: true,
    modes: {
      default: {
        compute: [
          { idx: 3, start: 3, dur: 3, op: '', tag: 'L4', label: 'L4 backward' },
          { idx: 2, start: 9, dur: 3, op: '', tag: 'L3', label: 'L3 backward' },
          { idx: 1, start: 15, dur: 3, op: '', tag: 'L2', label: 'L2 backward' },
          { idx: 0, start: 21, dur: 3, op: '', tag: 'L1', label: 'L1 backward' },
        ],
        comm: [
          { idx: 3, start: 0, dur: 3, op: 'AG', tag: 'W4' },
          { idx: 3, start: 6, dur: 3, op: 'RS', tag: '∂W4' },
          { idx: 2, start: 6, dur: 3, op: 'AG', tag: 'W3' },
          { idx: 2, start: 12, dur: 3, op: 'RS', tag: '∂W3' },
          { idx: 1, start: 12, dur: 3, op: 'AG', tag: 'W2' },
          { idx: 1, start: 18, dur: 3, op: 'RS', tag: '∂W2' },
          { idx: 0, start: 18, dur: 3, op: 'AG', tag: 'W1' },
          { idx: 0, start: 24, dur: 3, op: 'RS', tag: '∂W1' },
        ],
        steps: [
          {
            caption: 'Forward complete; backward about to start — no gradients yet.',
            computeTags: [],
            commTags: [],
          },
          {
            caption:
              'Layer 4 backward: all-gather W₄, compute ∂W₄ at full shape, reduce-scatter ∂W₄ back to the FSDP shard layout.',
            computeTags: ['L4'],
            commTags: ['W4', '∂W4'],
          },
          {
            caption:
              "Layer 3 starts: AG W₃ overlaps RS ∂W₄ finishing — the first inter-layer overlap, the mirror of forward FSDP's pipeline.",
            computeTags: ['L4', 'L3'],
            commTags: ['W4', '∂W4', 'W3', '∂W3'],
          },
          {
            caption:
              "Layer 2 follows the same pattern: AG W₂ overlaps RS ∂W₃ while L2's backward compute runs.",
            computeTags: ['L4', 'L3', 'L2'],
            commTags: ['W4', '∂W4', 'W3', '∂W3', 'W2', '∂W2'],
          },
          {
            caption:
              "Layer 1 closes the staircase; every layer's AG and RS hide under the next layer's backwards compute.",
            computeTags: ['L4', 'L3', 'L2', 'L1'],
            commTags: ['W4', '∂W4', 'W3', '∂W3', 'W2', '∂W2', 'W1', '∂W1'],
          },
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
          {block.label ?? [block.op, block.tag].filter(Boolean).join(' ')}
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

function TimelineSvg({ schema, lanesData, width, innerWidth, height, scale }) {
  return (
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
            blocks={lanesData[lane.id] ?? []}
            y={y}
            scale={scale}
          />
        );
      })}
    </svg>
  );
}

function Legend() {
  return (
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
  );
}

function SteppedTimeline({ schema, width }) {
  const active = schema.modes.default;
  const steps = active.steps;
  const [step, setStep] = useState(0);
  const frame = steps[step];

  const duration = active.duration ?? schema.duration;
  const numLanes = schema.lanes.length;
  const height =
    PAD_TOP + numLanes * LANE_HEIGHT + (numLanes - 1) * LANE_GAP + PAD_BOTTOM;
  const innerWidth = width - PAD_LEFT - PAD_RIGHT;
  const scale = innerWidth / duration;

  const computeTags = new Set(frame.computeTags);
  const commTags = new Set(frame.commTags);
  const lanesData = {
    compute: (active.compute ?? []).filter((b) => computeTags.has(b.tag)),
    comm: (active.comm ?? []).filter((b) => commTags.has(b.tag)),
  };

  return (
    <WidgetShell title={schema.title} subtitle={schema.blurb}>
      <TimelineSvg
        schema={schema}
        lanesData={lanesData}
        width={width}
        innerWidth={innerWidth}
        height={height}
        scale={scale}
      />
      <Caption>{frame.caption}</Caption>
      <StepControls step={step} totalSteps={steps.length} setStep={setStep} />
      <Legend />
    </WidgetShell>
  );
}

// Supported strategies: 'dp' (stepped), 'fsdp' (static, naive/overlapped toggle),
// 'fsdp-bwd' (stepped), 'tp' (static).
export default function OverlapTimeline({ strategy = 'fsdp', width = 760 }) {
  const schema = SCHEMAS[strategy] ?? SCHEMAS.fsdp;

  if (schema.stepped) {
    return <SteppedTimeline schema={schema} width={width} />;
  }

  return <StaticTimeline schema={schema} width={width} />;
}

function StaticTimeline({ schema, width }) {
  const modeKeys = Object.keys(schema.modes);
  const initialMode =
    schema.initialMode && modeKeys.includes(schema.initialMode)
      ? schema.initialMode
      : modeKeys.includes('overlapped')
      ? 'overlapped'
      : modeKeys[0];
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

      <TimelineSvg
        schema={schema}
        lanesData={active}
        width={width}
        innerWidth={innerWidth}
        height={height}
        scale={scale}
      />

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

      <Legend />
    </div>
  );
}
