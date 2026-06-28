# Player Character — Procedural Humanoid Rig & Action Animation Specification

## Problem Statement

The MVP is feature-complete but visually unfinished: the local player is a single
static blue capsule (`client/src/scene/renderer.ts:156`) with no articulation,
no facing, and no animation. This feature builds the first **professional,
procedural, animated character** — an articulated low-poly humanoid driven by the
player's real in-game actions — and establishes the reusable rig + animation
foundation that every future creature (NPCs, mobs) will adopt.

## Goals

- [ ] Replace the local player capsule with an articulated, segmented low-poly
      humanoid built entirely from Three.js primitives (no model files; AD-005).
- [ ] Animate the local player from its real actions — `idle`, `move`, `attack`,
      `cast`, `die` — extracted from the existing game wiring.
- [ ] Drive action animations from a **server-replicated, render-only** action
      signal so the system is server-authoritative-correct (AD-001) and
      generalizes unchanged to remote players and mobs later.
- [ ] Establish a reusable **named-socket rig contract** + a **pure animation
      state machine** (in `game-core`) as the foundation of the asset pipeline.
- [ ] Keep the test gate fast and high-confidence within AGENTS.md/AD-009:
      deterministic unit tests + Playwright assertions on an extended
      `__GAME_STATE__`, never pixel anchoring.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Remote player avatars / NPC / mob rendering | Slice is **local player only** (user decision). The rig, state machine, and server signal are designed to extend to them, but rendering them is a fast-follow phase. |
| Skeletal/skinned meshes, GLTF/FBX, bone weights, IK, ragdoll | Violates AD-005 (procedural primitives only); articulation is achieved by rotating parented primitive joints. |
| Animation blend trees / cross-fade blending | MVP uses single-clip selection with precedence; blending is a later polish phase. |
| Weapon/armor visual variety | A single weapon stub keyed to `equippedWeaponItemId > 0` is allowed; full equipment visuals are deferred. |
| Creature manifest for non-player entities | The builder is parameterized to be manifest-driven later, but the manifest registry itself is out of this slice. |
| Server-authored action durations (data-driven timing) | MVP uses per-action client-side duration constants; wiring durations from `attack-timing`/skill stats is a refinement. |
| New movement speeds (walk vs run distinction) | Single locomotion speed exists today → one `move` clip. |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here — nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Animation signal architecture | Render-only replicated `action` enum + `actionSeq` on entity schema; server sets it, client animates | User-selected; server-authoritative-correct, generalizes to mobs | y |
| Slice scope | Local player only | User-selected | y |
| Rig fidelity | Segmented articulated humanoid (torso, head, 2 arms, 2 legs) on named sockets, joint-rotation animation | User-selected; "great & professional" within AD-005 | y |
| Test strategy | Vitest unit (builder + pure state machine) + Playwright via extended `__GAME_STATE__`; screenshots offline-only | User-selected; honors AD-009 (never pixels) | y |
| Facing / orientation | Derived client-side from movement direction (velocity vector); snap-to-target yaw while `attack`/`cast` | Server replicates no rotation; facing is cosmetic/render-only (AD-001) | y (default) |
| Action durations (client) | `attack` 600 ms, `cast` 800 ms, `die` 1200 ms | Readable, professional pacing; server-timed durations deferred | y (default) |
| Locomotion detection | `move` when local player position delta magnitude > `0.02` m over a frame, else `idle` (hysteresis to avoid flicker) | Position is the only replicated locomotion signal | y (default) |
| `action` / `actionSeq` persistence | NOT persisted to DB; transient render-only, defaults to `NONE`/`0` on load & reconnect | Render-only signal must not corrupt saved character state (CHAR-12) | y (default) |
| `die` clip behavior given instant server respawn | `die` clip plays for its full duration client-side (triggered by the signal) even though the server teleports + restores HP the same tick; clip then returns to `idle` at town spawn | Server death is instantaneous (`TownRoom.ts:574`); the signal is the only death evidence | y (default) |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Articulated Humanoid Avatar ⭐ MVP

**User Story**: As a player, I want my character to look like an articulated
person instead of a capsule, so the game feels real and professional.

**Why P1**: The whole feature exists to replace the placeholder; the rig is the
foundation everything else binds to.

**Acceptance Criteria**:

1. WHEN the local player avatar is built THEN the system SHALL construct a single
   `THREE.Group` composed of distinct primitive segments — torso, head, left arm,
   right arm, left leg, right leg — and no `CapsuleGeometry` placeholder for the
   local player remains in the scene.
2. WHEN the avatar is built THEN the system SHALL expose a named-socket map
   satisfying the rig contract — at minimum `root`, `spine`, `head`, `handL`,
   `handR`, `footL`, `footR` — each a `THREE.Object3D` present in the group.
3. WHEN the avatar is built THEN its axis-aligned bounding box height SHALL be
   within `1.6 m – 2.0 m` and its feet (bbox min y) SHALL rest at `y ≈ 0`
   (|min y| ≤ 0.05) in local rig space, so it stands on the ground.
4. WHEN built THEN left/right socket pairs (`handL`/`handR`, `footL`/`footR`)
   SHALL be mirror-symmetric across the x-axis (|x_L + x_R| ≤ 0.01).

**Independent Test**: Unit-build the avatar in Vitest, assert segment meshes,
socket presence/positions, bbox bounds, and symmetry.

---

### P1: Locomotion & Facing ⭐ MVP

**User Story**: As a player, I want my character to walk and face where it's going
so movement reads naturally.

**Why P1**: Locomotion is the default, always-visible animation.

**Acceptance Criteria**:

1. WHEN the local player's position is unchanged between frames (delta magnitude
   ≤ `0.02` m) THEN the state machine SHALL select the `idle` clip.
2. WHEN the local player's position changes (delta magnitude > `0.02` m) and no
   higher-precedence action is active THEN the state machine SHALL select the
   `move` clip.
3. WHEN the local player is moving THEN the avatar's yaw SHALL face the movement
   direction (within ±5° of `atan2(dx, dz)` after the facing update).
4. WHEN an `attack` or `cast` action is active and a combat target exists THEN the
   avatar yaw SHALL face the target's position instead of the movement direction.
5. WHEN the `idle` or `move` clip advances by time `t` THEN the produced pose
   SHALL be deterministic — identical `t` and parameters yield identical socket
   transforms (no `Math.random`).

**Independent Test**: Unit-test the locomotion derivation (position deltas →
`idle`/`move`), facing yaw from a velocity vector, and pose determinism.

---

### P1: Server Action Signal (render-only) ⭐ MVP

**User Story**: As the system, I want the server to tell clients *what action an
entity just performed*, so animation is correct and authoritative without the
client guessing.

**Why P1**: Death is instantaneous server-side and remote/mob actions are
unobservable from position/HP alone; the signal is the only correct source.

**Acceptance Criteria**:

1. WHEN `PlayerState` is defined THEN it SHALL include render-only fields
   `action` (uint8 enum: `NONE=0, ATTACK=1, CAST=2, DIE=3`) and `actionSeq`
   (uint16, wraps), both defaulting to `NONE`/`0`.
2. WHEN the server resolves a player's melee attack against a target THEN it
   SHALL set that player's `action = ATTACK` and increment `actionSeq` by 1.
3. WHEN the server resolves a player's Power Strike (skill) THEN it SHALL set
   `action = CAST` and increment `actionSeq` by 1.
4. WHEN the server handles a player's death THEN it SHALL set `action = DIE` and
   increment `actionSeq` by 1 **before** the same-tick respawn restores position
   and HP.
5. WHEN the same action kind fires twice in succession THEN `actionSeq` SHALL
   differ between the two firings (so the client retriggers the clip).
6. WHEN a character is persisted or loaded THEN `action` and `actionSeq` SHALL be
   ignored by persistence (never written to or read from the DB), and a freshly
   loaded/reconnected player SHALL have `action = NONE`, `actionSeq = 0`.

**Independent Test**: Room-integration tests (`@colyseus/testing`) assert the
player's `action`/`actionSeq` after attack/skill/death; a persistence round-trip
test asserts the fields are not saved.

---

### P1: Action Animation State Machine ⭐ MVP

**User Story**: As a player, I want my character to swing, cast, and fall when I
do those things, so combat feels alive.

**Why P1**: This is the payoff — actions become motion.

**Acceptance Criteria**:

1. WHEN inputs `{ action, actionSeq, locomotion, nowMs }` are provided THEN the
   pure state machine SHALL return `{ clip, phase }` where `clip ∈ {idle, move,
   attack, cast, die}` and `phase ∈ [0,1]`.
2. WHEN `actionSeq` increases THEN the state machine SHALL start the transient
   clip for the new `action` (`ATTACK→attack`, `CAST→cast`, `DIE→die`) at
   `phase=0`, regardless of locomotion.
3. WHEN a transient clip is active and `(nowMs − startMs) < duration[action]`
   THEN the state machine SHALL keep returning that clip; the precedence order
   SHALL be `die > cast > attack > move > idle`.
4. WHEN a transient clip's elapsed time reaches its duration THEN the state
   machine SHALL fall back to `move` or `idle` per the current locomotion (except
   `die`, which remains until the next `actionSeq` change / respawn).
5. WHEN `actionSeq` does not change across calls THEN a stale `action` value
   SHALL NOT retrigger a finished clip (edge: reconnect keeps `actionSeq=0`).

**Independent Test**: Unit-test the state machine across all transitions,
precedence pairs, seq-retrigger, duration expiry, and the stale-action edge.

---

### P1: Test Observability ⭐ MVP

**User Story**: As the test suite, I want to read the player's current animation
clip from `__GAME_STATE__`, so Playwright can assert behavior without pixels.

**Why P1**: Required to satisfy AD-009 + the layered validation strategy.

**Acceptance Criteria**:

1. WHEN the avatar's animation updates THEN `window.__GAME_STATE__.player.action`
   SHALL hold the current clip name (`'idle' | 'move' | 'attack' | 'cast' |
   'die'`).
2. WHEN `__sendMoveIntent__` causes the player to move THEN
   `__GAME_STATE__.player.action` SHALL become `'move'`, and return to `'idle'`
   after arrival.
3. WHEN `__attack__` fires and the server confirms the attack THEN
   `__GAME_STATE__.player.action` SHALL become `'attack'` within the action
   duration window.
4. WHEN `__useSkill__` fires and the server confirms the skill THEN
   `__GAME_STATE__.player.action` SHALL become `'cast'`.

**Independent Test**: Playwright e2e drives the existing hooks and polls
`__GAME_STATE__.player.action` through `idle → move → attack → cast`.

---

### P3: Hit Reaction

**User Story**: As a player, I want a brief flinch when I take damage, for feedback.

**Why P3**: Nice-to-have polish; not required for the foundation.

**Acceptance Criteria**:

1. WHEN the local player's HP decreases (and no higher-precedence transient clip
   is active) THEN the avatar SHALL play a brief hit-react overlay (≤ 200 ms)
   without changing the selected base clip.

---

## Edge Cases

- WHEN an `attack` fires while the player is moving THEN `attack` SHALL take
  precedence for its duration, then locomotion resumes (CHAR-09/10).
- WHEN the player dies while moving THEN `die` SHALL take precedence and remain
  until respawn returns locomotion to `idle` (CHAR-08/09).
- WHEN two actions fire within the same frame THEN only the latest `actionSeq`
  drives the clip (highest-precedence resolution; CHAR-09).
- WHEN frame `dt` is large (tab refocus, dt clamped to 0.05 s in
  `startRenderLoop`) THEN clip phase SHALL advance by real elapsed wall-time
  (action timing uses `nowMs`, not accumulated `dt`) so a long stall does not
  desync a transient clip.
- WHEN the player reconnects THEN `action=NONE`/`actionSeq=0` SHALL yield `idle`
  with no spurious replay (CHAR-05.6 / CHAR-09.5).
- WHEN locomotion hovers around the `0.02` m threshold THEN hysteresis SHALL
  prevent idle/move flicker.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| CHAR-01 | P1 Avatar | Design | Pending |
| CHAR-02 | P1 Avatar | Design | Pending |
| CHAR-03 | P1 Locomotion | Design | Pending |
| CHAR-04 | P1 Locomotion | Design | Pending |
| CHAR-05 | P1 Action Signal | Design | Pending |
| CHAR-06 | P1 Action Signal | Design | Pending |
| CHAR-07 | P1 Action Signal | Design | Pending |
| CHAR-08 | P1 Action Signal | Design | Pending |
| CHAR-09 | P1 State Machine | Design | Pending |
| CHAR-10 | P1 State Machine | Design | Pending |
| CHAR-11 | P1 Observability | Design | Pending |
| CHAR-12 | P1 Action Signal | Design | Pending |
| CHAR-13 | P3 Hit Reaction | - | Pending |

**ID format:** `CHAR-[NUMBER]`
**Status values:** Pending → In Design → In Tasks → Implementing → Verified
**Coverage:** 13 total (12 P1, 1 P3); mapping to tasks produced in `tasks.md`.

---

## Success Criteria

- [ ] The local player renders as an articulated humanoid (no capsule) and stands
      on the ground facing its travel direction.
- [ ] `idle`, `move`, `attack`, `cast`, `die` all play, driven by real actions via
      the server signal.
- [ ] Server authority (AD-001) preserved: the action signal is render-only and
      never alters HP/XP/position/combat outcomes; not persisted.
- [ ] Gate green and fast: `nx test game-core`, `nx test server`, `nx test client`
      all pass; `nx e2e client-e2e` asserts the action transitions via
      `__GAME_STATE__`; no pixel assertions added (AD-009).
- [ ] The rig contract + state machine are reusable as-is for the next
      (humanoid NPC / mob) phase with no rewrite.
