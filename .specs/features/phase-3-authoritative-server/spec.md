# Phase 3 — Authoritative Server + Multiplayer Specification

## Problem Statement

Phase 2 delivers a single-player world where movement is simulated client-side.
That violates AD-001 (server authority) and blocks multiplayer. Phase 3 moves
all position outcomes to the Colyseus server, lets two browsers see each other
move, and persists character state so a player resumes after disconnect.

## Goals

- [ ] Movement is server-authoritative: client sends intent; server validates,
      simulates, and broadcasts position via `@colyseus/schema` state.
- [ ] The Phase-2 pure `step()` lifts verbatim into the `TownRoom` simulation
      tick (AD-008 mechanical migration).
- [ ] Two connected browsers each render the other player's capsule from room
      state.
- [ ] Character state (position, HP, MP, XP, level) persists to SQLite and
      resumes on reconnect.
- [ ] Unit + room-integration tests prove authority; Playwright proves
      two-browser sync and reconnect via `window.__GAME_STATE__`.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Combat, damage, XP gain, mob interaction | Phase 4 |
| Skill casting / MP consumption | Phase 5 |
| NPC shop / peace-zone enforcement | Phase 6 |
| Accounts, login, password auth | Post-MVP; anonymous `characterId` only |
| Client-side prediction / interpolation | Deferred; render latest authoritative state |
| Terrain collision / navmesh on server | AD-006; bounds check only |
| Geodata / L2J movement-speed tables | Use existing `DEFAULT_MOVE_SPEED` (8) from Phase 2 |
| Postgres migration | SQLite-first per AD-007 |
| New npm libraries beyond Nx shared lib wiring | Locked stack AD-007 |

---

## Assumptions & Open Questions

The Planner cannot talk to the user; every ambiguity is resolved here.

| Assumption / decision | Chosen default | Rationale |
| --------------------- | -------------- | --------- |
| Shared movement module | Extract `movement-system.ts` into Nx lib `libs/game-core`; server and client import the same `step()` | Honors AD-008 "verbatim lift" without duplication; keeps client unit tests valid |
| Server tick rate | `setSimulationInterval` at **50 ms** (20 Hz); `deltaTime` (ms) ÷ 1000 passed to `step()` | Matches client render-loop `dt` cap (0.05 s); Colyseus default is 16.6 ms but 20 Hz is sufficient for walking |
| Intent message type | `"move"` with payload `{ targetX: number, targetZ: number }` | Mirrors `MovementIntent`; Colyseus `room.send(type, payload)` API |
| Invalid intents | Server **silently ignores** non-finite or out-of-bounds targets | No client trust; no error channel needed for MVP |
| World bounds | Axis-aligned square **x,z ∈ [−95, 95]** | Terrain size 200 centered at origin; 5-unit margin |
| Spawn position | `(0, SPAWN_Y, 0)` where `SPAWN_Y` is a shared constant matching client `sampleHeight(0,0)+1` with terrain seed 42 | Avoids duplicating full terrain gen on server; single constant in `libs/game-core` |
| Y during movement | Server updates **x,z only** in `step()`; **y stays** at loaded/spawn value | Matches Phase-2 client behavior (`step()` never modifies y) |
| Movement targets on wire | `targetX`/`targetZ` live in server-private tick state, **not** synced in `PlayerState` schema | Reduces bandwidth; reconnect restores position only |
| Character identity | UUID `characterId` generated server-side on first join; client stores in `localStorage` and passes in join `options` | No auth system; sufficient for reconnect resume |
| Starter character stats | `level=1`, `xp=0`, `hp=100`, `mp=50`, `name="Adventurer"` | Placeholder until combat (Phase 4); not sourced from L2J this phase |
| Persistence write points | Save on **consented leave**, **onDrop** (before allowReconnection), and **debounced every 5 s** while position/stats change | Balances durability vs SQLite write load |
| Reconnect window | `allowReconnection(client, 30)` in `onDrop`; `onReconnect` restores `connected=true` | Colyseus 0.17 reconnection API (Context7 verified) |
| Consented leave | `onLeave` deletes player from room state **and** saves to DB | Player gone from others' view immediately |
| Drop (unclean disconnect) | Player stays in state with `connected=false` during reconnection window; removed on timeout or consented leave after reject | Others see ghost until timeout — acceptable for MVP |
| Remote player visuals | Distinct-color capsule per other `sessionId` (not local player) | Reuses Phase-2 procedural mesh pattern (AD-005) |
| Test hook extension | Add `others: { id: string; x: number; y: number; z: number }[]` to `__GAME_STATE__` | Enables two-browser E2E without canvas reads (AD-009) |
| `characterId` on reconnect | Client passes stored `characterId` in `joinOrCreate('town', { characterId })`; server loads row or creates if missing | Distinct from Colyseus session reconnect (new tab) |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P3: Server-Authoritative Movement ⭐ MVP

**User Story**: As a player, when I click the ground, my character moves along the
server-simulated path so that position cannot be cheated client-side.

**Acceptance Criteria**:

1. WHEN the server `TownRoom` is running THEN it SHALL call `setSimulationInterval`
   and advance every joined player's position using the shared `step()` function
   each tick. **Test layer: room-integration**
2. WHEN a client sends a valid `"move"` intent THEN the server SHALL apply that
   intent on the next tick and broadcast updated `x,y,z` to all clients via
   `PlayerState`. **Test layer: room-integration**
3. WHEN a client sends a non-finite or out-of-bounds intent THEN the server SHALL
   NOT change that player's target. **Test layer: unit**
4. WHEN two clients are in the same room and client A moves THEN client B's
   received state SHALL reflect A's changing position within 2 s. **Test layer:
   room-integration**
5. The shared `step()` unit tests from Phase 2 SHALL continue to pass unchanged
   (same function body). **Test layer: unit**

---

### P3: Client Intent + Authoritative Render ⭐ MVP

**User Story**: As a player, I click to move and see my character follow the
server position, without local simulation deciding the outcome.

**Acceptance Criteria**:

1. WHEN the player clicks valid ground THEN the client SHALL send `"move"`
   `{ targetX, targetZ }` to the room and SHALL NOT call local `step()` for
   position outcomes. **Test layer: e2e** (movement still observable via hook)
2. WHEN room state updates the local player's `x,y,z` THEN the client renderer
   and camera SHALL use those values. **Test layer: e2e**
3. WHEN `window.__GAME_STATE__` is read after a click THEN `player.x/z` SHALL
   change reflecting server authority (existing smoke test updated). **Test
   layer: e2e**

---

### P3: Multiplayer Presence ⭐ MVP

**User Story**: As a player, I see other players' capsules move when they walk.

**Acceptance Criteria**:

1. WHEN another client joins the room THEN the local client SHALL add a remote
   player mesh. **Test layer: e2e**
2. WHEN a remote player's `PlayerState` position changes THEN the local client
   SHALL update that mesh position. **Test layer: e2e**
3. WHEN a remote client leaves (consented) THEN the local client SHALL remove
   their mesh. **Test layer: e2e**
4. WHEN two browsers are connected and browser A moves THEN browser B's
   `__GAME_STATE__.others` SHALL include A with updated coordinates.
   **Test layer: e2e**

---

### P3: Character Persistence & Reconnect ⭐ MVP

**User Story**: As a player, when I disconnect and return, my character resumes
at the last saved position and stats.

**Acceptance Criteria**:

1. WHEN the Drizzle schema is applied THEN a `characters` table SHALL exist with
   columns: `id`, `name`, `level`, `xp`, `hp`, `mp`, `x`, `y`, `z`,
   `updated_at`. **Test layer: unit** (schema/repo tests)
2. WHEN a client joins without `characterId` THEN the server SHALL create a new
   character row at spawn with starter stats. **Test layer: room-integration**
3. WHEN a client joins with a known `characterId` THEN the server SHALL load
   position and stats from DB into `PlayerState`. **Test layer: room-integration**
4. WHEN a player consents to leave or disconnects (`onDrop`) THEN the server
   SHALL persist current position and stats to DB. **Test layer: room-integration**
5. WHEN a client disconnects uncleanly and reconnects within 30 s via Colyseus
   `allowReconnection` THEN the same `sessionId` slot SHALL resume without
   duplicate characters in state. **Test layer: room-integration**
6. WHEN a client opens a new session with the same stored `characterId` after
   leaving THEN the player SHALL spawn at the last persisted position/stats.
   **Test layer: room-integration**
7. HP/MP/XP/level SHALL NOT change during movement in this phase (values
   round-trip unchanged). **Test layer: room-integration**

---

## Requirement Traceability

| ID | Requirement | Priority |
| -- | ----------- | -------- |
| P3-R1 | Server simulation tick runs shared `step()` per player | P1 |
| P3-R2 | Client sends `"move"` intent; no local position authority | P1 |
| P3-R3 | Server validates intent (finite, in bounds) | P1 |
| P3-R4 | `PlayerState` broadcasts `x,y,z` (+ stats fields) to all clients | P1 |
| P3-R5 | Client renders local player from room state | P1 |
| P3-R6 | Client renders remote players from `state.players` | P1 |
| P3-R7 | `characters` Drizzle table + repository | P1 |
| P3-R8 | Persist character on leave/drop/debounce | P1 |
| P3-R9 | Load or create character on join via `characterId` option | P1 |
| P3-R10 | Colyseus `allowReconnection` (30 s) + `onReconnect` | P1 |
| P3-R11 | Two-browser position sync observable | P1 |
| P3-R12 | `__GAME_STATE__.others` for multiplayer E2E | P1 |
| P3-R13 | Shared `libs/game-core` exports movement module verbatim | P1 |

---

## Acceptance Criteria → Test Layer Matrix

| AC / Req | Unit | Room-integration | Seed | E2E |
| -------- | ---- | ---------------- | ---- | --- |
| P3-R1 tick + step | — | ✓ | — | — |
| P3-R2 client intent | — | ✓ (send + state change) | — | ✓ |
| P3-R3 validation | ✓ | ✓ | — | — |
| P3-R4 broadcast | — | ✓ | — | — |
| P3-R5 local render | — | — | — | ✓ |
| P3-R6 remote render | — | — | — | ✓ |
| P3-R7 characters table | ✓ | — | — | — |
| P3-R8 persist | — | ✓ | — | — |
| P3-R9 load/create | — | ✓ | — | — |
| P3-R10 reconnect | — | ✓ | — | — |
| P3-R11 two-browser | — | ✓ (logic) | — | ✓ (on-screen) |
| P3-R12 test hook | — | — | — | ✓ |
| P3-R13 shared step | ✓ | — | — | — |
