import React, { useMemo, useState } from 'react';
import { Appointment, ConvenioConfig, Patient } from '../types';
import { ChartBarIcon } from './icons';

interface ProfessionalPayoutsProps {
  patients: Patient[];
  convenios: ConvenioConfig[];
  appointments: Appointment[];
}

interface PayoutRow {
  patientId: string;
  patientName: string;
  profissional: string;
  convenio: string;
  payoutPerSession: number;
  realizedSessions: number;
  totalPayout: number;
}

const normalize = (s?: string) => (s || '').trim().toLowerCase();

const formatCurrencyBR = (value: number) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const monthNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const toCompetencia = (dateStr: string): string => {
  const txt = String(dateStr || '').trim();
  if (!txt) return '';

  const iso = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;

  const br = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}`;

  return '';
};

export const ProfessionalPayouts: React.FC<ProfessionalPayoutsProps> = ({ patients, convenios, appointments }) => {
  const [selectedProfessional, setSelectedProfessional] = useState('');
  const [selectedCompetencia, setSelectedCompetencia] = useState(monthNow());

  const convenioMap = useMemo(() => {
    const map = new Map<string, ConvenioConfig>();
    convenios.forEach((c) => map.set(normalize(c.name), c));
    return map;
  }, [convenios]);

  const rows = useMemo<PayoutRow[]>(() => {
    return patients
      .filter((p) => (p.active ?? true))
      .map((patient) => {
        const profissional = patient.profissionais?.[0] || 'Sem profissional';
        const convenioName = patient.convenio || 'Particular';
        const convenio = convenioMap.get(normalize(convenioName));

        const payoutPerSession =
          typeof convenio?.payoutPrice === 'number'
            ? convenio.payoutPrice
            : typeof convenio?.price === 'number'
              ? Math.round((convenio.price * ((convenio.payoutPercent ?? 75) / 100)) * 100) / 100
              : 0;

        const realizedSessions = appointments.filter((a) => {
          if (a.status !== 'Realizado') return false;
          if (a.patientId !== patient.id) return false;
          if (normalize(a.profissional) !== normalize(profissional)) return false;
          return toCompetencia(a.date) === selectedCompetencia;
        }).length;

        return {
          patientId: patient.id,
          patientName: patient.nome,
          profissional,
          convenio: convenioName,
          payoutPerSession,
          realizedSessions,
          totalPayout: realizedSessions * payoutPerSession
        };
      })
      .filter((r) => r.realizedSessions > 0)
      .filter((r) => !selectedProfessional || normalize(r.profissional) === normalize(selectedProfessional))
      .sort((a, b) => a.profissional.localeCompare(b.profissional) || a.patientName.localeCompare(b.patientName));
  }, [patients, convenios, appointments, convenioMap, selectedProfessional, selectedCompetencia]);

  const professionals = useMemo(() => {
    const set = new Set(rows.map((r) => r.profissional));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const summary = useMemo(() => {
    const byProfessional = new Map<string, { sessions: number; total: number }>();
    rows.forEach((r) => {
      const curr = byProfessional.get(r.profissional) || { sessions: 0, total: 0 };
      curr.sessions += r.realizedSessions;
      curr.total += r.totalPayout;
      byProfessional.set(r.profissional, curr);
    });
    return Array.from(byProfessional.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const totalGeral = useMemo(() => rows.reduce((acc, r) => acc + r.totalPayout, 0), [rows]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <ChartBarIcon className="w-6 h-6 text-emerald-400" /> Repasses por Competência
            </h2>
            <p className="text-slate-400 text-sm">Projeção do repasse por mês de atendimento (sem guia de recebimento aqui).</p>
          </div>

          <div className="flex items-end gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Competência</label>
              <input
                type="month"
                value={selectedCompetencia}
                onChange={(e) => setSelectedCompetencia(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              />
            </div>

            <select
              value={selectedProfessional}
              onChange={(e) => setSelectedProfessional(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">Todos os profissionais</option>
              {professionals.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 flex justify-end">
          <span className="text-slate-400 text-xs mr-2">Total projeção ({selectedCompetencia}):</span>
          <span className="text-cyan-300 font-bold">{formatCurrencyBR(totalGeral)}</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-700 mt-4">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-300">
              <tr>
                <th className="text-left p-2">Paciente</th>
                <th className="text-left p-2">Profissional</th>
                <th className="text-left p-2">Convênio</th>
                <th className="text-right p-2">Repasse/sessão</th>
                <th className="text-right p-2">Sessões ({selectedCompetencia})</th>
                <th className="text-right p-2">Total projeção</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.patientId} className="border-t border-slate-800 text-slate-100">
                  <td className="p-2">{r.patientName}</td>
                  <td className="p-2">{r.profissional}</td>
                  <td className="p-2">{r.convenio}</td>
                  <td className="p-2 text-right text-emerald-300">{formatCurrencyBR(r.payoutPerSession)}</td>
                  <td className="p-2 text-right">{r.realizedSessions}</td>
                  <td className="p-2 text-right text-cyan-300 font-semibold">{formatCurrencyBR(r.totalPayout)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <h3 className="text-white font-bold mb-3">Resumo por profissional ({selectedCompetencia})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {summary.map((s) => (
            <div key={s.name} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 space-y-1">
              <div className="text-slate-200 font-semibold">{s.name}</div>
              <div className="text-xs text-slate-400">Sessões realizadas: {s.sessions}</div>
              <div className="text-emerald-300 font-bold">R$ {formatCurrencyBR(s.total)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
