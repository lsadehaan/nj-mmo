# LESSONS — auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation — do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 — Add an explicit vitest resolve alias to shared lib source; tsconfig paths alone do not override Nx vitest when dist output exists.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `nx/vitest/shared-libs` · harmful: 0
- features: phase-3-authoritative-server
- evidence: tsconfig.base.json + server/vitest.config.ts — vitest still resolves dist when present (nx/vitest/shared-libs)
- last seen: 2026-06-27T16:12:01Z

### L-002 — Room-integration Colyseus tests must await settleRoomMessages (or waitForNextSimulationTick) after client.send before asserting server-mutated state; immediate reads false-pass proximity and economy rejects.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `server/room-integration` · harmful: 0
- features: phase-6-npcs-town
- evidence: TownRoom.spec.ts:907 / mutant proximity-canInteract-true (server/room-integration)
- last seen: 2026-06-27T19:55:09Z

### L-003 — When spec assigns room-integration to a behavior, unit-only proof of the same outcome is a coverage gap—add a TownRoom test that exercises the full message path.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `server/room-integration` · harmful: 0
- features: phase-6-npcs-town
- evidence: P6-R04-AC5 / spec.md (server/room-integration)
- last seen: 2026-06-27T19:55:09Z

### L-004 — E2E peace-zone ACs that name multiple hooks (__attack__ and __useSkill__) need one assertion per hook; testing only attack leaves skill path ungated in e2e.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `client-e2e` · harmful: 0
- features: phase-6-npcs-town
- evidence: P6-R19-AC6 / town.spec.ts (client-e2e)
- last seen: 2026-06-27T19:55:09Z

## Quarantined (failed when applied — ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
