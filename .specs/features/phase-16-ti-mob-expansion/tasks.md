# Phase 16 — Talking Island Mob Expansion (+5) Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** This repo wraps it with
`spec-driven-execution` (Planner → Implementer → Verifier, **autonomous-first**);
honor server-authority (AD-001) and the four test layers (AD-010).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/phase-16-ti-mob-expansion/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `AGENTS.md` (four test layers, determinism, AD-014 harness),
> `.specs/STATE.md` AD-001/009/010/012/014/017/018.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| `TI_MOB_IDS` export | unit | TIMOB-01: nine ids | `server/src/seed/paths.ts` (+ optional `.spec.ts`) | `nx test server` |
| Monster seed | seed | TIMOB-02–07, 13: per-mob anchors + idempotent count 9 | `server/src/seed/seeders/monsters.seeder.spec.ts` | `nx test server` |
| Drop seed | seed | TIMOB-08, 13: drop anchors per new mob | `server/src/seed/seeders/drops.seeder.spec.ts` | `nx test server` |
| Spawn seed | seed | TIMOB-09–10, 13: all ids present; count ≥20 | `server/src/seed/seeders/spawns.seeder.spec.ts` | `nx test server` |
| Spawn placement guards | unit | TIMOB-11–12, 30: peace + walkable + ring order | `server/src/seed/spawn-placement.spec.ts` | `nx test server` |
| Creature manifest | unit | TIMOB-14–17: nine ids, null fallback, clip keys, unique models | `client/src/scene/creature/creature-manifest.spec.ts` | `nx test client` |
| Mobs renderer | unit | TIMOB-24–25: mesh not capsule for new id; mixer regression | `client/src/scene/mobs.spec.ts` | `nx test client` |
| Room mob action | room-integration | TIMOB-26–27: attack + die on Orc/Elder Wolf | `server/src/rooms/TownRoom.spec.ts` | `nx test server` |
| E2E field + combat | e2e | TIMOB-28–29: new npcIds visible; attack/die clips | `client-e2e/src/ti-mob-expansion.spec.ts` | `nx e2e client-e2e` |
| GLB binaries | none (visual gate) | TIMOB-18–23, 31–32: structural + screenshots | `client/public/models/monsters/` | `node scripts/visual-gate.mjs` |
| Clone backend | none | Regression — TIMOB-25 | `client/src/scene/creature/mesh-character.spec.ts` | `nx test client` |
| Animation state machine | none | Regression only | `libs/game-core/src/animation/` | `nx test game-core` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`client`) | Yes | `clearGltfTemplateCache()` in `afterEach` | Phase 10 pattern |
| Unit (`server` seed) | Yes | Temp DB per test (AD-011) | `monsters.seeder.spec.ts` |
| Room integration | Yes | `NJ_AUTOSIM=0` + per-test room + `:memory:` DB (AD-014) | `TownRoom.spec.ts` |
| E2E | Yes | Per-test `?room=` instanceKey (AD-014) | `playwright.config.ts` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (server) | After T1–T4, T16 | `nx test server` |
| Quick (client) | After T10–T11, T15 | `nx test client` |
| Full | After T18 | `nx affected -t test lint` + `nx e2e client-e2e` |
| Build | Phase completion (T19) | `nx run-many -t build lint test` |
| Visual | After T14 (before Verifier) | `node scripts/visual-gate.mjs` + `shoot-character.mjs` |

---

## Execution Plan

**5 phases** (19 tasks).

### Phase 1: Seed data — Sequential

```
T1 → T2 → T3 → T4
```

### Phase 2: Mob GLB assets — Parallel

```
T4 ──┬→ T5 [P] Elpy GLB
     ├→ T6 [P] Elder Keltir GLB
     ├→ T7 [P] Elder Wolf GLB
     ├→ T8 [P] Giant Toad GLB
     └→ T9 [P] Orc GLB
```

### Phase 3: Client manifest — Sequential

```
T5–T9 → T10 → T11
```

### Phase 4: Verification — Sequential

```
T11 → T12 → T13 → T14 → T15 → T16
```

### Phase 5: Gate + docs — Sequential

```
T16 → T17 → T18 → T19
```

---

## Task Breakdown

### T1: Extend `TI_MOB_IDS` + fixture monsters XML

**What**: Append five npcIds to `paths.ts`; add five `<npc>` nodes (stats + dropLists)
to `server/src/seed/__fixtures__/monsters.xml` extracted from L2J Classic.
**Where**: `server/src/seed/paths.ts`, `server/src/seed/__fixtures__/monsters.xml`
**Depends on**: None
**Reuses**: Existing fixture XML shape for Gremlin/Goblin

**Verification criteria**:
- [ ] `TI_MOB_IDS` length === 9 (TIMOB-01)
- [ ] Fixture contains npc ids 20432, 20544, 20442, 20121, 20130
- [ ] `nx test server` — existing seed tests still pass (may fail until T2–T4 update expectations)

**Commit**: `feat(seed): extend TI_MOB_IDS and fixture XML for Phase 16 mobs`

---

### T2: Add spawn rows to `mob_spawns.json`

**What**: Append 12 spawn rows per design ring layout; keep existing 11 rows.
**Where**: `server/src/seed/__fixtures__/mob_spawns.json`
**Depends on**: T1
**Reuses**: `parseMobSpawns`, `DEFAULT_SPAWN_Y`

**Verification criteria**:
- [ ] JSON valid; 23 total rows
- [ ] Each new `(x,z)` outside peace zone (manual check against design table)

**Commit**: `feat(seed): add Phase 16 mob spawn rings`

---

### T3: Spawn placement unit tests

**What**: New `spawn-placement.spec.ts` asserting TIMOB-11/12/30 on full spawn fixture.
**Where**: `server/src/seed/spawn-placement.spec.ts`; update `spawns.seeder.spec.ts` for TIMOB-09/10
**Depends on**: T2
**Reuses**: `isInPeaceZone`, `isWalkable` from `@nj/game-core`

**Verification criteria**:
- [ ] All spawn coords `!isInPeaceZone`
- [ ] All spawn coords walkable
- [ ] Mean distance from origin increases by ring tier (TIMOB-30)
- [ ] `nx test server` green for spawns specs

**Commit**: `test(seed): assert peace zone and walkability for mob spawns`

---

### T4: Seed tests for five new mobs (stats + drops)

**What**: Add monster + drop anchor tests per spec table; update idempotent count to 9.
**Where**: `monsters.seeder.spec.ts`, `drops.seeder.spec.ts`
**Depends on**: T1
**Reuses**: `runSeed({ dataDir: FIXTURE_DATA_DIR })` pattern

**Verification criteria**:
- [ ] TIMOB-03–08: each new mob stat + drop anchor test passes
- [ ] TIMOB-02, 13: nine monsters; idempotent
- [ ] `nx test server` green

**Commit**: `test(seed): Classic stats and drops for five new TI mobs`

---

### T5: Elpy GLB asset (20432)

**What**: Import `Bunny.gltf` → `Elpy.glb`; inspect tracks; tune scale ~0.45 m bbox.
**Where**: `client/public/models/monsters/Elpy.glb`, `scripts/import-pack-assets.mjs`
**Depends on**: T4
**Reuses**: `create-monster.md` ingest workflow; `optimizeTextures`

**Verification criteria**:
- [ ] GLB has skeleton + ≥4 animations
- [ ] Not byte-identical to any existing model (`visual-gate.mjs` on this file)
- [ ] TIMOB-18 ready (manifest wired in T10)

**Commit**: `feat(assets): add Elpy rigged GLB`

---

### T6: Elder Keltir GLB asset (20544)

**What**: Import `Monkroose.gltf` (or Animals deer variant) → `ElderKeltir.glb`; inspect;
distinct from `BeardedKeltir.glb`.
**Where**: `client/public/models/monsters/ElderKeltir.glb`
**Depends on**: T4
**Reuses**: `QUATERNIUS_DEER_CLIP_MAP` if tracks match

**Verification criteria**:
- [ ] Distinct sha256 from `BeardedKeltir.glb`
- [ ] Quadruped silhouette; TIMOB-19

**Commit**: `feat(assets): add Elder Keltir rigged GLB`

---

### T7: Elder Wolf GLB asset (20442)

**What**: Produce `ElderWolf.glb` distinct from `Wolf.glb` — prefer `gen-glb-assets.py`
quadruped preset or second canid import.
**Where**: `client/public/models/monsters/ElderWolf.glb`, optionally `scripts/gen-glb-assets.py`
**Depends on**: T4
**Reuses**: `QUATERNIUS_WOLF_CLIP_MAP` if tracks match

**Verification criteria**:
- [ ] sha256 ≠ `Wolf.glb`
- [ ] TIMOB-20; visual-gate dedup PASS

**Commit**: `feat(assets): add Elder Wolf rigged GLB`

---

### T8: Giant Toad GLB asset (20121)

**What**: Import `Frog.gltf` → `GiantToad.glb`; inspect; tune wide bbox.
**Where**: `client/public/models/monsters/GiantToad.glb`
**Depends on**: T4
**Reuses**: New frog clip map constant

**Verification criteria**:
- [ ] Amphibian silhouette; TIMOB-21
- [ ] structural visual-gate PASS

**Commit**: `feat(assets): add Giant Toad rigged GLB`

---

### T9: Orc GLB asset (20130)

**What**: Import `Big/glTF/Orc.gltf` → `Orc.glb` (NOT Blob Orc used by Goblin).
**Where**: `client/public/models/monsters/Orc.glb`
**Depends on**: T4
**Reuses**: `ULTIMATE_MONSTER_CLIP_MAP` or Big-Orc map after inspect

**Verification criteria**:
- [ ] sha256 ≠ `Goblin.glb`
- [ ] Humanoid biped; TIMOB-22

**Commit**: `feat(assets): add Orc rigged GLB`

---

### T10: Extend `creature-manifest.ts` for five new mobs

**What**: Add five `CreatureEntry` rows; export any new clip map constants; update
`LICENSE.txt`.
**Where**: `client/src/scene/creature/creature-manifest.ts`,
`client/public/models/monsters/LICENSE.txt`
**Depends on**: T5–T9
**Reuses**: Phase 10 manifest pattern

**Verification criteria**:
- [ ] All five npcIds resolve via `getCreatureEntry`
- [ ] Unique `model` paths (TIMOB-17)
- [ ] All clipMap keys populated (TIMOB-16)

**Commit**: `feat(client): creature manifest entries for five new TI mobs`

---

### T11: Update creature-manifest unit tests

**What**: `SEEDED_NPC_IDS` → nine ids; per-id entry test; clip family assertions.
**Where**: `client/src/scene/creature/creature-manifest.spec.ts`
**Depends on**: T10

**Verification criteria**:
- [ ] TIMOB-14–17 pass
- [ ] `nx test client` green

**Commit**: `test(client): extend creature-manifest coverage to nine mobs`

---

### T12: Mobs renderer regression for new npcId

**What**: Extend `mobs.spec.ts` — one mapped new mob (e.g. 20130) renders mesh not capsule.
**Where**: `client/src/scene/mobs.spec.ts`
**Depends on**: T10
**Reuses**: Existing mock template pattern

**Verification criteria**:
- [ ] TIMOB-24 passes
- [ ] `nx test client` green

**Commit**: `test(client): mob mesh renders for Orc npcId`

---

### T13: Room-integration — Orc attack and kill signals

**What**: Extend `TownRoom.spec.ts` — pin Orc at outer spawn; assert `action`/`actionSeq`
on hit and die (TIMOB-26/27).
**Where**: `server/src/rooms/TownRoom.spec.ts`
**Depends on**: T1–T4
**Reuses**: `OUT_OF_PEACE`, `deliverAndTick`, `placePlayerAndMobForCombat`

**Verification criteria**:
- [ ] Mob attack increments `actionSeq`
- [ ] Die emitted before delete
- [ ] `nx test server` green; file <30 s (AD-014)

**Commit**: `test(server): mob action signal for Orc`

---

### T14: Visual gate — structural + screenshots

**What**: Run `node scripts/visual-gate.mjs` (all models); shoot idle/attack/die for
each new mob via `shoot-character.mjs`; store PNGs for review.
**Where**: `scripts/visual-gate.mjs`, `scripts/shoot-character.mjs`, review artifacts
**Depends on**: T5–T10
**Reuses**: Phase 10 character-lab mob params

**Verification criteria**:
- [ ] TIMOB-31: 0 FAIL from visual-gate
- [ ] TIMOB-32: 15 PNGs minimum (5 mobs × 3 clips)
- [ ] TIMOB-23: LICENSE.txt updated

**Commit**: `chore(assets): visual gate PASS for Phase 16 mobs`

---

### T15: E2E — field walk discovers new mob types

**What**: New `client-e2e/src/ti-mob-expansion.spec.ts` — walk player to x≈60,z≈−40;
poll until `mobs.some(m => [20432,20544,20442,20121,20130].includes(m.npcId))`.
**Where**: `client-e2e/src/ti-mob-expansion.spec.ts`
**Depends on**: T1–T2, T10
**Reuses**: `gotoGame`, `__sendMoveIntent__`, AD-014 room isolation

**Verification criteria**:
- [ ] TIMOB-28 passes
- [ ] `nx e2e client-e2e` green

**Commit**: `test(e2e): outer field exposes new TI mob npcIds`

---

### T16: E2E — kill new mob attack/die animation

**What**: Same spec file (or second test) — target Orc or Elder Wolf; assert attack
then die via `__GAME_STATE__.mobs` (mirror `mob-animation.spec.ts`).
**Where**: `client-e2e/src/ti-mob-expansion.spec.ts`
**Depends on**: T15
**Reuses**: `approachMob`, `pickNthNearestCombatMob` or npcId filter

**Verification criteria**:
- [ ] TIMOB-29 passes
- [ ] `nx e2e client-e2e` green

**Commit**: `test(e2e): new mob attack and die clips during combat`

---

### T17: Full Nx affected gate

**What**: Run `nx affected -t test lint` + `nx e2e client-e2e`; fix any regressions.
**Where**: —
**Depends on**: T1–T16

**Verification criteria**:
- [ ] All server/client/game-core tests pass
- [ ] E2E suite green (21+ tests)
- [ ] No test >30 s red flag (AD-014)

**Commit**: (no commit if green only; otherwise fix commits per issue)

---

### T18: Extend `import-pack-assets.mjs` for reproducibility

**What**: Add Phase 16 copy block + LICENSE notes so assets can be regenerated.
**Where**: `scripts/import-pack-assets.mjs`
**Depends on**: T5–T9
**Reuses**: Existing `copyGltf` / `optimizeAll`

**Verification criteria**:
- [ ] Script runs without error when packs present
- [ ] Documented sources match vendored GLBs

**Commit**: `chore(assets): import-pack-assets Phase 16 mob block`

---

### T19: Build gate + handoff prep

**What**: `nx run-many -t build lint test`; ensure ROADMAP checklist items ready for
Verifier (do NOT flip ROADMAP — Verifier owns PASS).
**Where**: —
**Depends on**: T17–T18

**Verification criteria**:
- [ ] Build gate green
- [ ] All 32 ACs traceable to tests or visual gate
- [ ] Ready for Verifier `validation.md`

**Commit**: `chore: Phase 16 implementer gate complete`

---

## Requirement → Task Traceability

| AC | Task(s) |
| -- | ------- |
| TIMOB-01 | T1 |
| TIMOB-02–07, 13 | T4 |
| TIMOB-08 | T4 |
| TIMOB-09–10, 13 | T3, T2 |
| TIMOB-11–12, 30 | T3 |
| TIMOB-14–17 | T10, T11 |
| TIMOB-18 | T5, T10, T14 |
| TIMOB-19 | T6, T10, T14 |
| TIMOB-20 | T7, T10, T14 |
| TIMOB-21 | T8, T10, T14 |
| TIMOB-22 | T9, T10, T14 |
| TIMOB-23 | T10, T14 |
| TIMOB-24–25 | T12 |
| TIMOB-26–27 | T13 |
| TIMOB-28 | T15 |
| TIMOB-29 | T16 |
| TIMOB-31–32 | T14 |

---

## Deviations Log

| Task | Potential deviation | Escalation |
| ---- | ------------------- | ---------- |
| T7 | No distinct wolf in packs → procedural only | Document in validation; must pass dedup |
| T6 | Monkroose clips ≠ deer map | Add `QUATERNIUS_MONKROOSE_CLIP_MAP` |
| T2 | Walkability fails on designed coord | Nudge ±2 m within same ring; update design |

---

## Verifier Handoff

After T19, dispatch Verifier with:
- Spec: `.specs/features/phase-16-ti-mob-expansion/spec.md` (32 ACs)
- Diff: branch commits T1–T19
- Sensor targets: spawn peace-zone guard, manifest unique models, Orc room action
- Visual: review T14 PNGs + `visual-gate.mjs` output
- Output: `.specs/features/phase-16-ti-mob-expansion/validation.md`
