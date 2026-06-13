# Superseded

This change's diagram requirements (11-step `FsdpBackward`, 6-step `TpBackward`, 5-step `FsdpTpBackward` with bespoke timeline and counter) were superseded by **`2026-05-25-simplify-fsdp-tp-backward-explanations`**, which rewrote the three components into delta-style ≤5-step widgets that defer to the DP backward subsection as the in-depth anchor.

Delta specs in this archive (`specs/parallelism-backward-viz/spec.md`) describe the now-superseded designs and were intentionally NOT synced into `openspec/specs/` during archive.
