// =============================================================================
// Daniel Mandragona — Résumé
// Hand-authored Typst (no template package). Single-column, ATS-safe.
// Headings: Helvetica Neue · Body: Charter · Single accent: Google Blue.
// Contact icons: Font Awesome 6 (OTFs vendored in ./fonts — compile with --font-path fonts).
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

// Bullet list with tight spacing and a teal marker.
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

// One experience entry.
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

// =============================================================================
// HEADER
// =============================================================================

#block(width: 100%, {
  text(font: heading-font, weight: 700, size: 25pt, fill: deep, tracking: 0.2pt)[
    Daniel Mandragona
  ]
  v(3pt)
  text(font: heading-font, weight: 500, size: 10.5pt, fill: muted, tracking: 0.4pt)[
    ML Performance Engineer  #h(4pt) #text(fill: muted)[|] #h(4pt)  TPU kernels, parallelism & quantum information
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
  ]
})

#v(2pt)
#line(length: 100%, stroke: 1.4pt + accent)

// =============================================================================
// EXPERIENCE
// =============================================================================

#section("Experience")

#role(
  "Software Engineer, ML Performance Engineering (MaxText)",
  "Google", "Mountain View, CA", "Apr 2026 – Present",
  bullets((
    [Delivered a 40% speedup on a TPU Fast Fourier Transform (FFT) kernel for a customer engagement.],
    [Drove a 2× speedup on a state-of-the-art model for a strategic, high-priority customer via kernel fusions, parallelism strategies, and per-kernel tuning.],
    [Microbenchmarked the Splash Attention kernel, isolating bottlenecks to extract a further 10% speedup on an already heavily optimized kernel.],
    [Performance experimentation on the Wan 2.1 diffusion model, achieving a 25% speedup via Unified Sequence Parallelism (USP) — a hybrid long-context scheme combining Ring Attention and DeepSpeed-Ulysses sequence parallelism.],
    [Roofline analysis of Qwen 3.5 against next-generation TPU specifications, projecting achievable utilization and isolating compute- vs. memory-bound regimes to inform hardware/software co-design.],
    [Identified, researched, implemented, and benchmarked an mHC-lite optimization for DeepSeek V4 that sidesteps the costly iterative Sinkhorn algorithm used to generate doubly-stochastic expansion matrices.],
  )),
)

#role(
  "20% Research Engineer, Device Modeling & Optimization",
  "Google", "Mountain View, CA", "Mar 2025 – Sep 2025",
  bullets((
    [Signal processing and statistical modeling (e.g., peak-finding, Skew-Normal/GMM fitting) to identify and characterize Two-Level System (TLS) features in noisy qubit data.],
    [Researched adaptive TLS thresholding and created custom metrics to assess algorithm performance.],
    [Computer vision techniques for identifying stationary TLS features in heatmap data.],
    [Refined unsupervised learning algorithms through rigorous data analysis, employing statistical summaries and visualizations to enhance high-level feature understanding.],
  )),
)

#role(
  "Software Engineer, Certificate Authority Infrastructure",
  "Google", "Mountain View, CA", "Sep 2024 – Apr 2026  &  Aug 2019 – 2022",
  bullets((
    [Optimized Certificate Authority performance by diagnosing and resolving complex low-level issues, including Go/C interop bugs, database hotspot thrashing, network stack limitations (e.g., network egress), and DNS resolver latency.],
    [Designed and prototyped novel load balancing solutions for unique networking constraints, and implemented server migrations into highly sensitive & secure machine pools.],
    [Full-Lifecycle software development including implementing RFC security protocols (e.g., ACME RFC8555), building performance/integration testing frameworks, and ensuring system robustness for public release. Discovered and #link("https://groups.google.com/g/golang-announce/c/lVEm7llp0w0/m/VbafyRkgCgAJ?pli=1")[reported] a critical DoS vulnerability in Go/Crypto's DSA implementation.],
    [Held on-call responsibilities, managed rollouts, triaged outages, and contributed to datacenter compliance #link("https://cabforum.org/about/information/auditors-and-assessors/webtrust-for-cas/")[WebTrust] audits and Key Destruction Ceremonies.],
  )),
)

#role(
  "Software Engineer, Engineering Residency",
  "Google", "Mountain View, CA", "Sep 2018 – Aug 2019",
  bullets((
    [*Google Research — Perception:* Developed and optimized a large-scale ML pipeline, utilizing MapReduce to process billions of data points for Image Saliency Prediction. Performed hyperparameter tuning on a Resnet Unet model architecture, and implemented state-of-the-art metric functions for evaluation.],
    [*Android — Play Abuse:* Built multimodal ML infrastructure for Abuse Detection in the Google Play Store, decoupling feature generation from model inference.],
  )),
)

#role(
  "Research Collaborator",
  "FermiLab", "College Station, TX", "May 2024 – Oct 2024",
  bullets((
    [Researched quantum error correcting spherical codes for qudits, simulating them in Python using QuTiP, and benchmarking their error performance across various noise models.],
  )),
)

#role(
  "Teaching Assistant",
  "Texas A&M's Department of Mathematics", "College Station, TX", "Aug 2022 – Aug 2024",
  none,
)

#role(
  "Teaching Assistant for CS1",
  "UCF's Department of Computer Science", "Orlando, FL", "Aug 2017 – May 2018",
  none,
)

// =============================================================================
// EDUCATION
// =============================================================================

#section("Education")

#role(
  "Masters in Mathematics, GPA: 3.93",
  "Texas A&M University", "College Station, TX", "Aug 2022 – Dec 2024",
  bullets((
    [*Qualifying Exams Passed:* Real Analysis and Topology/Differential Geometry.],
  )),
)

#role(
  "BS Mathematics; Concentration in Computational Sciences, GPA: 3.71",
  "University of Central Florida", "Orlando, FL", "Aug 2013 – May 2018",
  bullets((
    [Honors in the Major.],
  )),
)

#role(
  "Quantum Information Science Summer School",
  "Oak Ridge National Laboratory, TN", "", "July 2024",
  block(below: 0pt, text(size: 9.4pt)[
    Focus on topological quantum computation, and quantum software tools.
  ]),
)

// =============================================================================
// TECHNICAL SKILLS
// =============================================================================

#section("Technical Skills")

#block(width: 100%, {
  set par(leading: 0.55em, spacing: 4pt)
  grid(
    columns: (auto, 1fr),
    column-gutter: 10pt,
    row-gutter: 4pt,
    text(font: heading-font, weight: 700, size: 9.4pt, fill: orgink)[Languages & Tools],
    [Python · C++ · Golang · Qiskit · MATLAB · C · Java · Mathematica · SQL],

    text(font: heading-font, weight: 700, size: 9.4pt, fill: orgink)[Coursework],
    [Quantum Algorithms · Spectral Theory for Schrödinger Operators · Real Analysis Sequence · Probability Theory · Physics for Mathematicians · Functional Analysis · Differential Geometry Sequence · Algebra Sequence],
  )
})

// =============================================================================
// PRESENTATIONS
// =============================================================================

#section("Presentations")

#let talk(title, venue, date, summary, url: none) = {
  block(breakable: false, below: 4.5pt, {
    lr(
      {
        let t = text(font: heading-font, weight: 700, size: 9.8pt, fill: accent)[#title]
        if url != none { link(url)[#t] } else { t }
        text(font: heading-font, size: 9pt, fill: muted)[  — #venue]
      },
      datestamp(date),
    )
    v(1pt)
    block(par(leading: 0.46em, text(size: 9.2pt)[#summary]))
  })
}

#talk(
  "QEC: From Classical Errors to the Surface Code",
  "Quantum AI, Google", "Oct 2025",
  [Presented fundamental classical and quantum error correction theory, starting with the Hamming Code and building up to the surface code for QEC.],
  url: "https://dandragona.me/pdfs/qec_slides.pdf",
)

#talk(
  "Berry Phase & Chern Numbers",
  "Master's Presentation, TAMU", "Nov 2024",
  [Mathematical foundations of Berry phase and Chern numbers, including their gauge invariance, discrete and continuous formulations, and applications in condensed matter physics. Implemented numerical methods to compute Chern numbers for topological systems, reproducing results from published research.],
  url: "https://dandragona.me/pdfs/berry.pdf",
)

#talk(
  "Quantum Markov Chains",
  "Quantum Algorithms, CSCE 640 – TAMU", "Nov 2023",
  [Presented basic theory of Markov chains, and how the proposed Quantization scheme outlined by Szegedy leads mathematically to a quadratic speedup in convergence to the stationary distribution over the classical version. Includes a further description of the quantization of the Monte Carlo Metropolis-Hastings algorithm.],
  url: "https://dandragona.me/pdfs/qmcmh.pdf",
)

#talk(
  "Weyl Quantization Lecture",
  "Topics in Physics for Mathematicians, MATH 689 – TAMU", "Dec 2023",
  [Presented the mathematical theory for converting classical phase-space $L^2(bb(R)^(2n))$-observables to be self-adjoint operators on a quantum Hilbert space.],
  url: "https://dandragona.me/pdfs/weyl_quant.pdf",
)

#talk(
  "Visual Saliency Prediction",
  "Perception Research Showcase, Google", "Mar 2019",
  [Presented the topic of image saliency and its motivations, and the ML infrastructure my team used for prediction and evaluation.],
)

#talk(
  "Functional Programming",
  "Engineering Residency Program, Google", "Oct 2018",
  [Taught Engineering Residency cohort about functional programming fundamentals such as functors and monads in the context of the Haskell programming language.],
)

#talk(
  "Hopf Bifurcation Analysis",
  "Undergraduate Research Excellence Showcase, UCF", "Apr 2018",
  [Conducted Hopf bifurcation research in a system of ODEs arising from a chemical reactor model. Utilized Mathematica software to perform the necessary symbolic computations for this analysis.],
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
