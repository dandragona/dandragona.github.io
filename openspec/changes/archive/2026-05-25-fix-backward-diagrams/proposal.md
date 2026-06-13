## Why

The interactive backward-pass diagrams on the parallelism-roofline blog post (`FsdpBackward`, `TpBackward`, `FsdpTpBackward`) contain a correctness bug and several visual inconsistencies that mislead readers about what actually overlaps in distributed backward. The FSDP backward in particular claims that `RS ∂W_L` overlaps with `compute ∂W_L` of the same layer — but RS cannot start until that compute finishes; the real overlap is with the **next** layer's compute.

## What Changes

- Fix `FsdpBackward` step sequencing so each step represents one atomic phase (AG, compute, RS+next-AG overlap), instead of bundling three actions into one frame from layer 3 onward. The corrected pipeline shows `compute_l` overlapping with `AG W_{l-1}`, and `RS ∂W_l` overlapping with `compute_{l-1}` — never with `compute_l` itself.
- Render `∂W` at full shape (`gMode: 'full'`) at the moment each interior layer's gradient is being computed, so the "compute full → reduce-scatter to sharded" transition is visible for every layer, not just layer 4.
- Rewrite the `FsdpBackward` step captions to describe what actually overlaps in each frame, removing the misleading "RS ∂W_l overlaps with compute ∂W_l" wording.
- Simplify the `TpBackward` chip panel so the operator glyphs no longer suggest `X · W ↓ ∂Y → ∂W` is a single matmul. Drop the unused `W` tile (since `∂W = Xᵀ @ ∂Y` does not consume W) or split into two operations with clear labels.
- Keep `TpBackward`'s peer `∂Y` column visible (faded) after a row has been consumed, instead of returning it to `ABSENT`, so the visual mirrors the forward staircase's "done" state.
- Tighten the `FsdpTpBackward` step-2 caption so the "partial along the FSDP axis" claim is unambiguous about which axis the partial sum is taken over.

## Capabilities

### New Capabilities
- `parallelism-backward-viz`: Behavioral contract for the interactive FSDP / TP / FSDP+TP backward-pass diagrams — what each step must depict, which overlaps are valid, and what counter values must equal.

### Modified Capabilities
<!-- none — no existing specs in this repo -->

## Impact

- `src/components/parallelism/FsdpBackward.jsx` — step list, gMode transitions, captions.
- `src/components/parallelism/TpBackward.jsx` — chip-panel layout, `dyFill` consumed-state, operator glyphs.
- `src/components/parallelism/FsdpTpBackward.jsx` — step-2 caption.
- No changes to math/text body of `src/pages/blog/parallelism-roofline.mdx`; the components are embedded there but the prose is already correct.
- No API or dependency changes. Pure visualization-correctness fix.
