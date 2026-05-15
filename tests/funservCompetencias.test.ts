import { describe, expect, test } from 'vitest';
import { detectFaturamentoMetadata, summarizeFaturamentoPorPaciente } from '../components/FunservCompetencias';

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

describe('detectFaturamentoMetadata', () => {
  test('extrai dados do relatório Produção - Faturado gerado no fechamento Funserv', () => {
    const rows = [
      ['', '', '', '', '', '', '', 'Página:', '1.'],
      ['', '', '', '', '', '', '', 'Emissão:', '12/05/2026 0019:29'],
      ['', '', '', '', '', '', '', 'Relatório:', 'frm0700400'],
      ['', '', '', 'Produção - Faturado'],
      ['Prestador:', 'CLIN. DE PSICOLOGIA PERSONART LTDA'],
      [],
      ['Autorização', 'Data', 'Matrícula', 'Nome', 'Lote'],
      ['6791391', '01/04/2026', '1980800', 'FLAVIA SABINA LIBANEO', '75416'],
      ['Qtde Contas:', '192'],
    ];

    expect(detectFaturamentoMetadata(rows)).toEqual({
      titulo: 'Produção - Faturado',
      prestador: 'CLIN. DE PSICOLOGIA PERSONART LTDA',
      emissao: '12/05/2026 0019:29',
      dataFechamentoEnvio: '2026-05-12',
      relatorio: 'frm0700400',
      qtdeContas: 192,
    });
  });
});
