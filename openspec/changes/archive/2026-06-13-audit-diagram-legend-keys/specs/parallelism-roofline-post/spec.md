## ADDED Requirements

### Requirement: A diagram's legend lists only swatches drawn in that diagram

Every interactive parallelism diagram that renders a swatch legend ("key") SHALL list only the swatches that can actually appear in the currently displayed diagram variant. A legend MUST NOT include a swatch whose color/pattern is never rendered for the active strategy, panel, or step. Conversely, every distinct swatch color or pattern carrying meaning in the diagram SHALL have a corresponding legend entry.

#### Scenario: FSDP forward strategy hides inapplicable keys
- **WHEN** `ShardingStage` renders with `strategy="fsdp"`
- **THEN** the legend does not show "replicated" or "partial sum"
- **AND** the legend shows only swatches that are drawn in the FSDP diagram (the chip shard, the materialized/gathered state, and the absent/"elsewhere" state)

#### Scenario: Tensor parallelism shows partial sum but not materialized
- **WHEN** `ShardingStage` renders with `strategy="tp"`
- **THEN** the legend includes the "partial sum" (striped) swatch, which is drawn in the TP diagram
- **AND** the legend does not include a "materialized" swatch that TP never renders

#### Scenario: No legend entry references an unrendered constant
- **WHEN** any parallelism diagram renders its legend
- **THEN** every legend swatch's color/pattern is one that the same diagram applies to at least one cell, block, or step in some reachable state

### Requirement: Legend swatch colors match the colors rendered in the diagram

Where a legend swatch stands for a state drawn in the diagram, the swatch's color/pattern SHALL be the same value used to render that state in the diagram, so a reader can visually match the key to the picture.

#### Scenario: "Elsewhere" swatch matches the absent-cell color
- **WHEN** `ShardingStage` renders the "elsewhere"/absent legend swatch
- **THEN** the swatch uses the same color value as the cells it represents in the grid

### Requirement: A shared legend above multiple panels is scoped to each panel's contents

When one legend is presented above multiple diagram panels (for example the four collective panels), the legend SHALL NOT present a swatch that is absent from a given panel as if it applied to that panel. Either each panel carries its own scoped key, or the shared key distinguishes universally-present swatches from panel-specific ones.

#### Scenario: All-gather panel does not imply partial sums
- **WHEN** the collectives primer presents its key alongside the all-gather panel
- **THEN** the key does not present "partial sum" or "fully reduced" swatches as applying to all-gather, since all-gather renders neither

### Requirement: Prose color descriptions match rendered colors

For diagrams that describe their color convention in a subtitle or caption rather than a swatch key, the named colors and what they mean SHALL match the colors actually rendered by the diagram.

#### Scenario: Subtitle color claims are verified against the render
- **WHEN** a diagram's subtitle or caption names a color and the state it represents
- **THEN** the diagram renders that state in that color, with no leftover references to colors or states that were removed or renamed
