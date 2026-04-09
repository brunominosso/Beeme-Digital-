-- schema-v9-auth.sql
-- Trigger que cria perfil automaticamente quando um novo utilizador faz login

-- Tabela de convites pendentes (admin cria antes do utilizador entrar)
CREATE TABLE IF NOT EXISTS pending_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'gestor',
  avatar_color text NOT NULL DEFAULT '#9FA4DB',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pending_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pending_profiles_admin" ON pending_profiles
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Função trigger: quando novo utilizador é criado, verifica se existe convite pendente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  pending pending_profiles%ROWTYPE;
BEGIN
  -- Procura convite pendente para este email
  SELECT * INTO pending FROM public.pending_profiles WHERE email = NEW.email LIMIT 1;

  IF FOUND THEN
    -- Cria perfil com dados do convite
    INSERT INTO public.profiles (id, name, role, avatar_color)
    VALUES (NEW.id, pending.name, pending.role, pending.avatar_color)
    ON CONFLICT (id) DO UPDATE SET
      name = pending.name,
      role = pending.role,
      avatar_color = pending.avatar_color;

    -- Remove o convite pendente
    DELETE FROM public.pending_profiles WHERE email = NEW.email;
  ELSE
    -- Cria perfil genérico se não tiver convite
    INSERT INTO public.profiles (id, name, role, avatar_color)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      'gestor',
      '#9FA4DB'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Associa o trigger ao evento de criação de utilizador
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
