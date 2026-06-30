export const DWARF_CRAFT_CLASS_IDS = new Set([53, 54, 56]);

export type RecipeIngredient = { itemId: number; count: number };

export type CraftRecipe = {
  recipeId: number;
  mpCost: number;
  successRate: number;
  productItemId: number;
  productCount: number;
  ingredients: RecipeIngredient[];
  /** Recipe etcitem id (e.g. 1786 for recipe 2) */
  recipeItemId: number;
};

export function canCraft(params: {
  classId: number;
  recipe: CraftRecipe;
  inventory: Record<number, number>;
  mp: number;
}): string | null {
  if (!DWARF_CRAFT_CLASS_IDS.has(params.classId)) {
    return 'not_dwarf';
  }
  if (params.mp < params.recipe.mpCost) {
    return 'insufficient_mp';
  }
  const recipeCount = params.inventory[params.recipe.recipeItemId] ?? 0;
  if (recipeCount < 1) {
    return 'missing_recipe';
  }
  for (const ing of params.recipe.ingredients) {
    if ((params.inventory[ing.itemId] ?? 0) < ing.count) {
      return 'missing_ingredients';
    }
  }
  return null;
}

export type CraftResult = {
  inventory: Record<number, number>;
  mp: number;
  productItemId: number;
  productCount: number;
};

export function applyCraft(params: {
  recipe: CraftRecipe;
  inventory: Record<number, number>;
  mp: number;
}): CraftResult {
  const inventory = { ...params.inventory };
  inventory[params.recipe.recipeItemId] =
    (inventory[params.recipe.recipeItemId] ?? 0) - 1;
  if (inventory[params.recipe.recipeItemId] <= 0) {
    delete inventory[params.recipe.recipeItemId];
  }
  for (const ing of params.recipe.ingredients) {
    inventory[ing.itemId] = (inventory[ing.itemId] ?? 0) - ing.count;
    if (inventory[ing.itemId] <= 0) delete inventory[ing.itemId];
  }
  inventory[params.recipe.productItemId] =
    (inventory[params.recipe.productItemId] ?? 0) + params.recipe.productCount;
  return {
    inventory,
    mp: params.mp - params.recipe.mpCost,
    productItemId: params.recipe.productItemId,
    productCount: params.recipe.productCount,
  };
}
