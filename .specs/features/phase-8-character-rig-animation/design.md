# Player Character — Procedural Humanoid Rig & Action Animation Design

**Spec**: `.specs/features/phase-8-character-rig-animation/spec.md`
**Status**: Draft

---

## Architecture Overview

The feature splits cleanly into three layers, mirroring the project's existing
layering (pure `game-core` ⟶ authoritative `server` ⟶ render-only `client`):

1. **Shared pure logic (`libs/game-core`)** — the `EntityAction` enum + a pure
   **animation state machine** (`f(action, actionSeq, locomotion, nowMs) →
   {clip, phase}`). No Three.js, no Colyseus; deterministic and unit-tested. This
   is the reusable brain for every creature.
2. **Server (`server`)** — `PlayerState` gains render-only `action` + `actionSeq`;
   `TownRoom` sets them when the existing combat/skill/death paths resolve. The
   server remains the authority on *what happened* (AD-001); it says nothing about
   *how* it looks.
3. **Client (`client`)** — a procedural **segmented humanoid rig** (primitives +
   named sockets), **procedural clip functions** that pose the rig, and an
   **animator** that drives the state-machine's chosen clip each frame. A
   `player-avatar` module replaces the inline capsule in `renderer.ts` and derives
   locomotion + facing from replicated position. `__GAME_STATE__` exposes the
   current clip.

```mermaid
graph TD
    subgraph game-core (pure)
      EA[EntityAction enum + durations]
      SM[animation state machine\nf -> clip, phase]
    end
    subgraph server (authoritative)
      PS[PlayerState +action +actionSeq]
      TR[TownRoom: set on attack/skill/death]
    end
    subgraph client (render-only)
      RIG[buildHumanoid -> group + sockets]
      CLIPS[clip fns: idle/move/attack/cast/die]
      ANIM[animator.update dt]
      AV[player-avatar: locomotion + facing]
      HOOK[__GAME_STATE__.player.action]
    end
    TR --> PS
    PS -- replicate action/seq --> ROOM[room.ts syncLocal]
    ROOM --> AV
    EA --> SM
    SM --> ANIM
    RIG --> ANIM
    CLIPS --> ANIM
    ANIM --> AV
    AV --> HOOK
    AV -- replaces capsule --> RENDER[renderer.ts]
```

---

## Approach Exploration (Large/Complex)

All three approaches deliver the same scoped thing (animated articulated local
player). They differ in **where the animation brain lives**.

| Approach | Brain location | Pros | Cons | |
| -------- | -------------- | ---- | ---- | - |
| **A — Pure state machine in `game-core` (RECOMMENDED)** | `libs/game-core` | Deterministic, fast unit tests at the cheapest layer; reusable verbatim by server-side or other clients; matches existing pure-logic discipline (movement-system, combat) | One more shared module | ✅ |
| B — State machine inside the client animator | `client` | Slightly less indirection | Couples clip-selection logic to Three.js; harder to unit-test in isolation; not reusable | |
| C — Server computes the clip and replicates it | `server` | Client trivially dumb | Bloats schema with cosmetic data every tick; couples server to render concepts; violates the render-only spirit of AD-001 | |

**Recommendation: Approach A.** It keeps clip *selection* pure and testable in
`game-core`, the server only emits the minimal authoritative signal, and the
client owns purely-visual concerns (geometry, posing, facing). This is the
cleanest fit with AD-001/AD-005/AD-010 and the asset-pipeline goal of a single
reusable animation brain.

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --------- | -------- | ---------- |
| Pure-logic + colocated-spec pattern | `libs/game-core/src/movement-system.ts` (+ `.spec.ts`) | Mirror for `EntityAction` + state machine |
| `game-core` barrel export | `libs/game-core/src/index.ts` | Export new enum + state machine |
| `PlayerState` schema | `server/src/rooms/schema/TownState.ts:6` | Add `@type('number') action` + `actionSeq` |
| Combat/skill/death resolve points | `server/src/rooms/TownRoom.ts` (attack `:143`, skill `:158`, death `:566/handlePlayerDeath:574`), `combat-resolver.ts` | Set `action`/`actionSeq` at these exact resolve sites |
| Player capsule creation | `client/src/scene/renderer.ts:156-160` | Replace with `player-avatar` group; keep `playerMesh.position` semantics via the group's position |
| Render loop tick | `client/src/scene/renderer.ts:246` (`tick(dt)`) | Call `animator.update(dt)` alongside `faceHpBarsToCamera` |
| Local sync entry | `client/src/net/room.ts:248` (`syncLocal`) + `renderer.syncLocalPlayer` | Pass `action`/`actionSeq` through to the avatar |
| Test hook player shape | `client/src/test-hook.ts:4` (`GameStatePlayer`) + `setPlayer` | Add `action` clip field |
| Persistence shape | `server` character save/load (`scheduleDebouncedSave`, `characters` map) | Confirm `action`/`actionSeq` excluded |
| Follow camera | `client/src/camera/follow-camera.ts` | Unchanged — reads group position |

### Integration Points

| System | Integration Method |
| ------ | ------------------ |
| Colyseus state replication | New scalar fields on `PlayerState`; client `onChange` already fires `syncLocal` (`room.ts:388`) |
| `__GAME_STATE__` (AD-009) | Extend `GameStatePlayer` + `setPlayer`; Playwright reads `player.action` |
| Nx test gate (AD-010) | New specs in `game-core`/`server`/`client`/`client-e2e`; `nx affected` picks them up |

---

## Components

### EntityAction (shared enum + duration table)

- **Purpose**: Canonical render-only action ids + per-action client durations.
- **Location**: `libs/game-core/src/animation/entity-action.ts`
- **Interfaces**:
  - `enum EntityAction { None=0, Attack=1, Cast=2, Die=3 }`
  - `const ACTION_DURATION_MS: Record<EntityAction, number>` (Attack 600, Cast 800, Die 1200, None 0)
  - `type AnimationClip = 'idle' | 'move' | 'attack' | 'cast' | 'die'`
- **Dependencies**: none
- **Reuses**: `world-constants.ts` style of plain exported constants

### Animation state machine (pure)

- **Purpose**: Select the current clip + phase from inputs; no rendering.
- **Location**: `libs/game-core/src/animation/animation-state.ts`
- **Interfaces**:
  - `interface AnimState { activeAction: EntityAction; actionStartMs: number; lastSeq: number }`
  - `function createAnimState(): AnimState`
  - `function stepAnimation(state: AnimState, input: { action: EntityAction; actionSeq: number; locomotion: 'idle' | 'move'; nowMs: number }): { state: AnimState; clip: AnimationClip; phase: number }`
- **Behavior**: on `actionSeq` change → latch `activeAction`, `actionStartMs=nowMs`.
  While `nowMs - actionStartMs < ACTION_DURATION_MS[activeAction]` → clip from
  action; precedence `die>cast>attack>move>idle`. `die` stays latched until next
  seq change. Deterministic; pure (returns next state).
- **Dependencies**: `EntityAction`
- **Reuses**: pure-function + injected-`nowMs` pattern (`player-death.ts`, AD-014 `nowMs`)

### Rig contract

- **Purpose**: Define required sockets + a validator shared by builders/tests.
- **Location**: `client/src/scene/creature/rig-contract.ts`
- **Interfaces**:
  - `type Socket = 'root' | 'spine' | 'head' | 'handL' | 'handR' | 'footL' | 'footR'`
  - `const REQUIRED_SOCKETS: Socket[]`
  - `interface Rig { root: THREE.Group; sockets: Record<Socket, THREE.Object3D>; bbox: THREE.Box3 }`
  - `function validateRig(rig: Rig): { ok: boolean; missing: Socket[] }`
- **Dependencies**: three
- **Reuses**: existing `THREE.Group`/`userData` conventions (`mobs.ts`, `npc-renderer.ts`)

### Humanoid builder

- **Purpose**: Build the segmented humanoid group + sockets from params.
- **Location**: `client/src/scene/creature/humanoid.ts`
- **Interfaces**:
  - `interface HumanoidParams { size?: number; bodyColor?: number; headColor?: number; hasWeapon?: boolean }`
  - `function buildHumanoid(params?: HumanoidParams): Rig`
- **Construction**: torso (box/capsule) on `spine`; head (box) on `head`; arms as
  upper/lower primitives parented to shoulder pivots → `handL`/`handR`; legs as
  upper/lower parented to hip pivots → `footL`/`footR`; `root` at feet (y=0).
  Joints are empty `Object3D` pivots so clips rotate joints, not geometry.
  Optional weapon stub parented to `handR` when `hasWeapon`.
- **Dependencies**: three, `rig-contract`
- **Reuses**: `npc-renderer.buildNpcMesh` material/flat-shading style (AD-005)

### Clip functions (procedural posing)

- **Purpose**: Pose a rig for a given clip + phase by setting joint rotations.
- **Location**: `client/src/scene/creature/clips.ts`
- **Interfaces**:
  - `function applyClip(rig: Rig, clip: AnimationClip, phase: number): void`
  - internal `applyIdle/applyMove/applyAttack/applyCast/applyDie(rig, phase)`
- **Behavior**: deterministic joint rotations as functions of `phase` (sin-based
  limb swing for `move`, breathing bob for `idle`, arm arc for `attack`, raise +
  emit-pose for `cast`, topple for `die`). No randomness.
- **Dependencies**: three, `rig-contract`, `AnimationClip`
- **Reuses**: deterministic-math style (`terrain.ts` seeded noise)

### Animator

- **Purpose**: Per-frame glue — run the state machine, apply the chosen clip.
- **Location**: `client/src/scene/creature/animator.ts`
- **Interfaces**:
  - `function createAnimator(rig: Rig): { update(input: AnimatorInput, nowMs?: number): AnimationClip }`
  - `AnimatorInput = { action: EntityAction; actionSeq: number; locomotion: 'idle' | 'move'; phaseRate?: number }`
- **Behavior**: holds `AnimState`; computes `phase` from clip elapsed/duration
  (transient) or a looping time base (idle/move); calls `applyClip`; returns the
  active clip name (for the hook).
- **Dependencies**: `animation-state`, `clips`, `rig-contract`
- **Reuses**: state-machine output

### Player avatar

- **Purpose**: Own the local player's rig + animator; derive locomotion + facing.
- **Location**: `client/src/scene/player-avatar.ts`
- **Interfaces**:
  - `function createPlayerAvatar(): { group: THREE.Group; sync(p: { x; y; z; action; actionSeq }): void; update(dt: number): AnimationClip }`
- **Behavior**: tracks previous position → locomotion (`>0.02 m` hysteresis) +
  velocity yaw; faces target during attack/cast (target from game state); calls
  `animator.update`; returns clip name so `renderer`/`room` can publish it.
- **Dependencies**: `humanoid`, `animator`, `EntityAction`
- **Reuses**: `renderer.syncLocalPlayer` position flow

### Renderer + room + hook wiring

- **renderer.ts**: replace `playerMesh` capsule with `playerAvatar.group`; in
  `syncLocalPlayer` set group position + facing; in `tick(dt)` call
  `playerAvatar.update(dt)` and stash the returned clip; expose clip to room/hook.
- **room.ts**: `syncLocal` passes `action`/`actionSeq` into the avatar and the
  resulting clip into `setPlayer`.
- **test-hook.ts**: add `action: AnimationClip` to `GameStatePlayer`; `setPlayer`
  accepts + stores it.

---

## Data Models

### PlayerState (extended — server)

```typescript
class PlayerState extends Schema {
  // ...existing fields...
  @type('number') action = 0;     // EntityAction; render-only, NOT persisted
  @type('number') actionSeq = 0;  // bumps per action firing; wraps at uint16
}
```

**Relationships**: `action`/`actionSeq` are transient siblings of the existing
replicated fields; explicitly excluded from the DB save/load mapping (CHAR-12).

### GameStatePlayer (extended — client hook)

```typescript
interface GameStatePlayer {
  // ...existing fields...
  action: AnimationClip; // 'idle' | 'move' | 'attack' | 'cast' | 'die'
}
```

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| -------------- | -------- | ----------- |
| Rig missing a required socket | `validateRig` returns `missing`; builder unit test fails the gate | None in prod (caught at build/test) |
| Action signal arrives with unknown enum value | State machine treats unknown as `None` → falls back to locomotion | Character keeps moving/idling, no crash |
| `actionSeq` wrap (uint16 overflow) | Treat any *change* (≠ lastSeq) as a new firing, not `>` | No missed/duplicated clip at wrap |
| Large frame `dt` (tab stall) | Transient timing uses wall-clock `nowMs`, not accumulated `dt` | Clip stays in sync after refocus |
| `die` then instant respawn same tick | `die` clip latched by seq; plays full duration, then `idle` at town | Death reads correctly despite server teleport |
| Target missing during attack/cast facing | Fall back to last movement yaw | No snap-to-undefined |

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
| ------- | -------------------- | ------ | ---------- |
| Player capsule is created inline in the renderer (tight coupling) | `client/src/scene/renderer.ts:156-160` | Hard to test/replace in isolation | Extract `player-avatar` module; renderer only mounts the group + calls `update` |
| `PlayerState` schema change ripples to room + persistence tests | `server/src/rooms/schema/TownState.ts`, save/load | Existing tests may read changed schema; risk of accidental persistence | Render-only fields default to 0; add explicit "not persisted" round-trip test (CHAR-12); run full `nx test server` |
| Animation runs every frame in the render loop | `renderer.ts:246 tick`, `:335 startRenderLoop` | Per-frame cost / jank if clips allocate | Clips mutate existing joint objects (no per-frame allocation); reuse vectors |
| AD-001 boundary — cosmetic data on the authoritative schema | `PlayerState` | Could be mistaken for gameplay state | Document via AD-015: render-only, never read by gameplay logic, never persisted |
| WebGL not unit-testable; builder uses three | `client/src/scene/creature/*` | Can't assert pixels | Builder/clip tests assert geometry/transform math (pure three objects, no GL context needed in Vitest), per existing `npc-renderer.spec.ts` |
| e2e `die` is hard to trigger reliably (needs a mob kill) | `client-e2e` | Flaky death assertion | Assert `die` at the room layer (CHAR-08); e2e covers `idle/move/attack/cast` only |

> None hidden — all flagged with a mitigation.

---

## Tech Decisions (only non-obvious ones)

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Where clip-selection lives | Pure module in `game-core` | Cheapest test layer; reusable; matches AD-010 layering |
| Locomotion source | Derived client-side from replicated position delta | Server sends no velocity; locomotion is cosmetic |
| Facing source | Client-derived (velocity / target), no server rotation | Render-only (AD-001); avoids schema bloat |
| Transient-clip timing base | Wall-clock `nowMs`, injected for tests | Robust to `dt` stalls; deterministic tests (AD-014 pattern) |
| Action durations | Client constants for MVP | Avoids server timing wiring this slice; documented assumption |

> **Project-level decisions appended to `.specs/STATE.md`:** **AD-015** (render-only
> entity action signal) and **AD-016** (shared named-socket rig + pure animation
> state machine as the procedural-creature foundation).
