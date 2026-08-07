## 1. Audit (record findings before editing)

- [x] 1.1 For each `ShardingStage` strategy (`dp`, `fsdp`, `tp`, `cp`), step through every toggle state and list which swatches `getFills` actually renders; confirm the truth table in design Decision 1. (Confirmed: dp/cp → shard, yellow W, absent; fsdp → shard, yellow W after gather, absent; tp → shard, striped partial-sum, absent. Gray `REPLICATED` never rendered anywhere.)
- [x] 1.2 For each `CollectivePrimer` panel, list which swatches its cells render across all steps; confirm all-gather uses neither "partial sum" nor "fully reduced". (Confirmed: all-gather → chip data + empty only; reduce-scatter/all-reduce → also partial-sum + fully-reduced yellow.)
- [x] 1.3 Read each prose-key widget's subtitle/caption (`TpStaircase`, `CpStaircase`, `CpUlysses`, `EpRouting`, `DpBackward`, `FsdpBackward`, `TpBackward`, `CpBackward`, `EpBackward`) and note every color it names vs. what the diagram renders; flag any mismatch. (No mismatches; all use the shared yellow-ring/stripe/chip-color convention. Surfaced post-wide "yellow = full W" convention from `DpBackward` → drives Decision 2b.)
- [x] 1.4 Confirm `OverlapTimeline`'s key (compute solid / comm dashed) applies to all of its strategies; no change expected. (Confirmed universal; no change.)

## 2. ShardingStage legend

- [x] 2.1 Add a per-strategy legend descriptor (set of swatch keys from `{shard, replicated, materialized, partialSum, elsewhere}`) sourced from the same predicates `getFills` uses. (Added `legend` array to each `STRATEGIES` entry + `SWATCHES` map.)
- [x] 2.2 Replace the fixed 5-item legend block with one that renders only the active strategy's swatch keys, mapping each key to its `{color, label}`. (`cfg.legend.map(...)`.)
- [x] 2.3 Resolve the yellow overload (design Decision 2). (Took **2b**: removed the never-rendered gray `REPLICATED` constant, kept W yellow, labeled per strategy — `replicated` for dp/cp, `materialized` for fsdp — preserving the post-wide "yellow = full W" convention.)
- [x] 2.4 Point the "elsewhere" legend swatch at the `ABSENT` constant so it matches absent cells. (`SWATCHES.elsewhere.color = ABSENT`.)
- [x] 2.5 Verify each of the four `ShardingStage` renders: every legend item is visible somewhere in that diagram, and every meaningful swatch in the diagram is in the legend. (Traced `getFills` per strategy against `cfg.legend` — exact match for dp/fsdp/tp/cp.)

## 3. CollectivePrimer legend

- [x] 3.1 Parameterize the existing `Legend`/`Item` components to render only a given set of swatch keys. (`Legend({ keys })` + `LEGEND_ITEMS` registry; extracted `SolidSwatch`/`PartialSwatch`.)
- [x] 3.2 Give each `CollectivePanel` a scoped key, replacing the single shared `<Legend />`. (AG → `['solid','empty']`; RS/AR → `['partial1','partialMulti','summed','empty']`; A2A → `['solid']`.)
- [x] 3.3 Verify each panel's key matches its rendered cells across all steps. (Traced each `slotsFn`'s emitted slot kinds against `legendKeys` — AG=solid/absent, RS/AR=multi/summed/absent, A2A=solid; all match.)

## 4. Prose-key diagrams

- [x] 4.1 Apply fixes for any subtitle/caption color mismatch found in 1.3; if none, record "verified, no change". (Verified — no mismatch; the prose-key widgets all use the shared yellow-ring/stripe/chip-color convention correctly. No change.)

## 5. Verification

- [x] 5.1 Confirm key↔diagram agreement in the rendered output. (Browser verification hit a PRE-EXISTING dev-server bug — `TypeError: jsxDEV is not a function`, which also breaks the untouched `OverlapTimeline` island, i.e. unrelated to this change and an Astro/React dev-runtime issue. Verified instead against the production build artifact `dist/blog/parallelism-roofline/index.html`: parsed each `ShardingStage` legend — DP=[shard,replicated,elsewhere], FSDP=[shard,materialized,elsewhere], TP=[shard,partial sum,elsewhere], CP=[shard,replicated,elsewhere]; `elsewhere` appears exactly 4× total. Matches the design exactly.)
- [x] 5.2 Run the production build (`npm run build`) to confirm no regressions. (Build passed: 5 pages built, no errors.)
