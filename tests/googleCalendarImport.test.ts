import { describe, test, expect } from 'vitest';
import {
  parseDateTimeToSP,
  parseGoogleEventToCandidate,
  deduplicateCandidates,
} from '../api/google-calendar-import';

// ────────────────────────────────────────────────────────────────────────────
// parseDateTimeToSP
// ────────────────────────────────────────────────────────────────────────────

describe('parseDateTimeToSP', () => {
  test('parses datetime with SP offset (-03:00)', () => {
    const r = parseDateTimeToSP('2026-05-10T09:00:00-03:00');
    expect(r.date).toBe('2026-05-10');
    expect(r.time).toBe('09:00');
  });

  test('parses UTC datetime (UTC 12:00 = SP 09:00)', () => {
    const r = parseDateTimeToSP('2026-05-10T12:00:00Z');
    expect(r.date).toBe('2026-05-10');
    expect(r.time).toBe('09:00');
  });

  test('parses all-day event (date only)', () => {
    const r = parseDateTimeToSP('2026-05-10');
    expect(r.date).toBe('2026-05-10');
    expect(r.time).toBe('00:00');
  });

  test('returns empty strings for empty input', () => {
    const r = parseDateTimeToSP('');
    expect(r.date).toBe('');
    expect(r.time).toBe('');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// parseGoogleEventToCandidate
// ────────────────────────────────────────────────────────────────────────────

const SYSTEM_EVENT = {
  id: 'evt123',
  summary: 'Paciente Teste • Unimed',
  description: 'Paciente: Paciente Teste\nProfissional: Bruno Alexandre - CRP 181006',
  start: { dateTime: '2026-05-10T09:00:00-03:00' },
  end: { dateTime: '2026-05-10T09:50:00-03:00' },
  status: 'confirmed',
  htmlLink: 'https://calendar.google.com/event?eid=xxx',
  extendedProperties: {
    private: {
      app: 'cadastro-paciente',
      appointmentId: 'appt-abc',
      patientId: 'patient-xyz',
    },
  },
};

describe('parseGoogleEventToCandidate', () => {
  test('maps all fields correctly for a system event', () => {
    const c = parseGoogleEventToCandidate(SYSTEM_EVENT, 'cal@group.calendar.google.com', 'Bruno Alexandre - CRP 181006');
    expect(c.googleEventId).toBe('evt123');
    expect(c.calendarId).toBe('cal@group.calendar.google.com');
    expect(c.professionalName).toBe('Bruno Alexandre - CRP 181006');
    expect(c.summary).toBe('Paciente Teste • Unimed');
    expect(c.date).toBe('2026-05-10');
    expect(c.time).toBe('09:00');
    expect(c.durationMin).toBe(50);
    expect(c.googleStatus).toBe('confirmed');
    expect(c.htmlLink).toBe('https://calendar.google.com/event?eid=xxx');
    expect(c.hasAppointmentId).toBe(true);
    expect(c.appointmentId).toBe('appt-abc');
    expect(c.patientId).toBe('patient-xyz');
    expect(c.suggestedPatientName).toBe('Paciente Teste');
    expect(c.warnings).toHaveLength(0);
    expect(c.importSource).toBe('google');
    expect(c.isRecurring).toBe(false);
  });

  test('adds warning for external (non-system) events', () => {
    const ext = {
      id: 'ext1',
      summary: 'Reunião de trabalho',
      start: { dateTime: '2026-05-10T10:00:00-03:00' },
      end: { dateTime: '2026-05-10T11:00:00-03:00' },
      status: 'confirmed',
    };
    const c = parseGoogleEventToCandidate(ext, 'cal@id', 'Bruno');
    expect(c.warnings).toContain('Evento não criado pelo sistema (importação externa)');
    expect(c.hasAppointmentId).toBe(false);
    expect(c.suggestedPatientName).toBeUndefined();
  });

  test('identifies recurring event instances', () => {
    const rec = { ...SYSTEM_EVENT, id: 'rec_20260510', recurringEventId: 'rec123' };
    const c = parseGoogleEventToCandidate(rec, 'cal@id', 'Bruno');
    expect(c.isRecurring).toBe(true);
    expect(c.recurringEventId).toBe('rec123');
  });

  test('non-recurring event has no recurringEventId', () => {
    const c = parseGoogleEventToCandidate(SYSTEM_EVENT, 'cal@id', 'Bruno');
    expect(c.isRecurring).toBe(false);
    expect(c.recurringEventId).toBeUndefined();
  });

  test('calculates duration from start/end', () => {
    const evt = {
      ...SYSTEM_EVENT,
      start: { dateTime: '2026-05-10T08:00:00-03:00' },
      end: { dateTime: '2026-05-10T09:30:00-03:00' },
    };
    const c = parseGoogleEventToCandidate(evt, 'cal@id', 'Bruno');
    expect(c.durationMin).toBe(90);
  });

  test('does not suggest patient name for external events (no bullet separator)', () => {
    const ext = {
      id: 'ext2',
      summary: 'Sessão de terapia',
      start: { dateTime: '2026-05-10T10:00:00-03:00' },
      end: { dateTime: '2026-05-10T11:00:00-03:00' },
      status: 'confirmed',
    };
    const c = parseGoogleEventToCandidate(ext, 'cal@id', 'Bruno');
    expect(c.suggestedPatientName).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// deduplicateCandidates
// ────────────────────────────────────────────────────────────────────────────

describe('deduplicateCandidates', () => {
  const make = (eventId: string, calId: string) =>
    ({ googleEventId: eventId, calendarId: calId, warnings: [], importSource: 'google' as const }) as any;

  test('removes exact duplicates by calendarId+eventId key', () => {
    const result = deduplicateCandidates([make('e1', 'c1'), make('e1', 'c1'), make('e2', 'c1')]);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.googleEventId)).toEqual(['e1', 'e2']);
  });

  test('keeps events with same eventId but different calendarId', () => {
    const result = deduplicateCandidates([make('e1', 'c1'), make('e1', 'c2')]);
    expect(result).toHaveLength(2);
  });

  test('returns empty array for empty input', () => {
    expect(deduplicateCandidates([])).toEqual([]);
  });

  test('preserves order of first occurrence', () => {
    const result = deduplicateCandidates([make('e3', 'c1'), make('e1', 'c1'), make('e3', 'c1')]);
    expect(result.map(r => r.googleEventId)).toEqual(['e3', 'e1']);
  });
});
