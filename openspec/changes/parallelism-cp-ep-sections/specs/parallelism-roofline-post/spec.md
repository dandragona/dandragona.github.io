## MODIFIED Requirements

### Requirement: Each forward-pass strategy section ends with a "useful ratio" heuristic

Each of the five forward-pass strategy sections in `src/pages/blog/parallelism-roofline.mdx` (DP, FSDP, TP, CP, EP) SHALL end with a short prose passage — at most two sentences — that names the compute-to-communication ratio (or per-axis ratios) under which the strategy becomes useful. The passage MUST use the notation already in the post ($B$ for batch, $E$ for the contraction / hidden dimension, $P$ for mesh or axis size) and use inline LaTeX `$...$` for math. Where a section introduces a dimension the dense-layer example does not have (sequence length $S$ and head dimension $d$ for CP; expert count $N$ for EP), that symbol MUST be defined in context.

#### Scenario: TP section already meets the requirement (baseline)
- **WHEN** the reader finishes the TP forward subsection
- **THEN** they encounter the existing line stating that the useful ratio is $E / P$, with compute scaling as $B E^2 / P$ and the activation collective scaling as $B E$
- **AND** this line serves as the template for the other four sections

#### Scenario: DP section gets its useful-ratio line
- **WHEN** the reader finishes the DP forward subsection
- **THEN** they encounter a one-to-two-sentence passage stating that DP's forward pays no cross-device communication, so the regime question is whether the per-chip compute ($\sim B E^2 / P$) stays large enough to hide the once-per-step backward all-reduce of $\partial W$ ($\sim E^2$) — i.e., DP is useful while $B / P$ keeps per-chip compute well above that collective
- **AND** the passage cross-references the backward section anchor `#dp--one-all-reduce-at-the-end` if a link is natural

#### Scenario: FSDP section gets its useful-ratio line
- **WHEN** the reader finishes the FSDP forward subsection
- **THEN** they encounter a one-to-two-sentence passage stating that per-layer compute scales as $\sim B E^2 / P$ while the per-layer all-gather of $W$ scales as $\sim E^2 / P$, so the useful ratio simplifies to $B$: larger per-chip batch buys room to hide the all-gather under the matmul

#### Scenario: CP section gets its useful-ratio line
- **WHEN** the reader finishes the CP forward subsection
- **THEN** they encounter a one-to-two-sentence passage stating that per ring step a chip's attention compute ($\sim (S/P)^2 d$) must stay large relative to the K/V block it forwards ($\sim (S/P) d$), so the useful ratio is $S/P$ — a larger per-chip sequence length buys room to hide the ring hop under the attention matmul
- **AND** $S$ (sequence length) and $d$ (head dimension) are defined where first used

#### Scenario: EP section gets its useful-ratio line
- **WHEN** the reader finishes the EP forward subsection
- **THEN** they encounter a one-to-two-sentence passage stating that each token's expert FFN ($\sim E^2$) must stay large relative to the two all-to-alls that shuttle its $\sim E$-sized activation to its expert and back, so the useful ratio is $E$ — provided routing stays balanced enough that no single device's expert queue dominates
- **AND** the passage does not introduce a new symbol without defining it in context

### Requirement: New useful-ratio passages match the existing TP line's style and length

Each new passage SHALL be comparable in length and tone to the existing TP useful-ratio line — terse, one to two sentences, no headings, no bullet lists, no new components.

#### Scenario: Stylistic consistency check
- **WHEN** the five forward-pass useful-ratio passages (DP, FSDP, TP, CP, EP) are read back-to-back
- **THEN** they share notation ($B$, $E$, $P$, plus $S$/$d$/$N$ where defined in context), inline-LaTeX math style, and length (each within ~1.5× the length of the existing TP line)
- **AND** none introduces a new symbol without defining it in context

### Requirement: The DP backward subsection is the in-depth anchor for backward-pass machinery

The "## DP — One all-reduce at the end" subsection of `src/pages/blog/parallelism-roofline.mdx` SHALL remain the single in-depth treatment of (a) why a per-layer backward collective can overlap with the next layer's backward compute, (b) the math of the dependency chain, and (c) the equivalence `all-reduce = reduce-scatter + all-gather`. The four subsequent backward subsections (FSDP, TP, CP, EP) MUST NOT re-derive any of these three points.

#### Scenario: DP backward subsection retains its depth
- **WHEN** the reader scrolls into "## DP — One all-reduce at the end"
- **THEN** they encounter the `<DpBackward />` widget, the `### The dependency chain` subsection with the four-step gradient walk-through, the `### How the overlap works` subsection with the per-layer schedule, and the `<OverlapTimeline strategy="dp" />` widget
- **AND** none of these elements is removed, reordered, or shortened by this change

#### Scenario: Later backward subsections do not re-derive the overlap argument
- **WHEN** the reader reads the FSDP, TP, CP, or EP backward subsection
- **THEN** that subsection MUST NOT contain prose that re-derives "the next layer's backward compute does not depend on this layer's collective" or equivalent statements
- **AND** if overlap is mentioned, it MUST be by one-sentence reference to the established DP-backward treatment (or to the strategy's own forward overlap visual), not by re-explanation

### Requirement: Each non-DP backward subsection is a delta-style short subsection

Each of the four subsections "## FSDP — …", "## TP — …", "## CP — …", "## EP — …" under "# The Backwards Pass" in `src/pages/blog/parallelism-roofline.mdx` SHALL consist of one paragraph of prose (1–4 sentences) followed by one or more widget renders. The subsections MUST NOT contain `###` sub-subsection headers, bullet lists, numbered lists, math blocks, or per-step prose breakdowns. The FSDP subsection MAY render two widgets (the chip-pair zoom-in followed by the multi-layer staircase zoom-out, mirroring the DP backward subsection's shape); the TP, CP, and EP subsections MUST render exactly one widget each.

#### Scenario: FSDP backward subsection shape
- **WHEN** the reader views the "## FSDP" subsection under "# The Backwards Pass"
- **THEN** the subsection contains a single prose paragraph naming the swapped collective (reduce-scatter in place of forward's all-gather of `W`), the `<FsdpBackward client:visible />` render, and the `<OverlapTimeline strategy="fsdp-bwd" client:visible />` render in that order
- **AND** no `###` headers, lists, or math blocks appear inside the subsection

#### Scenario: TP backward subsection shape
- **WHEN** the reader views the "## TP" subsection under "# The Backwards Pass"
- **THEN** the subsection contains a single prose paragraph naming the swapped collective (all-gather of `∂Y` in place of forward's reduce-scatter of `Y`) and the `<TpBackward client:visible />` render
- **AND** no `###` headers, lists, or math blocks appear inside the subsection
- **AND** no additional widget render appears in the subsection

#### Scenario: CP backward subsection shape
- **WHEN** the reader views the "## CP" subsection under "# The Backwards Pass"
- **THEN** the subsection contains a single prose paragraph naming the swapped collective (the K/V ring runs in reverse, carrying `∂K`/`∂V` — the transpose of forward's K/V ring) and the `<CpBackward client:visible />` render
- **AND** no `###` headers, lists, or math blocks appear inside the subsection
- **AND** no additional widget render appears in the subsection

#### Scenario: EP backward subsection shape
- **WHEN** the reader views the "## EP" subsection under "# The Backwards Pass"
- **THEN** the subsection contains a single prose paragraph naming the swapped collective (all-to-all again — dispatch and combine swap roles to re-route the gradients) and the `<EpBackward client:visible />` render
- **AND** no `###` headers, lists, or math blocks appear inside the subsection
- **AND** no additional widget render appears in the subsection

### Requirement: Each non-DP backward widget is a step-driven delta visual

Each of the four components `FsdpBackward`, `TpBackward`, `CpBackward`, and `EpBackward` SHALL render a `WidgetShell` from `staircase-shared.jsx`, a step-driven sequence of at most 5 frames advanced by the shared `StepControls`, and a one-sentence `Caption` per frame. Each component MUST visually mirror its strategy's forward visual: `FsdpBackward` mirrors the `DpBackward` chip-pair convention; `TpBackward` mirrors the `TpStaircase` chunked-staircase convention; `CpBackward` mirrors the `CpStaircase` device-ring convention; `EpBackward` mirrors the `EpRouting` all-to-all convention.

#### Scenario: FsdpBackward step budget and shell
- **WHEN** the user opens `FsdpBackward`
- **THEN** the rendered widget uses `WidgetShell`, `StepControls`, and `Caption` from `staircase-shared.jsx`
- **AND** the total number of step frames is at most 5
- **AND** the layout shows two chip cards (chip 0, chip 1) connected by a single comm link, matching the `DpBackward` shape

#### Scenario: TpBackward step budget and staircase shape
- **WHEN** the user opens `TpBackward`
- **THEN** the rendered widget uses `WidgetShell`, `StepControls`, and `Caption` from `staircase-shared.jsx`
- **AND** the total number of step frames is at most 5
- **AND** the widget renders the chunked-staircase chip panels (one per chip) but does NOT render a separate SVG timeline lane below them

#### Scenario: CpBackward step budget and ring shape
- **WHEN** the user opens `CpBackward`
- **THEN** the rendered widget uses `WidgetShell`, `StepControls`, and `Caption` from `staircase-shared.jsx`
- **AND** the total number of step frames is at most 5
- **AND** the widget renders the device ring with `∂K`/`∂V` blocks rotating in reverse, mirroring the `CpStaircase` ring convention

#### Scenario: EpBackward step budget and routing shape
- **WHEN** the user opens `EpBackward`
- **THEN** the rendered widget uses `WidgetShell`, `StepControls`, and `Caption` from `staircase-shared.jsx`
- **AND** the total number of step frames is at most 5
- **AND** the widget renders the dispatch/combine all-to-all running in reverse to re-route gradients, mirroring the `EpRouting` all-to-all convention

### Requirement: Backward widget captions name the action, not the argument

Captions in `FsdpBackward`, `TpBackward`, `CpBackward`, and `EpBackward` SHALL be at most one sentence per frame and SHALL only name what is happening in the frame (e.g., "AG W₃", "Compute ∂W locally", "Ring ∂K/∂V to the next device", "Combine-all-to-all the gradients back"). Captions MUST NOT re-explain why overlap is possible, re-derive the transpose-of-collective identity, reference the all-reduce decomposition, or re-introduce the staircase/ring shape.

#### Scenario: Caption brevity
- **WHEN** any frame caption in the four components is read
- **THEN** the caption is at most one English sentence (one terminal `.`, `!`, or `?` after trimming)
- **AND** the caption does not contain the phrases "does not depend on", "the next layer's backward", "transpose", "all-reduce = ", or equivalent re-derivations

### Requirement: The FSDP backward staircase call site adds one line and no imports

The `<OverlapTimeline strategy="fsdp-bwd" client:visible />` JSX render SHALL be present in the "## FSDP — Reduce-scatter in place of all-gather" subsection of `src/pages/blog/parallelism-roofline.mdx`, immediately after the existing `<FsdpBackward client:visible />` render, on its own line. Adding this render line introduces no new import, since `OverlapTimeline` is already imported; the post's overall import set is governed by the "The MDX import block reflects the DP, FSDP, TP, CP, and EP component set" requirement. The stepped behavior MUST be implemented inside the existing `OverlapTimeline` component, not by introducing a new component.

#### Scenario: fsdp-bwd render uses the already-imported OverlapTimeline
- **WHEN** the FSDP backward subsection is rendered
- **THEN** the `<OverlapTimeline strategy="fsdp-bwd" client:visible />` line uses the `OverlapTimeline` import already present at the top of the file
- **AND** no new import line is added for this render

#### Scenario: New render line placed after FsdpBackward
- **WHEN** the reader reaches the FSDP backward subsection
- **THEN** the `<FsdpBackward client:visible />` line precedes the `<OverlapTimeline strategy="fsdp-bwd" client:visible />` line
- **AND** no other lines are inserted between them except optional blank lines

## ADDED Requirements

### Requirement: The MDX import block reflects the DP, FSDP, TP, CP, and EP component set

The component import block at the top of `src/pages/blog/parallelism-roofline.mdx` SHALL import the forward and backward visuals for the five strategies DP, FSDP, TP, CP, EP plus the collective primer, and SHALL NOT import `FsdpTpStaircase` or `FsdpTpBackward`. The new components `CpStaircase`, `EpRouting`, `CpBackward`, and `EpBackward` SHALL be imported from `src/components/parallelism/`.

#### Scenario: FSDP + TP component imports removed
- **WHEN** the import block is inspected after this change
- **THEN** it contains no `import` line for `FsdpTpStaircase` or `FsdpTpBackward`

#### Scenario: CP and EP component imports present
- **WHEN** the import block is inspected after this change
- **THEN** it imports `CpStaircase`, `EpRouting`, `CpBackward`, and `EpBackward` from `../../components/parallelism/`
- **AND** the existing DP/FSDP/TP forward and backward visual imports and the `CollectivePrimer` import are unchanged

### Requirement: The post presents Context Parallelism as a forward strategy between TP and EP

`src/pages/blog/parallelism-roofline.mdx` SHALL contain a `# Context Parallelism` forward section placed after the TP forward section and before the EP forward section. It SHALL state that sharding the sequence across devices leaves the dense linear layers free (a callback to DP) and that attention is the operation that forces cross-device communication, because every query must attend to every key/value across the full sequence. It SHALL render the sequence-sharding `ShardingStage` layout and the ring-attention forward widget.

#### Scenario: CP forward section exists and frames the attention bridge
- **WHEN** the reader reaches the `# Context Parallelism` section
- **THEN** it appears after the TP forward section and before the EP forward section
- **AND** it states the linear layers need no communication under sequence sharding and that attention forces the K/V movement
- **AND** it renders `<ShardingStage strategy="cp" client:visible />` and `<CpStaircase client:visible />`

#### Scenario: CP section names ring attention as the featured mechanism
- **WHEN** the reader reads the CP forward prose
- **THEN** it describes K/V blocks rotating around the device ring with partial-attention accumulation, and the next block's transfer overlapping the current block's attention matmul
- **AND** it presents the all-to-all (DeepSpeed-Ulysses) sequence-transpose variant as a contrasting mechanism — a short paragraph on the head/sequence transpose via two all-to-alls, a ring-vs-Ulysses contrast, and a rendered `<CpUlysses client:visible />` widget — while keeping ring attention as the featured mechanism

### Requirement: The Context Parallelism forward widget is a ring-attention accumulation staircase

`CpStaircase` SHALL render a `WidgetShell` from `staircase-shared.jsx`, a step-driven sequence of at most 5 frames advanced by the shared `StepControls`, and a one-sentence `Caption` per frame, visualizing the device ring, the rotation of K/V blocks, and the per-step accumulation of partial attention with the next block's transfer overlapping the current attention matmul.

#### Scenario: CpStaircase shell and step budget
- **WHEN** the user opens `CpStaircase`
- **THEN** the rendered widget uses `WidgetShell`, `StepControls`, and `Caption` from `staircase-shared.jsx`
- **AND** the total number of step frames is at most 5
- **AND** the widget shows the ring of devices and at least one frame in which a K/V block transfer and an attention-matmul step are both in flight

### Requirement: The Context Parallelism section includes an all-to-all (Ulysses) transpose visual

`CpUlysses` SHALL render a `WidgetShell` from `staircase-shared.jsx`, a step-driven sequence of at most 5 frames advanced by the shared `StepControls`, and a one-sentence `Caption` per frame, visualizing the sequence-by-heads grid (each cell colored by its owning device), the first all-to-all that transposes sequence-sharding into head-sharding, local full-sequence attention per head group, and the second all-to-all transposing back. `CpUlysses` SHALL be imported and rendered in the `# Context Parallelism` section after the `<CpStaircase />` widget, and ring attention SHALL remain the section's featured mechanism.

#### Scenario: CpUlysses shell and step budget
- **WHEN** the user opens `CpUlysses`
- **THEN** the rendered widget uses `WidgetShell`, `StepControls`, and `Caption` from `staircase-shared.jsx`
- **AND** the total number of step frames is at most 5
- **AND** stepping through it shows the grid flip from row-sharded (sequence) to column-sharded (heads) under an all-to-all, a local-attention frame, and the flip back

#### Scenario: CpUlysses placement keeps ring attention featured
- **WHEN** the reader reaches the `# Context Parallelism` section
- **THEN** `<CpStaircase client:visible />` (ring attention) appears before `<CpUlysses client:visible />`
- **AND** the section still ends with the ring's $S/P$ useful-ratio passage

### Requirement: The post presents Expert Parallelism as the final forward strategy

`src/pages/blog/parallelism-roofline.mdx` SHALL contain a `# Expert Parallelism` forward section placed after the CP forward section. It SHALL state that each device holds a subset ($N/P$) of the MoE experts, that a local router assigns each token to its expert, and that the split is repaired by a dispatch all-to-all (tokens to expert-holding devices), local expert FFN compute, and a combine all-to-all (results back to origin). It SHALL render the EP routing widget.

#### Scenario: EP forward section exists and names the two all-to-alls
- **WHEN** the reader reaches the `# Expert Parallelism` section
- **THEN** it appears as the last forward strategy, after CP
- **AND** it explains the dispatch all-to-all, the local expert FFN, and the combine all-to-all
- **AND** it renders `<EpRouting client:visible />`

#### Scenario: EP section connects to the appendix all-to-all
- **WHEN** the reader reads the EP forward prose
- **THEN** it identifies all-to-all as the defining EP collective (the one the appendix primes) and names routing imbalance as the failure mode

### Requirement: The Expert Parallelism forward widget is an all-to-all routing visual

`EpRouting` SHALL render a `WidgetShell` from `staircase-shared.jsx`, a step-driven sequence of at most 5 frames advanced by the shared `StepControls`, and a one-sentence `Caption` per frame, visualizing tokens colored by their assigned expert, the dispatch all-to-all to expert-holding devices, the local expert FFN compute, and the combine all-to-all back to origin.

#### Scenario: EpRouting shell and step budget
- **WHEN** the user opens `EpRouting`
- **THEN** the rendered widget uses `WidgetShell`, `StepControls`, and `Caption` from `staircase-shared.jsx`
- **AND** the total number of step frames is at most 5
- **AND** the widget shows tokens routed to expert-holding devices via an all-to-all and returned via a second all-to-all

### Requirement: ShardingStage gains a Context Parallelism layout and drops the FSDP + TP layout

`ShardingStage` SHALL support `strategy="cp"`, rendering each chip's sequence slice of `X`, a full replicated `W`, and its slice of `Y`, with no collective control shown (the dense linear layer needs no communication under sequence sharding). `ShardingStage` SHALL NOT support `strategy="fsdp_tp"`; the `fsdp_tp` ownership branches and `STRATEGIES` entry SHALL be removed, along with the `FsdpTpStaircase` and `FsdpTpBackward` components.

#### Scenario: cp strategy renders a no-collective sequence-sharded layout
- **WHEN** `<ShardingStage strategy="cp" />` renders
- **THEN** each chip shows its sequence slice of `X`, a full replicated `W`, and its slice of `Y`
- **AND** no all-gather / reduce-scatter control button is shown

#### Scenario: fsdp_tp strategy and components removed
- **WHEN** the codebase is searched for `fsdp_tp`, `FsdpTpStaircase`, or `FsdpTpBackward`
- **THEN** no references remain in `src/components/parallelism/` or `src/pages/blog/parallelism-roofline.mdx`

### Requirement: The Unified Picture comparison table covers DP, FSDP, TP, CP, and EP

The comparison table in the "# The Unified Picture" section of `src/pages/blog/parallelism-roofline.mdx` SHALL have exactly one row per forward strategy — DP, FSDP, TP, CP, EP — each naming what is split, what is replicated, the main repair collective, and the failure mode. The FSDP + TP row SHALL be removed.

#### Scenario: Table rows match the five strategies
- **WHEN** the reader reaches the Unified Picture comparison table
- **THEN** it has exactly one row each for DP, FSDP, TP, CP, and EP and no FSDP + TP row
- **AND** the CP row names the sequence as split and the K/V ring as the main repair, and the EP row names tokens/experts as split and the dispatch/combine all-to-all as the main repair

## REMOVED Requirements

### Requirement: Backward widgets do not introduce new MDX imports

**Reason**: This change deliberately swaps components — it removes the `FsdpTpStaircase` and `FsdpTpBackward` imports and adds the `CpStaircase`, `EpRouting`, `CpBackward`, and `EpBackward` imports — so the prior "imports must remain exactly the existing set" constraint no longer holds.

**Migration**: The import set is now governed by the new requirement "The MDX import block reflects the DP, FSDP, TP, CP, and EP component set", which enumerates the components that MUST and MUST NOT be imported.
