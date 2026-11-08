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

// A column-parallel layer followed by a row-parallel layer on two devices:
// X @ W1 → H, then H @ W2 → Y. Each device is one row of the figure.

const T = 4;
const E = 2;
const DEVICES = [0, 1];
const GAP = 2;
const SYMBOL_WIDTH = 24;
const HEADER_HEIGHT = 20;
const LABEL_HEIGHT = 22;
const DEVICE_GAP = 18;

const TENSORS = [
  { name: 'X', rows: T },
  { name: 'W₁', rows: E },
  { name: 'H', rows: T },
  { name: 'W₂', rows: E },
  { name: 'Y', rows: T },
];
const SYMBOLS = ['@', '→', '@', '→'];

const LINES = [
  'Each device has all of X, one column of W₁, and one row of W₂.',
  'Column-parallel layer: each device computes its own column of H. Nothing moves.',
  'Row-parallel layer: each device multiplies its column of H by its row of W₂. The result is a partial sum of Y.',
  'All-reduce: the devices add their partial sums, and each gets all of Y, ready for the next pair.',
];

function grid(tensor, rows, build) {
  return Array.from({ length: rows * E }, (_, i) => {
    const r = Math.floor(i / E);
    const c = i % E;
    return { tensor, r, c, ...build(r, c) };
  });
}

const column = (tensor, rows, c, build) => Array.from({ length: rows }, (_, r) => ({ tensor, r, c, ...build(r) }));
const row = (tensor, r, build) => Array.from({ length: E }, (_, c) => ({ tensor, r, c, ...build(c) }));

function cellsFor(step) {
  return DEVICES.flatMap((d) => {
    const other = 1 - d;
    return [
      ...grid('X', T, (r, c) => ({ key: `X-${d}-${r}-${c}`, device: d, fill: COPY_COLOR })),
      ...column('W₁', E, d, (r) => ({ key: `W1-${d}-${r}`, device: d, fill: DEVICE_COLORS[d] })),
      ...row('W₂', d, (c) => ({ key: `W2-${d}-${c}`, device: d, fill: DEVICE_COLORS[d] })),
      ...column('H', T, d, (r) => ({
        key: `H-${d}-${r}`,
        device: d,
        fill: DEVICE_COLORS[d],
        opacity: step >= 1 ? 1 : 0,
      })),
      // This device's result. It turns into the full Y when the other partial sum lands.
      ...grid('Y', T, (r, c) => ({
        key: `Y-${d}-${r}-${c}`,
        device: d,
        fill: step === 3 ? COPY_COLOR : DEVICE_COLORS[d],
        hatched: step === 2,
        opacity: step >= 2 ? 1 : 0,
        late: step === 3,
      })),
      // A copy of the other device's partial sum, which travels here and is added in.
      ...grid('Y', T, (r, c) => ({
        key: `Y-from-${other}-${r}-${c}`,
        device: step === 3 ? d : other,
        fill: DEVICE_COLORS[other],
        hatched: true,
        opacity: step === 2 ? 1 : 0,
        arriving: step === 3,
      })),
    ];
  });
}

function measure(width) {
  const room = width - 4 * SYMBOL_WIDTH - 5 * GAP;
  const size = Math.max(12, Math.min(24, Math.floor(room / 10)));
  const pitch = size + GAP;
  const tensorWidth = E * pitch - GAP;
  const tallHeight = T * pitch - GAP;
  const rowWidth = 5 * tensorWidth + 4 * SYMBOL_WIDTH;
  const left = (width - rowWidth) / 2;
  const deviceHeight = HEADER_HEIGHT + tallHeight + LABEL_HEIGHT;
  const tensorIndex = Object.fromEntries(TENSORS.map((t, i) => [t.name, i]));
  const tensorX = (i) => left + i * (tensorWidth + SYMBOL_WIDTH);
  const deviceY = (d) => d * (deviceHeight + DEVICE_GAP);
  const offsetY = (rows) => (tallHeight - (rows * pitch - GAP)) / 2;
  return {
    size,
    pitch,
    tensorWidth,
    tallHeight,
    left,
    rowWidth,
    tensorX,
    deviceY,
    height: 2 * deviceHeight + DEVICE_GAP,
    cellX: (tensor, c) => tensorX(tensorIndex[tensor]) + c * pitch,
    cellY: (device, tensor, r) =>
      deviceY(device) + HEADER_HEIGHT + offsetY(TENSORS[tensorIndex[tensor]].rows) + r * pitch,
  };
}

function DeviceRow({ device, m }) {
  const top = m.deviceY(device);
  const symbolY = top + HEADER_HEIGHT + m.tallHeight / 2 + 6;
  return (
    <g>
      <text x={m.left} y={top + 13}>
        Device {device}
      </text>
      {TENSORS.flatMap((tensor) =>
        Array.from({ length: tensor.rows * E }, (_, i) => (
          <Slot
            key={`${tensor.name}-${i}`}
            x={m.cellX(tensor.name, i % E)}
            y={m.cellY(device, tensor.name, Math.floor(i / E))}
            size={m.size}
          />
        )),
      )}
      {TENSORS.map((tensor, i) => (
        <text
          key={tensor.name}
          x={m.tensorX(i) + m.tensorWidth / 2}
          y={top + HEADER_HEIGHT + m.tallHeight + 17}
          textAnchor="middle"
        >
          {tensor.name}
        </text>
      ))}
      {SYMBOLS.map((symbol, i) => (
        <text
          key={i}
          className="pd-symbol"
          x={m.tensorX(i + 1) - SYMBOL_WIDTH / 2}
          y={symbolY}
          textAnchor="middle"
        >
          {symbol}
        </text>
      ))}
    </g>
  );
}

export default function TpPair() {
  const [step, setStep] = useState(0);
  const { ref, width, animated } = useFigureWidth();
  const m = measure(width);

  return (
    <Figure figureRef={ref} animated={animated}>
      <DiagramSvg width={width} height={m.height} label="A column-parallel layer followed by a row-parallel layer">
        {DEVICES.map((d) => (
          <DeviceRow key={d} device={d} m={m} />
        ))}
        {cellsFor(step).map((cell) => (
          <Cell
            key={cell.key}
            x={m.cellX(cell.tensor, cell.c)}
            y={m.cellY(cell.device, cell.tensor, cell.r)}
            size={m.size}
            fill={cell.fill}
            hatched={cell.hatched}
            opacity={cell.opacity}
            arriving={cell.arriving}
            late={cell.late}
          />
        ))}
      </DiagramSvg>
      <Legend
        items={[
          { fill: COPY_COLOR, label: 'copy on every device' },
          { fill: DEVICE_COLORS[0], hatched: true, label: 'partial sum' },
          { fill: EMPTY_COLOR, label: 'on the other device' },
        ]}
      />
      <StepLine lines={LINES} step={step} />
      <StepControls step={step} total={LINES.length} onStep={setStep} />
    </Figure>
  );
}
