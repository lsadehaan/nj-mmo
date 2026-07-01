# Phase 1+2 — Foundation & World Specification

## Problem Statement

We have an empty repo and a mission to build a browser-playable, low-poly 3D
multiplayer MVP MMORPG inspired by L2 (a Talking Island vertical slice).
Before any gameplay can exist, we need a working monorepo + dev loop, a data
seed grounded in authentic L2J Classic values, and a navigable 3D world. This
feature delivers exactly that: a runnable `npm run dev` where a single player
can walk the Talking Island town and field.

## Goals

- [ ] `npm run dev` boots a Colyseus server and a Three.js/Vite client that
      connect to each other (stub room is acceptable for this feature).
- [ ] A seed script parses L2J_Mobius Classic XML into our own SQLite DB,
      populating 4 Talking Island mobs, 2 NPCs, the Power Strike skill, and the
      XP/level curve, with seed/data tests asserting authentic Classic values.
- [ ] A player can walk the Talking Island town and field single-player:
      low-poly flat-shaded heightmap terrain, a village with buildings and a
      peace-zone marker, scattered trees/rocks, surrounding field, click-to-move
      via ground raycast, and an L2-style follow camera.
- [ ] A Playwright smoke test proves the client boots, the canvas mounts, and a
      click moves the player (position observed via `window.__GAME_STATE__`).

## Out of Scope

Explicitly excluded. Documented to prevent scope creep. These belong to Phases
3–7.

| Feature | Reason |
| ------- | ------ |
| Authoritative server-side movement | Server authority lands in Phase 3; Phase 2 movement is intentionally client-local (designed to migrate) |
| Other players / multiplayer presence | No remote entities until the authoritative room exists (Phase 3) |
| Combat, damage, HP/MP changes | Phase 4 (combat) |
| Skill usage / casting (incl. Power Strike execution) | Phase 5; this feature only *seeds* the Power Strike definition, never casts it |
| NPC interaction / shop buy-sell | Phase 6; NPCs are placed/seeded only, not interactive |
| Persistence of player state / accounts / login | Phase 3+ |
| Geodata / Level-2 navmesh terrain | Deferred post-MVP; MVP uses a hand-authored Level-1 semantic heightmap |
| Drops / loot tables / item seeding | Not required for foundation/world; later phases |
| Deployment / hosting / CI | Phase 7 (go-live) |
| Real L2 network protocol | Forbidden — never implemented |

---

## Assumptions & Open Questions

The Planner cannot talk to the user; every ambiguity is resolved here with a
chosen default + rationale.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Which "Keltir" mob represents the TI Keltir | **Bearded Keltir** — npc id `20481`, level 1 (hp 41.145, mp 44.247, exp 44, sp 1, race ANIMAL) | It is the Keltir actually spawned in `spawns/TalkingIsland/TalkingIslandMonsters.xml`; most authentic to TI. Swappable by id. | n |
| Exact mob ids for the 4 TI mobs | Gremlin `20001` (lvl1, exp44, hp41.145), Wolf `20120` (lvl4, exp176, hp70.896), Goblin `20003` (lvl5, exp220, hp84.189), Bearded Keltir `20481` (lvl1, exp44, hp41.145) | Verified directly in `stats/npcs/*.xml`; low-level TI-appropriate; ids easily swappable in the seed map | n |
| Which 2 NPCs to seed | **Merchant = Katerina** (Grocer, id `30004`) and **Utility = Roxxy** (Gatekeeper/Teleporter, id `30006`) | Both are canonical Talking Island NPCs in `stats/npcs/30000-30099.xml`; Grocer = natural first shop later, Gatekeeper = the "Guide/Gatekeeper-type utility NPC" requested | n |
| Power Strike skill id | Player skill `id=3`, name "Power Strike", `toLevel=9` (mpConsume L1=9, reuseDelay 3000, operateType A1, targetType ENEMY, castRange 40) | Verified in `stats/skills/00000-00099.xml`; this is the canonical low-level player Power Strike (the `15xxx`/`16xxx` matches are mob/transform variants) | n |
| XP curve source & shape | `stats/players/experience.xml`, `maxLevel=91`; store `level → xpToNextLevel` (`tolevel` attr). Spot values: L2=68, L3=364, L10=48230 | Single authoritative curve file; `tolevel` is the XP needed to reach the next level | n |
| Town/field placement coordinates | Use the L2J TI monster territory coords (≈ x −75000..−87000, y 243000..257000, z ≈ −3700) as *placement reference only*, rescaled into a small local world-space origin for the heightmap | Geodata terrain is out of scope; Level-1 semantic map only needs relative placement, not absolute L2 world coords | n |
| World units / scale | Define a local metric world (1 unit ≈ 1 m), origin at village center `(0,0,0)`; L2 coords are mapped, not used raw | Three.js scene math is far simpler near origin; avoids float precision issues of raw L2 coordinates | n |
| Three.js delivery | Vite-bundled (npm dependency), not CDN | Types + HMR; CDN swap is trivial later (locked decision AD-007) | n |
| Phase-2 movement ownership | Client-local movement *system* consuming a movement *intent* (click→target), structured as pure logic so it lifts to the server in Phase 3 unchanged | Honors "server authority is absolute" while keeping Phase 2 single-player; the migration boundary is explicit | n |
| Stub room shape | A `TownRoom` that accepts join/leave and holds an empty (or minimal) `@colyseus/schema` state; no movement messages handled authoritatively yet | Satisfies "client connects to a Colyseus room" without pre-building Phase 3 authority | n |
| Number of village buildings | 5 low-poly buildings | Mid-point of the "4–5" guidance | n |
| Seed DB location | `server/data/game.db` (SQLite file), Drizzle-managed, regenerable from the seed | Server owns gameplay data; SQLite-first per locked stack | n |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Monorepo & Dev Loop ⭐ MVP

**User Story**: As a developer, I want an Nx monorepo with a server and client
that boot together via `npm run dev` and establish a Colyseus connection, so
that all later phases have a working foundation.

**Why P1**: Nothing else can be built or run without it.

**Acceptance Criteria**:

1. WHEN a developer runs `npm run dev` THEN the system SHALL start both the
   Colyseus server and the Vite client concurrently.
2. WHEN the client finishes loading in a browser THEN it SHALL connect to a
   Colyseus room on the server and reflect a connected state.
3. WHEN a client joins THEN the server `TownRoom` SHALL accept the join and
   maintain room state without error, and SHALL handle client leave cleanly.
4. WHEN the workspace is built THEN `nx run-many -t build lint test` SHALL pass
   for both projects.

**Independent Test**: Run `npm run dev`, open the client, observe
`window.__GAME_STATE__.connected === true`; room-integration test confirms
join/leave.

---

### P1: L2J Classic Data Seed ⭐ MVP

**User Story**: As the game, I want a SQLite DB seeded from authentic L2J
Classic XML (4 TI mobs, 2 NPCs, Power Strike, XP curve), so that later phases
build on real Classic values rather than fabricated data.

**Why P1**: Combat, XP, and shops in later phases all depend on this grounded
data; getting the schema and values right now avoids cascading rework.

**Acceptance Criteria**:

1. WHEN the seed script runs against the L2J Classic data directory THEN it
   SHALL populate the monster table with the 4 TI mobs at their authentic
   Classic values: Gremlin (id 20001, level 1, exp 44), Bearded Keltir (id
   20481, level 1, exp 44), Wolf (id 20120, level 4, exp 176), Goblin (id 20003,
   level 5, exp 220).
2. WHEN the seed runs THEN it SHALL populate the NPC table with Katerina
   (Grocer, id 30004) and Roxxy (Gatekeeper, id 30006).
3. WHEN the seed runs THEN it SHALL populate the skill table with Power Strike
   (id 3, name "Power Strike", maxLevel 9, level-1 mpConsume 9, reuseDelay 3000).
4. WHEN the seed runs THEN it SHALL populate the experience table with the full
   Classic curve where the XP-to-next-level for level 2 is 68, level 3 is 364,
   and level 10 is 48230.
5. WHEN the seed is run twice THEN the resulting DB SHALL be identical
   (idempotent — re-running replaces, never duplicates, seeded rows).
6. WHEN a referenced source XML field is missing or malformed THEN the seed
   SHALL fail loudly with a clear error identifying the entity, never write a
   silently-defaulted/garbage row.

**Independent Test**: Run the seed against the fixture/real XML, then query the
SQLite DB and assert the values above (seed/data tests).

---

### P1: Talking Island World ⭐ MVP

**User Story**: As a player, I want to see a low-poly Talking Island town and
field rendered with flat-shaded procedural geometry, so that I have a believable
place to explore.

**Why P1**: The "walk the town and field" outcome requires the world to exist
and render.

**Acceptance Criteria**:

1. WHEN the client scene loads THEN it SHALL render a low-poly heightmap terrain
   with flat shading, generated procedurally in code (no external 3D asset
   files).
2. WHEN the scene loads THEN it SHALL render a central village: a distinct ground
   patch, 5 low-poly buildings, and a visible peace-zone marker.
3. WHEN the scene loads THEN it SHALL render scattered trees and rocks and a
   surrounding field area beyond the village.
4. WHEN terrain and scatter are generated with the same seed THEN the layout
   SHALL be deterministic (identical across runs).

**Independent Test**: Load the client; the canvas mounts and the smoke test
confirms scene objects exist via the test hook; terrain/scatter unit tests
assert deterministic geometry.

---

### P1: Click-to-Move & Follow Camera ⭐ MVP

**User Story**: As a player, I want to click on the ground to move my character
and have an L2-style follow camera track me, so that I can walk around the
world.

**Why P1**: This is the core interaction of the vertical slice — "walk the town
and field".

**Acceptance Criteria**:

1. WHEN the player clicks on walkable ground THEN the system SHALL raycast the
   click to a world position and set that as the player's movement target
   (a movement *intent*).
2. WHEN a movement target is set THEN the movement system SHALL advance the
   player toward the target each tick at a fixed speed, stopping within a small
   epsilon of the target.
3. WHEN the player moves THEN an L2-style follow camera SHALL track the player at
   a fixed offset/height, keeping the player framed.
4. WHEN the player position changes THEN the client SHALL publish the current
   player position on `window.__GAME_STATE__` for test observation.
5. WHEN the click does not hit walkable ground THEN the system SHALL NOT change
   the current movement target.

**Independent Test**: Movement-system and camera unit tests assert pure
stepping/offset math; Playwright smoke test clicks the canvas and observes the
player position change via `window.__GAME_STATE__`.

---

### P2: Playwright Smoke Coverage

**User Story**: As a developer, I want a Playwright smoke test for the full
boot-and-move loop, so that regressions in the foundational client flow are
caught automatically.

**Why P2**: The smoke test is the on-screen gate for Phases 1–2; it is required
to call the feature "done" but is built after the world and movement exist.

**Acceptance Criteria**:

1. WHEN the smoke test runs THEN it SHALL load the client, assert the canvas
   element is mounted, and assert `window.__GAME_STATE__.connected === true`.
2. WHEN the smoke test simulates a ground click THEN it SHALL observe the
   player's position on `window.__GAME_STATE__` change from its initial value.

**Independent Test**: `nx e2e client-e2e` passes.

---

## Edge Cases

- WHEN the L2J data directory is not found at the configured path THEN the seed
  SHALL exit with a clear, actionable error (path + what was expected).
- WHEN a required XML attribute (e.g., a mob's `acquire exp`) is absent THEN the
  seed SHALL throw identifying the entity id, not coerce to 0.
- WHEN the seed runs on an existing DB THEN it SHALL reset the seeded tables so
  results are idempotent.
- WHEN the client cannot reach the server THEN `window.__GAME_STATE__.connected`
  SHALL be `false` (test hook still present) rather than the page crashing.
- WHEN a click ray misses all terrain THEN the player SHALL keep its previous
  target (no NaN/undefined target).
- WHEN the player is already at the target THEN the movement system SHALL be a
  no-op (no jitter past the epsilon).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| FND-01 | P1: Monorepo & Dev Loop | Tasks | Pending |
| FND-02 | P1: Monorepo & Dev Loop | Tasks | Pending |
| FND-03 | P1: Monorepo & Dev Loop | Tasks | Pending |
| FND-04 | P1: Monorepo & Dev Loop | Tasks | Pending |
| SEED-01 | P1: L2J Classic Data Seed | Tasks | Pending |
| SEED-02 | P1: L2J Classic Data Seed | Tasks | Pending |
| SEED-03 | P1: L2J Classic Data Seed | Tasks | Pending |
| SEED-04 | P1: L2J Classic Data Seed | Tasks | Pending |
| SEED-05 | P1: L2J Classic Data Seed | Tasks | Pending |
| SEED-06 | P1: L2J Classic Data Seed | Tasks | Pending |
| WLD-01 | P1: Talking Island World | Tasks | Pending |
| WLD-02 | P1: Talking Island World | Tasks | Pending |
| WLD-03 | P1: Talking Island World | Tasks | Pending |
| WLD-04 | P1: Talking Island World | Tasks | Pending |
| MOVE-01 | P1: Click-to-Move & Follow Camera | Tasks | Pending |
| MOVE-02 | P1: Click-to-Move & Follow Camera | Tasks | Pending |
| MOVE-03 | P1: Click-to-Move & Follow Camera | Tasks | Pending |
| MOVE-04 | P1: Click-to-Move & Follow Camera | Tasks | Pending |
| MOVE-05 | P1: Click-to-Move & Follow Camera | Tasks | Pending |
| E2E-01 | P2: Playwright Smoke Coverage | Tasks | Pending |
| E2E-02 | P2: Playwright Smoke Coverage | Tasks | Pending |

**ID format:** `[CATEGORY]-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 21 total, 21 to be mapped to tasks (see `tasks.md`), 0 unmapped.

---

## Success Criteria

How we know the feature is successful:

- [ ] `npm run dev` boots server + client; the client shows
      `window.__GAME_STATE__.connected === true` against the running room.
- [ ] Seed/data tests pass, asserting the exact Classic values for the 4 mobs,
      2 NPCs, Power Strike, and XP curve listed above.
- [ ] A player can click the ground to walk across the town and field with an
      L2-style follow camera, single-player.
- [ ] `nx e2e client-e2e` smoke test is green (canvas mounts + click moves
      player via the test hook).
- [ ] `nx run-many -t build lint test` passes for the whole workspace.
