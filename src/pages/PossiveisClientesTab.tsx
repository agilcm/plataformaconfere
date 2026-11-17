// Aba "Possíveis clientes" das Licitações (aberta a todos): empresas das cidades vizinhas que disputaram licitações da
// Zona da Mata e ficaram do 2º ao 5º lugar (ou ofertaram o melhor preço e não levaram), com a licitação, o item e a
// colocação. Os dados vêm de prospeccao/clientes.json, gerado por scripts/possiveis-clientes.mjs a partir das atas do PNCP.
import { useMemo, useState } from 'react';
import { Container, Icon } from '../components/ui.tsx';
import { cnpjFormatado, diferenca, filtrarClientes, linhasPlanilha, textoColocacao } from '../lib/possiveisClientes.js';
import { baixarXlsx } from '../lib/xlsx.js';
import { blocosDiagnostico, mensagemContato } from '../lib/diagnostico.js';
import { dateText, downloadPdf, slug } from '../lib/pdfReport.ts';
import { COMPANY_PROFILE } from '../data/servicesData.ts';
import {
  AvisoCarregando,
  campo,
  chip,
  LinhaLicitacao,
  listaCidades,
  NotaFonte,
  Periodo,
  useProspeccao,
  valorLance,
  type Licitacao,
  type MetaProspeccao,
} from './prospeccaoUi.tsx';

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
  /** maior desconto: os valores são percentuais */
  desconto?: boolean;
  /** valor total que a vencedora levou no item */
  vt?: number;
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
interface Dados extends MetaProspeccao {
  resumo: { empresas: number; disputas: number; licitacoes: number };
  empresas: Empresa[];
}

const COR: Record<string, string> = {
  0: 'bg-violet-100 text-violet-900',
  2: 'bg-amber-100 text-amber-900',
  3: 'bg-sky-100 text-sky-900',
  4: 'bg-slate-200 text-slate-800',
  5: 'bg-rose-100 text-rose-900',
};
const corDe = (col: number) => COR[col] || 'bg-slate-100 text-slate-700';
// faixas do filtro de colocação
const FAIXAS: { id: string; rotulo: string; cols: number[] }[] = [
  { id: '2', rotulo: '2º lugar', cols: [2] },
  { id: '3', rotulo: '3º lugar', cols: [3] },
  { id: '4', rotulo: '4º lugar', cols: [4] },
  { id: '5', rotulo: '5º lugar', cols: [5] },
  { id: '0', rotulo: 'Melhor preço, não levou', cols: [0] },
];

// contato da Ágil CM no diagnóstico
const CONTATO = { whatsapp: COMPANY_PROFILE.phoneDisplay, email: COMPANY_PROFILE.email, site: 'www.agilcm.com.br/assessoria-licitacoes/' };
const acao =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait';

/**
 * Um cartão por empresa. `e` traz as disputas do filtro atual; `completa`, todas (o diagnóstico usa todas).
 */
function CartaoEmpresa({ e, completa, dados }: { e: Empresa; completa: Empresa; dados: Dados }) {
  const licitacoes = dados.licitacoes;
  const [copiado, setCopiado] = useState('');
  const [gerando, setGerando] = useState(false);
  const avisar = (o: string) => {
    setCopiado(o);
    setTimeout(() => setCopiado(''), 2000);
  };
  const diagnostico = async () => {
    setGerando(true);
    try {
      await downloadPdf(
        `diagnostico-licitacoes-${slug(completa.razao)}.pdf`,
        `Diagnóstico de licitações - ${completa.razao}`,
        blocosDiagnostico(completa, dados, { data: dateText(), contato: CONTATO }) as Parameters<typeof downloadPdf>[2],
      );
    } finally {
      setGerando(false);
    }
  };
  const copiarMensagem = async () => {
    try {
      await navigator.clipboard.writeText(mensagemContato(completa, dados));
      avisar('mensagem');
    } catch {
      /* sem área de transferência */
    }
  };
  const conta = (cols: number[]) => e.disputas.filter((d) => cols.includes(d.col)).length;
  const nLic = new Set(e.disputas.map((d) => d.lic)).size;
  const resumo = [
    [2, '2º'],
    [3, '3º'],
    [4, '4º'],
    [5, '5º'],
    [0, 'melhor preço sem levar'],
  ] as const;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(cnpjFormatado(e.cnpj));
      avisar('cnpj');
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
                    Melhor lance {valorLance(d.melhor, d.desconto)}
                    {d.venc != null && <> · vencedora {valorLance(d.venc, d.desconto)}</>}
                    {dif != null && Math.abs(dif) < 1000 && (
                      <>
                        {' '}
                        ({dif > 0 ? '+' : ''}
                        {dif.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)
                      </>
                    )}{' '}
                    · {d.participantes} empresas {d.lote ? 'no lote' : 'no item'}
                  </p>
                  <LinhaLicitacao lic={lic} />
                </li>
              );
            })}
          </ul>
        </div>
      </details>
      <div className="px-4 sm:px-5 pb-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <button type="button" onClick={diagnostico} disabled={gerando} className={`${acao} bg-[#0F2053] hover:bg-[#13306f] text-white`}>
          <Icon name="doc" className="w-5 h-5" />
          {gerando ? 'Gerando o diagnóstico…' : 'Gerar diagnóstico (PDF)'}
          <span className="sr-only"> de {e.razao}</span>
        </button>
        <button type="button" onClick={copiarMensagem} className={`${acao} border-2 border-slate-200 bg-white text-[#0F2053] hover:border-[#0478CA]`}>
          {copiado === 'mensagem' ? 'Mensagem copiada' : 'Copiar mensagem para o WhatsApp'}
          <span className="sr-only"> para {e.razao}</span>
        </button>
        <button type="button" onClick={copiar} className="px-2 py-2.5 text-sm font-bold text-[#0369B3] underline underline-offset-4 cursor-pointer">
          {copiado === 'cnpj' ? 'CNPJ copiado' : 'Copiar o CNPJ'}
        </button>
        <span role="status" className="sr-only">
          {copiado === 'mensagem' ? 'Mensagem copiada' : copiado === 'cnpj' ? 'CNPJ copiado' : ''}
        </span>
      </div>
    </li>
  );
}

export default function PossiveisClientesTab() {
  const { dados, estado } = useProspeccao<Dados>('clientes');
  const [cidade, setCidade] = useState('');
  const [faixas, setFaixas] = useState<string[]>(FAIXAS.map((f) => f.id));
  const [q, setQ] = useState('');
  const [mostrar, setMostrar] = useState(30);

  const colocacoes = useMemo(() => FAIXAS.filter((f) => faixas.includes(f.id)).flatMap((f) => f.cols), [faixas]);
  const lista = useMemo(() => (dados ? (filtrarClientes(dados, { cidade, colocacoes, q }) as Empresa[]) : []), [dados, cidade, colocacoes, q]);
  const itens = lista.reduce((s, e) => s + e.disputas.length, 0);
  const porCnpj = useMemo(() => new Map((dados?.empresas || []).map((x) => [x.cnpj, x])), [dados]);
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

  return (
    <section aria-labelledby="titulo-clientes" className="bg-[#F4F7FB] py-8 sm:py-10">
      <Container>
        <h2 id="titulo-clientes" className="text-2xl sm:text-3xl font-bold font-display text-[#0F2053] tracking-tight">
          Possíveis clientes
        </h2>
        <p className="mt-2 max-w-4xl text-base sm:text-lg text-slate-700 leading-relaxed">
          Empresas de {dados ? listaCidades(dados.cidades) : 'cidades vizinhas'} que disputaram licitações da Zona da Mata e ficaram do 2º ao 5º lugar. Quem
          chega perto já participa, mas perde: é para essas empresas que a assessoria em licitações faz diferença.
        </p>

        <AvisoCarregando estado={estado} />

        {estado === 'ok' && dados && (
          <>
            <Periodo dados={dados} />
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
              e {itens} {itens === 1 ? 'item' : 'itens'} com esses filtros. Primeiro vêm as que mais ficaram entre o 2º e o 5º lugar.
            </p>
            {lista.length === 0 && (
              <p className="mt-3 p-4 rounded-xl bg-white border border-slate-200 text-slate-700">
                Nenhuma empresa com esses filtros. Marque mais colocações ou limpe a busca.
              </p>
            )}
            <ul className="mt-4 space-y-3">
              {lista.slice(0, mostrar).map((e) => (
                <CartaoEmpresa key={e.cnpj} e={e} completa={porCnpj.get(e.cnpj) || e} dados={dados} />
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

            <NotaFonte dados={dados} />
          </>
        )}
      </Container>
    </section>
  );
}
