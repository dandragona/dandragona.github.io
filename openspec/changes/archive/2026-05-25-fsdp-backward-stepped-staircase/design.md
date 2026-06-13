## Context

The FSDP backward subsection of the parallelism roofline post has shrunk over recent changes. After `2026-05-25-simplify-fsdp-tp-backward-explanations`, the section consists of a single prose paragraph plus the `<FsdpBackward />` chip-pair widget (a single-layer mirror of forward FSDP: AG W → backward compute → RS ∂W on two chips). That widget intentionally does *not* show the multi-layer pipeline argument — the prose just gestures at the forward FSDP overlap timeline ("the per-layer overlap story is the same one the [forward overlap timeline](#fsdp) tells, just with the collectives swapped") and trusts the reader to back-port it.

The DP backward subsection is shaped the same way one structural level up: it has `<DpBackward />` (single-layer chip-pair zoom-in) followed by `<OverlapTimeline strategy="dp" />` (multi-layer zoom-out across L4→L3→L2→L1). The recently-shipped `dp-backward-stepped-staircase` change converted that multi-layer DP staircase into a step-driven reveal where each frame adds one layer's backward compute + the start of its all-reduce, so the reader watches the staircase build up.

This change brings the FSDP backward subsection up to the same shape: keep `<FsdpBackward />` as the single-layer zoom-in, and add a sibling `<OverlapTimeline strategy="fsdp-bwd" />` as the step-driven multi-layer zoom-out. The new staircase mirrors the existing forward `<OverlapTimeline strategy="fsdp" />` in lane structure, but reverses layer order (L4 → L3 → L2 → L1) and replaces the AG-only comm lane with two collective events per layer (AG W on the way in, RS ∂W on the way out).

The `OverlapTimeline` component already factors out a `TimelineSvg` that takes a `lanesData` object and renders any per-block schema. The DP stepped path lives in `SteppedDpTimeline` and is gated on `schema.stepped === true`. This change reuses both seams: the new schema sets `stepped: true`, and the SVG render does not need to know which stepped strategy it is rendering.

## Goals / Non-Goals

**Goals:**
- Add a new `fsdp-bwd` strategy to `OverlapTimeline` that renders a step-driven multi-layer staircase for the FSDP backwards pass, reusing `WidgetShell`, `StepControls`, `Caption`, `Block`, `Lane`, and `TimelineSvg`.
- Walk the staircase in reverse layer order (L4 → L3 → L2 → L1). Each step reveals one layer's slice: the layer's AG W appears first, the layer's backward compute appears once W has been gathered, then the layer's RS ∂W appears overlapping the next layer's AG W. The final frame shows all four layers' AG+compute+RS blocks, the complete steady-state staircase.
- Mirror the forward `OverlapTimeline strategy="fsdp"` block sizes and timing so the visual "rhymes" with it. Reading the forward and backward staircases side-by-side should make the AG↔RS mirror obvious.
- Render the new widget directly after `<FsdpBackward />` in the FSDP subsection of "# The Backwards Pass" without changing any MDX imports or the call sites of the four other backward widgets.
- Relax the existing "exactly one widget render" requirement for the FSDP backward subsection so that two widgets are allowed there (chip-pair + multi-layer staircase). TP and FSDP+TP keep the single-widget shape.

**Non-Goals:**
- No edits to `<FsdpBackward />`, `<TpBackward />`, `<FsdpTpBackward />`, or the DP backward widgets. The chip-pair widget stays as the per-layer zoom-in; this change adds the zoom-out only.
- No changes to `strategy="fsdp"` (forward), `strategy="dp"` (DP backward), or `strategy="tp"` (TP within-layer). The new stepped path is gated on `strategy="fsdp-bwd"`.
- No new `staircase-shared.jsx` exports. The reveal table lives inside `OverlapTimeline.jsx` next to the DP one.
- No animation between frames. The stepped reveal is discrete, matching every other step-driven widget in the post.
- No naive/overlapped toggle for the backward staircase. Unlike the forward FSDP timeline (which contrasts naive vs overlapped to motivate the pipeline), the backward staircase's job is to show one schedule — the overlapped one — layer by layer.

## Decisions

**Decision: New strategy key `fsdp-bwd` rather than reusing `fsdp` with a new mode.**
Rationale: the forward `fsdp` schema already uses its `modes` map for the naive↔overlapped toggle in the static timeline path. Threading a backward variant into that schema would either fork the toggle UI or invent a third mode that shouldn't be selectable from the toggle. A new top-level strategy keeps the schemas independent and lets the new render path branch cleanly on `schema.stepped`. The MDX call site changes by exactly one line (`strategy="fsdp-bwd"`), and no existing import or render changes.

**Decision: Schema has two comm lanes — AG W and RS ∂W — represented either as one comm lane with both block types or two distinct lanes.**
Decision taken: one comm lane that carries both AG and RS blocks, distinguished by the existing `op` field (`AG` vs `RS`) and the block label. The existing `Block` component already differentiates `comm` vs `compute` styling (dashed vs filled) and reads `op`/`tag` for labels; both AG and RS blocks render identically in style, only the labels differ. Rendering them on a single "communication" lane keeps the SVG vertical footprint matching the forward FSDP and DP-backward timelines.
Alternative considered — two separate comm lanes ("all-gather", "reduce-scatter") — was rejected because it doubles the lane count, makes the staircase taller than its forward counterpart, and visually implies AG and RS run on different streams. In practice they share the same NCCL channel; the lane label "communication" is more honest.

**Decision: Step count is one per "layer revealed", giving 5 frames total (an initial empty frame, then one per layer L4→L3→L2→L1).**
Rationale: this is the exact budget the DP stepped staircase uses, matches the "at most 5 frames" requirement in `parallelism-roofline-post`, and gives the reader one click per layer. Finer granularity (one click per AG / compute / RS event = 13 clicks) would dilute the staircase argument; coarser (3 clicks) would skip the AG↔RS mirror visible inside a single layer's slice.

**Decision: Within-frame visibility is driven by per-frame block-tag sets, not by a continuous wall-clock cursor.**
Rationale: the DP stepped path uses `computeTags`/`commTags` Sets to filter blocks per frame. Reusing the same pattern for FSDP-backward gives a single rendering codepath. Per-frame tag sets also make the "which blocks does this frame add?" question explicit in the reveal table, which is easier to review and easier to caption than a derived cursor.

**Decision: Render the new widget directly after `<FsdpBackward />` in the existing FSDP backward subsection, mirroring the DP backward subsection's layout (zoom-in widget → zoom-out widget).**
Rationale: the structural parallel with DP backward is the whole point of the change. The reader who just read the DP backward section recognizes the chip-pair → staircase progression and knows what to expect; the FSDP section then *is* that same progression, with the collectives swapped. Alternative — putting the staircase *before* the chip-pair — was rejected because the chip-pair grounds the per-layer mechanism (what AG W and RS ∂W actually do at the tensor level), and the staircase only makes sense once the per-layer mechanism is in hand.

**Decision: Relax the existing "exactly one widget render" requirement for the FSDP backward subsection only.**
Rationale: the existing spec requirement at `parallelism-roofline-post` requires the FSDP, TP, and FSDP+TP backward subsections to each contain exactly one widget render. This change updates the FSDP scenario to permit two widget renders (chip-pair + staircase) and leaves TP and FSDP+TP unchanged. The "no `###` headers, lists, or math blocks" part of the requirement is preserved — only the widget count changes.

## Risks / Trade-offs

- **[Risk] Adding a second strategy to `OverlapTimeline` could regress the DP / forward-FSDP / TP renders that share the file.**
  → Mitigation: the new strategy is gated on `strategy === "fsdp-bwd"`. The existing DP stepped path (`SteppedDpTimeline`) is reused — either by generalizing it to read the schema's reveal table or by adding a sibling `SteppedFsdpBwdTimeline` that calls the same `TimelineSvg`. Smoke-test all four strategies in the dev server (`/blog/parallelism-roofline`) before merging.

- **[Risk] Two backward widgets in the FSDP subsection makes that subsection longer than the TP and FSDP+TP ones, breaking the visual rhythm of the three "delta" backward subsections.**
  → Accepted: this is the same rhythm break DP backward already has (chip-pair + staircase, while TP and FSDP+TP have only a single widget). The FSDP subsection becomes the second "deep" subsection alongside DP, with TP and FSDP+TP remaining single-widget deltas. The 1–4-sentence prose constraint is preserved.

- **[Risk] The reveal table goes stale if the schema's block timing changes.**
  → Mitigation: reveal tables key off block `tag` strings, not numeric indices. Renaming a tag without updating both the schema and the reveal table will produce an obviously-broken frame (empty lane), which is caught in the dev-server smoke test step.

- **[Trade-off] No naive (non-pipelined) baseline for the backward staircase.**
  → Accepted: the forward FSDP timeline already carries the naive↔overlapped pedagogical contrast. The backward subsection's job is to show that the same pipeline pattern carries over with AG↔RS swapped — adding a naive baseline would re-make a point the forward visual already made.

- **[Trade-off] One comm lane that mixes AG and RS blocks asks the reader to read the block label (`AG W3` vs `RS ∂W3`) to tell them apart.**
  → Accepted: the layer-index color is the primary visual cue (same color across the layer's AG, compute, and RS blocks); the AG/RS distinction lives in the block label, which is identical to how the forward FSDP timeline already labels its comm blocks. Two separate lanes would visually overstate the distinction.
