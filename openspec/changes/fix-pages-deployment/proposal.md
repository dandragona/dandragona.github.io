## Why

`dandragona.me` is broken: the apex `/` returns an ancient cached **Jekyll** build (GitHub's default Primer theme rendering a stale `# dandragona.me / Daniel Mandragona. Software Engineer. Blog Links.` stub), while every real Astro route — `/blog/`, `/blog/parallelism-roofline/`, `/links/` — returns **404**. The correct Astro build is being published to the `gh-pages` branch on every push, but GitHub Pages is in a broken/orphaned configuration (`GET /repos/.../pages` and `/pages/builds/latest` both return 404 despite admin access), so it is **not** serving that branch. The current `peaceiris/actions-gh-pages` pipeline is fragile and depends on GitHub's implicit branch-build behavior, which has silently stopped working.

## What Changes

- Replace the `peaceiris/actions-gh-pages` deploy workflow with the official GitHub-recommended Pages pipeline (`actions/configure-pages` → `actions/upload-pages-artifact` → `actions/deploy-pages`), which deploys the built artifact directly and bypasses Jekyll entirely.
- Switch the repository's GitHub Pages **source to "GitHub Actions"** (`build_type: workflow`) so the artifact uploaded by the workflow is what gets served — eliminating the dependence on the broken branch-build path. **BREAKING** to the deploy mechanism (the `gh-pages` branch is no longer the publish target).
- Ensure the **custom domain persists**: move `CNAME` (`dandragona.me`) into `public/` so Astro copies it into `dist`/the artifact on every build, and (re)assert the custom domain in Pages settings.
- Fix `astro.config.mjs` `site` from `https://dandragona.github.io` to `https://dandragona.me` so canonical URLs, Open Graph URLs, and any generated absolute links match the real domain.
- Verify the restored site end-to-end (apex + `/blog/` + `/blog/parallelism-roofline/` + `/links/` all return 200 over HTTPS on the custom domain).

## Capabilities

### New Capabilities
- `site-deployment`: How the Astro site is built in CI and published to GitHub Pages on the `dandragona.me` custom domain — the source/build-type contract, the artifact contents (including `CNAME` and `.nojekyll`-equivalent Jekyll bypass), and the post-deploy verification that confirms all routes serve.

### Modified Capabilities
<!-- No existing spec's requirements change; this is purely about build/publish, not page content. -->

## Impact

- **CI/CD**: `.github/workflows/deploy.yml` rewritten; required `permissions` (`pages: write`, `id-token: write`) and `concurrency` added.
- **Repo files**: `CNAME` relocated from repo root to `public/CNAME`; `astro.config.mjs` `site` value updated.
- **GitHub settings**: Pages "Build and deployment" source changed to GitHub Actions; custom domain re-asserted. Requires one admin API/UI action (`gh api` or repo Settings → Pages).
- **Branches**: `gh-pages` becomes vestigial (can be deleted after the new pipeline is confirmed serving).
- **No application/page-content code changes**; the in-progress local edits to the parallelism components are unrelated and out of scope for this change.
