## Why

The forward-pass "useful ratio" passages in `parallelism-roofline.mdx` compress a chain of reasoning into a single dense clause and assume the reader can unfold it. The DP line is the clearest offender:

> The useful ratio is $B / P$: forward pays nothing, but each step ends with an all-reduce of $\partial W$ (closer to $E^2$) against per-chip compute of $B E^2 / P$, so DP wants $B / P$ large enough to keep the matmul well above that once-per-step collective.

A reader who hasn't already internalized the roofline cannot answer the obvious questions: **What is $P$?** (It is never defined in the post — it first appears, undefined, inside these ratio lines.) **Why is per-chip compute $B E^2 / P$?** **Why is the gradient "closer to $E^2$"** rather than scaling with the batch like everything else? The same compression appears in the FSDP, TP, CP, and EP ratio lines. The post explains its diagrams generously but then asks the reader to take the punchline arithmetic on faith.

The current spec actively *enforces* this terseness — it requires each ratio passage to be "at most two sentences" and "within ~1.5× the length of the existing TP line." That constraint is the thing to change.

## What Changes

- **Define the notation before it is used.** Add a short notation passage near the running example (`X[B,E] @ W[E,E] → Y[B,E]`, around line 29) that defines $B$ (per-step batch — rows of $X$, i.e. tokens), $E$ (the hidden / contraction dimension shared by $X$ and $W$), and $P$ (the number of devices a given axis is split across). Note $S$ (sequence length), $d$ (head dimension), and $N$ (expert count) are introduced later where they first appear.
- **BREAKING (prose): Expand the five forward-pass "useful ratio" passages** in `src/pages/blog/parallelism-roofline.mdx` (DP ~L60, FSDP ~L76, TP ~L100, CP ~L122, EP ~L140) from one dense clause into a self-contained explanation that derives, rather than asserts, each scaling:
  - **Why per-chip compute is $\sim B E^2 / P$:** the layer's matmul is $\sim 2BE^2$ FLOPs (already stated at line 29); splitting the batch across $P$ devices gives each device $B/P$ rows, hence $\sim B E^2 / P$ of the work.
  - **Why the gradient all-reduce is "closer to $E^2$":** $\partial W$ has the same shape as $W$ — $E \times E = E^2$ numbers — and that size is independent of the batch, so unlike compute it does *not* shrink as the batch is split. That mismatch (compute carries a $B$, the collective does not) is exactly why $B/P$ is the ratio that decides whether the collective hides under the matmul.
  - The FSDP ($B$), TP ($E/P$), CP ($S/P$), and EP ($E$) passages get the same treatment: name each symbol, state what is communicated and why it has the size it does, and connect the ratio back to "can the collective hide under the matmul."
- **BREAKING (spec): Relax the terseness constraint.** The requirement that each ratio passage be "at most two sentences" / "within ~1.5× the TP line" is replaced by a requirement that each passage be *self-contained and thorough* — defining every symbol it uses and justifying every scaling it claims — while still matching the post's inline-LaTeX style and prose register.
- Keep the same five ratios ($B/P$, $B$, $E/P$, $S/P$, $E$) and the same conclusions; only the depth of explanation changes. No new components, no new MDX imports, no changes to diagrams or the backward sections.

## Capabilities

### New Capabilities
<!-- None. All changes live in the existing parallelism-roofline-post spec. -->

### Modified Capabilities

- `parallelism-roofline-post`:
  - The requirement **"Each forward-pass strategy section ends with a 'useful ratio' heuristic"** is updated so the passage must *explain* the ratio (derive each scaling and define each symbol), not merely *name* it.
  - The requirement **"New useful-ratio passages match the existing TP line's style and length"** is replaced: passages must match the post's *style* (inline LaTeX, prose, no bullets/headings/new components) but are explicitly freed from the prior length cap, since thoroughness now takes precedence over terseness.
  - A new requirement is added: **"The post defines $B$, $E$, and $P$ before using them in any ratio,"** establishing the notation passage near the running example.

## Impact

- Affected content: `src/pages/blog/parallelism-roofline.mdx` — one new notation passage near line 29 and five rewritten ratio passages (DP, FSDP, TP, CP, EP). The CP and EP lines already define $S$, $d$, and $N$ inline; that inline-definition habit becomes the model for the rest.
- Affected spec: `openspec/specs/parallelism-roofline-post/spec.md` — two modified requirements and one added requirement.
- No code, components, imports, or backward-pass sections change. The page must still build (`astro build`) and the five ratios/conclusions must remain unchanged in substance.
