import { useState } from 'react';
import {
  DEVICE_COLORS,
  ZERO_COLOR,
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

// Expert parallelism on four devices, with expert d on device d. Each device
// starts with 2 of the 8 tokens, and the router sends each token to 2 experts.
// An expert's box has one slot per token, so both methods use the same places:
// all-to-all fills only the routed slots, and all-gather fills every slot.

const P = 4;
const T = 8;
const DEVICES = Array.from({ length: P }, (_, i) => i);
const TOKENS = Array.from({ length: T }, (_, i) => i);
const GAP = 2;
const LABEL_WIDTH = 60;
const COLUMN_GAP = 18;
const BOX_PAD = 4;
const MAX_MARK = 6;

// Each expert gets 4 tokens.
const BALANCED = [[1, 2], [0, 3], [0, 3], [1, 2], [0, 1], [2, 3], [0, 2], [1, 3]];
// Expert 0 gets 7 tokens and expert 1 gets 1.
const HOT = [[0, 2], [0, 3], [0, 2], [0, 3], [0, 2], [0, 3], [0, 2], [1, 3]];

const home = (token) => Math.floor(token / (T / P));

const START = {
  balanced: 'Each device holds 2 tokens, and expert d is on device d. The two marks under a token show its experts.',
  hot: 'Each device holds 2 tokens, and expert d is on device d. Now the router picks expert 0 for 7 of the 8 tokens.',
};

const METHODS = {
  'all-to-all': {
    label: 'Expert parallelism with all-to-all routing',
    lines: {
      balanced: [
        START.balanced,
        'All-to-all: each token is sent to the devices holding its 2 experts.',
        'Each expert processes the tokens it received.',
        'All-to-all: the outputs return to each token’s device, which adds its 2 expert outputs.',
      ],
      hot: [
        START.hot,
        'All-to-all: expert 0 receives 7 tokens, and expert 1 receives 1.',
        'Expert 0 has 7 tokens to process, so the other devices wait for device 0.',
        'All-to-all: the outputs return only after device 0 finishes.',
      ],
    },
  },
  'gather-scatter': {
    label: 'Expert parallelism with all-gather and reduce-scatter routing',
    lines: {
      balanced: [
        START.balanced,
        'All-gather: every device receives all 8 tokens.',
        'Each expert processes the tokens routed to it and writes zeros for the rest.',
        'Reduce-scatter: the devices add their rows, and each token’s sum returns to its device.',
      ],
      hot: [
        START.hot,
        'All-gather: every device still receives all 8 tokens.',
        'Expert 0 has 7 tokens to process, so the other devices wait for device 0.',
        'Reduce-scatter: the sums return only after device 0 finishes.',
      ],
    },
  },
};

function measure(width) {
  // The expert box outline sits BOX_PAD outside the slots on each side.
  const area = width - LABEL_WIDTH - 2 * BOX_PAD;
  const columnRoom = (area - (P - 1) * COLUMN_GAP) / P;
  const pitch = Math.max(9, Math.min(24, Math.floor((columnRoom + GAP) / 4)));
  const size = pitch - GAP;
  const boxWidth = 4 * pitch - GAP;
  const left = LABEL_WIDTH + BOX_PAD + (area - (P * boxWidth + (P - 1) * COLUMN_GAP)) / 2;
  const columnX = (d) => left + d * (boxWidth + COLUMN_GAP);
  const pairX = (d, i) => columnX(d) + (boxWidth - (2 * pitch - GAP)) / 2 + i * pitch;

  const tokensY = 24;
  const marksY = tokensY + size + 4;
  // Two route marks fit under a token with room to spare.
  const mark = Math.min(MAX_MARK, Math.floor((size - 3) / 2));
  const expertY = marksY + mark + 22;
  const countY = expertY + 2 * pitch - GAP + 18;
  const outputsY = countY + 16;
  return {
    size,
    pitch,
    boxWidth,
    columnX,
    tokensY,
    marksY,
    mark,
    expertY,
    countY,
    outputsY,
    height: outputsY + size + 4,
    token: (t) => ({ x: pairX(home(t), t % 2), y: tokensY }),
    output: (t) => ({ x: pairX(home(t), t % 2), y: outputsY }),
    slot: (d, t) => ({ x: columnX(d) + (t % 4) * pitch, y: expertY + Math.floor(t / 4) * pitch }),
  };
}

// Every cell that moves, for the given step. Keys follow the data, so cells
// slide when the step or the routing changes.
function movingCells(method, routes, step, m) {
  const cells = [];
  const travel = (key, t, device, processed) => {
    const fill = DEVICE_COLORS[home(t)];
    const base = { key, fill };
    if (step === 0) return { ...base, ...m.token(t), opacity: 0 };
    if (step === 3) {
      return { ...base, ...m.output(t), opacity: 0, arriving: true, ...processed };
    }
    return { ...base, ...m.slot(device, t), ...(step === 2 ? processed : {}) };
  };

  TOKENS.forEach((t) => {
    if (method === 'all-to-all') {
      routes[t].forEach((expert, i) => {
        cells.push(travel(`send-${t}-${i}`, t, expert, { hatched: true }));
      });
    } else {
      DEVICES.forEach((d) => {
        const routed = routes[t].includes(d);
        const processed = routed ? { hatched: true } : { fill: ZERO_COLOR, label: '0', labelInk: true };
        cells.push(travel(`gather-${t}-${d}`, t, d, processed));
      });
    }
  });
  return cells;
}

function Frame({ m, routes, step }) {
  const counts = DEVICES.map((d) => TOKENS.filter((t) => routes[t].includes(d)).length);
  const labelX = m.columnX(0) - BOX_PAD - 8;
  return (
    <g>
      <text x={labelX} y={m.tokensY + m.size / 2 + 4} textAnchor="end">
        tokens
      </text>
      <text x={labelX} y={m.expertY + m.pitch} textAnchor="end">
        experts
      </text>
      <text x={labelX} y={m.outputsY + m.size / 2 + 4} textAnchor="end">
        outputs
      </text>
      {DEVICES.map((d) => (
        <g key={d}>
          <text x={m.columnX(d) + m.boxWidth / 2} y={13} textAnchor="middle">
            Device {d}
          </text>
          <rect
            x={m.columnX(d) - BOX_PAD}
            y={m.expertY - BOX_PAD}
            width={m.boxWidth + 2 * BOX_PAD}
            height={2 * m.pitch - GAP + 2 * BOX_PAD}
            rx={6}
            fill="none"
            stroke="rgba(41, 37, 36, 0.3)"
          />
          {TOKENS.map((t) => {
            const { x, y } = m.slot(d, t);
            return <Slot key={t} x={x} y={y} size={m.size} />;
          })}
          <text
            className="pd-small pd-fade"
            x={m.columnX(d) + m.boxWidth / 2}
            y={m.countY}
            textAnchor="middle"
            style={{ opacity: step >= 2 ? 1 : 0 }}
          >
            {counts[d]} {counts[d] === 1 ? 'token' : 'tokens'}
          </text>
        </g>
      ))}
      {TOKENS.map((t) => {
        const tokenAt = m.token(t);
        const outputAt = m.output(t);
        return (
          <g key={t}>
            <Slot x={outputAt.x} y={outputAt.y} size={m.size} />
            <Cell x={tokenAt.x} y={tokenAt.y} size={m.size} fill={DEVICE_COLORS[home(t)]} />
            {routes[t].map((expert, i) => (
              <rect
                key={i}
                className="pd-cell-fill"
                x={tokenAt.x + m.size / 2 - m.mark - 1 + i * (m.mark + 2)}
                y={m.marksY}
                width={m.mark}
                height={m.mark}
                rx={1}
                style={{ fill: DEVICE_COLORS[expert] }}
              />
            ))}
          </g>
        );
      })}
    </g>
  );
}

export default function ExpertRouting({ method = 'all-to-all' }) {
  const config = METHODS[method];
  const [step, setStep] = useState(0);
  const [load, setLoad] = useState('balanced');
  const { ref, width, animated } = useFigureWidth();
  const m = measure(width);
  const routes = load === 'hot' ? HOT : BALANCED;
  const cells = movingCells(method, routes, step, m);

  return (
    <Figure figureRef={ref} animated={animated}>
      <Toggle
        label="Router load"
        options={[
          { value: 'balanced', label: 'Balanced' },
          { value: 'hot', label: 'Hot expert' },
        ]}
        value={load}
        onChange={setLoad}
      />
      <DiagramSvg width={width} height={m.height} label={config.label}>
        <Frame m={m} routes={routes} step={step} />
        {cells.map(({ key, ...cell }) => (
          <Cell key={key} size={m.size} {...cell} />
        ))}
        {TOKENS.map((t) => {
          const { x, y } = m.output(t);
          return (
            <Cell
              key={`output-${t}`}
              x={x}
              y={y}
              size={m.size}
              fill={DEVICE_COLORS[home(t)]}
              opacity={step === 3 ? 1 : 0}
              arriving={step === 3}
            />
          );
        })}
      </DiagramSvg>
      <Legend
        items={[
          { fill: DEVICE_COLORS[0], label: 'token, colored by its device' },
          { fill: DEVICE_COLORS[0], hatched: true, label: 'expert output' },
          ...(method === 'gather-scatter' ? [{ fill: ZERO_COLOR, label: 'zeros' }] : []),
        ]}
      />
      <StepLine
        lines={config.lines[load]}
        step={step}
        reserve={config.lines[load === 'hot' ? 'balanced' : 'hot']}
      />
      <StepControls step={step} total={config.lines[load].length} onStep={setStep} />
    </Figure>
  );
}
