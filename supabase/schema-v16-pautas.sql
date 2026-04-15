-- Schema v16: Pautas (agenda semanal da equipa)
-- Organiza o tempo de Social Media e Designer por dia/turno

-- ============================================================
-- 1. PAUTAS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS pautas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  tipo text NOT NULL,
  -- Tipos: 'onboarding' | 'mapa_mental' | 'planejamento' | 'roteiro'
  --        'captacao' | 'edicao_video' | 'edicao_foto'
  --        'reuniao_alinhamento' | 'aprovacao' | 'outro'
  data date NOT NULL,
  turno text NOT NULL DEFAULT 'manha',  -- 'manha' | 'tarde' | 'dia_todo'
  status text NOT NULL DEFAULT 'pendente',  -- 'pendente' | 'em_andamento' | 'concluido' | 'cancelado'
  notas text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pautas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read pautas"
  ON pautas FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert pautas"
  ON pautas FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update pautas"
  ON pautas FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete pautas"
  ON pautas FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS pautas_assignee_idx ON pautas(assignee_id);
CREATE INDEX IF NOT EXISTS pautas_data_idx ON pautas(data);
CREATE INDEX IF NOT EXISTS pautas_client_idx ON pautas(client_id);
CREATE INDEX IF NOT EXISTS pautas_data_assignee_idx ON pautas(data, assignee_id);
