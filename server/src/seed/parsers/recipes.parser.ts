import type { NewRecipe } from '../../db/schema';
import { xmlParser, parseNumber, parseString } from './xml-utils';

interface RecipeIngredientNode {
  '@_id': string;
  '@_count': string;
}

interface RecipeStatUseNode {
  '@_name': string;
  '@_value': string;
}

interface RecipeItemNode {
  '@_id': string;
  '@_name': string;
  '@_craftLevel': string;
  '@_successRate': string;
  ingredient?: RecipeIngredientNode | RecipeIngredientNode[];
  production?: RecipeIngredientNode;
  statUse?: RecipeStatUseNode | RecipeStatUseNode[];
}

export function parseRecipesXml(xml: string): NewRecipe[] {
  const doc = xmlParser.parse(xml) as { list?: { item?: RecipeItemNode | RecipeItemNode[] } };
  const nodes = doc.list?.item;
  if (!nodes) {
    throw new Error('Recipes XML missing item nodes');
  }

  const itemList = Array.isArray(nodes) ? nodes : [nodes];
  const results: NewRecipe[] = [];

  for (const node of itemList) {
    const recipeId = parseNumber(node['@_id'], 'id', node['@_id']);
    const name = parseString(recipeId, 'name', node['@_name']);
    const craftLevel = parseNumber(recipeId, 'craftLevel', node['@_craftLevel']);
    const successRate = parseNumber(recipeId, 'successRate', node['@_successRate']);

    const ingredients = node.ingredient
      ? (Array.isArray(node.ingredient) ? node.ingredient : [node.ingredient])
      : [];
    const ingredientsJson = JSON.stringify(
      ingredients.map((ing) => ({
        itemId: parseNumber(recipeId, 'ingredientId', ing['@_id']),
        count: parseNumber(recipeId, 'ingredientCount', ing['@_count']),
      }))
    );

    const production = node.production;
    if (!production) {
      throw new Error(`Recipe ${recipeId} missing production`);
    }
    const productItemId = parseNumber(recipeId, 'productId', production['@_id']);
    const productCount = parseNumber(recipeId, 'productCount', production['@_count']);

    const statUses = node.statUse
      ? Array.isArray(node.statUse)
        ? node.statUse
        : [node.statUse]
      : [];
    const mpUse = statUses.find((s) => s['@_name'] === 'MP');
    const mpCost = mpUse ? parseNumber(recipeId, 'mpCost', mpUse['@_value']) : 0;

    results.push({
      recipeId,
      name,
      craftLevel,
      successRate,
      mpCost,
      productItemId,
      productCount,
      ingredientsJson,
    });
  }

  return results.sort((a, b) => (a.recipeId ?? 0) - (b.recipeId ?? 0));
}
