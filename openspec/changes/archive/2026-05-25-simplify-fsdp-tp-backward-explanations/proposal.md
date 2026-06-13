## Why

The blog post `src/pages/blog/parallelism-roofline.mdx` now has a thorough, multi-subsection treatment of the DP backwards pass (the dependency chain, how overlap works, and a timeline). The FSDP, TP, and FSDP+TP backwards-pass sections that follow it carry their own heavy machinery (an 11-step FSDP staircase, a TP within-layer timeline, a 2D mesh widget with its own timeline), but the conceptual lifts they make — that backwards-pass collectives are transposes of forward-pass ones, that comm overlaps compute layer-by-layer or chunk-by-chunk — are now redundant with what DP backwards and the forward sections already explained. The result is that the second half of the post repeats itself.

We want the three later backwards sections to act as short "delta" passes: one paragraph plus a minimal diagram that mirrors the conventions used for that strategy's *forward* section (or its DP-backward analogue), trusting the reader to carry the established machinery across.

## What Changes

- Rewrite the three later backwards-pass subsections in `parallelism-roofline.mdx` ("FSDP", "TP", "FSDP + TP") to be short and delta-style: each names the swapped collective(s), points back to the established machinery, and lets the diagram carry the rest.
- Replace `src/components/parallelism/FsdpBackward.jsx` with a simplified component that mirrors the conventions of the forward FSDP visuals (`ShardingStage strategy="fsdp"` and `OverlapTimeline strategy="fsdp"`) — fewer steps, focus on the gather→compute→reduce-scatter mirror, no staircase-pairing detail.
- Replace `src/components/parallelism/TpBackward.jsx` with a simplified component that mirrors `TpStaircase` (the forward TP visual) — same chunked-staircase shape, but with AG replacing RS; drop the per-row ∂Y bookkeeping and the parallel timeline lane.
- Replace `src/components/parallelism/FsdpTpBackward.jsx` with a simplified component that mirrors `FsdpTpStaircase` (the forward FSDP+TP visual) — the same mesh-and-arrows convention, showing only the two swapped collectives (AG on TP, RS on FSDP); remove the bespoke timeline, counters, and StateDot legend.
- Keep `DpBackward.jsx` and the DP backwards subsection unchanged — that's the in-depth anchor the other three now defer to.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `parallelism-roofline-post`: ADD editorial requirements covering the three later backwards-pass subsections (FSDP, TP, FSDP+TP) — each must be short, delta-style, name the swapped collective(s), and defer to the established machinery rather than re-explaining it. The existing forward-pass "useful-ratio" requirements remain unchanged.

## Impact

- `src/pages/blog/parallelism-roofline.mdx` — rewrites three subsections under "The Backwards Pass" (FSDP, TP, FSDP+TP). DP backwards section untouched.
- `src/components/parallelism/FsdpBackward.jsx` — full rewrite, simpler diagram.
- `src/components/parallelism/TpBackward.jsx` — full rewrite, simpler diagram.
- `src/components/parallelism/FsdpTpBackward.jsx` — full rewrite, simpler diagram, drop the bespoke shell/timeline in favor of the shared `WidgetShell` convention.
- No other pages, components, or imports affected. The MDX still imports the same three component names; only their internals and the surrounding prose change.
- No build/dep changes.
