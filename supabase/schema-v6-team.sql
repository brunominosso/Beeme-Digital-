-- schema-v6-team.sql
-- 1. Remove FK constraint de profiles para permitir membros sem login ainda
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. Criar o teu perfil (Bruno) a partir do teu auth.users
INSERT INTO profiles (id, name, role, avatar_color)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'name', email, 'Bruno'),
  'admin',
  '#9FA4DB'
FROM auth.users
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  avatar_color = '#9FA4DB';

-- 3. Inserir equipa (sem login por agora, terão login depois)
INSERT INTO profiles (id, name, role, avatar_color) VALUES
  (gen_random_uuid(), 'Lorenzo', 'designer',    '#ec4899'),
  (gen_random_uuid(), 'Paloma',  'social_media', '#f59e0b'),
  (gen_random_uuid(), 'Humberto','gestor',        '#9FA4DB'),
  (gen_random_uuid(), 'Juan',    'gestor',        '#6c63ff'),
  (gen_random_uuid(), 'Giovanna','financeiro',    '#4ade80');
