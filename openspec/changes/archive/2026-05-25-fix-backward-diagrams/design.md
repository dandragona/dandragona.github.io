## Context

The parallelism-roofline blog uses interactive React components to walk readers through forward and backward passes for DP, FSDP, TP, and FSDP+TP. The forward diagrams are well-aligned with the underlying math. The three backward diagrams were authored later and drifted: `FsdpBackward` compresses three actions per frame from step 4 onward and asserts an impossible same-layer compute/RS overlap; `TpBackward` shows an unused `W` tile and uses operator glyphs (`↓`, `→`) that obscure which matmul is actually being computed; `FsdpTpBackward` has a phrasing weakness in the step-2 caption.

Stakeholders: readers of the blog, who use the diagrams to build a mental model of FSDP/TP communication patterns. There is no programmatic API surface to preserve — the components are leaf React components in a single MDX post.

## Goals / Non-Goals

**Goals:**
- Each `FsdpBackward` step depicts exactly one atomic distributed-training action (or one overlap pair), matching the rhythm of forward diagrams.
- Every interior layer's `∂W` passes through the visible `full → rs-inflight → sharded` lifecycle, not just layer 4.
- Captions describe overlaps that are physically possible (RS of layer L overlaps with compute of layer L−1, not compute of layer L).
- `TpBackward` panel makes it visually clear that the operation is `∂W = Xᵀ @ ∂Y`, with no spurious tensor on screen.
- `TpBackward` consumed-row state for peer `∂Y` mirrors the forward staircase's "done" treatment.
- `FsdpTpBackward` step-2 caption unambiguously names the FSDP axis as the partial-sum axis.

**Non-Goals:**
- Re-deriving the math in the prose. The MDX prose is correct; only embedded components change.
- Changing the visual style system (`staircase-shared.jsx`), color palette, or `WidgetShell` chrome.
- Reworking forward diagrams or the DP backward.
- Adding new strategies, layers, or chip counts.

## Decisions

### Decision 1: Expand `FsdpBackward` to one-action-per-step, 11 steps total

The current 8-step sequence is:

```
0 fwd-done | 1 AG W₄ | 2 cmp ∂W₄ | 3 RS ∂W₄ + AG W₃
4 cmp ∂W₃ + RS ∂W₃ + AG W₂   ← bundles 3 actions, asserts impossible overlap
5 cmp ∂W₂ + RS ∂W₂ + AG W₁
6 cmp ∂W₁ + RS ∂W₁
7 done
```

We replace this with the natural FSDP pipeline schedule:

```
0  fwd-done
1  AG W₄
2  cmp ∂W₄          (full ∂W₄)
3  RS ∂W₄  ‖  AG W₃ (overlap, different layers)
4  cmp ∂W₃          (full ∂W₃)
5  RS ∂W₃  ‖  AG W₂
6  cmp ∂W₂          (full ∂W₂)
7  RS ∂W₂  ‖  AG W₁
8  cmp ∂W₁          (full ∂W₁)
9  RS ∂W₁           (tail, runs alone)
10 done
```

11 frames lets each compute step show `gMode: 'full'` and each RS+AG frame show `gMode: 'rs-inflight'`. Compute steps render with `wMat: true`; AG/RS frames render with `wMat: false`. `commCount` increments by exactly 1 at every AG or RS frame, ending at 8 (4 AGs + 4 RSs).

**Alternative considered:** Keep the 8-step compressed view but rewrite captions to be technically defensible ("the post-compute RS+AG overlap is bundled into this step"). Rejected — the visual gMode transitions cannot be made faithful without separating frames, and the corrected wording would be longer than the extra frames are costly.

### Decision 2: `TpBackward` chip panel drops the `W` tile

`∂W = Xᵀ @ ∂Y` does not consume `W`. Showing `X · W ↓ ∂Y → ∂W` invites readers to parse a four-operand expression that isn't a matmul. We render only the participating tensors:

```
Xᵀ  @  ∂Y  =  ∂W
```

with standard `@` and `=` glyphs from `staircase-shared.jsx`. `Xᵀ` is rendered as a relabeled `X` tile (the underlying shape on each chip is unchanged — chip i still owns its column shard) with subtitle `Xᵀ` or `X (col i)`. `∂X`, which would consume `W`, is not depicted; the caption explicitly notes that `∂X` follows the dual `∂X = ∂Y @ Wᵀ` path and remains column-sharded with no communication.

**Alternative considered:** Show two side-by-side matmuls (`∂W` and `∂X`). Rejected — doubles the panel width and adds a second tensor lifecycle (`∂X`) that doesn't add to the staircase intuition the diagram is trying to convey.

### Decision 3: `TpBackward` consumed peer `∂Y` row stays painted (faded)

Current behavior: after `step > rowIdx + 1`, the peer chip's column for that row returns to `ABSENT` (light grey). New behavior: a consumed row stays painted in the chip's color at reduced opacity (~0.35) with no stripes, matching the visual convention in forward `TpStaircase` where reduce-scattered "done" rows remain visible. This signals "this data flowed into `∂W`" rather than "this data vanished."

Implementation: extend `dyState` to return `'consumed'` (already there) and update `dyFill` to render `{ fill: chipColor, alpha: 0.35 }` instead of `{ fill: ABSENT }` for the consumed case. (`TensorGrid` already supports an `alpha` parameter — see `dwFill` in the same file.)

### Decision 4: `FsdpTpBackward` step-2 caption is reworded only

The structural behavior of `FsdpTpBackward` is correct. The caption "partial along the FSDP axis (every chip has an opinion on every row of W)" can be read as "TP peers disagree on the same row of `∂W`," which is wrong (TP peers see disjoint contraction columns of X). New wording names the partial-sum axis directly: "Each chip computes ∂W at full output shape from its FSDP batch slice. Chips that share a TP rank hold partial sums of the same `∂W` rows — different batch rows summed — so the FSDP axis is the partial-sum axis that the next RS will reduce."

No code changes besides the `caption` string.

## Risks / Trade-offs

- **[Risk] Expanding `FsdpBackward` from 8 to 11 steps may feel slower for casual readers** → Mitigation: the existing `StepControls` already supports prev/next navigation, and the per-step captions now carry more signal per frame. No autoplay to disrupt.
- **[Risk] Dropping `W` from `TpBackward` may confuse readers expecting "same operands as forward"** → Mitigation: the operator change (`Xᵀ @ ∂Y = ∂W`) is explicitly different from forward (`X @ W = Y`), reinforcing that this is the gradient computation, not a forward matmul. Caption calls this out.
- **[Risk] Visual diff between forward and backward TP staircase grows** → Acceptable. The forward shows `X @ W = Y`; the backward shows `Xᵀ @ ∂Y = ∂W`. They are different operations; pretending otherwise was the original problem.
- **[Trade-off] We don't add `∂X` to `TpBackward`** → Keeps the panel readable. The MDX prose can mention `∂X` separately if needed; current prose already implies it.
