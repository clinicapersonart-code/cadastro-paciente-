import React, { useState, useMemo, useEffect } from 'react';
import { Appointment, Patient } from '../types';
import { CalendarIcon, PlusIcon, TrashIcon, ClockIcon, UserIcon, CheckIcon, XIcon, RepeatIcon, EditIcon } from './icons';
import useLocalStorage from '../hooks/useLocalStorage';

interface AgendaProps {
    patients: Patient[];
    profissionais: string[];
    appointments: Appointment[];
    onAddAppointment: (appt: Appointment) => void;
    onAddBatchAppointments?: (appts: Appointment[]) => void; // Nova função para Batch
    onUpdateAppointment: (appt: Appointment) => void;
    onDeleteAppointment: (id: string) => void;
}

const TIME_SLOTS = [
    '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', 
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
];

const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return `hsl(${h}, 70%, 85%)`; 
};

const getDarkerColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return `hsl(${h}, 70%, 30%)`; 
};

export const Agenda: React.FC<AgendaProps> = ({
    patients,
    profissionais,
    appointments,
    onAddAppointment,
    onAddBatchAppointments,
    onUpdateAppointment,
    onDeleteAppointment
}) => {
    const [selectedDate, setSelectedDate] = useLocalStorage<string>('personart.agenda.date', new Date().toISOString().split('T')[0]);
    const [viewMode, setViewMode] = useLocalStorage<'list' | 'grid' | 'weekly'>('personart.agenda.view', 'list');
    
    const [filterProfissional, setFilterProfissional] = useState('');
    const [filterStatus, setFilterStatus] = useState<'Todos' | 'Agendado' | 'Realizado' | 'Cancelado'>('Todos');
    const [showForm, setShowForm] = useState(false);
    
    // Form State
    const [formId, setFormId] = useState<string | null>(null);
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [formProfissional, setFormProfissional] = useState('');
    const [formDate, setFormDate] = useState('');
    const [time, setTime] = useState('08:00');
    const [type, setType] = useState<'Convênio' | 'Particular'>('Convênio');
    const [obs, setObs] = useState('');
    
    // Recurrence State
    const [recurrence, setRecurrence] = useState<'none' | 'weekly' | 'biweekly'>('none');
    const [recurrenceCount, setRecurrenceCount] = useState<number>(4);

    useEffect(() => {
        if (showForm && !formId) {
            setObs('');
            setRecurrence('none');
            setRecurrenceCount(4);
            if(selectedDate) setFormDate(selectedDate);
        }
    }, [showForm, formId, selectedDate]);

    useEffect(() => {
        if (filterProfissional) {
            setFormProfissional(filterProfissional);
        }
    }, [filterProfissional]);

    useEffect(() => {
        if (selectedPatientId && !formId) {
            const p = patients.find(pt => pt.id === selectedPatientId);
            if (p) {
                if (!filterProfissional && p.profissionais.length > 0 && !formProfissional) {
                    setFormProfissional(p.profissionais[0]);
                }
                if (!p.convenio) setType('Particular');
                else setType('Convênio');
            }
        }
    }, [selectedPatientId, patients, filterProfissional, formProfissional, formId]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPatientId || !formProfissional || !time || !formDate) {
            alert('Preencha paciente, profissional, data e horário.');
            return;
        }

        const patient = patients.find(p => p.id === selectedPatientId);
        if (!patient) return;

        // Função de criação de objeto (com ID opcional)
        const createAppointmentObj = (dateStr: string, idStr?: string, suffix?: string): Appointment => ({
            id: idStr || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            patientId: patient.id,
            patientName: patient.nome,
            profissional: formProfissional,
            date: dateStr,
            time,
            type,
            convenioName: type === 'Convênio' ? patient.convenio : undefined,
            status: 'Agendado',
            obs: suffix ? (obs ? `${obs} (${suffix})` : suffix) : obs
        });

        // 1. Edição Simples
        if (formId) {
            const conflict = appointments.find(
                a => a.date === formDate && a.time === time && a.profissional === formProfissional && a.status !== 'Cancelado' && a.id !== formId
            );
            if (conflict) {
                alert('Já existe um agendamento neste horário para este profissional.');
                return;
            }
            onUpdateAppointment(createAppointmentObj(formDate, formId));
            closeForm();
            return;
        }

        // 2. Criação (Única ou Recorrente)
        const newBatch: Appointment[] = [];
        const [y, m, d] = formDate.split('-').map(Number);
        
        // Data base para cálculo (Meio dia para evitar problemas de fuso horário em pt-BR)
        // Mas para manipulação de data simples, usaremos o objeto Date apenas como calculadora de dias
        const currentDateCalculator = new Date(y, m - 1, d); 

        const totalToCreate = (recurrence !== 'none') ? recurrenceCount : 1;
        const intervalDays = recurrence === 'weekly' ? 7 : 14;

        for (let i = 0; i < totalToCreate; i++) {
            // Formata data atual do loop
            const cy = currentDateCalculator.getFullYear();
            const cm = String(currentDateCalculator.getMonth() + 1).padStart(2, '0');
            const cd = String(currentDateCalculator.getDate()).padStart(2, '0');
            const isoDate = `${cy}-${cm}-${cd}`;

            // Checa conflito
            const conflict = appointments.find(
                 a => a.date === isoDate && a.time === time && a.profissional === formProfissional && a.status !== 'Cancelado'
            );

            if (!conflict) {
                const suffix = i > 0 ? `Sessão ${i + 1}` : '';
                newBatch.push(createAppointmentObj(isoDate, undefined, suffix));
            }

            // Avança para a próxima data (se for loop)
            if (recurrence !== 'none') {
                currentDateCalculator.setDate(currentDateCalculator.getDate() + intervalDays);
            }
        }

        if (newBatch.length === 0) {
            alert('Não foi possível agendar (conflito de horário).');
            return;
        }

        if (onAddBatchAppointments) {
            onAddBatchAppointments(newBatch);
        } else {
            // Fallback se a função batch não existir (compatibilidade)
            newBatch.forEach(a => onAddAppointment(a));
        }
        
        closeForm();
    };

    const closeForm = () => {
        setShowForm(false);
        setFormId(null);
        setSelectedPatientId('');
        setObs('');
        setRecurrence('none');
        setRecurrenceCount(4);
        if (!filterProfissional) setFormProfissional('');
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
        setShowForm(true);
    };

    const filteredAppointments = useMemo(() => {
        return appointments
            .filter(a => a.date === selectedDate)
            .filter(a => !filterProfissional || a.profissional.trim() === filterProfissional.trim())
            .filter(a => filterStatus === 'Todos' || a.status === filterStatus)
            .sort((a, b) => a.time.localeCompare(b.time));
    }, [appointments, selectedDate, filterProfissional, filterStatus]);

    const handleNextDay = () => {
        const d = new Date(selectedDate + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    const handlePrevDay = () => {
        const d = new Date(selectedDate + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    const getWeekDays = (centerDateIso: string) => {
        const d = new Date(centerDateIso + 'T00:00:00');
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        
        const week = [];
        for (let i = 0; i < 6; i++) {
            const current = new Date(monday);
            current.setDate(monday.getDate() + i);
            week.push(current.toISOString().split('T')[0]);
        }
        return week;
    };

    const currentWeekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

    const handleNextWeek = () => {
        const d = new Date(selectedDate + 'T00:00:00');
        d.setDate(d.getDate() + 7);
        setSelectedDate(d.toISOString().split('T')[0]);
    }

    const handlePrevWeek = () => {
        const d = new Date(selectedDate + 'T00:00:00');
        d.setDate(d.getDate() - 7);
        setSelectedDate(d.toISOString().split('T')[0]);
    }
    
    const handleStatusChange = (appt: Appointment, newStatus: Appointment['status']) => {
        onUpdateAppointment({ ...appt, status: newStatus });
    };

    const openNewApptModal = (preselectedTime?: string, preselectedDate?: string) => {
        setFormId(null);
        if (preselectedTime) setTime(preselectedTime);
        if (preselectedDate) setFormDate(preselectedDate);
        else setFormDate(selectedDate);
        
        if (filterProfissional) setFormProfissional(filterProfissional);
        setSelectedPatientId('');
        setRecurrence('none');
        setRecurrenceCount(4);
        setShowForm(true);
    };

    const sortedPatients = useMemo(() => [...patients].sort((a, b) => a.nome.localeCompare(b.nome)), [patients]);

    const formatDateDisplay = (iso: string) => {
        const [y, m, d] = iso.split('-');
        const date = new Date(Number(y), Number(m) - 1, Number(d));
        return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    const formatWeekHeader = (iso: string) => {
        const [y, m, d] = iso.split('-');
        const date = new Date(Number(y), Number(m) - 1, Number(d));
        return {
            weekday: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
            day: date.getDate()
        };
    }

    return (
        <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 shadow-lg backdrop-blur-sm flex flex-col gap-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    {viewMode === 'weekly' ? (
                        <div className="flex items-center gap-2">
                            <button onClick={handlePrevWeek} className="p-2 hover:bg-slate-700 rounded-lg transition text-slate-300">❮ Sem</button>
                            <span className="text-slate-300 font-medium text-sm mx-2">
                                Semana de {new Date(currentWeekDays[0] + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </span>
                            <button onClick={handleNextWeek} className="p-2 hover:bg-slate-700 rounded-lg transition text-slate-300">Sem ❯</button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button onClick={handlePrevDay} className="p-2 hover:bg-slate-700 rounded-lg transition text-slate-300">❮</button>
                            <input 
                                type="date" 
                                value={selectedDate} 
                                onChange={(e) => setSelectedDate(e.target.value)} 
                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-sky-500"
                            />
                            <button onClick={handleNextDay} className="p-2 hover:bg-slate-700 rounded-lg transition text-slate-300">❯</button>
                            <span className="text-slate-300 capitalize font-medium ml-2 hidden sm:inline-block">
                                {formatDateDisplay(selectedDate)}
                            </span>
                        </div>
                    )}
                    
                    <button 
                        onClick={() => openNewApptModal()} 
                        className="w-full md:w-auto bg-sky-600 hover:bg-sky-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-sky-900/20"
                    >
                        <PlusIcon className="w-4 h-4" /> Novo Agendamento
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-4 border-t border-slate-700/50 pt-4">
                    <select 
                        value={filterProfissional} 
                        onChange={(e) => setFilterProfissional(e.target.value)}
                        className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                    >
                        <option value="">Todos os profissionais</option>
                        {profissionais.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>

                    <select 
                        value={filterStatus} 
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                    >
                        <option value="Todos">Status: Todos</option>
                        <option value="Agendado">Agendados</option>
                        <option value="Realizado">Realizados</option>
                        <option value="Cancelado">Cancelados</option>
                    </select>

                    <div className="flex bg-slate-900/50 rounded-lg p-1 border border-slate-700 overflow-x-auto">
                        <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap ${viewMode === 'list' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>Lista</button>
                        <button onClick={() => setViewMode('grid')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap ${viewMode === 'grid' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>Grade Dia</button>
                        <button onClick={() => setViewMode('weekly')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap ${viewMode === 'weekly' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>Semanal</button>
                    </div>
                </div>
            </div>

            {viewMode === 'list' && (
                <div className="grid gap-4">
                    {filteredAppointments.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 bg-slate-900/30 rounded-2xl border border-slate-800 border-dashed">
                            <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>Nenhum agendamento encontrado para os filtros selecionados.</p>
                        </div>
                    ) : (
                        filteredAppointments.map(appt => (
                            <AppointmentCard 
                                key={appt.id} 
                                appt={appt} 
                                onStatusChange={handleStatusChange} 
                                onDelete={onDeleteAppointment} 
                                onEdit={handleEditClick}
                            />
                        ))
                    )}
                </div>
            )}

            {viewMode === 'grid' && (
                <div className="space-y-2">
                    {!filterProfissional ? (
                        <div className="p-4 bg-amber-900/20 border border-amber-900/50 rounded-xl text-amber-200 text-center text-sm">
                            Selecione um profissional acima para ver a grade de horários livres detalhada.
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {TIME_SLOTS.map(slotTime => {
                                const slotAppt = filteredAppointments.find(a => a.time === slotTime && a.status !== 'Cancelado');
                                return (
                                    <div key={slotTime} className="flex items-center gap-4">
                                        <div className="w-16 text-right font-mono text-slate-400 text-sm">{slotTime}</div>
                                        <div className="flex-1">
                                            {slotAppt ? (
                                                <AppointmentCard appt={slotAppt} onStatusChange={handleStatusChange} onDelete={onDeleteAppointment} onEdit={handleEditClick} compact />
                                            ) : (
                                                <button 
                                                    onClick={() => openNewApptModal(slotTime)}
                                                    className="w-full h-full min-h-[50px] border border-slate-700 border-dashed rounded-xl flex items-center justify-center text-slate-500 hover:text-sky-400 hover:border-sky-500/50 hover:bg-slate-800/50 transition group"
                                                >
                                                    <span className="text-sm font-medium group-hover:scale-105 transition-transform">+ Livre</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {viewMode === 'weekly' && (
                <div className="overflow-x-auto border border-slate-700 rounded-xl bg-slate-900/30">
                     <table className="w-full min-w-[1000px] border-collapse">
                        <thead>
                            <tr>
                                <th className="p-2 border-b border-r border-slate-700 bg-slate-800/80 text-xs text-slate-400 w-16">Hora</th>
                                {currentWeekDays.map(dateIso => {
                                    const { weekday, day } = formatWeekHeader(dateIso);
                                    const isToday = dateIso === new Date().toISOString().split('T')[0];
                                    return (
                                        <th key={dateIso} className={`p-2 border-b border-r border-slate-700 bg-slate-800/80 ${isToday ? 'bg-sky-900/20 text-sky-300' : 'text-slate-300'}`}>
                                            <div className="text-xs uppercase">{weekday}</div>
                                            <div className="text-lg font-bold">{day}</div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {TIME_SLOTS.map(timeSlot => (
                                <tr key={timeSlot}>
                                    <td className="p-2 border-b border-r border-slate-700 bg-slate-800/50 text-xs font-mono text-slate-400 text-center">{timeSlot}</td>
                                    {currentWeekDays.map(dateIso => {
                                        const slotAppts = appointments.filter(a => 
                                            a.date === dateIso && 
                                            a.time === timeSlot && 
                                            a.status !== 'Cancelado' &&
                                            (!filterProfissional || a.profissional.trim() === filterProfissional.trim()) &&
                                            (filterStatus === 'Todos' || a.status === filterStatus)
                                        );

                                        return (
                                            <td key={`${dateIso}-${timeSlot}`} className="p-1 border-b border-r border-slate-700/50 h-20 align-top relative hover:bg-slate-800/30 transition">
                                                {slotAppts.length === 0 ? (
                                                     <div 
                                                        onClick={() => openNewApptModal(timeSlot, dateIso)}
                                                        className="absolute inset-0 opacity-0 hover:opacity-100 flex items-center justify-center cursor-pointer"
                                                     >
                                                        <PlusIcon className="w-4 h-4 text-slate-500" />
                                                     </div>
                                                ) : (
                                                    <div className="flex flex-col gap-1 overflow-y-auto max-h-[100px]">
                                                        {slotAppts.map(apt => {
                                                            const bgColor = stringToColor(apt.profissional);
                                                            const textColor = getDarkerColor(apt.profissional);
                                                            return (
                                                                <button 
                                                                    key={apt.id}
                                                                    onClick={() => handleEditClick(apt)}
                                                                    className="text-[10px] leading-tight p-1.5 rounded shadow-sm text-left border-l-2 transition hover:scale-[1.02]"
                                                                    style={{ backgroundColor: bgColor, color: textColor, borderColor: textColor }}
                                                                    title={`${apt.time} - ${apt.patientName} com ${apt.profissional}`}
                                                                >
                                                                    <div className="font-bold truncate">{apt.patientName}</div>
                                                                    {!filterProfissional && <div className="truncate opacity-80">{apt.profissional.split(' ')[0]}</div>}
                                                                    {apt.status === 'Realizado' && <div className="text-green-700 font-bold">✓ Realizado</div>}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                     </table>
                </div>
            )}

            {showForm && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-slate-100">{formId ? 'Editar Agendamento' : 'Novo Agendamento'}</h3>
                            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-200"><XIcon className="w-5 h-5" /></button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Paciente</label>
                                <select 
                                    required 
                                    value={selectedPatientId} 
                                    onChange={e => setSelectedPatientId(e.target.value)}
                                    disabled={!!formId}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none disabled:opacity-50"
                                >
                                    <option value="">Selecione o paciente...</option>
                                    {sortedPatients.map(p => (
                                        <option key={p.id} value={p.id}>{p.nome}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Data</label>
                                    <input type="date" required value={formDate} onChange={e => setFormDate(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Horário</label>
                                    <input type="time" required value={time} onChange={e => setTime(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Profissional</label>
                                <select 
                                    required 
                                    value={formProfissional} 
                                    onChange={e => setFormProfissional(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                                >
                                    <option value="">Selecione...</option>
                                    {profissionais.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>

                            <div className="flex gap-4 pt-1">
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="radio" name="type" value="Convênio" checked={type === 'Convênio'} onChange={() => setType('Convênio')} className="form-radio bg-slate-900 text-sky-500" />
                                    Convênio
                                </label>
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="radio" name="type" value="Particular" checked={type === 'Particular'} onChange={() => setType('Particular')} className="form-radio bg-slate-900 text-sky-500" />
                                    Particular
                                </label>
                            </div>
                            
                            {!formId && (
                                <div className="bg-slate-700/30 p-3 rounded-lg border border-slate-700/50">
                                    <label className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-2">
                                        <RepeatIcon className="w-3 h-3 text-sky-400" /> Repetição
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <select value={recurrence} onChange={e => setRecurrence(e.target.value as any)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-sky-500 outline-none">
                                            <option value="none">Não repetir</option>
                                            <option value="weekly">Semanal</option>
                                            <option value="biweekly">Quinzenal</option>
                                        </select>
                                        
                                        {recurrence !== 'none' ? (
                                            <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700 rounded-lg px-2 py-1.5">
                                                <span className="text-[10px] text-slate-400 uppercase font-bold whitespace-nowrap">Qtd:</span>
                                                <input 
                                                    type="number" 
                                                    min="2"
                                                    max="48"
                                                    value={recurrenceCount} 
                                                    onChange={e => setRecurrenceCount(Number(e.target.value))} 
                                                    className="w-full bg-transparent text-sm text-white focus:outline-none text-right font-bold" 
                                                />
                                            </div>
                                        ) : (
                                            <div className="bg-slate-900/20 border border-slate-700/50 rounded-lg px-2 py-1.5 flex items-center justify-center opacity-50">
                                                <span className="text-[10px] text-slate-500">Uma única vez</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Observações</label>
                                <textarea rows={2} value={obs} onChange={e => setObs(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none resize-none" />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2 rounded-lg text-sm transition">Cancelar</button>
                                <button type="submit" className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2 rounded-lg text-sm transition">{formId ? 'Salvar Alterações' : 'Agendar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

interface AppointmentCardProps {
    appt: Appointment;
    onStatusChange: (a: Appointment, s: Appointment['status']) => void;
    onDelete: (id: string) => void;
    onEdit: (appt: Appointment) => void;
    compact?: boolean;
}

const AppointmentCard: React.FC<AppointmentCardProps> = ({ 
    appt, 
    onStatusChange, 
    onDelete, 
    onEdit, 
    compact = false 
}) => {
    const accentColor = stringToColor(appt.profissional);

    return (
        <div className={`relative flex flex-col md:flex-row gap-4 p-4 rounded-xl border transition-all duration-200 ${appt.status === 'Cancelado' ? 'bg-slate-900/30 border-slate-800 opacity-60' : 'bg-slate-800/80 border-slate-700 hover:border-slate-600 shadow-md'}`} style={{ borderLeft: `4px solid ${accentColor}`}}>
            {!compact && (
                <div className="flex md:flex-col items-center md:justify-center gap-2 md:w-24 border-b md:border-b-0 md:border-r border-slate-700/50 pb-2 md:pb-0 md:pr-4">
                    <ClockIcon className="w-4 h-4 text-sky-400" />
                    <span className="text-xl font-bold text-slate-200">{appt.time}</span>
                    <span className="text-[10px] text-slate-500">{appt.date.split('-').reverse().slice(0,2).join('/')}</span>
                </div>
            )}

            <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                    <h3 className={`font-semibold text-lg flex items-center gap-2 ${appt.status === 'Realizado' ? 'text-green-400' : 'text-slate-100'}`}>
                        {appt.patientName}
                        {appt.status === 'Realizado' && <CheckIcon className="w-4 h-4" />}
                    </h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${appt.type === 'Particular' ? 'bg-amber-900/30 text-amber-200 border-amber-800' : 'bg-indigo-900/30 text-indigo-200 border-indigo-800'}`}>
                        {appt.type === 'Convênio' ? (appt.convenioName || 'Convênio') : 'Particular'}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>{appt.profissional}</span>
                </div>
                {appt.obs && <p className="text-xs text-slate-500 italic mt-1">Obs: {appt.obs}</p>}
            </div>

            <div className="flex md:flex-col items-center justify-center gap-2 border-t md:border-t-0 md:border-l border-slate-700/50 pt-2 md:pt-0 md:pl-4">
                 {appt.status !== 'Cancelado' && (
                    <>
                        {appt.status !== 'Realizado' && (
                            <button onClick={() => onStatusChange(appt, 'Realizado')} title="Marcar como realizado" className="p-2 text-slate-400 hover:text-green-400 hover:bg-green-900/20 rounded-lg transition">
                                <CheckIcon className="w-5 h-5" />
                            </button>
                        )}
                        <button onClick={() => onEdit(appt)} title="Editar / Remarcar" className="p-2 text-slate-400 hover:text-sky-400 hover:bg-sky-900/20 rounded-lg transition">
                            <EditIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => onStatusChange(appt, 'Cancelado')} title="Cancelar" className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </>
                )}
                <button onClick={() => onDelete(appt.id)} title="Excluir permanentemente" className="p-2 text-slate-600 hover:text-slate-300 rounded-lg transition">
                    <TrashIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}