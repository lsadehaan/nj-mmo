# Phase 22 — Complete TI Bestiary (+14 npcIds) Specification

## Problem Statement

Phases 10 and 16 seed **nine** Talking Island mobs with full server authority and rigged
GLB visuals. `TalkingIslandMonsters.xml` defines **21** unique field-monster types; **14**
npcIds remain unseeded — mid-to-high field tiers (Orc Soldier through Giant Blade Spider)
that quests (Phase 21) and authentic TI progression expect. This phase completes the TI
spawn-table bestiary end-to-end: seed stats/drops/spawns, rigged GLBs, manifest rows,
**ranged AI** for Orc Archer, and **social/clan aggro** for werewolf packs — reusing the
Phase 10/16 pipeline without new renderer architecture.

## Goals

- [ ] Extend `TI_MOB_IDS` to **23** npcIds (nine existing + **14** new from spawn table).
- [ ] Seed authentic Classic stats, drops, and walkable field spawns for all 14 new types.
- [ ] Source **14 distinct rigged GLBs** (fidelity-first, CC0 packs) with per-entity
      `clipMap`, scale, feet offset, HP-bar height.
- [ ] Extend `creature-manifest.ts` and unit tests so all **23** seeded mob ids map to
      full `CreatureEntry` rows.
- [ ] **Ranged mob AI** for Orc Archer (`20006`, L2J `ai type="ARCHER"`).
- [ ] **Social aggro** for WEREWOLF clan mobs (`20132`, `20342`, `20343`) per L2J
      `clanHelpRange="300"`.
- [ ] Room-integration + client unit tests; **no Playwright** (post-MVP gate, AD-010).
- [ ] Mandatory two-layer visual gate (AD-017) for all 14 new creatures.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Raid bosses / Nerkas (27016) | Not on TI field spawn table; Phase 21 quest instance |
| Mob weapon attachments (Orc axe, bow prop) | Defer; Phase 11 attachment pattern |
| L2J geodata / exact TI territory polygons | AD-006; simplified `(x,z)` rings until Phase 23 |
| Phase 23 zone re-home | Interim outer bands OK; spawns may be adjusted when 23 lands |
| ORC/GOBLIN clan social aggro beyond seeding flags | MVP: **WEREWOLF** clan assist only (ROADMAP scope) |
| Replacing Gremlin/Goblin (not in TI spawn XML) | Tutorial/MVP ids stay |
| New renderer architecture | Reuse Phase 10 clone-per-instance backend |

---

## Assumptions & Open Questions

Every ambiguity resolved autonomously (Planner cannot consult user).

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| AC prefix | **BEST22-NN** | Matches `TIMOB-NN` / `QUEST21-NN` convention | y |
| Confirmed mob count | **14 npcIds** from `TalkingIslandMonsters.xml` minus seven XML types already seeded | Gremlin/Goblin (20001/20003) are MVP extras, not spawn-table gaps | y |
| `TI_MOB_IDS` ordering | Append 14 ids ascending by level after existing nine | Minimizes diff noise | y |
| Fixture XML (AD-012) | Add 14 `<npc>` nodes + dropLists to `monsters.xml` fixture | CI portability | y |
| Spawn fixture count | **~35** new rows (2–4 per new mob); total **≥ 55** spawn rows | Density for room tests + field walk | y |
| Spawn placement | Interim rings 6–10 (lv7–17) east/south of village; walkable + outside peace zone | Phase 23 may remap; rings documented in design | y |
| Ranged AI scope | Orc Archer **only** (`aiType=ARCHER`); uses L2 `attack.range` + `attack.distance` | ROADMAP explicit; other mobs melee | y |
| Ranged behavior | Chase until within `preferredAttackRangeWorld` (distance÷10); attack without closing to melee; no movement while in range band | L2J ARCHER pattern simplified | y |
| Social aggro scope | **WEREWOLF** clan (`20132`, `20342`, `20343`) when pack mate damaged or acquires target | ROADMAP "wolf packs"; Orc/Goblin clans deferred | y |
| Social trigger | WHEN mob A in clan WEREWOLF gains `targetSessionId` (aggro or retaliate) THEN idle clan mates within `clanHelpRangeWorld` (300÷10=30 m) SHALL set same target | L2J `clanHelpRange` | y |
| Werewolf aggression | `20132` passive (`isAggressive=false`); chieftain/hunter aggressive per XML | Classic values | y |
| Parser extension | Seed parser reads `ai/@_type`, `clanList/clan`, `clanHelpRange`; DB columns `aiType`, `clan`, `clanHelpRange` on `monsters` | Enables AI without hardcoding npcId lists | y |
| Quest overlap | Q00105 (Orc 20130), Q00152 (Stone Golem 20016), Q00107 (Orc Archer 20006) already reference these ids — seed enables quest kills | Phase 21 stub objectives | y |
| Test gate | Vitest only — unit, seed, room; client `wireRoom` + `__GAME_STATE__` | Post-MVP ROADMAP + AGENTS.md | y |
| Implicit: auth / rate limits | N/A — local Colyseus room | — | N/A |
| Implicit: concurrency | Per-test isolated room + temp DB (`instanceKey`, AD-014) | Existing pattern | N/A |

**Open questions:** none — all resolved or logged above.

---

## Confirmed Mob Roster (14 new npcIds)

Sourced from L2J Classic `spawns/TalkingIsland/TalkingIslandMonsters.xml` minus types
already in `TI_MOB_IDS` from that file: **20481, 20432, 20544, 20120, 20442, 20121,
20130** (seven). Gremlin **20001** and Goblin **20003** are seeded but **not** in the TI
spawn XML — they remain; this phase does not remove them.

| npcId | Name | Lv | Silhouette | Race | Aggressive | AI notes |
| ----- | ---- | -- | ---------- | ---- | ---------- | -------- |
| 20131 | Orc Soldier | 7 | Humanoid biped | HUMANOID | no (retaliate) | ORC clan |
| 20006 | Orc Archer | 8 | Humanoid biped + bow | HUMANOID | yes (450) | **ARCHER** ranged |
| 20326 | Goblin Scout | 8 | Humanoid biped (scout) | HUMANOID | no | GOBLIN clan |
| 20132 | Werewolf | 9 | Bipedal beast | HUMANOID | no | **WEREWOLF** social |
| 20343 | Werewolf Hunter | 10 | Bipedal beast (hunter) | HUMANOID | yes (500) | WEREWOLF social |
| 20093 | Orc Warrior | 10 | Humanoid warrior | HUMANOID | yes (450) | ORC clan |
| 20096 | Orc Lieutenant | 11 | Humanoid officer | HUMANOID | yes (450) | ORC clan |
| 20098 | Orc Captain | 12 | Humanoid captain | HUMANOID | yes (450) | ORC clan |
| 20342 | Werewolf Chieftain | 12 | Large bipedal beast | HUMANOID | yes (500) | WEREWOLF social |
| 20016 | Stone Golem | 13 | Bulky golem | CONSTRUCT | yes (450) | slow melee |
| 20101 | Crasher | 14 | Insectoid crusher | BUG | yes (450) | melee |
| 20103 | Giant Spider | 15 | Arachnid | BUG | yes (450) | spider family |
| 20106 | Giant Fang Spider | 16 | Arachnid (fangs) | BUG | yes (450) | distinct from 20103 |
| 20108 | Giant Blade Spider | 17 | Arachnid (blade) | BUG | yes (450) | distinct from 20103/06 |

**Total after phase:** 23 seeded mob types (9 + 14).

### Seed anchors (Classic values — seed tests MUST assert per mob)

| npcId | exp | hp | pAtk | pDef | attackRange | aggroRange | isAggressive |
| ----- | --- | -- | ---- | ---- | ----------- | ---------- | ------------ |
| 20131 | 308 | 113.94 | 14.80956 | 55.51894 | 40 | 500 | false |
| 20006 | 352 | 131.031 | 16.20165 | 57.56203 | 40 | 450 | true |
| 20326 | 352 | 131.031 | 16.20165 | 57.56203 | 40 | 500 | false |
| 20132 | 397 | 58.86809 | 17.70841 | 59.66387 | 40 | 500 | false |
| 20343 | 442 | 172.176 | 19.33758 | 61.82527 | 40 | 500 | true |
| 20093 | 441 | 172.176 | 19.33758 | 61.82527 | 40 | 450 | true |
| 20096 | 486 | 196.116 | 21.03758 | 64.02527 | 40 | 450 | true |
| 20098 | 530 | 220.056 | 22.73758 | 66.22527 | 40 | 450 | true |
| 20342 | 530 | 81.77492 | 25.295666 | 60.2999 | 40 | 500 | true |
| 20016 | 574 | 243.996 | 24.33758 | 68.42527 | 40 | 450 | true |
| 20101 | 618 | 267.936 | 26.03758 | 70.62527 | 40 | 450 | true |
| 20103 | 662 | 291.876 | 27.73758 | 72.82527 | 40 | 450 | true |
| 20106 | 706 | 315.816 | 29.43758 | 75.02527 | 40 | 450 | true |
| 20108 | 750 | 339.756 | 31.13758 | 77.22527 | 40 | 450 | true |

*Implementer verifies exact floats from L2J XML at ingest; table is Planner anchor —
seed tests pin fixture-extracted values.*

### Drop anchors (one row per new mob for seed tests)

| npcId | itemId | item (Classic) | min | max | chance |
| ----- | ------ | -------------- | --- | --- | ------ |
| 20131 | 57 | Adena | 20 | 48 | 70 |
| 20006 | 57 | Adena | 25 | 61 | 70 |
| 20326 | 57 | Adena | 25 | 61 | 70 |
| 20132 | 57 | Adena | 31 | 73 | 70 |
| 20343 | 57 | Adena | 37 | 88 | 70 |
| 20093 | 57 | Adena | 37 | 88 | 70 |
| 20096 | 57 | Adena | 41 | 97 | 70 |
| 20098 | 57 | Adena | 45 | 106 | 70 |
| 20342 | 57 | Adena | 39 | 92 | 70 |
| 20016 | 57 | Adena | 49 | 115 | 70 |
| 20101 | 57 | Adena | 53 | 124 | 70 |
| 20103 | 57 | Adena | 57 | 133 | 70 |
| 20106 | 57 | Adena | 61 | 142 | 70 |
| 20108 | 57 | Adena | 65 | 151 | 70 |

### Ranged anchor (Orc Archer 20006)

| Field | L2J value | World (÷10) |
| ----- | --------- | ----------- |
| `aiType` | ARCHER | — |
| `attack.range` | 40 | 4.0 m (minimum) |
| `attack.distance` | 80 | 8.0 m (preferred max) |

---

## User Stories

### P1: Seed extension — server authority ⭐ MVP

**User Story**: As the authoritative server, I need fourteen additional TI mobs in the DB
with Classic stats, drops, AI metadata, and field spawns.

**Acceptance Criteria**:

1. **BEST22-01**: WHEN `TI_MOB_IDS` is read THEN it SHALL contain exactly **23** ids (nine
   existing + fourteen new). **Test layer: unit**
2. **BEST22-02**: WHEN seed runs against fixtures THEN `monsters` SHALL contain **23**
   rows with names/levels matching the roster. **Test layer: seed**
3. **BEST22-03**: WHEN seed runs THEN Orc Soldier (`20131`) SHALL match anchors (`level: 7`,
   `exp: 308`, `hp: 113.94`, `isAggressive: false`, `clan: ORC`). **Test layer: seed**
4. **BEST22-04**: WHEN seed runs THEN Orc Archer (`20006`) SHALL match anchors (`level: 8`,
   `aiType: ARCHER`, `isAggressive: true`, `aggroRange: 450`). **Test layer: seed**
5. **BEST22-05**: WHEN seed runs THEN Goblin Scout (`20326`) SHALL match anchors (`level: 8`,
   `hp: 131.031`, `isAggressive: false`). **Test layer: seed**
6. **BEST22-06**: WHEN seed runs THEN Werewolf (`20132`) SHALL match anchors (`level: 9`,
   `clan: WEREWOLF`, `clanHelpRange: 300`, `isAggressive: false`). **Test layer: seed**
7. **BEST22-07**: WHEN seed runs THEN Werewolf Hunter (`20343`) SHALL match anchors
   (`level: 10`, `hp: 172.176`, `isAggressive: true`). **Test layer: seed**
8. **BEST22-08**: WHEN seed runs THEN Orc Warrior (`20093`) SHALL match anchors (`level: 10`,
   `exp: 441`, `isAggressive: true`). **Test layer: seed**
9. **BEST22-09**: WHEN seed runs THEN Orc Lieutenant (`20096`) SHALL match anchors
   (`level: 11`, `exp: 486`). **Test layer: seed**
10. **BEST22-10**: WHEN seed runs THEN Orc Captain (`20098`) SHALL match anchors (`level: 12`,
    `exp: 530`). **Test layer: seed**
11. **BEST22-11**: WHEN seed runs THEN Werewolf Chieftain (`20342`) SHALL match anchors
    (`level: 12`, `hp: 81.77492`, `pAtk` ≈ 25.295666). **Test layer: seed**
12. **BEST22-12**: WHEN seed runs THEN Stone Golem (`20016`) SHALL match anchors (`level: 13`,
    `race: CONSTRUCT`, `hp: 243.996`). **Test layer: seed**
13. **BEST22-13**: WHEN seed runs THEN Crasher (`20101`) SHALL match anchors (`level: 14`,
    `race: BUG`). **Test layer: seed**
14. **BEST22-14**: WHEN seed runs THEN Giant Spider (`20103`) SHALL match anchors (`level: 15`).
    **Test layer: seed**
15. **BEST22-15**: WHEN seed runs THEN Giant Fang Spider (`20106`) SHALL match anchors
    (`level: 16`). **Test layer: seed**
16. **BEST22-16**: WHEN seed runs THEN Giant Blade Spider (`20108`) SHALL match anchors
    (`level: 17`). **Test layer: seed**
17. **BEST22-17**: WHEN seed runs THEN each of the fourteen new mobs SHALL have at least one
    `mob_drops` row matching its drop anchor. **Test layer: seed**
18. **BEST22-18**: WHEN seed runs THEN `mob_spawns` SHALL include spawn rows for **all 23**
    `TI_MOB_IDS`. **Test layer: seed**
19. **BEST22-19**: WHEN seed runs THEN total `mob_spawns` count SHALL be **≥ 55**. **Test layer: seed**
20. **BEST22-20**: WHEN any spawn row is seeded THEN `(x,z)` SHALL satisfy `!isInPeaceZone(x,z)`.
    **Test layer: unit**
21. **BEST22-21**: WHEN any spawn row is seeded THEN `(x,z)` SHALL be walkable per `isWalkable`.
    **Test layer: unit**
22. **BEST22-22**: WHEN seed runs twice on the same DB THEN monster/spawn/drop rows SHALL be
    identical (idempotent). **Test layer: seed**

**Independent Test**: `nx test server` seed specs against `FIXTURE_DATA_DIR`.

---

### P1: Creature manifest ⭐ MVP

**Acceptance Criteria**:

23. **BEST22-23**: WHEN `getCreatureEntry(npcId)` is called for each of the **23** seeded ids
    THEN it SHALL return a `CreatureEntry` with `model`, `clipMap`, `scale`, `feetOffsetY`,
    `hpBarYOffset`. **Test layer: unit**
24. **BEST22-24**: WHEN `getCreatureEntry(99999)` is called THEN it SHALL return `null`.
    **Test layer: unit**
25. **BEST22-25**: WHEN each manifest `clipMap` is defined THEN every key in
    `{idle, move, attack, cast, die}` SHALL be a non-empty string. **Test layer: unit**
26. **BEST22-26**: WHEN manifest entries for new mobs are compared THEN each `model` path
    SHALL be unique (no two npcIds share the same GLB path). **Test layer: unit**

---

### P1: Fourteen new GLB assets ⭐ MVP

**Acceptance Criteria** (one per mob — visual gate + manifest unit):

27. **BEST22-27**: Orc Soldier (`20131`) — humanoid biped distinct from Orc (`20130`).
28. **BEST22-28**: Orc Archer (`20006`) — humanoid archer silhouette (bow may be absent;
    fidelity-first mesh).
29. **BEST22-29**: Goblin Scout (`20326`) — humanoid distinct from Goblin (`20003`).
30. **BEST22-30**: Werewolf (`20132`) — bipedal beast/wolf-humanoid.
31. **BEST22-31**: Werewolf Hunter (`20343`) — hunter variant distinct from Werewolf.
32. **BEST22-32**: Orc Warrior (`20093`) — armored orc warrior distinct from Orc Soldier.
33. **BEST22-33**: Orc Lieutenant (`20096`) — distinct from Warrior/Captain.
34. **BEST22-34**: Orc Captain (`20098`) — distinct officer silhouette.
35. **BEST22-35**: Werewolf Chieftain (`20342`) — larger chieftain distinct from Werewolf.
36. **BEST22-36**: Stone Golem (`20016`) — bulky construct/golem.
37. **BEST22-37**: Crasher (`20101`) — insectoid crusher.
38. **BEST22-38**: Giant Spider (`20103`) — arachnid quadruped/multi-leg.
39. **BEST22-39**: Giant Fang Spider (`20106`) — distinct fang spider from `20103`.
40. **BEST22-40**: Giant Blade Spider (`20108`) — distinct blade spider from `20103`/`20106`.
41. **BEST22-41**: WHEN any new GLB is vendored THEN `LICENSE.txt` SHALL document source
    pack (AD-004). **Test layer: file check**

**Independent Test**: `node scripts/visual-gate.mjs` + `shoot-character.mjs` per mob.

---

### P1: Runtime — Phase 10 backend ⭐ MVP

**Acceptance Criteria**:

42. **BEST22-42**: WHEN a mapped new mob syncs THEN client SHALL NOT use `CapsuleGeometry`
    as the creature body. **Test layer: unit**
43. **BEST22-43**: WHEN server resolves a hit on Stone Golem (`20016`) THEN `MobState` SHALL
    set `action=Attack` and increment `actionSeq`. **Test layer: room-integration**
44. **BEST22-44**: WHEN server kills Orc Warrior (`20093`) THEN it SHALL emit `action=Die`
    before `state.mobs.delete()`. **Test layer: room-integration**

---

### P1: Ranged AI — Orc Archer ⭐ MVP

**Acceptance Criteria**:

45. **BEST22-45**: WHEN Orc Archer has a target AND horizontal distance is **greater than**
    `attackRangeWorld` (4 m) THEN mob AI SHALL move toward target (chase). **Test layer: unit**
    (`mob-ai` / `game-core`)
46. **BEST22-46**: WHEN Orc Archer has a target AND distance is within `[attackRangeWorld,
    preferredAttackRangeWorld]` (4–8 m) THEN mob AI SHALL **not** advance closer and SHALL
    allow `resolveMobAttack` to fire. **Test layer: unit**
47. **BEST22-47**: WHEN player stands at **6 m** from pinned Orc Archer and Archer has aggro
    THEN room tick SHALL apply mob damage without Archer closing to melee (<4 m).
    **Test layer: room-integration**

---

### P1: Social aggro — Werewolf clan ⭐ MVP

**Acceptance Criteria**:

48. **BEST22-48**: WHEN passive Werewolf (`20132`) is damaged by a player THEN it SHALL
    acquire `targetSessionId` (existing retaliate path). **Test layer: room-integration**
49. **BEST22-49**: WHEN Werewolf A acquires a target AND Werewolf B (`20132` or `20342`) is
    within **30 m** (`clanHelpRange` 300 ÷ 10) and idle THEN B SHALL acquire the same
    `targetSessionId`. **Test layer: room-integration**
50. **BEST22-50**: WHEN clan mate is outside **30 m** THEN social assist SHALL NOT trigger.
    **Test layer: unit** (`mob-ai`)

---

### P1: Test observability ⭐ MVP

**Acceptance Criteria**:

51. **BEST22-51**: WHEN `wireRoom` syncs mobs THEN `__GAME_STATE__.mobs` SHALL expose
    `npcId` for types in `{20006, 20132, 20016, 20103}` after room join with seeded DB.
    **Test layer: client unit**
52. **BEST22-52**: WHEN player attacks Orc Warrior via room harness THEN `__GAME_STATE__`
    SHALL show `action === 'attack'` at least once on that mob. **Test layer: client unit**
    (`wireRoom` mock)

---

### P2: Spawn progression & visual gate

**Acceptance Criteria**:

53. **BEST22-53**: WHEN spawn coordinates are grouped by ring tier THEN average level SHALL
    increase monotonically from ring 6 (lv7–8) through ring 10 (lv15–17). **Test layer: unit**
54. **BEST22-54**: WHEN `node scripts/visual-gate.mjs` runs THEN all **14** new GLBs SHALL
    PASS structural checks. **Test layer: CI / Verifier**
55. **BEST22-55**: WHEN `shoot-character.mjs` runs for each new mob THEN PNGs for
    **idle, attack, die** SHALL be produced and reviewed (AD-017). **Test layer: Verifier**

---

## Edge Cases

- WHEN two orcs share a clip-map family THEN track names MUST be verified on each **new**
  GLB before mapping (BEST22-25).
- WHEN Orc Archer target enters peace zone THEN Archer SHALL drop target (existing peace rule).
- WHEN social-assist chain risks infinite propagation THEN only **idle** mobs without target
  assist (one hop per tick).
- WHEN `visual-gate.mjs` detects byte-identical GLBs THEN phase SHALL NOT pass.
- WHEN spawn coords fall inside peace zone THEN BEST22-20 SHALL fail.
- WHEN Phase 23 remaps territories THEN spawn JSON may be updated without changing AC ids.

---

## Requirement Traceability

| Requirement ID | Story | Status |
| -------------- | ----- | ------ |
| BEST22-01 … BEST22-22 | P1 Seed | Pending |
| BEST22-23 … BEST22-26 | P1 Manifest | Pending |
| BEST22-27 … BEST22-41 | P1 GLBs | Pending |
| BEST22-42 … BEST22-44 | P1 Runtime | Pending |
| BEST22-45 … BEST22-47 | P1 Ranged AI | Pending |
| BEST22-48 … BEST22-50 | P1 Social aggro | Pending |
| BEST22-51 … BEST22-52 | P1 Observability | Pending |
| BEST22-53 … BEST22-55 | P2 Progression / visual | Pending |

**ID format:** `BEST22-[NUMBER]`
**Coverage:** **55** total (52 P1, 3 P2); mapped to tasks in `tasks.md`.

---

## Success Criteria

- [ ] All **21** TI spawn-table monster types playable (23 seeded ids including Gremlin/Goblin).
- [ ] Orc Archer ranged behavior proven in unit + room tests.
- [ ] Werewolf pack social aggro proven in unit + room tests.
- [ ] Fourteen distinct rigged GLBs; visual gate PASS (AD-017).
- [ ] Gate green: `nx run-many -t build lint test` (no Playwright).
