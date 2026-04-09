-- =============================================
-- BEEME DIGITAL — Clients schema completo v3
-- Executa este ficheiro no Supabase SQL Editor
-- =============================================

-- Recriar clients com todos os campos
-- (Se já tens a tabela, usa os ALTER TABLE abaixo)

-- Campos que podem já existir — adicionar os que faltam:
alter table public.clients
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists instagram text,
  add column if not exists cnpj text,
  add column if not exists city text,
  add column if not exists logo_url text,
  add column if not exists drive_link text,
  add column if not exists status text default 'em_negociacao' check (status in ('em_negociacao', 'onboarding', 'ativo', 'lead_perdido', 'inativo')),
  add column if not exists contract_start date,
  add column if not exists contract_end date,
  add column if not exists payment_day integer,
  add column if not exists services text[],
  add column if not exists monthly_value decimal(10,2),
  add column if not exists context text,
  add column if not exists passwords text,
  add column if not exists pain_points text,
  add column if not exists competitors text,
  add column if not exists expectations text,
  add column if not exists responsible_ids uuid[];

-- Tabela de responsáveis por cliente (relação many-to-many)
create table if not exists public.client_responsibles (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.clients(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  role text,
  created_at timestamptz default now() not null,
  unique(client_id, profile_id)
);

alter table public.client_responsibles enable row level security;

create policy "Team can manage client responsibles"
  on public.client_responsibles for all
  using (auth.uid() is not null);

-- Atas de reunião vinculadas ao cliente
create table if not exists public.meetings (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.clients(id) on delete cascade,
  title text not null,
  date timestamptz not null,
  attendees text[],
  notes text,
  status text default 'scheduled' check (status in ('scheduled', 'done', 'cancelled')),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.meetings enable row level security;

create policy "Team can manage meetings"
  on public.meetings for all
  using (auth.uid() is not null);

create trigger on_meetings_updated
  before update on public.meetings
  for each row execute procedure public.handle_updated_at();

create index if not exists meetings_client_id_idx on public.meetings(client_id);
create index if not exists clients_status_idx on public.clients(status);
