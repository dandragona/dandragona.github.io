## ADDED Requirements

### Requirement: Each forward-pass strategy section ends with a "useful ratio" heuristic

Each of the four forward-pass strategy sections in `src/pages/blog/parallelism-roofline.mdx` (DP, FSDP, TP, FSDP+TP) SHALL end with a short prose passage — at most two sentences — that names the compute-to-communication ratio (or per-axis ratios) under which the strategy becomes useful. The passage MUST use the notation already in the post ($B$ for batch, $E$ for the contraction / hidden dimension, $P$ for mesh or axis size) and use inline LaTeX `$...$` for math.

#### Scenario: TP section already meets the requirement (baseline)
- **WHEN** the reader finishes the TP forward subsection
- **THEN** they encounter the existing line stating that the useful ratio is $E / P$, with compute scaling as $B E^2 / P$ and the activation collective scaling as $B E$
- **AND** this line serves as the template for the other three sections

#### Scenario: DP section gets its useful-ratio line
- **WHEN** the reader finishes the DP forward subsection
- **THEN** they encounter a one-to-two-sentence passage stating that DP's forward pays no cross-device communication, so the regime question is whether the per-chip compute ($\sim B E^2 / P$) stays large enough to hide the once-per-step backward all-reduce of $\partial W$ ($\sim E^2$) — i.e., DP is useful while $B / P$ keeps per-chip compute well above that collective
- **AND** the passage cross-references the backward section anchor `#dp--one-all-reduce-at-the-end` if a link is natural

#### Scenario: FSDP section gets its useful-ratio line
- **WHEN** the reader finishes the FSDP forward subsection
- **THEN** they encounter a one-to-two-sentence passage stating that per-layer compute scales as $\sim B E^2 / P$ while the per-layer all-gather of $W$ scales as $\sim E^2 / P$, so the useful ratio simplifies to $B$: larger per-chip batch buys room to hide the all-gather under the matmul

#### Scenario: FSDP+TP section gets its useful-ratio line
- **WHEN** the reader finishes the FSDP+TP forward subsection (after the `<FsdpTpStaircase />` block, before the `# Backward` H1)
- **THEN** they encounter a one-to-two-sentence passage stating that the two axes each impose a ratio — the FSDP axis wants large per-axis batch (the $B$ ratio), the TP axis wants large $E$ relative to its axis size (the $E / P_{TP}$ ratio) — and the optimal mesh shape balances them
- **AND** the passage does not repeat the existing numeric floors (850 / ~100 tokens per chip) already given in the section's intro

### Requirement: New useful-ratio passages match the existing TP line's style and length

Each new passage SHALL be comparable in length and tone to the existing TP useful-ratio line at `src/pages/blog/parallelism-roofline.mdx:92` — terse, one to two sentences, no headings, no bullet lists, no new components.

#### Scenario: Stylistic consistency check
- **WHEN** the four forward-pass useful-ratio passages are read back-to-back
- **THEN** they share notation ($B$, $E$, $P$), inline-LaTeX math style, and length (each within ~1.5× the length of the existing TP line)
- **AND** none introduces a new symbol without defining it in context
