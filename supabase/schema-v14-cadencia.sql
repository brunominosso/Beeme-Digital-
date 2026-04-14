-- schema-v14-cadencia.sql
-- Cadência semanal nos modelos de tarefa

ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS cadencia_ativa boolean NOT NULL DEFAULT false;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS cadencia_dia integer;
-- cadencia_dia: 0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado

-- Permitir update de modelos (para ativar/desativar cadência)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'task_templates' AND policyname = 'Users can update own templates'
  ) THEN
    CREATE POLICY "Users can update own templates"
      ON task_templates FOR UPDATE
      TO authenticated USING (auth.uid() = created_by);
  END IF;
END $$;
