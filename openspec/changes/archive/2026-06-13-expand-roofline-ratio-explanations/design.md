## Context

`src/pages/blog/parallelism-roofline.mdx` walks through five parallelism strategies; each forward-pass section ends with a one-clause "useful ratio" line. These lines are the post's payoff — they tell the reader when each strategy is worth it — but they assume the reader can already unfold compressed arithmetic. The running example (`X[B,E] @ W[E,E] → Y[B,E]`, $\sim 2BE^2$ FLOPs) is stated once at the top, but the symbols $B$ and $E$ are never *defined*, and $P$ first appears — undefined — inside the ratio lines themselves. The user flagged the DP line specifically: "what is 'closer to $E^2$', why is per-chip compute $BE^2/P$, what even is $P$?"

The current spec enforces the terseness that causes this ("at most two sentences"). So this is partly an editorial change and partly a spec change: the constraint being violated is one the spec actively demands.

## Goals / Non-Goals

**Goals:**
- Define $B$, $E$, $P$ once, near the running example, before any ratio uses them.
- Rewrite all five ratio passages so each derives its scalings (per-chip compute, collective size) instead of asserting them, and defines every symbol it uses.
- Keep the five ratios and conclusions ($B/P$, $B$, $E/P$, $S/P$, $E$) substantively unchanged — only depth increases.
- Replace the spec's length cap with a thoroughness + style requirement.

**Non-Goals:**
- No changes to diagrams, React components, MDX imports, or the backward-pass sections.
- No new strategies, no re-derivation of the roofline model itself.
- Not turning prose into bullet lists or tables — these stay paragraphs.
- Not adding a full "Notation" table/section; a compact inline definition near line 29 is enough.

## Decisions

### Decision 1: Define notation inline near the running example, not in a separate glossary section
The post's voice is conversational prose, and the CP/EP sections already define their local symbols inline ("$S$ the sequence length and $d$ the head dimension"). A standalone notation table would clash with that register and front-load the reader before they have motivation. Instead, append a sentence to the running-example paragraph (around line 29) that names $B$, $E$, and $P$.

*Alternative considered:* a dedicated `## Notation` section. Rejected — heavier than needed, breaks the narrative flow, and three symbols don't justify a section.

**Target text (after the "$\sim 2BE^2$ floating point operations" sentence, ~line 29):**
> Three letters carry the whole post: $B$ is the per-step **batch** — the number of rows of $X$, i.e. the tokens processed together; $E$ is the **hidden dimension**, the width shared by $X$ and $W$ and the axis the matmul contracts over; and $P$ — which shows up the moment we start splitting work — is the **number of devices** a given axis is spread across. A matmul's cost grows with $B$ and with $E^2$; a collective's cost grows with whatever it has to move. Every "useful ratio" below is just those two growth rates raced against each other.

### Decision 2: Each ratio passage follows the same four-beat structure
To stay consistent and genuinely thorough, every rewritten passage answers, in order: (1) what does the forward/step communicate, and why is it that size? (2) what is the per-chip compute, and why? (3) what is the ratio of the two? (4) which direction makes the strategy pay off? This is the structure the DP line gestures at but compresses.

The key conceptual unlock — the one the user asked for — is **why a gradient/weight collective is "closer to $E^2$" while compute carries a $B$**: $\partial W$ (and $W$) is an $E \times E$ object, so it has $\sim E^2$ entries *regardless of the batch*; compute is $\sim BE^2$ because every one of the $B$ rows touches the weight. Splitting the batch across $P$ devices divides compute (it carries the $B$) but not the weight collective (it doesn't). That mismatch is the entire reason $B/P$ is the deciding ratio for DP. Each passage makes its own version of this "what carries the split, what doesn't" point explicit.

**Target text — DP (~line 60):**
> The useful ratio is $B / P$. The forward pass costs nothing across devices — each chip just multiplies its own rows by its own copy of $W$. The bill comes once per step, at the end: because every chip computed $\partial W$ from a different slice of the batch, the chips must agree on a summed gradient, which is the all-reduce of $\partial W$. Here is the asymmetry that decides everything. The per-chip compute is $\sim B E^2 / P$: the layer's matmul is $\sim 2 B E^2$ FLOPs, and splitting the batch across $P$ devices leaves each one with $B/P$ rows of work. But the gradient being all-reduced is "closer to $E^2$" — $\partial W$ has the same shape as $W$, an $E \times E$ grid of numbers, and that size does not depend on the batch at all. So as you add devices, compute per chip shrinks (it carries the $B$) while the collective does not (it carries only $E^2$). DP therefore wants $B / P$ large enough that the local matmul stays well above the once-per-step collective it has to hide — see the [backward section](#dp--one-all-reduce-at-the-end) for how that all-reduce overlaps the next layer's compute.

**Target text — FSDP (~line 76):**
> The useful ratio simplifies to $B$. Per-layer compute is again $\sim B E^2 / P$ — the same $\sim 2BE^2$ matmul, split $P$ ways. The communication this time is the all-gather that rebuilds $W$ before the layer can run: each chip holds only its row-strip of the $E \times E$ weight, so it contributes $\sim E^2 / P$ and receives the rest. Notice both quantities carry the same $1/P$, so the $P$ cancels when you compare them — the ratio that's left is just $B$. A larger per-chip batch makes each matmul longer without making the gather any bigger, which is exactly the room you need to slide the next layer's gather underneath the current layer's compute.

**Target text — TP (~line 100):**
> The useful ratio is $E / P$. Compute is $\sim B E^2 / P$, since tensor parallelism splits the contraction dimension $E$ across the $P$ chips. The collective is the reduce-scatter of the activation $Y$, whose size is $\sim B E$ — an output with one entry per (row, hidden) pair, and crucially independent of $P$. Racing compute against communication, the $B$ cancels and a factor of $E/P$ is left: a larger hidden dimension $E$ gives the matmul more work to hide the activation exchange behind, while a larger $P$ thins each local matmul and squeezes that margin.

**Target text — CP (~line 122):**
> For the ring, the useful ratio is $S / P$, where $S$ is the sequence length and $d$ the head dimension. Each device owns $S/P$ of the sequence positions. Its attention compute per ring hop scales like $(S/P)^2 d$ — every local query attends to the block of $S/P$ keys it currently holds — while the K/V block it forwards to its neighbor is only $\sim (S/P) d$ numbers. Compute grows with the *square* of the per-device sequence length and communication only linearly, so a longer per-device sequence ($S/P$ large) buys room to hide each ring hop under the matmul it overlaps.

**Target text — EP (~line 140):**
> The useful ratio is $E$. Each token that lands on an expert pays an FFN costing $\sim E^2$ (two $E$-wide matmuls), while the two all-to-alls only have to ship that token's $\sim E$-sized activation vector to the expert's device and the result back. Compute per token grows with $E^2$ and the routing traffic only with $E$, so a wide hidden dimension hides the dispatch-and-combine round trip — provided the router keeps tokens balanced across experts, since one overloaded expert stalls the whole all-to-all behind it.

### Decision 3: Correct the section list to match the post as it exists
The current spec names the four sections "DP, FSDP, TP, FSDP+TP." The post today has DP, FSDP, TP, CP, EP — there is no FSDP+TP section. The modified requirement is written against the five sections that actually exist, bringing the spec back in sync with the post.

## Risks / Trade-offs

- **[Longer passages dilute the punchy "rule of thumb" feel the original had]** → Keep the ratio itself as the passage's first sentence ("The useful ratio is $X$."), so a skimming reader still gets the headline; the derivation follows for the reader who wants it.
- **[Drift between the five passages — re-explaining $BE^2/P$ five times invites inconsistency]** → The four-beat structure (Decision 2) and the shared notation definition (Decision 1) keep them parallel; $BE^2/P$ is derived once in full (DP) and referenced more briefly afterward.
- **[Over-explaining basics the audience already knows]** → The notation paragraph is three sentences and the derivations stay at the FLOP-counting level the post already uses ($\sim 2BE^2$), not a tutorial on matmuls.
- **[Build/render regressions from new inline LaTeX]** → All math uses the existing inline `$...$` form already proven in the file; verify with `astro build` after editing.

## Migration Plan

Pure content/spec change, no runtime surface. Steps: (1) edit the six locations in the MDX (one notation paragraph + five ratio passages) per the target text above; (2) run `astro build` to confirm the page renders and MDX/LaTeX parse; (3) eyeball each ratio still reads ratio-first. Rollback is a single-file `git revert`.

## Open Questions

- None blocking. The target text above is a strong default; the apply step may tighten wording for rhythm as long as it preserves the four beats and defined symbols required by the spec.
