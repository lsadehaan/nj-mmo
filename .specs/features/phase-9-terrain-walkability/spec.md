# Phase 9 — Terrain Walkability & Collision Specification

## Problem Statement

Characters float or sink through the terrain because the server never updates Y after spawn.
They can walk through village buildings, cliffs, and other blockers because no collision is
enforced. Click-to-move draws a straight line through impassable geometry instead of routing
around it. This breaks immersion and makes the world feel hollow.

## Goals

- [x] Characters follow terrain height everywhere (feet on ground)
- [x] Characters cannot walk through village buildings or out-of-world cliffs
- [x] Click-to-move routes around obstacles rather than teleporting through them

## Out of Scope

| Feature | Reason |
|---------|--------|
| L2J geodata / NSWE cell parsing (Tier 4) | Deferred per AD-006 |
| Client-side prediction / interpolation | Deferred per Phase 3 spec |
| Dynamic/destructible terrain | Not needed for TI vertical slice |
| Per-prop (tree/rock) collision | Too granular for MVP; buildings are the key blockers |
| Vertical navigation (climbing, jumping) | Not in L2 Classic TI scope |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Production terrain params | `seed=42, size=200, segments=64, heightScale=10` | Matches `renderer.ts` constants; `TERRAIN_SEED=42` already in `world-constants.ts` | y |
| Shared sampler lives in `game-core` | `libs/game-core/src/terrain-sampler.ts` | Enables server import without bundling Three.js | y |
| `FEET_OFFSET` value | `0.9` m | Matches client `FEET_OFFSET_Y = 0.9` in `player-avatar.ts` | y |
| Max walkable slope | gradient ≤ `1.0` (45°: 1 m rise per 1 m run) | Gentle hills passable; steep cliffs blocked | y |
| Max step height | `0.5` m | Small threshold for nearly-flat inter-cell steps | y |
| Player collision radius | `0.5` m | Half a metre; applied as expansion to building AABBs | y |
| Building blockers | 5 village buildings from `BUILDING_LAYOUT` in `village.ts` | Largest impassable obstacles; hand-authoring is accurate | y |
| Navmesh cell size | `1 m × 1 m` | Fine enough for character scale; grid is 190×190 = 36,100 cells | y |
| A* heuristic | Manhattan distance (4-directional grid) | Zero new deps; fast on 36k cells; diagonal allowed as optional extension | y |
| Waypoint queue storage | Server-side `Map<sessionId, WaypointQueue>` (not in Colyseus schema) | Schema stays minimal; waypoints are transient routing state | y |
| Client sends same move protocol | `{targetX, targetZ}` unchanged | No protocol change; server recomputes path from destination | y |
| Mob / NPC snap Y | `sampleHeightAt(x, z) + FEET_OFFSET` on spawn + every AI tick | Same rule as player | y |
| Navmesh baked at server startup | Once in `TownRoom.onCreate` | Grid is static; no runtime mutations needed for MVP | y |

**Open questions:** none — all resolved above.

---

## User Stories

### P1: Height snapping — feet on ground (Tier 1) ⭐ MVP

**User Story:** As a player, I want my character's feet to rest on the terrain so the world feels solid and believable.

**Why P1:** Core visual correctness; without this characters float or clip into the ground.

**Acceptance Criteria:**

- WALK-01: WHEN `sampleHeightAt(x, z)` is called in `game-core` with any finite `(x, z)` within world bounds THEN it SHALL return the same value as the current `terrain.ts` `sampleHeight(x, z)` for the same inputs (seed=42, size=200, heightScale=10), deterministically across environments.
- WALK-02: WHEN the client imports terrain height, THEN `terrain.ts` SHALL delegate to `sampleHeightAt` from `game-core` (no duplicate noise implementation); `TerrainData.sampleHeight` returns identical results before and after.
- WALK-03: WHEN a player moves (any movement tick), THEN the server SHALL set `player.y = sampleHeightAt(player.x, player.z) + FEET_OFFSET` (FEET_OFFSET = 0.9) so the player rides the terrain.
- WALK-04: WHEN a mob's position changes during AI wander or aggro chase, THEN the server SHALL update `mob.y = sampleHeightAt(mob.x, mob.z) + FEET_OFFSET` at that position.
- WALK-05: WHEN a mob or NPC is spawned, THEN its initial `y` SHALL be `sampleHeightAt(spawn.x, spawn.z) + FEET_OFFSET` (not the hardcoded `DEFAULT_SPAWN_Y ≈ 4.26`).
- WALK-06: WHEN `SPAWN_Y` is computed in `world-constants.ts`, THEN it SHALL be derived as `sampleHeightAt(SPAWN_X, SPAWN_Z) + FEET_OFFSET` (not a hand-copied constant); its numeric value SHALL remain within 0.001 of the previous 4.264.

**Independent Test:** Unit tests confirm `sampleHeightAt(0, 0)` equals ≈ 3.364 (= SPAWN_Y − FEET_OFFSET); room tests confirm `player.y` changes after a movement tick from a non-flat position.

---

### P1: Walkability & blockers — no walking through buildings (Tier 2) ⭐ MVP

**User Story:** As a player, I want movement to be physically plausible — I cannot walk through buildings or up impassably steep cliffs.

**Why P1:** Fundamental world consistency; without it the game feels broken.

**Acceptance Criteria:**

- WALK-07: WHEN `isWalkable(from, to)` is called THEN it SHALL return `false` if `|sampleHeightAt(to.x, to.z) − sampleHeightAt(from.x, from.z)| / dist(from, to) > MAX_SLOPE_GRADIENT` (1.0) **or** if `to` is inside a building blocker footprint expanded by `PLAYER_RADIUS` (0.5 m).
- WALK-08: WHEN `isWalkable(from, to)` is called with either point outside `[WORLD_MIN, WORLD_MAX]` THEN it SHALL return `false`.
- WALK-09: WHEN `isWalkable(from, to)` is called with both points in open terrain (no blocker, gentle slope) THEN it SHALL return `true`.
- WALK-10: WHEN `TownRoom.simulate()` computes the next player position and `isWalkable(current, next)` returns `false`, THEN the server SHALL NOT update `player.x` or `player.z` (position is unchanged; Y snap still applied at current x/z).
- WALK-11: WHEN mob AI selects a wander target, THEN it SHALL only pick targets for which `isWalkable(mob.current, target)` is `true`; blocked targets are resampled until a walkable one is found (max 10 tries, then stay put).
- WALK-12: WHEN a room-integration test moves a player directly into a village building center THEN `player.x` and `player.z` SHALL remain at the pre-move values.

**Independent Test:** Room integration test sets player adjacent to building 5 (center `(0, -14)`), sends move intent to `(0, -13)` (inside blocker), asserts `player.x = 0, player.z = -14` (unchanged). Unit tests enumerate blocked and open coordinates against `isWalkable`.

---

### P2: Navmesh pathfinding — route around obstacles (Tier 3)

**User Story:** As a player, I want click-to-move to automatically route around buildings so I do not need to manually steer.

**Why P2:** Greatly improves playability; requires Tier 2 blockers as a foundation.

**Acceptance Criteria:**

- WALK-13: WHEN `bakeGrid()` is called THEN it SHALL return a `Uint8Array` walkability grid of size `(GRID_W × GRID_H)` cells (1 m resolution over `[WORLD_MIN, WORLD_MAX]`) where each cell is `1` (walkable) or `0` (blocked) based on terrain slope and building blockers.
- WALK-14: WHEN `findPath(from, to, grid)` is called THEN it SHALL return an array of `{x, z}` waypoints (grid cell centres) from `from` to `to` that: (a) avoids all `0`-cells, (b) starts near `from` and ends at the nearest walkable cell to `to`, (c) is non-empty when a path exists, (d) is empty when no path exists (no crash).
- WALK-15: WHEN a player sends a move intent to a destination behind a building THEN the server SHALL compute a waypoint path via `findPath`, store it in the session waypoint queue, and advance through waypoints one tick at a time; each waypoint segment is validated with `isWalkable` before advancing.
- WALK-16: WHEN the player's position trail is sampled during a click-behind-building manoeuvre in the E2E suite THEN no sampled position SHALL lie inside a building blocker footprint (position trail never intersects a blocker).

**Independent Test:** Unit test: `findPath` from open terrain to other side of building-5 footprint returns a non-empty path; no waypoint centre lies in a blocker. E2E: click to `(0, -18)` (behind building 5) from `(0, 10)`, poll `__GAME_STATE__.player` every 200 ms, assert no sample falls in `{xMin: -4.5, xMax: 4.5, zMin: -17.5, zMax: -10.5}`.

---

## Edge Cases

- WHEN the player sends a move intent to a destination inside a building, the server runs A*, finds a path to the nearest walkable cell adjacent to the blocker, and navigates there.
- WHEN `findPath` finds no path (destination completely surrounded), the player stays at current position.
- WHEN the player sends multiple move intents in rapid succession, the old waypoint queue is replaced by the newly computed path.
- WHEN a mob wander pick fails `isWalkable` for all 10 retries, the mob stands still until the next wander timer fires.
- WHEN `sampleHeightAt` is called with `x` or `z` at the exact world edge (`±95`), it SHALL return a finite number (no NaN/Infinity).
- WHEN the server ticks with `NJ_AUTOSIM=0` and tests call `simulate()` directly, the Y-snap and walkability checks SHALL execute synchronously (no wall-clock dependency).

---

## Requirement Traceability

| Requirement ID | Story | Tier | Status |
|---|---|---|---|
| WALK-01 | P1: Height snapping | 1 | Pending |
| WALK-02 | P1: Height snapping | 1 | Pending |
| WALK-03 | P1: Height snapping | 1 | Pending |
| WALK-04 | P1: Height snapping | 1 | Pending |
| WALK-05 | P1: Height snapping | 1 | Pending |
| WALK-06 | P1: Height snapping | 1 | Pending |
| WALK-07 | P1: Walkability & blockers | 2 | Pending |
| WALK-08 | P1: Walkability & blockers | 2 | Pending |
| WALK-09 | P1: Walkability & blockers | 2 | Pending |
| WALK-10 | P1: Walkability & blockers | 2 | Pending |
| WALK-11 | P1: Walkability & blockers | 2 | Pending |
| WALK-12 | P1: Walkability & blockers | 2 | Pending |
| WALK-13 | P2: Navmesh pathfinding | 3 | Pending |
| WALK-14 | P2: Navmesh pathfinding | 3 | Pending |
| WALK-15 | P2: Navmesh pathfinding | 3 | Pending |
| WALK-16 | P2: Navmesh pathfinding | 3 | Pending |

**Coverage:** 16 total, 0 mapped to tasks yet, 16 unmapped ⚠️

---

## Success Criteria

- [ ] `sampleHeightAt` in `game-core` produces bit-identical results to the current client terrain for seed=42
- [ ] `player.y` tracks terrain height during movement (verified in room integration test)
- [ ] Moving into a building center does not change `player.x`/`player.z` (room integration)
- [ ] A* returns a non-empty path around building 5 from `(0, 10)` to `(0, -18)` (unit test)
- [ ] E2E position trail never intersects a building blocker (Playwright assertion)
- [ ] All prior tests remain green: `nx run-many -t build lint test` + `nx e2e client-e2e`
