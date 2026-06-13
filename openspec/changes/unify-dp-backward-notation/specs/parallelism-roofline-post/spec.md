## MODIFIED Requirements

### Requirement: DP backward subsection explains the backprop dependency chain

The "DP — One all-reduce at the end" subsection of `src/pages/blog/parallelism-roofline.mdx` SHALL include a "The Dependency Chain" passage, placed between the `<DpBackward client:visible />` block and the existing "this is also where DP's only compute/communication overlap lives" paragraph, that walks the reader through a two-layer backprop chain and identifies the single non-dependency edge that makes overlap legal.

The passage MUST:

- Introduce the chain as `X → Y_1 → Y_2` with `Y_1 = X @ W_1` and `Y_2 = Y_1 @ W_2`, using the post's existing single-layer `Y = X @ W` notation extended with subscripts for the two layers.
- Include a one-clause parenthetical noting that activations between the layers are elided, naming the consequence (a local Hadamard factor in step 3) but stating it does not change the dependency structure the overlap argument turns on.
- Enumerate the four backprop steps in order using inline LaTeX `$...$`:
  1. `∂Y_2` — the gradient handed down from above.
  2. `∂W_2 = Y_1^⊤ ∂Y_2` — layer 2's weight gradient, and note this is the gradient that must be all-reduced across the DP workers.
  3. `∂Y_1 = ∂Y_2 W_2^⊤` — note this depends only on the *local* `∂Y_2` and the local `W_2`, not on the all-reduce of `∂W_2`.
  4. `∂W_1 = X^⊤ ∂Y_1`.
- State explicitly that Step 3 does not depend on Step 2's all-reduce having completed, and that this independence is what licenses splitting the work across the GPU's compute engine (Tensor Cores) and its communication engine (NIC / NCCL / copy engines).

#### Scenario: Reader reaches the dependency chain after the DpBackward diagram
- **WHEN** the reader scrolls past `<DpBackward client:visible />` in the DP backward subsection
- **THEN** the next prose block is titled along the lines of "The Dependency Chain" and introduces the `X → Y_1 → Y_2` two-layer setup before listing the four backprop steps in order

#### Scenario: The non-dependency edge is called out
- **WHEN** the reader finishes the four-step enumeration
- **THEN** they encounter a sentence stating that the computation of `∂Y_1` has no dependency on the all-reduce of `∂W_2`, and that this is precisely what makes the per-layer overlap visualized by `<OverlapTimeline strategy="dp" />` legal
- **AND** the sentence names both engines explicitly: the compute engine / Tensor Cores on one side, and the communication engine / NIC / NCCL on the other

### Requirement: DP backward subsection contains a step-by-step overlap walkthrough mapped to hardware engines

Immediately after the dependency-chain passage, the same subsection SHALL include a "How the Overlap Works" passage that maps the backprop steps onto an asynchronous execution schedule, naming which GPU engine runs each step.

The passage MUST:

- Frame the schedule as three concurrent items rather than a sequential narrative, to mirror the timeline below.
- Include, in order:
  1. **Compute `∂W_2` locally.** The GPU's compute engine produces `∂W_2 = Y_1^⊤ ∂Y_2`.
  2. **Fire-and-forget all-reduce of `∂W_2`.** As soon as `∂W_2` is ready, an asynchronous all-reduce is launched across the DP workers; NCCL drives this on the network / copy engines (NVLink / InfiniBand) without blocking the compute stream.
  3. **Simultaneously compute layer-1 backward.** While the all-reduce is in flight, the compute engine moves on to layer 1 and runs the backward GEMM `∂Y_2 W_2^⊤` (which yields `∂Y_1`) and the weight-gradient GEMM `∂W_1 = X^⊤ ∂Y_1`.
- Make the connection back to the timeline explicit, so the reader understands that each "comm under compute" segment in `<OverlapTimeline strategy="dp" />` corresponds to one such asynchronous all-reduce overlapped with the next layer's backward.

#### Scenario: Reader sees the three-item overlap schedule
- **WHEN** the reader finishes the dependency-chain passage
- **THEN** they encounter a three-item enumeration covering the local `∂W_2` compute, the asynchronous all-reduce, and the concurrent layer-1 backward
- **AND** each item names the responsible engine (compute / Tensor Cores, or communication / NIC / NCCL)

#### Scenario: Walkthrough connects back to the OverlapTimeline
- **WHEN** the reader reaches the end of the "How the Overlap Works" passage
- **THEN** the closing line ties the schedule to `<OverlapTimeline strategy="dp" client:visible />` so it is clear the timeline below is a literal visualization of this schedule repeated layer-by-layer

### Requirement: Multi-layer notation stays scoped to the DP backward subsection

The notation `Y_1`, `Y_2`, `W_1`, `W_2`, and their gradients `∂Y_1`, `∂Y_2`, `∂W_1`, `∂W_2` SHALL appear only inside the DP backward subsection of `src/pages/blog/parallelism-roofline.mdx`. The post's other sections — including the FSDP, TP, and FSDP+TP forward and backward subsections, the unified-picture table, and the appendix — MUST continue to use the existing single-layer `X[B,E] @ W[E,E] → Y[B,E]` convention and the `∂W` / `∂X` / `∂Y` gradient notation (no subscripts).

The symbols `z_k`, `a_k`, `σ'`, `⊙`, `δ_k`, and `\partial L / \partial z_k` MUST NOT appear anywhere in the post or in `src/components/parallelism/OverlapTimeline.jsx`; the post uses one consistent vocabulary across all sections.

#### Scenario: Subscript notation only inside DP backward
- **WHEN** the diff for this change is reviewed
- **THEN** the symbols `Y_1`, `Y_2`, `W_1`, `W_2`, `∂Y_1`, `∂Y_2`, `∂W_1`, `∂W_2` appear only inside the "## DP — One all-reduce at the end" subsection
- **AND** no other section in the MDX gains any of these subscripted symbols

#### Scenario: No legacy multi-layer ML symbols anywhere
- **WHEN** `src/pages/blog/parallelism-roofline.mdx` and `src/components/parallelism/*.jsx` are grepped for `z_`, `a_1`, `\sigma`, `\odot`, `\delta`, `partial L`, or `∂L/∂z`
- **THEN** no match is found

### Requirement: OverlapTimeline DP labels match the dependency-chain notation

The DP strategy of `src/components/parallelism/OverlapTimeline.jsx` SHALL render compute block labels and step captions using the same `Y_k` / `∂Y_k` / `∂W_k` notation the DP backward MDX prose uses.

Specifically, the four compute blocks (in time order from layer 4's backward to layer 1's) SHALL be labeled `∂Y3, ∂W4`, `∂Y2, ∂W3`, `∂Y1, ∂W2`, and `∂W1`. The four step captions SHALL name the produced gradient using `∂Y_k` notation (e.g., "Layer 4 backward produces ∂Y3 (feeds layer 3) and ∂W4"), not `∂L/∂z_k` or any pre-activation gradient notation.

#### Scenario: Compute block labels
- **WHEN** the DP overlap timeline renders any frame in which all four compute blocks are visible
- **THEN** the four labels read, in order, `∂Y3, ∂W4`, `∂Y2, ∂W3`, `∂Y1, ∂W2`, `∂W1`
- **AND** no label contains the substring `∂L` or `z_`

#### Scenario: DP captions use ∂Y_k notation
- **WHEN** the user steps through the DP overlap timeline
- **THEN** each caption names the produced gradient as `∂Y_k` (or `∂Y_k`-style with plain digits in the JSX string)
- **AND** no caption contains `∂L/∂z` or any pre-activation-gradient notation
