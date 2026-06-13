## ADDED Requirements

### Requirement: FSDP backward steps depict one atomic action per frame

The `FsdpBackward` component SHALL render an 11-step sequence (step indices 0–10) in which each non-terminal frame depicts exactly one of: (a) an all-gather of one layer's `W`, (b) a backward compute producing one layer's `∂W` at full shape, (c) a reduce-scatter of one layer's `∂W` overlapped with the all-gather of the next layer's `W`, or (d) the final reduce-scatter running alone.

#### Scenario: Frame-by-frame action mapping
- **WHEN** the user steps through the 11 frames of `FsdpBackward` for the 4-layer L4→L1 reverse pipeline
- **THEN** the frames in order MUST depict: (0) forward done; (1) AG W₄; (2) compute ∂W₄ at full shape; (3) RS ∂W₄ overlapped with AG W₃; (4) compute ∂W₃ at full shape; (5) RS ∂W₃ overlapped with AG W₂; (6) compute ∂W₂ at full shape; (7) RS ∂W₂ overlapped with AG W₁; (8) compute ∂W₁ at full shape; (9) RS ∂W₁ alone; (10) done

#### Scenario: Each compute frame shows full-shape ∂W
- **WHEN** the user is on any of step indices 2, 4, 6, 8 in `FsdpBackward`
- **THEN** the rendered `∂W` tensor MUST use the `'full'` gMode (both rows present, striped to indicate a partial sum across chips)

#### Scenario: Each RS+AG overlap frame shows in-flight ∂W
- **WHEN** the user is on any of step indices 3, 5, 7, 9 in `FsdpBackward`
- **THEN** the rendered `∂W` tensor MUST use the `'rs-inflight'` gMode and the `commActive` flag MUST be true

### Requirement: FSDP backward captions describe only physically possible overlaps

The `FsdpBackward` step captions SHALL NOT assert that `RS ∂W_l` overlaps with `compute ∂W_l` of the same layer. Overlap captions SHALL only describe `RS ∂W_l` running in parallel with `AG W_{l-1}`, or `AG W_{l-1}` running in parallel with `compute ∂W_l` of an earlier (i.e., already-completed-AG) layer when the schedule permits.

#### Scenario: No same-layer compute/RS claim
- **WHEN** any caption in `FsdpBackward` mentions an RS overlap
- **THEN** the overlap MUST be with a different layer's collective or compute, never with the same layer's own compute that is happening in the same frame

### Requirement: FSDP backward collective count matches the schedule

The `commCount` displayed in the `FsdpBackward` counter SHALL increment by exactly 1 each time an AG or RS frame becomes active, ending at 8 (4 all-gathers + 4 reduce-scatters) on the final frame.

#### Scenario: Counter trajectory
- **WHEN** the user advances through `FsdpBackward` frames 0..10
- **THEN** the `commCount` values MUST be 0, 1, 1, 3, 3, 5, 5, 7, 7, 8, 8 respectively

### Requirement: TP backward panel shows only operands of ∂W

The `TpBackward` chip panel SHALL render the operation that produces `∂W` using only its actual operands, with no tensor on screen that the operation does not consume.

#### Scenario: Operand set
- **WHEN** the user views any frame of `TpBackward`
- **THEN** the chip panel MUST display tiles only for `X` (or `Xᵀ`), `∂Y`, and `∂W`, and MUST NOT display a `W` tile or a `Y` tile

#### Scenario: Operator glyphs
- **WHEN** the chip panel is rendered
- **THEN** the operator glyphs between tiles MUST be `@` and `=` (matching the forward staircase convention), forming `Xᵀ @ ∂Y = ∂W`, and MUST NOT use the `↓` or `→` glyphs

### Requirement: TP backward consumed peer rows stay visible

After a row of `∂Y` has been all-gathered and consumed by the backward compute, the peer chip's column of that row SHALL remain visible at reduced opacity rather than reverting to the absent (light-grey) state.

#### Scenario: Consumed row visual state
- **WHEN** the step index in `TpBackward` is strictly greater than `rowIdx + 1` for a given row
- **THEN** the peer chip's cell for that row MUST be filled with the chip color at reduced alpha (approximately 0.35), with no stripe pattern

### Requirement: FSDP+TP backward step-2 caption identifies the partial-sum axis

The step-2 caption of `FsdpTpBackward` SHALL explicitly name the FSDP axis as the axis along which `∂W` is a partial sum, and SHALL NOT use phrasing that suggests TP peers disagree on the same row of `∂W`.

#### Scenario: Caption wording
- **WHEN** the user views step 2 of `FsdpTpBackward`
- **THEN** the caption MUST state that each chip computes `∂W` at full output shape from its FSDP batch slice, and that chips sharing a TP rank hold partial sums of the same `∂W` rows (over disjoint batch rows), so the FSDP axis is the one the next RS reduces
