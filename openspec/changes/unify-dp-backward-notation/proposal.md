## Why

The `add-dp-backward-dependency-chain` change deliberately introduced multi-layer ML notation (`z_1`, `z_2`, `a_1`, `\sigma'`, `\odot`, `\partial L / \partial z_k`, `δ_k`) inside the DP backward subsection so the cross-layer overlap argument had a concrete chain to walk. That decision is the cause of a reader-visible inconsistency: the TP and FSDP+TP sections (and the new `TpBackward` widget) reason about `∂Y` and `∂W` in the post's single-layer `Y = X @ W` framework, while the DP backward subsection alone uses `∂L/∂z` and friends. A reader who maps `∂Y` in the TP diagram back to its DP-backward analog has to translate notation across subsections.

The fix: keep the multi-layer chain that the overlap argument needs, but write it in the post's single-layer notation. The chain becomes `X → Y_1 → Y_2` with `Y_1 = X @ W_1` and `Y_2 = Y_1 @ W_2`, and gradients are `∂Y_1`, `∂Y_2`, `∂W_1`, `∂W_2`. Activations between layers are elided (the overlap argument doesn't depend on them; including σ would add a local Hadamard factor in step 3 but leave the dependency structure identical).

## What Changes

- **BREAKING (prose)**: In `src/pages/blog/parallelism-roofline.mdx`, rewrite the "The dependency chain" passage to use `Y_1`, `Y_2`, `∂Y_1`, `∂Y_2`, `W_1`, `W_2`, `∂W_1`, `∂W_2`. Drop `z_k`, `a_k`, `σ'`, `⊙`, and `\partial L / \partial z_k` entirely. Add a one-clause parenthetical noting activations are elided.
- **BREAKING (prose)**: In the "How the overlap works" passage, replace `a_1^{\top} (\partial L / \partial z_2)` with `Y_1^{\top} \partial Y_2`.
- **BREAKING (visual)**: In `src/components/parallelism/OverlapTimeline.jsx`, update the DP timeline's compute block labels from `∂L/∂z_{k-1}, ∂W_k` to `∂Y_{k-1}, ∂W_k`, and the DP captions from `∂L/∂z_k` to `∂Y_k`.
- No changes to `DpBackward.jsx` (already uses the single-layer convention).
- No changes to the FSDP, TP, FSDP+TP forward or backward subsections.

## Capabilities

### Modified Capabilities

- `parallelism-roofline-post`: the "DP backward subsection explains the backprop dependency chain" and "DP backward subsection contains a step-by-step overlap walkthrough" requirements (added by `add-dp-backward-dependency-chain`) shift from `z`/`a`/`σ`/`⊙`/`δ` notation to `Y_k`/`∂Y_k` notation. The "Multi-layer notation stays scoped to the DP backward subsection" requirement is reframed in terms of the new symbols: only `Y_1`, `Y_2`, `W_1`, `W_2`, and their gradients appear in the DP backward subsection — and now they share their vocabulary with the rest of the post rather than introducing a new one.

## Impact

- Affected code: `src/pages/blog/parallelism-roofline.mdx` (DP backward subsection only) and `src/components/parallelism/OverlapTimeline.jsx` (DP timeline labels and captions only).
- Affected spec: `openspec/specs/parallelism-roofline-post/spec.md` — three modified requirements from the prior `add-dp-backward-dependency-chain` change.
- No new components, no new MDX imports, no edits outside the DP backward subsection.
