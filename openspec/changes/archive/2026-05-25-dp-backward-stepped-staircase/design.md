## Context

The DP backward subsection of the parallelism roofline post is the in-depth treatment of how a per-layer backward all-reduce hides behind the next layer's backwards compute. It already shows two widgets in sequence:

1. `<DpBackward />` — the single-layer chip-pair walkthrough of one all-reduce, decomposed into reduce-scatter + all-gather. This widget is already step-driven via `staircase-shared.jsx`.
2. `<OverlapTimeline strategy="dp" />` — the multi-layer staircase that visualizes layer L4's all-reduce running while L3 is still computing backward, L3's running while L2 is computing, and so on.

`OverlapTimeline` is the only backward widget that still renders as one static SVG. The other three backward widgets (`FsdpBackward`, `TpBackward`, `FsdpTpBackward`) walk through their argument frame-by-frame with `StepControls`, capped at 5 frames, each frame captioned. The DP overlap timeline pre-dates that convention; this change brings it into the same family without disturbing the other strategies the component still serves.

The DP schema in `OverlapTimeline.jsx` already encodes the per-block timing (start, dur, layer index, op, tag) for four layers across two lanes (compute, all-reduce). The static render is essentially "draw every block at once." A stepped render means "draw the subset of blocks whose `start` is < the current wall-clock cursor."

## Goals / Non-Goals

**Goals:**
- The DP `OverlapTimeline` advances through the staircase one layer at a time, so the reader sees gradient *g4* begin its all-reduce *while* L3's backward compute starts, then *g3*'s AR overlapping L2's compute, and so on.
- The widget reuses `WidgetShell`, `StepControls`, and `Caption` from `staircase-shared.jsx` so its outer shell, controls, and caption styling match the other backward widgets.
- Reveal order matches the prose at lines 153–163 of the MDX: each step adds one layer's backward compute and the start of its all-reduce, then the next step shows that all-reduce running concurrently with the next layer's compute.
- Existing block geometry (positions, durations, colors) is preserved — only the visibility filter changes between frames.

**Non-Goals:**
- FSDP and TP variants of `OverlapTimeline` are out of scope; they keep their current static / toggleable rendering. (FSDP already has a naive↔overlapped toggle that does its own pedagogical job.)
- No change to `<DpBackward />`. The two widgets remain complementary: `DpBackward` zooms in on one collective; the timeline zooms out to the multi-layer staircase.
- No new MDX imports and no edits to `parallelism-roofline.mdx`. The render site `<OverlapTimeline strategy="dp" client:visible />` stays as is.
- No animation between frames. The convention in the other backward widgets is discrete step-through, not autoplay.

## Decisions

**Decision: Add a `stepped` flag inside the `dp` schema entry rather than a new `strategy="dp-stepped"`.**
Rationale: the call site in the MDX shouldn't change, and the DP schema is the only one switching to stepped. Tagging the schema (e.g., `SCHEMAS.dp.stepped = true`) lets the component branch internally without forking the public API. Alternative considered — a separate `DpOverlap` component that wraps `OverlapTimeline` — was rejected because it would duplicate the SVG layout code or require extracting it, and the existing `OverlapTimeline` already cleanly handles per-strategy schemas.

**Decision: Step count is one per "layer revealed", giving 5 frames total (4 layers + an initial empty frame).**
Rationale: the existing non-DP backward widgets cap at 5 frames; matching that budget keeps the family consistent and matches the "at most 5 frames" requirement in `parallelism-roofline-post`. The natural reveal granularity is one layer per click — finer granularity (one block per click) would multiply frames and dilute the staircase argument.

**Decision: Visibility is driven by a per-step "wall-clock cursor" derived from the existing block `start` + `dur` values.**
Rationale: the schema already encodes timing. Computing `cursor = step * (duration / NUM_LAYERS)` and rendering blocks whose `start < cursor` (clipping or fading partially in-flight blocks if needed) reuses the existing data without rewriting it. Alternative — adding a `revealAtStep` field to every block — was rejected as redundant: it would hard-code what the existing timing already implies.

**Decision: Use `WidgetShell` instead of the bespoke `<div>` shell currently in `OverlapTimeline`.**
Rationale: keeps shell styling identical across all backward widgets, and the existing shell is functionally equivalent (same background, border, radius, margin). The FSDP toggle UI is rendered inside `WidgetShell`'s `children` for the FSDP strategy and can stay inline-rendered between the title and SVG.

**Decision: Captions are short ("L4 backward starts; g4 all-reduce in flight", "L3 backward + g3 AR; g4 AR finishing", …) and follow the "name the action, not the argument" rule already required for the other backward captions.**
Rationale: the *why* of overlap is already prose'd in the surrounding `### How the overlap works`. Captions just name what's appearing in each frame.

## Risks / Trade-offs

- **[Risk] The two other strategies (`fsdp`, `tp`) share the `OverlapTimeline` codepath, so a stepped branch could regress them.**
  → Mitigation: gate the stepped path on `schema.stepped === true`; render exactly today for the other two strategies; smoke-test all three strategies in the dev server (`/blog/parallelism-roofline`) before merging.

- **[Risk] Re-shelling under `WidgetShell` changes the legend/footer layout (the current shell includes a compute/communication legend at the bottom).**
  → Mitigation: keep the legend inside the `WidgetShell` `children`, immediately below the SVG, with the same styling. If the visual delta is non-trivial, leave the legend out — the colored blocks plus dashed-vs-filled distinction already carry the legend information, and the other backward widgets render no legend.

- **[Risk] A 5-frame budget may not show the overlap obviously if frame 0 is "nothing yet".**
  → Mitigation: design the 5 frames so frame 1 already shows L4 compute + the start of g4's all-reduce, frame 2 shows L3 compute starting while g4 finishes (the first overlap), and frames 3–4 keep cascading. This makes the second frame the first one where overlap is visible, not the last.

- **[Trade-off] The naive (non-overlapped) DP baseline isn't shown.**
  → Accepted: unlike FSDP, the DP backward overlap has no naive counterpart in the post — the prose argues the staircase from first principles, and adding a non-overlapped DP mode would add a frame budget the reader doesn't need.
