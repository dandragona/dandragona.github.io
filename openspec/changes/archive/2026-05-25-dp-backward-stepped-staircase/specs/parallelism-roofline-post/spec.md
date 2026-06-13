## ADDED Requirements

### Requirement: The DP backward overlap timeline is a step-driven staircase reveal

The `<OverlapTimeline strategy="dp" />` widget rendered in the "## DP — One all-reduce at the end" subsection of `src/pages/blog/parallelism-roofline.mdx` SHALL render as a step-driven sequence advanced by the shared `StepControls` from `staircase-shared.jsx`, with each step revealing one additional layer of the L4→L3→L2→L1 backward staircase together with the start of that layer's all-reduce. The widget MUST use `WidgetShell`, `StepControls`, and `Caption` from `staircase-shared.jsx` so its outer shell, controls, and caption styling match the other backward widgets in the post.

#### Scenario: Stepped shell and controls
- **WHEN** the user opens the DP backward subsection and reaches the `<OverlapTimeline strategy="dp" />` widget
- **THEN** the rendered widget uses `WidgetShell`, `StepControls`, and `Caption` from `staircase-shared.jsx`
- **AND** the total number of step frames is at most 5
- **AND** the SVG lanes, block colors, dashed-vs-filled distinction for comm-vs-compute, and time-axis labeling from the existing static render are preserved

#### Scenario: Reveal order shows overlap, not just sequence
- **WHEN** the user advances from the first non-empty frame onward
- **THEN** by the second non-empty frame the SVG shows at least one frame in which the previous layer's all-reduce block and the next layer's backward compute block are both visible at overlapping x-positions on their respective lanes
- **AND** the final frame shows the complete L4→L3→L2→L1 staircase with all four all-reduce blocks rendered

#### Scenario: Caption per frame
- **WHEN** any frame is displayed
- **THEN** a one-sentence `Caption` names the action that frame adds (e.g., "L4 backward starts; g4 all-reduce in flight", "L3 backward begins while g4 finishes")
- **AND** the caption does not re-derive why the next layer's backward does not depend on the previous all-reduce — that argument lives in the surrounding `### How the overlap works` prose

### Requirement: Stepped behavior is scoped to the DP strategy of `OverlapTimeline`

The `OverlapTimeline` component SHALL render its stepped staircase only when `strategy="dp"`. For `strategy="fsdp"` and `strategy="tp"` the component MUST render exactly as it does today (static SVG for TP; static SVG with the naive/overlapped toggle for FSDP).

#### Scenario: FSDP strategy is unchanged
- **WHEN** the user reaches `<OverlapTimeline strategy="fsdp" />` in the post
- **THEN** the widget renders with its existing naive/overlapped toggle and no `StepControls`
- **AND** the SVG block contents for both modes are identical to the current implementation

#### Scenario: TP strategy is unchanged
- **WHEN** the user reaches `<OverlapTimeline strategy="tp" />` in the post
- **THEN** the widget renders the existing static within-layer staircase SVG and no `StepControls`

### Requirement: The DP overlap timeline call site does not change

The `<OverlapTimeline strategy="dp" client:visible />` JSX render in `src/pages/blog/parallelism-roofline.mdx` SHALL remain exactly as written today, and the set of imports at the top of the MDX file SHALL NOT change. The stepped behavior MUST be implemented inside the existing `OverlapTimeline` component, not by introducing a new component or new import line.

#### Scenario: MDX render site unchanged
- **WHEN** the import block at the top of `src/pages/blog/parallelism-roofline.mdx` is compared before and after this change
- **THEN** the imported component names and source paths are identical
- **AND** the `<OverlapTimeline strategy="dp" client:visible />` line in the DP backward subsection is identical
