# Phase 20 — Skills & Combat Depth Specification

## Problem Statement

Phases 4–5 and 19 deliver server-authoritative melee and class-based stats, but combat
depth is still a single hard-coded skill (**Power Strike 3**) granted implicitly to
everyone. Mystics cannot cast magic; soulshots (item **1835**) are icon-only; trainers
(Bitz + folk trainers) show stub dialogs; there is no buff/debuff system, no cast bar, and no
crit/evasion beyond flat damage rolls.

Phase 20 generalizes the skill pipeline: learnable per-class TI subsets seeded from
L2J XML, a unified server resolver (physical + magic + effects), functional
soulshots/spiritshots, magic cast with interrupt-on-hit, and minimal buff/debuff
state — all validated server-side per AD-001.

## Goals

- [ ] Extend skill seed + schema beyond skill **3**; parse TI-relevant L2J skills and
      per-class skill trees into SQLite.
- [ ] Persist learned skills per character; auto-grant `autoGet` tree entries on create;
      `learnSkill` intent at **Bitz** (fighters) and **folk trainers** (mystics).
- [ ] Replace `resolvePowerStrike` with a generalized `resolveSkillUse` (physical,
      magical, buff, debuff) with per-skill MP/cooldown/reuse validation.
- [ ] Magic cast path: `hitTime` cast bar, resolve at cast end, interrupt on damage.
- [ ] Soulshot **1835** / spiritshot **2509** consumed for **2×** damage bonus (L2J
      `Formulas` shot multiplier).
- [ ] Minimal active effect system (self-buff + enemy debuff) with server tick expiry.
- [ ] Crit/evasion hooks using seeded monster + class template stats.
- [ ] Tests: unit per skill anchor; room per intent; client unit via `wireRoom` (no
      Playwright — AD-010 post-MVP gate).

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Full enchant skill trees | Phase 25 |
| All 200+ Classic skills | TI-relevant subset only (~12 skills) |
| Skill level-up / SP economy | Free learn at trainer this phase; SP deferred Phase 27 |
| Olympiad / siege skills | Post-TI |
| Auto soulshot toggle UI (L2 shortcut bar) | MVP: consume-on-next-hit via `useShot` intent |
| Full L2J `PAttackFinalizer` / complete stat engine | Incremental; INT/mAtk added, not full Java port |
| Folk trainer full roster spawn (30027–30036) | Phase 24; this phase seeds **2** folk NPCs for learn flow |
| 1st class transfer at Bitz | Phase 24 |
| Playwright / `client-e2e` | Removed post-MVP per ROADMAP + AGENTS.md |

---

## Assumptions & Open Questions

Every ambiguity resolved autonomously (Planner cannot consult user).

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| AC prefix | **SKILL20-NN** | Matches phase-19 `CHAR19-NN` convention | y |
| Skill subset scope | **12 skills** across trees (see L2J Anchors table) | TI-relevant; not 200+ | y |
| Fighter signature skill | **Power Strike 3** L1 at Bitz for classIds **0, 18, 31, 53**; **Iron Punch 29** L1 at Bitz for **44** | L2J `StartingClass` trees | y |
| Mystic signature damage | **Wind Strike 1177** L1 `autoGet` on create for classIds **10, 25, 38**; **Chill Flame 1100** L1 `autoGet` for **49** | Mystic trees differ by race | y |
| Mystic learnable buff | **Might 1068** L1 at folk priest trainer | Universal mystic Lv7 tree entry; **relax `getLevel` to 1** for TI slice | y |
| Fighter learnable debuff | **Curse Weakness 1164** L1 at folk magister (optional stretch — included as debuff anchor) | Dark/Elf mystic tree; usable as mob debuff test | y |
| `getLevel` / SP gate | **Ignored** — trainer offers skill if in class tree and not yet learned; **no SP cost** | SP system is Phase 27; avoids blocking MVP | y |
| Skill level | Always cast at **learned level** (starts at **1**); no level-up UI | ROADMAP subset | y |
| Legacy characters | On first load with empty `character_skills`, grant **Power Strike 3 L1** if `classId` is fighter archetype; grant mystic `autoGet` skills if mystic | Avoid breaking existing saves | y |
| Implicit Power Strike removed | `useSkill` without learned row **rejects** (except legacy migration above) | ROADMAP “learnable subset” | y |
| Trainer NPCs this phase | **Bitz 30026** (existing) + seed **Gwinter 30027** (Master) + **Baulro 30033** (Magister) with peace-zone spawns | Proves folk + village master paths; rest Phase 24 | y |
| `learnSkill` intent | `{ skillId: number }` while trainer dialog open; server validates proximity + NPC type + class tree | Symmetric with `useItem` | y |
| Magic `mDef` for mobs | **`mDef = pDef`** from seeded monster row until separate column added | Monsters table lacks `mDef` today | y |
| `mAtk` formula | `floor(baseMAtk × intBonus(INT) + level)` mirroring Phase 19 `calcClassBasePAtk` | Phase 19 deferred INT scaling | y |
| Magic damage formula | `max(1, floor(91 × (mAtk + power) / mDef × randomMod))` | L2J `calcMagicDam` uses 91 constant; MVP omits shield/spirit resist layers | y |
| Physical soulshot multiplier | **2×** final damage (`ssmod = 2` per L2J `Formulas.calcBlowDamage` / shot path) | Authentic Classic shot bonus | y |
| Spiritshot multiplier | **2×** on magical damage (`sps` path) | L2J `calcMagicDam` | y |
| Shot consumption | `useShot { itemId }` arms next qualifying attack/skill; decrements stack on consume; one shot per hit | Simpler than auto-shot UI | y |
| Cast interrupt | Any **positive damage** to caster while `castingSkillId ≠ 0` before `castEndMs` clears cast and **does not** spend MP | ROADMAP interrupt-on-hit | y |
| Buff MVP | **Might 1068**: `pAtk × 1.08` for **1200 s** (`abnormalTime`); single self-buff slot stack refreshes duration | L2J L1 +8% P.Atk | y |
| Debuff MVP | **Curse Weakness 1164** on mob: **-12% pAtk** for **30 s** (`abnormalTime` 30) | L2J debuff anchor | y |
| Crit | `critRate` from class template + weapon; roll `rng.nextFloat() < critRate/100`; **2×** damage on crit for physical/magic | L2J-inspired; uses seeded `baseCritRate` | y |
| Evasion | `evasion = dexBonus(DEX) × 10` (simplified); miss if `rng.nextFloat() < evasion/(evasion+accuracy)` | Uses monster `accuracy` from seed | y |
| Cooldown storage | Replace `powerStrikeCooldownEndMs` with `skillCooldownEndMs` map keyed by `skillId` in private combat state; replicate hotbar skills' max 3 cooldown ends on `PlayerState` OR encode as parallel arrays | Schema: `knownSkillIds` + `skillCooldownEndMs` array (max 8 slots) | y |
| Fixture scope (AD-012) | Trimmed skill XML files + 9 `skillTrees/StartingClass/*.xml` under `server/src/seed/__fixtures__/` | Portable CI | y |
| Test gate | Unit + room + seed only; client `wireRoom` unit | AGENTS.md post-MVP | y |
| Implicit: auth / rate limits | N/A — local Colyseus room | — | N/A |
| Implicit: concurrency | Per-test isolated room + temp DB (`instanceKey`, AD-014) | Existing pattern | N/A |

**Open questions:** none — all resolved or logged above.

---

## L2J Anchors

### TI skill subset (seed + test anchors)

| skillId | Name | Type | L1 anchors (fixture) | Class / trainer |
| ------- | ---- | ---- | -------------------- | --------------- |
| **3** | Power Strike | Physical | `power=30`, `mp=9`, `reuse=3000`, `castRange=40`, `hitTime=1080` | Fighters → Bitz |
| **29** | Iron Punch | Physical | `power=34`, `mp=9`, `reuse=3000`, `castRange=40`, `hitTime=1604` | Orc Fighter → Bitz |
| **1177** | Wind Strike | Magic | `power=12`, `mp=7`, `reuse=1200`, `castRange=600`, `hitTime=4000` | Human/Elf/DE Mystic autoGet |
| **1100** | Chill Flame | Magic DoT debuff | `power=27`, `mp=12`, `reuse=2000`, `hitTime=4000`, `abnormalTime=15` | Orc Mystic autoGet |
| **1068** | Might | Self buff | `mp=10`, `reuse=2000`, `hitTime=4000`, `abnormalTime=1200`, +8% P.Atk | Mystic → folk priest |
| **1164** | Curse Weakness | Enemy debuff | `mp=10`, `reuse=2000`, `hitTime=4000`, `abnormalTime=30`, -12% P.Atk | Learn at folk magister |
| **1835** | Soulshot (No-grade) | Consumable | `default_action=SOULSHOT`, skill **2039** | Inventory `useShot` |
| **2509** | Spiritshot (No-grade) | Consumable | `default_action=SPIRITSHOT` | Seed + mystic `useShot` |
| **2039** | Soulshot (static) | Shot buff | Static skill on item | 2× physical |
| **194** | Lucky | Passive | `autoGet` commons | Auto-grant; no cast (excluded from hotbar) |

### Per-class MVP skill assignment

| classId | Archetype | autoGet on create | Learn at trainer |
| ------- | --------- | ----------------- | ---------------- |
| 0, 18, 31, 53 | Fighter | — | Power Strike **3** L1 @ Bitz |
| 44 | Orc Fighter | Toughness **134** (passive, no cast) | Iron Punch **29** L1 @ Bitz |
| 10, 25, 38 | Mystic | Wind Strike **1177** L1 | Might **1068** L1 @ folk priest |
| 49 | Orc Mystic | Chill Flame **1100** L1 | Might **1068** L1 @ folk priest |

### Damage anchors (Human Fighter **0**, Squire's Sword 2369, vs Gremlin `pDef=mDef=44.44444`, `rngOffset=0`)

| Action | Formula inputs | Expected damage |
| ------ | -------------- | --------------- |
| Power Strike L1 | `pAtk=11`, `power=30` | **71** |
| Power Strike + soulshot | ×2 shot multiplier | **142** |
| Iron Punch L1 (Orc 44 naked `pAtk=8`) | `power=34` | **73** (`floor(77×42/44.44444)`) |

### Damage anchors (Human Mystic **10**, naked, vs Gremlin, `rngOffset=0`)

| Action | Formula inputs | Expected damage |
| ------ | -------------- | --------------- |
| Wind Strike L1 | `mAtk=8` (`floor(6×1.21+1)`), `power=12` | **40** (`floor(91×20/44.44444)`) |
| Wind Strike + spiritshot | ×2 | **80** |

### Trainer NPCs

| npcId | Name | L2J type | Teaches |
| ----- | ---- | -------- | ------- |
| **30026** | Bitz | VillageMasterFighter | Fighter physical skills |
| **30027** | Gwinter | Folk Master | Fighter physical skills (duplicate path / room-test NPC) |
| **30033** | Baulro | Folk Magister | Mystic buffs + debuffs |

---

## User Stories

### P1: Skill seed & schema ⭐ MVP

**User Story**: As a developer, TI-relevant skills and class skill trees are in SQLite
with extended columns for magic/buff/debuff resolution.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| SKILL20-R01 | Extend `skills` table: `hitTime`, `isMagic`, `effectKind`, `abnormalTime`, `buffMultiplier`, `debuffMultiplier` |
| SKILL20-R02 | `class_skill_tree` table from L2J `skillTrees/StartingClass/*.xml` |
| SKILL20-R03 | Generalized `skills.parser.ts` for multi-skill fixture files |
| SKILL20-R04 | Seed spiritshot item **2509** |

**Acceptance Criteria**:

1. WHEN `seedSkills` runs THEN `skills` SHALL contain at least skillIds **3, 29, 1068, 1100, 1164, 1177**. **Test layer: seed**
2. WHEN skill **1177** is loaded THEN `isMagic` SHALL be **true** and `hitTime` SHALL be **4000**. **Test layer: seed**
3. WHEN skill **3** is loaded THEN `effectKind` SHALL be **`physical_damage`** and `powerL1` SHALL be **30**. **Test layer: seed**
4. WHEN skill **1068** is loaded THEN `effectKind` SHALL be **`buff_self`** and `buffMultiplier` SHALL be **1.08**. **Test layer: seed**
5. WHEN `seedClassSkillTree` runs THEN classId **0** tree SHALL include skill **3** level **1**. **Test layer: seed**
6. WHEN classId **10** tree is loaded THEN skill **1177** SHALL have `autoGet=true`. **Test layer: seed**
7. WHEN item **2509** is seeded THEN `type` SHALL be **`consumable`** (or `shot`) with spiritshot metadata. **Test layer: seed**
8. WHEN `class_skill_tree` is queried for classId **44** THEN skill **29** level **1** SHALL be present with `getLevel=5` (stored; gate ignored at runtime). **Test layer: seed**

---

### P2: Character skills persistence ⭐ MVP

**User Story**: As a player, my learned skills persist and mystic `autoGet` skills are
granted on character creation.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| SKILL20-R05 | `character_skills(character_id, skill_id, skill_level)` table |
| SKILL20-R06 | `grantAutoGetSkills(classId)` on `createCharacter` |
| SKILL20-R07 | Legacy migration grants fighter Power Strike / mystic autoGet |

**Acceptance Criteria**:

9. WHEN a new Human Mystic (**10**) is created THEN `character_skills` SHALL contain skill **1177** level **1**. **Test layer: unit (repository)**
10. WHEN a new Human Fighter (**0**) is created THEN `character_skills` SHALL NOT contain skill **3** until learned. **Test layer: unit**
11. WHEN a legacy fighter row loads with empty `character_skills` THEN migration SHALL grant skill **3** level **1**. **Test layer: unit**
12. WHEN `saveCharacter`/`loadCharacter` round-trips skills THEN learned set SHALL be unchanged. **Test layer: unit**
13. WHEN `PlayerState` syncs THEN `knownSkillIds` (array) SHALL reflect learned skills for client hotbar. **Test layer: room**
14. WHEN player lacks skill **3** and sends `useSkill { skillId: 3 }` THEN server SHALL reject (no damage, no MP spend). **Test layer: room**

---

### P3: Skill learning at trainers ⭐ MVP

**User Story**: As a player, I interact with Bitz or a folk trainer and learn class-
appropriate skills via dialog → `learnSkill`.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| SKILL20-R08 | `learnSkill { skillId }` intent with trainer proximity validation |
| SKILL20-R09 | Trainer dialog lists learnable skills for player `classId` |
| SKILL20-R10 | Seed Gwinter **30027** + Baulro **30033** NPCs + spawns |

**Acceptance Criteria**:

15. WHEN Human Fighter at Bitz learns skill **3** THEN `character_skills` gains **3:L1** and dialog no longer offers it. **Test layer: room**
16. WHEN player sends `learnSkill { skillId: 3 }` with wrong class (**10**) THEN server SHALL reject. **Test layer: room**
17. WHEN player sends `learnSkill` out of trainer range THEN server SHALL reject. **Test layer: room**
18. WHEN Human Mystic at Baulro learns **1068** THEN skill SHALL appear in `knownSkillIds`. **Test layer: room**
19. WHEN Orc Fighter learns **29** at Bitz THEN `useSkill 29` becomes valid. **Test layer: room**
20. WHEN client trainer dialog renders for Bitz THEN learn buttons SHALL exist for eligible fighter skills. **Test layer: client unit**

---

### P4: Generalized physical skill resolver ⭐ MVP

**User Story**: As a fighter, learned physical skills deal class-based damage with MP
and cooldown enforced server-side.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| SKILL20-R11 | `resolveSkillUse` replaces `resolvePowerStrike` |
| SKILL20-R12 | Per-skill cooldown map; MP deduct; reuse delay |
| SKILL20-R13 | Class-based `pAtk` via Phase 19 helpers |

**Acceptance Criteria**:

21. WHEN Human Fighter with sword uses Power Strike **3** on Gremlin in range THEN damage SHALL be **71** and MP SHALL decrease by **9**. **Test layer: unit + room**
22. WHEN reuse delay **3000 ms** not elapsed THEN second `useSkill` SHALL reject. **Test layer: room**
23. WHEN Orc Fighter uses Iron Punch **29** on Gremlin THEN damage SHALL be **73** (naked `pAtk=8`). **Test layer: unit**
24. WHEN `useSkill` in peace zone THEN server SHALL reject. **Test layer: room**
25. WHEN skill cast succeeds THEN `PlayerState.action` SHALL be **Cast** (or Attack for instant physical) and `actionSeq` increments (AD-015). **Test layer: room**
26. WHEN physical skill resolves THEN `skillPending` clears and cooldown timestamp set. **Test layer: unit**

---

### P5: Magic cast path ⭐ MVP

**User Story**: As a mystic, casting Wind Strike shows a cast bar, resolves at end of
`hitTime`, and interrupts if I take damage mid-cast.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| SKILL20-R14 | Cast state: `castingSkillId`, `castEndMs` on private combat state |
| SKILL20-R15 | `calcMagicSkillDamage` in game-core |
| SKILL20-R16 | Interrupt on damage during cast |

**Acceptance Criteria**:

27. WHEN Human Mystic begins Wind Strike THEN `castingSkillId` SHALL be **1177** until `hitTime=4000` ms elapses. **Test layer: room**
28. WHEN cast completes on Gremlin THEN damage SHALL be **40** and MP reduced by **7**. **Test layer: unit + room**
29. WHEN mob damages player during cast before `castEndMs` THEN cast SHALL cancel with **no** damage to mob and **no** MP spent. **Test layer: room**
30. WHEN client receives cast start THEN `#cast-bar` DOM SHALL show progress over **4000** ms. **Test layer: client unit**
31. WHEN `useSkill 1177` without learned skill THEN server SHALL reject. **Test layer: room**
32. WHEN magic skill completes THEN `PlayerState.action` SHALL be **Cast** during cast window. **Test layer: room**

---

### P6: Soulshots & spiritshots ⭐ MVP

**User Story**: As a player, I arm soulshots/spiritshots from inventory and the next
qualifying hit consumes one and applies 2× damage.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| SKILL20-R17 | `useShot { itemId }` intent (1835 / 2509) |
| SKILL20-R18 | Shot armed state; consume on next physical/magic hit |
| SKILL20-R19 | 2× damage multiplier |

**Acceptance Criteria**:

33. WHEN player with soulshots uses `useShot { itemId: 1835 }` then Power Strike THEN damage SHALL be **142** and soulshot count decrements by **1**. **Test layer: room**
34. WHEN soulshot count is **0** THEN `useShot` SHALL reject. **Test layer: room**
35. WHEN mystic uses spiritshot **2509** then Wind Strike THEN damage SHALL be **80**. **Test layer: room**
36. WHEN shot armed but basic melee attack fires THEN soulshot consumed and melee damage doubled. **Test layer: room**
37. WHEN client uses soulshot from inventory THEN `useShot` intent sent via `wireRoom`. **Test layer: client unit**

---

### P7: Buffs & debuffs (minimal effects) ⭐ MVP

**User Story**: As a mystic, I buff myself with Might and debilitate mobs with Curse
Weakness; effects expire server-side.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| SKILL20-R20 | `ActiveEffect` model on player + mob private/runtime state |
| SKILL20-R21 | Might increases effective `pAtk`; Weakness reduces mob damage output |
| SKILL20-R22 | Effect expiry on tick |

**Acceptance Criteria**:

38. WHEN Might **1068** resolves on self THEN effective `pAtk` multiplier SHALL be **1.08** for **1200 s**. **Test layer: unit**
39. WHEN Curse Weakness **1164** resolves on mob THEN mob outgoing damage multiplier SHALL be **0.88** for **30 s**. **Test layer: unit**
40. WHEN effect expires (injectable `nowMs`) THEN multiplier SHALL return to **1.0**. **Test layer: unit**
41. WHEN `useSkill 1068` without learned skill THEN reject. **Test layer: room**
42. WHEN buff active and `__GAME_STATE__.player.effects` exposed THEN client hook SHALL list Might. **Test layer: client unit**

---

### P8: Crit & evasion ⭐ MVP

**User Story**: Combat uses seeded crit/evasion chances so hits can crit or miss per
L2J-inspired formulas.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| SKILL20-R23 | `rollHitMiss` using accuracy vs evasion |
| SKILL20-R24 | `rollCrit` using class `baseCritRate` |

**Acceptance Criteria**:

43. WHEN `rng` forces miss THEN damage SHALL be **0** and no MP/cooldown consumed for melee. **Test layer: unit**
44. WHEN `rng` forces crit on Power Strike THEN damage SHALL be **2×** base (**142** at anchor). **Test layer: unit**
45. WHEN Gremlin attacks high-DEX elf fighter THEN miss chance SHALL be **> 0** (evasion > 0). **Test layer: unit**
46. WHEN crit roll fails THEN damage SHALL match non-crit anchor. **Test layer: unit**

---

### P9: Client hotbar & wiring ⭐ MVP

**User Story**: As a player, hotkeys send `useSkill` for learned skills; UI shows
cooldowns and cast state.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| SKILL20-R25 | Hotbar maps keys **2–4** to first three `knownSkillIds` |
| SKILL20-R26 | `wireRoom` + `__GAME_STATE__` expose skills, cooldowns, cast, effects |

**Acceptance Criteria**:

47. WHEN player has skills **[3, 1068]** THEN key **2** sends `useSkill { skillId: 3 }`. **Test layer: client unit**
48. WHEN cooldown active THEN hotbar SHALL show remaining ms for that skill. **Test layer: client unit**
49. WHEN `knownSkillIds` updates from server THEN hotbar icons update (Power Strike + Wind Strike icons). **Test layer: client unit**
50. WHEN `__GAME_STATE__.player.knownSkillIds` synced THEN matches `PlayerState`. **Test layer: client unit**
51. WHEN trainer learn button clicked THEN `learnSkill` intent sent. **Test layer: client unit**
52. WHEN Power Strike VFX fires on physical instant skill THEN existing VFX path still triggers (regression). **Test layer: client unit**

---

## Edge Cases

- WHEN player dies during cast THEN cast SHALL cancel; no MP spent if not yet resolved.
- WHEN target mob dies during cast THEN cast SHALL cancel at resolve with no XP grant.
- WHEN two skills share cooldown group (none in MVP subset) THEN N/A.
- WHEN buff reapplied THEN duration refreshes; multiplier unchanged.
- WHEN `learnSkill` for already-known skill THEN reject silently (no duplicate row).
- WHEN dwarf (**53**) learns Power Strike THEN same anchors as human fighter.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| SKILL20-R01–R04 | P1 | Design | Pending |
| SKILL20-R05–R07 | P2 | Design | Pending |
| SKILL20-R08–R10 | P3 | Design | Pending |
| SKILL20-R11–R13 | P4 | Design | Pending |
| SKILL20-R14–R16 | P5 | Design | Pending |
| SKILL20-R17–R19 | P6 | Design | Pending |
| SKILL20-R20–R22 | P7 | Design | Pending |
| SKILL20-R23–R24 | P8 | Design | Pending |
| SKILL20-R25–R26 | P9 | Design | Pending |

**Coverage:** 52 ACs (SKILL20-01–52), 26 requirements, all mapped in `tasks.md`.

---

## Success Criteria

- [ ] Each of the nine starter classes has at least one learnable or auto-granted
      combat skill beyond implicit MVP Power Strike.
- [ ] MP, cooldown, shot consumption, and effect expiry validated server-side only.
- [ ] Mystic Wind Strike cast bar + interrupt proven in room tests.
- [ ] `nx affected -t test lint` green; no Playwright in gate.
