-- schema-v10-posts.sql
-- Tabela de posts/conteúdo para Social Media e Designer

CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'nao_iniciado',
  -- nao_iniciado | em_andamento | criar_copy | fazer_captacao | editar_video | criar_arte | em_aprovacao | publicado
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  platform text, -- instagram | tiktok | youtube | linkedin
  format text,   -- reels_short | carrossel | imagem_unica | stories
  due_date date,
  publish_date date,
  post_date date,
  assignee_ids uuid[] DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_all" ON posts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger updated_at
CREATE TRIGGER on_posts_updated
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
