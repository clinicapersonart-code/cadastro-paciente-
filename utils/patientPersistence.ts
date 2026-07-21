import type { Patient } from '../types';

export const buildPatientDataForActiveToggle = (patient: Patient, active: boolean): Patient => {
  return JSON.parse(JSON.stringify({ ...patient, active }));
};

type SupabaseDeleteResponse = { error?: { message?: string } | null };
type SupabaseDeleteQuery = {
  eq: (column: string, value: string) => Promise<SupabaseDeleteResponse>;
};
type SupabaseDeleteTable = {
  delete: () => SupabaseDeleteQuery;
};
type SupabaseDeleteClient = {
  from: (table: string) => SupabaseDeleteTable;
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
