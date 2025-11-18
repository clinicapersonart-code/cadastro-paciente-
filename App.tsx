
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Patient, BrandConfig, BackupData, EncryptedPackage, Appointment, PreCadastro } from './types';
import { STORAGE_KEYS, DEFAULT_CONVENIOS, DEFAULT_PROFISSIONAIS, DEFAULT_ESPECIALIDADES } from './constants';
import useLocalStorage from './hooks/useLocalStorage';
import { encryptJSON, decryptJSON } from './services/cryptoService';
import { downloadFile, exportToCSV, readTextFromFile, readDataURLFromFile } from './services/fileService';
import { PatientForm } from './components/PatientForm';
import { PatientTable } from './components/PatientTable';
import { Agenda } from './components/Agenda';
import { PublicRegistration } from './components/PublicRegistration';
import { DownloadIcon, UploadIcon, CloudIcon, TrashIcon, CloudDownloadIcon, UserIcon, CalendarIcon, InboxIcon, CheckIcon, XIcon } from './components/icons';

const App: React.FC = () => {
    const [convenios, setConvenios] = useLocalStorage<string[]>(STORAGE_KEYS.CONVENIOS, DEFAULT_CONVENIOS);
    
    // Simple router check
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const isPublicRegistration = mode === 'cadastro';
    const isPatientUpdate = mode === 'atualizacao';

    const [activeTab, setActiveTab] = useState<'pacientes' | 'agenda'>('pacientes');
    
    const [patients, setPatients] = useLocalStorage<Patient[]>(STORAGE_KEYS.PACIENTES, []);
    const [appointments, setAppointments] = useLocalStorage<Appointment[]>(STORAGE_KEYS.AGENDA, []);
    // convenios is declared above to be available for PublicRegistration return check
    const [profissionais, setProfissionais] = useLocalStorage<string[]>(STORAGE_KEYS.PROFISSIONAIS, DEFAULT_PROFISSIONAIS);
    const [especialidades, setEspecialidades] = useLocalStorage<string[]>(STORAGE_KEYS.ESPECIALIDADES, DEFAULT_ESPECIALIDADES);
    const [brand, setBrand] = useLocalStorage<BrandConfig>(STORAGE_KEYS.BRAND, { color: '#F2C8A0', dark: '#E3B189', logo: null, name: 'Clínica Personart' });
    const [cloudEndpoint, setCloudEndpoint] = useLocalStorage<string>(STORAGE_KEYS.CLOUD_ENDPOINT, 'https://script.google.com/macros/s/AKfycbyM5earqQA7H3Wuh601E4d1KpAIq7StzqfNNc0bMNbZHHsCdh63GgJiv03aclt8wcTxrQ/exec');
    const [cloudPass, setCloudPass] = useLocalStorage<string>(STORAGE_KEYS.CLOUD_PASS, '');

    const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ convenio: '', profissional: '', faixa: '' });
    const [isListVisible, setIsListVisible] = useState(false);
    const [syncStatus, setSyncStatus] = useState<{ msg: string, isOk: boolean } | null>(null);
    
    // Inbox State
    const [inbox, setInbox] = useState<PreCadastro[]>([]);
    const [showInbox, setShowInbox] = useState(false);

    const importFileInputRef = useRef<HTMLInputElement>(null);
    
    const sortedConvenios = useMemo(() => [...convenios].sort((a, b) => a.localeCompare(b, 'pt-BR')), [convenios]);

    // If Public Mode, return early
    if (isPublicRegistration || isPatientUpdate) {
        return (
            <PublicRegistration 
                cloudEndpoint={cloudEndpoint} 
                brandName={brand.name} 
                brandColor={brand.color} 
                brandLogo={brand.logo} 
                isUpdateMode={isPatientUpdate}
                convenios={sortedConvenios}
            />
        );
    }

    useEffect(() => {
        document.documentElement.style.setProperty('--brand-color', brand.color);
        document.documentElement.style.setProperty('--brand-dark-color', brand.dark);
    }, [brand]);

    useEffect(() => {
        const missing = DEFAULT_PROFISSIONAIS.filter(d => !profissionais.includes(d));
        if (missing.length > 0) {
            setProfissionais(prev => {
                const combined = [...prev, ...missing];
                return Array.from(new Set(combined));
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    
    const sortedProfissionais = useMemo(() => [...profissionais].sort((a, b) => a.localeCompare(b, 'pt-BR')), [profissionais]);
    const sortedEspecialidades = useMemo(() => [...especialidades].sort((a, b) => a.localeCompare(b, 'pt-BR')), [especialidades]);

    const performCloudSync = useCallback(async (currentPatients: Patient[], currentAppointments: Appointment[], isManualTrigger: boolean) => {
        let url = cloudEndpoint;
        if (!url) {
            if (isManualTrigger) {
                url = prompt('Para sincronizar, cole a URL do seu Apps Script para o Google Drive:') || '';
                if (!url) {
                    alert('Endpoint não informado. Sincronização cancelada.');
                    return;
                }
                setCloudEndpoint(url);
            } else {
                setSyncStatus({ msg: 'Endpoint da nuvem não configurado para backup automático.', isOk: false });
                return;
            }
        }
    
        let pass = cloudPass;
        if (!pass) {
            if (isManualTrigger) {
                pass = prompt('Defina a senha para criptografar o backup na nuvem (ficará salva neste navegador):');
                if (!pass) {
                    alert('Senha não informada. Sincronização cancelada.');
                    return;
                }
                setCloudPass(pass);
            } else {
                setSyncStatus({ msg: 'Senha da nuvem não configurada para backup automático.', isOk: false });
                return;
            }
        }
    
        try {
            setSyncStatus({ msg: 'Sincronizando com a nuvem...', isOk: true });
            const payload: BackupData = { 
                pacientes: currentPatients, 
                agendamentos: currentAppointments,
                convenios, 
                profissionais, 
                especialidades, 
                ts: new Date().toISOString() 
            };
            const encrypted = await encryptJSON(payload, pass);
    
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    type: 'backup',
                    data: encrypted
                })
            });
    
            if (!res.ok) throw new Error(`Erro do servidor ${res.status}: ${res.statusText}.`);
    
            const result = await res.json();
            if (result.status === 'error') throw new Error(result.message);

            const statusMsg = `Backup salvo no Google Drive.`;
            setSyncStatus({ msg: statusMsg, isOk: true });
            if (isManualTrigger) alert(statusMsg);
        } catch (err) {
            const errorMsg = `Erro ao sincronizar: ${err instanceof Error ? err.message : String(err)}`;
            setSyncStatus({ msg: errorMsg, isOk: false });
            if (isManualTrigger) alert(errorMsg);
            throw err;
        }
    }, [cloudEndpoint, cloudPass, convenios, profissionais, especialidades, setCloudEndpoint, setCloudPass]);

    const handleCloudRestore = useCallback(async () => {
        if (patients.length > 0 && !window.confirm('Isso substituirá TODOS os dados locais pelo backup do Google Drive. Deseja continuar?')) {
            return;
        }

        let url = cloudEndpoint;
        if (!url) {
            url = prompt('Para sincronizar, cole a URL do seu Apps Script:') || '';
            if (!url) return;
            setCloudEndpoint(url);
        }
    
        let pass = cloudPass;
        if (!pass) {
            pass = prompt('Digite a senha do backup na nuvem:');
            if (!pass) return;
        }

        try {
            setSyncStatus({ msg: 'Buscando backup na nuvem...', isOk: true });
            // Add parameter to specifically ask for backup
            const res = await fetch(`${url}?action=get_backup`);
            if (!res.ok) throw new Error(`Erro do servidor ${res.status}: ${res.statusText}.`);
            
            const pkg = await res.json();
            
            if (pkg.status === 'not_found') throw new Error('Nenhum arquivo de backup encontrado no Google Drive.');
            if (pkg.status === 'error') throw new Error(pkg.message);

            setSyncStatus({ msg: 'Backup encontrado. Descriptografando...', isOk: true });
            const data = await decryptJSON(pkg as EncryptedPackage, pass);

            setPatients(data.pacientes || []);
            setAppointments(data.agendamentos || []);
            setConvenios(data.convenios || DEFAULT_CONVENIOS);
            setProfissionais(data.profissionais || DEFAULT_PROFISSIONAIS);
            setEspecialidades(data.especialidades || DEFAULT_ESPECIALIDADES);
            
            const successMsg = `Dados sincronizados. ${data.pacientes.length} pacientes e ${(data.agendamentos || []).length} agendamentos carregados.`;
            setSyncStatus({ msg: successMsg, isOk: true });
            alert(successMsg);
            setCloudPass(pass); 

        } catch (err) {
            const errorMsg = `Erro ao restaurar da nuvem: ${err instanceof Error ? err.message : String(err)}`;
            setSyncStatus({ msg: errorMsg, isOk: false });
            alert(errorMsg);
        }
    }, [cloudEndpoint, cloudPass, setCloudEndpoint, setCloudPass, setPatients, setAppointments, setConvenios, setProfissionais, setEspecialidades, patients.length]);

    // --- Inbox Logic ---

    const checkInbox = async () => {
        if (!cloudEndpoint) return;
        try {
            setSyncStatus({ msg: 'Verificando novos cadastros...', isOk: true });
            const res = await fetch(`${cloudEndpoint}?action=get_inbox`);
            if (!res.ok) throw new Error('Erro ao buscar inbox');
            const data = await res.json();
            
            if (data && Array.isArray(data.submissions)) {
                setInbox(data.submissions);
                if (data.submissions.length > 0) {
                    setShowInbox(true);
                    setSyncStatus({ msg: `${data.submissions.length} novos pré-cadastros encontrados.`, isOk: true });
                } else {
                    alert('Nenhum pré-cadastro novo encontrado.');
                    setSyncStatus({ msg: 'Caixa de entrada vazia.', isOk: true });
                }
            }
        } catch (err) {
            console.error(err);
            setSyncStatus({ msg: 'Erro ao verificar inbox.', isOk: false });
        }
    };

    const handleImportInboxItem = (item: PreCadastro) => {
        const age = new Date().getFullYear() - new Date(item.nascimento).getFullYear();
        
        // Check if patient already exists to update or create new
        // Simple check by name for now, could be improved
        const existing = patients.find(p => p.nome.toLowerCase() === item.nome.toLowerCase());

        const newPatient: Patient = {
            id: existing ? existing.id : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            nome: item.nome,
            nascimento: item.nascimento,
            faixa: age < 18 ? 'Criança' : 'Adulto',
            responsavel: item.responsavel,
            contato: item.contato,
            email: item.email,
            endereco: item.endereco,
            convenio: item.convenio || (existing ? existing.convenio : ''),
            carteirinha: item.carteirinha || (existing ? existing.carteirinha : ''),
            tipoAtendimento: existing ? existing.tipoAtendimento : '',
            profissionais: existing ? existing.profissionais : [],
            especialidades: existing ? existing.especialidades : [],
            origem: 'Site'
        };
        setEditingPatient(newPatient);
        setShowInbox(false);
        // Remove from inbox list locally (real removal from server should happen, but for now we just ignore)
        setInbox(prev => prev.filter(i => i.id !== item.id));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDismissInboxItem = (id: string) => {
         if(window.confirm("Ignorar este pré-cadastro?")) {
            setInbox(prev => prev.filter(i => i.id !== id));
         }
    };


    // --- Patient Actions ---

    const handleSavePatient = (patient: Patient) => {
        let updatedPatients;
        if (patient.id) {
            updatedPatients = patients.map(p => p.id === patient.id ? patient : p);
        } else {
            updatedPatients = [...patients, { ...patient, id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}` }];
        }
        setPatients(updatedPatients);
        setEditingPatient(null);
        performCloudSync(updatedPatients, appointments, false).catch(e => console.error("Erro auto-save:", e));
    };

    const handleEditPatient = (patient: Patient) => {
        setEditingPatient(patient);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeletePatient = (id: string) => {
        if (window.confirm('Excluir este paciente?')) {
            const updatedPatients = patients.filter(p => p.id !== id);
            setPatients(updatedPatients);
            performCloudSync(updatedPatients, appointments, false).catch(e => console.error("Erro auto-save:", e));
        }
    };

    // --- Appointment Actions ---

    const handleAddAppointment = (appt: Appointment) => {
        const updated = [...appointments, appt];
        setAppointments(updated);
        performCloudSync(patients, updated, false).catch(e => console.error("Erro auto-save agenda:", e));
    };

    const handleUpdateAppointment = (appt: Appointment) => {
        const updated = appointments.map(a => a.id === appt.id ? appt : a);
        setAppointments(updated);
        performCloudSync(patients, updated, false).catch(e => console.error("Erro auto-save agenda:", e));
    };

    const handleDeleteAppointment = (id: string) => {
        if (window.confirm('Remover este agendamento?')) {
            const updated = appointments.filter(a => a.id !== id);
            setAppointments(updated);
            performCloudSync(patients, updated, false).catch(e => console.error("Erro auto-save agenda:", e));
        }
    };

    // --- Generic Actions ---

    const handleAddNewItem = (list: string[], setList: (list: string[]) => void, item: string) => {
        const trimmed = item.trim();
        if (trimmed && !list.some(i => i.toLowerCase() === trimmed.toLowerCase())) setList([...list, trimmed]);
    };
    
    const handleRemoveItem = (list: string[], setList: (list: string[]) => void, item: string) => {
        if (!item) return;
        if (window.confirm(`Remover "${item}" da lista de opções? (Não afeta históricos)`)) setList(list.filter(i => i !== item));
    };
    
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

    const showTable = isListVisible || searchTerm || filters.convenio || filters.profissional || filters.faixa;

    const handleExport = () => downloadFile('pacientes_personart.csv', exportToCSV(patients), 'text/csv;charset=utf-8');

    const handleEncryptedBackup = async () => {
        let pass = cloudPass || prompt('Senha para backup local:');
        if (!pass) return;
        setCloudPass(pass);
        try {
            const payload: BackupData = { pacientes: patients, agendamentos: appointments, convenios, profissionais, especialidades, ts: new Date().toISOString() };
            const pkg = await encryptJSON(payload, pass);
            downloadFile('backup_personart.enc.json', JSON.stringify(pkg), 'application/json');
        } catch (err) {
            alert(`Falha: ${err instanceof Error ? err.message : String(err)}`);
        }
    };
    
    const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await readTextFromFile(file);
            let data: any;
            try {
                const pkg = JSON.parse(text);
                if (pkg && pkg.format === 'personart-aesgcm-v1') {
                    let pass = cloudPass || prompt('Arquivo criptografado. Digite a senha:');
                    if (!pass) throw new Error('Senha obrigatória');
                    data = await decryptJSON(pkg as EncryptedPackage, pass);
                } else {
                    data = pkg;
                }
            } catch {
                data = JSON.parse(text);
            }

            if (data && Array.isArray(data.pacientes)) {
                setPatients(data.pacientes);
                if (data.agendamentos) setAppointments(data.agendamentos);
                if (data.convenios) setConvenios(data.convenios);
                if (data.profissionais) setProfissionais(data.profissionais);
                if (data.especialidades) setEspecialidades(data.especialidades);
                alert('Backup importado com sucesso.');
            } else {
                throw new Error('Formato inválido');
            }
        } catch (err) {
            alert(`Falha: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            e.target.value = ''; 
        }
    };
    
    const handleSyncClick = () => performCloudSync(patients, appointments, true);

    // --- RENDER ---

    return (
        <div className="min-h-screen pb-12">
            <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-20 backdrop-blur-md bg-opacity-80">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        {brand.logo && <img src={brand.logo} alt="Logo" className="h-10 w-10 rounded-lg bg-slate-800 p-1" />}
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: brand.color }}>{brand.name}</h1>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <nav className="flex space-x-2 bg-slate-800 p-1 rounded-xl overflow-x-auto max-w-full">
                        <button 
                            onClick={() => setActiveTab('pacientes')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'pacientes' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                        >
                            <UserIcon className="w-4 h-4" /> Pacientes
                        </button>
                        <button 
                            onClick={() => setActiveTab('agenda')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'agenda' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                        >
                            <CalendarIcon className="w-4 h-4" /> Agenda
                        </button>
                        <button 
                            onClick={checkInbox}
                            className="px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 text-sky-400 hover:text-sky-300 hover:bg-slate-700/50 whitespace-nowrap border border-slate-700"
                        >
                            <InboxIcon className="w-4 h-4" /> Pré-cadastros
                        </button>
                    </nav>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
                
                {activeTab === 'pacientes' ? (
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
                            
                            {/* Toolbar (Condensed) */}
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
                                    <button onClick={handleEncryptedBackup} title="Backup Local" className="bg-slate-700 text-slate-200 px-3 py-1.5 rounded text-xs"><DownloadIcon className="w-3.5 h-3.5" /></button>
                                    <label className="bg-slate-700 text-slate-200 px-3 py-1.5 rounded text-xs cursor-pointer"><UploadIcon className="w-3.5 h-3.5" /><input ref={importFileInputRef} type="file" className="hidden" onChange={handleImportBackup} /></label>
                                    <button onClick={handleCloudRestore} title="Sincronizar" className="bg-teal-600 text-white px-3 py-1.5 rounded text-xs"><CloudDownloadIcon className="w-3.5 h-3.5" /></button>
                                    <button onClick={handleSyncClick} title="Salvar Nuvem" className="bg-sky-600 text-white px-3 py-1.5 rounded text-xs"><CloudIcon className="w-3.5 h-3.5" /></button>
                                </div>
                                {syncStatus && <p className={`text-xs text-right ${syncStatus.isOk ? 'text-green-400' : 'text-red-400'}`}>{syncStatus.msg}</p>}
                            </div>

                            {showTable ? (
                                <>
                                    <PatientTable patients={filteredPatients} onEdit={handleEditPatient} onDelete={handleDeletePatient} />
                                    <p className="text-xs text-slate-500 text-right">{filteredPatients.length} registros</p>
                                </>
                            ) : (
                                <div className="text-center py-8 text-slate-500">
                                    <p>Use a busca ou filtros para encontrar pacientes.</p>
                                    {patients.length === 0 && <button onClick={handleCloudRestore} className="mt-4 text-teal-400 underline text-sm">Restaurar backup da nuvem?</button>}
                                </div>
                            )}
                        </section>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto">
                        <Agenda 
                            patients={patients}
                            profissionais={sortedProfissionais}
                            appointments={appointments}
                            onAddAppointment={handleAddAppointment}
                            onUpdateAppointment={handleUpdateAppointment}
                            onDeleteAppointment={handleDeleteAppointment}
                        />
                        <div className="mt-6 flex justify-end">
                             <button onClick={handleSyncClick} className="text-xs text-sky-500 hover:text-sky-400 flex items-center gap-1"><CloudIcon className="w-3 h-3" /> Forçar backup da agenda</button>
                        </div>
                    </div>
                )}
            </main>

            {/* Inbox Modal */}
            {showInbox && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2"><InboxIcon className="w-5 h-5 text-sky-400"/> Novos Pré-cadastros</h3>
                            <button onClick={() => setShowInbox(false)} className="text-slate-400 hover:text-slate-200"><XIcon className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            {inbox.map(item => (
                                <div key={item.id} className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                                    <div>
                                        <h4 className="font-bold text-white">{item.nome}</h4>
                                        <p className="text-sm text-slate-400">Nasc: {item.nascimento} • Resp: {item.responsavel || 'N/A'}</p>
                                        <p className="text-sm text-slate-400">{item.contato} • {item.email}</p>
                                        <p className="text-sm text-slate-500 mt-1">{item.convenio ? `${item.convenio} (${item.carteirinha})` : 'Particular'}</p>
                                        <p className="text-xs text-slate-600 mt-1">Enviado em: {new Date(item.dataEnvio).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleDismissInboxItem(item.id)} className="p-2 hover:bg-red-900/30 text-red-400 rounded-lg transition text-sm">Ignorar</button>
                                        <button onClick={() => handleImportInboxItem(item)} className="py-2 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition text-sm font-semibold">Importar</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
