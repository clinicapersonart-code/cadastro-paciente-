import type { ImportCandidate } from '../api/google-calendar-import';

export type { ImportCandidate };

export type ListImportCandidatesResult = {
  ok: boolean;
  candidates: ImportCandidate[];
  error?: string;
};

export async function listImportCandidates(
  timeMin: string,
  timeMax: string,
): Promise<ListImportCandidatesResult> {
  const params = new URLSearchParams({ timeMin, timeMax });
  const res = await fetch(`/api/google-calendar-import?${params}`);
  const json = (await res.json()) as ListImportCandidatesResult;
  if (!res.ok || !json.ok) {
    throw new Error(json?.error ?? `Falha ao listar candidatos (HTTP ${res.status})`);
  }
  return json;
}
