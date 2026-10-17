# Résumé sources

Two independent résumé versions are maintained in this directory:

- **Current/live:** `resume-live.typ` -> `../output/pdf/daniel-mandragona-resume-current.pdf`
- **C++/JAX:** `resume-cpp-jax.typ` -> `../output/pdf/daniel-mandragona-resume-cpp-jax.pdf`

The website continues to link to the current version at
`https://dandragona.me/pdfs/resume.pdf`. The C++/JAX version is also published at
`https://dandragona.me/pdfs/resume-cpp-jax.pdf`, but changing it does not replace the live résumé.

## Build

```sh
brew install typst        # one-time
./build.sh                # current/live version
./build-cpp-jax.sh        # separate C++/JAX version
```

`build.sh` refreshes `public/pdfs/resume.pdf` and the legacy
`public/pdfs/danielmandragona.pdf` URL. `build-cpp-jax.sh` only refreshes
`public/pdfs/resume-cpp-jax.pdf`.

## Editing

Both Typst sources are self-contained. Content sits in plain `#projgroup(...)` and
`#skillrow(...)` calls; design knobs (accent colors, fonts, spacing) are the `#let`
variables near the top of each file.

- `accent` `#1A73E8` - brand blue (entry titles, links, icons, section rules)
- `deep` `#174EA6` - Google navy (name and section headers)
- `heading-font` `Google Sans` · `body-font` `Charter`

## Fonts

- **Font Awesome 6** (contact icons) - OFL, committed under `fonts/`.
- **Charter** - bundled with Typst, no file needed.
- **Google Sans** - Google's proprietary brand font, intentionally git-ignored.
  The build needs `GoogleSans-{Regular,Medium,Bold,Italic}.ttf` in `fonts/`.

## Verification

Both PDFs are US-Letter, one page, tagged, and single-column. Quick checks:

```sh
pdfinfo ../output/pdf/daniel-mandragona-resume-current.pdf | grep -E 'Pages|Page size|Tagged'
pdfinfo ../output/pdf/daniel-mandragona-resume-cpp-jax.pdf | grep -E 'Pages|Page size|Tagged'
pdftotext ../output/pdf/daniel-mandragona-resume-cpp-jax.pdf - | less
```
