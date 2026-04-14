-- schema-v13-templates.sql
-- Modelos de tarefa + data inicial nas tarefas

-- 1. Data inicial nas tarefas
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date date;

-- 2. Tabela de modelos de tarefa
CREATE TABLE IF NOT EXISTS task_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium',
  assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 3. Índice para lookup por criador
CREATE INDEX IF NOT EXISTS task_templates_created_by_idx ON task_templates(created_by);

-- 4. RLS
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

-- Todos os utilizadores autenticados podem ver os modelos (partilhados na equipa)
CREATE POLICY "All authenticated can read templates"
  ON task_templates FOR SELECT
  TO authenticated USING (true);

-- Utilizadores podem criar os seus próprios modelos
CREATE POLICY "Users can create templates"
  ON task_templates FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

-- Apenas o criador pode eliminar o seu modelo
CREATE POLICY "Users can delete own templates"
  ON task_templates FOR DELETE
  TO authenticated USING (auth.uid() = created_by);
