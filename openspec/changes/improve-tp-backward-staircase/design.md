## Context

The previous `fix-tp-backward-diagram` change (now archived in spirit; tasks all complete) cleaned up alpha-fading and the `Xᵀ`-relabel bug, but its own `design.md` §5 and the §1 Risk note flagged two concessions it made to stay inside the then-current spec:

1. No yellow-ring chunk highlight on `∂Y` ("the forward-vs-backward symmetry argument for adding a ring is real but is a separate change" — `fix-tp-backward-diagram/design.md:87`).
2. A 5-frame ceiling that forced folding the last AG-completion into the final compute frame, breaking symmetry with forward `TpStaircase`'s 6 frames ("if a reviewer wants a 'done' tick like forward, we'd need to fold differently" — `:100`).

Combined with the existing no-embedded-timeline rule from `spec.md:90`, the result is a backward widget that reads as an isolated panel rather than the mirror of a forward staircase. The user's complaint that the diagram is still confusing is the cost of those compromises.

This change lifts those constraints specifically for `TpBackward` (not for the other backward widgets) because:

- `TpBackward` is the only backward widget whose forward sibling is itself a staircase with an embedded timeline. `DpBackward`, `FsdpBackward`, and `FsdpTpBackward` mirror chip-pair / mesh visuals, not staircases.
- The forward `TpStaircase` already defines the visual vocabulary the backward should share (yellow ring, compute/comm timeline lane, 6 frames). Re-using that vocabulary verbatim is cheaper than inventing a different reading.

## Goals / Non-Goals

**Goals:**

- Make `TpBackward` a literal time-reverse mirror of forward `TpStaircase`: same chip panels, same step count, same timeline geometry, same active-chunk ring.
- Replace the reused `W`/`Y` tensor slots with explicit `∂Y` (in the matmul-right position) and `∂W` (in the output position) labels so the reader doesn't have to mentally re-interpret the forward layout.
- Show the staircase head (step 0 = AG row 1 alone, no compute) and tail (step 4 = chunk 4 alone, no AG) explicitly, mirroring forward's "compute alone" head and "RS alone" tail.

**Non-Goals:**

- Touching `DpBackward`, `FsdpBackward`, or `FsdpTpBackward`. Their 5-frame, no-timeline conventions stay — they mirror chip-pair / mesh forwards, not staircases.
- Drawing `X` as `Xᵀ` (swap rows and cols). The forward layout is the column-sharded `X`; the matmul math is `∂W = Xᵀ · ∂Y` but the picture stays in the forward's frame so the eye tracks across forward and backward.
- Adding the `∂X = ∂Y · Wᵀ` companion computation. The diagram focuses on `∂W` — the `∂X` path is mentioned in the section prose, not redrawn.
- Modifying `staircase-shared.jsx`. The shared `Cell` still does not need to expose `highlight`; `TpBackward` keeps inline primitives matching forward `TpStaircase`'s inline primitives.

## Decisions

### 1. Three labeled tensor slots: `X · ∂Y = ∂W`

**Decision:** The chip panel renders three tensors per chip, in order:

- `X` (`B × E`): column-sharded by chip — same layout as forward.
- `∂Y` (`B × E`): incoming gradient, sharded by chip column initially, all-gathered row-by-row.
- `∂W` (`E × E`): output gradient, row-sharded by chip.

Operator symbols: `·` between `X` and `∂Y`, `=` between `∂Y` and `∂W`. The subtitle names the math: `∂W = Xᵀ · ∂Y, chunked along the batch dim`.

**Alternatives considered:**

- *Reuse forward's `X @ W = Y` slots with W relabeled `∂W` and Y relabeled `∂Y`*: this was the previous design. Rejected — the slots' shapes match (`E × E` for `W`/`∂W`, `B × E` for `Y`/`∂Y`) but the semantic role swap (computed output → incoming gradient) makes the picture lie about what each slot means.
- *Draw `Xᵀ` with rows and columns swapped*: would force `∂Y` into the matmul's left operand position, breaking layout symmetry with forward. Rejected.

### 2. Embedded Timeline lane

**Decision:** Add a two-lane SVG timeline below the chip panels with identical geometry, padding, and block styling to forward `TpStaircase`'s `Timeline`:

- `compute` lane (top): solid filled rectangles labeled `mm c1..c4`, with a yellow ring on the active chunk.
- `all-gather` lane (bottom): dashed-border rectangles at 16% fill labeled `AG r1..r4`, with a yellow ring on the active row's AG.

Time axis runs left-to-right with `time →` at the top-right. The `compute` block for chunk `i+1` is placed at column `i+1`; the `AG` block for row `i+1` is placed at column `i`. That places `AG r1` at column 0 (step 0, alone — the "comm head"), pairs `AG r(i+1)` with `mm c(i+1−1) = mm c(i)` at columns 1..3, and leaves `mm c4` alone at column 4 (the "compute tail").

**Alternatives considered:**

- *Skip the timeline, rely on stripe vs solid on `∂Y` rows to communicate the overlap*: this was the previous design's choice. Rejected — the stripe alone doesn't make the comm/compute parallelism visible at a glance, which is the central pedagogical point of the staircase.
- *Inline the comm and compute as side-by-side labels under each chip*: tested mentally; it ties the overlap to per-chip state rather than per-tick state, making the comm-leads-compute relationship harder to see.

### 3. Six frames, `NUM_CHUNKS + 2 = 6`

**Decision:** `TOTAL_STEPS = NUM_CHUNKS + 2 = 6`, mirroring forward `TpStaircase`. The frames decompose as:

- 1 "comm head" tick: step 0 = AG row 1 in flight, no compute.
- `NUM_CHUNKS − 1 = 3` paired ticks: step `i+1` = chunk `i+1` compute + AG row `i+2` in flight, for `i ∈ {0, 1, 2}`.
- 1 "compute tail" tick: step `NUM_CHUNKS = 4` = chunk 4 compute, no more AG.
- 1 "done" tick: step 5 = staircase complete, `∂W` solid on every chip.

Forward `TpStaircase` mirrors this exactly with compute and comm swapped: 1 compute head, 3 paired, 1 comm tail, 1 done.

**Alternatives considered:**

- *Stay at 5 frames by folding the AG head into the first paired tick*: previous design's choice. Rejected — the head-and-tail symmetry with forward is central to the time-reversal mental model; collapsing the head obscures it.

### 4. Yellow-ring active-chunk highlight

**Decision:** Use the same `HIGHLIGHT = '#eab308'` (`YELLOW`) border the forward inline `Cell` uses. The ring lands on the active chunk's row across all three tensors (`X`, `∂Y`, `∂W`) and on the timeline's active block (both compute and AG lanes). On `∂Y`, the ring appears on the row that is currently being multiplied — which has just finished AG, so it's solid, not striped.

**Alternatives considered:**

- *Add `highlight` to shared `Cell`*: would require touching `staircase-shared.jsx` and a fresh look at other backward widgets that consume it. Out of scope. Inline primitives match forward `TpStaircase`'s existing pattern.

### 4a. No "AG in flight" stripe on `∂Y` off-column cells

**Decision:** During the tick on which an AG of row `r` is in flight, the chip-panel cell at `(row r, off-column)` renders as `ABSENT` (gray), not as a stripe. It transitions directly `ABSENT → solid` on the tick the AG lands.

**Rationale:** The stripe convention everywhere else in the post — forward `TpStaircase`'s `Y`, `DpBackward`'s `∂W` (`'local · disagrees'`), `FsdpBackward`'s `∂W` (`'full · partial sum'`) — means "the chip holds a partial value of this cell, awaiting some aggregation". In an AG-in-flight `∂Y` off-column cell, the chip holds *no value yet*: the value lives on another chip and is being copied over. Painting that cell with a stripe (chip-color underneath) would lie about what the chip holds, and a reader trained on the forward would parse it as "partial sum at step 0" — which makes no sense because no compute is happening at step 0.

The "AG row `r` is in flight right now" signal lives in the timeline's dashed AG block (with its `YELLOW`-ringed-when-active treatment), not on the chip panel. The chip panel only shows what each chip currently holds.

**Alternative considered:** Show the in-flight cell with a faded chip-color, or a dotted border, to keep some chip-panel signal. Rejected — the timeline already carries the in-flight information, and any added on-cell convention would be unique to this widget (the same anti-pattern the previous `fix-tp-backward-diagram` change cleaned up).

### 5. Inline `Cell`, `TensorGrid`, `OpSymbol` and `Timeline`

**Decision:** Keep these primitives inline in `TpBackward.jsx` (already the case before this change). They duplicate forward `TpStaircase`'s inline primitives by design — the shared module's primitives are tuned to the simpler chip-pair/mesh widgets (no highlight, smaller `CELL`).

`CELL = 16`, `GAP = 2` match forward's constants so the two staircases render at identical scale and the reader can flip between them.

## Risks / Trade-offs

- **[Risk]** Diverging from the `≤5` ceiling on other backward widgets creates an inconsistency in the spec. → Mitigation: scope the relaxation to `TpBackward` explicitly. The other widgets stay at 5; only the widget that mirrors a forward staircase gets 6.
- **[Risk]** The embedded timeline plus chip panels increases vertical real estate, pushing the FSDP+TP backward section lower. → Mitigation: the forward `TpStaircase` already has this footprint and is well-received; the backward matches it.
- **[Risk]** Inline-duplicated `Cell`/`TensorGrid`/`Timeline` primitives now exist in three places (forward `TpStaircase.jsx`, this `TpBackward.jsx`, and the shared module). → Mitigation: a follow-up could extract a `StaircasePanel` helper, but the duplication is small (≈100 lines) and tracks an intentional similarity rather than accidental copy-paste.

## Migration Plan

- Edit `src/components/parallelism/TpBackward.jsx` in place; no other files change.
- The change preserves all existing `import` lines from `staircase-shared.jsx`; new code lives in the inline primitives.
- Visual verification by stepping through frames 0..5 in the dev server, comparing each frame to the matching forward `TpStaircase` frame for layout symmetry.
- No data migration, no API surface change.
