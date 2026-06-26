#!/usr/bin/env bash
# Build the résumé PDF from the Typst source and drop it where the site serves it.
# The Links page (src/pages/links.astro) links to /pdfs/danielmandragona.pdf, so that
# is the output path the site expects. Requires: `typst` (brew install typst) and the
# fonts in ./fonts (see README.md).
set -euo pipefail
cd "$(dirname "$0")"
typst compile --font-path fonts resume-v3.typ ../public/pdfs/danielmandragona.pdf
echo "✓ built ../public/pdfs/danielmandragona.pdf"
