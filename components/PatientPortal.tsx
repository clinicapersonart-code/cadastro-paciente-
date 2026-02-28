import React, { useState } from 'react';
import { Patient, UserProfile, MedicalRecordChunk, SessionRecord, PatientDocument, DocumentFolder } from '../types';
import { UserIcon, FileTextIcon, CalendarIcon, ClipboardIcon, FolderIcon, ChartBarIcon, CheckIcon, XIcon, PlusIcon, SaveIcon, MicIcon, SparklesIcon, ChevronDownIcon, ChevronUpIcon, TrashIcon, EditIcon } from './icons';

// Sub-componentes para cada aba
import { MedicalRecord } from './MedicalRecord';
import { StructuredAnamnese } from './StructuredAnamnese';

interface PatientPortalProps {
    patient: Patient;
    currentUser: UserProfile;
    existingRecords: MedicalRecordChunk[];
    onSaveRecord: (patientId: string, record: MedicalRecordChunk) => void;
    onUpdateRecord: (patientId: string, record: MedicalRecordChunk) => void;
    onDeleteRecord: (patientId: string, recordId: string) => void;
    onUpdatePatient: (patient: Patient) => void;
    onToggleActive?: (id: string, active: boolean) => void;
    onDelete?: (id: string) => void;
    onBack: () => void;
    // Documentos e Pastas
    documents: PatientDocument[];
    folders: DocumentFolder[];
    onSaveDocument: (patientId: string, doc: PatientDocument) => void;
    onDeleteDocument: (patientId: string, docId: string) => void;
    onSaveFolder: (patientId: string, folder: DocumentFolder) => void;
    onDeleteFolder: (patientId: string, folderId: string) => void;
}

type PortalTab = 'cadastro' | 'prontuario' | 'sessoes' | 'anamnese' | 'resumo' | 'documentos';

export const PatientPortal: React.FC<PatientPortalProps> = ({
    patient,
    currentUser,
    existingRecords,
    onSaveRecord,
    onUpdateRecord,
    onDeleteRecord,
    onUpdatePatient,
    onToggleActive,
    onDelete,
    onBack,
    documents: propDocuments,
    folders: propFolders,
    onSaveDocument,
    onDeleteDocument,
    onSaveFolder,
    onDeleteFolder
}) => {
    const [activeTab, setActiveTab] = useState<PortalTab>('prontuario');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Helper para data local (evita bug de fuso horário com toISOString)
    const getLocalDateString = (d: Date = new Date()) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Estado para Sessões (presença)
    const [sessionAttendance, setSessionAttendance] = useState<'Compareceu' | 'Faltou' | 'Cancelado' | 'Justificado'>('Compareceu');
    const [sessionDate, setSessionDate] = useState(getLocalDateString());
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

    // Estado para Anamnese

    // Estado para Documentos (derivado das props)
    const [documents, setDocuments] = useState<PatientDocument[]>(propDocuments);
    const [folders, setFolders] = useState<DocumentFolder[]>(propFolders);

    // Sincronizar com props quando mudam
    React.useEffect(() => { setDocuments(propDocuments); }, [propDocuments]);
    React.useEffect(() => { setFolders(propFolders); }, [propFolders]);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [showAddDocModal, setShowAddDocModal] = useState(false);
    const [showAddFolderModal, setShowAddFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [newDocForm, setNewDocForm] = useState({
        title: '',
        type: 'Outro' as PatientDocument['type'],
        content: ''
    });

    // Calcular idade
    const calculateAge = (birthDate?: string) => {
        if (!birthDate) return 'N/I';
        const birth = new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    };

    // Estatísticas para Resumo
    const stats = {
        totalSessoes: existingRecords.length,
        compareceu: existingRecords.filter(r => (r as SessionRecord).attendance === 'Compareceu').length,
        faltou: existingRecords.filter(r => (r as SessionRecord).attendance === 'Faltou').length,
        ultimaSessao: existingRecords.length > 0
            ? new Date(Math.max(...existingRecords.map(r => new Date(r.date + 'T12:00:00').getTime()))).toLocaleDateString('pt-BR')
            : 'Nenhuma'
    };

    // Salvar presença
    const handleSaveSession = () => {
        if (editingRecordId) {
            // Atualizando registro existente
            const existing = existingRecords.find(r => r.id === editingRecordId);
            if (existing) {
                const updatedRecord: MedicalRecordChunk = {
                    ...existing,
                    date: sessionDate,
                    attendance: sessionAttendance,
                    content: `Presença registrada: ${sessionAttendance}`
                };
                onUpdateRecord(patient.id, updatedRecord);
            }
            setEditingRecordId(null);
        } else {
            // Novo registro
            const sessionRecord: SessionRecord = {
                id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                date: sessionDate,
                timestamp: Date.now(),
                professionalName: currentUser.name,
                professionalId: currentUser.id,
                type: 'Evolução',
                content: `Presença registrada: ${sessionAttendance}`,
                attendance: sessionAttendance
            };
            onSaveRecord(patient.id, sessionRecord);
        }
        // Reset form
        setSessionDate(getLocalDateString());
        setSessionAttendance('Compareceu');
    };

    // Editar registro de presença
    const handleEditAttendance = (record: MedicalRecordChunk) => {
        setSessionDate(record.date);
        setSessionAttendance((record as SessionRecord).attendance || 'Compareceu');
        setEditingRecordId(record.id);
    };

    // Deletar registro de presença
    const handleDeleteAttendance = (recordId: string) => {
        if (!confirm('Tem certeza que deseja excluir este registro de presença?')) return;
        onDeleteRecord(patient.id, recordId);
    };

    // === FUNÇÕES DE DOCUMENTOS ===

    // Criar nova pasta
    const handleCreateFolder = () => {
        if (!newFolderName.trim()) return;

        const folder: DocumentFolder = {
            id: `folder-${Date.now()}`,
            name: newFolderName.trim(),
            createdAt: new Date().toISOString()
        };

        setFolders(prev => [...prev, folder]);
        onSaveFolder(patient.id, folder);
        setNewFolderName('');
        setShowAddFolderModal(false);
    };

    // Criar novo documento
    const handleCreateDocument = () => {
        if (!newDocForm.title.trim()) return;

        const doc: PatientDocument = {
            id: `doc-${Date.now()}`,
            title: newDocForm.title.trim(),
            type: newDocForm.type,
            content: newDocForm.content,
            date: new Date().toISOString(),
            professionalName: currentUser.name,
            professionalId: currentUser.id,
            folderId: currentFolderId || undefined
        };

        setDocuments(prev => [...prev, doc]);
        onSaveDocument(patient.id, doc);
        setNewDocForm({ title: '', type: 'Outro', content: '' });
        setShowAddDocModal(false);
    };

    // Deletar pasta (move documentos para raiz)
    const handleDeleteFolder = (folderId: string) => {
        if (!confirm('Excluir pasta? Os documentos serão movidos para a raiz.')) return;
        // Move documentos da pasta para raiz
        const docsToUpdate = documents.filter(d => d.folderId === folderId);
        docsToUpdate.forEach(d => {
            const updated = { ...d, folderId: undefined };
            onSaveDocument(patient.id, updated);
        });
        setDocuments(prev => prev.map(d => d.folderId === folderId ? { ...d, folderId: undefined } : d));
        setFolders(prev => prev.filter(f => f.id !== folderId));
        onDeleteFolder(patient.id, folderId);
        if (currentFolderId === folderId) setCurrentFolderId(null);
    };

    // Deletar documento
    const handleDeleteDocument = (docId: string) => {
        if (!confirm('Excluir documento?')) return;
        setDocuments(prev => prev.filter(d => d.id !== docId));
        onDeleteDocument(patient.id, docId);
    };

    // Documentos e pastas filtrados pela pasta atual
    const currentFolderDocs = documents.filter(d => (d.folderId || null) === currentFolderId);
    const currentFolder = folders.find(f => f.id === currentFolderId);

    const menuItems: { id: PortalTab; label: string; icon: React.ReactNode; color: string }[] = [
        { id: 'cadastro', label: 'Cadastro', icon: <UserIcon className="w-5 h-5" />, color: 'text-blue-400' },
        { id: 'prontuario', label: 'Prontuário', icon: <FileTextIcon className="w-5 h-5" />, color: 'text-green-400' },
        { id: 'sessoes', label: 'Sessões', icon: <CalendarIcon className="w-5 h-5" />, color: 'text-purple-400' },
        { id: 'anamnese', label: 'Anamnese', icon: <ClipboardIcon className="w-5 h-5" />, color: 'text-amber-400' },
        { id: 'resumo', label: 'Resumo', icon: <ChartBarIcon className="w-5 h-5" />, color: 'text-cyan-400' },
        { id: 'documentos', label: 'Documentos', icon: <FolderIcon className="w-5 h-5" />, color: 'text-rose-400' },
    ];

    return (
        <div className="min-h-[80vh] bg-slate-900/50 rounded-2xl border border-slate-700 overflow-hidden flex">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-800/80 border-r border-slate-700 p-4 flex flex-col">
                {/* Cabeçalho do Paciente */}
                <div className="mb-6 pb-4 border-b border-slate-700">
                    <button
                        onClick={onBack}
                        className="text-slate-400 hover:text-white text-sm mb-3 flex items-center gap-1 transition"
                    >
                        ← Voltar
                    </button>
                    <h2 className="text-lg font-bold text-white truncate">
                        {patient.nome}
                        {patient.active === false && (
                            <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-bold align-middle">INATIVO</span>
                        )}
                    </h2>
                    <p className="text-sm text-slate-400">
                        {calculateAge(patient.nascimento)} anos • {patient.faixa || 'N/I'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        {patient.convenio || 'Particular'}
                    </p>
                    {onToggleActive && (
                        <button
                            onClick={() => onToggleActive(patient.id, patient.active === false ? true : false)}
                            className={`mt-3 w-full py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all ${patient.active === false
                                ? 'bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
                                }`}
                        >
                            {patient.active === false ? '✅ Reativar Paciente' : '⏸️ Desativar Paciente'}
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="mt-2 w-full py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                        >
                            🗑️ Apagar Paciente
                        </button>
                    )}
                </div>

                {/* Menu de Navegação */}
                <nav className="flex-1 space-y-1">
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === item.id
                                ? 'bg-slate-700 text-white shadow-lg'
                                : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                                }`}
                        >
                            <span className={activeTab === item.id ? item.color : ''}>{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                </nav>

                {/* Rodapé - Info do Profissional */}
                <div className="mt-auto pt-4 border-t border-slate-700 text-xs text-slate-500">
                    <p>Profissional: <span className="text-slate-300">{currentUser.name}</span></p>
                </div>
            </aside>

            {/* Área de Conteúdo Principal */}
            <main className="flex-1 p-6 overflow-y-auto">
                {/* === ABA CADASTRO === */}
                {activeTab === 'cadastro' && (
                    <div className="space-y-6">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <UserIcon className="w-5 h-5 text-blue-400" />
                            Dados Cadastrais
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InfoCard label="Nome Completo" value={patient.nome} />
                            <InfoCard label="Data de Nascimento" value={patient.nascimento ? new Date(patient.nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/I'} />
                            <InfoCard label="Faixa Etária" value={patient.faixa || 'N/I'} />
                            <InfoCard label="Responsável" value={patient.responsavel || 'N/A'} />
                            <InfoCard label="Contato" value={patient.contato || 'N/I'} />
                            <InfoCard label="E-mail" value={patient.email || 'N/I'} />
                            <InfoCard label="Endereço" value={patient.endereco || 'N/I'} />
                            <InfoCard label="Convênio" value={patient.convenio || 'Particular'} />
                            <InfoCard label="Carteirinha" value={patient.carteirinha || 'N/A'} />
                            <InfoCard label="Profissionais" value={patient.profissionais?.join(', ') || 'Nenhum'} />
                        </div>
                    </div>
                )}

                {/* === ABA PRONTUÁRIO === */}
                {activeTab === 'prontuario' && (
                    <MedicalRecord
                        patient={patient}
                        currentUser={currentUser}
                        existingRecords={existingRecords}
                        onSaveRecord={onSaveRecord}
                        onUpdateRecord={onUpdateRecord}
                        onDeleteRecord={onDeleteRecord}
                    />
                )}

                {/* === ABA SESSÕES (Controle de Presença) === */}
                {activeTab === 'sessoes' && (
                    <div className="space-y-6">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-purple-400" />
                            Controle de Presença
                        </h3>

                        {/* Registrar Presença */}
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
                            <label className="text-sm text-slate-400 block font-medium">Data da Sessão</label>
                            <input
                                type="date"
                                value={sessionDate}
                                onChange={e => setSessionDate(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                            />

                            <label className="text-sm text-slate-400 block font-medium">Status</label>
                            <div className="flex gap-2 flex-wrap">
                                {(['Compareceu', 'Faltou', 'Cancelado', 'Justificado'] as const).map(status => (
                                    <button
                                        key={status}
                                        onClick={() => setSessionAttendance(status)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${sessionAttendance === status
                                            ? status === 'Compareceu' ? 'bg-green-600 text-white' :
                                                status === 'Faltou' ? 'bg-red-600 text-white' :
                                                    status === 'Cancelado' ? 'bg-orange-600 text-white' :
                                                        'bg-yellow-600 text-white'
                                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                            }`}
                                    >
                                        {status === 'Compareceu' && '✅ '}
                                        {status === 'Faltou' && '❌ '}
                                        {status === 'Cancelado' && '🚫 '}
                                        {status === 'Justificado' && '📋 '}
                                        {status}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={handleSaveSession}
                                className={`w-full py-3 ${editingRecordId ? 'bg-amber-600 hover:bg-amber-500' : 'bg-purple-600 hover:bg-purple-500'} text-white font-bold rounded-xl flex items-center justify-center gap-2 transition`}
                            >
                                <SaveIcon className="w-5 h-5" />
                                {editingRecordId ? 'Salvar Alteração' : 'Registrar Presença'}
                            </button>
                            {editingRecordId && (
                                <button
                                    onClick={() => { setEditingRecordId(null); setSessionDate(getLocalDateString()); setSessionAttendance('Compareceu'); }}
                                    className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-xl flex items-center justify-center gap-2 transition mt-2"
                                >
                                    <XIcon className="w-4 h-4" />
                                    Cancelar Edição
                                </button>
                            )}
                        </div>

                        {/* Histórico de Presenças */}
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                            <h4 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">Histórico de Presenças</h4>
                            {existingRecords.filter(r => (r as SessionRecord).attendance).length === 0 ? (
                                <p className="text-slate-500 text-center py-4">Nenhum registro de presença ainda.</p>
                            ) : (
                                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                                    {existingRecords
                                        .filter(r => (r as SessionRecord).attendance)
                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map(record => {
                                            const att = (record as SessionRecord).attendance;
                                            const colorMap: Record<string, string> = {
                                                'Compareceu': 'border-green-500/50 bg-green-500/10',
                                                'Faltou': 'border-red-500/50 bg-red-500/10',
                                                'Cancelado': 'border-orange-500/50 bg-orange-500/10',
                                                'Justificado': 'border-yellow-500/50 bg-yellow-500/10'
                                            };
                                            const emojiMap: Record<string, string> = {
                                                'Compareceu': '✅',
                                                'Faltou': '❌',
                                                'Cancelado': '🚫',
                                                'Justificado': '📋'
                                            };
                                            return (
                                                <div
                                                    key={record.id}
                                                    className={`flex items-center justify-between p-3 rounded-lg border ${colorMap[att || ''] || 'border-slate-700'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-lg">{emojiMap[att || ''] || '📅'}</span>
                                                        <div>
                                                            <p className="text-white text-sm font-medium">
                                                                {new Date(record.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                            </p>
                                                            <p className="text-xs text-slate-500">{record.professionalName}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm font-medium ${att === 'Compareceu' ? 'text-green-400' :
                                                            att === 'Faltou' ? 'text-red-400' :
                                                                att === 'Cancelado' ? 'text-orange-400' :
                                                                    'text-yellow-400'
                                                            }`}>
                                                            {att}
                                                        </span>
                                                        <button
                                                            onClick={() => handleEditAttendance(record)}
                                                            className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-600 text-slate-400 hover:text-amber-400 transition"
                                                            title="Editar"
                                                        >
                                                            <EditIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteAttendance(record.id)}
                                                            className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-red-600/20 text-slate-400 hover:text-red-400 transition"
                                                            title="Excluir"
                                                        >
                                                            <TrashIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* === ABA ANAMNESE === */}
                {activeTab === 'anamnese' && (
                    <div className="space-y-6">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <ClipboardIcon className="w-5 h-5 text-amber-400" />
                            Anamnese
                        </h3>

                        {/* Formulário de Anamnese Estruturada */}
                        <StructuredAnamnese
                            patient={patient}
                            currentUser={currentUser}
                            existingRecords={existingRecords}
                            onSaveRecord={onSaveRecord}
                            onUpdateRecord={onUpdateRecord}
                        />
                    </div>
                )}

                {/* === ABA RESUMO === */}
                {activeTab === 'resumo' && (
                    <div className="space-y-6">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <ChartBarIcon className="w-5 h-5 text-cyan-400" />
                            Resumo do Paciente
                        </h3>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatCard label="Total de Sessões" value={stats.totalSessoes} color="text-white" />
                            <StatCard label="Compareceu" value={stats.compareceu} color="text-green-400" />
                            <StatCard label="Faltou" value={stats.faltou} color="text-red-400" />
                            <StatCard label="Última Sessão" value={stats.ultimaSessao} color="text-slate-300" isText />
                        </div>

                        {/* Lista de Últimas Sessões */}
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                            <h4 className="text-sm font-bold text-slate-400 mb-3">Histórico Recente</h4>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {existingRecords.length === 0 ? (
                                    <p className="text-slate-500 text-sm">Nenhum registro encontrado.</p>
                                ) : (
                                    existingRecords
                                        .sort((a, b) => b.timestamp - a.timestamp)
                                        .slice(0, 10)
                                        .map(record => (
                                            <div key={record.id} className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                                                <div>
                                                    <p className="text-sm text-white">{new Date(record.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                                                    <p className="text-xs text-slate-500 truncate max-w-xs">{record.content.substring(0, 50)}...</p>
                                                </div>
                                                <span className={`text-xs px-2 py-1 rounded ${(record as SessionRecord).attendance === 'Compareceu' ? 'bg-green-900 text-green-300' :
                                                    (record as SessionRecord).attendance === 'Faltou' ? 'bg-red-900 text-red-300' :
                                                        'bg-slate-700 text-slate-400'
                                                    }`}>
                                                    {(record as SessionRecord).attendance || record.type}
                                                </span>
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* === ABA DOCUMENTOS === */}
                {activeTab === 'documentos' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <FolderIcon className="w-5 h-5 text-rose-400" />
                                Documentos
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowAddFolderModal(true)}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                                >
                                    <FolderIcon className="w-4 h-4" />
                                    Nova Pasta
                                </button>
                                <button
                                    onClick={() => setShowAddDocModal(true)}
                                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                    Novo Documento
                                </button>
                            </div>
                        </div>

                        {/* Navegação / Breadcrumb */}
                        {currentFolderId && (
                            <div className="flex items-center gap-2 text-sm">
                                <button
                                    onClick={() => setCurrentFolderId(null)}
                                    className="text-slate-400 hover:text-white transition"
                                >
                                    📁 Raiz
                                </button>
                                <span className="text-slate-600">/</span>
                                <span className="text-rose-400 font-medium">{currentFolder?.name}</span>
                            </div>
                        )}

                        {/* Lista de Pastas (se estiver na raiz) */}
                        {!currentFolderId && folders.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {folders.map(folder => (
                                    <div
                                        key={folder.id}
                                        className="bg-slate-800 rounded-xl border border-slate-700 p-4 hover:border-rose-500/50 transition cursor-pointer group"
                                        onClick={() => setCurrentFolderId(folder.id)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <FolderIcon className="w-8 h-8 text-amber-400" />
                                                <div>
                                                    <p className="text-white font-medium">{folder.name}</p>
                                                    <p className="text-xs text-slate-500">
                                                        {documents.filter(d => d.folderId === folder.id).length} docs
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                                                className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 transition"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Lista de Documentos */}
                        {currentFolderDocs.length > 0 ? (
                            <div className="space-y-2">
                                {currentFolderDocs.map(doc => (
                                    <div
                                        key={doc.id}
                                        className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex items-center justify-between hover:border-slate-600 transition group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <FileTextIcon className="w-8 h-8 text-rose-400" />
                                            <div>
                                                <p className="text-white font-medium">{doc.title}</p>
                                                <p className="text-xs text-slate-500">
                                                    {doc.type} • {new Date(doc.date).toLocaleDateString('pt-BR')} • {doc.professionalName}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteDocument(doc.id)}
                                            className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-300 transition"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            !currentFolderId && folders.length === 0 && (
                                <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
                                    <FolderIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                    <p className="text-slate-400">Nenhum documento cadastrado ainda.</p>
                                    <p className="text-xs text-slate-500 mt-2">Use os botões acima para criar pastas ou adicionar documentos.</p>
                                </div>
                            )
                        )}
                    </div>
                )}

                {/* Modal: Nova Pasta */}
                {showAddFolderModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAddFolderModal(false)}>
                        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <FolderIcon className="w-5 h-5 text-amber-400" />
                                Nova Pasta
                            </h3>
                            <input
                                type="text"
                                value={newFolderName}
                                onChange={e => setNewFolderName(e.target.value)}
                                placeholder="Nome da pasta..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white mb-4"
                                autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setShowAddFolderModal(false)} className="px-4 py-2 bg-slate-700 text-white rounded-lg">
                                    Cancelar
                                </button>
                                <button onClick={handleCreateFolder} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium">
                                    Criar Pasta
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal: Novo Documento */}
                {showAddDocModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAddDocModal(false)}>
                        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <FileTextIcon className="w-5 h-5 text-rose-400" />
                                Novo Documento
                            </h3>
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={newDocForm.title}
                                    onChange={e => setNewDocForm(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Título do documento..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white"
                                    autoFocus
                                />
                                <select
                                    value={newDocForm.type}
                                    onChange={e => setNewDocForm(prev => ({ ...prev, type: e.target.value as PatientDocument['type'] }))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white"
                                >
                                    <option value="Laudo">Laudo</option>
                                    <option value="Atestado">Atestado</option>
                                    <option value="Encaminhamento">Encaminhamento</option>
                                    <option value="Contrato">Contrato</option>
                                    <option value="Outro">Outro</option>
                                </select>
                                <textarea
                                    value={newDocForm.content}
                                    onChange={e => setNewDocForm(prev => ({ ...prev, content: e.target.value }))}
                                    placeholder="Conteúdo do documento (opcional)..."
                                    className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white resize-none"
                                />
                            </div>
                            <div className="flex gap-2 justify-end mt-4">
                                <button onClick={() => setShowAddDocModal(false)} className="px-4 py-2 bg-slate-700 text-white rounded-lg">
                                    Cancelar
                                </button>
                                <button onClick={handleCreateDocument} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium">
                                    Criar Documento
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Modal de Confirmação: Apagar Paciente */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="bg-slate-800 rounded-2xl border border-red-500/30 p-6 w-full max-w-md shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <TrashIcon className="w-8 h-8 text-red-400" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Apagar Paciente?</h3>
                            <p className="text-slate-400 text-sm">
                                Tem certeza que deseja apagar <strong className="text-white">{patient.nome}</strong>?
                            </p>
                            <p className="text-red-400 text-xs mt-2 font-medium">
                                ⚠️ Esta ação é permanente e irá excluir todos os dados, prontuários, agendamentos e documentos deste paciente.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    setShowDeleteConfirm(false);
                                    if (onDelete) {
                                        onDelete(patient.id);
                                        onBack();
                                    }
                                }}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
                            >
                                <TrashIcon className="w-4 h-4" /> Apagar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Componente auxiliar: Card de informação
const InfoCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-white font-medium">{value}</p>
    </div>
);

// Componente auxiliar: Card de estatística
const StatCard: React.FC<{ label: string; value: string | number; color: string; isText?: boolean }> = ({ label, value, color, isText }) => (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
);
