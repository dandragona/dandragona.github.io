import { useState } from 'react';
import {
  DEVICE_COLORS,
  COPY_COLOR,
  EMPTY_COLOR,
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

// One matmul on two devices: X @ W = Y, or the weight gradient Xᵀ @ ∂Y = ∂W.
// A tensor is drawn in full on each device; a colored cell is held there and an
// empty one is held elsewhere.

const T = 4;
const E = 2;
const DEVICES = [0, 1];
const GAP = 2;
const SYMBOL_WIDTH = 22;
const DEVICE_GAP = 28;
// Wider matmuls tighten the spacing on narrow screens before shrinking cells.
const COMPACT_SYMBOL_WIDTH = 16;
const COMPACT_DEVICE_GAP = 20;
const MIN_CELL = 14;
const HEADER_HEIGHT = 22;
const LABEL_HEIGHT = 22;

const COPY_ITEM = { fill: COPY_COLOR, label: 'copy on every device' };
const ELSEWHERE_ITEM = { fill: EMPTY_COLOR, label: 'on the other device' };
const PARTIAL_ITEM = { fill: DEVICE_COLORS[0], hatched: true, label: 'partial sum' };

const FORWARD = [
  { name: 'X', rows: T, cols: E },
  { name: 'W', rows: E, cols: E },
  { name: 'Y', rows: T, cols: E },
];

const GRADIENT = [
  {
    name: 'Xt',
    label: (
      <>
        X
        <tspan dy="-5" style={{ fontSize: '9px' }}>
          T
        </tspan>
      </>
    ),
    rows: E,
    cols: T,
  },
  { name: 'dY', label: '∂Y', rows: T, cols: E },
  { name: 'dW', label: '∂W', rows: E, cols: E },
];

const rowOwner = (r) => Math.floor((r * DEVICES.length) / T);

function allCells(tensor, rows, cols, build) {
  return Array.from({ length: rows * cols }, (_, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    return { tensor, r, c, ...build(r, c) };
  });
}

function ownedRows(tensor, d) {
  return allCells(tensor, T, E, (r, c) => ({
    key: `${tensor}-${d}-${r}-${c}`,
    device: d,
    fill: DEVICE_COLORS[d],
  })).filter((cell) => rowOwner(cell.r) === d);
}

const STRATEGIES = {
  dp: {
    label: 'Data parallelism on two devices',
    legend: [COPY_ITEM, ELSEWHERE_ITEM],
    lines: [],
    cells: () =>
      DEVICES.flatMap((d) => [
        ...ownedRows('X', d),
        ...allCells('W', E, E, (r, c) => ({ key: `W-${d}-${r}-${c}`, device: d, fill: COPY_COLOR })),
        ...ownedRows('Y', d),
      ]),
  },
  fsdp: {
    label: 'FSDP on two devices',
    legend: [ELSEWHERE_ITEM],
    lines: [
      'Each device holds its rows of X and one row of W.',
      'All-gather: each device receives the rest of W.',
      'Each device runs the matmul on its rows.',
      'Each device frees the row of W it received.',
    ],
    cells: (step) =>
      DEVICES.flatMap((d) => {
        const other = 1 - d;
        return [
          ...ownedRows('X', d),
          ...allCells('W', 1, E, (_r, c) => ({
            key: `W-${d}-${c}`,
            device: d,
            r: d,
            fill: DEVICE_COLORS[d],
          })),
          // A received row starts under the sender's copy, then travels here.
          ...allCells('W', 1, E, (_r, c) => ({
            key: `W-copy-${d}-${c}`,
            device: step === 0 ? other : d,
            r: other,
            fill: DEVICE_COLORS[other],
            opacity: step === 1 || step === 2 ? 1 : 0,
          })),
          ...ownedRows('Y', d).map((cell) => ({ ...cell, opacity: step >= 2 ? 1 : 0 })),
        ];
      }),
  },
  'tp-col': {
    label: 'Column-parallel tensor parallelism on two devices',
    legend: [COPY_ITEM, ELSEWHERE_ITEM],
    lines: [
      'Every device has all of X and its own column of W.',
      'Each device computes its own column of Y. Nothing moves.',
    ],
    cells: (step) =>
      DEVICES.flatMap((d) => [
        ...allCells('X', T, E, (r, c) => ({ key: `X-${d}-${r}-${c}`, device: d, fill: COPY_COLOR })),
        ...allCells('W', E, 1, (r) => ({ key: `W-${d}-${r}`, device: d, c: d, fill: DEVICE_COLORS[d] })),
        ...allCells('Y', T, 1, (r) => ({
          key: `Y-${d}-${r}`,
          device: d,
          c: d,
          fill: DEVICE_COLORS[d],
          opacity: step >= 1 ? 1 : 0,
        })),
      ]),
  },
  'tp-row': {
    label: 'Row-parallel tensor parallelism on two devices',
    legend: [PARTIAL_ITEM, ELSEWHERE_ITEM],
    lines: [
      'Each device has one column of X and one row of W.',
      'Each device computes a full-sized Y, but it is only a partial sum.',
      'Reduce-scatter: each device sends the rows it doesn’t keep and adds the rows it receives. Each device ends with half of the rows of Y, finished.',
    ],
    cells: (step) =>
      DEVICES.flatMap((d) => [
        ...allCells('X', T, 1, (r) => ({ key: `X-${d}-${r}`, device: d, c: d, fill: DEVICE_COLORS[d] })),
        ...allCells('W', 1, E, (_r, c) => ({ key: `W-${d}-${c}`, device: d, r: d, fill: DEVICE_COLORS[d] })),
        ...allCells('Y', T, E, (r, c) => {
          const kept = rowOwner(r) === d;
          return {
            key: `Y-${d}-${r}-${c}`,
            // A row this device doesn't keep travels to the device that does.
            device: step === 2 ? rowOwner(r) : d,
            fill: DEVICE_COLORS[d],
            hatched: step === 1 || !kept,
            opacity: step === 0 || (step === 2 && !kept) ? 0 : 1,
            arriving: step === 2 && !kept,
            late: step === 2 && kept,
          };
        }),
      ]),
  },
  // Data parallelism and FSDP compute the same partial ∂W. FSDP stops after the
  // reduce-scatter; data parallelism's all-reduce adds an all-gather.
  'fsdp-grad': {
    label: 'The weight gradient on two devices, reduced by FSDP or by data parallelism',
    tensors: GRADIENT,
    legend: [PARTIAL_ITEM, ELSEWHERE_ITEM],
    modes: [
      {
        value: 'fsdp',
        label: 'FSDP',
        lines: [
          'Each device has ∂Y for its own token rows, and the matching columns of Xᵀ.',
          'Each device computes a full-sized ∂W, but it is only a partial sum over its own rows.',
          'Reduce-scatter: each device sends the row of ∂W it doesn’t keep and adds the row it receives. Each device ends with the finished row of ∂W that matches its row of W.',
        ],
      },
      {
        value: 'dp',
        label: 'Data parallelism',
        lines: [
          'Each device has ∂Y for its own token rows, and the matching columns of Xᵀ.',
          'Each device computes a full-sized ∂W, but it is only a partial sum over its own rows.',
          'Reduce-scatter: each device sends the row of ∂W it doesn’t keep and adds the row it receives. Each device has one finished row.',
          'All-gather: each device sends its finished row to the other. Every device ends with all of ∂W, to update all of W.',
        ],
      },
    ],
    cells: (step) =>
      DEVICES.flatMap((d) => [
        ...allCells('Xt', E, T, () => ({ device: d, fill: DEVICE_COLORS[d] }))
          .filter((cell) => rowOwner(cell.c) === d)
          .map((cell) => ({ ...cell, key: `Xt-${d}-${cell.r}-${cell.c}` })),
        ...ownedRows('dY', d),
        ...allCells('dW', E, E, (r, c) => {
          // Device r keeps row r, the row that matches its row of W.
          const kept = r === d;
          const sent = step >= 2 && !kept;
          return {
            key: `dW-${d}-${r}-${c}`,
            device: sent ? r : d,
            fill: DEVICE_COLORS[d],
            hatched: step === 1 || !kept,
            opacity: step === 0 || sent ? 0 : 1,
            arriving: sent,
            late: step === 2 && kept,
          };
        }),
        // All-gather: a copy of this device's finished row starts under it, then
        // travels to the other device.
        ...allCells('dW', 1, E, (_r, c) => ({
          key: `dW-copy-${d}-${c}`,
          device: step === 3 ? 1 - d : d,
          r: d,
          fill: DEVICE_COLORS[d],
          opacity: step === 3 ? 1 : 0,
        })),
      ]),
  },
};

function measure(width, tensors) {
  const cols = tensors.reduce((sum, tensor) => sum + tensor.cols, 0);
  const fit = (symbolWidth, deviceGap) =>
    Math.floor(((width - deviceGap) / 2 - 2 * symbolWidth + tensors.length * GAP) / cols - GAP);
  const compact = fit(SYMBOL_WIDTH, DEVICE_GAP) < MIN_CELL;
  const symbolWidth = compact ? COMPACT_SYMBOL_WIDTH : SYMBOL_WIDTH;
  const deviceGap = compact ? COMPACT_DEVICE_GAP : DEVICE_GAP;
  const size = Math.max(10, Math.min(24, fit(symbolWidth, deviceGap)));
  const pitch = size + GAP;
  const span = (n) => n * pitch - GAP;
  const tallHeight = span(Math.max(...tensors.map((tensor) => tensor.rows)));
  const tensorX = {};
  const tensorY = {};
  const tensorWidth = {};
  let x = 0;
  for (const tensor of tensors) {
    tensorX[tensor.name] = x;
    tensorWidth[tensor.name] = span(tensor.cols);
    // Shorter tensors are centered on the tallest one.
    tensorY[tensor.name] = HEADER_HEIGHT + (tallHeight - span(tensor.rows)) / 2;
    x += span(tensor.cols) + symbolWidth;
  }
  const deviceWidth = x - symbolWidth;
  const left = Math.max(0, (width - 2 * deviceWidth - deviceGap) / 2);
  const deviceX = (d) => left + d * (deviceWidth + deviceGap);
  return {
    size,
    symbolWidth,
    tallHeight,
    deviceWidth,
    tensorX,
    tensorWidth,
    deviceX,
    height: HEADER_HEIGHT + tallHeight + LABEL_HEIGHT,
    cellX: (device, tensor, c) => deviceX(device) + tensorX[tensor] + c * pitch,
    cellY: (tensor, r) => tensorY[tensor] + r * pitch,
  };
}

function DeviceFrame({ device, tensors, m }) {
  const x = m.deviceX(device);
  const symbolY = HEADER_HEIGHT + m.tallHeight / 2 + 5;
  return (
    <g>
      <text x={x + m.deviceWidth / 2} y={13} textAnchor="middle">
        Device {device}
      </text>
      {tensors.flatMap((tensor) =>
        Array.from({ length: tensor.rows * tensor.cols }, (_, i) => (
          <Slot
            key={`${tensor.name}-${i}`}
            x={m.cellX(device, tensor.name, i % tensor.cols)}
            y={m.cellY(tensor.name, Math.floor(i / tensor.cols))}
            size={m.size}
          />
        )),
      )}
      {tensors.map((tensor) => (
        <text
          key={tensor.name}
          x={x + m.tensorX[tensor.name] + m.tensorWidth[tensor.name] / 2}
          y={HEADER_HEIGHT + m.tallHeight + 17}
          textAnchor="middle"
        >
          {tensor.label ?? tensor.name}
        </text>
      ))}
      {['@', '='].map((symbol, i) => (
        <text
          key={symbol}
          className="pd-symbol"
          x={x + m.tensorX[tensors[i + 1].name] - m.symbolWidth / 2}
          y={symbolY}
          textAnchor="middle"
        >
          {symbol}
        </text>
      ))}
    </g>
  );
}

export default function ShardingStage({ strategy = 'dp' }) {
  const config = STRATEGIES[strategy];
  const tensors = config.tensors ?? FORWARD;
  const [mode, setMode] = useState(config.modes?.[0].value);
  const [step, setStep] = useState(0);
  const { ref, width, animated } = useFigureWidth();
  const m = measure(width, tensors);
  const cells = config.cells(step);
  const linesFor = (value) => (config.modes ? config.modes.find((option) => option.value === value).lines : config.lines);
  const lines = linesFor(mode);
  const reserve = config.modes ? config.modes.filter((option) => option.value !== mode).flatMap((option) => option.lines) : [];
  // A mode with fewer steps ends on its last step.
  const changeMode = (value) => {
    setMode(value);
    setStep((current) => Math.min(current, linesFor(value).length - 1));
  };

  return (
    <Figure figureRef={ref} animated={animated}>
      {config.modes && (
        <Toggle
          label="Method"
          options={config.modes.map(({ value, label }) => ({ value, label }))}
          value={mode}
          onChange={changeMode}
        />
      )}
      <DiagramSvg width={width} height={m.height} label={config.label}>
        {DEVICES.map((d) => (
          <DeviceFrame key={d} device={d} tensors={tensors} m={m} />
        ))}
        {cells.map((cell) => (
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
          />
        ))}
      </DiagramSvg>
      <Legend items={config.legend} />
      {lines.length > 0 && (
        <>
          <StepLine lines={lines} step={step} reserve={reserve} />
          <StepControls step={step} total={lines.length} onStep={setStep} />
        </>
      )}
    </Figure>
  );
}
