## ADDED Requirements

### Requirement: Site is deployed via the official GitHub Actions Pages pipeline

The repository SHALL publish the Astro site to GitHub Pages using the GitHub-native Actions pipeline (`actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`), and the repository's Pages "Build and deployment" source MUST be set to GitHub Actions (`build_type: workflow`). The pipeline MUST NOT rely on GitHub's implicit "build from a branch" behavior or any Jekyll build stage.

#### Scenario: Push to main builds and deploys the artifact
- **WHEN** a commit is pushed to the `main` branch
- **THEN** the workflow runs `npm install` and `npm run build`, uploads `dist/` as the Pages artifact, and deploys it via `actions/deploy-pages`
- **AND** the workflow declares `permissions: pages: write` and `id-token: write`, uses the `github-pages` environment, and a `concurrency` group that prevents overlapping deploys

#### Scenario: Served output is the Astro build, not Jekyll
- **WHEN** `https://dandragona.me/` is fetched after a successful deploy
- **THEN** the response is the Astro-generated `index.html` (Astro `generator` meta, the "Daniel Mandragona / Software Engineer" hero, `/_astro/*` assets)
- **AND** the response MUST NOT contain a Jekyll `generator` meta tag or the GitHub Primer theme stub

### Requirement: All site routes serve over HTTPS on the custom domain

After deployment, the apex and every first-class Astro route SHALL return HTTP 200 over HTTPS on `dandragona.me`.

#### Scenario: Key routes return 200
- **WHEN** each of `/`, `/blog/`, `/blog/parallelism-roofline/`, `/blog/kelly-criterion/`, and `/links/` is requested over HTTPS on `dandragona.me`
- **THEN** each returns HTTP 200
- **AND** none returns 404

### Requirement: Custom domain persists across every deploy

The custom domain `dandragona.me` SHALL remain configured after every deploy without manual re-entry. The build artifact MUST include a `CNAME` file containing `dandragona.me`.

#### Scenario: CNAME ships inside the build artifact
- **WHEN** `npm run build` runs
- **THEN** `dist/CNAME` exists and its sole content is `dandragona.me`
- **AND** `CNAME` is sourced from `public/CNAME` (copied by Astro), not from the repository root

#### Scenario: Apex resolves to the custom domain after deploy
- **WHEN** `https://dandragona.me/` is requested after a deploy
- **THEN** it returns 200 served by GitHub Pages (no certificate or DNS error)

### Requirement: Canonical site URL matches the custom domain

`astro.config.mjs` `site` SHALL be `https://dandragona.me` so that canonical links, Open Graph URLs, and any generated absolute URLs reference the domain users actually visit.

#### Scenario: Generated canonical/OG URLs use the custom domain
- **WHEN** the site is built and a page that emits canonical or `og:url` metadata is inspected
- **THEN** those URLs are rooted at `https://dandragona.me`, not `https://dandragona.github.io`

### Requirement: Deployment is verified end-to-end after cutover

The change SHALL include a post-deploy verification that confirms the live site serves the current Astro build before the legacy `gh-pages` publish path is retired.

#### Scenario: Verification gate before retiring gh-pages
- **WHEN** the new Actions pipeline has run and the route checks above pass against the live `dandragona.me`
- **THEN** the vestigial `gh-pages` branch MAY be deleted
- **AND** until verification passes, `gh-pages` is retained so Pages source can be rolled back to the branch as a fallback
