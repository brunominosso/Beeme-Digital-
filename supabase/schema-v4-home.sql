-- schema-v4-home.sql
-- Adiciona campo responsibilities ao perfil de cada utilizador

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS responsibilities text;
