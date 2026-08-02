## Context

The parallelism post renders interactive diagrams as React components mounted from `parallelism-roofline.mdx`. Two of them render a swatch legend that is structurally shared across multiple diagram variants:

- **`ShardingStage`** is invoked four times (`strategy="dp"|"fsdp"|"tp"|"cp"`). It renders a single hard-coded 5-item legend (`ShardingStage.jsx:312-330`) regardless of strategy. The cell-fill logic in `getFills` (`:121-157`) only ever uses a subset of those swatches per strategy:
  - `REPLICATED` (`#9ca3af`, gray) — declared at `:5`, referenced only in the legend at `:323`, never in any fill. Replicated W is drawn `YELLOW` (`:135`).
  - striped "partial sum" — only in `tp` Y (`:146`).
  - `YELLOW` "materialized" — in `dp`/`cp` it is replicated W (`:135`), in `fsdp` it is a gathered/materialized W (`:134`); `tp` never uses it.
  - "elsewhere" legend swatch is `rgba(31,41,55,0.15)` (`:329`) while absent cells render `ABSENT = rgba(0,0,0,0.08)` (`:6`).
- **`CollectivePrimer`** renders one `<Legend />` (`CollectivePrimer.jsx:501`) above four panels (all-gather, reduce-scatter, all-reduce, …). The all-gather panel involves no reduction, so its cells never use the hatched "partial sum" or solid-yellow "fully reduced" swatches, yet the shared legend lists both.

`OverlapTimeline`'s legend (compute solid / comm dashed) is genuinely universal across its strategies. The staircase / backward / routing widgets describe colors in prose subtitles rather than swatch keys.

## Goals / Non-Goals

**Goals:**
- Each rendered legend lists exactly the swatches reachable in the diagram variant the reader is viewing — no more, no fewer.
- Legend swatch colors are the same values the diagram draws.
- A single source of truth for "which swatches does this variant use" so the key can't drift from the render again.

**Non-Goals:**
- Redesigning the diagrams' visual language, colors, or layout beyond legend correctness.
- Changing diagram semantics, interactivity, or the post's prose.
- Touching `OverlapTimeline`'s legend (already correct) beyond confirming it.

## Decisions

### Decision 1: Derive `ShardingStage`'s legend from the strategy, not a fixed list

Define, per strategy, the set of legend items that the fill logic can actually produce, and render only those. Concretely, attach a `legend` descriptor to each entry in `STRATEGIES` (or compute it from the same predicates `getFills` uses) listing the swatch keys in `{shard, replicated, materialized, partialSum, elsewhere}` that apply:

- `dp`: shard, replicated (W), elsewhere
- `fsdp`: shard, materialized (gathered W, only after the all-gather toggle), elsewhere
- `tp`: shard, partialSum, elsewhere
- `cp`: shard, replicated (W), elsewhere

The legend renderer maps each key to its `{color, label}`. This keeps the swatch→meaning mapping in one place and makes the legend a pure function of strategy + toggle state.

*Alternative considered:* keep one legend but grey out / omit items dynamically by scanning rendered cells. Rejected — more code, runs every render, and still needs the per-strategy truth table; declaring it is simpler and auditable.

### Decision 2: Make the `replicated` swatch real (or drop it), and stop overloading `YELLOW`

Today `YELLOW` means two different things: "replicated W" (dp/cp) and "materialized/gathered W" (fsdp). Two options:

- **(2a, preferred)** Render replicated W in the gray `REPLICATED` color in `dp`/`cp` (`wFill` returns `REPLICATED` instead of `YELLOW` when the strategy replicates W), and keep `YELLOW` exclusively for the fsdp just-in-time materialized state. Then "replicated" (gray) and "materialized" (yellow) each appear in exactly the diagrams that use them, and the labels are honest.
- **(2b, fallback)** If keeping replicated W yellow is preferred visually, drop the unused "replicated" gray swatch entirely and relabel the yellow swatch per strategy ("replicated" for dp/cp, "materialized" for fsdp).

**Resolved during audit → 2b.** Task 1.3 found a post-wide convention the propose phase missed: `DpBackward`'s caption names "the replicated W (yellow)" and FSDP draws its just-in-time materialized W yellow as well, so across the whole post **yellow already means "the full, un-sharded W"** (replicated or materialized). Decision 2a would recolor DP/CP's W to gray and directly contradict that established convention and `DpBackward`'s caption. So we take 2b: drop the never-rendered gray `replicated` swatch, keep W yellow, and label the yellow swatch per strategy — "replicated" for `dp`/`cp`, "materialized" for `fsdp`. The two labels never co-occur (a render is a single strategy), so the shared yellow color is unambiguous in context.

### Decision 3: Fix the `elsewhere` swatch to the real absent color

Point the "elsewhere" legend swatch at the `ABSENT` constant so it matches the cells it describes. Trivial, but it's part of "the key matches the diagram."

### Decision 4: Scope `CollectivePrimer`'s key per panel

Move the `<Legend />` so each `CollectivePanel` renders its own key built from the swatches that panel uses, or pass each panel the set of legend keys it needs. All-gather → {chip data, empty}; reduce-scatter / all-reduce → add {partial sum (1 / multiple), fully reduced}. Reuse the existing `Legend`/`Item` building blocks, parameterized by which items to show, to avoid duplication.

### Decision 5: Prose-key diagrams are verify-only

For `TpStaircase`, `CpStaircase`, `CpUlysses`, `EpRouting`, and the `*Backward` widgets, read each subtitle/caption, list the colors it names, and confirm each is rendered as described. Record findings; only edit if a mismatch is found. No swatch-key infrastructure added here.

## Risks / Trade-offs

- [Decision 2a changes diagram colors, not just the legend] → This is a visual change to the dp/cp W tensor (yellow→gray). Mitigation: it's intentional and makes the key honest; eyeball each of the four `ShardingStage` renders after the change. If the gray is hard to distinguish, fall back to 2b.
- [Per-strategy legend truth table can drift from `getFills` again] → Mitigation: derive the legend from the same predicates where practical, and the new spec scenarios pin the expected key per strategy so a regression is catchable by inspection.
- [Scoping `CollectivePrimer`'s legend per panel adds vertical space] → Minor; panels are already tall and stepped. Acceptable.

## Migration Plan

Pure front-end visual change to static-site components. No data, API, or build changes. Verify by running the Astro dev server, stepping each diagram through its states, and confirming every legend item appears in its diagram and vice versa. Rollback is a straight revert of the component edits.

## Open Questions

- ~~Decision 2: keep replicated W yellow (2b) or switch to gray (2a)?~~ Resolved during audit (task 1.3): 2b, to preserve the post-wide "yellow = full W" convention that `DpBackward` relies on.
