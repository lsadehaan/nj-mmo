# Visual Fidelity Upgrade Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** Do not search for skill files by
filesystem path. The skill is the source of truth for the full flow (per-task
cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed
without it.**

---

**Design**: `.specs/features/visual-fidelity-upgrade/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase + `AGENTS.md`/`.specs/STATE.md` (AD-010). This
> feature touches only the client rendering layer (no server/`game-core`/DB
> changes) — Playwright/e2e is removed from this repo per `STATE.md` Handoff
> ("Playwright / client-e2e removed per AGENTS.md"), so unit is the only layer
> in scope.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------- | ---------------------- | ------------------ | ------------- |
| Client scene/rendering (`renderer.ts`, `terrain.ts`, `static-prop.ts`, `environment-renderer.ts`, `landmark-renderer.ts`) | unit (Vitest) | 1:1 to every spec.md AC touched by the task; determinism asserted directly (no pixel screenshots, per `AGENTS.md`'s "WebGL is not directly testable" principle) | `client/src/scene/**/*.spec.ts` | `nx test client` |
| `STATE.md` decision log update (AD-019) | none | doc-only, no test | `.specs/STATE.md` | build gate only |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | --------------- | ------------------ | -------- |
| Client unit (Vitest) | Yes | Per-file Vitest workers; no shared DB/global store (unlike server room-integration tests, which needed AD-014 precisely because they *do* share a room/clock) | Current baseline: `nx test client` → 87 files / 414 tests, all pass together, ~10.3 s total, no serialization flags used |

## Gate Check Commands

> Generated from codebase — confirm before Execute. Baseline before this
> feature: `nx test client` → **87 files, 414 tests, green, ~10.3 s**.

| Gate Level | When to Use | Command |
| ---------- | ------------ | --------- |
| Quick | After every task below (unit-only feature) | `nx test client` |
| Full | After the last task, before marking the feature done | `nx run-many -t build lint test` |

---

## Execution Plan

### Phase 1: Independent file-scoped changes (mostly parallel)

```
T1 ──→ T2
T3 [P]
T4 [P]
T5 [P]
```

T1 (renderer.ts static config) must land before T2 (same file, dynamic
frustum-follow behavior builds on the shadow/light config T1 adds). T3
(`terrain.ts`), T4 (`static-prop.ts`), and T5 (`environment-renderer.ts` +
`landmark-renderer.ts`) touch none of the same files as each other or as
T1/T2, so they have no inter-task dependency.

### Phase 2: Documentation (sequential, after everything else)

```
T1, T2, T3, T4, T5 complete, then:
  T6
```

T6 records the AD-019 decision in `STATE.md` — it describes the *shipped*
convention, so it must come last.

Only 2 phases (well under the >3-phase sub-agent-delegation threshold) — this
executes inline, no sub-agents.

---

## Task Breakdown

### T1: Renderer static config — shadow map, sun shadow-casting, fog, tonemapping/color-space, antialiasing

**What**: In `createRenderer`, enable `renderer.shadowMap` (+ `PCFSoftShadowMap`),
set `sun.castShadow = true` with a configured `shadow.mapSize`/`shadow.camera`
frustum, attach `scene.fog = new THREE.Fog(...)`, set `renderer.toneMapping =
THREE.ACESFilmicToneMapping` + `renderer.outputColorSpace = THREE.SRGBColorSpace`,
and construct `WebGLRenderer` with `antialias: true`. Export the named tuning
constants (`FOG_NEAR_M`, `FOG_FAR_M`, `SUN_SHADOW_MAP_SIZE`,
`SUN_SHADOW_FRUSTUM_M`) per design.md's Tech Decisions.

**Where**: `client/src/scene/renderer.ts`
**Depends on**: None
**Reuses**: existing `sun`/`scene` locals; `MOB_RENDER_DISTANCE` from
`@nj/game-core` to anchor fog `near`
**Requirement**: VFU-01, VFU-05, VFU-06, VFU-07, VFU-08, VFU-09, VFU-10

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven` (this execution)

**Done when**:

- [ ] `new THREE.WebGLRenderer({ canvas, antialias: true })`
- [ ] `renderer.shadowMap.enabled === true`, type `PCFSoftShadowMap`
- [ ] `sun.castShadow === true`; `sun.shadow.mapSize` set to
      `SUN_SHADOW_MAP_SIZE`; shadow camera frustum set to `±SUN_SHADOW_FRUSTUM_M`
- [ ] `scene.fog instanceof THREE.Fog`, color `0x87ceeb`, `near === FOG_NEAR_M`,
      `far === FOG_FAR_M`, and `FOG_NEAR_M >= MOB_RENDER_DISTANCE`,
      `FOG_NEAR_M < FOG_FAR_M < camera.far`
- [ ] `renderer.toneMapping === THREE.ACESFilmicToneMapping`,
      `renderer.outputColorSpace === THREE.SRGBColorSpace`
- [ ] `renderer.spec.ts`'s `MockWebGLRenderer` extended with a `shadowMap =
      { enabled: false, type: 0 }` stub so the above assignments don't throw
      under the existing full-mock pattern
- [ ] Gate check passes: `nx test client`
- [ ] Test count: 414 → 414 + N (N = new assertions added in this task; no
      pre-existing test deleted/weakened)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(client): enable shadow map, sun shadow-casting, fog, and tonemapping/color-space`

---

### T2: Shadow frustum follows the local player

**What**: Extend the existing move-culling threshold check inside
`syncLocalPlayer` (the `lastCullX`/`lastCullZ`/`CULL_MOVE_THRESHOLD_SQ` block
that already triggers `refreshMobCulling()`) to also re-center `sun.position`
and `sun.target.position` on the player, preserving the light's original
relative offset. Add `sun.target` to the scene (directional lights need their
target added to be effective).

**Where**: `client/src/scene/renderer.ts` (same file as T1, separate task for
atomic commit granularity)
**Depends on**: T1
**Reuses**: the existing cull-threshold block (no duplicate distance math)
**Requirement**: VFU-03, VFU-04

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven` (this execution)

**Done when**:

- [ ] `sun.target` is added to the scene
- [ ] After `syncLocalPlayer(x, y, z)` moves the player beyond
      `CULL_MOVE_THRESHOLD_SQ`, `sun.position` and `sun.target.position` track
      the new player position at the original relative offset
- [ ] A small move (below threshold) does NOT reposition the sun (matches the
      existing mob-culling threshold semantics — no new behavior divergence)
- [ ] No new `castShadow`/`receiveShadow` values are added to player/remote
      player/mob/NPC meshes by this task (VFU-04 — unchanged casters)
- [ ] Gate check passes: `nx test client`
- [ ] Test count increases by the new assertions in this task; no regression

**Tests**: unit
**Gate**: quick

**Commit**: `feat(client): re-center the sun's shadow frustum on the local player`

---

### T3: Procedural grass `DataTexture` + terrain UVs + `receiveShadow` [P]

**What**: Add `generateGrassTextureData(seed, size)` — a pure, deterministic
function using `createSeededRng` to produce a `64×64` `Uint8ClampedArray` of
RGBA grass-shade speckle noise. Wire it into `createTerrainMesh`: build a `uv`
`BufferAttribute` from each vertex's `(x, z)` divided by an `8 m` tile size,
wrap the pixel buffer in a `THREE.DataTexture` with `RepeatWrapping`, assign it
as `material.map`, and set `terrainMesh.receiveShadow = true`.

**Where**: `client/src/scene/terrain.ts`
**Depends on**: None
**Reuses**: `createSeededRng` from `@nj/game-core` (same pattern as
`world-scatter.ts`/`scatter.ts`)
**Requirement**: VFU-02 (terrain receiver), VFU-11, VFU-12, VFU-13, VFU-14

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven` (this execution)

**Done when**:

- [ ] `generateGrassTextureData(seed, size)` is deterministic: same seed twice
      → byte-identical `Uint8ClampedArray`; different seed → different data
- [ ] `createTerrainMesh(...).material.map instanceof THREE.DataTexture`,
      `wrapS === wrapT === THREE.RepeatWrapping`
- [ ] `geometry.attributes.uv` exists with `count === geometry.attributes.position.count`
- [ ] `createTerrainMesh(...).receiveShadow === true`
- [ ] No external texture file added; no `TextureLoader` used
- [ ] Gate check passes: `nx test client`
- [ ] Test count increases; no regression to the existing `generateTerrain`
      determinism tests in `terrain.spec.ts`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(client): procedural seeded grass texture + UVs + shadow receiving on terrain`

---

### T4: `receiveShadow` on the GLB/instanced static-prop pipeline [P]

**What**: Mirror every existing `castShadow = true` assignment in
`static-prop.ts` with a `receiveShadow = true` assignment on the same node(s):
`loadGltfStaticTemplate`'s traverse, `cloneStaticProp`'s traverse, and
`createInstancedScatter`'s per-mesh `InstancedMesh`.

**Where**: `client/src/scene/static-prop.ts`
**Depends on**: None
**Reuses**: the exact traversal/assignment sites that already set `castShadow`
**Requirement**: VFU-02 (mesh render path)

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven` (this execution)

**Done when**:

- [ ] `loadGltfStaticTemplate(...)`'s loaded scene meshes have both
      `castShadow === true` and `receiveShadow === true`
- [ ] `cloneStaticProp(...)`'s cloned meshes have both flags `true`
- [ ] `createInstancedScatter(...)`'s returned `InstancedMesh`es have both
      flags `true` (new coverage — this function had no dedicated shadow-flag
      test before)
- [ ] Gate check passes: `nx test client`
- [ ] Test count increases; existing `static-prop.spec.ts` assertions
      unchanged/still passing

**Tests**: unit
**Gate**: quick

**Commit**: `feat(client): static props and instanced scatter receive shadows`

---

### T5: `castShadow`/`receiveShadow` on primitive-fallback meshes [P]

**What**: Add `castShadow = true; receiveShadow = true;` to the four
primitive-fallback builders that currently have neither flag:
`addBoxPrimitive`, `addTreePrimitive`, `addRockPrimitive` (in
`environment-renderer.ts`) and `addLandmarkPrimitive` (in
`landmark-renderer.ts`). These only render when a GLB fails to load, but must
not be a silent shadow regression vs. the mesh path (T4).

**Where**: `client/src/scene/environment-renderer.ts`,
`client/src/scene/landmark-renderer.ts`
**Depends on**: None
**Reuses**: the existing exported test helpers
(`addBoxPrimitiveForTests`/`addTreePrimitiveForTests`/`addRockPrimitiveForTests`)
in `environment-renderer.ts`
**Requirement**: VFU-02 (primitive-fallback path — edge case)

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven` (this execution)

**Done when**:

- [ ] All four primitive builders set both `castShadow` and `receiveShadow` to
      `true`
- [ ] `environment-renderer.spec.ts` gains direct assertions on the three
      `*ForTests` exports
- [ ] A new `landmark-renderer.spec.ts` is created (none exists today) with at
      least one test asserting `addLandmarkPrimitive`'s shadow flags via
      `buildLandmarkScene` with a failing mock loader (same `mockLoader(false)`
      pattern already used in `environment-renderer.spec.ts`)
- [ ] Gate check passes: `nx test client`
- [ ] Test count increases; no regression

**Tests**: unit
**Gate**: quick

**Commit**: `feat(client): shadow flags on primitive-fallback environment/landmark meshes`

---

### T6: Record AD-019 in `STATE.md`

**What**: Append the AD-019 decision entry (drafted in `design.md`'s Tech
Decisions section) to `.specs/STATE.md` `## Decisions`, and add a short
Handoff note recording this feature's completion (test counts, commits).

**Where**: `.specs/STATE.md`
**Depends on**: T1, T2, T3, T4, T5
**Reuses**: the exact AD-019 text already drafted in `design.md`

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven` (this execution)

**Done when**:

- [ ] AD-019 entry present in `STATE.md` `## Decisions` with Decision/Reason/
      Trade-off/Scope/Date/Status fields (matches the format of AD-001…AD-018)
- [ ] Handoff section updated with this feature's final test count and commit
      range
- [ ] Full gate passes: `nx run-many -t build lint test`

**Tests**: none (doc-only)
**Gate**: build

**Commit**: `docs(specs): record AD-019 (procedural DataTexture + shadow-frustum-follow) and visual-fidelity-upgrade handoff`

---

## Parallel Execution Map

```
Phase 1 (mostly parallel):
  T1 ──→ T2
  T3 [P]
  T4 [P]
  T5 [P]

Phase 2 (sequential, after Phase 1):
  T1, T2, T3, T4, T5 complete, then:
    T6
```

**Parallelism constraint check**: T3, T4, T5 touch entirely disjoint files from
each other and from T1/T2, and all client unit tests are parallel-safe (see
Parallelism Assessment) — `[P]` is valid for all three. T2 is NOT marked `[P]`
because it depends on T1 (same file).

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ------- | -------- |
| T1: Renderer static config | 1 file (`renderer.ts`), one cohesive config concern | ✅ Granular |
| T2: Shadow frustum follows player | 1 file, 1 behavior (extends one existing function) | ✅ Granular |
| T3: Procedural grass texture + UVs + receiveShadow | 1 file (`terrain.ts`), 1 function + 1 mesh property | ✅ Granular |
| T4: receiveShadow on static-prop pipeline | 1 file, 3 mechanically-identical additions (cast→receive mirror) | ✅ Granular (cohesive, same one-line pattern 3×) |
| T5: Shadow flags on primitive fallbacks | 2 files, 4 mechanically-identical additions (same one-line pattern) | ✅ Granular (cohesive — same trivial change repeated; splitting into 4 near-duplicate tasks would fragment commits with no isolation benefit) |
| T6: Record AD-019 | 1 file (`STATE.md`), doc-only | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ------------------------ | ---------------- | -------- |
| T1 | None | None | ✅ Match |
| T2 | T1 | T1 ──→ T2 | ✅ Match |
| T3 | None | `[P]`, no arrow | ✅ Match |
| T4 | None | `[P]`, no arrow | ✅ Match |
| T5 | None | `[P]`, no arrow | ✅ Match |
| T6 | T1, T2, T3, T4, T5 | Phase 2 arrow from all Phase 1 tasks | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | ------------------------------ | ------------------ | ----------- | -------- |
| T1 | Client scene/rendering | unit | unit | ✅ OK |
| T2 | Client scene/rendering | unit | unit | ✅ OK |
| T3 | Client scene/rendering | unit | unit | ✅ OK |
| T4 | Client scene/rendering | unit | unit | ✅ OK |
| T5 | Client scene/rendering | unit | unit | ✅ OK |
| T6 | `STATE.md` (doc) | none | none | ✅ OK |

---

## Tools Confirmation Needed Before Execute

Per the skill's Tasks process, confirming before execution: no external MCP
tools apply to this feature (it's pure local TypeScript/Three.js editing +
`nx`/Vitest). No other Cursor skills apply beyond `tlc-spec-driven` itself for
the execute/verify flow. Flag if you'd like anything else used per task.
