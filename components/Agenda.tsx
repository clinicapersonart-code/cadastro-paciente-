import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Appointment, Patient, UserProfile, ConvenioConfig } from '../types';
import { CalendarIcon, PlusIcon, TrashIcon, CheckIcon, EditIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from './icons';
import useLocalStorage from '../hooks/useLocalStorage';
import { buildSeriesId } from '../utils/googleRecurrence';
import { listImportCandidates, type ImportCandidate } from '../services/googleCalendarImport';
import { groupImportCandidates, type ImportSeriesGroup } from '../utils/googleCalendarGrouping';

type DeleteScope = 'single' | 'all';

interface AgendaProps {
    patients: Patient[];
    profissionais: string[];
    convenios: ConvenioConfig[];
    appointments: Appointment[];
    onAddAppointment: (appt: Appointment) => void | Promise<void>;
    onAddBatchAppointments?: (appts: Appointment[]) => void | Promise<void>;
    onUpdateAppointment: (appt: Appointment) => void | Promise<void>;
    onDeleteAppointment: (id: string, name?: string, scope?: DeleteScope) => void | Promise<void>;
    currentUser?: UserProfile;
    googleSyncEnabled?: boolean;
}

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 20;
const SLOT_STEP_MIN = 15;
const PX_PER_MIN = 1.2; // altura do bloco (ajuste fino visual)
const DURATION_OPTIONS_MIN = [15, 30, 45, 60, 75, 90];

const formatDurationLabel = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
};

const TIME_SLOTS = Array.from({ length: (DAY_END_HOUR - DAY_START_HOUR + 1) }, (_, i) => {
    const h = String(DAY_START_HOUR + i).padStart(2, '0');
    return `${h}:00`;
});

const timeToMinutes = (t: string): number => {
    const [h, m] = (t || '00:00').split(':').map(Number);
    return (h * 60) + (m || 0);
};

const minutesToTime = (mins: number): string => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const snapToStep = (mins: number, step = SLOT_STEP_MIN) => Math.round(mins / step) * step;

// Distribui eventos sobrepostos em colunas para evitar sobreposição visual
const computeOverlapLayout = (appts: Appointment[]): { leftPct: number; widthPct: number }[] => {
    if (appts.length === 0) return [];

    const intervals = appts.map(a => ({
        start: timeToMinutes(a.time || '00:00'),
        end: timeToMinutes(a.time || '00:00') + (a.durationMin || 50),
    }));

    // Atribui coluna greedy (reusa coluna quando não há conflito)
    const colEndTimes: number[] = [];
    const colAssignments: number[] = new Array(appts.length).fill(0);

    for (let i = 0; i < intervals.length; i++) {
        let placed = false;
        for (let col = 0; col < colEndTimes.length; col++) {
            if (colEndTimes[col] <= intervals[i].start) {
                colEndTimes[col] = intervals[i].end;
                colAssignments[i] = col;
                placed = true;
                break;
            }
        }
        if (!placed) {
            colAssignments[i] = colEndTimes.length;
            colEndTimes.push(intervals[i].end);
        }
    }

    // Determina componentes conectados de sobreposição para calcular totalColunas por grupo
    const overlaps = (i: number, j: number) =>
        intervals[i].start < intervals[j].end && intervals[j].start < intervals[i].end;

    const n = appts.length;
    const visited = new Array(n).fill(false);
    const groupOf = new Array(n).fill(-1);
    let groupCount = 0;

    for (let i = 0; i < n; i++) {
        if (visited[i]) continue;
        const queue = [i];
        visited[i] = true;
        while (queue.length > 0) {
            const cur = queue.shift()!;
            groupOf[cur] = groupCount;
            for (let j = 0; j < n; j++) {
                if (!visited[j] && overlaps(cur, j)) {
                    visited[j] = true;
                    queue.push(j);
                }
            }
        }
        groupCount++;
    }

    const groupColCount = new Array(groupCount).fill(0);
    for (let i = 0; i < n; i++) {
        groupColCount[groupOf[i]] = Math.max(groupColCount[groupOf[i]], colAssignments[i] + 1);
    }

    return appts.map((_, i) => {
        const totalCols = groupColCount[groupOf[i]];
        const leftPct = colAssignments[i] * (100 / totalCols);
        const widthPct = Math.max(8, (100 / totalCols) - 1);
        return { leftPct, widthPct };
    });
};

// Paleta de cores fixas para profissionais
const PROFESSIONAL_COLORS = [
    { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-300', accent: '#3b82f6' },
    { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-300', accent: '#10b981' },
    { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-300', accent: '#8b5cf6' },
    { bg: 'bg-amber-500/20', border: 'border-amber-500', text: 'text-amber-300', accent: '#f59e0b' },
    { bg: 'bg-rose-500/20', border: 'border-rose-500', text: 'text-rose-300', accent: '#f43f5e' },
    { bg: 'bg-cyan-500/20', border: 'border-cyan-500', text: 'text-cyan-300', accent: '#06b6d4' },
    { bg: 'bg-indigo-500/20', border: 'border-indigo-500', text: 'text-indigo-300', accent: '#6366f1' },
    { bg: 'bg-pink-500/20', border: 'border-pink-500', text: 'text-pink-300', accent: '#ec4899' },
    { bg: 'bg-teal-500/20', border: 'border-teal-500', text: 'text-teal-300', accent: '#14b8a6' },
    { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-300', accent: '#f97316' },
];

const getProfessionalColor = (profissional: string, profissionais: string[]) => {
    const index = profissionais.indexOf(profissional);
    return PROFESSIONAL_COLORS[index % PROFESSIONAL_COLORS.length];
};

// Helpers de data
const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
};

const getWeekDays = (startDate: Date): Date[] => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        days.push(d);
    }
    return days;
};

const getMonthDays = (year: number, month: number): (Date | null)[][] => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const weeks: (Date | null)[][] = [];
    let currentWeek: (Date | null)[] = [];

    // Preenche dias vazios antes do primeiro dia
    for (let i = 0; i < startDayOfWeek; i++) {
        currentWeek.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        currentWeek.push(new Date(year, month, day));
        if (currentWeek.length === 7) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
    }

    // Preenche dias vazios após o último dia
    while (currentWeek.length > 0 && currentWeek.length < 7) {
        currentWeek.push(null);
    }
    if (currentWeek.length > 0) {
        weeks.push(currentWeek);
    }

    return weeks;
};

const formatDateISO = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const normalizeStr = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const Agenda: React.FC<AgendaProps> = ({
    patients,
    profissionais,
    convenios,
    appointments,
    onAddAppointment,
    onAddBatchAppointments,
    onUpdateAppointment,
    onDeleteAppointment,
    currentUser,
    googleSyncEnabled = false
}) => {
    // RBAC: Filtrar agendamentos para profissionais
    const filteredAppointments = useMemo(() => {
        if (!appointments || appointments.length === 0) return [];
        // Filtra agendamentos com dados obrigatórios válidos
        const validAppointments = appointments.filter(a => a && a.date && a.time && a.profissional);
        if (currentUser?.role === 'professional' && currentUser?.name) {
            const professionalName = currentUser.name;
            return validAppointments.filter(appt => {
                if (!appt?.profissional) return false;
                // Correspondência parcial do nome do profissional
                return appt.profissional.toLowerCase().includes(professionalName.toLowerCase()) ||
                    professionalName.toLowerCase().includes((appt.profissional || '').toLowerCase().split(' - ')[0]);
            });
        }
        return validAppointments;
    }, [appointments, currentUser]);

    const [selectedDate, setSelectedDate] = useLocalStorage<string>('personart.agenda.date', new Date().toISOString().split('T')[0]);
    const [viewMode, setViewMode] = useLocalStorage<'day' | 'week' | 'month'>('personart.agenda.view', 'week');

    const [filterProfissional, setFilterProfissional] = useState('');
    const [filterPatientName, setFilterPatientName] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [showGoogleImport, setShowGoogleImport] = useState(false);
    const [googleImportCandidates, setGoogleImportCandidates] = useState<ImportCandidate[]>([]);
    const [googleImportLoading, setGoogleImportLoading] = useState(false);
    const [googleImportError, setGoogleImportError] = useState('');
    const [googleImportPatientByEvent, setGoogleImportPatientByEvent] = useState<Record<string, string>>({});
    const [googleImportSavingId, setGoogleImportSavingId] = useState<string | null>(null);
    // key para séries: `calendarId::recurringEventId`
    const [googleImportPatientBySeries, setGoogleImportPatientBySeries] = useState<Record<string, string>>({});
    const [googleImportSavingSeriesId, setGoogleImportSavingSeriesId] = useState<string | null>(null);

    // Patient search in modal
    const [patientSearchQuery, setPatientSearchQuery] = useState('');
    const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
    const patientInputRef = useRef<HTMLInputElement>(null);
    const [selectedSlot, setSelectedSlot] = useState<{ date: string, time: string } | null>(null);

    const [formId, setFormId] = useState<string | null>(null);
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [formProfissional, setFormProfissional] = useState('');
    const [formConvenioName, setFormConvenioName] = useState('');
    const [formDate, setFormDate] = useState('');
    const [time, setTime] = useState('08:00');
    const [type, setType] = useState<'Convênio' | 'Particular'>('Convênio');
    const [durationMin, setDurationMin] = useState<number>(45);
    const [price, setPrice] = useState<number | ''>('');
    const [obs, setObs] = useState('');
    const [recurrence, setRecurrence] = useState<'none' | 'weekly' | 'biweekly' | 'monthly'>('none');
    const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>('');

    // Edição: aplicar recorrência na edição
    const [editApplyScope, setEditApplyScope] = useState<'single' | 'future'>('single');
    const [editRecurrence, setEditRecurrence] = useState<'none' | 'weekly' | 'biweekly' | 'monthly'>('none');
    const [cancelModal, setCancelModal] = useState<{ isOpen: boolean; appt: Appointment | null; reason: string }>({ isOpen: false, appt: null, reason: '' });

    // Patients available in modal (RBAC + search query)
    const filteredModalPatients = useMemo(() => {
        const rbacFiltered = patients
            .filter(p => {
                if (currentUser?.role === 'professional' && currentUser?.name) {
                    const normalizedPro = currentUser.name.toLowerCase().trim();
                    const matchingProEntry = profissionais.find(pr =>
                        pr.toLowerCase().includes(normalizedPro) ||
                        normalizedPro.includes(pr.toLowerCase().split(' - ')[0].trim())
                    );
                    if (matchingProEntry) return p.profissionais?.some(prof => prof === matchingProEntry) ?? false;
                    return p.profissionais?.some(prof =>
                        prof.toLowerCase().includes(normalizedPro) ||
                        normalizedPro.includes(prof.toLowerCase().split(' - ')[0].trim())
                    ) ?? false;
                }
                return true;
            })
            .sort((a, b) => a.nome.localeCompare(b.nome));

        if (!patientSearchQuery.trim()) return formId && selectedPatientId
            ? rbacFiltered.filter(p => p.id === selectedPatientId)
            : [];
        const q = normalizeStr(patientSearchQuery.trim());
        return rbacFiltered.filter(p =>
            normalizeStr(p.nome).includes(q) ||
            (p.carteirinha ? normalizeStr(p.carteirinha).includes(q) : false) ||
            (p.responsavel ? normalizeStr(p.responsavel).includes(q) : false)
        );
    }, [patients, patientSearchQuery, currentUser, profissionais, formId, selectedPatientId]);

    const handleStatusChange = (appt: Appointment, status: Appointment['status']) => {
        if (status === 'Cancelado') {
            setCancelModal({ isOpen: true, appt, reason: '' });
        } else {
            onUpdateAppointment({ ...appt, status });
        }
    };

    const currentDate = useMemo(() => new Date(selectedDate + 'T00:00:00'), [selectedDate]);
    const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);
    const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
    const monthDays = useMemo(() => getMonthDays(currentDate.getFullYear(), currentDate.getMonth()), [currentDate]);

    useEffect(() => {
        if (selectedSlot) {
            setFormDate(selectedSlot.date);
            setTime(selectedSlot.time);
            setShowForm(true);
        }
    }, [selectedSlot]);

    // Auto-preenche duração/valor quando um convênio é selecionado, mas mantém a duração editável.
    // Ao editar (formId presente) preserva os valores já salvos no agendamento.
    useEffect(() => {
        if (!showForm) return;
        if (formId) return;
        if (type !== 'Convênio') return;
        const cfg = getConvenioConfig(formConvenioName || undefined);
        if (cfg?.durationMin) setDurationMin(cfg.durationMin);
        if (typeof cfg?.price === 'number') setPrice(cfg.price);
    }, [type, formConvenioName, showForm, convenios, formId]);

    const getConvenioConfig = (name?: string) => {
        if (!name) return null;
        return convenios.find(c => (c.name || '').toLowerCase().trim() === name.toLowerCase().trim()) || null;
    };

    useEffect(() => {
        if (showForm && !formId) {
            setObs('');
            setRecurrence('none');
            setRecurrenceEndDate('');
            setDurationMin(45);
            setPrice('');
            setFormConvenioName('');
            if (selectedDate && !selectedSlot) setFormDate(selectedDate);
        }
    }, [showForm, formId, selectedDate, selectedSlot]);

    const toISODate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const addInterval = (start: Date, index: number, interval: 'weekly' | 'biweekly' | 'monthly') => {
        const d = new Date(start);
        if (interval === 'weekly') d.setDate(d.getDate() + (7 * index));
        else if (interval === 'biweekly') d.setDate(d.getDate() + (14 * index));
        else d.setMonth(d.getMonth() + index);
        return d;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // RBAC: Se for profissional, o profissional da sessão é ele próprio.
        const isProf = currentUser?.role === 'professional';
        const effectiveProfissional = isProf && currentUser?.name
            ? (profissionais.find(p => p.toLowerCase().includes(currentUser.name.toLowerCase()) || currentUser.name.toLowerCase().includes(p.toLowerCase().split(' - ')[0])) || formProfissional)
            : formProfissional;

        if (!selectedPatientId || !effectiveProfissional || !time || !formDate) {
            alert('Preencha os campos obrigatórios.');
            return;
        }

        const patient = patients.find(p => p.id === selectedPatientId);
        if (!patient) return;

        // Regras: Convênio pode ser escolhido no agendamento; valor vem do convênio e duração pode ser ajustada.
        let effectiveDuration = durationMin || 45;
        let effectivePrice: number | undefined = typeof price === 'number' ? price : undefined;
        let effectiveConvenioName: string | undefined;

        if (type === 'Convênio') {
            const convName = (formConvenioName || patient.convenio || '').trim();
            if (!convName) {
                alert('Selecione um convênio para este agendamento ou marque como Particular.');
                return;
            }
            const cfg = getConvenioConfig(convName);
            effectiveConvenioName = convName;
            effectiveDuration = effectiveDuration || cfg?.durationMin || 45;
            effectivePrice = typeof cfg?.price === 'number' ? cfg.price : effectivePrice;
        }

        const createAppointmentObj = (dateStr: string, idStr?: string, suffix?: string, index = 0): Appointment => ({
            id: idStr || `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            patientId: patient.id,
            patientName: patient.nome,
            carteirinha: patient.carteirinha,
            profissional: effectiveProfissional,
            date: dateStr,
            time,
            type,
            convenioName: type === 'Convênio' ? effectiveConvenioName : undefined,
            status: 'Agendado',
            obs: suffix ? (obs ? `${obs} (${suffix})` : suffix) : obs,
            durationMin: effectiveDuration,
            price: effectivePrice
        });

        if (formId) {
            const originAppt = appointments.find(a => a.id === formId);
            const updatedSingle = {
                ...createAppointmentObj(formDate, formId),
                googleEventId: originAppt?.googleEventId,
                googleCalendarHtmlLink: originAppt?.googleCalendarHtmlLink
            };

            // Se o usuário escolheu aplicar para futuros, recalcula toda a sequência existente.
            if (editApplyScope === 'future') {
                const baseProf = (effectiveProfissional || '').split(' - ')[0].trim().toLowerCase();
                const originDate = originAppt?.date || updatedSingle.date;

                const series = appointments
                    .filter(a => a.patientId === patient.id)
                    .filter(a => ((a.profissional || '').split(' - ')[0].trim().toLowerCase() === baseProf) || (a.profissional || '').toLowerCase().includes(baseProf))
                    .filter(a => a.date >= originDate)
                    .sort((a, b) => (a.date + 'T' + a.time).localeCompare(b.date + 'T' + b.time));

                // Garante que o atual esteja incluso
                if (!series.some(a => a.id === formId)) series.unshift(originAppt || updatedSingle);

                if (editRecurrence === 'none') {
                    // Mantém apenas este (atualizado) e remove futuros
                    await onUpdateAppointment(updatedSingle);
                    for (const a of series.filter(a => a.id !== formId)) {
                        await onDeleteAppointment(a.id, a.patientName);
                    }
                    closeForm();
                    return;
                }

                const [sy, sm, sd] = updatedSingle.date.split('-').map(Number);
                const start = new Date(sy, sm - 1, sd);

                for (const [i, old] of series.entries()) {
                    const nextDate = toISODate(addInterval(start, i, editRecurrence));
                    await onUpdateAppointment({
                        ...old,
                        patientId: updatedSingle.patientId,
                        patientName: updatedSingle.patientName,
                        carteirinha: updatedSingle.carteirinha,
                        profissional: updatedSingle.profissional,
                        date: nextDate,
                        time: updatedSingle.time,
                        type: updatedSingle.type,
                        convenioName: updatedSingle.convenioName,
                        obs: updatedSingle.obs,
                        durationMin: updatedSingle.durationMin,
                        price: updatedSingle.price
                    });
                }

                closeForm();
                return;
            }

            await onUpdateAppointment(updatedSingle);
            closeForm();
            return;
        }

        const newBatch: Appointment[] = [];
        const seriesId = recurrence !== 'none'
            ? buildSeriesId(patient.id, effectiveProfissional, formDate, time)
            : undefined;
        const [y, m, d] = formDate.split('-').map(Number);
        const currentDateCalculator = new Date(y, m - 1, d);
        
        let totalToCreate = 1;
        const intervalDays = recurrence === 'weekly' ? 7 : recurrence === 'biweekly' ? 14 : 30;

        if (recurrence !== 'none') {
            if (recurrenceEndDate) {
                const [ey, em, ed] = recurrenceEndDate.split('-').map(Number);
                const endCalcDate = new Date(ey, em - 1, ed);
                const diffTime = endCalcDate.getTime() - currentDateCalculator.getTime();
                if (diffTime < 0) {
                    alert('A data de término não pode ser anterior à data de início.');
                    return;
                }
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                totalToCreate = Math.floor(diffDays / intervalDays) + 1;
                if (totalToCreate > 104) totalToCreate = 104; // Max ~2 anos
            } else {
                totalToCreate = recurrence === 'weekly' ? 24 : 12; // Default ~6 meses
            }
        }

        for (let i = 0; i < totalToCreate; i++) {
            const cy = currentDateCalculator.getFullYear();
            const cm = String(currentDateCalculator.getMonth() + 1).padStart(2, '0');
            const cd = String(currentDateCalculator.getDate()).padStart(2, '0');
            const isoDate = `${cy}-${cm}-${cd}`;

            const suffix = (recurrence !== 'none' && i > 0) ? `Sessão ${i + 1}` : '';
            newBatch.push(createAppointmentObj(isoDate, undefined, suffix, i));

            if (recurrence !== 'none') {
                if (recurrence === 'monthly') currentDateCalculator.setMonth(currentDateCalculator.getMonth() + 1);
                else currentDateCalculator.setDate(currentDateCalculator.getDate() + intervalDays);
            }
        }

        if (recurrence !== 'none' && seriesId && newBatch.length > 0) {
            const effectiveRecurrenceEndDate = recurrenceEndDate || newBatch[newBatch.length - 1].date;
            newBatch.forEach((appt, index) => {
                appt.seriesId = seriesId;
                appt.recurrence = recurrence;
                appt.recurrenceEndDate = effectiveRecurrenceEndDate;
                appt.recurrenceIndex = index;
                appt.isSeriesMaster = index === 0;
            });
        }

        if (onAddBatchAppointments) await onAddBatchAppointments(newBatch);
        else await Promise.all(newBatch.map(a => onAddAppointment(a)));

        closeForm();
    };

    const closeForm = () => {
        setShowForm(false);
        setFormId(null);
        setSelectedSlot(null);
        setSelectedPatientId('');
        setPatientSearchQuery('');
        setPatientDropdownOpen(false);
        setFormProfissional('');
        setFormConvenioName('');
        setType('Convênio');
        setDurationMin(45);
        setPrice('');
    };

    const handleEditClick = (appt: Appointment) => {
        setFormId(appt.id);
        setSelectedPatientId(appt.patientId);
        const editPatient = patients.find(p => p.id === appt.patientId);
        setPatientSearchQuery(editPatient?.nome || appt.patientName || '');
        setPatientDropdownOpen(false);
        setFormProfissional(appt.profissional);
        setFormConvenioName(appt.convenioName || patients.find(p => p.id === appt.patientId)?.convenio || '');
        setFormDate(appt.date);
        setTime(appt.time);
        setType(appt.type);
        setDurationMin(appt.durationMin || 45);
        setPrice(typeof appt.price === 'number' ? appt.price : '');
        setObs(appt.obs || '');
        setRecurrence('none');
        setEditApplyScope('single');
        setEditRecurrence('none');
        setShowForm(true);
    };

    const getAppointmentsForDay = (date: Date): Appointment[] => {
        const dateStr = formatDateISO(date);
        const q = filterPatientName.trim() ? normalizeStr(filterPatientName.trim()) : '';
        return filteredAppointments
            .filter(a => a.date === dateStr)
            .filter(a => !filterProfissional || a.profissional === filterProfissional)
            .filter(a => !q || normalizeStr(a.patientName || '').includes(q))
            .sort((a, b) => a.time.localeCompare(b.time));
    };

    const getAppointmentsForSlot = (date: Date, timeSlot: string): Appointment[] => {
        const dateStr = formatDateISO(date);
        const slotHour = (timeSlot || '').split(':')[0]; // Ex: "14" from "14:00"

        return filteredAppointments
            .filter(a => {
                if (!a || !a.time || !a.date) return false;
                const apptHour = (a.time || '').split(':')[0]; // Ex: "14" from "14:15"
                return a.date === dateStr && apptHour === slotHour;
            })
            .filter(a => !filterProfissional || a.profissional === filterProfissional);
    };

    // Navegação
    const handlePrev = () => {
        const d = new Date(currentDate);
        if (viewMode === 'day') d.setDate(d.getDate() - 1);
        else if (viewMode === 'week') d.setDate(d.getDate() - 7);
        else d.setMonth(d.getMonth() - 1);
        setSelectedDate(formatDateISO(d));
    };

    const handleNext = () => {
        const d = new Date(currentDate);
        if (viewMode === 'day') d.setDate(d.getDate() + 1);
        else if (viewMode === 'week') d.setDate(d.getDate() + 7);
        else d.setMonth(d.getMonth() + 1);
        setSelectedDate(formatDateISO(d));
    };

    const handleToday = () => {
        setSelectedDate(formatDateISO(new Date()));
    };

    const getHeaderTitle = () => {
        if (viewMode === 'day') {
            return currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        } else if (viewMode === 'week') {
            const endDate = new Date(weekStart);
            endDate.setDate(endDate.getDate() + 6);
            return `${weekStart.getDate()} - ${endDate.getDate()} de ${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getFullYear()}`;
        } else {
            return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
        }
    };

    const isToday = (date: Date): boolean => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const candidateAlreadyImported = (candidate: ImportCandidate) =>
        appointments.some(a =>
            a.googleEventId === candidate.googleEventId ||
            (candidate.appointmentId && a.id === candidate.appointmentId)
        );

    const findSuggestedPatient = (candidate: ImportCandidate) => {
        const name = candidate.suggestedPatientName || candidate.summary.split(' • ')[0];
        const key = normalizeStr((name || '').trim());
        if (!key) return undefined;
        return patients.find(p => normalizeStr(p.nome || '') === key)
            || patients.find(p => normalizeStr(p.nome || '').includes(key) || key.includes(normalizeStr(p.nome || '')));
    };

    const getGoogleImportRange = () => {
        const base = new Date(`${selectedDate}T00:00:00`);
        const start = new Date(base);
        const end = new Date(base);

        if (viewMode === 'week') {
            const week = getWeekStart(base);
            start.setTime(week.getTime());
            end.setTime(week.getTime());
            end.setDate(end.getDate() + 6);
        } else if (viewMode === 'month') {
            start.setDate(1);
            end.setMonth(start.getMonth() + 1, 0);
        }

        return {
            timeMin: `${formatDateISO(start)}T00:00:00-03:00`,
            timeMax: `${formatDateISO(end)}T23:59:59-03:00`,
        };
    };

    const loadGoogleImportCandidates = async () => {
        setGoogleImportLoading(true);
        setGoogleImportError('');
        try {
            const { timeMin, timeMax } = getGoogleImportRange();
            const result = await listImportCandidates(timeMin, timeMax);
            setGoogleImportCandidates(result.candidates || []);
        } catch (error: any) {
            setGoogleImportError(error?.message || 'Falha ao buscar eventos do Google Agenda.');
        } finally {
            setGoogleImportLoading(false);
        }
    };

    const openGoogleImport = async () => {
        setShowGoogleImport(true);
        await loadGoogleImportCandidates();
    };

    const confirmGoogleImport = async (candidate: ImportCandidate) => {
        if (candidateAlreadyImported(candidate)) {
            setGoogleImportError('Este evento já está vinculado/importado no sistema.');
            return;
        }

        const selectedPatientId = googleImportPatientByEvent[candidate.googleEventId] || findSuggestedPatient(candidate)?.id || '';
        const patient = patients.find(p => p.id === selectedPatientId);
        if (!patient) {
            setGoogleImportError('Escolha um paciente antes de importar este evento.');
            return;
        }

        setGoogleImportSavingId(candidate.googleEventId);
        setGoogleImportError('');
        try {
            const profKey = normalizeStr(candidate.professionalName || '');
            const profissional = profissionais.find(p => {
                const pKey = normalizeStr(p);
                return pKey === profKey || pKey.includes(profKey) || profKey.includes(pKey.split(' - ')[0]);
            }) || candidate.professionalName || '';
            const safeGoogleId = (candidate.googleEventId || String(Date.now())).replace(/[^a-zA-Z0-9_-]/g, '-');
            const id = candidate.appointmentId && !appointments.some(a => a.id === candidate.appointmentId)
                ? candidate.appointmentId
                : `google-import-${safeGoogleId}`;

            const appt: Appointment = {
                id,
                patientId: patient.id,
                patientName: patient.nome,
                carteirinha: patient.carteirinha || candidate.patientId || '',
                profissional,
                date: candidate.date,
                time: candidate.time,
                type: patient.convenio ? 'Convênio' : 'Particular',
                convenioName: patient.convenio || '',
                status: 'Agendado',
                durationMin: candidate.durationMin || 50,
                googleEventId: candidate.googleEventId,
                googleCalendarHtmlLink: candidate.htmlLink,
                importSource: 'google',
                obs: [
                    'Importado do Google Agenda — revisar convênio/status antes de faturar.',
                    candidate.summary ? `Evento Google: ${candidate.summary}` : '',
                    candidate.warnings?.length ? `Avisos: ${candidate.warnings.join('; ')}` : '',
                ].filter(Boolean).join('\n'),
            };

            await onAddAppointment(appt);
            setGoogleImportCandidates(prev => prev.filter(c => c.googleEventId !== candidate.googleEventId || c.calendarId !== candidate.calendarId));
        } catch (error: any) {
            setGoogleImportError(error?.message || 'Falha ao importar evento.');
        } finally {
            setGoogleImportSavingId(null);
        }
    };

    const confirmGoogleSeriesImport = async (group: ImportSeriesGroup) => {
        const groupKey = `${group.calendarId}::${group.recurringEventId}`;
        const selectedPatientId = googleImportPatientBySeries[groupKey] || '';
        const patient = patients.find(p => p.id === selectedPatientId);
        if (!patient) {
            setGoogleImportError('Escolha um paciente antes de importar a série.');
            return;
        }

        setGoogleImportSavingSeriesId(groupKey);
        setGoogleImportError('');
        try {
            const profKey = normalizeStr(group.professionalName || '');
            const profissional = profissionais.find(p => {
                const pKey = normalizeStr(p);
                return pKey === profKey || pKey.includes(profKey) || profKey.includes(pKey.split(' - ')[0]);
            }) || group.professionalName || '';

            if (group.detectedRecurrence === 'none') {
                setGoogleImportError('Padrão de recorrência irregular não suportado como série. Importe as ocorrências individualmente.');
                return;
            }

            const recurrence = group.detectedRecurrence;
            const firstCandidate = group.candidates[0];
            const lastCandidate = group.candidates[group.candidates.length - 1];
            const seriesId = buildSeriesId(patient.id, profissional, firstCandidate.date, firstCandidate.time);
            const recurrenceEndDate = lastCandidate.date;

            const batch: Appointment[] = group.candidates.map((candidate, index) => {
                const safeGoogleId = (candidate.googleEventId || String(Date.now())).replace(/[^a-zA-Z0-9_-]/g, '-');
                const id = candidate.appointmentId && !appointments.some(a => a.id === candidate.appointmentId)
                    ? candidate.appointmentId
                    : `google-import-${safeGoogleId}`;

                return {
                    id,
                    patientId: patient.id,
                    patientName: patient.nome,
                    carteirinha: patient.carteirinha || '',
                    profissional,
                    date: candidate.date,
                    time: candidate.time,
                    type: patient.convenio ? 'Convênio' : 'Particular',
                    convenioName: patient.convenio || '',
                    status: 'Agendado',
                    durationMin: candidate.durationMin || 50,
                    googleEventId: group.recurringEventId,
                    googleCalendarHtmlLink: candidate.htmlLink,
                    importSource: 'google' as const,
                    seriesId,
                    recurrence,
                    recurrenceEndDate,
                    recurrenceIndex: index,
                    isSeriesMaster: index === 0,
                    obs: [
                        'Importado do Google Agenda — revisar convênio/status antes de faturar.',
                        candidate.summary ? `Evento Google: ${candidate.summary}` : '',
                        candidate.warnings?.length ? `Avisos: ${candidate.warnings.join('; ')}` : '',
                    ].filter(Boolean).join('\n'),
                };
            });

            if (onAddBatchAppointments) await onAddBatchAppointments(batch);
            else await Promise.all(batch.map(a => onAddAppointment(a)));

            const importedIds = new Set(group.candidates.map(c => `${c.calendarId}::${c.googleEventId}`));
            setGoogleImportCandidates(prev => prev.filter(c => !importedIds.has(`${c.calendarId}::${c.googleEventId}`)));
        } catch (error: any) {
            setGoogleImportError(error?.message || 'Falha ao importar série.');
        } finally {
            setGoogleImportSavingSeriesId(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header com navegação e controles */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 shadow-lg">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                    {/* Navegação e título */}
                    <div className="flex items-center gap-3">
                        <button onClick={handleToday} className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition">
                            Hoje
                        </button>
                        <div className="flex items-center gap-1">
                            <button onClick={handlePrev} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 transition">
                                <ChevronLeftIcon className="w-5 h-5" />
                            </button>
                            <button onClick={handleNext} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 transition">
                                <ChevronRightIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <h2 className="text-lg font-semibold text-white capitalize">{getHeaderTitle()}</h2>
                    </div>

                    {/* Seletor de visualização e ações */}
                    <div className="flex items-center gap-3">
                        <div className="flex bg-slate-900 rounded-lg p-1">
                            {(['day', 'week', 'month'] as const).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${viewMode === mode ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    {mode === 'day' ? 'Dia' : mode === 'week' ? 'Semana' : 'Mês'}
                                </button>
                            ))}
                        </div>

                        {/* Seletor de profissional — oculto para profissionais (já filtra automaticamente) */}
                        {(!currentUser || currentUser.role !== 'professional') && (
                            <select
                                value={filterProfissional}
                                onChange={(e) => setFilterProfissional(e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                            >
                                <option value="">Todos</option>
                                {profissionais.map(p => <option key={p} value={p}>{p.split(' - ')[0]}</option>)}
                            </select>
                        )}

                        {/* Busca por paciente na agenda */}
                        <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                                </svg>
                            </span>
                            <input
                                type="text"
                                placeholder="Buscar paciente..."
                                value={filterPatientName}
                                onChange={e => setFilterPatientName(e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 outline-none w-44"
                            />
                            {filterPatientName && (
                                <button
                                    type="button"
                                    onClick={() => setFilterPatientName('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                >
                                    <XIcon className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        <button
                            type="button"
                            disabled
                            title={googleSyncEnabled ? 'Sincronização automática com Google Agenda ativa' : 'Sincronização com Google Agenda inativa ou não configurada'}
                            className={`font-semibold px-3 py-2 rounded-lg text-sm flex items-center gap-2 border transition cursor-default ${googleSyncEnabled
                                ? 'bg-emerald-900/30 border-emerald-700/60 text-emerald-300'
                                : 'bg-slate-800 border-slate-700 text-slate-500'
                                }`}
                        >
                            <CalendarIcon className="w-4 h-4" />
                            <span>Google Agenda</span>
                            <span className={`w-2 h-2 rounded-full ${googleSyncEnabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                        </button>

                        {googleSyncEnabled && (!currentUser || currentUser.role !== 'professional') && (
                            <button
                                type="button"
                                onClick={openGoogleImport}
                                className="bg-emerald-700 hover:bg-emerald-600 text-white font-semibold px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition"
                            >
                                <CalendarIcon className="w-4 h-4" /> Importar do Google
                            </button>
                        )}

                        <button
                            onClick={() => setShowForm(true)}
                            className="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition"
                        >
                            <PlusIcon className="w-4 h-4" /> Novo
                        </button>
                    </div>
                </div>

                {/* Legenda de cores dos profissionais */}
                <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-700/50">
                    {(currentUser?.role === 'professional'
                        ? profissionais.filter(p => {
                            const normalizedPro = currentUser.name.toLowerCase();
                            return p.toLowerCase().includes(normalizedPro) || normalizedPro.includes(p.toLowerCase().split(' - ')[0]);
                        })
                        : profissionais
                    ).slice(0, 8).map((p, _i) => {
                        const color = getProfessionalColor(p, profissionais); // Usa índice na lista completa para manter cores consistentes
                        return (
                            <div key={p} className="flex items-center gap-1.5 text-xs">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: color.accent }}></div>
                                <span className="text-slate-400">{p.split(' - ')[0]}</span>
                            </div>
                        );
                    })}
                    <div className={`ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${googleSyncEnabled ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-400' : 'bg-slate-700/40 border-slate-600/50 text-slate-500'}`}>
                        <span className={`w-2 h-2 rounded-full ${googleSyncEnabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                        {googleSyncEnabled ? 'Google Agenda: ativo' : 'Google Agenda: inativo'}
                    </div>
                </div>
            </div>

            {/* Calendário */}
            <div className="bg-slate-800/30 border border-slate-700 rounded-2xl overflow-hidden">
                {viewMode === 'week' && (
                    <WeekView
                        weekDays={weekDays}
                        getAppointmentsForDay={getAppointmentsForDay}
                        profissionais={profissionais}
                        onGridClick={(date, time) => setSelectedSlot({ date: formatDateISO(date), time })}
                        onEditAppointment={handleEditClick}
                        onDeleteAppointment={onDeleteAppointment}
                        onStatusChange={handleStatusChange}
                        isToday={isToday}
                        googleSyncEnabled={googleSyncEnabled}
                    />
                )}

                {viewMode === 'month' && (
                    <MonthView
                        monthDays={monthDays}
                        getAppointmentsForDay={getAppointmentsForDay}
                        profissionais={profissionais}
                        onDayClick={(date) => { setSelectedDate(formatDateISO(date)); setViewMode('day'); }}
                        isToday={isToday}
                        selectedDate={currentDate}
                    />
                )}

                {viewMode === 'day' && (
                    <DayView
                        date={currentDate}
                        getAppointmentsForDay={getAppointmentsForDay}
                        profissionais={profissionais}
                        onGridClick={(time) => setSelectedSlot({ date: formatDateISO(currentDate), time })}
                        onEditAppointment={handleEditClick}
                        onDeleteAppointment={onDeleteAppointment}
                        onStatusChange={handleStatusChange}
                        googleSyncEnabled={googleSyncEnabled}
                    />
                )}
            </div>

            {/* Modal de Importação Google Agenda */}
            {showGoogleImport && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-5 border-b border-slate-700 flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-bold text-white">Importar do Google Agenda</h3>
                                <p className="text-sm text-slate-400 mt-1">
                                    Revise cada evento e vincule a um paciente antes de subir para a agenda do sistema.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowGoogleImport(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 overflow-y-auto">
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={loadGoogleImportCandidates}
                                    disabled={googleImportLoading}
                                    className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold px-3 py-2 rounded-lg text-sm"
                                >
                                    {googleImportLoading ? 'Buscando...' : 'Atualizar busca'}
                                </button>
                                <span className="text-xs text-slate-400">
                                    Período: {viewMode === 'day' ? 'dia atual' : viewMode === 'week' ? 'semana atual' : 'mês atual'} da agenda.
                                </span>
                            </div>

                            {googleImportError && (
                                <div className="bg-red-900/30 border border-red-800 text-red-200 rounded-lg p-3 text-sm">
                                    {googleImportError}
                                </div>
                            )}

                            {!googleImportLoading && googleImportCandidates.length === 0 && (
                                <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-6 text-center text-slate-400">
                                    Nenhum evento encontrado para importação neste período.
                                </div>
                            )}

                            <div className="space-y-3">
                                {groupImportCandidates(googleImportCandidates).map(group => {
                                    if (group.type === 'series') {
                                        const groupKey = `${group.calendarId}::${group.recurringEventId}`;
                                        const selectedPatientId = googleImportPatientBySeries[groupKey] || '';
                                        const alreadyImported = appointments.some(
                                            a => a.googleEventId === group.recurringEventId && a.importSource === 'google'
                                        );
                                        const isSaving = googleImportSavingSeriesId === groupKey;
                                        const first = group.candidates[0];
                                        const last = group.candidates[group.candidates.length - 1];
                                        const recurrenceLabel: Record<string, string> = { weekly: 'Semanal', biweekly: 'Quinzenal', monthly: 'Mensal' };
                                        const patternLabel = group.detectedRecurrence !== 'none'
                                            ? recurrenceLabel[group.detectedRecurrence]
                                            : 'Irregular';
                                        const allWarnings = [...new Set(group.candidates.flatMap(c => c.warnings))];
                                        return (
                                            <div key={groupKey} className="bg-slate-900/60 border border-indigo-700/60 rounded-xl p-4">
                                                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                                                    <div className="space-y-1 min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <h4 className="font-semibold text-white truncate">{first.summary || 'Série sem título'}</h4>
                                                            <span className="text-xs bg-indigo-800/70 text-indigo-200 px-2 py-0.5 rounded-full">{group.candidates.length} ocorrências</span>
                                                            <span className="text-xs bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-full">{patternLabel}</span>
                                                            {alreadyImported && <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">já importado</span>}
                                                            {group.detectedRecurrence === 'none' && !alreadyImported && (
                                                                <span className="text-xs bg-amber-900/50 text-amber-300 px-2 py-0.5 rounded-full">padrão irregular</span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-slate-300">
                                                            {first.date.split('-').reverse().join('/')} até {last.date.split('-').reverse().join('/')} às {first.time} • {first.durationMin || 50} min • {group.professionalName}
                                                        </p>
                                                        {allWarnings.length > 0 && (
                                                            <p className="text-xs text-amber-300">{allWarnings.join(' • ')}</p>
                                                        )}
                                                        {group.detectedRecurrence === 'none' && !alreadyImported && (
                                                            <p className="text-xs text-amber-400">Intervalos irregulares — série será criada como semanal. Revise após importar.</p>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col sm:flex-row gap-2 lg:min-w-[420px]">
                                                        <select
                                                            value={selectedPatientId}
                                                            disabled={alreadyImported}
                                                            onChange={e => setGoogleImportPatientBySeries(prev => ({ ...prev, [groupKey]: e.target.value }))}
                                                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-60"
                                                        >
                                                            <option value="">Vincular paciente...</option>
                                                            {patients.map(p => (
                                                                <option key={p.id} value={p.id}>{p.nome}</option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            type="button"
                                                            disabled={alreadyImported || isSaving}
                                                            onClick={() => confirmGoogleSeriesImport(group)}
                                                            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-semibold px-4 py-2 rounded-lg text-sm transition whitespace-nowrap"
                                                        >
                                                            {isSaving ? 'Importando...' : 'Importar série'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    // individual candidate
                                    const candidate = group.candidate;
                                    const suggestedPatient = findSuggestedPatient(candidate);
                                    const selectedPatientId = googleImportPatientByEvent[candidate.googleEventId] || suggestedPatient?.id || '';
                                    const alreadyImported = candidateAlreadyImported(candidate);
                                    return (
                                        <div key={`${candidate.calendarId}-${candidate.googleEventId}`} className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                                            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                                                <div className="space-y-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h4 className="font-semibold text-white truncate">{candidate.summary || 'Evento sem título'}</h4>
                                                        {alreadyImported && <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">já vinculado</span>}
                                                        {candidate.hasAppointmentId && <span className="text-xs bg-sky-900/50 text-sky-200 px-2 py-0.5 rounded-full">criado pelo sistema</span>}
                                                    </div>
                                                    <p className="text-sm text-slate-300">
                                                        {candidate.date.split('-').reverse().join('/')} às {candidate.time} • {candidate.durationMin || 50} min • {candidate.professionalName}
                                                    </p>
                                                    {candidate.warnings.length > 0 && (
                                                        <p className="text-xs text-amber-300">{candidate.warnings.join(' • ')}</p>
                                                    )}
                                                </div>

                                                <div className="flex flex-col sm:flex-row gap-2 lg:min-w-[420px]">
                                                    <select
                                                        value={selectedPatientId}
                                                        disabled={alreadyImported}
                                                        onChange={e => setGoogleImportPatientByEvent(prev => ({ ...prev, [candidate.googleEventId]: e.target.value }))}
                                                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-60"
                                                    >
                                                        <option value="">Vincular paciente...</option>
                                                        {patients.map(p => (
                                                            <option key={p.id} value={p.id}>{p.nome}</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        disabled={alreadyImported || googleImportSavingId === candidate.googleEventId}
                                                        onClick={() => confirmGoogleImport(candidate)}
                                                        className="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-semibold px-4 py-2 rounded-lg text-sm transition"
                                                    >
                                                        {googleImportSavingId === candidate.googleEventId ? 'Importando...' : 'Importar'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Cancelamento */}
            {cancelModal.isOpen && cancelModal.appt && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-white mb-2">Cancelar Consulta</h3>
                        <p className="text-sm text-slate-400 mb-4">
                            Paciente: <strong className="text-slate-200">{cancelModal.appt.patientName}</strong><br/>
                            Data/Hora: <strong className="text-slate-200">{cancelModal.appt.date.split('-').reverse().join('/')} às {cancelModal.appt.time}</strong>
                        </p>
                        <div className="space-y-3">
                            <label className="text-sm text-white font-medium">Motivo (Opcional)</label>
                            <textarea
                                placeholder="Ex: Paciente desmarcou por motivo de saúde..."
                                value={cancelModal.reason}
                                onChange={e => setCancelModal({ ...cancelModal, reason: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white resize-none h-20"
                            />
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setCancelModal({ isOpen: false, appt: null, reason: '' })}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2 rounded-lg transition"
                            >
                                Fechar
                            </button>
                            <button
                                onClick={() => {
                                    if (cancelModal.appt) {
                                        const oldObs = cancelModal.appt.obs || '';
                                        const append = cancelModal.reason ? `Motivo do cancelamento: ${cancelModal.reason}` : '';
                                        const newObs = oldObs ? (append ? `${oldObs}\n${append}` : oldObs) : append;
                                        onUpdateAppointment({ ...cancelModal.appt, status: 'Cancelado', obs: newObs });
                                    }
                                    setCancelModal({ isOpen: false, appt: null, reason: '' });
                                }}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg transition"
                            >
                                Confirmar Cancelamento
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Agendamento */}
            {showForm && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">
                            {formId ? 'Editar Agendamento' : 'Novo Agendamento'}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Busca de paciente */}
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                        <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                                    </svg>
                                </span>
                                <input
                                    ref={patientInputRef}
                                    type="text"
                                    placeholder={formId ? 'Alterar paciente...' : 'Buscar paciente por nome, carteirinha ou responsável...'}
                                    value={patientSearchQuery}
                                    onChange={e => {
                                        setPatientSearchQuery(e.target.value);
                                        if (selectedPatientId) setSelectedPatientId('');
                                        setPatientDropdownOpen(true);
                                    }}
                                    onFocus={() => { if (!selectedPatientId) setPatientDropdownOpen(true); }}
                                    onBlur={() => setTimeout(() => setPatientDropdownOpen(false), 150)}
                                    className={`w-full bg-slate-900 border rounded-lg pl-9 pr-8 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-sky-500 ${selectedPatientId ? 'border-sky-600' : 'border-slate-700'}`}
                                    autoComplete="off"
                                />
                                {patientSearchQuery && (
                                    <button
                                        type="button"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => {
                                            setPatientSearchQuery('');
                                            setSelectedPatientId('');
                                            setPatientDropdownOpen(false);
                                            patientInputRef.current?.focus();
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                    >
                                        <XIcon className="w-4 h-4" />
                                    </button>
                                )}
                                {/* Dropdown de resultados */}
                                {patientDropdownOpen && patientSearchQuery.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-30 max-h-48 overflow-y-auto">
                                        {filteredModalPatients.length === 0 ? (
                                            <div className="px-3 py-2.5 text-sm text-slate-500">Nenhum paciente encontrado.</div>
                                        ) : (
                                            filteredModalPatients.map(p => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onMouseDown={() => {
                                                        setSelectedPatientId(p.id);
                                                        setPatientSearchQuery(p.nome);
                                                        setPatientDropdownOpen(false);
                                                        if (type === 'Convênio') setFormConvenioName(p.convenio || '');
                                                    }}
                                                    className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center justify-between gap-2"
                                                >
                                                    <span className="truncate">{p.nome}</span>
                                                    {p.carteirinha && <span className="text-xs text-slate-500 shrink-0">{p.carteirinha}</span>}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                                {/* Instrução quando campo vazio em criação */}
                                {!formId && !patientSearchQuery && (
                                    <p className="text-[11px] text-slate-500 mt-1">Digite para buscar e selecionar um paciente.</p>
                                )}
                                {/* Confirmação de seleção */}
                                {selectedPatientId && (
                                    <p className="text-[11px] text-sky-400 mt-1">
                                        Paciente selecionado ✓
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <input type="date" required value={formDate} onChange={e => setFormDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white" />
                                <input type="time" required step={900} value={time} onChange={e => setTime(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white" />
                            </div>

                            <select
                                required
                                value={currentUser?.role === 'professional' && currentUser?.name ? (profissionais.find(p => p.toLowerCase().includes(currentUser.name.toLowerCase()) || currentUser.name.toLowerCase().includes(p.toLowerCase().split(' - ')[0])) || formProfissional) : formProfissional}
                                onChange={e => setFormProfissional(e.target.value)}
                                disabled={currentUser?.role === 'professional'}
                                className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white ${currentUser?.role === 'professional' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <option value="">Selecione o profissional...</option>
                                {profissionais.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">Tipo</label>
                                    <select
                                        value={type}
                                        onChange={e => {
                                            const nextType = e.target.value as 'Convênio' | 'Particular';
                                            setType(nextType);
                                            if (nextType === 'Particular') {
                                                setFormConvenioName('');
                                            } else if (!formConvenioName) {
                                                const patient = patients.find(p => p.id === selectedPatientId);
                                                setFormConvenioName(patient?.convenio || '');
                                            }
                                        }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                    >
                                        <option value="Convênio">Convênio</option>
                                        <option value="Particular">Particular</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">Convênio</label>
                                    <select
                                        value={formConvenioName}
                                        onChange={e => {
                                            setFormConvenioName(e.target.value);
                                            if (e.target.value) setType('Convênio');
                                        }}
                                        disabled={type === 'Particular'}
                                        className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white ${type === 'Particular' ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        <option value="">Selecione...</option>
                                        {convenios
                                            .filter(c => c?.active !== false)
                                            .map(c => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Duração</label>
                                <select
                                    value={durationMin}
                                    onChange={e => setDurationMin(Number(e.target.value))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                >
                                    {DURATION_OPTIONS_MIN.map(m => <option key={m} value={m}>{formatDurationLabel(m)}</option>)}
                                </select>
                                {type === 'Convênio' && (
                                    <p className="text-[10px] text-slate-500 mt-1">Se o convênio tiver duração padrão, ela entra automaticamente, mas você pode ajustar.</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">Valor (R$)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={price}
                                        onChange={e => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                                        disabled={type === 'Convênio'}
                                        className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white ${type === 'Convênio' ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        placeholder={type === 'Convênio' ? 'Convênio' : 'ex: 150'}
                                    />
                                </div>
                                <div className="flex items-end">
                                    {type === 'Convênio' && (
                                        <p className="text-[10px] text-slate-500">(Convênio: valor vem do cadastro do convênio do paciente)</p>
                                    )}
                                </div>
                            </div>

                            {!formId ? (
                                <div className="bg-slate-900/50 rounded-lg p-3 space-y-3">
                                    <label className="text-xs text-slate-400 font-medium">Recorrência</label>
                                    <div className="flex gap-2">
                                        {(['none', 'weekly', 'biweekly', 'monthly'] as const).map(r => (
                                            <button
                                                key={r}
                                                type="button"
                                                onClick={() => setRecurrence(r)}
                                                className={`flex-1 py-2 text-xs rounded-lg transition ${recurrence === r ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                    }`}
                                            >
                                                {r === 'none' ? 'Única' : r === 'weekly' ? 'Semanal' : r === 'biweekly' ? 'Quinzenal' : 'Mensal'}
                                            </button>
                                        ))}
                                    </div>
                                    {recurrence !== 'none' && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-xs text-slate-400">Até</span>
                                            <input
                                                type="date"
                                                min={formDate}
                                                value={recurrenceEndDate}
                                                onChange={e => setRecurrenceEndDate(e.target.value)}
                                                className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-slate-900/50 rounded-lg p-3 space-y-3">
                                    <label className="text-xs text-slate-400 font-medium">Repetição (editar)</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <select
                                            value={editRecurrence}
                                            onChange={e => setEditRecurrence(e.target.value as any)}
                                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        >
                                            <option value="none">Não repetir</option>
                                            <option value="weekly">Semanal</option>
                                            <option value="biweekly">Quinzenal</option>
                                            <option value="monthly">Mensal</option>
                                        </select>
                                        <select
                                            value={editApplyScope}
                                            onChange={e => setEditApplyScope(e.target.value as any)}
                                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        >
                                            <option value="single">Só este</option>
                                            <option value="future">Este e próximos</option>
                                        </select>
                                    </div>
                                    <p className="text-[11px] text-slate-500">
                                        Dica: use “Este e próximos” pra mudar horário/dia da série sem editar um por um.
                                    </p>
                                </div>
                            )}

                            <textarea
                                placeholder="Observações (opcional)"
                                value={obs}
                                onChange={e => setObs(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white h-20 resize-none"
                            />

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={closeForm} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg transition">
                                    Cancelar
                                </button>
                                <button type="submit" className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 rounded-lg transition">
                                    {formId ? 'Salvar' : 'Agendar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// Componente de Visualização Semanal (Google-like: grid 15min + blocos proporcionais)
interface WeekViewProps {
    weekDays: Date[];
    getAppointmentsForDay: (date: Date) => Appointment[];
    profissionais: string[];
    onGridClick: (date: Date, time: string) => void;
    onEditAppointment: (appt: Appointment) => void;
    onDeleteAppointment: (id: string, name?: string, scope?: DeleteScope) => void;
    onStatusChange: (appt: Appointment, status: Appointment['status']) => void;
    isToday: (date: Date) => boolean;
    googleSyncEnabled?: boolean;
}

const WeekView: React.FC<WeekViewProps> = ({
    weekDays,
    getAppointmentsForDay,
    profissionais,
    onGridClick,
    onEditAppointment,
    onDeleteAppointment,
    onStatusChange,
    isToday,
    googleSyncEnabled = false
}) => {
    const dayStartMin = DAY_START_HOUR * 60;
    const dayEndMin = (DAY_END_HOUR + 1) * 60;
    const totalMin = dayEndMin - dayStartMin;
    const heightPx = totalMin * PX_PER_MIN;

    const onClickDayColumn = (e: React.MouseEvent, date: Date) => {
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        const minsFromTop = clamp(Math.floor(y / PX_PER_MIN), 0, totalMin - 1);
        const snapped = snapToStep(dayStartMin + minsFromTop);
        onGridClick(date, minutesToTime(snapped));
    };

    return (
        <div className="overflow-x-auto">
            <div className="min-w-[980px]">
                {/* Header */}
                <div className="grid grid-cols-8 border-b border-slate-700">
                    <div className="p-3 text-xs text-slate-500 font-medium"></div>
                    {weekDays.map((day, i) => (
                        <div key={i} className={`p-3 text-center border-l border-slate-700 ${isToday(day) ? 'bg-sky-900/20' : ''}`}>
                            <div className="text-xs text-slate-500 font-medium">{WEEKDAY_NAMES[day.getDay()]}</div>
                            <div className={`text-lg font-bold ${isToday(day) ? 'text-sky-400' : 'text-slate-200'}`}>{day.getDate()}</div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-8">
                    {/* Horas */}
                    <div className="relative bg-slate-800/30 border-r border-slate-700">
                        <div style={{ height: heightPx }}>
                            {TIME_SLOTS.map(t => {
                                const mins = timeToMinutes(t) - dayStartMin;
                                const top = mins * PX_PER_MIN;
                                return (
                                    <div key={t} className="absolute left-0 right-0" style={{ top }}>
                                        <div className="-mt-2 pr-2 text-[11px] text-slate-500 font-mono text-right">{t}</div>
                                        <div className="border-t border-slate-700/40" />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Colunas por dia */}
                    {weekDays.map((day, i) => {
                        const appts = getAppointmentsForDay(day)
                            .filter(a => a && a.time && a.date)
                            .sort((a, b) => a.time.localeCompare(b.time));

                        return (
                            <div key={i} className={`relative border-l border-slate-700 ${isToday(day) ? 'bg-sky-900/10' : ''}`}>
                                <div
                                    className="absolute inset-0"
                                    style={{ height: heightPx }}
                                    onClick={(e) => onClickDayColumn(e, day)}
                                >
                                    {Array.from({ length: Math.floor(totalMin / SLOT_STEP_MIN) + 1 }).map((_, idx) => {
                                        const top = idx * SLOT_STEP_MIN * PX_PER_MIN;
                                        return <div key={idx} className="absolute left-0 right-0 border-t border-slate-700/20" style={{ top }} />;
                                    })}
                                </div>

                                <div className="relative" style={{ height: heightPx }}>
                                    {(() => {
                                        const layout = computeOverlapLayout(appts);
                                        return appts.map((appt, idx) => (
                                            <EventBlock
                                                key={appt.id}
                                                appt={appt}
                                                profissionais={profissionais}
                                                dayStartMin={dayStartMin}
                                                leftPct={layout[idx].leftPct}
                                                widthPct={layout[idx].widthPct}
                                                onEdit={onEditAppointment}
                                                onDelete={onDeleteAppointment}
                                                onStatusChange={onStatusChange}
                                                googleSyncEnabled={googleSyncEnabled}
                                            />
                                        ));
                                    })()}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// Componente de Visualização Mensal
interface MonthViewProps {
    monthDays: (Date | null)[][];
    getAppointmentsForDay: (date: Date) => Appointment[];
    profissionais: string[];
    onDayClick: (date: Date) => void;
    isToday: (date: Date) => boolean;
    selectedDate: Date;
}

const MonthView: React.FC<MonthViewProps> = ({ monthDays, getAppointmentsForDay, profissionais, onDayClick, isToday, selectedDate }) => {
    return (
        <div>
            {/* Header com dias da semana */}
            <div className="grid grid-cols-7 border-b border-slate-700">
                {WEEKDAY_NAMES.map(day => (
                    <div key={day} className="p-3 text-center text-xs text-slate-500 font-medium">
                        {day}
                    </div>
                ))}
            </div>

            {/* Grid do mês */}
            {monthDays.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-cols-7 border-b border-slate-700/50">
                    {week.map((day, dayIndex) => {
                        if (!day) {
                            return <div key={dayIndex} className="p-2 min-h-[100px] bg-slate-900/30"></div>;
                        }

                        const appointments = getAppointmentsForDay(day);
                        const isCurrentMonth = day.getMonth() === selectedDate.getMonth();

                        return (
                            <div
                                key={dayIndex}
                                onClick={() => onDayClick(day)}
                                className={`p-2 min-h-[100px] cursor-pointer transition hover:bg-slate-700/30 ${isToday(day) ? 'bg-sky-900/20' : ''
                                    } ${dayIndex > 0 ? 'border-l border-slate-700/50' : ''}`}
                            >
                                <div className={`text-sm font-bold mb-1 ${isToday(day) ? 'text-sky-400' : isCurrentMonth ? 'text-slate-200' : 'text-slate-600'
                                    }`}>
                                    {day.getDate()}
                                </div>
                                <div className="space-y-1">
                                    {appointments.slice(0, 3).map(appt => {
                                        const color = getProfessionalColor(appt.profissional, profissionais);
                                        const isCancelled = appt.status === 'Cancelado';
                                        return (
                                            <div
                                                key={appt.id}
                                                className={`text-[10px] px-1.5 py-0.5 rounded truncate ${color?.bg || ''} ${color?.text || ''} ${isCancelled ? 'opacity-50 line-through grayscale' : ''}`}
                                            >
                                                {appt.time || ''} {(appt.patientName || '').split(' ')[0]}
                                            </div>
                                        );
                                    })}
                                    {appointments.length > 3 && (
                                        <div className="text-[10px] text-slate-500 pl-1">
                                            +{appointments.length - 3} mais
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

// Componente de Visualização Diária (Google-like)
interface DayViewProps {
    date: Date;
    getAppointmentsForDay: (date: Date) => Appointment[];
    profissionais: string[];
    onGridClick: (time: string) => void;
    onEditAppointment: (appt: Appointment) => void;
    onDeleteAppointment: (id: string, name?: string, scope?: DeleteScope) => void;
    onStatusChange: (appt: Appointment, status: Appointment['status']) => void;
    googleSyncEnabled?: boolean;
}

const DayView: React.FC<DayViewProps> = ({
    date,
    getAppointmentsForDay,
    profissionais,
    onGridClick,
    onEditAppointment,
    onDeleteAppointment,
    onStatusChange,
    googleSyncEnabled = false
}) => {
    const dayStartMin = DAY_START_HOUR * 60;
    const dayEndMin = (DAY_END_HOUR + 1) * 60;
    const totalMin = dayEndMin - dayStartMin;
    const heightPx = totalMin * PX_PER_MIN;

    const appts = getAppointmentsForDay(date)
        .filter(a => a && a.time && a.date)
        .sort((a, b) => a.time.localeCompare(b.time));

    const onClickColumn = (e: React.MouseEvent) => {
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        const minsFromTop = clamp(Math.floor(y / PX_PER_MIN), 0, totalMin - 1);
        const snapped = snapToStep(dayStartMin + minsFromTop);
        onGridClick(minutesToTime(snapped));
    };

    return (
        <div className="grid grid-cols-[80px_1fr]">
            {/* Coluna de horas */}
            <div className="relative bg-slate-800/30 border-r border-slate-700">
                <div style={{ height: heightPx }}>
                    {TIME_SLOTS.map(t => {
                        const mins = timeToMinutes(t) - dayStartMin;
                        const top = mins * PX_PER_MIN;
                        return (
                            <div key={t} className="absolute left-0 right-0" style={{ top }}>
                                <div className="-mt-2 pr-2 text-[11px] text-slate-500 font-mono text-right">{t}</div>
                                <div className="border-t border-slate-700/40" />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Coluna do dia */}
            <div className="relative border-l border-slate-700">
                <div className="absolute inset-0" style={{ height: heightPx }} onClick={onClickColumn}>
                    {Array.from({ length: Math.floor(totalMin / SLOT_STEP_MIN) + 1 }).map((_, idx) => {
                        const top = idx * SLOT_STEP_MIN * PX_PER_MIN;
                        return <div key={idx} className="absolute left-0 right-0 border-t border-slate-700/20" style={{ top }} />;
                    })}
                </div>

                <div className="relative" style={{ height: heightPx }}>
                    {(() => {
                        const layout = computeOverlapLayout(appts);
                        return appts.map((appt, idx) => (
                            <EventBlock
                                key={appt.id}
                                appt={appt}
                                profissionais={profissionais}
                                dayStartMin={dayStartMin}
                                leftPct={layout[idx].leftPct}
                                widthPct={layout[idx].widthPct}
                                onEdit={onEditAppointment}
                                onDelete={onDeleteAppointment}
                                onStatusChange={onStatusChange}
                                googleSyncEnabled={googleSyncEnabled}
                            />
                        ));
                    })()}
                </div>
            </div>
        </div>
    );
};

// Bloco de evento (posição relativa por minutos)
interface EventBlockProps {
    appt: Appointment;
    profissionais: string[];
    dayStartMin: number;
    leftPct?: number;
    widthPct?: number;
    onEdit: (appt: Appointment) => void;
    onDelete: (id: string, name?: string, scope?: DeleteScope) => void;
    onStatusChange: (appt: Appointment, status: Appointment['status']) => void;
    googleSyncEnabled?: boolean;
}

const resolveDeleteScope = (appt: Appointment): DeleteScope | null => {
    if (!appt.seriesId || !appt.recurrence || appt.recurrence === 'none') {
        return confirm('Excluir?') ? 'single' : null;
    }

    const answer = window.prompt(
        'Este agendamento faz parte de uma série recorrente.\n\nDigite 1 para excluir apenas esta sessão.\nDigite 2 para excluir toda a série.',
        '1'
    );

    if (answer === '1') return 'single';
    if (answer === '2') return 'all';
    return null;
};

const EventBlock: React.FC<EventBlockProps> = ({ appt, profissionais, dayStartMin, leftPct = 0, widthPct = 98, onEdit, onDelete, onStatusChange, googleSyncEnabled = false }) => {
    const color = getProfessionalColor(appt.profissional, profissionais);
    const [showMenu, setShowMenu] = useState(false);

    const startMin = timeToMinutes(appt.time || '00:00');
    const dur = appt.durationMin || 45;
    const top = (startMin - dayStartMin) * PX_PER_MIN;
    const height = Math.max(18, dur * PX_PER_MIN);

    const isCancelled = appt.status === 'Cancelado';
    const isCompleted = appt.status === 'Realizado';

    return (
        <div
            className={`absolute rounded-lg border ${color.border} ${color.bg} ${isCancelled ? 'opacity-50 grayscale' : ''}`}
            style={{ top, height, left: `${leftPct}%`, width: `${widthPct}%` }}
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            title={`${appt.time} • ${appt.patientName} • ${appt.profissional}`}
        >
            <div className={`px-2 py-1 text-[11px] leading-tight ${color.text}`}>
                <div className="flex items-center justify-between gap-2">
                    <div className="font-bold truncate">{(appt.patientName || '').split(' ')[0]}</div>
                    <div className="text-[10px] opacity-80 whitespace-nowrap">{appt.time}</div>
                </div>
                <div className="text-[10px] opacity-70 truncate">{(appt.profissional || '').split(' - ')[0]} • {dur}m</div>
                {appt.seriesId && appt.recurrence && appt.recurrence !== 'none' && <div className="text-[10px] opacity-80 truncate">↻ Série recorrente</div>}
                {isCompleted && <div className="text-[10px] text-green-300 font-bold">Realizado</div>}
                {googleSyncEnabled && (
                    appt.googleEventId
                        ? <div className="text-[9px] font-semibold text-emerald-400 leading-tight">● Sync</div>
                        : <div className="text-[9px] font-semibold text-amber-400 leading-tight">● Pendente</div>
                )}
            </div>

            {showMenu && (
                <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-20 min-w-[140px]">
                    <button onClick={() => { onEdit(appt); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2">
                        <EditIcon className="w-3 h-3" /> Editar
                    </button>
                    {!isCompleted && !isCancelled && (
                        <button onClick={() => { onStatusChange(appt, 'Realizado'); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-xs text-green-400 hover:bg-slate-700 flex items-center gap-2">
                            <CheckIcon className="w-3 h-3" /> Realizado
                        </button>
                    )}
                    {!isCancelled && (
                        <button onClick={() => { onStatusChange(appt, 'Cancelado'); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-xs text-orange-400 hover:bg-slate-700 flex items-center gap-2">
                            <XIcon className="w-3 h-3" /> Cancelar
                        </button>
                    )}
                    <button onClick={() => { const scope = resolveDeleteScope(appt); if (scope) onDelete(appt.id, appt.patientName, scope); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-slate-700 flex items-center gap-2">
                        <TrashIcon className="w-3 h-3" /> Excluir
                    </button>
                </div>
            )}
        </div>
    );
};

// Chip de agendamento para view semanal
interface AppointmentChipProps {
    appt: Appointment;
    profissionais: string[];
    onEdit: (appt: Appointment) => void;
    onDelete: (id: string, name?: string, scope?: DeleteScope) => void;
    onStatusChange: (appt: Appointment, status: Appointment['status']) => void;
}

const AppointmentChip: React.FC<AppointmentChipProps> = ({ appt, profissionais, onEdit, onDelete, onStatusChange }) => {
    const color = getProfessionalColor(appt.profissional, profissionais);
    const [showMenu, setShowMenu] = useState(false);

    const isCancelled = appt.status === 'Cancelado';
    const isCompleted = appt.status === 'Realizado';
    const bgOpacity = isCancelled ? 'opacity-50 line-through grayscale' : isCompleted ? 'border-l-4 border-l-green-500' : '';

    return (
        <div
            className={`relative group text-xs p-1.5 rounded ${color.bg} border ${color.border} ${color.text} cursor-pointer ${bgOpacity}`}
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
        >
            <div className="font-bold flex justify-between items-center gap-1 mb-0.5">
                <span className="truncate">{(appt.patientName || '').split(' ')[0]}</span>
                <span className="text-[9px] opacity-80 whitespace-nowrap">{appt.time || ''}</span>
            </div>
            <div className="text-[10px] opacity-70 truncate">{(appt.profissional || '').split(' - ')[0]}</div>

            {showMenu && (
                <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-20 min-w-[120px]">
                    <button onClick={() => { onEdit(appt); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2">
                        <EditIcon className="w-3 h-3" /> Editar
                    </button>
                    {!isCompleted && !isCancelled && (
                        <button onClick={() => { onStatusChange(appt, 'Realizado'); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-xs text-green-400 hover:bg-slate-700 flex items-center gap-2">
                            <CheckIcon className="w-3 h-3" /> Realizado
                        </button>
                    )}
                    {!isCancelled && (
                        <button onClick={() => { onStatusChange(appt, 'Cancelado'); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-xs text-orange-400 hover:bg-slate-700 flex items-center gap-2">
                            <XIcon className="w-3 h-3" /> Cancelar
                        </button>
                    )}
                    <button onClick={() => { const scope = resolveDeleteScope(appt); if (scope) onDelete(appt.id, appt.patientName, scope); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-slate-700 flex items-center gap-2">
                        <TrashIcon className="w-3 h-3" /> Excluir
                    </button>
                </div>
            )}
        </div>
    );
};

// Card de agendamento para view diária
interface AppointmentCardProps {
    appt: Appointment;
    profissionais: string[];
    onEdit: (appt: Appointment) => void;
    onDelete: (id: string, name?: string, scope?: DeleteScope) => void;
    onStatusChange: (appt: Appointment, status: Appointment['status']) => void;
}

const AppointmentCard: React.FC<AppointmentCardProps> = ({ appt, profissionais, onEdit, onDelete, onStatusChange }) => {
    const color = getProfessionalColor(appt.profissional, profissionais);
    const isCancelled = appt.status === 'Cancelado';
    const isCompleted = appt.status === 'Realizado';

    return (
        <div className={`flex items-center justify-between p-3 rounded-xl ${color.bg} border ${color.border} ${isCancelled ? 'opacity-50 grayscale' : ''}`}>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-white/10 px-1.5 py-0.5 rounded text-white">{appt.time || ''}</span>
                    <h4 className={`font-semibold text-white truncate ${isCancelled ? 'line-through' : ''}`}>{appt.patientName || 'Sem nome'}</h4>
                    <span className="text-[10px] bg-slate-800/50 px-2 py-0.5 rounded text-slate-400">
                        {appt.carteirinha || 'S/ Cart.'}
                    </span>
                    {isCompleted && (
                        <span className="text-[10px] bg-green-900/50 text-green-400 px-2 py-0.5 rounded font-medium">Realizado</span>
                    )}
                    {isCancelled && (
                        <span className="text-[10px] bg-red-900/50 text-red-400 px-2 py-0.5 rounded font-medium">Cancelado</span>
                    )}
                </div>
                <p className={`text-sm ${color?.text || ''}`}>{appt.profissional || ''}</p>
            </div>
            <div className="flex gap-1">
                <button onClick={() => onEdit(appt)} className="p-2 text-slate-400 hover:text-white transition" title="Editar">
                    <EditIcon className="w-4 h-4" />
                </button>
                {!isCompleted && !isCancelled && (
                    <button onClick={() => onStatusChange(appt, 'Realizado')} className="p-2 text-slate-400 hover:text-green-400 transition" title="Marcar Realizado">
                        <CheckIcon className="w-4 h-4" />
                    </button>
                )}
                {!isCancelled && (
                    <button onClick={() => onStatusChange(appt, 'Cancelado')} className="p-2 text-slate-400 hover:text-orange-400 transition" title="Cancelar Consulta">
                        <XIcon className="w-4 h-4" />
                    </button>
                )}
                <button onClick={() => { const scope = resolveDeleteScope(appt); if (scope) onDelete(appt.id, appt.patientName, scope); }} className="p-2 text-slate-400 hover:text-red-400 transition" title="Excluir">
                    <TrashIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};