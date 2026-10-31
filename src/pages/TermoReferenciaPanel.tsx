// Contratos › Termo de referência: importa a planilha do termo (Excel ou CSV) e, para cada item,
// mostra onde o produto foi ganho em Minas Gerais, por quanto, quem venceu e a marca.
import { useRef, useState } from 'react';
import { Icon } from '../components/ui.tsx';
import { formatBRL } from '../data/servicesData.ts';
import { dateText, downloadPdf, slug } from '../lib/pdfReport.ts';
import { lerPlanilha } from '../lib/planilhaLeitura.js';
import { abasExcelTermo, blocosPdfTermo, detectarColunas, itensDoTermo, pesquisarTermo, totaisTermo } from '../lib/termoReferencia.js';
import { baixarXlsx } from '../lib/xlsx.js';

type Campo = 'numero' | 'produto' | 'especificacao' | 'unidade' | 'quantidade' | 'valor';
interface Mapa {
  linha: number;
  cols: Partial<Record<Campo, number>>;
}
interface ItemTermo {
  numero: string;
  produto: string;
  descricao: string;
  unidade: string;
  quantidade: number | null;
  valorTermo: number | null;
}
interface Ocorrencia {
  orgao: string;
  municipio: string;
  link: string;
  itemNumero: number;
  descricao: string;
  unidade: string;
  quantidade: number | null;
  valorEstimado: number | null;
  valorUnitario: number;
  fornecedor: string;
  fornecedorDoc: string;
  data: string;
  marca: string;
  aderencia: number;
  suspeito?: boolean;
  criterio?: string;
}
interface ItemResultado extends ItemTermo {
  palavrasChave: string;
  ocorrencias: Ocorrencia[];
  melhor: Ocorrencia | null;
  diferenca: number | null;
}

const ROTULOS: [Campo, string, boolean][] = [
  ['numero', 'Nº do item', false],
  ['produto', 'Produto / descrição', true],
  ['especificacao', 'Especificação (se separada)', false],
  ['unidade', 'Unidade', false],
  ['quantidade', 'Quantidade', false],
  ['valor', 'Valor unitário', false],
];

const dataBR = (s?: string) => (s ? s.split('-').reverse().join('/') : '');
const pct = (v: number, casas = 0) => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
const brl = (v: number | null | undefined) => (v == null ? '—' : formatBRL(v, 2));

function baixarModelo() {
  baixarXlsx('modelo-termo-de-referencia.xlsx', [
    {
      nome: 'Termo de referência',
      colunas: [
        { titulo: 'Item', largura: 7, tipo: 'numero' },
        { titulo: 'Produto', largura: 24 },
        { titulo: 'Especificação', largura: 60 },
        { titulo: 'Unidade', largura: 10 },
        { titulo: 'Quantidade', largura: 12, tipo: 'numero' },
        { titulo: 'Valor unitário', largura: 15, tipo: 'moeda' },
      ],
      linhas: [
        [1, 'Arroz', 'Arroz polido longo fino tipo 1, pacote de 5 kg', 'Pacote', 100, 24.9],
        [2, 'Feijão carioca', 'Feijão carioca tipo 1, pacote de 1 kg', 'Pacote', 200, 8.5],
        [3, 'Óleo de soja', 'Óleo de soja refinado, 900 ml', 'Unidade', 80, 7.2],
      ],
    },
  ] as never);
}

export default function TermoReferenciaPanel() {
  const [arquivo, setArquivo] = useState('');
  const [linhas, setLinhas] = useState<any[][]>([]);
  const [mapa, setMapa] = useState<Mapa | null>(null);
  const [erroArq, setErroArq] = useState('');
  const [meses, setMeses] = useState(6);
  const [interior, setInterior] = useState(true);
  const [profunda, setProfunda] = useState(false);
  const [progresso, setProgresso] = useState<{
    fase: string;
    feito: number;
    total: number;
  } | null>(null);
  const [resultado, setResultado] = useState<{
    itens: ItemResultado[];
    comprasLidas: number;
    comprasComErro: number;
  } | null>(null);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'achados' | 'faltando'>('todos');
  const parar = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const itens: ItemTermo[] = mapa ? (itensDoTermo(linhas, mapa as never) as ItemTermo[]) : [];
  const cabecalho = mapa && mapa.linha >= 0 ? linhas[mapa.linha] : (linhas[0] || []).map((_, i) => `Coluna ${String.fromCharCode(65 + i)}`);
  const pesquisando = !!progresso;

  const abrir = async (f: File | undefined) => {
    if (!f) return;
    setErroArq('');
    setResultado(null);
    try {
      const l = (await lerPlanilha(await f.arrayBuffer(), f.name)) as any[][];
      if (!l.length) throw new Error('A planilha está vazia');
      setLinhas(l);
      setMapa(detectarColunas(l) as Mapa);
      setArquivo(f.name);
    } catch (e) {
      setArquivo('');
      setLinhas([]);
      setMapa(null);
      setErroArq((e as Error).message || 'Não consegui ler o arquivo');
    }
  };

  const pesquisar = async () => {
    parar.current = false;
    setErro('');
    setResultado(null);
    setProgresso({ fase: 'Começando', feito: 0, total: itens.length });
    try {
      const r = await pesquisarTermo(itens, {
        meses,
        interior,
        editaisPorItem: profunda ? 25 : 10,
        paginas: profunda ? 4 : 2,
        onProgresso: setProgresso,
        cancelado: () => parar.current,
      });
      setResultado(r as never);
    } catch {
      setErro('O PNCP não respondeu. Ele costuma voltar em poucos minutos; tente de novo.');
    } finally {
      setProgresso(null);
    }
  };

  const nomeBase = `precos-${slug(arquivo.replace(/\.[^.]+$/, '') || 'termo')}`;
  const exportarExcel = () => resultado && baixarXlsx(`${nomeBase}.xlsx`, abasExcelTermo(resultado.itens, { meses, interior }) as never);
  const exportarPdf = () =>
    resultado &&
    downloadPdf(
      `${nomeBase}.pdf`,
      'Pesquisa de preços',
      blocosPdfTermo(resultado.itens, {
        meses,
        interior,
        nomeArquivo: arquivo,
        dataText: dateText(),
      }) as never,
    );

  const tot = resultado ? totaisTermo(resultado.itens) : null;
  const lista = resultado ? resultado.itens.filter((i) => (filtro === 'achados' ? i.melhor : filtro === 'faltando' ? !i.melhor : true)) : [];

  return (
    <div className="space-y-6">
      <div className="p-4 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <p className="text-lg font-bold text-[#0F2053]">Importe o termo de referência</p>
        <p className="mt-1 text-[15px] text-slate-600">
          Planilha em Excel (.xlsx) ou CSV com o produto, a especificação e o valor unitário. Para cada item, buscamos onde ele foi ganho em Minas Gerais, por
          quanto, quem venceu e a marca, e escolhemos o menor preço que encaixa na especificação.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0478CA] hover:bg-[#03609F] text-white font-bold cursor-pointer"
          >
            <Icon name="sheet" className="w-5 h-5" /> {arquivo ? 'Trocar arquivo' : 'Escolher arquivo'}
          </button>
          <button
            type="button"
            onClick={baixarModelo}
            className="px-5 py-3 rounded-xl border-2 border-slate-200 hover:border-[#0478CA] text-[#0F2053] font-bold cursor-pointer"
          >
            Baixar modelo de planilha
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="hidden"
            onChange={(e) => {
              abrir(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        {erroArq && <p className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-[15px]">{erroArq}</p>}

        {mapa && (
          <>
            <p className="mt-5 text-[15px] text-slate-700">
              <strong>{arquivo}</strong>: {itens.length} {itens.length === 1 ? 'item encontrado' : 'itens encontrados'}. Confira as colunas:
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ROTULOS.map(([k, rotulo, obrigatorio]) => (
                <label key={k} className="block">
                  <span className="block text-sm font-semibold text-slate-700 mb-1">{rotulo}</span>
                  <select
                    value={mapa.cols[k] ?? ''}
                    onChange={(e) => {
                      const cols = { ...mapa.cols };
                      if (e.target.value === '') delete cols[k];
                      else cols[k] = Number(e.target.value);
                      setMapa({ ...mapa, cols });
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-[15px]"
                  >
                    {!obrigatorio && <option value="">— não tem —</option>}
                    {cabecalho.map((h: any, i: number) => (
                      <option key={i} value={i}>
                        {String(h || `Coluna ${String.fromCharCode(65 + i)}`).slice(0, 50)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {itens.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="py-2 pr-3 font-semibold">Item</th>
                      <th className="py-2 pr-3 font-semibold">Descrição</th>
                      <th className="py-2 pr-3 font-semibold">Unid.</th>
                      <th className="py-2 pr-3 font-semibold text-right">Qtd.</th>
                      <th className="py-2 pr-3 font-semibold text-right">Valor unitário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.slice(0, 5).map((i, k) => (
                      <tr key={k} className="border-b border-slate-100">
                        <td className="py-2 pr-3">{i.numero}</td>
                        <td className="py-2 pr-3 line-clamp-2">{i.descricao}</td>
                        <td className="py-2 pr-3">{i.unidade}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{i.quantidade?.toLocaleString('pt-BR') ?? ''}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{brl(i.valorTermo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {itens.length > 5 && <p className="mt-1 text-sm text-slate-500">… e mais {itens.length - 5} itens.</p>}
              </div>
            )}

            <div className="mt-5 pt-5 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center gap-4">
              <div role="group" aria-label="Período" className="grid grid-cols-3 p-1 rounded-xl bg-slate-100 shrink-0">
                {[3, 6, 12].map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={meses === m}
                    onClick={() => setMeses(m)}
                    className={`px-4 py-2 rounded-lg text-[15px] font-bold cursor-pointer ${meses === m ? 'bg-[#0478CA] text-white shadow-sm' : 'text-slate-700'}`}
                  >
                    {m} meses
                  </button>
                ))}
              </div>
              <label className="inline-flex items-center gap-2.5 text-[15px] font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={interior} onChange={(e) => setInterior(e.target.checked)} className="w-5 h-5 accent-[#0478CA]" />
                Só interior de MG (sem Belo Horizonte)
              </label>
              <label className="inline-flex items-center gap-2.5 text-[15px] font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={profunda} onChange={(e) => setProfunda(e.target.checked)} className="w-5 h-5 accent-[#0478CA]" />
                Pesquisa completa (mais editais, mais lenta)
              </label>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={!itens.length || pesquisando}
                onClick={pesquisar}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#0E7A40] hover:bg-[#0B6535] disabled:opacity-50 text-white text-base font-bold cursor-pointer"
              >
                <Icon name="search" className="w-5 h-5" /> Pesquisar preços ganhos de {itens.length} {itens.length === 1 ? 'item' : 'itens'}
              </button>
              {pesquisando && (
                <button
                  type="button"
                  onClick={() => (parar.current = true)}
                  className="px-5 py-3 rounded-xl border-2 border-slate-200 hover:border-red-400 text-slate-700 font-bold cursor-pointer"
                >
                  Parar
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {progresso && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200" role="status" aria-live="polite">
          <p className="font-semibold text-[#0F2053]">
            {progresso.fase}… {progresso.total ? `${progresso.feito} de ${progresso.total}` : ''}
          </p>
          <div className="mt-3 h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-[#0478CA] transition-all"
              style={{
                width: `${progresso.total ? (100 * progresso.feito) / progresso.total : 5}%`,
              }}
            />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Uma compra lida serve para todos os itens do termo que aparecem nela. Termos grandes levam alguns minutos.
          </p>
        </div>
      )}
      {erro && <p className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">{erro}</p>}

      {resultado && tot && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['Itens com preço encontrado', `${tot.encontrados} de ${tot.total}`],
              ['Pregões lidos', String(resultado.comprasLidas)],
              ['Termo (itens comparados × qtd.)', tot.comparados ? formatBRL(tot.termo, 2) : '—'],
              [
                'Pelos menores preços ganhos',
                tot.comparados ? `${formatBRL(tot.ganho, 2)} (${tot.ganho >= tot.termo ? '+' : ''}${pct(tot.termo ? tot.ganho / tot.termo - 1 : 0, 1)})` : '—',
              ],
            ].map(([k, v]) => (
              <div key={k} className="p-4 rounded-2xl bg-white border border-slate-200">
                <p className="text-sm text-slate-500">{k}</p>
                <p className="mt-1 text-lg font-bold text-[#0F2053] tabular-nums">{v}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div role="group" aria-label="Mostrar" className="flex p-1 rounded-xl bg-slate-100 mr-auto">
              {(
                [
                  ['todos', 'Todos'],
                  ['achados', 'Com preço'],
                  ['faltando', 'Sem preço'],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={filtro === v}
                  onClick={() => setFiltro(v)}
                  className={`px-3.5 py-2 rounded-lg text-sm font-bold cursor-pointer ${filtro === v ? 'bg-white text-[#0F2053] shadow-sm' : 'text-slate-600'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={exportarExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D6F42] hover:bg-[#185C37] text-white font-bold cursor-pointer"
            >
              <Icon name="sheet" className="w-5 h-5" /> Exportar Excel
            </button>
            <button
              type="button"
              onClick={exportarPdf}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F2053] hover:bg-[#0478CA] text-white font-bold cursor-pointer"
            >
              <Icon name="doc" className="w-5 h-5" /> Baixar PDF
            </button>
          </div>

          <ol className="space-y-3">
            {lista.map((i) => {
              const m = i.melhor;
              const k = `${i.numero}|${i.descricao}`;
              return (
                <li key={k} className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200">
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-500">
                        Item {i.numero}
                        {i.unidade ? ` · ${i.unidade}` : ''}
                        {i.quantidade ? ` · ${i.quantidade.toLocaleString('pt-BR')}` : ''} · termo: {brl(i.valorTermo)}
                      </p>
                      <p className="mt-1 text-[15px] text-slate-800 line-clamp-3">{i.descricao}</p>
                      {m ? (
                        <div className="mt-3 text-[15px] text-slate-700 space-y-0.5">
                          <p>
                            <strong className="text-[#0F2053]">{m.municipio}</strong> · {m.orgao} · {dataBR(m.data)}
                          </p>
                          <p>
                            Vencedor: <strong>{m.fornecedor}</strong> · Marca: <strong>{m.marca || 'não informada no PNCP'}</strong>
                          </p>
                          <p className="text-sm text-slate-500 line-clamp-2">Item ganho: {m.descricao}</p>
                        </div>
                      ) : (
                        <p className="mt-3 text-[15px] text-amber-800">
                          Nenhum preço ganho encontrado nos últimos {meses} meses
                          {i.palavrasChave ? ` para “${i.palavrasChave}”` : ''}. Tente a pesquisa completa ou 12 meses.
                        </p>
                      )}
                    </div>
                    {m && (
                      <div className="lg:w-56 shrink-0 p-4 rounded-xl bg-[#F7FAFD] border border-slate-200">
                        <p className="text-sm text-slate-500">Menor preço ganho</p>
                        <p className="text-2xl font-bold text-[#0E7A40] tabular-nums">{brl(m.valorUnitario)}</p>
                        {i.diferenca != null && (
                          <p className={`text-sm font-semibold ${i.diferenca > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                            {i.diferenca > 0 ? '+' : ''}
                            {pct(i.diferenca, 1)} em relação ao termo
                          </p>
                        )}
                        <p className="mt-1 text-sm text-slate-500">
                          {m.unidade ? `Unidade: ${m.unidade} · ` : ''}aderência {pct(m.aderencia)}
                        </p>
                        <p className={`mt-1 text-sm ${/confira|nenhum/.test(m.criterio || '') ? 'text-amber-800 font-semibold' : 'text-slate-500'}`}>
                          {m.criterio}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m && (
                      <a
                        href={m.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0478CA] hover:bg-[#03609F] text-white text-sm font-bold"
                      >
                        Ver o pregão no PNCP <Icon name="arrow" className="w-4 h-4" />
                      </a>
                    )}
                    {i.ocorrencias.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAberto(aberto === k ? null : k)}
                        className="px-3.5 py-2 rounded-xl border-2 border-slate-200 hover:border-[#0478CA] text-[#0F2053] text-sm font-bold cursor-pointer"
                      >
                        {aberto === k ? 'Esconder' : `Ver todos os ${i.ocorrencias.length} preços encontrados`}
                      </button>
                    )}
                  </div>
                  {aberto === k && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[56rem] text-sm">
                        <thead>
                          <tr className="text-left text-slate-500 border-b border-slate-200">
                            {['Preço', 'Município · órgão', 'Data', 'Fornecedor', 'Marca', 'Item ganho', 'Aderência', ''].map((h) => (
                              <th key={h} className="py-2 pr-3 font-semibold whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {i.ocorrencias.map((o, n) => (
                            <tr key={n} className={`border-b border-slate-100 align-top ${o.suspeito ? 'text-slate-400' : ''}`}>
                              <td className="py-2 pr-3 font-bold tabular-nums whitespace-nowrap">
                                {brl(o.valorUnitario)}
                                {o.suspeito && <span className="block text-xs font-semibold text-amber-700">fora da curva</span>}
                              </td>
                              <td className="py-2 pr-3">
                                {o.municipio}
                                <span className="block text-slate-500">{o.orgao}</span>
                              </td>
                              <td className="py-2 pr-3 whitespace-nowrap">{dataBR(o.data)}</td>
                              <td className="py-2 pr-3">{o.fornecedor}</td>
                              <td className="py-2 pr-3">{o.marca || '—'}</td>
                              <td className="py-2 pr-3 max-w-md">
                                <span className="line-clamp-3">{o.descricao}</span>
                                {o.unidade && <span className="text-slate-500">Unidade: {o.unidade}</span>}
                              </td>
                              <td className="py-2 pr-3 tabular-nums">{pct(o.aderencia)}</td>
                              <td className="py-2 pr-3">
                                <a href={o.link} target="_blank" rel="noopener noreferrer" className="text-[#0478CA] font-bold underline whitespace-nowrap">
                                  PNCP
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="text-sm text-slate-500">
            Fonte: PNCP, valores unitários homologados de pregões e dispensas de Minas Gerais{interior ? ' (sem Belo Horizonte)' : ''} nos últimos {meses}{' '}
            meses. O PNCP não publica a marca do vencedor: ela aparece quando o órgão a escreveu na descrição do item; nos demais casos, está na ata, no link do
            pregão. Preços muito abaixo dos demais (menos de 35% da mediana) ficam fora da escolha.
          </p>
        </>
      )}
    </div>
  );
}
