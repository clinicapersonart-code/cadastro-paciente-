import React, { useState } from 'react';
import { UserProfile, BrandConfig } from '../types';
import { LockIcon, UserIcon, CheckIcon } from './icons';

interface LoginScreenProps {
    users: UserProfile[];
    brand: BrandConfig;
    onLogin: (user: UserProfile) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ users, brand, onLogin }) => {
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!selectedUser) {
            setError('Selecione um profissional.');
            return;
        }

        if (selectedUser.pin && selectedUser.pin !== pin) {
            setError('Senha incorreta.');
            setPin('');
            return;
        }

        onLogin(selectedUser);
    };

    if (!selectedUser) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-900" style={{ backgroundColor: brand.dark }}>
                <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 animate-fade-in">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold mb-2" style={{ color: brand.color }}>{brand.name}</h1>
                        <p className="text-slate-400">Quem está acessando?</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {users.filter(u => u.active).map(user => (
                            <button
                                key={user.id}
                                onClick={() => { setSelectedUser(user); setError(''); }}
                                className="flex items-center gap-4 p-4 rounded-xl bg-slate-700/50 hover:bg-slate-700 hover:scale-[1.02] transition-all group text-left border border-transparent hover:border-sky-500/30"
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${user.role === 'clinic' ? 'bg-purple-500/20 text-purple-500' :
                                        user.role === 'admin' ? 'bg-amber-500/20 text-amber-500' :
                                            'bg-sky-500/20 text-sky-500'
                                    }`}>
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white group-hover:text-sky-400 transition-colors">{user.name}</h3>
                                    <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                                        {user.role === 'clinic' ? 'Administração' :
                                            user.role === 'admin' ? 'Responsável Técnico' :
                                                'Profissional'}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {users.length === 0 && (
                        <div className="text-center text-red-400 p-4 border border-red-900/50 bg-red-900/20 rounded-lg">
                            Nenhum usuário encontrado. Contate o suporte.
                        </div>
                    )}
                </div>
                <div className="mt-8 text-slate-500 text-xs">V2.0 - Sistema de Gestão Clínica</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900" style={{ backgroundColor: brand.dark }}>
            <form onSubmit={handleLogin} className="relative w-full max-w-sm bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 animate-slide-up">
                <button
                    type="button"
                    onClick={() => { setSelectedUser(null); setPin(''); setError(''); }}
                    className="absolute top-4 left-4 text-slate-500 hover:text-white transition"
                    title="Voltar"
                >
                    ← Voltar
                </button>

                <div className="flex flex-col items-center mb-8 mt-4">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold mb-4 ${selectedUser.role === 'admin' ? 'bg-amber-500/20 text-amber-500' : 'bg-sky-500/20 text-sky-500'}`}>
                        {selectedUser.name.charAt(0).toUpperCase()}
                    </div>
                    <h2 className="text-2xl font-bold text-white text-center">Olá, {selectedUser.name.split(' ')[0]}</h2>
                    <p className="text-slate-400 text-sm">Digite sua senha para entrar</p>
                </div>

                <div className="relative mb-6">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LockIcon className="h-5 w-5 text-slate-500" />
                    </div>
                    <input
                        type="password"
                        value={pin}
                        onChange={e => setPin(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                        placeholder="Senha / PIN"
                        autoFocus
                    />
                </div>

                {error && (
                    <div className="text-red-400 text-sm text-center mb-4 bg-red-900/20 p-2 rounded-lg border border-red-900/50 animate-pulse">
                        {error}
                    </div>
                )}

                <button type="submit" className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-sky-900/20 flex items-center justify-center gap-2">
                    <CheckIcon className="w-5 h-5" /> Entrar
                </button>
            </form>
        </div>
    );
};
