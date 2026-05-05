import type { Appointment } from '../types';

export type AppointmentRecurrence = NonNullable<Appointment['recurrence']>;

const INTERVAL_BY_RECURRENCE: Record<Exclude<AppointmentRecurrence, 'none'>, { freq: 'WEEKLY' | 'MONTHLY'; interval: number }> = {
  weekly: { freq: 'WEEKLY', interval: 1 },
  biweekly: { freq: 'WEEKLY', interval: 2 },
  monthly: { freq: 'MONTHLY', interval: 1 },
};

const normalizeDateForUntil = (date: string): string => {
  const compact = (date || '').replace(/-/g, '');
  if (!/^\d{8}$/.test(compact)) throw new Error('Data final de recorrência inválida.');
  return `${compact}T235959Z`;
};

const slug = (value: string): string => (value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 48);

export const buildGoogleRecurrenceRule = (
  recurrence: AppointmentRecurrence | undefined,
  _startDate: string,
  endDate?: string,
): string | undefined => {
  if (!recurrence || recurrence === 'none') return undefined;
  if (!endDate) throw new Error('Informe a data final da recorrência para sincronizar com o Google Agenda.');

  const config = INTERVAL_BY_RECURRENCE[recurrence];
  return `RRULE:FREQ=${config.freq};INTERVAL=${config.interval};UNTIL=${normalizeDateForUntil(endDate)}`;
};

export const isRecurringAppointment = (appointment: Pick<Appointment, 'recurrence' | 'seriesId'>): boolean => (
  Boolean(appointment.seriesId) && Boolean(appointment.recurrence && appointment.recurrence !== 'none')
);

export const buildSeriesId = (patientId: string, profissional: string, date: string, time: string): string => (
  `series-${slug(patientId)}-${slug(profissional.split(' - ')[0] || profissional)}-${date}-${time.replace(':', '')}-${Date.now().toString(36)}`
);
