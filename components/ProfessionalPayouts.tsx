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

export interface ProfessionalPaymentGuideRow {
  professional: string;
  patientName: string;
  convenio: string;
  competencia: string;
  mesPagamento: string;
  sessoes: number;
  valorRecebido: number;
  descontoRate: number;
  valorDesconto: number;
  valorRepasse: number;
}

interface BuildProfessionalPaymentGuideRowsInput {
  patients: Patient[];
  mesPagamento: string;
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

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

export const getProfessionalDiscountRate = (professional: string, convenio: string): number => {
  const professionalKey = normalizePatientName(professional);
  const convenioKey = normalizePatientName(convenio);

  if (professionalKey.includes('simone') || professionalKey.includes('geovana')) return 0.18;

  const lowerDiscountProfessionals = ['bruno', 'stephanie', 'janaina', 'soraia'];
  if (lowerDiscountProfessionals.some((name) => professionalKey.includes(name))) {
    return convenioKey.includes('funserv') ? 0.11 : 0.06;
  }

  return 0.25;
};

const buildGuideRow = ({
  professional,
  patientName,
  convenio,
  competencia,
  mesPagamento,
  sessoes,
  valorRecebido,
}: Omit<ProfessionalPaymentGuideRow, 'descontoRate' | 'valorDesconto' | 'valorRepasse'>): ProfessionalPaymentGuideRow => {
  const descontoRate = getProfessionalDiscountRate(professional, convenio);
  const valorDesconto = roundMoney(valorRecebido * descontoRate);
  const valorRepasse = roundMoney(valorRecebido - valorDesconto);

  return {
    professional,
    patientName,
    convenio,
    competencia,
    mesPagamento,
    sessoes,
    valorRecebido: roundMoney(valorRecebido),
    descontoRate,
    valorDesconto,
    valorRepasse,
  };
};

const summarizeRecebimentoByPatient = (itens: Array<{ nome: string; valorProcessado: number; valorDiferenca: number }> = []) => {
  const map = new Map<string, { nome: string; sessoes: number; liquido: number }>();
  itens.forEach((item) => {
    const key = normalizePatientName(item.nome);
    const curr = map.get(key) || { nome: item.nome, sessoes: 0, liquido: 0 };
    const glosa = item.valorDiferenca < 0 ? item.valorDiferenca : 0;
    curr.sessoes += 1;
    curr.liquido += item.valorProcessado + glosa;
    map.set(key, curr);
  });
  return Array.from(map.values());
};

export const buildProfessionalPaymentGuideRows = ({
  patients,
  mesPagamento,
  funservCompetencias = {},
  manualLancamentos = {},
}: BuildProfessionalPaymentGuideRowsInput): ProfessionalPaymentGuideRow[] => {
  const rows: ProfessionalPaymentGuideRow[] = [];

  Object.values(funservCompetencias).forEach((entry) => {
    if (!entry?.recebimento) return;
    const expectedPaymentMonth = addMonths(entry.competencia, 2);
    if (expectedPaymentMonth !== mesPagamento) return;

    summarizeRecebimentoByPatient(entry.recebimento.itens).forEach((item) => {
      const patient = findPatientByImportedName(patients, item.nome);
      const professional = firstProfessional(patient);
      rows.push(buildGuideRow({
        professional,
        patientName: patient?.nome || item.nome,
        convenio: 'Funserv',
        competencia: entry.competencia,
        mesPagamento,
        sessoes: item.sessoes,
        valorRecebido: item.liquido,
      }));
    });
  });

  Object.entries(manualLancamentos).forEach(([convenioName, competencias]) => {
    Object.values(competencias || {}).forEach((entry) => {
      if (entry.mesRecebimento !== mesPagamento) return;

      entry.itens.forEach((item) => {
        const sessoes = item.sessoes || 0;
        const valorSessao = item.valorSessao || 0;
        if (!item.paciente || sessoes <= 0 || valorSessao <= 0) return;

        const patient = findPatientByImportedName(patients, item.paciente);
        const professional = firstProfessional(patient);
        rows.push(buildGuideRow({
          professional,
          patientName: patient?.nome || item.paciente,
          convenio: convenioName,
          competencia: entry.competencia,
          mesPagamento: entry.mesRecebimento,
          sessoes,
          valorRecebido: valorSessao * sessoes,
        }));
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

export const buildProfessionalPaymentGuideMessage = (
  professional: string,
  rows: ProfessionalPaymentGuideRow[],
  mesPagamento: string,
  generatedAt: string = new Date().toISOString()
): string => {
  const filtered = rows.filter((row) => normalize(row.professional) === normalize(professional));
  const generatedDate = new Date(generatedAt).toLocaleDateString('pt-BR');

  if (!professional) return 'Selecione um profissional para gerar a guia de pagamento.';
  if (filtered.length === 0) {
    return `Guia de pagamento — ${professional}\nMês de pagamento: ${formatCompetenciaLabel(mesPagamento)}\nAtualizado em ${generatedDate}\n\nNenhum pagamento encontrado para este profissional neste mês.`;
  }

  const grouped = new Map<string, ProfessionalPaymentGuideRow[]>();
  filtered.forEach((row) => {
    const key = `${row.convenio}|${row.competencia}`;
    const curr = grouped.get(key) || [];
    curr.push(row);
    grouped.set(key, curr);
  });

  const lines: string[] = [
    `Guia de pagamento — ${professional}`,
    `Mês de pagamento: ${formatCompetenciaLabel(mesPagamento)}`,
    `Atualizado em ${generatedDate}`,
    '',
  ];

  Array.from(grouped.entries()).forEach(([key, group], index) => {
    const [convenio, competencia] = key.split('|');
    if (index > 0) lines.push('');
    lines.push(`${convenio} • Competência ${formatCompetenciaLabel(competencia)}`);

    group.forEach((row) => {
      const descontoPercent = Math.round(row.descontoRate * 100);
      lines.push(`- ${row.patientName}: ${row.sessoes} sessão(ões) • recebido R$ ${formatCurrencyBR(row.valorRecebido)} • desconto ${descontoPercent}% • repasse R$ ${formatCurrencyBR(row.valorRepasse)}`);
    });
  });

  const totalRecebido = filtered.reduce((acc, row) => acc + row.valorRecebido, 0);
  const totalDescontos = filtered.reduce((acc, row) => acc + row.valorDesconto, 0);
  const totalRepasse = filtered.reduce((acc, row) => acc + row.valorRepasse, 0);
  lines.push('');
  lines.push(`Total recebido: R$ ${formatCurrencyBR(totalRecebido)}`);
  lines.push(`Total descontos: R$ ${formatCurrencyBR(totalDescontos)}`);
  lines.push(`Total repasse: R$ ${formatCurrencyBR(totalRepasse)}`);

  return lines.join('\n');
};


export interface ProfessionalClosingControlRow {
  professional: string;
  patientName: string;
  convenio: string;
  competencia: string;
  previsaoPagamento: string;
  status: 'Aguardando pagamento' | 'Recebido/guia';
  sessoesEnviadas: number;
  sessoesPagas: number;
  valorFaturado?: number;
  valorRecebido: number;
  valorRepasse: number;
}

interface BuildProfessionalClosingControlRowsInput {
  patients: Patient[];
  mesReferencia: string;
  funservCompetencias?: FunservBillingShareStore;
  manualLancamentos?: ManualBillingShareStore;
}

export interface ProfessionalClosingControlSummary {
  professional: string;
  sentSessions: number;
  awaitingSessions: number;
  paidSessions: number;
  estimatedBilled: number;
  confirmedReceived: number;
  confirmedPayout: number;
}

export const buildProfessionalClosingControlRows = ({
  patients,
  mesReferencia,
  funservCompetencias = {},
  manualLancamentos = {},
}: BuildProfessionalClosingControlRowsInput): ProfessionalClosingControlRow[] => {
  const rows: ProfessionalClosingControlRow[] = [];

  Object.values(funservCompetencias).forEach((entry) => {
    if (!entry?.faturamento) return;
    const previsaoPagamento = addMonths(entry.competencia, 2);
    const recebimentos = new Map(
      summarizeRecebimentoByPatient(entry.recebimento?.itens).map((item) => [normalizePatientName(item.nome), item])
    );

    entry.faturamento.porPaciente.forEach((item) => {
      const patient = findPatientByImportedName(patients, item.nome);
      const professional = firstProfessional(patient);
      const recebimento = recebimentos.get(normalizePatientName(item.nome));
      const valorRecebido = roundMoney(recebimento?.liquido || 0);
      const paidRow = !!recebimento;
      const payout = paidRow
        ? buildGuideRow({
          professional,
          patientName: patient?.nome || item.nome,
          convenio: 'Funserv',
          competencia: entry.competencia,
          mesPagamento: previsaoPagamento,
          sessoes: recebimento.sessoes,
          valorRecebido,
        }).valorRepasse
        : 0;

      rows.push({
        professional,
        patientName: patient?.nome || item.nome,
        convenio: 'Funserv',
        competencia: entry.competencia,
        previsaoPagamento,
        status: paidRow ? 'Recebido/guia' : 'Aguardando pagamento',
        sessoesEnviadas: item.sessoes,
        sessoesPagas: recebimento?.sessoes || 0,
        valorRecebido,
        valorRepasse: payout,
      });
    });
  });

  Object.entries(manualLancamentos).forEach(([convenioName, competencias]) => {
    Object.values(competencias || {}).forEach((entry) => {
      entry.itens.forEach((item) => {
        const sessoes = item.sessoes || 0;
        const valorSessao = item.valorSessao || 0;
        if (!item.paciente || sessoes <= 0) return;

        const patient = findPatientByImportedName(patients, item.paciente);
        const professional = firstProfessional(patient);
        const valorFaturado = roundMoney(valorSessao * sessoes);
        const paidRow = entry.mesRecebimento <= mesReferencia && valorFaturado > 0;
        const payout = paidRow
          ? buildGuideRow({
            professional,
            patientName: patient?.nome || item.paciente,
            convenio: convenioName,
            competencia: entry.competencia,
            mesPagamento: entry.mesRecebimento,
            sessoes,
            valorRecebido: valorFaturado,
          }).valorRepasse
          : 0;

        rows.push({
          professional,
          patientName: patient?.nome || item.paciente,
          convenio: convenioName,
          competencia: entry.competencia,
          previsaoPagamento: entry.mesRecebimento,
          status: paidRow ? 'Recebido/guia' : 'Aguardando pagamento',
          sessoesEnviadas: sessoes,
          sessoesPagas: paidRow ? sessoes : 0,
          valorFaturado,
          valorRecebido: paidRow ? valorFaturado : 0,
          valorRepasse: payout,
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

export const summarizeProfessionalClosingControl = (
  rows: ProfessionalClosingControlRow[],
  professional: string
): ProfessionalClosingControlSummary => {
  const filtered = rows.filter((row) => normalize(row.professional) === normalize(professional));
  return {
    professional,
    sentSessions: filtered.reduce((acc, row) => acc + row.sessoesEnviadas, 0),
    awaitingSessions: filtered.reduce((acc, row) => acc + Math.max(row.sessoesEnviadas - row.sessoesPagas, 0), 0),
    paidSessions: filtered.reduce((acc, row) => acc + row.sessoesPagas, 0),
    estimatedBilled: roundMoney(filtered.reduce((acc, row) => acc + (row.valorFaturado || 0), 0)),
    confirmedReceived: roundMoney(filtered.reduce((acc, row) => acc + row.valorRecebido, 0)),
    confirmedPayout: roundMoney(filtered.reduce((acc, row) => acc + row.valorRepasse, 0)),
  };
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

  const paymentGuideRows = useMemo(
    () => buildProfessionalPaymentGuideRows({
      patients,
      mesPagamento: selectedMesRecebimento,
      funservCompetencias,
      manualLancamentos,
    }),
    [patients, selectedMesRecebimento, funservCompetencias, manualLancamentos]
  );

  const closingControlRows = useMemo(
    () => buildProfessionalClosingControlRows({
      patients,
      mesReferencia: selectedMesRecebimento,
      funservCompetencias,
      manualLancamentos,
    }),
    [patients, selectedMesRecebimento, funservCompetencias, manualLancamentos]
  );

  const closingControlSummaries = useMemo(() => {
    const professionalsSet = new Set(closingControlRows.map((row) => row.professional).filter(Boolean));
    return Array.from(professionalsSet)
      .sort((a, b) => a.localeCompare(b))
      .map((professional) => summarizeProfessionalClosingControl(closingControlRows, professional));
  }, [closingControlRows]);

  const shareProfessionals = useMemo(() => {
    const set = new Set(paymentGuideRows.map((row) => row.professional).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [paymentGuideRows]);

  const effectiveShareProfessional =
    shareProfessional ||
    shareProfessionals.find((name) => normalize(name) === normalize('Bruno Alexandre')) ||
    shareProfessionals[0] ||
    '';

  const professionalShareRows = useMemo(
    () => paymentGuideRows.filter((row) => normalize(row.professional) === normalize(effectiveShareProfessional)),
    [paymentGuideRows, effectiveShareProfessional]
  );

  const professionalShareMessage = useMemo(
    () => buildProfessionalPaymentGuideMessage(effectiveShareProfessional, paymentGuideRows, selectedMesRecebimento),
    [effectiveShareProfessional, paymentGuideRows, selectedMesRecebimento]
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
        <div>
          <h3 className="text-white font-bold text-lg">Controle interno de fechamento por profissional</h3>
          <p className="text-slate-400 text-sm">
            Visão só da clínica: mostra o que foi enviado, o que está aguardando pagamento e o que já entrou na guia/recebimento. Não gera mensagem para profissional.
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Referência de pagamento: {formatCompetenciaLabel(selectedMesRecebimento)}</p>
        </div>

        {closingControlSummaries.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum fechamento lançado ainda para controle interno.</p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {closingControlSummaries.map((summaryItem) => {
              const detailRows = closingControlRows.filter((row) => normalize(row.professional) === normalize(summaryItem.professional));
              return (
                <div key={summaryItem.professional} className="bg-slate-900/70 border border-slate-700 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-white font-bold">{summaryItem.professional}</h4>
                      <p className="text-[11px] text-slate-500">{detailRows.length} lançamento(s) de fechamento</p>
                    </div>
                    <span className="text-[11px] rounded-full bg-slate-800 border border-slate-700 px-2 py-1 text-slate-300">Interno</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                    <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
                      <div className="text-slate-500">Enviado</div>
                      <div className="text-lg font-bold text-sky-300">{summaryItem.sentSessions}</div>
                    </div>
                    <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
                      <div className="text-slate-500">Aguardando</div>
                      <div className="text-lg font-bold text-amber-300">{summaryItem.awaitingSessions}</div>
                    </div>
                    <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
                      <div className="text-slate-500">Pago/guia</div>
                      <div className="text-lg font-bold text-emerald-300">{summaryItem.paidSessions}</div>
                    </div>
                    <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
                      <div className="text-slate-500">Faturado estimado</div>
                      <div className="font-bold text-slate-100">R$ {formatCurrencyBR(summaryItem.estimatedBilled)}</div>
                    </div>
                    <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
                      <div className="text-slate-500">Recebido</div>
                      <div className="font-bold text-cyan-300">R$ {formatCurrencyBR(summaryItem.confirmedReceived)}</div>
                    </div>
                    <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
                      <div className="text-slate-500">Repasse</div>
                      <div className="font-bold text-emerald-300">R$ {formatCurrencyBR(summaryItem.confirmedPayout)}</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-950 text-slate-400">
                        <tr>
                          <th className="text-left p-2">Convênio</th>
                          <th className="text-left p-2">Competência</th>
                          <th className="text-left p-2">Paciente</th>
                          <th className="text-right p-2">Env.</th>
                          <th className="text-right p-2">Pago</th>
                          <th className="text-left p-2">Previsão</th>
                          <th className="text-left p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailRows.map((row, idx) => (
                          <tr key={`${summaryItem.professional}-${row.convenio}-${row.competencia}-${row.patientName}-${idx}`} className="border-t border-slate-800 text-slate-200">
                            <td className="p-2">{row.convenio}</td>
                            <td className="p-2">{row.competencia}</td>
                            <td className="p-2">{row.patientName}</td>
                            <td className="p-2 text-right text-sky-300">{row.sessoesEnviadas}</td>
                            <td className="p-2 text-right text-emerald-300">{row.sessoesPagas}</td>
                            <td className="p-2">{row.previsaoPagamento}</td>
                            <td className={`p-2 ${row.status === 'Recebido/guia' ? 'text-emerald-300' : 'text-amber-300'}`}>{row.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <h3 className="text-white font-bold text-lg">Compartilhar guia de pagamento com profissional</h3>
            <p className="text-slate-400 text-sm">
              Monta a mensagem só quando houver valor recebido/guia de pagamento no mês selecionado, juntando Funserv e demais convênios com os descontos de repasse da clínica.
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Teste inicial: selecione Bruno Alexandre; a guia trará os pacientes cujo cadastro está vinculado a ele.</p>
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
            <div className="text-xs text-slate-400">Pacientes na guia</div>
            <div className="text-2xl font-bold text-white">{new Set(professionalShareRows.map((row) => row.patientName)).size}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-3">
            <div className="text-xs text-slate-400">Sessões pagas</div>
            <div className="text-2xl font-bold text-sky-300">{professionalShareRows.reduce((acc, row) => acc + row.sessoes, 0)}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-3">
            <div className="text-xs text-slate-400">Total repasse</div>
            <div className="text-2xl font-bold text-emerald-300">R$ {formatCurrencyBR(professionalShareRows.reduce((acc, row) => acc + row.valorRepasse, 0))}</div>
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