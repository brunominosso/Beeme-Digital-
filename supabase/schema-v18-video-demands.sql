-- Video Demands: Dani (captacao) → Humberto (gestor/editor)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS video_demands (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid REFERENCES clients(id) ON DELETE SET NULL,
  created_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  briefing      text NOT NULL,
  drive_material_link text NOT NULL,
  drive_edited_link   text,
  status        text NOT NULL DEFAULT 'pendente'
                CHECK (status IN ('pendente', 'em_edicao', 'entregue', 'cancelado')),
  notas         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE video_demands ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all demands (Dani sees hers, Humberto sees all)
CREATE POLICY "video_demands_select" ON video_demands
  FOR SELECT TO authenticated USING (true);

-- Any authenticated user can insert (Dani creates demands)
CREATE POLICY "video_demands_insert" ON video_demands
  FOR INSERT TO authenticated WITH CHECK (true);

-- Any authenticated user can update (Humberto updates status/edited link)
CREATE POLICY "video_demands_update" ON video_demands
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_video_demands_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER video_demands_updated_at
  BEFORE UPDATE ON video_demands
  FOR EACH ROW EXECUTE FUNCTION update_video_demands_updated_at();
