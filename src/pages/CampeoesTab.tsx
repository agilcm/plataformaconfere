// Aba "Campeões" das Licitações: quem ganhou e levou cada item nas licitações da Zona da Mata, de qualquer cidade, com o
// valor ganho segundo a ata. Os dados vêm de prospeccao/campeoes.json, gerado por scripts/possiveis-clientes.mjs.
import { useMemo, useState } from 'react';
import { Container, Icon } from '../components/ui.tsx';
import { cnpjFormatado, filtrarCampeoes, linhasPlanilhaCampeoes } from '../lib/possiveisClientes.js';
import { baixarXlsx } from '../lib/xlsx.js';
import {
  AvisoCarregando,
  brl,
  campo,
  chip,
  LinhaLicitacao,
  listaCidades,
  valorLance,
  NotaFonte,
  Periodo,
  useProspeccao,
  type MetaProspeccao,
} from './prospeccaoUi.tsx';

interface Vitoria {
  lic: number;
  item: string;
  desc: string;
  valor: number;
  total: number | null;
  participantes: number;
  lote?: boolean;
  /** maior desconto: o valor é percentual */
  desconto?: boolean;
}
interface Campeao {
  cnpj: string;
  razao: string;
  fantasia: string;
  cidade: string;
  uf: string;
  /** é de uma das cidades escolhidas */
  alvo: boolean;
  porte: string;
  atividade: string;
  situacao: string;
  total: number;
  vitorias: Vitoria[];
}
interface Dados extends MetaProspeccao {
  resumo: { empresas: number; itens: number; licitacoes: number };
  empresas: Campeao[];
}

const brlInteiro = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function CartaoCampeao({ e, posicao, licitacoes }: { e: Campeao; posicao: number; licitacoes: Dados['licitacoes'] }) {
  const nLic = new Set(e.vitorias.map((v) => v.lic)).size;
  const orgaos = new Set(e.vitorias.map((v) => licitacoes[v.lic].orgao)).size;
  const sozinho = e.vitorias.filter((v) => v.participantes === 1).length;
  return (
    <li className="rounded-2xl bg-white border border-slate-200">
      <details className="group">
        <summary className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 sm:p-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden="true"
            className={`hidden sm:flex shrink-0 w-11 h-11 rounded-xl items-center justify-center font-display font-bold text-lg ${
              posicao <= 3 ? 'bg-[#F5A623] text-[#0F2053]' : 'bg-[#EAF4FC] text-[#0F2053]'
            }`}
          >
            {posicao}º
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-lg font-bold font-display text-[#0F2053] leading-snug">
              <span className="sm:hidden">{posicao}º · </span>
              {e.razao}
            </span>
            <span className="block mt-0.5 text-[15px] text-slate-700">
              {e.cidade ? `${e.cidade} - ${e.uf}` : 'Cidade não informada'} · CNPJ {cnpjFormatado(e.cnpj)}
              {e.fantasia && e.fantasia !== e.razao ? ` · ${e.fantasia}` : ''}
            </span>
            <span className="block mt-0.5 text-sm text-slate-600">
              {[e.porte && e.porte.toLowerCase().replace(/^./, (c) => c.toUpperCase()), e.atividade].filter(Boolean).join(' · ')}
            </span>
            <span className="mt-2 flex flex-wrap gap-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-emerald-100 text-emerald-900">
                {e.vitorias.length} {e.vitorias.length === 1 ? 'item ganho' : 'itens ganhos'}
              </span>
              {e.total > 0 && <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-[#EAF4FC] text-[#0F2053]">{brlInteiro(e.total)} levados</span>}
              <span className="px-2.5 py-0.5 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {orgaos} {orgaos === 1 ? 'órgão' : 'órgãos'}
              </span>
              {sozinho > 0 && <span className="px-2.5 py-0.5 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">{sozinho} sem concorrente</span>}
              {e.alvo && <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-amber-100 text-amber-900">cidade escolhida</span>}
            </span>
          </span>
          <span className="shrink-0 inline-flex items-center gap-1.5 text-[15px] font-bold text-[#0369B3]">
            em {nLic} {nLic === 1 ? 'licitação' : 'licitações'}
            <Icon name="arrow" className="w-4 h-4 transition-transform group-open:rotate-90" />
          </span>
        </summary>
        <ul className="px-4 sm:px-5 pb-5 space-y-2.5">
          {e.vitorias.map((v, i) => (
            <li key={i} className="p-3 sm:p-4 rounded-xl bg-[#F7FAFD] border border-slate-200 text-[15px] leading-relaxed">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <strong className="text-[#0F2053]">
                  {v.lote ? 'Lote' : 'Item'} {Number(v.item) || v.item}:
                </strong>
                <span className="text-slate-800">{v.desc}</span>
              </p>
              <p className="mt-1 text-slate-700">
                {v.desconto ? 'Venceu com' : 'Valor vencedor'} {valorLance(v.valor, v.desconto)}
                {v.total != null && !v.lote && <> · total {brl(v.total)}</>} ·{' '}
                {v.participantes === 1 ? 'sem concorrente' : `${v.participantes} empresas ${v.lote ? 'no lote' : 'no item'}`}
              </p>
              <LinhaLicitacao lic={licitacoes[v.lic]} />
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

export default function CampeoesTab() {
  const { dados, estado } = useProspeccao<Dados>('campeoes');
  const [cidade, setCidade] = useState('');
  const [q, setQ] = useState('');
  const [mostrar, setMostrar] = useState(30);

  const lista = useMemo(() => (dados ? (filtrarCampeoes(dados, { cidade, q }) as Campeao[]) : []), [dados, cidade, q]);
  // a posição no ranking é a do filtro atual
  const ordenada = useMemo(
    () => [...lista].sort((a, b) => b.vitorias.length - a.vitorias.length || b.total - a.total || a.razao.localeCompare(b.razao, 'pt-BR')),
    [lista],
  );
  const itens = lista.reduce((s, e) => s + e.vitorias.length, 0);
  const total = lista.reduce((s, e) => s + e.total, 0);
  const porCidade = useMemo(() => {
    const m: Record<string, number> = {};
    if (dados) for (const e of filtrarCampeoes(dados, { q }) as Campeao[]) if (e.alvo) m[e.cidade] = (m[e.cidade] || 0) + 1;
    return m;
  }, [dados, q]);
  const nAlvo = Object.values(porCidade).reduce((s, n) => s + n, 0);

  const excel = () => {
    if (!dados) return;
    const linhas = linhasPlanilhaCampeoes(dados, ordenada) as Record<string, string | number>[];
    if (!linhas.length) return;
    const titulos = Object.keys(linhas[0]);
    const moeda = new Set(['Valor vencedor', 'Valor total ganho']);
    const numero = new Set(['Empresas no item']);
    const larga = new Set(['Empresa', 'Descrição do item', 'Órgão', 'Objeto', 'Atividade principal', 'Link no PNCP']);
    baixarXlsx(`campeoes-licitacoes-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        nome: 'Campeões',
        colunas: titulos.map((t) => ({ titulo: t, largura: larga.has(t) ? 44 : 20, tipo: moeda.has(t) ? 'moeda' : numero.has(t) ? 'numero' : 'texto' })),
        linhas: linhas.map((l) => titulos.map((t) => l[t])),
      },
    ]);
  };

  return (
    <section aria-labelledby="titulo-campeoes" className="bg-[#F4F7FB] py-8 sm:py-10">
      <Container>
        <h2 id="titulo-campeoes" className="text-2xl sm:text-3xl font-bold font-display text-[#0F2053] tracking-tight">
          Campeões
        </h2>
        <p className="mt-2 max-w-4xl text-base sm:text-lg text-slate-700 leading-relaxed">
          Quem ganhou e levou cada item nas licitações da Zona da Mata: as empresas que mais vencem, de onde são, para quais órgãos vendem e quanto levaram.
        </p>

        <AvisoCarregando estado={estado} />

        {estado === 'ok' && dados && (
          <>
            <Periodo dados={dados} />
            <ul className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                [String(dados.resumo.empresas), dados.resumo.empresas === 1 ? 'empresa vencedora' : 'empresas vencedoras'],
                [String(dados.resumo.itens), 'itens ganhos'],
                [String(dados.resumo.licitacoes), 'licitações'],
                [String(nAlvo), `de ${listaCidades(dados.cidades)}`],
              ].map(([valor, rotulo]) => (
                <li key={rotulo} className="p-4 rounded-2xl bg-white border border-slate-200">
                  <strong className="block text-2xl sm:text-3xl font-bold font-display text-[#0F2053] tabular-nums">{valor}</strong>
                  <span className="block text-sm sm:text-[15px] text-slate-700">{rotulo}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
              <div>
                <p id="rotulo-cidade-campeoes" className="text-sm font-bold text-slate-700">
                  Cidade da empresa
                </p>
                <div role="group" aria-labelledby="rotulo-cidade-campeoes" className="mt-2 flex flex-wrap gap-2">
                  <button type="button" aria-pressed={!cidade} onClick={() => setCidade('')} className={chip(!cidade)}>
                    Todas as cidades
                  </button>
                  <button type="button" aria-pressed={cidade === '*'} onClick={() => setCidade(cidade === '*' ? '' : '*')} className={chip(cidade === '*')}>
                    Só as {dados.cidades.length} cidades escolhidas <span className="tabular-nums opacity-80">({nAlvo})</span>
                  </button>
                  {dados.cidades.map((c) => (
                    <button key={c} type="button" aria-pressed={cidade === c} onClick={() => setCidade(cidade === c ? '' : c)} className={chip(cidade === c)}>
                      {c} <span className="tabular-nums opacity-80">({porCidade[c] || 0})</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <label className="flex-1 block">
                  <span className="text-sm font-bold text-slate-700">Buscar por empresa, CNPJ, cidade, produto ou órgão</span>
                  <input
                    id="campeoes-busca"
                    type="search"
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setMostrar(30);
                    }}
                    placeholder="ex.: merenda, informática, Ubá"
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
              com {itens} {itens === 1 ? 'item ganho' : 'itens ganhos'}
              {total > 0 && <> ({brlInteiro(total)})</>}. Em primeiro, quem ganhou mais itens.
            </p>
            {lista.length === 0 && (
              <p className="mt-3 p-4 rounded-xl bg-white border border-slate-200 text-slate-700">
                Nenhuma empresa com esses filtros. Escolha outra cidade ou limpe a busca.
              </p>
            )}
            <ol className="mt-4 space-y-3">
              {ordenada.slice(0, mostrar).map((e, i) => (
                <CartaoCampeao key={e.cnpj} e={e} posicao={i + 1} licitacoes={dados.licitacoes} />
              ))}
            </ol>
            {ordenada.length > mostrar && (
              <button
                type="button"
                onClick={() => setMostrar(mostrar + 30)}
                className="mt-4 px-5 py-3 rounded-xl border-2 border-slate-300 bg-white text-[#0F2053] text-base font-bold hover:border-[#0478CA] cursor-pointer"
              >
                Mostrar mais {Math.min(30, ordenada.length - mostrar)} de {ordenada.length - mostrar}
              </button>
            )}

            <NotaFonte dados={dados} campeoes />
          </>
        )}
      </Container>
    </section>
  );
}
