---
name: spec-driven-execution
description: >-
  Run feature work in this MMO repo on top of the tlc-spec-driven pipeline with
  one change: instead of one sub-agent per phase, dispatch a single Implementer
  sub-agent (Composer 2.5) for all tasks, then always run the Verifier. Use when
  planning, implementing, or verifying any phase/feature here — interactively or
  autonomously inside /loop. Triggers: "build the next phase", "implement this
  feature", "plan this", "verify the work", "advance the roadmap", "loop",
  "autonomous", "next phase".
---

# Spec-Driven Execution

This skill is how features get built in this repo. It runs the **`tlc-spec-driven`**
pipeline (Specify → Design → Tasks → Execute, depth auto-sized) and **changes
exactly one thing** about its Execute step. Everything else — every rule,
contract, and mechanic — is defined by `tlc-spec-driven`. Follow that skill.

## The only deviation from tlc-spec-driven

`tlc-spec-driven` Execute dispatches **one sub-agent per phase** (offered when
there are >3 phases). Here, instead:

1. **One Implementer sub-agent runs all tasks across all phases** — not one per
   phase. No "phases" offer; dispatch a single Implementer for the whole feature.
2. **The Verifier always runs afterward** — a fresh sub-agent (author ≠
   verifier), exactly as `tlc-spec-driven` already mandates. Never skipped,
   never prompted.

That is the entire delta. Do **not** restate tlc's execution contract, verifier
mechanics, lessons system, knowledge-verification chain, or auto-sizing here —
they apply unchanged from `tlc-spec-driven`.

## Roles

Three steps, run sequentially. The middle step is the deviation above.

1. **Plan (orchestrator, no sub-agent).** Run `tlc-spec-driven` Specify →
   (Design) → (Tasks) yourself, depth auto-sized. Ground every requirement via
   tlc's Knowledge Verification Chain plus this repo's sources (see Planning
   inputs below). Output: `spec.md` (+ `design.md` / `tasks.md` for
   Large/Complex), ACs each mapped to a test layer.
2. **Implement (one sub-agent, Composer 2.5).** Dispatch a single Implementer to
   execute **all** tasks following `tlc-spec-driven` (per-task: spec-derived
   tests → implement → gate → atomic commit). It commits per task automatically.
3. **Verify (one fresh sub-agent, Composer 2.5).** Always dispatch the Verifier
   to run `tlc-spec-driven` Validate (spec-anchored check + discrimination
   sensor → `validation.md`). Bounded fix → re-verify loop of 3 iterations, per
   tlc.

Both sub-agents run on **`composer-2.5`** (pass `model: composer-2.5`).

## Sub-agent prompts (self-contained)

Sub-agents can't see this chat or the loop payload — give each a complete prompt.

**Implementer prompt includes:** pointers to the feature's `spec.md` /
`design.md` / `tasks.md`; the lean mandate "implement all tasks following
tlc-spec-driven"; and the note to commit per task automatically (this overrides
the global "only commit when asked" default while in this flow).

**Verifier prompt includes:** pointer to `spec.md` (ACs = source of truth), the
git diff/commit range for the feature, the test files in scope; the instruction
to run `tlc-spec-driven` Validate as an independent fresh-eyes pass (no code
changes; mutations in scratch state only) and to distill lessons from
`validation.md` signals via tlc's lessons mechanism; plus any deviations the
Implementer flagged in its summary.

## Project glue (not in tlc-spec-driven)

**Planning inputs.** Beyond tlc's chain, ground rules/values in: the codebase,
`.specs/STATE.md` decisions (`AD-NNN`), `AGENTS.md` testing principles, and the
**L2J Classic reference tree** at
`~/Dev/L2J_Mobius/L2J_Mobius_Classic_1.0/dist/game/data/` for any value to
translate (mob stats, formulas, item/skill defs). Server authority (`AD-001`)
and the locked stack (`AD-007`) are hard constraints — game-outcome logic lives
on the Colyseus server and is tested there.

**Test layers + gate.** Map each AC to the cheapest of the four layers in
`AGENTS.md` (unit / room-integration / seed-data / e2e). Run the gate with Nx:
`nx test server`, `nx test client`, `nx e2e client-e2e`. The Verifier re-derives
coverage with `nx affected -t test lint` (and `nx e2e client-e2e` when the
client changed). Rely on Nx caching; never disable it to force a pass.

## Autonomous loop mode

When invoked from `/loop` (or asked to run unattended), drive the full cycle
with no human gates. Resolve every decision autonomously and document it
(assumptions in `spec.md`; grounded failures as lessons via tlc).

1. **Select target.** Use the loop payload's named phase if given; else the
   **first unchecked** item in `.specs/ROADMAP.md`, top-to-bottom in dependency
   order. One phase per iteration; never parallel.
2. **Resume.** Read `.specs/STATE.md` `## Handoff`; if a feature is in-flight,
   resume it instead of starting fresh.
3. **Clean env.** Free ports 2567 and 4200 (`lsof -ti :2567 | xargs kill -9`,
   same for 4200) before any gate.
4. **Plan → Implement → Verify** (the three Roles above), no confirmation gates.
5. **Completion.** Read `.specs/features/<feature>/validation.md`; only a
   recorded **PASS** authorises marking done.
6. **On PASS:** flip the ROADMAP checkbox `[ ]`→`[x]`; update `STATE.md`
   `## Handoff` with completed phase + next step; commit
   `docs(spec): mark phase <N> complete in ROADMAP and STATE`; re-arm the loop
   heartbeat (below).
7. **On FAIL after 3 fix → re-verify iterations:** write the blocker to
   `STATE.md` `## Handoff`, surface a compact summary, **stop — do not re-arm.**

Halt for a human **only** when genuinely stuck (contradictory/unsatisfiable
requirements, a missing external secret, a required destructive action outside
the repo, a missing prerequisite phase, or persistent FAIL after 3 iterations).

## Loop integration contract

- **Sentinel:** `AGENT_LOOP_WAKE_ROADMAP`
- **Pattern to monitor:** `^AGENT_LOOP_WAKE_ROADMAP`
- **Payload:** `AGENT_LOOP_WAKE_ROADMAP {"prompt":"advance ROADMAP: run the next unchecked phase end-to-end"}`
- **Re-arm (one-shot, only on PASS):**
  ```bash
  sleep <seconds>
  echo 'AGENT_LOOP_WAKE_ROADMAP {"prompt":"advance ROADMAP: run the next unchecked phase end-to-end"}'
  ```
  Pick the sleep from expected phase time (default ~1800s; adjust per phase).
- **Stop (on FAIL):** kill the sleeper PID; do not emit the sentinel again.
- On wake, read the latest matching line and act on its `prompt`.

## Checklist

```
- [ ] Select phase (ROADMAP or payload); resume in-flight feature from STATE Handoff
- [ ] Clean env (free ports 2567 / 4200)
- [ ] Plan (orchestrator, tlc Specify→Design→Tasks): spec.md (+ design/tasks), ACs → test layers
- [ ] Implement: ONE Composer 2.5 sub-agent runs ALL tasks, atomic commit per task
- [ ] Verify: fresh Composer 2.5 sub-agent runs tlc Validate → validation.md (always)
- [ ] Gaps → fix → re-verify (≤3) → PASS
- [ ] On PASS: flip ROADMAP [x], update STATE Handoff, commit, re-arm loop
- [ ] Halt only if genuinely stuck or FAIL after 3 iterations → blocker to STATE Handoff, stop loop
```
