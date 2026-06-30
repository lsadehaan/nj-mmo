/** STR bonus table seeded from L2J statBonus.xml (fixture subset). */
const STR_BONUS: Record<number, number> = {
  22: 0.63,
  23: 0.66,
  40: 1.2,
};

/** INT bonus table subset from L2J statBonus.xml. */
const INT_BONUS: Record<number, number> = {
  19: 1.21,
  21: 1.23,
  41: 1.5,
};

/** DEX bonus table subset from L2J statBonus.xml. */
const DEX_BONUS: Record<number, number> = {
  21: 1.23,
  30: 1.35,
};

/** CON bonus table subset from L2J statBonus.xml. */
const CON_BONUS: Record<number, number> = {
  43: 1.41,
};

export function lookupStrBonus(str: number): number {
  const bonus = STR_BONUS[str];
  if (bonus === undefined) {
    throw new Error(`No STR bonus entry for value ${str}`);
  }
  return bonus;
}

export function lookupIntBonus(int: number): number {
  const bonus = INT_BONUS[int];
  if (bonus === undefined) {
    throw new Error(`No INT bonus entry for value ${int}`);
  }
  return bonus;
}

export function lookupDexBonus(dex: number): number {
  const bonus = DEX_BONUS[dex];
  if (bonus === undefined) {
    throw new Error(`No DEX bonus entry for value ${dex}`);
  }
  return bonus;
}

export function lookupConBonus(con: number): number {
  const bonus = CON_BONUS[con];
  if (bonus === undefined) {
    throw new Error(`No CON bonus entry for value ${con}`);
  }
  return bonus;
}

export function registerStrBonusEntries(entries: Record<number, number>): void {
  Object.assign(STR_BONUS, entries);
}

export function registerIntBonusEntries(entries: Record<number, number>): void {
  Object.assign(INT_BONUS, entries);
}

export function registerDexBonusEntries(entries: Record<number, number>): void {
  Object.assign(DEX_BONUS, entries);
}

export function registerConBonusEntries(entries: Record<number, number>): void {
  Object.assign(CON_BONUS, entries);
}
