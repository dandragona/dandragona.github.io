import { useState } from 'react';
import {
  NEUTRAL_COLOR,
  useFigureWidth,
  Figure,
  DiagramSvg,
  Cell,
  StepLine,
  StepControls,
} from './diagram-kit.jsx';

// The example matmul on one device. Later steps fade out the cells that one
// row, or one column, of Y doesn't use.

const T = 4;
const E = 2;
const ROW = 1;
const COLUMN = 1;
const GAP = 2;
const SYMBOL_WIDTH = 30;
const LABEL_HEIGHT = 24;
const DIM = 0.2;

const TENSORS = [
  { name: 'X', shape: '[T, E]', rows: T },
  { name: 'W', shape: '[E, E]', rows: E },
  { name: 'Y', shape: '[T, E]', rows: T },
];

const LINES = [
  'One device computes the whole matmul.',
  'One row of Y uses only the same row of X, and all of W. So the rows can be split across devices.',
  'One column of Y uses all of X, and only the same column of W. So the columns can be split too.',
];

function used(step, tensor, r, c) {
  if (step === 1) return tensor === 'W' || r === ROW;
  if (step === 2) return tensor === 'X' || c === COLUMN;
  return true;
}

function measure(width) {
  const size = Math.max(16, Math.min(30, Math.floor((width - 2 * SYMBOL_WIDTH) / 8)));
  const pitch = size + GAP;
  const tensorWidth = E * pitch - GAP;
  const tallHeight = T * pitch - GAP;
  const totalWidth = 3 * tensorWidth + 2 * SYMBOL_WIDTH;
  const left = (width - totalWidth) / 2;
  const tensorX = (i) => left + i * (tensorWidth + SYMBOL_WIDTH);
  const tensorY = (rows) => (tallHeight - (rows * pitch - GAP)) / 2;
  return { size, pitch, tensorWidth, tallHeight, tensorX, tensorY, height: tallHeight + LABEL_HEIGHT + 4 };
}

export default function MatmulExample() {
  const [step, setStep] = useState(0);
  const { ref, width, animated } = useFigureWidth();
  const m = measure(width);
  const symbolY = m.tallHeight / 2 + 6;

  return (
    <Figure figureRef={ref} animated={animated}>
      <DiagramSvg width={width} height={m.height} label="The example matmul, X times W gives Y">
        {TENSORS.map((tensor, i) => (
          <g key={tensor.name}>
            {Array.from({ length: tensor.rows * E }, (_, j) => {
              const r = Math.floor(j / E);
              const c = j % E;
              return (
                <Cell
                  key={j}
                  x={m.tensorX(i) + c * m.pitch}
                  y={m.tensorY(tensor.rows) + r * m.pitch}
                  size={m.size}
                  fill={NEUTRAL_COLOR}
                  opacity={used(step, tensor.name, r, c) ? 1 : DIM}
                />
              );
            })}
            <text x={m.tensorX(i) + m.tensorWidth / 2} y={m.tallHeight + 18} textAnchor="middle">
              {tensor.name} {tensor.shape}
            </text>
          </g>
        ))}
        <text className="pd-symbol" x={m.tensorX(1) - SYMBOL_WIDTH / 2} y={symbolY} textAnchor="middle">
          @
        </text>
        <text className="pd-symbol" x={m.tensorX(2) - SYMBOL_WIDTH / 2} y={symbolY} textAnchor="middle">
          →
        </text>
      </DiagramSvg>
      <StepLine lines={LINES} step={step} />
      <StepControls step={step} total={LINES.length} onStep={setStep} />
    </Figure>
  );
}
