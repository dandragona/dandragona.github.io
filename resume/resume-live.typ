// =============================================================================
// Daniel Mandragona — Résumé (v2 — human-requested revisions)
// Hand-authored Typst (no template package). Single-column, ATS-safe.
// Headings: Helvetica Neue · Body: Charter · Single accent: Google Blue.
// Contact icons: Font Awesome 6 (OTFs vendored in ./fonts — compile with --font-path fonts).
//
// v2 changes (Human Requested Improvements in IMPROVEMENTS.md):
//   1. Four Google entries consolidated under one "Google" header with sub-roles.
//   2. Technical Skills section removed.
//   3. Quantum Information Science Summer School (Oak Ridge) removed.
//   4. Both Teaching Assistant entries removed.
//   5. Education collapsed to one line per degree.
//   6. Presentations trimmed (dropped Functional Programming + Hopf Bifurcation).
//   7. Engineering Residency entry removed.
//   8. Bullets compressed to fit a single printed line.
//   9. Education placed before Presentations; Skills added at bottom.
//  10. Post-Google content is Education, Presentations, Publications, and Skills.
// =============================================================================

#import "@preview/fontawesome:0.5.0": *   // contact icons

#let accent = rgb("#1A73E8")       // Google UI blue (deeper than brand blue)
#let ink    = rgb("#1a1a1a")       // near-black body ink
#let muted  = rgb("#5a5f63")       // muted gray for dates / meta
#let orgink = rgb("#3c4043")       // dark gray for company / institution
#let deep   = rgb("#174EA6")       // deep Google navy — name + section headers (2nd-tier blue)

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
  v(2.6pt)
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
    v(0.5pt)
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

// A company header (used when several sub-roles share one employer).
#let company(name, loc) = block(below: 4.5pt, lr(
  text(font: heading-font, weight: 700, size: 11.5pt, fill: deep)[#name],
  text(font: heading-font, size: 9pt, fill: muted, style: "italic")[#loc],
))

// A sub-role nested under a company header: title + date, then bullets.
#let subrole(title, date, body) = block(breakable: false, below: 6pt, {
  lr(
    text(font: heading-font, weight: 600, size: 10pt, fill: accent)[#title],
    datestamp(date),
  )
  if body != none {
    v(2.5pt)
    body
  }
})

// A team/project group inside a single merged role: bold project label +
// muted period on the right, then bullets. (Format #2 — one role, grouped.)
// `body` is either an array of bullet items or pre-built content (e.g. a
// sequence of `subtrack` blocks).
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
// Used to split one long role into themed clusters without a new date row.
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

// A skills row: bold category label followed by a compact "·"-separated list.
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
    ML Performance Engineer  #h(4pt) #text(fill: muted)[|] #h(4pt)  TPU Kernels · Distributed LLM Training · Quantum Computing
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
  "ML Performance Engineering — JAX Models & Performance",
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
      "TPU Kernel Engineering",
      (
        [Upstreamed MaxText's #link("https://github.com/AI-Hypercomputer/maxtext/pull/4834")[mHC-lite Pallas kernel]: VMEM-fused norm/projection/gating, closed-form RMSNorm+GEMM VJP, packed MXU contractions, and 3-path FP32 dX accumulation; up to 2.6× vs. pure JAX, +15% E2E tok/s on a customer LLM.],
        [Built an E2E hybrid-precision Pallas S5 SSM kernel for Oxford FLAIR's LOBS5 limit-order-book model: 2× faster training step than pure-JAX associative scan at 12k sequence length.],
        [Fused VMEM dQ accumulation and causal row-band skip into Tokamax Splash Attention bwd (−3.3% DSv3 step time).],
        [Advised on a chunked Gated DeltaNet Pallas kernel (2.2× layer step); derived the closed-form backward gradient-flow graph used to verify numerics across the chunked recurrence.],
        [Eliminated row-max reductions in FP8 Splash Attention via fixed-ceiling softmax and a fused dynamic norm-bound gate: −22% fwd kernel at 4k, −44% at 128k, and −12–16% step time at 128k–256k without underflow.],
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
  "Quantum AI (20% project)",
  "2025 – Present",
  (
    [Designed a TPU-accelerated real-time maximum-likelihood QEC decoder (patent pending).],
    [Accelerated #link("https://github.com/quantumlib/tesseract-decoder/pulls?q=is%3Apr+is%3Amerged+author%3Adandragona")[Tesseract QEC decoder] 5.6× on the d=23 surface code via arena allocation, linked lists & software prefetching.],
    [Characterized Two-Level-System (TLS) qubit defects via Gaussian-mixture/skew-normal fits and computer-vision tracking.],
  ),
)

#projgroup(
  "Certificate Authority Infrastructure — Google Trust Services",
  "2019 – 2022; 2024 – 2026",
  (
    [Eliminated low-level CA bottlenecks across Go/C interop, DB hotspot thrashing, network egress, and DNS resolver latency.],
    [Designed load balancing for atypical network constraints; migrated servers into hardened, high-security machine pools.],
    [Implemented ACME (RFC 8555), hardened the CA for public launch, and supported #link("https://cabforum.org/about/information/auditors-and-assessors/webtrust-for-cas/")[WebTrust] audits and key ceremonies.],
    [Discovered and #link("https://groups.google.com/g/golang-announce/c/lVEm7llp0w0/m/VbafyRkgCgAJ?pli=1")[reported] a high-severity DoS vulnerability (CVE-2019-17596) in Go's crypto/dsa package.],
  ),
)

#projgroup(
  "Google Research — Perception & Play Abuse",
  "2018 – 2019",
  (
    [Built ML pipelines for image-saliency prediction (ResNet U-Net) and multimodal Google Play abuse detection.],
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

// =============================================================================
// PRESENTATIONS
// =============================================================================

#section("Presentations")

#let talk(title, venue, date, summary, url: none) = {
  // below: gap BETWEEN talks (clear separation). par spacing: tight gap
  // between a talk's title line and its own summary, so they read as a unit.
  block(breakable: false, below: 4pt, {
    set par(spacing: 2pt)
    lr(
      {
        let t = text(font: heading-font, weight: 700, size: 9.8pt, fill: accent)[#title]
        if url != none { link(url)[#t] } else { t }
        text(font: heading-font, size: 9pt, fill: muted)[  — #venue]
      },
      datestamp(date),
    )
  })
}

#talk(
  "QEC: From Classical Errors to the Surface Code",
  "Quantum AI, Google", "Oct 2025",
  [Classical and quantum error correction, from the Hamming code up to the surface code for QEC.],
  url: "https://dandragona.me/pdfs/qec_slides.pdf",
)

#talk(
  "Berry Phase & Chern Numbers",
  "Master's Presentation, TAMU", "Nov 2024",
  [Gauge invariance and numerical computation of Berry phase and Chern numbers for topological systems.],
  url: "https://dandragona.me/pdfs/berry.pdf",
)

#talk(
  "Quantum Markov Chains",
  "Quantum Algorithms, CSCE 640, TAMU", "Nov 2023",
  [Szegedy's quantization of Markov chains and its quadratic speedup in mixing time over the classical walk.],
  url: "https://dandragona.me/pdfs/qmcmh.pdf",
)

// =============================================================================
// PUBLICATIONS
// =============================================================================

#section("Publications")

#block(width: 100%, breakable: false, {
  text(font: heading-font, weight: 700, size: 9.8pt, fill: accent)[
    A Chaotic Chemical Reactor With and Without Delay: Bifurcations, Competitive Modes, and Amplitude Death.
  ]
  v(1.5pt)
  text(size: 9.3pt)[
    S. Roy Choudhury and Daniel Mandragona.
    #h(3pt) #text(style: "italic", fill: muted)[Int. J. Bifurc. Chaos], 2019.
  ]
})

// =============================================================================
// SKILLS
// =============================================================================

#section("Skills")

#skillrow(
  "Languages & Frameworks",
  ("Python", "C++", "Go", "C", "CUDA", "JAX", "Pallas", "XLA / HLO", "MaxText"),
)
#skillrow(
  "ML Systems",
  ("TPU Kernels", "Distributed Sharding & Collectives", "FP8 & MoE Training", "XProf", "Roofline Analysis", "QEC"),
)
