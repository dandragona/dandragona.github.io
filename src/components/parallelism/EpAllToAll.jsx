import { useState } from 'react';
import {
  CHIP_COLORS,
  A2A,
  ABSENT,
  INK_SOFT,
  CARD_BG,
  CARD_BORDER,
  CELL,
  GAP,
  TensorGrid,
  OpSymbol,
  StepControls,
  WidgetShell,
  Caption,
  Legend,
  buttonStyle,
} from './staircase-shared.jsx';

// Expert parallelism — all-to-all dispatch, local FFN, all-to-all combine.
// The structural analogue of Ulysses attention, and it inherits Ulysses's
// core grammar: every grid drawn is the FULL logical token tensor
// [S=8 tokens x E columns] — sharding is which cells are resident (a
// device's color) vs pale (ABSENT), never a change of grid shape.
//
// The inversion vs Ulysses: there the *destination* was structural (a head
// column), so cells were colored by the device that owned them. Here the
// *home* is structural (row band i -> floor(i/SP)), so cells are colored
// instead by the expert the router assigns them to — except at the two
// bookend steps (before the router has spoken, and once outputs are back
// home), where a band simply wears its home device's color, since home and
// assigned expert haven't yet diverged (or have converged again). Expert d
// lives on device d, so CHIP_COLORS[d] doubles as "expert d" and "device d"
// — the same swatch means both, and that's the point: watch a device's band
// flip from "my tokens" (home) to "my expert's tokens" (assigned) and back
// across the two all-to-alls.

const P = 4;
const S = 8;
const SP = 2; // S/P tokens per device
const E = 2; // drawn width of X/Y, and W_d's [E, E] shape
const GRID_H = S * CELL + (S - 1) * GAP; // 126 — shared containerHeight for every grid
const CONTENT_W = 160; // widest row: X[8x2] @ W_d[2x2] = Y[8x2]
const TOTAL_STEPS = 6;
const COMPUTE = '#92400e';

const HOME = (i) => Math.floor(i / SP);

// These arrays are also the FIRST picks of EpRing's top-2 router (PICKS_*[r][0]) — keep in sync.
// Each expert gets exactly 2 tokens; token 6 (home device 3, expert 3) stays local.
const ASSIGN_BALANCED = [1, 2, 0, 3, 1, 0, 3, 2];
// Expert 0 drowns with 5 tokens, expert 1 starves with 0, experts 2 and 3 split the rest.
const ASSIGN_HOT = [0, 0, 0, 3, 0, 0, 3, 2];

const PHASES = [
  { label: 'sequence-sharded', accent: INK_SOFT },
  { label: 'router assigns experts', accent: COMPUTE },
  { label: 'all-to-all #1 · dispatch', accent: A2A },
  { label: 'local expert FFN', accent: COMPUTE },
  { label: 'all-to-all #2 · combine', accent: A2A },
  { label: 'sequence-sharded output', accent: INK_SOFT },
];

const CAPTIONS_BASE = [
  "Sequence-sharded, exactly like the dense layers before it: device d owns two of the eight token rows of X [S/P, E] — its home band, HOME(i) = floor(i/SP) — and already holds its own expert's weight W_d [E, E] — drawn once, standing in for the FFN's two E-wide matmuls (expert d lives on device d). Every grid drawn is the full logical token tensor, and pale cells simply live elsewhere.",
  "The router looks at each token and decides which expert it goes to; X's resident rows recolor to that expert's color — the recolor IS the routing decision, not a move. Row position still encodes where a token lives (device d still holds the same two rows), so nothing is lost by recoloring: only where the token is going next has changed.",
  "All-to-all #1 dispatches every token to the device that owns its assigned expert: device d now holds only the tokens routed to expert d — however many the router sent it, S/P apiece only because this router is balanced — and ringed cells just arrived from elsewhere. The expert FFN has no input until this lands, so it is a hard sync: every device stalls through it together.",
  "Device d runs its expert FFN locally on whatever landed on it: T @ W_d = Y — one square matrix standing in for the FFN's two E-wide matmuls, ~E² per token. Compare that to what the two all-to-alls moved: only a ~E-sized activation per token, there and back. The bet the roofline makes is that E² drowns that round trip — the same amortization Ulysses leans on with attention's S².",
  "All-to-all #2 sends each expert's output back to the token's home device: Y is colored by the expert that computed it, and ringed cells traveled to get there. This collective can't complete until the slowest expert finishes — one hot expert stalls the combine for every other device, no matter how quickly they finished their own FFN.",
  "Recolored back to its home device, Y takes the exact sequence-sharded shape X arrived in — the loop closes, but only once the slowest expert's contribution has landed via the combine. The dense layers that follow carry on as plain data parallelism, sequence-sharded as before.",
];

const HOT_ADDENDUM = {
  2: "Under the hot-expert schedule, expert 0 draws five of the eight tokens while expert 1 draws none — the same collective, just wildly uneven traffic.",
  3: "Device 1 sits idle this step — expert 1 got zero tokens — while device 0 works through five, one hot expert doing two-and-a-half times the FFN work of a balanced one (five tokens against the even share of two).",
  4: "The combine can't finish until device 0's queue drains: one hot expert stalls the sync for everyone else, however fast they finished.",
  5: "The time lost to the hot expert is upstream of this step — the output band lands exactly where it always does, it just landed late.",
};

function slotsFor(step, d, ASSIGN) {
  const C = CHIP_COLORS;
  const homeFill = (r) => (HOME(r) === d ? { fill: C[d] } : { fill: ABSENT });
  const nd = ASSIGN.filter((a) => a === d).length;

  switch (step) {
    case 0:
      return [
        { key: 'x', type: 'grid', name: 'X', sub: '[S/P, E]', rows: S, cols: E, fill: homeFill },
        { key: 'w', type: 'grid', name: 'W_d', sub: `expert ${d}`, rows: E, cols: E, fill: () => ({ fill: C[d] }) },
      ];
    case 1:
      return [
        {
          key: 'x',
          type: 'grid',
          name: 'X',
          sub: '[S/P, E]',
          rows: S,
          cols: E,
          fill: (r) => (HOME(r) === d ? { fill: C[ASSIGN[r]] } : { fill: ABSENT }),
        },
        { key: 'w', type: 'grid', name: 'W_d', sub: `expert ${d}`, rows: E, cols: E, fill: () => ({ fill: C[d] }) },
      ];
    case 2:
      return [
        {
          key: 'x',
          type: 'grid',
          name: 'T',
          sub: `[${nd}, E] · expert ${d}`,
          rows: S,
          cols: E,
          fill: (r) => (ASSIGN[r] === d ? { fill: C[d], highlight: HOME(r) !== d && A2A } : { fill: ABSENT }),
        },
      ];
    case 3:
      return [
        {
          key: 'x',
          type: 'grid',
          name: 'T',
          sub: `[${nd}, E] · expert ${d}`,
          rows: S,
          cols: E,
          fill: (r) => (ASSIGN[r] === d ? { fill: C[d] } : { fill: ABSENT }),
        },
        { key: 'op1', type: 'op', sym: '@' },
        { key: 'w', type: 'grid', name: 'W_d', sub: `expert ${d}`, rows: E, cols: E, fill: () => ({ fill: C[d] }) },
        { key: 'op2', type: 'op', sym: '=' },
        {
          key: 'y',
          type: 'grid',
          name: 'Y',
          sub: nd > 0 ? `[${nd}, E] · expert ${d}` : 'idle — no tokens',
          rows: S,
          cols: E,
          fill: (r) => (ASSIGN[r] === d ? { fill: C[d] } : { fill: ABSENT }),
          frame: nd > 0 ? COMPUTE : undefined,
        },
      ];
    case 4:
      return [
        {
          key: 'y',
          type: 'grid',
          name: 'Y',
          sub: '[S/P, E]',
          rows: S,
          cols: E,
          fill: (r) => (HOME(r) === d ? { fill: C[ASSIGN[r]], highlight: ASSIGN[r] !== d && A2A } : { fill: ABSENT }),
        },
      ];
    default:
      return [{ key: 'y', type: 'grid', name: 'Y', sub: '[S/P, E]', rows: S, cols: E, fill: homeFill }];
  }
}

function DevicePanel({ d, step, ASSIGN }) {
  const slots = slotsFor(step, d, ASSIGN);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '10px 10px',
        borderRadius: 12,
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: CHIP_COLORS[d], fontWeight: 700 }}>
        Device {d}
      </div>
      <div style={{ width: CONTENT_W, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 3 }}>
        {slots.map((slot) =>
          slot.type === 'op' ? (
            <OpSymbol key={slot.key} containerHeight={GRID_H}>
              {slot.sym}
            </OpSymbol>
          ) : (
            <TensorGrid
              key={slot.key}
              name={slot.name}
              subtitle={slot.sub}
              rows={slot.rows}
              cols={slot.cols}
              getFill={slot.fill}
              containerHeight={GRID_H}
              cellSize={CELL}
              frame={slot.frame}
            />
          )
        )}
      </div>
    </div>
  );
}

export default function EpAllToAll() {
  const [step, setStep] = useState(0);
  const [hot, setHot] = useState(false);
  const ASSIGN = hot ? ASSIGN_HOT : ASSIGN_BALANCED;
  const phase = PHASES[step];
  const caption = CAPTIONS_BASE[step] + (hot && HOT_ADDENDUM[step] ? ` ${HOT_ADDENDUM[step]}` : '');

  return (
    <WidgetShell
      title="Expert parallelism — all-to-all dispatch, local FFN, all-to-all combine"
      subtitle="Four devices, one expert each — the maximal case, since expert parallelism can't shard past one device per expert. Every card draws the full logical token tensor [S=8, E]; rows are colored by the expert the router assigns them to (before the router speaks, and once outputs land back home, they wear their home device's color). Watch device d's band flip from 'my tokens' (home) to 'my expert's tokens' (assigned) and back — the same seq ↔ head transpose Ulysses runs, just relabeled."
    >
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button onClick={() => setHot(false)} style={buttonStyle(false, !hot)}>
          Balanced router
        </button>
        <button onClick={() => setHot(true)} style={buttonStyle(false, hot)}>
          One hot expert
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: phase.accent,
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            minHeight: 16,
          }}
        >
          {phase.label}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 460, margin: '0 auto' }}>
        {Array.from({ length: P }, (_, d) => (
          <DevicePanel key={d} d={d} step={step} ASSIGN={ASSIGN} />
        ))}
      </div>

      <Legend
        items={[
          { fill: CHIP_COLORS[0], label: 'expert 0 / device 0' },
          { fill: CHIP_COLORS[1], label: 'expert 1 / device 1' },
          { fill: CHIP_COLORS[2], label: 'expert 2 / device 2' },
          { fill: CHIP_COLORS[3], label: 'expert 3 / device 3' },
          { fill: ABSENT, label: 'elsewhere' },
          { fill: CHIP_COLORS[0], ring: A2A, label: 'moved by all-to-all' },
        ]}
      />

      <Caption>{caption}</Caption>
      <StepControls step={step} totalSteps={TOTAL_STEPS} setStep={setStep} />
    </WidgetShell>
  );
}
