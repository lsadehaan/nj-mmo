/**
 * Curated, client-side names + descriptions for the skills and items that
 * appear in the Talking Island vertical slice. Names mirror the L2J Classic
 * reference data; descriptions are short, player-facing summaries used by the
 * hover tooltips on the hotbar, skill window, and inventory.
 *
 * Unknown ids fall back to a generic label so a tooltip always shows *something*
 * (the previous behaviour showed nothing at all on hover).
 */

export interface CatalogEntry {
  name: string;
  description: string;
}

const SKILL_CATALOG: Record<number, CatalogEntry> = {
  3: {
    name: 'Power Strike',
    description: 'Physical melee attack that deals heavy weapon damage to a single target.',
  },
  29: {
    name: 'Iron Punch',
    description: 'Physical attack that strikes a single target with a powerful blow.',
  },
  1068: {
    name: 'Might',
    description: 'Buff. Increases the P. Atk. of the target for a duration.',
  },
  1164: {
    name: 'Curse: Weakness',
    description: "Debuff. Lowers the target's P. Atk., weakening its attacks.",
  },
  1177: {
    name: 'Wind Strike',
    description: 'Magic attack. Hurls a blade of wind that deals magic damage to a single target.',
  },
};

const ITEM_CATALOG: Record<number, CatalogEntry> = {
  57: { name: 'Adena', description: 'The common currency used for trade throughout the world.' },
  1060: {
    name: 'Healing Potion',
    description: 'Consumable. Gradually restores HP over a short time when used.',
  },
  2369: {
    name: "Squire's Sword",
    description: 'One-handed sword. A dependable starter weapon for new fighters.',
  },
  3: { name: 'Broadsword', description: 'One-handed sword. A sturdy, balanced melee weapon.' },
  13: { name: 'Short Bow', description: 'Bow. A light ranged weapon for hit-and-run attacks.' },
  23: { name: 'Wooden Breastplate', description: 'Light armor worn on the upper body.' },
  28: { name: 'Pants', description: 'Light armor worn on the lower body.' },
  43: { name: 'Wooden Helmet', description: 'A simple helmet that protects the head.' },
  47: { name: 'Headgear', description: 'A protective helmet for the head.' },
  58: { name: 'Mithril Breastplate', description: 'Heavy armor worn on the upper body.' },
  59: { name: 'Mithril Gaiters', description: 'Heavy armor worn on the lower body.' },
  112: { name: "Apprentice's Earring", description: 'Earring accessory. Boosts core attributes.' },
  116: { name: 'Magic Ring', description: 'Ring accessory. Boosts core attributes.' },
  118: { name: 'Magic Necklace', description: 'Necklace accessory. Boosts core attributes.' },
  2386: { name: 'Wooden Gaiters', description: 'Light armor worn on the lower body.' },
};

export function getSkillInfo(skillId: number): CatalogEntry {
  return (
    SKILL_CATALOG[skillId] ?? {
      name: `Skill ${skillId}`,
      description: 'No additional information available.',
    }
  );
}

export function getItemInfo(itemId: number): CatalogEntry {
  return (
    ITEM_CATALOG[itemId] ?? {
      name: `Item ${itemId}`,
      description: 'No additional information available.',
    }
  );
}
