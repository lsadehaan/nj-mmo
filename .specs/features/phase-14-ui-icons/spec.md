# Phase 14 — UI / 2D Iconography Specification

## Problem Statement

The hotbar, shop, and inventory HUD still use text labels and empty colour swatches
instead of readable item/skill art. `power-strike-cooldown.ts` renders a blank
48×48 slot with only a blue cooldown fill; `shop-window.ts` and `inventory-window.ts`
list items by name alone. Players cannot scan consumables, currency, or Power Strike
at a glance — the ROADMAP vertical-slice promise for Phase 14.

This phase adds **2D PNG icons keyed by game ids** and wires them into existing DOM
HUD components (`create-icon.md`). No server or gameplay changes (AD-001).

## Goals

- [ ] Introduce an **icon manifest** mapping `skillId` / `itemId` → `/icons/...` paths
      with a single fallback.
- [ ] **Power Strike** (skill id **3**) icon in the hotbar/cooldown slot.
- [ ] Shop item icons for Healing Potion (**1060**), Soulshot No-grade (**1835**),
      Wooden Arrow (**17**), plus an **Adena** (**57**) icon in the adena row.
- [ ] Inventory item icons for **1060**, **1835**, **17**, **2369** (Squire's Sword),
      and **57** when present in stacks.
- [ ] DOM tests assert correct `<img src>` and `alt` — never pixel screenshots
      (AD-009).
- [ ] License/placeholder traceability per `game-designer` golden rule 2 (AD-004 at
      launch).

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Server schema, shop prices, or item rules | AD-001; display-only client phase |
| New HUD panels (tooltips, drag-drop, action bar slots 3–12) | ROADMAP lists hotbar + existing shop/inventory only |
| Animated icons or cooldown radial sweep art | Cooldown remains the existing DOM fill overlay |
| 3D item meshes in the world / on the ground | Phase 13 loot puff is separate; no `DropState` |
| Proprietary L2 `.utx` / client texture rips | AD-004 |
| WebGL / canvas pixel assertions | AD-009 — DOM + hook only |
| Full L2 item icon parity (hundreds of ids) | Vertical slice ids only (+ optional P3 loot subset) |
| Character/creature visual gate (AD-017) | Applies to rigged 3D entities; icons use DOM proof + optional icon sheet review |

---

## Assumptions & Open Questions

The Planner cannot talk to the user; every ambiguity is resolved here.

| Assumption / decision | Chosen default | Rationale |
| --------------------- | -------------- | --------- |
| Asset layout | `client/public/icons/skills/`, `client/public/icons/items/`, `client/public/icons/placeholder.png` | `create-icon.md` Step 1 |
| Icon format | **PNG**, square, transparent background | DOM `<img>`; Vite static serve |
| Hotbar icon size | **48×48** px (matches existing `#power-strike-cooldown` slot) | No layout change |
| Shop/inventory row icon size | **32×32** px inline before label | Readable without widening panels |
| Skill manifest key | **`skillId` 3** → Power Strike | `combat-input.ts` sends `useSkill({ skillId: 3 })`; L2J skill id 3 |
| P1 item ids | **57, 17, 1060, 1835, 2369** | ROADMAP + Katerina shop + starter equip |
| P3 loot item ids | **112, 116, 118, 13, 426, 462, 1864, 1867, 1868, 1871, 1786, 1788** | Unique drop ids from seeded TI mob fixtures (`monsters.xml` Gremlin/Goblin/Wolf/Keltir) — rings, recipes, materials |
| Manifest module | `client/src/ui/icon-manifest.ts` — `SKILL_ICONS`, `ITEM_ICONS`, `FALLBACK_ICON`, pure getters | `create-icon.md` Step 2; mirrors creature-manifest pattern |
| DOM helper | `client/src/ui/icon-img.ts` — `createIconImg({ kind, id, alt, sizePx })` | Single fallback + sizing; no duplicated `<img>` logic |
| Unmapped id behavior | `src = FALLBACK_ICON`, `alt` = provided display name, `data-icon-fallback="true"` | No broken images (`create-icon.md` Step 3) |
| Cooldown overlay | Existing `[data-role="fill"]` stays **above** the icon (`z-index`); icon does not block pointer-events | ROADMAP: icon *under* cooldown |
| Inventory display names | Expand `ITEM_DISPLAY_NAMES` for **17, 57, 1835** + P3 loot names (L2J fixture names) | Alt text + label consistency |
| Adena in inventory | Show icon only when `itemCounts[57] > 0` (Adena is replicated separately as `adena` scalar today — **no** fake Adena stack unless server grants item 57 in inventory) | `TownState` tracks `adena` on player, not item 57 stack; shop adena row gets icon beside scalar |
| Asset sourcing (pre-live) | CC0 set (e.g. game-icons.net) **or** simple owned placeholders; track non-CC0 in `icons/ATTRIBUTION.md` | `game-designer` golden rule 2 |
| Server tests | None new — regression gate only | Pure client DOM |
| E2E proof | Extend existing Katerina shop flow: assert Healing Potion row `<img src>` contains `healing-potion` | DOM-testable HUD (AD-009) |
| Visual review | Optional `icon-lab.html` + `scripts/shoot-icons.mjs` sheet — **recommended**, not blocking Verifier | Icons are DOM-proven; unlike AD-017 3D gate |

**Open questions:** none — all resolved or logged above.

**Implicit-requirement dimensions (Large feature):**

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | Manifest keys are numeric ids; unknown ids → fallback only |
| Failure / partial-failure | Missing PNG file → browser shows broken image unless Implementer vendors all mapped paths; spec requires every manifest entry has a file |
| Idempotency / retry | Re-render replaces row `innerHTML` as today; icons recreated each render |
| Auth boundaries | N/A — cosmetic DOM |
| Concurrency / ordering | N/A — single-threaded DOM |
| Data lifecycle | Static assets versioned in repo; no runtime upload |
| Observability | `data-icon-item-id` / `data-icon-skill-id` + `data-icon-fallback` on `<img>` for tests |
| External-dependency failure | CDN N/A — self-hosted under `public/icons/` |
| State-transition integrity | Cooldown fill ratio logic unchanged |

---

## User Stories

### P1: Icon manifest & assets ⭐ MVP

**User Story**: As a developer, I want skill and item ids to resolve to icon paths from
one manifest so HUD code never hardcodes filenames.

**Why P1**: Extension point for future items/skills; `create-icon.md` Step 2.

**Acceptance Criteria**:

1. WHEN `getSkillIconPath(3)` is called THEN it SHALL return a string path ending in
   `power-strike.png` under `/icons/skills/`. **Test layer: unit**
2. WHEN `getItemIconPath(1060)` is called THEN it SHALL return a path ending in
   `healing-potion.png`. **Test layer: unit**
3. WHEN `getItemIconPath(57)` is called THEN it SHALL return a path ending in
   `adena.png`. **Test layer: unit**
4. WHEN `getItemIconPath(99999)` is called for an unmapped id THEN it SHALL return
   `FALLBACK_ICON` (`/icons/placeholder.png`). **Test layer: unit**
5. WHEN the manifest is loaded THEN every P1 mapped path SHALL have a corresponding
   file under `client/public/icons/`. **Test layer: build gate + unit (fs exists check
   or static import list)**

**Independent Test**: Vitest asserts getters; file-exists check for P1 paths.

---

### P1: Icon DOM helper ⭐ MVP

**User Story**: As a developer, I want one function to create sized `<img>` elements
with manifest lookup and fallback so shop/inventory/hotbar stay consistent.

**Why P1**: DRY fallback + test attributes.

**Acceptance Criteria**:

1. WHEN `createIconImg({ kind: 'item', id: 1060, alt: 'Healing Potion', sizePx: 32 })`
   is called THEN it SHALL return an `HTMLImageElement` with `src` matching
   `getItemIconPath(1060)`, `alt` **Healing Potion**, and `width`/`height` **32**.
   **Test layer: unit**
2. WHEN `createIconImg` is called with an unmapped item id THEN `src` SHALL be
   `FALLBACK_ICON` and `dataset.iconFallback` SHALL be **`true`**. **Test layer: unit**
3. WHEN `createIconImg({ kind: 'skill', id: 3, ... })` is called THEN `dataset.iconSkillId`
   SHALL be **`3`**. **Test layer: unit**

**Independent Test**: Vitest creates elements in `jsdom` and asserts attributes.

---

### P1: Power Strike hotbar icon ⭐ MVP

**User Story**: As a player, I want to see the Power Strike skill icon in the bottom-left
hotbar slot so I recognize the ability bound to key **2**.

**Why P1**: Core ROADMAP deliverable.

**Acceptance Criteria**:

1. WHEN the game boots THEN `#power-strike-cooldown` SHALL contain an `<img>` with
   `data-icon-skill-id="3"` and `alt` matching **Power Strike**. **Test layer: unit**
2. WHEN `updatePowerStrikeCooldown` runs THEN the cooldown `[data-role="fill"]` overlay
   SHALL remain visible above the icon (fill height still reflects remaining ratio).
   **Test layer: unit**
3. WHEN Power Strike is on cooldown THEN `data-remaining-ms` on the bar SHALL still
   update (regression — icon wiring must not break cooldown). **Test layer: unit**
4. WHEN inspected in DOM THEN the icon `src` SHALL resolve via `getSkillIconPath(3)`.
   **Test layer: unit**

**Independent Test**: `power-strike-cooldown.spec.ts` mounts bar and asserts structure.

---

### P1: Shop item icons ⭐ MVP

**User Story**: As a player shopping at Katerina, I want each buylist row to show the
item icon so I can scan potions, soulshots, and arrows quickly.

**Why P1**: ROADMAP shop icons.

**Acceptance Criteria**:

1. WHEN `renderShopWindow` renders with `visible: true` THEN each
   `[data-shop-item-id]` row for **1060**, **1835**, **17** SHALL include an `<img>`
   with `data-icon-item-id` matching the row id and non-fallback `src`. **Test layer: unit**
2. WHEN the adena row renders THEN it SHALL include an Adena `<img>` (`data-icon-item-id="57"`)
   beside the adena amount. **Test layer: unit**
3. WHEN a shop row icon is rendered THEN `alt` SHALL match the seeded item name from
   `KATERINA_SHOP_ITEMS`. **Test layer: unit**
4. WHEN buy/sell buttons are clicked THEN existing intent handlers SHALL still fire
   (regression). **Test layer: unit** (existing `shop-window.spec.ts` cases)
5. WHEN an unknown item were added to the catalog without a manifest entry THEN it SHALL
   show `FALLBACK_ICON` with `data-icon-fallback="true"`. **Test layer: unit**

**Independent Test**: Extend `shop-window.spec.ts`.

---

### P1: Inventory item icons ⭐ MVP

**User Story**: As a player, I want inventory stacks to show item icons beside counts
so I can distinguish sword, potions, and ammo.

**Why P1**: ROADMAP inventory icons.

**Acceptance Criteria**:

1. WHEN `renderInventoryWindow` lists owned items THEN each
   `[data-inventory-item-id]` row SHALL include an `<img>` with matching
   `data-icon-item-id` and mapped `src` for **1060** and **2369**. **Test layer: unit**
2. WHEN the equipped weapon row is shown THEN the Squire's Sword label SHALL retain the
   equipped text **and** the **2369** row SHALL show the sword icon. **Test layer: unit**
3. WHEN `itemDisplayName(17)` is called THEN it SHALL return **Wooden Arrow** (L2J name).
   **Test layer: unit**
4. WHEN `itemDisplayName(1835)` is called THEN it SHALL return **Soulshot (No-grade)**
   (L2J `items_subset.xml` name). **Test layer: unit**
5. WHEN equip buttons exist THEN they SHALL remain functional (regression). **Test layer:
   unit** (existing spec)
6. WHEN an unmapped loot item id appears in `itemCounts` THEN the row SHALL show
   `FALLBACK_ICON` with readable `Item {id}` or seeded name text. **Test layer: unit**

**Independent Test**: Extend `inventory-window.spec.ts`.

---

### P2: E2E shop icon visibility

**User Story**: As QA, I want Playwright to confirm a real icon renders during the live
shop flow so wiring regressions are caught in CI.

**Why P2**: Cheapest integration proof for DOM HUD (AD-010 layer 4).

**Acceptance Criteria**:

1. WHEN the player opens Katerina's shop in e2e THEN the Healing Potion row SHALL
   contain an `img[src*="healing-potion"]`. **Test layer: e2e**
2. WHEN the shop is open THEN `#power-strike-cooldown img[data-icon-skill-id="3"]` SHALL
   be visible. **Test layer: e2e**

**Independent Test**: Extend `client-e2e/src/town.spec.ts` buy flow.

---

### P3: Loot-table item icons (lower priority)

**User Story**: As a player who looted rings, recipes, or materials from TI mobs, I want
those stacks to show distinct icons in inventory when I receive them.

**Why P3**: ROADMAP optional loot icons.

**Acceptance Criteria**:

1. WHEN `getItemIconPath` is called for each P3 loot id (**112, 116, 118, 13, 426, 462,
   1864, 1867, 1868, 1871, 1786, 1788**) THEN it SHALL return a unique non-fallback path.
   **Test layer: unit**
2. WHEN `renderInventoryWindow` receives `itemCounts` containing **116** (Magic Ring)
   THEN the row icon `src` SHALL include `magic-ring`. **Test layer: unit**
3. WHEN P3 PNG files are vendored THEN `icons/ATTRIBUTION.md` SHALL list source/license
   per file or a single set attribution. **Test layer: manual / build gate**
4. WHEN a P3 icon file is missing at implement time THEN the manifest entry MAY be omitted
   and inventory SHALL fall back to placeholder (no broken build). **Test layer: unit**

**Independent Test**: Manifest + inventory render with one loot id.

---

## Edge Cases

- WHEN `createIconImg` receives `sizePx` **0** or negative THEN it SHALL clamp to **16**
  minimum. **Test layer: unit**
- WHEN the hotbar mounts twice (`mountPowerStrikeCooldown` idempotent) THEN only one skill
  icon exists. **Test layer: unit**
- WHEN shop re-renders while open THEN icons are recreated without duplicate listeners
  (button listeners re-bound per existing pattern). **Test layer: unit regression**
- WHEN inventory is hidden THEN icon elements are not required in DOM (panel `hidden`).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| ICON-01 | P1: Manifest | Design | Pending |
| ICON-02 | P1: Manifest | Design | Pending |
| ICON-03 | P1: Manifest | Design | Pending |
| ICON-04 | P1: Manifest | Design | Pending |
| ICON-05 | P1: Manifest | Design | Pending |
| ICON-06 | P1: DOM helper | Design | Pending |
| ICON-07 | P1: DOM helper | Design | Pending |
| ICON-08 | P1: DOM helper | Design | Pending |
| ICON-09 | P1: Hotbar | Design | Pending |
| ICON-10 | P1: Hotbar | Design | Pending |
| ICON-11 | P1: Hotbar | Design | Pending |
| ICON-12 | P1: Hotbar | Design | Pending |
| ICON-13 | P1: Shop | Design | Pending |
| ICON-14 | P1: Shop | Design | Pending |
| ICON-15 | P1: Shop | Design | Pending |
| ICON-16 | P1: Shop | Design | Pending |
| ICON-17 | P1: Shop | Design | Pending |
| ICON-18 | P1: Inventory | Design | Pending |
| ICON-19 | P1: Inventory | Design | Pending |
| ICON-20 | P1: Inventory | Design | Pending |
| ICON-21 | P1: Inventory | Design | Pending |
| ICON-22 | P1: Inventory | Design | Pending |
| ICON-23 | P1: Inventory | Design | Pending |
| ICON-24 | P2: E2E | Tasks | Pending |
| ICON-25 | P2: E2E | Tasks | Pending |
| ICON-26 | P3: Loot | Tasks | Pending |
| ICON-27 | P3: Loot | Tasks | Pending |
| ICON-28 | P3: Loot | Tasks | Pending |
| ICON-29 | P3: Loot | Tasks | Pending |
| ICON-30 | Edge: size clamp | Tasks | Pending |
| ICON-31 | Edge: idempotent mount | Tasks | Pending |
| ICON-32 | Edge: shop re-render | Tasks | Pending |

**Coverage:** 32 total, 0 mapped to tasks yet (Tasks phase assigns)

---

## Success Criteria

- [ ] Hotbar, shop, and inventory show real PNG icons for all P1 ids — no text-only rows
      for mapped items.
- [ ] Unmapped ids show a single shared placeholder; zero broken-image icons in normal play.
- [ ] `nx test client` + `nx e2e client-e2e` green; server regression unchanged.
- [ ] `icons/ATTRIBUTION.md` documents icon sources for pre-launch license swap (AD-004).
