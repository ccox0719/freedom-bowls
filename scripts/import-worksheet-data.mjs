import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();
const gramsByUnit = {
  lb: 453.59237,
  lbs: 453.59237,
  pound: 453.59237,
  pounds: 453.59237,
  gal: 3785.411784,
  gallon: 3785.411784,
  gallons: 3785.411784,
  qt: 946.352946,
  quart: 946.352946,
  quarts: 946.352946,
  cup: 236.5882365,
  cups: 236.5882365,
  tbsp: 14.7867648,
  Tbsp: 14.7867648,
  tsp: 4.92892159,
  oz: 28.3495231,
  ounce: 28.3495231,
  ounces: 28.3495231,
  g: 1,
  gram: 1,
  grams: 1,
  each: 1,
};

const files = {
  costLibrary: 'Freedom_Bowls_Catering_Calc - Cost Library.csv',
  menuComponents: 'Freedom_Bowls_Catering_Calc - Menu Components.csv',
  sauceCosts: 'Freedom_Bowls_Catering_Calc - Sauce Costs.csv',
  events: 'events.json',
};

const liquidOuncesPerGallon = 128;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }

  const [headers, ...body] = rows.filter((candidate) =>
    candidate.some((value) => value.trim() !== ''),
  );

  return body.map((candidate) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), candidate[index]?.trim() ?? ''])),
  );
}

async function readCsv(fileName) {
  return parseCsv(await fs.readFile(path.join(root, fileName), 'utf8'));
}

function parseNumber(value) {
  const cleaned = String(value ?? '').replace(/[$,%]/g, '').trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function slugEventKey(type) {
  return type
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function normalizeName(name) {
  return name === 'Mustardy Habanero Hot Sauce (tamed)' ? 'Mustardy Habanero Hot Sauce' : name;
}

function unitToGrams(unit) {
  const cleaned = String(unit ?? '').replace(/^USD\//, '').trim();
  return gramsByUnit[cleaned] ?? null;
}

function costLibraryIngredient(row) {
  const name = normalizeName(row['Data Point']);

  if (name === 'Packaging cost per bowl') {
    return {
      name,
      default_purchase_price: parseNumber(row['Default Value']) ?? 0,
      purchase_unit: '1 disposable set',
      grams_per_purchase_unit: 1,
      recommended_source: row['Recommended Source'] || null,
      notes: [row.Category, row.Notes].filter(Boolean).join(' - ') || null,
    };
  }

  const price = parseNumber(row['Default Value']);
  const grams = unitToGrams(row.Unit);

  if (price === null || grams === null) return null;

  const purchaseUnit = row.Unit.replace(/^USD\//, '').trim();
  return {
    name,
    default_purchase_price: price,
    purchase_unit: `1 ${purchaseUnit}`,
    grams_per_purchase_unit: grams,
    recommended_source: row['Recommended Source'] || null,
    notes: [row.Category, row.Notes].filter(Boolean).join(' - ') || null,
  };
}

function sauceIngredient(row) {
  if (row['Data Point'] === 'Sauce total') return null;

  const price = parseNumber(row['Default Value']);
  const grams = unitToGrams(row.Unit);

  if (price === null || grams === null) return null;

  return {
    name: normalizeName(row['Data Point']),
    default_purchase_price: price,
    purchase_unit: `1 ${row.Unit.replace(/^USD\//, '').trim()}`,
    grams_per_purchase_unit: grams,
    recommended_source: row['Recommended Source'] || null,
    notes: row['Notes (grams for recipe building)'] || null,
  };
}

function menuIngredientAmount(row) {
  const amount = parseNumber(row.Portion) ?? 0;
  const name = normalizeName(row.Ingredient);

  if (name === 'Packaging cost per bowl') {
    return { amount, amount_unit: 'each' };
  }

  const grams = unitToGrams(row.Unit);
  if (!grams) return { amount, amount_unit: row.Unit };

  return { amount: Number((amount * grams).toFixed(3)), amount_unit: 'g' };
}

async function loadEnv() {
  const envText = await fs.readFile(path.join(root, '.env'), 'utf8');
  return Object.fromEntries(
    envText
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

async function upsertByName(supabase, table, rows) {
  if (!rows.length) return [];

  const { data, error } = await supabase.from(table).upsert(rows, { onConflict: 'name' }).select('*');
  if (error) throw new Error(`${table} upsert failed: ${error.message}`);

  return data ?? [];
}

async function main() {
  const env = await loadEnv();
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  const [costRows, sauceRows, menuRows] = await Promise.all([
    readCsv(files.costLibrary),
    readCsv(files.sauceCosts),
    readCsv(files.menuComponents),
  ]);
  const events = JSON.parse(await fs.readFile(path.join(root, files.events), 'utf8'));
  const menuPrice = parseNumber(
    costRows.find((row) => row['Data Point'] === 'Menu price per bowl')?.['Default Value'],
  );

  const ingredientMap = new Map();
  for (const row of costRows) {
    const ingredient = costLibraryIngredient(row);
    if (ingredient) ingredientMap.set(ingredient.name, ingredient);
  }
  for (const row of sauceRows) {
    const ingredient = sauceIngredient(row);
    if (ingredient) ingredientMap.set(ingredient.name, ingredient);
  }

  const ingredients = await upsertByName(supabase, 'ingredients', [...ingredientMap.values()]);
  const ingredientIds = new Map(ingredients.map((ingredient) => [ingredient.name, ingredient.id]));

  const assumptions = costRows.map((row) => ({
    category: row.Category,
    name: row['Data Point'],
    default_value: parseNumber(row['Default Value']),
    unit: row.Unit || null,
    recommended_source: row['Recommended Source'] || null,
    notes: row.Notes || null,
  }));
  const { error: assumptionsError } = await supabase
    .from('cost_assumptions')
    .upsert(assumptions, { onConflict: 'name' });
  if (assumptionsError) {
    throw new Error(`cost_assumptions upsert failed: ${assumptionsError.message}`);
  }

  const sauceSummaryRows = sauceRows.filter((row) => row['Data Point'] === 'Sauce total');
  const recipes = await upsertByName(
    supabase,
    'recipes',
    sauceSummaryRows.map((row) => {
      const totalGrams = parseNumber(row['Total Grams (auto)']);
      return {
        name: normalizeName(row.Name),
        category: 'Sauce',
        yield_amount: totalGrams ? Number((totalGrams / gramsByUnit.gal).toFixed(4)) : null,
        yield_unit: 'gallons',
        servings: totalGrams ? Math.round(totalGrams / gramsByUnit.oz) : null,
        notes: `Imported from Sauce Costs worksheet. ${row['Notes (grams for recipe building)'] || ''}`.trim(),
      };
    }),
  );
  const recipeIds = new Map(recipes.map((recipe) => [recipe.name, recipe.id]));

  const { error: recipeDeleteError } = await supabase
    .from('recipe_ingredients')
    .delete()
    .in('recipe_id', [...recipeIds.values()]);
  if (recipeDeleteError) {
    throw new Error(`recipe_ingredients delete failed: ${recipeDeleteError.message}`);
  }

  const recipeLines = sauceRows
    .filter((row) => row['Data Point'] !== 'Sauce total')
    .map((row) => {
      const grams = parseNumber(row['Grams (parsed)']);
      return {
        recipe_id: recipeIds.get(normalizeName(row.Name)),
        ingredient_id: ingredientIds.get(normalizeName(row['Data Point'])),
        amount: grams,
        amount_unit: 'g',
        grams_used: grams,
        notes: `Imported from Sauce Costs worksheet. Batch line cost: ${row['Ingredient Cost (batch)'] || 'n/a'}`,
      };
    })
    .filter((row) => row.recipe_id && row.ingredient_id && row.grams_used !== null);

  if (recipeLines.length) {
    const { error } = await supabase.from('recipe_ingredients').insert(recipeLines);
    if (error) throw new Error(`recipe_ingredients insert failed: ${error.message}`);
  }

  const menuNames = [...new Set(menuRows.map((row) => row['Menu Item']).filter(Boolean))];
  const menuItems = await upsertByName(
    supabase,
    'menu_items',
    menuNames.map((name) => ({
      name,
      description: null,
      sell_price: menuPrice,
      notes: 'Imported from Menu Components worksheet.',
    })),
  );
  const menuIds = new Map(menuItems.map((item) => [item.name, item.id]));

  const { error: componentDeleteError } = await supabase
    .from('menu_item_components')
    .delete()
    .in('menu_item_id', [...menuIds.values()]);
  if (componentDeleteError) {
    throw new Error(`menu_item_components delete failed: ${componentDeleteError.message}`);
  }

  const missing = new Set();
  const components = [];
  for (const row of menuRows) {
    const menu_item_id = menuIds.get(row['Menu Item']);
    const componentName = normalizeName(row.Ingredient);
    const notes = [row.Component, row.Notes].filter(Boolean).join(' - ') || null;

    if (!menu_item_id || !componentName) continue;

    if (recipeIds.has(componentName)) {
      const worksheetAmount = parseNumber(row.Portion) ?? 0;
      const ounces = row.Unit === 'gal' ? worksheetAmount * liquidOuncesPerGallon : worksheetAmount;
      components.push({
        menu_item_id,
        component_type: 'recipe',
        recipe_id: recipeIds.get(componentName),
        ingredient_id: null,
        amount: Number(ounces.toFixed(3)),
        amount_unit: 'oz',
        notes,
      });
    } else if (ingredientIds.has(componentName)) {
      const amount = menuIngredientAmount(row);
      components.push({
        menu_item_id,
        component_type: 'ingredient',
        recipe_id: null,
        ingredient_id: ingredientIds.get(componentName),
        amount: amount.amount,
        amount_unit: amount.amount_unit,
        notes,
      });
    } else {
      missing.add(componentName);
    }
  }

  if (components.length) {
    const { error } = await supabase.from('menu_item_components').insert(components);
    if (error) throw new Error(`menu_item_components insert failed: ${error.message}`);
  }

  const laborValue = (eventKind, suffix) =>
    parseNumber(
      costRows.find((row) => row['Data Point'] === `${eventKind} ${suffix}`)?.['Default Value'],
    );
  const eventKindByType = {
    'Community Pop-Up': 'Community',
    'Brewery Night': 'Community',
    'Corporate Lunch': 'Catering',
    'Festival Day': 'Festival',
    'Private Catering': 'Catering',
  };
  const eventTypeRows = events.event_types.map((eventType) => {
    const kind = eventKindByType[eventType.type] ?? 'Community';
    const staff = laborValue(kind, 'staff count') ?? eventType.staff_required;
    const serviceHours = laborValue(kind, 'service hours') ?? eventType.hours_on_site;
    const prepHours = laborValue(kind, 'prep hours') ?? 0;
    const wage = laborValue(kind, 'wage') ?? 0;
    const crewLeadBonus = laborValue(kind, 'crew lead bonus') ?? 0;
    const covers = menuPrice ? Math.max(1, Math.round(eventType.average_gross / menuPrice)) : 1;

    return {
      type: eventType.type,
      covers,
      service_hours: serviceHours,
      prep_hours: prepHours,
      staff_count: staff,
      wage,
      crew_lead_bonus: crewLeadBonus,
      avg_gross: eventType.average_gross,
      notes: `Imported from events.json and ${kind} labor assumptions.`,
    };
  });
  const { error: eventTypesError } = await supabase
    .from('event_types')
    .upsert(eventTypeRows, { onConflict: 'type' });
  if (eventTypesError) throw new Error(`event_types upsert failed: ${eventTypesError.message}`);

  const eventTypeNamesBySlug = new Map(
    events.event_types.map((eventType) => [slugEventKey(eventType.type), eventType.type]),
  );
  const aliasByPlanKey = new Map([
    ['community_popups', 'Community Pop-Up'],
    ['brewery_nights', 'Brewery Night'],
    ['corporate_lunches', 'Corporate Lunch'],
    ['festival_days', 'Festival Day'],
    ['private_catering', 'Private Catering'],
  ]);
  const planRows = events.annual_examples.flatMap((plan) =>
    Object.entries(plan.events).map(([key, count]) => ({
      plan_name: plan.plan_name,
      event_type: aliasByPlanKey.get(key) ?? eventTypeNamesBySlug.get(key) ?? key,
      event_count: count,
      notes: 'Imported from events.json.',
    })),
  );
  const { error: plansError } = await supabase
    .from('annual_plan_events')
    .upsert(planRows, { onConflict: 'plan_name,event_type' });
  if (plansError) throw new Error(`annual_plan_events upsert failed: ${plansError.message}`);

  console.log(
    JSON.stringify(
      {
        ingredients: ingredients.length,
        recipes: recipes.length,
        recipeLines: recipeLines.length,
        menuItems: menuItems.length,
        menuComponents: components.length,
        costAssumptions: assumptions.length,
        eventTypes: eventTypeRows.length,
        annualPlanEvents: planRows.length,
        missing: [...missing],
        costLibraryRowsNotMappedToCurrentFoodSchema: costRows.filter((row) => !costLibraryIngredient(row)).length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
