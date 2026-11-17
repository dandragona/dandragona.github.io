import { useState } from 'react';
import {
  DEVICE_COLORS,
  COPY_COLOR,
  EMPTY_COLOR,
  INK,
  sequenceOffset,
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
// X @ W1[E, F] → H, then H @ W2[F, E] → Y. Each device is one row of the
// figure and holds half of F. X, H, and Y have T = 4 token rows: B = 2
// sequences of 2 tokens.

const T = 4;
const E = 2;
const F = 4;
const HALF_F = F / 2;
const DEVICES = [0, 1];
const GAP = 2;
const SYMBOL_WIDTH = 24;
const HEADER_HEIGHT = 20;
const LABEL_HEIGHT = 22;
const DEVICE_GAP = 18;

// `tokens` marks tensors whose rows are tokens, drawn in sequence blocks.
const TENSORS = [
  { name: 'X', rows: T, cols: E, tokens: true },
  { name: 'W₁', rows: E, cols: F },
  { name: 'H', rows: T, cols: F, tokens: true },
  { name: 'W₂', rows: F, cols: E },
  { name: 'Y', rows: T, cols: E, tokens: true },
];
const SYMBOLS = ['@', '→', '@', '→'];

const LINES = [
  'Each device has all of X, its own columns of W₁, and its own rows of W₂.',
  'Column-parallel layer: each device computes its own columns of H. Nothing moves.',
  'An elementwise nonlinearity works on each value of H separately, so each device applies it to its own columns. Those columns match the device’s rows of W₂.',
  'Row-parallel layer: each device multiplies its columns of H by its rows of W₂. The result is a full-sized partial sum of Y. Nothing has moved yet.',
  'All-reduce: the devices add their partial sums, so every device has all of Y, like X at the start, ready for the next pair.',
];
// Steps where each device's column of H and row of W₂ are outlined.
const MATCH_STEPS = [2, 3];
const PARTIAL_STEP = 3;
const REDUCED_STEP = 4;

function grid(tensor, rows, cols, build) {
  return Array.from({ length: rows * cols }, (_, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    return { tensor, r, c, ...build(r, c) };
  });
}

// Device d's half of F: columns of W₁ and H, rows of W₂.
const ownHalf = (d, i) => d * HALF_F + i;

function cellsFor(step) {
  return DEVICES.flatMap((d) => {
    const other = 1 - d;
    return [
      ...grid('X', T, E, (r, c) => ({ key: `X-${d}-${r}-${c}`, device: d, fill: COPY_COLOR })),
      ...grid('W₁', E, HALF_F, (r, c) => ({
        key: `W1-${d}-${r}-${c}`,
        device: d,
        c: ownHalf(d, c),
        fill: DEVICE_COLORS[d],
      })),
      ...grid('W₂', HALF_F, E, (r, c) => ({
        key: `W2-${d}-${r}-${c}`,
        device: d,
        r: ownHalf(d, r),
        fill: DEVICE_COLORS[d],
      })),
      ...grid('H', T, HALF_F, (r, c) => ({
        key: `H-${d}-${r}-${c}`,
        device: d,
        c: ownHalf(d, c),
        fill: DEVICE_COLORS[d],
        opacity: step >= 1 ? 1 : 0,
      })),
      // This device's result. It turns into the full Y when the other partial sum lands.
      ...grid('Y', T, E, (r, c) => ({
        key: `Y-${d}-${r}-${c}`,
        device: d,
        fill: step === REDUCED_STEP ? COPY_COLOR : DEVICE_COLORS[d],
        hatched: step === PARTIAL_STEP,
        opacity: step >= PARTIAL_STEP ? 1 : 0,
        late: step === REDUCED_STEP,
      })),
      // A copy of the other device's partial sum, which travels here and is added in.
      ...grid('Y', T, E, (r, c) => ({
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
  const cols = TENSORS.reduce((sum, tensor) => sum + tensor.cols, 0);
  const pitchFit = Math.floor((width - SYMBOLS.length * SYMBOL_WIDTH + TENSORS.length * GAP) / cols);
  const size = Math.max(12, Math.min(24, pitchFit - GAP));
  const pitch = size + GAP;
  const span = (n) => n * pitch - GAP;
  const tensorHeight = (tensor) => span(tensor.rows) + (tensor.tokens ? sequenceOffset(tensor.rows - 1) : 0);
  const tallHeight = Math.max(...TENSORS.map(tensorHeight));
  const tensorX = {};
  let x = 0;
  for (const tensor of TENSORS) {
    tensorX[tensor.name] = x;
    x += span(tensor.cols) + SYMBOL_WIDTH;
  }
  const rowWidth = x - SYMBOL_WIDTH;
  const left = Math.max(0, (width - rowWidth) / 2);
  const deviceHeight = HEADER_HEIGHT + tallHeight + LABEL_HEIGHT;
  const tensorByName = Object.fromEntries(TENSORS.map((tensor) => [tensor.name, tensor]));
  const deviceY = (d) => d * (deviceHeight + DEVICE_GAP);
  const offsetY = (tensor) => (tallHeight - tensorHeight(tensor)) / 2;
  return {
    size,
    pitch,
    span,
    tallHeight,
    left,
    deviceY,
    height: 2 * deviceHeight + DEVICE_GAP,
    tensorX: (name) => left + tensorX[name],
    tensorWidth: (name) => span(tensorByName[name].cols),
    cellX: (tensor, c) => left + tensorX[tensor] + c * pitch,
    cellY: (device, tensor, r) =>
      deviceY(device) +
      HEADER_HEIGHT +
      offsetY(tensorByName[tensor]) +
      r * pitch +
      (tensorByName[tensor].tokens ? sequenceOffset(r) : 0),
  };
}

// Outlines drawn in the gaps around this device's columns of H and rows of W₂.
function Match({ device, step, m }) {
  const pad = GAP / 2;
  const boxes = [
    { x: m.cellX('H', device * HALF_F), y: m.cellY(device, 'H', 0), width: m.span(HALF_F), height: m.tallHeight },
    {
      x: m.cellX('W₂', 0),
      y: m.cellY(device, 'W₂', device * HALF_F),
      width: m.tensorWidth('W₂'),
      height: m.span(HALF_F),
    },
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
        Array.from({ length: tensor.rows * tensor.cols }, (_, i) => (
          <Slot
            key={`${tensor.name}-${i}`}
            x={m.cellX(tensor.name, i % tensor.cols)}
            y={m.cellY(device, tensor.name, Math.floor(i / tensor.cols))}
            size={m.size}
          />
        )),
      )}
      {TENSORS.map((tensor) => (
        <text
          key={tensor.name}
          x={m.tensorX(tensor.name) + m.tensorWidth(tensor.name) / 2}
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
          x={m.tensorX(TENSORS[i + 1].name) - SYMBOL_WIDTH / 2}
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
