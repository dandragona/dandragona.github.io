## 1. Dependency-chain prose

- [x] 1.1 In `src/pages/blog/parallelism-roofline.mdx`, rewrite the introductory sentence of the "The dependency chain" passage to use `X → Y_1 → Y_2` with explicit `Y_1 = X @ W_1` and `Y_2 = Y_1 @ W_2`, plus a parenthetical noting activations are elided.
- [x] 1.2 Rewrite the four-step enumeration using `∂Y_2`, `∂W_2`, `∂Y_1`, `∂W_1` only. Step 3's formula is `∂Y_1 = ∂Y_2 W_2^⊤`.
- [x] 1.3 Rewrite the overlap-argument paragraph to reference `∂Y_2` and `W_2` (no `∂L/∂z_2`).

## 2. "How the overlap works" prose

- [x] 2.1 In the same MDX file, replace `a_1^{\top} \, (\partial L / \partial z_2)` with `Y_1^{\top} \, \partial Y_2` in the "Compute ∂W_2 locally" bullet.

## 3. OverlapTimeline DP labels and captions

- [x] 3.1 In `src/components/parallelism/OverlapTimeline.jsx`, change the compute block labels for the DP strategy from `∂L/∂z3, ∂W4`, `∂L/∂z2, ∂W3`, `∂L/∂z1, ∂W2` to `∂Y3, ∂W4`, `∂Y2, ∂W3`, `∂Y1, ∂W2` (layer 1's `∂W1`-only label is unchanged).
- [x] 3.2 Update the DP step captions accordingly: `Layer 4 backward produces ∂Y3 (feeds layer 3) and ∂W4…`; `Layer 3 backward produces ∂Y2 and ∂W3…`; `Layer 2 backward produces ∂Y1 and ∂W2…`.

## 4. Verification

- [x] 4.1 Run a final grep for `z_1`, `z_2`, `a_1`, `\sigma`, `\odot`, `\delta`, `partial L`, and `∂L/∂z` across the MDX file and all `src/components/parallelism/*.jsx` files; confirm no matches remain.
- [x] 4.2 Open the post in the browser and step through both the `DpBackward` chip-pair widget and the `OverlapTimeline` DP staircase; confirm all block labels, captions, and prose use only `Y_k`, `∂Y_k`, `W_k`, `∂W_k`, `X`.

## 5. Spec verification

- [ ] 5.1 Run `openspec status --change unify-dp-backward-notation` and confirm the deltas validate against the parallelism-roofline-post spec.
- [ ] 5.2 Confirm `MODIFIED Requirements` supersede the corresponding scenarios from the prior `add-dp-backward-dependency-chain` change.
