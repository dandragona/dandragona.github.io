## 1. Rewrite TpBackward state model

- [x] 1.1 In `src/components/parallelism/TpBackward.jsx`, set `B = 4`, `E = 2`, `NUM_CHIPS = 2`, `NUM_CHUNKS = B`, `TOTAL_STEPS = 5` (mirroring forward `TpStaircase`'s chunk count while staying inside the spec's 5-frame ceiling).
- [x] 1.2 Replace `dyState` so it returns only `absent` (`step < rowIdx`), `partial` (`step === rowIdx`), or `full` (`step > rowIdx`). Remove the `consumed` branch entirely.
- [x] 1.3 Replace `dwChunksAccumulated` with a single derived value `chunksDone = Math.max(0, Math.min(NUM_CHUNKS, step))`, where the final frame folds the last AG-completion into compute (per design.md §4).

## 2. Rewrite cell rendering

- [x] 2.1 In `dyFill`, return `{ fill: chipColor }` for chip's owned column at every step; for non-owned columns return `ABSENT` (absent), `{ fill: chipColor, stripe: true }` (partial), or `{ fill: chipColor }` (full). Never return an object containing `alpha`.
- [x] 2.2 Rewrite `dwFill` so the chip's owned row of `∂W` (row `chipIdx`) renders as: `ABSENT` when `chunksDone === 0`; `{ fill: chipColor, stripe: true }` when `0 < chunksDone < NUM_CHUNKS`; `{ fill: chipColor }` solid when `chunksDone === NUM_CHUNKS`. All other rows render as `ABSENT`. Never return an object containing `alpha`.
- [x] 2.3 Delete every code path that constructs `alpha: 0.35`, `alpha: 0.3 + 0.7 * ...`, or any other alpha value.

## 3. Fix labels and subtitles

- [x] 3.1 In the `X` `TensorGrid` call, change `name="Xᵀ"` to `name="X"` and remove the `subtitle="col i of X"` line.
- [x] 3.2 Rewrite the `dySubtitle` computation: for the row currently in AG (`dyState === 'partial'`), set `partial · AG row k`; for the most recently completed AG row (`dyState === 'full'` and no later row is in flight), set `row k ready`; otherwise `null`.
- [x] 3.3 Rewrite the `dwSubtitle` computation: `null` at `chunksDone === 0`; `partial · ${chunksDone}/${NUM_CHUNKS} rows summed` while partial; `row ${chipIdx} owned` when complete. Remove the existing `${k}/${N} chunks` form.

## 4. Update step captions

- [x] 4.1 Replace `STEP_CAPTIONS` with five captions that mirror the action of each frame: frame 0 (AG ∂Y row 0 in flight; no compute), frame 1 (chunk 0 compute; AG ∂Y row 1 in flight), frame 2 (chunk 1 compute; AG ∂Y row 2 in flight), frame 3 (chunk 2 compute; AG ∂Y row 3 in flight), frame 4 (chunk 3 compute; ∂W row complete).
- [x] 4.2 Keep captions one sentence each, naming the action only (matches existing "Backward widget captions name the action" requirement in the post spec).

## 5. Visual verification

- [x] 5.1 Run the dev server and open `/blog/parallelism-roofline` in a browser. Step through `TpBackward` frames 0 → 4 and confirm no cell renders faded/translucent.
- [x] 5.2 Confirm the `∂W` tensor shows striped chip-color on the chip's owned row for frames 1–3, and solid chip-color on that row at frame 4.
- [x] 5.3 Confirm the first operand tensor's label is `X`, the staircase has 4 chunks of `∂Y`, and the layout matches forward `TpStaircase` row-for-row.
- [x] 5.4 Compare side-by-side with `FsdpBackward` and `DpBackward` and confirm the new `TpBackward` uses only the shared cell conventions (solid, ABSENT, stripe).

## 6. Spec verification

- [x] 6.1 Run `openspec status --change fix-tp-backward-diagram` and confirm it reports the change as complete.
- [x] 6.2 Grep `src/components/parallelism/TpBackward.jsx` for `alpha`, `consumed`, `Xᵀ`, and `chunks` (in the `${k}/${N} chunks` form) and confirm no matches remain.
