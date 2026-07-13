import { useState } from 'react';
import {
  CHIP_COLORS,
  ABSENT,
  INK_SOFT,
  CARD_BG,
  CARD_BORDER,
  CELL,
  GAP,
  YELLOW,
  TensorGrid,
  OpSymbol,
  StepControls,
  WidgetShell,
  Caption,
  Legend,
  buttonStyle,
} from './staircase-shared.jsx';

// Expert parallelism — all-gather / reduce-scatter routing, drawn at TOP-2.
//
// Top-2 is a design decision, not decoration: at top-1 the reduce-scatter's
// "sum" is one real row plus P−1 zeros, so the reduce never happens in the
// picture. At top-2 every token has two expert contributions living on two
// devices, and the reduce-scatter genuinely folds them — k rows becoming one
// — which is the whole reason this figure exists. (The sibling EpAllToAll
// stays top-1 on purpose: its combine is a pure permutation there, honestly
// drawn as one; the pair covers both worlds with each widget committing to
// one.)
//
// The drawn widths tell the token's dimensional story: 1 → 2 → 1. The token
// grids (X, T, Y) are drawn ONE cell wide — the token as an atomic value; E
// survives in their labels ([S/P, E]) but gets no drawn columns, because an
// earlier draft drew X at E=2 and the two 2's collided: a reader couldn't tell
// whether a token grid's "2 columns" meant hidden width or top-2. So R [S, 2]
// is the only TOKEN grid ever drawn two columns wide — the router turning one
// token into two picks IS the ×2 blow-up, dimensionally explicit — and it is a
// doubling of (token, expert) PAIRS, not of token data: routing replicates a
// token to two experts, it never widens it. The output lands back at ONE
// column because the reduce-scatter folds the two contributions into one row.
// W_d [E, E] is the one exception: it keeps its true E×E square (drawn 2×2,
// W_DRAWN), because every weight in this figure family is drawn as a literal
// E×E matrix — a lone block would hide the matrix's two axes. The cost is that
// the step-3 matmul T @ W_d = Y shows the tokens collapsed to one column beside
// a full 2×2 W_d — the drawn token widths are schematic, and the real hidden
// dim E lives in the labels ([·, E] on T, W_d, and Y alike).
// (EpAllToAll draws E literally for BOTH its activations and W_d; here only
// W_d keeps the literal square, because this figure spends its token columns
// on the routing.)
//
// Three grammar consequences of k=2:
// - Routing lives in its own tensor R [S, 2] — the indices a top-k router
//   actually emits — because a row can't wear two colors at once. X never
//   recolors at the router step; the picks are data ABOUT the tokens, not a
//   change to them.
// - The all-gather ships X in HOME colors: the wire is routing-blind and
//   k-blind — the same bytes move no matter what R says — so the gather
//   visibly does not grow with k. Each panel claims its kept rows in its own
//   expert color at the keep/FFN step, where the k-fold blow-up actually
//   occurs ("keeping is claiming"); the expansion reads as one token lit on
//   two panels, never as a fabricated k·S tensor no device holds.
// - The partial-sum stripe at step 4 is now EARNED: mid-reduce, each home
//   row is a genuine running sum — one contribution landed, one still riding
//   the ring — the same convention as RingAttention's stripe:!done O and
//   TpStaircase's partial Y. Contrast the earlier reverted stripe, which
//   hatched the FFN OUTPUT at TOP-1 — wrong quantity, wrong k: nothing
//   genuinely accumulated there. Step 3's Y stays solid: each expert-output
//   row is a finished summand; the incompleteness belongs to the reduce, and
//   that's where the stripe lives.
//
// Cross-figure invariant: PICKS[r][0] === EpAllToAll.jsx's ASSIGN[r] for the
// matching schedule — "same router, same first choices, plus a second pick"
// stays checkable token-for-token against the sibling. Family notes that
// still hold: the move-ring is YELLOW (the staircase family's "active"
// color), not the all-to-all cyan; W_d is drawn at EVERY step because it
// never moves; and the same hot-expert toggle, because gathering everything
// buys no immunity.

const P = 4;
const S = 8;
const SP = 2; // S/P tokens per device
const E_DRAWN = 1; // drawn width of X/T/Y: one cell per token — E stays symbolic, in the labels
const K = 2; // top-2 routing: picks per token — R [S, 2] is the only token grid ever drawn two-wide
const W_DRAWN = 2; // W_d [E, E] drawn as a 2×2 matrix (footprint = 2·CELL + GAP = 30) — the figure family's E×E weight convention; tokens collapse E, W_d keeps it
const GRID_H = S * CELL + (S - 1) * GAP; // 126 — shared containerHeight for every grid
const CONTENT_W = 160; // panel content width; step 3's five slots (T @ W_d = Y) and their subtitles set the budget
const TOTAL_STEPS = 6;
const COMPUTE = '#92400e';

const HOME = (i) => Math.floor(i / SP);

// Top-2 router schedules. Invariant: PICKS[r][0] === ASSIGN[r] in
// EpAllToAll.jsx for the matching schedule — the first picks ARE the sibling
// figure's router; keep them in sync.
// Balanced: no token repeats a pick; every expert appears in exactly 4 of
// the 16 slots, so every panel's T is [4, E]; each device's home band holds
// one token with a home-local pick and one fully remote.
// token:               0       1       2       3       4       5       6       7
const PICKS_BALANCED = [[1, 3], [2, 0], [0, 1], [3, 2], [1, 2], [0, 3], [3, 0], [2, 1]];
// Hot: expert 0 appears in EVERY token's picks (8 of the 16 slots), expert 1
// in none — device 0 keeps all eight rows, device 1 gathers eight and drops
// them all, and every home row's reduce waits on an expert-0 contribution.
// token:          0       1       2       3       4       5       6       7
const PICKS_HOT = [[0, 2], [0, 2], [0, 3], [3, 0], [0, 2], [0, 3], [3, 0], [2, 0]];

const PHASES = [
  { label: 'sequence-sharded', accent: INK_SOFT },
  { label: 'router picks top-2 · one token, two picks', accent: COMPUTE },
  { label: 'all-gather · every token to every device', accent: YELLOW },
  { label: "keep my expert's rows · local FFN", accent: COMPUTE },
  { label: 'reduce-scatter · two contributions merge in flight', accent: YELLOW },
  { label: 'sequence-sharded output', accent: INK_SOFT },
];

const CAPTIONS_BASE = [
  "Sequence-sharded, the same opening position as the all-to-all above: device d owns two of the eight token rows of X [S/P, E] — its home band — and holds its own expert's weight W_d [E, E], drawn as a small 2×2 square matrix standing in for the FFN's two E-wide matmuls. Each token is drawn one cell wide — the hidden dim lives in the labels, because this figure spends its drawn columns on the routing: watch the token's width go 1 → 2 → 1. W_d is drawn at every step of this figure for a reason: it never moves. What travels here is tokens.",
  "The router speaks, and the token's one column becomes two: R holds each resident token's two experts, first pick then second — a row can't wear two colors at once, so the routing gets its own tensor, and its first column is the same router as the all-to-all above, now joined by a second choice. One token, two picks — that 1 → 2 IS top-2's ×2, made dimensionally explicit, and note what it doubles: (token, expert) pairs, not token data. Routing replicates a token to two experts; it never widens it. So X sits unchanged beside R: the picks are data about the tokens, not a change to them, and the collective about to run doesn't read R at all.",
  "The all-gather replicates the token shards: each device forwards its band neighbor-to-neighbor around a ring until every device holds the full [S, E] token set — ringed rows just arrived, still wearing their home colors, because what rides the wire is X, not the routing. That is ~B·S·E per device: profligate next to a dispatch that would move only each token's picked copies, but a shard-at-a-time ring chunks into a staircase that hides under compute, exactly like FSDP's all-gather of W. And notice what top-2 did NOT do to this step: each token is gathered once, not twice — the gather's bill is independent of k. (R rides along too: two small integers per token, a rounding error next to X.)",
  "Keeping is claiming: device d keeps every row whose picks include expert d — those rows flip to its color — drops the rest, and computes T @ W_d = Y, full-length [S, E] and zero elsewhere. Now read one token across the four panels: it is lit on exactly two of them. Eight tokens in, sixteen expert-output rows across the devices — the same ×2 that R declared per token, now read across devices — and it lives here in the FFN compute, never on the gather's wire. Each device's Y is one summand of the layer's output; each token's finished row is now a sum of two of them, sitting on two different devices. (Real routers also scale each copy by its gate weight before the sum — a scalar per pick that changes nothing about who must talk to whom.)",
  "The reduce-scatter runs the gather in reverse: the full-length summands ride the ring neighbor-to-neighbor, adding as they go, and each device steps off holding its home band. Mid-flight every home row is a genuine partial sum — one expert's contribution has landed, the other is still riding — hence the hatch: the same stripe tensor parallelism's Y wears mid-reduce and ring attention's O wears mid-rescale. This is the arithmetic the all-to-all's combine never does: there, outputs are routed home and k rows arrive as k rows; here the collective itself folds them, two contributions becoming one row — the 2 → 1 that pays off the router's 1 → 2. Another ~B·S·E per device, staircased under compute — tensor parallelism's reduce-scatter of Y, wearing MoE clothes.",
  "The stripes drop: both contributions have landed, and Y sits in the exact sequence-sharded shape X arrived in — S rows out for S rows in, one column wide both ways: the token that fanned out 1 → 2 at the router comes home 1 again, the top-2 blow-up spent entirely in the compute and the reduce, never in the output. W_d never left home. Total traffic ~2·B·S·E per device — P/k× the all-to-all sandwich at top-2, a gap that keeps shrinking as k grows, because the gather's bill never moves while dispatch pays per copy. Race the per-device FFN (~k·B·S·E²/P — top-2 doubles the tokens each expert grinds through) against that wire and the ratio still scales as E/P: tensor parallelism's ratio, with top-k's extra compute working for the hiding, not against it.",
];

const HOT_ADDENDUM = {
  1: "The hot router names expert 0 in every token's picks — eight of the sixteen slots — and never names expert 1.",
  2: "The hot router changes nothing on this step: the gather ships every token to every device regardless of skew — and regardless of how many picks name expert 0.",
  3: "Device 0 keeps all eight rows — every token's picks include its expert — while device 1 gathered eight and dropped every one. The balanced share was four. Gathering everything bought no immunity: the FFN skew belongs to the router, and it lands on whichever device hosts the hot expert.",
  4: "Every home row in the layer is waiting on an expert-0 contribution — device 0's eight-token queue gates the reduce for all four devices, just as it stalled the all-to-all's combine.",
  5: "Same landing, just later: the hot expert's cost is upstream, in the FFN and the reduce that waited on it.",
};

function slotsFor(step, d, PICKS) {
  const C = CHIP_COLORS;
  const homeFill = (r) => (HOME(r) === d ? { fill: C[d] } : { fill: ABSENT });
  const picked = (r, d) => PICKS[r][0] === d || PICKS[r][1] === d;
  // Tokens (rows) kept by expert d — counts rows, not pick slots.
  // Balanced: 4 for every device; hot: 8 / 0 / 4 / 4.
  const nd = PICKS.filter((p) => p[0] === d || p[1] === d).length;
  const w = {
    key: 'w',
    type: 'grid',
    name: 'W_d',
    sub: step === TOTAL_STEPS - 1 ? `expert ${d} · never moved` : `[E, E] · expert ${d}`,
    rows: W_DRAWN,
    cols: W_DRAWN,
    fill: () => ({ fill: C[d] }),
  };

  switch (step) {
    case 0:
      return [{ key: 'x', type: 'grid', name: 'X', sub: '[S/P, E]', rows: S, cols: E_DRAWN, fill: homeFill }, w];
    case 1:
      return [
        { key: 'x', type: 'grid', name: 'X', sub: '[S/P, E]', rows: S, cols: E_DRAWN, fill: homeFill },
        {
          key: 'r',
          type: 'grid',
          name: 'R',
          sub: 'picks [S/P, 2]',
          rows: S,
          cols: K,
          fill: (r, c) => (HOME(r) === d ? { fill: C[PICKS[r][c]] } : { fill: ABSENT }),
        },
        w,
      ];
    case 2:
      return [
        {
          key: 'x',
          type: 'grid',
          name: 'X',
          sub: '[S, E] · replicated',
          rows: S,
          cols: E_DRAWN,
          fill: (r) => ({ fill: C[HOME(r)], highlight: HOME(r) !== d }),
        },
        {
          key: 'r',
          type: 'grid',
          name: 'R',
          sub: 'picks [S, 2]',
          rows: S,
          cols: K,
          fill: (r, c) => ({ fill: C[PICKS[r][c]] }),
        },
        w,
      ];
    case 3:
      return [
        {
          key: 'x',
          type: 'grid',
          name: 'T',
          sub: `[${nd}, E] · expert ${d}`,
          rows: S,
          cols: E_DRAWN,
          fill: (r) => (picked(r, d) ? { fill: C[d] } : { fill: ABSENT }),
        },
        { key: 'op1', type: 'op', sym: '@' },
        w,
        { key: 'op2', type: 'op', sym: '=' },
        {
          key: 'y',
          type: 'grid',
          name: 'Y',
          sub: nd > 0 ? '[S, E] · zeros elsewhere' : 'all zeros — idle',
          rows: S,
          cols: E_DRAWN,
          fill: (r) => (picked(r, d) ? { fill: C[d] } : { fill: ABSENT }),
          frame: nd > 0 ? COMPUTE : undefined,
        },
      ];
    case 4:
      return [
        {
          key: 'y',
          type: 'grid',
          name: 'Y',
          sub: '[S/P, E] · partial sums',
          rows: S,
          cols: E_DRAWN,
          fill: (r) => (HOME(r) === d ? { fill: C[d], stripe: true, highlight: true } : { fill: ABSENT }),
        },
        w,
      ];
    default:
      return [{ key: 'y', type: 'grid', name: 'Y', sub: '[S/P, E]', rows: S, cols: E_DRAWN, fill: homeFill }, w];
  }
}

function DevicePanel({ d, step, PICKS }) {
  const slots = slotsFor(step, d, PICKS);

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
              cellSize={slot.cellSize || CELL}
              frame={slot.frame}
            />
          )
        )}
      </div>
    </div>
  );
}

export default function EpRing() {
  const [step, setStep] = useState(0);
  const [hot, setHot] = useState(false);
  const PICKS = hot ? PICKS_HOT : PICKS_BALANCED;
  const phase = PHASES[step];
  const caption = CAPTIONS_BASE[step] + (hot && HOT_ADDENDUM[step] ? ` ${HOT_ADDENDUM[step]}` : '');

  return (
    <WidgetShell
      title="Expert parallelism — all-gather tokens, local FFN, reduce-scatter outputs"
      subtitle="Four devices, one expert each — and this time the router picks top-2: every token goes to two experts, and its output is the sum of what they return. The drawn widths tell that story: the token is one column, the router's picks are two, the finished output is one again — 1 → 2 → 1, and the picks are the only token grid ever drawn two-wide (the token grids collapse the hidden dim E to one column; only the weight W_d keeps its true E×E square — the drawn token widths are schematic, and E lives in the labels). Same router as the all-to-all above for each token's first choice, plus a second pick. Every device gathers ALL the tokens — once each, no matter how many experts want them — keeps the ones its own expert was picked for, and a reduce-scatter sums each token's two contributions in flight and lands the finished row back home. The tokens do all the traveling, shard by shard around a ring; the expert weights W_d never move."
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
          <DevicePanel key={d} d={d} step={step} PICKS={PICKS} />
        ))}
      </div>

      <Legend
        items={[
          { fill: CHIP_COLORS[0], label: 'expert 0 / device 0' },
          { fill: CHIP_COLORS[1], label: 'expert 1 / device 1' },
          { fill: CHIP_COLORS[2], label: 'expert 2 / device 2' },
          { fill: CHIP_COLORS[3], label: 'expert 3 / device 3' },
          { fill: ABSENT, label: 'elsewhere / dropped / zero' },
          { fill: CHIP_COLORS[0], ring: true, label: 'moved by all-gather / reduce-scatter' },
          { fill: CHIP_COLORS[0], stripe: true, label: 'partial sum — a contribution still in flight' },
        ]}
      />

      <Caption>{caption}</Caption>
      <StepControls step={step} totalSteps={TOTAL_STEPS} setStep={setStep} />
    </WidgetShell>
  );
}
