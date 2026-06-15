import { expect, test } from 'vitest';
import type { Patient } from '../types';
import { buildPatientDataForActiveToggle } from '../utils/patientPersistence';

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
