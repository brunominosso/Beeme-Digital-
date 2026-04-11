-- ============================================================
-- RLS (Row Level Security) — Beeme Digital
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- ── Ativa RLS em todas as tabelas ──────────────────────────

ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_steps     ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectives    ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_results   ENABLE ROW LEVEL SECURITY;
ALTER TABLE services      ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts         ENABLE ROW LEVEL SECURITY;

-- ── Função auxiliar: verifica se o usuário é admin ─────────

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ── profiles ───────────────────────────────────────────────
-- Qualquer autenticado pode ler todos os perfis (necessário para menções, assignees, etc.)
-- Só o próprio usuário ou admin pode editar

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR is_admin());

-- ── clients ────────────────────────────────────────────────
-- Todos os autenticados podem ler e escrever (equipe interna)

DROP POLICY IF EXISTS "clients_all" ON clients;
CREATE POLICY "clients_all" ON clients
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── tasks ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "tasks_all" ON tasks;
CREATE POLICY "tasks_all" ON tasks
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── invoices ───────────────────────────────────────────────

DROP POLICY IF EXISTS "invoices_all" ON invoices;
CREATE POLICY "invoices_all" ON invoices
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── expenses ───────────────────────────────────────────────

DROP POLICY IF EXISTS "expenses_all" ON expenses;
CREATE POLICY "expenses_all" ON expenses
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── runs ───────────────────────────────────────────────────
-- Usuário só vê/edita seus próprios runs

DROP POLICY IF EXISTS "runs_select" ON runs;
CREATE POLICY "runs_select" ON runs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "runs_insert" ON runs;
CREATE POLICY "runs_insert" ON runs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "runs_update" ON runs;
CREATE POLICY "runs_update" ON runs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "runs_delete" ON runs;
CREATE POLICY "runs_delete" ON runs
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- ── run_steps ──────────────────────────────────────────────
-- Acesso via join com runs (só vê steps dos seus runs)

DROP POLICY IF EXISTS "run_steps_select" ON run_steps;
CREATE POLICY "run_steps_select" ON run_steps
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM runs
      WHERE runs.id = run_steps.run_id
        AND (runs.user_id = auth.uid() OR is_admin())
    )
  );

DROP POLICY IF EXISTS "run_steps_insert" ON run_steps;
CREATE POLICY "run_steps_insert" ON run_steps
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM runs
      WHERE runs.id = run_steps.run_id
        AND runs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "run_steps_update" ON run_steps;
CREATE POLICY "run_steps_update" ON run_steps
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM runs
      WHERE runs.id = run_steps.run_id
        AND (runs.user_id = auth.uid() OR is_admin())
    )
  );

-- ── meetings ───────────────────────────────────────────────

DROP POLICY IF EXISTS "meetings_all" ON meetings;
CREATE POLICY "meetings_all" ON meetings
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── objectives & key_results ───────────────────────────────

DROP POLICY IF EXISTS "objectives_all" ON objectives;
CREATE POLICY "objectives_all" ON objectives
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "key_results_all" ON key_results;
CREATE POLICY "key_results_all" ON key_results
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── services ───────────────────────────────────────────────

DROP POLICY IF EXISTS "services_all" ON services;
CREATE POLICY "services_all" ON services
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── posts ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "posts_all" ON posts;
CREATE POLICY "posts_all" ON posts
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- PRONTO. RLS ativo em todas as tabelas.
-- A tabela `runs` e `run_steps` têm isolamento por usuário.
-- As demais são acessíveis por qualquer membro autenticado
-- (equipe interna — ajuste conforme necessário).
-- ============================================================
