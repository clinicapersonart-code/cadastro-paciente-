import { describe, expect, test } from 'vitest';
import {
  formatAppointmentWeekday,
  formatRecurringWeekdayPhrase,
  getEffectiveAppointmentRecurrence,
  hasScheduleDayOrTimeChanged,
  isRecurringAppointment,
  preserveRecurrenceMetadata,
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
});
