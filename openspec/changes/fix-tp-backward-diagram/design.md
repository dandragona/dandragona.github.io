## Context

The four backward widgets in the parallelism-roofline post (`DpBackward`, `FsdpBackward`, `TpBackward`, `FsdpTpBackward`) were written to share an idiom: each is a step-driven panel that mirrors the corresponding forward visual, swapping one collective for its transpose. Three of them honor the shared idiom; `TpBackward` invents conventions that fight it.

Concretely, the current `TpBackward` (`src/components/parallelism/TpBackward.jsx:38-43`, `:57-71`):

1. Calls the operand `Xᵀ` and subtitles it "col i of X" but renders the same grid layout as forward `X` (one column per chip). The label promises a transpose; the picture shows the un-transposed operand.
2. Fades `∂Y` cells to `alpha: 0.35` once the chunk has been "consumed" by the matmul. This faded-cell convention is unique to this file and is the example the user called out.
3. Ramps `∂W` cell opacity with `0.3 + 0.7 * (chunksAccumulated / NUM_CHUNKS)` rather than using the partial-sum stripe convention from `DpBackward` and `FsdpBackward`.
4. Uses `B = 2` / `NUM_CHUNKS = 2`, collapsing the staircase to a single overlap tick. Forward `TpStaircase` uses `B = 4` / `NUM_CHUNKS = 4` and gets a clear staircase.
5. Has no chunk-of-interest highlight; forward `TpStaircase` rings the active chunk in `HIGHLIGHT` yellow.

The forward `TpStaircase` (`src/components/parallelism/TpStaircase.jsx:108-126`) and the sibling backward widgets (`DpBackward`, `FsdpBackward`) collectively define the conventions this file should follow.

The post structure spec (`openspec/specs/parallelism-roofline-post/spec.md:84-94`) already constrains `TpBackward` to use the shared shell, stay within 5 frames, and not render a separate timeline lane. This change adds visual-fidelity requirements alongside those structural ones.

## Goals / Non-Goals

**Goals:**

- Eliminate the faded-cell convention; every cell is fully opaque, like the other panels.
- Render `∂W` accumulation using the existing stripe-for-partial-sum convention (`Cell stripe={true}`) until the last chunk lands, then solid chip-color.
- Drop the `Xᵀ` relabeling. Show `X` with the same column-sharded layout as forward `TpStaircase`.
- Match forward `TpStaircase`'s chunk count (`B = 4`, `NUM_CHUNKS = 4`) so the staircase is visible — backward becomes the forward staircase with `AG ∂Y` replacing `RS Y`.
- Add the same yellow-ring active-chunk highlight forward uses, anchored on the `∂Y` row whose AG is in flight that tick.
- Keep the widget inside the spec's existing constraints (≤5 frames, `WidgetShell` / `StepControls` / `Caption`, no separate timeline lane, no new MDX imports).

**Non-Goals:**

- Adding a Timeline SVG lane like `TpStaircase`'s — the spec explicitly forbids it (`spec.md:88`).
- Changing the MDX call site (`src/pages/blog/parallelism-roofline.mdx:177`) or any imports.
- Touching `staircase-shared.jsx` — every primitive needed (stripe, alpha-free cells, highlight via border) is already exported.
- Reworking `DpBackward`, `FsdpBackward`, or `FsdpTpBackward`. They already follow the conventions.
- Adding a "partial chunk" visual on `X` (the existing X column-shard is enough).

## Decisions

### 1. Drop `'consumed'` cell state entirely; never use `alpha`

**Decision:** Remove the `consumed` branch from `dyState`. Once an AG row has been consumed by the matmul, it stays solid chip-color. The `Cell` component supports `alpha` but `TpBackward` will not pass it.

**Alternative considered:** Keep the fade but only on `∂Y`, justified as "this chunk is done". Rejected — no other diagram has a "done" fade; readers learn to read the panels by family conventions, and a unique fade reads as "wrong" or "buggy", not "done". The user's note that "the faded column is not used anywhere else" is precisely this point.

### 2. `∂W` accumulation uses stripes, not alpha

**Decision:** Render `∂W` as:

- `absent` (frame 0): `{ fill: ABSENT }` (the grey-on-white empty cell used everywhere).
- accumulating (frames 1..N−1): `{ fill: chipColor, stripe: true }` on the row each chip owns — the "partial sum" convention from `FsdpBackward` (`fsdp-backward.jsx:84`, `gMode: 'full'`).
- complete (final frame): `{ fill: chipColor }` solid on the owned row.

Each chip owns one row of `∂W` (the row corresponding to the input column it holds — this is what makes TP's `∂W` already-sharded after compute). So only that row lights up. Subtitle moves from `"1/2 chunks"` to `"partial · k/N rows summed"` while accumulating and `"row k owned"` once complete — matching the vocabulary already in the post.

**Alternative considered:** Per-chunk fill ramp by counting rows. Rejected — `∂W` shape is `(E, E)` and is sharded by row across chips, so each chip's accumulator is a single row that gets summed-into over chunks. Ramping rows would mis-represent the math; stripes correctly say "partial sum in progress".

### 3. `X` not `Xᵀ`; layout unchanged

**Decision:** Rename `Xᵀ` → `X`, drop the `"col i of X"` subtitle. The grid still shows `B × E` with column `chipIdx` filled — the same as forward `TpStaircase` (`TpStaircase.jsx:108-112`).

**Rationale:** The math behind `∂W = Xᵀ @ ∂Y` shapes the algebra, not the picture. In the picture, each chip holds its column of `X` — that's the same artifact forward used. Relabeling it `Xᵀ` confuses the reader without changing what's drawn. The math-vs-visual mismatch is the deeper bug under the surface visual issues.

**Alternative considered:** Actually draw the transpose (swap rows and cols). Rejected — that breaks the "same staircase, swapped collective" promise. The forward and backward panels should be near-identical in layout, differing in the collective lane and the partial-sum direction.

### 4. Restore `B = 4`, `NUM_CHUNKS = 4`, 5 frames

**Decision:** Match forward `TpStaircase`: `B = 4`, `E = 2`, `NUM_CHUNKS = 4`. Frames:

- Frame 0: ∂Y row 0 AG in flight; no compute yet. (mirror of forward step 0)
- Frame 1: chunk 0 compute; ∂Y row 1 AG in flight.
- Frame 2: chunk 1 compute; ∂Y row 2 AG in flight.
- Frame 3: chunk 2 compute; ∂Y row 3 AG in flight.
- Frame 4: chunk 3 compute; ∂W row complete and solid.

That's 5 frames — at the spec's ceiling (`spec.md:81`). Forward uses 6 (it has a separate "done" tick); backward folds the last AG-completion into the final compute tick to stay at 5.

**Alternative considered:** Keep `B = 2` and tighten captions. Rejected — two chunks doesn't read as a staircase, and the user's complaint that the diagram "doesn't follow conventions in the other diagrams" partly reduces to "it doesn't look like a staircase".

### 5. Yellow-ring active-chunk highlight on `∂Y`

**Decision:** Reuse the `highlight` field that `Cell` accepts (via the shared `TensorGrid` getFill). The `Cell` in `staircase-shared.jsx` is alpha-aware but not highlight-aware — check the shared component before assuming.

Re-reading `staircase-shared.jsx:17-35`: the shared `Cell` does NOT take `highlight`. Only the local `Cell` inside `TpStaircase.jsx` supports the yellow ring. Two options:

- (a) Add `highlight` to the shared `Cell`, mirroring `TpStaircase.jsx:34-53`. Low risk — additive prop, falls back to current border when absent.
- (b) Skip the ring; use a chip-color overlay on the `∂Y` row to indicate which AG is in flight that tick (which `dyState === 'partial'` with `stripe: true` already does).

**Decision: pick (b)** — the stripe already signals "AG in flight" unambiguously, and the spec already constrains us not to touch `staircase-shared.jsx`-adjacent code unnecessarily. The forward-vs-backward symmetry argument for adding a ring is real but is a separate change.

### 6. Subtitles use established vocabulary

**Decision:** Subtitles read:

- `∂Y`: `partial · AG row k` while striped; `row k ready` once solid; `null` once compute has moved past it.
- `∂W`: `null` at frame 0; `partial · k/N rows summed` while striped; `row chipIdx owned` once solid.

These follow the noun-phrase pattern from `DpBackward` (`local · disagrees`, `col k owned`, `full · averaged`) and `FsdpBackward` (`full · partial sum`, `FSDP-sharded`).

## Risks / Trade-offs

- **[Risk]** Five frames is the spec ceiling; if a reviewer wants a "done" tick like forward, we'd need to fold differently. → Mitigation: the AG-completion-into-final-compute fold is documented in tasks.md and is a fine compression.
- **[Risk]** Dropping the chunk-of-interest highlight (decision 5b) means backward is slightly less visually synced with forward `TpStaircase`. → Mitigation: the stripe-vs-solid distinction on `∂Y` already carries the "which chunk this tick" information; adding a ring is a follow-up that can land independently if desired.
- **[Risk]** Readers who knew the old fade may briefly look for it. → Mitigation: this is a private blog; no audience pre-trained on the old convention.

## Migration Plan

- Replace `TpBackward.jsx` in one PR-equivalent commit; the file is fully self-contained.
- No spec breakage in any downstream component — `TpBackward` has no exports beyond its default.
- Visual regression check: open the post locally and step through frames 0..4, comparing to forward `TpStaircase` for layout symmetry and to `FsdpBackward` for `∂W` stripe convention.
