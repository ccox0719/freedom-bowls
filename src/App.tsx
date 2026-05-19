import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calculator,
  ClipboardList,
  FileSpreadsheet,
  Library,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  TrendingUp,
  Utensils,
} from 'lucide-react';
import { hasSupabaseConfig, supabase } from './lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from './lib/database.types';
import {
  calculateIngredientCost,
  calculateRecipeCosts,
  formatCurrency,
  recipeYieldInGallons,
  type RecipeIngredient,
} from './lib/costs';

// ── Types ─────────────────────────────────────────────────────────────────────

type Ingredient = Tables<'ingredients'>;
type Recipe = Tables<'recipes'>;
type RecipeLine = RecipeIngredient;
type MenuItem = Tables<'menu_items'>;
type MenuItemComponent = Tables<'menu_item_components'> & {
  recipes: Recipe | null;
  ingredients: Ingredient | null;
};
type CostAssumption = Tables<'cost_assumptions'>;
type EventType = Tables<'event_types'>;
type AnnualPlanEvent = Tables<'annual_plan_events'>;
type Tab =
  | 'ingredients'
  | 'builder'
  | 'costs'
  | 'menu'
  | 'prep'
  | 'events'
  | 'assumptions';

type IngredientForm = {
  id?: string;
  name: string;
  default_purchase_price: string;
  purchase_unit: string;
  grams_per_purchase_unit: string;
  recommended_source: string;
  notes: string;
};

type RecipeForm = {
  id?: string;
  name: string;
  category: string;
  yield_amount: string;
  yield_unit: string;
  servings: string;
  notes: string;
};

type LineForm = {
  ingredient_id: string;
  amount: string;
  amount_unit: string;
  grams_used: string;
  notes: string;
};

type MenuItemForm = {
  id?: string;
  name: string;
  description: string;
  sell_price: string;
  notes: string;
};

type ComponentForm = {
  component_type: 'recipe' | 'ingredient';
  recipe_id: string;
  ingredient_id: string;
  amount: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const emptyIngredientForm: IngredientForm = {
  name: '',
  default_purchase_price: '',
  purchase_unit: '',
  grams_per_purchase_unit: '',
  recommended_source: '',
  notes: '',
};

const emptyRecipeForm: RecipeForm = {
  name: '',
  category: 'Sauce',
  yield_amount: '',
  yield_unit: 'gallons',
  servings: '',
  notes: '',
};

const emptyLineForm: LineForm = {
  ingredient_id: '',
  amount: '',
  amount_unit: '',
  grams_used: '',
  notes: '',
};

const emptyMenuItemForm: MenuItemForm = {
  name: '',
  description: '',
  sell_price: '',
  notes: '',
};

const emptyComponentForm: ComponentForm = {
  component_type: 'recipe',
  recipe_id: '',
  ingredient_id: '',
  amount: '',
};

const tabs: { id: Tab; label: string; icon: typeof Library }[] = [
  { id: 'ingredients', label: 'Ingredients', icon: Library },
  { id: 'builder', label: 'Recipe Builder', icon: BookOpen },
  { id: 'costs', label: 'Recipe Costs', icon: Calculator },
  { id: 'menu', label: 'Menu Items', icon: Utensils },
  { id: 'prep', label: 'Prep Planner', icon: ClipboardList },
  { id: 'events', label: 'Events & Revenue', icon: TrendingUp },
  { id: 'assumptions', label: 'Cost Library', icon: FileSpreadsheet },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const toNumber = (value: string) => Number(value || 0);
const toNullableNumber = (value: string) => (value.trim() ? Number(value) : null);
const isMissingBusinessSchema = (message: string) =>
  message.includes("Could not find the table 'public.cost_assumptions'") ||
  message.includes("Could not find the table 'public.event_types'") ||
  message.includes("Could not find the table 'public.annual_plan_events'");

const computeMenuItemCost = (
  components: MenuItemComponent[],
  recipeCostById: Record<string, ReturnType<typeof calculateRecipeCosts>>,
  ingredients: Ingredient[],
) =>
  components.reduce(
    (total, comp) => total + getMenuComponentCost(comp, recipeCostById, ingredients),
    0,
  );

const getMenuComponentCost = (
  comp: MenuItemComponent,
  recipeCostById: Record<string, ReturnType<typeof calculateRecipeCosts>>,
  ingredients: Ingredient[],
) => {
  if (comp.component_type === 'recipe' && comp.recipe_id) {
    return Number(comp.amount) * (recipeCostById[comp.recipe_id]?.costPerOunce ?? 0);
  }

  if (comp.component_type === 'ingredient' && comp.ingredient_id) {
    const ing = ingredients.find((i) => i.id === comp.ingredient_id);
    return calculateIngredientCost(Number(comp.amount), Number(ing?.cost_per_gram ?? 0));
  }

  return 0;
};

const getComponentGroup = (component: MenuItemComponent) => {
  const explicitGroup = component.notes?.split(' - ')[0]?.trim();
  if (explicitGroup) return explicitGroup;

  if (component.ingredients?.notes?.startsWith('Proteins -')) return 'Protein';

  return 'Other';
};

const computeMenuCostBreakdown = (
  components: MenuItemComponent[],
  recipeCostById: Record<string, ReturnType<typeof calculateRecipeCosts>>,
  ingredients: Ingredient[],
) =>
  components.reduce<Record<string, number>>((breakdown, component) => {
    const group = getComponentGroup(component);
    breakdown[group] = (breakdown[group] ?? 0) + getMenuComponentCost(component, recipeCostById, ingredients);
    return breakdown;
  }, {});

// ── App ───────────────────────────────────────────────────────────────────────

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('ingredients');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeLines, setRecipeLines] = useState<RecipeLine[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuItemComponents, setMenuItemComponents] = useState<MenuItemComponent[]>([]);
  const [costAssumptions, setCostAssumptions] = useState<CostAssumption[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [annualPlanEvents, setAnnualPlanEvents] = useState<AnnualPlanEvent[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>('');
  const [ingredientForm, setIngredientForm] = useState<IngredientForm>(emptyIngredientForm);
  const [recipeForm, setRecipeForm] = useState<RecipeForm>(emptyRecipeForm);
  const [lineForm, setLineForm] = useState<LineForm>(emptyLineForm);
  const [menuItemForm, setMenuItemForm] = useState<MenuItemForm>(emptyMenuItemForm);
  const [componentForm, setComponentForm] = useState<ComponentForm>(emptyComponentForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId) ?? null;
  const selectedRecipeLines = recipeLines.filter((l) => l.recipe_id === selectedRecipeId);

  const recipeCostById = useMemo(() => {
    return recipes.reduce<Record<string, ReturnType<typeof calculateRecipeCosts>>>((acc, recipe) => {
      acc[recipe.id] = calculateRecipeCosts(
        recipe,
        recipeLines.filter((l) => l.recipe_id === recipe.id),
      );
      return acc;
    }, {});
  }, [recipeLines, recipes]);

  const selectedRecipeCosts = selectedRecipe
    ? calculateRecipeCosts(selectedRecipe, selectedRecipeLines)
    : null;

  const loadData = async () => {
    setLoading(true);
    setMessage('');

    const [
      ingredientsResult,
      recipesResult,
      linesResult,
      menuItemsResult,
      componentsResult,
      assumptionsResult,
      eventTypesResult,
      annualPlansResult,
    ] =
      await Promise.all([
        supabase.from('ingredients').select('*').order('name'),
        supabase.from('recipes').select('*').order('name'),
        supabase
          .from('recipe_ingredients')
          .select('*, ingredients(*)')
          .order('created_at', { ascending: true }),
        supabase.from('menu_items').select('*').order('name'),
        supabase
          .from('menu_item_components')
          .select('*, recipes(*), ingredients(*)')
          .order('created_at', { ascending: true }),
        supabase.from('cost_assumptions').select('*').order('category').order('name'),
        supabase.from('event_types').select('*').order('type'),
        supabase.from('annual_plan_events').select('*').order('plan_name').order('event_type'),
      ]);

    const criticalError =
      ingredientsResult.error ??
      recipesResult.error ??
      linesResult.error ??
      menuItemsResult.error ??
      componentsResult.error;
    const businessError =
      assumptionsResult.error ?? eventTypesResult.error ?? annualPlansResult.error;

    if (criticalError) {
      setMessage(criticalError.message);
    } else {
      setIngredients(ingredientsResult.data ?? []);
      setRecipes(recipesResult.data ?? []);
      setRecipeLines((linesResult.data ?? []) as RecipeLine[]);
      setMenuItems(menuItemsResult.data ?? []);
      setMenuItemComponents((componentsResult.data ?? []) as MenuItemComponent[]);
      setCostAssumptions(assumptionsResult.error ? [] : assumptionsResult.data ?? []);
      setEventTypes(eventTypesResult.error ? [] : eventTypesResult.data ?? []);
      setAnnualPlanEvents(annualPlansResult.error ? [] : annualPlansResult.data ?? []);
      setSelectedRecipeId((c) => c || recipesResult.data?.[0]?.id || '');
      setSelectedMenuItemId((c) => c || menuItemsResult.data?.[0]?.id || '');
      if (businessError && !isMissingBusinessSchema(businessError.message)) {
        setMessage(businessError.message);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  // ── Ingredient handlers ───────────────────────────────────────────────────

  const saveIngredient = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);

    const payload: TablesInsert<'ingredients'> | TablesUpdate<'ingredients'> = {
      name: ingredientForm.name.trim(),
      default_purchase_price: toNumber(ingredientForm.default_purchase_price),
      purchase_unit: ingredientForm.purchase_unit.trim(),
      grams_per_purchase_unit: toNumber(ingredientForm.grams_per_purchase_unit),
      recommended_source: ingredientForm.recommended_source.trim() || null,
      notes: ingredientForm.notes.trim() || null,
    };

    const result = ingredientForm.id
      ? await supabase.from('ingredients').update(payload).eq('id', ingredientForm.id)
      : await supabase.from('ingredients').insert(payload as TablesInsert<'ingredients'>);

    setSaving(false);
    if (result.error) { setMessage(result.error.message); return; }
    setIngredientForm(emptyIngredientForm);
    await loadData();
  };

  const editIngredient = (ingredient: Ingredient) => {
    setIngredientForm({
      id: ingredient.id,
      name: ingredient.name,
      default_purchase_price: String(ingredient.default_purchase_price),
      purchase_unit: ingredient.purchase_unit,
      grams_per_purchase_unit: String(ingredient.grams_per_purchase_unit),
      recommended_source: ingredient.recommended_source ?? '',
      notes: ingredient.notes ?? '',
    });
  };

  const deleteIngredient = async (id: string) => {
    if (!window.confirm('Delete this ingredient? This will fail if it is used in any recipe.')) return;
    setSaving(true);
    const result = await supabase.from('ingredients').delete().eq('id', id);
    setSaving(false);
    if (result.error) {
      setMessage(
        result.error.message.toLowerCase().includes('foreign')
          ? 'Cannot delete: ingredient is used in one or more recipes. Remove it from those recipes first.'
          : result.error.message,
      );
    } else {
      await loadData();
    }
  };

  // ── Recipe handlers ───────────────────────────────────────────────────────

  const saveRecipe = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);

    const payload: TablesInsert<'recipes'> | TablesUpdate<'recipes'> = {
      name: recipeForm.name.trim(),
      category: recipeForm.category.trim() || null,
      yield_amount: toNullableNumber(recipeForm.yield_amount),
      yield_unit: recipeForm.yield_unit.trim() || null,
      servings: recipeForm.servings.trim() ? Number.parseInt(recipeForm.servings, 10) : null,
      notes: recipeForm.notes.trim() || null,
    };

    const result = recipeForm.id
      ? await supabase.from('recipes').update(payload).eq('id', recipeForm.id).select('id').single()
      : await supabase.from('recipes').insert(payload as TablesInsert<'recipes'>).select('id').single();

    setSaving(false);
    if (result.error) { setMessage(result.error.message); return; }
    setRecipeForm(emptyRecipeForm);
    setSelectedRecipeId(result.data.id);
    await loadData();
  };

  const editRecipe = (recipe: Recipe) => {
    setRecipeForm({
      id: recipe.id,
      name: recipe.name,
      category: recipe.category ?? '',
      yield_amount: recipe.yield_amount ? String(recipe.yield_amount) : '',
      yield_unit: recipe.yield_unit ?? '',
      servings: recipe.servings ? String(recipe.servings) : '',
      notes: recipe.notes ?? '',
    });
  };

  const addRecipeLine = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRecipeId) return;

    setSaving(true);
    const payload: TablesInsert<'recipe_ingredients'> = {
      recipe_id: selectedRecipeId,
      ingredient_id: lineForm.ingredient_id,
      amount: toNumber(lineForm.amount),
      amount_unit: lineForm.amount_unit.trim(),
      grams_used: toNumber(lineForm.grams_used),
      notes: lineForm.notes.trim() || null,
    };

    const result = await supabase.from('recipe_ingredients').insert(payload);
    setSaving(false);
    if (result.error) { setMessage(result.error.message); return; }
    setLineForm(emptyLineForm);
    await loadData();
  };

  const deleteRecipeLine = async (lineId: string) => {
    setSaving(true);
    const result = await supabase.from('recipe_ingredients').delete().eq('id', lineId);
    setSaving(false);
    if (result.error) setMessage(result.error.message);
    else await loadData();
  };

  // ── Menu item handlers ────────────────────────────────────────────────────

  const saveMenuItem = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);

    const payload = {
      name: menuItemForm.name.trim(),
      description: menuItemForm.description.trim() || null,
      sell_price: toNullableNumber(menuItemForm.sell_price),
      notes: menuItemForm.notes.trim() || null,
    };

    const result = menuItemForm.id
      ? await supabase.from('menu_items').update(payload).eq('id', menuItemForm.id).select('id').single()
      : await supabase
          .from('menu_items')
          .insert(payload as TablesInsert<'menu_items'>)
          .select('id')
          .single();

    setSaving(false);
    if (result.error) { setMessage(result.error.message); return; }
    setMenuItemForm(emptyMenuItemForm);
    setSelectedMenuItemId(result.data.id);
    await loadData();
  };

  const editMenuItem = (item: MenuItem) => {
    setMenuItemForm({
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      sell_price: item.sell_price ? String(item.sell_price) : '',
      notes: item.notes ?? '',
    });
  };

  const deleteMenuItem = async (id: string) => {
    if (!window.confirm('Delete this menu item and all its components?')) return;
    setSaving(true);
    const result = await supabase.from('menu_items').delete().eq('id', id);
    setSaving(false);
    if (result.error) {
      setMessage(result.error.message);
    } else {
      if (selectedMenuItemId === id) setSelectedMenuItemId('');
      await loadData();
    }
  };

  const addComponent = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedMenuItemId) return;
    setSaving(true);

    const payload: TablesInsert<'menu_item_components'> = {
      menu_item_id: selectedMenuItemId,
      component_type: componentForm.component_type,
      recipe_id: componentForm.component_type === 'recipe' ? componentForm.recipe_id || null : null,
      ingredient_id:
        componentForm.component_type === 'ingredient' ? componentForm.ingredient_id || null : null,
      amount: toNumber(componentForm.amount),
      amount_unit: componentForm.component_type === 'recipe' ? 'oz' : 'g',
    };

    const result = await supabase.from('menu_item_components').insert(payload);
    setSaving(false);
    if (result.error) { setMessage(result.error.message); return; }
    setComponentForm(emptyComponentForm);
    await loadData();
  };

  const deleteComponent = async (componentId: string) => {
    setSaving(true);
    const result = await supabase.from('menu_item_components').delete().eq('id', componentId);
    setSaving(false);
    if (result.error) setMessage(result.error.message);
    else await loadData();
  };

  const saveCostAssumption = async (id: string, defaultValue: number | null) => {
    setSaving(true);
    const result = await supabase
      .from('cost_assumptions')
      .update({ default_value: defaultValue })
      .eq('id', id);
    setSaving(false);
    if (result.error) setMessage(result.error.message);
    else await loadData();
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Freedom Bowls</p>
          <h1>Food Truck Ops</h1>
        </div>
        <button className="icon-button" type="button" onClick={loadData} title="Refresh data">
          <RefreshCw size={18} />
        </button>
      </header>

      {!hasSupabaseConfig && (
        <section className="banner">
          Add your Supabase URL and anon key to <code>.env</code>, then restart the dev server.
        </section>
      )}

      {message && (
        <section className="banner error">
          {message}
          <button
            className="text-button"
            style={{ marginLeft: '1rem' }}
            type="button"
            onClick={() => setMessage('')}
          >
            Dismiss
          </button>
        </section>
      )}

      <nav className="tabs" aria-label="App sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              className={activeTab === tab.id ? 'active' : ''}
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={17} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {loading ? (
        <section className="loading-panel">
          <Loader2 className="spin" size={22} />
          Loading data…
        </section>
      ) : (
        <>
          {activeTab === 'ingredients' && (
            <IngredientLibrary
              ingredients={ingredients}
              form={ingredientForm}
              saving={saving}
              onFormChange={setIngredientForm}
              onSave={saveIngredient}
              onEdit={editIngredient}
              onDelete={deleteIngredient}
              onCancel={() => setIngredientForm(emptyIngredientForm)}
            />
          )}

          {activeTab === 'builder' && (
            <RecipeBuilder
              recipes={recipes}
              ingredients={ingredients}
              selectedRecipe={selectedRecipe}
              selectedRecipeId={selectedRecipeId}
              selectedRecipeLines={selectedRecipeLines}
              recipeForm={recipeForm}
              lineForm={lineForm}
              saving={saving}
              onSelectRecipe={setSelectedRecipeId}
              onRecipeFormChange={setRecipeForm}
              onLineFormChange={setLineForm}
              onSaveRecipe={saveRecipe}
              onEditRecipe={editRecipe}
              onAddLine={addRecipeLine}
              onDeleteLine={deleteRecipeLine}
              onCancelRecipe={() => setRecipeForm(emptyRecipeForm)}
            />
          )}

          {activeTab === 'costs' && (
            <RecipeCostView
              recipes={recipes}
              selectedRecipe={selectedRecipe}
              selectedRecipeId={selectedRecipeId}
              selectedRecipeCosts={selectedRecipeCosts}
              onSelectRecipe={setSelectedRecipeId}
            />
          )}

          {activeTab === 'menu' && (
            <MenuItemManager
              menuItems={menuItems}
              menuItemComponents={menuItemComponents}
              recipes={recipes}
              ingredients={ingredients}
              recipeCostById={recipeCostById}
              selectedMenuItemId={selectedMenuItemId}
              menuItemForm={menuItemForm}
              componentForm={componentForm}
              saving={saving}
              onSelectMenuItem={setSelectedMenuItemId}
              onMenuItemFormChange={setMenuItemForm}
              onComponentFormChange={setComponentForm}
              onSaveMenuItem={saveMenuItem}
              onEditMenuItem={editMenuItem}
              onDeleteMenuItem={deleteMenuItem}
              onAddComponent={addComponent}
              onDeleteComponent={deleteComponent}
              onCancelMenuItem={() => setMenuItemForm(emptyMenuItemForm)}
            />
          )}

          {activeTab === 'prep' && (
            <PrepPlanner
              eventTypes={eventTypes}
              ingredients={ingredients}
              menuItemComponents={menuItemComponents}
              menuItems={menuItems}
              recipeLines={recipeLines}
              recipes={recipes}
            />
          )}

          {activeTab === 'events' && (
            <EventsRevenue
              annualPlanEvents={annualPlanEvents}
              costAssumptions={costAssumptions}
              eventTypes={eventTypes}
              ingredients={ingredients}
              menuItemComponents={menuItemComponents}
              menuItems={menuItems}
              recipeCostById={recipeCostById}
            />
          )}

          {activeTab === 'assumptions' && (
            <CostLibraryAssumptions
              rows={costAssumptions}
              saving={saving}
              onSave={saveCostAssumption}
            />
          )}
        </>
      )}
    </main>
  );
}

// ── Ingredient Library ────────────────────────────────────────────────────────

function IngredientLibrary({
  ingredients,
  form,
  saving,
  onFormChange,
  onSave,
  onEdit,
  onDelete,
  onCancel,
}: {
  ingredients: Ingredient[];
  form: IngredientForm;
  saving: boolean;
  onFormChange: (form: IngredientForm) => void;
  onSave: (event: FormEvent) => void;
  onEdit: (ingredient: Ingredient) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}) {
  return (
    <section className="split-layout">
      <form className="panel form-panel" onSubmit={onSave}>
        <h2>{form.id ? 'Edit Ingredient' : 'Add Ingredient'}</h2>
        <label>
          Ingredient
          <input
            value={form.name}
            onChange={(e) => onFormChange({ ...form, name: e.target.value })}
            required
          />
        </label>
        <div className="field-grid">
          <label>
            Purchase price
            <input
              min="0"
              step="0.01"
              type="number"
              value={form.default_purchase_price}
              onChange={(e) => onFormChange({ ...form, default_purchase_price: e.target.value })}
              required
            />
          </label>
          <label>
            Purchase unit
            <input
              value={form.purchase_unit}
              onChange={(e) => onFormChange({ ...form, purchase_unit: e.target.value })}
              placeholder="5 lb bag"
              required
            />
          </label>
        </div>
        <label>
          Grams per purchase unit
          <input
            min="0.01"
            step="0.01"
            type="number"
            value={form.grams_per_purchase_unit}
            onChange={(e) => onFormChange({ ...form, grams_per_purchase_unit: e.target.value })}
            required
          />
        </label>
        <label>
          Recommended source
          <input
            value={form.recommended_source}
            onChange={(e) => onFormChange({ ...form, recommended_source: e.target.value })}
          />
        </label>
        <label>
          Notes
          <textarea
            value={form.notes}
            onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
          />
        </label>
        <div className="button-row">
          <button type="submit" disabled={saving}>
            <Save size={17} />
            {form.id ? 'Update' : 'Save ingredient'}
          </button>
          {form.id && (
            <button className="secondary" type="button" onClick={onCancel}>
              Clear
            </button>
          )}
        </div>
      </form>

      <section className="panel table-panel">
        <h2>Ingredient Library ({ingredients.length})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Purchase</th>
                <th>Grams</th>
                <th>Cost/g</th>
                <th>Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ingredient) => (
                <tr key={ingredient.id}>
                  <td>{ingredient.name}</td>
                  <td>
                    {formatCurrency(ingredient.default_purchase_price)} /{' '}
                    {ingredient.purchase_unit}
                  </td>
                  <td>{Number(ingredient.grams_per_purchase_unit).toLocaleString()}</td>
                  <td>{formatCurrency(Number(ingredient.cost_per_gram))}</td>
                  <td>{ingredient.recommended_source}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => onEdit(ingredient)}
                      >
                        Edit
                      </button>
                      <button
                        className="icon-button danger"
                        type="button"
                        onClick={() => onDelete(ingredient.id)}
                        title="Delete ingredient"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

// ── Recipe Builder ────────────────────────────────────────────────────────────

function RecipeBuilder({
  recipes,
  ingredients,
  selectedRecipe,
  selectedRecipeId,
  selectedRecipeLines,
  recipeForm,
  lineForm,
  saving,
  onSelectRecipe,
  onRecipeFormChange,
  onLineFormChange,
  onSaveRecipe,
  onEditRecipe,
  onAddLine,
  onDeleteLine,
  onCancelRecipe,
}: {
  recipes: Recipe[];
  ingredients: Ingredient[];
  selectedRecipe: Recipe | null;
  selectedRecipeId: string;
  selectedRecipeLines: RecipeLine[];
  recipeForm: RecipeForm;
  lineForm: LineForm;
  saving: boolean;
  onSelectRecipe: (id: string) => void;
  onRecipeFormChange: (form: RecipeForm) => void;
  onLineFormChange: (form: LineForm) => void;
  onSaveRecipe: (event: FormEvent) => void;
  onEditRecipe: (recipe: Recipe) => void;
  onAddLine: (event: FormEvent) => void;
  onDeleteLine: (id: string) => void;
  onCancelRecipe: () => void;
}) {
  return (
    <section className="builder-grid">
      <form className="panel form-panel" onSubmit={onSaveRecipe}>
        <h2>{recipeForm.id ? 'Edit Recipe' : 'Create Recipe'}</h2>
        <label>
          Recipe name
          <input
            value={recipeForm.name}
            onChange={(e) => onRecipeFormChange({ ...recipeForm, name: e.target.value })}
            required
          />
        </label>
        <div className="field-grid">
          <label>
            Category
            <input
              value={recipeForm.category}
              onChange={(e) => onRecipeFormChange({ ...recipeForm, category: e.target.value })}
            />
          </label>
          <label>
            Servings
            <input
              min="1"
              type="number"
              value={recipeForm.servings}
              onChange={(e) => onRecipeFormChange({ ...recipeForm, servings: e.target.value })}
            />
          </label>
        </div>
        <div className="field-grid">
          <label>
            Yield amount
            <input
              min="0"
              step="0.01"
              type="number"
              value={recipeForm.yield_amount}
              onChange={(e) => onRecipeFormChange({ ...recipeForm, yield_amount: e.target.value })}
            />
          </label>
          <label>
            Yield unit
            <input
              value={recipeForm.yield_unit}
              onChange={(e) => onRecipeFormChange({ ...recipeForm, yield_unit: e.target.value })}
            />
          </label>
        </div>
        <label>
          Notes
          <textarea
            value={recipeForm.notes}
            onChange={(e) => onRecipeFormChange({ ...recipeForm, notes: e.target.value })}
          />
        </label>
        <div className="button-row">
          <button type="submit" disabled={saving}>
            <Save size={17} />
            {recipeForm.id ? 'Update recipe' : 'Save recipe'}
          </button>
          {recipeForm.id && (
            <button className="secondary" type="button" onClick={onCancelRecipe}>
              Clear
            </button>
          )}
        </div>
      </form>

      <section className="panel">
        <div className="panel-heading">
          <h2>Recipe Ingredients</h2>
          {selectedRecipe && (
            <button className="text-button" type="button" onClick={() => onEditRecipe(selectedRecipe)}>
              Edit recipe
            </button>
          )}
        </div>
        <label>
          Active recipe
          <select
            value={selectedRecipeId}
            onChange={(e) => onSelectRecipe(e.target.value)}
          >
            <option value="">Select recipe</option>
            {recipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.name}
              </option>
            ))}
          </select>
        </label>
        <form className="line-form" onSubmit={onAddLine}>
          <select
            value={lineForm.ingredient_id}
            onChange={(e) => onLineFormChange({ ...lineForm, ingredient_id: e.target.value })}
            required
          >
            <option value="">Ingredient</option>
            {ingredients.map((ingredient) => (
              <option key={ingredient.id} value={ingredient.id}>
                {ingredient.name}
              </option>
            ))}
          </select>
          <input
            min="0"
            step="0.01"
            type="number"
            placeholder="Amount"
            value={lineForm.amount}
            onChange={(e) => onLineFormChange({ ...lineForm, amount: e.target.value })}
            required
          />
          <input
            placeholder="Unit"
            value={lineForm.amount_unit}
            onChange={(e) => onLineFormChange({ ...lineForm, amount_unit: e.target.value })}
            required
          />
          <input
            min="0"
            step="0.01"
            type="number"
            placeholder="Grams used"
            value={lineForm.grams_used}
            onChange={(e) => onLineFormChange({ ...lineForm, grams_used: e.target.value })}
            required
          />
          <button type="submit" disabled={saving || !selectedRecipeId}>
            <Plus size={17} />
          </button>
        </form>
        <RecipeLineTable lines={selectedRecipeLines} onDeleteLine={onDeleteLine} />
      </section>
    </section>
  );
}

function RecipeLineTable({
  lines,
  onDeleteLine,
}: {
  lines: RecipeLine[];
  onDeleteLine: (id: string) => void;
}) {
  return (
    <div className="table-wrap compact-table">
      <table>
        <thead>
          <tr>
            <th>Ingredient</th>
            <th>Amount</th>
            <th>Grams</th>
            <th>Cost</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td>{line.ingredients?.name}</td>
              <td>
                {line.amount} {line.amount_unit}
              </td>
              <td>{Number(line.grams_used).toLocaleString()}</td>
              <td>
                {formatCurrency(
                  calculateIngredientCost(
                    Number(line.grams_used),
                    Number(line.ingredients?.cost_per_gram ?? 0),
                  ),
                )}
              </td>
              <td>
                <button
                  className="icon-button danger"
                  type="button"
                  onClick={() => onDeleteLine(line.id)}
                  title="Remove ingredient"
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Recipe Cost View ──────────────────────────────────────────────────────────

function RecipeCostView({
  recipes,
  selectedRecipe,
  selectedRecipeId,
  selectedRecipeCosts,
  onSelectRecipe,
}: {
  recipes: Recipe[];
  selectedRecipe: Recipe | null;
  selectedRecipeId: string;
  selectedRecipeCosts: ReturnType<typeof calculateRecipeCosts> | null;
  onSelectRecipe: (id: string) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Recipe Cost View</h2>
          {selectedRecipe && (
            <p className="muted">
              {selectedRecipe.yield_amount} {selectedRecipe.yield_unit} ·{' '}
              {selectedRecipe.servings ?? 'n/a'} servings
            </p>
          )}
        </div>
        <select value={selectedRecipeId} onChange={(e) => onSelectRecipe(e.target.value)}>
          <option value="">Select recipe</option>
          {recipes.map((recipe) => (
            <option key={recipe.id} value={recipe.id}>
              {recipe.name}
            </option>
          ))}
        </select>
      </div>

      {selectedRecipeCosts && (
        <>
          <div className="metrics-grid">
            <Metric label="Batch cost" value={formatCurrency(selectedRecipeCosts.totalBatchCost)} />
            <Metric label="Cost / gallon" value={formatCurrency(selectedRecipeCosts.costPerGallon)} />
            <Metric label="Cost / ounce" value={formatCurrency(selectedRecipeCosts.costPerOunce)} />
            <Metric label="Cost / serving" value={formatCurrency(selectedRecipeCosts.costPerServing)} />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Recipe amount</th>
                  <th>Grams used</th>
                  <th>Cost/g</th>
                  <th>Line cost</th>
                </tr>
              </thead>
              <tbody>
                {selectedRecipeCosts.lines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.ingredientName}</td>
                    <td>
                      {line.amount} {line.amountUnit}
                    </td>
                    <td>{line.gramsUsed.toLocaleString()}</td>
                    <td>{formatCurrency(line.costPerGram)}</td>
                    <td>{formatCurrency(line.lineCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// ── Menu Item Manager ─────────────────────────────────────────────────────────

function MenuItemManager({
  menuItems,
  menuItemComponents,
  recipes,
  ingredients,
  recipeCostById,
  selectedMenuItemId,
  menuItemForm,
  componentForm,
  saving,
  onSelectMenuItem,
  onMenuItemFormChange,
  onComponentFormChange,
  onSaveMenuItem,
  onEditMenuItem,
  onDeleteMenuItem,
  onAddComponent,
  onDeleteComponent,
  onCancelMenuItem,
}: {
  menuItems: MenuItem[];
  menuItemComponents: MenuItemComponent[];
  recipes: Recipe[];
  ingredients: Ingredient[];
  recipeCostById: Record<string, ReturnType<typeof calculateRecipeCosts>>;
  selectedMenuItemId: string;
  menuItemForm: MenuItemForm;
  componentForm: ComponentForm;
  saving: boolean;
  onSelectMenuItem: (id: string) => void;
  onMenuItemFormChange: (form: MenuItemForm) => void;
  onComponentFormChange: (form: ComponentForm) => void;
  onSaveMenuItem: (event: FormEvent) => void;
  onEditMenuItem: (item: MenuItem) => void;
  onDeleteMenuItem: (id: string) => void;
  onAddComponent: (event: FormEvent) => void;
  onDeleteComponent: (id: string) => void;
  onCancelMenuItem: () => void;
}) {
  const selectedMenuItem = menuItems.find((m) => m.id === selectedMenuItemId) ?? null;
  const selectedComponents = menuItemComponents.filter((c) => c.menu_item_id === selectedMenuItemId);
  const selectedCost = computeMenuItemCost(selectedComponents, recipeCostById, ingredients);
  const selectedBreakdown = computeMenuCostBreakdown(selectedComponents, recipeCostById, ingredients);
  const selectedProteinCost = selectedBreakdown.Protein ?? 0;
  const sellPrice = selectedMenuItem?.sell_price ? Number(selectedMenuItem.sell_price) : null;
  const margin =
    sellPrice && sellPrice > 0 ? ((sellPrice - selectedCost) / sellPrice) * 100 : null;

  return (
    <section className="builder-grid">
      {/* Left column: form + saved items list */}
      <div className="left-stack">
        <form className="panel form-panel" onSubmit={onSaveMenuItem}>
          <h2>{menuItemForm.id ? 'Edit Menu Item' : 'New Menu Item'}</h2>
          <label>
            Name
            <input
              value={menuItemForm.name}
              onChange={(e) => onMenuItemFormChange({ ...menuItemForm, name: e.target.value })}
              placeholder="e.g. Bangkok Bowl"
              required
            />
          </label>
          <label>
            Description
            <input
              value={menuItemForm.description}
              onChange={(e) => onMenuItemFormChange({ ...menuItemForm, description: e.target.value })}
              placeholder="One-line menu description"
            />
          </label>
          <label>
            Sell price
            <input
              min="0"
              step="0.25"
              type="number"
              value={menuItemForm.sell_price}
              onChange={(e) => onMenuItemFormChange({ ...menuItemForm, sell_price: e.target.value })}
              placeholder="e.g. 14.00"
            />
          </label>
          <label>
            Notes
            <textarea
              value={menuItemForm.notes}
              onChange={(e) => onMenuItemFormChange({ ...menuItemForm, notes: e.target.value })}
            />
          </label>
          <div className="button-row">
            <button type="submit" disabled={saving}>
              <Save size={17} />
              {menuItemForm.id ? 'Update' : 'Save menu item'}
            </button>
            {menuItemForm.id && (
              <button className="secondary" type="button" onClick={onCancelMenuItem}>
                Clear
              </button>
            )}
          </div>
        </form>

        <section className="panel">
          <h2>Saved Menu Items</h2>
          {menuItems.length === 0 && (
            <p className="muted" style={{ margin: 0 }}>
              No menu items yet. Create one above.
            </p>
          )}
          <div className="menu-item-list">
            {menuItems.map((item) => {
              const comps = menuItemComponents.filter((c) => c.menu_item_id === item.id);
              const cost = computeMenuItemCost(comps, recipeCostById, ingredients);
              const sp = item.sell_price ? Number(item.sell_price) : null;
              const mg = sp && sp > 0 ? ((sp - cost) / sp) * 100 : null;
              return (
                <button
                  key={item.id}
                  className={`menu-item-card ${selectedMenuItemId === item.id ? 'active' : ''}`}
                  type="button"
                  onClick={() => onSelectMenuItem(item.id)}
                >
                  <div className="mic-name">{item.name}</div>
                  <div className="mic-meta">
                    <span>Cost {formatCurrency(cost)}</span>
                    {sp && <span>Sell {formatCurrency(sp)}</span>}
                    {mg !== null && (
                      <span className={mg < 30 ? 'margin-low' : 'margin-ok'}>
                        {mg.toFixed(0)}% margin
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Right column: selected item detail */}
      <section className="panel">
        {!selectedMenuItem ? (
          <p className="muted" style={{ margin: 0 }}>
            Select or create a menu item to see its components.
          </p>
        ) : (
          <>
            <div className="panel-heading">
              <div>
                <h2>{selectedMenuItem.name}</h2>
                {selectedMenuItem.description && (
                  <p className="muted" style={{ margin: 0 }}>
                    {selectedMenuItem.description}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => onEditMenuItem(selectedMenuItem)}
                >
                  Edit
                </button>
                <button
                  className="icon-button danger"
                  type="button"
                  onClick={() => onDeleteMenuItem(selectedMenuItem.id)}
                  title="Delete menu item"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <Metric label="Food cost" value={formatCurrency(selectedCost)} />
              <Metric label="Protein cost" value={formatCurrency(selectedProteinCost)} />
              <Metric
                label="Sell price"
                value={sellPrice ? formatCurrency(sellPrice) : '—'}
              />
            </div>
            <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <Metric
                label="Gross margin"
                value={margin !== null ? `${margin.toFixed(1)}%` : '—'}
              />
              {Object.entries(selectedBreakdown)
                .filter(([group]) => group !== 'Protein')
                .slice(0, 2)
                .map(([group, cost]) => (
                  <Metric key={group} label={`${group} cost`} value={formatCurrency(cost)} />
                ))}
            </div>

            {/* Add component form */}
            <form className="component-form" onSubmit={onAddComponent}>
              <select
                value={componentForm.component_type}
                onChange={(e) =>
                  onComponentFormChange({
                    ...componentForm,
                    component_type: e.target.value as 'recipe' | 'ingredient',
                    recipe_id: '',
                    ingredient_id: '',
                    amount: '',
                  })
                }
              >
                <option value="recipe">Sauce / Recipe</option>
                <option value="ingredient">Raw Ingredient</option>
              </select>

              {componentForm.component_type === 'recipe' ? (
                <select
                  value={componentForm.recipe_id}
                  onChange={(e) =>
                    onComponentFormChange({ ...componentForm, recipe_id: e.target.value })
                  }
                  required
                >
                  <option value="">Pick sauce</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={componentForm.ingredient_id}
                  onChange={(e) =>
                    onComponentFormChange({ ...componentForm, ingredient_id: e.target.value })
                  }
                  required
                >
                  <option value="">Pick ingredient</option>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              )}

              <input
                min="0"
                step="0.1"
                type="number"
                placeholder={componentForm.component_type === 'recipe' ? 'oz' : 'grams'}
                value={componentForm.amount}
                onChange={(e) =>
                  onComponentFormChange({ ...componentForm, amount: e.target.value })
                }
                required
              />
              <button type="submit" disabled={saving || !selectedMenuItemId}>
                <Plus size={17} />
                Add
              </button>
            </form>

            {/* Component table */}
            <div className="table-wrap compact-table" style={{ marginTop: '0.5rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Amount</th>
                    <th>Cost</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {selectedComponents.map((comp) => {
                    let name = '—';
                    const cost = getMenuComponentCost(comp, recipeCostById, ingredients);
                    if (comp.component_type === 'recipe' && comp.recipe_id) {
                      name = comp.recipes?.name ?? '—';
                    } else if (comp.component_type === 'ingredient' && comp.ingredient_id) {
                      name = comp.ingredients?.name ?? '—';
                    }
                    return (
                      <tr key={comp.id}>
                        <td>{name}</td>
                        <td>
                          {comp.amount} {comp.amount_unit}
                        </td>
                        <td>{formatCurrency(cost)}</td>
                        <td>
                          <button
                            className="icon-button danger"
                            type="button"
                            onClick={() => onDeleteComponent(comp.id)}
                            title="Remove"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </section>
  );
}

// ── Prep Planner ──────────────────────────────────────────────────────────────

function PrepPlanner({
  eventTypes,
  ingredients,
  menuItemComponents,
  menuItems,
  recipeLines,
  recipes,
}: {
  eventTypes: EventType[];
  ingredients: Ingredient[];
  menuItemComponents: MenuItemComponent[];
  menuItems: MenuItem[];
  recipeLines: RecipeLine[];
  recipes: Recipe[];
}) {
  const [covers, setCovers] = useState('150');
  const [bufferPct, setBufferPct] = useState('10');
  const [selectedPrepRecipeId, setSelectedPrepRecipeId] = useState('');
  const [selectedMenuIds, setSelectedMenuIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelectedMenuIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    setSelectedMenuIds((current) => {
      if (current.size > 0 || menuItems.length === 0) return current;
      return new Set(menuItems.map((item) => item.id));
    });
  }, [menuItems]);

  const coversNum = Math.max(1, Number(covers) || 1);
  const bufferPercent = Math.max(0, Number(bufferPct) || 0);
  const bufferMultiplier = 1 + bufferPercent / 100;
  const selectedMenus = menuItems.filter((item) => selectedMenuIds.has(item.id));
  const coversPerMenuItem = (coversNum * bufferMultiplier) / Math.max(1, selectedMenus.length);
  const selectedComponents = menuItemComponents.filter((component) =>
    selectedMenuIds.has(component.menu_item_id),
  );
  const rawPrepRows = Object.values(
    selectedComponents
      .filter((component) => component.component_type === 'ingredient')
      .reduce<Record<string, { group: string; ingredient: Ingredient; amount: number; unit: string }>>((acc, component) => {
        const ingredient =
          component.ingredients ?? ingredients.find((item) => item.id === component.ingredient_id);
        if (!ingredient) return acc;

        const group = getComponentGroup(component);
        const key = `${group}:${ingredient.id}:${component.amount_unit}`;
        const current = acc[key] ?? { group, ingredient, amount: 0, unit: component.amount_unit };
        current.amount += Number(component.amount) * coversPerMenuItem;
        acc[key] = current;
        return acc;
      }, {}),
  ).sort((a, b) => a.group.localeCompare(b.group) || a.ingredient.name.localeCompare(b.ingredient.name));
  const recipePrepRows = Object.values(
    selectedComponents
      .filter((component) => component.component_type === 'recipe' && component.recipe_id)
      .reduce<Record<string, { recipe: Recipe; ounces: number }>>((acc, component) => {
        const recipe = component.recipes ?? recipes.find((item) => item.id === component.recipe_id);
        if (!recipe) return acc;

        const current = acc[recipe.id] ?? { recipe, ounces: 0 };
        current.ounces += Number(component.amount) * coversPerMenuItem;
        acc[recipe.id] = current;
        return acc;
      }, {}),
  ).sort((a, b) => a.recipe.name.localeCompare(b.recipe.name));
  const activeRecipePrep =
    recipePrepRows.find((row) => row.recipe.id === selectedPrepRecipeId) ?? recipePrepRows[0] ?? null;
  const activeRecipeBatchOunces = activeRecipePrep
    ? (recipeYieldInGallons(activeRecipePrep.recipe) ?? 0) * 128
    : 0;
  const activeRecipeBatchGrams = activeRecipeBatchOunces * 28.3495231;
  const activeRecipeNeededGrams = activeRecipePrep ? activeRecipePrep.ounces * 28.3495231 : 0;
  const activeRecipeBatches =
    activeRecipePrep && activeRecipeBatchOunces > 0
      ? Math.ceil(activeRecipePrep.ounces / activeRecipeBatchOunces)
      : null;
  const activeRecipeScale =
    activeRecipeBatchGrams > 0 ? activeRecipeNeededGrams / activeRecipeBatchGrams : 0;
  const activeRecipeRoundedBatchScale = activeRecipeBatches ?? activeRecipeScale;
  const activeRecipeLines = activeRecipePrep
    ? recipeLines.filter((line) => line.recipe_id === activeRecipePrep.recipe.id)
    : [];

  return (
    <section className="panel">
      <h2>Prep Planner</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Enter expected covers and select the menu mix to calculate every raw prep item and sauce batch.
      </p>

      <div className="prep-top">
        <label style={{ maxWidth: '200px' }}>
          Expected covers
          <input
            min="1"
            type="number"
            value={covers}
            onChange={(e) => setCovers(e.target.value)}
          />
        </label>
        <label style={{ maxWidth: '180px' }}>
          Industry buffer %
          <input
            min="0"
            step="1"
            type="number"
            value={bufferPct}
            onChange={(e) => setBufferPct(e.target.value)}
          />
        </label>
        <div className="preset-chips">
          {eventTypes.map((p) => (
            <button
              key={p.id}
              type="button"
              className="chip"
              onClick={() => setCovers(String(p.covers))}
            >
              {p.type} ({p.covers})
            </button>
          ))}
        </div>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Quantities include {bufferPercent.toFixed(0)}% buffer and are shown in grams first for scale prep.
      </p>

      <div className="select-button-grid" style={{ marginBottom: '1rem' }}>
        {menuItems.map((item) => (
          <button
            aria-pressed={selectedMenuIds.has(item.id)}
            className={`select-button ${selectedMenuIds.has(item.id) ? 'active' : ''}`}
            key={item.id}
            type="button"
            onClick={() => toggle(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sauce / Recipe</th>
              <th>Needed with buffer</th>
              <th>Batch yield</th>
              <th>Batches needed</th>
            </tr>
          </thead>
          <tbody>
            {recipePrepRows.map(({ recipe, ounces }) => {
                const batchOunces = (recipeYieldInGallons(recipe) ?? 0) * 128;
                const neededGrams = ounces * 28.3495231;
                const batchGrams = batchOunces * 28.3495231;
                const batches = batchOunces > 0 ? Math.ceil(ounces / batchOunces) : null;
                return (
                  <tr
                    className={activeRecipePrep?.recipe.id === recipe.id ? 'selected-row' : ''}
                    key={recipe.id}
                    onClick={() => setSelectedPrepRecipeId(recipe.id)}
                  >
                    <td>{recipe.name}</td>
                    <td>
                      {neededGrams.toFixed(0)} g <span className="muted">({ounces.toFixed(1)} oz)</span>
                    </td>
                    <td>{batchGrams > 0 ? `${batchGrams.toFixed(0)} g` : '—'}</td>
                    <td>
                      <strong>{batches ?? '—'}</strong>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="table-wrap" style={{ marginTop: '1rem' }}>
        <table>
          <thead>
            <tr>
              <th>Group</th>
              <th>Prep item</th>
              <th>Needed with buffer</th>
              <th>Purchase unit</th>
              <th>Estimated cost</th>
            </tr>
          </thead>
          <tbody>
            {rawPrepRows.map(({ group, ingredient, amount, unit }) => (
              <tr key={`${group}-${ingredient.id}-${unit}`}>
                <td>{group}</td>
                <td>{ingredient.name}</td>
                <td>
                  {unit === 'g' ? (
                    <>
                      {amount.toFixed(0)} g <span className="muted">({(amount / 453.59237).toFixed(2)} lb)</span>
                    </>
                  ) : (
                    `${amount.toFixed(1)} ${unit}`
                  )}
                </td>
                <td>{ingredient.purchase_unit}</td>
                <td>
                  {unit === 'g'
                    ? formatCurrency(amount * Number(ingredient.cost_per_gram ?? 0))
                    : formatCurrency(amount * Number(ingredient.default_purchase_price ?? 0))}
                </td>
              </tr>
            ))}
            {rawPrepRows.length === 0 && (
              <tr>
                <td colSpan={5}>No raw prep components found for the selected menu mix.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {activeRecipePrep && (
        <div className="prep-detail">
          <div className="panel-heading">
            <div>
              <h2>{activeRecipePrep.recipe.name}</h2>
              <p className="muted" style={{ margin: 0 }}>
                Need {activeRecipeNeededGrams.toFixed(0)} g with buffer. Make{' '}
                <strong>{activeRecipeBatches ?? activeRecipeScale.toFixed(2)}</strong> batch
                {activeRecipeBatches === 1 ? '' : 'es'} for service.
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Exact needed</th>
                  <th>Rounded batch prep</th>
                  <th>Base batch line</th>
                </tr>
              </thead>
              <tbody>
                {activeRecipeLines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.ingredients?.name ?? 'Unknown ingredient'}</td>
                    <td>{(Number(line.grams_used) * activeRecipeScale).toFixed(0)} g</td>
                    <td>{(Number(line.grams_used) * activeRecipeRoundedBatchScale).toFixed(0)} g</td>
                    <td>
                      {line.amount} {line.amount_unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Events & Revenue ──────────────────────────────────────────────────────────

function EventsRevenue({
  annualPlanEvents,
  costAssumptions,
  eventTypes,
  ingredients,
  menuItemComponents,
  menuItems,
  recipeCostById,
}: {
  annualPlanEvents: AnnualPlanEvent[];
  costAssumptions: CostAssumption[];
  eventTypes: EventType[];
  ingredients: Ingredient[];
  menuItemComponents: MenuItemComponent[];
  menuItems: MenuItem[];
  recipeCostById: Record<string, ReturnType<typeof calculateRecipeCosts>>;
}) {
  const assumptionValue = (name: string) =>
    Number(costAssumptions.find((row) => row.name === name)?.default_value ?? 0);
  const menuPrice =
    menuItems.reduce((total, item) => total + Number(item.sell_price ?? 0), 0) /
      Math.max(1, menuItems.filter((item) => item.sell_price !== null).length) ||
    assumptionValue('Menu price per bowl');
  const averageMenuCost =
    menuItems.reduce((total, item) => {
      const components = menuItemComponents.filter((component) => component.menu_item_id === item.id);
      return total + computeMenuItemCost(components, recipeCostById, ingredients);
    }, 0) / Math.max(1, menuItems.length);
  const averageProteinCost =
    menuItems.reduce((total, item) => {
      const components = menuItemComponents.filter((component) => component.menu_item_id === item.id);
      return total + (computeMenuCostBreakdown(components, recipeCostById, ingredients).Protein ?? 0);
    }, 0) / Math.max(1, menuItems.length);
  const monthlyFixedCosts = costAssumptions
    .filter((row) => row.category === 'Operations')
    .reduce((total, row) => total + Number(row.default_value ?? 0), 0);
  const annualFixedCosts = monthlyFixedCosts * 12;
  const drinkPrice = assumptionValue('Drink price per cup');
  const drinkCost = assumptionValue('Drink cost per cup');
  const drinkAttachRate = assumptionValue('Drink attach rate');
  const calculatedEventTypes = eventTypes.map((eventType) => {
    const gross = Number(eventType.avg_gross ?? 0) || Number(eventType.covers) * menuPrice;
    const foodCost = Number(eventType.covers) * averageMenuCost;
    const proteinCost = Number(eventType.covers) * averageProteinCost;
    const drinkCount = Number(eventType.covers) * drinkAttachRate;
    const drinkGross = drinkCount * drinkPrice;
    const drinkVariableCost = drinkCount * drinkCost;
    const labor =
      Number(eventType.staff_count) *
        (Number(eventType.service_hours) + Number(eventType.prep_hours)) *
        Number(eventType.wage) +
      Number(eventType.crew_lead_bonus);
    const netBeforeFixed = gross + drinkGross - foodCost - drinkVariableCost - labor;

    return { ...eventType, drinkGross, foodCost, gross, labor, netBeforeFixed, proteinCost };
  });
  const eventMetricsByType = new Map(calculatedEventTypes.map((eventType) => [eventType.type, eventType]));
  const plans = [...new Set(annualPlanEvents.map((row) => row.plan_name))].map((planName) => {
    const rows = annualPlanEvents.filter((row) => row.plan_name === planName);
    const gross = rows.reduce((total, row) => {
      const eventType = eventMetricsByType.get(row.event_type);
      return total + Number(row.event_count) * (eventType?.gross ?? 0);
    }, 0);
    const netBeforeFixed = rows.reduce((total, row) => {
      const eventType = eventMetricsByType.get(row.event_type);
      return total + Number(row.event_count) * (eventType?.netBeforeFixed ?? 0);
    }, 0);
    return { name: planName, rows, gross, net: netBeforeFixed - annualFixedCosts };
  });
  const [targetNet, setTargetNet] = useState('');
  const targetNum = Math.max(1, Number(targetNet) || annualFixedCosts || 1);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section className="panel">
        <h2>Event Types</h2>
        {calculatedEventTypes.length === 0 && (
          <p className="muted" style={{ marginTop: 0 }}>
            Apply the business assumptions migration and run the worksheet importer to populate event planning.
          </p>
        )}
        <div className="event-type-grid">
          {calculatedEventTypes.map((et) => {
            const costPct = et.gross > 0 ? Math.round(((et.gross - et.netBeforeFixed) / et.gross) * 100) : 0;
            return (
              <div key={et.type} className="event-type-card">
                <div className="etc-name">{et.type}</div>
                <div className="etc-metrics">
                  <div>
                    <span>Avg gross</span>
                    <strong>{formatCurrency(et.avg_gross)}</strong>
                  </div>
                  <div>
                    <span>Net before fixed</span>
                    <strong>{formatCurrency(et.netBeforeFixed)}</strong>
                  </div>
                  <div>
                    <span>Protein cost</span>
                    <strong>{formatCurrency(et.proteinCost)}</strong>
                  </div>
                  <div>
                    <span>Cost rate</span>
                    <strong>{costPct}%</strong>
                  </div>
                </div>
                <div className="etc-footer">
                  {et.covers} bowls · {et.service_hours}h service · {et.staff_count} staff
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Revenue goal calculator */}
      <section className="panel">
        <h2>Revenue Goal Calculator</h2>
        <label style={{ maxWidth: '240px', marginBottom: '1rem' }}>
          Target annual net income
          <input
            min="1"
            step="1000"
            type="number"
            value={targetNet || String(Math.round(annualFixedCosts || 1))}
            onChange={(e) => setTargetNet(e.target.value)}
          />
        </label>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>If you only did this event type</th>
                <th>Events needed</th>
                <th>Est. annual gross</th>
                <th>Per week</th>
              </tr>
            </thead>
            <tbody>
              {calculatedEventTypes.map((et) => {
                const eventNet = Math.max(1, et.netBeforeFixed);
                const needed = Math.ceil((targetNum + annualFixedCosts) / eventNet);
                const gross = needed * et.gross;
                const perWeek = (needed / 52).toFixed(1);
                return (
                  <tr key={et.type}>
                    <td>{et.type}</td>
                    <td>
                      <strong>{needed}</strong>
                    </td>
                    <td>{formatCurrency(gross)}</td>
                    <td>{perWeek}×</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Annual plan scenarios */}
      <section className="panel">
        <h2>Annual Plan Scenarios</h2>
        <div className="scenario-grid">
          {plans.map((plan) => (
            <div key={plan.name} className="scenario-card">
              <div className="sc-name">{plan.name}</div>
              <div className="sc-numbers">
                <div>
                  <span>Est. gross</span>
                  <strong>{formatCurrency(plan.gross)}</strong>
                </div>
                <div>
                  <span>Est. net</span>
                  <strong>{formatCurrency(plan.net)}</strong>
                </div>
              </div>
              <div className="sc-events">
                {plan.rows.map((row) => (
                  <div key={row.id} className="sc-event-row">
                    <span>{row.event_type}</span>
                    <span>
                      <strong>{row.event_count}</strong> events
                    </span>
                  </div>
                ))}
              </div>
              <div className="sc-total">
                {plan.rows.reduce((total, row) => total + row.event_count, 0)} total events
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="muted" style={{ margin: 0 }}>
          Average menu cost is <strong>{formatCurrency(averageMenuCost)}</strong>, average menu
          protein cost is <strong>{formatCurrency(averageProteinCost)}</strong>, average menu price
          is <strong>{formatCurrency(menuPrice)}</strong>, and monthly fixed operating assumptions
          total <strong>{formatCurrency(monthlyFixedCosts)}</strong>. These values are recalculated
          from Ingredients, Recipes, Menu Items, and Cost Library.
        </p>
      </section>
    </div>
  );
}

// ── Cost Library Assumptions ─────────────────────────────────────────────────

function CostLibraryAssumptions({
  rows,
  saving,
  onSave,
}: {
  rows: CostAssumption[];
  saving: boolean;
  onSave: (id: string, defaultValue: number | null) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const categories = [...new Set(rows.map((row) => row.category).filter(Boolean))];

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        rows.map((row) => [row.id, row.default_value === null ? '' : String(row.default_value)]),
      ),
    );
  }, [rows]);

  return (
    <div className="assumptions-grid">
      {rows.length === 0 && (
        <section className="panel">
          <p className="muted" style={{ margin: 0 }}>
            Apply the business assumptions migration and run the worksheet importer to populate this tab.
          </p>
        </section>
      )}
      {categories.map((category) => {
        const categoryRows = rows.filter((row) => row.category === category);

        return (
          <section className="panel" key={category}>
            <div className="panel-heading">
              <div>
                <h2>{category}</h2>
                <p className="muted" style={{ margin: 0 }}>
                  {categoryRows.length} worksheet assumptions
                </p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data point</th>
                    <th>Default</th>
                    <th>Unit</th>
                    <th>Source</th>
                    <th>Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {categoryRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>
                        <input
                          className="table-input"
                          type="number"
                          step="0.01"
                          value={drafts[row.id] ?? ''}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [row.id]: event.target.value,
                            }))
                          }
                        />
                      </td>
                      <td>{row.unit || '—'}</td>
                      <td>{row.recommended_source || '—'}</td>
                      <td>{row.notes || '—'}</td>
                      <td>
                        <button
                          className="text-button"
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            onSave(
                              row.id,
                              drafts[row.id]?.trim() ? Number(drafts[row.id]) : null,
                            )
                          }
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
