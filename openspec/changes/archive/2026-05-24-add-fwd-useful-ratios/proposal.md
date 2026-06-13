## Why

The TP forward section in the parallelism-roofline blog post ends with a "useful ratio" line ($E / P$) that tells the reader the dimension-vs-mesh regime in which TP starts to pay off. The DP, FSDP, and FSDP+TP forward sections lack the analogous one-liner, so the reader leaves each section without a concrete heuristic for when that strategy is the right pick. Adding parallel explanations gives every forward-pass strategy the same takeaway shape and makes the four sections directly comparable.

## What Changes

- Add a short "useful ratio" sentence to the **DP** forward section that names the compute-vs-communication regime where DP wins (essentially: forward pays nothing, so the cost lives in the backward all-reduce — useful while $B / P$ stays large enough to keep per-chip compute well above the all-reduce-per-step cost).
- Add a "useful ratio" sentence to the **FSDP** forward section explaining the regime where the per-layer all-gather of $W$ hides under the matmul (compute $\sim B E^2 / P$ vs. activation collective $\sim E^2 / P$, so larger $B$ buys overlap room).
- Add a "useful ratio" sentence to the **FSDP + TP** forward section explaining that the two axes each impose their own ratio (FSDP axis wants large per-axis $B$; TP axis wants large $E$ relative to its axis size), and the optimal mesh shape balances the two.
- Keep wording, formatting, and math style consistent with the existing TP line at `src/pages/blog/parallelism-roofline.mdx:92`.

## Capabilities

### New Capabilities
- `parallelism-roofline-post`: documents the forward-pass content guarantees for the blog post — including the requirement that each forward-pass strategy ends with a "useful ratio" heuristic.

### Modified Capabilities
<!-- none — no prior spec exists for this capability -->


## Impact

- Edits `src/pages/blog/parallelism-roofline.mdx` only (three small prose additions inside existing sections).
- No code, component, or build changes. No new imports, props, or assets.
- Reader-facing: each forward-pass section now ends with the same kind of heuristic, so the four strategies can be compared on the same axis.
