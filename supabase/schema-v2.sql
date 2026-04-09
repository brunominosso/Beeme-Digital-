-- =============================================
-- BEEME DIGITAL — Sistema de Gestão v2
-- Executa este ficheiro no Supabase SQL Editor
-- =============================================

-- Profiles (extensão do auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text default 'member' check (role in ('admin', 'member')),
  avatar_color text default '#6c63ff',
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by team"
  on public.profiles for select
  using (auth.uid() is not null);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Tasks (Kanban)
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  client_id uuid references public.clients(id) on delete set null,
  assignee_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'todo' check (status in ('todo', 'in_progress', 'review', 'done')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date date,
  position integer default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.tasks enable row level security;

create policy "Team can manage tasks"
  on public.tasks for all
  using (auth.uid() is not null);

create trigger on_tasks_updated
  before update on public.tasks
  for each row execute procedure public.handle_updated_at();

-- Invoices (Faturação)
create table if not exists public.invoices (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.clients(id) on delete cascade not null,
  description text not null,
  amount decimal(10,2) not null,
  status text default 'pending' check (status in ('pending', 'paid', 'overdue', 'cancelled')),
  due_date date,
  paid_at timestamptz,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.invoices enable row level security;

create policy "Team can manage invoices"
  on public.invoices for all
  using (auth.uid() is not null);

create trigger on_invoices_updated
  before update on public.invoices
  for each row execute procedure public.handle_updated_at();

-- Expenses (Despesas)
create table if not exists public.expenses (
  id uuid primary key default uuid_generate_v4(),
  description text not null,
  category text default 'other' check (category in ('software', 'marketing', 'office', 'salary', 'freelancer', 'other')),
  amount decimal(10,2) not null,
  date date default current_date not null,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.expenses enable row level security;

create policy "Team can manage expenses"
  on public.expenses for all
  using (auth.uid() is not null);

create trigger on_expenses_updated
  before update on public.expenses
  for each row execute procedure public.handle_updated_at();

-- Indexes
create index if not exists tasks_client_id_idx on public.tasks(client_id);
create index if not exists tasks_assignee_id_idx on public.tasks(assignee_id);
create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists invoices_client_id_idx on public.invoices(client_id);
create index if not exists invoices_status_idx on public.invoices(status);
create index if not exists expenses_date_idx on public.expenses(date);
