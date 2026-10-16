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

#set document(
  title: "Daniel Mandragona - Résumé",
  author: "Daniel Mandragona",
)

#set page(
  paper: "us-letter",
  margin: (x: 0.55in, top: 0.52in, bottom: 0.45in),
)

#set text(font: body-font, size: 9.7pt, fill: ink, lang: "en")
#set par(justify: false, leading: 0.54em, spacing: 0.52em)

// Make all links the accent color, no ugly underline boxes.
#show link: it => text(fill: accent, it)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Section header: small-caps-ish heading in the heading font + thin rule.
#let section(title) = {
  v(6pt)
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
  set par(leading: 0.49em, spacing: 0.49em)
  for it in items {
    grid(
      columns: (10pt, 1fr),
      column-gutter: 0pt,
      text(fill: muted)[•],
      it,
    )
    v(1.8pt)
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
// muted period on the right, then bullets.
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

// A technical-skills row: bold category label followed by a compact list.
#let skillrow(label, items) = block(below: 2.5pt, {
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
    ML Performance Engineer  #h(4pt) #text(fill: muted)[|] #h(4pt)  JAX & Pallas TPU Kernels · Distributed Training · C++ Systems
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
  MLE with six years at Google, now focused on large-scale training performance. Prior experience building secure and reliable #box[C++] systems. Part time efforts in QEC research engineering.
])

// =============================================================================
// TECHNICAL SKILLS
// =============================================================================

#section("Technical Skills")

#skillrow("Languages", ("C++", "Python", "Go", "C", "MATLAB"))
#skillrow(
  "ML Systems",
  ("JAX", "Pallas", "XLA", "XProf", "Co-Design", "Parallelism Strategies", "Roofline Analysis"),
)

// =============================================================================
// EXPERIENCE
// =============================================================================

#section("Experience")

// --- Google (single merged role; bullets grouped by team/project) -----------
#block(below: 5pt, {
  lr(
    text(font: heading-font, weight: 700, size: 11.5pt, fill: deep)[Google],
    datestamp("Sep 2018 - Aug 2022; Sep 2024 - Present"),
  )
  v(1.5pt)
  lr(
    text(font: heading-font, weight: 600, size: 10pt, fill: accent)[Machine Learning Engineer],
    text(font: heading-font, size: 9pt, fill: muted, style: "italic")[Mountain View, CA],
  )
})

#projgroup(
  "JAX/TPU Performance Engineering - MaxText",
  "Apr 2026 - Present",
  (
    [Found mathematical trick enabling a 25% speedup on a Pallas FFT kernel for TPU.],
    [Unlocked a 2× speedup on a whale customer's custom model through kernel fusions, smarter parallelism strategies, and better XLA scheduling.],
    [Optimized MLPerf DeepSeek-V3 training through Splash Attention opts and JAX MLA improvements (pairwise RoPE / data slicing); deep dived NaN-losses due to MoE load balancing issues.],
    [Cut Wan 2.1 397B diffusion step time 25% with Unified Sequence Parallelism (Ring Attention + DeepSpeed-Ulysses).],
    [Built and upstreamed a #link("https://github.com/AI-Hypercomputer/maxtext/pull/4834")[full mHC-lite Pallas TPU kernel], reaching up to 2x speedup vs pure JAX across five model families on Ironwood TPU.],
  ),
)

#projgroup(
  "C++ Performance Engineering - Tesseract Decoder (Quantum AI, 20%)",
  "2025 - Present",
  (
    [Achieved 5.6x speedup on d23 Surface Code through C++ code optimizations: cutting vector copies with linked lists, utilizing an arena allocator, compiler prefetching hints.],
    [Researched accelerator-native QEC decoding for both TPUs & GPUs; built a CUDA implementation for C++ reference decoder alongside TPU version and benchmarked on NVIDIA L4 vs TPU v5e.],
    [Upstreamed #link("https://github.com/quantumlib/tesseract-decoder/pulls?q=is%3Apr+is%3Amerged+author%3Adandragona")[three merged PRs]: C++ hot-path changes, pybind11 support for multiple detector error models, and generated Python type stubs.],
  ),
)

#projgroup(
  "Certificate Authority Infrastructure - Google Trust Services",
  "Sep 2024 - Apr 2026; Aug 2019 - Aug 2022",
  (
    [Fixed low-level CA bottlenecks: Go/C interop bugs, DB hotspot thrashing, network egress, DNS resolver latency],
    [Designed load-balancing for atypical network constraints; migrated C++ servers into secure, sensitive machine pools.],
    [Implemented ACME (RFC 8555), integrated performance testing frameworks, and hardened the C++ system for public release.],
    [Discovered and #link("https://groups.google.com/g/golang-announce/c/lVEm7llp0w0/m/VbafyRkgCgAJ?pli=1")[reported] a critical DoS vulnerability in Go/Crypto's DSA implementation.],
    [On-call, rollouts, and outage triage; supported WebTrust compliance audits and Key Destruction Ceremonies.],
  ),
)

#projgroup(
  "Google Research - Perception & Play Abuse",
  "2018 - 2019",
  (
    [Built a MapReduce ML pipeline (billions of points) for image-saliency prediction on a tuned ResNet U-Net.],
    [Developed multimodal ML infrastructure (C++) for abuse detection in Google Play, decoupling feature generation from inference.],
  ),
)

// =============================================================================
// EDUCATION
// =============================================================================

#section("Education")

#eduline(
  "M.S. Mathematics (GPA 3.93)",
  "Texas A&M University, College Station, TX",
  "Aug 2022 - Dec 2024",
)

#eduline(
  "B.S. Mathematics, Computational Sciences (GPA 3.71)",
  "University of Central Florida, Orlando, FL",
  "Aug 2013 - May 2018",
)
