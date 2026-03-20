import React, { useMemo, useState } from 'react';
import { WaitlistEntry, WaitlistStatus } from '../types';
import { PlusIcon, XIcon, CheckIcon, TrashIcon, CalendarIcon } from './icons';

const STATUS_HELP: Record<WaitlistStatus, string> = {
    NOVO: 'Entrou na fila e ainda não foi contatado.',
    CONTATADO: 'Já enviamos mensagem/ligação. Conversa iniciada.',
    AGUARDANDO_VAGA: 'Confirmou interesse, mas não há horário compatível agora.',
    AGUARDANDO_RETORNO: 'Enviamos opções de horários e estamos aguardando resposta.',
    AGENDADO: 'Horário confirmado (já está/irá para a agenda).',
    ENCERRADO: 'Finalizado (desistiu, sem resposta ou encaminhado).'
};

const STATUS_LABEL: Record<WaitlistStatus, string> = {
    NOVO: 'Novo',
    CONTATADO: 'Contatado',
    AGUARDANDO_VAGA: 'Aguardando vaga',
    AGUARDANDO_RETORNO: 'Aguardando retorno',
    AGENDADO: 'Agendado',
    ENCERRADO: 'Encerrado'
};

const statusPill = (s: WaitlistStatus) => {
    switch (s) {
        case 'NOVO': return 'bg-slate-700/60 text-slate-200 border-slate-600';
        case 'CONTATADO': return 'bg-sky-900/30 text-sky-300 border-sky-700/40';
        case 'AGUARDANDO_VAGA': return 'bg-amber-900/25 text-amber-300 border-amber-700/30';
        case 'AGUARDANDO_RETORNO': return 'bg-purple-900/25 text-purple-300 border-purple-700/30';
        case 'AGENDADO': return 'bg-emerald-900/25 text-emerald-300 border-emerald-700/30';
        case 'ENCERRADO': return 'bg-red-900/20 text-red-300 border-red-800/30';
    }
};

const emptyForm = (especialidades: string[]): Omit<WaitlistEntry, 'id' | 'createdAt' | 'updatedAt'> => ({
    name: '',
    whatsapp: '',
    email: '',
    specialties: especialidades.length ? [especialidades[0]] : [],
    modality: 'Tanto faz',
    preferredTimes: '',
    notes: '',
    status: 'NOVO',
    nextAction: '',
    nextActionAt: '',
    lastContactAt: ''
});

export const Waitlist: React.FC<{
    entries: WaitlistEntry[];
    especialidades: string[];
    onUpsert: (entry: WaitlistEntry) => void;
    onRemove: (id: string) => void;
    onBulkImportLink?: (url: string) => void;
    onClose?: () => void;
}> = ({ entries, especialidades, onUpsert, onRemove }) => {
    const [isOpenForm, setIsOpenForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<WaitlistStatus | ''>('');

    const [form, setForm] = useState(() => emptyForm(especialidades));

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (entries || [])
            .filter(e => !statusFilter || e.status === statusFilter)
            .filter(e => {
                if (!q) return true;
                const hay = `${e.name} ${e.whatsapp} ${(e.email || '')} ${(e.specialties || []).join(' ')}`.toLowerCase();
                return hay.includes(q);
            })
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    }, [entries, query, statusFilter]);

    const openNew = () => {
        setEditingId(null);
        setForm(emptyForm(especialidades));
        setIsOpenForm(true);
    };

    const openEdit = (e: WaitlistEntry) => {
        setEditingId(e.id);
        setForm({
            name: e.name,
            whatsapp: e.whatsapp,
            email: e.email || '',
            specialties: e.specialties || [],
            modality: e.modality || 'Tanto faz',
            preferredTimes: e.preferredTimes || '',
            notes: e.notes || '',
            status: e.status,
            nextAction: e.nextAction || '',
            nextActionAt: e.nextActionAt || '',
            lastContactAt: e.lastContactAt || ''
        });
        setIsOpenForm(true);
    };

    const save = () => {
        if (!form.name.trim() || !form.whatsapp.trim()) {
            alert('Preencha Nome e WhatsApp.');
            return;
        }
        if (!form.specialties || form.specialties.length === 0) {
            alert('Selecione ao menos 1 especialidade.');
            return;
        }

        const now = new Date().toISOString();
        const id = editingId || `wl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const createdAt = editingId ? (entries.find(x => x.id === editingId)?.createdAt || now) : now;
        const updated: WaitlistEntry = {
            id,
            createdAt,
            updatedAt: now,
            name: form.name.trim(),
            whatsapp: form.whatsapp.trim(),
            email: (form.email || '').trim() || undefined,
            specialties: form.specialties,
            modality: form.modality,
            preferredTimes: (form.preferredTimes || '').trim() || undefined,
            notes: (form.notes || '').trim() || undefined,
            status: form.status,
            nextAction: (form.nextAction || '').trim() || undefined,
            nextActionAt: form.nextActionAt || undefined,
            lastContactAt: form.lastContactAt || undefined
        };
        onUpsert(updated);
        setIsOpenForm(false);
    };

    const toggleSpecialty = (s: string) => {
        setForm(prev => {
            const set = new Set(prev.specialties || []);
            if (set.has(s)) set.delete(s);
            else set.add(s);
            return { ...prev, specialties: Array.from(set) };
        });
    };

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-bold text-white">Fila de espera</h2>
                    <p className="text-xs text-slate-400">Dica: use <strong>Próxima ação + data</strong> para não perder follow-up.</p>
                </div>
                <button onClick={openNew} className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                    <PlusIcon className="w-4 h-4" /> Novo
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Buscar por nome/whats/especialidade..."
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-sky-600"
                />
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                >
                    <option value="">Todos os status</option>
                    {(Object.keys(STATUS_LABEL) as WaitlistStatus[]).map(s => (
                        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                </select>
                <div className="text-xs text-slate-500 flex items-center justify-end">Total: <span className="text-slate-200 font-bold ml-1">{filtered.length}</span></div>
            </div>

            <div className="space-y-2">
                {filtered.length === 0 ? (
                    <div className="text-sm text-slate-500 text-center py-10">Nenhum registro na fila.</div>
                ) : filtered.map(e => (
                    <div key={e.id} className="bg-slate-900/40 border border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-bold text-white truncate">{e.name}</div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusPill(e.status)}`}>{STATUS_LABEL[e.status]}</span>
                                <span className="text-xs text-slate-400">{e.whatsapp}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                {(e.specialties || []).join(' • ')}
                                {e.modality && <span> • {e.modality}</span>}
                                {e.preferredTimes && <span> • {e.preferredTimes}</span>}
                            </div>
                            {(e.nextAction || e.nextActionAt) && (
                                <div className="text-xs text-amber-300 mt-1 flex items-center gap-2">
                                    <CalendarIcon className="w-3 h-3" />
                                    <span className="truncate">Próxima ação: {e.nextAction || '—'} {e.nextActionAt ? `(${new Date(e.nextActionAt).toLocaleDateString('pt-BR')})` : ''}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => openEdit(e)} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg">Editar</button>
                            <button
                                onClick={() => { if (confirm(`Remover "${e.name}" da fila?`)) onRemove(e.id); }}
                                className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 text-xs font-bold rounded-lg"
                            >
                                Remover
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {isOpenForm && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative">
                        <button onClick={() => setIsOpenForm(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><XIcon className="w-6 h-6" /></button>
                        <h3 className="text-lg font-bold text-white mb-4">{editingId ? 'Editar fila' : 'Novo na fila'}</h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Nome *</label>
                                <input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                            </div>
                            <div>
                                <label className="block text-[11px] text-slate-400 mb-1">WhatsApp *</label>
                                <input value={form.whatsapp} onChange={e => setForm(prev => ({ ...prev, whatsapp: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                            </div>
                            <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Email</label>
                                <input value={form.email || ''} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                            </div>
                            <div>
                                <label className="text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                                    Status
                                    <span className="text-slate-500" title={Object.entries(STATUS_HELP).map(([k, v]) => `${STATUS_LABEL[k as WaitlistStatus]}: ${v}`).join('\n')}>?
                                    </span>
                                </label>
                                <select value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value as WaitlistStatus }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                                    {(Object.keys(STATUS_LABEL) as WaitlistStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                                </select>
                                <div className="text-[11px] text-slate-500 mt-1">{STATUS_HELP[form.status]}</div>
                            </div>
                        </div>

                        <div className="mt-4">
                            <div className="text-[11px] text-slate-400 mb-2">Especialidades *</div>
                            <div className="flex flex-wrap gap-2">
                                {especialidades.map(s => {
                                    const active = (form.specialties || []).includes(s);
                                    return (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => toggleSpecialty(s)}
                                            className={`px-3 py-1.5 rounded-full text-xs border transition ${active ? 'bg-sky-600/20 border-sky-500 text-sky-200' : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                                        >
                                            {s}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                            <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Modalidade</label>
                                <select value={form.modality as any} onChange={e => setForm(prev => ({ ...prev, modality: e.target.value as any }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                                    <option value="Tanto faz">Tanto faz</option>
                                    <option value="Presencial">Presencial</option>
                                    <option value="Online">Online</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Preferência (dias/horários)</label>
                                <input value={form.preferredTimes || ''} onChange={e => setForm(prev => ({ ...prev, preferredTimes: e.target.value }))} placeholder="Ex: Seg/Qua à noite" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                            <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Próxima ação (opcional)</label>
                                <input value={form.nextAction || ''} onChange={e => setForm(prev => ({ ...prev, nextAction: e.target.value }))} placeholder="Ex: mandar opções" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                            </div>
                            <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Data da próxima ação</label>
                                <input type="date" value={form.nextActionAt || ''} onChange={e => setForm(prev => ({ ...prev, nextActionAt: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="block text-[11px] text-slate-400 mb-1">Observações</label>
                            <textarea value={form.notes || ''} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white h-24 resize-none" />
                        </div>

                        <div className="flex gap-2 mt-5">
                            <button onClick={() => setIsOpenForm(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-bold rounded-lg">Cancelar</button>
                            <button onClick={save} className="ml-auto px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold rounded-lg flex items-center gap-2">
                                <CheckIcon className="w-4 h-4" /> Salvar
                            </button>
                            {editingId && (
                                <button
                                    onClick={() => { if (confirm('Remover este item?')) { onRemove(editingId); setIsOpenForm(false); } }}
                                    className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 text-sm font-bold rounded-lg flex items-center gap-2"
                                >
                                    <TrashIcon className="w-4 h-4" /> Remover
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
