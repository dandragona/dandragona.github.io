## Why

The "Parallelism by the Roofline" post currently ends its strategy progression at FSDP + TP, a 2D mesh that combines two axes the reader has already met. It teaches no genuinely new collective and no new sharding shape — it is a recombination. The two strategies that *do* introduce new ideas — Context Parallelism (sharding the sequence, communicating K/V) and Expert Parallelism (routing tokens with all-to-all) — are missing. The post even seeds the all-to-all collective in its appendix ("the workhorse of mixture-of-experts routing and sequence-parallel transposes") but never pays it off. Replacing FSDP + TP with CP and EP turns the post's climax from a recombination into two new mental models, and finally exercises the all-to-all the appendix already defines.

## What Changes

- **BREAKING (editorial):** Remove both FSDP + TP sections — the forward `# FSDP + TP` section and the `## FSDP + TP — Both collectives swapped` backward subsection — and retire their components (`ShardingStage` `fsdp_tp` strategy, `FsdpTpStaircase`, `FsdpTpBackward`). The post's strategy progression becomes **DP → FSDP → TP → CP → EP**.
- Add a **Context Parallelism** forward section: shard the sequence dimension, and because attention mixes tokens, repair the split by moving K/V around the device ring (ring attention) — a per-block staircase that overlaps the K/V transfer under the attention matmul. Ends with a useful-ratio passage in the post's established style.
- Add an **Expert Parallelism** forward section: each device holds a subset of MoE experts; tokens are dispatched to their assigned expert with an **all-to-all**, processed locally, then combined back with a second all-to-all. Ends with a useful-ratio passage.
- Add **CP** and **EP** backward subsections under `# The Backwards Pass`, each a delta-style short subsection (one paragraph + widget) naming the transposed collective, matching the shape rules the existing FSDP/TP backward subsections already follow.
- Build **full interactive components** for both strategies, matching the existing per-strategy pattern and `staircase-shared.jsx` conventions: new `ShardingStage` strategies (`cp`, `ep`), a CP forward overlap/staircase widget and an EP routing widget, and `CpBackward` / `EpBackward` step-driven delta visuals (plus `OverlapTimeline` `cp`/`ep` schemas if the CP/EP overlap is shown on a timeline lane).
- Update the **Unified Picture** comparison table (drop the FSDP + TP row, add CP and EP rows) and the section-outline comment block.

## Capabilities

### New Capabilities
<!-- None. CP and EP are new sections and widgets, but they extend the existing post capability rather than introducing a separately-specified capability. Their requirements are added as deltas below. -->

### Modified Capabilities
- `parallelism-roofline-post`: Remove the FSDP + TP forward and backward requirements/scenarios and their widget requirements; add forward-section, useful-ratio, backward-subsection, and widget requirements for Context Parallelism and Expert Parallelism; update the capability Purpose to describe the DP/FSDP/TP/CP/EP progression.

## Impact

- **Post:** `src/pages/blog/parallelism-roofline.mdx` — section removals, two new forward sections, two new backward subsections, updated import block, updated comparison table and outline comment.
- **Components (new):** `ContextParallel*`/CP forward widget, `ExpertParallel*`/EP forward widget, `CpBackward.jsx`, `EpBackward.jsx` under `src/components/parallelism/`.
- **Components (modified):** `ShardingStage.jsx` (add `cp`, `ep` strategies; remove or retain `fsdp_tp`), `OverlapTimeline.jsx` (add `cp`/`ep` schemas if used), reuse `staircase-shared.jsx` and `CollectivePrimer.jsx` (all-to-all panel) unchanged.
- **Components (removed):** `FsdpTpStaircase.jsx`, `FsdpTpBackward.jsx`, and the `fsdp_tp` branch of `ShardingStage.jsx`.
- **Spec:** `openspec/specs/parallelism-roofline-post/spec.md` updated via the delta in this change.
- No routing, build, or dependency changes; this is a single-post content + components change.
