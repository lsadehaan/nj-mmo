---
name: game-designer
description: Build production-quality visual game assets for this Three.js + Colyseus MMO: rigged characters, monsters/mobs and NPCs (rigged GLTF + skeletal animation via the game-core animation state machine), equipped-weapon/bone attachments, combat and world VFX, UI/item icons, and environment props. Use when asked to create or add a character, monster, mob, creature or NPC; skin the player or remote players; replace a capsule; attach or show an equipped weapon; add a skill, hit, death, level-up, target-ring or other VFX; add skill or item icons for the hotbar/shop/inventory; replace primitive buildings/trees/rocks with props; import a model; or advance any visual-asset roadmap item (Phases 8+). After this file, read the matching recipe in references/: create-character, create-monster, create-attachment, create-vfx, create-icon, create-prop. Do NOT use for combat balance, server rules, XP/drop formulas, or non-visual gameplay logic (use spec-driven-execution / tlc-spec-driven instead).
license: CC-BY-4.0
metadata:
  author: wneto
  version: 1.0.0
---

# Game Designer

This skill is how visual entities (player characters, monsters, NPCs) get built in this MMO. It exists because of one hard lesson: **a green logic test can hide a broken-looking result.** Follow the layered model and render-and-look before declaring anything done.

## Read order

1. Read this whole file first — it is the mental model and the non-negotiable rules.
2. Then read the **one** recipe that matches your task:

| Your task | Recipe | Asset family |
| --------- | ------ | ------------ |
| Player character; skin/swap the hero; **remote players** | `references/create-character.md` | rigged (Brain·Signal·Body) |
| **NPC** (merchant, gatekeeper) | `references/create-character.md` (NPC note) | rigged, idle-mostly |
| **Monster / mob** (many instances, server-driven) | `references/create-monster.md` (read character first) | rigged + clone-per-instance |
| **Equipped weapon** / hand-held item / anything that rides a bone | `references/create-attachment.md` | attachment on a rigged body |
| **VFX**: skill, hit/impact, death, level-up, target ring, loot marker | `references/create-vfx.md` | transient, signal-triggered |
| **UI icon**: skill or item icon (hotbar, shop, inventory) | `references/create-icon.md` | 2D / DOM |
| **Environment prop**: building, tree, rock, marker | `references/create-prop.md` | static mesh |

## Asset taxonomy (which mental model applies)

Not every asset is animated — pick the right model before you start:

- **Rigged entities** (characters, NPCs, monsters) → the **three-layer model** below. Skeleton + `AnimationMixer`, driven by the brain + server signal.
- **Attachments** (weapons, shields, held items) → **no brain, no mixer**. They parent to a *bone* of a rigged body and inherit its motion. Which item is equipped is server truth.
- **VFX** (skill flash, hit, death, level-up, target ring) → **transient**. No skeleton. Spawned by an authoritative signal/event, animated over a fixed lifetime, then disposed. The *decision to fire* is server truth, never a client guess.
- **Icons** (skill/item 2D art) → **DOM**, keyed by id. Licensed like meshes; DOM-testable (unlike WebGL).
- **Props** (buildings, trees, rocks) → **static meshes**. No skeleton, no signal. Load, clone/instance, place.

The golden rules (server authority, license hygiene, visual gate) apply to **all** families. The three-layer model below is specifically the rigged-entity contract.

## The three-layer model (internalize this — rigged entities)

Every animated entity is three independent layers. Only the bottom one is asset-specific. **Never collapse them.**

- **Brain** — decides *which* clip plays (`idle | move | attack | cast | die`). Pure logic, no Three.js, no files. Lives in `libs/game-core/src/animation/` (`entity-action.ts`, `animation-state.ts`). Reused by every entity. You almost never change it.
- **Signal** — the authoritative truth the brain reads: position (→ locomotion) and a render-only `action`/`actionSeq` for attack/cast/die. Server-owned (AD-015). Schema in `server/src/rooms/schema/TownState.ts`.
- **Body** — loads a rigged GLB and plays the animation track the brain asked for. `client/src/scene/creature/mesh-character.ts` (`createMeshCharacter`, `KAYKIT_CLIP_MAP`). Adding an asset only touches this layer + a clip-name map.

If you find yourself baking "which clip" decisions into the body, or trusting the client for "did an attack happen", stop — you are breaking the model.

## Golden rules (non-negotiable)

1. **Server authority.** The client never decides game outcomes. Animation `action` is a render-only mirror of server state (AD-015); deriving it client-side from guessed events is forbidden. Locomotion may be derived client-side from server position deltas (it is purely cosmetic).
2. **Asset acceptance — fidelity is law; license is relaxed pre-live.** These are two independent axes. **Never conflate them** — the verifier once did ("it's a valid KayKit file, ship it") and a mage ended up standing in for a building.
   - **Fidelity (NON-NEGOTIABLE).** Every asset must be the **closest available representation of the specific real entity**: a Gremlin looks like a gremlin, a village house like a house, a wolf like a wolf. **The source pack is not the spec** — "it's a legal KayKit/Quaternius/AI mesh" does NOT make it correct. A correctly-licensed but wrong-looking asset is a **FAIL, never a placeholder.** Forbidden: substituting a wrong-category default (a character for a building, an animal for a tree) or **copying another entity's GLB** to fill a slot. When you can't find a good match you have exactly three moves — (a) **search harder** across real sources for the best-quality match, (b) **create one in high quality**, or (c) **stop and surface the gap**. Falling back to a random rig is never one of them.
   - **Sourcing order (do these in order).** **(1) Reuse a real CC0 pack first** (KayKit / Quaternius MegaKits and similar) — vendor the GLB locally, then import the closest match with `scripts/import-pack-assets.mjs`. **(2) Hand-author it in code only as a fallback — and only for STATIC assets.** Compose the mesh from Three.js geometry and export to GLB (the standalone-Keltir technique), as `scripts/build-houses.mjs` does for buildings. This is fully in your power; "I couldn't find one" is never an excuse to ship a wrong-category copy. **Rigged/animated entities (characters, NPCs, monsters) are NOT hand-authored** — a skinned skeleton + named animation clips can't be sensibly hand-coded to satisfy the `AnimationMixer`/clip contract, so for them step (1) is mandatory and the only fallback is *another* pack or an AI-generated **rigged** mesh. See `create-prop.md` (hand-authoring pipeline) and `create-character.md` (rigged = pack-only).
   - **License (relaxed pre-live).** The game is not live yet, so the *correct-looking* match may be unlicensed / unknown-license / even proprietary as a **tracked** placeholder; vendor `LICENSE.txt` when one exists and record every non-clean asset for pre-launch replacement. This defers AD-004 cleanup to before launch — it does **not** relax fidelity. CC0 (KayKit, Quaternius, Mixamo) and AI-generated meshes remain preferred when equally easy.
3. **Reuse the brain.** New entities reuse `stepAnimation` and the `idle/move/attack/cast/die` vocabulary. Per-asset differences live only in the clip-name map and the GLB.
4. **Visual gate — BLOCKING, two layers, no rubber-stamping.** An asset/phase is not done until **both** pass. A human is *not* required — but real perception is.
   - **Structural** (`node scripts/visual-gate.mjs`): dedup (two entities with byte-identical GLBs = a copy = FAIL), static props must have no skeleton / no animations / no creature bones, no empty stubs. Deterministic; run it in CI. This alone catches every "copied another GLB" failure.
   - **Fidelity / perception**: render the asset and **actually look at the image**, then judge it against the entity's real reference description — *"is this a good-faith best match for `<entity>`, or a generic stand-in?"* Mismatch ⇒ FAIL **with the reason**. This is a perception step the agent performs (read the rendered PNG and reason about it), **not** a "screenshot was captured" checkbox. A green logic test plus a saved PNG is NOT evidence the thing looks right — that exact rubber-stamp shipped deer-as-trees and a mage-as-a-building. Human approval is welcome, never the safeguard.
5. **Determinism in tests.** Logic is unit-tested with explicit timestamps; the brain has no wall-clock or RNG of its own.

## The loop (every entity)

This is the high-level shape; the recipe files give exact commands and done-criteria per step.

1. **Source the best match** for the *specific* entity — or create it high-quality, or halt (golden rule 2). Never substitute a wrong-category default or copy another entity's GLB. → `client/public/models/<family>/` (+ `LICENSE.txt` if it has one; unlicensed *correct-looking* placeholders OK pre-live).
2. **Inspect** it to read its real animation track names and size (the model names the tracks, not you), and to confirm it is actually the right kind of thing.
3. **Map** the asset's tracks to our `idle/move/attack/cast/die` vocabulary (the clip map).
4. **Body**: load via `createMeshCharacter` (`GLTFLoader` + `AnimationMixer`).
5. **Wire** the body to the brain + signal (character: `player-avatar.ts`; monster: `mobs.ts` + manifest).
6. **Tune** scale, feet-on-ground offset, and facing — by rendering, not guessing.
7. **Visual gate (blocking)**: run `node scripts/visual-gate.mjs` (structural), then render every clip via `scripts/shoot-character.mjs` and **look at the images**, judging fidelity against the entity description. Any FAIL blocks "done".
8. **Prove + gate**: `nx test client` (hook/wiring unit tests) + `npx nx run-many -t test lint build`.
9. **Record** any architectural change in `.specs/STATE.md` and tick the item in `.specs/ROADMAP.md`.

## Where things live (real paths)

- Brain: `libs/game-core/src/animation/{entity-action.ts,animation-state.ts}`
- Signal: `server/src/rooms/schema/TownState.ts` (`PlayerState.action/actionSeq`), set in `server/src/rooms/TownRoom.ts` / `combat-resolver.ts`
- Body backend + clip map: `client/src/scene/creature/mesh-character.ts`
- Player wiring: `client/src/scene/player-avatar.ts`, `client/src/scene/renderer.ts`, `client/src/net/room.ts`, `client/src/test-hook.ts`
- Mobs: `client/src/scene/mobs.ts` (+ `creature/creature-manifest.ts`); NPCs: `client/src/scene/npc-renderer.ts` (+ `creature/npc-manifest.ts`); remote players: `client/src/scene/remote-players.ts`
- VFX: `client/src/scene/vfx/*`
- Environment: layout data in `client/src/scene/{village.ts,scatter.ts}`; rendering in `client/src/scene/{environment-renderer.ts,static-prop.ts}`; per-prop scale/offset/rotation in `client/src/scene/environment-manifest.ts`
- **Asset pipelines**: `scripts/import-pack-assets.mjs` (import vendored CC0 packs; auto resize 1024 + WebP) and `scripts/build-houses.mjs` (hand-author static GLBs in Three.js). Buildings are hand-authored; trees/rocks/marker/weapons/monsters are pack imports.
- HUD/UI for icons: `client/src/hud/*.ts`, `client/src/ui/{shop-window.ts,inventory-window.ts}`
- Assets + licenses: `client/public/models/characters/*.glb`, `.../LICENSE.txt` (props → `client/public/models/props/`, icons → `client/public/icons/`)
- Visual gate: `scripts/visual-gate.mjs` (structural, blocking) + `client/character-lab.html`, `client/src/character-lab.ts`, `scripts/shoot-character.mjs` (render for fidelity/perception)
- Hook/wiring tests: `client/src/test-hook.spec.ts`, `client/src/net/wire-room.spec.ts`
- Decisions/roadmap: `.specs/STATE.md` (AD-004, AD-015, AD-016, AD-017), `.specs/ROADMAP.md`

## Anti-patterns (do not do these)

- ❌ **Treating the source pack as approval** ("it's a valid KayKit/Quaternius file, done"). Legal ≠ correct; fidelity is a separate, non-negotiable axis (golden rule 2).
- ❌ **Substituting a wrong-category default or copying another entity's GLB** to fill a slot (mage→building, wolf→tree). If you can't source it: search harder, create it high-quality, or halt — never fall back to a random rig.
- ❌ Declaring done from green unit tests + a *captured* screenshot without actually perceiving the image. (This is the original failure, twice.)
- ❌ Hardcoding clip choice in the body, or driving attack animation from a client guess instead of the server signal.
- ❌ Adding the same loaded skinned mesh to the scene twice (breaks skinning) — clone per instance (see monster recipe).
- ❌ Letting an unlicensed/proprietary placeholder reach **production** untracked. Pre-live they're allowed — the failure mode is an *untracked* placeholder that silently survives to launch; always leave a replace-before-launch breadcrumb.
- ❌ Inventing animation track names — always inspect the GLB and map its real names.
- ❌ Tuning scale/feet/facing by guessing instead of rendering a frame.

## Definition of done (per entity)

- [ ] **Fidelity**: asset is the best available match for the *specific* entity (not a wrong-category stand-in, not a copy of another entity's GLB); best-match justified, or it was created high-quality, or the gap was surfaced.
- [ ] Asset vendored; `LICENSE.txt` included if one exists; any unlicensed/proprietary placeholder flagged for pre-launch replacement.
- [ ] Clip map covers `idle/move/attack/cast/die` against the GLB's real track names.
- [ ] Body wired through the brain + server signal (no client authority over outcomes).
- [ ] Scale/feet/facing tuned against a rendered frame.
- [ ] **Visual gate passes BOTH layers**: `scripts/visual-gate.mjs` (structural) green, and every clip rendered + perceived for fidelity against the entity description.
- [ ] `nx run-many -t test lint build` green.
- [ ] Decision/roadmap updated if anything architectural changed.
