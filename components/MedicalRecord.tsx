import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Patient, MedicalRecordChunk, UserProfile } from '../types';
import { FileTextIcon, ShieldIcon, SaveIcon, PlusIcon, ChevronDownIcon, ChevronUpIcon, TrashIcon, EditIcon } from './icons';

interface MedicalRecordProps {
    patient: Patient;
    currentUser: UserProfile;
    onSaveRecord: (patientId: string, record: MedicalRecordChunk) => void;
    onUpdateRecord: (patientId: string, record: MedicalRecordChunk) => void;
    onDeleteRecord: (patientId: string, recordId: string) => void;
    existingRecords?: MedicalRecordChunk[];
}

export const MedicalRecord: React.FC<MedicalRecordProps> = ({
    patient,
    currentUser,
    onSaveRecord,
    onUpdateRecord,
    onDeleteRecord,
    existingRecords = []
}) => {
    // Filtrar apenas registros de prontuário (excluir registros de presença/sessão)
    const prontuarioRecords = existingRecords.filter(r => !(r as any).attendance);
    // State for the record
    const [formattedRecord, setFormattedRecord] = useState({
        type: 'Evolução' as 'Anamnese' | 'Evolução' | 'Encerramento',
        content: '',
        behavior: '',
        intervention: '',
        nextSteps: ''
    });

    // Selected date for the record (default: today)
    const getLocalDateString = (d: Date = new Date()) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const [selectedDate, setSelectedDate] = useState(getLocalDateString());

    // Record frequency
    const [frequency, setFrequency] = useState<'Semanal' | 'Mensal'>('Semanal');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-11
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // History expanded
    const [showHistory, setShowHistory] = useState(false);

    // Editing existing record
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

    // Record selection for download
    const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());

    // Selection functions
    const toggleRecordSelection = (recordId: string) => {
        setSelectedRecords(prev => {
            const newSet = new Set(prev);
            if (newSet.has(recordId)) {
                newSet.delete(recordId);
            } else {
                newSet.add(recordId);
            }
            return newSet;
        });
    };

    const selectAllRecords = () => {
        setSelectedRecords(new Set(prontuarioRecords.map(r => r.id)));
    };

    const deselectAllRecords = () => {
        setSelectedRecords(new Set());
    };

    // Format record to text
    const formatRecordToText = (record: MedicalRecordChunk): string => {
        return `
═══════════════════════════════════════════════════════════════
PRONTUÁRIO PSICOLÓGICO - ${record.type.toUpperCase()}
═══════════════════════════════════════════════════════════════
Paciente: ${patient.nome}
Data: ${new Date(record.date + 'T12:00:00').toLocaleDateString('pt-BR')}
Profissional: ${record.professionalName}

REGISTRO DA SESSÃO:
${record.content}

COMPORTAMENTO/HUMOR:
${record.behavior || 'Não registrado'}

INTERVENÇÃO/TÉCNICA:
${record.intervention || 'Não registrado'}

PRÓXIMOS PASSOS:
${record.nextSteps || 'Não registrado'}
═══════════════════════════════════════════════════════════════
`;
    };

    // Download as TXT
    const downloadAsTxt = (records: MedicalRecordChunk[]) => {
        const content = records.map(formatRecordToText).join('\n\n');
        const header = `
╔═══════════════════════════════════════════════════════════════╗
║           CLÍNICA PERSONART - PRONTUÁRIO ELETRÔNICO           ║
║                    Padrão CFP - Res. 001/2009                 ║
╠═══════════════════════════════════════════════════════════════╣
║ Paciente: ${patient.nome.padEnd(51)}║
║ Convênio: ${(patient.convenio || 'Particular').padEnd(51)}║
║ Data de Exportação: ${new Date().toLocaleString('pt-BR').padEnd(41)}║
╚═══════════════════════════════════════════════════════════════╝
`;
        const blob = new Blob([header + content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prontuario_${patient.nome.replace(/\s+/g, '_')}_${getLocalDateString()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Download as PDF
    const downloadAsPdf = (records: MedicalRecordChunk[]) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Por favor, permita pop-ups para gerar o PDF.');
            return;
        }

        const content = records.map(record => `
            <div style="page-break-after: always; padding: 40px; font-family: 'Times New Roman', serif; max-width: 800px; margin: 0 auto;">
                <div style="border-bottom: 2px solid #e9c49e; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
                    <div>
                        <h2 style="color: #273e44; margin: 0; font-size: 24px; text-transform: uppercase;">Prontuário de Atendimento</h2>
                        <span style="color: #e9c49e; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;">${record.type}</span>
                    </div>
                    <div style="text-align: right; color: #666;">
                        <div>Data: <strong>${new Date(record.date + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></div>
                    </div>
                </div>

                <div style="background-color: #f8f9fa; padding: 20px; border-left: 4px solid #e9c49e; margin-bottom: 30px;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 5px 0;"><strong>Paciente:</strong> ${patient.nome}</td>
                            <td style="padding: 5px 0; text-align: right;"><strong>Nascimento:</strong> ${patient.nascimento ? new Date(patient.nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0;"><strong>Profissional:</strong> ${record.professionalName}</td>
                            <td style="padding: 5px 0; text-align: right;"><strong>CRP:</strong> ${currentUser.crp || '-'}</td>
                        </tr>
                    </table>
                </div>

                <div style="margin-bottom: 25px;">
                    <h3 style="color: #273e44; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 15px; font-size: 16px; text-transform: uppercase;">Registro da Sessão</h3>
                    <div style="line-height: 1.6; color: #333; text-align: justify; white-space: pre-wrap;">${record.content}</div>
                </div>

                <div style="margin-bottom: 25px;">
                    <h3 style="color: #273e44; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 15px; font-size: 16px; text-transform: uppercase;">Comportamento / Humor</h3>
                    <p style="color: #444; font-style: italic;">${record.behavior || 'Não registrado'}</p>
                </div>

                <div style="margin-bottom: 25px;">
                    <h3 style="color: #273e44; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 15px; font-size: 16px; text-transform: uppercase;">Intervenção / Técnica</h3>
                    <p style="color: #444; font-style: italic;">${record.intervention || 'Não registrado'}</p>
                </div>

                <div style="margin-bottom: 25px;">
                    <h3 style="color: #273e44; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 15px; font-size: 16px; text-transform: uppercase;">Próximos Passos</h3>
                    <p style="color: #444; font-style: italic;">${record.nextSteps || 'Não registrado'}</p>
                </div>

                <div style="margin-top: 50px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
                    Documento gerado eletronicamente em ${new Date().toLocaleString('pt-BR')} • Clínica Personart
                </div>
            </div>
        `).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Prontuário - ${patient.nome}</title>
                    <style>
                        body { margin: 0; background: #fff; }
                        @media print { 
                            body { margin: 0; }
                            @page { margin: 0; size: A4; }
                        }
                    </style>
                </head>
                <body>
                    ${content}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    // Edit existing record
    const handleEditRecord = (record: MedicalRecordChunk) => {
        setEditingRecordId(record.id);
        setFormattedRecord({
            type: record.type,
            content: record.content,
            behavior: record.behavior || '',
            intervention: record.intervention || '',
            nextSteps: record.nextSteps || ''
        });
        setFrequency(record.frequency || 'Semanal');
        if (record.frequency === 'Mensal') {
            const d = new Date(record.date + 'T12:00:00');
            setSelectedMonth(d.getMonth());
            setSelectedYear(d.getFullYear());
        } else {
            setSelectedDate(record.date);
        }
        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Cancel edit
    const handleCancelEdit = () => {
        setEditingRecordId(null);
        setFormattedRecord({ type: 'Evolução', content: '', behavior: '', intervention: '', nextSteps: '' });
    };

    // Delete record
    const handleDeleteRecord = (recordId: string) => {
        if (!confirm('Tem certeza que deseja excluir este registro do prontuário?')) return;
        onDeleteRecord(patient.id, recordId);
    };

    // Save record
    const handleSave = () => {
        if (!formattedRecord.content.trim()) {
            alert('O conteúdo do prontuário não pode estar vazio.');
            return;
        }

        const recordDate = frequency === 'Mensal'
            ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
            : selectedDate;

        if (editingRecordId) {
            const existing = prontuarioRecords.find(r => r.id === editingRecordId);
            if (existing) {
                const updatedRecord: MedicalRecordChunk = {
                    ...existing,
                    date: recordDate,
                    type: formattedRecord.type,
                    content: formattedRecord.content,
                    behavior: formattedRecord.behavior,
                    intervention: formattedRecord.intervention,
                    nextSteps: formattedRecord.nextSteps,
                    frequency
                };
                onUpdateRecord(patient.id, updatedRecord);
            }
            setEditingRecordId(null);
        } else {
            const newRecord: MedicalRecordChunk = {
                id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                date: recordDate,
                timestamp: Date.now(),
                professionalName: currentUser.name,
                professionalId: currentUser.id,
                type: formattedRecord.type,
                content: formattedRecord.content,
                behavior: formattedRecord.behavior,
                intervention: formattedRecord.intervention,
                nextSteps: formattedRecord.nextSteps,
                frequency
            };
            onSaveRecord(patient.id, newRecord);
        }

        // Clear form
        setFormattedRecord({
            type: 'Evolução',
            content: '',
            behavior: '',
            intervention: '',
            nextSteps: ''
        });
    };

    // Calculate patient age
    const calculateAge = (birthDate?: string) => {
        if (!birthDate) return 'N/I';
        const birth = new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    };

    return (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="bg-slate-900 p-4 border-b border-slate-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <FileTextIcon className="w-5 h-5 text-sky-400" />
                            Prontuário Psicológico
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">Padrão CFP - Resolução 001/2009</p>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-bold text-white">{patient.nome}</p>
                        <p className="text-sm text-slate-400">
                            {calculateAge(patient.nascimento)} anos • {patient.faixa || 'N/I'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Body - Single Column Form */}
            <div className="max-w-4xl mx-auto p-6 space-y-8">
                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center gap-2 mb-6 border-b border-slate-700 pb-4">
                        <EditIcon className="w-5 h-5 text-[#e9c49e]" />
                        <h3 className="font-bold text-[#e9c49e] uppercase tracking-wider text-sm">Registro de Atendimento</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        {/* Frequency Selection */}
                        <div>
                            <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2 block">Frequência</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setFrequency('Semanal')}
                                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${frequency === 'Semanal' ? 'bg-[#e9c49e]/20 text-[#e9c49e] border border-[#e9c49e]/50' : 'bg-slate-950/50 text-slate-400 border border-slate-700/50'}`}
                                >📅 Semanal</button>
                                <button
                                    onClick={() => setFrequency('Mensal')}
                                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${frequency === 'Mensal' ? 'bg-[#e9c49e]/20 text-[#e9c49e] border border-[#e9c49e]/50' : 'bg-slate-950/50 text-slate-400 border border-slate-700/50'}`}
                                >🗓️ Mensal</button>
                            </div>
                        </div>

                        {/* Date Selection */}
                        <div className="md:col-span-1">
                            {frequency === 'Semanal' ? (
                                <>
                                    <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2 block">Data da Sessão</label>
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="w-full bg-slate-950/50 border border-slate-700/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-[#e9c49e]/50 text-sm"
                                    />
                                </>
                            ) : (
                                <>
                                    <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2 block">Mês / Ano</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <select
                                            value={selectedMonth}
                                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                            className="bg-slate-950/50 border border-slate-700/50 rounded-lg px-2 py-2 text-white text-xs"
                                        >
                                            {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m, i) => (
                                                <option key={i} value={i}>{m}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={selectedYear}
                                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                                            className="bg-slate-950/50 border border-slate-700/50 rounded-lg px-2 py-2 text-white text-xs"
                                        >
                                            {[2024, 2025, 2026, 2027, 2028].map(y => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Record Type */}
                        <div>
                            <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2 block">Tipo de Registro</label>
                            <select
                                value={formattedRecord.type}
                                onChange={(e) => setFormattedRecord(prev => ({ ...prev, type: e.target.value as any }))}
                                className="w-full bg-slate-950/50 border border-slate-700/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-[#e9c49e]/50 text-sm"
                            >
                                <option value="Anamnese">Anamnese</option>
                                <option value="Evolução">Evolução</option>
                                <option value="Encerramento">Encerramento</option>
                            </select>
                        </div>
                    </div>

                    {/* Content Fields */}
                    <div className="space-y-6">
                        <div>
                            <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2 block">Registro da Sessão / Evolução</label>
                            <textarea
                                value={formattedRecord.content}
                                onChange={(e) => setFormattedRecord(prev => ({ ...prev, content: e.target.value }))}
                                placeholder="Descreva os principais tópicos abordados, observações clínicas e o desenvolvimento do paciente..."
                                className="w-full h-48 bg-slate-950/50 border border-slate-700/50 rounded-xl p-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#e9c49e]/30 resize-none leading-relaxed font-light"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2 block">Comportamento / Humor</label>
                                <input
                                    type="text"
                                    value={formattedRecord.behavior}
                                    onChange={(e) => setFormattedRecord(prev => ({ ...prev, behavior: e.target.value }))}
                                    placeholder="Ex: Colaborativo, ansioso, orientado..."
                                    className="w-full bg-slate-950/50 border border-slate-700/50 rounded-lg px-4 py-2 text-slate-200 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2 block">Intervenção / Técnica</label>
                                <input
                                    type="text"
                                    value={formattedRecord.intervention}
                                    onChange={(e) => setFormattedRecord(prev => ({ ...prev, intervention: e.target.value }))}
                                    placeholder="Ex: Escuta ativa, psicoeducação..."
                                    className="w-full bg-slate-950/50 border border-slate-700/50 rounded-lg px-4 py-2 text-slate-200 text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2 block">Próximos Passos / Encaminhamentos</label>
                            <input
                                type="text"
                                value={formattedRecord.nextSteps}
                                onChange={(e) => setFormattedRecord(prev => ({ ...prev, nextSteps: e.target.value }))}
                                placeholder="Ex: Manutenção do plano terapêutico..."
                                className="w-full bg-slate-950/50 border border-slate-700/50 rounded-lg px-4 py-2 text-slate-200 text-sm"
                            />
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-700 flex gap-4">
                        <button
                            onClick={handleSave}
                            disabled={!formattedRecord.content.trim()}
                            className="flex-1 py-4 bg-gradient-to-r from-[#e9c49e] to-[#d4af8a] hover:from-white hover:to-[#e9c49e] text-slate-900 font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-30"
                        >
                            <SaveIcon className="w-5 h-5" />
                            {editingRecordId ? 'Atualizar Registro' : 'Salvar no Prontuário'}
                        </button>
                        {editingRecordId && (
                            <button
                                onClick={handleCancelEdit}
                                className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-700"
                            >Cancelar</button>
                        )}
                    </div>
                </div>

                {/* CFP Guidelines Section */}
                <div className="bg-sky-950/20 border border-sky-500/20 rounded-2xl p-6">
                    <h4 className="flex items-center gap-2 text-sky-400 font-bold mb-4">
                        <ShieldIcon className="w-4 h-4" />
                        Guia Profissional: Resolução CFP 001/2009
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[13px] text-slate-400 leading-relaxed">
                        <ul className="space-y-3 list-disc pl-4">
                            <li><strong>Identificação:</strong> Nome do paciente, idade, profissional e registro CRP.</li>
                            <li><strong>Evolução:</strong> Registro contínuo que permite o acompanhamento do processo.</li>
                            <li><strong>Procedimentos:</strong> Descrição das técnicas e intervenções utilizadas.</li>
                        </ul>
                        <ul className="space-y-3 list-disc pl-4">
                            <li><strong>Demanda:</strong> Relato das condições que motivaram o atendimento.</li>
                            <li><strong>Encaminhamento:</strong> Registro de contatos com outros profissionais.</li>
                            <li><strong>Sigilo:</strong> Acesso restrito apenas ao profissional e instâncias legais.</li>
                        </ul>
                    </div>
                    <p className="mt-4 text-[11px] text-slate-500 italic border-t border-sky-500/10 pt-4">
                        O prontuário é um documento obrigatório e deve ser mantido por no mínimo 5 anos. Todo registro deve ser datado e assinado digitalmente ou fisicamente pelo profissional responsável.
                    </p>
                </div>
            </div>


            {/* Histórico de Registros */}
            {prontuarioRecords.length > 0 && (
                <div className="border-t border-slate-700/50 mt-6 pt-2">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="w-full p-4 flex items-center justify-between text-slate-400 hover:text-[#e9c49e] hover:bg-slate-800/50 rounded-xl transition-all group"
                    >
                        <span className="font-bold flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                            <FileTextIcon className="w-4 h-4" />
                            Histórico de Registros <span className="text-xs py-0.5 px-2 bg-slate-800 rounded-full border border-slate-700 text-slate-400 ml-2">{prontuarioRecords.length}</span>
                        </span>
                        {showHistory ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                    </button>

                    {showHistory && (
                        <div className="p-4 pt-2">
                            {/* Barra de ações */}
                            <div className="flex items-center justify-between mb-4 flex-wrap gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 px-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedRecords.size === prontuarioRecords.length && prontuarioRecords.length > 0}
                                            onChange={() => selectedRecords.size === prontuarioRecords.length ? deselectAllRecords() : selectAllRecords()}
                                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#e9c49e] focus:ring-[#e9c49e] cursor-pointer"
                                        />
                                        <span className="text-xs font-medium text-slate-400">
                                            {selectedRecords.size === 0 ? 'Selecionar todos' :
                                                selectedRecords.size === prontuarioRecords.length ? 'Todos selecionados' :
                                                    `${selectedRecords.size} selecionado(s)`}
                                        </span>
                                    </div>
                                </div>
                                {selectedRecords.size > 0 && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                const records = prontuarioRecords.filter(r => selectedRecords.has(r.id));
                                                downloadAsTxt(records);
                                            }}
                                            className="px-3 py-1.5 bg-[#273e44] hover:bg-[#345057] border border-[#e9c49e]/30 text-[#e9c49e] text-xs font-bold rounded-lg flex items-center gap-2 transition hover:shadow-lg shadow-[#e9c49e]/5"
                                        >
                                            <FileTextIcon className="w-3 h-3" />
                                            DOC/TXT
                                        </button>
                                        <button
                                            onClick={() => {
                                                const records = prontuarioRecords.filter(r => selectedRecords.has(r.id));
                                                downloadAsPdf(records);
                                            }}
                                            className="px-3 py-1.5 bg-gradient-to-r from-red-900/80 to-red-800/80 hover:from-red-800 hover:to-red-700 border border-red-500/30 text-red-100 text-xs font-bold rounded-lg flex items-center gap-2 transition hover:shadow-lg shadow-red-500/10"
                                        >
                                            <FileTextIcon className="w-3 h-3" />
                                            PDF
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Lista de registros */}
                            <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                                {prontuarioRecords
                                    .sort((a, b) => b.timestamp - a.timestamp)
                                    .map(record => (
                                        <div
                                            key={record.id}
                                            className={`rounded-xl p-4 border transition-all cursor-pointer group hover:shadow-md ${selectedRecords.has(record.id)
                                                ? 'bg-[#273e44]/30 border-[#e9c49e]/50 shadow-[#e9c49e]/5 backdrop-blur-sm'
                                                : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/50'
                                                }`}
                                            onClick={() => toggleRecordSelection(record.id)}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedRecords.has(record.id)}
                                                        onChange={() => toggleRecordSelection(record.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#e9c49e] focus:ring-[#e9c49e] cursor-pointer"
                                                    />
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${record.type === 'Anamnese' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                                                        record.type === 'Encerramento' ? 'bg-red-500/10 text-red-300 border-red-500/20' :
                                                            'bg-green-500/10 text-green-300 border-green-500/20'
                                                        }`}>
                                                        {record.type}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-slate-500 font-medium font-mono">
                                                        {new Date(record.date + 'T12:00:00').toLocaleDateString('pt-BR')} • {record.professionalName}
                                                    </span>
                                                    {record.type === 'Encerramento' ? (
                                                        <span className="text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded-md uppercase tracking-wider">
                                                            🔒 Finalizado
                                                        </span>
                                                    ) : record.type === 'Anamnese' ? (
                                                        <>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleEditRecord(record); }}
                                                                className="p-1.5 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 rounded-lg transition-all"
                                                                title="Editar registro"
                                                            >
                                                                <EditIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteRecord(record.id); }}
                                                                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                                                                title="Excluir registro"
                                                            >
                                                                <TrashIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        </>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <p className="text-slate-300 text-sm line-clamp-3 leading-relaxed font-light pl-7 border-l-2 border-slate-700/50 group-hover:border-[#e9c49e]/30 transition-colors">
                                                {record.content}
                                            </p>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
