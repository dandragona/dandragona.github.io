## MODIFIED Requirements

### Requirement: Each non-DP backward subsection is a delta-style short subsection

Each of the three subsections "## FSDP — …", "## TP — …", "## FSDP + TP — …" under "# The Backwards Pass" in `src/pages/blog/parallelism-roofline.mdx` SHALL consist of one paragraph of prose (1–4 sentences) followed by one or more widget renders. The subsections MUST NOT contain `###` sub-subsection headers, bullet lists, numbered lists, math blocks, or per-step prose breakdowns. The FSDP subsection MAY render two widgets (the chip-pair zoom-in followed by the multi-layer staircase zoom-out, mirroring the DP backward subsection's shape); the TP and FSDP+TP subsections MUST render exactly one widget each.

#### Scenario: FSDP backward subsection shape
- **WHEN** the reader views the "## FSDP" subsection under "# The Backwards Pass"
- **THEN** the subsection contains a single prose paragraph naming the swapped collective (reduce-scatter in place of forward's all-gather of `W`), the `<FsdpBackward client:visible />` render, and the `<OverlapTimeline strategy="fsdp-bwd" client:visible />` render in that order
- **AND** no `###` headers, lists, or math blocks appear inside the subsection

#### Scenario: TP backward subsection shape
- **WHEN** the reader views the "## TP" subsection under "# The Backwards Pass"
- **THEN** the subsection contains a single prose paragraph naming the swapped collective (all-gather of `∂Y` in place of forward's reduce-scatter of `Y`) and the `<TpBackward client:visible />` render
- **AND** no `###` headers, lists, or math blocks appear inside the subsection
- **AND** no additional widget render appears in the subsection

#### Scenario: FSDP+TP backward subsection shape
- **WHEN** the reader views the "## FSDP + TP" subsection under "# The Backwards Pass"
- **THEN** the subsection contains a single prose paragraph naming the two swapped collectives (AG along the TP axis and RS along the FSDP axis, the opposite of the forward pair) and the `<FsdpTpBackward client:visible />` render
- **AND** no `###` headers, lists, or math blocks appear inside the subsection
- **AND** no additional widget render appears in the subsection

### Requirement: Stepped behavior is scoped to the DP strategy of `OverlapTimeline`

The `OverlapTimeline` component SHALL render its stepped staircase when `strategy="dp"` or `strategy="fsdp-bwd"`. For `strategy="fsdp"` and `strategy="tp"` the component MUST render exactly as it does today (static SVG for TP; static SVG with the naive/overlapped toggle for FSDP).

#### Scenario: FSDP strategy is unchanged
- **WHEN** the user reaches `<OverlapTimeline strategy="fsdp" />` in the post
- **THEN** the widget renders with its existing naive/overlapped toggle and no `StepControls`
- **AND** the SVG block contents for both modes are identical to the current implementation

#### Scenario: TP strategy is unchanged
- **WHEN** the user reaches `<OverlapTimeline strategy="tp" />` in the post
- **THEN** the widget renders the existing static within-layer staircase SVG and no `StepControls`

#### Scenario: DP strategy remains stepped
- **WHEN** the user reaches `<OverlapTimeline strategy="dp" />` in the DP backward subsection
- **THEN** the widget renders the existing step-driven L4→L3→L2→L1 staircase with `StepControls` and `Caption`

#### Scenario: FSDP-backward strategy is stepped
- **WHEN** the user reaches `<OverlapTimeline strategy="fsdp-bwd" />` in the FSDP backward subsection
- **THEN** the widget renders a step-driven multi-layer FSDP backward staircase with `StepControls` and `Caption`

## ADDED Requirements

### Requirement: The FSDP backward overlap timeline is a step-driven multi-layer staircase reveal

The `<OverlapTimeline strategy="fsdp-bwd" />` widget rendered in the "## FSDP — Reduce-scatter in place of all-gather" subsection of `src/pages/blog/parallelism-roofline.mdx` SHALL render as a step-driven sequence advanced by the shared `StepControls` from `staircase-shared.jsx`, with each step revealing one additional layer of the L4→L3→L2→L1 backward staircase together with that layer's AG W (preceding compute) and RS ∂W (following compute) communication blocks. The widget MUST use `WidgetShell`, `StepControls`, and `Caption` from `staircase-shared.jsx` so its outer shell, controls, and caption styling match the other backward widgets in the post.

#### Scenario: Stepped shell and controls
- **WHEN** the user opens the FSDP backward subsection and reaches the `<OverlapTimeline strategy="fsdp-bwd" />` widget
- **THEN** the rendered widget uses `WidgetShell`, `StepControls`, and `Caption` from `staircase-shared.jsx`
- **AND** the total number of step frames is at most 5
- **AND** the SVG renders one compute lane and one communication lane, with the communication lane carrying both AG-W and RS-∂W blocks distinguishable by their block labels

#### Scenario: Reveal order shows the per-layer AG-compute-RS slice and inter-layer overlap
- **WHEN** the user advances from the first non-empty frame onward
- **THEN** each non-empty frame adds exactly one layer's slice — that layer's AG W block, that layer's backward compute block, and that layer's RS ∂W block — in reverse layer order (L4 first, then L3, then L2, then L1)
- **AND** by the second non-empty frame at least one frame shows the previous layer's RS ∂W block and the next layer's AG W block visible at overlapping x-positions on the communication lane
- **AND** the final frame shows the complete staircase with all four layers' AG, compute, and RS blocks rendered

#### Scenario: Caption per frame
- **WHEN** any frame is displayed
- **THEN** a one-sentence `Caption` names the action that frame adds (e.g., "Layer 4 backward: AG W₄, compute ∂W₄, RS ∂W₄ start", "Layer 3 backward overlaps with RS ∂W₄ finishing")
- **AND** the caption does not re-derive the per-layer mechanism — that argument lives in the `<FsdpBackward />` widget above it and in the surrounding prose

### Requirement: The FSDP backward staircase call site adds one line and no imports

The `<OverlapTimeline strategy="fsdp-bwd" client:visible />` JSX render SHALL be added to the "## FSDP — Reduce-scatter in place of all-gather" subsection of `src/pages/blog/parallelism-roofline.mdx`, immediately after the existing `<FsdpBackward client:visible />` render, on its own line. The set of imports at the top of the MDX file SHALL NOT change. The new stepped behavior MUST be implemented inside the existing `OverlapTimeline` component, not by introducing a new component or new import line.

#### Scenario: MDX imports unchanged
- **WHEN** the import block at the top of `src/pages/blog/parallelism-roofline.mdx` is compared before and after this change
- **THEN** the imported component names and source paths are identical

#### Scenario: New render line placed after FsdpBackward
- **WHEN** the reader reaches the FSDP backward subsection
- **THEN** the `<FsdpBackward client:visible />` line precedes the new `<OverlapTimeline strategy="fsdp-bwd" client:visible />` line
- **AND** no other lines are inserted between them except optional blank lines
