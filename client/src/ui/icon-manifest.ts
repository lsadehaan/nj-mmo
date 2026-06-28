export const FALLBACK_ICON = '/icons/placeholder.png';

export const SKILL_ICONS: Record<number, string> = {
  3: '/icons/skills/power-strike.png',
};

export const ITEM_ICONS: Record<number, string> = {
  57: '/icons/items/adena.png',
  17: '/icons/items/wooden-arrow.png',
  1060: '/icons/items/healing-potion.png',
  1835: '/icons/items/soulshot.png',
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
