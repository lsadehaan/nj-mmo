# Phase 12 — NPCs: Rigged Human GLBs Specification

## Problem Statement

The two Talking Island town NPCs (Katerina **30004**, Roxxy **30006**) still render as
procedural capsules with box heads (`client/src/scene/npc-renderer.ts`) while the
player, remote players, and mobs use rigged GLB meshes with skeletal animation (Phases
8–11, AD-017). Server placement, proximity interaction, shop, and helper dialog are
working (Phase 6); only the **client visual layer** is placeholder. This phase replaces
capsules with **distinct rigged human female** meshes that idle in place, with an
optional greet/talk gesture when the player interacts.

## Goals

- [ ] Introduce an **NPC manifest** keyed by `npcId` (30004, 30006) with model path,
      clip map, scale, and feet offset.
- [ ] Replace capsule NPC meshes with rigged GLB avatars driven by the existing
      `game-core` animation vocabulary (`idle` primary; optional greet via `cast` →
      `Interact` track on KayKit universal rig).
- [ ] **Katerina** (Merchant/Grocer) and **Roxxy** (Teleporter/Gatekeeper in L2J;
      Newbie Helper in MVP) each render as a visually distinct human female silhouette.
- [ ] Optional **greet gesture** fired client-side when interaction opens shop/dialog.
- [ ] Extend `__GAME_STATE__.npcs` for Playwright (`renderKind`, `action`).
- [ ] Mandatory **visual gate** (AD-017): both NPCs rendered idle (+ greet) and reviewed.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Server schema or gameplay changes | NPC positions and interact rules unchanged (AD-001); `NpcState` has no `action` field |
| NPC wandering / locomotion | L2J `MoveAroundSocial=0` for both; static idle only |
| Teleport (Roxxy's L2J role) | Still deferred; Roxxy remains helper dialog |
| Weapon/prop attachments on NPCs | Phase 11 pattern is player/mob only |
| Combat animations on NPCs | NPCs are non-attackable (`attackable=false` in L2J) |
| Additional NPCs beyond 30004/30006 | Vertical slice only |
| Mob or player rendering changes | Regression gate only |
| Proprietary L2 assets | AD-004 |
| Nameplates / quest markers above NPCs | Not in ROADMAP |

---

## Assumptions & Open Questions

The Planner cannot talk to the user; every ambiguity is resolved here.

| Assumption / decision | Chosen default | Rationale |
| --------------------- | -------------- | --------- |
| Asset sourcing | CC0 curated-first per AD-017 + `game-designer` `create-character.md` NPC note; inspect each GLB's real track names before committing `clipMap` | Never invent animation track names |
| Katerina model | KayKit **`Mage.glb`** (already under `client/public/models/characters/`) | Feminine low-poly silhouette; robes fit Grocer; universal rig with `Interact` track |
| Roxxy model | **Quaternius CC0 stylized female humanoid** (new GLB under `models/npcs/`) | KayKit Adventurers has one feminine hero (Mage); Roxxy must be visually distinct for the visual gate; Quaternius used for Wolf/Keltir in Phase 10 |
| Roxxy fallback pre-live | KayKit `Mage.glb` at different `scale` only if Quaternius ingest blocked — **not** acceptable for visual gate sign-off; Implementer must source distinct asset | AD-017 visual gate requires two distinguishable NPCs |
| GLB storage | `client/public/models/npcs/<Name>.glb` for Roxxy; Katerina reuses `models/characters/Mage.glb` | Mirrors `models/characters/` + `models/monsters/` layout |
| Manifest location | `client/src/scene/creature/npc-manifest.ts` keyed by `npcId` | Separate from mob `creature-manifest.ts` (humans ≠ monsters) |
| Instance strategy | `createMeshCharacter(url)` per NPC (two singleton spawns) | Not the mob clone path — only one instance per `npcId` exists |
| Clip map | `KAYKIT_CLIP_MAP` for Katerina; custom map for Roxxy if different rig; `cast` → asset's **`Interact`** (or nearest social track) for greet | KayKit Mage exposes literal `Interact` track (verified) |
| Greet trigger | **Client-only** when interaction UI opens (`shopOpen` or NPC dialog visible) after successful `interact` | Cosmetic only; no server authority change; ROADMAP "optional greet on proximity/interaction" |
| Greet duration | `ACTION_DURATION_MS[Cast]` from `game-core` (~600 ms) then return to `idle` | Reuses existing one-shot timing; hook reports `action: 'cast'` during greet |
| Greet facing | NPC group `rotation.y` faces player position at greet start | Readable social gesture; render-only |
| Unmapped `npcId` fallback | Keep capsule placeholder (`buildNpcMesh`) | Safe rollout beyond the two seeded NPCs |
| GLB load failure | Fall back to capsule for that NPC without crashing the render loop | Same pattern as mob mesh fallback (Phase 10) |
| Server Y semantics | `npc.y` from replicated state is body-center; manifest `feetOffsetY` drops mesh to ground (Phase 9 / player pattern) | Katerina L2J collision height **22.5** → ~**2.25 m** target bbox (AD-013 ÷10); Roxxy **23** → ~**2.3 m** |
| Seeded positions (unchanged) | Katerina **(−6, −8)**; Roxxy **(4, 10)** | Phase 6 `npc_spawns` fixtures |
| L2J identity anchors | Katerina: `type=Merchant`, `name=Katerina`, `title=Grocer`, `sex=FEMALE`; Roxxy: `type=Teleporter`, `name=Roxxy`, `title=Gatekeeper`, `sex=FEMALE` | Reference-only (AD-003); server already seeds names/types |
| Test hook shape | `npcs[].renderKind: 'mesh'`, `npcs[].action: AnimationClip` for mapped ids | AD-009 — DOM + hook, never pixels |
| Server tests | None new — regression gate only | No server gameplay change |
| Visual gate | Extend `character-lab.html?npc=30004` + `scripts/shoot-character.mjs` with `LAB_NPC` env; idle + greet (`cast`) frames per NPC | AD-017 mandatory review |

**Open questions:** none — all resolved or logged above.

**Implicit-requirement dimensions (Large feature):**

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | Interact proximity remains server-validated (Phase 6); greet is client-only after successful interact |
| Failure / partial-failure | GLB load failure → capsule fallback; greet skipped if mesh not ready |
| Idempotency / retry | Repeated interact while UI open does not stack greet (debounce by `actionSeq`-style local greet counter) |
| Auth boundaries | N/A — cosmetic client animation |
| Concurrency / ordering | Two static NPCs; no shared mutable server state |
| Data lifecycle | N/A — no persistence |
| Observability | `__GAME_STATE__.npcs[].action` + `renderKind` |
| External-dependency failure | Asset CDN/download failure → capsule + noted in visual gate |
| State-transition integrity | `idle` → greet (`cast`/`Interact`) → `idle` only |

---

## User Stories

### P1: NPC Manifest ⭐ MVP

**User Story**: As a developer, I want town NPC visuals selected by `npcId` from data,
not hardcoded role colors, so adding NPCs scales.

**Why P1**: Extension point for future town NPCs; mirrors Phase 10 creature manifest.

**Acceptance Criteria**:

1. WHEN `getNpcEntry(30004)` is called THEN it SHALL return an `NpcEntry` with `model`,
   `clipMap`, `scale`, `feetOffsetY`, and `displayName` **Katerina**. **Test layer: unit**
2. WHEN `getNpcEntry(30006)` is called THEN it SHALL return an `NpcEntry` with
   `displayName` **Roxxy**. **Test layer: unit**
3. WHEN `getNpcEntry` is called for an unknown `npcId` THEN it SHALL return `null`.
   **Test layer: unit**
4. WHEN each manifest `clipMap` is defined THEN keys `idle`, `move`, `attack`, `cast`,
   `die` SHALL map to **real** track names in that GLB (verified at asset-ingest).
   **Test layer: unit + visual gate**

**Independent Test**: Vitest asserts manifest rows and null fallback.

---

### P1: Rigged NPC Avatar ⭐ MVP

**User Story**: As a player, I want town NPCs to look like animated humans standing on
the ground, not capsules.

**Why P1**: Core ROADMAP deliverable.

**Acceptance Criteria**:

1. WHEN a mapped NPC syncs from server state THEN the client SHALL render a rigged GLB
   mesh (not `CapsuleGeometry` / box head). **Test layer: unit**
2. WHEN no locomotion occurs THEN the NPC SHALL play `idle` continuously. **Test layer:
   unit**
3. WHEN the NPC position updates from server THEN the mesh group SHALL sit at
   `(x, y - feetOffsetY, z)` per manifest. **Test layer: unit**
4. WHEN the GLB fails to load THEN the client SHALL fall back to the legacy capsule
   without throwing. **Test layer: unit**
5. WHEN `renderer.tick()` runs THEN each live NPC instance SHALL call
   `mixer.update(dt)`. **Test layer: unit**

**Independent Test**: Unit-test `npc-avatar` idle loop and position snap.

---

### P1: Replace Capsule Renderer ⭐ MVP

**User Story**: As the game loop, I want `syncNpc` / `removeNpc` to manage mesh avatars
instead of procedural capsules.

**Why P1**: Wires manifest + avatar into the existing Phase 6 NPC sync path.

**Acceptance Criteria**:

1. WHEN `syncNpcVisual` receives `npcId=30004` or `30006` THEN it SHALL create or
   update a mesh-backed group (userData `renderKind: 'mesh'`). **Test layer: unit**
2. WHEN `removeNpc` is called THEN the scene group and instance map entry SHALL be
   removed. **Test layer: unit**
3. WHEN both seeded NPCs are present THEN `npcStateToVisual` SHALL preserve `npcId`,
   role mapping (`Merchant` / `Helper`), and server coordinates. **Test layer: unit**
   (update existing `npc-renderer.spec.ts`)

**Independent Test**: Vitest on `npc-renderer` with mocked mesh factory.

---

### P1: Test Observability ⭐ MVP

**User Story**: As the test suite, I want to read each NPC's render kind and animation
clip from `__GAME_STATE__`, so Playwright can assert NPC behavior without pixels.

**Why P1**: AD-009; required gate per AGENTS.md.

**Acceptance Criteria**:

1. WHEN NPC meshes are live THEN `window.__GAME_STATE__.npcs` entries for **30004** and
   **30006** SHALL include `renderKind: 'mesh'`. **Test layer: e2e**
2. WHEN the game is idle in town THEN each mapped NPC's `action` SHALL be **`idle`**.
   **Test layer: e2e**
3. WHEN `renderer.tick()` updates NPC animations THEN hook `action` SHALL reflect the
   current clip vocabulary string. **Test layer: unit** (`test-hook` / renderer wiring)

**Independent Test**: E2E `town.spec.ts` polls `__GAME_STATE__.npcs` after join.

---

### P2: Greet / Talk Gesture ⭐ Should Have

**User Story**: As a player, I want NPCs to acknowledge interaction with a brief
gesture so the town feels alive.

**Why P2**: ROADMAP optional greet; low cost via KayKit `Interact` track.

**Acceptance Criteria**:

1. WHEN the player successfully opens Katerina's shop (`shopOpen === true`) THEN
   Katerina's hook `action` SHALL become **`cast`** at least once within **2 s** (maps
   to `Interact` track). **Test layer: e2e**
2. WHEN the player successfully opens Roxxy's helper dialog THEN Roxxy's hook `action`
   SHALL become **`cast`** at least once within **2 s**. **Test layer: e2e**
3. WHEN greet completes THEN the NPC SHALL return to **`idle`**. **Test layer: unit**
4. WHEN greet fires THEN the NPC SHALL face the player position (yaw toward player
   `x,z`). **Test layer: unit**
5. WHEN interact is spammed while UI is already open THEN greet SHALL NOT stack
   (at most one greet per UI open). **Test layer: unit**

**Independent Test**: Unit-test `triggerGreet` debounce; e2e buy-flow triggers Katerina
greet.

---

### P2: Visual Gate ⭐ Should Have

**User Story**: As the team, we need rendered proof that both NPCs look correct before
marking the phase done.

**Acceptance Criteria**:

1. WHEN `scripts/shoot-character.mjs` runs with `LAB_NPC=30004` and `LAB_NPC=30006`
   THEN it SHALL produce PNGs for **idle** and **cast** (greet) per NPC. **Test layer:
   manual/CI artifact**
2. WHEN the visual gate is reviewed THEN neither NPC SHALL be a capsule/box-head, and
   the two SHALL be visually distinct silhouettes. **Test layer: Verifier + human/vision
   check**
3. WHEN each NPC stands on the lab ground plane THEN feet SHALL not float/sink more
   than **0.15 m**. **Test layer: visual gate**

---

## Edge Cases

- WHEN an unmapped `npcId` syncs THEN the capsule fallback SHALL still work (role colors
  preserved).
- WHEN the player is far from NPCs THEN NPCs SHALL remain in `idle` (no proximity-only
  greet — greet requires interact UI open per assumption).
- WHEN Roxxy GLB uses a non-KayKit rig THEN its `clipMap` SHALL be independent (do not
  reuse `KAYKIT_CLIP_MAP` blindly).
- WHEN `npcs` map re-syncs position on `onChange` THEN mesh position SHALL update
  without recreating the instance.
- WHEN game joins before GLB `ready` resolves THEN idle SHALL begin once load completes
  (no permanent T-pose).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| NPCG-01 | P1 Manifest | Design | Pending |
| NPCG-02 | P1 Manifest | Design | Pending |
| NPCG-03 | P1 Manifest | Design | Pending |
| NPCG-04 | P1 Manifest | Design | Pending |
| NPCG-05 | P1 Avatar | Design | Pending |
| NPCG-06 | P1 Avatar | Design | Pending |
| NPCG-07 | P1 Avatar | Design | Pending |
| NPCG-08 | P1 Avatar | Design | Pending |
| NPCG-09 | P1 Avatar | Design | Pending |
| NPCG-10 | P1 Renderer | Design | Pending |
| NPCG-11 | P1 Renderer | Design | Pending |
| NPCG-12 | P1 Renderer | Design | Pending |
| NPCG-13 | P1 Observability | Design | Pending |
| NPCG-14 | P1 Observability | Design | Pending |
| NPCG-15 | P1 Observability | Design | Pending |
| NPCG-16 | P2 Greet | Design | Pending |
| NPCG-17 | P2 Greet | Design | Pending |
| NPCG-18 | P2 Greet | Design | Pending |
| NPCG-19 | P2 Greet | Design | Pending |
| NPCG-20 | P2 Greet | Design | Pending |
| NPCG-21 | P2 Visual gate | Design | Pending |
| NPCG-22 | P2 Visual gate | Design | Pending |
| NPCG-23 | P2 Visual gate | Design | Pending |

**ID format:** `NPCG-[NUMBER]`
**Coverage:** 23 total (15 P1, 8 P2); mapping to tasks in `tasks.md`.

---

## Success Criteria

- [ ] Katerina and Roxxy render as rigged human females (no capsule/box-head) idling
      at seeded positions.
- [ ] Optional greet plays on shop/dialog open; returns to idle.
- [ ] Server authority preserved (AD-001): no gameplay logic changes; positions still
      from `NpcState`.
- [ ] Gate green: `nx test client`, `nx e2e client-e2e` (town NPC assertions); server
      regression `nx test server`.
- [ ] Visual gate captures idle + greet for both NPCs (AD-017).
- [ ] Phase 6 interact anchors unchanged: Katerina at (−6, −8), Roxxy at (4, 10), buy
      potion **1000 → 897** adena.
