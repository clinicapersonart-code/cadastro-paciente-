import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { FunservCompetencias } from '../components/FunservCompetencias';

describe('FunservCompetencias layout', () => {
  test('separa faturamento e recebimento em blocos verticais com nomes operacionais', () => {
    const storage = new Map<string, string>();
    const windowMock = {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    };
    (globalThis as unknown as { window: typeof windowMock }).window = windowMock;

    const html = renderToStaticMarkup(React.createElement(FunservCompetencias));

    expect(html).toMatch(/Faturamento — guias enviadas/);
    expect(html).toMatch(/Recebimento — conferência e glosas/);
    expect(html).toMatch(/Mostra pacientes, datas de atendimento e sessões enviadas, sem valores/);
    expect(html).toMatch(/Mostra valor processado, glosa, líquido e repasse confirmado/);
    expect(html).not.toContain('lg:grid-cols-2');
  });
});
