# Phase 27 — Progression Rules & PvP Specification

## Problem Statement

Phases 7 and 19–26 deliver leveling, class templates, skills, and social systems — but
progression rules are still MVP-thin: death never costs XP above newbie levels, there is
no SP economy, no manual stat growth, no level cap aligned to Talking Island content, and
**no player-versus-player** combat (flag, karma, or damage). Biotin resurrects HP only;
`resolvePlayerDeath` is a stub that preserves all XP.

Phase 27 translates L2J Classic **death penalty**, **XP restore**, **delevel**,
**experience curve to the TI cap**, **SP + stat re-spec at trainers**, and **PvP
flag/karma** into `@nj/game-core` pure functions with server-validated room tests (AD-001).
Client wiring via `wireRoom` + `__GAME_STATE__` (AD-009). **No Playwright.**

## Goals

- [ ] Authentic death XP loss for level **≥10**; newbie protection for level **≤9** (Phase 7).
- [ ] `expBeforeDeath` tracking + **Biotin restoreExp** service (adena-priced).
- [ ] **Delevel** when XP drops below level threshold (`Delevel=true`, minimum level **10**).
- [ ] **TI level cap 20** enforced on XP grant/loss; experience + `experience_loss` seeded
      through cap; vitals curve usable through level **20**.
- [ ] **SP** from mob kills; `learnSkill` deducts `levelUpSp` from class tree.
- [ ] **+1 stat point per level** (2→cap), allocate via intent, **reset at trainer** for adena.
- [ ] **PvP flag** toggle, timed flag decay, **karma** on innocent kill, peace-zone guards.
- [ ] **Player vs player** melee/skill damage in combat zones when PvP rules allow.
- [ ] Room tests: death penalty anchor, restore, delevel, PvP kill karma, two-session PvP hit.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Siege / clan war / Olympiad | ROADMAP post-TI |
| Karma item drop on PK death | L2J `KARMA_RATE_DROP*` — defer |
| Full resurrection skill cast by other players | Biotin NPC restore only this phase |
| Stat elixirs / henna / subclass stats | Post-TI |
| PvP reward titles / name colors | Client shell Phase 28; replicate `karma` scalar only |
| Anti-feed dualbox | L2J `AntiFeedEnable=false` in Classic config |
| Playwright / `client-e2e` | Post-MVP gate (ROADMAP 19–29) |
| XP loss skipped in PvP zones (L2J `ZoneId.PVP`) | TI has no dedicated PvP zone yet; flag-based only |
| Skill level-down on delevel (`DecreaseSkillOnDelevel`) | Defer — skills are L1-only in TI slice |

---

## Assumptions & Open Questions

Autonomous Planner decisions (no user gate).

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| AC prefix | **PROG27-NN** | Matches `SOC26-NN`, `ITEM25-NN` | y |
| TI level cap | **20** | Phase 24 class transfer at 20; highest TI mob ~17 | y |
| Newbie XP protection | **level ≤ 9** → **0** XP loss | Phase 7 contract (`P7-R12`); L2J `isLucky` also requires skill **194** — we keep level-only rule | y |
| Death penalty formula | L2J `calculateDeathExpPenalty` simplified: `percentLost` from `experience_loss.xml`; `lost = round(currentLevelExp × percentLost / 100)`; cap `min(lost, floor(currentLevelExp/10))` | AD-003 translation | y |
| `currentLevelExp` | `xpForLevel(L+1) − xpForLevel(L)` from seeded `experience` table | Matches L2J `getExpForLevel` delta | y |
| Karma multiplier on death | If `karma < 0`: `percentLost × RATE_KARMA_EXP_LOST` (**1.0** default) | L2J `RatesConfig` | y |
| PvP killer multiplier | If killer is player: same percent (no extra stat layer) | MVP | y |
| Delevel | **`true`**; floor level **10** (`DelevelMinimum=9` in L2J → cannot go below **10** when deleveling from 11+) | `Player.ini` Classic | y |
| `expBeforeDeath` | Set to XP **before** penalty applied; cleared after successful restore | L2J `_expBeforeDeath` | y |
| Biotin restore | New `npcAction: 'restoreExp'` — restores **100%** of `(expBeforeDeath − xp)` when `expBeforeDeath > xp`; costs **`lostExp × 10`** adena (min **100**) | Service-priced restore MVP | y |
| Biotin resurrect | Unchanged: HP restore when `hp ≤ 0` only; does **not** auto-restore XP | Separate actions | y |
| SP on kill | Grant mob seeded `sp` to killer (party SP split mirrors XP split formula with same bonus table) | L2J `addExpAndSp` | y |
| learnSkill SP | Deduct `class_skill_tree.levelUpSp` for skill level **1** row; reject if insufficient | Phase 20 deferred SP | y |
| Stat points | **+1 unspent** per level gained (levels **2…20**); max **19** points at cap | ROADMAP stat re-spec needs allocatable stats | y |
| Stat allocate | `allocateStat { stat: 'str'\|'dex'\|'con'\|'int'\|'wit'\|'men' }` — +1 to bonus, −1 unspent | Server intent | y |
| Effective stat | `template.base* + bonus*`; combat uses effective | Phase 19 template + bonus | y |
| Stat reset | `resetStats` intent at **Bitz** or folk trainer (**30027–30036** except Biotin) while dialog open; cost **`level × 1000`** adena; refunds all bonus to unspent | ROADMAP trainer re-spec | y |
| PvP toggle | `togglePvp` intent; sets `pvpFlag=1` for **120 s** (`PVP_NORMAL_TIME` ms → 120000) | L2J `PVP.ini` | y |
| Hitting flagged player | Extends attacker's flag **60 s** (`PVP_PVP_TIME`) | L2J | y |
| Karma on PK | First innocent kill: `karma -= 720` (L2J `calculateKarmaGain(0,false)`) | Formula anchor | y |
| Karma recovery | On mob XP gain while `karma < 0`: `karma += floor(exp / 30 / karmaLossMod)` simplified to **`floor(exp / 300)`** for TI | L2J-inspired simplification | y |
| PvP attack allow | Attacker may damage player target when: **not** in peace zone, target `pvpFlag=1` **OR** attacker `karma < 0`, target alive | Classic purple/chaotic rules MVP | y |
| Player targeting | `setTargetPlayer { sessionId }` + combat uses `targetPlayerSessionId` | Symmetric with mob target | y |
| Player death from PvP | Same `handlePlayerDeath` path; killer recorded for karma on kill | Reuse death pipeline | y |
| Peace zone | Existing `isPeaceZone` rejects player attacks/skills vs players and mobs | Phase 23 zones extended | y |
| Party XP at cap | Members at level **20** receive **0** XP (but may still receive SP) | Level cap | y |
| Fixture scope | `experienceLoss.xml` subset + extend `experience.xml` fixture through level **21** row if missing | AD-012 | y |
| Test gate | Unit + room + seed; client `wireRoom` | AGENTS.md | y |
| Implicit: auth | N/A — local room | — | N/A |
| Implicit: concurrency | Per-test isolated room + temp DB (`instanceKey`, AD-014) | Existing | N/A |

**Open questions:** none — all resolved or logged above.

---

## L2J Anchors

### Experience loss percent (`experienceLoss.xml`)

| Level | `percentLost` |
| ----- | ------------- |
| 9 | **9.0** |
| 10 | **8.875** |
| 15 | **8.25** |
| 20 | **7.625** |

### Death penalty anchor — level **10**, Human Fighter

Cumulative XP at level 10: **≥ 48230**. `currentLevelExp = 71203 − 48230 = **22973**`.

`lostExp = round(22973 × 8.875 / 100) = **2039**` (under cap `2297`).

| Before death | After death |
| ------------ | ----------- |
| `level=10`, `xp=50000` | `level=10`, `xp=**47961**`, `expBeforeDeath=50000` |

### Delevel anchor — level **11**

| Before | XP loss | After |
| ------ | ------- | ----- |
| `level=11`, `xp=72000` | **10000** | `level=**10**`, `xp=62000` (below 71203 threshold) |

### Newbie protection anchor

| Before | After death |
| ------ | ----------- |
| `level=9`, `xp=40000` | `level=9`, `xp=**40000**` |

### TI level cap anchor

| Grant | Result |
| ----- | ------ |
| `grantXp(19, 800000, 50000, curve)` | `level=**20**`, `xp=835864` (cumulative for 20 from fixture) |
| `grantXp(20, 835864, 100000, curve)` | `level=**20**`, `xp=935864` (no level 21) |

### SP anchor — Gremlin (`sp=7` from seed)

Solo kill: killer `sp += **7**`.

### learnSkill SP anchor — Power Strike (`levelUpSp` from tree)

Human Fighter skill **3** L1: deduct seeded `levelUpSp` (fixture value) on learn.

### Karma gain anchor — first PK

`calculateKarmaGain(0, false) = ((0×0.5)+1)×60×12 = **720**` → `karma -= 720` (start `0` → `−720`).

### PvP flag timing

| Event | Duration |
| ----- | -------- |
| `togglePvp` | **120 s** flagged |
| Hit purple player | extend to **60 s** from now |

---

## User Stories

### P1: Death XP loss & delevel ⭐ MVP

**User Story**: As a field player above newbie levels, death costs XP and can delevel me per
Classic rules.

**Acceptance Criteria**:

1. **PROG27-01**: WHEN `calcDeathXpLoss({ level: 10, xp: 50000, karma: 0, killerKind: 'mob' }, curve, lossTable)` THEN `lostExp` SHALL be **2039** and `newXp` **47961**.
   **Test layer: unit**
2. **PROG27-02**: WHEN `level ≤ 9` death resolved THEN `lostExp` SHALL be **0**.
   **Test layer: unit**
3. **PROG27-03**: WHEN `removeXp(11, 72000, 10000, curve, { delevelMin: 10 })` THEN result SHALL be `level=**10**`, `xp=62000`.
   **Test layer: unit**
4. **PROG27-04**: WHEN `removeXp(10, 50000, 500, curve, { delevelMin: 10 })` THEN `level` SHALL remain **10**.
   **Test layer: unit**
5. **PROG27-05**: WHEN player level **10** dies to mob in `TownRoom` THEN persisted `xp` SHALL decrease by penalty and `expBeforeDeath` SHALL equal pre-death `xp`.
   **Test layer: room**
6. **PROG27-06**: WHEN player level **9** dies to mob THEN `xp` SHALL be unchanged (regression).
   **Test layer: room**
7. **PROG27-07**: WHEN death resolves THEN player SHALL respawn at town spawn with `hp=maxHp`, `mp=maxMp` (Phase 7 preserved).
   **Test layer: room**
8. **PROG27-08**: WHEN death delevels THEN `maxHp`/`maxMp` SHALL refresh from `class_level_vitals` at new level.
   **Test layer: room**

---

### P2: XP restore at Biotin ⭐ MVP

**User Story**: As a player who died with XP loss, I can pay Biotin to recover lost XP.

**Acceptance Criteria**:

9. **PROG27-09**: WHEN `restoreExp({ xp: 47961, expBeforeDeath: 50000, adena: 50000 }, { costPerXp: 10 })` THEN `xp` SHALL be **50000**, `adena` reduced by `2039×10`, `expBeforeDeath` cleared.
   **Test layer: unit**
10. **PROG27-10**: WHEN `expBeforeDeath ≤ xp` THEN restore SHALL reject.
    **Test layer: unit**
11. **PROG27-11**: WHEN player sends `npcAction { npcId: 30031, action: 'restoreExp' }` near Biotin with lost XP THEN server SHALL restore XP and deduct adena.
    **Test layer: room**
12. **PROG27-12**: WHEN insufficient adena THEN restore SHALL reject with no XP change.
    **Test layer: room**

---

### P3: Full XP curve, TI cap & SP ⭐ MVP

**User Story**: As a TI player, I progress along the authentic curve to level **20** and earn SP for skills.

**Acceptance Criteria**:

13. **PROG27-13**: WHEN seed runs THEN `experience` row `level=20` SHALL have `xpToNextLevel=**835864**` (fixture).
    **Test layer: seed**
14. **PROG27-14**: WHEN seed runs THEN `experience_loss` rows SHALL include `level=10 → 8.875`.
    **Test layer: seed**
15. **PROG27-15**: WHEN `grantXp` would exceed level **20** THEN `level` SHALL cap at **20**.
    **Test layer: unit**
16. **PROG27-16**: WHEN level **20** player kills Gremlin THEN `xp` SHALL NOT increase.
    **Test layer: room**
17. **PROG27-17**: WHEN solo Gremlin kill THEN killer `sp` SHALL increase by mob seeded `sp`.
    **Test layer: room**
18. **PROG27-18**: WHEN `learnSkill` for Power Strike and `sp < levelUpSp` THEN SHALL reject.
    **Test layer: room**
19. **PROG27-19**: WHEN `learnSkill` succeeds THEN `sp` SHALL decrease by tree `levelUpSp`.
    **Test layer: room**
20. **PROG27-20**: WHEN party kill splits SP THEN use same member filter/bonus as party XP (`SOC26` table).
    **Test layer: unit**

---

### P4: Stat points & trainer re-spec ⭐ MVP

**User Story**: As a leveling adventurer, I allocate stat points and can pay a trainer to reset them.

**Acceptance Criteria**:

21. **PROG27-21**: WHEN level increases from **5→6** THEN `unspentStatPoints` SHALL increase by **1**.
    **Test layer: unit**
22. **PROG27-22**: WHEN `allocateStat('str')` with `unspentStatPoints > 0` THEN `bonusStr` SHALL increase by **1** and unspent decrease by **1**.
    **Test layer: unit**
23. **PROG27-23**: WHEN `allocateStat` with `unspentStatPoints=0` THEN SHALL reject.
    **Test layer: unit**
24. **PROG27-24**: WHEN `resetStats({ level: 12, bonusStr: 3, … })` THEN all bonuses SHALL be **0** and unspent SHALL equal **11** (levels 2–12).
    **Test layer: unit**
25. **PROG27-25**: WHEN `resetStats` at Bitz with sufficient adena (`level×1000`) THEN server persists reset stats.
    **Test layer: room**
26. **PROG27-26**: WHEN `resetStats` out of trainer range THEN SHALL reject.
    **Test layer: room**
27. **PROG27-27**: WHEN `bonusStr=2` THEN `calcClassBasePAtk` SHALL use `baseStr+2`.
    **Test layer: unit**
28. **PROG27-28**: WHEN stat reset THEN recomputed `pAtk` on next hit SHALL reflect base-only stats.
    **Test layer: room**

---

### P5: PvP flag & karma ⭐ MVP

**User Story**: As a player, I can flag for PvP and face karma consequences for killing innocents.

**Acceptance Criteria**:

29. **PROG27-29**: WHEN `togglePvp` THEN `pvpFlag=1` and `pvpFlagEndMs = now + 120000`.
    **Test layer: room**
30. **PROG27-30**: WHEN `now ≥ pvpFlagEndMs` THEN tick SHALL clear `pvpFlag` to **0**.
    **Test layer: room**
31. **PROG27-31**: WHEN attacker kills player with `karma ≥ 0` and target `pvpFlag=0` THEN attacker `karma` SHALL decrease by **720** (first PK).
    **Test layer: room**
32. **PROG27-32**: WHEN attacker kills player with `pvpFlag=1` THEN attacker `karma` SHALL NOT decrease (pvp kill).
    **Test layer: room**
33. **PROG27-33**: WHEN attacker kills flagged player THEN attacker `pvpKills` SHALL increment.
    **Test layer: room**
34. **PROG27-34**: WHEN player with `karma < 0` gains **3000** mob XP THEN `karma` SHALL increase by **`floor(3000/300)=10`** toward **0**.
    **Test layer: unit**
35. **PROG27-35**: WHEN `togglePvp` inside peace zone THEN SHALL reject.
    **Test layer: room**
36. **PROG27-36**: WHEN `karma < 0` THEN `__GAME_STATE__.player.karma` SHALL expose negative value via `wireRoom`.
    **Test layer: client unit**

---

### P6: Player vs player combat ⭐ MVP

**User Story**: As a flagged player, I can attack another flagged or chaotic player in combat zones.

**Acceptance Criteria**:

37. **PROG27-37**: WHEN attacker targets player with `pvpFlag=1` outside peace zone THEN `resolvePlayerVsPlayerAttack` SHALL deal damage > **0**.
    **Test layer: unit**
38. **PROG27-38**: WHEN attacker targets innocent (`pvpFlag=0`, `karma≥0`) without chaotic THEN SHALL deal **0** damage.
    **Test layer: unit**
39. **PROG27-39**: WHEN player `hp ≤ 0` from PvP THEN `handlePlayerDeath` runs with killer session recorded.
    **Test layer: room**
40. **PROG27-40**: WHEN attack player in peace zone THEN SHALL deal **0** damage.
    **Test layer: room**
41. **PROG27-41**: WHEN two sessions: A toggles PvP, B attacks A outside village THEN B's hit reduces A `hp` (two-session room test).
    **Test layer: room**
42. **PROG27-42**: WHEN `useSkill` physical/magic targets valid PvP player THEN damage applies server-side.
    **Test layer: room**

---

### P7: Polish & gate

**Acceptance Criteria**:

43. **PROG27-43**: WHEN `allocateStat` with invalid stat name THEN reject.
    **Test layer: unit**
44. **PROG27-44**: WHEN player targets self for PvP THEN reject.
    **Test layer: room**
45. **PROG27-45**: WHEN death with `karma < 0` THEN loss uses karma multiplier on percent (anchor: 10% higher loss when multiplier **1.1** — unit configurable constant **`KARMA_EXP_LOST_MULT=1.0`** default; test uses injected **1.1**).
    **Test layer: unit**
46. **PROG27-46**: Solo mob kill SP/XP regression — Phase 4/26 kill path unchanged for level **1** Gremlin (+44 XP).
    **Test layer: room**
47. **PROG27-47**: `wireRoom` exposes `sp`, `unspentStatPoints`, `pvpFlag`, `expBeforeDeath` on `__GAME_STATE__.player`.
    **Test layer: client unit**
48. **PROG27-48**: Full gate `nx run-many -t build lint test` green; no new test file **>10 s** (AD-014).
    **Test layer: gate**

---

## Edge Cases

- WHEN player dies with `expBeforeDeath` already set THEN overwrite with latest pre-penalty XP.
- WHEN restore partially fails (insufficient adena) THEN no partial XP grant.
- WHEN delevel would drop below level **10** THEN clamp XP to `xpForLevel(10)`.
- WHEN party member at cap receives kill THEN skip XP but still award SP unless SP cap added later (none — SP uncapped).
- WHEN disconnect while `pvpFlag=1` THEN flag timer pauses (persist endMs) — timer uses absolute `pvpFlagEndMs`.
- WHEN killer and victim in different parties THEN PvP rules still apply (no party immunity).
- WHEN trade open and toggle PvP THEN allowed (no interaction block).

---

## Requirement Traceability

| Requirement ID | Story | Status |
| -------------- | ----- | ------ |
| PROG27-01 … 08 | P1: Death & delevel | Pending |
| PROG27-09 … 12 | P2: XP restore | Pending |
| PROG27-13 … 20 | P3: Curve, cap & SP | Pending |
| PROG27-21 … 28 | P4: Stats & re-spec | Pending |
| PROG27-29 … 36 | P5: PvP flag & karma | Pending |
| PROG27-37 … 42 | P6: PvP combat | Pending |
| PROG27-43 … 48 | P7: Polish & gate | Pending |

**Coverage:** 48 total, 0 mapped to tasks (pending tasks.md), 0 unmapped.

---

## Success Criteria

- [ ] Level **10** death loses **2039** XP in unit + room tests.
- [ ] Biotin restores lost XP for adena; delevel from **11→10** on large loss.
- [ ] Level cap **20** enforced; SP gates `learnSkill`.
- [ ] Trainer stat reset returns points; PvP two-session hit deals damage.
- [ ] All **48** ACs traced in `validation.md` with unit/room/client evidence.
