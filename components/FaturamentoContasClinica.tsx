import React, { useMemo } from 'react';
import { Appointment, ConvenioConfig, Patient } from '../types';

interface FaturamentoContasClinicaProps {
  appointments: Appointment[];
  convenios: ConvenioConfig[];
  patients: Patient[];
}

const normalize = (s?: string) => (s || '').trim().toLowerCase();
const money = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const FaturamentoContasClinica: React.FC<FaturamentoContasClinicaProps> = ({ appointments, convenios, patients }) => {
  const conveniosMap = useMemo(() => {
    const map = new Map<string, ConvenioConfig>();
    convenios.forEach((c) => map.set(normalize(c.name), c));
    return map;
  }, [convenios]);

  const patientMap = useMemo(() => {
    const map = new Map<string, Patient>();
    patients.forEach((p) => map.set(p.id, p));
    return map;
  }, [patients]);

  const rows = useMemo(() => {
    const grouped = new Map<string, { convenio: string; sessoes: number; cheio: number; repasse: number; liquido: number }>();

    appointments
      .filter((a) => a.status === 'Realizado')
      .forEach((a) => {
        const patient = patientMap.get(a.patientId);
        const convenioName = a.convenioName || patient?.convenio || 'Particular';
        const convenio = conveniosMap.get(normalize(convenioName));

        const cheio =
          typeof a.price === 'number'
            ? a.price
            : typeof convenio?.price === 'number'
              ? convenio.price
              : 0;

        const repasseUnit =
          typeof convenio?.payoutPrice === 'number'
            ? convenio.payoutPrice
            : typeof convenio?.price === 'number'
              ? Math.round(convenio.price * ((convenio.payoutPercent ?? 75) / 100) * 100) / 100
              : 0;

        const curr = grouped.get(convenioName) || { convenio: convenioName, sessoes: 0, cheio: 0, repasse: 0, liquido: 0 };
        curr.sessoes += 1;
        curr.cheio += cheio;
        curr.repasse += repasseUnit;
        curr.liquido = curr.cheio - curr.repasse;
        grouped.set(convenioName, curr);
      });

    return Array.from(grouped.values()).sort((a, b) => b.cheio - a.cheio);
  }, [appointments, conveniosMap, patientMap]);

  const totais = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.sessoes += r.sessoes;
        acc.cheio += r.cheio;
        acc.repasse += r.repasse;
        acc.liquido += r.liquido;
        return acc;
      },
      { sessoes: 0, cheio: 0, repasse: 0, liquido: 0 }
    );
  }, [rows]);

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-4">
      <div>
        <h3 className="text-xl font-bold text-white">Contas da Clínica</h3>
        <p className="text-xs text-slate-400">Resumo por convênio com base em sessões realizadas.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-300">
            <tr>
              <th className="text-left p-2">Convênio</th>
              <th className="text-right p-2">Sessões</th>
              <th className="text-right p-2">Faturamento bruto</th>
              <th className="text-right p-2">Repasse profissionais</th>
              <th className="text-right p-2">Resultado clínica</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.convenio} className="border-t border-slate-800 text-slate-100">
                <td className="p-2">{r.convenio}</td>
                <td className="p-2 text-right">{r.sessoes}</td>
                <td className="p-2 text-right text-emerald-300">{money(r.cheio)}</td>
                <td className="p-2 text-right text-amber-300">{money(r.repasse)}</td>
                <td className="p-2 text-right text-cyan-300 font-semibold">{money(r.liquido)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"><span className="text-xs text-slate-400">Sessões</span><div className="text-white font-bold">{totais.sessoes}</div></div>
        <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"><span className="text-xs text-slate-400">Bruto</span><div className="text-emerald-300 font-bold">{money(totais.cheio)}</div></div>
        <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"><span className="text-xs text-slate-400">Repasse</span><div className="text-amber-300 font-bold">{money(totais.repasse)}</div></div>
        <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"><span className="text-xs text-slate-400">Resultado</span><div className="text-cyan-300 font-bold">{money(totais.liquido)}</div></div>
      </div>
    </div>
  );
};
