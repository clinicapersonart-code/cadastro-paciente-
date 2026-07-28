export const PATIENT_DOCUMENTS_BUCKET = 'patient-documents';
export const MAX_PATIENT_DOCUMENT_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
};

const ALLOWED_MIME_TYPES = new Set(Object.values(MIME_TYPES_BY_EXTENSION));

const ALLOWED_EXTENSIONS = new Set(Object.keys(MIME_TYPES_BY_EXTENSION));

type UploadFileLike = Pick<File, 'name' | 'type' | 'size'>;

const getExtension = (fileName: string): string => {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() || '' : '';
};

export const isAllowedPatientDocumentFile = (file: UploadFileLike): boolean => {
  const mimeType = file.type?.toLowerCase();
  const extension = getExtension(file.name);

  return ALLOWED_MIME_TYPES.has(mimeType) || ALLOWED_EXTENSIONS.has(extension);
};

export const inferPatientDocumentMimeType = (file: UploadFileLike): string | undefined => {
  const mimeType = file.type?.toLowerCase();
  if (ALLOWED_MIME_TYPES.has(mimeType)) return mimeType;

  return MIME_TYPES_BY_EXTENSION[getExtension(file.name)];
};

export const validatePatientDocumentFile = (file: UploadFileLike): { ok: true } | { ok: false; message: string } => {
  if (!isAllowedPatientDocumentFile(file)) {
    return {
      ok: false,
      message: 'Formato não permitido. Envie PDF, DOC, DOCX ou imagem.',
    };
  }

  if (file.size > MAX_PATIENT_DOCUMENT_FILE_SIZE_BYTES) {
    return {
      ok: false,
      message: 'Arquivo muito grande. Limite máximo: 20 MB.',
    };
  }

  return { ok: true };
};

const removeDiacritics = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const sanitizeStorageSegment = (value: string): string => {
  const sanitized = removeDiacritics(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');

  return sanitized || 'arquivo';
};

export const buildPatientDocumentStoragePath = (patientId: string, documentId: string, fileName: string): string => {
  return `${sanitizeStorageSegment(patientId)}/${sanitizeStorageSegment(documentId)}/${sanitizeStorageSegment(fileName)}`;
};

export const formatPatientDocumentFileSize = (bytes?: number): string => {
  if (bytes === undefined || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${Number(kilobytes.toFixed(1))} KB`;

  const megabytes = kilobytes / 1024;
  return `${Number(megabytes.toFixed(1))} MB`;
};
