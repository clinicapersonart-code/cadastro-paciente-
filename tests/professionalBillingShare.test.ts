import { describe, expect, test } from 'vitest';
import {
  buildProfessionalBillingShareRows,
  buildProfessionalBillingShareMessage,
} from '../components/ProfessionalPayouts';
import type { Patient } from '../types';

describe('professional billing share', () => {
  const patients: Patient[] = [
    {
      id: 'p1',
      nome: 'Alice Santos',
      faixa: 'Adulto',
      convenio: 'Funserv',
      profissionais: ['Bruno Alexandre'],
      especialidades: [],
    },
    {
      id: 'p2',
      nome: 'Bob Lima',
      faixa: 'Adulto',
      convenio: 'Gama',
      profissionais: ['Bruno Alexandre'],
      especialidades: [],
    },
    {
      id: 'p3',
      nome: 'Carla Souza',
      faixa: 'Adulto',
      convenio: 'Funserv',
      profissionais: ['Simone'],
      especialidades: [],
    },
  ];

  test('matches imported patient names to cadastro profissional across Funserv and manual convênios', () => {
    const rows = buildProfessionalBillingShareRows({
      patients,
      funservCompetencias: {
        '2026-03': {
          competencia: '2026-03',
          faturamento: {
            fileName: 'funserv-marco.xlsx',
            importedAt: '2026-04-05T10:00:00.000Z',
            dataFechamentoEnvio: '2026-04-05',
            totalContas: 3,
            porPaciente: [
              { nome: 'Alice Santos', sessoes: 2 },
              { nome: 'Carla Souza', sessoes: 1 },
            ],
            itens: [],
          },
        },
      },
      manualLancamentos: {
        Gama: {
          '2026-03': {
            competencia: '2026-03',
            mesRecebimento: '2026-04',
            itens: [
              { id: 'm1', paciente: 'Bob Lima', valorSessao: 100, sessoes: 3 },
            ],
          },
        },
      },
    });

    expect(rows.filter((row) => row.professional === 'Bruno Alexandre')).toEqual([
      expect.objectContaining({
        patientName: 'Alice Santos',
        convenio: 'Funserv',
        competencia: '2026-03',
        fechamentoEnvio: '2026-04-05',
        previsaoPagamento: '2026-05',
        sessoesEnviadas: 2,
        status: 'Aguardando recebimento',
      }),
      expect.objectContaining({
        patientName: 'Bob Lima',
        convenio: 'Gama',
        competencia: '2026-03',
        fechamentoEnvio: 'manual',
        previsaoPagamento: '2026-04',
        sessoesEnviadas: 3,
        valorFaturado: 300,
        status: 'Aguardando recebimento',
      }),
    ]);
    expect(rows.some((row) => row.patientName === 'Carla Souza' && row.professional === 'Bruno Alexandre')).toBe(false);
  });

  test('builds a copyable professional message with fechamento and payment forecast', () => {
    const rows = buildProfessionalBillingShareRows({
      patients,
      funservCompetencias: {
        '2026-03': {
          competencia: '2026-03',
          faturamento: {
            fileName: 'funserv-marco.xlsx',
            importedAt: '2026-04-05T10:00:00.000Z',
            dataFechamentoEnvio: '2026-04-05',
            totalContas: 2,
            porPaciente: [{ nome: 'Alice Santos', sessoes: 2 }],
            itens: [],
          },
        },
      },
      manualLancamentos: {
        Gama: {
          '2026-03': {
            competencia: '2026-03',
            mesRecebimento: '2026-04',
            itens: [{ id: 'm1', paciente: 'Bob Lima', valorSessao: 100, sessoes: 3 }],
          },
        },
      },
    });

    const message = buildProfessionalBillingShareMessage('Bruno Alexandre', rows, '2026-04-10T12:00:00.000Z');

    expect(message).toContain('Fechamento de convênios — Bruno Alexandre');
    expect(message).toContain('Funserv • Competência março de 2026 (2026-03)');
    expect(message).toContain('Fechado/enviado em: 05/04/2026');
    expect(message).toContain('Previsão de pagamento: maio de 2026 (2026-05)');
    expect(message).toContain('- Alice Santos: 2 sessão(ões) enviada(s)');
    expect(message).toContain('Gama • Competência março de 2026 (2026-03)');
    expect(message).toContain('Fechado/enviado em: manual');
    expect(message).toContain('Previsão de pagamento: abril de 2026 (2026-04)');
    expect(message).toContain('- Bob Lima: 3 sessão(ões) enviada(s) • faturado R$ 300,00');
    expect(message).toContain('Total enviado: 5 sessão(ões)');
  });
});
