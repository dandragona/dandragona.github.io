## Why

The DP backward overlap timeline at `src/pages/blog/parallelism-roofline.mdx:165` currently renders the entire L4→L3→L2→L1 staircase as a single static SVG. Every other backward visual in the post (`FsdpBackward`, `TpBackward`, `FsdpTpBackward`) walks the reader through one frame at a time with `StepControls`, so the DP overlap diagram — the one that introduces the staircase in the first place — is the odd one out. A stepped reveal lets the reader watch each layer's all-reduce slide under the next layer's backwards-pass compute, which is exactly the argument the surrounding prose makes.

## What Changes

- Add a stepped-reveal mode to `OverlapTimeline` for `strategy="dp"`: layer compute and all-reduce blocks appear one frame at a time, advanced by the shared `StepControls`, with a one-sentence `Caption` per frame.
- Keep the FSDP and TP `OverlapTimeline` strategies untouched (they stay static / toggleable as today).
- Reuse `WidgetShell`, `StepControls`, and `Caption` from `staircase-shared.jsx` so the DP overlap timeline matches the convention used by the other backward widgets.
- No change to the `<OverlapTimeline strategy="dp" client:visible />` call site in the MDX, no new imports.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `parallelism-roofline-post`: the DP backward overlap timeline becomes a step-driven staircase reveal that matches the existing convention for non-DP backward widgets; the existing requirement that names it as a static `<OverlapTimeline strategy="dp" />` widget is updated to require stepped behavior.

## Impact

- `src/components/parallelism/OverlapTimeline.jsx` — add stepped rendering path for the `dp` schema; SVG block layout is preserved but blocks are revealed by step.
- `src/components/parallelism/staircase-shared.jsx` — no API changes expected; existing exports (`WidgetShell`, `StepControls`, `Caption`) are reused.
- `src/pages/blog/parallelism-roofline.mdx` — no edits; the existing `<OverlapTimeline strategy="dp" client:visible />` render now renders the stepped variant.
- `openspec/specs/parallelism-roofline-post/spec.md` — one requirement updated via delta.
- No new dependencies. No public API. The other two strategies of `OverlapTimeline` are unaffected.
