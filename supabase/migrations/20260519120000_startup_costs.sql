create table if not exists public.startup_costs (
  id uuid primary key default gen_random_uuid(),
  item text not null unique,
  group_name text not null,
  practical_category text not null,
  tax_treatment text not null,
  low_estimate numeric not null default 0 check (low_estimate >= 0),
  high_estimate numeric not null default 0 check (high_estimate >= 0),
  actual_amount numeric check (actual_amount is null or actual_amount >= 0),
  vendor text,
  purchase_date date,
  placed_in_service_date date,
  documentation_needed text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists startup_costs_set_updated_at on public.startup_costs;
create trigger startup_costs_set_updated_at
  before update on public.startup_costs
  for each row execute function public.set_updated_at();

alter table public.startup_costs enable row level security;

create policy "Allow anon startup cost reads" on public.startup_costs
  for select using (true);
create policy "Allow anon startup cost writes" on public.startup_costs
  for all using (true) with check (true);

insert into public.startup_costs
  (item, group_name, practical_category, tax_treatment, low_estimate, high_estimate, documentation_needed, notes)
values
  ('48-inch Atosa gas griddle', 'Cooking equipment', 'Cooking equipment', 'Depreciable equipment; possible Section 179/bonus candidate', 1450, 1450, 'Invoice, serial number, placed-in-service date', 'Main protein sear station.'),
  ('2 commercial rice cookers', 'Cooking equipment', 'Cooking equipment', 'Depreciable equipment; possible Section 179/bonus candidate', 760, 760, 'Invoice, model numbers', 'Bulk rice production.'),
  ('2 immersion circulators', 'Cooking equipment', 'Cooking equipment', 'Depreciable equipment or small equipment expense depending CPA policy', 400, 400, 'Receipts, model numbers', 'Sous-vide proteins.'),
  ('2-burner stock pot range', 'Cooking equipment', 'Cooking equipment', 'Depreciable equipment; possible Section 179/bonus candidate', 900, 900, 'Invoice, install record if fixed', 'Sauces and backup heat.'),
  ('Steam table', 'Cooking equipment', 'Cooking/holding equipment', 'Depreciable equipment; possible Section 179/bonus candidate', 1200, 1200, 'Invoice, serial number', 'Hot holding.'),
  ('Hot holding cabinet', 'Cooking equipment', 'Holding equipment', 'Depreciable equipment; possible Section 179/bonus candidate', 2500, 2500, 'Invoice, serial number', 'Protein staging.'),
  ('Commercial microwave', 'Cooking equipment', 'Cooking equipment', 'Depreciable equipment or de minimis expense if elected and documented', 350, 350, 'Receipt', 'Fast reheats.'),
  ('48-inch prep fridge with rail', 'Refrigeration', 'Refrigeration', 'Depreciable equipment; possible Section 179/bonus candidate', 2200, 2200, 'Invoice, serial number', 'Proteins and toppings.'),
  ('Undercounter refrigerator', 'Refrigeration', 'Refrigeration', 'Depreciable equipment; possible Section 179/bonus candidate', 1400, 1400, 'Invoice, serial number', 'Overflow cold storage.'),
  ('Small freezer', 'Refrigeration', 'Refrigeration', 'Depreciable equipment or de minimis expense depending policy', 600, 600, 'Receipt, model number', 'Ice or frozen backup.'),
  ('Ice bin / cold wells', 'Refrigeration', 'Refrigeration/line equipment', 'Depreciable equipment or de minimis expense depending policy', 350, 350, 'Receipt', 'Line support.'),
  ('3-compartment sink', 'Water and sanitation', 'Sanitation/buildout', 'Equipment/buildout; treatment depends on whether removable or permanently installed', 1100, 1100, 'Invoice, install invoice', 'Health code.'),
  ('Hand wash sink', 'Water and sanitation', 'Sanitation/buildout', 'Equipment/buildout or small equipment expense', 250, 250, 'Receipt, install invoice', 'Required handwashing.'),
  ('Fresh water tank', 'Water and sanitation', 'Plumbing/buildout', 'Equipment/buildout; likely part of truck/trailer improvement', 250, 250, 'Receipt, install invoice', '40-50 gallon planning assumption.'),
  ('Grey water tank', 'Water and sanitation', 'Plumbing/buildout', 'Equipment/buildout; likely part of truck/trailer improvement', 250, 250, 'Receipt, install invoice', '50 gallon planning assumption.'),
  ('Water heater', 'Water and sanitation', 'Plumbing/buildout', 'Equipment/buildout or small equipment expense', 180, 180, 'Receipt, install invoice', 'Hot water.'),
  ('Water pump and plumbing', 'Water and sanitation', 'Plumbing/buildout', 'Buildout/improvement; CPA should classify with truck/trailer', 400, 400, 'Receipts, labor invoice', 'Truck utility plumbing.'),
  ('Quiet generator', 'Electrical and power', 'Power equipment', 'Depreciable equipment; possible Section 179/bonus candidate', 2500, 4000, 'Invoice, serial number', '7000-9500W quiet generator.'),
  ('Shore power plug system', 'Electrical and power', 'Electrical/buildout', 'Buildout or equipment depending installation', 450, 450, 'Invoice, install record', 'Commissary hookup.'),
  ('Breaker panel and wiring', 'Electrical and power', 'Electrical/buildout', 'Likely buildout/improvement; CPA should classify with vehicle/trailer', 1500, 1500, 'Electrician invoice, inspection records', 'Truck electrical.'),
  ('LED interior lighting', 'Electrical and power', 'Electrical/buildout', 'Buildout or de minimis expense depending policy', 200, 200, 'Receipt, install record', 'Interior lighting.'),
  ('Exterior menu lighting', 'Electrical and power', 'Electrical/buildout/signage', 'Buildout/signage; possibly depreciable', 250, 250, 'Receipt, install record', 'Visibility.'),
  ('Commercial hood system', 'Hood and fire suppression', 'Hood/buildout', 'Buildout/equipment; possible Section 179/bonus but classify carefully', 4000, 7000, 'Vendor invoice, inspection approval', 'Ventilation.'),
  ('Fire suppression system', 'Hood and fire suppression', 'Safety/buildout', 'Buildout/equipment; classify carefully', 3000, 5000, 'Vendor invoice, inspection/certification', 'Required suppression.'),
  ('Hood install / ducting', 'Hood and fire suppression', 'Labor/buildout', 'Capitalized into buildout/equipment basis in many cases', 1500, 1500, 'Contractor invoice', 'Labor and materials.'),
  ('Used enclosed trailer', 'Truck or trailer', 'Trailer/vehicle asset', 'Depreciable business asset; eligibility depends on use and details', 8000, 15000, 'Title, bill of sale, VIN, placed-in-service date', 'Most financially conservative route.'),
  ('Used step van / truck', 'Truck or trailer', 'Vehicle asset', 'Depreciable business vehicle; rules depend on GVWR, business use, financing, title', 15000, 40000, 'Title, bill of sale, VIN, odometer, GVWR', 'Alternative to used trailer.'),
  ('New built trailer', 'Truck or trailer', 'Trailer/buildout asset', 'Depreciable business asset; separate chassis vs equipment if possible', 35000, 70000, 'Contract with line-item detail', 'Higher-cost option; not included in conservative low build.'),
  ('Cambros / hot boxes', 'Smallwares and support', 'Catering equipment', 'Depreciable equipment or de minimis expense depending policy', 800, 800, 'Receipts', 'Transport and holding.'),
  ('Hotel pans / inserts', 'Smallwares and support', 'Smallwares', 'Supplies/smallwares; may be expensed or capitalized depending policy', 600, 600, 'Receipts', 'Service pans and inserts.'),
  ('Knives / prep tools', 'Smallwares and support', 'Smallwares', 'Supplies/smallwares; may be expensed or capitalized depending policy', 400, 400, 'Receipts', 'Prep tools.'),
  ('Speed rack', 'Smallwares and support', 'Equipment', 'Depreciable equipment or de minimis expense', 250, 250, 'Receipt', 'Rack storage.'),
  ('Stainless tables', 'Smallwares and support', 'Equipment', 'Depreciable equipment or de minimis expense', 600, 600, 'Receipts', 'Prep surfaces.'),
  ('Shelving', 'Smallwares and support', 'Equipment', 'Depreciable equipment or de minimis expense', 400, 400, 'Receipts', 'Storage.'),
  ('POS system hardware', 'Smallwares and support', 'Technology/equipment', 'Depreciable equipment or de minimis expense; software fees separately expensed', 600, 600, 'Invoice, subscription agreement', 'Square or equivalent.'),
  ('Packaging startup', 'Smallwares and support', 'Inventory/supplies', 'Packaging used in sales; likely COGS/supplies as used', 500, 500, 'Receipts, beginning inventory count', 'Opening packaging.'),
  ('Cleaning supplies', 'Smallwares and support', 'Supplies', 'Operating expense/supplies', 250, 250, 'Receipts', 'Opening cleaning supplies.'),
  ('Fire extinguishers', 'Smallwares and support', 'Safety equipment', 'Equipment or supplies depending policy', 200, 200, 'Receipts, inspection tags', 'Required safety equipment.'),
  ('Permits, inspections, legal, deposits', 'Launch buffer', 'Startup/legal/compliance', 'Some deductible, some amortized startup/organizational cost, deposits are assets until used/forfeited', 2500, 7500, 'Receipts, applications, refundable deposit terms', 'Separate refundable deposits from fees.'),
  ('Insurance down payments', 'Launch buffer', 'Insurance/prepaid expense', 'Business insurance generally deductible over coverage period; prepaid treatment may apply', 2500, 6000, 'Declarations page and coverage dates', 'Real cash cost below gross profit.'),
  ('Commissary deposit / first month', 'Launch buffer', 'Deposit and rent', 'Deposit is asset; rent is operating expense', 1000, 3000, 'Lease/agreement, deposit receipt', 'Separate deposit from monthly rent.'),
  ('Initial inventory and packaging', 'Launch buffer', 'Inventory/COGS/supplies', 'Inventory/COGS as sold or supplies as used', 3500, 7500, 'Receipts and opening inventory count', 'Food and packaging launch stock.'),
  ('Branding, menu boards, uniforms, photos', 'Launch buffer', 'Marketing/signage/uniforms', 'Marketing may be deductible; durable signage/equipment may be depreciable', 1500, 4000, 'Design invoices, physical signage receipts', 'Separate design services from physical signs.'),
  ('Working capital reserve', 'Launch buffer', 'Cash reserve', 'Not a deduction when set aside', 8000, 20000, 'Bank records', 'Deduct expenses only when actually incurred and allowed.')
on conflict (item) do update set
  group_name = excluded.group_name,
  practical_category = excluded.practical_category,
  tax_treatment = excluded.tax_treatment,
  low_estimate = excluded.low_estimate,
  high_estimate = excluded.high_estimate,
  documentation_needed = excluded.documentation_needed,
  notes = excluded.notes;
