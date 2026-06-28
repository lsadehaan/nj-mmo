# Phase 14 — UI / 2D Iconography Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** This repo wraps it with
`spec-driven-execution` (Planner → Implementer → Verifier, **autonomous-first**);
honor server-authority (AD-001) and the four test layers (AD-010).

**If the skill cannot be activated, STOP and tell the user — do not proceed
without it.**

---

**Design**: `.specs/features/phase-14-ui-icons/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `AGENTS.md` (4 test layers + DOM HUD testable + 10-second rule),
> `.specs/STATE.md` AD-009/AD-010/AD-014,
> `.cursor/skills/game-designer/references/create-icon.md`,
> existing patterns in `client/src/ui/shop-window.spec.ts`,
> `client/src/ui/inventory-window.spec.ts`, `client-e2e/src/town.spec.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Icon manifest | unit | ICON-01–05: P1 paths, fallback, file existence | `client/src/ui/icon-manifest.spec.ts` | `nx test client` |
| Icon DOM helper | unit | ICON-06–08, ICON-30: src/alt/size, fallback dataset, skill dataset | `client/src/ui/icon-img.spec.ts` | `nx test client` |
| Power Strike hotbar | unit | ICON-09–12, ICON-31: img structure, cooldown overlay, idempotent mount | `client/src/hud/power-strike-cooldown.spec.ts` | `nx test client` |
| Shop window | unit | ICON-13–17, ICON-32: row icons, adena icon, alt, buy regression, fallback | `client/src/ui/shop-window.spec.ts` | `nx test client` |
| Inventory window | unit | ICON-18–23: row icons, names, equip regression, fallback loot row | `client/src/ui/inventory-window.spec.ts` | `nx test client` |
| Shop icon e2e | e2e | ICON-24–25: shop + hotbar img visible in live flow | `client-e2e/src/town.spec.ts` | `nx e2e client-e2e` |
| P3 loot icons | unit | ICON-26–29: manifest paths + one inventory render | `client/src/ui/icon-manifest.spec.ts`, `inventory-window.spec.ts` | `nx test client` |
| PNG assets | none | Build gate — files exist on disk | `client/public/icons/**` | `nx build client` |
| Server | none | Regression only — no schema change | `server/src/rooms/TownRoom.spec.ts` | `nx test server` |
| Icon visual sheet (optional) | none (recommended review) | Human glance at `icon-sheet.png` | `scripts/shoot-icons.mjs` | `node scripts/shoot-icons.mjs` |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`client`) | Yes | `jsdom` per test; `document.body.innerHTML = ''` in beforeEach | `shop-window.spec.ts` pattern |
| E2E (`client-e2e`) | Yes | Per-test `?room=` instanceKey (AD-014) | `client-e2e/playwright.config.ts` |
| Server regression | Yes | `NJ_AUTOSIM=0` + per-test room (AD-014) | `TownRoom.spec.ts` |

## Gate Check Commands

> Generated from codebase (AD-010) — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (client) | After T2–T7 | `nx test client` |
| Quick (server) | After T10 | `nx test server` |
| Full | After T9 | `nx affected -t test lint` + `nx e2e client-e2e` |
| Build | Phase completion (T10) | `nx run-many -t build lint test` |

---

## Execution Plan

**4 phases** (10 tasks; T8–T9 optional P3 / visual).

### Phase 1: Assets & manifest — Sequential

```
T1 → T2 → T3
```

### Phase 2: HUD wiring — Parallel

```
T3 ──┬→ T4 [P] Hotbar
     ├→ T5 [P] Shop
     └→ T6 [P] Inventory
```

### Phase 3: Integration — Sequential

```
T4,T5,T6 → T7 → T9
```

### Phase 4: Optional + final gate — Sequential

```
T9 ──→ T8 [P] P3 loot icons (optional)
    ──→ T10
```

> 4 phases → Execute **inline** in the main window (≤3-phase sub-agent threshold
> uses phase count for offer; 4 phases may offer one worker per phase if user accepts).

---

## Task Breakdown

### T1: Vendor P1 PNG icon assets

**What**: Add `placeholder.png`, Power Strike skill icon, and P1 item icons under
`client/public/icons/` plus `ATTRIBUTION.md`.
**Where**: `client/public/icons/{skills,items}/`, `client/public/icons/ATTRIBUTION.md`
**Depends on**: None
**Reuses**: `create-icon.md` Step 1; L2J names from fixtures (reference only)
**Requirement**: ICON-05, ICON-28

**Tools**: MCP: NONE · Skill: `game-designer` → `create-icon.md`

**Done when**:
- [ ] All P1 paths from design exist on disk (6 item/skill PNGs + placeholder)
- [ ] `ATTRIBUTION.md` lists source or marks placeholder-for-replacement
- [ ] Icons are square PNG with transparent background
- [ ] Build gate: `nx build client` (assets included in `public/`)

**Tests**: none
**Gate**: build

**Commit**: `feat(client): add P1 UI icon PNG assets and attribution`

---

### T2: Icon manifest module

**What**: `icon-manifest.ts` with `SKILL_ICONS`, `ITEM_ICONS`, `FALLBACK_ICON`, getters.
**Where**: `client/src/ui/icon-manifest.ts`, `client/src/ui/icon-manifest.spec.ts`
**Depends on**: T1
**Reuses**: Seeded ids (shop catalog, skill 3)
**Requirement**: ICON-01–05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `getSkillIconPath(3)` → `/icons/skills/power-strike.png`
- [ ] `getItemIconPath(1060|1835|17|2369|57)` → correct paths
- [ ] Unknown id → `FALLBACK_ICON`
- [ ] Unit test asserts every P1 manifest key has matching file (fs `existsSync` or import meta)
- [ ] Quick gate: `nx test client`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(client): add icon manifest for skills and items`

---

### T3: Icon DOM helper

**What**: `createIconImg` with manifest lookup, sizing, `data-icon-*` datasets, size clamp.
**Where**: `client/src/ui/icon-img.ts`, `client/src/ui/icon-img.spec.ts`
**Depends on**: T2
**Reuses**: `icon-manifest.ts` getters
**Requirement**: ICON-06–08, ICON-30

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Mapped item returns correct `src`, `alt`, `width`/`height`
- [ ] Unmapped item sets `data-icon-fallback="true"`
- [ ] Skill kind sets `data-icon-skill-id`
- [ ] `sizePx <= 0` clamps to 16
- [ ] Quick gate: `nx test client`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(client): add createIconImg DOM helper`

---

### T4: Power Strike hotbar icon [P]

**What**: Insert skill `<img>` under cooldown fill in `power-strike-cooldown.ts` + spec.
**Where**: `client/src/hud/power-strike-cooldown.ts`, `client/src/hud/power-strike-cooldown.spec.ts`
**Depends on**: T3
**Reuses**: Existing mount/update/RAF loop
**Requirement**: ICON-09–12, ICON-31

**Tools**: MCP: NONE · Skill: `game-designer` → `create-icon.md`

**Done when**:
- [ ] `#power-strike-cooldown img[data-icon-skill-id="3"]` present after mount
- [ ] Cooldown fill still updates `data-remaining-ms` and height ratio
- [ ] Second `mountPowerStrikeCooldown()` does not duplicate icon
- [ ] Quick gate: `nx test client`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(client): show Power Strike icon in hotbar slot`

---

### T5: Shop window item icons [P]

**What**: Prepend icons to shop rows + adena row; extend `shop-window.spec.ts`.
**Where**: `client/src/ui/shop-window.ts`, `client/src/ui/shop-window.spec.ts`
**Depends on**: T3
**Reuses**: `KATERINA_SHOP_ITEMS`, existing buy/sell handlers
**Requirement**: ICON-13–17, ICON-32

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Each shop row 1060/1835/17 has `img[data-icon-item-id]` with non-fallback src
- [ ] Adena row includes `img[data-icon-item-id="57"]`
- [ ] `alt` matches item name; buy click regression passes
- [ ] Unit test for unmapped catalog entry → fallback (mock extra row or test helper)
- [ ] Quick gate: `nx test client`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(client): add item icons to shop window`

---

### T6: Inventory window item icons [P]

**What**: Prepend icons to inventory rows; expand `ITEM_DISPLAY_NAMES`; extend spec.
**Where**: `client/src/ui/inventory-window.ts`, `client/src/ui/inventory-window.spec.ts`
**Depends on**: T3
**Reuses**: Equip flow, `SQUIRES_SWORD_ITEM_ID`
**Requirement**: ICON-18–23

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Rows for 1060/2369 show correct `img[src]`
- [ ] `itemDisplayName(17)` → Wooden Arrow; `itemDisplayName(1835)` → Soulshot (No-grade)
- [ ] Equip button regression passes
- [ ] Unmapped id row shows fallback icon
- [ ] Quick gate: `nx test client`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(client): add item icons to inventory window`

---

### T7: E2E shop + hotbar icon assertions

**What**: Extend Katerina buy-flow test with DOM icon checks.
**Where**: `client-e2e/src/town.spec.ts`
**Depends on**: T4, T5
**Reuses**: Existing `buying Healing Potion` test setup
**Requirement**: ICON-24–25

**Tools**: MCP: `user-playwright` (if debugging) · Skill: NONE

**Done when**:
- [ ] After shop opens, `img[src*="healing-potion"]` visible in `#shop-window`
- [ ] `#power-strike-cooldown img[data-icon-skill-id="3"]` visible
- [ ] Full gate: `nx e2e client-e2e`

**Tests**: e2e
**Gate**: full

**Commit**: `test(e2e): assert shop and hotbar icons in town flow`

---

### T8: P3 loot-table icons (optional) [P]

**What**: Vendor P3 PNGs, extend `ITEM_ICONS` + `ITEM_DISPLAY_NAMES`, inventory test for Magic Ring.
**Where**: `client/public/icons/items/*`, `icon-manifest.ts`, `inventory-window.ts`, specs
**Depends on**: T6
**Reuses**: Loot ids from `monsters.xml` fixtures
**Requirement**: ICON-26–29

**Tools**: MCP: NONE · Skill: `game-designer` → `create-icon.md`

**Done when**:
- [ ] `getItemIconPath` returns unique paths for P3 ids (112, 116, 118, 13, 426, 462, 1864–1871, 1786, 1788)
- [ ] Inventory render with `itemCounts: { 116: 1 }` shows `magic-ring` in src
- [ ] `ATTRIBUTION.md` updated
- [ ] Quick gate: `nx test client`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(client): add loot-table item icons (P3)`

---

### T9: Icon lab visual sheet (recommended)

**What**: `client/icon-lab.html` + `scripts/shoot-icons.mjs` rendering all P1 icons to a PNG sheet.
**Where**: `client/icon-lab.html`, `client/src/icon-lab.ts`, `scripts/shoot-icons.mjs`
**Depends on**: T4, T5, T6
**Reuses**: `character-lab` / `shoot-character.mjs` pattern
**Requirement**: Success criteria visual review

**Tools**: MCP: NONE · Skill: `game-designer` → `create-icon.md`

**Done when**:
- [ ] Script outputs `client-e2e/test-results/icon-sheet.png` (or `LAB_OUT` env)
- [ ] Sheet includes all P1 icons side-by-side for human review
- [ ] Document run command in `ATTRIBUTION.md` or script header

**Tests**: none
**Gate**: build

**Commit**: `chore(client): add icon-lab visual sheet harness`

---

### T10: Final regression gate

**What**: Run full monorepo gate; confirm no server diff required.
**Where**: N/A
**Depends on**: T7, T9 (T8 optional — skip if P3 deferred)
**Reuses**: AD-010 gate commands
**Requirement**: All ICON-* (except deferred P3)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `nx run-many -t build lint test` green
- [ ] `nx e2e client-e2e` green
- [ ] `nx test server` green (regression)
- [ ] ROADMAP Phase 14 items ticked by orchestrator after Verifier PASS

**Tests**: e2e + regression
**Gate**: build

**Commit**: `chore: phase 14 UI icons gate green`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1 ──→ T2 ──→ T3

Phase 2 (Parallel):
  T3 complete, then:
    ├── T4 [P]
    ├── T5 [P]
    └── T6 [P]

Phase 3 (Sequential):
  T4,T5,T6 ──→ T7 ──→ T9

Phase 4 (Sequential):
  T9 ──→ T8 [P] (optional)
     ──→ T10
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: PNG assets | asset folder | ✅ Granular |
| T2: Manifest | 1 module + spec | ✅ Granular |
| T3: DOM helper | 1 module + spec | ✅ Granular |
| T4: Hotbar wire | 1 HUD file + spec | ✅ Granular |
| T5: Shop wire | 1 UI file + spec | ✅ Granular |
| T6: Inventory wire | 1 UI file + spec | ✅ Granular |
| T7: E2E | 1 spec file extension | ✅ Granular |
| T8: P3 loot | manifest + assets subset | ✅ Granular |
| T9: Icon lab | harness script | ✅ Granular |
| T10: Gate | verification only | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | T1 (start) | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T3 | T3 → T5 | ✅ Match |
| T6 | T3 | T3 → T6 | ✅ Match |
| T7 | T4, T5 | T4,T5,T6 → T7 | ✅ Match |
| T8 | T6 | T9 → T8 | ✅ Match |
| T9 | T4, T5, T6 | T4,T5,T6 → T9 | ✅ Match |
| T10 | T7, T9 | T9 → T10 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | PNG assets | none | none | ✅ OK |
| T2 | Icon manifest | unit | unit | ✅ OK |
| T3 | Icon DOM helper | unit | unit | ✅ OK |
| T4 | Hotbar | unit | unit | ✅ OK |
| T5 | Shop window | unit | unit | ✅ OK |
| T6 | Inventory window | unit | unit | ✅ OK |
| T7 | E2E | e2e | e2e | ✅ OK |
| T8 | P3 manifest + inventory | unit | unit | ✅ OK |
| T9 | Icon lab harness | none | none | ✅ OK |
| T10 | Gate only | e2e + regression | e2e + regression | ✅ OK |
