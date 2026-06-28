---
name: game-designer
description: Build production-quality visual game assets (player characters, monsters/mobs, NPCs) for this Three.js + Colyseus MMO using license-clean rigged GLTF meshes and skeletal animation driven by the game-core animation state machine. Use when the user asks to create or add a character, add a monster or mob, build an NPC, make a new creature, give something animations, skin the player, replace a capsule, import a model, or advance any visual-asset roadmap item. After reading this file, read references/create-character.md for characters and NPCs, and references/create-monster.md for monsters/mobs. Do NOT use for combat balance, server rules, XP/drop formulas, or non-visual gameplay logic (use spec-driven-execution / tlc-spec-driven instead).
license: CC-BY-4.0
metadata:
  author: wneto
  version: 1.0.0
---

# Game Designer

This skill is how visual entities (player characters, monsters, NPCs) get built in this MMO. It exists because of one hard lesson: **a green logic test can hide a broken-looking result.** Follow the layered model and render-and-look before declaring anything done.

## Read order

1. Read this whole file first — it is the mental model and the non-negotiable rules.
2. Then read the recipe for the task:
   - Creating/skinning a **player character or NPC** → `references/create-character.md`.
   - Creating a **monster/mob** (many instances, server-driven) → `references/create-monster.md`. It builds on the character recipe; read the character one first.

## The three-layer model (internalize this)

Every animated entity is three independent layers. Only the bottom one is asset-specific. **Never collapse them.**

- **Brain** — decides *which* clip plays (`idle | move | attack | cast | die`). Pure logic, no Three.js, no files. Lives in `libs/game-core/src/animation/` (`entity-action.ts`, `animation-state.ts`). Reused by every entity. You almost never change it.
- **Signal** — the authoritative truth the brain reads: position (→ locomotion) and a render-only `action`/`actionSeq` for attack/cast/die. Server-owned (AD-015). Schema in `server/src/rooms/schema/TownState.ts`.
- **Body** — loads a rigged GLB and plays the animation track the brain asked for. `client/src/scene/creature/mesh-character.ts` (`createMeshCharacter`, `KAYKIT_CLIP_MAP`). Adding an asset only touches this layer + a clip-name map.

If you find yourself baking "which clip" decisions into the body, or trusting the client for "did an attack happen", stop — you are breaking the model.

## Golden rules (non-negotiable)

1. **Server authority.** The client never decides game outcomes. Animation `action` is a render-only mirror of server state (AD-015); deriving it client-side from guessed events is forbidden. Locomotion may be derived client-side from server position deltas (it is purely cosmetic).
2. **License hygiene (AD-004 stays in force).** Every mesh must be CC0 / owned / properly commercially-licensed. Never ship proprietary Lineage 2 assets. Vendor the asset's `LICENSE.txt` next to the `.glb`. Curated CC0 first (KayKit, Quaternius, Mixamo); AI-generated meshes are allowed (AD-017) but still need a clean license and the visual gate.
3. **Reuse the brain.** New entities reuse `stepAnimation` and the `idle/move/attack/cast/die` vocabulary. Per-asset differences live only in the clip-name map and the GLB.
4. **Visual gate (strongly recommended default).** Before calling a character/monster "done", render each clip to an image and *look* at it — and prefer a human approval for the first version of any new entity. This is what was missing the first time and produced a green-but-wrong result. You MAY proceed on logic-only tests if truly blocked from rendering, but say so explicitly and flag it as unverified visually.
5. **Determinism in tests.** Logic is unit-tested with explicit timestamps; the brain has no wall-clock or RNG of its own.

## The loop (every entity)

This is the high-level shape; the recipe files give exact commands and done-criteria per step.

1. **Source** a license-clean rigged GLB with the needed clips → `client/public/models/characters/` (+ `LICENSE.txt`).
2. **Inspect** it to read its real animation track names and size (the model names the tracks, not you).
3. **Map** the asset's tracks to our `idle/move/attack/cast/die` vocabulary (the clip map).
4. **Body**: load via `createMeshCharacter` (`GLTFLoader` + `AnimationMixer`).
5. **Wire** the body to the brain + signal (character: `player-avatar.ts`; monster: `mobs.ts` + manifest).
6. **Tune** scale, feet-on-ground offset, and facing — by rendering, not guessing.
7. **Visual gate**: render every clip with `client/character-lab.html` via `scripts/shoot-character.mjs`, read the images.
8. **Prove + gate**: e2e asserts `__GAME_STATE__` action transitions; then `npx nx run-many -t test lint build`.
9. **Record** any architectural change in `.specs/STATE.md` and tick the item in `.specs/ROADMAP.md`.

## Where things live (real paths)

- Brain: `libs/game-core/src/animation/{entity-action.ts,animation-state.ts}`
- Signal: `server/src/rooms/schema/TownState.ts` (`PlayerState.action/actionSeq`), set in `server/src/rooms/TownRoom.ts` / `combat-resolver.ts`
- Body backend + clip map: `client/src/scene/creature/mesh-character.ts`
- Player wiring: `client/src/scene/player-avatar.ts`, `client/src/scene/renderer.ts`, `client/src/net/room.ts`, `client/src/test-hook.ts`
- Mobs (still capsules — upgrade target): `client/src/scene/mobs.ts`
- Assets + licenses: `client/public/models/characters/*.glb`, `.../LICENSE.txt`
- Visual gate: `client/character-lab.html`, `client/src/character-lab.ts`, `scripts/shoot-character.mjs`
- E2E proof: `client-e2e/src/character-animation.spec.ts`
- Decisions/roadmap: `.specs/STATE.md` (AD-004, AD-015, AD-016, AD-017), `.specs/ROADMAP.md`

## Anti-patterns (do not do these)

- ❌ Declaring done from green unit/e2e tests without rendering and looking. (This is the original failure.)
- ❌ Hardcoding clip choice in the body, or driving attack animation from a client guess instead of the server signal.
- ❌ Adding the same loaded skinned mesh to the scene twice (breaks skinning) — clone per instance (see monster recipe).
- ❌ Committing a `.glb` without its license, or using assets of unclear provenance.
- ❌ Inventing animation track names — always inspect the GLB and map its real names.
- ❌ Tuning scale/feet/facing by guessing instead of rendering a frame.

## Definition of done (per entity)

- [ ] Asset + `LICENSE.txt` vendored; provenance is CC0/owned/licensed.
- [ ] Clip map covers `idle/move/attack/cast/die` against the GLB's real track names.
- [ ] Body wired through the brain + server signal (no client authority over outcomes).
- [ ] Scale/feet/facing tuned against a rendered frame.
- [ ] Visual gate: every clip rendered and reviewed (human approval for a brand-new entity).
- [ ] `__GAME_STATE__` e2e transitions pass; `nx run-many -t test lint build` green.
- [ ] Decision/roadmap updated if anything architectural changed.
