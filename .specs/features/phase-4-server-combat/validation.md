# Phase 4 — Combat on the Server Validation

**Date**: 2026-06-27
**Spec**: `.specs/features/phase-4-server-combat/spec.md` (restored `fb93e8b`)
**Diff range**: `f5ba027..HEAD` (18 commits: T1–T16 impl `0235b77..0c1d5c7` + spec restore `fb93e8b`)
**Verifier**: independent sub-agent (author ≠ verifier; did not write code or recreated specs)

---

## Overall Verdict

**PASS ✅**

| Check | Result |
| ----- | ------ |
| Spec↔implementation consistency | **Aligned** — recreated spec matches shipped behavior; deferrals documented |
| Spec-anchored AC / P4-R01–R19 | **19/19 requirements evidenced**; all precise L2J anchors asserted |
| Discrimination sensor | **11/11 killed** (`--skip-nx-cache`) |
| Gate | **PASS** — `nx affected -t test lint --base=f5ba027`; `nx e2e client-e2e` (8/8) |

---

## Spec↔Implementation Consistency

The recreated `spec.md` (`fb93e8b`) was reverse-derived from implementation + prior validation. Independent cross-check:

| Question | Finding |
| -------- | ------- |
| Does spec claim any requirement/AC the code does **not** satisfy? | **No.** Every precise AC value (17, 15, 1666, 3.9/4.0/4.1, 44, 88, 57/22, 45, 27 s, XP persist) is implemented and tested at the declared layer. |
| Does spec **omit** shipped behavior? | **No material omissions.** Mob counter-attack (`resolveMobAttack`) is shipped, unit-tested (`combat-resolver.spec.ts`), and covered under P4-R15 tick loop in `design.md` — not a separate AC, acceptable. |
| Are Planner-flagged divergences documented as deferred? | **Yes** — see Divergence Assessment below. |
| Cosmetic spec drift | Goals in `spec.md` still use unchecked `[ ]` boxes while `design.md`/`tasks.md` mark Done — hygiene only, not an impl mismatch. |

**Consistency finding: ALIGNED.** The on-disk spec is an accurate, complete record of what shipped, with explicit deferral notes for known partial coverage.

---

## Task Completion

| Task | Status | Commit |
| ---- | ------ | ------ |
| T1 | ✅ Done | `0235b77` |
| T2 | ✅ Done | `015116a` |
| T3 | ✅ Done | `a5725bc` |
| T4 | ✅ Done | `c114c5b` |
| T5 | ✅ Done | `4db16f8` |
| T6 | ✅ Done | `b8bae75` |
| T7 | ✅ Done | `52f1fb3` |
| T8 | ✅ Done | `99c7355` |
| T9 | ✅ Done | `3875015` |
| T10 | ✅ Done | `070e2f5` |
| T11 | ✅ Done | `2148f12` |
| T12 | ✅ Done | `c788e7d` |
| T13 | ✅ Done | `861d5a0` |
| T14 | ✅ Done | `fb1a33a` |
| T15 | ✅ Done | `bca553c`, `0c50016` |
| T16 | ✅ Done | `0c1d5c7` |

---

## Spec-Anchored Acceptance Criteria

### P4: Server-Authoritative Melee

| Criterion | Spec outcome | `file:line` + assertion | Result |
| --------- | ------------ | ----------------------- | ------ |
| AC1: starter vs Gremlin, RNG offset 0 | damage **17** | `melee-damage.spec.ts:12` — `expect(damage).toBe(17)` | ✅ |
| AC2: same, RNG offset −10 | damage **15** | `melee-damage.spec.ts:21` — `expect(damage).toBe(15)` | ✅ |
| AC3: `calculateAttackIntervalMs(300)` | **1666** ms | `attack-timing.spec.ts:6` — `toBe(1666)` | ✅ |
| AC4: range 3.9 / 4.0 / 4.1 @ 4.0 m | true / true / false | `combat-range.spec.ts:15,19,23` | ✅ |
| AC5: in-range `"attack"` after `"setTarget"` | HP −**17** | `TownRoom.spec.ts:413` — `toBeCloseTo(17, 3)`; `combat-resolver.spec.ts:80` — `toBe(17)` | ✅ |
| AC6: out-of-range `"attack"` | no damage | `TownRoom.spec.ts:434`; `combat-resolver.spec.ts:102` — `toBe(0)` | ✅ |

**Formula check:** `floor(77×10/44.44444)=17`, `floor(77×9/44.44444)=15`, `max(50,500000/300)=1666`.

### P4: Mob Lifecycle

| Criterion | Spec outcome | `file:line` + assertion | Result |
| --------- | ------------ | ----------------------- | ------ |
| AC1: room create → seeded mobs | **11** instances | `TownRoom.spec.ts:392` — `mobs.size).toBe(11)`; `spawn-manager.spec.ts:30` | ✅ |
| AC2: aggressive Goblin within **45** units | acquires target | `mob-ai.spec.ts:64` — player at 40; `TownRoom.spec.ts:553` — goblin +40 offset | ✅ |
| AC3: passive Gremlin damaged | retaliates | `mob-ai.spec.ts:102`; `TownRoom.spec.ts:582` — `targetSessionId).toBe(client.sessionId)` | ✅ |
| AC4: hp → 0 → remove + **27 s** respawn | absent 26 999 ms, present 27 000 ms | `TownRoom.spec.ts:525-533` | ✅ |
| AC5: respawn full HP | **41.145** | `TownRoom.spec.ts:534` — `toBeCloseTo(41.145, 3)` | ✅ |

### P4: XP, Level-Up, Drops

| Criterion | Spec outcome | `file:line` + assertion | Result |
| --------- | ------------ | ----------------------- | ------ |
| AC1: solo Gremlin kill | xp **44**, level **1** | `TownRoom.spec.ts:467-468` | ✅ |
| AC2: second kill | xp **88**, level **2** | `TownRoom.spec.ts:485-486` | ✅ |
| AC3: `grantXp(1,0,44)` | `{ level:1, xp:44 }` | `experience.spec.ts:12` | ✅ |
| AC4: `grantXp(1,44,44)` | `{ level:2, xp:88 }` | `experience.spec.ts:16` | ✅ |
| AC5: Goblin adena seed **150338** | `[{ itemId:57, count:22 }]` | `drop-roll.spec.ts:13`; `combat-resolver.spec.ts:239` | ✅ |
| AC6: kill → persist XP; drops on `KillEvent` | DB xp **44**; drops server-private | `TownRoom.spec.ts:503-504` — `row!.xp).toBe(44)` | ⚠️ **Partial** — XP persist proven; no room-integration Goblin drop assertion (spec-acknowledged) |
| AC7: Playwright kill | `player.xp > 0` | `combat.spec.ts:79,82` — `toBeGreaterThan(0)` | ✅ (spec-precision: weaker than 44; intentional at e2e layer) |

### P4: Client Presentation

| Criterion | Spec outcome | `file:line` + assertion | Result |
| --------- | ------------ | ----------------------- | ------ |
| AC1: target mob → `targetMobId`; HP from server | hook + no local HP mutation | `combat.spec.ts:61-64`; `test-hook.spec.ts:56-57` | ✅ |
| AC2: server HP → HP bar fill | ratio from server snapshot | `mobs.spec.ts:26-27` — `visual.hp` unchanged when server mutated | ✅ |

### Requirement Traceability (P4-R01–P4-R19)

| Req | Evidence | Result |
| --- | -------- | ------ |
| P4-R01 Seeded RNG | `seeded-rng.spec.ts:5-62` — same-seed replay + mixed-call determinism | ✅ |
| P4-R02 Melee formula | `melee-damage.spec.ts` — 17 / 15 | ✅ |
| P4-R03 Attack interval | `attack-timing.spec.ts:6`; `combat-resolver.spec.ts:134` — interval gate | ✅ |
| P4-R04 Melee range | `combat-range.spec.ts` — 3.9/4.0/4.1 | ✅ |
| P4-R05 Target + attack intents | `TownRoom.spec.ts` — `setTarget` + `attack`; `TownRoom.ts:96-107` handlers | ✅ |
| P4-R06 MobState schema | `spawn-manager.spec.ts:39-44` | ✅ |
| P4-R07 Spawn manager | `spawn-manager.spec.ts:25-31`; `TownRoom.spec.ts:392` | ✅ |
| P4-R08 Aggressive aggro | `mob-ai.spec.ts:52-64`; `TownRoom.spec.ts:542-553` | ✅ |
| P4-R09 Passive retaliate | `mob-ai.spec.ts:90-102`; `TownRoom.spec.ts:560-582` | ✅ |
| P4-R10 Idle wander | `mob-ai.spec.ts:105-131` | ✅ |
| P4-R11 Death + 27 s respawn | `TownRoom.spec.ts:511-534` | ✅ |
| P4-R12 XP grant | `experience.spec.ts`; `TownRoom.spec.ts:458-468`; e2e `combat.spec.ts` | ✅ |
| P4-R13 Level-up curve | `experience.spec.ts:15-16`; `TownRoom.spec.ts:475-486` | ✅ |
| P4-R14 Seeded drops | `drop-roll.spec.ts:10-13`; `combat-resolver.spec.ts:226-239` | ✅ (unit/resolver; not room) |
| P4-R15 TownRoom tick combat | Full `TownRoom.spec.ts` combat suite + `TownRoom.ts:simulate` | ✅ |
| P4-R16 Persist XP on kill | `TownRoom.spec.ts:493-504` | ✅ |
| P4-R17 Seed combat + drops + spawns | `monsters.seeder.spec.ts`, `drops.seeder.spec.ts`, `spawns.seeder.spec.ts`, `parsers.spec.ts` | ✅ |
| P4-R18 Client mob render | `mobs.spec.ts` — `client/src/scene/mobs.ts` | ✅ |
| P4-R19 `__GAME_STATE__` combat fields | `test-hook.spec.ts:39-74`; `combat.spec.ts` | ✅ |

---

## Discrimination Sensor

Scratch mutations (backup → patch → `nx test … --skip-nx-cache` → restore). Working tree verified clean after run.

| Mutation | Target | Killed? |
| -------- | ------ | ------- |
| `calcMeleeDamage` → constant 5 | `melee-damage.ts:29` | ✅ game-core + server |
| `nextDamageOffset` → `Math.random()` | `seeded-rng.ts:23` | ✅ game-core |
| Zero XP grant (`newXp = currentXp`) | `experience.ts:17` | ✅ game-core + server |
| Skip level-up threshold (`if (false)`) | `experience.ts:29` | ✅ game-core + server |
| `rollDrops` never drop (`if (true) continue`) | `drop-roll.ts:31` | ✅ game-core + server |
| `rollDrops` always pass chance (`if (false) continue`) | `drop-roll.ts:31` | ✅ game-core |
| Disable melee range (`false && !isInMeleeRange`) | `combat-resolver.ts:67` | ✅ server |
| Disable aggressive aggro | `mob-ai.ts:29` | ✅ server |
| Disable passive retaliate | `mob-ai.ts:31` | ✅ server |
| Skip `processRespawns` (early return) | `TownRoom.ts:233` | ✅ server |
| Skip `persistCharacter` on kill | `TownRoom.ts:222` | ✅ server |

**Sensor depth**: lightweight (11 injections)
**Result**: **11/11 killed** — ✅ PASS

---

## Divergence Assessment (Recovery Planner flags)

| Flag | Spec / design documentation | Code reality | Accurately deferred? |
| ---- | --------------------------- | ------------ | -------------------- |
| **(a)** Drops on server-private `KillEvent` only | `spec.md` Out of Scope + AC6 partial; `design.md` Known Notes | `combat-resolver.ts` `applyKillRewards` → `kill.drops`; no schema/DB loot map | ✅ Yes |
| **(b)** Five edge cases code-handled, no room tests | `spec.md` edge-case lists + “room tests deferred”; `design.md` Known Notes | `TownRoom.ts:96-107` ignores dead/unknown mob, no target on attack; `combat-resolver.ts:56` dead target; multi-player damage sums in tick loop | ✅ Yes — handled, untested |
| **(c)** E2E asserts `xp > 0` not exact 44 | `spec.md` AC7 + matrix “e2e (xp > 0)”; Assumptions table | `combat.spec.ts:79,82` — `toBeGreaterThan(0)` | ✅ Yes — intentional weaker e2e anchor |
| **(d)** Client combat in `client/src/scene/mobs.ts` | `design.md` Client Components + Server vs Client table | `mobs.ts`, `renderer.ts`, `room.ts`, `test-hook.ts`; no `client/src/combat/` | ✅ Yes — path documented |

### Edge cases (spec-listed, room tests deferred)

| Edge case | Code handler | Room test |
| --------- | ------------ | --------- |
| Attack dead target ignored | `combat-resolver.ts:56` (`mob.hp <= 0`) | ❌ |
| Attack without target ignored | `TownRoom.ts:105` (`!combat.targetMobId`) | ❌ |
| Two players, same mob — damage sums | tick processes each session's `attackPending` | ❌ |
| Respawn during target lock | mob removed then re-added on respawn | ❌ |
| Invalid `setTarget` id ignored | `TownRoom.ts:99` (`!mob`) | ❌ |

---

## Implementer Harness Assessment

| Harness | Finding |
| ------- | ------- |
| Injectable `nowMs` + `combatRng` | `TownRoom.spec.ts` uses `createFakeClock` for 27 s respawn and `zeroOffsetRng()` for damage 17 — exercises real `processRespawns` / `calcMeleeDamage` paths, not bypassed. ✅ |
| E2E seed CLI | `playwright.config.ts` seeds via `server/src/seed/cli.ts` before serve; `data/` gitignored. ✅ |
| Playwright `workers: 1` | Serial shared `town` room — legitimate stabilization. ✅ |

---

## Gate Check

| Command | Result |
| ------- | ------ |
| `nx affected -t test lint --base=f5ba027` | ✅ PASS — game-core **37**, server **79**, client **25** tests; lint **0 errors** (warnings only) |
| `nx e2e client-e2e` | ✅ PASS — **8/8** Playwright (incl. `combat.spec.ts`) |
| Fresh `nx test server --skip-nx-cache` (sensor + flaky check) | ✅ PASS |

**Note**: Nx flags `server:test` as flaky; fresh no-cache runs passed during this verification.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Server authority (AD-001) | ✅ |
| Seeded RNG determinism (AD-010) | ✅ |
| Four test layers per AGENTS.md | ✅ |
| Tests assert spec values, not implementation mirrors | ✅ |
| Minimum scope / matches patterns | ✅ |

---

## Ranked Gaps (non-blocking)

1. **Edge-case room tests** — five spec-listed cases handled in code but lack `@colyseus/testing` coverage.
2. **XP/Drops AC6 partial** — Goblin drop roll proven at unit/resolver only; no room-integration assertion that `KillEvent.drops` populates on kill.
3. **E2E XP precision** — `xp > 0` vs exact 44; acceptable per spec AC7 but weaker than room anchors.
4. **Spec Goals checkboxes** — `[ ]` in `spec.md` Goals section despite phase completion (cosmetic).

---

## Lessons

Clean PASS — no grounded failures; **no new lessons recorded**.

---

## Summary

**Overall**: ✅ **PASS**

The recreated Phase 4 spec is **aligned** with the implementation. All P4-R requirements and precise L2J combat anchors are evidenced at unit, room-integration, seed, or e2e layers as declared. The discrimination sensor killed **11/11** mutants. Full affected test + lint + e2e gates are green.

**What works**: Server-authoritative melee loop — spawn (11 mobs), aggro/retaliate/wander, L2J damage/timing/range, XP/level-up, seeded drops (unit), respawn (27 s), XP persistence, client mob render + e2e kill path.

**Deferred (documented, not dropped)**: drop loot visibility, edge-case room tests, e2e XP precision, client path in `mobs.ts`.
