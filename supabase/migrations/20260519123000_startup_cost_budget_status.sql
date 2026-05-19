alter table public.startup_costs
  add column if not exists budget_status text not null default 'included'
  check (budget_status in ('included', 'alternative', 'optional', 'reserve'));

update public.startup_costs
set budget_status = 'alternative'
where item in ('Used step van / truck', 'New built trailer');

update public.startup_costs
set budget_status = 'reserve'
where item = 'Working capital reserve';

update public.startup_costs
set budget_status = 'included'
where budget_status is null;
