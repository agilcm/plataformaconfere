// Painel Tendência: quantos editais com um produto/serviço saíram por mês, se está em alta ou em baixa,
// em que meses mais aparece e quem mais compra (lógica em lib/tendencia.js).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/ui.tsx';
import { formatBRL } from '../data/servicesData.ts';
import { analisarTendencia, buscarTendencia, rotuloMes } from '../lib/tendencia.js';

type Regiao = 'zona-da-mata' | 'mg' | 'brasil';
const REGIOES: [Regiao, string][] = [
  ['zona-da-mata', 'Zona da Mata'],
  ['mg', 'Minas Gerais'],
  ['brasil', 'Brasil'],
];
const SUGESTOES = [
  'toner',
  'material de limpeza',
  'gêneros alimentícios',
  'material escolar',
  'material de expediente',
  'brinquedos',
  'uniformes',
  'informática',
];

const abreviar = (v: number) =>
  v >= 1e9
    ? `R$ ${(v / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`
    : v >= 1e6
      ? `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
      : v >= 1e3
        ? `R$ ${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
        : formatBRL(v, 0);
const pct = (x: number) => `${x > 0 ? '+' : ''}${Math.round(x * 100)}%`;

export default function TendenciaPanel({ termoInicial, regiaoInicial, onClose }: { termoInicial: string; regiaoInicial: Regiao; onClose: () => void }) {
  const [termo, setTermo] = useState(termoInicial);
  const [regiao, setRegiao] = useState<Regiao>(regiaoInicial);
  const [meses, setMeses] = useState(regiaoInicial === 'brasil' ? 12 : 24);
  const [estado, setEstado] = useState<'idle' | 'loading' | 'ok' | 'erro'>('idle');
  const [prog, setProg] = useState<{ lidos: number; total: number } | null>(null);
  const [res, setRes] = useState<Awaited<ReturnType<typeof buscarTendencia>> | null>(null);
  const [tabela, setTabela] = useState(false);
  const pedido = useRef(0);
  const a = useMemo(() => (res ? analisarTendencia(res) : null), [res]);

  const ver = async (t = termo, reg = regiao, m = meses) => {
    const q = t.trim();
    if (q.length < 3) return;
    const id = ++pedido.current;
    setTermo(q);
    setEstado('loading');
    setProg(null);
    try {
      const r = await buscarTendencia({ q, regiao: reg, meses: m, onProgress: (lidos, total) => id === pedido.current && setProg({ lidos, total }) });
      if (id !== pedido.current) return;
      setRes(r);
      setEstado('ok');
    } catch {
      if (id === pedido.current) setEstado('erro');
    }
  };

  // abriu com uma palavra na busca: já mostra a tendência dela
  useEffect(() => {
    if (termoInicial.trim().length >= 3) ver(termoInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nomeRegiao = REGIOES.find(([v]) => v === res?.regiao)?.[1] || '';

  return (
    <section id="tendencia" aria-label="Tendência" className="mt-6 p-5 sm:p-6 rounded-2xl bg-white border-2 border-[#0478CA]/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-bold text-[#0F2053]">Tendência</h2>
          <p className="mt-1 text-[15px] text-slate-600 leading-relaxed">
            Quantos editais com um produto ou serviço saíram por mês (abertos e encerrados, no PNCP): se a procura está em alta ou em baixa, em que meses do ano
            mais aparece e quem mais compra. Bom para planejar estoque, fornecedores e onde se cadastrar.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm font-bold text-slate-600 underline cursor-pointer">
          Fechar
        </button>
      </div>

      <form
        className="mt-4 flex flex-col lg:flex-row gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          ver();
        }}
      >
        <label className="relative flex-1 min-w-0">
          <span className="sr-only">Produto ou serviço</span>
          <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Produto ou serviço (ex.: toner, material de limpeza)"
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 text-base focus:outline-none focus:border-[#0478CA] focus:ring-2 focus:ring-[#0478CA]/20"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <select
            value={regiao}
            onChange={(e) => {
              const r = e.target.value as Regiao;
              setRegiao(r);
              if (r === 'brasil' && meses > 12) setMeses(12);
            }}
            aria-label="Região"
            className="px-3.5 py-3 rounded-xl border border-slate-300 text-base font-semibold bg-white cursor-pointer focus:outline-none focus:border-[#0478CA]"
          >
            {REGIOES.map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
          <select
            value={meses}
            onChange={(e) => setMeses(Number(e.target.value))}
            aria-label="Período"
            className="px-3.5 py-3 rounded-xl border border-slate-300 text-base font-semibold bg-white cursor-pointer focus:outline-none focus:border-[#0478CA]"
          >
            <option value={12}>Últimos 12 meses</option>
            <option value={24}>Últimos 24 meses</option>
          </select>
          <button
            type="submit"
            disabled={estado === 'loading' || termo.trim().length < 3}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#0F2053] hover:bg-[#13306f] text-white font-extrabold cursor-pointer disabled:opacity-50"
          >
            <Icon name="chart" className="w-5 h-5" /> Ver tendência
          </button>
        </div>
      </form>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Sugestões">
        {SUGESTOES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => ver(s)}
            className="px-3 py-1.5 rounded-full text-sm font-semibold border border-slate-200 bg-[#F7FAFD] text-slate-700 hover:border-[#0478CA] cursor-pointer"
          >
            {s}
          </button>
        ))}
      </div>

      {estado === 'loading' && (
        <div className="mt-5" aria-live="polite">
          <p className="text-[15px] text-slate-700">
            Lendo no PNCP os editais com “{termo}”{prog?.total ? `: ${prog.lidos.toLocaleString('pt-BR')} de ${prog.total.toLocaleString('pt-BR')}` : '…'}
          </p>
          <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full bg-[#0478CA] transition-all ${prog?.total ? '' : 'w-1/3 animate-pulse'}`}
              style={prog?.total ? { width: `${Math.min(100, (prog.lidos / prog.total) * 100)}%` } : undefined}
            />
          </div>
        </div>
      )}
      {estado === 'erro' && (
        <p className="mt-5 text-[15px] text-amber-900">
          O PNCP não respondeu agora (ele cai com frequência).{' '}
          <button type="button" onClick={() => ver()} className="font-bold underline cursor-pointer">
            Tentar de novo
          </button>
        </p>
      )}

      {estado === 'ok' && res && a && (
        <div className="mt-6">
          <p className="text-lg font-bold text-[#0F2053]">
            “{res.q}” · {nomeRegiao} · desde {rotuloMes(a.meses[0]?.mes || res.desde)}
          </p>
          {!a.total ? (
            <p className="mt-2 text-[15px] text-slate-600">Nenhum edital com essa palavra no período. Tente outra palavra ou uma região maior.</p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Tile
                  titulo="Editais no período"
                  valor={a.total.toLocaleString('pt-BR')}
                  sub={`média de ${a.mediaMensal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} por mês`}
                />
                <div>
                  <p className="text-sm text-slate-500">Tendência</p>
                  <p
                    className={`text-2xl font-extrabold ${a.status === 'alta' ? 'text-emerald-700' : a.status === 'baixa' ? 'text-red-700' : 'text-[#0F2053]'}`}
                  >
                    {a.status === 'alta' ? '↑ Em alta' : a.status === 'baixa' ? '↓ Em baixa' : a.status === 'estavel' ? '→ Estável' : '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {a.variacao !== null ? `${pct(a.variacao)} nos últimos 3 meses × 3 anteriores` : 'precisa de 6 meses completos'}
                    {a.anual !== null ? ` · ${pct(a.anual)} em 12 meses × 12 anteriores` : ''}
                  </p>
                </div>
                <Tile titulo="Valor estimado somado" valor={abreviar(a.valor)} sub={`valor total desses editais (todos os itens, não só “${res.q}”)`} />
                <Tile titulo="Recebendo propostas agora" valor={a.abertos.toLocaleString('pt-BR')} sub="desses editais" />
              </div>

              <Grafico meses={a.meses} />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                <span>
                  Editais publicados por mês com “{res.q}” no objeto (a busca do PNCP traz também editais parecidos, que ficam de fora). A última barra é o mês
                  em andamento.
                  {a.fortes.length > 0 && (
                    <>
                      {' '}
                      Meses que costumam ter mais: <strong className="text-slate-700">{a.fortes.join(', ')}</strong>.
                    </>
                  )}
                </span>
                <button type="button" onClick={() => setTabela((v) => !v)} className="font-bold text-[#0369B3] underline cursor-pointer">
                  {tabela ? 'Esconder tabela' : 'Ver em tabela'}
                </button>
              </div>
              {tabela && (
                <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-200">
                  <table className="w-full text-[15px]">
                    <thead className="bg-[#F7FAFD] text-left text-sm text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Mês</th>
                        <th className="px-3 py-2 font-semibold text-right">Editais</th>
                        <th className="px-3 py-2 font-semibold text-right">Valor estimado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...a.meses].reverse().map((m) => (
                        <tr key={m.mes} className="border-t border-slate-100">
                          <td className="px-3 py-1.5">
                            {rotuloMes(m.mes)}
                            {m.emAndamento ? ' (em andamento)' : ''}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{m.n.toLocaleString('pt-BR')}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{m.valor ? formatBRL(m.valor, 0) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!res.completo && (
                <p className="mt-2 text-sm text-amber-900">
                  Palavra muito comum: li os {res.lidos.toLocaleString('pt-BR')} editais mais recentes de {res.total.toLocaleString('pt-BR')}. O gráfico começa
                  no primeiro mês lido por inteiro.
                </p>
              )}

              <div className="mt-6 grid lg:grid-cols-2 gap-6">
                <Ranking titulo="Cidades que mais compram" itens={a.cidades} />
                <Ranking titulo="Órgãos que mais compram" itens={a.orgaos} />
              </div>
              {a.modalidades.length > 1 && (
                <div className="mt-5">
                  <p className="text-sm font-semibold text-slate-600 mb-2">Modalidades</p>
                  <div className="flex flex-wrap gap-2">
                    {a.modalidades.slice(0, 6).map((m) => (
                      <span key={m.nome} className="px-3 py-1.5 rounded-full text-sm font-semibold bg-[#F7FAFD] border border-slate-200 text-slate-700">
                        {m.nome} <span className="text-slate-500">· {m.n.toLocaleString('pt-BR')}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-6">
                <p className="text-sm font-semibold text-slate-600 mb-2">Editais mais recentes com “{res.q}”</p>
                <ul className="divide-y divide-slate-100">
                  {a.recentes.map((e) => (
                    <li key={e.id} className="py-2.5 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 text-[15px]">
                      <span className="shrink-0 w-24 text-sm text-slate-500 tabular-nums">
                        {e.pub.slice(8, 10) + '/' + e.pub.slice(5, 7) + '/' + e.pub.slice(0, 4)}
                      </span>
                      <span className="flex-1 min-w-0">
                        <strong className="text-slate-800">{e.municipio}</strong> <span className="text-slate-600 line-clamp-1">{e.objeto}</span>
                      </span>
                      {e.link && (
                        <a href={e.link} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm font-bold text-[#0369B3] underline">
                          Ver no PNCP
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Tile({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <div>
      <p className="text-sm text-slate-500">{titulo}</p>
      <p className="text-2xl font-extrabold text-[#0F2053] tabular-nums">{valor}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function Ranking({ titulo, itens }: { titulo: string; itens: { nome: string; n: number; valor: number }[] }) {
  const max = Math.max(1, ...itens.map((x) => x.n));
  return (
    <div>
      <p className="text-sm font-semibold text-slate-600 mb-2">{titulo}</p>
      <ul className="space-y-2">
        {itens.map((x) => (
          <li key={x.nome} className="text-[15px]">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-slate-800" title={x.nome}>
                {x.nome}
              </span>
              <span className="shrink-0 tabular-nums text-slate-600">
                {x.n.toLocaleString('pt-BR')} {x.n === 1 ? 'edital' : 'editais'}
                {x.valor ? ` · ${abreviar(x.valor)}` : ''}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[#0478CA]" style={{ width: `${(x.n / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Barras por mês (uma série: sem legenda; o título diz o que é). Passe o mouse para ver o número.
function Grafico({ meses }: { meses: { mes: string; n: number; valor: number; emAndamento: boolean }[] }) {
  const [foco, setFoco] = useState<number | null>(null);
  const W = 760;
  const H = 230;
  const pad = { l: 36, r: 8, t: 12, b: 34 };
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;
  const max = Math.max(1, ...meses.map((m) => m.n));
  const passo = max <= 4 ? 1 : Math.ceil(max / 4 / Math.pow(10, Math.floor(Math.log10(max / 4)))) * Math.pow(10, Math.floor(Math.log10(max / 4)));
  const topo = Math.ceil(max / passo) * passo;
  const linhas = Array.from({ length: Math.floor(topo / passo) + 1 }, (_, i) => i * passo);
  const col = pw / meses.length;
  const larg = Math.max(4, Math.min(28, col - 2));
  const y = (v: number) => pad.t + ph - (v / topo) * ph;
  const mostrarRotulo = (i: number) => meses.length <= 13 || i % 2 === (meses.length - 1) % 2;
  const f = foco !== null ? meses[foco] : null;
  return (
    <div className="mt-5 relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Editais por mês: ${meses.map((m) => `${rotuloMes(m.mes)} ${m.n}`).join(', ')}`}
      >
        <defs>
          <pattern id="em-andamento" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#0478CA" opacity="0.35" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#0478CA" strokeWidth="2.5" />
          </pattern>
        </defs>
        {linhas.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#94a3b8' : '#e2e8f0'} strokeWidth="1" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#64748b">
              {v.toLocaleString('pt-BR')}
            </text>
          </g>
        ))}
        {meses.map((m, i) => {
          const x = pad.l + i * col + (col - larg) / 2;
          const h = Math.max(0, y(0) - y(m.n));
          const r = Math.min(4, larg / 2, h);
          return (
            <g key={m.mes}>
              {h > 0 && (
                <path
                  d={`M${x},${y(0)} V${y(m.n) + r} Q${x},${y(m.n)} ${x + r},${y(m.n)} H${x + larg - r} Q${x + larg},${y(m.n)} ${x + larg},${y(m.n) + r} V${y(0)} Z`}
                  fill={m.emAndamento ? 'url(#em-andamento)' : '#0478CA'}
                  opacity={foco === null || foco === i ? 1 : 0.55}
                />
              )}
              {mostrarRotulo(i) && (
                <text x={pad.l + i * col + col / 2} y={H - pad.b + 15} textAnchor="middle" fontSize="11" fill="#64748b">
                  {rotuloMes(m.mes).split('/')[0]}
                </text>
              )}
              {(m.mes.endsWith('-01') || i === 0) && (
                <text x={pad.l + i * col + col / 2} y={H - pad.b + 29} textAnchor="middle" fontSize="11" fontWeight="700" fill="#334155">
                  {m.mes.slice(0, 4)}
                </text>
              )}
              {/* área de toque maior que a barra */}
              <rect
                x={pad.l + i * col}
                y={pad.t}
                width={col}
                height={ph}
                fill="transparent"
                onMouseEnter={() => setFoco(i)}
                onMouseLeave={() => setFoco(null)}
                onClick={() => setFoco(foco === i ? null : i)}
              />
            </g>
          );
        })}
      </svg>
      {f && foco !== null && (
        <div
          className={`pointer-events-none absolute top-0 px-3 py-2 rounded-lg bg-[#0F2053] text-white text-sm shadow-lg whitespace-nowrap ${
            (pad.l + foco * col) / W < 0.15 ? '' : (pad.l + foco * col) / W > 0.8 ? '-translate-x-full' : '-translate-x-1/2'
          }`}
          style={{ left: `${((pad.l + foco * col + col / 2) / W) * 100}%` }}
        >
          <strong>
            {rotuloMes(f.mes)}
            {f.emAndamento ? ' (em andamento)' : ''}
          </strong>
          <br />
          {f.n.toLocaleString('pt-BR')} {f.n === 1 ? 'edital' : 'editais'}
          {f.valor ? ` · ${abreviar(f.valor)}` : ''}
        </div>
      )}
    </div>
  );
}
