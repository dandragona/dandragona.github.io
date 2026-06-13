## Why

The `TpBackward` widget in the parallelism-roofline post is technically muddled and visually inconsistent with its siblings. It invents a "faded / consumed" cell convention (alpha-blended cells for already-used `∂Y` rows) that no other diagram in the post uses; it renders the `X` operand as `Xᵀ` with a subtitle "col i of X" but lays the grid out identically to forward's `X`; and it ramps `∂W` cell opacity with chunk count rather than using the established stripe-for-partial-sum convention from `DpBackward` and `FsdpBackward`. The result is a panel that looks like it follows the staircase family but actually fights it, undermining the post's promise that the backward TP staircase is the same shape as the forward one with the collective swapped.

## What Changes

- **BREAKING (visual)**: Remove the `'consumed'` state and the `alpha: 0.35` faded-cell rendering from `src/components/parallelism/TpBackward.jsx`. Cells that have been used in compute stay fully opaque, the same as every other panel in the post.
- **BREAKING (visual)**: Stop alpha-blending `∂W` accumulation. `∂W` either shows the shared partial-sum stripe convention (during accumulation) or solid chip-color (after the last chunk lands) — matching `DpBackward` (`'local · disagrees'` stripes) and `FsdpBackward` (`'full · partial sum'` stripes).
- **BREAKING (visual)**: Drop the `Xᵀ` relabeling and the "col i of X" subtitle. Show the operand as `X` with the same column-sharded fill the forward `TpStaircase` uses, since the visual layout is the column-sharded `X` that lives on each chip.
- Restore the forward staircase's chunk count and step budget: use `B = 4` and `NUM_CHUNKS = 4` so the staircase is visible (the current `B = 2` collapses it to two chunks), keeping total frames within the 5-frame budget already specified in the spec by chunking `∂Y` along the batch dim with the same row-wise reveal cadence as `TpStaircase`.
- Reuse `TpStaircase`'s yellow-ring chunk highlight on the `∂Y` row currently being computed against, so the eye tracks the staircase across forward and backward.
- Replace the bespoke `dyState` / `dwChunksAccumulated` logic with state that says exactly: "before AG: absent; AG in flight: stripe (partial); after AG: solid; compute consumed: still solid; ∂W after k chunks: striped chip-color until the last chunk, then solid".
- Update subtitles to the established vocabulary (`partial · in-flight`, `full · partial sum`, `row k done`) — no new vocabulary.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `parallelism-roofline-post`: Adds explicit visual-convention requirements for `TpBackward` (no faded cells, partial-sum stripes for `∂W` accumulation, `X` not `Xᵀ`, chunk count and yellow-ring highlight mirroring forward `TpStaircase`). The existing "TpBackward step budget and staircase shape" requirement is tightened with these additional scenarios.

## Impact

- Affected code: `src/components/parallelism/TpBackward.jsx` (only).
- Affected spec: `openspec/specs/parallelism-roofline-post/spec.md` — one delta on the existing TpBackward requirement.
- No new components, no new MDX imports, no changes to call site `src/pages/blog/parallelism-roofline.mdx:177`.
- No changes to `staircase-shared.jsx` — all primitives already exist (`TensorGrid`, `Cell` with `stripe`, `WidgetShell`, `StepControls`, `Caption`).
