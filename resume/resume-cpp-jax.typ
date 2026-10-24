// =============================================================================
// Daniel Mandragona - Résumé (C++ / JAX performance edition)
// Hand-authored Typst (no template package). Single-column, ATS-safe.
// Headings: Google Sans · Body: Charter · Single accent: Google Blue.
// Contact icons: Font Awesome 6 (OTFs vendored in ./fonts - compile with --font-path fonts).
// This edition foregrounds C++ systems work and JAX/Pallas performance engineering,
// while reducing quantum content to the directly relevant C++ decoder work.
// =============================================================================

#import "@preview/fontawesome:0.5.0": *   // contact icons

#let accent = rgb("#1A73E8")       // Google UI blue (deeper than brand blue)
#let ink    = rgb("#1a1a1a")       // near-black body ink
#let muted  = rgb("#5a5f63")       // muted gray for dates / meta
#let orgink = rgb("#3c4043")       // dark gray for company / institution
#let deep   = rgb("#174EA6")       // deep Google navy - name + section headers (2nd-tier blue)

#let heading-font = "Google Sans"
#let body-font    = "Charter"

// MLPerf Training v6.1 note: results (scores / time-to-train) are embargoed
// until MLCommons publishes them (~Nov 16, 2026); the résumé names the
// submission and its scale but quotes no scores.

#set document(
  title: "Daniel Mandragona — Résumé",
  author: "Daniel Mandragona",
)

#set page(
  paper: "us-letter",
  margin: (x: 0.50in, top: 0.40in, bottom: 0.38in),
)

#set text(font: body-font, size: 9.5pt, fill: ink, lang: "en")
#set par(justify: false, leading: 0.54em, spacing: 0.52em)

// Make all links the accent color, no ugly underline boxes.
#show link: it => text(fill: accent, it)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Section header: small-caps-ish heading in the heading font + thin rule.
#let section(title) = {
  v(3.2pt)
  block(below: 3pt, {
    text(
      font: heading-font, weight: 700, size: 10.5pt,
      fill: deep, tracking: 0.8pt,
    )[#upper(title)]
    v(1.5pt)
    line(length: 100%, stroke: 0.6pt + accent.lighten(20%))
  })
}

// Two-column row: left-flush content, right-flush date.
#let lr(lhs, rhs) = block(
  width: 100%,
  grid(
    columns: (1fr, auto),
    column-gutter: 10pt,
    align(left, lhs),
    align(right, rhs),
  ),
)

// A dated meta line (muted, heading font).
#let datestamp(d) = text(font: heading-font, size: 9pt, fill: muted)[#d]

// Bullet list with tight spacing and a muted marker.
#let bullets(items) = {
  set par(leading: 0.48em, spacing: 0.42em)
  for it in items {
    grid(
      columns: (10pt, 1fr),
      column-gutter: 0pt,
      text(fill: muted)[•],
      it,
    )
    v(1.0pt)
  }
}

// One experience entry (standalone org).
#let role(title, org, loc, date, body) = {
  block(breakable: false, below: 6.5pt, {
    lr(
      {
        text(font: heading-font, weight: 700, size: 10.5pt, fill: accent)[#title]
      },
      datestamp(date),
    )
    v(1pt)
    lr(
      text(font: heading-font, weight: 600, size: 9.6pt, fill: orgink)[#org],
      text(font: heading-font, size: 9pt, fill: muted, style: "italic")[#loc],
    )
    if body != none {
      v(3pt)
      body
    }
  })
}

// A team/project group inside a single merged role: bold project label +
// muted period on the right, then bullets. `body` is either an array of
// bullet items or pre-built content (e.g. a sequence of `subtrack` blocks).
#let projgroup(label, date, body) = {
  v(2pt)
  lr(
    text(font: heading-font, weight: 700, size: 9.6pt, fill: orgink)[#label],
    text(font: heading-font, size: 8.8pt, fill: muted)[#date],
  )
  v(2pt)
  if type(body) == array { bullets(body) } else { body }
}

// A labeled sub-track inside a projgroup: small italic label, then bullets.
#let subtrack(label, items) = {
  v(0.5pt)
  text(font: heading-font, weight: 600, size: 9pt, fill: accent, style: "italic")[#label]
  v(1.5pt)
  bullets(items)
}

// Education entry: degree · school .......... dates (+ optional detail line).
#let eduline(degree, school, date, detail: none) = block(below: 4pt, {
  set par(spacing: 2pt)
  lr(
    {
      text(font: heading-font, weight: 700, size: 10pt, fill: accent)[#degree]
      text(font: heading-font, size: 9.4pt, fill: orgink)[ #h(2pt)·#h(2pt) #school]
    },
    datestamp(date),
  )
  if detail != none {
    text(size: 9.1pt, fill: muted)[#detail]
  }
})

// A technical-skills row: bold category label followed by a compact list.
#let skillrow(label, items) = block(below: 3.5pt, {
  text(font: heading-font, weight: 700, size: 9.4pt, fill: orgink)[#label:]
  h(5pt)
  text(size: 9.4pt, fill: ink)[#items.join([#h(4pt)#text(fill: muted)[·]#h(4pt)])]
})

// =============================================================================
// HEADER
// =============================================================================

#block(width: 100%, {
  text(font: heading-font, weight: 700, size: 25pt, fill: deep, tracking: 0.2pt)[
    Daniel Mandragona
  ]
  v(3pt)
  text(font: heading-font, weight: 500, size: 10.5pt, fill: muted, tracking: 0.4pt)[
    ML Performance Engineer  #h(4pt) #text(fill: muted)[|] #h(4pt)  JAX & Pallas TPU Kernels · Distributed LLM Training · C++ Systems
  ]
  v(5pt)
  // Contact line with Font Awesome icons (accent-colored)
  text(font: heading-font, size: 9.2pt, fill: muted)[
    #text(fill: accent)[#fa-icon("location-dot")] #h(3.5pt) Sunnyvale, CA
    #h(9pt)
    #text(fill: accent)[#fa-envelope()] #h(3.5pt) #link("mailto:danielmandragona@gmail.com")[danielmandragona\@gmail.com]
    #h(9pt)
    #text(fill: accent)[#fa-phone()] #h(3.5pt) 954-940-1207
    #h(9pt)
    #text(fill: accent)[#fa-icon("globe")] #h(3.5pt) #link("https://dandragona.me")[dandragona.me]
    #h(9pt)
    #text(fill: accent)[#fa-icon("github")] #h(3.5pt) #link("https://github.com/dandragona")[github.com/dandragona]
  ]
})

#v(2pt)
#line(length: 100%, stroke: 1.4pt + accent)

#v(4pt)
#block(width: 100%, text(size: 9.4pt)[
  MLE with six years at Google, now focused on large-scale LLM training performance (JAX/Pallas on Cloud TPU v7x). Prior experience building secure and reliable #box[C++] systems. Part-time efforts in QEC research engineering.
])

// =============================================================================
// TECHNICAL SKILLS
// =============================================================================

#section("Technical Skills")

#skillrow(
  "Languages & Frameworks",
  ("C++", "Python", "Go", "C", "CUDA", "JAX", "Pallas", "XLA / HLO", "MaxText"),
)
#skillrow(
  "ML Systems",
  ("TPU Kernels", "Distributed Sharding & Collectives", "FP8 & MoE Training", "XProf", "Roofline Analysis", "QEC"),
)

// =============================================================================
// EXPERIENCE
// =============================================================================

#section("Experience")

// --- Google (single merged role; bullets grouped by team/project) -----------
#block(below: 5pt, {
  lr(
    text(font: heading-font, weight: 700, size: 11.5pt, fill: deep)[Google],
    datestamp("Sep 2018 – Aug 2022; Sep 2024 – Present"),
  )
  v(1.5pt)
  lr(
    text(font: heading-font, weight: 600, size: 10pt, fill: accent)[Machine Learning Engineer],
    text(font: heading-font, size: 9pt, fill: muted, style: "italic")[Mountain View, CA],
  )
})

#projgroup(
  "JAX/TPU Performance Engineering — MaxText / JAX Models & Performance",
  "Apr 2026 – Present",
  {
    subtrack(
      "DeepSeek-V3 671B Pretraining — MLPerf 6.1",
      (
        [Led the design and realization of an experimental batch-split pipelined DeepSeek-V3 implementation into a fully MLPerf-compliant submission at 8,192-chip scale.],
        [Stabilized MoE training: analyzed expert-load imbalance across all 58 sparse layers, reconciled subtle aux-LB loss \& dynamic router-bias differences, restored exact FP32 router biases, and debugged a critical dataset issue resulting in faster convergence (53 → 43 steps) and +15% E2E tok/s.],
        [Overlapped shared experts with SparseCore combine reduce-scatters; coalesced and pipelined cross-slice (DCN) gradient all-reduces across the expert axis (+11% E2E tok/s at 8,192-chip scale).],
        [Drove the move from multi-slice 4×4×N to single-slice 8×A×B meshes: remapped 3D collectives, fit expert FSDP shards to whole FP8 tiles, and cut 18 relayout copies/step.],
      ),
    )
    subtrack(
      "TPU Kernel Engineering (Pallas + C++)",
      (
        [Upstreamed MaxText's #link("https://github.com/AI-Hypercomputer/maxtext/pull/4834")[mHC-lite Pallas kernel]: VMEM-fused norm/projection/gating, closed-form RMSNorm+GEMM VJP, packed MXU contractions, and 3-path FP32 dX accumulation; up to 2.6× vs. pure JAX, +15% E2E tok/s on a customer LLM.],
        [Built an E2E hybrid-precision Pallas S5 SSM kernel for Oxford FLAIR's LOBS5 limit-order-book model: 2× faster training step than pure-JAX associative scan at 12k sequence length.],
        [Fused VMEM dQ accumulation and causal row-band skip into Tokamax Splash Attention bwd (−3.3% DSv3 step time).],
        [Advised on a chunked Gated DeltaNet Pallas kernel (2.2× layer step); derived the closed-form backward gradient-flow graph used to verify numerics across the chunked recurrence.],
        [Eliminated row-max reductions in FP8 Splash Attention via fixed-ceiling softmax and a fused dynamic norm-bound gate: −22% fwd kernel at 4k, −44% at 128k, and −12–16% step time at 128k–256k without underflow.],
        [Hand-scheduled a bare-metal C++ fused matmul-chain TPU kernel to 1.3× XLA using a Lean 4 tick model + A\* search.],
        [Found a mathematical trick enabling a 25% speedup on a Pallas FFT kernel for TPU.],
      ),
    )
    subtrack(
      "Distributed Training & Customer Engagements",
      (
        [Engineered async host offloading for hybrid-attention scans in MaxText: +15% tok/s, −20% peak HBM on a customer LLM.],
        [Cut a flagship customer's MoE proxy step time 51% (451 → 223 ms) via Ring-of-Experts EP, Pallas ragged sort, GMM v2, projection fusion, and 2-chunk comm/compute overlap.],
        [Reduced Wan 2.1 (14B) diffusion step time 25% via Unified Sequence Parallelism (Ring Attention + DeepSpeed-Ulysses).],
      ),
    )
  },
)

#projgroup(
  "C++ Performance Engineering — Tesseract Decoder (Quantum AI, 20%)",
  "2025 – Present",
  (
    [Achieved 5.6× speedup on the d=23 surface code through C++ code optimizations: cutting vector copies with linked lists, utilizing an arena allocator, and compiler prefetching hints.],
    [Researched accelerator-native QEC decoding for both TPUs & GPUs; built a CUDA implementation for C++ reference decoder alongside TPU version and benchmarked on NVIDIA L4 vs. TPU v5e.],
    [Upstreamed #link("https://github.com/quantumlib/tesseract-decoder/pulls?q=is%3Apr+is%3Amerged+author%3Adandragona")[three merged PRs]: C++ hot-path changes, pybind11 support for multiple detector error models, and generated Python type stubs.],
  ),
)

#projgroup(
  "Certificate Authority Infrastructure — Google Trust Services",
  "Aug 2019 – Aug 2022; Sep 2024 – Apr 2026",
  (
    [Eliminated low-level CA bottlenecks across Go/C interop, DB hotspot thrashing, network egress, and DNS resolver latency.],
    [Designed load balancing for atypical network constraints; migrated C++ servers into hardened, high-security machine pools.],
    [Implemented ACME (RFC 8555), hardened the C++ CA for public launch; supported #link("https://cabforum.org/about/information/auditors-and-assessors/webtrust-for-cas/")[WebTrust] audits and key ceremonies.],
    [Discovered and #link("https://groups.google.com/g/golang-announce/c/lVEm7llp0w0/m/VbafyRkgCgAJ?pli=1")[reported] a high-severity DoS vulnerability (CVE-2019-17596) in Go's crypto/dsa package.],
  ),
)

#projgroup(
  "Google Research — Perception & Play Abuse",
  "2018 – 2019",
  (
    [Built ML pipelines for image-saliency prediction (ResNet U-Net) and C++ multimodal Google Play abuse detection.],
  ),
)

// =============================================================================
// EDUCATION
// =============================================================================

#section("Education")

#eduline(
  "M.S. Mathematics (GPA 3.93)",
  "Texas A&M University, College Station, TX",
  "Aug 2022 – Dec 2024",
)

#eduline(
  "B.S. Mathematics, Computational Sciences (GPA 3.71)",
  "University of Central Florida, Orlando, FL",
  "Aug 2013 – May 2018",
)
