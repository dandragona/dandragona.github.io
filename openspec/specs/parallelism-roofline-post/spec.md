# parallelism-roofline-post Specification

## Purpose

This specification covers the interactive article at `src/pages/blog/parallelism-roofline.mdx`. The article explains seven ways to split an LLM training step across devices and compares the work each device does with the data it moves. Its diagrams live in `src/components/parallelism/`.

## Requirements

### Requirement: The article is technical, plain, and free of analogies

The article SHALL use simple, concise, plain-language technical prose of about 2,000 words. It MUST NOT use analogies or metaphors to explain a method. It SHALL assume the reader knows how LLMs work and can follow a matmul, and it MUST NOT teach attention, gradients, or LLM basics. It SHALL keep only caveats that change a method's limit.

#### Scenario: A sentence explains a method

- **WHEN** the article describes what a method splits or moves
- **THEN** it names the tensors, axes, and collectives involved
- **AND** it does not compare the method to an everyday situation

### Requirement: The opening defines the example, the ratio, and the roofline once

The opening SHALL introduce the example matmul `X[T, E] @ W[E, E] → Y[T, E]`, define $X$, $W$, $Y$, $T$, $E$, and $P$, and state that the forward pass takes about $2TE^2$ operations and a training step about $6TE^2$. It SHALL define a roofline once, as a bound from peak compute and the rate data can reach a device over the network, without discussing the history of the roofline model. It SHALL define the ratio of operations per device to values moved per device, counted for one layer over a training step, and say the counts show scaling rather than real-system limits.

#### Scenario: A reader knows how each section is organized

- **WHEN** the reader reaches the first method
- **THEN** they know every section covers what is split, what moves, overlap, the ratio, and the overall effect
- **AND** they know a collective is defined in the appendix

### Requirement: Every method follows one unlabeled order

Each of the seven methods SHALL cover, in order and without visible labels: what is split, what moves, whether the transfer can overlap with computation, the ratio, and the overall effect. The overall effect SHALL say what the method shrinks on each device, what it leaves unchanged, and how far it scales before communication or another limit takes over. Each method SHALL give one tensor-shape line and one final ratio with its constant.

#### Scenario: Two sections read back to back

- **WHEN** two method sections are compared
- **THEN** the same points appear in the same order
- **AND** no section uses headings or bold labels such as Split or Move

### Requirement: Ratios use one accounting and match the summary table

Each ratio SHALL count one layer over a full training step. The body, the summary table, and the ratio explorer SHALL agree on these ratios, in table order: $3T/P$ (data parallelism), $2T/P$ (FSDP), $3E/P$ (tensor parallelism), $2S/P$ (ring attention), $1.5S$ (Ulysses), $1.5E$ (expert all-to-all), and $1.5kE/P$ (expert gather/scatter).

#### Scenario: FSDP and data parallelism are compared

- **WHEN** the reader compares their ratios
- **THEN** FSDP's three transfers of $\sim E^2$ give a lower ratio than data parallelism's all-reduce of $\sim 2E^2$
- **AND** the prose says FSDP uses about 1.5 times the bandwidth

### Requirement: Method facts are stated accurately

- Data parallelism SHALL say every device stores the full weights, gradients, and optimizer state, and that only the last gradient all-reduce lacks computation to overlap with. It SHALL explain the overlap by what each block waits for: each layer needs only $\partial X$ from the layer above it, and only the optimizer needs the summed gradients. It SHALL explain the $\sim 2E^2$ count as the two halves of an all-reduce, each about $E^2$ values per device.
- FSDP SHALL name two all-gathers of $W$ and one reduce-scatter of $\partial W$ per layer, and say that gathering ahead holds the next layer's weights too. It SHALL show that each device's unreduced $\partial W$ is full size, and that the reduce-scatter leaves each device the summed piece matching its piece of $W$, while data parallelism's all-reduce adds an all-gather.
- Tensor parallelism SHALL explain column- and row-parallel layers, say a column/row pair needs no transfer between the layers, and say the final collective is usually an all-reduce, or a reduce-scatter when the next layer takes split input. Overlap SHALL be described as depending on chunking.
- Ring attention SHALL make overlap conditional on each transfer finishing within one block's compute, and SHALL name causal-mask imbalance as its limit.
- Ulysses SHALL show `[N, A, S/P, H] → [N, A/P, S, H]`, say $P$ can't exceed $A$ and the split is only even when $P$ divides $A$, and note that grouped-query and multi-query attention can lower this limit.
- Ring and Ulysses SHALL be compared per device: ring moves about $P/2$ times more data in the forward pass and about $P$ times more in the backward pass.
- Expert all-to-all SHALL mention variable sizes or padding and name load balance as its limit.
- Expert gather/scatter SHALL describe router weighting before the reduce-scatter, say it moves about $P/k$ times more data per device than all-to-all, and say it doesn't fix load imbalance.

#### Scenario: The gather/scatter premium includes top-k

- **WHEN** gather/scatter is compared with all-to-all routing
- **THEN** the premium is described as $P/k$, not $P$

### Requirement: Diagrams share one style

Every diagram SHALL use the shared parts in `diagram-kit.jsx`: no cards, the site's colors and monospace font, a label set plus one step line, and Back / Next step buttons. Cells SHALL move between places with keyed transitions rather than redraw. Layouts SHALL use real pixel sizes from the figure's width, fit at 360 px without horizontal scrolling, and turn off motion under `prefers-reduced-motion`.

The article SHALL render these diagrams:

- `MatmulExample` for the opening matmul
- `ShardingStage` for data parallelism, FSDP, the FSDP weight gradient (with a data parallelism toggle), column-parallel, and row-parallel layers
- `Timeline` for the data parallelism, FSDP, chunked tensor parallelism, and ring vs. Ulysses schedules
- `TpPair` for a column-parallel layer followed by a row-parallel layer
- `RingAttention` for the ring and the blocks each device has seen
- `UlyssesAttention` for one tensor under two splits
- `ExpertRouting` for both expert methods, with the same layout, top-2 routing, and a hot-expert toggle
- `RatioExplorer` for the per-method ratios, with sliders and a log scale, labeled as estimates
- `DeviceMesh` for a 2 × 4 mesh with tensor parallelism across rows and data parallelism down columns
- `Collective` for each of the four collectives in the appendix

#### Scenario: A reader steps through a diagram

- **WHEN** the reader clicks Next
- **THEN** cells slide to their new places and the step line changes
- **AND** the controls don't move, because every step line is reserved in the layout

### Requirement: The summary, mesh section, sources, and appendix are present

The summary table SHALL have seven method rows with columns for split, communication, overlap, ratio, and memory saved. A short "Combining methods" section SHALL explain that each collective runs within its mesh group and that the groups share a fixed device count and the network.

Further Reading SHALL include the JAX scaling book's roofline and training chapters, primary sources for ring attention, Ulysses, and mixture-of-experts, FSDP and tensor-parallel framework documentation, NCCL collective documentation, the roofline model paper, and the technical disclosure at `https://www.tdcommons.org/dpubs_series/9706/`.

The appendix SHALL have one heading and one `Collective` diagram each for all-gather, reduce-scatter, all-reduce, and all-to-all, so the body can link to `#all-gather`, `#reduce-scatter`, `#all-reduce`, and `#all-to-all`. It SHALL identify ring attention's neighbor transfers as the exception.

#### Scenario: A collective is mentioned for the first time

- **WHEN** the body first names a collective
- **THEN** it gives a short definition and links to that collective's appendix diagram
