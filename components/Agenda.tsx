import React, { useState, useMemo, useEffect } from 'react';
import { Appointment, Patient } from '../types';
import { CalendarIcon, PlusIcon, TrashIcon, ClockIcon, UserIcon, CheckIcon, XIcon, RepeatIcon, EditIcon } from './icons';
import useLocalStorage from '../hooks/useLocalStorage';

interface AgendaProps {
    patients: Patient[];
    profissionais: string[];
    appointments: Appointment[];
    onAddAppointment: (appt: Appointment) => void;
    onAddBatchAppointments?: (appts: Appointment[]) => void; 
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
    
    const [formId, setFormId] = useState<string | null>(null);
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [formProfissional, setFormProfissional] = useState('');
    const [formDate, setFormDate] = useState('');
    const [time, setTime] = useState('08:00');
    const [type, setType] = useState<'Convênio' | 'Particular'>('Convênio');
    const [obs, setObs] = useState('');
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPatientId || !formProfissional || !time || !formDate) {
            alert('Preencha os campos obrigatórios.');
            return;
        }

        const patient = patients.find(p => p.id === selectedPatientId);
        if (!patient) return;

        const createAppointmentObj = (dateStr: string, idStr?: string, suffix?: string, index = 0): Appointment => ({
            id: idStr || `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            patientId: patient.id,
            patientName: patient.nome,
            carteirinha: patient.carteirinha, // CARTEIRINHA PARA A EXTENSÃO
            profissional: formProfissional,
            date: dateStr,
            time,
            type,
            convenioName: type === 'Convênio' ? patient.convenio : undefined,
            status: 'Agendado',
            obs: suffix ? (obs ? `${obs} (${suffix})` : suffix) : obs
        });

        if (formId) {
            onUpdateAppointment(createAppointmentObj(formDate, formId));
            setShowForm(false);
            return;
        }

        const newBatch: Appointment[] = [];
        const [y, m, d] = formDate.split('-').map(Number);
        const currentDateCalculator = new Date(y, m - 1, d); 
        const totalToCreate = (recurrence !== 'none') ? recurrenceCount : 1;
        const intervalDays = recurrence === 'weekly' ? 7 : 14;

        for (let i = 0; i < totalToCreate; i++) {
            const cy = currentDateCalculator.getFullYear();
            const cm = String(currentDateCalculator.getMonth() + 1).padStart(2, '0');
            const cd = String(currentDateCalculator.getDate()).padStart(2, '0');
            const isoDate = `${cy}-${cm}-${cd}`;

            const suffix = i > 0 ? `Sessão ${i + 1}` : '';
            newBatch.push(createAppointmentObj(isoDate, undefined, suffix, i));

            if (recurrence !== 'none') {
                currentDateCalculator.setDate(currentDateCalculator.getDate() + intervalDays);
            }
        }

        if (onAddBatchAppointments) onAddBatchAppointments(newBatch);
        else newBatch.forEach(a => onAddAppointment(a));
        
        setShowForm(false);
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

    return (
        <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 shadow-lg flex flex-col gap-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <button onClick={handlePrevDay} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300">❮</button>
                        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none" />
                        <button onClick={handleNextDay} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300">❯</button>
                    </div>
                    <button onClick={() => setShowForm(true)} className="w-full md:w-auto bg-sky-600 hover:bg-sky-500 text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-2">
                        <PlusIcon className="w-4 h-4" /> Novo Agendamento
                    </button>
                </div>
                <div className="flex flex-col md:flex-row gap-4 border-t border-slate-700/50 pt-4">
                    <select value={filterProfissional} onChange={(e) => setFilterProfissional(e.target.value)} className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none">
                        <option value="">Todos os profissionais</option>
                        {profissionais.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid gap-4">
                {filteredAppointments.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 bg-slate-900/30 rounded-2xl border border-slate-800 border-dashed">Nenhum agendamento hoje.</div>
                ) : (
                    filteredAppointments.map(appt => (
                        <AppointmentCard key={appt.id} appt={appt} onStatusChange={(a, s) => onUpdateAppointment({...a, status: s})} onDelete={onDeleteAppointment} onEdit={handleEditClick} />
                    ))
                )}
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">Agendar</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <select required value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                                <option value="">Selecione o paciente...</option>
                                {patients.sort((a,b)=>a.nome.localeCompare(b.nome)).map(p => <option key={p.id} value={p.id}>{p.nome} {p.carteirinha ? `(${p.carteirinha})` : ''}</option>)}
                            </select>
                            <input type="date" required value={formDate} onChange={e => setFormDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                            <input type="time" required value={time} onChange={e => setTime(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                            <select required value={formProfissional} onChange={e => setFormProfissional(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                                <option value="">Selecione o profissional...</option>
                                {profissionais.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-slate-700 text-slate-200 py-2 rounded-lg">Cancelar</button>
                                <button type="submit" className="flex-1 bg-sky-600 text-white font-bold py-2 rounded-lg">Salvar</button>
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

const AppointmentCard: React.FC<AppointmentCardProps> = ({ appt, onStatusChange, onDelete, onEdit }) => {
    const accentColor = stringToColor(appt.profissional);
    return (
        <div className="flex flex-col md:flex-row gap-4 p-4 rounded-xl border bg-slate-800/80 border-slate-700" style={{ borderLeft: `4px solid ${accentColor}`}}>
            <div className="flex-1">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg text-white">{appt.patientName}</h3>
                    <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-sky-400 font-mono">{appt.carteirinha || 'S/ Carteirinha'}</span>
                </div>
                <p className="text-sm text-slate-400">{appt.time} - {appt.profissional}</p>
            </div>
            <div className="flex gap-2 items-center">
                <button onClick={() => onEdit(appt)} className="text-sky-400 p-2"><EditIcon className="w-5 h-5" /></button>
                <button onClick={() => onStatusChange(appt, 'Realizado')} className="text-green-400 p-2"><CheckIcon className="w-5 h-5" /></button>
                <button onClick={() => onDelete(appt.id)} className="text-red-400 p-2"><TrashIcon className="w-5 h-5" /></button>
            </div>
        </div>
    );
}