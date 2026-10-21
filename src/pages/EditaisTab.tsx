import { useCallback, useEffect, useRef, useState } from 'react';
import { Container, Icon, WhatsAppIcon } from '../components/ui.tsx';
import { formatBRL, whatsappLink } from '../data/servicesData.ts';
import { MICRORREGIOES } from '../data/zonaDaMata.js';
import { contarFontes, fetchAllMG, fetchDetalheCompra, fetchPage, filterEditais, sortByUpdate } from '../lib/pncp.js';
import { callApi, formatHora, loadLocal, saveLocal, type Fonte } from '../lib/pncpClient.ts';
import SugestaoPanel from './SugestaoPanel.tsx';

type Regiao = 'mg' | 'zona-da-mata';

interface Edital {
  id: string;
  titulo: string;
  objeto: string;
  orgao: string;
  unidade: string;
  municipio: string;
  microrregiao: string | null;
  modalidade: string;
  valor: number | null;
  publicadoEm: string;
  atualizadoEm: string;
  propostasAte: string | null;
  link: string;
  linkOrigem: string | null;
  fonte?: string;
  compra?: { cnpj: string; ano: string; seq: string } | null;
}

interface Resultado {
  items: Edital[];
  total: number;
  atualizadoEm?: string;
  desatualizado?: boolean;
  incompleto?: boolean;
}

const PAGE_SIZE = 20;
const FONTES_KEY = 'agilcm:fontes';
const lerFontesSalvas = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(FONTES_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
const MICROS = Object.keys(MICRORREGIOES);

// Datas do PNCP vêm no horário de Brasília, sem fuso: tratamos como -03:00
const parseBR = (s?: string | null) => {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return { d: `${m[3]}/${m[2]}/${m[1]}`, h: `${m[4]}:${m[5]}`, date: new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00-03:00`) };
};

const ha = (s?: string) => {
  const p = parseBR(s);
  if (!p) return '';
  const min = Math.round((Date.now() - p.date.getTime()) / 60000);
  if (min < 60) return `há ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
};

const diasAte = (s?: string | null) => {
  const p = parseBR(s);
  if (!p) return null;
  return Math.ceil((p.date.getTime() - Date.now()) / 86400000);
};

declare global {
  interface Window {
    __PNCP_SAMPLE__?: { capturadoEm: string; items: Edital[] };
  }
}

export default function EditaisTab() {
  const [regiao, setRegiao] = useState<Regiao>('mg');
  const [micro, setMicro] = useState('');
  const [busca, setBusca] = useState('');
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(1);
  const [items, setItems] = useState<Edital[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progresso, setProgresso] = useState<{ loaded: number; total: number } | null>(null);
  const [erro, setErro] = useState('');
  const [fonte, setFonte] = useState<Fonte>('servidor');
  const [atualizadoEm, setAtualizadoEm] = useState('');
  const [aviso, setAviso] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const [sugestao, setSugestao] = useState(false);
  const [fontes, setFontes] = useState<string[]>([]);
  const [painelFontes, setPainelFontes] = useState(false);
  const [todasFontes, setTodasFontes] = useState(false);
  const [facetas, setFacetas] = useState<{ nome: string; total: number }[] | null>(null);
  const [facetasEstado, setFacetasEstado] = useState<'idle' | 'loading' | 'erro'>('idle');
  const allMG = useRef<Edital[] | null>(null); // cache do modo direto
  const reqId = useRef(0);

  // Busca com pequeno atraso enquanto a pessoa digita
  useEffect(() => {
    const t = setTimeout(() => setQ(busca.trim()), 400);
    return () => clearTimeout(t);
  }, [busca]);

  // Fontes marcadas da última visita (só neste aparelho)
  useEffect(() => {
    const salvas = lerFontesSalvas();
    if (salvas.length) setFontes(salvas);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(FONTES_KEY, JSON.stringify(fontes));
    } catch {
      /* sem armazenamento: só não lembra na próxima visita */
    }
  }, [fontes]);
  const fontesKey = fontes.slice().sort().join('|');

  useEffect(() => setPagina(1), [regiao, micro, q, fontesKey]);

  const carregar = useCallback(async (pag: number): Promise<Resultado & { fonte: Fonte }> => {
    const key = `editais:${regiao}:${micro}:${q}:${fontesKey}:${pag}`;
    // 1) Função do servidor (site publicado na Vercel)
    const p: Record<string, string> = { regiao, pagina: String(pag), tamanho: String(PAGE_SIZE) };
    if (micro) p.micro = micro;
    if (q) p.q = q;
    if (fontesKey) p.fontes = fontesKey;
    const viaApi = await callApi<Resultado>('editais', p);
    if (viaApi) {
      saveLocal(key, viaApi);
      return { ...viaApi, fonte: 'servidor' };
    }
    // 2) Direto no PNCP pelo navegador
    try {
      if (regiao === 'mg' && !micro && !q && !fontesKey) {
        const r = await fetchPage({ pagina: pag, tamanho: PAGE_SIZE });
        const out = { items: sortByUpdate(r.items), total: r.total, atualizadoEm: new Date().toISOString() };
        saveLocal(key, out);
        return { ...out, fonte: 'direto' };
      }
      if (!allMG.current) {
        const r = await fetchAllMG({ onProgress: (loaded, t) => setProgresso({ loaded, total: t }) });
        allMG.current = r.items;
        setProgresso(null);
      }
      const f = filterEditais(allMG.current, { regiao, micro, q, fontes: fontesKey });
      const out = { items: f.slice((pag - 1) * PAGE_SIZE, pag * PAGE_SIZE), total: f.length, atualizadoEm: new Date().toISOString() };
      saveLocal(key, out);
      return { ...out, fonte: 'direto' };
    } catch {
      setProgresso(null);
    }
    // 3) Última consulta salva neste aparelho
    const salvo = loadLocal<Resultado>(key);
    if (salvo) return { ...salvo.value, atualizadoEm: new Date(salvo.at).toISOString(), fonte: 'salvo' };
    // 4) Amostra embutida (apenas na visualização de demonstração)
    const sample = typeof window !== 'undefined' ? window.__PNCP_SAMPLE__ : undefined;
    if (sample) {
      const f = sortByUpdate(filterEditais(sample.items, { regiao, micro, q, fontes: fontesKey }));
      return { items: f.slice((pag - 1) * PAGE_SIZE, pag * PAGE_SIZE), total: f.length, atualizadoEm: sample.capturadoEm, fonte: 'amostra' };
    }
    throw new Error('sem conexão');
  }, [regiao, micro, q, fontesKey]);

  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    setErro('');
    if (pagina === 1) setItems([]);
    carregar(pagina)
      .then((r) => {
        if (id !== reqId.current) return;
        setItems((prev) => (pagina === 1 ? r.items : [...prev, ...r.items]));
        setTotal(r.total);
        setFonte(r.fonte);
        setAtualizadoEm(r.atualizadoEm || '');
        setAviso(
          r.fonte === 'salvo'
            ? `O PNCP não respondeu agora. Mostrando a última consulta salva (${formatHora(r.atualizadoEm)}).`
            : r.desatualizado
              ? `O PNCP está instável. Mostrando os dados da última consulta que funcionou (${formatHora(r.atualizadoEm)}).`
              : r.incompleto
                ? 'Parte das páginas do PNCP não respondeu nesta consulta; a lista pode estar incompleta.'
                : '',
        );
      })
      .catch(() => id === reqId.current && setErro('O PNCP está fora do ar ou muito lento neste momento. Isso acontece com frequência e costuma voltar em poucos minutos.'))
      .finally(() => id === reqId.current && setLoading(false));
  }, [carregar, pagina, tentativa]);

  // Quantos editais há em cada fonte (com os mesmos filtros de região e busca)
  useEffect(() => {
    if (!painelFontes) return;
    let vivo = true;
    (async () => {
      setFacetasEstado('loading');
      const p: Record<string, string> = { facetas: '1', regiao };
      if (micro) p.micro = micro;
      if (q) p.q = q;
      const viaApi = await callApi<{ fontes: { nome: string; total: number }[] }>('editais', p);
      let lista = viaApi?.fontes ?? null;
      if (!lista) {
        try {
          if (!allMG.current) {
            const r = await fetchAllMG({ onProgress: (loaded: number, t: number) => vivo && setProgresso({ loaded, total: t }) });
            allMG.current = r.items;
          }
          lista = contarFontes(filterEditais(allMG.current, { regiao, micro, q }));
        } catch {
          const sample = typeof window !== 'undefined' ? window.__PNCP_SAMPLE__ : undefined;
          if (sample) lista = contarFontes(filterEditais(sample.items, { regiao, micro, q }));
        } finally {
          if (vivo) setProgresso(null);
        }
      }
      if (!vivo) return;
      if (lista) {
        setFacetas(lista);
        setFacetasEstado('idle');
      } else setFacetasEstado('erro');
    })();
    return () => {
      vivo = false;
    };
  }, [painelFontes, regiao, micro, q, tentativa]);

  const alternarFonte = (nome: string) => setFontes((f) => (f.includes(nome) ? f.filter((x) => x !== nome) : [...f, nome]));

  const temMais = items.length < total;

  return (
    <>
        {/* Filtros + lista */}
        <section id="editais" aria-label="Lista de editais" className="bg-[#F4F7FB] py-10 sm:py-14 min-h-[60vh]">
          <Container>
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-3 lg:gap-4">
                <div role="group" aria-label="Região" className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 shrink-0">
                  {(
                    [
                      ['mg', 'Minas Gerais'],
                      ['zona-da-mata', 'Zona da Mata mineira'],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={regiao === v}
                      onClick={() => {
                        setRegiao(v);
                        if (v === 'mg') setMicro('');
                      }}
                      className={`px-4 py-2.5 rounded-lg text-[15px] font-bold transition-colors cursor-pointer ${
                        regiao === v ? 'bg-[#0478CA] text-white shadow-sm' : 'text-slate-700 hover:text-[#0F2053]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="relative flex-1 min-w-0 lg:min-w-[20rem]">
                  <span className="sr-only">Buscar editais</span>
                  <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="search"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por objeto, órgão ou cidade (ex.: merenda, limpeza, Ubá)"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 text-base focus:outline-none focus:border-[#0478CA] focus:ring-2 focus:ring-[#0478CA]/20"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3 lg:flex lg:gap-4 shrink-0">
                <button
                  type="button"
                  aria-expanded={painelFontes}
                  aria-controls="filtro-fontes"
                  onClick={() => setPainelFontes((v) => !v)}
                  className={`shrink-0 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-base font-bold border-2 transition-colors cursor-pointer ${
                    painelFontes || fontes.length ? 'border-[#0478CA] text-[#0478CA] bg-[#0478CA]/5' : 'border-slate-300 text-slate-700 hover:border-[#0478CA]'
                  }`}
                >
                  <Icon name="box" className="w-5 h-5" />
                  Fonte{fontes.length ? ` (${fontes.length})` : ''}
                </button>
                <button
                  type="button"
                  aria-expanded={sugestao}
                  aria-controls="sugestao"
                  onClick={() => {
                    setSugestao((v) => !v);
                    setTimeout(() => document.getElementById('sugestao')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                  }}
                  className={`shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-base font-extrabold tracking-wide transition-colors cursor-pointer ${
                    sugestao ? 'bg-[#0F2053] text-white' : 'bg-[#F5A623] hover:bg-[#E0951A] text-[#0F2053]'
                  }`}
                >
                  <Icon name="sheet" className="w-5 h-5" />
                  Sugestão
                </button>
                </div>
              </div>

              {regiao === 'zona-da-mata' && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-sm font-semibold text-slate-600 mb-2">Por aqui por perto · microrregião</p>
                  <div role="group" aria-label="Microrregião" className="flex flex-wrap gap-2">
                    {['', ...MICROS].map((m) => (
                      <button
                        key={m || 'todas'}
                        type="button"
                        aria-pressed={micro === m}
                        onClick={() => setMicro(m)}
                        className={`px-3.5 py-2 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${
                          micro === m ? 'bg-[#0F2053] border-[#0F2053] text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-[#0478CA]'
                        }`}
                      >
                        {m || 'Toda a Zona da Mata'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {painelFontes && (
                <div id="filtro-fontes" className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-slate-600">
                      Fonte · plataforma onde o edital foi publicado {fontes.length ? '' : '(nenhuma marcada = todas)'}
                    </p>
                    {fontes.length > 0 && (
                      <button type="button" onClick={() => setFontes([])} className="text-sm font-bold text-[#0478CA] underline cursor-pointer">
                        Limpar ({fontes.length})
                      </button>
                    )}
                  </div>
                  {facetasEstado === 'loading' && !facetas && <p className="text-[15px] text-slate-600">Contando editais por fonte…</p>}
                  {facetasEstado === 'erro' && (
                    <p className="text-[15px] text-amber-900">
                      O PNCP não respondeu para listar as fontes.{' '}
                      <button type="button" onClick={() => setTentativa((t) => t + 1)} className="font-bold underline cursor-pointer">
                        Tentar de novo
                      </button>
                    </p>
                  )}
                  {facetas && (
                    <div role="group" aria-label="Fontes" className={`flex flex-wrap gap-2 ${facetasEstado === 'loading' ? 'opacity-60' : ''}`}>
                      {[...facetas, ...fontes.filter((f) => !facetas.some((x) => x.nome === f)).map((nome) => ({ nome, total: 0 }))]
                        .filter((f, i) => todasFontes || i < 10 || fontes.includes(f.nome))
                        .map((f) => {
                        const on = fontes.includes(f.nome);
                        return (
                          <button
                            key={f.nome}
                            type="button"
                            aria-pressed={on}
                            onClick={() => alternarFonte(f.nome)}
                            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${
                              on ? 'bg-[#0F2053] border-[#0F2053] text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-[#0478CA]'
                            }`}
                          >
                            <span aria-hidden="true" className={`w-4 h-4 rounded border flex items-center justify-center text-[11px] ${on ? 'bg-white text-[#0F2053] border-white' : 'border-slate-400'}`}>
                              {on ? '✓' : ''}
                            </span>
                            {f.nome}
                            <span className={`tabular-nums ${on ? 'text-white/75' : 'text-slate-400'}`}>{f.total.toLocaleString('pt-BR')}</span>
                          </button>
                        );
                      })}
                      {facetas.length > 10 && (
                        <button type="button" onClick={() => setTodasFontes((v) => !v)} className="px-3.5 py-2 text-sm font-bold text-[#0478CA] underline cursor-pointer">
                          {todasFontes ? 'Mostrar menos' : `Ver todas as ${facetas.length} fontes`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {sugestao && <SugestaoPanel onClose={() => setSugestao(false)} />}

            {/* Resumo */}
            <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-lg font-bold text-[#0F2053]" aria-live="polite">
                {loading && pagina === 1
                  ? 'Buscando editais…'
                  : `${total.toLocaleString('pt-BR')} ${total === 1 ? 'edital aberto' : 'editais abertos'}${
                      regiao === 'zona-da-mata' ? (micro ? ` na microrregião de ${micro}` : ' na Zona da Mata') : ' em Minas Gerais'
                    }${fontes.length ? ` · ${fontes.length === 1 ? `fonte ${fontes[0]}` : `${fontes.length} fontes`}` : ''}`}
              </p>
              <p className="text-sm text-slate-500">
                Ordenados pela última atualização
                {atualizadoEm && !loading
                  ? ` · consulta em ${formatHora(atualizadoEm)}`
                  : ''}
              </p>
            </div>

            {aviso && (
              <p role="status" className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[15px] flex flex-wrap items-center gap-3">
                <span className="flex-1 min-w-0">{aviso}</span>
                <button type="button" onClick={() => setTentativa((t) => t + 1)} className="font-bold underline cursor-pointer">
                  Tentar de novo
                </button>
              </p>
            )}

            {fonte === 'amostra' && (
              <p className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[15px]">
                <strong>Visualização de demonstração:</strong> esta prévia não acessa a internet, então mostra uma amostra real de
                editais capturada do PNCP. No site publicado a lista é carregada ao vivo, completa.
              </p>
            )}

            {progresso && (
              <div className="mt-4 p-4 rounded-xl bg-white border border-slate-200">
                <p className="text-[15px] text-slate-700">
                  Lendo editais de Minas Gerais para filtrar a Zona da Mata: {progresso.loaded.toLocaleString('pt-BR')} de{' '}
                  {progresso.total.toLocaleString('pt-BR')}
                </p>
                <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-[#0478CA] transition-all" style={{ width: `${Math.min(100, (progresso.loaded / Math.max(1, progresso.total)) * 100)}%` }} />
                </div>
              </div>
            )}

            {erro && (
              <div role="alert" className="mt-6 p-5 rounded-2xl bg-white border border-amber-200">
                <p className="text-base text-amber-900">{erro}</p>
                <button
                  type="button"
                  onClick={() => setTentativa((t) => t + 1)}
                  className="mt-3 mr-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0478CA] hover:bg-[#03609F] text-white font-bold cursor-pointer"
                >
                  Tentar novamente
                </button>
                <a href="https://pncp.gov.br/app/editais?status=recebendo_proposta&ufs=MG" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-bold text-[#0478CA] underline">
                  Abrir a busca diretamente no PNCP
                </a>
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <ol className="lg:col-span-8 space-y-4">
                {items.map((e) => {
                  const ate = parseBR(e.propostasAte);
                  const dias = diasAte(e.propostasAte);
                  const urgente = dias !== null && dias <= 3;
                  return (
                    <li key={e.id}>
                      <article className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 hover:border-[#0478CA]/40 hover:shadow-md hover:shadow-[#0F2053]/5 transition-all">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="px-2.5 py-1 rounded-full bg-[#0478CA]/10 text-[#0478CA] font-bold">{e.modalidade || 'Licitação'}</span>
                          {e.microrregiao && (
                            <span className="px-2.5 py-1 rounded-full bg-[#128C4A]/10 text-[#0E7A40] font-bold">Zona da Mata · {e.microrregiao}</span>
                          )}
                          {e.fonte && (
                            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">Fonte: {e.fonte}</span>
                          )}
                          <span className="text-slate-500">Atualizado {ha(e.atualizadoEm)}</span>
                        </div>
                        <h2 className="mt-3 text-lg font-bold text-[#0F2053] leading-snug line-clamp-3">{e.objeto || e.titulo}</h2>
                        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[15px]">
                          <div className="min-w-0">
                            <dt className="text-sm text-slate-500">Órgão</dt>
                            <dd className="font-semibold text-slate-800 truncate" title={e.orgao}>{e.orgao}</dd>
                          </div>
                          <div>
                            <dt className="text-sm text-slate-500">Cidade</dt>
                            <dd className="font-semibold text-slate-800">{e.municipio} · MG</dd>
                          </div>
                          <div>
                            <dt className="text-sm text-slate-500">Valor estimado</dt>
                            <dd className="font-semibold text-slate-800 tabular-nums">{e.valor ? formatBRL(e.valor, 2) : 'Não informado'}</dd>
                          </div>
                          <div>
                            <dt className="text-sm text-slate-500">Propostas até</dt>
                            <dd className={`font-semibold tabular-nums ${urgente ? 'text-red-700' : 'text-slate-800'}`}>
                              {ate ? `${ate.d} às ${ate.h}` : 'Ver no edital'}
                              {urgente && dias !== null && dias >= 0 && (
                                <span className="ml-2 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-bold">
                                  {dias === 0 ? 'encerra hoje' : `faltam ${dias} ${dias === 1 ? 'dia' : 'dias'}`}
                                </span>
                              )}
                            </dd>
                          </div>
                        </dl>
                        {e.compra && <DetalheCompra compra={e.compra} />}
                        <div className="mt-5 flex flex-col sm:flex-row gap-2">
                          <a
                            href={e.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0478CA] hover:bg-[#03609F] text-white text-[15px] font-bold"
                          >
                            Ver edital no PNCP
                            <Icon name="arrow" className="w-4 h-4" />
                          </a>
                          {e.linkOrigem && /^https?:\/\//.test(e.linkOrigem) && (
                            <a
                              href={e.linkOrigem}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 hover:border-[#0478CA] text-[#0F2053] text-[15px] font-bold"
                            >
                              Abrir {e.fonte && e.fonte !== "Não informada" ? `em ${e.fonte}` : "na plataforma"}
                            </a>
                          )}
                          <a
                            href={whatsappLink(
                              `Olá! Quero ajuda da Ágil CM para disputar este edital:\n${e.titulo} - ${e.orgao} (${e.municipio}/MG)\n${e.objeto.slice(0, 200)}\n${e.link}`,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#128C4A]/30 text-[#0E7A40] hover:bg-[#128C4A]/5 text-[15px] font-bold"
                          >
                            <WhatsAppIcon className="w-4 h-4" />
                            Quero disputar com a Ágil CM
                          </a>
                        </div>
                      </article>
                    </li>
                  );
                })}
                {loading &&
                  Array.from({ length: pagina === 1 ? 4 : 2 }).map((_, i) => (
                    <li key={`sk${i}`} aria-hidden="true" className="p-6 rounded-2xl bg-white border border-slate-200 animate-pulse">
                      <div className="h-5 w-32 rounded bg-slate-100" />
                      <div className="mt-4 h-5 w-full rounded bg-slate-100" />
                      <div className="mt-2 h-5 w-2/3 rounded bg-slate-100" />
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="h-10 rounded bg-slate-100" />
                        <div className="h-10 rounded bg-slate-100" />
                      </div>
                    </li>
                  ))}
                {!loading && !erro && items.length === 0 && (
                  <li className="p-8 rounded-2xl bg-white border border-slate-200 text-center">
                    <p className="text-lg font-bold text-[#0F2053]">Nenhum edital encontrado com esses filtros</p>
                    <p className="mt-1 text-base text-slate-600">Tente outra palavra, marque mais fontes ou volte para toda Minas Gerais.</p>
                  </li>
                )}
                {temMais && !loading && (
                  <li>
                    <button
                      type="button"
                      onClick={() => setPagina((p) => p + 1)}
                      className="w-full py-3.5 rounded-xl bg-white border-2 border-[#0478CA]/30 hover:border-[#0478CA] text-[#0478CA] text-base font-bold cursor-pointer"
                    >
                      Mostrar mais editais ({(total - items.length).toLocaleString('pt-BR')} restantes)
                    </button>
                  </li>
                )}
              </ol>

              <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0478CA] to-[#0F2053] text-white">
                  <p className="text-xl font-bold font-display">Achou um edital para sua empresa?</p>
                  <p className="mt-2 text-base text-white/85 leading-relaxed">
                    A Ágil CM cuida da habilitação, da proposta e do pregão eletrônico. Você foca em entregar.
                  </p>
                  <a
                    href={whatsappLink('Olá! Vi os editais no site da Ágil CM e quero ajuda para participar de licitações.')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-white text-[#0F2053] font-bold hover:bg-slate-100"
                  >
                    <WhatsAppIcon className="w-5 h-5" />
                    Falar com a equipe de licitações
                  </a>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-slate-200 text-[15px] text-slate-600 leading-relaxed">
                  <p className="font-bold text-[#0F2053]">Sobre os dados</p>
                  <p className="mt-1">
                    Informações públicas do PNCP (pncp.gov.br), com editais que estão recebendo propostas. Sempre confira prazos e
                    documentos no edital oficial.
                  </p>
                </div>
              </aside>
            </div>
          </Container>
        </section>
    </>
  );
}

// Itens (o que está sendo comprado) e documentos (edital, termo de referência) de uma compra
function DetalheCompra({ compra }: { compra: { cnpj: string; ano: string; seq: string } }) {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<'idle' | 'loading' | 'ok' | 'erro'>('idle');
  const [dados, setDados] = useState<{ itens: Item[] | null; arquivos: Arquivo[] | null } | null>(null);

  const carregar = async () => {
    setEstado('loading');
    const viaApi = await callApi<{ itens: Item[] | null; arquivos: Arquivo[] | null }>('compra', compra);
    if (viaApi) {
      setDados(viaApi);
      return setEstado('ok');
    }
    try {
      setDados(await fetchDetalheCompra(compra));
      setEstado('ok');
    } catch {
      setEstado('erro');
    }
  };

  const toggle = () => {
    const next = !aberto;
    setAberto(next);
    if (next && estado === 'idle') carregar();
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={aberto}
        className="inline-flex items-center gap-2 text-[15px] font-bold text-[#0F2053] hover:text-[#0478CA] cursor-pointer"
      >
        <span className={`inline-block transition-transform ${aberto ? 'rotate-90' : ''}`} aria-hidden="true">›</span>
        {aberto ? 'Ocultar itens e documentos' : 'Ver itens e documentos do edital'}
      </button>
      {aberto && (
        <div className="mt-3 p-4 rounded-xl bg-[#F7FAFD] border border-slate-200">
          {estado === 'loading' && <p className="text-[15px] text-slate-600">Carregando do PNCP…</p>}
          {estado === 'erro' && (
            <p className="text-[15px] text-amber-900">
              O PNCP não respondeu.{' '}
              <button type="button" onClick={carregar} className="font-bold underline cursor-pointer">
                Tentar de novo
              </button>
            </p>
          )}
          {estado === 'ok' && dados && (
            <div className="space-y-4">
              {dados.arquivos && dados.arquivos.length > 0 && (
                <div>
                  <p className="text-sm font-bold text-slate-500 mb-2">Documentos</p>
                  <ul className="flex flex-wrap gap-2">
                    {dados.arquivos.map((a) => (
                      <li key={a.url}>
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-[#0478CA] hover:border-[#0478CA]">
                          <Icon name="doc" className="w-4 h-4" />
                          {a.tipo}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {dados.itens && dados.itens.length > 0 ? (
                <div>
                  <p className="text-sm font-bold text-slate-500 mb-2">Itens ({dados.itens.length})</p>
                  <ul className="divide-y divide-slate-200 max-h-80 overflow-y-auto pr-1">
                    {dados.itens.map((i) => (
                      <li key={i.numero} className="py-2.5 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 text-[15px]">
                        <span className="text-slate-500 tabular-nums shrink-0 w-8">{i.numero}</span>
                        <span className="flex-1 min-w-0 text-slate-800">{i.descricao}</span>
                        <span className="shrink-0 text-slate-600 tabular-nums sm:text-right">
                          {i.quantidade?.toLocaleString('pt-BR')} {i.unidade}
                          {i.valorUnitarioEstimado ? <><br className="hidden sm:block" /> <strong className="text-slate-800">{formatBRL(i.valorUnitarioEstimado, 2)}</strong> /un.</> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-[15px] text-slate-600">O órgão ainda não publicou os itens desta compra no PNCP.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Item {
  numero: number;
  descricao: string;
  quantidade: number | null;
  unidade: string;
  valorUnitarioEstimado: number | null;
}
interface Arquivo {
  titulo: string;
  tipo: string;
  url: string;
}
