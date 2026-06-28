# Phase 12 — NPCs: Rigged Human GLBs Design

**Spec**: `.specs/features/phase-12-npcs-glb/spec.md`
**Status**: Draft

---

## Architecture Overview

This phase is **client-only** (no `NpcState` schema changes). It extends the Phase 8
three-layer pattern (AD-015/AD-016/AD-017) to the two town NPCs:

1. **NPC manifest** — `npcId` → GLB path, clip map, scale, feet offset (`npc-manifest.ts`).
2. **NPC avatar controller** — per-NPC mesh + idle loop + optional client greet
   (`npc-avatar.ts`).
3. **Renderer rewrite** — replace `buildNpcMesh` capsules in `npc-renderer.ts`; tick
   avatars from `renderer.ts`.
4. **Interact wiring** — trigger greet when shop/dialog opens (`room.ts` or
   `npc-interaction.ts`).
5. **Observability + gate** — `__GAME_STATE__.npcs` extensions; `character-lab` +
   `shoot-character.mjs` NPC mode.

```mermaid
graph TD
    subgraph game-core (unchanged)
      EA[EntityAction + ACTION_DURATION_MS]
      SM[stepAnimation]
      AC[AnimationClip vocabulary]
    end
    subgraph server (unchanged)
      NS[NpcState x,y,z,npcId,type,name]
      TR[TownRoom interact / shop / npcAction]
    end
    subgraph client manifest
      NM[npc-manifest getNpcEntry]
    end
    subgraph client avatar
      NA[npc-avatar idle + greet latch]
      MC[createMeshCharacter single instance]
    end
    subgraph client wiring
      NR[npc-renderer sync/remove]
      RM[room.ts syncNpc + greet trigger]
      REN[renderer.tick npc avatars]
      HOOK[__GAME_STATE__.npcs renderKind + action]
    end
    NS -- replicate --> RM
    NM --> NR
    MC --> NA
    EA --> SM --> NA
    AC --> NA
    NR --> NA
    RM --> NR
    RM -->|shopOpen / dialog| NA
    REN --> NA
    NA --> HOOK
```

**No server `action` signal for NPCs** — greet is a client-local cosmetic one-shot
(maps `cast` → `Interact` track). This honors AD-001 (no client authority on outcomes)
while avoiding schema churn for a P2 gesture.

---

## Approach Exploration

| Approach | Greet signal | Pros | Cons | |
| -------- | ------------ | ---- | ---- | - |
| **A — Client-local greet latch (RECOMMENDED)** | UI open triggers `npcAvatar.triggerGreet(playerPos)` | No server change; fast; matches optional cosmetic scope | Greet not visible to other clients (acceptable for 2 static NPCs MVP) | ✅ |
| B — Replicate `action`/`actionSeq` on `NpcState` | Server sets Cast on interact | Multiplayer-consistent greet | Schema + room handler work for cosmetic-only feature | |
| C — Proximity-only greet | `canInteract` true plays wave | No interact required | Fires repeatedly; noisy; ROADMAP says "on interaction" | |

**Recommendation: Approach A.**

| Approach | Roxxy asset | Pros | Cons | |
| -------- | ----------- | ---- | ---- | - |
| **A — Quaternius female GLB (RECOMMENDED)** | New file under `models/npcs/` | Distinct from Mage; CC0; matches Phase 10 Quaternius precedent | Custom `clipMap`; ingest inspect step | ✅ |
| B — Second KayKit Mage instance | Same mesh, different scale | Zero new asset | Fails visual gate distinctness | |
| C — Reuse KayKit Rogue_Hooded | Hooded gatekeeper look | Already vendored | Not female; contradicts ROADMAP wording | |

**Recommendation: Approach A** for Roxxy.

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --------- | -------- | ---------- |
| `createMeshCharacter` | `client/src/scene/creature/mesh-character.ts` | Single-load path per NPC (two instances total) |
| `KAYKIT_CLIP_MAP` | `mesh-character.ts` | Katerina manifest; base for greet (`cast: 'Interact'`) |
| Animation state machine | `libs/game-core/src/animation/animation-state.ts` | Idle loop via `stepAnimation` with `locomotion: 'idle'` |
| `ACTION_DURATION_MS` | `libs/game-core/src/animation/entity-action.ts` | Greet one-shot duration (Cast slot) |
| Capsule NPC renderer | `client/src/scene/npc-renderer.ts` | Replace body; keep `npcRoleFromType`, `npcStateToVisual`, fallback `buildNpcMesh` |
| `syncNpc` / `removeNpc` | `client/src/scene/renderer.ts` | Extend to instance map + tick |
| Room NPC sync | `client/src/net/room.ts` | `syncNpcFromState`, `publishNpcsToHook`, `updateInteractPrompt` |
| NPC interaction | `client/src/npc-interaction.ts` | `KATERINA_NPC_ID`, `ROXXY_NPC_ID`, interact helpers |
| Mob avatar greet/die latch pattern | `client/src/scene/mob-avatar.ts` | Model greet timer + return to idle |
| Remote player avatar | `client/src/scene/remote-player-avatar.ts` | Simpler variant (no locomotion, no weapons) |
| Creature manifest pattern | `client/src/scene/creature/creature-manifest.ts` | Parallel `npc-manifest.ts` structure |
| Visual gate | `client/src/character-lab.ts`, `scripts/shoot-character.mjs` | Add `?npc=` / `LAB_NPC` |
| Game-designer recipe | `.cursor/skills/game-designer/references/create-character.md` | NPC note: idle + visual gate |
| Town e2e | `client-e2e/src/town.spec.ts` | Extend NPC hook assertions |

### Integration Points

| System | Integration Method |
| ------ | ---------------- |
| Colyseus `NpcState` | Unchanged — position + identity fields only |
| `wireRoom` | After `shopOpen` / dialog visible, call renderer `triggerNpcGreet(npcId, playerPos)` |
| `__GAME_STATE__` | `GameStateNpc` + `renderKind`, `action`; `publishNpcsToHook` merges hook clips |
| Nx gate (AD-010) | Client unit + e2e; server regression only |

---

## Components

### NPC manifest

- **Purpose**: Map seeded town `npcId` → visual config.
- **Location**: `client/src/scene/creature/npc-manifest.ts`
- **Interfaces**:
  ```typescript
  export interface NpcEntry {
    model: string;           // e.g. '/models/characters/Mage.glb'
    clipMap: Record<AnimationClip, string>;
    scale: number;
    feetOffsetY: number;
    displayName: string;
  }
  export function getNpcEntry(npcId: number): NpcEntry | null;
  ```
- **Seed rows (initial)**:
  | npcId | displayName | model | clipMap |
  | ----- | ----------- | ----- | ------- |
  | 30004 | Katerina | `/models/characters/Mage.glb` | `KAYKIT_CLIP_MAP` with `cast: 'Interact'` |
  | 30006 | Roxxy | `/models/npcs/Roxxy.glb` (TBD filename) | Custom after inspect |
- **Dependencies**: `AnimationClip` from `@nj/game-core`
- **Reuses**: `KAYKIT_CLIP_MAP` export from `mesh-character.ts`

### NPC avatar controller

- **Purpose**: Per-NPC mesh instance: idle loop, greet one-shot, facing.
- **Location**: `client/src/scene/npc-avatar.ts`
- **Interfaces**:
  ```typescript
  export interface NpcAvatarSync {
    x: number; y: number; z: number;
    faceToward?: { x: number; z: number };
  }
  export interface NpcAvatar {
    group: THREE.Group;
    sync: (p: NpcAvatarSync) => void;
    update: (dt: number, nowMs?: number) => AnimationClip;
    triggerGreet: (faceToward: { x: number; z: number }, nowMs?: number) => void;
    ready: Promise<void>;
  }
  export function createNpcAvatar(entry: NpcEntry, mesh?: MeshCharacter): NpcAvatar;
  ```
- **Behavior**:
  - Default: `stepAnimation` with `locomotion: 'idle'`, `action: None`.
  - Greet: `triggerGreet` sets `greetUntilMs = nowMs + ACTION_DURATION_MS[Cast]`,
    temporarily passes `action: Cast` + bumped local `greetSeq` into `stepAnimation`
    (`cast` clip maps to `Interact`).
  - Debounce: ignore `triggerGreet` while `nowMs < greetUntilMs` or while a greet
    latch is active from the same UI-open cycle (track `lastGreetUiEpoch`).
  - Position: `group.position.set(x, y - entry.feetOffsetY, z)`.
  - Facing: on greet, yaw toward `faceToward`; otherwise keep last yaw or face default.
- **Dependencies**: `createMeshCharacter`, `game-core` animation modules
- **Reuses**: `player-avatar` yaw helper pattern

### NPC renderer (rewrite)

- **Purpose**: Manage `Map<string, NpcInstance>` (group + avatar + snapshot).
- **Location**: `client/src/scene/npc-renderer.ts` (modify)
- **Interfaces**:
  - `syncNpcVisual(map, state, scene, options?)` — create mesh instance when
    `getNpcEntry(npcId)` non-null; else `buildNpcMesh` fallback
  - `tickNpcVisuals(instances, dt, nowMs)` → `Map<npcKey, AnimationClip>`
  - `triggerNpcGreet(map, npcId, playerPos, nowMs)` — find instance by `npcId`
  - `removeNpc` — unchanged contract
- **Reuses**: `npcStateToVisual`, `npcRoleFromType` (role still used for fallback capsule)

### Renderer + hook wiring

- **Purpose**: Tick NPCs; publish clips to `__GAME_STATE__`.
- **Location**: `client/src/scene/renderer.ts`, `client/src/test-hook.ts`, `client/src/net/room.ts`
- **Changes**:
  - `GameStateNpc`: add `renderKind?: 'mesh' | 'capsule'`, `action?: AnimationClip`
  - `tick()`: call `tickNpcVisuals`; merge clips into `publishNpcsToHook`
  - `GameRenderer`: expose `triggerNpcGreet(npcId, playerPos)`
  - `room.ts`: when `setShopOpen(true)` or dialog shown for Roxxy, call greet

### Visual gate extensions

- **Purpose**: Screenshot NPC idle + greet poses.
- **Location**: `client/src/character-lab.ts`, `scripts/shoot-character.mjs`
- **Interfaces**: `?npc=30004&clip=idle|cast`; env `LAB_NPC=30004`
- **Reuses**: existing lab camera + `setTime` deterministic posing

---

## Data Models

### NpcEntry (client manifest)

```typescript
interface NpcEntry {
  model: string;
  clipMap: Record<AnimationClip, string>;
  scale: number;
  feetOffsetY: number;
  displayName: string;
}
```

**L2J reference anchors** (not replicated in manifest; server owns names):

| npcId | name | type | sex | collision height (L2J units) | ~world m (÷10) |
| ----- | ---- | ---- | --- | ---------------------------- | -------------- |
| 30004 | Katerina | Merchant | FEMALE | 22.5 | 2.25 |
| 30006 | Roxxy | Teleporter | FEMALE | 23 | 2.30 |

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| -------------- | -------- | ----------- |
| GLB 404 / parse error | `createMeshCharacter.ready` rejects → catch → capsule fallback | NPC visible as legacy capsule; game continues |
| Unknown `npcId` | `getNpcEntry` null → `buildNpcMesh` | Capsule placeholder |
| Greet before mesh ready | `triggerGreet` no-op until `ready` resolves | Shop still opens; no gesture |
| Missing `Interact` track | Fall back `cast` → `Spellcast_Shoot` or `idle` | Greet may look less appropriate; logged at ingest |

---

## Risks & Concerns

| Concern | Location | Impact | Mitigation |
| ------- | -------- | ------ | ---------- |
| KayKit has only one feminine hero | `models/characters/` | Roxxy may look too similar to Katerina | Source distinct Quaternius female GLB (T5); visual gate blocks sign-off until distinct |
| `publishNpcsToHook` lacks clip merge today | `room.ts:167` | E2E cannot see `action` | Merge renderer clip map in `publishNpcsToHook` or publish from `renderer.tick` (T8) |
| Greet only on local client | design choice | Other players don't see wave | Documented; acceptable for MVP static NPCs |
| `npc-renderer.spec.ts` asserts capsule colors | `npc-renderer.spec.ts` | Tests break on rewrite | Update tests in T3 to assert mesh path + fallback |
| Feet offset wrong | manifest tuning | Floating/sinking NPCs | Tune against `character-lab` + visual gate (T4/T5/T11) |

---

## Tech Decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Manifest split | `npc-manifest.ts` separate from `creature-manifest.ts` | Mobs vs town NPCs differ in lifecycle and tuning |
| Instance API | `createMeshCharacter` not clone | Only one spawn per `npcId` |
| Greet mechanism | Client-local `triggerGreet` → `cast`/`Interact` | Optional cosmetic; no server schema |
| Katerina asset | KayKit `Mage.glb` | CC0, feminine, `Interact` track verified |
| Roxxy asset | Quaternius CC0 female | Distinct silhouette; Phase 10 Quaternius precedent |
| Hook `renderKind` | `'mesh'` when manifest hit | Mirrors Phase 11 `others[].renderKind` |

> **Project-level decisions:** No new AD required — fits AD-015/AD-016/AD-017. Pure asset
> + client wiring phase.
