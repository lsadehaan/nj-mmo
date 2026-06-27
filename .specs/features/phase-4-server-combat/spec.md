# Phase 4 — Combat on the Server Specification

## Problem Statement

Phase 3 delivers server-authoritative movement and multiplayer presence, but
players cannot fight mobs, gain XP, or see enemies in the world. Phase 4 adds
the full server-authoritative melee combat loop for the Talking Island field:
mobs spawn from seeded L2J Classic data, players target and attack via intents,
the server resolves L2J melee formulas with seeded RNG, grants XP/level-up and
drops on kill, respawns mobs after death, and the client renders mobs with HP
bars from synced state only.

## Goals

- [ ] Melee damage, attack timing, and range use L2J Classic formulas translated
      to pure TypeScript in `libs/game-core`, with deterministic seeded RNG
      (AD-010).
- [ ] Mobs spawn from SQLite (`monsters`, `mob_drops`, `mob_spawns`) seeded from
      L2J XML fixtures; 11 hand-authored TI field spawn instances boot in
      `TownRoom`.
- [ ] Aggressive mobs aggro within range; passive mobs retaliate after damage;
      idle mobs wander near spawn.
- [ ] Player `setTarget` + `attack` intents are validated server-side; damage,
      death, XP, level-up, drops, and respawn are server outcomes only (AD-001).
- [ ] XP gained on kill persists to the `characters` table.
- [ ] Client renders mob meshes + HP bars from `state.mobs`; sends target/attack
      intents only; `window.__GAME_STATE__` exposes combat fields for tests
      (AD-009).
- [ ] Unit + room-integration + seed + e2e tests prove spec-anchored values at
      the declared layers (AGENTS.md four test layers).

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Skills, MP consumption, buffs/debuffs | Phase 5 |
| NPC shop, peace-zone enforcement | Phase 6 |
| Loot pickup / inventory UI | Phase 7 (`items` table FK deferred) |
| Client-side damage numbers or local HP authority | AD-001 |
| Mob mesh variety / authored models | AD-005 procedural capsules only |
| Geodata pathing / terrain collision for mobs | AD-006 |
| Multi-mob pull limits, party XP split | Post-MVP |
| Persisted drop loot / room loot map sync to client | Drops roll onto server-private `KillEvent` only this phase |

---

## Assumptions & Open Questions

The Planner cannot talk to the user; every ambiguity is resolved here.

| Assumption / decision | Chosen default | Rationale |
| --------------------- | -------------- | --------- |
| Starter Human Fighter L1 combat profile | `pAtk=10`, `pDef=55`, `attackSpeed=300`, `randomDamage=10`, `meleeRange=4.0` world units | `STARTER_COMBAT` in `libs/game-core`; worked examples anchor unit tests |
| Gremlin (npcId 20001) defender profile | `pDef=44.44444` (seeded L2J Classic) | Anchors damage **17** (RNG offset 0) and **15** (offset −10) |
| L2J melee damage formula | `max(1, floor(77 × pAtk × randomMod / pDef))` where `randomMod = 1 + rngOffset/100` | L2J `Formulas.calcPhysDam` melee path; `MELEE_WEAPON_MODIFIER = 77` |
| L2J attack interval | `max(50, floor(500000 / attackSpeed))` ms | L2J `Attackable.getAttackInterval`; **1666** ms @ speed 300 |
| L2 range → world metres | L2 range ÷ 10 (AD-013) | Goblin `aggroRange` 450 → **45** world units; player melee **4.0** m |
| Melee range test distances | 3.9 / 4.0 / 4.1 m → in / in / out | `isInMeleeRange` uses `<=` on horizontal XZ distance |
| XP model | **Cumulative** XP stored on character; level from seeded `experience` curve thresholds | `grantXp` adds to running total; level 2 at cumulative **88** (two Gremlin kills) |
| Gremlin kill XP | **+44** per kill (`monsters.exp`) | L2J `monsters.xml` for npcId 20001 |
| Goblin adena drop | item **57**, count **22** with seed **150338**, 70% chance, min 13 max 30 | `GOBLIN_ADENA_DROP_ROW` + `rollDrops` unit anchor |
| Aggro range (Goblin) | **45** world units (L2 450 ÷ 10) | `spawn-manager` converts template `aggroRange` |
| Passive retaliate | Gremlin sets `targetSessionId` to `lastAttackerSessionId` after `wasDamaged` | No proactive aggro when `isAggressive=false` |
| Respawn timer | **27 s** (`respawnSec` on spawn rows; parser default 27) | L2J Classic default respawn delay |
| Mob spawns | Hand-authored `mob_spawns.json` fixture (11 instances, local coords near-origin) | AD-006/AD-013; not parsed from L2J geodata |
| Drops visibility | Server-private — `KillEvent.drops` populated in resolver; **not** synced in schema or persisted | Inventory/loot UI deferred Phase 7 |
| Room combat RNG | `createSeededRng(hashRoomId(roomId))` per room; injectable in tests | AD-010 determinism |
| Injectable `nowMs` + `combatRng` in `TownRoom` options | Test harness only; production uses wall clock + room seed | Enables 27 s respawn assertions without waiting |
| E2E seed | `server/src/seed/cli.ts` runs before Playwright webServer; `data/game.db` not committed | Fresh DB with mob spawns for combat e2e |
| E2E workers | Playwright `workers: 1`, serial combat describe | Shared `town` room stability |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P4: Server-Authoritative Melee ⭐ MVP

**User Story**: As a player, when I attack a mob in melee range, the server
applies L2J damage formulas so outcomes cannot be cheated client-side.

**Acceptance Criteria**:

1. WHEN `calcMeleeDamage` is called with starter vs Gremlin and RNG offset **0**
   THEN damage SHALL be **17**. **Test layer: unit** (`melee-damage.spec.ts`)
2. WHEN the same pairing uses RNG offset **−10** THEN damage SHALL be **15**.
   **Test layer: unit** (`melee-damage.spec.ts`)
3. WHEN `calculateAttackIntervalMs(300)` is called THEN the interval SHALL be
   **1666** ms. **Test layer: unit** (`attack-timing.spec.ts`)
4. WHEN `isInMeleeRange` is evaluated at horizontal distances **3.9**, **4.0**,
   and **4.1** m (range **4.0**) THEN results SHALL be **true**, **true**,
   **false** respectively. **Test layer: unit** (`combat-range.spec.ts`)
5. WHEN a client sends in-range `"attack"` after `"setTarget"` THEN mob HP SHALL
   decrease by **17** (zero-offset RNG) and broadcast via `MobState`. **Test
   layer: room-integration** (`TownRoom.spec.ts`, `combat-resolver.spec.ts`)
6. WHEN `"attack"` is sent out of melee range THEN mob HP SHALL NOT change.
   **Test layer: room-integration** (`TownRoom.spec.ts`, `combat-resolver.spec.ts`)

**Edge cases** (listed; room tests deferred):

- Attack on dead target ignored
- Attack without target ignored
- Two players damaging same mob — damage sums
- Invalid `setTarget` mob id ignored

---

### P4: Mob Lifecycle ⭐ MVP

**User Story**: As a player, I see mobs in the field that aggro, fight back,
wander when idle, die, and respawn after a delay.

**Acceptance Criteria**:

1. WHEN `TownRoom` is created with a seeded combat DB THEN `state.mobs` SHALL
   contain **11** spawn instances. **Test layer: room-integration**
   (`TownRoom.spec.ts`, `spawn-manager.spec.ts`)
2. WHEN an aggressive Goblin is within **45** world units of a player THEN it
   SHALL acquire that player as `targetSessionId`. **Test layer: unit +
   room-integration** (`mob-ai.spec.ts`, `TownRoom.spec.ts`)
3. WHEN a passive Gremlin is damaged THEN it SHALL retaliate by targeting the
   attacker session. **Test layer: unit + room-integration** (`mob-ai.spec.ts`,
   `TownRoom.spec.ts`)
4. WHEN mob HP reaches 0 THEN the mob SHALL be removed from state and respawn
   after **27** s (absent at 26 999 ms, present at 27 000 ms with injectable
   clock). **Test layer: room-integration** (`TownRoom.spec.ts`)
5. WHEN a mob respawns THEN it SHALL appear at spawn coordinates with full HP
   **41.145** (Gremlin template). **Test layer: room-integration**
   (`TownRoom.spec.ts`)

**Edge cases** (listed; room tests deferred):

- Respawn while player still has mob targeted

---

### P4: XP, Level-Up, Drops ⭐ MVP

**User Story**: As a player, killing mobs grants XP, levels me up, and rolls
drops on the server.

**Acceptance Criteria**:

1. WHEN a player solo-kills one Gremlin THEN `xp` SHALL be **44** and `level`
   SHALL remain **1**. **Test layer: room-integration** (`TownRoom.spec.ts`)
2. WHEN the same player kills a second Gremlin THEN `xp` SHALL be **88** and
   `level` SHALL be **2**. **Test layer: room-integration** (`TownRoom.spec.ts`)
3. WHEN `grantXp(1, 0, 44, curve)` is called THEN result SHALL be
   `{ level: 1, xp: 44 }`. **Test layer: unit** (`experience.spec.ts`)
4. WHEN `grantXp(1, 44, 44, curve)` is called THEN result SHALL be
   `{ level: 2, xp: 88 }`. **Test layer: unit** (`experience.spec.ts`)
5. WHEN `rollDrops` runs Goblin adena row with seed **150338** THEN drops SHALL
   be `[{ itemId: 57, count: 22 }]`. **Test layer: unit** (`drop-roll.spec.ts`,
   `combat-resolver.spec.ts`)
6. WHEN a kill is processed THEN player XP SHALL persist to the `characters`
   table; drops SHALL populate server-private `KillEvent.drops` (no schema sync
   or room loot map). **Test layer: room-integration** — XP persist proven;
   drop loot map / room-integration Goblin drop assertion **partial**
   (`TownRoom.spec.ts` XP only)
7. WHEN Playwright kills a mob via test hooks THEN `player.xp` in
   `__GAME_STATE__` SHALL be **> 0**. **Test layer: e2e** (`combat.spec.ts`)

---

### P4: Client Presentation ⭐ MVP

**User Story**: As a player, I click a mob to target it, see server-driven HP
bars, and attack without the client mutating combat outcomes.

**Acceptance Criteria**:

1. WHEN the player targets a mob THEN `targetMobId` SHALL be set in
   `__GAME_STATE__` and mob HP SHALL come from server snapshots only (no local
   HP mutation). **Test layer: e2e + unit** (`combat.spec.ts`, `test-hook.spec.ts`)
2. WHEN server `MobState.hp` changes THEN the client HP bar fill SHALL reflect
   server values without local override. **Test layer: unit** (`mobs.spec.ts`)

---

## Requirement Traceability

| ID | Requirement | Priority |
| -- | ----------- | -------- |
| P4-R01 | Injected seeded RNG (`createSeededRng`, `nextDamageOffset`) for deterministic combat/drops | P1 |
| P4-R02 | L2J melee damage formula (`calcMeleeDamage`) | P1 |
| P4-R03 | L2J attack interval (`calculateAttackIntervalMs`) + resolver interval gate | P1 |
| P4-R04 | Melee range check (`isInMeleeRange`, L2 range ÷ 10) | P1 |
| P4-R05 | Client `setTarget` / `attack` intents; server message handlers | P1 |
| P4-R06 | `MobState` schema synced in `TownState.mobs` | P1 |
| P4-R07 | Spawn manager — load spawns + templates into runtime + schema | P1 |
| P4-R08 | Aggressive mob aggro within converted aggro range | P1 |
| P4-R09 | Passive mob retaliate after damage | P1 |
| P4-R10 | Idle wander near spawn (radius 5, 30% move speed) | P1 |
| P4-R11 | Death removes mob; **27 s** respawn at spawn with full HP | P1 |
| P4-R12 | XP grant on kill from `monsters.exp` | P1 |
| P4-R13 | Level-up from cumulative XP + seeded experience curve | P1 |
| P4-R14 | Seeded drop rolls (`rollDrops`) on kill | P1 |
| P4-R15 | Combat loop in `TownRoom` simulation tick (movement + AI + attacks + respawn) | P1 |
| P4-R16 | Persist character XP (and level) to DB on kill | P1 |
| P4-R17 | Seed monster combat stats, `mob_drops`, `mob_spawns` from L2J fixtures | P1 |
| P4-R18 | Client mob meshes + HP bars from `state.mobs` | P1 |
| P4-R19 | `__GAME_STATE__` combat fields (`mobs`, `targetMobId`, `player.xp/level`) | P1 |

---

## Acceptance Criteria → Test Layer Matrix

| AC / Req | Unit | Room-integration | Seed | E2E |
| -------- | ---- | ---------------- | ---- | --- |
| P4-R01 seeded RNG | ✓ | — | — | — |
| P4-R02 melee formula | ✓ | ✓ | — | — |
| P4-R03 attack interval | ✓ | ✓ | — | — |
| P4-R04 melee range | ✓ | ✓ | — | — |
| P4-R05 target + attack | — | ✓ | — | ✓ |
| P4-R06 MobState schema | — | ✓ | — | — |
| P4-R07 spawn manager | — | ✓ | — | — |
| P4-R08 aggressive aggro | ✓ | ✓ | — | — |
| P4-R09 passive retaliate | ✓ | ✓ | — | — |
| P4-R10 idle wander | ✓ | — | — | — |
| P4-R11 death + respawn | — | ✓ | — | — |
| P4-R12 XP grant | ✓ | ✓ | — | ✓ (xp > 0) |
| P4-R13 level-up | ✓ | ✓ | — | — |
| P4-R14 seeded drops | ✓ | ✓ (resolver) | — | — |
| P4-R15 TownRoom tick combat | — | ✓ | — | — |
| P4-R16 persist XP | — | ✓ | — | — |
| P4-R17 seed data | — | — | ✓ | — |
| P4-R18 client mob render | ✓ | — | — | — |
| P4-R19 test hook | ✓ | — | — | ✓ |
