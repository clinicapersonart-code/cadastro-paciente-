import type { Appointment } from '../types';

export type GoogleCalendarSyncResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  action?: 'created' | 'updated';
  deleted?: boolean;
  eventId?: string;
  htmlLink?: string;
  error?: string;
};

type GoogleCalendarSyncPayload = {
  action: 'upsert' | 'delete';
  appointment: Appointment;
  googleEventId?: string;
  deleteScope?: 'single' | 'all';
};

const isEnabled = () => {
  const raw = String(import.meta.env.VITE_GOOGLE_CALENDAR_SYNC_ENABLED ?? '').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
};

export const syncAppointmentToGoogle = async (
  payload: GoogleCalendarSyncPayload,
): Promise<GoogleCalendarSyncResult> => {
  if (!isEnabled()) {
    return { ok: true, skipped: true, reason: 'VITE_GOOGLE_CALENDAR_SYNC_ENABLED desativado' };
  }

  const response = await fetch('/api/google-calendar-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = (await response.json()) as GoogleCalendarSyncResult;
  if (!response.ok || !json.ok) {
    throw new Error(json?.error || `Falha de sincronização Google Calendar (HTTP ${response.status})`);
  }

  return json;
};
