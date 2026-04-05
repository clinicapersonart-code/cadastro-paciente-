import React, { useMemo, useState } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';

interface ManualItem {
  id: string;
  paciente: string;
  valorSessao?: number;
  sessoes?: number;
}

interface CompetenciaManual {
  competencia: string; // YYYY-MM
  mesRecebimento: string; // YYYY-MM
  itens: ManualItem[];
}

type Store = Record<string, Record<string, CompetenciaManual>>;

interface ConvenioManualLancamentosProps {
  convenioName: string;
}

const monthNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const money = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const ConvenioManualLancamentos: React.FC<ConvenioManualLancamentosProps> = ({ convenioName }) => {
  const [store, setStore] = useLocalStorage<Store>('personart.convenios.manual.lancamentos.v1', {});
  const [competencia, setCompetencia] = useState(monthNow());

  const entry = useMemo<CompetenciaManual>(() => {
    return (
      store[convenioName]?.[competencia] || {
        competencia,
        mesRecebimento: competencia,
        itens: []
      }
    );
  }, [store, convenioName, competencia]);

  const saveEntry = (next: CompetenciaManual) => {
    setStore((prev) => ({
      ...prev,
      [convenioName]: {
        ...(prev[convenioName] || {}),
        [competencia]: next
      }
    }));
  };

  const addItem = () => {
    const id = `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    saveEntry({ ...entry, itens: [...entry.itens, { id, paciente: '', valorSessao: undefined, sessoes: undefined }] });
  };

  const updateItem = (id: string, patch: Partial<ManualItem>) => {
    saveEntry({
      ...entry,
      itens: entry.itens.map((it) => (it.id === id ? { ...it, ...patch } : it))
    });
  };

  const removeItem = (id: string) => {
    saveEntry({ ...entry, itens: entry.itens.filter((it) => it.id !== id) });
  };

  const totalGeral = useMemo(
    () => entry.itens.reduce((acc, it) => acc + (it.valorSessao || 0) * (it.sessoes || 0), 0),
    [entry.itens]
  );

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-4">
      <div>
        <h4 className="text-white font-bold text-lg">{convenioName} • Lançamento manual</h4>
        <p className="text-slate-400 text-sm">Preencha paciente, valor por sessão, número de sessões e total.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Mês de competência</label>
          <input
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white w-full"
          />
        </div>
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Mês de recebimento</label>
          <input
            type="month"
            value={entry.mesRecebimento}
            onChange={(e) => saveEntry({ ...entry, mesRecebimento: e.target.value })}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white w-full"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-300">
            <tr>
              <th className="text-left p-2">Paciente</th>
              <th className="text-right p-2">Valor/sessão</th>
              <th className="text-right p-2">Nº sessões</th>
              <th className="text-right p-2">Total</th>
              <th className="text-right p-2">Ação</th>
            </tr>
          </thead>
          <tbody>
            {entry.itens.map((it) => {
              const total = (it.valorSessao || 0) * (it.sessoes || 0);
              return (
                <tr key={it.id} className="border-t border-slate-800 text-slate-100">
                  <td className="p-2">
                    <input
                      value={it.paciente}
                      onChange={(e) => updateItem(it.id, { paciente: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                      placeholder="Nome do paciente"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={typeof it.valorSessao === 'number' ? it.valorSessao : ''}
                      onChange={(e) => updateItem(it.id, { valorSessao: e.target.value === '' ? undefined : Number(e.target.value) })}
                      className="w-full text-right bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={typeof it.sessoes === 'number' ? it.sessoes : ''}
                      onChange={(e) => updateItem(it.id, { sessoes: e.target.value === '' ? undefined : Number(e.target.value) })}
                      className="w-full text-right bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                    />
                  </td>
                  <td className="p-2 text-right text-cyan-300 font-semibold">{money(total)}</td>
                  <td className="p-2 text-right">
                    <button onClick={() => removeItem(it.id)} className="text-red-400 hover:text-red-300">Remover</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center">
        <button onClick={addItem} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-lg">
          + Adicionar linha
        </button>
        <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
          <span className="text-slate-400 text-xs mr-2">Total da competência:</span>
          <span className="text-cyan-300 font-bold">R$ {money(totalGeral)}</span>
        </div>
      </div>
    </div>
  );
};
