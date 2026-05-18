create table if not exists public.cost_assumptions (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null unique,
  default_value numeric,
  unit text,
  recommended_source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_types (
  id uuid primary key default gen_random_uuid(),
  type text not null unique,
  covers integer not null check (covers > 0),
  service_hours numeric not null check (service_hours >= 0),
  prep_hours numeric not null check (prep_hours >= 0),
  staff_count numeric not null check (staff_count >= 0),
  wage numeric not null check (wage >= 0),
  crew_lead_bonus numeric not null default 0 check (crew_lead_bonus >= 0),
  avg_gross numeric check (avg_gross is null or avg_gross >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.annual_plan_events (
  id uuid primary key default gen_random_uuid(),
  plan_name text not null,
  event_type text not null references public.event_types(type) on delete cascade,
  event_count integer not null check (event_count >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_name, event_type)
);

drop trigger if exists cost_assumptions_set_updated_at on public.cost_assumptions;
create trigger cost_assumptions_set_updated_at
  before update on public.cost_assumptions
  for each row execute function public.set_updated_at();

drop trigger if exists event_types_set_updated_at on public.event_types;
create trigger event_types_set_updated_at
  before update on public.event_types
  for each row execute function public.set_updated_at();

drop trigger if exists annual_plan_events_set_updated_at on public.annual_plan_events;
create trigger annual_plan_events_set_updated_at
  before update on public.annual_plan_events
  for each row execute function public.set_updated_at();

alter table public.cost_assumptions enable row level security;
alter table public.event_types enable row level security;
alter table public.annual_plan_events enable row level security;

create policy "Allow anon cost assumption reads" on public.cost_assumptions
  for select using (true);
create policy "Allow anon cost assumption writes" on public.cost_assumptions
  for all using (true) with check (true);

create policy "Allow anon event type reads" on public.event_types
  for select using (true);
create policy "Allow anon event type writes" on public.event_types
  for all using (true) with check (true);

create policy "Allow anon annual plan reads" on public.annual_plan_events
  for select using (true);
create policy "Allow anon annual plan writes" on public.annual_plan_events
  for all using (true) with check (true);
