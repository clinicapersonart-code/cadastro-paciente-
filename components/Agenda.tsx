
import React, { useState, useMemo, useEffect } from 'react';
import { Appointment, Patient } from '../types';
import { CalendarIcon, PlusIcon, TrashIcon, ClockIcon, UserIcon, CheckIcon, XIcon } from './icons';

interface AgendaProps {
    patients: Patient[];
    profissionais: string[];
    appointments: Appointment[];
    onAddAppointment: (appt: Appointment) => void;
    onUpdateAppointment: (appt: Appointment) => void;
    onDeleteAppointment: (id: string) => void;
}

export const Agenda: React.FC<AgendaProps> = ({
    patients,
    profissionais,
    appointments,
    onAddAppointment,
    onUpdateAppointment,
    onDeleteAppointment
}) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [showForm, setShowForm] = useState(false);
    
    // Form State
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [selectedProfissional, setSelectedProfissional] = useState('');
    const [time, setTime] = useState('08:00');
    const [type, setType] = useState<'Convênio' | 'Particular'>('Convênio');
    const [obs, setObs] = useState('');

    // Reset form when opening
    useEffect(() => {
        if (showForm) {
            setObs('');
            // Don't reset date/time aggressively to allow user flow
        }
    }, [showForm]);

    // Auto-fill professional/type when patient is selected
    useEffect(() => {
        if (selectedPatientId) {
            const p = patients.find(pt => pt.id === selectedPatientId);
            if (p) {
                if (p.profissionais.length > 0) setSelectedProfissional(p.profissionais[0]);
                if (!p.convenio) setType('Particular');
                else setType('Convênio');
            }
        }
    }, [selectedPatientId, patients]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPatientId || !selectedProfissional || !time) {
            alert('Preencha paciente, profissional e horário.');
            return;
        }

        const patient = patients.find(p => p.id === selectedPatientId);
        if (!patient) return;

        const newAppt: Appointment = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            patientId: patient.id,
            patientName: patient.nome,
            profissional: selectedProfissional,
            date: selectedDate,
            time,
            type,
            convenioName: type === 'Convênio' ? patient.convenio : undefined,
            status: 'Agendado',
            obs
        };

        onAddAppointment(newAppt);
        setShowForm(false);
        setSelectedPatientId('');
        setObs('');
    };

    const sortedAppointments = useMemo(() => {
        return appointments
            .filter(a => a.date === selectedDate)
            .sort((a, b) => a.time.localeCompare(b.time));
    }, [appointments, selectedDate]);

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
    
    const handleStatusChange = (appt: Appointment, newStatus: Appointment['status']) => {
        onUpdateAppointment({ ...appt, status: newStatus });
    };

    // Sort patients alphabetically for dropdown
    const sortedPatients = useMemo(() => [...patients].sort((a, b) => a.nome.localeCompare(b.nome)), [patients]);

    const formatDateDisplay = (iso: string) => {
        const [y, m, d] = iso.split('-');
        const date = new Date(Number(y), Number(m) - 1, Number(d));
        return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    return (
        <div className="space-y-6">
            {/* Header & Controls */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 shadow-lg backdrop-blur-sm flex flex-col md:flex-row items-center justify-between gap-4">
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
                
                <button 
                    onClick={() => setShowForm(true)} 
                    className="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition flex items-center gap-2 shadow-lg shadow-sky-900/20"
                >
                    <PlusIcon className="w-4 h-4" /> Novo Agendamento
                </button>
            </div>

            {/* List */}
            <div className="grid gap-4">
                {sortedAppointments.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 bg-slate-900/30 rounded-2xl border border-slate-800 border-dashed">
                        <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>Nenhum agendamento para este dia.</p>
                    </div>
                ) : (
                    sortedAppointments.map(appt => (
                        <div key={appt.id} className={`relative flex flex-col md:flex-row gap-4 p-4 rounded-xl border transition-all duration-200 ${appt.status === 'Cancelado' ? 'bg-slate-900/30 border-slate-800 opacity-60' : 'bg-slate-800/80 border-slate-700 hover:border-slate-600 shadow-md'}`}>
                            {/* Time Column */}
                            <div className="flex md:flex-col items-center md:justify-center gap-2 md:w-24 border-b md:border-b-0 md:border-r border-slate-700/50 pb-2 md:pb-0 md:pr-4">
                                <ClockIcon className="w-4 h-4 text-sky-400" />
                                <span className="text-xl font-bold text-slate-200">{appt.time}</span>
                            </div>

                            {/* Info Column */}
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

                            {/* Actions */}
                            <div className="flex md:flex-col items-center justify-center gap-2 border-t md:border-t-0 md:border-l border-slate-700/50 pt-2 md:pt-0 md:pl-4">
                                {appt.status !== 'Cancelado' && (
                                    <>
                                        {appt.status !== 'Realizado' && (
                                            <button onClick={() => handleStatusChange(appt, 'Realizado')} title="Marcar como realizado" className="p-2 text-slate-400 hover:text-green-400 hover:bg-green-900/20 rounded-lg transition">
                                                <CheckIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                        <button onClick={() => handleStatusChange(appt, 'Cancelado')} title="Cancelar" className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition">
                                            <XIcon className="w-5 h-5" />
                                        </button>
                                    </>
                                )}
                                <button onClick={() => onDeleteAppointment(appt.id)} title="Excluir permanentemente" className="p-2 text-slate-600 hover:text-slate-300 rounded-lg transition">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal Form */}
            {showForm && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-slate-100 mb-4">Novo Agendamento</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Paciente</label>
                                <select 
                                    required 
                                    value={selectedPatientId} 
                                    onChange={e => setSelectedPatientId(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
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
                                    <input type="date" required value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none" />
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
                                    value={selectedProfissional} 
                                    onChange={e => setSelectedProfissional(e.target.value)}
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

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Observações</label>
                                <textarea rows={2} value={obs} onChange={e => setObs(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none resize-none" />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2 rounded-lg text-sm transition">Cancelar</button>
                                <button type="submit" className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2 rounded-lg text-sm transition">Agendar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
