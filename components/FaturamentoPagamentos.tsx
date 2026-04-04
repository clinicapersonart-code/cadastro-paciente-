import React from 'react';
import { ConvenioConfig } from '../types';

interface FaturamentoPagamentosProps {
  convenios: ConvenioConfig[];
  setConvenios: React.Dispatch<React.SetStateAction<ConvenioConfig[]>>;
}

export const FaturamentoPagamentos: React.FC<FaturamentoPagamentosProps> = ({ convenios, setConvenios }) => {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-white">Pagamentos por Convênio</h3>
        <p className="text-xs text-slate-400">Preencha os valores de cada convênio (cheio, repasse, %, duração).</p>
      </div>

      <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
        {convenios.map((c) => (
          <div key={c.id} className="grid grid-cols-12 gap-2 items-center bg-slate-900/50 border border-slate-700 rounded-xl p-3">
            <div className="col-span-4">
              <label className="block text-[11px] text-slate-500 mb-1">Nome</label>
              <input
                value={c.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setConvenios((prev) => prev.map((x) => (x.id === c.id ? { ...x, name } : x)));
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[11px] text-slate-500 mb-1">% repasse</label>
              <select
                value={c.payoutPercent ?? 75}
                onChange={(e) => {
                  const payoutPercent = Number(e.target.value);
                  setConvenios((prev) =>
                    prev.map((x) => {
                      if (x.id !== c.id) return x;
                      const full = x.price;
                      const rep = typeof full === 'number' ? Math.round(full * (payoutPercent / 100) * 100) / 100 : x.payoutPrice;
                      return { ...x, payoutPercent, payoutPrice: rep };
                    })
                  );
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                {[50, 60, 65, 70, 75, 80, 85, 90].map((p) => (
                  <option key={p} value={p}>{p}%</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-[11px] text-slate-500 mb-1">Repasse (R$)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={typeof c.payoutPrice === 'number' ? c.payoutPrice : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  const payoutPrice = v === '' ? undefined : Number(v);
                  setConvenios((prev) => prev.map((x) => (x.id === c.id ? { ...x, payoutPrice } : x)));
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[11px] text-slate-500 mb-1">Cheio (R$)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={typeof c.price === 'number' ? c.price : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  const price = v === '' ? undefined : Number(v);
                  const pct = c.payoutPercent ?? 75;
                  const rep = typeof price === 'number' ? Math.round(price * (pct / 100) * 100) / 100 : undefined;
                  setConvenios((prev) => prev.map((x) => (x.id === c.id ? { ...x, price, payoutPrice: rep } : x)));
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="col-span-1">
              <label className="block text-[11px] text-slate-500 mb-1">Min</label>
              <select
                value={c.durationMin ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  const durationMin = v === '' ? undefined : Number(v);
                  setConvenios((prev) => prev.map((x) => (x.id === c.id ? { ...x, durationMin } : x)));
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white"
              >
                <option value="">—</option>
                {[15, 30, 45, 60, 75, 90].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="col-span-1 flex justify-end">
              <button
                onClick={() => {
                  if (!confirm(`Remover convênio "${c.name}"?`)) return;
                  setConvenios((prev) => prev.filter((x) => x.id !== c.id));
                }}
                className="p-2 text-slate-400 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => {
          const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          setConvenios((prev) => [...prev, { id, name: 'Novo Convênio', active: true, payoutPercent: 75, payoutPrice: undefined, price: undefined, durationMin: 45 }]);
        }}
        className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-lg"
      >
        + Novo convênio
      </button>
    </div>
  );
};
