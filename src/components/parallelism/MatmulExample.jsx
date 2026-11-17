import { useState } from 'react';
import {
  NEUTRAL_COLOR,
  sequenceOffset,
  useFigureWidth,
  Figure,
  DiagramSvg,
  Cell,
  StepLine,
  StepControls,
} from './diagram-kit.jsx';

// The example matmul on one device. X and Y hold B = 2 sequences of S = 2
// tokens, one token per row. One step picks out one entry of Y and the row
// and column it uses. Later steps fade out the cells that one row, or one
// column, of Y doesn't use.

const B = 2;
const S = 2;
const TOKENS = B * S;
const E = 2;
const F = 4;
const ROW = 1;
const COLUMN = 2;
const GAP = 2;
const SYMBOL_WIDTH = 30;
// Side room for the labels under X and Y, which are wider than X.
const SIDE = 20;
const LABEL_HEIGHT = 24;
const DIM = 0.2;

const TENSORS = [
  { name: 'X', shape: '[B, S, E]', rows: TOKENS, cols: E, tokens: true },
  { name: 'W', shape: '[E, F]', rows: E, cols: F },
  { name: 'Y', shape: '[B, S, F]', rows: TOKENS, cols: F, tokens: true },
];

const LINES = [
  'X holds B sequences of S tokens, drawn here as B blocks of S rows. The matmul treats each token as one row.',
  'One entry of Y is the dot product of a row of X and a column of W. It multiplies the E matching pairs, numbered here, and adds up the products.',
  'Every entry of Y is computed the same way. Each takes about 2E operations, and Y has B × S × F entries, so the matmul takes about 2BSEF.',
  'One row of Y uses only the same row of X, and all of W. So the token rows can be split across devices: by whole sequences, or by positions within each sequence.',
  'One column of Y uses all of X, and only the same column of W. So the columns can be split too.',
];
const ENTRY_STEP = 1;
const ROW_STEP = 3;
const COLUMN_STEP = 4;

function used(step, tensor, r, c) {
  if (step === ENTRY_STEP) {
    if (tensor === 'X') return r === ROW;
    if (tensor === 'W') return c === COLUMN;
    return r === ROW && c === COLUMN;
  }
  if (step === ROW_STEP) return tensor === 'W' || r === ROW;
  if (step === COLUMN_STEP) return tensor === 'X' || c === COLUMN;
  return true;
}

// On the entry step, the pairs multiplied together share a number.
function pairNumber(step, tensor, r, c) {
  if (step !== ENTRY_STEP) return undefined;
  if (tensor === 'X' && r === ROW) return `${c + 1}`;
  if (tensor === 'W' && c === COLUMN) return `${r + 1}`;
  return undefined;
}

function measure(width) {
  const cols = TENSORS.reduce((sum, tensor) => sum + tensor.cols, 0);
  const pitch = Math.floor((width - 2 * SIDE - 2 * SYMBOL_WIDTH + TENSORS.length * GAP) / cols);
  const size = Math.max(16, Math.min(30, pitch - GAP));
  const span = (n) => n * (size + GAP) - GAP;
  const height = (tensor) => span(tensor.rows) + (tensor.tokens ? sequenceOffset(tensor.rows - 1) : 0);
  const tallHeight = Math.max(...TENSORS.map(height));
  const totalWidth = TENSORS.reduce((sum, tensor) => sum + span(tensor.cols), 0) + 2 * SYMBOL_WIDTH;
  const tensorX = [];
  let x = (width - totalWidth) / 2;
  for (const tensor of TENSORS) {
    tensorX.push(x);
    x += span(tensor.cols) + SYMBOL_WIDTH;
  }
  return {
    size,
    pitch: size + GAP,
    span,
    tallHeight,
    tensorX,
    cellY: (tensor, r) =>
      (tallHeight - height(tensor)) / 2 + r * (size + GAP) + (tensor.tokens ? sequenceOffset(r) : 0),
    height: tallHeight + LABEL_HEIGHT + 4,
  };
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
            {Array.from({ length: tensor.rows * tensor.cols }, (_, j) => {
              const r = Math.floor(j / tensor.cols);
              const c = j % tensor.cols;
              return (
                <Cell
                  key={j}
                  x={m.tensorX[i] + c * m.pitch}
                  y={m.cellY(tensor, r)}
                  size={m.size}
                  fill={NEUTRAL_COLOR}
                  opacity={used(step, tensor.name, r, c) ? 1 : DIM}
                  label={pairNumber(step, tensor.name, r, c)}
                />
              );
            })}
            <text x={m.tensorX[i] + m.span(tensor.cols) / 2} y={m.tallHeight + 18} textAnchor="middle">
              {tensor.name} {tensor.shape}
            </text>
          </g>
        ))}
        <text className="pd-symbol" x={m.tensorX[1] - SYMBOL_WIDTH / 2} y={symbolY} textAnchor="middle">
          @
        </text>
        <text className="pd-symbol" x={m.tensorX[2] - SYMBOL_WIDTH / 2} y={symbolY} textAnchor="middle">
          →
        </text>
      </DiagramSvg>
      <StepLine lines={LINES} step={step} />
      <StepControls step={step} total={LINES.length} onStep={setStep} />
    </Figure>
  );
}
