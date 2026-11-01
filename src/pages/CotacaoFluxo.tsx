// Contratos › Termo de referência, depois de importar a planilha:
// 2) procura cada item nas planilhas de custo da Ágil no Google Drive (link de referência, marca e valor de compra);
// 3) pergunta "Deseja buscar em contratos?" (a busca no PNCP é a do painel do termo, passada em `children`);
// 4) pede órgão, processo e data e gera a planilha de custos no molde da Ágil, como Planilha Google na pasta "cloud".
// O acesso às planilhas é pelo login Google de quem tem permissão na pasta: o site não guarda nenhum dado delas.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon } from '../components/ui.tsx';
import { GOOGLE_CLIENT_ID, PASTA_COTACOES_NOME, PASTA_PLANILHAS_ID } from '../data/privadoConfig.ts';
import { ROUTES } from '../lib/routes.ts';
import { buscarNaBase, indexar } from '../lib/privado/baseCustos.js';
import { carregarBase, type Cotacao } from '../lib/privado/cotacao.ts';
import { conectado, conectar, enviarComoPlanilhaGoogle, pastaFilha, usuario } from '../lib/privado/drive.ts';
import { criarPlanilhaCustos, nomePlanilha } from '../lib/privado/planilhaCustos.js';

export interface ItemCotacao {
  numero: string;
  produto: string;
  especificacao: string;
  descricao: string;
  unidade: string;
  quantidade: number | null;
  valorTermo: number | null;
}
export interface ContratoItem {
  valorUnitario: number;
  municipio: string;
  orgao: string;
  data: string;
  fornecedor: string;
  link: string;
}
type Achado = Cotacao & { aderencia: number; criterio?: string };
interface Busca {
  melhor: Achado | null;
  confiavel: boolean;
  alternativas: Achado[];
}

const CHAVE_CLIENT = 'agilcm:privado:clientId'; // o mesmo Client ID configurado na área Privado
const lerClientId = () => {
  if (GOOGLE_CLIENT_ID) return GOOGLE_CLIENT_ID;
  try {
    return localStorage.getItem(CHAVE_CLIENT) || '';
  } catch {
    return '';
  }
};

const moeda = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const pct = (v: number) => `${Math.round(v * 100)}%`;
const botao = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold cursor-pointer disabled:opacity-50';
const card = 'p-4 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm';
const chave = (c: Cotacao) => `${c.arquivoId || c.arquivo}#${c.aba}#${c.linha}`;
const hoje = () => new Date().toISOString().slice(0, 10);

export default function CotacaoFluxo({
  itens,
  contratos,
  buscandoContratos,
  onBuscarContratos,
  children,
}: {
  itens: ItemCotacao[];
  /** menor preço ganho no PNCP de cada item (mesma ordem de `itens`), depois da busca */
  contratos: (ContratoItem | null)[] | null;
  buscandoContratos: boolean;
  onBuscarContratos: () => void;
  /** progresso e resultado da busca em contratos (painel do termo) */
  children?: ReactNode;
}) {
  const [conta, setConta] = useState('');
  const [etapaBase, setEtapaBase] = useState<'inicio' | 'feito' | 'pulado'>('inicio');
  const [etapaContratos, setEtapaContratos] = useState<'pergunta' | 'sim' | 'nao'>('pergunta');
  const [prog, setProg] = useState<{ etapa: string; feito?: number; total?: number } | null>(null);
  const [erro, setErro] = useState('');
  const [base, setBase] = useState<{ total: number; planilhas: number; comErro: string[] } | null>(null);
  const [buscas, setBuscas] = useState<Busca[] | null>(null);
  const [escolhas, setEscolhas] = useState<(Achado | null)[]>([]);
  const [form, setForm] = useState({ orgao: '', processo: '', data: hoje() });
  const [criado, setCriado] = useState<{ nome: string; link: string } | null>(null);
  const progresso = (etapa: string, feito?: number, total?: number) => setProg({ etapa, feito, total });

  // termo novo: recomeça o fluxo
  const assinatura = itens.map((i) => `${i.numero}|${i.descricao}`).join('\n');
  useEffect(() => {
    setEtapaBase('inicio');
    setEtapaContratos('pergunta');
    setBuscas(null);
    setEscolhas([]);
    setCriado(null);
    setErro('');
  }, [assinatura]);

  const entrarGoogle = async () => {
    const clientId = lerClientId();
    if (!clientId) throw new Error('Falta configurar o login do Google: entre na área Privado, abra "Configurações" e informe o Client ID.');
    await conectar(clientId);
    setConta((await usuario()).email);
  };
  const garantirGoogle = async () => {
    if (!conectado()) await entrarGoogle();
  };

  const procurarNasPlanilhas = async () => {
    setErro('');
    try {
      await garantirGoogle();
      const b = await carregarBase(PASTA_PLANILHAS_ID, progresso);
      setBase({ total: b.itens.length, planilhas: b.planilhas, comErro: b.comErro });
      progresso('Procurando os itens do termo');
      const idx = indexar(b.itens);
      const r = itens.map((it) => buscarNaBase(it, idx) as Busca);
      setBuscas(r);
      setEscolhas(r.map((x) => (x.confiavel ? x.melhor : null)));
      setEtapaBase('feito');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setProg(null);
    }
  };

  const comContratos = etapaContratos === 'sim' && !!contratos;
  const linhasPlanilha = () => itens.map((it, i) => ({ ...it, base: escolhas[i] || null, contrato: comContratos ? contratos?.[i] || null : null }));

  const gerar = async () => {
    setErro('');
    const nome = nomePlanilha(form);
    try {
      await garantirGoogle();
      progresso(`Abrindo a pasta "${PASTA_COTACOES_NOME}"`);
      const pasta = await pastaFilha(PASTA_COTACOES_NOME, PASTA_PLANILHAS_ID);
      progresso('Gerando a planilha no Google Drive');
      const bytes = criarPlanilhaCustos({ ...form, itens: linhasPlanilha(), comContratos }) as Uint8Array;
      const f = await enviarComoPlanilhaGoogle({ nome, pai: pasta.id, bytes });
      setCriado({ nome, link: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}/edit` });
    } catch (e) {
      setErro(`Não consegui criar a planilha no Drive: ${(e as Error).message}`);
    } finally {
      setProg(null);
    }
  };

  const baixarXlsx = () => {
    const bytes = criarPlanilhaCustos({ ...form, itens: linhasPlanilha(), comContratos }) as Uint8Array;
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
    return {
      preenchidos: escolhas.filter(Boolean).length,
      sugestoes: buscas.filter((b, i) => b.alternativas.length && !escolhas[i]).length,
      semNada: buscas.filter((b) => !b.alternativas.length).length,
    };
  }, [buscas, escolhas]);

  const ocupado = !!prog || buscandoContratos;
  const formOk = form.orgao.trim() && form.processo.trim() && form.data;
  const mostrarForm = etapaBase !== 'inicio' && (etapaContratos === 'nao' || (etapaContratos === 'sim' && !!contratos && !buscandoContratos));

  return (
    <>
      {/* 2. planilhas de custo */}
      <div className={card}>
        <p className="text-lg font-bold text-[#0F2053]">2. Procurar nas planilhas de custo</p>
        <p className="mt-1 text-[15px] text-slate-600">
          Procura cada item nas planilhas da pasta "PLANILHAS PARA LICITAÇÕES" no Google Drive (todas as cidades e subpastas) e copia o link de referência, a
          marca e o valor de compra. Escolhe o menor valor de compra que encaixa na especificação.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" disabled={ocupado} onClick={procurarNasPlanilhas} className={`${botao} bg-[#0E7A40] hover:bg-[#0B6535] text-white`}>
            <Icon name="search" className="w-5 h-5" />
            {etapaBase === 'feito' ? 'Procurar de novo' : `Procurar ${itens.length} ${itens.length === 1 ? 'item' : 'itens'} nas planilhas`}
          </button>
          {etapaBase === 'inicio' && (
            <button type="button" disabled={ocupado} onClick={() => setEtapaBase('pulado')} className={`${botao} border-2 border-slate-200 text-slate-700`}>
              Pular esta etapa
            </button>
          )}
          <span className="text-sm text-slate-500">
            {conta ? (
              <>
                Google: <strong>{conta}</strong>
              </>
            ) : (
              'Pede o login do Google com a conta que tem acesso à pasta.'
            )}
          </span>
        </div>
        {!lerClientId() && (
          <p className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
            Para entrar com o Google neste navegador, configure antes o Client ID na{' '}
            <a href={ROUTES.privado} className="font-bold underline">
              área Privado
            </a>{' '}
            (botão "Configurações").
          </p>
        )}
        {base && (
          <p className="mt-3 text-sm text-slate-600">
            Base: {base.total.toLocaleString('pt-BR')} itens cotados em {base.planilhas} planilhas.
            {base.comErro.length > 0 && ` Não consegui ler: ${base.comErro.join(', ')}.`}
          </p>
        )}
      </div>

      {prog && (
        <div className={card} role="status" aria-live="polite">
          <p className="font-semibold text-[#0F2053]">
            {prog.etapa}… {prog.total ? `${prog.feito} de ${prog.total}` : ''}
          </p>
          <div className="mt-3 h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-[#0478CA] transition-all" style={{ width: `${prog.total ? (100 * (prog.feito || 0)) / prog.total : 8}%` }} />
          </div>
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
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3 font-semibold">Item</th>
                  <th className="py-2 pr-3 font-semibold">Descrição no termo</th>
                  <th className="py-2 pr-3 font-semibold text-right">Referência</th>
                  <th className="py-2 pr-3 font-semibold">Cotação usada (compra · marca · origem)</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, i) => {
                  const b = buscas[i];
                  const esc = escolhas[i];
                  const opcoes = [...(b.melhor && !b.alternativas.some((a) => chave(a) === chave(b.melhor!)) ? [b.melhor] : []), ...b.alternativas];
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. contratos */}
      {etapaBase !== 'inicio' && (
        <div className={`${card} border-2 border-[#0478CA]/40`}>
          <p className="text-lg font-bold text-[#0F2053]">3. Deseja buscar em contratos?</p>
          <p className="mt-1 text-[15px] text-slate-600">
            Procura os mesmos itens nos pregões homologados (PNCP), com o período e a região escolhidos acima: menor preço ganho, onde e quem venceu.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={ocupado}
              aria-pressed={etapaContratos === 'sim'}
              onClick={() => {
                setEtapaContratos('sim');
                onBuscarContratos();
              }}
              className={`${botao} min-w-28 ${etapaContratos === 'sim' ? 'bg-[#0F2053] text-white' : 'bg-[#0478CA] hover:bg-[#03609F] text-white'}`}
            >
              Sim
            </button>
            <button
              type="button"
              disabled={ocupado}
              aria-pressed={etapaContratos === 'nao'}
              onClick={() => setEtapaContratos('nao')}
              className={`${botao} min-w-28 border-2 ${etapaContratos === 'nao' ? 'border-[#0F2053] bg-[#0F2053] text-white' : 'border-slate-300 text-slate-700'}`}
            >
              Não
            </button>
          </div>
        </div>
      )}

      {etapaContratos === 'sim' && children}

      {/* 4. planilha */}
      {mostrarForm && (
        <div className={card}>
          <p className="text-lg font-bold text-[#0F2053]">4. Gerar a planilha de custos</p>
          <p className="mt-1 text-[15px] text-slate-600">
            No molde da Ágil (uma aba), com as fórmulas de custo, como Planilha Google na pasta "{PASTA_COTACOES_NOME}" dentro de "PLANILHAS PARA LICITAÇÕES".
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
            <button type="button" disabled={!formOk || ocupado} onClick={gerar} className={`${botao} bg-[#0E7A40] hover:bg-[#0B6535] text-white`}>
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
    </>
  );
}
