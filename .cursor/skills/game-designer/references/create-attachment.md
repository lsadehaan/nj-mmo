# Recipe: Create an Attachment (equipped weapon / held item)

An attachment is a prop that **rides a bone** of an already-rigged character — a sword in the hand, a shield on the arm, a club on a goblin. It has **no brain, no mixer, no signal of its own.** It is parented to a skeleton bone and inherits that bone's motion for free, so a weapon swings correctly during the `attack` clip without any animation code. Read `../SKILL.md` (asset taxonomy) and `create-character.md` (the body it attaches to) first.

The single idea: **find the hand bone, add the weapon as its child, seat the grip with a local transform.** Everything else is sourcing and tuning.

---

## Step 1 — Source a prop GLB (license preferred, not required pre-live)

Find the **weapon/item mesh that actually matches the item** (a sword for Squire's Sword, a club for the Goblin's club — not a generic box). KayKit weapon packs match the KayKit characters; Quaternius has weapon packs too. It is almost always a **static mesh with no animations** — that's expected. Vendor it under `client/public/models/props/` (or `weapons/`) with its `LICENSE.txt` if it ships one. License is relaxed pre-live (golden rule 2) — unlicensed/proprietary OK *if it looks like the item* and is tracked for replacement — but **fidelity is not**: an empty 1 KB stub or a wrong shape FAILS the gate. If you can't find it: search harder, model a simple high-quality version, or halt — never ship a degenerate placeholder.

**Done when:** the `.glb` is vendored (license beside it if it has one; otherwise the placeholder is noted for later replacement).

## Step 2 — Inspect the prop and the grip

Inspect track names (usually none) and the mesh origin (character recipe, step 2). Note where the **grip/handle** sits relative to the origin — you will offset against it. Render it once in the lab (`?char=<Weapon>`) to see its size and orientation.

**Done when:** you know the prop has no skeleton of its own and where its grip is.

## Step 3 — Find the hand bone on the character rig

Attachments parent to a bone, so you need the bone's **real name** (never guess it). Traverse the loaded character's skinned mesh skeleton and log bone names:

```ts
character.object.traverse((o) => {
  const sk = (o as THREE.SkinnedMesh).skeleton;
  if (sk) console.log('BONES', sk.bones.map((b) => b.name).join(' | '));
});
```

KayKit rigs expose a right-hand bone (commonly a `handslot`/`hand_r`-style name) — pick the right one from the printed list. Cache it by name.

**Done when:** you have the exact bone name for the hand you want to attach to.

## Step 4 — Attach helper (parent to the bone)

Add an `attachToBone(character, prop, boneName, transform)` capability (e.g. in a small `client/src/scene/creature/attachment.ts`). It finds the bone by name and `bone.add(prop)`, then applies a local position/rotation/scale to seat the grip:

```ts
const bone = findBoneByName(character.object, boneName);
bone.add(prop);                       // prop now follows the bone every frame
prop.position.set(px, py, pz);        // local to the bone — seat the grip
prop.quaternion.setFromEuler(rot);
prop.scale.setScalar(s);
```

Because the prop is a child of the bone, the existing `AnimationMixer` moves it automatically — **do not** give the prop its own mixer or update loop.

**Done when:** the weapon visually sits in the hand and follows the idle/attack animation with no extra per-frame code.

## Step 5 — Map equipped item → prop, driven by server state

Which item is in the hand is **server truth** (the equip/inventory state already exists — `equip-transaction.ts`, persisted character equipment). Add an itemId→prop manifest and attach/detach when equipment changes:

```ts
export const WEAPON_MANIFEST: Record<number, { model: string; bone: string; transform: GripTransform }> = {
  2369: { model: 'sword_squire', bone: '<hand-bone>', transform: { /* px,py,pz,rot,scale */ } },
  // 4: goblin club, etc.
};
```

The client reads the equipped itemId from room state and shows the matching prop; an unmapped id shows no weapon (safe fallback). Never infer the weapon from anything client-side.

**Done when:** equipping/unequipping on the server adds/removes the correct hand mesh; unmapped ids degrade gracefully.

## Step 6 — Tune the grip by rendering (not guessing)

Adjust the local position/rotation/scale until the handle sits in the palm and the blade points the right way. Do this against a **rendered frame** (lab or in-game), iterating like the character scale/feet step. For mobs that carry a weapon (e.g. the Goblin's club), the prop must be **cloned per mob instance** and attached to each clone's bone — same clone discipline as the monster recipe.

**Done when:** in a rendered idle and attack frame the weapon is gripped correctly and swings with the arm.

## Step 7 — Visual gate + prove

Render `idle` and `attack` with the weapon attached (`scripts/shoot-character.mjs`) and **look** — the swing is the whole point. For a brand-new attachment, get human approval. Then a small unit/integration check that attaching by itemId adds a child under the hand bone, and `npx nx run-many -t test lint build`.

**Done when:** weapon-in-hand frames reviewed; tests + gate green.

---

## Checklist

- [ ] Prop GLB vendored (static mesh expected; license if it ships one, else placeholder tracked)
- [ ] Grip location understood
- [ ] Real hand-bone name found by traversing the skeleton (not guessed)
- [ ] `attachToBone` parents prop to the bone; no own mixer/update
- [ ] itemId→prop manifest, driven by server equip state; safe fallback
- [ ] Grip transform tuned against a rendered frame; cloned per mob instance if shared
- [ ] idle+attack rendered + reviewed; tests + `nx test lint build` green

## Anti-patterns

- ❌ Adding the weapon to the character `group` instead of the **bone** (it won't follow the swing).
- ❌ Giving the attachment its own `AnimationMixer` or per-frame update.
- ❌ Hardcoding a bone index instead of resolving by name (indices differ across rigs).
- ❌ Choosing the weapon from client logic instead of server equip state.
- ❌ Sharing one loaded prop across many mobs without cloning per instance.
