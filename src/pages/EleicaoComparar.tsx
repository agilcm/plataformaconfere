// Aba "Comparar candidatos" do painel eleitoral: escolhe dois candidatos (de qualquer cargo e ano, na mesma cidade) e
// mostra as conexões urna por urna: o mapa de pontos, a correlação, os redutos em comum, como um vai nos redutos do
// outro, os grupos de urnas e os locais. Excel e PDF.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/ui.tsx';
import { cargosDe, filtrar, resultadoCargo } from '../lib/eleicao.js';
import { QUADRANTES, compararCandidatos, dominioEixo, rotuloQuadrante, trechoTendencia } from '../lib/eleicaoComparar.js';
import { abasComparacao, blocosComparacao } from '../lib/eleicaoRelatorios.js';
import { dateText, downloadPdf, slug } from '../lib/pdfReport.ts';
import { baixarXlsx } from '../lib/xlsx.js';

export type Escolha = { ano: number; cargo: string; id: string };

const num = (v: number) => Number(v || 0).toLocaleString('pt-BR');
const pct = (v: number | null | undefined, casas = 1) =>
  v == null ? '—' : `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
const dec = (v: number | null | undefined, casas = 2) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const pontos = (d: number) => {
  const v = Math.round(Math.abs(d) * 1000) / 10;
  return v === 0
    ? 'igual à média'
    : `${d > 0 ? '+' : '−'}${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${v >= 2 ? 'pontos' : 'ponto'} sobre a média`;
};
const card = 'p-5 sm:p-6 rounded-2xl bg-white border border-slate-200';
const selectCls = 'w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-[15px] text-[#0F2053] focus:outline-none focus:border-[#0478CA]';
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const COR_A = '#D97706';
const COR_B = '#7C3AED';
const corQ = (id: string) => QUADRANTES.find((q) => q.id === id)?.cor || '#94A3B8';

type Props = { dados: any; cidade: string; anos: number[]; a: Escolha; b: Escolha; setA: (e: Escolha) => void; setB: (e: Escolha) => void };

export default function AbaComparar({ dados, cidade, anos, a, b, setA, setB }: Props) {
  const [gerando, setGerando] = useState('');
  const pronto = !!(a.id && b.id && !(a.id === b.id && a.ano === b.ano));
  const o: any = useMemo(() => (pronto ? compararCandidatos(dados, { cidade, a, b }) : null), [pronto, dados, cidade, a, b]);
  const nomeArquivo = (ext: string) =>
    o ? `comparacao-${slug(cidade)}-${slug(o.ca.nome)}-${o.a.ano}-x-${slug(o.cb.nome)}-${o.b.ano}.${ext}` : `comparacao.${ext}`;
  const baixarPdf = async () => {
    if (!o) return;
    setGerando('Gerando o PDF…');
    try {
      await downloadPdf(nomeArquivo('pdf'), `Comparação de candidatos · ${cidade}`, blocosComparacao(o, { dataText: dateText() }) as never);
    } finally {
      setGerando('');
    }
  };

  return (
    <div className="space-y-4">
      <div className={card}>
        <p className="text-lg font-bold text-[#0F2053]">Comparar dois candidatos</p>
        <p className="mt-1 text-[15px] text-slate-600 max-w-3xl">
          Escolha dois candidatos de {cidade}, de qualquer cargo e ano (por exemplo, um vereador e um prefeito). A comparação mostra se os dois vão bem nas
          mesmas urnas, quantos redutos dividem e quem é o eleitorado onde os dois são fortes.
        </p>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Escolher titulo="Primeiro candidato" cor={COR_A} dados={dados} cidade={cidade} anos={anos} sel={a} setSel={setA} />
          <Escolher titulo="Segundo candidato" cor={COR_B} dados={dados} cidade={cidade} anos={anos} sel={b} setSel={setB} />
        </div>
        {a.id && b.id && !pronto && <p className="mt-3 text-sm text-amber-800">Escolha dois candidatos diferentes.</p>}
      </div>

      {!o ? (
        <p className={`${card} text-slate-600`}>Escolha os dois candidatos acima para ver as conexões entre eles.</p>
      ) : o.insuficiente ? (
        <p className={`${card} text-slate-600`}>
          Há só {o.N} urnas em comum entre essas duas eleições: poucas para comparar. Escolha candidatos do mesmo ano ou de anos com as mesmas seções.
        </p>
      ) : (
        <Resultado
          o={o}
          cidade={cidade}
          baixarPdf={baixarPdf}
          baixarExcel={() => baixarXlsx(nomeArquivo('xlsx'), abasComparacao(o) as never)}
          gerando={gerando}
        />
      )}
    </div>
  );
}

/** Escolha de um candidato: ano, cargo e busca (nome de urna, nome do candidato, número ou partido) */
function Escolher({
  titulo,
  cor,
  dados,
  cidade,
  anos,
  sel,
  setSel,
}: {
  titulo: string;
  cor: string;
  dados: any;
  cidade: string;
  anos: number[];
  sel: Escolha;
  setSel: (e: Escolha) => void;
}) {
  const [busca, setBusca] = useState('');
  const votos = useMemo(() => filtrar(dados, { cidade, ano: sel.ano }).votos, [dados, cidade, sel.ano]);
  const cargos: string[] = useMemo(() => cargosDe(votos), [votos]);
  const cargo = cargos.includes(sel.cargo) ? sel.cargo : cargos[0] || '';
  const candidatos = useMemo(() => (cargo ? resultadoCargo(votos, cargo).candidatos : []), [votos, cargo]);
  const atual = candidatos.find((c: any) => c.id === sel.id);
  const t = semAcento(busca.trim());
  const lista = candidatos.filter((c: any) => !t || semAcento(`${c.nome} ${c.nomeCivil} ${c.numero} ${c.partido}`).includes(t)).slice(0, t ? 30 : 8);
  return (
    <fieldset className="min-w-0 p-4 rounded-xl border-2" style={{ borderColor: cor }}>
      <legend className="px-2 font-bold text-[#0F2053]">
        <span className="inline-block w-3 h-3 mr-2 rounded-full align-middle" style={{ background: cor }} aria-hidden="true" />
        {titulo}
      </legend>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="block text-sm font-semibold text-slate-700 mb-1">Ano</span>
          <select value={sel.ano} onChange={(e) => setSel({ ano: Number(e.target.value), cargo, id: '' })} className={selectCls}>
            {anos.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="block text-sm font-semibold text-slate-700 mb-1">Cargo</span>
          <select value={cargo} onChange={(e) => setSel({ ano: sel.ano, cargo: e.target.value, id: '' })} className={selectCls}>
            {cargos.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      {atual ? (
        <div className="mt-3 flex items-start justify-between gap-3 p-3 rounded-xl bg-[#F4F7FB]">
          <div className="min-w-0">
            <p className="font-bold text-[#0F2053]">{atual.nome}</p>
            <p className="text-sm text-slate-600">
              {atual.nomeCivil && atual.nomeCivil !== atual.nome && <span className="block">{atual.nomeCivil}</span>}
              nº {atual.numero} · {atual.partido} · {num(atual.votos)} votos ({pct(atual.pctValidos)}){atual.situacao ? ` · ${atual.situacao}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSel({ ano: sel.ano, cargo, id: '' })}
            className="shrink-0 text-sm font-bold text-[#0369B3] underline cursor-pointer"
          >
            Trocar
          </button>
        </div>
      ) : (
        <>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={`Buscar ${cargo.toLowerCase()} por nome, número ou partido`}
            aria-label={`Buscar ${titulo.toLowerCase()}`}
            className="mt-3 w-full px-3 py-2.5 rounded-xl border border-slate-300 text-[15px] focus:outline-none focus:border-[#0478CA]"
          />
          <ul className="mt-2 max-h-64 overflow-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {lista.map((c: any) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSel({ ano: sel.ano, cargo, id: c.id })}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 cursor-pointer"
                >
                  <span className="w-8 shrink-0 text-right text-sm tabular-nums text-slate-500">{c.posicao}º</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-slate-800 truncate">{c.nome}</span>
                    <span className="block text-xs text-slate-500 truncate">
                      {c.nomeCivil && c.nomeCivil !== c.nome ? `${c.nomeCivil} · ` : ''}
                      {c.numero} · {c.partido}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums font-semibold text-slate-700">{num(c.votos)}</span>
                </button>
              </li>
            ))}
            {!lista.length && <li className="px-3 py-2 text-sm text-slate-600">Nenhum candidato com esse nome.</li>}
          </ul>
        </>
      )}
    </fieldset>
  );
}

function Resultado({
  o,
  cidade,
  baixarPdf,
  baixarExcel,
  gerando,
}: {
  o: any;
  cidade: string;
  baixarPdf: () => void;
  baixarExcel: () => void;
  gerando: string;
}) {
  const A = o.ca.nome;
  const B = o.cb.nome;
  const q = Object.fromEntries(o.quadrantes.map((x: any) => [x.id, x]));
  return (
    <section aria-labelledby="cmp-titulo" className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-[#0F2053]">
      <p className="text-sm font-bold text-[#0369B3]">Conexões nas urnas de {cidade}</p>
      <h2 id="cmp-titulo" className="mt-1 text-xl sm:text-2xl font-bold text-[#0F2053] leading-snug">
        <span style={{ color: COR_A }}>●</span> {A} <span className="text-slate-500 font-semibold">e</span> <span style={{ color: COR_B }}>●</span> {B}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {o.a.cargo} {o.a.ano} ({o.ca.partido}) · {o.b.cargo} {o.b.ano} ({o.cb.partido}) · {o.N} urnas comparadas
        {o.mesmoPartido && ' · mesmo partido'}
      </p>
      <p className="mt-3 text-[17px] leading-relaxed font-semibold text-slate-900 max-w-4xl">{o.manchete}</p>

      <ComoLer c={o.comoLer} />

      <div className="mt-5 grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 min-w-0">
          <MapaUrnas o={o} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3 content-start">
          <Numero
            rotulo="Correlação nas urnas"
            valor={dec(o.rho)}
            nota={`${o.ligacao.curto}${o.ic ? ` · 95%: ${dec(o.ic[0])} a ${dec(o.ic[1])}` : ''}${o.p != null ? ` · p ${o.p < 0.001 ? '< 0,001' : `= ${dec(o.p, 3)}`}` : ''}`}
          />
          <Numero
            rotulo="Redutos em comum"
            valor={`${o.sobreposicao.comuns} de ${o.sobreposicao.redutosA}`}
            nota={`Por acaso seriam cerca de ${Math.round(o.sobreposicao.esperado)} (25% urnas mais fortes de cada um)`}
          />
          <Numero rotulo={`${B} nos redutos de ${A}`} valor={pct(o.cruzado.bNosRedutosDeA)} nota={pontos(o.cruzado.bNosRedutosDeA - o.mediaB)} />
          <Numero rotulo={`${A} nos redutos de ${B}`} valor={pct(o.cruzado.aNosRedutosDeB)} nota={pontos(o.cruzado.aNosRedutosDeB - o.mediaA)} />
        </div>
      </div>

      <h3 className="mt-6 font-bold text-[#0F2053]">Leitura</h3>
      <ul className="mt-2 space-y-1.5 list-disc pl-5 text-[15px] text-slate-800 max-w-4xl">
        {o.frases.map((f: string) => (
          <li key={f}>{f}</li>
        ))}
      </ul>

      <h3 className="mt-6 font-bold text-[#0F2053]">Grupos de urnas</h3>
      <p className="text-sm text-slate-600">Cada urna entra num grupo conforme cada candidato ficou acima ou abaixo da própria média na cidade.</p>
      <div className="mt-2 overflow-auto border border-slate-200 rounded-xl">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="p-2 font-semibold">Grupo</th>
              <th className="p-2 font-semibold text-right">Urnas</th>
              <th className="p-2 font-semibold text-right">% {A}</th>
              <th className="p-2 font-semibold text-right">% {B}</th>
              <th className="p-2 font-semibold text-right">Idade média</th>
              <th className="p-2 font-semibold text-right">Ensino superior</th>
              <th className="p-2 font-semibold">Eleitorado</th>
            </tr>
          </thead>
          <tbody>
            {o.quadrantes.map((x: any) => (
              <tr key={x.id} className="border-t border-slate-100 tabular-nums">
                <td className="p-2">
                  <span className="inline-block w-2.5 h-2.5 mr-2 rounded-full align-middle" style={{ background: x.cor }} aria-hidden="true" />
                  {rotuloQuadrante(x.id, o)}
                </td>
                <td className="p-2 text-right font-semibold">{x.urnas}</td>
                <td className="p-2 text-right">{x.urnas ? pct(x.pctA) : '—'}</td>
                <td className="p-2 text-right">{x.urnas ? pct(x.pctB) : '—'}</td>
                <td className="p-2 text-right">{x.urnas && x.ind.idadeMedia != null ? `${dec(x.ind.idadeMedia, 1)} anos` : '—'}</td>
                <td className="p-2 text-right">{x.urnas ? pct(x.ind.e3) : '—'}</td>
                <td className="p-2 text-slate-700">
                  {x.leitura ? [x.leitura.idade, x.leitura.escolaridade, x.leitura.genero].filter(Boolean).join(', ') || 'na média da cidade' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-6 font-bold text-[#0F2053]">Locais de votação</h3>
      <p className="text-sm text-slate-600">Começa pelos locais onde os dois, somados, vão mais acima das próprias médias.</p>
      <div className="mt-2 overflow-auto max-h-[60vh] border border-slate-200 rounded-xl">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="p-2 font-semibold">Local</th>
              <th className="p-2 font-semibold text-right">Urnas</th>
              <th className="p-2 font-semibold text-right">% {A}</th>
              <th className="p-2 font-semibold text-right">% {B}</th>
              <th className="p-2 font-semibold">Grupo</th>
            </tr>
          </thead>
          <tbody>
            {o.locais.map((l: any) => (
              <tr key={l.local} className="border-t border-slate-100 tabular-nums">
                <td className="p-2 text-slate-800">{l.local}</td>
                <td className="p-2 text-right">{l.urnas}</td>
                <td className="p-2 text-right">{pct(l.pA)}</td>
                <td className="p-2 text-right">{pct(l.pB)}</td>
                <td className="p-2">
                  <span className="inline-block w-2.5 h-2.5 mr-2 rounded-full align-middle" style={{ background: corQ(l.quadrante) }} aria-hidden="true" />
                  {rotuloQuadrante(l.quadrante, o)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="mt-5">
        <summary className="cursor-pointer font-bold text-[#0369B3]">Urna por urna ({o.N} urnas)</summary>
        <div className="mt-2 overflow-auto max-h-[60vh] border border-slate-200 rounded-xl">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="p-2 font-semibold">Urna</th>
                <th className="p-2 font-semibold">Local</th>
                <th className="p-2 font-semibold text-right">{A}</th>
                <th className="p-2 font-semibold text-right">{B}</th>
                <th className="p-2 font-semibold">Grupo</th>
              </tr>
            </thead>
            <tbody>
              {o.pares.map((p: any) => (
                <tr key={p.id} className="border-t border-slate-100 tabular-nums">
                  <td className="p-2 whitespace-nowrap">
                    Seção {p.secao} <span className="text-xs text-slate-500">· Z{p.zona}</span>
                  </td>
                  <td className="p-2">{p.local}</td>
                  <td className="p-2 text-right">
                    {num(p.votosA)} <span className="text-xs text-slate-500">({pct(p.pA)})</span>
                  </td>
                  <td className="p-2 text-right">
                    {num(p.votosB)} <span className="text-xs text-slate-500">({pct(p.pB)})</span>
                  </td>
                  <td className="p-2">{rotuloQuadrante(p.quadrante, o)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="mt-5 flex flex-wrap items-center gap-2">
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
          <Icon name="doc" className="w-5 h-5" /> Baixar PDF da comparação
        </button>
        {gerando && (
          <span className="text-sm text-slate-600" aria-live="polite">
            {gerando}
          </span>
        )}
      </div>
      <p className="mt-4 text-sm text-slate-500 max-w-4xl">{o.aviso}</p>
    </section>
  );
}

/** "Como ler o gráfico": passos com os números desta comparação (aberto; dá para recolher) */
function ComoLer({ c }: { c: any }) {
  return (
    <details open className="mt-5 rounded-xl border border-slate-200 bg-[#F4F7FB]">
      <summary className="cursor-pointer select-none px-4 py-3 font-bold text-[#0F2053]">Como ler o gráfico</summary>
      <ol className="px-4 pb-4 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
        {c.passos.map((p: any, i: number) => (
          <li key={p.titulo} className="flex gap-3 min-w-0">
            <span className="shrink-0 w-7 h-7 rounded-full bg-[#0F2053] text-white text-sm font-bold grid place-items-center" aria-hidden="true">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-bold text-[#0F2053]">{p.titulo}</p>
              <p className="mt-0.5 text-[15px] leading-relaxed text-slate-700">{p.texto}</p>
              {i === 2 && (
                <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                  {c.grupos.map((g: any) => (
                    <li key={g.id} className="flex items-start gap-2">
                      <span className="mt-1 w-3 h-3 rounded-full shrink-0" style={{ background: g.cor }} aria-hidden="true" />
                      <span>
                        <strong>{g.rotulo}</strong>, {g.onde}: {g.urnas} {g.urnas === 1 ? 'urna' : 'urnas'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}

function Numero({ rotulo, valor, nota }: { rotulo: string; valor: string; nota: string }) {
  return (
    <div className="p-4 rounded-xl bg-[#F4F7FB] min-w-0">
      <p className="text-sm text-slate-600">{rotulo}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums text-[#0F2053]">{valor}</p>
      <p className="text-xs text-slate-600">{nota}</p>
    </div>
  );
}

/** Mapa das urnas: cada ponto é uma urna (x = fatia do primeiro, y = fatia do segundo); linhas = médias de cada um */
function MapaUrnas({ o }: { o: any }) {
  const [sel, setSel] = useState<any>(null);
  // desenha na largura real da caixa: no celular o texto do gráfico continua legível
  const [W, setW] = useState(640);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = Math.round(Math.min(440, Math.max(300, W * 0.66)));
  const m = { l: 50, r: 12, t: 14, b: 44 };
  const dx = dominioEixo(o.pares.map((p: any) => p.pA));
  const dy = dominioEixo(o.pares.map((p: any) => p.pB));
  const X = (v: number) => m.l + ((Math.max(dx.min, Math.min(v, dx.max)) - dx.min) / (dx.max - dx.min)) * (W - m.l - m.r);
  const Y = (v: number) => H - m.b - ((Math.max(dy.min, Math.min(v, dy.max)) - dy.min) / (dy.max - dy.min)) * (H - m.t - m.b);
  const ticks = [0, 1, 2, 3, 4];
  const tx = (i: number) => dx.min + ((dx.max - dx.min) * i) / 4;
  const ty = (i: number) => dy.min + ((dy.max - dy.min) * i) / 4;
  const tick = (v: number) => `${(Math.round(v * 1000) / 10).toLocaleString('pt-BR')}%`;
  const trecho = trechoTendencia(o.tendencia, dx, dy);
  const q = Object.fromEntries(o.quadrantes.map((x: any) => [x.id, x]));
  return (
    <figure className="min-w-0">
      <figcaption className="font-bold text-[#0F2053]">Mapa das urnas</figcaption>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700" aria-label="Legenda">
        {QUADRANTES.map((x) => (
          <li key={x.id} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: x.cor }} aria-hidden="true" />
            {rotuloQuadrante(x.id, o)} ({q[x.id].urnas})
          </li>
        ))}
      </ul>
      <div ref={caixa} className="mt-2 w-full">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block max-w-full h-auto select-none"
          role="img"
          aria-label={`Mapa de ${o.N} urnas: fatia de ${o.ca.nome} no eixo horizontal e de ${o.cb.nome} no vertical`}
        >
          {ticks.map((i) => (
            <g key={i}>
              <line x1={X(tx(i))} x2={X(tx(i))} y1={m.t} y2={H - m.b} stroke="#E3E8EF" strokeWidth={1} />
              <line x1={m.l} x2={W - m.r} y1={Y(ty(i))} y2={Y(ty(i))} stroke="#E3E8EF" strokeWidth={1} />
              <text x={X(tx(i))} y={H - m.b + 16} textAnchor="middle" fontSize={11} fill="#5B6B7F">
                {tick(tx(i))}
              </text>
              <text x={m.l - 6} y={Y(ty(i)) + 4} textAnchor="end" fontSize={11} fill="#5B6B7F">
                {tick(ty(i))}
              </text>
            </g>
          ))}
          <line x1={X(o.mediaA)} x2={X(o.mediaA)} y1={m.t} y2={H - m.b} stroke="#64748B" strokeWidth={1.2} />
          <line x1={m.l} x2={W - m.r} y1={Y(o.mediaB)} y2={Y(o.mediaB)} stroke="#64748B" strokeWidth={1.2} />
          <text x={X(o.mediaA) + 4} y={m.t + 11} fontSize={11} fill="#334155">
            média {tick(o.mediaA)}
          </text>
          <text x={W - m.r - 4} y={Y(o.mediaB) - 5} textAnchor="end" fontSize={11} fill="#334155">
            média {tick(o.mediaB)}
          </text>
          {trecho && (
            <line x1={X(trecho[0][0])} y1={Y(trecho[0][1])} x2={X(trecho[1][0])} y2={Y(trecho[1][1])} stroke="#0F2053" strokeOpacity={0.45} strokeWidth={2} />
          )}
          {o.pares.map((p: any) => (
            <g key={p.id} onMouseEnter={() => setSel(p)} onClick={() => setSel(p)} className="cursor-pointer">
              <circle cx={X(p.pA)} cy={Y(p.pB)} r={10} fill="transparent" />
              <circle
                cx={X(p.pA)}
                cy={Y(p.pB)}
                r={sel?.id === p.id ? 7 : 5}
                fill={corQ(p.quadrante)}
                stroke={sel?.id === p.id ? '#0F2053' : 'white'}
                strokeWidth={sel?.id === p.id ? 2.5 : 1.5}
              />
            </g>
          ))}
          <text x={m.l + (W - m.l - m.r) / 2} y={H - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill="#1F2933">
            % dos válidos de {o.ca.nome} na urna →
          </text>
          <text
            x={14}
            y={m.t + (H - m.t - m.b) / 2}
            textAnchor="middle"
            fontSize={12}
            fontWeight={700}
            fill="#1F2933"
            transform={`rotate(-90 14 ${m.t + (H - m.t - m.b) / 2})`}
          >
            % de {o.cb.nome} →
          </text>
        </svg>
      </div>
      <p className="mt-1 min-h-[2.75rem] text-sm text-slate-700" aria-live="polite">
        {sel ? (
          <>
            <strong>
              Seção {sel.secao} (zona {sel.zona})
            </strong>{' '}
            · {sel.local}: {o.ca.nome} {num(sel.votosA)} votos ({pct(sel.pA)}) · {o.cb.nome} {num(sel.votosB)} votos ({pct(sel.pB)}) ·{' '}
            {rotuloQuadrante(sel.quadrante, o)}
          </>
        ) : (
          'Passe o mouse ou toque num ponto para ver a urna.'
        )}
      </p>
    </figure>
  );
}
