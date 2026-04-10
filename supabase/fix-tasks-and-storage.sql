-- ============================================================
-- 1. Adicionar hora opcional às tarefas
-- ============================================================
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_time text;

-- ============================================================
-- 2. Corrigir políticas do bucket post-files (upload p/ todos)
-- ============================================================

-- Apagar políticas antigas se existirem
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;

-- Criar políticas novas
CREATE POLICY "post_files_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post-files');

CREATE POLICY "post_files_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'post-files');

CREATE POLICY "post_files_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'post-files');

CREATE POLICY "post_files_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'post-files');

SELECT 'OK — due_time adicionado e storage policies corrigidas' AS status;
