// Painel eleitoral (/dados/eleicao/): resultado, votos por local e seção, comparecimento, perfil do eleitorado,
// histórico de candidatos e relatórios (Excel e PDF). Dados do TSE recortados em public/dados-eleicao/.
import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header.tsx';
import { Container, Icon } from '../components/ui.tsx';
import { dateText, downloadPdf } from '../lib/pdfReport.ts';
import {
  cargosDe,
  carregarDados,
  comparecimento,
  dimensoesDe,
  evolucao,
  filtrar,
  historicoCandidato,
  locaisDe,
  matriz,
  perfil,
  porPartido,
  resultadoCargo,
  totaisComparecimento,
} from '../lib/eleicao.js';
import { abasCandidatosPorSecao, abasExcelCompleto, blocosPdf } from '../lib/eleicaoRelatorios.js';
import { baixarXlsx } from '../lib/xlsx.js';

type Aba = 'resultado' | 'locais' | 'comparecimento' | 'perfil' | 'candidato' | 'relatorios';
const ABAS: { id: Aba; label: string; icon: string }[] = [
  { id: 'resultado', label: 'Resultado', icon: 'chart' },
  { id: 'locais', label: 'Por local e seção', icon: 'building' },
  { id: 'comparecimento', label: 'Comparecimento', icon: 'users' },
  { id: 'perfil', label: 'Perfil do eleitorado', icon: 'users' },
  { id: 'candidato', label: 'Candidato', icon: 'search' },
  { id: 'relatorios', label: 'Relatórios', icon: 'doc' },
];

const num = (v: number) => Number(v || 0).toLocaleString('pt-BR');
const pct = (v: number, casas = 2) => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
const card = 'p-5 sm:p-6 rounded-2xl bg-white border border-slate-200';
const selectCls = 'w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-[15px] text-[#0F2053] focus:outline-none focus:border-[#0478CA]';
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

const Barra = ({ valor, cor = 'bg-[#0478CA]' }: { valor: number; cor?: string }) => (
  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
    <div className={`h-full ${cor}`} style={{ width: `${Math.max(0, Math.min(100, valor * 100))}%` }} />
  </div>
);

export default function EleicaoPage() {
  const [dados, setDados] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [cidade, setCidade] = useState('Cataguases');
  const [ano, setAno] = useState(2024);
  const [cargo, setCargo] = useState('');
  const [local, setLocal] = useState('');
  const [secao, setSecao] = useState('');
  const [aba, setAba] = useState<Aba>('resultado');
  const [verTodos, setVerTodos] = useState(false);
  const [busca, setBusca] = useState('');
  const [porSecao, setPorSecao] = useState(false);
  const [topMatriz, setTopMatriz] = useState(10);
  const [dimensao, setDimensao] = useState('Faixa etária');
  const [termo, setTermo] = useState('');
  const [selecionados, setSelecionados] = useState<{ ano: number; cargo: string; id: string; nome: string }[]>([]);
  const [gerando, setGerando] = useState('');

  useEffect(() => {
    carregarDados(`${import.meta.env.BASE_URL}dados-eleicao/eleicoes-mg.dat`)
      .then(setDados)
      .catch((e) => setErro(e.message));
  }, []);

  const anos: number[] = useMemo(() => (dados ? [...new Set<number>(dados.turnout.filter((r: any) => r.city === cidade).map((r: any) => r.year))].sort() : []), [dados, cidade]);
  const base = useMemo(() => (dados ? filtrar(dados, { cidade, ano }) : null), [dados, cidade, ano]);
  const f = useMemo(() => (dados ? filtrar(dados, { cidade, ano, local, secao }) : null), [dados, cidade, ano, local, secao]);
  const cargos = useMemo(() => (base ? cargosDe(base.votos) : []), [base]);
  const cargoAtual = cargos.includes(cargo) ? cargo : cargos[0] || '';
  const locais = useMemo(() => (base ? locaisDe(base.secoes) : []), [base]);
  const secoesDoLocal = useMemo(
    () =>
      base && local
        ? [...new Set<string>(base.secoes.filter((r: any) => `${r.localCode}|${r.localName}` === local).map((r: any) => `${r.zone}|${r.section}`))].sort(
            (a, b) => Number(a.split('|')[1]) - Number(b.split('|')[1]),
          )
        : [],
    [base, local],
  );
  const res = useMemo(() => (f && cargoAtual ? resultadoCargo(f.votos, cargoAtual) : null), [f, cargoAtual]);
  const tot = useMemo(() => (f ? totaisComparecimento(f.secoes) : null), [f]);
  const filtrosTexto = [local && locais.find((l) => l.id === local)?.nome, secao && `seção ${secao.split('|')[1]}`].filter(Boolean).join(' · ');

  if (erro) return <Moldura><p className="p-5 rounded-2xl bg-red-50 border border-red-200 text-red-800">{erro}</p></Moldura>;
  if (!dados || !f || !res || !tot)
    return (
      <Moldura>
        <p className={`${card} text-slate-600`} aria-live="polite">
          Carregando os dados do TSE…
        </p>
      </Moldura>
    );

  const trocarCidade = (c: string) => {
    setCidade(c);
    setLocal('');
    setSecao('');
    setSelecionados([]);
    const anosC = [...new Set<number>(dados.turnout.filter((r: any) => r.city === c).map((r: any) => r.year))].sort();
    if (!anosC.includes(ano)) setAno(anosC[anosC.length - 1]);
  };

  const exportarExcel = () => {
    baixarXlsx(`eleicao-${slug(cidade)}-${ano}${filtrosTexto ? `-${slug(filtrosTexto)}` : ''}.xlsx`, abasExcelCompleto(f, { cidade, ano, filtrosTexto }) as never);
  };
  const exportarPdf = async (anoPdf = ano) => {
    const fx = anoPdf === ano ? f : filtrar(dados, { cidade, ano: anoPdf });
    await downloadPdf(
      `eleicao-${slug(cidade)}-${anoPdf}.pdf`,
      `Eleição ${anoPdf}`,
      blocosPdf(fx, { cidade, ano: anoPdf, dataText: dateText(), filtrosTexto: anoPdf === ano ? filtrosTexto : '' }) as never,
      { paisagem: true },
    );
  };
  const pdfTodosAnos = async () => {
    for (const [i, a] of anos.entries()) {
      setGerando(`Gerando ${i + 1} de ${anos.length}: ${a}`);
      await exportarPdf(a);
      await new Promise((ok) => setTimeout(ok, 600));
    }
    setGerando('');
  };

  return (
    <Moldura>
      {/* Filtros */}
      <div className={`${card} space-y-4`}>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Município">
          {dados.cities.map((c: string) => (
            <button
              key={c}
              type="button"
              aria-pressed={cidade === c}
              onClick={() => trocarCidade(c)}
              className={`px-4 py-2.5 rounded-xl text-[15px] font-bold border-2 cursor-pointer ${cidade === c ? 'bg-[#0F2053] border-[#0F2053] text-white' : 'border-slate-200 text-[#0F2053] hover:border-[#0478CA]'}`}
            >
              {c}
            </button>
          ))}
          <span className="mx-1 w-px bg-slate-200" aria-hidden="true" />
          {anos.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={ano === a}
              onClick={() => {
                setAno(a);
                setLocal('');
                setSecao('');
              }}
              className={`px-4 py-2.5 rounded-xl text-[15px] font-bold border-2 cursor-pointer ${ano === a ? 'bg-[#0478CA] border-[#0478CA] text-white' : 'border-slate-200 text-[#0F2053] hover:border-[#0478CA]'}`}
            >
              {a}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label>
            <span className="block text-sm font-semibold text-slate-700 mb-1">Cargo</span>
            <select value={cargoAtual} onChange={(e) => setCargo(e.target.value)} className={selectCls}>
              {cargos.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="block text-sm font-semibold text-slate-700 mb-1">Local de votação</span>
            <select
              value={local}
              onChange={(e) => {
                setLocal(e.target.value);
                setSecao('');
              }}
              className={selectCls}
            >
              <option value="">Todos os {locais.length} locais</option>
              {locais.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome} ({l.secoes.length} {l.secoes.length === 1 ? 'seção' : 'seções'})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="block text-sm font-semibold text-slate-700 mb-1">Seção</span>
            <select value={secao} onChange={(e) => setSecao(e.target.value)} className={selectCls} disabled={!local}>
              <option value="">{local ? 'Todas as seções do local' : 'Escolha um local'}</option>
              {secoesDoLocal.map((s) => (
                <option key={s} value={s}>
                  Zona {s.split('|')[0]} · seção {s.split('|')[1]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Números */}
      <div className="mt-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ['Eleitores aptos', num(tot.aptos), `${num(tot.secoes)} seções · ${num(tot.locais)} locais`],
          ['Comparecimento', pct(tot.pctComparecimento, 1), `${num(tot.comparecimento)} eleitores`],
          ['Abstenção', pct(tot.pctAbstencao, 1), `${num(tot.abstencoes)} eleitores`],
          [`Válidos (${cargoAtual})`, num(res.validos), res.legenda ? `${num(res.legenda)} de legenda` : 'votos em candidatos'],
          ['Brancos e nulos', num(res.brancos + res.nulos), `${num(res.brancos)} brancos · ${num(res.nulos)} nulos`],
        ].map(([k, v, d]) => (
          <div key={k} className={card}>
            <p className="text-sm text-slate-500">{k}</p>
            <p className="mt-1 text-xl font-bold text-[#0F2053] tabular-nums">{v}</p>
            <p className="text-xs text-slate-500">{d}</p>
          </div>
        ))}
      </div>
      {tot.agregadas > 0 && (
        <p className="mt-2 text-sm text-slate-500">
          {tot.agregadas} {tot.agregadas === 1 ? 'seção agregada votou' : 'seções agregadas votaram'} junto com outra seção e ficam fora dos totais de comparecimento.
        </p>
      )}

      {/* Abas */}
      <div role="tablist" aria-label="Painel" className="mt-6 flex flex-wrap gap-2">
        {ABAS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={aba === t.id}
            onClick={() => setAba(t.id)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-bold border-2 cursor-pointer ${aba === t.id ? 'bg-[#0F2053] border-[#0F2053] text-white' : 'bg-white border-slate-200 text-[#0F2053] hover:border-[#0478CA]'}`}
          >
            <Icon name={t.icon} className="w-5 h-5" />
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-4">
        {aba === 'resultado' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className={`${card} xl:col-span-2`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-lg font-bold text-[#0F2053]">
                  {cargoAtual} · {cidade} {ano}
                  {filtrosTexto && <span className="text-slate-500 font-semibold"> · {filtrosTexto}</span>}
                </p>
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Filtrar candidato ou partido"
                  className="px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <ol className="mt-4 space-y-2">
                {res.candidatos
                  .filter((c) => !busca || `${c.nome} ${c.numero} ${c.partido}`.toLowerCase().includes(busca.toLowerCase()))
                  .slice(0, verTodos || busca ? undefined : 15)
                  .map((c) => (
                    <li key={c.id} className="grid grid-cols-12 items-center gap-2 text-[15px]">
                      <span className="col-span-1 text-slate-500 tabular-nums">{c.posicao}º</span>
                      <span className="col-span-6 sm:col-span-5 min-w-0">
                        <span className="block font-semibold text-slate-800 truncate">{c.nome}</span>
                        <span className="block text-xs text-slate-500">
                          {c.numero} · {c.partido}
                        </span>
                      </span>
                      <span className="hidden sm:block sm:col-span-3">
                        <Barra valor={res.candidatos[0].votos ? c.votos / res.candidatos[0].votos : 0} cor={c.posicao === 1 ? 'bg-[#128C4A]' : 'bg-[#0478CA]'} />
                      </span>
                      <span className="col-span-3 sm:col-span-2 text-right tabular-nums font-semibold">{num(c.votos)}</span>
                      <span className="col-span-2 sm:col-span-1 text-right tabular-nums text-slate-600">{pct(c.pctValidos, 1)}</span>
                    </li>
                  ))}
              </ol>
              {!busca && res.candidatos.length > 15 && (
                <button type="button" onClick={() => setVerTodos((v) => !v)} className="mt-3 text-sm font-bold text-[#0478CA] underline cursor-pointer">
                  {verTodos ? 'Mostrar só os 15 mais votados' : `Ver todos os ${res.candidatos.length} candidatos`}
                </button>
              )}
              <p className="mt-3 text-sm text-slate-500">% sobre os votos válidos (candidatos{res.proporcional ? ' e legenda' : ''}). Brancos e nulos não entram.</p>
            </div>
            <div className={card}>
              <p className="text-lg font-bold text-[#0F2053]">Partidos</p>
              <ul className="mt-3 space-y-2 text-[15px]">
                {porPartido(res)
                  .slice(0, 15)
                  .map((p) => (
                    <li key={p.partido}>
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-slate-800">{p.partido}</span>
                        <span className="tabular-nums">
                          {num(p.total)} · {pct(p.pct, 1)}
                        </span>
                      </div>
                      <Barra valor={p.pct} />
                      {res.proporcional && (
                        <p className="text-xs text-slate-500">
                          {p.candidatos} {p.candidatos === 1 ? 'candidato' : 'candidatos'} · {num(p.legenda)} de legenda
                        </p>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        )}

        {aba === 'locais' && <AbaLocais f={f} cargo={cargoAtual} porSecao={porSecao} setPorSecao={setPorSecao} top={topMatriz} setTop={setTopMatriz} />}

        {aba === 'comparecimento' && <AbaComparecimento dados={dados} cidade={cidade} ano={ano} f={f} />}

        {aba === 'perfil' && (
          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-lg font-bold text-[#0F2053]">
                Perfil do eleitorado · {cidade} {ano}
                {filtrosTexto && <span className="text-slate-500 font-semibold"> · {filtrosTexto}</span>}
              </p>
              <select value={dimensao} onChange={(e) => setDimensao(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-300 text-[15px]">
                {dimensoesDe(f.perfil).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <ul className="mt-4 space-y-2 text-[15px]">
              {perfil(f.perfil, dimensao).map((p) => (
                <li key={p.categoria} className="grid grid-cols-12 items-center gap-2">
                  <span className="col-span-5 sm:col-span-4 text-slate-800">{p.categoria}</span>
                  <span className="col-span-4 sm:col-span-6">
                    <Barra valor={p.pct} />
                  </span>
                  <span className="col-span-3 sm:col-span-2 text-right tabular-nums">
                    {num(p.eleitores)} · {pct(p.pct, 1)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-500">Perfil agregado do eleitorado de cada seção (TSE). Não revela o voto de nenhuma pessoa ou grupo.</p>
          </div>
        )}

        {aba === 'candidato' && (
          <AbaCandidato
            dados={dados}
            cidade={cidade}
            termo={termo}
            setTermo={setTermo}
            selecionados={selecionados}
            setSelecionados={setSelecionados}
          />
        )}

        {aba === 'relatorios' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={card}>
              <p className="text-lg font-bold text-[#0F2053]">Excel completo · {cidade} {ano}</p>
              <p className="mt-1 text-[15px] text-slate-600">
                Resumo, resultado de cada cargo, partidos, votos por local e por seção (candidatos nas linhas), comparecimento por seção e perfil do eleitorado.
                {filtrosTexto && ` Com o filtro: ${filtrosTexto}.`}
              </p>
              <button type="button" onClick={exportarExcel} className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D6F42] hover:bg-[#185C37] text-white font-bold cursor-pointer">
                <Icon name="sheet" className="w-5 h-5" /> Baixar Excel
              </button>
            </div>
            <div className={card}>
              <p className="text-lg font-bold text-[#0F2053]">PDF do resultado</p>
              <p className="mt-1 text-[15px] text-slate-600">
                Página deitada, um cargo por página: candidatos em ordem alfabética, o número, os locais de votação nas colunas e o total. Cargos com muitos
                candidatos (vereador, deputados) continuam nas páginas seguintes.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={!!gerando} onClick={() => exportarPdf()} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0478CA] hover:bg-[#03609F] text-white font-bold cursor-pointer disabled:opacity-50">
                  <Icon name="doc" className="w-5 h-5" /> PDF de {ano}
                </button>
                <button type="button" disabled={!!gerando} onClick={pdfTodosAnos} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#0478CA] text-[#0478CA] font-bold cursor-pointer disabled:opacity-50">
                  PDF de cada ano ({anos.join(', ')})
                </button>
              </div>
              {gerando && <p className="mt-2 text-sm text-slate-600">{gerando}</p>}
            </div>
            <div className={`${card} lg:col-span-2`}>
              <p className="text-lg font-bold text-[#0F2053]">Candidatos escolhidos por seção</p>
              <p className="mt-1 text-[15px] text-slate-600">
                Escolha candidatos na aba <strong>Candidato</strong> (de qualquer ano e cargo). O Excel traz uma aba por eleição e cargo, com as seções nas colunas.
              </p>
              <p className="mt-2 text-sm text-slate-700">{selecionados.length ? `Selecionados: ${selecionados.map((s) => `${s.nome} (${s.cargo} ${s.ano})`).join(' · ')}` : 'Nenhum candidato selecionado.'}</p>
              <button
                type="button"
                disabled={!selecionados.length}
                onClick={() => baixarXlsx(`candidatos-por-secao-${slug(cidade)}.xlsx`, abasCandidatosPorSecao(dados, cidade, selecionados) as never)}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D6F42] hover:bg-[#185C37] text-white font-bold cursor-pointer disabled:opacity-50"
              >
                <Icon name="sheet" className="w-5 h-5" /> Baixar Excel por seção
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="mt-6 text-sm text-slate-500">
        Fonte: TSE, dados abertos por seção eleitoral (1º turno), recorte de {dados.cities.join(', ')}. Atualizado em {dados.updatedAt.split('-').reverse().join('/')}.
      </p>
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header page="dados" />
      <main id="conteudo" className="bg-[#F4F7FB] min-h-screen py-10 sm:py-14">
        <Container>
          <a href={`${import.meta.env.BASE_URL}dados/`} className="text-sm font-bold text-[#0478CA] underline">
            ← Voltar para Dados
          </a>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold font-display text-[#0F2053]">Eleições em dados</h1>
          <p className="mt-1 mb-6 text-[15px] text-slate-600">Resultado, votos por local e seção, comparecimento e perfil do eleitorado · dados do TSE</p>
          {children}
        </Container>
      </main>
    </>
  );
}

function AbaLocais({ f, cargo, porSecao, setPorSecao, top, setTop }: { f: any; cargo: string; porSecao: boolean; setPorSecao: (v: boolean) => void; top: number; setTop: (n: number) => void }) {
  const m = useMemo(() => matriz(f.votos, cargo, porSecao ? 'secao' : 'local'), [f, cargo, porSecao]);
  const linhas = top ? m.linhas.slice(0, top) : m.linhas;
  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-bold text-[#0F2053]">
          {cargo}: votos por {porSecao ? 'seção' : 'local de votação'}
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div role="group" className="grid grid-cols-2 p-1 rounded-xl bg-slate-100">
            {[false, true].map((v) => (
              <button
                key={String(v)}
                type="button"
                aria-pressed={porSecao === v}
                onClick={() => setPorSecao(v)}
                className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${porSecao === v ? 'bg-white text-[#0F2053] shadow-sm' : 'text-slate-600'}`}
              >
                {v ? 'Por seção' : 'Por local'}
              </button>
            ))}
          </div>
          <select value={top} onChange={(e) => setTop(Number(e.target.value))} className="px-2 py-1.5 rounded-lg border border-slate-300">
            <option value={5}>5 mais votados</option>
            <option value={10}>10 mais votados</option>
            <option value={20}>20 mais votados</option>
            <option value={0}>Todos ({m.linhas.length})</option>
          </select>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">Cor mais forte = maior fatia dos votos válidos daquele {porSecao ? 'seção' : 'local'}. Role para o lado para ver todos.</p>
      <div className="mt-3 overflow-auto max-h-[70vh] border border-slate-200 rounded-xl">
        <table className="text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              <th className="sticky left-0 z-20 bg-slate-50 p-2 text-left font-semibold text-slate-600 min-w-[14rem]">Candidato</th>
              <th className="p-2 text-right font-semibold text-slate-600">Total</th>
              <th className="p-2 text-left font-semibold text-slate-600 min-w-[12rem]">Mais forte em</th>
              {m.colunas.map((k: any) => (
                <th key={k.id} className="p-2 text-right font-semibold text-slate-600 min-w-[7.5rem] align-bottom" title={k.nome}>
                  <span className="block line-clamp-2 text-left">{k.nome}</span>
                  {k.secao && <span className="block text-xs text-slate-500 text-left">Z{k.zona} · S{k.secao}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l: any) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="sticky left-0 bg-white p-2 min-w-[14rem]">
                  <span className="block font-semibold text-slate-800">{l.nome}</span>
                  <span className="block text-xs text-slate-500">
                    {l.numero} · {l.partido} · {l.posicao}º
                  </span>
                </td>
                <td className="p-2 text-right tabular-nums font-bold">{num(l.votos)}</td>
                <td className="p-2 text-xs text-slate-600">{l.melhor ? `${l.melhor.coluna} (${pct(l.melhor.pct, 1)})` : '—'}</td>
                {l.votosCol.map((v: number, i: number) => {
                  const fatia = m.validosCol[i] ? v / m.validosCol[i] : 0;
                  return (
                    <td key={i} className="p-2 text-right tabular-nums" style={{ backgroundColor: v ? `rgba(4,120,202,${Math.min(0.85, fatia * 1.6)})` : undefined, color: fatia > 0.35 ? 'white' : undefined }}>
                      {v ? num(v) : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300 font-bold">
              <td className="sticky left-0 bg-white p-2">Votos válidos</td>
              <td className="p-2 text-right tabular-nums">{num(m.resultado.validos)}</td>
              <td />
              {m.validosCol.map((v: number, i: number) => (
                <td key={i} className="p-2 text-right tabular-nums">
                  {num(v)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AbaComparecimento({ dados, cidade, ano, f }: { dados: any; cidade: string; ano: number; f: any }) {
  const [porSecao, setPorSecao] = useState(false);
  const evo = useMemo(() => evolucao(dados, cidade), [dados, cidade]);
  const linhas = useMemo(() => comparecimento(f.secoes, porSecao ? 'secao' : 'local'), [f, porSecao]);
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className={card}>
        <p className="text-lg font-bold text-[#0F2053]">Comparecimento por eleição · {cidade}</p>
        <ul className="mt-4 space-y-3 text-[15px]">
          {evo.map((e) => (
            <li key={e.ano}>
              <div className="flex justify-between gap-2">
                <span className={`font-semibold ${e.ano === ano ? 'text-[#0478CA]' : 'text-slate-800'}`}>{e.ano}</span>
                <span className="tabular-nums">
                  {pct(e.pctComparecimento, 1)} · {num(e.aptos)} aptos
                </span>
              </div>
              <Barra valor={e.pctComparecimento} cor={e.ano === ano ? 'bg-[#0478CA]' : 'bg-slate-400'} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-500">Eleições municipais (2020, 2024) e gerais (2022, 2026), 1º turno.</p>
      </div>
      <div className={`${card} xl:col-span-2`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-lg font-bold text-[#0F2053]">Por {porSecao ? 'seção' : 'local de votação'}</p>
          <div role="group" className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 text-sm">
            {[false, true].map((v) => (
              <button
                key={String(v)}
                type="button"
                aria-pressed={porSecao === v}
                onClick={() => setPorSecao(v)}
                className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${porSecao === v ? 'bg-white text-[#0F2053] shadow-sm' : 'text-slate-600'}`}
              >
                {v ? 'Por seção' : 'Por local'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 overflow-auto max-h-[60vh]">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3 font-semibold">Local</th>
                {porSecao && <th className="py-2 pr-3 font-semibold">Seção</th>}
                <th className="py-2 pr-3 font-semibold text-right">Aptos</th>
                <th className="py-2 pr-3 font-semibold text-right">Compareceram</th>
                <th className="py-2 pr-3 font-semibold text-right">Abstenções</th>
                <th className="py-2 font-semibold min-w-[9rem]">Comparecimento</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 tabular-nums">
                  <td className="py-2 pr-3">{l.local}</td>
                  {porSecao && <td className="py-2 pr-3">{l.secao}</td>}
                  <td className="py-2 pr-3 text-right">{num(l.aptos)}</td>
                  <td className="py-2 pr-3 text-right">{num(l.comparecimento)}</td>
                  <td className="py-2 pr-3 text-right">{num(l.abstencoes)}</td>
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      <span className="flex-1">
                        <Barra valor={l.pctComparecimento} cor={l.pctComparecimento < 0.7 ? 'bg-amber-500' : 'bg-[#0478CA]'} />
                      </span>
                      <span className="w-12 text-right">{pct(l.pctComparecimento, 1)}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-slate-500">Em laranja, locais ou seções com comparecimento abaixo de 70%.</p>
      </div>
    </div>
  );
}

function AbaCandidato({
  dados,
  cidade,
  termo,
  setTermo,
  selecionados,
  setSelecionados,
}: {
  dados: any;
  cidade: string;
  termo: string;
  setTermo: (s: string) => void;
  selecionados: { ano: number; cargo: string; id: string; nome: string }[];
  setSelecionados: (fn: (s: any[]) => any[]) => void;
}) {
  const hist = useMemo(() => historicoCandidato(dados, cidade, termo), [dados, cidade, termo]);
  const marcado = (h: any) => selecionados.some((s) => s.ano === h.ano && s.id === h.id);
  return (
    <div className={card}>
      <p className="text-lg font-bold text-[#0F2053]">Histórico do candidato em {cidade}</p>
      <input
        type="search"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Digite o nome ou o número (ex.: Henriques, 15)"
        className="mt-3 w-full px-4 py-3 rounded-xl border border-slate-300 text-base focus:outline-none focus:border-[#0478CA]"
      />
      {termo.trim().length >= 2 && !hist.length && <p className="mt-3 text-slate-600">Nenhum candidato encontrado.</p>}
      <ul className="mt-4 space-y-3">
        {hist.slice(0, 60).map((h: any) => (
          <li key={`${h.ano}${h.id}`} className="p-4 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="px-2.5 py-1 rounded-full bg-[#0478CA]/10 text-[#0478CA] text-sm font-bold">{h.ano}</span>
              <span className="font-bold text-[#0F2053]">{h.nome}</span>
              <span className="text-sm text-slate-600">
                {h.cargo} · nº {h.numero} · {h.partido}
              </span>
              <label className="ml-auto inline-flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marcado(h)}
                  onChange={(e) =>
                    setSelecionados((s) => (e.target.checked ? [...s, { ano: h.ano, cargo: h.cargo, id: h.id, nome: h.nome }] : s.filter((x) => !(x.ano === h.ano && x.id === h.id))))
                  }
                  className="w-4 h-4"
                />
                Incluir no Excel por seção
              </label>
            </div>
            <p className="mt-2 text-[15px] text-slate-800">
              <strong className="tabular-nums">{num(h.votos)} votos</strong> · {h.posicao}º de {h.de} · {pct(h.pctValidos, 1)} dos válidos
            </p>
            {h.melhores.length > 0 && (
              <p className="mt-1 text-sm text-slate-600">
                Mais forte em: {h.melhores.map((m: any) => `${m.local} (${num(m.votos)} · ${pct(m.pct, 1)})`).join(' · ')}
              </p>
            )}
          </li>
        ))}
      </ul>
      {selecionados.length > 0 && (
        <p className="mt-3 text-sm text-slate-700">
          {selecionados.length} selecionado(s). Baixe o Excel na aba <strong>Relatórios</strong>.
        </p>
      )}
    </div>
  );
}
