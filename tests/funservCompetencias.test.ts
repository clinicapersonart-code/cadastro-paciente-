import { describe, expect, test } from 'vitest';
import { detectFaturamentoMetadata, groupFaturamentoGuiasPorPaciente, summarizeFaturamentoPorPaciente } from '../components/FunservCompetencias';

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

describe('groupFaturamentoGuiasPorPaciente', () => {
  test('groups patient guide count and keeps atendimento date + protocolo details', () => {
    const alexia1 = { autorizacao: '68123456', data: '14/05/2026', matricula: '1', nome: 'Alexia Eduarda Moraes', lote: 'A' };
    const alexia2 = { autorizacao: '68123457', data: '07/05/2026', matricula: '1', nome: 'Alexia Eduarda Moraes', lote: 'A' };
    const bruna = { autorizacao: '68123458', data: '08/05/2026', matricula: '2', nome: 'Bruna Teste', lote: 'A' };

    expect(groupFaturamentoGuiasPorPaciente([alexia1, bruna, alexia2])).toEqual([
      {
        nome: 'Alexia Eduarda Moraes',
        sessoes: 2,
        itens: [alexia2, alexia1],
      },
      {
        nome: 'Bruna Teste',
        sessoes: 1,
        itens: [bruna],
      },
    ]);
  });
});

describe('adiamento de guias Funserv', () => {
  test('remove a guia do fechamento atual e deixa pendente no próximo mês', async () => {
    const { deferFaturamentoItemToNextCompetencia } = await import('../components/FunservCompetencias');
    const guiaParaAdiar = { autorizacao: '101', data: '08/04/2026', matricula: '1', nome: 'Maria Silva', lote: 'A' };

    const result = deferFaturamentoItemToNextCompetencia({
      '2026-04': {
        competencia: '2026-04',
        faturamento: {
          fileName: 'abril.xlsx',
          importedAt: '2026-04-30T12:00:00.000Z',
          totalContas: 2,
          porPaciente: [{ nome: 'Maria Silva', sessoes: 2 }],
          itens: [
            { autorizacao: '100', data: '01/04/2026', matricula: '1', nome: 'Maria Silva', lote: 'A' },
            guiaParaAdiar,
          ],
        },
      },
    }, '2026-04', guiaParaAdiar, '2026-05-01T10:00:00.000Z');

    expect(result['2026-04'].faturamento?.itens).toEqual([
      { autorizacao: '100', data: '01/04/2026', matricula: '1', nome: 'Maria Silva', lote: 'A' },
    ]);
    expect(result['2026-04'].faturamento?.totalContas).toBe(1);
    expect(result['2026-04'].faturamento?.porPaciente).toEqual([{ nome: 'Maria Silva', sessoes: 1 }]);
    expect(result['2026-05'].guiasPendentesFechamento).toEqual([
      { ...guiaParaAdiar, origemCompetencia: '2026-04', adiadaEm: '2026-05-01T10:00:00.000Z' },
    ]);
  });

  test('inclui guias pendentes no próximo upload sem duplicar autorização já presente no arquivo', async () => {
    const { mergeFaturamentoItens } = await import('../components/FunservCompetencias');
    const guiaPendente = { autorizacao: '101', data: '08/04/2026', matricula: '1', nome: 'Maria Silva', lote: 'A' };

    expect(mergeFaturamentoItens([
      guiaPendente,
      guiaPendente,
      { autorizacao: '102', data: '02/05/2026', matricula: '2', nome: 'Ana Souza', lote: 'B' },
    ])).toEqual([
      guiaPendente,
      { autorizacao: '102', data: '02/05/2026', matricula: '2', nome: 'Ana Souza', lote: 'B' },
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
