import type { Patient, PatientAccessGrant, PatientAccessLevel, UserProfile } from '../types';

export type PatientAccessMode = PatientAccessLevel | 'none';

const normalizeName = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const baseProfessionalName = (value: string): string =>
  normalizeName(value.split(' - ')[0] || value);

export const isPatientAssignedToProfessional = (patient: Patient, user: UserProfile): boolean => {
  const userName = normalizeName(user.name);
  const userBaseName = baseProfessionalName(user.name);
  const patientProfessionals = patient.profissionais || [];

  return patientProfessionals.some((professional) => {
    if (!professional) return false;

    const professionalName = normalizeName(professional);
    const professionalBaseName = baseProfessionalName(professional);

    return (
      professionalName.includes(userName) ||
      userName.includes(professionalBaseName) ||
      professionalBaseName.includes(userBaseName) ||
      userBaseName.includes(professionalBaseName)
    );
  });
};

export const getPatientAccessGrant = (
  patient: Patient,
  user: UserProfile | null | undefined,
  grants: PatientAccessGrant[],
): PatientAccessGrant | undefined => {
  if (!user) return undefined;

  const matches = grants.filter(
    (grant) => grant.active !== false && grant.patientId === patient.id && grant.userId === user.id,
  );

  const order: PatientAccessLevel[] = ['full', 'documents_only', 'upload_report_only'];
  return matches.sort((a, b) => order.indexOf(a.accessLevel) - order.indexOf(b.accessLevel))[0];
};

export const getPatientAccessMode = (
  patient: Patient,
  user: UserProfile | null | undefined,
  grants: PatientAccessGrant[],
): PatientAccessMode => {
  if (!user || user.active === false) return 'none';

  if (user.role === 'clinic' || user.role === 'admin') return 'full';

  if (user.role === 'professional' && isPatientAssignedToProfessional(patient, user)) {
    return 'full';
  }

  return getPatientAccessGrant(patient, user, grants)?.accessLevel || 'none';
};

export const canViewPatientMedicalRecord = (accessMode: PatientAccessMode): boolean => accessMode === 'full';

export const canUploadPatientDocuments = (accessMode: PatientAccessMode): boolean =>
  accessMode === 'full' || accessMode === 'documents_only' || accessMode === 'upload_report_only';

export const canViewPatientDocuments = (accessMode: PatientAccessMode): boolean =>
  accessMode === 'full' || accessMode === 'documents_only' || accessMode === 'upload_report_only';

export const isLimitedPatientAccess = (accessMode: PatientAccessMode): boolean =>
  accessMode === 'documents_only' || accessMode === 'upload_report_only';

export const listPatientsVisibleToUser = (
  patients: Patient[],
  user: UserProfile | null | undefined,
  grants: PatientAccessGrant[],
): Patient[] => patients.filter((patient) => getPatientAccessMode(patient, user, grants) !== 'none');
