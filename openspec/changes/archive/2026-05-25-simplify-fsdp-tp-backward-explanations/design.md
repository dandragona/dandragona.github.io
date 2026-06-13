## Context

The "Backwards Pass" section of `src/pages/blog/parallelism-roofline.mdx` currently has four subsections:

1. **DP** — one-sentence intro → `<DpBackward />` (4-step widget) → `### The dependency chain` (full math derivation of why the per-layer all-reduce can run while the next backward is computing) → `### How the overlap works` (per-layer schedule prose) → `<OverlapTimeline strategy="dp" />`.
2. **FSDP** — one-sentence intro → `<FsdpBackward />`, an 11-step staircase that visualizes every atomic AG / compute / RS-paired-with-next-AG frame.
3. **TP** — one-sentence intro → `<TpBackward />`, a 6-step chunked staircase with its own SVG timeline lane below the chip panels.
4. **FSDP+TP** — one-sentence intro → `<FsdpTpBackward />`, a 5-step mesh widget with its own SVG timeline, counter, and `StateDot` legend.

The DP subsection is the conceptual anchor: it is where the reader first sees that (a) backward-pass collectives are transposes of forward-pass ones, (b) the per-layer collective can overlap with the next layer's compute, and (c) `all-reduce = reduce-scatter + all-gather`. By the time the reader reaches FSDP backward, all three of those ideas have already landed. The FSDP, TP, and FSDP+TP backward visuals were authored before the DP backward dependency-chain treatment existed, so they each re-prove the overlap argument and re-introduce the staircase from scratch — which is now redundant and slows the back half of the post.

**Constraints:**
- The MDX imports `DpBackward`, `FsdpBackward`, `TpBackward`, `FsdpTpBackward` by name and renders them with `client:visible`. Component file paths and default-export names must stay the same.
- The forward-pass visuals (`ShardingStage`, `OverlapTimeline`, `TpStaircase`, `FsdpTpStaircase`) and the DP backward visual (`DpBackward`) define the visual vocabulary the reader has already absorbed. New simplified components should reuse the shared primitives in `staircase-shared.jsx` (`WidgetShell`, `Caption`, `StepControls`, `TensorGrid`, `OpSymbol`, the `CHIP_COLORS` / `YELLOW` / `ABSENT` palette) so they sit visually next to the rest of the post.
- The post lives in `src/pages/blog/parallelism-roofline.mdx`; the layout and other prose around the backward section stay put.
- The `fix-backward-diagrams` change (unarchived, in `openspec/changes/`) added detailed requirements for the *current* 11-step / 6-step / 5-step shapes of these widgets. Those requirements describe the now-superseded designs. Once this change ships, that unarchived change should be archived as superseded (handled in tasks, not here).

## Goals / Non-Goals

**Goals:**
- Reduce the reader's cognitive load in the back half of the post by trusting the DP backward subsection as the in-depth anchor.
- Each of the three non-DP backward subsections becomes: one paragraph (≤4 sentences) of prose + one widget with ≤5 steps, where the widget's job is to *name the swapped collective(s)*, not to re-prove the overlap argument.
- Reuse the *forward*-pass visual conventions for each strategy so the backward widget reads as a "mirror" of the forward widget rather than its own self-contained explanation:
  - FSDP backward: same chip-card-with-tensors-and-comm-link convention as `DpBackward`, using `WidgetShell` from `staircase-shared.jsx`. ≤5 steps.
  - TP backward: same chunked-staircase convention as `TpStaircase`, but with the AG collective in place of RS. Drop the separate timeline-lane SVG. ≤5 steps.
  - FSDP+TP backward: same 2×2 mesh-and-arrows convention as `FsdpTpStaircase`, showing the two swapped collectives across the two axes. Drop the bespoke shell, counter, and timeline. ≤5 steps.
- Keep all four widgets stylistically compatible (same `WidgetShell`, same palette, same `StepControls`) so the section reads as a series.

**Non-Goals:**
- Do NOT change the DP backward subsection prose, `DpBackward.jsx`, or the DP `OverlapTimeline` strategy.
- Do NOT change the forward-pass sections, the appendix, or the unified-picture / further-reading sections.
- Do NOT add new components, new MDX imports, or new dependencies. The MDX import list is unchanged.
- Do NOT touch `staircase-shared.jsx` or alter shared primitives — only consume them.
- Do NOT change the post's URL, frontmatter, or layout.

## Decisions

### Decision 1: Mirror each strategy's *forward* visual, not the DP *backward* visual, for the three non-DP backward components

**What:** `FsdpBackward` keeps its DP-like chip-pair shape (matches the DP-backward look, since FSDP forward used a `ShardingStage` snapshot plus a separate `OverlapTimeline` — there is no single "FSDP forward staircase" to mirror). `TpBackward` adopts the chunked-staircase shape from `TpStaircase`. `FsdpTpBackward` adopts the mesh-and-arrows shape from `FsdpTpStaircase`.

**Why:** TP and FSDP+TP forwards already taught the staircase / mesh-with-arrows vocabulary; reusing those shapes makes the backward widgets read as one-frame deltas on visuals the reader already understands. FSDP forward's overlap story was told via a separate `OverlapTimeline` widget, so the FSDP backward widget can stay in the simpler DP-backward chip-pair form and just show the gather→compute→RS mirror without re-staircasing.

**Alternatives considered:**
- *Use the same chip-pair shape (à la `DpBackward`) for all three.* Rejected — for TP and FSDP+TP this would lose the within-layer / two-axis distinction that the forward visuals worked to establish.
- *Reuse the existing complex widgets and only trim captions.* Rejected — the user explicitly asked to rewrite the diagrams, not just the prose, and the current widgets re-prove arguments the DP section now owns.

### Decision 2: Hard cap each new backward widget at 5 steps

**What:** `FsdpBackward` → 4 steps (start, AG, compute, RS-done). `TpBackward` → 4 or 5 steps (mirror `TpStaircase`'s chunked sequence but with fewer chunks, e.g. 2 chunks → 4 steps, since the reader has seen the staircase shape in `TpStaircase`). `FsdpTpBackward` → 4 steps (start, AG on TP, compute, RS on FSDP).

**Why:** The DP backward subsection earns its in-depth treatment because it's the reader's first exposure to the transpose-of-collective idea. The other three subsections are deltas, and deltas should fit in one screen. A 4-step widget reads as "here is the mirror; here is the swap" rather than as another full lesson.

**Alternatives considered:**
- *Match `DpBackward`'s 4 steps exactly.* This is what we land at for FSDP and FSDP+TP. TP gets one extra step to keep the chunked-staircase shape recognizable, but stays bounded.
- *Animate continuously instead of stepping.* Rejected — the rest of the post is step-driven; consistency wins.

### Decision 3: Each new backward widget uses `WidgetShell` + `StepControls` + `Caption` from `staircase-shared.jsx`

**What:** Drop the bespoke shell-plus-buttons inside `FsdpTpBackward.jsx` (which currently rolls its own card div, button styles, and step counter). Use the same shell primitives the DP / FSDP / TP backwards already use.

**Why:** Visual consistency across the four backward widgets. Less code, less custom CSS-in-JS, fewer divergences.

### Decision 4: Drop the in-widget SVG timelines from `TpBackward` and `FsdpTpBackward`

**What:** Remove the per-widget `Timeline` SVG (the parallel "compute / all-gather" lane in `TpBackward`, and the three-lane "compute / FSDP axis / TP axis" lane with playhead in `FsdpTpBackward`).

**Why:** The forward sections already taught the staircase-with-overlap shape via `OverlapTimeline` and `TpStaircase`. The TP / FSDP+TP backward sections do not need to re-render a timeline to establish that AG-on-the-next-chunk overlaps with backward compute on the current chunk — the reader already knows. Removing these timelines is the largest single source of complexity reduction.

### Decision 5: Each non-DP backward subsection collapses to one short paragraph in the MDX

**What:** Each of the three subsections becomes:
- One subsection heading (`## FSDP — …`, `## TP — …`, `## FSDP + TP — …`).
- One paragraph (≤4 sentences) naming the swapped collective(s) and pointing back to the DP backward / forward-section machinery. No new math derivation, no per-step bullet list.
- One widget render (`<FsdpBackward client:visible />`, etc.).

**Why:** Same delta principle. The previous version had per-subsection bullet lists and re-explanations of the overlap story; those go away.

### Decision 6: Caption tone matches the existing forward staircase captions, not the per-frame deep-dive captions

**What:** Captions in the new widgets are one short sentence per step, naming what the frame depicts. Avoid the current FSDP-backward style ("…(If the forward cached it, this AG may be skipped.)", "two collectives in flight, one frame", "the unavoidable tail of the backward staircase") that re-litigates the schedule.

**Why:** The reader already knows the schedule from the DP backward subsection and the forward staircase visuals. The caption's job is now naming, not arguing.

## Risks / Trade-offs

- **[Risk] Loss of detail will frustrate the engaged reader.** → Mitigation: the deep-dive lives in the DP backward subsection (unchanged). The simplified subsections each include one sentence pointing back to the established machinery so a curious reader knows where the detail is.
- **[Risk] The unarchived `fix-backward-diagrams` change spec describes the old 11-step / 6-step / 5-step diagrams.** → Mitigation: that change is in `openspec/changes/` (not archived to `openspec/specs/`), so it is not currently a binding spec. After this change ships, archive `fix-backward-diagrams` as superseded by `simplify-fsdp-tp-backward-explanations`. The tasks artifact captures this step.
- **[Risk] Removing the FSDP+TP timeline drops the only place the reader sees the two-axis overlap drawn explicitly.** → Mitigation: the forward FSDP+TP section's `FsdpTpStaircase` already shows the steady-state interleaving on the forward side; the backward subsection prose names that the same interleaving applies with collectives swapped. Acceptable trade.
- **[Risk] A reader who skips the DP backward subsection lands in FSDP backward with no overlap intuition.** → Mitigation: this is the same reader-skipping risk the rewrite implicitly accepts as part of the delta-style approach; the per-section pointer back to DP makes it self-correcting.
- **[Trade-off] Visual variety across the three non-DP backward subsections drops.** They will look more uniform with each other (and with DP backward). Net positive: the section reads as a series rather than four ad-hoc widgets.

## Migration Plan

This is a documentation / UI change with no data migration. Deployment is the normal blog deploy (Astro build → push). Rollback is `git revert` of the change commit.

After deployment:
1. Verify the post renders locally (`pnpm dev` or whatever the project uses) and each of the four backward widgets advances through its steps without console errors.
2. Archive `openspec/changes/fix-backward-diagrams/` as superseded.

## Open Questions

- Should the simplified FSDP backward widget show 2 chips (matching the current `FsdpBackward` and `DpBackward`) or 4 chips? Decision: 2 chips, to match DP backward and minimize visual noise.
- Should the simplified TP backward retain the per-chunk subtitle ("AG row 0", "1/4 chunks", etc.)? Decision: yes — the chunk-by-chunk progress label is the cheapest way to convey the staircase mirroring without a separate timeline.
