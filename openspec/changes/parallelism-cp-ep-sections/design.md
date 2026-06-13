## Context

"Parallelism by the Roofline" (`src/pages/blog/parallelism-roofline.mdx`) teaches every strategy against one running example — the dense linear layer $X[B,E] \, @ \, W[E,E] \rightarrow Y[B,E]$ — and asks the same four questions each time: what is split, what is replicated, what collective repairs the split, and can it hide under the matmul. The progression is DP → FSDP → TP → FSDP + TP, with a parallel backward-pass section and a shared component kit in `staircase-shared.jsx` (`WidgetShell`, `StepControls`, `Caption`, `TensorGrid`, color tokens). Forward visuals are `ShardingStage` (one strategy per `strategy` prop) plus per-strategy staircase widgets (`TpStaircase`, `FsdpTpStaircase`); backward visuals are `DpBackward`/`FsdpBackward`/`TpBackward`/`FsdpTpBackward` plus the stepped `OverlapTimeline` (`dp`, `fsdp`, `tp`, `fsdp-bwd` schemas).

This change removes FSDP + TP (a recombination of two axes already taught) and adds the two strategies that introduce genuinely new mechanics: **Context Parallelism** (shard the sequence; attention forces cross-device K/V movement) and **Expert Parallelism** (route tokens to expert-holding devices with all-to-all). Both break the single-linear-layer thread, because the linear layer alone generates no CP or EP communication — that is the core design tension to resolve.

## Goals / Non-Goals

**Goals:**
- Replace FSDP + TP (forward section, backward subsection, and components) with CP and EP, keeping the post's question framing and the `staircase-shared.jsx` conventions.
- Make CP's ring-attention overlap and EP's all-to-all routing first-class interactive widgets matching the existing per-strategy pattern.
- Give CP and EP full backward subsections that mirror their forward collective (transpose), following the established delta-subsection shape rules.
- Keep notation discipline: reuse $B$, $E$, $P$; introduce $S$, $d$, $N$ only where attention/MoE require them, defined in context.

**Non-Goals:**
- No general MoE treatment (load balancing, capacity factor, auxiliary losses) beyond naming imbalance as EP's failure mode.
- No full online-softmax derivation for ring attention; the widget shows block-by-block accumulation at the caption level, not the formula.
- No new `OverlapTimeline` schemas; CP/EP overlap lives inside their own self-contained widgets (the `TpStaircase` precedent).
- No changes to DP/FSDP/TP sections or their widgets beyond the comparison table and outline comment.

## Decisions

### D1. Progression becomes DP → FSDP → TP → CP → EP; FSDP + TP is fully removed
Delete the `# FSDP + TP` forward section, the `## FSDP + TP — Both collectives swapped` backward subsection, the `ShardingStage` `fsdp_tp` strategy branch, and the `FsdpTpStaircase` / `FsdpTpBackward` components and imports. *Why:* FSDP + TP teaches no new collective or sharding shape — it is the 2D product of two axes the reader has met. CP and EP each introduce a new mechanic and (for EP) finally exercise the all-to-all the appendix already defines. *Alternative considered:* keep FSDP + TP and append CP/EP (rejected — the user chose removal, and a six-strategy spine dilutes the climax).

### D2. CP and EP extend the running example to attention and MoE — made explicit, not hidden
The dense layer $X @ W$ generates no CP/EP traffic: sharding its rows by sequence is just DP (no comm), and it has no expert routing. So each new section adds exactly one new operation on top of the same hidden dimension $E$:
- **CP**: attention over a sequence of length $S$ split across $P$ devices. The linear layers stay free (a one-line callback to DP); the *attention* op is what forces communication, because every query must see every key/value.
- **EP**: a Mixture-of-Experts FFN with $N$ experts. The router (local) assigns each token to an expert; the *routing* is what forces communication.

*Why:* contriving comm on the bare linear layer would be wrong. A one-sentence bridge in each section keeps the "one example, new question" spirit while being honest that CP/EP live in attention and MoE. *Alternative:* force both onto $X @ W$ (rejected — misleading).

### D3. CP features ring attention (point-to-point K/V ring), not all-gather or Ulysses all-to-all
Each device holds $Q_i, K_i, V_i$ for its sequence chunk. K/V blocks rotate around the device ring; each device accumulates partial attention (online softmax) as blocks arrive, and the send of the next block overlaps the current block's attention matmul — a per-step staircase analogous to TP's within-layer staircase. *Why:* ring attention is the variant whose story is "can the K/V transfer hide under the attention matmul," which is exactly the post's thesis; it also gives a clean backward mirror (gradients ring the other way). *Alternatives:* (a) **all-gather K/V** — simplest, but the gather is exposed and the overlap lesson is lost; (b) **Ulysses / DeepSpeed sequence parallelism** — uses all-to-all to transpose sequence↔head sharding, which is real but visually conflates with EP's all-to-all and tells a transpose story rather than an overlap story. We keep the appendix's "all-to-all … sequence-parallel transposes" line accurate by adding a single sentence in the CP section noting Ulysses as the all-to-all alternative, while the featured visual is the ring.

### D4. EP features the dispatch → expert → combine all-to-all pair
Forward: router picks each token's expert (local) → **dispatch all-to-all** sends tokens to the device holding their expert → local expert FFN (each device runs its $N/P$ experts) → **combine all-to-all** returns each result to its origin. This is the payoff for the appendix's all-to-all. *Why:* all-to-all is the defining EP collective; two of them bracket the only local compute. *Alternative:* a gather/scatter framing (rejected — all-to-all is the accurate and more interesting shape, and the appendix already primes it).

### D5. CP gets a `ShardingStage` `cp` strategy; EP gets a bespoke widget (no `ShardingStage` strategy)
`ShardingStage` is built around one $X @ W \rightarrow Y$ matmul. CP maps cleanly: a `cp` strategy reuses the DP ownership (sequence rows split across chips, $W$ replicated, $Y$ rows split, **no collective**) with CP-specific labels, making the "for the linear layer, CP is just DP" beat visually. EP does **not** map: it has $N$ different expert weight matrices, not one sharded $W$, so forcing it into the single-$W$ grid would distort the component. EP's layout is introduced by its own routing widget instead. *Why:* keep `ShardingStage` honest to its one-matmul model; let EP's all-to-all be the star of a purpose-built widget. *Alternative:* an `ep` `ShardingStage` strategy (rejected — the proposal's parenthetical; superseded here because the grid can't represent distinct experts).

### D6. New widgets are self-contained, reuse `staircase-shared.jsx`, and follow the existing conventions
Four new components under `src/components/parallelism/`:
- `CpStaircase.jsx` — forward CP ring: $P$ chips in a ring, K/V block rotation, partial-attention accumulation filling in, send-overlaps-matmul. Self-contained (like `TpStaircase`), uses `WidgetShell`/`Caption`; stepped via `StepControls`.
- `EpRouting.jsx` — forward EP: tokens colored by assigned expert, dispatch all-to-all, local expert FFN, combine all-to-all. Step-driven via `StepControls`.
- `CpBackward.jsx` — backward CP delta: the K/V ring runs in reverse carrying $\partial K, \partial V$; ≤5 frames; `WidgetShell`/`StepControls`/`Caption`; mirrors `CpStaircase`'s ring convention.
- `EpRouting`'s mirror `EpBackward.jsx` — backward EP delta: all-to-all again (dispatch↔combine transposed) to re-route gradients; ≤5 frames; mirrors `EpRouting`'s all-to-all convention.

All four obey the existing backward-widget rules: ≤5 frames, captions name the action (not the why), no re-derivation of the overlap argument (that lives in the DP backward anchor). *Why:* maximal reuse, visual consistency, and the spec already encodes these rules for the other backward widgets.

### D7. MDX import block changes; the new import set is the contract
Remove `FsdpTpStaircase` and `FsdpTpBackward` imports; add `CpStaircase`, `EpRouting`, `CpBackward`, `EpBackward`. This consciously supersedes the prior change's "imports unchanged" requirements, which were scoped to the backward-simplification work. The spec delta re-states the import contract. Also update the section-outline comment block and the Unified Picture table (drop the FSDP + TP row; add CP and EP rows with their split/replicated/repair/failure-mode entries).

### D8. Useful-ratio passages reuse the post's compute-vs-comm shape
- **CP**: per ring step a chip computes attention of its $S/P$ queries against one $S/P$ key block (compute $\sim (S/P)^2 d$) while moving one K/V block ($\sim (S/P) d$); ratio $\sim S/P$ — larger per-chip sequence hides the K/V hop.
- **EP**: each token's expert FFN costs $\sim E^2$ while the two all-to-alls move its $\sim E$-sized activation; ratio $\sim E$, provided routing stays balanced enough that no device's expert queue dominates.

Each is one-to-two sentences, inline LaTeX, defining $S$, $d$, $N$ in context — matching the existing TP line's style.

## Risks / Trade-offs

- **Framing break (CP/EP leave the linear-layer example)** → Mitigate with explicit one-line bridges (D2) and by keeping $E$ as the shared hidden dimension so the new ops still connect to the post's spine.
- **Ring-attention online-softmax is easy to render incorrectly** → The widget stays at the block-accumulation level (partial output fills in as blocks arrive); no softmax math on screen; ≤5 frames (D6).
- **EP load balancing is a rabbit hole** → Scoped out (Non-Goals); imbalance appears only as the comparison-table failure mode.
- **Notation creep ($S$, $d$, $N$)** → Introduce each only where the op needs it, defined in context; useful-ratio passages keep the $\sim x^2$-vs-$\sim x$ form (D8).
- **Stale spec requirements referencing FSDP + TP and "imports unchanged"** → The spec delta MODIFIES every affected requirement to swap FSDP + TP → CP/EP and restate the import contract (D7), rather than leaving contradictions.
- **Working-tree scratch screenshots (`fsdptp-*.png`, etc.)** → Pre-existing untracked scratch files; out of scope to commit, safe to ignore or clean separately.

## Migration Plan

Editorial + component change; "deploy" is merge → GitHub Actions Pages build, rollback is `git revert`. No data or API migration. Implementation order: (1) build `CpStaircase`, `EpRouting`, `CpBackward`, `EpBackward`; (2) add `cp` / remove `fsdp_tp` in `ShardingStage`; (3) rewire MDX imports, swap sections, update outline comment and Unified Picture table; (4) delete `FsdpTpStaircase.jsx` / `FsdpTpBackward.jsx`; (5) verify with `npm run build` and a dev-server pass (Playwright MCP available for screenshot checks); (6) update the `parallelism-roofline-post` spec Purpose line at archive time.

## Open Questions

- Final widget names (`CpStaircase`, `EpRouting`) — pinned in tasks; adjustable during apply if a clearer name emerges.
- Whether the CP section's one-line Ulysses (all-to-all) note stays or is cut for length — lean keep, since it pays off the appendix.
- CP `numChips` for the ring visual (3–4 reads best for a ring) vs the 2-chip default elsewhere — settle during widget build.
