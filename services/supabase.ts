
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants';

let client = null;

// Inicialização segura do cliente
try {
  // Verifica se as constantes foram preenchidas corretamente
  if (SUPABASE_URL && SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.warn('⚠️ Supabase: Credenciais ausentes ou inválidas em constants.ts');
  }
} catch (error) {
  console.error("❌ Erro crítico ao inicializar cliente Supabase:", error);
}

export const supabase = client;

export const isSupabaseConfigured = () => {
    return !!supabase;
};