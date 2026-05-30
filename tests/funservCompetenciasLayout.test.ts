import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { FaturamentoHub } from '../components/FaturamentoHub';
import { FunservCompetencias } from '../components/FunservCompetencias';

const setupWindowStorage = (initial: Record<string, string> = {}) => {
  const storage = new Map<string, string>(Object.entries(initial));
  const windowMock = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  };
  (globalThis as unknown as { window: typeof windowMock }).window = windowMock;
};

describe('FunservCompetencias layout', () => {
  test('separa faturamento e recebimento em blocos verticais com nomes operacionais', () => {
    setupWindowStorage();

    const html = renderToStaticMarkup(React.createElement(FunservCompetencias));

    expect(html).toMatch(/Faturamento — guias enviadas/);
    expect(html).toMatch(/Recebimento — conferência e glosas/);
    expect(html).toMatch(/Mostra pacientes, datas de atendimento e sessões enviadas, sem valores/);
    expect(html).toMatch(/Mostra valor processado, glosa, líquido e repasse confirmado/);
    expect(html).not.toContain('lg:grid-cols-2');
  });

  test('mostra data completa de fechamento/envio no faturamento e na tabela da competência', () => {
    setupWindowStorage({
      'personart.funserv.competencias.v1': JSON.stringify({
        '2026-05': {
          competencia: '2026-05',
          faturamento: {
            fileName: 'funserv-maio.xlsx',
            importedAt: '2026-05-15T12:00:00.000Z',
            dataFechamentoEnvio: '2026-05-15',
            titulo: 'Produção - Faturado',
            prestador: 'CLIN. DE PSICOLOGIA PERSONART LTDA',
            emissao: '15/05/2026 09:00:00',
            relatorio: 'frm0700400',
            qtdeContas: 1,
            totalContas: 1,
            porPaciente: [{ nome: 'Paciente Teste', sessoes: 1 }],
            itens: [{ autorizacao: '123', data: '10/05/2026', matricula: '456', nome: 'Paciente Teste', lote: '1' }],
          },
        },
      }),
    });

    const html = renderToStaticMarkup(React.createElement(FunservCompetencias));

    expect(html).toMatch(/Fechado\/enviado em/);
    expect(html).toMatch(/Dados detectados do fechamento/);
    expect(html).toMatch(/Produção - Faturado/);
    expect(html).toMatch(/CLIN\. DE PSICOLOGIA PERSONART LTDA/);
    expect(html).toMatch(/frm0700400/);
    expect(html).toMatch(/Qtde Contas no arquivo: 1/);
    expect(html).toContain('type="date"');
    expect(html).toContain('value="2026-05-15"');
    expect(html).toMatch(/15\/05\/2026/);
  });

  test('mantem o contador de guias Funserv via extensao Chrome dentro de Convênios', () => {
    setupWindowStorage();

    const html = renderToStaticMarkup(React.createElement(FaturamentoHub, {
      patients: [],
      onSavePatient: () => undefined,
      convenios: [{ id: 'conv-funserv', name: 'Funserv', active: true }],
      setConvenios: () => undefined,
      appointments: [],
    }));

    expect(html).toMatch(/Fechamentos \/ recebimentos/);
    expect(html).toMatch(/Contador de guias \(extensão\)/);
    expect(html).toMatch(/Faturamento — guias enviadas/);
  });
});
