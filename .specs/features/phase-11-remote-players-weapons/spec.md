# Phase 11 — Remote Players & Equipped Weapons Specification

## Problem Statement

Multiplayer works server-authoritatively (Phase 3) and the local player renders as a
rigged KayKit humanoid with skeletal animation (Phase 8, AD-017), but **other
players still appear as orange capsules** (`client/src/scene/remote-players.ts`) with
no animation and no equipment visuals. Equipped weapons affect combat on the server
(`equippedWeaponItemId` on `PlayerState`, Squire's Sword **2369** seeded in Phase 7)
but never appear in the hand. Goblin mobs (Phase 10) are rigged humanoids but carry
no club despite L2J Classic giving them item **4** (Club, `bodypart=rhand`).

This phase makes multiplayer **look** like multiplayer: remote sessions render the same
human avatar clip set (`idle`/`move`/`attack`/`cast`/`die`), weapons attach to the
right hand from **server equip state**, and Goblins visibly wield a club.

## Goals

- [ ] Replace remote-player capsules with rigged human avatars driven by replicated
      `PlayerState` (position + render-only `action`/`actionSeq`).
- [ ] Introduce a reusable **bone attachment** helper and item→prop manifest.
- [ ] Show **Squire's Sword** (item **2369**, L2J `bodypart=rhand`) in the right
      hand of **local and remote** players when `equippedWeaponItemId === 2369`.
- [ ] Attach a **Goblin Club** prop to every Goblin mob (`npcId=20003`), cloned per
      instance (Phase 10 carry-forward).
- [ ] Extend `__GAME_STATE__.others` for Playwright; add e2e proving mesh remote +
      locomotion action; mandatory **visual gate** (AD-017).

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| NPC human GLBs | Phase 12 |
| Additional weapon types beyond 2369 (+ Goblin static club) | Phase 14 icons / later variety |
| Server schema or combat rule changes | `PlayerState` already replicates equip + action (AD-015); authority unchanged (AD-001) |
| Character skin selection per player | All humanoids use the same KayKit Adventurers rig (`Rogue.glb`) for MVP |
| Shield / dual-wield / left-hand attachments | L2J `bodypart` not in scope; right hand only |
| Persisting attachment state | Driven live from replicated `equippedWeaponItemId`; DB already owns equip |
| Remote player nameplates / HP bars | Not in ROADMAP |
| Weapon trail / combat VFX | Phase 13 |
| Proprietary L2 assets | AD-004 |

---

## Assumptions & Open Questions

The Planner cannot talk to the user; every ambiguity is resolved here.

| Assumption / decision | Chosen default | Rationale |
| --------------------- | -------------- | --------- |
| Remote avatar model | Same KayKit `Rogue.glb` + `KAYKIT_CLIP_MAP` as local player | `create-character.md` Remote-player note: same human avatar; one rig simplifies attachments |
| Remote mesh instance strategy | `createMeshCharacter(url)` per remote session (single-load path) | Each remote player is unique; not the mob clone path (`createMeshCharacterInstance`) |
| Visual distinction local vs remote | None beyond position (no tint/outline) | ROADMAP does not require it; avoids extra AD |
| Remote attack facing | Face last movement direction only (no `getGameState` target) | Remote clients lack the attacker's `targetMobId`; cosmetic-only (AD-001) |
| Hand bone resolution | Discover real KayKit bone name via skeleton traverse at ingest; cache in manifest | `create-attachment.md` step 3 — never guess bone names |
| Prop asset sourcing | CC0 KayKit weapon pack or Quaternius weapons; placeholder OK pre-live (AD-017) | Same license hygiene as characters |
| Prop storage | `client/public/models/props/SquiresSword.glb`, `GoblinClub.glb` + optional `LICENSE.txt` | Mirrors `models/characters/` layout |
| Weapon manifest scope | `2369` server-driven; Goblin club static on `npcId=20003` (not server mob equip) | Goblins have no inventory; L2J club is cosmetic on that template |
| Unequip sentinel | `equippedWeaponItemId === 0` → detach all manifest props | Matches `TownState.spec.ts` default |
| Unmapped weapon ids | No prop rendered (silent fallback) | Safe rollout for future items |
| `die` on remote player | Play full client `die` clip from replicated signal; server respawn is instant (CHAR-08 pattern) | Same as local player AD-015 behavior |
| Test hook shape | `others[].renderKind: 'mesh'`, `others[].action: AnimationClip`, `others[].equippedWeaponId: number \| null` | AD-009 — DOM + hook, never pixels |
| Server tests | None new — regression gate only | No server gameplay change; equip + action already covered in Phases 7–8 |
| Visual gate | Extend `character-lab` + `shoot-character.mjs` for `?weapon=2369` and two-avatar idle+attack frames | AD-017 mandatory review |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Remote Human Avatar ⭐ MVP

**User Story**: As a player in a second browser, I want other players to look like
animated humanoids (not capsules), so multiplayer feels real.

**Why P1**: Core ROADMAP deliverable; capsules are the main visual gap after Phase 8.

**Acceptance Criteria**:

1. WHEN a remote player joins THEN the client SHALL create a rigged human mesh via
   `createMeshCharacter` (KayKit `Rogue.glb`) and SHALL NOT use `CapsuleGeometry`
   for that session. **Test layer: unit**
2. WHEN `upsertRemotePlayer` is called for a new `sessionId` THEN it SHALL add one
   `THREE.Group` root per session (distinct from other sessions). **Test layer: unit**
3. WHEN a remote player is removed (`onRemove` / `removeRemotePlayer`) THEN the
   client SHALL dispose the avatar group and delete the map entry. **Test layer: unit**
4. WHEN the renderer `tick` runs THEN it SHALL call `update(dt)` on every remote
   avatar so clips advance between server patches. **Test layer: unit (spy/callback)**

**Independent Test**: Vitest builds a remote avatar map, asserts no capsule child,
distinct group per id, tick invokes update.

---

### P1: Remote Animation from Replicated State ⭐ MVP

**User Story**: As a player, I want to see others walk, swing, cast, and die based
on what the server reports, not client guesses.

**Why P1**: AD-015/AD-016 — animation brain already exists; remote wiring is the gap.

**Acceptance Criteria**:

1. WHEN a remote player's server position delta exceeds `MOVE_THRESHOLD` (`0.02` m)
   THEN the client SHALL select the `move` clip (with `MOVE_COAST_MS` coast timer
   identical to `player-avatar.ts`). **Test layer: unit**
2. WHEN the coast timer expires with no further movement THEN the client SHALL
   select `idle`. **Test layer: unit**
3. WHEN replicated `actionSeq` increases with `action=Attack` THEN the client SHALL
   play the `attack` one-shot for `ACTION_DURATION_MS[Attack]` (**600** ms).
   **Test layer: unit**
4. WHEN replicated `action=Cast` with a new `actionSeq` THEN the client SHALL play
   `cast` for **800** ms. **Test layer: unit**
5. WHEN replicated `action=Die` with a new `actionSeq` THEN the client SHALL play
   `die` for **1200** ms before returning to locomotion clips. **Test layer: unit**
6. WHEN the remote avatar moves THEN its yaw SHALL face the movement direction
   (within ±5° of `atan2(dx, dz)`). **Test layer: unit**
7. WHEN `room.ts` receives `onChange` for a non-local `PlayerState` THEN it SHALL
   pass `x,y,z,action,actionSeq,equippedWeaponItemId` into the remote avatar sync.
   **Test layer: unit (room wiring mock) or integration via hook**

**Independent Test**: `remote-player-avatar.spec.ts` mirrors `player-avatar.spec.ts`
locomotion + action cases without `getGameState` target facing.

---

### P1: Bone Attachment Helper ⭐ MVP

**User Story**: As a developer, I want a single helper to parent a prop GLB to a
skeleton bone so weapons swing with attack clips for free.

**Why P1**: Foundation for player sword + goblin club; `create-attachment.md` recipe.

**Acceptance Criteria**:

1. WHEN `findBoneByName(root, name)` is called on a loaded KayKit character THEN it
   SHALL return the `THREE.Bone` whose `name` matches exactly (traversing
   `SkinnedMesh.skeleton.bones`). **Test layer: unit (fixture skeleton)**
2. WHEN `attachToBone(root, prop, boneName, transform)` runs THEN it SHALL
   `bone.add(prop)` and apply local `position`/`rotation`/`scale` from
   `transform` — the prop SHALL NOT receive its own `AnimationMixer`. **Test layer: unit**
3. WHEN `detachFromBone(prop)` runs THEN it SHALL `prop.removeFromParent()` without
   disposing the character mixer. **Test layer: unit**
4. WHEN the character plays `attack` THEN an attached prop's world matrix SHALL
   change between `idle` and mid-attack poses (inherits bone motion). **Test layer: unit (matrix delta)**

**Independent Test**: Vitest attaches a `THREE.Mesh` cube to a mock bone; asserts
parent chain and no mixer on prop.

---

### P1: Squire's Sword on Equipped Players ⭐ MVP

**User Story**: As a player, I want to see my Squire's Sword in my hand (and others'
swords in theirs) when equipped, matching the starter kit / inventory loop.

**Why P1**: ROADMAP + Phase 7 progression — equip is real server-side, visual payoff here.

**Acceptance Criteria**:

1. WHEN `getWeaponAttachment(2369)` is called THEN it SHALL return
   `{ model: '/models/props/SquiresSword.glb', bone: <KayKit hand bone>, transform }`.
   **Test layer: unit**
2. WHEN local `equippedWeaponItemId === 2369` THEN `player-avatar` SHALL load the
   prop once and attach it to the right-hand bone; WHEN it changes to `0` THEN the
   prop SHALL be detached. **Test layer: unit**
3. WHEN a remote player's replicated `equippedWeaponItemId === 2369` THEN their
   remote avatar SHALL show the same prop; WHEN `0` THEN no prop. **Test layer: unit**
4. WHEN `equippedWeaponItemId` is a positive unmapped id THEN no weapon prop SHALL
   render (no throw). **Test layer: unit**
5. WHEN the sword GLB is vendored THEN `LICENSE.txt` SHALL sit beside it if the
   pack provides one (AD-017). **Test layer: file check**

**Independent Test**: Unit-test equip toggle on stub mesh; manifest returns 2369 entry.

**L2J anchor**: item **2369** — "Squire's Sword", `type=Weapon`, `bodypart=rhand`,
`weapon_type=SWORD`, `pAtk=6` (gameplay already seeded; this phase is visual only).

---

### P1: Goblin Club on Goblin Mobs ⭐ MVP

**User Story**: As a player, I want Goblins to carry a club so they read as the
Classic mob, not empty-handed humanoids.

**Why P1**: Explicit ROADMAP carry-forward from Phase 10.

**Acceptance Criteria**:

1. WHEN a Goblin mob instance is created (`npcId=20003`) THEN the client SHALL
   attach `GoblinClub.glb` to the Goblin rig's right-hand bone using the same
   `attachToBone` helper. **Test layer: unit**
2. WHEN two Goblin instances exist THEN each SHALL have its own cloned prop object
   (not the same `Object3D` reference). **Test layer: unit**
3. WHEN the Goblin plays `attack` THEN the club's transform SHALL differ from idle
   (follows bone). **Test layer: unit (matrix delta)**
4. WHEN a non-Goblin mob (`npcId≠20003`) spawns THEN it SHALL NOT receive the club
   attachment. **Test layer: unit**

**Independent Test**: `mobs.spec.ts` asserts club child under hand bone for 20003 only.

**L2J anchor**: item **4** — "Club", `bodypart=rhand`, `weapon_type=BLUNT`, `pAtk=8`
(visual reference only).

---

### P1: Test Hook & E2E ⭐ MVP

**User Story**: As CI, I want to prove remote avatars are meshes with correct
animation clips without reading WebGL pixels.

**Why P1**: AD-009/AD-010 — logical gate is the only reliable multiplayer proof.

**Acceptance Criteria**:

1. WHEN `publishOthers` runs THEN `__GAME_STATE__.others[]` SHALL include for each
   remote player: `id`, `x`, `y`, `z`, `renderKind: 'mesh'`, `action` (clip string),
   `equippedWeaponId` (`number \| null`). **Test layer: unit (`test-hook.spec.ts`)**
2. WHEN browser A moves and browser B watches THEN B's `others` entry for A SHALL
   show `action === 'move'` while A is moving. **Test layer: e2e**
3. WHEN browser A stops THEN B SHALL eventually observe `others[].action === 'idle'`
   for A (coast timer elapses). **Test layer: e2e**
4. WHEN browser A leaves THEN B's `others` SHALL no longer contain A (existing
   multiplayer leave test remains green). **Test layer: e2e (regression)**

**Independent Test**: New `client-e2e/src/remote-avatar.spec.ts` (two-browser);
extends hook unit tests.

---

### P2: Visual Gate — Two Avatars + Sword ⭐ MVP (process)

**User Story**: As a reviewer, I want rendered frames of two humanoids (idle + attack)
with a sword visible before marking the phase done.

**Why P2**: AD-017 — green logical tests cannot substitute for weapon-in-hand review.

**Acceptance Criteria**:

1. WHEN `character-lab.html?weapon=2369&clip=idle` is rendered THEN a screenshot
   SHALL show the sword gripped in the right hand. **Test layer: visual gate**
2. WHEN `character-lab.html?weapon=2369&clip=attack` is rendered THEN the sword
   SHALL follow the swing arc. **Test layer: visual gate**
3. WHEN a two-avatar lab mode is rendered (local + offset duplicate or documented
   dual pose) THEN idle + attack frames SHALL be captured for human review.
   **Test layer: visual gate**
4. WHEN Goblin `npcId=20003` attack is rendered with club THEN the club SHALL be
   visible in the screenshot. **Test layer: visual gate**

**Independent Test**: `node scripts/shoot-character.mjs` with `LAB_WEAPON=2369` /
`LAB_MOB=20003`; human approval recorded in validation.md.

---

## Edge Cases

- WHEN a remote player's GLB fails to load THEN gameplay SHALL continue (avatar
  sync/update no-throw; same pattern as `player-avatar.ready.catch`).
- WHEN a player equips then unequips within one frame THEN at most one sword prop
  exists (no duplicate children).
- WHEN the same remote session receives duplicate `onAdd` THEN map upsert SHALL be
  idempotent (one avatar).
- WHEN `connected === false` on a player THEN they SHALL be excluded from `others`
  (existing `room.ts` filter preserved).
- WHEN attachment bone is missing (wrong manifest) THEN attach SHALL no-op without
  throwing (dev-visible `console.warn` acceptable).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| RPW-01 | P1: Remote Human Avatar | Design | Pending |
| RPW-02 | P1: Remote Human Avatar | Design | Pending |
| RPW-03 | P1: Remote Human Avatar | Design | Pending |
| RPW-04 | P1: Remote Human Avatar | Design | Pending |
| RPW-05 | P1: Remote Animation | Design | Pending |
| RPW-06 | P1: Remote Animation | Design | Pending |
| RPW-07 | P1: Remote Animation | Design | Pending |
| RPW-08 | P1: Remote Animation | Design | Pending |
| RPW-09 | P1: Remote Animation | Design | Pending |
| RPW-10 | P1: Remote Animation | Design | Pending |
| RPW-11 | P1: Remote Animation | Design | Pending |
| RPW-12 | P1: Bone Attachment | Design | Pending |
| RPW-13 | P1: Bone Attachment | Design | Pending |
| RPW-14 | P1: Bone Attachment | Design | Pending |
| RPW-15 | P1: Bone Attachment | Design | Pending |
| RPW-16 | P1: Squire's Sword | Design | Pending |
| RPW-17 | P1: Squire's Sword | Design | Pending |
| RPW-18 | P1: Squire's Sword | Design | Pending |
| RPW-19 | P1: Squire's Sword | Design | Pending |
| RPW-20 | P1: Squire's Sword | Design | Pending |
| RPW-21 | P1: Goblin Club | Design | Pending |
| RPW-22 | P1: Goblin Club | Design | Pending |
| RPW-23 | P1: Goblin Club | Design | Pending |
| RPW-24 | P1: Goblin Club | Design | Pending |
| RPW-25 | P1: Test Hook & E2E | Design | Pending |
| RPW-26 | P1: Test Hook & E2E | Design | Pending |
| RPW-27 | P1: Test Hook & E2E | Design | Pending |
| RPW-28 | P1: Test Hook & E2E | Design | Pending |
| RPW-29 | P2: Visual Gate | Design | Pending |
| RPW-30 | P2: Visual Gate | Design | Pending |
| RPW-31 | P2: Visual Gate | Design | Pending |
| RPW-32 | P2: Visual Gate | Design | Pending |

**Coverage:** 32 total, 32 mapped to tasks (T1–T15), 0 unmapped ✅

---

## Success Criteria

- [ ] Second browser sees a rigged humanoid remote player (not a capsule) that
      animates `idle`/`move` from replicated position and `action` from replicated
      signal.
- [ ] Equipping Squire's Sword (2369) shows the prop in hand for local and remote
      players; unequip removes it.
- [ ] Goblins spawn with a per-instance club that moves during attack.
- [ ] Visual gate screenshots reviewed; e2e + unit gate green (`nx run-many -t build lint test` + `nx e2e client-e2e`).
- [ ] No server gameplay regressions; AD-001/AD-015/AD-017 honored.
