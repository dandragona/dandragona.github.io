## Context

`dandragona.github.io` is a static Astro 5 site (React + Three.js + Chart.js + KaTeX islands) deployed to GitHub Pages via `npm ci && npm run build` on Node 20. The repo currently has 28 open Dependabot alerts and a `npm audit` reporting 13 vulnerabilities. Nearly all originate from the Astro/Vite toolchain: `astro` itself (11 alerts), and its transitive deps `devalue`, `h3`, `vite`, `picomatch`, `postcss`, `rollup`, `esbuild`, `smol-toml`, `defu`, `diff`, `mdast-util-to-hast`, `js-yaml`.

Two observations shape the approach:
1. The direct deps are a full major behind (`astro` 5→6, `@astrojs/mdx` 4→6, `@astrojs/react` 4→5). A non-`--force` `npm audit fix` patches the transitive layer but leaves `astro` itself on 5.x, so the 11 astro advisories are only fully cleared by moving onto the current major.
2. The site is small and entirely static — there is no server runtime, auth, or middleware in production. Several flagged CVEs (Astro dev-server file-read, middleware auth-bypass, X-Forwarded-Host reflection) target the **dev server / SSR adapter**, which this static build does not ship. That bounds the real-world risk but the alerts should still be cleared so the dashboard is trustworthy and the toolchain stays supported.

## Goals / Non-Goals

**Goals:**
- Drive `npm audit` to 0 vulnerabilities and the repo Dependabot count to 0 (or document each residual).
- Move direct dependencies onto their current latest majors (`astro` 6, `@astrojs/mdx` 6, `@astrojs/react` 5) and refresh the rest.
- Keep the site byte-for-byte equivalent in behavior: same routes, same rendered output, same hydration islands.
- Confirm the build still passes under CI's Node 20.

**Non-Goals:**
- No page-content, styling, routing, or component-feature changes.
- No new tooling (no switch off npm, no monorepo, no Dependabot config rewrite).
- Not addressing the unrelated in-progress local edits to parallelism components.

## Decisions

### D1: Upgrade direct deps to latest major, then `npm audit fix` for the tail — rather than `npm audit fix --force` alone

`npm audit fix --force` resolves transitively but, as observed in the dry-run, only nudges `astro` to 5.18.2 (still flagged) and can pull unrelated packages to unexpected versions. Explicitly bumping the **direct** deps in `package.json` to their intended latest majors makes the upgrade legible and reproducible, gets `astro` onto the supported 6.x line, and lets a final `npm audit fix` mop up any transitive stragglers. Rationale: the manifest should state intent; the lockfile follows.

**Alternative considered:** non-`--force` `npm audit fix` only — rejected, leaves `astro` on 5.x so the 11 astro alerts persist.
**Alternative considered:** `--force` only — rejected, opaque and incompletely fixes astro.

### D2: Sequence the upgrade — Astro core + integrations together, validate, then the rest

Bump `astro`, `@astrojs/mdx`, `@astrojs/react` as one group (their majors are coupled via peer deps), run a build, fix any config/API breakage, then apply the lower-risk bumps (`three`, `katex`, `@react-three/*`, `chart.js`, `react-chartjs-2`, `react`/`react-dom`, `@types/*`) and `npm audit fix`. Isolating the high-risk majors makes any breakage easy to attribute.

### D3: Validate with a real build + render check, not just `npm audit`

`npm audit` proves the tree is patched; it does not prove the site still works after major bumps. Acceptance requires `npm run build` exit 0 plus a render check of all routes and the React/Three/Chart/KaTeX islands (per the `dependency-maintenance` spec). Where practical, preview the build (`npm run preview`) to confirm hydration.

### D4: Move CI to Node 22 — Astro 6 dropped Node 20

**Resolved during apply:** Astro 6.4.6 declares `engines.node >= 22.12.0`, so it does **not** run on Node 20 — the prior assumption was wrong. CI (`deploy.yml`) ran Node 20, so the upgraded build would fail there. Fix: bump `deploy.yml` `node-version` `20`→`22`. Local Node 26 (≥22.12) builds clean; the `main` CI run on Node 22 is the final gate, with one-commit rollback ready.

## Risks / Trade-offs

- **Astro 6 / `@astrojs/mdx` 6 / `@astrojs/react` 5 breaking changes** (config signatures, markdown plugin wiring, MDX behavior) → Mitigation: upgrade the integration group first and build immediately; consult each package's migration/CHANGELOG; the `astro.config.mjs` surface is tiny (integrations + remark/rehype math plugins), so the blast radius is small.
- **React 19.2 / `@astrojs/react` 5 / Three.js 0.184 API drift** breaking the interactive components (Bloch sphere, parallelism visualizers via `@react-three/fiber`/`drei`) → Mitigation: render-check every island; `@react-three/fiber` 9 and `drei` 10 already target React 19, and these are minor bumps within those majors.
- **`npm audit fix` introduces an incompatible transitive version** → Mitigation: run audit fix last, after the directed upgrades, then rebuild; if it breaks, pin the offending transitive via `overrides` or accept a documented residual.
- **A residual advisory has no patched release** → Mitigation: document it (package, severity, why unreachable in a static build) per the spec's residual scenario rather than blocking the whole change.
- **CI Node 20 builds even though local Node 26 did** mismatch → Mitigation: D4; gate on the `main` CI run and keep the prior `package-lock.json` for one-commit rollback.

## Migration Plan

1. Branch from `main` (repo is plain git, not the parent worktree).
2. Bump `astro`, `@astrojs/mdx`, `@astrojs/react` in `package.json` to latest; `npm install`; `npm run build`; fix config/API breakage.
3. Bump remaining direct deps to latest; `npm install`.
4. `npm audit fix`; regenerate `package-lock.json`.
5. `npm audit` → expect 0; `npm run build` → expect exit 0; render-check all routes + islands.
6. Commit `package.json` + `package-lock.json` (+ any `astro.config.mjs`/component fixes); push.
7. Confirm the deploy workflow run on `main` is green and Dependabot alerts drop to 0.

**Rollback:** revert the commit restoring the prior `package.json`/`package-lock.json`; `npm ci`; redeploy. The change is two committed files plus optional small source edits, so rollback is a single `git revert`.

## Open Questions

_All resolved during apply:_
- **MDX/math plugin wiring** — no change needed; `astro.config.mjs` `markdown.remarkPlugins`/`rehypePlugins` for `remark-math`/`rehype-katex` work unchanged on Astro 6 / `@astrojs/mdx` 6. The only code change required was `src/pages/blog.astro`: `Astro.glob()` was removed in Astro 6 → replaced with `import.meta.glob(..., { eager: true })`.
- **Astro advisories on latest 6.x** — fully cleared; no astro advisory remains. The only stubborn residual was `esbuild` (5 highs via `vite`, build-time only), resolved by an `overrides: { esbuild: "^0.28.1" }` pin. Final `npm audit`: **0 vulnerabilities, 0 residuals**.
