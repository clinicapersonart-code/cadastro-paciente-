import React, { useMemo, useState } from 'react';
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
}

const normalize = (s?: string) => (s || '').trim().toLowerCase();

const formatCurrencyBR = (value: number) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const monthNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const addMonths = (competencia: string, months: number): string => {
  const [y, m] = competencia.split('-').map(Number);
  if (!y || !m) return '';
  const d = new Date(y, m - 1 + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};


const formatInputDateBR = (raw?: string): string => {
  if (!raw) return '-';
  if (raw === 'manual') return 'manual';
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

const formatCompetenciaLabel = (comp: string): string => {
  const [y, m] = comp.split('-');
  if (!y || !m) return comp;
  const date = new Date(Number(y), Number(m) - 1, 1);
  return `${date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} (${comp})`;
};

export interface FunservBillingShareStore {
  [competencia: string]: {
    competencia: string;
    faturamento?: {
      fileName: string;
      importedAt: string;
      dataFechamentoEnvio?: string;
      totalContas: number;
      porPaciente: Array<{ nome: string; sessoes: number }>;
      itens: unknown[];
    };
    recebimento?: {
      itens: Array<{ nome: string; valorProcessado: number; valorDiferenca: number }>;
    };
  };
}

export interface ManualBillingShareStore {
  [convenioName: string]: {
    [competencia: string]: {
      competencia: string;
      mesRecebimento: string;
      itens: Array<{ id: string; paciente: string; valorSessao?: number; sessoes?: number }>;
    };
  };
}

export interface ProfessionalBillingShareRow {
  professional: string;
  patientName: string;
  convenio: string;
  competencia: string;
  fechamentoEnvio: string;
  previsaoPagamento: string;
  sessoesEnviadas: number;
  valorFaturado?: number;
  recebidoProcessado?: number;
  glosa?: number;
  liquidoRecebido?: number;
  status: 'Aguardando recebimento' | 'Recebido/confirmado';
}

interface BuildProfessionalBillingShareRowsInput {
  patients: Patient[];
  funservCompetencias?: FunservBillingShareStore;
  manualLancamentos?: ManualBillingShareStore;
}

const normalizePatientName = (name?: string): string =>
  normalize(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const findPatientByImportedName = (patients: Patient[], importedName: string): Patient | undefined => {
  const importedKey = normalizePatientName(importedName);
  if (!importedKey) return undefined;

  return patients.find((patient) => normalizePatientName(patient.nome) === importedKey)
    || patients.find((patient) => {
      const patientKey = normalizePatientName(patient.nome);
      return patientKey.length > 4 && (patientKey.includes(importedKey) || importedKey.includes(patientKey));
    });
};

const firstProfessional = (patient?: Patient): string => patient?.profissionais?.[0] || 'Sem profissional vinculado';

const summarizeRecebimentoByPatient = (itens: Array<{ nome: string; valorProcessado: number; valorDiferenca: number }> = []) => {
  const map = new Map<string, { processado: number; glosa: number; liquido: number }>();
  itens.forEach((item) => {
    const key = normalizePatientName(item.nome);
    const curr = map.get(key) || { processado: 0, glosa: 0, liquido: 0 };
    const glosa = item.valorDiferenca < 0 ? item.valorDiferenca : 0;
    curr.processado += item.valorProcessado;
    curr.glosa += glosa;
    curr.liquido += item.valorProcessado + glosa;
    map.set(key, curr);
  });
  return map;
};

export const buildProfessionalBillingShareRows = ({
  patients,
  funservCompetencias = {},
  manualLancamentos = {},
}: BuildProfessionalBillingShareRowsInput): ProfessionalBillingShareRow[] => {
  const rows: ProfessionalBillingShareRow[] = [];

  Object.values(funservCompetencias).forEach((entry) => {
    if (!entry?.faturamento) return;
    const recebimentoPorPaciente = summarizeRecebimentoByPatient(entry.recebimento?.itens);

    entry.faturamento.porPaciente.forEach((item) => {
      const patient = findPatientByImportedName(patients, item.nome);
      const recebimento = recebimentoPorPaciente.get(normalizePatientName(item.nome));

      rows.push({
        professional: firstProfessional(patient),
        patientName: patient?.nome || item.nome,
        convenio: patient?.convenio || 'Funserv',
        competencia: entry.competencia,
        fechamentoEnvio: entry.faturamento?.dataFechamentoEnvio || 'manual',
        previsaoPagamento: addMonths(entry.competencia, 2),
        sessoesEnviadas: item.sessoes,
        recebidoProcessado: recebimento?.processado,
        glosa: recebimento?.glosa,
        liquidoRecebido: recebimento?.liquido,
        status: recebimento ? 'Recebido/confirmado' : 'Aguardando recebimento',
      });
    });
  });

  Object.entries(manualLancamentos).forEach(([convenioName, competencias]) => {
    Object.values(competencias || {}).forEach((entry) => {
      entry.itens.forEach((item) => {
        const sessoes = item.sessoes || 0;
        if (!item.paciente || sessoes <= 0) return;

        const patient = findPatientByImportedName(patients, item.paciente);
        const valorFaturado = typeof item.valorSessao === 'number' ? item.valorSessao * sessoes : undefined;

        rows.push({
          professional: firstProfessional(patient),
          patientName: patient?.nome || item.paciente,
          convenio: convenioName,
          competencia: entry.competencia,
          fechamentoEnvio: 'manual',
          previsaoPagamento: entry.mesRecebimento,
          sessoesEnviadas: sessoes,
          valorFaturado,
          status: 'Aguardando recebimento',
        });
      });
    });
  });

  return rows.sort((a, b) =>
    a.professional.localeCompare(b.professional)
    || a.convenio.localeCompare(b.convenio)
    || a.competencia.localeCompare(b.competencia)
    || a.patientName.localeCompare(b.patientName)
  );
};

export const buildProfessionalBillingShareMessage = (
  professional: string,
  rows: ProfessionalBillingShareRow[],
  generatedAt: string = new Date().toISOString()
): string => {
  const filtered = rows.filter((row) => normalize(row.professional) === normalize(professional));
  const generatedDate = new Date(generatedAt).toLocaleDateString('pt-BR');

  if (!professional) return 'Selecione um profissional para gerar a mensagem.';
  if (filtered.length === 0) {
    return `Fechamento de convênios — ${professional}\nAtualizado em ${generatedDate}\n\nNenhum fechamento encontrado para este profissional.`;
  }

  const grouped = new Map<string, ProfessionalBillingShareRow[]>();
  filtered.forEach((row) => {
    const key = `${row.convenio}|${row.competencia}|${row.fechamentoEnvio}|${row.previsaoPagamento}|${row.status}`;
    const curr = grouped.get(key) || [];
    curr.push(row);
    grouped.set(key, curr);
  });

  const lines: string[] = [
    `Fechamento de convênios — ${professional}`,
    `Atualizado em ${generatedDate}`,
    '',
  ];

  Array.from(grouped.entries()).forEach(([key, group], index) => {
    const [convenio, competencia, fechamentoEnvio, previsaoPagamento, status] = key.split('|');
    if (index > 0) lines.push('');
    lines.push(`${convenio} • Competência ${formatCompetenciaLabel(competencia)}`);
    lines.push(`Fechado/enviado em: ${formatInputDateBR(fechamentoEnvio)}`);
    lines.push(`Previsão de pagamento: ${formatCompetenciaLabel(previsaoPagamento)}`);
    lines.push(`Status: ${status}`);

    group.forEach((row) => {
      const valuePart = typeof row.valorFaturado === 'number' ? ` • faturado R$ ${formatCurrencyBR(row.valorFaturado)}` : '';
      const receivedPart = typeof row.liquidoRecebido === 'number' ? ` • recebido líquido R$ ${formatCurrencyBR(row.liquidoRecebido)}` : '';
      lines.push(`- ${row.patientName}: ${row.sessoesEnviadas} sessão(ões) enviada(s)${valuePart}${receivedPart}`);
    });
  });

  const totalSessions = filtered.reduce((acc, row) => acc + row.sessoesEnviadas, 0);
  const totalBilled = filtered.reduce((acc, row) => acc + (row.valorFaturado || 0), 0);
  lines.push('');
  lines.push(`Total enviado: ${totalSessions} sessão(ões)${totalBilled > 0 ? ` • faturado R$ ${formatCurrencyBR(totalBilled)}` : ''}`);

  return lines.join('\n');
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
  const [selectedMesRecebimento, setSelectedMesRecebimento] = useState(monthNow());
  const [shareProfessional, setShareProfessional] = useState('');
  const [shareFeedback, setShareFeedback] = useState('');
  const [funservCompetencias] = useLocalStorage<FunservBillingShareStore>('personart.funserv.competencias.v1', {});
  const [manualLancamentos] = useLocalStorage<ManualBillingShareStore>('personart.convenios.manual.lancamentos.v1', {});

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
          const competenciaAtendimento = toCompetencia(a.date);
          const mesRecebimentoPrevisto = addMonths(competenciaAtendimento, 2);
          return mesRecebimentoPrevisto === selectedMesRecebimento;
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
  }, [patients, convenios, appointments, convenioMap, selectedProfessional, selectedMesRecebimento]);

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

  const billingShareRows = useMemo(
    () => buildProfessionalBillingShareRows({ patients, funservCompetencias, manualLancamentos }),
    [patients, funservCompetencias, manualLancamentos]
  );

  const shareProfessionals = useMemo(() => {
    const set = new Set(billingShareRows.map((row) => row.professional).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [billingShareRows]);

  const effectiveShareProfessional =
    shareProfessional ||
    shareProfessionals.find((name) => normalize(name) === normalize('Bruno Alexandre')) ||
    shareProfessionals[0] ||
    '';

  const professionalShareRows = useMemo(
    () => billingShareRows.filter((row) => normalize(row.professional) === normalize(effectiveShareProfessional)),
    [billingShareRows, effectiveShareProfessional]
  );

  const professionalShareMessage = useMemo(
    () => buildProfessionalBillingShareMessage(effectiveShareProfessional, billingShareRows),
    [effectiveShareProfessional, billingShareRows]
  );

  const copyProfessionalShare = async () => {
    if (!effectiveShareProfessional) return;
    try {
      await navigator.clipboard.writeText(professionalShareMessage);
      setShareFeedback(`Mensagem de ${effectiveShareProfessional} copiada.`);
    } catch (_error) {
      setShareFeedback('Não consegui copiar automaticamente. Selecione e copie o texto abaixo.');
    }
  };

  const openWhatsAppShare = () => {
    if (!effectiveShareProfessional) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(professionalShareMessage)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <ChartBarIcon className="w-6 h-6 text-emerald-400" /> Repasses por Mês de Recebimento
            </h2>
            <p className="text-slate-400 text-sm">Cálculo por mês previsto de recebimento (competência + 2 meses).</p>
          </div>

          <div className="flex items-end gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Mês de recebimento</label>
              <input
                type="month"
                value={selectedMesRecebimento}
                onChange={(e) => setSelectedMesRecebimento(e.target.value)}
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

        <div className="overflow-x-auto rounded-xl border border-slate-700 mt-4">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-300">
              <tr>
                <th className="text-left p-2">Paciente</th>
                <th className="text-left p-2">Profissional</th>
                <th className="text-left p-2">Convênio</th>
                <th className="text-right p-2">Repasse/sessão</th>
                <th className="text-right p-2">Sessões</th>
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

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <h3 className="text-white font-bold text-lg">Compartilhar fechamento com profissional</h3>
            <p className="text-slate-400 text-sm">
              Bate o nome do paciente importado no faturamento com o cadastro do paciente e monta uma mensagem por profissional, com convênio, fechamento e previsão de pagamento.
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Use Bruno Alexandre para o primeiro teste quando ele aparecer na lista.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Profissional</label>
              <select
                value={effectiveShareProfessional}
                onChange={(e) => {
                  setShareProfessional(e.target.value);
                  setShareFeedback('');
                }}
                className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500 outline-none min-w-[220px]"
              >
                {!effectiveShareProfessional && <option value="">Selecione...</option>}
                {shareProfessionals.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <button
              onClick={copyProfessionalShare}
              disabled={!effectiveShareProfessional}
              className="px-3 py-2 rounded-lg text-sm font-semibold bg-sky-700 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white"
            >
              Copiar mensagem
            </button>
            <button
              onClick={openWhatsAppShare}
              disabled={!effectiveShareProfessional}
              className="px-3 py-2 rounded-lg text-sm font-semibold bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white"
            >
              Abrir WhatsApp
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-3">
            <div className="text-xs text-slate-400">Pacientes batidos</div>
            <div className="text-2xl font-bold text-white">{new Set(professionalShareRows.map((row) => row.patientName)).size}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-3">
            <div className="text-xs text-slate-400">Sessões enviadas</div>
            <div className="text-2xl font-bold text-sky-300">{professionalShareRows.reduce((acc, row) => acc + row.sessoesEnviadas, 0)}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-3">
            <div className="text-xs text-slate-400">Convênios no fechamento</div>
            <div className="text-2xl font-bold text-emerald-300">{new Set(professionalShareRows.map((row) => row.convenio)).size}</div>
          </div>
        </div>

        <textarea
          readOnly
          value={professionalShareMessage}
          className="w-full min-h-[220px] bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 whitespace-pre-wrap"
        />
        {shareFeedback && <p className="text-sm text-slate-300">{shareFeedback}</p>}
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <h3 className="text-white font-bold mb-3">Resumo por profissional ({selectedMesRecebimento})</h3>
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