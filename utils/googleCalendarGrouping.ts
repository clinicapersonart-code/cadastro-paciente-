import type { ImportCandidate } from '../api/google-calendar-import';

export type { ImportCandidate };

export type DetectedRecurrence = 'weekly' | 'biweekly' | 'monthly' | 'none';

export interface ImportSeriesGroup {
  type: 'series';
  recurringEventId: string;
  calendarId: string;
  professionalName: string;
  candidates: ImportCandidate[];
  detectedRecurrence: DetectedRecurrence;
}

export interface ImportIndividualGroup {
  type: 'individual';
  candidate: ImportCandidate;
}

export type ImportGroup = ImportSeriesGroup | ImportIndividualGroup;

/**
 * Detecta padrão de recorrência a partir de datas YYYY-MM-DD ordenadas.
 * Requer ao menos 2 datas; qualquer intervalo fora dos padrões retorna 'none'.
 */
export function detectRecurrencePattern(sortedDates: string[]): DetectedRecurrence {
  if (sortedDates.length < 2) return 'none';

  const intervals: number[] = [];
  for (let i = 1; i < sortedDates.length; i++) {
    const msA = new Date(sortedDates[i - 1]).getTime();
    const msB = new Date(sortedDates[i]).getTime();
    intervals.push(Math.round((msB - msA) / (24 * 60 * 60 * 1000)));
  }

  if (intervals.every(d => d === 7)) return 'weekly';
  if (intervals.every(d => d === 14)) return 'biweekly';
  if (intervals.every(d => d >= 28 && d <= 31)) return 'monthly';
  return 'none';
}

/**
 * Agrupa candidatos de importação:
 * - 2+ candidatos com mesmo recurringEventId+calendarId → ImportSeriesGroup
 * - demais (sem recurringEventId ou série com apenas 1 ocorrência no período) → ImportIndividualGroup
 * Retorna grupos ordenados pela data mais cedo do primeiro candidato.
 */
export function groupImportCandidates(candidates: ImportCandidate[]): ImportGroup[] {
  const seriesMap = new Map<string, ImportCandidate[]>();
  const individuals: ImportCandidate[] = [];

  for (const candidate of candidates) {
    if (candidate.recurringEventId) {
      const key = `${candidate.calendarId}::${candidate.recurringEventId}`;
      if (!seriesMap.has(key)) seriesMap.set(key, []);
      seriesMap.get(key)!.push(candidate);
    } else {
      individuals.push(candidate);
    }
  }

  const groups: ImportGroup[] = [];

  for (const [, seriesCandidates] of seriesMap) {
    if (seriesCandidates.length < 2) {
      // Série com apenas 1 ocorrência no período → exibe como individual
      individuals.push(seriesCandidates[0]);
    } else {
      const sorted = [...seriesCandidates].sort((a, b) => a.date.localeCompare(b.date));
      const detectedRecurrence = detectRecurrencePattern(sorted.map(c => c.date));

      // Segurança operacional: se não conseguimos inferir semanal/quinzenal/mensal,
      // não inventamos uma série local com RRULE diferente do Google. Mantém revisão/importação por ocorrência.
      if (detectedRecurrence === 'none') {
        individuals.push(...sorted);
        continue;
      }

      const first = sorted[0];
      groups.push({
        type: 'series',
        recurringEventId: first.recurringEventId!,
        calendarId: first.calendarId,
        professionalName: first.professionalName,
        candidates: sorted,
        detectedRecurrence,
      });
    }
  }

  for (const candidate of individuals) {
    groups.push({ type: 'individual', candidate });
  }

  return groups.sort((a, b) => {
    const dateA = a.type === 'individual' ? a.candidate.date : a.candidates[0].date;
    const dateB = b.type === 'individual' ? b.candidate.date : b.candidates[0].date;
    return dateA.localeCompare(dateB);
  });
}
