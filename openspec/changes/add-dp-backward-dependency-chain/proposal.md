## Why

The DP backward section currently asserts that each layer's $\partial W$ all-reduce can hide behind the compute of earlier layers' backward, but it never shows the math dependency that makes the overlap *legal*. A reader without backprop intuition has to take the staircase diagram on faith. Spelling out the chain of $\delta$ and $\partial W$ computations — and pointing at the single edge that is *not* a dependency — turns the overlap from a claim into a derivation, and motivates why the compute engine and the network engine can run at the same time.

## What Changes

- Extend the "DP — One all-reduce at the end" section of `src/pages/blog/parallelism-roofline.mdx` with a new "The Dependency Chain" subsection that walks through a two-layer backprop using the post's existing $\partial W$ / $\partial X$ notation (extended to $W_1$, $W_2$, $a_1$, $\partial W_1$, $\partial W_2$).
- Add a "How the Overlap Works" step-by-step list immediately after, explaining how the asynchronous all-reduce of $\partial W_2$ runs on the NIC/NCCL stream while the GPU's compute engine simultaneously produces $\delta_1$ and $\partial W_1$.
- Position the new prose between the `<DpBackward />` diagram and the existing overlap paragraph + `<OverlapTimeline strategy="dp" />`, so the math justifies what the timeline visualizes.
- No component changes. Prose-only edit, rendered through the existing MDX + KaTeX pipeline.

## Capabilities

### New Capabilities
<!-- None. This is a content extension of an existing capability. -->

### Modified Capabilities
- `parallelism-roofline-post`: the DP backward subsection gains a requirement to explain the backprop dependency chain and how the compute/communication overlap maps onto it.

## Impact

- Files: `src/pages/blog/parallelism-roofline.mdx` (single section edit).
- No new components, no new dependencies; relies on existing KaTeX math rendering already used throughout the post.
- Notation: introduces $W_1$, $W_2$, $a_1$, $\delta_1$, $\delta_2$, $\sigma'(z_1)$ scoped to this subsection only — picked to extend, not contradict, the post's single-layer $X @ W \rightarrow Y$ convention.
