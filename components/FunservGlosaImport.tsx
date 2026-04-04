import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

export interface FaturamentoItem {
  nome: string;
  data: string; // dd/mm/aaaa
  valorProcessado: number; // valor da folha
  valorDiferenca: number; // glosa/ajuste (geralmente <= 0)
  temGlosaRegra: boolean; // regra específica Funserv (-40/-62)
}

interface PacienteResumo {
  nome: string;
  sessoes: number;
  sessoesConvencional: number;
  sessoesABA: number;
  sessoesAvaliacaoNeuro: number;
  sessoesOutras: number;
  totalFolha: number;
  totalGlosa: number;
  totalLiquido: number;
}

const NEGATIVE_GLOSA_VALUES = new Set([-40, -62]);
const NO_GLOSA_PAIRS = new Set(['40|0', '62|0']);

const FALLBACK_COLS = {
  nome: 13, // N
  processado: 38, // AM
  diferenca: 43, // AR
  data: 52 // BA
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function parseBRNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;

  const txt = String(raw)
    .trim()
    .replace(/\s/g, '')
    .replace(/R\$/gi, '')
    .replace(/\./g, '')
    .replace(',', '.');

  if (!txt) return null;
  const n = Number(txt);
  return Number.isFinite(n) ? n : null;
}

function excelSerialToDateBR(serial: number): string {
  const base = new Date(Date.UTC(1899, 11, 30));
  const ms = Math.round(serial * 24 * 60 * 60 * 1000);
  const date = new Date(base.getTime() + ms);
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function parseDateCell(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return excelSerialToDateBR(value);
  }

  const txt = normalizeText(value);
  if (!txt) return '';

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(txt)) return txt;

  if (/^\d{4}-\d{2}-\d{2}/.test(txt)) {
    const d = new Date(txt);
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  }

  return txt;
}

function findHeaderIndex(row: unknown[], candidates: string[]): number {
  const lowered = row.map((v) => normalizeText(v).toLowerCase());
  return lowered.findIndex((cell) => candidates.some((c) => cell.includes(c)));
}

function pickCol(header: unknown[] | null, candidates: string[], fallback: number): number {
  if (!header) return fallback;
  const idx = findHeaderIndex(header, candidates);
  return idx >= 0 ? idx : fallback;
}

function formatCurrencyBR(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function classifySessaoByValorProcessado(valorProcessado: number): 'convencional' | 'aba' | 'avaliacao-neuro' | 'outra' {
  const valor = Number(valorProcessado.toFixed(2));
  if (Math.abs(valor - 40) < 0.01) return 'convencional';
  if (Math.abs(valor - 62) < 0.01) return 'aba';
  if (Math.abs(valor - 1392) < 0.01) return 'avaliacao-neuro';
  return 'outra';
}

function isNoGlosaByRule(valorProcessado: number | null, valorDiferenca: number): boolean {
  if (valorProcessado === null) return false;
  return NO_GLOSA_PAIRS.has(`${Math.round(valorProcessado)}|${Math.round(valorDiferenca)}`);
}

function isGlosaByRule(valorDiferenca: number): boolean {
  const rounded = Number(valorDiferenca.toFixed(2));
  return NEGATIVE_GLOSA_VALUES.has(rounded);
}

function parseFaturamentoFromRows(rows: unknown[][]): FaturamentoItem[] {
  if (!rows.length) return [];

  const header = rows[0] || null;
  const colNome = pickCol(header, ['beneficiário', 'beneficiario', 'nome'], FALLBACK_COLS.nome);
  const colProc = pickCol(header, ['valor processado', 'processado'], FALLBACK_COLS.processado);
  const colDiff = pickCol(header, ['valor diferença', 'valor diferenca', 'diferença', 'diferenca'], FALLBACK_COLS.diferenca);
  const colData = pickCol(header, ['data'], FALLBACK_COLS.data);

  const dedupe = new Set<string>();
  const out: FaturamentoItem[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] || [];

    const nome = normalizeText(row[colNome]);
    if (!nome) continue;
    if (nome.toUpperCase().startsWith('[OUTROS]')) continue;

    const valorProcessado = parseBRNumber(row[colProc]) ?? 0;
    const valorDiferenca = parseBRNumber(row[colDiff]) ?? 0;

    if (valorProcessado === 0 && valorDiferenca === 0) continue;

    const data = parseDateCell(row[colData]);
    const roundedProc = Number(valorProcessado.toFixed(2));
    const roundedDiff = Number(valorDiferenca.toFixed(2));

    const key = `${nome}|${data}|${roundedProc}|${roundedDiff}`;
    if (dedupe.has(key)) continue;

    const temGlosaRegra = !isNoGlosaByRule(roundedProc, roundedDiff) && isGlosaByRule(roundedDiff);

    dedupe.add(key);
    out.push({
      nome,
      data,
      valorProcessado: roundedProc,
      valorDiferenca: roundedDiff,
      temGlosaRegra
    });
  }

  return out;
}

export const FunservFaturamentoImport: React.FC = () => {
  const [items, setItems] = useState<FaturamentoItem[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState('');

  const totalFolha = useMemo(() => items.reduce((acc, item) => acc + item.valorProcessado, 0), [items]);
  const totalGlosa = useMemo(
    () => items.reduce((acc, item) => acc + (item.temGlosaRegra ? item.valorDiferenca : 0), 0),
    [items]
  );
  const totalLiquido = useMemo(() => totalFolha + totalGlosa, [totalFolha, totalGlosa]);

  const porPaciente = useMemo<PacienteResumo[]>(() => {
    const mapa = new Map<string, PacienteResumo>();

    for (const item of items) {
      const atual = mapa.get(item.nome) ?? {
        nome: item.nome,
        sessoes: 0,
        sessoesConvencional: 0,
        sessoesABA: 0,
        sessoesAvaliacaoNeuro: 0,
        sessoesOutras: 0,
        totalFolha: 0,
        totalGlosa: 0,
        totalLiquido: 0
      };

      atual.sessoes += 1;
      const tipo = classifySessaoByValorProcessado(item.valorProcessado);
      if (tipo === 'convencional') atual.sessoesConvencional += 1;
      else if (tipo === 'aba') atual.sessoesABA += 1;
      else if (tipo === 'avaliacao-neuro') atual.sessoesAvaliacaoNeuro += 1;
      else atual.sessoesOutras += 1;

      atual.totalFolha += item.valorProcessado;
      if (item.temGlosaRegra) atual.totalGlosa += item.valorDiferenca;
      atual.totalLiquido = atual.totalFolha + atual.totalGlosa;

      mapa.set(item.nome, atual);
    }

    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [items]);

  const handleFile = async (file: File) => {
    setError('');
    setIsLoading(true);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', raw: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error('Planilha vazia.');

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
      const parsed = parseFaturamentoFromRows(rows);
      setItems(parsed);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : 'Falha ao ler arquivo .xlsx');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 md:p-6 shadow-xl backdrop-blur-sm space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">Faturamento Funserv (.xlsx)</h3>
          <p className="text-xs text-slate-400">Separado por paciente: sessões por tipo (Conv 40, ABA 62, Neuro 1.392), total da folha, glosas e total final.</p>
        </div>

        <label className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer">
          <span>Selecionar .xlsx</span>
          <input
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </label>
      </div>

      {fileName && <p className="text-xs text-slate-500">Arquivo: {fileName}</p>}
      {isLoading && <p className="text-sm text-slate-300">Processando planilha...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!isLoading && !error && items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="text-left p-2">Paciente</th>
                  <th className="text-right p-2">Sessões (40/62/1392)</th>
                  <th className="text-right p-2">Total folha</th>
                  <th className="text-right p-2">Total glosa</th>
                  <th className="text-right p-2">Total final</th>
                </tr>
              </thead>
              <tbody>
                {porPaciente.map((row) => (
                  <tr key={row.nome} className="border-t border-slate-800 text-slate-100">
                    <td className="p-2">{row.nome}</td>
                    <td className="p-2 text-right">
                      <div className="font-semibold">{row.sessoes}</div>
                      <div className="text-[10px] text-slate-400">
                        Conv 40: {row.sessoesConvencional} • ABA 62: {row.sessoesABA} • Neuro 1392: {row.sessoesAvaliacaoNeuro}
                        {row.sessoesOutras > 0 ? ` • Outras: ${row.sessoesOutras}` : ''}
                      </div>
                    </td>
                    <td className="p-2 text-right text-emerald-300">{formatCurrencyBR(row.totalFolha)}</td>
                    <td className="p-2 text-right text-rose-400">{formatCurrencyBR(row.totalGlosa)}</td>
                    <td className="p-2 text-right text-cyan-300 font-semibold">{formatCurrencyBR(row.totalLiquido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
              <span className="text-slate-400 text-xs mr-2">Total da folha:</span>
              <span className="text-emerald-300 font-bold">{formatCurrencyBR(totalFolha)}</span>
            </div>
            <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
              <span className="text-slate-400 text-xs mr-2">Total glosas:</span>
              <span className="text-rose-400 font-bold">{formatCurrencyBR(totalGlosa)}</span>
            </div>
            <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
              <span className="text-slate-400 text-xs mr-2">Total final da folha:</span>
              <span className="text-cyan-300 font-bold">{formatCurrencyBR(totalLiquido)}</span>
            </div>
          </div>
        </>
      )}

      {!isLoading && !error && fileName && items.length === 0 && (
        <p className="text-sm text-slate-400">Nenhuma linha válida de faturamento encontrada na planilha.</p>
      )}
    </div>
  );
};

// Compatibilidade com import antigo
export const FunservGlosaImport = FunservFaturamentoImport;