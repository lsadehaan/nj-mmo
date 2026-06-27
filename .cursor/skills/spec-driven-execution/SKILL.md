---
name: spec-driven-execution
description: >-
  Orchestrate feature work in this MMO repo through three sub-agents (Planner,
  Implementer, Verifier) on top of the tlc-spec-driven pipeline, gated by the
  project test layers and Nx affected. Use when planning, implementing, or
  verifying any phase/feature here — interactively or autonomously inside
  /loop. Triggers: "build the next phase", "implement this feature", "plan
  this", "verify the work", "advance the roadmap", "loop", "autonomous",
  "next phase".
---

# Spec-Driven Execution (3 Sub-Agents)

This skill defines **how features get built in this repository** — both
interactively (with a human in the loop) and **autonomously inside `/loop`**
(unattended, end-to-end, one roadmap item per iteration).

It wraps `tlc-spec-driven` and splits its pipeline across three fresh
sub-agents so the agent who verifies is never the agent who wrote the code.

Read `tlc-spec-driven` for the underlying pipeline mechanics. This skill adds
sub-agent orchestration, Nx wiring, the test gate, and the loop driver.

---

## Non-negotiables (inherit + extend tlc-spec-driven)

1. **Server authority.** Correctness lives on the Colyseus server. The client
   never decides damage, XP, position, or drops. Tests for those rules target
   the server, never the client.
2. **Tests derive from spec acceptance criteria** — they assert spec-defined
   outcomes, never mirror the implementation.
3. **The gate decides "done", not self-assessment.** A task is done only when
   its tests pass via the runner.
4. **One atomic commit per task.** Never batch tasks; never weaken, skip, or
   delete tests to make them pass.
5. **Author ≠ Verifier.** The Verifier is always a fresh sub-agent and runs
   automatically after the last task — never skipped, never prompted.

---

## The three sub-agents

In **interactive mode**: offer-then-confirm before dispatching (per
tlc-spec-driven). Run sequentially; each reports a compact summary before the
next starts.

In **autonomous loop mode**: dispatch sequentially without confirmation. See
"Autonomous Loop Mode" below.

### 1. Planner

Runs `tlc-spec-driven` **Specify → (Design) → (Tasks)**, depth auto-sized.

- Writes `.specs/features/[feature]/spec.md` with traceable requirement IDs
  and acceptance criteria (ACs).
- For Large/Complex scope: `design.md` (architecture, server vs client split)
  and `tasks.md` (atomic tasks + per-task verification + dependencies).
- Every AC names the **test layer** that proves it (see Test gate below).
- Marks each task `server` / `client` / `seed` so the Implementer knows where
  logic must live.
- **Always researches and grounds** via the Knowledge Verification Chain before
  planning (see Sub-agent context bundle).

Returns: feature path, requirement IDs, task list with layers + dependencies.

### 2. Implementer

Runs `tlc-spec-driven` **Execute**.

- One task at a time: write spec-derived tests → implement → run the gate →
  one atomic commit. Repeat.
- Uses Nx targets to run the gate (see Nx wiring). Never marks a task done on
  a red or skipped test.
- Records deviations in `.specs/STATE.md`; never silently changes scope.
- **Commit autonomy in loop mode (full):** the Implementer commits per task
  automatically. This overrides the global "only commit when asked" default
  when running inside `/loop`.

Returns: commit hashes, test counts per task, any deviations.

### 3. Verifier

Runs `tlc-spec-driven` **Validate** as a fresh agent (author ≠ verifier).

- **Spec-anchored outcome check:** each test's asserted value matches the
  spec's expected outcome; flag spec-precision gaps.
- **Discrimination sensor:** inject behavior-level faults in scratch state
  (e.g. tweak a damage constant, disable a peace-zone check) and confirm tests
  kill them; surviving mutants become fix tasks.
- Writes `.specs/features/[feature]/validation.md` (PASS/FAIL, per-AC
  evidence, sensor result, diff range) and returns a ranked gap list.
- Fix → re-verify loop is bounded to 3 iterations.
- **In loop mode:** if FAIL persists after 3 iterations, do NOT escalate with
  a blocking prompt — STOP the loop (write blocker to STATE Handoff, do not
  re-arm) and surface a summary.

---

## Autonomous Loop Mode

Use this mode when invoked from `/loop` or when explicitly asked to run
unattended. No human gates — the skill drives the full cycle.

### Driver steps

1. **Select the target.** Use the named phase/feature from the loop payload if
   provided; otherwise pick the **first unchecked** item in `.specs/ROADMAP.md`
   in top-to-bottom dependency order. Never run phases in parallel; one phase
   per iteration.
2. **Resume awareness.** Read `.specs/STATE.md` `## Handoff`. If it shows an
   in-flight feature (incomplete tasks, no final commit), resume it instead of
   starting fresh.
3. **Clean environment.** Before running any gate, ensure no stale dev/test
   processes are holding ports 2567 or 4200. Kill any stale process on those
   ports (`lsof -ti :2567 | xargs kill -9` and `:4200` equivalent) and wait
   for the port to be free.
4. **Run Planner → Implementer → Verifier** with no confirmation gates. The
   Planner logs assumptions instead of asking the user (per tlc-spec-driven's
   assumption mechanism).
5. **Completion detection.** Read `.specs/features/<feature>/validation.md`.
   Only a recorded **PASS** authorises marking done.
6. **On PASS:**
   - Flip the ROADMAP checkbox from `[ ]` to `[x]`.
   - Update `.specs/STATE.md` `## Handoff` with the completed phase + next
     step.
   - Commit: `docs(spec): mark phase <N> complete in ROADMAP and STATE`.
   - Re-arm the `/loop` heartbeat (see Loop integration contract).
7. **On FAIL after 3 fix → re-verify iterations:**
   - Write the blocker to `STATE.md` `## Handoff`.
   - Surface a compact summary to the user.
   - **Stop — do not re-arm.**

---

## Sub-agent context bundle

Sub-agents cannot see the parent chat or the loop payload. Every sub-agent
prompt must be self-contained and point the agent at the repo's persisted
sources.

### Planner prompt must include

- The **ROADMAP goal + sub-items** for the target phase (read from
  `.specs/ROADMAP.md`).
- Instruction to **research and ground** via the Knowledge Verification Chain
  before writing any requirement: read the codebase, `STATE.md` decisions
  (AD-NNN), `AGENTS.md` testing principles, the **L2J Classic reference tree**
  at `~/Dev/L2J_Mobius/L2J_Mobius_Classic_1.0/dist/game/data/` for any
  rule/value to translate (mob stats, formulas, item defs, skill defs), and
  Context7 for library APIs. Never fabricate a value that can be verified;
  always log an assumption if something genuinely cannot be determined.
- The locked stack (AD-007) and server-authority constraint (AD-001) as hard
  constraints; the Planner must not re-litigate them.
- Instruction to log all assumptions in the spec's "Assumptions & Open
  Questions" section rather than asking the user.

### Implementer prompt must include

- Pointers to `spec.md`, `design.md`, `tasks.md` for the feature.
- The lean mandate: "implement the tasks following tlc-spec-driven." Do not
  micromanage the TDD cycle — the Implementer self-organises from the skill.
- Commit-autonomy note: commit per task automatically.

### Verifier prompt must include

- Pointer to `spec.md` (ACs = source of truth), the git diff/commit range for
  the feature, and the test files in scope.
- Instruction to run `validate.md` as an independent fresh-eyes pass (no code
  changes, mutations in scratch state only).
- Specific items to scrutinise (e.g. any deviations flagged by the Implementer
  in its summary).

---

## Model per role

All three sub-agents run on **`composer-2.5`**. Pass `model: composer-2.5`
when dispatching each one.

| Role | Model | Notes |
|---|---|---|
| Planner | `composer-2.5` | Give it the ROADMAP goal + the mandated research chain; it grounds and produces spec/design/tasks. |
| Implementer | `composer-2.5` | Keep the prompt lean ("implement the tasks following tlc-spec-driven"); it self-organises. |
| Verifier | `composer-2.5` | A fresh agent — author ≠ verifier still holds (different agent instance, same model). |

`composer-2.5` is fast and self-organises well from tlc-spec-driven, so prefer
lean mandates over long rule lists in every sub-agent prompt.

---

## Test gate (project-specific)

Tests come from the four project layers (see `AGENTS.md`). Map each AC to the
cheapest layer that can prove it:

| Layer | Tool | Proves |
|---|---|---|
| Unit (server) | Vitest | Formulas, curves, rules (damage, XP, drop, cooldown, peace zone) |
| Room integration | `@colyseus/testing` | Join/leave, intent validation, broadcast, persistence/reconnect |
| Seed/data | Vitest | XML→SQLite produced the expected L2J Classic values |
| E2E / on-screen | Playwright | DOM HUD, two-browser multiplayer, input, `window.__GAME_STATE__` hook |

Rules:
- Randomness (drops, damage variance) uses an **injected seeded RNG** so the
  discrimination sensor is reliable.
- WebGL canvas content is **not** DOM-testable — never anchor correctness on
  pixels. Assert logical state through the `window.__GAME_STATE__` test hook.

---

## Nx wiring

- Gate a task: `nx test server` / `nx test client` / `nx e2e client-e2e`.
- The Verifier runs `nx affected -t test lint` (and `nx e2e client-e2e` when
  the client changed) to re-derive coverage for touched projects only.
- Rely on Nx caching; never disable the cache to force a pass.

---

## Loop integration contract

- **Sentinel:** `AGENT_LOOP_WAKE_ROADMAP`
- **Pattern to monitor:** `^AGENT_LOOP_WAKE_ROADMAP`
- **Payload format:** JSON beside the sentinel —
  `AGENT_LOOP_WAKE_ROADMAP {"prompt":"advance ROADMAP: run the next unchecked phase end-to-end"}`
- **Re-arm (one-shot heartbeat, only on PASS):**
  ```bash
  sleep <seconds>
  echo 'AGENT_LOOP_WAKE_ROADMAP {"prompt":"advance ROADMAP: run the next unchecked phase end-to-end"}'
  ```
  Choose the sleep duration based on expected phase implementation time. A
  reasonable default is 1800s (30 min); adjust per phase complexity.
- **Stop (on FAIL escalation):** kill the sleeper PID, do not emit the
  sentinel again.
- On wake, read the latest matching line and act on its `prompt`.

---

## Per-phase emphasis

- **Phase 1–2** (scaffold, render): seed/data tests + Playwright smoke.
- **Phase 3–5** (auth server, combat, skill): unit + room-integration dominant.
- **Phase 6–7** (NPCs, shop, go-live): Playwright E2E front.

---

## Workflow checklists

### Interactive mode (human in the loop)

```
- [ ] Confirm scope + which phase/feature
- [ ] Offer the 3 sub-agents; wait for confirmation
- [ ] Planner → spec.md (+ design.md / tasks.md), ACs mapped to test layers
- [ ] Implementer → per-task TDD + atomic commits, gate green each task
- [ ] Verifier (fresh) → spec-anchored check + sensor → validation.md
- [ ] Gaps → fix tasks (≤3 loops) → re-verify → PASS
- [ ] Update .specs/STATE.md handoff + decisions
```

### Autonomous loop mode (unattended)

```
- [ ] Read .specs/ROADMAP.md; select target phase (or use named payload item)
- [ ] Check STATE.md Handoff — resume in-flight feature if present
- [ ] Clean environment (free ports 2567 / 4200)
- [ ] Planner → research + ground → spec.md / design.md / tasks.md (no gates)
- [ ] Implementer → per-task commits (auto), gate green each task (no gates)
- [ ] Verifier (fresh) → spec-anchored check + sensor → validation.md
- [ ] On PASS: flip ROADMAP [x], update STATE Handoff, commit, re-arm loop
- [ ] On FAIL after 3 iterations: write blocker to STATE Handoff, STOP loop
```
