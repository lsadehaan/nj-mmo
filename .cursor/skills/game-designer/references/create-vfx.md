# Recipe: Create a VFX (skill / hit / death / level-up / target ring)

VFX are **transient** visuals — a Power Strike flash, a melee impact, a death dissolve, a level-up burst, a target-selection ring, a loot marker. They have no skeleton and no mixer. The rule that makes them correct: **a VFX is the cosmetic body of an authoritative event.** The decision that the event happened is _server truth_ (a render-only `action`/`actionSeq`, an HP change, a death, a level change) — never a client-side guess from timing or proximity. Read `../SKILL.md` (asset taxonomy + golden rules) first.

The current placeholder is `client/src/scene/skill-flash.ts` (a sphere + plane); `skill-flash.spec.ts` shows the testing pattern (assert a flash mesh is added on trigger). Use it as the shape to follow.

---

## Step 1 — Identify the authoritative trigger (do this first)

Map the effect to the exact server-owned signal it visualizes. Never fire from a client guess.

| Effect                      | Authoritative trigger                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| Skill effect (Power Strike) | `action === Cast` (the render-only signal, AD-015)                                                        |
| Melee hit / impact          | server-applied damage / target HP decrease in room state                                                  |
| Death                       | target `hp` reaches 0 (server truth)                                                                      |
| Level-up burst              | player `level` increases in state                                                                         |
| Target selection ring       | the client's selected target id (cosmetic UI selection — the one case that is allowed to be client-local) |
| Loot drop marker            | a server-broadcast drop/loot entity (only if/when one exists)                                             |

**Done when:** you can name the state field or event that fires the effect, and it is server-owned (except the purely-cosmetic selection ring).

## Step 2 — Build the effect (low-poly / stylized to match)

Prefer cheap, procedural visuals over heavy assets: `THREE.Points` particle bursts, additive sprite quads, a scaling/fading mesh, or a small shader. The effect must **read as the thing it represents** (a slash reads as a slash, a heal as a heal) — fidelity applies to VFX too (golden rule 2). If you use a texture/sprite sheet, vendor it under `client/public/vfx/` (with `LICENSE.txt` if it has one — license relaxed pre-live, tracked for replacement); pure procedural VFX need no asset file at all. Keep the silhouette readable and consistent with the flat-shaded world.

Put VFX in `client/src/scene/vfx/` (one file per effect, or extend `skill-flash.ts`).

**Done when:** the effect renders standalone with a clear start and end state.

## Step 3 — Lifecycle: spawn → animate over a fixed duration → dispose

A VFX must clean itself up. Give it a deterministic duration, animate it each frame (or via timeout for one-shots), then **dispose geometry and materials** and remove it from the scene. Effects that fire often (hit sparks) should be **pooled/reused** rather than allocated per hit.

```ts
const fx = buildBurst();
scene.add(fx);
// animate over DURATION_MS, then:
scene.remove(fx);
fx.geometry.dispose();
(fx.material as THREE.Material).dispose();
```

Tie durations to the shared constants where one exists (e.g. `ACTION_DURATION_MS` for cast/death) so the effect length matches the animation.

**Done when:** spawning and finishing the effect leaves no leaked meshes/materials (assertable by counting, like `skill-flash.spec.ts`).

## Step 4 — Hook the trigger into the wiring

Fire the effect where the authoritative signal arrives on the client — the room state listeners / `renderer` (`client/src/net/room.ts`, `client/src/scene/renderer.ts`). Compare previous vs current state (e.g. HP dropped, level rose, `actionSeq` bumped) and spawn once per event. Anchor the effect to the relevant world position (attacker, victim, or player).

**Done when:** the effect appears exactly once per real server event, at the right place.

## Step 5 — Visual gate + prove

Capture a frame **mid-effect** (in-game screenshot, or trigger it in the lab) and **look** — VFX are judged by eye. For a new effect, get human approval. Then a deterministic unit test in the `skill-flash.spec.ts` style: simulate the trigger, assert the effect mesh is added, advance time, assert it is removed. `npx nx run-many -t test lint build`.

**Done when:** a mid-effect frame is reviewed; spawn+cleanup unit test and the gate are green.

---

## Checklist

- [ ] Authoritative trigger identified (server signal/state change; not a client guess)
- [ ] Effect built (procedural preferred; any texture vendored, license if it has one / placeholder tracked)
- [ ] Fixed-duration lifecycle with geometry/material disposal; pooled if frequent
- [ ] Hooked at the state/event site; fires once per event at the right position
- [ ] Mid-effect frame reviewed (human approval if new)
- [ ] Spawn+cleanup unit test green; `nx test lint build` green

## Anti-patterns

- ❌ Firing a VFX from client-side timing/proximity instead of a server signal/state change (breaks authority).
- ❌ Never disposing geometry/materials → a memory leak that grows every fight.
- ❌ Allocating a fresh effect for high-frequency events instead of pooling.
- ❌ Blocking or gating gameplay on a VFX finishing.
- ❌ Treating a pixel screenshot as the _only_ test — pair the eye check with the spawn/cleanup unit test.
