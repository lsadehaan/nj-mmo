# Recipe: Create a UI Icon (skill / item)

Icons are **2D images keyed by an id** — a skill icon for the hotbar/cooldown, item icons for the shop and inventory. They are not 3D and not animated. Unlike the WebGL scene, the HUD/UI is DOM, so icons are **DOM-testable** (assert the `<img>` element/src), which is the cheap, reliable proof. Read `../SKILL.md` (asset taxonomy + golden rules) first; license hygiene applies to icons exactly like meshes.

The targets are the existing UI components: `client/src/hud/power-strike-cooldown.ts` (skill icon) and `client/src/ui/{shop-window.ts,inventory-window.ts}` (item icons).

---

## Step 1 — Source icons (license preferred, not required pre-live)

Use an icon set (e.g. game-icons.net, CC-BY with attribution; or owned art) and pick the icon that **actually depicts the thing** — a potion icon for the Healing Potion, a sword for the Squire's Sword, not a generic gray square. Vendor them under `client/public/icons/` (`skills/`, `items/`), with a `LICENSE.txt`/attribution file if the set ships one. License is relaxed pre-live (golden rule 2) — unlicensed/proprietary OK *if the icon reads as the item* and is tracked for replacement — but **fidelity is not**: a blank/placeholder swatch in place of a real icon is only acceptable as the explicit `FALLBACK_ICON`, never as the icon for a known id. Keep a consistent square size and visual style across the set.

**Done when:** icon files are under `client/public/icons/...` (license/attribution beside them if any; otherwise placeholders noted for later replacement).

## Step 2 — Manifest: id → icon path

Map game ids to asset paths so the UI never hardcodes filenames. Keys come from the seeded data we already import.

```ts
// e.g. client/src/ui/icon-manifest.ts
export const SKILL_ICONS: Record<number, string> = {
  /* Power Strike skillId */ 0: '/icons/skills/power-strike.png',
};
export const ITEM_ICONS: Record<number, string> = {
  1060: '/icons/items/healing-potion.png',   // Healing Potion
  1835: '/icons/items/soulshot.png',          // Soulshot (No-grade)
  17:   '/icons/items/wooden-arrow.png',      // Wooden Arrow
  2369: '/icons/items/squires-sword.png',     // Squire's Sword
  57:   '/icons/items/adena.png',             // Adena
};
export const FALLBACK_ICON = '/icons/placeholder.png';
```

**Done when:** every shop/hotbar id used today resolves to an icon path, with a single fallback for unmapped ids.

## Step 3 — Wire into the HUD/UI with a fallback

Replace the text/colour-swatch slots in the hotbar, shop, and inventory with an `<img>` whose `src` comes from the manifest (falling back to `FALLBACK_ICON`). Keep alt text = the item/skill name for accessibility and for DOM tests. Do not break the cooldown overlay logic — the icon sits *under* it.

**Done when:** hotbar, shop, and inventory render real icons; an unmapped id shows the placeholder, never a broken image.

## Step 4 — Prove (DOM, not pixels)

Because this is DOM, assert structure directly (the AGENTS.md rule: HUD is DOM-testable, WebGL is not). Client unit tests: render the component, assert the `<img src>`/alt for a known id, and assert the fallback for an unknown id. A screenshot is a nice extra, not the test. `npx nx run-many -t test lint build`.

**Done when:** DOM tests assert the right icon (and fallback) appear; gate green.

---

## Checklist

- [ ] Icons sourced under `client/public/icons/...` (license/attribution if any; else placeholder tracked)
- [ ] `id → path` manifest for skills and items, plus a fallback
- [ ] Hotbar/shop/inventory render `<img>` from the manifest with alt text
- [ ] Unmapped id → placeholder (no broken image)
- [ ] DOM test asserts correct icon + fallback; `nx test lint build` green

## Anti-patterns

- ❌ Baking icons into the 3D scene instead of the DOM HUD.
- ❌ Hardcoding filenames in components instead of a manifest.
- ❌ No fallback → broken-image icons for any unmapped id.
- ❌ Letting an unlicensed/proprietary placeholder icon reach **production** untracked (fine pre-live if tracked), or skipping attribution for CC-BY sets you do keep.
- ❌ Asserting icons via pixel screenshot instead of the DOM `<img>`.
