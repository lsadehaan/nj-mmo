# Phase 11 — Remote Players & Equipped Weapons Design

**Spec**: `.specs/features/phase-11-remote-players-weapons/spec.md`
**Status**: Draft

---

## Architecture Overview

Client-only visual phase. **No server schema or gameplay changes** — `PlayerState`
already replicates `x/y/z`, render-only `action`/`actionSeq` (AD-015), and
`equippedWeaponItemId` (Phase 7). Work extends the Phase 8 three-layer pattern
(AD-016/AD-017) to remote players and adds a thin **attachment layer** for props.

```mermaid
graph TD
    subgraph server (unchanged)
      PS[PlayerState x,y,z action,actionSeq equippedWeaponItemId]
    end
    subgraph game-core (unchanged)
      SM[stepAnimation + ACTION_DURATION_MS]
      EA[EntityAction enum]
    end
    subgraph attachment layer (new)
      WM[weapon-manifest itemId to prop]
      AB[attachment.ts findBone attach detach]
      PROPS[props GLBs sword + club]
    end
    subgraph remote avatar (new)
      RPA[remote-player-avatar.ts]
      RP[remote-players.ts instance map]
    end
    subgraph local avatar (extend)
      PA[player-avatar.ts + weapon attach]
    end
    subgraph mob renderer (extend)
      MOBS[mobs.ts Goblin club on 20003]
    end
    subgraph wiring
      ROOM[room.ts sync remote fields]
      REN[renderer.ts tick remotes]
      HOOK[__GAME_STATE__.others]
    end
    PS -- replicate --> ROOM
    EA --> SM
    SM --> RPA
    SM --> PA
    WM --> AB
    PROPS --> AB
    AB --> PA
    AB --> RPA
    AB --> MOBS
    RPA --> RP
    ROOM --> RP
    ROOM --> REN
    REN --> RP
    RP --> HOOK
    PA --> HOOK
```

---

## Approach Exploration

| Approach | Remote avatar | Weapon attach | Pros | Cons | |
| -------- | ------------- | ------------- | ---- | ---- | - |
| **A — Mirror `player-avatar` + shared attachment module (RECOMMENDED)** | New `remote-player-avatar.ts`; keep `player-avatar.ts` for local | `attachment.ts` + `weapon-manifest.ts` | Matches `create-character.md` Remote note; minimal risk to local player e2e | Small duplication of locomotion loop | ✅ |
| B — Single `human-avatar.ts` parameterized | One factory with `{ mode: 'local' \| 'remote' }` | Same attachment | DRY | Larger refactor; risks Phase 8 regression | |
| C — Remote players use mob clone path | `createMeshCharacterInstance` per remote | Same | Reuses Phase 10 clone | Wrong semantics — remotes are not clones of one template instance | |

**Recommendation: Approach A** — surgical replacement of `remote-players.ts` capsule;
local player path stays stable for `character-animation.spec.ts`.

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --------- | -------- | ---------- |
| `createMeshCharacter` + `KAYKIT_CLIP_MAP` | `client/src/scene/creature/mesh-character.ts` | One `createMeshCharacter` per remote session |
| Animation state machine | `libs/game-core/src/animation/animation-state.ts` | `createAnimState` + `stepAnimation` in remote avatar |
| `MOVE_THRESHOLD` / `MOVE_COAST_MS` | `client/src/scene/player-avatar.ts` | Import into `remote-player-avatar.ts` |
| `createMobAvatar` pattern | `client/src/scene/mob-avatar.ts` | Template for per-instance sync/update without camera |
| `loadGltfTemplate` cache | `mesh-character.ts` | Cache prop GLBs same as characters |
| `PlayerState` replication | `server/src/rooms/schema/TownState.ts` | Read-only on client — no edits |
| Remote wiring | `client/src/net/room.ts:399-423` | Extend `syncRemotePlayer` payload |
| Renderer tick pattern | `client/src/scene/renderer.ts:354-384` | Add `tickRemoteVisuals` parallel to mobs |
| Test hook `others` | `client/src/test-hook.ts:37-42, 87-100` | Extend `OtherPlayer` interface |
| Multiplayer e2e | `client-e2e/src/multiplayer.spec.ts` | Keep leave/rejoin tests green; new remote-avatar spec |
| Visual gate | `client/character-lab.ts`, `scripts/shoot-character.mjs` | Add weapon + dual-avatar modes |
| Game-designer recipes | `.cursor/skills/game-designer/references/create-attachment.md`, `create-character.md` | Bone discovery + grip tuning workflow |

### Integration Points

| System | Integration Method |
| ------ | ------------------ |
| Colyseus `players` map | `onAdd`/`onChange` passes `action`, `actionSeq`, `equippedWeaponItemId` for non-local ids |
| `GameRenderer` API | `syncRemotePlayer(sessionId, payload)` replaces position-only signature |
| `__GAME_STATE__.others` | Published after remote sync + tick clip update |
| Goblin mob spawn | `ensureMobInstance` in `mobs.ts` after mesh avatar ready — attach club to skinned rig |
| Nx gate (AD-010) | `nx test client`, `nx e2e client-e2e`, `nx run-many -t build lint test` |

---

## Components

### `attachment.ts` — bone parenting

- **Purpose**: Find skeleton bones by name; parent static props; no prop mixer.
- **Location**: `client/src/scene/creature/attachment.ts`
- **Interfaces**:
  ```typescript
  export interface GripTransform {
    position: THREE.Vector3Tuple;
    rotation: THREE.EulerTuple; // radians
    scale: number;
  }

  export function findBoneByName(root: THREE.Object3D, boneName: string): THREE.Bone | null;

  export function attachToBone(
    root: THREE.Object3D,
    prop: THREE.Object3D,
    boneName: string,
    transform: GripTransform
  ): boolean; // false if bone missing

  export function detachProp(prop: THREE.Object3D): void;
  ```
- **Behavior**: Traverse `root` for `SkinnedMesh`, search `skeleton.bones` by exact
  name. `attachToBone` sets local transform then `bone.add(prop)`.
- **Dependencies**: three
- **Reuses**: KayKit skeleton structure (same as player + goblin biped)

### `weapon-manifest.ts` — itemId → prop config

- **Purpose**: Data-driven attachment lookup for server equip ids + static mob props.
- **Location**: `client/src/scene/creature/weapon-manifest.ts`
- **Interfaces**:
  ```typescript
  export interface WeaponAttachmentEntry {
    model: string;
    bone: string;
    transform: GripTransform;
  }

  export const KAYKIT_RIGHT_HAND_BONE: string; // set after ingest discovery

  export function getWeaponAttachment(itemId: number): WeaponAttachmentEntry | null;

  export const GOBLIN_CLUB_ATTACHMENT: WeaponAttachmentEntry; // static for npcId 20003
  ```
- **Dependencies**: `GripTransform` from `attachment.ts`
- **Reuses**: L2J item ids **2369** (sword), **4** (club visual on goblin)

### `remote-player-avatar.ts` — per-remote animation brain

- **Purpose**: Mesh humanoid with locomotion + action clips; optional weapon attach.
- **Location**: `client/src/scene/remote-player-avatar.ts`
- **Interfaces**:
  ```typescript
  export interface RemotePlayerAvatarSync {
    x: number; y: number; z: number;
    action?: EntityAction; actionSeq?: number;
    equippedWeaponItemId?: number;
  }

  export interface RemotePlayerAvatar {
    group: THREE.Group;
    sync: (p: RemotePlayerAvatarSync, nowMs?: number) => void;
    update: (dt: number, nowMs?: number) => AnimationClip;
    ready: Promise<void>;
  }

  export function createRemotePlayerAvatar(options?: { mesh?: MeshCharacter }): RemotePlayerAvatar;
  ```
- **Behavior**: Copy of `player-avatar` locomotion/action loop **without**
  `getGameState` target facing. Weapon attach/detach on `equippedWeaponItemId`
  change (load prop via `loadGltfTemplate`, clone for each attach if sharing template).
- **Dependencies**: `mesh-character`, `attachment`, `weapon-manifest`, `@nj/game-core`
- **Reuses**: `FEET_OFFSET_Y` / `MODEL_SCALE` constants from player-avatar (export shared constants file or duplicate values with comment — prefer **export** `PLAYER_AVATAR_DEFAULTS` from `player-avatar.ts` to avoid drift)

### `remote-players.ts` — instance map (rewrite)

- **Purpose**: Manage remote session avatars in the scene.
- **Location**: `client/src/scene/remote-players.ts` (replace capsule implementation)
- **Interfaces**:
  ```typescript
  export type RemotePlayerMap = Map<string, RemotePlayerInstance>;

  interface RemotePlayerInstance {
    group: THREE.Group;
    avatar: RemotePlayerAvatar;
    lastClip: AnimationClip;
    equippedWeaponItemId: number;
  }

  export function upsertRemotePlayer(map, sessionId, sync, scene): RemotePlayerInstance;
  export function removeRemotePlayer(map, sessionId, scene): void;
  export function tickRemotePlayers(map, dt, nowMs): Map<string, AnimationClip>;
  export function listRemotePlayers(map): OtherPlayerHookEntry[];
  ```
- **Dependencies**: `remote-player-avatar`
- **Reuses**: Map upsert/remove pattern from current file

### `player-avatar.ts` — local weapon attach (extend)

- **Purpose**: Show equipped sword on the local hero.
- **Location**: `client/src/scene/player-avatar.ts`
- **Change**: Extend `PlayerAvatarSync` with `equippedWeaponItemId?: number`; attach
  on sync when id changes; `room.ts` `syncLocal` already has weapon id — thread it through `game.syncLocalPlayer`.
- **Reuses**: Same `attachment.ts` + `weapon-manifest.ts` as remotes

### `mobs.ts` — Goblin club (extend)

- **Purpose**: Static club on `npcId=20003` mesh instances.
- **Location**: `client/src/scene/mobs.ts`
- **Change**: After `createMobAvatar` + template load for Goblin, `cloneSkeleton` on
  prop template, `attachToBone` on avatar mesh root. Store `clubProp` on `MobInstance`.
- **Reuses**: `GOBLIN_CLUB_ATTACHMENT`, `createMeshCharacterInstance` clone discipline

### Wiring — `room.ts` + `renderer.ts` + `test-hook.ts`

- **room.ts**: `game.syncRemotePlayer(id, { x, y, z, action, actionSeq, equippedWeaponItemId })`;
  `publishOthers` reads `game.listRemotePlayers()` for hook fields.
- **renderer.ts**:
  - Change `remoteMeshes: RemotePlayerMeshMap` → `remotePlayers: RemotePlayerMap`
  - `tick`: call `tickRemotePlayers`, publish `others` clips
  - `syncLocalPlayer`: add `equippedWeaponItemId` param → `playerAvatar.sync`
- **test-hook.ts**: Extend `OtherPlayer` with `renderKind: 'mesh'`, `action`, `equippedWeaponId`

---

## Data Models

### Hook: `OtherPlayer` (extended)

```typescript
export interface OtherPlayer {
  id: string;
  x: number;
  y: number;
  z: number;
  renderKind: 'mesh';
  action: AnimationClip;
  equippedWeaponId: number | null;
}
```

### Weapon manifest entries (initial)

```typescript
// After KayKit bone discovery (example — implementer MUST verify name):
KAYKIT_RIGHT_HAND_BONE = 'Wrist_R'; // placeholder until ingest logs real name

WEAPON_ATTACHMENTS = {
  2369: {
    model: '/models/props/SquiresSword.glb',
    bone: KAYKIT_RIGHT_HAND_BONE,
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 }, // tuned in visual gate
  },
};

GOBLIN_CLUB_ATTACHMENT = {
  model: '/models/props/GoblinClub.glb',
  bone: KAYKIT_RIGHT_HAND_BONE,
  transform: { /* tuned */ },
};
```

**Relationships**: `2369` matches seeded `items` row and starter kit; `4` is visual-only for Goblins.

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| -------------- | -------- | ----------- |
| Character GLB load fails | `ready.catch(() => undefined)`; sync/update no-throw | Invisible remote until reload; multiplayer logic OK |
| Prop GLB load fails | Skip attach; `console.warn` | Player/mob appears without weapon |
| Bone name not found | `attachToBone` returns false | No weapon; warn in dev |
| Unknown `equippedWeaponItemId` | Manifest returns null → detach | No prop (correct) |
| Remote removed mid-attack | `removeRemotePlayer` disposes group | Other player disappears cleanly |

---

## Risks & Concerns

| Concern | Location | Impact | Mitigation |
| ------- | -------- | ------ | ---------- |
| Duplicated locomotion logic | `player-avatar.ts` vs `remote-player-avatar.ts` | Drift in coast timer / thresholds | Export shared constants; copy spec tests from `player-avatar.spec.ts` |
| Bone name differs Goblin vs Rogue KayKit placeholder | `creature-manifest` Goblin uses KayKit biped placeholder | Club attaches to wrong bone | Discover bone on both rigs during ingest; allow per-entry `bone` override in manifest |
| Renderer tick omission | `renderer.ts` tick had no remote update | Frozen remote animation | T6 explicitly ticks remotes; unit spy test (RPW-04) |
| Hook not updated | `publishOthers` only positions today | E2e cannot prove mesh | T8 extends hook before e2e (RPW-25–28) |
| Shared prop object across remotes | Attachment without clone | Weapon teleports between players | Clone prop per attach (`SkeletonUtils.clone` or `prop.clone()`) |
| Phase 8 e2e regression | `character-animation.spec.ts` | Broken local anim | Thread equip id without changing locomotion; run full gate |
| `syncLocalPlayer` signature change | `renderer.ts` + `room.ts` | TS break | Single task wires equip + weapon attach together |

---

## Tech Decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Remote instance API | `createMeshCharacter` per session | `create-character.md` — not mob clone path |
| Attachment motion | Parent to bone, no prop mixer | `create-attachment.md` anti-pattern guard |
| Weapon authority | `equippedWeaponItemId` from server only | AD-001 |
| Goblin club | Static manifest entry on `npcId=20003` | Mobs have no equip state |
| Remote facing during attack | Movement yaw only | No replicated target id for other players |
| Visual distinction | None | ROADMAP silent; reduces scope |
| Server changes | None | All fields already on wire |
| Bone name source | Runtime skeleton inspect at asset ingest | Never guess (L-008 lesson pattern from Phase 10) |

> **Project-level decisions:** No new AD required — conforms to AD-015, AD-016, AD-017, AD-001. Feature-local decisions stay in this table.
