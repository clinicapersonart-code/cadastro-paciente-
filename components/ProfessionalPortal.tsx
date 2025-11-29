
import React, { useState, useMemo } from 'react';
import { Patient, Evolution } from '../types';
import { UserIcon, ClockIcon, CheckIcon, PlusIcon, CalendarIcon, CloudDownloadIcon, LockIcon } from './icons';

interface ProfessionalPortalProps {
    patients: Patient[];
    profissionais: string[];
    brandName: string;
    brandColor: string;
    onSaveEvolution: (patientId: string, evolution: Evolution) => void;
    onSync: () => Promise<void>;
}

export const ProfessionalPortal: React.FC<ProfessionalPortalProps> = ({ 
    patients, 
    profissionais, 
    brandName, 
    brandColor,
    onSaveEvolution,
    onSync
}) => {
    const [selectedProfessional, setSelectedProfessional] = useState('');
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [evolutionText, setEvolutionText] = useState('');
    const [evolutionDate, setEvolutionDate] = useState(new Date().toISOString().split('T')[0]);
    const [isSaving, setIsSaving] = useState(false);

    // TELA 0: SINCRONIZAÇÃO (Se não houver pacientes carregados no dispositivo)
    if (patients.length === 0) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
                <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl animate-fade-in">
                    <div className="mx-auto bg-slate-700 w-16 h-16 rounded-full flex items-center justify-center mb-6">
                        <CloudDownloadIcon className="w-8 h-8 text-sky-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">{brandName}</h1>
                    <h2 className="text-xl font-semibold text-sky-500 mb-4">Primeiro Acesso</h2>
                    <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                        Por segurança, os dados dos pacientes não ficam expostos na internet. Eles estão criptografados no servidor da clínica.
                        <br/><br/>
                        Para acessar o prontuário neste dispositivo, você precisa baixar e desbloquear o banco de dados.
                    </p>
                    
                    <button 
                        onClick={onSync}
                        className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg flex items-center justify-center gap-2"
                    >
                        <LockIcon className="w-4 h-4" /> Baixar Dados Seguros
                    </button>
                    <p className="mt-4 text-[10px] text-slate-600">Você precisará da senha da nuvem fornecida pela administração.</p>
                </div>
            </div>
        );
    }

    // TELA 1: SELEÇÃO DE PROFISSIONAL
    if (!selectedProfessional) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
                <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl animate-fade-in">
                    <h1 className="text-2xl font-bold text-center mb-2" style={{ color: brandColor }}>{brandName}</h1>
                    <p className="text-slate-400 text-center mb-8">Portal do Profissional</p>
                    
                    <label className="block text-sm font-medium text-slate-300 mb-2">Selecione seu nome para entrar:</label>
                    <select 
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-500 mb-6"
                        onChange={(e) => setSelectedProfessional(e.target.value)}
                        value={selectedProfessional}
                    >
                        <option value="">Selecione...</option>
                        {profissionais.sort().map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                </div>
                <p className="mt-8 text-xs text-slate-600">Acesso restrito para registros de prontuário.</p>
            </div>
        );
    }

    // Filtrar pacientes deste profissional
    const myPatients = patients.filter(p => p.profissionais.includes(selectedProfessional))
        .sort((a, b) => a.nome.localeCompare(b.nome));

    const selectedPatient = patients.find(p => p.id === selectedPatientId);

    const handleSave = () => {
        if (!evolutionText.trim()) return alert('Escreva a evolução antes de salvar.');
        
        setIsSaving(true);
        const newEvolution: Evolution = {
            id: `${Date.now()}`,
            date: evolutionDate,
            content: evolutionText,
            professional: selectedProfessional,
            timestamp: new Date().toISOString()
        };

        onSaveEvolution(selectedPatientId, newEvolution);
        
        // Reset form
        setEvolutionText('');
        setIsSaving(false);
        alert('Evolução registrada com sucesso!');
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col">
            {/* Header */}
            <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10 shadow-md">
                <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-700 p-2 rounded-lg">
                            <UserIcon className="w-5 h-5 text-sky-400" />
                        </div>
                        <div>
                            <h2 className="text-white font-bold leading-tight">{selectedProfessional.split(' - ')[0]}</h2>
                            <p className="text-xs text-slate-400">Portal do Profissional</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => { setSelectedProfessional(''); setSelectedPatientId(''); }}
                        className="text-xs text-slate-400 hover:text-white border border-slate-600 px-3 py-1 rounded-full transition"
                    >
                        Sair
                    </button>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Lista de Pacientes (Sidebar) */}
                <div className={`bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden flex flex-col h-[80vh] ${selectedPatientId ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
                        <h3 className="font-bold text-slate-200">Meus Pacientes ({myPatients.length})</h3>
                        <button onClick={onSync} title="Atualizar dados" className="text-slate-500 hover:text-white"><CloudDownloadIcon className="w-4 h-4"/></button>
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 space-y-1">
                        {myPatients.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-8">Você ainda não tem pacientes vinculados.</p>
                        ) : (
                            myPatients.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedPatientId(p.id)}
                                    className={`w-full text-left px-4 py-3 rounded-xl text-sm transition flex items-center justify-between group ${selectedPatientId === p.id ? 'bg-sky-600 text-white shadow-lg' : 'hover:bg-slate-700 text-slate-300'}`}
                                >
                                    <span className="font-medium">{p.nome}</span>
                                    <span className="text-xs opacity-70 border border-current px-1.5 rounded">{p.tipoAtendimento || 'Conv.'}</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Área de Evolução (Main) */}
                <div className={`md:col-span-2 flex flex-col h-[80vh] ${!selectedPatientId ? 'hidden md:flex' : 'flex'}`}>
                    {!selectedPatient ? (
                        <div className="flex-1 bg-slate-800/30 border border-slate-700 border-dashed rounded-2xl flex items-center justify-center text-slate-500">
                            <p>Selecione um paciente ao lado para registrar a evolução.</p>
                        </div>
                    ) : (
                        <div className="bg-slate-800 border border-slate-700 rounded-2xl flex flex-col h-full shadow-2xl overflow-hidden animate-fade-in">
                            {/* Header Paciente */}
                            <div className="p-4 border-b border-slate-700 bg-slate-850 flex justify-between items-center">
                                <div>
                                    <button onClick={() => setSelectedPatientId('')} className="md:hidden text-xs text-sky-400 mb-1">❮ Voltar para lista</button>
                                    <h2 className="text-xl font-bold text-white">{selectedPatient.nome}</h2>
                                    <p className="text-xs text-slate-400">
                                        {selectedPatient.faixa} • {selectedPatient.convenio || 'Particular'}
                                    </p>
                                </div>
                                <div className="text-right hidden sm:block">
                                    <p className="text-xs text-slate-500">Prontuário Digital</p>
                                </div>
                            </div>

                            {/* Histórico de Evoluções */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Histórico de Evoluções</h4>
                                {(!selectedPatient.evolutions || selectedPatient.evolutions.length === 0) ? (
                                    <p className="text-sm text-slate-600 italic text-center py-4">Nenhuma evolução registrada anteriormente.</p>
                                ) : (
                                    selectedPatient.evolutions
                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map(evo => (
                                            <div key={evo.id} className="bg-slate-800 border border-slate-700 p-4 rounded-xl relative">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                                                        <CalendarIcon className="w-3 h-3" />
                                                        {new Date(evo.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">{evo.professional.split(' ')[0]}</span>
                                                </div>
                                                <p className="text-sm text-slate-300 whitespace-pre-wrap">{evo.content}</p>
                                            </div>
                                        ))
                                )}
                            </div>

                            {/* Form Nova Evolução */}
                            <div className="p-4 bg-slate-800 border-t border-slate-700">
                                <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                    <PlusIcon className="w-4 h-4 text-green-400" /> Nova Evolução
                                </h4>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="date" 
                                            value={evolutionDate} 
                                            onChange={e => setEvolutionDate(e.target.value)} 
                                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-sky-500 outline-none"
                                        />
                                        <span className="text-xs text-slate-500">Data do atendimento</span>
                                    </div>
                                    <textarea 
                                        value={evolutionText}
                                        onChange={e => setEvolutionText(e.target.value)}
                                        placeholder="Descreva a evolução do paciente aqui..."
                                        className="w-full h-24 bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-sky-500 outline-none resize-none"
                                    />
                                    <button 
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-xl transition flex items-center justify-center gap-2"
                                    >
                                        {isSaving ? 'Salvando...' : 'Salvar Evolução'} <CheckIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};
