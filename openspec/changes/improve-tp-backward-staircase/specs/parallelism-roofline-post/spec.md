## MODIFIED Requirements

### Requirement: Each non-DP backward widget is a step-driven delta visual

Each of the three components `FsdpBackward`, `TpBackward`, and `FsdpTpBackward` SHALL render a `WidgetShell` from `staircase-shared.jsx`, a step-driven sequence advanced by the shared `StepControls`, and a one-sentence `Caption` per frame. Each component MUST visually mirror its strategy's forward visual: `FsdpBackward` mirrors the `DpBackward` chip-pair convention; `TpBackward` mirrors the `TpStaircase` chunked-staircase convention; `FsdpTpBackward` mirrors the `FsdpTpStaircase` 2×2 mesh-and-arrows convention.

`FsdpBackward` and `FsdpTpBackward` SHALL use at most 5 frames. `TpBackward` SHALL use exactly `NUM_CHUNKS + 2` frames (currently 6), matching forward `TpStaircase`'s step budget, because its forward sibling is itself a staircase whose comm-head and compute-tail ticks have direct backward analogues that the reader uses to track the time-reversal.

#### Scenario: FsdpBackward step budget and shell
- **WHEN** the user opens `FsdpBackward`
- **THEN** the rendered widget uses `WidgetShell`, `StepControls`, and `Caption` from `staircase-shared.jsx`
- **AND** the total number of step frames is at most 5
- **AND** the layout shows two chip cards (chip 0, chip 1) connected by a single comm link, matching the `DpBackward` shape

#### Scenario: TpBackward step budget and staircase shape
- **WHEN** the user opens `TpBackward`
- **THEN** the rendered widget uses `WidgetShell`, `StepControls`, and `Caption` from `staircase-shared.jsx`
- **AND** the total number of step frames equals `NUM_CHUNKS + 2` (currently 6), matching forward `TpStaircase`'s `TOTAL_STEPS`
- **AND** the widget renders the chunked-staircase chip panels (one per chip) AND an embedded two-lane SVG timeline (compute lane on top, all-gather lane on bottom), matching forward `TpStaircase`'s `Timeline` geometry

#### Scenario: FsdpTpBackward step budget and mesh shape
- **WHEN** the user opens `FsdpTpBackward`
- **THEN** the rendered widget uses `WidgetShell`, `StepControls`, and `Caption` from `staircase-shared.jsx`
- **AND** the total number of step frames is at most 5
- **AND** the widget renders the 2×2 mesh with horizontal (TP) and vertical (FSDP) arrows, and does NOT render a separate SVG timeline lane, axis-by-axis counter, or bespoke shell `div`

### Requirement: TpBackward stays within a per-widget frame budget tied to forward TpStaircase

The total number of step frames in `TpBackward` SHALL equal `NUM_CHUNKS + 2`, matching forward `TpStaircase`'s `TOTAL_STEPS`. With `NUM_CHUNKS = 4`, this is 6 frames: one comm-head tick (AG row 1 alone), three paired ticks (chunk `k` compute paired with AG row `k+1` in flight), one compute-tail tick (chunk 4 alone), and one done tick (`∂W` solid).

#### Scenario: Frame budget tied to forward
- **WHEN** the `TOTAL_STEPS` constant in `src/components/parallelism/TpBackward.jsx` is read
- **THEN** the value equals `NUM_CHUNKS + 2`
- **AND** `NUM_CHUNKS` equals the `NUM_CHUNKS` constant in `src/components/parallelism/TpStaircase.jsx`

## ADDED Requirements

### Requirement: TpBackward labels its tensor slots as `X`, `∂Y`, and `∂W`

Each `ChipMatmul` in `TpBackward` SHALL render exactly three `TensorGrid`s per chip, in left-to-right order, with names `X`, `∂Y`, and `∂W`. The operator symbols between them SHALL be `·` (between `X` and `∂Y`) and `=` (between `∂Y` and `∂W`).

The widget MUST NOT reuse the forward's `Y` slot to display `∂Y` or the forward's `W` slot to display `∂W`. The semantic role of each slot (input operand, incoming gradient, output gradient) is named in its label, not inferred from position.

#### Scenario: Tensor labels
- **WHEN** any frame of `TpBackward` is rendered
- **THEN** the first `TensorGrid` has `name="X"`, the second has `name="∂Y"`, and the third has `name="∂W"`
- **AND** the operator between `X` and `∂Y` is `·` and the operator between `∂Y` and `∂W` is `=`

#### Scenario: No reused W or Y labels
- **WHEN** `src/components/parallelism/TpBackward.jsx` is searched for `name="W"` or `name="Y"`
- **THEN** no match is found

### Requirement: TpBackward renders an embedded compute/all-gather timeline

`TpBackward` SHALL render a two-lane SVG `Timeline` component below the chip panels, with the same padding, lane height, gap, and block geometry as forward `TpStaircase`'s `Timeline`. The lanes SHALL be `compute` (top, solid filled rectangles labeled `mm c1..c4`) and `all-gather` (bottom, dashed rectangles at 16% fill labeled `AG r1..r4`).

For each chunk index `i` in `[0, NUM_CHUNKS)`, the `compute` lane SHALL show its block at column `i+1` once `step ≥ i+1`; the active block (`step === i+1`) SHALL get a `YELLOW` ring. For each AG row index `i` in `[0, NUM_CHUNKS)`, the `all-gather` lane SHALL show its block at column `i` once `step ≥ i`; the active block (`step === i`) SHALL get a `YELLOW` ring. This places `AG r1` alone at column 0 (the comm head) and `mm c4` alone at column 4 (the compute tail).

#### Scenario: Timeline geometry mirrors forward
- **WHEN** the timeline is rendered
- **THEN** the SVG viewBox, lane heights, padding, and block styling match forward `TpStaircase`'s `Timeline` exactly (same constants for `TIMELINE_PAD_LEFT`, `TIMELINE_PAD_RIGHT`, `LANE_HEIGHT`, `LANE_GAP`, `TIMELINE_PAD_TOP`, `TIMELINE_PAD_BOTTOM`)
- **AND** the `compute` lane label appears on the top lane and the `all-gather` lane label appears on the bottom lane

#### Scenario: Comm head and compute tail are visible
- **WHEN** the user is on step 0
- **THEN** only `AG r1` is active (yellow ring) in the `all-gather` lane; no block is shown in the `compute` lane
- **WHEN** the user is on step `NUM_CHUNKS` (the compute tail)
- **THEN** only `mm c${NUM_CHUNKS}` is active in the `compute` lane; the `all-gather` lane shows all four AG blocks but none is active

### Requirement: TpBackward does not stripe ∂Y off-column cells during AG-in-flight

`TpBackward` SHALL NOT render any `∂Y` cell with the partial-sum stripe convention. The stripe convention (`{ fill: chipColor, stripe: true }`) is reserved for cells that hold a partial value awaiting aggregation; an `∂Y` off-column cell during AG-in-flight holds no value (the value lives on the other chip and is being copied over), so painting it striped would falsely claim the chip already has a partial.

The chip-panel cell for the AG-target row's off-column SHALL transition directly from `ABSENT` (gray, "not on this chip yet") to solid chip-color (gathered), with no intermediate striped state. The "AG row `r` is in flight this tick" signal lives in the timeline's dashed AG block (yellow-ringed when active), not on the chip panel.

#### Scenario: ∂Y off-column is absent before AG lands, solid after
- **WHEN** the user is on step `t` for `t ∈ [0, NUM_CHUNKS]` and `r` is the AG-target row at step `t` (i.e., the row whose AG is in flight this tick)
- **THEN** chip `i`'s view of `∂Y[r, off-column-of-i]` renders as `ABSENT`
- **WHEN** the user advances to step `t + 1`
- **THEN** chip `i`'s view of `∂Y[r, off-column-of-i]` renders as solid chip-color (no stripe, no fade)

#### Scenario: No striped ∂Y cells at any step
- **WHEN** any step in `[0, NUM_CHUNKS + 1]` is rendered
- **THEN** no cell within the `∂Y` tensor (on either chip) is rendered with `stripe: true`
- **AND** the stripe convention in `TpBackward` is used only for `∂W` accumulation

### Requirement: TpBackward uses the yellow-ring active-chunk highlight

`TpBackward` SHALL render a `YELLOW` (`#eab308`) `2px solid` border on every cell in the active chunk's row, across the `X`, `∂Y`, and timeline elements. The active chunk row index equals `step − 1` for `step ∈ [1, NUM_CHUNKS]` and is otherwise empty (no ring is drawn at step 0 or the final done step).

This mirrors forward `TpStaircase`'s yellow ring on the chunk currently being computed and provides the visual anchor the reader uses to track the staircase.

#### Scenario: Active-chunk ring is on row `step - 1`
- **WHEN** the user is on step `t` for `t ∈ [1, NUM_CHUNKS]`
- **THEN** row `t - 1` of `X` (chip's own column) has the `YELLOW` border
- **AND** row `t - 1` of `∂Y` has the `YELLOW` border on both cells (own column and off-column)
- **AND** the compute lane's `mm c${t}` block has the `YELLOW` stroke

#### Scenario: No ring on step 0 or the done step
- **WHEN** the user is on step 0 or the final done step
- **THEN** no `X` or `∂Y` cell has a `YELLOW` border
- **AND** the only `YELLOW`-ringed element in the timeline is `AG r1` (on step 0); no element has a `YELLOW` ring on the final done step
