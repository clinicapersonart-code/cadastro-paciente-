
export const STORAGE_KEYS = {
  // Mantemos alguns itens locais, como preferências de visualização e listas simples
  CONVENIOS: 'personart.convenios.v1',
  PROFISSIONAIS: 'personart.profissionais.v1',
  ESPECIALIDADES: 'personart.especialidades.v1',
  BRAND: 'personart.brand.v1',
  ACCESS_PASS: 'personart.access.pass'
};

// COLOQUE AQUI AS CHAVES DO SEU PROJETO SUPABASE
export const SUPABASE_URL = ''; // Ex: https://xyzcompany.supabase.co
export const SUPABASE_ANON_KEY = ''; // Ex: eyJhbGciOiJIUzI1NiIsInR5c...

export const DEFAULT_CONVENIOS = ['Funserv', 'Danamed', 'Gama Saúde', 'Fusex', 'BlueSaúde', 'Unimed Campinas', 'Ossel', 'Ofebas'];

export const DEFAULT_PROFISSIONAIS = [
  'Bruno Alexandre - CRP 181006',
  'Drieli Guimaraes Thimoteo - CRP 181575',
  'Geovana Rafaela Aparecida Dias Duarte - CRP 170875',
  'Giovana Affonso Petri - CRP 158139',
  'Janaina Mendes Davi - CRP 180776',
  'Maria Jose Pedroso - CRP 187833',
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
