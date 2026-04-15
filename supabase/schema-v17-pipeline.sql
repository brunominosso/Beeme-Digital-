-- Schema v17: Pipeline de Produção Mensal
-- Matriz clientes × etapas para controlo do mês seguinte
-- Prazo: completo até dia 25 de cada mês

CREATE TABLE IF NOT EXISTS producao_mensal (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  mes date NOT NULL,         -- primeiro dia do mês referência (ex: 2026-05-01)
  etapa text NOT NULL,
  -- Etapas: 'planejamento' | 'alteracoes' | 'captacao' | 'edicao'
  --         'design' | 'revisao' | 'agendamento'
  status text NOT NULL DEFAULT 'pendente',
  -- Status: 'pendente' | 'em_andamento' | 'concluido' | 'bloqueado'
  notas text,
  updated_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, mes, etapa)
);

ALTER TABLE producao_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read producao_mensal"
  ON producao_mensal FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert producao_mensal"
  ON producao_mensal FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update producao_mensal"
  ON producao_mensal FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete producao_mensal"
  ON producao_mensal FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS producao_mensal_client_idx ON producao_mensal(client_id);
CREATE INDEX IF NOT EXISTS producao_mensal_mes_idx ON producao_mensal(mes);
CREATE INDEX IF NOT EXISTS producao_mensal_mes_client_idx ON producao_mensal(mes, client_id);
