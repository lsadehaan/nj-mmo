# Phase 16 — Talking Island Mob Expansion (+5) Specification

## Problem Statement

The MVP seeds four Talking Island mobs (Gremlin, Bearded Keltir, Wolf, Goblin) with
full server authority and rigged GLB visuals (Phase 10). Several **authentic TI-native**
creatures at the same level bands are missing — players cannot encounter Elpy, Elder
Keltir, Elder Wolf, Giant Toad, or Orc despite them appearing in L2J Classic TI spawn
tables. This phase **adds** five mobs end-to-end (seed stats/drops/spawns, distinct
GLBs, manifest rows) without replacing the existing four.

## Goals

- [ ] Extend `TI_MOB_IDS` to **nine** npcIds; seed authentic Classic stats, drops, and
      walkable field spawns outside the peace zone for npcIds **20432, 20544, 20442,
      20121, 20130**.
- [ ] Source and wire **five distinct rigged GLBs** (fidelity-first, CC0 packs) with
      per-family `clipMap`, scale, feet offset, and HP-bar height.
- [ ] Extend `creature-manifest.ts` and unit tests so all nine seeded mob ids map to
      full `CreatureEntry` rows; runtime reuses Phase 10 clone-per-instance backend.
- [ ] Room-integration + e2e prove new mobs spawn, fight, and animate (`action` signal)
      via `__GAME_STATE__.mobs`.
- [ ] Mandatory two-layer visual gate (AD-017): `visual-gate.mjs` + character-lab
      screenshots for all five new creatures.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| L2J geodata / exact TI world coordinates | AD-006; hand-mapped `(x,z)` rings only |
| Mob weapon attachments (Orc axe, etc.) | Deferred (Phase 11 attachment pattern) |
| Replacing Gremlin / Goblin / Wolf / Bearded Keltir | This phase **adds** types; existing four stay |
| Mobs beyond these five | Next roadmap batch (Orc Soldier 20131 onward) |
| New renderer architecture | Reuse Phase 10 `mesh-character` + `mob-avatar` |
| Server combat / AI rule changes | Phase 4 authority preserved (AD-001) |
| Persisting mob `action`/`actionSeq` | Render-only, never DB-persisted (AD-015) |

---

## Assumptions & Open Questions

Every ambiguity is resolved autonomously (Planner cannot consult user).

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| `TI_MOB_IDS` ordering | Append new five after existing four: `[20001, 20481, 20120, 20003, 20432, 20544, 20442, 20121, 20130]` | Minimizes diff noise; seed parsers already iterate the array | y (autonomous) |
| Fixture XML (AD-012) | Add five `<npc>` nodes + dropLists to `server/src/seed/__fixtures__/monsters.xml`; seed tests use fixtures only | CI portability; no machine-specific L2J path | y |
| Spawn fixture count | **12** new rows (2–3 per new mob); total **23** spawn rows | Matches ROADMAP ring layout; enough density for e2e field walk | y |
| Spawn Y coordinate | `DEFAULT_SPAWN_Y` (4.26) unless heightmap sample differs at placement | Existing `mob_spawns.json` convention | y |
| Peace zone guard | Every spawn `(x,z)` must satisfy `!isInPeaceZone(x,z)` (`PEACE_ZONE` x,z ∈ [−20,20]) | AD-018 + Phase 6 combat lesson | y |
| Walkability guard | Every spawn must be on walkable terrain (`isWalkable` from adjacent walkable cell) | AD-018; mobs must path | y |
| Elpy aggression | `isAggressive: false` (L2J `isAggressive="false"`) | Classic XML | y |
| Orc aggression | `isAggressive: true`, `aggroRange: 450` | Classic XML matches Goblin pattern | y |
| Asset sourcing | CC0 Quaternius **Ultimate Monsters** + existing **Ultimate Animated Animals** wolf/deer packs; `import-pack-assets.mjs` or `gen-glb-assets.py` when pack lacks silhouette | AD-017 + `create-monster.md`; never copy character GLBs | y |
| Elder Wolf visual | **Distinct** GLB from Wolf (20120) — procedural tint/scale variant via `gen-glb-assets.py` if no second wolf in packs | `visual-gate.mjs` dedup rejects byte-identical GLBs | y |
| Elder Keltir visual | Distinct quadruped GLB; reuse `QUATERNIUS_DEER_CLIP_MAP` only if inspected track names match | Same rig family as Bearded Keltir | y |
| Orc visual | `Ultimate Monsters/Big/glTF/Orc.gltf` — **not** `Blob/glTF/Orc.gltf` (already Goblin) | Dedup + silhouette (humanoid biped) | y |
| Room test mob for second-hit `actionSeq` | Use **Orc** (98 HP, survives first 17-dmg hit) or **Elder Wolf** (84 HP) | Gremlin one-shot lesson (Phase 5) | y |
| E2E new-mob discovery | Dedicated spec walks player to outer field, polls `__GAME_STATE__.mobs` for `npcId ∈ {20432,…,20130}` | AD-009; avoids coupling to nearest-Gremlin helper | y |
| Implicit: auth / rate limits | N/A — no new endpoints | Server-authoritative room only | N/A |
| Implicit: concurrency | N/A — seed idempotent transaction (AD-011) | Existing pattern | N/A |
| Implicit: observability | Extend `__GAME_STATE__.mobs[].npcId` assertions only | AD-009 hook already exposes `npcId` | N/A |

**Open questions:** none — all resolved or logged above.

---

## Mob Roster (Grounded in L2J Classic)

| npcId | Name | Lv | Silhouette | Race | Aggressive | L2 collision h×r (÷10 ≈ m) |
| ----- | ---- | -- | ---------- | ---- | ---------- | -------------------------- |
| 20432 | Elpy | 1 | Small passive quadruped | ANIMAL | no | 4.5 × 5 → ~0.45 m |
| 20544 | Elder Keltir | 3 | Quadruped (Keltir family) | ANIMAL | no | 10 × 9.5 → ~1.0 m |
| 20442 | Elder Wolf | 5 | Quadruped (Wolf family) | ANIMAL | no | 9 × 13 → ~0.9 m |
| 20121 | Giant Toad | 5 | Amphibian / bulky quadruped | ANIMAL | no | 10 × 20 → ~1.0 m (wide) |
| 20130 | Orc | 6 | Humanoid biped | HUMANOID | yes (450) | 21 × 10 → ~2.1 m |

### Seed anchors (Classic values — seed tests MUST assert these)

| npcId | exp | sp | hp | mp | pAtk | pDef | attackSpeed |
| ----- | --- | -- | -- | -- | ---- | ---- | ----------- |
| 20432 | 44 | 1 | 41.145 | 44.247 | 8.47458 | 44.44444 | 253 |
| 20544 | 132 | 3 | 60.135 | 60.501 | 10.24492 | 47.91652 | 253 |
| 20442 | 220 | 6 | 84.189 | 76.755 | 12.34006 | 51.60553 | 253 |
| 20121 | 220 | 6 | 84.189 | 76.755 | 12.34006 | 51.60553 | 253 |
| 20130 | 264 | 7 | 98.115 | 85.785 | 13.52471 | 53.53373 | 253 |

### Drop anchors (one row per mob for seed tests)

| npcId | itemId | item (Classic) | min | max | chance |
| ----- | ------ | -------------- | --- | --- | ------ |
| 20432 | 57 | Adena | 4 | 8 | 70 |
| 20544 | 21 | Shirt | 1 | 1 | 9.292 |
| 20442 | 4 | Club | 1 | 1 | 3.667 |
| 20121 | 4 | Club | 1 | 1 | 3.702 |
| 20130 | 1122 | Cotton Shoes | 1 | 1 | 3.845 |

---

## User Stories

### P1: Seed extension — server authority ⭐ MVP

**User Story**: As the authoritative server, I need five additional TI mobs in the DB
with Classic stats, drops, and field spawns so combat/XP/drops behave authentically.

**Acceptance Criteria**:

1. **TIMOB-01**: WHEN `TI_MOB_IDS` is read THEN it SHALL contain exactly nine ids:
   `20001, 20481, 20120, 20003, 20432, 20544, 20442, 20121, 20130`. **Test layer:
   unit** (`paths` export).
2. **TIMOB-02**: WHEN seed runs against fixtures THEN monsters table SHALL contain
   **nine** rows with names/levels matching the roster table. **Test layer: seed**
3. **TIMOB-03**: WHEN seed runs THEN Elpy (`20432`) SHALL match seed anchors
   (`exp: 44`, `hp: 41.145`, `race: 'ANIMAL'`, `isAggressive: false`). **Test layer:
   seed**
4. **TIMOB-04**: WHEN seed runs THEN Elder Keltir (`20544`) SHALL match seed anchors
   (`level: 3`, `exp: 132`, `hp: 60.135`, `pAtk` ≈ 10.24492). **Test layer: seed**
5. **TIMOB-05**: WHEN seed runs THEN Elder Wolf (`20442`) SHALL match seed anchors
   (`level: 5`, `exp: 220`, `hp: 84.189`). **Test layer: seed**
6. **TIMOB-06**: WHEN seed runs THEN Giant Toad (`20121`) SHALL match seed anchors
   (`level: 5`, `hp: 84.189`, `pDef` ≈ 51.60553). **Test layer: seed**
7. **TIMOB-07**: WHEN seed runs THEN Orc (`20130`) SHALL match seed anchors
   (`level: 6`, `exp: 264`, `hp: 98.115`, `isAggressive: true`, `aggroRange: 450`).
   **Test layer: seed**
8. **TIMOB-08**: WHEN seed runs THEN each new mob SHALL have at least one `mob_drops`
   row matching its drop anchor table. **Test layer: seed**
9. **TIMOB-09**: WHEN seed runs THEN `mob_spawns` SHALL include spawn rows for **all
   nine** `TI_MOB_IDS`. **Test layer: seed**
10. **TIMOB-10**: WHEN seed runs THEN total spawn count SHALL be **≥ 20** (was 11).
    **Test layer: seed**
11. **TIMOB-11**: WHEN any spawn row is seeded THEN `(x,z)` SHALL satisfy
    `!isInPeaceZone(x,z)`. **Test layer: unit** (`game-core` peace-zone + spawn
    fixture assertion)
12. **TIMOB-12**: WHEN any spawn row is seeded THEN its `(x,z)` SHALL be walkable per
    `isWalkable`. **Test layer: unit** (`game-core` walkability + spawn list)
13. **TIMOB-13**: WHEN seed runs twice on the same DB THEN monster/spawn/drop rows
    SHALL be identical (idempotent). **Test layer: seed**

**Independent Test**: `nx test server` seed specs against `FIXTURE_DATA_DIR`.

---

### P1: Creature manifest ⭐ MVP

**User Story**: As the client, I want visuals for all nine seeded mob types selected
by `npcId` from data.

**Acceptance Criteria**:

14. **TIMOB-14**: WHEN `getCreatureEntry(npcId)` is called for each of the nine seeded
    ids THEN it SHALL return a `CreatureEntry` with `model`, `clipMap`, `scale`,
    `feetOffsetY`, `hpBarYOffset`. **Test layer: unit**
15. **TIMOB-15**: WHEN `getCreatureEntry(99999)` is called THEN it SHALL return
    `null`. **Test layer: unit**
16. **TIMOB-16**: WHEN each manifest `clipMap` is defined THEN every key in
    `{idle, move, attack, cast, die}` SHALL be a non-empty string. **Test layer: unit**
17. **TIMOB-17**: WHEN manifest entries for new mobs are compared THEN each `model`
    path SHALL be unique (no two npcIds share the same GLB path). **Test layer: unit**

**Independent Test**: `creature-manifest.spec.ts` with `SEEDED_NPC_IDS` length 9.

---

### P1: Five new GLB assets ⭐ MVP

**User Story**: As a player, I want the five new mob types to look like distinct
creatures matching their L2 silhouettes.

**Acceptance Criteria**:

18. **TIMOB-18**: WHEN Elpy spawns (`npcId=20432`) THEN client SHALL render a **small
    quadruped** rigged mesh (not a capsule) with idle/move/attack/die playable.
    **Test layer: visual gate + unit (manifest)**
19. **TIMOB-19**: WHEN Elder Keltir spawns (`npcId=20544`) THEN client SHALL render a
    **quadruped** distinct from Bearded Keltir. **Test layer: visual gate**
20. **TIMOB-20**: WHEN Elder Wolf spawns (`npcId=20442`) THEN client SHALL render a
    **quadruped** distinct from Wolf (`20120`). **Test layer: visual gate**
21. **TIMOB-21**: WHEN Giant Toad spawns (`npcId=20121`) THEN client SHALL render an
    **amphibian / bulky quadruped** rigged mesh. **Test layer: visual gate**
22. **TIMOB-22**: WHEN Orc spawns (`npcId=20130`) THEN client SHALL render a **humanoid
    biped** rigged mesh distinct from Goblin (`20003`). **Test layer: visual gate**
23. **TIMOB-23**: WHEN any new GLB is vendored THEN `LICENSE.txt` under
    `client/public/models/monsters/` SHALL document source pack + pre-launch swap note
    (AD-004). **Test layer: file check**

**Independent Test**: `node scripts/visual-gate.mjs` + `shoot-character.mjs` per mob.

---

### P1: Runtime — reuse Phase 10 backend ⭐ MVP

**User Story**: As the system, new mobs shall use the existing clone-per-instance mesh
pipeline without architectural changes.

**Acceptance Criteria**:

24. **TIMOB-24**: WHEN a mapped new mob syncs THEN `mobs.ts` SHALL NOT use
    `CapsuleGeometry` as the creature body. **Test layer: unit** (regression on one new
    npcId)
25. **TIMOB-25**: WHEN N instances of the same new mob type spawn THEN each SHALL have
    an independent `AnimationMixer` (template loaded once). **Test layer: unit**
    (regression — existing `mesh-character.spec.ts` unchanged)
26. **TIMOB-26**: WHEN server resolves a hit on a new mob THEN replicated `MobState`
    SHALL set `action=Attack` and increment `actionSeq`. **Test layer: room-integration**
27. **TIMOB-27**: WHEN server kills a new mob THEN it SHALL emit `action=Die` before
    `state.mobs.delete()`. **Test layer: room-integration**

**Independent Test**: Extend `TownRoom.spec.ts` with Orc or Elder Wolf combat pin.

---

### P1: Test observability ⭐ MVP

**User Story**: As the test suite, I need to observe new mob types in the field without
reading WebGL pixels.

**Acceptance Criteria**:

28. **TIMOB-28**: WHEN player walks to the outer field (east/south of village) THEN
    `__GAME_STATE__.mobs` SHALL include at least one mob with
    `npcId ∈ {20432, 20544, 20442, 20121, 20130}`. **Test layer: e2e**
29. **TIMOB-29**: WHEN player kills a newly seeded mob (Orc or Elder Wolf) THEN e2e
    SHALL observe `action === 'attack'` at least once and `action === 'die'` on the
    killing blow via `__GAME_STATE__.mobs`. **Test layer: e2e**

**Independent Test**: New `client-e2e` spec or extension to `mob-animation.spec.ts`.

---

### P2: Spawn progression & visual gate ⭐ Should Have

**Acceptance Criteria**:

30. **TIMOB-30**: WHEN spawn coordinates are listed by distance from origin THEN
    avg level of mobs SHALL increase monotonically across rings (Elpy/Elder Keltir
    nearer than Orc). **Test layer: unit** (spawn ring metadata test)
31. **TIMOB-31**: WHEN `node scripts/visual-gate.mjs` runs THEN all five new GLBs
    SHALL PASS structural checks (rigged, non-dedup, non-empty). **Test layer: manual/CI**
32. **TIMOB-32**: WHEN `shoot-character.mjs` runs for each new mob THEN PNGs for
    **idle, attack, die** SHALL be produced and reviewed. **Test layer: Verifier +
    vision check**

---

## Edge Cases

- WHEN two mobs share a family clip map (Elder Keltir / Bearded Keltir) THEN track
  names MUST still be verified on the **new** GLB before mapping (TIMOB-16).
- WHEN a new GLB fails to load THEN client SHALL fall back to capsule for that instance
  (Phase 10 pattern).
- WHEN spawn coordinates fall inside peace zone THEN seed test TIMOB-11 SHALL fail
  (placement bug).
- WHEN `visual-gate.mjs` detects byte-identical GLBs across entities THEN phase SHALL
  NOT pass (Phase 15 lesson).
- WHEN e2e targets a wandering mob THEN test SHALL chase live position (AD-014).
- WHEN Gremlin remains nearest mob THEN new-mob e2e MUST walk to outer rings explicitly
  (not `pickNearestCombatMob` alone).

---

## Requirement Traceability

| Requirement ID | Story | Status |
| -------------- | ----- | ------ |
| TIMOB-01 | P1 Seed | Pending |
| TIMOB-02 | P1 Seed | Pending |
| TIMOB-03 | P1 Seed | Pending |
| TIMOB-04 | P1 Seed | Pending |
| TIMOB-05 | P1 Seed | Pending |
| TIMOB-06 | P1 Seed | Pending |
| TIMOB-07 | P1 Seed | Pending |
| TIMOB-08 | P1 Seed | Pending |
| TIMOB-09 | P1 Seed | Pending |
| TIMOB-10 | P1 Seed | Pending |
| TIMOB-11 | P1 Seed | Pending |
| TIMOB-12 | P1 Seed | Pending |
| TIMOB-13 | P1 Seed | Pending |
| TIMOB-14 | P1 Manifest | Pending |
| TIMOB-15 | P1 Manifest | Pending |
| TIMOB-16 | P1 Manifest | Pending |
| TIMOB-17 | P1 Manifest | Pending |
| TIMOB-18 | P1 GLBs | Pending |
| TIMOB-19 | P1 GLBs | Pending |
| TIMOB-20 | P1 GLBs | Pending |
| TIMOB-21 | P1 GLBs | Pending |
| TIMOB-22 | P1 GLBs | Pending |
| TIMOB-23 | P1 GLBs | Pending |
| TIMOB-24 | P1 Runtime | Pending |
| TIMOB-25 | P1 Runtime | Pending |
| TIMOB-26 | P1 Runtime | Pending |
| TIMOB-27 | P1 Runtime | Pending |
| TIMOB-28 | P1 Observability | Pending |
| TIMOB-29 | P1 Observability | Pending |
| TIMOB-30 | P2 Progression | Pending |
| TIMOB-31 | P2 Visual gate | Pending |
| TIMOB-32 | P2 Visual gate | Pending |

**ID format:** `TIMOB-[NUMBER]`
**Coverage:** 32 total (29 P1, 3 P2); mapped to tasks in `tasks.md`.

---

## Success Criteria

- [ ] Nine seeded mob types in DB; five new types playable end-to-end.
- [ ] All spawn rows outside peace zone on walkable terrain.
- [ ] Five distinct rigged GLBs; no byte-copy dedup failures.
- [ ] Gate green: `nx test server`, `nx test client`, `nx e2e client-e2e`.
- [ ] Visual gate PASS for all five new creatures (AD-017).
- [ ] Existing four mobs unchanged (stats, GLBs, spawns preserved unless ring adjustment
      required for walkability).
