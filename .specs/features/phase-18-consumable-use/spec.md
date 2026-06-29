# Phase 18 — Consumable Item Use (Healing Potion) Specification

## Problem Statement

Healing Potions (item **1060**) are buyable at Katerina and granted in Roxxy's
starter kit (Phases 6–7), and the inventory UI shows them with icons (Phase 14),
but they **cannot be used**. The only HP restore today is Roxxy's full-heal dialog
action. Classic gameplay expects in-field recovery via consumables while fighting
outside town.

Phase 18 closes that gap: server-authoritative `useItem` intent, L2J-anchored heal
from skill **2031**, **10 s** reuse delay, inventory **Use** button, and e2e proof
via `__GAME_STATE__`.

## Goals

- [ ] Pure `applyConsumable` logic in `@nj/game-core` with unit tests anchored to
      skill **2031** (power **8**, ticks **3**, total **24** HP) and item **1060**
      reuse **10 s**.
- [ ] Server `useItem { itemId }` intent: validate ownership, type, cooldown;
      apply heal; decrement stack; sync `PlayerState`; debounced persist.
- [ ] Client inventory **Use** button for `type=consumable` items; optional
      `window.__useItem__(itemId)` test hook; cooldown reflected in UI when server
      exposes reuse timestamp.
- [ ] Room-integration + e2e tests per AD-010/AD-014 (no wall-clock sleeps).
- [ ] Regression: Roxxy heal, shop buy/sell, equip rejection for **1060** unchanged.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Mana potions / soulshots as consumables | Healing Potion only for this phase |
| Tick-by-tick HoT over 15 s abnormalTime | MVP uses single lump heal **8×3=24** (ROADMAP choice) |
| Cast bar / interrupt on damage | Server apply on intent suffices |
| Auto-use consumable hotbar slot | Optional stretch; **Use** button is MVP |
| MP potions, buff scrolls, other etcitems | Future consumable pass |
| `reuse_delay` column on `items` master table | Hardcoded constant from L2J for **1060**; generalize later |
| Cooldown persistence across reconnect | Cooldown replicated on `PlayerState` for session; DB persist deferred |

---

## Assumptions & Open Questions

Every ambiguity resolved autonomously (Planner cannot consult user).

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Heal delivery model | **Single server grant of 24 HP** on successful `useItem` (`min(maxHp, hp + 24)`) | Simpler than tick-by-tick HoT; still anchored to skill **2031** power×ticks; instant full-heal rejected by ROADMAP | y |
| Heal constants | `HEALING_POTION_HEAL_AMOUNT = 24`; `HEALING_POTION_REUSE_MS = 10000` | L2J skill **2031** (`power 8`, `ticks 3`) + item **1060** `reuse_delay 10000` | y |
| Peace zone | **Allow** potion use in town | ROADMAP default; Roxxy full-heal remains separate | y |
| Use at full HP | **Allow** — consumes potion, sets cooldown, `hp` unchanged (capped) | Matches L2 item consumption behavior; simpler than client-side disable | y |
| Dead player | **Reject** `useItem` when `hp ≤ 0` | Consistent with `handleEquip` guard | y |
| Cooldown scope | Per-character, per-item (**1060** only this phase) | L2J `reuse_delay` is per item | y |
| Cooldown storage | `PlayerState.healingPotionCooldownEndMs` (wall-clock ms, server `nowMs`) | Mirrors `powerStrikeCooldownEndMs` pattern; client derives remaining ms | y |
| Cooldown not in DB | Runtime + schema only; reset to **0** on fresh character load | MVP; matches Power Strike (not persisted to `characters` table) | y |
| Item lookup | `items.type === 'consumable'` from seeded master table | Phase 7 seed already types **1060** as `consumable` | y |
| Intent shape | `useItem { itemId: number }` | ROADMAP; symmetric with `equip` | y |
| E2E damage setup | Walk outside peace zone; let mob hit player (no `waitForTimeout`) | AD-014; reuse `peace-zone.ts` + `expect.poll` on `__GAME_STATE__.player.hp` | y |
| Implicit: auth / rate limits | N/A — Colyseus room only | — | N/A |
| Implicit: concurrency | Per-test isolated room (`instanceKey`) + `NJ_AUTOSIM=0` | AD-014 | N/A |
| Implicit: observability | `__GAME_STATE__.player.hp`, `.items[1060]`, `.healingPotionCooldownRemainingMs` | AD-009 | N/A |

**Open questions:** none — all resolved or logged above.

---

## L2J Anchors (Classic reference)

| Source | Value |
| ------ | ----- |
| Item **1060** | `Healing Potion`, `etcitem_type=POTION`, `reuse_delay=10000`, stackable, skill **2031** |
| Skill **2031** | `HealOverTime` **power 8**, **ticks 3**, `abnormalTime 15` s |
| MVP heal per use | **24 HP** (= 8 × 3) applied once on server |
| MVP reuse | **10 000 ms** between successful uses of item **1060** |

---

## User Stories

### P1: Pure consumable heal math ⭐ MVP

**User Story**: As a developer, I have testable pure functions for potion heal amount,
HP cap, and reuse validation anchored to L2J skill **2031**.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| CONS-R01 | `HEALING_POTION_ITEM_ID`, `HEALING_POTION_HEAL_AMOUNT`, `HEALING_POTION_REUSE_MS` constants |
| CONS-R02 | `applyConsumableHeal(hp, maxHp, healAmount)` caps at `maxHp` |
| CONS-R03 | `validateConsumableUse(...)` pure gate for type/count/cooldown/alive |

**Acceptance Criteria**:

1. WHEN `HEALING_POTION_HEAL_AMOUNT` is read THEN it SHALL be **24**. **Test layer: unit**
2. WHEN `HEALING_POTION_REUSE_MS` is read THEN it SHALL be **10000**. **Test layer: unit**
3. WHEN `applyConsumableHeal({ hp: 50, maxHp: 100, healAmount: 24 })` THEN `hp` SHALL be **74**. **Test layer: unit**
4. WHEN `applyConsumableHeal({ hp: 90, maxHp: 100, healAmount: 24 })` THEN `hp` SHALL be **100** (cap). **Test layer: unit**
5. WHEN `validateConsumableUse` with `itemType: 'weapon'` THEN result SHALL be `{ ok: false, error: 'not_consumable' }`. **Test layer: unit**
6. WHEN `validateConsumableUse` with `ownedCount: 0` THEN result SHALL be `{ ok: false, error: 'not_owned' }`. **Test layer: unit**
7. WHEN `validateConsumableUse` with `nowMs < cooldownEndMs` THEN result SHALL be `{ ok: false, error: 'reuse_cooldown' }`. **Test layer: unit**
8. WHEN `validateConsumableUse` with `hp <= 0` THEN result SHALL be `{ ok: false, error: 'dead' }`. **Test layer: unit**
9. WHEN `validateConsumableUse` passes for item **1060** THEN `applyConsumableOutcome` SHALL return `newHp`, `newCount = ownedCount - 1`, `cooldownEndMs = nowMs + 10000`. **Test layer: unit**

---

### P2: Server `useItem` intent ⭐ MVP

**User Story**: As a player, I send `useItem` and the server heals me, decrements my
potion stack, and enforces the **10 s** reuse delay.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| CONS-R04 | `TownRoom` registers `useItem` message handler |
| CONS-R05 | `handleUseItem` uses game-core pure functions + `items` master lookup |
| CONS-R06 | `PlayerState.healingPotionCooldownEndMs` replicated to client |
| CONS-R07 | Inventory count + HP persisted via existing debounced save |

**Acceptance Criteria**:

10. WHEN player owns **1× 1060**, `hp=50`, `maxHp=100`, and sends `useItem { itemId: 1060 }` THEN `hp` SHALL be **74**, item **1060** count **0**, and `healingPotionCooldownEndMs` SHALL be `nowMs + 10000`. **Test layer: room-integration**
11. WHEN player sends `useItem { itemId: 1060 }` with count **0** THEN HP and count SHALL be unchanged. **Test layer: room-integration**
12. WHEN player sends `useItem { itemId: 2369 }` (weapon) THEN HP and inventory SHALL be unchanged. **Test layer: room-integration**
13. WHEN player successfully uses potion at `nowMs=1000` and sends second `useItem` at `nowMs=10999` THEN second use SHALL be rejected (HP/count unchanged from first use). **Test layer: room-integration** (fake `nowMs` clock)
14. WHEN same player sends `useItem` at `nowMs=11000` (exactly **10 s** after first) THEN second use SHALL succeed (count decrements again if owned). **Test layer: room-integration**
15. WHEN player uses potion inside peace zone (`x=0,z=0`) THEN use SHALL succeed (HP increases if damaged). **Test layer: room-integration**
16. WHEN `useItem` succeeds THEN debounced save SHALL persist reduced `character_items` count and new `hp`. **Test layer: room-integration** (reconnect reload)
17. WHEN Roxxy `npcAction heal` is sent THEN `hp` SHALL still restore to **maxHp** (full heal unchanged). **Test layer: room-integration**
18. WHEN Katerina `buy` **1× 1060** at **103** adena THEN `adena` SHALL be **897** and count **1** (shop unchanged). **Test layer: room-integration**
19. WHEN player sends `equip { itemId: 1060 }` THEN `equippedWeaponItemId` SHALL remain **0** (regression). **Test layer: room-integration**

---

### P3: Client inventory Use + test hooks ⭐ MVP

**User Story**: As a player, I click **Use** on a Healing Potion row in inventory; the
client sends `useItem` and shows cooldown state.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| CONS-R08 | Inventory row **Use** button for consumable items only |
| CONS-R09 | `wireRoom` sends `room.send('useItem', { itemId })` |
| CONS-R10 | `__useItem__(itemId)` + `healingPotionCooldownRemainingMs` on `__GAME_STATE__` |

**Acceptance Criteria**:

20. WHEN inventory renders item **1060** with count **> 0** THEN row SHALL include a **Use** button with `data-action="use"`. **Test layer: unit** (`inventory-window.spec.ts`)
21. WHEN inventory renders item **2369** THEN row SHALL NOT include a **Use** button (Equip only). **Test layer: unit**
22. WHEN **Use** is clicked THEN handler SHALL call `sendUseItem({ itemId: 1060 })`. **Test layer: unit**
23. WHEN `healingPotionCooldownEndMs > nowMs` THEN **Use** button SHALL be `disabled`. **Test layer: unit**
24. WHEN `window.__useItem__(1060)` is called THEN client SHALL send `useItem` intent (spy on `room.send`). **Test layer: unit** (`wire-room` or `room-inventory` spec)
25. WHEN server sets `healingPotionCooldownEndMs` THEN `__GAME_STATE__.healingPotionCooldownRemainingMs` SHALL decrease to **0** when cooldown elapses (client tick or poll). **Test layer: unit**

---

### P4: E2E field recovery ⭐ MVP

**User Story**: As a player who took mob damage, I use a Healing Potion and see HP rise
and stack count fall — verified through the test hook.

**Acceptance Criteria**:

26. WHEN Playwright claims starter kit (**3× 1060**), takes damage outside peace zone
    (`hp < maxHp`), and calls `__useItem__(1060)` THEN `__GAME_STATE__.player.hp` SHALL
    increase by up to **24** (capped at `maxHp`) and `items[1060]` SHALL decrease by **1**.
    **Test layer: e2e** (`expect.poll`, no `waitForTimeout`)
27. WHEN e2e uses potion twice within **10 s** THEN second call SHALL NOT reduce count
    again (poll `items[1060]` stable). **Test layer: e2e**

---

## Edge Cases

- WHEN `hp + 24 > maxHp` THEN heal SHALL cap at `maxHp` (AC4).
- WHEN `hp = maxHp` and use succeeds THEN count still decrements and cooldown still applies (AC10 variant at full HP — room test `hp=100,maxHp=100` → count **2→1**, hp stays **100**).
- WHEN player dies (`hp ≤ 0`) THEN `useItem` SHALL no-op (AC8/room).
- WHEN unknown `itemId` (not in `items` table) THEN `useItem` SHALL no-op.
- WHEN two rapid `useItem` intents arrive same tick THEN only first succeeds if count=1 (server processes sequentially per tick/message).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| CONS-01–09 | P1: Pure heal | Design | Pending |
| CONS-10–19 | P2: Server intent | Design | Pending |
| CONS-20–25 | P3: Client UI | Design | Pending |
| CONS-26–27 | P4: E2E | Design | Pending |

**Coverage:** 27 ACs total, 27 mapped to test layers, 0 unmapped.

---

## Success Criteria

- [ ] Player can use Healing Potion from inventory; server heals **24** HP (capped), decrements stack, enforces **10 s** reuse.
- [ ] `nx test game-core`, `nx test server`, `nx test client`, `nx e2e client-e2e` green; per-test ≤ **10 s** unit/room, ≤ **30 s** e2e (AD-014).
- [ ] Roxxy heal, Katerina buy/sell, equip rejection for **1060** regression tests still pass.
- [ ] Verifier PASS recorded in `validation.md`.
