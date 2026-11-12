import { useCallback, useEffect, useRef, useState } from 'react';
import { Container, Icon, WhatsAppIcon } from '../components/ui.tsx';
import { formatBRL, whatsappLink } from '../data/servicesData.ts';
import { MICRORREGIOES, normalizeName } from '../data/zonaDaMata.js';
import { AGIL_CNAES } from '../data/agilCnaes.js';
import { filtrarPorCnaes, filtrarPorRegras, filtrarPorSegmento } from '../lib/agilCnae.js';
import { buscarCnae, CATALOGO_POR_ID, regrasDoCatalogo } from '../lib/catalogoCnae.js';
import { contarLocais, fetchItensCompra, fetchPage, filterEditais, sortByUpdate } from '../lib/pncp.js';
import { descartarListas, listaDe, listaPronta, preCarregar } from '../lib/listasEditais.ts';
import { distanciaKm, filtrarAvancado, grupoModalidade, ibgeDe, ordenarEditais, resumoEditais } from '../lib/filtrosEditais.js';
import { DetalheCompra } from './RaioXEdital.tsx';
import TendenciaPanel from './TendenciaPanel.tsx';
import FiltrosAvancados, { AVANCADO_VAZIO, BASE_PADRAO, contarAvancado, type Avancado } from './FiltrosAvancados.tsx';
import { alternarMeuEdital, useMeusEditais } from '../lib/meusEditais.ts';
import { guardarItens, itensGuardados } from '../lib/itensCache.ts';
import { SEGMENTOS, SEGMENTO_POR_ID } from '../data/segmentos.js';
import { abasEditais } from '../lib/exportarEditais.js';
import { baixarXlsx } from '../lib/xlsx.js';
import { callApi, formatHora, loadLocal, saveLocal, type Fonte } from '../lib/pncpClient.ts';
import SugestaoPanel from './SugestaoPanel.tsx';
import SuperSugestaoPanel from './SuperSugestaoPanel.tsx';

type Regiao = 'mg' | 'zona-da-mata' | 'brasil';

interface Edital {
  id: string;
  titulo: string;
  objeto: string;
  orgao: string;
  unidade: string;
  municipio: string;
  uf?: string;
  microrregiao: string | null;
  modalidade: string;
  valor: number | null;
  publicadoEm: string;
  atualizadoEm: string;
  propostasAte: string | null;
  link: string;
  linkOrigem: string | null;
  fonte?: string;
  local?: string;
  linkLocal?: string | null;
  compra?: { cnpj: string; ano: string; seq: string } | null;
  propostasDe?: string | null;
  srp?: boolean;
  esfera?: string;
  modoDisputa?: string;
  amparo?: string;
  ibge?: string;
  cnaes?: string[]; // só na aba AGIL CNAE: CNAEs da Ágil CM que casaram com o objeto
  termos?: string[];
}

interface Resultado {
  items: Edital[];
  total: number;
  atualizadoEm?: string;
  desatualizado?: boolean;
  incompleto?: boolean;
  resumo?: ReturnType<typeof resumoEditais>;
}

interface Geo {
  coords: Record<string, number[]>;
  cidades: [string, string][];
  porNome: Map<string, string>;
}
const BASE_KEY = 'agilcm:editais:base';

const PAGE_SIZE = 20;
// "Por aqui por perto": microrregiões e, com o prefixo "cidade:", cidades onde a Ágil atua
const PERTO = ['Juiz de Fora', 'Cataguases', 'Ubá', 'Muriaé', 'cidade:Rodeiro', 'cidade:Astolfo Dutra', 'cidade:Leopoldina'].filter(
  (m) => m.startsWith('cidade:') || m in MICRORREGIOES,
);
const rotuloPerto = (m: string) => m.replace(/^cidade:/, '');
/** R$ 312.400.000 → "R$ 312,4 mi" */
const abreviarBRL = (v: number) =>
  v >= 1e9
    ? `R$ ${(v / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`
    : v >= 1e6
      ? `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
      : v >= 1e3
        ? `R$ ${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
        : formatBRL(v, 0);
const CNAES_KEY = 'agilcm:cnaes-livres';

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

// agil: aba AGIL CNAE, mesma lista restrita aos editais ligados aos CNAEs da Ágil CM
export default function EditaisTab({ agil = false }: { agil?: boolean }) {
  // as duas abas começam na Zona da Mata: a lista é lida uma vez só e serve às duas (e à Super Sugestão)
  const [regiao, setRegiao] = useState<Regiao>('zona-da-mata');
  const [segmento, setSegmento] = useState(''); // AGIL CNAE: '' = CNAEs da Ágil; senão, o id do segmento
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
  const [superSug, setSuperSug] = useState(false);
  const [locais, setLocais] = useState<string[]>([]);
  const [painelLocais, setPainelLocais] = useState(false);
  const [facetasLocais, setFacetasLocais] = useState<{ nome: string; total: number }[] | null>(null);
  const [cnaesSel, setCnaesSel] = useState<string[]>([]);
  const [painelCnaes, setPainelCnaes] = useState(false);
  const [livres, setLivres] = useState<string[]>([]); // CNAEs escolhidos em Editais abertos
  const [buscaCnae, setBuscaCnae] = useState('');
  const [facetasEstado, setFacetasEstado] = useState<'idle' | 'loading' | 'erro'>('idle');
  const [exportando, setExportando] = useState<{ etapa: string; feito: number; total: number } | null>(null);
  const [exportErro, setExportErro] = useState('');
  const cancelarExport = useRef(false);
  // Editais abertos: filtros avançados, ordenação e distância (a aba AGIL CNAE não usa)
  const [avanc, setAvanc] = useState<Avancado>(AVANCADO_VAZIO);
  const [ordem, setOrdem] = useState('recentes');
  const [painelMais, setPainelMais] = useState(false);
  const [tendencia, setTendencia] = useState(false);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [resumo, setResumo] = useState<Resultado['resumo'] | null>(null);
  const meus = useMeusEditais();
  useEffect(() => {
    try {
      const b = localStorage.getItem(BASE_KEY);
      if (b && /^\d{7}$/.test(b)) setAvanc((a) => ({ ...a, base: b }));
    } catch {
      /* sem armazenamento */
    }
    import('../data/coordenadasMunicipios.js').then((m) =>
      setGeo({ coords: m.COORDS, cidades: m.CIDADES_MG as [string, string][], porNome: new Map(m.CIDADES_MG.map(([n, ib]) => [normalizeName(n), ib])) }),
    );
  }, []);
  useEffect(() => {
    if (avanc.base === BASE_PADRAO) return;
    try {
      localStorage.setItem(BASE_KEY, avanc.base);
    } catch {
      /* sem armazenamento */
    }
  }, [avanc.base]);
  const usaGeo = avanc.raio > 0 || ordem === 'distancia';
  const extrasAtivos = contarAvancado(avanc) > 0 || ordem !== 'recentes';
  const extrasKey = extrasAtivos ? JSON.stringify({ ...avanc, base: usaGeo ? avanc.base : '', ordem, geo: usaGeo && !!geo }) : '';
  const kmAte = useCallback(
    (e: Edital) => (geo ? distanciaKm(geo.coords[avanc.base], geo.coords[ibgeDe(e, geo.porNome)]) : null),
    [geo, avanc.base],
  );
  // Lista completa da região (modo direto), compartilhada entre as abas (lib/listasEditais.ts).
  // Brasil não tem lista completa: são dezenas de milhares de editais.
  const listaDaRegiao = async (reg: Regiao, onProgress: (loaded: number, total: number) => void): Promise<Edital[]> =>
    (await listaDe(reg === 'zona-da-mata' ? 'zm' : 'mg', onProgress)).items as Edital[];
  const reqId = useRef(0);

  // Busca com pequeno atraso enquanto a pessoa digita
  useEffect(() => {
    const t = setTimeout(() => setQ(busca.trim()), 400);
    return () => clearTimeout(t);
  }, [busca]);

  // o filtro Fonte saiu (é quase o mesmo que Local do pregão): esquece o que ficou marcado nas visitas antigas
  useEffect(() => {
    try {
      localStorage.removeItem('agilcm:fontes');
    } catch {
      /* sem armazenamento */
    }
  }, []);
  // CNAEs escolhidos da última visita (só neste aparelho)
  useEffect(() => {
    if (agil) return;
    try {
      const v = JSON.parse(localStorage.getItem(CNAES_KEY) || '[]');
      if (Array.isArray(v)) setLivres(v.filter((x) => typeof x === 'string' && CATALOGO_POR_ID.has(x)));
    } catch {
      /* sem armazenamento */
    }
  }, [agil]);
  useEffect(() => {
    if (agil) return;
    try {
      localStorage.setItem(CNAES_KEY, JSON.stringify(livres));
    } catch {
      /* sem armazenamento: só não lembra na próxima visita */
    }
  }, [livres, agil]);
  const livresKey = agil ? '' : livres.slice().sort().join('|');
  const cnaesKey = cnaesSel.slice().sort().join('|');
  const locaisKey = locais.slice().sort().join('|');

  useEffect(() => setPagina(1), [regiao, micro, q, cnaesKey, locaisKey, livresKey, segmento, extrasKey]);

  // Filtro local (modo direto e amostra), igual ao da função /api/editais; depois, os de "Mais filtros"
  const filtroBase = useCallback(
    (list: Edital[], opts: { regiao: Regiao; micro: string; q: string; fontes?: string; locais?: string }): Edital[] => {
      const f = filterEditais(list, opts);
      if (agil && segmento) return filtrarPorSegmento(f, segmento);
      if (agil) return filtrarPorCnaes(f, { cnaes: cnaesKey });
      return livresKey ? filtrarPorRegras(f, regrasDoCatalogo(livresKey)) : f;
    },
    [agil, cnaesKey, livresKey, segmento],
  );
  const aplicar = useCallback(
    (list: Edital[], opts: { regiao: Regiao; micro: string; q: string; fontes?: string; locais?: string }): Edital[] => {
      const g = filtroBase(list, opts);
      return extrasAtivos ? filtrarAvancado(g, avanc, { coords: geo?.coords, porNome: geo?.porNome }) : g;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtroBase, extrasKey, geo],
  );
  const ordenar = useCallback(
    (list: Edital[]) => (extrasAtivos ? ordenarEditais(list, ordem, { coords: geo?.coords, base: avanc.base, porNome: geo?.porNome }) : list),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extrasKey, geo],
  );

  const carregar = useCallback(async (pag: number): Promise<Resultado & { fonte: Fonte }> => {
    const key = `${agil ? `agil:${segmento ? `seg-${segmento}` : cnaesKey}` : `editais:${livresKey}`}:${extrasKey}:${regiao}:${micro}:${q}:${locaisKey}:${pag}`;
    // 1) Função do servidor (site publicado na Vercel)
    const p: Record<string, string> = { regiao, pagina: String(pag), tamanho: String(PAGE_SIZE) };
    if (micro) p.micro = micro;
    if (q) p.q = q;
    if (locaisKey) p.locais = locaisKey;
    if (agil) p.cnae = 'agil';
    if (agil && cnaesKey) p.cnaes = cnaesKey;
    if (livresKey) Object.assign(p, { cnae: 'lista', cnaes: livresKey });
    // a função do servidor não conhece segmento nem Brasil: nesses casos vai direto ao PNCP
    const viaApi = segmento || regiao === 'brasil' || extrasAtivos ? null : await callApi<Resultado>('editais', p);
    if (viaApi) {
      saveLocal(key, viaApi);
      return { ...viaApi, fonte: 'servidor' };
    }
    // 2) Direto no PNCP pelo navegador
    try {
      if (regiao === 'brasil') {
        // Brasil: página a página (o PNCP tem dezenas de milhares de editais abertos); a busca vai para o PNCP
        const r = await fetchPage({ pagina: pag, tamanho: PAGE_SIZE, q, uf: '' });
        const f = aplicar(r.items as Edital[], { regiao, micro: '', q: '', locais: locaisKey });
        const out = { items: extrasAtivos ? ordenar(f) : sortByUpdate(f), total: r.total, atualizadoEm: new Date().toISOString() };
        saveLocal(key, out);
        return { ...out, fonte: 'direto' };
      }
      if (regiao === 'mg' && !micro && !q && !locaisKey && !agil && !livresKey && !extrasAtivos) {
        const r = await fetchPage({ pagina: pag, tamanho: PAGE_SIZE });
        const out = { items: sortByUpdate(r.items), total: r.total, atualizadoEm: new Date().toISOString() };
        saveLocal(key, out);
        return { ...out, fonte: 'direto' };
      }
      const l = await listaDe(regiao === 'zona-da-mata' ? 'zm' : 'mg', (loaded, t) => setProgresso({ loaded, total: t }));
      setProgresso(null);
      const f = ordenar(aplicar(l.items as Edital[], { regiao, micro, q, locais: locaisKey }));
      const out = {
        items: f.slice((pag - 1) * PAGE_SIZE, pag * PAGE_SIZE),
        total: f.length,
        atualizadoEm: new Date(l.at).toISOString(),
        incompleto: l.incompleto,
        resumo: pag > 1 ? undefined : resumoEditais(f),
      };
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
      const f = sortByUpdate(aplicar(sample.items, { regiao, micro, q, locais: locaisKey }));
      return { items: f.slice((pag - 1) * PAGE_SIZE, pag * PAGE_SIZE), total: f.length, atualizadoEm: sample.capturadoEm, fonte: 'amostra' };
    }
    throw new Error('sem conexão');
  }, [regiao, micro, q, locaisKey, agil, cnaesKey, livresKey, segmento, aplicar, ordenar, extrasKey, extrasAtivos]);

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
        if (pagina === 1) setResumo(r.resumo ?? null);
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

  // AGIL CNAE: com a Zona da Mata na tela, Minas Gerais vai sendo lida por trás
  // (o botão Minas Gerais e a Super Sugestão encontram a lista pronta)
  useEffect(() => {
    if (agil && !loading && import.meta.env.VITE_STATIC_HOST === 'true') preCarregar('mg');
  }, [agil, loading]);

  // Quantos editais há em cada local do pregão (com os mesmos filtros de região e busca)
  useEffect(() => {
    if (!painelLocais) return;
    let vivo = true;
    (async () => {
      setFacetasEstado('loading');
      const p: Record<string, string> = { facetas: '1', regiao };
      if (micro) p.micro = micro;
      if (q) p.q = q;
      if (agil) p.cnae = 'agil';
      if (agil && cnaesKey) p.cnaes = cnaesKey;
      if (livresKey) Object.assign(p, { cnae: 'lista', cnaes: livresKey });
      if (locaisKey) p.locais = locaisKey;
      const viaApi = extrasAtivos ? null : await callApi<{ locais?: { nome: string; total: number }[] }>('editais', p);
      let listaLocais: { nome: string; total: number }[] | null = viaApi?.locais ?? null;
      if (!listaLocais) {
        try {
          const lista = regiao === 'brasil' ? items : await listaDaRegiao(regiao, (loaded: number, t: number) => vivo && setProgresso({ loaded, total: t }));
          listaLocais = contarLocais(aplicar(lista, { regiao, micro, q }));
        } catch {
          const sample = typeof window !== 'undefined' ? window.__PNCP_SAMPLE__ : undefined;
          if (sample) listaLocais = contarLocais(aplicar(sample.items, { regiao, micro, q }));
        } finally {
          if (vivo) setProgresso(null);
        }
      }
      if (!vivo) return;
      if (listaLocais) {
        setFacetasLocais(listaLocais);
        setFacetasEstado('idle');
      } else setFacetasEstado('erro');
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [painelLocais, regiao, micro, q, locaisKey, tentativa, agil, cnaesKey, livresKey, aplicar]);

  // Todos os editais com os filtros atuais (não só as páginas já mostradas); tudo: MG inteira, sem filtros
  const listarTodos = async ({ tudo = false, onProgress }: { tudo?: boolean; onProgress?: (lidos: number, total: number) => void } = {}): Promise<Edital[]> => {
    const f = tudo ? { regiao: 'mg' as Regiao, micro: '', q: '', locais: '' } : { regiao, micro, q, locais: locaisKey };
    const p: Record<string, string> = { regiao: f.regiao, todos: '1' };
    if (f.micro) p.micro = f.micro;
    if (f.q) p.q = f.q;
    if (f.locais) p.locais = f.locais;
    if (agil && !tudo) p.cnae = 'agil';
    if (agil && !tudo && cnaesKey) p.cnaes = cnaesKey;
    if (!tudo && livresKey) Object.assign(p, { cnae: 'lista', cnaes: livresKey });
    const viaApi = await callApi<Resultado>('editais', p);
    if (viaApi) return viaApi.items;
    const filtrar = (lista: Edital[]) => (tudo ? filterEditais(lista, f) : aplicar(lista, f));
    try {
      // Brasil: só o que já foi carregado na tela
      if (!tudo && regiao === 'brasil') return items;
      const reg = tudo ? 'mg' : regiao;
      return filtrar(
        await listaDaRegiao(reg, onProgress || ((loaded, t) => setExportando({ etapa: reg === 'zona-da-mata' ? 'Lendo os editais da Zona da Mata' : 'Lendo os editais de Minas Gerais', feito: loaded, total: t }))),
      );
    } catch {
      const sample = typeof window !== 'undefined' ? window.__PNCP_SAMPLE__ : undefined;
      if (sample) return sortByUpdate(filtrar(sample.items));
      throw new Error('sem conexão');
    }
  };

  // Excel com duas abas: informações básicas de cada edital e os itens (uma linha por item)
  const exportar = async () => {
    cancelarExport.current = false;
    setExportErro('');
    setExportando({ etapa: 'Reunindo os editais', feito: 0, total: 0 });
    try {
      const lista = await listarTodos();
      const comCompra = lista.filter((e) => e.compra);
      const itens = new Map<string, { itens: unknown[] | null; erro?: string }>();
      // itens já lidos (Super Sugestão ou outra exportação) vêm do navegador
      for (const [id, v] of await itensGuardados(comCompra.map((e) => e.id))) itens.set(id, { itens: v });
      let feitos = itens.size;
      setExportando({ etapa: 'Buscando os itens de cada edital no PNCP', feito: 0, total: comCompra.length });
      let i = 0;
      await Promise.all(
        Array.from({ length: Math.min(6, comCompra.length) }, async () => {
          while (i < comCompra.length && !cancelarExport.current) {
            const e = comCompra[i++];
            if (itens.has(e.id)) continue;
            const ref = e.compra!;
            try {
              const viaApi = await callApi<{ itens: any[] | null }>('compra', { cnpj: ref.cnpj, ano: ref.ano, seq: ref.seq });
              const lidos = viaApi?.itens ?? (await fetchItensCompra(ref));
              itens.set(e.id, { itens: lidos });
              guardarItens(e.id, lidos);
            } catch {
              itens.set(e.id, { itens: null, erro: 'PNCP' });
            }
            setExportando({ etapa: 'Buscando os itens de cada edital no PNCP', feito: ++feitos, total: comCompra.length });
          }
        }),
      );
      if (cancelarExport.current) return;
      const hoje = new Date().toISOString().slice(0, 10);
      const regiaoNome = regiao === 'zona-da-mata' ? (micro ? `zona-da-mata-${rotuloPerto(micro)}` : 'zona-da-mata') : regiao;
      const nome = `${agil ? 'editais-agil-cnae' : 'editais-abertos'}-${regiaoNome}-${hoje}.xlsx`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase();
      baixarXlsx(nome, abasEditais(lista, itens, { agil: agil || !!livresKey }));
    } catch {
      setExportErro('O PNCP não respondeu para montar a planilha. Tente de novo em alguns minutos.');
    } finally {
      setExportando(null);
    }
  };

  const alternarCnae = (codigo: string) => setCnaesSel((c) => (c.includes(codigo) ? c.filter((x) => x !== codigo) : [...c, codigo]));

  const temMais = items.length < total;
  const nomeBase = geo?.cidades.find(([, ib]) => ib === avanc.base)?.[0] || 'Astolfo Dutra';
  // quantos editais de cada modalidade há na região (para os botões do filtro)
  const contagemModalidade = (() => {
    if (!painelMais || regiao === 'brasil') return null;
    const l = listaPronta(regiao === 'zona-da-mata' ? 'zm' : 'mg');
    if (!l) return null;
    const m = new Map<string, number>();
    for (const e of filtroBase(l.items, { regiao, micro, q })) m.set(grupoModalidade(e.modalidade), (m.get(grupoModalidade(e.modalidade)) || 0) + 1);
    return m;
  })();

  return (
    <>
        {/* Filtros + lista */}
        <section id="editais" aria-label="Lista de editais" className="bg-[#F4F7FB] py-10 sm:py-14 min-h-[60vh]">
          <Container>
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-3 lg:gap-4">
                <div role="group" aria-label="Região" className={`grid ${agil ? 'grid-cols-2' : 'grid-cols-3'} p-1 rounded-xl bg-slate-100 shrink-0`}>
                  {(agil
                    ? ([
                        ['zona-da-mata', 'Zona da Mata mineira'],
                        ['mg', 'Minas Gerais'],
                      ] as const)
                    : ([
                        ['zona-da-mata', 'Zona da Mata'],
                        ['mg', 'Minas Gerais'],
                        ['brasil', 'Brasil'],
                      ] as const)
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={regiao === v}
                      onClick={() => {
                        setRegiao(v);
                        if (v !== 'zona-da-mata') setMicro('');
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
                  <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="search"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por objeto, órgão ou cidade (ex.: merenda, limpeza, Ubá)"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 text-base focus:outline-none focus:border-[#0478CA] focus:ring-2 focus:ring-[#0478CA]/20"
                  />
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:flex lg:flex-wrap lg:gap-4 shrink-0">
                {!agil && (
                  <button
                    type="button"
                    aria-expanded={painelCnaes}
                    aria-controls="filtro-cnae-livre"
                    onClick={() => setPainelCnaes((v) => !v)}
                    className={`shrink-0 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-base font-bold border-2 transition-colors cursor-pointer ${
                      painelCnaes || livres.length ? 'border-[#0478CA] text-[#0369B3] bg-[#0478CA]/5' : 'border-slate-300 text-slate-700 hover:border-[#0478CA]'
                    }`}
                  >
                    <Icon name="building" className="w-5 h-5" />
                    CNAE{livres.length ? ` (${livres.length})` : ''}
                  </button>
                )}
                {agil && (
                  <label className="col-span-2 sm:col-span-1 shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 border-slate-300 focus-within:border-[#0478CA]">
                    <span className="text-sm font-bold text-slate-600">Segmento</span>
                    <select
                      value={segmento}
                      onChange={(e) => {
                        setSegmento(e.target.value);
                        setPainelCnaes(false);
                      }}
                      className={`w-full sm:w-44 py-1.5 bg-transparent text-base font-bold focus:outline-none cursor-pointer truncate ${segmento ? 'text-[#0369B3]' : 'text-slate-700'}`}
                    >
                      <option value="">CNAEs da Ágil CM</option>
                      {SEGMENTOS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {agil && !segmento && (
                  <button
                    type="button"
                    aria-expanded={painelCnaes}
                    aria-controls="filtro-cnaes"
                    onClick={() => setPainelCnaes((v) => !v)}
                    className={`shrink-0 inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-3 rounded-xl text-base font-bold border-2 transition-colors cursor-pointer ${
                      painelCnaes || cnaesSel.length ? 'border-[#0478CA] text-[#0369B3] bg-[#0478CA]/5' : 'border-slate-300 text-slate-700 hover:border-[#0478CA]'
                    }`}
                  >
                    <Icon name="building" className="w-5 h-5" />
                    CNAEs{cnaesSel.length ? ` (${cnaesSel.length})` : ''}
                  </button>
                )}
                <button
                  type="button"
                  aria-expanded={painelLocais}
                  aria-controls="filtro-locais"
                  onClick={() => setPainelLocais((v) => !v)}
                  className={`shrink-0 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-base font-bold border-2 transition-colors cursor-pointer whitespace-nowrap ${
                    painelLocais || locais.length ? 'border-[#0478CA] text-[#0369B3] bg-[#0478CA]/5' : 'border-slate-300 text-slate-700 hover:border-[#0478CA]'
                  }`}
                >
                  <Icon name="gavel" className="w-5 h-5" />
                  Local do pregão{locais.length ? ` (${locais.length})` : ''}
                </button>
                {(

                  <button
                    type="button"
                    aria-expanded={painelMais}
                    aria-controls="filtro-avancado"
                    onClick={() => setPainelMais((v) => !v)}
                    className={`shrink-0 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-base font-bold border-2 transition-colors cursor-pointer whitespace-nowrap ${
                      painelMais || extrasAtivos ? 'border-[#0478CA] text-[#0369B3] bg-[#0478CA]/5' : 'border-slate-300 text-slate-700 hover:border-[#0478CA]'
                    }`}
                  >
                    <Icon name="filter" className="w-5 h-5" />
                    Mais filtros{contarAvancado(avanc) ? ` (${contarAvancado(avanc)})` : ''}
                  </button>
                )}
                {/* na aba AGIL CNAE fica só a Super Sugestão */}
                {!agil && (
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
                )}
                {agil && (
                  <button
                    type="button"
                    aria-expanded={superSug}
                    aria-controls="super-sugestao"
                    onClick={() => {
                      setSuperSug((v) => !v);
                      setTimeout(() => document.getElementById('super-sugestao')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                    }}
                    className={`shrink-0 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-base font-extrabold tracking-wide transition-colors cursor-pointer ${
                      superSug ? 'bg-[#F5A623] text-[#0F2053]' : 'bg-[#0F2053] hover:bg-[#13306f] text-white'
                    }`}
                  >
                    <Icon name="search" className="w-5 h-5" />
                    Super Sugestão
                  </button>
                )}
                </div>
              </div>

              {regiao === 'zona-da-mata' && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-sm font-semibold text-slate-600 mb-2">Por aqui por perto · microrregião ou cidade</p>
                  <div role="group" aria-label="Microrregião ou cidade" className="flex flex-wrap gap-2">
                    {['', ...PERTO].map((m) => (
                      <button
                        key={m || 'todas'}
                        type="button"
                        aria-pressed={micro === m}
                        onClick={() => setMicro(m)}
                        className={`px-3.5 py-2 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${
                          micro === m ? 'bg-[#0F2053] border-[#0F2053] text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-[#0478CA]'
                        }`}
                      >
                        {m ? rotuloPerto(m) : 'Toda a Zona da Mata'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {painelMais && (
                <FiltrosAvancados
                  valor={avanc}
                  onChange={setAvanc}
                  ordem={ordem}
                  onOrdem={setOrdem}
                  cidades={geo?.cidades ?? null}
                  contagemModalidade={contagemModalidade}
                />
              )}

              {agil && !segmento && painelCnaes && (
                <div id="filtro-cnaes" className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-slate-600">
                      CNAEs da Ágil CM {cnaesSel.length ? '' : '(nenhum marcado = todos)'}
                    </p>
                    {cnaesSel.length > 0 && (
                      <button type="button" onClick={() => setCnaesSel([])} className="text-sm font-bold text-[#0369B3] underline cursor-pointer">
                        Limpar ({cnaesSel.length})
                      </button>
                    )}
                  </div>
                  <div role="group" aria-label="CNAEs" className="flex flex-wrap gap-2">
                    {AGIL_CNAES.map((c) => {
                      const on = cnaesSel.includes(c.codigo);
                      return (
                        <button
                          key={c.codigo}
                          type="button"
                          aria-pressed={on}
                          onClick={() => alternarCnae(c.codigo)}
                          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold border text-left transition-colors cursor-pointer ${
                            on ? 'bg-[#0F2053] border-[#0F2053] text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-[#0478CA]'
                          }`}
                        >
                          <span aria-hidden="true" className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center text-[11px] ${on ? 'bg-white text-[#0F2053] border-white' : 'border-slate-400'}`}>
                            {on ? '✓' : ''}
                          </span>
                          <span className="tabular-nums whitespace-nowrap">{c.codigo}</span>
                          <span className={on ? 'text-white/85' : 'text-slate-500'}>
                            {c.descricao}
                            {c.principal ? ' (principal)' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!agil && painelCnaes && (
                <div id="filtro-cnae-livre" className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-slate-600">
                      CNAE · mostra os editais cujo objeto tem relação com os CNAEs escolhidos {livres.length ? '' : '(nenhum = todos os editais)'}
                    </p>
                    {livres.length > 0 && (
                      <button type="button" onClick={() => setLivres([])} className="text-sm font-bold text-[#0369B3] underline cursor-pointer">
                        Limpar ({livres.length})
                      </button>
                    )}
                  </div>
                  {livres.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {livres.map((id) => {
                        const c = CATALOGO_POR_ID.get(id)!;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setLivres((l) => l.filter((x) => x !== id))}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold bg-[#0F2053] text-white cursor-pointer"
                            title="Remover"
                          >
                            <span className="tabular-nums">{c.rotulo.length > 24 ? `${c.rotulo.slice(0, 22)}…` : c.rotulo}</span>
                            <span className="text-white/80">{c.descricao}</span>
                            <span aria-hidden="true">×</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <label className="relative block">
                    <span className="sr-only">Buscar CNAE</span>
                    <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="search"
                      value={buscaCnae}
                      onChange={(e) => setBuscaCnae(e.target.value)}
                      placeholder="Digite o código (ex.: 4761-0/03) ou a atividade (ex.: papelaria, limpeza)"
                      className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 text-base focus:outline-none focus:border-[#0478CA] focus:ring-2 focus:ring-[#0478CA]/20"
                    />
                  </label>
                  <ul className="mt-2 max-h-72 overflow-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {buscarCnae(buscaCnae, 40).map((c) => {
                      const on = livres.includes(c.id);
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => setLivres((l) => (l.includes(c.id) ? l.filter((x) => x !== c.id) : [...l, c.id]))}
                            className={`w-full text-left px-3.5 py-2.5 flex items-start gap-3 cursor-pointer ${on ? 'bg-[#0478CA]/10' : 'hover:bg-slate-50'}`}
                          >
                            <span aria-hidden="true" className={`mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center text-[11px] ${on ? 'bg-[#0F2053] text-white border-[#0F2053]' : 'border-slate-400'}`}>
                              {on ? '✓' : ''}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[15px] font-semibold text-slate-800">{c.descricao}</span>
                              <span className="block text-sm text-slate-500 tabular-nums">
                                CNAE {c.rotulo}
                                {c.agil ? ' · da Ágil CM' : ''}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                    {!buscarCnae(buscaCnae, 1).length && (
                      <li className="px-3.5 py-3 text-[15px] text-slate-600">Ainda não há palavras-chave para esse CNAE. Tente pela atividade (ex.: "uniformes").</li>
                    )}
                  </ul>
                </div>
              )}

              {painelLocais && (
                <div id="filtro-locais" className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-slate-600">
                      Local do pregão · plataforma onde acontece a disputa {locais.length ? '' : '(nenhum marcado = todos)'}
                    </p>
                    {locais.length > 0 && (
                      <button type="button" onClick={() => setLocais([])} className="text-sm font-bold text-[#0369B3] underline cursor-pointer">
                        Limpar ({locais.length})
                      </button>
                    )}
                  </div>
                  {facetasEstado === 'loading' && !facetasLocais && <p className="text-[15px] text-slate-600">Contando editais por local…</p>}
                  {facetasEstado === 'erro' && <p className="text-[15px] text-amber-900">O PNCP não respondeu para listar os locais.</p>}
                  {facetasLocais && (
                    <div role="group" aria-label="Locais do pregão" className={`flex flex-wrap gap-2 ${facetasEstado === 'loading' ? 'opacity-60' : ''}`}>
                      {[...facetasLocais, ...locais.filter((l) => !facetasLocais.some((x) => x.nome === l)).map((nome) => ({ nome, total: 0 }))].map((f) => {
                        const on = locais.includes(f.nome);
                        return (
                          <button
                            key={f.nome}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setLocais((ls) => (ls.includes(f.nome) ? ls.filter((x) => x !== f.nome) : [...ls, f.nome]))}
                            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${
                              on ? 'bg-[#0F2053] border-[#0F2053] text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-[#0478CA]'
                            }`}
                          >
                            <span aria-hidden="true" className={`w-4 h-4 rounded border flex items-center justify-center text-[11px] ${on ? 'bg-white text-[#0F2053] border-white' : 'border-slate-400'}`}>
                              {on ? '✓' : ''}
                            </span>
                            {f.nome}
                            <span className={`tabular-nums ${on ? 'text-white/75' : 'text-slate-500'}`}>{f.total.toLocaleString('pt-BR')}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {tendencia && (
              <TendenciaPanel termoInicial={q} regiaoInicial={regiao} onClose={() => setTendencia(false)} />
            )}
            {sugestao && <SugestaoPanel onClose={() => setSugestao(false)} />}
            {agil && superSug && (
              <SuperSugestaoPanel
                onClose={() => setSuperSug(false)}
                obterEditais={(prog) => listarTodos({ tudo: true, onProgress: (l, t) => prog('Lendo os editais abertos do restante de Minas Gerais', l, t) })}
                obterEditaisZM={(prog) => listaDaRegiao('zona-da-mata', (l, t) => prog('Lendo os editais abertos da Zona da Mata', l, t))}
              />
            )}

            {/* Resumo */}
            <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-lg font-bold text-[#0F2053]" aria-live="polite">
                {loading && pagina === 1
                  ? 'Buscando editais…'
                  : `${total.toLocaleString('pt-BR')} ${total === 1 ? 'edital aberto' : 'editais abertos'}${
                      livres.length && !agil ? ` ${total === 1 ? 'ligado' : 'ligados'} a ${livres.length === 1 ? `${CATALOGO_POR_ID.get(livres[0])?.descricao}` : `${livres.length} CNAEs`}` : ''
                    }${
                      agil && segmento ? ` do segmento ${SEGMENTO_POR_ID.get(segmento)?.nome}` : agil ? (cnaesSel.length === 1 ? ` do CNAE ${cnaesSel[0]}` : cnaesSel.length ? ` de ${cnaesSel.length} CNAEs da Ágil CM` : ` ${total === 1 ? 'ligado' : 'ligados'} aos CNAEs da Ágil CM`) : ''
                    }${
                      regiao === 'zona-da-mata' ? (micro.startsWith('cidade:') ? ` em ${rotuloPerto(micro)}` : micro ? ` na microrregião de ${micro}` : ' na Zona da Mata') : regiao === 'brasil' ? ' no Brasil' : ' em Minas Gerais'
                    }${
                      locais.length ? ` · ${locais.length === 1 ? `pregão em ${locais[0]}` : `${locais.length} locais`}` : ''
                    }`}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {q.length >= 3 && !tendencia && (
                  <button
                    type="button"
                    onClick={() => {
                      setTendencia(true);
                      setTimeout(() => document.getElementById('tendencia')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                    }}
                    title="Quantos editais com essa palavra saíram por mês: em alta ou em baixa, meses fortes e quem mais compra"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-[#0478CA]/40 text-[#0369B3] hover:bg-[#0478CA]/5 text-sm font-bold cursor-pointer"
                  >
                    <Icon name="chart" className="w-4 h-4" />
                    Tendência de “{q.length > 24 ? `${q.slice(0, 22)}…` : q}”
                  </button>
                )}
                <p className="text-sm text-slate-500">
                  {ordem === 'recentes'
                    ? 'Ordenados pela última atualização'
                    : ordem === 'prazo'
                      ? 'Ordenados pelo prazo mais próximo'
                      : ordem === 'valor-desc'
                        ? 'Ordenados do maior valor para o menor'
                        : ordem === 'valor-asc'
                          ? 'Ordenados do menor valor para o maior'
                          : `Ordenados do mais perto para o mais longe de ${nomeBase}`}
                  {atualizadoEm && !loading ? ` · consulta em ${formatHora(atualizadoEm)}` : ''}
                  {atualizadoEm && !loading && fonte === 'direto' && regiao !== 'brasil' && (
                    <>
                      {' · '}
                      <button
                        type="button"
                        onClick={() => {
                          descartarListas();
                          setTentativa((t) => t + 1);
                        }}
                        title="Lê a lista de novo no PNCP (normalmente ela fica guardada por 30 minutos)"
                        className="font-bold text-[#0369B3] underline cursor-pointer"
                      >
                        atualizar
                      </button>
                    </>
                  )}
                </p>
                <button
                  type="button"
                  onClick={exportar}
                  disabled={!!exportando || loading || total === 0}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D6F42] hover:bg-[#185C37] text-white text-[15px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icon name="sheet" className="w-5 h-5" />
                  Exportar Excel
                </button>
              </div>
            </div>

            {exportando && (
              <div className="mt-4 p-4 rounded-xl bg-white border border-slate-200" aria-live="polite">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[15px] text-slate-700">
                    {exportando.etapa}
                    {exportando.total ? `: ${exportando.feito.toLocaleString('pt-BR')} de ${exportando.total.toLocaleString('pt-BR')}` : '…'}
                  </p>
                  <button type="button" onClick={() => (cancelarExport.current = true)} className="text-sm font-bold text-slate-600 underline cursor-pointer">
                    Cancelar
                  </button>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full bg-[#1D6F42] transition-all ${exportando.total ? '' : 'w-1/3 animate-pulse'}`}
                    style={exportando.total ? { width: `${Math.min(100, (exportando.feito / Math.max(1, exportando.total)) * 100)}%` } : undefined}
                  />
                </div>
                {exportando.total > 300 && <p className="mt-2 text-sm text-slate-500">São muitos editais: pode levar alguns minutos. Filtre a lista para exportar mais rápido.</p>}
              </div>
            )}
            {exportErro && (
              <p role="alert" className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[15px]">
                {exportErro}
              </p>
            )}

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
                  Lendo os editais {regiao === 'zona-da-mata' ? 'da Zona da Mata' : 'de Minas Gerais'}
                  {agil ? ' para filtrar pelos CNAEs da Ágil CM' : ''}: {progresso.loaded.toLocaleString('pt-BR')} de{' '}
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
                <a href="https://pncp.gov.br/app/editais?status=recebendo_proposta&ufs=MG" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-bold text-[#0369B3] underline">
                  Abrir a busca diretamente no PNCP
                </a>
              </div>
            )}

            {resumo && resumo.total > 0 && !loading && (
              <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Editais nesta busca</p>
                    <p className="text-2xl font-extrabold text-[#0F2053] tabular-nums">{resumo.total.toLocaleString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Valor estimado somado</p>
                    <p className="text-2xl font-extrabold text-[#0F2053] tabular-nums">{abreviarBRL(resumo.valor)}</p>
                    {resumo.semValor > 0 && <p className="text-xs text-slate-500">{resumo.semValor.toLocaleString('pt-BR')} sem valor informado</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAvanc((a) => ({ ...a, prazo: a.prazo === '3' ? '' : '3' }));
                      setPainelMais(true);
                    }}
                    title="Mostrar só os que encerram em até 3 dias"
                    className="text-left cursor-pointer group"
                  >
                    <p className="text-sm text-slate-500 group-hover:text-[#0369B3]">Encerram em até 3 dias</p>
                    <p className="text-2xl font-extrabold text-red-700 tabular-nums">{resumo.encerra3.toLocaleString('pt-BR')}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAvanc((a) => ({ ...a, srp: a.srp === 'sim' ? '' : 'sim' }));
                      setPainelMais(true);
                    }}
                    title="Mostrar só registro de preços"
                    className="text-left cursor-pointer group"
                  >
                    <p className="text-sm text-slate-500 group-hover:text-[#0369B3]">Registro de preços</p>
                    <p className="text-2xl font-extrabold text-[#0F2053] tabular-nums">{resumo.srp.toLocaleString('pt-BR')}</p>
                  </button>
                </div>
                {resumo.porModalidade.length > 1 && (
                  <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Por modalidade">
                    {resumo.porModalidade.map((m) => {
                      const on = avanc.modalidades.includes(m.nome);
                      return (
                        <button
                          key={m.nome}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setAvanc((a) => ({ ...a, modalidades: on ? a.modalidades.filter((x) => x !== m.nome) : [...a.modalidades, m.nome] }))}
                          className={`px-3 py-1.5 rounded-full text-sm font-semibold border cursor-pointer ${
                            on ? 'bg-[#0F2053] border-[#0F2053] text-white' : 'bg-[#F7FAFD] border-slate-200 text-slate-700 hover:border-[#0478CA]'
                          }`}
                        >
                          {m.nome} <span className={on ? 'text-white/75' : 'text-slate-500'}>· {m.total.toLocaleString('pt-BR')}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
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
                          <span className="px-2.5 py-1 rounded-full bg-[#0478CA]/10 text-[#0369B3] font-bold">{e.modalidade || 'Licitação'}</span>
                          {e.srp && <span className="px-2.5 py-1 rounded-full bg-violet-50 text-violet-800 font-bold">Registro de preços</span>}
                          {(() => {
                              const km = kmAte(e);
                              return km === null || km === undefined ? null : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold" title="Distância em linha reta entre as sedes dos municípios">
                                  <Icon name="pin" className="w-3.5 h-3.5" />
                                  {km < 3 ? `em ${nomeBase}` : `~${Math.round(km)} km de ${nomeBase}`}
                                </span>
                              );
                            })()}
                          {e.microrregiao && (
                            <span className="px-2.5 py-1 rounded-full bg-[#0E7A3F]/10 text-[#0E7A40] font-bold">Zona da Mata · {e.microrregiao}</span>
                          )}
                          {(e.local || e.fonte) && (
                            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold" title={e.fonte ? `Publicado no PNCP por: ${e.fonte}` : undefined}>
                              Local do pregão: {e.local || e.fonte}
                            </span>
                          )}
                          <span className="text-slate-500">Atualizado {ha(e.atualizadoEm)}</span>
                          {(

                            <button
                              type="button"
                              onClick={() => alternarMeuEdital(e)}
                              aria-pressed={!!meus[e.id]}
                              title={meus[e.id] ? 'Tirar de Meus editais' : 'Salvar em Meus editais (acompanhar prazo, etapa e anotações)'}
                              className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-bold cursor-pointer transition-colors ${
                                meus[e.id] ? 'bg-[#F5A623]/15 border-[#F5A623] text-[#8a5a00]' : 'bg-white border-slate-300 text-slate-600 hover:border-[#F5A623]'
                              }`}
                            >
                              <Icon name="star" className={`w-4 h-4 ${meus[e.id] ? 'fill-current' : ''}`} />
                              {meus[e.id] ? 'Salvo' : 'Salvar'}
                            </button>
                          )}
                        </div>
                        <h2 className="mt-3 text-lg font-bold text-[#0F2053] leading-snug line-clamp-3">{e.objeto || e.titulo}</h2>
                        {e.cnaes && e.cnaes.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2 text-sm">
                            {e.cnaes.map((c) => (
                              <span key={c} title={CATALOGO_POR_ID.get(c)?.rotulo} className="px-2.5 py-1 rounded-full bg-[#F5A623]/15 text-[#8a5a00] font-bold">
                                {SEGMENTO_POR_ID.has(c)
                                  ? `Segmento · ${SEGMENTO_POR_ID.get(c)?.nome}`
                                  : `${CATALOGO_POR_ID.get(c)?.agil ? `CNAE ${c}` : 'CNAE'} · ${CATALOGO_POR_ID.get(c)?.descricao}`}
                              </span>
                            ))}
                            {e.termos && e.termos.length > 0 && (
                              <span className="px-1 py-1 text-slate-500">Termos no objeto: {e.termos.slice(0, 4).join(', ')}</span>
                            )}
                          </div>
                        )}
                        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[15px]">
                          <div className="min-w-0">
                            <dt className="text-sm text-slate-500">Órgão</dt>
                            <dd className="font-semibold text-slate-800 truncate" title={e.orgao}>{e.orgao}</dd>
                          </div>
                          <div>
                            <dt className="text-sm text-slate-500">Cidade</dt>
                            <dd className="font-semibold text-slate-800">
                              {e.municipio} · {e.uf || 'MG'}
                            </dd>
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
                          <div className="min-w-0">
                            <dt className="text-sm text-slate-500">Local do pregão</dt>
                            <dd className="font-semibold text-slate-800 truncate">
                              {e.linkLocal ? (
                                <a href={e.linkLocal} target="_blank" rel="noopener noreferrer" className="text-[#0369B3] underline" title={e.linkLocal}>
                                  {e.local}
                                </a>
                              ) : (
                                e.local || 'Ver no edital'
                              )}
                            </dd>
                          </div>
                        </dl>
                        {e.compra && <DetalheCompra compra={e.compra} edital={e} />}
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
                    <p className="mt-1 text-base text-slate-600">
                      Tente outra palavra, marque mais {agil ? 'CNAEs ou ' : ''}locais do pregão ou volte para toda Minas Gerais.
                    </p>
                  </li>
                )}
                {temMais && !loading && (
                  <li>
                    <button
                      type="button"
                      onClick={() => setPagina((p) => p + 1)}
                      className="w-full py-3.5 rounded-xl bg-white border-2 border-[#0478CA]/30 hover:border-[#0478CA] text-[#0369B3] text-base font-bold cursor-pointer"
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
