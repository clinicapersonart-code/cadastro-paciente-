
export interface Evolution {
  id: string;
  date: string;
  content: string;
  professional: string;
  timestamp: string;
}

export interface FunservConfig {
  active: boolean;
  totalSessions: number;
  usedSessions: number;
  startDate: string;
  frequency: '1x Semana' | '2x Semana' | 'Quinzenal' | 'Outro';
  alertEmail: string;
  history: string[];
  numeroAutorizacao?: string;
  dataAutorizacao?: string;
}

export interface Patient {
  id: string;
  nome: string;
  nascimento?: string;
  faixa: 'Criança' | 'Adulto' | '';
  responsavel?: string;
  endereco?: string;
  contato?: string;
  email?: string;
  convenio?: string;
  carteirinha?: string;
  numero_autorizacao?: string;
  data_autorizacao?: string;
  tipoAtendimento?: 'Convencional' | 'ABA' | '';
  profissionais: string[];
  especialidades: string[];
  crm?: string;
  origem?: string;
  evolutions?: Evolution[];
  funservConfig?: FunservConfig;

  // Novos campos para Prontuário Completo
  escolaridade?: string;
  profissao?: string;
  primeiraSessao?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  carteirinha?: string;
  // Fix: Unified property name to numero_autorizacao
  numero_autorizacao?: string;
  data_autorizacao?: string;
  profissional: string;
  date: string;
  time: string;
  type: 'Convênio' | 'Particular';
  convenioName?: string;
  status: 'Agendado' | 'Realizado' | 'Cancelado';
  obs?: string;
}

export interface BrandConfig {
  color: string;
  dark: string;
  logo: string | null;
  name: string;
}

export interface BackupData {
  pacientes: Patient[];
  agendamentos?: Appointment[];
  convenios: string[];
  profissionais: string[];
  especialidades: string[];
  ts: string;
}

export interface PreCadastro {
  id: string;
  nome: string;
  nascimento: string;
  responsavel: string;
  contato: string;
  email: string;
  endereco: string;
  convenio: string;
  carteirinha: string;
  crm?: string;
  origem?: string;
  profissional?: string;
  dataEnvio: string;
  agendamento?: {
    data: string;
    hora: string;
    frequencia: string;
  }
}

export interface EncryptedPackage {
  format: 'personart-aesgcm-v1';
  iv: string;
  salt: string;
  ct: string;
}

// --- NOVAS ENTIDADES PARA V2.0 ---

export interface UserProfile {
  id: string;
  name: string;
  role: 'clinic' | 'admin' | 'professional'; // clinic = acesso total, admin = resp técnico, professional = psicólogo
  pin?: string; // Senha ou PIN
  crp?: string; // Para psicólogos
  active: boolean;
}

export interface MedicalRecordChunk {
  id: string;
  date: string;
  timestamp: number; // Para ordenação
  professionalName: string;
  professionalId: string;

  // Tipo do registro
  type: 'Anamnese' | 'Evolução' | 'Encerramento';

  // Conteúdo
  content: string; // HTML ou Texto rico

  // Campos Específicos do Modelo Personart
  behavior?: string; // Comportamento, humor, etc.
  intervention?: string; // Intervenção, técnica
  nextSteps?: string; // Próximos passos

  isPrivate?: boolean; // Se true, visível apenas ao criador e admin
}
