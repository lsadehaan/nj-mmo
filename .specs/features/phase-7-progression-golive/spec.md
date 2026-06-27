# Phase 7 — Progression Loop Specification

## Problem Statement

Phases 1–6 deliver authoritative combat, skills, shop/adena, and a functional town,
but the MVP loop is incomplete: players fight with a fixed `STARTER_COMBAT.pAtk`
(10) regardless of inventory, **players never die** (mob damage reduces HP to 0 with
no consequence), and **level-up has no reward** beyond the number changing.

Phase 7 closes the vertical slice locally: **inventory + equip weapon → fight →
die/respawn → level-up reward → buy item**.

**Done when:** a player can create a character, claim the starter kit, equip a weapon,
kill a mob, level up, die and respawn in town, and buy an item — all running locally.
Public deployment is deferred post-MVP.

## Goals

- [ ] Minimal `items` master table + seed for weapons/consumables referenced by
      drops/shop/starter kit.
- [ ] Server-authoritative equip (one weapon slot) raising effective `pAtk` in the
      existing melee/skill damage formulas.
- [ ] Player death when `hp ≤ 0`; respawn in town at spawn point with HP/MP restored.
- [ ] Level-up reward: max HP/MP increase + full restore (L2-inspired deltas).
- [ ] Client inventory/equip UI mirroring shop/dialog DOM patterns.
- [ ] Unit + room-integration + seed + e2e tests with spec-anchored values (AD-010,
      AD-014).

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Full L2 inventory (armor, arrows, soulshots, weight) | MVP weapon slot only |
| Item enchant, grade, dual wield, appearance | Post-MVP |
| XP loss on death (full L2 `ExperienceLossData`) | Newbie protection simplified |
| Death penalty item drop / karma | Post-MVP |
| Postgres migration | SQLite-first per AD-007 |
| Production deployment / public URL | Deferred post-MVP |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale |
| --------------------- | -------------- | --------- |
| Starter weapon | **Squire's Sword** item **2369** (L2J `items/02300-02399.xml`) | Human Fighter `initialEquipment.xml` starts with 2369 equipped |
| Weapon `pAtk` | **6**; `randomDamage` **10**; `pAtkSpd` **379** (L2J item 2369 stats) | Authentic Classic no-grade weapon |
| Effective `pAtk` formula | `STARTER_COMBAT.pAtk (10) + weapon.pAtk (6) = **16**` when Squire's Sword equipped | MVP has no player stat sheet; base 10 is the established naked fighter constant (Phase 4–5); weapon adds L2J weapon stat |
| Unarmed `pAtk` | **10** (`STARTER_COMBAT`) unchanged when no weapon equipped | Existing combat tests anchor on 10 |
| Melee damage equipped | **27** vs Gremlin (`pDef 44.44444`, `rngOffset 0`) | `floor(16 × 77 / 44.44444) = 27` |
| Power Strike equipped | **79** vs Gremlin (`power 30`, `rngOffset 0`) | `floor((46/44.44444)×77) = 79` |
| Weapon acquisition | Roxxy **starter kit** grants **1× 2369** (in addition to 3× 1060) | Matches L2 starting equipment; Katerina shop unchanged for buy AC |
| Equip slot | Single **`equippedWeaponItemId`** on character + `PlayerState` | MVP one-hand weapon only (`bodypart=rhand`) |
| Unequip | Out of scope | Equip-only; swap by equipping another weapon later |
| `maxHp` / `maxMp` | Defaults **100** / **50** at level 1 (match `createCharacter`) | Existing heal/starter constants |
| Level-up deltas | **+12 maxHp**, **+5 maxMp** per level gained; **full HP/MP restore** on level-up | L2 Human Fighter L1→L2: 80→91.83 HP (+11.83), 30→35.46 MP (+5.46); rounded for our 100/50 base |
| Level 2 example | After 2× Gremlin kill (`44+44=88` xp): `level=2`, `maxHp=112`, `maxMp=55`, `hp=112`, `mp=55` | `grantXp` threshold 68; reward applied once when level increases |
| Death trigger | Mob (or future) damage reducing `hp` to **≤ 0** in server tick | `TownRoom.simulate` already applies mob damage; no client death |
| Death penalty | **No XP loss** for levels **1–9** | L2 "Lucky" newbie protection; MVP only exercises levels 1–2 |
| Respawn point | `SPAWN_X=0`, `SPAWN_Z=0`, `SPAWN_Y` from `@nj/game-core` | Town spawn / character create origin (AD-013) |
| Respawn restore | `hp = maxHp`, `mp = maxMp`; position teleported to spawn; combat target cleared; mobs drop player target | Functional "respawn in town" |
| Death persistence | Position + HP/MP saved on respawn (debounced save) | Phase 3 persistence contract |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P7: Items master + equip weapon ⭐ MVP

**User Story**: As a player, I can see my inventory, equip Squire's Sword, and deal
more melee damage — all validated on the server.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| P7-R01 | `items` master table: `itemId`, `name`, `type`, `pAtk`, `randomDamage`, `bodyPart` |
| P7-R02 | Seed items **1060**, **17**, **1835**, **2369** from L2J fixture subset |
| P7-R03 | `effectivePAtk(base, equippedWeaponId, items)` in `@nj/game-core` |
| P7-R04 | `characters.equipped_weapon_item_id` + `max_hp` + `max_mp`; sync `PlayerState` |
| P7-R05 | Server `equip { itemId }` validates ownership + weapon type; sets slot |
| P7-R06 | `combat-resolver` melee + Power Strike use effective `pAtk` |
| P7-R07 | Roxxy starter kit also grants **1× item 2369** |
| P7-R08 | Equip + inventory persist via `character-repository` |
| P7-R09 | Client inventory window + equip control; `__GAME_STATE__` exposes `equippedWeaponId` |

**Acceptance Criteria**:

1. WHEN `seedItems` runs THEN item **2369** SHALL be `Squire's Sword`, `type=weapon`,
   `pAtk=6`, `randomDamage=10`, `bodyPart=rhand`. **Test layer: seed**
2. WHEN `effectivePAtk(10, 2369, items)` THEN result SHALL be **16**; WHEN
   `equippedWeaponId` is `null` THEN **10**. **Test layer: unit** (`game-core`)
3. WHEN `calcMeleeDamage` uses `pAtk=16` vs Gremlin `pDef=44.44444`, `rngOffset=0`
   THEN damage SHALL be **27**. **Test layer: unit** (`game-core`)
4. WHEN player owns **1× 2369**, is alive, and sends `equip { itemId: 2369 }` THEN
   `equippedWeaponItemId` SHALL be **2369** and the next melee hit with `rngOffset=0`
   SHALL deal **27** damage to a Gremlin. **Test layer: room-integration**
5. WHEN player sends `equip { itemId: 1060 }` (consumable) THEN equip SHALL be
   rejected (slot unchanged). **Test layer: room-integration**
6. WHEN player sends `equip { itemId: 2369 }` without owning it THEN equip SHALL be
   rejected. **Test layer: room-integration**
7. WHEN equip succeeds THEN debounced save persists `equipped_weapon_item_id`.
   **Test layer: room-integration** (reconnect reload)
8. WHEN Roxxy `starterKit` succeeds THEN inventory SHALL include **3× 1060** and
   **1× 2369**. **Test layer: room-integration**
9. WHEN inventory window is open THEN owned items SHALL list with an Equip action for
   weapons; `__GAME_STATE__.equippedWeaponId` SHALL match server. **Test layer: e2e**

---

### P7: Death / respawn in town ⭐ MVP

**User Story**: As a player killed by a mob, I respawn in town at full HP/MP without
losing XP (newbie levels).

**Requirements**:

| ID | One-liner |
| -- | --------- |
| P7-R10 | Detect `hp ≤ 0` after damage in tick; invoke death handler |
| P7-R11 | `respawnPlayer`: teleport to spawn, restore HP/MP to max, clear combat/aggro |
| P7-R12 | No XP loss on death for `level ≤ 9` |
| P7-R13 | Death + respawn persist position and vitals |

**Acceptance Criteria**:

1. WHEN `resolvePlayerDeath({ hp: 0, level: 1, xp: 44 })` THEN `xp` SHALL remain
   **44**. **Test layer: unit** (`game-core`)
2. WHEN a player at `hp=1` takes **5** mob damage in `TownRoom` THEN after the tick
   `hp` SHALL be **maxHp** (not 0), position SHALL be `(SPAWN_X, SPAWN_Y, SPAWN_Z)`,
   and `xp` SHALL be unchanged. **Test layer: room-integration**
3. WHEN player dies THEN `targetMobId` / `playerCombat.targetMobId` SHALL be cleared
   and mobs targeting that session SHALL drop target. **Test layer: room-integration**
4. WHEN player dies and reconnects THEN spawn position and `hp=maxHp` SHALL persist.
   **Test layer: room-integration**

---

### P7: Level-up reward ⭐ MVP

**User Story**: As a player who levels up from killing mobs, I gain higher max HP/MP
and am fully restored.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| P7-R14 | `applyLevelUpReward(prevLevel, newLevel, vitals)` pure function |
| P7-R15 | `handleMobKill` applies reward when `grantXp` increases level |
| P7-R16 | Client HUD shows level + max HP change |

**Acceptance Criteria**:

1. WHEN `applyLevelUpReward` goes from level **1→2** with `{ maxHp:100, maxMp:50, hp:40, mp:20 }`
   THEN result SHALL be `{ maxHp:112, maxMp:55, hp:112, mp:55 }`. **Test layer: unit**
2. WHEN player at `xp=44, level=1` kills a Gremlin (`exp=44`) THEN after kill
   `level=2`, `xp=88`, `maxHp=112`, `hp=112`, `maxMp=55`, `mp=55`.
   **Test layer: room-integration**
3. WHEN level increases THEN client `__GAME_STATE__.player.level` SHALL be **2** and
   HUD level label SHALL update. **Test layer: e2e**

---

### P7: Full progression loop E2E ⭐ MVP

**User Story**: A friend can play the full loop: claim starter kit, equip sword, kill
mobs, level up, buy from shop.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| P7-R17 | E2E: starter kit → equip 2369 → kill 2 mobs → level 2 → buy potion |

**Acceptance Criteria**:

1. GIVEN a fresh character WHEN player claims Roxxy starter kit, equips **2369**,
   kills **2** Gremlins outside peace zone, walks to Katerina, buys **1× 1060** THEN
   `__GAME_STATE__` SHALL show `equippedWeaponId=2369`, `level=2`, `items[1060]≥1`,
   `adena=897` (1000−103). **Test layer: e2e** (`progression.spec.ts`, AD-014 room
   isolation)

---

## Requirement Traceability Summary

| ID | Summary |
| -- | ------- |
| P7-R01–R02 | Items master schema + seed |
| P7-R03 | effectivePAtk pure function |
| P7-R04–R05 | DB + equip handler |
| P7-R06 | Combat uses effective pAtk |
| P7-R07–R08 | Starter kit sword + persistence |
| P7-R09 | Client inventory/equip UI |
| P7-R10–R13 | Death / respawn |
| P7-R14–R16 | Level-up reward |
| P7-R17 | Progression E2E |
