## Why

The previous `fix-tp-backward-diagram` change cleaned up the alpha-fading and `Xᵀ`-relabel bugs in `TpBackward`, but accepted two compromises its own `design.md` flagged as suboptimal: a 5-frame ceiling and no embedded timeline lane. With those constraints in place, the widget still reuses the forward's `W` and `Y` tensor slots to display `∂W` and `∂Y`, making the staircase hard to read: the viewer sees the same `X @ W = Y` layout but the W and Y slots now carry semantically different operands, and the per-chunk overlap argument that lives explicitly in forward `TpStaircase`'s SVG timeline is absent from the backward.

The user's feedback after `fix-tp-backward-diagram` landed: the panel is still confusing. The diagnosis: the constraints in the current spec keep `TpBackward` from looking like its closest sibling, forward `TpStaircase`, which has six frames, an embedded compute/RS timeline, and a yellow-ring active-chunk highlight. Aligning to forward is exactly the "follow the conventions set in the other diagrams" instruction.

## What Changes

- **BREAKING (visual)**: Relabel the tensor slots from `(X, W, Y)` to `(X, ∂Y, ∂W)`. `∂Y` keeps the `B × E` shape (visually identical to forward's `Y`), and `∂W` is rendered as a new `E × E` slot to the right — owned by the chip row-by-row, mirroring how forward's `W` was sharded.
- **BREAKING (visual)**: Add an embedded SVG `Timeline` lane below the chip panels with two streams — `compute` (top, solid blocks for `mm c1..c4`) and `all-gather` (bottom, dashed blocks for `AG r1..r4`) — using the same block geometry, fill conventions, and active-yellow-ring as forward `TpStaircase`'s `Timeline`. Comm leads compute by one tick (the mirror of forward, where compute leads comm).
- **BREAKING (visual)**: Restore the yellow-ring active-chunk highlight on the active `X` and `∂Y` row, matching forward `TpStaircase`'s `HIGHLIGHT` border.
- **BREAKING (structure)**: Raise the step budget from 5 frames to `NUM_CHUNKS + 2 = 6` frames, matching forward `TpStaircase`'s `TOTAL_STEPS`. The extra frame is a "comm head" tick (step 0 = AG row 1 in flight, no compute) that mirrors forward's "compute head" tick (step 0 = chunk 1 computing, no comm).
- The widget continues to use shared `WidgetShell`, `StepControls`, and `Caption` from `staircase-shared.jsx`; the chip panels and Timeline use inline primitives because the shared `Cell`/`TensorGrid` don't expose the yellow-ring highlight prop forward `TpStaircase` already uses inline.
- Operator symbol between `X` and `∂Y` is `·` (matmul with an implicit transpose on `X`), not `@`. The shape relationship `∂W = Xᵀ · ∂Y` is named in the widget subtitle, but the picture stays in the forward's column-sharded `X` layout — no transpose is drawn.
- Captions stay at one sentence each per the existing caption-brevity requirement.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities

- `parallelism-roofline-post`: relaxes the existing TpBackward constraints (the 5-frame ceiling and the no-embedded-timeline rule) and tightens the visual-fidelity-to-forward requirements (timeline lane, yellow-ring highlight, ∂Y/∂W tensor labels).

## Impact

- Affected code: `src/components/parallelism/TpBackward.jsx` only.
- Affected spec: `openspec/specs/parallelism-roofline-post/spec.md` — three deltas on the existing TpBackward requirements; one new requirement for the embedded timeline lane.
- No new components, no new MDX imports, no changes to the call site at `src/pages/blog/parallelism-roofline.mdx`.
- No changes to `staircase-shared.jsx`; inline primitives mirror forward `TpStaircase`'s inline primitives.
- Does not touch `DpBackward`, `FsdpBackward`, or `FsdpTpBackward`. Their existing 5-frame, no-timeline shape stays — only `TpBackward` mirrors a forward *staircase* (the others mirror a chip-pair or 2×2 mesh, neither of which has an embedded timeline).
