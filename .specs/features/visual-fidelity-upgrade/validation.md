# Visual Fidelity Upgrade Validation

**Date**: 2026-07-01
**Spec**: `.specs/features/visual-fidelity-upgrade/spec.md`
**Diff range**: `6f6d53c..a4d7cc0` (code) + `64e4697` (docs-only, T6)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1: Renderer static config (shadow map, sun castShadow, fog, tonemapping/color-space, antialiasing) | ✅ Done | `client/src/scene/renderer.ts` — all "Done when" items verified directly against `renderer.spec.ts` |
| T2: Shadow frustum follows the local player | ✅ Done | `sun.target` added to scene; re-center logic reuses the existing `CULL_MOVE_THRESHOLD_SQ` block |
| T3: Procedural grass `DataTexture` + terrain UVs + `receiveShadow` | ✅ Done | `generateGrassTextureData` pure/deterministic; `uv` attribute added; `RepeatWrapping` |
| T4: `receiveShadow` on GLB/instanced static-prop pipeline | ✅ Done | All three call sites (`loadGltfStaticTemplate`, `cloneStaticProp`, `createInstancedScatter`) mirrored |
| T5: `castShadow`/`receiveShadow` on primitive-fallback meshes | ✅ Done | All four primitive builders updated; also fixed a genuine pre-existing dead-code bug (see Code Quality) |
| T6: Record AD-019 in `STATE.md` + handoff/roadmap | ✅ Done | AD-019 present in `.specs/STATE.md` with all required fields; `ROADMAP.md` Phase 30 added (doc-only, no test impact) |

All 6 tasks complete. No blocked/partial tasks.

---

## Spec-Anchored Acceptance Criteria

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| -------------------------- | --------------------- | ----------------------- | ------ |
| **VFU-01** — renderer created THEN `shadowMap` enabled + sun `castShadow=true` w/ configured map size + frustum | `shadowMap.enabled===true`, type `PCFSoftShadowMap`; `sun.castShadow===true`, `mapSize` = `SUN_SHADOW_MAP_SIZE` (2048), frustum = `±SUN_SHADOW_FRUSTUM_M` (100) | `client/src/scene/renderer.spec.ts:136-142` — `expect(game.renderer.shadowMap.enabled).toBe(true)`; `:144-159` — `expect(sun!.shadow.mapSize.width).toBe(SUN_SHADOW_MAP_SIZE)` etc. | ✅ PASS |
| **VFU-02** — scene built THEN terrain + every static env prop `receiveShadow=true` (mesh AND primitive-fallback paths) | `receiveShadow===true` on terrain mesh, GLB template meshes, cloned props, instanced scatter meshes, and all 4 primitive-fallback builders | `client/src/scene/terrain.spec.ts:84-89`; `client/src/scene/static-prop.spec.ts:70-81,89-108,111-126`; `client/src/scene/environment-renderer.spec.ts:207-237`; `client/src/scene/landmark-renderer.spec.ts:31-45` | ✅ PASS |
| **VFU-03** — local player moves beyond move-culling threshold THEN sun + `sun.target` re-center, preserving offset | `sun.position`/`sun.target.position` track new player position at the original `(30,50,20)` relative offset; sub-threshold move does NOT reposition | `client/src/scene/renderer.spec.ts:198-204` (target added to scene); `:206-221` (large move re-centers, offset preserved); `:223-236` (small move does not reposition) | ✅ PASS |
| **VFU-04** — already-flagged entities (player/remote/mob/NPC) unchanged by this feature | No new `castShadow`/`receiveShadow` added to `mesh-character.ts`/`npc-renderer.ts`/`mobs.ts`/`remote-players.ts`/`player-avatar.ts` | Verified via `git diff 6f6d53c..a4d7cc0 -- client/src/scene/creature/mesh-character.ts client/src/scene/npc-renderer.ts client/src/scene/mobs.ts client/src/scene/remote-players.ts client/src/scene/player-avatar.ts` → **empty diff** (independently re-run); `mesh-character.ts:86` still the sole pre-existing `castShadow=true` line, no `receiveShadow` added | ✅ PASS — *evidenced structurally (diff scope), not by a dedicated unit assertion, since this is a "no change" criterion; no test file:line exists or is expected for it* |
| **VFU-05** — `WebGLRenderer` constructed THEN antialiasing enabled | `new THREE.WebGLRenderer({ canvas, antialias: true })` | `client/src/scene/renderer.spec.ts:129-134` — `expect(mockWebGLRendererParams[0]).toMatchObject({ antialias: true })` | ✅ PASS |
| **VFU-06** — renderer created THEN `toneMapping=ACESFilmicToneMapping`, `outputColorSpace=SRGBColorSpace` | Exact enum values | `client/src/scene/renderer.spec.ts:161-167` | ✅ PASS |
| **VFU-07** — renderer factory runs under mocked `WebGLRenderer` (jsdom) THEN configuring shadow/tonemap/color-space does NOT throw | Resolves without throwing; mock extended with `shadowMap` stub | `client/src/scene/renderer.spec.ts:19-30` (mock extended with `shadowMap`/`toneMapping`/`outputColorSpace`); `:183-186` — `expect(createRenderer(canvas)).resolves.toBeDefined()` | ✅ PASS |
| **VFU-08** — scene built THEN `scene.fog` is `THREE.Fog` w/ color exactly `0x87ceeb` | `fog instanceof THREE.Fog`, `fog.color.getHex()===0x87ceeb` (matches `scene.background`) | `client/src/scene/renderer.spec.ts:169-181` | ✅ PASS |
| **VFU-09** — fog configured THEN `near >= MOB_RENDER_DISTANCE` (80) | `FOG_NEAR_M = 120 >= 80` | `client/src/scene/renderer.spec.ts:176,178` — `expect(fog.near).toBe(FOG_NEAR_M)`; `expect(fog.near).toBeGreaterThanOrEqual(MOB_RENDER_DISTANCE)` | ✅ PASS |
| **VFU-10** — fog configured THEN `far > near` and `far < camera.far` | `FOG_FAR_M = 240`; `120 < 240 < 2000` (camera far) | `client/src/scene/renderer.spec.ts:177,179-180` | ✅ PASS |
| **VFU-11** — terrain mesh created THEN `material.map` is a procedurally-generated `THREE.DataTexture`, no external file/`TextureLoader` | `material.map instanceof THREE.DataTexture`; zero `TextureLoader` usage anywhere in `client/src/scene` | `client/src/scene/terrain.spec.ts:55-61`; independently confirmed via `rg TextureLoader client/src/scene` → 0 matches | ✅ PASS |
| **VFU-12** — same seed used twice THEN byte-identical texture data; different seed THEN differs | `Array.from(a)` deep-equal for same seed, not-equal for different seeds | `client/src/scene/terrain.spec.ts:36-46` | ✅ PASS |
| **VFU-13** — texture applied THEN tiles via `RepeatWrapping` driven by a `uv` attribute from world `(x,z)`; geometry gains a `uv` attribute it didn't have | `wrapS===wrapT===THREE.RepeatWrapping`; `uv.count === position.count`; `uv.getX(0)` = `vertices[0]/GRASS_TILE_SIZE_M` | `client/src/scene/terrain.spec.ts:63-70` (wrapping); `:72-82` (uv attribute sized + derived from x/z) | ✅ PASS |
| **VFU-14** — terrain mesh created THEN `receiveShadow===true` | Exact boolean | `client/src/scene/terrain.spec.ts:84-89` | ✅ PASS |

**Status**: ✅ All 14/14 ACs covered and matched to their spec-defined outcome. No spec-precision gaps — every AC in spec.md defines a precise, testable value and every test targets that exact value (not just "an assertion exists").

---

## Discrimination Sensor

Sensor run in the real working tree using targeted in-place mutations, each verified to fail the relevant test file, then reverted with `git checkout --` before the next mutation (working tree confirmed clean — `git status` → "nothing to commit" — after each revert and at the end of the run).

| # | File:line | Description | Killed? |
| - | --------- | ------------ | ------- |
| 1 | `client/src/scene/terrain.ts` (`buildGrassTexture`, `wrapS`/`wrapT`) | Flipped `THREE.RepeatWrapping` → `THREE.ClampToEdgeWrapping` on the grass texture | ✅ Killed — `terrain.spec.ts` `VFU-13: tiles the texture via RepeatWrapping` failed (`expected 1001 to be 1000`, i.e. wrong wrap-mode enum) |
| 2 | `client/src/scene/renderer.ts` (`syncLocalPlayer`, sun re-center block) | Removed the `sun.position.set(...)` / `sun.target.position.set(...)` / `sun.target.updateMatrixWorld()` re-center side effect | ✅ Killed — `renderer.spec.ts` `VFU-03: re-centers the sun and its target on a large player move...` failed (`expected 30 to be close to 80`) |
| 3 | `client/src/scene/static-prop.ts` (`cloneStaticProp` traverse) | Flipped `node.receiveShadow = true` → `false` | ✅ Killed — `static-prop.spec.ts` `VFU-02: sets castShadow and receiveShadow on every cloned mesh` failed (`expected false to be true`) |

**Sensor depth**: lightweight (3 targeted behavior-level mutations, default tier — this is not a P0/critical-path feature)
**Result**: 3/3 killed — ✅ PASS

---

## Interactive UAT Results

Skipped — backend/rendering-only feature with no interactive UI flow (per orchestrator instruction and `AGENTS.md`'s "WebGL is not directly testable in Vitest" principle; independent test plans in spec.md are satisfied by unit assertions on renderer/scene object state).

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| No features beyond what was asked | ✅ — every change traces to a task in `tasks.md` |
| No abstractions for single-use code | ✅ — `buildGrassTexture`/`generateGrassTextureData` are small, directly-used helpers matching existing file style |
| No unnecessary "flexibility" added | ✅ |
| Only touched files required for task | ✅ — exactly the 10 files named in tasks.md (5 prod + 5 spec) plus `STATE.md`/`ROADMAP.md`/`context.md`/`design.md`/`spec.md`/`tasks.md` for T6 (doc-only) |
| Didn't "improve" unrelated code | ⚠️ **One justified exception**: T5 (`landmark-renderer.ts`) wraps the existing `await loadGltfStaticTemplate(...)` call in a `try/catch`, fixing a genuine pre-existing bug — `loadGltfStaticTemplate` *rejects* (never resolves falsy) on GLB load failure, so the original `if (template) {...} else { addLandmarkPrimitive(...) }` primitive-fallback branch was dead/unreachable code in production. Independently confirmed via `git show ad8cabc:client/src/scene/landmark-renderer.ts` (pre-fix) vs. current. This fix was **necessary**, not scope creep: T5's own required test (`landmark-renderer.spec.ts`, a failing mock loader exercising the primitive-fallback path) could not pass or even be written without it, since without the fix `buildLandmarkScene` would throw instead of falling back. It mirrors the identical `try/catch` pattern already used at every other call site (`environment-renderer.ts`'s `loadTemplate` helper). Disclosed transparently in the commit and in `STATE.md`'s Handoff note — not hidden. |
| Matches existing patterns/style | ✅ — shadow-flag additions mirror the exact `castShadow` assignment sites already present; `try/catch` fix mirrors `environment-renderer.ts`'s existing `loadTemplate` pattern |
| Would senior engineer approve? | ✅ (see minor process note below) |
| Tests map to acceptance criteria and are non-shallow (spot-check one story) | ✅ — spot-checked P1 (VFU-01/02/03/04): `renderer.spec.ts`'s frustum-follow tests assert exact numeric offsets (`toBeCloseTo(50 + initialOffsetX, 5)`), not just "was called"; `static-prop.spec.ts`'s shadow-flag tests traverse and assert on every mesh found, with a `meshCount > 0` guard against a false-positive empty loop |
| Spec-anchored outcome check: each test's asserted value matches the spec-defined outcome | ✅ — see AC table above; every test targets the exact spec.md value (colors, distances, enum types, named constants) rather than a loose existence check |
| Per-layer Coverage Expectation met (domain 1:1 AC mapping; this feature has no routes/e2e in scope) | ✅ — matches `tasks.md`'s Test Coverage Matrix (unit-only, client scene/rendering layer) |
| Every test in scope maps to a spec AC, listed edge case, or Done-when criterion (no unclaimed tests) | ✅ — all 24 new tests carry `VFU-NN` labels or map directly to a named edge case (`reports primitive renderKind when GLBs fail to load` maps to the GLB-fallback edge case) |
| Documented project quality/testing guidelines followed | ✅ — `AGENTS.md`'s "WebGL is not directly testable" principle (asserted on renderer/scene object state, no pixel screenshots) and AD-010 (seeded RNG determinism, reusing `createSeededRng`) both followed |

**Minor process note (not a spec/code gap)**: `.specs/STATE.md`'s Handoff section states *"Feature — Visual fidelity upgrade: COMPLETE (Verifier PASS, 2026-07-01)"* and cites this very `validation.md` file — but that file did not exist prior to this independent verification run (confirmed: `validation.md` was absent from the feature directory before this session). `ROADMAP.md`'s Phase 30 checklist correctly leaves *"Verifier PASS recorded in `.specs/features/visual-fidelity-upgrade/validation.md`"* unchecked (`[ ]`), which is the accurate state at commit time. Recommend the implementer avoid writing a Handoff note that asserts "Verifier PASS" before the independent Verifier has actually run — it happened to be true once this validation completed, but the claim was unverified when written. This does not affect the PASS verdict below.

---

## Edge Cases

- [x] GLB prop fails to load → primitive fallback still receives (and casts) shadows, no regression vs. mesh path — `environment-renderer.spec.ts:207-237`, `landmark-renderer.spec.ts:31-45`
- [x] Renderer factory exercised under the existing `renderer.spec.ts` mock (fully mocked `WebGLRenderer`) → assigning `shadowMap.enabled`/`toneMapping`/`outputColorSpace` does not throw; mock extended with a `shadowMap` stub — `renderer.spec.ts:19-30,183-186`
- [x] Player near the world edge (±315 m) → shadows still render correctly (frustum-follow, not fixed at origin) — covered by generalization: `renderer.spec.ts:206-221` tests the re-center mechanism (relative-offset math with no position clamping), which is position-independent by construction; not tested at the literal ±315 m boundary value specifically, but the mechanism has no special-casing that would behave differently there
- [x] Fog `near`/`far` are named exported constants, not duplicated magic numbers between prod and test — `renderer.ts:50-51` exports `FOG_NEAR_M`/`FOG_FAR_M`; `renderer.spec.ts:79-80` imports and asserts against them directly (`expect(fog.near).toBe(FOG_NEAR_M)`), never a literal `120`

---

## Gate Check

- **Gate command**: `nx test client` (Quick gate; ran with `--skip-nx-cache` to force a real, non-cached execution)
- **Result**: 438 passed, 0 failed, 0 skipped (88 files)
- **Test count before feature**: 414 tests / 87 files (per tasks.md baseline)
- **Test count after feature**: 438 tests / 88 files
- **Delta**: +24 tests / +1 file (new `landmark-renderer.spec.ts`)
- **Skipped tests**: none
- **Failures**: none

**Full gate cross-check (`nx run-many -t build lint test`)**: `lint` → 0 errors, 67 pre-existing warnings (unrelated files: `chat-panel.ts`, `friends-panel.ts`, `inventory-window.ts`, `party-panel.ts`, `stat-allocate.ts`, `target-frame.ts`, `trade-window.ts`, `window-manager.ts`, unused-var/non-null-assertion warnings, none touched by this feature). `test` → matches the Quick-gate result above. `build` → `server:build` and `client:build:production` fail with pre-existing TypeScript errors.

**Independent pre-existing-failure verification**: created a throwaway git worktree at the parent commit `6f6d53c` (before this feature's first commit), ran `npm install` + `npx nx build server` and `npx nx build client -c production` there. Both fail with the **same** errors as on the current tree:
- `server:build` — `TownRoom.ts:2489` (`Deferred<Client<any>>` not assignable) and `territory-spawns.ts:407` (`Map<number|undefined,number>` not assignable) — both pre-existing TS2345 errors, zero relation to this feature's files.
- `client:build:production` — 17 pre-existing TS2741 errors (`Property 'setName' is missing...`) in `remote-players.spec.ts`/`renderer-remote.spec.ts` mock objects — unrelated to this feature (mocks predate T1–T6, `setName` was added to `RemotePlayerAvatar` in an earlier phase; not touched by this feature's commits).

Confirms the implementer's claim: both build failures are pre-existing and unrelated to `visual-fidelity-upgrade`. Worktree removed after the check (`git worktree remove --force`); no residue left in the main tree.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status  |
| ----------- | ---------------- | ----------- |
| VFU-01 | Pending | ✅ Verified |
| VFU-02 | Pending | ✅ Verified |
| VFU-03 | Pending | ✅ Verified |
| VFU-04 | Pending | ✅ Verified |
| VFU-05 | Pending | ✅ Verified |
| VFU-06 | Pending | ✅ Verified |
| VFU-07 | Pending | ✅ Verified |
| VFU-08 | Pending | ✅ Verified |
| VFU-09 | Pending | ✅ Verified |
| VFU-10 | Pending | ✅ Verified |
| VFU-11 | Pending | ✅ Verified |
| VFU-12 | Pending | ✅ Verified |
| VFU-13 | Pending | ✅ Verified |
| VFU-14 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 14/14 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 3/3 mutations killed
**Gate**: 438 passed, 0 failed (88 files); pre-existing `server:build`/`client:build:production` failures independently confirmed unrelated (baseline worktree check)

**What works**: Soft PCF shadow map + sun shadow-casting with frustum-follow on the local player; antialiasing + ACES filmic tonemapping + sRGB color space; barely-there linear fog anchored to `MOB_RENDER_DISTANCE`; deterministic seeded `DataTexture` grass texture with `uv`/`RepeatWrapping` tiling; `receiveShadow` propagated across terrain, the GLB/instanced-scatter pipeline, and all primitive-fallback builders (including a genuine dead-code fix that made the landmark primitive-fallback path reachable at all). No regressions to existing casters (player/remote/mob/NPC unchanged, confirmed via diff scope).

**Issues found**: None blocking. One minor documentation-process note: `STATE.md`'s Handoff section asserted "Verifier PASS" before this independent verification actually ran (see Code Quality section) — cosmetic/process only, does not affect this feature's correctness.

**Next steps**: None required. Feature is verified and ready to stay marked complete; optionally, the implementer could avoid pre-writing "Verifier PASS" claims in future Handoff notes until the Verifier sub-agent has actually returned a PASS.
