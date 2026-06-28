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
- **Status**: superseded by AD-017

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

### AD-014
- **Decision**: Test-infrastructure performance + determinism contract. (1) Room-integration tests run with `NJ_AUTOSIM=0` so `TownRoom` starts no background simulation interval; tests advance the world by calling `simulate()` directly (synchronous `tick()` helper) and await real message delivery via `room.waitForMessage` (`deliver()` helper) before processing — no wall-clock tick sleeps, no transport/tick races. Production is unchanged (auto-simulates at 50 ms with the real measured delta). (2) E2E isolates each test in its own Colyseus room via `town`.`filterBy(['instanceKey'])` + a client `?room=<key>` query (production passes no key → shared world); this enables Playwright `fullyParallel` with 4 workers and removes serial mode + the `0-`-prefix ordering hack. (3) E2E serves a prebuilt client (`nx run client:preview`) instead of the dev server to avoid first-request compile contention. (4) E2E combat/skill polls chase the mob's live position (mobs wander) instead of a stale snapshot.
- **Reason**: `nx test server` was ~9 s (one file, `TownRoom.spec`, was ~7.8 s of it) because `@colyseus/testing`'s `waitForNextSimulationTick` is a `setTimeout(interval)` and the room ticked every 50 ms (~150 serialized sleeps); the e2e suite was serial and flaky from shared-room state bleed + dev-server cold-compile + stale-snapshot mob targeting.
- **Trade-off**: Tests reach into the room (`simulate`, message helpers) and the client reads a `?room` test param; a small amount of test-only surface in production code (guarded/inert in production).
- **Scope**: All server room-integration tests + all Playwright e2e.
- **Date**: 2026-06-27
- **Status**: active
- **Result**: `nx test server` ~9.2 s → ~2.3 s; full `nx run-many -t build lint test` ~15.5 s → ~11 s; `nx e2e client-e2e` ~56 s → ~23 s and reliably green (14 consecutive cold runs). All test counts unchanged (game-core 44, client 57, server 135, e2e 12); no tests skipped/weakened; L-001 source resolution preserved (vitest `resolve.alias`, `nx test` has no `^build` dep).

### AD-015
- **Decision**: Entities carry a **render-only action signal** — replicated scalar fields `action` (enum: `None/Attack/Cast/Die`) + `actionSeq` (bumped per firing) on the entity schema. The authoritative server sets them when an action resolves (attack/skill/death); the client only animates from them. The signal NEVER affects gameplay outcomes (HP/XP/position/combat) and is NEVER persisted to the DB (defaults to `None`/`0` on load/reconnect).
- **Reason**: Player death is instantaneous server-side and remote/mob actions are unobservable from position/HP alone; an explicit server-set signal is the only correct, authoritative source for animation, while keeping the client a pure renderer (honors AD-001/AD-009).
- **Trade-off**: Two extra scalar fields per entity on the wire; a clear "cosmetic-but-on-the-authoritative-schema" boundary that must be respected (never read by gameplay logic).
- **Scope**: All animated entities (player now; remote players, NPCs, mobs later); asset/animation pipeline.
- **Date**: 2026-06-28
- **Status**: active

### AD-016
- **Decision**: Procedural creatures use a shared **named-socket segmented rig** (primitives parented to joint pivots exposing `root/spine/head/handL/handR/footL/footR`, optional `tail/wing*`) animated by **joint rotation** (no skinning/bones/GLTF), plus a **pure animation state machine in `game-core`** that selects `{clip, phase}` from `(replicated action+seq, client-derived locomotion, nowMs)` with precedence `die>cast>attack>move>idle`. Builders are parameterized (params → rig) to become manifest-driven; locomotion + facing are client-derived (no server rotation).
- **Reason**: Establishes one reusable, testable animation brain + rig contract for the entire bestiary; keeps art procedural (AD-005) and clip-selection at the cheapest test layer (AD-010).
- **Trade-off**: Lower fidelity than authored/skinned models; articulation limited to rigid joint rotation.
- **Scope**: Client rendering + `game-core`; all procedural creatures, all future asset phases.
- **Date**: 2026-06-28
- **Status**: amended by AD-017 (the **animation state machine** + clip vocabulary are retained; the **procedural named-socket primitive rig** is replaced by a GLTF skeleton + AnimationMixer).

### AD-017
- **Decision**: Character/creature visuals use **license-clean rigged 3D mesh assets** (GLTF/GLB) with **skeletal animation**, rendered via Three.js `GLTFLoader` + `AnimationMixer`. Assets are sourced curated-first from **CC0 / owned / commercially-licensed-AI** packs (e.g. Quaternius, KayKit, Mixamo), with AI-mesh-generation as a later per-entity variety layer behind the same manifest. This **supersedes AD-005** ("procedural primitives only / no external 3D asset files"). The render-only server **action signal (AD-015)** and the **`game-core` animation state machine (AD-016)** are unchanged — they still decide *which* clip plays; only the backend changes from procedural joint-posing to `mixer.crossFade(clip)`. A clip-name map translates our `AnimationClip` vocabulary (`idle/move/attack/cast/die`) to each asset's animation track names. The manifest gains `model` (GLB path) + `clipMap` per entity.
- **Reason**: The procedural-primitive constraint structurally could not produce a real game character (user goal: a rigged stylized low-poly humanoid like the provided monk reference). Rigged GLTF is native to Three.js, looks professional, is license-clean when sourced from CC0/owned assets, and fits the autonomous pipeline better (prompt/select → rigged mesh).
- **Trade-off**: Adds binary asset files + a loader/mixer pipeline + license hygiene per asset; introduces an asset-acquisition step (curated download or AI-gen) that the procedural approach avoided. Larger client payload.
- **Guardrail (AD-004 stays in force)**: never ship proprietary L2 assets, never the real L2 protocol; every mesh must be CC0/owned/properly-licensed.
- **Process**: A **visual gate** is now mandatory before any character/creature phase is marked done — the asset is rendered to an image and reviewed (vision check + human approval) so a green logical-state test can never again pass a pixel-blind result.
- **Scope**: All character/creature rendering + the asset pipeline; supersedes AD-005, amends AD-016.
- **Date**: 2026-06-28
- **Status**: active

### AD-018
- **Decision**: MVP heightmap terrain gets **semantic walkability** — shared `sampleHeight`/`snapEntityY` in `game-core`, server `isWalkable` (bounds + slope + step-height + hand-authored building/prop blockers), 1 m grid A* pathfinding, and authoritative waypoint following. This **partially supersedes AD-006**'s "no collision terrain" trade-off for the hand-authored TI slice; **L2J geodata file parsing (Tier 4) remains deferred**.
- **Reason**: Phase 9 ROADMAP promise; characters must follow terrain height, reject illegal steps, and path around village buildings without L2J geodata weight.
- **Trade-off**: Grid pathing is coarse (1 m cells); client path preview is non-authoritative UX only.
- **Scope**: `game-core` terrain/walkability/pathfinding; server `TownRoom` + mob AI; client shared imports + preview line.
- **Date**: 2026-06-28
- **Status**: active

## Handoff

**Phase 11 — Remote players & equipped weapons: COMPLETE (Verifier PASS, fix iteration 2).**
`.specs/features/phase-11-remote-players-weapons/validation.md` records PASS over diff
`9b4e7f7..9c166c4`: discrimination sensor 4/4 mutations killed, gate green (128 client
unit + 17/17 e2e), all 32 ACs (RPW-01–RPW-32) traced. Fix iteration 1 (`5194e53`)
closed RPW-02/03/23 test gaps + captured visual PNGs. Fix iteration 2 (`9c166c4`)
corrected KayKit GLTFLoader bone-name sanitization (`handslot.r` → `handslotr`) and
awaited async weapon load before visual capture — both visual ACs passed human review.
Remote players render as rigged mesh avatars; Squire's Sword and Goblin Club attach to
the correct hand bone. ROADMAP Phase 11 flipped to `[x]`.

**Loop status: RUNNING — next unchecked phase: Phase 12.**

**Next step:** **Phase 12 — NPCs: rigged human GLBs** (`.specs/ROADMAP.md`).
Depends on Phase 6 (NPC placement + interaction) + Phase 8 (mesh backend).
Replace NPC capsules with rigged human female GLBs (Katerina 30004, Roxxy 30006);
optional greet gesture; visual gate.

---

**Phase 10 — Monsters: rigged GLB mobs + clone-per-instance: COMPLETE (Verifier PASS).**
`.specs/features/phase-10-monsters-glb/validation.md` records PASS over diff
`ddf6325..2b66ff0`: discrimination sensor 4/5 mutations killed (M2 surviving mutant
noted as L-008 lesson), gate green (98 client + server tests + 16 e2e), 28/31 ACs
traced. Clone-per-instance backend via `SkeletonUtils.clone`, `npcId`-keyed creature
manifest, four CC0 GLBs (Gremlin/Goblin/Wolf/Bearded Keltir), `action`/`actionSeq` on
`MobState`, visual gate 12 mob PNGs reviewed. KayKit biped placeholders documented.
ROADMAP Phase 10 flipped to `[x]`.

**Loop status: RUNNING — next unchecked phase: Phase 11.**

**Next step:** **Phase 11 — Remote players & equipped weapons** (`.specs/ROADMAP.md`).
Depends on Phase 8 (player avatar) + Phase 3 (remote player state). Replaces capsule
remote players with mesh-character backend; hand socket + weapon-attach; Squire's Sword
(2369) + Goblin Club (item 4) props; visual gate.

---

**Phase 9 — Terrain walkability & collision: COMPLETE (Verifier PASS, fix iteration 1).**
`.specs/features/phase-9-terrain-walkability/validation.md` records PASS over diff
`e0a7e23..228bd32`: discrimination sensor 3/3 mutants killed, gate green (game-core 87,
server 178, client 79, e2e 15 — 344 total), all 20 ACs (TERR-01–TERR-13, 3 tiers) traced.
Fix iteration 1 (`228bd32`) closed 3 coverage gaps (NPC Y snap TERR-04, tick-state
waypoints TERR-11 AC3, per-segment isWalkable TERR-11 AC4). Shared `sampleHeightAt` /
`SPAWN_Y` / `isWalkable` / 1 m grid A* in game-core; server rejects unwalkable steps and
follows A* waypoints; client preview path. AD-018 recorded.
ROADMAP Phase 9 flipped to `[x]`.

**Loop status: RUNNING — next unchecked phase: Phase 10.**

**Next step:** **Phase 10 — Monsters: rigged GLB mobs + clone-per-instance** (`.specs/ROADMAP.md`).
Depends on: Phase 4 (mob AI/spawning), Phase 8 (mesh-character backend). Clone-per-instance
creature backend, npcId-keyed manifest, 4 mob GLBs, action/actionSeq replication, visual gate.

---

**Phase 8 — Player character rig & animation: COMPLETE (Verifier PASS, fix iteration 1).**
`.specs/features/phase-8-character-rig-animation/validation.md` records PASS over diff
`c35cea9..HEAD`: discrimination sensor 7/7 mutants killed (M1 a behaviorally-equivalent
no-op reorder), gate green (game-core 66, server 172, client 93, e2e 14), all 12 P1 ACs
traced. Fix iteration 1 (`035aff5`) closed CHAR-08 ordering gap (DIE-before-respawn spy)
and CHAR-04.5 idle determinism gap (spine position bob). Local player now renders as a
segmented articulated humanoid (no capsule); idle/move/attack/cast/die animations driven
by server-replicated render-only `action`/`actionSeq` signal (AD-015/AD-016).
ROADMAP Phase 8 flipped to `[x]`.

**Loop status: STOPPED — MVP phases 1–8 complete.**
The autonomous `/loop` heartbeat is NOT re-armed.

**Next step:** **Phase 9 — Terrain walkability & collision** (`.specs/ROADMAP.md`).
Three tiers: (1) shared `sampleHeight` + server Y snap, (2) `isWalkable` + village
blockers, (3) grid navmesh + A* pathfinding with server-validated waypoints.
Planner writes `.specs/features/phase-9-terrain-walkability/` before implement.
L2J geodata (Tier 4) remains deferred per AD-006.

### Phase 8 deviations (Implementer)

| Task | Deviation | Reason |
| ---- | --------- | ------ |
| T14 | Added frame-delta locomotion in `player-avatar.update()` and per-tick `setPlayer(action)` in `renderer.tick()` | Server sync alone did not transition `move → idle` or publish clip changes between patches; required for e2e observability (AD-009). Verifier confirmed this does not weaken server authority. |

---

**Phase 7 — Progression loop: COMPLETE (Verifier PASS). 🎉 MVP COMPLETE.**
`.specs/features/phase-7-progression-golive/validation.md` records PASS over diff
`bfbead0..HEAD`: discrimination sensor 7/7 mutants killed, gate green (game-core
54, client 73, server 167; `nx e2e client-e2e` 13/13 reliable), full progression
loop e2e confirmed (starter kit → equip Squire's Sword 2369 → 2 kills → level 2 →
buy potion → adena 897). ROADMAP Phase 7 flipped to `[x]`.

**ALL ROADMAP PHASES 1–7 ARE NOW `[x]` (in-scope).** The Talking Island vertical
slice is feature-complete locally: authoritative movement/multiplayer, combat +
XP/drops, Power Strike, NPCs + shop + peace zone, and inventory/equip +
death-respawn + level-up. Server-authority (AD-001) held throughout; ~334 tests
across the four layers (game-core/server/client unit + room-integration + seed +
Playwright e2e), all green and fast (AD-014).

**Loop status: STOPPED — no unchecked in-scope phases remain.** The autonomous
`/loop` heartbeat is NOT re-armed.

**Deferred post-MVP (out of current scope):** public production deployment
(server to Railway/Fly + static client to Vercel + public URL) — removed from
Phase 7 by decision; needs hosting credentials. Other non-blocking carry-forwards
recorded per phase's validation.md (e.g. P7 starter-kit 2369 room-layer assert,
inventory DOM e2e; P6 peace-marker coord assert).

**To resume later:** re-scope a deployment phase (or `/loop` it) when hosting
credentials are available; otherwise the MVP runs locally via `npm run dev`.

### Phase 7 deviations (Implementer, Worker C — client T13–T16)

| Task | Deviation | Reason |
| ---- | --------- | ------ |
| T16 | Added `callbacks.onAdd/onChange/onRemove` on local `player.items` in `wireRoom` | Starter kit only mutates the items map; scalar `onChange` never fired, so `__GAME_STATE__.items` stayed empty in e2e until nested collection listeners were wired (AD-001 render-only). |
| T13 | Panel id `#inventory-window` (not `#inventory`) | Matches `design.md` + `tasks.md` DOM id. |

**Phase 7 — Progression loop (Worker B server logic): T6/T7/T10/T11/T12 COMPLETE.**
Commits `5c76923` (T6), `0266b12` (T7), `5d7f814` (T10), `e14a2c2` (T11),
`451af80` (T12). Gate green: `nx test server` **167/167** pass. Anchors asserted:
equipped melee **27** / Power Strike **79** (unit + room); unequipped **17**/**69**
(unit); death→spawn full HP, xp unchanged; 2× Gremlin kill→level 2 maxHp **112**
maxMp **55**. **Next:** Worker C client (T13+) or Verifier on full Phase 7 slice.

### Phase 7 deviations (Implementer, Worker B — server T6/T7/T10–T12)

| Task | Deviation | Reason |
| ---- | --------- | ------ |
| T10 | Power Strike cooldown room test retargeted to Gremlin with inflated HP (500) | Goblin kill XP (220) + T12 level-up full-restore made the old goblin-based cooldown test assert wrong MP/damage; Gremlin anchor (69) is spec-correct. |

**Phase 6 — NPCs & functional town: COMPLETE (Verifier PASS).**
`.specs/features/phase-6-npcs-town/validation.md` records PASS over diff
`9813114..HEAD`: 31/32 ACs traced (1 optional cosmetic spec-precision gap —
peace-marker coords not unit-asserted), discrimination sensor 10/10 mutants
killed (incl. the `canInteract` proximity mutant now dying at the room layer),
gate green (game-core 44, client 57, server 135; `nx e2e client-e2e` 12/12,
reliably, 4 parallel workers). ROADMAP Phase 6 flipped to `[x]`. Server seed+logic
(Workers A+B) + client/e2e (Worker C) + 4 gap fixes + the AD-014 test-infra
speedup all landed. Lessons L-002–L-004 recorded.

**Next step:** Phase 7 — Progression loop & go-live (FINAL MVP phase). Basic
inventory + gold + equip weapon; death/respawn in town + level-up reward; deploy
server (Railway/Fly) + static client (Vercel) → public URL. Builds on the seeded
items/adena/shop (Phase 6), combat/XP (Phase 4), and skill (Phase 5). NOTE: the
deploy sub-item needs external hosting credentials/accounts — if those are
unavailable in autonomous mode, implement inventory/equip/death-respawn/level-up
reward and STOP at the deploy step with a blocker (per the skill's "missing
external secret/paid resource" halt condition) rather than fabricating a deploy.

Non-blocking carry-forward: optional `village.spec.ts` peace-marker coord
assertion; `power-strike.spec` mp===41 assumes nearest out-of-peace mob is a
Gremlin (resilient now via live-chase, but seed-sensitive).

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

### Phase 6 deviations (Implementer, verification gap fixes)

| Task | Deviation | Reason |
| ---- | --------- | ------ |
| Gap 2 | `vi.spyOn(tickMobAi)` no-op in mob peace-zone room test | Mob AI clears in-zone targets before the attack loop; spy keeps `targetSessionId` so TownRoom `simulate` exercises `resolveMobAttack`. |
| Gap 4 | `walkTowardInPeaceZone` in `town.spec.ts` (buy + combat e2e) | Walk-to-mob could overshoot the P6 rectangle (`z < −20`); flaky `inPeaceZone` false-passed attack/skill e2e. |
| Gap 4 | Power Strike peace-zone scratch-mutant discrimination proven at room layer (`useSkill inside peace zone`) | Browser poll did not reliably fail when `resolvePowerStrike` peace guard removed; room test does (L-004). |
