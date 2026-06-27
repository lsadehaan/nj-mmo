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

## Phase 3 — Authoritative server + multiplayer `[ ]`

> Done when: two browsers see each other moving; characters resume on reconnect.

- [ ] Move movement to the server (client sends intent; server validates + broadcasts)
- [ ] Migrate the pure `step()` into the `TownRoom` tick (per AD-008)
- [ ] Render other players from room state
- [ ] Persist character (position, HP/MP, XP, level) to DB; resume on reconnect

## Phase 4 — Combat on the server `[ ]`

> Done when: killing a mob grants real server-validated XP — no client trust.

- [ ] Server-side melee: target, range, attack speed, damage formula (from L2J)
- [ ] Mob spawning from seed: aggro, wander, retaliate
- [ ] Death, timed respawn
- [ ] Server-granted XP + drops (seeded RNG)

## Phase 5 — The skill `[ ]`

> Done when: pressing the key deals Power Strike's damage with a visible cooldown.

- [ ] Server validates MP cost + cooldown; applies effect
- [ ] Client hotkey + cooldown UI + simple flash/particle

## Phase 6 — NPCs & functional town `[ ]`

> Done when: you reach an NPC, open the shop, buy an item, and cannot be attacked in town.

- [ ] Place + render the 2 NPCs (Merchant, utility NPC) with proximity interaction
- [ ] Merchant shop window: buy/sell from seeded item list
- [ ] Utility NPC dialog + useful action (heal / starter item)
- [ ] Enforce peace zone (no combat in town)

## Phase 7 — Progression loop & go live `[ ]`

> Done when: a public URL lets a friend create a character, kill a mob, level up, and buy an item.

- [ ] Basic inventory + gold + equip weapon
- [ ] Death/respawn in town; level-up reward
- [ ] Deploy server (Railway/Fly) + static client (Vercel) → public URL

---

## Per-phase execution (how each `[ ]` gets to `[x]`)

1. **Plan** — Planner writes `spec.md` (+ `design.md`/`tasks.md`) under `.specs/features/<phase>/`.
2. **Review** — human approves the plan (mandatory for Phase 3; recommended for all).
3. **Implement** — Implementer executes tasks: TDD, atomic commits, green Nx gate per task.
4. **Verify** — fresh Verifier: spec-anchored check + discrimination sensor → `validation.md`.
5. **Record** — on Verifier PASS, check the phase here and update `.specs/STATE.md` Handoff.

**Loop stop conditions:** halt and ask the human if the Verifier FAILs after its 3
fix→re-verify iterations, or whenever a plan needs approval.
