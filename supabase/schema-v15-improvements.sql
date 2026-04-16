-- Schema v15: Usability improvements
-- Adds: notifications, activity_log, approval token expiry, post fields

-- ============================================================
-- 1. NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,  -- 'task_assigned', 'post_approved', 'post_adjustment', 'post_due'
  title text NOT NULL,
  message text,
  data jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications"
  ON notifications FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications(user_id, read) WHERE read = false;

-- ============================================================
-- 2. ACTIVITY LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  entity_type text NOT NULL,  -- 'post', 'task', 'client', 'invoice'
  entity_id uuid NOT NULL,
  action text NOT NULL,       -- 'created', 'status_changed', 'approved', 'adjustment_requested', 'deleted'
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read activity"
  ON activity_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert activity"
  ON activity_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS activity_log_entity_idx ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS activity_log_created_idx ON activity_log(created_at DESC);

-- ============================================================
-- 3. CLIENTS — approval token expiry
-- ============================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS approval_token_expires_at timestamptz;

-- ============================================================
-- 4. POSTS — new fields for copy, delivery, and approval history
-- ============================================================
ALTER TABLE posts ADD COLUMN IF NOT EXISTS delivery_url text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS caption text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS cta text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hashtags text[] DEFAULT ARRAY[]::text[];
ALTER TABLE posts ADD COLUMN IF NOT EXISTS approval_notes_history jsonb DEFAULT '[]'::jsonb;
