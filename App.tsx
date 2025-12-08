import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Patient, BrandConfig, Appointment, PreCadastro } from './types';
import { STORAGE_KEYS, DEFAULT_CONVENIOS, DEFAULT_PROFISSIONAIS, DEFAULT_ESPECIALIDADES } from './constants';
import useLocalStorage from './hooks/useLocalStorage';
import { downloadFile, exportToCSV } from './services/fileService';
import { supabase, isSupabaseConfigured } from './services/supabase';
import { PatientForm } from './components/PatientForm';
import { PatientTable } from './components/PatientTable';
import { Agenda } from './components/Agenda';
import { PublicRegistration } from './components/PublicRegistration';
import { FunservManager } from './components/FunservManager';
import { DownloadIcon, CloudIcon, UserIcon, CalendarIcon, InboxIcon, CheckIcon, XIcon, LockIcon, FileTextIcon, StarIcon } from './components/icons';

const App: React.FC = () => {
    // --- LOCAL SETTINGS (Mantidos no navegador) ---
    const [convenios, setConvenios] = useLocalStorage<string[]>(STORAGE_KEYS.CONVENIOS, DEFAULT_CONVENIOS);
    const [profissionais, setProfissionais] = useLocalStorage<string[]>(STORAGE_KEYS.PROFISSIONAIS, DEFAULT_PROFISSIONAIS);
    const [especialidades, setEspecialidades] = useLocalStorage<string[]>(STORAGE_KEYS.ESPECIALIDADES, DEFAULT_ESPECIALIDADES);
    
    // Persistência da Aba Ativa
    const [activeTab, setActiveTab] = useLocalStorage<'pacientes' | 'agenda' | 'funserv'>('personart.view.tab', 'pacientes');

    const [brand] = useLocalStorage<BrandConfig>(STORAGE_KEYS.BRAND, { 
        color: '#e9c49e', 
        dark: '#273e44', 
        logo: null, 
        name: 'Clínica Personart' 
    });
    
    const [accessPass, setAccessPass] = useLocalStorage<string>(STORAGE_KEYS.ACCESS_PASS, 'personart');
    
    // Sessão de Login (Armazena timestamp do último login)
    const [sessionAuth, setSessionAuth] = useLocalStorage<number | null>('personart.auth.session', null);

    // --- SUPABASE DATA STATES ---
    const [patients, setPatients] = useState<Patient[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [inbox, setInbox] = useState<PreCadastro[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [dbError, setDbError] = useState('');
    const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');

    // --- UI STATES ---
    const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ convenio: '', profissional: '', faixa: '' });
    const [isListVisible, setIsListVisible] = useState(false);
    
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [view, setView] = useState<'landing' | 'login' | 'dashboard'>('landing');
    const [loginInput, setLoginInput] = useState('');
    
    const [showInbox, setShowInbox] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [newPasswordInput, setNewPasswordInput] = useState('');
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' | 'info' } | null>(null);

    // --- INITIAL CONNECTION & SESSION TEST ---
    useEffect(() => {
        const initSystem = async () => {
            // 1. Verifica Sessão (Validade de 4 horas)
            if (sessionAuth) {
                const now = Date.now();
                const fourHours = 4 * 60 * 60 * 1000;
                if (now - sessionAuth < fourHours) {
                    setIsAuthenticated(true);
                    setView('dashboard');
                } else {
                    setSessionAuth(null); // Expired
                }
            }

            // 2. Verifica Supabase
            if (!isSupabaseConfigured()) {
                setConnectionStatus('error');
                return;
            }
            try {
                // Teste simples para verificar conexão e existência da tabela principal
                const { error } = await supabase!.from('patients').select('id').limit(1);
                if (error) throw error;
                setConnectionStatus('connected');
            } catch (err) {
                console.error("Erro de conexão inicial:", err);
                setConnectionStatus('error');
            }
        };
        initSystem();
    }, [sessionAuth, setSessionAuth]);

    // --- INITIAL DATA FETCH ---
    useEffect(() => {
        if (!isSupabaseConfigured()) {
            setDbError('O Supabase não está configurado. Preencha SUPABASE_URL e SUPABASE_ANON_KEY no arquivo constants.ts');
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // 1. Pacientes
                const { data: patData, error: patError } = await supabase!.from('patients').select('*');
                if (patError) throw patError;
                if (patData) setPatients(patData.map((row: any) => row.data));

                // 2. Agenda
                const { data: apptData, error: apptError } = await supabase!.from('appointments').select('*');
                if (apptError) throw apptError;
                if (apptData) setAppointments(apptData.map((row: any) => row.data));

                // 3. Inbox
                const { data: inboxData, error: inboxError } = await supabase!.from('inbox').select('*');
                if (inboxError) throw inboxError;
                if (inboxData) setInbox(inboxData.map((row: any) => row.data));

            } catch (err: any) {
                console.error("Erro ao carregar dados:", err);
                setDbError(err.message || 'Erro ao conectar ao banco de dados.');
            } finally {
                setIsLoading(false);
            }
        };

        if (isAuthenticated) {
            fetchData();
        }
    }, [isAuthenticated]);

    // --- MEMOS ---
    const sortedConvenios = useMemo(() => [...convenios].sort((a, b) => a.localeCompare(b, 'pt-BR')), [convenios]);
    const sortedProfissionais = useMemo(() => [...profissionais].sort((a, b) => a.localeCompare(b, 'pt-BR')), [profissionais]);
    const sortedEspecialidades = useMemo(() => [...especialidades].sort((a, b) => a.localeCompare(b, 'pt-BR')), [especialidades]);

    const filteredPatients = useMemo(() => {
        return patients
            .filter(p => {
                const search = searchTerm.toLowerCase();
                const blob = [p.nome, p.responsavel, p.contato, p.email, p.crm, p.origem, p.carteirinha, p.tipoAtendimento].filter(Boolean).join(' ').toLowerCase();
                if (search && !blob.includes(search)) return false;
                if (filters.convenio && p.convenio !== filters.convenio) return false;
                if (filters.faixa && p.faixa !== filters.faixa) return false;
                if (filters.profissional && !p.profissionais.includes(filters.profissional)) return false;
                return true;
            })
            .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
    }, [patients, searchTerm, filters]);

    // --- HELPERS ---
    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 5000); // Aumentei um pouco o tempo para leitura de erros
    };

    // --- DATABASE ACTIONS (Pessimistic / Safe) ---
    // Retorna { error } para que a UI saiba se deu certo ou não
    const savePatientToDb = async (patient: Patient) => {
        if (!supabase) return { error: { message: 'Supabase não configurado' } };
        // Remove undefined para evitar erro de JSONB
        const cleanData = JSON.parse(JSON.stringify(patient));
        return await supabase.from('patients').upsert({
            id: patient.id,
            nome: patient.nome,
            data: cleanData
        });
    };

    const deletePatientFromDb = async (id: string) => {
        if (!supabase) return { error: { message: 'Supabase não configurado' } };
        return await supabase.from('patients').delete().eq('id', id);
    };

    const saveAppointmentToDb = async (appt: Appointment) => {
        if (!supabase) return { error: { message: 'Supabase não configurado' } };
        // Remove undefined para evitar erro de JSONB
        const cleanData = JSON.parse(JSON.stringify(appt));
        return await supabase.from('appointments').upsert({
            id: appt.id,
            date: appt.date,
            data: cleanData
        });
    };

    const deleteAppointmentFromDb = async (id: string) => {
        if (!supabase) return { error: { message: 'Supabase não configurado' } };
        return await supabase.from('appointments').delete().eq('id', id);
    };

    const deleteInboxItemFromDb = async (id: string) => {
        if (!supabase) return;
        await supabase.from('inbox').delete().eq('id', id);
    };

    // --- HANDLERS ---
    const handleSavePatient = async (patient: Patient, initialAppointment?: { date: string, time: string, professional: string, recurrence: string, type: 'Convênio' | 'Particular' }) => {
        let updatedPatients;
        let newPatientId = patient.id;

        // Gerar ID se novo
        if (!patient.id) {
            newPatientId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            patient.id = newPatientId;
        }

        // Salvar Paciente no Banco
        const { error } = await savePatientToDb(patient);
        if (error) {
            console.error("Erro ao salvar paciente:", error);
            showToast(`Erro ao salvar paciente: ${error.message}`, 'error');
            return;
        }

        // Atualizar UI
        if (patients.some(p => p.id === patient.id)) {
            updatedPatients = patients.map(p => p.id === patient.id ? patient : p);
        } else {
            updatedPatients = [...patients, patient];
        }
        setPatients(updatedPatients);
        setEditingPatient(null);

        // Agendamento Inicial (Se houver)
        if (initialAppointment) {
            const { date, time, professional, recurrence, type } = initialAppointment;
            
            const createAppointment = (d: string, index = 0): Appointment => ({
                id: `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 9)}`,
                patientId: newPatientId,
                patientName: patient.nome,
                profissional: professional,
                date: d,
                time: time,
                type: type,
                convenioName: type === 'Convênio' ? patient.convenio : undefined,
                status: 'Agendado',
                obs: recurrence !== 'none' ? 'Agendamento Inicial (Recorrente)' : 'Agendamento Inicial'
            });

            const newAppointments = [];
            newAppointments.push(createAppointment(date, 0));

            if (recurrence !== 'none') {
                const [y, m, d] = date.split('-').map(Number);
                const currentDate = new Date(y, m - 1, d);
                
                let max = 4;
                let daysToAdd = 0;

                if (recurrence === 'weekly') { max = 3; daysToAdd = 7; } 
                if (recurrence === 'biweekly') { max = 1; daysToAdd = 14; }
                if (recurrence === 'monthly') { max = 5; }

                for(let i = 0; i < max; i++) {
                    if (recurrence === 'monthly') {
                        currentDate.setMonth(currentDate.getMonth() + 1);
                    } else {
                        currentDate.setDate(currentDate.getDate() + daysToAdd);
                    }
                    
                    const ny = currentDate.getFullYear();
                    const nm = String(currentDate.getMonth() + 1).padStart(2, '0');
                    const nd = String(currentDate.getDate()).padStart(2, '0');
                    const isoDate = `${ny}-${nm}-${nd}`;
                    
                    newAppointments.push(createAppointment(isoDate, i + 1));
                }
            }
            
            // Salvar Agendamentos no Banco (Batch)
            const savePromises = newAppointments.map(appt => saveAppointmentToDb(appt));
            const results = await Promise.all(savePromises);
            
            const failed = results.filter(r => r.error);
            if (failed.length === 0) {
                setAppointments(prev => [...prev, ...newAppointments]);
                
                // Link Professional se necessário
                const patIndex = updatedPatients.findIndex(p => p.id === newPatientId);
                if (patIndex >= 0 && !updatedPatients[patIndex].profissionais.includes(professional)) {
                     const p = { ...updatedPatients[patIndex] };
                     p.profissionais = [...p.profissionais, professional];
                     const { error: patUpdateError } = await savePatientToDb(p);
                     if (!patUpdateError) {
                         setPatients(prev => prev.map(pt => pt.id === p.id ? p : pt));
                     }
                }
                showToast('Paciente salvo e agendado!', 'success');
            } else {
                console.error("Falha nos agendamentos:", failed);
                showToast(`Paciente salvo, mas ${failed.length} agendamentos falharam.`, 'error');
            }
        } else {
            showToast('Paciente salvo com sucesso!', 'success');
        }
    };

    const handleEditPatient = (patient: Patient) => {
        setEditingPatient(patient);
        setActiveTab('pacientes');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Função de deletar agora recebe o ID vindo do PatientTable (que já pediu confirmação)
    const handleDeletePatient = async (id: string) => {
         // UI Optimistic update para deleção é aceitável, mas vamos garantir o banco
         const { error } = await deletePatientFromDb(id);
         if (error) {
             console.error(error);
             showToast('Erro ao excluir paciente. Tente novamente.', 'error');
         } else {
             setPatients(prev => prev.filter(p => p.id !== id));
             showToast('Paciente removido.', 'success');
         }
    };

    // --- AGENDA HANDLERS (UPDATED TO BE SAFE) ---
    
    const handleAddAppointment = async (appt: Appointment) => {
        const { error } = await saveAppointmentToDb(appt);
        if (error) {
            console.error(error);
            showToast(`Erro ao salvar: ${error.message}`, 'error');
        } else {
            setAppointments(prev => [...prev, appt]);
            showToast('Agendado com sucesso!', 'success');
            
            // Linkar profissional se necessário
            const patient = patients.find(p => p.id === appt.patientId);
            if (patient && !patient.profissionais.includes(appt.profissional)) {
                const updatedPat = { ...patient, profissionais: [...patient.profissionais, appt.profissional] };
                const { error: patError } = await savePatientToDb(updatedPat);
                if (!patError) {
                    setPatients(prev => prev.map(p => p.id === updatedPat.id ? updatedPat : p));
                }
            }
        }
    };

    const handleAddBatchAppointments = async (newAppts: Appointment[]) => {
        if (newAppts.length === 0) return;
        
        // Salva no banco em paralelo
        const promises = newAppts.map(appt => saveAppointmentToDb(appt));
        const results = await Promise.all(promises);
        
        // Verifica se algum falhou
        const failed = results.filter(r => r.error);
        if (failed.length > 0) {
            const msg = failed[0].error?.message || 'Erro desconhecido';
            console.error("Falha em lote:", failed);
            showToast(`Erro ao salvar ${failed.length} itens. Motivo: ${msg}`, 'error');
            return; 
        }

        // Se todos salvos, atualiza UI
        setAppointments(prev => [...prev, ...newAppts]);
        showToast(`Agendados ${newAppts.length} horários!`, 'success');

        // Linkar profissional (apenas do primeiro)
        const appt = newAppts[0];
        const patient = patients.find(p => p.id === appt.patientId);
        if (patient && !patient.profissionais.includes(appt.profissional)) {
            const updatedPat = { ...patient, profissionais: [...patient.profissionais, appt.profissional] };
            const { error: patError } = await savePatientToDb(updatedPat);
            if (!patError) {
                setPatients(prev => prev.map(p => p.id === updatedPat.id ? updatedPat : p));
            }
        }
    };

    const handleUpdateAppointment = async (appt: Appointment) => {
        const { error } = await saveAppointmentToDb(appt);
        if (error) {
            console.error(error);
            showToast(`Erro ao atualizar: ${error.message}`, 'error');
        } else {
            setAppointments(prev => prev.map(a => a.id === appt.id ? appt : a));
            showToast('Atualizado.', 'success');
        }
    };

    const handleDeleteAppointment = async (id: string) => {
        if (window.confirm('Remover este agendamento?')) {
            const { error } = await deleteAppointmentFromDb(id);
            if (error) {
                console.error(error);
                showToast('Erro ao remover agendamento.', 'error');
            } else {
                setAppointments(prev => prev.filter(a => a.id !== id));
                showToast('Removido.', 'success');
            }
        }
    };

    // --- INBOX ACTIONS ---
    const handleImportInboxItem = async (item: PreCadastro) => {
        const age = new Date().getFullYear() - new Date(item.nascimento).getFullYear();
        
        const newPatient: Patient = {
            id: '',
            nome: item.nome,
            nascimento: item.nascimento,
            faixa: age < 18 ? 'Criança' : 'Adulto',
            responsavel: item.responsavel,
            contato: item.contato,
            email: item.email,
            endereco: item.endereco,
            convenio: item.convenio || '',
            carteirinha: item.carteirinha || '',
            tipoAtendimento: '',
            profissionais: item.profissional ? [item.profissional] : [],
            especialidades: [],
            origem: item.origem || 'Site',
            evolutions: []
        };

        setEditingPatient(newPatient);
        setShowInbox(false);
        setActiveTab('pacientes');
        
        // Remove do Inbox
        setInbox(prev => prev.filter(i => i.id !== item.id));
        await deleteInboxItemFromDb(item.id);
        
        showToast('Dados importados. Revise e salve.', 'success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDismissInboxItem = async (id: string) => {
         if(window.confirm("Ignorar este cadastro?")) {
            setInbox(prev => prev.filter(i => i.id !== id));
            await deleteInboxItemFromDb(id);
            showToast('Ignorado.', 'info');
         }
    };

    // --- SETTINGS LISTS ---
    const handleAddNewItem = (list: string[], setList: (list: string[]) => void, item: string) => {
        const trimmed = item.trim();
        if (trimmed && !list.some(i => i.toLowerCase() === trimmed.toLowerCase())) {
            setList([...list, trimmed]);
            showToast('Item adicionado.', 'success');
        }
    };
    const handleRemoveItem = (list: string[], setList: (list: string[]) => void, item: string) => {
        if (window.confirm(`Remover "${item}" da lista?`)) {
            setList(list.filter(i => i !== item));
            showToast('Removido.', 'success');
        }
    };

    const handleExport = () => downloadFile('pacientes.csv', exportToCSV(patients), 'text/csv;charset=utf-8');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (loginInput === accessPass) {
            setIsAuthenticated(true);
            setSessionAuth(Date.now()); // Salva sessão
            setView('dashboard');
        } else {
            showToast('Senha incorreta.', 'error');
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setSessionAuth(null);
        setView('landing');
    };
    
    const handleSaveNewPassword = (e: React.FormEvent) => {
        e.preventDefault();
        if (newPasswordInput.length >= 4) {
            setAccessPass(newPasswordInput);
            setLoginInput(newPasswordInput);
            setShowPasswordModal(false);
            setNewPasswordInput('');
            showToast('Senha atualizada!', 'success');
        } else {
            alert('Mínimo 4 caracteres.');
        }
    };

    const copyPublicLink = (mode: string) => {
        const url = `${window.location.origin}${window.location.pathname}?mode=${mode}`;
        navigator.clipboard.writeText(url).then(() => showToast('Link copiado!', 'success'));
    };

    // --- RENDER ---

    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    
    if (mode === 'cadastro' || mode === 'atualizacao' || mode === 'vip') {
        if (!isSupabaseConfigured()) return <div className="p-8 text-center text-white">Erro: Banco de dados não configurado.</div>;
        return (
            <PublicRegistration 
                cloudEndpoint=""
                brandName={brand.name} 
                brandColor={brand.color} 
                brandLogo={brand.logo} 
                isUpdateMode={mode === 'atualizacao'}
                isVipMode={mode === 'vip'}
                convenios={sortedConvenios}
            />
        );
    }
    
    if (view === 'landing') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 relative" style={{ backgroundColor: brand.dark }}>
                <div className="relative z-10 max-w-4xl w-full flex flex-col items-center flex-1 justify-center animate-fade-in">
                    {brand.logo && <img src={brand.logo} alt="Logo" className="h-32 w-32 rounded-3xl mb-8 shadow-2xl" />}
                    <h1 className="text-4xl md:text-7xl font-bold text-center mb-6 font-serif" style={{ color: brand.color }}>{brand.name}</h1>
                    <button onClick={() => setView('login')} className="text-slate-400 hover:text-white text-xs uppercase tracking-widest border border-slate-700/50 px-4 py-2 rounded-full hover:bg-slate-800/50 flex gap-2"><LockIcon className="w-3 h-3"/> Área Restrita</button>
                </div>
            </div>
        );
    }

    if (view === 'login') {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: brand.dark }}>
                <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl w-full max-w-md shadow-2xl">
                    <h2 className="text-2xl font-bold text-center text-white mb-6">Acesso Restrito</h2>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input type="password" placeholder="Senha de acesso" autoFocus value={loginInput} onChange={(e) => setLoginInput(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-center text-lg focus:ring-2 focus:ring-sky-500 outline-none" />
                        <button type="submit" className="w-full text-slate-900 font-bold py-3 rounded-xl hover:opacity-90" style={{ backgroundColor: brand.color }}>Entrar</button>
                    </form>
                    
                    <div className="mt-6 pt-6 border-t border-slate-700 text-center">
                        {connectionStatus === 'checking' && (
                            <p className="text-xs text-slate-500 flex items-center justify-center gap-2">
                                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span> Verificando conexão...
                            </p>
                        )}
                        {connectionStatus === 'connected' && (
                            <p className="text-xs text-green-400 flex items-center justify-center gap-2 bg-green-900/20 py-1.5 rounded-lg border border-green-800/50">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span> Banco de Dados: Online
                            </p>
                        )}
                        {connectionStatus === 'error' && (
                            <div className="bg-red-900/20 py-2 rounded-lg border border-red-800/50">
                                <p className="text-xs text-red-400 flex items-center justify-center gap-2 mb-1">
                                    <span className="w-2 h-2 bg-red-500 rounded-full"></span> Erro de Conexão
                                </p>
                                <p className="text-[10px] text-red-300 opacity-80">Verifique se as tabelas foram criadas no Supabase.</p>
                            </div>
                        )}
                    </div>

                    {toast && <div className="mt-4 text-center text-red-400">{toast.msg}</div>}
                </div>
            </div>
        );
    }

    const showTable = isListVisible || searchTerm || filters.convenio || filters.profissional || filters.faixa;

    if (dbError) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
                <div className="bg-red-900/20 border border-red-800 p-6 rounded-xl text-center max-w-lg">
                    <h2 className="text-xl font-bold text-red-400 mb-2">Erro de Configuração</h2>
                    <p className="text-slate-300">{dbError}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-12 bg-slate-900">
            <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-20 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => setView('landing')}>
                        {brand.logo && <img src={brand.logo} alt="Logo" className="h-10 w-10 rounded-lg bg-slate-800 p-1" />}
                        <h1 className="text-xl font-bold font-serif" style={{ color: brand.color }}>{brand.name}</h1>
                    </div>
                    <nav className="flex space-x-2 bg-slate-800 p-1 rounded-xl overflow-x-auto max-w-full">
                        <button onClick={() => setActiveTab('pacientes')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'pacientes' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}><UserIcon className="w-4 h-4" /> Pacientes</button>
                        <button onClick={() => setActiveTab('agenda')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'agenda' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}><CalendarIcon className="w-4 h-4" /> Agenda</button>
                        <button onClick={() => setActiveTab('funserv')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'funserv' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}><FileTextIcon className="w-4 h-4" /> Funserv</button>
                        <button onClick={() => setShowInbox(true)} className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:text-white border border-slate-700 relative" style={{ color: brand.color }}>
                            <InboxIcon className="w-4 h-4" /> Pré-cadastros
                            {inbox.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{inbox.length}</span>}
                        </button>
                        <button onClick={handleLogout} className="px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-900/20 hover:text-red-300 ml-2 border border-transparent hover:border-red-900/50 transition" title="Sair">
                            <LockIcon className="w-4 h-4" />
                        </button>
                    </nav>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
                {isLoading && (
                    <div className="text-center py-8">
                        <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <p className="text-slate-500">Carregando dados do banco...</p>
                    </div>
                )}

                {!isLoading && activeTab === 'pacientes' && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <PatientForm
                            editingPatient={editingPatient}
                            onSave={handleSavePatient}
                            onClear={() => setEditingPatient(null)}
                            convenios={sortedConvenios}
                            profissionais={sortedProfissionais}
                            especialidades={sortedEspecialidades}
                            onAddConvenio={(c) => handleAddNewItem(convenios, setConvenios, c)}
                            onAddProfissional={(p) => handleAddNewItem(profissionais, setProfissionais, p)}
                            onAddEspecialidade={(e) => handleAddNewItem(especialidades, setEspecialidades, e)}
                            onRemoveConvenio={(c) => handleRemoveItem(convenios, setConvenios, c)}
                            onRemoveProfissional={(p) => handleRemoveItem(profissionais, setProfissionais, p)}
                            onRemoveEspecialidade={(e) => handleRemoveItem(especialidades, setEspecialidades, e)}
                        />
                        <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-2xl backdrop-blur-sm space-y-4 flex flex-col h-fit">
                            <h2 className="text-xl font-bold text-slate-100">Gerenciar Pacientes</h2>
                            <div className="space-y-3">
                                <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none" />
                                <div className="grid grid-cols-3 gap-2">
                                    <select value={filters.convenio} onChange={e => setFilters(f => ({ ...f, convenio: e.target.value }))} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-2 py-2 text-xs outline-none"><option value="">Convênios</option>{sortedConvenios.map(c => <option key={c} value={c}>{c}</option>)}</select>
                                    <select value={filters.profissional} onChange={e => setFilters(f => ({ ...f, profissional: e.target.value }))} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-2 py-2 text-xs outline-none"><option value="">Profissionais</option>{sortedProfissionais.map(p => <option key={p} value={p}>{p}</option>)}</select>
                                    <select value={filters.faixa} onChange={e => setFilters(f => ({ ...f, faixa: e.target.value }))} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-2 py-2 text-xs outline-none"><option value="">Faixa</option><option value="Criança">Criança</option><option value="Adulto">Adulto</option></select>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => setIsListVisible(true)} className="bg-slate-700 text-slate-200 px-3 py-1.5 rounded text-xs">Listar Todos</button>
                                    <div className="flex-grow"></div>
                                    <button onClick={handleExport} title="CSV" className="bg-slate-700 text-slate-200 px-3 py-1.5 rounded text-xs"><DownloadIcon className="w-3.5 h-3.5" /></button>
                                </div>
                            </div>
                            {showTable ? (
                                <>
                                    <PatientTable patients={filteredPatients} onEdit={handleEditPatient} onDelete={handleDeletePatient} />
                                    <p className="text-xs text-slate-500 text-right">{filteredPatients.length} registros</p>
                                </>
                            ) : (
                                <div className="text-center py-8 text-slate-500"><p>Use a busca ou filtros para encontrar pacientes.</p></div>
                            )}
                        </section>
                    </div>
                )}

                {!isLoading && activeTab === 'agenda' && (
                    <div className="max-w-4xl mx-auto">
                        <Agenda 
                            patients={patients} 
                            profissionais={sortedProfissionais} 
                            appointments={appointments} 
                            onAddAppointment={handleAddAppointment} 
                            onAddBatchAppointments={handleAddBatchAppointments}
                            onUpdateAppointment={handleUpdateAppointment} 
                            onDeleteAppointment={handleDeleteAppointment} 
                        />
                        <div className="mt-6 flex justify-between items-center border-t border-slate-800 pt-4">
                             <button onClick={() => setShowPasswordModal(true)} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"><LockIcon className="w-3 h-3" /> Alterar senha de acesso</button>
                             <div className="flex items-center gap-1 text-xs text-green-500"><CloudIcon className="w-3 h-3"/> Banco de Dados Conectado</div>
                        </div>
                    </div>
                )}

                {!isLoading && activeTab === 'funserv' && (
                    <div className="max-w-6xl mx-auto">
                        <FunservManager patients={patients} onSavePatient={handleSavePatient} />
                    </div>
                )}
            </main>

            {showInbox && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2"><InboxIcon className="w-5 h-5" style={{ color: brand.color }}/> Novos Pré-cadastros</h3>
                            <button onClick={() => setShowInbox(false)} className="text-slate-400 hover:text-slate-200"><XIcon className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-sky-900/20 border border-sky-800 p-3 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="text-xs text-sky-300 font-medium">Link para Novos Pacientes:</p>
                                    <p className="text-[10px] text-slate-400 break-all">{window.location.origin}{window.location.pathname}?mode=cadastro</p>
                                </div>
                                <button onClick={() => copyPublicLink('cadastro')} className="text-xs bg-sky-700 hover:bg-sky-600 text-white px-2 py-1 rounded transition whitespace-nowrap">Copiar</button>
                            </div>
                            <div className="bg-amber-900/20 border border-amber-800 p-3 rounded-lg flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-1">
                                        <p className="text-xs text-amber-300 font-medium">Link para Pacientes Antigos (VIP):</p>
                                        <StarIcon className="w-3 h-3 text-amber-400" />
                                    </div>
                                    <p className="text-[10px] text-slate-400 break-all">{window.location.origin}{window.location.pathname}?mode=vip</p>
                                </div>
                                <button onClick={() => copyPublicLink('vip')} className="text-xs bg-amber-700 hover:bg-amber-600 text-white px-2 py-1 rounded transition whitespace-nowrap">Copiar</button>
                            </div>

                            {inbox.length === 0 ? (
                                <div className="text-center py-8 text-slate-500"><p>Nenhum pré-cadastro novo encontrado.</p></div>
                            ) : (
                                inbox.map(item => (
                                    <div key={item.id} className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                                        <div>
                                            <h4 className="font-bold text-white">{item.nome}</h4>
                                            <p className="text-sm text-slate-400">Nasc: {item.nascimento} • Resp: {item.responsavel || 'N/A'}</p>
                                            <p className="text-sm text-slate-500 mt-1">{item.convenio ? `${item.convenio} (${item.carteirinha})` : 'Particular'}</p>
                                            {item.profissional && (
                                                <p className="text-xs text-sky-400 mt-0.5 font-medium flex items-center gap-1">
                                                    <UserIcon className="w-3 h-3" /> Pref: {item.profissional}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleDismissInboxItem(item.id)} className="p-2 hover:bg-red-900/30 text-red-400 rounded-lg transition text-sm">Ignorar</button>
                                            <button onClick={() => handleImportInboxItem(item)} className="py-2 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition text-sm font-semibold">Importar</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showPasswordModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2"><LockIcon className="w-5 h-5 text-sky-400"/> Alterar Senha</h3>
                            <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-slate-200"><XIcon className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSaveNewPassword} className="space-y-4">
                            <input type="password" required value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 outline-none" placeholder="Nova senha..." />
                            <button type="submit" className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 rounded-lg transition">Salvar</button>
                        </form>
                    </div>
                </div>
            )}

            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in border ${toast.type === 'success' ? 'bg-green-900/90 border-green-700 text-green-100' : 'bg-red-900/90 border-red-700 text-red-100'}`}>
                    <CheckIcon className="w-6 h-6" /> <span className="font-medium text-sm">{toast.msg}</span>
                </div>
            )}
        </div>
    );
};

export default App;