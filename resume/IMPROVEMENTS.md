# Résumé Improvements

Multi-model panel review (scry) of `resume.pdf`, targeting competitive ML Performance / TPU
kernels / systems roles at top labs (Google DeepMind, Anthropic, OpenAI). Prioritized.

## Fix these five first

1. **Sanitize confidential content.** "Next-generation TPU specifications," "strategic,
   high-priority customer," and any unreleased internal model versions sit on a public URL
   (dandragona.me). To another lab's recruiter that's a *judgment* flag ("will they leak
   ours?"); to Google it's a real problem.
2. **Rebuild Skills around the ML-systems stack.** No JAX, Pallas, XLA, Mosaic, profilers, or
   collectives = near-automatic ATS reject for TPU-kernel roles. Qiskit/MATLAB/Mathematica are
   burning your keyword space.
3. **Put real metrics on every speedup** — baseline, TPU generation, model size, and especially
   **MFU**, the one number this field trusts most. Bare percentages read as soft.
4. **Make the MaxText timeline survive arithmetic.** Six major wins in a ~2.5-month-old role
   invites hard probing or quiet discounting.
5. **Make ML-systems the spine.** Drop "quantum information" from the headline, add a 2-line
   seniority summary, compress the quantum/math/teaching content that buries your relevant work.

---

## Tier 1 — Credibility / red flags (fix before sending to anyone)

**1. Confidentiality exposure (most damaging).** "Next-gen TPU specs," customer descriptors, and
possibly internal model versions on a public PDF. *Fix:* one disclosure rule applied everywhere.
Public/open-source artifacts are fine — **MaxText is open source, Splash Attention is a public
JAX/Pallas kernel, released open-weight models are public.** Unreleased hardware specs, customer
identities, internal codenames are not — generalize: "roofline analysis against an upcoming
accelerator generation (specifics under NDA)"; "a production foundation-model training workload"
instead of "strategic customer."

**2. MaxText win-density is implausibly high for the tenure.** ~2.5 months claiming a 40% FFT
win, a 2x model win, a 10% Splash win, a 25% Wan 2.1 win, a Qwen roofline study, *and* a DeepSeek
mHC optimization. A sharp interviewer does the math. *Fix:* mark exploratory items "in progress,"
move only shipped wins under this role, attribute anything pre-Apr 2026 to the correct
team/period. Also be ready to explain *why* you're moving labs ~2.5 months into a dream role.

**3. Named models must be public *and* defensible.** "Qwen 3.5" / "DeepSeek V4" — if those exact
versions aren't publicly released, naming them reads as NDA leak or fabrication, and "mHC" is
undefined. There's also an unasked "why is a Google engineer optimizing competitors' models?"
*Fix:* name only released versions you can discuss; generalize internal/preview work ("a large
MoE model"); define "mHC" on first use or cut it. Have a one-liner ready: MaxText is a reference
implementation and Cloud TPU customers run open-weight models, so this is on-mission work.

**4. Fermilab location and spelling are wrong.** It's "Fermilab" (one word), in Batavia,
**Illinois** — not "College Station, TX." Any physics-literate reviewer catches this instantly.
*Fix:* "Research Collaborator, Fermilab (remote, via Texas A&M) — May–Oct 2024." Drop the wrong
city.

**5. The split-date CA role reads as an error — and ATS may mis-bucket you as junior.** "Sep 2024
– Apr 2026 & Aug 2019 – 2022" mashes two non-contiguous stints under one header; "2022" has no
month. Many parsers register only the recent ~1.5 years and tag you junior. *Fix:* split into two
entries with explicit leveling, consistent dates ("Aug 2019 – Jul 2022"). The Master's gap
between them is a clean, positive story.

## Tier 2 — ATS / recruiter-scan (filtered before a human reads it)

**6. Rebuild Skills around the real stack.** "Python, C++, Golang, Qiskit, MATLAB, C, Java,
Mathematica, SQL" has zero of the keywords these roles scan. *Fix:* categorize —
- **ML Systems/Perf:** JAX, Pallas, XLA/HLO, Mosaic, GSPMD/SPMD, FSDP, collectives, XProf/Perfetto,
  roofline, kernel fusion, sequence parallelism (*list only what's true*)
- **Languages:** Python, C++, Go, C, SQL

You worked on **Splash Attention, a Pallas kernel — you can legitimately claim Pallas.** Demote
Qiskit/MATLAB/Mathematica. Thread the same keywords into bullets so ATS double-counts.

**7. De-quantum the headline; add a seniority summary.** *Fix:* "ML Performance Engineer | TPU
Kernels, JAX/XLA, Distributed Training," plus 2 lines: "~8 yrs at Google across MaxText perf, CA
infrastructure, and ML pipelines. JAX/Pallas kernels, parallelism, roofline-driven optimization,
on a pure-math foundation (M.S. Mathematics)." Anchors the 6-second scan and preempts "why math?"

**8. Add proof links; reconsider the phone number.** Only a personal site is listed — for kernel
work, hiring managers want code. *Fix:* add GitHub (link a Pallas kernel / microbenchmark /
repro) and LinkedIn; a short roofline or JAX/XLA profiling blog post helps at top labs. Consider
dropping the phone number from the public PDF.

**9. Check PDF parseability.** Multi-column layouts/tables/header text break ATS extraction.
*Fix:* single-column, standard headings; paste into a plain-text box and confirm it reads cleanly.

## Tier 3 — Weak bullets / missing quantification

**10. Anchor every speedup.** Pattern: "[verb] [metric] X% (A→B) on [model/size] on [TPU vXe],
measured by [tokens/s | step time | MFU]." E.g., "Cut decode step time 25% (MFU 46%→58%) on Wan
2.1 at 8k-seq via USP on v5e-256."

**11. Add MFU — the most credible metric in this field.** Convert at least the headline wins to
MFU or achieved-vs-peak. Single most persuasive number you can add.

**12. Add the "how" (mechanism) to each bullet.** Did you write a Pallas kernel, add an XLA
fusion, change a layout, alter sharding? Several bullets (roofline, mHC, the entire 20% section)
state *activity, not outcome* — end each with what number moved or what it shipped, or cut it.

**13. Showcase your best systems bullet.** "Go/C interop bugs, DB hotspot thrashing, network
egress, DNS latency" is exactly the depth these roles want — and has zero numbers. *Fix:*
"Removed a DB hotspot that capped throughput at N QPS (+M% headroom); cut p99 X%." Make it a
highlight, not a list.

**14. Promote the DoS find to its own bullet.** The Go/Crypto DSA DoS is buried at the end of a
dense bullet — rare, credible, interview-gold. Stand-alone bullet; link the CVE/issue/commit if
public.

**15. Kill verb-stacking, fragments, weak leads; fix tense.** "Identified, researched,
implemented, and benchmarked" (four verbs); "Performance experimentation on Wan 2.1…" (no verb);
the 20% section is verbless fragments. One strong past-tense verb per bullet.

**16. Cut adjective inflation.** "state-of-the-art," "novel," "unique," "strategic,
high-priority," "rigorous" get discounted. Replace each with a number or specific noun.

**17. Proofread for precision.** "Resnet Unet" → **ResNet U-Net**. Small errors undercut a role
where precision is the job.

## Tier 4 — Structure / ordering / focus

**18. Reverse-chronological order is broken.** Fermilab (2024) appears *after* the 2018–2019
residency; the 20% role sits above the more-recent CA role. *Fix:* strict reverse-chron; split
into **Engineering Experience** (MaxText, CA Infra) vs **Research & Teaching**.

**19. Demote the 20% role; "20%" is Google jargon.** Won't parse externally and creates overlap
with CA Infra. Fold into a bullet or compact Research section, or label "Research Engineer
(20%-time project)."

**20. Trim academic clutter.** Seven presentations (mostly math/quantum), full pure-math
coursework, qualifying exams read as "academic CV." Keep the QEC@Google talk and maybe one more;
drop quals; keep 2–3 bridging courses; publication as one line; collapse the two TA roles.

**21. Mind length.** Target a tight 1–2 pages, spending reclaimed space on quantified perf
bullets.

---

**Cross-cutting:** be ready to defend *every* number under "vs what baseline, what hardware, how
measured." If you can't back a figure cleanly, soften or cut it.

---

## Human Requested Improvements

Direct changes requested by Daniel (take precedence over the panel suggestions above where they
conflict):

1. **Consolidate the four Google entries** in some way (single Google header with sub-roles, or
   otherwise merged).
2. **Remove the Technical Skills section** — optionally fold the skills into the experience
   bullet descriptions instead.
3. **Remove the Quantum Information Science Summer School** entry (Oak Ridge).
4. **Remove the Teaching Assistant entries** (both TAMU and UCF).
5. **Make the Education section one line each** for each of the two rows (Masters, BS).
6. **Remove presentations that are irrelevant or old** — keep only the relevant/recent ones.
7. **Remove the Engineering Residency entry completely.**
8. **Make each line fit on a single line**, even if grammar is slightly off, for density.
9. **Move Education to the very last position** in the document.
10. **Alternative layout option:** keep only the first three Google items (condensed) and keep it
    to two pages, where everything past the Google section is Presentations and Research.
