with alias_map(alias_name, canonical_name) as (
  values
    ('Garlic cloves', 'Garlic'),
    ('Ground cumin', 'Cumin'),
    ('Ground allspice', 'Allspice')
),
links as (
  select
    alias_ingredient.id as alias_id,
    canonical_ingredient.id as canonical_id
  from alias_map
  join public.ingredients alias_ingredient on alias_ingredient.name = alias_map.alias_name
  join public.ingredients canonical_ingredient on canonical_ingredient.name = alias_map.canonical_name
)
update public.recipe_ingredients recipe_ingredient
set ingredient_id = links.canonical_id
from links
where recipe_ingredient.ingredient_id = links.alias_id;

with alias_map(alias_name, canonical_name) as (
  values
    ('Garlic cloves', 'Garlic'),
    ('Ground cumin', 'Cumin'),
    ('Ground allspice', 'Allspice')
),
links as (
  select
    alias_ingredient.id as alias_id,
    canonical_ingredient.id as canonical_id
  from alias_map
  join public.ingredients alias_ingredient on alias_ingredient.name = alias_map.alias_name
  join public.ingredients canonical_ingredient on canonical_ingredient.name = alias_map.canonical_name
)
update public.menu_item_components menu_item_component
set ingredient_id = links.canonical_id
from links
where menu_item_component.ingredient_id = links.alias_id;

delete from public.ingredients
where name in ('Garlic cloves', 'Ground cumin', 'Ground allspice');
