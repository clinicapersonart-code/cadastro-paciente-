
import { Patient } from '../types';

export function downloadFile(filename: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToCSV(patients: Patient[]): string {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const formatShort = (iso?: string) => {
        if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y.slice(-2)}`;
    };

    const header = ['id', 'nome', 'nascimento(dd/mm/aa)', 'faixa', 'responsavel', 'endereco', 'contato', 'email', 'convenio', 'carteirinha', 'tipoAtendimento', 'profissionais', 'especialidades', 'crm', 'origem'];
    const lines = [header.join(',')];

    for (const p of patients) {
        const arr = [
            p.id, p.nome, formatShort(p.nascimento), p.faixa, p.responsavel,
            p.endereco, p.contato, p.email, p.convenio, p.carteirinha, p.tipoAtendimento,
            p.profissionais.join(' | '),
            p.especialidades.join(' | '),
            p.crm, p.origem
        ];
        lines.push(arr.map(esc).join(','));
    }
    return lines.join('\n');
}

export function readTextFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function readDataURLFromFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
