## 1. Baseline & branch

- [x] 1.1 Branch from `main` in `dandragona.github.io` (plain git repo): `git switch -c fix-dependency-vulnerabilities`
- [x] 1.2 Record the starting state for comparison: `npm audit` (expect 13 vulns) and `gh api repos/dandragona/dandragona.github.io/dependabot/alerts --jq '[.[]|select(.state=="open")]|length'` (expect 28)
- [x] 1.3 Confirm a clean baseline build: `npm ci && npm run build` exits 0

## 2. Upgrade Astro core + integrations (high-risk majors)

- [x] 2.1 Bump in `package.json` to latest major: `astro` (→6), `@astrojs/mdx` (→6), `@astrojs/react` (→5)
- [x] 2.2 `npm install` to resolve peers and regenerate the lockfile for this group
- [x] 2.3 `npm run build`; if it fails, fix `astro.config.mjs` (integration signatures, `markdown.remarkPlugins`/`rehypePlugins` wiring for `remark-math`/`rehype-katex`) per Astro 6 / MDX 6 migration notes until the build exits 0
- [x] 2.4 Resolve any `@astrojs/react` 5 breakage in `src/components/**` islands surfaced by the build

## 3. Upgrade remaining direct deps (low-risk)

- [x] 3.1 Bump to latest: `three` (→0.184), `katex` (→0.16.47), `@react-three/drei`, `@react-three/fiber`, `chart.js`, `react-chartjs-2`, `react`, `react-dom`, `@types/react`, `@types/react-dom`
- [x] 3.2 `npm install`; `npm run build` exits 0

## 4. Clear the transitive tail

- [x] 4.1 `npm audit fix` to patch remaining transitive deps (`devalue`, `h3`, `vite`, `picomatch`, `postcss`, `defu`, `smol-toml`, `rollup`, `diff`, `mdast-util-to-hast`, `js-yaml`, `esbuild`); regenerate `package-lock.json`
- [x] 4.2 `npm audit` → **0 vulnerabilities**. **0 residuals** — all 28 alerts / 13 vulns cleared. Note: `npm audit fix --force` was deliberately NOT used (it would have *downgraded* astro→2.4.5, @astrojs/react→3.6.2, @astrojs/mdx→0.19.7).
- [x] 4.3 Pinned `esbuild` to `^0.28.1` via `overrides` in `package.json` — the 5 residual `esbuild` highs (reached only transitively through `vite` at build time) had no fix inside vite's declared `^0.27.0` range; 0.28.1 is the first patched release. Verified the build still works with the override.

## 5. Validate the upgraded build (per dependency-maintenance spec)

- [x] 5.1 `npm run build` exits 0 on the fully upgraded tree (also verified via `npm ci` clean install, mirroring CI)
- [x] 5.2 Render-check: all 5 routes built; `/blog/` lists both posts (titles/descriptions/URLs correct after the `Astro.glob` → `import.meta.glob` fix); `/`, `/links/` render
- [x] 5.3 Hydration islands present in built HTML: `astro-island` markers on `/` and blog posts, 21 client JS chunks emitted (React/Three.js/Chart.js), KaTeX math rendered (274 nodes in the parallelism post)
- [x] 5.4 **Design deviation:** Astro 6 requires Node `>=22.12.0`, so it would FAIL on CI's Node 20. Bumped `.github/workflows/deploy.yml` `node-version` `20`→`22`. Local Node 26 (≥22.12) builds clean; the post-merge CI run on Node 22 is the final gate.

## 6. Ship & confirm

- [ ] 6.1 Commit `package.json`, `package-lock.json`, and any `astro.config.mjs`/component fixes
- [ ] 6.2 Push and open/merge to `main`; confirm the `deploy.yml` workflow run is green (`npm ci` + `npm run build` + Pages deploy)
- [ ] 6.3 Confirm the live site still serves all routes and islands after deploy
- [ ] 6.4 Re-check Dependabot: open alert count is **0** (or only the documented residuals from 4.2 remain)
- [ ] 6.5 Keep the prior lockfile recoverable for one-commit rollback (`git revert`) if CI or the live site regresses
