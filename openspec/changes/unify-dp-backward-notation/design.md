## Context

The post uses two notational conventions for the backward pass:

- **Single-layer (`Y = X @ W`)**: forward and backward TP, FSDP, FSDP+TP. Gradients are `∂Y`, `∂W`, `∂X`.
- **Multi-layer (`X → a_1 → Y` with `z_k`, `σ'`, `⊙`, `δ_k`)**: DP backward, introduced by `add-dp-backward-dependency-chain` to expose the cross-layer overlap argument.

A reader who follows `∂Y` from the TP backward widget back to its DP-backward analog has to translate notation across subsections. The user flagged this directly: "is `∂Y` really `∂L/∂z`?" — the answer is yes, but the post should not force the question.

The fix is straightforward in spirit (use one notation everywhere) but has one wrinkle: the DP dependency chain genuinely needs *two layers* to argue that step 3 doesn't depend on step 2's all-reduce. Single-layer is not enough. So we keep the chain but write it as `X → Y_1 → Y_2`.

## Goals / Non-Goals

**Goals:**

- Use `Y_k`, `∂Y_k`, `W_k`, `∂W_k` throughout the DP backward subsection, matching the rest of the post.
- Keep the four-step dependency-chain argument readable: ∂Y_2 in (handed down), ∂W_2 = Y_1^⊤ ∂Y_2 (all-reduced), ∂Y_1 = ∂Y_2 W_2^⊤ (local, no AR dependency), ∂W_1 = X^⊤ ∂Y_1.
- Update the `OverlapTimeline` DP block labels and captions in lockstep so the visual matches the prose.

**Non-Goals:**

- Removing the two-layer chain. The overlap argument fundamentally needs more than one layer.
- Modeling the activation function. The two-layer chain in real ML has `a_k = σ(Y_k)` between matmuls; we elide that here and call out the elision in a parenthetical. Including σ would add a local Hadamard factor in step 3 (`∂Y_1 ← ∂Y_1 ⊙ σ'(Y_1)`) but does not change which gradients depend on which all-reduces — the only thing the overlap argument turns on.
- Editing TP, FSDP, or FSDP+TP subsections. They already use the right notation.
- Editing `DpBackward.jsx`. It already uses `X`, `W`, `Y`, `∂W` (no `z`/`σ`/`δ`).

## Decisions

### 1. Two-layer chain spelled `X → Y_1 → Y_2`

**Decision:** The dependency-chain prose introduces the chain as `X → Y_1 → Y_2` with `Y_1 = X @ W_1` and `Y_2 = Y_1 @ W_2`. The four steps use only `∂Y_1`, `∂Y_2`, `∂W_1`, `∂W_2`, and `X`. No `z_k`, no `a_k`, no `σ'`, no `⊙`, no `δ_k`, no `\partial L / \partial z_k`.

**Alternatives considered:**

- *Keep multi-layer notation but rename `z → Y` and `a → Y` everywhere*: collapses `a` and `Y` into one symbol, which conflicts when both appear in the same chain. Rejected.
- *Use `Y` (no subscript) for the layer-of-interest output and `X` for its input, with no notion of a "second layer"*: can't actually state the overlap argument, which requires two layers. Rejected.

### 2. Elide activations with a one-clause parenthetical

**Decision:** The dependency-chain passage adds `(Activations between the layers are elided here; including them would add a local Hadamard factor to step 3 but does not change the dependency structure the overlap argument turns on.)`. This sits inside the existing introductory sentence rather than as its own paragraph, so the prose stays tight.

**Rationale:** The post is about parallelism strategies, not nonlinearities. The two-layer chain is a pedagogical device, and the σ-derivative is a mathematical detail that distracts from the overlap argument. Naming the elision in passing earns the simplification without lying about what real backprop looks like.

### 3. `OverlapTimeline` DP labels match the new prose

**Decision:** The compute block labels in the DP timeline change from `∂L/∂z_{k-1}, ∂W_k` to `∂Y_{k-1}, ∂W_k` for k = 2, 3, 4 (layer 1's block stays `∂W_1` since there's no prior-layer gradient to propagate). The step captions change from `Layer k backward produces ∂L/∂z_{k-1}…` to `Layer k backward produces ∂Y_{k-1}…`.

**Rationale:** The block label is the visual anchor for "what this layer's backward produces"; if it disagrees with the prose, the reader gets the same translation friction the prose change is trying to eliminate.

## Risks / Trade-offs

- **[Risk]** Eliding activations may strike a careful reader as a sleight-of-hand. → Mitigation: the parenthetical explicitly names the elision and its (irrelevant-to-the-argument) consequence.
- **[Risk]** The two prior change documents in `openspec/changes/add-dp-backward-dependency-chain/` describe scenarios that no longer match the current code/prose. → Mitigation: this change's `MODIFIED Requirements` section restates the relevant scenarios with the new notation, so the spec snapshot stays internally consistent after merge.

## Migration Plan

- One-shot edit to `src/pages/blog/parallelism-roofline.mdx` (DP backward subsection prose) and `src/components/parallelism/OverlapTimeline.jsx` (DP block labels and captions).
- No data migration; no API change.
- Visual verification: open the post locally, scroll to the DP backward section, and step through the OverlapTimeline; confirm the prose, block labels, and captions all use `Y_k`, `∂Y_k`, `W_k`, `∂W_k`.
