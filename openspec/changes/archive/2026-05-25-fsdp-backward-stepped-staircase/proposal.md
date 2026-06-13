## Why

The DP backward subsection of `src/pages/blog/parallelism-roofline.mdx` now ends in a step-driven multi-layer staircase (`<OverlapTimeline strategy="dp" />`) that reveals one layer at a time so the reader can watch each layer's all-reduce slide under the next layer's backwards-pass compute. The FSDP backward subsection ends after the single-layer chip-pair `<FsdpBackward />` widget and never visualizes the multi-layer pipeline argument it asserts in prose ("the per-layer overlap story is the same one the [forward overlap timeline](#fsdp) tells, just with the collectives swapped"). Without that visual, the FSDP backward subsection is asymmetric with DP backward — the reader has to mentally back-port the forward FSDP timeline and swap AG↔RS to picture how the per-layer collectives hide under per-layer compute on the way back.

## What Changes

- Add a new `OverlapTimeline` strategy — `fsdp-bwd` — that renders a step-driven multi-layer staircase for the FSDP backwards pass. Each step reveals one layer's slice of the pipeline (AG W → backward compute → RS ∂W) walking layers in reverse (L4 → L3 → L2 → L1), so the reader sees how the next layer's AG W overlaps the current layer's RS ∂W and backwards compute.
- Render `<OverlapTimeline strategy="fsdp-bwd" client:visible />` immediately after `<FsdpBackward client:visible />` in the FSDP subsection of "# The Backwards Pass" in `src/pages/blog/parallelism-roofline.mdx`. The existing `<FsdpBackward />` widget (single-layer chip-pair) stays as the per-layer zoom-in; the new staircase is the multi-layer zoom-out — the same complementary pairing already used in the DP backward subsection.
- Reuse `WidgetShell`, `StepControls`, and `Caption` from `staircase-shared.jsx` and the existing SVG lane/block rendering inside `OverlapTimeline.jsx`. The DP stepped path is the template; the FSDP-backward path differs only in schema (two collective types per layer instead of one) and reveal order.
- Keep the existing `strategy="fsdp"` (forward all-gather timeline), `strategy="dp"` (stepped DP backward staircase), and `strategy="tp"` (static TP within-layer staircase) untouched.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `parallelism-roofline-post`: the FSDP backward subsection adds a second widget render — a step-driven multi-layer staircase — that relaxes the current "exactly one widget render" constraint for the FSDP subsection only. The existing requirement that names FSDP, TP, and FSDP+TP backward subsections as exactly-one-widget delta visuals is updated so that the FSDP subsection may render two widgets (the chip-pair zoom-in followed by the multi-layer staircase), matching the existing DP-backward shape. TP and FSDP+TP retain the single-widget shape.

## Impact

- `src/components/parallelism/OverlapTimeline.jsx` — add an `fsdp-bwd` entry to `SCHEMAS` with `stepped: true`, plus the reveal table the stepped path consumes. The existing `SteppedDpTimeline` is generalized (or a sibling `SteppedFsdpBwdTimeline` is added) so both stepped strategies share the SVG render.
- `src/pages/blog/parallelism-roofline.mdx` — one new `<OverlapTimeline strategy="fsdp-bwd" client:visible />` line inside the existing `## FSDP — Reduce-scatter in place of all-gather` subsection, after the `<FsdpBackward client:visible />` line. No new imports (`OverlapTimeline` is already imported).
- `src/components/parallelism/staircase-shared.jsx` — no API changes; existing exports (`WidgetShell`, `StepControls`, `Caption`) are reused.
- `openspec/specs/parallelism-roofline-post/spec.md` — one requirement updated and one new requirement added via delta (the FSDP-backward staircase mirrors the DP-backward staircase requirement).
- No new dependencies. No public API. The TP and FSDP+TP backward subsections are unaffected.
