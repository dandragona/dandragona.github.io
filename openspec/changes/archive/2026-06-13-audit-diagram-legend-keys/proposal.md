## Why

Several interactive diagrams in the parallelism post render a fixed legend ("key") that is shared across multiple diagram variants, so the key lists swatches that never appear in the diagram the reader is looking at. For example, the FSDP forward diagram shows "replicated" and "partial sum" in its key, but neither swatch is ever drawn for FSDP. A key that names colors the reader can't find undermines trust in the visual and adds noise to exactly the moment the reader is trying to decode the picture.

## What Changes

- Audit every diagram in the parallelism post that renders a swatch key, and make each key list **only** the items actually drawn in that diagram.
- `ShardingStage` — the legend is one fixed 5-item list reused for `dp`/`fsdp`/`tp`/`cp`. Make it derive from the active strategy:
  - `replicated` (gray `#9ca3af`) is **never rendered in any strategy** (the `REPLICATED` constant is unused in cell fills; replicated W is drawn yellow). Remove it, or wire the color through so it actually renders where W is replicated.
  - `partial sum` (stripes) is rendered only in `tp`; drop it from `dp`/`fsdp`/`cp`.
  - `materialized` (yellow) is rendered in `dp`/`fsdp`/`cp` but not `tp`; in `dp`/`cp` the yellow is replicated W, not a materialized gather — relabel or split so the swatch's meaning matches the strategy.
  - The `elsewhere` swatch color (`rgba(31,41,55,0.15)`) does not match the actual absent-cell color (`rgba(0,0,0,0.08)`); align them.
- `CollectivePrimer` — one legend sits above all four collective panels. The `all-gather` panel has no partial sums and no fully-reduced yellow, yet the shared key lists both. Scope key items to the panels in which they appear (per-panel key, or a key that only shows universally-present items with per-panel additions).
- Diagrams that describe their color convention in prose subtitles/captions rather than a swatch key (`TpStaircase`, `CpStaircase`, `CpUlysses`, `EpRouting`, and the `*Backward` widgets) — verify the prose color claims match the rendered colors; correct any drift found. No swatch-key changes expected here.
- `OverlapTimeline` — its key (compute = solid, communication = dashed) applies to every strategy; confirm and leave as-is.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `parallelism-roofline-post`: add a requirement that every diagram's legend/key lists only the swatches drawn in that specific diagram variant, and that prose color descriptions match rendered colors.

## Impact

- `src/components/parallelism/ShardingStage.jsx` (legend derivation, color constants)
- `src/components/parallelism/CollectivePrimer.jsx` (per-panel legend scoping)
- Verification-only (likely no code change): `OverlapTimeline.jsx`, `TpStaircase.jsx`, `CpStaircase.jsx`, `CpUlysses.jsx`, `EpRouting.jsx`, `DpBackward.jsx`, `FsdpBackward.jsx`, `TpBackward.jsx`, `CpBackward.jsx`, `EpBackward.jsx`
- No content/prose changes to `src/pages/blog/parallelism-roofline.mdx` expected; component call sites stay the same.
- Visual-only change; no behavior, routing, or build-config impact.
