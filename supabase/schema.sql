-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Clients table
create table public.clients (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  niche text not null,
  tone_of_voice text,
  forbidden_words text[] default '{}',
  domain_framework text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.clients enable row level security;

create policy "Users can manage their own clients"
  on public.clients
  for all
  using (auth.uid() = user_id);

-- Runs table
create table public.runs (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.clients(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  topic text,
  mode text check (mode in ('news', 'topic', 'trend')) not null default 'news',
  status text check (status in ('pending', 'running', 'waiting_approval', 'completed', 'failed')) not null default 'pending',
  current_step integer default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.runs enable row level security;

create policy "Users can manage their own runs"
  on public.runs
  for all
  using (auth.uid() = user_id);

-- Run steps table
create table public.run_steps (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid references public.runs(id) on delete cascade not null,
  step_number integer not null,
  step_name text not null,
  agent_name text not null,
  input jsonb,
  output text,
  status text check (status in ('pending', 'running', 'completed', 'failed', 'waiting_approval', 'approved', 'skipped')) not null default 'pending',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.run_steps enable row level security;

create policy "Users can manage their own run steps"
  on public.run_steps
  for all
  using (
    exists (
      select 1 from public.runs
      where runs.id = run_steps.run_id
      and runs.user_id = auth.uid()
    )
  );

-- Updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_clients_updated
  before update on public.clients
  for each row execute procedure public.handle_updated_at();

create trigger on_runs_updated
  before update on public.runs
  for each row execute procedure public.handle_updated_at();

create trigger on_run_steps_updated
  before update on public.run_steps
  for each row execute procedure public.handle_updated_at();

-- Indexes
create index runs_client_id_idx on public.runs(client_id);
create index runs_user_id_idx on public.runs(user_id);
create index run_steps_run_id_idx on public.run_steps(run_id);
