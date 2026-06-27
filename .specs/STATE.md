# STATE

## Decisions

### AD-001
- **Decision**: Server authority is absolute — the Colyseus server owns all gameplay state (positions, HP/MP, combat, XP, drops); the client only renders and sends intent.
- **Reason**: Anti-cheat and a single source of truth; matches L2's authoritative model and AGENTS.md test boundary.
- **Trade-off**: More server work later; Phase 2 movement is client-local as a temporary, deliberately-migratable exception (see AD-008).
- **Scope**: All features/phases; all game-outcome logic and its tests live on the server.
- **Date**: 2026-06-27
- **Status**: active

### AD-002
- **Decision**: The authoritative server lands in Phase 3, not in this feature. Phase 1's room is a stub (`TownRoom` accepts join/leave + holds schema state only).
- **Reason**: Phases 1–2 deliver scaffold + single-player world; building authority now would be premature.
- **Trade-off**: Phase 2 movement is not yet validated server-side.
- **Scope**: Phase 1–2 vs Phase 3 boundary.
- **Date**: 2026-06-27
- **Status**: active

### AD-003
- **Decision**: L2J_Mobius **Classic** (`~/Dev/L2J_Mobius/L2J_Mobius_Classic_1.0`) is reference-only — parse its open-source XML to seed our own DB and translate combat *rules* from its `.java` to TS later.
- **Reason**: Authentic Classic values without legal/technical coupling.
- **Trade-off**: Must re-model schema in our own tables; no upstream updates.
- **Scope**: Seed + all future rule translation.
- **Date**: 2026-06-27
- **Status**: active

### AD-004
- **Decision**: Never run the real L2 network protocol, never import L2J code as a dependency, never ship proprietary client assets (.unr/models/textures).
- **Reason**: Legal and architectural cleanliness.
- **Trade-off**: All assets must be produced by us.
- **Scope**: Whole project.
- **Date**: 2026-06-27
- **Status**: active

### AD-005
- **Decision**: All 3D art is procedural low-poly Three.js geometry generated in code (primitives + flat shading); no external 3D asset files.
- **Reason**: Avoids proprietary assets (AD-004); fast, tiny, consistent art style.
- **Trade-off**: Lower visual fidelity than authored models.
- **Scope**: Client rendering, all phases.
- **Date**: 2026-06-27
- **Status**: active

### AD-006
- **Decision**: Map strategy is Level-1 semantic only for MVP — a hand-authored low-poly heightmap for the TI village + field, using L2J spawn/town coordinates as placement reference; geodata terrain is deferred post-MVP.
- **Reason**: Geodata is heavy and unnecessary for the vertical slice.
- **Trade-off**: No precise pathing/collision terrain until later.
- **Scope**: World/terrain, MVP.
- **Date**: 2026-06-27
- **Status**: active

### AD-007
- **Decision**: Locked stack — TS 6 / Node 22+ (machine v24); Nx 23.0.1 (`@nx/node`, `@nx/vite`, `@nx/playwright`); server: colyseus 0.17.10 + `@colyseus/schema` 4.0.26 + `@colyseus/tools` 0.17.19 (dev runner `tsx`); client: three 0.185.0 (Vite-bundled, not CDN) + `@colyseus/sdk` 0.17.43 + Vite 8.1.0; DB: better-sqlite3 12.11.1 + Drizzle ORM 0.45.2 + drizzle-kit 0.31.10 (SQLite now, Postgres-ready); seed: fast-xml-parser 5.9.3; tests: Vitest 4.1.9 + `@colyseus/testing` 0.17.11 + `@playwright/test` 1.61.1.
- **Reason**: Verified current versions; Vite-bundled Three.js for types/HMR (CDN swap trivial later); SQLite-first for speed.
- **Trade-off**: Native module (better-sqlite3) build dependency on Node version.
- **Scope**: Whole monorepo.
- **Date**: 2026-06-27
- **Status**: active

### AD-008
- **Decision**: Phase-2 movement is a client-local **pure** movement system consuming a movement **intent** (click→target), with an explicit Phase-3 migration boundary: Input stays client (intent → network message), the pure movement `step()` lifts verbatim into the `TownRoom` tick, rendering/camera read from a single `playerState` regardless of producer.
- **Reason**: Honors AD-001/AD-002 while keeping Phase 2 single-player; makes the Phase-3 migration mechanical, not a rewrite.
- **Trade-off**: A small amount of temporary client-side movement code.
- **Scope**: Movement, Phases 2–3.
- **Date**: 2026-06-27
- **Status**: active

### AD-009
- **Decision**: The client publishes a `window.__GAME_STATE__` test hook (`{ connected, ready, player:{x,y,z} }`); on-screen tests assert DOM + this hook, never pixels (WebGL is not DOM-testable).
- **Reason**: Reliable e2e without reading meshes from the canvas.
- **Trade-off**: Test hook is shipped client code (guard behind a flag if needed later).
- **Scope**: Client + all Playwright e2e, all phases.
- **Date**: 2026-06-27
- **Status**: active

### AD-010
- **Decision**: Four test layers (unit/Vitest, room integration/`@colyseus/testing`, seed-data/Vitest, e2e/Playwright); randomness runs through an injected seeded RNG; the gate (test runner) decides "done"; use `nx affected` + Nx caching, never disabling cache to force a pass. Gate commands: Quick = `nx test server`/`nx test client`; Full = adds `nx e2e client-e2e`; Build = `nx run-many -t build lint test`.
- **Reason**: AGENTS.md testing contract; deterministic, fast, cache-friendly gate.
- **Trade-off**: Discipline required to keep logic in unit-testable pure modules.
- **Scope**: All features/tests.
- **Date**: 2026-06-27
- **Status**: active

### AD-011
- **Decision**: Seed/data tests run against a fresh temp/in-memory SQLite DB per test (never a shared file), and the seed runner is idempotent (resets seeded tables in a transaction before insert).
- **Reason**: Parallel-safe, deterministic seed tests; reproducible DB.
- **Trade-off**: Slightly more setup per test.
- **Scope**: Seed + DB tests.
- **Date**: 2026-06-27
- **Status**: active

### AD-012
- **Decision**: A committed L2J XML fixture subset lives under `server/src/seed/__fixtures__/`; the seed `dataDir` is configurable (env/arg) with the L2J path as default. Seed/data tests use the fixtures, not the external L2J tree.
- **Reason**: Removes hard dependency on a machine-specific absolute path; keeps CI/tests portable while still parsing authentic markup.
- **Trade-off**: Fixtures must be kept representative of the real XML shape.
- **Scope**: Seed + CI.
- **Date**: 2026-06-27
- **Status**: active

### AD-013
- **Decision**: The world uses a local near-origin metric coordinate space (1 unit ≈ 1 m, village center at origin); L2J coordinates are used only as relative placement reference, never as raw world coordinates.
- **Reason**: Avoids Three.js float-precision/z-fighting issues far from origin; geodata is out of scope (AD-006).
- **Trade-off**: A mapping step between L2 reference coords and local space.
- **Scope**: World/terrain/placement.
- **Date**: 2026-06-27
- **Status**: active

## Handoff

Phase 3 verifier gaps 1–3 closed (onDrop room test, leave e2e, game-core path fix). Gap 4 in progress.

### Phase 3 deviations (Implementer)

| Task | Deviation | Reason |
| ---- | --------- | ------ |
| T10 | Debounced save uses wall-clock `setTimeout` instead of `room.clock.setTimeout` | Colyseus clock timers only advance on `clock.tick()`; trailing debounce during continuous movement never fired in room-integration tests. Wall-clock debounce matches spec intent (5 s after last change) for I/O. |
| T12 | `getDb()` mkdir parent dir; added `game-core:build` + `server:build` dependsOn; `tsconfig.base` dual path for `@nj/game-core` | Fresh e2e failed without `data/` directory; `server:build` failed with path-mapped lib under wrong `rootDir` — required for full gate. **Post-verify fix (gap 3):** `tsconfig.base.json` maps `@nj/game-core` → source only (vitest/tests); `server/tsconfig.app.json` overrides → `dist/` for `tsc` build (`rootDir` constraint). |
| T15 | Multiplayer e2e uses `test.describe.configure({ mode: 'serial' })` and matches moved player by id delta | Parallel Playwright workers share one `town` room; `others[0]` was not always browser A. |
