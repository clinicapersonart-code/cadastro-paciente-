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
    history: string[]; // Datas das sessões realizadas
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
  tipoAtendimento?: 'Convencional' | 'ABA' | '';
  profissionais: string[];
  especialidades: string[];
  crm?: string;
  origem?: string;
  evolutions?: Evolution[];
  funservConfig?: FunservConfig;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  profissional: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: 'Convênio' | 'Particular';
  convenioName?: string; // Nome do convênio se for convênio
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
  origem?: string;
  dataEnvio: string;
}

export interface EncryptedPackage {
  format: 'personart-aesgcm-v1';
  iv: string;
  salt: string;
  ct: string;
}