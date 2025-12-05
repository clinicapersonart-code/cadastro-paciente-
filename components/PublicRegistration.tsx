import React, { useState } from 'react';
import { PreCadastro } from '../types';
import { CheckIcon, StarIcon, UserIcon } from './icons';
import { DEFAULT_ORIGINS, DEFAULT_PROFISSIONAIS } from '../constants';
import { supabase } from '../services/supabase';

interface PublicRegistrationProps {
    cloudEndpoint: string; // Mantido para compatibilidade, mas não usado
    brandName: string;
    brandColor: string;
    brandLogo: string | null;
    isUpdateMode?: boolean;
    isVipMode?: boolean;
    convenios: string[];
}

export const PublicRegistration: React.FC<PublicRegistrationProps> = ({ 
    brandName, 
    brandColor, 
    brandLogo, 
    isUpdateMode = false, 
    isVipMode = false,
    convenios 
}) => {
    const [formData, setFormData] = useState({
        nome: '',
        nascimento: '',
        responsavel: '',
        contato: '',
        email: '',
        endereco: '',
        convenio: '',
        carteirinha: '',
        origem: '',
        profissional: '',
        agendamento: {
            data: '',
            hora: '',
            frequencia: 'Semanal'
        }
    });
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleScheduleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            agendamento: {
                ...formData.agendamento,
                [e.target.name]: e.target.value
            }
        });
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
        
        if (!supabase) {
            alert('Erro de configuração do sistema. Contate a clínica.');
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
            const { error } = await supabase.from('inbox').insert({
                id: payload.id,
                data: payload
            });

            if (error) throw error;
            setStatus('success');
        } catch (err) {
            console.error(err);
            setStatus('error');
        }
    };

    if (status === 'success') {
        if (isVipMode) {
             return (
                <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900">
                    <div className="bg-slate-800 p-8 rounded-2xl text-center max-w-md w-full shadow-2xl border border-slate-700 animate-fade-in relative overflow-hidden">
                        {/* Efeito de brilho no fundo */}
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl"></div>

                        <div className="w-16 h-16 bg-amber-900/30 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-900/20">
                            <StarIcon className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-4">Atualização Recebida!</h2>
                        <p className="text-slate-300 text-sm leading-relaxed mb-6">
                            Você é muito importante para o nosso crescimento. Obrigado por fazer parte da nossa história!
                            <br/><br/>
                            Se puder, nos ajude ainda mais nos avaliando com 5 estrelas no Google. Isso faz toda a diferença para nós.
                        </p>
                        
                        <a 
                            href="https://g.page/r/CeVIkm6xjD-zEAE/review" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block w-full bg-slate-100 hover:bg-white text-slate-900 font-bold py-3 rounded-xl transition shadow-lg transform hover:scale-[1.02] flex items-center justify-center gap-2 mb-4"
                        >
                            <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="w-5 h-5"/>
                            Avaliar no Google
                        </a>

                        <button onClick={() => window.location.reload()} className="text-xs text-slate-500 hover:text-slate-300 underline">
                            Voltar ao início
                        </button>
                    </div>
                </div>
             );
        }

        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900">
                <div className="bg-slate-800 p-8 rounded-2xl text-center max-w-md w-full shadow-2xl border border-slate-700 animate-fade-in">
                    <div className="w-16 h-16 bg-green-900/30 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-900/20">
                        <CheckIcon className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Cadastro Enviado!</h2>
                    <p className="text-slate-300">Seus dados foram salvos com segurança. Entraremos em contato em breve.</p>
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
                        {isUpdateMode || isVipMode ? 'Atualização de Cadastro' : 'Formulário de Pré-cadastro'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl shadow-xl space-y-4 backdrop-blur-sm">
                    {/* Campos Pessoais */}
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

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Telefone / WhatsApp *</label>
                            <input required type="tel" name="contato" value={formData.contato} onChange={handleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 text-white focus:ring-2 focus:ring-sky-500 outline-none transition" placeholder="(00) 00000-0000" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">E-mail</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 text-white focus:ring-2 focus:ring-sky-500 outline-none transition" placeholder="email@exemplo.com" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Endereço</label>
                        <input name="endereco" value={formData.endereco} onChange={handleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 text-white focus:ring-2 focus:ring-sky-500 outline-none transition" placeholder="Rua, Número, Bairro" />
                    </div>
                    
                    <div className="border-t border-slate-700 pt-4 mt-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Informações do Atendimento</p>
                        
                        {/* Seção Novo Profissional */}
                        <div className="mb-4">
                             <label className="block text-sm font-medium text-slate-400 mb-1">Profissional de Preferência</label>
                             <div className="relative">
                                 <select 
                                    name="profissional" 
                                    value={formData.profissional} 
                                    onChange={handleChange} 
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 text-white focus:ring-2 focus:ring-sky-500 outline-none transition appearance-none pl-10"
                                 >
                                    <option value="">Selecione o profissional (Opcional)...</option>
                                    {DEFAULT_PROFISSIONAIS.sort().map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                 </select>
                                 <UserIcon className="w-5 h-5 text-slate-500 absolute left-3 top-3.5" />
                             </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Convênio</label>
                                <select name="convenio" value={formData.convenio} onChange={handleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 text-white focus:ring-2 focus:ring-sky-500 outline-none transition appearance-none">
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

                    {!isVipMode && (
                        <div className="border-t border-slate-700 pt-4 mt-2">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Sugestão de Agendamento</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Data Preferencial</label>
                                    <input type="date" name="data" value={formData.agendamento.data} onChange={handleScheduleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 text-white focus:ring-2 focus:ring-sky-500 outline-none transition" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Horário Preferencial</label>
                                    <input type="time" name="hora" value={formData.agendamento.hora} onChange={handleScheduleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 text-white focus:ring-2 focus:ring-sky-500 outline-none transition" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Frequência Desejada</label>
                                    <select name="frequencia" value={formData.agendamento.frequencia} onChange={handleScheduleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 text-white focus:ring-2 focus:ring-sky-500 outline-none transition">
                                        <option>Semanal</option>
                                        <option>Quinzenal</option>
                                        <option>Mensal</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="pt-2">
                         <label className="block text-sm font-medium text-slate-400 mb-1">Como conheceu a clínica?</label>
                         <select name="origem" value={formData.origem} onChange={handleChange} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 text-white focus:ring-2 focus:ring-sky-500 outline-none transition appearance-none">
                            <option value="">Selecione...</option>
                            {DEFAULT_ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>

                    <div className="pt-4">
                        <button type="submit" disabled={status === 'submitting'} className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-sky-900/20">
                            {status === 'submitting' ? 'Enviando...' : (isVipMode ? 'Atualizar Dados' : 'Enviar Cadastro')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};