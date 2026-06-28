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

## Post-MVP — Asset Pipeline (procedural, AI-autonomous)

> Goal: build all visual assets (characters, mobs, NPCs, animations) as procedural
> low-poly Three.js primitives (AD-005), via a constrained archetype-builder
> pipeline. Data chooses structure (archetype from `race`/`type`); AI fills flavor
> params; recipes commit to a manifest; validation is layered (deterministic unit +
> `__GAME_STATE__` e2e in CI; vision/turntable offline-only).

## Phase 8 — Player character: procedural humanoid rig + action animation `[x]`

> Done when: the local player renders as an articulated low-poly humanoid (no
> capsule) that idles, walks/faces travel direction, attacks, casts, and dies —
> all driven by a server-replicated render-only action signal. Establishes the
> reusable rig contract + pure animation state machine (AD-015, AD-016).
> Spec: `.specs/features/phase-8-character-rig-animation/`.

- [x] Shared `EntityAction` enum + pure animation state machine (`game-core`)
- [x] Render-only `action`/`actionSeq` on `PlayerState`; server sets on attack/skill/death
- [x] Procedural segmented humanoid builder + named-socket rig contract (client)
- [x] Procedural clips (idle/move/attack/cast/die) + animator; capsule replaced
- [x] `__GAME_STATE__.player.action` + Playwright transitions (idle→move→attack→cast)

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
