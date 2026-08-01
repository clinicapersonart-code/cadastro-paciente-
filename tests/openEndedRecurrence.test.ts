import { describe, expect, test } from 'vitest';
import type { Appointment } from '../types';
import {
  buildOpenEndedRecurrenceExtensions,
  buildRecurringAppointmentDates,
} from '../utils/openEndedRecurrence';
import { buildGoogleRecurrenceRule } from '../utils/googleRecurrence';
import { buildEventBody } from '../api/google-calendar-sync';

const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'appt-1',
  patientId: 'patient-1',
  patientName: 'Paciente Teste',
  profissional: 'Bruno Alexandre',
  date: '2026-08-03',
  time: '08:00',
  type: 'Particular',
  status: 'Agendado',
  durationMin: 45,
  seriesId: 'series-open',
  recurrence: 'weekly',
  recurrenceOpenEnded: true,
  recurrenceIndex: 0,
  isSeriesMaster: true,
  googleEventId: 'google-master',
  ...overrides,
});

describe('open-ended recurring appointments', () => {
  test('creates only a rolling 12-month local window for weekly open-ended series', () => {
    const dates = buildRecurringAppointmentDates('2026-08-03', 'weekly', {
      openEnded: true,
      windowStartDate: '2026-08-03',
      monthsAhead: 12,
    });

    expect(dates[0]).toBe('2026-08-03');
    expect(dates.at(-1)).toBe('2027-08-02');
    expect(dates.every(date => date <= '2027-08-03')).toBe(true);
    expect(dates).toHaveLength(53);
  });

  test('extends open-ended series without duplicating existing local occurrences', () => {
    const existing = [
      makeAppointment({ id: 'appt-1', date: '2026-08-03', recurrenceIndex: 0, isSeriesMaster: true }),
      makeAppointment({ id: 'appt-2', date: '2026-08-10', recurrenceIndex: 1, isSeriesMaster: false }),
    ];

    const extensions = buildOpenEndedRecurrenceExtensions(existing, {
      today: '2026-08-01',
      monthsAhead: 12,
    });

    expect(extensions[0]).toMatchObject({
      date: '2026-08-17',
      recurrenceIndex: 2,
      recurrenceOpenEnded: true,
      isSeriesMaster: false,
      googleEventId: 'google-master',
    });
    expect(extensions.some(appt => appt.date === '2026-08-03')).toBe(false);
    expect(extensions.at(-1)?.date).toBe('2027-07-26');
  });

  test('uses native Google recurrence without UNTIL for open-ended series', () => {
    expect(buildGoogleRecurrenceRule('weekly', '2026-08-03', undefined, true)).toBe('RRULE:FREQ=WEEKLY;INTERVAL=1');

    const body = buildEventBody(makeAppointment({ recurrenceEndDate: '2027-07-26' }));
    expect(body.recurrence).toEqual(['RRULE:FREQ=WEEKLY;INTERVAL=1']);
  });
});
