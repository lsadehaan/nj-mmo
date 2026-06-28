# [AGENTS.md](http://AGENTS.md)

Guidance for AI agents working in this repository.

## What this project is

A browser-playable, low-poly 3D multiplayer MVP of an MMORPG inspired by
Lineage 2 — a Talking Island vertical slice. Authoritative Colyseus server,
Three.js client, Nx monorepo (`server/` + `client/`), SQLite first.

L2J_Mobius **Classic** (`~/Dev/L2J_Mobius/L2J_Mobius_Classic_1.0`) is a
**reference only**: parse its open-source XML data to seed our own DB, and
translate combat _rules_ from its `.java` into TypeScript. Never a dependency, never the real L2 protocol.

## How we work

Features are built with the `spec-driven-execution` skill: a Planner,
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
8. **Tests are the source of confidence — keep them HIGH QUALITY and FAST.**
   The test suite is what lets agents (and humans) trust a change without
   re-reading everything. Treat tests as first-class code: clear, deterministic,
   isolated, and quick. **Fast feedback is a hard requirement, not a
   nice-to-have** — agents stall and burn cycles waiting on slow suites, which is
   a real failure mode here.
   - **The 10-second rule.** If a single test (or test file) takes **more than
     10 seconds**, treat it as a **defect to revisit**, not a cost to accept.
     Find the root cause and fix the test design.
   - **Speed comes from better design, never from weaker tests.** You may NEVER
     buy speed by skipping, weakening, or deleting tests or assertions (see
     principle 2). Coverage and spec-anchored values are non-negotiable.
   - **Never wait on wall-clock time.** Do not let tests sleep through real time
     (timers, simulation ticks, fixed `waitForTimeout`). Drive time-based server
     logic **deterministically** — advance the simulation synchronously and await
     real message delivery instead of sleeping (see the `NJ_AUTOSIM=0` +
     `tick()`/`deliver()` room-test harness).
   - **Isolate and parallelize.** Room-integration and e2e tests must be
     parallel-safe: per-test isolation (own DB / own room via the room
     `instanceKey` filter), no shared mutable state, deterministic polling
     (`expect.poll`) over fixed delays. E2E serves a **prebuilt** client, not a
     cold dev server.
   - This performance + determinism contract is recorded as **AD-014** in
     `.specs/STATE.md`; honor and extend it. A test that is slow or flaky is a
     bug to fix before the feature is "done".

### Per-phase emphasis

- **Phase 1–2** (scaffold, render): seed/data tests + a Playwright smoke test.
- **Phase 3–5** (authoritative server, combat, skill): unit + room integration.
- **Phase 6–7** (NPCs, shop, go-live): Playwright E2E for the full player loop.

## Stack (current versions)

TypeScript, Node 22+, Nx, Colyseus + `@colyseus/schema` (server),
Three.js + `@colyseus/sdk` + Vite (client), better-sqlite3 + Drizzle (DB),
fast-xml-parser (seed), Vitest + `@colyseus/testing` + Playwright (tests).
