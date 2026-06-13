## 1. FsdpBackward — expand to 11-step pipeline

- [x] 1.1 Replace the `STEPS` array in `src/components/parallelism/FsdpBackward.jsx` with 11 entries matching the schedule in design.md decision 1 (forward-done, AG W₄, cmp ∂W₄, RS+AG, cmp ∂W₃, RS+AG, cmp ∂W₂, RS+AG, cmp ∂W₁, RS ∂W₁ alone, done)
- [x] 1.2 Set `wMat: true` only on the 4 compute frames (indices 2, 4, 6, 8); set `wMat: false` everywhere else
- [x] 1.3 Set `gMode: 'full'` on the 4 compute frames; `gMode: 'rs-inflight'` on the 4 RS frames (indices 3, 5, 7, 9); `gMode: 'sharded'` on the final `done` frame
- [x] 1.4 Set `commCount` trajectory to `[0, 1, 1, 3, 3, 5, 5, 7, 7, 8, 8]`
- [x] 1.5 Set `commActive: true` and a meaningful `commLabel` on indices 1, 3, 5, 7, 9; `commActive: false` elsewhere
- [x] 1.6 Rewrite each caption so RS overlaps are described only with the next layer's AG (or the previous layer's compute), never with the same layer's own compute
- [x] 1.7 Update the `layerLabel` strings so each frame names exactly the layer/collective that frame depicts (no triple-bundled labels like `W₃ · RS ∂W₃ · AG W₂`)

## 2. TpBackward — drop W tile, fix glyphs, keep consumed peer rows visible

- [x] 2.1 In `src/components/parallelism/TpBackward.jsx` `ChipMatmul`, remove the `W` `TensorGrid` and the surrounding `OpSymbol` elements; render `X` (relabeled `Xᵀ`), `∂Y`, `∂W` with `@` and `=` glyphs in the order `Xᵀ @ ∂Y = ∂W`
- [x] 2.2 Update `dyFill` so the `'consumed'` branch returns `{ fill: chipColor, alpha: 0.35 }` (matching `dwFill`'s alpha pattern) instead of `{ fill: ABSENT }`
- [x] 2.3 Confirm `TensorGrid` / `Cell` in `staircase-shared.jsx` already pass `alpha` through to the rendered cell; if not, thread it through (no API change to call sites that already use it)
- [x] 2.4 Update the `name`/`subtitle` of the X tile to `Xᵀ` (or add a subtitle that clarifies the transpose) so readers can match the displayed shape to the operation

## 3. FsdpTpBackward — reword step-2 caption only

- [x] 3.1 In `src/components/parallelism/FsdpTpBackward.jsx`, replace the step-2 (`chipLabel: 'bw L1'`) `caption` with wording that names the FSDP axis as the partial-sum axis and clarifies that TP peers see disjoint X-contraction columns (per design.md decision 4)
- [x] 3.2 Do not change any other field of any step in this component

## 4. Verify

- [x] 4.1 Run `npm run build` (or the project's dev build) and confirm no JSX/TS errors in the three changed components
- [x] 4.2 Open `/blog/parallelism-roofline` in a browser, click through all 11 frames of `FsdpBackward` and confirm: (a) each compute frame shows a full-shape striped ∂W; (b) each RS frame shows in-flight ∂W with the comm link lit; (c) the counter ends at 8; (d) no caption asserts same-layer compute/RS overlap
- [x] 4.3 Click through `TpBackward` and confirm: (a) no `W` tile is rendered; (b) operator glyphs are `@` and `=`; (c) consumed peer-∂Y rows remain visible at reduced opacity instead of disappearing
- [x] 4.4 Click through `FsdpTpBackward` and confirm step 2's new caption reads naturally and unambiguously names the partial-sum axis
