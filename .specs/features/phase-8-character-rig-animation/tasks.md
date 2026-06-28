# Player Character — Procedural Humanoid Rig & Action Animation Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** Do not search for skill files by
filesystem path. The skill is the source of truth for the full flow (per-task
cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed.**

---

**Design**: `.specs/features/phase-8-character-rig-animation/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `AGENTS.md` (test boundary + 4 layers), `.specs/STATE.md`
> AD-009 (no pixels) / AD-010 (gate commands) / AD-014 (room-test perf), existing
> specs (`libs/game-core/src/movement-system.spec.ts`,
> `client/src/scene/npc-renderer.spec.ts`, `server/src/rooms/TownRoom.spec.ts`,
> `client-e2e/src/*.spec.ts`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Pure logic (`game-core`: EntityAction, animation state machine) | unit | All branches; 1:1 to spec ACs (CHAR-09/10); every listed edge case | `libs/game-core/src/**/*.spec.ts` | `nx test game-core` |
| Server schema + room signal (`PlayerState`, `TownRoom`) | room integration + unit | Action/seq set on attack/skill/death; not persisted (CHAR-05–08, 12) | `server/src/rooms/**/*.spec.ts` | `nx test server` |
| Client geometry/animation (rig, builder, clips, animator, avatar, hook) | unit | Builder mesh/socket/bbox/symmetry; clip determinism; animator clip selection; locomotion/facing (CHAR-01–04, 11) | `client/src/**/*.spec.ts` | `nx test client` |
| Client behavior (action transitions in running client) | e2e | `idle → move → attack → cast` via `__GAME_STATE__.player.action` (CHAR-11) | `client-e2e/src/*.spec.ts` | `nx e2e client-e2e` |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`game-core`) | Yes | Pure functions, no shared state | `libs/game-core/src/movement-system.spec.ts` |
| Unit (`client`) | Yes | Per-test three objects, no GL/global state | `client/src/scene/npc-renderer.spec.ts` |
| Room integration (`server`) | Yes | `NJ_AUTOSIM=0` + per-test `:memory:` room (AD-014) | `server/src/rooms/TownRoom.spec.ts` |
| E2E (`client-e2e`) | Yes | Per-test `?room=` instanceKey, 4 workers (AD-014) | `client-e2e/playwright.config.ts` |

## Gate Check Commands

> Generated from codebase (AD-010) — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `nx test game-core` / `nx test server` / `nx test client` (affected) |
| Full | After tasks with e2e | Quick + `nx e2e client-e2e` |
| Build | After phase completion / schema or wiring tasks | `nx run-many -t build lint test` |

---

## Execution Plan

### Phase 1: Shared pure logic (`game-core`) — Sequential

```
T1 → T2
```

### Phase 2: Server action signal — depends T1

```
        ┌→ T4 ─┐
T1 → T3 ┼→ T5 ─┤
        └→ T6 ─┘
```

### Phase 3: Client rig + animation — depends T1/T2

```
T7 → T8 → T9 → T10
```

### Phase 4: Client integration — depends Phase 2 + Phase 3

```
T8,T10 → T11 → T12 → T13
```

### Phase 5: E2E — depends T13

```
T13 → T14
```

> 5 phases → the Execute step will **offer one sub-agent per phase** (sequential),
> then a fresh Verifier after the final task (per the skill).

---

## Task Breakdown

### T1: EntityAction enum + duration table

**What**: Shared render-only action enum, `AnimationClip` type, and per-action
duration constants.
**Where**: `libs/game-core/src/animation/entity-action.ts` (+ export in `index.ts`)
**Depends on**: None
**Reuses**: `libs/game-core/src/world-constants.ts` (constant-export style)
**Requirement**: CHAR-05

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] `EntityAction { None=0, Attack=1, Cast=2, Die=3 }`, `AnimationClip` union, and `ACTION_DURATION_MS` exported and barrelled
- [ ] Unit test asserts enum values + duration map (Attack 600 / Cast 800 / Die 1200 / None 0)
- [ ] Quick gate passes: `nx test game-core`
- [ ] Test count recorded (no silent deletions)

**Tests**: unit · **Gate**: quick
**Commit**: `feat(game-core): add EntityAction enum + duration table`

---

### T2: Pure animation state machine

**What**: `createAnimState` + `stepAnimation` selecting `{clip, phase}` with
precedence + seq-retrigger + duration expiry.
**Where**: `libs/game-core/src/animation/animation-state.ts` (+ `index.ts`)
**Depends on**: T1
**Reuses**: `libs/game-core/src/player-death.ts` (pure + injected `nowMs` pattern)
**Requirement**: CHAR-09, CHAR-10

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] `stepAnimation` returns correct clip for all inputs; precedence `die>cast>attack>move>idle`
- [ ] Unit tests cover: seq-retrigger (CHAR-09.2), duration expiry → locomotion (CHAR-10), `die` stays latched, stale-action no-retrigger (CHAR-09.5), uint16 seq-wrap (change-not-`>`), unknown enum → locomotion
- [ ] Quick gate passes: `nx test game-core`
- [ ] Test count recorded

**Tests**: unit · **Gate**: quick
**Commit**: `feat(game-core): add animation state machine`

---

### T3: Extend PlayerState with render-only action fields

**What**: Add `action` + `actionSeq` to `PlayerState`; confirm persistence
excludes them (round-trip test).
**Where**: `server/src/rooms/schema/TownState.ts` (+ save/load mapping site)
**Depends on**: T1
**Reuses**: existing `PlayerState` scalar `@type` fields; character save/load tests
**Requirement**: CHAR-05, CHAR-12

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] `@type('number') action = 0` and `actionSeq = 0` added
- [ ] Persistence round-trip test asserts saved/loaded character ignores both (loaded → `action=0, actionSeq=0`)
- [ ] Quick gate passes: `nx test server`
- [ ] Test count recorded

**Tests**: integration · **Gate**: quick
**Commit**: `feat(server): add render-only action signal fields to PlayerState`

---

### T4: Server sets ATTACK on melee resolve [P]

**What**: On melee attack resolution, set the attacker's `action=ATTACK` and bump `actionSeq`.
**Where**: `server/src/rooms/TownRoom.ts` (attack resolve path) / `combat-resolver.ts`
**Depends on**: T3
**Reuses**: existing attack resolve site (`TownRoom.ts:143`, `combat-resolver.ts:86`)
**Requirement**: CHAR-06

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Room-integration test: after a confirmed melee attack, attacker `action===1` and `actionSeq` incremented; two attacks → differing seq (CHAR-05.5)
- [ ] No change to damage/XP/range outcomes (AD-001 render-only)
- [ ] Quick gate passes: `nx test server`
- [ ] Test count recorded

**Tests**: integration · **Gate**: quick
**Commit**: `feat(server): emit ATTACK action signal on melee resolve`

---

### T5: Server sets CAST on skill resolve [P]

**What**: On Power Strike resolution, set caster `action=CAST` and bump `actionSeq`.
**Where**: `server/src/rooms/TownRoom.ts` (skill resolve path) / `combat-resolver.ts:164`
**Depends on**: T3
**Reuses**: existing skill resolve site (`TownRoom.ts:158`)
**Requirement**: CHAR-07

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Room-integration test: after a confirmed Power Strike, caster `action===2` and `actionSeq` incremented
- [ ] MP cost / cooldown / damage outcomes unchanged (AD-001)
- [ ] Quick gate passes: `nx test server`
- [ ] Test count recorded

**Tests**: integration · **Gate**: quick
**Commit**: `feat(server): emit CAST action signal on skill resolve`

---

### T6: Server sets DIE on player death [P]

**What**: In `handlePlayerDeath`, set `action=DIE` + bump `actionSeq` **before**
the same-tick respawn restores position/HP.
**Where**: `server/src/rooms/TownRoom.ts:574 (handlePlayerDeath)`
**Depends on**: T3
**Reuses**: existing death path
**Requirement**: CHAR-08

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Room-integration test: when a player's HP hits 0, `action===3` and `actionSeq` incremented; respawn position/HP restore still occur (death outcome unchanged)
- [ ] Quick gate passes: `nx test server`
- [ ] Test count recorded

**Tests**: integration · **Gate**: quick
**Commit**: `feat(server): emit DIE action signal on player death`

---

### T7: Rig contract module

**What**: `Socket` type, `REQUIRED_SOCKETS`, `Rig` interface, `validateRig`.
**Where**: `client/src/scene/creature/rig-contract.ts`
**Depends on**: None
**Reuses**: `THREE.Group`/`userData` conventions (`client/src/scene/npc-renderer.ts`)
**Requirement**: CHAR-02

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Types + `REQUIRED_SOCKETS` exported; `validateRig` returns `{ok, missing}`
- [ ] Unit test: validator passes a complete rig, flags missing sockets
- [ ] Quick gate passes: `nx test client`
- [ ] Test count recorded

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add creature rig contract`

---

### T8: Humanoid builder

**What**: `buildHumanoid(params)` → segmented primitive group + sockets + bbox.
**Where**: `client/src/scene/creature/humanoid.ts`
**Depends on**: T7
**Reuses**: `npc-renderer.buildNpcMesh` material/flat-shading style (AD-005)
**Requirement**: CHAR-01, CHAR-02, CHAR-03(bbox)

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Group has torso/head/2 arms/2 legs distinct meshes; no capsule
- [ ] Unit tests: all `REQUIRED_SOCKETS` present; bbox height 1.6–2.0 m; feet at y≈0 (|min y|≤0.05); L/R sockets mirror-symmetric (CHAR-01..02, AC bbox/symmetry)
- [ ] Quick gate passes: `nx test client`
- [ ] Test count recorded

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add procedural humanoid builder`

---

### T9: Procedural clip functions

**What**: `applyClip(rig, clip, phase)` posing joints for idle/move/attack/cast/die.
**Where**: `client/src/scene/creature/clips.ts`
**Depends on**: T2 (clip names), T7, T8
**Reuses**: deterministic-math style (`client/src/scene/terrain.ts`)
**Requirement**: CHAR-03, CHAR-04, CHAR-10

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Each clip mutates joint rotations deterministically by `phase` (no `Math.random`)
- [ ] Unit tests: same `(clip, phase)` → identical transforms (CHAR-04.5); each clip differs from `idle`; joints stay within a sane rotation envelope
- [ ] Quick gate passes: `nx test client`
- [ ] Test count recorded

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add procedural animation clips`

---

### T10: Animator

**What**: `createAnimator(rig)` — runs `stepAnimation`, computes phase, applies clip, returns clip name.
**Where**: `client/src/scene/creature/animator.ts`
**Depends on**: T2, T9
**Reuses**: state-machine output (T2)
**Requirement**: CHAR-09, CHAR-10, CHAR-11(clip name)

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] `update(input, nowMs)` selects + applies correct clip; transient phase from elapsed/duration, looping phase for idle/move
- [ ] Unit tests: attack overrides move then reverts; die latches; returned clip name matches state machine
- [ ] Quick gate passes: `nx test client`
- [ ] Test count recorded

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add rig animator`

---

### T11: Player avatar + renderer integration

**What**: `createPlayerAvatar()` (rig+animator, locomotion + facing) and replace
the inline capsule in `renderer.ts`; drive `update(dt)` in `tick`.
**Where**: `client/src/scene/player-avatar.ts`, `client/src/scene/renderer.ts`
**Depends on**: T8, T10
**Reuses**: `renderer.ts:156` capsule site, `:171 syncLocalPlayer`, `:246 tick`
**Requirement**: CHAR-01, CHAR-03, CHAR-04

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Capsule replaced by avatar group; camera follow unaffected
- [ ] Unit tests for `player-avatar`: locomotion from position delta (>0.02 m hysteresis → move; ≤ → idle); facing yaw from velocity (±5°); target-facing during attack/cast
- [ ] Quick gate passes: `nx test client`
- [ ] Build gate passes: `nx run-many -t build lint test` (schema+wiring touched)
- [ ] Test count recorded

**Tests**: unit · **Gate**: build
**Commit**: `feat(client): replace player capsule with animated humanoid avatar`

---

### T12: Expose current clip in `__GAME_STATE__`

**What**: Add `action: AnimationClip` to `GameStatePlayer`; `setPlayer` stores it.
**Where**: `client/src/test-hook.ts`
**Depends on**: T11
**Reuses**: `test-hook.ts:4 GameStatePlayer`, `:157 setPlayer`
**Requirement**: CHAR-11

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] `__GAME_STATE__.player.action` present, defaults `'idle'`, settable
- [ ] Unit test (`test-hook.spec.ts`) asserts default + update
- [ ] Quick gate passes: `nx test client`
- [ ] Test count recorded

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): expose current animation clip in test hook`

---

### T13: Wire action signal through room sync

**What**: `room.ts syncLocal` passes `action`/`actionSeq` to the avatar and the
resulting clip name to `setPlayer`.
**Where**: `client/src/net/room.ts:248 (syncLocal)`, renderer clip plumbing
**Depends on**: T11, T12, T4, T5, T6
**Reuses**: existing `syncLocal` + `onChange` binding (`room.ts:388`)
**Requirement**: CHAR-09, CHAR-11

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] `syncLocal` reads `player.action`/`actionSeq`, feeds avatar, publishes clip to hook
- [ ] Build gate passes: `nx run-many -t build lint test`
- [ ] Test count recorded

**Tests**: none (integration proven by T14 e2e + unit at T10–T12) · **Gate**: build
**Commit**: `feat(client): drive avatar animation from replicated action signal`

---

### T14: E2E — action transitions via `__GAME_STATE__`

**What**: Playwright spec asserting `idle → move → attack → cast` through the hooks.
**Where**: `client-e2e/src/character-animation.spec.ts`
**Depends on**: T13
**Reuses**: `client-e2e/src/*` patterns (`__sendMoveIntent__`, `__handleMobTarget__`, `__attack__`, `__useSkill__`, `expect.poll`), out-of-peace targeting helper
**Requirement**: CHAR-11

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] e2e: initial `player.action==='idle'`; after move intent → `'move'` then back to `'idle'`; after `__attack__` on an out-of-peace mob → `'attack'`; after `__useSkill__` → `'cast'` (poll within duration window)
- [ ] Full gate passes: Quick + `nx e2e client-e2e`
- [ ] Test count recorded
- [ ] `die` assertion confirmed at room layer (T6), noted as carry-forward if e2e death is flaky

**Tests**: e2e · **Gate**: full
**Commit**: `test(client-e2e): assert player animation transitions`

---

## Parallel Execution Map

```
Phase 1 (Sequential):  T1 → T2
Phase 2 (T3 first, then [P]):  T3 → { T4 [P], T5 [P], T6 [P] }
Phase 3 (Sequential):  T7 → T8 → T9 → T10
Phase 4 (Sequential):  (T8,T10) → T11 → T12 → T13
Phase 5 (Sequential):  T13 → T14
```

`[P]` = order-free within the phase (no inter-task dependency). T4/T5/T6 each only
depend on T3 and touch distinct resolve sites; room tests are parallel-safe
(AD-014). `[P]` is ordering info, not a directive to spawn a sub-agent per task.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 enum + durations | 1 module | ✅ Granular |
| T2 state machine | 1 module | ✅ Granular |
| T3 schema fields | 1 schema + persistence assert | ✅ Granular |
| T4/T5/T6 one resolve site each | 1 site each | ✅ Granular |
| T7 rig contract | 1 module | ✅ Granular |
| T8 builder | 1 module | ✅ Granular |
| T9 clips | 1 module | ✅ Granular |
| T10 animator | 1 module | ✅ Granular |
| T11 avatar + renderer swap | 1 module + 1 integration site | ⚠️ Cohesive (avatar must replace capsule to be testable in renderer) |
| T12 hook field | 1 file | ✅ Granular |
| T13 room wiring | 1 site | ✅ Granular |
| T14 e2e | 1 spec | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| ---- | ----------------- | ------------- | ------ |
| T1 | None | None | ✅ |
| T2 | T1 | T1→T2 | ✅ |
| T3 | T1 | T1→T3 | ✅ |
| T4 | T3 | T3→T4 | ✅ |
| T5 | T3 | T3→T5 | ✅ |
| T6 | T3 | T3→T6 | ✅ |
| T7 | None | (phase start) | ✅ |
| T8 | T7 | T7→T8 | ✅ |
| T9 | T2,T7,T8 | T8→T9 (+T2 cross-phase) | ✅ |
| T10 | T2,T9 | T9→T10 | ✅ |
| T11 | T8,T10 | T8,T10→T11 | ✅ |
| T12 | T11 | T11→T12 | ✅ |
| T13 | T11,T12,T4,T5,T6 | T12→T13 (+Phase-2 deps) | ✅ |
| T14 | T13 | T13→T14 | ✅ |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | game-core pure | unit | unit | ✅ |
| T2 | game-core pure | unit | unit | ✅ |
| T3 | server schema + persistence | integration | integration | ✅ |
| T4 | server room | integration | integration | ✅ |
| T5 | server room | integration | integration | ✅ |
| T6 | server room | integration | integration | ✅ |
| T7 | client geometry | unit | unit | ✅ |
| T8 | client geometry | unit | unit | ✅ |
| T9 | client animation | unit | unit | ✅ |
| T10 | client animation | unit | unit | ✅ |
| T11 | client geometry + integration site | unit | unit | ✅ |
| T12 | client hook | unit | unit | ✅ |
| T13 | client wiring (no new testable logic; covered by T14 e2e) | none | none | ✅ |
| T14 | client behavior | e2e | e2e | ✅ |

**Note on T13:** logic-free plumbing; its behavior is proven by the T14 e2e
(action reaching the running client) — not deferral of a unit-testable layer.

---

## Task Verification Standards

Every task follows `Done when` + `Tests` + `Gate`. Each `Done when` is binary and
names the gate command. Test counts are recorded per task to prevent silent
deletions. After T14, a fresh **Verifier** runs automatically (author ≠ verifier):
spec-anchored outcome check + discrimination sensor, writing `validation.md`.
