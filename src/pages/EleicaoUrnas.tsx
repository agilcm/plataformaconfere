// Aba "Votos por urna" do painel eleitoral: ano → cargo → até 3 candidatos; cada urna (seção eleitoral) é uma linha
// e cada candidato, uma coluna. Com um candidato só, o botão "Traçar perfil" mostra o eleitorado de onde ele foi mais forte.
import { useMemo, useState } from 'react';
import { Icon } from '../components/ui.tsx';
import { abasVotosPorUrna, blocosVotosPorUrna } from '../lib/eleicaoRelatorios.js';
import { CORES_CANDIDATOS, MAX_CANDIDATOS, perfilDoCandidato, rotuloCompleto, trajetoria, votosPorUrna } from '../lib/eleicaoUrnas.js';
import { dateText, downloadPdf, slug } from '../lib/pdfReport.ts';
import { baixarXlsx } from '../lib/xlsx.js';

const num = (v: number) => Number(v || 0).toLocaleString('pt-BR');
const pct = (v: number | null | undefined, casas = 1) =>
  v == null ? '—' : `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
const dec = (v: number | null | undefined, casas = 1) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const card = 'p-5 sm:p-6 rounded-2xl bg-white border border-slate-200';
const selectCls = 'w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-[15px] text-[#0F2053] focus:outline-none focus:border-[#0478CA]';
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const AZUL = '#0478CA';
const CINZA = '#94A3B8';

type Props = {
  dados: any;
  cidade: string;
  ano: number;
  anos: number[];
  trocarAno: (a: number) => void;
  cargo: string;
  cargos: string[];
  setCargo: (c: string) => void;
  escolhidos: string[];
  setEscolhidos: (ids: string[]) => void;
  filtroLocal: string;
  limparFiltro: () => void;
};

export default function AbaUrnas({
  dados,
  cidade,
  ano,
  anos,
  trocarAno,
  cargo,
  cargos,
  setCargo,
  escolhidos,
  setEscolhidos,
  filtroLocal,
  limparFiltro,
}: Props) {
  const [busca, setBusca] = useState('');
  const [verTodos, setVerTodos] = useState(false);
  const [ordem, setOrdem] = useState(-1); // -1: pela urna; i: mais votos do candidato i
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [perfilUrna, setPerfilUrna] = useState(false);
  const [cores, setCores] = useState<Record<string, number>>({});
  const [gerando, setGerando] = useState('');

  const t = useMemo(() => votosPorUrna(dados, { cidade, ano, cargo, ids: escolhidos, comPerfil: true }), [dados, cidade, ano, cargo, escolhidos]);
  const ids: string[] = t.candidatos.map((c: any) => c.id);
  const um = t.candidatos.length === 1 ? t.candidatos[0] : null;
  const umId = um?.id || '';
  const perfil = useMemo(
    () => (perfilAberto && umId ? perfilDoCandidato(dados, { cidade, ano, cargo, id: umId }) : null),
    [perfilAberto, umId, dados, cidade, ano, cargo],
  );
  const traj = useMemo(
    () => (perfilAberto && umId ? trajetoria(dados, { cidade, ano, cargo, id: umId }) : null),
    [perfilAberto, umId, dados, cidade, ano, cargo],
  );
  const fortes = useMemo(() => new Set<string>(perfil?.idsFortes || []), [perfil]);
  const linhas = useMemo(
    () =>
      ordem < 0 || ordem >= t.candidatos.length
        ? t.linhas
        : [...t.linhas].sort((a: any, b: any) => b.cand[ordem].votos - a.cand[ordem].votos || b.cand[ordem].pct - a.cand[ordem].pct),
    [t, ordem],
  );
  const maxPct = Math.max(0.01, ...t.linhas.flatMap((l: any) => l.cand.map((x: any) => x.pct)));
  // a cor acompanha o candidato (não a posição na lista): tirar um não repinta os outros
  const corDe = (id: string, i: number) => CORES_CANDIDATOS[cores[id] ?? i] || CORES_CANDIDATOS[0];

  const termo = semAcento(busca.trim());
  const lista = t.resultado.candidatos.filter((c: any) => !termo || semAcento(`${c.nome} ${c.nomeCivil} ${c.numero} ${c.partido}`).includes(termo));
  const visiveis = termo || verTodos ? lista : lista.slice(0, 12);

  const alternar = (id: string) => {
    setPerfilAberto(false);
    setOrdem(-1);
    if (ids.includes(id)) {
      setEscolhidos(ids.filter((x) => x !== id));
      return;
    }
    if (ids.length >= MAX_CANDIDATOS) return;
    const usadas = new Set(ids.map((x, i) => cores[x] ?? i));
    const livre = CORES_CANDIDATOS.findIndex((_, k) => !usadas.has(k));
    setCores({ ...cores, [id]: livre < 0 ? 0 : livre });
    setEscolhidos([...ids, id]);
  };

  const nomeArquivo = (ext: string) =>
    `votos-por-urna-${slug(cidade)}-${ano}-${slug(cargo)}${um ? `-${slug(um.nome)}` : ''}${perfil ? '-com-perfil' : ''}.${ext}`;
  const baixarExcel = () => baixarXlsx(nomeArquivo('xlsx'), abasVotosPorUrna({ ...t, linhas }, perfil, traj) as never);
  const baixarPdf = async () => {
    setGerando('Gerando o PDF…');
    try {
      await downloadPdf(
        nomeArquivo('pdf'),
        `Votos por urna ${ano}`,
        blocosVotosPorUrna({ ...t, linhas }, { dataText: dateText(), perfil, trajetoria: traj }) as never,
      );
    } finally {
      setGerando('');
    }
  };
  const tracar = () => {
    setPerfilAberto((v) => !v);
    if (!perfilAberto) setPerfilUrna(true);
  };

  const heat = (p: number) => {
    const a = p > 0 ? 0.06 + 0.6 * Math.min(1, p / maxPct) : 0;
    return { backgroundColor: a ? `rgba(4,120,202,${a.toFixed(3)})` : undefined, color: a > 0.42 ? 'white' : undefined };
  };

  return (
    <div className="space-y-4">
      {/* Escolha: ano → cargo → candidatos */}
      <div className={card}>
        <p className="text-lg font-bold text-[#0F2053]">Votos por urna</p>
        <p className="mt-1 text-[15px] text-slate-600">
          Escolha o ano, o cargo e até {MAX_CANDIDATOS} candidatos. Cada urna (seção eleitoral) vira uma linha e cada candidato, uma coluna com os votos dele em
          todas as urnas de {cidade}.
        </p>
        {filtroLocal && (
          <p className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
            Aqui entram todas as urnas de {cidade}; o filtro de local lá em cima ({filtroLocal}) não vale para este relatório.{' '}
            <button type="button" onClick={limparFiltro} className="font-bold underline cursor-pointer">
              Limpar filtro
            </button>
          </p>
        )}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-[auto_minmax(0,18rem)] gap-4 items-end">
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-1">1. Ano da eleição</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Ano da eleição">
              {anos.map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={ano === a}
                  onClick={() => trocarAno(a)}
                  className={`px-4 py-2.5 rounded-xl text-[15px] font-bold border-2 cursor-pointer ${ano === a ? 'bg-[#0478CA] border-[#0478CA] text-white' : 'border-slate-200 text-[#0F2053] hover:border-[#0478CA]'}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <label>
            <span className="block text-sm font-semibold text-slate-700 mb-1">2. Cargo</span>
            <select value={cargo} onChange={(e) => setCargo(e.target.value)} className={selectCls}>
              {cargos.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">
            3. Candidatos ({ids.length} de {MAX_CANDIDATOS})
          </p>
          {t.candidatos.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2" aria-label="Candidatos escolhidos">
              {t.candidatos.map((c: any, i: number) => (
                <li
                  key={c.id}
                  className="inline-flex items-center gap-2 pl-3 pr-1 py-1 rounded-full border-2 bg-white text-sm font-semibold text-slate-800"
                  style={{ borderColor: corDe(c.id, i) }}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: corDe(c.id, i) }} aria-hidden="true" />
                  {c.nome}
                  <button
                    type="button"
                    onClick={() => alternar(c.id)}
                    aria-label={`Tirar ${c.nome}`}
                    className="w-7 h-7 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={`Buscar ${cargo.toLowerCase()} por nome, número ou partido`}
            aria-label="Buscar candidato"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 text-base focus:outline-none focus:border-[#0478CA]"
          />
          {termo && !lista.length && (
            <p className="mt-2 text-slate-600">
              Nenhum candidato de {cargo.toLowerCase()} com esse nome em {ano}.
            </p>
          )}
          <ul className="mt-2 max-h-80 overflow-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {visiveis.map((c: any) => {
              const marcado = ids.includes(c.id);
              const cheio = !marcado && ids.length >= MAX_CANDIDATOS;
              return (
                <li key={c.id}>
                  <label
                    className={`flex items-center gap-3 px-3 py-2.5 ${cheio ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'} ${marcado ? 'bg-[#0478CA]/5' : ''}`}
                  >
                    <input type="checkbox" checked={marcado} disabled={cheio} onChange={() => alternar(c.id)} className="w-4 h-4 shrink-0" />
                    <span className="w-9 shrink-0 text-right text-sm tabular-nums text-slate-500">{c.posicao}º</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold text-slate-800 truncate">{c.nome}</span>
                      <span className="block text-xs text-slate-500">
                        {c.nomeCivil && c.nomeCivil !== c.nome ? `${c.nomeCivil} · ` : ''}
                        {c.numero} · {c.partido}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm tabular-nums font-semibold text-slate-800">{num(c.votos)}</span>
                      <span className="block text-xs tabular-nums text-slate-500">{pct(c.pctValidos)}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {!termo && lista.length > 12 && (
            <button type="button" onClick={() => setVerTodos((v) => !v)} className="mt-2 text-sm font-bold text-[#0478CA] underline cursor-pointer">
              {verTodos ? 'Mostrar só os 12 mais votados' : `Ver todos os ${lista.length} candidatos`}
            </button>
          )}
          {ids.length >= MAX_CANDIDATOS && <p className="mt-2 text-sm text-slate-600">Limite de {MAX_CANDIDATOS} candidatos. Tire um para escolher outro.</p>}
        </div>
      </div>

      {t.candidatos.length === 0 ? (
        <p className={`${card} text-slate-600`}>Marque até {MAX_CANDIDATOS} candidatos acima para ver os votos de cada um em todas as urnas.</p>
      ) : (
        <>
          {/* Resumo de cada candidato */}
          <div className={`grid grid-cols-1 ${t.candidatos.length > 1 ? 'md:grid-cols-2 xl:grid-cols-3' : ''} gap-3`}>
            {t.candidatos.map((c: any, i: number) => (
              <div key={c.id} className={`${card} min-w-0`} style={{ borderTop: `4px solid ${corDe(c.id, i)}` }}>
                <p className="font-bold text-[#0F2053]">{c.nome}</p>
                <p className="text-sm text-slate-500">
                  {c.nomeCivil && c.nomeCivil !== c.nome && <span className="block text-slate-700">{c.nomeCivil}</span>}
                  nº {c.numero} · {c.partido} · {c.posicao}º lugar em {cidade}
                  {c.situacao && ` · ${c.situacao}`}
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-[#0F2053]">
                  {num(c.votos)} <span className="text-base font-semibold text-slate-600">votos · {pct(c.pctValidos)} dos válidos</span>
                </p>
                <ul className="mt-2 space-y-0.5 text-sm text-slate-700">
                  <li>
                    Voto em <strong>{c.urnasComVoto}</strong> de {t.totais.urnas} urnas
                  </li>
                  <li>
                    1º lugar em <strong>{c.urnasVencidas}</strong> {c.urnasVencidas === 1 ? 'urna' : 'urnas'}
                  </li>
                  <li>
                    Metade dos votos saiu de <strong>{c.metadeDosVotosEm}</strong> {c.metadeDosVotosEm === 1 ? 'urna' : 'urnas'}
                  </li>
                  {c.melhor && (
                    <li>
                      Melhor urna: seção {c.melhor.secao} ({c.melhor.local}) · {num(c.melhor.votos)} votos · {pct(c.melhor.pct)}
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>

          {/* Ações */}
          <div className="flex flex-wrap items-center gap-2">
            {um ? (
              <button
                type="button"
                onClick={tracar}
                aria-expanded={perfilAberto}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#0F2053] hover:bg-[#1a2f6e] text-white text-[16px] font-bold cursor-pointer shadow-sm"
              >
                <Icon name="users" className="w-5 h-5" /> {perfilAberto ? 'Fechar perfil' : 'Traçar perfil'}
              </button>
            ) : (
              <p className="text-sm text-slate-600 mr-2">
                Para <strong>traçar o perfil</strong>, deixe só um candidato marcado.
              </p>
            )}
            <button
              type="button"
              onClick={baixarExcel}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[#1D6F42] hover:bg-[#185C37] text-white font-bold cursor-pointer"
            >
              <Icon name="sheet" className="w-5 h-5" /> Baixar Excel
            </button>
            <button
              type="button"
              onClick={baixarPdf}
              disabled={!!gerando}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[#0478CA] hover:bg-[#03609F] text-white font-bold cursor-pointer disabled:opacity-50"
            >
              <Icon name="doc" className="w-5 h-5" /> Baixar PDF{perfil ? ' (com o perfil)' : ''}
            </button>
            {gerando && (
              <span className="text-sm text-slate-600" aria-live="polite">
                {gerando}
              </span>
            )}
          </div>

          {perfil && <PainelPerfil p={perfil} tr={traj} cidade={cidade} cor={corDe(perfil.candidato.id, 0)} />}

          {/* Tabela: urnas nas linhas, candidatos nas colunas */}
          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-lg font-bold text-[#0F2053]">
                {cargo} · {cidade} {ano}: votos em cada urna
              </p>
              <div className="flex flex-wrap items-center gap-3 text-sm min-w-0 max-w-full">
                <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={perfilUrna} onChange={(e) => setPerfilUrna(e.target.checked)} className="w-4 h-4" />
                  Perfil do eleitorado de cada urna
                </label>
                <label className="flex items-center gap-2 min-w-0 max-w-full">
                  <span className="shrink-0 font-semibold text-slate-700">Ordem</span>
                  <select
                    value={ordem}
                    onChange={(e) => setOrdem(Number(e.target.value))}
                    className="min-w-0 w-full sm:w-auto max-w-full sm:max-w-[22rem] px-2 py-1.5 rounded-lg border border-slate-300 truncate"
                  >
                    <option value={-1}>Pela urna (zona e seção)</option>
                    {t.candidatos.map((c: any, i: number) => (
                      <option key={c.id} value={i}>
                        Mais votos de {c.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {t.totais.urnas} urnas · cor mais forte = maior fatia dos votos válidos da urna · <strong>1º</strong> = foi o mais votado do cargo naquela urna
              {perfil ? ' · "forte" = está entre as 25% urnas mais fortes' : ''}.
            </p>
            <div className="mt-3 overflow-auto max-h-[70vh] border border-slate-200 rounded-xl">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr>
                    <th className="sticky left-0 z-20 bg-slate-50 p-2 text-left font-semibold text-slate-600">Urna</th>
                    <th className="p-2 text-left font-semibold text-slate-600 min-w-[12rem]">Local de votação</th>
                    {t.candidatos.map((c: any, i: number) => (
                      <th
                        key={c.id}
                        className="p-2 text-right font-semibold text-slate-700 min-w-[8.5rem] align-bottom"
                        style={{ boxShadow: `inset 0 4px 0 ${corDe(c.id, i)}` }}
                      >
                        <span className="block text-left">{c.nome}</span>
                        <span className="block text-left text-xs font-normal text-slate-500">
                          {c.nomeCivil && c.nomeCivil !== c.nome && <span className="block">{c.nomeCivil}</span>}
                          {c.numero} · {c.partido}
                        </span>
                      </th>
                    ))}
                    <th className="p-2 text-right font-semibold text-slate-600">Válidos</th>
                    <th className="p-2 text-left font-semibold text-slate-600 min-w-[11rem]">Mais votado na urna</th>
                    {perfilUrna && (
                      <>
                        <th className="p-2 text-right font-semibold text-slate-600">Idade média</th>
                        <th className="p-2 text-right font-semibold text-slate-600">60 anos ou mais</th>
                        <th className="p-2 text-right font-semibold text-slate-600">16 a 29 anos</th>
                        <th className="p-2 text-right font-semibold text-slate-600">Ensino superior</th>
                        <th className="p-2 text-right font-semibold text-slate-600">Só até o fundamental</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l: any) => (
                    <tr key={l.id} className="border-t border-slate-100">
                      <td className="sticky left-0 bg-white p-2 whitespace-nowrap">
                        <span className="block font-bold text-[#0F2053]">Seção {l.secao}</span>
                        <span className="block text-xs text-slate-500">
                          Zona {l.zona}
                          {fortes.has(l.id) && <span className="ml-1 px-1.5 rounded bg-[#0F2053] text-white text-[11px] font-bold">forte</span>}
                        </span>
                      </td>
                      <td className="p-2 text-slate-700">{l.local}</td>
                      {l.cand.map((x: any, i: number) => (
                        <td key={i} className="p-2 text-right tabular-nums" style={heat(x.pct)}>
                          <span className="font-bold">{num(x.votos)}</span>
                          {x.venceu && <span className="ml-1 px-1.5 rounded bg-[#128C4A] text-white text-[11px] font-bold">1º</span>}
                          <span className="block text-xs">
                            {pct(x.pct)}
                            {x.posicao ? ` · ${x.posicao}º` : ''}
                          </span>
                        </td>
                      ))}
                      <td className="p-2 text-right tabular-nums">{num(l.validos)}</td>
                      <td className="p-2 text-xs text-slate-600">{l.maisVotado ? `${l.maisVotado} (${num(l.votosMaisVotado)})` : '—'}</td>
                      {perfilUrna && (
                        <>
                          <td className="p-2 text-right tabular-nums">{l.ind ? `${dec(l.ind.idadeMedia)} anos` : '—'}</td>
                          <td className="p-2 text-right tabular-nums">{pct(l.ind?.i60)}</td>
                          <td className="p-2 text-right tabular-nums">{pct(l.ind?.i16)}</td>
                          <td className="p-2 text-right tabular-nums">{pct(l.ind?.e3)}</td>
                          <td className="p-2 text-right tabular-nums">{pct(l.ind ? (l.ind.e0 || 0) + (l.ind.e1 || 0) : null)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                    <td className="sticky left-0 bg-slate-50 p-2">Total</td>
                    <td className="p-2">{t.totais.urnas} urnas</td>
                    {t.candidatos.map((c: any) => (
                      <td key={c.id} className="p-2 text-right tabular-nums">
                        {num(c.votos)}
                        <span className="block text-xs font-semibold">{pct(c.pctValidos)}</span>
                      </td>
                    ))}
                    <td className="p-2 text-right tabular-nums">{num(t.totais.validos)}</td>
                    <td />
                    {perfilUrna && <td colSpan={5} />}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Barras pareadas: urnas mais fortes (azul) × média da cidade (cinza), com o valor escrito ao lado de cada barra */
function Comparacao({ titulo, itens, g }: { titulo: string; itens: any[]; g: any }) {
  const max = Math.max(0.01, ...itens.flatMap((d) => [g.fortes.ind[d.id] ?? 0, g.todas.ind[d.id] ?? 0]));
  return (
    <figure className="min-w-0">
      <figcaption className="font-bold text-[#0F2053]">{titulo}</figcaption>
      <ul className="mt-3 space-y-3">
        {itens.map((d) => {
          const a = g.fortes.ind[d.id];
          const b = g.todas.ind[d.id];
          const dif = ((a ?? 0) - (b ?? 0)) * 100;
          return (
            <li key={d.id} title={`${d.rotulo}: ${pct(a)} nas urnas mais fortes; ${pct(b)} na cidade`}>
              <div className="flex justify-between gap-2 text-sm">
                <span className="text-slate-800">{d.rotulo}</span>
                <span className="tabular-nums text-slate-600">
                  {Math.abs(dif) < 0.05 ? 'igual à cidade' : `${dif > 0 ? '+' : '−'}${dec(Math.abs(dif))} ponto${Math.abs(dif) >= 2 ? 's' : ''}`}
                </span>
              </div>
              <div className="mt-1 space-y-0.5">
                {[
                  [a, AZUL, 'Urnas mais fortes'],
                  [b, CINZA, 'Cidade'],
                ].map(([v, cor, nome]) => (
                  <div key={nome as string} className="flex items-center gap-2">
                    <div className="flex-1 h-2.5">
                      <div className="h-full rounded-r" style={{ width: `${(((v as number) ?? 0) / max) * 100}%`, background: cor as string }} />
                    </div>
                    <span className={`w-14 text-right text-xs tabular-nums ${cor === AZUL ? 'font-bold text-slate-800' : 'text-slate-600'}`}>
                      <span className="sr-only">{nome}: </span>
                      {pct(v as number)}
                    </span>
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

function PainelPerfil({ p, tr, cidade, cor }: { p: any; tr: any; cidade: string; cor: string }) {
  const g = p.grupos;
  const ind = (id: string) => p.indicadores.find((d: any) => d.id === id);
  const grupos = [
    ['venceu', 'Onde ficou em 1º'],
    ['fortes', '25% mais fortes'],
    ['fracas', '25% mais fracas'],
    ['todas', 'Cidade'],
  ];
  const valor = (k: string, d: any) => (!g[k].urnas ? '—' : d.tipo === 'pct' ? pct(g[k].ind[d.id]) : `${dec(g[k].ind[d.id])} anos`);
  return (
    <section aria-labelledby="perfil-titulo" className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-[#0F2053]">
      <p className="text-sm font-bold text-[#0478CA]">Perfil de onde ganhou</p>
      <h2 id="perfil-titulo" className="mt-1 text-xl sm:text-2xl font-bold text-[#0F2053]">
        <span className="inline-block w-3 h-3 mr-2 rounded-full align-middle" style={{ background: cor }} aria-hidden="true" />
        {p.candidato.nome}{' '}
        <span className="text-base font-semibold text-slate-500">
          · {p.cargo} · {cidade} {p.ano}
        </span>
      </h2>
      {p.candidato.nomeCivil && p.candidato.nomeCivil !== p.candidato.nome && (
        <p className="mt-0.5 text-[15px] text-slate-600">Nome do candidato: {p.candidato.nomeCivil}</p>
      )}
      <p className="mt-3 text-[17px] leading-relaxed font-semibold text-slate-900">{p.manchete}</p>
      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Resumo do perfil">
        {p.selos.map((s: any) => (
          <li key={s.id} className={`px-3 py-1 rounded-full text-sm font-bold ${s.destaque ? 'bg-[#0F2053] text-white' : 'bg-slate-100 text-slate-700'}`}>
            {s.texto}
          </li>
        ))}
      </ul>

      <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          [
            'Ficou em 1º lugar',
            `${g.venceu.urnas} de ${p.totalUrnas} urnas`,
            g.venceu.urnas ? `com ${pct(g.venceu.pct)} dos válidos nelas` : 'em nenhuma urna',
          ],
          ['Nas urnas mais fortes', `${pct(g.fortes.pct)} dos válidos`, `nas mais fracas: ${pct(g.fracas.pct)}`],
          ['Idade média (urnas fortes)', `${dec(g.fortes.ind.idadeMedia)} anos`, `cidade: ${dec(g.todas.ind.idadeMedia)} anos`],
          ['Anos de estudo (urnas fortes)', dec(g.fortes.ind.estudo), `cidade: ${dec(g.todas.ind.estudo)}`],
        ].map(([k, v, d]) => (
          <div key={k} className="p-4 rounded-xl bg-[#F4F7FB] min-w-0">
            <p className="text-sm text-slate-600">{k}</p>
            <p className="mt-1 text-lg font-bold text-[#0F2053] tabular-nums">{v}</p>
            <p className="text-xs text-slate-500">{d}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-700">
        <span className="inline-flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-sm" style={{ background: AZUL }} aria-hidden="true" />
          {g.fortes.urnas} urnas mais fortes (25%)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-sm" style={{ background: CINZA }} aria-hidden="true" />
          Média de {cidade}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Comparacao titulo="Idade do eleitorado" itens={['i16', 'i30', 'i45', 'i60'].map(ind)} g={g} />
        <Comparacao titulo="Escolaridade do eleitorado" itens={['e0', 'e1', 'e2', 'e3'].map(ind)} g={g} />
      </div>
      <p className="mt-3 text-sm text-slate-700">
        Mulheres: <strong>{pct(g.fortes.ind.mulheres)}</strong> do eleitorado nas urnas mais fortes (cidade: {pct(g.todas.ind.mulheres)}).
      </p>

      <h3 className="mt-6 font-bold text-[#0F2053]">Leitura</h3>
      <ul className="mt-2 space-y-1.5 list-disc pl-5 text-[15px] text-slate-800">
        {p.frases.map((f: string) => (
          <li key={f}>{f}</li>
        ))}
      </ul>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="min-w-0">
          <h3 className="font-bold text-[#0F2053]">Relação com a votação, urna por urna</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
            {p.relacoes.map((r: any) => (
              <li key={r.id}>
                <strong>{r.rotulo}</strong>: {r.r == null ? 'sem dados suficientes' : r.forca}
                {r.r != null && ` (r = ${dec(r.r, 2)})`}
                {r.r != null && Math.abs(r.r) >= 0.15 && ` · quanto ${r.r > 0 ? r.mais : r.menos}, maior a votação`}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            r vai de −1 a 1: perto de 0, sem relação; acima de 0,3 (ou abaixo de −0,3), relação que já aparece com clareza.
          </p>
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-[#0F2053]">Onde ficam as urnas mais fortes</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
            {p.locais.slice(0, 8).map((l: any) => (
              <li key={l.local}>
                <strong>{l.local}</strong>: {l.urnas} de {l.total} {l.total === 1 ? 'urna' : 'urnas'} · {num(l.votos)} votos
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h3 className="mt-6 font-bold text-[#0F2053]">As 10 urnas mais fortes</h3>
      <div className="mt-2 overflow-auto border border-slate-200 rounded-xl">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="p-2 font-semibold">Urna</th>
              <th className="p-2 font-semibold">Local</th>
              <th className="p-2 font-semibold text-right">Votos</th>
              <th className="p-2 font-semibold text-right">% válidos</th>
              <th className="p-2 font-semibold text-right">Idade média</th>
              <th className="p-2 font-semibold text-right">60 anos ou mais</th>
              <th className="p-2 font-semibold text-right">Ensino superior</th>
            </tr>
          </thead>
          <tbody>
            {p.melhores.map((u: any) => (
              <tr key={u.id} className="border-t border-slate-100 tabular-nums">
                <td className="p-2 whitespace-nowrap">
                  Seção {u.secao} <span className="text-xs text-slate-500">· Z{u.zona}</span>
                </td>
                <td className="p-2">{u.local}</td>
                <td className="p-2 text-right font-bold">{num(u.votos)}</td>
                <td className="p-2 text-right">{pct(u.pct)}</td>
                <td className="p-2 text-right">{u.ind ? `${dec(u.ind.idadeMedia)} anos` : '—'}</td>
                <td className="p-2 text-right">{pct(u.ind?.i60)}</td>
                <td className="p-2 text-right">{pct(u.ind?.e3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Trajetoria tr={tr} cidade={cidade} />

      <details className="mt-5">
        <summary className="cursor-pointer font-bold text-[#0478CA]">Tabela completa: onde ficou em 1º, urnas mais fortes, mais fracas e cidade</summary>
        <div className="mt-2 overflow-auto border border-slate-200 rounded-xl">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2 text-left font-semibold">Eleitorado da urna</th>
                {grupos.map(([k, nome]) => (
                  <th key={k} className="p-2 text-right font-semibold">
                    {nome}
                    <span className="block text-xs font-normal">{g[k].urnas} urnas</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100 font-bold">
                <td className="p-2">Votos do candidato (% dos válidos)</td>
                {grupos.map(([k]) => (
                  <td key={k} className="p-2 text-right tabular-nums">
                    {g[k].urnas ? pct(g[k].pct) : '—'}
                  </td>
                ))}
              </tr>
              {p.indicadores.map((d: any) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="p-2">{rotuloCompleto(d)}</td>
                  {grupos.map(([k]) => (
                    <td key={k} className="p-2 text-right tabular-nums">
                      {valor(k, d)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="mt-4 text-sm text-slate-500">{p.aviso}</p>
    </section>
  );
}

const corSituacao = (s: string) =>
  /^eleito/i.test(s) ? 'bg-[#128C4A] text-white' : /^suplente/i.test(s) ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700';

/** A mesma pessoa em outras eleições (cadastro do TSE): um cartão por ano, comparativo, redutos e locais */
function Trajetoria({ tr, cidade }: { tr: any; cidade: string }) {
  if (!tr) return null;
  const cs = tr.candidaturas;
  if (cs.length < 2)
    return (
      <p className="mt-6 p-4 rounded-xl bg-[#F4F7FB] text-[15px] text-slate-700">
        {tr.nomeCivil} não teve outra candidatura com voto em {cidade} entre 2016 e 2026, então não há outra eleição para comparar.
      </p>
    );
  const valorTxt = (x: any, tipo: string) => (x.valor == null ? '—' : tipo === 'pct' ? pct(x.valor) : `${dec(x.valor)} anos`);
  const difTxt = (x: any, tipo: string) =>
    x.dif == null ? '' : tipo === 'pct' ? `${x.dif >= 0 ? '+' : '−'}${dec(Math.abs(x.dif) * 100)} p.p.` : `${x.dif >= 0 ? '+' : '−'}${dec(Math.abs(x.dif))}`;
  return (
    <section aria-labelledby="traj-titulo" className="mt-8 pt-6 border-t-2 border-slate-200">
      <h3 id="traj-titulo" className="text-xl font-bold text-[#0F2053]">
        {tr.nomeCivil} em {cs.length} eleições
      </h3>
      <p className="mt-1 text-[15px] text-slate-600">
        Mesma pessoa no cadastro do TSE, mesmo quando muda o nome de urna, o partido ou o cargo. Votos em {cidade}.
      </p>

      <ol className={`mt-4 grid grid-cols-1 sm:grid-cols-2 ${cs.length > 2 ? 'xl:grid-cols-3' : ''} gap-3`}>
        {cs.map((c: any) => (
          <li key={`${c.ano}${c.id}`} className={`p-4 rounded-xl border-2 min-w-0 ${c.atual ? 'border-[#0F2053] bg-white' : 'border-slate-200 bg-[#F4F7FB]'}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-3xl font-bold tabular-nums text-[#0F2053]">{c.ano}</span>
              {c.situacao && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${corSituacao(c.situacao)}`}>{c.situacao}</span>}
            </div>
            <p className="mt-1 font-semibold text-slate-800">
              {c.cargo}
              {c.atual && <span className="ml-2 text-xs font-bold text-[#0478CA]">(esta eleição)</span>}
            </p>
            <p className="text-sm text-slate-600">
              {c.nome} · nº {c.numero} · {c.partido}
            </p>
            <p className="mt-2 text-lg font-bold tabular-nums text-[#0F2053]">
              {num(c.votos)} votos <span className="text-sm font-semibold text-slate-600">· {pct(c.pctValidos)} dos válidos</span>
            </p>
            <p className="text-sm text-slate-600">
              {c.posicao}º de {c.concorrentes} · 1º lugar em {c.urnasVencidas} de {c.urnas} urnas
            </p>
            {c.perfil?.selos && (
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Perfil dos redutos em ${c.ano}`}>
                {c.perfil.selos.map((s: any) => (
                  <li
                    key={s.id}
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.destaque ? 'bg-[#0F2053] text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
                  >
                    {s.texto}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>

      <h4 className="mt-6 font-bold text-[#0F2053]">Comparativo</h4>
      <ul className="mt-2 space-y-1.5 list-disc pl-5 text-[15px] text-slate-800">
        {tr.frases.map((f: string) => (
          <li key={f}>{f}</li>
        ))}
      </ul>

      <h4 className="mt-6 font-bold text-[#0F2053]">Redutos em cada eleição</h4>
      <p className="text-sm text-slate-600">Eleitorado das 25% urnas mais fortes e, embaixo, a diferença para a média da cidade naquele ano.</p>
      <div className="mt-2 overflow-auto border border-slate-200 rounded-xl">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-2 text-left font-semibold">Eleitorado</th>
              {cs.map((c: any) => (
                <th key={`${c.ano}${c.id}`} className="p-2 text-right font-semibold">
                  {c.ano}
                  <span className="block text-xs font-normal">{c.cargo}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tr.comparacao.map((x: any) => (
              <tr key={x.id} className="border-t border-slate-100 tabular-nums">
                <td className="p-2 text-slate-800">{x.rotulo}</td>
                {x.valores.map((v: any, i: number) => (
                  <td key={i} className="p-2 text-right">
                    {valorTxt(v, x.tipo)}
                    <span
                      className={`block text-xs ${v.dif != null && Math.abs(v.dif) >= (x.tipo === 'pct' ? 0.02 : 1) ? 'font-bold text-[#0F2053]' : 'text-slate-500'}`}
                    >
                      {difTxt(v, x.tipo)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="mt-6 font-bold text-[#0F2053]">Locais de votação em cada eleição</h4>
      <p className="text-sm text-slate-600">Fatia dos votos válidos do local (e os votos), começando pelos locais onde foi mais forte.</p>
      <div className="mt-2 overflow-auto border border-slate-200 rounded-xl">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-2 text-left font-semibold">Local</th>
              {cs.map((c: any) => (
                <th key={`${c.ano}${c.id}`} className="p-2 text-right font-semibold">
                  {c.ano}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tr.locais.slice(0, 10).map((l: any) => (
              <tr key={l.codigo} className="border-t border-slate-100 tabular-nums">
                <td className="p-2 text-slate-800">{l.local}</td>
                {l.por.map((x: any, i: number) => (
                  <td key={i} className="p-2 text-right">
                    {x ? (
                      <>
                        {pct(x.pct)}
                        <span className="block text-xs text-slate-500">{num(x.votos)} votos</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
