import type { Appointment } from '../types';

export const ROLLING_RECURRENCE_MONTHS_AHEAD = 12;

export type RecurrenceKind = NonNullable<Appointment['recurrence']>;

const toLocalDate = (isoDate: string): Date => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const toISODate = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const addMonthsISO = (isoDate: string, months: number): string => {
  const date = toLocalDate(isoDate);
  date.setMonth(date.getMonth() + months);
  return toISODate(date);
};

const addInterval = (isoDate: string, recurrence: Exclude<RecurrenceKind, 'none'>): string => {
  const date = toLocalDate(isoDate);
  if (recurrence === 'weekly') date.setDate(date.getDate() + 7);
  else if (recurrence === 'biweekly') date.setDate(date.getDate() + 14);
  else date.setMonth(date.getMonth() + 1);
  return toISODate(date);
};

const defaultOccurrenceCount = (recurrence: Exclude<RecurrenceKind, 'none'>): number => (
  recurrence === 'weekly' ? 24 : 12
);

export const buildRecurringAppointmentDates = (
  startDate: string,
  recurrence: RecurrenceKind | undefined,
  options: {
    endDate?: string;
    openEnded?: boolean;
    windowStartDate?: string;
    monthsAhead?: number;
    maxOccurrences?: number;
  } = {},
): string[] => {
  if (!recurrence || recurrence === 'none') return [startDate];

  const maxOccurrences = options.maxOccurrences ?? 160;
  const dates: string[] = [];
  const targetEndDate = options.openEnded
    ? addMonthsISO(options.windowStartDate || startDate, options.monthsAhead ?? ROLLING_RECURRENCE_MONTHS_AHEAD)
    : options.endDate;

  if (!targetEndDate) {
    const count = Math.min(defaultOccurrenceCount(recurrence), maxOccurrences);
    let current = startDate;
    for (let i = 0; i < count; i++) {
      dates.push(current);
      current = addInterval(current, recurrence);
    }
    return dates;
  }

  if (targetEndDate < startDate) return [startDate];

  let current = startDate;
  while (current <= targetEndDate && dates.length < maxOccurrences) {
    dates.push(current);
    current = addInterval(current, recurrence);
  }

  return dates;
};

const buildGeneratedId = (seriesId: string, date: string, time: string): string => (
  `${seriesId}-${date}-${time}`.replace(/[^a-zA-Z0-9_-]/g, '-')
);

export const buildOpenEndedRecurrenceExtensions = (
  appointments: Appointment[],
  options: {
    today?: string;
    monthsAhead?: number;
  } = {},
): Appointment[] => {
  const today = options.today || toISODate(new Date());
  const groups = new Map<string, Appointment[]>();

  appointments.forEach(appt => {
    if (!appt.seriesId || !appt.recurrenceOpenEnded || !appt.recurrence || appt.recurrence === 'none') return;
    groups.set(appt.seriesId, [...(groups.get(appt.seriesId) || []), appt]);
  });

  const extensions: Appointment[] = [];

  groups.forEach(seriesAppointments => {
    const sorted = [...seriesAppointments].sort((a, b) => (a.date + 'T' + a.time).localeCompare(b.date + 'T' + b.time));
    const anchor = sorted.find(appt => appt.isSeriesMaster) || sorted[0];
    if (!anchor?.seriesId || !anchor.recurrence || anchor.recurrence === 'none') return;

    const latest = sorted[sorted.length - 1];
    const existingDateTime = new Set(sorted.map(appt => `${appt.date}T${appt.time}`));
    const latestDateTime = `${latest.date}T${latest.time}`;
    const targetDates = buildRecurringAppointmentDates(anchor.date, anchor.recurrence, {
      openEnded: true,
      windowStartDate: today,
      monthsAhead: options.monthsAhead ?? ROLLING_RECURRENCE_MONTHS_AHEAD,
    });
    const generatedWindowEndDate = targetDates[targetDates.length - 1] || latest.date;

    targetDates
      .filter(date => `${date}T${anchor.time}` > latestDateTime)
      .filter(date => !existingDateTime.has(`${date}T${anchor.time}`))
      .forEach(date => {
        const recurrenceIndex = Math.max(0, ...sorted.map(appt => appt.recurrenceIndex ?? 0), ...extensions.filter(appt => appt.seriesId === anchor.seriesId).map(appt => appt.recurrenceIndex ?? 0)) + 1;
        extensions.push({
          ...latest,
          id: buildGeneratedId(anchor.seriesId!, date, anchor.time),
          date,
          time: anchor.time,
          status: 'Agendado',
          recurrence: anchor.recurrence,
          recurrenceOpenEnded: true,
          recurrenceEndDate: generatedWindowEndDate,
          recurrenceIndex,
          isSeriesMaster: false,
          googleEventId: anchor.googleEventId || latest.googleEventId,
          googleCalendarHtmlLink: anchor.googleCalendarHtmlLink || latest.googleCalendarHtmlLink,
        });
      });
  });

  return extensions;
};
