# Phase 15 — Environment Art Upgrade Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** This repo wraps it with
`spec-driven-execution` (Planner → Implementer → Verifier, **autonomous-first**);
honor server-authority (AD-001) and the four test layers (AD-010).

**If the skill cannot be activated, STOP and tell the user — do not proceed
without it.**

---

**Design**: `.specs/features/phase-15-environment-art/design.md`
**Status**: Complete

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `AGENTS.md` (4 test layers + WebGL not DOM-testable + 10-second rule),
> `.specs/STATE.md` AD-009/AD-010/AD-014/AD-017,
> `.cursor/skills/game-designer/references/create-prop.md`,
> existing patterns in `client/src/scene/village.spec.ts`,
> `client/src/scene/scatter.spec.ts`, `client/src/scene/creature/mesh-character.spec.ts`,
> `client-e2e/src/town.spec.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Static prop loader | unit | ENV-01–03: cache once, distinct clones, no mixer | `client/src/scene/static-prop.spec.ts` | `nx test client` |
| Environment manifest | unit | ENV-04–07: five building rows, scatter kinds, peace entry, paths exist | `client/src/scene/environment-manifest.spec.ts` | `nx test client` |
| Environment placement | unit | ENV-08–14: positions, counts, fallbacks, instancing optional | `client/src/scene/environment-renderer.spec.ts` or `renderer.spec.ts` | `nx test client` |
| Test hook | unit | ENV-16–18: hook shape + `loaded` flag | `client/src/test-hook.spec.ts` | `nx test client` |
| Village layout regression | unit | ENV-09 implicit: `buildVillage` output unchanged | `client/src/scene/village.spec.ts` | `nx test client` |
| Scatter regression | unit | ENV-11 implicit: deterministic scatter unchanged | `client/src/scene/scatter.spec.ts` | `nx test client` |
| Game-core blockers | unit | ENV-15: `isInPeaceZone` + `BUILDING_AABBS` unchanged | `libs/game-core/src/world-blockers.spec.ts`, `peace-zone.spec.ts` | `nx test game-core` |
| Town e2e | e2e | ENV-16–18: `environment` hook after `ready` | `client-e2e/src/town.spec.ts` | `nx e2e client-e2e` |
| GLB assets | none (visual gate) | ENV-19–21: overview PNG + LICENSE | `client/public/models/props/environment/`, `scripts/shoot-environment.mjs` | `node scripts/shoot-environment.mjs` |
| Server | none | Regression only — no schema change | `server/src/rooms/TownRoom.spec.ts` | `nx test server` |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`client`) | Yes | `jsdom` / mocked `GLTFLoader`; `clearGltfStaticTemplateCache()` in `afterEach` | `mesh-character.spec.ts` cache pattern |
| Unit (`game-core`) | Yes | Pure functions, no shared DB | `world-blockers.spec.ts` |
| E2E (`client-e2e`) | Yes | Per-test `?room=` instanceKey (AD-014) | `client-e2e/playwright.config.ts` |
| Server regression | Yes | `NJ_AUTOSIM=0` + per-test room (AD-014) | `TownRoom.spec.ts` |

## Gate Check Commands

> Generated from codebase (AD-010) — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (client) | After T1–T2, T5–T8 | `nx test client` |
| Quick (game-core) | After T10 regression | `nx test game-core` |
| Quick (server) | After T10 | `nx test server` |
| Full | After T9 | `nx affected -t test lint` + `nx e2e client-e2e` |
| Build | Phase completion (T10) | `nx run-many -t build lint test` |
| Visual | After T9 (before Verifier) | `nx run client:preview` + `node scripts/shoot-environment.mjs` |

---

## Execution Plan

**5 phases** (10 tasks).

### Phase 1: Static pipeline — Sequential

```
T1 → T2
```

### Phase 2: Asset ingest — Parallel

```
T2 ──┬→ T3 [P] Building GLBs
     ├→ T4 [P] Tree + rock GLBs
     └→ T5 [P] Peace marker GLB
```

### Phase 3: Renderer integration — Sequential

```
T3,T4,T5 → T6 → T7
```

### Phase 4: Observability — Sequential

```
T7 → T8
```

### Phase 5: Gate + visual review — Sequential

```
T8 → T9 → T10
```

---

## Task Breakdown

### T1: Static prop loader

**What**: `loadGltfStaticTemplate`, `cloneStaticProp`, `clearGltfStaticTemplateCache`;
optional `createInstancedScatter` stub (filled in T6).
**Where**: `client/src/scene/static-prop.ts` (+ `.spec.ts`)
**Depends on**: None
**Reuses**: URL cache pattern from `mesh-character.ts`
**Requirement**: ENV-01, ENV-02, ENV-03

**Tools**: MCP: NONE · Skill: `game-designer` → `create-prop.md` step 2

**Done when**:
- [ ] Cache returns same promise per URL; clones are distinct roots
- [ ] No `AnimationMixer` created
- [ ] Unit tests pass
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick

**Commit**: `feat(client): add static GLB prop loader`

---

### T2: Environment manifest

**What**: `BuildingPropEntry`, `ScatterPropEntry`, `PeaceZonePropEntry` + getters for
indices 0–4, tree/rock, peace marker; `listEnvironmentModelPaths()`.
**Where**: `client/src/scene/environment-manifest.ts` (+ `.spec.ts`)
**Depends on**: T1
**Reuses**: `creature-manifest.ts` data-only pattern
**Requirement**: ENV-04, ENV-05, ENV-06, ENV-07

**Tools**: MCP: NONE · Skill: `game-designer` → `create-prop.md` step 1

**Done when**:
- [ ] Five building entries + scatter + peace entries defined
- [ ] Unit tests assert paths and field shapes
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick

**Commit**: `feat(client): add environment prop manifest`

---

### T3: Building GLB assets [P]

**What**: Vendor five low-poly building GLBs + `LICENSE.txt` under
`client/public/models/props/environment/`.
**Where**: `client/public/models/props/environment/Building_*.glb`, `LICENSE.txt`
**Depends on**: T2
**Reuses**: KayKit Medieval Builder / Village pack (or placeholders noted)
**Requirement**: ENV-07, ENV-08 (asset side)

**Tools**: MCP: NONE · Skill: `game-designer` → `create-prop.md` step 1

**Done when**:
- [ ] Five `.glb` files on disk matching manifest paths
- [ ] `LICENSE.txt` or placeholder note present
- [ ] `nx build client` succeeds

**Tests**: none · **Gate**: build

**Commit**: `feat(assets): add environment building GLBs`

---

### T4: Tree and rock GLB assets [P]

**What**: Vendor `Tree.glb` + `Rock.glb` (nature pack).
**Where**: `client/public/models/props/environment/Tree.glb`, `Rock.glb`
**Depends on**: T2
**Reuses**: Quaternius / KayKit nature assets
**Requirement**: ENV-11, ENV-12 (asset side)

**Tools**: MCP: NONE · Skill: `game-designer` → `create-prop.md`

**Done when**:
- [ ] Both GLBs on disk
- [ ] Manifest paths resolve
- [ ] `nx build client` succeeds

**Tests**: none · **Gate**: build

**Commit**: `feat(assets): add environment tree and rock GLBs`

---

### T5: Peace-zone marker GLB [P]

**What**: Vendor `PeaceMarker.glb` — low-poly banner/pillar (not debug green box).
**Where**: `client/public/models/props/environment/PeaceMarker.glb`
**Depends on**: T2
**Reuses**: KayKit props or simple authored mesh
**Requirement**: ENV-14 (asset side)

**Tools**: MCP: NONE · Skill: `game-designer` → `create-prop.md`

**Done when**:
- [ ] Marker GLB on disk
- [ ] `nx build client` succeeds

**Tests**: none · **Gate**: build

**Commit**: `feat(assets): add peace-zone marker GLB`

---

### T6: Building + peace-marker renderer wiring

**What**: Replace `addBox` for `kind === 'building' \| 'peace-zone'` with static GLB
placement; keep `kind === 'ground'` as primitive; primitive fallback on load failure.
**Where**: `client/src/scene/renderer.ts` (+ `environment-renderer.ts` if extracted)
**Depends on**: T1, T2, T3, T5
**Reuses**: `buildVillage` specs unchanged; `addBox` as fallback
**Requirement**: ENV-08, ENV-09, ENV-10, ENV-14

**Tools**: MCP: NONE · Skill: `game-designer` → `create-prop.md` step 3–4

**Done when**:
- [ ] Five buildings + peace marker use GLBs at spec coordinates
- [ ] Unit tests mock loader + assert positions + fallback
- [ ] `village.spec.ts` still green
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick

**Commit**: `feat(client): render village buildings and peace marker as GLBs`

---

### T7: Scatter tree/rock renderer wiring

**What**: Replace `addTree`/`addRock` loop with cached templates; prefer
`InstancedMesh` per kind (ENV-22) with clone fallback; preserve 80 placements.
**Where**: `client/src/scene/renderer.ts` (+ `static-prop.ts` instancing helper)
**Depends on**: T1, T4, T6
**Reuses**: `scatterProps(WORLD_SEED, …)` call unchanged
**Requirement**: ENV-11, ENV-12, ENV-13, ENV-22

**Tools**: MCP: NONE · Skill: `game-designer` → `create-prop.md`

**Done when**:
- [ ] 80 scatter props at same x,z as before
- [ ] Loader cache asserted (≤ 2 loads for tree+rock)
- [ ] `scatter.spec.ts` still green
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick

**Commit**: `feat(client): render scatter trees and rocks as GLBs`

---

### T8: Environment test hook

**What**: `GameStateEnvironment` on `__GAME_STATE__`; `setEnvironment()` from renderer
when init completes (`loaded`, counts, `renderKind` per category).
**Where**: `client/src/test-hook.ts`, `renderer.ts`, `test-hook.spec.ts`
**Depends on**: T7
**Reuses**: `renderKind` pattern from NPCs/mobs
**Requirement**: ENV-16, ENV-17, ENV-18

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Hook publishes `{ buildings: { count: 5, renderKind }, scatter: { count: 80, … }, peaceZone: { count: 1, … }, loaded: true }`
- [ ] `setReady(true)` only after `environment.loaded`
- [ ] Unit + quick gate pass

**Tests**: unit · **Gate**: quick

**Commit**: `feat(client): expose environment stats on game test hook`

---

### T9: E2E + visual gate harness

**What**: E2e poll `environment` on town load; add `environment-lab.html` +
`scripts/shoot-environment.mjs` for `town-overview.png`.
**Where**: `client-e2e/src/town.spec.ts`, `client/environment-lab.html`,
`scripts/shoot-environment.mjs`
**Depends on**: T8
**Reuses**: `shoot-vfx.mjs` Playwright pattern; AD-014 prebuilt preview
**Requirement**: ENV-16, ENV-17, ENV-18, ENV-19, ENV-20, ENV-21

**Tools**: MCP: `user-playwright` (optional) · Skill: `game-designer` → `create-prop.md` step 5

**Done when**:
- [ ] E2e asserts `environment.loaded` + counts via `expect.poll`
- [ ] `shoot-environment.mjs` writes overview PNG ≥ 1280×720
- [ ] `LICENSE.txt` / attribution updated
- [ ] Full gate: `nx affected -t test lint` + `nx e2e client-e2e`

**Tests**: e2e · **Gate**: full

**Commit**: `feat(client): environment e2e hook and visual gate script`

---

### T10: Phase regression gate

**What**: Final verifier prep — ensure no `game-core` / server diffs; document visual
gate PNG path for Verifier.
**Where**: (no code unless fixes needed)
**Depends on**: T9
**Reuses**: AD-010 build gate
**Requirement**: ENV-15 + all regression ACs

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `nx run-many -t build lint test` green
- [ ] `nx e2e client-e2e` green
- [ ] `nx test game-core` + `nx test server` green (no regressions)
- [ ] Overview PNG captured for Verifier

**Tests**: none (gate only) · **Gate**: build

**Commit**: `chore(phase-15): green gate for environment art upgrade`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1 ──→ T2

Phase 2 (Parallel):
  T2 complete, then:
    ├── T3 [P] Buildings
    ├── T4 [P] Tree/rock
    └── T5 [P] Peace marker

Phase 3 (Sequential):
  T3,T4,T5 ──→ T6 ──→ T7

Phase 4 (Sequential):
  T7 ──→ T8

Phase 5 (Sequential):
  T8 ──→ T9 ──→ T10
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Static prop loader | 1 module + tests | ✅ Granular |
| T2: Environment manifest | 1 data module + tests | ✅ Granular |
| T3: Building GLBs | Asset files only | ✅ Granular |
| T4: Tree/rock GLBs | Asset files only | ✅ Granular |
| T5: Peace marker GLB | 1 asset file | ✅ Granular |
| T6: Building renderer wiring | 1 integration concern | ✅ Granular |
| T7: Scatter renderer wiring | 1 integration concern | ✅ Granular |
| T8: Test hook | 1 hook surface | ✅ Granular |
| T9: E2e + visual harness | 1 e2e + 1 script + 1 lab | ✅ Granular |
| T10: Regression gate | Verification only | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Phase 1 root | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T2 | T2 → T4 | ✅ Match |
| T5 | T2 | T2 → T5 | ✅ Match |
| T6 | T1, T2, T3, T5 | T3,T4,T5 → T6 | ✅ Match |
| T7 | T1, T4, T6 | T6 → T7 | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |
| T9 | T8 | T8 → T9 | ✅ Match |
| T10 | T9 | T9 → T10 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Static prop loader | unit | unit | ✅ OK |
| T2 | Environment manifest | unit | unit | ✅ OK |
| T3 | GLB assets | none | none | ✅ OK |
| T4 | GLB assets | none | none | ✅ OK |
| T5 | GLB asset | none | none | ✅ OK |
| T6 | Environment placement | unit | unit | ✅ OK |
| T7 | Environment placement | unit | unit | ✅ OK |
| T8 | Test hook | unit | unit | ✅ OK |
| T9 | E2e + visual | e2e | e2e | ✅ OK |
| T10 | Gate only | none | none | ✅ OK |

---

## Requirement → Task Mapping

| Requirement | Task(s) |
| ----------- | ------- |
| ENV-01–03 | T1 |
| ENV-04–07 | T2, T3–T5 |
| ENV-08–10 | T3, T6 |
| ENV-11–13, ENV-22 | T4, T7 |
| ENV-14 | T5, T6 |
| ENV-15 | T10 (regression) |
| ENV-16–18 | T8, T9 |
| ENV-19–21 | T9 |
| ENV-22 | T7 |

**Coverage:** 22/22 mapped ✅
