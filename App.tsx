import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Patient, BrandConfig, Appointment, PreCadastro, UserProfile, MedicalRecordChunk, ActivityLog, ScheduleChangeRequest, ConvenioConfig, WaitlistEntry } from './types';
import { STORAGE_KEYS, DEFAULT_CONVENIOS, DEFAULT_PROFISSIONAIS, DEFAULT_ESPECIALIDADES } from './constants';
import useLocalStorage from './hooks/useLocalStorage';
import { downloadFile, exportToCSV } from './services/fileService';
import { supabase, isSupabaseConfigured } from './services/supabase';
import { PatientForm } from './components/PatientForm';
import { PatientTable } from './components/PatientTable';
import { Agenda } from './components/Agenda';
import { PublicRegistration } from './components/PublicRegistration';
import { PublicWaitlist } from './components/PublicWaitlist';
import { FaturamentoHub } from './components/FaturamentoHub';
import { Inbox } from './components/Inbox';
import { LoginScreen } from './components/LoginScreen';
import { MedicalRecord } from './components/MedicalRecord';
import { PatientPortal } from './components/PatientPortal';
import { UserManager } from './components/UserManager';
import { Waitlist } from './components/Waitlist';
import { DownloadIcon, CloudIcon, UserIcon, CalendarIcon, InboxIcon, CheckIcon, XIcon, BellIcon, LockIcon, FileTextIcon, StarIcon, UploadIcon, ShieldIcon, FilterIcon, EditIcon, PlusIcon, TrashIcon } from './components/icons';

const App: React.FC = () => {
    const defaultConvenios: ConvenioConfig[] = DEFAULT_CONVENIOS.map((name, idx) => ({
        id: `conv-${idx + 1}`,
        name,
        active: true,
        payoutPercent: 75,
        // defaults: sem valor/duração obrigatórios
        price: undefined,
        payoutPrice: undefined,
        durationMin: undefined
    }));

    const [convenios, setConvenios] = useLocalStorage<ConvenioConfig[] | any>(STORAGE_KEYS.CONVENIOS, defaultConvenios);
    const [profissionais, setProfissionais] = useLocalStorage<string[]>(STORAGE_KEYS.PROFISSIONAIS, DEFAULT_PROFISSIONAIS);
    const [especialidades, setEspecialidades] = useLocalStorage<string[]>(STORAGE_KEYS.ESPECIALIDADES, DEFAULT_ESPECIALIDADES);

    const convenioList: ConvenioConfig[] = (Array.isArray(convenios) ? convenios : defaultConvenios) as ConvenioConfig[];
    const convenioNames: string[] = convenioList.filter(c => c?.active !== false).map(c => c.name);
    const [activeTab, setActiveTab] = useLocalStorage<'pacientes' | 'agenda' | 'faturamento' | 'inbox' | 'prontuario' | 'cadastro' | 'fila'>('personart.view.tab', 'pacientes');
    const [brand] = useLocalStorage<BrandConfig>(STORAGE_KEYS.BRAND, { color: '#e9c49e', dark: '#273e44', logo: null, name: 'Clínica Personart' });

    // Migração de abas antigas: funserv/repasse -> faturamento
    useEffect(() => {
        const rawTab = String(activeTab);
        if (rawTab === 'funserv' || rawTab === 'repasse') {
            setActiveTab('faturamento');
        }
    }, [activeTab, setActiveTab]);

    // --- NOVO SISTEMA DE AUTH (V2.0) ---
    // User Session: armazena objeto completo do usuário logado
    const [currentUser, setCurrentUser] = useLocalStorage<UserProfile | null>('personart.auth.user_v2', null);

    // Users DB: Lista de todos usuários cadastrados
    const [users, setUsers] = useLocalStorage<UserProfile[]>('personart.users_v2', []);

    // MUDANÇA PRINCIPAL: Usar LocalStorage como "Cache" para garantir que os dados apareçam mesmo sem internet/nuvem
    const [patients, setPatients] = useLocalStorage<Patient[]>('personart.patients.db', []);
    const [appointments, setAppointments] = useLocalStorage<Appointment[]>('personart.appointments.db', []);

    const [inbox, setInbox] = useState<PreCadastro[]>([]);

    // Fila de espera
    const [waitlist, setWaitlist] = useLocalStorage<WaitlistEntry[]>(STORAGE_KEYS.WAITLIST, []);
    const [isLoading, setIsLoading] = useState(true);
    const [dbError, setDbError] = useState('');
    const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error' | 'offline'>('checking');

    const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ convenio: '', profissional: '', faixa: '' });
    const [showInactive, setShowInactive] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [view, setView] = useState<'landing' | 'login' | 'dashboard'>('landing');
    const [loginInput, setLoginInput] = useState('');
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' | 'info' } | null>(null);
    const [showLinksModal, setShowLinksModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showConvenioManager, setShowConvenioManager] = useState(false);
    const [showUserManager, setShowUserManager] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
    const [passwordError, setPasswordError] = useState('');

    const [profileForm, setProfileForm] = useState({
        specialty: '',
        professionalRegister: ''
    });

    // Estado para Prontuário
    const [selectedPatientForRecord, setSelectedPatientForRecord] = useState<Patient | null>(null);
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const [medicalRecords, setMedicalRecords] = useLocalStorage<Record<string, import('./types').MedicalRecordChunk[]>>('personart.medical_records.db', {});

    // Estado para Documentos e Pastas (persistência por paciente)
    const [patientDocuments, setPatientDocuments] = useLocalStorage<Record<string, import('./types').PatientDocument[]>>('personart.patient_documents.db', {});
    const [documentFolders, setDocumentFolders] = useLocalStorage<Record<string, import('./types').DocumentFolder[]>>('personart.document_folders.db', {});

    // --- SISTEMA DE NOTIFICAÇÕES ---
    const [activityLogs, setActivityLogs] = useLocalStorage<ActivityLog[]>('personart.notifications.db', []);
    const [showNotifications, setShowNotifications] = useState(false);
    const [lastReadTimestamp, setLastReadTimestamp] = useLocalStorage<string>('personart.notifications.last_read', new Date().toISOString());

    // --- SOLICITAÇÕES DE ALTERAÇÃO DE AGENDA ---
    const [scheduleChangeRequests, setScheduleChangeRequests] = useLocalStorage<ScheduleChangeRequest[]>('personart.schedule_requests.db', []);

    // --- ROTEAMENTO PÚBLICO ---
    const params = new URLSearchParams(window.location.search);
    const pathname = (window.location.pathname || '').replace(/\/+$/, '');
    const lastSeg = pathname.split('/').filter(Boolean).slice(-1)[0] || '';
    const pageFromPath = ((): string | null => {
        const seg = lastSeg.toLowerCase();
        if (seg === 'cadastro') return 'cadastro';
        if (seg === 'fila') return 'fila';
        if (seg === 'vip') return 'vip';
        return null;
    })();
    const pageParam = params.get('page') || pageFromPath;

    // --- HELPER: Sincronizar um usuário com Supabase ---
    const syncUserToCloud = async (user: UserProfile) => {
        if (!isSupabaseConfigured() || !supabase) return;
        try {
            await supabase.from('user_profiles').upsert({
                id: user.id,
                name: user.name,
                role: user.role,
                active: user.active ?? true,
                data: JSON.parse(JSON.stringify(user))
            });
        } catch (e) {
            console.error('Erro ao sincronizar usuário:', e);
        }
    };

    const syncAllUsersToCloud = async (usersList: UserProfile[]) => {
        if (!isSupabaseConfigured() || !supabase) return;
        try {
            const records = usersList.map(u => ({
                id: u.id,
                name: u.name,
                role: u.role,
                active: u.active ?? true,
                data: JSON.parse(JSON.stringify(u))
            }));
            await supabase.from('user_profiles').upsert(records);
            console.log(`✅ ${records.length} usuário(s) sincronizados com a nuvem`);
        } catch (e) {
            console.error('Erro ao sincronizar usuários:', e);
        }
    };

    // --- INICIALIZAÇÃO E MIGRAÇÃO V2.0 ---
    useEffect(() => {
        // Migração: convênios v1 (string[]) -> v2 (ConvenioConfig[])
        try {
            if (Array.isArray(convenios) && convenios.length > 0 && typeof convenios[0] === 'string') {
                const v1 = convenios as unknown as string[];
                const v2: ConvenioConfig[] = v1.map((name, idx) => ({
                    id: `conv-mig-${idx + 1}`,
                    name,
                    active: true,
                    payoutPercent: 75,
                    price: undefined,
                    payoutPrice: undefined,
                    durationMin: undefined
                }));
                setConvenios(v2);
            }
        } catch (e) {
            console.error('Erro ao migrar convênios:', e);
        }

        // 1. Deduplica usuários atuais (limpeza de estado legado no localStorage)
        if (users.length > 0) {
            const seen = new Set<string>();
            const unique = users.filter(u => {
                const key = `${u.name.trim()}::${u.role}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            if (unique.length !== users.length) {
                setUsers(unique);
            }
        }

        // 2. Sempre tenta carregar da nuvem para garantir lista limpa e senhas atuais
        const seedDefaults = () => {
            const clinicUser: UserProfile = { id: 'clinic-01', name: 'Clínica Personart', role: 'clinic', active: true, pin: 'personart' };
            const defaultAdmin: UserProfile = { id: 'admin-01', name: 'Responsável Técnico', role: 'admin', active: true, pin: '1234' };
            const migratedPros: UserProfile[] = profissionais.map(p => ({
                id: `pro-${Math.random().toString(36).substr(2, 9)}`,
                name: p.replace(/ - CRP.*/, '').trim(),
                role: 'professional',
                active: true,
                pin: '1234'
            }));

            const allSeedUsers = [clinicUser, defaultAdmin, ...migratedPros];
            // Deduplica o seed antes de salvar
            const seenSeed = new Set<string>();
            const uniqueSeed = allSeedUsers.filter(u => {
                const key = `${u.name.trim()}::${u.role}`;
                if (seenSeed.has(key)) return false;
                seenSeed.add(key);
                return true;
            });
            setUsers(uniqueSeed);
            syncAllUsersToCloud(uniqueSeed);
        };

        if (isSupabaseConfigured() && supabase) {
            supabase.from('user_profiles').select('*').then(({ data, error }) => {
                if (!error && data && data.length > 0) {
                    const rawUsers: UserProfile[] = data.map((row: any) => row.data as UserProfile);
                    const seenKeys = new Set<string>();
                    const cloudUsers = rawUsers.filter(u => {
                        const key = `${u.name.trim()}::${u.role}`;
                        if (seenKeys.has(key)) return false;
                        seenKeys.add(key);
                        return true;
                    });
                    setUsers(cloudUsers);
                    console.log(`✅ ${cloudUsers.length} usuário(s) sincronizados da nuvem`);
                } else if (users.length === 0) {
                    seedDefaults();
                }
            }).catch(() => {
                if (users.length === 0) seedDefaults();
            });
        } else if (users.length === 0) {
            seedDefaults();
        }
    }, []); // Roda apenas no mount para garantir sincronização inicial limpa

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
    }, [currentUser, pageParam]);

    useEffect(() => {
        if (isAuthenticated && currentUser) {
            const fetchData = async () => {
                setIsLoading(true);

                if (!isSupabaseConfigured() || !supabase) {
                    setConnectionStatus('offline');
                    setIsLoading(false);
                    return;
                }

                try {
                    const { data: patData, error: patError } = await supabase.from('patients').select('*');
                    if (patError) throw patError;
                    if (patData) setPatients(patData.map((row: any) => row.data));

                    const { data: apptData, error: apptError } = await supabase.from('appointments').select('*');
                    if (!apptError && apptData) setAppointments(apptData.map((row: any) => row.data));

                    const { data: inboxData } = await supabase.from('inbox').select('*');
                    if (inboxData) setInbox(inboxData.map((row: any) => row.data));

                    const { data: recData, error: recError } = await supabase.from('medical_records').select('*');
                    const cloudIds = new Set<string>();
                    if (!recError && recData && recData.length > 0) {
                        const grouped: Record<string, MedicalRecordChunk[]> = {};
                        recData.forEach((row: any) => {
                            const rec = row.data as MedicalRecordChunk;
                            const pid = row.patient_id;
                            cloudIds.add(row.id);
                            if (!grouped[pid]) grouped[pid] = [];
                            grouped[pid].push(rec);
                        });
                        setMedicalRecords(grouped);
                    }

                    const localRecords = JSON.parse(localStorage.getItem('personart.medical_records.db') || '{}');
                    const toUpload: any[] = [];
                    Object.entries(localRecords).forEach(([patientId, records]: [string, any]) => {
                        if (Array.isArray(records)) {
                            records.forEach((rec: MedicalRecordChunk) => {
                                if (!cloudIds.has(rec.id)) {
                                    toUpload.push({
                                        id: rec.id,
                                        patient_id: patientId,
                                        professional_id: rec.professionalId,
                                        date: rec.date,
                                        type: rec.type,
                                        data: JSON.parse(JSON.stringify(rec))
                                    });
                                }
                            });
                        }
                    });

                    if (toUpload.length > 0) {
                        const { error: migError } = await supabase.from('medical_records').upsert(toUpload);
                        if (!migError) console.log(`✅ Migrados ${toUpload.length} prontuário(s) local → nuvem`);
                    }

                    const { data: logData, error: logError } = await supabase.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(50);
                    if (!logError && logData) {
                        setActivityLogs(logData.map((row: any) => row.data || row));
                    }

                    // --- CARREGAR SOLICITAÇÕES DE ALTERAÇÃO ---
                    try {
                        const { data: reqData, error: reqError } = await supabase.from('schedule_change_requests').select('*').order('timestamp', { ascending: false });
                        if (!reqError && reqData) {
                            setScheduleChangeRequests(reqData.map((row: any) => row.data as ScheduleChangeRequest));
                        }
                    } catch (e) {
                        console.error('Erro ao carregar solicitações:', e);
                    }

                    // --- SINCRONIZAÇÃO DE USUÁRIOS ---
                    const { data: userData, error: userError } = await supabase.from('user_profiles').select('*');
                    if (!userError && userData && userData.length > 0) {
                        const rawUsers: UserProfile[] = userData.map((row: any) => row.data as UserProfile);
                        // Deduplica por nome+role para evitar usuários repetidos na tela de login
                        const seenKeys = new Set<string>();
                        const cloudUsers = rawUsers.filter(u => {
                            const key = `${u.name}::${u.role}`;
                            if (seenKeys.has(key)) return false;
                            seenKeys.add(key);
                            return true;
                        });
                        setUsers(cloudUsers);

                        // Atualiza sessão APENAS se o pin ou dados mudaram (evita loop infinito)
                        if (currentUser) {
                            const freshUser = cloudUsers.find(u => u.id === currentUser.id);
                            if (freshUser && freshUser.pin !== currentUser.pin) {
                                setCurrentUser(freshUser);
                            }
                        }
                    } else if (!userError && (!userData || userData.length === 0) && users.length > 0) {
                        // Nuvem está vazia mas temos dados locais → migra para a nuvem
                        await syncAllUsersToCloud(users);
                    }

                    setConnectionStatus('connected');
                    setDbError('');

                    const { data: docData } = await supabase.from('patient_documents').select('*');
                    if (docData) {
                        const groupedDocs: Record<string, import('./types').PatientDocument[]> = {};
                        docData.forEach((row: any) => {
                            const pid = row.patient_id;
                            if (!groupedDocs[pid]) groupedDocs[pid] = [];
                            groupedDocs[pid].push(row.data as import('./types').PatientDocument);
                        });
                        setPatientDocuments(groupedDocs);
                    }

                    const { data: folderData } = await supabase.from('document_folders').select('*');
                    if (folderData) {
                        const groupedFolders: Record<string, import('./types').DocumentFolder[]> = {};
                        folderData.forEach((row: any) => {
                            const pid = row.patient_id;
                            if (!groupedFolders[pid]) groupedFolders[pid] = [];
                            groupedFolders[pid].push(row.data as import('./types').DocumentFolder);
                        });
                        setDocumentFolders(groupedFolders);
                    }
                } catch (err: any) {
                    console.error('Erro de sincronização:', err);
                    setDbError('Conexão instável. Operando offline.');
                    setConnectionStatus('error');
                } finally {
                    setIsLoading(false);
                }
            };
            fetchData();
        }
    }, [isAuthenticated, currentUser]);

    // --- ROTEAMENTO PÚBLICO ---
    if (pageParam === 'cadastro' || pageParam === 'update' || pageParam === 'vip') {
        const isVip = pageParam === 'vip';
        const isUpdate = pageParam === 'update';

        return (
            <PublicRegistration
                cloudEndpoint=""
                brandName={brand.name}
                brandColor={brand.color}
                brandLogo={brand.logo}
                convenios={convenioNames}
                isVipMode={isVip}
                isUpdateMode={isUpdate}
            />
        );
    }

    if (pageParam === 'fila') {
        return (
            <PublicWaitlist
                brandName={brand.name}
                brandColor={brand.color}
                brandLogo={brand.logo}
                especialidades={especialidades}
            />
        );
    }

    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const logActivity = async (action: ActivityLog['action'], details: string, data?: any) => {
        if (!currentUser) return;

        const newLog: ActivityLog = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId: currentUser.id,
            userName: currentUser.name,
            action,
            details,
            timestamp: new Date().toISOString(),
            data
        };

        // 1. Atualiza Local
        setActivityLogs(prev => [newLog, ...prev].slice(0, 100));

        // 2. Tenta salvar na Nuvem
        if (isSupabaseConfigured() && supabase) {
            try {
                await supabase.from('activity_logs').insert([{
                    id: newLog.id,
                    user_id: newLog.userId,
                    user_name: newLog.userName,
                    action: newLog.action,
                    details: newLog.details,
                    timestamp: newLog.timestamp,
                    data: newLog
                }]);
            } catch (e) {
                console.error("Erro ao salvar log:", e);
            }
        }
    };

    const handleSavePatient = async (patient: Patient, initialAppointment?: any) => {
        const newPatientId = patient.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const isNew = !patients.find(p => p.id === patient.id);

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

        if (isNew) {
            logActivity('CADASTRO_PACIENTE', `${currentUser?.name || 'Alguém'} cadastrou o paciente ${patient.nome}`, { patientId: newPatientId });
        }

        // 2. Tenta salvar na Nuvem
        if (supabase && isSupabaseConfigured() && connectionStatus !== 'offline') {
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

    // Handler para excluir paciente permanentemente
    const handleDeletePatient = async (id: string) => {
        const patient = patients.find(p => p.id === id);
        const patientName = patient?.nome || 'Paciente';

        // 1. Remove do estado local
        setPatients(prev => prev.filter(p => p.id !== id));

        // Limpa prontuários do paciente
        setMedicalRecords(prev => {
            const updated = { ...prev };
            delete updated[id];
            return updated;
        });

        // Limpa agendamentos do paciente
        setAppointments(prev => prev.filter(a => a.patientId !== id));

        // Limpa documentos e pastas do paciente
        setPatientDocuments(prev => {
            const updated = { ...prev };
            delete updated[id];
            return updated;
        });
        setDocumentFolders(prev => {
            const updated = { ...prev };
            delete updated[id];
            return updated;
        });

        // 2. Remove da nuvem (Supabase)
        if (supabase && isSupabaseConfigured() && connectionStatus !== 'offline') {
            try {
                await Promise.all([
                    supabase.from('patients').delete().eq('id', id),
                    supabase.from('medical_records').delete().eq('patient_id', id),
                    supabase.from('appointments').delete().eq('patient_id', id),
                    supabase.from('patient_documents').delete().eq('patient_id', id),
                    supabase.from('document_folders').delete().eq('patient_id', id),
                ]);
                showToast(`Paciente "${patientName}" excluído permanentemente.`, 'info');
            } catch (e) {
                console.error('Erro ao excluir da nuvem:', e);
                showToast(`Paciente excluído localmente. Erro na nuvem.`, 'error');
            }
        } else {
            showToast(`Paciente "${patientName}" excluído localmente.`, 'info');
        }

        // 3. Registra no log de atividades
        logActivity('EXCLUSAO_PACIENTE', `${currentUser?.name || 'Alguém'} excluiu o paciente ${patientName}`, { patientId: id });
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
            if (error) {
                console.error("Erro agendamento nuvem:", error);
            } else {
                logActivity('AGENDAMENTO', `${currentUser?.name} agendou ${enrichedAppt.patientName} para ${enrichedAppt.date} às ${enrichedAppt.time}`, { apptId: enrichedAppt.id });
            }
        } else {
            logActivity('AGENDAMENTO', `${currentUser?.name} agendou ${enrichedAppt.patientName} (Local)`, { apptId: enrichedAppt.id });
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
        // Aplica a alteração diretamente no estado local
        setAppointments(prev => prev.map(x => x.id === appt.id ? appt : x));

        // Aplica na nuvem
        if (supabase && connectionStatus !== 'offline') {
            const { error } = await supabase.from('appointments').upsert({
                id: appt.id,
                date: appt.date,
                patient_id: appt.patientId,
                status: appt.status,
                carteirinha: appt.carteirinha || '',
                numero_autorizacao: appt.numero_autorizacao || '',
                data_autorizacao: appt.data_autorizacao || null,
                data: JSON.parse(JSON.stringify(appt))
            });
            if (!error) {
                logActivity('ALTERACAO_AGENDA', `${currentUser?.name} alterou agendamento de ${appt.patientName}`, { apptId: appt.id });
            }
        }

        // Se for profissional, TAMBÉM cria solicitação pendente para a clínica revisar
        if (currentUser?.role === 'professional') {
            // Tentamos encontrar os dados antigos no estado atual antes de ter atualizado
            // (Neste ponto já alterou o estado na tela, o ideal seria pegar a cópia antiga ANTES)
            // Mas como temos hooks, prev state pode não estar disponível sincronicamente,
            // Felizmente, o objeto oldAppt ainda não foi mutado (o map cria novo ref), e este closure tem acesso ao appointments antigo?
            // De qualquer forma, a UI passa os dados novos. 
            // Uma ideia mais segura: o appt veio modificado do form. A busca em `appointments` (closure) ainda tem o original.
            const oldAppt = appointments.find(x => x.id === appt.id);
            if (!oldAppt) return;

            const request: ScheduleChangeRequest = {
                id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                appointmentId: appt.id,
                type: 'UPDATE',
                status: 'PENDING',
                requestedBy: currentUser.id,
                requestedByName: currentUser.name,
                timestamp: new Date().toISOString(),
                oldData: { ...oldAppt }, // o estado antigo antes desta renderização
                newData: { ...appt }
            };

            setScheduleChangeRequests(prev => [request, ...prev]);

            // Salva a requisição na nuvem
            if (supabase && connectionStatus !== 'offline') {
                try {
                    await supabase.from('schedule_change_requests').upsert({
                        id: request.id,
                        appointment_id: request.appointmentId,
                        type: request.type,
                        status: request.status,
                        requested_by: request.requestedBy,
                        timestamp: request.timestamp,
                        data: JSON.parse(JSON.stringify(request))
                    });
                } catch (e) {
                    console.error('Erro ao salvar solicitação:', e);
                }
            }

            logActivity('SOLICITACAO_ALTERACAO', `${currentUser.name} alterou agendamento de ${appt.patientName} (${appt.date} ${appt.time})`, { requestId: request.id, apptId: appt.id });
            showToast('Alteração salva (Notificação enviada à clínica)', 'success');
        } else {
             // Admin feedback
             showToast('Agendamento atualizado com sucesso!', 'success');
        }
    };

    const handleDeleteAppointment = async (id: string, name?: string) => {
        // Resgata o agendamento antigo
        const oldAppt = appointments.find(x => x.id === id);

        // Aplica exclusão imediatamente no local
        setAppointments(prev => prev.filter(x => x.id !== id));

        // Aplica na nuvem imediatamente
        if (supabase && connectionStatus !== 'offline') {
            const { error } = await supabase.from('appointments').delete().eq('id', id);
            if (!error) {
                logActivity('EXCLUSAO_AGENDA', `${currentUser?.name} excluiu agendamento de ${name || 'paciente'}`, { apptId: id });
            }
        }

        // Se for profissional, cria requisição para o log da clínica
        if (currentUser?.role === 'professional' && oldAppt) {
            const request: ScheduleChangeRequest = {
                id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                appointmentId: id,
                type: 'DELETE',
                status: 'PENDING',
                requestedBy: currentUser.id,
                requestedByName: currentUser.name,
                timestamp: new Date().toISOString(),
                oldData: { ...oldAppt }
            };

            setScheduleChangeRequests(prev => [request, ...prev]);

            if (supabase && connectionStatus !== 'offline') {
                try {
                    await supabase.from('schedule_change_requests').upsert({
                        id: request.id,
                        appointment_id: request.appointmentId,
                        type: request.type,
                        status: request.status,
                        requested_by: request.requestedBy,
                        timestamp: request.timestamp,
                        data: JSON.parse(JSON.stringify(request))
                    });
                } catch (e) {
                    console.error('Erro ao salvar solicitação:', e);
                }
            }
            logActivity('SOLICITACAO_ALTERACAO', `${currentUser.name} excluiu agendamento de ${name || 'paciente'} (${oldAppt.date} ${oldAppt.time})`, { requestId: request.id, apptId: id });
            showToast('Exclusão realizada (Notificação enviada à clínica)', 'success');
        } else {
             showToast('Agendamento excluído com sucesso!', 'success');
        }
    };

    // --- HANDLERS DE APROVAÇÃO/REJEIÇÃO DE SOLICITAÇÕES ---
    const handleApproveChange = async (requestId: string) => {
        const request = scheduleChangeRequests.find(r => r.id === requestId);
        if (!request || request.status !== 'PENDING') return;

        // Como a alteração JÁ FOI APLICADA na agenda (nova regra), a aprovação da clínica
        // significa apenas "Estou ciente e aprovo o que o profissional fez", não precisamos mudar appointments

        // Atualiza status da solicitação
        const updatedRequest: ScheduleChangeRequest = {
            ...request,
            status: 'APPROVED',
            reviewedBy: currentUser?.id,
            reviewedByName: currentUser?.name,
            reviewedAt: new Date().toISOString()
        };

        setScheduleChangeRequests(prev => prev.map(r => r.id === requestId ? updatedRequest : r));

        if (supabase && connectionStatus !== 'offline') {
            try {
                await supabase.from('schedule_change_requests').upsert({
                    id: updatedRequest.id,
                    appointment_id: updatedRequest.appointmentId,
                    type: updatedRequest.type,
                    status: updatedRequest.status,
                    requested_by: updatedRequest.requestedBy,
                    timestamp: updatedRequest.timestamp,
                    data: JSON.parse(JSON.stringify(updatedRequest))
                });
            } catch (e) {
                console.error('Erro ao atualizar solicitação:', e);
            }
        }

        const actionLabel = request.type === 'UPDATE' ? 'alteração' : 'exclusão';
        logActivity('APROVACAO_ALTERACAO', `${currentUser?.name} estava ciente e aprovou a ${actionLabel} de ${request.oldData.patientName} efetuada por ${request.requestedByName}`, { requestId, apptId: request.appointmentId });
        showToast('Edição revisada/aprovada com sucesso.', 'success');
    };

    const handleRejectChange = async (requestId: string) => {
        const request = scheduleChangeRequests.find(r => r.id === requestId);
        if (!request || request.status !== 'PENDING') return;

        // Ao rejeitar, DESFAZEMOS a ação que o profissional tomou.
        // Se era UPDATE, voltamos a versão antiga (oldData)
        // Se era DELETE, reinserimos o agendamento (oldData)

        // Aplica o "undone" na agenda
        if (request.type === 'UPDATE') {
            setAppointments(prev => prev.map(x => x.id === request.appointmentId ? request.oldData : x));
            if (supabase && connectionStatus !== 'offline') {
                await supabase.from('appointments').upsert({
                    id: request.oldData.id,
                    date: request.oldData.date,
                    patient_id: request.oldData.patientId,
                    status: request.oldData.status,
                    carteirinha: request.oldData.carteirinha || '',
                    numero_autorizacao: request.oldData.numero_autorizacao || '',
                    data_autorizacao: request.oldData.data_autorizacao || null,
                    data: JSON.parse(JSON.stringify(request.oldData))
                });
            }
        } else if (request.type === 'DELETE') {
            setAppointments(prev => [...prev, request.oldData]);
            if (supabase && connectionStatus !== 'offline') {
                await supabase.from('appointments').upsert({
                    id: request.oldData.id,
                    date: request.oldData.date,
                    patient_id: request.oldData.patientId,
                    status: request.oldData.status,
                    carteirinha: request.oldData.carteirinha || '',
                    numero_autorizacao: request.oldData.numero_autorizacao || '',
                    data_autorizacao: request.oldData.data_autorizacao || null,
                    data: JSON.parse(JSON.stringify(request.oldData))
                });
            }
        }

        const updatedRequest: ScheduleChangeRequest = {
            ...request,
            status: 'REJECTED',
            reviewedBy: currentUser?.id,
            reviewedByName: currentUser?.name,
            reviewedAt: new Date().toISOString()
        };

        setScheduleChangeRequests(prev => prev.map(r => r.id === requestId ? updatedRequest : r));

        if (supabase && connectionStatus !== 'offline') {
            try {
                await supabase.from('schedule_change_requests').upsert({
                    id: updatedRequest.id,
                    appointment_id: updatedRequest.appointmentId,
                    type: updatedRequest.type,
                    status: updatedRequest.status,
                    requested_by: updatedRequest.requestedBy,
                    timestamp: updatedRequest.timestamp,
                    data: JSON.parse(JSON.stringify(updatedRequest))
                });
            } catch (e) {
                console.error('Erro ao atualizar solicitação:', e);
            }
        }

        const actionLabel = request.type === 'UPDATE' ? 'alteração' : 'exclusão';
        logActivity('REJEICAO_ALTERACAO', `${currentUser?.name} rejeitou (desfez) a ${actionLabel} de ${request.oldData.patientName} efetuada por ${request.requestedByName}`, { requestId, apptId: request.appointmentId });
        showToast('Ação desfeita. O agendamento voltou ao estado original.', 'info');
    };

    const handleLogout = () => {
        setCurrentUser(null);
        setIsAuthenticated(false);
        setView('landing');
    };

    const handleChangePassword = async () => {
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
        const updatedUser = { ...currentUser, pin: passwordForm.new };
        setUsers(prev => prev.map(u =>
            u.id === currentUser.id ? updatedUser : u
        ));
        setCurrentUser(updatedUser);

        // Sincroniza com a nuvem (com await para garantir persistência)
        await syncUserToCloud(updatedUser);

        // Limpa e fecha
        setPasswordForm({ current: '', new: '', confirm: '' });
        setShowPasswordModal(false);
        showToast('Senha alterada com sucesso!', 'success');
    };

    const handleSaveMyProfile = async () => {
        if (!currentUser) return;

        const updatedUser: UserProfile = {
            ...currentUser,
            specialty: profileForm.specialty?.trim() || '',
            professionalRegister: profileForm.professionalRegister?.trim() || ''
        };

        // Atualiza usuário local
        setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
        setCurrentUser(updatedUser);

        // Sincroniza com a nuvem
        await syncUserToCloud(updatedUser);

        // Mantém lista de profissionais/pacientes/agenda consistente com o "Nome - Registro"
        if (updatedUser.role === 'professional') {
            const newDisplayName = updatedUser.professionalRegister
                ? `${updatedUser.name} - ${updatedUser.professionalRegister}`
                : updatedUser.name;

            // Atualiza lista de profissionais
            setProfissionais(prev => prev.map(p => {
                const base = (p || '').split(' - ')[0].trim();
                if (base.toLowerCase() === updatedUser.name.toLowerCase()) return newDisplayName;
                if ((p || '').toLowerCase().includes(updatedUser.name.toLowerCase())) return newDisplayName;
                return p;
            }));

            // Atualiza pacientes atribuídos
            setPatients(prev => prev.map(pt => {
                const list = pt.profissionais || [];
                const updatedList = list.map(p => {
                    const base = (p || '').split(' - ')[0].trim();
                    if (base.toLowerCase() === updatedUser.name.toLowerCase()) return newDisplayName;
                    if ((p || '').toLowerCase().includes(updatedUser.name.toLowerCase())) return newDisplayName;
                    return p;
                });
                return { ...pt, profissionais: updatedList };
            }));

            // Atualiza agenda (campo profissional)
            setAppointments(prev => prev.map(a => {
                const base = (a.profissional || '').split(' - ')[0].trim();
                if (base.toLowerCase() === updatedUser.name.toLowerCase()) {
                    return { ...a, profissional: newDisplayName };
                }
                if ((a.profissional || '').toLowerCase().includes(updatedUser.name.toLowerCase())) {
                    return { ...a, profissional: newDisplayName };
                }
                return a;
            }));
        }

        setShowProfileModal(false);
        showToast('Cadastro atualizado!', 'success');
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
                    prof && (prof.toLowerCase().includes(professionalName.toLowerCase()) ||
                        professionalName.toLowerCase().includes((prof.split(' - ')[0] || '').toLowerCase()))
                );

                if (!isAssigned) return false;
            }

            const s = searchTerm.toLowerCase();
            if (s && !p.nome.toLowerCase().includes(s) && !p.carteirinha?.includes(s)) return false;
            if (filters.convenio && p.convenio !== filters.convenio) return false;
            if (filters.profissional && !(p.profissionais || []).includes(filters.profissional)) return false;
            if (filters.faixa && p.faixa !== filters.faixa) return false;

            // Soft-delete: esconder inativos (a menos que showInactive esteja ligado)
            if (!showInactive && p.active === false) return false;

            return true;
        }).sort((a, b) => a.nome.localeCompare(b.nome));
    }, [patients, searchTerm, filters, currentUser, showInactive]);

    const copyLink = (pathOrQuery: string) => {
        const basePath = (window.location.pathname || '/').replace(/\/+$/, '');
        const fullPath = pathOrQuery.startsWith('?')
            ? `${basePath}${pathOrQuery}`
            : pathOrQuery.startsWith('/')
                ? pathOrQuery
                : `${basePath}${pathOrQuery}`;

        const url = `${window.location.origin}${fullPath}`;
        navigator.clipboard.writeText(url);
        showToast('Link copiado para a área de transferência!', 'success');
    };

    // --- HANDLERS DE GERENCIAMENTO DE USUÁRIOS ---
    const handleAddUser = (newUser: UserProfile) => {
        setUsers(prev => [...prev, newUser]);

        // Sincroniza com a nuvem
        syncUserToCloud(newUser);

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

        // Sincroniza com a nuvem
        syncUserToCloud(updatedUser);

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
                                    onClick={() => setActiveTab('faturamento')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'faturamento'
                                        ? 'bg-[#273e44] text-[#e9c49e] shadow-lg shadow-[#273e44]/20 border border-[#e9c49e]/10'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                        }`}
                                >
                                    Faturamento
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

                                <button
                                    onClick={() => setActiveTab('fila')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'fila'
                                        ? 'bg-[#273e44] text-[#e9c49e] shadow-lg shadow-[#273e44]/20 border border-[#e9c49e]/10'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                        }`}
                                    title="Fila de espera"
                                >
                                    Fila
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

                        {/* Gerenciar Convênios / Usuários - apenas Clínica */}
                        {currentUser?.role === 'clinic' && (
                            <>
                                <button
                                    onClick={() => setShowConvenioManager(true)}
                                    className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg ml-2 flex items-center gap-2"
                                    title="Gerenciar Convênios"
                                >
                                    <StarIcon className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setShowUserManager(true)}
                                    className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-lg flex items-center gap-2"
                                    title="Gerenciar Usuários"
                                >
                                    <UserIcon className="w-5 h-5" />
                                </button>
                            </>
                        )}

                        {/* Links visíveis para todos (Clínica, Admin, Profissional) */}
                        <button
                            onClick={() => setShowLinksModal(true)}
                            className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg ml-2 flex items-center gap-2"
                            title="Links de Cadastro"
                        >
                            <UploadIcon className="w-5 h-5" />
                        </button>

                        {/* Botão Meu Cadastro */}
                        {(currentUser?.role === 'admin' || currentUser?.role === 'professional') && (
                            <button
                                onClick={() => {
                                    setProfileForm({
                                        specialty: currentUser?.specialty || '',
                                        professionalRegister: (currentUser as any)?.professionalRegister || (currentUser as any)?.crp || ''
                                    });
                                    setShowProfileModal(true);
                                }}
                                className="p-2 text-slate-400 hover:text-[#e9c49e] ml-1"
                                title="Meu cadastro"
                            >
                                <UserIcon className="w-5 h-5" />
                            </button>
                        )}

                        {/* Botão Alterar Senha */}
                        <button
                            onClick={() => { setShowPasswordModal(true); setPasswordError(''); setPasswordForm({ current: '', new: '', confirm: '' }); }}
                            className="p-2 text-slate-400 hover:text-sky-400 ml-1"
                            title="Alterar Senha"
                        >
                            <EditIcon className="w-5 h-5" />
                        </button>

                        {/* Botão Notificações */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    setShowNotifications(!showNotifications);
                                    if (!showNotifications) setLastReadTimestamp(new Date().toISOString());
                                }}
                                className={`p-2 rounded-lg transition-colors relative ${showNotifications ? 'bg-[#e9c49e]/20 text-[#e9c49e]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                title="Notificações"
                            >
                                <BellIcon className="w-5 h-5" />
                                {(activityLogs.filter(log => log.timestamp > lastReadTimestamp).length > 0 || scheduleChangeRequests.filter(r => r.status === 'PENDING').length > 0) && (
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-slate-900" />
                                )}
                            </button>

                            {/* Painel de Notificações */}
                            {showNotifications && (
                                <div className="absolute right-0 mt-2 w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                                    <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                                        <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                            <BellIcon className="w-4 h-4 text-[#e9c49e]" /> Notificações
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            {scheduleChangeRequests.filter(r => r.status === 'PENDING').length > 0 && (
                                                <span className="text-[10px] bg-amber-900/30 text-amber-400 px-2 py-0.5 rounded font-bold animate-pulse">
                                                    {scheduleChangeRequests.filter(r => r.status === 'PENDING').length} pendente(s)
                                                </span>
                                            )}
                                            <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-400">Últimos 50</span>
                                        </div>
                                    </div>

                                    {/* Solicitações Pendentes — visível apenas para clínica */}
                                    {currentUser?.role === 'clinic' && scheduleChangeRequests.filter(r => r.status === 'PENDING').length > 0 && (
                                        <div className="border-b border-amber-500/20 bg-amber-900/10">
                                            <div className="px-4 py-2 flex items-center gap-2 border-b border-amber-500/10">
                                                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">⏳ Solicitações Pendentes</span>
                                            </div>
                                            {scheduleChangeRequests.filter(r => r.status === 'PENDING').map(req => (
                                                <div key={req.id} className="p-3 border-b border-amber-500/10 hover:bg-amber-500/5 transition-colors">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${req.type === 'UPDATE' ? 'bg-amber-900/30 text-amber-400' : 'bg-red-900/30 text-red-400'}`}>
                                                            {req.type === 'UPDATE' ? 'ALTERAÇÃO' : 'EXCLUSÃO'}
                                                        </span>
                                                        <span className="text-[9px] text-slate-500">
                                                            {new Date(req.timestamp).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-300 font-medium mb-1">
                                                        <span className="text-[#e9c49e]">{req.requestedByName}</span> solicitou {req.type === 'UPDATE' ? 'alteração' : 'exclusão'} do agendamento de <span className="text-white font-bold">{req.oldData.patientName}</span>
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 mb-2">
                                                        📅 {req.oldData.date} às {req.oldData.time} • {req.oldData.profissional}
                                                        {req.type === 'UPDATE' && req.newData && (
                                                            <span className="text-amber-400"> → {req.newData.date} às {req.newData.time}</span>
                                                        )}
                                                    </p>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleApproveChange(req.id)}
                                                            className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                                                        >
                                                            <CheckIcon className="w-3 h-3" /> Aceitar
                                                        </button>
                                                        <button
                                                            onClick={() => handleRejectChange(req.id)}
                                                            className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                                                        >
                                                            <XIcon className="w-3 h-3" /> Rejeitar
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="max-h-96 overflow-y-auto">
                                        {activityLogs.filter(log => currentUser?.role !== 'professional' || log.userName === currentUser?.name || log.details.includes(currentUser?.name || '')).length === 0 ? (
                                            <div className="p-8 text-center text-slate-500 text-xs italic">Nenhuma atividade recente.</div>
                                        ) : (
                                            activityLogs
                                                .filter(log => currentUser?.role !== 'professional' || log.userName === currentUser?.name || log.details.includes(currentUser?.name || ''))
                                                .map((log, i) => (
                                                <div key={log.id} className={`p-3 border-b border-slate-800/50 hover:bg-white/5 transition-colors ${log.timestamp > lastReadTimestamp ? 'bg-sky-500/5' : ''}`}>
                                                    <div className="flex justify-between items-start gap-2 mb-1">
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${log.action === 'CADASTRO_PACIENTE' ? 'bg-green-900/30 text-green-400' :
                                                            log.action === 'AGENDAMENTO' ? 'bg-sky-900/30 text-sky-400' :
                                                                log.action === 'EXCLUSAO_AGENDA' ? 'bg-red-900/30 text-red-400' :
                                                                    log.action === 'SOLICITACAO_ALTERACAO' ? 'bg-amber-900/30 text-amber-400' :
                                                                        log.action === 'APROVACAO_ALTERACAO' ? 'bg-emerald-900/30 text-emerald-400' :
                                                                            log.action === 'REJEICAO_ALTERACAO' ? 'bg-rose-900/30 text-rose-400' :
                                                                                'bg-slate-800 text-slate-400'
                                                            }`}>
                                                            {log.action.replace(/_/g, ' ')}
                                                        </span>
                                                        <span className="text-[9px] text-slate-500">
                                                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-300 leading-relaxed font-medium">{log.details}</p>
                                                    <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                                        <UserIcon className="w-3 h-3 opacity-50" /> {log.userName}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    {activityLogs.length > 0 && (
                                        <button
                                            onClick={() => {
                                                if (confirm('Limpar histórico local?')) {
                                                    setActivityLogs([]);
                                                    setShowNotifications(false);
                                                }
                                            }}
                                            className="w-full p-3 text-center text-[10px] text-slate-500 hover:text-red-400 hover:bg-red-900/10 transition-colors border-t border-slate-800"
                                        >
                                            Limpar Atividades
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

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
                            convenios={convenioNames} profissionais={profissionais} especialidades={especialidades}
                            onAddProfissional={p => setProfissionais(prev => [...prev, p])}
                            onAddEspecialidade={e => setEspecialidades(prev => [...prev, e])}
                            onRemoveProfissional={p => setProfissionais(prev => prev.filter(x => x !== p))}
                            onRemoveEspecialidade={e => setEspecialidades(prev => prev.filter(x => x !== e))}
                            hideProntuario={currentUser?.role === 'clinic'}
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
                                        {convenioNames.map(c => <option key={c} value={c}>{c}</option>)}
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

                            {/* Toggle Inativos */}
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={showInactive}
                                        onChange={() => setShowInactive(!showInactive)}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 cursor-pointer"
                                    />
                                    <span className="text-sm text-slate-400">Mostrar inativos</span>
                                </label>
                            </div>

                            <input type="text" placeholder="Buscar por nome ou carteirinha..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500" />
                            <PatientTable
                                patients={filteredPatients}
                                onEdit={p => { setEditingPatient(p); window.scrollTo(0, 0); }}
                                onDelete={handleDeletePatient}
                                onToggleActive={async (id, active) => {
                                    setPatients(prev => prev.map(p => p.id === id ? { ...p, active } : p));
                                    if (supabase) {
                                        await supabase.from('patients').update({ active }).eq('id', id).catch(() => { });
                                    }
                                    showToast(active ? 'Paciente reativado!' : 'Paciente desativado.', active ? 'success' : 'info');
                                }}
                            />
                        </div>
                    </div>
                )}
                {activeTab === 'agenda' && <Agenda patients={patients} profissionais={profissionais} convenios={convenioList} appointments={appointments} onAddAppointment={handleAddAppointment} onAddBatchAppointments={handleAddBatchAppointments} onUpdateAppointment={handleUpdateAppointment} onDeleteAppointment={handleDeleteAppointment} currentUser={currentUser} />}

                {activeTab === 'fila' && (currentUser?.role === 'clinic' || currentUser?.role === 'admin') && (
                    <Waitlist
                        entries={waitlist}
                        especialidades={especialidades}
                        onUpsert={(entry) => {
                            setWaitlist(prev => {
                                const exists = prev.some(x => x.id === entry.id);
                                return exists ? prev.map(x => x.id === entry.id ? entry : x) : [entry, ...prev];
                            });
                            // TODO: sync supabase (pode vir depois)
                            showToast('Fila atualizada!', 'success');
                        }}
                        onRemove={(id) => {
                            setWaitlist(prev => prev.filter(x => x.id !== id));
                            showToast('Removido da fila.', 'info');
                        }}
                    />
                )}
                {activeTab === 'faturamento' && (
                    <FaturamentoHub
                        patients={patients}
                        onSavePatient={handleSavePatient}
                        convenios={convenioList}
                        setConvenios={setConvenios as React.Dispatch<React.SetStateAction<ConvenioConfig[]>>}
                        appointments={appointments}
                    />
                )}
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
                {activeTab === 'prontuario' && currentUser?.role !== 'clinic' && (
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
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 mb-2 outline-none focus:ring-2 focus:ring-green-500"
                                />
                                <label className="flex items-center gap-2 cursor-pointer select-none mb-4">
                                    <input
                                        type="checkbox"
                                        checked={showInactive}
                                        onChange={() => setShowInactive(!showInactive)}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 cursor-pointer"
                                    />
                                    <span className="text-sm text-slate-400">Mostrar inativos</span>
                                </label>
                                <div className="max-h-[60vh] overflow-y-auto space-y-6">
                                    {(() => {
                                        // Profissional: agrupar por convênio
                                        if (currentUser?.role === 'professional') {
                                            const groups: Record<string, typeof filteredPatients> = {};
                                            filteredPatients.forEach(p => {
                                                const key = p.convenio || 'Particular';
                                                if (!groups[key]) groups[key] = [];
                                                groups[key].push(p);
                                            });
                                            return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([convenio, pts]) => (
                                                <div key={convenio}>
                                                    <button
                                                        onClick={() => setCollapsedGroups(prev => ({ ...prev, [convenio]: !prev[convenio] }))}
                                                        className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2 w-full text-left hover:text-slate-200 transition-colors py-1"
                                                    >
                                                        <span className={`transition-transform duration-200 ${collapsedGroups[convenio] ? '' : 'rotate-90'}`}>▶</span>
                                                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                        {convenio} <span className="text-slate-600 font-normal">({pts.length})</span>
                                                    </button>
                                                    {!collapsedGroups[convenio] && (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                                                            {pts.map(patient => (
                                                                <div key={patient.id} className={`p-4 bg-slate-900 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-green-500/50 text-left transition-all group relative ${patient.active === false ? 'opacity-60' : ''}`}>
                                                                    <button onClick={() => setSelectedPatientForRecord(patient)} className="w-full text-left">
                                                                        <h3 className="font-bold text-white group-hover:text-green-400 transition-colors">
                                                                            {patient.nome}
                                                                            {patient.active === false && (
                                                                                <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-bold">INATIVO</span>
                                                                            )}
                                                                        </h3>
                                                                        <p className="text-xs text-slate-500">{patient.convenio || 'Particular'} • {patient.faixa || 'N/I'}</p>
                                                                        <p className="text-xs text-slate-600 mt-1">{(medicalRecords[patient.id]?.length || 0)} registro(s)</p>
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const newActive = patient.active === false ? true : false;
                                                                            setPatients(prev => prev.map(p => p.id === patient.id ? { ...p, active: newActive } : p));
                                                                            if (supabase) supabase.from('patients').update({ active: newActive }).eq('id', patient.id).catch(() => { });
                                                                            showToast(newActive ? 'Paciente reativado!' : 'Paciente desativado.', newActive ? 'success' : 'info');
                                                                        }}
                                                                        className={`absolute top-2 right-2 p-1.5 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition-all ${patient.active === false ? 'text-green-400 hover:bg-green-500/10' : 'text-amber-400 hover:bg-amber-500/10'}`}
                                                                        title={patient.active === false ? 'Reativar' : 'Desativar'}
                                                                    >
                                                                        {patient.active === false ? '✅' : '⏸️'}
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ));
                                        }
                                        // Admin: agrupar por profissional
                                        if (currentUser?.role === 'admin') {
                                            const groups: Record<string, typeof filteredPatients> = {};
                                            filteredPatients.forEach(p => {
                                                const profs = p.profissionais?.length ? p.profissionais : ['Sem profissional'];
                                                profs.forEach(prof => {
                                                    const key = (prof || 'Sem profissional').split(' - ')[0];
                                                    if (!groups[key]) groups[key] = [];
                                                    groups[key].push(p);
                                                });
                                            });
                                            return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([prof, pts]) => (
                                                <div key={prof}>
                                                    <button
                                                        onClick={() => setCollapsedGroups(prev => ({ ...prev, [prof]: !prev[prof] }))}
                                                        className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2 w-full text-left hover:text-slate-200 transition-colors py-1"
                                                    >
                                                        <span className={`transition-transform duration-200 ${collapsedGroups[prof] ? '' : 'rotate-90'}`}>▶</span>
                                                        <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                                                        {prof} <span className="text-slate-600 font-normal">({pts.length})</span>
                                                    </button>
                                                    {!collapsedGroups[prof] && (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                                                            {pts.map(patient => (
                                                                <div key={patient.id} className={`p-4 bg-slate-900 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-green-500/50 text-left transition-all group relative ${patient.active === false ? 'opacity-60' : ''}`}>
                                                                    <button onClick={() => setSelectedPatientForRecord(patient)} className="w-full text-left">
                                                                        <h3 className="font-bold text-white group-hover:text-green-400 transition-colors">
                                                                            {patient.nome}
                                                                            {patient.active === false && (
                                                                                <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-bold">INATIVO</span>
                                                                            )}
                                                                        </h3>
                                                                        <p className="text-xs text-slate-500">{patient.convenio || 'Particular'} • {patient.faixa || 'N/I'}</p>
                                                                        <p className="text-xs text-slate-600 mt-1">{(medicalRecords[patient.id]?.length || 0)} registro(s)</p>
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const newActive = patient.active === false ? true : false;
                                                                            setPatients(prev => prev.map(p => p.id === patient.id ? { ...p, active: newActive } : p));
                                                                            if (supabase) supabase.from('patients').update({ active: newActive }).eq('id', patient.id).catch(() => { });
                                                                            showToast(newActive ? 'Paciente reativado!' : 'Paciente desativado.', newActive ? 'success' : 'info');
                                                                        }}
                                                                        className={`absolute top-2 right-2 p-1.5 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition-all ${patient.active === false ? 'text-green-400 hover:bg-green-500/10' : 'text-amber-400 hover:bg-amber-500/10'}`}
                                                                        title={patient.active === false ? 'Reativar' : 'Desativar'}
                                                                    >
                                                                        {patient.active === false ? '✅' : '⏸️'}
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ));
                                        }
                                        // Clínica: flat list
                                        return (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {filteredPatients.map(patient => (
                                                    <button key={patient.id} onClick={() => setSelectedPatientForRecord(patient)} className={`p-4 bg-slate-900 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-green-500/50 text-left transition-all group ${patient.active === false ? 'opacity-60' : ''}`}>
                                                        <h3 className="font-bold text-white group-hover:text-green-400 transition-colors">
                                                            {patient.nome}
                                                            {patient.active === false && (
                                                                <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-bold">INATIVO</span>
                                                            )}
                                                        </h3>
                                                        <p className="text-xs text-slate-500">{patient.convenio || 'Particular'} • {patient.faixa || 'N/I'}</p>
                                                        <p className="text-xs text-slate-600 mt-1">{(medicalRecords[patient.id]?.length || 0)} registro(s)</p>
                                                    </button>
                                                ))}
                                            </div>
                                        );
                                    })()}
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
                                            // Sincronizar com Supabase
                                            if (supabase && connectionStatus !== 'offline') {
                                                supabase.from('medical_records').upsert({
                                                    id: record.id,
                                                    patient_id: patientId,
                                                    professional_id: record.professionalId,
                                                    date: record.date,
                                                    type: record.type,
                                                    data: JSON.parse(JSON.stringify(record))
                                                }).then(({ error }) => {
                                                    if (error) {
                                                        console.error('Erro ao salvar prontuário na nuvem:', error);
                                                        showToast('Registro salvo localmente. Erro na nuvem.', 'error');
                                                    }
                                                });
                                            }
                                            showToast('Registro salvo com sucesso!', 'success');
                                        }}
                                        onUpdatePatient={handlePatientUpdate}
                                        onUpdateRecord={(patientId, record) => {
                                            setMedicalRecords(prev => ({
                                                ...prev,
                                                [patientId]: (prev[patientId] || []).map(r => r.id === record.id ? record : r)
                                            }));
                                            if (supabase && connectionStatus !== 'offline') {
                                                supabase.from('medical_records').upsert({
                                                    id: record.id,
                                                    patient_id: patientId,
                                                    professional_id: record.professionalId,
                                                    date: record.date,
                                                    type: record.type,
                                                    data: JSON.parse(JSON.stringify(record))
                                                }).then(({ error }) => {
                                                    if (error) console.error('Erro ao atualizar prontuário na nuvem:', error);
                                                });
                                            }
                                            showToast('Registro atualizado!', 'success');
                                        }}
                                        onDeleteRecord={(patientId, recordId) => {
                                            setMedicalRecords(prev => ({
                                                ...prev,
                                                [patientId]: (prev[patientId] || []).filter(r => r.id !== recordId)
                                            }));
                                            if (supabase && connectionStatus !== 'offline') {
                                                supabase.from('medical_records').delete().eq('id', recordId).then(({ error }) => {
                                                    if (error) console.error('Erro ao deletar prontuário na nuvem:', error);
                                                });
                                            }
                                            showToast('Registro excluído!', 'info');
                                        }}
                                        // === Documentos e Pastas ===
                                        documents={patientDocuments[selectedPatientForRecord.id] || []}
                                        folders={documentFolders[selectedPatientForRecord.id] || []}
                                        onSaveDocument={(patientId, doc) => {
                                            setPatientDocuments(prev => {
                                                const existing = prev[patientId] || [];
                                                const idx = existing.findIndex(d => d.id === doc.id);
                                                return {
                                                    ...prev,
                                                    [patientId]: idx >= 0
                                                        ? existing.map(d => d.id === doc.id ? doc : d)
                                                        : [...existing, doc]
                                                };
                                            });
                                            if (supabase && connectionStatus !== 'offline') {
                                                supabase.from('patient_documents').upsert({
                                                    id: doc.id,
                                                    patient_id: patientId,
                                                    data: JSON.parse(JSON.stringify(doc))
                                                }).then(({ error }) => {
                                                    if (error) console.error('Erro ao salvar documento na nuvem:', error);
                                                });
                                            }
                                        }}
                                        onDeleteDocument={(patientId, docId) => {
                                            setPatientDocuments(prev => ({
                                                ...prev,
                                                [patientId]: (prev[patientId] || []).filter(d => d.id !== docId)
                                            }));
                                            if (supabase && connectionStatus !== 'offline') {
                                                supabase.from('patient_documents').delete().eq('id', docId).then(({ error }) => {
                                                    if (error) console.error('Erro ao deletar documento na nuvem:', error);
                                                });
                                            }
                                        }}
                                        onSaveFolder={(patientId, folder) => {
                                            setDocumentFolders(prev => ({
                                                ...prev,
                                                [patientId]: [...(prev[patientId] || []), folder]
                                            }));
                                            if (supabase && connectionStatus !== 'offline') {
                                                supabase.from('document_folders').upsert({
                                                    id: folder.id,
                                                    patient_id: patientId,
                                                    data: JSON.parse(JSON.stringify(folder))
                                                }).then(({ error }) => {
                                                    if (error) console.error('Erro ao salvar pasta na nuvem:', error);
                                                });
                                            }
                                        }}
                                        onDeleteFolder={(patientId, folderId) => {
                                            setDocumentFolders(prev => ({
                                                ...prev,
                                                [patientId]: (prev[patientId] || []).filter(f => f.id !== folderId)
                                            }));
                                            if (supabase && connectionStatus !== 'offline') {
                                                supabase.from('document_folders').delete().eq('id', folderId).then(({ error }) => {
                                                    if (error) console.error('Erro ao deletar pasta na nuvem:', error);
                                                });
                                            }
                                        }}
                                        onToggleActive={async (id, active) => {
                                            setPatients(prev => prev.map(p => p.id === id ? { ...p, active } : p));
                                            setSelectedPatientForRecord(prev => prev ? { ...prev, active } : null);
                                            if (supabase) {
                                                await supabase.from('patients').update({ active }).eq('id', id).catch(() => { });
                                            }
                                            showToast(active ? 'Paciente reativado!' : 'Paciente desativado.', active ? 'success' : 'info');
                                        }}
                                        onDelete={handleDeletePatient}
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
                            especialidades={
                                currentUser?.role === 'professional' && currentUser?.specialty
                                    ? especialidades.filter(e => e.toLowerCase() === currentUser.specialty!.toLowerCase())
                                    : especialidades
                            }
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
                <div className="fixed inset-0 bg-black/80 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl relative animate-fade-in max-h-[90vh] overflow-hidden">
                        <div className="sticky top-0 z-20 bg-slate-800/95 backdrop-blur border-b border-slate-700 rounded-t-2xl px-6 py-4">
                            <button
                                onClick={() => setShowLinksModal(false)}
                                className="absolute top-3 right-3 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60"
                                aria-label="Fechar"
                            >
                                <XIcon className="w-6 h-6" />
                            </button>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2 pr-12">
                                <UploadIcon className="w-5 h-5 text-sky-400" /> Links de Cadastro
                            </h3>
                            <p className="text-sm text-slate-400 mt-1">Envie estes links para que os pacientes preencham seus dados antes da consulta.</p>
                        </div>

                        <div className="px-6 py-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 92px)' }}>
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

                            {/* Fila de Espera - visível para todos */}
                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="bg-amber-900/30 p-2 rounded-lg"><StarIcon className="w-5 h-5 text-amber-400" /></div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-white text-sm">Fila de espera</h4>
                                        <p className="text-xs text-slate-500">Cadastro rápido para aguardar vaga</p>
                                    </div>
                                </div>
                                <button onClick={() => copyLink('?page=fila')} className="w-full bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-mono py-2 rounded border border-slate-600 transition">
                                    Copiar Link da Fila
                                </button>
                            </div>

                            {/* Link Pré-Configurado */}
                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="bg-purple-900/30 p-2 rounded-lg"><CalendarIcon className="w-5 h-5 text-purple-400" /></div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-white text-sm">Link Pré-Agendado</h4>
                                        <p className="text-xs text-slate-500">Com data/hora/profissional travados</p>
                                    </div>
                                </div>
                                <div className="space-y-2 mb-3">
                                    <select
                                        id="prePro"
                                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                                        disabled={currentUser?.role === 'professional'}
                                        defaultValue={currentUser?.role === 'professional' ? (profissionais.find(p => p.toLowerCase().includes(currentUser.name.toLowerCase())) || '') : ''}
                                    >
                                        {currentUser?.role === 'professional' ? (
                                            <option value={profissionais.find(p => p.toLowerCase().includes(currentUser.name.toLowerCase())) || currentUser.name}>{profissionais.find(p => p.toLowerCase().includes(currentUser.name.toLowerCase())) || currentUser.name}</option>
                                        ) : (
                                            <>
                                                <option value="">Profissional (opcional)</option>
                                                {profissionais.map(p => <option key={p} value={p}>{p}</option>)}
                                            </>
                                        )}
                                    </select>
                                    <div className="grid grid-cols-2 gap-2">
                                        <select
                                            id="preDia"
                                            className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                                        >
                                            <option value="">Dia (opcional)</option>
                                            <option value="Segunda-feira">Segunda</option>
                                            <option value="Terça-feira">Terça</option>
                                            <option value="Quarta-feira">Quarta</option>
                                            <option value="Quinta-feira">Quinta</option>
                                            <option value="Sexta-feira">Sexta</option>
                                            <option value="Sábado">Sábado</option>
                                        </select>
                                        <input
                                            type="time"
                                            id="preHora"
                                            className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        const pro = (document.getElementById('prePro') as HTMLSelectElement)?.value;
                                        const dia = (document.getElementById('preDia') as HTMLSelectElement)?.value;
                                        const hora = (document.getElementById('preHora') as HTMLInputElement)?.value;
                                        let params = '?page=cadastro';
                                        const qs: string[] = [];
                                        if (pro) qs.push(`prePro=${encodeURIComponent(pro)}`);
                                        if (dia) qs.push(`preDia=${encodeURIComponent(dia)}`);
                                        if (hora) qs.push(`preHora=${encodeURIComponent(hora)}`);
                                        if (qs.length) params += `&${qs.join('&')}`;
                                        copyLink(params);
                                    }}
                                    className="w-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium py-2 rounded transition"
                                >
                                    Copiar Link Pré-Configurado
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

            {/* Modal Meu Cadastro */}
            {showProfileModal && currentUser && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative animate-fade-in">
                        <button onClick={() => setShowProfileModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><XIcon className="w-6 h-6" /></button>
                        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <UserIcon className="w-5 h-5 text-[#e9c49e]" />
                            Meu cadastro
                        </h3>
                        <p className="text-xs text-slate-400 mb-6">
                            Atualize seus dados (ex: CRP/CRM) para aparecer corretamente nos PDFs.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Nome</label>
                                <input
                                    type="text"
                                    value={currentUser.name}
                                    disabled
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-400 outline-none opacity-70 cursor-not-allowed"
                                />
                                <p className="text-[11px] text-slate-500 mt-1">(Nome é alterado apenas pela clínica, para evitar bagunçar atribuições.)</p>
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Especialidade</label>
                                <input
                                    type="text"
                                    value={profileForm.specialty}
                                    onChange={e => setProfileForm(prev => ({ ...prev, specialty: e.target.value }))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-[#e9c49e]"
                                    placeholder="Ex: Psicologia"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Registro (CRP/CRM)</label>
                                <input
                                    type="text"
                                    value={profileForm.professionalRegister}
                                    onChange={e => setProfileForm(prev => ({ ...prev, professionalRegister: e.target.value }))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-[#e9c49e]"
                                    placeholder="Ex: CRP 06/12345"
                                />
                            </div>


                            <button
                                onClick={handleSaveMyProfile}
                                className="w-full bg-[#273e44] hover:bg-[#2f4d54] text-[#e9c49e] font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 border border-[#e9c49e]/10"
                            >
                                <CheckIcon className="w-5 h-5" /> Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Gerenciar Convênios */}
            {showConvenioManager && currentUser?.role === 'clinic' && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative animate-fade-in">
                        <button onClick={() => setShowConvenioManager(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><XIcon className="w-6 h-6" /></button>
                        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <StarIcon className="w-5 h-5 text-amber-400" />
                            Convênios
                        </h3>
                        <p className="text-xs text-slate-400 mb-3">Cadastre convênios com <strong>valor cheio</strong>, <strong>repasse</strong> e duração padrão. (Particular continua editável no agendamento.)</p>

                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div className="text-[11px] text-slate-500">
                                Regra: <strong>Repasse = Cheio × (%/100)</strong>. Padrão: 75%
                            </div>
                            <button
                                onClick={() => {
                                    const REPASSE_TABLE: Record<string, number> = {
                                        'FUNSERV CONVENCIONAL': 30.00,
                                        'FUNSERV ABA': 46.50,
                                        'DR. SAÚDE': 40.50,
                                        'DR. SAUDE': 40.50,
                                        'GAMA*': 27.75,
                                        'GAMA': 27.75,
                                        'DANAMED CONVENCIONAL': 30.00,
                                        'DANAMED ABA': 46.50,
                                        'FUSEX': 67.50,
                                        'SELECT SAÚDE': 33.75,
                                        'SELECT SAUDE': 33.75,
                                        'BLUE SAÚDE': 26.25,
                                        'BLUE SAUDE': 26.25,
                                        // Avaliação Neuropsicológica
                                        'FUNSERV CONVENCIONAL (AVALIAÇÃO NEUROPSICOLÓGICA)': 1014.00,
                                        'FUNSERV CONVENCIONAL (AVALIACAO NEUROPSICOLOGICA)': 1014.00
                                    };

                                    const normalize = (s: string) => (s || '')
                                        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
                                        .replace(/\s+/g, ' ')
                                        .trim()
                                        .toUpperCase();

                                    setConvenios((prev: ConvenioConfig[]) => {
                                        const byName = new Map(prev.map(c => [normalize(c.name), c]));
                                        const next: ConvenioConfig[] = [...prev];

                                        // 1) Cria convênios faltantes
                                        Object.keys(REPASSE_TABLE).forEach((rawName) => {
                                            const n = normalize(rawName);
                                            if (!byName.has(n)) {
                                                const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                                                const created: ConvenioConfig = {
                                                    id,
                                                    name: rawName,
                                                    active: true,
                                                    payoutPercent: 75,
                                                    payoutPrice: undefined,
                                                    price: undefined,
                                                    durationMin: 45
                                                };
                                                byName.set(n, created);
                                                next.push(created);
                                            }
                                        });

                                        // 2) Preenche valores
                                        return next.map(c => {
                                            const key1 = normalize(c.name);
                                            const repasse = REPASSE_TABLE[c.name.toUpperCase().trim()] ?? REPASSE_TABLE[key1];
                                            if (typeof repasse !== 'number') return { ...c, payoutPercent: c.payoutPercent ?? 75 };
                                            const pct = (c.payoutPercent ?? 75);
                                            const full = Math.round((repasse / (pct / 100)) * 100) / 100;
                                            return {
                                                ...c,
                                                payoutPercent: pct,
                                                payoutPrice: repasse,
                                                price: full,
                                                durationMin: c.durationMin ?? 45
                                            };
                                        });
                                    });

                                    alert('Convênios da tabela adicionados/atualizados (75%).');
                                }}
                                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg"
                            >
                                Adicionar/atualizar convênios da tabela (75%)
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                            {convenioList.map((c) => (
                                <div key={c.id} className="grid grid-cols-12 gap-2 items-center bg-slate-900/50 border border-slate-700 rounded-xl p-3">
                                    <div className="col-span-4">
                                        <label className="block text-[11px] text-slate-500 mb-1">Nome</label>
                                        <input
                                            value={c.name}
                                            onChange={(e) => {
                                                const name = e.target.value;
                                                setConvenios((prev: ConvenioConfig[]) => prev.map(x => x.id === c.id ? { ...x, name } : x));
                                            }}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[11px] text-slate-500 mb-1">% repasse</label>
                                        <select
                                            value={c.payoutPercent ?? 75}
                                            onChange={(e) => {
                                                const payoutPercent = Number(e.target.value);
                                                setConvenios((prev: ConvenioConfig[]) => prev.map(x => {
                                                    if (x.id !== c.id) return x;
                                                    const full = x.price;
                                                    const rep = typeof full === 'number'
                                                        ? (Math.round((full * (payoutPercent / 100)) * 100) / 100)
                                                        : x.payoutPrice;
                                                    return { ...x, payoutPercent, payoutPrice: rep };
                                                }));
                                            }}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        >
                                            {[50, 60, 65, 70, 75, 80, 85, 90].map(p => <option key={p} value={p}>{p}%</option>)}
                                        </select>
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-[11px] text-slate-500 mb-1">Repasse (R$)</label>
                                        <input
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            value={typeof c.payoutPrice === 'number' ? c.payoutPrice : ''}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                const payoutPrice = v === '' ? undefined : Number(v);
                                                // Repasse pode ser ajustado manualmente, mas NÃO recalcula o valor cheio.
                                                setConvenios((prev: ConvenioConfig[]) => prev.map(x => x.id === c.id ? { ...x, payoutPrice } : x));
                                            }}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                            placeholder="ex: 30"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-[11px] text-slate-500 mb-1">Cheio (R$)</label>
                                        <input
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            value={typeof c.price === 'number' ? c.price : ''}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                const price = v === '' ? undefined : Number(v);
                                                const pct = c.payoutPercent ?? 75;
                                                const rep = typeof price === 'number'
                                                    ? (Math.round((price * (pct / 100)) * 100) / 100)
                                                    : undefined;
                                                setConvenios((prev: ConvenioConfig[]) => prev.map(x => x.id === c.id ? { ...x, price, payoutPrice: rep } : x));
                                            }}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                            placeholder="ex: 40"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-[11px] text-slate-500 mb-1">Duração (min)</label>
                                        <select
                                            value={c.durationMin ?? ''}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                const durationMin = v === '' ? undefined : Number(v);
                                                setConvenios((prev: ConvenioConfig[]) => prev.map(x => x.id === c.id ? { ...x, durationMin } : x));
                                            }}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        >
                                            <option value="">—</option>
                                            {[15, 30, 45, 60, 75, 90].map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-1 flex justify-end">
                                        <button
                                            onClick={() => {
                                                const ok = confirm(`Remover convênio "${c.name}"?`);
                                                if (!ok) return;
                                                setConvenios((prev: ConvenioConfig[]) => prev.filter(x => x.id !== c.id));
                                            }}
                                            className="p-2 text-slate-400 hover:text-red-400"
                                            title="Remover"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 mt-5">
                            <button
                                onClick={() => {
                                    const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                                    setConvenios((prev: ConvenioConfig[]) => ([
                                        ...prev,
                                        { id, name: 'Novo Convênio', active: true, payoutPercent: 75, payoutPrice: undefined, price: undefined, durationMin: 45 }
                                    ]));
                                }}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-lg"
                            >
                                + Novo convênio
                            </button>
                            <button
                                onClick={() => setShowConvenioManager(false)}
                                className="ml-auto px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-bold rounded-lg"
                            >
                                Fechar
                            </button>
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