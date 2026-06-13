## ADDED Requirements

### Requirement: Intro card paints before 3D scene hydration

The homepage SHALL paint and make the intro card (heading, subtitle, Blog/Links buttons) interactive before the Bloch sphere's JavaScript bundle is parsed and hydrated.

#### Scenario: First paint precedes 3D hydration
- **WHEN** a user loads `/` with a cold cache
- **THEN** the intro card and its buttons MUST be visible and clickable before the React Three Fiber canvas has finished hydrating

#### Scenario: Hydration directive is deferred
- **WHEN** inspecting `src/pages/index.astro`
- **THEN** the `<BlochSphere>` element MUST use a deferred Astro hydration directive (e.g., `client:visible` or `client:idle`) rather than `client:load`

### Requirement: Layout stability while 3D scene loads

The homepage SHALL not visibly shift layout when the Bloch sphere mounts.

#### Scenario: Placeholder fills the viewport before canvas mounts
- **WHEN** the page first paints, before the WebGL canvas has initialized
- **THEN** a full-viewport background placeholder MUST occupy the area the canvas will later cover, so the intro card position does not change once the canvas appears

### Requirement: Three.js imports are tree-shakeable

Files in the Bloch sphere render path SHALL import only the named Three.js symbols they use, not the full Three namespace.

#### Scenario: No wildcard Three import
- **WHEN** inspecting `src/components/BlochSphere.jsx` and `src/components/GradientMaterial.js`
- **THEN** neither file uses `import * as THREE from 'three'`
- **AND** any Three.js symbols used are imported by name (e.g., `import { Color } from 'three'`)

### Requirement: Visual and interactive parity with prior Bloch sphere

The post-hydration Bloch sphere SHALL be visually and interactively equivalent to the prior implementation.

#### Scenario: Auto-rotation preserved
- **WHEN** the canvas has hydrated and is idle
- **THEN** the sphere MUST auto-rotate around its Y axis at the same rate as before

#### Scenario: Orbit controls preserved
- **WHEN** the user drags on the canvas
- **THEN** the camera MUST orbit the sphere via `OrbitControls`

#### Scenario: Gradient wireframe preserved
- **WHEN** the sphere is rendered
- **THEN** it MUST use the existing `GradientMaterial` shader with the same color stops (`#7456eb` → `red`) and wireframe appearance
