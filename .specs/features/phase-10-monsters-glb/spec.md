# Phase 10 — Monsters: Rigged GLB Mobs + Clone-per-Instance Specification

## Problem Statement

Mobs still render as identical brown capsules (`client/src/scene/mobs.ts`) while the
local player uses a rigged GLB with skeletal animation (Phase 8, AD-017). Combat,
spawning, and AI are server-authoritative and working (Phase 4); only the client
visual layer is placeholder. This phase replaces capsules with **distinct rigged
creatures** for the four seeded mob types, driven by the existing `game-core`
animation state machine and a **server-replicated render-only action signal**
(AD-015), using **load-once / clone-per-instance** so many spawns stay cheap.

## Goals

- [ ] Replace mob capsules with rigged GLB meshes for npcIds **20001, 20003, 20120,
      20481** (Gremlin, Goblin, Wolf, Bearded Keltir).
- [ ] Load each mob GLB **once**; spawn independent skinned instances via
      `SkeletonUtils.clone` with per-instance `AnimationMixer` + `AnimState`.
- [ ] Drive `idle`, `move`, `attack`, `die` from server state: locomotion derived
      client-side from position deltas; `action`/`actionSeq` replicated on
      `MobState` for attack/death (AD-015).
- [ ] Keep floating HP bars; per-creature scale, feet offset, and HP-bar height
      tuned from manifest.
- [ ] Extend `__GAME_STATE__.mobs` with `action` for Playwright; room-integration
      tests assert server mob `action`/`actionSeq` on attack/death.
- [ ] Mandatory **visual gate** (AD-017): each mob type rendered idle + attack +
      die and reviewed before phase is marked done.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Goblin Club prop attachment (item 4) | Phase 11 (`create-attachment.md`) |
| Remote player GLB avatars | Phase 11 |
| NPC human GLBs | Phase 12 |
| Combat VFX (hit flash, death dissolve) | Phase 13 |
| Mob `cast` animation / skills | Seeded mobs have no skills in MVP |
| New mob types beyond the four seeded npcIds | Vertical slice only |
| Server-side animation timing / clip names on wire | Client owns clip selection (AD-016/AD-017) |
| AI or combat rule changes | Phase 4 authority preserved (AD-001) |
| Persisting `action`/`actionSeq` for mobs | Render-only, never DB-persisted (AD-015) |

---

## Assumptions & Open Questions

The Planner cannot talk to the user; every ambiguity is resolved here.

| Assumption / decision | Chosen default | Rationale |
| --------------------- | -------------- | --------- |
| Asset sourcing | CC0 curated-first per AD-017 + `game-designer` `create-monster.md`; inspect each GLB's real track names before committing `clipMap` | Never invent animation track names |
| Asset families (starting point) | **Biped humanoids** (Gremlin, Goblin): KayKit Skeletons or Quaternius Ultimate Monsters; **quadrupeds** (Wolf, Keltir): Quaternius Animals / similar CC0 pack | Matches ROADMAP creature silhouettes; unlicensed placeholder OK pre-live (game-designer golden rule 2) with `LICENSE.txt` when available |
| GLB storage | `client/public/models/monsters/<Name>.glb` + optional `LICENSE.txt` | Mirrors `models/characters/` layout |
| Manifest location | `client/src/scene/creature/creature-manifest.ts` keyed by `npcId` | `create-monster.md` Delta B; `mobs.ts` looks up by `npcId` already on wire |
| Unmapped `npcId` fallback | Keep capsule placeholder (current `createMobGroup` body) | Safe rollout; seed has 4 types but 11 spawn rows — all four types must map |
| Clone API | Extend `mesh-character.ts`: `loadGltfTemplate(url)` cache + `createMeshCharacterInstance(template, opts)` using `SkeletonUtils.clone` | Reuse Phase 8 backend; player keeps single-load `createMeshCharacter` |
| Mob `action` signal | Add `action` + `actionSeq` to `MobState` (same enum as `PlayerState`) | AD-015 extension; server sets on confirmed mob hit and on kill |
| Mob attack emit site | `TownRoom.simulate()` when `resolveMobAttack` returns `damage > 0` | Mirrors `emitPlayerAction` on player melee |
| Mob death emit site | `handleMobKill()` **before** `state.mobs.delete()` — set `action=DIE`, bump `actionSeq`, `syncMobState` | Client must observe DIE on replicated state; death is instantaneous (mob removed same tick) |
| Mob death client removal | On `onRemove`, if `die` not yet played, latch `die` clip and delay scene removal for `ACTION_DURATION_MS[Die]` (1200 ms); if `onChange` delivered `DIE` first, same latch | Allows die pose despite immediate server delete (parallel to player CHAR-08 pattern) |
| Locomotion derivation | Same coast-timer pattern as `player-avatar.ts` (`MOVE_THRESHOLD=0.02`, `MOVE_COAST_MS=200`) from server position deltas | Server does not replicate velocity; cosmetic only |
| Facing | Client-derived yaw from movement delta; during `attack`, face nearest aggro target (player position when `targetSessionId` known via replicated player positions) | Render-only; no server rotation |
| Server Y semantics | `mob.y = snapEntityY(x,z)` (feet offset 1.0 m, Phase 9) — same as player | Per-creature `feetOffsetY` in manifest adjusts mesh within group (KayKit-style bbox) |
| HP bar | Keep billboard HP bar child on mob group; `hpBarYOffset` per manifest entry from measured bbox height | ROADMAP "keep floating HP bars" |
| `cast` clip for mobs | Map in `clipMap` with fallback `cast → attack` if asset lacks cast; server never sets `Cast` on mobs | State machine unchanged; unused for mobs |
| Visual gate | Extend `client/character-lab.html` to accept `?mob=<npcId>` or `?model=monsters/<file>` + `scripts/shoot-character.mjs` with `LAB_CHAR` / `LAB_MODEL` env | Reuse existing harness (Phase 8 lesson) |
| Scale tuning targets (world metres, approximate) | Gremlin ~1.4 m, Goblin ~1.6 m, Wolf ~0.9 m, Keltir ~1.0 m bbox height | Derived from L2J collision heights ÷10 (AD-013): Gremlin 15, Goblin 16.5, Wolf 9, Keltir 10 |
| Seeded combat anchors (unchanged) | Gremlin hp **41**, exp **44**, melee **17** dmg unequipped; Goblin hp **84**, exp **220** | Phase 4/7 seed fixtures — gameplay unchanged |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Clone-per-Instance Mesh Backend ⭐ MVP

**User Story**: As the client, I want to spawn many mobs of the same type without
re-downloading the GLB or sharing one skinned mesh, so performance stays acceptable
and instances animate independently.

**Why P1**: Structural requirement for any rigged mob; without it, skinning corrupts
or all instances lock-step animate.

**Acceptance Criteria**:

1. WHEN a mob GLB URL is requested for the first time THEN the loader SHALL fetch
   and cache exactly **one** parsed GLTF template per URL. **Test layer: unit**
2. WHEN `createMeshCharacterInstance(template, opts)` is called N times for the
   same template THEN it SHALL return N distinct `THREE.Object3D` roots (not the
   same reference) each with its own `AnimationMixer`. **Test layer: unit**
3. WHEN two instances of the same template play different clips THEN their poses
   SHALL differ (independent mixers — not lock-step). **Test layer: unit**
4. WHEN `createMeshCharacter(url)` (player path) is used THEN it SHALL continue
   to work unchanged for the local player avatar. **Test layer: unit** (regression)

**Independent Test**: Vitest constructs two instances from one mocked template,
plays `attack` on one and `idle` on the other, asserts distinct mixer roots.

---

### P1: Creature Manifest ⭐ MVP

**User Story**: As a developer, I want mob visuals selected by `npcId` from data,
not hardcoded switches, so adding creatures scales.

**Why P1**: Eleven spawn rows share four templates; manifest is the extension point
for Phase 11+.

**Acceptance Criteria**:

1. WHEN `getCreatureEntry(npcId)` is called for **20001, 20003, 20120, 20481**
   THEN it SHALL return a `CreatureEntry` with `model` (GLB path), `clipMap`,
   `scale`, `feetOffsetY`, and `hpBarYOffset`. **Test layer: unit**
2. WHEN `getCreatureEntry` is called for an unknown `npcId` THEN it SHALL return
   `null` (caller uses capsule fallback). **Test layer: unit**
3. WHEN each manifest `clipMap` is defined THEN every key in
   `{idle, move, attack, cast, die}` SHALL map to a **real** track name present in
   that GLB (verified at asset-ingest task via inspect script). **Test layer: unit
   (map keys) + visual gate (tracks exist)**

**Independent Test**: Unit-test manifest keys and fallback; visual gate confirms
tracks play.

---

### P1: Four Mob GLB Assets ⭐ MVP

**User Story**: As a player, I want the four seeded mob types to look like distinct
creatures (fairy gremlin, club goblin, wolf, keltir), not identical capsules.

**Why P1**: Core visual deliverable of the phase.

**Acceptance Criteria**:

1. WHEN Gremlin spawns (`npcId=20001`) THEN the client SHALL render a **biped**
   rigged mesh (not a capsule) with clips **idle, move, attack, die** playable via
   the manifest `clipMap`. **Test layer: visual gate + unit (manifest)**
2. WHEN Goblin spawns (`npcId=20003`) THEN the client SHALL render a **humanoid
   biped** rigged mesh with **idle, move, attack, die**. **Test layer: visual gate**
3. WHEN Wolf spawns (`npcId=20120`) THEN the client SHALL render a **quadruped**
   rigged mesh with **idle, move, attack, die**. **Test layer: visual gate**
4. WHEN Bearded Keltir spawns (`npcId=20481`) THEN the client SHALL render a
   **quadruped** rigged mesh with **idle, move, attack, die**. **Test layer: visual
   gate**
5. WHEN any of the four GLBs is vendored THEN a `LICENSE.txt` SHALL sit beside it
   if the pack provides one; otherwise the placeholder is noted in the manifest
   comment for pre-launch replacement (AD-017). **Test layer: file check**

**Independent Test**: `character-lab` + `shoot-character.mjs` captures idle/attack/die
for each npcId; no capsule `CapsuleGeometry` in mob groups for mapped ids.

---

### P1: Server Mob Action Signal ⭐ MVP

**User Story**: As the system, I want the server to tell clients when a mob attacks
or dies, so attack/die animations are authoritative without client guessing.

**Why P1**: AD-015 extension; mob attacks are not inferable from HP alone.

**Acceptance Criteria**:

1. WHEN `MobState` is defined THEN it SHALL include render-only `action` (uint8
   `EntityAction`) and `actionSeq` (uint16), defaulting to `None`/`0`. **Test
   layer: schema unit**
2. WHEN the server resolves a mob melee hit (`resolveMobAttack` returns
   `damage > 0`) THEN it SHALL set that mob's `action = Attack` and increment
   `actionSeq` by 1. **Test layer: room-integration**
3. WHEN the server handles a mob kill (`handleMobKill`) THEN it SHALL set
   `action = Die` and increment `actionSeq` **before** removing the mob from
   `state.mobs`. **Test layer: room-integration**
4. WHEN the same mob action fires twice in succession (e.g. two hits) THEN
   `actionSeq` SHALL differ between firings. **Test layer: room-integration**
5. WHEN a mob respawns THEN `action` SHALL be `None` and `actionSeq` SHALL be
   `0`. **Test layer: room-integration**

**Independent Test**: Room test pins Gremlin, forces mob attack and player kill;
asserts `MobState.action`/`actionSeq` at each step.

---

### P1: Client Mob Animation ⭐ MVP

**User Story**: As a player, I want mobs to idle, walk, swing, and die visibly when
the server says so.

**Why P1**: Payoff of the phase — combat reads on mobs.

**Acceptance Criteria**:

1. WHEN a mob's server position changes (delta > `0.02` m) and no higher-precedence
   transient action is active THEN the client SHALL select the `move` clip. **Test
   layer: unit (mob-avatar locomotion)**
2. WHEN a mob is stationary (coast timer expired) THEN the client SHALL select
   `idle`. **Test layer: unit**
3. WHEN `actionSeq` increases with `action=Attack` THEN the client SHALL play the
   `attack` one-shot for `ACTION_DURATION_MS[Attack]` (600 ms). **Test layer: unit
   + e2e**
4. WHEN `actionSeq` increases with `action=Die` THEN the client SHALL play `die`
   and hold the final pose for at least `ACTION_DURATION_MS[Die]` (1200 ms) even
   if the mob is removed from server state the same tick. **Test layer: unit + e2e**
5. WHEN a mapped mob is rendered THEN no `CapsuleGeometry` body SHALL remain as
   the creature mesh (HP bar planes exempt). **Test layer: unit**
6. WHEN the render loop ticks THEN each live mob instance SHALL call
   `mixer.update(dt)` independently. **Test layer: unit**

**Independent Test**: Unit-test `mob-avatar` state machine wiring; e2e polls mob
`action` clip during combat.

---

### P1: Test Observability ⭐ MVP

**User Story**: As the test suite, I want to read each mob's current animation clip
from `__GAME_STATE__`, so Playwright can assert mob behavior without pixels.

**Why P1**: AD-009; required gate per AGENTS.md.

**Acceptance Criteria**:

1. WHEN mob animation updates THEN `window.__GAME_STATE__.mobs[i].action` SHALL
   hold the current clip name (`'idle' | 'move' | 'attack' | 'cast' | 'die'`).
   **Test layer: e2e**
2. WHEN a player attacks a Gremlin until kill THEN e2e SHALL observe the target
   mob's `action` become `'attack'` at least once before death and `'die'` on the
   killing blow (poll `__GAME_STATE__.mobs` by `targetMobId`). **Test layer: e2e**
3. WHEN room-integration forces a mob hit on the player THEN the mob's replicated
   `action` SHALL be `EntityAction.Attack` with incremented `actionSeq`. **Test
   layer: room-integration**

**Independent Test**: Playwright combat spec extension; room test for mob attack
signal.

---

### P2: Per-Creature Tuning ⭐ Should Have

**User Story**: As a player, I want each mob type sized and grounded correctly so
the world reads believably.

**Acceptance Criteria**:

1. WHEN each of the four mob types stands on terrain THEN its feet SHALL touch the
   ground (no obvious float/sink > `0.15` m) at default spawn poses. **Test layer:
   visual gate**
2. WHEN HP bars render THEN their Y offset SHALL come from the manifest
   `hpBarYOffset` (not a single hard-coded constant for all types). **Test layer:
   unit**
3. WHEN mobs move THEN they SHALL face their travel direction within ±15°. **Test
   layer: visual gate / unit facing helper**

---

### P2: Visual Gate ⭐ Should Have

**User Story**: As the team, we need rendered proof that each mob animates correctly
before marking the phase done.

**Acceptance Criteria**:

1. WHEN `scripts/shoot-character.mjs` runs for each of the four mob models THEN
   it SHALL produce PNGs for **idle, attack, die** (minimum) under a review
   directory. **Test layer: manual/CI artifact**
2. WHEN the visual gate is reviewed THEN each creature SHALL be recognizably
   distinct (not a capsule, not identical across types). **Test layer: Verifier +
   human/vision check**

---

## Edge Cases

- WHEN two mobs of the same `npcId` spawn THEN each SHALL animate independently
  (separate mixers). (MOB-01)
- WHEN a mob GLB fails to load THEN the client SHALL fall back to the capsule for
  that instance without crashing the game loop.
- WHEN `actionSeq` wraps at uint16 THEN any change (≠ `lastSeq`) SHALL retrigger
  the clip (same rule as player, CHAR-09.5).
- WHEN a mob dies and respawns with the same runtime id THEN the new instance
  SHALL start at `idle` with `action=None`/`actionSeq=0`.
- WHEN the player is out of peace zone and the mob is pinned for attack tests THEN
  use `OUT_OF_PEACE` placement helpers (Phase 6 lesson) — nearest TI spawns may
  be inside peace zone.
- WHEN Gremlin is one-shot killed (17 dmg, 41 hp) THEN room tests for **second**
  attack `actionSeq` bump SHALL target **Goblin** (survives first hit), mirroring
  Phase 5 cooldown lesson.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| MOB-01 | P1 Clone backend | Design | Pending |
| MOB-02 | P1 Clone backend | Design | Pending |
| MOB-03 | P1 Clone backend | Design | Pending |
| MOB-04 | P1 Clone backend | Design | Pending |
| MOB-05 | P1 Manifest | Design | Pending |
| MOB-06 | P1 Manifest | Design | Pending |
| MOB-07 | P1 Manifest | Design | Pending |
| MOB-08 | P1 Four GLBs | Design | Pending |
| MOB-09 | P1 Four GLBs | Design | Pending |
| MOB-10 | P1 Four GLBs | Design | Pending |
| MOB-11 | P1 Four GLBs | Design | Pending |
| MOB-12 | P1 Four GLBs | Design | Pending |
| MOB-13 | P1 Server signal | Design | Pending |
| MOB-14 | P1 Server signal | Design | Pending |
| MOB-15 | P1 Server signal | Design | Pending |
| MOB-16 | P1 Server signal | Design | Pending |
| MOB-17 | P1 Server signal | Design | Pending |
| MOB-18 | P1 Client animation | Design | Pending |
| MOB-19 | P1 Client animation | Design | Pending |
| MOB-20 | P1 Client animation | Design | Pending |
| MOB-21 | P1 Client animation | Design | Pending |
| MOB-22 | P1 Client animation | Design | Pending |
| MOB-23 | P1 Client animation | Design | Pending |
| MOB-24 | P1 Observability | Design | Pending |
| MOB-25 | P1 Observability | Design | Pending |
| MOB-26 | P1 Observability | Design | Pending |
| MOB-27 | P2 Tuning | Design | Pending |
| MOB-28 | P2 Tuning | Design | Pending |
| MOB-29 | P2 Tuning | Design | Pending |
| MOB-30 | P2 Visual gate | Design | Pending |
| MOB-31 | P2 Visual gate | Design | Pending |

**ID format:** `MOB-[NUMBER]`
**Coverage:** 31 total (23 P1, 8 P2); mapping to tasks in `tasks.md`.

---

## Success Criteria

- [ ] All four seeded mob types render as distinct rigged creatures (no capsules
      for mapped `npcId`s) with idle/move/attack/die driven by server state.
- [ ] Clone-per-instance: one network fetch per GLB, N independent animating
      instances.
- [ ] Server authority preserved (AD-001): `action`/`actionSeq` are render-only,
      never affect combat outcomes, never persisted.
- [ ] Gate green and fast: `nx test game-core`, `nx test server`, `nx test client`;
      `nx e2e client-e2e` asserts mob `action` via `__GAME_STATE__` (AD-009).
- [ ] Visual gate captures idle + attack + die for each mob type (AD-017).
- [ ] Gameplay anchors unchanged: Gremlin 41 HP / 44 XP / 17 melee damage, etc.
