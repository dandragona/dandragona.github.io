## ADDED Requirements

### Requirement: The DP backward subsection is the in-depth anchor for backward-pass machinery

The "## DP — One all-reduce at the end" subsection of `src/pages/blog/parallelism-roofline.mdx` SHALL remain the single in-depth treatment of (a) why a per-layer backward collective can overlap with the next layer's backward compute, (b) the math of the dependency chain, and (c) the equivalence `all-reduce = reduce-scatter + all-gather`. The three subsequent backward subsections (FSDP, TP, FSDP+TP) MUST NOT re-derive any of these three points.

#### Scenario: DP backward subsection retains its depth
- **WHEN** the reader scrolls into "## DP — One all-reduce at the end"
- **THEN** they encounter the `<DpBackward />` widget, the `### The dependency chain` subsection with the four-step gradient walk-through, the `### How the overlap works` subsection with the per-layer schedule, and the `<OverlapTimeline strategy="dp" />` widget
- **AND** none of these elements is removed, reordered, or shortened by this change

#### Scenario: Later backward subsections do not re-derive the overlap argument
- **WHEN** the reader reads the FSDP, TP, or FSDP+TP backward subsection
- **THEN** that subsection MUST NOT contain prose that re-derives "the next layer's backward compute does not depend on this layer's collective" or equivalent statements
- **AND** if overlap is mentioned, it MUST be by one-sentence reference to the established DP-backward treatment (or to the strategy's own forward overlap visual), not by re-explanation

### Requirement: Each non-DP backward subsection is a delta-style short subsection

Each of the three subsections "## FSDP — …", "## TP — …", "## FSDP + TP — …" under "# The Backwards Pass" in `src/pages/blog/parallelism-roofline.mdx` SHALL consist of exactly one paragraph of prose (1–4 sentences) followed by exactly one widget render. The subsections MUST NOT contain `###` sub-subsection headers, bullet lists, numbered lists, math blocks, or per-step prose breakdowns.

#### Scenario: FSDP backward subsection shape
- **WHEN** the reader views the "## FSDP" subsection under "# The Backwards Pass"
- **THEN** the subsection contains a single prose paragraph naming the swapped collective (reduce-scatter in place of forward's all-gather of `W`) and the `<FsdpBackward client:visible />` render
- **AND** no `###` headers, lists, or math blocks appear inside the subsection

#### Scenario: TP backward subsection shape
- **WHEN** the reader views the "## TP" subsection under "# The Backwards Pass"
- **THEN** the subsection contains a single prose paragraph naming the swapped collective (all-gather of `∂Y` in place of forward's reduce-scatter of `Y`) and the `<TpBackward client:visible />` render
- **AND** no `###` headers, lists, or math blocks appear inside the subsection

#### Scenario: FSDP+TP backward subsection shape
- **WHEN** the reader views the "## FSDP + TP" subsection under "# The Backwards Pass"
- **THEN** the subsection contains a single prose paragraph naming the two swapped collectives (AG along the TP axis and RS along the FSDP axis, the opposite of the forward pair) and the `<FsdpTpBackward client:visible />` render
- **AND** no `###` headers, lists, or math blocks appear inside the subsection

### Requirement: Each non-DP backward widget is a step-driven delta visual

Each of the three components `FsdpBackward`, `TpBackward`, and `FsdpTpBackward` SHALL render a `WidgetShell` from `staircase-shared.jsx`, a step-driven sequence of at most 5 frames advanced by the shared `StepControls`, and a one-sentence `Caption` per frame. Each component MUST visually mirror its strategy's forward visual: `FsdpBackward` mirrors the `DpBackward` chip-pair convention; `TpBackward` mirrors the `TpStaircase` chunked-staircase convention; `FsdpTpBackward` mirrors the `FsdpTpStaircase` 2×2 mesh-and-arrows convention.

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

#### Scenario: FsdpTpBackward step budget and mesh shape
- **WHEN** the user opens `FsdpTpBackward`
- **THEN** the rendered widget uses `WidgetShell`, `StepControls`, and `Caption` from `staircase-shared.jsx`
- **AND** the total number of step frames is at most 5
- **AND** the widget renders the 2×2 mesh with horizontal (TP) and vertical (FSDP) arrows, and does NOT render a separate SVG timeline lane, axis-by-axis counter, or bespoke shell `div`

### Requirement: Backward widget captions name the action, not the argument

Captions in `FsdpBackward`, `TpBackward`, and `FsdpTpBackward` SHALL be at most one sentence per frame and SHALL only name what is happening in the frame (e.g., "AG W₃", "Compute ∂W locally", "RS ∂W back to the FSDP shard"). Captions MUST NOT re-explain why overlap is possible, re-derive the transpose-of-collective identity, reference the all-reduce decomposition, or re-introduce the staircase shape.

#### Scenario: Caption brevity
- **WHEN** any frame caption in the three components is read
- **THEN** the caption is at most one English sentence (one terminal `.`, `!`, or `?` after trimming)
- **AND** the caption does not contain the phrases "does not depend on", "the next layer's backward", "transpose", "all-reduce = ", or equivalent re-derivations

### Requirement: Backward widgets do not introduce new MDX imports

The set of component imports in `src/pages/blog/parallelism-roofline.mdx` SHALL remain exactly the set already imported at the top of the file (the four backward components plus the forward visuals and the collective primer). The simplification MUST be implemented by editing the existing component files, not by adding new components or new import lines.

#### Scenario: Import list unchanged
- **WHEN** the import block at the top of `src/pages/blog/parallelism-roofline.mdx` is compared before and after this change
- **THEN** the imported component names and source paths are identical
