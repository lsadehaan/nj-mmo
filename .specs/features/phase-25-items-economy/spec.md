# Phase 25 — Items, Economy & Crafting Specification

## Problem Statement

Phases 7, 17, and 20 deliver a single **weapon** equip slot, four-item merchant subsets,
and functional no-grade soulshots — but TI equipment depth is still a thin vertical slice:
armor and jewelry exist in buylist metadata and loot display names without seeded stats,
equip rules, or combat impact; dwarf **Create Item** recipes are absent; enchant is
unsupported; drop tables omit most TI-grade gear and crafting materials.

Phase 25 completes the **Talking Island economy loop**: full No-grade / D-grade item
tables, all paper-doll equip slots, soulshot regression + grade rules, dwarf crafting
from L2J `Recipes.xml`, and a **safe +1..+3** enchant path from L2J rate tables —
all server-authoritative per AD-001.

## Goals

- [ ] Extend `items` schema + seed **TI_ITEM_IDS** (~80 rows): NG/D weapons, armor,
      jewelry, materials, recipe items, D-grade enchant scrolls.
- [ ] Complete merchant buylists for **Lector / Jackson / Silvia** from L2J buylist XML;
      add **Pinter (30298)** blacksmith for scroll sales + enchant service shell.
- [ ] Replace `equippedWeaponItemId` with **`character_equipment`** covering all MVP
      paper-doll slots; server `equip` / `unequip` intents.
- [ ] Armor/jewelry **pDef** (and weapon **pAtk** + enchant bonus) feed combat vitals;
      minimal **armor set** bonus (Wooden set anchor).
- [ ] Dwarf **craft** intent: TI recipe subset from `Recipes.xml`; consume ingredients +
      recipe item + MP.
- [ ] **Enchant** intent: D-grade scrolls **955/956**, safe **+1..+3** at **100%** per
      `EnchantItemGroups.xml`; reject **+4** attempts (stub boundary).
- [ ] Soulshots **1835/2509** regression from Phase 20; document NG-only shot rule for
      TI slice (D-grade soulshot recipe seeded, craftable, not required for combat gate).
- [ ] Unit + seed + room + client `wireRoom` tests; **no Playwright**.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Auction house / player economy sim | Phase 26 / post-TI |
| C/B/A/S-grade equipment & scrolls | TI level cap; D-grade ceiling |
| Enchant **+4+** success/fail/break | Stub stops at safe +3; ROADMAP |
| Blessed / attribute / compound enchant | Post-TI |
| Full inventory weight / slot cap UI | Phase 28 shell |
| Arrow consumption / bow ammo loop | Bow equip only; ammo deferred |
| Shield block / sigil mechanics | pDef stat only for shields |
| Private store / player trade pricing | Phase 26 |
| Full `Sets.xml` port (all sets) | Two TI sets only (Wooden + Mithril) |
| Non-dwarf common craft (sewing) | Dwarf `Recipes.xml` subset only |
| Playwright / `client-e2e` | Post-MVP per ROADMAP + AGENTS.md |

---

## Assumptions & Open Questions

Autonomous Planner decisions (no user gate).

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| AC prefix | **ITEM25-NN** | Matches `TOWN24-NN`, `SKILL20-NN` | y |
| `TI_ITEM_IDS` scope | **~80** ids: all Lector/Jackson/Silvia buylist items + recipe ingredients/products for **19** dwarf recipes (ids 1–19 in `Recipes.xml`) + scrolls **955/956** + existing MVP ids | Full TI merchant triangle + craft loop | y |
| Item schema extensions | `crystalType` (`NG`\|`D`\|`C`…), `pDef`, `mDef`, `enchantEnabled`, `recipeId`, `weaponType`, `isStackable` | L2J fields needed for equip/enchant/craft | y |
| Equip slots | `rhand`, `lrhand`, `lhand`, `chest`, `legs`, `feet`, `gloves`, `head`, `neck`, `earring`, `ring` | Maps L2J `bodypart` (`rear;lear` → `earring`, `rfinger;lfinger` → `ring`) | y |
| One item per slot | Equipping swaps; prior item returns to inventory | Classic paper doll | y |
| Unequip | `unequip { slot }` intent supported | Needed for armor swap tests | y |
| Legacy migration | On load, `equippedWeaponItemId` → `character_equipment.rhand` row | Preserve saves | y |
| `PlayerState` sync | Parallel arrays `equipSlotIds[]` + `equipItemIds[]` + `equipEnchantLevels[]` (max 11) | Client HUD without per-slot schema types | y |
| Effective **pAtk** | `classBasePAtk + weapon.pAtk + enchantPAtkBonus(weapon, level)` | Extends Phase 19 class stats + Phase 7 weapon add | y |
| Effective **pDef** | `classBasePDef + Σ armor.pDef + enchantDefBonus + setBonus` | Mob damage uses player pDef in future; anchor now | y |
| Class base pDef | From `class_templates` new column or `calcClassBasePDef(classId, level)` pure fn | Phase 19 pattern for pAtk | y |
| Enchant bonus formulas | L2J Classic `IStatFunction`: weapon `4×enchant` (1H), armor `enchant` pDef | Safe-zone stub uses linear terms only (+1..+3) | y |
| Enchant grades | **D-grade** items + scrolls **955/956** only; **NG** items (`crystalType` absent) **not enchantable** | L2J has no NG enchant scroll | y |
| Safe enchant | Levels **1–3**: chance **100%** (`enchant 0-2` in `FIGHTER_WEAPON_GROUP` / `ARMOR_GROUP`); **+4** rejected | ROADMAP stub | y |
| Enchant RNG | Seeded `rng` on server; room tests pin `rngOffset` | AD-010 | y |
| Blacksmith NPC | **Pinter 30298** (`Merchant`, title Blacksmith) added to `TI_NPC_IDS` (**26** total) + peace-zone spawn | Phase 24 deferred Pinter; sells **955/956** | y |
| Craft eligibility | `classId` **53** (Dwarf Fighter), **54** (Scavenger), **56** (Artisan) after transfer | L2J dwarf recipes | y |
| Craft MP cost | From recipe `statUse MP`; reject if `mp` insufficient | L2J `Recipes.xml` | y |
| Recipe consumption | Recipe etcitem (e.g. **1786**) consumed **1** per craft | Classic one-shot recipe | y |
| Craft success | **100%** for seeded TI recipes (`successRate="100"`) | Recipes 1–19 anchor | y |
| Soulshot grade | **1835** arms any NG weapon; D weapons require D soulshot (**1463**) when grade check enabled — **defer strict grade gate** to P2; P1 regression on **1835** only | Phase 20 already ships NG path | y |
| Set bonuses | **Wooden** (23+2386+43) and **Mithril** (58+59+47) from `Sets.xml` | ROADMAP “where Classic defines” | y |
| Wooden set effect | Skill **3500**: **+2%** pDef, **+41** maxHp when 3 pieces equipped | L2J skill fixture | y |
| Mithril set effect | Skill **3502**: **+5%** pDef (fixture anchor) | Second set for D-grade | y |
| Drop table expansion | Add TI-relevant armor/material drops to existing mob `drop_tables` for **≥8** mobs | Economy sourcing | y |
| Fixture scope (AD-012) | `items_ti.xml`, `recipes_ti.xml`, `Sets.xml` subset, buylist fixtures, skill **3500/3502** snippets | Portable CI | y |
| Test gate | Unit + room + seed; client `wireRoom` | AGENTS.md post-MVP | y |
| Implicit: auth / rate limits | N/A — local Colyseus room | — | N/A |
| Implicit: concurrency | Per-test isolated room + temp DB (`instanceKey`, AD-014) | Existing pattern | N/A |

**Open questions:** none — all resolved or logged above.

---

## L2J Anchors

### Equip slot map

| Slot key | L2J `bodypart` | Example item |
| -------- | -------------- | ------------ |
| `rhand` | `rhand` | Broadsword **3**, Squire's Sword **2369** |
| `lrhand` | `lrhand` | Short Bow **13** |
| `lhand` | `lhand` | Leather Shield **18** |
| `chest` | `chest` | Wooden Breastplate **23** |
| `legs` | `legs` | Wooden Gaiters **2386** |
| `feet` | `feet` | Leather Shoes **37** |
| `gloves` | `gloves` | Short Gloves **48** |
| `head` | `head` | Wooden Helmet **43** |
| `neck` | `neck` | Necklace of Magic **118** |
| `earring` | `rear;lear` | Apprentice's Earring **112** |
| `ring` | `rfinger;lfinger` | Magic Ring **116** |

### Merchant buylist scope (seed all rows)

| npcId | Name | L2J file | Item count (approx) |
| ----- | ---- | -------- | ------------------- |
| **30001** | Lector | `3000101.xml` | 27 weapons |
| **30002** | Jackson | `3000201.xml` | 33 armor/shields |
| **30003** | Silvia | `3000301.xml` | 18 accessories |
| **30298** | Pinter | hand-seeded | **955**, **956** (D enchant scrolls) |

### Item stat anchors

| itemId | Name | crystalType | pAtk | pDef | bodyPart |
| ------ | ---- | ----------- | ---- | ---- | -------- |
| **3** | Broadsword | NG | **11** | — | rhand |
| **23** | Wooden Breastplate | NG | — | **47** | chest |
| **2386** | Wooden Gaiters | NG | — | **29** | legs |
| **43** | Wooden Helmet | NG | — | **19** | head |
| **58** | Mithril Breastplate | D | — | **95** | chest |
| **2369** | Squire's Sword | NG | **6** | — | rhand |

### Craft anchor — Recipe **2** (Broadsword, recipe item **1786**)

| Field | Value |
| ----- | ----- |
| Ingredients | **2005** ×1, **1869** ×18, **1870** ×18 |
| Product | **3** ×1 (Broadsword) |
| MP cost | **30** |
| Success rate | **100%** |
| Dwarf only | y |

### Enchant anchors (D-grade, 1H sword Broadsword → Mithril Short Sword **69** for D test)

| Scroll | itemId | Target grade |
| ------ | ------ | ------------ |
| Enchant Weapon D | **955** | D weapons |
| Enchant Armor D | **956** | D armor / jewelry |

| Enchant level | pAtk bonus (1H) | pDef bonus (armor) | Success chance |
| ------------- | --------------- | ------------------ | -------------- |
| **+1** | **+4** | **+1** | **100%** |
| **+2** | **+8** | **+2** | **100%** |
| **+3** | **+12** | **+3** | **100%** |
| **+4** | — | — | **rejected** (stub) |

Formula: weapon `4 × enchantLevel`; armor `enchantLevel` (Classic safe zone).

### Soulshot regression (Phase 20)

| Action | Expected |
| ------ | -------- |
| Power Strike L1 + soulshot **1835** vs Gremlin | **142** damage (`×2` on **71**) |
| `useShot` decrements stack | count −1 before hit |

### Wooden set anchor (3 pieces: **23**, **2386**, **43**)

| Stat | Naked Human Fighter L1 | With full Wooden set |
| ---- | ---------------------- | -------------------- |
| pDef bonus | base only | **+2%** pDef (skill 3500) |
| maxHp | class vitals | **+41** |

---

## User Stories

### P1: TI item seed & schema ⭐ MVP

**User Story**: As the authoritative server, TI-grade items, recipes, and sets are in
SQLite with stats needed for equip, craft, and enchant.

**Acceptance Criteria**:

1. **ITEM25-01**: WHEN `items` schema is read THEN columns SHALL include `crystal_type`,
   `p_def`, `m_def`, `enchant_enabled`, `recipe_id`, `weapon_type`, `is_stackable`.
   **Test layer: seed/schema**
2. **ITEM25-02**: WHEN `TI_ITEM_IDS` is read THEN length SHALL be **≥ 75** and include
   **3**, **23**, **1786**, **955**, **956**. **Test layer: unit**
3. **ITEM25-03**: WHEN seed runs THEN `items` SHALL contain one row per `TI_ITEM_IDS`.
   **Test layer: seed**
4. **ITEM25-04**: WHEN item **3** (Broadsword) is read THEN
   `{ pAtk: 11, crystalType: 'NG', bodyPart: 'rhand', enchantEnabled: false }`.
   **Test layer: seed**
5. **ITEM25-05**: WHEN item **58** (Mithril Breastplate) is read THEN
   `{ crystalType: 'D', pDef: 95, bodyPart: 'chest', enchantEnabled: true }`.
   **Test layer: seed**
6. **ITEM25-06**: WHEN item **1786** (Recipe: Broadsword) is read THEN
   `{ type: 'recipe', recipeId: 2 }`. **Test layer: seed**
7. **ITEM25-07**: WHEN `recipes` table exists THEN PK SHALL be `recipe_id` with
   ingredients JSON + `product_item_id`. **Test layer: seed/schema**
8. **ITEM25-08**: WHEN recipe **2** is read THEN product **3** and ingredients match
   craft anchor table. **Test layer: seed**
9. **ITEM25-09**: WHEN `armor_sets` table is read THEN sets **0** (Wooden) and **1**
   (Mithril) SHALL be seeded. **Test layer: seed**
10. **ITEM25-10**: WHEN seed runs twice THEN item + recipe rows SHALL be identical
    (idempotent). **Test layer: seed**

---

### P1: Merchant buylists & blacksmith ⭐ MVP

**Acceptance Criteria**:

11. **ITEM25-11**: WHEN Lector **30001** buylist is queried THEN **27** rows match
    `3000101.xml` prices (e.g. Broadsword buy **14375**). **Test layer: seed**
12. **ITEM25-12**: WHEN Jackson **30002** buylist is queried THEN **≥ 30** armor rows
    exist. **Test layer: seed**
13. **ITEM25-13**: WHEN Silvia **30003** buylist is queried THEN **≥ 15** accessory rows
    exist. **Test layer: seed**
14. **ITEM25-14**: WHEN player buys item **3** at Lector THEN inventory gains **1** and
    adena decreases by listing price. **Test layer: room**
15. **ITEM25-15**: WHEN Pinter **30298** is seeded THEN npc type SHALL be `Merchant` and
    buylist includes **955** and **956**. **Test layer: seed**
16. **ITEM25-16**: WHEN room boots with extended roster THEN `state.npcs` includes
    **30298**. **Test layer: room**

---

### P1: Full equip slots ⭐ MVP

**Acceptance Criteria**:

17. **ITEM25-17**: WHEN `character_equipment` table exists THEN PK SHALL be
    `(character_id, slot)` with `item_id` + `enchant_level`. **Test layer: schema**
18. **ITEM25-18**: WHEN `EQUIP_SLOTS` is read THEN it SHALL list **11** slot keys from
    anchor table. **Test layer: unit**
19. **ITEM25-19**: WHEN player equips Broadsword **3** to `rhand` THEN slot row SHALL
    reference **3** and inventory count SHALL decrease by **1**. **Test layer: room**
20. **ITEM25-20**: WHEN player equips Wooden Breastplate **23** to `chest` THEN server
    SHALL accept and replicate on `PlayerState` equip arrays. **Test layer: room**
21. **ITEM25-21**: WHEN player equips Wooden Gaiters **2386** + Helmet **43** THEN both
    `legs` and `head` slots SHALL be populated. **Test layer: room**
22. **ITEM25-22**: WHEN player equips Magic Ring **116** THEN `ring` slot SHALL be set;
    Necklace **118** → `neck`; Earring **112** → `earring`. **Test layer: room**
23. **ITEM25-23**: WHEN player equips consumable **1060** THEN server SHALL reject.
    **Test layer: room**
24. **ITEM25-24**: WHEN player `unequip`s `chest` THEN item returns to inventory and slot
    clears. **Test layer: room**
25. **ITEM25-25**: WHEN legacy character has `equippedWeaponItemId=2369` only THEN first
    load SHALL migrate to `rhand` equipment row. **Test layer: room**

---

### P1: Equipment stats & set bonuses ⭐ MVP

**Acceptance Criteria**:

26. **ITEM25-26**: WHEN `calcEffectivePAtk` runs with Broadsword **3** equipped THEN
    result SHALL include **+11** over naked class base (Human Fighter anchor). **Test layer: unit**
27. **ITEM25-27**: WHEN `calcPlayerPDef` runs with Wooden Breastplate **23** THEN pDef
    SHALL include **+47**. **Test layer: unit**
28. **ITEM25-28**: WHEN weapon **+3** enchant (D-grade 1H) THEN pAtk bonus SHALL be
    **+12** (`4×3`). **Test layer: unit**
29. **ITEM25-29**: WHEN armor **+3** enchant THEN pDef bonus SHALL be **+3**. **Test layer: unit**
30. **ITEM25-30**: WHEN Wooden set 3-piece equipped THEN `maxHp` SHALL increase by **41**
    and pDef by **2%** vs same pieces without set. **Test layer: unit**
31. **ITEM25-31**: WHEN mob hits player with armor equipped THEN damage SHALL be lower than
    naked (same mob, same rng). **Test layer: room**
32. **ITEM25-32**: WHEN `__GAME_STATE__.equipment` is read after equip THEN `chest` slot
    SHALL show item **23**. **Test layer: client unit**

---

### P1: Soulshots functional (Phase 20 regression) ⭐ MVP

**Acceptance Criteria**:

33. **ITEM25-33**: WHEN player sends `useShot` with **1835** THEN `armedShot` SHALL be
    `soul` and count decrements. **Test layer: room**
34. **ITEM25-34**: WHEN Power Strike hits with armed soulshot THEN damage SHALL be **142**
    vs Gremlin (Phase 20 anchor). **Test layer: room**
35. **ITEM25-35**: WHEN spiritshot **2509** armed THEN Wind Strike damage SHALL remain
    **×2** anchor (**80** vs Gremlin, mystic). **Test layer: room**
36. **ITEM25-36**: WHEN soulshot VFX path runs on attack THEN `shouldSoulshotGlint` still
    fires (client unit regression). **Test layer: client unit**

---

### P1: Dwarf crafting ⭐ MVP

**Acceptance Criteria**:

37. **ITEM25-37**: WHEN Dwarf Fighter **53** sends `craft { recipeId: 2 }` with materials
    THEN inventory gains Broadsword **3** ×1. **Test layer: room**
38. **ITEM25-38**: WHEN craft succeeds THEN ingredients **2005/1869/1870** and recipe
    **1786** SHALL be consumed per anchor counts. **Test layer: room**
39. **ITEM25-39**: WHEN craft runs THEN MP SHALL decrease by **30**. **Test layer: room**
40. **ITEM25-40**: WHEN Human Fighter **0** attempts `craft` THEN server SHALL reject.
    **Test layer: room**
41. **ITEM25-41**: WHEN materials insufficient THEN craft SHALL reject without partial
    consume. **Test layer: room**
42. **ITEM25-42**: WHEN craft dialog opens for dwarf with recipe **1786** in inventory THEN
    **Craft** button SHALL be enabled. **Test layer: client unit**

---

### P1: Enchant +1..+3 stub ⭐ MVP

**Acceptance Criteria**:

43. **ITEM25-43**: WHEN player uses scroll **955** on D-grade weapon at **+0** THEN
    weapon SHALL become **+1** and scroll count −1. **Test layer: room**
44. **ITEM25-44**: WHEN enchanting **+2 → +3** on armor with **956** THEN success SHALL be
    **100%** with seeded rng. **Test layer: room**
45. **ITEM25-45**: WHEN item already **+3** and player attempts another enchant THEN
    server SHALL reject (`max_safe_enchant`). **Test layer: room**
46. **ITEM25-46**: WHEN scroll grade mismatches item (955 on NG Broadsword) THEN reject.
    **Test layer: room**
47. **ITEM25-47**: WHEN NG item **3** enchant attempted THEN reject (`not_enchantable`).
    **Test layer: room**
48. **ITEM25-48**: WHEN enchant succeeds THEN `calcEffectivePAtk` with **+3** D 1H weapon
    reflects **+12** bonus. **Test layer: unit**
49. **ITEM25-49**: WHEN enchant UI opens at Pinter THEN player can select scroll + equipped
    slot (DOM stub). **Test layer: client unit**

---

### P2: Drops & regression ⭐ MVP

**Acceptance Criteria**:

50. **ITEM25-50**: WHEN Gremlin **20001** drop table is read THEN at least one TI material
    (e.g. **1864** Stem) SHALL have `chance > 0`. **Test layer: seed**
51. **ITEM25-51**: WHEN mob kill drops armor piece THEN player inventory gains item
    (seeded rng). **Test layer: room**
52. **ITEM25-52**: WHEN `nx run-many -t build lint test` runs THEN all projects SHALL pass
    (full regression). **Test layer: gate**

---

## Edge Cases

- WHEN equipping to occupied slot THEN previous item returns to inventory before new equip.
- WHEN equipping two-handed weapon (`lrhand`) THEN `lhand` + `rhand` slots both clear or
  block (design: `lrhand` occupies weapon slot group; `rhand`/`lrhand` mutually exclusive).
- WHEN chest piece equipped and player lacks inventory space on unequip THEN reject unequip
  (or block — spec: reject with `inventory_full`).
- WHEN craft produces non-stackable weapon and inventory has no space THEN reject.
- WHEN enchant on equipped item THEN update `character_equipment.enchant_level` in place.
- WHEN player dies THEN equipment persists (no drop this phase).
- WHEN `NJ_AUTOSIM=0` room tests craft/enchant THEN use `deliver()` before assertions
  (AD-014).

---

## Requirement Traceability

| Requirement ID | Story | Status |
| -------------- | ----- | ------ |
| ITEM25-01 … 10 | P1: Item seed & schema | Pending |
| ITEM25-11 … 16 | P1: Merchants & Pinter | Pending |
| ITEM25-17 … 25 | P1: Equip slots | Pending |
| ITEM25-26 … 32 | P1: Stats & sets | Pending |
| ITEM25-33 … 36 | P1: Soulshots | Pending |
| ITEM25-37 … 42 | P1: Crafting | Pending |
| ITEM25-43 … 49 | P1: Enchant stub | Pending |
| ITEM25-50 … 52 | P2: Drops & gate | Pending |

**Coverage:** 52 total, 0 mapped to tasks (pending tasks.md), 0 unmapped.

---

## Success Criteria

- [ ] Player buys TI gear at Lector/Jackson/Silvia, equips full paper doll, sees pDef/pAtk
      change on HUD, crafts a Broadsword as dwarf, safely enchants D-grade gear to **+3**,
      and soulshots still double damage.
- [ ] All **52** ACs traced in `validation.md` with unit/seed/room/client evidence.
- [ ] `TI_NPC_IDS` becomes **26** with Pinter; no Playwright in gate.
