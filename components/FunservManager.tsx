import React from 'react';
import { Patient, FunservConfig } from '../types';
import { CheckIcon, RepeatIcon, StarIcon } from './icons';

interface FunservManagerProps {
    patients: Patient[];
    onSavePatient: (patient: Patient) => void;
}

export const FunservManager: React.FC<FunservManagerProps> = ({ patients, onSavePatient }) => {
    // Filter only Funserv patients
    const funservPatients = patients.filter(p => p.convenio === 'Funserv').sort((a, b) => a.nome.localeCompare(b.nome));

    // Logic to calculate estimated end date
    const calculateEndDate = (config: FunservConfig) => {
        if (!config.startDate || !config.totalSessions) return null;
        const startDate = new Date(config.startDate);
        const sessionsRemaining = config.totalSessions; // Assuming calculation starts from start date for total duration
        
        let daysToAdd = 0;
        if (config.frequency === '1x Semana') daysToAdd = sessionsRemaining * 7;
        else if (config.frequency === '2x Semana') daysToAdd = (sessionsRemaining / 2) * 7;
        else if (config.frequency === 'Quinzenal') daysToAdd = sessionsRemaining * 14;
        else return null;

        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + daysToAdd);
        return endDate.toLocaleDateString('pt-BR');
    };

    const handleConfigChange = (patient: Patient, field: keyof FunservConfig, value: any) => {
        const newConfig = { ...patient.funservConfig!, [field]: value };
        onSavePatient({ ...patient, funservConfig: newConfig });
    };

    const handleAddSession = (patient: Patient) => {
        if (!patient.funservConfig) return;
        
        const today = new Date().toLocaleDateString('pt-BR');
        // Prevent accidental double clicks
        if (patient.funservConfig.history.includes(today)) {
             if(!confirm('Já consta uma sessão registrada hoje. Adicionar outra?')) return;
        }

        const newUsed = patient.funservConfig.usedSessions + 1;
        if (newUsed > patient.funservConfig.totalSessions) {
            alert('Atenção: Número de sessões excede o autorizado!');
        }

        const newConfig = {
            ...patient.funservConfig,
            usedSessions: newUsed,
            history: [today, ...patient.funservConfig.history]
        };
        onSavePatient({ ...patient, funservConfig: newConfig });
    };

    const handleRenewGuia = (patient: Patient) => {
        if (!confirm(`Deseja renovar a guia de ${patient.nome}? O contador será zerado.`)) return;
        
        const newConfig: FunservConfig = {
            ...patient.funservConfig!,
            usedSessions: 0,
            startDate: new Date().toISOString().split('T')[0],
            history: []
        };
        onSavePatient({ ...patient, funservConfig: newConfig });
    };

    const handleSendEmail = (patient: Patient) => {
        if (!patient.funservConfig?.alertEmail) {
            alert('Cadastre um e-mail para este paciente primeiro.');
            return;
        }
        const remaining = patient.funservConfig.totalSessions - patient.funservConfig.usedSessions;
        const subject = `Renovação de Guia Funserv - ${patient.nome}`;
        const body = `Olá,\n\nInformamos que restam apenas ${remaining} sessões para o paciente ${patient.nome}.\nFavor providenciar nova guia.\n\nClínica Personart.`;
        window.open(`mailto:${patient.funservConfig.alertEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mb-4">
                    <span className="bg-teal-900/50 text-teal-400 p-2 rounded-lg"><StarIcon className="w-5 h-5" /></span>
                    Gestão de Guias Funserv
                </h2>
                <p className="text-slate-400 text-sm mb-6">
                    Acompanhe o andamento das guias, registre sessões e envie alertas de renovação.
                </p>

                {funservPatients.length === 0 ? (
                    <div className="text-center py-12 border border-slate-700 border-dashed rounded-xl bg-slate-900/30">
                        <p className="text-slate-500">Nenhum paciente com convênio Funserv cadastrado.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {funservPatients.map(p => {
                            const config = p.funservConfig || {
                                active: true, totalSessions: 10, usedSessions: 0, startDate: '', frequency: '1x Semana', alertEmail: '', history: []
                            };
                            const remaining = config.totalSessions - config.usedSessions;
                            const progress = Math.min((config.usedSessions / config.totalSessions) * 100, 100);
                            const endDate = calculateEndDate(config);
                            
                            // Color logic
                            let statusColor = 'bg-teal-500';
                            if (remaining <= 3) statusColor = 'bg-red-500';
                            else if (remaining <= 6) statusColor = 'bg-amber-500';

                            return (
                                <div key={p.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-lg flex flex-col hover:border-teal-500/50 transition relative overflow-hidden">
                                    {remaining <= 0 && <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">ESGOTADA</div>}
                                    
                                    <h3 className="font-bold text-white text-lg mb-1">{p.nome}</h3>
                                    <p className="text-xs text-slate-400 mb-4">{p.profissionais[0] || 'Sem profissional'}</p>

                                    {/* Config inputs */}
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        <div>
                                            <label className="text-[10px] text-slate-500 uppercase font-bold">Início Guia</label>
                                            <input 
                                                type="date" 
                                                value={config.startDate} 
                                                onChange={e => handleConfigChange(p, 'startDate', e.target.value)}
                                                className="w-full bg-slate-900/50 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 uppercase font-bold">Frequência</label>
                                            <select 
                                                value={config.frequency}
                                                onChange={e => handleConfigChange(p, 'frequency', e.target.value)}
                                                className="w-full bg-slate-900/50 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                                            >
                                                <option>1x Semana</option>
                                                <option>2x Semana</option>
                                                <option>Quinzenal</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
                                        <div className="flex justify-between items-end mb-2">
                                            <div>
                                                <span className="text-2xl font-bold text-white">{remaining}</span>
                                                <span className="text-xs text-slate-500 ml-1">restantes</span>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-slate-400">Total: <input type="number" className="bg-transparent w-8 text-right border-b border-slate-600 focus:border-teal-500 outline-none" value={config.totalSessions} onChange={e => handleConfigChange(p, 'totalSessions', Number(e.target.value))} /></div>
                                            </div>
                                        </div>
                                        <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                                            <div className={`h-full transition-all duration-500 ${statusColor}`} style={{ width: `${progress}%` }}></div>
                                        </div>
                                        {endDate && (
                                            <p className="text-[10px] text-center mt-2 text-slate-500">
                                                Previsão de término: <span className="text-slate-300">{endDate}</span>
                                            </p>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="mt-auto space-y-2">
                                        <button 
                                            onClick={() => handleAddSession(p)}
                                            className="w-full bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition"
                                        >
                                            <CheckIcon className="w-4 h-4" /> Registrar Sessão
                                        </button>
                                        
                                        <div className="flex gap-2">
                                            {remaining <= 6 && (
                                                <button 
                                                    onClick={() => handleSendEmail(p)}
                                                    title="Enviar e-mail de alerta"
                                                    className="flex-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 border border-amber-600/50 py-1.5 rounded-lg text-xs font-medium transition"
                                                >
                                                    Enviar Alerta
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => handleRenewGuia(p)}
                                                title="Renovar Guia (Zerar contador)"
                                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1"
                                            >
                                                <RepeatIcon className="w-3 h-3" /> Renovar
                                            </button>
                                        </div>
                                        
                                        <div className="mt-2">
                                             <input 
                                                type="email" 
                                                placeholder="E-mail para alerta..." 
                                                value={config.alertEmail || ''}
                                                onChange={e => handleConfigChange(p, 'alertEmail', e.target.value)}
                                                className="w-full bg-transparent border-b border-slate-700 text-xs py-1 text-slate-400 focus:border-teal-500 outline-none"
                                             />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};