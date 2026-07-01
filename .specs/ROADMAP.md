# MVP Roadmap — Browser MMO (Talking Island vertical slice)

> **Autonomous loop source of truth.** The `/loop` reads this file each
> iteration (goal + sub-items); the Planner sub-agent derives the full
> implementation by researching the codebase, `STATE.md` decisions, `AGENTS.md`,
> and the L2J Classic reference tree. Checkboxes flip to `[x]` only when a
> Verifier PASS is recorded in `.specs/features/<feature>/validation.md`.
>
> **MVP (Phases 1–18): complete.** **Post-MVP TI completion (Phases 19–29):**
> eleven phases through UI shell — public deployment explicitly excluded.
> **Phase 30 (visual fidelity upgrade): renderer/lighting/shadow/fog polish.**

High-level roadmap for the MVP. Each phase ends in something runnable and is
built through the `spec-driven-execution` flow (Planner → Implementer →
Verifier). Check an item only when its Verifier pass is recorded in
`.specs/features/<feature>/validation.md`.

**Legend:** `[ ]` not started · `[~]` in progress · `[x]` done (Verifier PASS)

**Hard dependency order (MVP):** Phase 3 (server authority) must precede combat and
skills. Town + NPCs (Phase 6) depend on combat + peace zone existing first.
Never run phases in parallel.

**Hard dependency order (Post-MVP 19–29):** Phases 19–20 (character + skills)
before 21 (quests) and 27 (progression). Phase 23 (world) before or alongside
22 (bestiary spawn placement). See the Post-MVP section header for the full chain.
Never run phases in parallel.

---

## Phase 1 — Foundation `[x]`

> Done when: `npm run dev` boots an empty server + client that talk; seed script populates the DB from L2J Classic XML.

- [x] Nx monorepo (`server/` + `client/` + `client-e2e/`)
- [x] Colyseus dev loop + Vite client + `npm run dev`
- [x] SQLite + Drizzle schema
- [x] Seed script: 4 mobs, 2 NPCs, Power Strike, XP curve (authentic Classic values)
- [x] Client connects to `TownRoom`; `window.__GAME_STATE__` test hook

## Phase 2 — Town & World (render) `[x]`

> Done when: you can walk the town and field, single-player.

- [x] Low-poly flat-shaded heightmap terrain
- [x] Village (ground patch, ~5 buildings, peace-zone marker)
- [x] Scattered trees/rocks + surrounding field
- [x] Click-to-move (ground raycast) + L2-style follow camera

## Phase 3 — Authoritative server + multiplayer `[x]`

> Done when: two browsers see each other moving; characters resume on reconnect.

- [x] Move movement to the server (client sends intent; server validates + broadcasts)
- [x] Migrate the pure `step()` into the `TownRoom` tick (per AD-008)
- [x] Render other players from room state
- [x] Persist character (position, HP/MP, XP, level) to DB; resume on reconnect

## Phase 4 — Combat on the server `[x]`

> Done when: killing a mob grants real server-validated XP — no client trust.

- [x] Server-side melee: target, range, attack speed, damage formula (from L2J)
- [x] Mob spawning from seed: aggro, wander, retaliate
- [x] Death, timed respawn
- [x] Server-granted XP + drops (seeded RNG)

## Phase 5 — The skill `[x]`

> Done when: pressing the key deals Power Strike's damage with a visible cooldown.

- [x] Server validates MP cost + cooldown; applies effect
- [x] Client hotkey + cooldown UI + simple flash/particle

## Phase 6 — NPCs & functional town `[x]`

> Done when: you reach an NPC, open the shop, buy an item, and cannot be attacked in town.

- [x] Place + render the 2 NPCs (Merchant, utility NPC) with proximity interaction
- [x] Merchant shop window: buy/sell from seeded item list
- [x] Utility NPC dialog + useful action (heal / starter item)
- [x] Enforce peace zone (no combat in town)

## Phase 7 — Progression loop `[x]`

> Done when: a player can create a character, claim the starter kit, equip a weapon,
> kill a mob, level up, die and respawn in town, and buy an item — all running locally.
> Public deployment is deferred post-MVP.

- [x] Basic inventory + gold + equip weapon
- [x] Death/respawn in town; level-up reward

---

## Post-MVP — Asset Pipeline (rigged GLTF, curated-then-AI)

> Goal: build all visual assets (characters, mobs, NPCs, animations) from
> **license-clean rigged GLTF meshes** with skeletal animation (AD-017,
> superseding AD-005's procedural-primitives-only rule). Curated CC0 packs first
> (KayKit/Quaternius/Mixamo) with a shared animation vocabulary; AI mesh
> generation as a later per-entity variety layer. Data → manifest (`model` GLB +
> `clipMap`); the `game-core` animation state machine still decides _which_ clip;
> validation is layered (deterministic unit + `__GAME_STATE__` e2e in CI) **plus a
> mandatory rendered visual gate** (`client/character-lab.html` +
> `scripts/shoot-character.mjs`) reviewed before any character phase is `[x]`.

## Phase 8 — Player character: procedural humanoid rig + action animation `[x]`

> Done when: the local player renders as an articulated low-poly humanoid (no
> capsule) that idles, walks/faces travel direction, attacks, casts, and dies —
> all driven by a server-replicated render-only action signal. Establishes the
> reusable rig contract + pure animation state machine (AD-015, AD-016).
> Spec: `.specs/features/phase-8-character-rig-animation/`.

- [x] Shared `EntityAction` enum + pure animation state machine (`game-core`)
- [x] Render-only `action`/`actionSeq` on `PlayerState`; server sets on attack/skill/death
- [x] `__GAME_STATE__.player.action` + Playwright transitions (idle→move→idle→attack→cast)
- [~] **Superseded by AD-017**: procedural primitive rig replaced by a rigged GLTF
  backend (`mesh-character.ts`: `GLTFLoader` + `AnimationMixer`). Player avatar =
  KayKit **Rogue** (CC0, beginner leather look); clip map idle/move/attack/cast/die
  → KayKit tracks. (Knight/Mage/Hooded/Barbarian GLBs also vendored, same rig.)
  Locomotion fixed (coast-timer, no flicker / no stuck-move). Procedural
  `humanoid`/`clips`/`animator`/`rig-contract` removed.
- [x] Visual gate built + used (`character-lab.html`, `scripts/shoot-character.mjs`)

### Known follow-ups (player character)

- GLB load is async → ~1s avatar pop-in at spawn (add a placeholder or preload).
- Spawn tile (0,0) overlaps a village decoration; reads cluttered until you move.
- Follow camera is far → hero reads small; consider a closer camera or larger scale.
- Apply the same GLTF backend to remote players, mobs, and NPCs (still capsules).

## Phase 9 — Terrain walkability & collision `[x]`

> Done when: characters follow terrain height, cannot walk through cliffs or
> buildings, and click-to-move routes **around** obstacles with the server
> validating every step. Supersedes the AD-006 trade-off ("no collision") for the
> MVP heightmap world; **L2J geodata (Tier 4) stays deferred.**
> Spec: `.specs/features/phase-9-terrain-walkability/`.
>
> **Depends on:** Phases 2–4 (heightmap renderer, authoritative movement, mob AI).

### Tier 1 — Height snapping (feet on ground)

- [x] Move `generateTerrain` / `sampleHeight` into `libs/game-core` (shared
      `TERRAIN_SEED`, size, segments, `heightScale`; client imports from lib)
- [x] Server sets `player.y = sampleHeight(x, z) + FEET_OFFSET` each movement tick
- [x] Mobs and NPCs use the same height rule on spawn and during AI movement
- [x] `SPAWN_Y` derived from shared terrain (no client/server drift)
- [x] Unit tests: `sampleHeight` deterministic; Y snap at arbitrary `(x, z)`

### Tier 2 — Walkability & blockers (no walking through geometry)

- [x] `isWalkable(from, to)` in `game-core`: max step height, max slope (from
      terrain gradient), world bounds (existing `WORLD_MIN`/`WORLD_MAX`)
- [x] Hand-authored blocker volumes for village buildings + large props (circles
      or AABBs in shared data; same coords as `village.ts` / `scatter.ts`)
- [x] `TownRoom.simulate()` clamps or rejects moves that fail `isWalkable`
- [x] Mob wander/aggro chase respects `isWalkable` (no mobs through cliffs)
- [x] Room-integration tests: move into cliff/building does not change `x,z`

### Tier 3 — Navmesh pathfinding (route around obstacles)

- [x] Bake a walkability grid (1 m cells) or lightweight navmesh from heightmap +
      slope limits + blocker volumes
- [x] Deterministic A\* in `game-core` (no client trust; prefer zero new deps)
- [x] Click-to-move: client pathfinds for preview/UX; server recomputes path and
      follows waypoints in `step()` (not a straight line to final click)
- [x] Server validates each waypoint segment with `isWalkable` before advancing
- [x] E2E via `__GAME_STATE__`: click behind a building routes around it (position
      trail never intersects blocker)

### Out of scope (Phase 9)

| Feature                                  | Reason                                                   |
| ---------------------------------------- | -------------------------------------------------------- |
| L2J geodata / NSWE cell parsing (Tier 4) | Heavy; authentic L2 collision deferred post-MVP (AD-006) |
| Client-side prediction / interpolation   | Deferred per Phase 3 spec                                |
| Dynamic destructible terrain             | Not needed for TI vertical slice                         |

---

## Asset & animation backlog (AD-017, built with the `game-designer` skill)

> Every phase below produces rigged-GLTF / visual assets (AD-017) driven by the
> `game-core` animation state machine, and **must be built with the
> `.cursor/skills/game-designer` skill** — read its `SKILL.md` first, then the one
> recipe that matches the task: `create-character` (player/remote/NPC),
> `create-monster` (mobs), `create-attachment` (weapons/held items), `create-vfx`
> (effects), `create-icon` (UI icons), `create-prop` (environment). Each phase names
> its recipe in a **Skill:** line below.
>
> **Fidelity is law (skill golden rule 2).** Each asset must be the closest available
> representation of the _specific_ entity — a Gremlin looks like a gremlin, a house
> like a house. The source pack is not approval: a legal-but-wrong asset FAILs.
> Never substitute a wrong-category default or copy another entity's GLB; if a match
> can't be sourced, search harder / create one high-quality / halt. _License_ may be
> relaxed pre-live (tracked placeholders OK); _fidelity_ may not.
>
> **The visual gate is BLOCKING and two-layered** — no phase flips to `[x]` until
> both pass: (1) **structural** `node scripts/visual-gate.mjs` (dedup, static-vs-rigged,
> no creature bones in props, no empty stubs), and (2) **fidelity/perception** —
> render via `client/character-lab.html` + `scripts/shoot-character.mjs` and actually
> _look_, judging each asset against the entity description. A captured screenshot
> nobody perceived is not evidence (the Phase 8 + Phase 10/15 lesson).
>
> **Shared clip vocabulary:** `idle | move | attack | cast | die` (`AnimationClip`);
> server signals are `EntityAction { None, Attack, Cast, Die }`, locomotion is
> derived client-side. Each entity maps a subset of these to its GLB tracks.

## Phase 10 — Monsters: rigged GLB mobs + clone-per-instance `[x]`

> Done when: the 4 seeded mobs render as distinct rigged creatures (no capsules)
> that idle, move, attack, and die from the server's `action`/`actionSeq` signal,
> with many instances spawned cheaply (load-once, clone-per-spawn).
>
> **Depends on:** Phase 4 (mob AI/spawning), Phase 8 (mesh-character backend).
>
> **Skill:** `game-designer` → `references/create-monster.md` (read `create-character.md` first).

- [x] Clone-per-instance creature backend (`SkeletonUtils.clone`, load each GLB
      once, independent `AnimationMixer` per spawn) — extends `mesh-character.ts`
- [x] `npcId`-keyed creature manifest (`model` GLB + `clipMap`) replacing the
      capsule in `mobs.ts`
- [x] **Gremlin** (20001, fairy biped) GLB — idle/move/attack/die
- [x] **Goblin** (20003, humanoid biped, club) GLB — idle/move/attack/die
- [x] **Wolf** (20120, animal quadruped) GLB — idle/move/attack/die
- [x] **Bearded Keltir** (20481, animal quadruped) GLB — idle/move/attack/die
- [x] Mob `action`/`actionSeq` replicated like `PlayerState` (server sets on
      attack/death); client drives clips via the animation state machine
- [x] Keep floating HP bars; per-mob scale/facing tuned
- [x] Visual gate: each mob rendered (idle + attack + die) and reviewed
- [x] Room-integration test: mob attack/death sets `action`; e2e exposes mob
      `action` via `__GAME_STATE__`

## Phase 11 — Remote players & equipped weapons `[x]`

> Done when: other players render as the rigged human avatar (no capsule) with the
> same idle/move/attack/cast/die set, and an equipped weapon (Squire's Sword) shows
> in the character's hand.
>
> **Depends on:** Phase 8 (player avatar), Phase 3 (remote player state).
>
> **Skill:** `game-designer` → `references/create-character.md` (Remote-player note) + `references/create-attachment.md` (weapons).

- [x] Remote players reuse the `mesh-character` backend (replace `remote-players.ts`
      capsule); locomotion derived from replicated position, action from state
- [x] Hand socket on the humanoid rig + weapon-attach helper
- [x] **Squire's Sword** (2369) prop GLB attached to the player's right hand
- [x] **Goblin Club** (item 4) attached to the Goblin mob (carries Phase 10)
- [x] Visual gate: two-avatar scene (idle + attack) reviewed
- [x] E2E: second session renders a non-capsule avatar with the correct action

## Phase 12 — NPCs: rigged human GLBs `[x]`

> Done when: the 2 town NPCs render as rigged humans (no capsule/box-head) that
> idle, with an optional greet/talk gesture on interaction.
>
> **Depends on:** Phase 6 (NPC placement + interaction), Phase 8 (mesh backend).
>
> **Skill:** `game-designer` → `references/create-character.md` (NPC note).

- [x] NPC creature manifest (human female GLBs) replacing `npc-renderer.ts` capsule
- [x] **Katerina** (30004, Merchant/Grocer) — idle (+ optional talk)
- [x] **Roxxy** (30006, Teleporter/Gatekeeper) — idle (+ optional talk)
- [x] Optional greet gesture fired on proximity/interaction
- [x] Visual gate: both NPCs rendered and reviewed

## Phase 13 — Combat & world VFX `[x]`

> Done when: combat reads clearly — melee impacts, deaths, level-ups, target
> selection, and a real Power Strike effect — replacing the placeholder primitives.
>
> **Depends on:** Phases 4–5 (combat + skill), Phase 10 (mobs).
>
> **Skill:** `game-designer` → `references/create-vfx.md`.

- [x] Replace primitive `skill-flash.ts` with a proper **Power Strike** VFX
- [x] **Melee hit/impact** effect on damage application
- [x] **Death** effect (dissolve/fade) layered on the `die` clip
- [x] **Level-up** burst on reward
- [x] **Target selection** ring/indicator under the focused mob
- [x] (Optional) **Soulshot** charged-attack glint
- [x] (Optional) **Ground loot drop** marker rendered before pickup
- [x] Visual gate: each effect captured and reviewed

## Phase 14 — UI / 2D iconography `[x]`

> Done when: the hotbar, shop, and inventory show real icons instead of text/colour
> swatches.
>
> **Skill:** `game-designer` → `references/create-icon.md`.

- [x] **Power Strike** skill icon in the hotbar/cooldown UI
- [x] Shop/inventory item icons: Healing Potion (1060), Soulshot No-grade (1835),
      Wooden Arrow (17), Squire's Sword (2369), Adena (57)
- [x] (Lower priority) icons for loot-table items (rings, recipes, materials)
- [ ] (Lower priority) icons for loot-table items (rings, recipes, materials)

## Phase 15 — Environment art upgrade (optional) `[x]`

> Done when: village buildings, trees, rocks, and the peace-zone marker use cohesive
> low-poly GLB props instead of raw primitives (style consistent with characters).
> Lowest priority — current primitives are acceptable for the slice.
>
> **Skill:** `game-designer` → `references/create-prop.md`.

- [x] Village building GLBs (5) replacing `addBox` in `renderer.ts`
- [x] Tree + rock prop GLBs replacing cone/cylinder/dodecahedron
- [x] Peace-zone marker prop
- [x] Visual gate: town overview reviewed

---

## Phase 16 — Talking Island mob expansion (+5) `[x]`

> Done when: five additional **authentic Talking Island** mobs (seed stats, drops,
> spawns, rigged GLBs) are playable end-to-end — killable on the server, visible
> as distinct creatures on the client, placed in level-appropriate field rings
> outside the peace zone.
>
> **Depends on:** Phase 4 (mob AI/combat/spawn), Phase 9 (walkability for spawn
> placement), Phase 10 (clone-per-instance creature backend + manifest).
>
> **Skill:** `game-designer` → `references/create-monster.md` (read
> `create-character.md` first). One asset task per mob; reuse Phase 10 backend
> (no new animation architecture).

### Selection (next 5 missing by TI level)

Sourced from L2J Classic `spawns/TalkingIsland/TalkingIslandMonsters.xml` +
`stats/npcs/*.xml`. The MVP already seeds **Gremlin** (20001), **Bearded Keltir**
(20481), **Wolf** (20120), and **Goblin** (20003) with GLBs (Phase 10). Those
four cover lv 1 / 4 / 5 but omit several **TI-native** types at the same tiers.
The next five **TI spawn-table** mobs by ascending level not yet in the DB or
manifest:

| npcId | Name | Lv | Silhouette | TI spawn role |
| ----- | ---- | -- | ---------- | --------------- |
| 20432 | Elpy | 1 | Small passive quadruped | Near-village starter fodder |
| 20544 | Elder Keltir | 3 | Quadruped (Keltir family) | First step up from Bearded Keltir |
| 20442 | Elder Wolf | 5 | Quadruped (Wolf family) | Mid-field wolf pack |
| 20121 | Giant Toad | 5 | Amphibian / bulky quadruped | Swamp-adjacent field ring |
| 20130 | Orc | 6 | Humanoid biped | Outer-field humanoid tier |

*(Next batch after this phase, for reference: Orc Soldier 20131 lv7, Goblin Scout
20326 lv8, Orc Archer 20006 lv8, Werewolf 20132 lv9 …)*

### Scope (full pipeline per mob)

Each mob runs the same end-to-end path Phase 10 established — executed via
`spec-driven-execution` (Planner → Implementer → Verifier):

1. **Seed (server authority)** — extend `TI_MOB_IDS` in `server/src/seed/paths.ts`;
   parse authentic stats + drop tables from L2J XML (`monsters.parser`,
   `drops.parser`); add spawn rows (hand-map TI territory centroids → simplified
   `(x, z)` rings on our heightmap, walkable + outside peace zone). Seed-data
   tests assert Classic values per npcId.
2. **Visual asset (`create-monster`)** — source a **fidelity-first** rigged GLB
   per entity (CC0 packs: Quaternius Ultimate Monsters / Ultimate Animated Animals;
   `scripts/import-pack-assets.mjs` where applicable). Inspect track names;
   per-family `clipMap`; tune scale / feet offset / HP-bar height. Mandatory
   two-layer visual gate (`visual-gate.mjs` + `character-lab` screenshots).
3. **Client manifest** — one `CreatureEntry` row per npcId in
   `creature-manifest.ts`; extend unit tests (`SEEDED_NPC_IDS` → nine ids).
4. **Runtime** — no new renderer architecture: existing clone-per-instance +
   server `action`/`actionSeq` on `MobState`; capsule fallback only for unmapped
   ids during rollout.
5. **Verification** — room-integration: spawn + attack/death sets mob `action`;
   e2e: `__GAME_STATE__.mobs` exposes new types after field walk; Nx affected
   gate green.

### Checklist

- [ ] Planner: `.specs/features/phase-16-ti-mob-expansion/` (`spec.md`, `design.md`,
      `tasks.md`) — ACs mapped to seed / unit / room / e2e layers
- [ ] **Elpy** (20432) — seed + GLB + manifest + field spawns
- [ ] **Elder Keltir** (20544) — seed + GLB + manifest + field spawns
- [ ] **Elder Wolf** (20442) — seed + GLB + manifest + field spawns
- [ ] **Giant Toad** (20121) — seed + GLB + manifest + field spawns
- [ ] **Orc** (20130) — seed + GLB + manifest + field spawns
- [ ] Spawn layout: lv1–3 near existing Keltir ring; lv5–6 in outer field bands
      (progression feel: walk east/south from village → harder mobs)
- [ ] Visual gate: all five mobs rendered (idle + attack + die) and reviewed
- [ ] Verifier PASS recorded in `.specs/features/phase-16-ti-mob-expansion/validation.md`

### Out of scope

| Feature | Reason |
| ------- | ------ |
| L2J geodata / exact TI world coordinates | AD-006; keep simplified `(x,z)` rings |
| Mob weapon attachments (Orc axe, etc.) | Defer to a later attachment pass (Phase 11 pattern) |
| Replacing Gremlin/Goblin with TI-only roster | MVP seed ids stay; this phase **adds** TI-native types |
| Mobs beyond these five | Next roadmap batch (Orc Soldier onward) |

---

## Phase 17 — Talking Island NPC expansion (+5) `[x]`

> Done when: five additional **canonical Talking Island town** NPCs are seeded,
> placed in the village peace zone, rendered as distinct rigged human GLBs, and
> interactable with at least a dialog shell (shop where L2J type = Merchant;
> utility dialog for Warehouse / trainer types).
>
> **Depends on:** Phase 6 (NPC interaction + shop plumbing), Phase 12 (rigged
> NPC manifest + greet gesture).
>
> **Skill:** `game-designer` → `references/create-character.md` (NPC note).

### Selection (next 5 missing TI town services)

Sourced from L2J Classic `spawns/Gludio/Gludio.xml` (Talking Island town cluster,
coords ≈ `x −71000..−87000, y 240000..246000`) + `stats/npcs/30000-30099.xml`.
The MVP already has **Katerina** (30004, Grocer) and **Roxxy** (30006,
Gatekeeper / Newbie Helper). The next five **service NPCs** by starter-town
priority — completing the weapon/armor/accessory shop triangle plus storage and
the iconic fighter trainer:

| npcId | Name | L2J type | Title | MVP interaction |
| ----- | ---- | -------- | ----- | ----------------- |
| 30001 | Lector | Merchant | Weapon Merchant | Buy/sell weapons (seed L2J buylist subset) |
| 30002 | Jackson | Merchant | Armor Merchant | Buy/sell armor (seed buylist subset) |
| 30003 | Silvia | Merchant | Accessory Merchant | Buy/sell accessories (seed buylist subset) |
| 30005 | Wilford | Warehouse | Warehouse Keeper | Dialog + deposit/withdraw stub *(or “coming soon”)* |
| 30026 | Bitz | VillageMasterFighter | Grand Master | Trainer dialog shell *(class change deferred)* |

*(Next batch after this phase: High Priest Biotin 30031, guards 30039–30046,
folk trainers 30027–30036 …)*

### Scope (full pipeline per NPC)

Executed via `spec-driven-execution` (Planner → Implementer → Verifier):

1. **Seed (server)** — extend `TI_NPC_IDS` in `server/src/seed/paths.ts`; parse
   npc defs from L2J XML; add `npc_spawns` rows (hand-map Gludio spawn coords →
   village `(x, z)` inside peace zone, non-overlapping with existing buildings).
   For merchants **30001–30003**: seed `merchant_items` from L2J buylists
   (`3000101.xml`, `3000201.xml`, `3000301.xml`) — MVP subset per Phase 6 pattern.
2. **Visual asset (`create-character` NPC note)** — one rigged human GLB per NPC;
   distinct silhouette (weapon merchant ≠ armor merchant ≠ accessory merchant);
   `npc-manifest.ts` row with `clipMap`, scale, feet offset, `displayName`.
   Mandatory visual gate (idle + greet/cast).
3. **Interaction** — reuse Phase 6 proximity + `interact` flow:
   - Merchants open shop window keyed by `npcId` (extend `shop-window.ts` beyond
     Katerina-only constant).
   - Warehouse / trainer: dialog panel with placeholder actions (no warehouse DB
     or class change yet — server rejects unsupported actions safely).
4. **Client** — extend `__GAME_STATE__.npcs` coverage; e2e asserts all seven TI
   NPCs render `renderKind: 'mesh'` when manifest rows exist.
5. **Verification** — seed-data tests per npcId; room-integration buy at Lector;
   e2e walk village and interact with at least one new merchant.

### Checklist

- [ ] Planner: `.specs/features/phase-17-ti-npc-expansion/` (`spec.md`, `design.md`,
      `tasks.md`)
- [ ] **Lector** (30001) — seed + buylist + spawn + GLB + shop wiring
- [ ] **Jackson** (30002) — seed + buylist + spawn + GLB + shop wiring
- [ ] **Silvia** (30003) — seed + buylist + spawn + GLB + shop wiring
- [ ] **Wilford** (30005) — seed + spawn + GLB + dialog shell
- [ ] **Bitz** (30026) — seed + spawn + GLB + trainer dialog shell
- [ ] Village layout: place five NPCs around existing Katerina/Roxxy without
      blocker overlap (Phase 9 `world-blockers.ts`)
- [ ] Visual gate: all five NPCs rendered (idle + greet) and reviewed
- [ ] Verifier PASS in `.specs/features/phase-17-ti-npc-expansion/validation.md`

### Out of scope

| Feature | Reason |
| ------- | ------ |
| Full warehouse storage / item deposit | Separate feature; dialog stub only |
| Class change / skill learning (Bitz) | Progression system deferred post-MVP |
| Teleport destinations (Roxxy L2J role) | Still deferred |
| Guards with patrol AI | Static idle NPCs only (Phase 12 pattern) |
| NPCs beyond these five | Next roadmap batch |

---

## Phase 18 — Consumable item use (Healing Potion) `[x]`

> Done when: a player can **use** a Healing Potion (item **1060**) from inventory
> — server validates ownership, applies authentic L2J healing, decrements count,
> enforces reuse delay — with inventory UI + optional hotkey and e2e proof.
>
> **Depends on:** Phase 6–7 (inventory, buy/grant potions), Phase 14 (potion icon).
>
> **Skill:** none (gameplay/UI; reuse existing potion icon from Phase 14).

### Problem

Healing Potions are buyable (Katerina) and granted (Roxxy starter kit) but
**not usable** — the only HP restore today is Roxxy's full heal dialog. Classic
gameplay expects in-field recovery via consumables.

### L2J anchor (item 1060 → skill 2031)

From `stats/items/01000-01099.xml` + `stats/skills/02000-02099.xml`:

| Property | Classic value |
| -------- | ------------- |
| Item | **1060** Healing Potion, `etcitem_type=POTION`, stackable |
| Effect skill | **2031** Healing Potion — `HealOverTime` **power 8**, **ticks 3**, **abnormalTime 15s** |
| Reuse delay | **10s** (`reuse_delay` on item) |

MVP may implement HoT tick-by-tick on the server tick **or** a single server
grant of `8 × 3 = 24` HP per use — Planner picks the simpler option that stays
spec-anchored; instant full-heal is **not** acceptable.

### Scope (full pipeline)

Via `spec-driven-execution`:

1. **Server authority (`AD-001`)** — new Colyseus intent `useItem { itemId }`:
   - Reject if item not consumable / not in inventory / count ≤ 0.
   - Reject if reuse cooldown active (per-item, per-character, server clock).
   - Reject in peace zone **optional** — default **allow** (potions usable in town).
   - Apply heal: `hp = min(maxHp, hp + healAmount)` per tick or per use per spec.
   - Decrement `character_items` count; sync `PlayerState`; persist debounced.
   - Pure function `applyConsumable(...)` in `@nj/game-core` or `server/` with
     unit tests anchored to skill 2031 values.
2. **Client** — inventory row **Use** button for `type=consumable` items; optional
   assign potion to a consumable hotkey slot (lower priority than Use button).
   Send `useItem` intent; reflect cooldown in UI if server exposes reuse timestamp.
3. **Test layers** — unit (heal math + cooldown); room-integration (use reduces
   count, raises HP, rejects double-use within 10s); e2e (take field damage →
   open inventory → use potion → `__GAME_STATE__.hp` increases, count decreases).
4. **Regression** — Roxxy heal + shop buy/sell unchanged; equip still rejects 1060.

### Checklist

- [ ] Planner: `.specs/features/phase-18-consumable-use/` (`spec.md`, `design.md`,
      `tasks.md`)
- [ ] `applyConsumable` / potion heal pure logic + unit tests (skill 2031 values)
- [ ] Server `useItem` handler in `TownRoom` + reuse cooldown tracking
- [ ] Inventory UI **Use** action + `window.__useItem__` test hook
- [ ] Room-integration: use potion, cooldown reject, out-of-stock reject
- [ ] E2E: damage → use potion → HP/count assertions via `__GAME_STATE__`
- [ ] Verifier PASS in `.specs/features/phase-18-consumable-use/validation.md`

### Out of scope

| Feature | Reason |
| ------- | ------ |
| Mana potions / soulshots as consumables | Healing Potion only for this phase |
| Cast bar / interrupt on damage | MVP instant/HoT server apply suffices |
| Auto-use hotbar slot | Optional stretch; Use button is MVP |
| MP potions, buff scrolls, other etcitems | Future consumable pass |

---

## Post-MVP — Complete Talking Island (Phases 19–29)

> **Goal:** Close the gap between the Phase 1–18 vertical slice and an authentic
> L2J Mobius Classic Talking Island experience — races/classes, skill trees,
> quests, full bestiary, real geography, town services, economy, social, PvP
> rules, and a complete client shell. **Local only** — public deployment is
> explicitly out of scope (former Epic 12).
>
> **Test gate (AGENTS.md):** Three layers only — unit (server + client), room
> integration, seed/data. **No Playwright / browser e2e.** Client wiring is proven
> via `wireRoom` unit tests and `__GAME_STATE__` mapping; game outcomes via room
> tests with `NJ_AUTOSIM=0` + `tick()`/`deliver()` (AD-014). Phases 1–18 may
> mention Playwright historically; that layer has been removed.
>
> **Hard dependency order:** Phases 19–20 (character + skills) unlock 21 (quests)
> and 27 (progression). Phase 23 (world) should land before or alongside 22
> (bestiary spawn placement). Never run phases in parallel.

**Legend:** `[ ]` not started · `[~]` in progress · `[x]` done (Verifier PASS)

---

## Phase 19 — Character creation & classes `[x]`

> Done when: a new player picks race/gender/class at creation; base stats (STR/DEX/
> CON/INT/WIT/MEN) and HP/MP curves differ by class; avatar reflects the choice;
> existing combat/XP uses class stats server-side.
>
> **Depends on:** Phases 1–18 (MVP scaffold).
>
> **Skill:** `game-designer` → `create-character.md` (per-class avatars).

### Scope

- Character creation screen (Human Fighter/Mystic, Elf, Dark Elf, Orc, Dwarf paths).
- Server: class template from L2J `stats/chars/*`; persist race/class on character row.
- Client: creation UI + class-appropriate starter appearance (manifest per class).
- Room tests: stat anchors per class; client unit: creation flow updates
  `__GAME_STATE__` via `wireRoom`.

### Out of scope

| Feature | Reason |
| ------- | ------ |
| 1st class transfer (Village Master) | Phase 24 (trainer wiring) + Phase 20 (skill learn) |
| Subclasses / dual class | Post-TI |
| Face/hair customization beyond class pick | Cosmetic stretch |

---

## Phase 20 — Skills & combat depth `[x]`

> Done when: each starter class has a learnable skill subset (not just Power Strike);
> MP/cooldown/reuse validated server-side; soulshots consumed for damage bonus;
> magic cast path exists for mystics; buffs/debuffs on a minimal effect system.
>
> **Depends on:** Phase 19 (class identity), Phase 4–5 (combat resolver baseline).

### Scope

- Skill learning at trainers (Bitz + folk trainers — dialog → `learnSkill` intent).
- Generalize skill resolver beyond skill **3**; seed TI-relevant skills from L2J XML.
- Soulshot/spiritshot as functional consumables (item **1835** already icon'd).
- Cast bar + interrupt-on-hit for magic; crit/evasion from L2J formulas where seeded.
- Unit tests per skill anchor; room tests per intent; client unit: skill hotkey sends
  intent via `wireRoom`.

### Out of scope

| Feature | Reason |
| ------- | ------ |
| Full enchant skill trees | Phase 25 |
| All 200+ Classic skills | TI-relevant subset only |
| Olympiad / siege skills | Post-TI |

---

## Phase 21 — Quests & tutorial `[x]`

> Done when: TI starter quest chain is playable — Tutorial (Q00255) plus core
> Q001xx/Q0015x quests (~17); quest log UI; NPC quest markers; kill/collect/talk
> objectives with server-validated rewards.
>
> **Depends on:** Phase 19–20 (class + skills for quest prerequisites), Phase 24
> (quest-giver NPCs — may stub earlier with existing seven NPCs).

### Selection (TI starter quests — first batch)

| Quest | L2J script | MVP objective type |
| ----- | ---------- | ------------------ |
| Q00255 | Tutorial | Guided UI + first kill |
| Q00101 | Sword of Solidarity | Collect + deliver |
| Q00104 | Spirit of Mirrors | Kill + collect |
| Q00105 | Skirmish With Orcs | Kill count |
| Q00151 | Cure For Fever | Collect drops |
| Q00152 | Shards of Golem | Kill + collect |
| … | *(Planner extends to ~17 from L2J `scripts/quests/Q001*`, `Q0015*`)* | |

### Scope

- Quest engine: state machine, quest items, branching dialog, reward grant (XP/adena/items).
- Server authority on every transition; client quest log + `__GAME_STATE__.quests` hook.
- Room tests per quest outcome; client unit: quest log reflects server state.

### Out of scope

| Feature | Reason |
| ------- | ------ |
| Seven Signs / epic quests | Post-TI |
| Party-shared quest credit | Phase 26 |
| Full L2J HTML dialog port | MVP dialog shell + key lines |

---

## Phase 22 — Complete TI bestiary (+12 mobs) `[x]`

> Done when: all **remaining** authentic TI field monsters from
> `TalkingIslandMonsters.xml` are seeded, spawned, and rendered — same pipeline
> as Phases 10/16.
>
> **Depends on:** Phase 10/16 (creature backend), Phase 23 preferred for spawn
> territories (may use simplified rings if 23 not done).

### Selection (remaining 12 by level)

| npcId | Name | Lv |
| ----- | ---- | -- |
| 20006 | Orc Archer | 8 |
| 20326 | Goblin Scout | 8 |
| 20131 | Orc Soldier | 7 |
| 20132 | Werewolf | 9 |
| 20342 | Werewolf Chieftain | 9 |
| 20343 | Werewolf Hunter | 9 |
| 20093 | Orc Warrior | 10 |
| 20096 | Orc Lieutenant | 11 |
| 20098 | Orc Captain | 12 |
| 20016 | Stone Golem | 13 |
| 20101 | Crasher | 14 |
| 20103/06/08 | Giant Spider family | 15–17 |

*(Planner confirms exact list against L2J spawn table minus the nine already seeded.)*

### Scope

- Per mob: seed stats/drops/spawns + rigged GLB + manifest row + visual gate.
- Ranged AI for Orc Archer; social aggro for wolf packs where L2J defines it.
- Ring progression on expanded map (Phase 23) or interim outer bands.

### Out of scope

| Feature | Reason |
| ------- | ------ |
| Raid bosses | Not on TI spawn table |
| Mob weapon attachments (Orc axe) | Defer; Phase 11 attachment pattern |

---

## Phase 23 — Full Talking Island world & zones `[x]`

> Done when: the playable area covers TI Village, eastern fields, Elven Ruins,
> Obelisk, Harbor, and Cave of Souls / Maze — named zones (peace/combat/water)
> replace the single peace rectangle; spawns re-mapped from L2J territories.
>
> **Depends on:** Phase 9 (walkability baseline); partially supersedes AD-006
> simplified 200 m patch.

### Scope

- Expand heightmap / multi-region layout (L2J territory centroids → local space, AD-013).
- Zone definitions: peace, combat, fishing, water (no combat in town — extend P6).
- Hand-placed landmarks (ruins, obelisk, harbor dock, cave entrance) as GLB props.
- Re-home existing NPC/mob spawns to new coordinates; update blocker volumes.
- Room tests: zone guard rules; client unit: zone indicator in `__GAME_STATE__`.

### Out of scope

| Feature | Reason |
| ------- | ------ |
| L2J geodata / NSWE cell parsing (Tier 4) | AD-006 deferred; keep grid pathfinding |
| Seamless open-world streaming | Single expanded room instance for TI |
| Other regions (Gludin, Dion, …) | TI vertical slice only |

---

## Phase 24 — Town services & full NPC roster `[x]`

> Done when: remaining TI town NPCs are seeded and functional — High Priest,
> guards, blacksmith, folk trainers, Gatekeeper teleports; real warehouse
> deposit/withdraw; Bitz class-change (1st transfer) wired to Phase 19.
>
> **Depends on:** Phase 17 (NPC pipeline), Phase 19–20 (class/skill services).

### Selection (next batch after Phase 17's seven)

| npcId | Name | Service |
| ----- | ---- | ------- |
| 30031 | Biotin | High Priest — buffs/resurrect |
| 30039–30046 | Guards | Static patrol or idle |
| 30027–30036 | Folk trainers | Class skill subsets |
| 30006 | Roxxy | Gatekeeper — teleport destinations |
| 30005 | Wilford | Warehouse — full storage DB |

### Out of scope

| Feature | Reason |
| ------- | ------ |
| Private store / player shops | Phase 26 |
| Castle / clan hall NPCs | Post-TI |

---

## Phase 25 — Items, economy & crafting `[x]`

> Done when: full TI-grade equipment tables (No-grade/D-grade weapons/armor/jewelry);
> all equip slots; soulshots functional; dwarf crafting/recipes for TI subset;
> enchant UI stub or +1..+3 safe enchant from L2J tables.
>
> **Depends on:** Phase 24 (merchant/blacksmith NPCs), Phase 20 (soulshots).

### Scope

- Extend equip beyond weapon-only (chest/legs/gloves/boots/helmet/jewelry paper-doll).
- Seed buylists + drop tables completion for TI items; set bonuses where Classic defines.
- Recipe system MVP (Dwarf); `Recipes.xml` TI subset.
- Room: buy/equip/enchant/craft transactions; client unit: equip updates vitals HUD.

### Out of scope

| Feature | Reason |
| ------- | ------ |
| Auction house / economy sim | Post-TI |
| Full A–S grade equipment | TI level cap only |

---

## Phase 26 — Social & multiplayer systems `[x]`

> Done when: chat (all/local/trade/party), party invite + shared XP/loot rules,
> player trade window, friend list; room tests for two-session party + trade.
>
> **Depends on:** Phase 3 (multiplayer baseline).

### Scope

- Chat channels + rate limit; party schema on room state; trade request/confirm flow.
- Server validates all social actions (AD-001); client unit: party/chat in
  `__GAME_STATE__` via `wireRoom`.
- Re-modeled L2 social rules — not the real L2 protocol (AD-004).

### Out of scope

| Feature | Reason |
| ------- | ------ |
| Clans / alliances | Post-TI |
| Mail system | Post-TI |

---

## Phase 27 — Progression rules & PvP `[x]`

> Done when: death XP loss + restore; PvP flag/karma; delevel; full XP curve to
> TI level cap; stat re-spec at trainer.
>
> **Depends on:** Phase 19–20 (stats/skills), Phase 7 (death/respawn baseline).

### Scope

- Translate L2J penalty/PK rules to `@nj/game-core` pure functions + room tests.
- PvP flag toggle; karma on player kill; peace zone enforcement extended to new zones.
- XP curve completion from L2J `stats/experience.xml` to TI cap.

### Out of scope

| Feature | Reason |
| ------- | ------ |
| Siege / clan war | Post-TI |
| Full Olympiad | Post-TI |

---

## Phase 28 — UI/UX client shell `[x]`

> Done when: login + character select screens; full inventory grid (weight/slots);
> skill window; quest log; party UI; minimap/world map; buff/debuff bars; system
> menu; target-of-target frame — replacing stub HUD panels from MVP.
>
> **Depends on:** Phases 19–21 (data to display), Phase 14 (icon pipeline).

### Scope

- Windowed UI layer (DOM) for all major L2 panels; hotkeys; context actions on target.
- Minimap from zone layout (Phase 23); quest tracker from Phase 21 state.
- Client unit: DOM assertions per panel open/close (Vitest + jsdom); no WebGL reads
  (AD-009).

### Out of scope

| Feature | Reason |
| ------- | ------ |
| Cash shop / Prime Shop | Not Classic TI |
| Full options/keybind remapping | MVP defaults sufficient |

---

## Phase 29 — Audio & world ambience `[x]`

> Done when: zone-appropriate music loops, combat/cast/UI SFX, and ambient world
> audio play in the client without blocking the Vitest gate.
>
> **Depends on:** Phase 23 (zones), Phase 28 (UI shell for volume/settings hook).

### Scope

- Music: town / field / combat stingers (license-clean assets).
- SFX: melee hit, skill cast, footsteps, level-up, UI click — wired to existing VFX events.
- Client unit: audio manager loads and triggers on mocked game events (no real playback in CI).

### Out of scope

| Feature | Reason |
| ------- | ------ |
| Voice acting / NPC barks | Post-TI |
| Dynamic adaptive music engine | MVP loops sufficient |

---

## Phase 30 — Visual fidelity upgrade `[x]`

> Done when: the client renders real cast/received shadows anywhere in the
> 640 m world, correct color response (antialiasing, ACES filmic tonemapping,
> sRGB output), a barely-there world-edge fog invisible at gameplay range, and
> a procedurally-generated tiled grass texture on the terrain — closing the
> "programmer art" gap (zero shadows/fog/tonemapping, flat solid-color
> geometry) without abandoning the project's zero-external-asset,
> procedural-texture art direction (AD-005/AD-017/AD-019).
>
> Spec: `.specs/features/visual-fidelity-upgrade/`.

### Scope

- Renderer: `renderer.shadowMap` (soft PCF) + sun `castShadow` with a sized
  shadow-camera frustum; `WebGLRenderer({ antialias: true })`;
  `toneMapping = ACESFilmicToneMapping`; `outputColorSpace = SRGBColorSpace`;
  `scene.fog = THREE.Fog` anchored to `MOB_RENDER_DISTANCE` so it never
  touches gameplay-relevant visibility.
- Shadow frustum-follow: the sun + its shadow target re-center on the local
  player using the existing move-culling threshold (no fixed-at-origin
  frustum, no cascades) — reused across the entire 640 m world.
- Terrain: procedural seeded `THREE.DataTexture` grass texture (AD-019,
  no Canvas 2D, no external asset) + a new `uv` `BufferAttribute` +
  `RepeatWrapping` tiling; `receiveShadow = true`.
- `receiveShadow` added to the static-prop GLB/instanced-scatter pipeline and
  all four primitive-fallback builders (village buildings, scattered
  trees/rocks, peace-zone marker, landmarks) — both render paths, no
  regression on GLB-load failure.
- AD-019 recorded in `STATE.md`.

### Out of scope

| Feature | Reason |
| ------- | ------ |
| Bloom / `EffectComposer` post-processing | Subtle-ambition decision (`context.md`) |
| Dusk/warm mood lighting change | Neutral-mood decision (`context.md`) |
| External CC0 ground texture + LICENSE attribution | Procedural-texture decision (`context.md`) |
| New shadow-casting behavior for animated entities (player/remote players/mobs/NPCs) | Already `castShadow = true` since Phase 8/10/11/12; unchanged |
| Self-shadowing (`receiveShadow`) on characters/creatures | Low-poly rigged meshes self-shadow poorly at this fidelity |
| Retuning existing VFX color constants for the new tonemapping response | Separate follow-up only if a specific regression is spotted |

### Checklist

- [x] Planner: `.specs/features/visual-fidelity-upgrade/` (`spec.md`,
      `design.md`, `tasks.md`)
- [x] Renderer static config: shadow map, sun shadow-casting, fog,
      tonemapping/color-space, antialiasing
- [x] Shadow frustum follows the local player
- [x] Procedural grass `DataTexture` + terrain UVs + `receiveShadow`
- [x] `receiveShadow` on the static-prop GLB/instanced-scatter pipeline
- [x] `castShadow`/`receiveShadow` on primitive-fallback meshes
- [x] AD-019 recorded in `.specs/STATE.md`
- [x] Verifier PASS recorded in `.specs/features/visual-fidelity-upgrade/validation.md`

---

## Explicitly deferred (not in Phases 19–29)

| Former epic | Reason |
| ----------- | ------ |
| **Live-ops & public deployment** (Railway/Fly + Vercel, accounts at scale, Postgres migration, monitoring) | User decision: not going to prod now; runs locally via `npm run dev` |
| Other continents / regions beyond TI | Out of vertical slice |
| Authentic L2 client protocol | AD-004 |

---

## Per-phase execution (how each `[ ]` gets to `[x]`)

1. **Plan** — Planner writes `spec.md` (+ `design.md`/`tasks.md`) under `.specs/features/<phase>/`, deciding autonomously and logging assumptions (no approval gate).
2. **Implement** — Implementer executes tasks: TDD, atomic commits, green Nx gate per task.
3. **Verify** — fresh Verifier: spec-anchored check + discrimination sensor → `validation.md`.
4. **Record** — on Verifier PASS, check the phase here and update `.specs/STATE.md` Handoff.

**Loop stop conditions:** the loop is autonomous-first — it decides and documents
rather than pausing for approval. Halt and surface to the human ONLY when genuinely
stuck (see the `spec-driven-execution` skill, "Autonomy & decision-making"): the
Verifier still FAILs after its 3 fix→re-verify iterations, or a true blocker
(contradictory requirements, missing secret/resource, destructive out-of-repo action,
or a missing prerequisite phase).

**Next unchecked phase:** none — Phase 30 is the last recorded phase, all `[x]`.
