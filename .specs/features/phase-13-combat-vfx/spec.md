# Phase 13 — Combat & World VFX Specification

## Problem Statement

Combat is server-authoritative and rigged mobs animate correctly (Phases 4–5, 10),
but feedback is still placeholder primitives: `skill-flash.ts` is a yellow sphere +
flat plane, there is no hit spark on damage, death is only the skeletal `die` clip
with no dissolve, level-ups change HUD numbers silently, and the selected mob has no
ground indicator. Players cannot *read* fights clearly — the ROADMAP vertical-slice
promise for Phase 13.

This phase adds **transient client VFX** anchored to **authoritative server signals**
(AD-015, `create-vfx.md`). No gameplay logic moves to the client (AD-001).

## Goals

- [ ] Replace `skill-flash.ts` with a readable **Power Strike** effect (skill id **3**).
- [ ] **Melee hit / impact** burst when server-applied damage reduces target HP.
- [ ] **Death dissolve** (opacity fade / slight sink) layered on the existing `die`
      clip window (`ACTION_DURATION_MS[Die]` = **1200** ms).
- [ ] **Level-up** burst when `player.level` increases in replicated state.
- [ ] **Target selection** ring under the focused mob (`targetMobId`).
- [ ] Extend `__GAME_STATE__` with VFX observability for Playwright (AD-009).
- [ ] Mandatory **visual gate** (AD-017): each core effect captured mid-animation
      and reviewed.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Server combat / XP / drop rule changes | AD-001; render-only client phase |
| New `DropState` schema or ground-loot pickup loop | No replicated drop entity; full pickup deferred |
| Skill icons / hotbar art | Phase 14 |
| Hit-time cast bar (L2J `hitTime` 1080 ms for Power Strike) | Instant server resolve (Phase 5) |
| Particle textures from proprietary L2 assets | AD-004 |
| Mob flinch / hit-react `action` on server | Not replicated today; hit VFX uses HP delta |
| Player damage flash when mobs hit player | ROADMAP lists mob-target impacts implicitly via melee hit; player-hit optional stretch only if T8 wiring covers `player.hp` delta |
| Environment prop art | Phase 15 |
| WebGL pixel assertions in tests | AD-009 — hook + unit spawn/cleanup only |

---

## Assumptions & Open Questions

The Planner cannot talk to the user; every ambiguity is resolved here.

| Assumption / decision | Chosen default | Rationale |
| --------------------- | -------------- | --------- |
| VFX module layout | `client/src/scene/vfx/` — one file per effect + shared `vfx-lifecycle.ts` | `create-vfx.md` Step 2 |
| Visual style | Procedural low-poly: `THREE.Points`, additive quads, scaling meshes; flat-shaded palette matching world | AD-017 world uses stylized meshes; VFX need no GLB |
| Power Strike trigger | Local `player.action` becomes **`cast`** on **`actionSeq` bump** (replace cooldown `0→>0` proxy) | AD-015 render-only signal; `TownRoom` emits `EntityAction.Cast` on successful cast |
| Power Strike anchor | Arc from player position → targeted mob position (same geometry as current flash) | Readable skill read; L2 physical single-target |
| Power Strike duration | **800** ms (`ACTION_DURATION_MS[Cast]`) | Matches cast clip length (`game-core`) |
| Melee hit trigger (mob) | Target mob replicated **`hp` decreases** while `hp > 0` (compare previous snapshot per mob id) | Authoritative damage (`create-vfx.md`); works for basic attack and Power Strike |
| Melee hit trigger (player) | Local `player.hp` decreases while `hp > 0` | Mob melee damage is server truth on `PlayerState.hp` |
| Hit VFX position | Victim feet + **0.9** m (torso height) | Consistent with HP bar offset |
| Hit VFX duration | **250** ms; **pooled** (max **8** concurrent) | Frequent event; `create-vfx.md` pooling |
| Death dissolve trigger | Mob: existing `die` latch (`removeMob` / `action === Die`); Player: `player.action === die` + `actionSeq` bump | Layer on Phase 10/8 die timing, do not change removal delay |
| Death dissolve effect | Material opacity **1 → 0** over **1200** ms; optional **0.15** m Y sink | Readable fade; runs parallel to die clip |
| Level-up trigger | `player.level` **strictly increases** in `syncLocal` | Server grants XP in `handleMobKill` / `applyKillRewards` |
| Level-up anchor | Local player position; burst radius ~**1.5** m | Celebratory, non-blocking |
| Level-up duration | **1000** ms | One-shot, longer than hit spark |
| Target ring trigger | `__GAME_STATE__.targetMobId` set and mob still in `room.state.mobs` | Client-local selection allowed (`create-vfx.md`) |
| Target ring appearance | Flat **ring** (torus or circle line) on ground at mob feet, emissive **gold** `#ffcc44`, opacity **0.85** | Classic target-indicator read |
| Target ring follow | Re-sync position each renderer tick from mob snapshot | Mobs wander |
| Target ring hide | `targetMobId` null, mob removed, or mob `hp <= 0` | No ring on corpse |
| Deprecate `skill-flash.ts` | Replaced by `power-strike-vfx.ts`; re-export or delete after migration | Avoid duplicate APIs |
| Test hook shape | `vfx: { powerStrikeCount, meleeHitCount, levelUpCount, targetRingVisible, activeEffectCount }` | AD-009; monotonic counters for e2e |
| Server tests | Regression gate only — **no schema changes** | Pure client VFX |
| Visual gate harness | `client/vfx-lab.html?effect=<name>&t=<phase>` + `scripts/shoot-vfx.mjs` (`LAB_VFX`, `LAB_OUT`) | Mirrors `character-lab` / `shoot-character.mjs` |
| Power Strike L1 anchors (unchanged gameplay) | `power=30`, `mpConsume=9`, `reuseDelay=3000`, `castRange=40` (4 m world) | Phase 5 seed + L2J skill id 3 |
| Optional soulshot glint (P3) | When `items[1835] > 0` and local `player.action` is `attack` or `cast` on **`actionSeq` bump**, brief weapon emissive pulse | Cosmetic only; soulshot consumption not implemented |
| Optional loot puff (P3) | Brief ground sparkle at mob **death position** when mob `action` becomes `die` | No `DropState`; visual "loot landed" hint until pickup phase |

**Open questions:** none — all resolved or logged above.

**Implicit-requirement dimensions (Large feature):**

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | VFX ignored when positions NaN; pool caps prevent unbounded meshes |
| Failure / partial-failure | Missing mob for target ring → hide ring; missing avatar on death → dissolve capsule/mesh group |
| Idempotency / retry | `actionSeq` / HP delta handlers fire once per event (dedupe by last-seen seq / hp) |
| Auth boundaries | N/A — cosmetic client |
| Concurrency / ordering | VFX manager tick is single-threaded on main renderer loop |
| Data lifecycle | All effects self-dispose; `activeEffectCount` returns to 0 |
| Observability | `__GAME_STATE__.vfx` counters |
| External-dependency failure | N/A |
| State-transition integrity | Triggers only on valid server deltas |

---

## User Stories

### P1: VFX lifecycle foundation ⭐ MVP

**User Story**: As a developer, I want shared spawn/tick/dispose utilities so every
effect cleans up and frequent hits can be pooled.

**Why P1**: Without disposal and pooling, combat leaks GPU memory within minutes.

**Acceptance Criteria**:

1. WHEN a one-shot VFX completes its duration THEN it SHALL be removed from the scene
   and its geometry and materials SHALL be disposed. **Test layer: unit**
2. WHEN `countTaggedVfx(scene, tag)` is called THEN it SHALL return the number of
   scene objects with that `userData.vfxTag`. **Test layer: unit**
3. WHEN the melee-hit pool is exhausted (8 active) THEN the next spawn SHALL reuse
   the oldest idle slot instead of allocating new GPU resources. **Test layer: unit**
4. WHEN `tickVfx(dt, nowMs)` runs THEN all active effects SHALL advance and retire
   expired instances. **Test layer: unit**

**Independent Test**: Vitest spawns a stub effect, advances fake timers, asserts
count returns to 0.

---

### P1: Power Strike VFX ⭐ MVP

**User Story**: As a player, I want Power Strike to read as a deliberate weapon
strike, not a placeholder blob.

**Why P1**: ROADMAP headline effect; skill id 3 is the only MVP skill.

**Acceptance Criteria**:

1. WHEN local `player.action` transitions to **`cast`** on an **`actionSeq` bump**
   THEN `spawnPowerStrikeVfx` SHALL add a tagged effect group to the scene anchored
   between player and `targetMobId` mob. **Test layer: unit**
2. WHEN the Power Strike effect plays THEN it SHALL **not** use the legacy
   `skillFlash` userData tag (replaced by `powerStrike` tag). **Test layer: unit**
3. WHEN **800** ms elapses after spawn THEN the Power Strike effect SHALL be fully
   removed and disposed. **Test layer: unit**
4. WHEN Power Strike VFX spawns THEN `__GAME_STATE__.vfx.powerStrikeCount` SHALL
   increment by **1**. **Test layer: unit**
5. WHEN `room.ts` `syncLocal` runs THEN it SHALL **not** trigger Power Strike VFX
   solely from `powerStrikeCooldownEndMs` `0→>0` (action signal is canonical).
   **Test layer: unit**

**Independent Test**: Mock cast actionSeq transition → effect count 1 → timers → 0.

---

### P1: Melee hit / impact VFX ⭐ MVP

**User Story**: As a player, I want to see when my attacks and mob attacks actually
land damage.

**Why P1**: Without hit feedback, HP bar changes are easy to miss.

**Acceptance Criteria**:

1. WHEN a tracked mob's replicated `hp` **decreases** and remains **> 0** THEN a
   melee-hit burst SHALL spawn at the mob's position. **Test layer: unit**
2. WHEN local `player.hp` **decreases** and remains **> 0** THEN a melee-hit burst
   SHALL spawn at the player position. **Test layer: unit**
3. WHEN the same `hp` value is synced twice THEN only **one** hit VFX SHALL fire.
   **Test layer: unit**
4. WHEN a melee-hit VFX completes (**250** ms) THEN it SHALL be removed and
   `activeEffectCount` SHALL decrease. **Test layer: unit**
5. WHEN damage kills the target (`hp` → 0) in the same sync THEN a hit spark MAY
   fire before death dissolve (both allowed). **Test layer: unit**

**Independent Test**: Feed HP sequence `[41, 24, 24]` → exactly one hit spawn.

---

### P1: Death dissolve VFX ⭐ MVP

**User Story**: As a player, I want slain mobs (and my character on death) to fade
out rather than pop away.

**Why P1**: ROADMAP; complements existing `die` clip latch (Phase 10).

**Acceptance Criteria**:

1. WHEN a mob enters the die latch (`removeMob` or replicated `action === Die`)
   THEN a dissolve controller SHALL attach to the mob's render root and fade opacity
   from **1.0** to **0.0** over **1200** ms. **Test layer: unit**
2. WHEN local `player.action` becomes **`die`** on **`actionSeq` bump** THEN the
   player avatar SHALL receive the same dissolve treatment. **Test layer: unit**
3. WHEN dissolve completes THEN materials SHALL restore default opacity **1.0** if the
   mesh is reused (player respawn). **Test layer: unit**
4. WHEN dissolve runs THEN the existing **1200** ms delayed mob removal SHALL still
   apply (no change to `removeMob` timing). **Test layer: unit** (regression)
5. WHEN dissolve is active at **t = 600** ms THEN opacity SHALL be approximately
   **0.5** (±0.1). **Test layer: unit**

**Independent Test**: Latch die on mock mob instance; sample opacity at half duration.

---

### P1: Level-up burst VFX ⭐ MVP

**User Story**: As a player, I want leveling up to feel rewarding in the world, not
only in the HUD.

**Why P1**: ROADMAP; `handleMobKill` already levels via `applyKillRewards`.

**Acceptance Criteria**:

1. WHEN `player.level` increases in `syncLocal` THEN a level-up burst SHALL spawn at
   the player's world position. **Test layer: unit**
2. WHEN level does not change between syncs THEN no level-up burst SHALL spawn.
   **Test layer: unit**
3. WHEN a level-up burst completes (**1000** ms) THEN it SHALL be removed and
   disposed. **Test layer: unit**
4. WHEN level-up VFX spawns THEN `__GAME_STATE__.vfx.levelUpCount` SHALL increment.
   **Test layer: unit**

**Independent Test**: `setPlayer` level 1 → 2 triggers exactly one burst.

---

### P1: Target selection ring ⭐ MVP

**User Story**: As a player, I want to see which mob I am targeting.

**Why P1**: ROADMAP; `targetMobId` exists but has no world visualization.

**Acceptance Criteria**:

1. WHEN `targetMobId` is set to a mob id present in snapshots THEN a ground ring
   SHALL be visible at that mob's feet. **Test layer: unit**
2. WHEN `targetMobId` is cleared THEN the ring SHALL be hidden (not destroyed —
   reused). **Test layer: unit**
3. WHEN the targeted mob moves THEN the ring SHALL follow each tick. **Test layer: unit**
4. WHEN the targeted mob is removed or `hp <= 0` THEN the ring SHALL hide.
   **Test layer: unit**
5. WHEN the ring is visible THEN `__GAME_STATE__.vfx.targetRingVisible` SHALL be
   **true**. **Test layer: unit**

**Independent Test**: Set target → ring position matches mob; clear → hidden.

---

### P1: Wiring + test hook ⭐ MVP

**User Story**: As a tester, I want deterministic observability of VFX without
reading WebGL pixels.

**Why P1**: AD-009; e2e combat already uses `__GAME_STATE__`.

**Acceptance Criteria**:

1. WHEN `wireRoom` processes mob `onChange` THEN HP deltas SHALL be forwarded to the
   VFX manager. **Test layer: unit**
2. WHEN `renderer.tick` runs THEN `tickVfx` and target-ring follow SHALL run.
   **Test layer: unit**
3. WHEN any core VFX spawns THEN `__GAME_STATE__.vfx.activeEffectCount` SHALL
   reflect live tagged meshes. **Test layer: unit**
4. WHEN a player kills a Gremlin with melee in e2e THEN `meleeHitCount` SHALL be
   **≥ 1** and `targetRingVisible` SHALL have been **true** during targeting.
   **Test layer: e2e**

**Independent Test**: `wire-room.spec.ts` HP delta mock + Playwright combat poll.

---

### P1: Visual gate ⭐ MVP

**User Story**: As a reviewer, I want mid-effect screenshots of every core VFX before
the phase is marked done.

**Why P1**: AD-017 mandatory visual gate.

**Acceptance Criteria**:

1. WHEN `vfx-lab.html?effect=power-strike&t=0.4` loads THEN `__SHOT_READY__` SHALL
   be true and a Power Strike pose is frozen mid-effect. **Test layer: visual gate**
2. WHEN `shoot-vfx.mjs` runs THEN it SHALL capture **power-strike**, **melee-hit**,
   **death-dissolve**, **level-up**, and **target-ring** PNGs under `LAB_OUT`.
   **Test layer: visual gate**
3. WHEN PNGs are reviewed THEN each effect SHALL be readable at 720×720 (human
   approval recorded in validation). **Test layer: visual gate**

**Independent Test**: `node scripts/shoot-vfx.mjs` produces 5+ PNGs.

---

### P3: Soulshot glint (optional)

**User Story**: As a player with Soulshots in inventory, I want a brief weapon glint
when I attack.

**Why P3**: ROADMAP optional; item **1835** exists in shop/starter economy.

**Acceptance Criteria**:

1. WHEN `items[1835] > 0` and `player.action` becomes `attack` or `cast` on seq bump
   THEN a weapon glint SHALL flash on the player weapon prop. **Test layer: unit**
2. WHEN soulshots are absent THEN no glint SHALL spawn. **Test layer: unit**

**Independent Test**: Mock inventory + attack seq → glint count 1.

---

### P3: Loot puff at death (optional)

**User Story**: As a player, I want a hint that loot appeared where a mob died.

**Why P3**: ROADMAP optional; full ground loot deferred.

**Acceptance Criteria**:

1. WHEN a mob's replicated `action` becomes **`die`** THEN a brief ground sparkle
   SHALL spawn at the mob's last position. **Test layer: unit**
2. WHEN sparkle completes (**800** ms) THEN it SHALL dispose. **Test layer: unit**

**Independent Test**: Die action on mob → tagged sparkle → timer cleanup.

---

## Edge Cases

- WHEN `targetMobId` points to a despawned mob THEN the ring SHALL hide and no Power
  Strike arc SHALL spawn without a valid target position.
- WHEN multiple HP decreases occur same tick on different mobs THEN each SHALL get
  its own pooled hit spark.
- WHEN player levels up multiple times in one kill (future) THEN one burst per level
  step SHALL fire (level 1→3 triggers **2** bursts).
- WHEN WebGL context is lost / scene torn down THEN `disposeAllVfx` SHALL remove
  leftovers (renderer `dispose` hook).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| CVFX-01 | P1: Lifecycle | Design | Pending |
| CVFX-02 | P1: Lifecycle | Design | Pending |
| CVFX-03 | P1: Lifecycle | Design | Pending |
| CVFX-04 | P1: Lifecycle | Design | Pending |
| CVFX-05 | P1: Power Strike | Design | Pending |
| CVFX-06 | P1: Power Strike | Design | Pending |
| CVFX-07 | P1: Power Strike | Design | Pending |
| CVFX-08 | P1: Power Strike | Design | Pending |
| CVFX-09 | P1: Power Strike | Design | Pending |
| CVFX-10 | P1: Melee hit | Design | Pending |
| CVFX-11 | P1: Melee hit | Design | Pending |
| CVFX-12 | P1: Melee hit | Design | Pending |
| CVFX-13 | P1: Melee hit | Design | Pending |
| CVFX-14 | P1: Melee hit | Design | Pending |
| CVFX-15 | P1: Death dissolve | Design | Pending |
| CVFX-16 | P1: Death dissolve | Design | Pending |
| CVFX-17 | P1: Death dissolve | Design | Pending |
| CVFX-18 | P1: Death dissolve | Design | Pending |
| CVFX-19 | P1: Death dissolve | Design | Pending |
| CVFX-20 | P1: Level-up | Design | Pending |
| CVFX-21 | P1: Level-up | Design | Pending |
| CVFX-22 | P1: Level-up | Design | Pending |
| CVFX-23 | P1: Level-up | Design | Pending |
| CVFX-24 | P1: Target ring | Design | Pending |
| CVFX-25 | P1: Target ring | Design | Pending |
| CVFX-26 | P1: Target ring | Design | Pending |
| CVFX-27 | P1: Target ring | Design | Pending |
| CVFX-28 | P1: Target ring | Design | Pending |
| CVFX-29 | P1: Wiring | Design | Pending |
| CVFX-30 | P1: Wiring | Design | Pending |
| CVFX-31 | P1: Wiring | Design | Pending |
| CVFX-32 | P1: Wiring | Design | Pending |
| CVFX-33 | P1: Visual gate | Design | Pending |
| CVFX-34 | P1: Visual gate | Design | Pending |
| CVFX-35 | P1: Visual gate | Design | Pending |
| CVFX-36 | P3: Soulshot | - | Pending |
| CVFX-37 | P3: Soulshot | - | Pending |
| CVFX-38 | P3: Loot puff | - | Pending |
| CVFX-39 | P3: Loot puff | - | Pending |

**Coverage:** 39 total, 0 mapped to tasks, 39 unmapped ⚠️ (tasks.md will map)

---

## Success Criteria

- [ ] Combat in the field is readable: target ring, hit sparks, Power Strike arc,
      death fade, and level-up burst all visible without checking HUD numbers.
- [ ] All P1 acceptance criteria have unit or e2e tests; visual gate PNGs reviewed.
- [ ] `nx run-many -t build lint test` and `nx e2e client-e2e` green; no server
      gameplay regressions.
- [ ] `skill-flash.ts` placeholder removed or fully superseded.
