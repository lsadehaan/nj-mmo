export const FALLBACK_ICON = '/icons/placeholder.png';

export const SKILL_ICONS: Record<number, string> = {
  3: '/icons/skills/power-strike.png',
};

export const ITEM_ICONS: Record<number, string> = {
  13: '/icons/items/short-bow.png',
  17: '/icons/items/wooden-arrow.png',
  57: '/icons/items/adena.png',
  112: '/icons/items/apprentices-earring.png',
  116: '/icons/items/magic-ring.png',
  118: '/icons/items/magic-necklace.png',
  426: '/icons/items/tunic.png',
  462: '/icons/items/stockings.png',
  1060: '/icons/items/healing-potion.png',
  1835: '/icons/items/soulshot.png',
  1786: '/icons/items/recipe-broadsword.png',
  1788: '/icons/items/recipe-bow.png',
  1864: '/icons/items/stem.png',
  1867: '/icons/items/animal-skin.png',
  1868: '/icons/items/thread.png',
  1871: '/icons/items/charcoal.png',
  2369: '/icons/items/squires-sword.png',
};

export function getSkillIconPath(skillId: number): string {
  return SKILL_ICONS[skillId] ?? FALLBACK_ICON;
}

export function getItemIconPath(itemId: number): string {
  return ITEM_ICONS[itemId] ?? FALLBACK_ICON;
}

/** P1 manifest paths that must exist on disk (tests + build gate). */
export const P1_ICON_PATHS: readonly string[] = [
  FALLBACK_ICON,
  ...Object.values(SKILL_ICONS),
  ...Object.values(ITEM_ICONS),
];
