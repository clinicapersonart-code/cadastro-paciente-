import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Appointment, ConvenioConfig, Patient } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
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
  autoConfirmed: boolean;
}

interface RepasseCompetenciaState {
  competencia: string; // YYYY-MM
  guideFileName?: string;
  importedAt?: string;
  paymentDate?: string;
  confirmedPatientNames: string[]; // nomes normalizados vindos da guia de recebimento
}

type RepasseStore = Record<string, RepasseCompetenciaState>;

const normalize = (s?: string) => (s || '').trim().toLowerCase();
const normalizeName = (s?: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const formatCurrencyBR = (value: number) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const monthNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const toCompetencia = (dateStr: string): string => {
  const txt = String(dateStr || '').trim();
  if (!txt) return '';

  // YYYY-MM-DD
  const iso = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;

  // DD/MM/YYYY
  const br = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}`;

  return '';
};

const parseBRNumber = (raw: unknown): number | null => {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const txt = String(raw).trim().replace(/\s/g, '').replace(/R\$/gi, '').replace(/\./g, '').replace(',', '.');
  if (!txt) return null;
  const n = Number(txt);
  return Number.isFinite(n) ? n : null;
};

const pickCol = (header: unknown[] | null, candidates: string[], fallback: number): number => {
  if (!header) return fallback;
  const lowered = header.map((v) => String(v ?? '').trim().toLowerCase());
  const idx = lowered.findIndex((cell) => candidates.some((c) => cell.includes(c)));
  return idx >= 0 ? idx : fallback;
};

const detectPagamentoDate = (rows: unknown[][]): string => {
  for (const row of rows.slice(0, 40)) {
    const txt = row.map((c) => String(c ?? '').trim()).join(' | ');
    if (/pagamento|pagto|processamento/i.test(txt)) {
      const m = txt.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (m?.[1]) return m[1];
    }
  }
  return '';
};

const extractPatientNamesFromRecebimentoSheet = (rows: unknown[][]): string[] => {
  if (!rows.length) return [];
  const header = rows[0] || null;
  const colNome = pickCol(header, ['beneficiário', 'beneficiario', 'nome'], 13);
  const colProc = pickCol(header, ['valor processado', 'processado'], 38);
  const colDiff = pickCol(header, ['valor diferença', 'valor diferenca', 'diferença', 'diferenca'], 43);

  const set = new Set<string>();

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const nome = String(row[colNome] ?? '').trim();
    if (!nome) continue;
    if (nome.toUpperCase().startsWith('[OUTROS]')) continue;

    const valorProcessado = parseBRNumber(row[colProc]) ?? 0;
    const valorDiferenca = parseBRNumber(row[colDiff]) ?? 0;
    if (valorProcessado === 0 && valorDiferenca === 0) continue;

    set.add(normalizeName(nome));
  }

  return Array.from(set);
};

export const ProfessionalPayouts: React.FC<ProfessionalPayoutsProps> = ({ patients, convenios, appointments }) => {
  const [selectedProfessional, setSelectedProfessional] = useState('');
  const [selectedCompetencia, setSelectedCompetencia] = useState(monthNow());
  const [message, setMessage] = useState('');
  const [repasseStore, setRepasseStore] = useLocalStorage<RepasseStore>('personart.repasse.competencias.v1', {});

  const monthState = repasseStore[selectedCompetencia] || {
    competencia: selectedCompetencia,
    confirmedPatientNames: []
  };

  const confirmedSet = useMemo(
    () => new Set((monthState.confirmedPatientNames || []).map((n) => normalizeName(n))),
    [monthState.confirmedPatientNames]
  );

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

        const totalPayout = realizedSessions * payoutPerSession;
        const autoConfirmed = confirmedSet.has(normalizeName(patient.nome));

        return {
          patientId: patient.id,
          patientName: patient.nome,
          profissional,
          convenio: convenioName,
          payoutPerSession,
          realizedSessions,
          totalPayout,
          autoConfirmed
        };
      })
      .filter((r) => r.realizedSessions > 0)
      .filter((r) => !selectedProfessional || normalize(r.profissional) === normalize(selectedProfessional))
      .sort((a, b) => a.profissional.localeCompare(b.profissional) || a.patientName.localeCompare(b.patientName));
  }, [patients, appointments, convenioMap, selectedProfessional, selectedCompetencia, confirmedSet]);

  const professionals = useMemo(() => {
    const set = new Set(rows.map((r) => r.profissional));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const summary = useMemo(() => {
    const byProfessional = new Map<string, { sessions: number; projected: number; confirmed: number }>();
    rows.forEach((r) => {
      const curr = byProfessional.get(r.profissional) || { sessions: 0, projected: 0, confirmed: 0 };
      curr.sessions += r.realizedSessions;
      curr.projected += r.totalPayout;
      if (r.autoConfirmed) curr.confirmed += r.totalPayout;
      byProfessional.set(r.profissional, curr);
    });

    return Array.from(byProfessional.entries())
      .map(([name, v]) => ({ name, ...v, pending: v.projected - v.confirmed }))
      .sort((a, b) => b.projected - a.projected);
  }, [rows]);

  const totals = useMemo(() => {
    const projected = rows.reduce((acc, r) => acc + r.totalPayout, 0);
    const confirmed = rows.reduce((acc, r) => acc + (r.autoConfirmed ? r.totalPayout : 0), 0);
    return { projected, confirmed, pending: projected - confirmed };
  }, [rows]);

  const importRecebimentoGuide = async (file: File) => {
    setMessage('');
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', raw: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rowsSheet = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];

      const nomes = extractPatientNamesFromRecebimentoSheet(rowsSheet);
      const pagamento = detectPagamentoDate(rowsSheet);

      setRepasseStore((prev) => ({
        ...prev,
        [selectedCompetencia]: {
          competencia: selectedCompetencia,
          guideFileName: file.name,
          importedAt: new Date().toISOString(),
          paymentDate: pagamento || prev[selectedCompetencia]?.paymentDate,
          confirmedPatientNames: nomes
        }
      }));

      setMessage(`Guia importada para ${selectedCompetencia}. ${nomes.length} pacientes reconhecidos automaticamente.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Falha ao importar guia de recebimento.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <ChartBarIcon className="w-6 h-6 text-emerald-400" /> Repasses por Competência
              </h2>
              <p className="text-slate-400 text-sm">
                Projeção pelo mês de atendimento. Confirmação automática após importar guia de recebimento (nome do paciente).
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Competência</label>
                <input
                  type="month"
                  value={selectedCompetencia}
                  onChange={(e) => setSelectedCompetencia(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <label className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer">
                <span>Importar guia recebimento (.xlsx)</span>
                <input
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importRecebimentoGuide(file);
                  }}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end gap-2 md:justify-between">
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

            <div className="text-xs text-slate-400">
              Guia: {monthState.guideFileName || '-'} • Data pagamento: {monthState.paymentDate || '-'}
            </div>
          </div>

          {message && <p className="text-sm text-slate-300">{message}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
            <span className="text-slate-400 text-xs mr-2">Projeção repasse ({selectedCompetencia}):</span>
            <span className="text-emerald-300 font-bold">{formatCurrencyBR(totals.projected)}</span>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
            <span className="text-slate-400 text-xs mr-2">Confirmado por guia:</span>
            <span className="text-cyan-300 font-bold">{formatCurrencyBR(totals.confirmed)}</span>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
            <span className="text-slate-400 text-xs mr-2">Pendente de confirmar:</span>
            <span className="text-amber-300 font-bold">{formatCurrencyBR(totals.pending)}</span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-300">
              <tr>
                <th className="text-left p-2">Paciente</th>
                <th className="text-left p-2">Profissional</th>
                <th className="text-left p-2">Convênio</th>
                <th className="text-right p-2">Repasse/sessão</th>
                <th className="text-right p-2">Sessões ({selectedCompetencia})</th>
                <th className="text-right p-2">Total projeção</th>
                <th className="text-left p-2">Status</th>
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
                  <td className="p-2">
                    {r.autoConfirmed ? (
                      <span className="text-emerald-300">Confirmado por guia</span>
                    ) : (
                      <span className="text-amber-300">Projeção (aguardando guia)</span>
                    )}
                  </td>
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
              <div className="text-emerald-300 font-bold">Projeção: R$ {formatCurrencyBR(s.projected)}</div>
              <div className="text-cyan-300 text-sm">Confirmado: R$ {formatCurrencyBR(s.confirmed)}</div>
              <div className="text-amber-300 text-sm">Pendente: R$ {formatCurrencyBR(s.pending)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
