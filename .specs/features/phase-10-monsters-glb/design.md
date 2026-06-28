# Phase 10 — Monsters: Rigged GLB Mobs + Clone-per-Instance Design

**Spec**: `.specs/features/phase-10-monsters-glb/spec.md`
**Status**: Draft

---

## Architecture Overview

The phase extends the Phase 8 three-layer pattern (AD-015/AD-016/AD-017) to mobs.
**No changes** to `game-core` animation state machine or `EntityAction` enum — mobs
reuse the same brain. Work splits across:

1. **Client mesh pipeline** — template cache + `SkeletonUtils.clone` instances
   (`mesh-character.ts`), `npcId` manifest (`creature-manifest.ts`), per-mob
   avatar controller (`mob-avatar.ts`), and `mobs.ts` rewrite.
2. **Server signal** — `MobState.action` + `actionSeq`; `emitMobAction` in
   `TownRoom` on mob hit and kill (render-only, AD-015).
3. **Wiring** — `room.ts` passes action fields; `renderer.ts` ticks all mob
   avatars; `test-hook.ts` exposes `mobs[].action`.
4. **Assets + gate** — four CC0 GLBs under `client/public/models/monsters/`;
   `character-lab` + `shoot-character.mjs` extended for mob review.

```mermaid
graph TD
    subgraph game-core (unchanged)
      EA[EntityAction + ACTION_DURATION_MS]
      SM[stepAnimation]
    end
    subgraph server
      MS[MobState +action +actionSeq]
      TR[TownRoom: emitMobAction on hit/kill]
      CR[resolveMobAttack / handleMobKill]
    end
    subgraph client mesh pipeline
      CACHE[loadGltfTemplate url cache]
      CLONE[createMeshCharacterInstance SkeletonUtils.clone]
      MAN[creature-manifest npcId to entry]
      MA[mob-avatar per instance AnimState]
    end
    subgraph client wiring
      MOBS[mobs.ts sync + HP bar]
      ROOM[room.ts onChange action]
      REN[renderer.tick mob avatars]
      HOOK[__GAME_STATE__.mobs action]
    end
    CR --> TR --> MS
    MS -- replicate --> ROOM
    MAN --> MOBS
    CACHE --> CLONE --> MOBS
    MOBS --> MA
    EA --> SM --> MA
    MA --> CLONE
    ROOM --> MOBS
    REN --> MA
    MA --> HOOK
```

---

## Approach Exploration

| Approach | Instance strategy | Pros | Cons | |
| -------- | ----------------- | ---- | ---- | - |
| **A — Template cache + SkeletonUtils.clone (RECOMMENDED)** | `loadGltfTemplate` once; `clone` per spawn; own mixer | Correct skinning; one fetch; matches `create-monster.md` | Small extension to `mesh-character.ts` | ✅ |
| B — Separate GLTFLoader.load per spawn | N loads, N mixers | Simple code | N network fetches; slow with many mobs | |
| C — InstancedMesh / no skeleton | GPU instancing | Fastest draw calls | No skeletal animation; violates AD-017 | |

**Recommendation: Approach A** — required for skinned animation at scale.

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --------- | -------- | ---------- |
| `createMeshCharacter` + `KAYKIT_CLIP_MAP` | `client/src/scene/creature/mesh-character.ts` | Extend with template cache + clone factory; player path unchanged |
| Animation state machine | `libs/game-core/src/animation/animation-state.ts` | `createAnimState` + `stepAnimation` per mob instance |
| `EntityAction` + durations | `libs/game-core/src/animation/entity-action.ts` | Shared enum; mobs use Attack/Die only |
| Player avatar locomotion pattern | `client/src/scene/player-avatar.ts` | Copy `MOVE_THRESHOLD`, `MOVE_COAST_MS`, coast-timer locomotion |
| `emitPlayerAction` | `server/src/rooms/TownRoom.ts:608` | Mirror as `emitMobAction(mobState, action)` |
| Mob spawn/sync | `server/src/rooms/spawn-manager.ts` | `syncMobState` extended to copy action fields if needed |
| Capsule mob renderer | `client/src/scene/mobs.ts` | Replace body with mesh instance; retain HP bar helpers |
| Room mob callbacks | `client/src/net/room.ts:418-447` | Pass `action`/`actionSeq` into `syncMob` |
| Renderer mob map | `client/src/scene/renderer.ts:256-268, 292` | Tick mob avatars; publish clips to hook |
| Test hook mobs | `client/src/test-hook.ts:26-34, 193` | Add `action: AnimationClip` to `GameStateMob` |
| Visual gate | `client/character-lab.ts`, `scripts/shoot-character.mjs` | Add mob model param |
| Combat test helpers | `server/src/rooms/TownRoom.spec.ts` | `placePlayerAndMobForCombat`, `OUT_OF_PEACE`, `deliverAndTick` |
| Game-designer recipes | `.cursor/skills/game-designer/references/create-monster.md` | Asset ingest + inspect workflow for T4–T7 |

### Integration Points

| System | Integration Method |
| ------ | ---------------- |
| Colyseus `MobState` | Add `@type('number') action` + `actionSeq`; defaults 0 |
| `TownRoom.simulate` | After `resolveMobAttack` damage: `emitMobAction`; before mob delete in `handleMobKill`: `emitMobAction(Die)` |
| Client `syncMob` | Extended payload: `npcId`, `action`, `actionSeq` |
| `__GAME_STATE__` | `setMobs` includes derived `action` clip string per mob |
| Nx gate (AD-010) | Unit + room + e2e; `nx affected` |

---

## Components

### GLTF template cache + instance factory

- **Purpose**: Load each mob GLB once; produce independent skinned instances.
- **Location**: `client/src/scene/creature/mesh-character.ts` (extend)
- **Interfaces**:
  - `loadGltfTemplate(url: string, loader?: GLTFLoader): Promise<GLTFTemplate>`
  - `createMeshCharacterInstance(template: GLTFTemplate, options?: MeshCharacterOptions): MeshCharacter`
  - `clearGltfTemplateCache()` — test-only reset
- **Behavior**: `loadGltfTemplate` dedupes in-flight/resolved promises per URL.
  `createMeshCharacterInstance` calls `SkeletonUtils.clone(template.scene)`,
  builds a fresh `AnimationMixer` on the clone, registers clip actions from
  `template.animations`.
- **Dependencies**: three `GLTFLoader`, `SkeletonUtils`
- **Reuses**: existing `MeshCharacter` interface (`play`, `update`, `setTime`)

### Creature manifest

- **Purpose**: Map seeded `npcId` → asset config.
- **Location**: `client/src/scene/creature/creature-manifest.ts`
- **Interfaces**:
  ```typescript
  export interface CreatureEntry {
    model: string;           // e.g. '/models/monsters/Gremlin.glb'
    clipMap: Record<AnimationClip, string>;
    scale: number;
    feetOffsetY: number;     // subtract from server y for feet on ground
    hpBarYOffset: number;    // local Y for billboard bar
  }
  export function getCreatureEntry(npcId: number): CreatureEntry | null;
  ```
- **Dependencies**: `AnimationClip` from `@nj/game-core`
- **Reuses**: `KAYKIT_CLIP_MAP` pattern for bipeds; per-family maps for quadrupeds

### Mob avatar controller

- **Purpose**: Per-mob-instance animation brain + facing (mirrors `player-avatar`).
- **Location**: `client/src/scene/mob-avatar.ts`
- **Interfaces**:
  ```typescript
  export interface MobAvatarSync {
    x: number; y: number; z: number;
    action?: EntityAction; actionSeq?: number;
    faceToward?: { x: number; z: number }; // attack facing
  }
  export function createMobAvatar(entry: CreatureEntry, template: GLTFTemplate): MobAvatar;
  ```
- **Behavior**: Own `AnimState`; `sync()` updates position + action; `update(dt)`
  runs `stepAnimation` → `mesh.play(clip)` → `mesh.update(dt)`; sets yaw from
  movement or `faceToward` during attack; returns current `AnimationClip`.
- **Dependencies**: `mesh-character`, `game-core` animation
- **Reuses**: `player-avatar.ts` locomotion constants

### Mobs renderer (rewrite)

- **Purpose**: Manage mob mesh map: template lookup, instance creation, HP bars,
  delayed removal on death.
- **Location**: `client/src/scene/mobs.ts`
- **Interfaces** (extended):
  - `MobVisualState` adds `npcId`, `action`, `actionSeq`
  - `MobInstance` internal: `{ group, avatar, pendingRemoval? }`
  - `syncMobVisual` / `removeMob` updated for mesh + die latch
- **Behavior**: On first sync for `mobId`, resolve `getCreatureEntry(npcId)` →
  `loadGltfTemplate` → `createMobAvatar`. Fallback: legacy capsule body. On
  `removeMob`, if die clip active, defer `scene.remove` until duration elapses.
- **Dependencies**: manifest, mob-avatar, template cache
- **Reuses**: `hpBarFillRatio`, `faceHpBarsToCamera`

### Server mob action emitter

- **Purpose**: Set render-only action on replicated mob schema.
- **Location**: `server/src/rooms/TownRoom.ts`
- **Interfaces**:
  - `private emitMobAction(mob: MobState, action: EntityAction): void`
- **Call sites**:
  1. `simulate()` mob attack loop — when `mobResult.damage > 0`
  2. `handleMobKill()` — before `state.mobs.delete`
- **Dependencies**: `EntityAction` from `@nj/game-core`
- **Reuses**: `emitPlayerAction` implementation (same seq wrap `& 0xffff`)

### MobState schema extension

- **Location**: `server/src/rooms/schema/MobState.ts`
- **Fields**: `action = 0`, `actionSeq = 0` (render-only, not in DB)

### Room + hook wiring

- **room.ts**: `syncMobFromState` passes `npcId`, `action`, `actionSeq`; `publishMobs`
  includes client-derived `action` clip from renderer or passes server fields for
  e2e (prefer **client-derived clip** in hook for consistency with player).
- **renderer.ts**: `syncMob` extended; `tick(dt)` calls each mob avatar `update`;
  writes clips into `setMobs`.
- **test-hook.ts**: `GameStateMob.action: AnimationClip`

### Visual gate extension

- **Location**: `client/character-lab.ts`, `scripts/shoot-character.mjs`
- **Behavior**: Accept `?model=monsters/Gremlin` or `?npcId=20001` resolving via
  manifest; same `__SHOT_READY__` contract; shots: idle, attack, die (move optional).

---

## Data Models

### MobState (extended — server)

```typescript
class MobState extends Schema {
  // ...existing...
  /** Render-only; not persisted (AD-015). */
  @type('number') action = 0;
  @type('number') actionSeq = 0;
}
```

### GameStateMob (extended — client hook)

```typescript
interface GameStateMob {
  id: string;
  npcId: number;
  x: number; y: number; z: number;
  hp: number; maxHp: number;
  action: AnimationClip;
}
```

### CreatureEntry (manifest row — example shape)

```typescript
// Values finalized after GLB inspect in T4–T7; track names MUST be real.
20001: {
  model: '/models/monsters/Gremlin.glb',
  clipMap: { idle: '...', move: '...', attack: '...', cast: '...', die: '...' },
  scale: 1.0,
  feetOffsetY: 0.9,
  hpBarYOffset: 1.6,
}
```

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| -------------- | -------- | ----------- |
| GLB load failure | Log; fallback capsule for that mob | Mob visible as placeholder |
| Missing clip track in GLB | `play()` no-ops missing action; gate fails | Caught before merge |
| Unknown `npcId` in manifest | Capsule fallback | Mob still functional |
| Mob removed while die playing | Defer scene removal until die duration | Brief death pose |
| `action` enum out of range | State machine treats as `None` | Idle/move only |

---

## Risks & Concerns

| Concern | Location | Impact | Mitigation |
| ------- | -------- | ------ | ---------- |
| Shared skinned mesh without clone | `mobs.ts` today | Corrupt skinning / lock-step animation | MOB-01/02: mandatory `SkeletonUtils.clone` + unit test |
| Mob deleted same tick as DIE signal | `TownRoom.handleMobKill:705` | Client may miss die clip | Emit DIE before delete; client die-latch on remove (MOB-21) |
| Per-frame cost of N mixers | `renderer.tick` | Jank with many mobs | Only tick live mobs; no per-frame allocations; 11 spawns OK for slice |
| Quadruped clip names differ from KayKit | New GLB families | Wrong/missing animations | Per-family `clipMap` in manifest; inspect before map (MOB-07) |
| Peace-zone combat flakes | TI spawns near town | E2e attack tests no-op | Reuse `OUT_OF_PEACE` + `placePlayerAndMobForCombat` (Phase 6 lesson) |
| Gremlin one-shot on 17 dmg | Phase 4/5 tests | Cannot test 2nd attack seq on Gremlin | Room tests use Goblin for second-hit seq (Phase 5 deviation) |
| `syncMobState` omits action fields | `spawn-manager.ts:111` | Stale action on position sync | `emitMobAction` sets on `MobState` directly; syncMobState need not clear action |
| Visual gate pixel-blind pass | AD-017 lesson | Green tests, ugly mobs | Mandatory `shoot-character.mjs` review MOB-30/31 |

---

## Tech Decisions (only non-obvious ones)

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Clone API location | Extend `mesh-character.ts` | Single mesh backend; player + mobs share clip crossfade logic |
| Manifest vs DB | Client-side `creature-manifest.ts` | Visual config is client-only; `npcId` already on wire |
| Mob `cast` | Map with fallback; server never emits `Cast` | Keeps state machine unified; no mob skills in MVP |
| Hook `action` source | Client-derived clip string (after `mob-avatar.update`) | Matches `player.action` pattern (CHAR-11) |
| Death removal | Client delayed removal; server immediate delete | Server authority on gameplay; client owns cosmetic die hold |
| Template cache scope | Module-level `Map<url, Promise<GLTF>>` | One fetch per model URL per page session |

> **Project-level decisions:** No new AD required if AD-015 scope ("all animated
> entities") is interpreted to include mobs. Implementer records in validation if
> AD-015 comment is amended to explicitly list `MobState`.

---

## Asset Ingest Notes (Implementer)

Follow `.cursor/skills/game-designer/references/create-monster.md` for each mob
(T4–T7):

1. Source CC0 GLB (Quaternius / KayKit / Mixamo).
2. Inspect animation track names (`create-character.md` step 2 node script).
3. Build per-family `clipMap` from **literal** track names.
4. Tune `scale` / `feetOffsetY` / `hpBarYOffset` using `character-lab` bbox log.
5. Vendor `LICENSE.txt` when the pack provides one.

**L2J reference** (stats unchanged; visual scale hints only) — from
`server/src/seed/__fixtures__/monsters.xml`:

| npcId | Name | Race | L2 collision h×r | MVP ~height |
| ----- | ---- | ---- | ---------------- | ----------- |
| 20001 | Gremlin | FAIRY | 15 × 10 | ~1.5 m |
| 20003 | Goblin | HUMANOID | 16.5 × 10 | ~1.65 m |
| 20120 | Wolf | ANIMAL | 9 × 13 | ~0.9 m |
| 20481 | Bearded Keltir | ANIMAL | 10 × 9.5 | ~1.0 m |
