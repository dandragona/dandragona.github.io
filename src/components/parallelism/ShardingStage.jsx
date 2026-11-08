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
} from './diagram-kit.jsx';

// One matmul, X @ W = Y, on two devices. A tensor is drawn in full on each
// device; a colored cell is held there and an empty one is held elsewhere.

const T = 4;
const E = 2;
const DEVICES = [0, 1];
const GAP = 2;
const SYMBOL_WIDTH = 22;
const DEVICE_GAP = 28;
const HEADER_HEIGHT = 22;
const LABEL_HEIGHT = 22;

const COPY_ITEM = { fill: COPY_COLOR, label: 'copy on every device' };
const ELSEWHERE_ITEM = { fill: EMPTY_COLOR, label: 'on the other device' };
const PARTIAL_ITEM = { fill: DEVICE_COLORS[0], hatched: true, label: 'partial sum' };

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
};

function measure(width) {
  const room = width - 6 * GAP - 4 * SYMBOL_WIDTH - DEVICE_GAP;
  const size = Math.max(13, Math.min(24, Math.floor(room / 12)));
  const pitch = size + GAP;
  const tensorWidth = E * pitch - GAP;
  const tallHeight = T * pitch - GAP;
  const shortHeight = E * pitch - GAP;
  const deviceWidth = 3 * tensorWidth + 2 * SYMBOL_WIDTH;
  const left = Math.max(0, (width - 2 * deviceWidth - DEVICE_GAP) / 2);
  const tensorX = { X: 0, W: tensorWidth + SYMBOL_WIDTH, Y: 2 * (tensorWidth + SYMBOL_WIDTH) };
  const tensorY = {
    X: HEADER_HEIGHT,
    W: HEADER_HEIGHT + (tallHeight - shortHeight) / 2,
    Y: HEADER_HEIGHT,
  };
  const deviceX = (d) => left + d * (deviceWidth + DEVICE_GAP);
  return {
    size,
    tensorWidth,
    tallHeight,
    deviceWidth,
    tensorX,
    deviceX,
    height: HEADER_HEIGHT + tallHeight + LABEL_HEIGHT,
    cellX: (device, tensor, c) => deviceX(device) + tensorX[tensor] + c * pitch,
    cellY: (tensor, r) => tensorY[tensor] + r * pitch,
  };
}

function DeviceFrame({ device, m }) {
  const slots = [
    ['X', T],
    ['W', E],
    ['Y', T],
  ];
  const x = m.deviceX(device);
  const symbolY = HEADER_HEIGHT + m.tallHeight / 2 + 5;
  return (
    <g>
      <text x={x + m.deviceWidth / 2} y={13} textAnchor="middle">
        Device {device}
      </text>
      {slots.flatMap(([tensor, rows]) =>
        Array.from({ length: rows * E }, (_, i) => (
          <Slot
            key={`${tensor}-${i}`}
            x={m.cellX(device, tensor, i % E)}
            y={m.cellY(tensor, Math.floor(i / E))}
            size={m.size}
          />
        )),
      )}
      {slots.map(([tensor]) => (
        <text
          key={tensor}
          x={x + m.tensorX[tensor] + m.tensorWidth / 2}
          y={HEADER_HEIGHT + m.tallHeight + 17}
          textAnchor="middle"
        >
          {tensor}
        </text>
      ))}
      <text className="pd-symbol" x={x + m.tensorX.W - SYMBOL_WIDTH / 2} y={symbolY} textAnchor="middle">
        @
      </text>
      <text className="pd-symbol" x={x + m.tensorX.Y - SYMBOL_WIDTH / 2} y={symbolY} textAnchor="middle">
        =
      </text>
    </g>
  );
}

export default function ShardingStage({ strategy = 'dp' }) {
  const config = STRATEGIES[strategy];
  const [step, setStep] = useState(0);
  const { ref, width, animated } = useFigureWidth();
  const m = measure(width);
  const cells = config.cells(step);

  return (
    <Figure figureRef={ref} animated={animated}>
      <DiagramSvg width={width} height={m.height} label={config.label}>
        {DEVICES.map((d) => (
          <DeviceFrame key={d} device={d} m={m} />
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
      {config.lines.length > 0 && (
        <>
          <StepLine lines={config.lines} step={step} />
          <StepControls step={step} total={config.lines.length} onStep={setStep} />
        </>
      )}
    </Figure>
  );
}
