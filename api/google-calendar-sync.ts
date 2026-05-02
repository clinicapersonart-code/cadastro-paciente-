import { JWT } from 'google-auth-library';

type Req = {
  method?: string;
  body?: any;
};

type Res = {
  status: (code: number) => Res;
  json: (body: any) => void;
  setHeader: (name: string, value: string) => void;
};

type SyncAction = 'upsert' | 'delete';

type AppointmentPayload = {
  id: string;
  patientId?: string;
  patientName: string;
  profissional?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMin?: number;
  type?: string;
  status?: string;
  convenioName?: string;
  professionalEmail?: string;
  obs?: string;
};

type SyncPayload = {
  action: SyncAction;
  appointment: AppointmentPayload;
  googleEventId?: string;
};

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

function parseServiceAccountJson() {
  const base64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  const plain = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  let raw = '';
  if (base64) {
    raw = Buffer.from(base64, 'base64').toString('utf-8');
  } else if (plain) {
    raw = plain;
  }

  if (!raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 (ou GOOGLE_SERVICE_ACCOUNT_JSON) não configurado.');
  }

  const parsed = JSON.parse(raw);
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('JSON da service account inválido: faltam client_email/private_key.');
  }

  return parsed as { client_email: string; private_key: string };
}

function validateDateTime(date: string, time: string) {
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const timeOk = /^\d{2}:\d{2}$/.test(time);
  if (!dateOk || !timeOk) {
    throw new Error('Data/hora inválida. Esperado date=YYYY-MM-DD e time=HH:mm.');
  }
}

function normalizeProfessionalName(name = '') {
  return name
    .split(' - ')[0]
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseCalendarMap() {
  const raw = process.env.GOOGLE_CALENDAR_IDS_BY_PROFESSIONAL;
  if (!raw) return {} as Record<string, string>;

  const parsed = JSON.parse(raw) as Record<string, string>;
  return Object.entries(parsed).reduce<Record<string, string>>((acc, [professional, calendarId]) => {
    const normalized = normalizeProfessionalName(professional);
    if (normalized && calendarId) acc[normalized] = calendarId.trim();
    return acc;
  }, {});
}

function resolveCalendarId(appointment: AppointmentPayload) {
  const fallbackCalendarId = process.env.GOOGLE_CALENDAR_ID?.trim();
  const calendarsByProfessional = parseCalendarMap();
  const professionalKey = normalizeProfessionalName(appointment.profissional);
  const professionalCalendarId = professionalKey ? calendarsByProfessional[professionalKey] : undefined;

  const calendarId = professionalCalendarId || fallbackCalendarId;
  if (!calendarId) {
    throw new Error(`Calendário Google não configurado para o profissional: ${appointment.profissional || 'não informado'}.`);
  }

  return calendarId;
}

function addMinutes(date: string, time: string, minutesToAdd: number) {
  const base = new Date(`${date}T${time}:00Z`);
  base.setUTCMinutes(base.getUTCMinutes() + minutesToAdd);
  const endDate = base.toISOString().slice(0, 10);
  const endTime = base.toISOString().slice(11, 16);
  return { endDate, endTime };
}

function normalizeEmail(email = '') {
  const trimmed = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : '';
}

async function getAccessToken() {
  const sa = parseServiceAccountJson();
  const auth = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: [CALENDAR_SCOPE],
  });

  const tokenResult = await auth.getAccessToken();
  const token = typeof tokenResult === 'string' ? tokenResult : tokenResult?.token;
  if (!token) throw new Error('Não foi possível obter access token do Google.');
  return token;
}

async function googleRequest(url: string, init: RequestInit & { accessToken: string }) {
  const { accessToken, ...rest } = init;

  const response = await fetch(url, {
    ...rest,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(rest.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Google Calendar API erro HTTP ${response.status}`;
    const err = new Error(errorMsg) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  return data;
}

function buildEventBody(appointment: AppointmentPayload) {
  validateDateTime(appointment.date, appointment.time);

  const durationMin = Number.isFinite(appointment.durationMin)
    ? Math.max(15, Number(appointment.durationMin))
    : 50;

  const { endDate, endTime } = addMinutes(appointment.date, appointment.time, durationMin);
  const calendarTimezone = process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Sao_Paulo';
  const professionalEmail = normalizeEmail(appointment.professionalEmail);

  const summary = `${appointment.patientName} • ${appointment.type || 'Sessão'}`;
  const description = [
    `Paciente: ${appointment.patientName}`,
    appointment.profissional ? `Profissional: ${appointment.profissional}` : null,
    appointment.convenioName ? `Convênio: ${appointment.convenioName}` : null,
    appointment.status ? `Status: ${appointment.status}` : null,
    appointment.obs ? `Obs: ${appointment.obs}` : null,
    `Origem: Cadastro Paciente (Personart)`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    summary,
    description,
    start: {
      dateTime: `${appointment.date}T${appointment.time}:00`,
      timeZone: calendarTimezone,
    },
    end: {
      dateTime: `${endDate}T${endTime}:00`,
      timeZone: calendarTimezone,
    },
    extendedProperties: {
      private: {
        app: 'cadastro-paciente',
        appointmentId: appointment.id,
        patientId: appointment.patientId || '',
      },
    },
    ...(professionalEmail ? { attendees: [{ email: professionalEmail }] } : {}),
  };
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const payload = req.body as SyncPayload;
    if (!payload?.action || !payload?.appointment?.id) {
      return res.status(400).json({ ok: false, error: 'Payload inválido.' });
    }

    const calendarId = resolveCalendarId(payload.appointment);
    const accessToken = await getAccessToken();
    const encodedCalendarId = encodeURIComponent(calendarId);

    if (payload.action === 'delete') {
      if (!payload.googleEventId) {
        return res.status(200).json({ ok: true, skipped: true, reason: 'sem googleEventId' });
      }

      const encodedEventId = encodeURIComponent(payload.googleEventId);
      const deleteUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events/${encodedEventId}?sendUpdates=all`;

      try {
        await googleRequest(deleteUrl, { method: 'DELETE', accessToken });
      } catch (error: any) {
        if (error?.status !== 404) throw error;
      }

      return res.status(200).json({ ok: true, deleted: true, eventId: payload.googleEventId });
    }

    const eventBody = buildEventBody(payload.appointment);
    const encodedEventId = payload.googleEventId ? encodeURIComponent(payload.googleEventId) : '';

    if (payload.googleEventId) {
      const patchUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events/${encodedEventId}?sendUpdates=all`;
      const patched = await googleRequest(patchUrl, {
        method: 'PATCH',
        body: JSON.stringify(eventBody),
        accessToken,
      });

      return res.status(200).json({ ok: true, action: 'updated', eventId: patched?.id, htmlLink: patched?.htmlLink });
    }

    const insertUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events?sendUpdates=all`;
    const inserted = await googleRequest(insertUrl, {
      method: 'POST',
      body: JSON.stringify(eventBody),
      accessToken,
    });

    return res.status(200).json({ ok: true, action: 'created', eventId: inserted?.id, htmlLink: inserted?.htmlLink });
  } catch (error: any) {
    console.error('Erro google-calendar-sync:', error);
    return res.status(500).json({ ok: false, error: error?.message || 'Falha inesperada ao sincronizar com Google Agenda.' });
  }
}
