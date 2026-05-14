import { describe, expect, test } from 'vitest';
import { summarizeFaturamentoPorPaciente } from '../components/FunservCompetencias';

describe('summarizeFaturamentoPorPaciente', () => {
  test('groups billed Funserv sessions by patient name and sorts alphabetically', () => {
    const rows = [
      { autorizacao: '100', data: '01/04/2026', matricula: '1', nome: 'Maria Silva', lote: 'A' },
      { autorizacao: '101', data: '08/04/2026', matricula: '1', nome: 'Maria Silva', lote: 'A' },
      { autorizacao: '102', data: '01/04/2026', matricula: '2', nome: 'Ana Souza', lote: 'A' },
    ];

    expect(summarizeFaturamentoPorPaciente(rows)).toEqual([
      { nome: 'Ana Souza', sessoes: 1 },
      { nome: 'Maria Silva', sessoes: 2 },
    ]);
  });
});
