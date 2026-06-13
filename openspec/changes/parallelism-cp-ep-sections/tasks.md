## 1. CP forward component — `CpStaircase`

- [x] 1.1 Create `src/components/parallelism/CpStaircase.jsx` importing `WidgetShell`, `StepControls`, `Caption`, and color/cell tokens from `staircase-shared.jsx`
- [x] 1.2 Lay out a device ring (3–4 chips) where each chip shows its sequence chunk's Q and the current K/V block it holds
- [x] 1.3 Implement a ≤5-frame step sequence: each step rotates K/V one hop around the ring and accumulates one more partial-attention contribution per chip
- [x] 1.4 Show the overlap — at least one frame where the next block's K/V transfer is in flight while the current block's attention matmul is computing
- [x] 1.5 Write one-sentence `Caption` per frame that names the action only (no overlap re-derivation)

## 2. EP forward component — `EpRouting`

- [x] 2.1 Create `src/components/parallelism/EpRouting.jsx` using `WidgetShell`, `StepControls`, `Caption` from `staircase-shared.jsx`
- [x] 2.2 Render tokens colored by their assigned expert and devices each holding a subset (N/P) of experts
- [x] 2.3 Implement a ≤5-frame step sequence: router assignment → dispatch all-to-all → local expert FFN compute → combine all-to-all back to origin
- [x] 2.4 Make the two all-to-all steps visually distinct (dispatch vs combine) and write one-sentence captions per frame

## 3. CP and EP backward components

- [x] 3.1 Create `src/components/parallelism/CpBackward.jsx` mirroring `CpStaircase`'s ring: ≤5 frames, K/V ring runs in reverse carrying `∂K`/`∂V`, `WidgetShell`/`StepControls`/`Caption`
- [x] 3.2 Create `src/components/parallelism/EpBackward.jsx` mirroring `EpRouting`'s all-to-all: ≤5 frames, dispatch/combine swap roles to re-route gradients
- [x] 3.3 Verify all backward captions name the action only and contain none of the forbidden phrases ("does not depend on", "the next layer's backward", "transpose", "all-reduce = ")

## 4. `ShardingStage` — add `cp`, remove `fsdp_tp`

- [x] 4.1 Add a `cp` entry to the `STRATEGIES` config (label, blurb, `supportsMaterialize: false`)
- [x] 4.2 Route `cp` through the existing DP ownership in `ownsBatchRow`/`ownsWRow`/`getFills` (sequence rows split, `W` replicated, `Y` rows split, no collective)
- [x] 4.3 Remove the `fsdp_tp` `STRATEGIES` entry and every `if (strategy === 'fsdp_tp')` branch in the ownership/fill functions

## 5. Remove FSDP + TP components

- [x] 5.1 Delete `src/components/parallelism/FsdpTpStaircase.jsx`
- [x] 5.2 Delete `src/components/parallelism/FsdpTpBackward.jsx`
- [x] 5.3 Update the comment header in `staircase-shared.jsx` that lists consumers to drop `FsdpTpStaircase`/`FsdpTpBackward` and add `CpStaircase`/`EpRouting`/`CpBackward`/`EpBackward`

## 6. MDX — imports and section outline

- [x] 6.1 In `src/pages/blog/parallelism-roofline.mdx`, remove the `FsdpTpStaircase` and `FsdpTpBackward` imports and add `CpStaircase`, `EpRouting`, `CpBackward`, `EpBackward` imports from `../../components/parallelism/`
- [x] 6.2 Update the SECTION OUTLINE comment block: replace the "FSDP + TP" line with "Context Parallelism" and "Expert Parallelism" entries and update the backward-pass component list

## 7. MDX — forward sections

- [x] 7.1 Remove the entire `# FSDP + TP` forward section (intro prose through the `<FsdpTpStaircase />` render and its useful-ratio line)
- [x] 7.2 Add a `# Context Parallelism` section after TP: sequence-sharding frame (linear layer is free, like DP; attention forces K/V movement), `<ShardingStage strategy="cp" client:visible />`, ring-attention prose, `<CpStaircase client:visible />`, optional one-sentence Ulysses/all-to-all note, and the `S/P` useful-ratio line
- [x] 7.3 Add a `# Expert Parallelism` section after CP: N/P experts per device, local router, dispatch all-to-all → expert FFN → combine all-to-all, `<EpRouting client:visible />`, all-to-all/appendix callback and imbalance failure mode, and the `E` useful-ratio line

## 8. MDX — backward subsections and unified picture

- [x] 8.1 Remove the `## FSDP + TP — Both collectives swapped` backward subsection and its `<FsdpTpBackward />` render
- [x] 8.2 Add a `## CP — …` backward subsection: one prose paragraph (K/V ring reverses, carrying `∂K`/`∂V`) + `<CpBackward client:visible />` only — no `###`, lists, or math
- [x] 8.3 Add an `## EP — …` backward subsection: one prose paragraph (all-to-all again; dispatch/combine swap to re-route gradients) + `<EpBackward client:visible />` only — no `###`, lists, or math
- [x] 8.4 Update the Unified Picture comparison table: remove the FSDP + TP row, add CP (sequence split / K/V ring) and EP (tokens+experts split / dispatch+combine all-to-all) rows

## 9. Spec sync and verification

- [x] 9.1 Update the `## Purpose` line in `openspec/specs/parallelism-roofline-post/spec.md` to describe the DP/FSDP/TP/CP/EP progression (at archive time)
- [x] 9.2 `grep -rn "fsdp_tp\|FsdpTp" src/` returns no matches
- [x] 9.3 Run `npm run build` (or the project's build) and confirm the post compiles with no missing-import or MDX errors
- [x] 9.4 Start the dev server and visually check each new widget steps correctly (Playwright MCP screenshots of CP forward, EP forward, CP backward, EP backward)

## 10. CP Ulysses transpose diagram (follow-up)

- [x] 10.1 Create `src/components/parallelism/CpUlysses.jsx` — a step-driven sequence×heads grid that transposes (row-sharded ⇄ column-sharded) via two all-to-alls with a local full-attention frame, using `WidgetShell`/`StepControls`/`Caption`
- [x] 10.2 Wire it into the `# Context Parallelism` section after `<CpStaircase />`: import, expand the Ulysses parenthetical into a paragraph + `<CpUlysses client:visible />` + ring-vs-Ulysses contrast, keeping the ring's $S/P$ useful-ratio line last; update the section-outline comment
- [x] 10.3 Adversarial verification pass (technical correctness vs. DeepSpeed-Ulysses literature, code/visual consistency, prose/spec consistency); applied fixes — Q/K/V framing, head-count (combinatorial) scaling cap, glyph direction label, header alignment
- [x] 10.4 Update the change delta spec: relax the "one sentence" Ulysses constraint and add the `CpUlysses` widget requirement; build + Playwright re-verify
