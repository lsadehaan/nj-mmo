export const MAX_SAFE_ENCHANT = 3;

export type EnchantItemMeta = {
  crystalType: string | null;
  enchantEnabled: boolean;
  type: string;
};

export type EnchantScrollMeta = {
  itemId: number;
  /** 955 = weapon D, 956 = armor D */
  grade: 'D';
  target: 'weapon' | 'armor';
};

export const ENCHANT_WEAPON_SCROLL_D = 955;
export const ENCHANT_ARMOR_SCROLL_D = 956;

export function scrollMeta(itemId: number): EnchantScrollMeta | null {
  if (itemId === ENCHANT_WEAPON_SCROLL_D) {
    return { itemId, grade: 'D', target: 'weapon' };
  }
  if (itemId === ENCHANT_ARMOR_SCROLL_D) {
    return { itemId, grade: 'D', target: 'armor' };
  }
  return null;
}

export function canEnchant(
  item: EnchantItemMeta,
  scrollItemId: number,
  currentLevel: number
): string | null {
  if (!item.enchantEnabled || !item.crystalType) {
    return 'not_enchantable';
  }
  const scroll = scrollMeta(scrollItemId);
  if (!scroll) return 'wrong_scroll';
  if (item.crystalType !== scroll.grade) return 'wrong_scroll';
  const isWeapon = item.type === 'weapon';
  if (scroll.target === 'weapon' && !isWeapon) return 'wrong_scroll';
  if (scroll.target === 'armor' && isWeapon) return 'wrong_scroll';
  if (currentLevel >= MAX_SAFE_ENCHANT) return 'max_safe_enchant';
  return null;
}

export function rollEnchant(currentLevel: number, rng: () => number): boolean {
  if (currentLevel >= MAX_SAFE_ENCHANT) return false;
  // Safe zone +1..+3: 100% per EnchantItemGroups 0-2
  if (currentLevel <= 2) return true;
  return rng() < 0;
}

/** Classic 1H weapon safe-zone: 4 × enchant level */
export function enchantPAtkBonus(
  weaponType: string | null | undefined,
  bodyPart: string | null | undefined,
  level: number
): number {
  if (level <= 0) return 0;
  if (bodyPart === 'lrhand') return 8 * level;
  return 4 * level;
}

/** Classic armor safe-zone: +1 pDef per level */
export function enchantPDefBonus(level: number): number {
  return level > 0 ? level : 0;
}
