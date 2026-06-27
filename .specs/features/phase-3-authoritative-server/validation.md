# Phase 3 — Authoritative Server + Multiplayer Validation

**Date**: 2026-06-27
**Spec**: `.specs/features/phase-3-authoritative-server/spec.md`
**Diff range**: `48e00e4..HEAD` (22 commits; latest fixes: `37007dd`, `158e2ae`)
**Verifier**: independent sub-agent (author ≠ verifier; third re-verify after two fix iterations)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1   | ✅ Done | `libs/game-core` scaffold + verbatim `step()` |
| T2   | ✅ Done | `isValidMoveIntent` unit tests |
| T3   | ✅ Done | `characters` Drizzle table |
| T4   | ✅ Done | character repository CRUD |
| T5   | ✅ Done | `PlayerState` stats + `connected` |
| T6   | ✅ Done | 50 ms simulation tick |
| T7   | ✅ Done | `onMessage('move')` handler |
| T8   | ✅ Done | two-client broadcast room test |
| T9   | ✅ Done | load/create on join |
| T10  | ✅ Done | persist + reconnect + debounce |
| T11  | ✅ Done | client `characterId` + room ref |
| T12  | ✅ Done | state callbacks; local `step()` removed |
| T13  | ✅ Done | remote player meshes |
| T14  | ✅ Done | `__GAME_STATE__.others` + `characterId` |
| T15  | ✅ Done | two-browser + reconnect + leave e2e |

---

## Prior FAIL Gaps — Re-confirmation

| # | Prior gap | Fix commit | Closed? | Evidence |
| - | --------- | ---------- | ------- | -------- |
| 1 | M5 / Persistence AC4: `onDrop` DB persist not room-tested | `9f7867f` | ✅ **Yes** | `TownRoom.spec.ts:199-226` asserts `loadCharacter` coords after `leave(false)`; sensor M5 **KILLED** |
| 2 | Multiplayer AC3: no e2e for remote removal on consented leave | `e11b4a7` + `158e2ae` | ✅ **Yes** | `multiplayer.spec.ts:83-126` — newcomer id via `waitForFunction`, removal via `expect.poll`; sensor M7 **KILLED**; 3/3 consecutive `--skip-nx-cache` passes |
| 3 | Vitest resolves `@nj/game-core` from stale `dist/` not source | `37007dd` | ✅ **Yes** | With `dist/libs/game-core` present, source `isValidMoveIntent` always-true mutant fails `TownRoom > ignores invalid move intents` (`nx test server --skip-nx-cache`); `server/vitest.config.ts:10-20` explicit `resolve.alias` |
| 4 | Client Intent AC1: no instrumentation proving client skips local `step()` | `cc7dbd4` | ✅ **Yes** | `smoke.spec.ts:77-92` — `stationary` + `localMovementTicks.toBe(0)` immediately after click and after server sync |

**All four prior gaps plus the vitest-source blocker are closed.**

---

## Vitest Source Resolution (L-001 follow-up)

| Check | Result |
| ----- | ------ |
| `dist/libs/game-core` present during sensor | ✅ Built via `nx build game-core` |
| Source mutant `isValidMoveIntent` always `true` kills `server:test` | ✅ **KILLED** — 1 failure: `ignores invalid move intents without changing position` |
| Source mutant `step()` early `return state` kills `server:test` | ✅ **KILLED** — movement tick + broadcast tests fail |
| Fix location | `server/vitest.config.ts` + `client/vite.config.ts` `resolve.alias` → `libs/game-core/src` |

**L-001 gap resolved** — tsconfig paths alone was insufficient; explicit vitest/vite alias is now in place and empirically verified.

---

## Leave E2E Determinism

| Mechanism | Location | Arbitrary fixed sleep as primary? |
| --------- | -------- | --------------------------------- |
| Track A's session id as sole newcomer | `multiplayer.spec.ts:100-109` `waitForFunction` comparing `othersBeforeA` | No |
| Consented leave trigger | `multiplayer.spec.ts:112-115` `__consentLeave__()` | No |
| Assert B's `others` excludes leaver | `multiplayer.spec.ts:117-126` `expect.poll` (100/250/500 ms intervals, 20 s timeout) | No |

**Determinism check**: `nx e2e client-e2e --skip-nx-cache -- --grep "consented leave"` passed **3/3** consecutive runs.

---

## Spec-Anchored Acceptance Criteria

### P3: Server-Authoritative Movement

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| AC1: `setSimulationInterval` + shared `step()` each tick | Player `x/z` advance from origin when intent pending | `TownRoom.spec.ts:85-86` — `expect(player.x).toBeGreaterThan(0)` | ✅ PASS |
| AC2: valid `"move"` intent applied + broadcast `x,y,z` | Remote client sees mover `x > 0` within 2 s | `TownRoom.spec.ts:102-103`, `144-145` — `toBeGreaterThan(0)` | ✅ PASS |
| AC3: non-finite / OOB intent does not change target | Position stays at `startX`/`startZ`; unit rejects NaN/∞/OOB | `validate-move-intent.spec.ts:13-29` — `toBe(false)`; `TownRoom.spec.ts:122-123` — `toBe(startX)` | ✅ PASS |
| AC4: two clients — B sees A move within 2 s | B's synced A `x > 0` before 2000 ms deadline | `TownRoom.spec.ts:136-144` — deadline loop + `remoteOnB!.x > 0` | ✅ PASS |
| AC5: Phase-2 `step()` tests unchanged | Speed 8, epsilon stop, null intent no-op | `movement-system.spec.ts:13-31` — `toBeCloseTo(DEFAULT_MOVE_SPEED)`, `toEqual(start)` | ✅ PASS |

### P3: Client Intent + Authoritative Render

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| AC1: click sends `"move"`; no local `step()` for outcomes | Target set; player `x/z` unchanged until server sync; `localMovementTicks === 0` | `smoke.spec.ts:77-79`, `91-92` — `stationary` + `localMovementTicks.toBe(0)` | ✅ PASS |
| AC2: renderer/camera use room `x,y,z` | Hook `player` reflects synced coords after click | `smoke.spec.ts:39-50` — position delta after click | ✅ PASS |
| AC3: `__GAME_STATE__.player.x/z` change after click | Position differs from initial | `smoke.spec.ts:49-50` — `toBe(true)` on delta | ✅ PASS |

### P3: Multiplayer Presence

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| AC1: other join → remote mesh added | Remote presence in hook (`others.length >= 1`) | `multiplayer.spec.ts:38-40` — `others?.length >= 1` | ✅ PASS |
| AC2: remote position change → mesh/hook update | Matched `others` entry `x` or `z` changes | `multiplayer.spec.ts:62-76` — id-matched delta | ✅ PASS |
| AC3: remote consented leave → mesh removed | `others` no longer contains leaver | `multiplayer.spec.ts:117-126` — `expect.poll` → `toBe(false)` on `some(o => o.id === leaverId)` | ✅ PASS |
| AC4: two browsers — B's `others` includes A with updated coords | Id-matched position delta | `multiplayer.spec.ts:71-76` — `expect(moved).toBeDefined()` | ✅ PASS |

### P3: Character Persistence & Reconnect

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| AC1: `characters` table columns | Round-trip insert with spec columns | `schema.spec.ts:26-40` — `toMatchObject(row)` | ✅ PASS |
| AC2: join without `characterId` → new row at spawn | Starter stats + spawn coords | `TownRoom.spec.ts:158-167` — `toMatchObject({ name:'Adventurer', level:1, hp:100, mp:50, x:SPAWN_X, … })` | ✅ PASS |
| AC3: join with known `characterId` → load position/stats | `x:15, z:-10, hp:100, level:1` | `TownRoom.spec.ts:188-192` — exact `toBe` values | ✅ PASS |
| AC4: consented leave **or** `onDrop` → persist to DB | Saved coords match player after leave/drop | `TownRoom.spec.ts:247-248` (consented); `219-221` (onDrop) — `toBeCloseTo(movedX/Z)` | ✅ PASS |
| AC5: unclean disconnect + `allowReconnection` within 30 s | Same `sessionId`, `connected` false→true, no duplicate | `TownRoom.spec.ts:276-277` — `toBe(sessionId)`; `connected` `toBe(true)` | ✅ PASS |
| AC6: new session + same `characterId` → last saved position | `player.x/z` match pre-disconnect snapshot | `multiplayer.spec.ts:173-174` — `toBeCloseTo(snapshot.player.x/z, 0)` | ✅ PASS |
| AC7: HP/MP/XP/level unchanged during movement | `100/50/0/1` on state + DB row | `TownRoom.spec.ts:298-307` — `toBe` / `toMatchObject` | ✅ PASS |

### Requirement traceability (P3-R1 … P3-R13)

| Req | Primary evidence | Result |
| --- | ---------------- | ------ |
| P3-R1 | `TownRoom.spec.ts:71-89` | ✅ |
| P3-R2 | `TownRoom.spec.ts:91-106`, `smoke.spec.ts:49-50`, `smoke.spec.ts:77-79` | ✅ |
| P3-R3 | `validate-move-intent.spec.ts`, `TownRoom.spec.ts:108-126` (room layer now kills source mutants) | ✅ |
| P3-R4 | `TownRoom.spec.ts:128-149` | ✅ |
| P3-R5 | `smoke.spec.ts:39-50` | ✅ |
| P3-R6 | `remote-players.spec.ts`, `multiplayer.spec.ts:83-126` | ✅ |
| P3-R7 | `schema.spec.ts`, `character-repository.spec.ts` | ✅ |
| P3-R8 | `TownRoom.spec.ts:199-226`, `228-251`, `313-334` | ✅ |
| P3-R9 | `TownRoom.spec.ts:151-197`, `room.spec.ts:43-65` | ✅ |
| P3-R10 | `TownRoom.spec.ts:254-283`, `multiplayer.spec.ts:133-174` | ✅ |
| P3-R11 | `TownRoom.spec.ts:128-149`, `multiplayer.spec.ts:26-80` | ✅ |
| P3-R12 | `test-hook.spec.ts:9-18`, `multiplayer.spec.ts` | ✅ |
| P3-R13 | `movement-system.spec.ts` | ✅ |

**Status**: 19/19 story ACs with proving tests; all assertions match spec-defined outcomes.

---

## Discrimination Sensor

Scratch mutations applied and reverted. All runs used `--skip-nx-cache` on affected projects. `dist/libs/game-core` was present throughout.

| Mutation | File | Description | Killed? |
| -------- | ---- | ----------- | ------- |
| M1 | `TownRoom.ts:65-66` | Comment out `player.x/z = next.x/z` in `simulate()` | ✅ Killed |
| M2a | `libs/game-core/src/validate-move-intent.ts` | `isValidMoveIntent` always `true` (source) | ✅ Killed (`game-core` unit — 4 failures) |
| M2b | same (source, `dist/` present) | Server `TownRoom` runtime path | ✅ **Killed** (`ignores invalid move intents`) |
| M-step | `libs/game-core/src/movement-system.ts` | `step()` early `return state` (source, `dist/` present) | ✅ Killed (`advances player position`, broadcast, move tests) |
| M3 | `TownRoom.ts:77` | Join always `createCharacter` (ignore load) | ✅ Killed (`restores saved position`) |
| M4 | `TownRoom.ts:142` | `persistCharacter` no-op | ✅ Killed (leave + debounce + onDrop tests) |
| M4b | `TownRoom.ts:onLeave` | Skip `persistCharacter` on consented leave | ✅ Killed (`persists on consented leave`) |
| M5 | `TownRoom.ts:onDrop` | Remove `persistCharacter` in `onDrop` only | ✅ Killed (`persists on unclean disconnect`) |
| M6 | `client/net/room.ts:onAdd` | Skip remote player wiring (local only) | ✅ Killed (`client-e2e` multiplayer sync) |
| M7 | `client/net/room.ts:onRemove` | Disable remote removal handler | ✅ Killed (`consented leave` e2e) |
| M8 | `TownRoom.ts:onReconnect` | Leave `connected=false` after reconnect | ✅ Killed (`preserves session slot`) |

**Sensor depth**: full (10 targeted behavior faults + source-path probe with stale `dist`)
**Result**: **10/10 killed** — ✅ PASS

---

## Gate Check

- **Commands**: `nx affected -t test lint --base=48e00e4`; `nx e2e client-e2e` (ports 2567/4200 verified free)
- **Result**: All targets passed (Nx cache used for gate; sensor bypassed cache)
- **Lint**: 0 errors (warnings only, pre-existing)
- **Test counts (in scope)**:
  - `game-core`: 11 passed
  - `server`: 36 passed (14 `TownRoom`, 4 repo, 1 schema, + seed)
  - `client`: 18 passed
  - `client-e2e`: 7 passed

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code / surgical changes | ✅ |
| Matches patterns (Colyseus room, AD-008 lift, AD-009 hook) | ✅ |
| Tests map to ACs | ✅ (19/19 story ACs) |
| AGENTS.md four-layer contract | ✅ |
| Guidelines cited | `AGENTS.md`, `AD-001`, `AD-008`, `AD-009`, `AD-010`, `AD-011` |

---

## Lessons (grounded failures)

No new lessons recorded — clean PASS. **L-001** (vitest `dist` preference) gap is now closed by `37007dd`; candidate remains in `.specs/LESSONS.md` for corroboration threshold but is no longer an active blocker.

---

## Summary

**Overall**: ✅ **PASS**

**Prior gaps**: 4/4 closed + vitest-source blocker closed (`37007dd`, `158e2ae`)

**Spec-anchored check**: 19/19 story ACs with proving tests at assigned layer; assertions match spec outcomes

**Sensor**: 10/10 mutants killed (including M2b/M-step from `libs/` source with `dist/` present)

**Leave e2e**: deterministic via newcomer-id tracking + `expect.poll` (3/3 consecutive passes)

**Gate**: pass (`nx affected` + `nx e2e client-e2e`)

**Ranked gaps**: none

**What works**: Authoritative tick, intent validation (unit + room from source), multi-client broadcast, character CRUD, join load/create, consented-leave + onDrop persist, debounced save, Colyseus reconnect slot, two-browser sync + leave removal, characterId resume, no-local-step instrumentation, shared `step()` unit parity, vitest source resolution with built `dist` present.
