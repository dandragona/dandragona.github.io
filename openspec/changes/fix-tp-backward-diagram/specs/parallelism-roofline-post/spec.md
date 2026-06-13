## ADDED Requirements

### Requirement: TpBackward uses the shared cell-rendering conventions

The `TpBackward` component (`src/components/parallelism/TpBackward.jsx`) SHALL render every cell using the shared `Cell` primitive's default rendering modes only: solid chip-color fill, the `ABSENT` empty fill, or the partial-sum stripe (`stripe: true`). It MUST NOT pass an `alpha` value to `Cell`, MUST NOT use a unique "consumed / faded" state for cells that have been used in compute, and MUST NOT introduce any cell rendering convention not also used by `DpBackward` or `FsdpBackward`.

#### Scenario: No alpha on cells
- **WHEN** `src/components/parallelism/TpBackward.jsx` is read
- **THEN** no `getFill` callback returns an object containing an `alpha` key
- **AND** no cell rendering path produces opacity less than 1 for a non-`ABSENT` fill

#### Scenario: Already-consumed AG rows stay solid
- **WHEN** the user advances `TpBackward` past the frame in which `∂Y` row `k` was used in compute
- **THEN** row `k` of `∂Y` continues to render solid chip-color (no fade, no stripe), or is allowed to disappear back to `ABSENT` only if the matching forward `TpStaircase` also clears the consumed chunk (it does not)
- **AND** the chosen behavior matches what `TpStaircase` does for consumed chunks of `Y` in the corresponding forward frame

### Requirement: TpBackward renders `∂W` accumulation with the partial-sum stripe convention

The `TpBackward` component SHALL render the accumulating `∂W` tensor using the same partial-sum stripe convention used by `DpBackward` (`'local · disagrees'` mode) and `FsdpBackward` (`'full · partial sum'` mode): striped chip-color cells while partial, solid chip-color (or solid `YELLOW` when post-reduction across replicas) once complete. It MUST NOT use opacity ramping (interpolating cell alpha with chunk count) to indicate accumulation progress.

#### Scenario: Accumulating ∂W is striped
- **WHEN** a frame is displayed in which any chunk of `∂Y` has been consumed but the last chunk has not
- **THEN** the chip's owned row of `∂W` renders as striped chip-color (the partial-sum convention)
- **AND** no cell in `∂W` uses a non-default `alpha` value

#### Scenario: Final ∂W is solid
- **WHEN** the user reaches the final frame of `TpBackward`
- **THEN** the chip's owned row of `∂W` renders as solid chip-color
- **AND** all other rows of `∂W` render as `ABSENT`

#### Scenario: ∂W subtitle uses established vocabulary
- **WHEN** any frame is displayed
- **THEN** the `∂W` tensor subtitle is one of: `null` (frame 0), a partial-state phrase using the words "partial" and a row/chunk count, or a complete-state phrase using the word "owned"
- **AND** the subtitle does not contain the substring `chunks` followed by a fraction like `1/2`, `2/2` (the old `${k}/${N} chunks` form)

### Requirement: TpBackward labels the input operand as `X`, not `Xᵀ`

The first operand tensor of every `ChipMatmul` in `TpBackward` SHALL be labeled `X` (matching forward `TpStaircase`). The label MUST NOT be `Xᵀ`, `X^T`, or any other transpose notation, and the operand subtitle MUST NOT be `"col i of X"` or any other phrase that asserts a transpose relationship to the actual grid drawn.

#### Scenario: Operand label
- **WHEN** any frame of `TpBackward` is rendered
- **THEN** the first tensor in each `ChipMatmul` has `name="X"`
- **AND** the operand has no subtitle, or a subtitle consistent with the column-sharded `X` shown in forward `TpStaircase`

### Requirement: TpBackward matches forward `TpStaircase`'s chunk count

The `TpBackward` component SHALL use the same batch dimension as forward `TpStaircase` so the chunked staircase has the same number of chunks across forward and backward. Specifically, `B` MUST equal the `B` constant in `src/components/parallelism/TpStaircase.jsx` (currently `4`), and `NUM_CHUNKS` MUST equal `B`.

#### Scenario: Same chunk count
- **WHEN** the constants `B` and `NUM_CHUNKS` at the top of `src/components/parallelism/TpBackward.jsx` are read
- **THEN** they are numerically equal to the `B` and `NUM_CHUNKS` constants at the top of `src/components/parallelism/TpStaircase.jsx`
- **AND** the on-screen `∂Y` grid in `TpBackward` has the same row count as the on-screen `Y` grid in `TpStaircase`

### Requirement: TpBackward stays within the existing 5-frame budget

The total number of step frames in `TpBackward` SHALL remain at most 5 (the limit already set by the "TpBackward step budget and staircase shape" scenario in this spec), even after the chunk-count change. If a 4-chunk staircase plus an explicit "done" tick would exceed 5 frames, the implementation MUST fold the final AG-completion into the final compute frame rather than add a sixth frame.

#### Scenario: Frame ceiling
- **WHEN** the `TOTAL_STEPS` constant in `src/components/parallelism/TpBackward.jsx` is read
- **THEN** the value is at most `5`
