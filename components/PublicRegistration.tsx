

import React, { useState } from 'react';
import { PreCadastro } from '../types';
import { CheckIcon, StarIcon } from './icons';
import { DEFAULT_ORIGINS } from '../constants';

interface PublicRegistrationProps {
    cloudEndpoint: string;
    brandName: string;
    brandColor: string;
    brandLogo: string | null;
    isUpdateMode?: boolean;
    convenios: string[];
}

export const PublicRegistration: React.FC<PublicRegistrationProps> = ({ cloudEndpoint, brandName, brandColor, brandLogo, isUpdateMode = false, convenios }) => {
    const [formData, setFormData] = useState({
        nome: '',
        nascimento: '',
        responsavel: '',
        contato: '',
        email: '',
        endereco: '',
        convenio: '',
        carteirinha: '',
        origem: ''
    });
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const calculateAge = (dateString: string) => {
        if (!dateString) return 0;
        const today = new Date();
        const birthDate = new Date(dateString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const isChild = calculateAge(formData.nascimento) < 18 && formData.nascimento !== '';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!cloudEndpoint) {
            alert('Erro de configuração: Link da nuvem não definido pelo administrador.');
            return;
        }
        
        if(isChild && !formData.responsavel) {
            alert('Por favor, preencha o nome do responsável.');
            return;
        }

        setStatus('submitting');

        const payload: PreCadastro = {
            id: `temp-${Date.now()}`,
            ...formData,
            dataEnvio: new Date().toISOString()
        };

        try {
            // Enviar com type: 'submission'
            const res = await fetch(cloudEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    type: 'submission',
                    data: payload
                })
            });

            if (!res.ok) throw new Error('Erro na comunicação com o servidor');
            
            const result = await res.json();
            if (result.status === 'error') throw new Error(result.message);

            setStatus('success');
        } catch (err) {
            console.error(err);
            setStatus('error');
        }
    };

    if (status === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900">
                <div className="bg-slate-800 p-8 rounded-2xl text-center max-w-md w-full shadow-2xl border border-slate-700 animate-fade-in">
                    <div className="w-16 h-16 bg-green-900/30 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-900/20">
                        <CheckIcon className="w-8 h-8" />
                    </div>
                    
                    {isUpdateMode ? (
                        <>
                            <h2 className="text-2xl font-bold text-white mb-3">Cadastro Atualizado!</h2>
                            <p className="text-slate-300 mb-6">Obrigado por manter suas informações em dia.</p>
                            
                            <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-5 mt-4">
                                <p className="text-sm text-slate-200 font-medium mb-3">Sua opinião nos ajuda a crescer!</p>
                                <p className="text-xs text-slate-400 mb-4">Poderia levar 30 segundos para nos avaliar no Google?</p>
                                <a 
                                    href="https://share.google/V5KAjtP6bQAvhLHwv" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="block w-full bg-slate-100 hover:bg-white text-slate-900 font-bold py-3 rounded-lg transition shadow-lg flex items-center justify-center gap-2"
                                >
                                    <StarIcon className="w-5 h-5 text-amber-500 fill-amber-500" />
                                    Avaliar no Google
                                </a>
                            </div>
                        </>
                    ) : (
                        <>
                            <h2 className="text-2xl font-bold text-white mb-2">Cadastro Enviado!</h2>
                            <p className="text-slate-300">Seus dados foram enviados para a {brandName}. Entraremos em contato em breve.</p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 py-8 px-4">
            <div className="max-w-md mx-auto">
                <div className="text-center mb-8">
                    {brandLogo && <img src={brandLogo} alt="Logo" className="h-16 w-16 rounded-xl mx-auto mb-3" />}
                    <h1 className="text-2xl font-bold" style={{ color: brandColor }}>{brandName}</h1>
                    <p className="text-slate-400 text-sm mt-1">
                        {isUpdateMode ? 'Atualização de Cadastro' : 'Formulário de Pré-cadastro'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl shadow-xl space-y-4 backdrop-blur-sm">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Nome Completo do Paciente *</label>
                        <input required name="nome" value={formData.nome} onChange={handleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 text-white focus:ring-2 focus:ring-sky-500 outline-none transition" placeholder="Nome do paciente" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Data de Nascimento *</label>
                        <input required type="date" name="nascimento" value={formData.nascimento} onChange={handleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 text-white focus:ring-2 focus:ring-sky-500 outline-none transition" />
                    </div>

                    {isChild && (
                        <div className="animate-fade-in p-4 bg-amber-900/20 border border-amber-800/50 rounded-xl">
                            <label className="block text-sm font-medium text-amber-400 mb-1">Nome do Responsável (Paciente Menor) *</label>
                            <input required name="responsavel" value={formData.responsavel} onChange={handleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 text-white focus:ring-2 focus:ring-sky-500 outline-none transition" placeholder="Nome do pai, mãe ou responsável" />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Telefone / WhatsApp *</label>
                        <input required type="tel" name="contato" value={formData.contato} onChange={handleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 text-white focus:ring-2 focus:ring-sky-500 outline-none transition" placeholder="(00) 00000-0000" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">E-mail</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 text-white focus:ring-2 focus:ring-sky-500 outline-none transition" placeholder="email@exemplo.com" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Endereço</label>
                        <input name="endereco" value={formData.endereco} onChange={handleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 text-white focus:ring-2 focus:ring-sky-500 outline-none transition" placeholder="Rua, Número, Bairro" />
                    </div>
                    
                    <div className="border-t border-slate-700 pt-4 mt-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Informações do Convênio</p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Convênio</label>
                                <select 
                                    name="convenio" 
                                    value={formData.convenio} 
                                    onChange={handleChange} 
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 text-white focus:ring-2 focus:ring-sky-500 outline-none transition appearance-none"
                                >
                                    <option value="">Selecione ou deixe vazio se particular...</option>
                                    {convenios.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Número da Carteirinha</label>
                                <input name="carteirinha" value={formData.carteirinha} onChange={handleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 text-white focus:ring-2 focus:ring-sky-500 outline-none transition" placeholder="Número da carteira do convênio" />
                            </div>
                        </div>
                    </div>

                    {/* Campo Origem */}
                    <div className="pt-2">
                         <label className="block text-sm font-medium text-slate-400 mb-1">Como conheceu a clínica?</label>
                         <select 
                            name="origem" 
                            value={formData.origem} 
                            onChange={handleChange} 
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 text-white focus:ring-2 focus:ring-sky-500 outline-none transition appearance-none"
                        >
                            <option value="">Selecione...</option>
                            {DEFAULT_ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>

                    <div className="pt-4">
                        <button 
                            type="submit" 
                            disabled={status === 'submitting'}
                            className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-sky-900/20"
                        >
                            {status === 'submitting' ? 'Enviando...' : (isUpdateMode ? 'Atualizar Dados' : 'Enviar Cadastro')}
                        </button>
                    </div>
                    {status === 'error' && <p className="text-red-400 text-sm text-center">Ocorreu um erro ao enviar. Tente novamente.</p>}
                </form>
            </div>
        </div>
    );
};