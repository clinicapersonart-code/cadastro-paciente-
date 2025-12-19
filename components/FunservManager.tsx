import React, { useState, useMemo, useEffect } from 'react';
import { Patient, FunservConfig } from '../types';
import { CheckIcon, RepeatIcon, StarIcon, TrashIcon, CalendarIcon, UserIcon, FileTextIcon } from './icons';

interface FunservManagerProps {
    patients: Patient[];
    onSavePatient: (patient: Patient) => void;
}

interface FunservCardProps {
    patient: Patient;
    onSave: (p: Patient) => void;
}

const PROFESSIONAL_EMAILS: Record<string, string> = {
    'Bruno': 'psi.brunoalx@gmail.com',
    'Drieli': 'guimaraes.drieli@gmail.com',
    'Simone': 'simoneagrela.psico@gmail.com',
    'Geovana': 'georafaeladuarte@gmail.com',
    'Soraia': 'soraiasouzapsicologa@gmail.com'
};

const FunservCard: React.FC<FunservCardProps> = ({ patient, onSave }) => {
    const config = patient.funservConfig || {
        active: true, totalSessions: 10, usedSessions: 0, startDate: '', frequency: '1x Semana', alertEmail: '', history: [],
        numeroAutorizacao: '', dataAutorizacao: ''
    };
    
    const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (!config.alertEmail && patient.profissionais.length > 0) {
            const firstProf = patient.profissionais[0];
            const firstName = firstProf.split(' ')[0];
            const email = PROFESSIONAL_EMAILS[firstName];
            if (email) {
                const newConfig = { ...config, alertEmail: email };
                const timer = setTimeout(() => {
                    onSave({ ...patient, funservConfig: newConfig });
                }, 500);
                return () => clearTimeout(timer);
            }
        }
    }, []);

    const remaining = config.totalSessions - config.usedSessions;
    const progress = Math.min((config.usedSessions / config.totalSessions) * 100, 100);

    const handleConfigChange = (field: keyof FunservConfig, value: any) => {
        const newConfig = { ...config, [field]: value };
        onSave({ ...patient, funservConfig: newConfig, numero_autorizacao: newConfig.numeroAutorizacao, data_autorizacao: newConfig.dataAutorizacao });
    };

    const handleAddSession = () => {
        if (!sessionDate) return alert('Selecione uma data.');
        const [y, m, d] = sessionDate.split('-');
        const formattedDate = `${d}/${m}/${y}`;
        if (config.history.includes(formattedDate)) {
             if(!confirm('Esta data já consta no histórico. Registrar novamente?')) return;
        }
        const newHistory = [formattedDate, ...config.history];
        const newConfig = { ...config, usedSessions: newHistory.length, history: newHistory };
        onSave({ ...patient, funservConfig: newConfig });
    };

    const handleRemoveSession = (dateToRemove: string, index: number) => {
        if(!confirm(`Remover o registro do dia ${dateToRemove}?`)) return;
        const newHistory = [...config.history];
        newHistory.splice(index, 1);
        const newConfig = { ...config, usedSessions: newHistory.length, history: newHistory };
        onSave({ ...patient, funservConfig: newConfig });
    };

    const handleRenewGuia = () => {
        if (!confirm(`Deseja renovar a guia de ${patient.nome}? O histórico e o contador serão zerados.`)) return;
        const newConfig: FunservConfig = {
            ...config,
            usedSessions: 0,
            startDate: new Date().toISOString().split('T')[0],
            history: [],
            numeroAutorizacao: '', // Limpa ao renovar
            dataAutorizacao: ''    // Limpa ao renovar
        };
        onSave({ ...patient, funservConfig: newConfig });
    };

    const handleSendEmail = () => {
        if (!config.alertEmail) return alert('Cadastre um e-mail.');
        const subject = `Solicitação de Nova Guia Funserv - ${patient.nome}`;
        const body = `Olá,\n\nInformamos que restam apenas ${remaining} sessões autorizadas para o(a) paciente ${patient.nome}.\n\nPor favor, realize o pedido de liberação de novas sessões.`;
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(config.alertEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(gmailUrl, '_blank');
    };

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-lg flex flex-col hover:border-teal-500/50 transition relative overflow-hidden group">
            {remaining <= 0 && <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10 uppercase">Esgotada</div>}
            
            <div className="mb-3">
                <h3 className="font-bold text-white text-lg leading-tight">{patient.nome}</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                    <div className="bg-slate-900/60 px-2 py-1 rounded border border-slate-700/50 flex flex-col">
                        <span className="text-[9px] font-bold text-slate-500 uppercase">Carteirinha</span>
                        <span className="text-xs font-mono text-sky-400 font-bold">{patient.carteirinha || 'N/A'}</span>
                    </div>
                    {config.numeroAutorizacao && (
                        <div className="bg-amber-900/20 px-2 py-1 rounded border border-amber-700/30 flex flex-col">
                            <span className="text-[9px] font-bold text-amber-500 uppercase">Autorização</span>
                            <span className="text-xs font-mono text-amber-400 font-bold">{config.numeroAutorizacao}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* SEÇÃO DA EXTENSÃO - DADOS DE AUTORIZAÇÃO */}
            <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 mb-3 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1">
                    <FileTextIcon className="w-3 h-3" /> Dados da Guia (Extensão)
                </p>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Nº Autorização</label>
                        <input 
                            type="text" 
                            placeholder="Ex: 64847"
                            value={config.numeroAutorizacao || ''} 
                            onChange={e => handleConfigChange('numeroAutorizacao', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-amber-500 outline-none font-mono"
                        />
                    </div>
                    <div>
                        <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Data Emissão</label>
                        <input 
                            type="date" 
                            value={config.dataAutorizacao || ''} 
                            onChange={e => handleConfigChange('dataAutorizacao', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-amber-500 outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                    <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Início das Sessões</label>
                    <input 
                        type="date" 
                        value={config.startDate} 
                        onChange={e => handleConfigChange('startDate', e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-teal-500 outline-none"
                    />
                </div>
                <div>
                    <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Frequência</label>
                    <select 
                        value={config.frequency}
                        onChange={e => handleConfigChange('frequency', e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-teal-500 outline-none"
                    >
                        <option>1x Semana</option>
                        <option>2x Semana</option>
                        <option>Quinzenal</option>
                    </select>
                </div>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-3 mb-3 border border-slate-700/50">
                <div className="flex justify-between items-end mb-2">
                    <div>
                        <span className={`text-2xl font-bold ${remaining <= 3 ? 'text-red-400' : 'text-white'}`}>{remaining}</span>
                        <span className="text-xs text-slate-500 ml-1">restantes</span>
                    </div>
                    <div className="text-right">
                        <span className="text-xs text-slate-400">Total: </span>
                        <input type="number" className="bg-transparent w-8 text-right border-b border-slate-600 focus:border-teal-500 outline-none text-slate-200" value={config.totalSessions} onChange={e => handleConfigChange('totalSessions', Number(e.target.value))} />
                    </div>
                </div>
                <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${remaining <= 3 ? 'bg-red-500' : 'bg-teal-500'}`} style={{ width: `${progress}%` }}></div>
                </div>
            </div>

            <div className="mb-3">
                 <div className="flex gap-2">
                     <input 
                        type="date" 
                        value={sessionDate}
                        onChange={(e) => setSessionDate(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white focus:border-teal-500 outline-none"
                     />
                     <button onClick={handleAddSession} className="bg-teal-600 hover:bg-teal-500 text-white px-3 rounded-lg text-xs font-bold transition flex items-center gap-1">
                        <CheckIcon className="w-3 h-3" /> Registrar
                     </button>
                 </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col min-h-[80px] mb-3 bg-slate-900/30 rounded-lg border border-slate-700/30">
                <div className="overflow-y-auto p-2 space-y-1 max-h-[100px] scrollbar-thin scrollbar-thumb-slate-700">
                    {config.history.length === 0 ? (
                        <p className="text-[10px] text-slate-600 text-center py-2">Sem histórico.</p>
                    ) : (
                        config.history.map((date, idx) => (
                            <div key={`${date}-${idx}`} className="flex justify-between items-center text-[10px] text-slate-300 bg-slate-800 px-2 py-1 rounded border border-slate-700/50">
                                <span>{date}</span>
                                <button onClick={() => handleRemoveSession(date, idx)} className="text-slate-500 hover:text-red-400">
                                    <TrashIcon className="w-3 h-3" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="mt-auto pt-3 border-t border-slate-700/50 flex gap-2">
                <button onClick={handleSendEmail} className="flex-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 border border-amber-600/50 py-1.5 rounded-lg text-xs font-medium transition">E-mail</button>
                <button onClick={handleRenewGuia} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1">
                    <RepeatIcon className="w-3 h-3" /> Renovar
                </button>
            </div>
        </div>
    );
};

export const FunservManager: React.FC<FunservManagerProps> = ({ patients, onSavePatient }) => {
    const [selectedProf, setSelectedProf] = useState('');

    const funservPatients = useMemo(() => {
        return patients
            .filter(p => p.convenio === 'Funserv')
            .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [patients]);

    const activeProfessionals = useMemo(() => {
        const profs = new Set<string>();
        funservPatients.forEach(p => p.profissionais.forEach(prof => profs.add(prof)));
        return Array.from(profs).sort();
    }, [funservPatients]);

    const displayedPatients = useMemo(() => {
        if (!selectedProf) return funservPatients;
        return funservPatients.filter(p => p.profissionais.includes(selectedProf));
    }, [funservPatients, selectedProf]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                        <span className="bg-teal-900/50 text-teal-400 p-2 rounded-lg"><StarIcon className="w-5 h-5" /></span>
                        Gestão Funserv & Extensão
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Gerencie autorizações e guias. Os dados em destaque são lidos pela sua extensão.
                    </p>
                </div>

                {activeProfessionals.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6 bg-slate-900/50 p-2 rounded-xl border border-slate-700/50">
                        <button onClick={() => setSelectedProf('')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${!selectedProf ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:bg-slate-800'}`}>Todos</button>
                        {activeProfessionals.map(prof => (
                            <button key={prof} onClick={() => setSelectedProf(prof)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${selectedProf === prof ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:bg-slate-800'}`}>
                                <UserIcon className="w-3 h-3" /> {prof.split(' - ')[0]}
                            </button>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {displayedPatients.map(p => (
                        <FunservCard key={p.id} patient={p} onSave={onSavePatient} />
                    ))}
                </div>
            </div>
        </div>
    );
};