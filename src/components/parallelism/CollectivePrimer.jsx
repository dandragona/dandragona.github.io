import { Fragment, useState } from 'react';

const CHIP_COLORS = ['#2563eb', '#059669', '#7c3aed', '#ea580c'];
const SUMMED = '#eab308';
const ABSENT = 'rgba(0, 0, 0, 0.06)';
const INK = '#1f2937';
const INK_SOFT = 'rgba(31, 41, 55, 0.6)';
const CARD_BG = 'rgba(255, 255, 255, 0.35)';
const CARD_BORDER = 'rgba(31, 41, 55, 0.18)';

const NUM_CHIPS = 4;
const UNIT_WIDTH = 42;
const UNIT_HEIGHT = 30;
const RECT_BORDER = '1px solid rgba(31, 41, 55, 0.32)';
const INNER_DIVIDER = '1px solid rgba(31, 41, 55, 0.18)';

// Diagonal hatch overlay marks "partial sum" — applied to every 'multi' cell
// regardless of how many chips have contributed, so the texture itself signals
// "still partial, more reduction needed" until the cell collapses to yellow.
const HATCH_OVERLAY =
  'repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.45) 0 2px, transparent 2px 6px)';

// Each chip's row is a single 4-unit rectangle. A unit's content depends on
// what the chip currently holds at that slot:
//   absent  — gray (sent away in the ring algorithm)
//   solid   — one chip's data, single chip color, no hatch (used in AG / A2A
//             where cells are pieces of data, not partial sums)
//   multi   — partial sum: vertical stripes (one per contributing chip, sorted
//             by chip index) with a diagonal hatch overlay marking it as
//             unfinished. Single-contributor cells are still hatched
//   summed  — yellow, no hatch; all N chips have contributed (fully reduced)
function unitContent(slot) {
  if (slot.kind === 'absent') return <div style={{ width: '100%', height: '100%', background: ABSENT }} />;
  if (slot.kind === 'solid') return <div style={{ width: '100%', height: '100%', background: slot.color }} />;
  if (slot.kind === 'summed') return <div style={{ width: '100%', height: '100%', background: SUMMED }} />;

  const list = slot.contribs || [];
  if (list.length === 0) return <div style={{ width: '100%', height: '100%', background: ABSENT }} />;
  if (list.length >= NUM_CHIPS) return <div style={{ width: '100%', height: '100%', background: SUMMED }} />;

  const sorted = [...list].sort((a, b) => a - b);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        {sorted.map((idx) => (
          <div key={idx} style={{ flex: 1, background: CHIP_COLORS[idx] }} />
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: HATCH_OVERLAY,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

function Unit({ slot, isFirst }) {
  return (
    <div
      style={{
        width: UNIT_WIDTH,
        height: UNIT_HEIGHT,
        borderLeft: isFirst ? 'none' : INNER_DIVIDER,
        boxSizing: 'border-box',
        transition: 'background 240ms ease',
      }}
    >
      {unitContent(slot)}
    </div>
  );
}

function Rectangle({ slots }) {
  return (
    <div
      style={{
        display: 'flex',
        border: RECT_BORDER,
        borderRadius: 5,
        overflow: 'hidden',
      }}
    >
      {slots.map((s, i) => (
        <Unit key={i} slot={s} isFirst={i === 0} />
      ))}
    </div>
  );
}

function ChipsGrid({ slotsFn, step }) {
  const labelStyle = (chipIdx) => ({
    fontSize: 10,
    color: CHIP_COLORS[chipIdx],
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    paddingRight: 8,
    justifySelf: 'end',
  });
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto auto',
          rowGap: 6,
          alignItems: 'center',
          justifyItems: 'center',
        }}
      >
        {Array.from({ length: NUM_CHIPS }, (_, i) => (
          <Fragment key={i}>
            <div style={labelStyle(i)}>Chip {i}</div>
            <Rectangle slots={slotsFn(i, step)} />
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// ===== All-gather (4 steps: ring algorithm rounds) =====
//
// Schedule (clockwise ring): in round k (1..N-1), chip i forwards the slot it
// received in round k-1 (or its own slot, in round 1) to chip (i+1) mod N.
// Concretely, in round k chip i sends slot (i - k + 1) mod N to chip (i+1) mod N.
// Senders keep their copies — AG is pure data movement, no reduction — so the
// number of populated slots per chip grows by one each round.
// After N - 1 = 3 rounds, every chip holds every slot.
const AG_STATES = [
  // Step 0 — initial. Each chip i has only slot i (its own color).
  [
    [0, null, null, null],
    [null, 1, null, null],
    [null, null, 2, null],
    [null, null, null, 3],
  ],
  // Step 1 — round 1: chip i sends slot i to chip (i+1) mod N. Sender keeps it.
  [
    [0, null, null, 3],
    [0, 1, null, null],
    [null, 1, 2, null],
    [null, null, 2, 3],
  ],
  // Step 2 — round 2: chip i forwards the slot it just received.
  [
    [0, null, 2, 3],
    [0, 1, null, 3],
    [0, 1, 2, null],
    [null, 1, 2, 3],
  ],
  // Step 3 — round 3 (final): every chip holds every slot.
  [
    [0, 1, 2, 3],
    [0, 1, 2, 3],
    [0, 1, 2, 3],
    [0, 1, 2, 3],
  ],
];
function agSlots(chipIdx, step) {
  return AG_STATES[step][chipIdx].map((sourceIdx) =>
    sourceIdx === null
      ? { kind: 'absent' }
      : { kind: 'solid', color: CHIP_COLORS[sourceIdx] }
  );
}
const agCaption = (step) => {
  const captions = [
    'Start: each chip owns exactly one slot — its own (chip i has slot i, in its own color). The other three slots are empty (gray).',
    'Round 1: each chip sends its own slot clockwise to its right neighbor. The sender keeps its copy (AG is data movement, not reduction), so every chip now holds 2 slots.',
    'Round 2: each chip forwards the slot it just received one more hop clockwise. Every chip now holds 3 slots.',
    'Round 3: one final hop closes the loop. Every chip\'s rectangle is now a rainbow of all four sources — AG complete in N − 1 = 3 rounds.',
  ];
  return captions[step];
};

// ===== Reduce-scatter (4 steps: ring algorithm rounds) =====
//
// Schedule (clockwise ring): in round k, chip i sends slot (i - k) mod N to
// chip (i + 1) mod N. Receiver adds the incoming partial to its own.
// After N - 1 = 3 rounds, chip i ends up with slot i fully reduced; every
// other slot has been sent away.
const RS_STATES = [
  // Step 0 — initial. Each chip i has its own contribution to all 4 slots.
  [
    [[0], [0], [0], [0]],
    [[1], [1], [1], [1]],
    [[2], [2], [2], [2]],
    [[3], [3], [3], [3]],
  ],
  // Step 1 — after round 1.
  [
    [[0], [0], [3, 0], null],
    [null, [1], [1], [0, 1]],
    [[1, 2], null, [2], [2]],
    [[3], [2, 3], null, [3]],
  ],
  // Step 2 — after round 2.
  [
    [[0], [0, 2, 3], null, null],
    [null, [1], [1, 3, 0], null],
    [null, null, [2], [2, 0, 1]],
    [[3, 1, 2], null, null, [3]],
  ],
  // Step 3 — after round 3 (final).
  [
    ['summed', null, null, null],
    [null, 'summed', null, null],
    [null, null, 'summed', null],
    [null, null, null, 'summed'],
  ],
];

function decodeMulti(entry) {
  if (entry === null) return { kind: 'absent' };
  if (entry === 'summed') return { kind: 'summed' };
  return { kind: 'multi', contribs: entry };
}

function rsSlots(chipIdx, step) {
  return RS_STATES[step][chipIdx].map(decodeMulti);
}
const rsCaption = (step) => {
  const captions = [
    'Start: every chip\'s rectangle is fully its own color — its own partial contribution to each of the 4 slots.',
    'Round 1: each chip sent one slot clockwise to its right neighbor; the receiver added its own contribution. Mixed cells (two stripes = two contributors) appear at the receiving slots. The sent slot leaves the sender — that unit is now empty (gray).',
    'Round 2: those 2-color cells hop one more chip around the ring, picking up another contribution at each stop. The in-flight cells now have 3 stripes.',
    'Round 3: one more hop closes the loop. Each chip ends up with one fully reduced slot (yellow = sum across all 4 chips), every other slot has been sent away. The diagonal of yellows is the sharded reduction.',
  ];
  return captions[step];
};

// ===== All-reduce (7 steps: 3 RS rounds + 3 AG rounds) =====
const AR_STATES = [
  RS_STATES[0],
  RS_STATES[1],
  RS_STATES[2],
  RS_STATES[3],
  // Step 4 — AG round 1: chip i sends slot i clockwise; chip (i+1) mod N
  // stores it. Each chip now holds 2 yellow slots.
  [
    ['summed', null, null, 'summed'],
    ['summed', 'summed', null, null],
    [null, 'summed', 'summed', null],
    [null, null, 'summed', 'summed'],
  ],
  // Step 5 — AG round 2: forward what was received in round 1. 3 yellow per chip.
  [
    ['summed', null, 'summed', 'summed'],
    ['summed', 'summed', null, 'summed'],
    ['summed', 'summed', 'summed', null],
    [null, 'summed', 'summed', 'summed'],
  ],
  // Step 6 — AG round 3: every chip has every slot.
  [
    ['summed', 'summed', 'summed', 'summed'],
    ['summed', 'summed', 'summed', 'summed'],
    ['summed', 'summed', 'summed', 'summed'],
    ['summed', 'summed', 'summed', 'summed'],
  ],
];
function arSlots(chipIdx, step) {
  return AR_STATES[step][chipIdx].map(decodeMulti);
}
const arCaption = (step) => {
  const captions = [
    'Same starting state as reduce-scatter — every chip\'s rectangle is fully its own color.',
    'RS round 1: partial sums start their first hop clockwise; 2-color stripes appear (identical to the RS panel).',
    'RS round 2: another hop. In-flight cells now have 3 stripes.',
    'RS round 3: reduce-scatter half done. Each chip has one yellow slot on its diagonal — exactly the RS panel\'s last frame.',
    'AG round 1: each chip broadcasts its yellow slot clockwise. Every chip now holds 2 yellow slots.',
    'AG round 2: each chip forwards what it received in the previous round. 3 yellow slots per chip.',
    'AG round 3: one more hop closes the loop. Every chip\'s rectangle is fully yellow — the all-reduce result, on every chip.',
  ];
  return captions[step];
};

// ===== All-to-all (4 steps: 3 rounds of pairwise swaps) =====
//
//   Round 1: (chip 0 ↔ chip 1), (chip 2 ↔ chip 3)
//   Round 2: (chip 0 ↔ chip 2), (chip 1 ↔ chip 3)
//   Round 3: (chip 0 ↔ chip 3), (chip 1 ↔ chip 2)
//
// Entries are source-chip indices for each cell (cell color).
const A2A_STATES = [
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [2, 2, 2, 2],
    [3, 3, 3, 3],
  ],
  [
    [0, 1, 0, 0],
    [0, 1, 1, 1],
    [2, 2, 2, 3],
    [3, 3, 2, 3],
  ],
  [
    [0, 1, 2, 0],
    [0, 1, 1, 3],
    [0, 2, 2, 3],
    [3, 1, 2, 3],
  ],
  [
    [0, 1, 2, 3],
    [0, 1, 2, 3],
    [0, 1, 2, 3],
    [0, 1, 2, 3],
  ],
];
function a2aSlots(chipIdx, step) {
  return A2A_STATES[step][chipIdx].map((sourceIdx) => ({
    kind: 'solid',
    color: CHIP_COLORS[sourceIdx],
  }));
}
const a2aCaption = (step) => {
  const captions = [
    'Initial: each chip\'s rectangle is fully its own color — every piece originated here. Each piece is destined for a specific chip (the slots are numbered by destination).',
    'Round 1: pairs (chip 0 ↔ chip 1) and (chip 2 ↔ chip 3) swap one piece each. Two units flip color on each side of the swap.',
    'Round 2: pairs (chip 0 ↔ chip 2) and (chip 1 ↔ chip 3) swap. Each chip now shows pieces from 3 different sources.',
    'Round 3: pairs (chip 0 ↔ chip 3) and (chip 1 ↔ chip 2) swap. Every chip\'s rectangle is now a rainbow of all four sources — A2A complete in N − 1 = 3 rounds.',
  ];
  return captions[step];
};

function buttonStyle(disabled, primary) {
  return {
    padding: '6px 14px',
    borderRadius: 6,
    background: disabled
      ? 'rgba(255,255,255,0.2)'
      : primary
      ? 'rgba(37, 99, 235, 0.22)'
      : 'rgba(255, 255, 255, 0.4)',
    color: disabled ? INK_SOFT : INK,
    border: `1px solid ${primary && !disabled ? 'rgba(37, 99, 235, 0.45)' : CARD_BORDER}`,
    fontSize: 12,
    cursor: disabled ? 'default' : 'pointer',
    fontWeight: 500,
    transition: 'background 180ms ease',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };
}

function CollectivePanel({ id, title, description, totalSteps, slotsFn, captionFn }) {
  const [step, setStep] = useState(0);
  return (
    <div
      id={id}
      style={{
        padding: '14px 14px',
        borderRadius: 12,
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        scrollMarginTop: 80,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <strong style={{ fontSize: 13, color: INK, letterSpacing: '0.02em' }}>{title}</strong>
        <div style={{ fontSize: 11.5, color: INK_SOFT, marginTop: 4, lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
      <ChipsGrid slotsFn={slotsFn} step={step} />
      <div
        style={{
          fontSize: 11.5,
          color: INK_SOFT,
          textAlign: 'center',
          minHeight: 56,
          padding: '0 16px',
          lineHeight: 1.55,
        }}
      >
        {captionFn(step)}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          style={buttonStyle(step === 0, false)}
        >
          ← Prev
        </button>
        <span
          style={{
            fontSize: 11.5,
            color: INK_SOFT,
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            minWidth: 80,
            textAlign: 'center',
          }}
        >
          Step {step} / {totalSteps - 1}
        </span>
        <button
          onClick={() => setStep((s) => Math.min(totalSteps - 1, s + 1))}
          disabled={step === totalSteps - 1}
          style={buttonStyle(step === totalSteps - 1, true)}
        >
          Next →
        </button>
        <button onClick={() => setStep(0)} style={{ ...buttonStyle(false, false), marginLeft: 8 }}>
          Reset
        </button>
      </div>
    </div>
  );
}

function Legend() {
  const Item = ({ swatch, label }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: INK_SOFT }}>
      <span style={{ width: 24, height: 14, borderRadius: 3, ...swatch }} />
      {label}
    </span>
  );
  const partialSwatch = (chipIdxs) => (
    <span
      style={{
        width: 24,
        height: 14,
        borderRadius: 3,
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(31, 41, 55, 0.22)',
        display: 'inline-block',
      }}
    >
      <span style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        {chipIdxs.map((i) => (
          <span key={i} style={{ flex: 1, background: CHIP_COLORS[i] }} />
        ))}
      </span>
      <span style={{ position: 'absolute', inset: 0, background: HATCH_OVERLAY }} />
    </span>
  );
  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        justifyContent: 'center',
        flexWrap: 'wrap',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <Item
        swatch={{ background: CHIP_COLORS[0], border: '1px solid rgba(31, 41, 55, 0.22)' }}
        label="solid = owned data (AG, A2A)"
      />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: INK_SOFT }}>
        {partialSwatch([0])}
        hatched = partial sum (1 contributor)
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: INK_SOFT }}>
        {partialSwatch([0, 3])}
        hatched stripes = partial sum (multiple contributors)
      </span>
      <Item swatch={{ background: SUMMED, border: '1px solid rgba(31, 41, 55, 0.22)' }} label="solid yellow = fully reduced" />
      <Item swatch={{ background: ABSENT, border: '1px solid rgba(31, 41, 55, 0.22)' }} label="gray = empty (sent away)" />
    </div>
  );
}

export default function CollectivePrimer() {
  return (
    <div
      id="appendix-primer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '22px 16px',
        borderRadius: 16,
        background: 'rgba(255, 255, 255, 0.18)',
        border: `1px solid ${CARD_BORDER}`,
        margin: '28px 0',
        color: INK,
        scrollMarginTop: 80,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <strong style={{ fontSize: 13, letterSpacing: '0.02em' }}>The four collectives, in one picture</strong>
        <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6, lineHeight: 1.55 }}>
          Each chip is one 4-unit rectangle showing the data it currently holds. Step through each
          panel to watch the colors spread and mix. Every reference to a collective in the post
          above links to one of these panels.
        </div>
      </div>

      <Legend />

      <CollectivePanel
        id="collective-all-gather"
        title="All-gather (ring algorithm)"
        description="Each chip starts owning one slot (its own color). At each round, every chip sends a slot one hop clockwise; senders keep their copy, so the number of populated slots per chip grows by one each round. After 3 rounds every rectangle is a rainbow of all four sources."
        totalSteps={4}
        slotsFn={agSlots}
        captionFn={agCaption}
      />
      <CollectivePanel
        id="collective-reduce-scatter"
        title="Reduce-scatter (ring algorithm)"
        description="Every chip starts with the full vector as its own partial sum (rectangle fully chip-colored). At each round, partial sums spread one hop clockwise and mix with the receiver's contribution. After 3 rounds, each chip ends up with one fully reduced slot (yellow); the rest are sent away."
        totalSteps={4}
        slotsFn={rsSlots}
        captionFn={rsCaption}
      />
      <CollectivePanel
        id="collective-all-reduce"
        title="All-reduce (ring algorithm)"
        description="Reduce-scatter (3 rounds) followed by all-gather (3 rounds): partial sums first mix down to one yellow slot per chip, then yellow broadcasts back out to fill every rectangle. 6 rounds total."
        totalSteps={7}
        slotsFn={arSlots}
        captionFn={arCaption}
      />
      <CollectivePanel
        id="collective-all-to-all"
        title="All-to-all (pairwise swap schedule)"
        description="All-to-all transposes the sharding axis: each chip starts holding one shard of dim A split across destinations along dim B, and ends holding one shard of dim B with contributions from every source along dim A. Concretely below, every chip starts with its rectangle fully its own color (everything originated here, sliced by destination). At each round, pairs of chips swap one piece each."
        totalSteps={4}
        slotsFn={a2aSlots}
        captionFn={a2aCaption}
      />
    </div>
  );
}
