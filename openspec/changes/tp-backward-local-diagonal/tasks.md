## 1. Per-cell ∂W fill

- [x] 1.1 In `src/components/parallelism/TpBackward.jsx`, remove the `dwState` helper.
- [x] 1.2 Rewrite `dwFill` to take `(r, c)` and split on `c === chipIdx`: diagonal cell is SOLID with `highlight: step === 0`; off-diagonal cell is ABSENT at step 0, STRIPED for `step ∈ [1, NUM_CHUNKS]`, SOLID at `step NUM_CHUNKS + 1`.

## 2. Step-0 active region

- [x] 2.1 Extend `xFill` so the chip's owned column is highlighted across all rows when `step === 0`.
- [x] 2.2 Extend `dyFill` so the chip's owned column is highlighted across all rows when `step === 0`.
- [x] 2.3 Update the `activeChunk` comment to reflect that step 0 is now "local diagonal compute happens here" rather than "AG-only head".

## 3. Local-diagonal compute block on the timeline

- [x] 3.1 Add a `local` block at column 0 of the compute lane in `Timeline`, always rendered, yellow-ringed and full-opacity at `step === 0`, faded thereafter.

## 4. Prose

- [x] 4.1 Rewrite `STEP_CAPTIONS[0]` to name the diagonal-is-local insight and say AG of row 1 fires concurrently.
- [x] 4.2 Lightly reword `STEP_CAPTIONS[1..4]` to say "off-diagonal" where the prior captions said "∂W".
- [x] 4.3 Rewrite the widget `subtitle` to say (a) the diagonal entry of ∂W is fully local on each chip, (b) the off-diagonal entry stages through the per-row AG pipeline, (c) ∂W stripes mean off-diagonal partial sums.

## 5. Verification

- [x] 5.1 Open the post in the browser and step through `TpBackward` frames 0..5. Confirm: step 0 has SOLID diagonal cell + yellow ring + `local`/AG r1 active; step 1 has STRIPED off-diagonal cell; step 4 has `mm c4` active alone; step 5 has both ∂W cells SOLID.
- [x] 5.2 Confirm `dwState` is removed and `dwFill` takes `(r, c)`.

## 6. Spec verification

- [ ] 6.1 Run `openspec status --change tp-backward-local-diagonal` and confirm the deltas validate against the `parallelism-roofline-post` spec.
- [ ] 6.2 Confirm `MODIFIED Requirements` supersede the corresponding scenarios from the prior `improve-tp-backward-staircase` change.
