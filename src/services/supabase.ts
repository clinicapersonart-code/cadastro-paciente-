
import { createClient } from '@supabase/supabase-js';

// As variáveis de ambiente VITE_ são expostas automaticamente para o navegador pelo Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Cliente seguro para usar no navegador (Respeita as regras RLS do banco)
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

export const isSupabaseConfigured = () => {
    return !!supabase;
};
