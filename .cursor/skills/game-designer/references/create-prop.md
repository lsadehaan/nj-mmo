# Recipe: Create an Environment Prop (building / tree / rock / marker)

Props are **static scenery** — no skeleton, no mixer, no server signal. They replace the placeholder primitives (boxes for buildings, cone+cylinder trees, dodecahedron rocks, the peace-zone pillar) with cohesive low-poly GLBs. This is the **lowest-priority** family: the current primitives are acceptable for the slice, so only do this when explicitly asked. Read `../SKILL.md` (asset taxonomy + golden rules) first.

The key constraint: **keep the existing layout data, swap only the geometry.** Building positions live in `client/src/scene/village.ts` (`BUILDING_LAYOUT`), scatter positions in `client/src/scene/scatter.ts` (`PropSpec` via the seeded RNG), and both are turned into meshes by `addBox`/`addTree`/`addRock` in `client/src/scene/renderer.ts`. You replace those three builders, not the data that feeds them.

---

## Step 1 — Source prop GLBs (license preferred, not required pre-live)

Find low-poly props that match the flat-shaded art style (KayKit Medieval Builder / Dungeon, Quaternius nature packs). Vendor under `client/public/models/props/` with `LICENSE.txt` if they ship one. **Pre-live, any placeholders are acceptable** (golden rule 2) — unlicensed or even proprietary — tracked for pre-launch replacement. You want a small kit: a few building variants, 1–2 tree types, 1–2 rock types, a marker.

**Done when:** prop GLBs are vendored under `client/public/models/props/` (license beside them if any; otherwise placeholders noted for replacement).

## Step 2 — Loader + cache; clone or instance per placement

Props repeat, so load each GLB **once** and reuse it. Unlike skinned characters, a static mesh can be cheaply duplicated with `Object3D.clone()`, and many identical props (trees, rocks) are ideal for `THREE.InstancedMesh`. There is no skeleton, so `SkeletonUtils` is unnecessary.

```ts
const gltf = await loader.loadAsync('/models/props/tree_a.glb');
const tree = gltf.scene.clone(true);   // cheap for static meshes
// or, for the whole scatter field, one InstancedMesh of the trunk+foliage
```

**Done when:** each prop GLB is fetched once and reused via clone/instancing, not reloaded per placement.

## Step 3 — Replace the primitive builders (keep the layout)

Swap the bodies of `addBox`/`addTree`/`addRock` in `renderer.ts` to place loaded GLBs at the same positions the existing data provides. Do **not** edit `BUILDING_LAYOUT` or the scatter RNG — positions, counts, and the village-radius exclusion must stay identical so the world doesn't shift. The peace-zone marker (currently a green pillar) can become a marker prop the same way.

**Done when:** buildings/trees/rocks/marker render as GLBs at the exact same coordinates as before.

## Step 4 — Tune scale/orientation by rendering

Static props still need per-kit scale and rotation. Tune against a rendered frame (lab or in-game overview), matching the character/building proportions established earlier. Keep the flat-shaded look cohesive.

**Done when:** props sit on the ground at sensible sizes, oriented correctly, stylistically consistent with characters and terrain.

## Step 5 — Visual gate + prove

Capture a **town overview** screenshot and look at the whole scene (props are judged as a set, not individually); get human approval for a new kit. Then a scene smoke test (the props are added to the scene; counts match the layout/scatter data) and `npx nx run-many -t test lint build`.

**Done when:** the town overview is reviewed; scene smoke test + gate green.

---

## Collision note (do not conflate)

Props are **visual only.** Walkability/blockers are separate authoritative data handled in the terrain/collision phase (ROADMAP Phase 9, `isWalkable` + blocker volumes), not here. Swapping a building's mesh must not change its blocker volume, and adding a prop does not make it solid. Keep visual and collision concerns in their own layers.

---

## Checklist

- [ ] Prop GLBs vendored under `client/public/models/props/` (license if any; else placeholder tracked)
- [ ] Load-once + clone/`InstancedMesh` reuse (no per-placement reload)
- [ ] `addBox/addTree/addRock` swapped to GLBs; layout/scatter data unchanged
- [ ] Scale/orientation tuned against a rendered frame; style cohesive
- [ ] Town overview reviewed (human approval if new kit); scene smoke + `nx test lint build` green

## Anti-patterns

- ❌ Giving a static prop an `AnimationMixer` or update loop.
- ❌ Reloading the same GLB once per placement instead of clone/instancing.
- ❌ Editing `BUILDING_LAYOUT` / scatter RNG and shifting the world while "just" changing art.
- ❌ Mismatched art style (realistic props in a flat-shaded world).
- ❌ Treating a visual prop swap as collision work (that's Phase 9 data, a separate layer).
