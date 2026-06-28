# Phase 14 — UI / 2D Iconography Validation

**Date**: 2026-06-28
**Spec**: `.specs/features/phase-14-ui-icons/spec.md`
**Diff range**: `9cd434e..HEAD` (T1 assets at base `9cd434e`, exclusive of base; full phase = `9cd434e^..HEAD`, 10 commits)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Commit | Notes |
| ---- | ------ | ------ | ----- |
| T1 | ✅ Done | `9cd434e` | P1 PNG assets + `ATTRIBUTION.md` (base commit) |
| T2 | ✅ Done | `a02878c` | `icon-manifest.ts` + spec |
| T3 | ✅ Done | `03f2c46` | `createIconImg` + spec |
| T4 | ✅ Done | `4ccf886` | Power Strike hotbar icon |
| T5 | ✅ Done | `dea2c0b` | Shop window icons |
| T6 | ✅ Done | `1475697` | Inventory window icons |
| T7 | ✅ Done | `847d75d` | E2E shop + hotbar assertions |
| T8 | ✅ Done | `540ab9e` | P3 loot icons (not deferred) |
| T9 | ✅ Done | `3ac05b6` | Icon lab + `shoot-icons.mjs` |
| T10 | ✅ Done | `3794f51` | Full gate green |

---

## Implementer Deviations (reviewed)

| Deviation | Spec alignment | Verifier note |
| --------- | -------------- | ------------- |
| Geometric placeholder PNGs (`scripts/generate-p1-icons.py`), not CC0 game-icons.net | Spec allows owned placeholders pre-live; `ATTRIBUTION.md` documents replace-before-launch | ✅ Acceptable (`AD-004` tracking) |
| `createShopRowIcon` exported for fallback unit test | Not in design; aids ICON-17 without leaking internals | ✅ Acceptable test seam |
| P3 loot icons included (T8 not deferred) | Optional P3 in spec — exceeds minimum scope | ✅ PASS (bonus coverage) |
| Pre-existing `mob-animation` e2e flake | Out of phase scope | ✅ Not observed — fresh e2e 20/20 pass |

---

## Spec-Anchored Acceptance Criteria

### P1: Icon manifest (ICON-01–05)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| ICON-01: `getSkillIconPath(3)` | Path ending in `power-strike.png` under `/icons/skills/` | `icon-manifest.spec.ts:15` — `toMatch(/\/icons\/skills\/power-strike\.png$/)` | ✅ PASS |
| ICON-02: `getItemIconPath(1060)` | Path ending in `healing-potion.png` | `icon-manifest.spec.ts:19` — `toMatch(/healing-potion\.png$/)` | ✅ PASS |
| ICON-03: `getItemIconPath(57)` | Path ending in `adena.png` | `icon-manifest.spec.ts:23` — `toMatch(/adena\.png$/)` | ✅ PASS |
| ICON-04: unmapped id | `FALLBACK_ICON` (`/icons/placeholder.png`) | `icon-manifest.spec.ts:27-28` — `toBe(FALLBACK_ICON)` for item + skill | ✅ PASS |
| ICON-05: P1 paths on disk | File exists for every mapped P1 path | `icon-manifest.spec.ts:32-35` — `existsSync(diskPath)` for `P1_ICON_PATHS` | ✅ PASS |

### P1: Icon DOM helper (ICON-06–08, ICON-30)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| ICON-06: mapped item img | `src` from manifest, `alt` **Healing Potion**, `width`/`height` **32** | `icon-img.spec.ts:22-27` — `toContain('healing-potion.png')`, `alt`/`width`/`height` | ✅ PASS |
| ICON-07: unmapped item fallback | `src === FALLBACK_ICON`, `dataset.iconFallback === 'true'` | `icon-img.spec.ts:38-39` — `toContain(FALLBACK_ICON)`, `toBe('true')` | ✅ PASS |
| ICON-08: skill dataset | `dataset.iconSkillId === '3'` | `icon-img.spec.ts:50` — `toBe('3')` | ✅ PASS |
| ICON-30: size clamp ≤0 | Minimum **16** px | `icon-img.spec.ts:58-61` — `width`/`height` `toBe(16)` for 0 and -4 | ✅ PASS |

### P1: Power Strike hotbar (ICON-09–12, ICON-31)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| ICON-09: boot mount | `<img data-icon-skill-id="3" alt="Power Strike">` in `#power-strike-cooldown` | `power-strike-cooldown.spec.ts:26-30` — query + `alt` `toBe('Power Strike')` | ✅ PASS |
| ICON-10: fill above icon | Fill `z-index` > icon; height reflects ratio | `power-strike-cooldown.spec.ts:40-43` — z-index compare + `height` `toBe('100%')` | ✅ PASS |
| ICON-11: `data-remaining-ms` regression | Updates on cooldown | `power-strike-cooldown.spec.ts:49-51` — `toBeGreaterThan(0)` + `toBe(3000)` | ✅ PASS |
| ICON-12: icon `src` via manifest | Matches `getSkillIconPath(3)` | `power-strike-cooldown.spec.ts:31` — `toContain(getSkillIconPath(3))` | ✅ PASS |
| ICON-31: idempotent mount | Single skill icon after double mount | `power-strike-cooldown.spec.ts:63-64` — `icons.length` `toBe(1)` | ✅ PASS |

### P1: Shop item icons (ICON-13–17)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| ICON-13: catalog row icons | Rows 1060/1835/17 have matching `data-icon-item-id`, non-fallback `src` | `shop-window.spec.ts:56-65` — per `KATERINA_SHOP_ITEMS` row/img asserts | ✅ PASS |
| ICON-14: adena row icon | `data-icon-item-id="57"` beside amount | `shop-window.spec.ts:77-82` — query + `adena.png` in `src` | ✅ PASS |
| ICON-15: alt from catalog | Matches `KATERINA_SHOP_ITEMS` name | `shop-window.spec.ts:64` — `img?.alt` `toBe(item.name)` | ✅ PASS |
| ICON-16: buy regression | `sendBuy` still fires | `shop-window.spec.ts:120-127` — `toHaveBeenCalledWith({ npcId, itemId: 1060, quantity: 1 })` | ✅ PASS |
| ICON-17: unmapped catalog fallback | `FALLBACK_ICON` + `data-icon-fallback="true"` | `shop-window.spec.ts:86-89` — `createShopRowIcon(99999, ...)` asserts | ✅ PASS |

### P1: Inventory item icons (ICON-18–23)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| ICON-18: row icons 1060/2369 | Matching `data-icon-item-id` + mapped `src` | `inventory-window.spec.ts:54-62` — `healing-potion.png` / `squires-sword.png` | ✅ PASS |
| ICON-19: equipped + sword icon | Equipped label + 2369 row sword icon | `inventory-window.spec.ts:45-62` (icon); `134-144` (equipped label) | ✅ PASS |
| ICON-20: `itemDisplayName(17)` | **Wooden Arrow** | `inventory-window.spec.ts:66` — `toBe('Wooden Arrow')` | ✅ PASS |
| ICON-21: `itemDisplayName(1835)` | **Soulshot (No-grade)** | `inventory-window.spec.ts:67` — `toBe('Soulshot (No-grade)')` | ✅ PASS |
| ICON-22: equip regression | Equip buttons remain | `inventory-window.spec.ts:87-100` — equip btn exists (same depth as pre-phase baseline) | ✅ PASS |
| ICON-23: unmapped loot fallback | `FALLBACK_ICON` + readable alt | `inventory-window.spec.ts:82-84` — fallback src + `alt` `toBe('Item 99999')` | ✅ PASS |

### P2: E2E shop icon visibility (ICON-24–25)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| ICON-24: shop open healing potion img | `img[src*="healing-potion"]` visible | `town.spec.ts:108-110` — `locator('#shop-window img[src*="healing-potion"]').toBeVisible()` | ✅ PASS |
| ICON-25: hotbar skill icon visible | `#power-strike-cooldown img[data-icon-skill-id="3"]` visible | `town.spec.ts:111-113` — `toBeVisible()` | ✅ PASS |

### P3: Loot-table item icons (ICON-26–29)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| ICON-26: P3 unique paths | 12 ids → unique non-fallback paths | `icon-manifest.spec.ts:39-47` — `Set` size + `not.toBe(FALLBACK_ICON)` + disk exists | ✅ PASS |
| ICON-27: inventory Magic Ring | Row 116 `src` includes `magic-ring` | `inventory-window.spec.ts:127-131` — `toContain('magic-ring')`, `alt` `toBe('Magic Ring')` | ✅ PASS |
| ICON-28: P3 ATTRIBUTION | Source/license per file or set | `client/public/icons/ATTRIBUTION.md` — table lists all PNGs as generated placeholders | ✅ PASS (manual) |
| ICON-29: missing P3 file fallback | N/A — all P3 files vendored | — | ✅ N/A |

### Edge cases

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| ICON-30 | (see DOM helper above) | — | ✅ PASS |
| ICON-31 | (see hotbar above) | — | ✅ PASS |
| ICON-32: shop re-render | Icons recreated; no duplicate listeners | — | ⚠️ GAP — no unit test; mitigated by `list.innerHTML = ''` rebuild pattern |
| Inventory hidden | Icons not required when panel hidden | — | ✅ N/A (spec-exempt) |

**Status**: 31/32 criteria covered with evidence; 1 edge-case gap (ICON-32, non-blocking)

---

## Discrimination Sensor

Scratch worktrees; mutations discarded after each run.

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| 1 | `icon-manifest.ts:28` | `getSkillIconPath` always returns `FALLBACK_ICON` | ✅ Killed (8 failures in manifest + hotbar specs) |
| 2 | `power-strike-cooldown.ts:45` | Removed `bar.appendChild(icon)` | ✅ Killed (7 failures in hotbar spec) |
| 3 | `shop-window.ts:112` | Removed `createShopRowIcon` prepend | ✅ Killed (7 failures in shop spec) |
| 4 | `icon-img.ts:37` | Removed `dataset.iconFallback = 'true'` | ✅ Killed (20 failures across icon-img, shop, inventory specs) |

**Sensor depth**: lightweight (4 targeted mutations)
**Result**: 4/4 killed — ✅ PASS

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ Manifest + helper + thin HUD wiring only |
| Surgical changes | ✅ No server/schema changes (AD-001) |
| No scope creep | ✅ P3 bonus only; no new HUD panels |
| Matches patterns | ✅ Mirrors `creature-manifest` + existing DOM HUD style |
| Spec-anchored assertions | ✅ Paths, ids, alt text match spec values |
| Tests map to ACs | ✅ 32/32 requirements traced (ICON-32 untested) |
| Guidelines followed | ✅ `AGENTS.md` (DOM HUD, no pixel asserts AD-009), `create-icon.md` |

---

## Gate Check

- **Gate command**: `nx run-many -t build lint test` + `nx e2e client-e2e` (per `tasks.md` T10)
- **Result**: All passed (build/lint/test from cache; client unit **194 passed** fresh `--skip-nx-cache`; e2e **20 passed** fresh `--skip-nx-cache`, ~1.4m)
- **Test count before feature** (`9cd434e^`): client unit ~175 (shop 4 + hotbar 4 + inventory 5 + no icon modules)
- **Test count after feature**: client unit **194** (+19 icon-related unit tests); e2e unchanged count (+2 assertions in existing town test)
- **Delta**: +19 unit tests; 0 deleted; 0 weakened assertions observed
- **Skipped tests**: none
- **Failures**: none

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| ICON-01 – ICON-31 | Pending | ✅ Verified |
| ICON-32 | Pending | ⚠️ Untested (edge) |
| ICON-24 – ICON-29 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ **PASS**

**Spec-anchored check**: 31/32 criteria matched spec outcome with `file:line` evidence; 1 non-blocking edge gap (ICON-32 shop re-render)
**Sensor**: 4/4 mutations killed
**Gate**: build + lint + test + e2e green

**What works**: Icon manifest + `createIconImg` helper; Power Strike hotbar icon under cooldown overlay; shop and inventory row icons for all P1 ids plus P3 loot subset; E2E DOM proof in Katerina buy flow; `ATTRIBUTION.md` placeholder traceability.

**Minor gap**: ICON-32 — no automated proof that double `renderShopWindow` keeps single buy-handler semantics (architecture uses `innerHTML` rebuild; low risk).

**Next steps**: Orchestrator may mark Phase 14 complete in ROADMAP/STATE. Optional follow-up: add shop double-render regression test for ICON-32.
