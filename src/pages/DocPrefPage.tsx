// /docpref/: conferência mensal dos documentos das prestadoras de serviço (co-responsabilidade da tomadora).
// O GitHub Actions lê a pasta compartilhada (uma pasta por prestadora, uma subpasta por mês) e publica
// docpref/leitura.json; aqui cada prestadora ganha o relatório mês a mês, o semáforo do pagamento, as
// notificações e os PDFs no modelo "AGIL ANÁLISE DOCUMENTAL". As marcações da equipe ficam neste navegador.
import { useEffect, useMemo, useRef, useState } from 'react';
import Header from '../components/Header.tsx';
import { Container, Icon } from '../components/ui.tsx';
import { COMPANY_PROFILE } from '../data/servicesData.ts';
import {
  GRUPOS,
  PAGAMENTO,
  SITUACOES,
  STATUS,
  VENCIMENTO,
  abasAno,
  abasFarol,
  abasMes,
  avaliarEmpresa,
  blocosNotificacao,
  blocosRelatorioGeral,
  blocosRelatorioMensal,
  compBR,
  competenciaAtual,
  dataBR,
  mensagemPendencias,
  moeda,
  nomeCompetencia,
  nomeSinal,
  performance,
  relatorioRapido,
  vencimentos,
} from '../lib/docpref.js';
import { PASTAS_DO_MES, abasForcaDeTrabalho, blocosCartilha } from '../lib/docprefCartilha.js';
import { norm } from '../lib/docprefLeitor.js';
import {
  atualizarConferencia,
  chaveConferencia,
  exportarDocPref,
  importarDocPref,
  naoAplicaSempre,
  removerPrestadora,
  salvarConfig,
  salvarPrestadora,
  useDocPref,
  type ConfigDocPref,
  type Conferencia,
  type Prestadora,
} from '../lib/docprefStore.ts';
import { dateText, downloadPdf, slug } from '../lib/pdfReport.ts';
import { baixarXlsx } from '../lib/xlsx.js';

type Aba = 'empresas' | 'farol' | 'cadastro' | 'cartilha' | 'como';
type Avaliacao = ReturnType<typeof avaliarEmpresa>[number];
type Sinal = 'pagar' | 'aguardando' | 'travar' | 'futuro' | 'fora';
interface ArquivoLido {
  rotulo: string;
  categoria: string;
  pasta: string;
  tipo?: string;
  comp?: string;
  [k: string]: unknown;
}
interface EmpresaDrive {
  id: string;
  nome: string;
  razao?: string | null;
  cnpj?: string | null;
  contrato?: string | null;
  meses: { comp: string; pasta: string; pessoas?: Record<string, number>; arquivos: ArquivoLido[] }[];
  /** arquivos fora das pastas de mês (PGR, contrato social, certidões guardadas na pasta da empresa) */
  documentos?: ArquivoLido[];
}
interface Leitura {
  atualizadoEm: string;
  pasta?: string;
  ignoradas?: string[];
  empresas: EmpresaDrive[];
}
interface Unida {
  chave: string;
  nome: string;
  razao: string;
  cnpj: string;
  contrato: string;
  prestadora?: Prestadora;
  drive?: EmpresaDrive;
}

const card = 'p-5 sm:p-6 rounded-2xl bg-white border border-slate-200';
const botao =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const botaoSec = `${botao} border-2 border-slate-200 text-[#0F2053] hover:border-[#0478CA] bg-white`;
const campo =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-[15px] focus:outline-none focus:border-[#0478CA] focus:ring-2 focus:ring-[#0478CA]/20';
const SINAL: Record<Sinal, { cor: string; ponto: string }> = {
  pagar: { cor: 'bg-emerald-50 border-emerald-300 text-emerald-900', ponto: 'bg-emerald-600' },
  aguardando: { cor: 'bg-amber-50 border-amber-300 text-amber-900', ponto: 'bg-amber-500' },
  travar: { cor: 'bg-red-50 border-red-300 text-red-900', ponto: 'bg-red-600' },
  futuro: { cor: 'bg-slate-50 border-slate-200 text-slate-700', ponto: 'bg-slate-300' },
  fora: { cor: 'bg-slate-50 border-slate-200 text-slate-500', ponto: 'bg-slate-200' },
};
const TOMADORA = { nome: COMPANY_PROFILE.name, email: COMPANY_PROFILE.email, phoneDisplay: COMPANY_PROFILE.phoneDisplay, domain: COMPANY_PROFILE.domain };
const digitos = (s?: string | null) => String(s || '').replace(/\D/g, '');
const hojeISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

/** Junta as prestadoras lidas no Drive com as cadastradas aqui (pelo nome da pasta, CNPJ ou razão social) */
function unir(leitura: Leitura | null, prestadoras: Prestadora[]): Unida[] {
  const usadas = new Set<string>();
  const out: Unida[] = [];
  for (const e of leitura?.empresas || []) {
    const p = prestadoras.find(
      (x) =>
        !usadas.has(x.id) &&
        ((x.drive && norm(x.drive) === norm(e.nome)) ||
          (digitos(x.cnpj) && digitos(x.cnpj) === digitos(e.cnpj)) ||
          (norm(e.nome).length >= 4 && ` ${norm(x.razao)} `.includes(` ${norm(e.nome)} `))),
    );
    if (p) usadas.add(p.id);
    out.push({
      chave: p ? p.id : `drive:${e.id}`,
      nome: p?.razao || e.nome,
      razao: p?.razao || e.razao || '',
      cnpj: p?.cnpj || e.cnpj || '',
      contrato: p?.contrato || e.contrato || '',
      prestadora: p,
      drive: e,
    });
  }
  for (const p of prestadoras.filter((x) => !usadas.has(x.id)))
    out.push({ chave: p.id, nome: p.razao, razao: p.razao, cnpj: p.cnpj, contrato: p.contrato, prestadora: p });
  return out;
}

export default function DocPrefPage() {
  const [aba, setAba] = useState<Aba>(() => (location.hash === '#cartilha' ? 'cartilha' : 'empresas'));
  const dados = useDocPref();
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [estadoLeitura, setEstadoLeitura] = useState<'carregando' | 'ok' | 'sem'>('carregando');

  useEffect(() => {
    let vivo = true;
    fetch(`${import.meta.env.BASE_URL}docpref/leitura.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!vivo) return;
        if (j && Array.isArray(j.empresas)) {
          setLeitura(j);
          setEstadoLeitura('ok');
        } else setEstadoLeitura('sem');
      })
      .catch(() => vivo && setEstadoLeitura('sem'));
    return () => {
      vivo = false;
    };
  }, []);

  const empresas = useMemo(() => unir(leitura, dados.prestadoras), [leitura, dados.prestadoras]);
  const hoje = hojeISO();
  const avaliacoes = useMemo(
    () =>
      new Map(
        empresas.map((e) => {
          const confs: Record<string, any> = {};
          for (const [k, v] of Object.entries(dados.conferencias)) if (k.startsWith(`${e.chave}|`)) confs[k.slice(e.chave.length + 1)] = v;
          return [
            e.chave,
            avaliarEmpresa(e.drive || { meses: [] }, {
              hoje,
              dia: e.prestadora?.dia || 0,
              inicio: e.prestadora?.inicio || undefined,
              conferencias: confs,
              naoAplica: dados.ajustes[e.chave]?.naoAplica,
            }),
          ];
        }),
      ),
    [empresas, dados.conferencias, dados.ajustes, hoje],
  );
  // o endereço guarda a prestadora e o mês abertos (#empresa=drive:pilar&mes=2026-07): dá para voltar direto ao relatório
  const doEndereco = () => new URLSearchParams(location.hash.replace(/^#/, ''));
  const [sel, setSel] = useState(() => doEndereco().get('empresa') || '');
  const [comp, setComp] = useState(() => doEndereco().get('mes') || '');
  // link colado na mesma aba (#empresa=...&mes=...) também abre o relatório
  useEffect(() => {
    const aoMudar = () => {
      if (location.hash === '#cartilha') return setAba('cartilha');
      const q = doEndereco();
      if (!q.get('empresa')) return;
      setAba('empresas');
      setSel(q.get('empresa') || '');
      setComp(q.get('mes') || '');
    };
    window.addEventListener('hashchange', aoMudar);
    return () => window.removeEventListener('hashchange', aoMudar);
  }, []);
  useEffect(() => {
    if (aba !== 'empresas') return;
    const q = new URLSearchParams();
    if (sel) q.set('empresa', sel);
    if (comp) q.set('mes', comp);
    const novo = q.toString() ? `#${q.toString()}` : '';
    if (location.hash !== novo) history.replaceState(null, '', `${location.pathname}${location.search}${novo}`);
  }, [aba, sel, comp]);

  return (
    <>
      <Header page="docpref" />
      <main id="conteudo" className="bg-[#F4F7FB] min-h-screen py-10 sm:py-14">
        <Container>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#0F2053]">DocPref</h1>
          <p className="mt-1 max-w-3xl text-[15px] text-slate-600 leading-relaxed">
            Documentos mensais das empresas contratadas. Quem contrata responde junto se a contratada não pagar salários, INSS ou FGTS (nos contratos públicos,
            art. 121 da Lei 14.133/2021); por isso cada contratada comprova, todo mês, que está em dia. O DocPref lê a pasta de cada uma no Google Drive,
            confere documentos, guias, pagamentos e prazos legais, e diz quando pode pagar.
          </p>
          <div role="tablist" aria-label="DocPref" className="mt-6 flex flex-wrap gap-2">
            {(
              [
                ['empresas', `Prestadoras e meses${empresas.length ? ` (${empresas.length})` : ''}`, 'calendar'],
                ['farol', 'Farol e vencimentos', 'chart'],
                ['cadastro', 'Cadastro', 'building'],
                ['cartilha', 'Cartilha do fornecedor', 'doc'],
                ['como', 'Como funciona', 'shield'],
              ] as const
            ).map(([id, nome, icone]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={aba === id}
                onClick={() => setAba(id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-bold border-2 transition-colors cursor-pointer ${
                  aba === id ? 'bg-[#0F2053] border-[#0F2053] text-white' : 'bg-white border-slate-200 text-[#0F2053] hover:border-[#0478CA]'
                }`}
              >
                <Icon name={icone} className="w-5 h-5" />
                {nome}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="mt-6">
            {aba === 'empresas' && (
              <Empresas
                empresas={empresas}
                avaliacoes={avaliacoes}
                config={dados.config}
                ajustes={dados.ajustes}
                leitura={leitura}
                estadoLeitura={estadoLeitura}
                sel={sel}
                setSel={setSel}
                comp={comp}
                setComp={setComp}
                irParaCadastro={() => setAba('cadastro')}
              />
            )}
            {aba === 'farol' && (
              <Farol
                empresas={empresas}
                avaliacoes={avaliacoes}
                config={dados.config}
                atualizadoEm={leitura?.atualizadoEm || ''}
                abrir={(chave, c) => {
                  setSel(chave);
                  setComp(c);
                  setAba('empresas');
                }}
              />
            )}
            {aba === 'cadastro' && <Cadastro prestadoras={dados.prestadoras} config={dados.config} nomesDrive={(leitura?.empresas || []).map((e) => e.nome)} />}
            {aba === 'cartilha' && <Cartilha config={dados.config} />}
            {aba === 'como' && <ComoFunciona />}
          </div>
        </Container>
      </main>
    </>
  );
}

// ---------------------------------------------------------------- prestadoras e meses

function Empresas({
  empresas,
  avaliacoes,
  config,
  ajustes,
  leitura,
  estadoLeitura,
  sel,
  setSel,
  comp,
  setComp,
  irParaCadastro,
}: {
  empresas: Unida[];
  avaliacoes: Map<string, Avaliacao[]>;
  config: ConfigDocPref;
  ajustes: Record<string, { naoAplica: string[] }>;
  leitura: Leitura | null;
  estadoLeitura: 'carregando' | 'ok' | 'sem';
  sel: string;
  setSel: (s: string) => void;
  comp: string;
  setComp: (c: string) => void;
  irParaCadastro: () => void;
}) {
  const atual = competenciaAtual();
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<'pior' | 'nome'>('pior');
  const travadosDe = (e: Unida) => (avaliacoes.get(e.chave) || []).filter((x) => x.sinal === 'travar').length;
  const visiveis = empresas
    .filter((e) => !busca.trim() || norm(`${e.nome} ${e.razao} ${e.cnpj}`).includes(norm(busca)) || digitos(e.cnpj).includes(digitos(busca) || '-'))
    .sort((a, b) => (ordem === 'pior' ? travadosDe(b) - travadosDe(a) : 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const escolhida = empresas.find((e) => e.chave === sel) || visiveis[0] || empresas[0] || null;
  const venc = useMemo(() => (escolhida?.drive ? vencimentos(escolhida.drive) : []), [escolhida]);
  // identificação da contratada + dados do contrato (contratante, fiscal, objeto) para relatórios e notificação
  const ident = escolhida
    ? {
        razao: escolhida.razao,
        cnpj: escolhida.cnpj,
        contrato: escolhida.contrato,
        contratante: config.contratante,
        fiscal: escolhida.prestadora?.fiscal,
        objeto: escolhida.prestadora?.objeto,
      }
    : {};
  const [rapido, setRapido] = useState<{ texto: string; blocos: any[] } | null>(null);
  useEffect(() => setRapido(null), [sel]);

  const avs = escolhida ? avaliacoes.get(escolhida.chave) || [] : [];
  const anos = [...new Set(avs.map((a) => a.comp.slice(0, 4)))];
  const compSel = avs.some((a) => a.comp === comp)
    ? comp
    : avs.find((a) => a.comp === atual)?.comp || avs.filter((a) => a.sinal !== 'futuro').at(-1)?.comp || '';
  const [ano, setAno] = useState('');
  const anoSel = anos.includes(ano) ? ano : compSel.slice(0, 4) || anos.at(-1) || '';
  const av = avs.find((a) => a.comp === compSel) || null;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600" role="status">
        {estadoLeitura === 'carregando'
          ? 'Lendo o resultado da pasta do Drive…'
          : estadoLeitura === 'ok' && leitura
            ? `Fonte: a pasta compartilhada${leitura.pasta ? ` “${leitura.pasta}”` : ''} no Google Drive, lida em ${new Date(leitura.atualizadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · ${leitura.empresas.length} ${leitura.empresas.length === 1 ? 'prestadora' : 'prestadoras'} · o site relê a pasta a cada 3 horas.${leitura.ignoradas?.length ? ` Pastas que não são prestadoras: ${leitura.ignoradas.join(', ')}.` : ''}`
            : 'A leitura da pasta do Drive ainda não foi publicada: falta configurar o segredo DOCPREF_PASTA_ID no GitHub (veja “Como funciona”).'}
      </p>

      {empresas.length > 6 && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="block flex-1 min-w-[12rem]">
            <span className="block text-sm font-bold text-slate-600 mb-1">Buscar prestadora</span>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, razão social ou CNPJ" className={campo} />
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-slate-600 mb-1">Ordem</span>
            <select value={ordem} onChange={(e) => setOrdem(e.target.value as 'pior' | 'nome')} className={campo}>
              <option value="pior">Mais pendências primeiro</option>
              <option value="nome">Nome</option>
            </select>
          </label>
        </div>
      )}

      {!empresas.length ? (
        <div className={`${card} text-center`}>
          <p className="text-lg font-bold text-[#0F2053]">Nenhuma prestadora ainda</p>
          <p className="mt-1 text-[15px] text-slate-600">Quando a pasta do Drive for lida, cada prestadora aparece aqui. Também dá para cadastrar à mão.</p>
          <button type="button" onClick={irParaCadastro} className={`${botao} mt-4 bg-[#0F2053] hover:bg-[#13306f] text-white`}>
            <Icon name="building" className="w-5 h-5" /> Cadastrar prestadora
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {!visiveis.length && <p className="text-[15px] text-slate-600">Nenhuma prestadora com esse nome.</p>}
          {visiveis.map((e) => {
            const lista = avaliacoes.get(e.chave) || [];
            const a = lista.find((x) => x.comp === atual) || lista.filter((x) => x.sinal !== 'futuro').at(-1);
            const travados = lista.filter((x) => x.sinal === 'travar').length;
            const ativa = escolhida?.chave === e.chave;
            return (
              <button
                key={e.chave}
                type="button"
                onClick={() => {
                  setSel(e.chave);
                  setComp('');
                }}
                aria-pressed={ativa}
                className={`min-w-0 w-full text-left p-4 rounded-2xl border-2 bg-white cursor-pointer transition-colors ${ativa ? 'border-[#0478CA]' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <span className="block font-bold text-[#0F2053]">{e.nome}</span>
                <span className="block text-sm text-slate-500 truncate">
                  {[e.cnpj && `CNPJ ${e.cnpj}`, e.contrato && `contrato ${e.contrato}`, e.drive ? 'pasta lida' : 'sem pasta lida'].filter(Boolean).join(' · ')}
                </span>
                {a && (
                  <span className="mt-2 flex flex-wrap items-center gap-x-2 text-sm">
                    <span className={`w-2.5 h-2.5 rounded-full ${SINAL[a.sinal as Sinal].ponto}`} aria-hidden="true" />
                    {compBR(a.comp)}: {nomeSinal(a.sinal)}
                    {travados ? (
                      <span className="text-red-700 font-semibold">
                        {' '}
                        · {travados} {travados === 1 ? 'mês travado' : 'meses travados'}
                      </span>
                    ) : null}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {escolhida && (
        <div className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold text-[#0F2053]">{escolhida.nome}</p>
              <p className="text-sm text-slate-500">
                {[
                  escolhida.razao && escolhida.razao !== escolhida.nome && escolhida.razao,
                  escolhida.cnpj && `CNPJ ${escolhida.cnpj}`,
                  escolhida.contrato && `contrato ${escolhida.contrato}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="text-sm text-slate-500">
                Prazo: {escolhida.prestadora?.dia ? `dia ${escolhida.prestadora.dia}` : 'último dia'} do mês seguinte à competência ·{' '}
                {(() => {
                  const inicio = avs.find((a) => a.sinal !== 'fora')?.comp;
                  return inicio
                    ? `início considerado: ${compBR(inicio)}${escolhida.prestadora?.inicio ? ' (cadastro)' : ' (primeiro mês com arquivos; ajuste no Cadastro)'}`
                    : '';
                })()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {anos.length > 1 && (
                <select value={anoSel} onChange={(e) => setAno(e.target.value)} aria-label="Ano" className={`${campo} w-28`}>
                  {anos.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() =>
                  downloadPdf(`docpref-${slug(escolhida.nome)}-${anoSel}.pdf`, `${escolhida.nome} - Relatório geral ${anoSel}`, [
                    { type: 'date', text: dateText() },
                    ...(blocosRelatorioGeral(escolhida.nome, anoSel, avs, {
                      dia: escolhida.prestadora?.dia || 0,
                      atualizadoEm: leitura?.atualizadoEm,
                      ...ident,
                    }) as any),
                  ])
                }
                className={`${botao} bg-[#0F2053] hover:bg-[#13306f] text-white`}
              >
                <Icon name="doc" className="w-5 h-5" /> Relatório geral {anoSel} (PDF)
              </button>
              <button
                type="button"
                onClick={() => baixarXlsx(`docpref-${slug(escolhida.nome)}-${anoSel}.xlsx`, abasAno(escolhida.nome, anoSel, avs))}
                className={botaoSec}
              >
                <Icon name="sheet" className="w-5 h-5" /> Excel {anoSel}
              </button>
              <button
                type="button"
                onClick={() =>
                  setRapido(
                    relatorioRapido([{ nome: escolhida.nome, ident, avs, venc }], { atualizadoEm: leitura?.atualizadoEm, contratante: config.contratante }),
                  )
                }
                className={botaoSec}
              >
                <Icon name="check" className="w-5 h-5" /> Relatório rápido
              </button>
              {escolhida.prestadora?.pasta && (
                <a href={escolhida.prestadora.pasta} target="_blank" rel="noopener noreferrer" className={botaoSec}>
                  Pasta no Drive <Icon name="arrow" className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {rapido && (
            <PainelRapido
              conteudo={rapido}
              arquivo={`docpref-rapido-${slug(escolhida.nome)}`}
              titulo={`Relatório rápido - ${escolhida.nome}`}
              fechar={() => setRapido(null)}
            />
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-[#F7FAFD] text-left text-sm text-slate-500">
                <tr>
                  <th className="px-2 py-2 font-semibold">Mês</th>
                  <th className="px-2 py-2 font-semibold">Envio até</th>
                  <th className="px-2 py-2 font-semibold text-right">Arquivos</th>
                  <th className="px-2 py-2 font-semibold text-right">Recebidos</th>
                  <th className="px-2 py-2 font-semibold text-right">% regular.</th>
                  <th className="px-2 py-2 font-semibold text-right">Não localizados</th>
                  <th className="px-2 py-2 font-semibold text-right">Divergências</th>
                  <th className="px-2 py-2 font-semibold text-right">Certidões</th>
                  <th className="px-2 py-2 font-semibold">Semáforo</th>
                  <th className="px-2 py-2 font-semibold">Relatório</th>
                </tr>
              </thead>
              <tbody>
                {avs
                  .filter((a) => a.comp.startsWith(anoSel))
                  .map((a) => {
                    const neutro = a.sinal === 'futuro' || a.sinal === 'fora';
                    const n = (v: number) => (neutro ? '-' : v);
                    return (
                      <tr
                        key={a.comp}
                        onClick={() => setComp(a.comp)}
                        className={`border-t border-slate-100 cursor-pointer ${a.comp === compSel ? 'bg-[#0478CA]/5' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-2 py-2 font-semibold text-[#0F2053]">
                          <button type="button" onClick={() => setComp(a.comp)} className="underline-offset-2 hover:underline cursor-pointer">
                            {compBR(a.comp)}
                          </button>
                        </td>
                        <td className="px-2 py-2 tabular-nums">{dataBR(a.prazo)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{a.resumo.arquivos}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{n(a.resumo.recebidos)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{a.regularidade == null ? '-' : `${a.regularidade}%`}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{n(a.resumo.naoLocalizados)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{n(a.resumo.divergencias)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{n(a.resumo.certPendentes)}</td>
                        <td className="px-2 py-2">
                          <span className="inline-flex items-start gap-2">
                            <span className={`mt-1 shrink-0 w-2.5 h-2.5 rounded-full ${SINAL[a.sinal as Sinal].ponto}`} aria-hidden="true" />
                            {nomeSinal(a.sinal)}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          {!(a.sinal === 'fora') && (
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                downloadPdf(`docpref-${slug(escolhida.nome)}-${a.comp}.pdf`, `${escolhida.nome} - Relatório mensal ${compBR(a.comp)}`, [
                                  { type: 'date', text: dateText() },
                                  ...(blocosRelatorioMensal(escolhida.nome, a, {
                                    atualizadoEm: leitura?.atualizadoEm,
                                    dia: escolhida.prestadora?.dia || 0,
                                    ...ident,
                                  }) as any),
                                ]);
                              }}
                              aria-label={`Relatório de ${compBR(a.comp)} em PDF`}
                              className="text-sm font-bold text-[#0478CA] underline cursor-pointer"
                            >
                              PDF
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Clique num mês para ver o que chegou, o que falta e os achados.
            {(() => {
              const p = performance(avs.filter((a) => a.comp.startsWith(anoSel)));
              return p.exigidos
                ? ` Regularidade em ${anoSel}: ${p.regularidade}% (${p.recebidos} de ${p.exigidos} exigências, meses com prazo encerrado).`
                : '';
            })()}
          </p>
          {venc.length > 0 && <ListaVencimentos venc={venc} />}
          {(escolhida.drive?.documentos?.length || 0) > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-[15px] font-bold text-[#0478CA]">
                Documentos fora das pastas de mês ({escolhida.drive!.documentos!.length})
              </summary>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {escolhida.drive!.documentos!.map((d, k) => (
                  <li key={k}>
                    {d.rotulo} <span className="text-slate-500">· {d.pasta}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {escolhida && av && (
        <MesDetalhe
          empresa={escolhida}
          av={av}
          atualizadoEm={leitura?.atualizadoEm || ''}
          cfg={{ ...ident, prazoRegularizacao: config.prazoRegularizacao }}
          naoAplica={ajustes[escolhida.chave]?.naoAplica || []}
        />
      )}
    </div>
  );
}

function MesDetalhe({
  empresa,
  av,
  atualizadoEm,
  cfg,
  naoAplica,
}: {
  empresa: Unida;
  av: ReturnType<typeof avaliarEmpresa>[number];
  atualizadoEm: string;
  cfg: { contratante?: string; fiscal?: string; objeto?: string; prazoRegularizacao?: number };
  naoAplica: string[];
}) {
  const [copiado, setCopiado] = useState(false);
  const chave = empresa.chave;
  const mudarItem = (id: string, status: string, motivo?: string) =>
    atualizarConferencia(chave, av.comp, (c) => ({
      ...c,
      itens: {
        ...c.itens,
        [id]: { status: status as 'pendente', motivo: motivo ?? c.itens[id]?.motivo, em: status === 'pendente' ? undefined : new Date().toISOString() },
      },
    }));
  const mudarSituacao = (id: string, v: boolean | null) =>
    atualizarConferencia(chave, av.comp, (c) => {
      const situacoes = { ...c.situacoes };
      if (v === null) delete situacoes[id];
      else situacoes[id] = v;
      return { ...c, situacoes };
    });
  const prest = { razao: empresa.razao || empresa.nome, cnpj: empresa.cnpj, contrato: empresa.contrato };
  const mensagem = mensagemPendencias(prest, av, cfg);
  const mudarSempre = (id: string, sim: boolean) => {
    naoAplicaSempre(chave, id, sim);
    if (sim) mudarItem(id, 'pendente');
  };
  const neutro = av.sinal === 'futuro' || av.sinal === 'fora';
  const confManual = useDocPref().conferencias[chaveConferencia(chave, av.comp)];

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-[#0F2053]">
            {empresa.nome} · {nomeCompetencia(av.comp)}
          </p>
          <p className="text-sm text-slate-500">
            Folha e guias de {compBR(av.comp)} · envio até {dataBR(av.prazo)} · {av.resumo.arquivos} {av.resumo.arquivos === 1 ? 'arquivo' : 'arquivos'} na
            pasta
            {av.pastaExiste ? '' : ' (a pasta do mês não existe)'}
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            downloadPdf(`docpref-${slug(empresa.nome)}-${av.comp}.pdf`, `${empresa.nome} - Relatório mensal ${compBR(av.comp)}`, [
              { type: 'date', text: dateText() },
              ...(blocosRelatorioMensal(empresa.nome, av, {
                atualizadoEm,
                dia: empresa.prestadora?.dia || 0,
                razao: empresa.razao,
                cnpj: empresa.cnpj,
                contrato: empresa.contrato,
              }) as any),
            ])
          }
          className={`${botao} bg-[#0F2053] hover:bg-[#13306f] text-white`}
        >
          <Icon name="doc" className="w-5 h-5" /> Relatório do mês (PDF)
        </button>
        <button type="button" onClick={() => baixarXlsx(`docpref-${slug(empresa.nome)}-${av.comp}.xlsx`, abasMes(av))} className={botaoSec}>
          <Icon name="sheet" className="w-5 h-5" /> Excel do mês
        </button>
      </div>

      <p role="status" className={`mt-4 p-4 rounded-xl border text-[15px] font-bold ${SINAL[av.sinal as Sinal].cor}`}>
        {av.titulo}
        {!neutro && (
          <span className="block text-sm font-normal">
            {av.conferidos} de {av.total} exigências recebidas
            {av.diasParaPrazo >= 0
              ? ` · faltam ${av.diasParaPrazo} ${av.diasParaPrazo === 1 ? 'dia' : 'dias'} para o prazo`
              : ` · prazo encerrado em ${dataBR(av.prazo)}`}
          </span>
        )}
      </p>

      {av.indicadores.temPlanilha && (
        <div className="mt-5">
          <p className="text-sm font-bold text-slate-600 mb-2">Indicadores do mês (planilha de força de trabalho)</p>
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {(
              [
                ['Ativos', av.indicadores.ativos],
                ['Admissões/alocações', av.indicadores.admissoes],
                ['Desligamentos', av.indicadores.demissoes],
                ['Afastados', av.indicadores.afastados],
                ['Turnover', av.indicadores.turnover == null ? '-' : `${String(av.indicadores.turnover).replace('.', ',')}%`],
                ['Acidente no mês', av.indicadores.acidente == null ? 'sem informação' : av.indicadores.acidente ? 'houve' : 'não houve'],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="px-3 py-2 rounded-xl border border-slate-200">
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="text-lg font-bold text-[#0F2053] tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {!neutro && av.resumo.arquivos > 0 && av.pagamentos.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-bold text-slate-600 mb-2">Guias e pagamentos</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="px-2 py-1.5 font-semibold">Obrigação</th>
                  <th className="px-2 py-1.5 font-semibold text-right">Guia / folha</th>
                  <th className="px-2 py-1.5 font-semibold text-right">Comprovantes</th>
                  <th className="px-2 py-1.5 font-semibold">Situação</th>
                  <th className="px-2 py-1.5 font-semibold">Providência</th>
                </tr>
              </thead>
              <tbody>
                {av.pagamentos.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 align-top">
                    <td className="px-2 py-1.5 font-semibold text-[#0F2053]">{p.nome}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{p.guia ? moeda(p.guia) : '-'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{p.pago ? moeda(p.pago) : '-'}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-lg border text-xs font-semibold ${PAGAMENTO[p.situacao as keyof typeof PAGAMENTO].cor}`}
                      >
                        {PAGAMENTO[p.situacao as keyof typeof PAGAMENTO].nome}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-slate-600">
                      {p.texto}
                      {p.ocr ? ' (lido por OCR)' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(av.prazosLegais.length > 0 || av.cobertura.temPlanilha) && (
        <div className="mt-5 grid lg:grid-cols-2 gap-4">
          {av.prazosLegais.length > 0 && (
            <div>
              <p className="text-sm font-bold text-slate-600 mb-2">Prazos legais</p>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {av.prazosLegais.map((p) => (
                  <li key={p.id} className="px-3 py-2 flex items-start justify-between gap-3">
                    <span className="min-w-0 text-[15px] text-slate-800">
                      {p.nome}
                      <span className="block text-sm text-slate-500">{p.texto}</span>
                    </span>
                    <span
                      className={`shrink-0 px-2.5 py-1 rounded-lg border text-sm font-semibold ${
                        p.situacao === 'ok'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : p.situacao === 'atraso'
                            ? 'bg-red-50 text-red-800 border-red-300'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {p.situacao === 'ok'
                        ? 'No prazo'
                        : p.situacao === 'atraso'
                          ? 'Fora do prazo'
                          : p.situacao === 'retificadora'
                            ? 'Retificadora'
                            : 'Sem data'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {av.cobertura.temPlanilha && (
            <div>
              <p className="text-sm font-bold text-slate-600 mb-2">Pessoas do mês</p>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-[15px]">
                {(
                  [
                    [
                      'Empregados ativos na planilha',
                      `${av.cobertura.ativos}${av.cobertura.devidos !== av.cobertura.ativos ? ` (${av.cobertura.devidos} sem afastados)` : ''}`,
                      false,
                    ],
                    [
                      'Pagamentos de salário',
                      `${av.cobertura.pagamentos}${av.cobertura.holerites ? ` + ${av.cobertura.holerites} holerite(s)` : ''}`,
                      av.cobertura.devidos != null && av.cobertura.pagamentos < av.cobertura.devidos,
                    ],
                    [
                      'Arquivos de ponto',
                      String(av.cobertura.ponto),
                      av.cobertura.devidos != null && av.cobertura.ponto > 1 && av.cobertura.ponto < av.cobertura.devidos,
                    ],
                    ...(['admissoes', 'demissoes'] as const).map((k) => {
                      const c = av.cobertura[k];
                      const v = [c.planilha, c.declaracao, c.pastas].filter((x) => x != null);
                      return [
                        k === 'admissoes' ? 'Admissões/alocações' : 'Desligamentos',
                        [
                          c.planilha != null && `planilha ${c.planilha}`,
                          c.declaracao != null && `declaração ${c.declaracao}`,
                          c.pastas != null && `subpastas ${c.pastas}`,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '-',
                        v.length >= 2 && new Set(v).size > 1,
                      ] as [string, string, boolean];
                    }),
                  ] as [string, string, boolean][]
                ).map(([k, v, alerta]) => (
                  <li key={k} className="px-3 py-2 flex items-center justify-between gap-3">
                    <span className="text-slate-700">{k}</span>
                    <span className={`tabular-nums font-semibold ${alerta ? 'text-red-700' : 'text-[#0F2053]'}`}>{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {av.achados.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-bold text-slate-600 mb-2">Achados da leitura</p>
          <ul className="space-y-1.5">
            {av.achados.map((a, i) => (
              <li
                key={i}
                className={`px-3 py-2 rounded-xl border text-[15px] ${a.nivel === 'alerta' ? 'border-orange-200 bg-orange-50 text-orange-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
              >
                <strong>{a.titulo}.</strong> {a.texto}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <p className="text-sm font-bold text-slate-600 mb-2">No mês</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {SITUACOES.map((q) => {
            const s = av.situacoes[q.id];
            const manual = confManual?.situacoes?.[q.id];
            const val = typeof manual === 'boolean' ? manual : null;
            return (
              <div key={q.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-slate-200">
                <span className="text-[15px] text-slate-700">
                  {q.pergunta}
                  <span className="block text-xs text-slate-500">{s.valor == null ? 'sem informação' : `${s.valor ? 'sim' : 'não'} · ${s.fonte}`}</span>
                </span>
                <span className="flex shrink-0 rounded-lg bg-slate-100 p-0.5" role="group" aria-label={q.pergunta}>
                  {(
                    [
                      [false, 'Não'],
                      [null, 'Auto'],
                      [true, 'Sim'],
                    ] as const
                  ).map(([v, nome]) => (
                    <button
                      key={nome}
                      type="button"
                      aria-pressed={val === v}
                      onClick={() => mudarSituacao(q.id, v)}
                      className={`px-2.5 py-1 rounded-md text-sm font-bold cursor-pointer ${val === v ? 'bg-white text-[#0F2053] shadow-sm' : 'text-slate-500'}`}
                    >
                      {nome}
                    </button>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {GRUPOS.map((g) => {
          const itens = av.itens.filter((i) => i.grupo === g.id);
          if (itens.every((i) => i.status === 'na' && !i.evidencias.length && !i.manual)) return null;
          return (
            <div key={g.id}>
              <p className="text-[15px] font-extrabold text-[#0F2053]">Pasta “{g.pasta}”</p>
              <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {itens.map((i) => (
                  <ItemConferencia
                    key={i.id}
                    i={i}
                    manual={confManual?.itens?.[i.id]}
                    mudar={mudarItem}
                    sempre={naoAplica.includes(i.id)}
                    mudarSempre={mudarSempre}
                  />
                ))}
              </ul>
            </div>
          );
        })}
        <div>
          <p className="text-[15px] font-extrabold text-[#0F2053]">Certidões</p>
          <p className="text-sm text-slate-500">CRF todo mês; federal, estadual, municipal, CNDT e falência nos meses pares e sempre que vencerem.</p>
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {av.certidoes
              .filter((c) => c.exigida || c.status !== 'na' || c.manual)
              .map((c) => (
                <ItemConferencia
                  key={c.id}
                  i={c}
                  manual={confManual?.itens?.[c.id]}
                  mudar={mudarItem}
                  sempre={naoAplica.includes(c.id)}
                  mudarSempre={mudarSempre}
                />
              ))}
          </ul>
        </div>
      </div>

      {av.arquivos.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-[15px] font-bold text-[#0478CA]">Arquivos localizados ({av.arquivos.length})</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="px-2 py-1.5 font-semibold">Arquivo</th>
                  <th className="px-2 py-1.5 font-semibold">Pasta</th>
                  <th className="px-2 py-1.5 font-semibold">Período e evidência</th>
                </tr>
              </thead>
              <tbody>
                {av.arquivos.map((a: any, k: number) => (
                  <tr key={k} className="border-t border-slate-100 align-top">
                    <td className="px-2 py-1.5 text-slate-800 break-words">{a.rotulo}</td>
                    <td className="px-2 py-1.5 text-slate-600">{a.pasta}</td>
                    <td className="px-2 py-1.5 text-slate-600">
                      {a.comp
                        ? `${compBR(a.comp)}${a.comp === av.comp ? ' · correta' : ' · outra competência'}`
                        : a.imagem
                          ? 'Imagem'
                          : a.semTexto
                            ? 'Sem texto (digitalização)'
                            : 'Período não confirmado'}
                      {a.evidencia ? ` · ${a.evidencia}` : ''}
                      {a.pagoEm ? ` · pago em ${dataBR(a.pagoEm)}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {!neutro && av.sinal !== 'pagar' && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              downloadPdf(`notificacao-${slug(empresa.nome)}-${av.comp}.pdf`, 'Notificação de pendências documentais', [
                { type: 'date', text: dateText() },
                ...(blocosNotificacao(prest, av, cfg) as any),
              ])
            }
            className={`${botao} bg-[#0F2053] hover:bg-[#13306f] text-white`}
          >
            <Icon name="doc" className="w-5 h-5" /> Notificação de pendências (PDF)
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(mensagem);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2500);
              } catch {
                /* sem área de transferência */
              }
            }}
            className={botaoSec}
          >
            {copiado ? 'Mensagem copiada' : 'Copiar mensagem de cobrança'}
          </button>
          {empresa.prestadora?.email && (
            <a
              href={`mailto:${encodeURIComponent(empresa.prestadora.email)}?subject=${encodeURIComponent(`Pendências documentais · ${nomeCompetencia(av.comp)}`)}&body=${encodeURIComponent(mensagem)}`}
              className={botaoSec}
            >
              Enviar por e-mail
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function ItemConferencia({
  i,
  manual,
  mudar,
  sempre = false,
  mudarSempre,
}: {
  i: { id: string; nome: string; status: string; auto: string; detalhe: string; evidencias: string[]; marcadoEm?: string | null };
  manual?: { status: string; motivo?: string };
  mudar: (id: string, status: string, motivo?: string) => void;
  sempre?: boolean;
  mudarSempre?: (id: string, sim: boolean) => void;
}) {
  const st = STATUS[i.status as keyof typeof STATUS] || STATUS.faltando;
  const valor = sempre ? 'na-sempre' : manual?.status && manual.status !== 'pendente' ? manual.status : 'pendente';
  return (
    <li className="px-3 py-2.5 flex flex-col lg:flex-row lg:items-start gap-2">
      <span className="flex-1 min-w-0">
        <span className="text-[15px] text-slate-800">{i.nome}</span>
        <span className="block text-sm text-slate-500">
          {i.evidencias.length ? `${i.evidencias.length} ${i.evidencias.length === 1 ? 'arquivo' : 'arquivos'} · ` : ''}
          {i.detalhe}
          {i.marcadoEm ? ` · marcado em ${dataBR(i.marcadoEm)}` : ''}
        </span>
      </span>
      <span className={`shrink-0 self-start px-2.5 py-1 rounded-lg border text-sm font-semibold ${st.cor}`}>{st.curto}</span>
      <span className="shrink-0 flex flex-col gap-1.5 lg:w-48">
        <select
          value={valor}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'na-sempre') mudarSempre?.(i.id, true);
            else {
              if (sempre) mudarSempre?.(i.id, false);
              mudar(i.id, v);
            }
          }}
          aria-label={`Conferência: ${i.nome}`}
          className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm bg-white"
        >
          <option value="pendente">Automático ({(STATUS[i.auto as keyof typeof STATUS] || st).curto.toLowerCase()})</option>
          <option value="ok">Conferido: recebido</option>
          <option value="recusado">Recusado</option>
          <option value="na">Não se aplica neste mês</option>
          {mudarSempre && <option value="na-sempre">Não se aplica nesta prestadora (todos os meses)</option>}
        </select>
        {valor === 'recusado' && (
          <input
            defaultValue={manual?.motivo || ''}
            onBlur={(e) => mudar(i.id, 'recusado', e.target.value)}
            placeholder="Motivo da recusa"
            aria-label={`Motivo da recusa: ${i.nome}`}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm"
          />
        )}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------- relatório rápido

function PainelRapido({
  conteudo,
  arquivo,
  titulo,
  fechar,
}: {
  conteudo: { texto: string; blocos: any[] };
  arquivo: string;
  titulo: string;
  fechar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="mt-4 rounded-2xl border-2 border-[#0478CA]/30 bg-[#F7FAFD] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-[#0F2053]">{titulo}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(conteudo.texto);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2500);
              } catch {
                /* sem área de transferência */
              }
            }}
            className={botaoSec}
          >
            {copiado ? 'Texto copiado' : 'Copiar texto'}
          </button>
          <button
            type="button"
            onClick={() => downloadPdf(`${arquivo}.pdf`, titulo, [{ type: 'date', text: dateText() }, ...(conteudo.blocos as any)])}
            className={`${botao} bg-[#0F2053] hover:bg-[#13306f] text-white`}
          >
            <Icon name="doc" className="w-5 h-5" /> PDF
          </button>
          <button type="button" onClick={fechar} className="text-sm font-bold text-slate-600 underline cursor-pointer px-2">
            Fechar
          </button>
        </div>
      </div>
      <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 font-sans">{conteudo.texto}</pre>
    </div>
  );
}

// ---------------------------------------------------------------- farol e vencimentos

function ListaVencimentos({ venc, compacto = false }: { venc: ReturnType<typeof vencimentos>; compacto?: boolean }) {
  return (
    <div className={compacto ? '' : 'mt-5'}>
      {!compacto && <p className="text-sm font-bold text-slate-600 mb-2">Certidões e documentos com validade</p>}
      <ul className="grid md:grid-cols-2 gap-2">
        {venc.map((v) => (
          <li key={v.id} className="px-3 py-2 rounded-xl border border-slate-200 flex items-start justify-between gap-3">
            <span className="min-w-0 text-[15px] text-slate-800">
              {v.nome}
              <span className="block text-sm text-slate-500">
                {v.validade
                  ? `vence em ${dataBR(v.validade)}${v.dias != null ? ` (${v.dias < 0 ? `há ${-v.dias} dias` : `em ${v.dias} dias`})` : ''}`
                  : v.status === 'nunca'
                    ? 'nenhuma apresentada na pasta'
                    : 'apresentada sem validade legível'}
                {v.mes ? ` · pasta ${compBR(v.mes)}` : ''}
              </span>
            </span>
            <span className={`shrink-0 px-2.5 py-1 rounded-lg border text-sm font-semibold ${VENCIMENTO[v.status as keyof typeof VENCIMENTO].cor}`}>
              {VENCIMENTO[v.status as keyof typeof VENCIMENTO].nome}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Farol({
  empresas,
  avaliacoes,
  config,
  atualizadoEm,
  abrir,
}: {
  empresas: Unida[];
  avaliacoes: Map<string, Avaliacao[]>;
  config: ConfigDocPref;
  atualizadoEm: string;
  abrir: (chave: string, comp: string) => void;
}) {
  const [rapido, setRapido] = useState<{ texto: string; blocos: any[] } | null>(null);
  const anos = [...new Set([...avaliacoes.values()].flat().map((a) => a.comp.slice(0, 4)))].sort();
  const [ano, setAno] = useState('');
  const anoSel = anos.includes(ano) ? ano : anos.at(-1) || String(new Date().getFullYear());
  const comps = Array.from({ length: 12 }, (_, i) => `${anoSel}-${String(i + 1).padStart(2, '0')}`);
  const [soPendentes, setSoPendentes] = useState(true);
  const lista = empresas.map((e) => ({
    e,
    nome: e.nome,
    avs: avaliacoes.get(e.chave) || [],
    venc: e.drive ? vencimentos(e.drive) : [],
  }));
  const ranking = lista
    .map((l) => ({ ...l, p: performance(l.avs.filter((a) => a.comp.startsWith(anoSel))) }))
    .sort((a, b) => (a.p.regularidade ?? 101) - (b.p.regularidade ?? 101));
  const vencTodos = lista.flatMap((l) => l.venc.map((v) => ({ ...v, nome: v.nome, empresa: l.nome })));
  const vencVer = soPendentes ? vencTodos.filter((v) => v.status !== 'valido') : vencTodos;

  if (!empresas.length)
    return (
      <div className={`${card} text-center`}>
        <p className="text-lg font-bold text-[#0F2053]">Nenhuma prestadora ainda</p>
        <p className="mt-1 text-[15px] text-slate-600">O farol aparece quando a pasta do Drive for lida ou quando houver prestadoras cadastradas.</p>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-[#0F2053]">Farol de regularidade · {anoSel}</p>
            <p className="text-sm text-slate-500">Uma linha por prestadora e uma coluna por mês. Clique num mês para abrir o detalhe.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {anos.length > 1 && (
              <select value={anoSel} onChange={(e) => setAno(e.target.value)} aria-label="Ano" className={`${campo} w-28`}>
                {anos.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            )}
            <button type="button" onClick={() => baixarXlsx(`docpref-farol-${anoSel}.xlsx`, abasFarol(lista, comps))} className={botaoSec}>
              <Icon name="sheet" className="w-5 h-5" /> Excel do farol
            </button>
            <button
              type="button"
              onClick={() =>
                setRapido(
                  relatorioRapido(
                    lista.map(({ e, avs, venc }) => ({ nome: e.nome, ident: { razao: e.razao, cnpj: e.cnpj, contrato: e.contrato }, avs, venc })),
                    { atualizadoEm, contratante: config.contratante },
                  ),
                )
              }
              className={botaoSec}
            >
              <Icon name="check" className="w-5 h-5" /> Relatório rápido de todas
            </button>
          </div>
        </div>
        {rapido && (
          <PainelRapido conteudo={rapido} arquivo="docpref-rapido-todas" titulo="Relatório rápido - todas as prestadoras" fechar={() => setRapido(null)} />
        )}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-[#F7FAFD] text-left text-slate-500">
              <tr>
                <th className="px-2 py-2 font-semibold">Prestadora</th>
                {comps.map((c) => (
                  <th key={c} className="px-1 py-2 font-semibold text-center">
                    {c.slice(5)}
                  </th>
                ))}
                <th className="px-2 py-2 font-semibold text-right">Regularidade</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(({ e, avs }) => {
                const p = performance(avs.filter((a) => a.comp.startsWith(anoSel)));
                return (
                  <tr key={e.chave} className="border-t border-slate-100">
                    <td className="px-2 py-2 font-semibold text-[#0F2053] max-w-[220px] truncate">{e.nome}</td>
                    {comps.map((c) => {
                      const a = avs.find((x) => x.comp === c);
                      if (!a)
                        return (
                          <td key={c} className="px-1 py-2 text-center text-slate-300">
                            ·
                          </td>
                        );
                      return (
                        <td key={c} className="px-1 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => abrir(e.chave, c)}
                            title={`${compBR(c)}: ${nomeSinal(a.sinal)}${a.regularidade != null ? ` · ${a.regularidade}%` : ''}`}
                            aria-label={`${e.nome}, ${compBR(c)}: ${nomeSinal(a.sinal)}`}
                            className="inline-flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                          >
                            <span className={`w-3 h-3 rounded-full ${SINAL[a.sinal as Sinal].ponto}`} aria-hidden="true" />
                            <span className="text-[11px] tabular-nums text-slate-500">{a.regularidade != null ? `${a.regularidade}%` : ''}</span>
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-right tabular-nums font-semibold">{p.regularidade == null ? '-' : `${p.regularidade}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
          {(['pagar', 'aguardando', 'travar', 'futuro', 'fora'] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${SINAL[s].ponto}`} aria-hidden="true" /> {nomeSinal(s)}
            </span>
          ))}
          <span>% = exigências recebidas ÷ exigidas no mês</span>
        </p>
      </div>

      <div className={card}>
        <p className="text-lg font-bold text-[#0F2053]">Performance por prestadora · {anoSel}</p>
        <p className="text-sm text-slate-500">Exigências recebidas ÷ exigidas, só nos meses com prazo encerrado. As piores primeiro.</p>
        <ul className="mt-3 space-y-2">
          {ranking.map(({ e, p }) => (
            <li key={e.chave} className="grid sm:grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-x-3 gap-y-1">
              <span className="font-semibold text-[#0F2053] truncate">{e.nome}</span>
              <span className="h-3 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                <span
                  className={`block h-full rounded-full ${p.regularidade == null ? '' : p.regularidade >= 95 ? 'bg-emerald-600' : p.regularidade >= 70 ? 'bg-amber-500' : 'bg-red-600'}`}
                  style={{ width: `${p.regularidade ?? 0}%` }}
                />
              </span>
              <span className="text-sm tabular-nums text-slate-700">
                {p.regularidade == null
                  ? 'sem mês encerrado'
                  : `${p.regularidade}% · ${p.recebidos}/${p.exigidos}${p.travados ? ` · ${p.travados} ${p.travados === 1 ? 'mês travado' : 'meses travados'}` : ''}`}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-lg font-bold text-[#0F2053]">Vencimentos</p>
            <p className="text-sm text-slate-500">A última certidão (e documento da empresa) de cada prestadora e quando vence. A vencer = até 30 dias.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={soPendentes} onChange={(ev) => setSoPendentes(ev.target.checked)} className="w-4 h-4" />
            Só vencidos, a vencer e faltando
          </label>
        </div>
        {!vencVer.length ? (
          <p className="mt-3 text-[15px] text-emerald-800">Nenhum vencimento pendente.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="px-2 py-1.5 font-semibold">Prestadora</th>
                  <th className="px-2 py-1.5 font-semibold">Documento</th>
                  <th className="px-2 py-1.5 font-semibold">Validade</th>
                  <th className="px-2 py-1.5 font-semibold">Situação</th>
                </tr>
              </thead>
              <tbody>
                {vencVer.map((v, k) => (
                  <tr key={k} className="border-t border-slate-100">
                    <td className="px-2 py-1.5 font-semibold text-[#0F2053]">{v.empresa}</td>
                    <td className="px-2 py-1.5 text-slate-700">{v.nome}</td>
                    <td className="px-2 py-1.5 tabular-nums">{v.validade ? dataBR(v.validade) : '-'}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-lg border text-xs font-semibold ${VENCIMENTO[v.status as keyof typeof VENCIMENTO].cor}`}
                      >
                        {VENCIMENTO[v.status as keyof typeof VENCIMENTO].nome}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- cadastro

const NOVA = { razao: '', cnpj: '', contrato: '', email: '', pasta: '', dia: 0, drive: '', inicio: '', fiscal: '', objeto: '' };

function Cadastro({ prestadoras, config, nomesDrive }: { prestadoras: Prestadora[]; config: ConfigDocPref; nomesDrive: string[] }) {
  const [form, setForm] = useState<typeof NOVA & { id?: string }>(NOVA);
  const [msg, setMsg] = useState('');
  const arquivo = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof NOVA, v: string) => setForm((f) => ({ ...f, [k]: k === 'dia' ? Number(v) || 0 : v }));
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid lg:grid-cols-5 gap-6 items-start">
      <div className={`${card} lg:col-span-5`}>
        <p className="text-lg font-bold text-[#0F2053]">Contratante</p>
        <p className="text-sm text-slate-500">
          Quem contrata as prestadoras (a prefeitura ou o órgão). Aparece nos relatórios, no relatório rápido e na notificação de pendências.
        </p>
        <div className="mt-3 grid sm:grid-cols-3 gap-3">
          <label className="block sm:col-span-2">
            <span className="block text-sm text-slate-600 mb-1">Nome do contratante</span>
            <input
              defaultValue={config.contratante}
              onBlur={(e) => salvarConfig({ contratante: e.target.value.trim() })}
              placeholder="Ex.: Prefeitura Municipal de ..."
              className={campo}
            />
          </label>
          <label className="block">
            <span className="block text-sm text-slate-600 mb-1">Prazo para regularizar após a notificação (dias úteis)</span>
            <input
              type="number"
              min={0}
              max={30}
              defaultValue={config.prazoRegularizacao || ''}
              placeholder="o do contrato"
              onBlur={(e) => salvarConfig({ prazoRegularizacao: Math.min(30, Math.max(0, Number(e.target.value) || 0)) })}
              className={campo}
            />
          </label>
        </div>
      </div>
      <form
        className={`${card} lg:col-span-2 space-y-3`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.razao.trim()) return;
          salvarPrestadora({ ...form, razao: form.razao.trim() });
          setMsg(form.id ? 'Prestadora atualizada.' : 'Prestadora cadastrada.');
          setForm(NOVA);
        }}
      >
        <p className="text-lg font-bold text-[#0F2053]">{form.id ? 'Editar prestadora' : 'Nova prestadora'}</p>
        <p className="text-sm text-slate-500">As prestadoras da pasta lida aparecem sozinhas; o cadastro completa e-mail, contrato, prazo e início.</p>
        {(
          [
            ['razao', 'Razão social', 'text', true],
            ['cnpj', 'CNPJ', 'text', false],
            ['contrato', 'Número do contrato', 'text', false],
            ['email', 'E-mail para cobrança', 'email', false],
            ['pasta', 'Link da pasta dela no Google Drive', 'url', false],
            ['objeto', 'Objeto do contrato', 'text', false],
            ['fiscal', 'Fiscal do contrato (assina a notificação)', 'text', false],
          ] as const
        ).map(([k, nome, tipo, obrig]) => (
          <label key={k} className="block">
            <span className="block text-sm text-slate-600 mb-1">{nome}</span>
            <input type={tipo} required={obrig} value={String(form[k] ?? '')} onChange={(e) => set(k, e.target.value)} className={campo} />
          </label>
        ))}
        <label className="block">
          <span className="block text-sm text-slate-600 mb-1">Nome da pasta na leitura do Drive</span>
          <input list="docpref-drive" value={form.drive} onChange={(e) => set('drive', e.target.value)} className={campo} placeholder="Ex.: Pilar" />
          <datalist id="docpref-drive">
            {nomesDrive.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm text-slate-600 mb-1">Prazo: dia do mês seguinte</span>
            <input type="number" min={0} max={31} value={form.dia || ''} placeholder="último" onChange={(e) => set('dia', e.target.value)} className={campo} />
          </label>
          <label className="block">
            <span className="block text-sm text-slate-600 mb-1">Início do contrato</span>
            <input type="month" value={form.inicio} onChange={(e) => set('inicio', e.target.value)} className={campo} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="submit" className={`${botao} bg-[#0F2053] hover:bg-[#13306f] text-white`}>
            {form.id ? 'Salvar' : 'Cadastrar'}
          </button>
          {form.id && (
            <button type="button" onClick={() => setForm(NOVA)} className="text-sm font-bold text-slate-600 underline cursor-pointer">
              Cancelar
            </button>
          )}
        </div>
        {msg && (
          <p role="status" className="text-[15px] text-emerald-800">
            {msg}
          </p>
        )}
      </form>

      <div className={`${card} lg:col-span-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-lg font-bold text-[#0F2053]">Prestadoras cadastradas</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!prestadoras.length}
              onClick={() => {
                const url = URL.createObjectURL(new Blob([exportarDocPref()], { type: 'application/json' }));
                const a = document.createElement('a');
                a.href = url;
                a.download = `docpref-${hoje}.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
              className="text-sm font-bold text-[#0478CA] underline cursor-pointer disabled:opacity-50"
            >
              Baixar cópia
            </button>
            <button type="button" onClick={() => arquivo.current?.click()} className="text-sm font-bold text-[#0478CA] underline cursor-pointer">
              Importar cópia
            </button>
            <input
              ref={arquivo}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  setMsg(`${importarDocPref(await f.text())} prestadoras importadas.`);
                } catch {
                  setMsg('Esse arquivo não é uma cópia do DocPref.');
                } finally {
                  e.target.value = '';
                }
              }}
            />
          </div>
        </div>
        {!prestadoras.length ? (
          <p className="mt-3 text-[15px] text-slate-600">Nenhuma prestadora cadastrada à mão.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {prestadoras.map((p) => (
              <li key={p.id} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex-1 min-w-0">
                  <strong className="text-[#0F2053]">{p.razao}</strong>
                  <span className="block text-sm text-slate-500">
                    {[
                      p.cnpj && `CNPJ ${p.cnpj}`,
                      p.contrato && `contrato ${p.contrato}`,
                      p.dia ? `prazo dia ${p.dia}` : 'prazo: último dia',
                      p.inicio && `início ${compBR(p.inicio)}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                {p.pasta && (
                  <a href={p.pasta} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-[#0478CA] underline">
                    Pasta no Drive
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setForm({ ...NOVA, ...p, drive: p.drive || '', inicio: p.inicio || '', fiscal: p.fiscal || '', objeto: p.objeto || '' })}
                  className="text-sm font-bold text-slate-600 underline cursor-pointer"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => window.confirm(`Tirar ${p.razao} e as conferências dela?`) && removerPrestadora(p.id)}
                  className="text-sm font-bold text-red-700 underline cursor-pointer"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-slate-500">
          O cadastro e as marcações ficam guardados neste navegador. Use “Baixar cópia” para levar a outro computador.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- cartilha

function Cartilha({ config }: { config: ConfigDocPref }) {
  const mes = new Date().toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
  return (
    <div className="space-y-6">
      <div className={card}>
        <p className="text-lg font-bold text-[#0F2053]">Cartilha do fornecedor {COMPANY_PROFILE.name}</p>
        <p className="mt-1 max-w-3xl text-[15px] text-slate-600">
          O que cada prestadora envia todo mês, o prazo, como montar as pastas no Drive, as certidões, os documentos de admissão, demissão e férias, os modelos
          das oito declarações e a planilha de força de trabalho. Mande para a prestadora junto com o link da pasta.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              downloadPdf('cartilha-do-fornecedor-agil-cm.pdf', `Cartilha do fornecedor ${COMPANY_PROFILE.name}`, [
                { type: 'date', text: dateText() },
                ...(blocosCartilha(TOMADORA, { atualizada: mes, contratante: config.contratante }) as any),
              ])
            }
            className={`${botao} bg-[#0F2053] hover:bg-[#13306f] text-white`}
          >
            <Icon name="doc" className="w-5 h-5" /> Cartilha do fornecedor (PDF)
          </button>
          <button
            type="button"
            onClick={() => baixarXlsx('FORCA DE TRABALHO - modelo.xlsx', abasForcaDeTrabalho({ nome: COMPANY_PROFILE.name, cnpj: COMPANY_PROFILE.cnpj }))}
            className={botaoSec}
          >
            <Icon name="sheet" className="w-5 h-5" /> Planilha de força de trabalho (modelo .xlsx)
          </button>
        </div>
      </div>
      <div className={card}>
        <p className="text-lg font-bold text-[#0F2053]">Pastas de cada mês (MM-AAAA)</p>
        <ul className="mt-3 grid md:grid-cols-2 gap-2">
          {PASTAS_DO_MES.map(([p, d]) => (
            <li key={p} className="px-3 py-2 rounded-xl border border-slate-200 text-[15px]">
              <strong className="text-[#0F2053]">{p}</strong>
              <span className="block text-sm text-slate-600">{d}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-500">A planilha FORÇA DE TRABALHO fica na própria pasta do mês.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- como funciona

function ComoFunciona() {
  const etapas: [string, string, boolean][] = [
    [
      'Leitura automática da pasta',
      'A cada 3 horas o site lê a pasta compartilhada no Drive: uma pasta por prestadora, uma subpasta por mês (03-2026, 2026/03, "Março 2026"...) e os documentos guardados fora das pastas de mês.',
      true,
    ],
    [
      'Prazos legais',
      'Salários até o 5º dia útil, DCTFWeb até o dia 15, FGTS e INSS até o dia 20 (antecipados sem expediente bancário), pelas datas dos documentos.',
      true,
    ],
    [
      'Guias e pagamentos',
      'Cada guia (FGTS, INSS, VA/VR, VT) com o comprovante do banco do mesmo valor; salários: a soma dos comprovantes × o líquido da folha. Sem comprovante, o relatório pede para colocar o comprovante do banco.',
      true,
    ],
    ['OCR', 'PDFs digitalizados e fotos são lidos por reconhecimento de texto (comprovantes, TRCT, aviso, férias, ASO, declaração do banco).', true],
    ['Relatório rápido', 'O que falta em cada mês, em itens a), b), c), para copiar no WhatsApp ou baixar em PDF; por prestadora ou de todas.', true],
    ['Retenção de 11% do INSS', 'A retenção declarada na DCTFWeb (Lei 9.711/98) aparece para conferir com as retenções feitas nas notas fiscais pagas.', true],
    [
      'Contratante e fiscal',
      'Nome do órgão, fiscal e objeto do contrato nos relatórios; notificação com o fundamento da Lei 14.133/2021 e prazo para regularizar.',
      true,
    ],
    [
      'Pessoas do mês',
      'Empregados ativos da planilha × pagamentos de salário × folhas de ponto, e admissões/desligamentos pela planilha, declaração e subpastas.',
      true,
    ],
    [
      'Competência pelo documento',
      'DCTFWeb, guias do FGTS Digital, DARF, folha e declarações: vale o período escrito no documento, não a data de pagamento.',
      true,
    ],
    ['Relatório mês a mês', 'Para cada prestadora: recebidos, não localizados, divergências, certidões e achados, com PDF mensal e geral do ano.', true],
    ['Semáforo do pagamento', 'Pode pagar; não pagar ainda (antes do prazo); travar (prazo encerrado com pendência).', true],
    ['Conferência da equipe', 'Cada exigência pode ser marcada como conferida, recusada (com o motivo) ou não se aplica.', true],
    ['Notificação e cobrança', 'PDF de pendências no padrão Ágil CM, mensagem pronta e e-mail para a prestadora.', true],
    ['Cartilha do fornecedor', 'Manual com prazos, pastas, documentos, certidões, modelos de declaração e planilha de força de trabalho.', true],
    ['Farol e performance', 'Todas as prestadoras × meses num quadro só, com a % de regularidade (recebidos ÷ exigidos) e o ranking das piores.', true],
    ['Vencimentos', 'Certidões, PGR, PCMSO, LTCAT e alvará: válido, a vencer (30 dias) ou vencido, pela última apresentada.', true],
    ['Indicadores da força de trabalho', 'Ativos, admissões, desligamentos, afastados e turnover do mês, conferidos com as declarações.', true],
    ['Excel', 'Planilha do ano, do mês e do farol, como os "Exportar para o Excel" das plataformas de terceiros.', true],
    [
      'Cruzamento de pessoas',
      'Força de trabalho × folha × comprovantes × ponto, empregado por empregado (exige área com login, por ter dados pessoais).',
      false,
    ],
    ['Empregado liberado ou bloqueado', 'ASO, treinamentos e NRs com validade por empregado, para a portaria liberar o acesso.', false],
    ['Alerta no Telegram perto do prazo', 'Quem ainda não mandou, alguns dias antes do fim do prazo.', false],
  ];
  return (
    <div className="space-y-6">
      <div className={card}>
        <p className="text-lg font-bold text-[#0F2053]">Como funciona</p>
        <p className="mt-1 text-[15px] text-slate-600">
          Nada é enviado pelo site: a única fonte é a pasta compartilhada no Google Drive. Dentro dela, uma pasta para cada empresa; cada empresa sobe os
          documentos na sua pasta e o DocPref lê tudo pelo link.
        </p>
        <ol className="mt-3 space-y-2 text-[15px] text-slate-700 list-decimal pl-5">
          <li>
            Cada prestadora recebe a cartilha e acesso à pasta dela no Drive. Todo mês cria a pasta da competência (MM-AAAA) com as subpastas do book e sobe os
            documentos até o último dia do mês seguinte (ou o dia combinado).
          </li>
          <li>
            O DocPref lê a pasta inteira a cada 3 horas, identifica cada documento, a competência escrita nele, os valores e as datas, e confere prazos legais,
            certidões e pessoas.
          </li>
          <li>
            Na aba Prestadoras e meses você escolhe a empresa e analisa mês a mês: o que foi entregue, o que falta, as divergências e os achados, com o
            relatório em PDF ou Excel. O Farol mostra todas as empresas juntas.
          </li>
          <li>A equipe confere o que precisa de olho humano (digitalizações, assinaturas) e marca recebido, recusado ou não se aplica.</li>
          <li>Faltou algo? O site gera a notificação e a cobrança. Depois do prazo, o pagamento fica travado até regularizar.</li>
        </ol>
      </div>
      <div className={card}>
        <p className="text-lg font-bold text-[#0F2053]">O que já funciona e o que vem a seguir</p>
        <ul className="mt-3 space-y-2">
          {etapas.map(([t, d, pronto]) => (
            <li key={t} className="flex gap-3 text-[15px]">
              <span
                className={`mt-0.5 shrink-0 px-2 py-0.5 rounded-full text-xs font-bold ${pronto ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}
              >
                {pronto ? 'pronto' : 'a seguir'}
              </span>
              <span>
                <strong className="text-[#0F2053]">{t}.</strong> <span className="text-slate-600">{d}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className={card}>
        <p className="text-lg font-bold text-[#0F2053]">Configuração da leitura</p>
        <ul className="mt-3 space-y-2 text-[15px] text-slate-700 list-disc pl-5">
          <li>
            A pasta principal precisa estar compartilhada como “qualquer pessoa com o link” (leitor). Dentro dela, uma pasta para cada prestadora; pastas como
            “Modelos”, “Manuais” ou “Relatórios” na raiz são ignoradas.
          </li>
          <li>
            O ID da pasta fica no segredo <code className="px-1 rounded bg-slate-100">DOCPREF_PASTA_ID</code> do GitHub (Settings → Secrets and variables →
            Actions), fora do código público do site.
          </li>
          <li>
            O site publica só o resultado da leitura: tipo do documento, competência, valores das guias e achados. Não publica links dos arquivos, CPF nem nomes
            de empregados.
          </li>
          <li>Para ler a pasta na hora (sem esperar as 3 horas): no GitHub, Actions → “Publicar site no GitHub Pages” → Run workflow.</li>
        </ul>
      </div>
    </div>
  );
}
