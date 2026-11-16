// Aba "Possíveis clientes" das Licitações (só para a equipe, com o login do Privado): empresas das cidades vizinhas
// que disputaram licitações da Zona da Mata e não venceram, com a licitação, o item e a colocação.
// Os dados vêm de privado/clientes.json, gerado por scripts/possiveis-clientes.mjs a partir das atas publicadas no PNCP.
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Container, Icon } from '../components/ui.tsx';
import { conferirLogin, sessaoAtiva } from '../lib/privado/auth.ts';
import { cnpjFormatado, diferenca, filtrarClientes, linhasPlanilha, textoColocacao } from '../lib/possiveisClientes.js';
import { baixarXlsx } from '../lib/xlsx.js';

interface Disputa {
  lic: number;
  item: string;
  desc: string;
  col: number;
  melhor: number;
  venc: number | null;
  lances: number;
  participantes: number;
  /** julgamento por lote: a disputa foi pelo lote inteiro */
  lote?: boolean;
}
interface Empresa {
  cnpj: string;
  razao: string;
  fantasia: string;
  cidade: string;
  uf: string;
  porte: string;
  atividade: string;
  situacao: string;
  vitorias: number;
  disputas: Disputa[];
}
interface Licitacao {
  id: string;
  orgao: string;
  municipio: string;
  uf: string;
  titulo: string;
  objeto: string;
  modalidade: string;
  data: string;
}
interface Dados {
  atualizadoEm?: string;
  desde?: string;
  portal?: string;
  licitacoesNoPeriodo?: number;
  licitacoesLidas?: number;
  aindaNaFila?: number;
  cnpjsSemCidade?: number;
  cidades: string[];
  resumo: { empresas: number; disputas: number; licitacoes: number };
  licitacoes: Licitacao[];
  empresas: Empresa[];
}

/** Marca neste navegador que a equipe já entrou uma vez: a aba passa a aparecer nas Licitações */
export const CHAVE_EQUIPE = 'agilcm:equipe';

const campo = 'w-full px-4 py-3 rounded-xl border border-slate-300 text-base focus:outline-none focus:border-[#0478CA] focus:ring-2 focus:ring-[#0478CA]/20';
const brl = (v: number | null) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: v < 10 ? 4 : 2 }));
const dataBR = (iso?: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const COR: Record<string, string> = {
  0: 'bg-violet-100 text-violet-900',
  2: 'bg-amber-100 text-amber-900',
  3: 'bg-sky-100 text-sky-900',
  4: 'bg-slate-200 text-slate-800',
};
const corDe = (col: number) => COR[col] || 'bg-slate-100 text-slate-700';
// faixas do filtro de colocação
const FAIXAS: { id: string; rotulo: string; cols: number[] }[] = [
  { id: '2', rotulo: '2º lugar', cols: [2] },
  { id: '3', rotulo: '3º lugar', cols: [3] },
  { id: '4', rotulo: '4º lugar', cols: [4] },
  { id: '0', rotulo: 'Melhor preço, não levou', cols: [0] },
  { id: '5', rotulo: '5º em diante', cols: Array.from({ length: 96 }, (_, i) => i + 5) },
];

function Entrar({ onEntrar }: { onEntrar: () => void }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [conferindo, setConferindo] = useState(false);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setConferindo(true);
    setErro('');
    const ok = await conferirLogin(email, senha).catch(() => false);
    setConferindo(false);
    if (ok) onEntrar();
    else setErro('E-mail ou senha incorretos.');
  };
  return (
    <form onSubmit={enviar} className="max-w-md mx-auto p-6 sm:p-8 rounded-2xl bg-white border border-slate-200">
      <p className="inline-flex items-center gap-2 text-sm font-bold text-[#0369B3]">
        <Icon name="shield" className="w-5 h-5" /> Área da equipe Ágil CM
      </p>
      <h2 className="mt-2 text-2xl font-bold font-display text-[#0F2053]">Possíveis clientes</h2>
      <p className="mt-2 text-[15px] text-slate-600">Entre com o mesmo e-mail e senha da área Privado.</p>
      <label className="block mt-5">
        <span className="text-sm font-semibold text-slate-700">E-mail</span>
        <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={`mt-1 ${campo}`} />
      </label>
      <label className="block mt-4">
        <span className="text-sm font-semibold text-slate-700">Senha</span>
        <input type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} className={`mt-1 ${campo}`} />
      </label>
      {erro && (
        <p role="alert" className="mt-3 text-[15px] text-red-700">
          {erro}
        </p>
      )}
      <button
        type="submit"
        disabled={conferindo}
        className="mt-5 w-full px-5 py-3 rounded-xl bg-[#0F2053] hover:bg-[#13306f] text-white text-base font-bold cursor-pointer disabled:opacity-60"
      >
        {conferindo ? 'Conferindo…' : 'Entrar'}
      </button>
    </form>
  );
}

function CartaoEmpresa({ e, licitacoes }: { e: Empresa; licitacoes: Licitacao[] }) {
  const [copiado, setCopiado] = useState(false);
  const conta = (cols: number[]) => e.disputas.filter((d) => cols.includes(d.col)).length;
  const nLic = new Set(e.disputas.map((d) => d.lic)).size;
  const resumo = [
    [2, '2º'],
    [3, '3º'],
    [4, '4º'],
    [0, 'melhor preço sem levar'],
  ] as const;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(cnpjFormatado(e.cnpj));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* sem área de transferência */
    }
  };
  return (
    <li className="rounded-2xl bg-white border border-slate-200">
      <details className="group">
        <summary className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 sm:p-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <span className="flex-1 min-w-0">
            <span className="block text-lg font-bold font-display text-[#0F2053] leading-snug">{e.razao}</span>
            <span className="block mt-0.5 text-[15px] text-slate-700">
              {e.cidade} - {e.uf} · CNPJ {cnpjFormatado(e.cnpj)}
              {e.fantasia && e.fantasia !== e.razao ? ` · ${e.fantasia}` : ''}
            </span>
            <span className="block mt-0.5 text-sm text-slate-600">
              {[e.porte && e.porte.toLowerCase().replace(/^./, (c) => c.toUpperCase()), e.atividade].filter(Boolean).join(' · ')}
              {e.situacao && e.situacao !== 'ATIVA' ? ` · situação na Receita: ${e.situacao.toLowerCase()}` : ''}
            </span>
            <span className="mt-2 flex flex-wrap gap-1.5">
              {resumo.map(([col, rotulo]) =>
                conta([col]) ? (
                  <span key={col} className={`px-2.5 py-0.5 rounded-full text-sm font-bold ${corDe(col)}`}>
                    {rotulo}: {conta([col])}
                  </span>
                ) : null,
              )}
              {e.vitorias > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-emerald-100 text-emerald-900">venceu {e.vitorias} no período</span>
              )}
            </span>
          </span>
          <span className="shrink-0 inline-flex items-center gap-1.5 text-[15px] font-bold text-[#0369B3]">
            {e.disputas.length} {e.disputas.length === 1 ? 'item' : 'itens'} em {nLic} {nLic === 1 ? 'licitação' : 'licitações'}
            <Icon name="arrow" className="w-4 h-4 transition-transform group-open:rotate-90" />
          </span>
        </summary>
        <div className="px-4 sm:px-5 pb-5">
          <button type="button" onClick={copiar} className="mb-3 text-sm font-bold text-[#0369B3] underline underline-offset-4 cursor-pointer">
            {copiado ? 'CNPJ copiado' : 'Copiar o CNPJ'}
          </button>
          <ul className="space-y-2.5">
            {e.disputas.map((d, i) => {
              const lic = licitacoes[d.lic];
              const dif = diferenca(d);
              return (
                <li key={i} className="p-3 sm:p-4 rounded-xl bg-[#F7FAFD] border border-slate-200 text-[15px] leading-relaxed">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold ${corDe(d.col)}`}>{textoColocacao(d.col)}</span>
                    <strong className="text-[#0F2053]">
                      {d.lote ? 'Lote' : 'Item'} {Number(d.item) || d.item}:
                    </strong>
                    <span className="text-slate-800">{d.desc}</span>
                  </p>
                  <p className="mt-1 text-slate-700">
                    Melhor lance {brl(d.melhor)}
                    {d.venc != null && <> · vencedora {brl(d.venc)}</>}
                    {dif != null && Math.abs(dif) < 1000 && (
                      <>
                        {' '}
                        ({dif > 0 ? '+' : ''}
                        {dif.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)
                      </>
                    )}{' '}
                    · {d.participantes} empresas {d.lote ? 'no lote' : 'no item'}
                  </p>
                  <p className="mt-1 text-slate-700">
                    <strong className="text-[#0F2053]">{lic.orgao}</strong> · {lic.municipio} - {lic.uf} · {lic.titulo} · {dataBR(lic.data)} ·{' '}
                    <a
                      href={`https://pncp.gov.br/app/editais/${lic.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-[#0369B3] underline underline-offset-4"
                    >
                      abrir no PNCP<span className="sr-only"> (abre em nova aba)</span>
                    </a>
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </details>
    </li>
  );
}

export default function PossiveisClientesTab() {
  const [dentro, setDentro] = useState(false);
  const [dados, setDados] = useState<Dados | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'sem'>('carregando');
  const [cidade, setCidade] = useState('');
  const [faixas, setFaixas] = useState<string[]>(['2', '3', '4']);
  const [q, setQ] = useState('');
  const [mostrar, setMostrar] = useState(30);

  useEffect(() => setDentro(sessaoAtiva()), []);
  useEffect(() => {
    if (!dentro) return;
    try {
      localStorage.setItem(CHAVE_EQUIPE, '1');
    } catch {
      /* sem armazenamento */
    }
    let vivo = true;
    fetch(`${import.meta.env.BASE_URL}privado/clientes.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!vivo) return;
        if (j && Array.isArray(j.empresas)) {
          setDados(j);
          setEstado('ok');
        } else setEstado('sem');
      })
      .catch(() => vivo && setEstado('sem'));
    return () => {
      vivo = false;
    };
  }, [dentro]);

  const colocacoes = useMemo(() => FAIXAS.filter((f) => faixas.includes(f.id)).flatMap((f) => f.cols), [faixas]);
  const lista = useMemo(() => (dados ? (filtrarClientes(dados, { cidade, colocacoes, q }) as Empresa[]) : []), [dados, cidade, colocacoes, q]);
  const itens = lista.reduce((s, e) => s + e.disputas.length, 0);
  const porCidade = useMemo(() => {
    const m: Record<string, number> = {};
    if (dados) for (const e of filtrarClientes(dados, { colocacoes, q }) as Empresa[]) m[e.cidade] = (m[e.cidade] || 0) + 1;
    return m;
  }, [dados, colocacoes, q]);

  const excel = () => {
    if (!dados) return;
    const linhas = linhasPlanilha(dados, lista) as Record<string, string | number>[];
    if (!linhas.length) return;
    const titulos = Object.keys(linhas[0]);
    const moeda = new Set(['Melhor lance', 'Valor da vencedora']);
    const numero = new Set(['Diferença (%)', 'Empresas no item']);
    const larga = new Set(['Empresa', 'Descrição do item', 'Órgão', 'Objeto', 'Atividade principal', 'Link no PNCP']);
    baixarXlsx(`possiveis-clientes-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        nome: 'Possíveis clientes',
        colunas: titulos.map((t) => ({ titulo: t, largura: larga.has(t) ? 44 : 20, tipo: moeda.has(t) ? 'moeda' : numero.has(t) ? 'numero' : 'texto' })),
        linhas: linhas.map((l) => titulos.map((t) => l[t])),
      },
    ]);
  };

  const chip = (ativo: boolean) =>
    `px-3.5 py-2 rounded-full border text-[15px] font-semibold cursor-pointer ${
      ativo ? 'bg-[#0F2053] border-[#0F2053] text-white' : 'bg-white border-slate-300 text-[#0F2053] hover:border-[#0478CA]'
    }`;

  if (!dentro)
    return (
      <section className="bg-[#F4F7FB] py-10 sm:py-14">
        <Container>
          <Entrar onEntrar={() => setDentro(true)} />
        </Container>
      </section>
    );

  return (
    <section aria-labelledby="titulo-clientes" className="bg-[#F4F7FB] py-8 sm:py-10">
      <Container>
        <h2 id="titulo-clientes" className="text-2xl sm:text-3xl font-bold font-display text-[#0F2053] tracking-tight">
          Possíveis clientes
        </h2>
        <p className="mt-2 max-w-4xl text-base sm:text-lg text-slate-700 leading-relaxed">
          Empresas de {dados?.cidades.join(', ').replace(/, ([^,]*)$/, ' e $1') || 'cidades vizinhas'} que disputaram licitações da Zona da Mata e não venceram.
          Quem fica em 2º, 3º ou 4º lugar já participa, mas perde: é para essas empresas que a assessoria em licitações faz diferença.
        </p>

        {estado === 'carregando' && (
          <p role="status" className="mt-6 text-slate-700">
            Carregando a lista…
          </p>
        )}
        {estado === 'sem' && (
          <p role="status" className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
            A lista ainda não foi gerada. Ela é montada pelo GitHub a cada publicação do site; tente de novo em algumas horas.
          </p>
        )}

        {estado === 'ok' && dados && (
          <>
            <ul className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                [dados.resumo.empresas, dados.resumo.empresas === 1 ? 'empresa' : 'empresas'],
                [dados.resumo.disputas, 'itens disputados sem vencer'],
                [dados.resumo.licitacoes, 'licitações com essas empresas'],
                [dados.licitacoesLidas ?? 0, 'atas lidas no período'],
              ].map(([valor, rotulo]) => (
                <li key={rotulo} className="p-4 rounded-2xl bg-white border border-slate-200">
                  <strong className="block text-2xl sm:text-3xl font-bold font-display text-[#0F2053] tabular-nums">{valor}</strong>
                  <span className="block text-sm sm:text-[15px] text-slate-700">{rotulo}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
              <div>
                <p id="rotulo-cidade" className="text-sm font-bold text-slate-700">
                  Cidade da empresa
                </p>
                <div role="group" aria-labelledby="rotulo-cidade" className="mt-2 flex flex-wrap gap-2">
                  <button type="button" aria-pressed={!cidade} onClick={() => setCidade('')} className={chip(!cidade)}>
                    Todas
                  </button>
                  {dados.cidades.map((c) => (
                    <button key={c} type="button" aria-pressed={cidade === c} onClick={() => setCidade(cidade === c ? '' : c)} className={chip(cidade === c)}>
                      {c} <span className="tabular-nums opacity-80">({porCidade[c] || 0})</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p id="rotulo-colocacao" className="text-sm font-bold text-slate-700">
                  Colocação no item
                </p>
                <div role="group" aria-labelledby="rotulo-colocacao" className="mt-2 flex flex-wrap gap-2">
                  {FAIXAS.map((f) => {
                    const ativo = faixas.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => setFaixas(ativo ? faixas.filter((x) => x !== f.id) : [...faixas, f.id])}
                        className={chip(ativo)}
                      >
                        {f.rotulo}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  “Melhor preço, não levou”: a empresa ofertou menos que a vencedora e mesmo assim perdeu o item (desclassificada, inabilitada ou desistente).
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <label className="flex-1 block">
                  <span className="text-sm font-bold text-slate-700">Buscar por empresa, CNPJ, produto ou órgão</span>
                  <input
                    id="clientes-busca"
                    type="search"
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setMostrar(30);
                    }}
                    placeholder="ex.: papelaria, merenda, Ubá"
                    className={`mt-1 ${campo}`}
                  />
                </label>
                <button
                  type="button"
                  onClick={excel}
                  disabled={!lista.length}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0F2053] hover:bg-[#13306f] text-white text-base font-bold cursor-pointer disabled:opacity-50"
                >
                  <Icon name="sheet" className="w-5 h-5" />
                  Baixar em Excel
                </button>
              </div>
            </div>

            <p role="status" className="mt-5 text-base text-slate-800">
              <strong className="text-[#0F2053]">
                {lista.length} {lista.length === 1 ? 'empresa' : 'empresas'}
              </strong>{' '}
              e {itens} {itens === 1 ? 'item' : 'itens'} com esses filtros. Primeiro vêm as que mais ficaram entre o 2º e o 4º lugar.
            </p>
            {lista.length === 0 && (
              <p className="mt-3 p-4 rounded-xl bg-white border border-slate-200 text-slate-700">
                Nenhuma empresa com esses filtros. Marque mais colocações ou limpe a busca.
              </p>
            )}
            <ul className="mt-4 space-y-3">
              {lista.slice(0, mostrar).map((e) => (
                <CartaoEmpresa key={e.cnpj} e={e} licitacoes={dados.licitacoes} />
              ))}
            </ul>
            {lista.length > mostrar && (
              <button
                type="button"
                onClick={() => setMostrar(mostrar + 30)}
                className="mt-4 px-5 py-3 rounded-xl border-2 border-slate-300 bg-white text-[#0F2053] text-base font-bold hover:border-[#0478CA] cursor-pointer"
              >
                Mostrar mais {Math.min(30, lista.length - mostrar)} de {lista.length - mostrar}
              </button>
            )}

            <div className="mt-8 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 text-[15px] text-slate-700 leading-relaxed space-y-2">
              <h3 className="text-base font-bold text-[#0F2053]">De onde vem a lista e o que fica de fora</h3>
              <p>
                O PNCP só registra a vencedora de cada item. A colocação das outras sai da ata da sessão que o {dados.portal || 'Portal de Compras Públicas'}{' '}
                anexa no PNCP, com todos os lances: {dados.licitacoesLidas ?? 0} atas lidas de {dados.licitacoesNoPeriodo ?? 0} licitações desse portal na Zona
                da Mata desde {dataBR(dados.desde)}
                {dados.aindaNaFila ? ` (${dados.aindaNaFila} ainda na fila; a lista cresce a cada atualização)` : ''}.
              </p>
              <p>
                Licitações feitas no Compras.gov.br, na Licitar Digital e em outros portais não entram, porque eles não publicam a ata com os lances no PNCP. A
                cidade de cada empresa vem do cadastro do CNPJ na Receita Federal. Pessoas físicas (CPF) ficam de fora.
              </p>
              {dados.atualizadoEm && <p>Atualizada em {new Date(dados.atualizadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.</p>}
            </div>
          </>
        )}
      </Container>
    </section>
  );
}
