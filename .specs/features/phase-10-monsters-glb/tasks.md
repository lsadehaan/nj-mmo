# Phase 10 — Monsters: Rigged GLB Mobs + Clone-per-Instance Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** This repo wraps it with
`spec-driven-execution` (Planner → Implementer → Verifier, **autonomous-first**);
honor server-authority (AD-001) and the four test layers (AD-010).

**If the skill cannot be activated, STOP and tell the user — do not proceed
without it.**

---

**Design**: `.specs/features/phase-10-monsters-glb/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `AGENTS.md` (4 test layers + server-authority + seeded RNG +
> 10-second rule), `.specs/STATE.md` AD-009/AD-010/AD-014/AD-015/AD-017,
> existing patterns in `client/src/scene/mobs.spec.ts`,
> `client/src/scene/player-avatar.spec.ts`, `server/src/rooms/TownRoom.spec.ts`,
> `client-e2e/src/combat.spec.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| GLTF template cache + clone factory | unit | MOB-01–04: one load per URL, N instances, independent mixers, player path regression | `client/src/scene/creature/mesh-character.spec.ts` | `nx test client` |
| Creature manifest | unit | MOB-05–07: four npcIds, fallback null, clipMap keys | `client/src/scene/creature/creature-manifest.spec.ts` | `nx test client` |
| Mob avatar (locomotion + state machine wiring) | unit | MOB-18–23: idle/move/attack/die selection, coast timer, die latch | `client/src/scene/mob-avatar.spec.ts` | `nx test client` |
| Mobs renderer (sync, HP bar, fallback) | unit | MOB-05/22/27/28: mesh not capsule for mapped ids; hpBarYOffset | `client/src/scene/mobs.spec.ts` | `nx test client` |
| MobState schema + emitMobAction | room-integration | MOB-13–17/26: attack seq, die-before-delete, respawn reset | `server/src/rooms/TownRoom.spec.ts` | `nx test server` |
| Client hook + room wiring | unit + e2e | MOB-24–25: `__GAME_STATE__.mobs[].action` | `client/src/test-hook.spec.ts`, `client-e2e/src/mob-animation.spec.ts` | `nx test client` + `nx e2e client-e2e` |
| GLB binary assets | none (visual gate) | MOB-08–12/30–31: inspect + screenshots | `client/public/models/monsters/` | `node scripts/shoot-character.mjs` |
| Animation state machine (`game-core`) | none | Regression only — no schema change | — | `nx test game-core` (build gate) |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`client`) | Yes | Per-test three objects; `clearGltfTemplateCache()` in `afterEach` | `client/src/scene/npc-renderer.spec.ts` |
| Unit (`game-core`) | Yes | Pure functions | `libs/game-core/src/animation/*.spec.ts` |
| Room integration (`server`) | Yes | `NJ_AUTOSIM=0` + per-test room + `:memory:` DB (AD-014) | `server/src/rooms/TownRoom.spec.ts` |
| E2E (`client-e2e`) | Yes | Per-test `?room=` instanceKey, 4 workers (AD-014) | `client-e2e/playwright.config.ts` |

## Gate Check Commands

> Generated from codebase (AD-010) — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (client) | After T1–T3, T11–T14 | `nx test client` |
| Quick (server) | After T8–T10, T16 | `nx test server` |
| Full | After T17 | `nx affected -t test lint` + `nx e2e client-e2e` |
| Build | Phase completion (T18) | `nx run-many -t build lint test` |
| Visual | After T15 (before Verifier) | `node scripts/shoot-character.mjs` (mob env vars) |

---

## Execution Plan

**6 phases** (18 tasks).

### Phase 1: Clone backend — Sequential

```
T1 → T2
```

### Phase 2: Manifest — Sequential

```
T2 → T3
```

### Phase 3: Mob GLB assets — Parallel

```
T3 ──┬→ T4 [P] Gremlin
     ├→ T5 [P] Goblin
     ├→ T6 [P] Wolf
     └→ T7 [P] Bearded Keltir
```

### Phase 4: Server mob action signal — Sequential

```
T3 → T8 → T9 → T10
```

### Phase 5: Client mob rendering — Sequential

```
T2,T3,T7 → T11 → T12 → T13 → T14
```

### Phase 6: Gate + integration — Sequential

```
T14 → T15 → T16 → T17 → T18
```

> 6 phases → Execute **offers one sub-agent per phase** (sequential), then a
> fresh Verifier after T18.

---

## Task Breakdown

### T1: GLTF template cache

**What**: `loadGltfTemplate(url)` — deduped promise cache returning
`{ scene, animations }`.
**Where**: `client/src/scene/creature/mesh-character.ts`
**Depends on**: None
**Reuses**: existing `GLTFLoader` usage in `createMeshCharacter`
**Requirement**: MOB-01

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] `loadGltfTemplate` resolves once per URL; concurrent callers share promise
- [ ] `clearGltfTemplateCache()` exported for tests
- [ ] Unit test with mocked loader: two calls → one load
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add GLTF template cache for mob cloning`

---

### T2: Clone-per-instance factory

**What**: `createMeshCharacterInstance(template, opts)` using `SkeletonUtils.clone`
+ per-instance `AnimationMixer`; keep `createMeshCharacter` working.
**Where**: `client/src/scene/creature/mesh-character.ts` (+ `.spec.ts`)
**Depends on**: T1
**Reuses**: `MeshCharacter` interface, `play`/`update`/`setTime`
**Requirement**: MOB-02, MOB-03, MOB-04

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Two instances from one template have distinct roots and mixers
- [ ] `play('attack')` on instance A does not change instance B's pose
- [ ] `createMeshCharacter(url)` regression test still passes
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): clone-per-instance mesh characters`

---

### T3: Creature manifest

**What**: `CreatureEntry` type + `getCreatureEntry(npcId)` with rows for
20001/20003/20120/20481 (clip maps stubbed until T4–T7 finalize track names).
**Where**: `client/src/scene/creature/creature-manifest.ts` (+ `.spec.ts`)
**Depends on**: T2
**Reuses**: `AnimationClip` from `@nj/game-core`; `KAYKIT_CLIP_MAP` export for bipeds if applicable
**Requirement**: MOB-05, MOB-06, MOB-07

**Tools**: MCP: NONE · Skill: `game-designer` → `create-monster.md` Delta B

**Done when**:
- [ ] All four npcIds return entries; unknown → `null`
- [ ] Each entry has `model`, `clipMap`, `scale`, `feetOffsetY`, `hpBarYOffset`
- [ ] Unit tests assert keys and fallback
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add npcId creature manifest`

---

### T4: Gremlin GLB asset (20001) [P]

**What**: Source, inspect, vendor CC0 biped GLB + license; finalize manifest row
for Gremlin with real `clipMap` + scale/feet tuning.
**Where**: `client/public/models/monsters/`, `creature-manifest.ts` (20001 row)
**Depends on**: T3
**Reuses**: `create-character.md` steps 1–3, 6
**Requirement**: MOB-08, MOB-12

**Tools**: MCP: NONE · Skill: `game-designer` → `create-monster.md` + `create-character.md`

**Done when**:
- [ ] `Gremlin.glb` (or chosen name) under `models/monsters/`
- [ ] Inspect script output recorded; `clipMap` uses literal track names
- [ ] `character-lab` renders idle without error
- [ ] Manifest 20001 row updated

**Tests**: none (visual gate in T15) · **Gate**: build (`nx build client`)
**Commit**: `feat(assets): add Gremlin mob GLB + manifest`

---

### T5: Goblin GLB asset (20003) [P]

**What**: Same as T4 for Goblin (humanoid biped, club deferred to Phase 11).
**Where**: `client/public/models/monsters/`, manifest 20003
**Depends on**: T3
**Requirement**: MOB-09, MOB-12

**Tools**: Skill: `game-designer` → `create-monster.md`

**Done when**:
- [ ] Goblin GLB vendored + license if available
- [ ] Manifest 20003 row with real `clipMap`
- [ ] Lab render smoke OK

**Tests**: none · **Gate**: build
**Commit**: `feat(assets): add Goblin mob GLB + manifest`

---

### T6: Wolf GLB asset (20120) [P]

**What**: Quadruped GLB + per-family `clipMap` (not KayKit humanoid map).
**Where**: `client/public/models/monsters/`, manifest 20120
**Depends on**: T3
**Requirement**: MOB-10, MOB-12

**Tools**: Skill: `game-designer` → `create-monster.md` Delta D

**Done when**:
- [ ] Wolf GLB vendored; quadruped clip map from inspected tracks
- [ ] `cast` fallback mapped if missing
- [ ] Lab render smoke OK

**Tests**: none · **Gate**: build
**Commit**: `feat(assets): add Wolf mob GLB + manifest`

---

### T7: Bearded Keltir GLB asset (20481) [P]

**What**: Quadruped GLB + manifest row (distinct from Wolf mesh).
**Where**: `client/public/models/monsters/`, manifest 20481
**Depends on**: T3
**Requirement**: MOB-11, MOB-12

**Tools**: Skill: `game-designer` → `create-monster.md`

**Done when**:
- [ ] Keltir GLB vendored; clip map from inspected tracks
- [ ] Lab render smoke OK
- [ ] Distinct `model` path from Wolf

**Tests**: none · **Gate**: build
**Commit**: `feat(assets): add Bearded Keltir mob GLB + manifest`

---

### T8: Extend MobState with action fields

**What**: Add `action` + `actionSeq` to `MobState` schema (render-only defaults).
**Where**: `server/src/rooms/schema/MobState.ts` (+ schema spec if present)
**Depends on**: T3
**Reuses**: `PlayerState` action fields pattern
**Requirement**: MOB-13

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] `MobState` exposes `action` and `actionSeq` with `@type('number')`
- [ ] Schema/build compiles; existing room tests still pass
- [ ] Quick gate: `nx test server`

**Tests**: none (schema — build gate); regression via server suite · **Gate**: quick
**Commit**: `feat(server): add render-only action fields to MobState`

---

### T9: emitMobAction on mob melee hit

**What**: `emitMobAction(mobState, EntityAction.Attack)` when
`resolveMobAttack` deals damage; generalize helper alongside `emitPlayerAction`.
**Where**: `server/src/rooms/TownRoom.ts`
**Depends on**: T8
**Reuses**: `emitPlayerAction` (`& 0xffff` seq wrap)
**Requirement**: MOB-14, MOB-16

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Confirmed mob hit sets `action=Attack`, `actionSeq` increments
- [ ] Room test: pin Goblin, two hits → `actionSeq` 1 then 2 (Goblin survives first 17 dmg)
- [ ] Quick gate: `nx test server`

**Tests**: room-integration · **Gate**: quick
**Commit**: `feat(server): emit mob ATTACK action on confirmed hit`

---

### T10: emitMobAction DIE before mob delete + respawn reset

**What**: In `handleMobKill`, emit `Die` before `state.mobs.delete`; respawned
mob has `action=0`, `actionSeq=0`.
**Where**: `server/src/rooms/TownRoom.ts` (+ `spawn-manager` respawn path if needed)
**Depends on**: T9
**Requirement**: MOB-15, MOB-17

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Spy/assert: `action=Die` observed on `MobState` before removal
- [ ] After respawn tick, new mob state has `action=0`, `actionSeq=0`
- [ ] Quick gate: `nx test server`

**Tests**: room-integration · **Gate**: quick
**Commit**: `feat(server): emit mob DIE action before kill removal`

---

### T11: Mob avatar controller

**What**: `createMobAvatar(entry, template)` — locomotion coast timer, `stepAnimation`,
`mesh.play`, facing.
**Where**: `client/src/scene/mob-avatar.ts` (+ `.spec.ts`)
**Depends on**: T2, T3
**Reuses**: `player-avatar.ts` (`MOVE_THRESHOLD`, `MOVE_COAST_MS`)
**Requirement**: MOB-18, MOB-19, MOB-20, MOB-23, MOB-29

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Unit tests: position delta → move/idle; actionSeq → attack; die latch
- [ ] Facing helper unit test
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add mob avatar animation controller`

---

### T12: Rewrite mobs.ts for mesh instances

**What**: Replace capsule body with manifest-driven mesh instances; per-mob
`loadGltfTemplate`; capsule fallback; die-delayed removal; manifest `hpBarYOffset`.
**Where**: `client/src/scene/mobs.ts`, `mobs.spec.ts`
**Depends on**: T7, T11
**Reuses**: HP bar helpers; `faceHpBarsToCamera`
**Requirement**: MOB-05, MOB-21, MOB-22, MOB-27, MOB-28

**Tools**: Skill: `game-designer` → `create-monster.md` Delta A/B

**Done when**:
- [ ] Mapped mob groups contain no `CapsuleGeometry` creature body
- [ ] Unknown npcId still gets capsule
- [ ] `removeMob` defers when die playing (unit test with fake timers)
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): render mobs as cloned GLB instances`

---

### T13: Renderer tick + syncMob extension

**What**: `syncMob` carries `npcId`, `action`, `actionSeq`; `tick(dt)` updates
all mob avatars; async template load handled.
**Where**: `client/src/scene/renderer.ts`, `client/src/net/room.ts`
**Depends on**: T12
**Reuses**: `playerAvatar.update` pattern in `tick`
**Requirement**: MOB-23

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] `room.ts` `syncMobFromState` passes new fields
- [ ] Renderer tick calls each mob avatar `update(dt)`
- [ ] Quick gate: `nx test client`

**Tests**: unit (renderer/room if applicable) · **Gate**: quick
**Commit**: `feat(client): wire mob avatar updates in renderer`

---

### T14: Test hook mob action field

**What**: `GameStateMob.action`; `setMobs` publishes clip; renderer publishes after tick.
**Where**: `client/src/test-hook.ts`, `test-hook.spec.ts`
**Depends on**: T13
**Reuses**: `GameStatePlayer.action` pattern
**Requirement**: MOB-24

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] `GameStateMob` includes `action: AnimationClip`
- [ ] Unit test: `setMobs` preserves action field
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): expose mob action clip in __GAME_STATE__`

---

### T15: Visual gate for four mobs

**What**: Extend `character-lab.ts` + `shoot-character.mjs` for mob models;
capture idle/attack/die PNGs for all four types.
**Where**: `client/character-lab.ts`, `scripts/shoot-character.mjs`
**Depends on**: T14
**Reuses**: existing shot harness (`__SHOT_READY__`)
**Requirement**: MOB-30, MOB-31

**Tools**: Skill: `game-designer` → `create-character.md` step 7

**Done when**:
- [ ] Script produces 12+ PNGs (4 mobs × 3 clips minimum)
- [ ] `nx build client` serves lab page with mob query params
- [ ] Visual review recorded in `validation.md` (Verifier)

**Tests**: none (visual) · **Gate**: visual + build
**Commit**: `feat(client): extend character-lab visual gate for mobs`

---

### T16: Room-integration mob action tests

**What**: Consolidate MOB-14–17/26 coverage in `TownRoom.spec.ts` if not already
in T9/T10; mob attack on player test.
**Where**: `server/src/rooms/TownRoom.spec.ts`
**Depends on**: T10
**Reuses**: `placePlayerAndMobForCombat`, `deliverAndTick`, `OUT_OF_PEACE`
**Requirement**: MOB-14, MOB-15, MOB-16, MOB-17, MOB-26

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Mob attack on player sets ATTACK + seq
- [ ] Kill sets DIE before delete; respawn resets action
- [ ] Quick gate: `nx test server`

**Tests**: room-integration · **Gate**: quick
**Commit**: `test(server): mob action signal room coverage`

---

### T17: E2E mob animation observability

**What**: Playwright spec: target mob outside peace zone, attack until kill, poll
`__GAME_STATE__.mobs` for `attack` then `die` on `targetMobId`.
**Where**: `client-e2e/src/mob-animation.spec.ts` (new)
**Depends on**: T14
**Reuses**: `combat.spec.ts` chase/attack poll pattern (AD-014)
**Requirement**: MOB-25

**Tools**: MCP: `user-playwright` (if needed) · Skill: `tlc-spec-driven`

**Done when**:
- [ ] E2e observes `'attack'` at least once during fight
- [ ] E2e observes `'die'` on killing blow (poll before mob entry removed)
- [ ] Full gate: `nx e2e client-e2e`

**Tests**: e2e · **Gate**: full
**Commit**: `test(e2e): assert mob action clips via __GAME_STATE__`

---

### T18: Full build gate + ROADMAP prep

**What**: Run full monorepo gate; ensure no regressions; leave feature ready for
Verifier (do not flip ROADMAP — Verifier writes `validation.md`).
**Where**: n/a (gate only)
**Depends on**: T15, T16, T17
**Requirement**: all MOB-* ACs

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] `nx run-many -t build lint test` green
- [ ] `nx e2e client-e2e` green
- [ ] Test counts recorded vs Phase 9 baseline (no silent deletions)

**Tests**: all layers · **Gate**: build
**Commit**: `chore(phase-10): full gate green for mob GLB phase`

---

## Parallel Execution Map

```
Phase 1:  T1 ──→ T2

Phase 2:  T2 ──→ T3

Phase 3:  T3 ──┬→ T4 [P]
               ├→ T5 [P]
               ├→ T6 [P]
               └→ T7 [P]

Phase 4:  T8 ──→ T9 ──→ T10        (T8 starts after T3; parallel with Phase 3 tail OK)

Phase 5:  T11 ──→ T12 ──→ T13 ──→ T14   (after T7 + T2)

Phase 6:  T15 ──→ T16 ──→ T17 ──→ T18
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Template cache | 1 function + cache | ✅ Granular |
| T2: Clone factory | 1 factory + tests | ✅ Granular |
| T3: Manifest module | 1 data file | ✅ Granular |
| T4–T7: One GLB each | 1 asset + manifest row | ✅ Granular |
| T8: Schema fields | 1 schema file | ✅ Granular |
| T9–T10: Server emit sites | 1 room file, 2 behaviors | ✅ Granular |
| T11: Mob avatar | 1 module | ✅ Granular |
| T12: mobs.ts rewrite | 1 renderer file | ✅ Granular |
| T13–T14: Wiring | 2 integration files | ✅ Granular |
| T15: Visual gate | 2 scripts | ✅ Granular |
| T16–T17: Tests | 1 file each | ✅ Granular |
| T18: Gate | verification only | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Phase 1 root | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T2 | T2 → T3 | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | T3 | T3 → T5 | ✅ |
| T6 | T3 | T3 → T6 | ✅ |
| T7 | T3 | T3 → T7 | ✅ |
| T8 | T3 | T3 → T8 (Phase 4) | ✅ |
| T9 | T8 | T8 → T9 | ✅ |
| T10 | T9 | T9 → T10 | ✅ |
| T11 | T2, T3 | T2,T3 → T11 | ✅ |
| T12 | T7, T11 | T7,T11 → T12 | ✅ |
| T13 | T12 | T12 → T13 | ✅ |
| T14 | T13 | T13 → T14 | ✅ |
| T15 | T14 | T14 → T15 | ✅ |
| T16 | T10 | T10 → T16 | ✅ |
| T17 | T14 | T14 → T17 | ✅ |
| T18 | T15,T16,T17 | T15→T16→T17→T18 | ✅ |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| ---- | ---------- | --------------- | --------- | ------ |
| T1 | clone cache | unit | unit | ✅ |
| T2 | clone factory | unit | unit | ✅ |
| T3 | manifest | unit | unit | ✅ |
| T4–T7 | GLB assets | none | none | ✅ |
| T8 | schema | none | none (build regression) | ✅ |
| T9 | server emit attack | room-integration | room-integration | ✅ |
| T10 | server emit die | room-integration | room-integration | ✅ |
| T11 | mob avatar | unit | unit | ✅ |
| T12 | mobs renderer | unit | unit | ✅ |
| T13 | renderer wiring | unit | unit | ✅ |
| T14 | test hook | unit | unit | ✅ |
| T15 | visual gate | none | none | ✅ |
| T16 | room tests | room-integration | room-integration | ✅ |
| T17 | e2e | e2e | e2e | ✅ |
| T18 | full gate | all | all | ✅ |
