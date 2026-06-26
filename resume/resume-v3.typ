// =============================================================================
// Daniel Mandragona — Résumé (v3 — adds Technical Skills)
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
//   9. Education moved to the very last position.
//  10. Post-Google content is Research (FermiLab + Publication) and Presentations.
//
// v3 changes:
//   1. Added a Technical Skills section (Languages, Frameworks & Tools, Foundations),
//      placed directly under the header rule, above Experience.
//   2. Trimmed Presentations to title — venue — date (dropped the one-line summaries)
//      to reclaim the vertical space and hold a single page.
// =============================================================================

#import "@preview/fontawesome:0.5.0": *   // contact icons

#let accent = rgb("#1A73E8")       // Google UI blue (deeper than brand blue)
#let ink    = rgb("#1a1a1a")       // near-black body ink
#let muted  = rgb("#5a5f63")       // muted gray for dates / meta
#let orgink = rgb("#3c4043")       // dark gray for company / institution
#let deep   = rgb("#174EA6")       // deep Google navy — name + section headers (2nd-tier blue)

#let heading-font = "Google Sans"
#let body-font    = "Charter"

#set document(
  title: "Daniel Mandragona — Résumé",
  author: "Daniel Mandragona",
)

#set page(
  paper: "us-letter",
  margin: (x: 0.55in, top: 0.52in, bottom: 0.45in),
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
  v(5.5pt)
  block(below: 4pt, {
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
  set par(leading: 0.48em, spacing: 0.48em)
  for it in items {
    grid(
      columns: (10pt, 1fr),
      column-gutter: 0pt,
      text(fill: muted)[•],
      it,
    )
    v(1.6pt)
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
#let projgroup(label, date, items) = {
  v(2.5pt)
  lr(
    text(font: heading-font, weight: 700, size: 9.6pt, fill: orgink)[#label],
    text(font: heading-font, size: 8.8pt, fill: muted)[#date],
  )
  v(2pt)
  bullets(items)
}

// A single-line education entry: degree · school .......... dates.
#let eduline(degree, school, date) = block(below: 3.5pt, lr(
  {
    text(font: heading-font, weight: 700, size: 10pt, fill: accent)[#degree]
    text(font: heading-font, size: 9.4pt, fill: orgink)[ #h(2pt)·#h(2pt) #school]
  },
  datestamp(date),
))

// A technical-skills row: bold category label, then a ·-separated list of items.
#let skillrow(label, items) = block(below: 3pt, {
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
    ML Performance Engineer  #h(4pt) #text(fill: muted)[|] #h(4pt)  TPU Kernels · Parallelism & Sharding · Quantum Computing
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
// TECHNICAL SKILLS
// =============================================================================

#section("Technical Skills")

#skillrow("Languages", ("Python", "C++", "Go", "C", "MATLAB", "SQL"))
#skillrow("Frameworks & Tools", ("JAX", "Pallas", "XLA", "MaxText", "XProf", "Stim", "Qiskit"))
#skillrow("Foundations", ("Linear algebra", "Statistics & probability", "Quantum mechanics", "Signal processing"))

// =============================================================================
// EXPERIENCE
// =============================================================================

#section("Experience")

// --- Google (single merged role; bullets grouped by team/project) -----------
#block(below: 5pt, {
  lr(
    text(font: heading-font, weight: 700, size: 11.5pt, fill: deep)[Google],
    datestamp("Sep 2018 – Present"),
  )
  v(1.5pt)
  lr(
    text(font: heading-font, weight: 600, size: 10pt, fill: accent)[Machine Learning Engineer],
    text(font: heading-font, size: 9pt, fill: muted, style: "italic")[Mountain View, CA],
  )
})

#projgroup(
  "ML Performance Engineering — MaxText",
  "Apr 2026 – Present",
  (
    [Delivered a 25% speedup on an FFT Pallas TPU kernel for a customer engagement.],
    [Drove a 2× speedup on a large customer's model via tensor/sequence parallelism and custom TPU kernels.],
    [Microbenchmarked Splash Attention to isolate bottlenecks, yielding a further 10% speedup on an already-tuned kernel.],
    [Cut Wan 2.1 397B diffusion step time 25% via Unified Sequence Parallelism (Ring Attention + DeepSpeed-Ulysses).],
    [Ran roofline analysis of Qwen 3.5 on next-gen TPUs to isolate compute- vs. memory-bound regimes and prioritize fixes.],
    [Identified and benchmarked mHC-lite optimization for DeepSeek V4, sidestepping the costly iterative Sinkhorn solve.],
  ),
)

#projgroup(
  "Quantum AI (20% project)",
  "2025 – Present",
  (
    [Accelerated the Tesseract QEC decoder 2× on the d=23 surface code via various profiling-driven optimizations.],
    [Statistical modeling (peak-finding, Skew-Normal/GMM fits) to characterize Two-Level-System (TLS) features in qubit data.],
    [Researched adaptive TLS thresholding and built custom metrics to assess algorithm performance.],
    [Applied computer-vision techniques to identify stationary TLS features in heatmap data.],
  ),
)

#projgroup(
  "Certificate Authority Infrastructure — Google Trust Services",
  "2019 – 2022, 2024 – 2026",
  (
    [Fixed low-level CA bottlenecks: Go/C interop bugs, DB hotspot thrashing, network egress, DNS resolver latency.],
    [Designed load-balancing for atypical network constraints; migrated servers into secure, sensitive machine pools.],
    [Implemented ACME (RFC 8555), integrated performance testing frameworks, and hardened the system for public release.],
    [Discovered and #link("https://groups.google.com/g/golang-announce/c/lVEm7llp0w0/m/VbafyRkgCgAJ?pli=1")[reported] a critical DoS vulnerability in Go/Crypto's DSA implementation.],
    [On-call, rollouts, and outage triage; supported #link("https://cabforum.org/about/information/auditors-and-assessors/webtrust-for-cas/")[WebTrust] compliance audits and Key Destruction Ceremonies.],
  ),
)

#projgroup(
  "Google Research — Perception & Play Abuse",
  "2018 – 2019",
  (
    [Built a MapReduce ML pipeline (billions of points) for image-saliency prediction on a tuned ResNet U-Net.],
    [Architected multimodal ML infrastructure for abuse detection in Google Play, decoupling feature generation from inference.],
  ),
)

// =============================================================================
// PRESENTATIONS
// =============================================================================

#section("Presentations")

#let talk(title, venue, date, summary: none, url: none) = {
  block(breakable: false, below: 4.5pt, {
    lr(
      {
        let t = text(font: heading-font, weight: 700, size: 9.8pt, fill: accent)[#title]
        if url != none { link(url)[#t] } else { t }
        text(font: heading-font, size: 9pt, fill: muted)[  — #venue]
      },
      datestamp(date),
    )
    if summary != none {
      v(1pt)
      block(par(leading: 0.46em, text(size: 9.2pt)[#summary]))
    }
  })
}

#talk(
  "QEC: From Classical Errors to the Surface Code",
  "Quantum AI, Google", "Oct 2025",
  url: "https://dandragona.me/pdfs/qec_slides.pdf",
)

#talk(
  "Berry Phase & Chern Numbers",
  "Master's Presentation, TAMU", "Nov 2024",
  url: "https://dandragona.me/pdfs/berry.pdf",
)

#talk(
  "Quantum Markov Chains",
  "Quantum Algorithms, CSCE 640 – TAMU", "Nov 2023",
  url: "https://dandragona.me/pdfs/qmcmh.pdf",
)

#talk(
  "Weyl Quantization Lecture",
  "Topics in Physics for Mathematicians, MATH 689 – TAMU", "Dec 2023",
  url: "https://dandragona.me/pdfs/weyl_quant.pdf",
)

#talk(
  "Visual Saliency Prediction",
  "Perception Research Showcase, Google", "Mar 2019",
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
// EDUCATION  (moved to the very last position — Human Request #9)
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
