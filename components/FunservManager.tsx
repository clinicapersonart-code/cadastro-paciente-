import React, { useState, useMemo, useEffect } from 'react';
import { Patient, FunservConfig } from '../types';
import { CheckIcon, RepeatIcon, StarIcon, TrashIcon, CalendarIcon, UserIcon, CloudIcon } from './icons';

interface FunservManagerProps {
    patients: Patient[];
    onSavePatient: (patient: Patient) => void;
}

interface FunservCardProps {
    patient: Patient;
    onSave: (p: Patient) => void;
}

// Mapeamento de e-mails dos profissionais para preenchimento automático
const PROFESSIONAL_EMAILS: Record<string, string> = {
    'Bruno': 'psi.brunoalx@gmail.com',
    'Drieli': 'guimaraes.drieli@gmail.com',
    'Simone': 'simoneagrela.psico@gmail.com',
    'Geovana': 'georafaeladuarte@gmail.com',
    'Soraia': 'soraiasouzapsicologa@gmail.com'
};

// Sub-componente para gerenciar o estado local de cada card (input de data)
const FunservCard: React.FC<FunservCardProps> = ({ patient, onSave }) => {
    const config = patient.funservConfig || {
        active: true, totalSessions: 10, usedSessions: 0, startDate: '', frequency: '1x Semana', alertEmail: '', history: []
    };
    
    // Estado local para a data da sessão a ser adicionada
    const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);

    // Efeito para preencher automaticamente o e-mail do profissional se estiver vazio
    useEffect(() => {
        if (!config.alertEmail && patient.profissionais.length > 0) {
            const firstProf = patient.profissionais[0];
            const firstName = firstProf.split(' ')[0]; // Pega o primeiro nome (ex: Bruno, Drieli)
            
            // Verifica mapeamento exato ou pelo primeiro nome
            const email = PROFESSIONAL_EMAILS[firstName];
            
            if (email) {
                // Atualiza a config sem salvar no banco imediatamente para evitar loop, 
                // mas o input refletirá o valor e será salvo na próxima interação.
                // Porém, para garantir que fique salvo, chamamos o onSave.
                // Usamos setTimeout para evitar atualização durante renderização.
                const newConfig = { ...config, alertEmail: email };
                // Pequeno delay para garantir que não colida com renderização inicial
                const timer = setTimeout(() => {
                    onSave({ ...patient, funservConfig: newConfig });
                }, 500);
                return () => clearTimeout(timer);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Executa apenas na montagem do componente

    const remaining = config.totalSessions - config.usedSessions;
    const progress = Math.min((config.usedSessions / config.totalSessions) * 100, 100);

    const calculateEndDate = () => {
        if (!config.startDate || !config.totalSessions) return null;
        const startDate = new Date(config.startDate);
        const sessionsTotal = config.totalSessions; 
        
        let daysToAdd = 0;
        if (config.frequency === '1x Semana') daysToAdd = sessionsTotal * 7;
        else if (config.frequency === '2x Semana') daysToAdd = (sessionsTotal / 2) * 7;
        else if (config.frequency === 'Quinzenal') daysToAdd = sessionsTotal * 14;
        else return null;

        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + daysToAdd);
        return endDate.toLocaleDateString('pt-BR');
    };

    const endDate = calculateEndDate();

    // Lógica de Cores
    let statusColor = 'bg-teal-500';
    if (remaining <= 0) statusColor = 'bg-slate-500';
    else if (remaining <= 3) statusColor = 'bg-red-500';
    else if (remaining <= 6) statusColor = 'bg-amber-500';

    const handleConfigChange = (field: keyof FunservConfig, value: any) => {
        const newConfig = { ...config, [field]: value };
        onSave({ ...patient, funservConfig: newConfig });
    };

    const handleAddSession = () => {
        if (!sessionDate) return alert('Selecione uma data.');
        
        const [y, m, d] = sessionDate.split('-');
        const formattedDate = `${d}/${m}/${y}`;

        if (config.history.includes(formattedDate)) {
             if(!confirm('Esta data já consta no histórico. Registrar novamente?')) return;
        }

        const newHistory = [formattedDate, ...config.history];
        const newUsed = newHistory.length; // Sincroniza usado com histórico

        const newConfig = {
            ...config,
            usedSessions: newUsed,
            history: newHistory
        };

        if (newUsed > config.totalSessions) {
            alert('Atenção: Número de sessões excedeu o autorizado!');
        }

        onSave({ ...patient, funservConfig: newConfig });
    };

    const handleRemoveSession = (dateToRemove: string, index: number) => {
        if(!confirm(`Remover o registro do dia ${dateToRemove}?`)) return;
        
        const newHistory = [...config.history];
        newHistory.splice(index, 1);
        
        const newConfig = {
            ...config,
            usedSessions: newHistory.length,
            history: newHistory
        };
        onSave({ ...patient, funservConfig: newConfig });
    };

    const handleRenewGuia = () => {
        if (!confirm(`Deseja renovar a guia de ${patient.nome}? O histórico e o contador serão zerados.`)) return;
        
        const newConfig: FunservConfig = {
            ...config,
            usedSessions: 0,
            startDate: new Date().toISOString().split('T')[0],
            history: [] // Limpa histórico
        };
        onSave({ ...patient, funservConfig: newConfig });
    };

    const handleSendEmail = () => {
        if (!config.alertEmail) {
            alert('Cadastre um e-mail para este paciente primeiro (no campo abaixo).');
            return;
        }
        const subject = `Solicitação de Nova Guia Funserv - ${patient.nome}`;
        const body = `Olá,\n\nInformamos que restam apenas ${remaining} sessões autorizadas para o(a) paciente ${patient.nome}.\n\nPor favor, realize o pedido de liberação de novas sessões junto ao convênio para darmos continuidade ao tratamento sem interrupções.\n\nAtenciosamente,\nClínica Personart.`;
        
        // Constrói a URL para abrir especificamente o Gmail no navegador
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(config.alertEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        window.open(gmailUrl, '_blank');
    };

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-lg flex flex-col hover:border-teal-500/50 transition relative overflow-hidden group">
            {remaining <= 0 && <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10">ESGOTADA</div>}
            
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="font-bold text-white text-lg leading-tight">{patient.nome}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{patient.profissionais[0] || 'Sem profissional'}</p>
                </div>
            </div>

            {/* Inputs de Configuração */}
            <div className="grid grid-cols-2 gap-2 mb-3 bg-slate-900/30 p-2 rounded-lg">
                <div>
                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Início Guia</label>
                    <input 
                        type="date" 
                        value={config.startDate} 
                        onChange={e => handleConfigChange('startDate', e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-teal-500 outline-none"
                    />
                </div>
                <div>
                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Frequência</label>
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

            {/* Barra de Progresso */}
            <div className="bg-slate-900/50 rounded-lg p-3 mb-3 border border-slate-700/50">
                <div className="flex justify-between items-end mb-2">
                    <div>
                        <span className={`text-2xl font-bold ${remaining <= 3 ? 'text-red-400' : 'text-white'}`}>{remaining}</span>
                        <span className="text-xs text-slate-500 ml-1">restantes</span>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-slate-400">Total: <input type="number" className="bg-transparent w-8 text-right border-b border-slate-600 focus:border-teal-500 outline-none text-slate-200" value={config.totalSessions} onChange={e => handleConfigChange('totalSessions', Number(e.target.value))} /></div>
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

            {/* Área de Registro de Sessão */}
            <div className="mb-3">
                 <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Registrar Presença</label>
                 <div className="flex gap-2">
                     <input 
                        type="date" 
                        value={sessionDate}
                        onChange={(e) => setSessionDate(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white focus:border-teal-500 outline-none"
                     />
                     <button 
                        onClick={handleAddSession}
                        className="bg-teal-600 hover:bg-teal-500 text-white px-3 rounded-lg text-xs font-bold transition flex items-center gap-1"
                     >
                        <CheckIcon className="w-3 h-3" /> Confirmar
                     </button>
                 </div>
            </div>

            {/* Histórico de Sessões */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-[80px] mb-3 bg-slate-900/30 rounded-lg border border-slate-700/30">
                <div className="px-3 py-2 border-b border-slate-700/30 bg-slate-800/50">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" /> Histórico ({config.history.length})
                    </h4>
                </div>
                <div className="overflow-y-auto p-2 space-y-1 max-h-[100px] scrollbar-thin scrollbar-thumb-slate-700">
                    {config.history.length === 0 ? (
                        <p className="text-[10px] text-slate-600 text-center py-2">Nenhuma sessão registrada.</p>
                    ) : (
                        config.history.map((date, idx) => (
                            <div key={`${date}-${idx}`} className="flex justify-between items-center text-xs text-slate-300 bg-slate-800 px-2 py-1 rounded border border-slate-700/50">
                                <span>{date}</span>
                                <button onClick={() => handleRemoveSession(date, idx)} className="text-slate-500 hover:text-red-400">
                                    <TrashIcon className="w-3 h-3" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Ações Rodapé */}
            <div className="mt-auto pt-3 border-t border-slate-700/50 flex flex-col gap-2">
                <div className="flex gap-2">
                    <button 
                        onClick={handleSendEmail}
                        title="Abrir Gmail com alerta"
                        className="flex-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 border border-amber-600/50 py-1.5 rounded-lg text-xs font-medium transition"
                    >
                        Abrir Gmail
                    </button>
                    <button 
                        onClick={handleRenewGuia}
                        title="Renovar Guia (Zerar contador)"
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1"
                    >
                        <RepeatIcon className="w-3 h-3" /> Renovar
                    </button>
                </div>
                
                <div className="flex gap-2">
                    <input 
                        type="email" 
                        placeholder="E-mail destinatário..." 
                        value={config.alertEmail || ''}
                        onChange={e => handleConfigChange('alertEmail', e.target.value)}
                        className="flex-1 bg-transparent border-b border-slate-700 text-xs py-1 text-slate-400 focus:border-teal-500 outline-none"
                    />
                    <button 
                        onClick={handleSendEmail}
                        title="Enviar e-mail para este endereço"
                        className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 rounded-lg transition"
                    >
                        <span className="text-[10px] font-bold">Enviar</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export const FunservManager: React.FC<FunservManagerProps> = ({ patients, onSavePatient }) => {
    const [selectedProf, setSelectedProf] = useState('');

    // Filtra apenas pacientes Funserv
    const funservPatients = useMemo(() => {
        return patients
            .filter(p => p.convenio === 'Funserv')
            .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [patients]);

    // Extrai lista de profissionais que têm pacientes Funserv
    const activeProfessionals = useMemo(() => {
        const profs = new Set<string>();
        funservPatients.forEach(p => {
            p.profissionais.forEach(prof => profs.add(prof));
        });
        return Array.from(profs).sort();
    }, [funservPatients]);

    // Filtra pacientes pelo profissional selecionado
    const displayedPatients = useMemo(() => {
        if (!selectedProf) return funservPatients;
        return funservPatients.filter(p => p.profissionais.includes(selectedProf));
    }, [funservPatients, selectedProf]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                            <span className="bg-teal-900/50 text-teal-400 p-2 rounded-lg"><StarIcon className="w-5 h-5" /></span>
                            Gestão de Guias Funserv
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">
                            Controle de guias, validade e registro de sessões realizadas.
                        </p>
                    </div>
                </div>

                {/* Filtro por Profissional (Abas) */}
                {activeProfessionals.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6 bg-slate-900/50 p-2 rounded-xl border border-slate-700/50">
                        <button 
                            onClick={() => setSelectedProf('')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${!selectedProf ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        >
                            Todos
                        </button>
                        {activeProfessionals.map(prof => (
                            <button 
                                key={prof}
                                onClick={() => setSelectedProf(prof)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${selectedProf === prof ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                            >
                                <UserIcon className="w-3 h-3" />
                                {prof.split(' - ')[0]} {/* Mostra só o nome, sem CRP para economizar espaço */}
                            </button>
                        ))}
                    </div>
                )}

                {displayedPatients.length === 0 ? (
                    <div className="text-center py-12 border border-slate-700 border-dashed rounded-xl bg-slate-900/30">
                        <p className="text-slate-500">
                            {selectedProf 
                                ? `Nenhum paciente Funserv encontrado para ${selectedProf}.` 
                                : 'Nenhum paciente com convênio Funserv cadastrado.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {displayedPatients.map(p => (
                            <FunservCard key={p.id} patient={p} onSave={onSavePatient} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};