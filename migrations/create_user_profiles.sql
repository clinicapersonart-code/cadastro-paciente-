-- Tabela para armazenar perfis de usuários (profissionais, admin, clínica)
-- Isso garante que alterações de senha persistam na nuvem
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'professional',
  active BOOLEAN DEFAULT true,
  data JSONB NOT NULL
);

-- Permite acesso público (mesma política das outras tabelas)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON user_profiles
  FOR ALL USING (true) WITH CHECK (true);
