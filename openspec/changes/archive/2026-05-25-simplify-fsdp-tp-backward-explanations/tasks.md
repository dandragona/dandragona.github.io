## 1. Rewrite FsdpBackward component

- [x] 1.1 In `src/components/parallelism/FsdpBackward.jsx`, reduce the `STEPS` array to at most 5 frames covering: start (W sharded, no ∂W), AG of one layer's W (yellow link), compute ∂W full-shape, RS ∂W back to sharded, done. Use the single-layer mirror (no L4→L1 pipeline) to match the DP-backward chip-pair pattern.
- [x] 1.2 Keep the existing `WidgetShell` / `Caption` / `StepControls` / `TensorGrid` / `OpSymbol` / `CommLink` / `Counter` primitives. Remove any pipelined `RS ∂W_l ‖ AG W_{l-1}` paired frames and references to multiple layers (no `W₄`, `W₃`, etc. — just `W` and `∂W`).
- [x] 1.3 Rewrite each step's `caption` to one short sentence naming the action only — no "If the forward cached it…", no "two collectives in flight", no overlap re-explanation.
- [x] 1.4 Update the `WidgetShell` title/subtitle to a short delta-style framing (e.g., title: "FSDP backward — RS in place of forward's AG"; subtitle ≤ one sentence pointing back to the DP backward + FSDP forward visuals).
- [x] 1.5 Verify the file still default-exports `FsdpBackward` so the MDX import resolves unchanged.

## 2. Rewrite TpBackward component

- [x] 2.1 In `src/components/parallelism/TpBackward.jsx`, reduce `NUM_CHUNKS` (e.g., from 4 to 2) so the staircase fits within at most 5 frames while preserving the chunked-staircase shape from `TpStaircase`.
- [x] 2.2 Delete the entire `Timeline` SVG sub-component and its `TIMELINE_PAD_*` / `LANE_*` constants. The widget renders only the chip panels, the counter (if kept), and the caption.
- [x] 2.3 Rewrite `STEP_CAPTIONS` so each entry is one short sentence naming the action (e.g., "AG ∂Y row 0 starts", "Chunk 0 backward compute, AG ∂Y row 1 starts", "All chunks consumed; ∂W complete"). Remove the staircase-re-explanation, the "dual of forward's trailing RS" phrasing, and any reference to the all-reduce decomposition.
- [x] 2.4 Update the `WidgetShell` title/subtitle to a short delta-style framing pointing back to the forward `TpStaircase`.
- [x] 2.5 Verify the file still default-exports `TpBackward`.

## 3. Rewrite FsdpTpBackward component

- [x] 3.1 In `src/components/parallelism/FsdpTpBackward.jsx`, replace the bespoke outer `div` shell and step-counter buttons with the shared `WidgetShell`, `StepControls`, and `Caption` from `staircase-shared.jsx` (import them as the other backward components do).
- [x] 3.2 Delete the `Timeline` SVG sub-component and its `BLOCKS` / `LANES` / `PLAYHEAD` / `TIMELINE_PAD_*` / `LANE_*` constants entirely.
- [x] 3.3 Delete the `Counter` component (the AG/RS per-axis tally). The mesh arrows alone carry the per-axis collective identification.
- [x] 3.4 Reduce `STEPS` to at most 5 frames: start (∂Y sharded), AG ∂Y along TP (horizontal arrows active), compute ∂W full-shape on FSDP axis, RS ∂W along FSDP (vertical arrows active), done (∂W sharded).
- [x] 3.5 Rewrite each `caption` to one short sentence naming the action. Remove the multi-sentence step-2 partial-sum explanation and the closing "Per layer the backward fires…" recap.
- [x] 3.6 Keep the `Mesh`, `ChipCard`, `StateDot`, `HArrow`, `VArrow`, and `AxisLabel` helpers — they carry the 2×2 visual that mirrors `FsdpTpStaircase`. Strip any state fields they no longer need (e.g., the `dYAct` / `dYFull` / `dWFull` / `dWSharded` distinctions can collapse to fewer named states if the simplification allows).
- [x] 3.7 Verify the file still default-exports `FsdpTpBackward`.

## 4. Rewrite the three subsections in the MDX

- [x] 4.1 In `src/pages/blog/parallelism-roofline.mdx`, under "# The Backwards Pass", leave "## DP — One all-reduce at the end" (and its `### The dependency chain` / `### How the overlap works` subsections) completely unchanged.
- [x] 4.2 Replace the body of "## FSDP — One reduce-scatter per layer" with one paragraph (1–4 sentences) followed by the existing `<FsdpBackward client:visible />` render. Rename the heading to a delta-style title if needed (e.g., "## FSDP — Reduce-scatter in place of all-gather"). No `###` subheaders, no bullet/numbered lists, no math blocks.
- [x] 4.3 Replace the body of "## TP — Within-layer dual staircase" the same way. Heading can keep its current "## TP — …" name. One paragraph + `<TpBackward client:visible />`.
- [x] 4.4 Replace the body of "## FSDP + TP — collectives swapped" the same way. One paragraph naming both swapped collectives + `<FsdpTpBackward client:visible />`.
- [x] 4.5 Make sure each new paragraph references the DP backward subsection (or the strategy's own forward visual) in one sentence rather than re-deriving the overlap argument.

## 5. Verify and ship

- [x] 5.1 Confirm that the top-of-file `import` block in `src/pages/blog/parallelism-roofline.mdx` is byte-identical before vs. after this change (no new imports added or removed).
- [x] 5.2 Run the dev build (`npm run dev` or the project's equivalent) and load the post in a browser. For each of the four backward widgets, click through every step and confirm there are no console errors and the captions render. (Substituted `npm run build` — astro build completes cleanly with the three rewritten components bundled. Full per-step click-through needs the user's eyes.)
- [ ] 5.3 Visually confirm that the FSDP / TP / FSDP+TP backward widgets read as short deltas next to the in-depth DP backward subsection above them.

## 6. Archive the superseded change

- [ ] 6.1 After the post change is reviewed, archive `openspec/changes/fix-backward-diagrams/` (its requirements describe the now-superseded 11-step / 6-step / 5-step diagrams). Move it under `openspec/changes/archive/` following the existing date-prefixed naming convention. Note in the archive entry that this change supersedes it.
