# Phase 26 — Social & Multiplayer Systems Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its
Execute flow and Critical Rules.** This repo wraps it with `spec-driven-execution`
(Planner → Implementer → Verifier, **autonomous-first**); honor server-authority (AD-001)
and the three test layers (AD-010) — **no Playwright**.

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/phase-26-social/design.md`
**Spec**: `.specs/features/phase-26-social/spec.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from spec ACs, `AGENTS.md`, and `.specs/STATE.md` AD-009/010/014.
> Post-MVP gate: **no `client-e2e` / Playwright**.

| Code Layer | Required Test Type | ACs | Location Pattern | Run Command |
| ---------- | ------------------ | --- | ---------------- | ----------- |
| Chat / party XP / trade / friends pure | unit | SOC26-05–07, 38, 40–41, 33–34 + distribution anchors | `libs/game-core/src/social/**/*.spec.ts` | `nx test game-core` |
| Friends DB | unit | SOC26-31–32 | `server/src/db/friends-repository.spec.ts` | `nx test server` |
| Colyseus schema | none (build) | SOC26-10, 16 | `server/src/rooms/schema/` | build gate |
| TownRoom social handlers | room | SOC26-01–04, 09–15, 17–22, 23–29, 31–32, 35, 37, 39 | `server/src/rooms/TownRoom.social.spec.ts` | `nx test server` |
| Solo kill regression | room | SOC26-21 | `server/src/rooms/TownRoom.spec.ts` or social spec | `nx test server` |
| wireRoom social | unit | SOC26-08, 16, 30, 36 | `client/src/net/room-social.spec.ts`, `test-hook.spec.ts` | `nx test client` |
| Client DOM panels | unit | (wiring smoke) | `client/src/ui/*-panel.spec.ts`, `trade-window.spec.ts` | `nx test client` |
| Full gate | gate | SOC26-42 | `nx run-many` | `nx run-many -t build lint test` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`game-core`, `client`) | Yes | Vitest per-file | Existing `*.spec.ts` |
| Room integration | Yes | `NJ_AUTOSIM=0` + per-test room + temp DB + `instanceKey` (AD-014) | `TownRoom.spec.ts` |
| Friends DB unit | Yes | In-memory SQLite per test (AD-011) | `character-repository.spec.ts` pattern |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (game-core) | After T1–T4 | `nx test game-core` |
| Quick (server) | After T5–T10, T12 | `nx test server` |
| Quick (client) | After T13–T16 | `nx test client` |
| Full | After T17 | `nx affected -t test lint` |
| Build | Phase completion (T18) | `nx run-many -t build lint test` |

**Speed contract:** Room tests use `NJ_AUTOSIM=0` + `deliver()`/`tick()` — no wall-clock
sleeps. Per-test cap ≤ **10 s** (AD-014). Social room tests live in **`TownRoom.social.spec.ts`**
to avoid bloating the 4700-line combat spec file.

---

## Execution Plan

**5 phases** (18 tasks).

### Phase 1: game-core pure logic — Sequential

```
T1 → T2 → T3 → T4
```

### Phase 2: Server schema & persistence — Sequential

```
T4 → T5 → T6
```

### Phase 3: TownRoom handlers — Sequential

```
T6 → T7 → T8 → T9 → T10
```

### Phase 4: Client UI & wireRoom — Parallel OK

```
T10 ──┬→ T11 [P] chat panel
      ├→ T12 [P] party panel
      ├→ T13 [P] trade window
      └→ T14 [P] friends panel
T11–T14 → T15 → T16
```

### Phase 5: Integration & gate — Sequential

```
T16 → T17 → T18
```

---

## Task Breakdown

### T1: Chat validation pure module

**What**: `validateChatMessage`, rate limiter, `isInChatRange`; unit tests for SOC26-05–07, 40.
**Where**: `libs/game-core/src/social/chat.ts`, `chat.spec.ts`
**Depends on**: None
**Reuses**: distance helpers from combat
**Requirements**: SOC26-05, SOC26-06, SOC26-07, SOC26-40

**Done when**:

- [ ] Rate limit rejects 6th message in 10 s window
- [ ] Empty and >120 char rejected
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick (game-core)

---

### T2: Party XP distribution pure module

**What**: `calcPartyXpGrants` with L2J bonus table, level² split, level-gap cutoff.
**Where**: `libs/game-core/src/social/party-xp.ts`, `party-xp.spec.ts`
**Depends on**: T1
**Reuses**: `grantXp` progression
**Requirements**: SOC26-17, SOC26-19

**Done when**:

- [ ] 2×L1 Gremlin anchor: each grant **28**
- [ ] L4 member with L25 highest: grant **0**
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick (game-core)

---

### T3: Party loot assignment pure module

**What**: `assignPartyDrops` random assignee with seeded RNG.
**Where**: `libs/game-core/src/social/party-loot.ts`, `party-loot.spec.ts`
**Depends on**: T2
**Requirements**: SOC26-20

**Done when**:

- [ ] Deterministic assignment with pinned RNG
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick (game-core)

---

### T4: Trade validation & atomic swap pure module

**What**: `validateTradeOffer`, `executeTradeSwap`; quest/equipped reject; conservation tests.
**Where**: `libs/game-core/src/social/trade.ts`, `trade.spec.ts`
**Depends on**: T3
**Requirements**: SOC26-26, SOC26-27, SOC26-38, SOC26-41

**Done when**:

- [ ] Swap conserves total item counts + adena
- [ ] Insufficient adena returns null
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick (game-core)

---

### T5: Friends schema + repository

**What**: `character_friends` table; `loadFriends`, `addFriend`, `removeFriend`.
**Where**: `server/src/db/schema.ts`, `friends-repository.ts`, `friends-repository.spec.ts`
**Depends on**: T4
**Requirements**: SOC26-31, SOC26-32, SOC26-33, SOC26-34

**Done when**:

- [ ] CRUD round-trip in temp DB
- [ ] Cap 50 enforced in `canAddFriend` + repo
- [ ] Gate: `nx test server`

**Tests**: unit | **Gate**: quick (server)

---

### T6: Colyseus PartyState + PlayerState fields

**What**: `PartyState` schema; `TownState.parties`; `PlayerState.partyId`, `characterName`.
**Where**: `server/src/rooms/schema/`
**Depends on**: T5
**Requirements**: SOC26-10, SOC26-16

**Done when**:

- [ ] Schema compiles; exported from schema index
- [ ] Gate: `nx run server:build` (or `nx test server` smoke)

**Tests**: none | **Gate**: build

---

### T7: TownRoom chat handler

**What**: `chat` intent; channel routing; `broadcast('chat')`; rate state per session.
**Where**: `server/src/rooms/TownRoom.ts`, `social/chat-handler.ts`
**Depends on**: T6
**Reuses**: T1 `validateChatMessage`
**Requirements**: SOC26-01, SOC26-02, SOC26-03, SOC26-04

**Done when**:

- [ ] Room: `all` reaches 2 clients; `local` range 30 enforced
- [ ] Gate: `nx test server` (social spec)

**Tests**: room | **Gate**: quick (server)

---

### T8: TownRoom party handlers

**What**: invite/accept/decline/leave/kick; `PartyState` lifecycle; disconnect cleanup.
**Where**: `server/src/rooms/party-handlers.ts`, `TownRoom.ts`
**Depends on**: T7
**Requirements**: SOC26-09–SOC26-15, SOC26-37, SOC26-38

**Done when**:

- [ ] Room: two-session invite → accept → party replicated
- [ ] Kick + leader transfer on leave tested
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

---

### T9: Party kill rewards integration

**What**: Extend `handleMobKill` with party XP/loot/quest branch; proximity filter.
**Where**: `server/src/rooms/TownRoom.ts`, `party-kill-rewards.ts`
**Depends on**: T8
**Reuses**: T2, T3, `onMobKilledForQuests`
**Requirements**: SOC26-17, SOC26-18, SOC26-20, SOC26-21, SOC26-22

**Done when**:

- [ ] Room: two-session party Gremlin → each +28 xp
- [ ] Solo regression +44 unchanged
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

---

### T10: TownRoom trade handlers

**What**: `trade-handlers.ts`; full request→confirm flow; range 3; disconnect cancel.
**Where**: `server/src/rooms/trade-handlers.ts`, `TownRoom.ts`
**Depends on**: T9
**Reuses**: T4 `executeTradeSwap`
**Requirements**: SOC26-23–SOC26-29, SOC26-39

**Done when**:

- [ ] Room: two-session adena+item swap succeeds
- [ ] Insufficient adena fails with no change
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

---

### T11: TownRoom friends handlers [P]

**What**: `friendAdd`/`friendRemove`; sync list to client; online flags on join/leave.
**Where**: `server/src/rooms/friend-handlers.ts`, `TownRoom.ts`
**Depends on**: T10
**Reuses**: T5 repository
**Requirements**: SOC26-31, SOC26-32, SOC26-35

**Done when**:

- [ ] Room: add friend persists; online toggles on leave
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

---

### T12: Chat panel UI [P]

**What**: DOM chat panel with channel selector + input; sends `chat` intent.
**Where**: `client/src/ui/chat-panel.ts`, `chat-panel.spec.ts`
**Depends on**: T10
**Requirements**: (UI smoke; AC coverage via T15)

**Done when**:

- [ ] Panel renders; submit calls `room.send('chat', …)`
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

---

### T13: Party panel UI [P]

**What**: DOM party panel: member list, invite button, leave/kick actions.
**Where**: `client/src/ui/party-panel.ts`, `party-panel.spec.ts`
**Depends on**: T10
**Requirements**: (UI smoke; AC coverage via T15)

**Done when**:

- [ ] Invite button sends `partyInvite`
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

---

### T14: Trade window UI [P]

**What**: DOM trade window: offer slots, adena field, confirm/cancel.
**Where**: `client/src/ui/trade-window.ts`, `trade-window.spec.ts`
**Depends on**: T10
**Requirements**: (UI smoke; AC coverage via T15)

**Done when**:

- [ ] Confirm sends `tradeConfirm`
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

---

### T15: Friends panel UI [P]

**What**: DOM friends list with add/remove controls.
**Where**: `client/src/ui/friends-panel.ts`, `friends-panel.spec.ts`
**Depends on**: T10
**Requirements**: (UI smoke; AC coverage via T16)

**Done when**:

- [ ] Add friend sends `friendAdd`
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

---

### T16: wireRoom social state + test hooks

**What**: Extend `wireRoom` for `chat`, `party`, `trade`, `friends`; `test-hook` types +
`window.__sendChat__` etc.; `room-social.spec.ts` for SOC26-08, 16, 30, 36.
**Where**: `client/src/net/room.ts`, `test-hook.ts`, `room-social.spec.ts`
**Depends on**: T11, T12, T13, T14, T15
**Requirements**: SOC26-08, SOC26-16, SOC26-30, SOC26-36

**Done when**:

- [ ] Mock room: chat broadcast updates `__GAME_STATE__.chat`
- [ ] Party snapshot synced on `partyId` change
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

---

### T17: Mount social UI in main + room social spec file

**What**: `main.ts` mounts panels; extract/create `TownRoom.social.spec.ts` with two-session
party + trade suites; wire `deliver` helpers.
**Where**: `client/src/main.ts`, `server/src/rooms/TownRoom.social.spec.ts`
**Depends on**: T16
**Requirements**: SOC26-17, SOC26-25 (integration evidence)

**Done when**:

- [ ] `TownRoom.social.spec.ts` contains named tests for party kill + trade swap
- [ ] Panels mounted without breaking boot
- [ ] Gate: `nx test server` + `nx test client`

**Tests**: room + unit | **Gate**: full

---

### T18: Full regression gate

**What**: Run full monorepo gate; verify no test file >10 s; fix any affected lint.
**Where**: (gate only)
**Depends on**: T17
**Requirements**: SOC26-42

**Done when**:

- [ ] `nx run-many -t build lint test` green
- [ ] Gate: full

**Tests**: gate | **Gate**: build

**Commit**: `docs(spec): phase 26 social planning complete` *(optional — Implementer commits per task)*

---

## Parallel Execution Map

```
Phase 1:  T1 → T2 → T3 → T4
Phase 2:  T4 → T5 → T6
Phase 3:  T6 → T7 → T8 → T9 → T10 → T11
Phase 4:  T12 [P] T13 [P] T14 [P] T15 [P]  (after T10; parallel with T11 if handlers done)
          T11 → T16 (needs T11 friends server)
          T12–T15 → T16
Phase 5:  T16 → T17 → T18
```

**Note:** T11 (friends server) must complete before T16 (wireRoom friends). T12–T15 can
run in parallel once T10 lands (trade server is last blocking handler).

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: chat pure | 1 module | ✅ Granular |
| T2: party XP pure | 1 module | ✅ Granular |
| T3: party loot pure | 1 module | ✅ Granular |
| T4: trade pure | 1 module | ✅ Granular |
| T5: friends DB | 1 repository | ✅ Granular |
| T6: schema | 1 schema file | ✅ Granular |
| T7: chat handler | 1 handler group | ✅ Granular |
| T8: party handlers | 1 handler group | ✅ Granular |
| T9: party kill hook | 1 integration point | ✅ Granular |
| T10: trade handlers | 1 handler group | ✅ Granular |
| T11: friends handlers | 1 handler group | ✅ Granular |
| T12–T15: UI panels | 1 panel each | ✅ Granular |
| T16: wireRoom | 1 wiring task | ✅ Granular |
| T17: social spec file | 1 test file + mount | ✅ Granular |
| T18: gate | gate task | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Phase1 start | ✅ |
| T2 | T1 | T1→T2 | ✅ |
| T3 | T2 | T2→T3 | ✅ |
| T4 | T3 | T3→T4 | ✅ |
| T5 | T4 | T4→T5 | ✅ |
| T6 | T5 | T5→T6 | ✅ |
| T7 | T6 | T6→T7 | ✅ |
| T8 | T7 | T7→T8 | ✅ |
| T9 | T8 | T8→T9 | ✅ |
| T10 | T9 | T9→T10 | ✅ |
| T11 | T10 | T10→T11 | ✅ |
| T12 | T10 | T10→T12 [P] | ✅ |
| T13 | T10 | T10→T13 [P] | ✅ |
| T14 | T10 | T10→T14 [P] | ✅ |
| T15 | T10 | T10→T15 [P] | ✅ |
| T16 | T11,T12–T15 | T11,T12–15→T16 | ✅ |
| T17 | T16 | T16→T17 | ✅ |
| T18 | T17 | T17→T18 | ✅ |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| ---- | ---------- | --------------- | --------- | ------ |
| T1 | game-core social | unit | unit | ✅ |
| T2 | game-core social | unit | unit | ✅ |
| T3 | game-core social | unit | unit | ✅ |
| T4 | game-core social | unit | unit | ✅ |
| T5 | friends DB | unit | unit | ✅ |
| T6 | schema | none | none | ✅ |
| T7 | TownRoom chat | room | room | ✅ |
| T8 | TownRoom party | room | room | ✅ |
| T9 | party kill | room | room | ✅ |
| T10 | TownRoom trade | room | room | ✅ |
| T11 | TownRoom friends | room | room | ✅ |
| T12 | chat panel | unit | unit | ✅ |
| T13 | party panel | unit | unit | ✅ |
| T14 | trade window | unit | unit | ✅ |
| T15 | friends panel | unit | unit | ✅ |
| T16 | wireRoom | unit | unit | ✅ |
| T17 | social spec + mount | room + unit | room + unit | ✅ |
| T18 | gate | gate | gate | ✅ |

---

## Requirement → Task Map

| AC range | Task(s) |
| -------- | ------- |
| SOC26-01–04, 05–07, 40 | T1, T7 |
| SOC26-17–19 | T2, T9 |
| SOC26-20 | T3, T9 |
| SOC26-26–27, 38, 41 | T4, T10 |
| SOC26-31–34 | T5, T11 |
| SOC26-09–16, 37–38 | T6, T8, T16 |
| SOC26-21–22 | T9 |
| SOC26-23–30, 39 | T10, T16 |
| SOC26-35 | T11 |
| SOC26-36 | T16 |
| SOC26-08, 16, 30 | T16 |
| SOC26-42 | T18 |

**Coverage:** 42 ACs → 18 tasks; 0 unmapped.
