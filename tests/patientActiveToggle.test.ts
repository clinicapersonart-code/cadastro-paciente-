import { expect, test } from 'vitest';
import type { Patient } from '../types';
import { buildPatientDataForActiveToggle, deletePatientFromCloud, PATIENT_CLOUD_DELETE_STEPS, persistPatientActiveToggle } from '../utils/patientPersistence';

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

test('deactivation cloud sync: persists the full patient data payload with active=false', async () => {
  const upserted: any[] = [];
  const fakeSupabase = {
    from: (table: string) => {
      expect(table).toBe('patients');
      return {
        upsert: async (payload: any) => {
          upserted.push(payload);
          return { error: null };
        },
      };
    },
  };

  const updated = await persistPatientActiveToggle(fakeSupabase, patientBase({
    active: true,
    convenio: 'Funserv',
    carteirinha: '123',
    funservConfig: { numeroAutorizacao: '999', dataAutorizacao: '2026-07-01' } as any,
  }), false);

  expect(updated.active).toBe(false);
  expect(upserted).toHaveLength(1);
  expect(upserted[0].id).toBe('1');
  expect(upserted[0].nome).toBe('Maria');
  expect(upserted[0].carteirinha).toBe('123');
  expect(upserted[0].numero_autorizacao).toBe('999');
  expect(upserted[0].data_autorizacao).toBe('2026-07-01');
  expect(upserted[0].data.active).toBe(false);
  expect(upserted[0].data.convenio).toBe('Funserv');
});

test('deactivation cloud sync: throws Supabase errors so the UI cannot claim success', async () => {
  const fakeSupabase = {
    from: () => ({
      upsert: async () => ({ error: { message: 'update blocked by policy' } }),
    }),
  };

  await expect(persistPatientActiveToggle(fakeSupabase, patientBase({ active: true }), false))
    .rejects
    .toThrow('Falha ao salvar status do paciente: update blocked by policy');
});
