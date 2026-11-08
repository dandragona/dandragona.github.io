import { useState } from 'react';
import {
  DEVICE_COLORS,
  useFigureWidth,
  Figure,
  DiagramSvg,
  Slot,
  Cell,
  StepLine,
  StepControls,
} from './diagram-kit.jsx';

// One attention tensor, S positions by A heads, on four devices. Each device
// frame draws the whole tensor; a cell sits on the device that holds it. A cell
// keeps the color of the device its position started on.

const P = 4;
const S = 8;
const A = 4;
const DEVICES = Array.from({ length: P }, (_, i) => i);
const GAP = 2;
const FRAME_GAP = 14;
const HEADER_HEIGHT = 20;
const FOOTER_HEIGHT = 40;

const LINES = [
  'Split by position: each device holds all 4 heads for 2 of the 8 positions. Colors show where each position started.',
  'All-to-all: each device keeps its piece of one head and sends the other 3 pieces. Now each device holds all 8 positions for 1 head and runs attention locally.',
  'A second all-to-all sends the attention output back to the position split.',
];
const TENSOR_NAMES = ['Q (K and V move the same way)', 'Q (K and V move the same way)', 'Attention output'];

const startDevice = (position) => Math.floor(position / (S / P));
const holder = (position, head, step) => (step === 1 ? head : startDevice(position));

function measure(width) {
  const frameRoom = (width - (P - 1) * FRAME_GAP) / P;
  const pitch = Math.max(12, Math.min(24, Math.floor((frameRoom + GAP) / A)));
  const size = pitch - GAP;
  const frameWidth = A * pitch - GAP;
  const left = (width - (P * frameWidth + (P - 1) * FRAME_GAP)) / 2;
  const gridHeight = S * pitch - GAP;
  const frameX = (d) => left + d * (frameWidth + FRAME_GAP);
  return {
    size,
    pitch,
    frameWidth,
    left,
    gridHeight,
    frameX,
    height: HEADER_HEIGHT + gridHeight + FOOTER_HEIGHT,
    cellX: (device, head) => frameX(device) + head * pitch,
    cellY: (position) => HEADER_HEIGHT + position * pitch,
  };
}

export default function UlyssesAttention() {
  const [step, setStep] = useState(0);
  const { ref, width, animated } = useFigureWidth();
  const m = measure(width);
  const footerY = HEADER_HEIGHT + m.gridHeight;

  return (
    <Figure figureRef={ref} animated={animated}>
      <DiagramSvg width={width} height={m.height} label="Ulysses attention on four devices">
        {DEVICES.map((d) => (
          <g key={d}>
            <text x={m.frameX(d) + m.frameWidth / 2} y={13} textAnchor="middle">
              Device {d}
            </text>
            {Array.from({ length: S * A }, (_, i) => (
              <Slot key={i} x={m.cellX(d, i % A)} y={m.cellY(Math.floor(i / A))} size={m.size} />
            ))}
          </g>
        ))}
        {Array.from({ length: S * A }, (_, i) => {
          const position = Math.floor(i / A);
          const head = i % A;
          return (
            <Cell
              key={i}
              x={m.cellX(holder(position, head, step), head)}
              y={m.cellY(position)}
              size={m.size}
              fill={DEVICE_COLORS[startDevice(position)]}
            />
          );
        })}
        <text x={m.left} y={footerY + 18}>
          {TENSOR_NAMES[step]}
        </text>
        <text className="pd-small" x={m.left} y={footerY + 34} opacity={0.75}>
          rows are positions, columns are heads
        </text>
      </DiagramSvg>
      <StepLine lines={LINES} step={step} />
      <StepControls step={step} total={LINES.length} onStep={setStep} />
    </Figure>
  );
}
