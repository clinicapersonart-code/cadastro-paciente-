import React, { useState, useEffect, useCallback } from 'react';
import { Patient, FunservConfig } from '../types';
import { PlusIcon, XIcon, TrashIcon, CalendarIcon, CheckIcon, RepeatIcon, ArrowRightIcon } from './icons';
import { DEFAULT_ORIGINS } from '../constants';

interface PatientFormProps {
    editingPatient: Patient | null;
    onSave: (patient: Patient) => void;
    onClear: () => void;
    convenios: string[];
    profissionais: string[];
    especialidades: string[];
    onAddConvenio: (convenio: string) => void;
    onAddProfissional: (profissional: string) => void;
    onAddEspecialidade: (especialidade: string) => void;
    onRemoveConvenio: (convenio: string) => void;
    onRemoveProfissional: (profissional: string) => void;
    onRemoveEspecialidade: (especialidade: string) => void;
}

const emptyPatient: Patient = {
    id: '', nome: '', faixa: '', profissionais: [], especialidades: []
};

const Chip = ({ text, onRemove }: { text: string, onRemove: () => void }) => (
    <span className="inline-flex items-center gap-1.5 bg-slate-700 border border-slate-600 py-1 px-2.5 rounded-full text-xs font-medium text-slate-200">
        {text}
        <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-300">
            <XIcon className="w-3 h-3" />
        </button>
    </span>
);

export const PatientForm: React.FC<PatientFormProps> = ({
    editingPatient, onSave, onClear, convenios, profissionais, especialidades, 
    onAddConvenio, onAddProfissional, onAddEspecialidade,
    onRemoveConvenio, onRemoveProfissional, onRemoveEspecialidade
}) => {
    const [formData, setFormData] = useState<Patient>(emptyPatient);
    const [activeTab, setActiveTab] = useState<'cadastro' | 'prontuario'>('cadastro');
    
    // States for adding new items
    const [novoProfissional, setNovoProfissional] = useState('');
    const [novaEspecialidade, setNovaEspecialidade] = useState('');

    // States for the select dropdowns (to enable deletion of selected item)
    const [selectedProfissional, setSelectedProfissional] = useState('');
    const [selectedEspecialidade, setSelectedEspecialidade] = useState('');
    const [selectedConvenio, setSelectedConvenio] = useState('');

    useEffect(() => {
        setFormData(editingPatient ? { ...editingPatient } : { ...emptyPatient });
        setActiveTab('cadastro'); // Reset tab on new patient load
        if (editingPatient?.convenio) {
            setSelectedConvenio(editingPatient.convenio);
        } else {
            setSelectedConvenio('');
        }
    }, [editingPatient]);

    const handleConvenioSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedConvenio(val);
        setFormData(prev => {
            const updated = { ...prev, convenio: val };
            // Initialize Funserv config silently if selected, but UI is handled in separate tab
            if (val === 'Funserv' && !updated.funservConfig) {
                updated.funservConfig = {
                    active: true,
                    totalSessions: 10,
                    usedSessions: 0,
                    startDate: new Date().toISOString().split('T')[0],
                    frequency: '1x Semana',
                    alertEmail: prev.email || '',
                    history: []
                };
            }
            return updated;
        });
        
        if (val === 'Funserv') {
            alert('Aviso: Para gerenciar as sessões e guias deste paciente, utilize a aba "Gestão Funserv" no menu principal após salvar o cadastro.');
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'nascimento') {
            const birthDate = parseISODate(value);
            if (birthDate) {
                const age = calculateAge(birthDate);
                if (age < 18) {
                    setFormData(prev => ({ ...prev, faixa: 'Criança' }));
                } else {
                    setFormData(prev => ({ ...prev, faixa: 'Adulto' }));
                }
            }
        }
    };

    const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value as Patient['faixa'] | Patient['tipoAtendimento'] }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nome) {
            alert('Informe o nome do paciente.');
            return;
        }
        if (!formData.faixa) {
            alert('Selecione se é Criança ou Adulto.');
            return;
        }
        if (formData.faixa === 'Criança' && !formData.responsavel) {
            alert('Informe o nome do responsável para pacientes criança.');
            return;
        }
        onSave(formData);
    };

    const handleAddItem = (
      list: string[], 
      setter: (list: string[]) => void, 
      item: string
    ) => {
        if (item && !list.includes(item)) {
            setter([...list, item]);
        }
    };
    
    const handleRemoveItem = (
      list: string[], 
      setter: (list: string[]) => void, 
      item: string
    ) => {
        setter(list.filter(i => i !== item));
    };

    const parseISODate = (iso?: string): Date | null => {
        if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
        const [y, m, d] = iso.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const calculateAge = (birthDate: Date): number => {
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };
    
    const ageHint = useCallback(() => {
        const d = parseISODate(formData.nascimento);
        if (!d) return '';
        const age = calculateAge(d);
        return age >= 0 ? `${age} anos` : '';
    }, [formData.nascimento]);


    return (
        <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-2xl backdrop-blur-sm">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-100">{editingPatient ? 'Editar Paciente' : 'Novo Paciente'}</h2>
                
                {/* Tabs */}
                {editingPatient && (
                    <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                        <button 
                            type="button"
                            onClick={() => setActiveTab('cadastro')} 
                            className={`px-3 py-1 text-xs font-bold rounded transition ${activeTab === 'cadastro' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            Cadastro
                        </button>
                        <button 
                            type="button"
                            onClick={() => setActiveTab('prontuario')} 
                            className={`px-3 py-1 text-xs font-bold rounded transition ${activeTab === 'prontuario' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            Prontuário
                        </button>
                    </div>
                )}
            </div>

            {activeTab === 'cadastro' ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="nome" className="block text-sm font-medium text-slate-400 mb-1">Nome do paciente *</label>
                            <input id="nome" name="nome" type="text" required placeholder="Ex.: Ana Silva" value={formData.nome} onChange={handleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition" />
                        </div>
                        <div>
                            <label htmlFor="nascimento" className="block text-sm font-medium text-slate-400 mb-1">Data de nascimento</label>
                            <input id="nascimento" name="nascimento" type="date" value={formData.nascimento || ''} onChange={handleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition appearance-none" />
                            <div className="text-xs text-slate-500 mt-1">{ageHint()}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="contato" className="block text-sm font-medium text-slate-400 mb-1">Telefone/WhatsApp *</label>
                            <input id="contato" name="contato" type="text" required placeholder="Ex.: (15) 99999-9999" value={formData.contato || ''} onChange={handleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition" />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-400 mb-1">E-mail</label>
                            <input id="email" name="email" type="email" placeholder="email@exemplo.com" value={formData.email || ''} onChange={handleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition" />
                        </div>
                    </div>

                    <div className="flex items-center gap-4 pt-1">
                        <span className="text-sm text-slate-400">Faixa etária:</span>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="radio" name="faixa" value="Criança" checked={formData.faixa === 'Criança'} onChange={handleRadioChange} className="form-radio bg-slate-900 border-slate-600 text-sky-500 focus:ring-sky-500" /> Criança
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="radio" name="faixa" value="Adulto" checked={formData.faixa === 'Adulto'} onChange={handleRadioChange} className="form-radio bg-slate-900 border-slate-600 text-sky-500 focus:ring-sky-500" /> Adulto
                        </label>
                    </div>

                    {formData.faixa === 'Criança' && (
                        <div>
                            <label htmlFor="responsavel" className="block text-sm font-medium text-slate-400 mb-1">Nome do responsável (obrigatório para criança)</label>
                            <input id="responsavel" name="responsavel" type="text" placeholder="Ex.: Maria de Souza" value={formData.responsavel || ''} onChange={handleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition" />
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="convenio" className="block text-sm font-medium text-slate-400 mb-1">Convênio</label>
                            <div className="flex gap-2">
                                <select 
                                    id="convenio" 
                                    name="convenio" 
                                    value={selectedConvenio} 
                                    onChange={handleConvenioSelect} 
                                    className="flex-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition"
                                >
                                    <option value="">Selecione...</option>
                                    {convenios.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <button 
                                    type="button" 
                                    title="Excluir convênio selecionado da lista de opções" 
                                    onClick={() => {
                                        if (selectedConvenio) {
                                            onRemoveConvenio(selectedConvenio);
                                            setSelectedConvenio('');
                                            setFormData(prev => ({...prev, convenio: ''}));
                                        }
                                    }} 
                                    className="bg-slate-700 hover:bg-red-900/50 hover:text-red-300 text-slate-200 px-2.5 rounded-lg text-sm transition"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                                <button type="button" title="Criar novo convênio" onClick={() => {const n = prompt('Novo convênio:'); if (n) onAddConvenio(n);}} className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 rounded-lg text-sm transition"><PlusIcon className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="carteirinha" className="block text-sm font-medium text-slate-400 mb-1">Número da carteirinha</label>
                            <input id="carteirinha" name="carteirinha" type="text" placeholder="Ex.: 123456789" value={formData.carteirinha || ''} onChange={handleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition" />
                        </div>
                    </div>

                    {/* Funserv Notice */}
                    {formData.convenio === 'Funserv' && (
                        <div className="bg-teal-900/20 border border-teal-700/50 rounded-lg p-3 flex items-start gap-3 mt-2">
                             <CheckIcon className="w-5 h-5 text-teal-400 mt-0.5" />
                             <div>
                                 <p className="text-sm text-teal-200 font-bold">Convênio Funserv Selecionado</p>
                                 <p className="text-xs text-slate-400">
                                     O controle de sessões, alertas e validade da guia deve ser feito através da aba 
                                     <span className="font-bold text-teal-400"> "Gestão Funserv"</span> no menu principal.
                                 </p>
                             </div>
                        </div>
                    )}


                    {/* Campo Origem */}
                    <div>
                        <label htmlFor="origem" className="block text-sm font-medium text-slate-400 mb-1">Origem (Como conheceu a clínica?)</label>
                        <select 
                            id="origem" 
                            name="origem" 
                            value={formData.origem || ''} 
                            onChange={handleChange} 
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition"
                        >
                            <option value="">Selecione a origem...</option>
                            {DEFAULT_ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Profissionais</label>
                        <div className="flex gap-2 mb-2">
                        <select 
                            id="profissional-select" 
                            value={selectedProfissional}
                            onChange={(e) => setSelectedProfissional(e.target.value)}
                            className="flex-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition"
                        >
                            <option value="">Selecione para adicionar ou excluir...</option>
                            {profissionais.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <button 
                            type="button" 
                            title="Excluir profissional selecionado da lista de opções" 
                            onClick={() => {
                                if(selectedProfissional) {
                                    onRemoveProfissional(selectedProfissional);
                                    setSelectedProfissional('');
                                }
                            }} 
                            className="bg-slate-700 hover:bg-red-900/50 hover:text-red-300 text-slate-200 px-3 rounded-lg text-sm transition"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                        <button 
                            type="button" 
                            title="Adicionar profissional ao paciente" 
                            onClick={() => {
                                if (selectedProfissional) {
                                    handleAddItem(formData.profissionais, (p) => setFormData(prev => ({...prev, profissionais: p})), selectedProfissional);
                                }
                            }} 
                            className="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-4 rounded-lg text-sm transition"
                        >
                            Adicionar
                        </button>
                        </div>
                        <div className="flex gap-2">
                            <input type="text" value={novoProfissional} onChange={(e) => setNovoProfissional(e.target.value)} placeholder="Criar novo profissional (Digite e clique em +)" className="flex-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition" />
                            <button type="button" onClick={() => { if (novoProfissional) { onAddProfissional(novoProfissional); setNovoProfissional(''); } }} className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 rounded-lg text-sm transition"><PlusIcon className="w-4 h-4" /></button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {formData.profissionais.map((p: string) => <span key={p}><Chip text={p} onRemove={() => handleRemoveItem(formData.profissionais, (pro) => setFormData(prev => ({...prev, profissionais: pro})), p)} /></span>)}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Especialidades</label>
                        <div className="flex gap-2 mb-2">
                        <select 
                            id="especialidade-select" 
                            value={selectedEspecialidade}
                            onChange={(e) => setSelectedEspecialidade(e.target.value)}
                            className="flex-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition"
                        >
                            <option value="">Selecione para adicionar ou excluir...</option>
                            {especialidades.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                        <button 
                            type="button" 
                            title="Excluir especialidade selecionada da lista de opções" 
                            onClick={() => {
                                if(selectedEspecialidade) {
                                    onRemoveEspecialidade(selectedEspecialidade);
                                    setSelectedEspecialidade('');
                                }
                            }}
                            className="bg-slate-700 hover:bg-red-900/50 hover:text-red-300 text-slate-200 px-3 rounded-lg text-sm transition"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                        <button 
                            type="button" 
                            title="Adicionar especialidade ao paciente" 
                            onClick={() => {
                                if (selectedEspecialidade) {
                                    handleAddItem(formData.especialidades, (e) => setFormData(prev => ({...prev, especialidades: e})), selectedEspecialidade);
                                }
                            }}
                            className="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-4 rounded-lg text-sm transition"
                        >
                            Adicionar
                        </button>
                        </div>
                        <div className="flex gap-2">
                            <input type="text" value={novaEspecialidade} onChange={(e) => setNovaEspecialidade(e.target.value)} placeholder="Criar nova especialidade (Digite e clique em +)" className="flex-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition" />
                            <button type="button" onClick={() => { if (novaEspecialidade) { onAddEspecialidade(novaEspecialidade); setNovaEspecialidade(''); } }} className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 rounded-lg text-sm transition"><PlusIcon className="w-4 h-4" /></button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {formData.especialidades.map((e: string) => <span key={e}><Chip text={e} onRemove={() => handleRemoveItem(formData.especialidades, (esp) => setFormData(prev => ({...prev, especialidades: esp})), e)} /></span>)}
                        </div>
                    </div>


                    <div className="flex items-center gap-4 pt-1">
                        <span className="text-sm text-slate-400">Tipo de atendimento:</span>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="radio" name="tipoAtendimento" value="Convencional" checked={formData.tipoAtendimento === 'Convencional'} onChange={handleRadioChange} className="form-radio bg-slate-900 border-slate-600 text-sky-500 focus:ring-sky-500" /> Convencional
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="radio" name="tipoAtendimento" value="ABA" checked={formData.tipoAtendimento === 'ABA'} onChange={handleRadioChange} className="form-radio bg-slate-900 border-slate-600 text-sky-500 focus:ring-sky-500" /> ABA
                        </label>
                    </div>


                    <div className="flex gap-4">
                        <button type="submit" className="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition w-full sm:w-auto">Salvar paciente</button>
                        <button type="button" onClick={onClear} className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold px-4 py-2 rounded-lg text-sm transition w-full sm:w-auto">Limpar formulário</button>
                    </div>
                </form>
            ) : (
                <div className="space-y-4">
                     <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Histórico de Evoluções</h4>
                     
                     <div className="max-h-[400px] overflow-y-auto pr-2 space-y-3 bg-slate-900/30 rounded-xl p-2 border border-slate-700/50">
                        {(!formData.evolutions || formData.evolutions.length === 0) ? (
                            <p className="text-sm text-slate-500 text-center py-8">Nenhuma evolução registrada neste prontuário.</p>
                        ) : (
                            formData.evolutions
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .map(evo => (
                                    <div key={evo.id} className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                                                <CalendarIcon className="w-3 h-3" />
                                                {new Date(evo.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                            </span>
                                            <span className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">{evo.professional}</span>
                                        </div>
                                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{evo.content}</p>
                                    </div>
                                ))
                        )}
                     </div>
                     <p className="text-xs text-slate-500 mt-2">* As evoluções são inseridas pelos profissionais através do Portal do Colaborador.</p>
                </div>
            )}
        </section>
    );
};