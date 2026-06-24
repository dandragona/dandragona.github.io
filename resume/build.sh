#!/usr/bin/env bash
# Build resume.pdf from the Typst source and drop it where the site serves it.
# Requires: `typst` (brew install typst) and the fonts in ./fonts (see README.md).
set -euo pipefail
cd "$(dirname "$0")"
typst compile --font-path fonts resume.typ ../public/pdfs/resume.pdf
echo "✓ built ../public/pdfs/resume.pdf"
