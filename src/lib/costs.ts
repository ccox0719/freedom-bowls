import type { Tables } from './database.types';

export type Ingredient = Tables<'ingredients'>;
export type Recipe = Tables<'recipes'>;
export type RecipeIngredient = Tables<'recipe_ingredients'> & {
  ingredients: Ingredient | null;
};

export type CostLine = {
  id: string;
  ingredientName: string;
  amount: number;
  amountUnit: string;
  gramsUsed: number;
  costPerGram: number;
  lineCost: number;
};

const gallonsByUnit: Record<string, number> = {
  gallon: 1,
  gallons: 1,
  gal: 1,
  quart: 0.25,
  quarts: 0.25,
  qt: 0.25,
  cup: 0.0625,
  cups: 0.0625,
  ounce: 1 / 128,
  ounces: 1 / 128,
  oz: 1 / 128,
  'fl oz': 1 / 128,
  floz: 1 / 128,
};

export const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundCurrency(value));
};

export const calculateIngredientCost = (gramsUsed: number, costPerGram: number) =>
  gramsUsed * costPerGram;

export const buildCostLines = (recipeIngredients: RecipeIngredient[]): CostLine[] =>
  recipeIngredients.map((line) => {
    const costPerGram = Number(line.ingredients?.cost_per_gram ?? 0);
    const gramsUsed = Number(line.grams_used ?? 0);

    return {
      id: line.id,
      ingredientName: line.ingredients?.name ?? 'Unknown ingredient',
      amount: Number(line.amount ?? 0),
      amountUnit: line.amount_unit,
      gramsUsed,
      costPerGram,
      lineCost: calculateIngredientCost(gramsUsed, costPerGram),
    };
  });

export const calculateBatchCost = (recipeIngredients: RecipeIngredient[]) =>
  buildCostLines(recipeIngredients).reduce((total, line) => total + line.lineCost, 0);

export const recipeYieldInGallons = (recipe: Pick<Recipe, 'yield_amount' | 'yield_unit'>) => {
  const amount = Number(recipe.yield_amount ?? 0);
  const unit = recipe.yield_unit?.trim().toLowerCase();

  if (!amount || !unit) return null;

  const gallonFactor = gallonsByUnit[unit];
  return gallonFactor ? amount * gallonFactor : null;
};

export const calculateRecipeCosts = (recipe: Recipe, recipeIngredients: RecipeIngredient[]) => {
  const totalBatchCost = calculateBatchCost(recipeIngredients);
  const gallons = recipeYieldInGallons(recipe);
  const costPerGallon = gallons && gallons > 0 ? totalBatchCost / gallons : null;
  const costPerOunce = gallons && gallons > 0 ? totalBatchCost / (gallons * 128) : null;
  const costPerServing = recipe.servings ? totalBatchCost / recipe.servings : null;

  return {
    lines: buildCostLines(recipeIngredients),
    totalBatchCost,
    costPerGallon,
    costPerOunce,
    costPerServing,
  };
};
