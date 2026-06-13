## 1. Repo changes

- [x] 1.1 Move the custom-domain file into the build: `git mv CNAME public/CNAME` (contents stay `dandragona.me`)
- [x] 1.2 Update `astro.config.mjs`: change `site` to `https://dandragona.me`
- [x] 1.3 Rewrite `.github/workflows/deploy.yml` to the official Pages pipeline (configure-pages → upload-pages-artifact → deploy-pages, with `pages: write` + `id-token: write` perms and a `pages` concurrency group)
- [x] 1.4 Verify build locally: `npm run build` exits 0 and `dist/CNAME` contains `dandragona.me` ✓

## 2. Enable GitHub Actions as the Pages source

- [x] 2.1 `gh api -X POST repos/dandragona/dandragona.github.io/pages -f build_type=workflow` — created the Pages site (it did NOT exist as a modern Pages object before — confirming the orphaned state)
- [x] 2.2 Read back: `build_type=workflow` ✓ (but `cname=null` — domain was not even registered)

## 3. Deploy

- [x] 3.1 Committed surgically with git (repo is not a jj repo; kept the in-progress parallelism edits out): commit `8ab5839`
- [x] 3.2 Pushed `main`
- [x] 3.3 Workflow run `27074973844` green (build + deploy)
- [ ] 3.4 **BLOCKED** — `gh api -X PUT .../pages -f cname=dandragona.me` returns **400 "custom domain already taken"**. The domain is held by an account-level/orphaned claim that is not on any repo (all repos checked, only `dandragona.github.io` has Pages, `cname=null`). No public API exists to release/verify a user-account domain → requires the owner to verify the domain in GitHub UI (see handoff).

## 4. Verify

- [x] 4.0 Canonical URL fully working: `https://dandragona.github.io/`, `/blog/`, `/blog/parallelism-roofline/`, `/links/` all 200, serving the Astro build (post renders with hydration islands)
- [ ] 4.1 All routes 200 over HTTPS on **dandragona.me** — blocked on 3.4
- [ ] 4.2 Apex on dandragona.me serves Astro (currently still stale Jekyll) — blocked on 3.4
- [ ] 4.3 (Optional) Playwright smoke test of the live custom-domain site

## 5. Cleanup

- [ ] 5.1 After dandragona.me verifies, delete vestigial `gh-pages` branch
- [ ] 5.2 Update README (still Astro-starter boilerplate) with the deploy mechanism note
- [ ] 5.3 (Nice-to-have) Bump workflow actions to Node 24-compatible versions (deprecation warning only)

## Handoff — release the stuck custom domain (owner action)

The site is fully deployed and live at `https://dandragona.github.io`. To point `dandragona.me` at it:

1. **Try the simple path first** — repo **Settings → Pages → "Custom domain"** → enter `dandragona.me` → Save. If it saves, done (tell me and I'll re-enable HTTPS + verify all routes).
2. **If it errors "already taken"** — go to **https://github.com/settings/pages → "Verified domains" → Add `dandragona.me`**. GitHub shows a TXT challenge. DNS already has `_github-pages-challenge-dandragona.dandragona.me = 70ab9e843ccda414d2f92f13b0bf31`; if GitHub's value matches, click **Verify**; if it differs, update that TXT at the registrar (NS = googledomains) then Verify. Then redo step 1.
3. Ping me once the domain is set and I'll finish: confirm `cname`, re-enable "Enforce HTTPS", and verify every route on `dandragona.me`.
