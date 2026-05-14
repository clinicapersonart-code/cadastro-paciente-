import { describe, expect, test } from 'vitest';
import {
  formatAppointmentWeekday,
  formatRecurringWeekdayPhrase,
  hasScheduleDayOrTimeChanged,
  isRecurringAppointment,
} from '../components/Agenda';
import type { Appointment } from '../types';

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
});
