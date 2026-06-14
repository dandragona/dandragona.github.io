# parallelism-roofline-post Specification

## Purpose

Editorial and structural requirements for the interactive blog post at `src/pages/blog/parallelism-roofline.mdx`, which walks readers through the forward and backward passes of DP, FSDP, TP, CP (context parallelism), and EP (expert parallelism) and gives them rules of thumb for when each strategy pays off.

## Requirements

### Requirement: The post defines its core notation before using it in a ratio

The post SHALL define every symbol that appears in a "useful ratio" passage at or before the point it is first used, so no ratio asks the reader to take an undefined letter on faith. At minimum, $B$, $E$, and $P$ MUST be defined near the running-example linear layer (`X[B,E] @ W[E,E] → Y[B,E]`, around `src/pages/blog/parallelism-roofline.mdx:29`), because they appear in the ratios. Symbols local to one section ($S$ sequence length, $d$ head dimension, $N$ expert count) MAY instead be defined inline where that section first uses them.

#### Scenario: B, E, and P are defined before the first ratio
- **WHEN** the reader reaches the DP "useful ratio" passage (the first ratio in the post)
- **THEN** they have already read a definition of $B$ (the per-step batch — the rows of $X$, i.e. tokens), $E$ (the hidden / contraction dimension shared by $X$ and $W$), and $P$ (the number of devices the relevant axis is split across)
- **AND** $P$ in particular is no longer introduced undefined inside the ratio line

#### Scenario: Section-local symbols are defined where they appear
- **WHEN** the reader reaches a passage using $S$, $d$, or $N$
- **THEN** that symbol has been defined inline in the same section (e.g. "$S$ the sequence length and $d$ the head dimension"), consistent with how the CP and EP sections already introduce them

#### Scenario: No undefined symbol survives in any ratio
- **WHEN** the five forward-pass ratio passages are read back-to-back
- **THEN** every symbol each one uses ($B$, $E$, $P$, $S$, $d$, $N$) has a definition the reader has already encountered

### Requirement: Useful-ratio passages match the post's prose style

Each useful-ratio passage SHALL match the prose style of the surrounding post: inline LaTeX `$...$` for math, ordinary paragraph prose, and no new headings, bullet lists, or React/MDX components. There is NO upper bound on length — a passage is as long as it needs to be to define its symbols and justify its scalings (see the thoroughness requirement). The passages SHALL remain prose paragraphs, not converted into lists or tables.

#### Scenario: Style is consistent without a length cap
- **WHEN** the five forward-pass useful-ratio passages are read back-to-back
- **THEN** each uses inline-LaTeX math and reads as prose continuous with the rest of the post
- **AND** none introduces a heading, bullet list, table, or new component
- **AND** a passage is NOT rejected merely for being longer than the TP line, provided the added length is explanation (symbol definitions, scaling justifications) rather than padding

### Requirement: Each forward-pass strategy section ends with a "useful ratio" heuristic

Each forward-pass strategy section in `src/pages/blog/parallelism-roofline.mdx` (DP, FSDP, TP, CP, EP) SHALL end with a prose passage that does not merely *name* the compute-to-communication ratio under which the strategy pays off, but *explains* it: it MUST define each symbol it uses, state what is communicated and why it has the size it claims, state why the per-chip compute has the size it claims, and connect the resulting ratio back to "can the collective hide under the matmul." The passage MUST use the notation defined elsewhere in the post ($B$ batch, $E$ contraction / hidden dimension, $P$ devices per split axis, plus any section-local symbol) and inline LaTeX `$...$`. The five ratios and their conclusions ($B/P$ for DP, $B$ for FSDP, $E/P$ for TP, $S/P$ for CP, $E$ for EP) are unchanged; only the depth of explanation increases.

#### Scenario: DP section explains, not just states, its ratio
- **WHEN** the reader finishes the DP forward subsection
- **THEN** the passage explains that the forward pays no cross-device communication, that per-chip compute is $\sim 2 B E^2 / P$ because the layer's $\sim 2 B E^2$ matmul is split across $P$ devices each holding $B/P$ rows, and that the once-per-step all-reduce of $\partial W$ is "closer to $E^2$" because $\partial W$ has $E \times E$ entries regardless of batch and so does not shrink as the batch is split
- **AND** it concludes that the deciding ratio is $B / P$ — large enough keeps the matmul well above the collective
- **AND** it cross-references the backward anchor `#dp--one-all-reduce-at-the-end` where natural

#### Scenario: FSDP section explains its ratio
- **WHEN** the reader finishes the FSDP forward subsection
- **THEN** the passage explains that per-layer compute is $\sim 2 B E^2 / P$ while the all-gather of $W$ moves $\sim E^2 / P$ (the chip's row-strip of the $E \times E$ weight), so the $P$ cancels and the deciding ratio scales as $B$ — larger per-chip batch buys room to hide the gather under the matmul

#### Scenario: TP section explains its ratio
- **WHEN** the reader finishes the TP forward subsection
- **THEN** the passage explains that compute is $\sim 2 B E^2 / P$ and the activation collective is $\sim B E$ (an output of $B \times E$, independent of $P$), so the deciding ratio is $E / P$ — larger $E$ hides communication and larger $P$ makes each local matmul thinner

#### Scenario: CP section explains its ratio
- **WHEN** the reader finishes the CP forward subsection
- **THEN** the passage defines $S$ (sequence length) and $d$ (head dimension), explains that a device's per-hop attention compute is $\sim (S/P)^2 d$ while the K/V block it forwards is only $\sim (S/P) d$, and concludes the deciding ratio is $S / P$ — a longer per-device sequence hides the ring hop under the matmul

#### Scenario: EP section explains its ratio
- **WHEN** the reader finishes the EP forward subsection
- **THEN** the passage explains that each token's expert FFN costs $\sim E^2$ while the two all-to-alls move only its $\sim E$-sized activation to its expert and back, so the deciding ratio is $E$ — a wide hidden dimension hides the routing, given balanced tokens

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

### Requirement: The DP overlap timeline call site does not change

The `<OverlapTimeline strategy="dp" client:visible />` JSX render in `src/pages/blog/parallelism-roofline.mdx` SHALL remain exactly as written today, and the set of imports at the top of the MDX file SHALL NOT change. The stepped behavior MUST be implemented inside the existing `OverlapTimeline` component, not by introducing a new component or new import line.

#### Scenario: MDX render site unchanged
- **WHEN** the import block at the top of `src/pages/blog/parallelism-roofline.mdx` is compared before and after this change
- **THEN** the imported component names and source paths are identical
- **AND** the `<OverlapTimeline strategy="dp" client:visible />` line in the DP backward subsection is identical

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
