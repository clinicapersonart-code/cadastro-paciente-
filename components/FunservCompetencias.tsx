import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import useLocalStorage from '../hooks/useLocalStorage';

interface FaturamentoItem {
  autorizacao: string;
  data: string;
  matricula: string;
  nome: string;
  lote: string;
}

interface RecebimentoItem {
  nome: string;
  data: string;
  valorProcessado: number;
  valorDiferenca: number;
}

interface CompetenciaData {
  competencia: string; // YYYY-MM
  faturamento?: {
    fileName: string;
    importedAt: string;
    periodoDetectado?: string;
    totalContas: number;
    porPaciente: Array<{ nome: string; sessoes: number }>;
    itens: FaturamentoItem[];
  };
  recebimento?: {
    fileName: string;
    importedAt: string;
    dataPagamento?: string;
    totalLinhas: number;
    totalProcessado: number;
    totalGlosa: number;
    totalFinal: number;
    itens: RecebimentoItem[];
  };
}

interface ResumoRecebimentoPaciente {
  nome: string;
  sessoes: number;
  totalProcessado: number;
  totalGlosa: number;
  totalFinal: number;
}

const normalize = (v: unknown) => String(v ?? '').trim();

const parseBRNumber = (raw: unknown): number | null => {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const txt = String(raw).trim().replace(/\s/g, '').replace(/R\$/gi, '').replace(/\./g, '').replace(',', '.');
  if (!txt) return null;
  const n = Number(txt);
  return Number.isFinite(n) ? n : null;
};

const toCompetenciaFromDateBR = (dateBR: string): string => {
  const m = dateBR.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2]}`;
};

const monthNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const addMonths = (competencia: string, months: number): string => {
  const [y, m] = competencia.split('-').map(Number);
  if (!y || !m) return competencia;
  const d = new Date(y, m - 1 + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const compareCompetencia = (a: string, b: string): number => a.localeCompare(b);

const formatCompetenciaLabel = (comp: string): string => {
  const [y, m] = comp.split('-');
  if (!y || !m) return comp;
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

const money = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDateBR = (day: number, month: number, year: number): string => {
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
};

const formatSheetDate = (raw: unknown): string => {
  if (raw === null || raw === undefined || raw === '') return '';

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return formatDateBR(raw.getDate(), raw.getMonth() + 1, raw.getFullYear());
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return formatDateBR(parsed.d, parsed.m, parsed.y);
    }
  }

  const text = String(raw).trim();
  if (!text) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return text;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return formatDateBR(Number(iso[3]), Number(iso[2]), Number(iso[1]));

  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const numeric = Number(text);
    if (Number.isFinite(numeric)) {
      const parsed = XLSX.SSF.parse_date_code(numeric);
      if (parsed?.y && parsed?.m && parsed?.d) {
        return formatDateBR(parsed.d, parsed.m, parsed.y);
      }
    }
  }

  return text;
};

const detectPeriodo = (rows: unknown[][]): string => {
  for (const row of rows.slice(0, 40)) {
    const txt = row.map((c) => normalize(c)).join(' | ');
    if (/per[ií]odo/i.test(txt)) {
      const date = txt.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (date?.[1]) return date[1];
    }
  }
  return '';
};

const detectHeaderRowFaturamento = (rows: unknown[][]): number => {
  for (let i = 0; i < Math.min(rows.length, 80); i += 1) {
    const txt = rows[i].map((c) => normalize(c).toLowerCase()).join(' | ');
    if (txt.includes('autoriz') && txt.includes('nome') && txt.includes('data')) return i;
  }
  return 20;
};

const parseFaturamentoRows = (rows: unknown[][]): FaturamentoItem[] => {
  const headerRow = detectHeaderRowFaturamento(rows);
  const out: FaturamentoItem[] = [];
  const dedupe = new Set<string>();

  for (let i = headerRow + 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const autorizacao = normalize(row[0]);
    const data = formatSheetDate(row[5]);
    const matricula = normalize(row[10]);
    const nome = normalize(row[12]);
    const lote = normalize(row[20]);

    if (!autorizacao || !nome) continue;
    if (!/\d/.test(autorizacao)) continue;

    const key = `${autorizacao}|${data}|${matricula}|${nome}|${lote}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);

    out.push({ autorizacao, data, matricula, nome, lote });
  }

  return out;
};

const pickCol = (header: unknown[] | null, candidates: string[], fallback: number): number => {
  if (!header) return fallback;
  const lowered = header.map((v) => normalize(v).toLowerCase());
  const idx = lowered.findIndex((cell) => candidates.some((c) => cell.includes(c)));
  return idx >= 0 ? idx : fallback;
};

const parseRecebimentoRows = (rows: unknown[][]): RecebimentoItem[] => {
  if (!rows.length) return [];
  const header = rows[0] || null;
  const colNome = pickCol(header, ['beneficiário', 'beneficiario', 'nome'], 13);
  const colProc = pickCol(header, ['valor processado', 'processado'], 38);
  const colDiff = pickCol(header, ['valor diferença', 'valor diferenca', 'diferença', 'diferenca'], 43);
  const colData = pickCol(header, ['data'], 52);

  const out: RecebimentoItem[] = [];
  const dedupe = new Set<string>();

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const nome = normalize(row[colNome]);
    const data = formatSheetDate(row[colData]);
    const valorProcessado = parseBRNumber(row[colProc]) ?? 0;
    const valorDiferenca = parseBRNumber(row[colDiff]) ?? 0;

    if (!nome) continue;
    if (nome.toUpperCase().startsWith('[OUTROS]')) continue;
    if (valorProcessado === 0 && valorDiferenca === 0) continue;

    const key = `${nome}|${data}|${valorProcessado}|${valorDiferenca}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);

    out.push({ nome, data, valorProcessado, valorDiferenca });
  }

  return out;
};

const detectPagamentoDate = (rows: unknown[][]): string => {
  for (const row of rows.slice(0, 40)) {
    const txt = row.map((c) => normalize(c)).join(' | ');
    if (/pagamento|pagto|processamento/i.test(txt)) {
      const m = txt.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (m?.[1]) return m[1];
    }
  }
  return '';
};

export const FunservCompetencias: React.FC = () => {
  const [competencias, setCompetencias] = useLocalStorage<Record<string, CompetenciaData>>(
    'personart.funserv.competencias.v1',
    {}
  );
  const [selectedCompetencia, setSelectedCompetencia] = useState(monthNow());
  const [message, setMessage] = useState('');
  const [showFaturamentoPreview, setShowFaturamentoPreview] = useState(false);
  const [showRecebimentoPreview, setShowRecebimentoPreview] = useState(false);

  const ordered = useMemo(
    () => Object.values(competencias).sort((a, b) => b.competencia.localeCompare(a.competencia)),
    [competencias]
  );

  const selectedData = competencias[selectedCompetencia];
  const expectedRecebimentoMonth = addMonths(selectedCompetencia, 2);
  const shouldWarnMissingRecebimento =
    !!selectedData?.faturamento &&
    !selectedData?.recebimento &&
    compareCompetencia(monthNow(), expectedRecebimentoMonth) >= 0;

  const resumoRecebimentoPorPaciente = useMemo<ResumoRecebimentoPaciente[]>(() => {
    const itens = selectedData?.recebimento?.itens ?? [];
    const map = new Map<string, ResumoRecebimentoPaciente>();

    itens.forEach((item) => {
      const atual = map.get(item.nome) ?? {
        nome: item.nome,
        sessoes: 0,
        totalProcessado: 0,
        totalGlosa: 0,
        totalFinal: 0
      };

      atual.sessoes += 1;
      atual.totalProcessado += item.valorProcessado;
      atual.totalGlosa += item.valorDiferenca < 0 ? item.valorDiferenca : 0;
      atual.totalFinal += item.valorProcessado + (item.valorDiferenca < 0 ? item.valorDiferenca : 0);

      map.set(item.nome, atual);
    });

    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [selectedData?.recebimento?.itens]);

  const saveCompetencia = (competencia: string, updater: (prev?: CompetenciaData) => CompetenciaData) => {
    setCompetencias((prev) => ({ ...prev, [competencia]: updater(prev[competencia]) }));
  };

  const onUploadFaturamento = async (file: File) => {
    setMessage('');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', raw: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];

      const periodo = detectPeriodo(rows);
      const compDetected = periodo ? toCompetenciaFromDateBR(periodo) : '';
      const competencia = compDetected || selectedCompetencia || monthNow();

      const itens = parseFaturamentoRows(rows);
      const map = new Map<string, number>();
      itens.forEach((it) => map.set(it.nome, (map.get(it.nome) || 0) + 1));
      const porPaciente = Array.from(map.entries())
        .map(([nome, sessoes]) => ({ nome, sessoes }))
        .sort((a, b) => a.nome.localeCompare(b.nome));

      saveCompetencia(competencia, (prev) => ({
        competencia,
        faturamento: {
          fileName: file.name,
          importedAt: new Date().toISOString(),
          periodoDetectado: periodo || undefined,
          totalContas: itens.length,
          porPaciente,
          itens
        },
        recebimento: prev?.recebimento
      }));

      setSelectedCompetencia(competencia);
      setMessage(`Faturamento importado em ${competencia}: ${itens.length} sessões. Previsão de recebimento: ${addMonths(competencia, 2)}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Falha ao importar faturamento.');
    }
  };

  const onUploadRecebimento = async (file: File) => {
    setMessage('');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', raw: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];

      const itens = parseRecebimentoRows(rows);
      const dataPagto = detectPagamentoDate(rows);

      const totalProcessado = itens.reduce((acc, i) => acc + i.valorProcessado, 0);
      const totalGlosa = itens.reduce((acc, i) => acc + (i.valorDiferenca < 0 ? i.valorDiferenca : 0), 0);
      const totalFinal = totalProcessado + totalGlosa;

      const competencia = selectedCompetencia || monthNow();
      saveCompetencia(competencia, (prev) => ({
        competencia,
        faturamento: prev?.faturamento,
        recebimento: {
          fileName: file.name,
          importedAt: new Date().toISOString(),
          dataPagamento: dataPagto || undefined,
          totalLinhas: itens.length,
          totalProcessado,
          totalGlosa,
          totalFinal,
          itens
        }
      }));

      setMessage(`Recebimento importado em ${competencia}: ${itens.length} linhas.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Falha ao importar recebimento.');
    }
  };

  const removeFaturamento = () => {
    if (!selectedData?.faturamento) return;
    if (!confirm(`Remover guia de faturamento da competência ${selectedCompetencia}?`)) return;

    saveCompetencia(selectedCompetencia, (prev) => ({
      competencia: selectedCompetencia,
      faturamento: undefined,
      recebimento: prev?.recebimento
    }));
    setMessage(`Guia de faturamento removida de ${selectedCompetencia}.`);
  };

  const removeRecebimento = () => {
    if (!selectedData?.recebimento) return;
    if (!confirm(`Remover guia de recebimento da competência ${selectedCompetencia}?`)) return;

    saveCompetencia(selectedCompetencia, (prev) => ({
      competencia: selectedCompetencia,
      faturamento: prev?.faturamento,
      recebimento: undefined
    }));
    setMessage(`Guia de recebimento removida de ${selectedCompetencia}.`);
  };

  const statusOf = (c: CompetenciaData) => {
    const previsto = addMonths(c.competencia, 2);
    if (c.faturamento && c.recebimento) return 'Consolidado';
    if (c.faturamento && !c.recebimento) {
      return compareCompetencia(monthNow(), previsto) >= 0 ? 'Faturado (faltando recebimento)' : 'Faturado (aguardando recebimento)';
    }
    if (!c.faturamento && c.recebimento) return 'Recebimento sem faturamento';
    return 'Sem dados';
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 md:p-6 shadow-xl backdrop-blur-sm space-y-4">
      <div className="flex flex-col md:flex-row md:items-end gap-3 md:justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">Funserv por Competência</h3>
          <p className="text-xs text-slate-400">Guias separadas: faturamento (sessões) e recebimento (consolidação).</p>
        </div>
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Competência (atendimento)</label>
          <input
            type="month"
            value={selectedCompetencia}
            onChange={(e) => setSelectedCompetencia(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          />
        </div>
      </div>

      {shouldWarnMissingRecebimento && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-200 text-sm">
          Atenção: para a competência {selectedCompetencia}, o recebimento já deveria ter vindo em {expectedRecebimentoMonth} e ainda não foi inserido.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-slate-900/40 border border-slate-700 rounded-xl p-3 space-y-2">
          <h4 className="text-white font-semibold">1) Guia de Faturamento (sessões)</h4>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 bg-sky-700 hover:bg-sky-600 text-white px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer">
              <span>Importar faturamento (.xlsx)</span>
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onUploadFaturamento(file);
                }}
              />
            </label>
            <button
              onClick={removeFaturamento}
              disabled={!selectedData?.faturamento}
              className="px-3 py-2 rounded-lg text-sm font-semibold bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white"
            >
              Remover guia faturamento
            </button>
          </div>
          <div className="text-xs text-slate-300">
            <div className="flex items-center gap-2 flex-wrap">
              <span>Arquivo: {selectedData?.faturamento?.fileName || '-'}</span>
              {!!selectedData?.faturamento && (
                <button
                  onClick={() => setShowFaturamentoPreview((v) => !v)}
                  className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-[11px]"
                >
                  {showFaturamentoPreview ? 'Ocultar preview' : 'Ver preview'}
                </button>
              )}
            </div>
            <div className="mt-1">Sessões faturadas: {selectedData?.faturamento?.totalContas ?? 0}</div>
            <div>Previsão de pagamento: {formatCompetenciaLabel(expectedRecebimentoMonth)} ({expectedRecebimentoMonth})</div>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-700 rounded-xl p-3 space-y-2">
          <h4 className="text-white font-semibold">2) Guia de Recebimento (consolidação)</h4>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer">
              <span>Importar recebimento (.xlsx)</span>
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onUploadRecebimento(file);
                }}
              />
            </label>
            <button
              onClick={removeRecebimento}
              disabled={!selectedData?.recebimento}
              className="px-3 py-2 rounded-lg text-sm font-semibold bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white"
            >
              Remover guia recebimento
            </button>
          </div>
          <div className="text-xs text-slate-300">
            <div className="flex items-center gap-2 flex-wrap">
              <span>Arquivo: {selectedData?.recebimento?.fileName || '-'}</span>
              {!!selectedData?.recebimento && (
                <button
                  onClick={() => setShowRecebimentoPreview((v) => !v)}
                  className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-[11px]"
                >
                  {showRecebimentoPreview ? 'Ocultar preview' : 'Ver preview'}
                </button>
              )}
            </div>
            <div className="mt-1">Linhas no recebimento: {selectedData?.recebimento?.totalLinhas ?? 0}</div>
            <div>Data pagamento: {selectedData?.recebimento?.dataPagamento || '-'}</div>
          </div>
        </div>
      </div>

      {message && <p className="text-sm text-slate-300">{message}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-300">
            <tr>
              <th className="text-left p-2">Competência</th>
              <th className="text-left p-2">Status</th>
              <th className="text-right p-2">Sessões faturadas</th>
              <th className="text-left p-2">Mês previsto de recebimento</th>
              <th className="text-right p-2">Recebimento (processado)</th>
              <th className="text-right p-2">Glosa</th>
              <th className="text-right p-2">Total final</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((c) => {
              const previsao = addMonths(c.competencia, 2);
              return (
                <tr key={c.competencia} className="border-t border-slate-800 text-slate-100">
                  <td className="p-2">{c.competencia}</td>
                  <td className="p-2">{statusOf(c)}</td>
                  <td className="p-2 text-right">{c.faturamento?.totalContas ?? 0}</td>
                  <td className="p-2">{previsao}</td>
                  <td className="p-2 text-right text-emerald-300">{money(c.recebimento?.totalProcessado ?? 0)}</td>
                  <td className="p-2 text-right text-rose-400">{money(c.recebimento?.totalGlosa ?? 0)}</td>
                  <td className="p-2 text-right text-cyan-300 font-semibold">{money(c.recebimento?.totalFinal ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedData?.recebimento && resumoRecebimentoPorPaciente.length > 0 && (
        <div className="bg-slate-900/30 border border-slate-700 rounded-xl p-3 space-y-2">
          <h4 className="text-white font-semibold">Resumo por paciente ({selectedCompetencia})</h4>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="text-left p-2">Paciente</th>
                  <th className="text-right p-2">Sessões</th>
                  <th className="text-right p-2">Bruto</th>
                  <th className="text-right p-2">Glosa</th>
                  <th className="text-right p-2">Líquido</th>
                </tr>
              </thead>
              <tbody>
                {resumoRecebimentoPorPaciente.map((item) => {
                  const teveGlosa = item.totalGlosa < 0;
                  return (
                    <tr
                      key={item.nome}
                      className={`border-t border-slate-800 ${teveGlosa ? 'bg-rose-950/30 text-rose-200' : 'text-slate-200'}`}
                    >
                      <td className={`p-2 ${teveGlosa ? 'font-semibold text-rose-300' : ''}`}>{item.nome}</td>
                      <td className="p-2 text-right">{item.sessoes}</td>
                      <td className="p-2 text-right">{money(item.totalProcessado)}</td>
                      <td className={`p-2 text-right ${teveGlosa ? 'text-rose-300 font-semibold' : 'text-slate-400'}`}>
                        {teveGlosa ? money(Math.abs(item.totalGlosa)) : '0,00'}
                      </td>
                      <td className={`p-2 text-right font-semibold ${teveGlosa ? 'text-rose-300' : 'text-cyan-300'}`}>
                        {money(item.totalFinal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400">Bruto = soma do processado. Glosa = desconto aplicado. Líquido = bruto - glosa.</p>
        </div>
      )}

      {selectedData?.faturamento && showFaturamentoPreview && (
        <div className="bg-slate-900/30 border border-slate-700 rounded-xl p-3 space-y-2">
          <h4 className="text-white font-semibold">Preview • guia de faturamento ({selectedCompetencia})</h4>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="text-left p-2">Data</th>
                  <th className="text-left p-2">Paciente</th>
                  <th className="text-left p-2">Autorização</th>
                </tr>
              </thead>
              <tbody>
                {selectedData.faturamento.itens.map((it, idx) => (
                  <tr key={`${it.autorizacao}-${idx}`} className="border-t border-slate-800 text-slate-200">
                    <td className="p-2">{it.data}</td>
                    <td className="p-2">{it.nome}</td>
                    <td className="p-2">{it.autorizacao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400">Mostrando todas as {selectedData.faturamento.itens.length} linhas.</p>
        </div>
      )}

      {selectedData?.recebimento && showRecebimentoPreview && (
        <div className="bg-slate-900/30 border border-slate-700 rounded-xl p-3 space-y-2">
          <h4 className="text-white font-semibold">Preview • guia de recebimento ({selectedCompetencia})</h4>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="text-left p-2">Data</th>
                  <th className="text-left p-2">Paciente</th>
                  <th className="text-right p-2">Processado</th>
                  <th className="text-right p-2">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {selectedData.recebimento.itens.map((it, idx) => {
                  const teveGlosa = it.valorDiferenca < 0;
                  return (
                    <tr
                      key={`${it.nome}-${idx}`}
                      className={`border-t border-slate-800 ${teveGlosa ? 'bg-rose-950/30 text-rose-200' : 'text-slate-200'}`}
                    >
                      <td className="p-2">{it.data}</td>
                      <td className={`p-2 ${teveGlosa ? 'font-semibold text-rose-300' : ''}`}>{it.nome}</td>
                      <td className={`p-2 text-right ${teveGlosa ? 'text-rose-300 font-semibold' : ''}`}>{money(it.valorProcessado)}</td>
                      <td className={`p-2 text-right ${teveGlosa ? 'text-rose-300 font-semibold' : ''}`}>{money(it.valorDiferenca)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400">Mostrando todas as {selectedData.recebimento.itens.length} linhas.</p>
        </div>
      )}

      {ordered.length === 0 && <p className="text-sm text-slate-400">Nenhuma competência importada ainda.</p>}
    </div>
  );
};