# Phase 21 — Quests & Tutorial Specification

## Problem Statement

Phases 6–20 deliver combat, NPCs, inventory, and skills, but there is no guided
progression: new players lack a tutorial, there is no quest log, NPCs show no quest
markers, and kills/collects do not advance authored objectives with server-validated
rewards. Phase 21 adds an authoritative quest engine and the Talking Island starter
chain — Tutorial (**Q00255**) plus **16** core `Q001xx` / `Q0015x` quests — with
quest log UI, NPC markers, and room-tested outcomes per AD-001.

## Goals

- [ ] Data-driven quest engine: state machine, quest-only items, branching dialog
      shell, server-validated rewards (XP / adena / items).
- [ ] **17** playable TI starter quests seeded from L2J reference scripts (not
      runtime dependency).
- [ ] Tutorial (**Q00255**) auto-starts; guides first kill; grants soulshot /
      spiritshot reward per archetype.
- [ ] Quest log UI + `window.__GAME_STATE__.quests` test hook (AD-009).
- [ ] NPC quest markers (`!` available / completable, `?` in-progress) derived from
      server quest state.
- [ ] Unit + seed + room-integration + client unit tests; **no Playwright** (AD-010).

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Seven Signs / epic / class-transfer quests | Post-TI |
| Party-shared quest credit | Phase 26 |
| Full L2J HTML dialog port | MVP dialog shell + key lines per step |
| Authentic quest-giver NPC spawns for every L2J id | Phase 24; stub givers onto existing `TI_NPC_IDS` this phase |
| Race-exclusive quest rejection | MVP: level + prerequisite quests only; race gates ignored |
| Quest abandon / replay after complete | One completion per character; no abandon UI |
| SP rewards | SP economy is Phase 27; quest SP rewards logged as **0** |
| Playwright / `client-e2e` | Post-MVP per ROADMAP + AGENTS.md |

---

## Assumptions & Open Questions

Every ambiguity resolved autonomously (Planner cannot consult user).

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| AC prefix | **QUEST21-NN** | Matches `SKILL20-NN` / `CHAR19-NN` convention | y |
| Quest count | **17** = Q00255 + 16 from `Q001xx`/`Q0015x` (table below) | ROADMAP ~17 | y |
| Quest-giver NPCs | **Stub map** from L2J logical npcId → spawned `TI_NPC_IDS` (9 NPCs) | ROADMAP Phase 24 deferral | y |
| Race gates | **Ignored** — any `classId` may accept/start | Simplifies TI slice; avoids blocking mystic/fighter paths | y |
| Level gates | **Enforced** per L2J `MIN_LEVEL`; tests set `level` via room harness | Authentic gating without race walls | y |
| Quest prerequisites | **Linear chain optional** — only explicit L2J prereqs modeled (MVP: tutorial none; others independent unless L2J requires prior quest) | TI starters are mostly parallel | y |
| Quest item model | Flag `is_quest_item` on seeded items; quest items **cannot** be sold; removed on quest complete/fail cleanup | L2J quest items are non-tradeable | y |
| Quest item drops | **100%** on qualifying kill when COLLECT objective active (deterministic; no RNG for quest drops) | AD-010 determinism; L2J rates vary — quest path bypasses `mob_drops` RNG | y |
| Dialog UX | Extend `npc-dialog` with `quest` variant: title + body text + 1–3 labeled buttons → `questAction` intent | ROADMAP “dialog shell” | y |
| XP reward path | Reuse `grantXp` from `@nj/game-core` (same as mob kills) | Existing `applyKillRewards` pattern | y |
| Adena rewards | Server increments `PlayerState.adena` + persists `characters.adena` | Same as shop | y |
| Quest state replication | `PlayerState.questEntries` — array of `{ questId, step, counters[] }` | Per-player markers + log | y |
| NPC markers | **Client-derived** from `questEntries` + quest seed defs (no per-NPC schema field) | Markers are player-relative | y |
| Tutorial soulshot reward | Fighters: **1835 × 200**; mystics: **2509 × 100** (L2J Q00255 shot rewards; use 1835/2509 not 5789/5790 — our seeded no-grade ids) | Matches Phase 20 item ids | y |
| Q00158 boss | Spawn **Nerkas 27016** as single quest mob at field anchor when step active; despawn on complete | L2J raid target; one-off instance | y |
| Q00104 mirror mobs | Use existing TI mobs **20121** (Young Red Keltir) as mirror kill targets | Bestiary overlap Phase 10/16 | y |
| Implicit: auth / rate limits | N/A — local Colyseus room | — | N/A |
| Implicit: concurrency | Per-test isolated room + temp DB (`instanceKey`, AD-014) | Existing pattern | N/A |
| Implicit: idempotency | Duplicate `questAction` for same transition **no-ops** (state unchanged) | Safe retries | y |

**Open questions:** none — all resolved or logged above.

---

## L2J Anchors — Quest Batch (17)

Stub giver maps L2J quest NPC → spawned TI NPC for this phase.

| questId | L2J name | Min Lv | Objective types | Stub giver(s) | Completion anchor |
| ------- | -------- | ------ | --------------- | ------------- | ----------------- |
| **255** | Tutorial | 1 | talk → kill → reward | **30006** Roxxy | Roxxy reward |
| **101** | Sword of Solidarity | 10 | collect ×3 → deliver | **30001** Lector | Lector turn-in |
| **104** | Spirit of Mirrors | 10 | kill ×3 types → collect | **30002** Jackson | Jackson turn-in |
| **105** | Skirmish With Orcs | 10 | kill count **10** Orc **20130** | **30026** Bitz | Bitz turn-in |
| **151** | Cure For Fever | 15 | collect **10** fever drops | **30004** Katerina | Katerina turn-in |
| **152** | Shards of Golem | 10 | kill **20016** → collect | **30027** Gwinter | Gwinter turn-in |
| **153** | Deliver Goods | 2 | talk → deliver ×3 NPCs | **30002** Jackson | Arnold leg (stub **30026**) |
| **154** | Sacrifice to the Sea | 2 | collect **3** sacred items | **30003** Silvia | Silvia turn-in |
| **155** | Find Sir Windawood | 3 | talk (find NPC) | **30005** Wilford | Wilford (second beat) |
| **156** | Millennium Love | 15 | talk → deliver letter | **30006** Roxxy | Roxxy turn-in |
| **157** | Recover Smuggled Goods | 5 | collect **4** stolen goods | **30005** Wilford | Wilford turn-in |
| **158** | Seed of Evil | 21 | kill boss **27016** Nerkas | **30033** Baulro | Baulro turn-in |
| **159** | Protect the Water Source | 12 | kill **20007** ×5 | **30001** Lector | Lector turn-in |
| **160** | Nerupa's Request | 3 | talk fetch | **30001** Lector | Lector turn-in |
| **106** | Forgotten Truth | 10 | kill **20014** ×1 | **30033** Baulro | Baulro turn-in |
| **107** | Merciless Punishment | 10 | kill **20006** ×10 | **30026** Bitz | Bitz turn-in |
| **108** | Jumble Tumble Diamond Fuss | 10 | collect gem drops | **30002** Jackson | Jackson turn-in |

### Reward anchors (seed + room tests)

| questId | XP | Adena | Item reward (itemId × count) |
| ------- | -- | ----- | ---------------------------- |
| **255** | **0** | **0** | **1835 × 200** (fighter) or **2509 × 100** (mystic) |
| **101** | **25747** | **0** | **49043 × 1** (Sword of Solidarity — quest reward item) |
| **105** | **27772** | **0** | Red Potion **728 × 1** |
| **151** | **0** | **0** | **1060 × 1** (Healing Potion) |
| **152** | **0** | **0** | **1100 × 1** (Wooden Breastplate) |
| **153** | **0** | **0** | **1060 × 1** |
| **155** | **0** | **0** | **49036 × 1** (Haste Potion) |
| **157** | **0** | **0** | **1060 × 1** |
| **156** | **3000** | **0** | — |
| **158** | **0** | **0** | **49037 × 1** (Clay Tablet reward proxy) |
| **160** | **0** | **0** | **1060 × 1** |

Remaining quests: seed XP/adena/items from L2J script `addExpAndSp` / `giveAdena` /
`rewardItems` at completion; room tests assert **at least one** reward dimension
changes (XP, adena, or item) per quest.

### Tutorial first-kill anchor

| Step | Event | Expected |
| ---- | ----- | -------- |
| Join | Auto `questId=255`, `step=0` | Quest log shows “Tutorial” |
| Accept at Roxxy | `step=1` | Objective: kill Gremlin |
| Kill **20001** Gremlin | `step=2` | Return / complete enabled |
| Complete at Roxxy | `state=completed` | Soulshot stack granted per archetype |

---

## User Stories

### P1: Quest engine — pure rules ⭐ MVP

**User Story**: As the server, I validate quest transitions, objective progress, and
rewards through pure functions with no client trust.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| QUEST21-R01 | Quest definition model: id, steps, objectives, rewards, minLevel, giverNpcId |
| QUEST21-R02 | Runtime state: `not_started` / `in_progress` / `completed` + step + counters |
| QUEST21-R03 | Objective kinds: `TALK`, `KILL`, `KILL_COUNT`, `COLLECT`, `DELIVER` |
| QUEST21-R04 | `advanceQuest` / `onMobKilled` / `hasQuestItem` pure API |
| QUEST21-R05 | Quest items flagged; non-sellable; stripped on complete |

**Acceptance Criteria**:

1. WHEN quest not started and `canStart(level, completedIds)` THEN `startQuest` SHALL set `in_progress` at `step=0`. **Test layer: unit**
2. WHEN `TALK` objective at stub giver npcId THEN `questTalk` SHALL advance step. **Test layer: unit**
3. WHEN `KILL_COUNT` needs **10** of npcId **20130** and **9** killed THEN counter SHALL be **9** and step NOT complete. **Test layer: unit**
4. WHEN **10th** kill recorded THEN step SHALL advance. **Test layer: unit**
5. WHEN `COLLECT` needs item **1012** qty **1** and inventory has it THEN `DELIVER` step MAY complete on turn-in. **Test layer: unit**
6. WHEN quest completes THEN quest-only items in inventory SHALL be removed. **Test layer: unit**
7. WHEN `grantQuestRewards` with XP **3000** THEN `grantXp` SHALL be invoked and level MAY increase. **Test layer: unit**
8. WHEN level **9** and `minLevel=10` THEN `canStart` SHALL be **false**. **Test layer: unit**
9. WHEN duplicate `questAction` for same step transition THEN state SHALL be unchanged (idempotent). **Test layer: unit**

---

### P2: Quest seed & persistence ⭐ MVP

**User Story**: As a developer, quest definitions and per-character progress survive
reconnect via SQLite seed + `character_quests` table.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| QUEST21-R06 | Seed `quests`, `quest_objectives`, `quest_rewards`, quest items |
| QUEST21-R07 | `character_quests` persistence + load on join |
| QUEST21-R08 | Fixture subset under `server/src/seed/__fixtures__/quests/` (AD-012) |

**Acceptance Criteria**:

10. WHEN seed runs THEN **17** quest rows SHALL exist with ids from anchor table. **Test layer: seed**
11. WHEN quest **105** seeded THEN kill objective SHALL reference mob **20130** count **10**. **Test layer: seed**
12. WHEN character completes quest **153** THEN `character_quests` row SHALL persist `completed`. **Test layer: unit (repo)**
13. WHEN player reconnects with in-progress quest **255** step **1** THEN room SHALL restore same step. **Test layer: room-integration**
14. WHEN quest item **1012** seeded THEN `is_quest_item` SHALL be **true**. **Test layer: seed**

---

### P3: Server integration — intents & combat hooks ⭐ MVP

**User Story**: As a player, quest progress advances only when the server processes
`interact` / `questAction` and authoritative kills.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| QUEST21-R09 | `questAction { npcId, action }` message in `TownRoom` |
| QUEST21-R10 | `handleInteract` branches to quest dialog when quest available/active |
| QUEST21-R11 | Mob kill hook calls `onMobKilledForQuests` |
| QUEST21-R12 | Quest rewards mutate `PlayerState` + DB atomically |
| QUEST21-R13 | Completed quests reject re-accept |

**Acceptance Criteria**:

15. WHEN player below min level interacts with quest giver THEN quest dialog SHALL NOT offer accept (helper text only). **Test layer: room**
16. WHEN `questAction accept` for quest **105** at Bitz THEN `questEntries` SHALL include **105** step **0**. **Test layer: room**
17. WHEN kill Gremlin **20001** with tutorial step **1** active THEN step SHALL become **2**. **Test layer: room**
18. WHEN quest complete grants **1835 × 200** THEN `character_items` count SHALL increase by **200**. **Test layer: room**
19. WHEN quest item equipped in inventory and quest completes THEN item SHALL be removed even if count > 0. **Test layer: room**
20. WHEN `questAction complete` without objectives done THEN server SHALL reject (no reward). **Test layer: room**
21. WHEN player tries to sell quest item **1012** at merchant THEN `sell` SHALL reject. **Test layer: room**
22. WHEN completed quest **105** accept attempted THEN state SHALL remain `completed`. **Test layer: room**

---

### P4: Tutorial Q00255 ⭐ MVP

**User Story**: As a new player, I receive the tutorial on join, kill my first mob,
and get soulshots or spiritshots.

**Acceptance Criteria**:

23. WHEN new character joins room THEN quest **255** SHALL auto-start (`in_progress`, step **0**). **Test layer: room**
24. WHEN tutorial at step **0** and player opens Roxxy dialog THEN “Continue tutorial” action SHALL be available. **Test layer: room**
25. WHEN tutorial step **1** active THEN quest log SHALL show kill Gremlin objective. **Test layer: client unit**
26. WHEN fighter (`classId` **0**) completes tutorial THEN inventory SHALL gain **1835 × 200**. **Test layer: room**
27. WHEN mystic (`classId` **10**) completes tutorial THEN inventory SHALL gain **2509 × 100**. **Test layer: room**
28. WHEN tutorial completed THEN quest **255** state SHALL be `completed` and not re-offered. **Test layer: room**

---

### P5: Starter quests — representative room outcomes ⭐ MVP

**User Story**: As a player, I can complete diverse TI starter quests with kill,
collect, and talk objectives.

**Acceptance Criteria** (one room-integration anchor per objective family):

29. WHEN quest **101** full flow (collect 3 parts + turn-in) completes THEN reward item **49043 × 1** SHALL be granted. **Test layer: room**
30. WHEN quest **104** mirror kills (3 distinct mob types) complete THEN step advances per kill type. **Test layer: room**
31. WHEN quest **105** with **10** Orc Soldier kills completes THEN XP grant SHALL be **27772** (±0). **Test layer: room**
32. WHEN quest **151** with **10** drops from spider mobs completes THEN Healing Potion **1060** granted. **Test layer: room**
33. WHEN quest **152** Stone Golem **20016** killed with active step THEN quest item shard granted. **Test layer: room**
34. WHEN quest **153** delivery chain completes THEN reward **1060 × 1** granted. **Test layer: room**
35. WHEN quest **155** talk-to-second-NPC step completes THEN **49036 × 1** granted. **Test layer: room**
36. WHEN quest **158** Nerkas **27016** killed THEN quest completable at Baulro. **Test layer: room**
37. WHEN quest **157** collect **4** goods completes THEN reward item granted. **Test layer: room**

---

### P6: Quest log UI & test hook ⭐ MVP

**User Story**: As a player, I see active and completed quests in a quest log panel;
tests read the same snapshot from `__GAME_STATE__.quests`.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| QUEST21-R14 | `#quest-log` DOM panel toggled with **Q** key |
| QUEST21-R15 | `GameState.quests` mirrors server `questEntries` + titles |
| QUEST21-R16 | Tracker shows current objective text |

**Acceptance Criteria**:

38. WHEN `questEntries` synced THEN `__GAME_STATE__.quests.active` SHALL list quest id **255** with title “Tutorial”. **Test layer: client unit**
39. WHEN quest log open THEN at least one active quest SHALL render objective text. **Test layer: client unit**
40. WHEN quest completes THEN it SHALL move to `completed` list in hook. **Test layer: client unit**
41. WHEN **Q** pressed THEN `#quest-log` visibility SHALL toggle. **Test layer: client unit**
42. WHEN no active quests THEN panel SHALL show empty state string. **Test layer: client unit**
43. WHEN `wireRoom` receives `questEntries` change THEN hook updates without page reload. **Test layer: client unit**

---

### P7: NPC quest markers ⭐ MVP

**User Story**: As a player, I see `!` or `?` above quest givers reflecting my quest
state.

**Requirements**:

| ID | One-liner |
| -- | --------- |
| QUEST21-R17 | `resolveQuestMarker(npcId, quests)` pure function |
| QUEST21-R18 | Client billboard / DOM marker above NPC position |

**Acceptance Criteria**:

44. WHEN quest **105** available at Bitz and not started THEN marker SHALL be **`available`** (`!`). **Test layer: unit**
45. WHEN quest **105** in progress and turn-in at Bitz not ready THEN marker at Bitz SHALL be **`in_progress`** (`?`) or none if not giver step. **Test layer: unit**
46. WHEN quest **105** objectives done and turn-in at Bitz THEN marker SHALL be **`completable`** (`!`). **Test layer: unit**
47. WHEN NPC has no quest involvement THEN marker SHALL be **none**. **Test layer: unit**
48. WHEN `__GAME_STATE__.npcs` synced THEN quest marker count for Roxxy SHALL match resolver (client unit). **Test layer: client unit**

---

## Edge Cases

- WHEN player dies during quest THEN quest state SHALL persist (no fail state in MVP).
- WHEN mob kill credit with no active kill objective THEN `onMobKilled` SHALL no-op for quests.
- WHEN inventory full (stack cap **9999**) and reward item granted THEN grant SHALL still succeed (MVP single stack).
- WHEN two quests require same mob kill THEN one kill SHALL credit both active objectives.
- WHEN player disconnects mid turn-in THEN no reward until `complete` validated again on reconnect.
- WHEN stub giver is also merchant (Katerina) THEN interact SHALL offer **Shop** and **Quest** actions.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| QUEST21-R01–R05 | P1 | Design | Pending |
| QUEST21-R06–R08 | P2 | Design | Pending |
| QUEST21-R09–R13 | P3 | Design | Pending |
| QUEST21-R14–R16 | P6 | Design | Pending |
| QUEST21-R17–R18 | P7 | Design | Pending |

**Coverage:** **48** ACs (QUEST21-01–48), **18** requirements, all mapped in `tasks.md`.

---

## Success Criteria

- [ ] New player can finish Tutorial + at least **3** distinct objective types (kill,
      collect, talk) in one session with server-only validation.
- [ ] `nx run-many -t build lint test` passes; no Playwright in gate.
- [ ] Every AC has a named test; Verifier discrimination sensor kills quest bypass
      faults (e.g., client-side quest complete).
