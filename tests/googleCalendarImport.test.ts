import { describe, test, expect } from 'vitest';
import {
  parseDateTimeToSP,
  parseGoogleEventToCandidate,
  deduplicateCandidates,
} from '../api/google-calendar-import';
import {
  detectRecurrencePattern,
  groupImportCandidates,
} from '../utils/googleCalendarGrouping';
import type { ImportCandidate } from '../api/google-calendar-import';

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

// ────────────────────────────────────────────────────────────────────────────
// detectRecurrencePattern
// ────────────────────────────────────────────────────────────────────────────

describe('detectRecurrencePattern', () => {
  test('dates 7 days apart → weekly', () => {
    expect(detectRecurrencePattern(['2026-05-04', '2026-05-11', '2026-05-18'])).toBe('weekly');
  });

  test('dates 14 days apart → biweekly', () => {
    expect(detectRecurrencePattern(['2026-05-04', '2026-05-18', '2026-06-01'])).toBe('biweekly');
  });

  test('dates ~30 days apart → monthly', () => {
    expect(detectRecurrencePattern(['2026-05-04', '2026-06-04', '2026-07-04'])).toBe('monthly');
    // 28-day months also qualify
    expect(detectRecurrencePattern(['2026-01-31', '2026-02-28'])).toBe('monthly');
  });

  test('mixed intervals → none', () => {
    expect(detectRecurrencePattern(['2026-05-04', '2026-05-11', '2026-05-20'])).toBe('none');
  });

  test('single date → none', () => {
    expect(detectRecurrencePattern(['2026-05-04'])).toBe('none');
  });

  test('empty array → none', () => {
    expect(detectRecurrencePattern([])).toBe('none');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// groupImportCandidates
// ────────────────────────────────────────────────────────────────────────────

const makeCandidate = (overrides: Partial<ImportCandidate>): ImportCandidate => ({
  googleEventId: 'evt-default',
  calendarId: 'cal1',
  professionalName: 'Dr. Teste',
  summary: 'Paciente X • Unimed',
  startDateTime: '',
  endDateTime: '',
  date: '2026-05-04',
  time: '09:00',
  durationMin: 50,
  googleStatus: 'confirmed',
  isRecurring: false,
  hasAppointmentId: false,
  warnings: [],
  importSource: 'google',
  ...overrides,
});

describe('groupImportCandidates', () => {
  test('candidates without recurringEventId remain individual', () => {
    const candidates = [
      makeCandidate({ googleEventId: 'a', date: '2026-05-04' }),
      makeCandidate({ googleEventId: 'b', date: '2026-05-11' }),
    ];
    const groups = groupImportCandidates(candidates);
    expect(groups).toHaveLength(2);
    expect(groups.every(g => g.type === 'individual')).toBe(true);
  });

  test('three candidates with same recurringEventId form a series group', () => {
    const candidates = [
      makeCandidate({ googleEventId: 'r_1', recurringEventId: 'rec123', isRecurring: true, date: '2026-05-04' }),
      makeCandidate({ googleEventId: 'r_2', recurringEventId: 'rec123', isRecurring: true, date: '2026-05-11' }),
      makeCandidate({ googleEventId: 'r_3', recurringEventId: 'rec123', isRecurring: true, date: '2026-05-18' }),
    ];
    const groups = groupImportCandidates(candidates);
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe('series');
    if (groups[0].type === 'series') {
      expect(groups[0].candidates).toHaveLength(3);
      expect(groups[0].recurringEventId).toBe('rec123');
      expect(groups[0].detectedRecurrence).toBe('weekly');
    }
  });

  test('series with only 1 occurrence in range becomes individual', () => {
    const candidates = [
      makeCandidate({ googleEventId: 'r_1', recurringEventId: 'rec456', isRecurring: true, date: '2026-05-04' }),
    ];
    const groups = groupImportCandidates(candidates);
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe('individual');
  });

  test('candidates from different calendarIds with same recurringEventId form separate groups', () => {
    const candidates = [
      makeCandidate({ googleEventId: 'r_1', calendarId: 'cal1', recurringEventId: 'recX', date: '2026-05-04' }),
      makeCandidate({ googleEventId: 'r_2', calendarId: 'cal1', recurringEventId: 'recX', date: '2026-05-11' }),
      makeCandidate({ googleEventId: 'r_3', calendarId: 'cal2', recurringEventId: 'recX', date: '2026-05-04' }),
      makeCandidate({ googleEventId: 'r_4', calendarId: 'cal2', recurringEventId: 'recX', date: '2026-05-11' }),
    ];
    const groups = groupImportCandidates(candidates);
    expect(groups).toHaveLength(2);
    expect(groups.every(g => g.type === 'series')).toBe(true);
  });

  test('mixed: series + individual candidates coexist', () => {
    const candidates = [
      makeCandidate({ googleEventId: 'ind1', date: '2026-05-01' }),
      makeCandidate({ googleEventId: 'r_1', recurringEventId: 'recABC', isRecurring: true, date: '2026-05-04' }),
      makeCandidate({ googleEventId: 'r_2', recurringEventId: 'recABC', isRecurring: true, date: '2026-05-11' }),
    ];
    const groups = groupImportCandidates(candidates);
    expect(groups).toHaveLength(2);
    const seriesGroup = groups.find(g => g.type === 'series');
    const individualGroup = groups.find(g => g.type === 'individual');
    expect(seriesGroup).toBeDefined();
    expect(individualGroup).toBeDefined();
  });

  test('series candidates are sorted by date ascending', () => {
    const candidates = [
      makeCandidate({ googleEventId: 'r_3', recurringEventId: 'recZ', date: '2026-05-18' }),
      makeCandidate({ googleEventId: 'r_1', recurringEventId: 'recZ', date: '2026-05-04' }),
      makeCandidate({ googleEventId: 'r_2', recurringEventId: 'recZ', date: '2026-05-11' }),
    ];
    const groups = groupImportCandidates(candidates);
    expect(groups[0].type).toBe('series');
    if (groups[0].type === 'series') {
      expect(groups[0].candidates.map(c => c.date)).toEqual(['2026-05-04', '2026-05-11', '2026-05-18']);
    }
  });

  test('biweekly series detected correctly', () => {
    const candidates = [
      makeCandidate({ googleEventId: 'r_1', recurringEventId: 'recBi', date: '2026-05-04' }),
      makeCandidate({ googleEventId: 'r_2', recurringEventId: 'recBi', date: '2026-05-18' }),
      makeCandidate({ googleEventId: 'r_3', recurringEventId: 'recBi', date: '2026-06-01' }),
    ];
    const groups = groupImportCandidates(candidates);
    expect(groups[0].type).toBe('series');
    if (groups[0].type === 'series') {
      expect(groups[0].detectedRecurrence).toBe('biweekly');
    }
  });

  test('irregular recurring candidates remain individual for manual review', () => {
    const candidates = [
      makeCandidate({ googleEventId: 'r_1', recurringEventId: 'recIrregular', isRecurring: true, date: '2026-05-04' }),
      makeCandidate({ googleEventId: 'r_2', recurringEventId: 'recIrregular', isRecurring: true, date: '2026-05-11' }),
      makeCandidate({ googleEventId: 'r_3', recurringEventId: 'recIrregular', isRecurring: true, date: '2026-05-20' }),
    ];
    const groups = groupImportCandidates(candidates);
    expect(groups).toHaveLength(3);
    expect(groups.every(g => g.type === 'individual')).toBe(true);
  });

  test('empty candidates array returns empty groups', () => {
    expect(groupImportCandidates([])).toEqual([]);
  });
});
