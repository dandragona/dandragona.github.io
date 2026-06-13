## Why

The `improve-tp-backward-staircase` change put `TpBackward` on a per-chunk staircase mirroring forward `TpStaircase`: step 0 was a "comm head" (AG r1 alone, no compute), steps 1..NUM_CHUNKS paired chunk-`k` compute with AG row `k+1`, and step `NUM_CHUNKS` was a "compute tail" (chunk 4 alone). That picture treats every chunk's GEMM as one atomic kernel gated on its row's AG.

But that's only half the math. With X column-sharded and ∂Y column-sharded the same way, chip `i`'s row of ∂W splits into two cells:

- **`∂W[i, i]` (diagonal)** = `X[:, i]^⊤ · ∂Y[:, i]`. Both factors are local. No AG dependency at all.
- **`∂W[i, j≠i]` (off-diagonal)** = `X[:, i]^⊤ · ∂Y[:, j]`. Needs the other chip's column of ∂Y; this is what the AG staircase is actually staging.

The prior diagram visually claimed step 0 had no compute, which is true *if* you bundle the diagonal and off-diagonal pieces into one GEMM per chunk. A reader who follows the math closely (X col-shard + ∂Y col-shard ⇒ chip already has both diagonal factors) will spot that the diagonal cell could land at step 0 alongside the first AG. The fix: show it that way.

## What Changes

- **BREAKING (visual)**: `TpBackward` step 0 now shows the diagonal ∂W cell SOLID (with the yellow active-region ring) and a new `local` block in the compute lane (yellow-ringed), concurrent with `AG r1` in the all-gather lane. Step 0 is no longer a comm-only "head" tick.
- **BREAKING (visual)**: ∂W's partial-sum stripe convention is restricted to the **off-diagonal** cell only. The diagonal cell goes ABSENT → SOLID at step 0 with no intermediate striped state, because it lands in one shot from local data.
- **BREAKING (visual)**: At step 0, the chip's owned column of X and ∂Y is highlighted across all rows (the local diagonal compute uses the whole column), instead of having no yellow ring at all.
- **Caption + subtitle**: rewritten to name the diagonal-is-local insight explicitly and stop calling step 0 a "comm head".
- No changes to the forward `TpStaircase`, the chip layout, or the `NUM_CHUNKS + 2` step budget. Mirroring with the forward is preserved structurally; the difference is that one of the backward's compute slots (column 0) holds a fundamentally different kind of work than the others.

## Capabilities

### Modified Capabilities

- `parallelism-roofline-post`: the "TpBackward renders an embedded compute/all-gather timeline" and "TpBackward uses the yellow-ring active-chunk highlight" requirements (added by `improve-tp-backward-staircase`) gain a step-0 carve-out covering the local-diagonal compute block and its highlight rules. A new requirement is added documenting the per-cell ∂W behavior (diagonal local-and-immediate; off-diagonal striped-then-solid).

## Impact

- Affected code: `src/components/parallelism/TpBackward.jsx` only (captions, subtitle, `xFill`, `dyFill`, `dwFill`, and one new local-diagonal compute block in `Timeline`).
- Affected spec: `openspec/specs/parallelism-roofline-post/spec.md` — two modified requirements and one added requirement.
- No new components, no new MDX imports, no edits to other backward widgets or forward components.
