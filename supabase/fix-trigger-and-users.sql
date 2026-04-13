-- ============================================================
-- FIX: Trigger + Criar utilizadores da equipa
-- Colar no Supabase → SQL Editor → Run
-- ============================================================

-- 1. Corrigir a check constraint do profiles (aceitar todas as roles)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'gestor', 'designer', 'social_media', 'editor', 'financeiro', 'member'));

-- 2. Corrigir o trigger com exception handling + email case-insensitive
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  pending public.pending_profiles%ROWTYPE;
BEGIN
  BEGIN
    -- Email case-insensitive lookup
    SELECT * INTO pending
    FROM public.pending_profiles
    WHERE LOWER(email) = LOWER(NEW.email)
    LIMIT 1;

    IF FOUND THEN
      INSERT INTO public.profiles (id, name, role, avatar_color)
      VALUES (NEW.id, pending.name, pending.role, pending.avatar_color)
      ON CONFLICT (id) DO UPDATE SET
        name = pending.name,
        role = pending.role,
        avatar_color = pending.avatar_color;

      DELETE FROM public.pending_profiles WHERE LOWER(email) = LOWER(NEW.email);
    ELSE
      INSERT INTO public.profiles (id, name, role, avatar_color)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        'gestor',
        '#9FA4DB'
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Nunca bloquear a criação de utilizador por erro no trigger
    NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Preparar pending_profiles para cada membro da equipa
INSERT INTO public.pending_profiles (email, name, role, avatar_color)
VALUES
  ('lorenzo@beemedigital.com',  'Lorenzo',  'designer',     '#ec4899'),
  ('paloma@beemedigital.com',   'Paloma',   'social_media', '#f59e0b'),
  ('giovanna@beemedigital.com', 'Giovanna', 'financeiro',   '#10b981'),
  ('juan@beemedigital.com',     'Juan',     'gestor',       '#6c63ff'),
  ('humberto@beemedigital.com', 'Humberto', 'gestor',       '#8b5cf6')
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  avatar_color = EXCLUDED.avatar_color;

SELECT 'OK — agora corre o script Node.js para criar os logins' AS status;
