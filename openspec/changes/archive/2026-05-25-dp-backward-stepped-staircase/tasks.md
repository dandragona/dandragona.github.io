## 1. Component refactor — shell and controls

- [x] 1.1 In `src/components/parallelism/OverlapTimeline.jsx`, import `WidgetShell`, `StepControls`, `Caption` from `./staircase-shared.jsx`.
- [x] 1.2 Add a `stepped: true` flag on the `SCHEMAS.dp` entry so the dp render path can branch on it without affecting fsdp/tp.
- [x] 1.3 Extract the SVG-rendering JSX (the `<svg viewBox=...>` block with the time axis and lane mapping) into a small inner function or block that accepts a `visibleBlocks` filter, so the same SVG can render either the full schema (existing behavior) or a step-filtered subset (new behavior).
- [x] 1.4 For the dp strategy only, wrap the SVG (and any per-step caption/counter) in `WidgetShell` using the existing `schema.title` and `schema.blurb` as `title`/`subtitle`. For fsdp/tp, leave the current bespoke shell `<div>` untouched.

## 2. Stepped reveal logic

- [x] 2.1 Define a `DP_STEPS` table (5 entries: an initial empty frame, then one per layer L4 → L3 → L2 → L1) describing which compute and comm blocks should be visible at each step and a one-sentence caption for each frame, per the design's reveal order.
- [x] 2.2 Implement a `useState`-driven `step` cursor for the dp branch and pass the appropriate visible subset of compute/comm blocks into the SVG.
- [x] 2.3 Render `<Caption>` with the current frame's caption under the SVG and `<StepControls step={step} totalSteps={DP_STEPS.length} setStep={setStep} />` below the caption.
- [x] 2.4 Confirm the second non-empty frame is the first frame where a previous layer's all-reduce block and the next layer's backward compute block are visible at overlapping x-positions (spec scenario "Reveal order shows overlap, not just sequence").
- [x] 2.5 Confirm the final frame renders all four backward compute blocks and all four all-reduce blocks (the complete static staircase).

## 3. Non-DP strategies untouched

- [x] 3.1 For `strategy="fsdp"`, render exactly the current naive/overlapped toggle + static SVG; do not pass through `StepControls`.
- [x] 3.2 For `strategy="tp"`, render exactly the current static SVG; do not pass through `StepControls`.
- [x] 3.3 Verify in the dev server (`http://localhost:4321/blog/parallelism-roofline`) that the FSDP and TP `OverlapTimeline` widgets look identical to `main` before this change.

## 4. Verify in the running app

- [x] 4.1 Launch the dev server (or use the existing background process), open `http://localhost:4321/blog/parallelism-roofline`, scroll to "## DP — One all-reduce at the end".
- [x] 4.2 Step through the dp overlap widget from frame 0 to the last frame using both ← Prev and Next →. Confirm:
  - the shell, fonts, button styling, and caption box match the surrounding `DpBackward` / `FsdpBackward` widgets;
  - each frame's caption is one sentence and names the action that frame adds;
  - the staircase fills in layer by layer, with at least one frame showing the visible overlap between an in-flight all-reduce and the next layer's backward compute.
- [x] 4.3 Confirm the FSDP and TP `OverlapTimeline` widgets elsewhere in the post are visually unchanged.

## 5. Documentation

- [x] 5.1 If any architectural commentary in `src/components/parallelism/staircase-shared.jsx`'s top comment (or a sibling README) references the set of step-driven widgets, extend that list to include the DP `OverlapTimeline` so future maintainers know it now follows the convention.
