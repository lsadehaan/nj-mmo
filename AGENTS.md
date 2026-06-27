# AGENTS.md

Guidance for AI agents working in this repository.

## What this project is

A browser-playable, low-poly 3D multiplayer MVP of an MMORPG inspired by
Lineage 2 — a Talking Island vertical slice. Authoritative Colyseus server,
Three.js client, Nx monorepo (`server/` + `client/`), SQLite first.

L2J_Mobius **Classic** (`~/Dev/L2J_Mobius/L2J_Mobius_Classic_1.0`) is a
**reference only**: parse its open-source XML data to seed our own DB, and
translate combat *rules* from its `.java` into TypeScript. Never a dependency,
never the real L2 protocol, never proprietary client assets.

## How we work

Features are built with the **`spec-driven-execution`** skill: a Planner,
Implementer, and Verifier sub-agent on top of `tlc-spec-driven`. Read that
skill before starting any phase or feature.

## Testing principles (high level)

These are the rules that govern every test in this repo. Details and tooling
versions live with each project; this is the contract.

1. **Server authority is the test boundary.** All game-outcome logic (damage,
   XP, drops, position, cooldowns, peace zone) is tested on the **server**. The
   client is never trusted and never the source of truth in a test.

2. **Tests derive from spec acceptance criteria.** A test asserts a
   spec-defined outcome. It never mirrors the implementation, and we never
   weaken or skip a test to make it pass. The test runner decides "done".

3. **Four test layers** — pick the cheapest one that proves the criterion:
   - **Unit (server)** — formulas, curves, rules. The bulk of our tests.
   - **Room integration** (`@colyseus/testing`) — join/leave, intent
     validation, state broadcast, persistence/reconnect. Proves "no client
     trust" without a browser.
   - **Seed/data** — the L2J XML → SQLite seed produced the expected Classic
     values (mobs, NPCs, skill, XP curve).
   - **E2E / on-screen** (Playwright) — DOM HUD, two-browser multiplayer,
     real input.

4. **WebGL is not DOM-testable.** Playwright cannot read 3D meshes out of the
   canvas. We assert HUD/DOM elements directly, and assert logical game state
   through a `window.__GAME_STATE__` test hook the client publishes. We do not
   anchor correctness on pixel screenshots.

5. **Determinism.** Anything random (drop chance, damage variance) runs through
   an **injected seeded RNG** so tests and the Verifier's fault-injection are
   reliable.

6. **Independent verification.** After implementation, a fresh Verifier
   (author ≠ verifier) re-checks against the spec and injects behavior-level
   faults to confirm the tests actually catch regressions.

7. **Run only what changed.** Use `nx affected` and Nx caching so the gate is
   fast every time; never disable the cache to force a pass.

### Per-phase emphasis

- **Phase 1–2** (scaffold, render): seed/data tests + a Playwright smoke test.
- **Phase 3–5** (authoritative server, combat, skill): unit + room integration.
- **Phase 6–7** (NPCs, shop, go-live): Playwright E2E for the full player loop.

## Stack (current versions)

TypeScript, Node 22+, Nx, Colyseus + `@colyseus/schema` (server),
Three.js + `@colyseus/sdk` + Vite (client), better-sqlite3 + Drizzle (DB),
fast-xml-parser (seed), Vitest + `@colyseus/testing` + Playwright (tests).
