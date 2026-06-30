# Phase 29 — Audio & World Ambience Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its
Execute flow and Critical Rules.** This repo wraps it with `spec-driven-execution`
(Planner → Implementer → Verifier, **autonomous-first**); honor server-authority (AD-001)
and the three test layers (AD-010) — **no Playwright**, **no real audio in Vitest**.

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/phase-29-audio/design.md`
**Spec**: `.specs/features/phase-29-audio/spec.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from spec ACs, `AGENTS.md`, and `.specs/STATE.md` AD-009/010/014.
> Post-MVP gate: **no `client-e2e` / Playwright**; audio uses **mock backend only**.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Audio backend (mock + DOM factory) | unit | AUD29-01–08, AUD29-46 | `client/src/audio/audio-backend.spec.ts` | `nx test client` |
| Zone music / ambient pure maps | unit | AUD29-09–12, AUD29-16, AUD29-35–37 | `client/src/audio/zone-music.spec.ts` | `nx test client` |
| Audio settings persistence | unit | AUD29-33–34 | `client/src/audio/audio-settings.spec.ts` | `nx test client` |
| Audio manifest | unit | AUD29-44, AUD29-47 | `client/src/audio/audio-manifest.spec.ts` | `nx test client` |
| Audio manager (loops, SFX, ambient, steps) | unit | AUD29-13–14, AUD29-17–26, AUD29-38–41 | `client/src/audio/audio-manager.spec.ts` | `nx test client` |
| System menu volume UI | unit | AUD29-29–32 | `client/src/ui/system-menu.spec.ts` | `nx test client` |
| Window manager UI SFX | unit | AUD29-27–28 | `client/src/ui/window-manager.spec.ts` | `nx test client` |
| Test hook audio slice | unit | AUD29-42–43 | `client/src/test-hook.spec.ts` | `nx test client` |
| wireRoom audio sync | unit | AUD29-15 | `client/src/net/room-audio.spec.ts` | `nx test client` |
| Renderer footstep tick | unit | AUD29-45 | `client/src/scene/renderer.spec.ts` or `audio-manager.spec.ts` | `nx test client` |
| Static audio assets | build | AUD29-47 on-disk files | `client/public/audio/**` | `nx test client` + build |
| Full gate | gate | AUD29-48 | `nx run-many` | `nx run-many -t build lint test` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`client` audio) | Yes | Mock backend per test; `localStorage` cleared in `beforeEach` | New `*.spec.ts` pattern |
| Unit (`window-manager`, `system-menu`) | Yes | jsdom `document.body.innerHTML = ''` | Existing `system-menu.spec.ts` |
| wireRoom unit | Yes | Mock room + mock audio manager injection | `room-ui-shell.spec.ts` pattern |
| Build / manifest file check | Yes | Read-only filesystem | `audio-manifest.spec.ts` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (client) | After T1–T12 | `nx test client` |
| Quick (affected) | After integration tasks | `nx affected -t test lint` |
| Build | Phase completion (T14) | `nx run-many -t build lint test` |

**Speed contract:** No wall-clock sleeps in tests; footstep/throttle tests drive `nowMs`
explicitly (AD-014 spirit on client).

---

## Execution Plan

**5 phases** (14 tasks).

### Phase 1: Audio foundation — Sequential

```
T1 → T2 → T3
```

### Phase 2: Manager core — Sequential

```
T3 → T4 → T5
```

### Phase 3: Gameplay audio — Parallel OK

```
T5 ──┬→ T6 [P]  zone music + ambient
     ├→ T7 [P]  combat SFX sync
     └→ T8 [P]  footsteps tick
```

### Phase 4: UI + integration — Sequential

```
T8 → T9 → T10 → T11 → T12
```

### Phase 5: Assets + gate — Sequential

```
T12 → T13 → T14
```

---

## Task Breakdown

### T1: Audio backend interface + mock

**What**: `AudioBackend` type, `createMockAudioBackend`, `createDomAudioBackend` skeleton +
unit tests (AUD29-01–08, AUD29-46 spy).
**Where**: `client/src/audio/audio-backend.ts`, `audio-backend.spec.ts`
**Depends on**: None
**Reuses**: N/A
**Requirement**: AUD29-01 … AUD29-08, AUD29-46

**Done when**:

- [ ] Mock records loop/oneShot/stop/dispose calls with volumes
- [ ] CI test asserts zero `globalThis.Audio` construction when using mock
- [ ] Gate: `nx test client` (`audio-backend.spec.ts`)

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(audio): injectable audio backend with mock for tests`

---

### T2: Audio manifest + zone music pure maps

**What**: `AUDIO_MANIFEST`, `getAudioUrl`, `resolveZoneMusic`, `resolveZoneAmbient` + unit
tests (AUD29-09–12, AUD29-16, AUD29-35–37, AUD29-44).
**Where**: `client/src/audio/audio-manifest.ts`, `zone-music.ts`, `*.spec.ts`
**Depends on**: T1
**Requirement**: AUD29-09 … AUD29-12, AUD29-16, AUD29-35 … AUD29-37, AUD29-44

**Done when**:

- [ ] All manifest ids enumerated with `/audio/...` paths
- [ ] Zone map tests pass for village, fields, harbor, wilderness
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(audio): manifest and zone music mapping`

---

### T3: Audio settings persistence

**What**: `loadAudioSettings`, `saveAudioSettings`, defaults + localStorage tests
(AUD29-33–34).
**Where**: `client/src/audio/audio-settings.ts`, `audio-settings.spec.ts`
**Depends on**: T2
**Requirement**: AUD29-33, AUD29-34

**Done when**:

- [ ] Defaults `0.7 / 0.8 / false` when key missing
- [ ] Round-trip save/load tested
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(audio): persist volume settings in localStorage`

---

### T4: AudioManager core (loops, volumes, crossfade)

**What**: `createAudioManager` with `playLoop` idempotency, crossfade **1500 ms**, volume/
mute application, `dispose`, hook snapshot skeleton (AUD29-13–14, partial AUD29-42).
**Where**: `client/src/audio/audio-manager.ts`, `audio-manager.spec.ts`
**Depends on**: T3
**Reuses**: `audio-backend`, `audio-manifest`, `audio-settings`
**Requirement**: AUD29-13, AUD29-14, AUD29-42 (partial)

**Done when**:

- [ ] Zone change crossfade recorded on mock backend
- [ ] Duplicate `syncZone` does not restart loop
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(audio): audio manager loops and crossfade`

---

### T5: Audio triggers module

**What**: `audio-triggers.ts` re-exporting `vfx-triggers` + `shouldPlayFootstep` pure helper
with tests for distance/throttle/water guard (AUD29-40–41 helpers).
**Where**: `client/src/audio/audio-triggers.ts`, `audio-triggers.spec.ts`
**Depends on**: T4
**Reuses**: `client/src/scene/vfx/vfx-triggers.ts`
**Requirement**: AUD29-40, AUD29-41 (helpers)

**Done when**:

- [ ] Footstep helper respects 0.8 m and 350 ms
- [ ] Water zone type returns false
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(audio): shared combat triggers and footstep helper`

---

### T6: Zone music + ambient beds [P]

**What**: Wire `syncZone` to `resolveZoneMusic` + `resolveZoneAmbient`; single ambient;
ambient gain cap **0.35 × sfxVolume** (AUD29-35–39).
**Where**: `client/src/audio/audio-manager.ts` (extend), `audio-manager.spec.ts`
**Depends on**: T5
**Requirement**: AUD29-35 … AUD29-39

**Done when**:

- [ ] Village/harbor/field ambient ids play per zone
- [ ] Zone change stops prior ambient
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(audio): zone music and ambient loops`

---

### T7: Combat & gameplay SFX sync [P]

**What**: `syncPlayer`, `syncMob`, `syncCombat` with HP/action/level/soulshot/stinger logic
(AUD29-17–26); reuse `audio-triggers`.
**Where**: `client/src/audio/audio-manager.ts`, `audio-manager.spec.ts`
**Depends on**: T5
**Reuses**: `vfx-manager` snapshot shapes; `shouldSoulshotGlint` from soulshot vfx
**Requirement**: AUD29-17 … AUD29-26

**Done when**:

- [ ] Hit, swing, cast, level-up, stinger, soulshot, throttle tests pass
- [ ] NaN position guard passes
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(audio): combat and gameplay sfx triggers`

---

### T8: Footsteps tick [P]

**What**: `tickFootsteps` on manager; integrate call from renderer tick (AUD29-40–41,
AUD29-45).
**Where**: `client/src/audio/audio-manager.ts`, `client/src/scene/renderer.ts`,
`renderer.spec.ts` or manager spec
**Depends on**: T5
**Requirement**: AUD29-40, AUD29-41, AUD29-45

**Done when**:

- [ ] Footstep plays on distance threshold in unit test
- [ ] Renderer invokes tick hook (spy or callback test)
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(audio): footstep sfx on movement tick`

---

### T9: System menu volume controls

**What**: Extend `mountSystemMenu` with music/SFX sliders + mute; wire to
`audioManager.applySettings` + `saveAudioSettings` (AUD29-29–32).
**Where**: `client/src/ui/system-menu.ts`, `system-menu.spec.ts`, `main.ts`
**Depends on**: T8
**Requirement**: AUD29-29 … AUD29-32

**Done when**:

- [ ] DOM roles `music-volume`, `sfx-volume`, `audio-mute` present
- [ ] Slider change calls `setMusicVolume(0.5)` at 50%
- [ ] Menu click plays ui click on mock when manager injected
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(audio): system menu volume and mute controls`

---

### T10: Window manager UI SFX

**What**: Inject audio callbacks into `togglePanel` / open / close (AUD29-27–28).
**Where**: `client/src/ui/window-manager.ts`, `window-manager.spec.ts`, `main.ts`
**Depends on**: T9
**Requirement**: AUD29-27, AUD29-28

**Done when**:

- [ ] Open panel plays `sfx_ui_open`; close plays `sfx_ui_close`
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(audio): ui panel open and close sfx`

---

### T11: Test hook + wireRoom sync

**What**: `GameStateAudio` on `test-hook`; `publishAudio`; `wireRoom` calls
`syncZone`/`syncPlayer`/`syncCombat` on audio manager; `room-audio.spec.ts` (AUD29-15,
AUD29-42–43).
**Where**: `client/src/test-hook.ts`, `client/src/net/room.ts`, `room-audio.spec.ts`,
`test-hook.spec.ts`
**Depends on**: T10
**Reuses**: `room-ui-shell.spec.ts` wireRoom harness
**Requirement**: AUD29-15, AUD29-42, AUD29-43

**Done when**:

- [ ] `__GAME_STATE__.audio` populated after sync
- [ ] `inCombat` mirrors `targetMobId`
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(audio): wireRoom and test hook audio state`

---

### T12: Main boot + dispose wiring

**What**: Create manager after connect; load settings; autoplay unlock on first gesture;
`dispose` on logout/renderer teardown (edge cases in spec).
**Where**: `client/src/main.ts`, `client/src/scene/renderer.ts`
**Depends on**: T11
**Requirement**: AUD29-34 (runtime apply), logout edge case

**Done when**:

- [ ] Manager created once per session; disposed on logout
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(audio): boot and dispose lifecycle wiring`

---

### T13: CC0 audio assets on disk

**What**: Add minimal Ogg files for all manifest ids under `client/public/audio/`; manifest
spec verifies file existence (AUD29-47).
**Where**: `client/public/audio/**`, `audio-manifest.spec.ts`
**Depends on**: T12
**Requirement**: AUD29-47

**Done when**:

- [ ] Every `AUDIO_MANIFEST` id has corresponding file
- [ ] Gate: `nx test client`

**Tests**: unit + build | **Gate**: quick (client)

**Commit**: `feat(audio): add license-clean placeholder audio assets`

---

### T14: Full Nx gate

**What**: Run full monorepo gate; fix any lint/test regressions (AUD29-48).
**Where**: n/a
**Depends on**: T13
**Requirement**: AUD29-48

**Done when**:

- [ ] `nx run-many -t build lint test` passes
- [ ] No `HTMLAudioElement` in client test run without mock

**Tests**: gate | **Gate**: build

**Commit**: `chore(audio): phase 29 gate green`

---

## Parallel Execution Map

```
Phase 1:  T1 → T2 → T3
Phase 2:  T3 → T4 → T5
Phase 3:  T5 complete, then:
            ├── T6 [P]
            ├── T7 [P]
            └── T8 [P]
Phase 4:  T8 → T9 → T10 → T11 → T12
Phase 5:  T12 → T13 → T14
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Audio backend | 1 module + spec | ✅ Granular |
| T2: Manifest + zone maps | 2 pure modules | ✅ Granular |
| T3: Settings persistence | 1 module | ✅ Granular |
| T4: Manager core | 1 module (extend) | ✅ Granular |
| T5: Triggers | 1 module | ✅ Granular |
| T6: Zone/ambient | manager extension | ✅ Granular |
| T7: Combat SFX | manager extension | ✅ Granular |
| T8: Footsteps | manager + renderer hook | ✅ Granular |
| T9: System menu | UI extend | ✅ Granular |
| T10: Window manager SFX | UI extend | ✅ Granular |
| T11: wireRoom + hook | integration | ✅ Granular |
| T12: Boot lifecycle | main + renderer | ✅ Granular |
| T13: Assets | public files | ✅ Granular |
| T14: Gate | verification | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Phase 1 start | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T3 | Phase 2 T3 → T4 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T5 | Phase 3 parallel from T5 | ✅ Match |
| T7 | T5 | Phase 3 parallel from T5 | ✅ Match |
| T8 | T5 | Phase 3 parallel from T5 | ✅ Match |
| T9 | T8 | Phase 4 T8 → T9 | ✅ Match |
| T10 | T9 | T9 → T10 | ✅ Match |
| T11 | T10 | T10 → T11 | ✅ Match |
| T12 | T11 | T11 → T12 | ✅ Match |
| T13 | T12 | Phase 5 T12 → T13 | ✅ Match |
| T14 | T13 | T13 → T14 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Audio backend | unit | unit | ✅ OK |
| T2 | Manifest + zone pure | unit | unit | ✅ OK |
| T3 | Settings pure | unit | unit | ✅ OK |
| T4 | Audio manager core | unit | unit | ✅ OK |
| T5 | Audio triggers | unit | unit | ✅ OK |
| T6 | Zone/ambient manager | unit | unit | ✅ OK |
| T7 | Combat SFX manager | unit | unit | ✅ OK |
| T8 | Footsteps + renderer | unit | unit | ✅ OK |
| T9 | System menu UI | unit | unit | ✅ OK |
| T10 | Window manager UI | unit | unit | ✅ OK |
| T11 | wireRoom + test-hook | unit | unit | ✅ OK |
| T12 | Boot wiring | unit | unit | ✅ OK |
| T13 | Static assets + manifest | unit + build | unit + build | ✅ OK |
| T14 | Full gate | gate | gate | ✅ OK |

---

## Requirement → Task Traceability

| Requirement IDs | Task(s) |
| --------------- | ------- |
| AUD29-01 … 08, 46 | T1 |
| AUD29-09 … 12, 16, 35 … 37, 44 | T2 |
| AUD29-33 … 34 | T3 |
| AUD29-13 … 14, 42 (partial) | T4 |
| AUD29-40 … 41 (helpers) | T5 |
| AUD29-35 … 39 | T6 |
| AUD29-17 … 26 | T7 |
| AUD29-40 … 41, 45 | T8 |
| AUD29-29 … 32 | T9 |
| AUD29-27 … 28 | T10 |
| AUD29-15, 42 … 43 | T11 |
| AUD29-34 (runtime), logout edge | T12 |
| AUD29-47 | T13 |
| AUD29-48 | T14 |

**Coverage:** 48 ACs → 14 tasks, 0 unmapped ✅
