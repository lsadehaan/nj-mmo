# Phase 6 — NPCs & Functional Town Validation

**Date**: 2026-06-27  
**Spec**: `.specs/features/phase-6-npcs-town/spec.md`  
**Diff range**: `9813114..e8db975` (23 commits: T1–T14, gap fixes `4377389`/`c75c7e3`/`9e75b82`/`ef797a0`, test-infra `8dbc892`/`90affc8`/`e8db975`)  
**Verifier**: independent sub-agent (author ≠ verifier; fresh re-verify after gap-fix worker)

---

## Prior FAIL Gaps — Closure Confirmation

| # | Prior gap | Fix evidence | Closed? |
| - | --------- | ------------ | ------- |
| 1 | Room `rejects buy from 3.1 m` survived `canInteract` always-true mutant (no `deliver()`) | `TownRoom.spec.ts:957-974` — `await deliver(room, client, [['buy', …]])` before adena/count asserts; scratch mutant `return true` in `canInteract` → `nx test server --testFile=TownRoom.spec.ts --testNamePattern="rejects buy from 3.1"` **FAIL** | ✅ |
| 2 | No room-integration mob-attack 0-damage in peace zone | `TownRoom.spec.ts:1191-1215` — `mob attack inside peace zone deals no player damage`; `tick(room)` after forcing target; `expect(player.hp).toBe(hpBefore)` | ✅ |
| 3 | No room-integration `interact` accept/reject at 3.0/3.1 m | `TownRoom.spec.ts:998-1017` accept at Roxxy with `waitForMessage('interactResult')`; `:1019-1036` reject at 3.1 m via `deliver()` + `expect(received).toBe(false)` | ✅ |
| 4 | E2E missing Power Strike peace-zone assertion | `client-e2e/src/town.spec.ts:159-222` — `__useSkill__` poll asserts `{ hp: before.hp, mp: before.mp, xp: before.xp }` with `before.mp === 50` | ✅ |

**All 4 prior gaps closed.**

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1   | ✅ Done | `PEACE_ZONE`, `NPC_INTERACT_RADIUS`, `isInPeaceZone` |
| T2   | ✅ Done | DB schema adena/items/merchant/npc_spawns |
| T3   | ✅ Done | Seed merchant + NPC spawns |
| T4   | ✅ Done | `shop-transaction` pure module |
| T5   | ✅ Done | `npc-actions` pure module |
| T6   | ✅ Done | Combat peace guards + mob AI filter |
| T7   | ✅ Done | `NpcState`, `PlayerState.adena`, item stacks |
| T8   | ✅ Done | TownRoom wiring + room-integration |
| T9   | ✅ Done | character-repository adena/items persist |
| T10  | ✅ Done | Procedural NPC renderer |
| T11  | ✅ Done | Shop DOM window |
| T12  | ✅ Done | Dialog + proximity prompt |
| T13  | ✅ Done | `__GAME_STATE__` town hooks |
| T14  | ✅ Done | E2E `town.spec.ts` (shop + melee + Power Strike peace) |

---

## Spec-Anchored Acceptance Criteria

### P6: Peace zone — server authority (P6-R01–R04)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ------------------------- | ------ |
| AC1 — `isInPeaceZone(0,0)` true; `(25,0)` false | **true** / **false** | `libs/game-core/src/peace-zone.spec.ts:6-7` — `expect(isInPeaceZone(0, 0)).toBe(true)`; `expect(isInPeaceZone(25, 0)).toBe(false)` | ✅ PASS |
| AC2 — corners ±20 inclusive; outside ±20.1 false | **true** / **false** | `peace-zone.spec.ts:11-14` | ✅ PASS |
| AC3 — player `(0,0)` melee attack, mob HP unchanged | no damage | `TownRoom.spec.ts:1145-1160` — `expect(hp).toBeCloseTo(hpBefore, 3)`; unit `combat-resolver.spec.ts:449-450` — `expect(result.damage).toBe(0)` | ✅ PASS |
| AC4 — Power Strike at `(0,0)`, mp≥9, no cooldown | HP and **mp** unchanged | `TownRoom.spec.ts:1167-1184` — HP unchanged; `expect(player.mp).toBe(50)`; unit `combat-resolver.spec.ts:491-493` | ✅ PASS |
| AC5 — mob targets player at `(0,0)`; mob attacks **0** damage | **0** damage | `TownRoom.spec.ts:1191-1215` — `expect(player.hp).toBe(hpBefore)`; unit `combat-resolver.spec.ts:532` — `expect(result.damage).toBe(0)`; `mob-ai.spec.ts:168-179` target cleared on zone entry | ✅ PASS |
| AC6 — peace-zone marker at village origin | center `(0,0)` visual | `client/src/scene/village.spec.ts:17` — count `peace-zone` === 1 only; coords at `village.ts` x/z=0 **not asserted in test** | ⚠️ Spec-precision gap (optional per spec) |

**Constants**: `peace-zone.spec.ts:18` — `PEACE_ZONE` `{ minX: -20, maxX: 20, minZ: -20, maxZ: 20 }`; `NPC_INTERACT_RADIUS` **3.0** at `:22`.

### P6: Shop, adena, merchant (P6-R05–R10)

| Criterion | Spec-defined outcome | Evidence | Result |
| --------- | -------------------- | -------- | ------ |
| AC1 — seed merchant items | **1060** buy **103** sell **51**; **1835** **8/4**; **17** **2/1** | `merchant-npc-spawns.seeder.spec.ts:32-37`, `:55-56` | ✅ PASS |
| AC2 — NPC spawns | **30004** at **(−6, −8)**; **30006** at **(4, 10)** | `merchant-npc-spawns.seeder.spec.ts:82`, `:93` | ✅ PASS |
| AC3 — `createCharacter` adena | **1000** | `character-repository.spec.ts:35` — `adena: 1000` | ✅ PASS |
| AC4 — buy 1×**1060**, adena **1000→897**, count **1** | **897**, count **1** | `TownRoom.spec.ts:949-950`; `shop-transaction.spec.ts:25-26` | ✅ PASS |
| AC5 — buy with adena **50** rejected | adena **50**, count **0** | `TownRoom.spec.ts:990-991`; `shop-transaction.spec.ts:40-41` | ✅ PASS |
| AC6 — sell 1× with adena **897**, count **2** → **948**, count **1** | **948**, count **1** | `TownRoom.spec.ts:1058-1059`; `shop-transaction.spec.ts:55-56` | ✅ PASS |
| AC7 — buy from **3.1 m** rejected | no transaction | `TownRoom.spec.ts:965-970` — `deliver()` then adena **1000**, count **0** | ✅ PASS |
| AC8 — buy persists adena + items on leave/reload | DB **897**, item **1** | `TownRoom.spec.ts:1138-1139` | ✅ PASS |

### P6: Utility NPC (P6-R11–R13)

| Criterion | Spec-defined outcome | Evidence | Result |
| --------- | -------------------- | -------- | ------ |
| AC1 — `interact` at Roxxy `(4,10)` accepted (≤**3.0** m) | accepted | `TownRoom.spec.ts:1005-1012` — `waitForMessage('interactResult')` with `npcId: ROXXY` | ✅ PASS |
| AC2 — `interact` from **3.1 m** rejected | rejected | `TownRoom.spec.ts:1030-1032` — `expect(received).toBe(false)` after `deliver()` | ✅ PASS |
| AC3 — heal `hp=40` → **100** | **100** | `TownRoom.spec.ts:1077`; `npc-actions.spec.ts:18` | ✅ PASS |
| AC4 — starter kit first time +**3** item **1060**, flag **true** | count **3**, flag set | `TownRoom.spec.ts:1095-1098` | ✅ PASS |
| AC5 — second starter kit no-op | count unchanged | `TownRoom.spec.ts:1118` — count stays **3** | ✅ PASS |

### P6: NPC presence & client (P6-R14–R19)

| Criterion | Spec-defined outcome | Evidence | Result |
| --------- | -------------------- | -------- | ------ |
| AC1 — room boots **2** NPCs **30004** + **30006** | 2 entries | `TownRoom.spec.ts:928-930` | ✅ PASS |
| AC2 — `buildNpcMesh` → `THREE.Group` ≥1 mesh | procedural group | `npc-renderer.spec.ts:11-18` | ✅ PASS |
| AC3 — shop DOM items **1060/1835/17** prices **103/8/2** | visible rows | `shop-window.spec.ts:38-42` | ✅ PASS |
| AC4 — `__GAME_STATE__.adena` after join **1000** | **1000** | `test-hook.spec.ts:119-122` (contract); e2e `town.spec.ts:52-54` polls server sync | ✅ PASS |
| AC5 — E2E buy potion adena **897**, item **1060** ≥**1** | **897**, ≥**1** | `town.spec.ts:84`, `:87`, `:97` DOM adena **897** | ✅ PASS |
| AC6 — E2E combat at village center: `__attack__` / `__useSkill__` no mob HP/MP change | both blocked | `town.spec.ts:100-156` melee; `:159-222` Power Strike mp **50** unchanged | ✅ PASS |

**Status**: **31/32** ACs fully proven at declared layer; **1** optional spec-precision gap (peace-marker coords).

---

## Discrimination Sensor

Scratch mutations applied and reverted (`--skip-nx-cache` on affected projects). AD-014 harness: room tests use `NJ_AUTOSIM=0`, `deliver()` / `tick()` helpers (no wall-clock sleeps).

| # | Mutation | Target | Killed? | Killing test / command |
| - | -------- | ------ | ------- | ---------------------- |
| 1 | `isInPeaceZone` always **false** | `libs/game-core/src/peace-zone.ts` | ✅ | `nx test game-core` |
| 2 | Remove melee peace guard | `combat-resolver.ts` `resolvePlayerAttack` | ✅ | `combat-resolver.spec.ts:449` |
| 3 | Remove Power Strike peace guard | `combat-resolver.ts` `resolvePowerStrike` | ✅ | `combat-resolver.spec.ts:491` |
| 4 | Remove mob-attack peace guard | `combat-resolver.ts` `resolveMobAttack` | ✅ | `combat-resolver.spec.ts:532`; `TownRoom.spec.ts:1215` |
| 5 | No adena deduction on buy | `shop-transaction.ts` | ✅ | `shop-transaction.spec.ts:25` |
| 6 | Allow insufficient-adena buy | `shop-transaction.ts` | ✅ | `shop-transaction.spec.ts:38` |
| 7 | Heal does not restore to max | `npc-actions.ts` `applyHeal` | ✅ | `npc-actions.spec.ts:18` |
| 8 | Starter kit grants twice | `npc-actions.ts` guard removed | ✅ | `npc-actions.spec.ts:41`; `TownRoom.spec.ts:1118` |
| 9 | Break seeded buy price **103→999** | `buylist_30004.xml` `price="103"` | ✅ | `nx test server --testFile=merchant-npc-spawns.seeder.spec.ts` |
| 10 | Proximity gate removed (`canInteract` always **true**) | `npc-actions.ts` | ✅ | Unit `npc-actions.spec.ts:10`; **room** `TownRoom.spec.ts:969-970` + `:1032` |

**Sensor depth**: lightweight (10 targeted behavior-level mutations)  
**Result**: **10/10 killed** — **PASS**

---

## Server Authority (AD-001)

| Concern | Server validation | Client role | Test boundary |
| ------- | ----------------- | ----------- | ------------- |
| Peace zone melee + Power Strike | `combat-resolver.ts` early returns; mob AI filter | Visual marker only (`village.ts`) | Unit + room (`TownRoom.spec.ts` attack/useSkill at `(0,0)`) + e2e |
| Mob vs in-zone player | `resolveMobAttack` + `tickMobAi` target clear | N/A | Unit + **room** mob-damage-in-zone test |
| Buy/sell adena + items | `TownRoom.handleBuy/Sell` → `shop-transaction` + DB persist | DOM sends intents only | Room + unit + e2e adena **897** |
| Heal / starter kit | `TownRoom.handleNpcAction` → `npc-actions` + persist | Dialog sends `npcAction` intent | Room + unit |
| Proximity | `canInteract` on every shop/interact/npcAction message | UX prompt only | Unit + **room** buy/interact reject at **3.1 m** |

---

## Recorded Deviations Assessment

| Deviation | Assessment |
| --------- | ---------- |
| T6 `OUT_OF_PEACE (30,−30)` for Phase 4/5 combat tests | Acceptable — combat values still asserted outside zone |
| T11 static shop catalog client-side | Acceptable for AD-001 — server validates from DB |
| T14 `town.spec.ts` naming (not `town-npc.spec.ts`) | Documented in tasks matrix; coverage complete |
| Roxxy Teleporter → Helper dialog | Matches spec assumption |
| AD-014 test harness (`NJ_AUTOSIM=0`, per-test e2e rooms) | Improves determinism; no production behavior change; all test counts preserved |

---

## Gate Check

| Gate | Command | Result |
| ---- | ------- | ------ |
| Affected test + lint | `nx affected -t test lint --base=9813114 --skip-nx-cache` | ✅ Pass — game-core **44**, client **57**, server **135**; lint warnings only (no errors) |
| E2E | `nx e2e client-e2e --skip-nx-cache` | ✅ **12/12** passed in **30.7 s** (4 workers, `fullyParallel`; ports 2567/4200 free) |

**Test count delta** (vs pre-Phase-6 baseline `9813114`): game-core **+4** (40→44); server **+43** (92→135); client **+18** (~39→57); e2e **+3** (9→12). No silent deletions; no skips.

**E2E reliability**: Single verifier run green; AD-014 documents **14 consecutive** cold runs post-infra fix. No flakes observed this session.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum scope / surgical changes | ✅ |
| Matches existing patterns | ✅ |
| Tests map to ACs (non-shallow) | ✅ |
| AGENTS.md four-layer contract + AD-001 | ✅ |
| Guidelines | `AGENTS.md`, `AD-010`, `AD-014`, tasks.md matrix |

---

## Ranked Gaps

1. **Cosmetic (spec-precision)** — P6 Peace AC6: optional `village.spec.ts` assert peace-marker center `x/z === 0` (count-only today).

No blockers or major gaps remain.

---

## Summary

**Overall**: ✅ **Ready** (PASS)

**Spec-anchored check**: **31/32** ACs matched at declared layer; **1** optional spec-precision gap  
**Sensor**: **10/10 killed**  
**Prior FAIL gaps**: **4/4 closed**  
**Gate**: ✅ All green (135 server + 44 game-core + 57 client unit; 12 e2e)

**Confirmed spec anchors**: peace zone **x/z ∈ [−20, 20]**; melee + Power Strike **0** damage/**0** MP spend in zone; mob attack **0** damage in zone; adena **1000**; shop **1060@103/51**, **1835@8/4**, **17@2/1**; buy **1000→897**; sell **+51**; insufficient-adena reject; heal **→100**; starter kit **+3×1060** once; interact radius **3.0**; persistence; NPC spawns **30004@(−6,−8)**, **30006@(4,10)**.

**Lessons**: none recorded (clean PASS; no new grounded failures).
