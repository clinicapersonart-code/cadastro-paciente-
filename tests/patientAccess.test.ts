import { describe, expect, it } from 'vitest';
import type { Patient, PatientAccessGrant, UserProfile } from '../types';
import {
  getPatientAccessMode,
  isPatientAssignedToProfessional,
  listPatientsVisibleToUser,
} from '../utils/patientAccess';

const patient = (id: string, profissionais: string[] = []): Patient => ({
  id,
  nome: `Paciente ${id}`,
  faixa: 'Adulto',
  profissionais,
  especialidades: [],
});

const user = (overrides: Partial<UserProfile>): UserProfile => ({
  id: 'user-1',
  name: 'Nayara Cinthia Malandrim',
  role: 'professional',
  active: true,
  ...overrides,
});

const grant = (overrides: Partial<PatientAccessGrant>): PatientAccessGrant => ({
  id: 'grant-1',
  patientId: 'patient-1',
  userId: 'user-1',
  accessLevel: 'upload_report_only',
  active: true,
  createdAt: '2026-07-28T00:00:00.000Z',
  createdByUserId: 'admin-1',
  createdByName: 'Responsável Técnico',
  ...overrides,
});

describe('patient access control', () => {
  it('matches assigned professional by full name or name before register suffix', () => {
    expect(isPatientAssignedToProfessional(patient('p1', ['Nayara Cinthia Malandrim - CRP 06/143570']), user({}))).toBe(true);
    expect(isPatientAssignedToProfessional(patient('p1', ['Outra Profissional']), user({}))).toBe(false);
  });

  it('gives admin full access even without explicit share', () => {
    expect(getPatientAccessMode(patient('patient-1'), user({ role: 'admin', id: 'admin-1' }), [])).toBe('full');
  });

  it('gives assigned professional full access', () => {
    const p = patient('patient-1', ['Nayara Cinthia Malandrim - CRP 06/143570']);

    expect(getPatientAccessMode(p, user({}), [])).toBe('full');
  });

  it('gives shared external professional upload-only access without prontuario access', () => {
    const p = patient('patient-1', ['Bruno Alexandre - CRP 181006']);

    expect(getPatientAccessMode(p, user({}), [grant({})])).toBe('upload_report_only');
  });

  it('does not expose patients when the share is inactive or belongs to another user', () => {
    const p = patient('patient-1', ['Bruno Alexandre - CRP 181006']);

    expect(getPatientAccessMode(p, user({}), [grant({ active: false })])).toBe('none');
    expect(getPatientAccessMode(p, user({ id: 'other-user' }), [grant({})])).toBe('none');
  });

  it('lists patients visible by either assignment or limited share', () => {
    const patients = [
      patient('assigned', ['Nayara Cinthia Malandrim - CRP 06/143570']),
      patient('shared', ['Bruno Alexandre - CRP 181006']),
      patient('hidden', ['Outra Profissional']),
    ];

    expect(listPatientsVisibleToUser(patients, user({}), [grant({ patientId: 'shared' })]).map(p => p.id))
      .toEqual(['assigned', 'shared']);
  });
});
