// Contratos › Termo de referência, depois de importar a planilha. Três pesquisas (botões do painel do termo):
// - "tudo": planilhas de custo da Ágil no Google Drive + editais (PNCP);
// - "editais": só o PNCP (a busca e o resultado são os do painel do termo, passados em `children`);
// - "planilhas": só as planilhas de custo (link de referência, marca e valor de compra), e depois pergunta se quer buscar em contratos.
// A planilha de custos (molde da Ágil, Planilha Google na pasta "cloud", nome "Órgão - Processo - Data") pode ser criada logo
// depois de importar o termo (comando "planilha") e é atualizada sozinha, no mesmo link, quando cada pesquisa termina.
// O acesso às planilhas é pelo login Google de quem tem permissão na pasta: o site não guarda nenhum dado delas.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../components/ui.tsx';
import { PASTA_COTACOES_NOME, PASTA_PLANILHAS_ID } from '../data/privadoConfig.ts';
import { ROUTES } from '../lib/routes.ts';
import { buscarNaBase, indexar } from '../lib/privado/baseCustos.js';
import { carregarBase, type Cotacao } from '../lib/privado/cotacao.ts';
import { atualizar, atualizarPlanilhaGoogle, enviarComoPlanilhaGoogle, lixeira, pastaFilha } from '../lib/privado/drive.ts';
import { garantirGoogle as entrarGoogle, lerClientId } from '../lib/privado/googleLogin.ts';
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
export interface DadosPlanilha {
  orgao: string;
  processo: string;
  data: string;
}
export const dadosOk = (d: DadosPlanilha) => !!(d.orgao.trim() && d.processo.trim() && d.data);
export const hojeIso = () => new Date().toISOString().slice(0, 10);

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

const moeda = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const pct = (v: number) => `${Math.round(v * 100)}%`;
const botao = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold cursor-pointer disabled:opacity-50';
const card = 'p-4 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm';
const chave = (c: Cotacao) => `${c.arquivoId || c.arquivo}#${c.aba}#${c.linha}`;

export default function CotacaoFluxo({
  itens,
  contratos,
  buscandoContratos,
  onBuscarContratos,
  comando,
  onOcupado,
  dados,
  setDados,
  children,
}: {
  itens: ItemCotacao[];
  /** menor preço ganho no PNCP de cada item (mesma ordem de `itens`), depois da busca */
  contratos: (ContratoItem | null)[] | null;
  buscandoContratos: boolean;
  onBuscarContratos: () => void;
  /** pesquisa pedida pelos botões do painel; `n` muda a cada clique */
  comando: { tipo: 'tudo' | 'editais' | 'planilhas' | 'planilha'; n: number } | null;
  onOcupado?: (ocupado: boolean) => void;
  /** órgão, processo e data da planilha (os campos ficam no painel do termo e aqui embaixo) */
  dados: DadosPlanilha;
  setDados: (d: DadosPlanilha) => void;
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
  const form = dados;
  const setForm = setDados;
  // planilha já criada no Drive: as próximas gerações atualizam o mesmo arquivo (mesmo link)
  const [criado, setCriado] = useState<{ id: string; nome: string; link: string; quando: string } | null>(null);
  const [aviso, setAviso] = useState('');
  // geração automática quando a pesquisa terminar ('editais'/'tudo' esperam a busca do PNCP começar e acabar)
  const auto = useRef<{ tipo: string; viuBusca: boolean } | null>(null);
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
    setAviso('');
    auto.current = null;
  }, [assinatura]);

  const garantirGoogle = async () => setConta(await entrarGoogle());

  const procurarNasPlanilhas = async (): Promise<boolean> => {
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
      return true;
    } catch (e) {
      setErro((e as Error).message);
      return false;
    } finally {
      setProg(null);
    }
  };

  // botões do painel: planilhas + editais, só editais ou só planilhas
  useEffect(() => {
    if (!comando) return;
    setAviso('');
    if (comando.tipo === 'planilha') {
      gerar();
      return;
    }
    auto.current = { tipo: comando.tipo, viuBusca: false };
    if (comando.tipo === 'editais') {
      setEtapaBase('pulado');
      setBuscas(null);
      setEscolhas([]);
      setEtapaContratos('sim');
      onBuscarContratos();
      return;
    }
    setEtapaContratos('pergunta');
    procurarNasPlanilhas().then((ok) => {
      if (comando.tipo !== 'tudo') return;
      if (!ok) setEtapaBase('pulado'); // sem acesso às planilhas: segue só com os editais
      setEtapaContratos('sim');
      onBuscarContratos();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comando?.n]);

  const comContratos = etapaContratos === 'sim' && !!contratos;
  const linhasPlanilha = () => itens.map((it, i) => ({ ...it, base: escolhas[i] || null, contrato: comContratos ? contratos?.[i] || null : null }));

  const gerar = async () => {
    setErro('');
    if (!dadosOk(form)) {
      setAviso('Preencha órgão, processo e data da planilha (no quadro 1, lá em cima) para eu criar a planilha Google.');
      return;
    }
    setAviso('');
    const nome = nomePlanilha(form);
    try {
      await garantirGoogle();
      const bytes = criarPlanilhaCustos({ ...form, itens: linhasPlanilha(), comContratos }) as Uint8Array;
      const quando = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      if (criado) {
        progresso('Atualizando a planilha no Google Drive');
        try {
          const f = await atualizarPlanilhaGoogle(criado.id, bytes);
          // mudou órgão, processo ou data: renomeia
          if (criado.nome !== nome) await atualizar(criado.id, { nome });
          setCriado({ ...criado, nome, link: f.webViewLink || criado.link, quando });
          return;
        } catch {
          // não deu para atualizar (apagada ou sem permissão): cria outra e manda a antiga para a lixeira
          lixeira(criado.id).catch(() => {});
        }
      }
      progresso(`Abrindo a pasta "${PASTA_COTACOES_NOME}"`);
      const pasta = await pastaFilha(PASTA_COTACOES_NOME, PASTA_PLANILHAS_ID);
      progresso('Criando a planilha no Google Drive');
      const f = await enviarComoPlanilhaGoogle({ nome, pai: pasta.id, bytes });
      setCriado({ id: f.id, nome, link: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}/edit`, quando });
    } catch (e) {
      setErro(`Não consegui criar a planilha no Drive: ${(e as Error).message}`);
    } finally {
      setProg(null);
    }
  };

  // terminou a pesquisa: gera (ou atualiza) a planilha sozinho
  useEffect(() => {
    const a = auto.current;
    if (!a || prog) return;
    if (a.tipo === 'planilhas') {
      if (etapaBase === 'inicio') return;
    } else {
      if (buscandoContratos) {
        a.viuBusca = true;
        return;
      }
      if (!a.viuBusca || !contratos) return;
    }
    auto.current = null;
    if (etapaBase === 'feito' || contratos) gerar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prog, etapaBase, buscandoContratos, contratos]);

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
  useEffect(() => onOcupado?.(!!prog), [prog]); // eslint-disable-line react-hooks/exhaustive-deps
  const formOk = form.orgao.trim() && form.processo.trim() && form.data;
  // "Criar planilha Google" aparece logo depois da leitura das planilhas (ou, só com editais, quando a busca terminar)
  const mostrarForm = !prog && !buscandoContratos && (etapaBase === 'feito' || (etapaBase === 'pulado' && etapaContratos === 'sim' && !!contratos));

  return (
    <>
      {comando && comando.tipo !== 'editais' && (
        <div className={card}>
          <p className="text-lg font-bold text-[#0F2053]">Planilhas de custo (Google Drive)</p>
          <p className="mt-1 text-sm text-slate-600">
            {conta ? (
              <>
                Google: <strong>{conta}</strong> ·{' '}
              </>
            ) : null}
            {base
              ? `${base.total.toLocaleString('pt-BR')} itens cotados em ${base.planilhas} planilhas da pasta "PLANILHAS PARA LICITAÇÕES".${base.comErro.length ? ` Não consegui ler: ${base.comErro.join(', ')}.` : ''}`
              : 'Lê as planilhas da pasta "PLANILHAS PARA LICITAÇÕES" com o login do Google de quem tem acesso à pasta.'}
          </p>
          {!lerClientId() && (
            <p className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
              Para entrar com o Google neste navegador, configure antes o Client ID na{' '}
              <a href={ROUTES.privado} className="font-bold underline">
                área Privado
              </a>{' '}
              (botão "Configurações").
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
                                  <a href={esc.link} target="_blank" rel="noopener noreferrer" className="text-[#0369B3] font-semibold underline">
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
                          <span className="text-slate-500">Não encontrado nas planilhas</span>
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
      {comando?.tipo === 'planilhas' && etapaBase === 'feito' && (
        <div className={`${card} border-2 border-[#0478CA]/40`}>
          <p className="text-lg font-bold text-[#0F2053]">Deseja buscar em contratos?</p>
          <p className="mt-1 text-[15px] text-slate-600">
            Opcional: procura os mesmos itens nos pregões homologados (PNCP), com o período e a região escolhidos acima, e acrescenta na planilha o menor preço
            ganho, onde e quem venceu.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={ocupado}
              aria-pressed={etapaContratos === 'sim'}
              onClick={() => {
                setEtapaContratos('sim');
                auto.current = { tipo: 'contratos', viuBusca: false };
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

      {/* planilha Google: link sempre à vista depois de criada; botão também no fim */}
      {aviso && <p className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">{aviso}</p>}
      {(mostrarForm || criado) && (
        <div className={`${card} ${criado ? 'border-2 border-emerald-300' : ''}`}>
          <p className="text-lg font-bold text-[#0F2053]">Planilha Google (custos + referência)</p>
          {criado ? (
            <a
              href={criado.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-between gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 hover:bg-emerald-100"
            >
              <span>
                <span className="block font-bold text-[17px] underline">{criado.nome}</span>
                <span className="block text-sm">
                  Atualizada às {criado.quando} · pasta "{PASTA_COTACOES_NOME}" · {escolhas.filter(Boolean).length} itens com cotação
                  {comContratos ? ' e preços de contratos' : ''}
                </span>
              </span>
              <span className="shrink-0 font-bold">Abrir ↗</span>
            </a>
          ) : (
            <p className="mt-1 text-[15px] text-slate-600">
              No molde da sua planilha de custos (uma aba): itens do termo, marca, link de referência e valor de compra das planilhas, com as fórmulas de custo.
              Fica na pasta "{PASTA_COTACOES_NOME}" dentro de "PLANILHAS PARA LICITAÇÕES".
            </p>
          )}
          <p className="mt-3 text-sm text-slate-600">
            {formOk ? (
              <>
                Nome: <strong>{nomePlanilha(form)}</strong> (órgão, processo e data no quadro 1, lá em cima)
              </>
            ) : (
              'Preencha órgão, processo e data no quadro 1, lá em cima.'
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" disabled={!formOk || ocupado} onClick={gerar} className={`${botao} bg-[#0E7A40] hover:bg-[#0B6535] text-white`}>
              <Icon name="sheet" className="w-5 h-5" /> {criado ? 'Atualizar planilha Google' : 'Criar planilha Google'}
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
        </div>
      )}
    </>
  );
}
