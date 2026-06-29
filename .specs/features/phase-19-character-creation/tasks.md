# Phase 19 — Character Creation & Classes Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** This repo wraps it with
`spec-driven-execution` (Planner → Implementer → Verifier, **autonomous-first**);
honor server-authority (AD-001) and the three test layers (AD-010) — **no Playwright**.

**If the skill cannot be activated, STOP and tell the user — do not proceed
without it.**

---

**Design**: `.specs/features/phase-19-character-creation/design.md`
**Spec**: `.specs/features/phase-19-character-creation/spec.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from spec ACs, `AGENTS.md`, and `.specs/STATE.md` AD-009/AD-010/AD-012/AD-014.
> Post-MVP gate: **no `client-e2e` / Playwright** for this phase.

| Code Layer | Required Test Type | ACs | Location Pattern | Run Command |
| ---------- | ------------------ | --- | ---------------- | ----------- |
| Class template seed | seed | CHAR19-01–06 | `server/src/seed/class-templates.seed.spec.ts` | `nx test server` |
| Stat bonus + combat + vitals | unit | CHAR19-07–13 | `libs/game-core/src/class/*.spec.ts` | `nx test game-core` |
| Character repository | unit | CHAR19-14–16 | `server/src/db/character-repository.spec.ts` | `nx test server` |
| TownRoom join + combat + level-up | room-integration | CHAR19-17–22, 36–37 | `server/src/rooms/TownRoom.spec.ts` | `nx test server` |
| Creation UI | unit | CHAR19-23–26 | `client/src/ui/character-creation.spec.ts` | `nx test client` |
| Player manifest | unit | CHAR19-27–31 | `client/src/scene/creature/player-manifest.spec.ts` | `nx test client` |
| wireRoom + `__GAME_STATE__` | unit | CHAR19-33–35 | `client/src/net/wire-room.spec.ts` | `nx test client` |
| Visual gate | manual + script | CHAR19-32 | `scripts/visual-gate.mjs`, `scripts/shoot-character.mjs` | `node scripts/visual-gate.mjs` |
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
| Quick (game-core) | After T2 | `nx test game-core` |
| Quick (server) | After T1, T3–T5 | `nx test server` |
| Quick (client) | After T6–T9 | `nx test client` |
| Full | After T10 | `nx affected -t test lint` |
| Build | Phase completion | `nx run-many -t build lint test` |

**Speed contract (every task):** Room tests use `NJ_AUTOSIM=0` + `deliver()`/`tick()` —
no `setTimeout`, no `waitForNextSimulationTick`. Per-test cap: unit/room ≤ **10 s**.

---

## Execution Plan

**4 phases** (10 tasks).

### Phase 1: Data & pure logic — Sequential

```
T1 → T2
```

### Phase 2: Server persistence & room — Sequential

```
T2 → T3 → T4 → T5
```

### Phase 3: Client creation + avatars — Parallel after T5

```
T5 → T6 ─┐
T5 → T7 ─┼→ T8
T5 → T9 ─┘
```

### Phase 4: Visual gate & regression — Sequential

```
T8 → T9 → T10
```

---

## T1 — L2J fixtures + class template seed

**ACs:** CHAR19-01, CHAR19-02, CHAR19-03, CHAR19-04, CHAR19-05, CHAR19-06

**Do:**
- Add `server/src/seed/__fixtures__/players/StartingClass/` (9 XML files from L2J).
- Add `statBonus_str_subset.xml` + `classList_snippet.xml`.
- Implement `class-templates.parser.ts` + `class-templates.seeder.ts`.
- Create `class_templates` + `class_level_vitals` tables in `schema.ts` / `client.ts`.
- Wire seeder into `seed.ts`.
- Add `class-templates.seed.spec.ts`.

**Verify:** `nx test server` — seed ACs pass; `nx build server` green.

**Commit:** `feat(seed): add L2J starter class templates and vitals curves`

---

## T2 — game-core class stat & combat pure functions

**ACs:** CHAR19-07, CHAR19-08, CHAR19-09, CHAR19-10, CHAR19-11, CHAR19-12, CHAR19-13

**Do:**
- Add `libs/game-core/src/class/stat-bonus.ts` (STR lookup from fixture constants).
- Add `class-combat.ts` (`calcClassBasePAtk`).
- Add `class-vitals.ts` (`classVitalsAtLevel`, `applyClassLevelUpReward`).
- Export from `index.ts`.
- Unit specs with anchors from spec L2J table.
- Update `melee-damage.spec.ts` if needed for class-based examples.

**Verify:** `nx test game-core` — CHAR19-07–13 pass.

**Commit:** `feat(game-core): class stat bonus, vitals, and base pAtk helpers`

---

## T3 — Character schema migration + createCharacter with class

**ACs:** CHAR19-14, CHAR19-15, CHAR19-16

**Do:**
- Migrate `characters`: `class_id`, `sex` columns (default 0).
- Extend `Character` type + `saveCharacter`/`loadCharacter`.
- `createCharacter(db, { classId, sex })` loads template vitals for new rows.
- Extend `character-repository.spec.ts`.

**Verify:** `nx test server` — repository ACs pass.

**Commit:** `feat(server): persist classId and sex on characters`

---

## T4 — PlayerState schema + TownRoom join/create flow

**ACs:** CHAR19-17, CHAR19-21, CHAR19-22

**Do:**
- Add `classId`, `sex`, `str`…`men` to `PlayerState` (`TownState.ts`).
- Extend `onJoin` for `{ create: { classId, sex } }` whitelist validation.
- Sync template stats to `PlayerState` on join.
- Reject invalid `classId` (CHAR19-21).
- Room tests: join Human Mystic vitals, invalid classId, resume by `characterId`.

**Verify:** `nx test server` — CHAR19-17, 21, 22 pass.

**Commit:** `feat(server): class-aware TownRoom join and PlayerState replication`

---

## T5 — Combat + level-up use class stats

**ACs:** CHAR19-18, CHAR19-19, CHAR19-20, CHAR19-36, CHAR19-37

**Do:**
- Load class templates in `TownRoom.onCreate`.
- Replace `getPlayerPAtk` to use `calcClassBasePAtk` + `effectivePAtk`.
- Replace `applyLevelUpReward` calls with `applyClassLevelUpReward(classId, …)`.
- Update affected `TownRoom.spec.ts` combat/level tests (new damage anchors).
- Ensure consumable/shop/NPC regression tests still pass.

**Verify:** `nx test server` — CHAR19-18–20, 36–37 pass; full server suite green.

**Commit:** `feat(server): class-based combat pAtk and level-up vitals`

---

## T6 — Character creation UI

**ACs:** CHAR19-23, CHAR19-24, CHAR19-25, CHAR19-26

**Do:**
- Add `client/src/ui/character-creation.ts` + minimal CSS (inline or `index.html`).
- Race / archetype / gender flow; Dwarf hides Mystic.
- `character-creation.spec.ts` (jsdom): visibility, classId resolution, join options.
- Update `main.ts` to defer `connectSafe` until Create when no stored id.
- Extend `connect`/`connectSafe` to pass `create` join options.

**Verify:** `nx test client` — CHAR19-23–26 pass.

**Commit:** `feat(client): character creation screen before first join`

---

## T7 — Player manifest + avatar selection

**ACs:** CHAR19-27, CHAR19-28, CHAR19-29, CHAR19-30, CHAR19-31

**Do:**
- Add `player-manifest.ts` + spec (9 entries, distinct models per CHAR19-31).
- Update `player-avatar.ts`, `remote-player-avatar.ts` to accept `classId`.
- Thread `classId` through `renderer.ts` local/remote sync.

**Verify:** `nx test client` — manifest ACs pass.

**Commit:** `feat(client): per-class player manifest and avatar selection`

---

## T8 — wireRoom + `__GAME_STATE__` class fields

**ACs:** CHAR19-33, CHAR19-34, CHAR19-35

**Do:**
- Extend `GameStatePlayer` in `test-hook.ts` with `classId`, `sex`, stats, `avatarModel`.
- Update `wireRoom` / `setPlayer` to map new `PlayerState` fields.
- Add `wire-room.spec.ts` cases for class sync + avatar path.

**Verify:** `nx test client` — CHAR19-33–35 pass.

**Commit:** `feat(client): wire class identity to __GAME_STATE__ and avatars`

---

## T9 — Remote player class avatar + room class combat cross-check

**ACs:** (supports CHAR19-22 remote visual; reinforces 17–19)

**Do:**
- Replicate `classId` on remote player sync; remote avatar uses manifest.
- Add room test: two clients, second sees first player's `classId` in state.
- Add `player-avatar.spec.ts` or extend existing: `classId=31` loads `Rogue_Hooded.glb`.

**Verify:** `nx test server` + `nx test client` green.

**Commit:** `feat(client): remote players use class manifest avatars`

---

## T10 — Visual gate + full regression

**ACs:** CHAR19-32

**Do:**
- Extend `character-lab.ts` / `shoot-character.mjs` for `classId` param.
- Capture nine class screenshots to `test-results/character-lab/` (or project convention).
- Run `node scripts/visual-gate.mjs`; fix any manifest FAILs.
- Run `nx affected -t test lint` + `nx run-many -t build`.
- Update `.specs/STATE.md` Handoff: Phase 19 planning complete (Verifier runs separately).

**Verify:** Visual gate PASS (structural); full Nx gate green; human screenshot review recorded in commit message or PR notes for Verifier.

**Commit:** `chore(assets): phase 19 class avatar visual gate captures`

---

## AC → Task Traceability

| AC | Task |
| -- | ---- |
| CHAR19-01–06 | T1 |
| CHAR19-07–13 | T2 |
| CHAR19-14–16 | T3 |
| CHAR19-17, 21–22 | T4 |
| CHAR19-18–20, 36–37 | T5 |
| CHAR19-23–26 | T6 |
| CHAR19-27–31 | T7 |
| CHAR19-33–35 | T8 |
| CHAR19-22 (remote), — | T9 |
| CHAR19-32 | T10 |

---

## Deviation Log (Implementer)

| Task | Deviation | Reason |
| ---- | --------- | ------ |
| T5 | Power Strike second-cast damage anchor 69→60; Roxxy `applyHeal` uses `player.maxHp` not hard-coded 100 | Class-based pAtk lowers skill damage; Human Fighter maxHp is 80 on seeded DB |
| T7 | CHAR19-31 test asserts 9 explicit manifest entries (≥5 unique GLBs) not 9 unique model files | KayKit pack ships 5 character GLBs; mystic/orc paths intentionally share Mage/Barbarian per design |
| T10 | Renamed `PlayerVitals` → `FlatLevelUpVitals` in `level-up-reward.ts` | Export name clash with `class-vitals.ts` broke client build |

*(Empty — Implementer fills during Execute.)*
