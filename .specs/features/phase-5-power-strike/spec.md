# Phase 5 — Power Strike Skill Specification

## Problem Statement

Phase 4 delivers server-authoritative basic melee (`attack` intent) but no skills.
Phase 5 adds **Power Strike** (skill id **3**, already seeded in Phase 1): the
player presses a hotkey, the server validates MP cost and reuse cooldown, applies
L2J physical-skill damage via the existing combat pipeline, deducts MP, and
broadcasts updated state; the client renders a cooldown bar (DOM) and a procedural
skill flash (Three.js).

## Goals

- [ ] Physical-skill damage extends the Phase 4 melee formula with Power Strike
      L1 **power** (L2J `PhysicalDamage` effect), tested with exact anchors.
- [ ] Server validates target, cast range, MP (`mpConsumeL1`), and reuse delay
      (`reuseDelay`) before applying damage — client cannot bypass (AD-001).
- [ ] `useSkill` intent plugs into `TownRoom` tick + `combat-resolver` with
      injectable `nowMs` / `combatRng` (AD-010).
- [ ] Client hotkey sends intent only; DOM cooldown UI + `__GAME_STATE__` mirror
      server MP/cooldown for tests (AD-009); procedural flash on cast (AD-005).
- [ ] Unit + room-integration + seed + e2e tests prove spec-anchored values.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Skill book UI, skill points, leveling skills above L1 | Post-MVP; always cast L1 values |
| `hitTime` / cast bar (1080 ms) | Instant resolve on tick (same pattern as `attack`) |
| Weapon equip check (SWORD/BLUNT condition) | Starter assumed valid; Phase 7 equip |
| Soul shots, crit, shield, traits on skills | L2J modifiers deferred |
| Additional skills beyond Power Strike | Future phases |
| Client-side damage or MP authority | AD-001 |
| Peace-zone skill block | Phase 6 |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale |
| --------------------- | -------------- | --------- |
| Physical-skill damage formula | `max(1, floor(77 × (pAtk + power) / pDef × randomMod))` where `randomMod = 1 + rngOffset/100` | L2J `PhysicalDamage.java` melee path: `77 * ((pAtk * lvlMod) + power) / pDef * randomMod`; MVP uses `lvlMod = 1` (L1 starter, same simplification as Phase 4 melee) |
| Power Strike L1 **power** | **30** (from fixture `effects/PhysicalDamage/power` level 1) | Not in current `skills` columns — extend parser/seed with `powerL1` (mirrors `mpConsumeL1` pattern) |
| Seeded Power Strike row (existing columns) | `skillId=3`, `name="Power Strike"`, `maxLevel=9`, `operateType="A1"`, `targetType="ENEMY"`, `castRange=40`, `reuseDelay=3000`, `mpConsumeL1=9` | `server/src/seed/__fixtures__/skills.xml` + `skills.seeder.spec.ts` |
| L2 cast range → world metres | `castRangeWorld = castRange / 10` → **4.0** m | AD-013 (same conversion as Phase 4 `aggroRange` / `attackRange`) |
| Starter attacker profile | `STARTER_COMBAT` (`pAtk=10`, `randomDamage=10`, `meleeRange=4.0`) | Phase 4 anchor; skill uses same `pAtk` + RNG |
| Gremlin defender | `pDef=44.44444` (`GREMLIN_COMBAT`) | Phase 4 anchor |
| Power Strike damage vs Gremlin | **69** (RNG offset **0**); **62** (offset **−10**) | `floor(77×(10+30)/44.44444×1)=69`; `floor(69.3×0.9)=62` |
| MP cost per cast | **9** (`mpConsumeL1`); player joins with **mp=50** → **41** after cast | `PlayerState.mp` + `TownRoom.spec.ts` join assertion |
| Reuse cooldown | **3000** ms (`reuseDelay`); second cast rejected at **t+2999** ms, accepted at **t+3000** ms | Injectable `nowMs` in room tests |
| Cast range boundary | Distances **3.9 / 4.0 / 4.1** m at `castRangeWorld=4.0` → **in / in / out** | Reuse `isInMeleeRange` with cast range |
| Skill intent message | `useSkill` with `{ skillId: 3 }` | Colyseus `room.send` / `onMessage` pattern (Context7 `/colyseus/docs`) |
| Cooldown broadcast | `PlayerState.powerStrikeCooldownEndMs` (server `nowMs` at cast + `reuseDelay`) | Schema-synced; client derives remaining for DOM |
| Skill processing | `skillPending` flag on private `PlayerCombatState`, resolved in tick after mob AI (parallel slot to `attackPending`) | Reuses Phase 4 tick pattern |
| MP persistence | `scheduleDebouncedSave` on successful skill cast | MP must survive disconnect like HP/XP |
| Client hotkey | Key **`2`** (`ev.key === '2'`) for Power Strike; Space/`1` remain basic attack | Avoids conflict with Phase 4 bindings |
| Flash trigger | Client fires procedural flash when local `powerStrikeCooldownEndMs` transitions from 0 → >0 | Server-authoritative signal via schema onChange |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P5: Power Strike — server authority ⭐ MVP

**User Story**: As a player, when I use Power Strike on a targeted mob in range
with enough MP and no active cooldown, the server applies authentic L2J
physical-skill damage and enforces MP/cooldown — not the client.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| P5-R01 | Physical-skill damage formula extends melee with additive `power` |
| P5-R02 | Power Strike definition includes seeded `powerL1` alongside existing skill columns |
| P5-R03 | Server validates MP, cooldown, cast range, target before resolving skill |
| P5-R04 | Server applies damage, deducts MP, sets cooldown end timestamp, syncs schema |

**Acceptance Criteria**:

1. WHEN `calcPhysicalSkillDamage` is called with starter (`pAtk=10`,
   `randomDamage=10`), Gremlin (`pDef=44.44444`), Power Strike L1 `power=30`,
   and RNG offset **0** THEN damage SHALL be **69**. **Test layer: unit**
   (`melee-damage.spec.ts` or `physical-skill-damage.spec.ts`)
2. WHEN the same pairing uses RNG offset **−10** THEN damage SHALL be **62**.
   **Test layer: unit**
3. WHEN `parsePowerStrike` runs on the committed fixture THEN `powerL1` SHALL
   be **30** alongside existing fields (`skillId=3`, `mpConsumeL1=9`,
   `reuseDelay=3000`, `castRange=40`). **Test layer: seed**
   (`parsers.spec.ts`, `skills.seeder.spec.ts`)
4. WHEN a client sends `useSkill { skillId: 3 }` with a live Gremlin target in
   **4.0** m range, `mp≥9`, and no active cooldown (zero-offset RNG) THEN mob
   HP SHALL decrease by **69** and `player.mp` SHALL be **41** (from **50**).
   **Test layer: room-integration** (`TownRoom.spec.ts`)
5. WHEN `useSkill` is sent at cast distance **4.1** m THEN mob HP and `player.mp`
   SHALL NOT change. **Test layer: room-integration**
6. WHEN `useSkill` is sent with `player.mp=8` THEN cast SHALL be rejected; `mp`
   stays **8**; mob HP unchanged. **Test layer: room-integration**
7. WHEN a successful cast occurs at `nowMs=t` THEN a second `useSkill` at
   `t+2999` SHALL be rejected and at `t+3000` SHALL succeed (target still alive,
   sufficient MP). **Test layer: room-integration** (injectable `nowMs`)
8. WHEN cast succeeds THEN `player.powerStrikeCooldownEndMs` SHALL equal
   `nowMs + 3000`. **Test layer: room-integration**

**Edge cases** (listed; room tests where noted):

- `useSkill` without `setTarget` → ignored (room-integration)
- `useSkill` on dead mob → ignored (room-integration)
- `useSkill` with unknown `skillId` → ignored (room-integration)
- Cast at **3.9** m → succeeds (unit range + room-integration)

---

### P5: Power Strike — client presentation ⭐ MVP

**User Story**: As a player, pressing the Power Strike hotkey shows a visible
cooldown and a brief procedural flash so I know the skill fired.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| P5-R05 | Client hotkey sends `useSkill` intent (not local damage) |
| P5-R06 | DOM cooldown bar reflects server cooldown state |
| P5-R07 | Procedural Three.js flash plays on successful cast |
| P5-R08 | `__GAME_STATE__` exposes `mp` and cooldown fields for e2e |

**Acceptance Criteria**:

1. WHEN key **`2`** is pressed with a targeted mob THEN client SHALL send
   `useSkill { skillId: 3 }` only (no local HP mutation). **Test layer: unit**
   (`main.spec.ts` or `combat-input.spec.ts` mock room)
2. WHEN server sets `powerStrikeCooldownEndMs > now` THEN DOM element
   `#power-strike-cooldown` SHALL have `data-remaining-ms > 0`. **Test layer:
   e2e** (`power-strike.spec.ts`)
3. WHEN a successful cast is observed via schema THEN a procedural flash object
   SHALL be added to the scene (tested via renderer hook /
   `skill-flash.spec.ts`). **Test layer: unit** (client)
4. WHEN Power Strike kills a Gremlin via hotkey flow THEN `__GAME_STATE__.player.xp`
   SHALL be **> 0** and `player.mp` SHALL be **41**. **Test layer: e2e**
   (`power-strike.spec.ts`)

---

## Traceability Summary

| Requirement | Primary test layer |
| ----------- | ------------------ |
| P5-R01 | unit (game-core) |
| P5-R02 | seed |
| P5-R03–R04 | room-integration |
| P5-R05 | unit (client) |
| P5-R06, R08 | e2e |
| P5-R07 | unit (client renderer) |
