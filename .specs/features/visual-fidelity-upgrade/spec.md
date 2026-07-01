# Visual Fidelity Upgrade Specification

## Problem Statement

The client renders with zero shadows, zero fog, no tonemapping/color-space
correction, and antialiasing disabled — a single flat ambient+directional light
falls on flat-shaded, solid-color geometry. This reads as "programmer art" rather
than a deliberate low-poly *style*, and was the direct cause of a stark visual gap
noticed against another Three.js browser MMO. None of this is a Three.js ceiling —
it's unused renderer/scene configuration. Closing it is cheap (renderer-level
config + reuse of shadow flags already present since Phase 8) and preserves the
project's procedural, zero-external-asset art direction (AD-005/AD-017).

## Goals

- [ ] Real cast/received shadows visible anywhere the player roams the 640 m world
- [ ] Correct color response (antialiasing, filmic tonemapping, sRGB output) so
      the new lighting/shadows read correctly instead of blown-out/flat
- [ ] A barely-there atmospheric fog that softens the world edge without touching
      gameplay-relevant visibility
- [ ] A procedurally-generated (zero-asset) tiled grass texture replacing the flat
      solid-color terrain material

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Bloom / `EffectComposer` post-processing pipeline | User chose "subtle" ambition (context.md) |
| Dusk/warm mood lighting change (sun color/intensity shift) | User chose "neutral mood" (context.md) |
| External CC0 ground texture + LICENSE attribution | User chose the procedural-texture option (context.md) |
| Dirt-path blending into the ground texture | Adds terrain-UV/path-geometry complexity beyond "subtle" scope |
| Retuning existing VFX color constants for the new tonemapping response | Outside this feature's boundary; address per-VFX only if a specific regression is spotted |
| New shadow-casting behavior for animated entities (player/remote players/mobs/NPCs) | Already `castShadow = true` since Phase 8/10/11/12 (AD-016/AD-017); unchanged here |
| Self-shadowing (`receiveShadow`) on characters/creatures | Low-poly rigged meshes self-shadow poorly at this fidelity; deliberately cast-only |
| Cascaded/multiple shadow maps, dynamic day/night lighting | Single directional shadow map is sufficient at `MOB_RENDER_DISTANCE` (80 m) scale |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | --------------- | --------- | ---------- |
| Which entities cast/receive shadows | Terrain + static env props (buildings/scatter/peace-marker/landmarks, mesh **and** primitive-fallback paths) receive; player/remote players/mobs/NPCs keep their existing cast-only flag, unchanged | Perf/architecture call (discuss.md explicitly excludes this from vision questions); existing `MOB_RENDER_DISTANCE` culling already bounds the animated-entity count | y (agent, design.md) |
| Shadow frustum coverage across a 640 m world | Directional light + its shadow target re-center on the local player whenever they cross the existing move-culling threshold (reuses `syncLocalPlayer`'s cull-refresh check) | A single fixed-at-origin shadow frustum would only cover the village; re-centering keeps shadows visible everywhere the player goes at negligible extra cost (same threshold already computed for mob culling) | y (agent, design.md) |
| Fog/shadow numeric tuning (near/far, map size, frustum size) | See `design.md` Tech Decisions | Performance call, not a vision call | y (agent, design.md) |
| Ground texture generation technique | `THREE.DataTexture` built from a small deterministic seeded-noise pixel buffer (no Canvas 2D) | jsdom (the client's Vitest test environment, AD-009) has no real `<canvas>` 2D context; `DataTexture` needs zero DOM canvas and is fully unit-testable/deterministic, matching AD-010's seeded-RNG-for-randomness rule | y (agent, design.md) |
| Existing VFX visual tuning after enabling tonemapping | No deliberate retuning of VFX color constants in this feature | Tonemapping is global infrastructure; retuning every VFX color is a separate, potentially large effort outside this feature's boundary — flag as a follow-up only if a specific regression is visually spotted | y (agent) |

**Open questions:** none — all resolved above or in `context.md`.

---

## User Stories

### P1: Real shadows across the world ⭐ MVP

**User Story**: As a player, I want the sun to cast real shadows from buildings,
trees, and characters onto the ground so the world feels physically grounded
instead of floating on a flat plane.

**Why P1**: This is the single highest-impact, cheapest fix identified — the
codebase already flags nearly every mesh with `castShadow = true` (Phases
8–24); shadows are simply never rendered because nothing enables the shadow map
or the receiving surfaces.

**Acceptance Criteria**:

1. WHEN the client renderer is created THEN the system SHALL enable
   `renderer.shadowMap` and set the main directional light ("sun")
   `castShadow = true` with a configured shadow map size and camera frustum.
2. WHEN the scene is built THEN the terrain mesh AND every static environment
   prop (village buildings, scattered trees/rocks, peace-zone marker,
   landmarks) SHALL have `receiveShadow = true` — on both the GLB/mesh render
   path and the primitive-fallback render path (used when a GLB fails to load).
3. WHEN the local player moves beyond the existing move-culling threshold THEN
   the sun and its shadow target SHALL re-center on the player's new position,
   preserving the light's original relative offset/angle.
4. WHEN an already-`castShadow`-flagged entity (player, remote player, mob,
   NPC) is rendered THEN its shadow-casting behavior SHALL be unchanged by this
   feature (no new casters added, none removed).

**Independent Test**: Run `npm run dev`, stand next to a village building or
scattered tree at any point in the 640 m world, and observe a shadow on the
ground. Unit tests assert the shadow-map/light/receiver configuration values
directly on the renderer/scene objects (no pixel screenshot needed, per
AGENTS.md's "WebGL is not directly testable" principle).

---

### P2: Correct color response (antialiasing + tonemapping + color space)

**User Story**: As a player, I want edges to be smooth and lighting/shadows to
render with correct contrast instead of harsh/blown-out flat color, so the new
depth cues from P1/P3 actually look right.

**Why P2**: Shadows and fog read as intended only with a proper tonemapping +
color-space pipeline; this is also independently visible (smoother edges,
better-graded color) even before P1/P3 land.

**Acceptance Criteria**:

1. WHEN the `WebGLRenderer` is constructed THEN antialiasing SHALL be enabled.
2. WHEN the renderer is created THEN `toneMapping` SHALL be set to
   `THREE.ACESFilmicToneMapping` and `outputColorSpace` SHALL be set to
   `THREE.SRGBColorSpace`.
3. WHEN the renderer factory runs in the Vitest/jsdom test environment (mocked
   `WebGLRenderer`, no real WebGL context) THEN configuring the above SHALL NOT
   throw.

**Independent Test**: Unit-assert the renderer's `toneMapping`/
`outputColorSpace` properties and the `antialias` constructor argument.

---

### P3: Barely-there world-edge fog

**User Story**: As a player, I want distant terrain/scatter to fade into a soft
haze instead of abruptly stopping, without it affecting anything I'm actually
fighting or interacting with nearby.

**Why P3**: Cheap, purely additive depth cue; explicitly scoped to be invisible
at gameplay-relevant range per the "barely-there" decision in `context.md`.

**Acceptance Criteria**:

1. WHEN the scene is built THEN `scene.fog` SHALL be a `THREE.Fog` whose color
   matches the sky background color exactly (`0x87ceeb`).
2. WHEN fog is configured THEN its `near` distance SHALL be `>= MOB_RENDER_DISTANCE`
   (80 m) so mob/NPC/player visibility at gameplay range is never fogged.
3. WHEN fog is configured THEN its `far` distance SHALL be strictly greater than
   `near` and less than the camera's far clipping plane.

**Independent Test**: Unit-assert `scene.fog` type, color, and the
`near >= MOB_RENDER_DISTANCE` / `near < far < camera.far` relationships.

---

### P4: Procedural tiled grass texture on the terrain

**User Story**: As a player, I want the ground to show some texture/grain
instead of one perfectly flat color, without the project taking on any new
external asset files.

**Why P4**: The one place the user opted into more visual detail than the
"subtle" baseline; zero-asset and deterministic, so it doesn't compromise the
project's art-direction constraints.

**Acceptance Criteria**:

1. WHEN the terrain mesh is created THEN its material SHALL have a `map`
   texture generated procedurally (via `THREE.DataTexture` from a seeded pixel
   buffer) — no external texture file, no `TextureLoader`.
2. WHEN the same seed is used twice THEN the generated texture pixel data SHALL
   be byte-identical (determinism, per AD-010); WHEN a different seed is used
   THEN the pixel data SHALL differ.
3. WHEN the texture is applied THEN it SHALL tile across the terrain via
   `RepeatWrapping` driven by a `uv` attribute derived from world (x, z)
   position — the terrain geometry SHALL gain a `uv` `BufferAttribute` it does
   not currently have.
4. WHEN the terrain mesh is created THEN `receiveShadow` SHALL be `true` (also
   covers P1 AC2 for the terrain specifically).

**Independent Test**: Unit-assert `material.map instanceof THREE.DataTexture`,
`wrapS`/`wrapT === THREE.RepeatWrapping`, geometry has a `uv` attribute sized to
match vertex count, and the determinism property above.

---

## Edge Cases

- WHEN a GLB prop fails to load and the code falls back to a primitive mesh
  THEN that primitive SHALL still receive (and, where applicable, cast)
  shadows — no regression vs. the mesh render path.
- WHEN the renderer factory is exercised under the existing `renderer.spec.ts`
  mock (`WebGLRenderer` fully mocked) THEN assigning `shadowMap.enabled`,
  `toneMapping`, `outputColorSpace` SHALL not throw — the mock SHALL be
  extended with a `shadowMap` stub object as part of this feature.
- WHEN the player is near the world edge (±315 m) THEN shadows SHALL still
  render correctly in their vicinity (frustum-follow, not fixed at origin).
- WHEN fog `near`/`far` are read back THEN they SHALL be named exported
  constants (not duplicated magic numbers between production code and tests).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ------ | ------- |
| VFU-01 | P1: Real shadows | Design | Pending |
| VFU-02 | P1: Real shadows (receivers, incl. primitive fallback) | Design | Pending |
| VFU-03 | P1: Real shadows (frustum-follow) | Design | Pending |
| VFU-04 | P1: Real shadows (existing casters unchanged) | Design | Pending |
| VFU-05 | P2: Antialiasing | Design | Pending |
| VFU-06 | P2: Tonemapping + color space | Design | Pending |
| VFU-07 | P2: Test-mock compatibility | Design | Pending |
| VFU-08 | P3: Fog color/type | Design | Pending |
| VFU-09 | P3: Fog near >= render distance | Design | Pending |
| VFU-10 | P3: Fog far > near, < camera far | Design | Pending |
| VFU-11 | P4: Procedural DataTexture, no external asset | Design | Pending |
| VFU-12 | P4: Deterministic per seed | Design | Pending |
| VFU-13 | P4: UV attribute + RepeatWrapping tiling | Design | Pending |
| VFU-14 | P4: Terrain receiveShadow | Design | Pending |

**ID format:** `VFU-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 14 total, 14 to be mapped to tasks in `tasks.md`, 0 unmapped.

---

## Success Criteria

- [ ] Standing near any building/tree/scattered prop anywhere in the 640 m
      world shows a visible cast shadow on the ground beneath it
- [ ] Distant terrain/scatter fades into a barely-there haze instead of a hard
      render-distance cutoff, with zero visible fog inside `MOB_RENDER_DISTANCE`
- [ ] The ground shows subtle grass-texture grain instead of one flat color
- [ ] `nx test client` (and `nx run-many -t build lint test`) stays green with
      the expected higher test count — no regressions, no weakened assertions
