import type { Appointment, Patient, PreCadastro } from '../types';
import { buildSeriesId } from './googleRecurrence';

export type InitialAppointmentInput = {
  date: string;
  time: string;
  professional: string;
  recurrence?: string;
  type: 'Convênio' | 'Particular';
};

const recurrenceMap: Record<string, NonNullable<Appointment['recurrence']>> = {
  none: 'none',
  weekly: 'weekly',
  biweekly: 'biweekly',
  monthly: 'monthly',
  Semanal: 'weekly',
  Quinzenal: 'biweekly',
  Mensal: 'monthly',
};

const weekdayMap: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  'segunda-feira': 1,
  terca: 2,
  terça: 2,
  'terca-feira': 2,
  'terça-feira': 2,
  quarta: 3,
  'quarta-feira': 3,
  quinta: 4,
  'quinta-feira': 4,
  sexta: 5,
  'sexta-feira': 5,
  sabado: 6,
  sábado: 6,
};

const toISODate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const normalizeText = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

export const getNextDateForWeekday = (weekday: string, fromDate = new Date(), time?: string): string | undefined => {
  const requested = weekdayMap[normalizeText(weekday)];
  if (requested === undefined) return undefined;

  const base = new Date(fromDate);
  base.setSeconds(0, 0);
  const target = new Date(base);
  target.setHours(12, 0, 0, 0);
  let diff = (requested - target.getDay() + 7) % 7;

  if (diff === 0 && /^\d{2}:\d{2}$/.test(time || '')) {
    const [hour, minute] = time!.split(':').map(Number);
    const targetMinutes = hour * 60 + minute;
    const currentMinutes = base.getHours() * 60 + base.getMinutes();
    if (targetMinutes <= currentMinutes) diff = 7;
  }

  target.setDate(target.getDate() + diff);
  return toISODate(target);
};

export const normalizeInitialRecurrence = (value?: string): NonNullable<Appointment['recurrence']> => (
  value ? (recurrenceMap[value] || recurrenceMap[normalizeText(value)] || 'none') : 'none'
);

const initialRecurrenceCount = (recurrence: NonNullable<Appointment['recurrence']>): number => {
  if (recurrence === 'weekly') return 4;
  if (recurrence === 'biweekly') return 2;
  if (recurrence === 'monthly') return 6;
  return 1;
};

export const preCadastroToInitialAppointment = (
  item: PreCadastro,
  fromDate = new Date(),
): InitialAppointmentInput | undefined => {
  const agendamento = item.agendamento as (PreCadastro['agendamento'] & { dia?: string }) | undefined;
  if (!agendamento?.hora || !item.profissional) return undefined;

  const date = agendamento.data || (agendamento.dia ? getNextDateForWeekday(agendamento.dia, fromDate, agendamento.hora) : undefined);
  if (!date) return undefined;

  return {
    date,
    time: agendamento.hora,
    professional: item.profissional,
    recurrence: normalizeInitialRecurrence(agendamento.frequencia),
    type: item.convenio ? 'Convênio' : 'Particular',
  };
};

export const buildInitialAppointmentsForPatient = (
  patient: Patient,
  initialAppointment?: InitialAppointmentInput,
): Appointment[] => {
  if (!initialAppointment?.date || !initialAppointment.time || !initialAppointment.professional) return [];

  const recurrence = normalizeInitialRecurrence(initialAppointment.recurrence);
  const totalToCreate = initialRecurrenceCount(recurrence);
  const [y, m, d] = initialAppointment.date.split('-').map(Number);
  const currentDate = new Date(y, m - 1, d);
  const seriesId = recurrence !== 'none'
    ? buildSeriesId(patient.id, initialAppointment.professional, initialAppointment.date, initialAppointment.time)
    : undefined;

  const appointments: Appointment[] = [];
  for (let i = 0; i < totalToCreate; i++) {
    const date = toISODate(currentDate);
    appointments.push({
      id: crypto.randomUUID(),
      patientId: patient.id,
      patientName: patient.nome,
      carteirinha: patient.carteirinha,
      patientResponsavel: patient.responsavel,
      patientContato: patient.contato,
      patientFaixa: patient.faixa,
      patientNascimento: patient.nascimento,
      numero_autorizacao: patient.funservConfig?.numeroAutorizacao || patient.numero_autorizacao || '',
      data_autorizacao: patient.funservConfig?.dataAutorizacao || patient.data_autorizacao || undefined,
      profissional: initialAppointment.professional,
      date,
      time: initialAppointment.time,
      type: initialAppointment.type,
      status: 'Agendado',
      convenioName: patient.convenio,
      obs: i > 0 ? `Agendamento Inicial — Sessão ${i + 1}` : 'Agendamento Inicial',
      seriesId,
      recurrence: recurrence !== 'none' ? recurrence : undefined,
      recurrenceIndex: recurrence !== 'none' ? i : undefined,
      isSeriesMaster: recurrence !== 'none' ? i === 0 : undefined,
    });

    if (recurrence === 'monthly') currentDate.setMonth(currentDate.getMonth() + 1);
    else if (recurrence === 'biweekly') currentDate.setDate(currentDate.getDate() + 14);
    else if (recurrence === 'weekly') currentDate.setDate(currentDate.getDate() + 7);
  }

  if (recurrence !== 'none' && appointments.length > 0) {
    const recurrenceEndDate = appointments[appointments.length - 1].date;
    appointments.forEach(appt => {
      appt.recurrenceEndDate = recurrenceEndDate;
    });
  }

  return appointments;
};
