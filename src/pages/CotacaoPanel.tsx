// Privado › Cotação: importa o termo de referência, procura cada item nas planilhas de custo do Drive
// (link de referência, marca e valor de compra), pergunta se quer buscar em contratos (PNCP) e gera a
// planilha de custos no molde da Ágil, como Planilha Google, na pasta "cloud".
import { useMemo, useRef, useState } from 'react';
import { Icon } from '../components/ui.tsx';
import { PASTA_COTACOES_NOME } from '../data/privadoConfig.ts';
import { lerPlanilha } from '../lib/planilhaLeitura.js';
import { buscarNaBase, indexar } from '../lib/privado/baseCustos.js';
import { carregarBase, type Cotacao } from '../lib/privado/cotacao.ts';
import { enviarComoPlanilhaGoogle, pastaFilha } from '../lib/privado/drive.ts';
import { criarPlanilhaCustos, nomePlanilha } from '../lib/privado/planilhaCustos.js';
import { detectarColunas, itensDoTermo, pesquisarTermo } from '../lib/termoReferencia.js';

interface ItemTermo {
  numero: string;
  produto: string;
  especificacao: string;
  descricao: string;
  unidade: string;
  quantidade: number | null;
  valorTermo: number | null;
}
type Achado = Cotacao & { aderencia: number; criterio?: string };
interface Busca {
  melhor: Achado | null;
  confiavel: boolean;
  alternativas: Achado[];
}
interface Contrato {
  valorUnitario: number;
  municipio: string;
  orgao: string;
  data: string;
  fornecedor: string;
  link: string;
}

const moeda = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const pct = (v: number) => `${Math.round(v * 100)}%`;
const botao = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold cursor-pointer disabled:opacity-50';
const card = 'p-5 sm:p-6 rounded-2xl bg-white border border-slate-200';
const chave = (c: Cotacao) => `${c.arquivoId || c.arquivo}#${c.aba}#${c.linha}`;
const hoje = () => new Date().toISOString().slice(0, 10);

export default function CotacaoPanel({ pastaId, conectado }: { pastaId: string; conectado: boolean }) {
  const [arquivo, setArquivo] = useState('');
  const [itens, setItens] = useState<ItemTermo[]>([]);
  const [erro, setErro] = useState('');
  const [prog, setProg] = useState<{ etapa: string; feito?: number; total?: number } | null>(null);
  const [base, setBase] = useState<{ total: number; planilhas: number; comErro: string[] } | null>(null);
  const [buscas, setBuscas] = useState<Busca[] | null>(null);
  const [escolhas, setEscolhas] = useState<(Achado | null)[]>([]);
  const [etapaContratos, setEtapaContratos] = useState<'pergunta' | 'buscando' | 'feito' | 'pulado'>('pergunta');
  const [contratos, setContratos] = useState<(Contrato | null)[]>([]);
  const [form, setForm] = useState({ orgao: '', processo: '', data: hoje() });
  const [criado, setCriado] = useState<{ nome: string; link: string } | null>(null);
  const parar = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const progresso = (etapa: string, feito?: number, total?: number) => setProg({ etapa, feito, total });

  const reiniciar = () => {
    setBuscas(null);
    setEscolhas([]);
    setEtapaContratos('pergunta');
    setContratos([]);
    setCriado(null);
  };

  const abrir = async (f?: File) => {
    if (!f) return;
    setErro('');
    reiniciar();
    try {
      const linhas = (await lerPlanilha(await f.arrayBuffer(), f.name)) as any[][];
      const lidos = itensDoTermo(linhas, detectarColunas(linhas) as never) as ItemTermo[];
      if (!lidos.length) throw new Error('Não encontrei itens nessa planilha. Confira se ela tem a coluna de descrição.');
      setItens(lidos);
      setArquivo(f.name);
    } catch (e) {
      setItens([]);
      setArquivo('');
      setErro((e as Error).message || 'Não consegui ler o arquivo');
    }
  };

  const buscarNasPlanilhas = async () => {
    setErro('');
    reiniciar();
    try {
      const b = await carregarBase(pastaId, progresso);
      setBase({ total: b.itens.length, planilhas: b.planilhas, comErro: b.comErro });
      progresso('Procurando os itens do termo');
      const idx = indexar(b.itens);
      const r = itens.map((it) => buscarNaBase(it, idx) as Busca);
      setBuscas(r);
      setEscolhas(r.map((x) => (x.confiavel ? x.melhor : null)));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setProg(null);
    }
  };

  const buscarContratos = async () => {
    parar.current = false;
    setEtapaContratos('buscando');
    try {
      const r = await pesquisarTermo(itens, {
        meses: 6,
        interior: true,
        onProgresso: (p: any) => progresso(p.fase, p.feito, p.total),
        cancelado: () => parar.current,
      });
      setContratos(r.itens.map((i: any) => (i.melhor ? (i.melhor as Contrato) : null)));
      setEtapaContratos('feito');
    } catch {
      setErro('O PNCP não respondeu. Você pode tentar de novo ou seguir sem a busca em contratos.');
      setEtapaContratos('pergunta');
    } finally {
      setProg(null);
    }
  };

  const linhasPlanilha = () =>
    itens.map((it, i) => ({
      ...it,
      base: escolhas[i] || null,
      contrato: contratos[i] || null,
    }));

  const gerar = async () => {
    setErro('');
    const nome = nomePlanilha(form);
    try {
      progresso(`Criando a pasta "${PASTA_COTACOES_NOME}"`);
      const pasta = await pastaFilha(PASTA_COTACOES_NOME, pastaId);
      progresso('Gerando a planilha no Google Drive');
      const bytes = criarPlanilhaCustos({ ...form, itens: linhasPlanilha(), comContratos: etapaContratos === 'feito' }) as Uint8Array;
      const f = await enviarComoPlanilhaGoogle({ nome, pai: pasta.id, bytes });
      setCriado({ nome, link: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}/edit` });
    } catch (e) {
      setErro(`Não consegui criar a planilha no Drive: ${(e as Error).message}`);
    } finally {
      setProg(null);
    }
  };

  const baixarXlsx = () => {
    const bytes = criarPlanilhaCustos({ ...form, itens: linhasPlanilha(), comContratos: etapaContratos === 'feito' }) as Uint8Array;
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nomePlanilha(form) || 'cotacao'}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const resumo = useMemo(() => {
    if (!buscas) return null;
    const preenchidos = escolhas.filter(Boolean).length;
    const sugestoes = buscas.filter((b, i) => b.alternativas.length && !escolhas[i]).length;
    return { preenchidos, sugestoes, semNada: buscas.filter((b) => !b.alternativas.length).length };
  }, [buscas, escolhas]);

  const ocupado = !!prog;
  const formOk = form.orgao.trim() && form.processo.trim() && form.data;

  return (
    <div className="mt-6 space-y-6">
      <div className={card}>
        <p className="text-lg font-bold text-[#0F2053]">1. Importe o termo de referência</p>
        <p className="mt-1 text-[15px] text-slate-600">
          Excel (.xlsx) ou CSV, como vem da plataforma (Descrição do Lote, Descrição do item, Quantidade, Unitário referência).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" disabled={ocupado} onClick={() => inputRef.current?.click()} className={`${botao} bg-[#0478CA] hover:bg-[#03609F] text-white`}>
            <Icon name="sheet" className="w-5 h-5" /> {arquivo ? 'Trocar arquivo' : 'Escolher arquivo'}
          </button>
          {arquivo && (
            <span className="text-[15px] text-slate-700">
              <strong>{arquivo}</strong>: {itens.length} {itens.length === 1 ? 'item' : 'itens'}
            </span>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv,.txt"
            className="hidden"
            onChange={(e) => {
              abrir(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {itens.length > 0 && (
        <div className={card}>
          <p className="text-lg font-bold text-[#0F2053]">2. Procurar nas planilhas de custo</p>
          <p className="mt-1 text-[15px] text-slate-600">
            Procura cada item nas planilhas da pasta "PLANILHAS PARA LICITAÇÕES" (todas as cidades e subpastas) e copia o link de referência, a marca e o valor
            de compra. Escolhe o menor valor de compra que encaixa na especificação.
          </p>
          {!conectado && (
            <p className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">Conecte o Google Drive acima para ler as planilhas.</p>
          )}
          <button
            type="button"
            disabled={ocupado || !conectado}
            onClick={buscarNasPlanilhas}
            className={`${botao} mt-4 bg-[#0E7A40] hover:bg-[#0B6535] text-white`}
          >
            <Icon name="search" className="w-5 h-5" />{' '}
            {buscas ? 'Procurar de novo' : `Procurar ${itens.length} ${itens.length === 1 ? 'item' : 'itens'} nas planilhas`}
          </button>
          {base && (
            <p className="mt-3 text-sm text-slate-600">
              Base: {base.total.toLocaleString('pt-BR')} itens cotados em {base.planilhas} planilhas.
              {base.comErro.length > 0 && ` Não consegui ler: ${base.comErro.join(', ')}.`}
            </p>
          )}
        </div>
      )}

      {prog && (
        <div className={card} role="status" aria-live="polite">
          <p className="font-semibold text-[#0F2053]">
            {prog.etapa}… {prog.total ? `${prog.feito} de ${prog.total}` : ''}
          </p>
          <div className="mt-3 h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-[#0478CA] transition-all" style={{ width: `${prog.total ? (100 * (prog.feito || 0)) / prog.total : 8}%` }} />
          </div>
          {etapaContratos === 'buscando' && (
            <button type="button" onClick={() => (parar.current = true)} className={`${botao} mt-3 border-2 border-slate-200 text-slate-700`}>
              Parar
            </button>
          )}
        </div>
      )}
      {erro && <p className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800">{erro}</p>}

      {buscas && resumo && (
        <div className={card}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-lg font-bold text-[#0F2053]">Resultado nas planilhas de custo</p>
            <p className="text-sm text-slate-600">
              {resumo.preenchidos} preenchidos · {resumo.sugestoes} com sugestão para conferir · {resumo.semNada} sem cotação
            </p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[62rem] text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3 font-semibold">Item</th>
                  <th className="py-2 pr-3 font-semibold">Descrição no termo</th>
                  <th className="py-2 pr-3 font-semibold text-right">Referência</th>
                  <th className="py-2 pr-3 font-semibold">Cotação usada (compra · marca · origem)</th>
                  {etapaContratos === 'feito' && <th className="py-2 pr-3 font-semibold">Contratos (PNCP)</th>}
                </tr>
              </thead>
              <tbody>
                {itens.map((it, i) => {
                  const b = buscas[i];
                  const esc = escolhas[i];
                  const opcoes = [...(b.melhor && !b.alternativas.some((a) => chave(a) === chave(b.melhor!)) ? [b.melhor] : []), ...b.alternativas];
                  const ct = contratos[i];
                  return (
                    <tr key={i} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-3 tabular-nums">{it.numero}</td>
                      <td className="py-2 pr-3 max-w-xs">
                        <span className="line-clamp-2">{it.descricao}</span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">{moeda(it.valorTermo)}</td>
                      <td className="py-2 pr-3">
                        {opcoes.length ? (
                          <>
                            <select
                              value={esc ? chave(esc) : ''}
                              onChange={(e) => {
                                const v = opcoes.find((o) => chave(o) === e.target.value) || null;
                                setEscolhas((x) => x.map((y, k) => (k === i ? v : y)));
                              }}
                              className={`w-full max-w-md bg-white border rounded-lg px-2 py-1.5 ${esc ? 'border-emerald-300' : 'border-amber-300'}`}
                            >
                              <option value="">{b.melhor && !b.confiavel ? '— conferir: escolha uma sugestão —' : '— sem cotação —'}</option>
                              {opcoes.map((o) => (
                                <option key={chave(o)} value={chave(o)}>
                                  {moeda(o.compra)} · {o.marca || 'sem marca'} · {o.arquivo.replace(/\.xlsx$/i, '')} › {o.aba} · {pct(o.aderencia)}
                                </option>
                              ))}
                            </select>
                            {esc && (
                              <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                                {esc.link ? (
                                  <a href={esc.link} target="_blank" rel="noopener noreferrer" className="text-[#0478CA] font-semibold underline">
                                    link de referência
                                  </a>
                                ) : (
                                  esc.referencia || 'sem link'
                                )}{' '}
                                · {esc.descricao}
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">Não encontrado nas planilhas</span>
                        )}
                      </td>
                      {etapaContratos === 'feito' && (
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {ct ? (
                            <a href={ct.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              <strong className="tabular-nums">{moeda(ct.valorUnitario)}</strong>
                              <span className="block text-xs text-slate-500">{ct.municipio}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {buscas && etapaContratos === 'pergunta' && (
        <div className={`${card} border-2 border-[#0478CA]/40`}>
          <p className="text-lg font-bold text-[#0F2053]">Deseja buscar em contratos?</p>
          <p className="mt-1 text-[15px] text-slate-600">
            Procura os mesmos itens nos pregões homologados do interior de MG (PNCP, últimos 6 meses): menor preço ganho, onde e quem venceu.
          </p>
          <div className="mt-4 flex gap-3">
            <button type="button" disabled={ocupado} onClick={buscarContratos} className={`${botao} bg-[#0478CA] hover:bg-[#03609F] text-white min-w-28`}>
              Sim
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => setEtapaContratos('pulado')}
              className={`${botao} border-2 border-slate-300 text-slate-700 min-w-28`}
            >
              Não
            </button>
          </div>
        </div>
      )}

      {buscas && (etapaContratos === 'feito' || etapaContratos === 'pulado') && (
        <div className={card}>
          <p className="text-lg font-bold text-[#0F2053]">3. Gerar a planilha de custos</p>
          <p className="mt-1 text-[15px] text-slate-600">
            No seu molde (uma aba), com as fórmulas de custo, como Planilha Google na pasta "{PASTA_COTACOES_NOME}" dentro de "PLANILHAS PARA LICITAÇÕES".
          </p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="block text-sm font-semibold text-slate-700 mb-1">Qual órgão?</span>
              <input
                value={form.orgao}
                onChange={(e) => setForm({ ...form, orgao: e.target.value })}
                placeholder="Ex.: Prefeitura de Ubá"
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold text-slate-700 mb-1">Qual processo?</span>
              <input
                value={form.processo}
                onChange={(e) => setForm({ ...form, processo: e.target.value })}
                placeholder="Ex.: PE 61-2025"
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold text-slate-700 mb-1">Data do processo</span>
              <input
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5"
              />
            </label>
          </div>
          {formOk && (
            <p className="mt-3 text-sm text-slate-600">
              Nome da planilha: <strong>{nomePlanilha(form)}</strong>
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" disabled={!formOk || ocupado || !conectado} onClick={gerar} className={`${botao} bg-[#0E7A40] hover:bg-[#0B6535] text-white`}>
              <Icon name="sheet" className="w-5 h-5" /> Gerar Planilha Google
            </button>
            <button
              type="button"
              disabled={!formOk}
              onClick={baixarXlsx}
              className={`${botao} border-2 border-slate-200 text-[#0F2053] hover:border-[#0478CA]`}
            >
              Baixar .xlsx
            </button>
          </div>
          {criado && (
            <p className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
              Planilha criada:{' '}
              <a href={criado.link} target="_blank" rel="noopener noreferrer" className="font-bold underline">
                {criado.nome}
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
