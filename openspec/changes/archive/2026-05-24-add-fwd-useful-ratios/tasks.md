## 1. Confirm baseline

- [x] 1.1 Re-read the existing TP useful-ratio line at `src/pages/blog/parallelism-roofline.mdx:92` and lock in its template (notation: $B$, $E$, $P$; form: "compute scales like …, the collective is closer to …, so larger $X$ buys …").
- [x] 1.2 Confirm the three target insertion points are still where the design says: end of DP forward (~line 54), end of FSDP forward after `<OverlapTimeline strategy="fsdp" />` (~line 66), end of FSDP+TP forward after `<FsdpTpStaircase />` (~line 122, before `# Backward`).

## 2. Add the DP useful-ratio line

- [x] 2.1 Append a one-to-two-sentence paragraph after the existing DP forward closing sentence ("No cross-device communication is necessary…").
- [x] 2.2 The sentence states: DP's forward pays nothing, so the regime question is whether per-chip compute ($\sim B E^2 / P$) stays well above the cost of the once-per-step backward all-reduce of $\partial W$ ($\sim E^2$) — i.e., DP is useful while $B / P$ keeps per-chip compute large.
- [x] 2.3 If natural, cross-link the existing backward anchor `#dp--one-all-reduce-at-the-end`.

## 3. Add the FSDP useful-ratio line

- [x] 3.1 Append a one-to-two-sentence paragraph after the `<OverlapTimeline strategy="fsdp" />` block (and any trailing prose) at the end of the FSDP forward section.
- [x] 3.2 The sentence states: per-layer compute is $\sim B E^2 / P$ while the per-layer all-gather of $W$ is $\sim E^2 / P$, so the useful ratio simplifies to $B$ — larger per-chip batch buys room to hide the all-gather under the matmul.

## 4. Add the FSDP+TP useful-ratio line

- [x] 4.1 Append a one-to-two-sentence paragraph after the `<FsdpTpStaircase />` block and the existing closing paragraph about per-axis traffic, immediately before the `# Backward` H1.
- [x] 4.2 The sentence states: each axis carries its own ratio — the FSDP axis wants large per-axis batch (the $B$ ratio); the TP axis wants $E$ large relative to its axis size (the $E / P_{TP}$ ratio); the optimal mesh shape balances them.
- [x] 4.3 Do not repeat the existing numeric floors (850 / ~100 tokens per chip) already given in the section's intro.

## 5. Consistency pass

- [x] 5.1 Read the four useful-ratio passages back-to-back; verify they share notation, math styling (inline `$...$`), and length (each within ~1.5× the existing TP line).
- [x] 5.2 Verify no new symbol is introduced without context, and no new component / import / asset is needed.

## 6. Verify the post still renders

- [x] 6.1 Run the site dev server and load the parallelism-roofline post.
- [x] 6.2 Check that the four new/existing useful-ratio lines render correctly (LaTeX inline math, no MDX parse errors) and that no surrounding component layout shifts.

## 7. Validate the OpenSpec change

- [x] 7.1 Run `openspec validate add-fwd-useful-ratios` and confirm it passes.
- [x] 7.2 After the edits land, run `openspec status --change add-fwd-useful-ratios` and confirm completion before archiving.
