-- ============================================================
-- schema-v11-payment-schedules.sql
-- Recorrências de pagamento — visível APENAS para role financeiro
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Tabela de recorrências (pagamentos esperados por cliente)
CREATE TABLE IF NOT EXISTS public.payment_schedules (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id    uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  description  text NOT NULL DEFAULT 'Mensalidade',
  amount       decimal(10,2) NOT NULL,
  payment_day  integer NOT NULL CHECK (payment_day BETWEEN 1 AND 31),
  active       boolean NOT NULL DEFAULT true,
  notes        text,
  created_by   uuid REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Trigger de updated_at
CREATE TRIGGER on_payment_schedules_updated
  BEFORE UPDATE ON public.payment_schedules
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Índice
CREATE INDEX IF NOT EXISTS payment_schedules_client_id_idx ON public.payment_schedules(client_id);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.payment_schedules ENABLE ROW LEVEL SECURITY;

-- Função auxiliar: verifica se o usuário logado tem role financeiro
CREATE OR REPLACE FUNCTION is_financeiro()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'financeiro'
  );
$$;

-- Política exclusiva: SOMENTE role financeiro pode ver/editar
DROP POLICY IF EXISTS "payment_schedules_financeiro_only" ON public.payment_schedules;
CREATE POLICY "payment_schedules_financeiro_only"
  ON public.payment_schedules
  FOR ALL
  TO authenticated
  USING (is_financeiro())
  WITH CHECK (is_financeiro());

-- ============================================================
-- PRONTO.
-- Nenhum outro usuário (nem admin) consegue ver esta tabela.
-- Apenas quem tiver role = 'financeiro' no perfil.
-- ============================================================
