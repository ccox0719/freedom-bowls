create extension if not exists "pgcrypto";

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_purchase_price numeric not null default 0 check (default_purchase_price >= 0),
  purchase_unit text not null,
  grams_per_purchase_unit numeric not null check (grams_per_purchase_unit > 0),
  cost_per_gram numeric generated always as (
    default_purchase_price / nullif(grams_per_purchase_unit, 0)
  ) stored,
  recommended_source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  yield_amount numeric,
  yield_unit text,
  servings integer check (servings is null or servings > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  amount numeric not null check (amount >= 0),
  amount_unit text not null,
  grams_used numeric not null check (grams_used >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recipe_ingredients_recipe_id_idx
  on public.recipe_ingredients(recipe_id);

create index if not exists recipe_ingredients_ingredient_id_idx
  on public.recipe_ingredients(ingredient_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ingredients_set_updated_at on public.ingredients;
create trigger ingredients_set_updated_at
before update on public.ingredients
for each row execute function public.set_updated_at();

drop trigger if exists recipes_set_updated_at on public.recipes;
create trigger recipes_set_updated_at
before update on public.recipes
for each row execute function public.set_updated_at();

drop trigger if exists recipe_ingredients_set_updated_at on public.recipe_ingredients;
create trigger recipe_ingredients_set_updated_at
before update on public.recipe_ingredients
for each row execute function public.set_updated_at();

alter table public.ingredients enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

create policy "Allow anon ingredient reads" on public.ingredients
  for select using (true);
create policy "Allow anon ingredient writes" on public.ingredients
  for all using (true) with check (true);

create policy "Allow anon recipe reads" on public.recipes
  for select using (true);
create policy "Allow anon recipe writes" on public.recipes
  for all using (true) with check (true);

create policy "Allow anon recipe ingredient reads" on public.recipe_ingredients
  for select using (true);
create policy "Allow anon recipe ingredient writes" on public.recipe_ingredients
  for all using (true) with check (true);
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  sell_price numeric check (sell_price is null or sell_price >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_item_components (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  component_type text not null check (component_type in ('recipe', 'ingredient')),
  recipe_id uuid references public.recipes(id) on delete restrict,
  ingredient_id uuid references public.ingredients(id) on delete restrict,
  amount numeric not null check (amount >= 0),
  amount_unit text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (component_type = 'recipe' and recipe_id is not null and ingredient_id is null) or
    (component_type = 'ingredient' and ingredient_id is not null and recipe_id is null)
  )
);

create index if not exists menu_item_components_menu_item_id_idx
  on public.menu_item_components(menu_item_id);

drop trigger if exists menu_items_set_updated_at on public.menu_items;
create trigger menu_items_set_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

drop trigger if exists menu_item_components_set_updated_at on public.menu_item_components;
create trigger menu_item_components_set_updated_at
  before update on public.menu_item_components
  for each row execute function public.set_updated_at();

alter table public.menu_items enable row level security;
alter table public.menu_item_components enable row level security;

create policy "Allow anon menu item reads" on public.menu_items
  for select using (true);
create policy "Allow anon menu item writes" on public.menu_items
  for all using (true) with check (true);

create policy "Allow anon menu item component reads" on public.menu_item_components
  for select using (true);
create policy "Allow anon menu item component writes" on public.menu_item_components
  for all using (true) with check (true);
insert into public.ingredients
  (name, default_purchase_price, purchase_unit, grams_per_purchase_unit, recommended_source, notes)
values
  ('Frozen corn or canned corn', 18.00, '24 lb case', 10886.21, 'Restaurant supply / warehouse club', 'Starter estimate. Replace with vendor invoice pricing.'),
  ('Roma tomatoes', 24.00, '25 lb case', 11339.81, 'Produce distributor', 'Starter estimate.'),
  ('Bell peppers', 28.00, '25 lb case', 11339.81, 'Produce distributor', 'Starter estimate.'),
  ('Yellow onions', 18.00, '50 lb bag', 22679.62, 'Produce distributor', 'Starter estimate.'),
  ('Cilantro', 12.00, '30 bunch case', 1500.00, 'Produce distributor', 'Starter estimate.'),
  ('Lime juice', 7.50, '1 gallon jug', 3785.41, 'Restaurant supply', 'Starter estimate.'),
  ('Salt', 7.00, '25 lb bag', 11339.81, 'Restaurant supply', 'Starter estimate.'),
  ('Mayonnaise', 14.00, '1 gallon tub', 3785.41, 'Restaurant supply', 'Starter estimate.'),
  ('Greek yogurt', 20.00, '5 lb tub', 2267.96, 'Restaurant supply', 'Starter estimate.'),
  ('Jalapeños', 18.00, '10 lb case', 4535.92, 'Produce distributor', 'Starter estimate.'),
  ('Garlic cloves', 11.00, '5 lb bag', 2267.96, 'Produce distributor', 'Starter estimate.'),
  ('Limes', 25.00, '40 lb case', 18143.69, 'Produce distributor', 'Starter estimate.'),
  ('Ground cumin', 11.00, '18 oz container', 510.29, 'Restaurant supply', 'Starter estimate.'),
  ('Peanut butter', 13.00, '5 lb tub', 2267.96, 'Restaurant supply', 'Starter estimate.'),
  ('Brown sugar', 8.00, '10 lb bag', 4535.92, 'Restaurant supply', 'Starter estimate.'),
  ('Soy sauce', 12.00, '1 gallon jug', 3785.41, 'Restaurant supply', 'Starter estimate.'),
  ('Rice vinegar', 10.00, '1 gallon jug', 3785.41, 'Restaurant supply', 'Starter estimate.'),
  ('Chili paste', 16.00, '5 lb tub', 2267.96, 'Restaurant supply', 'Starter estimate.'),
  ('Fish sauce', 13.00, '1 gallon jug', 3785.41, 'Restaurant supply', 'Starter estimate.'),
  ('Garlic', 11.00, '5 lb bag', 2267.96, 'Produce distributor', 'Starter estimate.'),
  ('Fresh ginger', 16.00, '5 lb case', 2267.96, 'Produce distributor', 'Starter estimate.'),
  ('Neutral oil', 32.00, '35 lb jug', 15875.73, 'Restaurant supply', 'Starter estimate.'),
  ('Pineapple chunks', 8.00, '6 lb can', 2721.55, 'Restaurant supply', 'Starter estimate.'),
  ('Pineapple juice', 7.00, '1 gallon jug', 3785.41, 'Restaurant supply', 'Starter estimate.'),
  ('Orange juice', 8.00, '1 gallon jug', 3785.41, 'Restaurant supply', 'Starter estimate.'),
  ('White vinegar', 5.50, '1 gallon jug', 3785.41, 'Restaurant supply', 'Starter estimate.'),
  ('Ketchup', 8.50, '1 gallon jug', 3785.41, 'Restaurant supply', 'Starter estimate.'),
  ('Green onions', 16.00, '5 lb case', 2267.96, 'Produce distributor', 'Starter estimate.'),
  ('Fresh thyme', 18.00, '1 lb case', 453.59, 'Produce distributor', 'Starter estimate.'),
  ('Habaneros', 28.00, '5 lb case', 2267.96, 'Produce distributor', 'Starter estimate.'),
  ('Allspice', 12.00, '16 oz container', 453.59, 'Restaurant supply', 'Starter estimate.'),
  ('Lemon juice', 7.50, '1 gallon jug', 3785.41, 'Restaurant supply', 'Starter estimate.'),
  ('Cucumbers', 20.00, '25 lb case', 11339.81, 'Produce distributor', 'Starter estimate.'),
  ('Fresh dill', 15.00, '1 lb case', 453.59, 'Produce distributor', 'Starter estimate.'),
  ('Olive oil', 38.00, '1 gallon jug', 3785.41, 'Restaurant supply', 'Starter estimate.'),
  ('Carrots', 18.00, '25 lb bag', 11339.81, 'Produce distributor', 'Starter estimate.'),
  ('Water', 0.00, 'tap water', 3785.41, 'Truck potable water', 'No default ingredient cost.'),
  ('Yellow mustard', 7.00, '1 gallon jug', 3785.41, 'Restaurant supply', 'Starter estimate.'),
  ('Ground allspice', 12.00, '16 oz container', 453.59, 'Restaurant supply', 'Starter estimate.'),
  ('Smoked paprika', 14.00, '18 oz container', 510.29, 'Restaurant supply', 'Starter estimate.'),
  ('Garlic powder', 11.00, '24 oz container', 680.39, 'Restaurant supply', 'Starter estimate.'),
  ('Onion powder', 10.00, '24 oz container', 680.39, 'Restaurant supply', 'Starter estimate.'),
  ('Cumin', 11.00, '18 oz container', 510.29, 'Restaurant supply', 'Starter estimate.'),
  ('Mild chili powder', 10.00, '18 oz container', 510.29, 'Restaurant supply', 'Starter estimate.'),
  ('Black pepper', 14.00, '18 oz container', 510.29, 'Restaurant supply', 'Starter estimate.'),
  ('Dried basil', 8.00, '6 oz container', 170.10, 'Restaurant supply', 'Starter estimate.'),
  ('Dried parsley', 8.00, '6 oz container', 170.10, 'Restaurant supply', 'Starter estimate.')
on conflict (name) do update set
  default_purchase_price = excluded.default_purchase_price,
  purchase_unit = excluded.purchase_unit,
  grams_per_purchase_unit = excluded.grams_per_purchase_unit,
  recommended_source = excluded.recommended_source,
  notes = excluded.notes;

insert into public.recipes
  (name, category, yield_amount, yield_unit, servings, notes)
values
  ('Fresh Corn Salsa', 'Salsa', 5.2, 'gallons', 300, 'Seeded from recipes.json.'),
  ('Cilantro Jalapeño Aioli', 'Sauce', 2, 'gallons', 300, 'Seeded from recipes.json.'),
  ('Bangkok Peanut Sauce', 'Sauce', 2, 'gallons', 300, 'Seeded from recipes.json.'),
  ('Caribbean Jerk-Pineapple Sauce', 'Sauce', 2, 'gallons', 300, 'Seeded from recipes.json.'),
  ('Toum Garlic Sauce', 'Sauce', 1.5, 'gallons', 300, 'Seeded from recipes.json.'),
  ('Tzatziki', 'Sauce', 1.5, 'gallons', 300, 'Seeded from recipes.json.'),
  ('Mustardy Habanero Sauce', 'Sauce', 1, 'gallons', 300, 'Seeded from recipes.json.'),
  ('FB''s Seasoning Blend', 'Seasoning', null, 'bulk batch', null, 'Seeded from recipes.json.')
on conflict (name) do update set
  category = excluded.category,
  yield_amount = excluded.yield_amount,
  yield_unit = excluded.yield_unit,
  servings = excluded.servings,
  notes = excluded.notes;

delete from public.recipe_ingredients
where recipe_id in (
  select id
  from public.recipes
  where name in (
    'Fresh Corn Salsa',
    'Cilantro Jalapeño Aioli',
    'Bangkok Peanut Sauce',
    'Caribbean Jerk-Pineapple Sauce',
    'Toum Garlic Sauce',
    'Tzatziki',
    'Mustardy Habanero Sauce',
    'FB''s Seasoning Blend'
  )
);

with raw_lines(recipe_name, ingredient_name, amount, amount_unit) as (
  values
    ('Fresh Corn Salsa', 'Frozen corn or canned corn', 24, 'lb'),
    ('Fresh Corn Salsa', 'Roma tomatoes', 40, 'whole'),
    ('Fresh Corn Salsa', 'Bell peppers', 20, 'whole'),
    ('Fresh Corn Salsa', 'Yellow onions', 10, 'whole'),
    ('Fresh Corn Salsa', 'Cilantro', 7, 'bunches'),
    ('Fresh Corn Salsa', 'Lime juice', 1.5, 'cups'),
    ('Fresh Corn Salsa', 'Salt', 0.5, 'cups'),
    ('Cilantro Jalapeño Aioli', 'Mayonnaise', 12, 'cups'),
    ('Cilantro Jalapeño Aioli', 'Greek yogurt', 12, 'cups'),
    ('Cilantro Jalapeño Aioli', 'Cilantro', 16, 'bunches'),
    ('Cilantro Jalapeño Aioli', 'Jalapeños', 31, 'whole'),
    ('Cilantro Jalapeño Aioli', 'Garlic cloves', 47, 'cloves'),
    ('Cilantro Jalapeño Aioli', 'Limes', 16, 'whole'),
    ('Cilantro Jalapeño Aioli', 'Ground cumin', 7.5, 'tbsp'),
    ('Cilantro Jalapeño Aioli', 'Salt', 2.5, 'tbsp'),
    ('Bangkok Peanut Sauce', 'Peanut butter', 12, 'cups'),
    ('Bangkok Peanut Sauce', 'Brown sugar', 3, 'cups'),
    ('Bangkok Peanut Sauce', 'Soy sauce', 4, 'cups'),
    ('Bangkok Peanut Sauce', 'Rice vinegar', 2, 'cups'),
    ('Bangkok Peanut Sauce', 'Chili paste', 0.5, 'cups'),
    ('Bangkok Peanut Sauce', 'Fish sauce', 0.25, 'cups'),
    ('Bangkok Peanut Sauce', 'Garlic', 2.5, 'cups'),
    ('Bangkok Peanut Sauce', 'Fresh ginger', 1.25, 'cups'),
    ('Bangkok Peanut Sauce', 'Lime juice', 1.5, 'cups'),
    ('Bangkok Peanut Sauce', 'Neutral oil', 1.5, 'cups'),
    ('Caribbean Jerk-Pineapple Sauce', 'Pineapple chunks', 8, 'cups'),
    ('Caribbean Jerk-Pineapple Sauce', 'Pineapple juice', 4, 'cups'),
    ('Caribbean Jerk-Pineapple Sauce', 'Orange juice', 2, 'cups'),
    ('Caribbean Jerk-Pineapple Sauce', 'Brown sugar', 4, 'cups'),
    ('Caribbean Jerk-Pineapple Sauce', 'Soy sauce', 2, 'cups'),
    ('Caribbean Jerk-Pineapple Sauce', 'White vinegar', 2, 'cups'),
    ('Caribbean Jerk-Pineapple Sauce', 'Ketchup', 2, 'cups'),
    ('Caribbean Jerk-Pineapple Sauce', 'Green onions', 1.5, 'cups'),
    ('Caribbean Jerk-Pineapple Sauce', 'Fresh thyme', 1, 'cups'),
    ('Caribbean Jerk-Pineapple Sauce', 'Garlic', 2.5, 'cups'),
    ('Caribbean Jerk-Pineapple Sauce', 'Habaneros', 10, 'whole'),
    ('Caribbean Jerk-Pineapple Sauce', 'Allspice', 0.25, 'cups'),
    ('Caribbean Jerk-Pineapple Sauce', 'Lime juice', 0.5, 'cups'),
    ('Toum Garlic Sauce', 'Garlic', 6, 'cups'),
    ('Toum Garlic Sauce', 'Lemon juice', 2.5, 'cups'),
    ('Toum Garlic Sauce', 'Neutral oil', 1, 'gallon'),
    ('Toum Garlic Sauce', 'Salt', 0.25, 'cups'),
    ('Tzatziki', 'Greek yogurt', 6, 'quarts'),
    ('Tzatziki', 'Cucumbers', 6, 'whole'),
    ('Tzatziki', 'Garlic cloves', 12, 'cloves'),
    ('Tzatziki', 'Fresh dill', 0.5, 'cups'),
    ('Tzatziki', 'Lemon juice', 0.75, 'cups'),
    ('Tzatziki', 'Olive oil', 0.75, 'cups'),
    ('Tzatziki', 'Salt', 0.25, 'cups'),
    ('Mustardy Habanero Sauce', 'Habaneros', 2, 'lb'),
    ('Mustardy Habanero Sauce', 'Garlic', 2, 'cups'),
    ('Mustardy Habanero Sauce', 'Carrots', 1, 'cups'),
    ('Mustardy Habanero Sauce', 'Cilantro', 2, 'cups'),
    ('Mustardy Habanero Sauce', 'Fresh thyme', 1, 'cups'),
    ('Mustardy Habanero Sauce', 'White vinegar', 8, 'cups'),
    ('Mustardy Habanero Sauce', 'Water', 8, 'cups'),
    ('Mustardy Habanero Sauce', 'Yellow mustard', 4, 'cups'),
    ('Mustardy Habanero Sauce', 'Salt', 0.25, 'cups'),
    ('Mustardy Habanero Sauce', 'Ground allspice', 2, 'tsp'),
    ('FB''s Seasoning Blend', 'Salt', 0.75, 'cups'),
    ('FB''s Seasoning Blend', 'Smoked paprika', 1, 'cups'),
    ('FB''s Seasoning Blend', 'Garlic powder', 0.5, 'cups'),
    ('FB''s Seasoning Blend', 'Onion powder', 0.25, 'cups'),
    ('FB''s Seasoning Blend', 'Cumin', 0.5, 'cups'),
    ('FB''s Seasoning Blend', 'Mild chili powder', 0.25, 'cups'),
    ('FB''s Seasoning Blend', 'Brown sugar', 0.25, 'cups'),
    ('FB''s Seasoning Blend', 'Black pepper', 0.25, 'cups'),
    ('FB''s Seasoning Blend', 'Dried basil', 2, 'tbsp'),
    ('FB''s Seasoning Blend', 'Dried parsley', 2, 'tbsp')
),
converted_lines as (
  select
    recipes.id as recipe_id,
    ingredients.id as ingredient_id,
    raw_lines.amount,
    raw_lines.amount_unit,
    round((
      raw_lines.amount *
      case lower(raw_lines.amount_unit)
        when 'lb' then 453.59237
        when 'gallon' then 3785.41178
        when 'quarts' then 960
        when 'cups' then 240
        when 'tbsp' then 15
        when 'tsp' then 5
        when 'whole' then 100
        when 'bunches' then 50
        when 'cloves' then 5
        else 1
      end
    )::numeric, 2) as grams_used
  from raw_lines
  join public.recipes on recipes.name = raw_lines.recipe_name
  join public.ingredients on ingredients.name = raw_lines.ingredient_name
)
insert into public.recipe_ingredients
  (recipe_id, ingredient_id, amount, amount_unit, grams_used, notes)
select
  recipe_id,
  ingredient_id,
  amount,
  amount_unit,
  grams_used,
  'Seeded gram conversion estimate. Edit grams_used for invoice-accurate costing.'
from converted_lines;
