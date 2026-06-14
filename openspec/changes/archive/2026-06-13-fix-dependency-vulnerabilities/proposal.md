## Why

The repo has **28 open Dependabot alerts** (10 high, 18 medium, 8 low) and a `npm audit` reporting **13 vulnerabilities** (8 high, 4 moderate, 1 low) — all flowing through the Astro/Vite build toolchain: `astro` (11 alerts incl. multiple XSS / auth-bypass / arbitrary-file-read CVEs), `devalue` (6, prototype-pollution + DoS), `h3` (5, path-traversal + request-smuggling), `picomatch` (4), `vite` (3), plus `postcss`, `defu`, `smol-toml`, `rollup`, `diff`, `mdast-util-to-hast`, and `js-yaml`. On top of that, the direct dependencies are **stale by whole majors** — `astro` 5.14.1→6.x, `@astrojs/mdx` 4.3.6→6.x, `@astrojs/react` 4.4.0→5.x — which is both the root cause of most alerts and an accruing upgrade/maintenance debt. Fixing now clears the security backlog and gets the toolchain back onto supported, non-deprecated versions before the gap widens further.

## What Changes

- Upgrade every **direct dependency** to its current latest release: `astro` 5→6, `@astrojs/mdx` 4→6, `@astrojs/react` 4→5, plus `three` 0.180→0.184, `katex` 0.16.22→0.16.47, and minor/patch bumps for `@react-three/drei`, `@react-three/fiber`, `chart.js`, `react-chartjs-2`, `react`, `react-dom`, `@types/react`, `@types/react-dom`. **BREAKING** at the dependency level: `astro` 6, `@astrojs/mdx` 6, and `@astrojs/react` 5 are major bumps — config/API surface (e.g. `astro.config.mjs` integrations, MDX/markdown plugin wiring) must be re-validated, though no end-user page behavior should change.
- Run `npm audit fix` to pull the remaining **transitive** packages (`devalue`, `h3`, `vite`, `picomatch`, `postcss`, `defu`, `smol-toml`, `rollup`, `diff`, `mdast-util-to-hast`, `js-yaml`, `esbuild`) onto patched versions, regenerating `package-lock.json`.
- Verify the result: `npm audit` reports **0 vulnerabilities** (or each residual is documented as unfixable/not-applicable), `npm run build` exits 0, and the built site (`/`, `/blog/`, `/blog/parallelism-roofline/`, `/blog/kelly-criterion/`, `/links/`, and the React/Three/Chart/KaTeX islands) renders correctly.
- Confirm the Dependabot alert count on the repo drops to 0 (or only documented residuals remain) after the fix lands on `main`.

## Capabilities

### New Capabilities
- `dependency-maintenance`: The policy and verification contract for keeping the site's npm dependency tree free of known vulnerabilities and on supported (non-deprecated) versions — what "healthy" means (`npm audit` clean, no whole-major staleness on direct deps, Dependabot alerts at 0), and how an upgrade is validated (build passes, all routes + hydration islands render) before it ships.

### Modified Capabilities
<!-- No existing spec's requirements change. This is a non-functional / maintenance change: the site's pages and behavior are unchanged; only the dependency versions backing the build move. -->

## Impact

- **Manifest/lockfile**: `package.json` dependency ranges bumped; `package-lock.json` fully regenerated.
- **Build config**: `astro.config.mjs` re-validated against Astro 6 / `@astrojs/mdx` 6 / `@astrojs/react` 5 APIs (integration signatures, `markdown.remarkPlugins`/`rehypePlugins` wiring); adjusted only if the majors require it.
- **Source components**: React 19 / `@astrojs/react` 5 and `three` 0.184 / `@react-three/*` may surface breaking API changes used by `src/components/**` (Bloch sphere, parallelism visualizers, Chart.js + KaTeX usage) — re-verified via build + render check.
- **CI/CD**: `.github/workflows/deploy.yml` (`npm ci` → `npm run build`) must stay green; Node 20 in CI vs. local Node 26 — confirm the upgraded toolchain builds under Node 20.
- **No page-content or routing changes**; this is purely a dependency/security refresh. Unrelated in-progress local edits to parallelism components are out of scope.
- **Outcome**: repo Dependabot alert count 28 → 0; `npm audit` 13 → 0 vulnerabilities.
