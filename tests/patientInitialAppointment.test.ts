import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildInitialAppointmentsForPatient, getNextDateForWeekday, preCadastroToInitialAppointment } from '../utils/patientInitialAppointment';
import type { Patient, PreCadastro } from '../types';

const patient: Patient = {
  id: 'patient-1',
  nome: 'Paciente Teste',
  nascimento: '2015-01-01',
  faixa: 'Criança',
  responsavel: 'Responsável Teste',
  contato: '(11) 99999-9999',
  convenio: 'Funserv',
  carteirinha: '123',
  profissionais: ['Profissional Teste'],
  especialidades: [],
};

describe('initial appointment creation from patient registration', () => {
  test('creates an agenda appointment directly when saving a patient with first appointment data', () => {
    const appointments = buildInitialAppointmentsForPatient(patient, {
      date: '2026-08-03',
      time: '09:30',
      professional: 'Profissional Teste',
      recurrence: 'none',
      type: 'Convênio',
    });

    expect(appointments).toHaveLength(1);
    expect(appointments[0]).toMatchObject({
      patientId: 'patient-1',
      patientName: 'Paciente Teste',
      date: '2026-08-03',
      time: '09:30',
      profissional: 'Profissional Teste',
      type: 'Convênio',
      status: 'Agendado',
      convenioName: 'Funserv',
      obs: 'Agendamento Inicial',
    });
  });

  test('turns a pre-scheduled public registration with weekday into the next matching agenda date', () => {
    const item: PreCadastro = {
      id: 'pre-1',
      nome: 'Paciente Pré',
      nascimento: '2010-01-01',
      responsavel: 'Responsável',
      contato: '11999999999',
      email: '',
      endereco: '',
      convenio: 'Particular',
      carteirinha: '',
      profissional: 'Profissional Teste',
      dataEnvio: '2026-08-01T12:00:00.000Z',
      agendamento: {
        data: '',
        hora: '14:00',
        frequencia: 'Semanal',
        dia: 'Segunda-feira',
      } as PreCadastro['agendamento'] & { dia: string },
    };

    expect(preCadastroToInitialAppointment(item, new Date('2026-08-01T12:00:00-03:00'))).toEqual({
      date: '2026-08-03',
      time: '14:00',
      professional: 'Profissional Teste',
      recurrence: 'weekly',
      type: 'Convênio',
    });
  });

  test('moves weekday-only pre-scheduled appointments to the next week when the time already passed today', () => {
    const item: PreCadastro = {
      id: 'pre-2',
      nome: 'Paciente Pré 2',
      nascimento: '2010-01-01',
      responsavel: 'Responsável',
      contato: '11999999999',
      email: '',
      endereco: '',
      convenio: '',
      carteirinha: '',
      profissional: 'Profissional Teste',
      dataEnvio: '2026-08-01T18:00:00.000Z',
      agendamento: {
        data: '',
        hora: '08:00',
        frequencia: 'Semanal',
        dia: 'Sábado',
      },
    };

    expect(preCadastroToInitialAppointment(item, new Date('2026-08-01T12:00:00-03:00'))?.date).toBe('2026-08-08');
  });

  test('preserves the initial appointment argument in the professional/admin patient form wrapper', () => {
    const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

    expect(appSource).toContain('onSave={(patient, initialAppointment) => {');
    expect(appSource).toContain('handleSavePatient(patient, initialAppointment);');
  });
});

describe('getNextDateForWeekday', () => {
  test('returns today when today matches the requested weekday', () => {
    expect(getNextDateForWeekday('Sábado', new Date('2026-08-01T08:00:00-03:00'))).toBe('2026-08-01');
  });

  test('returns the next requested weekday when today does not match', () => {
    expect(getNextDateForWeekday('Segunda-feira', new Date('2026-08-01T08:00:00-03:00'))).toBe('2026-08-03');
  });
});
