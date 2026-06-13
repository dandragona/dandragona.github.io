## 1. Schema — new fsdp-bwd entry in OverlapTimeline

- [x] 1.1 In `src/components/parallelism/OverlapTimeline.jsx`, add a new `'fsdp-bwd'` entry to `SCHEMAS` with `stepped: true`, a `title` ("FSDP — Backward Pass Overlap" or similar), and a `blurb` naming the AG↔RS mirror of forward FSDP and the reverse-layer walk.
- [x] 1.2 Define the schema's `lanes`: one `compute` lane and one `comm` lane labeled "communication" (or "all-gather / reduce-scatter") so both AG and RS blocks can share it.
- [x] 1.3 Populate `modes.default.compute` with four blocks in reverse layer order (idx 3, 2, 1, 0 ↔ L4, L3, L2, L1), giving them tags `L4`, `L3`, `L2`, `L1` and durations that mirror the forward FSDP overlapped schema so the visual rhymes.
- [x] 1.4 Populate `modes.default.comm` with eight blocks — four AG-W blocks (`op: 'AG'`, tags `W4`, `W3`, `W2`, `W1`) preceding each layer's compute, and four RS-∂W blocks (`op: 'RS'`, tags `∂W4`, `∂W3`, `∂W2`, `∂W1`) following each layer's compute. Time the blocks so each layer's RS-∂W overlaps the next layer's AG-W (the steady-state pipeline).
- [x] 1.5 Choose an overall `duration` for the schema that comfortably fits the 12 comm blocks + 4 compute blocks at the existing block width scale.

## 2. Reveal table — DP_STEPS sibling for FSDP backward

- [x] 2.1 Add a `FSDP_BWD_STEPS` reveal table next to `SCHEMAS.dp.modes.default.steps`, with 5 entries (empty frame + one per layer L4 → L1).
- [x] 2.2 For each non-empty step, populate `computeTags` with the cumulative layer-compute tags (`['L4']`, `['L4','L3']`, …) and `commTags` with the cumulative AG and RS tags for the layers that should be visible at that frame (e.g., step 1 reveals `W4`, `L4`, `∂W4`; step 2 reveals through `W3`, `L3`, `∂W3`).
- [x] 2.3 Verify that frame 2's `commTags` includes at least one layer's RS (`∂W4`) and the next layer's AG (`W3`) so the SVG renders them at overlapping x-positions on the comm lane — this is the per-spec "inter-layer overlap visible by step 2" check.
- [x] 2.4 Write a one-sentence caption for each frame that names the action (e.g., "Backward starts; layer 4: AG W₄, compute ∂W₄, RS ∂W₄"). Captions must not re-derive the per-layer mechanism (that lives in `<FsdpBackward />` above and the surrounding prose).

## 3. Stepped render — share the SVG path with DP

- [x] 3.1 Generalize `SteppedDpTimeline` to read `schema.modes.default.steps` and the schema's lanes generically (rename to `SteppedTimeline` or similar). Pass through `WidgetShell` with the schema's `title` and `blurb` exactly as for DP.
- [x] 3.2 Update the `OverlapTimeline` entrypoint so any schema with `stepped: true` routes to the generalized stepped renderer (DP and fsdp-bwd both qualify).
- [x] 3.3 Confirm the stepped renderer filters blocks via the `computeTags` and `commTags` sets from the current frame — no other filtering logic is added.
- [x] 3.4 Confirm the `Block` component's existing styling already differentiates AG (dashed border, light fill) from compute (filled) without modification — the AG-vs-RS distinction comes from the block label only.

## 4. MDX render-site change — add the new staircase

- [x] 4.1 In `src/pages/blog/parallelism-roofline.mdx`, locate the `## FSDP — Reduce-scatter in place of all-gather` subsection under `# The Backwards Pass`.
- [x] 4.2 Add `<OverlapTimeline strategy="fsdp-bwd" client:visible />` on its own line immediately after the existing `<FsdpBackward client:visible />` line in that subsection.
- [x] 4.3 Do not add or remove any imports at the top of the MDX file — `OverlapTimeline` is already imported.
- [x] 4.4 Do not edit the TP or FSDP+TP backward subsections.

## 5. Non-target strategies unchanged

- [x] 5.1 For `strategy="fsdp"`, confirm the naive/overlapped toggle and static SVG render exactly as before — no `StepControls`, no `Caption`.
- [x] 5.2 For `strategy="tp"`, confirm the static within-layer staircase SVG renders exactly as before — no `StepControls`.
- [x] 5.3 For `strategy="dp"`, confirm the existing stepped staircase still renders with its existing 5 frames, captions, and reveal order.

## 6. Verify in the running app

- [x] 6.1 Launch the dev server (or use the existing background process) and open `http://localhost:4321/blog/parallelism-roofline`.
- [x] 6.2 Scroll to "# The Backwards Pass" → "## FSDP — Reduce-scatter in place of all-gather". Confirm the chip-pair `<FsdpBackward />` widget appears first, followed by the new `<OverlapTimeline strategy="fsdp-bwd" />` staircase.
- [x] 6.3 Step through the new staircase from frame 0 to the last frame using both ← Prev and Next →. Confirm:
  - the shell, fonts, button styling, and caption box match the `<OverlapTimeline strategy="dp" />` widget in the DP backward subsection;
  - each frame's caption is one sentence and names the action that frame adds;
  - the staircase fills in layer by layer in reverse order (L4 first, then L3, …);
  - by the second non-empty frame the comm lane shows at least one layer's RS-∂W block overlapping the next layer's AG-W block at the same x-positions;
  - the final frame shows all four layers' AG, compute, and RS blocks in the steady-state staircase.
- [x] 6.4 Confirm the DP backward staircase, the forward FSDP timeline, the TP timeline, the chip-pair backward widgets (`FsdpBackward`, `TpBackward`, `FsdpTpBackward`), and the DP backward chip-pair are all visually unchanged.

## 7. Documentation

- [x] 7.1 If any architectural commentary in `src/components/parallelism/staircase-shared.jsx`'s top comment (or the README that lists step-driven widgets) enumerates the stepped widgets, extend that list to include `OverlapTimeline strategy="fsdp-bwd"` so future maintainers know it follows the convention.
- [x] 7.2 Capture the new strategy key in any inline comment at the top of `OverlapTimeline.jsx` that enumerates supported strategies.
