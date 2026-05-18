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
