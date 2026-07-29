import { describe, expect, test } from 'vitest';
import {
  formatAppointmentWeekday,
  formatRecurringWeekdayPhrase,
  getEffectiveAppointmentRecurrence,
  getPatientScheduleSuggestion,
  hasScheduleDayOrTimeChanged,
  isRecurringAppointment,
  preserveRecurrenceMetadata,
} from '../components/Agenda';
import type { Appointment, Patient } from '../types';

const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'appt-1',
  patientId: 'patient-1',
  patientName: 'Paciente Teste',
  profissional: 'Nayara Cinthia Malandrim',
  date: '2026-05-18',
  time: '08:00',
  type: 'Particular',
  status: 'Agendado',
  seriesId: 'series-1',
  recurrence: 'weekly',
  ...overrides,
});

const makePatient = (overrides: Partial<Patient> = {}): Patient => ({
  id: 'patient-1',
  nome: 'Paciente Teste',
  faixa: 'Adulto',
  profissionais: ['Nayara Cinthia Malandrim'],
  especialidades: [],
  ...overrides,
});

describe('agenda recurring edit helpers', () => {
  test('formats appointment weekday in pt-BR', () => {
    expect(formatAppointmentWeekday('2026-05-18')).toBe('segunda-feira');
  });

  test('uses the correct article for recurring weekdays', () => {
    expect(formatRecurringWeekdayPhrase('2026-05-18')).toBe('toda segunda-feira');
    expect(formatRecurringWeekdayPhrase('2026-05-23')).toBe('todo sábado');
  });

  test('detects schedule changes only when time or date/day changes', () => {
    const appt = makeAppointment();

    expect(hasScheduleDayOrTimeChanged(appt, '2026-05-18', '08:00')).toBe(false);
    expect(hasScheduleDayOrTimeChanged(appt, '2026-05-18', '09:00')).toBe(true);
    expect(hasScheduleDayOrTimeChanged(appt, '2026-05-19', '08:00')).toBe(true);
  });

  test('recognizes series appointments for enabling this/future choice', () => {
    expect(isRecurringAppointment(makeAppointment())).toBe(true);
    expect(isRecurringAppointment(makeAppointment({ seriesId: undefined, recurrence: 'none' }))).toBe(false);
  });

  test('uses saved recurrence when present', () => {
    expect(getEffectiveAppointmentRecurrence(makeAppointment({ recurrence: 'weekly' }), [])).toBe('weekly');
  });

  test('infers weekly recurrence from series dates when saved recurrence is missing', () => {
    const appts = [
      makeAppointment({ id: 'a', recurrence: 'none', date: '2026-05-18', seriesId: 'legacy-series' }),
      makeAppointment({ id: 'b', recurrence: 'none', date: '2026-05-25', seriesId: 'legacy-series' }),
      makeAppointment({ id: 'c', recurrence: 'none', date: '2026-06-01', seriesId: 'legacy-series' }),
    ];

    expect(getEffectiveAppointmentRecurrence(appts[0], appts)).toBe('weekly');
  });

  test('preserves recurrence metadata when editing a recurring appointment', () => {
    const original = makeAppointment({
      recurrenceEndDate: '2026-08-31',
      recurrenceIndex: 2,
      isSeriesMaster: false,
      googleEventId: 'google-master',
    });
    const edited = makeAppointment({
      time: '09:00',
      seriesId: undefined,
      recurrence: 'none',
      recurrenceEndDate: undefined,
      recurrenceIndex: undefined,
      isSeriesMaster: undefined,
      googleEventId: undefined,
    });

    expect(preserveRecurrenceMetadata(edited, original)).toMatchObject({
      time: '09:00',
      seriesId: 'series-1',
      recurrence: 'weekly',
      recurrenceEndDate: '2026-08-31',
      recurrenceIndex: 2,
      isSeriesMaster: false,
      googleEventId: 'google-master',
    });
  });

  test('suggests linked professional and next weekly slot when selecting a patient', () => {
    const patient = makePatient({ profissionais: ['Nayara Cinthia Malandrim - CRP 06/143570'] });
    const appointments = [
      makeAppointment({
        id: 'fri-1',
        patientId: patient.id,
        date: '2026-05-08',
        time: '19:00',
        profissional: 'Nayara Cinthia Malandrim - CRP 06/143570',
        recurrence: 'weekly',
        seriesId: 'series-friday',
      }),
      makeAppointment({
        id: 'fri-2',
        patientId: patient.id,
        date: '2026-05-15',
        time: '19:00',
        profissional: 'Nayara Cinthia Malandrim - CRP 06/143570',
        recurrence: 'weekly',
        seriesId: 'series-friday',
      }),
    ];

    expect(getPatientScheduleSuggestion(patient, appointments, '2026-07-15')).toEqual({
      profissional: 'Nayara Cinthia Malandrim - CRP 06/143570',
      date: '2026-07-17',
      time: '19:00',
      recurrence: 'weekly',
    });
  });

  test('suggests psychologist or neuropsychologist according to session type', () => {
    const patient = makePatient({
      profissionais: ['Bruno Alexandre - CRP 181006', 'Drieli Guimaraes Thimoteo'],
      primaryPsychologist: 'Bruno Alexandre - CRP 181006',
      neuropsychologist: 'Drieli Guimaraes Thimoteo',
    });

    expect(getPatientScheduleSuggestion(patient, [], '2026-07-15', 'Psicoterapia')).toEqual({
      profissional: 'Bruno Alexandre - CRP 181006',
    });

    expect(getPatientScheduleSuggestion(patient, [], '2026-07-15', 'Avaliação Neuro')).toEqual({
      profissional: 'Drieli Guimaraes Thimoteo',
    });

    expect(getPatientScheduleSuggestion(patient, [], '2026-07-15', 'Testagem')).toEqual({
      profissional: 'Drieli Guimaraes Thimoteo',
    });
  });
});
