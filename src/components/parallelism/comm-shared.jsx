// Presentational communication primitives shared by the CP/EP forward
// widgets (RingAttention, EpRing, and — for the exposed-comm schedules —
// UlyssesAttention and EpAllToAll). Pure: all step/schedule logic stays in
// the consuming widget, which passes fully-resolved `visible`/`active` flags.
//
//   LaneTimeline — the two-(or N-)lane compute/comm Gantt, same visual grammar
//     as TpStaircase's inline Timeline but data-driven and continuous-time
//     (start/dur in arbitrary units), so non-uniform schedules (Ulysses hard
//     syncs, an imbalanced-EP hot expert) express directly.

import { CHIP_COLORS, YELLOW, INK_SOFT } from './staircase-shared.jsx';

const PAD_LEFT = 110;
const PAD_RIGHT = 16;
const LANE_HEIGHT = 34;
const LANE_GAP = 12;
const PAD_TOP = 26;
const PAD_BOTTOM = 8;

// lanes:  [{ id, label }]                          — rendered top → bottom
// blocks: [{ lane, start, dur, label, color, kind: 'compute'|'comm',
//            visible, active }]
// annotations: [{ lane, start, dur, text, visible }] — italic idle notes
export function LaneTimeline({ width = 600, duration, lanes, blocks, annotations = [], footnote }) {
  const innerWidth = width - PAD_LEFT - PAD_RIGHT;
  const scale = innerWidth / duration;
  const n = lanes.length;
  const laneY = (id) => {
    const i = lanes.findIndex((l) => l.id === id);
    return PAD_TOP + i * (LANE_HEIGHT + LANE_GAP);
  };
  const svgHeight = PAD_TOP + n * LANE_HEIGHT + (n - 1) * LANE_GAP + PAD_BOTTOM;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <svg
        viewBox={`0 0 ${width} ${svgHeight}`}
        width="100%"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <text x={PAD_LEFT + innerWidth} y={PAD_TOP - 10} textAnchor="end" fontSize={10} fill={INK_SOFT}>
          time →
        </text>
        <line
          x1={PAD_LEFT}
          y1={PAD_TOP - 4}
          x2={PAD_LEFT + innerWidth}
          y2={PAD_TOP - 4}
          stroke="rgba(31,41,55,0.18)"
        />

        {lanes.map((lane) => (
          <text
            key={lane.id}
            x={PAD_LEFT - 12}
            y={laneY(lane.id) + LANE_HEIGHT / 2 + 4}
            textAnchor="end"
            fontSize={11}
            fill={INK_SOFT}
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {lane.label}
          </text>
        ))}

        {annotations
          .filter((a) => a.visible)
          .map((a, i) => (
            <text
              key={`ann-${i}`}
              x={PAD_LEFT + (a.start + a.dur / 2) * scale}
              y={laneY(a.lane) + LANE_HEIGHT / 2 + 3.5}
              textAnchor="middle"
              fontSize={10}
              fontStyle="italic"
              fill={INK_SOFT}
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {a.text}
            </text>
          ))}

        {blocks
          .filter((b) => b.visible)
          .map((b, i) => {
            const y = laneY(b.lane);
            const x = PAD_LEFT + b.start * scale;
            const w = Math.max(b.dur * scale - 6, 0);
            const cx = PAD_LEFT + (b.start + b.dur / 2) * scale;
            const color = b.color || CHIP_COLORS[0];
            const comm = b.kind === 'comm';
            const showLabel = w > 34 && b.label;
            return (
              <g key={`blk-${i}`}>
                <rect
                  x={x + 3}
                  y={y + 2}
                  width={w}
                  height={LANE_HEIGHT - 4}
                  rx={5}
                  fill={color}
                  fillOpacity={comm ? 0.16 : b.active ? 1 : 0.7}
                  stroke={b.active ? YELLOW : comm ? color : 'none'}
                  strokeWidth={comm ? (b.active ? 2.5 : 1.5) : 2}
                  strokeDasharray={comm ? '4 3' : 'none'}
                />
                {showLabel && (
                  <text
                    x={cx}
                    y={y + LANE_HEIGHT / 2 + 4}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    fill={comm ? color : '#ffffff'}
                    fontFamily="ui-monospace, SFMono-Regular, monospace"
                  >
                    {b.label}
                  </text>
                )}
              </g>
            );
          })}
      </svg>
      {footnote && (
        <div
          style={{
            fontSize: 10,
            color: INK_SOFT,
            fontStyle: 'italic',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '0 12px',
          }}
        >
          {footnote}
        </div>
      )}
    </div>
  );
}
