## ADDED Requirements

### Requirement: DP backward subsection explains the backprop dependency chain

The "DP — One all-reduce at the end" subsection of `src/pages/blog/parallelism-roofline.mdx` SHALL include a "The Dependency Chain" passage, placed between the `<DpBackward client:visible />` block and the existing "this is also where DP's only compute/communication overlap lives" paragraph, that walks the reader through a two-layer backprop and identifies the single non-dependency edge that makes overlap legal.

The passage MUST:

- Briefly note that the chain uses two layers $X \to a_1 \to Y$ to expose cross-layer overlap, while reusing the post's existing $\partial W$ notation (i.e., not $\partial L / \partial W$).
- Enumerate the four backprop steps in order using inline LaTeX `$...$`:
  1. Compute $\delta_2$ (the gradient flowing into layer 2's pre-activation).
  2. Compute $\partial W_2 = a_1^{\top} \delta_2$, and note this is the gradient that must be all-reduced across the DP workers.
  3. Compute $\delta_1 = (\delta_2 \, W_2^{\top}) \odot \sigma'(z_1)$, and note this depends only on the *local* $\delta_2$ and the local $W_2$ — not on the all-reduce of $\partial W_2$.
  4. Compute $\partial W_1 = X^{\top} \delta_1$.
- State explicitly that Step 3 does not depend on Step 2's all-reduce having completed, and that this independence is what licenses splitting the work across the GPU's compute engine (Tensor Cores) and its communication engine (NIC / NCCL / copy engines).

#### Scenario: Reader reaches the dependency chain after the DpBackward diagram
- **WHEN** the reader scrolls past `<DpBackward client:visible />` in the DP backward subsection
- **THEN** the next prose block is titled along the lines of "The Dependency Chain" and introduces the two-layer setup before listing the four backprop steps in order
- **AND** the existing "this is also where DP's only compute/communication overlap lives" paragraph and `<OverlapTimeline strategy="dp" client:visible />` remain immediately after the new passage, unchanged

#### Scenario: The non-dependency edge is called out
- **WHEN** the reader finishes the four-step enumeration
- **THEN** they encounter a sentence stating that the computation of $\delta_1$ has no dependency on the all-reduce of $\partial W_2$, and that this is precisely what makes the per-layer overlap visualized by `<OverlapTimeline strategy="dp" />` legal
- **AND** the sentence names both engines explicitly: the compute engine / Tensor Cores on one side, and the communication engine / NIC / NCCL on the other

### Requirement: DP backward subsection contains a step-by-step overlap walkthrough mapped to hardware engines

Immediately after the dependency-chain passage, the same subsection SHALL include a "How the Overlap Works" passage that maps the backprop steps onto an asynchronous execution schedule, naming which GPU engine runs each step.

The passage MUST:

- Frame the schedule as three concurrent items rather than a sequential narrative, to mirror the timeline below.
- Include, in order:
  1. **Compute $\partial W_2$ locally.** The GPU's compute engine produces $\partial W_2 = a_1^{\top} \delta_2$.
  2. **Fire-and-forget all-reduce of $\partial W_2$.** As soon as $\partial W_2$ is ready, an asynchronous all-reduce is launched across the DP workers; NCCL drives this on the network / copy engines (NVLink / InfiniBand) without blocking the compute stream.
  3. **Simultaneously compute layer-1 backward.** While the all-reduce is in flight, the compute engine moves on to layer 1 and runs, concurrently, the backward GEMM $\delta_2 \, W_2^{\top}$, the element-wise multiply by $\sigma'(z_1)$ that yields $\delta_1$, and the weight-gradient GEMM $\partial W_1 = X^{\top} \delta_1$.
- Make the connection back to the timeline explicit, so the reader understands that each "comm under compute" segment in `<OverlapTimeline strategy="dp" />` corresponds to one such asynchronous all-reduce overlapped with the next layer's backward.

#### Scenario: Reader sees the three-item overlap schedule
- **WHEN** the reader finishes the dependency-chain passage
- **THEN** they encounter a three-item enumeration covering the local $\partial W_2$ compute, the asynchronous all-reduce, and the concurrent layer-1 backward (backward GEMM, activation derivative, weight-gradient GEMM)
- **AND** each item names the responsible engine (compute / Tensor Cores, or communication / NIC / NCCL)

#### Scenario: Walkthrough connects back to the OverlapTimeline
- **WHEN** the reader reaches the end of the "How the Overlap Works" passage
- **THEN** the closing line ties the schedule to `<OverlapTimeline strategy="dp" client:visible />` so it is clear the timeline below is a literal visualization of this schedule repeated layer-by-layer
- **AND** no edits are made to the `<OverlapTimeline />` component itself or to the paragraph that introduces it

### Requirement: Multi-layer notation stays scoped to the DP backward subsection

The notation $W_1$, $W_2$, $a_1$, $z_1$, $\delta_1$, $\delta_2$, $\sigma'(\cdot)$, and $\odot$ SHALL appear only inside the DP backward subsection. The post's other sections — including the FSDP, TP, and FSDP+TP forward and backward subsections, the unified-picture table, and the appendix — MUST continue to use the existing single-layer $X[B,E] \,@\, W[E,E] \to Y[B,E]$ convention and the $\partial W$ / $\partial X$ / $\partial Y$ gradient notation, unchanged.

#### Scenario: Other sections are not edited
- **WHEN** the diff for this change is reviewed
- **THEN** the only edits in `src/pages/blog/parallelism-roofline.mdx` are inside the "## DP — One all-reduce at the end" subsection
- **AND** no other section gains the symbols $W_1$, $W_2$, $a_1$, $z_1$, $\delta_\ell$, $\sigma'$, or $\odot$

#### Scenario: Symbols are introduced before use
- **WHEN** the reader first encounters $a_1$, $\delta_\ell$, $z_1$, $\sigma'$, or $\odot$ in the new passage
- **THEN** each symbol is given a one-clause gloss in line (e.g., "$a_1$, the activation between layers", "$\delta_\ell$, the gradient flowing into layer $\ell$'s pre-activation", "$\odot$ for element-wise multiply") so a reader who skipped a deep-learning course can still follow the chain
