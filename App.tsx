import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Patient, BrandConfig, Appointment, PreCadastro, UserProfile } from './types';
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
import { LoginScreen } from './components/LoginScreen';
import { MedicalRecord } from './components/MedicalRecord';
import { PatientPortal } from './components/PatientPortal';
import { UserManager } from './components/UserManager';
import { DownloadIcon, CloudIcon, UserIcon, CalendarIcon, InboxIcon, CheckIcon, XIcon, LockIcon, FileTextIcon, StarIcon, UploadIcon, ShieldIcon, FilterIcon, EditIcon, PlusIcon } from './components/icons';

const App: React.FC = () => {
    const [convenios, setConvenios] = useLocalStorage<string[]>(STORAGE_KEYS.CONVENIOS, DEFAULT_CONVENIOS);
    const [profissionais, setProfissionais] = useLocalStorage<string[]>(STORAGE_KEYS.PROFISSIONAIS, DEFAULT_PROFISSIONAIS);
    const [especialidades, setEspecialidades] = useLocalStorage<string[]>(STORAGE_KEYS.ESPECIALIDADES, DEFAULT_ESPECIALIDADES);
    const [activeTab, setActiveTab] = useLocalStorage<'pacientes' | 'agenda' | 'funserv' | 'inbox' | 'prontuario' | 'cadastro'>('personart.view.tab', 'pacientes');
    const [brand] = useLocalStorage<BrandConfig>(STORAGE_KEYS.BRAND, { color: '#e9c49e', dark: '#273e44', logo: null, name: 'Clínica Personart' });

    // --- NOVO SISTEMA DE AUTH (V2.0) ---
    // User Session: armazena objeto completo do usuário logado
    const [currentUser, setCurrentUser] = useLocalStorage<UserProfile | null>('personart.auth.user_v2', null);

    // Users DB: Lista de todos usuários cadastrados
    const [users, setUsers] = useLocalStorage<UserProfile[]>('personart.users_v2', []);

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
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showUserManager, setShowUserManager] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
    const [passwordError, setPasswordError] = useState('');

    // Estado para Prontuário
    const [selectedPatientForRecord, setSelectedPatientForRecord] = useState<Patient | null>(null);
    const [medicalRecords, setMedicalRecords] = useLocalStorage<Record<string, import('./types').MedicalRecordChunk[]>>('personart.medical_records.db', {});

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

    // --- INICIALIZAÇÃO E MIGRAÇÃO V2.0 ---
    useEffect(() => {
        // 1. Seed Inicial de Usuários (se vazio)
        if (users.length === 0) {
            // Clínica: acesso total ao sistema
            const clinicUser: UserProfile = {
                id: 'clinic-01',
                name: 'Clínica Personart',
                role: 'clinic',
                active: true,
                pin: 'personart' // Senha da clínica
            };

            // Responsável Técnico: apenas prontuário (todos pacientes)
            const defaultAdmin: UserProfile = {
                id: 'admin-01',
                name: 'Responsável Técnico',
                role: 'admin',
                active: true,
                pin: '1234'
            };

            // Tenta migrar profissionais da lista antiga para usuários
            const migratedPros: UserProfile[] = profissionais.map(p => ({
                id: `pro-${Math.random().toString(36).substr(2, 9)}`,
                name: p.replace(/ - CRP.*/, ''), // Remove CRP do nome se tiver
                role: 'professional',
                active: true,
                pin: '1234' // Senha padrão inicial
            }));

            setUsers([clinicUser, defaultAdmin, ...migratedPros]);
        }
    }, [users.length]); // Roda apenas se users estiver vazio

    useEffect(() => {
        // Validação de Sessão
        if (currentUser) {
            setIsAuthenticated(true);
            setView('dashboard');
        } else {
            setIsAuthenticated(false);
            // Se estiver na rota publica, ok. Se não, vai pro login
            if (!pageParam) setView('landing');
        }
    }, [currentUser]);

    useEffect(() => {
        if (isAuthenticated && currentUser) {
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

    // Handler para atualizar paciente (usado pelo PatientPortal)
    const handlePatientUpdate = (updatedPatient: Patient) => {
        setPatients(prev => prev.map(p => p.id === updatedPatient.id ? updatedPatient : p));
        showToast('Dados do paciente atualizados!', 'success');
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

    const handleLogout = () => {
        setCurrentUser(null);
        setIsAuthenticated(false);
        setView('landing');
    };

    const handleChangePassword = () => {
        setPasswordError('');

        if (!currentUser) return;

        // Valida senha atual
        if (currentUser.pin && currentUser.pin !== passwordForm.current) {
            setPasswordError('Senha atual incorreta.');
            return;
        }

        // Valida nova senha
        if (passwordForm.new.length < 4) {
            setPasswordError('A nova senha deve ter pelo menos 4 caracteres.');
            return;
        }

        // Confirma nova senha
        if (passwordForm.new !== passwordForm.confirm) {
            setPasswordError('As senhas não coincidem.');
            return;
        }

        // Atualiza usuário
        setUsers(prev => prev.map(u =>
            u.id === currentUser.id ? { ...u, pin: passwordForm.new } : u
        ));
        setCurrentUser({ ...currentUser, pin: passwordForm.new });

        // Limpa e fecha
        setPasswordForm({ current: '', new: '', confirm: '' });
        setShowPasswordModal(false);
        showToast('Senha alterada com sucesso!', 'success');
    };

    const handleLoginSuccess = (user: UserProfile) => {
        setCurrentUser(user);
        setIsAuthenticated(true);
        setView('dashboard');

        // Se não for Clínica, força aba do Prontuário
        if (user.role !== 'clinic') {
            setActiveTab('prontuario');
        }

        showToast(`Bem-vindo(a), ${user.name.split(' ')[0]}!`, 'success');
    };

    const filteredPatients = useMemo(() => {
        return patients.filter(p => {
            // RBAC: Profissionais só veem seus próprios pacientes
            if (currentUser?.role === 'professional') {
                // Verifica se o nome do profissional está na lista de profissionais do paciente
                const professionalName = currentUser.name;
                const patientProfessionals = p.profissionais || [];

                // Busca correspondência parcial (ex: "Simone" bate com "Simone - CRP 06/123")
                const isAssigned = patientProfessionals.some(prof =>
                    prof.toLowerCase().includes(professionalName.toLowerCase()) ||
                    professionalName.toLowerCase().includes(prof.toLowerCase().split(' - ')[0])
                );

                if (!isAssigned) return false;
            }

            const s = searchTerm.toLowerCase();
            if (s && !p.nome.toLowerCase().includes(s) && !p.carteirinha?.includes(s)) return false;
            if (filters.convenio && p.convenio !== filters.convenio) return false;
            if (filters.profissional && !p.profissionais.includes(filters.profissional)) return false;
            if (filters.faixa && p.faixa !== filters.faixa) return false;
            return true;
        }).sort((a, b) => a.nome.localeCompare(b.nome));
    }, [patients, searchTerm, filters, currentUser]);

    const copyLink = (path: string) => {
        const url = `${window.location.origin}${window.location.pathname}${path}`;
        navigator.clipboard.writeText(url);
        showToast('Link copiado para a área de transferência!', 'success');
    };

    // --- HANDLERS DE GERENCIAMENTO DE USUÁRIOS ---
    const handleAddUser = (newUser: UserProfile) => {
        setUsers(prev => [...prev, newUser]);

        // SINCRONIZAÇÃO: Se for profissional, adiciona na lista de profissionais
        if (newUser.role === 'professional') {
            const displayName = newUser.professionalRegister
                ? `${newUser.name} - ${newUser.professionalRegister}`
                : newUser.name;

            // Evita duplicatas
            setProfissionais(prev => {
                if (prev.some(p => p.toLowerCase().includes(newUser.name.toLowerCase()))) {
                    return prev;
                }
                return [...prev, displayName];
            });

            // Adiciona especialidade se houver
            if (newUser.specialty) {
                setEspecialidades(prev => {
                    if (prev.includes(newUser.specialty!)) return prev;
                    return [...prev, newUser.specialty!];
                });
            }
        }

        showToast(`Usuário "${newUser.name}" criado com sucesso!`, 'success');
    };

    const handleUpdateUser = (updatedUser: UserProfile) => {
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));

        // Atualiza sessão se for o usuário logado
        if (currentUser?.id === updatedUser.id) {
            setCurrentUser(updatedUser);
        }

        showToast(`Usuário "${updatedUser.name}" atualizado!`, 'success');
    };

    if (view === 'landing') return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: brand.dark }}>
            <h1 className="text-5xl font-bold mb-8" style={{ color: brand.color }}>{brand.name}</h1>
            <button onClick={() => setView('login')} className="bg-slate-800 text-white px-8 py-3 rounded-full hover:bg-slate-700 transition">Acessar Sistema</button>
        </div>
    );

    if (view === 'login') return (
        <LoginScreen users={users} brand={brand} onLogin={handleLoginSuccess} />
    );

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-[#e9c49e]/30 selection:text-[#e9c49e]">
            <header className="bg-slate-900/60 border-b border-[#e9c49e]/10 p-4 sticky top-0 z-50 backdrop-blur-xl shadow-lg shadow-black/20">
                <div className="max-w-7xl mx-auto flex justify-between items-center transition-all">
                    <div className="flex items-center gap-4">
                        <h1 className="font-bold text-2xl cursor-pointer tracking-tight hover:opacity-80 transition-opacity" onClick={() => setActiveTab('pacientes')} style={{ color: '#e9c49e', textShadow: '0 0 20px rgba(233, 196, 158, 0.2)' }}>{brand.name}</h1>

                        {/* Saudação Usuário */}
                        {currentUser && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/40 rounded-full border border-slate-700/50 backdrop-blur-md">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${currentUser.role === 'admin' ? 'bg-[#e9c49e]/20 text-[#e9c49e]' : 'bg-[#273e44] text-[#e9c49e]'}`}>
                                    {currentUser.name.charAt(0)}
                                </div>
                                <span className="text-xs text-slate-300 font-medium">
                                    {currentUser.name.split(' ')[0]}
                                    <span className="text-slate-500 ml-1 opacity-75">({currentUser.role === 'admin' ? 'Adm' : 'Pro'})</span>
                                </span>
                            </div>
                        )}

                        {/* Indicador de Status da Conexão */}
                        {connectionStatus === 'error' && (
                            <span className="text-[10px] bg-red-900/20 text-red-400 border border-red-800/30 px-3 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm" title={dbError}>
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div> Offline
                            </span>
                        )}
                        {connectionStatus === 'connected' && (
                            <span className="text-[10px] bg-[#273e44]/20 text-[#e9c49e]/80 border border-[#273e44]/50 px-3 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#e9c49e] shadow-[0_0_8px_rgba(233,196,158,0.4)]"></div> Online
                            </span>
                        )}
                        {isLoading && (
                            <span className="text-[10px] text-[#e9c49e]/50 animate-pulse flex items-center gap-2">
                                <div className="w-3 h-3 border-2 border-[#e9c49e]/20 border-t-[#e9c49e] rounded-full animate-spin" />
                                Sincronizando
                            </span>
                        )}
                    </div>

                    <nav className="flex gap-1 items-center bg-slate-900/50 p-1 rounded-xl border border-white/5">
                        {/* Abas visíveis apenas para Clínica */}
                        {currentUser?.role === 'clinic' && (
                            <>
                                <button
                                    onClick={() => setActiveTab('pacientes')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'pacientes'
                                        ? 'bg-[#273e44] text-[#e9c49e] shadow-lg shadow-[#273e44]/20 border border-[#e9c49e]/10'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                        }`}
                                >
                                    Pacientes
                                </button>
                                <button
                                    onClick={() => setActiveTab('agenda')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'agenda'
                                        ? 'bg-[#273e44] text-[#e9c49e] shadow-lg shadow-[#273e44]/20 border border-[#e9c49e]/10'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                        }`}
                                >
                                    Agenda
                                </button>
                                <button
                                    onClick={() => setActiveTab('funserv')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'funserv'
                                        ? 'bg-[#273e44] text-[#e9c49e] shadow-lg shadow-[#273e44]/20 border border-[#e9c49e]/10'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                        }`}
                                >
                                    Funserv
                                </button>
                                <button
                                    onClick={() => setActiveTab('inbox')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 ${activeTab === 'inbox'
                                        ? 'bg-[#273e44] text-[#e9c49e] shadow-lg shadow-[#273e44]/20 border border-[#e9c49e]/10'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                        }`}
                                >
                                    <span className="relative">
                                        Inbox
                                        {inbox.filter((msg: any) => !msg.read).length > 0 && (
                                            <span className="absolute -top-1 -right-2 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                                        )}
                                    </span>
                                </button>
                            </>
                        )}

                        {/* Prontuário visível apenas para profissionais e admin */}
                        {currentUser?.role !== 'clinic' && (
                            <>
                                <button onClick={() => setActiveTab('agenda')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${activeTab === 'agenda' ? 'bg-sky-600' : 'hover:bg-slate-700'}`}>
                                    <CalendarIcon className="w-4 h-4" />
                                    Agenda
                                </button>
                                <button onClick={() => setActiveTab('prontuario')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${activeTab === 'prontuario' ? 'bg-green-600' : 'hover:bg-slate-700'}`}>
                                    <FileTextIcon className="w-4 h-4" />
                                    Pacientes
                                </button>
                            </>
                        )}

                        {/* Cadastrar Paciente visível para admin e profissionais */}
                        {(currentUser?.role === 'admin' || currentUser?.role === 'professional') && (
                            <button onClick={() => setActiveTab('cadastro')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${activeTab === 'cadastro' ? 'bg-purple-600' : 'hover:bg-slate-700'}`}>
                                <PlusIcon className="w-4 h-4" />
                                Cadastrar
                            </button>
                        )}

                        {/* Gerenciar Usuários - apenas Clínica */}
                        {currentUser?.role === 'clinic' && (
                            <button
                                onClick={() => setShowUserManager(true)}
                                className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-lg ml-2 flex items-center gap-2"
                                title="Gerenciar Usuários"
                            >
                                <UserIcon className="w-5 h-5" />
                            </button>
                        )}

                        {/* Links visíveis para todos (Clínica, Admin, Profissional) */}
                        <button
                            onClick={() => setShowLinksModal(true)}
                            className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg ml-2 flex items-center gap-2"
                            title="Links de Cadastro"
                        >
                            <UploadIcon className="w-5 h-5" />
                        </button>

                        {/* Botão Alterar Senha */}
                        <button
                            onClick={() => { setShowPasswordModal(true); setPasswordError(''); setPasswordForm({ current: '', new: '', confirm: '' }); }}
                            className="p-2 text-slate-400 hover:text-sky-400 ml-1"
                            title="Alterar Senha"
                        >
                            <EditIcon className="w-5 h-5" />
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
                {activeTab === 'agenda' && <Agenda patients={patients} profissionais={profissionais} appointments={appointments} onAddAppointment={handleAddAppointment} onAddBatchAppointments={handleAddBatchAppointments} onUpdateAppointment={handleUpdateAppointment} onDeleteAppointment={handleDeleteAppointment} currentUser={currentUser} />}
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
                {activeTab === 'prontuario' && (
                    <div className="space-y-6">
                        {!selectedPatientForRecord ? (
                            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
                                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <FileTextIcon className="w-5 h-5 text-green-400" />
                                    Selecionar Paciente para Prontuário
                                </h2>
                                <input
                                    type="text"
                                    placeholder="Buscar paciente por nome..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 mb-4 outline-none focus:ring-2 focus:ring-green-500"
                                />
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
                                    {filteredPatients.map(patient => (
                                        <button
                                            key={patient.id}
                                            onClick={() => setSelectedPatientForRecord(patient)}
                                            className="p-4 bg-slate-900 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-green-500/50 text-left transition-all group"
                                        >
                                            <h3 className="font-bold text-white group-hover:text-green-400 transition-colors">{patient.nome}</h3>
                                            <p className="text-xs text-slate-500">{patient.convenio || 'Particular'} • {patient.faixa || 'N/I'}</p>
                                            <p className="text-xs text-slate-600 mt-1">
                                                {(medicalRecords[patient.id]?.length || 0)} registro(s)
                                            </p>
                                        </button>
                                    ))}
                                </div>
                                {filteredPatients.length === 0 && (
                                    <p className="text-slate-500 text-center py-8">Nenhum paciente encontrado.</p>
                                )}
                            </div>
                        ) : (
                            <div>
                                {currentUser && (
                                    <PatientPortal
                                        patient={selectedPatientForRecord}
                                        currentUser={currentUser}
                                        existingRecords={medicalRecords[selectedPatientForRecord.id] || []}
                                        onSaveRecord={(patientId, record) => {
                                            setMedicalRecords(prev => ({
                                                ...prev,
                                                [patientId]: [...(prev[patientId] || []), record]
                                            }));
                                            showToast('Registro salvo com sucesso!', 'success');
                                        }}
                                        onUpdatePatient={handlePatientUpdate}
                                        onBack={() => setSelectedPatientForRecord(null)}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'cadastro' && (currentUser?.role === 'admin' || currentUser?.role === 'professional') && (
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <PlusIcon className="w-5 h-5 text-purple-400" />
                            Cadastrar Novo Paciente
                            {currentUser?.role === 'professional' && (
                                <span className="text-sm font-normal text-slate-400 ml-2">
                                    (será atribuído automaticamente a você)
                                </span>
                            )}
                        </h2>
                        <PatientForm
                            editingPatient={editingPatient}
                            onSave={(patient) => {
                                // Para profissionais, auto-atribui o nome deles
                                if (currentUser?.role === 'professional') {
                                    // Encontra o profissional correspondente na lista
                                    const matchingPro = profissionais.find(p =>
                                        p.toLowerCase().includes(currentUser.name.toLowerCase()) ||
                                        currentUser.name.toLowerCase().includes(p.toLowerCase().split(' - ')[0])
                                    );
                                    patient.profissionais = matchingPro ? [matchingPro] : [currentUser.name];
                                }
                                handleSavePatient(patient);
                                setEditingPatient(null);
                                showToast('Paciente cadastrado com sucesso!', 'success');
                            }}
                            onClear={() => setEditingPatient(null)}
                            convenios={convenios}
                            profissionais={profissionais}
                            especialidades={especialidades}
                            onAddConvenio={c => setConvenios(prev => [...prev, c])}
                            // Profissionais: trava nome, esconde criar novo
                            lockedProfessional={
                                currentUser?.role === 'professional'
                                    ? (profissionais.find(p =>
                                        p.toLowerCase().includes(currentUser.name.toLowerCase()) ||
                                        currentUser.name.toLowerCase().includes(p.toLowerCase().split(' - ')[0])
                                    ) || currentUser.name)
                                    : undefined
                            }
                            hideProfessionalAdd={currentUser?.role === 'professional'}
                            hideEspecialidadeAdd={currentUser?.role === 'professional'}
                            onAddProfissional={currentUser?.role === 'admin' ? (p => setProfissionais(prev => [...prev, p])) : undefined}
                            onAddEspecialidade={currentUser?.role === 'admin' ? (e => setEspecialidades(prev => [...prev, e])) : undefined}
                            onRemoveConvenio={currentUser?.role === 'admin' ? (c => setConvenios(prev => prev.filter(x => x !== c))) : undefined}
                            onRemoveProfissional={currentUser?.role === 'admin' ? (p => setProfissionais(prev => prev.filter(x => x !== p))) : undefined}
                            onRemoveEspecialidade={currentUser?.role === 'admin' ? (e => setEspecialidades(prev => prev.filter(x => x !== e))) : undefined}
                        />
                    </div>
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
                            {/* Novo Paciente - visível para todos */}
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

                            {/* VIP - apenas Clínica */}
                            {currentUser?.role === 'clinic' && (
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
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Alterar Senha */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative animate-fade-in">
                        <button onClick={() => setShowPasswordModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><XIcon className="w-6 h-6" /></button>
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <LockIcon className="w-5 h-5 text-sky-400" />
                            Alterar Senha
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm  text-slate-400 mb-1">Senha Atual</label>
                                <input
                                    type="password"
                                    value={passwordForm.current}
                                    onChange={e => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-sky-500"
                                    placeholder="Digite sua senha atual"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Nova Senha</label>
                                <input
                                    type="password"
                                    value={passwordForm.new}
                                    onChange={e => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-sky-500"
                                    placeholder="Mínimo 4 caracteres"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Confirmar Nova Senha</label>
                                <input
                                    type="password"
                                    value={passwordForm.confirm}
                                    onChange={e => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-sky-500"
                                    placeholder="Repita a nova senha"
                                />
                            </div>

                            {passwordError && (
                                <div className="text-red-400 text-sm bg-red-900/20 border border-red-800/50 p-2 rounded-lg">
                                    {passwordError}
                                </div>
                            )}

                            <button
                                onClick={handleChangePassword}
                                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                <CheckIcon className="w-5 h-5" /> Salvar Nova Senha
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Gerenciamento de Usuários */}
            {showUserManager && (
                <UserManager
                    users={users}
                    especialidades={especialidades}
                    onAddUser={handleAddUser}
                    onUpdateUser={handleUpdateUser}
                    onClose={() => setShowUserManager(false)}
                />
            )}

            {toast && <div className={`fixed bottom-4 right-4 p-4 rounded-xl shadow-2xl border animate-fade-in ${toast.type === 'error' ? 'bg-red-900 border-red-700' : 'bg-green-900 border-green-700'}`}>{toast.msg}</div>}
        </div>
    );
};

export default App;
