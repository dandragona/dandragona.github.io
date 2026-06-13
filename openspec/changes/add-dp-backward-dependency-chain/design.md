## Context

The post's running example is a single linear layer $X[B,E] \,@\, W[E,E] \to Y[B,E]$, and gradients are written compactly as $\partial W$, $\partial X$, $\partial Y$. That is enough for the forward sections, but the DP backward overlap claim is fundamentally about a *chain* of layers: layer $\ell$'s $\partial W_\ell$ can be all-reduced asynchronously *because* the next layer's $\delta_{\ell-1}$ does not need $\partial W_\ell$ to have landed. With only one layer in the notation, that independence cannot be stated, let alone shown.

Adding the math chain costs roughly half a page of prose and one notation extension. It pays for the `<OverlapTimeline strategy="dp" />` widget that already sits below — readers who currently shrug at the staircase will see exactly which arrow gets cut.

## Goals / Non-Goals

**Goals:**
- Show the four-step backprop chain ($\delta_2$, $\partial W_2$, $\delta_1$, $\partial W_1$) using notation that extends — not contradicts — the post's existing $\partial W$ / $\partial X$ convention.
- Make the "no dependency from $\partial W_2$'s all-reduce into $\delta_1$" point unmissable, in one sentence, because it is the entire reason overlap is legal.
- Map each backprop step onto which GPU engine handles it (compute engine vs. NIC/NCCL), so the timeline below reads as a literal schedule of these steps.
- Keep all changes inside the "DP — One all-reduce at the end" subsection. No restructuring of the rest of the post.

**Non-Goals:**
- No new MDX components, no new diagrams. The existing `<DpBackward />` and `<OverlapTimeline strategy="dp" />` already carry the visual load; this change is prose-only.
- Not generalizing to $N$ layers. Two layers is the smallest case that exposes the dependency edge, and matches the user's source explanation.
- Not changing the FSDP / TP / FSDP+TP backward subsections. The overlap mechanism there is structurally different (gather/scatter inside a layer, not cross-layer pipelining) and warrants its own treatment.
- No changes to the activation function story elsewhere in the post — $\sigma$ is introduced only inside this subsection.

## Decisions

**Decision 1: Use a two-layer MLP $X \to a_1 \to Y$ for the dependency chain.**
Rationale: One layer cannot show inter-layer overlap; three layers add notation without adding clarity. Two is the smallest unit that has both "the gradient I just produced" and "the next layer back I am about to compute," which is the exact pair the overlap pipelines.
Alternatives considered:
- Stay with a single layer and hand-wave "imagine many of these stacked." Rejected — that is what the current text already does, and is the gap this change is fixing.
- Use $N$ generic layers indexed by $\ell$. Rejected — the indices add friction without changing the argument, and the user's source material is explicitly two layers.

**Decision 2: Notation — extend $\partial W$ to $\partial W_1$, $\partial W_2$ and introduce $\delta_1$, $\delta_2$, $a_1$, $z_1$, $\sigma'$.**
Rationale: The post already uses $\partial W$ (not $\partial L / \partial W$). Continuing with $\partial W_\ell$ keeps the visual style consistent. $\delta_\ell$ is the standard symbol for the gradient flowing backward into layer $\ell$'s pre-activation and is the cleanest way to write the chain rule without dragging the loss $L$ into every formula. $a_1$ and $z_1$ are introduced once with a one-line definition.
Alternatives considered:
- Use $\partial L / \partial W_\ell$ everywhere to match the user's source. Rejected — inconsistent with the rest of the post and adds visual weight without information.
- Use $\partial X_\ell$ instead of $\delta_\ell$. Rejected — $\delta$ is the conventional name for the *pre-activation* gradient and avoids confusion with the $\partial X$ that already appears for the model input.

**Decision 3: Place the new prose between `<DpBackward />` and the existing "this is also where DP's only compute/communication overlap lives" paragraph.**
Rationale: `<DpBackward />` shows the per-layer $\partial W$ all-reduce visually; the dependency chain explains *why* those all-reduces can be fired asynchronously; the existing paragraph then says "and here is the staircase that does it" leading into `<OverlapTimeline />`. Reading top-to-bottom: picture → math → schedule → timeline. The existing paragraph and component need no edits.
Alternatives considered:
- Put the new prose *after* the OverlapTimeline as an "explainer footnote." Rejected — the math motivates the timeline, not vice versa; placing it after inverts the reading flow.

**Decision 4: Frame the overlap as a hardware split between the GPU's compute engine (Tensor Cores) and the communication engine (NIC / NCCL / copy engines).**
Rationale: This is the mechanism that makes the asynchronous all-reduce actually free. Without naming the two engines, readers may think the overlap is just "good scheduling" — it is, but it works *because* the two streams use disjoint hardware. The user's source explanation makes this point explicitly and it is the punchline of the whole subsection.

## Risks / Trade-offs

- **Notation drift** → The post otherwise lives in single-layer-land. Mitigation: introduce $W_1$, $W_2$, $a_1$, $\delta_\ell$ inline at the start of the subsection with a one-sentence "we briefly need two layers to talk about cross-layer overlap" framing, and do not propagate the multi-layer notation outside this subsection.
- **Length creep** → The post is already long; adding a math walkthrough risks tipping the DP backward subsection over the visual budget. Mitigation: write the chain as a compact 4-item list (the user's source format), and the overlap as a 3-item list, rather than expository paragraphs. Cap total addition at ~25 lines of MDX.
- **KaTeX rendering of $\odot$ and $\sigma'(z_1)$** → Both render correctly under the post's existing remark-math / rehype-katex toolchain (already used for $\partial W$, $X[B,E]$, etc.), so no toolchain risk; the verify step is just visual confirmation in the dev server.
- **Reader expects the chain to also explain FSDP / TP backward** → It does not — those have within-layer overlap of a different shape. Mitigation: keep the explanation literally inside the DP subsection and do not link forward; the existing per-strategy subsections cover their own mechanics.
