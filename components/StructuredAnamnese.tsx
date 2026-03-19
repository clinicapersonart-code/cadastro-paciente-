import React, { useState } from 'react';
import { Patient, UserProfile, MedicalRecordChunk } from '../types';
import { ClipboardIcon, SaveIcon, XIcon, PlusIcon, ChevronDownIcon, ChevronUpIcon, TrashIcon } from './icons';
import { ANAMNESE_TEMPLATES, AnamneseTemplate } from '../constants/anamneseTemplates';

interface StructuredAnamneseProps {
    patient: Patient;
    currentUser: UserProfile;
    existingRecords: MedicalRecordChunk[];
    onSaveRecord: (patientId: string, record: MedicalRecordChunk) => void;
    onUpdateRecord: (patientId: string, record: MedicalRecordChunk) => void;
    onDeleteRecord?: (patientId: string, recordId: string) => void;
}

export const StructuredAnamnese: React.FC<StructuredAnamneseProps> = ({
    patient,
    currentUser,
    existingRecords,
    onSaveRecord,
    onUpdateRecord,
    onDeleteRecord
}) => {
    const [selectedTemplate, setSelectedTemplate] = useState<AnamneseTemplate | null>(null);
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [editingAnamneseId, setEditingAnamneseId] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const canDelete = (record: MedicalRecordChunk) => {
        if (!onDeleteRecord) return false;
        // Regra: apenas responsável técnico (admin) ou o profissional que criou o registro
        if (currentUser.role === 'admin') return true;
        return record.professionalId === currentUser.id;
    };

    // Filtrar apenas registros do tipo Anamnese que possuem structuredData
    const structuredAnamneses = existingRecords.filter(r =>
        r.type === 'Anamnese' && (r as any).structuredData
    );

    const handleSelectTemplate = (template: AnamneseTemplate) => {
        setSelectedTemplate(template);
        const initialData: Record<string, string> = {};
        template.topics.forEach(topic => {
            initialData[topic.id] = '';
        });
        setFormData(initialData);
        setEditingAnamneseId(null);
    };

    const handleInputChange = (topicId: string, value: string) => {
        setFormData(prev => ({ ...prev, [topicId]: value }));
    };

    const handleSave = () => {
        if (!selectedTemplate) return;

        setIsSaving(true);
        const recordDate = new Date().toISOString().split('T')[0];

        // Criar um resumo para o 'content' baseado nos primeiros tópicos
        const summary = Object.entries(formData)
            .filter(([_, val]) => val.trim())
            .slice(0, 2)
            .map(([topicId, val]) => {
                const topic = selectedTemplate.topics.find(t => t.id === topicId);
                return `${topic?.title}: ${val.substring(0, 100)}${val.length > 100 ? '...' : ''}`;
            })
            .join('\n');

        const record: MedicalRecordChunk = {
            id: editingAnamneseId || `anamnese-${Date.now()}`,
            date: recordDate,
            timestamp: Date.now(),
            professionalName: currentUser.name,
            professionalId: currentUser.id,
            type: 'Anamnese',
            content: summary || `Anamnese estruturada: ${selectedTemplate.name}`,
            // Adicionando dados estruturados no objeto record
            // Como MedicalRecordChunk não tem structuredData no tipo oficial, usamos cast
            ...({
                structuredData: {
                    templateId: selectedTemplate.id,
                    answers: formData
                }
            } as any)
        };

        if (editingAnamneseId) {
            onUpdateRecord(patient.id, record);
        } else {
            onSaveRecord(patient.id, record);
        }

        setIsSaving(false);
        setSelectedTemplate(null);
        setFormData({});
        setEditingAnamneseId(null);
    };

    const handleEdit = (record: MedicalRecordChunk) => {
        const data = (record as any).structuredData;
        if (!data) return;

        const template = ANAMNESE_TEMPLATES.find(t => t.id === data.templateId);
        if (template) {
            setSelectedTemplate(template);
            setFormData(data.answers);
            setEditingAnamneseId(record.id);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleCancel = () => {
        setSelectedTemplate(null);
        setFormData({});
        setEditingAnamneseId(null);
    };

    return (
        <div className="space-y-6">
            {!selectedTemplate ? (
                <>
                    {/* Seleção de Modelos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {ANAMNESE_TEMPLATES.map(template => (
                            <div
                                key={template.id}
                                className="bg-slate-800 rounded-2xl border border-slate-700 p-6 hover:border-amber-500/50 transition cursor-pointer group"
                                onClick={() => handleSelectTemplate(template)}
                            >
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 group-hover:scale-110 transition">
                                        <ClipboardIcon className="w-6 h-6" />
                                    </div>
                                    <h4 className="text-lg font-bold text-white">{template.name}</h4>
                                </div>
                                <p className="text-sm text-slate-400 mb-4">{template.description}</p>
                                <button className="w-full py-2 bg-slate-700 hover:bg-amber-600 text-white font-medium rounded-xl transition">
                                    Selecionar Modelo
                                </button>
                            </div>
                        ))}

                        {/* Placeholder para novos modelos */}
                        <div className="bg-slate-800/50 rounded-2xl border border-dashed border-slate-700 p-6 flex flex-col items-center justify-center text-slate-500 italic">
                            <PlusIcon className="w-8 h-8 mb-2 opacity-25" />
                            <p>Novos modelos em breve...</p>
                        </div>
                    </div>

                    {/* Histórico de Anamneses Estruturadas */}
                    {structuredAnamneses.length > 0 && (
                        <div className="mt-8 border-t border-slate-700 pt-6">
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className="flex items-center justify-between w-full text-slate-400 hover:text-white transition"
                            >
                                <h4 className="text-sm font-bold uppercase tracking-wider">Histórico de Anamneses ({structuredAnamneses.length})</h4>
                                {showHistory ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                            </button>

                            {showHistory && (
                                <div className="mt-4 space-y-3">
                                    {structuredAnamneses.sort((a, b) => b.timestamp - a.timestamp).map(record => (
                                        <div key={record.id} className="bg-slate-800 border border-slate-700 p-4 rounded-xl flex items-center justify-between group">
                                            <div>
                                                <p className="text-white font-medium">
                                                    {ANAMNESE_TEMPLATES.find(t => t.id === (record as any).structuredData.templateId)?.name || 'Anamnese'}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {new Date(record.date + 'T12:00:00').toLocaleDateString('pt-BR')} • {record.professionalName}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(record)}
                                                    className="px-3 py-1.5 bg-slate-700 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition"
                                                >
                                                    Ver / Editar
                                                </button>
                                                {canDelete(record) && (
                                                    <button
                                                        onClick={() => setConfirmDeleteId(record.id)}
                                                        className="p-2 rounded-lg bg-slate-700/50 hover:bg-red-600/20 text-slate-400 hover:text-red-400 transition"
                                                        title="Excluir"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : (
                /* Formulário do Modelo Selecionado */
                <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden animate-fade-in">
                    <div className="p-6 border-b border-slate-700 flex items-center justify-between bg-slate-900/50">
                        <div>
                            <h3 className="text-lg font-bold text-white">{selectedTemplate.name}</h3>
                            <p className="text-xs text-slate-400">Preencha os tópicos abaixo para concluir a anamnese.</p>
                        </div>
                        <button
                            onClick={handleCancel}
                            className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-full transition"
                        >
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-8 max-h-[60vh] overflow-y-auto">
                        {selectedTemplate.topics.map((topic, index) => (
                            <div key={topic.id} className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center text-xs font-bold">
                                        {index + 1}
                                    </span>
                                    <h4 className="font-bold text-slate-200">{topic.title}</h4>
                                </div>
                                <p className="text-xs text-slate-500 pl-11">{topic.description}</p>
                                <div className="pl-11">
                                    <textarea
                                        value={formData[topic.id] || ''}
                                        onChange={(e) => handleInputChange(topic.id, e.target.value)}
                                        placeholder="Digite a resposta aqui..."
                                        className="w-full h-32 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/30 transition resize-none shadow-inner"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 border-t border-slate-700 bg-slate-900/30 flex gap-3">
                        <button
                            onClick={handleCancel}
                            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-[2] py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-900/20 transition flex items-center justify-center gap-2"
                        >
                            {isSaving ? 'Salvando...' : (
                                <>
                                    <SaveIcon className="w-5 h-5" />
                                    {editingAnamneseId ? 'Atualizar Anamnese' : 'Finalizar e Salvar'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação: Excluir Anamnese */}
            {confirmDeleteId && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setConfirmDeleteId(null)}>
                    <div className="bg-slate-800 rounded-2xl border border-red-500/30 p-6 w-full max-w-md shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <TrashIcon className="w-8 h-8 text-red-400" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Excluir anamnese?</h3>
                            <p className="text-slate-400 text-sm">Essa ação remove o registro do prontuário do paciente.</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    if (onDeleteRecord) onDeleteRecord(patient.id, confirmDeleteId);
                                    setConfirmDeleteId(null);
                                    // Se estava editando esse registro, sair do modo edição
                                    if (editingAnamneseId === confirmDeleteId) {
                                        setSelectedTemplate(null);
                                        setFormData({});
                                        setEditingAnamneseId(null);
                                    }
                                }}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
                            >
                                <TrashIcon className="w-4 h-4" /> Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
