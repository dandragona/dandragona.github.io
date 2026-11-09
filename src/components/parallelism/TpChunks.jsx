import { useState } from 'react';
import {
  DEVICE_COLORS,
  COPY_COLOR,
  EMPTY_COLOR,
  INK,
  useFigureWidth,
  Figure,
  DiagramSvg,
  Slot,
  Cell,
  StepLine,
  StepControls,
  Legend,
  Toggle,
} from './diagram-kit.jsx';
import {
  COMPUTE_FILL,
  TRANSFER_FILL,
  TRANSFER_STROKE,
  LABEL_WIDTH,
  RIGHT_PAD,
  AXIS_HEIGHT,
  LANE_HEIGHT,
  BLOCK_HEIGHT,
  compute,
  transfer,
  Block,
  EndMarker,
} from './Timeline.jsx';

// The row-parallel layer of a pair, H @ W₂ = Y, on two devices, with one
// device's timeline below. With chunks, each device computes one row of Y at a
// time and all-reduces it while the next row computes. Every device has all T
// rows of H, so the chunks are a split of each device's own work, not of the
// data across devices.

const T = 4;
const E = 2;
const DEVICES = [0, 1];
const GAP = 2;
const SYMBOL_WIDTH = 22;
const DEVICE_GAP = 28;
const COMPACT_SYMBOL_WIDTH = 16;
const COMPACT_DEVICE_GAP = 20;
const MIN_CELL = 14;
const HEADER_HEIGHT = 22;
const LABEL_HEIGHT = 22;
const TIMELINE_GAP = 8;
// A chunk's matmul and its all-reduce each take one unit. Both modes share
// one time axis, so their end markers can be compared.
const UNITS = 2 * T;

const TENSORS = [
  { name: 'H', rows: T },
  { name: 'W₂', rows: E },
  { name: 'Y', rows: T },
];

const LANES = [
  { id: 'c', label: 'compute' },
  { id: 'n', label: 'network' },
];

const MODES = [
  {
    value: 'chunks',
    label: 'With chunks',
    lines: [
      'Each device has one column of H, for all four token rows. Each row of Y needs only the same row of H, so a device can compute its rows in chunks. Here each row is one chunk.',
      'Chunk 1: each device computes its partial sum for row 1 of Y.',
      'Chunk 2 computes while chunk 1’s all-reduce runs. Row 1 of Y is now finished on every device.',
      'Chunk 3 computes while chunk 2’s all-reduce runs.',
      'Chunk 4 computes while chunk 3’s all-reduce runs.',
      'Only chunk 4’s all-reduce has no computation to overlap with, so the layer ends much sooner than without chunks.',
    ],
  },
  {
    value: 'whole',
    label: 'Without chunks',
    lines: [
      'Each device has one column of H and one row of W₂, as in a row-parallel layer.',
      'Each device computes its partial sum for all of Y. The network is idle.',
      'Then the all-reduce runs, and computation waits for it, because the next layer needs Y.',
    ],
  },
];

// What has happened to row r of Y by this step.
function rowState(mode, step, r) {
  if (mode === 'whole') return { computed: step >= 1, reduced: step >= 2, reducing: step === 2 };
  return { computed: step >= r + 1, reduced: step >= r + 2, reducing: step === r + 2 };
}

const lastStep = (mode) => MODES.find((option) => option.value === mode).lines.length - 1;

function blocksFor(mode, step) {
  const chunked = mode === 'chunks';
  return [
    ...Array.from({ length: T }, (_, k) => ({
      ...compute(`c${k}`, 'c', `chunk ${k + 1}`, `${k + 1}`, k, 1),
      shown: chunked && step >= k + 1,
    })),
    ...Array.from({ length: T }, (_, k) => ({
      ...transfer(`n${k}`, 'n', `chunk ${k + 1}`, `${k + 1}`, k + 1, 1),
      shown: chunked && step >= k + 2,
    })),
    { ...compute('whole-c', 'c', 'whole matmul', 'matmul', 0, T), shown: !chunked && step >= 1 },
    { ...transfer('whole-n', 'n', 'all-reduce', '', T, T), shown: !chunked && step >= 2 },
  ];
}

function cellsFor(mode, step) {
  return DEVICES.flatMap((d) => {
    const other = 1 - d;
    return [
      ...Array.from({ length: T }, (_, r) => ({
        key: `H-${d}-${r}`,
        tensor: 'H',
        device: d,
        r,
        c: d,
        fill: DEVICE_COLORS[d],
        label: mode === 'chunks' ? `${r + 1}` : undefined,
      })),
      ...Array.from({ length: E }, (_, c) => ({
        key: `W-${d}-${c}`,
        tensor: 'W₂',
        device: d,
        r: d,
        c,
        fill: DEVICE_COLORS[d],
      })),
      ...Array.from({ length: T * E }, (_, i) => {
        const r = Math.floor(i / E);
        const c = i % E;
        const { computed, reduced, reducing } = rowState(mode, step, r);
        // This device's partial sum. It becomes the finished row when the
        // other device's partial sum lands.
        return {
          key: `Y-${mode}-${d}-${r}-${c}`,
          tensor: 'Y',
          device: d,
          r,
          c,
          fill: reduced ? COPY_COLOR : DEVICE_COLORS[d],
          hatched: computed && !reduced,
          opacity: computed ? 1 : 0,
          late: reducing,
        };
      }),
      // A copy of the other device's partial sum, which travels here and is added in.
      ...Array.from({ length: T * E }, (_, i) => {
        const r = Math.floor(i / E);
        const c = i % E;
        const { computed, reduced } = rowState(mode, step, r);
        return {
          key: `Y-from-${mode}-${other}-${d}-${r}-${c}`,
          tensor: 'Y',
          device: reduced ? d : other,
          r,
          c,
          fill: DEVICE_COLORS[other],
          hatched: true,
          opacity: computed && !reduced ? 1 : 0,
          arriving: reduced,
        };
      }),
    ];
  });
}

function measure(width) {
  const fit = (symbolWidth, deviceGap) => Math.floor((width - 6 * GAP - 4 * symbolWidth - deviceGap) / 12);
  // Narrow screens tighten the spacing before shrinking cells.
  const compact = fit(SYMBOL_WIDTH, DEVICE_GAP) < MIN_CELL;
  const symbolWidth = compact ? COMPACT_SYMBOL_WIDTH : SYMBOL_WIDTH;
  const deviceGap = compact ? COMPACT_DEVICE_GAP : DEVICE_GAP;
  const size = Math.max(10, Math.min(24, fit(symbolWidth, deviceGap)));
  const pitch = size + GAP;
  const tensorWidth = E * pitch - GAP;
  const tallHeight = T * pitch - GAP;
  const deviceWidth = 3 * tensorWidth + 2 * symbolWidth;
  const left = Math.max(0, (width - 2 * deviceWidth - deviceGap) / 2);
  const deviceX = (d) => left + d * (deviceWidth + deviceGap);
  const tensorX = (i) => i * (tensorWidth + symbolWidth);
  const tensorIndex = Object.fromEntries(TENSORS.map((tensor, i) => [tensor.name, i]));
  const offsetY = (rows) => (tallHeight - (rows * pitch - GAP)) / 2;
  const axisTop = HEADER_HEIGHT + tallHeight + LABEL_HEIGHT + TIMELINE_GAP;
  const laneY = { c: axisTop + AXIS_HEIGHT, n: axisTop + AXIS_HEIGHT + LANE_HEIGHT };
  return {
    size,
    pitch,
    symbolWidth,
    tensorWidth,
    tallHeight,
    deviceWidth,
    deviceX,
    tensorX,
    axisTop,
    laneY,
    height: laneY.n + LANE_HEIGHT + 4,
    scale: (width - LABEL_WIDTH - RIGHT_PAD) / UNITS,
    cellX: (device, tensor, c) => deviceX(device) + tensorX(tensorIndex[tensor]) + c * pitch,
    cellY: (tensor, r) => HEADER_HEIGHT + offsetY(TENSORS[tensorIndex[tensor]].rows) + r * pitch,
  };
}

function DeviceFrame({ device, m }) {
  const x = m.deviceX(device);
  const symbolY = HEADER_HEIGHT + m.tallHeight / 2 + 5;
  return (
    <g>
      <text x={x + m.deviceWidth / 2} y={13} textAnchor="middle">
        Device {device}
      </text>
      {TENSORS.flatMap((tensor) =>
        Array.from({ length: tensor.rows * E }, (_, i) => (
          <Slot
            key={`${tensor.name}-${i}`}
            x={m.cellX(device, tensor.name, i % E)}
            y={m.cellY(tensor.name, Math.floor(i / E))}
            size={m.size}
          />
        )),
      )}
      {TENSORS.map((tensor, i) => (
        <text
          key={tensor.name}
          x={x + m.tensorX(i) + m.tensorWidth / 2}
          y={HEADER_HEIGHT + m.tallHeight + 17}
          textAnchor="middle"
        >
          {tensor.name}
        </text>
      ))}
      {['@', '='].map((symbol, i) => (
        <text
          key={symbol}
          className="pd-symbol"
          x={x + m.tensorX(i + 1) - m.symbolWidth / 2}
          y={symbolY}
          textAnchor="middle"
        >
          {symbol}
        </text>
      ))}
    </g>
  );
}

// Outlines the rows of H and Y in the chunk being computed. They slide down a
// row each step.
function CurrentChunk({ mode, step, m }) {
  const computing = mode === 'chunks' && step >= 1 && step <= T;
  const row = computing ? step - 1 : Math.min(Math.max(step - 1, 0), T - 1);
  const pad = GAP / 2;
  return DEVICES.flatMap((d) =>
    ['H', 'Y'].map((tensor) => (
      <g
        key={`${tensor}-${d}`}
        className="pd-cell"
        style={{
          transform: `translate(${m.cellX(d, tensor, 0) - pad}px, ${m.cellY(tensor, row) - pad}px)`,
          opacity: computing ? 1 : 0,
        }}
      >
        <rect
          width={m.tensorWidth + 2 * pad}
          height={m.size + 2 * pad}
          rx={4}
          fill="none"
          stroke={INK}
          strokeWidth={2}
        />
      </g>
    )),
  );
}

function Lanes({ width, m }) {
  return (
    <g>
      <text x={width - RIGHT_PAD} y={m.axisTop + 13} textAnchor="end">
        time →
      </text>
      <line x1={LABEL_WIDTH} x2={width - RIGHT_PAD} y1={m.axisTop + 18} y2={m.axisTop + 18} stroke="rgba(41, 37, 36, 0.3)" />
      {LANES.map((lane) => (
        <g key={lane.id}>
          <rect
            x={LABEL_WIDTH}
            y={m.laneY[lane.id] + 3}
            width={width - LABEL_WIDTH - RIGHT_PAD}
            height={BLOCK_HEIGHT}
            rx={4}
            fill="rgba(41, 37, 36, 0.06)"
          />
          <text x={LABEL_WIDTH - 8} y={m.laneY[lane.id] + 3 + BLOCK_HEIGHT / 2 + 4} textAnchor="end">
            {lane.label}
          </text>
        </g>
      ))}
    </g>
  );
}

export default function TpChunks() {
  const [mode, setMode] = useState(MODES[0].value);
  const [step, setStep] = useState(0);
  const { ref, width, animated } = useFigureWidth();
  const m = measure(width);
  const lines = MODES.find((option) => option.value === mode).lines;
  const reserve = MODES.filter((option) => option.value !== mode).flatMap((option) => option.lines);
  const end = mode === 'chunks' ? T + 1 : UNITS;
  // A mode with fewer steps ends on its last step.
  const changeMode = (value) => {
    setMode(value);
    setStep((current) => Math.min(current, lastStep(value)));
  };

  return (
    <Figure figureRef={ref} animated={animated}>
      <Toggle
        label="Chunks"
        options={MODES.map(({ value, label }) => ({ value, label }))}
        value={mode}
        onChange={changeMode}
      />
      <DiagramSvg width={width} height={m.height} label="Row-parallel layer computed with and without chunks of rows, with one device's timeline">
        {DEVICES.map((d) => (
          <DeviceFrame key={d} device={d} m={m} />
        ))}
        {cellsFor(mode, step).map((cell) => (
          <Cell
            key={cell.key}
            x={m.cellX(cell.device, cell.tensor, cell.c)}
            y={m.cellY(cell.tensor, cell.r)}
            size={m.size}
            fill={cell.fill}
            hatched={cell.hatched}
            opacity={cell.opacity}
            arriving={cell.arriving}
            late={cell.late}
            label={cell.label}
          />
        ))}
        <CurrentChunk mode={mode} step={step} m={m} />
        <Lanes width={width} m={m} />
        {blocksFor(mode, step).map((block) => (
          <Block key={block.key} block={block} step={step} x0={LABEL_WIDTH} scale={m.scale} laneY={m.laneY} />
        ))}
        <EndMarker
          x={LABEL_WIDTH + end * m.scale}
          top={m.laneY.c - 2}
          bottom={m.laneY.n + LANE_HEIGHT + 2}
          visible={step === lastStep(mode)}
        />
      </DiagramSvg>
      <Legend
        items={[
          { fill: COPY_COLOR, label: 'copy on every device' },
          { fill: DEVICE_COLORS[0], hatched: true, label: 'partial sum' },
          { fill: EMPTY_COLOR, label: 'on the other device' },
          { fill: COMPUTE_FILL, label: 'compute' },
          { fill: TRANSFER_FILL, stroke: TRANSFER_STROKE, label: 'all-reduce' },
        ]}
      />
      <StepLine lines={lines} step={step} reserve={reserve} />
      <StepControls step={step} total={lines.length} onStep={setStep} />
    </Figure>
  );
}
