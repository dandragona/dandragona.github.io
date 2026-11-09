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
  'An elementwise nonlinearity works on each value of H separately, so each device applies it to its own column. That column matches the device’s row of W₂.',
  'Row-parallel layer: each device multiplies its column of H by its row of W₂. The result is a full-sized partial sum of Y. Nothing has moved yet.',
  'All-reduce: the devices add their partial sums, so every device has all of Y, like X at the start, ready for the next pair.',
];
// Steps where each device's column of H and row of W₂ are outlined.
const MATCH_STEPS = [2, 3];
const PARTIAL_STEP = 3;
const REDUCED_STEP = 4;

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
        fill: step === REDUCED_STEP ? COPY_COLOR : DEVICE_COLORS[d],
        hatched: step === PARTIAL_STEP,
        opacity: step >= PARTIAL_STEP ? 1 : 0,
        late: step === REDUCED_STEP,
      })),
      // A copy of the other device's partial sum, which travels here and is added in.
      ...grid('Y', T, (r, c) => ({
        key: `Y-from-${other}-${r}-${c}`,
        device: step === REDUCED_STEP ? d : other,
        fill: DEVICE_COLORS[other],
        hatched: true,
        opacity: step === PARTIAL_STEP ? 1 : 0,
        arriving: step === REDUCED_STEP,
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

// Outlines drawn in the gaps around this device's column of H and row of W₂.
function Match({ device, step, m }) {
  const pad = GAP / 2;
  const boxes = [
    { x: m.cellX('H', device), y: m.cellY(device, 'H', 0), width: m.size, height: m.tallHeight },
    { x: m.cellX('W₂', 0), y: m.cellY(device, 'W₂', device), width: m.tensorWidth, height: m.size },
  ];
  return (
    <g className="pd-fade" style={{ opacity: MATCH_STEPS.includes(step) ? 1 : 0 }}>
      {boxes.map((box, i) => (
        <rect
          key={i}
          x={box.x - pad}
          y={box.y - pad}
          width={box.width + 2 * pad}
          height={box.height + 2 * pad}
          rx={4}
          fill="none"
          stroke={INK}
          strokeWidth={2}
        />
      ))}
    </g>
  );
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
        {DEVICES.map((d) => (
          <Match key={`match-${d}`} device={d} step={step} m={m} />
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
