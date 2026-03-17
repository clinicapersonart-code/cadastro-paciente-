import React, { useState, useMemo, useEffect } from 'react';
import { Appointment, Patient, UserProfile } from '../types';
import { CalendarIcon, PlusIcon, TrashIcon, CheckIcon, EditIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from './icons';
import useLocalStorage from '../hooks/useLocalStorage';

interface AgendaProps {
    patients: Patient[];
    profissionais: string[];
    appointments: Appointment[];
    onAddAppointment: (appt: Appointment) => void;
    onAddBatchAppointments?: (appts: Appointment[]) => void;
    onUpdateAppointment: (appt: Appointment) => void;
    onDeleteAppointment: (id: string, name?: string) => void;
    currentUser?: UserProfile;
}

const TIME_SLOTS = [
    '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
];

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

const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const Agenda: React.FC<AgendaProps> = ({
    patients,
    profissionais,
    appointments,
    onAddAppointment,
    onAddBatchAppointments,
    onUpdateAppointment,
    onDeleteAppointment,
    currentUser
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
    const [showForm, setShowForm] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ date: string, time: string } | null>(null);

    const [formId, setFormId] = useState<string | null>(null);
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [formProfissional, setFormProfissional] = useState('');
    const [formDate, setFormDate] = useState('');
    const [time, setTime] = useState('08:00');
    const [type, setType] = useState<'Convênio' | 'Particular'>('Convênio');
    const [obs, setObs] = useState('');
    const [recurrence, setRecurrence] = useState<'none' | 'weekly' | 'biweekly' | 'monthly'>('none');
    const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>('');

    // Edição: aplicar recorrência na edição
    const [editApplyScope, setEditApplyScope] = useState<'single' | 'future'>('single');
    const [editRecurrence, setEditRecurrence] = useState<'none' | 'weekly' | 'biweekly' | 'monthly'>('none');
    const [cancelModal, setCancelModal] = useState<{ isOpen: boolean; appt: Appointment | null; reason: string }>({ isOpen: false, appt: null, reason: '' });

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

    useEffect(() => {
        if (showForm && !formId) {
            setObs('');
            setRecurrence('none');
            setRecurrenceEndDate('');
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

    const handleSubmit = (e: React.FormEvent) => {
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

        const createAppointmentObj = (dateStr: string, idStr?: string, suffix?: string, index = 0): Appointment => ({
            id: idStr || `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            patientId: patient.id,
            patientName: patient.nome,
            carteirinha: patient.carteirinha,
            profissional: effectiveProfissional,
            date: dateStr,
            time,
            type,
            convenioName: type === 'Convênio' ? patient.convenio : undefined,
            status: 'Agendado',
            obs: suffix ? (obs ? `${obs} (${suffix})` : suffix) : obs
        });

        if (formId) {
            const updatedSingle = createAppointmentObj(formDate, formId);

            // Se o usuário escolheu aplicar para futuros, recalcula toda a sequência existente.
            if (editApplyScope === 'future') {
                const baseProf = (effectiveProfissional || '').split(' - ')[0].trim().toLowerCase();
                const originAppt = appointments.find(a => a.id === formId);
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
                    onUpdateAppointment(updatedSingle);
                    series.filter(a => a.id !== formId).forEach(a => onDeleteAppointment(a.id, a.patientName));
                    closeForm();
                    return;
                }

                const [sy, sm, sd] = updatedSingle.date.split('-').map(Number);
                const start = new Date(sy, sm - 1, sd);

                series.forEach((old, i) => {
                    const nextDate = toISODate(addInterval(start, i, editRecurrence));
                    onUpdateAppointment({
                        ...old,
                        patientId: updatedSingle.patientId,
                        patientName: updatedSingle.patientName,
                        carteirinha: updatedSingle.carteirinha,
                        profissional: updatedSingle.profissional,
                        date: nextDate,
                        time: updatedSingle.time,
                        type: updatedSingle.type,
                        convenioName: updatedSingle.convenioName,
                        obs: updatedSingle.obs
                    });
                });

                closeForm();
                return;
            }

            onUpdateAppointment(updatedSingle);
            closeForm();
            return;
        }

        const newBatch: Appointment[] = [];
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

        if (onAddBatchAppointments) onAddBatchAppointments(newBatch);
        else newBatch.forEach(a => onAddAppointment(a));

        closeForm();
    };

    const closeForm = () => {
        setShowForm(false);
        setFormId(null);
        setSelectedSlot(null);
        setSelectedPatientId('');
        setFormProfissional('');
    };

    const handleEditClick = (appt: Appointment) => {
        setFormId(appt.id);
        setSelectedPatientId(appt.patientId);
        setFormProfissional(appt.profissional);
        setFormDate(appt.date);
        setTime(appt.time);
        setType(appt.type);
        setObs(appt.obs || '');
        setRecurrence('none');
        setEditApplyScope('single');
        setEditRecurrence('none');
        setShowForm(true);
    };

    const getAppointmentsForDay = (date: Date): Appointment[] => {
        const dateStr = formatDateISO(date);
        return filteredAppointments
            .filter(a => a.date === dateStr)
            .filter(a => !filterProfissional || a.profissional === filterProfissional)
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

                        <button
                            onClick={() => setShowForm(true)}
                            className="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition"
                        >
                            <PlusIcon className="w-4 h-4" /> Novo
                        </button>
                    </div>
                </div>

                {/* Legenda de cores dos profissionais */}
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-700/50">
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
                </div>
            </div>

            {/* Calendário */}
            <div className="bg-slate-800/30 border border-slate-700 rounded-2xl overflow-hidden">
                {viewMode === 'week' && (
                    <WeekView
                        weekDays={weekDays}
                        timeSlots={TIME_SLOTS}
                        getAppointmentsForSlot={getAppointmentsForSlot}
                        profissionais={profissionais}
                        onSlotClick={(date, time) => setSelectedSlot({ date: formatDateISO(date), time })}
                        onEditAppointment={handleEditClick}
                        onDeleteAppointment={onDeleteAppointment}
                        onStatusChange={handleStatusChange}
                        isToday={isToday}
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
                        timeSlots={TIME_SLOTS}
                        getAppointmentsForSlot={getAppointmentsForSlot}
                        profissionais={profissionais}
                        onSlotClick={(time) => setSelectedSlot({ date: formatDateISO(currentDate), time })}
                        onEditAppointment={handleEditClick}
                        onDeleteAppointment={onDeleteAppointment}
                        onStatusChange={handleStatusChange}
                    />
                )}
            </div>

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
                            <select required value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white">
                                <option value="">Selecione o paciente...</option>
                                {patients
                                    .filter(p => {
                                        if (currentUser?.role === 'professional' && currentUser?.name) {
                                            const normalizedPro = currentUser.name.toLowerCase().trim();
                                            // Encontra a entrada exata do profissional na lista global
                                            const matchingProEntry = profissionais.find(pr =>
                                                pr.toLowerCase().includes(normalizedPro) ||
                                                normalizedPro.includes(pr.toLowerCase().split(' - ')[0].trim())
                                            );
                                            // Verifica se o paciente tem este profissional vinculado
                                            if (matchingProEntry) {
                                                return p.profissionais?.some(prof => prof === matchingProEntry) ?? false;
                                            }
                                            // Fallback: comparação parcial caso não encontre entrada exata
                                            return p.profissionais?.some(prof =>
                                                prof.toLowerCase().includes(normalizedPro) ||
                                                normalizedPro.includes(prof.toLowerCase().split(' - ')[0].trim())
                                            ) ?? false;
                                        }
                                        return true;
                                    })
                                    .sort((a, b) => a.nome.localeCompare(b.nome))
                                    .map(p => <option key={p.id} value={p.id}>{p.nome} {p.carteirinha ? `(${p.carteirinha})` : ''}</option>)}
                            </select>

                            <div className="grid grid-cols-2 gap-3">
                                <input type="date" required value={formDate} onChange={e => setFormDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white" />
                                <input type="time" required value={time} onChange={e => setTime(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white" />
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

// Componente de Visualização Semanal
interface WeekViewProps {
    weekDays: Date[];
    timeSlots: string[];
    getAppointmentsForSlot: (date: Date, time: string) => Appointment[];
    profissionais: string[];
    onSlotClick: (date: Date, time: string) => void;
    onEditAppointment: (appt: Appointment) => void;
    onDeleteAppointment: (id: string) => void;
    onStatusChange: (appt: Appointment, status: Appointment['status']) => void;
    isToday: (date: Date) => boolean;
}

const WeekView: React.FC<WeekViewProps> = ({
    weekDays, timeSlots, getAppointmentsForSlot, profissionais,
    onSlotClick, onEditAppointment, onDeleteAppointment, onStatusChange, isToday
}) => {
    return (
        <div className="overflow-x-auto">
            <div className="min-w-[800px]">
                {/* Header com dias da semana */}
                <div className="grid grid-cols-8 border-b border-slate-700">
                    <div className="p-3 text-xs text-slate-500 font-medium"></div>
                    {weekDays.map((day, i) => (
                        <div
                            key={i}
                            className={`p-3 text-center border-l border-slate-700 ${isToday(day) ? 'bg-sky-900/20' : ''}`}
                        >
                            <div className="text-xs text-slate-500 font-medium">{WEEKDAY_NAMES[day.getDay()]}</div>
                            <div className={`text-lg font-bold ${isToday(day) ? 'text-sky-400' : 'text-slate-200'}`}>
                                {day.getDate()}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Grid de horários */}
                <div className="max-h-[600px] overflow-y-auto">
                    {timeSlots.map(timeSlot => (
                        <div key={timeSlot} className="grid grid-cols-8 border-b border-slate-700/50">
                            <div className="p-2 text-xs text-slate-500 font-mono text-right pr-3 bg-slate-800/30">
                                {timeSlot}
                            </div>
                            {weekDays.map((day, i) => {
                                const appointments = getAppointmentsForSlot(day, timeSlot);
                                return (
                                    <div
                                        key={i}
                                        onClick={() => appointments.length === 0 && onSlotClick(day, timeSlot)}
                                        className={`min-h-[60px] p-1 border-l border-slate-700/50 ${isToday(day) ? 'bg-sky-900/10' : ''
                                            } ${appointments.length === 0 ? 'hover:bg-slate-700/30 cursor-pointer' : ''}`}
                                    >
                                        {appointments.map(appt => (
                                            <AppointmentChip
                                                key={appt.id}
                                                appt={appt}
                                                profissionais={profissionais}
                                                onEdit={onEditAppointment}
                                                onDelete={onDeleteAppointment}
                                                onStatusChange={onStatusChange}
                                            />
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
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

// Componente de Visualização Diária
interface DayViewProps {
    date: Date;
    timeSlots: string[];
    getAppointmentsForSlot: (date: Date, time: string) => Appointment[];
    profissionais: string[];
    onSlotClick: (time: string) => void;
    onEditAppointment: (appt: Appointment) => void;
    onDeleteAppointment: (id: string) => void;
    onStatusChange: (appt: Appointment, status: Appointment['status']) => void;
}

const DayView: React.FC<DayViewProps> = ({
    date, timeSlots, getAppointmentsForSlot, profissionais,
    onSlotClick, onEditAppointment, onDeleteAppointment, onStatusChange
}) => {
    return (
        <div className="divide-y divide-slate-700/50">
            {timeSlots.map(timeSlot => {
                const appointments = getAppointmentsForSlot(date, timeSlot);
                return (
                    <div key={timeSlot} className="flex">
                        <div className="w-20 p-3 text-sm text-slate-500 font-mono text-right bg-slate-800/30 flex-shrink-0">
                            {timeSlot}
                        </div>
                        <div
                            onClick={() => appointments.length === 0 && onSlotClick(timeSlot)}
                            className={`flex-1 p-2 min-h-[70px] ${appointments.length === 0 ? 'hover:bg-slate-700/30 cursor-pointer' : ''}`}
                        >
                            <div className="grid gap-2">
                                {appointments.map(appt => (
                                    <AppointmentCard
                                        key={appt.id}
                                        appt={appt}
                                        profissionais={profissionais}
                                        onEdit={onEditAppointment}
                                        onDelete={onDeleteAppointment}
                                        onStatusChange={onStatusChange}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// Chip de agendamento para view semanal
interface AppointmentChipProps {
    appt: Appointment;
    profissionais: string[];
    onEdit: (appt: Appointment) => void;
    onDelete: (id: string, name?: string) => void;
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
                    <button onClick={() => { if (confirm('Excluir?')) onDelete(appt.id, appt.patientName); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-slate-700 flex items-center gap-2">
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
    onDelete: (id: string, name?: string) => void;
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
                <button onClick={() => { if (confirm('Excluir?')) onDelete(appt.id, appt.patientName); }} className="p-2 text-slate-400 hover:text-red-400 transition" title="Excluir">
                    <TrashIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};