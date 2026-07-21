import { expect, test } from 'vitest';
import type { Patient } from '../types';
import { buildPatientDataForActiveToggle, deletePatientFromCloud, PATIENT_CLOUD_DELETE_STEPS } from '../utils/patientPersistence';

const patientBase = (overrides: Partial<Patient> = {}): Patient => ({
  id: '1',
  nome: 'Maria',
  faixa: 'Adulto',
  profissionais: [],
  especialidades: [],
  ...overrides,
});

const loadFromSupabase = (rows: Array<{ data: Patient }>) => {
  return rows.map(row => row.data);
};

test('deactivation: active=false is persisted inside data payload', () => {
  const payload = buildPatientDataForActiveToggle(patientBase({ active: true }), false);
  expect(payload.active).toBe(false);
});

test('deactivation: active=false survives Supabase round-trip via data column', () => {
  const savedData = buildPatientDataForActiveToggle(patientBase({ active: true }), false);

  const rows = [{ data: savedData }];
  const loaded = loadFromSupabase(rows);

  expect(loaded[0].active).toBe(false);
});

test('patient with no active field gets active=false on deactivation', () => {
  const payload = buildPatientDataForActiveToggle(patientBase({ id: '2', nome: 'João', active: undefined }), false);
  expect(payload.active).toBe(false);
});

test('reactivation: active=true is correctly restored', () => {
  const payload = buildPatientDataForActiveToggle(patientBase({ active: false }), true);
  expect(payload.active).toBe(true);
});

test('permanent deletion: dependent tables are deleted before patients and every Supabase error is checked', async () => {
  const calls: Array<{ table: string; column: string; value: string }> = [];
  const fakeSupabase = {
    from: (table: string) => ({
      delete: () => ({
        eq: async (column: string, value: string) => {
          calls.push({ table, column, value });
          return { error: null };
        },
      }),
    }),
  };

  await deletePatientFromCloud(fakeSupabase, 'patient-1');

  expect(calls).toEqual(
    PATIENT_CLOUD_DELETE_STEPS.map(step => ({
      table: step.table,
      column: step.column,
      value: 'patient-1',
    })),
  );
  expect(calls.at(-1)?.table).toBe('patients');
});

test('permanent deletion: throws when Supabase returns an error instead of silently showing success', async () => {
  const fakeSupabase = {
    from: (table: string) => ({
      delete: () => ({
        eq: async () => ({
          error: table === 'patients' ? { message: 'violates foreign key' } : null,
        }),
      }),
    }),
  };

  await expect(deletePatientFromCloud(fakeSupabase, 'patient-1'))
    .rejects
    .toThrow('Falha ao excluir patients: violates foreign key');
});
