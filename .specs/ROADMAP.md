# MVP Roadmap — Browser MMO (Talking Island vertical slice)

> **Autonomous loop source of truth.** The `/loop` reads this file each
> iteration (goal + sub-items); the Planner sub-agent derives the full
> implementation by researching the codebase, `STATE.md` decisions, `AGENTS.md`,
> and the L2J Classic reference tree. Checkboxes flip to `[x]` only when a
> Verifier PASS is recorded in `.specs/features/<feature>/validation.md`.

High-level roadmap for the MVP. Each phase ends in something runnable and is
built through the `spec-driven-execution` flow (Planner → Implementer →
Verifier). Check an item only when its Verifier pass is recorded in
`.specs/features/<feature>/validation.md`.

**Legend:** `[ ]` not started · `[~]` in progress · `[x]` done (Verifier PASS)

**Hard dependency order:** Phase 3 (server authority) must precede combat and
skills. Town + NPCs (Phase 6) depend on combat + peace zone existing first.
Never run phases in parallel.

---

## Phase 1 — Foundation `[x]`

> Done when: `npm run dev` boots an empty server + client that talk; seed script populates the DB from L2J Classic XML.

- [x] Nx monorepo (`server/` + `client/` + `client-e2e/`)
- [x] Colyseus dev loop + Vite client + `npm run dev`
- [x] SQLite + Drizzle schema
- [x] Seed script: 4 mobs, 2 NPCs, Power Strike, XP curve (authentic Classic values)
- [x] Client connects to `TownRoom`; `window.__GAME_STATE__` test hook

## Phase 2 — Town & World (render) `[x]`

> Done when: you can walk the town and field, single-player.

- [x] Low-poly flat-shaded heightmap terrain
- [x] Village (ground patch, ~5 buildings, peace-zone marker)
- [x] Scattered trees/rocks + surrounding field
- [x] Click-to-move (ground raycast) + L2-style follow camera

## Phase 3 — Authoritative server + multiplayer `[x]`

> Done when: two browsers see each other moving; characters resume on reconnect.

- [x] Move movement to the server (client sends intent; server validates + broadcasts)
- [x] Migrate the pure `step()` into the `TownRoom` tick (per AD-008)
- [x] Render other players from room state
- [x] Persist character (position, HP/MP, XP, level) to DB; resume on reconnect

## Phase 4 — Combat on the server `[x]`

> Done when: killing a mob grants real server-validated XP — no client trust.

- [x] Server-side melee: target, range, attack speed, damage formula (from L2J)
- [x] Mob spawning from seed: aggro, wander, retaliate
- [x] Death, timed respawn
- [x] Server-granted XP + drops (seeded RNG)

## Phase 5 — The skill `[x]`

> Done when: pressing the key deals Power Strike's damage with a visible cooldown.

- [x] Server validates MP cost + cooldown; applies effect
- [x] Client hotkey + cooldown UI + simple flash/particle

## Phase 6 — NPCs & functional town `[x]`

> Done when: you reach an NPC, open the shop, buy an item, and cannot be attacked in town.

- [x] Place + render the 2 NPCs (Merchant, utility NPC) with proximity interaction
- [x] Merchant shop window: buy/sell from seeded item list
- [x] Utility NPC dialog + useful action (heal / starter item)
- [x] Enforce peace zone (no combat in town)

## Phase 7 — Progression loop `[x]`

> Done when: a player can create a character, claim the starter kit, equip a weapon,
> kill a mob, level up, die and respawn in town, and buy an item — all running locally.
> Public deployment is deferred post-MVP.

- [x] Basic inventory + gold + equip weapon
- [x] Death/respawn in town; level-up reward

---

## Post-MVP — Asset Pipeline (rigged GLTF, curated-then-AI)

> Goal: build all visual assets (characters, mobs, NPCs, animations) from
> **license-clean rigged GLTF meshes** with skeletal animation (AD-017,
> superseding AD-005's procedural-primitives-only rule). Curated CC0 packs first
> (KayKit/Quaternius/Mixamo) with a shared animation vocabulary; AI mesh
> generation as a later per-entity variety layer. Data → manifest (`model` GLB +
> `clipMap`); the `game-core` animation state machine still decides *which* clip;
> validation is layered (deterministic unit + `__GAME_STATE__` e2e in CI) **plus a
> mandatory rendered visual gate** (`client/character-lab.html` +
> `scripts/shoot-character.mjs`) reviewed before any character phase is `[x]`.

## Phase 8 — Player character: procedural humanoid rig + action animation `[x]`

> Done when: the local player renders as an articulated low-poly humanoid (no
> capsule) that idles, walks/faces travel direction, attacks, casts, and dies —
> all driven by a server-replicated render-only action signal. Establishes the
> reusable rig contract + pure animation state machine (AD-015, AD-016).
> Spec: `.specs/features/phase-8-character-rig-animation/`.

- [x] Shared `EntityAction` enum + pure animation state machine (`game-core`)
- [x] Render-only `action`/`actionSeq` on `PlayerState`; server sets on attack/skill/death
- [x] `__GAME_STATE__.player.action` + Playwright transitions (idle→move→idle→attack→cast)
- [~] **Superseded by AD-017**: procedural primitive rig replaced by a rigged GLTF
  backend (`mesh-character.ts`: `GLTFLoader` + `AnimationMixer`). Player avatar =
  KayKit **Rogue** (CC0, beginner leather look); clip map idle/move/attack/cast/die
  → KayKit tracks. (Knight/Mage/Hooded/Barbarian GLBs also vendored, same rig.)
  Locomotion fixed (coast-timer, no flicker / no stuck-move). Procedural
  `humanoid`/`clips`/`animator`/`rig-contract` removed.
- [x] Visual gate built + used (`character-lab.html`, `scripts/shoot-character.mjs`)

### Known follow-ups (player character)
- GLB load is async → ~1s avatar pop-in at spawn (add a placeholder or preload).
- Spawn tile (0,0) overlaps a village decoration; reads cluttered until you move.
- Follow camera is far → hero reads small; consider a closer camera or larger scale.
- Apply the same GLTF backend to remote players, mobs, and NPCs (still capsules).

## Phase 9 — Terrain walkability & collision `[ ]`

> Done when: characters follow terrain height, cannot walk through cliffs or
> buildings, and click-to-move routes **around** obstacles with the server
> validating every step. Supersedes the AD-006 trade-off ("no collision") for the
> MVP heightmap world; **L2J geodata (Tier 4) stays deferred.**
> Spec: `.specs/features/phase-9-terrain-walkability/`.
>
> **Depends on:** Phases 2–4 (heightmap renderer, authoritative movement, mob AI).

### Tier 1 — Height snapping (feet on ground)

- [ ] Move `generateTerrain` / `sampleHeight` into `libs/game-core` (shared
      `TERRAIN_SEED`, size, segments, `heightScale`; client imports from lib)
- [ ] Server sets `player.y = sampleHeight(x, z) + FEET_OFFSET` each movement tick
- [ ] Mobs and NPCs use the same height rule on spawn and during AI movement
- [ ] `SPAWN_Y` derived from shared terrain (no client/server drift)
- [ ] Unit tests: `sampleHeight` deterministic; Y snap at arbitrary `(x, z)`

### Tier 2 — Walkability & blockers (no walking through geometry)

- [ ] `isWalkable(from, to)` in `game-core`: max step height, max slope (from
      terrain gradient), world bounds (existing `WORLD_MIN`/`WORLD_MAX`)
- [ ] Hand-authored blocker volumes for village buildings + large props (circles
      or AABBs in shared data; same coords as `village.ts` / `scatter.ts`)
- [ ] `TownRoom.simulate()` clamps or rejects moves that fail `isWalkable`
- [ ] Mob wander/aggro chase respects `isWalkable` (no mobs through cliffs)
- [ ] Room-integration tests: move into cliff/building does not change `x,z`

### Tier 3 — Navmesh pathfinding (route around obstacles)

- [ ] Bake a walkability grid (1 m cells) or lightweight navmesh from heightmap +
      slope limits + blocker volumes
- [ ] Deterministic A* in `game-core` (no client trust; prefer zero new deps)
- [ ] Click-to-move: client pathfinds for preview/UX; server recomputes path and
      follows waypoints in `step()` (not a straight line to final click)
- [ ] Server validates each waypoint segment with `isWalkable` before advancing
- [ ] E2E via `__GAME_STATE__`: click behind a building routes around it (position
      trail never intersects blocker)

### Out of scope (Phase 9)

| Feature | Reason |
| ------- | ------ |
| L2J geodata / NSWE cell parsing (Tier 4) | Heavy; authentic L2 collision deferred post-MVP (AD-006) |
| Client-side prediction / interpolation | Deferred per Phase 3 spec |
| Dynamic destructible terrain | Not needed for TI vertical slice |

---

## Per-phase execution (how each `[ ]` gets to `[x]`)

1. **Plan** — Planner writes `spec.md` (+ `design.md`/`tasks.md`) under `.specs/features/<phase>/`, deciding autonomously and logging assumptions (no approval gate).
2. **Implement** — Implementer executes tasks: TDD, atomic commits, green Nx gate per task.
3. **Verify** — fresh Verifier: spec-anchored check + discrimination sensor → `validation.md`.
4. **Record** — on Verifier PASS, check the phase here and update `.specs/STATE.md` Handoff.

**Loop stop conditions:** the loop is autonomous-first — it decides and documents
rather than pausing for approval. Halt and surface to the human ONLY when genuinely
stuck (see the `spec-driven-execution` skill, "Autonomy & decision-making"): the
Verifier still FAILs after its 3 fix→re-verify iterations, or a true blocker
(contradictory requirements, missing secret/resource, destructive out-of-repo action,
or a missing prerequisite phase).
