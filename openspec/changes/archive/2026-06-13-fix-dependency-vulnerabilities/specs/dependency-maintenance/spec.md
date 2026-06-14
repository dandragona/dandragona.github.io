## ADDED Requirements

### Requirement: Dependency tree is free of known vulnerabilities

The project's npm dependency tree MUST NOT carry known security vulnerabilities of moderate severity or higher. After any dependency change, `npm audit` SHALL report zero vulnerabilities, OR every remaining advisory SHALL be explicitly documented (in the change's tasks/design) as unfixable-at-this-time or not-applicable, with the reason recorded.

#### Scenario: Audit is clean after an upgrade

- **WHEN** dependencies are upgraded and `package-lock.json` is regenerated
- **THEN** `npm audit` exits reporting 0 vulnerabilities
- **AND** the repository's open Dependabot alert count is 0 (or only documented residuals remain)

#### Scenario: A residual advisory cannot be patched

- **WHEN** `npm audit` still flags a package after the latest compatible fix is applied
- **THEN** the residual advisory is recorded with its package, severity, and the reason it cannot be resolved (no patched release, or not reachable in the build)
- **AND** no undocumented moderate-or-higher advisory remains

### Requirement: Direct dependencies stay on supported versions

Direct dependencies declared in `package.json` MUST NOT lag the latest published release by a whole major version without a recorded reason. When an upgrade is performed, each direct dependency SHALL be moved to its current latest major unless a documented constraint (peer-dependency conflict, known regression) prevents it.

#### Scenario: Direct deps are current after an upgrade

- **WHEN** the dependency-refresh change is applied
- **THEN** `astro`, `@astrojs/mdx`, and `@astrojs/react` are on their latest major releases
- **AND** any direct dependency intentionally held back is listed with the blocking reason

### Requirement: Upgrades are validated before they ship

A dependency change MUST NOT be considered complete until the site is proven to still build and render. Validation SHALL include a clean production build and a render check of every route and hydration island.

#### Scenario: Build and render pass on the upgraded toolchain

- **WHEN** dependencies have been upgraded and the lockfile regenerated
- **THEN** `npm run build` exits 0
- **AND** the routes `/`, `/blog/`, `/blog/parallelism-roofline/`, `/blog/kelly-criterion/`, and `/links/` render without error
- **AND** the React / Three.js / Chart.js / KaTeX hydration islands mount and display correctly

#### Scenario: Upgraded build is verified under the CI Node version

- **WHEN** the upgraded toolchain is validated
- **THEN** the build is confirmed to succeed under the Node version used by `.github/workflows/deploy.yml` (Node 20), not only the local Node version
