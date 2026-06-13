## Context

The site is an Astro 5 static build (`npm run build` → `dist/`) for the user-site repo `dandragona/dandragona.github.io`, served at the custom domain `dandragona.me`.

Observed live state (diagnosed 2026-06-06):

| URL | Status | Served by |
| --- | --- | --- |
| `https://dandragona.me/` | 200 | **Jekyll** (Primer theme, stale stub) |
| `https://dandragona.me/blog/` | 404 | — |
| `https://dandragona.me/blog/parallelism-roofline/` | 404 | — |
| `https://dandragona.me/links/` | 404 | — |
| `https://dandragona.github.io/` | 404 | — |

Key findings:
- The `gh-pages` branch (HEAD `d7917d9`) contains a **correct** Astro build: `index.html`, `blog/index.html`, `blog/parallelism-roofline/index.html`, `links/index.html`, `_astro/*`, `pdfs/*`, and a `.nojekyll` marker. So the build/publish-to-branch step works.
- `GET /repos/dandragona/dandragona.github.io/pages` and `/pages/builds/latest` both return **404** even though the token is admin with `repo` scope → the Pages site is in a broken/orphaned configuration and is **not** wired to serve `gh-pages`.
- `npm run build` on the current working tree succeeds (exit 0); the apex page being served carries `<meta name="generator" content="Jekyll v3.10.0">` and the GitHub Primer theme markup — i.e., a cached legacy build, not today's Astro output.

The existing pipeline (`peaceiris/actions-gh-pages@v3` pushing `./dist` to `gh-pages`) relies on GitHub's implicit "build from branch" behavior, which has stopped functioning. We need a deploy path that GitHub explicitly drives end-to-end.

## Goals / Non-Goals

**Goals:**
- Restore `dandragona.me` so the apex and all Astro routes (`/blog/`, `/blog/parallelism-roofline/`, `/blog/kelly-criterion/`, `/links/`) serve the current Astro build over HTTPS.
- Make deployment deterministic and self-contained: a push to `main` builds and publishes the exact `dist/` artifact, with no dependency on branch-build inference or Jekyll.
- Make the custom domain survive every deploy (no manual re-entry).
- Prevent recurrence: remove the fragile/implicit pieces (Jekyll, branch-build, root-level `CNAME` that never reaches `dist`).

**Non-Goals:**
- No changes to page content or the in-progress parallelism component edits (out of scope; those stay uncommitted/separate).
- No DNS/registrar changes — the apex already resolves to GitHub Pages and serves; only the Pages *source* is broken.
- No move off GitHub Pages to another host (Netlify/Vercel/Cloudflare).

## Decisions

### Decision 1: Use the official GitHub Actions Pages pipeline (source = "GitHub Actions")
Adopt `actions/configure-pages` → `actions/upload-pages-artifact` (pointing at `dist/`) → `actions/deploy-pages`, with `permissions: { pages: write, id-token: write }`, `contents: read`, a `github-pages` environment, and a `concurrency` group. Set the repo's Pages **build_type to `workflow`**.

- **Why:** GitHub itself ingests and serves the uploaded artifact; there is no implicit branch build and no Jekyll stage, so the failure mode we hit cannot recur. This is the current GitHub-recommended approach for Astro on Pages.
- **Alternatives considered:**
  - *Just repoint Pages source back to the `gh-pages` branch* (keep `peaceiris`). Smaller diff, but keeps us on the exact implicit-branch-build mechanism that silently broke, and the Pages API is currently 404-ing, so re-enabling cleanly is uncertain. Documented as the fallback in the Migration Plan.
  - *Switch hosts (Netlify/Vercel).* Overkill; requires DNS changes and a new account/integration for a problem that is a misconfigured Pages source.

### Decision 2: Move `CNAME` into `public/`
Relocate `CNAME` (contents `dandragona.me`) from repo root to `public/CNAME` so Astro copies it into `dist/` (and therefore into the uploaded artifact) on every build.

- **Why:** Today `CNAME` lives at repo root and is never copied into `dist` (confirmed absent from `dist/` and from the `gh-pages` tree). With artifact-based deploys, the custom domain is most robustly asserted by shipping `CNAME` inside the artifact, so it can never be dropped on a deploy.
- **Alternative considered:** Rely solely on the Pages "custom domain" setting. Works, but is invisible in the repo and easy to lose during config churn — exactly the class of failure we are fixing. Shipping `CNAME` in the artifact is belt-and-suspenders.

### Decision 3: Set `astro.config.mjs` `site` to `https://dandragona.me`
Change `site` from `https://dandragona.github.io` to the real custom domain.

- **Why:** `site` drives canonical URLs, Open Graph/`og:url`, and any sitemap/absolute-link generation; it should match the domain users actually hit. Base path is unchanged (`/`) since this is a user-site served at the domain root, so no internal links break.
- **Alternative considered:** Leave as-is. Harmless for routing but produces wrong canonical/OG URLs pointing at `dandragona.github.io`.

### Decision 4: Retire the `gh-pages` branch after cutover
Once the Actions pipeline is confirmed serving, the `gh-pages` branch is vestigial. Leave it in place during cutover (cheap rollback), delete only after verification.

## Risks / Trade-offs

- **[Pages API currently 404s — enabling `build_type: workflow` may need the right call]** → Try `actions/configure-pages` with `enablement: true` first (it can create/enable the site). If that fails in CI, enable explicitly via `gh api -X POST repos/dandragona/dandragona.github.io/pages -f build_type=workflow` (or repo Settings → Pages → Source: GitHub Actions) before re-running the workflow. The user is repo admin, so both paths are available.
- **[Custom domain temporarily drops during source switch]** → `CNAME` shipped in the artifact (Decision 2) plus re-asserting the domain in settings minimizes the window; verification step explicitly checks the apex over HTTPS.
- **[HTTPS certificate re-provisioning lag]** → Switching Pages source can re-trigger Let's Encrypt provisioning for the custom domain (minutes, occasionally up to ~an hour). Verification polls until HTTPS returns 200 rather than assuming instant.
- **[Stale CDN cache keeps serving the old Jekyll page]** → Pages cache TTL is ~10 min (`cache-control: max-age=600`); verification accounts for this and confirms the *Astro* markup (not just a 200) on the apex.
- **[Trade-off: artifact deploy abandons the `gh-pages` branch history]** → Acceptable; the branch is a build output, not source. Kept until verified, then removable.

## Migration Plan

1. Land the repo changes on `main`: new `.github/workflows/deploy.yml`, `public/CNAME`, `astro.config.mjs` `site` update, remove root `CNAME`.
2. Ensure Pages source = GitHub Actions (`build_type: workflow`) — via `actions/configure-pages` in the workflow and/or the `gh api` enablement call.
3. Push to `main`; the workflow builds `dist/` and deploys the artifact.
4. Re-assert the custom domain (`dandragona.me`) in Pages settings if it was cleared.
5. Verify: apex + `/blog/` + `/blog/parallelism-roofline/` + `/blog/kelly-criterion/` + `/links/` all return 200 over HTTPS and the apex returns Astro markup (no Jekyll `generator` meta).
6. After verification, delete the now-vestigial `gh-pages` branch.

**Rollback:** If the Actions deploy regresses serving, set Pages source back to "Deploy from a branch → `gh-pages` / root" (the branch still holds the last-known-good Astro build) and revert the workflow commit.

## Open Questions

- Did the Pages source get switched manually, or did GitHub auto-disable/orphan it? Not required for the fix, but if the former, confirm no automation re-flips it.
- Should `gh-pages` be deleted immediately after verification or kept one release cycle as a safety net? (Lean: keep ~1 cycle.)
