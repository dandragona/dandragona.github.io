## Context

The blog post `src/pages/blog/parallelism-roofline.mdx` walks the reader through four forward-pass parallelism strategies (DP, FSDP, TP, FSDP+TP) and a backward section. Only the TP forward section (line 92) ends with a quantitative "useful ratio" heuristic ($E / P$), which gives the reader a concrete sense of when TP wins. The other three forward sections are descriptive but stop short of that takeaway.

The reader's mental model is being built section-by-section in parallel, so an asymmetry in how each section ends makes the four strategies harder to compare. The fix is purely additive prose — no diagrams, components, or math derivations need to change.

## Goals / Non-Goals

**Goals:**
- Each of the four forward-pass sections (DP, FSDP, TP, FSDP+TP) ends with one short paragraph naming the regime where that strategy is useful, expressed via a compute-to-communication ratio in the same style as the existing TP line.
- The new lines reuse the post's notation: $B$ (batch), $E$ (model/contraction dim), $P$ (mesh / axis size), and inline LaTeX `$...$`.
- Wording stays terse — one to two sentences each, comparable in length to the existing TP line.

**Non-Goals:**
- Re-deriving roofline math beyond what's needed to state the ratio.
- Touching the backward sections, the summary table, or any of the diagrams.
- Restructuring the existing TP "useful ratio" line — it stays as is and becomes the template for the others.
- Adding new components, props, or images.

## Decisions

### Decision 1: Place each ratio at the end of its forward-section prose

The TP ratio sits as a standalone short paragraph after the `<TpStaircase />` component. Mirror that placement:
- **DP**: append a new sentence/paragraph right after the existing "No cross-device communication is necessary…" sentence (line 54), since DP has no further forward diagrams.
- **FSDP**: append after the `<OverlapTimeline strategy="fsdp" />` block (around line 66).
- **FSDP+TP**: append after the `<FsdpTpStaircase />` block / closing paragraph (around line 122), positioned before the `# Backward` H1.

**Why**: keeps the "useful ratio" as the visual closer of each section, so the reader always finds the heuristic in the same structural slot.

**Alternative considered**: a single comparison paragraph at the end of the forward chapter. Rejected because it breaks the section-by-section symmetry the post is built on, and the user explicitly asked for additions inside each section.

### Decision 2: Phrase each ratio as compute / collective volume, matching the TP template

The TP line uses the form: "compute scales like X, the activation collective is closer to Y, so larger Z buys room to hide communication."

Apply the same template:
- **DP** forward has no activation collective, so the ratio talks about per-chip work ($B E^2 / P$) staying above the per-step backward all-reduce cost ($\sim E^2$) — i.e., DP is useful while $B / P$ keeps per-chip compute well above the once-per-step weight-sized collective. Note: this references the backward all-reduce because DP's forward pays nothing, so the regime question is "is the backward all-reduce hidden by your forward+backward compute?"
- **FSDP** forward pays a per-layer all-gather of $W$ ($\sim E^2 / P$ bytes) against per-layer compute ($\sim B E^2 / P$ flops). The useful ratio simplifies to $B$: larger per-chip batch hides the all-gather.
- **FSDP+TP** has two axes, each with its own ratio: along FSDP it's the $B$ ratio (per-axis-shard batch must stay large); along TP it's the $E / P_{TP}$ ratio (contraction dim must stay large relative to the TP axis size). The optimal mesh balances both.

**Why**: gives the reader the same mental hook in each section. Using the same symbols ($B$, $E$, $P$) keeps everything comparable without forcing the reader to learn new notation.

**Alternative considered**: a numeric example per strategy (like the "850 tokens per chip" line that already appears in FSDP+TP intro). Rejected for length and because the existing TP line is purely symbolic.

### Decision 3: Lean on the existing FSDP+TP intro for numbers; keep the new ratio symbolic

The FSDP+TP section already cites concrete per-chip floors (850 → ~100 tokens). The new "useful ratio" line should not repeat those numbers — it should state the two-axis symbolic version so the reader sees how the FSDP and TP ratios combine.

**Why**: avoids duplicating the existing numeric content; keeps the symbolic ratio aligned with the other three sections.

## Risks / Trade-offs

- **Risk**: the DP "useful ratio" needs to mention backward communication, because DP's forward pays nothing. → Mitigation: keep the sentence brief and explicitly note that DP's only forward-side cost is the backward all-reduce that the forward sets up, then point to the [backward section](#dp--one-all-reduce-at-the-end) which the post already cross-links.
- **Risk**: math notation drift (e.g., using $N$ vs $P$ for mesh size, $D$ vs $E$ for hidden dim). → Mitigation: read the existing TP line (line 92) and reuse its exact symbols.
- **Risk**: a "useful ratio" that contradicts the existing "850 tokens per chip" / "100 tokens per chip" numbers in the FSDP+TP intro. → Mitigation: the new FSDP+TP ratio is symbolic and per-axis; the existing numeric paragraph is a system-level floor — they are complementary, not duplicative, but the new line should be placed *after* the existing intro/diagram so the reader has already seen the numbers.
