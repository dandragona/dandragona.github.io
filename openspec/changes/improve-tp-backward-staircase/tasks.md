## 1. Tensor labels and layout

- [x] 1.1 In `src/components/parallelism/TpBackward.jsx`, render three `TensorGrid`s per chip with names `X`, `∂Y`, `∂W` (in that order), separated by `OpSymbol` `·` and `=`.
- [x] 1.2 `X` keeps its `B × E` column-sharded fill (chip's column = chip-color, off-column = `ABSENT`). `∂Y` is `B × E` and starts column-sharded; the chip's own column stays solid at every step, while the off-column transitions `ABSENT → stripe → solid` as the per-row AG progresses.
- [x] 1.3 `∂W` is `E × E`. Only the chip's own row renders chip-color (`ABSENT → stripe → solid`); the other row is `ABSENT` at every step.
- [x] 1.4 Operator symbols: `·` between `X` and `∂Y`, `=` between `∂Y` and `∂W`.

## 2. Six-frame staircase

- [x] 2.1 Set `B = 4`, `E = 2`, `NUM_CHUNKS = B`, `TOTAL_STEPS = NUM_CHUNKS + 2 = 6`.
- [x] 2.2 Implement `dyState(rowIdx, step)` so AG row `i+1` is in-flight at step `i`, gathered at steps `> i`, and absent at steps `< i`.
- [x] 2.3 Implement `activeChunk(step)` returning `step − 1` for `step ∈ [1, NUM_CHUNKS]` and `−1` otherwise.
- [x] 2.4 Implement `dwState(step)` returning `empty` (step 0), `partial` (steps `1..NUM_CHUNKS`), or `complete` (step `NUM_CHUNKS + 1`).

## 3. Yellow-ring active-chunk highlight

- [x] 3.1 Reintroduce the inline `Cell` with a `highlight` prop that draws a `2px solid YELLOW` border (same as forward `TpStaircase.jsx`).
- [x] 3.2 In `xFill`, set `highlight: r === activeChunk` for the chip's own column.
- [x] 3.3 In `dyFill`, set `highlight: r === activeChunk` for both the own column and the off-column on the active row.

## 4. Embedded SVG Timeline lane

- [x] 4.1 Add a `Timeline` component below the chip panels. Two lanes — `compute` (top), `all-gather` (bottom) — with the same padding, lane height, and gap as forward `TpStaircase`'s `Timeline`.
- [x] 4.2 For each chunk `i` (0-indexed), render an `mm c${i+1}` solid rectangle at column `i+1` once `step ≥ i+1`; ring it `YELLOW` when `step === i+1`.
- [x] 4.3 For each row `i` (0-indexed), render an `AG r${i+1}` dashed rectangle at column `i` once `step ≥ i`; ring it `YELLOW` when `step === i`.
- [x] 4.4 Lane labels read `compute` and `all-gather`, matching forward's `compute` and `reduce-scatter`.

## 5. Captions and shell

- [x] 5.1 Six captions in `STEP_CAPTIONS`, one sentence each, naming the action of the step (head AG, paired AG+compute ×3, compute tail, done).
- [x] 5.2 Use `WidgetShell` from `staircase-shared.jsx` with title `"TP backward — all-gather in place of reduce-scatter"` and a subtitle that names `∂W = Xᵀ · ∂Y` and the comm-leads-compute schedule.
- [x] 5.3 Use shared `StepControls` and `Caption`.

## 6. Visual verification

- [x] 6.1 Run the dev server and step through `TpBackward` frames 0 → 5 in the browser; confirm the comm head, three paired ticks, compute tail, and done states render as designed.
- [x] 6.2 Open forward `TpStaircase` and `TpBackward` side-by-side; confirm chip panels are the same scale, the active-chunk ring lands in the same visual position, and the timeline geometry matches.
- [x] 6.3 Confirm no `alpha`, no `Xᵀ` label, no `consumed` state remains in `TpBackward.jsx`.
- [x] 6.4 Confirm `staircase-shared.jsx`, `DpBackward.jsx`, `FsdpBackward.jsx`, `FsdpTpBackward.jsx`, and the MDX file are unchanged.

## 7. Spec verification

- [ ] 7.1 Run `openspec status --change improve-tp-backward-staircase` and confirm the deltas validate against the parallelism-roofline-post spec.
- [ ] 7.2 Confirm `MODIFIED` requirements supersede the corresponding scenarios from the prior `fix-tp-backward-diagram` archived change.
