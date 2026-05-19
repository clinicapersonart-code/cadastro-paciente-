import { describe, expect, test } from 'vitest';
import {
  buildProfessionalPaymentGuideRows,
  buildProfessionalPaymentGuideMessage,
  getProfessionalDiscountRate,
} from '../components/ProfessionalPayouts';
import type { Patient } from '../types';

describe('professional payment guide share', () => {
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

  test('applies clinic discount rules by professional and convenio', () => {
    expect(getProfessionalDiscountRate('Bruno Alexandre', 'Funserv')).toBe(0.11);
    expect(getProfessionalDiscountRate('Bruno Alexandre', 'Gama')).toBe(0.06);
    expect(getProfessionalDiscountRate('Stephanie Silva', 'Funserv')).toBe(0.11);
    expect(getProfessionalDiscountRate('Janaína Souza', 'Danamed')).toBe(0.06);
    expect(getProfessionalDiscountRate('Soraia Lima', 'Gama')).toBe(0.06);
    expect(getProfessionalDiscountRate('Simone Silva', 'Funserv')).toBe(0.18);
    expect(getProfessionalDiscountRate('Geovana Costa', 'Danamed')).toBe(0.18);
    expect(getProfessionalDiscountRate('Outro Profissional', 'Funserv')).toBe(0.25);
  });

  test('builds payment-guide rows only from received/payment-guide values across all convênios', () => {
    const rows = buildProfessionalPaymentGuideRows({
      patients,
      mesPagamento: '2026-05',
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
          recebimento: {
            itens: [
              { nome: 'Alice Santos', valorProcessado: 40, valorDiferenca: 0 },
              { nome: 'Alice Santos', valorProcessado: 60, valorDiferenca: 0 },
              { nome: 'Carla Souza', valorProcessado: 40, valorDiferenca: 0 },
            ],
          },
        },
        '2026-04': {
          competencia: '2026-04',
          faturamento: {
            fileName: 'funserv-abril.xlsx',
            importedAt: '2026-05-05T10:00:00.000Z',
            totalContas: 1,
            porPaciente: [{ nome: 'Alice Santos', sessoes: 1 }],
            itens: [],
          },
        },
      },
      manualLancamentos: {
        Gama: {
          '2026-03': {
            competencia: '2026-03',
            mesRecebimento: '2026-05',
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
        mesPagamento: '2026-05',
        sessoes: 2,
        valorRecebido: 100,
        descontoRate: 0.11,
        valorDesconto: 11,
        valorRepasse: 89,
      }),
      expect.objectContaining({
        patientName: 'Bob Lima',
        convenio: 'Gama',
        competencia: '2026-03',
        mesPagamento: '2026-05',
        sessoes: 3,
        valorRecebido: 300,
        descontoRate: 0.06,
        valorDesconto: 18,
        valorRepasse: 282,
      }),
    ]);

    expect(rows.some((row) => row.competencia === '2026-04')).toBe(false);
  });

  test('builds a copyable payment guide message with values and discounts', () => {
    const rows = buildProfessionalPaymentGuideRows({
      patients,
      mesPagamento: '2026-05',
      funservCompetencias: {
        '2026-03': {
          competencia: '2026-03',
          recebimento: {
            itens: [
              { nome: 'Alice Santos', valorProcessado: 40, valorDiferenca: 0 },
              { nome: 'Alice Santos', valorProcessado: 60, valorDiferenca: 0 },
            ],
          },
        },
      },
      manualLancamentos: {
        Gama: {
          '2026-03': {
            competencia: '2026-03',
            mesRecebimento: '2026-05',
            itens: [{ id: 'm1', paciente: 'Bob Lima', valorSessao: 100, sessoes: 3 }],
          },
        },
      },
    });

    const message = buildProfessionalPaymentGuideMessage('Bruno Alexandre', rows, '2026-05', '2026-05-10T12:00:00.000Z');

    expect(message).toContain('Guia de pagamento — Bruno Alexandre');
    expect(message).toContain('Mês de pagamento: maio de 2026 (2026-05)');
    expect(message).toContain('Funserv • Competência março de 2026 (2026-03)');
    expect(message).toContain('- Alice Santos: 2 sessão(ões) • recebido R$ 100,00 • desconto 11% • repasse R$ 89,00');
    expect(message).toContain('Gama • Competência março de 2026 (2026-03)');
    expect(message).toContain('- Bob Lima: 3 sessão(ões) • recebido R$ 300,00 • desconto 6% • repasse R$ 282,00');
    expect(message).toContain('Total recebido: R$ 400,00');
    expect(message).toContain('Total descontos: R$ 29,00');
    expect(message).toContain('Total repasse: R$ 371,00');
    expect(message).not.toContain('Fechado/enviado em');
  });
});
