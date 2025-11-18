
export interface Patient {
  id: string;
  nome: string;
  nascimento?: string;
  faixa: 'Criança' | 'Adulto' | '';
  responsavel?: string;
  endereco?: string;
  contato?: string;
  convenio?: string;
  carteirinha?: string;
  tipoAtendimento?: 'Convencional' | 'ABA' | '';
  profissionais: string[];
  especialidades: string[];
  crm?: string;
  origem?: string;
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
  agendamentos?: Appointment[]; // Adicionado campo opcional para compatibilidade com backups antigos
  convenios: string[];
  profissionais: string[];
  especialidades: string[];
  ts: string;
}

export interface EncryptedPackage {
  format: 'personart-aesgcm-v1';
  iv: string;
  salt: string;
  ct: string;
}
