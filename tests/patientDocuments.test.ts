import { describe, expect, it } from 'vitest';
import {
  buildPatientDocumentStoragePath,
  formatPatientDocumentFileSize,
  inferPatientDocumentMimeType,
  isAllowedPatientDocumentFile,
  validatePatientDocumentFile,
} from '../utils/patientDocuments';

const makeFile = (name: string, type: string, size = 1024) => ({ name, type, size } as File);

describe('patient document uploads', () => {
  it('accepts pdf, doc, docx and image files', () => {
    expect(isAllowedPatientDocumentFile(makeFile('laudo.pdf', 'application/pdf'))).toBe(true);
    expect(isAllowedPatientDocumentFile(makeFile('relatorio.doc', 'application/msword'))).toBe(true);
    expect(isAllowedPatientDocumentFile(makeFile('contrato.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toBe(true);
    expect(isAllowedPatientDocumentFile(makeFile('foto.png', 'image/png'))).toBe(true);
    expect(isAllowedPatientDocumentFile(makeFile('scan.jpg', 'image/jpeg'))).toBe(true);
  });

  it('rejects unsupported or oversized patient document files', () => {
    expect(validatePatientDocumentFile(makeFile('planilha.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).ok).toBe(false);
    expect(validatePatientDocumentFile(makeFile('video.mp4', 'video/mp4')).ok).toBe(false);
    expect(validatePatientDocumentFile(makeFile('laudo.pdf', 'application/pdf', 21 * 1024 * 1024)).ok).toBe(false);
  });

  it('builds a safe storage path per patient and document', () => {
    expect(buildPatientDocumentStoragePath('paciente 123/abc', 'doc-456', 'Laudo João #1.pdf'))
      .toBe('paciente-123-abc/doc-456/Laudo-Joao-1.pdf');
  });

  it('infers content type from extension when the browser does not provide one', () => {
    expect(inferPatientDocumentMimeType(makeFile('laudo.pdf', ''))).toBe('application/pdf');
    expect(inferPatientDocumentMimeType(makeFile('contrato.docx', ''))).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(inferPatientDocumentMimeType(makeFile('foto.jpeg', ''))).toBe('image/jpeg');
    expect(inferPatientDocumentMimeType(makeFile('scan.png', 'image/png'))).toBe('image/png');
  });

  it('formats file sizes for the document list', () => {
    expect(formatPatientDocumentFileSize(950)).toBe('950 B');
    expect(formatPatientDocumentFileSize(1536)).toBe('1.5 KB');
    expect(formatPatientDocumentFileSize(2 * 1024 * 1024)).toBe('2 MB');
  });
});
