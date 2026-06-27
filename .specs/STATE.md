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

**Phase 6 — Worker C (client T10–T14) COMPLETE.** Commits `caf7c39` (test-hook fix)
→ `03aa309` (T13) → T14 pending commit. Client: NPC renderer, shop/dialog DOM,
`__GAME_STATE__` town hooks, `town.spec.ts` e2e. Gates green:
`nx run-many -t build lint test && nx e2e client-e2e` (client 57 unit, 11 e2e).

**Next step:** Verifier on Phase 6 full diff (Workers A+B+C).

### Phase 6 deviations (Implementer, foundations Worker A)

| Task | Deviation | Reason |
| ---- | --------- | ------ |
| T2 | Minimal `adena`/`starterKitGranted` in `createCharacter` + `saveCharacter` (ahead of T9 scope) | Schema migration broke existing character round-trip tests; DB defaults alone left `created` ≠ `loaded`. |
| T7 | Gate used `nx run-many -t build lint --projects=server,game-core` | Full monorepo `nx run-many -t build lint` fails on pre-existing `client` `test-hook.spec.ts` TS errors (unrelated to Phase 6 schema). |

**Phase 5 — The skill (Power Strike): COMPLETE (Verifier PASS).**
`.specs/features/phase-5-power-strike/validation.md` records PASS over diff
`5d68137..HEAD`: 19/19 ACs traced to spec anchors (damage 69/62, MP 50→41,
cooldown 3000 ms, range 4.0 m, seeded powerL1=30), discrimination sensor
6/6 mutants killed, server authority (AD-001) confirmed, gate green (game-core
40, client 39, server all; `nx e2e client-e2e` 9/9 on retry). ROADMAP Phase 5
flipped to `[x]`. Tasks T1–T10 committed `7019ee4..3b5e69f`.

**Next step:** Phase 6 — NPCs & functional town. Place + render the 2 NPCs
(Merchant, utility NPC) with proximity interaction; Merchant shop window
(buy/sell from the seeded item list); utility NPC dialog + action (heal/starter
item); enforce the peace zone (no combat in town). Build on the authoritative
combat/skill systems and the seeded npcs table.

Watch item (non-blocking): the Playwright suite shows an intermittent
`multiplayer.spec.ts` rejoin flake (Nx flagged the suite flaky) — passed on
retry; stabilize if it recurs in Phase 6+.

### Phase 5 deviations (Implementer, client T6–T10)

| Task | Deviation | Reason |
| ---- | --------- | ------ |
| T7 | Extracted `combat-input.ts` from `main.ts` | Unit-test `wireCombatControls` without booting the full app; mirrors Phase 4 hook pattern. |
| T10 | E2e polls `__useSkill__` repeatedly until MP/cooldown/XP conditions met | Same server tick + `setTarget` latency pattern as `combat.spec.ts` `__attack__` loop; single fire was flaky. |

### Phase 5 deviations (Implementer, server T1–T5)

| Task | Deviation | Reason |
| ---- | --------- | ------ |
| T5 | `TownRoom.ensurePowerStrikeSeeded()` lazy-seeds Power Strike from fixtures when `skills` row missing (`:memory:` rooms) | Phase 1–4 room tests use `:memory:` without full seed; room boot must not throw on empty `skills` table. |
| T5 | Room-integration Gremlin damage tests assert `mp=41` + kill (`mobs` entry removed, `xp=44`) instead of post-tick HP delta | 69 damage one-shots Gremlin (41 HP); `handleMobKill` removes mob from schema before HP delta is readable. Unit/resolver layers assert exact 69. |
| T5 | Cooldown accept/reject room test targets Goblin (survives first 69-damage hit) | Gremlin cannot survive first cast for a second-cast cooldown exercise. |

**Phase 4 — Combat on the server: COMPLETE (Verifier PASS).**
`.specs/features/phase-4-server-combat/validation.md` records PASS over diff
`f5ba027..HEAD`: 19/19 ACs traced to the L2J-derived values, discrimination
sensor 11/11 mutants killed, gate green (game-core 37, server 79, client 25;
`nx e2e client-e2e` 8/8). ROADMAP Phase 4 flipped to `[x]`. All 16 tasks
(T1–T16) committed in `0235b77..0c1d5c7`; the planning artifacts (deleted
mid-run by a concurrent process) were restored in `fb93e8b`.

> NOTE: An earlier handoff here was written by a SECOND concurrent agent that
> believed Phase 4 was "blocked at T6" and had reset `master` to `4db16f8`.
> That was stale — this single-writer loop carried `master` through the full
> Phase 4 (T6 = `52f1fb3` … T16 = `0c1d5c7`) and the feature passed independent
> verification twice. Single-writer discipline is the lesson: never run two
> implementers on one working tree.

**Next step:** Phase 5 — The skill (Power Strike). Server validates MP cost +
cooldown and applies the effect (Power Strike already seeded in Phase 1);
client hotkey + cooldown UI + flash/particle. Build on the authoritative
combat resolver + tick delivered in Phase 4.

Non-blocking follow-ups carried forward (documented in validation.md, not
required for Phase 4 done): room-integration tests for the five combat edge
cases (dead target, no target, two players one mob, respawn during target-lock,
invalid `setTarget` id); a room-level Goblin drop assertion; exact-XP (44) e2e
precision.

Lesson L-001 (vitest must resolve `@nj/game-core` from source via
`resolve.alias`, not built `dist/`) recorded + resolved — reuse for future libs.

### Phase 4 deviations (Implementer)

| Task | Deviation | Reason |
| ---- | --------- | ------ |
| T6 | Completed as `52f1fb3` (monster combat stats parser + seeder) | An earlier concurrent attempt `82510c4` had a schema/seed mismatch and was reset; the single-writer re-implementation landed green (`nx test server`). |
| T13 | Injectable `nowMs` + `combatRng` room options for deterministic respawn/combat tests | Colyseus `setSimulationInterval` uses wall-clock deltas; fake `nowMs` advances only when tests call `clock.advance()`, making 27 s respawn assertions reliable without waiting. |
| T14–T16 | `others` hook excludes `connected === false` players; e2e webServer seeds DB before serve; Playwright `workers: 1` | Disconnected sessions from prior e2e tests polluted newcomer detection; committed `data/game.db` lacked mob spawns; shared `town` room needs serial e2e workers once combat joins the suite. |
| T16 | Added `server/src/seed/cli.ts`; combat e2e uses `__sendMoveIntent__` / `__handleMobTarget__` / `__attack__` hooks (AD-009) | Reliable movement/targeting without canvas pixel reads; seed CLI ensures mob spawns exist for e2e server boot. |

### Phase 3 deviations (Implementer)

| Task | Deviation | Reason |
| ---- | --------- | ------ |
| T10 | Debounced save uses wall-clock `setTimeout` instead of `room.clock.setTimeout` | Colyseus clock timers only advance on `clock.tick()`; trailing debounce during continuous movement never fired in room-integration tests. Wall-clock debounce matches spec intent (5 s after last change) for I/O. |
| T12 | `getDb()` mkdir parent dir; added `game-core:build` + `server:build` dependsOn; `tsconfig.base` dual path for `@nj/game-core` | Fresh e2e failed without `data/` directory; `server:build` failed with path-mapped lib under wrong `rootDir` — required for full gate. **Post-verify fix (gap 3):** `tsconfig.base.json` maps `@nj/game-core` → source only (vitest/tests); `server/tsconfig.app.json` overrides → `dist/` for `tsc` build (`rootDir` constraint). **Fix iteration 2 (gap 1):** explicit `resolve.alias` in `server/vitest.config.ts` + `client/vite.config.ts` — tsconfig paths alone insufficient (L-001). |
| T15 | Multiplayer e2e uses `test.describe.configure({ mode: 'serial' })` and matches moved player by id delta | Parallel Playwright workers share one `town` room; `others[0]` was not always browser A. **Fix iteration 2 (gap 2):** leave test joins B before A, tracks newcomer session id, polls `others` with `expect.poll`. |

### Phase 4 seed deviations (Implementer, T5–T8)

| Task | Deviation | Reason |
| ---- | --------- | ------ |
| T7/T8 | Idempotent re-seed tests compare drop/spawn rows **without** autoincrement `id` | SQLite `AUTOINCREMENT` advances on re-insert; row content is stable but surrogate ids differ. |
| T5–T8 | Used `mob_drops` / `mob_spawns` tables per `phase-4-server-combat` spec (not `items` + `monster_drops` from parallel `phase-4-combat` draft) | Task scope is `phase-4-server-combat`; drop rows reference `itemId` only (no items FK until Phase 7). |

### Phase 6 deviations (Implementer, T4–T8)

| Task | Deviation | Reason |
| ---- | --------- | ------ |
| T6 | Phase 4/5 combat unit + room tests use `OUT_OF_PEACE` (30, −30) for player/mob placement | TI Gremlin spawns at (−10, −14) and (12, −18) lie inside the peace-zone rectangle; attacker-at-spawn would deal 0 damage after P6-R02 guards. |
| T6 | `relocateMob` test helper pins wander targets to prevent mob drift during cast-range assertions | Mob AI wander runs before skill resolution in the tick; a 3.9 m edge-case test flaked when the mob moved out of range mid-tick. |
| T8 | Shop/NPC room tests call `settleRoomMessages` (one simulation tick) after `client.send` | Colyseus `@colyseus/testing` `sdk.joinById` delivers intents asynchronously; immediate reads of server state before the tick were stale. |

### Phase 6 deviations (Implementer, Worker C — client + e2e)

| Task | Deviation | Reason |
| ---- | --------- | ------ |
| T11 | Client `#shop-window` lists Katerina catalog from a static display constant (matches seed prices); server still validates `buy`/`sell` | `interactResult` does not include `merchant_items`; AD-001 requires server authority on transactions only. |
| T12 | Roxxy `Teleporter` type mapped client-side to Helper dialog (spec assumption) | MVP utility actions on npc 30006; L2J type differs. |
| T14 | E2E file `town.spec.ts` (not `town-npc.spec.ts` from tasks matrix) | User/orchestrator prompt path; same AC coverage. |
| T14 | Phase 4/5 combat e2e target mobs **outside** peace zone via `peace-zone.ts` helper | Nearest TI spawns at (12,−18)/(−10,−14) are inside P6 rectangle; combat would no-op. |
| T14 | Renamed `power-strike.spec.ts` → `0-power-strike.spec.ts` so it runs before `combat.spec.ts` | Shared room state: combat killing the nearest outside-peace mob caused power-strike flake when run second. |
| T14 | Multiplayer rejoin e2e uses `__sendMoveIntent__` poll + `__consentLeave__` before reconnect | Single ground click did not reliably persist server position before leave; consented leave triggers `onLeave` persist. |
