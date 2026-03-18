import React, { useState } from 'react';
import { WaitlistEntry, WaitlistStatus } from '../types';
import { supabase, isSupabaseConfigured } from '../services/supabase';

export const PublicWaitlist: React.FC<{ brandName: string; brandColor: string; brandLogo: string | null; especialidades: string[]; }> = ({ brandName, brandColor, brandLogo, especialidades }) => {
    const [name, setName] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [email, setEmail] = useState('');
    const [specialties, setSpecialties] = useState<string[]>([]);
    const [preferredTimes, setPreferredTimes] = useState('');
    const [modality, setModality] = useState<'Presencial' | 'Online' | 'Tanto faz'>('Tanto faz');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    const toggle = (s: string) => {
        setSpecialties(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    };

    const submit = async () => {
        if (!name.trim() || !whatsapp.trim() || specialties.length === 0) {
            alert('Preencha nome, WhatsApp e selecione pelo menos 1 especialidade.');
            return;
        }
        setIsSubmitting(true);
        try {
            const now = new Date().toISOString();
            const entry: WaitlistEntry = {
                id: `wl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                name: name.trim(),
                whatsapp: whatsapp.trim(),
                email: email.trim() || undefined,
                specialties,
                preferredTimes: preferredTimes.trim() || undefined,
                modality,
                notes: notes.trim() || undefined,
                status: 'NOVO' as WaitlistStatus,
                createdAt: now,
                updatedAt: now
            };

            if (isSupabaseConfigured() && supabase) {
                await supabase.from('waitlist').insert([{ id: entry.id, data: entry, created_at: now }]);
            } else {
                // fallback local
                const key = 'personart.waitlist.v1';
                const raw = localStorage.getItem(key);
                const arr = raw ? JSON.parse(raw) : [];
                arr.push(entry);
                localStorage.setItem(key, JSON.stringify(arr));
            }

            setDone(true);
        } catch (e: any) {
            alert(`Não foi possível enviar: ${e?.message || 'erro'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen" style={{ backgroundColor: '#0b1220' }}>
            <div className="max-w-xl mx-auto p-6">
                <div className="flex items-center gap-3 mb-6">
                    {brandLogo ? <img src={brandLogo} className="h-10 w-10 rounded" /> : <div className="h-10 w-10 rounded" style={{ backgroundColor: brandColor }} />}
                    <div>
                        <div className="text-2xl font-bold" style={{ color: brandColor }}>{brandName}</div>
                        <div className="text-xs text-slate-400">Fila de espera</div>
                    </div>
                </div>

                {done ? (
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 text-slate-200">
                        <div className="text-lg font-bold mb-2">Recebido!</div>
                        <div className="text-sm text-slate-300">Seu nome foi registrado na fila de espera. Assim que houver vaga compatível, entraremos em contato.</div>
                    </div>
                ) : (
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Nome *</label>
                            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100" />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">WhatsApp *</label>
                            <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100" />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Email</label>
                            <input value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100" />
                        </div>

                        <div>
                            <div className="text-sm text-slate-400 mb-2">Especialidade *</div>
                            <div className="flex flex-wrap gap-2">
                                {especialidades.map(s => (
                                    <button key={s} type="button" onClick={() => toggle(s)} className={`px-3 py-1.5 rounded-full text-xs border ${specialties.includes(s) ? 'bg-sky-600/20 border-sky-500 text-sky-200' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Modalidade</label>
                            <select value={modality} onChange={e => setModality(e.target.value as any)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100">
                                <option value="Tanto faz">Tanto faz</option>
                                <option value="Presencial">Presencial</option>
                                <option value="Online">Online</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Preferência (dias/horários)</label>
                            <input value={preferredTimes} onChange={e => setPreferredTimes(e.target.value)} placeholder="Ex: Seg/Qua à noite" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100" />
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Observações</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 h-24" />
                        </div>

                        <button disabled={isSubmitting} onClick={submit} className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl">
                            {isSubmitting ? 'Enviando...' : 'Entrar na fila'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
