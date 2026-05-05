import type { ScheduleChangeRequest } from '../types';

export interface ScheduleChangeRequestGroup {
  id: string;
  requestIds: string[];
  requests: ScheduleChangeRequest[];
  firstRequest: ScheduleChangeRequest;
  occurrenceCount: number;
  firstDate?: string;
  lastDate?: string;
}

const normalizeText = (value?: string): string => (value || '').trim().toLowerCase();

const timestampMinuteKey = (timestamp?: string): string => {
  if (!timestamp) return '';
  const parsed = new Date(timestamp);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 16);
  return timestamp.slice(0, 16);
};

const requestSortKey = (request: ScheduleChangeRequest): string => {
  const appt = request.oldData;
  return `${appt?.date || ''}T${appt?.time || ''}:${request.timestamp || ''}:${request.id}`;
};

const buildGroupKey = (request: ScheduleChangeRequest): string => {
  const oldData = request.oldData;
  const newData = request.newData;
  const patientKey = oldData?.patientId || normalizeText(oldData?.patientName) || request.appointmentId;

  return [
    request.type,
    request.requestedBy,
    patientKey,
    timestampMinuteKey(request.timestamp),
    normalizeText(oldData?.profissional),
    normalizeText(newData?.profissional),
    newData?.time || '',
    request.status
  ].join('|');
};

export const groupPendingScheduleChangeRequests = (requests: ScheduleChangeRequest[]): ScheduleChangeRequestGroup[] => {
  const grouped = new Map<string, ScheduleChangeRequest[]>();

  requests
    .filter(request => request.status === 'PENDING')
    .forEach(request => {
      const key = buildGroupKey(request);
      grouped.set(key, [...(grouped.get(key) || []), request]);
    });

  return Array.from(grouped.entries())
    .map(([key, groupRequests]) => {
      const sorted = [...groupRequests].sort((a, b) => requestSortKey(a).localeCompare(requestSortKey(b)));
      const dates = sorted
        .map(request => request.oldData?.date)
        .filter((date): date is string => Boolean(date))
        .sort();

      return {
        id: key,
        requestIds: sorted.map(request => request.id),
        requests: sorted,
        firstRequest: sorted[0],
        occurrenceCount: sorted.length,
        firstDate: dates[0],
        lastDate: dates[dates.length - 1]
      };
    })
    .sort((a, b) => {
      if (b.occurrenceCount !== a.occurrenceCount) return b.occurrenceCount - a.occurrenceCount;
      return (b.firstRequest.timestamp || '').localeCompare(a.firstRequest.timestamp || '');
    });
};

export const formatScheduleDate = (date?: string): string => {
  if (!date) return '';
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
};
