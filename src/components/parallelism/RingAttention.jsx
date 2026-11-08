import { useState } from 'react';
import {
  DEVICE_COLORS,
  INK,
  useFigureWidth,
  Figure,
  DiagramSvg,
  Slot,
  Cell,
  StepLine,
  StepControls,
} from './diagram-kit.jsx';

// Four devices in a ring. Q stays on its device while each K,V block moves one
// device clockwise per step. A block keeps the color of the device it started
// on. The matrix records which blocks each device has computed with.

const P = 4;
const DEVICES = Array.from({ length: P }, (_, i) => i);

const CELL = 14;
const GAP = 2;
const BLOCK = 2 * CELL + GAP;
const NODE_WIDTH = 2 * BLOCK + 12;
const NODE_HEADER = 16;
const NODE_HEIGHT = NODE_HEADER + BLOCK + 18;
const RADIUS_X = 112;
const RADIUS_Y = 86;
const RING_WIDTH = 2 * RADIUS_X + NODE_WIDTH;
const RING_HEIGHT = 2 * RADIUS_Y + NODE_HEIGHT;

const MATRIX_CELL = 24;
const MATRIX_GAP = 3;
const MATRIX_PITCH = MATRIX_CELL + MATRIX_GAP;
const MATRIX_LABEL = 30;
const MATRIX_HEADER = 40;
const MATRIX_GRID = P * MATRIX_PITCH - MATRIX_GAP;
const MATRIX_WIDTH = MATRIX_LABEL + MATRIX_GRID;
const MATRIX_HEIGHT = MATRIX_HEADER + MATRIX_GRID;

const WIDE_GAP = 48;
const NARROW_GAP = 24;
const WIDE_LAYOUT_MIN = RING_WIDTH + WIDE_GAP + MATRIX_WIDTH;

const LINES = [
  'Each device computes with the K,V block it already holds.',
  'Every block moves one device clockwise. Each device computes with its new block.',
  'The blocks move again. Each device has now seen three blocks.',
  'After three moves, every device has seen all four blocks.',
];

// Blocks move from device d to device d + 1 at each step.
const holder = (block, step) => (block + step) % P;
const stepSeen = (device, block) => (device - block + P) % P;

function measure(width) {
  const wide = width >= WIDE_LAYOUT_MIN;
  const ringX = (width - (wide ? WIDE_LAYOUT_MIN : RING_WIDTH)) / 2;
  const centerX = ringX + RING_WIDTH / 2;
  const centerY = RING_HEIGHT / 2;
  return {
    height: wide ? RING_HEIGHT : RING_HEIGHT + NARROW_GAP + MATRIX_HEIGHT,
    matrixX: wide ? ringX + RING_WIDTH + WIDE_GAP : (width - MATRIX_WIDTH) / 2,
    matrixY: wide ? (RING_HEIGHT - MATRIX_HEIGHT) / 2 : RING_HEIGHT + NARROW_GAP,
    centers: [
      [centerX, centerY - RADIUS_Y],
      [centerX + RADIUS_X, centerY],
      [centerX, centerY + RADIUS_Y],
      [centerX - RADIUS_X, centerY],
    ],
  };
}

function blockOrigin(center, kv) {
  return [center[0] - NODE_WIDTH / 2 + (kv ? BLOCK + 12 : 0), center[1] - NODE_HEIGHT / 2 + NODE_HEADER];
}

const blockCell = (i) => [(i % 2) * (CELL + GAP), Math.floor(i / 2) * (CELL + GAP)];

// Top and bottom devices send from a side edge to a neighbor's top or bottom
// edge. Side devices do the reverse.
function hopEnds(device, centers) {
  const from = centers[device];
  const to = centers[(device + 1) % P];
  const dx = Math.sign(to[0] - from[0]);
  const dy = Math.sign(to[1] - from[1]);
  const clearX = NODE_WIDTH / 2 + 4;
  const clearY = NODE_HEIGHT / 2 + 4;
  return device % 2 === 0
    ? [from[0] + dx * clearX, from[1], to[0], to[1] - dy * clearY]
    : [from[0], from[1] + dy * clearY, to[0] - dx * clearX, to[1]];
}

function Hop({ ends, active }) {
  const [x1, y1, x2, y2] = ends;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const wing = (delta) => `${x2 - 8 * Math.cos(angle + delta)},${y2 - 8 * Math.sin(angle + delta)}`;
  const color = active ? INK : 'rgba(41, 37, 36, 0.3)';
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.5} />
      <polygon points={`${x2},${y2} ${wing(0.45)} ${wing(-0.45)}`} fill={color} />
    </g>
  );
}

function DeviceNode({ device, center }) {
  const [qX, y] = blockOrigin(center, false);
  const [kvX] = blockOrigin(center, true);
  const labelY = y + BLOCK + 15;
  return (
    <g>
      <text x={center[0]} y={y - 5} textAnchor="middle">
        Device {device}
      </text>
      {Array.from({ length: 4 }, (_, i) => {
        const [dx, dy] = blockCell(i);
        return (
          <g key={i}>
            <Slot x={qX + dx} y={y + dy} size={CELL} />
            <Cell x={qX + dx} y={y + dy} size={CELL} fill={DEVICE_COLORS[device]} />
            <Slot x={kvX + dx} y={y + dy} size={CELL} />
          </g>
        );
      })}
      <text x={qX + BLOCK / 2} y={labelY} textAnchor="middle">
        Q
      </text>
      <text x={kvX + BLOCK / 2} y={labelY} textAnchor="middle">
        K,V
      </text>
    </g>
  );
}

function BlocksSeen({ x, y, step }) {
  const gridX = x + MATRIX_LABEL;
  const gridY = y + MATRIX_HEADER;
  return (
    <g>
      <text x={gridX + MATRIX_GRID / 2} y={y + 13} textAnchor="middle">
        K,V blocks seen
      </text>
      {DEVICES.map((block) => (
        <text key={block} x={gridX + block * MATRIX_PITCH + MATRIX_CELL / 2} y={y + 32} textAnchor="middle">
          {block}
        </text>
      ))}
      {DEVICES.map((device) => (
        <text key={device} x={x} y={gridY + device * MATRIX_PITCH + MATRIX_CELL / 2 + 4}>
          D{device}
        </text>
      ))}
      {DEVICES.flatMap((device) =>
        DEVICES.map((block) => {
          const cellX = gridX + block * MATRIX_PITCH;
          const cellY = gridY + device * MATRIX_PITCH;
          const seenAt = stepSeen(device, block);
          return (
            <g key={`${device}-${block}`}>
              <Slot x={cellX} y={cellY} size={MATRIX_CELL} />
              <Cell
                x={cellX}
                y={cellY}
                size={MATRIX_CELL}
                fill={DEVICE_COLORS[block]}
                opacity={seenAt <= step ? 1 : 0}
                outlined={seenAt === step}
              />
            </g>
          );
        }),
      )}
    </g>
  );
}

export default function RingAttention() {
  const [step, setStep] = useState(0);
  const { ref, width, animated } = useFigureWidth();
  const m = measure(width);

  return (
    <Figure figureRef={ref} animated={animated}>
      <DiagramSvg width={width} height={m.height} label="Ring attention on four devices">
        {DEVICES.map((d) => (
          <Hop key={d} ends={hopEnds(d, m.centers)} active={step > 0} />
        ))}
        {DEVICES.map((d) => (
          <DeviceNode key={d} device={d} center={m.centers[d]} />
        ))}
        {DEVICES.flatMap((block) => {
          const [x, y] = blockOrigin(m.centers[holder(block, step)], true);
          return Array.from({ length: 4 }, (_, i) => {
            const [dx, dy] = blockCell(i);
            return <Cell key={`${block}-${i}`} x={x + dx} y={y + dy} size={CELL} fill={DEVICE_COLORS[block]} />;
          });
        })}
        <BlocksSeen x={m.matrixX} y={m.matrixY} step={step} />
      </DiagramSvg>
      <StepLine lines={LINES} step={step} />
      <StepControls step={step} total={LINES.length} onStep={setStep} />
    </Figure>
  );
}
