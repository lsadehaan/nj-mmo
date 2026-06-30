# Phase 23 — Full Talking Island World & Zones Specification

## Problem Statement

The playable world is a single **200 m × 200 m** heightmap with one axis-aligned peace
rectangle (`x,z ∈ [−20, 20]`) and hand-placed spawn **rings** east of the village. That
layout cannot represent authentic Talking Island geography — Elven Ruins, Obelisk, Harbor,
eastern fields, and the Cave of Souls / Maze are absent as named places, and mob/NPC
spawns do not follow L2J **territory** placement. Phase 22 completed the bestiary but
explicitly deferred territory re-home until this phase.

## Goals

- [ ] Expand the walkable TI layout to **~640 m × 640 m** covering village, eastern
      fields, Elven Ruins, Obelisk, Harbor, and Cave of Souls / Maze as **named zones**.
- [ ] Replace the single peace rectangle with a **zone registry** (`peace` / `combat` /
      `fishing` / `water`) derived from L2J reference data (placement only, AD-003/AD-013).
- [ ] Re-map **all** `mob_spawns` and `npc_spawns` from L2J territory / spawn centroids
      into local space; keep walkability + peace guards (AD-018).
- [ ] Place **landmark GLB props** at zone anchors; update blocker volumes for village +
      landmarks.
- [ ] Server-authoritative zone rules + room tests; client exposes current zone in
      `__GAME_STATE__` (AD-009).

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| L2J geodata / NSWE cell parsing (Tier 4) | AD-006 deferred; keep grid A* pathfinding |
| Seamless open-world streaming | Single expanded `TownRoom` instance |
| Other regions (Gludin, Dion, …) | TI vertical slice only |
| Underground maze / dungeon instancing | Cave zone = exterior pocket + entrance prop; no separate room |
| Functional fishing minigame | `fishing` zone type is semantic only (Phase 29 audio hook) |
| Swimming / boats / water physics | `water` blocks combat + movement into deep water (reject step) |
| Roxxy teleport destinations | Phase 24 |
| Minimap UI | Phase 28 |

---

## Assumptions & Open Questions

Autonomous Planner decisions (no user gate).

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| AC prefix | **TIW23-NN** | Matches `BEST22-NN`, `QUEST21-NN` | y |
| L2 anchor | `L2_ANCHOR = { x: −84300, y: 243400 }` (TI village centroid from `peace.xml` + `Gludio.xml`) | AD-013 village at origin | y |
| Position scale | `L2_TO_LOCAL = 0.01` (10 L2 units ≈ 1 m); `localX = (l2x − anchor.x) × scale`; `localZ = −(l2y − anchor.y) × scale` | Compresses TI extent to ~640 m; L2 Y north → local −Z (matches current +x/−z field bias) | y |
| World extent | `TERRAIN_SIZE = 640`; `WORLD_MIN/MAX = ±315` (5 m margin) | Fits northern harbor (~364 m) and Elven Ruins (~294 m) from anchor | y |
| Terrain model | **Single heightmap** with region-biased noise presets (not separate Colyseus rooms) | AD-006 semantic layout; simpler than multi-mesh streaming | y |
| Zone geometry | **Convex polygons** (4–8 vertices) per named zone in local space; point-in-polygon | Peace zones in L2J are `NPoly`; avoids geodata | y |
| Named zones (6) | `ti_village`, `eastern_fields`, `elven_ruins`, `obelisk`, `harbor`, `cave_of_souls` | ROADMAP landmarks | y |
| Zone types | Village = `peace`; fields/ruins/obelisk/cave = `combat`; harbor shore band = `fishing`; harbor water + coast pockets = `water` | ROADMAP zone kinds | y |
| Peace guard | `zone.type === 'peace'` replaces `isInPeaceZone` rectangle; rectangle **removed** | Supersedes Phase 6 constant | y |
| Water guard | `isWalkable` returns false when **destination** cell is `water` (no wading) | Simple MVP; no swim animation | y |
| Fishing guard | No combat restriction beyond `combat`; fishing is metadata for future systems | Semantic zone only | y |
| Territory → spawn | Parse `TalkingIslandMonsters.xml` territory nodes; centroid → local; scatter `count` points inside polygon (seeded RNG) | AD-003 spawn reference | y |
| NPC spawns | Re-map `Gludio.xml` TI cluster (npcId 30001–30006, 30026–30033) from L2 coords via anchor | Phase 17 hand placement superseded | y |
| Gremlin/Goblin extras | Keep npcIds 20001/20003 spawns in `eastern_fields` near village edge | MVP tutorial mobs not in TI XML | y |
| Village buildings | `BUILDING_LAYOUT` recentred but **footprint sizes unchanged**; blockers updated to match | Phase 9 authority | y |
| Scatter props | Reseed trees/rocks for expanded bounds: `fieldMin/Max = ±300`, `count = 220`, `villageRadius = 45`, seed **42** | Visual density across larger map | y |
| Player zone sync | `PlayerState.zoneId: string` replicated; server updates each movement tick | Client HUD/minimap later | y |
| Cave of Souls | Northern-coast **combat** pocket near harbor (`cave_of_souls`); entrance prop only | L2J admin "Cave of Souls" is Aden — TI analogue = coastal cave maze entrance (ROADMAP intent) | y |
| Test gate | Vitest only — unit, seed, room; client `wireRoom` + `__GAME_STATE__` | Post-MVP ROADMAP + AGENTS.md | y |
| Implicit: auth / rate limits | N/A — local Colyseus room | — | N/A |
| Implicit: concurrency | Per-test isolated room + temp DB (`instanceKey`, AD-014) | Existing pattern | N/A |

**Open questions:** none — all resolved or logged above.

---

## L2J Landmark Anchors (local metres, scale 0.01)

| Landmark | L2 (x, y) | Local (x, z) | Named zone |
| -------- | --------- | ------------ | ---------- |
| Village center | (−82687, 243157) | (16, 2) | `ti_village` |
| Obelisk of Victory | (−99843, 237583) | (−155, 58) | `obelisk` |
| Southern/eastern fields | (−95336, 240478) | (−110, 29) | `eastern_fields` |
| Elven Ruins | (−112367, 234703) | (−281, 87) | `elven_ruins` |
| Northern harbor coast | (−106696, 214691) | (−224, 287) | `harbor` |
| Cave of Souls entrance | (−108500, 218000) | (−242, 254) | `cave_of_souls` |

Polygons are hand-authored around these anchors in `ti-zones.ts` (design), not imported as
raw L2 vertices.

---

## User Stories

### P1: Coordinate mapping & expanded bounds ⭐ MVP

**User Story**: As a developer, I need deterministic L2J→local conversion and larger world
bounds so placements and walkability share one coordinate space.

**Acceptance Criteria**:

1. **TIW23-01**: WHEN `l2ToLocal(−84300, 243400)` THEN result SHALL be `(0, 0)` ± `0.001`.
   **Test layer: unit** (`l2-coords.spec.ts`)
2. **TIW23-02**: WHEN `l2ToLocal(−99843, 237583)` THEN `localX` SHALL be `−155.43` ± `0.1`
   and `localZ` SHALL be `58.17` ± `0.1`. **Test layer: unit**
3. **TIW23-03**: WHEN `WORLD_MIN` / `WORLD_MAX` are read THEN they SHALL be `−315` and
   `315`. **Test layer: unit** (`world-constants.spec.ts`)
4. **TIW23-04**: WHEN `TERRAIN_CONFIG.size` is read THEN it SHALL be `640` (segments `128`).
   **Test layer: unit**
5. **TIW23-05**: WHEN `sampleHeight(0, 0)` is called on the expanded terrain THEN it SHALL
   return a finite number and `SPAWN_Y` SHALL equal `snapEntityY(0, 0)`. **Test layer: unit**
6. **TIW23-06**: WHEN `validateMoveIntent(320, 0)` is called THEN it SHALL return `false`;
   WHEN `validateMoveIntent(300, 0)` THEN `true`. **Test layer: unit**

---

### P1: Zone registry — named places ⭐ MVP

**User Story**: As a player, I walk through distinct named regions (village, fields, ruins,
harbor, obelisk, cave) with correct zone metadata.

**Acceptance Criteria**:

7. **TIW23-07**: WHEN `getZoneAt(0, 0)` THEN `zoneId` SHALL be `ti_village` and `type`
   SHALL be `peace`. **Test layer: unit** (`ti-zones.spec.ts`)
8. **TIW23-08**: WHEN `getZoneAt(−155, 58)` (Obelisk anchor) THEN `zoneId` SHALL be
   `obelisk` and `type` SHALL be `combat`. **Test layer: unit**
9. **TIW23-09**: WHEN `getZoneAt(−281, 87)` (Elven Ruins anchor) THEN `zoneId` SHALL be
   `elven_ruins`. **Test layer: unit**
10. **TIW23-10**: WHEN `getZoneAt(−224, 287)` (Harbor anchor) THEN `zoneId` SHALL be
    `harbor`. **Test layer: unit**
11. **TIW23-11**: WHEN `getZoneAt(−242, 254)` (Cave anchor) THEN `zoneId` SHALL be
    `cave_of_souls`. **Test layer: unit**
12. **TIW23-12**: WHEN `getZoneAt(−110, 29)` (eastern fields anchor) THEN `zoneId` SHALL
    be `eastern_fields` and `type` SHALL be `combat`. **Test layer: unit**
13. **TIW23-13**: WHEN `getZoneAt(x, z)` is called for every exported zone polygon THEN
    `zoneId` SHALL be non-empty and `type` SHALL be one of
    `peace|combat|fishing|water`. **Test layer: unit**
14. **TIW23-14**: WHEN a point lies outside all zone polygons THEN `getZoneAt` SHALL return
    `zoneId: 'wilderness'` and `type: 'combat'`. **Test layer: unit**
15. **TIW23-15**: WHEN `isPeaceZone(x, z)` is called THEN it SHALL equal
    `(getZoneAt(x,z).type === 'peace')` (legacy helper retained, rectangle removed).
    **Test layer: unit**
16. **TIW23-16**: WHEN `isWaterZone(x, z)` is called on a harbour water polygon sample
    THEN it SHALL be `true`. **Test layer: unit**

---

### P1: Peace & water combat guards ⭐ MVP

**User Story**: As a player in town I cannot fight; I cannot walk into deep water.

**Acceptance Criteria**:

17. **TIW23-17**: WHEN a player at `(0, 0)` in `ti_village` sends `attack` with a live mob
    target in range THEN mob HP SHALL NOT change. **Test layer: room-integration**
18. **TIW23-18**: WHEN a player at `(−150, 55)` in `obelisk` sends `attack` with target
    in range THEN mob HP SHALL decrease (combat allowed outside peace). **Test layer:
    room-integration**
19. **TIW23-19**: WHEN a player at `(0, 0)` sends `useSkill { skillId: 3 }` with Gremlin
    target in range THEN MP and mob HP SHALL NOT change. **Test layer: room-integration**
20. **TIW23-20**: WHEN a mob targets a player who moves into `ti_village` THEN subsequent
    mob attacks SHALL deal `0` damage. **Test layer: room-integration**
21. **TIW23-21**: WHEN mob AI evaluates a player in `ti_village` THEN it SHALL NOT acquire
    aggro. **Test layer: unit** (`mob-ai.spec.ts`)
22. **TIW23-22**: WHEN a player sends move intent into a `water` cell THEN `player.x/z`
    SHALL NOT change. **Test layer: room-integration**
23. **TIW23-23**: WHEN `isWalkable(from, to)` crosses into `water` at `to` THEN it SHALL
    return `false`. **Test layer: unit** (`walkability.spec.ts`)

---

### P1: Territory-based spawn re-home ⭐ MVP

**User Story**: As a player, mobs appear in level-appropriate **regions** (ruins wolves,
field keltirs, harbor outskirts) rather than one east-side strip.

**Acceptance Criteria**:

24. **TIW23-24**: WHEN `mob_spawns.json` is loaded THEN row count SHALL be `≥ 55` and every
    `npcId` in `TI_MOB_IDS` SHALL have `≥ 1` row. **Test layer: seed/unit**
25. **TIW23-25**: WHEN every mob spawn `(x, z)` is tested THEN `isInPeaceZone(x, z)` SHALL
    be `false`. **Test layer: unit** (`spawn-placement.spec.ts`)
26. **TIW23-26**: WHEN every mob spawn is tested THEN `isWalkable` from spawn to itself
    SHALL be `true` (centre walkable). **Test layer: unit**
27. **TIW23-27**: WHEN spawns are grouped by `getZoneAt(x,z).zoneId` THEN at least **4**
    distinct non-wilderness zones SHALL contain spawns. **Test layer: unit**
28. **TIW23-28**: WHEN `20481` (Bearded Keltir) spawns are averaged THEN centroid SHALL lie
    in `eastern_fields` or `ti_village` border (distance from origin `< 130 m`). **Test layer:
    unit**
29. **TIW23-29**: WHEN `20103` (Giant Spider) spawns are averaged THEN centroid SHALL lie
    in `elven_ruins` or `cave_of_souls` (zoneId match). **Test layer: unit**
30. **TIW23-30**: WHEN spawn fixture is regenerated from L2J territories THEN each territory
    name in `TalkingIslandMonsters.xml` maps to exactly one `zoneId` via
    `territoryZoneMap` (documented table in design). **Test layer: unit**
31. **TIW23-31**: WHEN average mob level per zone is computed THEN `elven_ruins` mean level
    SHALL be greater than `eastern_fields` mean level. **Test layer: unit**

---

### P1: NPC spawn re-home ⭐ MVP

**Acceptance Criteria**:

32. **TIW23-32**: WHEN `npc_spawns.json` is loaded THEN every `TI_NPC_IDS` entry SHALL have
    exactly one row. **Test layer: seed**
33. **TIW23-33**: WHEN every NPC spawn is tested THEN `getZoneAt(x,z).type` SHALL be
    `peace` (`ti_village`). **Test layer: unit**
34. **TIW23-34**: WHEN every NPC spawn is tested THEN `isNpcSpawnBlocked(x, z)` SHALL be
    `false`. **Test layer: unit**
35. **TIW23-35**: WHEN Katerina `(30004)` spawn is read THEN distance to `l2ToLocal(−84165,
    240670)` SHALL be `< 8 m`. **Test layer: unit** (L2 Grocery reference)

---

### P2: Landmark environment props

**User Story**: As a player, I see recognizable landmarks (obelisk, ruins arches, harbor
dock, cave mouth) on the expanded map.

**Acceptance Criteria**:

36. **TIW23-36**: WHEN the client environment manifest is read THEN it SHALL list **6**
    landmark entries: `Obelisk`, `ElvenRuins`, `HarborDock`, `CaveEntrance`, `RuinsArch`,
    `FieldShrine` (names canonical). **Test layer: unit**
37. **TIW23-37**: WHEN landmarks are placed THEN each anchor SHALL be within `15 m` of its
    design doc `(x, z)`. **Test layer: unit** (`landmark-placement.spec.ts`)
38. **TIW23-38**: WHEN `__GAME_STATE__.environment.landmarks` is read after load THEN
    `count` SHALL be `6` and `renderKind` SHALL be `'mesh'`. **Test layer: client unit**
39. **TIW23-39**: WHEN `node scripts/visual-gate.mjs` runs THEN all **6** landmark GLBs
    SHALL PASS structural checks. **Test layer: CI / Verifier**
40. **TIW23-40**: WHEN `shoot-environment.mjs` runs with `map-overview` camera THEN a PNG
    is produced for Verifier review (AD-017). **Test layer: Verifier**

**Skill:** `game-designer` → `references/create-prop.md` for landmark GLBs.

---

### P2: Blockers & pathfinding refresh

**Acceptance Criteria**:

41. **TIW23-41**: WHEN `bakeGrid()` runs on the expanded map THEN grid dimensions SHALL
    cover `[WORLD_MIN, WORLD_MAX]` at 1 m cells without throw. **Test layer: unit**
42. **TIW23-42**: WHEN a player pathfinds from village to `(−150, 55)` THEN `findPath`
    SHALL return a non-empty waypoint list. **Test layer: unit**
43. **TIW23-43**: WHEN landmark blocker AABBs are enumerated THEN each SHALL intersect its
    prop anchor (centre within footprint). **Test layer: unit**
44. **TIW23-44**: WHEN scatter prop blockers are rebuilt THEN count SHALL be `220` ± `5`.
    **Test layer: unit**

---

### P1: Client zone indicator ⭐ MVP

**Acceptance Criteria**:

45. **TIW23-45**: WHEN `PlayerState.zoneId` changes on the server THEN the client SHALL
    expose `__GAME_STATE__.zone.id` and `__GAME_STATE__.zone.type` within one `wireRoom`
    sync. **Test layer: client unit** (`wireRoom.spec.ts`)
46. **TIW23-46**: WHEN the local player moves (mocked position patch) from `ti_village` to
    `obelisk` coordinates THEN `__GAME_STATE__.zone.id` SHALL update from `ti_village` to
    `obelisk`. **Test layer: client unit**
47. **TIW23-47**: WHEN `__GAME_STATE__.zone` is read before join THEN `id` SHALL be
    `''` and `type` SHALL be `'unknown'`. **Test layer: client unit**

---

### P1: Server zone replication ⭐ MVP

**Acceptance Criteria**:

48. **TIW23-48**: WHEN a player spawns THEN `PlayerState.zoneId` SHALL equal
    `getZoneAt(spawnX, spawnZ).zoneId`. **Test layer: room-integration**
49. **TIW23-49**: WHEN a player moves across a zone boundary in one tick THEN
    `PlayerState.zoneId` SHALL update to the new zone. **Test layer: room-integration**
50. **TIW23-50**: WHEN `nj db:seed` runs on a fresh DB THEN `npm run dev` still boots and
    `nx run-many -t build lint test` SHALL pass (regression). **Test layer: gate**

---

## Edge Cases

- WHEN two zone polygons overlap THEN **smallest-area** zone wins (deterministic tie-break
  by sorted `zoneId`).
- WHEN a spawn centroid falls in `water` THEN relocate along −Z gradient up to 10 m until
  walkable or fail seed validation.
- WHEN L2J territory spans multiple named zones THEN `territoryZoneMap` picks the zone of
  the territory centroid (documented).
- WHEN player disconnects in `water` edge case THEN respawn at `SPAWN_X/Z` in village.
- WHEN expanded terrain height differs at old building coords THEN `BUILDING_LAYOUT` Y is
  cosmetic client-only; blockers stay XZ.
- WHEN `NJ_AUTOSIM=0` room tests move player THEN zone updates synchronously on `simulate()`.

---

## Requirement Traceability

| Requirement ID | Story | Status |
| -------------- | ----- | ------ |
| TIW23-01 … 06 | P1: Coords & bounds | Pending |
| TIW23-07 … 16 | P1: Zone registry | Pending |
| TIW23-17 … 23 | P1: Zone guards | Pending |
| TIW23-24 … 31 | P1: Mob spawns | Pending |
| TIW23-32 … 35 | P1: NPC spawns | Pending |
| TIW23-36 … 40 | P2: Landmarks | Pending |
| TIW23-41 … 44 | P2: Blockers/path | Pending |
| TIW23-45 … 47 | P1: Client zone | Pending |
| TIW23-48 … 50 | P1: Server zone | Pending |

**Coverage:** 50 total, 0 mapped to tasks (pending tasks.md), 0 unmapped.

---

## Success Criteria

- [ ] Player can walk village → Obelisk → eastern fields → Elven Ruins → harbor coast on
      one continuous heightmap without leaving `WORLD_*` bounds.
- [ ] Peace/combat/water rules enforced server-side with room tests anchored to spec values.
- [ ] All seeded mob/NPC spawns lie in walkable, zone-appropriate cells.
- [ ] `__GAME_STATE__.zone` reflects server `zoneId` for client unit tests.
- [ ] Visual gate records expanded map overview PASS.
