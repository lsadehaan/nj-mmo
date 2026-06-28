# Phase 11 — Remote Players & Equipped Weapons Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** This repo wraps it with
`spec-driven-execution` (Planner → Implementer → Verifier, **autonomous-first**);
honor server-authority (AD-001) and the four test layers (AD-010).

**If the skill cannot be activated, STOP and tell the user — do not proceed
without it.**

---

**Design**: `.specs/features/phase-11-remote-players-weapons/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `AGENTS.md` (4 test layers + server-authority + AD-009 pixel
> blind), `.specs/STATE.md` AD-010/AD-014/AD-015/AD-017, patterns in
> `client/src/scene/player-avatar.spec.ts`, `client/src/scene/mobs.spec.ts`,
> `client-e2e/src/multiplayer.spec.ts`, `client-e2e/src/character-animation.spec.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Bone attachment helper | unit | RPW-12–15: findBone, attach, detach, matrix motion on attack | `client/src/scene/creature/attachment.spec.ts` | `nx test client` |
| Weapon manifest | unit | RPW-16, RPW-19, RPW-20: 2369 entry, goblin club entry, unknown id null | `client/src/scene/creature/weapon-manifest.spec.ts` | `nx test client` |
| Remote player avatar | unit | RPW-05–11: locomotion coast, attack/cast/die, facing; mirrors player-avatar tests | `client/src/scene/remote-player-avatar.spec.ts` | `nx test client` |
| Remote players map | unit | RPW-01–04, RPW-17–18: no capsule, per-session group, remove, equip toggle | `client/src/scene/remote-players.spec.ts` | `nx test client` |
| Local player weapon | unit | RPW-17–18: attach on 2369, detach on 0 | `client/src/scene/player-avatar.spec.ts` | `nx test client` |
| Goblin club on mobs | unit | RPW-21–24: club on 20003 only, per-instance clone | `client/src/scene/mobs.spec.ts` | `nx test client` |
| Test hook others | unit | RPW-25: renderKind mesh + action + equippedWeaponId | `client/src/test-hook.spec.ts` | `nx test client` |
| Renderer remote tick | unit | RPW-04, RPW-06: tick calls remote update | `client/src/scene/renderer.spec.ts` (extend or new) | `nx test client` |
| Server gameplay | none | Regression only — no server code changes | `server/src/rooms/TownRoom.spec.ts` | `nx test server` |
| Remote avatar e2e | e2e | RPW-26–28: two-browser move→move clip, stop→idle, leave regression | `client-e2e/src/remote-avatar.spec.ts` | `nx e2e client-e2e` |
| Prop / character GLBs | none (visual gate) | RPW-29–32: sword idle/attack, goblin club, dual avatar | `client/public/models/props/` | `node scripts/shoot-character.mjs` |
| Animation state machine (`game-core`) | none | Regression only | — | `nx test game-core` |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`client`) | Yes | Stub meshes; `clearGltfTemplateCache()` in `afterEach` where needed | `client/src/scene/mob-avatar.spec.ts` |
| Unit (`game-core`) | Yes | Pure functions | `libs/game-core/src/animation/*.spec.ts` |
| Room integration (`server`) | Yes | Not modified this phase; regression via gate | AD-014 |
| E2E (`client-e2e`) | Yes | Per-test `?room=` instanceKey, 4 workers (AD-014) | `client-e2e/playwright.config.ts` |

## Gate Check Commands

> Generated from codebase (AD-010) — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (client) | After T1–T12 | `nx test client` |
| Quick (server) | After T12 (regression) | `nx test server` |
| Full | After T13 | `nx affected -t test lint` + `nx e2e client-e2e` |
| Build | Phase completion (T15) | `nx run-many -t build lint test` |
| Visual | After T14 (before Verifier) | `LAB_WEAPON=2369 LAB_MOB=20003 node scripts/shoot-character.mjs` |

---

## Execution Plan

**5 phases** (15 tasks).

### Phase 1: Attachment foundation — Sequential

```
T1 → T2 → T3
```

### Phase 2: Remote avatar core — Sequential

```
T3 → T4 → T5 → T6
```

### Phase 3: Wiring + local weapon — Parallel OK after T6

```
T6 ──┬→ T7 [P]
     ├→ T8 [P]
     └→ T9 [P]
```

### Phase 4: Goblin club + tests — Sequential

```
T7,T8,T9 → T10 → T11 → T12
```

### Phase 5: E2E + visual gate + done — Sequential

```
T12 → T13 → T14 → T15
```

---

## Task Breakdown

### T1: Bone attachment helper

**What**: Implement `findBoneByName`, `attachToBone`, `detachProp` in `attachment.ts`.
**Where**: `client/src/scene/creature/attachment.ts`, `attachment.spec.ts`
**Depends on**: None
**Reuses**: Three.js `SkinnedMesh.skeleton` traversal pattern from `create-attachment.md`
**Requirement**: RPW-12, RPW-13, RPW-14, RPW-15

**Tools**:

- MCP: NONE
- Skill: `game-designer` → `create-attachment.md`

**Done when**:

- [ ] Interfaces match design.md
- [ ] Unit tests: bone found by name, attach parents to bone, detach removes parent, attack matrix delta
- [ ] Gate: `nx test client` passes (attachment specs green)

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): add skeleton bone attachment helper`

---

### T2: Discover KayKit hand bone + weapon manifest

**What**: Log KayKit `Rogue.glb` skeleton bone names; set `KAYKIT_RIGHT_HAND_BONE`;
create `weapon-manifest.ts` with entries for **2369** and `GOBLIN_CLUB_ATTACHMENT`.
**Where**: `client/src/scene/creature/weapon-manifest.ts`, `weapon-manifest.spec.ts`
**Depends on**: T1
**Reuses**: `KAYKIT_CLIP_MAP` rig (same GLB as player)
**Requirement**: RPW-16, RPW-20, RPW-21 (club entry)

**Tools**:

- MCP: NONE
- Skill: `game-designer` → `create-attachment.md` step 3

**Done when**:

- [ ] `getWeaponAttachment(2369)` returns model + bone + transform
- [ ] `getWeaponAttachment(9999)` returns `null`
- [ ] `GOBLIN_CLUB_ATTACHMENT` exported with same bone constant
- [ ] Bone name is from inspected skeleton (comment documents inspect command output)
- [ ] Gate: `nx test client`

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): add weapon attachment manifest for item 2369`

---

### T3: Prop GLB assets (Squire's Sword + Goblin Club)

**What**: Vendor CC0 prop GLBs under `client/public/models/props/`; optional
`LICENSE.txt`; stub transforms (tuning in T14).
**Where**: `client/public/models/props/SquiresSword.glb`, `GoblinClub.glb`
**Depends on**: T2
**Reuses**: KayKit/Quaternius weapon pack curl pattern from `create-attachment.md`
**Requirement**: RPW-20, RPW-29 (asset exists)

**Tools**:

- MCP: NONE
- Skill: `game-designer` → `create-attachment.md` step 1

**Done when**:

- [ ] Both GLB files exist and load without error via `loadGltfTemplate` smoke in unit test
- [ ] LICENSE.txt present if pack provides one
- [ ] Gate: `nx test client` (loader smoke)

**Tests**: unit (minimal load smoke in `weapon-manifest.spec.ts` or `attachment.spec.ts`)
**Gate**: quick (client)

**Commit**: `feat(client): add sword and club prop GLBs`

---

### T4: Remote player avatar controller

**What**: Implement `createRemotePlayerAvatar` — mesh + locomotion + action clips.
**Where**: `client/src/scene/remote-player-avatar.ts`, `remote-player-avatar.spec.ts`
**Depends on**: T3
**Reuses**: `player-avatar.ts` pattern, `MOVE_THRESHOLD`, `MOVE_COAST_MS`, `stepAnimation`
**Requirement**: RPW-05, RPW-06, RPW-07, RPW-08, RPW-09, RPW-10, RPW-11

**Tools**:

- MCP: NONE
- Skill: `game-designer` → `create-character.md` Remote-player note

**Done when**:

- [ ] Spec tests mirror `player-avatar.spec.ts` (move coast, idle, attack facing movement)
- [ ] Attack/cast/die fire on `actionSeq` bump
- [ ] No `getGameState` import
- [ ] Gate: `nx test client`

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): add remote player avatar animation controller`

---

### T5: Rewrite remote-players map for mesh avatars

**What**: Replace capsule `RemotePlayerMeshMap` with `RemotePlayerMap` of avatar instances.
**Where**: `client/src/scene/remote-players.ts`, `remote-players.spec.ts`
**Depends on**: T4
**Reuses**: `createRemotePlayerAvatar`
**Requirement**: RPW-01, RPW-02, RPW-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] No `CapsuleGeometry` in created remote groups
- [ ] Upsert is idempotent per sessionId
- [ ] Remove cleans scene + map
- [ ] Gate: `nx test client`

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): replace remote player capsules with mesh avatars`

---

### T6: Renderer remote tick + extended sync API

**What**: Wire `remotePlayers` map in `renderer.ts`; `tickRemotePlayers` in tick loop;
extend `syncRemotePlayer` to accept full sync payload.
**Where**: `client/src/scene/renderer.ts`, `renderer` unit test
**Depends on**: T5
**Reuses**: `tickMobVisuals` pattern
**Requirement**: RPW-04, RPW-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `tick` advances remote avatars each frame
- [ ] `syncRemotePlayer` accepts `action`, `actionSeq`, `equippedWeaponItemId`
- [ ] Unit test proves tick calls avatar `update`
- [ ] Gate: `nx test client`

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): tick remote player avatars in renderer`

---

### T7: Room wiring for remote fields [P]

**What**: Pass `action`, `actionSeq`, `equippedWeaponItemId` from `room.ts` to
`game.syncRemotePlayer` on add/change.
**Where**: `client/src/net/room.ts`
**Depends on**: T6
**Reuses**: Existing `syncLocal` action fields
**Requirement**: RPW-11, RPW-17, RPW-18

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Non-local `onAdd`/`onChange` passes all sync fields
- [ ] `connected === false` filter unchanged
- [ ] Gate: `nx test client`

**Tests**: unit (existing room tests if any; otherwise covered by T8/T12 integration)
**Gate**: quick (client)

**Commit**: `feat(client): sync remote player action and equip from room state`

---

### T8: Extend test hook `others` + publish [P]

**What**: Extend `OtherPlayer` with `renderKind`, `action`, `equippedWeaponId`;
`publishOthers` reads from `game.listRemotePlayers()`.
**Where**: `client/src/test-hook.ts`, `test-hook.spec.ts`, `remote-players.ts`
**Depends on**: T6
**Reuses**: `GameStateMob.action` pattern
**Requirement**: RPW-25

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `setOthers` / `publishOthers` populates new fields
- [ ] `renderKind` always `'mesh'` for remotes
- [ ] Unit tests assert shape
- [ ] Gate: `nx test client`

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): expose remote avatar action on __GAME_STATE__.others`

---

### T9: Local player sword attach [P]

**What**: Extend `player-avatar` + `syncLocalPlayer` to attach/detach sword on
`equippedWeaponItemId`; thread id from `room.ts` `syncLocal`.
**Where**: `client/src/scene/player-avatar.ts`, `player-avatar.spec.ts`, `renderer.ts`, `room.ts`
**Depends on**: T1, T2, T3, T6
**Reuses**: `attachToBone`, `getWeaponAttachment`
**Requirement**: RPW-17, RPW-18, RPW-19

**Tools**:

- MCP: NONE
- Skill: `create-attachment.md`

**Done when**:

- [ ] Equip 2369 adds prop child under hand bone (unit stub mesh)
- [ ] Equip 0 removes prop
- [ ] `character-animation.spec.ts` still passes (regression)
- [ ] Gate: `nx test client`

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): attach squire sword to local player when equipped`

---

### T10: Goblin club attachment on mob instances

**What**: When `npcId=20003` mesh avatar is ready, clone and attach club prop.
**Where**: `client/src/scene/mobs.ts`, `mobs.spec.ts`
**Depends on**: T1, T2, T3, T7
**Reuses**: `GOBLIN_CLUB_ATTACHMENT`, mob template load path
**Requirement**: RPW-21, RPW-22, RPW-23, RPW-24

**Tools**:

- MCP: NONE
- Skill: `create-attachment.md` step 6 (clone per instance)

**Done when**:

- [ ] Goblin instance has club child; Gremlin does not
- [ ] Two goblins → distinct club object references
- [ ] Gate: `nx test client`

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): attach club prop to goblin mobs`

---

### T11: Remote player weapon attach

**What**: Wire `equippedWeaponItemId` in `remote-player-avatar` / `upsertRemotePlayer`
attach path (may land in T4/T5 if not done — this task closes RPW-17–18 for remotes).
**Where**: `client/src/scene/remote-player-avatar.ts`, `remote-players.spec.ts`
**Depends on**: T7, T9
**Reuses**: Same attach logic as local player
**Requirement**: RPW-17, RPW-18

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Remote sync with `equippedWeaponItemId: 2369` attaches sword
- [ ] Change to `0` detaches
- [ ] Gate: `nx test client`

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): show equipped sword on remote players`

---

### T12: Server regression + full client unit gate

**What**: Run full client + server unit suites; fix any regressions from signature changes.
**Where**: (fix only if needed)
**Depends on**: T10, T11
**Reuses**: AD-010 gate
**Requirement**: all RPW (regression)

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `nx test client` all green
- [ ] `nx test server` all green (no new tests required)
- [ ] No tests deleted/weakened

**Tests**: unit (regression)
**Gate**: quick (client) + quick (server)

**Commit**: `test(client): phase 11 remote avatar and weapon coverage`

---

### T13: E2E remote avatar spec

**What**: Add `client-e2e/src/remote-avatar.spec.ts` — two browsers, assert
`others[].renderKind === 'mesh'`, `action` move/idle; keep `multiplayer.spec.ts` green.
**Where**: `client-e2e/src/remote-avatar.spec.ts`
**Depends on**: T12
**Reuses**: `multiplayer.spec.ts` two-browser pattern, AD-014 room isolation
**Requirement**: RPW-26, RPW-27, RPW-28

**Tools**:

- MCP: `user-playwright` (if needed)
- Skill: NONE

**Done when**:

- [ ] E2e asserts mesh renderKind
- [ ] E2e asserts move then idle on `others[].action`
- [ ] `nx e2e client-e2e` full suite green
- [ ] Gate: full

**Tests**: e2e
**Gate**: full

**Commit**: `test(e2e): assert remote players render as animated meshes`

---

### T14: Visual gate — weapon + dual avatar

**What**: Extend `character-lab.ts` + `shoot-character.mjs` for `LAB_WEAPON=2369`,
dual-avatar mode, goblin club shots; tune grip transforms; capture PNGs for review.
**Where**: `client/character-lab.ts`, `scripts/shoot-character.mjs`, manifest transforms
**Depends on**: T13
**Reuses**: Phase 8/10 visual gate harness
**Requirement**: RPW-29, RPW-30, RPW-31, RPW-32

**Tools**:

- MCP: NONE
- Skill: `game-designer` → `create-attachment.md` step 6–7

**Done when**:

- [ ] Screenshots: sword idle + attack, goblin club attack, two-avatar idle + attack
- [ ] Grip transforms updated in manifest from visual review
- [ ] Human review note ready for Verifier (validation.md)

**Tests**: none (visual gate)
**Gate**: visual

**Commit**: `feat(client): extend character lab for weapon visual gate`

---

### T15: ROADMAP flip + build gate

**What**: Mark Phase 11 `[x]` in `.specs/ROADMAP.md`; update `.specs/STATE.md`
handoff; run full build gate.
**Where**: `.specs/ROADMAP.md`, `.specs/STATE.md`
**Depends on**: T14
**Reuses**: AD-010 build gate
**Requirement**: Success criteria (all)

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `nx run-many -t build lint test` green
- [ ] `nx e2e client-e2e` green
- [ ] ROADMAP Phase 11 checked

**Tests**: none
**Gate**: build

**Commit**: `docs(specs): mark phase 11 remote players and weapons complete`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1 ──→ T2 ──→ T3

Phase 2 (Sequential):
  T3 ──→ T4 ──→ T5 ──→ T6

Phase 3 (Parallel after T6):
  T6 complete, then:
    ├── T7 [P]
    ├── T8 [P]
    └── T9 [P]

Phase 4 (Sequential):
  T7,T8,T9 ──→ T10 ──→ T11 ──→ T12

Phase 5 (Sequential):
  T12 ──→ T13 ──→ T14 ──→ T15
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: attachment helper | 1 module + spec | ✅ Granular |
| T2: weapon manifest | 1 module + spec | ✅ Granular |
| T3: prop GLBs | asset vendoring | ✅ Granular |
| T4: remote-player-avatar | 1 controller + spec | ✅ Granular |
| T5: remote-players rewrite | 1 map module | ✅ Granular |
| T6: renderer tick | 1 file API change | ✅ Granular |
| T7: room wiring | 1 file | ✅ Granular |
| T8: test hook | 2 files | ✅ Granular |
| T9: local sword | player-avatar extend | ✅ Granular |
| T10: goblin club | mobs extend | ✅ Granular |
| T11: remote sword | remote avatar extend | ✅ Granular |
| T12: regression gate | verification | ✅ Granular |
| T13: e2e | 1 spec file | ✅ Granular |
| T14: visual gate | lab + script | ✅ Granular |
| T15: docs + build | housekeeping | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Phase 1 start | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |
| T7 | T6 | T6 → T7 | ✅ Match |
| T8 | T6 | T6 → T8 | ✅ Match |
| T9 | T6 (+ T1-T3 implicit) | T6 → T9 | ✅ Match |
| T10 | T7 (listed; also needs T1-T3) | after T7,T8,T9 → T10 | ✅ Match |
| T11 | T7, T9 | T10 → T11 | ✅ Match |
| T12 | T10, T11 | T11 → T12 | ✅ Match |
| T13 | T12 | T12 → T13 | ✅ Match |
| T14 | T13 | T13 → T14 | ✅ Match |
| T15 | T14 | T14 → T15 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | attachment helper | unit | unit | ✅ OK |
| T2 | weapon manifest | unit | unit | ✅ OK |
| T3 | prop GLBs | unit (smoke) | unit | ✅ OK |
| T4 | remote-player-avatar | unit | unit | ✅ OK |
| T5 | remote-players map | unit | unit | ✅ OK |
| T6 | renderer tick | unit | unit | ✅ OK |
| T7 | room wiring | unit | unit | ✅ OK |
| T8 | test hook | unit | unit | ✅ OK |
| T9 | local player weapon | unit | unit | ✅ OK |
| T10 | goblin club | unit | unit | ✅ OK |
| T11 | remote weapon | unit | unit | ✅ OK |
| T12 | regression | unit | unit | ✅ OK |
| T13 | e2e | e2e | e2e | ✅ OK |
| T14 | visual gate | none | none | ✅ OK |
| T15 | docs | none | none | ✅ OK |

---

## Requirement → Task Mapping

| Requirement ID | Task(s) |
| -------------- | ------- |
| RPW-01–03 | T5 |
| RPW-04, RPW-06 | T6 |
| RPW-05–11 | T4, T7 |
| RPW-12–15 | T1 |
| RPW-16, RPW-20 | T2, T3 |
| RPW-17–19 | T9, T11 |
| RPW-21–24 | T10 |
| RPW-25 | T8 |
| RPW-26–28 | T13 |
| RPW-29–32 | T14 |

**Coverage:** 32 ACs → 15 tasks, 0 unmapped ✅
