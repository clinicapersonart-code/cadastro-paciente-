
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Patient, BrandConfig, BackupData, EncryptedPackage } from './types';
import { STORAGE_KEYS, DEFAULT_CONVENIOS, DEFAULT_PROFISSIONAIS, DEFAULT_ESPECIALIDADES } from './constants';
import useLocalStorage from './hooks/useLocalStorage';
import { encryptJSON, decryptJSON } from './services/cryptoService';
import { downloadFile, exportToCSV, readTextFromFile, readDataURLFromFile } from './services/fileService';
import { PatientForm } from './components/PatientForm';
import { PatientTable } from './components/PatientTable';
import { DownloadIcon, UploadIcon, CloudIcon, TrashIcon, CloudDownloadIcon } from './components/icons';

const App: React.FC = () => {
    const [patients, setPatients] = useLocalStorage<Patient[]>(STORAGE_KEYS.PACIENTES, []);
    const [convenios, setConvenios] = useLocalStorage<string[]>(STORAGE_KEYS.CONVENIOS, DEFAULT_CONVENIOS);
    const [profissionais, setProfissionais] = useLocalStorage<string[]>(STORAGE_KEYS.PROFISSIONAIS, DEFAULT_PROFISSIONAIS);
    const [especialidades, setEspecialidades] = useLocalStorage<string[]>(STORAGE_KEYS.ESPECIALIDADES, DEFAULT_ESPECIALIDADES);
    const [brand, setBrand] = useLocalStorage<BrandConfig>(STORAGE_KEYS.BRAND, { color: '#F2C8A0', dark: '#E3B189', logo: null, name: 'Clínica Personart' });
    const [cloudEndpoint, setCloudEndpoint] = useLocalStorage<string>(STORAGE_KEYS.CLOUD_ENDPOINT, 'https://script.google.com/macros/s/AKfycbzngsqG19W8ArqohZtC6bxPyWgxMk_CcRXRKduLsK50MpXJf3Jvm6HP0tQaRPrcAFjjNg/exec');
    const [cloudPass, setCloudPass] = useLocalStorage<string>(STORAGE_KEYS.CLOUD_PASS, '');

    const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ convenio: '', profissional: '', faixa: '' });
    const [isListVisible, setIsListVisible] = useState(false);
    const [syncStatus, setSyncStatus] = useState<{ msg: string, isOk: boolean } | null>(null);
    
    const importFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        document.documentElement.style.setProperty('--brand-color', brand.color);
        document.documentElement.style.setProperty('--brand-dark-color', brand.dark);
    }, [brand]);


    const sortedConvenios = useMemo(() => [...convenios].sort((a, b) => a.localeCompare(b, 'pt-BR')), [convenios]);
    const sortedProfissionais = useMemo(() => [...profissionais].sort((a, b) => a.localeCompare(b, 'pt-BR')), [profissionais]);
    const sortedEspecialidades = useMemo(() => [...especialidades].sort((a, b) => a.localeCompare(b, 'pt-BR')), [especialidades]);

    const performCloudSync = useCallback(async (currentPatients: Patient[], isManualTrigger: boolean) => {
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
                console.warn('Cloud endpoint not configured. Automatic sync skipped.');
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
                console.warn('Cloud password not configured. Automatic sync skipped.');
                return;
            }
        }
    
        try {
            setSyncStatus({ msg: 'Sincronizando com a nuvem...', isOk: true });
            const payload: BackupData = { pacientes: currentPatients, convenios, profissionais, especialidades, ts: new Date().toISOString() };
            const encrypted = await encryptJSON(payload, pass);
    
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(encrypted)
            });
    
            if (!res.ok) throw new Error(`Erro do servidor ${res.status}: ${res.statusText}. Verifique a URL do endpoint e as permissões do script.`);
    
            const result = await res.json();
            if (result.status === 'error') throw new Error(result.message);

            const statusMsg = `Backup salvo no Google Drive. ${result?.name ? `Arquivo: ${result.name}` : ''}`;
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
        if (!window.confirm('Isso substituirá TODOS os dados locais pelo backup do Google Drive. Deseja continuar?')) {
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
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Erro do servidor ${res.status}: ${res.statusText}.`);
            
            const pkg = await res.json();
            
            if (pkg.status === 'not_found') {
                 throw new Error('Nenhum arquivo de backup encontrado no Google Drive.');
            }
            if (pkg.status === 'error') {
                throw new Error(pkg.message);
            }

            setSyncStatus({ msg: 'Backup encontrado. Descriptografando...', isOk: true });
            const data = await decryptJSON(pkg as EncryptedPackage, pass);

            setPatients(data.pacientes || []);
            setConvenios(data.convenios || DEFAULT_CONVENIOS);
            setProfissionais(data.profissionais || DEFAULT_PROFISSIONAIS);
            setEspecialidades(data.especialidades || DEFAULT_ESPECIALIDADES);
            
            const successMsg = `Dados sincronizados com sucesso do Google Drive. Total de ${data.pacientes.length} pacientes carregados.`;
            setSyncStatus({ msg: successMsg, isOk: true });
            alert(successMsg);

        } catch (err) {
            const errorMsg = `Erro ao restaurar da nuvem: ${err instanceof Error ? err.message : String(err)}`;
            setSyncStatus({ msg: errorMsg, isOk: false });
            alert(errorMsg);
        }
    }, [cloudEndpoint, cloudPass, setCloudEndpoint, setPatients, setConvenios, setProfissionais, setEspecialidades]);


    const handleSavePatient = (patient: Patient) => {
        let updatedPatients;
        if (patient.id) {
            updatedPatients = patients.map(p => p.id === patient.id ? patient : p);
        } else {
            updatedPatients = [...patients, { ...patient, id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}` }];
        }
        setPatients(updatedPatients);
        setEditingPatient(null);

        // Automatically trigger cloud backup in the background
        performCloudSync(updatedPatients, false).catch(error => {
            console.error("Falha no backup automático em segundo plano:", error);
        });
    };

    const handleEditPatient = (patient: Patient) => {
        setEditingPatient(patient);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeletePatient = (id: string) => {
        if (window.confirm('Excluir este paciente?')) {
            const updatedPatients = patients.filter(p => p.id !== id);
            setPatients(updatedPatients);
            performCloudSync(updatedPatients, false).catch(error => {
                console.error("Falha no backup automático em segundo plano após exclusão:", error);
            });
        }
    };

    const handleClearForm = () => {
        setEditingPatient(null);
    };

    const handleAddNewItem = (list: string[], setList: (list: string[]) => void, item: string) => {
        const trimmed = item.trim();
        if (trimmed && !list.some(i => i.toLowerCase() === trimmed.toLowerCase())) {
            setList([...list, trimmed]);
        }
    };
    
    const filteredPatients = useMemo(() => {
        return patients
            .filter(p => {
                const search = searchTerm.toLowerCase();
                const blob = [p.nome, p.responsavel, p.contato, p.crm, p.origem, p.carteirinha, p.tipoAtendimento].filter(Boolean).join(' ').toLowerCase();
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
        let pass = cloudPass;
        if (!pass) {
            pass = prompt('Defina a senha do backup criptografado (será salva neste navegador)');
            if (!pass) return;
            setCloudPass(pass);
        }
        try {
            const payload: BackupData = { pacientes: patients, convenios, profissionais, especialidades, ts: new Date().toISOString() };
            const pkg = await encryptJSON(payload, pass);
            downloadFile('backup_personart.enc.json', JSON.stringify(pkg), 'application/json');
        } catch (err) {
            alert(`Falha ao criptografar: ${err instanceof Error ? err.message : String(err)}`);
        }
    };
    
    const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await readTextFromFile(file);
            let data: BackupData | {pacientes: Patient[]};
            try {
                const pkg = JSON.parse(text);
                if (pkg && pkg.format === 'personart-aesgcm-v1') {
                    let pass = cloudPass || prompt('Arquivo criptografado. Digite a senha:');
                    if (!pass) throw new Error('Senha não informada');
                    data = await decryptJSON(pkg as EncryptedPackage, pass);
                } else {
                    data = pkg;
                }
            } catch {
                data = JSON.parse(text);
            }

            if ('pacientes' in data && Array.isArray(data.pacientes)) {
                setPatients(data.pacientes);
                if ('convenios' in data && Array.isArray(data.convenios)) setConvenios(data.convenios);
                if ('profissionais' in data && Array.isArray(data.profissionais)) setProfissionais(data.profissionais);
                if ('especialidades' in data && Array.isArray(data.especialidades)) setEspecialidades(data.especialidades);
                alert('Backup importado com sucesso.');
            } else if (Array.isArray(data)) {
                 setPatients(data as Patient[]);
                 alert('Backup (legado) importado com sucesso.');
            } else {
                throw new Error('Formato de backup inválido');
            }
        } catch (err) {
            alert(`Falha ao importar: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            e.target.value = ''; // Reset file input
        }
    };
    
    const handleSyncClick = () => {
        performCloudSync(patients, true);
    };

    return (
        <div className="min-h-screen">
            <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex items-center gap-4">
                    {brand.logo && <img src={brand.logo} alt="Logo da clínica" className="h-12 w-12 rounded-lg bg-slate-900 p-1 border border-slate-700" />}
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: brand.color }}>{brand.name}</h1>
                        <p className="text-sm text-slate-400">Registre pacientes, convênios e profissionais. Os dados ficam no seu navegador.</p>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
                <PatientForm
                    editingPatient={editingPatient}
                    onSave={handleSavePatient}
                    onClear={handleClearForm}
                    convenios={sortedConvenios}
                    profissionais={sortedProfissionais}
                    especialidades={sortedEspecialidades}
                    onAddConvenio={(c) => handleAddNewItem(convenios, setConvenios, c)}
                    onAddProfissional={(p) => handleAddNewItem(profissionais, setProfissionais, p)}
                    onAddEspecialidade={(e) => handleAddNewItem(especialidades, setEspecialidades, e)}
                />

                <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-2xl backdrop-blur-sm space-y-4">
                    <h2 className="text-xl font-bold text-slate-100">Pacientes</h2>
                    {/* Toolbar */}
                    <div className="space-y-3">
                      <input type="text" placeholder="Buscar por nome, responsável, contato..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition" />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <select value={filters.convenio} onChange={e => setFilters(f => ({ ...f, convenio: e.target.value }))} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition">
                          <option value="">Todos convênios</option>
                          {sortedConvenios.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={filters.profissional} onChange={e => setFilters(f => ({ ...f, profissional: e.target.value }))} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition">
                          <option value="">Todos profissionais</option>
                          {sortedProfissionais.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <select value={filters.faixa} onChange={e => setFilters(f => ({ ...f, faixa: e.target.value }))} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition">
                          <option value="">Todas faixas</option>
                          <option value="Criança">Criança</option>
                          <option value="Adulto">Adulto</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <button onClick={() => setIsListVisible(true)} className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold px-3 py-1.5 rounded-md text-xs transition">Ver todos</button>
                        <div className="flex-grow"></div>
                        <button onClick={handleExport} className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold px-3 py-1.5 rounded-md text-xs transition flex items-center gap-1"><DownloadIcon className="w-3.5 h-3.5" />Exportar CSV</button>
                        <button onClick={handleEncryptedBackup} className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold px-3 py-1.5 rounded-md text-xs transition flex items-center gap-1"><DownloadIcon className="w-3.5 h-3.5" />Backup Local</button>
                        <label className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold px-3 py-1.5 rounded-md text-xs transition flex items-center gap-1 cursor-pointer"><UploadIcon className="w-3.5 h-3.5" />Importar<input ref={importFileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportBackup} /></label>
                        <button onClick={handleCloudRestore} className="bg-teal-600 hover:bg-teal-500 text-white font-semibold px-3 py-1.5 rounded-md text-xs transition flex items-center gap-1"><CloudDownloadIcon className="w-3.5 h-3.5" />Sincronizar da Nuvem</button>
                        <button onClick={handleSyncClick} className="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-3 py-1.5 rounded-md text-xs transition flex items-center gap-1"><CloudIcon className="w-3.5 h-3.5" />Salvar no Google Drive</button>
                        <button onClick={() => { if(window.confirm('APAGAR TODOS OS DADOS?')) { setPatients([]); performCloudSync([], true).catch(e => console.error(e)); } }} className="bg-red-800/80 hover:bg-red-700/80 text-red-200 font-semibold px-3 py-1.5 rounded-md text-xs transition flex items-center gap-1"><TrashIcon className="w-3.5 h-3.5" />Zerar Dados</button>
                      </div>
                      {syncStatus && <p className={`text-xs mt-2 ${syncStatus.isOk ? 'text-green-400' : 'text-red-400'}`}>{syncStatus.msg}</p>}
                    </div>

                    {showTable ? (
                        <>
                            <PatientTable patients={filteredPatients} onEdit={handleEditPatient} onDelete={handleDeletePatient} />
                            <p className="text-sm text-slate-400 text-right">{filteredPatients.length} paciente(s) encontrado(s)</p>
                        </>
                    ) : (
                        <div className="text-center py-10 text-slate-500">
                            A lista está oculta. Use a busca, filtros ou "Ver todos".
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default App;
