# Visual Fidelity Upgrade Context

**Gathered:** 2026-07-01
**Spec:** `.specs/features/visual-fidelity-upgrade/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Close the biggest, cheapest part of the visual gap between our client renderer and a
polished reference (a Three.js browser MMO screenshot) **without** abandoning the
project's low-poly/procedural art identity (AD-005/AD-017) and without adding new
external dependencies or asset files. Scope: renderer-level lighting/shadow/fog/color
pipeline + a procedurally-generated ground texture. Explicitly not a full art
overhaul, not a mood/time-of-day change, not a bloom/post-processing pipeline.

---

## Implementation Decisions

### Ambition level

- Subtle depth pass: shadows + fog + tonemapping/antialiasing. Keep current
  flat-shaded colors as the baseline — no broad recolor, no bloom, no external
  texture/asset dependency.

### Ground surface

- Add a simple procedurally-generated tiled grass texture (in code, at runtime,
  zero external files) instead of the current single flat vertex color. This is
  the one place the user explicitly opted into *more* visual detail than the
  strict "subtle" baseline, because it's still zero-asset and cheap.

### Lighting mood

- Keep the current neutral, bright daylight mood exactly as-is (light
  color/intensity unchanged). Only add depth cues (shadows, fog) on top of it —
  no dusk/warm-tint shift toward the reference screenshot's mood.

### Atmosphere (fog) intensity

- Barely-there: just enough to soften the world edge / hide any pop-in at the
  render-distance boundary. Not a pronounced moody haze — nearby/gameplay-relevant
  visibility must be completely unaffected.

### Agent's Discretion

- Exact numeric tuning (shadow map resolution, shadow camera frustum, fog
  near/far distances, texture tile size/pixel dimensions) — performance/
  architecture calls, not vision calls. Decided in `design.md`.
- Which entities cast vs. receive shadows (perf budget for an MMO scene) —
  technical call, decided in `design.md`.
- Whether/how the shadow frustum tracks the player as they roam the 640 m world
  — technical call, decided in `design.md`.

### Declined / Undiscussed Gray Areas → Assumptions

- Bloom / post-processing composer: not discussed further because "subtle"
  ambition already rules it out. Recorded as Out of Scope in `spec.md`.
- Retuning existing VFX color constants for the new tonemapping response: not
  discussed — assumption logged in `spec.md` (no deliberate retuning in this
  feature's boundary).

---

## Specific References

The reference screenshot ("Titans of Time," a Three.js browser MMO) was used only
to motivate *why* this feature exists (shadows/fog/tonemapping make a scene feel
grounded) — not as a literal target look. The user explicitly chose the more
conservative options at every decision point (subtle, neutral mood, barely-there
fog), so the reference's dusk mood and pronounced haze are deliberately NOT being
copied.

---

## Deferred Ideas

- Bloom / `EffectComposer` post-processing pipeline (glow on lights/VFX) — closer
  to the reference look, but bigger lift + VFX color retuning; explicitly deferred
  by the "subtle" ambition choice.
- Dusk/warm mood lighting shift — deferred by the "neutral mood" choice.
- Sourcing an external CC0 ground texture (same policy as Phase 15's GLB props) —
  deferred by the "procedural texture" choice.
- Dirt-path blending into the ground texture — deferred; grass-only texture is
  simpler and sufficient for "subtle."
