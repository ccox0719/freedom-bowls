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
