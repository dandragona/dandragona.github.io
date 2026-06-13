## Context

Forward TP shards X column-wise (`X[B, E]` → chip `i` owns `X[:, i*E_shard:(i+1)*E_shard]`). The backward keeps that sharding, and ∂Y arrives column-sharded on the same axis. Chip `i` is responsible for row `i` of ∂W. Splitting that row into columns:

| Cell | Formula | Dependency |
|---|---|---|
| `∂W[i, i]` (diagonal) | `Σ_b X[b, i] · ∂Y[b, i]` | Both factors local to chip `i`. No AG. |
| `∂W[i, j≠i]` (off-diagonal) | `Σ_b X[b, i] · ∂Y[b, j]` | Needs `∂Y[:, j]` from chip `j` via AG. |

The `improve-tp-backward-staircase` change made the chunk-by-batch staircase the visual centerpiece, with one GEMM per chunk gated on the corresponding AG row. That's faithful to a real implementation (which doesn't split a per-chunk GEMM into local-vs-remote pieces) but visually conflates two cells with very different comm-dependence structure into one striped row.

A reader who internalizes "X col-shard + ∂Y col-shard ⇒ chip already has the diagonal factors" will notice the diagonal cell is sitting idle at step 0 and ask why we're not computing it. The user did exactly this.

## Goals / Non-Goals

**Goals:**

- Show the diagonal entry of ∂W as fully local: lands at step 0, no AG dependency.
- Keep the off-diagonal staircase intact — it's still the load-bearing visual for the AG-per-row pipeline.
- Preserve the `NUM_CHUNKS + 2` frame budget and the structural mirror of forward `TpStaircase`.

**Non-Goals:**

- Splitting each chunk's GEMM in real code. The math gives us license to compute the diagonal early, but real implementations bundle local-and-remote into one GEMM kernel per chunk. The diagram diverges from typical implementation here in service of accuracy about *what's actually possible*.
- Adding a separate per-chunk "diagonal contribution" landing step. The diagonal is one B-element dot product; bundling all 4 contributions into a single `local` block at step 0 is both accurate and visually clean.
- Distinguishing the `local` block from the `mm c{k}` blocks with a different color, opacity, or shape. They're all compute, all on the compute lane; the label difference (`local` vs `mm c1`) is the cue.

## Decisions

### 1. Per-cell ∂W fill: diagonal solid from step 0, off-diagonal striped through staircase

**Decision:** `dwFill(r, c)` splits on `c === chipIdx`:
- Diagonal (`c === chipIdx`): always returns `{ fill: chipColor, highlight: step === 0 }`. The cell is SOLID from step 0 onwards; it gets the yellow ring at step 0 to signal "active landing target".
- Off-diagonal: ABSENT at step 0; STRIPED for `step ∈ [1, NUM_CHUNKS]`; SOLID at step `NUM_CHUNKS + 1`. Identical to the prior whole-row behavior, just confined to the off-diagonal cell.

**Alternatives considered:**

- *Stripe the diagonal too, in lockstep with the off-diagonal.* Hides the user-visible insight (that the diagonal has no comm dependency). Rejected.
- *Land the diagonal at step 1 instead of step 0 (mirroring the "compute lands one tick after firing" convention I considered for AGs).* The prior diagram's convention is already that compute *results* are visible in the same step the compute *fires* (e.g., `mm c1`'s result is visible at step 1). So step 0 = local compute fires = diagonal visible at step 0. Consistent.
- *Bundle the diagonal into chunk 1's compute block at step 1.* That would say chunk 1's GEMM produces both ∂W cells — which is true for an atomic GEMM kernel, but loses the point. The whole reason to make this change is to expose that the diagonal has no comm dependency. Rejected.

### 2. New `local` block at column 0 of the compute lane

**Decision:** The `Timeline` always renders a `local` block at column 0 of the compute lane (from step 0 onwards), with the same geometry as the `mm c{k}` blocks. The block is yellow-ringed and full-opacity at step 0; faded to `fillOpacity={0.7}` and unringed afterward.

**Rationale:** The compute lane is the visual anchor for "what's happening on the compute engine each tick". If the diagonal is doing real work at step 0, the lane should say so. Leaving column 0 empty would re-introduce the false "comm head, no compute" picture.

### 3. Step-0 active-region highlight expands to the whole owned column

**Decision:** At step 0, `xFill` and `dyFill` highlight the chip's owned column of X and ∂Y across all `B` rows. At later steps, only the active chunk row is highlighted (unchanged behavior).

**Rationale:** The local diagonal compute is a B-element dot product across the entire owned column — there's no single "active row". Highlighting the whole column signals "all of this data is feeding the local compute right now".

## Risks / Trade-offs

- **[Risk]** The `local` block at step 0 looks like just another `mm c{k}` block, so a reader might miss that it's structurally different (no comm dependency, produces only the diagonal). → Mitigation: the step-0 caption names "the diagonal of ∂W is fully local — chip i already has X[:, i] and ∂Y[:, i] — so it lands here in one shot, with no AG dependency", and the subtitle says the same upfront.
- **[Risk]** Real implementations don't actually split GEMMs this way, so a reader might come away thinking they should. → Mitigation: the post is explicitly about *what's possible* in the strategy, not about the canonical kernel layout. The diagonal-is-local observation is mathematically valid even if no real kernel exploits it.
- **[Risk]** The prior change document (`improve-tp-backward-staircase`) describes scenarios that no longer match. → Mitigation: this change's `MODIFIED Requirements` section restates the affected scenarios with the new step-0 behavior, so the spec snapshot stays internally consistent after merge.

## Migration Plan

- One-shot edit to `src/components/parallelism/TpBackward.jsx`:
  - `STEP_CAPTIONS[0]` rewritten; captions for steps 1–4 lightly reworded to say "off-diagonal" where they previously said "∂W".
  - `dwState` helper removed; per-cell logic moved into `dwFill(r, c)`.
  - `xFill` and `dyFill` extended to highlight the whole owned column at `step === 0`.
  - `Timeline` gains a `local` block at column 0 of the compute lane, always rendered, ringed at step 0.
  - Widget `subtitle` rewritten to name the diagonal-is-local insight.
- No data migration; no API change.
- Visual verification: step through frames 0..5 in-browser and confirm:
  - Step 0: ∂W diagonal cell SOLID + yellow ring; off-diagonal ABSENT; `local` block ringed; `AG r1` ringed.
  - Step 1: diagonal still SOLID (no ring); off-diagonal STRIPED; `mm c1` ringed; `AG r2` ringed; `local` faded.
  - Step 4: off-diagonal STRIPED; `mm c4` ringed alone (no AG active).
  - Step 5: both ∂W cells SOLID; no blocks ringed.
