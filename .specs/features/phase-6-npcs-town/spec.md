# Phase 6 — NPCs & Functional Town Specification

## Problem Statement

Phases 1–5 deliver an authoritative combat loop outside the village, but the town
is decorative only: the two seeded NPCs (Katerina, Roxxy) are not placed,
interactable, or functional, players have no adena or shop, and combat is not
blocked in the village peace zone. Phase 6 makes Talking Island a **functional
town**: reach an NPC, open shop/dialog, buy an item with server-validated adena,
use a utility action (heal / starter kit), and be safe from combat inside the
peace zone.

## Goals

- [ ] Shared peace-zone region constant (AD-013) enforced on the **server** for
      melee attack, Power Strike, and mob retaliation (AD-001).
- [ ] Two NPCs placed from seed, synced in room state, rendered as procedural
      geometry (AD-005), with proximity-gated interaction.
- [ ] Merchant shop: server-validated buy/sell against a seeded item list with
      adena balance; minimal item counts (no equip — Phase 7).
- [ ] Utility NPC dialog: server-validated heal (restore HP to max) and one-time
      starter kit (Healing Potions).
- [ ] Unit + room-integration + seed + e2e tests with spec-anchored values.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Full inventory UI, equip, weapon stats | Phase 7 |
| `items` master table with FK from drops | Phase 4 deviation; `itemId` + denormalized name in `merchant_items` |
| Teleport (Roxxy's L2J role) | MVP repurposes Roxxy as newbie helper |
| NPC buylist for every L2J item | Minimal 3-item subset from Katerina buylist |
| Peace-zone polygon matching L2J NPoly exactly | Level-1 semantic map; axis-aligned rect over village ground (AD-006) |
| Client-side gold/items/heal authority | AD-001 |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale |
| --------------------- | -------------- | --------- |
| Peace-zone shape | Axis-aligned rectangle **x ∈ [−20, 20], z ∈ [−20, 20]** (40 m × 40 m, village center origin) | Matches `buildVillage` ground patch (`width=40, depth=40` at origin); L2J `talking_island_town_peace_zone*` NPolys are reference-only (AD-006, AD-013) |
| NPC local positions | **Katerina (30004)**: `x=−6, z=−8`; **Roxxy (30006)**: `x=4, z=10` | Hand-placed inside village bounds using L2J Gludio spawn relative layout (Katerina SW, Roxxy N of center) as placement hint; not raw L2 coords |
| Interaction radius | **3.0** m (`NPC_INTERACT_RADIUS`) | Standard proximity gate; slightly inside melee range (4.0 m) |
| Starting adena | **1000** adena on new character | L2J new chars start ~0; MVP needs playable shop demo; logged assumption |
| Shop item subset | From L2J buylist `3000401.xml` (Katerina): **1060** Healing Potion buy **103**; **1835** Soulshot buy **8**; **17** Wooden Arrow buy **2** | Authentic Classic prices; subset keeps seed/UI small |
| Sell price | `floor(buyPrice / 2)` per item | L2J sell varies by item; MVP uniform half-price sellback |
| Starter kit (Roxxy) | One-time grant of **3×** item **1060** (Healing Potion); `starterKitGranted` flag on character | Useful action without weapon equip (Phase 7); potion id matches shop |
| Heal action | Set `hp` to **100** (starter max HP at level 1) | Matches `createCharacter` default `hp=100` |
| Utility NPC role | Roxxy (30006) acts as **Newbie Helper** (heal + starter kit) despite L2J `type=Teleporter` | Seeded NPC id fixed in Phase 1; teleports deferred |
| Item ownership model | `character_items` table `(character_id, item_id, count)` + synced `MapSchema` on `PlayerState` | Minimal counts for buy/sell; no equip slot |
| Shop messages | Colyseus `room.send('buy', …)` / `sell` / `interact` / `npcAction` + `room.onMessage` handlers in `TownRoom` | Context7 `/colyseus/docs` `room.send` + `onMessage` pattern (0.17) |
| Peace-zone mob aggro | Mobs SHALL NOT acquire targets whose position is inside the peace zone; existing targets cleared when player enters zone | “Cannot be attacked in town” includes mob retaliation |
| E2E buy anchor | Buy **1×** Healing Potion (**103** adena): gold **1000 → 897**, `item_1060` count **0 → 1** | Concrete server-state assertion via `__GAME_STATE__` |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P6: Peace zone — server authority ⭐ MVP

**User Story**: As a player in the village, I cannot deal or receive combat damage
inside the peace zone.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| P6-R01 | Shared `isInPeaceZone(x,z)` constant in `@nj/game-core` |
| P6-R02 | Player melee `attack` deals no damage when attacker is in peace zone |
| P6-R03 | Power Strike deals no damage when caster is in peace zone |
| P6-R04 | Mob melee does not damage players standing in peace zone |

**Acceptance Criteria**:

1. WHEN `isInPeaceZone(0, 0)` THEN result SHALL be **true**; WHEN
   `isInPeaceZone(25, 0)` THEN **false**. **Test layer: unit**
   (`peace-zone.spec.ts`)
2. WHEN `isInPeaceZone(−20, −20)` and `(20, 20)` (inclusive corners) THEN
   **true**; WHEN `(−20.1, 0)` or `(0, 20.1)` THEN **false**. **Test layer: unit**
3. WHEN a player at `(0, 0)` sends `attack` with a live Gremlin target in range
   THEN mob HP SHALL NOT change. **Test layer: room-integration**
   (`TownRoom.spec.ts`)
4. WHEN a player at `(0, 0)` sends `useSkill { skillId: 3 }` with Gremlin target
   in 4.0 m range, `mp≥9`, no cooldown THEN mob HP and `player.mp` SHALL NOT
   change. **Test layer: room-integration**
5. WHEN a mob targets a player and the player moves to `(0, 0)` THEN subsequent
   mob attacks SHALL deal **0** damage to that player. **Test layer: room-integration**
6. WHEN client peace-zone marker exists THEN its center SHALL remain at village
   origin (visual only; server is authority). **Test layer: unit** (client
   `village.spec.ts` unchanged count; optional assert coords)

---

### P6: Shop, adena, and merchant NPC ⭐ MVP

**User Story**: As a player, I can reach Katerina, open her shop, and buy/sell
items with adena validated on the server.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| P6-R05 | `adena` on `characters` + `PlayerState`; new chars start with **1000** |
| P6-R06 | `merchant_items` seeded from Katerina buylist subset (3 items) |
| P6-R07 | `npc_spawns` seeded for Katerina + Roxxy local positions |
| P6-R08 | Server `buy` validates proximity, listing, adena; deducts gold + adds item count |
| P6-R09 | Server `sell` validates proximity, ownership; adds gold + removes item count |
| P6-R10 | Purchases and adena persist via `character-repository` |

**Acceptance Criteria**:

1. WHEN `seedMerchantItems` runs on fixtures THEN Katerina (`npcId=30004`) SHALL
   list item **1060** buy **103**, **1835** buy **8**, **17** buy **2** with
   sell prices **51**, **4**, **1**. **Test layer: seed**
2. WHEN `seedNpcSpawns` runs THEN rows for **30004** at `(−6, −8)` and **30006**
   at `(4, 10)` SHALL exist (y from terrain constant). **Test layer: seed**
3. WHEN `createCharacter` runs THEN `adena` SHALL be **1000**. **Test layer: unit**
4. WHEN player has `adena=1000`, is within **3.0** m of Katerina, and sends
   `buy { npcId: 30004, itemId: 1060, quantity: 1 }` THEN `adena` SHALL be
   **897** and item **1060** count **1**. **Test layer: room-integration**
5. WHEN same player sends `buy` with `adena=50` for item **1060** THEN adena and
   item count SHALL NOT change. **Test layer: room-integration**
6. WHEN player owns **2×** item **1060** and sends
   `sell { npcId: 30004, itemId: 1060, quantity: 1 }` with `adena=897` THEN
   `adena` SHALL be **948** (897+51) and item count **1**. **Test layer: room-integration**
7. WHEN `buy` is sent from distance **3.1** m from Katerina THEN transaction
   SHALL be rejected. **Test layer: room-integration**
8. WHEN buy succeeds THEN debounced save persists `adena` and item count to DB.
   **Test layer: room-integration** (reconnect / reload character)

---

### P6: Utility NPC — heal and starter kit ⭐ MVP

**User Story**: As a wounded player, I can talk to Roxxy, heal to full HP, and
claim a one-time starter kit.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| P6-R11 | Server `interact` validates proximity and returns NPC role |
| P6-R12 | Server `npcAction heal` restores HP to max (**100**) |
| P6-R13 | Server `npcAction starterKit` grants **3×** item **1060** once per character |

**Acceptance Criteria**:

1. WHEN player at `(4, 10)` sends `interact { npcId: 30006 }` THEN server SHALL
   accept (distance ≤ **3.0** m). **Test layer: room-integration**
2. WHEN `interact` sent from **3.1** m from Roxxy THEN SHALL be rejected.
   **Test layer: room-integration**
3. WHEN player `hp=40` sends `npcAction { npcId: 30006, action: 'heal' }` in
   range THEN `hp` SHALL be **100**. **Test layer: room-integration**
4. WHEN `starterKit` sent first time in range THEN item **1060** count SHALL
   increase by **3**; `starterKitGranted` flag set **true**. **Test layer: room-integration**
5. WHEN `starterKit` sent a second time THEN item count SHALL NOT change.
   **Test layer: room-integration**

---

### P6: NPC presence and client presentation ⭐ MVP

**User Story**: As a player, I see both NPCs in the village, get a prompt when
near, and use DOM windows for shop and dialog.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| P6-R14 | `NpcState` synced in `TownState` from seed spawns |
| P6-R15 | Client renders procedural NPC meshes at synced positions (AD-005) |
| P6-R16 | DOM shop window lists merchant items; sends `buy`/`sell` intents only |
| P6-R17 | DOM dialog for Roxxy with Heal / Starter Kit buttons |
| P6-R18 | Proximity prompt + `__GAME_STATE__` exposes adena, items, nearby NPC |
| P6-R19 | E2E: walk to Katerina, buy potion, verify adena; peace zone blocks combat |

**Acceptance Criteria**:

1. WHEN room boots with seeded DB THEN `state.npcs` SHALL contain **2** entries
   with `npcId` **30004** and **30006**. **Test layer: room-integration**
2. WHEN client unit tests run `buildNpcMesh` THEN output SHALL be a `THREE.Group`
   with ≥1 mesh (procedural). **Test layer: unit**
3. WHEN shop DOM opens THEN rows for items **1060**, **1835**, **17** with buy
   prices **103**, **8**, **2** SHALL be visible. **Test layer: unit**
4. WHEN `__GAME_STATE__.adena` is read after join THEN value SHALL be **1000**.
   **Test layer: unit** (hook contract)
5. WHEN Playwright walks to Katerina, opens shop, buys Healing Potion THEN
   `__GAME_STATE__.adena === 897` and item **1060** count **≥ 1**. **Test layer: e2e**
6. WHEN Playwright attempts combat at village center (`0, 0`) THEN mob HP
   unchanged after `__attack__` / `__useSkill__`. **Test layer: e2e**

---

## Requirement Traceability Summary

| Requirement | Primary test layer |
| ----------- | ------------------ |
| P6-R01–R04 | unit + room-integration |
| P6-R05–R10 | seed + room-integration |
| P6-R11–R13 | room-integration |
| P6-R14 | room-integration |
| P6-R15–R18 | unit |
| P6-R19 | e2e |
