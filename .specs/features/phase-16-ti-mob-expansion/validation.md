# Phase 16 — Talking Island Mob Expansion (+5) — Validation Report

**Verifier:** fresh-eyes sub-agent (tlc-spec-driven Validate)  
**Scope:** commits `4a427ec..9e8ba8d` (HEAD)  
**Date:** 2026-06-28  

## Verdict: **PASS**

All gate commands green. P1 acceptance criteria are covered by unit/seed/room tests and the visual gate; TIMOB-28/29 are **deferred** per phase scope (e2e not in gate). One discrimination sensor (M2) **survived** due to ineffective fault coordinates — documented below; not a missing AC.

---

## Gate results

| Gate | Command | Result |
|------|---------|--------|
| Server | `nx test server` | **198/198 PASS** (21 files, 3.21s) |
| Client | `nx test client` | **220/220 PASS** (46 files, 7.79s) |
| Game-core | `nx test game-core` | **87/87 PASS** (19 files, 0.49s) |
| Visual | `node scripts/visual-gate.mjs` | **25/25 PASS** |

**AD-014 slow-test check:** No single test file exceeded 30s. `TownRoom.spec.ts` Orc combat pin ~58ms; longest client file `room.spec.ts` ~928ms. No defect flagged.

---

## AC traceability (TIMOB-01–32)

| AC | Description (summary) | Test(s) | Status |
|----|----------------------|---------|--------|
| TIMOB-01 | `TI_MOB_IDS` has exactly nine ids | `server/src/seed/paths.spec.ts` | PASS |
| TIMOB-02 | Nine monster rows, names/levels match roster | `monsters.seeder.spec.ts` (per-mob + `seeds nine monsters total`) | PASS |
| TIMOB-03 | Elpy (20432) seed anchors | `monsters.seeder.spec.ts` › Elpy | PASS |
| TIMOB-04 | Elder Keltir (20544) anchors | `monsters.seeder.spec.ts` › Elder Keltir | PASS |
| TIMOB-05 | Elder Wolf (20442) anchors | `monsters.seeder.spec.ts` › Elder Wolf | PASS |
| TIMOB-06 | Giant Toad (20121) anchors | `monsters.seeder.spec.ts` › Giant Toad | PASS |
| TIMOB-07 | Orc (20130) anchors + aggression | `monsters.seeder.spec.ts` › Orc | PASS |
| TIMOB-08 | Drop anchor per new mob | `drops.seeder.spec.ts` (20432, 20544, 20442, 20121, 20130) | PASS |
| TIMOB-09 | Spawns for all nine `TI_MOB_IDS` | `spawns.seeder.spec.ts` › includes all nine | PASS |
| TIMOB-10 | Total spawn count ≥ 20 | `spawn-placement.spec.ts`, `spawns.seeder.spec.ts` | PASS |
| TIMOB-11 | Every spawn `!isInPeaceZone(x,z)` | `spawn-placement.spec.ts` › TIMOB-11 | PASS |
| TIMOB-12 | Every spawn walkable | `spawn-placement.spec.ts` › TIMOB-12 | PASS |
| TIMOB-13 | Idempotent seed | `monsters.seeder.spec.ts`, `drops.seeder.spec.ts`, `spawns.seeder.spec.ts` | PASS |
| TIMOB-14 | Full `CreatureEntry` for nine ids | `creature-manifest.spec.ts` › `it.each(SEEDED_NPC_IDS)` | PASS |
| TIMOB-15 | Unknown npcId → null | `creature-manifest.spec.ts` › 99999 | PASS |
| TIMOB-16 | All clipMap keys non-empty | `creature-manifest.spec.ts` › per-id loop | PASS |
| TIMOB-17 | Unique model path per npcId | `creature-manifest.spec.ts` › TIMOB-17 | PASS |
| TIMOB-18 | Elpy rigged quadruped GLB | `visual-gate.mjs` (Elpy.glb rigged) + manifest | PASS |
| TIMOB-19 | Elder Keltir distinct from Bearded Keltir | `visual-gate.mjs` dedup + `ElderKeltir.glb` | PASS |
| TIMOB-20 | Elder Wolf distinct from Wolf | `visual-gate.mjs` dedup + `ElderWolf.glb` | PASS |
| TIMOB-21 | Giant Toad amphibian GLB | `visual-gate.mjs` (GiantToad.glb rigged) | PASS |
| TIMOB-22 | Orc humanoid distinct from Goblin | `visual-gate.mjs` dedup + `Orc.glb` | PASS |
| TIMOB-23 | LICENSE.txt documents sources | `client/public/models/monsters/LICENSE.txt` Phase 16 block | PASS |
| TIMOB-24 | New mob not capsule body | `mobs.spec.ts` › Orc 20130 mesh not capsule | PASS |
| TIMOB-25 | Independent `AnimationMixer` per instance | `mesh-character.spec.ts` › distinct roots/mixers (regression) | PASS |
| TIMOB-26 | Hit sets `action=Attack`, `actionSeq++` | `TownRoom.spec.ts` › Orc ATTACK pin | PASS |
| TIMOB-27 | Kill emits `action=Die` before delete | `TownRoom.spec.ts` › Orc DIE pin | PASS |
| TIMOB-28 | E2E outer field discovers new npcIds | `client-e2e/src/ti-mob-expansion.spec.ts` | **deferred** |
| TIMOB-29 | E2E attack/die clips on new mob kill | `client-e2e/src/ti-mob-expansion.spec.ts` | **deferred** |
| TIMOB-30 | Ring level progression monotonic | `spawn-placement.spec.ts` › TIMOB-30 | PASS |
| TIMOB-31 | Visual gate structural PASS for five GLBs | `node scripts/visual-gate.mjs` 25/25 | PASS |
| TIMOB-32 | Character-lab PNGs idle/attack/die | `.specs/features/phase-16-ti-mob-expansion/visual-review/` (15 PNGs) | PASS |

**Counts:** 30 PASS · 2 deferred · 0 missing

**Deferred rationale (TIMOB-28, TIMOB-29):** E2E intentionally excluded from Phase 16 gate per orchestrator scope; `ti-mob-expansion.spec.ts` exists but Playwright suite not run. Unit + room + visual coverage deemed sufficient for Validate (AD-010 four-layer contract).

**Supporting coverage (not primary AC):** `spawn-manager.spec.ts` asserts 23 live mobs after boot; `TownRoom.spec.ts` › boots with populated `state.mobs`.

---

## Discrimination sensor (fault injection)

Mutations applied one at a time; reverted after each run (`git` clean post-verify).

| # | Mutation | Expected killer | Result |
|---|----------|-----------------|--------|
| 1 | Remove `20432` from `TI_MOB_IDS` in `paths.ts` | `paths.spec.ts` (TIMOB-01) | **KILLED** — `contains exactly nine Talking Island mob npcIds` failed |
| 2 | Elpy spawn `z`: `-16` → `-5` in `mob_spawns.json` (row `x:22`) | `spawn-placement.spec.ts` (TIMOB-11) | **SURVIVED** — `(22, -5)` still outside peace zone (`x > PEACE_ZONE.maxX`); test did not fail |
| 3 | Remove `20130` from `creature-manifest.ts` | `creature-manifest.spec.ts` (TIMOB-14/17) | **KILLED** — `returns a full entry for seeded npcId 20130` + Phase 16 clipMap test failed |
| 4 | Orc room test expects `EntityAction.Idle` instead of `Attack` | `TownRoom.spec.ts` (TIMOB-26) | **KILLED** — `sets Orc ATTACK action…` failed (`expected 1 to be undefined`) |

**Sensor score:** 3 killed / 1 survived (ineffective injection, not absent guard).

---

## Deviations & lessons

1. **Sensor M2 (peace zone):** Fault injection as specified does not violate `isInPeaceZone` because all Elpy fixture rows have `|x| > 20`. Future sensors should move `(x,z)` inside `[−20,20]²` (e.g. `x:10, z:-5`) to exercise TIMOB-11. The guard itself is correct on the full 23-row fixture.

2. **E2E deferred:** TIMOB-28/29 implemented in `client-e2e` but excluded from this phase gate; enable in a follow-up when e2e stability budget allows.

3. **Visual fidelity:** TIMOB-32 PNGs committed under `.specs/features/phase-16-ti-mob-expansion/visual-review/` (5 mobs × 3 clips). Structural dedup in `visual-gate.mjs` cannot assert silhouette semantics; human/vision review artifacts satisfy AD-017 second layer for this phase.

4. **Spawn fixture:** Canonical 23 rows restored in `9e8ba8d`; ring ordering and count tests aligned.

---

## Iterations

**0 fix iterations** — no P1 gaps requiring code changes.

---

## Recommendation

**PASS** — flip ROADMAP Phase 16 complete; advance to next milestone. Optional follow-up: strengthen peace-zone discrimination sensor coordinates; wire TIMOB-28/29 into CI e2e gate when ready.
