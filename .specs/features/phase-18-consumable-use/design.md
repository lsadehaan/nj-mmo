# Phase 18 — Consumable Item Use Design

## Overview

Phase 18 adds server-authoritative consumable use on top of the Phase 7 inventory
stack (`character_items` + `PlayerState.items` map) and Phase 6 shop/grant flows.
Only item **1060** (Healing Potion) is in scope.

```
┌──────────────┐   useItem intent    ┌──────────────────┐
│   Client     │ ──────────────────► │    TownRoom      │
│ inventory UI │ ◄── schema sync ─── │  handleUseItem   │
└──────────────┘                     └────────┬─────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
            ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
            │ items (DB)   │         │ @nj/game-core│         │ character_   │
            │ type lookup  │         │ applyConsum- │         │ items + hp   │
            └──────────────┘         │ able*        │         │ debounced    │
                                     └──────────────┘         └──────────────┘
```

**Authority split (AD-001):** Heal amount, stack decrement, and reuse cooldown are
computed and applied only on the server. The client renders inventory, sends intent,
and mirrors cooldown from replicated `PlayerState`.

---

## Architecture Decision: Lump Heal vs Tick-by-Tick HoT

| Option | Pros | Cons | Decision |
| ------ | ---- | ---- | -------- |
| **A — Single grant 24 HP** | One pure function; no ongoing server effect state; fast tests | Does not model 15 s `abnormalTime` spread | **Selected** |
| B — HoT 3 ticks over 15 s | Closer to L2J timing | Requires effect state on tick; interrupt rules out of scope | Deferred |

**Rationale:** ROADMAP permits the simpler option that stays anchored to skill **2031**
total heal (`8 × 3 = 24`). Instant full-heal is explicitly rejected.

---

## `@nj/game-core` Pure Module

**New file:** `libs/game-core/src/consumable/healing-potion.ts`

```typescript
export const HEALING_POTION_ITEM_ID = 1060;
/** Skill 2031: power 8 × ticks 3 */
export const HEALING_POTION_HEAL_AMOUNT = 24;
/** Item 1060 reuse_delay */
export const HEALING_POTION_REUSE_MS = 10_000;

export function applyConsumableHeal(params: {
  hp: number;
  maxHp: number;
  healAmount: number;
}): number {
  return Math.min(params.maxHp, params.hp + params.healAmount);
}

export type ConsumableUseFailure = {
  ok: false;
  error: 'not_consumable' | 'not_owned' | 'reuse_cooldown' | 'dead' | 'unknown_item';
};

export type ConsumableUseSuccess = {
  ok: true;
  hp: number;
  itemCount: number;
  cooldownEndMs: number;
};

export function validateConsumableUse(params: {
  itemId: number;
  itemType: string | undefined;
  ownedCount: number;
  hp: number;
  nowMs: number;
  cooldownEndMs: number;
}): ConsumableUseSuccess | ConsumableUseFailure;

export function resolveConsumableUse(params: {
  itemId: number;
  itemType: string | undefined;
  ownedCount: number;
  hp: number;
  maxHp: number;
  healAmount: number;
  reuseMs: number;
  nowMs: number;
  cooldownEndMs: number;
}): ConsumableUseSuccess | ConsumableUseFailure;
```

**Export** from `libs/game-core/src/index.ts`.

**Unit tests:** `libs/game-core/src/consumable/healing-potion.spec.ts` — all CONS-01–09.

For item **1060**, `resolveConsumableUse` delegates heal/reuse constants; other
consumable ids can extend in a future pass via a lookup table.

---

## Server: `useItem` Handler

### Schema extension (`PlayerState`)

```typescript
@type('number') healingPotionCooldownEndMs = 0;
```

Mirrors `powerStrikeCooldownEndMs`. Client derives `healingPotionCooldownRemainingMs`
the same way as Power Strike (`max(0, endMs - Date.now())`).

Not persisted to `characters` table (same as Power Strike cooldown).

### Intent registration (`TownRoom.onCreate`)

```typescript
this.onMessage('useItem', (client, message: { itemId: number }) => {
  this.handleUseItem(client.sessionId, message.itemId);
});
```

### `handleUseItem(sessionId, itemId)`

1. Load `player`, `stored` character; **return** if missing or `player.hp <= 0`.
2. Load `item` from `this.itemsById`; **return** if missing.
3. Call `resolveConsumableUse` with:
   - `ownedCount: getItemCount(sessionId, itemId)`
   - `cooldownEndMs: player.healingPotionCooldownEndMs` (only when `itemId === 1060`; else **0**)
   - `healAmount` / `reuseMs` from game-core constants when `itemId === 1060`
4. If `!result.ok` → **return** (silent reject, same as `equip`/`buy` failures).
5. Apply:
   - `player.hp = stored.hp = result.hp`
   - `setItemCount(sessionId, itemId, result.itemCount)`
   - `player.healingPotionCooldownEndMs = result.cooldownEndMs`
6. `scheduleDebouncedSave(sessionId)`.

**Optional thin wrapper:** `server/src/rooms/consumable-use.ts` exporting
`applyUseItemTransaction(...)` if it keeps `TownRoom` readable — logic must remain
delegated to game-core for unit coverage.

### Peace zone

No guard — potions usable in town (spec assumption).

### Regression surfaces (unchanged code paths)

- `handleNpcAction('heal')` → `applyHeal` full restore
- `handleBuy` / `handleSell` → `shop-transaction`
- `handleEquip` → `validateEquip` rejects `type !== 'weapon'`

---

## Client

### Inventory window (`inventory-window.ts`)

Extend `InventorySendHandlers`:

```typescript
export interface InventorySendHandlers {
  sendEquip: (payload: { itemId: number }) => void;
  sendUseItem: (payload: { itemId: number }) => void;
}
```

Add `CONSUMABLE_ITEM_IDS = new Set([1060])` (or derive from a shared constant import).

For each row where `CONSUMABLE_ITEM_IDS.has(itemId)`:

- Render `<button data-action="use">Use</button>`
- `disabled` when `options.healingPotionCooldownRemainingMs > 0` (MVP: only potion has cooldown UI)

Extend `InventoryRenderOptions`:

```typescript
healingPotionCooldownRemainingMs: number;
```

### Room wiring (`net/room.ts`)

- `room.send('useItem', { itemId })` from inventory handler.
- On `PlayerState` `onChange`, read `healingPotionCooldownEndMs` and publish to test hook.
- Expose `window.__useItem__ = (itemId: number) => room.send('useItem', { itemId })` in `main.ts` or `combat-input.ts` (alongside `__equipItem__`).

### Test hook (`test-hook.ts`)

Add to `GameStatePlayer`:

```typescript
healingPotionCooldownEndMs: number;
healingPotionCooldownRemainingMs: number;
```

Update helper that derives `powerStrikeCooldownRemainingMs` to also refresh potion
remaining ms (shared `updateCooldownRemaining` or inline in `setPlayer`).

---

## Test Strategy (AD-010 / AD-014)

| Layer | File | Focus |
| ----- | ---- | ----- |
| Unit (game-core) | `healing-potion.spec.ts` | CONS-01–09 |
| Room | `TownRoom.spec.ts` new `describe('TownRoom useItem')` | CONS-10–19; `NJ_AUTOSIM=0`, `deliver()`, `createFakeClock` |
| Unit (client) | `inventory-window.spec.ts`, `wire-room.spec.ts` | CONS-20–25 |
| E2e | `client-e2e/src/consumable-use.spec.ts` | CONS-26–27; `gotoGame`, `expect.poll`, `__useItem__` |

**Room cooldown test pattern** (reuse Power Strike AC):

```typescript
const clock = createFakeClock(1000);
const room = await colyseus.createRoom('town', { dbPath, nowMs: clock.now });
// grant potions via starterKit, damage player hp manually on player state
await deliver(room, client, [['useItem', { itemId: 1060 }]]);
clock.advance(9999);
await deliver(room, client, [['useItem', { itemId: 1060 }]]); // reject
clock.advance(1);
await deliver(room, client, [['useItem', { itemId: 1060 }]]); // accept
```

**E2E damage setup:** `approachMob` + wait until `player.hp < maxHp` via mob aggro
(poll `__GAME_STATE__`), then `__useItem__(1060)`.

**Speed caps:** each unit/room test file ≤ **10 s**; e2e spec ≤ **30 s** total.

---

## Data / Seed

No schema migration required. Item **1060** already seeded as `type=consumable` in
`items_subset.xml`. Optional seed regression: existing `seedItems` test already
covers item row — no new seed AC unless Verifier gaps.

---

## Future Extension Notes (not implemented)

- `itemCooldownEnds` `MapSchema` for multiple consumables.
- `items.reuse_delay` + `items.effect_skill_id` columns parsed from L2J XML.
- Tick-by-tick HoT effect on `TownRoom.simulate` with `HealOverTime` state machine.
- Consumable hotbar slot bound to `useItem`.
