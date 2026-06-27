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

## Quarantined (failed when applied — ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
