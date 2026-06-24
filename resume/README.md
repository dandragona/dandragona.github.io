# Résumé source

Single-source résumé, typeset with [Typst](https://typst.app). This produces
`../public/pdfs/resume.pdf`, which the site serves at `https://dandragona.me/pdfs/resume.pdf`.

## Build

```sh
brew install typst        # one-time
./build.sh                # → ../public/pdfs/resume.pdf
```

## Editing

Everything lives in **`resume.typ`** — it's self-contained and readable. Content (roles,
bullets, talks, education, skills, publication) sits in plain `#role(...)` / `#talk(...)`
calls; design knobs (accent colors, fonts, spacing) are the `#let` variables at the top:

- `accent` `#1A73E8` — brand blue (entry titles, links, icons, section rules)
- `deep`   `#174EA6` — Google navy (name + section headers)
- `heading-font` `Google Sans` · `body-font` `Charter`

## Fonts

- **Font Awesome 6** (contact icons) — OFL, committed under `fonts/`.
- **Charter** — bundled with Typst, no file needed.
- **Google Sans** — Google's **proprietary** brand font, intentionally **git-ignored**
  (see `.gitignore`). The build needs `GoogleSans-{Regular,Medium,Bold,Italic}.ttf` in
  `fonts/`; the published PDF embeds only a subset, which is fine for a document. If the
  fonts are absent, either drop them into `fonts/` or change `heading-font` to a free
  alternative (e.g. `"Outfit"`).

## ATS / verification

The PDF is US-Letter, 2 pages, tagged, single-column. Quick parse check:

```sh
pdfinfo ../public/pdfs/resume.pdf | grep -E 'Pages|Page size|Tagged'
pdftotext ../public/pdfs/resume.pdf - | less   # confirm clean text + reading order
```
