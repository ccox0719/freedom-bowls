create table if not exists public.startup_checklist_items (
  id uuid primary key default gen_random_uuid(),
  phase text not null,
  task text not null unique,
  status text not null default 'todo' check (status in ('todo', 'doing', 'blocked', 'done')),
  priority integer not null default 3 check (priority between 1 and 5),
  due_date date,
  completed_at timestamptz,
  owner text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists startup_checklist_items_set_updated_at on public.startup_checklist_items;
create trigger startup_checklist_items_set_updated_at
  before update on public.startup_checklist_items
  for each row execute function public.set_updated_at();

alter table public.startup_checklist_items enable row level security;

create policy "Allow anon startup checklist reads" on public.startup_checklist_items
  for select using (true);
create policy "Allow anon startup checklist writes" on public.startup_checklist_items
  for all using (true) with check (true);

insert into public.startup_checklist_items
  (phase, task, status, priority, notes)
values
  ('Planning', 'Confirm business name, brand, and menu direction', 'todo', 1, 'Lock the concept before buying equipment.'),
  ('Planning', 'Decide trailer versus step van', 'todo', 1, 'Use the lower-risk route that fits permits and budget.'),
  ('Planning', 'Get written ballpark quotes for truck, hood, fire suppression, electrical, and plumbing', 'todo', 1, 'Get line-item pricing, not one lump sum.'),
  ('Planning', 'Build a final startup budget with included, alternative, optional, and reserve items', 'todo', 1, 'Use the app to keep the numbers current.'),
  ('Compliance', 'Confirm mobile food unit plan review requirements with the local health department', 'todo', 1, 'Ask what has to be approved before purchase.'),
  ('Compliance', 'Confirm fire marshal requirements for hood and suppression', 'todo', 1, 'Get the requirements in writing if possible.'),
  ('Compliance', 'Secure commissary or approved base of operations', 'todo', 1, 'Needed for prep, storage, water, and dumping in many places.'),
  ('Compliance', 'Confirm business registration, sales tax, and employer tax setup', 'todo', 2, 'Work with a CPA or filing service.'),
  ('Compliance', 'Get insurance quotes for vehicle, general liability, and workers comp if needed', 'todo', 1, 'Do this before booking events.'),
  ('Buildout', 'Choose and purchase truck or trailer only after plan review feedback', 'todo', 1, 'Avoid buying before compliance is clear.'),
  ('Buildout', 'Order and install cooking, refrigeration, plumbing, and electrical equipment', 'todo', 1, 'Track each invoice line separately.'),
  ('Buildout', 'Set up POS, menu boards, packaging, and safety equipment', 'todo', 2, 'Make the service line fast and simple.'),
  ('Menu', 'Finalize core bowls, proteins, sauces, and pricing', 'todo', 1, 'Keep the menu tight for launch.'),
  ('Menu', 'Test recipes at 50, 100, and 200 serving scale', 'todo', 2, 'Verify yield, labor, and waste.'),
  ('Launch', 'Run a paid test event or soft opening', 'todo', 1, 'Use this to validate timing and portions.'),
  ('Launch', 'Create a catering packet and event quote template', 'todo', 2, 'Use a standard format so quotes are fast.'),
  ('Launch', 'Book first public events and one or two anchor private accounts', 'todo', 1, 'Prioritize repeatable demand.'),
  ('Launch', 'Set reorder pars and opening inventory levels', 'todo', 2, 'Avoid stockouts and overbuying.'),
  ('Launch', 'Prepare a CPA handoff packet with startup cost and checklist exports', 'todo', 2, 'Include invoices, titles, permits, and placed-in-service dates.')
on conflict (task) do update set
  phase = excluded.phase,
  status = excluded.status,
  priority = excluded.priority,
  notes = excluded.notes;
