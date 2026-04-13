-- schema-v12-approval.sql
-- Painel de aprovação do cliente
-- Cada cliente recebe um token único (link de aprovação)
-- Novos status: cliente_aprovacao | design_ajuste

-- 1. Token de aprovação por cliente
ALTER TABLE clients ADD COLUMN IF NOT EXISTS approval_token text UNIQUE;

-- Gera token para clientes existentes que ainda não têm
UPDATE clients
SET approval_token = gen_random_uuid()::text
WHERE approval_token IS NULL;

-- Garante que novos clientes sempre tenham token
ALTER TABLE clients ALTER COLUMN approval_token SET DEFAULT gen_random_uuid()::text;

-- 2. Notas de ajuste (preenchidas pelo cliente ao solicitar ajuste)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approval_notes text;

-- 3. Índice para lookup rápido por token
CREATE INDEX IF NOT EXISTS clients_approval_token_idx ON clients(approval_token);

-- 4. Política RLS: permite leitura de tasks via token de cliente
-- (O acesso é feito via service role na API — sem necessidade de política extra)

-- Nota: novos statuses adicionados no código:
--   cliente_aprovacao  → card aguardando aprovação do cliente
--   design_ajuste      → card retornou para o designer com pedido de ajuste
