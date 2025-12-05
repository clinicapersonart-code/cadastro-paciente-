
import { createClient } from '@supabase/supabase-js';

// Na Vercel (Backend), as variáveis são acessadas via process.env
// A chave SERVICE_ROLE ignora as regras de segurança (RLS), dando acesso total (Admin)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Variáveis de ambiente de servidor (SUPABASE_SERVICE_ROLE_KEY) não configuradas.');
}

// Exporta o cliente Admin para ser usado apenas em rotas de API (/api/*)
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
