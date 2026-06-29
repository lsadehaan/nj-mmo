/** STR bonus table seeded from L2J statBonus.xml (fixture subset). */
const STR_BONUS: Record<number, number> = {
  22: 0.63,
  23: 0.66,
  40: 1.2,
};

export function lookupStrBonus(str: number): number {
  const bonus = STR_BONUS[str];
  if (bonus === undefined) {
    throw new Error(`No STR bonus entry for value ${str}`);
  }
  return bonus;
}

export function registerStrBonusEntries(entries: Record<number, number>): void {
  Object.assign(STR_BONUS, entries);
}
