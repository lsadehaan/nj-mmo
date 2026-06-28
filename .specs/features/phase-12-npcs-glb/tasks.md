# Phase 12 — NPCs: Rigged Human GLBs Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** This repo wraps it with
`spec-driven-execution` (Planner → Implementer → Verifier, **autonomous-first**);
honor server-authority (AD-001) and the four test layers (AD-010).

**If the skill cannot be activated, STOP and tell the user — do not proceed
without it.**

---

**Design**: `.specs/features/phase-12-npcs-glb/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `AGENTS.md` (4 test layers + server-authority + 10-second rule),
> `.specs/STATE.md` AD-009/AD-010/AD-014/AD-015/AD-017,
> existing patterns in `client/src/scene/npc-renderer.spec.ts`,
> `client/src/scene/mob-avatar.spec.ts`, `client/src/scene/remote-player-avatar.spec.ts`,
> `client-e2e/src/town.spec.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| NPC manifest | unit | NPCG-01–04: rows 30004/30006, null fallback, clipMap keys | `client/src/scene/creature/npc-manifest.spec.ts` | `nx test client` |
| NPC avatar (idle + greet) | unit | NPCG-05–09, NPCG-16–20: idle loop, feet offset, greet latch, facing, debounce | `client/src/scene/npc-avatar.spec.ts` | `nx test client` |
| NPC renderer (sync, fallback) | unit | NPCG-10–12: mesh not capsule, remove, state mapping | `client/src/scene/npc-renderer.spec.ts` | `nx test client` |
| Test hook + renderer wiring | unit | NPCG-15: hook publishes `action` from tick | `client/src/test-hook.spec.ts` | `nx test client` |
| Town NPC e2e | e2e | NPCG-13–14, NPCG-16–17: `renderKind`, idle, greet on shop/dialog | `client-e2e/src/town.spec.ts` (or `npc-animation.spec.ts`) | `nx e2e client-e2e` |
| GLB assets (Katerina/Roxxy) | none (visual gate) | NPCG-21–23: inspect + screenshots | `client/public/models/`, `scripts/shoot-character.mjs` | `node scripts/shoot-character.mjs` |
| Server (`NpcState`, interact) | none | Regression only — no schema change | `server/src/rooms/TownRoom.spec.ts` | `nx test server` |
| Animation state machine (`game-core`) | none | Regression only | — | `nx test game-core` (build gate) |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`client`) | Yes | Per-test mocks; no shared GLB cache mutation across files | `client/vitest` patterns |
| Room integration (`server`) | Yes | `NJ_AUTOSIM=0` + per-test room (AD-014) | `server/src/rooms/TownRoom.spec.ts` |
| E2E (`client-e2e`) | Yes | Per-test `?room=` instanceKey, 4 workers (AD-014) | `client-e2e/playwright.config.ts` |

## Gate Check Commands

> Generated from codebase (AD-010) — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (client) | After T1–T3, T6–T8 | `nx test client` |
| Quick (server) | After T10 (regression) | `nx test server` |
| Full | After T9 | `nx affected -t test lint` + `nx e2e client-e2e` |
| Build | Phase completion (T12) | `nx run-many -t build lint test` |
| Visual | After T11 (before Verifier) | `LAB_NPC=30004` / `30006` `node scripts/shoot-character.mjs` |

---

## Execution Plan

**5 phases** (12 tasks).

### Phase 1: Manifest + avatar core — Sequential

```
T1 → T2
```

### Phase 2: NPC GLB assets — Parallel

```
T2 ──┬→ T4 [P] Katerina (Mage tune)
     └→ T5 [P] Roxxy (Quaternius female)
```

### Phase 3: Renderer integration — Sequential

```
T4,T5 → T3 → T6
```

### Phase 4: Greet + observability — Sequential

```
T6 → T7 → T8
```

### Phase 5: Gate + visual review — Sequential

```
T8 → T9 → T10 → T11 → T12
```

---

## Task Breakdown

### T1: NPC manifest

**What**: `NpcEntry` type + `getNpcEntry(npcId)` with rows for **30004** and **30006**
(clip maps stubbed until T4–T5 finalize track names).
**Where**: `client/src/scene/creature/npc-manifest.ts` (+ `.spec.ts`)
**Depends on**: None
**Reuses**: `AnimationClip` from `@nj/game-core`; `KAYKIT_CLIP_MAP` from `mesh-character.ts`
**Requirement**: NPCG-01, NPCG-02, NPCG-03, NPCG-04

**Tools**: MCP: NONE · Skill: `game-designer` → `create-character.md` NPC note

**Done when**:
- [ ] Both npcIds return entries; unknown → `null`
- [ ] Each entry has `model`, `clipMap`, `scale`, `feetOffsetY`, `displayName`
- [ ] Unit tests assert keys and fallback
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add npcId manifest for town NPCs`

---

### T2: NPC avatar controller

**What**: `createNpcAvatar` — idle loop, `triggerGreet` (cast→Interact), facing, feet
offset; mockable `MeshCharacter` for tests.
**Where**: `client/src/scene/npc-avatar.ts` (+ `.spec.ts`)
**Depends on**: T1
**Reuses**: `stepAnimation`, `ACTION_DURATION_MS`, `createMeshCharacter`
**Requirement**: NPCG-05, NPCG-06, NPCG-07, NPCG-08, NPCG-09, NPCG-16, NPCG-18, NPCG-19, NPCG-20

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Idle plays continuously with no locomotion input
- [ ] `triggerGreet` plays `cast` clip for `ACTION_DURATION_MS[Cast]` then returns `idle`
- [ ] Greet debounced / non-stacking per spec
- [ ] Facing yaw updates toward `faceToward` on greet
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add npc avatar idle and greet controller`

---

### T3: Rewrite npc-renderer for mesh instances

**What**: Replace capsule `buildNpcMesh` path for mapped npcIds with `createNpcAvatar`;
retain capsule fallback for unmapped ids; `tickNpcVisuals`, `triggerNpcGreet`.
**Where**: `client/src/scene/npc-renderer.ts` (+ update `.spec.ts`)
**Depends on**: T2, T4, T5
**Reuses**: `npcStateToVisual`, `npcRoleFromType`, `buildNpcMesh` (fallback)
**Requirement**: NPCG-10, NPCG-11, NPCG-12

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Mapped npcIds create mesh groups (`userData.renderKind = 'mesh'`)
- [ ] Unmapped npcId still uses capsule
- [ ] `removeNpc` cleans scene + map
- [ ] Unit tests updated (no capsule-color assertions for mapped ids)
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): render town NPCs as rigged mesh avatars`

---

### T4: Katerina asset + manifest row (30004) [P]

**What**: Finalize Katerina manifest — KayKit `Mage.glb`, `cast: 'Interact'`, scale +
`feetOffsetY` tuned for ~2.25 m world height.
**Where**: `client/src/scene/creature/npc-manifest.ts` (30004 row)
**Depends on**: T2
**Reuses**: `create-character.md` steps 2–3, 6–7; existing `Mage.glb`
**Requirement**: NPCG-04, NPCG-21 (partial)

**Tools**: MCP: NONE · Skill: `game-designer` → `create-character.md`

**Done when**:
- [ ] Inspect output recorded (`Interact` track confirmed)
- [ ] Manifest 30004 row has real `clipMap` + tuned `scale`/`feetOffsetY`
- [ ] `character-lab.html?npc=30004&clip=idle` renders without error
- [ ] Build gate: `nx build client`

**Tests**: none (visual gate in T11) · **Gate**: build
**Commit**: `feat(assets): tune Katerina NPC manifest on Mage GLB`

---

### T5: Roxxy GLB asset + manifest row (30006) [P]

**What**: Source, inspect, vendor CC0 **female** humanoid GLB + `LICENSE.txt`; finalize
manifest row with real `clipMap` (include social/greet track).
**Where**: `client/public/models/npcs/`, `npc-manifest.ts` (30006 row)
**Depends on**: T2
**Reuses**: `create-character.md` steps 1–3, 6; Quaternius CC0 sourcing pattern from Phase 10
**Requirement**: NPCG-02, NPCG-04, NPCG-21–23

**Tools**: MCP: NONE · Skill: `game-designer` → `create-character.md`

**Done when**:
- [ ] `Roxxy.glb` (or chosen name) under `models/npcs/` + license file if available
- [ ] Inspect script output recorded; `clipMap` uses literal track names
- [ ] Silhouette visually distinct from Katerina Mage in lab idle frame
- [ ] Manifest 30006 row updated
- [ ] Build gate: `nx build client`

**Tests**: none (visual gate in T11) · **Gate**: build
**Commit**: `feat(assets): add Roxxy female NPC GLB + manifest`

---

### T6: Renderer tick + instance map

**What**: Wire `npcInstances` in `renderer.ts` — `syncNpc` uses new renderer API,
`tick()` calls `tickNpcVisuals`, expose `triggerNpcGreet` on `GameRenderer`.
**Where**: `client/src/scene/renderer.ts`
**Depends on**: T3
**Reuses**: mob tick pattern in same file
**Requirement**: NPCG-09, NPCG-15

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] NPC avatars ticked each frame with `mixer.update`
- [ ] `triggerNpcGreet(npcId, playerPos)` reachable from room layer
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): tick NPC mesh avatars in renderer`

---

### T7: Greet on interact + hook fields

**What**: Extend `GameStateNpc` with `renderKind` + `action`; merge clips in
`publishNpcsToHook`; fire greet when shop opens (Katerina) or helper dialog opens
(Roxxy).
**Where**: `client/src/test-hook.ts`, `client/src/net/room.ts`, `client/src/ui/npc-dialog.ts` / `shop-window.ts` (as needed)
**Depends on**: T6
**Reuses**: `KATERINA_NPC_ID`, `ROXXY_NPC_ID` from `npc-interaction.ts`
**Requirement**: NPCG-13, NPCG-14, NPCG-16, NPCG-17

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] `GameStateNpc` includes optional `renderKind` and `action`
- [ ] `publishNpcsToHook` publishes live clips from renderer
- [ ] Shop open triggers Katerina greet once
- [ ] Roxxy dialog open triggers Roxxy greet once
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): NPC greet on interact and hook observability`

---

### T8: Character lab + shoot script NPC mode

**What**: `character-lab.ts` accepts `?npc=<npcId>`; `shoot-character.mjs` supports
`LAB_NPC` env; shots include `idle` + `cast` (greet).
**Where**: `client/src/character-lab.ts`, `scripts/shoot-character.mjs`
**Depends on**: T4, T5
**Reuses**: existing mob/char lab patterns
**Requirement**: NPCG-21

**Tools**: MCP: NONE · Skill: `game-designer` → `create-character.md` step 7

**Done when**:
- [ ] Lab loads manifest model for 30004 and 30006
- [ ] Shoot script writes `npc-30004-idle.png`, `npc-30004-cast.png`, etc.
- [ ] Build gate: `nx build client`

**Tests**: none · **Gate**: build
**Commit**: `feat(client): extend character lab for NPC visual gate`

---

### T9: E2E town NPC assertions

**What**: Extend `town.spec.ts` (or add `npc-animation.spec.ts`) — assert both NPCs
`renderKind: 'mesh'`, idle at join, greet `cast` during buy + helper flows.
**Where**: `client-e2e/src/town.spec.ts` (preferred) or new spec file
**Depends on**: T7
**Reuses**: `walkTowardInPeaceZone`, `waitReady`, existing buy flow
**Requirement**: NPCG-13, NPCG-14, NPCG-16, NPCG-17

**Tools**: MCP: `user-playwright` (if needed) · Skill: `tlc-spec-driven`

**Done when**:
- [ ] E2e asserts `npcs` length ≥ 2 with `renderKind: 'mesh'` for 30004/30006
- [ ] Idle `action` before interact
- [ ] Greet `action === 'cast'` during shop/dialog open (poll)
- [ ] Existing buy adena **1000 → 897** test still passes
- [ ] Full gate: `nx e2e client-e2e`

**Tests**: e2e · **Gate**: full
**Commit**: `test(e2e): assert rigged NPC mesh and greet via game state hook`

---

### T10: Server regression gate

**What**: Run server suite — no code changes expected; confirm interact/shop tests
unchanged.
**Where**: — (verification task)
**Depends on**: T9
**Reuses**: AD-010 gate
**Requirement**: (regression)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `nx test server` green (count unchanged unless unrelated drift)
- [ ] No `NpcState` schema edits in diff

**Tests**: none · **Gate**: quick (server)
**Commit**: _(no commit if no changes — document PASS in Implementer summary)_

---

### T11: Visual gate capture + review

**What**: Run shoot script for both NPCs; store PNGs under review path; human/vision
check distinct female silhouettes, feet on ground, idle + greet poses.
**Where**: `/tmp/char-shots/` or `client-e2e/artifacts/npc-gate/`
**Depends on**: T8, T9
**Reuses**: AD-017 visual gate process
**Requirement**: NPCG-21, NPCG-22, NPCG-23

**Tools**: MCP: NONE · Skill: `game-designer` → `create-character.md` step 7

**Done when**:
- [ ] PNGs captured for 30004 + 30006 (idle + cast minimum)
- [ ] Review notes: distinct silhouettes, no capsule, feet OK
- [ ] Visual gate: `node scripts/shoot-character.mjs` with `LAB_BASE` + `LAB_NPC`

**Tests**: none · **Gate**: visual
**Commit**: `chore(assets): add NPC visual gate screenshots`

---

### T12: Full integration gate

**What**: Final `nx run-many -t build lint test` + `nx e2e client-e2e`; fix any lint
or affected-project drift.
**Where**: monorepo
**Depends on**: T10, T11
**Reuses**: AD-010, AD-014
**Requirement**: all NPCG-*

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Build gate green
- [ ] No tests skipped/weakened
- [ ] Implementer summary lists AC coverage map

**Tests**: unit + e2e · **Gate**: build
**Commit**: `chore(phase-12): integration gate green for NPC GLBs`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1 ──→ T2

Phase 2 (Parallel):
  T2 complete, then:
    ├── T4 [P] Katerina
    └── T5 [P] Roxxy

Phase 3 (Sequential):
  T4,T5 ──→ T3 ──→ T6

Phase 4 (Sequential):
  T6 ──→ T7 ──→ T8

Phase 5 (Sequential):
  T8 ──→ T9 ──→ T10 ──→ T11 ──→ T12
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: NPC manifest | 1 module + spec | ✅ Granular |
| T2: NPC avatar controller | 1 module + spec | ✅ Granular |
| T3: npc-renderer rewrite | 1 module + spec update | ✅ Granular |
| T4: Katerina manifest tune | 1 manifest row + verify | ✅ Granular |
| T5: Roxxy GLB + manifest | 1 asset + 1 row | ✅ Granular |
| T6: Renderer tick wiring | 1 file modify | ✅ Granular |
| T7: Greet + hook | 2–3 files, one feature | ✅ Granular |
| T8: Lab + shoot script | 2 files | ✅ Granular |
| T9: E2E assertions | 1 spec file | ✅ Granular |
| T10: Server regression | verification only | ✅ Granular |
| T11: Visual gate | artifacts + review | ✅ Granular |
| T12: Full gate | verification only | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Phase 1 start | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2, T4, T5 | T4,T5 → T3 | ✅ Match |
| T4 | T2 | T2 → T4 [P] | ✅ Match |
| T5 | T2 | T2 → T5 [P] | ✅ Match |
| T6 | T3 | T3 → T6 | ✅ Match |
| T7 | T6 | T6 → T7 | ✅ Match |
| T8 | T4, T5 | Phase 4 after T6 (T8 uses assets from T4/T5; parallel to T6 chain) | ✅ Match |
| T9 | T7 | T7 → T9 | ✅ Match |
| T10 | T9 | T9 → T10 | ✅ Match |
| T11 | T8, T9 | T9 → T11 (T8 complete) | ✅ Match |
| T12 | T10, T11 | T11 → T12 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1: NPC manifest | NPC manifest | unit | unit | ✅ OK |
| T2: NPC avatar | NPC avatar | unit | unit | ✅ OK |
| T3: npc-renderer | NPC renderer | unit | unit | ✅ OK |
| T4: Katerina asset | GLB assets | none | none | ✅ OK |
| T5: Roxxy asset | GLB assets | none | none | ✅ OK |
| T6: Renderer tick | renderer wiring | unit | unit | ✅ OK |
| T7: Greet + hook | hook + room | unit | unit | ✅ OK |
| T8: Lab + shoot | visual tooling | none | none | ✅ OK |
| T9: E2E | e2e | e2e | e2e | ✅ OK |
| T10: Server regression | server | none | none | ✅ OK |
| T11: Visual gate | assets | none | none | ✅ OK |
| T12: Full gate | integration | unit + e2e | unit + e2e | ✅ OK |
