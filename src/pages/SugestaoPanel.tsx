// Botão "Sugestão": o escritório envia o CSV do cadastro (Alterdata) e recebe um PDF
// dizendo qual empresa da carteira pode disputar qual edital aberto.
// O arquivo é lido apenas no navegador (FileReader). Nada é enviado nem salvo.
import { useRef, useState } from 'react';
import { Icon } from '../components/ui.tsx';
import { fetchAllMG, filterEditais } from '../lib/pncp.js';
import { callApi, formatHora, loadLocal, saveLocal } from '../lib/pncpClient.ts';
import { dateText, downloadPdf, type Block } from '../lib/pdfReport.ts';
import { parseAlterdataCsv, sugerirEditais, sugestoesReport } from '../lib/sugestoes.js';

type Escopo = 'mg' | 'zona-da-mata';
type Etapa = 'idle' | 'editais' | 'cruzando' | 'pdf' | 'pronto' | 'erro';

interface Empresa {
  razao: string;
  fantasia: string;
  cidade: string;
  cnae: string;
}
interface ResultadoLinha {
  empresa: Empresa;
  regra: { area: string };
  sugestoes: { score: number; edital: { municipio: string; objeto: string; titulo: string } }[];
  total: number;
}

async function lerArquivo(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  // Exportações antigas vêm em Windows-1252: se aparecer caractere inválido, relê nesse padrão
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(buf) : utf8;
}

export default function SugestaoPanel({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState('');
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null);
  const [linhas, setLinhas] = useState(0);
  const [escopo, setEscopo] = useState<Escopo>('mg');
  const [etapa, setEtapa] = useState<Etapa>('idle');
  const [progresso, setProgresso] = useState<{ loaded: number; total: number } | null>(null);
  const [msg, setMsg] = useState('');
  const [resumo, setResumo] = useState<{ com: number; editais: number; base: string; top: ResultadoLinha[] } | null>(null);
  const blocksRef = useRef<Block[] | null>(null);

  const escolher = async (file?: File | null) => {
    setResumo(null);
    setEtapa('idle');
    setMsg('');
    if (!file) return;
    try {
      const { empresas: lista, totalLinhas } = parseAlterdataCsv(await lerArquivo(file));
      setArquivo(file.name);
      setEmpresas(lista);
      setLinhas(totalLinhas);
      if (!lista.length) {
        setEtapa('erro');
        setMsg('Nenhuma empresa ativa com CNPJ foi encontrada neste arquivo.');
      }
    } catch (e) {
      setEmpresas(null);
      setEtapa('erro');
      setMsg((e as Error).message || 'Não consegui ler este arquivo.');
    }
  };

  // Todos os editais abertos de MG: servidor → PNCP direto → última lista salva → amostra
  const carregarEditais = async (): Promise<{ items: any[]; atualizadoEm: string; base: string }> => {
    const viaApi = await callApi<{ items: any[]; atualizadoEm: string; incompleto?: boolean }>('editais', { todos: '1', regiao: escopo });
    if (viaApi?.items?.length) {
      saveLocal(`editais:todos:${escopo}`, viaApi);
      return { ...viaApi, base: viaApi.incompleto ? 'PNCP (parte das páginas não respondeu)' : 'PNCP ao vivo' };
    }
    try {
      const r = await fetchAllMG({ onProgress: (loaded: number, total: number) => setProgresso({ loaded, total }) });
      setProgresso(null);
      const items = filterEditais(r.items, { regiao: escopo });
      if (items.length) {
        const out = { items, atualizadoEm: new Date().toISOString() };
        saveLocal(`editais:todos:${escopo}`, out);
        return { ...out, base: 'PNCP ao vivo' };
      }
    } catch {
      setProgresso(null);
    }
    const salvo = loadLocal<{ items: any[]; atualizadoEm: string }>(`editais:todos:${escopo}`);
    if (salvo) return { ...salvo.value, base: `última consulta salva (${formatHora(salvo.at)})` };
    const sample = typeof window !== 'undefined' ? window.__PNCP_SAMPLE__ : undefined;
    if (sample) return { items: filterEditais(sample.items, { regiao: escopo }), atualizadoEm: sample.capturadoEm, base: 'amostra capturada do PNCP' };
    throw new Error('O PNCP não respondeu agora. Tente de novo em alguns minutos.');
  };

  const gerar = async () => {
    if (!empresas?.length) return;
    setResumo(null);
    setMsg('');
    try {
      setEtapa('editais');
      const { items, atualizadoEm, base } = await carregarEditais();
      setEtapa('cruzando');
      await new Promise((r) => setTimeout(r, 30));
      const agora = new Date();
      const r = sugerirEditais(empresas, items, { agora, maxPorEmpresa: 3, soZonaDaMata: escopo === 'zona-da-mata' });
      const blocks = sugestoesReport(r, {
        dataText: dateText(agora),
        regiaoTexto: escopo === 'zona-da-mata' ? 'Zona da Mata mineira' : 'Minas Gerais, com prioridade para a Zona da Mata',
        totalEmpresas: empresas.length,
        atualizadoEm: formatHora(atualizadoEm),
      }) as Block[];
      blocksRef.current = blocks;
      const editaisComEmpresa = new Set(r.resultado.flatMap((x: any) => x.todas.map((s: any) => s.edital.link)));
      setResumo({ com: r.resultado.length, editais: editaisComEmpresa.size, base, top: r.resultado.slice(0, 5) });
      setEtapa('pdf');
      const res = await downloadPdf('sugestoes-editais-agil-cm.pdf', 'Sugestão de editais por empresa', blocks);
      setEtapa('pronto');
      setMsg(res === 'declined' ? 'Download cancelado. Clique em "Baixar PDF" para tentar de novo.' : '');
    } catch (e) {
      setEtapa('erro');
      setMsg((e as Error).message || 'Não foi possível gerar o PDF.');
    }
  };

  const baixarDeNovo = async () => {
    if (!blocksRef.current) return;
    try {
      await downloadPdf('sugestoes-editais-agil-cm.pdf', 'Sugestão de editais por empresa', blocksRef.current);
    } catch {
      setMsg('Não foi possível baixar o PDF neste navegador.');
    }
  };

  const ocupado = etapa === 'editais' || etapa === 'cruzando' || etapa === 'pdf';

  return (
    <section id="sugestao" aria-labelledby="sugestao-titulo" className="mt-4 p-5 sm:p-7 rounded-2xl bg-white border-2 border-[#0478CA]/30 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-[#0478CA]">Sugestão por CNAE</p>
          <h2 id="sugestao-titulo" className="mt-1 text-2xl font-bold font-display text-[#0F2053]">
            Qual empresa da carteira pode disputar qual edital?
          </h2>
          <p className="mt-2 text-base text-slate-600 max-w-2xl leading-relaxed">
            Envie o CSV do cadastro geral do Alterdata. Cruzamos a atividade (CNAE) de cada empresa com os editais abertos e geramos
            um PDF no layout da Ágil CM.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar sugestão" className="shrink-0 w-10 h-10 rounded-full hover:bg-slate-100 text-slate-500 text-2xl leading-none cursor-pointer">
          ×
        </button>
      </div>

      <p className="mt-4 flex items-start gap-2 p-3.5 rounded-xl bg-[#128C4A]/8 border border-[#128C4A]/20 text-[15px] text-[#0E5C33]">
        <Icon name="shield" className="w-5 h-5 shrink-0 mt-0.5" />
        <span>
          <strong>Privacidade:</strong> o arquivo é lido só neste navegador. Os dados das empresas não são enviados para a internet nem
          ficam salvos no site.
        </span>
      </p>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-bold text-slate-700 mb-2">1. Arquivo do cadastro (CSV)</p>
          <input
            ref={inputRef}
            id="sugestao-csv"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => escolher(e.target.files?.[0])}
          />
          <label
            htmlFor="sugestao-csv"
            className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#0478CA] cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              escolher(e.dataTransfer.files?.[0]);
            }}
          >
            <Icon name="sheet" className="w-8 h-8 text-[#0478CA] shrink-0" />
            <span className="min-w-0">
              <span className="block font-bold text-[#0F2053] truncate">{arquivo || 'Escolher ou arrastar o arquivo .csv'}</span>
              <span className="block text-sm text-slate-600">
                {empresas
                  ? `${empresas.length.toLocaleString('pt-BR')} empresas ativas aptas (de ${linhas.toLocaleString('pt-BR')} linhas)`
                  : 'Alterdata › Cadastro geral de empresas › exportar CSV'}
              </span>
            </span>
          </label>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-700 mb-2">2. Editais que entram na análise</p>
          <div role="group" aria-label="Região dos editais" className="grid gap-2">
            {(
              [
                ['mg', 'Toda Minas Gerais', 'Prioriza os mais perto de cada empresa'],
                ['zona-da-mata', 'Só Zona da Mata', '142 municípios da região'],
              ] as const
            ).map(([v, t, d]) => (
              <button
                key={v}
                type="button"
                aria-pressed={escopo === v}
                onClick={() => setEscopo(v)}
                className={`text-left px-4 py-2.5 rounded-xl border-2 transition-colors cursor-pointer ${
                  escopo === v ? 'border-[#0478CA] bg-[#0478CA]/5' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="block font-bold text-[#0F2053]">{t}</span>
                <span className="block text-sm text-slate-600">{d}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          type="button"
          onClick={gerar}
          disabled={!empresas?.length || ocupado}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#0478CA] hover:bg-[#03609F] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-base font-bold cursor-pointer"
        >
          <Icon name="doc" className="w-5 h-5" />
          {ocupado ? 'Gerando…' : 'Gerar PDF de sugestões'}
        </button>
        <p className="text-[15px] text-slate-600" aria-live="polite">
          {etapa === 'editais' &&
            (progresso
              ? `Lendo editais abertos no PNCP: ${progresso.loaded.toLocaleString('pt-BR')} de ${progresso.total.toLocaleString('pt-BR')}`
              : 'Buscando os editais abertos no PNCP…')}
          {etapa === 'cruzando' && 'Cruzando CNAEs com os editais…'}
          {etapa === 'pdf' && 'Montando o PDF…'}
          {etapa === 'pronto' && !msg && 'PDF gerado.'}
          {!empresas && etapa === 'idle' && 'Escolha o arquivo para liberar o botão.'}
        </p>
      </div>

      {msg && (
        <p role="alert" className={`mt-4 p-4 rounded-xl text-[15px] ${etapa === 'erro' ? 'bg-amber-50 border border-amber-200 text-amber-900' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}>
          {msg}
        </p>
      )}

      {resumo && (
        <div className="mt-5 p-4 sm:p-5 rounded-xl bg-[#F4F7FB] border border-slate-200">
          <p className="text-lg font-bold text-[#0F2053]">
            {resumo.com.toLocaleString('pt-BR')} empresas com edital compatível · {resumo.editais.toLocaleString('pt-BR')} editais com empresa apta
          </p>
          <p className="text-sm text-slate-500">Base: {resumo.base}</p>
          {resumo.top.length > 0 && (
            <ul className="mt-3 space-y-2">
              {resumo.top.map((r) => (
                <li key={r.empresa.razao} className="text-[15px] text-slate-700">
                  <strong className="text-[#0F2053]">{r.empresa.fantasia || r.empresa.razao}</strong> ({r.regra.area}) →{' '}
                  {r.sugestoes
                    .slice(0, 2)
                    .map((s) => s.edital.municipio)
                    .join(', ')}
                  {r.total > 2 ? ` e mais ${r.total - 2}` : ''}
                </li>
              ))}
            </ul>
          )}
          {etapa === 'pronto' && (
            <button type="button" onClick={baixarDeNovo} className="mt-4 font-bold text-[#0478CA] underline cursor-pointer">
              Baixar PDF novamente
            </button>
          )}
        </div>
      )}
      <p className="mt-4 text-sm text-slate-500">
        A sugestão é uma triagem automática pelo CNAE principal e pelo texto do objeto. Confira itens, habilitação e prazo no edital antes
        de disputar.
      </p>
    </section>
  );
}
