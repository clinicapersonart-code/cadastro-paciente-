
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

  // Soft-delete
  active?: boolean; // default = true (undefined = ativo)
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

  // Financeiro / duração
  durationMin?: number; // duração da sessão
  price?: number; // valor da sessão (R$)
}

export interface BrandConfig {
  color: string;
  dark: string;
  logo: string | null;
  name: string;
}

export interface ConvenioConfig {
  id: string;
  name: string;

  // Valores
  price?: number; // Valor cheio (clínica) - R$ por sessão
  payoutPrice?: number; // Repasse (profissional) - R$ por sessão
  payoutPercent?: number; // Ex: 75 (%). Default = 75

  // Duração
  durationMin?: number; // duração padrão (min)

  active?: boolean;
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

export type WaitlistStatus =
  | 'NOVO'
  | 'CONTATADO'
  | 'AGUARDANDO_VAGA'
  | 'AGUARDANDO_RETORNO'
  | 'AGENDADO'
  | 'ENCERRADO';

export interface WaitlistEntry {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
  specialties: string[];
  modality?: 'Presencial' | 'Online' | 'Tanto faz';
  preferredTimes?: string; // texto livre: "Seg/Qua à noite" etc.
  notes?: string;

  status: WaitlistStatus;
  createdAt: string;
  updatedAt: string;

  nextAction?: string;
  nextActionAt?: string; // ISO date

  lastContactAt?: string; // ISO
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
  crp?: string; // Para psicólogos (legado)
  active: boolean;
  // Novos campos para sincronização com lista de profissionais
  specialty?: string; // Especialidade (ex: Psicologia, Fonoaudiologia)
  professionalRegister?: string; // CRM/CRP completo
  color?: string; // Cor na agenda
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
  attendance?: 'Compareceu' | 'Faltou' | 'Cancelado' | 'Justificado';
  frequency?: 'Semanal' | 'Mensal';

  // Dados estruturados (para Anamnese com templates)
  structuredData?: {
    templateId: string;
    answers: Record<string, string>;
  };
}

// --- PORTAL DO PACIENTE 2.0 ---

// Registro de Sessão (Extensão de MedicalRecordChunk com controle de presença)
export interface SessionRecord extends MedicalRecordChunk {
  attendance: 'Compareceu' | 'Faltou' | 'Cancelado' | 'Justificado';
  paymentStatus?: 'Pago' | 'Pendente' | 'Isento';
}

// Documento do Paciente (Laudos, Atestados, Uploads)
export interface PatientDocument {
  id: string;
  title: string;
  type: 'Laudo' | 'Atestado' | 'Encaminhamento' | 'Contrato' | 'Outro';
  date: string;
  content?: string; // Para documentos gerados no sistema (HTML/Texto)
  fileData?: string; // Base64 para pequenos arquivos
  fileName?: string;
  professionalName: string;
  professionalId: string;
  folderId?: string; // ID da pasta (null = raiz)
}

// Pasta de Documentos do Paciente
export interface DocumentFolder {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
}

// Dados de Anamnese (Estrutura básica - templates serão preenchidos depois)
export interface AnamneseData {
  id: string;
  patientId: string;
  type: 'Infantil' | 'Adulto';
  date: string;
  professionalName: string;
  professionalId: string;
  data: Record<string, any>; // Campos dinâmicos do formulário
}



// --- SISTEMA DE SOLICITAÇÕES DE ALTERAÇÃO DE AGENDA ---
export interface ScheduleChangeRequest {
  id: string;
  appointmentId: string;
  type: 'UPDATE' | 'DELETE';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedBy: string; // userId
  requestedByName: string;
  timestamp: string;
  oldData: Appointment; // snapshot antes da alteração
  newData?: Appointment; // dados novos (para UPDATE)
  reviewedBy?: string; // userId de quem aceitou/rejeitou
  reviewedByName?: string;
  reviewedAt?: string;
}

// --- SISTEMA DE NOTIFICAÇÕES ---
export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: 'CADASTRO_PACIENTE' | 'AGENDAMENTO' | 'ALTERACAO_AGENDA' | 'EXCLUSAO_AGENDA' | 'EXCLUSAO_PACIENTE' | 'SOLICITACAO_ALTERACAO' | 'APROVACAO_ALTERACAO' | 'REJEICAO_ALTERACAO' | 'OUTRO';
  details: string;
  timestamp: string;
  data?: any;
}
