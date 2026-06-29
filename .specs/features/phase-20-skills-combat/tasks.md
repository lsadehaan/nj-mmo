# Phase 20 — Skills & Combat Depth Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** This repo wraps it with
`spec-driven-execution` (Planner → Implementer → Verifier, **autonomous-first**);
honor server-authority (AD-001) and the three test layers (AD-010) — **no Playwright**.

**If the skill cannot be activated, STOP and tell the user — do not proceed
without it.**

---

**Design**: `.specs/features/phase-20-skills-combat/design.md`
**Spec**: `.specs/features/phase-20-skills-combat/spec.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from spec ACs, `AGENTS.md`, and `.specs/STATE.md` AD-009/AD-010/AD-012/AD-014.
> Post-MVP gate: **no `client-e2e` / Playwright** for this phase.

| Code Layer | Required Test Type | ACs | Location Pattern | Run Command |
| ---------- | ------------------ | --- | ---------------- | ----------- |
| Skill + tree seed | seed | SKILL20-01–08 | `server/src/seed/skills*.spec.ts`, `class-skill-tree.seed.spec.ts` | `nx test server` |
| Character skills repo | unit | SKILL20-09–12 | `server/src/db/character-repository.spec.ts` | `nx test server` |
| Stat bonus INT/DEX + mAtk | unit | SKILL20-28 (mAtk), 43–46 | `libs/game-core/src/class/*.spec.ts`, `combat/*.spec.ts` | `nx test game-core` |
| Magic + physical + effects + crit | unit | SKILL20-21–23, 28, 38–40, 43–46 | `libs/game-core/src/combat/*.spec.ts`, `effects/*.spec.ts` | `nx test game-core` |
| Skill resolver | unit | SKILL20-21–23, 26–29, 38–40 | `server/src/rooms/skill-resolver.spec.ts` or `combat-resolver.spec.ts` | `nx test server` |
| TownRoom learn/use/cast/shot | room-integration | SKILL20-13–19, 21–25, 27–29, 31–37, 41 | `server/src/rooms/TownRoom.spec.ts` | `nx test server` |
| Trainer + hotbar + cast bar DOM | unit | SKILL20-20, 30, 37, 42, 47–52 | `client/src/ui/*.spec.ts`, `combat-input.spec.ts` | `nx test client` |
| wireRoom + `__GAME_STATE__` | unit | SKILL20-13, 42, 50–51 | `client/src/net/wire-room.spec.ts` | `nx test client` |
| Folk NPC seed | seed | SKILL20-15–18 (npc rows) | `server/src/seed/npcs*.spec.ts` | `nx test server` |
| Schema compile | build | — | `TownState.ts`, `schema.ts` | `nx build server` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`game-core`, `client`, `server` repo) | Yes | Vitest per-file | Existing `*.spec.ts` |
| Room (`server`) | Yes | `NJ_AUTOSIM=0` + per-test room + temp DB | `TownRoom.spec.ts` |
| Seed | Yes | In-memory SQLite per test (AD-011) | Existing seed specs |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (game-core) | After T2, T4 | `nx test game-core` |
| Quick (server) | After T1, T3, T5–T7 | `nx test server` |
| Quick (client) | After T9–T11 | `nx test client` |
| Full | After T12 | `nx affected -t test lint` |
| Build | Phase completion | `nx run-many -t build lint test` |

**Speed contract (every task):** Room tests use `NJ_AUTOSIM=0` + `deliver()`/`tick()` —
no `setTimeout`, no `waitForNextSimulationTick`. Advance `nowMs` for cast/cooldown
tests. Per-test cap: unit/room ≤ **10 s**.

---

## Execution Plan

**5 phases** (12 tasks).

### Phase 1: Seed & schema — Sequential

```
T1 → T2
```

### Phase 2: game-core pure logic — Sequential

```
T2 → T3 → T4
```

### Phase 3: Server persistence & resolver — Sequential

```
T4 → T5 → T6 → T7
```

### Phase 4: Client UI — Parallel after T7

```
T7 → T8 ─┐
T7 → T9 ─┼→ T10
T7 → T11 ─┘
```

### Phase 5: Integration & regression — Sequential

```
T10 → T11 → T12
```

---

## Task Breakdown

### T1: Skill schema extension + multi-skill seed

**What**: Extend `skills` table columns; generalized parser; seed 6+ skills + item 2509; fixtures.
**Where**: `server/src/db/schema.ts`, `server/src/seed/parsers/skills.parser.ts`, `server/src/seed/__fixtures__/skills/`, `skills.seeder.ts`
**Depends on**: None
**Reuses**: `parsePowerStrike` pattern; AD-012 fixture layout
**Requirement**: SKILL20-R01, SKILL20-R03, SKILL20-R04

**Tools**: MCP: NONE | Skill: NONE

**Done when**:

- [ ] SKILL20-01–07 seed ACs pass (`nx test server`)
- [ ] Skills **3, 29, 1068, 1100, 1164, 1177** in DB after seed
- [ ] Item **2509** seeded
- [ ] `nx build server` green

**Tests**: seed
**Gate**: quick (server)

**Commit**: `feat(seed): extend skills schema and seed TI skill subset`

---

### T2: Class skill tree seed + folk NPCs

**What**: `class_skill_tree` table + parser from 9 StartingClass XML fixtures; seed Gwinter **30027** + Baulro **30033** + spawns.
**Where**: `server/src/seed/parsers/class-skill-tree.parser.ts`, `paths.ts`, npc seeders
**Depends on**: T1
**Reuses**: Phase 17 NPC pipeline; `TI_NPC_IDS`
**Requirement**: SKILL20-R02, SKILL20-R10

**Done when**:

- [ ] SKILL20-05–06, SKILL20-08 pass
- [ ] NPCs **30027**, **30033** in `npcs` + `npc_spawns`
- [ ] `nx test server` green

**Tests**: seed
**Gate**: quick (server)

**Commit**: `feat(seed): class skill trees and folk trainer NPCs`

---

### T3: Character skills persistence + auto-grant

**What**: `character_skills` table; `grantAutoGetSkills`; legacy migration; repository tests.
**Where**: `server/src/db/character-repository.ts`, `schema.ts`
**Depends on**: T2
**Reuses**: `createCharacter` from Phase 19
**Requirement**: SKILL20-R05, SKILL20-R06, SKILL20-R07

**Done when**:

- [ ] SKILL20-09–12 pass
- [ ] Mystic create grants **1177**; fighter does not get **3** until learned
- [ ] `nx test server` green

**Tests**: unit (server)
**Gate**: quick (server)

**Commit**: `feat(server): persist character skills and auto-grant mystic skills`

---

### T4: game-core mAtk, magic damage, crit/evasion, effects

**What**: `lookupIntBonus`, `lookupDexBonus`, `calcClassBaseMAtk`, `calcMagicSkillDamage`, `rollCrit`, `rollHitMiss`, `active-effects.ts`, `applyShotMultiplier`.
**Where**: `libs/game-core/src/class/`, `libs/game-core/src/combat/`, `libs/game-core/src/effects/`
**Depends on**: T1 (constants)
**Reuses**: `calcPhysicalSkillDamage`, `lookupStrBonus`
**Requirement**: SKILL20-R14 (formula), SKILL20-R20, SKILL20-R23, SKILL20-R24

**Done when**:

- [ ] Wind Strike anchor **40** (SKILL20-28 unit)
- [ ] Power Strike anchor **71** with class pAtk (SKILL20-21 unit)
- [ ] Might multiplier **1.08** (SKILL20-38)
- [ ] Weakness **0.88** (SKILL20-39)
- [ ] Crit **2×** and miss **0** damage (SKILL20-43–46)
- [ ] Shot **2×** (SKILL20-33 unit helper)
- [ ] `nx test game-core` green

**Tests**: unit
**Gate**: quick (game-core)

**Commit**: `feat(game-core): magic damage, crit/evasion, and active effects`

---

### T5: PlayerState schema + learnSkill handler

**What**: `knownSkillIds`, `skillCooldownEndMs`, `castingSkillId`, `castEndMs` on schema; `learnSkill` message; trainer proximity + class tree validation; sync skills on join.
**Where**: `server/src/rooms/schema/TownState.ts`, `TownRoom.ts`
**Depends on**: T3
**Reuses**: Phase 6 `interact` proximity; Bitz + folk NPC types
**Requirement**: SKILL20-R08, SKILL20-R09 (server half)

**Done when**:

- [ ] SKILL20-15–19 room ACs pass
- [ ] SKILL20-13 room AC passes (`knownSkillIds` sync)
- [ ] `nx test server` green

**Tests**: room-integration
**Gate**: quick (server)

**Commit**: `feat(server): learnSkill intent and PlayerState skill fields`

---

### T6: Generalized resolveSkillUse (physical + magic + cast)

**What**: Replace `resolvePowerStrike` with `resolveSkillUse`; cast queue; interrupt on damage; MP/cooldown; migrate existing Power Strike tests to new API.
**Where**: `server/src/rooms/combat-resolver.ts` (or `skill-resolver.ts`), `TownRoom.ts` simulate tick
**Depends on**: T4, T5
**Reuses**: `resolvePlayerAttack` damage apply; `handleMobKill`
**Requirement**: SKILL20-R11–R16

**Done when**:

- [ ] SKILL20-21–25, 27–29, 31–32 room/unit ACs pass
- [ ] Cast cancel on damage (SKILL20-29)
- [ ] `useSkill` without learned skill rejects (SKILL20-14, 31)
- [ ] `nx test server` green

**Tests**: unit + room-integration
**Gate**: quick (server)

**Commit**: `feat(server): generalized skill resolver with magic cast path`

---

### T7: useShot soulshot/spiritshot + buff/debuff resolve

**What**: `useShot` intent; consume soulshot **1835** / spiritshot **2509**; integrate effects for **1068** / **1164** in resolver; effect tick in simulate.
**Where**: `TownRoom.ts`, `combat-resolver.ts`, `game-core/effects`
**Depends on**: T6
**Reuses**: Phase 18 `useItem` inventory decrement pattern
**Requirement**: SKILL20-R17–R22

**Done when**:

- [ ] SKILL20-33–36, 38–41 room ACs pass
- [ ] Effect expiry (SKILL20-40)
- [ ] `nx test server` green

**Tests**: room-integration
**Gate**: quick (server)

**Commit**: `feat(server): soulshots, buffs, and debuffs in skill combat`

---

### T8: Trainer dialog learn UI [P]

**What**: Extend `npc-dialog.ts` trainer variant: list learnable skills; `learnSkill` on click; unit tests for Bitz + Baulro.
**Where**: `client/src/ui/npc-dialog.ts`, `npc-dialog.spec.ts`, `npc-interaction.ts`
**Depends on**: T7
**Reuses**: `resolveNpcDialogVariant`; shop dialog button pattern
**Requirement**: SKILL20-R09 (client), SKILL20-20, SKILL20-51

**Done when**:

- [ ] SKILL20-20, 51 client unit ACs pass
- [ ] `nx test client` green

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): trainer dialog skill learning UI`

---

### T9: Hotbar + combat-input wiring [P]

**What**: `hotbar.ts` dynamic slots keys 2–4; replace hardcoded skill 3 in `combat-input.ts`; cooldown DOM per skill.
**Where**: `client/src/ui/hotbar.ts`, `client/src/combat-input.ts`, specs
**Depends on**: T7
**Reuses**: Power Strike icon from Phase 14; `icon-manifest.ts`
**Requirement**: SKILL20-R25

**Done when**:

- [ ] SKILL20-47–49, 52 pass
- [ ] `nx test client` green

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): dynamic skill hotbar from knownSkillIds`

---

### T10: Cast bar + inventory useShot [P]

**What**: `#cast-bar` DOM; `cast-bar.ts`; inventory Use for shots; soulshot glint on consume.
**Where**: `client/src/ui/cast-bar.ts`, `inventory-window.ts`, `soulshot-glint-vfx.ts`
**Depends on**: T7
**Reuses**: Phase 18 inventory Use; Phase 13 soulshot glint
**Requirement**: SKILL20-R17 (client), SKILL20-30, SKILL20-37

**Done when**:

- [ ] SKILL20-30, 37 pass
- [ ] `nx test client` green

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): cast bar and soulshot useShot wiring`

---

### T11: wireRoom + __GAME_STATE__ skill hooks

**What**: Sync `knownSkillIds`, cooldowns, `castingSkillId`, `castEndMs`, effects; `__useSkill__(skillId)`; deprecate `powerStrikeCooldownEndMs` in hook (alias to skill 3 slot).
**Where**: `client/src/net/room.ts`, `test-hook.ts`, `wire-room.spec.ts`
**Depends on**: T8, T9, T10
**Reuses**: Phase 18 cooldown mirror pattern
**Requirement**: SKILL20-R26

**Done when**:

- [ ] SKILL20-13, 42, 50 pass
- [ ] `nx test client` green

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): wireRoom skill state and test hooks`

---

### T12: Full regression gate + migrate legacy Power Strike tests

**What**: Update all `powerStrikeCooldownEndMs` references; ensure Phase 5/7/19 room tests still pass with learned-skill prerequisite; run full gate.
**Where**: cross-cutting test fixes only
**Depends on**: T11
**Reuses**: `nx affected`
**Requirement**: all ACs

**Done when**:

- [ ] `nx run-many -t build lint test` green
- [ ] No room test > **10 s**
- [ ] All 52 ACs traceable in test files (comment `SKILL20-NN` where helpful)

**Tests**: full gate
**Gate**: build

**Commit**: `chore(phase-20): migrate legacy skill tests and green full gate`

---

## Deviation Log

| Task | Deviation | Reason |
| ---- | --------- | ------ |
| T5–T7 | Single commit `a75c9eb` instead of three | Resolver, shots, and learnSkill handlers landed together during implement pass |
| T12 | `zeroOffsetRng` uses `nextFloat: () => 1` | Phase 20 crit rolls with `rng=0` always crit; anchors need non-crit float |
| T12 | Player→mob attacks omit `rollHitMiss` | Mob runtime has no DEX/evasion column; miss applies on mob→player via `targetDex` |

---

## Parallel Execution Map

```
Phase 1: T1 → T2
Phase 2: T2 → T3 → T4
Phase 3: T4 → T5 → T6 → T7
Phase 4: T7 → T8 [P], T9 [P], T10 [P] → T11
Phase 5: T11 → T12
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Skill schema + seed | parser + migration + seed tests | ✅ Granular |
| T2: Skill tree + 2 NPCs | one table + 2 NPCs | ✅ Granular |
| T3: character_skills | DB + repository | ✅ Granular |
| T4: game-core combat | pure functions bundle (cohesive) | ✅ OK |
| T5: learnSkill | schema + handler | ✅ Granular |
| T6: resolveSkillUse | resolver + tick | ✅ Granular |
| T7: shots + effects | server integration | ✅ Granular |
| T8–T11: client slices | one UI concern each | ✅ Granular |
| T12: regression | test migration only | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| ---- | ----------------- | ------------- | ------ |
| T1 | None | Phase1: T1 → T2 | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T2 | T2 → T3 | ✅ |
| T4 | T1 | T2 → T3 → T4 | ✅ |
| T5 | T3 | T4 → T5 | ✅ |
| T6 | T4, T5 | T5 → T6 | ✅ |
| T7 | T6 | T6 → T7 | ✅ |
| T8 | T7 | T7 → T8 | ✅ |
| T9 | T7 | T7 → T9 | ✅ |
| T10 | T7 | T7 → T10 | ✅ |
| T11 | T8, T9, T10 | T8,T9,T10 → T11 | ✅ |
| T12 | T11 | T11 → T12 | ✅ |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| ---- | ---------- | --------------- | --------- | ------ |
| T1 | seed | seed | seed | ✅ |
| T2 | seed | seed | seed | ✅ |
| T3 | server unit | unit | unit | ✅ |
| T4 | game-core | unit | unit | ✅ |
| T5 | room | room-integration | room-integration | ✅ |
| T6 | unit + room | unit + room | unit + room | ✅ |
| T7 | room | room-integration | room-integration | ✅ |
| T8 | client unit | unit | unit | ✅ |
| T9 | client unit | unit | unit | ✅ |
| T10 | client unit | unit | unit | ✅ |
| T11 | client unit | unit | unit | ✅ |
| T12 | full gate | all | full gate | ✅ |

---

## AC → Task Traceability Matrix

| AC | Task(s) |
| -- | ------- |
| SKILL20-01–07 | T1 |
| SKILL20-08 | T2 |
| SKILL20-09–12 | T3 |
| SKILL20-13 | T5, T11 |
| SKILL20-14 | T6 |
| SKILL20-15–19 | T5 |
| SKILL20-20 | T8 |
| SKILL20-21–23, 26 | T4, T6 |
| SKILL20-24–25 | T6 |
| SKILL20-27–29, 31–32 | T6 |
| SKILL20-28 | T4 |
| SKILL20-30 | T10 |
| SKILL20-33–36 | T4, T7 |
| SKILL20-37 | T10, T11 |
| SKILL20-38–40 | T4, T7 |
| SKILL20-41 | T7 |
| SKILL20-42 | T11 |
| SKILL20-43–46 | T4 |
| SKILL20-47–49, 52 | T9 |
| SKILL20-50–51 | T8, T11 |

**Coverage:** 52/52 ACs mapped ✅
