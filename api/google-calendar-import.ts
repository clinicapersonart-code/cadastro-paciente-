import { JWT } from 'google-auth-library';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ImportCandidate {
  googleEventId: string;
  calendarId: string;
  professionalName: string;
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  date: string;     // YYYY-MM-DD no fuso SP
  time: string;     // HH:mm no fuso SP
  durationMin: number;
  googleStatus: string;
  htmlLink?: string;
  isRecurring: boolean;
  recurringEventId?: string;
  hasAppointmentId: boolean;
  appointmentId?: string;
  patientId?: string;
  suggestedPatientName?: string;
  warnings: string[];
  importSource: 'google';
}

// ─── Pure functions (exported for tests) ─────────────────────────────────────

/**
 * Converte um dateTime do Google (com offset ou UTC) para date/time no fuso
 * America/Sao_Paulo (UTC-3, sem horário de verão desde 2019).
 */
export function parseDateTimeToSP(dateTimeStr: string): { date: string; time: string } {
  if (!dateTimeStr) return { date: '', time: '' };

  // Evento de dia inteiro (apenas YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTimeStr)) {
    return { date: dateTimeStr, time: '00:00' };
  }

  const d = new Date(dateTimeStr);
  if (isNaN(d.getTime())) return { date: '', time: '' };

  // SP = UTC-3: subtrair 3 h do UTC para obter a hora local SP
  const spMs = d.getTime() - 3 * 60 * 60 * 1000;
  const iso = new Date(spMs).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

export function parseGoogleEventToCandidate(
  event: any,
  calendarId: string,
  professionalName: string,
): ImportCandidate {
  const startDt: string = event.start?.dateTime || event.start?.date || '';
  const endDt: string = event.end?.dateTime || event.end?.date || '';

  const { date, time } = parseDateTimeToSP(startDt);

  const startMs = startDt ? new Date(startDt).getTime() : 0;
  const endMs = endDt ? new Date(endDt).getTime() : 0;
  const durationMin = startMs && endMs ? Math.round((endMs - startMs) / 60000) : 0;

  const priv = event.extendedProperties?.private ?? {};
  const isSystemEvent = priv.app === 'cadastro-paciente';
  const appointmentId: string | undefined = priv.appointmentId || undefined;
  const patientId: string | undefined = priv.patientId || undefined;

  const warnings: string[] = [];
  if (!isSystemEvent) {
    warnings.push('Evento não criado pelo sistema (importação externa)');
  }
  if (event.status === 'cancelled') {
    warnings.push('Evento cancelado no Google');
  }
  if (durationMin > 0 && (durationMin < 10 || durationMin > 480)) {
    warnings.push(`Duração incomum: ${durationMin} min`);
  }

  // Formato criado pelo sistema: "NomePaciente • ConvênioOuTipo"
  const parts = (event.summary as string || '').split(' • ');
  const suggestedPatientName =
    isSystemEvent && parts.length >= 2 ? parts[0].trim() : undefined;

  return {
    googleEventId: event.id as string,
    calendarId,
    professionalName,
    summary: event.summary ?? '',
    description: event.description,
    startDateTime: startDt,
    endDateTime: endDt,
    date,
    time,
    durationMin,
    googleStatus: event.status ?? 'confirmed',
    htmlLink: event.htmlLink,
    isRecurring: Boolean(event.recurringEventId),
    recurringEventId: event.recurringEventId,
    hasAppointmentId: Boolean(appointmentId),
    appointmentId,
    patientId,
    suggestedPatientName,
    warnings,
    importSource: 'google',
  };
}

export function deduplicateCandidates(candidates: ImportCandidate[]): ImportCandidate[] {
  const seen = new Set<string>();
  return candidates.filter(c => {
    const key = `${c.calendarId}::${c.googleEventId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Helpers internos (sem import local para segurança Vercel ESM) ────────────

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

function parseServiceAccountJson() {
  const base64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  const plain = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  let raw = '';
  if (base64) raw = Buffer.from(base64, 'base64').toString('utf-8');
  else if (plain) raw = plain;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 não configurado.');
  const parsed = JSON.parse(raw) as { client_email?: string; private_key?: string };
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('JSON da service account inválido: faltam client_email/private_key.');
  }
  return parsed as { client_email: string; private_key: string };
}

function normalizeProfessionalName(name = '') {
  return name
    .split(' - ')[0]
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseCalendarMap(): Record<string, { calendarId: string; originalName: string }> {
  const raw = process.env.GOOGLE_CALENDAR_IDS_BY_PROFESSIONAL;
  if (!raw) return {};
  const parsed = JSON.parse(raw) as Record<string, string>;
  return Object.entries(parsed).reduce<Record<string, { calendarId: string; originalName: string }>>(
    (acc, [name, calId]) => {
      const key = normalizeProfessionalName(name);
      if (key && calId) acc[key] = { calendarId: calId.trim(), originalName: name.trim() };
      return acc;
    },
    {},
  );
}

async function getAccessToken() {
  const sa = parseServiceAccountJson();
  const auth = new JWT({ email: sa.client_email, key: sa.private_key, scopes: [CALENDAR_SCOPE] });
  const result = await auth.getAccessToken();
  const token = typeof result === 'string' ? result : result?.token;
  if (!token) throw new Error('Não foi possível obter access token do Google.');
  return token;
}

async function googleGet(url: string, accessToken: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.error?.message ?? `Google Calendar API HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return data;
}

async function listEventsForCalendar(
  calendarId: string,
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<any[]> {
  const enc = encodeURIComponent(calendarId);
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',   // expande instâncias recorrentes
    showDeleted: 'false',
    maxResults: '250',
    orderBy: 'startTime',
  });
  const url = `https://www.googleapis.com/calendar/v3/calendars/${enc}/events?${params}`;
  const data = await googleGet(url, accessToken);
  return Array.isArray(data?.items) ? data.items : [];
}

// ─── Vercel/Next handler ──────────────────────────────────────────────────────

type Req = { method?: string; query?: Record<string, string | string[]> };
type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

export default async function handler(req: Req, res: Res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const query = req.query ?? {};
    const pick = (k: string) => (Array.isArray(query[k]) ? query[k][0] : query[k]) as string | undefined;

    const now = new Date();
    const defaultMax = new Date(now);
    defaultMax.setDate(defaultMax.getDate() + 30);

    const timeMin = pick('timeMin') || now.toISOString();
    const timeMax = pick('timeMax') || defaultMax.toISOString();

    const calendarMap = parseCalendarMap();
    const fallbackCalendarId = process.env.GOOGLE_CALENDAR_ID?.trim();

    // Monta lista de { calendarId, professionalName } sem duplicar
    const entries: Array<{ calendarId: string; professionalName: string }> = [];
    const seenCalIds = new Set<string>();

    for (const [, { calendarId, originalName }] of Object.entries(calendarMap)) {
      if (!seenCalIds.has(calendarId)) {
        seenCalIds.add(calendarId);
        entries.push({ calendarId, professionalName: originalName });
      }
    }

    if (fallbackCalendarId && !seenCalIds.has(fallbackCalendarId)) {
      entries.push({ calendarId: fallbackCalendarId, professionalName: 'Geral' });
    }

    if (entries.length === 0) {
      return res.status(200).json({ ok: true, candidates: [] });
    }

    const accessToken = await getAccessToken();

    const results = await Promise.all(
      entries.map(async ({ calendarId, professionalName }) => {
        try {
          const events = await listEventsForCalendar(calendarId, accessToken, timeMin, timeMax);
          return events
            .filter(e => e.start?.dateTime) // ignora eventos de dia inteiro sem hora
            .map(e => parseGoogleEventToCandidate(e, calendarId, professionalName));
        } catch (err: any) {
          // calendário inacessível: retorna lista vazia para não travar todos
          console.error(`Erro ao listar calendário ${calendarId}:`, err?.message);
          return [];
        }
      }),
    );

    const candidates = deduplicateCandidates(results.flat());
    return res.status(200).json({ ok: true, candidates });
  } catch (error: any) {
    console.error('Erro google-calendar-import:', error?.message);
    return res.status(500).json({ ok: false, error: error?.message ?? 'Falha inesperada.' });
  }
}
