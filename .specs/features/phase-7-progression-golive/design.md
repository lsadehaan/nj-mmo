# Phase 7 — Progression Loop Design

## Overview

Phase 7 adds three server-authoritative gameplay systems on top of the Phase 6 town
(shop, NPCs, peace zone) and Phase 4–5 combat stack.

```
┌─────────────┐     equip / buy      ┌──────────────────┐
│   Client    │ ───────────────────► │    TownRoom      │
│ inventory UI│ ◄── schema sync ── │  tick + handlers │
└─────────────┘                     └────────┬─────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    ▼                        ▼                        ▼
            ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
            │ items (DB)   │        │ game-core    │        │ characters   │
            │ master seed  │        │ effectivePAtk│        │ + items +    │
            └──────────────┘        │ levelUp/death│        │ equip slot   │
                                    └──────────────┘        └──────────────┘
```

**Authority split (AD-001):** All equip effects, death/respawn, level-up rewards,
and damage numbers are computed and persisted on the server. The client renders
inventory, sends `equip` intent, and mirrors `PlayerState`.

---

## Items Master Model

### Schema (`items` table)

| Column | Type | Notes |
| ------ | ---- | ----- |
| `item_id` | INTEGER PK | L2J item id (e.g. 2369) |
| `name` | TEXT | Display name |
| `type` | TEXT | `weapon` \| `consumable` \| `etc` |
| `p_atk` | REAL NULL | Weapon physical attack; null for non-weapons |
| `random_damage` | INTEGER NULL | L2J `randomDamage`; default 10 for weapons |
| `body_part` | TEXT NULL | `rhand` for MVP sword |

No FK from `character_items` or `merchant_items` yet — consistent with Phase 4
deviation (itemId references only). The master table is the lookup for equip rules
and combat stats.

### Seeded rows (fixture subset)

| itemId | name | type | pAtk | randomDamage | bodyPart |
| ------ | ---- | ---- | ---- | ------------ | -------- |
| 1060 | Healing Potion | consumable | — | — | — |
| 17 | Wooden Arrow | etc | — | — | — |
| 1835 | Soulshot | etc | — | — | — |
| **2369** | **Squire's Sword** | **weapon** | **6** | **10** | **rhand** |

**L2J source:** `dist/game/data/stats/items/02300-02399.xml` item id 2369.

### Parser / seeder

- Fixture: `server/src/seed/__fixtures__/items_subset.xml` (4 items).
- Parser: `parseItemsXml` → rows; seeder: `seedItems` in idempotent `runSeed` transaction.
- `merchant_items.name` can remain denormalized; equip/combat reads `items` table.

---

## Equip & Inventory

### Character persistence extensions

```typescript
// characters table additions
maxHp: real        // default 100
maxMp: real        // default 50
equippedWeaponItemId: integer | null  // nullable
```

`character_items` unchanged — stack counts by `(character_id, item_id)`.

### PlayerState extensions

```typescript
@type('number') maxHp = 100;
@type('number') maxMp = 50;
@type('number') equippedWeaponItemId = 0; // 0 = none (schema has no nullable number)
```

Use `0` as sentinel for "no weapon" in schema; DB uses `NULL`.

### Equip flow

1. Client sends `room.send('equip', { itemId: 2369 })`.
2. `TownRoom.handleEquip(sessionId, itemId)`:
   - Reject if player dead (`hp <= 0` — should not happen post-respawn).
   - Load item from `items` table; require `type === 'weapon'`.
   - Require `getItemCount(sessionId, itemId) >= 1`.
   - Set `player.equippedWeaponItemId`, `stored.equippedWeaponItemId`.
   - `scheduleDebouncedSave`.
3. No unequip in MVP; equipping another weapon overwrites slot.

### `equip-transaction.ts` (pure)

```typescript
export function validateEquip(params: {
  itemId: number;
  itemType: string | undefined;
  ownedCount: number;
}): { ok: true } | { ok: false; error: string };
```

### Effective pAtk (`libs/game-core/src/combat/effective-patk.ts`)

```typescript
export function effectivePAtk(
  basePAtk: number,
  equippedWeaponItemId: number | null | 0,
  weaponPAtk: number | undefined
): number {
  if (!equippedWeaponItemId || !weaponPAtk) return basePAtk;
  return basePAtk + weaponPAtk;
}
```

**Squire's Sword:** `effectivePAtk(10, 2369, 6) === 16`.

`TownRoom` / `combat-resolver` resolve weapon stats from DB at attack time (or cache
`items` map on room boot like `dropsByNpcId`).

### Combat integration

`resolvePlayerAttack` and `resolvePowerStrike` gain `attackerPAtk: number` param
(instead of hard-coded `STARTER_COMBAT.pAtk`). `TownRoom.simulate` computes:

```typescript
const pAtk = effectivePAtk(
  STARTER_COMBAT.pAtk,
  player.equippedWeaponItemId,
  itemsMap.get(player.equippedWeaponItemId)?.pAtk
);
```

Existing unarmed tests pass `attackerPAtk: 10`.

---

## Death & Respawn

### Detection (tick order)

After mob attack loop in `simulate`:

```typescript
if (target.hp <= 0) {
  this.handlePlayerDeath(sessionId);
}
```

`handlePlayerDeath` runs **once per death** (guard: skip if already at spawn with
full HP — use `isDead` flag or `hp <= 0` only).

### Pure function (`libs/game-core/src/player-death.ts`)

```typescript
export function resolvePlayerDeath(params: {
  level: number;
  xp: number;
  maxHp: number;
  maxMp: number;
}): {
  xp: number;           // unchanged for level <= 9
  x: number; z: number; y: number;
  hp: number; mp: number;
};
```

Uses `SPAWN_X`, `SPAWN_Y`, `SPAWN_Z` from `world-constants`.

### Side effects in TownRoom

- Clear `playerCombat` target / pending flags.
- For each `mobRuntime` where `targetSessionId === sessionId`, set `null`.
- Set position + vitals from pure result.
- `persistCharacter` (immediate, not only debounced — death is significant).

**No XP loss** for `level <= 9` (logged assumption — L2 Lucky equivalent).

---

## Level-Up Reward

### Pure function (`libs/game-core/src/level-up-reward.ts`)

```typescript
const HP_PER_LEVEL = 12;
const MP_PER_LEVEL = 5;

export function applyLevelUpReward(
  prevLevel: number,
  newLevel: number,
  vitals: { maxHp: number; maxMp: number; hp: number; mp: number }
): typeof vitals;
```

For each level gained: `maxHp += 12`, `maxMp += 5`, then `hp = maxHp`, `mp = maxMp`.

### Integration in `handleMobKill`

```typescript
const prevLevel = player.level;
applyKillRewards(player, kill, curve, drops, rng);
if (player.level > prevLevel) {
  const rewarded = applyLevelUpReward(prevLevel, player.level, {
    maxHp: player.maxHp, maxMp: player.maxMp, hp: player.hp, mp: player.mp,
  });
  Object.assign(player, rewarded);
  stored.maxHp = rewarded.maxHp; // etc.
}
```

`grantXp` already in `applyKillRewards` — reward fires only when level increases.

**Example:** 2× Gremlin (44+44 xp) → level 2, maxHp 112, hp 112.

---

## Client Architecture

### New UI: `client/src/ui/inventory-window.ts`

Mirror `shop-window.ts` pattern:

- `#inventory-window` fixed panel.
- Lists `__GAME_STATE__.items` with counts.
- **Equip** button for entries whose `itemId` is a known weapon (2369).
- Shows `Equipped: Squire's Sword` when `equippedWeaponId === 2369`.
- Toggle via HUD key **`I`** (and `__openInventory__` test hook).

### `client/src/net/room.ts` wiring

- `room.send('equip', { itemId })` on Equip click.
- `Callbacks.listen(player, 'equippedWeaponItemId', …)` → `setEquippedWeaponId`.
- Listen `maxHp`, `hp` for death/level HUD.

### Test hook extensions (`test-hook.ts`)

```typescript
equippedWeaponId: number | null;
maxHp: number;
isDead: boolean; // client-derived: hp<=0 before respawn snapshot — prefer server-driven flag if added
__equipItem__?: (itemId: number) => void;
__openInventory__?: () => void;
```

### Death / level HUD

- Brief `#death-overlay` text "You died — respawning in town" (auto-clears when
  `hp` restored server-side).
- Level label: `Lv.2` + optional `maxHp` in debug row.

---

## Out of scope: production deployment

Production deployment (container hosting, static client hosting, CORS for cross-origin
deploy, runbooks, public URL) is **deferred post-MVP**. Phase 7 delivers the full
progression loop running locally via `npm run dev`.

---

## Test Strategy (AD-010, AD-014)

| Layer | Phase 7 focus |
| ----- | ------------- |
| unit (`game-core`) | `effectivePAtk`, `applyLevelUpReward`, `resolvePlayerDeath` |
| unit (`server`) | `equip-transaction`, combat-resolver with `attackerPAtk: 16` |
| seed | `items` row 2369 stats |
| room-integration | equip damage 27, death respawn, level 2 reward; `NJ_AUTOSIM=0`, `simulate()` |
| e2e | `progression.spec.ts`; `?room=` isolation; `client:preview` prebuild |

Discrimination sensor targets: disable `effectivePAtk` addition, skip death handler,
skip level-up reward — tests must fail.

---

## Key Files Touched

| Area | Files |
| ---- | ----- |
| Schema | `server/src/db/schema.ts`, `client.ts` |
| Seed | `items` parser/seeder, fixtures, `seed.ts` |
| game-core | `effective-patk.ts`, `level-up-reward.ts`, `player-death.ts` |
| Server room | `combat-resolver.ts`, `TownRoom.ts`, `npc-actions.ts`, `schema/TownState.ts`, `character-repository.ts` |
| Client | `ui/inventory-window.ts`, `net/room.ts`, `test-hook.ts`, `main.ts` |

---

## Decisions Honored

- **AD-001:** Server authority for equip, death, level-up, damage.
- **AD-010:** Four test layers; seeded RNG in combat tests.
- **AD-011:** Temp DB per seed test.
- **AD-012:** Fixtures under `__fixtures__/`.
- **AD-014:** `NJ_AUTOSIM=0`, `simulate()`/`deliver()`, e2e `?room=` isolation,
  `client:preview`, live mob chase for combat e2e.
- **L-001:** Vitest `resolve.alias` for `@nj/game-core` source in tests.
