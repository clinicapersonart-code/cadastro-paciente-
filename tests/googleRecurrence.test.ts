import * as assert from 'node:assert/strict';
import { buildGoogleRecurrenceRule, buildSeriesId, isRecurringAppointment } from '../utils/googleRecurrence';
import type { Appointment } from '../types';

const weekly = buildGoogleRecurrenceRule('weekly', '2026-05-05', '2026-06-30');
assert.equal(weekly, 'RRULE:FREQ=WEEKLY;INTERVAL=1;UNTIL=20260630T235959Z');

const biweekly = buildGoogleRecurrenceRule('biweekly', '2026-05-05', '2026-06-30');
assert.equal(biweekly, 'RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=20260630T235959Z');

const monthly = buildGoogleRecurrenceRule('monthly', '2026-05-05', '2026-12-31');
assert.equal(monthly, 'RRULE:FREQ=MONTHLY;INTERVAL=1;UNTIL=20261231T235959Z');

const appointment: Appointment = {
  id: 'appt-1',
  patientId: 'patient-1',
  patientName: 'Paciente Teste',
  profissional: 'Profissional Teste',
  date: '2026-05-05',
  time: '08:00',
  type: 'Convênio',
  status: 'Agendado',
  recurrence: 'weekly',
  recurrenceEndDate: '2026-06-30',
  seriesId: 'series-123',
};

assert.equal(isRecurringAppointment(appointment), true);
assert.equal(buildSeriesId(appointment.patientId, appointment.profissional, appointment.date, appointment.time).startsWith('series-'), true);

console.log('google recurrence helpers ok');
