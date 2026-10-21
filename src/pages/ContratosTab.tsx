import { useEffect, useRef, useState } from 'react';
import { Container, Icon, WhatsAppIcon } from '../components/ui.tsx';
import { formatBRL, whatsappLink } from '../data/servicesData.ts';
import { MICRORREGIOES } from '../data/zonaDaMata.js';
import { precoStats, searchContratosProduto } from '../lib/pncp.js';
import { callApi, formatHora, loadLocal, saveLocal, type Fonte } from '../lib/pncpClient.ts';

type Regiao = 'mg' | 'zona-da-mata';

interface Resultado {
  fornecedor: string;
  quantidade: number | null;
  valorUnitario: number | null;
  valorTotal: number | null;
  data: string;
}
interface Linha {
  contratoId: string;
  titulo: string;
  objeto: string;
  orgao: string;
  municipio: string;
  microrregiao: string | null;
  esfera: string;
  modalidade: string;
  tipo: string;
  fornecedor: string;
  valorGlobal: number | null;
  assinadoEm: string;
  link: string;
  linkCompra: string | null;
  itensIndisponiveis?: boolean;
  item: {
    numero: number;
    descricao: string;
    quantidade: number | null;
    unidade: string;
    valorUnitarioEstimado: number | null;
    valorTotalEstimado: number | null;
    situacao: string;
    resultados?: Resultado[] | null;
  } | null;
}
interface Resposta {
  rows: Linha[];
  proximaPagina: number | null;
  totalBusca: number;
  itensComErro?: number;
  atualizadoEm?: string;
  desatualizado?: boolean;
}

declare global {
  interface Window {
    __PNCP_SAMPLE_CONTRATOS__?: { capturadoEm: string; q: string; rows: Linha[] };
  }
}

const EXEMPLOS = ['notebook', 'arroz', 'pneu', 'ambulância', 'material de limpeza', 'merenda', 'combustível', 'cadeira'];
const MICROS = Object.keys(MICRORREGIOES);

const dataBR = (s?: string) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

export default function ContratosTab() {
  const [produto, setProduto] = useState('');
  const [busca, setBusca] = useState<{ q: string; regiao: Regiao; micro: string; soMunicipios: boolean } | null>(null);
  const [regiao, setRegiao] = useState<Regiao>('mg');
  const [micro, setMicro] = useState('');
  const [soMunicipios, setSoMunicipios] = useState(true);
  const [rows, setRows] = useState<Linha[]>([]);
  const [proxima, setProxima] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [fonte, setFonte] = useState<Fonte>('servidor');
  const [atualizadoEm, setAtualizadoEm] = useState('');
  const reqId = useRef(0);

  const consultar = async (b: NonNullable<typeof busca>, pagina: number): Promise<Resposta & { fonte: Fonte }> => {
    const key = `contratos:${norm(b.q)}:${b.regiao}:${b.micro}:${b.soMunicipios}:${pagina}`;
    const params: Record<string, string> = { q: b.q, regiao: b.regiao, pagina: String(pagina), municipios: b.soMunicipios ? '1' : '0' };
    if (b.micro) params.micro = b.micro;
    const viaApi = await callApi<Resposta>('contratos', params);
    if (viaApi) {
      saveLocal(key, viaApi);
      return { ...viaApi, fonte: 'servidor' };
    }
    try {
      const r = await searchContratosProduto({ q: b.q, regiao: b.regiao, micro: b.micro, soMunicipios: b.soMunicipios, pagina, alvo: 8, maxPaginas: 3 });
      const out = { ...r, atualizadoEm: new Date().toISOString() };
      saveLocal(key, out);
      return { ...out, fonte: 'direto' };
    } catch {
      /* segue */
    }
    const salvo = loadLocal<Resposta>(key);
    if (salvo) return { ...salvo.value, atualizadoEm: new Date(salvo.at).toISOString(), fonte: 'salvo' };
    const sample = typeof window !== 'undefined' ? window.__PNCP_SAMPLE_CONTRATOS__ : undefined;
    if (sample) {
      const match = norm(b.q).split(/\s+/).every((t) => norm(sample.q).includes(t) || t.length < 2);
      const filtered = match
        ? sample.rows.filter(
            (r) =>
              (!b.soMunicipios || r.esfera === 'M') &&
              (b.regiao !== 'zona-da-mata' || r.microrregiao) &&
              (!b.micro || r.microrregiao === b.micro),
          )
        : [];
      return { rows: pagina === 1 ? filtered : [], proximaPagina: null, totalBusca: filtered.length, atualizadoEm: sample.capturadoEm, fonte: 'amostra' };
    }
    throw new Error('PNCP indisponível');
  };

  const executar = (b: NonNullable<typeof busca>, pagina: number) => {
    const id = ++reqId.current;
    setLoading(true);
    setErro('');
    if (pagina === 1) setRows([]);
    consultar(b, pagina)
      .then((r) => {
        if (id !== reqId.current) return;
        setRows((prev) => (pagina === 1 ? r.rows : [...prev, ...r.rows]));
        setProxima(r.proximaPagina);
        setFonte(r.fonte);
        setAtualizadoEm(r.atualizadoEm || '');
        setAviso(
          r.fonte === 'salvo'
            ? `O PNCP não respondeu agora. Mostrando a última pesquisa salva (${formatHora(r.atualizadoEm)}).`
            : r.desatualizado
              ? `O PNCP está instável. Mostrando a última pesquisa que funcionou (${formatHora(r.atualizadoEm)}).`
              : r.itensComErro
                ? `O PNCP não entregou os itens de ${r.itensComErro} ${r.itensComErro === 1 ? 'compra' : 'compras'}; elas aparecem só com o valor do contrato.`
                : '',
        );
      })
      .catch(() => id === reqId.current && setErro('O PNCP está fora do ar ou muito lento neste momento. Costuma voltar em poucos minutos.'))
      .finally(() => id === reqId.current && setLoading(false));
  };

  const pesquisar = (q = produto) => {
    const termo = q.trim();
    if (termo.length < 2) return;
    setProduto(termo);
    const b = { q: termo, regiao, micro: regiao === 'zona-da-mata' ? micro : '', soMunicipios };
    setBusca(b);
    executar(b, 1);
  };

  // Ao trocar filtros depois de uma pesquisa, refaz automaticamente
  useEffect(() => {
    if (!busca) return;
    const b = { ...busca, regiao, micro: regiao === 'zona-da-mata' ? micro : '', soMunicipios };
    setBusca(b);
    executar(b, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regiao, micro, soMunicipios]);

  const stats = precoStats(rows);

  return (
    <section id="contratos" aria-label="Pesquisa de contratos e preços" className="bg-[#F4F7FB] py-10 sm:py-14 min-h-[60vh]">
      <Container>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            pesquisar();
          }}
          className="p-4 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm"
        >
          <label htmlFor="produto" className="block text-lg font-bold text-[#0F2053]">
            Qual produto você quer pesquisar?
          </label>
          <p className="mt-1 text-[15px] text-slate-600">
            Veja quais prefeituras compraram, o modelo/descrição pedido, a quantidade, o valor pago e quem venceu.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 min-w-0">
              <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="produto"
                type="search"
                value={produto}
                onChange={(e) => setProduto(e.target.value)}
                placeholder="Ex.: notebook, arroz tipo 1, pneu 175/70 R13"
                className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-300 text-base focus:outline-none focus:border-[#0478CA] focus:ring-2 focus:ring-[#0478CA]/20"
              />
            </div>
            <button
              type="submit"
              disabled={produto.trim().length < 2 || loading}
              className="px-6 py-3.5 rounded-xl bg-[#0478CA] hover:bg-[#03609F] disabled:opacity-50 text-white text-base font-bold cursor-pointer"
            >
              {loading && rows.length === 0 ? 'Pesquisando…' : 'Pesquisar'}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500">Exemplos:</span>
            {EXEMPLOS.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => pesquisar(ex)}
                className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-[#0478CA]/10 text-sm font-semibold text-slate-700 cursor-pointer"
              >
                {ex}
              </button>
            ))}
          </div>

          <div className="mt-5 pt-5 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center gap-4">
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
                  onClick={() => setRegiao(v)}
                  className={`px-4 py-2.5 rounded-lg text-[15px] font-bold transition-colors cursor-pointer ${
                    regiao === v ? 'bg-[#0478CA] text-white shadow-sm' : 'text-slate-700 hover:text-[#0F2053]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="inline-flex items-center gap-2.5 text-[15px] font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={soMunicipios}
                onChange={(e) => setSoMunicipios(e.target.checked)}
                className="w-5 h-5 accent-[#0478CA]"
              />
              Só prefeituras e câmaras municipais
            </label>
          </div>
          {regiao === 'zona-da-mata' && (
            <div role="group" aria-label="Microrregião" className="mt-4 flex flex-wrap gap-2">
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
          )}
        </form>

        {/* Antes da primeira pesquisa */}
        {!busca && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              ['search', 'Pesquise um produto', 'Digite o que sua empresa vende, do jeito que aparece nos editais.'],
              ['bank', 'Veja quem comprou', 'Prefeitura, cidade, data, quantidade e o modelo/descrição exigido.'],
              ['chart', 'Compare os preços', 'Menor, médio e maior preço pago, e o fornecedor que venceu.'],
            ].map(([icon, t, d]) => (
              <div key={t} className="p-5 rounded-2xl bg-white border border-slate-200">
                <span className="w-11 h-11 rounded-xl bg-[#0478CA]/10 text-[#0478CA] flex items-center justify-center">
                  <Icon name={icon} className="w-6 h-6" />
                </span>
                <p className="mt-3 text-lg font-bold text-[#0F2053]">{t}</p>
                <p className="mt-1 text-[15px] text-slate-600">{d}</p>
              </div>
            ))}
          </div>
        )}

        {busca && (
          <>
            <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-lg font-bold text-[#0F2053]" aria-live="polite">
                {loading && rows.length === 0
                  ? `Pesquisando “${busca.q}” nos contratos do PNCP…`
                  : `${rows.length} ${rows.length === 1 ? 'compra encontrada' : 'compras encontradas'} de “${busca.q}”${
                      busca.regiao === 'zona-da-mata' ? (busca.micro ? ` na microrregião de ${busca.micro}` : ' na Zona da Mata') : ' em Minas Gerais'
                    }`}
              </p>
              {atualizadoEm && !loading && <p className="text-sm text-slate-500">Mais recentes primeiro · consulta em {formatHora(atualizadoEm)}</p>}
            </div>

            {fonte === 'amostra' && (
              <p className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[15px]">
                <strong>Visualização de demonstração:</strong> esta prévia não acessa a internet. Há uma amostra real do PNCP
                só para <strong>“{window.__PNCP_SAMPLE_CONTRATOS__?.q}”</strong>. No site publicado qualquer produto é pesquisado ao vivo.
              </p>
            )}
            {aviso && (
              <p role="status" className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[15px]">
                {aviso}
              </p>
            )}
            {erro && (
              <div role="alert" className="mt-6 p-5 rounded-2xl bg-white border border-amber-200">
                <p className="text-base text-amber-900">{erro}</p>
                <button
                  type="button"
                  onClick={() => executar(busca, 1)}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0478CA] hover:bg-[#03609F] text-white font-bold cursor-pointer"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {stats && stats.n >= 2 && (
              <dl className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  ['Menor preço unitário', stats.menor, 'text-[#0E7A40]'],
                  ['Preço médio', stats.medio, 'text-[#0F2053]'],
                  ['Maior preço unitário', stats.maior, 'text-red-700'],
                ].map(([label, v, cls]) => (
                  <div key={label as string} className="p-5 rounded-2xl bg-white border border-slate-200">
                    <dt className="text-sm font-semibold text-slate-500">{label as string}</dt>
                    <dd className={`mt-1 text-2xl font-bold font-display tabular-nums ${cls}`}>{formatBRL(v as number, 2)}</dd>
                  </div>
                ))}
                <p className="sm:col-span-3 -mt-1 text-sm text-slate-500">
                  Calculado sobre {stats.n} {stats.n === 1 ? 'item' : 'itens'} com preço: valor homologado (pago ao vencedor) ou, se ainda não houver, o estimado.
                </p>
              </dl>
            )}

            <ol className="mt-6 space-y-4">
              {rows.map((r, idx) => {
                const res = r.item?.resultados?.find((x) => x.valorUnitario) ?? null;
                return (
                  <li key={`${r.contratoId}-${r.item?.numero ?? 'c'}-${idx}`}>
                    <article className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200">
                      <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="px-2.5 py-1 rounded-full bg-[#0478CA]/10 text-[#0478CA] font-bold">{r.modalidade || r.tipo}</span>
                            {r.microrregiao && (
                              <span className="px-2.5 py-1 rounded-full bg-[#128C4A]/10 text-[#0E7A40] font-bold">Zona da Mata · {r.microrregiao}</span>
                            )}
                            {r.assinadoEm && <span className="text-slate-500">Assinado em {dataBR(r.assinadoEm)}</span>}
                          </div>
                          <h3 className="mt-3 text-lg font-bold text-[#0F2053]">{r.orgao}</h3>
                          <p className="text-[15px] text-slate-600">{r.municipio} · MG</p>

                          <div className="mt-4">
                            <p className="text-sm font-semibold text-slate-500">
                              {r.item ? `Item ${r.item.numero} · descrição / modelo solicitado` : 'Objeto do contrato'}
                            </p>
                            <p className="mt-1 text-base text-slate-800 leading-relaxed">{r.item ? r.item.descricao : r.objeto}</p>
                            {!r.item && r.itensIndisponiveis && (
                              <p className="mt-1 text-sm text-amber-800">O PNCP não entregou os itens desta compra agora; mostrando o valor total do contrato.</p>
                            )}
                          </div>
                        </div>

                        <dl className="md:w-64 shrink-0 grid grid-cols-2 md:grid-cols-1 gap-3 p-4 rounded-xl bg-[#F7FAFD] border border-slate-200 text-[15px]">
                          {r.item ? (
                            <>
                              <div>
                                <dt className="text-sm text-slate-500">Quantidade</dt>
                                <dd className="font-semibold text-slate-800 tabular-nums">
                                  {(res?.quantidade ?? r.item.quantidade)?.toLocaleString('pt-BR') ?? '—'} {r.item.unidade}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-sm text-slate-500">{res ? 'Valor unitário pago' : 'Valor unitário estimado'}</dt>
                                <dd className="text-xl font-bold text-[#0F2053] tabular-nums">
                                  {res?.valorUnitario ? formatBRL(res.valorUnitario, 2) : r.item.valorUnitarioEstimado ? formatBRL(r.item.valorUnitarioEstimado, 2) : '—'}
                                </dd>
                                {res && r.item.valorUnitarioEstimado && res.valorUnitario !== r.item.valorUnitarioEstimado && (
                                  <dd className="text-sm text-slate-500 tabular-nums">Estimado: {formatBRL(r.item.valorUnitarioEstimado, 2)}</dd>
                                )}
                              </div>
                              <div className="col-span-2 md:col-span-1">
                                <dt className="text-sm text-slate-500">Fornecedor vencedor</dt>
                                <dd className="font-semibold text-slate-800">{res?.fornecedor || r.fornecedor || '—'}</dd>
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <dt className="text-sm text-slate-500">Valor do contrato</dt>
                                <dd className="text-xl font-bold text-[#0F2053] tabular-nums">{r.valorGlobal ? formatBRL(r.valorGlobal, 2) : 'Não informado'}</dd>
                              </div>
                              <div>
                                <dt className="text-sm text-slate-500">Fornecedor</dt>
                                <dd className="font-semibold text-slate-800">{r.fornecedor || '—'}</dd>
                              </div>
                            </>
                          )}
                        </dl>
                      </div>
                      <div className="mt-4 flex flex-col sm:flex-row gap-2">
                        <a href={r.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0478CA] hover:bg-[#03609F] text-white text-[15px] font-bold">
                          Ver contrato no PNCP
                          <Icon name="arrow" className="w-4 h-4" />
                        </a>
                        {r.linkCompra && (
                          <a href={r.linkCompra} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 hover:border-[#0478CA] text-[#0F2053] text-[15px] font-bold">
                            Ver a licitação de origem
                          </a>
                        )}
                      </div>
                    </article>
                  </li>
                );
              })}
              {loading &&
                Array.from({ length: rows.length ? 2 : 4 }).map((_, i) => (
                  <li key={`sk${i}`} aria-hidden="true" className="p-6 rounded-2xl bg-white border border-slate-200 animate-pulse">
                    <div className="h-5 w-40 rounded bg-slate-100" />
                    <div className="mt-4 h-5 w-2/3 rounded bg-slate-100" />
                    <div className="mt-2 h-16 w-full rounded bg-slate-100" />
                  </li>
                ))}
              {!loading && !erro && rows.length === 0 && (
                <li className="p-8 rounded-2xl bg-white border border-slate-200 text-center">
                  <p className="text-lg font-bold text-[#0F2053]">Nenhuma compra encontrada com esses filtros</p>
                  <p className="mt-1 text-base text-slate-600">Tente um nome mais simples do produto, desmarque “Só prefeituras” ou pesquise em toda Minas Gerais.</p>
                </li>
              )}
              {proxima && !loading && (
                <li>
                  <button
                    type="button"
                    onClick={() => busca && executar(busca, proxima)}
                    className="w-full py-3.5 rounded-xl bg-white border-2 border-[#0478CA]/30 hover:border-[#0478CA] text-[#0478CA] text-base font-bold cursor-pointer"
                  >
                    Buscar mais compras
                  </button>
                </li>
              )}
            </ol>

            {rows.length > 0 && (
              <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-[#0478CA] to-[#0F2053] text-white flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <p className="text-xl font-bold font-display">Quer vender “{busca.q}” para prefeituras?</p>
                  <p className="mt-1 text-base text-white/85">A Ágil CM monitora os editais, monta sua proposta com preço competitivo e disputa o pregão.</p>
                </div>
                <a
                  href={whatsappLink(`Olá! Pesquisei “${busca.q}” nos contratos do site da Ágil CM e quero ajuda para vender para prefeituras.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-[#0F2053] font-bold hover:bg-slate-100 whitespace-nowrap"
                >
                  <WhatsAppIcon className="w-5 h-5" />
                  Falar com a equipe
                </a>
              </div>
            )}
          </>
        )}
      </Container>
    </section>
  );
}
