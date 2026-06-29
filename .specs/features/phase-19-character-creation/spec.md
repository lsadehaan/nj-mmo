# Phase 19 — Character Creation & Classes Specification

## Problem Statement

Phases 1–18 deliver a complete Talking Island vertical slice, but every player is
an identical **Adventurer** with hard-coded vitals (`maxHp=100`, `maxMp=50`) and
combat profile (`STARTER_COMBAT.pAtk=10`). Joining the room auto-creates a default
character with no race/class choice, and every player renders as the KayKit **Rogue**
regardless of build.

Phase 19 introduces **authentic L2 Classic starter classes** — nine starting paths
(Human/Elf/Dark Elf/Orc Fighter+Mystic, Dwarf Fighter) — with L2J-anchored base stats,
per-class HP/MP curves, server-authoritative combat derived from class templates, a
character-creation UI, and per-class player avatars.

## Goals

- [ ] Seed **nine** L2J `StartingClass` templates (`stats/players/templates/StartingClass/*.xml`)
      into a `class_templates` master table (+ level vitals curve).
- [ ] Character creation screen: pick **race → archetype (Fighter/Mystic) → gender**;
      Dwarf is Fighter-only.
- [ ] Server persists `classId` + `sex` on `characters`; join with `create` options
      applies template vitals/stats; resume with stored `characterId` unchanged.
- [ ] Combat + level-up use class stats server-side (`getPlayerPAtk`, `maxHp`/`maxMp`
      from L2J `lvlUpgainData`, not flat `STARTER_COMBAT` / `HP_PER_LEVEL`).
- [ ] Client `player-manifest.ts` maps each `classId` to a distinct KayKit GLB;
      local + remote avatars reflect `PlayerState.classId`.
- [ ] Tests per AGENTS.md post-MVP gate: **unit + room-integration + seed/data only**
      (no Playwright). Client wiring via `wireRoom` unit tests + `__GAME_STATE__`.
- [ ] Mandatory visual gate (AD-017) for all nine class avatars.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| 1st class transfer (Village Master / Bitz) | Phase 24 + Phase 20 |
| Subclasses / dual class | Post-TI |
| Face/hair customization beyond class + gender pick | Cosmetic stretch |
| Custom character names | Keep `Adventurer` default; Phase 28 login shell |
| Full L2J `statBonus.xml` for every derived stat (mAtk, pDef, …) | Phase 20 magic/combat depth |
| Magic damage scaling from INT | Phase 20; Power Strike stays physical |
| Character delete / multi-character per account | Phase 28 |
| Playwright / `client-e2e` | Removed post-MVP per ROADMAP + AGENTS.md |

---

## Assumptions & Open Questions

Every ambiguity resolved autonomously (Planner cannot consult user).

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Starter class set | Nine L2J `StartingClass` templates: classIds **0, 10, 18, 25, 31, 38, 44, 49, 53** | ROADMAP scope; maps to race Fighter/Mystic paths | y |
| `sex` encoding | **0 = male**, **1 = female** (L2 convention) | Persisted on `characters.sex` + `PlayerState.sex` | y |
| Creation join payload | `joinOrCreate('town', { create: { classId, sex } })` when no stored `characterId` | Extends existing Colyseus join options pattern | y |
| Resume join payload | `joinOrCreate('town', { characterId })` only — **no** `create` | Phase 3 reconnect contract preserved | y |
| Invalid `create` | Server rejects join (or creates Human Fighter male) — **reject with error** | Prevents client trust; room test asserts rejection for bad classId | y |
| Legacy characters (no `class_id` column yet) | Migration default `class_id=0`, `sex=0`; **do not** retroactively change stored hp/maxHp on load | Avoids breaking existing save DBs mid-session | y |
| New characters only get L2J vitals | `createCharacter({ classId, sex })` sets hp/mp/maxHp/maxMp from template level 1 | ROADMAP “curves differ by class” | y |
| Naked `pAtk` formula | `floor(template.basePAtk × strBonus(STR) + level)` using `statBonus.xml` STR table | L2J-inspired; uses parsed base stats; simpler than full Java `PAttackFinalizer` | y |
| Weapon `pAtk` | Existing `effectivePAtk(classBasePAtk, weaponId, weapon.pAtk)` additive model | Phase 7 equip contract; weapon adds L2J item stat | y |
| Level-up vitals | Lookup `class_level_vitals(classId, newLevel)` from L2J `lvlUpgainData`; full HP/MP restore | Replaces flat `HP_PER_LEVEL=12` / `MP_PER_LEVEL=5` | y |
| `STARTER_COMBAT` | Retain `meleeRange`, `attackSpeed` shared constants; **remove** fixed `pAtk=10` from combat path | Class template supplies combat scalars | y |
| Character name | Fixed **`Adventurer`** | ROADMAP omits naming; Phase 28 deferred | y |
| Gender → GLB | Primary key is **`classId`**; gender affects manifest only where a distinct GLB exists (else same model, optional ±3% scale) | KayKit pack has no female variants; fidelity within pack limits | y |
| Creation UI placement | Full-screen DOM overlay **before** `connectSafe()` when `localStorage` lacks `nj.characterId` | Blocks silent auto-create | y |
| `PlayerState` stat replication | Replicate `classId`, `sex`, and six base stats (`str`…`men`) for HUD + tests | AD-001: combat still server-only; stats are read-only mirrors | y |
| Fixture scope (AD-012) | Commit trimmed `StartingClass/*.xml` (9 files) + `statBonus_str_subset.xml` under `server/src/seed/__fixtures__/players/` | Portable CI; mirrors monsters.xml pattern | y |
| Visual assets | Reuse existing KayKit GLBs (`Knight`, `Mage`, `Rogue`, `Rogue_Hooded`, `Barbarian`); no new GLB required if mapping is fidelity-acceptable | AD-017 curated-first; `game-designer` → `create-character.md` | y |
| Implicit: auth / rate limits | N/A — local Colyseus room | — | N/A |
| Implicit: concurrency | Per-test isolated room + temp DB (`instanceKey`, AD-014) | Existing pattern | N/A |

**Open questions:** none — all resolved or logged above.

---

## L2J Anchors (Classic Starting Classes)

Source: `stats/players/templates/StartingClass/*.xml` + `stats/statBonus.xml` (STR).

### classId map (creation UI → server)

| Race | Fighter classId | Mystic classId |
| ---- | --------------- | -------------- |
| Human | **0** | **10** |
| Elf | **18** | **25** |
| Dark Elf | **31** | **38** |
| Orc | **44** | **49** |
| Dwarf | **53** | *(n/a — UI hides Mystic)* |

### Base stats (level 1, from L2J `staticData`)

| classId | Class | STR | DEX | CON | INT | WIT | MEN |
| ------- | ----- | --- | --- | --- | --- | --- | --- |
| 0 | Human Fighter | 40 | 30 | 43 | 21 | 11 | 25 |
| 10 | Human Mystic | 22 | 21 | 27 | 41 | 20 | 39 |
| 18 | Elven Fighter | 36 | 35 | 36 | 23 | 14 | 26 |
| 25 | Elven Mystic | 21 | 24 | 25 | 37 | 23 | 40 |
| 31 | Dark Fighter | 41 | 34 | 32 | 25 | 12 | 26 |
| 38 | Dark Mystic | 23 | 23 | 24 | 44 | 19 | 37 |
| 44 | Orc Fighter | 40 | 26 | 47 | 18 | 12 | 27 |
| 49 | Orc Mystic | 27 | 24 | 31 | 31 | 15 | 42 |
| 53 | Dwarf Fighter | 39 | 29 | 45 | 20 | 10 | 27 |

### Level 1 vitals (`lvlUpgainData` level val=1)

| classId | maxHp | maxMp |
| ------- | ----- | ----- |
| 0 | **80** | **30** |
| 10 | **101** | **40** |
| 18 | **89** | **30** |
| 25 | **104** | **40** |
| 31 | **94** | **30** |
| 38 | **106** | **40** |
| 44 | **80** | **30** |
| 49 | **95** | **40** |
| 53 | **80** | **30** |

### Level 2 vitals (level-up anchor — Human Fighter)

| classId | maxHp | maxMp |
| ------- | ----- | ----- |
| 0 | **91.83** | **35.46** |

### Combat anchors (naked melee vs Gremlin `pDef=44.44444`, `rngOffset=0`)

Formula: `classBasePAtk = floor(basePAtk × strBonus(STR) + level)`; damage = `calcMeleeDamage({ pAtk: classBasePAtk, randomDamage: 10 }, …)`.

| classId | basePAtk | strBonus | classBasePAtk | melee damage |
| ------- | -------- | -------- | ------------- | ------------ |
| 0 | 4 | 1.20 | **5** | **8** |
| 10 | 3 | 0.63 | **2** | **3** |
| 38 | 3 | 0.66 | **2** | **3** |

Equipped **Squire's Sword** (2369, `pAtk=6`) on Human Fighter (0): effective `pAtk=11` → melee damage **19** (`floor(11×77/44.44444)`).

---

## User Stories

### P1: Class template seed ⭐ MVP

**User Story**: As a developer, I have nine authentic L2J starter class rows and per-level
HP/MP curves in SQLite, testable without the external L2J tree.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| CHAR19-R01 | Parser for `StartingClass/*.xml` → `class_templates` + `class_level_vitals` |
| CHAR19-R02 | Fixture subset under `server/src/seed/__fixtures__/players/` (AD-012) |
| CHAR19-R03 | `seedClassTemplates` idempotent; wired into main seed runner |

**Acceptance Criteria**:

1. WHEN `seedClassTemplates` runs THEN table `class_templates` SHALL contain **9** rows with classIds **0, 10, 18, 25, 31, 38, 44, 49, 53**. **Test layer: seed**
2. WHEN classId **0** is loaded THEN `baseStr` SHALL be **40** and `baseMen` SHALL be **25**. **Test layer: seed**
3. WHEN classId **10** is loaded THEN `baseInt` SHALL be **41** and `baseStr` SHALL be **22**. **Test layer: seed**
4. WHEN classId **0** level **1** vitals are loaded THEN `hp` SHALL be **80** and `mp` SHALL be **30**. **Test layer: seed**
5. WHEN classId **0** level **2** vitals are loaded THEN `hp` SHALL be **91.83** and `mp` SHALL be **35.46**. **Test layer: seed**
6. WHEN classId **38** level **1** vitals are loaded THEN `hp` SHALL be **106** and `mp` SHALL be **40**. **Test layer: seed**

---

### P2: Pure class stat & combat functions ⭐ MVP

**User Story**: As a developer, I have testable pure functions for STR bonus lookup,
class base `pAtk`, vitals at level, and level-up reward from class curves.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| CHAR19-R04 | `lookupStrBonus(str)` from committed `statBonus` fixture |
| CHAR19-R05 | `calcClassBasePAtk(template, level)` |
| CHAR19-R06 | `classVitalsAtLevel(template, level)` |
| CHAR19-R07 | `applyClassLevelUpReward(prevLevel, newLevel, classId, vitals, curve)` |

**Acceptance Criteria**:

7. WHEN `lookupStrBonus(40)` THEN result SHALL be **1.2**. **Test layer: unit**
8. WHEN `calcClassBasePAtk({ basePAtk: 4, baseStr: 40 }, 1)` THEN result SHALL be **5**. **Test layer: unit**
9. WHEN `calcClassBasePAtk({ basePAtk: 3, baseStr: 22 }, 1)` THEN result SHALL be **2**. **Test layer: unit**
10. WHEN `calcMeleeDamage` uses Human Fighter naked `pAtk=5` vs Gremlin, `rngOffset=0` THEN damage SHALL be **8**. **Test layer: unit**
11. WHEN `calcMeleeDamage` uses Human Mystic naked `pAtk=2` vs Gremlin, `rngOffset=0` THEN damage SHALL be **3**. **Test layer: unit**
12. WHEN `classVitalsAtLevel(0, 1)` THEN `{ maxHp: 80, maxMp: 30 }`. **Test layer: unit**
13. WHEN `applyClassLevelUpReward` for classId **0** from level **1→2** THEN `maxHp` SHALL be **91.83**, `maxMp` **35.46**, `hp`/`mp` fully restored. **Test layer: unit**

---

### P3: DB schema & character persistence ⭐ MVP

**User Story**: As a player, my race/class and gender are stored on my character row
and survive reconnect.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| CHAR19-R08 | `characters.class_id`, `characters.sex` columns + migration |
| CHAR19-R09 | `createCharacter(db, { classId, sex })` applies template vitals |
| CHAR19-R10 | `saveCharacter` / `loadCharacter` round-trip `classId`, `sex` |

**Acceptance Criteria**:

14. WHEN `createCharacter(db, { classId: 10, sex: 1 })` THEN row SHALL have `classId=10`, `sex=1`, `maxHp=101`, `maxMp=40`, `hp=101`, `mp=40`. **Test layer: unit** (server `character-repository.spec.ts`)
15. WHEN character is saved and reloaded THEN `classId` and `sex` SHALL match. **Test layer: unit**
16. WHEN migration runs on existing row without `class_id` THEN default SHALL be `classId=0`, `sex=0`. **Test layer: unit**

---

### P4: Server join & combat integration ⭐ MVP

**User Story**: As a new player, I join with my class choice and fight with class-appropriate
stats; returning players resume unchanged.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| CHAR19-R11 | `onJoin` accepts `{ create: { classId, sex } }` |
| CHAR19-R12 | `PlayerState` replicates `classId`, `sex`, six base stats |
| CHAR19-R13 | `getPlayerPAtk` uses `calcClassBasePAtk` + `effectivePAtk` |
| CHAR19-R14 | Level-up + death respawn use class vitals curve |
| CHAR19-R15 | Reject invalid `classId` (not in starter set) |

**Acceptance Criteria**:

17. WHEN client joins with `{ create: { classId: 25, sex: 0 } }` THEN `PlayerState.classId` SHALL be **25**, `maxHp` **104**, `maxMp` **40**, `baseInt` **37**. **Test layer: room-integration**
18. WHEN client joins with `{ create: { classId: 0, sex: 0 } }` and attacks Gremlin unarmed (`rngOffset=0`) THEN first hit damage SHALL be **8**. **Test layer: room-integration**
19. WHEN client joins with `{ create: { classId: 10, sex: 0 } }` and attacks Gremlin unarmed THEN first hit damage SHALL be **3**. **Test layer: room-integration**
20. WHEN Human Fighter (`classId=0`) gains enough XP for level **2** THEN `maxHp` SHALL be **91.83** and `hp` SHALL equal `maxHp`. **Test layer: room-integration**
21. WHEN join includes `{ create: { classId: 99, sex: 0 } }` THEN room SHALL NOT apply template (join error or no player added). **Test layer: room-integration**
22. WHEN client rejoins with valid `characterId` THEN `classId`/`sex` SHALL match persisted row (no re-create). **Test layer: room-integration**

---

### P5: Character creation UI ⭐ MVP

**User Story**: As a new player, I see a creation screen, pick race/archetype/gender,
and only then enter the world.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| CHAR19-R16 | `#character-creation` DOM overlay (race → archetype → gender → Create) |
| CHAR19-R17 | Dwarf hides Mystic; Orc/Human/Elf/Dark Elf show both |
| CHAR19-R18 | Create triggers `connect` with `{ create }`; stores returned `characterId` |
| CHAR19-R19 | Skip overlay when `nj.characterId` already in `localStorage` |

**Acceptance Criteria**:

23. WHEN app boots without stored `characterId` THEN `#character-creation` SHALL be visible and canvas game SHALL NOT connect yet. **Test layer: unit** (client `character-creation.spec.ts`)
24. WHEN user selects Dwarf THEN Mystic option SHALL be hidden/disabled. **Test layer: unit**
25. WHEN user confirms Human → Mystic → Female THEN `joinOrCreate` options SHALL include `{ create: { classId: 10, sex: 1 } }`. **Test layer: unit**
26. WHEN stored `characterId` exists THEN creation overlay SHALL NOT mount. **Test layer: unit**

---

### P6: Per-class avatar manifest ⭐ MVP

**User Story**: As a player, my avatar visually matches my starter class; other players
see my class-appropriate model.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| CHAR19-R20 | `player-manifest.ts`: `classId` → `{ model, clipMap, scale }` (9 entries) |
| CHAR19-R21 | `createPlayerAvatar({ classId })` selects manifest entry |
| CHAR19-R22 | Remote players use joiner's `PlayerState.classId` for avatar |
| CHAR19-R23 | Visual gate: 9 class screenshots via `character-lab` + `shoot-character.mjs` |

**Acceptance Criteria**:

27. WHEN `getPlayerManifestEntry(0)` THEN `model` SHALL be `/models/characters/Knight.glb`. **Test layer: unit**
28. WHEN `getPlayerManifestEntry(10)` THEN `model` SHALL be `/models/characters/Mage.glb`. **Test layer: unit**
29. WHEN `getPlayerManifestEntry(31)` THEN `model` SHALL be `/models/characters/Rogue_Hooded.glb`. **Test layer: unit**
30. WHEN `getPlayerManifestEntry(44)` THEN `model` SHALL be `/models/characters/Barbarian.glb`. **Test layer: unit**
31. WHEN all nine classIds are enumerated THEN each SHALL resolve a distinct `model` path (no duplicate defaults). **Test layer: unit**
32. WHEN `node scripts/visual-gate.mjs` runs THEN player manifest entries SHALL PASS structural checks. **Test layer: unit** (visual-gate script; manual fidelity review for screenshots)

---

### P7: Client wiring & `__GAME_STATE__` ⭐ MVP

**User Story**: As a test author, I can assert class identity on the client without a browser.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| CHAR19-R24 | `wireRoom` syncs `classId`, `sex`, base stats to `__GAME_STATE__.player` |
| CHAR19-R25 | `wireRoom` passes `classId` to `game.syncLocalPlayer` / avatar swap |
| CHAR19-R26 | `window.__GAME_STATE__.player.avatarModel` exposes resolved GLB path |

**Acceptance Criteria**:

33. WHEN local `PlayerState` is wired with `classId=18`, `sex=0`, `str=36` THEN `__GAME_STATE__.player.classId` SHALL be **18** and `str` **36**. **Test layer: unit** (`wire-room.spec.ts`)
34. WHEN `classId=10` is wired THEN `__GAME_STATE__.player.avatarModel` SHALL be `/models/characters/Mage.glb`. **Test layer: unit**
35. WHEN `syncLocalPlayer` is called THEN `classId` SHALL be forwarded to player avatar factory. **Test layer: unit**

---

### P8: Regression ⭐ MVP

**Acceptance Criteria**:

36. WHEN Human Fighter equips **2369** and melees Gremlin (`rngOffset=0`) THEN damage SHALL be **19**. **Test layer: room-integration**
37. WHEN existing consumable / shop / NPC flows run THEN they SHALL remain functional (no regressions in affected `TownRoom.spec.ts` subsets). **Test layer: room-integration** (existing tests green)

---

## Requirement Traceability Summary

| Range | Count | Primary test layer |
| ----- | ----- | ------------------ |
| CHAR19-01 – 06 | 6 | seed |
| CHAR19-07 – 13 | 7 | unit (`game-core`) |
| CHAR19-14 – 16 | 3 | unit (`server`) |
| CHAR19-17 – 22 | 6 | room-integration |
| CHAR19-23 – 26 | 4 | unit (`client` creation) |
| CHAR19-27 – 32 | 6 | unit (`client` manifest) + visual gate |
| CHAR19-33 – 35 | 3 | unit (`client` wireRoom) |
| CHAR19-36 – 37 | 2 | room-integration |

**Total ACs: 37**

---

## Test Layer Policy (post-MVP)

Per ROADMAP Phases 19–29 and AGENTS.md:

- **No Playwright / `client-e2e`** for this phase.
- Client outcomes proven via **Vitest + jsdom** (`wireRoom`, creation UI, manifest).
- Game outcomes proven via **room-integration** (`NJ_AUTOSIM=0`, `tick()`/`deliver()`).
- L2J values proven via **seed/data** tests against fixtures (AD-012).
