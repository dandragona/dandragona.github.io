## 1. Define notation

- [x] 1.1 In `src/pages/blog/parallelism-roofline.mdx`, after the "$\sim 2BE^2$ floating point operations" sentence (~line 29), add the notation paragraph defining $B$ (per-step batch / rows of $X$ / tokens), $E$ (hidden / contraction dimension shared by $X$ and $W$), and $P$ (number of devices a given axis is split across) — per design.md Decision 1.

## 2. Rewrite the five forward-pass ratio passages

- [x] 2.1 DP (~line 60): rewrite to derive per-chip compute $\sim BE^2/P$ from the $\sim 2BE^2$ matmul split $P$ ways, and explain "closer to $E^2$" as $\partial W$ being an $E\times E$ object independent of batch; conclude $B/P$; keep the `#dp--one-all-reduce-at-the-end` cross-reference. Use design.md DP target text.
- [x] 2.2 FSDP (~line 76): rewrite to show compute $\sim BE^2/P$ vs all-gather of $W$ at $\sim E^2/P$, the $1/P$ cancelling to leave ratio $B$. Use design.md FSDP target text.
- [x] 2.3 TP (~line 100): rewrite to show compute $\sim BE^2/P$ vs reduce-scatter of $Y$ at $\sim BE$ (independent of $P$), the $B$ cancelling to leave $E/P$. Use design.md TP target text.
- [x] 2.4 CP (~line 122): rewrite to define $S$ and $d$, show per-hop attention compute $\sim (S/P)^2 d$ vs forwarded K/V block $\sim (S/P)d$, concluding $S/P$. Use design.md CP target text.
- [x] 2.5 EP (~line 140): rewrite to show per-token expert FFN $\sim E^2$ vs all-to-all activation traffic $\sim E$, concluding $E$, with the balance caveat. Use design.md EP target text.
- [x] 2.6 Verify each rewritten passage leads with its ratio sentence ("The useful ratio is …"), uses only inline `$...$` math, stays prose (no headings/bullets/tables/components), and introduces no symbol that isn't already defined.

## 3. Verify

- [x] 3.1 Run `astro build` (or `npm run build`) and confirm the page builds with no MDX/LaTeX parse errors.
- [x] 3.2 Read the five passages back-to-back and confirm the ratios and conclusions ($B/P$, $B$, $E/P$, $S/P$, $E$) are unchanged in substance from the originals — only depth increased.
- [x] 3.3 Confirm every symbol used in the ratios ($B$, $E$, $P$, $S$, $d$, $N$) has a definition the reader encounters at or before first use.
