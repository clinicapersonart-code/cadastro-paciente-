
import React from 'react';
import { Patient } from '../types';
import { EditIcon, TrashIcon } from './icons';

interface PatientTableProps {
    patients: Patient[];
    onEdit: (patient: Patient) => void;
    onDelete: (id: string) => void;
}

export const PatientTable: React.FC<PatientTableProps> = ({ patients, onEdit, onDelete }) => {

    const formatShortDate = (iso?: string) => {
        if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
        const date = new Date(iso + 'T00:00:00'); // To handle timezone issues
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = String(date.getFullYear()).slice(-2);
        return `${d}/${m}/${y}`;
    };
    
    return (
        <div className="overflow-auto border border-slate-700 rounded-2xl" style={{ maxHeight: '60vh' }}>
            <table className="w-full min-w-[1400px] text-sm text-left text-slate-300">
                <thead className="text-xs text-slate-400 uppercase bg-slate-800/80 sticky top-0 backdrop-blur-sm">
                    <tr>
                        <th scope="col" className="px-6 py-3">Paciente</th>
                        <th scope="col" className="px-6 py-3">Contato</th>
                        <th scope="col" className="px-6 py-3">E-mail</th>
                        <th scope="col" className="px-6 py-3">Nasc.</th>
                        <th scope="col" className="px-6 py-3">Faixa</th>
                        <th scope="col" className="px-6 py-3">Resp.</th>
                        <th scope="col" className="px-6 py-3">Convênio</th>
                        <th scope="col" className="px-6 py-3">Carteirinha</th>
                        <th scope="col" className="px-6 py-3">Profissionais</th>
                        <th scope="col" className="px-6 py-3">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {patients.map((p) => (
                        <tr key={p.id} className="bg-slate-900/50 border-b border-slate-800 hover:bg-slate-800/50 transition">
                            <th scope="row" className="px-6 py-4 font-medium text-white whitespace-nowrap">{p.nome}</th>
                            <td className="px-6 py-4 whitespace-nowrap">{p.contato || '-'}</td>
                            <td className="px-6 py-4 max-w-[150px] truncate" title={p.email}>{p.email || '-'}</td>
                            <td className="px-6 py-4">{formatShortDate(p.nascimento)}</td>
                            <td className="px-6 py-4">{p.faixa}</td>
                            <td className="px-6 py-4">{p.faixa === 'Criança' ? p.responsavel : '-'}</td>
                            <td className="px-6 py-4">{p.convenio}</td>
                            <td className="px-6 py-4">{p.carteirinha}</td>
                            <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-1">
                                    {p.profissionais.map(pro => <span key={pro} className="bg-slate-700 text-slate-300 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap">{pro}</span>)}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <button onClick={() => onEdit(p)} className="p-1 text-sky-400 hover:text-sky-300 transition" title="Editar"><EditIcon className="w-4 h-4" /></button>
                                    <button onClick={() => onDelete(p.id)} className="p-1 text-red-400 hover:text-red-300 transition" title="Excluir"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
