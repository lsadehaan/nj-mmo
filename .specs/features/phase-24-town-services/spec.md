# Phase 24 — Town Services & Full NPC Roster Specification

## Problem Statement

Phases 17 and 20 added seven merchant/trainer NPCs with stub warehouse and class-change
dialogs; Phase 23 re-homed nine `TI_NPC_IDS` spawns on the expanded 640 m map. Sixteen
canonical Talking Island town NPCs remain missing — High Priest Biotin, eight village
guards, seven folk trainers (beyond Gwinter and Baulro), and functional services:
**warehouse storage**, **Gatekeeper teleports**, **1st class transfer**, and **priest
buffs/resurrect**. Quest Phase 21 stubbed givers onto the partial roster; players still
cannot deposit items, teleport to TI landmarks, or advance beyond starter `classId`.

Phase 24 completes the TI town NPC roster and wires end-to-end town services on the
authoritative server (AD-001), with Vitest-only gates per AGENTS.md.

## Goals

- [ ] Extend `TI_NPC_IDS` to **25** npcIds; seed Classic metadata + L2J Gludio spawns for
      Biotin **30031**, guards **30039–30046**, folk trainers **30027–30036** (full set).
- [ ] **Wilford (30005)** — full warehouse deposit/withdraw persisted in SQLite.
- [ ] **Roxxy (30006)** — Gatekeeper teleport list (TI destinations + adena fees from
      L2J `Roxxy.xml`); retain newbie helper actions for Q255 compatibility.
- [ ] **Bitz (30026)** — 1st class transfer for **fighter** starters (Phase 19 templates).
- [ ] **Biotin (30031)** — High Priest resurrect/heal/bless + **mystic** 1st class transfer.
- [ ] **Folk trainers (30027–30036)** — all wired to `learnSkill` (Phase 20 trees).
- [ ] **Guards** — eight rigged GLBs, static idle in village (non-interactable).
- [ ] Distinct NPC GLBs + manifest rows; visual gate for new humanoids (AD-017).
- [ ] Unit + seed + room-integration + client `wireRoom` tests; **no Playwright**.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Private store / player shops | Phase 26 |
| Castle / clan hall NPCs | Post-TI |
| Gludin / inter-region teleport | Outside TI world bounds (AD-013) |
| Guard combat / PvP | Decorative town NPCs |
| Guard patrol pathing | Static idle MVP; patrol deferred |
| 2nd / 3rd class transfer | Post-TI level gates |
| Class-transfer quest items (Medallion of Warrior, …) | Free transfer at level 20 for TI slice |
| Full L2J HTML dialog port | Shell dialogs + labeled buttons |
| Blacksmith (Pinter) / additional merchants | Phase 25 economy |
| Playwright / `client-e2e` | Post-MVP per ROADMAP + AGENTS.md |

---

## Assumptions & Open Questions

Autonomous Planner decisions (no user gate).

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| AC prefix | **TOWN24-NN** | Matches `TIW23-NN`, `SKILL20-NN` | y |
| `TI_NPC_IDS` final count | **25** sorted ids (table below) | ROADMAP batch + existing nine | y |
| Fixture XML (AD-012) | Add sixteen `<npc>` nodes to `npcs.xml`; regenerate `npc_spawns.json` via `buildNpcSpawnFixture` | Phase 23 spawn pipeline | y |
| Spawn placement | L2J `Gludio.xml` → `l2ToLocal` + `nudgeNpcSpawn` in `ti_village` | Phase 23 TIW23-32–35 | y |
| Guard interaction | `type === 'Guard'` → **no** interact prompt | Decorative; reduces scope | y |
| Guard assets | **Four** KayKit knight GLB variants; assign by npcId (2 guards per variant) | AD-017 distinct silhouettes without 8 unique rigs | y |
| Folk trainer ids | **30027–30036** inclusive; **30031 Biotin** is `VillageMasterPriest`, not `Folk` | L2J types | y |
| `TRAINER_NPC_IDS` | All folk **plus** Bitz; Biotin handles class transfer not `learnSkill` | Phase 20 pattern | y |
| Class transfer level gate | **Level ≥ 20** (L2J ClassMaster first occupation) | Authentic Classic gate; room tests set `level` | y |
| Class transfer cost | **Free** — no quest items | TI slice; SP/quest economy deferred | y |
| Transfer targets | Direct children in L2J `PlayerClass` tree from each starter `classId` | See transfer table | y |
| First-class templates | Seed **17** first-class `class_templates` + vitals from L2J `stats/players/templates/` fixtures | Phase 19 extension | y |
| Post-transfer skills | Re-run `grantAutoGetSkills` for new `classId`; keep learned non-removed skills that remain in tree | Avoid punishing pre-transfer learns | y |
| Warehouse capacity | **100** distinct `itemId` stacks per character | L2J personal warehouse default | y |
| Warehouse rules | No quest items; no equipped weapon; stack counts preserved | AD-001 | y |
| Roxxy destinations | **5** TI teleports from `Roxxy.xml` (exclude Gludin) | Outside `WORLD_*` bounds | y |
| Roxxy fees | Retail adena fees from `Roxxy.xml` | L2J anchor | y |
| Roxxy helper | Keep **Heal** + **Starter Kit** on Roxxy dialog | Q255 + Phase 6 regression | y |
| Biotin services | **Resurrect** (dead only), **Heal** (full HP), **Bless** (apply Might **1068** L1 via effect system) | ROADMAP buffs/resurrect; reuses Phase 20 effect | y |
| Mystic transfer NPC | **Biotin 30031** (`VillageMasterPriest`) | L2J `FirstClassTransferTalk` split | y |
| Fighter transfer NPC | **Bitz 30026** (`VillageMasterFighter`) | ROADMAP | y |
| Teleport intent | `teleport { npcId, destinationId }` | Symmetric with `buy`/`learnSkill` | y |
| Warehouse intents | `warehouseDeposit { npcId, itemId, quantity }` / `warehouseWithdraw { … }` | Server-validated | y |
| Class transfer intent | `classTransfer { npcId, targetClassId }` | Server-validated | y |
| Quest stub cleanup | Q153 third deliver leg: **30041 Arnold** (was stubbed via Bitz narrative only) | Arnold guard now spawned | y |
| Test gate | Unit + room + seed; client `wireRoom` + `__GAME_STATE__` | AD-010 post-MVP | y |
| Implicit: auth / rate limits | N/A — local Colyseus room | — | N/A |
| Implicit: concurrency | Per-test isolated room + temp DB (`instanceKey`, AD-014) | Existing pattern | N/A |

**Open questions:** none — all resolved or logged above.

---

## NPC Roster (25 total)

### Existing (9) — regression only

| npcId | Name | Type | Service |
| ----- | ---- | ---- | ------- |
| 30001 | Lector | Merchant | Weapons shop |
| 30002 | Jackson | Merchant | Armor shop |
| 30003 | Silvia | Merchant | Accessories shop |
| 30004 | Katerina | Merchant | Grocer |
| 30005 | Wilford | Warehouse | **Deposit / withdraw (this phase)** |
| 30006 | Roxxy | Teleporter | **Teleports + helper (extended)** |
| 30026 | Bitz | VillageMasterFighter | **Fighter 1st transfer + learnSkill** |
| 30027 | Gwinter | Folk | Folk trainer (Master) |
| 30033 | Baulro | Folk | Folk trainer (Magister) |

### New (16)

| npcId | Name | L2J type | Title | MVP interaction |
| ----- | ---- | -------- | ----- | ----------------- |
| 30028 | Pintage | Folk | Master | `learnSkill` |
| 30029 | Minia | Folk | Master | `learnSkill` |
| 30030 | Vivyan | Folk | Priestess | `learnSkill` |
| 30031 | Biotin | VillageMasterPriest | High Priest | Resurrect / heal / bless; mystic transfer |
| 30032 | Yohanes | Folk | Priest | `learnSkill` |
| 30034 | Iris | Folk | Magister | `learnSkill` |
| 30035 | Harrys | Folk | Magister | `learnSkill` |
| 30036 | Petron | Folk | Priest | `learnSkill` |
| 30039 | Gilbert | Guard | Captain | Static idle (non-interactable) |
| 30040 | Leon | Guard | Guard | Static idle |
| 30041 | Arnold | Guard | Guard | Static idle |
| 30042 | Abellos | Guard | Guard | Static idle |
| 30043 | Johnstone | Guard | Guard | Static idle |
| 30044 | Chiperan | Guard | Guard | Static idle |
| 30045 | Kenyos | Guard | Guard | Static idle |
| 30046 | Hanks | Guard | Guard | Static idle |

### `TI_NPC_IDS` canonical ordering

`30001, 30002, 30003, 30004, 30005, 30006, 30026, 30027, 30028, 30029, 30030, 30031, 30032, 30033, 30034, 30035, 30036, 30039, 30040, 30041, 30042, 30043, 30044, 30045, 30046`

---

## L2J Anchors

### Roxxy teleports (`teleporters/town/Roxxy.xml` → local via `l2ToLocal`)

| destinationId | Name | L2J (x, y, z) | Local (x, z) | fee (adena) | In scope |
| ------------- | ---- | ------------- | ------------ | ----------- | -------- |
| `obelisk` | Obelisk of Victory | (−99843, 237583, −3568) | (−155.43, 58.17) | **200** | y |
| `northern_ti` | Northern Territory of TI | (−106696, 214691, −3424) | (−223.96, 287.09) | **450** | y |
| `southern_ti` | Southern Territory of TI | (−95336, 240478, −3264) | (−110.36, 29.22) | **140** | y |
| `elven_ruins` | Elven Ruins | (−112367, 234703, −3688) | (−280.67, 86.97) | **590** | y |
| `singing_waterfall` | Singing Waterfall | (−111728, 244330, −3448) | (−274.28, −9.30) | **330** | y |
| `gludin` | Village of Gludin | (−80684, 149834, −3040) | (361.16, 935.66) | 3000 | **n** (out of bounds) |

### 1st class transfer options (`PlayerClass` children)

| Starter classId | Class | Options (target classId → name) |
| --------------- | ----- | --------------------------------- |
| **0** | Human Fighter | **1** Warrior, **4** Knight, **7** Rogue |
| **10** | Human Mystic | **11** Wizard, **15** Cleric |
| **18** | Elven Fighter | **19** Elven Knight, **22** Elven Scout |
| **25** | Elven Mystic | **26** Elven Wizard, **29** Oracle |
| **31** | Dark Fighter | **32** Palus Knight, **35** Assassin |
| **38** | Dark Mystic | **39** Dark Wizard, **42** Shillien Oracle |
| **44** | Orc Fighter | **45** Orc Raider, **47** Orc Monk |
| **49** | Orc Mystic | **50** Orc Shaman |
| **53** | Dwarf Fighter | **54** Scavenger, **56** Artisan |

### Class transfer test anchor (Human Fighter → Warrior)

| Field | Before (classId **0**, level **20**) | After (classId **1**) |
| ----- | -------------------------------------- | --------------------- |
| `maxHp` at level 20 | From L2J `Human Fighter` vitals fixture | From L2J `Warrior` vitals fixture |
| `classBasePAtk` naked | **5** (Phase 19 anchor) | **6** (`floor(4×1.20+20)` Warrior basePAtk **4**, STR 40) |
| Transfer reject | level **19** at Bitz | no change |

### Warehouse test anchor

| Step | Inventory adena | Item **1060** (Healing Potion) | Warehouse **1060** |
| ---- | --------------- | ------------------------------ | ------------------ |
| Start | 1000 | **5** | **0** |
| Deposit **3** at Wilford | 1000 | **2** | **3** |
| Withdraw **1** | 1000 | **3** | **2** |

### Biotin service anchors

| Action | Precondition | Result |
| ------ | ------------ | ------ |
| Resurrect | `hp === 0` | `hp = maxHp`, position unchanged |
| Heal | `hp < maxHp` | `hp = maxHp` |
| Bless | alive, in range | `activeBuffSkillId = 1068`, Might +8% P.Atk (Phase 20) |
| Resurrect reject | `hp > 0` | no-op |

---

## User Stories

### P1: Full NPC roster seed ⭐ MVP

**User Story**: As the authoritative server, all twenty-five TI town NPCs exist in SQLite
with Classic metadata and peace-zone spawns on the expanded map.

**Acceptance Criteria**:

1. **TOWN24-01**: WHEN `TI_NPC_IDS` is read THEN length SHALL be **25** and include
   **30031** and **30039–30046**. **Test layer: unit** (`paths.ts`)
2. **TOWN24-02**: WHEN seed runs THEN `npcs` SHALL contain **25** rows. **Test layer: seed**
3. **TOWN24-03**: WHEN Biotin **30031** row is read THEN
   `{ name: 'Biotin', type: 'VillageMasterPriest', title: 'High Priest' }`. **Test layer: seed**
4. **TOWN24-04**: WHEN guard **30041** (Arnold) row is read THEN
   `{ name: 'Arnold', type: 'Guard', title: 'Guard' }`. **Test layer: seed**
5. **TOWN24-05**: WHEN folk **30028** (Pintage) row is read THEN
   `{ type: 'Folk', title: 'Master' }`. **Test layer: seed**
6. **TOWN24-06**: WHEN `npc_spawns` is queried THEN **25** rows exist with coordinates
   matching regenerated fixture (±0.1 m). **Test layer: seed**
7. **TOWN24-07**: WHEN any NPC spawn `(x,z)` is read THEN `getZoneAt(x,z).zoneId` SHALL be
   `ti_village` and `type` SHALL be `peace`. **Test layer: unit**
8. **TOWN24-08**: WHEN any NPC spawn is read THEN `isWalkable(x,z)` SHALL be **true**.
   **Test layer: unit**
9. **TOWN24-09**: WHEN seed runs twice THEN npc + spawn rows SHALL be identical (idempotent).
   **Test layer: seed**
10. **TOWN24-10**: WHEN room boots THEN `state.npcs` size SHALL be **25**. **Test layer: room**

---

### P1: NPC manifest & guard visuals ⭐ MVP

**User Story**: As a player, every town NPC renders as a distinct rigged humanoid (or guard
variant) with idle animation.

**Acceptance Criteria**:

11. **TOWN24-11**: WHEN `getNpcEntry` is called for each new npcId **30028–30032, 30034–30036,
    30039–30046** THEN it SHALL return a non-null `NpcEntry`. **Test layer: unit**
12. **TOWN24-12**: WHEN all **25** manifest `model` paths are compared THEN each SHALL be
    unique OR documented guard variant group (max **4** guard base models). **Test layer: unit**
13. **TOWN24-13**: WHEN `getNpcEntry(30004)` and `getNpcEntry(30006)` are called THEN results
    SHALL match pre-Phase-24 entries (regression). **Test layer: unit**
14. **TOWN24-14**: WHEN client joins THEN `__GAME_STATE__.npcs` length SHALL be **25** and
    each `renderKind` SHALL be `'mesh'`. **Test layer: client unit**
15. **TOWN24-15**: WHEN guard **30039** is in scene THEN NPC SHALL NOT offer interact prompt
    within radius. **Test layer: client unit**
16. **TOWN24-16**: WHEN visual gate runs on new NPC PNGs THEN **0 FAIL** (AD-017).
    **Test layer: visual gate**

---

### P1: Folk trainer expansion ⭐ MVP

**User Story**: As a player, I can learn class-tree skills at any folk trainer in the
village (not only Gwinter and Baulro).

**Acceptance Criteria**:

17. **TOWN24-17**: WHEN `TRAINER_NPC_IDS` (or equivalent) is read THEN it SHALL include
    **30027–30036** except Biotin **30031**. **Test layer: unit**
18. **TOWN24-18**: WHEN Human Mystic learns **1068** at **30030** Vivyan THEN `knownSkillIds`
    SHALL include **1068**. **Test layer: room**
19. **TOWN24-19**: WHEN player sends `learnSkill` at **30034** Iris out of range THEN server
    SHALL reject. **Test layer: room**
20. **TOWN24-20**: WHEN folk trainer dialog opens for eligible mystic THEN learn button for
    **1068** SHALL render. **Test layer: client unit**

---

### P1: Wilford warehouse ⭐ MVP

**User Story**: As a player, I deposit and withdraw items at Wilford with server-persisted
warehouse storage.

**Acceptance Criteria**:

21. **TOWN24-21**: WHEN `warehouse_items` table exists THEN PK SHALL be
    `(character_id, item_id)`. **Test layer: seed/schema**
22. **TOWN24-22**: WHEN player deposits **3** of item **1060** at Wilford THEN inventory count
    SHALL be **2** and warehouse count **3** (anchor table). **Test layer: room**
23. **TOWN24-23**: WHEN player withdraws **1** of item **1060** THEN inventory **3** and
    warehouse **2**. **Test layer: room**
24. **TOWN24-24**: WHEN depositing a quest item THEN server SHALL reject. **Test layer: room**
25. **TOWN24-25**: WHEN deposit quantity exceeds inventory THEN server SHALL reject.
    **Test layer: room**
26. **TOWN24-26**: WHEN warehouse action out of Wilford range THEN server SHALL reject.
    **Test layer: room**
27. **TOWN24-27**: WHEN warehouse dialog opens THEN **Deposit** and **Withdraw** buttons SHALL
    be enabled (not "Coming soon"). **Test layer: client unit**
28. **TOWN24-28**: WHEN deposit succeeds THEN `__GAME_STATE__.warehouse` reflects item **1060**
    count **3**. **Test layer: client unit**

---

### P1: Roxxy Gatekeeper teleports ⭐ MVP

**User Story**: As a player, I pay adena at Roxxy to teleport to TI landmark destinations.

**Acceptance Criteria**:

29. **TOWN24-29**: WHEN `teleportDestinations` seed is read THEN **5** TI rows for npcId
    **30006** SHALL match fee anchors. **Test layer: seed**
30. **TOWN24-30**: WHEN player teleports to `obelisk` with **200** adena THEN position SHALL
    be within **1 m** of (−155.43, 58.17) and adena decreases by **200**. **Test layer: room**
31. **TOWN24-31**: WHEN adena is insufficient for fee THEN teleport SHALL reject.
    **Test layer: room**
32. **TOWN24-32**: WHEN teleport out of Roxxy range THEN server SHALL reject.
    **Test layer: room**
33. **TOWN24-33**: WHEN teleport completes THEN `PlayerState.zoneId` SHALL match
    `getZoneAt(x,z).zoneId`. **Test layer: room**
34. **TOWN24-34**: WHEN Roxxy dialog opens THEN destination buttons SHALL include
    **Obelisk of Victory** and **Elven Ruins**. **Test layer: client unit**
35. **TOWN24-35**: WHEN Roxxy **Heal** / **Starter Kit** are used THEN Phase 6 behavior SHALL
    hold (regression). **Test layer: room**

---

### P1: 1st class transfer (Bitz + Biotin) ⭐ MVP

**User Story**: As a level-20 starter, I change to my first occupation at the correct
village master with updated class stats.

**Acceptance Criteria**:

36. **TOWN24-36**: WHEN `getFirstClassOptions(0)` is called THEN result SHALL be
    `[1, 4, 7]`. **Test layer: unit** (`class-transfer.ts`)
37. **TOWN24-37**: WHEN first-class templates are seeded THEN classId **1** (Warrior) SHALL
    have `class_templates` row with L2J base stats. **Test layer: seed**
38. **TOWN24-38**: WHEN Human Fighter **0** level **20** transfers to **1** at Bitz THEN
    `classId` SHALL be **1** and `maxHp` SHALL match Warrior level-20 vitals fixture.
    **Test layer: room**
39. **TOWN24-39**: WHEN level **19** fighter attempts transfer at Bitz THEN server SHALL
    reject. **Test layer: room**
40. **TOWN24-40**: WHEN Human Mystic **10** attempts transfer at Bitz THEN server SHALL
    reject. **Test layer: room**
41. **TOWN24-41**: WHEN Human Mystic **10** level **20** transfers to **11** at Biotin THEN
    `classId` SHALL be **11**. **Test layer: room**
42. **TOWN24-42**: WHEN transfer succeeds THEN `grantAutoGetSkills` runs for new class and
    `classId`/`str`…`men` replicate on `PlayerState`. **Test layer: room**
43. **TOWN24-43**: WHEN Bitz trainer dialog opens for eligible fighter level **20** THEN
    **Change Class** options SHALL list Warrior / Knight / Rogue. **Test layer: client unit**

---

### P1: Biotin High Priest services ⭐ MVP

**User Story**: As a player, I resurrect, heal, and receive a blessing at the temple.

**Acceptance Criteria**:

44. **TOWN24-44**: WHEN dead player (`hp=0`) uses Biotin **Resurrect** THEN `hp` SHALL equal
    `maxHp`. **Test layer: room**
45. **TOWN24-45**: WHEN alive player uses **Resurrect** THEN state SHALL be unchanged.
    **Test layer: room**
46. **TOWN24-46**: WHEN injured player uses **Heal** THEN `hp` SHALL equal `maxHp`.
    **Test layer: room**
47. **TOWN24-47**: WHEN player uses **Bless** THEN `activeBuffSkillId` SHALL be **1068**
    (Might). **Test layer: room**
48. **TOWN24-48**: WHEN Biotin action out of range THEN server SHALL reject.
    **Test layer: room**

---

### P2: Quest authenticity & regression ⭐ MVP

**Acceptance Criteria**:

49. **TOWN24-49**: WHEN Q153 step 2 deliver target is read THEN `npcId` SHALL be **30041**
    (Arnold). **Test layer: seed**
50. **TOWN24-50**: WHEN `nx run-many -t build lint test` runs after seed THEN all projects
    SHALL pass (regression). **Test layer: gate**

---

## Edge Cases

- WHEN warehouse at capacity (**100** distinct items) and deposit would add a new itemId
  THEN reject.
- WHEN player transfers class THEN equipped weapon remains if still valid; otherwise unequip.
- WHEN player teleports while dead THEN reject (must resurrect first).
- WHEN two teleport destinations share similar coords THEN `destinationId` disambiguates.
- WHEN `NJ_AUTOSIM=0` room tests teleport THEN use `deliver()` before reading position
  (AD-014).
- WHEN folk trainer and Bitz share learnable skills THEN either NPC can teach (tree gate only).

---

## Requirement Traceability

| Requirement ID | Story | Status |
| -------------- | ----- | ------ |
| TOWN24-01 … 10 | P1: Roster seed | Pending |
| TOWN24-11 … 16 | P1: Manifest & guards | Pending |
| TOWN24-17 … 20 | P1: Folk trainers | Pending |
| TOWN24-21 … 28 | P1: Warehouse | Pending |
| TOWN24-29 … 35 | P1: Roxxy teleports | Pending |
| TOWN24-36 … 43 | P1: Class transfer | Pending |
| TOWN24-44 … 48 | P1: Biotin services | Pending |
| TOWN24-49 … 50 | P2: Quest + gate | Pending |

**Coverage:** 50 total, 0 mapped to tasks (pending tasks.md), 0 unmapped.

---

## Success Criteria

- [ ] All **25** TI town NPCs spawn in `ti_village` and render as rigged meshes.
- [ ] Warehouse, teleport, class transfer, priest services, and folk learnSkill work
      server-side with room tests anchored to spec values.
- [ ] Roxxy retains Q255 helper actions; Gludin teleport excluded.
- [ ] Visual gate records new NPC PASS; full Vitest gate green.
