## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Each forward-pass strategy section ends with a "useful ratio" heuristic

Each forward-pass strategy section in `src/pages/blog/parallelism-roofline.mdx` (DP, FSDP, TP, CP, EP) SHALL end with a prose passage that does not merely *name* the compute-to-communication ratio under which the strategy pays off, but *explains* it: it MUST define each symbol it uses, state what is communicated and why it has the size it claims, state why the per-chip compute has the size it claims, and connect the resulting ratio back to "can the collective hide under the matmul." The passage MUST use the notation defined elsewhere in the post ($B$ batch, $E$ contraction / hidden dimension, $P$ devices per split axis, plus any section-local symbol) and inline LaTeX `$...$`. The five ratios and their conclusions ($B/P$ for DP, $B$ for FSDP, $E/P$ for TP, $S/P$ for CP, $E$ for EP) are unchanged; only the depth of explanation increases.

#### Scenario: DP section explains, not just states, its ratio
- **WHEN** the reader finishes the DP forward subsection
- **THEN** the passage explains that the forward pays no cross-device communication, that per-chip compute is $\sim B E^2 / P$ because the layer's $\sim 2 B E^2$ matmul is split across $P$ devices each holding $B/P$ rows, and that the once-per-step all-reduce of $\partial W$ is "closer to $E^2$" because $\partial W$ has $E \times E$ entries regardless of batch and so does not shrink as the batch is split
- **AND** it concludes that the deciding ratio is $B / P$ — large enough keeps the matmul well above the collective
- **AND** it cross-references the backward anchor `#dp--one-all-reduce-at-the-end` where natural

#### Scenario: FSDP section explains its ratio
- **WHEN** the reader finishes the FSDP forward subsection
- **THEN** the passage explains that per-layer compute is $\sim B E^2 / P$ while the all-gather of $W$ moves $\sim E^2 / P$ (the chip's row-strip of the $E \times E$ weight), so the $P$ cancels and the deciding ratio simplifies to $B$ — larger per-chip batch buys room to hide the gather under the matmul

#### Scenario: TP section explains its ratio
- **WHEN** the reader finishes the TP forward subsection
- **THEN** the passage explains that compute is $\sim B E^2 / P$ and the activation collective is $\sim B E$ (an output of $B \times E$, independent of $P$), so the deciding ratio is $E / P$ — larger $E$ hides communication and larger $P$ makes each local matmul thinner

#### Scenario: CP section explains its ratio
- **WHEN** the reader finishes the CP forward subsection
- **THEN** the passage defines $S$ (sequence length) and $d$ (head dimension), explains that a device's per-hop attention compute is $\sim (S/P)^2 d$ while the K/V block it forwards is only $\sim (S/P) d$, and concludes the deciding ratio is $S / P$ — a longer per-device sequence hides the ring hop under the matmul

#### Scenario: EP section explains its ratio
- **WHEN** the reader finishes the EP forward subsection
- **THEN** the passage explains that each token's expert FFN costs $\sim E^2$ while the two all-to-alls move only its $\sim E$-sized activation to its expert and back, so the deciding ratio is $E$ — a wide hidden dimension hides the routing, given balanced tokens

## REMOVED Requirements

### Requirement: New useful-ratio passages match the existing TP line's style and length

**Reason**: The length cap this requirement imposed ("terse, one to two sentences," "within ~1.5× the length of the existing TP line") directly conflicts with the goal of this change — making the passages thorough enough that a reader need not already know the roofline to follow them. Defining $P$, justifying $B E^2 / P$, and explaining why $\partial W$ is "closer to $E^2$" cannot be done within that cap.

**Migration**: Style consistency (inline LaTeX, prose, no new components) is preserved by the new requirement "Useful-ratio passages match the post's prose style," which keeps the stylistic constraints but drops the length ceiling.
