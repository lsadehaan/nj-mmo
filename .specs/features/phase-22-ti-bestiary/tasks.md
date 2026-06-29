# Phase 22 — Complete TI Bestiary Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** This repo wraps it with
`spec-driven-execution` (Planner → Implementer → Verifier, **autonomous-first**);
honor server-authority (AD-001) and the three test layers (AD-010) — **no Playwright**.

**Skill:** `game-designer` → `references/create-monster.md` for **T5–T18** (read
`create-character.md` first).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/phase-22-ti-bestiary/design.md`
**Spec**: `.specs/features/phase-22-ti-bestiary/spec.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `AGENTS.md` (three test layers post-MVP, determinism, AD-014),
> `.specs/STATE.md` AD-001/009/010/012/014/017/018.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| `TI_MOB_IDS` + parser | unit | BEST22-01; parser fields | `server/src/seed/paths.ts`, `parsers/monsters.parser.ts` | `nx test server` |
| Monster/drop/spawn seed | seed | BEST22-02–22 | `server/src/seed/seeders/*.spec.ts` | `nx test server` |
| Spawn placement | unit | BEST22-20–21, 53 | `server/src/seed/spawn-placement.spec.ts` | `nx test server` |
| Ranged AI pure | unit | BEST22-45–46 | `libs/game-core/src/combat/ranged-mob-ai.spec.ts` | `nx test game-core` |
| Mob AI integration | unit + room | BEST22-47–50 | `server/src/rooms/mob-ai.spec.ts`, `TownRoom.spec.ts` | `nx test server` |
| Creature manifest | unit | BEST22-23–26 | `client/src/scene/creature/creature-manifest.spec.ts` | `nx test client` |
| Mobs renderer | unit | BEST22-42 | `client/src/scene/mobs.spec.ts` | `nx test client` |
| wireRoom / test-hook | unit | BEST22-51–52 | `client/src/net/wireRoom.spec.ts`, `test-hook.spec.ts` | `nx test client` |
| GLB binaries | none (visual gate) | BEST22-27–41, 54–55 | `client/public/models/monsters/` | `node scripts/visual-gate.mjs` |
| Schema migration | build | monsters columns | `server/src/db/schema.ts` | `nx build server` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`game-core`, `client`) | Yes | Vitest per-file | Existing `*.spec.ts` |
| Unit (`server` seed) | Yes | Temp DB per test (AD-011) | `monsters.seeder.spec.ts` |
| Room integration | Yes | `NJ_AUTOSIM=0` + per-test room + temp DB (AD-014) | `TownRoom.spec.ts` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (game-core) | After T21 | `nx test game-core` |
| Quick (server) | After T1–T4, T22–T23 | `nx test server` |
| Quick (client) | After T19–T20, T24 | `nx test client` |
| Full | After T24 | `nx affected -t test lint` |
| Build | Phase completion (T27) | `nx run-many -t build lint test` |
| Visual | After T25–T26 (before Verifier) | `node scripts/visual-gate.mjs` + `shoot-character.mjs` |

**Speed contract:** Room tests use `NJ_AUTOSIM=0` + `deliver()`/`tick()` — no wall-clock
sleeps. Per-test cap ≤ **10 s** (AD-014).

---

## Execution Plan

**6 phases** (27 tasks).

### Phase 1: Seed & schema — Sequential

```
T1 → T2 → T3 → T4
```

### Phase 2: Mob GLB assets — Parallel

```
T4 ──┬→ T5 [P] Orc Soldier GLB
     ├→ T6 [P] Orc Archer GLB
     ├→ T7 [P] Goblin Scout GLB
     ├→ T8 [P] Werewolf GLB
     ├→ T9 [P] Werewolf Hunter GLB
     ├→ T10 [P] Orc Warrior GLB
     ├→ T11 [P] Orc Lieutenant GLB
     ├→ T12 [P] Orc Captain GLB
     ├→ T13 [P] Werewolf Chieftain GLB
     ├→ T14 [P] Stone Golem GLB
     ├→ T15 [P] Crasher GLB
     ├→ T16 [P] Giant Spider GLB
     ├→ T17 [P] Giant Fang Spider GLB
     └→ T18 [P] Giant Blade Spider GLB
```

### Phase 3: Client manifest — Sequential

```
T5–T18 → T19 → T20
```

### Phase 4: Mob AI — Sequential

```
T4 → T21 → T22 → T23
```

### Phase 5: Client observability — Sequential

```
T19 → T24
```

### Phase 6: Visual gate & final — Sequential

```
T20, T23, T24 → T25 → T26 → T27
```

---

## Task Breakdown

### T1: Extend `TI_MOB_IDS` + fixture monsters XML

**What**: Append fourteen npcIds to `paths.ts`; add fourteen `<npc>` nodes with dropLists
to `server/src/seed/__fixtures__/monsters.xml` from L2J Classic.
**Where**: `server/src/seed/paths.ts`, `server/src/seed/__fixtures__/monsters.xml`
**Depends on**: None
**Reuses**: Phase 16 fixture XML shape
**Requirement**: BEST22-01

**Done when**:

- [ ] `TI_MOB_IDS` length === 23 (BEST22-01)
- [ ] Fixture contains all fourteen new npc ids
- [ ] Gate: `nx test server` (seed may fail until T2–T4)

**Tests**: none (config/fixture)
**Gate**: build

**Commit**: `feat(seed): extend TI_MOB_IDS and fixture XML for Phase 22 bestiary`

---

### T2: Monster schema + parser (`aiType`, `clan`, ranges)

**What**: Drizzle columns on `monsters`; extend `monsters.parser.ts` for `aiType`,
`clan`, `clanHelpRange`, `preferredAttackRange`; migration if required.
**Where**: `server/src/db/schema.ts`, `server/src/seed/parsers/monsters.parser.ts`
**Depends on**: T1
**Reuses**: Existing `parseMonsters` pattern
**Requirement**: BEST22-03–16 (metadata)

**Done when**:

- [ ] Parser extracts ARCHER + WEREWOLF clan from fixture Orc Archer / Werewolf nodes
- [ ] Seed inserts `aiType`, `clan`, `clanHelpRange` for new mobs
- [ ] Gate: `nx test server` seed specs green for monster rows (BEST22-02–16)

**Tests**: seed
**Gate**: quick (server)

**Commit**: `feat(seed): parse mob aiType and clan metadata for Phase 22`

---

### T3: Add spawn rows to `mob_spawns.json`

**What**: Append ~35 spawn rows per design rings 6–10; preserve existing rows.
**Where**: `server/src/seed/__fixtures__/mob_spawns.json`
**Depends on**: T1
**Reuses**: `parseMobSpawns`, `DEFAULT_SPAWN_Y`
**Requirement**: BEST22-18–19

**Done when**:

- [ ] Total spawn rows ≥ 55
- [ ] Each of fourteen new npcIds has ≥ 2 spawn rows
- [ ] All new `(x,z)` outside peace zone (manual vs design table)

**Tests**: none
**Gate**: build

**Commit**: `feat(seed): add Phase 22 mob spawn rings 6–10`

---

### T4: Spawn placement + seeder spec updates

**What**: Extend `spawn-placement.spec.ts` and seeder specs for BEST22-17–22, 53.
**Where**: `server/src/seed/spawn-placement.spec.ts`, `seeders/*.spec.ts`
**Depends on**: T2, T3
**Reuses**: `isInPeaceZone`, `isWalkable` from `@nj/game-core`
**Requirement**: BEST22-17–22, 53

**Done when**:

- [ ] All spawn coords `!isInPeaceZone` and walkable (BEST22-20–21)
- [ ] Ring tier monotonic level test (BEST22-53)
- [ ] Drop anchor assertions per new mob (BEST22-17)
- [ ] Gate: `nx test server` green

**Tests**: unit + seed
**Gate**: quick (server)

**Commit**: `test(seed): Phase 22 spawn placement and seed anchors`

---

### T5: Orc Soldier GLB (20131) [P]

**What**: Ingest `OrcSoldier.glb`; inspect tracks; tune scale/feet/HP bar in character-lab.
**Where**: `client/public/models/monsters/OrcSoldier.glb`
**Depends on**: T4
**Reuses**: `import-pack-assets.mjs`, `create-monster.md`
**Requirement**: BEST22-27

**Done when**:

- [ ] GLB rigged; idle/move/attack/die tracks mapped
- [ ] Distinct from `Orc.glb` (visual-gate dedup)
- [ ] LICENSE source noted

**Tests**: none
**Gate**: build

**Commit**: `feat(assets): add Orc Soldier rigged GLB (20131)`

---

### T6: Orc Archer GLB (20006) [P]

**What**: Ingest `OrcArcher.glb` — humanoid archer silhouette.
**Where**: `client/public/models/monsters/OrcArcher.glb`
**Depends on**: T4
**Requirement**: BEST22-28

**Done when**:

- [ ] GLB rigged; clip map complete
- [ ] Distinct from Orc Soldier and Orc

**Tests**: none
**Gate**: build

**Commit**: `feat(assets): add Orc Archer rigged GLB (20006)`

---

### T7: Goblin Scout GLB (20326) [P]

**What**: Ingest `GoblinScout.glb` — distinct from Goblin (20003).
**Where**: `client/public/models/monsters/GoblinScout.glb`
**Depends on**: T4
**Requirement**: BEST22-29

**Done when**:

- [ ] GLB rigged; distinct scout silhouette

**Tests**: none
**Gate**: build

**Commit**: `feat(assets): add Goblin Scout rigged GLB (20326)`

---

### T8: Werewolf GLB (20132) [P]

**What**: Ingest `Werewolf.glb` — bipedal beast.
**Where**: `client/public/models/monsters/Werewolf.glb`
**Depends on**: T4
**Requirement**: BEST22-30

**Done when**:

- [ ] GLB rigged; new werewolf clip map if needed

**Tests**: none
**Gate**: build

**Commit**: `feat(assets): add Werewolf rigged GLB (20132)`

---

### T9: Werewolf Hunter GLB (20343) [P]

**What**: Ingest `WerewolfHunter.glb`.
**Where**: `client/public/models/monsters/WerewolfHunter.glb`
**Depends on**: T4
**Requirement**: BEST22-31

**Done when**:

- [ ] Distinct from Werewolf (20132)

**Tests**: none
**Gate**: build

**Commit**: `feat(assets): add Werewolf Hunter rigged GLB (20343)`

---

### T10: Orc Warrior GLB (20093) [P]

**What**: Ingest `OrcWarrior.glb`.
**Where**: `client/public/models/monsters/OrcWarrior.glb`
**Depends on**: T4
**Requirement**: BEST22-32

**Done when**:

- [ ] Warrior silhouette distinct from Soldier/Archer

**Tests**: none
**Gate**: build

**Commit**: `feat(assets): add Orc Warrior rigged GLB (20093)`

---

### T11: Orc Lieutenant GLB (20096) [P]

**What**: Ingest `OrcLieutenant.glb`.
**Where**: `client/public/models/monsters/OrcLieutenant.glb`
**Depends on**: T4
**Requirement**: BEST22-33

**Done when**:

- [ ] Distinct officer variant

**Tests**: none
**Gate**: build

**Commit**: `feat(assets): add Orc Lieutenant rigged GLB (20096)`

---

### T12: Orc Captain GLB (20098) [P]

**What**: Ingest `OrcCaptain.glb`.
**Where**: `client/public/models/monsters/OrcCaptain.glb`
**Depends on**: T4
**Requirement**: BEST22-34

**Done when**:

- [ ] Distinct captain silhouette

**Tests**: none
**Gate**: build

**Commit**: `feat(assets): add Orc Captain rigged GLB (20098)`

---

### T13: Werewolf Chieftain GLB (20342) [P]

**What**: Ingest `WerewolfChieftain.glb` — larger chieftain.
**Where**: `client/public/models/monsters/WerewolfChieftain.glb`
**Depends on**: T4
**Requirement**: BEST22-35

**Done when**:

- [ ] Distinct from Werewolf/Hunter

**Tests**: none
**Gate**: build

**Commit**: `feat(assets): add Werewolf Chieftain rigged GLB (20342)`

---

### T14: Stone Golem GLB (20016) [P]

**What**: Ingest `StoneGolem.glb`.
**Where**: `client/public/models/monsters/StoneGolem.glb`
**Depends on**: T4
**Requirement**: BEST22-36

**Done when**:

- [ ] Bulky golem/construct mesh

**Tests**: none
**Gate**: build

**Commit**: `feat(assets): add Stone Golem rigged GLB (20016)`

---

### T15: Crasher GLB (20101) [P]

**What**: Ingest `Crasher.glb` — insectoid.
**Where**: `client/public/models/monsters/Crasher.glb`
**Depends on**: T4
**Requirement**: BEST22-37

**Done when**:

- [ ] Insectoid crusher silhouette

**Tests**: none
**Gate**: build

**Commit**: `feat(assets): add Crasher rigged GLB (20101)`

---

### T16: Giant Spider GLB (20103) [P]

**What**: Ingest `GiantSpider.glb`.
**Where**: `client/public/models/monsters/GiantSpider.glb`
**Depends on**: T4
**Requirement**: BEST22-38

**Done when**:

- [ ] Arachnid mesh; spider clip map family

**Tests**: none
**Gate**: build

**Commit**: `feat(assets): add Giant Spider rigged GLB (20103)`

---

### T17: Giant Fang Spider GLB (20106) [P]

**What**: Ingest `GiantFangSpider.glb` — **distinct** from 20103.
**Where**: `client/public/models/monsters/GiantFangSpider.glb`
**Depends on**: T4
**Requirement**: BEST22-39

**Done when**:

- [ ] Byte-distinct from GiantSpider.glb

**Tests**: none
**Gate**: build

**Commit**: `feat(assets): add Giant Fang Spider rigged GLB (20106)`

---

### T18: Giant Blade Spider GLB (20108) [P]

**What**: Ingest `GiantBladeSpider.glb` — **distinct** from 20103/20106.
**Where**: `client/public/models/monsters/GiantBladeSpider.glb`
**Depends on**: T4
**Requirement**: BEST22-40

**Done when**:

- [ ] Byte-distinct from other spider GLBs

**Tests**: none
**Gate**: build

**Commit**: `feat(assets): add Giant Blade Spider rigged GLB (20108)`

---

### T19: Extend `creature-manifest.ts` (+14 entries)

**What**: Add `CreatureEntry` rows for all fourteen new npcIds; update `import-pack-assets.mjs`
Phase 22 block + `LICENSE.txt`.
**Where**: `client/src/scene/creature/creature-manifest.ts`, `scripts/import-pack-assets.mjs`
**Depends on**: T5–T18
**Reuses**: Phase 10/16 manifest pattern
**Requirement**: BEST22-23, BEST22-41

**Done when**:

- [ ] `getCreatureEntry` returns entries for all fourteen new ids
- [ ] Each `model` path unique (BEST22-26 partial)

**Tests**: none
**Gate**: build

**Commit**: `feat(client): creature manifest entries for Phase 22 mobs`

---

### T20: `creature-manifest.spec.ts` — 23 seeded ids

**What**: Update `SEEDED_NPC_IDS` to 23; assert clip maps and uniqueness.
**Where**: `client/src/scene/creature/creature-manifest.spec.ts`
**Depends on**: T19
**Requirement**: BEST22-23–26

**Done when**:

- [ ] `SEEDED_NPC_IDS` length 23
- [ ] All clip keys non-empty; unique model paths
- [ ] Gate: `nx test client` green

**Tests**: unit
**Gate**: quick (client)

**Commit**: `test(client): creature manifest covers 23 TI mob ids`

---

### T21: Ranged mob AI pure helpers (`game-core`)

**What**: `ranged-mob-ai.ts` with `shouldRangedMobAdvance`, `isInRangedAttackBand`; unit tests.
**Where**: `libs/game-core/src/combat/ranged-mob-ai.ts`
**Depends on**: T2
**Requirement**: BEST22-45–46

**Done when**:

- [ ] Unit tests cover chase band, hold band, edge at 4 m and 8 m
- [ ] Gate: `nx test game-core` green

**Tests**: unit
**Gate**: quick (game-core)

**Commit**: `feat(game-core): pure helpers for ranged mob chase band`

---

### T22: Mob AI integration (ranged + WEREWOLF social)

**What**: Extend `MobRuntime` + `spawn-manager`; `mob-ai.ts` ARCHER hold/chase;
`findClanAssistTargets` for WEREWOLF; unit tests in `mob-ai.spec.ts`.
**Where**: `server/src/rooms/mob-ai.ts`, `spawn-manager.ts`, `mob-ai.spec.ts`
**Depends on**: T21
**Requirement**: BEST22-45–46, BEST22-50

**Done when**:

- [ ] Archer does not advance when in 4–8 m band
- [ ] Social assist only for `clan === 'WEREWOLF'` within 30 m
- [ ] Gate: `nx test server` mob-ai specs green

**Tests**: unit
**Gate**: quick (server)

**Commit**: `feat(server): ranged Orc Archer AI and werewolf clan assist`

---

### T23: Room-integration combat + AI pins

**What**: `TownRoom.spec.ts` — Orc Archer damage at 6 m (BEST22-47); werewolf pack assist
(BEST22-48–49); Stone Golem attack action (BEST22-43); Orc Warrior die (BEST22-44).
**Where**: `server/src/rooms/TownRoom.spec.ts`
**Depends on**: T22, T4
**Requirement**: BEST22-43–44, BEST22-47–49

**Done when**:

- [ ] Room tests use `NJ_AUTOSIM=0` + `tick()`/`deliver()` only
- [ ] All four AI/combat pins pass
- [ ] Gate: `nx test server` green

**Tests**: room-integration
**Gate**: quick (server)

**Commit**: `test(server): Phase 22 ranged and social mob AI room anchors`

---

### T24: Client `wireRoom` + `__GAME_STATE__.mobs` for new types

**What**: Extend `wireRoom.spec.ts` / `test-hook.spec.ts` for new npcIds and attack action;
`mobs.spec.ts` mesh-not-capsule pin (BEST22-42).
**Where**: `client/src/net/wireRoom.spec.ts`, `client/src/scene/mobs.spec.ts`
**Depends on**: T19
**Requirement**: BEST22-42, BEST22-51–52

**Done when**:

- [ ] `__GAME_STATE__.mobs` includes npcIds 20006, 20132, 20016, 20103
- [ ] Attack action observed on mock sync
- [ ] Gate: `nx test client` green

**Tests**: unit
**Gate**: quick (client)

**Commit**: `test(client): wireRoom exposes Phase 22 mob types and actions`

---

### T25: Structural visual gate

**What**: Run `node scripts/visual-gate.mjs`; fix any dedup/static/rig failures for fourteen GLBs.
**Where**: `scripts/visual-gate.mjs`, `client/public/models/monsters/`
**Depends on**: T5–T18, T19
**Requirement**: BEST22-54

**Done when**:

- [ ] `visual-gate.mjs` exits 0
- [ ] All fourteen new GLBs PASS structural checks

**Tests**: none
**Gate**: visual

**Commit**: `chore(assets): Phase 22 visual gate structural PASS`

---

### T26: Character-lab screenshots (idle / attack / die)

**What**: `shoot-character.mjs` for each of fourteen mobs; Verifier perception review.
**Where**: `scripts/shoot-character.mjs`, `client/character-lab.html`
**Depends on**: T25
**Requirement**: BEST22-27–40, BEST22-55

**Done when**:

- [ ] PNGs captured for fourteen mobs × (idle, attack, die)
- [ ] Fidelity reviewed per entity description (AD-017)

**Tests**: none
**Gate**: visual

**Commit**: `chore(assets): Phase 22 mob screenshot gate`

---

### T27: Full monorepo gate

**What**: `nx run-many -t build lint test`; fix any regressions.
**Where**: repo-wide
**Depends on**: T4, T20, T23, T24, T26
**Requirement**: all BEST22-*

**Done when**:

- [ ] Full gate green
- [ ] No Playwright / client-e2e invoked

**Tests**: all layers
**Gate**: build

**Commit**: `chore(phase-22): green gate for TI bestiary completion`

---

## Parallel Execution Map

```
Phase 1:  T1 → T2 → T3 → T4
Phase 2:  T4 complete → T5…T18 [P] (any order)
Phase 3:  T5…T18 → T19 → T20
Phase 4:  T4 → T21 → T22 → T23  (T23 also needs T22)
Phase 5:  T19 → T24
Phase 6:  T25 → T26 → T27
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: paths + fixture XML | 2 files, one concept | ✅ Granular |
| T2: parser + schema | 1 parser + schema | ✅ Granular |
| T3: spawn JSON | 1 file | ✅ Granular |
| T4: spawn tests | 1 test module | ✅ Granular |
| T5–T18: one GLB each | 1 asset | ✅ Granular |
| T19: manifest rows | 1 manifest file | ✅ Granular |
| T20: manifest tests | 1 spec file | ✅ Granular |
| T21: ranged pure | 1 module | ✅ Granular |
| T22: mob-ai integration | mob-ai + spawn-manager | ✅ Granular |
| T23: room pins | TownRoom.spec extension | ✅ Granular |
| T24: wireRoom tests | client net specs | ✅ Granular |
| T25–T26: visual gate | CI scripts | ✅ Granular |
| T27: full gate | repo-wide | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Phase 1 start | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T1 | T1 → T3 | ✅ |
| T4 | T2, T3 | T2 → T3 → T4 | ✅ |
| T5–T18 | T4 | T4 → T5…T18 [P] | ✅ |
| T19 | T5–T18 | Phase 3 after GLBs | ✅ |
| T20 | T19 | T19 → T20 | ✅ |
| T21 | T2 | T4 → T21 (via T2 chain) | ✅ |
| T22 | T21 | T21 → T22 | ✅ |
| T23 | T22, T4 | T22 → T23 | ✅ |
| T24 | T19 | T19 → T24 | ✅ |
| T25 | T5–T18, T19 | Phase 6 | ✅ |
| T26 | T25 | T25 → T26 | ✅ |
| T27 | T4, T20, T23, T24, T26 | T26 → T27 | ✅ |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| ---- | ---------- | --------------- | --------- | ------ |
| T1 | config/fixture | none | none | ✅ |
| T2 | seed/parser | seed | seed | ✅ |
| T3 | spawn JSON | none | none | ✅ |
| T4 | spawn + seed | unit + seed | unit + seed | ✅ |
| T5–T18 | GLB assets | none | none | ✅ |
| T19 | manifest | none | none | ✅ |
| T20 | manifest | unit | unit | ✅ |
| T21 | game-core | unit | unit | ✅ |
| T22 | mob-ai | unit | unit | ✅ |
| T23 | TownRoom | room-integration | room-integration | ✅ |
| T24 | wireRoom | unit | unit | ✅ |
| T25–T26 | visual | none | none | ✅ |
| T27 | all | all | all | ✅ |

---

## Requirement → Task Map (summary)

| Requirement IDs | Task(s) |
| --------------- | ------- |
| BEST22-01 | T1 |
| BEST22-02–16 | T2, T4 |
| BEST22-17–22, 53 | T4 |
| BEST22-18–19 | T3, T4 |
| BEST22-23–26 | T19, T20 |
| BEST22-27–40, 41 | T5–T18, T19, T26 |
| BEST22-42 | T24 |
| BEST22-43–44, 47–49 | T23 |
| BEST22-45–46, 50 | T21, T22 |
| BEST22-51–52 | T24 |
| BEST22-54–55 | T25, T26 |
| All | T27 |

**Coverage:** 55 ACs → 27 tasks; all ACs mapped.
