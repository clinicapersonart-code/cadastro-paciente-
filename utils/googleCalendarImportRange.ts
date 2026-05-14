export type GoogleImportViewMode = 'day' | 'week' | 'month';

export const GOOGLE_IMPORT_MONTHS_AHEAD = 6;
const GOOGLE_CALENDAR_TIMEZONE_OFFSET = '-03:00';

const pad2 = (value: number) => String(value).padStart(2, '0');

const formatLocalDateISO = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const parseLocalDate = (dateISO: string): Date => {
  const [year, month, day] = dateISO.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
};

const addCalendarMonths = (date: Date, months: number): Date => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const targetFirstDay = new Date(year, month + months, 1);
  const lastDayOfTargetMonth = new Date(
    targetFirstDay.getFullYear(),
    targetFirstDay.getMonth() + 1,
    0,
  ).getDate();

  targetFirstDay.setDate(Math.min(day, lastDayOfTargetMonth));
  return targetFirstDay;
};

export const getGoogleImportRange = (
  selectedDate: string,
  viewMode: GoogleImportViewMode,
) => {
  const base = parseLocalDate(selectedDate);
  let start = new Date(base);

  if (viewMode === 'week') {
    start = getWeekStart(base);
  } else if (viewMode === 'month') {
    start.setDate(1);
  }

  const end = addCalendarMonths(start, GOOGLE_IMPORT_MONTHS_AHEAD);

  return {
    timeMin: `${formatLocalDateISO(start)}T00:00:00${GOOGLE_CALENDAR_TIMEZONE_OFFSET}`,
    timeMax: `${formatLocalDateISO(end)}T23:59:59${GOOGLE_CALENDAR_TIMEZONE_OFFSET}`,
  };
};
