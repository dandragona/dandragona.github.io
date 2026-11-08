import { useState } from 'react';
import {
  DEVICE_COLORS,
  NEUTRAL_COLOR,
  INK,
  useFigureWidth,
  Figure,
  DiagramSvg,
  Slot,
  Cell,
  StepLine,
  StepControls,
} from './diagram-kit.jsx';

// Eight devices in a 2 × 4 mesh: tensor parallelism across each row, data
// parallelism down each column. Each device box shows which half of the token
// rows (X) and which quarter of W's columns it holds.

const ROWS = 2;
const COLS = 4;
const GAP = 2;
const BOX_GAP = 18;
const OUTLINE = 5;
const PAD = 6;
const INNER_GAP = 8;
const LABEL_HEIGHT = 16;

const LINES = [
  'Eight devices in a 2 × 4 mesh. Each device holds half of the token rows (X) and a quarter of the columns of W.',
  'Tensor parallelism runs across each row: 4 devices with the same tokens and different columns of W.',
  'Data parallelism runs down each column: 2 devices with the same columns of W and different tokens. They all-reduce ∂W.',
];

function measure(width) {
  const boxRoom = (width - (COLS - 1) * BOX_GAP - 2 * OUTLINE) / COLS;
  const size = Math.max(6, Math.min(18, Math.floor((boxRoom - 2 * PAD - INNER_GAP - 3 * GAP) / 5)));
  const pitch = size + GAP;
  const boxWidth = 2 * PAD + size + INNER_GAP + 4 * pitch - GAP;
  const boxHeight = 2 * PAD + 2 * pitch - GAP + LABEL_HEIGHT;
  const meshWidth = COLS * boxWidth + (COLS - 1) * BOX_GAP;
  const left = (width - meshWidth) / 2;
  const boxX = (c) => left + c * (boxWidth + BOX_GAP);
  const boxY = (r) => OUTLINE + r * (boxHeight + BOX_GAP);
  return {
    size,
    pitch,
    boxWidth,
    boxHeight,
    meshWidth,
    left,
    boxX,
    boxY,
    height: 2 * OUTLINE + ROWS * boxHeight + (ROWS - 1) * BOX_GAP,
  };
}

function DeviceBox({ row, col, m }) {
  const x = m.boxX(col);
  const y = m.boxY(row);
  const xLeft = x + PAD;
  const wLeft = xLeft + m.size + INNER_GAP;
  const top = y + PAD;
  const wTop = top + (m.pitch - GAP) / 2;
  const labelY = top + 2 * m.pitch - GAP + 13;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={m.boxWidth}
        height={m.boxHeight}
        rx={6}
        fill="rgba(255, 255, 255, 0.25)"
        stroke="rgba(41, 37, 36, 0.25)"
      />
      {[0, 1].map((half) => (
        <Slot key={`x-${half}`} x={xLeft} y={top + half * m.pitch} size={m.size} />
      ))}
      <Cell x={xLeft} y={top + row * m.pitch} size={m.size} fill={NEUTRAL_COLOR} />
      {[0, 1, 2, 3].map((piece) => (
        <Slot key={`w-${piece}`} x={wLeft + piece * m.pitch} y={wTop} size={m.size} />
      ))}
      <Cell x={wLeft + col * m.pitch} y={wTop} size={m.size} fill={DEVICE_COLORS[col]} />
      <text className="pd-small" x={xLeft + m.size / 2} y={labelY} textAnchor="middle">
        X
      </text>
      <text className="pd-small" x={wLeft + (4 * m.pitch - GAP) / 2} y={labelY} textAnchor="middle">
        W
      </text>
    </g>
  );
}

function Outline({ x, y, width, height, visible }) {
  return (
    <rect
      className="pd-fade"
      x={x - OUTLINE}
      y={y - OUTLINE}
      width={width + 2 * OUTLINE}
      height={height + 2 * OUTLINE}
      rx={9}
      fill="none"
      stroke={INK}
      strokeWidth={2}
      style={{ opacity: visible ? 1 : 0 }}
    />
  );
}

export default function DeviceMesh() {
  const [step, setStep] = useState(0);
  const { ref, width, animated } = useFigureWidth();
  const m = measure(width);
  const rows = Array.from({ length: ROWS }, (_, r) => r);
  const cols = Array.from({ length: COLS }, (_, c) => c);

  return (
    <Figure figureRef={ref} animated={animated}>
      <DiagramSvg width={width} height={m.height} label="Eight devices in a 2 by 4 mesh">
        {rows.flatMap((r) => cols.map((c) => <DeviceBox key={`${r}-${c}`} row={r} col={c} m={m} />))}
        {rows.map((r) => (
          <Outline
            key={`row-${r}`}
            x={m.left}
            y={m.boxY(r)}
            width={m.meshWidth}
            height={m.boxHeight}
            visible={step === 1}
          />
        ))}
        {cols.map((c) => (
          <Outline
            key={`col-${c}`}
            x={m.boxX(c)}
            y={m.boxY(0)}
            width={m.boxWidth}
            height={ROWS * m.boxHeight + (ROWS - 1) * BOX_GAP}
            visible={step === 2}
          />
        ))}
      </DiagramSvg>
      <StepLine lines={LINES} step={step} />
      <StepControls step={step} total={LINES.length} onStep={setStep} />
    </Figure>
  );
}
