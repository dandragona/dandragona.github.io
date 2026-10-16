#!/usr/bin/env bash
# Build the C++/JAX résumé variant without replacing the current/live résumé.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p ../output/pdf
typst compile --font-path fonts resume-cpp-jax.typ ../output/pdf/daniel-mandragona-resume-cpp-jax.pdf
cp ../output/pdf/daniel-mandragona-resume-cpp-jax.pdf ../public/pdfs/resume-cpp-jax.pdf
echo "✓ built ../output/pdf/daniel-mandragona-resume-cpp-jax.pdf"
echo "✓ refreshed ../public/pdfs/resume-cpp-jax.pdf"
