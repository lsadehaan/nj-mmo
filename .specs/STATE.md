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
- **Decision**: Locked stack — TS 6 / Node 22+ (machine v24); Nx 23.0.1 (`@nx/node`, `@nx/vite`); server: colyseus 0.17.10 + `@colyseus/schema` 4.0.26 + `@colyseus/tools` 0.17.19 (dev runner `tsx`); client: three 0.185.0 (Vite-bundled, not CDN) + `@colyseus/sdk` 0.17.43 + Vite 8.1.0; DB: better-sqlite3 12.11.1 + Drizzle ORM 0.45.2 + drizzle-kit 0.31.10 (SQLite now, Postgres-ready); seed: fast-xml-parser 5.9.3; tests: Vitest 4.1.9 + `@colyseus/testing` 0.17.11; visual tooling: `@playwright/test` 1.61.1 (shoot scripts only, not in gate).
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
- **Decision**: The client publishes a `window.__GAME_STATE__` test hook (`{ connected, ready, player:{x,y,z} }`); client unit tests assert DOM + this hook via Vitest/jsdom and `wireRoom` specs.
- **Reason**: Observable client wiring without a browser test runner in the gate.
- **Trade-off**: Test hook is shipped client code (guard behind a flag if needed later).
- **Scope**: Client unit tests, all phases.
- **Date**: 2026-06-27
- **Status**: active

### AD-010
- **Decision**: Three test layers (unit/Vitest, room integration/`@colyseus/testing`, seed-data/Vitest); randomness runs through an injected seeded RNG; the gate (test runner) decides "done"; use `nx affected` + Nx caching, never disabling cache to force a pass. Gate commands: Quick = `nx test server`/`nx test client`; Full = `nx run-many -t build lint test`.
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
- **Decision**: Test-infrastructure performance + determinism contract. Room-integration tests run with `NJ_AUTOSIM=0` so `TownRoom` starts no background simulation interval; tests advance the world by calling `simulate()` directly (synchronous `tick()` helper) and await real message delivery via `room.waitForMessage` (`deliver()` helper) before processing — no wall-clock tick sleeps, no transport/tick races. Production is unchanged (auto-simulates at 50 ms with the real measured delta).
- **Reason**: `nx test server` was ~9 s (one file, `TownRoom.spec`, was ~7.8 s of it) because `@colyseus/testing`'s `waitForNextSimulationTick` is a `setTimeout(interval)` and the room ticked every 50 ms (~150 serialized sleeps).
- **Trade-off**: Tests reach into the room (`simulate`, message helpers).
- **Scope**: All server room-integration tests.
- **Date**: 2026-06-27
- **Status**: active
- **Result**: `nx test server` ~9.2 s → ~2.3 s; full `nx run-many -t build lint test` ~15.5 s → ~11 s. L-001 source resolution preserved (vitest `resolve.alias`, `nx test` has no `^build` dep).

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

### AD-019
- **Decision**: Procedural texture detail on top of flat-shaded low-poly geometry uses `THREE.DataTexture` from a seeded pixel buffer — never Canvas 2D, never an external texture file — because jsdom (AD-009) has no real 2D canvas context and AD-010 requires deterministic seeded randomness. Shadow-casting lights that must cover a world larger than their fixed shadow-camera frustum re-center on the local player using the existing render-distance-based move-culling threshold, rather than a fixed-at-origin frustum or expensive per-frame cascades.
- **Reason**: jsdom's lack of a real `<canvas>` 2D context (AD-009) rules out Canvas 2D for the ground texture without a native `canvas` npm dependency; `DataTexture` sidesteps that while staying deterministic (AD-010). A single fixed-at-origin shadow frustum would only cover the village, not the 80 m mob-render radius everywhere the player roams the 640 m world.
- **Trade-off**: Single shadow cascade only (no cascaded shadow maps for very long view distances) — acceptable since `MOB_RENDER_DISTANCE` already bounds the visible world to 80 m; the frustum-follow re-center adds a small per-move-threshold check (reuses the existing mob-culling distance computation, no duplicate math).
- **Scope**: Client rendering, all future terrain/prop texture and shadow-casting-light work.
- **Date**: 2026-07-01
- **Status**: active

## Handoff

**Phase 30 — Visual fidelity upgrade: COMPLETE (independent Verifier PASS, 2026-07-01).**
`.specs/features/visual-fidelity-upgrade/validation.md` records the outcome:
14/14 ACs (VFU-01–14) spec-anchored with `file:line` evidence, 0
spec-precision gaps, discrimination sensor 3/3 mutations killed, gate green
(`nx test client` 414 → 438 tests / 87 → 88 files, fresh non-cached run).
Real shadows (soft PCF shadow map, sun `castShadow` + frustum-follow on the
local player), antialiasing + ACES filmic tonemapping + sRGB output color
space, a barely-there world-edge `THREE.Fog`, and a procedural seeded
`DataTexture` grass texture (with terrain `uv` attribute + `RepeatWrapping`
tiling) replacing the flat terrain color. `receiveShadow` added across the
terrain, static-prop GLB/instanced-scatter pipeline, and all four
primitive-fallback builders (also fixed a pre-existing dead-code bug where
`buildLandmarkScene`'s primitive fallback was unreachable because
`loadGltfStaticTemplate` rejects rather than resolving falsy on load
failure — independently re-confirmed necessary by the Verifier). Verifier
independently re-confirmed both `server:build`/`client:build:production`
gate failures are pre-existing (baseline worktree at `6f6d53c`), unrelated
to this feature. AD-019 recorded above. ROADMAP Phase 30 flipped to `[x]`.
Commits `21b1dd3..64e4697`.

**Loop status: STOPPED — ALL ROADMAP PHASES (1–29) COMPLETE.**

**Phase 29 — Audio & world ambience: COMPLETE (Verifier PASS, 2026-06-29).**
48/48 ACs, gate 388 client audio tests. Injectable backend, zone music/ambient, combat/UI SFX, volume controls, `__GAME_STATE__.audio`.

**Phase 28 — UI/UX client shell: COMPLETE (Verifier PASS, fix iteration 1, 2026-06-29).**
60/60 ACs, gate 1102 tests. Login/character select, window manager, inventory grid, skill/quest/party UI, minimap/world map, buff bars, system menu, ToT.

**Phase 27 — Progression rules & PvP: COMPLETE (Verifier PASS, fix iteration 1, 2026-06-29).**
48/48 ACs, gate 878 tests. Death XP loss, Biotin restore, SP economy, stat re-spec, PvP/karma, player combat. Merged `feat/phase-27-progression-pvp`.

**Phase 26 — Social & multiplayer systems: COMPLETE (Verifier PASS, fix iteration 2, 2026-06-29).**
42/42 ACs, gate 992 tests, party +28 XP + trade + friends. Merged `feat/phase-26-social`.

**Phase 25 — Items, economy & crafting: COMPLETE (Verifier PASS, fix iteration 2, 2026-06-29).**
52/52 ACs (ITEM25-13 Silvia 13-row SPEC_DEVIATION), sensor 3/3, gate green.
11 equip slots, ~87 TI items, crafting, safe +3 enchant, set bonuses. Merged `feat/phase-25-items-economy`.

**Phase 24 — Town services & full NPC roster: COMPLETE (Verifier PASS, fix iteration 1, 2026-06-29).**
`.specs/features/phase-24-town-services/validation.md` PASS: 50/50 ACs, sensor 3/3, gate 866 + visual 64/64.
25 TI NPCs, warehouse, Roxxy teleports, Bitz/Biotin class transfer, folk trainers, guards.
Branch `phase-24-town-services` merged. ROADMAP Phase 24 `[x]`.

**Phase 23 — Full Talking Island world & zones: COMPLETE (Verifier PASS, 2026-06-29).**
`.specs/features/phase-23-ti-world/validation.md` records PASS: 50/50 ACs (TIW23-38 indirect only),
sensor 3/3 killed, gate 790 tests + visual 50/50. 640m world, 6 named zones, L2J territory
spawns (613 rows), landmark GLBs, `zoneId` replication + `__GAME_STATE__.zone`. Branch
`feat/phase-23-ti-world` merged at `5ffc550`. ROADMAP Phase 23 flipped to `[x]`.

**Phase 22 — Complete TI bestiary: COMPLETE (Verifier PASS, fix iteration 1, 2026-06-29).**
`.specs/features/phase-22-ti-bestiary/validation.md` records PASS: 55/55 ACs (4 non-blocking
fixture drift notes), sensor 3/3 killed, gate 565 tests + visual 44/44. 14 new mobs seeded
(23 total TI_MOB_IDS); Orc Archer ranged AI; werewolf clan assist; 14 GLBs + manifest. Fix:
Phase 22 LICENSE attributions `9726d57`. ROADMAP Phase 22 flipped to `[x]`.

**Phase 21 — Quests & tutorial: COMPLETE (Verifier PASS, fix iteration 2, 2026-06-29).**
`.specs/features/phase-21-quests/validation.md` records PASS: 48/48 ACs traced (AC 36 Nerkas
spawn deferred), sensor 3/3 killed, gate stable 691 tests. 17 TI quests seeded; quest engine
in game-core; TownRoom quest handlers; quest log + markers + dialog; room anchors green after
flake fix `465b53b`. ROADMAP Phase 21 flipped to `[x]`.

**Phase 20 — Skills & combat depth: COMPLETE (Verifier PASS, fix iteration 1, 2026-06-29).**
`.specs/features/phase-20-skills-combat/validation.md` records PASS: 52/52 ACs traced (4 non-blocking
partials), discrimination sensor 4/4 killed, gate green (659 tests). TI skill subset seeded;
learnSkill at trainers; generalized resolver; soulshots/spiritshots; magic cast + interrupt;
Might/Curse Weakness effects; dynamic hotbar + cast bar. Fix: mAtk gating for magic-only + gap tests.
ROADMAP Phase 20 flipped to `[x]`.

**Phase 19 — Character creation & classes: COMPLETE (Verifier PASS, 2026-06-29).**
`.specs/features/phase-19-character-creation/validation.md` records PASS (0 fix iterations):
37/37 ACs traced (CHAR19-31 KayKit-pack GLB sharing documented deviation), discrimination
sensor 3/3 killed, gate green (game-core 117, server 235, client 251, visual 30/30).
Nine starter classes seeded from L2J; character creation UI; class-based stats/combat/vitals;
per-class player manifest avatars; `classId`/`sex` on PlayerState + `__GAME_STATE__`.
ROADMAP Phase 19 flipped to `[x]`.

**Post-MVP track (Phases 19–29):** Complete Talking Island locally — character
creation, skills, quests, full bestiary, expanded world, town services, economy,
social, PvP rules, UI shell, audio. **Public deployment explicitly out of scope.**

**Test gate:** Vitest only — unit (server + client), room integration, seed/data.
Playwright / `client-e2e` removed per AGENTS.md.

**Phase 18 — Consumable item use (Healing Potion): COMPLETE (Verifier PASS, 2026-06-28).**
`.specs/features/phase-18-consumable-use/validation.md` records PASS after 1 fix iteration:
27/27 ACs traced, 4/4 discrimination sensors killed, gate green (game-core 110, server 220,
client 238, e2e consumable-use 2/2 in 27 s). Single 24 HP grant (skill 2031: 8×3), 10 s
reuse cooldown, `useItem` intent, inventory Use button, `__useItem__` test hook.
Fix iteration: build type error in `test-hook.ts` + e2e browser-closure serialization.
ROADMAP Phase 18 flipped to `[x]`.

**Loop status (superseded): STOPPED — ALL ROADMAP PHASES COMPLETE.**
*Replaced by Post-MVP Phases 19–29 in `.specs/ROADMAP.md`.*

**Phase 17 — Talking Island NPC expansion (+5): COMPLETE (Verifier PASS, 2026-06-28).**
`.specs/features/phase-17-ti-npc-expansion/validation.md` records PASS: 35/35 ACs traced,
4/4 discrimination sensors killed, gate green (server 210, client 232, game-core 101, visual
30/30, e2e phase-17 2/2). Five new NPCs seeded: Lector (30001, weapons), Jackson (30002, armor),
Silvia (30003, accessories), Wilford (30005, warehouse stub), Bitz (30026, trainer stub).
npcId-keyed shop routing, distinct GLBs, TINPC-21 screenshots captured. Two pre-existing e2e
flakes (power-strike, ti-mob-expansion) outside Phase 17 scope. ROADMAP Phase 17 flipped `[x]`.

**Loop status: RUNNING — next unchecked phase: Phase 18.**

**Next step:** **Phase 18 — Consumable item use (Healing Potion)** (`.specs/ROADMAP.md`).
Server `useItem` intent, HoT/instant heal anchored to skill 2031 (power 8 × ticks 3 = 24 HP),
10 s reuse cooldown, inventory Use button, room-integration + e2e assertions.

**Phase 16 — Talking Island mob expansion (+5): COMPLETE (Verifier PASS, 2026-06-28).**
`.specs/features/phase-16-ti-mob-expansion/validation.md` records PASS: 30/32 ACs traced
(TIMOB-28/29 e2e deferred), discrimination sensor 3/4 mutations killed (M2 survival noted as
lesson — fault coords ineffective vs peace-zone x-axis), gate green (server 198, client 220,
game-core 87, visual 25/25). Five new TI mobs seeded with authentic Classic stats + drops:
Elpy (20432), Elder Keltir (20544), Elder Wolf (20442), Giant Toad (20121), Orc (20130).
Canonical 23 spawn rows; ring-progression ordering validated. ROADMAP Phase 16 flipped to `[x]`.

**Loop status: RUNNING — next unchecked phase: Phase 17.**

**Next step:** **Phase 17 — Talking Island NPC expansion (+5)** (`.specs/ROADMAP.md`).
Five town NPCs: Lector (30001, Weapon Merchant), Jackson (30002, Armor Merchant),
Silvia (30003, Accessory Merchant), Wilford (30005, Warehouse), Bitz (30026, Fighter Trainer).
Seed + buylists + rigged GLBs + shop/dialog wiring + visual gate.

**Phase 10 + Phase 15 — Asset fidelity fixes applied (2026-06-28).**
`scripts/visual-gate.mjs` had reported 17 FAILs: all environment props were byte-identical
copies of character/NPC GLBs (Mage→Building, Wolf→Tree, Keltir→Rock, Roxxy→Building,
GoblinClub→PeaceMarker), and Gremlin/Goblin were copies of Mage/Barbarian.
Fix: procedurally generated all affected GLBs using `scripts/gen-glb-assets.py` (pygltflib):
- **Env props** (Building_0–4, Tree, Rock, PeaceMarker): pure static meshes with no skeleton,
  no animations, and no creature-bone node names.  Box+wedge buildings (5 variants with varied
  proportions), two-tier cone tree, three-box rock cluster, golden pillar marker.
- **Monster bipeds** (Gremlin, Goblin): 7-joint biped skeleton, 4 animation clips (Idle, Walk,
  Attack, Death), distinct colors (lime-green Gremlin, dark-olive Goblin).
  `creature-manifest.ts` updated to use `PROCEDURAL_BIPED_CLIP_MAP` (Idle/Walk/Attack/Death).
`visual-gate.mjs` now reports **20/20 PASS — 0 FAIL**.
LICENSE.txt files updated with REPLACE-BEFORE-LAUNCH notes (AD-004).

**Phase 15 — Environment art upgrade: COMPLETE (Verifier PASS, fix iteration 1).**
`.specs/features/phase-15-environment-art/validation.md` records PASS over diff
`2a76eb3..b8aaa0a`: discrimination sensor 4/4 mutations killed, gate green (212 client
unit + 21/21 e2e), all 22 ACs (ENV-01–22) traced. Fix iteration 1 (`b8aaa0a`) closed
ENV-11 scatter (x,z) coordinate assertions (surviving +10 m x-offset mutant). Village
buildings, trees, rocks, and peace marker render as cached static GLBs with
`InstancedMesh` scatter; `__GAME_STATE__.environment` observability; town-overview
visual gate PNG. Placeholder GLBs documented in LICENSE.txt for pre-launch CC0 swap.
ROADMAP Phase 15 flipped to `[x]`.

**ALL ROADMAP PHASES 9–15 COMPLETE. FULL ROADMAP NOW `[x]`.**

**Loop status: STOPPED — all ROADMAP phases (1–15) complete. No more unchecked items.**
The autonomous `/loop` heartbeat is NOT re-armed.

**Total test counts (final):** game-core 87, server 178, client 212, e2e 21.
All Verifier PASSes recorded in `.specs/features/*/validation.md`.

---

**Phase 14 — UI / 2D iconography: COMPLETE (Verifier PASS, first try).**
`.specs/features/phase-14-ui-icons/validation.md` records PASS: discrimination sensor
4/4 mutations killed, gate green (194 client unit + 20/20 e2e), 31/32 ACs traced
(ICON-32 shop re-render non-blocking). Power Strike icon in hotbar/cooldown, item icons
(57/17/1060/1835/2369) in shop + inventory, P3 loot-table icons all included. Geometric
owned placeholders documented in ATTRIBUTION.md for pre-launch CC0 swap (AD-004).
ROADMAP Phase 14 flipped to `[x]`.

**Loop status: RUNNING — next unchecked phase: Phase 15.**

**Next step:** **Phase 15 — Environment art upgrade (optional)** (`.specs/ROADMAP.md`).
Lowest priority — replace village buildings, trees, rocks, and peace-zone marker with
cohesive low-poly GLB props instead of raw primitives. Visual gate mandatory per AD-017.

---

**Phase 13 — Combat & world VFX: COMPLETE (Verifier PASS, fix iteration 1).**
`.specs/features/phase-13-combat-vfx/validation.md` records PASS over diff
`e58607f..6d64e4f`: discrimination sensor 3/3 mutations killed, gate green (175 client
unit + 20/20 e2e), all 39 ACs (CVFX-01–39) traced. Fix iteration 1 (`6d64e4f`)
closed CVFX-11/15/16/27/30/07 test-coverage gaps (player melee-hit, mob/player
dissolve attach, dead-mob ring hide, renderer tick integration). Power Strike VFX,
melee hit pool, death dissolve, level-up burst, target ring, optional soulshot/loot
puff all implemented and visual-gate verified. ROADMAP Phase 13 flipped to `[x]`.

**Loop status: RUNNING — next unchecked phase: Phase 14.**

**Next step:** **Phase 14 — UI / 2D iconography** (`.specs/ROADMAP.md`).
Power Strike skill icon in hotbar; shop/inventory item icons for Healing Potion (1060),
Soulshot No-grade (1835), Wooden Arrow (17), Squire's Sword (2369), Adena (57);
optional lower-priority loot-table icons.

---

**Phase 12 — NPCs: rigged human GLBs: COMPLETE (Verifier PASS, fix iteration 1).**
`.specs/features/phase-12-npcs-glb/validation.md` records PASS over diff
`117e265..ecf0327`: discrimination sensor 5/7 mutations killed (2 non-blocking
survived), gate green (143 client unit + 19/19 e2e), all 23 ACs (NPCG-01–23) traced.
Fix iteration 1 (`ecf0327`) closed NPCG-08 fallback test, NPCG-09 update-spy, NPCG-20
debounce-strength gaps. Katerina (KayKit Mage) and Roxxy (Quaternius CC0 woman) render
as rigged mesh NPCs with idle loops and greet gesture on interaction. Visual gate PNGs
confirm distinct silhouettes. ROADMAP Phase 12 flipped to `[x]`.

**Loop status: RUNNING — next unchecked phase: Phase 13.**

**Next step:** **Phase 13 — Combat & world VFX** (`.specs/ROADMAP.md`).
Depends on Phases 4–5 (combat + skill) and Phase 10 (mobs). Replace placeholder
primitives with Power Strike VFX, melee hit/impact, death dissolve, level-up burst,
target selection ring, and optional soulshot/loot-drop markers. Visual gate mandatory.

---

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
