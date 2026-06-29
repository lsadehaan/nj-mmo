---
name: spec-driven-execution
description: >-
  Run feature work in this MMO repo on top of the tlc-spec-driven pipeline.
  All three roles — Planner, Implementer, Verifier — are dispatched as Composer
  2.5 sub-agents. The orchestrator selects the target phase, cleans the env, and
  sequences the three sub-agents; it does not write spec/code/tests itself. Use
  when planning, implementing, or verifying any phase/feature here —
  interactively or autonomously inside /loop. Triggers: "build the next phase",
  "implement this feature", "plan this", "verify the work", "advance the
  roadmap", "loop", "autonomous", "next phase".
---

# Spec-Driven Execution

This skill is how features get built in this repo. It runs the **`tlc-spec-driven`**
pipeline (Specify → Design → Tasks → Execute, depth auto-sized) with **two changes**:

1. **All three roles are sub-agents (Composer 2.5)** — Planner, Implementer, and
   Verifier each run as a fresh sub-agent. The orchestrator selects the target,
   cleans the env, sequences the three sub-agents, and handles outcomes (PASS/FAIL).
   It does not write spec, code, or tests itself.
2. **One Implementer sub-agent runs all tasks** — not one per phase. No "phases"
   offer; a single Implementer handles the whole feature.

Everything else — every rule, contract, and mechanic — is defined by
`tlc-spec-driven`. Follow that skill.

## Roles

Three sub-agents, run sequentially. The orchestrator dispatches each one.

1. **Plan (Planner sub-agent, Composer 2.5).** Runs `tlc-spec-driven` Specify →
   (Design) → (Tasks), depth auto-sized. Grounds every requirement via tlc's
   Knowledge Verification Chain plus this repo's sources (see Planning inputs
   below). Output written to disk: `spec.md` (+ `design.md` / `tasks.md` for
   Large/Complex), ACs each mapped to a test layer. Returns a compact summary
   (files written, AC count, key decisions made).
2. **Implement (Implementer sub-agent, Composer 2.5).** Executes **all** tasks
   following `tlc-spec-driven` (per-task: spec-derived tests → implement → gate
   → atomic commit). Commits per task automatically (overrides the global
   "only commit when asked" default while in this flow).
3. **Verify (Verifier sub-agent, Composer 2.5).** Runs `tlc-spec-driven` Validate
   (spec-anchored check + discrimination sensor → `validation.md`). Bounded
   fix → re-verify loop of 3 iterations, per tlc.

All three sub-agents run on **`composer-2.5`** (pass `model: composer-2.5`).

## Sub-agent prompts (self-contained)

Sub-agents can't see this chat or the loop payload — give each a complete prompt.

**Planner prompt includes:** the feature name and phase description (from ROADMAP);
pointers to `.specs/STATE.md` (Decisions section), `AGENTS.md` (testing principles),
and the L2J Classic reference tree path; the instruction to run
`tlc-spec-driven` Specify → (Design) → (Tasks) autonomously, grounding values
in the codebase and Knowledge Verification Chain; the output contract (write
`spec.md` + `design.md` + `tasks.md` under `.specs/features/<feature>/`); and
the repo path so it can explore the codebase.

**Implementer prompt includes:** pointers to the feature's `spec.md` /
`design.md` / `tasks.md`; the lean mandate "implement all tasks following
tlc-spec-driven"; and the note to commit per task automatically.

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

**Test layers + gate.** Map each AC to the cheapest of the three layers in
`AGENTS.md` (unit / room-integration / seed-data). Run the gate with Nx:
`nx test server`, `nx test client`, `nx run-many -t build lint test`. The
Verifier re-derives coverage with `nx affected -t test lint`. Rely on Nx caching;
never disable it to force a pass.

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
- [ ] Plan: Composer 2.5 Planner sub-agent → spec.md (+ design/tasks), ACs → test layers
- [ ] Implement: Composer 2.5 Implementer sub-agent runs ALL tasks, atomic commit per task
- [ ] Verify: Composer 2.5 Verifier sub-agent runs tlc Validate → validation.md (always)
- [ ] Gaps → fix → re-verify (≤3) → PASS
- [ ] On PASS: flip ROADMAP [x], update STATE Handoff, commit, re-arm loop
- [ ] Halt only if genuinely stuck or FAIL after 3 iterations → blocker to STATE Handoff, stop loop
```
