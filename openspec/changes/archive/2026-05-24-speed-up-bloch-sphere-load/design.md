## Context

The homepage (`src/pages/index.astro`) renders a small intro card on top of a full-viewport WebGL Bloch sphere. The 3D scene is implemented in `src/components/BlochSphere.jsx` with React Three Fiber (`@react-three/fiber`), drei helpers (`@react-three/drei`), and Three.js, and is mounted with the Astro directive `client:load`.

`client:load` is the most eager hydration directive Astro offers: the component's JS is fetched and the component is hydrated immediately on page load, blocking the main thread alongside any other startup work. Concretely, this view currently pulls in:
- `three` (full namespace via `import * as THREE`),
- `@react-three/fiber` (`Canvas`, `useFrame`, `extend`),
- `@react-three/drei` (`OrbitControls`, `Sphere`, `Text`) — where `Text` transitively imports `troika-three-text`, a sizable text-rendering engine plus a default font atlas, only to render six short basis-state labels.

The hero card (name, role, blog/links buttons) is plain HTML/CSS and has no dependency on the 3D scene. There is no reason it should wait for WebGL to be ready.

## Goals / Non-Goals

**Goals:**
- Reduce the JS that must download, parse, and execute before the homepage is interactive.
- Make the intro card paint and become interactive independently of the 3D scene.
- Keep the visual end-state identical: same sphere, same wireframe gradient material, same six basis-state labels, same orbit controls, same auto-rotation.
- Avoid layout shift when the 3D scene mounts.

**Non-Goals:**
- Redesigning the homepage or replacing the Bloch sphere with a different visualization.
- Removing `@react-three/drei` from the project entirely (it is still used for `OrbitControls` and `Sphere`).
- Server-side rendering the WebGL scene.
- Adding a build-time bundle-size budget or CI perf gate (could be a follow-up).

## Decisions

### Decision 1: Switch hydration directive from `client:load` to `client:visible`

`client:visible` waits until the component scrolls into view before hydrating. On this page the canvas covers the viewport, so it is "visible" immediately — but Astro still defers the hydration work to after first paint via an `IntersectionObserver`, which lets the intro card render and become interactive first. `client:idle` is an alternative, but it does not give a guaranteed first paint before hydration begins; `client:visible` aligns better with "user can see something instantly, 3D fills in shortly after."

Alternatives considered:
- `client:load`: status quo, eager.
- `client:idle`: better than `client:load` but still competes with other startup work; no first-paint guarantee.
- `client:only`: skips SSR entirely; this component already has no SSR output worth keeping (it's a `<Canvas>`), but `client:only` does not by itself defer hydration timing, so it solves a different problem.

### Decision 2: Keep drei `Text` labels (HTML overlay rejected)

Initially considered: replace drei `Text` with absolutely-positioned HTML labels to drop the `troika-three-text` subtree from the bundle.

Rejected on review for two reasons:
1. The `|+i⟩` (+Z) and `|−i⟩` (−Z) labels lie along the view direction in the initial camera pose, so they both project to the screen center. A 2D HTML overlay cannot represent them distinctly — only depth disambiguates them, which requires the 3D pipeline.
2. The `<Text>` elements are currently children of the rotating mesh, so they rotate with the sphere. HTML overlay would lose that behavior.

The bundle weight that troika contributes is no longer on the first-paint critical path once Decision 1 lands (`client:visible` defers the entire 3D chunk until after first paint). So the troika cost is paid only when the canvas is actually being hydrated, which the user already expects to take a moment. The visual fidelity is worth keeping.

A future change can swap `Text` for Three.js sprites (canvas-generated text textures) to keep labels in 3D while shedding troika.

### Decision 3: Replace `import * as THREE` with named imports

`GradientMaterial.js` and `BlochSphere.jsx` only need `THREE.Color`. Importing the namespace defeats tree-shaking in some bundler configurations. Switch to `import { Color } from 'three'` so the bundler can drop unused Three.js modules.

### Decision 4: Render a CSS placeholder under the canvas

Add a simple full-viewport gradient background (matching the page's existing purple→red palette) behind the `<BlochSphere>` mount point. This:
- Prevents a flash of white/empty space while JS loads,
- Keeps the perceived load feeling instant,
- Costs zero JS.

## Risks / Trade-offs

- **HTML overlay labels don't follow user-driven orbit rotation** → Mitigation: accept for v1; the auto-rotation default already keeps the camera/labels aligned. If user feedback flags it, replace with sprite-based labels (no troika dependency).
- **`client:visible` defers hydration but the canvas is full-viewport, so the IntersectionObserver fires almost immediately** → that is fine: the goal is "first paint before hydration starts," not "hydrate much later." Even a single frame of deferral gives the intro card a chance to paint.
- **Named Three.js imports may need adjustment if other components rely on the namespace import being cached** → low risk: only two files import Three directly today, and both are in scope of this change.
- **No automated bundle-size regression check** → noted as non-goal; a follow-up can wire up a size budget.

## Migration Plan

Single PR, no data migration. Rollback is a one-commit revert. Verify locally by:
1. `npm run build && npm run preview`
2. Loading `/` with the browser devtools network panel throttled to "Fast 3G" and confirming the intro card is interactive before the Three.js chunk finishes.
3. Confirming the sphere still renders, auto-rotates, and responds to orbit controls.
4. Confirming the six basis-state labels are positioned correctly around the sphere.
