import { describe, it, expect } from 'vitest';
import { canCraft, applyCraft, DWARF_CRAFT_CLASS_IDS } from './craft';

const RECIPE_2 = {
  recipeId: 2,
  mpCost: 30,
  successRate: 100,
  productItemId: 3,
  productCount: 1,
  recipeItemId: 1786,
  ingredients: [
    { itemId: 2005, count: 1 },
    { itemId: 1869, count: 18 },
    { itemId: 1870, count: 18 },
  ],
};

describe('craft', () => {
  it('allows dwarf fighter class ids 53/54/56', () => {
    for (const id of [53, 54, 56]) {
      expect(DWARF_CRAFT_CLASS_IDS.has(id)).toBe(true);
    }
  });

  it('rejects human fighter craft (ITEM25-40)', () => {
    expect(
      canCraft({
        classId: 0,
        recipe: RECIPE_2,
        inventory: { 1786: 1, 2005: 1, 1869: 18, 1870: 18 },
        mp: 50,
      })
    ).toBe('not_dwarf');
  });

  it('rejects missing ingredients without partial consume (ITEM25-41)', () => {
    expect(
      canCraft({
        classId: 53,
        recipe: RECIPE_2,
        inventory: { 1786: 1, 2005: 1, 1869: 5 },
        mp: 50,
      })
    ).toBe('missing_ingredients');
  });

  it('consumes recipe 2 ingredients and grants Broadsword (ITEM25-37, ITEM25-38)', () => {
    const inventory = { 1786: 1, 2005: 1, 1869: 18, 1870: 18 };
    expect(canCraft({ classId: 53, recipe: RECIPE_2, inventory, mp: 50 })).toBeNull();
    const result = applyCraft({ recipe: RECIPE_2, inventory, mp: 50 });
    expect(result.mp).toBe(20);
    expect(result.inventory[3]).toBe(1);
    expect(result.inventory[1786]).toBeUndefined();
    expect(result.inventory[2005]).toBeUndefined();
    expect(result.inventory[1869]).toBeUndefined();
    expect(result.inventory[1870]).toBeUndefined();
  });
});
