# Phase 17 — Talking Island NPC Expansion (+5) Specification

## Problem Statement

The Talking Island vertical slice has two functional town NPCs (Katerina **30004**,
Roxxy **30006**) with rigged GLBs, shop/helper plumbing, and peace-zone safety
(Phases 6 + 12). Five canonical starter-town service NPCs from L2J Classic are
missing — the weapon/armor/accessory merchant triangle, the warehouse keeper, and
the fighter trainer. Players cannot buy weapons/armor/accessories from dedicated
merchants or encounter the iconic town service layout. Phase 17 **adds** five NPCs
end-to-end (seed, placement, distinct human GLBs, shop/dialog interaction) without
replacing Katerina or Roxxy.

## Goals

- [ ] Extend `TI_NPC_IDS` to **seven** npcIds; seed authentic Classic NPC metadata,
      village spawns inside the peace zone, and merchant buylist subsets for
      **30001–30003**.
- [ ] Place five new NPCs at hand-mapped local coordinates that avoid building
      blockers (AD-018) and existing Katerina/Roxxy positions.
- [ ] Source and wire **five distinct rigged human GLBs** with `npc-manifest.ts`
      rows (idle + greet via `cast` → `Interact`).
- [ ] Reuse Phase 6 proximity + `interact` flow: merchants open **npcId-keyed**
      shop window; warehouse/trainer open dialog shells with placeholder actions.
- [ ] Extend `__GAME_STATE__.npcs` so e2e asserts all **seven** TI NPCs render
      `renderKind: 'mesh'` at join.
- [ ] Seed-data, room-integration (buy at Lector), and e2e coverage per AD-010/AD-014.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Full warehouse storage / item deposit | Dialog stub only; no warehouse DB |
| Class change / skill learning (Bitz) | Progression system deferred post-MVP |
| Teleport destinations (Roxxy L2J role) | Still deferred |
| Guards with patrol AI | Static idle NPCs (Phase 12 pattern) |
| NPCs beyond these five | Next roadmap batch |
| Every L2J buylist item | MVP 3-item subset per merchant (Phase 6 pattern) |
| Server `NpcState.action` replication | Cosmetic greet remains client-only (AD-015) |

---

## Assumptions & Open Questions

Every ambiguity is resolved autonomously (Planner cannot consult user).

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| `TI_NPC_IDS` ordering | Sorted Classic ids: `[30001, 30002, 30003, 30004, 30005, 30006, 30026]` | Stable seed/parser iteration; includes existing two | y |
| Fixture XML (AD-012) | Add five `<npc>` nodes to `server/src/seed/__fixtures__/npcs.xml`; add buylist fixtures `buylist_30001.xml`, `buylist_30002.xml`, `buylist_30003.xml`; extend `npc_spawns.json` and `items_subset.xml` | CI portability; no machine L2J path in tests | y |
| Shop subset size | **3 items per merchant** (same cardinality as Katerina) | Phase 6 MVP pattern; keeps UI/seed small | y |
| Sell price | `floor(buyPrice / 2)` per item | Phase 6 uniform sellback | y |
| Spawn Y | `SPAWN_Y` from `@nj/game-core` unless row overrides | Phase 6/9 convention | y |
| Peace zone guard | Every new spawn `(x,z)` SHALL satisfy `isInPeaceZone(x,z)` | Phase 6 rectangle unchanged | y |
| Blocker guard | Every spawn SHALL satisfy `!isBlocked(x,z)` with **0.8 m** NPC margin (shared helper) | AD-018 building AABBs + prop circles | y |
| NPC placement | Hand-mapped coords (design.md table); L2J Gludio spawns are relative hints only (AD-013) | Phase 6 pattern | y |
| Items master table | Extend `items_subset.xml` with shop item ids for the nine new merchant SKUs (weapons/armor/accessories) | Equip/sell paths may reference `items` later; buy validation uses `merchant_items` | y |
| Merchant shop UI | Client display catalog keyed by `npcId` (static constants mirroring seed prices); server validates `buy`/`sell` (AD-001) | Phase 6 Katerina pattern generalized | y |
| Warehouse dialog | Wilford (**30005**): title "Warehouse Keeper"; buttons **Deposit** / **Withdraw** disabled with label "Coming soon"; no `npcAction` side effects | ROADMAP stub | y |
| Trainer dialog | Bitz (**30026**): title "Grand Master"; button **Change Class** disabled "Coming soon" | Class change deferred | y |
| Roxxy helper | Roxxy dialog unchanged (heal + starter kit); `npcAction` still Roxxy-only on server | No regression | y |
| Client routing | `type === 'Merchant'` → shop; `Warehouse` \| `VillageMasterFighter` \| `Teleporter` → dialog variant | Extends `npc-interaction.ts` | y |
| Greet gesture | Client `fireNpcGreet(activeNpcId)` on shop/dialog open (fix hardcoded Katerina id in `room.ts`) | Phase 12 P2; cosmetic | y |
| Asset sourcing | KayKit Adventurers CC0 for four male-coded service NPCs; **no** byte-copy between npcIds; inspect track names before `clipMap` (AD-017, `create-character.md`) | Visual gate dedup; distinct silhouettes | y |
| E2E mesh assertion | Poll `__GAME_STATE__.npcs` at join for **7** entries with `renderKind:'mesh'` — **no long village walk** | AD-014 speed contract | y |
| E2E merchant buy | Walk to Lector only for buy flow; use `expect.poll` + `__interact__`/`__buyItem__` | Spec verification anchor | y |
| Implicit: auth / rate limits | N/A — Colyseus room only | — | N/A |
| Implicit: concurrency | N/A — idempotent seed transaction (AD-011) | — | N/A |
| Implicit: observability | `__GAME_STATE__.npcs` length + per-npc `renderKind` | AD-009 | N/A |

**Open questions:** none — all resolved or logged above.

---

## NPC Roster (Grounded in L2J Classic)

| npcId | Name | L2J type | Title | MVP interaction |
| ----- | ---- | -------- | ----- | ----------------- |
| 30001 | Lector | Merchant | Weapon Merchant | Buy/sell weapons (3-item buylist subset) |
| 30002 | Jackson | Merchant | Armor Merchant | Buy/sell armor (3-item subset) |
| 30003 | Silvia | Merchant | Accessory Merchant | Buy/sell accessories (3-item subset) |
| 30004 | Katerina | Merchant | Grocer | *(existing)* consumables shop |
| 30005 | Wilford | Warehouse | Warehouse Keeper | Dialog stub (deposit/withdraw coming soon) |
| 30006 | Roxxy | Teleporter | Gatekeeper | *(existing)* newbie helper |
| 30026 | Bitz | VillageMasterFighter | Grand Master | Trainer dialog stub |

### Seed anchors — NPC metadata (Classic `stats/npcs/30000-30099.xml`)

| npcId | name | type | title | level |
| ----- | ---- | ---- | ----- | ----- |
| 30001 | Lector | Merchant | Weapon Merchant | 70 |
| 30002 | Jackson | Merchant | Armor Merchant | 70 |
| 30003 | Silvia | Merchant | Accessory Merchant | 70 |
| 30005 | Wilford | Warehouse | Warehouse Keeper | 70 |
| 30026 | Bitz | VillageMasterFighter | Grand Master | 70 |

### Seed anchors — merchant items (L2J buylists `3000101`, `3000201`, `3000301`)

**Lector (30001)** — `buylist_30001.xml`:

| itemId | name (Classic) | buyPrice | sellPrice |
| ------ | -------------- | -------- | --------- |
| 1 | Short Sword | 883 | 441 |
| 4 | Club | 883 | 441 |
| 13 | Short Bow | 883 | 441 |

**Jackson (30002)** — `buylist_30002.xml`:

| itemId | name | buyPrice | sellPrice |
| ------ | ---- | -------- | --------- |
| 21 | Shirt | 169 | 84 |
| 28 | Pants | 105 | 52 |
| 1121 | Apprentice's Shoes | 8 | 4 |

**Silvia (30003)** — `buylist_30003.xml`:

| itemId | name | buyPrice | sellPrice |
| ------ | ---- | -------- | --------- |
| 116 | Magic Ring | 37 | 18 |
| 112 | Apprentice's Earring | 56 | 28 |
| 118 | Necklace of Magic | 75 | 37 |

### Spawn anchors (local metric, peace zone)

| npcId | x | z |
| ----- | --- | --- |
| 30001 | −14 | −2 |
| 30002 | −16 | 4 |
| 30003 | −8 | 2 |
| 30004 | −6 | −8 | *(unchanged)* |
| 30005 | 16 | 0 |
| 30006 | 4 | 10 | *(unchanged)* |
| 30026 | 2 | −4 |

---

## User Stories

### P1: Seed extension — server authority ⭐ MVP

**User Story**: As the authoritative server, I need five additional TI NPCs in the DB
with Classic metadata, village spawns, and merchant listings so shop transactions
are authentic and proximity-gated.

**Acceptance Criteria**:

1. **TINPC-01**: WHEN `TI_NPC_IDS` is read THEN it SHALL contain exactly seven ids:
   `30001, 30002, 30003, 30004, 30005, 30006, 30026`. **Test layer: unit**
2. **TINPC-02**: WHEN seed runs against fixtures THEN `npcs` table SHALL contain
   **seven** rows with names/types/titles matching the roster table. **Test layer: seed**
3. **TINPC-03**: WHEN seed runs THEN Lector (`30001`) SHALL match
   `{ name: 'Lector', type: 'Merchant', title: 'Weapon Merchant', level: 70 }`.
   **Test layer: seed**
4. **TINPC-04**: WHEN seed runs THEN Jackson (`30002`) SHALL match armor merchant
   metadata anchor. **Test layer: seed**
5. **TINPC-05**: WHEN seed runs THEN Silvia (`30003`) SHALL match accessory merchant
   metadata anchor. **Test layer: seed**
6. **TINPC-06**: WHEN seed runs THEN Wilford (`30005`) SHALL match
   `{ type: 'Warehouse', title: 'Warehouse Keeper' }`. **Test layer: seed**
7. **TINPC-07**: WHEN seed runs THEN Bitz (`30026`) SHALL match
   `{ type: 'VillageMasterFighter', title: 'Grand Master' }`. **Test layer: seed**
8. **TINPC-08**: WHEN seed runs THEN Lector merchant_items SHALL list items **1, 4, 13**
   with buy/sell prices from the Lector anchor table. **Test layer: seed**
9. **TINPC-09**: WHEN seed runs THEN Jackson merchant_items SHALL list items **21, 28, 1121**
   with anchor prices. **Test layer: seed**
10. **TINPC-10**: WHEN seed runs THEN Silvia merchant_items SHALL list items **116, 112, 118**
    with anchor prices. **Test layer: seed**
11. **TINPC-11**: WHEN seed runs THEN `npc_spawns` SHALL contain **seven** rows with
    `(x,z)` matching the spawn anchor table. **Test layer: seed**
12. **TINPC-12**: WHEN any seeded NPC spawn is read THEN `(x,z)` SHALL satisfy
    `isInPeaceZone(x,z)`. **Test layer: unit**
13. **TINPC-13**: WHEN any seeded NPC spawn is read THEN `(x,z)` SHALL satisfy
    `!isNpcSpawnBlocked(x,z)` (0.8 m margin vs `isBlocked`). **Test layer: unit**
14. **TINPC-14**: WHEN seed runs twice on the same DB THEN npc/merchant/spawn rows
    SHALL be identical (idempotent). **Test layer: seed**

**Independent Test**: `nx test server` seed + placement specs against `FIXTURE_DATA_DIR`.

---

### P1: NPC manifest + GLB assets ⭐ MVP

**User Story**: As a player, I want each new town NPC to look like a distinct human
with idle animation and greet on interaction.

**Acceptance Criteria**:

15. **TINPC-15**: WHEN `getNpcEntry(npcId)` is called for each of **30001, 30002, 30003,
    30005, 30026** THEN it SHALL return an `NpcEntry` with unique `model` path,
    `clipMap`, `scale`, `feetOffsetY`, `displayName`. **Test layer: unit**
16. **TINPC-16**: WHEN `getNpcEntry` is called for **30004** and **30006** THEN existing
    entries SHALL remain unchanged (regression). **Test layer: unit**
17. **TINPC-17**: WHEN manifest entries for all seven npcIds are compared THEN each
    `model` path SHALL be unique. **Test layer: unit**
18. **TINPC-18**: WHEN each manifest `clipMap` is defined THEN keys
    `{idle, move, attack, cast, die}` SHALL map to non-empty strings verified at ingest.
    **Test layer: unit + visual gate**
19. **TINPC-19**: WHEN each new NPC GLB is vendored THEN `LICENSE.txt` under
    `client/public/models/npcs/` SHALL document KayKit/Quaternius source (AD-004).
    **Test layer: file check**
20. **TINPC-20**: WHEN `node scripts/visual-gate.mjs` runs THEN all seven NPC GLBs
    SHALL PASS structural checks (no dedup violations). **Test layer: visual gate**
21. **TINPC-21**: WHEN character-lab captures idle + greet (`cast`) for each new npcId
    THEN screenshots SHALL be reviewed for distinct silhouettes (AD-017). **Test layer:
    visual gate (perception)**

**Independent Test**: `npc-manifest.spec.ts` + `visual-gate.mjs` + `shoot-character.mjs`.

---

### P1: Interaction — shop + dialog shells ⭐ MVP

**User Story**: As a player, I can interact with merchants for their specific stock and
open placeholder dialogs at the warehouse and trainer.

**Acceptance Criteria**:

22. **TINPC-22**: WHEN player within **3.0 m** of Lector sends
    `buy { npcId: 30001, itemId: 1, quantity: 1 }` with `adena=1000` THEN `adena`
    SHALL be **117** and item **1** count **1**. **Test layer: room-integration**
    (`NJ_AUTOSIM=0`, `tick()`/`deliver()`)
23. **TINPC-23**: WHEN `buy` for Lector item **1** is sent from distance **3.1 m**
    THEN transaction SHALL be rejected (adena unchanged). **Test layer: room-integration**
24. **TINPC-24**: WHEN player interacts with Jackson (`30002`) at proximity THEN client
    SHALL open shop window titled with **Jackson** listing armor subset prices
    **169, 105, 8** buy. **Test layer: unit** (`shop-window.spec.ts`)
25. **TINPC-25**: WHEN player interacts with Silvia (`30003`) THEN shop SHALL list
    accessory subset buy prices **37, 56, 75**. **Test layer: unit**
26. **TINPC-26**: WHEN player interacts with Wilford (`30005`) THEN `#npc-dialog` SHALL
    show warehouse title and disabled deposit/withdraw actions. **Test layer: unit**
27. **TINPC-27**: WHEN player clicks disabled warehouse action THEN server SHALL NOT
    mutate adena/items (no `npcAction` handler). **Test layer: unit** (client does not
    send; optional room regression: unknown action ignored)
28. **TINPC-28**: WHEN player interacts with Bitz (`30026`) THEN dialog SHALL show
    trainer title and disabled class-change action. **Test layer: unit**
29. **TINPC-29**: WHEN any merchant shop opens THEN `fireNpcGreet` SHALL target the
    **interacted** `npcId` (not hardcoded 30004). **Test layer: unit** (`room.ts` /
    greet spy)
30. **TINPC-30**: WHEN Katerina shop flow runs THEN regression prices **103, 8, 2**
    SHALL remain. **Test layer: unit** (existing `shop-window.spec.ts`)

**Independent Test**: `TownRoom.spec.ts` Lector buy + `shop-window.spec.ts` + `npc-dialog.spec.ts`.

---

### P1: Client observability + e2e ⭐ MVP

**User Story**: As the test suite, I want all seven town NPCs visible in
`__GAME_STATE__` without pixel reads.

**Acceptance Criteria**:

31. **TINPC-31**: WHEN game reaches `ready` THEN `__GAME_STATE__.npcs.length` SHALL be
    **≥ 7**. **Test layer: e2e** (`expect.poll`, intervals ≤1000 ms, no `waitForTimeout`)
32. **TINPC-32**: WHEN polled at join THEN each npcId in
    `{30001,30002,30003,30004,30005,30006,30026}` SHALL have `renderKind: 'mesh'`.
    **Test layer: e2e**
33. **TINPC-33**: WHEN idle in town at join THEN each mapped NPC `action` SHALL be
    **`idle`**. **Test layer: e2e**
34. **TINPC-34**: WHEN player walks to Lector and buys Short Sword via hooks THEN
    `adena` SHALL become **117** and shop DOM SHALL show **117**. **Test layer: e2e**
    (`walkTowardInPeaceZone` + `expect.poll` only)
35. **TINPC-35**: WHEN Lector shop opens THEN hook `action` for npcId **30001** SHALL
    become **`cast`** within **2 s** (`expect.poll`). **Test layer: e2e**

**Independent Test**: extend `client-e2e/src/town.spec.ts` or add `ti-npc-expansion.spec.ts`.

---

## Edge Cases

- WHEN `interact` is sent for unknown `npcId` THEN server SHALL no-op (no `interactResult`).
  **Test layer: room-integration** (optional regression)
- WHEN `buy` references item not in that merchant's listing THEN transaction SHALL be
  rejected. **Test layer: room-integration**
- WHEN GLB load fails for a new NPC THEN client SHALL fall back to capsule without
  crashing. **Test layer: unit** (regression on `npc-renderer`)
- WHEN two merchants are within interact radius THEN nearest-NPC prompt SHALL target
  closest only (existing `findNearestInteractableNpc` behavior). **No new test** —
  regression via existing proximity tests

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| TINPC-01–14 | P1: Seed | Design/Tasks | Pending |
| TINPC-15–21 | P1: Manifest + GLB | Design/Tasks | Pending |
| TINPC-22–30 | P1: Interaction | Design/Tasks | Pending |
| TINPC-31–35 | P1: E2E | Design/Tasks | Pending |

**Coverage:** 35 total ACs, 35 mapped to tasks, 0 unmapped.

---

## Success Criteria

- [ ] Seven TI NPCs seeded, spawned in peace zone, and visible as rigged meshes at join
- [ ] Lector weapon shop buy validated server-side with Classic price **883**
- [ ] Warehouse + trainer dialogs present with safe stubs (no storage/class change)
- [ ] Gate green: `nx affected -t test lint` + `nx e2e client-e2e`; no test uses wall-clock sleep (AD-014)
- [ ] Visual gate PASS for all five new NPC assets (structural + reviewed screenshots)
