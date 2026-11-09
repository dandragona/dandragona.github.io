import { useState } from 'react';
import {
  INK,
  useFigureWidth,
  Figure,
  DiagramSvg,
  StepLine,
  StepControls,
  Legend,
} from './diagram-kit.jsx';

// One device's timeline. Each step is a different schedule for the same
// blocks, so blocks slide (and, for the ring comparison, stretch) between steps.
// Times are in arbitrary units. `start`, `dur`, and `shown` hold one value per
// step, or a single value when it doesn't change.

export const COMPUTE_FILL = '#44403c';
export const TRANSFER_FILL = 'rgba(255, 255, 255, 0.6)';
export const TRANSFER_STROKE = 'rgba(41, 37, 36, 0.55)';

export const LABEL_WIDTH = 66;
// Block labels are 11px, so each character is 0.6 × 11px wide.
const BLOCK_CHAR_WIDTH = 6.6;
const BLOCK_TEXT_X = 3;
export const RIGHT_PAD = 8;
export const AXIS_HEIGHT = 22;
const GROUP_HEADER = 22;
const GROUP_GAP = 14;
export const LANE_HEIGHT = 32;
export const BLOCK_HEIGHT = 26;
// Room above the lanes for dependency arcs, and below them for the line that
// collects the feeder blocks.
const ARC_SPACE = 20;
const BUS_SPACE = 12;
const ARROW_COLOR = 'rgba(41, 37, 36, 0.7)';

export const compute = (key, lane, label, short, start, dur) => ({ key, lane, label, short, start, dur, kind: 'compute' });
export const transfer = (key, lane, label, short, start, dur) => ({ key, lane, label, short, start, dur, kind: 'transfer' });

const LANES = [
  { id: 'c', label: 'compute' },
  { id: 'n', label: 'network' },
];

const SCHEDULES = {
  // The middle step adds arrows for what each block waits for. No arrow runs
  // from an all-reduce back into a layer, which is why the last step can slide
  // the all-reduces under the compute.
  dp: {
    label: 'Data parallelism backward pass: what each block waits for, without and with overlap',
    groups: [{ lanes: LANES }],
    blocks: [
      ...[4, 3, 2, 1].map((layer, i) => compute(`c${layer}`, 'c', `layer ${layer}`, `L${layer}`, 4 * i, 4)),
      ...[4, 3, 2, 1].map((layer, i) =>
        transfer(`n${layer}`, 'n', `∂W${layer}`, `∂W${layer}`, [16 + 4 * i, 16 + 4 * i, 4 * (i + 1)], 4),
      ),
      compute('opt', 'c', 'optimizer', 'opt', [32, 32, 20], 4),
    ],
    deps: { fromStep: 1, chain: ['c4', 'c3', 'c2', 'c1'], chainLabel: '∂X', feeders: ['n4', 'n3', 'n2', 'n1'], into: 'opt' },
    lines: [
      'Without overlap, the all-reduces start after the whole backward pass, and then the optimizer runs.',
      'Arrows show what each layer and the optimizer wait for. Each layer waits only for ∂X from the layer above it. Only the optimizer waits for the all-reduces.',
      'So each all-reduce can start when its layer finishes and run during the next layer. Only the last one adds time.',
    ],
  },
  fsdp: {
    label: 'FSDP forward pass, without and with gathering ahead',
    groups: [{ lanes: LANES }],
    blocks: [
      ...[1, 2, 3, 4].map((layer, i) =>
        transfer(`g${layer}`, 'n', `W${layer}`, `W${layer}`, [7 * i, i === 0 ? 0 : 4 * i - 1], 3),
      ),
      ...[1, 2, 3, 4].map((layer, i) => compute(`c${layer}`, 'c', `layer ${layer}`, `L${layer}`, [7 * i + 3, 4 * i + 3], 4)),
    ],
    lines: [
      'Without gathering ahead, each layer waits for its all-gather.',
      'Gathering ahead: each all-gather runs during the previous layer. Only the first one adds time.',
    ],
  },
  // Forward pass on 4 devices. A ring block takes 4 units to compute, and the
  // network moves one NA(S/P)H unit of data in 1 (fast) or 5 (slow) units.
  // Ring sends 2 data units per hop; Ulysses sends 2.25 out and 0.75 back.
  'ring-ulysses': {
    label: 'Ring attention and Ulysses forward pass on a fast and a slow network',
    groups: [
      {
        title: 'Ring attention',
        lanes: [
          { id: 'rc', label: 'compute' },
          { id: 'rn', label: 'network' },
        ],
      },
      {
        title: 'Ulysses',
        lanes: [
          { id: 'uc', label: 'compute' },
          { id: 'un', label: 'network' },
        ],
      },
    ],
    blocks: [
      ...[0, 1, 2, 3].map((b) => compute(`rc${b}`, 'rc', `block ${b + 1}`, `${b + 1}`, [4 * b, 10 * b], 4)),
      ...[0, 1, 2].map((b) => transfer(`rn${b}`, 'rn', 'send', '', [4 * b, 10 * b], [2, 10])),
      transfer('un0', 'un', 'all-to-all', '', 0, [2.25, 11.25]),
      compute('uc', 'uc', 'attention', '', [2.25, 11.25], 16),
      transfer('un1', 'un', 'all-to-all', '', [18.25, 27.25], [0.75, 3.75]),
    ],
    lines: [
      'Fast network: each ring send finishes during a block’s compute, so ring never waits. Ulysses waits for both all-to-alls.',
      'Slow network: ring now waits for every send. Ulysses moves half as much data, so it finishes first.',
    ],
  },
};

const at = (value, step) => (Array.isArray(value) ? value[step] : value);
const isShown = (block, step) => at(block.shown ?? true, step);
const blockEnd = (block, step) => at(block.start, step) + at(block.dur, step);

function fitLabel(block, width) {
  for (const text of [block.label, block.short]) {
    if (text && text.length * BLOCK_CHAR_WIDTH + 2 * BLOCK_TEXT_X - 1 <= width) return text;
  }
  return '';
}

function layout(schedule) {
  let y = AXIS_HEIGHT + (schedule.deps ? ARC_SPACE : 0);
  const laneY = {};
  const groups = schedule.groups.map((group) => {
    const top = y;
    if (group.title) y += GROUP_HEADER;
    group.lanes.forEach((lane) => {
      laneY[lane.id] = y;
      y += LANE_HEIGHT;
    });
    const placed = { ...group, top, bottom: y };
    y += GROUP_GAP;
    return placed;
  });
  return { groups, laneY, height: y - GROUP_GAP + 4 + (schedule.deps ? BUS_SPACE : 0) };
}

// A small filled triangle with its tip at (x, y), pointing along (dx, dy).
function arrowHead(x, y, dx, dy, size = 5) {
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  const bx = x - ux * size;
  const by = y - uy * size;
  const px = -uy * size * 0.6;
  const py = ux * size * 0.6;
  return `M ${x} ${y} L ${bx + px} ${by + py} L ${bx - px} ${by - py} Z`;
}

// Arcs along a chain of blocks, plus a line from each feeder block into one
// block that waits for all of them. The feeder lines move with their blocks.
function Dependencies({ deps, blocks, step, x0, scale, laneY }) {
  const byKey = Object.fromEntries(blocks.map((block) => [block.key, block]));
  const centerX = (key) => x0 + (at(byKey[key].start, step) + at(byKey[key].dur, step) / 2) * scale;
  const top = (key) => laneY[byKey[key].lane] + 3;
  const bottom = (key) => top(key) + BLOCK_HEIGHT;
  const busY = Math.max(...deps.feeders.map(bottom)) + BUS_SPACE - 4;
  const busStart = Math.min(...deps.feeders.map(centerX));
  const intoX = centerX(deps.into);
  const intoBottom = bottom(deps.into);

  return (
    <g
      className="pd-fade"
      style={{ opacity: step >= deps.fromStep ? 1 : 0 }}
      stroke={ARROW_COLOR}
      strokeWidth={1.5}
      fill="none"
    >
      {deps.chain.slice(1).map((key, i) => {
        const ax = centerX(deps.chain[i]);
        const bx = centerX(key);
        const mx = (ax + bx) / 2;
        const y = top(key) - 2;
        return (
          <g key={key}>
            <path d={`M ${ax} ${y} Q ${mx} ${y - 14} ${bx} ${y}`} />
            <path d={arrowHead(bx, y, bx - mx, 14)} fill={ARROW_COLOR} stroke="none" />
            <text className="pd-small" x={mx} y={y - 11} textAnchor="middle" stroke="none">
              {deps.chainLabel}
            </text>
          </g>
        );
      })}
      {deps.feeders.map((key) => (
        <g key={key} className="pd-cell" style={{ transform: `translate(${centerX(key)}px, 0px)` }}>
          <line x1={0} x2={0} y1={bottom(key)} y2={busY} />
        </g>
      ))}
      <g className="pd-cell" style={{ transform: `translate(${busStart}px, ${busY}px)` }}>
        <rect
          className="pd-block"
          y={-0.75}
          height={1.5}
          width={intoX - busStart}
          style={{ width: intoX - busStart }}
          fill={ARROW_COLOR}
          stroke="none"
        />
      </g>
      <g className="pd-cell" style={{ transform: `translate(${intoX}px, 0px)` }}>
        <line x1={0} x2={0} y1={busY + 0.75} y2={intoBottom + 4} />
        <path d={arrowHead(0, intoBottom + 1, 0, -1)} fill={ARROW_COLOR} stroke="none" />
      </g>
    </g>
  );
}

export function Block({ block, step, x0, scale, laneY }) {
  const start = at(block.start, step);
  // A minimum width keeps very short transfers visible.
  const width = Math.max(5, at(block.dur, step) * scale - 2);
  const isCompute = block.kind === 'compute';
  const text = fitLabel(block, width);
  return (
    <g
      className="pd-cell"
      style={{
        transform: `translate(${x0 + start * scale}px, ${laneY[block.lane] + 3}px)`,
        opacity: isShown(block, step) ? 1 : 0,
      }}
    >
      <rect
        className="pd-block"
        width={width}
        height={BLOCK_HEIGHT}
        rx={4}
        style={{ width }}
        fill={isCompute ? COMPUTE_FILL : TRANSFER_FILL}
        stroke={isCompute ? 'none' : TRANSFER_STROKE}
      />
      {text && (
        <text className={isCompute ? 'pd-small pd-on-dark' : 'pd-small'} x={BLOCK_TEXT_X} y={BLOCK_HEIGHT / 2 + 4}>
          {text}
        </text>
      )}
    </g>
  );
}

export function EndMarker({ x, top, bottom, visible = true }) {
  return (
    <g className="pd-cell" style={{ transform: `translate(${x}px, 0px)`, opacity: visible ? 1 : 0 }}>
      <line x1={0} x2={0} y1={top} y2={bottom} stroke={INK} strokeWidth={1.5} strokeDasharray="3 3" />
    </g>
  );
}

export default function Timeline({ schedule: name }) {
  const schedule = SCHEDULES[name];
  const [step, setStep] = useState(0);
  const { ref, width, animated } = useFigureWidth();
  const { groups, laneY, height } = layout(schedule);

  const ends = schedule.lines.map((_, s) =>
    Math.max(...schedule.blocks.filter((b) => isShown(b, s)).map((b) => blockEnd(b, s))),
  );
  const x0 = LABEL_WIDTH;
  const scale = (width - LABEL_WIDTH - RIGHT_PAD) / Math.max(...ends);
  const laneGroup = (laneId) => groups.find((g) => g.lanes.some((lane) => lane.id === laneId));
  const groupEnd = (group) =>
    Math.max(
      ...schedule.blocks
        .filter((b) => laneGroup(b.lane) === group && isShown(b, step))
        .map((b) => blockEnd(b, step)),
    );

  return (
    <Figure figureRef={ref} animated={animated}>
      <DiagramSvg width={width} height={height} label={schedule.label}>
        <text x={width - RIGHT_PAD} y={13} textAnchor="end">
          time →
        </text>
        <line x1={x0} x2={width - RIGHT_PAD} y1={18} y2={18} stroke="rgba(41, 37, 36, 0.3)" />
        {groups.map((group) => (
          <g key={group.top}>
            {group.title && (
              <text x={0} y={group.top + 15}>
                {group.title}
              </text>
            )}
            {group.lanes.map((lane) => (
              <g key={lane.id}>
                <rect
                  x={x0}
                  y={laneY[lane.id] + 3}
                  width={width - x0 - RIGHT_PAD}
                  height={BLOCK_HEIGHT}
                  rx={4}
                  fill="rgba(41, 37, 36, 0.06)"
                />
                <text x={x0 - 8} y={laneY[lane.id] + 3 + BLOCK_HEIGHT / 2 + 4} textAnchor="end">
                  {lane.label}
                </text>
              </g>
            ))}
            <EndMarker
              x={x0 + groupEnd(group) * scale}
              top={(group.title ? group.top + GROUP_HEADER : group.top) - 2}
              bottom={group.bottom + 2}
            />
          </g>
        ))}
        {schedule.blocks.map((block) => (
          <Block key={block.key} block={block} step={step} x0={x0} scale={scale} laneY={laneY} />
        ))}
        {schedule.deps && (
          <Dependencies
            deps={schedule.deps}
            blocks={schedule.blocks}
            step={step}
            x0={x0}
            scale={scale}
            laneY={laneY}
          />
        )}
      </DiagramSvg>
      <Legend
        items={[
          { fill: COMPUTE_FILL, label: 'compute' },
          { fill: TRANSFER_FILL, stroke: TRANSFER_STROKE, label: 'transfer' },
          { dashed: true, label: 'end' },
        ]}
      />
      <StepLine lines={schedule.lines} step={step} />
      <StepControls step={step} total={schedule.lines.length} onStep={setStep} />
    </Figure>
  );
}
