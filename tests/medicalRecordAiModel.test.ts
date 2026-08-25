import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const apiSource = readFileSync('api/medical-record-ai.ts', 'utf8');
const medicalRecordSource = readFileSync('components/MedicalRecord.tsx', 'utf8');

describe('medical record AI Groq model selection', () => {
  it('uses the free Groq reasoning model as the server default', () => {
    expect(apiSource).toContain("const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b'");
    expect(apiSource).toContain('process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL');
  });

  it('uses the same Groq model in the legacy browser fallback', () => {
    expect(medicalRecordSource).toContain("model: 'openai/gpt-oss-120b'");
  });

  it('does not keep the unavailable retired/default Llama model anywhere in the AI path', () => {
    expect(apiSource).not.toContain('llama-3.3-70b-versatile');
    expect(medicalRecordSource).not.toContain('llama-3.3-70b-versatile');
  });
});
