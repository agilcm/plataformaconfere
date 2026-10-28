// Gera relatórios em PDF no layout oficial da Ágil CM:
// faixa azul-marinho com a logo no topo e rodapé azul com os dados de contato.
import { COMPANY_PROFILE } from '../data/servicesData.ts';

export type Align = 'left' | 'center' | 'right';
export interface Cell {
  text: string;
  align?: Align;
  bold?: boolean;
}
export type Block =
  | { type: 'date'; text: string }
  | { type: 'title'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'para'; text: string; bold?: boolean; indent?: boolean; size?: number; color?: 'muted'; gapAfter?: number }
  | { type: 'rich'; parts: { text: string; bold?: boolean }[]; gapAfter?: number }
  | { type: 'bullets'; items: string[] }
  | { type: 'note'; text: string }
  | { type: 'table'; widths: number[]; header?: string[]; headerAlign?: Align[]; rows: (string | Cell)[][]; totalRows?: number }
  | { type: 'space'; h: number }
  | { type: 'signature'; name: string; role: string };

type SaveResult = 'saved' | 'declined';

export async function downloadPdf(fileName: string, docTitle: string, blocks: Block[]): Promise<SaveResult> {
  const { buildPdf } = await import('./pdfBuild.ts');
  const bytes = await buildPdf(docTitle, blocks);
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });

  // Dentro do visualizador do Claude o download passa pela confirmação da plataforma
  const claude = (window as unknown as { claude?: { use?: (n: string) => Promise<any> } }).claude;
  if (claude?.use) {
    const downloads = await claude.use('downloads');
    if (downloads) {
      try {
        await downloads.save({ filename: fileName, data: blob });
        return 'saved';
      } catch (e) {
        const code = (e as { code?: string })?.code;
        if (code === 'declined') return 'declined';
        if (code === 'rate_limited') throw e;
        // Outros casos (indisponível neste app etc.): tenta o download comum do navegador
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'saved';
}

export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'documento';

export const dateText = (d = new Date()) =>
  `${COMPANY_PROFILE.cityShort}, ${d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
