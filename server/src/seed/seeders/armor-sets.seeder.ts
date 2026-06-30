import type { AppDatabase } from '../../db/client';
import { armorSets } from '../../db/schema';

/** Wooden (skill 3500) and Mithril (skill 3502) TI armor sets from L2J Sets.xml. */
const TI_ARMOR_SETS = [
  {
    setId: 0,
    requiredItemIdsJson: JSON.stringify([23, 2386, 43]),
    pDefPercentBonus: 0.02,
    maxHpBonus: 41,
  },
  {
    setId: 1,
    requiredItemIdsJson: JSON.stringify([58, 59, 47]),
    pDefPercentBonus: 0.05,
    maxHpBonus: 0,
  },
] as const;

export function seedArmorSets(db: AppDatabase): number {
  db.insert(armorSets).values([...TI_ARMOR_SETS]).run();
  return TI_ARMOR_SETS.length;
}
