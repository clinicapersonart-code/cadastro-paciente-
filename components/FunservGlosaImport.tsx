import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

export interface GlosaItem {
  nome: string;
  data: string; // dd/mm/aaaa
  valorGlosa: number; // negativo
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

  // já vem como dd/mm/aaaa
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(txt)) return txt;

  // yyyy-mm-dd
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

function parseGlosasFromRows(rows: unknown[][]): GlosaItem[] {
  if (!rows.length) return [];

  const header = rows[0] || null;
  const colNome = pickCol(header, ['beneficiário', 'beneficiario', 'nome'], FALLBACK_COLS.nome);
  const colProc = pickCol(header, ['valor processado', 'processado'], FALLBACK_COLS.processado);
  const colDiff = pickCol(header, ['valor diferença', 'valor diferenca', 'diferença', 'diferenca'], FALLBACK_COLS.diferenca);
  const colData = pickCol(header, ['data'], FALLBACK_COLS.data);

  const dedupe = new Set<string>();
  const out: GlosaItem[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] || [];

    const nome = normalizeText(row[colNome]);
    if (!nome) continue;
    if (nome.toUpperCase().startsWith('[OUTROS]')) continue;

    const valorProcessado = parseBRNumber(row[colProc]);
    const valorDiferenca = parseBRNumber(row[colDiff]);

    if (valorDiferenca === null) continue;

    if (
      valorProcessado !== null &&
      NO_GLOSA_PAIRS.has(`${Math.round(valorProcessado)}|${Math.round(valorDiferenca)}`)
    ) {
      continue;
    }

    const roundedDiff = Number(valorDiferenca.toFixed(2));
    if (!NEGATIVE_GLOSA_VALUES.has(roundedDiff)) continue;

    const data = parseDateCell(row[colData]);
    const key = `${nome}|${data}|${roundedDiff}`;
    if (dedupe.has(key)) continue;

    dedupe.add(key);
    out.push({ nome, data, valorGlosa: roundedDiff });
  }

  return out;
}

export const FunservGlosaImport: React.FC = () => {
  const [items, setItems] = useState<GlosaItem[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState('');

  const totalGlosa = useMemo(() => items.reduce((acc, item) => acc + item.valorGlosa, 0), [items]);

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
      const parsed = parseGlosasFromRows(rows);
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
          <h3 className="text-lg font-bold text-white">Importar Glosas TISS (.xlsx)</h3>
          <p className="text-xs text-slate-400">Saída: nome, data, valor da glosa e total.</p>
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
                  <th className="text-left p-2">Nome</th>
                  <th className="text-left p-2">Data</th>
                  <th className="text-right p-2">Valor glosa</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={`${item.nome}-${item.data}-${idx}`} className="border-t border-slate-800 text-slate-100">
                    <td className="p-2">{item.nome}</td>
                    <td className="p-2">{item.data || '-'}</td>
                    <td className="p-2 text-right text-rose-400">{formatCurrencyBR(item.valorGlosa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
              <span className="text-slate-400 text-xs mr-2">Total da glosa:</span>
              <span className="text-rose-400 font-bold">{formatCurrencyBR(totalGlosa)}</span>
            </div>
          </div>
        </>
      )}

      {!isLoading && !error && fileName && items.length === 0 && (
        <p className="text-sm text-slate-400">Nenhuma glosa encontrada pelas regras atuais (-40,00 / -62,00).</p>
      )}
    </div>
  );
};
