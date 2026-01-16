
import React from 'react';
import { PreCadastro, Patient } from '../types';
import { CheckIcon, XIcon, InboxIcon, UserIcon, CalendarIcon } from './icons';

interface InboxProps {
    inbox: PreCadastro[];
    onApprove: (item: PreCadastro) => void;
    onDelete: (id: string) => void;
}

export const Inbox: React.FC<InboxProps> = ({ inbox, onApprove, onDelete }) => {
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('pt-BR');
        } catch {
            return dateStr;
        }
    };

    const formatDateTime = (dateStr: string) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleString('pt-BR');
        } catch {
            return dateStr;
        }
    };

    if (inbox.length === 0) {
        return (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
                <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <InboxIcon className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-400 mb-2">Caixa de Entrada Vazia</h3>
                <p className="text-slate-500 text-sm">Nenhum pré-cadastro pendente no momento.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-sky-900/30 p-2 rounded-lg">
                        <InboxIcon className="w-6 h-6 text-sky-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Caixa de Entrada</h2>
                        <p className="text-sm text-slate-400">{inbox.length} pré-cadastro(s) pendente(s)</p>
                    </div>
                </div>
            </div>

            <div className="grid gap-4">
                {inbox.map((item) => (
                    <div
                        key={item.id}
                        className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition"
                    >
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            {/* Info Principal */}
                            <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="bg-slate-700 p-2 rounded-full">
                                        <UserIcon className="w-5 h-5 text-slate-300" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg">{item.nome}</h3>
                                        <p className="text-xs text-slate-500">Enviado em {formatDateTime(item.dataEnvio)}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                    <div>
                                        <span className="text-slate-500 text-xs block">Nascimento</span>
                                        <span className="text-slate-300">{formatDate(item.nascimento)}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 text-xs block">Contato</span>
                                        <span className="text-slate-300">{item.contato || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 text-xs block">E-mail</span>
                                        <span className="text-slate-300">{item.email || '-'}</span>
                                    </div>
                                    {item.convenio && (
                                        <div>
                                            <span className="text-slate-500 text-xs block">Convênio</span>
                                            <span className="text-slate-300">{item.convenio}</span>
                                        </div>
                                    )}
                                    {item.carteirinha && (
                                        <div>
                                            <span className="text-slate-500 text-xs block">Carteirinha</span>
                                            <span className="text-slate-300">{item.carteirinha}</span>
                                        </div>
                                    )}
                                    {item.profissional && (
                                        <div>
                                            <span className="text-slate-500 text-xs block">Profissional</span>
                                            <span className="text-slate-300">{item.profissional}</span>
                                        </div>
                                    )}
                                    {item.responsavel && (
                                        <div className="col-span-2">
                                            <span className="text-slate-500 text-xs block">Responsável</span>
                                            <span className="text-slate-300">{item.responsavel}</span>
                                        </div>
                                    )}
                                    {item.endereco && (
                                        <div className="col-span-2">
                                            <span className="text-slate-500 text-xs block">Endereço</span>
                                            <span className="text-slate-300">{item.endereco}</span>
                                        </div>
                                    )}
                                    {item.origem && (
                                        <div>
                                            <span className="text-slate-500 text-xs block">Origem</span>
                                            <span className="text-sky-400 text-xs">{item.origem}</span>
                                        </div>
                                    )}
                                </div>

                                {item.agendamento?.data && (
                                    <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 mt-2">
                                        <div className="flex items-center gap-2 text-amber-400 text-xs font-medium mb-1">
                                            <CalendarIcon className="w-4 h-4" />
                                            Sugestão de Agendamento
                                        </div>
                                        <p className="text-slate-300 text-sm">
                                            {formatDate(item.agendamento.data)} às {item.agendamento.hora || '--:--'}
                                            <span className="text-slate-500"> • {item.agendamento.frequencia}</span>
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Ações */}
                            <div className="flex lg:flex-col gap-2">
                                <button
                                    onClick={() => onApprove(item)}
                                    className="flex-1 lg:flex-none bg-green-600 hover:bg-green-500 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                                >
                                    <CheckIcon className="w-4 h-4" />
                                    Aprovar
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm(`Excluir pré-cadastro de "${item.nome}"?`)) {
                                            onDelete(item.id);
                                        }
                                    }}
                                    className="flex-1 lg:flex-none bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                                >
                                    <XIcon className="w-4 h-4" />
                                    Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
