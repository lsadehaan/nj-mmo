# Phase 18 — Consumable Item Use Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** This repo wraps it with
`spec-driven-execution` (Planner → Implementer → Verifier, **autonomous-first**);
honor server-authority (AD-001) and the four test layers (AD-010).

**If the skill cannot be activated, STOP and tell the user — do not proceed
without it.**

---

**Design**: `.specs/features/phase-18-consumable-use/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `AGENTS.md` (4 test layers + 10-second rule),
> `.specs/STATE.md` AD-009/AD-010/AD-014,
> existing patterns in `TownRoom.spec.ts` (Power Strike cooldown + equip),
> `inventory-window.spec.ts`, `client-e2e/src/combat.spec.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Consumable pure logic | unit | CONS-01–09: constants, heal cap, validate/reject paths, success outcome | `libs/game-core/src/consumable/healing-potion.spec.ts` | `nx test game-core` |
| TownRoom useItem | room-integration | CONS-10–19: heal+decrement, rejects, cooldown 10s, peace zone, persist, regressions | `server/src/rooms/TownRoom.spec.ts` | `nx test server` |
| Inventory Use UI | unit | CONS-20–23: Use button, no Use on weapon, click handler, cooldown disabled | `client/src/ui/inventory-window.spec.ts` | `nx test client` |
| Room wiring + hook | unit | CONS-24–25: `__useItem__` sends intent; cooldown remaining on `__GAME_STATE__` | `client/src/net/wire-room.spec.ts` or `room-inventory.spec.ts` | `nx test client` |
| Field recovery e2e | e2e | CONS-26–27: damage → use → hp↑ count↓; double-use blocked 10s | `client-e2e/src/consumable-use.spec.ts` | `nx e2e client-e2e` |
| Schema field | none | Build gate — Colyseus schema compiles | `server/src/rooms/schema/TownState.ts` | `nx build server` |
| Seed item 1060 | none (regression) | Existing seed test covers `type=consumable` | `server/src/seed/**` | `nx test server` |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`game-core`, `client`) | Yes | Vitest per-file isolation | Existing `*.spec.ts` |
| Room (`server`) | Yes | `NJ_AUTOSIM=0` + per-test room + temp DB (AD-014) | `TownRoom.spec.ts` |
| E2e | Yes | Per-test `?room=` instanceKey (AD-014) | `playwright.config.ts` |

## Gate Check Commands

> Generated from codebase (AD-010) — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (game-core) | After T1 | `nx test game-core` |
| Quick (server) | After T3–T4 | `nx test server` |
| Quick (client) | After T5–T6 | `nx test client` |
| Full | After T7 | `nx affected -t test lint` + `nx e2e client-e2e` |
| Build | Phase completion (T7) | `nx run-many -t build lint test` |

**Speed contract (every task):** Room tests use `NJ_AUTOSIM=0` + `deliver()`/`tick()` —
no `setTimeout`, no `waitForNextSimulationTick`. E2e uses `expect.poll` on
`__GAME_STATE__` — no manual `waitForTimeout`. Per-test cap: unit/room ≤ **10 s**,
e2e file ≤ **30 s**.

---

## Execution Plan

**3 phases** (7 tasks).

### Phase 1: Pure logic — Sequential

```
T1 → T2
```

### Phase 2: Server — Sequential

```
T2 → T3 → T4
```

### Phase 3: Client + e2e — Sequential

```
T4 → T5 → T6 → T7
```

---

## T1 — game-core consumable pure functions

**AC**: CONS-01–09
**Files**: `libs/game-core/src/consumable/healing-potion.ts`, `.spec.ts`, `index.ts`

**What**: Add constants and pure `applyConsumableHeal`, `validateConsumableUse`,
`resolveConsumableUse` per `design.md`.

**Verification criteria**:

- [ ] `HEALING_POTION_HEAL_AMOUNT === 24`, `HEALING_POTION_REUSE_MS === 10000`
- [ ] Heal cap at `maxHp`
- [ ] Rejects: not consumable, not owned, cooldown active, dead
- [ ] Success: `hp + 24` (capped), `count - 1`, `cooldownEndMs = nowMs + 10000`
- [ ] `nx test game-core` green; new spec file ≤ **10 s**

**Commit**: `feat(game-core): add healing potion consumable pure logic`

---

## T2 — PlayerState cooldown field

**AC**: CONS-06 (schema), enables CONS-10+
**Depends on**: T1
**Files**: `server/src/rooms/schema/TownState.ts`

**What**: Add `@type('number') healingPotionCooldownEndMs = 0` to `PlayerState`.

**Verification criteria**:

- [ ] Field present on schema class
- [ ] `nx build server` succeeds (schema codegen if applicable)

**Commit**: `feat(server): add healingPotionCooldownEndMs to PlayerState`

---

## T3 — TownRoom `useItem` handler + room tests

**AC**: CONS-10–19
**Depends on**: T1, T2
**Files**: `server/src/rooms/TownRoom.ts`, `server/src/rooms/TownRoom.spec.ts`
**Optional**: `server/src/rooms/consumable-use.ts` thin wrapper

**What**:

1. Register `onMessage('useItem', ...)`.
2. Implement `handleUseItem` using `resolveConsumableUse` from game-core.
3. Add `describe('TownRoom useItem')` with:
   - Success: hp **50→74**, count **1→0**, cooldown set (starter kit or manual count)
   - Reject: count 0, weapon **2369**, dead player
   - Cooldown: fake clock reject at **+9999 ms**, accept at **+10000 ms**
   - Peace zone use allowed
   - Reconnect persist (hp + item count)
   - Regression: Roxxy heal, Katerina buy **1060**, equip **1060** rejected

**Verification criteria**:

- [ ] All CONS-10–19 room ACs have matching `it(...)` blocks
- [ ] Uses `deliver()` + `createFakeClock` — no wall-clock sleeps
- [ ] `nx test server` green; new tests ≤ **10 s** each

**Commit**: `feat(server): useItem intent for Healing Potion with reuse cooldown`

---

## T4 — Inventory Use button + unit tests

**AC**: CONS-20–23
**Depends on**: T3 (handler exists; client can follow)
**Files**: `client/src/ui/inventory-window.ts`, `inventory-window.spec.ts`

**What**:

1. Add `sendUseItem` to handlers interface.
2. Render **Use** button for item **1060** (`data-action="use"`).
3. Disable when `healingPotionCooldownRemainingMs > 0`.
4. Unit tests for button presence, weapon row has no Use, click calls handler, disabled on cooldown.

**Verification criteria**:

- [ ] CONS-20–23 asserted in `inventory-window.spec.ts`
- [ ] Equip regression tests still pass
- [ ] `nx test client` green

**Commit**: `feat(client): inventory Use button for Healing Potion`

---

## T5 — wireRoom + test hooks

**AC**: CONS-24–25
**Depends on**: T4
**Files**: `client/src/net/room.ts`, `client/src/test-hook.ts`, `client/src/main.ts` (or `combat-input.ts`), `wire-room.spec.ts` / `room-inventory.spec.ts`

**What**:

1. Wire `sendUseItem` → `room.send('useItem', { itemId })`.
2. Pass `healingPotionCooldownRemainingMs` into `renderInventoryWindow`.
3. Sync `healingPotionCooldownEndMs` from schema → `__GAME_STATE__` with derived remaining ms.
4. Expose `window.__useItem__(itemId)`.
5. Unit test: spy `room.send` on hook call; cooldown remaining updates.

**Verification criteria**:

- [ ] `__useItem__(1060)` sends correct message
- [ ] `__GAME_STATE__.healingPotionCooldownRemainingMs` reflects server end ms
- [ ] `nx test client` green

**Commit**: `feat(client): wire useItem intent and __useItem__ test hook`

---

## T6 — E2E consumable use

**AC**: CONS-26–27
**Depends on**: T5
**Files**: `client-e2e/src/consumable-use.spec.ts`

**What**: New Playwright spec:

1. Fresh character → Roxxy `__npcAction__(30006, 'starterKit')` → **3× 1060**.
2. Walk outside peace (`peace-zone.ts` helper); approach mob; poll until `hp < maxHp`.
3. `__useItem__(1060)` → poll `hp` increased (up to +24) and `items[1060]` decremented.
4. Immediate second `__useItem__(1060)` → poll count unchanged for **10 s** window (or poll stable count within short poll window after first success).

**Verification criteria**:

- [ ] `gotoGame` + `expect.poll` only — no `page.waitForTimeout`
- [ ] Isolated room via `?room=` query
- [ ] Entire file ≤ **30 s** in CI
- [ ] `nx e2e client-e2e` green

**Commit**: `test(e2e): healing potion use after field damage`

---

## T7 — Full gate + ROADMAP prep

**AC**: All (regression sweep)
**Depends on**: T6

**What**: Run full gate; fix any regressions; ensure no pre-existing tests weakened.

**Verification criteria**:

- [ ] `nx affected -t test lint` green
- [ ] `nx e2e client-e2e` green
- [ ] Equip/shop/heal room tests unchanged and passing
- [ ] No test uses wall-clock sleep for game logic (AD-014)

**Commit**: (none — gate only; Verifier runs after all task commits)

---

## AC → Task Traceability

| AC | Task |
| -- | ---- |
| CONS-01–09 | T1 |
| CONS-10–19 | T3 |
| CONS-20–23 | T4 |
| CONS-24–25 | T5 |
| CONS-26–27 | T6 |
| Regression gate | T7 |

**Total tasks:** 7 (T1–T7). T7 is gate-only, no commit.

---

## Discrimination Sensor Hints (for Verifier)

Inject behavior-level faults in scratch state; tests must kill:

1. `healAmount = 100` (instant full-heal) — unit + room hp delta must fail.
2. Skip cooldown check — second use within 10s must fail room/e2e.
3. Skip `setItemCount` decrement — count unchanged must fail.
4. Client sends heal locally without intent — e2e `__GAME_STATE__.hp` unchanged without server.
