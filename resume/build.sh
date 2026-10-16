#!/usr/bin/env bash
# Build the current/live résumé and refresh its two public URLs. The C++/JAX
# variant has its own source and build-cpp-jax.sh, so this command never changes it.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p ../output/pdf
typst compile --font-path fonts resume-live.typ ../output/pdf/daniel-mandragona-resume-current.pdf
cp ../output/pdf/daniel-mandragona-resume-current.pdf ../public/pdfs/resume.pdf
cp ../output/pdf/daniel-mandragona-resume-current.pdf ../public/pdfs/danielmandragona.pdf
echo "✓ built ../output/pdf/daniel-mandragona-resume-current.pdf"
echo "✓ refreshed ../public/pdfs/{resume,danielmandragona}.pdf"
