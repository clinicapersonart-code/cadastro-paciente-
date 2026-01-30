import React, { useState } from 'react';
import { Patient, MedicalRecordChunk, UserProfile } from '../types';
import { FileTextIcon, MicIcon, SparklesIcon, SaveIcon, PlusIcon, ChevronDownIcon, ChevronUpIcon, TrashIcon } from './icons';

interface MedicalRecordProps {
    patient: Patient;
    currentUser: UserProfile;
    onSaveRecord: (patientId: string, record: MedicalRecordChunk) => void;
    existingRecords?: MedicalRecordChunk[];
}

export const MedicalRecord: React.FC<MedicalRecordProps> = ({
    patient,
    currentUser,
    onSaveRecord,
    existingRecords = []
}) => {
    // Estado do painel de anotações (esquerda)
    const [quickNotes, setQuickNotes] = useState('');
    const [isListening, setIsListening] = useState(false);

    // Estado do prontuário formatado (direita)
    const [formattedRecord, setFormattedRecord] = useState({
        type: 'Evolução' as 'Anamnese' | 'Evolução' | 'Encerramento',
        content: '',
        behavior: '',
        intervention: '',
        nextSteps: ''
    });

    // Data selecionada para o registro (padrão: hoje)
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // Histórico expandido
    const [showHistory, setShowHistory] = useState(false);

    // Seleção de registros para download
    const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());

    // Funções de seleção
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
        setSelectedRecords(new Set(existingRecords.map(r => r.id)));
    };

    const deselectAllRecords = () => {
        setSelectedRecords(new Set());
    };

    // Formatar registro para texto
    const formatRecordToText = (record: MedicalRecordChunk): string => {
        return `
═══════════════════════════════════════════════════════════════
PRONTUÁRIO PSICOLÓGICO - ${record.type.toUpperCase()}
═══════════════════════════════════════════════════════════════
Paciente: ${patient.nome}
Data: ${new Date(record.date).toLocaleDateString('pt-BR')}
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

    // Download como TXT (simula DOC)
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
        a.download = `prontuario_${patient.nome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Download como PDF (usando print)
    const downloadAsPdf = (records: MedicalRecordChunk[]) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Por favor, permita pop-ups para gerar o PDF.');
            return;
        }

        const content = records.map(record => `
            <div style="page-break-after: always; padding: 20px; font-family: Arial, sans-serif;">
                <h2 style="color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px;">
                    PRONTUÁRIO PSICOLÓGICO - ${record.type.toUpperCase()}
                </h2>
                <table style="width: 100%; margin-bottom: 20px;">
                    <tr><td><strong>Paciente:</strong> ${patient.nome}</td></tr>
                    <tr><td><strong>Data:</strong> ${new Date(record.date).toLocaleDateString('pt-BR')}</td></tr>
                    <tr><td><strong>Profissional:</strong> ${record.professionalName}</td></tr>
                </table>
                <h3 style="color: #2d5a87;">Registro da Sessão</h3>
                <p style="background: #f5f5f5; padding: 15px; border-radius: 5px;">${record.content}</p>
                <h3 style="color: #2d5a87;">Comportamento/Humor</h3>
                <p style="background: #f5f5f5; padding: 15px; border-radius: 5px;">${record.behavior || 'Não registrado'}</p>
                <h3 style="color: #2d5a87;">Intervenção/Técnica</h3>
                <p style="background: #f5f5f5; padding: 15px; border-radius: 5px;">${record.intervention || 'Não registrado'}</p>
                <h3 style="color: #2d5a87;">Próximos Passos</h3>
                <p style="background: #f5f5f5; padding: 15px; border-radius: 5px;">${record.nextSteps || 'Não registrado'}</p>
            </div>
        `).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Prontuário - ${patient.nome}</title>
                    <style>
                        body { margin: 0; padding: 20px; }
                        @media print { body { margin: 0; } }
                    </style>
                </head>
                <body>
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #1e3a5f;">CLÍNICA PERSONART</h1>
                        <p>Prontuário Eletrônico - Padrão CFP</p>
                    </div>
                    ${content}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    // Ditado por voz (Web Speech API)
    const startDictation = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Seu navegador não suporta ditado por voz. Use Chrome ou Edge.');
            return;
        }

        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);

        recognition.onresult = (event: any) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            setQuickNotes(prev => prev + ' ' + transcript);
        };

        recognition.onerror = () => setIsListening(false);

        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    };

    // Estado de loading para IA
    const [isFormatting, setIsFormatting] = useState(false);

    // Prompt para formatação CRP
    const buildPrompt = (notes: string) => `Você é um assistente de psicólogo clínico. Formate as seguintes anotações de sessão em um prontuário profissional padrão CRP.

ANOTAÇÕES DA SESSÃO:
${notes}

Responda APENAS em JSON válido neste formato exato (sem markdown, sem explicações):
{
    "content": "Resumo profissional da sessão em terceira pessoa",
    "behavior": "Estado emocional e comportamental observado",
    "intervention": "Técnicas e intervenções utilizadas",
    "nextSteps": "Encaminhamentos e próximos passos"
}`;

    // Processar resposta da IA
    const processAIResponse = (aiResponse: string) => {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                setFormattedRecord(prev => ({
                    ...prev,
                    content: parsed.content || quickNotes,
                    behavior: parsed.behavior || '',
                    intervention: parsed.intervention || '',
                    nextSteps: parsed.nextSteps || ''
                }));
                return true;
            } catch {
                setFormattedRecord(prev => ({ ...prev, content: aiResponse || quickNotes }));
                return true;
            }
        }
        setFormattedRecord(prev => ({ ...prev, content: aiResponse || quickNotes }));
        return true;
    };

    // Tentar Groq Cloud (funciona em produção)
    const tryGroq = async (prompt: string): Promise<boolean> => {
        const apiKey = import.meta.env.VITE_GROQ_API_KEY;
        if (!apiKey) return false;

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 1000
                })
            });

            if (!response.ok) throw new Error('Groq API error');

            const data = await response.json();
            const aiResponse = data.choices?.[0]?.message?.content || '';
            return processAIResponse(aiResponse);
        } catch (error) {
            console.error('Groq error:', error);
            return false;
        }
    };

    // Tentar Ollama Local (funciona em desenvolvimento)
    const tryOllama = async (prompt: string): Promise<boolean> => {
        try {
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'qwen3-coder:30b',
                    prompt: prompt,
                    stream: false,
                    options: { temperature: 0.3, num_predict: 1000 }
                })
            });

            if (!response.ok) throw new Error('Ollama error');

            const data = await response.json();
            return processAIResponse(data.response || '');
        } catch (error) {
            console.error('Ollama error:', error);
            return false;
        }
    };

    // Formatar com IA (tenta Groq primeiro, depois Ollama)
    const formatWithAI = async () => {
        if (!quickNotes.trim()) {
            alert('Digite algumas anotações para formatar.');
            return;
        }

        setIsFormatting(true);
        const prompt = buildPrompt(quickNotes);

        try {
            // Tenta Groq Cloud primeiro (funciona no Vercel)
            const groqSuccess = await tryGroq(prompt);
            if (groqSuccess) return;

            // Fallback: tenta Ollama local
            const ollamaSuccess = await tryOllama(prompt);
            if (ollamaSuccess) return;

            // Se nenhum funcionou
            alert('Não foi possível conectar à IA. Verifique sua conexão.');
            setFormattedRecord(prev => ({ ...prev, content: quickNotes }));
        } finally {
            setIsFormatting(false);
        }
    };

    // Salvar registro
    const handleSave = () => {
        if (!formattedRecord.content.trim()) {
            alert('O conteúdo do prontuário não pode estar vazio.');
            return;
        }

        const newRecord: MedicalRecordChunk = {
            id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            date: selectedDate,
            timestamp: Date.now(),
            professionalName: currentUser.name,
            professionalId: currentUser.id,
            type: formattedRecord.type,
            content: formattedRecord.content,
            behavior: formattedRecord.behavior,
            intervention: formattedRecord.intervention,
            nextSteps: formattedRecord.nextSteps
        };

        onSaveRecord(patient.id, newRecord);

        // Limpar formulário
        setQuickNotes('');
        setFormattedRecord({
            type: 'Evolução',
            content: '',
            behavior: '',
            intervention: '',
            nextSteps: ''
        });
    };

    // Calcular idade do paciente
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
            {/* Cabeçalho - Dados do Paciente (Folha de Rosto) */}
            <div className="bg-slate-900 p-4 border-b border-slate-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <FileTextIcon className="w-5 h-5 text-sky-400" />
                            Prontuário Eletrônico
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

                {/* Dados de Identificação (Resumo) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                    <div>
                        <span className="text-slate-500">Convênio:</span>
                        <p className="text-white font-medium">{patient.convenio || 'Particular'}</p>
                    </div>
                    <div>
                        <span className="text-slate-500">Carteirinha:</span>
                        <p className="text-white font-medium">{patient.carteirinha || 'N/A'}</p>
                    </div>
                    <div>
                        <span className="text-slate-500">Profissional:</span>
                        <p className="text-white font-medium">{currentUser.name}</p>
                    </div>
                    <div>
                        <span className="text-slate-500">Data:</span>
                        <p className="text-white font-medium">{new Date().toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>
            </div>

            {/* Corpo - Layout Dual */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x divide-slate-700">
                {/* Painel Esquerdo - Anotações Rápidas */}
                <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-slate-300 flex items-center gap-2">
                            <MicIcon className="w-4 h-4" />
                            Anotações da Sessão
                        </h3>
                        <button
                            onClick={startDictation}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${isListening
                                ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                        >
                            <MicIcon className="w-4 h-4" />
                            {isListening ? 'Parar' : 'Ditar'}
                        </button>
                    </div>

                    <textarea
                        value={quickNotes}
                        onChange={(e) => setQuickNotes(e.target.value)}
                        placeholder="Digite suas anotações aqui ou use o botão 'Ditar' para falar...

Exemplo:
- Paciente relatou melhora no humor
- Técnica aplicada: TCC - reestruturação cognitiva
- Próxima sessão: continuar trabalho de exposição"
                        className="w-full h-64 bg-slate-900 border border-slate-600 rounded-xl p-4 text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />

                    <button
                        onClick={formatWithAI}
                        disabled={!quickNotes.trim() || isFormatting}
                        className="mt-3 w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                    >
                        {isFormatting ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Formatando com IA...
                            </>
                        ) : (
                            <>
                                <SparklesIcon className="w-5 h-5" />
                                Formatar
                            </>
                        )}
                    </button>
                    <p className="text-xs text-slate-500 text-center mt-2">
                        A IA organiza suas anotações no formato CRP
                    </p>
                </div>

                {/* Painel Direito - Prontuário Formatado */}
                <div className="p-4 bg-slate-850">
                    <h3 className="font-bold text-slate-300 mb-3 flex items-center gap-2">
                        <FileTextIcon className="w-4 h-4 text-green-400" />
                        Prontuário Padrão CRP
                    </h3>

                    {/* Data da Sessão */}
                    <div className="mb-4">
                        <label className="text-xs text-slate-500 uppercase tracking-wider font-bold">Data da Sessão</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full mt-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                    </div>

                    {/* Tipo de Registro */}
                    <div className="mb-4">
                        <label className="text-xs text-slate-500 uppercase tracking-wider font-bold">Tipo de Registro</label>
                        <select
                            value={formattedRecord.type}
                            onChange={(e) => setFormattedRecord(prev => ({ ...prev, type: e.target.value as any }))}
                            className="w-full mt-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                            <option value="Anamnese">Anamnese (Primeira Sessão)</option>
                            <option value="Evolução">Evolução (Sessão Regular)</option>
                            <option value="Encerramento">Encerramento / Alta</option>
                        </select>
                    </div>

                    {/* Conteúdo Principal */}
                    <div className="mb-4">
                        <label className="text-xs text-slate-500 uppercase tracking-wider font-bold">Registro da Sessão</label>
                        <textarea
                            value={formattedRecord.content}
                            onChange={(e) => setFormattedRecord(prev => ({ ...prev, content: e.target.value }))}
                            placeholder="Descrição completa da sessão..."
                            className="w-full mt-1 h-28 bg-slate-900 border border-slate-600 rounded-lg p-3 text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                    </div>

                    {/* Campos Específicos CRP */}
                    <div className="grid grid-cols-1 gap-3 mb-4">
                        <div>
                            <label className="text-xs text-slate-500 uppercase tracking-wider font-bold">Comportamento / Humor</label>
                            <input
                                type="text"
                                value={formattedRecord.behavior}
                                onChange={(e) => setFormattedRecord(prev => ({ ...prev, behavior: e.target.value }))}
                                placeholder="Ex: Paciente apresentou-se colaborativo, bom contato visual..."
                                className="w-full mt-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 uppercase tracking-wider font-bold">Intervenção / Técnica</label>
                            <input
                                type="text"
                                value={formattedRecord.intervention}
                                onChange={(e) => setFormattedRecord(prev => ({ ...prev, intervention: e.target.value }))}
                                placeholder="Ex: TCC - Reestruturação Cognitiva, Psicoeducação..."
                                className="w-full mt-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 uppercase tracking-wider font-bold">Próximos Passos / Encaminhamentos</label>
                            <input
                                type="text"
                                value={formattedRecord.nextSteps}
                                onChange={(e) => setFormattedRecord(prev => ({ ...prev, nextSteps: e.target.value }))}
                                placeholder="Ex: Continuar exposição gradual, avaliar medicação..."
                                className="w-full mt-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                    </div>



                    {/* Botão Salvar */}
                    <button
                        onClick={handleSave}
                        disabled={!formattedRecord.content.trim()}
                        className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                    >
                        <SaveIcon className="w-5 h-5" />
                        Salvar no Prontuário
                    </button>
                </div>
            </div>

            {/* Histórico de Registros */}
            {existingRecords.length > 0 && (
                <div className="border-t border-slate-700">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="w-full p-4 flex items-center justify-between text-slate-400 hover:text-white hover:bg-slate-700/30 transition-all"
                    >
                        <span className="font-medium">
                            Histórico de Registros ({existingRecords.length})
                        </span>
                        {showHistory ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                    </button>

                    {showHistory && (
                        <div className="p-4 pt-0">
                            {/* Barra de ações */}
                            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedRecords.size === existingRecords.length && existingRecords.length > 0}
                                        onChange={() => selectedRecords.size === existingRecords.length ? deselectAllRecords() : selectAllRecords()}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500"
                                    />
                                    <span className="text-sm text-slate-400">
                                        {selectedRecords.size === 0 ? 'Selecionar todos' :
                                            selectedRecords.size === existingRecords.length ? 'Todos selecionados' :
                                                `${selectedRecords.size} selecionado(s)`}
                                    </span>
                                </div>
                                {selectedRecords.size > 0 && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                const records = existingRecords.filter(r => selectedRecords.has(r.id));
                                                downloadAsTxt(records);
                                            }}
                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg flex items-center gap-1 transition"
                                        >
                                            <FileTextIcon className="w-4 h-4" />
                                            DOC/TXT
                                        </button>
                                        <button
                                            onClick={() => {
                                                const records = existingRecords.filter(r => selectedRecords.has(r.id));
                                                downloadAsPdf(records);
                                            }}
                                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg flex items-center gap-1 transition"
                                        >
                                            <FileTextIcon className="w-4 h-4" />
                                            PDF
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Lista de registros */}
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {existingRecords
                                    .sort((a, b) => b.timestamp - a.timestamp)
                                    .map(record => (
                                        <div
                                            key={record.id}
                                            className={`bg-slate-900 rounded-xl p-4 border transition cursor-pointer ${selectedRecords.has(record.id)
                                                ? 'border-sky-500 bg-sky-500/10'
                                                : 'border-slate-700 hover:border-slate-600'
                                                }`}
                                            onClick={() => toggleRecordSelection(record.id)}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedRecords.has(record.id)}
                                                        onChange={() => toggleRecordSelection(record.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500"
                                                    />
                                                    <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${record.type === 'Anamnese' ? 'bg-blue-500/20 text-blue-400' :
                                                        record.type === 'Encerramento' ? 'bg-red-500/20 text-red-400' :
                                                            'bg-green-500/20 text-green-400'
                                                        }`}>
                                                        {record.type}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-slate-500">
                                                    {new Date(record.date).toLocaleDateString('pt-BR')} • {record.professionalName}
                                                </span>
                                            </div>
                                            <p className="text-slate-300 text-sm line-clamp-3">{record.content}</p>
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
