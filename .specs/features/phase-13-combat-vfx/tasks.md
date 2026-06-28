# Phase 13 — Combat & World VFX Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** This repo wraps it with
`spec-driven-execution` (Planner → Implementer → Verifier, **autonomous-first**);
honor server-authority (AD-001) and the four test layers (AD-010).

**If the skill cannot be activated, STOP and tell the user — do not proceed
without it.**

---

**Design**: `.specs/features/phase-13-combat-vfx/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `AGENTS.md` (4 test layers + server-authority + 10-second rule),
> `.specs/STATE.md` AD-009/AD-010/AD-014/AD-015/AD-017,
> `.cursor/skills/game-designer/references/create-vfx.md`,
> existing patterns in `client/src/scene/skill-flash.spec.ts`,
> `client/src/net/wire-room.spec.ts`, `client-e2e/src/town.spec.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| VFX lifecycle / pool | unit | CVFX-01–04: spawn, count, pool reuse, tick retire | `client/src/scene/vfx/vfx-lifecycle.spec.ts` | `nx test client` |
| VFX triggers (pure) | unit | CVFX-10–12, CVFX-20–21, CVFX-05: HP/level/action edge detection | `client/src/scene/vfx/vfx-triggers.spec.ts` | `nx test client` |
| Power Strike VFX | unit | CVFX-05–09: spawn, tag, duration, hook increment, no cooldown-only | `client/src/scene/vfx/power-strike-vfx.spec.ts` | `nx test client` |
| Melee hit VFX | unit | CVFX-10–14: mob/player HP, dedupe, pool, duration | `client/src/scene/vfx/melee-hit-vfx.spec.ts` | `nx test client` |
| Death dissolve | unit | CVFX-15–19: mob latch, player die, opacity curve, removal timing | `client/src/scene/vfx/death-dissolve-vfx.spec.ts` | `nx test client` |
| Level-up VFX | unit | CVFX-20–23: level edge, no false positive, duration, hook | `client/src/scene/vfx/level-up-vfx.spec.ts` | `nx test client` |
| Target ring | unit | CVFX-24–28: show/hide/follow/dead mob/hook flag | `client/src/scene/vfx/target-ring-vfx.spec.ts` | `nx test client` |
| VFX manager + wiring | unit | CVFX-29–31: room/renderer integration, activeEffectCount | `client/src/scene/vfx/vfx-manager.spec.ts`, `client/src/net/wire-room.spec.ts` | `nx test client` |
| Combat VFX e2e | e2e | CVFX-32: meleeHitCount + targetRingVisible during combat | `client-e2e/src/town.spec.ts` (or `combat-vfx.spec.ts`) | `nx e2e client-e2e` |
| VFX visual gate | none (visual gate) | CVFX-33–35: mid-effect PNG review | `client/vfx-lab.html`, `scripts/shoot-vfx.mjs` | `node scripts/shoot-vfx.mjs` |
| Soulshot glint (P3) | unit | CVFX-36–37 | `client/src/scene/vfx/soulshot-glint-vfx.spec.ts` | `nx test client` |
| Loot puff (P3) | unit | CVFX-38–39 | `client/src/scene/vfx/loot-puff-vfx.spec.ts` | `nx test client` |
| Server combat | none | Regression only — no schema change | `server/src/rooms/TownRoom.spec.ts` | `nx test server` |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`client`) | Yes | Per-test `THREE.Scene`; fake timers; no shared manager singleton | `skill-flash.spec.ts` pattern |
| Room integration (`server`) | Yes | `NJ_AUTOSIM=0` + per-test room (AD-014) | `TownRoom.spec.ts` |
| E2E (`client-e2e`) | Yes | Per-test `?room=` instanceKey (AD-014) | `playwright.config.ts` |

## Gate Check Commands

> Generated from codebase (AD-010) — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (client) | After T1–T12, T16–T17 | `nx test client` |
| Quick (server) | After T18 | `nx test server` |
| Full | After T14 | `nx affected -t test lint` + `nx e2e client-e2e` |
| Build | Phase completion (T18) | `nx run-many -t build lint test` |
| Visual | After T15 (before Verifier) | `LAB_VFX=all node scripts/shoot-vfx.mjs` |

---

## Execution Plan

**6 phases** (18 tasks; T16–T17 optional P3).

### Phase 1: Foundation — Sequential

```
T1 → T2 → T3
```

### Phase 2: Effect modules — Parallel

```
T1 ──┬→ T4 [P] Power Strike
     ├→ T5 [P] Melee hit
     ├→ T6 [P] Death dissolve
     ├→ T7 [P] Level-up
     └→ T8 [P] Target ring
```

### Phase 3: Integration — Sequential

```
T3,T4–T8 → T9 → T10 → T11 → T12
```

### Phase 4: Visual gate — Sequential

```
T12 → T13 → T15
```

### Phase 5: E2E — Sequential

```
T11 → T14
```

### Phase 6: Optional + final gate — Sequential

```
T14,T15 ──→ T16 [P] Soulshot
         ──→ T17 [P] Loot puff
         ──→ T18
```

> 6 phases → Execute **offers one sub-agent per phase** (sequential), then a
> fresh Verifier after T18.

---

## Task Breakdown

### T1: VFX lifecycle utilities

**What**: Shared `countTaggedVfx`, `disposeObject3D`, generic pool, `tickActive` helper.
**Where**: `client/src/scene/vfx/vfx-lifecycle.ts`
**Depends on**: None
**Reuses**: `skill-flash.ts` tag-count pattern
**Requirement**: CVFX-01–04

**Tools**: MCP: NONE · Skill: `game-designer` → `create-vfx.md`

**Done when**:
- [ ] Pool reuses slots when at capacity
- [ ] Dispose removes geometry/materials
- [ ] Unit tests: spawn → tick → count 0
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add VFX lifecycle utilities and pool`

---

### T2: Pure VFX trigger detectors

**What**: `detectHpHit`, `detectLevelUp`, `detectActionEdge` (prev/next snapshots).
**Where**: `client/src/scene/vfx/vfx-triggers.ts`
**Depends on**: T1
**Reuses**: `EntityAction` from `@nj/game-core`
**Requirement**: CVFX-10–12, CVFX-20–21, CVFX-05

**Done when**:
- [ ] HP `[41,24,24]` → one hit; `[41,0]` → one hit (kill tick)
- [ ] Level `1→2` true; `2→2` false
- [ ] Cast seq bump detected; same seq ignored
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add pure VFX event trigger detectors`

---

### T3: VFX manager core

**What**: `createVfxManager` with prev-state maps, `tick`, `dispose`, hook snapshot.
**Where**: `client/src/scene/vfx/vfx-manager.ts`
**Depends on**: T2
**Reuses**: T1 lifecycle
**Requirement**: CVFX-29–31 (partial)

**Done when**:
- [ ] Manager tracks per-mob HP and player level/hp/action
- [ ] `getHookSnapshot()` returns zeroed counters initially
- [ ] Unit test: mock syncs without modules wired (no throw)
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add VFX manager state tracking`

---

### T4: Power Strike VFX [P]

**What**: Procedural arc slash + impact burst; **800** ms duration; `powerStrike` tag.
**Where**: `client/src/scene/vfx/power-strike-vfx.ts`
**Depends on**: T1
**Reuses**: `createSkillFlash` geometry math
**Requirement**: CVFX-05–09

**Done when**:
- [ ] Replaces `skill-flash` visual; no `skillFlash` tag
- [ ] Spawn + dispose tests pass (fake timers)
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add Power Strike VFX module`

---

### T5: Melee hit VFX (pooled) [P]

**What**: Pooled torso burst; **250** ms; pool size **8**.
**Where**: `client/src/scene/vfx/melee-hit-vfx.ts`
**Depends on**: T1
**Requirement**: CVFX-10–14

**Done when**:
- [ ] Ninth spawn reuses pool slot
- [ ] Spawn/cleanup unit tests green
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add pooled melee hit VFX`

---

### T6: Death dissolve VFX [P]

**What**: Opacity fade 1→0 over **1200** ms; `attachDeathDissolve(root)`.
**Where**: `client/src/scene/vfx/death-dissolve-vfx.ts`
**Depends on**: T1
**Requirement**: CVFX-15–19

**Done when**:
- [ ] Opacity ~0.5 at 600 ms (±0.1)
- [ ] `restoreOpacity` on player respawn path tested
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add death dissolve VFX controller`

---

### T7: Level-up burst VFX [P]

**What**: Gold upward particles; **1000** ms.
**Where**: `client/src/scene/vfx/level-up-vfx.ts`
**Depends on**: T1
**Requirement**: CVFX-20–23

**Done when**:
- [ ] Spawn/cleanup tests pass
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add level-up burst VFX`

---

### T8: Target selection ring [P]

**What**: Persistent ground ring; show/hide/follow API.
**Where**: `client/src/scene/vfx/target-ring-vfx.ts`
**Depends on**: T1
**Requirement**: CVFX-24–28

**Done when**:
- [ ] Ring follows position updates
- [ ] `hide()` sets hook flag false via manager integration test stub
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add target selection ring VFX`

---

### T9: Wire effect modules into manager

**What**: Manager calls T4–T8 on trigger intents; increments hook counters.
**Where**: `client/src/scene/vfx/vfx-manager.ts` (modify)
**Depends on**: T3, T4, T5, T6, T7, T8
**Requirement**: CVFX-05–28, CVFX-29–31

**Done when**:
- [ ] Integration unit test: HP drop → melee hit count +1
- [ ] Cast seq → powerStrikeCount +1
- [ ] Level bump → levelUpCount +1
- [ ] `activeEffectCount` tracks live tags
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): wire VFX modules into manager`

---

### T10: Renderer integration

**What**: Create manager in `renderer.ts`; `tick` calls `vfxManager.tick`; dissolve on
mob `removeMob` / player die; delete `triggerSkillFlash` + `skill-flash.ts`.
**Where**: `client/src/scene/renderer.ts`, remove `client/src/scene/skill-flash.ts`
**Depends on**: T9, T6
**Reuses**: `removeMob` die latch
**Requirement**: CVFX-15–18, CVFX-29–30

**Done when**:
- [ ] `skill-flash.ts` removed; no imports remain
- [ ] Renderer unit/smoke test: manager tick invoked
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): integrate VFX manager into renderer`

---

### T11: Room wiring + test hook

**What**: `room.ts` forwards mob HP/action + player level/hp/action to manager;
remove cooldown-only flash; extend `test-hook.ts` with `vfx` counters.
**Where**: `client/src/net/room.ts`, `client/src/test-hook.ts`
**Depends on**: T9
**Reuses**: `syncMobFromState`, `syncLocal`
**Requirement**: CVFX-08–09, CVFX-29–31

**Done when**:
- [ ] `wire-room.spec.ts` covers HP delta → manager call (spy)
- [ ] `GameStateVfx` typed on hook
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): wire room state to VFX manager and test hook`

---

### T12: Target ring + setTargetMobId wiring

**What**: Manager `setTargetMobId` from `combat-input.ts` / hook; ring follow each tick.
**Where**: `client/src/combat-input.ts`, `client/src/scene/renderer.ts`
**Depends on**: T10, T11, T8
**Requirement**: CVFX-24–28

**Done when**:
- [ ] Target mob → `targetRingVisible` true in hook
- [ ] Clear target → false
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): wire target ring to targetMobId`

---

### T13: VFX lab harness

**What**: `vfx-lab.html` + `vfx-lab.ts` freeze each effect at `t` query param.
**Where**: `client/vfx-lab.html`, `client/src/vfx-lab.ts`, `client/vite.config.ts` (entry if needed)
**Depends on**: T4–T8
**Reuses**: `character-lab.ts` camera/ground
**Requirement**: CVFX-33

**Done when**:
- [ ] `?effect=power-strike&t=0.4` sets `__SHOT_READY__`
- [ ] Build includes lab page
- [ ] Quick gate: `nx test client` + `nx build client`

**Tests**: none (visual gate) · **Gate**: quick
**Commit**: `feat(client): add VFX lab for visual gate`

---

### T14: E2E combat VFX observability

**What**: Playwright test: target Gremlin, attack, poll `meleeHitCount >= 1` and
`targetRingVisible` was true.
**Where**: `client-e2e/src/combat-vfx.spec.ts` (or extend `town.spec.ts`)
**Depends on**: T11, T12
**Reuses**: `gotoGame`, mob chase pattern (AD-014)
**Requirement**: CVFX-32

**Done when**:
- [ ] E2e passes with `fullyParallel` room isolation
- [ ] Full gate: `nx e2e client-e2e`

**Tests**: e2e · **Gate**: full
**Commit**: `test(e2e): assert combat VFX test-hook counters`

---

### T15: Visual gate capture script

**What**: `scripts/shoot-vfx.mjs` captures 5 core effects mid-animation.
**Where**: `scripts/shoot-vfx.mjs`
**Depends on**: T13
**Requirement**: CVFX-33–35

**Done when**:
- [ ] PNGs written to `LAB_OUT` for power-strike, melee-hit, death-dissolve, level-up, target-ring
- [ ] Human review note ready for Verifier
- [ ] Visual command documented in tasks gate table

**Tests**: none (visual gate) · **Gate**: visual
**Commit**: `chore(scripts): add shoot-vfx visual gate harness`

---

### T16: Soulshot glint (optional P3) [P]

**What**: Weapon emissive pulse when `items[1835] > 0` + attack/cast seq bump.
**Where**: `client/src/scene/vfx/soulshot-glint-vfx.ts`, manager hook
**Depends on**: T11
**Requirement**: CVFX-36–37

**Done when**:
- [ ] Unit tests: with/without soulshot stack
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add optional soulshot glint VFX`

---

### T17: Loot puff at death (optional P3) [P]

**What**: Ground sparkle on mob `die` action seq bump.
**Where**: `client/src/scene/vfx/loot-puff-vfx.ts`, manager hook
**Depends on**: T11
**Requirement**: CVFX-38–39

**Done when**:
- [ ] Unit test: die seq → spawn → cleanup
- [ ] Quick gate: `nx test client`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add optional loot puff VFX at mob death`

---

### T18: Full regression gate

**What**: Run full monorepo gate; fix any regressions; confirm server unchanged.
**Where**: (verification only)
**Depends on**: T14, T15 (T16–T17 optional)
**Requirement**: all P1 CVFX-01–35

**Done when**:
- [ ] `nx run-many -t build lint test` green
- [ ] `nx e2e client-e2e` green
- [ ] `nx test server` green (no unintended server diff)
- [ ] Test counts documented in commit message body

**Tests**: e2e + unit · **Gate**: build
**Commit**: `chore(phase-13): combat VFX gate green`

---

## Parallel Execution Map

```
Phase 1:  T1 ──→ T2 ──→ T3

Phase 2:  T1 complete, then:
            ├── T4 [P]
            ├── T5 [P]
            ├── T6 [P]
            ├── T7 [P]
            └── T8 [P]

Phase 3:  T3,T4–T8 ──→ T9 ──→ T10 ──→ T11 ──→ T12

Phase 4:  T12 ──→ T13 ──→ T15

Phase 5:  T11 ──→ T14

Phase 6:  T14,T15 ──→ T16 [P] ──┐
                      T17 [P] ──┼──→ T18
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: lifecycle utils | 1 module | ✅ Granular |
| T2: trigger detectors | 1 module | ✅ Granular |
| T3: manager core | 1 module | ✅ Granular |
| T4–T8: individual VFX | 1 effect each | ✅ Granular |
| T9: manager wiring | 1 integration file | ✅ Granular |
| T10: renderer | 1–2 files | ✅ Granular |
| T11: room + hook | 2 files | ✅ Granular |
| T12: target ring wire | 2 files | ✅ Granular |
| T13: vfx lab | 2 files | ✅ Granular |
| T14: e2e | 1 spec file | ✅ Granular |
| T15: shoot script | 1 script | ✅ Granular |
| T16–T17: optional FX | 1 module each | ✅ Granular |
| T18: gate | verification | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Phase 1 start | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T1 | T1 → T4 parallel | ✅ Match |
| T5 | T1 | T1 → T5 parallel | ✅ Match |
| T6 | T1 | T1 → T6 parallel | ✅ Match |
| T7 | T1 | T1 → T7 parallel | ✅ Match |
| T8 | T1 | T1 → T8 parallel | ✅ Match |
| T9 | T3, T4–T8 | Phase 3 entry | ✅ Match |
| T10 | T9, T6 | T9 → T10 | ✅ Match |
| T11 | T9 | T9 → T11 | ✅ Match |
| T12 | T10, T11, T8 | T10,T11 → T12 | ✅ Match |
| T13 | T4–T8 | Phase 4 (after T12) | ✅ Match |
| T14 | T11, T12 | Phase 5 | ✅ Match |
| T15 | T13 | T13 → T15 | ✅ Match |
| T16 | T11 | Phase 6 optional | ✅ Match |
| T17 | T11 | Phase 6 optional | ✅ Match |
| T18 | T14, T15 | Phase 6 final | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| ---- | ---------- | --------------- | --------- | ------ |
| T1 | VFX lifecycle | unit | unit | ✅ OK |
| T2 | VFX triggers | unit | unit | ✅ OK |
| T3 | VFX manager | unit | unit | ✅ OK |
| T4 | Power Strike | unit | unit | ✅ OK |
| T5 | Melee hit | unit | unit | ✅ OK |
| T6 | Death dissolve | unit | unit | ✅ OK |
| T7 | Level-up | unit | unit | ✅ OK |
| T8 | Target ring | unit | unit | ✅ OK |
| T9 | Manager integration | unit | unit | ✅ OK |
| T10 | Renderer | unit | unit | ✅ OK |
| T11 | Room + hook | unit | unit | ✅ OK |
| T12 | Target wire | unit | unit | ✅ OK |
| T13 | VFX lab | none | none | ✅ OK |
| T14 | E2E | e2e | e2e | ✅ OK |
| T15 | Visual gate | none | none | ✅ OK |
| T16 | Soulshot P3 | unit | unit | ✅ OK |
| T17 | Loot puff P3 | unit | unit | ✅ OK |
| T18 | Full gate | e2e+unit | e2e+unit | ✅ OK |

---

## Requirement → Task Mapping

| Requirement | Task(s) |
| ----------- | ------- |
| CVFX-01–04 | T1 |
| CVFX-05 (partial) | T2, T4, T9 |
| CVFX-06–09 | T4, T9, T11 |
| CVFX-10–14 | T2, T5, T9 |
| CVFX-15–19 | T6, T9, T10 |
| CVFX-20–23 | T2, T7, T9, T11 |
| CVFX-24–28 | T8, T9, T12 |
| CVFX-29–31 | T3, T9, T10, T11 |
| CVFX-32 | T14 |
| CVFX-33–35 | T13, T15 |
| CVFX-36–37 | T16 |
| CVFX-38–39 | T17 |

**Coverage:** 39 requirements → 18 tasks; 0 unmapped ✅
