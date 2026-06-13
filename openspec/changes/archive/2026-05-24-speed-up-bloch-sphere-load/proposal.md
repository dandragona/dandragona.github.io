## Why

The Bloch sphere on the homepage is loaded with `client:load`, which forces the browser to download and hydrate the entire React Three Fiber + drei + Three.js bundle before the page becomes interactive. Most of that weight (especially `drei`'s `Text` component, which pulls in `troika-three-text` and an SDF font atlas) is not needed for a first paint, so the homepage's perceived load time and time-to-interactive are heavier than they need to be.

## What Changes

- Defer Bloch sphere hydration from `client:load` to `client:visible` so the homepage paints and the intro card becomes interactive before the 3D scene's bundle is fetched/parsed/hydrated.
- Replace the heavy `import * as THREE` with named imports of only what is needed (`Color`) so bundlers can tree-shake unused Three.js modules.
- Render a lightweight CSS placeholder behind the canvas so the layout does not shift while the 3D scene loads.

Out of scope (rejected during implementation review): swapping `drei`'s `Text` for HTML overlay labels — the `|+i⟩`/`|−i⟩` axis is along the view direction, so a flat overlay can't represent both labels distinctly. A future change can revisit using Three.js sprites with canvas-generated textures.

No breaking changes to public URLs or content.

## Capabilities

### New Capabilities
- `homepage-hero`: how the homepage hero (Bloch sphere + intro card) is loaded, hydrated, and rendered, including its performance budget.

### Modified Capabilities
<!-- none — no existing specs in openspec/specs/ -->

## Impact

- Affected code:
  - `src/pages/index.astro` (hydration directive, placeholder markup/styles)
  - `src/components/BlochSphere.jsx` (Three.js imports)
  - `src/components/GradientMaterial.js` (named Three.js imports)
- Dependencies: no package additions or removals.
- No build/CI changes required.
