# LESSONS — auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation — do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 — Add an explicit vitest resolve alias to shared lib source; tsconfig paths alone do not override Nx vitest when dist output exists.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `nx/vitest/shared-libs` · harmful: 0
- features: phase-3-authoritative-server
- evidence: tsconfig.base.json + server/vitest.config.ts — vitest still resolves dist when present (nx/vitest/shared-libs)
- last seen: 2026-06-27T16:12:01Z

### L-002 — Room-integration Colyseus tests must await settleRoomMessages (or waitForNextSimulationTick) after client.send before asserting server-mutated state; immediate reads false-pass proximity and economy rejects.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `server/room-integration` · harmful: 0
- features: phase-6-npcs-town
- evidence: TownRoom.spec.ts:907 / mutant proximity-canInteract-true (server/room-integration)
- last seen: 2026-06-27T19:55:09Z

### L-003 — When spec assigns room-integration to a behavior, unit-only proof of the same outcome is a coverage gap—add a TownRoom test that exercises the full message path.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `server/room-integration` · harmful: 0
- features: phase-6-npcs-town
- evidence: P6-R04-AC5 / spec.md (server/room-integration)
- last seen: 2026-06-27T19:55:09Z

### L-005 — Discover the real hand bone name from each rig GLB before caching it in the weapon manifest; never assume KayKit bipeds share handslot.r without ingest verification.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `client/scene/creature` · harmful: 0
- features: phase-11-remote-players-weapons
- evidence: RPW-32 /tmp/char-shots/mob-20003-attack.png (client/scene/creature)
- last seen: 2026-06-28T17:49:40Z

### L-006 — Visual-gate lab modes that attach async props must await weapon load before setting __SHOT_READY__ and capturing frames.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `client/character-lab` · harmful: 0
- features: phase-11-remote-players-weapons
- evidence: RPW-31 /tmp/char-shots/dual-weapon-2369-idle.png (client/character-lab)
- last seen: 2026-06-28T17:49:40Z

### L-007 — When GLB load failure falls back to a capsule mesh, unit-test the rejected ready promise path—not only the happy mesh path.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `client/scene` · harmful: 0
- features: phase-12-npcs-glb
- evidence: NPCG-08 (client/scene)
- last seen: 2026-06-28T18:23:38Z

### L-008 — Avatar tick tests must spy on mesh.update(dt) and assert it is called each frame, not only the returned clip label.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `client/scene` · harmful: 0
- features: phase-12-npcs-glb
- evidence: M2 npc-avatar.ts:99 (client/scene)
- last seen: 2026-06-28T18:23:38Z

### L-009 — Debounce tests must assert the guarded side effect does not repeat (epoch counter, facing, or seq), not only that the clip name stays the same.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `client/scene` · harmful: 0
- features: phase-12-npcs-glb
- evidence: M3 npc-avatar.ts:73 NPCG-20 (client/scene)
- last seen: 2026-06-28T18:23:38Z

### L-010 — Add unit tests for each VFX trigger call site (player HP, die dissolve attach, dead-target ring, renderer tick) — shared detector tests alone do not satisfy wiring ACs.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `client/vfx` · harmful: 0
- features: phase-13-combat-vfx
- evidence: CVFX-11,CVFX-15,CVFX-16,CVFX-27,CVFX-30 (client/vfx)
- last seen: 2026-06-28T18:52:58Z

### L-011 — When spec requires placement coordinates, assert world x/z per placement—not just prop count.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `client/scene environment-renderer` · harmful: 0
- features: phase-15-environment-art
- evidence: ENV-11 | environment-renderer.ts:190 x+10 mutant (client/scene environment-renderer)
- last seen: 2026-06-28T19:42:27Z

### L-012 — When a GameStatePlayerInput field is optional with a default in setPlayer, Omit it from the base type before re-adding as optional — intersection does not relax required fields.
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `client/test-hook` · harmful: 0
- features: phase-18-consumable-use
- evidence: client/src/test-hook.ts:GameStatePlayerInput (client/test-hook)
- last seen: 2026-06-29T02:39:43Z

### L-014 — Document test-hook cooldown remaining fields on the player sub-object in AC text when mirroring powerStrikeCooldownRemainingMs — root-level __GAME_STATE__ paths mislead implementers.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `spec/client` · harmful: 0
- features: phase-18-consumable-use
- evidence: CONS-25 (spec/client)
- last seen: 2026-06-29T02:39:49Z

### L-015 — Room-integration tests must reject useSkill when the skill is not in knownSkillIds so learned-skill gates cannot regress silently
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `server/room-integration` · harmful: 0
- features: phase-20-skills-combat
- evidence: combat-resolver.ts:120 | sensor mut4 (server/room-integration)
- last seen: 2026-06-29T22:07:24Z

### L-016 — When tasks.md maps a block of room ACs to one task, verify each AC has its own named test before Done — helper shortcuts do not satisfy evidence-or-zero.
- signal: `ac_gap` · recurrence: 1 feature(s) · harmful: 0
- features: phase-21-quests
- evidence: QUEST21-15,19,20,22,28,30,33-35,37
- last seen: 2026-06-29T22:39:42Z

### L-017 — When deferring spawn mechanics (e.g. Nerkas), document SPEC_DEVIATION and still assert the player-visible turn-in outcome, not only the pure kill hook.
- signal: `spec_deviation` · recurrence: 1 feature(s) · harmful: 0
- features: phase-21-quests
- evidence: QUEST21-36 / quest-handlers.ts
- last seen: 2026-06-29T22:39:42Z

### L-018 — Room-integration quest tests that share one Colyseus boot must not rely on prior test side effects; isolate state per case or split the block so nx/vitest file workers cannot race interact delivery.
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `server/room-tests` · harmful: 0
- features: phase-21-quests
- evidence: TownRoom.spec.ts TownRoom quests block — quest 155/157 flake in full suite (server/room-tests)
- last seen: 2026-06-29T23:03:31Z

### L-019 — When vendoring new GLB assets, update the pack LICENSE.txt in the same commit as the binary — AD-004 requires source attribution before the phase gate passes.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `assets` · harmful: 0
- features: phase-22-ti-bestiary
- evidence: BEST22-41 — client/public/models/monsters/LICENSE.txt (assets)
- last seen: 2026-06-29T23:34:46Z

### L-020 — Seed test anchors must match the fixture XML values actually ingested — if the planner table diverges from L2J fixture, update the spec table before Execute, not at verify time.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `seed` · harmful: 0
- features: phase-22-ti-bestiary
- evidence: BEST22-09/12/13 — monsters.seeder.spec.ts vs spec.md anchor table (seed)
- last seen: 2026-06-29T23:34:50Z

### L-021 — Town-service ACs need explicit tests per NPC id and __GAME_STATE__ renderKind — generic trainer-range tests do not satisfy evidence-or-zero.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `validation` · harmful: 0
- features: phase-24-town-services
- evidence: validation.md (validation)
- last seen: 2026-06-30T01:43:26Z

### L-022 — When spec ACs declare test layer room, add TownRoom.spec.ts blocks — pure/unit tests do not satisfy evidence-or-zero even if handlers exist.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `server/src/rooms/TownRoom.spec.ts` · harmful: 0
- features: phase-25-items-economy
- evidence: ITEM25-19..24,31,37-39,43-44,51 (server/src/rooms/TownRoom.spec.ts)
- last seen: 2026-06-30T04:07:42Z

### L-023 — Silvia buylist L2J Classic 3000301.xml has 13 rows not 18/15 — update spec AC or fixture before weakening assertion to >=13.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `seed` · harmful: 0
- features: phase-25-items-economy
- evidence: ITEM25-13:merchant-items.seeder.spec.ts:50 (seed)
- last seen: 2026-06-30T04:07:43Z

## Quarantined (failed when applied — ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
