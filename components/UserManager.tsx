import React, { useState } from 'react';
import { UserProfile } from '../types';
import { UserIcon, CheckIcon, XIcon, PlusIcon, EditIcon, LockIcon } from './icons';

interface UserManagerProps {
    users: UserProfile[];
    especialidades: string[];
    onAddUser: (user: UserProfile) => void;
    onUpdateUser: (user: UserProfile) => void;
    onClose: () => void;
}

const COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

export const UserManager: React.FC<UserManagerProps> = ({
    users,
    especialidades,
    onAddUser,
    onUpdateUser,
    onClose
}) => {
    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        role: 'professional' as 'admin' | 'professional',
        pin: '',
        specialty: '',
        professionalRegister: '',
        color: COLORS[0]
    });

    const resetForm = () => {
        setFormData({
            name: '',
            role: 'professional',
            pin: '',
            specialty: '',
            professionalRegister: '',
            color: COLORS[Math.floor(Math.random() * COLORS.length)]
        });
        setEditingUser(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) return;

        if (editingUser) {
            // Editando usuário existente
            onUpdateUser({
                ...editingUser,
                name: formData.name.trim(),
                role: formData.role,
                pin: formData.pin || editingUser.pin,
                specialty: formData.specialty,
                professionalRegister: formData.professionalRegister,
                color: formData.color
            });
        } else {
            // Novo usuário
            const newUser: UserProfile = {
                id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: formData.name.trim(),
                role: formData.role,
                pin: formData.pin || '1234',
                active: true,
                specialty: formData.specialty,
                professionalRegister: formData.professionalRegister,
                color: formData.color
            };
            onAddUser(newUser);
        }

        resetForm();
        setView('list');
    };

    const handleEdit = (user: UserProfile) => {
        setEditingUser(user);
        setFormData({
            name: user.name,
            role: user.role === 'clinic' ? 'admin' : user.role,
            pin: '',
            specialty: user.specialty || '',
            professionalRegister: user.professionalRegister || user.crp || '',
            color: user.color || COLORS[0]
        });
        setView('form');
    };

    const handleToggleActive = (user: UserProfile) => {
        onUpdateUser({ ...user, active: !user.active });
    };

    // Filtra usuários que podem ser gerenciados (não mostra 'clinic')
    const manageableUsers = users.filter(u => u.role !== 'clinic');

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <UserIcon className="w-5 h-5 text-sky-400" />
                        Gerenciar Usuários
                    </h2>
                    <div className="flex items-center gap-2">
                        {view === 'list' && (
                            <button
                                onClick={() => { resetForm(); setView('form'); }}
                                className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
                            >
                                <PlusIcon className="w-4 h-4" /> Novo Usuário
                            </button>
                        )}
                        <button onClick={onClose} className="text-slate-400 hover:text-white p-2">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    {view === 'list' ? (
                        <div className="space-y-3">
                            {manageableUsers.length === 0 ? (
                                <p className="text-slate-500 text-center py-8">Nenhum profissional cadastrado ainda.</p>
                            ) : (
                                manageableUsers.map(user => (
                                    <div
                                        key={user.id}
                                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${user.active
                                                ? 'bg-slate-700/50 border-slate-600'
                                                : 'bg-slate-900/50 border-slate-800 opacity-60'
                                            }`}
                                    >
                                        <div
                                            className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white"
                                            style={{ backgroundColor: user.color || '#3B82F6' }}
                                        >
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-white flex items-center gap-2">
                                                {user.name}
                                                {!user.active && (
                                                    <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full">
                                                        Inativo
                                                    </span>
                                                )}
                                            </h3>
                                            <p className="text-xs text-slate-400">
                                                {user.role === 'admin' ? 'Responsável Técnico' : 'Profissional'}
                                                {user.specialty && ` • ${user.specialty}`}
                                                {user.professionalRegister && ` • ${user.professionalRegister}`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleEdit(user)}
                                                className="p-2 text-slate-400 hover:text-sky-400 transition"
                                                title="Editar"
                                            >
                                                <EditIcon className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleToggleActive(user)}
                                                className={`p-2 rounded-lg transition ${user.active
                                                        ? 'text-green-400 hover:bg-red-900/30 hover:text-red-400'
                                                        : 'text-red-400 hover:bg-green-900/30 hover:text-green-400'
                                                    }`}
                                                title={user.active ? 'Inativar' : 'Reativar'}
                                            >
                                                <LockIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <button
                                type="button"
                                onClick={() => { resetForm(); setView('list'); }}
                                className="text-slate-400 hover:text-white text-sm flex items-center gap-1 mb-4"
                            >
                                ← Voltar para lista
                            </button>

                            <h3 className="text-lg font-bold text-white">
                                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                            </h3>

                            {/* Nome */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Nome Completo *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-500"
                                    placeholder="Ex: Maria Silva"
                                    required
                                />
                            </div>

                            {/* Função */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Função</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData(prev => ({ ...prev, role: e.target.value as 'admin' | 'professional' }))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-500"
                                >
                                    <option value="professional">Profissional</option>
                                    <option value="admin">Responsável Técnico</option>
                                </select>
                            </div>

                            {/* Especialidade e Registro lado a lado */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Especialidade</label>
                                    <input
                                        type="text"
                                        value={formData.specialty}
                                        onChange={e => setFormData(prev => ({ ...prev, specialty: e.target.value }))}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-500"
                                        placeholder="Ex: Psicologia"
                                        list="especialidades-list"
                                    />
                                    <datalist id="especialidades-list">
                                        {especialidades.map(e => <option key={e} value={e} />)}
                                    </datalist>
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Registro (CRP/CRM)</label>
                                    <input
                                        type="text"
                                        value={formData.professionalRegister}
                                        onChange={e => setFormData(prev => ({ ...prev, professionalRegister: e.target.value }))}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-500"
                                        placeholder="Ex: CRP 06/12345"
                                    />
                                </div>
                            </div>

                            {/* Senha */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">
                                    {editingUser ? 'Nova Senha (deixe em branco para manter)' : 'Senha/PIN *'}
                                </label>
                                <input
                                    type="password"
                                    value={formData.pin}
                                    onChange={e => setFormData(prev => ({ ...prev, pin: e.target.value }))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-500"
                                    placeholder={editingUser ? '••••••••' : 'Mínimo 4 caracteres'}
                                    required={!editingUser}
                                    minLength={editingUser ? 0 : 4}
                                />
                            </div>

                            {/* Cor */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Cor na Agenda</label>
                                <div className="flex gap-2 flex-wrap">
                                    {COLORS.map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, color }))}
                                            className={`w-8 h-8 rounded-full transition-transform ${formData.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110' : 'hover:scale-110'
                                                }`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                            >
                                <CheckIcon className="w-5 h-5" />
                                {editingUser ? 'Salvar Alterações' : 'Criar Usuário'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
