-- Adicionar campos ao clients (executa depois do schema-v2.sql)
alter table public.clients
  add column if not exists status text default 'active' check (status in ('active', 'inactive', 'prospect')),
  add column if not exists monthly_value decimal(10,2),
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text;
