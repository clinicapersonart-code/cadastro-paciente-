import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('PatientForm layout', () => {
  test('uses a single professionals section instead of duplicate linked-professional controls', () => {
    const source = readFileSync(new URL('../components/PatientForm.tsx', import.meta.url), 'utf8');

    expect(source).toContain('Profissionais por papel');
    expect(source).not.toContain('Profissionais vinculados');
    expect(source).not.toContain('Adicionar profissional ao paciente');
  });
});
