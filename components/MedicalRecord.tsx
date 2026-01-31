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
            <div style="page-break-after: always; padding: 40px; font-family: 'Times New Roman', serif; max-width: 800px; margin: 0 auto;">
                <div style="border-bottom: 2px solid #e9c49e; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
                    <div>
                        <h2 style="color: #273e44; margin: 0; font-size: 24px; text-transform: uppercase;">Prontuário de Atendimento</h2>
                        <span style="color: #e9c49e; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;">${record.type}</span>
                    </div>
                    <div style="text-align: right; color: #666;">
                        <div>Data: <strong>${new Date(record.date).toLocaleDateString('pt-BR')}</strong></div>
                    </div>
                </div>

                <div style="background-color: #f8f9fa; padding: 20px; border-left: 4px solid #e9c49e; margin-bottom: 30px;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 5px 0;"><strong>Paciente:</strong> ${patient.nome}</td>
                            <td style="padding: 5px 0; text-align: right;"><strong>Nascimento:</strong> ${patient.nascimento ? new Date(patient.nascimento).toLocaleDateString('pt-BR') : '-'}</td>
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
                {/* Painel Esquerdo - Anotações e Voz */}
                <div className="md:col-span-1 space-y-4">
                    <div className="p-5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-[#e9c49e] flex items-center gap-2">
                                <MicIcon className="w-5 h-5 text-[#e9c49e]" />
                                Anotações da Sessão
                            </h3>
                            <button
                                onClick={startDictation}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-lg ${isListening
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse'
                                    : 'bg-[#273e44] text-slate-300 hover:bg-[#345057] border border-slate-600/50'
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
                            className="w-full h-[400px] bg-slate-950/50 border border-slate-700/50 rounded-xl p-4 text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#e9c49e]/50 focus:border-[#e9c49e]/30 transition-all font-light"
                        />

                        <button
                            onClick={formatWithAI}
                            disabled={!quickNotes.trim() || isFormatting}
                            className="mt-4 w-full py-3 bg-gradient-to-r from-[#273e44] to-[#1e2f34] border border-slate-600/50 hover:border-[#e9c49e]/50 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-[#e9c49e]/10 group"
                        >
                            {isFormatting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-[#e9c49e] rounded-full animate-spin" />
                                    Formatando...
                                </>
                            ) : (
                                <>
                                    <SparklesIcon className="w-5 h-5 text-[#e9c49e]" />
                                    <span className="text-slate-200 group-hover:text-white transition-colors">Formatar com IA</span>
                                </>
                            )}
                        </button>
                        <p className="text-xs text-slate-500 text-center mt-3 font-medium">
                            A IA estrutura o texto no padrão <span className="text-[#e9c49e]">CRP (Res. 001/2009)</span>
                        </p>
                    </div>
                </div>

                {/* Painel Direito - Prontuário Formatado */}
                <div className="md:col-span-1 border-l border-slate-700/50">
                    <div className="p-5 h-full bg-slate-900/30 backdrop-blur-sm">
                        <h3 className="font-bold text-[#e9c49e] mb-4 flex items-center gap-2">
                            <FileTextIcon className="w-5 h-5 text-[#e9c49e]" />
                            Prontuário Padrão CRP
                        </h3>

                        {/* Data da Sessão */}
                        <div className="mb-4">
                            <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1 block">Data da Sessão</label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full bg-slate-950/50 border border-slate-700/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#e9c49e]/50 focus:border-[#e9c49e]/30 transition-all shadow-inner"
                            />
                        </div>

                        {/* Tipo de Registro */}
                        <div className="mb-4">
                            <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1 block">Tipo de Registro</label>
                            <select
                                value={formattedRecord.type}
                                onChange={(e) => setFormattedRecord(prev => ({ ...prev, type: e.target.value as any }))}
                                className="w-full bg-slate-950/50 border border-slate-700/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#e9c49e]/50 focus:border-[#e9c49e]/30 transition-all appearance-none shadow-inner"
                            >
                                <option value="Anamnese">Anamnese (Primeira Sessão)</option>
                                <option value="Evolução">Evolução (Sessão Regular)</option>
                                <option value="Encerramento">Encerramento / Alta</option>
                            </select>
                        </div>

                        {/* Conteúdo Principal */}
                        <div className="mb-4">
                            <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1 block">Registro da Sessão</label>
                            <textarea
                                value={formattedRecord.content}
                                onChange={(e) => setFormattedRecord(prev => ({ ...prev, content: e.target.value }))}
                                placeholder="Descrição completa da sessão..."
                                className="w-full h-32 bg-slate-950/50 border border-slate-700/50 rounded-lg p-3 text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#e9c49e]/50 focus:border-[#e9c49e]/30 transition-all font-light shadow-inner"
                            />
                        </div>

                        {/* Campos Específicos CRP */}
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1 block">Comportamento / Humor</label>
                                <input
                                    type="text"
                                    value={formattedRecord.behavior}
                                    onChange={(e) => setFormattedRecord(prev => ({ ...prev, behavior: e.target.value }))}
                                    placeholder="Ex: Paciente apresentou-se colaborativo..."
                                    className="w-full bg-slate-950/50 border border-slate-700/50 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#e9c49e]/50 focus:border-[#e9c49e]/30 transition-all shadow-inner"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1 block">Intervenção / Técnica</label>
                                <input
                                    type="text"
                                    value={formattedRecord.intervention}
                                    onChange={(e) => setFormattedRecord(prev => ({ ...prev, intervention: e.target.value }))}
                                    placeholder="Ex: TCC - Reestruturação Cognitiva..."
                                    className="w-full bg-slate-950/50 border border-slate-700/50 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#e9c49e]/50 focus:border-[#e9c49e]/30 transition-all shadow-inner"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1 block">Próximos Passos</label>
                                <input
                                    type="text"
                                    value={formattedRecord.nextSteps}
                                    onChange={(e) => setFormattedRecord(prev => ({ ...prev, nextSteps: e.target.value }))}
                                    placeholder="Ex: Avaliar medicação..."
                                    className="w-full bg-slate-950/50 border border-slate-700/50 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#e9c49e]/50 focus:border-[#e9c49e]/30 transition-all shadow-inner"
                                />
                            </div>
                        </div>

                        {/* Botão Salvar */}
                        <button
                            onClick={handleSave}
                            disabled={!formattedRecord.content.trim()}
                            className="w-full py-4 bg-gradient-to-r from-[#273e44] to-[#1e2f34] hover:to-[#2d464d] border border-[#e9c49e]/30 hover:border-[#e9c49e] disabled:opacity-50 disabled:border-slate-700 text-[#e9c49e] font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-[#e9c49e]/20"
                        >
                            <SaveIcon className="w-5 h-5" />
                            Salvar no Prontuário
                        </button>
                    </div>
                </div>
            </div>

            {/* Histórico de Registros */}
            {existingRecords.length > 0 && (
                <div className="border-t border-slate-700/50 mt-6 pt-2">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="w-full p-4 flex items-center justify-between text-slate-400 hover:text-[#e9c49e] hover:bg-slate-800/50 rounded-xl transition-all group"
                    >
                        <span className="font-bold flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                            <FileTextIcon className="w-4 h-4" />
                            Histórico de Registros <span className="text-xs py-0.5 px-2 bg-slate-800 rounded-full border border-slate-700 text-slate-400 ml-2">{existingRecords.length}</span>
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
                                            checked={selectedRecords.size === existingRecords.length && existingRecords.length > 0}
                                            onChange={() => selectedRecords.size === existingRecords.length ? deselectAllRecords() : selectAllRecords()}
                                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#e9c49e] focus:ring-[#e9c49e] cursor-pointer"
                                        />
                                        <span className="text-xs font-medium text-slate-400">
                                            {selectedRecords.size === 0 ? 'Selecionar todos' :
                                                selectedRecords.size === existingRecords.length ? 'Todos selecionados' :
                                                    `${selectedRecords.size} selecionado(s)`}
                                        </span>
                                    </div>
                                </div>
                                {selectedRecords.size > 0 && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                const records = existingRecords.filter(r => selectedRecords.has(r.id));
                                                downloadAsTxt(records);
                                            }}
                                            className="px-3 py-1.5 bg-[#273e44] hover:bg-[#345057] border border-[#e9c49e]/30 text-[#e9c49e] text-xs font-bold rounded-lg flex items-center gap-2 transition hover:shadow-lg shadow-[#e9c49e]/5"
                                        >
                                            <FileTextIcon className="w-3 h-3" />
                                            DOC/TXT
                                        </button>
                                        <button
                                            onClick={() => {
                                                const records = existingRecords.filter(r => selectedRecords.has(r.id));
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
                                {existingRecords
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
                                                <span className="text-xs text-slate-500 font-medium font-mono">
                                                    {new Date(record.date).toLocaleDateString('pt-BR')} • {record.professionalName}
                                                </span>
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
