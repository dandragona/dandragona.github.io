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
  Legend,
} from './diagram-kit.jsx';

// One collective on four devices. Each row is a device with four slots, one
// per piece. Piece p's color is DEVICE_COLORS[p], except in the all-to-all,
// where a piece takes its sender's color. The ring algorithms send to the next
// device each round, wrapping from device 3 to device 0. A wrapping send fades
// in place, so it doesn't look like it stops at devices 2 and 1 on the way.

const P = 4;
const DEVICES = Array.from({ length: P }, (_, i) => i);
const LABEL_WIDTH = 74;
const COLUMN_GAP = 4;
const ROW_GAP = 10;
const HEADER_HEIGHT = 20;

const mod = (n) => ((n % P) + P) % P;

const PARTIAL_LINES = [
  'Each device has a partial sum for every piece. The number shows how many devices it includes.',
  'Round 1: each device sends one partial sum to the next device, which adds it to its own.',
  'Round 2: each device sends the sum it just added to, and the next device adds again.',
];

const KINDS = {
  'all-gather': {
    label: 'All-gather on four devices',
    lines: [
      'Each device starts with one of the 4 pieces.',
      'Round 1: each device sends its piece to the next device and keeps a copy.',
      'Round 2: each device forwards the piece it just received.',
      'Round 3: every device has all 4 pieces. Each device received 3.',
    ],
  },
  'reduce-scatter': {
    label: 'Reduce-scatter on four devices',
    lines: [...PARTIAL_LINES, 'Round 3: each device has one complete piece, summed over all 4 devices.'],
  },
  'all-reduce': {
    label: 'All-reduce on four devices',
    lines: [
      ...PARTIAL_LINES,
      'Round 3: each device has one complete piece. This is a reduce-scatter.',
      'Round 4: an all-gather starts. Each device sends its complete piece to the next device.',
      'Round 5: each device forwards the piece it just received.',
      'Round 6: every device has the complete sum of every piece.',
    ],
  },
  'all-to-all': {
    label: 'All-to-all on four devices',
    lines: [
      'Each device has 4 pieces, one for each device. Colors show the sender.',
      'Each device sends piece j to device j. Now each device has one piece from every device.',
    ],
  },
};

// Ring all-gather starting `offset` steps in: in round j, piece p reaches
// device p + j. A copy waits, hidden, under the device that will send it.
function allGatherCells(step, offset) {
  const round = step - offset;
  return DEVICES.flatMap((p) =>
    [1, 2, 3].map((j) => ({
      key: `copy-${p}-${j}`,
      device: mod(p + (round >= j ? j : j - 1)),
      slot: p,
      fill: DEVICE_COLORS[p],
      opacity: round >= j ? 1 : 0,
      jump: mod(p + j) === 0,
    })),
  );
}

// Ring reduce-scatter: in round k, device i sends its partial sum of piece
// i - k to device i + 1, which adds it in. counts[step][d][p] is how many
// devices' values device d's partial sum of piece p includes, or 0 once sent.
function reduceScatterHistory() {
  const counts = DEVICES.map(() => DEVICES.map(() => 1));
  const sentAt = DEVICES.map(() => DEVICES.map(() => 0));
  const history = [counts.map((row) => [...row])];
  for (let k = 1; k < P; k++) {
    const sends = DEVICES.map((i) => [i, mod(i - k), counts[i][mod(i - k)]]);
    sends.forEach(([i, p]) => {
      counts[i][p] = 0;
      sentAt[i][p] = k;
    });
    sends.forEach(([i, p, count]) => {
      counts[mod(i + 1)][p] += count;
    });
    history.push(counts.map((row) => [...row]));
  }
  return { history, sentAt };
}

const RS = reduceScatterHistory();

function reduceScatterCells(step) {
  const n = Math.min(step, P - 1);
  return DEVICES.flatMap((d) =>
    DEVICES.map((p) => {
      const key = `sum-${d}-${p}`;
      const fill = DEVICE_COLORS[p];
      const sent = RS.sentAt[d][p];
      if (sent && sent <= n) {
        const count = RS.history[sent - 1][d][p];
        return {
          key,
          device: mod(d + 1),
          slot: p,
          fill,
          hatched: true,
          label: count,
          opacity: 0,
          arriving: sent === step,
          jump: d === P - 1,
        };
      }
      const count = RS.history[n][d][p];
      const complete = count === P;
      return {
        key,
        device: d,
        slot: p,
        fill,
        hatched: !complete,
        label: complete ? undefined : count,
        late: step === n && n > 0 && count !== RS.history[n - 1][d][p],
        jump: d === P - 1,
      };
    }),
  );
}

function cellsFor(kind, step) {
  if (kind === 'all-to-all') {
    return DEVICES.flatMap((d) =>
      DEVICES.map((j) => ({
        key: `piece-${d}-${j}`,
        device: step === 0 ? d : j,
        slot: step === 0 ? j : d,
        fill: DEVICE_COLORS[d],
      })),
    );
  }
  if (kind === 'all-gather') {
    const originals = DEVICES.map((p) => ({ key: `piece-${p}`, device: p, slot: p, fill: DEVICE_COLORS[p] }));
    return [...originals, ...allGatherCells(step, 0)];
  }
  if (kind === 'reduce-scatter') return reduceScatterCells(step);
  return [...reduceScatterCells(step), ...allGatherCells(step, P - 1)];
}

function measure(width) {
  const room = (width - LABEL_WIDTH) / P - COLUMN_GAP;
  const size = Math.max(18, Math.min(30, Math.floor(room)));
  const pitchX = size + COLUMN_GAP;
  const pitchY = size + ROW_GAP;
  const gridWidth = P * pitchX - COLUMN_GAP;
  const left = (width - LABEL_WIDTH - gridWidth) / 2 + LABEL_WIDTH;
  return {
    size,
    left,
    height: HEADER_HEIGHT + P * pitchY - ROW_GAP,
    cellX: (slot) => left + slot * pitchX,
    cellY: (device) => HEADER_HEIGHT + device * pitchY,
  };
}

export default function Collective({ kind }) {
  const config = KINDS[kind];
  const [step, setStep] = useState(0);
  const { ref, width, animated } = useFigureWidth();
  const m = measure(width);
  const reduces = kind === 'reduce-scatter' || kind === 'all-reduce';

  return (
    <Figure figureRef={ref} animated={animated}>
      <DiagramSvg width={width} height={m.height} label={config.label}>
        {DEVICES.map((p) => (
          <text key={p} className="pd-small" x={m.cellX(p) + m.size / 2} y={12} textAnchor="middle" opacity={0.75}>
            {p}
          </text>
        ))}
        {DEVICES.map((d) => (
          <g key={d}>
            <text x={m.left - 10} y={m.cellY(d) + m.size / 2 + 4} textAnchor="end">
              Device {d}
            </text>
            {DEVICES.map((p) => (
              <Slot key={p} x={m.cellX(p)} y={m.cellY(d)} size={m.size} />
            ))}
          </g>
        ))}
        {cellsFor(kind, step).map(({ key, device, slot, ...cell }) => (
          <Cell key={key} x={m.cellX(slot)} y={m.cellY(device)} size={m.size} {...cell} />
        ))}
      </DiagramSvg>
      {reduces && (
        <Legend
          items={[
            { fill: DEVICE_COLORS[0], hatched: true, label: 'partial sum' },
            { fill: DEVICE_COLORS[0], label: 'complete sum' },
          ]}
        />
      )}
      <StepLine lines={config.lines} step={step} />
      <StepControls step={step} total={config.lines.length} onStep={setStep} />
    </Figure>
  );
}
