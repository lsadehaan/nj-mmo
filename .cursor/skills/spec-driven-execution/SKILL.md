---
name: spec-driven-execution
description: >-
  Orchestrate feature work in this MMO repo through three sub-agents (Planner,
  Implementer, Verifier) on top of the tlc-spec-driven pipeline, gated by the
  project test layers and Nx affected. Use when planning, implementing, or
  verifying any phase/feature here, or when the user says "build the next
  phase", "implement this feature", "plan this", or "verify the work".
---

# Spec-Driven Execution (3 Sub-Agents)

This skill defines **how features get built in this repository**. It wraps the
`tlc-spec-driven` skill and splits its pipeline across three fresh sub-agents so
that the agent who verifies is never the agent who wrote the code.

Read the `tlc-spec-driven` skill for the underlying pipeline mechanics. This
skill only adds the sub-agent orchestration, the Nx wiring, and the test gate.

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

## The three sub-agents

Offer-then-confirm before dispatching (per tlc-spec-driven). Run sequentially;
each reports a compact summary before the next starts.

### 1. Planner

Runs `tlc-spec-driven` **Specify → (Design) → (Tasks)**, depth auto-sized.

- Writes `.specs/features/[feature]/spec.md` with traceable requirement IDs and
  acceptance criteria (ACs).
- For Large/Complex scope: `design.md` (architecture, server vs client split)
  and `tasks.md` (atomic tasks + per-task verification + dependencies).
- Every AC names the **test layer** that proves it (see Test gate below).
- Marks each task `server` / `client` / `seed` so the Implementer knows where
  logic must live.

Returns: feature path, requirement IDs, task list with layers + dependencies.

### 2. Implementer

Runs `tlc-spec-driven` **Execute**.

- One task at a time: write spec-derived tests → implement → run the gate →
  one atomic commit. Repeat.
- Uses Nx targets to run the gate (see below). Never marks a task done on a red
  or skipped test.
- Records deviations in `.specs/STATE.md`; never silently changes scope.

Returns: commit hashes, test counts per task, any deviations.

### 3. Verifier

Runs `tlc-spec-driven` **Validate** as a fresh agent (author ≠ verifier).

- **Spec-anchored outcome check:** each test's asserted value matches the
  spec's expected outcome; flag spec-precision gaps.
- **Discrimination sensor:** inject behavior-level faults in scratch state
  (e.g. tweak a damage constant, disable a peace-zone check) and confirm tests
  kill them; surviving mutants become fix tasks.
- Writes `.specs/features/[feature]/validation.md` (PASS/FAIL, per-AC evidence,
  sensor result, diff range) and returns a ranked gap list.
- Fix → re-verify loop is bounded to 3 iterations before escalating to the user.

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

## Nx wiring

- Gate a task with the project's target, e.g. `nx test server` /
  `nx test client` / `nx e2e client-e2e`.
- The Verifier runs `nx affected -t test lint` (and `e2e` when the client
  changed) to re-derive coverage for the touched projects only.
- Rely on Nx caching so repeated verification is cheap; never disable the cache
  to "force" a pass.

## Per-phase emphasis

- **Phase 1–2** (scaffold, render): seed/data tests + a Playwright smoke test
  (client boots, canvas mounts, player can move).
- **Phase 3–5** (authoritative server, combat, skill): dominated by unit +
  room-integration tests; this is where server authority is proven.
- **Phase 6–7** (NPCs, shop, go-live): Playwright E2E comes to the front
  (shop buy/sell, peace zone, two-player loop).

## Workflow checklist

```
- [ ] Confirm scope + which phase/feature
- [ ] Offer the 3 sub-agents; wait for confirmation
- [ ] Planner → spec.md (+ design.md / tasks.md), ACs mapped to test layers
- [ ] Implementer → per-task TDD + atomic commits, gate green each task
- [ ] Verifier (fresh) → spec-anchored check + sensor → validation.md
- [ ] Gaps → fix tasks (≤3 loops) → re-verify → PASS
- [ ] Update .specs/STATE.md handoff + decisions
```
