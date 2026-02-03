
// Função segura para ler variáveis de ambiente sem quebrar a aplicação
const getEnv = (key: string) => {
  try {
    // @ts-ignore
    return (import.meta && import.meta.env && import.meta.env[key]) ? import.meta.env[key] : '';
  } catch (e) {
    return '';
  }
};

export const STORAGE_KEYS = {
  // Mantemos alguns itens locais, como preferências de visualização e listas simples
  CONVENIOS: 'personart.convenios.v1',
  PROFISSIONAIS: 'personart.profissionais.v1',
  ESPECIALIDADES: 'personart.especialidades.v1',
  BRAND: 'personart.brand.v1',
  ACCESS_PASS: 'personart.access.pass'
};

// --- CONFIGURAÇÃO DO SUPABASE ---
// Estamos fixando as chaves aqui para garantir que funcione na Vercel e Localmente sem configurar variáveis extras.
export const SUPABASE_URL = 'https://yufcolmdbvxdpszlrvgk.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1ZmNvbG1kYnZ4ZHBzemxydmdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4OTE2MTQsImV4cCI6MjA4MDQ2NzYxNH0.hsOfipaRH7RZCmT6rZ9842-0FBvgncROoCwdjyKsL_8';

export const DEFAULT_CONVENIOS = ['Funserv', 'Danamed', 'Gama Saúde', 'Fusex', 'BlueSaúde', 'Unimed Campinas', 'Ossel', 'Ofebas'];

export const DEFAULT_PROFISSIONAIS = [
  'Bruno Alexandre - CRP 181006',
  'Drieli Guimaraes Thimoteo - CRP 181575',
  'Geovana Rafaela Aparecida Dias Duarte - CRP 170875',
  'Giovana Affonso Petri - CRP 158139',
  'Janaina Mendes Davi - CRP 180776',
  'Maria Jose Pedroso - CRP 187833',
  'Nayara Cinthia Malandrim - CRP 06/143570',
  'Simone Martins De Agrela - CRP 196674',
  'Soraia Cristiane De Souza - CRP 181817',
  'Stephanie Goncalves Magon - CRP 174243'
];

export const DEFAULT_ESPECIALIDADES = ['Psicologia', 'Fonoaudiologia', 'Terapia Ocupacional', 'Nutrição'];

export const DEFAULT_ORIGINS = [
  'Google / Pesquisa',
  'Instagram',
  'Facebook',
  'Recomendação de Amigo/Parente',
  'Encaminhamento Médico',
  'Passou em frente',
  'Outros'
];
