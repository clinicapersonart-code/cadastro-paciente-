
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
    const [convenios, setConvenios] = useLocalStorage<string[]>(STORAGE_KEYS.CONVENIOS, DEFAULT_CONVENIOS);
    const [profissionais, setProfissionais] = useLocalStorage<string[]>(STORAGE_KEYS.PROFISSIONAIS, DEFAULT_PROFISSIONAIS);
    const [especialidades, setEspecialidades] = useLocalStorage<string[]>(STORAGE_KEYS.ESPECIALIDADES, DEFAULT_ESPECIALIDADES);
    const [activeTab, setActiveTab] = useLocalStorage<'pacientes' | 'agenda' | 'funserv'>('personart.view.tab', 'pacientes');
    const [brand] = useLocalStorage<BrandConfig>(STORAGE_KEYS.BRAND, { color: '#e9c49e', dark: '#273e44', logo: null, name: 'Clínica Personart' });
    const [accessPass, setAccessPass] = useLocalStorage<string>(STORAGE_KEYS.ACCESS_PASS, 'personart');
    const [sessionAuth, setSessionAuth] = useLocalStorage<number | null>('personart.auth.session', null);

    const [patients, setPatients] = useState<Patient[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [inbox, setInbox] = useState<PreCadastro[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dbError, setDbError] = useState('');
    const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');

    const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ convenio: '', profissional: '', faixa: '' });
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [view, setView] = useState<'landing' | 'login' | 'dashboard'>('landing');
    const [loginInput, setLoginInput] = useState('');
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' | 'info' } | null>(null);

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
            if (isSupabaseConfigured() && supabase) {
                try {
                    const { error } = await supabase.from('patients').select('id').limit(1);
                    setConnectionStatus(error ? 'error' : 'connected');
                } catch {
                    setConnectionStatus('error');
                }
            }
        };
        initSystem();
    }, [sessionAuth, setSessionAuth]);

    useEffect(() => {
        if (isAuthenticated && isSupabaseConfigured() && supabase) {
            const fetchData = async () => {
                setIsLoading(true);
                try {
                    const { data: patData } = await supabase.from('patients').select('*');
                    if (patData) setPatients(patData.map((row: any) => row.data));

                    const { data: apptData } = await supabase.from('appointments').select('*');
                    if (apptData) setAppointments(apptData.map((row: any) => row.data));

                    const { data: inboxData } = await supabase.from('inbox').select('*');
                    if (inboxData) setInbox(inboxData.map((row: any) => row.data));
                } catch (err: any) {
                    setDbError(err.message || 'Erro ao conectar ao banco.');
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
        if (!supabase) return;
        
        let newPatientId = patient.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        const numAut = patient.funservConfig?.numeroAutorizacao || patient.numero_autorizacao || '';
        const dataAut = patient.funservConfig?.dataAutorizacao || patient.data_autorizacao || null;

        const patientToSave = { ...patient, id: newPatientId, numero_autorizacao: numAut, data_autorizacao: dataAut };
        const cleanData = JSON.parse(JSON.stringify(patientToSave));

        const { error } = await supabase.from('patients').upsert({
            id: newPatientId,
            nome: patientToSave.nome,
            carteirinha: patientToSave.carteirinha || '',
            numero_autorizacao: numAut,
            data_autorizacao: dataAut,
            data: cleanData
        });

        if (error) {
            showToast(`Erro Supabase: ${error.message}`, 'error');
            console.error(error);
            return;
        }

        setPatients(prev => {
            const exists = prev.find(p => p.id === newPatientId);
            return exists ? prev.map(p => p.id === newPatientId ? patientToSave : p) : [...prev, patientToSave];
        });
        setEditingPatient(null);
        showToast('Paciente salvo na nuvem com sucesso!');

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
        if (!supabase) return;
        
        const patient = patients.find(p => p.id === appt.patientId);
        const enrichedAppt = {
            ...appt,
            numero_autorizacao: patient?.funservConfig?.numeroAutorizacao || patient?.numero_autorizacao || appt.numero_autorizacao || '',
            // Fix: Fixed typo in data_autorizacao access (was patient?.data_autor_izacao)
            data_autorizacao: patient?.funservConfig?.dataAutorizacao || patient?.data_autorizacao || appt.data_autorizacao || null
        };

        const { error } = await supabase.from('appointments').upsert({
            id: enrichedAppt.id,
            date: enrichedAppt.date,
            patient_id: enrichedAppt.patientId,
            status: enrichedAppt.status,
            carteirinha: enrichedAppt.carteirinha || '',
            // Fix: Fixed typo in property access (was numero_autor_izacao)
            numero_autorizacao: enrichedAppt.numero_autorizacao || '',
            data_autorizacao: enrichedAppt.data_autorizacao,
            data: JSON.parse(JSON.stringify(enrichedAppt))
        });
        if (error) {
            console.error("Erro agendamento:", error);
        } else {
            setAppointments(prev => [...prev, enrichedAppt]);
        }
    };

    const handleAddBatchAppointments = async (batch: Appointment[]) => {
        if (!supabase) return;
        
        const records = batch.map(a => {
            const patient = patients.find(p => p.id === a.patientId);
            const enriched = {
                ...a,
                numero_autorizacao: patient?.funservConfig?.numeroAutorizacao || patient?.numero_autorizacao || '',
                // Fix: Fixed typo in data_autorizacao access (was patient?.data_autor_izacao)
                data_autorizacao: patient?.funservConfig?.dataAutorizacao || patient?.data_autorizacao || null
            };
            return {
                id: enriched.id,
                date: enriched.date,
                patient_id: enriched.patientId,
                status: enriched.status,
                carteirinha: enriched.carteirinha || '',
                // Fix: Fixed typo in property access (was numero_autor_izacao)
                numero_autorizacao: enriched.numero_autorizacao || '',
                data_autorizacao: enriched.data_autorizacao,
                data: JSON.parse(JSON.stringify(enriched))
            };
        });

        const { error } = await supabase.from('appointments').upsert(records);
        if (!error) {
            setAppointments(prev => [...prev, ...batch]);
        }
    };

    const handleUpdateAppointment = async (appt: Appointment) => {
        if (!supabase) return;
        const { error } = await supabase.from('appointments').upsert({
            id: appt.id,
            date: appt.date,
            patient_id: appt.patientId,
            status: appt.status,
            carteirinha: appt.carteirinha || '',
            // Fix: Fixed typo in property access (was appt.numero_autorizacao)
            numero_autorizacao: appt.numero_autorizacao || '',
            data_autorizacao: appt.data_autorizacao || null,
            data: JSON.parse(JSON.stringify(appt))
        });
        if (!error) setAppointments(prev => prev.map(x => x.id === appt.id ? appt : x));
    };

    const handleDeleteAppointment = async (id: string) => {
        if (!supabase) return;
        const { error } = await supabase.from('appointments').delete().eq('id', id);
        if (!error) setAppointments(prev => prev.filter(x => x.id !== id));
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
            return true;
        }).sort((a, b) => a.nome.localeCompare(b.nome));
    }, [patients, searchTerm, filters]);

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
                    <h1 className="font-bold text-xl cursor-pointer" onClick={() => setActiveTab('pacientes')} style={{ color: brand.color }}>{brand.name}</h1>
                    <nav className="flex gap-2">
                        <button onClick={() => setActiveTab('pacientes')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'pacientes' ? 'bg-sky-600' : 'hover:bg-slate-700'}`}>Pacientes</button>
                        <button onClick={() => setActiveTab('agenda')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'agenda' ? 'bg-sky-600' : 'hover:bg-slate-700'}`}>Agenda</button>
                        <button onClick={() => setActiveTab('funserv')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'funserv' ? 'bg-sky-600' : 'hover:bg-slate-700'}`}>Funserv</button>
                        <button onClick={handleLogout} className="p-2 text-red-400"><LockIcon className="w-5 h-5" /></button>
                    </nav>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6">
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
                            <input type="text" placeholder="Buscar por nome ou carteirinha..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500" />
                            <PatientTable patients={filteredPatients} onEdit={p => { setEditingPatient(p); window.scrollTo(0,0); }} onDelete={async id => { if(confirm('Excluir?')) { await supabase?.from('patients').delete().eq('id', id); setPatients(prev => prev.filter(p => p.id !== id)); } }} />
                        </div>
                    </div>
                )}
                {activeTab === 'agenda' && <Agenda patients={patients} profissionais={profissionais} appointments={appointments} onAddAppointment={handleAddAppointment} onAddBatchAppointments={handleAddBatchAppointments} onUpdateAppointment={handleUpdateAppointment} onDeleteAppointment={handleDeleteAppointment} />}
                {activeTab === 'funserv' && <FunservManager patients={patients} onSavePatient={handleSavePatient} />}
            </main>

            {toast && <div className={`fixed bottom-4 right-4 p-4 rounded-xl shadow-2xl border animate-fade-in ${toast.type === 'error' ? 'bg-red-900 border-red-700' : 'bg-green-900 border-green-700'}`}>{toast.msg}</div>}
        </div>
    );
};

export default App;
