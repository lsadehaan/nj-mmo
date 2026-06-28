# Phase 15 — Environment Art Upgrade (Optional) Specification

## Problem Statement

Talking Island village scenery still renders as raw Three.js primitives — box
buildings, cone+cylinder trees, dodecahedron rocks, and a green pillar for the
peace-zone marker (`addBox` / `addTree` / `addRock` in `client/src/scene/renderer.ts`).
Characters, mobs, and NPCs already use cohesive low-poly GLB meshes (Phases 8–12,
AD-017), so the environment reads as placeholder art. This optional phase swaps
**static GLB props** into the existing layout without moving placements or
changing server walkability.

## Goals

- [ ] Replace **5 village building** primitives with low-poly building GLBs at the
      same `BUILDING_LAYOUT` positions.
- [ ] Replace **scattered tree and rock** primitives with nature GLBs at the same
      `scatterProps` coordinates (seed **42**, count **80**).
- [ ] Replace the **peace-zone marker** pillar with a dedicated marker prop.
- [ ] Keep layout data and collision blockers unchanged (Phase 9 authority preserved).
- [ ] Mandatory **visual gate** (AD-017): town overview screenshot reviewed for style
      cohesion with characters and terrain.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Server schema, walkability, or pathfinding changes | Props are render-only; `BUILDING_AABBS` and `getPropBlockers()` stay in `game-core` (AD-001, Phase 9) |
| Editing `BUILDING_LAYOUT` or scatter RNG | Would shift world + desync blockers (`create-prop.md`) |
| Terrain mesh / heightmap changes | Phase 9 terrain pipeline unchanged |
| Village ground patch (`kind: 'ground'`) | ROADMAP lists buildings, trees, rocks, marker only — keep flat sand box |
| Animated / skeletal environment props | Static meshes only — no `AnimationMixer` |
| L2J geodata or proprietary L2 `.unr` assets | AD-004 |
| New village buildings beyond the existing five | Vertical slice only |
| Dynamic/destructible props | Not in MVP |
| Client-side collision derived from mesh bounds | Blockers remain authoritative AABBs/circles in `world-blockers.ts` |

---

## Assumptions & Open Questions

The Planner cannot talk to the user; every ambiguity is resolved here.

| Assumption / decision | Chosen default | Rationale |
| --------------------- | -------------- | --------- |
| Asset sourcing | CC0 curated-first per AD-017 + `game-designer` `create-prop.md` — **KayKit Medieval Builder / Village** (buildings), **Quaternius nature** or KayKit nature (trees/rocks); pre-live placeholders OK with folder note (golden rule 2) | Matches existing KayKit/Quaternius families used for characters/mobs |
| GLB storage | `client/public/models/props/environment/` — buildings `Building_0.glb`…`Building_4.glb`, `Tree.glb`, `Rock.glb`, `PeaceMarker.glb` + `LICENSE.txt` | Separates environment kit from weapon props (`GoblinClub.glb`, etc.) |
| Static loader | New `static-prop.ts` — `loadGltfStaticTemplate` + `cloneStaticProp`; **no** `AnimationMixer` | `create-prop.md` anti-pattern: mixer on static props |
| Template cache | Reuse URL-keyed cache pattern from `mesh-character.ts` but in `static-prop.ts` (no skeleton coupling) | One fetch per prop type |
| Scatter instantiation | `THREE.InstancedMesh` per prop kind when ≥ 20 placements (80 scatter props); buildings/peace marker use `clone()` (≤ 6 each) | Performance + `create-prop.md` instancing guidance |
| Building variant map | Manifest slot `0…4` maps to one of up to **5** building GLBs (may reuse 2–3 models with different `yRotation` if pack has fewer variants) | ROADMAP "5 building GLBs"; art pack may have 3 variants |
| Scale tuning | Per-entry `scale` + `yOffset` in manifest; tune so visual footprint ≈ existing `w×d×h` from `buildVillage` without editing layout numbers | Blockers use `w,d` only — height is cosmetic |
| Position semantics | Buildings: group position = spec `(x,y,z)` centre (same as `addBox`); trees/rocks: group at `(x,0,z)` with child Y = `prop.y` + offsets (same as primitives); peace marker: spec centre | Matches current renderer math |
| Scatter seed / count | `WORLD_SEED=42`, `count=80`, `fieldMin=-90`, `fieldMax=90`, `villageRadius=25` — **unchanged** | Aligns `renderer.ts` + `getPropBlockers()` |
| Load failure fallback | Per-slot fallback to current primitive (`addBox` / `addTree` / `addRock`) without crashing render loop | Same resilience pattern as mob/NPC mesh fallback |
| Ground material | Keep `MeshLambertMaterial` flat shading on any fallback primitives only | Style consistency for fallbacks |
| Server tests | None new — regression gate only | No gameplay change |
| Test hook | Add `__GAME_STATE__.environment` with counts + `renderKind: 'mesh' \| 'primitive'` per category | AD-009 — logical state, not pixels |
| Visual gate | New `client/environment-lab.html` + `scripts/shoot-environment.mjs` — elevated camera **town overview** PNG | Props judged as a set (`create-prop.md` step 5) |
| L2J reference | Talking Island village is **vibe reference only** (medieval starter town); placement stays `BUILDING_LAYOUT` in `world-blockers.ts`, not L2J world coords | AD-003, AD-013 |

**Open questions:** none — all resolved or logged above.

**Implicit-requirement dimensions (Large feature):**

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | Manifest indices `0…4` only; unknown scatter kind uses rock entry |
| Failure / partial-failure | Per-placement GLB load failure → primitive fallback; hook reports `renderKind: 'primitive'` for that category |
| Idempotency / retry | Template cache is idempotent per URL; renderer `createRenderer` called once per session |
| Auth boundaries | N/A — client-only visuals |
| Concurrency / ordering | Props added at init before `ready`; no runtime spawn |
| Data lifecycle | N/A — no persistence |
| Observability | `__GAME_STATE__.environment` counts + `loaded` flag |
| External-dependency failure | Missing GLB file → fallback + `LICENSE.txt` note for pre-live placeholder |
| State-transition integrity | `environment.loaded` flips true once all templates resolve (success or fallback) |

---

## User Stories

### P1: Static Prop Pipeline ⭐ MVP

**User Story**: As the client, I want static GLBs loaded once and cloned cheaply so
80+ props do not re-fetch or allocate mixers.

**Why P1**: Foundation for all environment art; wrong abstraction blocks the phase.

**Acceptance Criteria**:

1. ENV-01: WHEN `loadGltfStaticTemplate(url)` is called twice for the same URL THEN
   it SHALL fetch and parse exactly **one** GLTF per URL (cached promise).
   **Test layer: unit**
2. ENV-02: WHEN `cloneStaticProp(template)` is called N times THEN it SHALL return N
   distinct `THREE.Object3D` roots (not the same reference).
   **Test layer: unit**
3. ENV-03: WHEN a static prop is created THEN it SHALL NOT attach an
   `AnimationMixer` or register a per-frame animation update.
   **Test layer: unit**

**Independent Test**: Vitest mocks `GLTFLoader`; asserts cache hit + distinct clones.

---

### P1: Environment Manifest ⭐ MVP

**User Story**: As a developer, I want building/tree/rock/marker visuals selected from
data, not hardcoded paths in `renderer.ts`.

**Why P1**: Mirrors creature/NPC manifest pattern; enables asset swaps without renderer edits.

**Acceptance Criteria**:

4. ENV-04: WHEN `getBuildingPropEntry(index)` is called for `index` 0…4 THEN it SHALL
   return `{ model, scale, yOffset, yRotation }` with a path under
   `/models/props/environment/`. **Test layer: unit**
5. ENV-05: WHEN `getScatterPropEntry('tree' \| 'rock')` is called THEN it SHALL return
   `{ model, scaleMultiplier }` for that kind. **Test layer: unit**
6. ENV-06: WHEN `getPeaceZoneMarkerEntry()` is called THEN it SHALL return
   `{ model, scale, yOffset }`. **Test layer: unit**
7. ENV-07: WHEN manifest entries reference GLB paths THEN each path SHALL exist on disk
   after asset ingest (or fallback documented as placeholder). **Test layer: unit + build**

**Independent Test**: Vitest asserts five building rows + scatter kinds + peace entry.

---

### P1: Building GLB Placement ⭐ MVP

**User Story**: As a player, I want village buildings to look like cohesive low-poly
structures, not brown boxes.

**Why P1**: Core ROADMAP deliverable (5 buildings).

**Acceptance Criteria**:

8. ENV-08: WHEN `createRenderer` builds the village THEN exactly **5** building meshes
   SHALL be added from GLB templates (not `BoxGeometry`) when assets load successfully.
   **Test layer: unit (mocked loader) + hook**
9. ENV-09: WHEN building props are placed THEN their world positions SHALL match
   `buildVillage` `SceneObjectSpec` `(x, y, z)` for each `kind === 'building'` entry
   (tolerance 0.001 m). **Test layer: unit**
10. ENV-10: WHEN a building GLB fails to load THEN that slot SHALL fall back to the
    current `addBox` primitive without aborting other placements.
    **Test layer: unit**

**Independent Test**: `village.spec.ts` unchanged; new renderer unit test asserts positions.

---

### P1: Tree & Rock GLB Placement ⭐ MVP

**User Story**: As a player, I want field trees and rocks to match the stylized world
instead of geometric placeholders.

**Why P1**: Core ROADMAP deliverable.

**Acceptance Criteria**:

11. ENV-11: WHEN scatter props render THEN the count SHALL remain **80** and each
    prop's `(x, z)` SHALL match `scatterProps(42, …)` output (y tolerance 0.01 m).
    **Test layer: unit**
12. ENV-12: WHEN multiple trees share one GLB URL THEN the loader SHALL cache one
    template (≤ 2 `load` calls for tree + rock URLs combined at init).
    **Test layer: unit**
13. ENV-13: WHEN tree/rock GLBs fail to load THEN fallbacks SHALL use the existing
    `addTree` / `addRock` primitives at the same coordinates.
    **Test layer: unit**

**Independent Test**: `scatter.spec.ts` unchanged; hook reports `scatter.count === 80`.

---

### P1: Peace-Zone Marker ⭐ MVP

**User Story**: As a player, I want the safe-zone indicator to read as intentional
world art, not a debug green pillar.

**Why P1**: Explicit ROADMAP item.

**Acceptance Criteria**:

14. ENV-14: WHEN the peace-zone spec from `buildVillage` is rendered THEN it SHALL use
    the peace-marker GLB (not a green `BoxGeometry`) when the asset loads.
    **Test layer: unit + hook**
15. ENV-15: WHEN gameplay queries `isInPeaceZone(x, z)` THEN behavior SHALL be
    unchanged (no server or `game-core` edits in this phase).
    **Test layer: server regression (`peace-zone.spec.ts`)**

**Independent Test**: `nx test game-core` peace-zone tests pass unchanged.

---

### P2: Test Hook & E2E Observability

**User Story**: As a test author, I want logical confirmation that environment props
upgraded to meshes without reading WebGL pixels.

**Why P2**: AD-009 contract for optional visual phases.

**Acceptance Criteria**:

16. ENV-16: WHEN the renderer finishes environment init THEN
    `__GAME_STATE__.environment.buildings.renderKind` SHALL be `'mesh'` when all five
    GLBs loaded (or `'primitive'` if fallback). **Test layer: unit + e2e**
17. ENV-17: WHEN the game is `ready` THEN `__GAME_STATE__.environment` SHALL report
    `{ buildings: { count: 5 }, scatter: { count: 80 }, peaceZone: { count: 1 }, loaded: true }`.
    **Test layer: e2e**
18. ENV-18: WHEN `__GAME_STATE__.ready === true` in e2e THEN `environment.loaded`
    SHALL be `true`. **Test layer: e2e**

**Independent Test**: Playwright polls hook after town load.

---

### P2: Visual Gate & Attribution

**User Story**: As a reviewer, I want a town overview image to approve environment
cohesion before the phase is marked done.

**Why P2**: AD-017 mandatory visual gate for asset phases.

**Acceptance Criteria**:

19. ENV-19: WHEN `node scripts/shoot-environment.mjs` runs against `environment-lab.html`
    THEN it SHALL write `town-overview.png` (or `LAB_OUT` path) at ≥ 1280×720.
    **Test layer: manual / Verifier evidence**
20. ENV-20: WHEN the overview is reviewed THEN buildings, trees, rocks, and the peace
    marker SHALL appear stylistically consistent with KayKit/Quaternius character art
    (low-poly, flat-shaded materials). **Test layer: visual gate (human)**
21. ENV-21: WHEN new CC0 assets are vendored THEN `client/public/models/props/environment/LICENSE.txt`
    (or root `ATTRIBUTION.md` entry) SHALL list source packs. **Test layer: file check**

**Independent Test**: Verifier attaches PNG + attribution path in `validation.md`.

---

### P3: Scatter Instancing (Performance)

**User Story**: As the client, I want scattered trees/rocks drawn efficiently.

**Why P3**: Nice-to-have; 80 clones work but instancing is cheaper.

**Acceptance Criteria**:

22. ENV-22: WHEN scatter count ≥ 20 for a kind THEN the renderer SHOULD use
    `THREE.InstancedMesh` for that kind (optional — clones acceptable if gate stays green).
    **Test layer: unit (instance count) or design note**

**Independent Test**: Unit test asserts `InstancedMesh` userData or instance count.

---

## Edge Cases

- WHEN a building GLB's bbox is much larger than its AABB footprint THEN the manifest
  `scale` SHALL be reduced so art does not overlap adjacent buildings — **without**
  editing `BUILDING_LAYOUT` numbers.
- WHEN WebGL context is lost and renderer rebuilds THEN template cache MAY be cleared
  via `clearGltfStaticTemplateCache()` and props reload (same as character cache pattern).
- WHEN `environment.loaded` is false AND e2e polls `ready` THEN e2e SHALL wait with
  `expect.poll` (AD-014 — no `waitForTimeout` sleeps).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| ENV-01 | P1: Static pipeline | Design | Pending |
| ENV-02 | P1: Static pipeline | Design | Pending |
| ENV-03 | P1: Static pipeline | Design | Pending |
| ENV-04 | P1: Manifest | Design | Pending |
| ENV-05 | P1: Manifest | Design | Pending |
| ENV-06 | P1: Manifest | Design | Pending |
| ENV-07 | P1: Manifest | Tasks | Pending |
| ENV-08 | P1: Buildings | Tasks | Pending |
| ENV-09 | P1: Buildings | Tasks | Pending |
| ENV-10 | P1: Buildings | Tasks | Pending |
| ENV-11 | P1: Trees/rocks | Tasks | Pending |
| ENV-12 | P1: Trees/rocks | Tasks | Pending |
| ENV-13 | P1: Trees/rocks | Tasks | Pending |
| ENV-14 | P1: Peace marker | Tasks | Pending |
| ENV-15 | P1: Peace marker | Tasks | Pending |
| ENV-16 | P2: Hook | Tasks | Pending |
| ENV-17 | P2: Hook | Tasks | Pending |
| ENV-18 | P2: Hook | Tasks | Pending |
| ENV-19 | P2: Visual gate | Tasks | Pending |
| ENV-20 | P2: Visual gate | Tasks | Pending |
| ENV-21 | P2: Visual gate | Tasks | Pending |
| ENV-22 | P3: Instancing | Tasks | Pending |

**Coverage:** 22 total, 22 mapped to tasks (see `tasks.md`), 0 unmapped ✅

---

## Success Criteria

- [ ] Village overview shows GLB buildings, trees, rocks, and peace marker — no raw
      boxes/cones/dodecahedrons in the town centre and field (except intentional ground patch).
- [ ] `buildVillage` + `scatterProps` outputs unchanged; `world-blockers` tests green.
- [ ] `nx run-many -t build lint test` + `nx e2e client-e2e` green; town overview PNG reviewed.
