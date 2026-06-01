import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import useLocalStorage from '../hooks/useLocalStorage';

export interface FaturamentoItem {
  autorizacao: string;
  data: string;
  matricula: string;
  nome: string;
  lote: string;
}

export interface GuiaPendenteFechamento extends FaturamentoItem {
  origemCompetencia: string;
  adiadaEm: string;
}

interface RecebimentoItem {
  nome: string;
  data: string;
  valorProcessado: number;
  valorDiferenca: number;
}

export interface CompetenciaData {
  competencia: string; // YYYY-MM
  faturamento?: {
    fileName: string;
    importedAt: string;
    periodoDetectado?: string;
    dataFechamentoEnvio?: string; // YYYY-MM-DD
    emissao?: string;
    relatorio?: string;
    titulo?: string;
    prestador?: string;
    qtdeContas?: number;
    totalContas: number;
    porPaciente: Array<{ nome: string; sessoes: number }>;
    itens: FaturamentoItem[];
  };
  guiasPendentesFechamento?: GuiaPendenteFechamento[];
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

interface FaturamentoMetadata {
  titulo?: string;
  prestador?: string;
  emissao?: string;
  dataFechamentoEnvio?: string;
  relatorio?: string;
  qtdeContas?: number;
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

const toDateISOFromBR = (dateBR: string): string => {
  const m = dateBR.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
};

const valueAfterLabel = (row: unknown[], label: RegExp): string => {
  const cells = row.map(normalize);
  const idx = cells.findIndex((cell) => label.test(cell));
  if (idx < 0) return '';

  const inline = cells[idx].replace(label, '').replace(/^[:\s-]+/, '').trim();
  if (inline) return inline;

  return cells.slice(idx + 1).find(Boolean) || '';
};

export const detectFaturamentoMetadata = (rows: unknown[][]): FaturamentoMetadata => {
  const metadata: FaturamentoMetadata = {};

  for (const row of rows.slice(0, 80)) {
    const cells = row.map(normalize).filter(Boolean);
    const joined = cells.join(' | ');

    if (!metadata.titulo && cells.some((cell) => /produ[cç][aã]o\s*-\s*faturado/i.test(cell))) {
      metadata.titulo = cells.find((cell) => /produ[cç][aã]o\s*-\s*faturado/i.test(cell));
    }

    if (!metadata.prestador) {
      const prestador = valueAfterLabel(row, /^prestador:?/i);
      if (prestador) metadata.prestador = prestador;
    }

    if (!metadata.emissao) {
      const emissao = valueAfterLabel(row, /^emiss[aã]o:?/i) || joined.match(/emiss[aã]o:?[\s|]*(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:?\d{2}:?\d{2})?)/i)?.[1] || '';
      if (emissao) {
        metadata.emissao = emissao;
        metadata.dataFechamentoEnvio = toDateISOFromBR(emissao);
      }
    }

    if (!metadata.relatorio) {
      const relatorio = valueAfterLabel(row, /^relat[oó]rio:?/i);
      if (relatorio) metadata.relatorio = relatorio;
    }

    if (!metadata.qtdeContas) {
      const qtdeRaw = valueAfterLabel(row, /^qtde\s+contas:?/i) || joined.match(/qtde\s+contas:?[\s|]*(\d+)/i)?.[1] || '';
      const qtde = parseInt(qtdeRaw.replace(/\D/g, ''), 10);
      if (Number.isFinite(qtde)) metadata.qtdeContas = qtde;
    }
  }

  return metadata;
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

const todayDateISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatInputDateBR = (raw?: string): string => {
  if (!raw) return '-';
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

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

export const summarizeFaturamentoPorPaciente = (itens: FaturamentoItem[]): Array<{ nome: string; sessoes: number }> => {
  const map = new Map<string, number>();
  itens.forEach((it) => map.set(it.nome, (map.get(it.nome) || 0) + 1));
  return Array.from(map.entries())
    .map(([nome, sessoes]) => ({ nome, sessoes }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
};

export const groupFaturamentoGuiasPorPaciente = (itens: FaturamentoItem[]): Array<{ nome: string; sessoes: number; itens: FaturamentoItem[] }> => {
  const map = new Map<string, FaturamentoItem[]>();
  itens.forEach((it) => {
    const current = map.get(it.nome) ?? [];
    current.push(it);
    map.set(it.nome, current);
  });

  return Array.from(map.entries())
    .map(([nome, patientItens]) => ({
      nome,
      sessoes: patientItens.length,
      itens: [...patientItens].sort((a, b) => a.data.localeCompare(b.data) || a.autorizacao.localeCompare(b.autorizacao))
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
};

const faturamentoItemKey = (item: FaturamentoItem): string => (
  `${item.autorizacao}|${item.data}|${item.matricula}|${item.nome}|${item.lote}`
);

export const mergeFaturamentoItens = (itens: FaturamentoItem[]): FaturamentoItem[] => {
  const seen = new Set<string>();
  const merged: FaturamentoItem[] = [];

  itens.forEach((item) => {
    const key = faturamentoItemKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({
      autorizacao: item.autorizacao,
      data: item.data,
      matricula: item.matricula,
      nome: item.nome,
      lote: item.lote
    });
  });

  return merged;
};

const withRecalculatedFaturamento = <T extends { totalContas: number; porPaciente: Array<{ nome: string; sessoes: number }>; itens: FaturamentoItem[] }>(
  faturamento: T,
  itens: FaturamentoItem[]
): T => ({
  ...faturamento,
  itens,
  totalContas: itens.length,
  porPaciente: summarizeFaturamentoPorPaciente(itens)
});

export const deferFaturamentoItemToNextCompetencia = (
  competencias: Record<string, CompetenciaData>,
  fromCompetencia: string,
  item: FaturamentoItem,
  adiadaEm: string
): Record<string, CompetenciaData> => {
  const origem = competencias[fromCompetencia];
  if (!origem?.faturamento) return competencias;

  const key = faturamentoItemKey(item);
  const remaining = origem.faturamento.itens.filter((current) => faturamentoItemKey(current) !== key);
  if (remaining.length === origem.faturamento.itens.length) return competencias;

  const toCompetencia = addMonths(fromCompetencia, 1);
  const destino = competencias[toCompetencia] ?? { competencia: toCompetencia };
  const pendingItem: GuiaPendenteFechamento = {
    ...item,
    origemCompetencia: fromCompetencia,
    adiadaEm
  };
  const pending = destino.guiasPendentesFechamento ?? [];
  const pendingWithoutDuplicate = pending.filter((current) => faturamentoItemKey(current) !== key);

  return {
    ...competencias,
    [fromCompetencia]: {
      ...origem,
      faturamento: withRecalculatedFaturamento(origem.faturamento, remaining)
    },
    [toCompetencia]: {
      ...destino,
      competencia: toCompetencia,
      guiasPendentesFechamento: [...pendingWithoutDuplicate, pendingItem]
    }
  };
};

export const restoreDeferredFaturamentoItem = (
  competencias: Record<string, CompetenciaData>,
  fromCompetencia: string,
  toCompetencia: string,
  item: FaturamentoItem
): Record<string, CompetenciaData> => {
  const key = faturamentoItemKey(item);
  const origem = competencias[fromCompetencia];
  const destino = competencias[toCompetencia];
  const next = { ...competencias };

  if (origem?.faturamento) {
    const existsInOrigem = origem.faturamento.itens.some((current) => faturamentoItemKey(current) === key);
    const restoredItens = existsInOrigem ? origem.faturamento.itens : mergeFaturamentoItens([...origem.faturamento.itens, item]);
    next[fromCompetencia] = {
      ...origem,
      faturamento: withRecalculatedFaturamento(origem.faturamento, restoredItens)
    };
  }

  if (destino) {
    const pending = (destino.guiasPendentesFechamento ?? []).filter((current) => faturamentoItemKey(current) !== key);
    const faturamento = destino.faturamento
      ? withRecalculatedFaturamento(
          destino.faturamento,
          destino.faturamento.itens.filter((current) => faturamentoItemKey(current) !== key)
        )
      : undefined;

    next[toCompetencia] = {
      ...destino,
      faturamento,
      guiasPendentesFechamento: pending.length ? pending : undefined
    };
  }

  return next;
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

const toXlsxFileName = (fileName: string): string => fileName.replace(/\.xls$/i, '.xlsx');

const readWorkbookFromUpload = async (file: File) => {
  const buf = await file.arrayBuffer();
  const originalWorkbook = XLSX.read(buf, { type: 'array', raw: true });
  const isXls = /\.xls$/i.test(file.name) && !/\.xlsx$/i.test(file.name);

  if (!isXls) {
    return {
      workbook: originalWorkbook,
      normalizedFileName: file.name,
      convertedFromXls: false
    };
  }

  const convertedBuffer = XLSX.write(originalWorkbook, { bookType: 'xlsx', type: 'array' });
  const normalizedWorkbook = XLSX.read(convertedBuffer, { type: 'array', raw: true });

  return {
    workbook: normalizedWorkbook,
    normalizedFileName: toXlsxFileName(file.name),
    convertedFromXls: true
  };
};

export const FunservCompetencias: React.FC = () => {
  const [competencias, setCompetencias] = useLocalStorage<Record<string, CompetenciaData>>(
    'personart.funserv.competencias.v1',
    {}
  );
  const [selectedCompetencia, setSelectedCompetencia] = useState(() => Object.keys(competencias).sort().at(-1) || monthNow());
  const [message, setMessage] = useState('');
  const [showFaturamentoPreview, setShowFaturamentoPreview] = useState(false);
  const [showRecebimentoPreview, setShowRecebimentoPreview] = useState(false);
  const [expandedFaturamentoPaciente, setExpandedFaturamentoPaciente] = useState('');
  const [lastDeferredGuide, setLastDeferredGuide] = useState<{
    fromCompetencia: string;
    toCompetencia: string;
    item: FaturamentoItem;
  } | null>(null);

  const ordered = useMemo(
    () => Object.values(competencias).sort((a, b) => b.competencia.localeCompare(a.competencia)),
    [competencias]
  );

  const selectedData = competencias[selectedCompetencia];
  const visibleCompetencias = selectedData ? [selectedData] : [];
  const pendingGuidesForSelected = selectedData?.guiasPendentesFechamento ?? [];
  const faturamentoGuiasPorPaciente = useMemo(
    () => groupFaturamentoGuiasPorPaciente(selectedData?.faturamento?.itens ?? []),
    [selectedData?.faturamento?.itens]
  );
  const expandedFaturamentoGroup = faturamentoGuiasPorPaciente.find((group) => group.nome === expandedFaturamentoPaciente);
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

  const removeCompetencia = () => {
    if (!selectedData) return;
    if (!confirm(`Excluir toda a competência ${selectedCompetencia}? Isso removerá faturamento e recebimento dessa competência.`)) return;

    setCompetencias((prev) => {
      const next = { ...prev };
      delete next[selectedCompetencia];
      return next;
    });

    setMessage(`Competência ${selectedCompetencia} excluída com sucesso.`);
  };

  const onUploadFaturamento = async (file: File) => {
    setMessage('');
    try {
      const { workbook, normalizedFileName, convertedFromXls } = await readWorkbookFromUpload(file);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];

      const periodo = detectPeriodo(rows);
      const metadata = detectFaturamentoMetadata(rows);
      const compDetected = periodo ? toCompetenciaFromDateBR(periodo) : '';
      const competencia = compDetected || selectedCompetencia || monthNow();

      const itensArquivo = parseFaturamentoRows(rows);
      const pendingBeforeUpload = competencias[competencia]?.guiasPendentesFechamento ?? [];

      saveCompetencia(competencia, (prev) => {
        const pendingGuides = prev?.guiasPendentesFechamento ?? [];
        const itens = mergeFaturamentoItens([...pendingGuides, ...itensArquivo]);
        const porPaciente = summarizeFaturamentoPorPaciente(itens);

        return {
          competencia,
          faturamento: {
            fileName: normalizedFileName,
            importedAt: new Date().toISOString(),
            periodoDetectado: periodo || undefined,
            dataFechamentoEnvio: metadata.dataFechamentoEnvio || prev?.faturamento?.dataFechamentoEnvio || todayDateISO(),
            emissao: metadata.emissao,
            relatorio: metadata.relatorio,
            titulo: metadata.titulo,
            prestador: metadata.prestador,
            qtdeContas: metadata.qtdeContas,
            totalContas: itens.length,
            porPaciente,
            itens
          },
          guiasPendentesFechamento: undefined,
          recebimento: prev?.recebimento
        };
      });

      setSelectedCompetencia(competencia);
      setMessage(
        `Faturamento importado em ${competencia}: ${mergeFaturamentoItens([...pendingBeforeUpload, ...itensArquivo]).length} sessões. Previsão de recebimento: ${addMonths(competencia, 2)}.${pendingBeforeUpload.length ? ` Incluí ${pendingBeforeUpload.length} guia(s) pendente(s) de fechamento anterior.` : ''}${convertedFromXls ? ` Arquivo .xls normalizado internamente para ${normalizedFileName}.` : ''}`
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Falha ao importar faturamento.');
    }
  };

  const onUploadRecebimento = async (file: File) => {
    setMessage('');
    try {
      const { workbook, normalizedFileName, convertedFromXls } = await readWorkbookFromUpload(file);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
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
        guiasPendentesFechamento: prev?.guiasPendentesFechamento,
        recebimento: {
          fileName: normalizedFileName,
          importedAt: new Date().toISOString(),
          dataPagamento: dataPagto || undefined,
          totalLinhas: itens.length,
          totalProcessado,
          totalGlosa,
          totalFinal,
          itens
        }
      }));

      setMessage(
        `Recebimento importado em ${competencia}: ${itens.length} linhas.${convertedFromXls ? ` Arquivo .xls normalizado internamente para ${normalizedFileName}.` : ''}`
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Falha ao importar recebimento.');
    }
  };

  const updateDataFechamentoEnvio = (dataFechamentoEnvio: string) => {
    if (!selectedData?.faturamento) return;

    saveCompetencia(selectedCompetencia, (prev) => {
      if (!prev?.faturamento) {
        return {
          competencia: selectedCompetencia,
          guiasPendentesFechamento: prev?.guiasPendentesFechamento,
          recebimento: prev?.recebimento
        };
      }

      return {
        competencia: selectedCompetencia,
        faturamento: {
          ...prev.faturamento,
          dataFechamentoEnvio: dataFechamentoEnvio || undefined
        },
        guiasPendentesFechamento: prev.guiasPendentesFechamento,
        recebimento: prev.recebimento
      };
    });

    setMessage(
      dataFechamentoEnvio
        ? `Data de fechamento/envio atualizada para ${formatInputDateBR(dataFechamentoEnvio)}.`
        : `Data de fechamento/envio removida de ${selectedCompetencia}.`
    );
  };

  const handleDeferFaturamentoItem = (item: FaturamentoItem) => {
    const toCompetencia = addMonths(selectedCompetencia, 1);
    const adiadaEm = new Date().toISOString();
    setCompetencias((prev) => deferFaturamentoItemToNextCompetencia(prev, selectedCompetencia, item, adiadaEm));
    setLastDeferredGuide({ fromCompetencia: selectedCompetencia, toCompetencia, item });
    setMessage(`Protocolo ${item.autorizacao || '-'} de ${item.nome} enviado para o próximo mês (${toCompetencia}).`);
  };

  const undoLastDeferredGuide = () => {
    if (!lastDeferredGuide) return;
    setCompetencias((prev) => restoreDeferredFaturamentoItem(
      prev,
      lastDeferredGuide.fromCompetencia,
      lastDeferredGuide.toCompetencia,
      lastDeferredGuide.item
    ));
    setSelectedCompetencia(lastDeferredGuide.fromCompetencia);
    setMessage(`A guia ${lastDeferredGuide.item.autorizacao || '-'} voltou para o fechamento ${lastDeferredGuide.fromCompetencia}.`);
    setLastDeferredGuide(null);
  };

  const removeFaturamento = () => {
    if (!selectedData?.faturamento) return;
    if (!confirm(`Remover guia de faturamento da competência ${selectedCompetencia}?`)) return;

    saveCompetencia(selectedCompetencia, (prev) => ({
      competencia: selectedCompetencia,
      faturamento: undefined,
      guiasPendentesFechamento: prev?.guiasPendentesFechamento,
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
      guiasPendentesFechamento: prev?.guiasPendentesFechamento,
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
          <p className="text-xs text-slate-400">Fluxo separado por etapas: primeiro guias enviadas, depois recebimentos e glosas.</p>
        </div>
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Competência (atendimento)</label>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={selectedCompetencia}
              onChange={(e) => setSelectedCompetencia(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
            <button
              onClick={removeCompetencia}
              disabled={!selectedData}
              className="px-3 py-2 rounded-lg text-sm font-semibold bg-rose-900 hover:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed text-white"
              title="Excluir a competência inteira selecionada"
            >
              Excluir competência
            </button>
          </div>
        </div>
      </div>

      {shouldWarnMissingRecebimento && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-200 text-sm">
          Atenção: para a competência {selectedCompetencia}, o recebimento já deveria ter vindo em {expectedRecebimentoMonth} e ainda não foi inserido.
        </div>
      )}

      <div className="space-y-3">
        <div className="bg-sky-950/20 border border-sky-800/70 rounded-xl p-3 space-y-2">
          <div>
            <h4 className="text-white font-semibold">1) Faturamento — guias enviadas</h4>
            <p className="text-xs text-slate-400">Mostra pacientes, datas de atendimento e sessões enviadas, sem valores.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 bg-sky-700 hover:bg-sky-600 text-white px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer">
              <span>Importar faturamento (.xls/.xlsx)</span>
              <input
                type="file"
                accept=".xls,.xlsx"
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
            {!!selectedData?.faturamento && (selectedData.faturamento.titulo || selectedData.faturamento.relatorio || selectedData.faturamento.emissao || selectedData.faturamento.prestador || selectedData.faturamento.qtdeContas) && (
              <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950/40 p-2 space-y-1 text-[11px] text-slate-300">
                <div className="font-semibold text-slate-200">Dados detectados do fechamento</div>
                <div>Título: {selectedData.faturamento.titulo || '-'}</div>
                <div>Prestador: {selectedData.faturamento.prestador || '-'}</div>
                <div>Emissão: {selectedData.faturamento.emissao || '-'}</div>
                <div>Relatório: {selectedData.faturamento.relatorio || '-'}</div>
                <div>Qtde Contas no arquivo: {selectedData.faturamento.qtdeContas ?? '-'}</div>
                {selectedData.faturamento.qtdeContas !== undefined && selectedData.faturamento.qtdeContas !== selectedData.faturamento.totalContas && (
                  <div className="text-amber-300 font-semibold">
                    Atenção: o arquivo informa {selectedData.faturamento.qtdeContas} contas, mas o sistema importou {selectedData.faturamento.totalContas} sessões.
                  </div>
                )}
              </div>
            )}
            <div className="mt-1">Sessões faturadas: {selectedData?.faturamento?.totalContas ?? 0}</div>
            <div className="mt-2 max-w-xs">
              <label className="block text-[11px] text-slate-400 mb-1">Fechado/enviado em</label>
              <input
                type="date"
                value={selectedData?.faturamento?.dataFechamentoEnvio || ''}
                onChange={(e) => updateDataFechamentoEnvio(e.target.value)}
                disabled={!selectedData?.faturamento}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-[11px] text-slate-500 mt-1">Data completa em que a guia foi fechada/enviada para a Funserv.</p>
            </div>
            <div>Previsão de pagamento: {formatCompetenciaLabel(expectedRecebimentoMonth)} ({expectedRecebimentoMonth})</div>
            <div className="text-[11px] text-slate-400 mt-1">Ao trocar o mês, esse bloco mostra o arquivo e os dados que foram importados naquela competência.</div>
          </div>
        </div>

        <div className="bg-emerald-950/20 border border-emerald-800/70 rounded-xl p-3 space-y-2">
          <div>
            <h4 className="text-white font-semibold">2) Recebimento — conferência e glosas</h4>
            <p className="text-xs text-slate-400">Mostra valor processado, glosa, líquido e repasse confirmado.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer">
              <span>Importar recebimento (.xls/.xlsx)</span>
              <input
                type="file"
                accept=".xls,.xlsx"
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

      {message && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
          <span>{message}</span>
          {lastDeferredGuide && (
            <button
              onClick={undoLastDeferredGuide}
              className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-white"
            >
              Desfazer
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-300">
            <tr>
              <th className="text-left p-2">Competência</th>
              <th className="text-left p-2">Fechado/enviado em</th>
              <th className="text-left p-2">Status</th>
              <th className="text-right p-2">Sessões faturadas</th>
              <th className="text-left p-2">Mês previsto de recebimento</th>
              <th className="text-right p-2">Recebimento (processado)</th>
              <th className="text-right p-2">Glosa</th>
              <th className="text-right p-2">Total final</th>
            </tr>
          </thead>
          <tbody>
            {visibleCompetencias.map((c) => {
              const previsao = addMonths(c.competencia, 2);
              return (
                <tr key={c.competencia} className="border-t border-slate-800 text-slate-100">
                  <td className="p-2">{c.competencia}</td>
                  <td className="p-2">{formatInputDateBR(c.faturamento?.dataFechamentoEnvio)}</td>
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

      {pendingGuidesForSelected.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-800/70 rounded-xl p-3 space-y-2">
          <h4 className="text-white font-semibold">Guias pendentes para este fechamento ({selectedCompetencia})</h4>
          <p className="text-xs text-slate-400">Elas vieram de fechamento anterior e serão incluídas automaticamente quando você importar o faturamento deste mês.</p>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="text-left p-2">Origem</th>
                  <th className="text-left p-2">Data</th>
                  <th className="text-left p-2">Paciente</th>
                  <th className="text-left p-2">Guia/autorização</th>
                </tr>
              </thead>
              <tbody>
                {pendingGuidesForSelected.map((it, idx) => (
                  <tr key={`${it.autorizacao}-${it.origemCompetencia}-${idx}`} className="border-t border-slate-800 text-slate-200">
                    <td className="p-2">{it.origemCompetencia}</td>
                    <td className="p-2">{it.data}</td>
                    <td className="p-2">{it.nome}</td>
                    <td className="p-2 font-semibold text-amber-200">{it.autorizacao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedData?.faturamento && faturamentoGuiasPorPaciente.length > 0 && (
        <div className="bg-slate-900/30 border border-slate-700 rounded-xl p-3 space-y-3">
          <div>
            <h4 className="text-white font-semibold">Resumo faturado por paciente ({selectedCompetencia})</h4>
            <p className="text-xs text-slate-400">Clique no nome do paciente para ver datas, protocolo e mandar uma guia específica para o próximo mês.</p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="text-left p-2">Paciente</th>
                  <th className="text-right p-2">Guias</th>
                </tr>
              </thead>
              <tbody>
                {faturamentoGuiasPorPaciente.map((item) => {
                  const isExpanded = expandedFaturamentoPaciente === item.nome;
                  return (
                    <tr key={item.nome} className={`border-t border-slate-800 ${isExpanded ? 'bg-sky-950/30 text-sky-100' : 'text-slate-200'}`}>
                      <td className="p-2">
                        <button
                          onClick={() => setExpandedFaturamentoPaciente(isExpanded ? '' : item.nome)}
                          className="font-semibold text-left hover:text-sky-300 underline-offset-2 hover:underline"
                        >
                          {item.nome}
                        </button>
                      </td>
                      <td className="p-2 text-right font-semibold text-sky-300">{item.sessoes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {expandedFaturamentoGroup ? (
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h5 className="text-sm font-semibold text-white">Guias enviadas • {expandedFaturamentoGroup.nome}</h5>
                <span className="text-xs text-slate-400">{expandedFaturamentoGroup.sessoes} guia(s)</span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-xs">
                  <thead className="bg-slate-900 text-slate-300">
                    <tr>
                      <th className="text-left p-2">Data atendimento</th>
                      <th className="text-left p-2">Protocolo</th>
                      <th className="text-right p-2">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expandedFaturamentoGroup.itens.map((it, idx) => (
                      <tr key={`${it.autorizacao}-${it.data}-${idx}`} className="border-t border-slate-800 text-slate-200">
                        <td className="p-2">{it.data || '-'}</td>
                        <td className="p-2 font-semibold text-sky-200">{it.autorizacao || '-'}</td>
                        <td className="p-2 text-right">
                          <button
                            onClick={() => handleDeferFaturamentoItem(it)}
                            className="px-2 py-1 rounded bg-amber-700 hover:bg-amber-600 text-white font-semibold"
                          >
                            Próximo mês
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-400">Ao clicar em “Próximo mês”, o protocolo sai desta competência e fica pendente para entrar automaticamente no próximo fechamento.</p>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">Cada linha encontrada na guia de faturamento conta como 1 guia/sessão faturada.</p>
          )}
        </div>
      )}

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
      {ordered.length > 0 && !selectedData && (
        <p className="text-sm text-slate-400">Não há dados importados para a competência selecionada.</p>
      )}
    </div>
  );
};