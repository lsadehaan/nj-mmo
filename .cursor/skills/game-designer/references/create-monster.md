# Recipe: Create a Monster / Mob

Monsters reuse everything from `create-character.md` — the brain, the body backend, the clip vocabulary, and the visual gate. **Read `create-character.md` first**, including its Step 1 callout: monsters are **rigged**, so the **reuse-a-pack, do-not-hand-author** rule applies (e.g. Gremlin/Goblin from Quaternius "Ultimate Monsters", imported via `scripts/import-pack-assets.mjs`). Hand-authoring code-built geometry is for *static props only*; a monster needs a real skeleton + `idle/move/attack/cast/die` clips. This file only covers the four things that are different because monsters are (a) many at once and (b) fully server-driven. Do not re-derive the shared steps; reference them.

The current state: mobs render as capsules in `client/src/scene/mobs.ts`, spawned from server state (the `monsters` table → spawn manager → room state → `renderer.syncMob`). The goal is to swap that capsule for a rigged mesh without touching server authority.

---

## Delta A — Many instances: load once, clone per instance (critical)

A character is one instance; mobs spawn in groups. **You cannot add the same loaded skinned mesh to the scene twice** — skinning and the mixer will fight. Load each GLB **once**, then make an independent copy per spawn:

```ts
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
// per spawned mob:
const instance = cloneSkeleton(gltf.scene);     // deep clone incl. skeleton
const mixer = new THREE.AnimationMixer(instance); // each instance gets its OWN mixer
```

Implement this as a "load-once, clone-per-instance" capability. Two clean options:

- Add a `createMeshCharacterInstance(sharedGltf, opts)` path to `client/src/scene/creature/mesh-character.ts` that takes an already-loaded GLTF and clones it (keeping the existing single-load `createMeshCharacter` for the unique player), OR
- A small `mob-mesh.ts` that caches `GLTFLoader.loadAsync(url)` per model URL and returns cloned instances.

Each mob instance keeps its own mixer + its own `AnimState` (from `createAnimState()`), updated every frame.

**Done when:** spawning N mobs of the same type yields N independently-animating meshes (e.g. they don't all share one death pose), and the GLB is fetched once, not N times.

## Delta B — A manifest keyed by npcId (this is what makes it scale)

You do not hardcode model names for dozens of mob types. Add a small data map from the seeded `npcId` to its asset config, derived from the L2J data we already import:

```ts
// e.g. client/src/scene/creature/creature-manifest.ts
export interface CreatureEntry { model: string; clipMap: Record<ClipName,string>; scale: number; }
export const CREATURE_MANIFEST: Record<number, CreatureEntry> = {
  20001: { model: 'Skeleton_Warrior', clipMap: KAYKIT_CLIP_MAP, scale: 1 },
  // ...one row per mob npcId
};
```

`mobs.ts` looks up the entry by `mob.npcId` (already present in mob state) and builds the instance. A missing entry should fall back to the capsule (or a default mesh) so nothing crashes during rollout.

**Done when:** `mobs.ts` chooses the mesh purely from `npcId` via the manifest, with a safe fallback for unmapped ids.

## Delta C — The signal is fully server-driven (extend AD-015 to mobs)

A character gets locomotion from player clicks; a mob gets everything from server state it already broadcasts:

- **locomotion** — derive from the mob's server position deltas (same coast-timer approach as the player), purely cosmetic.
- **die** — when the mob's `hp` reaches 0 (server truth). Play the `die` one-shot and hold the final pose (the backend already clamps `die`).
- **attack/cast** — the mob has no `action`/`actionSeq` yet. To animate mob attacks, extend the render-only signal (AD-015) to the mob schema and set it on the server when a mob's hit resolves (mirror what `PlayerState`/`combat-resolver.ts` do). This is the only server change, and it must stay render-only (no gameplay effect, not persisted).

Never infer a mob attack from client-side timing or proximity — that violates server authority.

**Done when:** mob walk/idle/death animate from existing server state, and (if you want mob attacks) a render-only `action`/`actionSeq` was added to the mob schema and set server-side on hit resolution.

## Delta D — Asset families + per-family clip maps

Humanoid mobs can use the KayKit universal rig and reuse `KAYKIT_CLIP_MAP`. Non-humanoids (KayKit Skeletons pack, Quaternius monster packs, or AI-generated creatures) usually expose **different track names** and may lack `cast` — give each family its own `clipMap` in the manifest and fall back (`cast → attack`, missing → `idle`). Inspect every new family's GLB (character recipe, step 2) before mapping.

**Done when:** each asset family has a clip map built from its real track names, with sensible fallbacks for missing clips.

---

## Then: the shared steps (from create-character.md)

After the four deltas, the rest is identical to the character recipe — do not duplicate, just apply:

- Step 1 source the **best match for each mob** (a Gremlin looks like a gremlin, a Wolf like a wolf — not a generic humanoid in a costume). Fidelity is law; license is relaxed pre-live (golden rule 2). If no good match exists: search harder, create one high-quality, or halt — **never copy a character GLB onto a mob name.** Step 2 inspect, Step 4 body backend (now via the clone path), Step 6 tune scale/feet/facing per family.
- Step 7 **visual gate (blocking)**: run `node scripts/visual-gate.mjs` (it will flag any mob that's a byte-copy of a character/another mob), then render each mob type's clips in `client/character-lab.html` (`?char=<Model>`) via `scripts/shoot-character.mjs` and **actually look** — judge each against the real creature, especially non-humanoids (idle/move/death). Mismatch = FAIL.
- Step 8 prove + gate: `nx run-many -t test lint build`.
- Step 9 record: note the manifest + any mob-schema signal change as an `AD-***` in `.specs/STATE.md`; tick `.specs/ROADMAP.md`.

## Checklist

- [ ] A. Load-once / clone-per-instance (SkeletonUtils.clone); per-instance mixer + AnimState
- [ ] B. `npcId → CreatureEntry` manifest; `mobs.ts` selects by npcId; safe fallback
- [ ] C. Server-driven signal: locomotion from position, die from hp=0, (optional) render-only mob `action`/`actionSeq` set server-side
- [ ] D. Per-family clip maps from real track names, with fallbacks
- [ ] Shared: best-match source (right creature, not a copied character; placeholder OK if it looks right), inspect, tune, **blocking visual gate (`visual-gate.mjs` + render & perceive)**, `nx test lint build`, STATE/ROADMAP

## Anti-patterns specific to monsters

- ❌ **Copying a character GLB onto a mob name** (Gremlin = Mage, Goblin = Barbarian). A structurally-valid rig that is the *wrong creature* still FAILS fidelity (golden rule 2) and the dedup check.
- ❌ Reusing one loaded skinned mesh for multiple mobs (all instances animate in lockstep / skinning corrupts) — always clone.
- ❌ One shared mixer for many mobs.
- ❌ Inferring mob attacks client-side instead of from a server signal.
- ❌ A giant `switch` on npcId in `mobs.ts` instead of a data manifest.
- ❌ Fetching the same GLB once per spawned mob instead of caching the load.
