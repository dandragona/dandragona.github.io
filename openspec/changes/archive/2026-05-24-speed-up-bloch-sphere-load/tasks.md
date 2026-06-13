## 1. Defer hydration and add placeholder

- [x] 1.1 In `src/pages/index.astro`, change `<BlochSphere client:load />` to use a deferred directive (`client:visible` preferred; `client:idle` acceptable)
- [x] 1.2 In `src/pages/index.astro`, add a full-viewport CSS background placeholder element behind the canvas mount so there is no flash of empty space before the canvas appears, and so the intro card position does not shift when the canvas mounts
- [x] 1.3 Verify the placeholder uses CSS only (no extra JS) and matches the page palette

## 2. Tree-shake Three.js imports

- [x] 2.1 In `src/components/BlochSphere.jsx`, remove the unused `import * as THREE from 'three'` if present after the rest of the change
- [x] 2.2 In `src/components/GradientMaterial.js`, replace `import * as THREE from 'three'` with `import { Color } from 'three'` and update the two `new THREE.Color(...)` references accordingly
- [x] 2.3 Grep the repo for any other `import * as THREE` in the homepage render path and convert to named imports

## 3. Verify behavior and performance

- [x] 3.1 Run `npm run build` and confirm the build succeeds with no new warnings
- [ ] 3.2 Open the built `/` in `npm run preview` and confirm: intro card paints first, sphere auto-rotates, OrbitControls work, gradient wireframe palette matches, six labels still visible at top/bottom/left/right/front/back
