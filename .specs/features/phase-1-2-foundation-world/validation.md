# Phase 1+2 — Foundation & World Validation

**Date**: 2026-06-27
**Spec**: `.specs/features/phase-1-2-foundation-world/spec.md`
**Diff range**: `e7829a1` (root: Nx workspace init) .. `e80743b` (HEAD) — full feature history, 21 commits
**Verifier**: independent sub-agent (author ≠ verifier), evidence-or-zero, re-derived from spec

**Verdict**: ✅ **PASS** — 21/21 ACs covered with spec-matching assertions; 11/11 sensor mutants killed; all gates green. 1 acceptable grounded deviation (XP curve) + minor coverage observations, none blocking.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 Nx workspace | ✅ Done | `nx.json`, `tsconfig.base.json`, root `package.json` present |
| T2 server scaffold | ✅ Done | `@nx/node` colyseus project builds |
| T3 client scaffold | ✅ Done | `@nx/vite` three + sdk, Vite-bundled |
| T4 e2e scaffold + `npm run dev` | ✅ Done | `package.json:7` concurrently dev script |
| T5 TownRoom + schema | ✅ Done | join/leave + `TownState.players` |
| T6 Drizzle schema + client | ✅ Done | 4 tables, `getDb` |
| T7 XML parsers + fixtures | ✅ Done | fail-loud, committed fixtures |
| T8 runner + mob seeder | ✅ Done | idempotent transaction reset |
| T9 NPC seeder | ✅ Done | Katerina, Roxxy |
| T10 skill seeder | ✅ Done | Power Strike |
| T11 XP curve seeder | ✅ Done | 87 authentic rows |
| T12 client boot + net + hook | ✅ Done | `__GAME_STATE__`, connect smoke |
| T13 terrain | ✅ Done | deterministic, flat-shaded |
| T14 village | ✅ Done | 5 buildings + ground + peace-zone |
| T15 scatter | ✅ Done | seeded RNG, village-exclusion |
| T16 movement system (pure) | ✅ Done | no three/DOM imports |
| T17 click-to-move raycast | ✅ Done | hit→intent, miss→null |
| T18 follow camera | ✅ Done | fixed offset |
| T19 assemble + smoke | ✅ Done | render loop + movement smoke |

---

## Spec-Anchored Acceptance Criteria

### P1: Monorepo & Dev Loop (FND)

| Criterion | Spec outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| FND-01 `npm run dev` starts server+client concurrently | both processes start | `package.json:7` — `concurrently ... "nx serve server" "nx serve client"` (config-verified; no automated concurrency test, build-gate layer per tasks matrix) | ✅ PASS (config) |
| FND-02 client connects + reflects connected state | `connected === true` | `client-e2e/src/connect.spec.ts:6` — `waitForFunction(() => window.__GAME_STATE__?.connected === true)`; `client/src/net/room.ts:10` `setConnected(true)` | ✅ PASS |
| FND-03 TownRoom accepts join, maintains state, clean leave | join adds player; leave removes; state present | `server/src/rooms/TownRoom.spec.ts:20` `expect(room.state.players.size).toBe(1)`; `:37` size→0 after leave; `:43-44` state/players defined | ✅ PASS |
| FND-04 `nx run-many -t build lint test` passes | green | Gate run below — exit 0, 3 projects | ✅ PASS |

### P1: L2J Classic Data Seed (SEED)

| Criterion | Spec outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| SEED-01 4 TI mobs authentic | Gremlin 20001/lvl1/exp44; Keltir 20481/lvl1/exp44; Wolf 20120/lvl4/exp176; Goblin 20003/lvl5/exp220 | `monsters.seeder.spec.ts:28` Gremlin `{level:1,exp:44,hp:41.145,mp:44.247,race:'FAIRY'}`; `:42` Keltir `{level:1,exp:44,sp:1,race:'ANIMAL'}`; `:55` Wolf `{level:4,exp:176,hp:70.896}`; `:62` Goblin `{level:5,exp:220,hp:84.189,race:'HUMANOID'}` — all cross-checked vs real `stats/npcs/*.xml` | ✅ PASS |
| SEED-02 2 NPCs | Katerina 30004 Grocer Merchant; Roxxy 30006 Gatekeeper Teleporter | `npcs.seeder.spec.ts:28` `{npcId:30004,name:'Katerina',title:'Grocer',type:'Merchant',level:70}`; `:41` `{30006,'Roxxy','Gatekeeper','Teleporter',70}` — verified vs real `30000-30099.xml` | ✅ PASS |
| SEED-03 Power Strike | id3, maxLevel9, mpConsumeL1 9, reuseDelay3000 | `skills.seeder.spec.ts:28` `{skillId:3,name:'Power Strike',maxLevel:9,operateType:'A1',targetType:'ENEMY',castRange:40,reuseDelay:3000,mpConsumeL1:9}` — verified vs real `stats/skills/00000-00099.xml` (toLevel=9) | ✅ PASS |
| SEED-04 XP curve | L2=68, L3=364, L10=48230, full curve | `experience.seeder.spec.ts:30-32` spot values; `:33` level 87 exists; `:34` `toHaveLength(87)` — values + row count match authentic `experience.xml` | ✅ PASS (see deviation note) |
| SEED-05 idempotent re-run identical | second run == first, no dupes | `monsters.seeder.spec.ts:73-74` `toHaveLength(4)` + `second.toEqual(first)`; runner resets in txn `seed.ts:25-29` | ✅ PASS |
| SEED-06 fail loud on missing field | throw naming entity | `parsers.spec.ts:31` mob exp→`'...entity id 20001'`; `:53` npc title id 30004; `:77` skill reuseDelay id 3; `:95` experience tolevel id 2 | ✅ PASS |

### P1: Talking Island World (WLD)

| Criterion | Spec outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| WLD-01 procedural flat-shaded heightmap, no asset files | deterministic geometry; flat shading | `terrain.spec.ts:8-11` same-seed vertices/indices equal; `:24` different seed differs; flat shading is code-config `terrain.ts:117` `flatShading:true` (not unit-asserted — WebGL not DOM-testable) | ✅ PASS (note) |
| WLD-02 village: ground + 5 buildings + peace-zone | counts exactly | `village.spec.ts:15` buildings `toHaveLength(5)`; `:16` ground 1; `:17` peace-zone 1 | ✅ PASS |
| WLD-03 scattered trees/rocks + surrounding field | props in field, off village patch | `scatter.spec.ts:25` `hypot(x,z) >= 25` (outside village); `:26` rest on terrain height; kinds tree/rock `scatter.ts:51` | ✅ PASS |
| WLD-04 deterministic layout same seed | identical across runs | `terrain.spec.ts:8`; `scatter.spec.ts:17` `a.toEqual(b)`; `village.spec.ts:23` `a.toEqual(b)` | ✅ PASS |

### P1: Click-to-Move & Follow Camera (MOVE)

| Criterion | Spec outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| MOVE-01 click raycast → world pos → target intent | hit→intent at hit pos | `click-to-move.spec.ts:19` `toMovementIntent(hit)` → `{targetX:12,targetZ:-4}` | ✅ PASS |
| MOVE-02 advance fixed speed, stop within epsilon | move = speed·dt; stop ≤ epsilon | `movement-system.spec.ts:13` `next.x ≈ DEFAULT_MOVE_SPEED`; `:20` within `ARRIVAL_EPSILON` | ✅ PASS |
| MOVE-03 follow camera fixed offset/height | player + offset | `follow-camera.spec.ts:7` `computeCameraPosition` = player+offset; `:21-22` offset preserved as player moves | ✅ PASS |
| MOVE-04 publish player pos on `__GAME_STATE__` | position observable | `renderer.ts:134` `setPlayer(...)`; observed `smoke.spec.ts:18,49` | ✅ PASS |
| MOVE-05 click miss → target unchanged | miss→null, no change | `click-to-move.spec.ts:36-37` miss → `null`; `movement-system.spec.ts:25` null intent leaves state unchanged | ✅ PASS (note: renderer plane-fallback) |

### P2: Playwright Smoke (E2E)

| Criterion | Spec outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| E2E-01 boot + canvas mounted + connected | `#game` visible, `connected===true` | `smoke.spec.ts:6` `#game` visible; `:7` `connected === true` | ✅ PASS |
| E2E-02 ground click changes player pos | player moves from initial | `smoke.spec.ts:18` capture initial; `:29` `__handleGroundClick__`; `:39-47` waits player.x/z change; `:50` `expect(moved.x!==initial.x || moved.z!==initial.z).toBe(true)` — change driven by real `step()` in `renderer.ts:120` tick | ✅ PASS |

**Status**: ✅ All 21 ACs covered; assertions match spec-defined outcomes.

---

## Discrimination Sensor

Mutations applied in scratch state only (edit → run targeted test → `git checkout --` revert). Source tree confirmed unchanged afterward.

| # | File:line | Mutation | Test run | Killed? |
| - | --------- | -------- | -------- | ------- |
| 1 | `monsters.parser.ts:39` | mob `exp` reads `@_sp` instead of `@_exp` | monsters.seeder | ✅ Killed (4/5 failed) |
| 2 | `experience.parser.ts:18` | `nodes.slice(1)` (drop a curve row) | experience.seeder | ✅ Killed (`toHaveLength(87)` → got 86) |
| 3 | `skills.parser.ts:43` | `maxLevel` reads `castRange` not `toLevel` | skills.seeder + parsers | ✅ Killed (2 failed) |
| 4 | `npcs.parser.ts:30` | NPC `type` reads `@_name` not `@_type` | npcs.seeder | ✅ Killed (2/2 failed) |
| 5 | `movement-system.ts:44` | flip advance sign `x + …` → `x - …` | movement-system | ✅ Killed |
| 6 | `terrain.ts:64` | inject `Math.random()` into vertex height | terrain | ✅ Killed (determinism) |
| 7 | `scatter.ts:48` | flip village-exclusion `<` → `>` | scatter | ✅ Killed (exclusion) |
| 8 | `scatter.ts:55` | seeded RNG → `Math.random()` for scale | scatter | ✅ Killed (determinism) |
| 9 | `camera/follow-camera.ts:22` | offset `z +` → `z -` | follow-camera | ✅ Killed (2/2 failed) |
| 10 | `click-to-move.ts:52` | `hits.length === 0` → `< 0` (never null on miss) | click-to-move | ✅ Killed (miss test) |
| 11 | `click-to-move.ts:53` | hit `z` mapped from `point.x` | click-to-move | ✅ Killed (hit test) |
| 12 | `TownRoom.ts:17` | drop `players.set(...)` side effect on join | TownRoom | ✅ Killed (2/3 failed) |

**Sensor depth**: lightweight+ (12 behavior-level mutations across all high-value modules: seed mob/NPC/skill/XP, movement `step()`, terrain & scatter determinism, scatter exclusion, follow camera, raycast miss & hit, room join).
**Result**: 12/12 killed, 0 survived — ✅ PASS.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code / no scope creep | ✅ (seed values, pure modules; movement kept three/DOM-free per AD-008) |
| Surgical changes, matches patterns | ✅ |
| Spec-anchored outcome check (asserted values match spec) | ✅ |
| Per-layer coverage (domain 1:1 ACs; e2e happy+edge) | ✅ |
| Every test maps to a spec AC / edge case | ✅ (no unclaimed tests) |
| Documented guidelines followed | ✅ `AGENTS.md` 4 test layers, server-authority boundary, WebGL-not-DOM (`__GAME_STATE__`), injected seeded RNG (`scatter.ts:5`) |

---

## Edge Cases

- [x] Missing/malformed XML attr → throws naming entity id (`parsers.spec.ts`).
- [x] Idempotent reset on existing DB (`monsters.seeder.spec.ts:65`).
- [x] Click ray misses terrain → previous target kept, no NaN (`click-to-move.spec.ts`, `movement-system.spec.ts`; `movement-system.ts:47` finite guard).
- [x] Already at target → no-op (`movement-system.spec.ts:28`).
- [~] L2J data dir not found → clear error: code throws path (`experience.seeder.ts:21-23`) but the "not found" branch is not exercised by a test (fixtures always present). Observation, not blocking.
- [~] Client cannot reach server → `connected=false`, no crash: handled (`net/room.ts:14-21` `connectSafe` catch → `setConnected(false)`) but the false-path is not asserted by a test. Observation, not blocking.

---

## Gate Check

- **Build/lint/test gate**: `nx run-many -t build lint test --skip-nx-cache` → exit 0, 3 projects (client, server, client-e2e).
- **e2e gate**: `nx e2e client-e2e --skip-nx-cache` → 3 passed (8.0s).
- **Server tests**: 6 files, **20 passed** (parsers 8, monsters 5, npcs 2, skills 1, experience 1, TownRoom 3).
- **Client tests**: 6 files, **15 passed** (terrain 3, scatter 2, village 2, movement 4, camera 2, click-to-move 2).
- **e2e tests**: **3 passed** (connect 1, smoke 2).
- **Total**: 38 tests, 0 failed, **0 skipped/disabled** (grep for `.skip/.only/.todo/xit/xdescribe` → none).
- **Test count before feature**: 0 (greenfield) → **after: 38** (+38).

---

## Specific Scrutiny Findings (author-flagged, independently verified)

1. **XP curve deviation (87 vs 91)** — *Acceptable grounded deviation.* Real `~/Dev/L2J_Mobius/.../stats/players/experience.xml` declares `maxLevel="91"` but contains only **87** `<experience>` rows (levels 1–87); the committed fixture matches byte-for-byte. The seeder seeds all parsed rows; the test asserts `toHaveLength(87)` + spot values L2=68/L3=364/L10=48230, all authentic. The spec's *assumption note* ("maxLevel=91") refers to the XML attribute, not the row count — so the test asserts the **more correct** authentic outcome. Commit `8dc2394` explicitly reconciles this. **Not a failing AC; one spec-precision observation:** the spec assumption text (91) should be read as the attribute cap, not the seeded row count (87).

2. **Seed authenticity** — *Confirmed genuine.* Every seeded mob/NPC/skill/XP value was cross-checked against the real L2J Classic XML tree: Gremlin/Goblin/Wolf/Keltir race+exp+hp+mp, Katerina/Roxxy id/type/title/level 70, Power Strike id3/toLevel9/A1/ENEMY/castRange40/reuseDelay3000/mpConsumeL1 9, and XP spot values — all match. Fixtures are faithful subsets, not fabricated.

3. **`window.__GAME_STATE__` hook & smoke** — *Real movement, not a shortcut.* `__handleGroundClick__` (`main.ts:20`) routes to the same `game.handleClick` as the real DOM click listener; it sets `pendingIntent` via `toMovementIntent(...)`, and the next animation frame's `tick()` calls the **pure `step()`** (`renderer.ts:120`) which advances the player, then `setPlayer` publishes the new position. The smoke first waits for `target` to be set, then for `player.x/z` to differ from the captured initial — so the assertion observes a genuine movement-system-driven position change, not a test-only write. The headless horizontal-plane raycast fallback (`renderer.ts:154-160`) only ensures the ray yields a real world coordinate when `intersectObject` returns nothing under headless WebGL; movement is still computed by `step()`. The smoke cannot pass trivially.
   - *Observation:* because the in-app `handleClick` plane fallback almost always produces a hit, real-world MOVE-05 "miss" rarely triggers in the app; the spec's raycast-miss logic is nonetheless correctly unit-covered (`click-to-move.spec.ts`).

4. **Repo hygiene** — *Observation (not a spec AC).* `.nx/workspace-data/*` cache files and `nx.json` are tracked and show as modified in the working tree (pre-existing drift from Nx runs, present before validation began). Recommend adding `.nx/` to `.gitignore` and untracking the cache. Non-blocking.

---

## Requirement Traceability Update

| Requirement | New Status |
| ----------- | ---------- |
| FND-01..04 | ✅ Verified |
| SEED-01..06 | ✅ Verified |
| WLD-01..04 | ✅ Verified |
| MOVE-01..05 | ✅ Verified |
| E2E-01..02 | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready.

**Spec-anchored check**: 21/21 ACs matched the spec-defined outcome. 1 acceptable grounded deviation (XP 87 rows = authentic; spec assumption text said 91 = attribute cap).
**Sensor**: 12/12 mutations killed, 0 survived.
**Gate**: build+lint+test green (35 unit/integration/seed) + e2e green (3); 38 total, 0 skipped.

**What works**: monorepo dev loop + connected room hook; authentic L2J Classic seed (mobs/NPCs/Power Strike/XP, idempotent, fail-loud); deterministic procedural world (terrain/village/scatter); pure server-migratable movement with click→intent raycast and follow camera; on-screen smoke proves real click-driven movement.

**Issues found**: none blocking. Observations: (a) `npm run dev` concurrency, connectSafe false-path, and data-dir-not-found error are code-verified but not automated-tested; (b) flat-shading is code-config (WebGL not DOM-testable); (c) renderer plane-fallback softens in-app MOVE-05 miss (logic unit-covered); (d) tracked `.nx/` cache + `nx.json` drift — recommend gitignore.

**Next steps**: optionally add a `connectSafe`-failure e2e and untrack `.nx/`. Phase 3 should lift `step()` into `TownRoom` per AD-008.
