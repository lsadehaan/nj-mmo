# Phase 29 — Audio & World Ambience Specification

## Problem Statement

Phases 13–28 delivered readable combat VFX and a full DOM UI shell, but the client is
**silent**. Zone identity from Phase 23 (`ti_village`, `eastern_fields`, `harbor`, …) and
combat signals already replicated on `PlayerState` / `MobState` are unused for sound.
Phase 28 deferred functional volume controls to this phase (system menu has no audio
sliders today).

Players need zone-appropriate music loops, combat/cast/UI feedback SFX, and light world
ambience — **client-render only** (AD-001), wired to the same authoritative deltas as
`vfx-manager` (AD-015). Tests must **mock** the audio backend so Vitest never loads or
plays real audio in CI (AD-009, AD-010).

## Goals

- [ ] **Zone music**: looping tracks for village, field/combat regions, and harbor; smooth
      crossfade on `zoneId` change (Phase 23 registry).
- [ ] **Combat / gameplay SFX**: melee hit, swing, skill cast, level-up, combat enter
      stinger — triggered from the same pure edge detectors as VFX (`vfx-triggers.ts`).
- [ ] **UI SFX**: panel open/close and menu click sounds via window manager + system menu.
- [ ] **World ambience**: low-volume ambient loops (village, harbor waves, field wind).
- [ ] **Volume settings**: functional music/SFX sliders + mute in system menu; persisted in
      `localStorage`.
- [ ] **Test hook**: `__GAME_STATE__.audio` observability; client unit tests use injected
      `MockAudioBackend` only.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Server audio schema / network messages | Render-only client phase (AD-001); same boundary as Phase 13 VFX |
| Voice acting / NPC barks | ROADMAP post-TI |
| Dynamic adaptive music (intensity layers, stem mixing) | MVP loops + one-shot stinger sufficient |
| Proprietary L2 `.uax` / extracted client sounds | AD-004 |
| 3D positional audio / HRTF | Stereo pan MVP; footstep volume constant |
| Playwright / `client-e2e` | Post-MVP gate (AD-010) |
| WebGL / pixel assertions | AD-009 |
| Full options panel (separate from system menu) | Phase 28 scoped system menu only |
| Music during login / character select | World audio starts after `wireRoom` connects |
| Room-integration tests for audio | No server authority; client unit + `wireRoom` unit only |

---

## Assumptions & Open Questions

Autonomous Planner decisions (no user gate).

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| AC prefix | **AUD29-NN** | Matches `UI28-NN`, `TIW23-NN` | y |
| Audio API | Injectable **`AudioBackend`**; production = `HTMLAudioElement` wrappers; tests = **`MockAudioBackend`** recording calls | Mirrors VFX testability; no new npm deps (AD-007) | y |
| Module layout | `client/src/audio/` — `audio-backend.ts`, `audio-manager.ts`, `audio-manifest.ts`, `zone-music.ts`, `audio-settings.ts`, `audio-triggers.ts` | Parallel `scene/vfx/` structure | y |
| Asset location | `client/public/audio/music/*.ogg`, `client/public/audio/sfx/*.ogg`, `client/public/audio/ambient/*.ogg` | Vite static serve; Ogg Vorbis for size | y |
| Asset license | **CC0** placeholders (Kenney / OpenGameArt-style); committed minimal loops (≥3 s music, ≤1 s SFX) | AD-004 license-clean | y |
| Zone → music map | `ti_village` → `music_town`; `harbor` + `harbor_water` → `music_harbor`; all other named combat/wilderness zones → `music_field` | ROADMAP town/field/harbor; fishing/water share harbor shore mood | y |
| Crossfade | **1500 ms** linear gain ramp; old loop stops after fade | Avoid hard cuts on zone polygon boundaries | y |
| Combat stinger | One-shot `sfx_combat_stinger` when `targetMobId` transitions **null → non-null** | ROADMAP “combat stingers”; no separate combat music loop | y |
| Combat stinger dedupe | Stinger SHALL NOT replay until `targetMobId` returns to null | Prevents spam while retargeting same mob | y |
| Melee hit SFX | `sfx_melee_hit` on `detectHpHit` for mob **or** player victim | Same trigger as `melee-hit-vfx` | y |
| Melee swing SFX | `sfx_melee_swing` on local `player.action` **attack** `actionSeq` bump | Audible wind-up; distinct from impact | y |
| Skill cast SFX | `sfx_skill_cast` on local `player.action` **cast** `actionSeq` bump | Power Strike + mystic casts | y |
| Level-up SFX | `sfx_level_up` on `detectLevelUp` | Matches `level-up-vfx` trigger | y |
| Soulshot SFX (P3) | `sfx_soulshot` when `soulshotCount > 0` and attack/cast edge (same rule as soulshot glint VFX) | Phase 13 optional parity | y |
| SFX throttle | Same `sfx_melee_hit` suppressed if last play &lt; **80 ms** ago | Pool analogue to VFX melee pool | y |
| UI open/close | `sfx_ui_open` on panel open; `sfx_ui_close` on panel close via `window-manager` | Phase 28 central hotkey router | y |
| UI click | `sfx_ui_click` on system-menu `[data-action]` button press | Classic menu feedback | y |
| Ambient loops | `ambient_village` in `ti_village`; `ambient_waves` in harbor zones; `ambient_wind` in `eastern_fields` + `elven_ruins` + `obelisk` + `cave_of_souls` | ROADMAP world ambience; one ambient at a time | y |
| Ambient gain | **0.35 × sfxVolume × master** (quieter than music) | Bed under music | y |
| Footsteps | `sfx_footstep` when planar move ≥ **0.8 m** since last step and `zone.type !== 'water'`; min interval **350 ms** | ROADMAP footsteps; no swim audio | y |
| Volume storage | `localStorage` key `nj.audioSettings` → `{ musicVolume, sfxVolume, muted }` defaults **0.7 / 0.8 / false** | Phase 28 local-only account model | y |
| Master mute | `muted: true` forces effective gain **0** on all channels; sliders retain values | Standard UX | y |
| Test hook shape | `audio: { currentMusicId, ambientId, sfxCounts, musicVolume, sfxVolume, muted, inCombat }` | AD-009; `sfxCounts` keyed by manifest id | y |
| CI safety | Unit tests **never** call `new Audio()` — inject mock via `createAudioManager({ backend })` | Vitest/jsdom has no decode path | y |
| Implicit: auth / rate limits | N/A — cosmetic client | — | N/A |
| Implicit: concurrency | Audio manager single-threaded on main loop (same as VFX) | — | N/A |
| Implicit: external deps | Missing asset file → `console.warn` once; no throw; mock tests skip fetch | Graceful degrade in dev | y |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Audio backend & manager foundation ⭐ MVP

**User Story**: As a developer, I want an injectable audio backend and manager so gameplay
code can request loops/one-shots without coupling to DOM audio or CI.

**Acceptance Criteria**:

1. **AUD29-01**: WHEN `createAudioManager({ backend: mock })` is called THEN it SHALL
   return an object with `playLoop`, `playOneShot`, `stopLoop`, `setMusicVolume`,
   `setSfxVolume`, `setMuted`, `dispose`.
   **Test layer: client unit** (`audio-manager.spec.ts`)
2. **AUD29-02**: WHEN `playOneShot('sfx_ui_click')` is called THEN `MockAudioBackend`
   SHALL record `{ kind: 'oneShot', id: 'sfx_ui_click', volume }` exactly once.
   **Test layer: client unit**
3. **AUD29-03**: WHEN `playLoop('music_town')` is called twice without stop THEN backend
   SHALL receive only **one** `loop` start for that id (idempotent).
   **Test layer: client unit**
4. **AUD29-04**: WHEN `stopLoop('music_town')` after `playLoop` THEN backend SHALL record
   `stop` for that id.
   **Test layer: client unit**
5. **AUD29-05**: WHEN `setMusicVolume(0.5)` THEN next `playLoop` call SHALL pass
   `volume` within **0.01** of `0.5` (before master/mute).
   **Test layer: client unit**
6. **AUD29-06**: WHEN `setSfxVolume(0.25)` THEN next `playOneShot` SHALL pass `volume`
   within **0.01** of `0.25`.
   **Test layer: client unit**
7. **AUD29-07**: WHEN `setMuted(true)` THEN `playLoop` and `playOneShot` SHALL pass
   effective volume **0** regardless of channel sliders.
   **Test layer: client unit**
8. **AUD29-08**: WHEN `dispose()` THEN all active loops SHALL be stopped and backend
   `dispose` SHALL be called.
   **Test layer: client unit**

**Independent Test**: Instantiate manager with mock; assert call log for loop/one-shot/mute.

---

### P2: Zone music loops ⭐ MVP

**User Story**: As a player walking Talking Island, I hear music that matches the named zone
I am in, crossfading smoothly at boundaries.

**Acceptance Criteria**:

9. **AUD29-09**: WHEN `resolveZoneMusic('ti_village')` THEN result SHALL be `music_town`.
   **Test layer: client unit** (`zone-music.spec.ts`)
10. **AUD29-10**: WHEN `resolveZoneMusic('eastern_fields')` THEN result SHALL be
    `music_field`.
    **Test layer: client unit**
11. **AUD29-11**: WHEN `resolveZoneMusic('harbor')` THEN result SHALL be `music_harbor`.
    **Test layer: client unit**
12. **AUD29-12**: WHEN `resolveZoneMusic('harbor_water')` THEN result SHALL be
    `music_harbor`.
    **Test layer: client unit**
13. **AUD29-13**: WHEN `syncZone` changes from `ti_village` to `eastern_fields` THEN
    manager SHALL `playLoop('music_field')` and begin crossfade from `music_town` over
    **1500 ms** (backend records fade on previous loop).
    **Test layer: client unit**
14. **AUD29-14**: WHEN `syncZone` is called twice with the same `zoneId` THEN music track
    SHALL NOT restart (no duplicate `playLoop` for current id).
    **Test layer: client unit**
15. **AUD29-15**: WHEN `wireRoom` updates player position and `__GAME_STATE__.zone.id`
    changes THEN `audioManager.syncZone(newZoneId)` SHALL be invoked.
    **Test layer: client unit** (`room-audio.spec.ts`)
16. **AUD29-16**: WHEN `resolveZoneMusic('wilderness')` THEN result SHALL be `music_field`.
    **Test layer: client unit**

---

### P3: Combat & gameplay SFX ⭐ MVP

**User Story**: As a player fighting mobs, I hear impacts, swings, casts, and level-ups
aligned with server-replicated state — not client guesses.

**Acceptance Criteria**:

17. **AUD29-17**: WHEN mob `hp` decreases per `detectHpHit` THEN `sfx_melee_hit` SHALL
    play once.
    **Test layer: client unit** (`audio-manager.spec.ts`)
18. **AUD29-18**: WHEN local player `hp` decreases per `detectHpHit` THEN `sfx_melee_hit`
    SHALL play once.
    **Test layer: client unit**
19. **AUD29-19**: WHEN local player `action` becomes **cast** on `actionSeq` bump THEN
    `sfx_skill_cast` SHALL play once.
    **Test layer: client unit**
20. **AUD29-20**: WHEN local player `action` becomes **attack** on `actionSeq` bump THEN
    `sfx_melee_swing` SHALL play once.
    **Test layer: client unit**
21. **AUD29-21**: WHEN `player.level` strictly increases THEN `sfx_level_up` SHALL play
    once per level gained (`countLevelUps`).
    **Test layer: client unit**
22. **AUD29-22**: WHEN `targetMobId` transitions from `null` to a mob id THEN
    `sfx_combat_stinger` SHALL play once.
    **Test layer: client unit**
23. **AUD29-23**: WHEN `targetMobId` changes from mob A to mob B without clearing THEN
    combat stinger SHALL NOT replay.
    **Test layer: client unit**
24. **AUD29-24**: WHEN two `sfx_melee_hit` triggers occur within **80 ms** THEN only the
    first SHALL reach the backend.
    **Test layer: client unit**
25. **AUD29-25**: WHEN player position contains `NaN` THEN combat SFX handlers SHALL NOT
    play audio.
    **Test layer: client unit**
26. **AUD29-26**: WHEN `soulshotCount > 0` and attack/cast `actionSeq` bump THEN
    `sfx_soulshot` SHALL play in addition to swing/cast SFX.
    **Test layer: client unit**

---

### P4: UI SFX & volume settings ⭐ MVP

**User Story**: As a player, I adjust music/SFX levels in the system menu and hear subtle
feedback when opening panels.

**Acceptance Criteria**:

27. **AUD29-27**: WHEN `togglePanel` opens a registered panel THEN `sfx_ui_open` SHALL play.
    **Test layer: client unit** (`window-manager.spec.ts`)
28. **AUD29-28**: WHEN `togglePanel` closes a panel THEN `sfx_ui_close` SHALL play.
    **Test layer: client unit**
29. **AUD29-29**: WHEN a system-menu `[data-action]` button is clicked THEN `sfx_ui_click`
    SHALL play before the handler runs.
    **Test layer: client unit** (`system-menu.spec.ts`)
30. **AUD29-30**: WHEN system menu is mounted THEN `[data-role="music-volume"]` range input
    SHALL exist (0–100).
    **Test layer: client unit**
31. **AUD29-31**: WHEN music volume slider changes to **50** THEN `setMusicVolume` SHALL
    be called with **0.5** ± **0.01**.
    **Test layer: client unit**
32. **AUD29-32**: WHEN system menu is mounted THEN `[data-role="sfx-volume"]` and
    `[data-role="audio-mute"]` SHALL exist.
    **Test layer: client unit**
33. **AUD29-33**: WHEN volume/mute changes THEN `localStorage['nj.audioSettings']` SHALL
    persist JSON `{ musicVolume, sfxVolume, muted }`.
    **Test layer: client unit** (`audio-settings.spec.ts`)
34. **AUD29-34**: WHEN `loadAudioSettings()` on cold start THEN defaults SHALL be
    `musicVolume=0.7`, `sfxVolume=0.8`, `muted=false` if key absent.
    **Test layer: client unit**

---

### P5: Ambient world audio & footsteps

**User Story**: As an explorer, I hear quiet environmental beds (village, wind, waves) and
footsteps while moving on dry land.

**Acceptance Criteria**:

35. **AUD29-35**: WHEN zone is `ti_village` THEN ambient loop `ambient_village` SHALL play.
    **Test layer: client unit**
36. **AUD29-36**: WHEN zone is `harbor` or `harbor_water` THEN `ambient_waves` SHALL play.
    **Test layer: client unit**
37. **AUD29-37**: WHEN zone is `eastern_fields`, `elven_ruins`, `obelisk`, or
    `cave_of_souls` THEN `ambient_wind` SHALL play.
    **Test layer: client unit**
38. **AUD29-38**: WHEN zone changes THEN previous ambient loop SHALL stop before starting
    the new one (at most one ambient id active).
    **Test layer: client unit**
39. **AUD29-39**: WHEN ambient plays THEN effective volume SHALL be ≤ **0.35 × sfxVolume**
    (after mute).
    **Test layer: client unit**
40. **AUD29-40**: WHEN planar distance since last footstep ≥ **0.8 m** and zone type is not
    `water` THEN `sfx_footstep` SHALL play.
    **Test layer: client unit**
41. **AUD29-41**: WHEN two footstep distances qualify within **350 ms** THEN only one
    `sfx_footstep` SHALL play.
    **Test layer: client unit**

---

### P6: Integration, manifest & gate ⭐ MVP

**User Story**: As a tester, I observe audio state on `__GAME_STATE__` and the Nx gate stays
green without real playback.

**Acceptance Criteria**:

42. **AUD29-42**: WHEN audio manager publishes hook THEN `__GAME_STATE__.audio` SHALL
    include `{ currentMusicId, ambientId, sfxCounts, musicVolume, sfxVolume, muted,
    inCombat }`.
    **Test layer: client unit** (`test-hook.spec.ts`)
43. **AUD29-43**: WHEN `inCombat` THEN `targetMobId !== null` in game state mirror.
    **Test layer: client unit**
44. **AUD29-44**: `audio-manifest.ts` SHALL define stable ids for all music, sfx, and
    ambient entries with `public` URL paths under `/audio/`.
    **Test layer: client unit** (`audio-manifest.spec.ts`)
45. **AUD29-45**: WHEN renderer `tick` runs with movement THEN `audioManager.tickFootsteps`
    SHALL be invoked with player position delta.
    **Test layer: client unit** (`renderer.spec.ts` or manager unit)
46. **AUD29-46**: WHEN client unit tests run in CI THEN **zero** `HTMLAudioElement` or
    `Audio` constructors SHALL be invoked (mock-only).
    **Test layer: client unit** (spy in `audio-backend.spec.ts`)
47. **AUD29-47**: Committed assets SHALL exist for every manifest id (file on disk under
    `client/public/audio/`).
    **Test layer: build gate** (manifest spec + manual manifest list)
48. **AUD29-48**: WHEN `nx run-many -t build lint test` completes THEN all projects SHALL
    pass.
    **Test layer: gate**

---

## Edge Cases

- WHEN asset URL fails to load in browser THEN manager SHALL log once and skip that id;
  other sounds continue.
- WHEN `dispose()` during active crossfade THEN all gains SHALL go to 0 without throw.
- WHEN `muted` toggles on THEN playing loops SHALL continue but at gain 0 (resume on unmute).
- WHEN player is in `water` zone THEN footsteps SHALL NOT play (movement may still occur at
  shore edge — use `getZoneAt` type, not music id).
- WHEN logout / room leave THEN `audioManager.dispose()` SHALL run and music SHALL stop.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| AUD29-01 … 08 | P1: Backend & manager | Design | Pending |
| AUD29-09 … 16 | P2: Zone music | Design | Pending |
| AUD29-17 … 26 | P3: Combat SFX | Design | Pending |
| AUD29-27 … 34 | P4: UI & settings | Design | Pending |
| AUD29-35 … 41 | P5: Ambient & steps | Design | Pending |
| AUD29-42 … 48 | P6: Integration & gate | Design | Pending |

**Coverage:** 48 total, 48 mapped to tasks (`tasks.md` T1–T14), 0 unmapped ✅

---

## Success Criteria

- [ ] Walking village → fields → harbor crossfades music and ambient without glitches.
- [ ] Melee combat plays hit + swing SFX in sync with VFX counters (same tick order).
- [ ] System menu sliders persist across refresh; mute silences all channels.
- [ ] `nx test client` passes with mock backend only; no audio decode in CI.
- [ ] `nx run-many -t build lint test` green after implementation.
