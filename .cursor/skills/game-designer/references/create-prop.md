# Recipe: Create an Environment Prop (building / tree / rock / marker)

Props are **static scenery** — no skeleton, no mixer, no server signal. They replace placeholder primitives with cohesive low-poly GLBs. Read `../SKILL.md` (asset taxonomy + golden rules) first.

The key constraint: **keep the existing layout data, swap only the geometry.** Building positions live in `libs/game-core/src/world-blockers.ts` (`BUILDING_LAYOUT`, surfaced via `village.ts`), scatter positions in the seeded RNG (`world-scatter.ts`). Rendering is done by `client/src/scene/environment-renderer.ts` using `static-prop.ts` and the per-prop tuning in `environment-manifest.ts`. You change the GLBs + manifest, **not** the layout/scatter data.

There are **two ways to make a static prop**, in priority order. Pick the first that yields a faithful result.

---

## Step 1 — Get the geometry (pack reuse FIRST, hand-author SECOND)

**Fidelity is law; the source is your choice (golden rule 2).** A static prop must be a static mesh that reads as the real thing — a building like a house, a tree like a tree. **Never copy a creature/character GLB onto a prop name** (that put deer in the field and a mage where a house should be).

### Option A (preferred) — reuse a real pack

Source CC0 asset packs (KayKit / Quaternius MegaKits and similar), vendor the GLB locally, and import the closest match with `scripts/import-pack-assets.mjs`. Use the helpers there:

- **`copyGltf(src, dest)`** — single self-contained model (tree, rock, banner) → `.glb`.
- **`optimizeTextures` / `optimizeAll`** — packs ship 2K PNGs, so a raw house is 40+ MB. The pipeline **resizes to 1024 + re-encodes WebP**, cutting ~43 MB → ~0.7 MB. WebP decodes natively in Three.js (no loader change) and `resize`/`webp` touch *textures only* — geometry, skins, and animation clips are preserved.
- Modular kits (e.g. KayKit Medieval Village) ship **only loose wall/roof/door modules, not finished houses.** Composing closed buildings from them is fiddly (exact module sizes, pivots, single-sided walls). If composition fights you, fall back to Option B.

### Option B (fallback) — hand-author in code, then export GLB

This is the standalone-**Keltir** technique and is fully in your power. `scripts/build-houses.mjs` is the reference: compose the prop from Three.js primitives and export with `GLTFExporter`. Buildings ship this way. Hard-won rules baked into that script:

- **Headless export gotcha:** Node has no `FileReader`. `GLTFExporter`'s binary path fires **`reader.onloadend`** (NOT `onload`) — your polyfill must fire `onloadend` or `parse()` silently never completes (no file, no error). Copy the polyfill from `build-houses.mjs`.
- **Solid + double-sided:** build walls as **solid boxes** and set every material `side: THREE.DoubleSide`. Single-sided/open shells look like "just one wall" from inside or the back. (A house dumped from the GLB can have all 4 walls and still *look* one-walled if it's single-sided — that's a material bug, not missing geometry.)
- **Origin at the base, centered:** model the prop so its **origin is the base centre at y=0**. The renderer drops GLB props to the ground via `spec.y − height/2`; if your origin isn't the base, the prop floats or sinks.
- **Axis-aligned to footprint:** size/orient each prop to its plot so the manifest needs `scale: 1.0` and `yRotation: 0` (no guessed scale multipliers).

**Done when:** prop GLBs are vendored under `client/public/models/props/` (or `.../props/environment/`), each a faithful static mesh, with a `LICENSE.txt`/`BUILDINGS_LICENSE.txt` recording the source (pack name or "hand-authored").

## Step 2 — Loader + cache; clone or instance per placement

Load each GLB **once** and reuse it (`loadGltfStaticTemplate` caches per URL). A static mesh duplicates cheaply with `Object3D.clone()` (`cloneStaticProp`); many identical props (trees, rocks) use `THREE.InstancedMesh` (`createInstancedScatter`). No skeleton ⇒ no `SkeletonUtils`.

- **Multi-mesh gotcha:** real props are often **multiple meshes** (a tree = trunk mesh + foliage mesh; KayKit pieces split per material). `createInstancedScatter` must instance **every** mesh in the template (baking each mesh's local transform), not just `meshes[0]` — instancing only the first mesh renders bare trunks.

**Done when:** each GLB is fetched once and reused via clone/instancing, and multi-mesh props render fully (foliage present, not bare trunks).

## Step 3 — Wire GLBs + tune via the manifest (keep the layout)

Point `environment-manifest.ts` at the new GLBs and set each prop's `scale`, `yOffset`, `yRotation`, and scatter `scaleMultiplier`. Do **not** edit `BUILDING_LAYOUT` or the scatter RNG — positions, counts, and the village-radius exclusion must stay identical so the world doesn't shift.

**Done when:** buildings/trees/rocks/marker render as GLBs at the exact same coordinates as before, sitting on the ground at sensible sizes.

## Step 4 — Tune scale/orientation by rendering (never guess)

Tune against a rendered frame. The lab camera (`client/src/environment-lab.ts`) is a fixed high overview — good for the scatter field, **but it hides missing/oblique walls.** To check buildings, temporarily point the camera at a 3/4 ground angle, render with `scripts/shoot-environment.mjs`, look, then **revert the camera**.

**Done when:** props sit on the ground at sensible sizes, oriented correctly, stylistically cohesive — verified from a ground-level angle, not just top-down.

## Step 5 — Visual gate + prove (BLOCKING)

First `node scripts/visual-gate.mjs` — it FAILs any prop that carries a skeleton/animations, is a byte-copy of another asset, or is an empty stub. Then render a **town overview AND a 3/4 ground view**, and **actually look** — a building must read as a complete house from the side, not just a roof from above. Then scene smoke (counts match layout/scatter) and `npx nx run-many -t test lint build`.

**Done when:** `visual-gate.mjs` green, both the overview and a ground-level view are perceived as cohesive, complete props, and scene smoke + gate are green.

---

## Collision note (do not conflate)

Props are **visual only.** Walkability/blockers are separate authoritative data handled in the terrain/collision phase (ROADMAP Phase 9, `isWalkable` + blocker volumes), not here. Swapping a building's mesh must not change its blocker volume, and adding a prop does not make it solid. Keep visual and collision concerns in their own layers.

---

## Checklist

- [ ] Source chosen by priority: pack reuse (`import-pack-assets.mjs`) first; hand-author (`build-houses.mjs`) only as a static fallback
- [ ] Prop GLBs vendored under `client/public/models/props[/environment]/`; source recorded in a `LICENSE.txt`
- [ ] Pack imports texture-optimized (resize 1024 + WebP); hand-authored props solid + `DoubleSide`, origin at base, axis-aligned
- [ ] Load-once + clone/`InstancedMesh` reuse; multi-mesh props instance **all** meshes (no bare trunks)
- [ ] GLBs + per-prop tuning set in `environment-manifest.ts`; layout/scatter data unchanged
- [ ] Scale/orientation tuned against a rendered frame, including a **ground-level** building view (camera reverted after)
- [ ] `visual-gate.mjs` + scene smoke + `nx test lint build` green; overview AND ground view perceived as complete

## Anti-patterns

- ❌ **Copying a creature/character GLB onto a prop name** (deer → `Tree`, mage → `Building`). Fidelity FAIL + dedup FAIL.
- ❌ **Hand-authoring export without firing `reader.onloadend`** — `GLTFExporter` binary completes on `onloadend`; with only `onload` it silently writes nothing.
- ❌ **Single-sided / open-shell buildings** — looks like "just one wall". Solid boxes + `DoubleSide`.
- ❌ **Wrong origin** — model not based at y=0 floats/sinks (renderer drops by `height/2`).
- ❌ **Instancing only `meshes[0]`** of a multi-mesh prop — renders bare trunks (no foliage).
- ❌ Shipping 40 MB pack GLBs raw — resize + WebP first.
- ❌ Giving a static prop an `AnimationMixer`; reloading per placement; editing `BUILDING_LAYOUT`/scatter and shifting the world; mismatched art style; treating a visual swap as collision work (Phase 9).
