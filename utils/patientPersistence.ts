import type { Patient } from '../types';

export const buildPatientDataForActiveToggle = (patient: Patient, active: boolean): Patient => {
  return JSON.parse(JSON.stringify({ ...patient, active }));
};

type SupabaseDeleteResponse = { error?: { message?: string } | null };
type SupabaseWriteResponse = { error?: { message?: string } | null };
type SupabaseDeleteQuery = {
  eq: (column: string, value: string) => Promise<SupabaseDeleteResponse>;
};
type SupabaseDeleteTable = {
  delete: () => SupabaseDeleteQuery;
};
type SupabaseDeleteClient = {
  from: (table: string) => SupabaseDeleteTable;
};
type SupabasePatientUpsertTable = {
  upsert: (payload: unknown) => Promise<SupabaseWriteResponse>;
};
type SupabasePatientUpsertClient = {
  from: (table: 'patients') => SupabasePatientUpsertTable;
};

export const PATIENT_CLOUD_DELETE_STEPS = [
  { table: 'medical_records', column: 'patient_id' },
  { table: 'appointments', column: 'patient_id' },
  { table: 'patient_documents', column: 'patient_id' },
  { table: 'document_folders', column: 'patient_id' },
  { table: 'patients', column: 'id' },
] as const;

export const deletePatientFromCloud = async (
  supabaseClient: SupabaseDeleteClient,
  patientId: string,
): Promise<void> => {
  for (const step of PATIENT_CLOUD_DELETE_STEPS) {
    const { error } = await supabaseClient
      .from(step.table)
      .delete()
      .eq(step.column, patientId);

    if (error) {
      throw new Error(`Falha ao excluir ${step.table}: ${error.message || 'erro desconhecido'}`);
    }
  }
};

export const buildPatientCloudRecord = (patient: Patient) => {
  const cleanData: Patient = JSON.parse(JSON.stringify(patient));
  const numAut = cleanData.funservConfig?.numeroAutorizacao || cleanData.numero_autorizacao || '';
  const dataAut = cleanData.funservConfig?.dataAutorizacao || cleanData.data_autorizacao || null;

  return {
    id: cleanData.id,
    nome: cleanData.nome,
    carteirinha: cleanData.carteirinha || '',
    numero_autorizacao: numAut,
    data_autorizacao: dataAut,
    data: cleanData,
  };
};

export const persistPatientActiveToggle = async (
  supabaseClient: SupabasePatientUpsertClient,
  patient: Patient,
  active: boolean,
): Promise<Patient> => {
  const patientToSave = buildPatientDataForActiveToggle(patient, active);
  const { error } = await supabaseClient
    .from('patients')
    .upsert(buildPatientCloudRecord(patientToSave));

  if (error) {
    throw new Error(`Falha ao salvar status do paciente: ${error.message || 'erro desconhecido'}`);
  }

  return patientToSave;
};
