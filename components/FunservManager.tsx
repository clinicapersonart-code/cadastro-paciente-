import React, { useState, useMemo, useEffect } from 'react';
import { Patient, FunservConfig } from '../types';
import { CheckIcon, StarIcon, TrashIcon, FileTextIcon, PlusIcon } from './icons';

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

        if (field === 'startDate') {
            newConfig.dataAutorizacao = value;
        }

        onSave({
            ...patient,
            funservConfig: newConfig,
            numero_autorizacao: newConfig.numeroAutorizacao,
            data_autorizacao: newConfig.dataAutorizacao || newConfig.startDate
        });
    };

    const handleAddSession = () => {
        if (!config.startDate) return alert('Preencha a Data da Guia/Sessão.');

        const [y, m, d] = config.startDate.split('-');
        const formattedDate = `${d}/${m}/${y}`;

        // Inclui o número da autorização no registro do histórico
        const authSuffix = config.numeroAutorizacao ? ` (Aut: ${config.numeroAutorizacao})` : '';
        const historyEntry = `${formattedDate}${authSuffix}`;

        // Verifica duplicidade básica pela data
        if (config.history.some(h => h.includes(formattedDate))) {
            if (!confirm('Esta data já consta no histórico deste paciente. Registrar novamente?')) return;
        }

        const newHistory = [historyEntry, ...config.history];
        const newConfig = { ...config, usedSessions: newHistory.length, history: newHistory };
        onSave({ ...patient, funservConfig: newConfig });
    };

    const handleRemoveSession = (itemToRemove: string, index: number) => {
        if (!confirm(`Remover o registro "${itemToRemove}"?`)) return;
        const newHistory = [...config.history];
        newHistory.splice(index, 1);
        const newConfig = { ...config, usedSessions: newHistory.length, history: newHistory };
        onSave({ ...patient, funservConfig: newConfig });
    };

    const handleResetSessions = () => {
        if (!confirm(`Tem certeza que deseja reiniciar as guias de ${patient.nome}?\n\nIsso irá:\n• Zerar o contador de sessões usadas\n• Limpar o histórico anterior\n• Manter as configurações (frequência, total permitido)`)) return;

        const newConfig = {
            ...config,
            usedSessions: 0,
            history: [],
            numeroAutorizacao: '', // Limpa número da autorização anterior
            startDate: '' // Limpa a data
        };
        onSave({ ...patient, funservConfig: newConfig });
    };

    const handleSendEmail = () => {
        if (!config.alertEmail) return alert('Cadastre um e-mail.');
        const subject = `Solicitação de Nova Guia Funserv - ${patient.nome}`;
        const body = `Olá,\n\nInformamos que restam apenas ${remaining} sessões autorizadas para o(a) paciente ${patient.nome} referente à guia nº ${config.numeroAutorizacao || '________'}.\n\nPor favor, realize o pedido de liberação de novas sessões.`;
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(config.alertEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(gmailUrl, '_blank');
    };

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-lg flex flex-col hover:border-teal-500/50 transition relative overflow-hidden group">
            {remaining <= 0 && <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10 uppercase">Esgotada</div>}

            <div className="mb-3 flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-white text-lg leading-tight">{patient.nome}</h3>
                    <div className="mt-1">
                        <span className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                            Cart: <strong className="text-sky-400 font-mono">{patient.carteirinha || '?'}</strong>
                        </span>
                    </div>
                </div>
            </div>

            {/* SEÇÃO CONTROLE (Agora acima da Guia) */}
            <div className="grid grid-cols-2 gap-2 mb-2 bg-slate-900/30 p-2 rounded-lg">
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
                <div>
                    <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Total Permitido</label>
                    <input
                        type="number"
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-teal-500 outline-none"
                        value={config.totalSessions}
                        onChange={e => handleConfigChange('totalSessions', Number(e.target.value))}
                    />
                </div>
            </div>

            {/* GUIA VIGENTE */}
            <div className="bg-teal-900/10 p-3 rounded-lg border border-teal-500/30 mb-4 relative">
                <div className="absolute -top-2.5 left-2 bg-slate-800 px-2">
                    <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1">
                        <FileTextIcon className="w-3 h-3" /> Guia Atual
                    </span>
                </div>

                <div className="flex gap-2 mt-1">
                    {/* Número da Autorização */}
                    <div className="flex-1">
                        <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Nº Autorização</label>
                        <input
                            type="text"
                            placeholder="Nº Guia"
                            value={config.numeroAutorizacao || ''}
                            onChange={e => handleConfigChange('numeroAutorizacao', e.target.value)}
                            className="w-full bg-slate-900 border border-teal-500/50 rounded-l px-2 py-2 text-sm text-white font-bold focus:ring-1 focus:ring-teal-500 outline-none font-mono tracking-wide"
                        />
                    </div>

                    {/* Data Única (Serve para Guia e Sessão) */}
                    <div className="w-32 sm:w-40">
                        <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Data</label>
                        <input
                            type="date"
                            value={config.startDate}
                            onChange={e => handleConfigChange('startDate', e.target.value)}
                            className="w-full bg-slate-900 border border-teal-500/50 rounded-r px-2 py-2 text-sm text-white focus:ring-1 focus:ring-teal-500 outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-2 mb-3 border border-slate-700/50">
                <div className="flex justify-between items-end mb-1">
                    <div>
                        <span className={`text-xl font-bold ${remaining <= 3 ? 'text-red-400' : 'text-white'}`}>{remaining}</span>
                        <span className="text-[10px] text-slate-500 ml-1">sessões restantes</span>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] text-slate-400">{config.usedSessions} realizadas</span>
                    </div>
                </div>
                <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${remaining <= 3 ? 'bg-red-500' : 'bg-teal-500'}`} style={{ width: `${progress}%` }}></div>
                </div>
            </div>

            <div className="mb-4 space-y-2">
                <button onClick={handleAddSession} className="w-full bg-teal-600 hover:bg-teal-500 text-white px-3 py-3 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-teal-900/20 uppercase tracking-wide">
                    <CheckIcon className="w-4 h-4" /> Registrar Guia & Sessão
                </button>

                {/* Botão Reiniciar - aparece quando esgotado ou tem histórico */}
                {(remaining <= 0 || config.history.length > 0) && (
                    <button
                        onClick={handleResetSessions}
                        className="w-full bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-600/50 px-3 py-2 rounded-lg text-xs transition flex items-center justify-center gap-2"
                    >
                        🔄 Reiniciar Ciclo de Guias
                    </button>
                )}
            </div>

            <div className="mt-auto space-y-2">

                {config.usedSessions > 8 && (
                    <button
                        onClick={handleSendEmail}
                        className="w-full bg-amber-600/20 hover:bg-amber-600/30 text-amber-500 border border-amber-600/50 px-3 py-2 rounded-lg text-xs transition flex items-center justify-center gap-2"
                    >
                        Solicitar Autorização (Email)
                    </button>
                )}

                {config.history.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-700">
                        <p className="text-[10px] text-slate-500 mb-1">Histórico (Data e Nº Guia):</p>
                        <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                            {config.history.map((item, idx) => (
                                <div key={idx} className="bg-slate-900 text-slate-400 text-[10px] px-2 py-1 rounded border border-slate-700 flex items-center justify-between group hover:border-slate-600">
                                    <span>{item}</span>
                                    <button onClick={() => handleRemoveSession(item, idx)} className="hover:text-red-400"><TrashIcon className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const FunservManager: React.FC<FunservManagerProps> = ({ patients, onSavePatient }) => {
    const funservPatients = useMemo(() => {
        return patients.filter(p => p.convenio === 'Funserv').sort((a, b) => a.nome.localeCompare(b.nome));
    }, [patients]);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProfessional, setSelectedProfessional] = useState<string>(''); // Filtro por profissional
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set()); // Grupos recolhidos

    // Lista de profissionais disponíveis para o filtro
    const availableProfessionals = useMemo(() => {
        const profs = new Set<string>();
        funservPatients.forEach(p => {
            const prof = p.profissionais?.[0];
            if (prof) profs.add(prof);
        });
        return Array.from(profs).sort((a, b) => {
            const order = Object.keys(PROFESSIONAL_EMAILS);
            const indexA = order.findIndex(p => a.toLowerCase().includes(p.toLowerCase()));
            const indexB = order.findIndex(p => b.toLowerCase().includes(p.toLowerCase()));
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
    }, [funservPatients]);

    // Filtra por busca e por profissional selecionado
    const filtered = funservPatients.filter(p => {
        const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProfessional = !selectedProfessional ||
            (p.profissionais?.[0] || '').toLowerCase().includes(selectedProfessional.toLowerCase());
        return matchesSearch && matchesProfessional;
    });

    // Agrupa pacientes por profissional
    const groupedByProfessional = useMemo(() => {
        const groups: Record<string, typeof filtered> = {};
        const professionalOrder = Object.keys(PROFESSIONAL_EMAILS); // Bruno, Drieli, Simone, Geovana, Soraia

        filtered.forEach(patient => {
            const professional = patient.profissionais?.[0] || 'Sem Profissional Definido';
            if (!groups[professional]) {
                groups[professional] = [];
            }
            groups[professional].push(patient);
        });

        // Ordena as chaves: primeiro os profissionais conhecidos, depois os outros
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            const indexA = professionalOrder.findIndex(p => a.toLowerCase().includes(p.toLowerCase()));
            const indexB = professionalOrder.findIndex(p => b.toLowerCase().includes(p.toLowerCase()));

            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        return { groups, sortedKeys };
    }, [filtered]);

    // Toggle para expandir/recolher grupo
    const toggleGroup = (professional: string) => {
        setCollapsedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(professional)) {
                newSet.delete(professional);
            } else {
                newSet.add(professional);
            }
            return newSet;
        });
    };

    // Expande ou recolhe todos
    const expandAll = () => setCollapsedGroups(new Set());
    const collapseAll = () => setCollapsedGroups(new Set(groupedByProfessional.sortedKeys));

    return (
        <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <StarIcon className="w-6 h-6 text-teal-400" /> Gestão Funserv
                        </h2>
                        <p className="text-slate-400 text-sm">Controle de sessões, guias e renovações.</p>
                    </div>
                    <div className="w-full md:w-auto flex flex-col sm:flex-row gap-2">
                        {/* Filtro por profissional */}
                        <select
                            value={selectedProfessional}
                            onChange={e => setSelectedProfessional(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-teal-500 outline-none"
                        >
                            <option value="">Todos os Profissionais</option>
                            {availableProfessionals.map(prof => (
                                <option key={prof} value={prof}>{prof}</option>
                            ))}
                        </select>

                        {/* Busca */}
                        <input
                            type="text"
                            placeholder="Buscar paciente..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full md:w-48 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                    </div>
                </div>

                {/* Botões expandir/recolher todos */}
                {groupedByProfessional.sortedKeys.length > 1 && (
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={expandAll}
                            className="text-xs text-slate-400 hover:text-teal-400 transition"
                        >
                            ▼ Expandir todos
                        </button>
                        <span className="text-slate-600">|</span>
                        <button
                            onClick={collapseAll}
                            className="text-xs text-slate-400 hover:text-teal-400 transition"
                        >
                            ▶ Recolher todos
                        </button>
                    </div>
                )}

                {filtered.length === 0 ? (
                    <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700 border-dashed">
                        <p className="text-slate-500">Nenhum paciente Funserv encontrado.</p>
                        <p className="text-xs text-slate-600 mt-1">Certifique-se de cadastrar o paciente com o convênio "Funserv" na aba de Pacientes.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {groupedByProfessional.sortedKeys.map(professional => {
                            const isCollapsed = collapsedGroups.has(professional);
                            const patientCount = groupedByProfessional.groups[professional].length;

                            return (
                                <div key={professional} className="bg-slate-900/30 rounded-xl border border-slate-700/50 overflow-hidden">
                                    {/* Header do grupo - clicável */}
                                    <button
                                        onClick={() => toggleGroup(professional)}
                                        className="w-full flex items-center gap-3 p-3 hover:bg-slate-800/50 transition cursor-pointer"
                                    >
                                        {/* Setinha */}
                                        <span className={`text-teal-400 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}>
                                            ▶
                                        </span>

                                        <div className="w-8 h-8 bg-teal-600/20 rounded-full flex items-center justify-center">
                                            <span className="text-teal-400 text-sm font-bold">
                                                {professional.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-semibold text-white flex-1 text-left">{professional}</h3>
                                        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                                            {patientCount} paciente{patientCount !== 1 ? 's' : ''}
                                        </span>
                                    </button>

                                    {/* Conteúdo do grupo - cards dos pacientes */}
                                    {!isCollapsed && (
                                        <div className="p-4 pt-0">
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                                {groupedByProfessional.groups[professional].map(patient => (
                                                    <FunservCard key={patient.id} patient={patient} onSave={onSavePatient} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
