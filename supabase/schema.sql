-- ============================================================
--  Propfolio — Database Schema
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
--  TABLES
-- ─────────────────────────────────────────

create table public.users (
  id           uuid primary key default uuid_generate_v4(),
  email        text not null unique,
  name         text,
  tax_regime   text,          -- e.g. 'micro-foncier', 'réel', 'LMNP', 'SCI'
  tax_bracket  numeric(5,2),  -- marginal tax rate in %
  created_at   timestamptz not null default now()
);

create table public.properties (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references public.users(id) on delete cascade,
  name           text not null,
  address        text,
  type           text,          -- 'appartement', 'maison', 'parking', 'commercial', …
  surface        numeric(10,2), -- m²
  purchase_price numeric(12,2) not null,
  purchase_date  date,
  current_value  numeric(12,2),
  photo_url      text,
  regime         text,          -- 'nu', 'meublé', 'LMNP', 'SCI', …
  created_at     timestamptz not null default now()
);

create table public.loans (
  id                uuid primary key default uuid_generate_v4(),
  property_id       uuid not null references public.properties(id) on delete cascade,
  amount            numeric(12,2) not null,
  rate              numeric(6,4) not null,  -- annual rate in %
  duration_years    int not null,
  monthly_payment   numeric(10,2),
  start_date        date,
  remaining_capital numeric(12,2),
  created_at        timestamptz not null default now()
);

create table public.charges (
  id          uuid primary key default uuid_generate_v4(),
  property_id uuid not null references public.properties(id) on delete cascade,
  type        text not null,   -- 'taxe foncière', 'charges copro', 'assurance', 'gestion', …
  amount      numeric(10,2) not null,
  frequency   text not null,   -- 'monthly', 'quarterly', 'annual'
  created_at  timestamptz not null default now()
);

create table public.revenues (
  id            uuid primary key default uuid_generate_v4(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  monthly_rent  numeric(10,2) not null,
  vacancy_rate  numeric(5,2) not null default 0, -- in %
  created_at    timestamptz not null default now()
);

create table public.simulations (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.users(id) on delete cascade,
  name       text not null,
  params     jsonb not null default '{}',
  results    jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────
--  INDEXES
-- ─────────────────────────────────────────

create index on public.properties(user_id);
create index on public.loans(property_id);
create index on public.charges(property_id);
create index on public.revenues(property_id);
create index on public.simulations(user_id);

-- ─────────────────────────────────────────
--  ROW LEVEL SECURITY
-- ─────────────────────────────────────────

alter table public.users       enable row level security;
alter table public.properties  enable row level security;
alter table public.loans       enable row level security;
alter table public.charges     enable row level security;
alter table public.revenues    enable row level security;
alter table public.simulations enable row level security;

-- users — own row only
create policy "users: own row" on public.users
  for all using (auth.uid() = id);

-- properties — own rows
create policy "properties: own rows" on public.properties
  for all using (auth.uid() = user_id);

-- loans — via property ownership
create policy "loans: via property" on public.loans
  for all using (
    exists (
      select 1 from public.properties p
      where p.id = property_id and p.user_id = auth.uid()
    )
  );

-- charges — via property ownership
create policy "charges: via property" on public.charges
  for all using (
    exists (
      select 1 from public.properties p
      where p.id = property_id and p.user_id = auth.uid()
    )
  );

-- revenues — via property ownership
create policy "revenues: via property" on public.revenues
  for all using (
    exists (
      select 1 from public.properties p
      where p.id = property_id and p.user_id = auth.uid()
    )
  );

-- simulations — own rows
create policy "simulations: own rows" on public.simulations
  for all using (auth.uid() = user_id);
