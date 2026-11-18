// Área "Consulta CNPJ" (/consulta-cnpj/), separada das Licitações:
//   Consultar um CNPJ   qualquer empresa do Brasil: o cadastro da Receita na hora (BrasilAPI ou minhareceita.org) e o
//                       histórico em licitações nas atas lidas (as partes públicas do diagnóstico por CNPJ);
//   Vários CNPJs        uma lista colada, conferida de uma vez, com planilha Excel;
//   Empresas da região  as empresas ativas das cidades escolhidas, tiradas do cnpj.db (só da equipe, com senha).
// Sócios (pessoas físicas) não aparecem.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Header from '../components/Header.tsx';
import Footer from '../components/Footer.tsx';
import { Container, Icon } from '../components/ui.tsx';
import { ROUTES } from '../lib/routes.ts';
import { consultarReceita, linkWhatsApp, telefonesDe } from '../lib/contatoCnpj.js';
import { cadastroDaReceita, cnpjsDoTexto, linhasPlanilhaReceita, textoCadastro } from '../lib/consultaCnpj.js';
import { cnpjFormatado, cnpjValido, DIGITOS_PARTE, expandirDiagnostico, nomeSemCpf } from '../lib/possiveisClientes.js';
import { analisar } from '../lib/diagnostico.js';
import { atualizarFunil, ETAPAS_FUNIL, PREFIXO_FUNIL, useFunil, type EtapaFunil } from '../lib/meusEditais.ts';
import { baixarXlsx } from '../lib/xlsx.js';
import { campo, dataBR } from './prospeccaoUi.tsx';
import EmpresasRegiao from './EmpresasRegiao.tsx';

type Cadastro = ReturnType<typeof cadastroDaReceita>;
type Parte = 'um' | 'varios' | 'regiao';
const PARTES: { id: Parte; titulo: string; desc: string; icon: string }[] = [
  { id: 'um', titulo: 'Consultar um CNPJ', desc: 'Qualquer empresa do Brasil', icon: 'search' },
  { id: 'varios', titulo: 'Vários CNPJs', desc: 'Uma lista de uma vez, em Excel', icon: 'sheet' },
  { id: 'regiao', titulo: 'Empresas da região', desc: 'Busca por ramo e cidade (equipe)', icon: 'users' },
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mascara = (v: string) =>
  v
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const idade = (iso: string) => {
  if (!iso) return '';
  const anos = Math.floor((Date.now() - Date.parse(iso)) / (365.25 * 86400e3));
  return anos < 1 ? 'menos de 1 ano' : `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
};
const cnaeFmt = (c: string) => c.replace(/^(\d{4})(\d)(\d{2})$/, '$1-$2/$3');
const botao =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-bold cursor-pointer border-2 border-slate-200 bg-white text-[#0F2053] hover:border-[#0478CA] disabled:opacity-60';

interface Historico {
  itens: number;
  licitacoes: number;
  segundo: number;
  perto: number;
  naoLevou: number;
  vitorias: number;
}

/** Histórico nas atas lidas (Minas Gerais, 12 meses), pelas partes públicas do diagnóstico por CNPJ */
async function historico(cnpj: string): Promise<Historico | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}prospeccao/cnpj/${cnpj.slice(0, DIGITOS_PARTE)}.json`, { cache: 'no-cache' });
    if (!r.ok) return null;
    const x = expandirDiagnostico(await r.json(), cnpj);
    if (!x) return null;
    const a = analisar(x.empresa, x.licitacoes);
    return { itens: a.itens, licitacoes: a.licitacoes, segundo: a.segundo, perto: a.perto, naoLevou: a.naoLevou, vitorias: x.empresa.vitorias };
  } catch {
    return null;
  }
}

function Ficha({ c, hist }: { c: Cadastro; hist: Historico | null }) {
  const funil = useFunil();
  const registro = funil[PREFIXO_FUNIL + c.cnpj];
  const [copiado, setCopiado] = useState(false);
  const [todas, setTodas] = useState(false);
  const telefones = telefonesDe({ ddd_telefone_1: c.tel1, ddd_telefone_2: c.tel2 });
  const ativa = /^ativa$/i.test(c.situacao);
  const razao = nomeSemCpf(c.razao);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoCadastro({ ...c, razao }));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sem área de transferência */
    }
  };
  const linhas: [string, string][] = [
    ['Situação na Receita', `${c.situacao}${c.situacaoDesde ? ` desde ${dataBR(c.situacaoDesde)}` : ''}`],
    ['Aberta em', c.abertura ? `${dataBR(c.abertura)} (${idade(c.abertura)})` : ''],
    ['Natureza jurídica', c.natureza],
    ['Porte', `${c.porte}${c.simples && !c.mei ? ' · Simples Nacional' : ''}`],
    ['Capital social', c.capital ? moeda(c.capital) : ''],
  ];
  const secundarias: { codigo: string; descricao: string }[] = todas ? c.cnaes : c.cnaes.slice(0, 6);
  return (
    <article aria-labelledby="ficha-titulo" className="mt-6 space-y-4">
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200">
        <p className="flex flex-wrap items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold ${ativa ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-800'}`}>
            {c.situacao || 'Situação não informada'}
          </span>
          <span className="text-sm text-slate-600">CNPJ {cnpjFormatado(c.cnpj)}</span>
        </p>
        <h3 id="ficha-titulo" tabIndex={-1} className="mt-2 text-2xl sm:text-3xl font-bold font-display text-[#0F2053] leading-tight outline-none">
          {razao}
        </h3>
        {c.fantasia && c.fantasia !== c.razao && <p className="mt-1 text-lg text-slate-700">{c.fantasia}</p>}
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {linhas
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="p-3 rounded-xl bg-[#F7FAFD] border border-slate-200">
                <dt className="text-sm font-bold text-slate-600">{k}</dt>
                <dd className="text-[16px] text-slate-900">{v}</dd>
              </div>
            ))}
        </dl>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <button type="button" onClick={copiar} className={botao}>
            <Icon name="doc" className="w-5 h-5" />
            {copiado ? 'Dados copiados' : 'Copiar os dados'}
          </button>
          <label className="block">
            <span className="block text-sm font-bold text-slate-700">Prospecção</span>
            <select
              value={registro?.etapa || ''}
              onChange={(ev) => atualizarFunil({ cnpj: c.cnpj, razao, cidade: c.cidade, uf: c.uf }, { etapa: ev.target.value as EtapaFunil | '' })}
              className="mt-1 px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-[15px]"
            >
              <option value="">Sem contato</option>
              {ETAPAS_FUNIL.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <section aria-labelledby="ficha-contato" className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200">
          <h4 id="ficha-contato" className="text-lg font-bold font-display text-[#0F2053]">
            Endereço e contato
          </h4>
          <p className="mt-2 text-[16px] text-slate-800 leading-relaxed">
            {[c.endereco, c.bairro].filter(Boolean).join(' - ')}
            <br />
            {[c.cidade, c.uf].filter(Boolean).join(' - ')}
            {c.cep ? ` · CEP ${c.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}` : ''}
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[16px]">
            {telefones.map((t) =>
              t.celular ? (
                <a
                  key={t.numero}
                  href={linkWhatsApp(t.numero)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-emerald-800 underline underline-offset-4"
                >
                  WhatsApp {t.texto}
                  <span className="sr-only"> (abre o WhatsApp)</span>
                </a>
              ) : (
                <a key={t.numero} href={`tel:+55${t.numero}`} className="font-bold text-[#0369B3] underline underline-offset-4">
                  Telefone {t.texto}
                </a>
              ),
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className="font-bold text-[#0369B3] underline underline-offset-4 break-all">
                {c.email}
              </a>
            )}
            {!telefones.length && !c.email && <span className="text-slate-600">Sem telefone nem e-mail no cadastro.</span>}
          </p>
          <p className="mt-2 text-sm text-slate-600">Telefone e e-mail do cadastro da Receita (às vezes são os do contador).</p>
        </section>

        <section aria-labelledby="ficha-lic" className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200">
          <h4 id="ficha-lic" className="text-lg font-bold font-display text-[#0F2053]">
            Licitações
          </h4>
          {hist ? (
            <>
              <ul className="mt-3 grid grid-cols-2 gap-2">
                {[
                  [hist.itens, 'itens disputados sem vencer'],
                  [hist.licitacoes, hist.licitacoes === 1 ? 'licitação' : 'licitações'],
                  [hist.segundo, 'vezes em 2º lugar'],
                  [hist.vitorias, 'itens vencidos'],
                ].map(([v, r]) => (
                  <li key={r as string} className="p-3 rounded-xl bg-[#F7FAFD] border border-slate-200">
                    <strong className="block text-2xl font-bold font-display text-[#0F2053] tabular-nums">{v}</strong>
                    <span className="text-sm text-slate-700">{r}</span>
                  </li>
                ))}
              </ul>
              {(hist.perto > 0 || hist.naoLevou > 0) && (
                <p className="mt-3 text-[15px] text-slate-800">
                  {hist.perto > 0 && `${hist.perto} perdidos por pouco (até 5%). `}
                  {hist.naoLevou > 0 && `${hist.naoLevou} com o melhor preço e sem levar.`}
                </p>
              )}
              <a
                href={`${ROUTES.diagnostico}?cnpj=${c.cnpj}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 font-bold text-[#0369B3] underline underline-offset-4"
              >
                Ver o diagnóstico completo<span className="sr-only"> (abre em nova aba)</span>
                <Icon name="arrow" className="w-4 h-4" />
              </a>
            </>
          ) : (
            <p className="mt-2 text-[15px] text-slate-700 leading-relaxed">
              Não aparece entre o 2º e o 5º lugar nas atas lidas (licitações do Portal de Compras Públicas em Minas Gerais, últimos 12 meses). Pode ter vencido
              tudo, disputar em outros portais ou ainda não vender para o poder público.
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="ficha-atividades" className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200">
        <h4 id="ficha-atividades" className="text-lg font-bold font-display text-[#0F2053]">
          Atividades (CNAE)
        </h4>
        {c.cnae && (
          <p className="mt-2 text-[16px] text-slate-900">
            <span className="font-bold">Principal:</span> {cnaeFmt(c.cnae.codigo)} · {c.cnae.descricao}
          </p>
        )}
        {c.cnaes.length > 0 && (
          <>
            <p className="mt-3 text-sm font-bold text-slate-700">Secundárias ({c.cnaes.length})</p>
            <ul className="mt-1 space-y-1 text-[15px] text-slate-800">
              {secundarias.map((x) => (
                <li key={x.codigo}>
                  {cnaeFmt(x.codigo)} · {x.descricao}
                </li>
              ))}
            </ul>
            {c.cnaes.length > 6 && (
              <button type="button" onClick={() => setTodas(!todas)} className="mt-2 font-bold text-[#0369B3] underline underline-offset-4 cursor-pointer">
                {todas ? 'Mostrar menos' : `Mostrar todas as ${c.cnaes.length}`}
              </button>
            )}
          </>
        )}
      </section>
    </article>
  );
}

function UmCnpj({ inicial }: { inicial: string }) {
  const [cnpj, setCnpj] = useState(mascara(inicial));
  const [estado, setEstado] = useState<'nada' | 'buscando' | 'ok' | 'invalido' | 'erro'>('nada');
  const [erro, setErro] = useState('');
  const [c, setC] = useState<Cadastro | null>(null);
  const [hist, setHist] = useState<Historico | null>(null);
  const resultado = useRef<HTMLDivElement>(null);
  const buscar = async (valor: string) => {
    const d = valor.replace(/\D/g, '');
    setC(null);
    if (!cnpjValido(d)) return setEstado('invalido');
    setEstado('buscando');
    try {
      const [receita, h] = await Promise.all([consultarReceita(d), historico(d)]);
      setC(cadastroDaReceita(receita));
      setHist(h);
      setEstado('ok');
      const url = new URL(window.location.href);
      url.searchParams.set('cnpj', d);
      url.hash = '';
      window.history.replaceState(null, '', url);
      requestAnimationFrame(() => (resultado.current?.querySelector('#ficha-titulo') as HTMLElement | null)?.focus());
    } catch (e) {
      setErro((e as Error).message);
      setEstado('erro');
    }
  };
  useEffect(() => {
    if (inicial) buscar(inicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial]);
  const enviar = (ev: FormEvent) => {
    ev.preventDefault();
    buscar(cnpj);
  };
  return (
    <div>
      <form onSubmit={enviar} role="search" aria-label="Consultar um CNPJ" className="max-w-2xl flex flex-col sm:flex-row gap-3 sm:items-end">
        <label className="flex-1 block">
          <span className="text-sm font-bold text-slate-700">CNPJ</span>
          <input
            value={cnpj}
            onChange={(ev) => setCnpj(mascara(ev.target.value))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="00.000.000/0000-00"
            className={`mt-1 ${campo} text-lg font-semibold tracking-wide`}
          />
        </label>
        <button
          type="submit"
          disabled={estado === 'buscando'}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0F2053] hover:bg-[#13306f] text-white text-base font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait"
        >
          <Icon name="search" className="w-5 h-5" />
          {estado === 'buscando' ? 'Consultando…' : 'Consultar'}
        </button>
      </form>
      <div ref={resultado} aria-live="polite">
        {estado === 'invalido' && (
          <p role="alert" className="mt-4 max-w-2xl p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
            Esse CNPJ não parece certo. Confira os 14 números.
          </p>
        )}
        {estado === 'erro' && (
          <p role="alert" className="mt-4 max-w-2xl p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
            {erro}
          </p>
        )}
        {estado === 'nada' && (
          <p className="mt-4 max-w-3xl text-[16px] text-slate-700 leading-relaxed">
            A ficha traz a situação na Receita, a data de abertura, o porte (MEI e Simples), o capital social, todas as atividades, o endereço, o telefone e o
            e-mail do cadastro e o que a empresa já disputou em licitações de Minas Gerais.
          </p>
        )}
        {estado === 'ok' && c && <Ficha c={c} hist={hist} />}
      </div>
    </div>
  );
}

type Resultado = { cnpj: string; c?: Cadastro; erro?: string };

function VariosCnpj() {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [rodando, setRodando] = useState(false);
  const parar = useRef(false);
  const { validos, invalidos, sobraram } = cnpjsDoTexto(texto);
  const consultar = async () => {
    parar.current = false;
    setRodando(true);
    const out: Resultado[] = [];
    setResultados([]);
    for (const cnpj of validos) {
      if (parar.current) break;
      try {
        out.push({ cnpj, c: cadastroDaReceita(await consultarReceita(cnpj)) });
      } catch (e) {
        out.push({ cnpj, erro: (e as Error).message });
      }
      setResultados([...out]);
      await sleep(350); // devagar, para a Receita não recusar
    }
    setRodando(false);
  };
  const excel = () => {
    const linhas = linhasPlanilhaReceita(resultados) as Record<string, string>[];
    if (!linhas.length) return;
    const titulos = Object.keys(linhas[0]);
    const larga = new Set(['Empresa', 'Nome fantasia', 'Atividade principal', 'Endereço', 'E-mail']);
    baixarXlsx(`cnpjs-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        nome: 'CNPJs',
        colunas: titulos.map((t) => ({ titulo: t, largura: larga.has(t) ? 44 : 20, tipo: 'texto' })),
        linhas: linhas.map((l) => titulos.map((t) => l[t])),
      },
    ]);
  };
  return (
    <div>
      <label className="block max-w-3xl">
        <span className="text-sm font-bold text-slate-700">Cole os CNPJs (de uma planilha, de um e-mail, um por linha ou separados por vírgula)</span>
        <textarea
          value={texto}
          onChange={(ev) => setTexto(ev.target.value)}
          rows={6}
          placeholder={'27.750.870/0001-34\n00.000.000/0001-91'}
          className={`mt-1 ${campo} font-mono text-[15px]`}
        />
      </label>
      <p className="mt-2 text-[15px] text-slate-700">
        {validos.length} {validos.length === 1 ? 'CNPJ válido' : 'CNPJs válidos'}
        {invalidos.length > 0 &&
          ` · ${invalidos.length} com número errado (${invalidos.slice(0, 3).map(cnpjFormatado).join(', ')}${invalidos.length > 3 ? '…' : ''})`}
        {sobraram > 0 && ` · até 100 por vez: ${sobraram} ficam para a próxima`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {rodando ? (
          <button type="button" onClick={() => (parar.current = true)} className={botao}>
            Parar ({resultados.length} de {validos.length})
          </button>
        ) : (
          <button
            type="button"
            onClick={consultar}
            disabled={!validos.length}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0F2053] hover:bg-[#13306f] text-white text-base font-bold cursor-pointer disabled:opacity-50"
          >
            <Icon name="search" className="w-5 h-5" />
            Consultar {validos.length || ''} {validos.length === 1 ? 'CNPJ' : 'CNPJs'}
          </button>
        )}
        <button type="button" onClick={excel} disabled={!resultados.length || rodando} className={botao}>
          <Icon name="sheet" className="w-5 h-5" />
          Baixar em Excel
        </button>
      </div>
      {resultados.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-[15px]">
            <caption className="sr-only">Resultado da consulta dos CNPJs</caption>
            <thead className="bg-[#F4F7FB] text-sm text-slate-700">
              <tr>
                {['CNPJ', 'Empresa', 'Situação', 'Cidade', 'Porte', 'Telefone', 'E-mail'].map((t) => (
                  <th key={t} scope="col" className="px-3 py-2.5 font-bold whitespace-nowrap">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultados.map(({ cnpj, c, erro }) => (
                <tr key={cnpj} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                    <a href={`?cnpj=${cnpj}`} className="font-semibold text-[#0369B3] underline underline-offset-2">
                      {cnpjFormatado(cnpj)}
                    </a>
                  </td>
                  <td className="px-3 py-2">{c ? nomeSemCpf(c.razao) : <span className="text-amber-900">{erro}</span>}</td>
                  <td className={`px-3 py-2 ${c && !/^ativa$/i.test(c.situacao) ? 'text-red-700 font-bold' : ''}`}>{c?.situacao}</td>
                  <td className="px-3 py-2">{c && [c.cidade, c.uf].filter(Boolean).join(' - ')}</td>
                  <td className="px-3 py-2">{c?.porte}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {c &&
                      telefonesDe({ ddd_telefone_1: c.tel1, ddd_telefone_2: c.tel2 })
                        .map((t) => t.texto)
                        .join(', ')}
                  </td>
                  <td className="px-3 py-2 break-all">{c?.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ConsultaCnpjPage() {
  const [parte, setParte] = useState<Parte>('um');
  const [cnpjInicial, setCnpjInicial] = useState('');
  useEffect(() => {
    const ler = () => {
      const h = window.location.hash.replace('#', '') as Parte;
      const q = new URLSearchParams(window.location.search).get('cnpj') || '';
      setParte(PARTES.some((p) => p.id === h) ? h : 'um');
      if (q) setCnpjInicial(q);
    };
    ler();
    window.addEventListener('hashchange', ler);
    return () => window.removeEventListener('hashchange', ler);
  }, []);
  const trocar = (p: Parte) => {
    setParte(p);
    try {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${p === 'um' ? '' : `#${p}`}`);
    } catch {
      /* sem histórico */
    }
  };
  const consultarUm = (cnpj: string) => {
    setCnpjInicial(cnpj);
    trocar('um');
  };
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2 focus:bg-[#0478CA] focus:text-white focus:rounded-lg focus:font-semibold"
      >
        Pular para o conteúdo
      </a>
      <Header page="cnpj" />
      <main id="conteudo">
        <section className="relative bg-gradient-to-br from-[#0F2053] via-[#13306f] to-[#0A1640] text-white overflow-hidden">
          <div aria-hidden="true" className="absolute -top-32 -right-20 w-[30rem] h-[30rem] rounded-full bg-[#0478CA]/30 blur-3xl" />
          <Container className="relative pt-10 sm:pt-14">
            <nav aria-label="Você está em" className="text-sm text-white/75">
              <ol className="flex flex-wrap items-center gap-2">
                <li>
                  <a href={ROUTES.home} className="hover:text-white underline-offset-2 hover:underline">
                    Início
                  </a>
                </li>
                <li aria-hidden="true">›</li>
                <li aria-current="page" className="text-white">
                  Consulta CNPJ
                </li>
              </ol>
            </nav>
            <p className="mt-6 text-sm font-bold text-[#9fd3ff]">Cadastro de empresas da Receita Federal</p>
            <h1 className="mt-2 text-3xl sm:text-5xl font-bold font-display tracking-tight leading-tight">Consulta CNPJ</h1>
            <p className="mt-4 max-w-3xl text-lg sm:text-xl text-white/90 leading-relaxed">
              A ficha de qualquer empresa do Brasil, uma lista de CNPJs de uma vez e as empresas da região por ramo e cidade, com telefone, e-mail e o que cada
              uma já disputou em licitações.
            </p>
            <div role="tablist" aria-label="O que você quer consultar" className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              {PARTES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  id={`parte-${p.id}`}
                  aria-selected={parte === p.id}
                  aria-controls="painel-cnpj"
                  onClick={() => trocar(p.id)}
                  className={`text-left px-4 sm:px-5 py-3.5 rounded-t-2xl transition-colors cursor-pointer ${
                    parte === p.id ? 'bg-[#F4F7FB] text-[#0F2053]' : 'bg-white/10 text-white hover:bg-white/15'
                  }`}
                >
                  <span className="flex items-center gap-2 text-lg font-extrabold">
                    <Icon name={p.icon} className="w-5 h-5 shrink-0" />
                    {p.titulo}
                  </span>
                  <span className={`block mt-0.5 text-sm ${parte === p.id ? 'text-slate-600' : 'text-white/75'}`}>{p.desc}</span>
                </button>
              ))}
            </div>
          </Container>
        </section>

        <div id="painel-cnpj" role="tabpanel" aria-labelledby={`parte-${parte}`}>
          {parte === 'regiao' ? (
            <EmpresasRegiao onConsultar={consultarUm} />
          ) : (
            <section className="bg-[#F4F7FB] py-8 sm:py-10">
              <Container>{parte === 'um' ? <UmCnpj key={cnpjInicial} inicial={cnpjInicial} /> : <VariosCnpj />}</Container>
            </section>
          )}
        </div>
      </main>
      <Footer page="servico" />
    </>
  );
}
