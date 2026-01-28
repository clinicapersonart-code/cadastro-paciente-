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
import { Inbox } from './components/Inbox';
import { DownloadIcon, CloudIcon, UserIcon, CalendarIcon, InboxIcon, CheckIcon, XIcon, LockIcon, FileTextIcon, StarIcon, UploadIcon, ShieldIcon, FilterIcon } from './components/icons';

const App: React.FC = () => {
    const [convenios, setConvenios] = useLocalStorage<string[]>(STORAGE_KEYS.CONVENIOS, DEFAULT_CONVENIOS);
    const [profissionais, setProfissionais] = useLocalStorage<string[]>(STORAGE_KEYS.PROFISSIONAIS, DEFAULT_PROFISSIONAIS);
    const [especialidades, setEspecialidades] = useLocalStorage<string[]>(STORAGE_KEYS.ESPECIALIDADES, DEFAULT_ESPECIALIDADES);
    const [activeTab, setActiveTab] = useLocalStorage<'pacientes' | 'agenda' | 'funserv' | 'inbox'>('personart.view.tab', 'pacientes');
    const [brand] = useLocalStorage<BrandConfig>(STORAGE_KEYS.BRAND, { color: '#e9c49e', dark: '#273e44', logo: null, name: 'Clínica Personart' });
    const [accessPass, setAccessPass] = useLocalStorage<string>(STORAGE_KEYS.ACCESS_PASS, 'personart');
    const [sessionAuth, setSessionAuth] = useLocalStorage<number | null>('personart.auth.session', null);

    // MUDANÇA PRINCIPAL: Usar LocalStorage como "Cache" para garantir que os dados apareçam mesmo sem internet/nuvem
    const [patients, setPatients] = useLocalStorage<Patient[]>('personart.patients.db', []);
    const [appointments, setAppointments] = useLocalStorage<Appointment[]>('personart.appointments.db', []);

    const [inbox, setInbox] = useState<PreCadastro[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dbError, setDbError] = useState('');
    const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error' | 'offline'>('checking');

    const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ convenio: '', profissional: '', faixa: '' });
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [view, setView] = useState<'landing' | 'login' | 'dashboard'>('landing');
    const [loginInput, setLoginInput] = useState('');
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' | 'info' } | null>(null);
    const [showLinksModal, setShowLinksModal] = useState(false);

    // --- ROTEAMENTO PÚBLICO ---
    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get('page');

    if (pageParam === 'cadastro' || pageParam === 'update' || pageParam === 'vip') {
        const isVip = pageParam === 'vip';
        const isUpdate = pageParam === 'update';

        return (
            <PublicRegistration
                cloudEndpoint=""
                brandName={brand.name}
                brandColor={brand.color}
                brandLogo={brand.logo}
                convenios={convenios}
                isVipMode={isVip}
                isUpdateMode={isUpdate}
            />
        );
    }

    useEffect(() => {
        const initSystem = async () => {
            if (sessionAuth) {
                const now = Date.now();
                if (now - sessionAuth < 14400000) {
                    setIsAuthenticated(true);
                    setView('dashboard');
                } else {
                    setSessionAuth(null);
                }
            }
        };
        initSystem();
    }, [sessionAuth, setSessionAuth]);

    useEffect(() => {
        if (isAuthenticated) {
            const fetchData = async () => {
                setIsLoading(true);

                // Se não tem supabase configurado, entra em modo offline
                if (!isSupabaseConfigured() || !supabase) {
                    setConnectionStatus('offline');
                    setIsLoading(false);
                    return;
                }

                try {
                    const { data: patData, error: patError } = await supabase.from('patients').select('*');
                    if (patError) throw patError;

                    if (patData) {
                        // Sincroniza Nuvem -> Local
                        setPatients(patData.map((row: any) => row.data));
                    }

                    const { data: apptData, error: apptError } = await supabase.from('appointments').select('*');
                    if (!apptError && apptData) {
                        setAppointments(apptData.map((row: any) => row.data));
                    }

                    const { data: inboxData } = await supabase.from('inbox').select('*');
                    if (inboxData) setInbox(inboxData.map((row: any) => row.data));

                    setConnectionStatus('connected');
                    setDbError('');
                } catch (err: any) {
                    console.error('Erro de conexão:', err);
                    setDbError('Conexão instável. Operando com dados locais.');
                    setConnectionStatus('error');
                    // Não limpamos 'patients', mantendo os dados locais visíveis
                } finally {
                    setIsLoading(false);
                }
            };
            fetchData();
        }
    }, [isAuthenticated]);

    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const handleSavePatient = async (patient: Patient, initialAppointment?: any) => {
        const newPatientId = patient.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        const numAut = patient.funservConfig?.numeroAutorizacao || patient.numero_autorizacao || '';
        const dataAut = patient.funservConfig?.dataAutorizacao || patient.data_autorizacao || null;

        const patientToSave = { ...patient, id: newPatientId, numero_autorizacao: numAut, data_autorizacao: dataAut };
        const cleanData = JSON.parse(JSON.stringify(patientToSave));

        // 1. Atualiza Localmente Imediatamente (Optimistic UI)
        setPatients(prev => {
            const exists = prev.find(p => p.id === newPatientId);
            return exists ? prev.map(p => p.id === newPatientId ? patientToSave : p) : [...prev, patientToSave];
        });
        setEditingPatient(null);

        // 2. Tenta salvar na Nuvem
        if (supabase && connectionStatus !== 'offline') {
            const { error } = await supabase.from('patients').upsert({
                id: newPatientId,
                nome: patientToSave.nome,
                carteirinha: patientToSave.carteirinha || '',
                numero_autorizacao: numAut,
                data_autorizacao: dataAut,
                data: cleanData
            });

            if (error) {
                showToast(`Salvo localmente. Erro na nuvem: ${error.message}`, 'error');
            } else {
                showToast('Paciente salvo e sincronizado!', 'success');
            }
        } else {
            showToast('Paciente salvo apenas localmente (Offline).', 'info');
        }

        if (initialAppointment) {
            const newAppt: Appointment = {
                id: crypto.randomUUID(),
                patientId: newPatientId,
                patientName: patientToSave.nome,
                carteirinha: patientToSave.carteirinha,
                numero_autorizacao: numAut,
                data_autorizacao: dataAut,
                profissional: initialAppointment.professional,
                date: initialAppointment.date,
                time: initialAppointment.time,
                type: initialAppointment.type,
                status: 'Agendado',
                convenioName: patientToSave.convenio,
                obs: 'Agendamento Inicial'
            };
            await handleAddAppointment(newAppt);
        }
    };

    const handleAddAppointment = async (appt: Appointment) => {
        const patient = patients.find(p => p.id === appt.patientId);
        const enrichedAppt = {
            ...appt,
            numero_autorizacao: patient?.funservConfig?.numeroAutorizacao || patient?.numero_autorizacao || appt.numero_autorizacao || '',
            data_autorizacao: patient?.funservConfig?.dataAutorizacao || patient?.data_autorizacao || appt.data_autorizacao || null
        };

        // Salva local
        setAppointments(prev => [...prev, enrichedAppt]);

        // Salva nuvem
        if (supabase && connectionStatus !== 'offline') {
            const { error } = await supabase.from('appointments').upsert({
                id: enrichedAppt.id,
                date: enrichedAppt.date,
                patient_id: enrichedAppt.patientId,
                status: enrichedAppt.status,
                carteirinha: enrichedAppt.carteirinha || '',
                numero_autorizacao: enrichedAppt.numero_autorizacao || '',
                data_autorizacao: enrichedAppt.data_autorizacao,
                data: JSON.parse(JSON.stringify(enrichedAppt))
            });
            if (error) console.error("Erro agendamento nuvem:", error);
        }
    };

    const handleAddBatchAppointments = async (batch: Appointment[]) => {
        // Local
        const enrichedBatch = batch.map(a => {
            const patient = patients.find(p => p.id === a.patientId);
            return {
                ...a,
                numero_autorizacao: patient?.funservConfig?.numeroAutorizacao || patient?.numero_autorizacao || '',
                data_autorizacao: patient?.funservConfig?.dataAutorizacao || patient?.data_autorizacao || null
            };
        });
        setAppointments(prev => [...prev, ...enrichedBatch]);

        // Nuvem
        if (supabase && connectionStatus !== 'offline') {
            const records = enrichedBatch.map(a => ({
                id: a.id,
                date: a.date,
                patient_id: a.patientId,
                status: a.status,
                carteirinha: a.carteirinha || '',
                numero_autorizacao: a.numero_autorizacao || '',
                data_autorizacao: a.data_autorizacao,
                data: JSON.parse(JSON.stringify(a))
            }));

            const { error } = await supabase.from('appointments').upsert(records);
            if (error) console.error("Erro batch nuvem:", error);
        }
    };

    const handleUpdateAppointment = async (appt: Appointment) => {
        setAppointments(prev => prev.map(x => x.id === appt.id ? appt : x));

        if (supabase && connectionStatus !== 'offline') {
            await supabase.from('appointments').upsert({
                id: appt.id,
                date: appt.date,
                patient_id: appt.patientId,
                status: appt.status,
                carteirinha: appt.carteirinha || '',
                numero_autorizacao: appt.numero_autorizacao || '',
                data_autorizacao: appt.data_autorizacao || null,
                data: JSON.parse(JSON.stringify(appt))
            });
        }
    };

    const handleDeleteAppointment = async (id: string) => {
        setAppointments(prev => prev.filter(x => x.id !== id));
        if (supabase && connectionStatus !== 'offline') {
            await supabase.from('appointments').delete().eq('id', id);
        }
    };

    const handleLogout = () => { setSessionAuth(null); setIsAuthenticated(false); setView('landing'); };
    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (loginInput === accessPass) { setSessionAuth(Date.now()); setIsAuthenticated(true); setView('dashboard'); }
        else showToast('Senha incorreta', 'error');
    };

    const filteredPatients = useMemo(() => {
        return patients.filter(p => {
            const s = searchTerm.toLowerCase();
            if (s && !p.nome.toLowerCase().includes(s) && !p.carteirinha?.includes(s)) return false;
            if (filters.convenio && p.convenio !== filters.convenio) return false;
            if (filters.profissional && !p.profissionais.includes(filters.profissional)) return false;
            if (filters.faixa && p.faixa !== filters.faixa) return false;
            return true;
        }).sort((a, b) => a.nome.localeCompare(b.nome));
    }, [patients, searchTerm, filters]);

    const copyLink = (path: string) => {
        const url = `${window.location.origin}${window.location.pathname}${path}`;
        navigator.clipboard.writeText(url);
        showToast('Link copiado para a área de transferência!', 'success');
    };

    if (view === 'landing') return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: brand.dark }}>
            <h1 className="text-5xl font-bold mb-8" style={{ color: brand.color }}>{brand.name}</h1>
            <button onClick={() => setView('login')} className="bg-slate-800 text-white px-8 py-3 rounded-full hover:bg-slate-700 transition">Acessar Sistema</button>
        </div>
    );

    if (view === 'login') return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
            <form onSubmit={handleLogin} className="bg-slate-800 p-8 rounded-2xl w-full max-sm border border-slate-700 shadow-2xl">
                <h2 className="text-2xl font-bold text-white mb-6 text-center">Login</h2>
                <input type="password" value={loginInput} onChange={e => setLoginInput(e.target.value)} placeholder="Senha de acesso" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-center mb-4 focus:ring-2 focus:ring-sky-500 outline-none" autoFocus />
                <button type="submit" className="w-full bg-sky-600 text-white font-bold py-3 rounded-xl">Entrar</button>
            </form>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100">
            <header className="bg-slate-800/50 border-b border-slate-700 p-4 sticky top-0 z-50 backdrop-blur-md">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h1 className="font-bold text-xl cursor-pointer" onClick={() => setActiveTab('pacientes')} style={{ color: brand.color }}>{brand.name}</h1>
                        {/* Indicador de Status da Conexão */}
                        {connectionStatus === 'error' && (
                            <span className="text-[10px] bg-red-900/50 text-red-400 border border-red-800 px-2 py-0.5 rounded-full flex items-center gap-1" title={dbError}>
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div> Offline
                            </span>
                        )}
                        {connectionStatus === 'connected' && (
                            <span className="text-[10px] bg-green-900/30 text-green-400 border border-green-800/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Online
                            </span>
                        )}
                        {isLoading && (
                            <span className="text-[10px] text-slate-500 animate-pulse">Sincronizando...</span>
                        )}
                    </div>

                    <nav className="flex gap-2 items-center">
                        <button onClick={() => setActiveTab('pacientes')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'pacientes' ? 'bg-sky-600' : 'hover:bg-slate-700'}`}>Pacientes</button>
                        <button onClick={() => setActiveTab('agenda')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'agenda' ? 'bg-sky-600' : 'hover:bg-slate-700'}`}>Agenda</button>
                        <button onClick={() => setActiveTab('funserv')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'funserv' ? 'bg-sky-600' : 'hover:bg-slate-700'}`}>Funserv</button>
                        <button onClick={() => setActiveTab('inbox')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${activeTab === 'inbox' ? 'bg-sky-600' : 'hover:bg-slate-700'}`}>
                            <InboxIcon className="w-4 h-4" />
                            Inbox
                            {inbox.length > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{inbox.length}</span>}
                        </button>

                        <button
                            onClick={() => setShowLinksModal(true)}
                            className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg ml-2 flex items-center gap-2"
                            title="Links de Cadastro"
                        >
                            <UploadIcon className="w-5 h-5" />
                        </button>

                        <button onClick={handleLogout} className="p-2 text-red-400 hover:text-red-300 ml-1"><LockIcon className="w-5 h-5" /></button>
                    </nav>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6">
                {dbError && activeTab === 'pacientes' && patients.length === 0 && (
                    <div className="bg-red-900/20 border border-red-800/50 text-red-300 p-4 rounded-xl mb-6 flex items-center gap-3">
                        <ShieldIcon className="w-6 h-6" />
                        <div>
                            <p className="font-bold">Modo Offline Ativado</p>
                            <p className="text-sm opacity-80">{dbError}. Seus dados estão sendo salvos localmente neste navegador.</p>
                        </div>
                    </div>
                )}

                {activeTab === 'pacientes' && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        <PatientForm
                            editingPatient={editingPatient}
                            onSave={handleSavePatient}
                            onClear={() => setEditingPatient(null)}
                            convenios={convenios} profissionais={profissionais} especialidades={especialidades}
                            onAddConvenio={c => setConvenios(prev => [...prev, c])}
                            onAddProfissional={p => setProfissionais(prev => [...prev, p])}
                            onAddEspecialidade={e => setEspecialidades(prev => [...prev, e])}
                            onRemoveConvenio={c => setConvenios(prev => prev.filter(x => x !== c))}
                            onRemoveProfissional={p => setProfissionais(prev => prev.filter(x => x !== p))}
                            onRemoveEspecialidade={e => setEspecialidades(prev => prev.filter(x => x !== e))}
                        />
                        <div className="space-y-4">
                            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3">
                                <div className="flex items-center gap-2 mb-2 text-slate-400 text-sm font-bold uppercase tracking-wider">
                                    <FilterIcon className="w-4 h-4" /> Filtros Avançados
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <select
                                        value={filters.profissional}
                                        onChange={e => setFilters(prev => ({ ...prev, profissional: e.target.value }))}
                                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:ring-2 focus:ring-sky-500"
                                    >
                                        <option value="">Todos os Profissionais</option>
                                        {profissionais.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>

                                    <select
                                        value={filters.convenio}
                                        onChange={e => setFilters(prev => ({ ...prev, convenio: e.target.value }))}
                                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:ring-2 focus:ring-sky-500"
                                    >
                                        <option value="">Todos os Convênios</option>
                                        {convenios.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>

                                    <div className="flex gap-2">
                                        <select
                                            value={filters.faixa}
                                            onChange={e => setFilters(prev => ({ ...prev, faixa: e.target.value }))}
                                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:ring-2 focus:ring-sky-500 flex-1"
                                        >
                                            <option value="">Todas as Faixas</option>
                                            <option value="Criança">Criança</option>
                                            <option value="Adulto">Adulto</option>
                                        </select>
                                        {(filters.profissional || filters.convenio || filters.faixa) && (
                                            <button
                                                onClick={() => setFilters({ convenio: '', profissional: '', faixa: '' })}
                                                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs transition"
                                                title="Limpar Filtros"
                                            >
                                                Limpar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <input type="text" placeholder="Buscar por nome ou carteirinha..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500" />
                            <PatientTable patients={filteredPatients} onEdit={p => { setEditingPatient(p); window.scrollTo(0, 0); }} onDelete={async id => { if (confirm('Excluir?')) { await supabase?.from('patients').delete().eq('id', id).catch(() => { }); setPatients(prev => prev.filter(p => p.id !== id)); } }} />
                        </div>
                    </div>
                )}
                {activeTab === 'agenda' && <Agenda patients={patients} profissionais={profissionais} appointments={appointments} onAddAppointment={handleAddAppointment} onAddBatchAppointments={handleAddBatchAppointments} onUpdateAppointment={handleUpdateAppointment} onDeleteAppointment={handleDeleteAppointment} />}
                {activeTab === 'funserv' && <FunservManager patients={patients} onSavePatient={handleSavePatient} />}
                {activeTab === 'inbox' && (
                    <Inbox
                        inbox={inbox}
                        onApprove={async (item) => {
                            // Calcula faixa etária
                            const age = item.nascimento ? Math.floor((Date.now() - new Date(item.nascimento).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
                            const faixa = age < 18 ? 'Criança' : 'Adulto';

                            const newPatient: Patient = {
                                id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                                nome: item.nome,
                                nascimento: item.nascimento,
                                faixa: faixa,
                                responsavel: item.responsavel,
                                endereco: item.endereco,
                                contato: item.contato,
                                email: item.email,
                                convenio: item.convenio,
                                carteirinha: item.carteirinha,
                                crm: item.crm,
                                origem: item.origem,
                                profissionais: item.profissional ? [item.profissional] : [],
                                especialidades: [],
                            };

                            await handleSavePatient(newPatient);

                            // Remove do inbox
                            if (supabase) {
                                await supabase.from('inbox').delete().eq('id', item.id);
                            }
                            setInbox(prev => prev.filter(i => i.id !== item.id));
                            showToast(`Paciente "${item.nome}" aprovado e adicionado!`, 'success');
                        }}
                        onDelete={async (id) => {
                            if (supabase) {
                                await supabase.from('inbox').delete().eq('id', id);
                            }
                            setInbox(prev => prev.filter(i => i.id !== id));
                            showToast('Pré-cadastro excluído.', 'info');
                        }}
                    />
                )}
            </main>

            {/* Modal de Links */}
            {showLinksModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-fade-in">
                        <button onClick={() => setShowLinksModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><XIcon className="w-6 h-6" /></button>
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <UploadIcon className="w-5 h-5 text-sky-400" /> Links de Cadastro
                        </h3>
                        <p className="text-sm text-slate-400 mb-6">Envie estes links para que os pacientes preencham seus dados antes da consulta.</p>

                        <div className="space-y-4">
                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="bg-green-900/30 p-2 rounded-lg"><UserIcon className="w-5 h-5 text-green-400" /></div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-white text-sm">Novo Paciente</h4>
                                        <p className="text-xs text-slate-500">Cadastro completo inicial</p>
                                    </div>
                                </div>
                                <button onClick={() => copyLink('?page=cadastro')} className="w-full bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-mono py-2 rounded border border-slate-600 transition">
                                    Copiar Link de Cadastro
                                </button>
                            </div>

                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="bg-amber-900/30 p-2 rounded-lg"><StarIcon className="w-5 h-5 text-amber-400" /></div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-white text-sm">Link VIP / Pesquisa</h4>
                                        <p className="text-xs text-slate-500">Atualização cadastral e Google Review</p>
                                    </div>
                                </div>
                                <button onClick={() => copyLink('?page=vip')} className="w-full bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-mono py-2 rounded border border-slate-600 transition">
                                    Copiar Link VIP
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className={`fixed bottom-4 right-4 p-4 rounded-xl shadow-2xl border animate-fade-in ${toast.type === 'error' ? 'bg-red-900 border-red-700' : 'bg-green-900 border-green-700'}`}>{toast.msg}</div>}
        </div>
    );
};

export default App;
