import type { Patient } from '../types';

export const buildPatientDataForActiveToggle = (patient: Patient, active: boolean): Patient => {
  return JSON.parse(JSON.stringify({ ...patient, active }));
};
