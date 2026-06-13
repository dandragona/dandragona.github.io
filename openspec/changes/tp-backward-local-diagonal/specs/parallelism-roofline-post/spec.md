## MODIFIED Requirements

### Requirement: TpBackward renders an embedded compute/all-gather timeline

`TpBackward` SHALL render a two-lane SVG `Timeline` component below the chip panels, with the same padding, lane height, gap, and block geometry as forward `TpStaircase`'s `Timeline`. The lanes SHALL be `compute` (top, solid filled rectangles) and `all-gather` (bottom, dashed rectangles at 16% fill labeled `AG r1..r4`).

The `compute` lane carries TWO kinds of block:

1. **A `local` block at column 0**, always rendered (from step 0 onwards). This block represents the local diagonal contribution `∂W[i, i] = X[:, i]^⊤ · ∂Y[:, i]`, which has no AG dependency. At `step === 0` the block is yellow-ringed and full-opacity; afterward it is unringed with `fillOpacity={0.7}`.
2. **Off-diagonal chunk blocks `mm c1..c4` at columns `1..NUM_CHUNKS`.** For each chunk index `i ∈ [0, NUM_CHUNKS)`, the block at column `i + 1` SHALL appear once `step ≥ i + 1`; the active block (`step === i + 1`) SHALL get a `YELLOW` ring. These blocks represent the per-chunk contributions to the off-diagonal cell `∂W[i, j ≠ i]` and are each gated on the corresponding AG row.

For each AG row index `i ∈ [0, NUM_CHUNKS)`, the `all-gather` lane SHALL show its block at column `i` once `step ≥ i`; the active block (`step === i`) SHALL get a `YELLOW` ring. This places `AG r1` at column 0 (concurrent with the `local` compute block) and `mm c4` alone at column `NUM_CHUNKS` (the compute tail of the off-diagonal staircase, no AG in flight).

#### Scenario: Timeline geometry mirrors forward
- **WHEN** the timeline is rendered
- **THEN** the SVG viewBox, lane heights, padding, and block styling match forward `TpStaircase`'s `Timeline` exactly (same constants for `TIMELINE_PAD_LEFT`, `TIMELINE_PAD_RIGHT`, `LANE_HEIGHT`, `LANE_GAP`, `TIMELINE_PAD_TOP`, `TIMELINE_PAD_BOTTOM`)
- **AND** the `compute` lane label appears on the top lane and the `all-gather` lane label appears on the bottom lane

#### Scenario: Step 0 fires local-diagonal compute and AG r1 together
- **WHEN** the user is on step 0
- **THEN** the `compute` lane shows the `local` block at column 0 with a `YELLOW` ring
- **AND** the `all-gather` lane shows `AG r1` at column 0 with a `YELLOW` stroke
- **AND** no other compute block (`mm c1..c4`) is rendered yet
- **AND** no other AG block (`AG r2..r4`) is rendered yet

#### Scenario: Compute tail at the last staircase tick
- **WHEN** the user is on step `NUM_CHUNKS` (the compute tail)
- **THEN** the `compute` lane shows the `local` block plus all `mm c1..c4` blocks; only `mm c${NUM_CHUNKS}` is active (yellow-ringed)
- **AND** the `all-gather` lane shows all four AG blocks; none is active

### Requirement: TpBackward uses the yellow-ring active-chunk highlight

`TpBackward` SHALL render a `YELLOW` (`#eab308`) `2px solid` border on the cells of the active region for each step. The active region depends on the step:

- **Step 0 (local-diagonal compute):** the chip's owned column of `X` AND its owned column of `∂Y` are highlighted across all `B` rows; the diagonal cell of `∂W` (`∂W[i, i]` on chip `i`) is highlighted; in the timeline, the `local` block (compute lane, column 0) AND `AG r1` (all-gather lane, column 0) are highlighted.
- **Steps `t ∈ [1, NUM_CHUNKS]` (off-diagonal chunks):** row `t − 1` of `X` (own column) and row `t − 1` of `∂Y` (both columns, since AG of row `t − 1` has landed) are highlighted; the `mm c${t}` block in the compute lane is highlighted; the `AG r${t + 1}` block in the all-gather lane is highlighted when it exists (i.e., for `t < NUM_CHUNKS`).
- **Final done step (`step === NUM_CHUNKS + 1`):** no element is highlighted.

This mirrors forward `TpStaircase`'s yellow ring on the chunk currently being computed, with step 0 carved out to reflect that the local diagonal compute uses the whole owned column (not a single row).

#### Scenario: Step-0 active region covers the whole owned column
- **WHEN** the user is on step 0
- **THEN** every cell in chip `i`'s owned column of `X` (column `i`) has the `YELLOW` border
- **AND** every cell in chip `i`'s owned column of `∂Y` (column `i`) has the `YELLOW` border
- **AND** the diagonal cell `∂W[i, i]` has the `YELLOW` border
- **AND** the `local` block in the compute lane has the `YELLOW` stroke
- **AND** the `AG r1` block in the all-gather lane has the `YELLOW` stroke

#### Scenario: Active-chunk ring on steps 1..NUM_CHUNKS
- **WHEN** the user is on step `t` for `t ∈ [1, NUM_CHUNKS]`
- **THEN** row `t - 1` of `X` (chip's own column) has the `YELLOW` border
- **AND** row `t - 1` of `∂Y` has the `YELLOW` border on both cells (own column and off-column)
- **AND** the compute lane's `mm c${t}` block has the `YELLOW` stroke

#### Scenario: No ring on the final done step
- **WHEN** the user is on step `NUM_CHUNKS + 1` (the final done step)
- **THEN** no `X`, `∂Y`, or `∂W` cell has a `YELLOW` border
- **AND** no compute-lane or all-gather-lane block has a `YELLOW` stroke

## ADDED Requirements

### Requirement: TpBackward splits ∂W into a local diagonal cell and a staircased off-diagonal cell

`TpBackward` SHALL render the chip-`i`-owned row of `∂W` (`E` cells, columns `0..E-1`) with per-cell behavior keyed on whether the column matches the chip index:

- **Diagonal cell `∂W[i, i]`** (where `c === chipIdx`): `{ fill: chipColor, highlight: step === 0 }` for every step. The cell is SOLID from step 0 onwards. No `ABSENT` state, no `stripe: true` state. The diagonal entry is `Σ_b X[b, i] · ∂Y[b, i]` — both factors are local to chip `i`, so the cell lands in one shot at step 0 with no AG dependency and no partial-sum staging.
- **Off-diagonal cell `∂W[i, j ≠ i]`** (where `c !== chipIdx`): `ABSENT` at step 0; `{ fill: chipColor, stripe: true }` for `step ∈ [1, NUM_CHUNKS]`; `{ fill: chipColor }` (SOLID, no stripe) at `step === NUM_CHUNKS + 1`. The off-diagonal entry needs `∂Y[:, j]` from chip `j`, which arrives row-by-row via AG; the cell accumulates as striped partial sums through the staircase and settles to solid at the post-staircase rest tick.

The stripe convention (`stripe: true`) is therefore reserved within `∂W` for the off-diagonal cell only.

#### Scenario: Diagonal cell is SOLID from step 0
- **WHEN** the user is on any step `t ∈ [0, NUM_CHUNKS + 1]`
- **THEN** chip `i`'s view of `∂W[i, i]` renders with a solid `chipColor` fill
- **AND** no `stripe` overlay is applied to that cell
- **AND** the `YELLOW` border is present iff `t === 0`

#### Scenario: Off-diagonal cell goes absent → striped → solid
- **WHEN** the user is on step 0
- **THEN** chip `i`'s view of `∂W[i, j ≠ i]` is `ABSENT`
- **WHEN** the user is on step `t ∈ [1, NUM_CHUNKS]`
- **THEN** chip `i`'s view of `∂W[i, j ≠ i]` renders with a `chipColor` fill AND the partial-sum stripe overlay
- **WHEN** the user is on step `NUM_CHUNKS + 1`
- **THEN** chip `i`'s view of `∂W[i, j ≠ i]` renders with a solid `chipColor` fill (no stripe)

#### Scenario: Diagonal cell does not depend on any AG
- **WHEN** the source of `src/components/parallelism/TpBackward.jsx` is read
- **THEN** the `dwFill` function returns `{ fill: chipColor, ... }` (never `ABSENT`, never `stripe: true`) for any cell where `c === chipIdx` and `r === chipIdx`, at any step
- **AND** the function does not reference `dyGathered`, `dyState`, or any AG-row predicate when computing the diagonal cell's fill
