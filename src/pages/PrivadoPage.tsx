import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Header from '../components/Header.tsx';
import { Container, Icon } from '../components/ui.tsx';
import { GOOGLE_CLIENT_ID, PASTA_LICITACOES_ID } from '../data/privadoConfig.ts';
import { dateText, downloadPdf } from '../lib/pdfReport.ts';
import { conferirLogin, sair, sessaoAtiva } from '../lib/privado/auth.ts';
import { conectado, conectar, desconectar, idDoLink, usuario } from '../lib/privado/drive.ts';
import { desfazer, executar, lerPasta, type Leitura } from '../lib/privado/organizar.ts';
import {
  blocosRelatorio,
  consolidarProdutos,
  csvItens,
  csvPendencias,
  csvProcessos,
  csvProdutos,
  dataBR,
  DIAS_ALERTA,
  resumo,
  rotulo,
  textoVigencia,
  vigencia,
} from '../lib/privado/relatorios.js';
import { salvarHistorico } from '../lib/historicoVitorias.js';

type Situacao = 'vigente' | 'vencendo' | 'vencido' | 'sem-data';
const COR_SITUACAO: Record<Situacao, string> = {
  vigente: 'bg-emerald-50 text-emerald-800',
  vencendo: 'bg-amber-100 text-amber-900',
  vencido: 'bg-red-100 text-red-800',
  'sem-data': 'bg-slate-100 text-slate-600',
};

/** Texto longo em até 2 linhas, com "ver mais" */
function TextoCurto({ texto }: { texto: string }) {
  const [aberto, setAberto] = useState(false);
  const longo = texto.length > 110;
  return (
    <span className="block">
      <span className={aberto || !longo ? '' : 'line-clamp-2'}>{texto}</span>
      {longo && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setAberto((v) => !v);
          }}
          className="text-sm font-bold text-[#0478CA] underline cursor-pointer"
        >
          {aberto ? 'ver menos' : 'ver mais'}
        </button>
      )}
    </span>
  );
}

const CHAVE_CLIENT = 'agilcm:privado:clientId';
const CHAVE_PASTA = 'agilcm:privado:pasta';
const ler = (k: string) => {
  try {
    return localStorage.getItem(k) || '';
  } catch {
    return '';
  }
};
const gravar = (k: string, v: string) => {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
};

const moeda = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const qtd = (v: number | null | undefined) => (v == null ? '' : v.toLocaleString('pt-BR', { maximumFractionDigits: 4 }));

function baixarTexto(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const botao = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

export default function PrivadoPage() {
  const [logado, setLogado] = useState(false);
  useEffect(() => setLogado(sessaoAtiva()), []);

  return (
    <>
      <Header page="privado" />
      <main id="conteudo" className="bg-[#F4F7FB] min-h-screen py-10 sm:py-14">
        <Container>
          {logado ? (
            <Painel
              onSair={() => {
                sair();
                desconectar();
                setLogado(false);
              }}
            />
          ) : (
            <Login onEntrar={() => setLogado(true)} />
          )}
        </Container>
      </main>
    </>
  );
}

function Login({ onEntrar }: { onEntrar: () => void }) {
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
    <form onSubmit={enviar} className="max-w-md mx-auto p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm">
      <p className="inline-flex items-center gap-2 text-sm font-bold text-[#0478CA]">
        <Icon name="shield" className="w-5 h-5" /> Área restrita
      </p>
      <h1 className="mt-2 text-2xl sm:text-3xl font-bold font-display text-[#0F2053]">Privado</h1>
      <p className="mt-2 text-[15px] text-slate-600">Organização das licitações da AGIL no Google Drive.</p>
      <label className="block mt-6">
        <span className="text-sm font-semibold text-slate-700">E-mail</span>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-300 text-base focus:outline-none focus:border-[#0478CA] focus:ring-2 focus:ring-[#0478CA]/20"
        />
      </label>
      <label className="block mt-4">
        <span className="text-sm font-semibold text-slate-700">Senha</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-300 text-base focus:outline-none focus:border-[#0478CA] focus:ring-2 focus:ring-[#0478CA]/20"
        />
      </label>
      {erro && (
        <p role="alert" className="mt-4 text-[15px] font-semibold text-red-700">
          {erro}
        </p>
      )}
      <button type="submit" disabled={conferindo} className={`${botao} mt-6 w-full py-3 bg-[#0478CA] hover:bg-[#03609F] text-white`}>
        {conferindo ? 'Conferindo…' : 'Entrar'}
      </button>
    </form>
  );
}

type Prog = { etapa: string; feito?: number; total?: number } | null;

function Painel({ onSair }: { onSair: () => void }) {
  const [clientId, setClientId] = useState(GOOGLE_CLIENT_ID);
  const [pastaId, setPastaId] = useState(PASTA_LICITACOES_ID);
  const [conta, setConta] = useState<{ nome: string; email: string } | null>(null);
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [prog, setProg] = useState<Prog>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [confirmar, setConfirmar] = useState<'organizar' | 'desfazer' | null>(null);
  const [aba, setAba] = useState<'processos' | 'produtos'>('processos');
  const [busca, setBusca] = useState('');
  const [filtroVig, setFiltroVig] = useState<'todos' | Situacao>('todos');
  const [config, setConfig] = useState(false);

  useEffect(() => {
    setClientId(GOOGLE_CLIENT_ID || ler(CHAVE_CLIENT));
    setPastaId(ler(CHAVE_PASTA) || PASTA_LICITACOES_ID);
  }, []);

  const ocupado = !!prog;
  const progresso = (etapa: string, feito?: number, total?: number) => setProg({ etapa, feito, total });

  const lerTudo = async () => {
    setErro('');
    try {
      const l = await lerPasta(pastaId, progresso);
      setLeitura(l);
      salvarHistorico(l.resultado.processos, (p: any) => vigencia(p).situacao);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setProg(null);
    }
  };

  const entrarGoogle = async () => {
    setErro('');
    try {
      await conectar(clientId.trim());
      setConta(await usuario());
      await lerTudo();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const rodar = async (qual: 'organizar' | 'desfazer') => {
    if (!leitura) return;
    setConfirmar(null);
    setErro('');
    setAviso('');
    try {
      const r = qual === 'organizar' ? await executar(leitura, progresso) : await desfazer(leitura, progresso);
      setAviso(
        `${qual === 'organizar' ? 'Organização concluída' : 'Organização desfeita'}: ${r.feitas} ${r.feitas === 1 ? 'alteração' : 'alterações'} no Drive.` +
          (r.erros.length ? ` ${r.erros.length} não puderam ser feitas: ${r.erros.slice(0, 3).join(' · ')}` : ''),
      );
      await lerTudo();
    } catch (e) {
      setErro((e as Error).message);
      setProg(null);
    }
  };

  const res = leitura?.resultado;
  const processos = (res?.processos || []) as any[];
  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return processos.filter(
      (p) =>
        (filtroVig === 'todos' || vigencia(p).situacao === filtroVig) &&
        (!t || `${p.orgao} ${rotulo(p)} ${p.objeto} ${p.itens.map((i: any) => i.descricao).join(' ')}`.toLowerCase().includes(t)),
    );
  }, [processos, busca, filtroVig]);
  const geral = useMemo(() => resumo(processos), [processos]);
  const r = useMemo(() => resumo(filtrados), [filtrados]);
  const porOrgao = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const p of filtrados) m.set(p.orgao, [...(m.get(p.orgao) || []), p]);
    return [...m];
  }, [filtrados]);

  const baixarPdf = async () => {
    try {
      await downloadPdf('relatorio-licitacoes-agil.pdf', 'Relatório de licitações', blocosRelatorio(filtrados, res?.pendencias || [], { dataText: dateText() }) as never);
    } catch (e) {
      setErro(`Não consegui gerar o PDF: ${(e as Error).message}`);
    }
  };

  if (!clientId || config) {
    return (
      <Configuracao
        clientId={clientId}
        pastaId={pastaId}
        onSalvar={(c, p) => {
          setClientId(c);
          setPastaId(p);
          if (!GOOGLE_CLIENT_ID) gravar(CHAVE_CLIENT, c);
          gravar(CHAVE_PASTA, p === PASTA_LICITACOES_ID ? '' : p);
          setConfig(false);
        }}
        onCancelar={clientId ? () => setConfig(false) : undefined}
        onSair={onSair}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#0F2053]">Licitações ganhas · Privado</h1>
          <p className="mt-1 text-[15px] text-slate-600">
            {conta ? (
              <>
                Google: <strong>{conta.email}</strong>
                {leitura && (
                  <>
                    {' '}
                    · pasta{' '}
                    <a href={leitura.raiz.webViewLink} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0478CA] underline">
                      {leitura.raiz.name}
                    </a>
                  </>
                )}
              </>
            ) : (
              'Conecte a conta do Google que tem a pasta "Licitacoes - Agil".'
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setConfig(true)} className={`${botao} border-2 border-slate-200 text-slate-700 hover:border-[#0478CA]`}>
            Configurações
          </button>
          <button type="button" onClick={onSair} className={`${botao} border-2 border-slate-200 text-slate-700 hover:border-red-300`}>
            Sair
          </button>
        </div>
      </div>

      {(!conta || !conectado()) && (
        <div className="mt-6 p-6 rounded-2xl bg-white border border-slate-200">
          <p className="text-lg font-bold text-[#0F2053]">Conectar ao Google Drive</p>
          <p className="mt-1 text-[15px] text-slate-600">
            O Google vai pedir permissão para ver e organizar os arquivos do Drive. Nada é enviado para outro servidor: a leitura dos PDFs acontece neste
            navegador.
          </p>
          <button type="button" disabled={ocupado} onClick={entrarGoogle} className={`${botao} mt-4 bg-[#0478CA] hover:bg-[#03609F] text-white`}>
            <Icon name="shield" className="w-5 h-5" />
            Conectar ao Google Drive
          </button>
        </div>
      )}

      {erro && (
        <p role="alert" className="mt-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-[15px]">
          {erro}
        </p>
      )}
      {aviso && (
        <p role="status" className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[15px]">
          {aviso}
        </p>
      )}

      {prog && (
        <div className="mt-6 p-5 rounded-2xl bg-white border border-slate-200" aria-live="polite">
          <p className="text-[15px] font-semibold text-slate-700">
            {prog.etapa}
            {prog.feito != null && ` · ${prog.feito}${prog.total ? ` de ${prog.total}` : ''}`}
          </p>
          <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full bg-[#0478CA] transition-all ${prog.total ? '' : 'animate-pulse w-1/3'}`}
              style={prog.total ? { width: `${Math.min(100, ((prog.feito || 0) / prog.total) * 100)}%` } : undefined}
            />
          </div>
          <p className="mt-2 text-sm text-slate-500">Na primeira vez cada PDF é baixado e lido; depois a leitura fica guardada e é rápida.</p>
        </div>
      )}

      {leitura && res && !prog && (
        <>
          {/* Ações */}
          <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!res.ops.length}
              onClick={() => setConfirmar('organizar')}
              className={`${botao} px-5 py-3 bg-[#F5A623] hover:bg-[#E0951A] text-[#0F2053] font-extrabold`}
            >
              <Icon name="box" className="w-5 h-5" />
              Organizar pastas
            </button>
            <button type="button" onClick={lerTudo} className={`${botao} border-2 border-slate-200 text-[#0F2053] hover:border-[#0478CA]`}>
              Ler de novo
            </button>
            <span className="text-[15px] text-slate-600">
              {res.ops.length
                ? `${res.ops.filter((o: any) => o.op === 'mover').length} arquivos e pastas para organizar`
                : 'Tudo organizado.'}
            </span>
            {leitura.dados.historico && (
              <button type="button" onClick={() => setConfirmar('desfazer')} className="ml-auto text-sm font-bold text-slate-600 underline cursor-pointer">
                Desfazer a última organização ({dataBR(leitura.dados.historico.quando, true)})
              </button>
            )}
          </div>

          {confirmar && (
            <div role="dialog" aria-label="Confirmar" className="mt-4 p-5 rounded-2xl bg-amber-50 border-2 border-amber-300">
              {confirmar === 'organizar' ? (
                <>
                  <p className="text-lg font-bold text-[#0F2053]">Organizar a pasta no Google Drive?</p>
                  <ul className="mt-2 text-[15px] text-slate-700 list-disc pl-5 space-y-1">
                    <li>Cria uma pasta por órgão e, dentro, uma por processo.</li>
                    <li>Renomeia os termos de homologação e adjudicação (ex.: "Processo 028-2025 - Termo de Homologação.pdf").</li>
                    <li>Os demais arquivos de cada processo ficam juntos numa pasta "Outros" dentro do processo. Nada é apagado.</li>
                    <li>Pastas sem termo ({res.pendencias.length}) não são mexidas.</li>
                  </ul>
                  <PreviaOps ops={res.ops} />
                </>
              ) : (
                <p className="text-lg font-bold text-[#0F2053]">Voltar todos os arquivos para onde estavam antes da última organização?</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => rodar(confirmar)} className={`${botao} bg-[#0F2053] text-white hover:bg-[#13306f]`}>
                  {confirmar === 'organizar' ? 'Sim, organizar' : 'Sim, desfazer'}
                </button>
                <button type="button" onClick={() => setConfirmar(null)} className={`${botao} border-2 border-slate-300 text-slate-700`}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Números */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {(
              [
                ['Total ganho', moeda(r.total), ''],
                ['Processos', r.processos.toLocaleString('pt-BR'), ''],
                ['Itens ganhos', r.itens.toLocaleString('pt-BR'), ''],
                [`Vencendo (${DIAS_ALERTA} dias)`, String(geral.vencendo), geral.vencendo ? 'amber' : ''],
                ['Vencidos', String(geral.vencidos), geral.vencidos ? 'red' : ''],
                ['Pastas sem termo', String(res.pendencias.length), res.pendencias.length ? 'red' : ''],
              ] as const
            ).map(([k, v, cor]) => (
              <div
                key={k}
                className={`p-4 rounded-2xl border ${cor === 'red' ? 'bg-red-50 border-red-200' : cor === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}
              >
                <p className={`text-sm ${cor === 'red' ? 'text-red-700' : cor === 'amber' ? 'text-amber-800' : 'text-slate-500'}`}>{k}</p>
                <p className={`mt-1 text-lg sm:text-xl xl:text-2xl font-bold tabular-nums break-words ${cor === 'red' ? 'text-red-700' : cor === 'amber' ? 'text-amber-900' : 'text-[#0F2053]'}`}>{v}</p>
              </div>
            ))}
          </div>

          {geral.vencendo > 0 && (
            <div role="status" className="mt-4 p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 flex flex-wrap items-center gap-3">
              <p className="flex-1 min-w-0 text-[15px] text-amber-900">
                <strong>
                  {geral.vencendo} {geral.vencendo === 1 ? 'processo vence' : 'processos vencem'} nos próximos {DIAS_ALERTA} dias
                </strong>{' '}
                (a homologação vale 1 ano):{' '}
                {processos
                  .filter((p) => vigencia(p).situacao === 'vencendo')
                  .map((p) => `${p.orgao} ${rotulo(p)}`)
                  .join(' · ')}
              </p>
              <button type="button" onClick={() => setFiltroVig('vencendo')} className="text-sm font-bold text-amber-900 underline cursor-pointer">
                Ver só estes
              </button>
            </div>
          )}

          {/* Pendências em vermelho */}
          {res.pendencias.length > 0 && (
            <section aria-label="Pastas sem termo" className="mt-6 p-5 rounded-2xl bg-red-50 border-2 border-red-300">
              <p className="text-lg font-bold text-red-800">Faltando o termo de homologação ou de adjudicação</p>
              <p className="mt-1 text-[15px] text-red-900">Salve o termo dentro da pasta indicada e clique em "Organizar pastas" de novo.</p>
              <ul className="mt-3 space-y-2">
                {res.pendencias.map((p: any) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 rounded-xl bg-white border border-red-200">
                    <span className="font-bold text-red-800">{p.nome}</span>
                    <span className="text-sm text-red-700">
                      {p.arquivos} {p.arquivos === 1 ? 'arquivo' : 'arquivos'}
                      {p.ilegiveis ? ` · ${p.ilegiveis} PDF sem texto (escaneado?), confira` : ''}
                    </span>
                    {p.link && (
                      <a href={p.link} target="_blank" rel="noopener noreferrer" className="ml-auto text-sm font-bold text-[#0478CA] underline">
                        Abrir no Drive
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {res.avisos.length > 0 && (
            <details className="mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-[15px] text-amber-900">
              <summary className="font-bold cursor-pointer">{res.avisos.length} aviso(s)</summary>
              <ul className="mt-2 space-y-1">
                {res.avisos.map((a: any) => (
                  <li key={a.id}>
                    {a.link ? (
                      <a href={a.link} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                        {a.nome}
                      </a>
                    ) : (
                      <strong>{a.nome}</strong>
                    )}
                    : {a.motivo}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Relatórios */}
          <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200">
            <p className="font-bold text-[#0F2053]">Relatórios consolidados{busca || filtroVig !== 'todos' ? ' (com o filtro atual)' : ''}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={baixarPdf} className={`${botao} bg-[#0478CA] hover:bg-[#03609F] text-white`}>
                <Icon name="doc" className="w-5 h-5" /> PDF consolidado
              </button>
              <button type="button" onClick={() => baixarTexto('processos-agil.csv', csvProcessos(filtrados))} className={`${botao} border-2 border-slate-200 text-[#0F2053] hover:border-[#0478CA]`}>
                <Icon name="sheet" className="w-5 h-5" /> Processos (Excel)
              </button>
              <button type="button" onClick={() => baixarTexto('itens-ganhos-agil.csv', csvItens(filtrados))} className={`${botao} border-2 border-slate-200 text-[#0F2053] hover:border-[#0478CA]`}>
                <Icon name="sheet" className="w-5 h-5" /> Itens ganhos (Excel)
              </button>
              <button type="button" onClick={() => baixarTexto('produtos-agil.csv', csvProdutos(filtrados))} className={`${botao} border-2 border-slate-200 text-[#0F2053] hover:border-[#0478CA]`}>
                <Icon name="sheet" className="w-5 h-5" /> Produtos somados (Excel)
              </button>
              {(res.pendencias.length > 0 || res.avisos.length > 0) && (
                <button type="button" onClick={() => baixarTexto('pendencias-agil.csv', csvPendencias(res.pendencias, res.avisos))} className={`${botao} border-2 border-red-200 text-red-800 hover:border-red-400`}>
                  Pendências (Excel)
                </button>
              )}
            </div>
          </div>

          {/* Lista */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div role="tablist" aria-label="Ver" className="grid grid-cols-2 p-1 rounded-xl bg-slate-200/60">
              {(
                [
                  ['processos', 'Por órgão e processo'],
                  ['produtos', 'Produtos ganhos'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={aba === v}
                  onClick={() => setAba(v)}
                  className={`px-4 py-2 rounded-lg text-[15px] font-bold cursor-pointer ${aba === v ? 'bg-white text-[#0F2053] shadow-sm' : 'text-slate-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div role="group" aria-label="Situação" className="flex flex-wrap gap-2">
              {(
                [
                  ['todos', 'Todos'],
                  ['vigente', 'Válidos'],
                  ['vencendo', 'Vencendo'],
                  ['vencido', 'Vencidos'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={filtroVig === v}
                  onClick={() => setFiltroVig(v)}
                  className={`px-3.5 py-2 rounded-full text-sm font-semibold border cursor-pointer ${
                    filtroVig === v ? 'bg-[#0F2053] border-[#0F2053] text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-[#0478CA]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="relative flex-1 min-w-[14rem]">
              <span className="sr-only">Filtrar</span>
              <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Filtrar por órgão, processo ou produto"
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 text-base bg-white focus:outline-none focus:border-[#0478CA]"
              />
            </label>
          </div>

          {aba === 'processos' ? (
            <div className="mt-4 space-y-6">
              {porOrgao.map(([orgao, ps]) => (
                <section key={orgao}>
                  <h2 className="text-lg font-bold text-[#0F2053]">
                    {orgao} <span className="text-slate-500 font-semibold text-base">· {moeda(ps.reduce((s, p) => s + (p.valorAgil || 0), 0))}</span>
                  </h2>
                  <ul className="mt-2 space-y-3">
                    {ps.map((p) => (
                      <Processo key={p.chave} p={p} />
                    ))}
                  </ul>
                </section>
              ))}
              {!filtrados.length && <p className="p-6 rounded-2xl bg-white border border-slate-200 text-center text-slate-600">Nenhum processo encontrado.</p>}
            </div>
          ) : (
            <Produtos processos={filtrados} />
          )}
        </>
      )}
    </div>
  );
}

function PreviaOps({ ops }: { ops: any[] }) {
  const moves = ops.filter((o) => o.op === 'mover');
  return (
    <details className="mt-3 text-sm text-slate-700">
      <summary className="font-bold cursor-pointer">Ver as {moves.length} mudanças</summary>
      <ul className="mt-2 max-h-72 overflow-auto space-y-1 pr-2">
        {moves.map((o) => (
          <li key={o.id}>
            {o.nomeAntes}
            {o.nome && o.nome !== o.nomeAntes ? (
              <>
                {' '}
                → <strong>{o.nome}</strong>
              </>
            ) : (
              ' → Outros'
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Processo({ p }: { p: any }) {
  const [aberto, setAberto] = useState(false);
  const v = vigencia(p);
  const alerta = p.conferido === false || !p.agilVenceu || v.situacao === 'vencendo' || v.situacao === 'vencido';
  return (
    <li className={`rounded-2xl bg-white border ${v.situacao === 'vencido' ? 'border-red-300' : alerta ? 'border-amber-300' : 'border-slate-200'}`}>
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="w-full text-left p-4 sm:p-5 cursor-pointer">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="px-2.5 py-1 rounded-full bg-[#0478CA]/10 text-[#0478CA] font-bold">Processo {rotulo(p)}</span>
          {p.edital && (
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">
              {p.modalidade} {String(Number(p.edital.numero)).padStart(3, '0')}/{p.edital.ano}
            </span>
          )}
          <span className={`px-2.5 py-1 rounded-full font-semibold ${p.termoUsado === 'homologacao' ? 'bg-emerald-50 text-emerald-800' : 'bg-violet-50 text-violet-800'}`}>
            {p.termos.map((t: any) => (t.tipo === 'homologacao' ? 'Homologação' : 'Adjudicação')).filter((x: string, i: number, a: string[]) => a.indexOf(x) === i).join(' + ')}
          </span>
          <span className={`px-2.5 py-1 rounded-full font-bold ${COR_SITUACAO[v.situacao as Situacao]}`}>{textoVigencia(v)}</span>
          {p.conferido === false && <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold">Soma dos itens diferente do total</span>}
          {!p.agilVenceu && <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold">AGIL não aparece como vencedora</span>}
          <span className="ml-auto text-lg font-bold text-[#0F2053] tabular-nums">{moeda(p.valorAgil)}</span>
        </div>
        <p className="mt-2 text-[15px] text-slate-700 line-clamp-2">{p.objeto}</p>
        <p className="mt-2 text-sm text-slate-500">
          {p.dataPregao && <>Pregão: {dataBR(p.dataPregao, true)} · </>}
          {p.dataHomologacao ? <>Homologação: {dataBR(p.dataHomologacao, true)}</> : <>Termo: {dataBR(p.dataTermo, true) || '—'}</>}
          {v.validoAte && <> · Válido até {dataBR(v.validoAte)}</>}
          {p.dataDocumento && <> · Documento: {dataBR(p.dataDocumento)}</>} · {p.itens.length} {p.itens.length === 1 ? 'item' : 'itens'}
        </p>
      </button>
      {aberto && (
        <div className="px-4 sm:px-5 pb-5">
          <div className="flex flex-wrap gap-3 text-sm">
            {p.pasta?.link && (
              <a href={p.pasta.link} target="_blank" rel="noopener noreferrer" className="font-bold text-[#0478CA] underline">
                Abrir pasta do processo
              </a>
            )}
            {p.termos.map((t: any) => (
              <a key={t.id} href={t.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0478CA] underline">
                {t.nome}
              </a>
            ))}
          </div>
          {p.itens.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-3 font-semibold">Lote</th>
                    <th className="py-2 pr-3 font-semibold">Item</th>
                    <th className="py-2 pr-3 font-semibold text-right">Qtde</th>
                    <th className="py-2 pr-3 font-semibold text-right">Unitário</th>
                    <th className="py-2 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {p.itens.map((it: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-3 tabular-nums">{it.lote}</td>
                      <td className="py-2 pr-3">
                        <TextoCurto texto={it.descricao} />
                        {(it.marca || it.modelo) && (
                          <span className="block text-slate-500">
                            {[it.marca && `Marca: ${it.marca}`, it.fabricante && it.fabricante !== it.marca && `Fabricante: ${it.fabricante}`, it.modelo && `Modelo: ${it.modelo}`]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                        {it.conferir && <span className="block text-amber-800 font-semibold">Quantidade × unitário não bate com o total</span>}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">
                        {qtd(it.quantidade)} {it.medida}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">{moeda(it.unitario)}</td>
                      <td className="py-2 text-right tabular-nums whitespace-nowrap font-semibold">{moeda(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">O termo não traz a lista de itens da AGIL.</p>
          )}
        </div>
      )}
    </li>
  );
}

function Produtos({ processos }: { processos: any[] }) {
  const lista = useMemo(() => consolidarProdutos(processos), [processos]);
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl bg-white border border-slate-200">
      <table className="w-full min-w-[62rem] text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-200">
            <th className="p-3 font-semibold">Produto</th>
            <th className="p-3 font-semibold text-right">Quantidade</th>
            <th className="p-3 font-semibold text-right whitespace-nowrap">Preço unitário</th>
            <th className="p-3 font-semibold text-right">Valor total</th>
            <th className="p-3 font-semibold">Processos</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((g, i) => (
            <tr key={i} className="border-b border-slate-100 align-top">
              <td className="p-3">
                <TextoCurto texto={g.descricao} />
                {g.marcas.length > 0 && <span className="block text-slate-500">Marca: {g.marcas.join(', ')}</span>}
              </td>
              <td className="p-3 text-right tabular-nums whitespace-nowrap">
                {qtd(g.quantidade)} {g.medida}
              </td>
              <td className="p-3 text-right tabular-nums whitespace-nowrap">
                {g.precoMin === g.precoMax ? moeda(g.precoMin) : `${moeda(g.precoMin)} – ${moeda(g.precoMax)}`}
              </td>
              <td className="p-3 text-right tabular-nums whitespace-nowrap font-semibold">{moeda(g.valor)}</td>
              <td className="p-3 min-w-[17rem]">
                <ul className="space-y-1">
                  {g.lista.map((x: any) => (
                    <li key={`${x.orgao}${x.processo}`} className="flex flex-wrap items-center gap-1.5">
                      <span className="text-slate-700">
                        {x.orgao} · <strong className="tabular-nums">{x.processo}</strong>
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${COR_SITUACAO[x.situacao as Situacao]}`}>
                        {x.situacao === 'vencido' ? 'vencido' : x.situacao === 'vencendo' ? 'vencendo' : x.situacao === 'vigente' ? 'válido' : 'sem data'}
                        {x.validoAte ? ` · ${dataBR(x.validoAte)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!lista.length && <p className="p-6 text-center text-slate-600">Nenhum produto.</p>}
    </div>
  );
}

function Configuracao({
  clientId,
  pastaId,
  onSalvar,
  onCancelar,
  onSair,
}: {
  clientId: string;
  pastaId: string;
  onSalvar: (c: string, p: string) => void;
  onCancelar?: () => void;
  onSair: () => void;
}) {
  const [c, setC] = useState(clientId);
  const [p, setP] = useState(pastaId);
  const origem = typeof window !== 'undefined' ? window.location.origin : '';
  return (
    <div className="max-w-3xl p-6 sm:p-8 rounded-2xl bg-white border border-slate-200">
      <h1 className="text-2xl font-bold font-display text-[#0F2053]">Configurar o acesso ao Google Drive</h1>
      <p className="mt-2 text-[15px] text-slate-600">
        Feito uma vez só. O Google exige um "Client ID" que autorize este site a pedir acesso ao Drive de quem fizer login.
      </p>
      <ol className="mt-4 text-[15px] text-slate-700 list-decimal pl-5 space-y-2">
        <li>
          Abra{' '}
          <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0478CA] underline">
            console.cloud.google.com
          </a>{' '}
          com a conta dona da pasta, crie um projeto e ative a <strong>Google Drive API</strong>.
        </li>
        <li>
          Em <strong>Tela de permissão OAuth</strong>: tipo "Externo", status "Em teste", e adicione o seu e-mail em <strong>Usuários de teste</strong>.
        </li>
        <li>
          Em <strong>Credenciais → Criar credenciais → ID do cliente OAuth</strong>: tipo "Aplicativo da Web" e, em <strong>Origens JavaScript autorizadas</strong>,
          coloque <code className="px-1.5 py-0.5 rounded bg-slate-100">{origem}</code>.
        </li>
        <li>Copie o ID do cliente (termina em .apps.googleusercontent.com) e cole abaixo.</li>
      </ol>
      <label className="block mt-6">
        <span className="text-sm font-semibold text-slate-700">Client ID do Google</span>
        <input
          value={c}
          onChange={(e) => setC(e.target.value)}
          placeholder="123456789-xxxx.apps.googleusercontent.com"
          className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-300 text-base focus:outline-none focus:border-[#0478CA]"
        />
      </label>
      <label className="block mt-4">
        <span className="text-sm font-semibold text-slate-700">Pasta das licitações (link ou ID)</span>
        <input value={p} onChange={(e) => setP(e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-300 text-base focus:outline-none focus:border-[#0478CA]" />
      </label>
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!/\.apps\.googleusercontent\.com$/.test(c.trim())}
          onClick={() => onSalvar(c.trim(), idDoLink(p) || PASTA_LICITACOES_ID)}
          className={`${botao} bg-[#0478CA] hover:bg-[#03609F] text-white`}
        >
          Salvar
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} className={`${botao} border-2 border-slate-300 text-slate-700`}>
            Cancelar
          </button>
        )}
        <button type="button" onClick={onSair} className={`${botao} ml-auto border-2 border-slate-200 text-slate-700`}>
          Sair
        </button>
      </div>
    </div>
  );
}
