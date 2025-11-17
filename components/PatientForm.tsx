
import React, { useState, useEffect, useCallback } from 'react';
import { Patient } from '../types';
import { PlusIcon, XIcon } from './icons';

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
    editingPatient, onSave, onClear, convenios, profissionais, especialidades, onAddConvenio, onAddProfissional, onAddEspecialidade
}) => {
    const [formData, setFormData] = useState<Patient>(emptyPatient);
    const [novoProfissional, setNovoProfissional] = useState('');
    const [novaEspecialidade, setNovaEspecialidade] = useState('');

    useEffect(() => {
        setFormData(editingPatient ? { ...editingPatient } : { ...emptyPatient });
    }, [editingPatient]);

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
            <h2 className="text-xl font-bold mb-4 text-slate-100">{editingPatient ? 'Editar Paciente' : 'Novo Paciente'}</h2>
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
                        <select id="convenio" name="convenio" value={formData.convenio || ''} onChange={handleChange} className="flex-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition">
                            <option value="">Selecione</option>
                            {convenios.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button type="button" onClick={() => {const n = prompt('Novo convênio:'); if (n) onAddConvenio(n);}} className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 rounded-lg text-sm transition"><PlusIcon className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="carteirinha" className="block text-sm font-medium text-slate-400 mb-1">Número da carteirinha</label>
                        <input id="carteirinha" name="carteirinha" type="text" placeholder="Ex.: 123456789" value={formData.carteirinha || ''} onChange={handleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition" />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Profissionais</label>
                    <div className="flex gap-2 mb-2">
                      <select id="profissional-select" className="flex-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition">
                          {profissionais.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <button type="button" onClick={() => handleAddItem(formData.profissionais, (p) => setFormData(prev => ({...prev, profissionais: p})), (document.getElementById('profissional-select') as HTMLSelectElement).value)} className="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-4 rounded-lg text-sm transition">Adicionar</button>
                    </div>
                    <div className="flex gap-2">
                        <input type="text" value={novoProfissional} onChange={(e) => setNovoProfissional(e.target.value)} placeholder="Novo profissional" className="flex-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition" />
                        <button type="button" onClick={() => { if (novoProfissional) { onAddProfissional(novoProfissional); setNovoProfissional(''); } }} className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 rounded-lg text-sm transition"><PlusIcon className="w-4 h-4" /></button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {formData.profissionais.map((p: string) => <span key={p}><Chip text={p} onRemove={() => handleRemoveItem(formData.profissionais, (pro) => setFormData(prev => ({...prev, profissionais: pro})), p)} /></span>)}
                    </div>
                </div>

                 <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Especialidades</label>
                    <div className="flex gap-2 mb-2">
                      <select id="especialidade-select" className="flex-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition">
                          {especialidades.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                      <button type="button" onClick={() => handleAddItem(formData.especialidades, (e) => setFormData(prev => ({...prev, especialidades: e})), (document.getElementById('especialidade-select') as HTMLSelectElement).value)} className="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-4 rounded-lg text-sm transition">Adicionar</button>
                    </div>
                    <div className="flex gap-2">
                        <input type="text" value={novaEspecialidade} onChange={(e) => setNovaEspecialidade(e.target.value)} placeholder="Nova especialidade" className="flex-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition" />
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
        </section>
    );
};
