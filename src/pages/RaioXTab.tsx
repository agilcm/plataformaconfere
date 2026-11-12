// Aba RAIO-X: cole o link (ou o número de controle) de qualquer edital do PNCP e veja o Raio-X completo:
// modalidade, disputa, registro de preços, prazos, itens exclusivos para ME/EPP, itens e documentos.
import { useState } from 'react';
import { Container, Icon } from '../components/ui.tsx';
import { formatBRL } from '../data/servicesData.ts';
import { diasPara } from '../lib/filtrosEditais.js';
import { alternarMeuEdital, useMeusEditais } from '../lib/meusEditais.ts';
import { fetchEditalPorRef, refDoTexto } from '../lib/pncp.js';
import { DetalheCompra } from './RaioXEdital.tsx';

type Compra = Awaited<ReturnType<typeof fetchEditalPorRef>>;

const dataHora = (s: string | null) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  return m ? `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` às ${m[4]}:${m[5]}` : ''}` : 'Ver no edital';
};

export default function RaioXTab() {
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<'idle' | 'loading' | 'ok' | 'erro' | 'invalido'>('idle');
  const [erro, setErro] = useState('');
  const [e, setE] = useState<Compra | null>(null);
  const meus = useMeusEditais();
  const salvos = Object.values(meus).slice(0, 8);

  const analisar = async (t = texto) => {
    const ref = refDoTexto(t);
    if (!ref) {
      setEstado('invalido');
      return;
    }
    setTexto(t);
    setEstado('loading');
    try {
      setE(await fetchEditalPorRef(ref));
      setEstado('ok');
    } catch (err) {
      setErro(
        (err as { status?: number })?.status === 404
          ? 'Esse edital não foi encontrado no PNCP. Confira o link.'
          : 'O PNCP não respondeu agora (ele cai com frequência). Tente de novo em alguns minutos.',
      );
      setEstado('erro');
    }
  };

  const d = e ? diasPara(e.propostasAte) : null;
  return (
    <section aria-label="Raio-X do edital" className="bg-[#F4F7FB] py-10 sm:py-14 min-h-[60vh]">
      <Container>
        <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <h2 className="text-2xl font-bold text-[#0F2053]">Raio-X do edital</h2>
          <p className="mt-1 max-w-3xl text-[15px] text-slate-600 leading-relaxed">
            Cole o link de qualquer edital do PNCP (ou o número de controle) e veja num quadro só o que decide se vale a pena entrar: modalidade, modo de
            disputa, registro de preços, período das propostas, itens exclusivos ou com cota para ME/EPP, critério de julgamento, itens e documentos.
          </p>
          <form
            className="mt-4 flex flex-col sm:flex-row gap-3"
            onSubmit={(ev) => {
              ev.preventDefault();
              analisar();
            }}
          >
            <label className="relative flex-1 min-w-0">
              <span className="sr-only">Link ou número de controle do edital no PNCP</span>
              <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                value={texto}
                onChange={(ev) => {
                  setTexto(ev.target.value);
                  if (estado === 'invalido') setEstado('idle');
                }}
                placeholder="https://pncp.gov.br/app/editais/… ou 17710096000184-1-000128/2026"
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 text-base focus:outline-none focus:border-[#0478CA] focus:ring-2 focus:ring-[#0478CA]/20"
              />
            </label>
            <button
              type="submit"
              disabled={estado === 'loading' || !texto.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0F2053] hover:bg-[#13306f] text-white font-extrabold cursor-pointer disabled:opacity-50"
            >
              <Icon name="doc" className="w-5 h-5" /> Fazer o Raio-X
            </button>
          </form>
          {estado === 'invalido' && (
            <p className="mt-3 text-[15px] text-amber-900">
              Não reconheci esse link. Use o endereço da página do edital no PNCP (pncp.gov.br/app/editais/…) ou o número de controle (ex.:
              17710096000184-1-000128/2026).
            </p>
          )}
          {salvos.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-slate-600 mb-2">Ou escolha um dos seus editais salvos</p>
              <div className="flex flex-wrap gap-2">
                {salvos.map((m) => (
                  <button
                    key={m.edital.id}
                    type="button"
                    onClick={() => analisar(m.edital.link)}
                    title={m.edital.objeto}
                    className="max-w-xs truncate px-3 py-1.5 rounded-full text-sm font-semibold border border-slate-200 bg-[#F7FAFD] text-slate-700 hover:border-[#0478CA] cursor-pointer"
                  >
                    {m.edital.municipio} · {m.edital.titulo}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="mt-4 text-sm text-slate-500">Dica: em Editais abertos e em AGIL CNAE, cada edital também tem o botão “Raio-X”.</p>
        </div>

        {estado === 'loading' && <p className="mt-6 text-[15px] text-slate-700">Buscando o edital no PNCP…</p>}
        {estado === 'erro' && (
          <p className="mt-6 text-[15px] text-amber-900">
            {erro}{' '}
            <button type="button" onClick={() => analisar()} className="font-bold underline cursor-pointer">
              Tentar de novo
            </button>
          </p>
        )}

        {estado === 'ok' && e && (
          <article className="mt-6 p-5 sm:p-6 rounded-2xl bg-white border border-slate-200">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="px-2.5 py-1 rounded-full bg-[#0478CA]/10 text-[#0369B3] font-bold">{e.modalidade || 'Licitação'}</span>
              {e.srp && <span className="px-2.5 py-1 rounded-full bg-violet-50 text-violet-800 font-bold">Registro de preços</span>}
              {e.situacao && <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">{e.situacao}</span>}
              {e.microrregiao && <span className="px-2.5 py-1 rounded-full bg-[#0E7A3F]/10 text-[#0E7A40] font-bold">Zona da Mata · {e.microrregiao}</span>}
              <button
                type="button"
                onClick={() => alternarMeuEdital(e)}
                aria-pressed={!!meus[e.id]}
                className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-bold cursor-pointer ${
                  meus[e.id] ? 'bg-[#F5A623]/15 border-[#F5A623] text-[#8a5a00]' : 'bg-white border-slate-300 text-slate-600 hover:border-[#F5A623]'
                }`}
              >
                <Icon name="star" className={`w-4 h-4 ${meus[e.id] ? 'fill-current' : ''}`} />
                {meus[e.id] ? 'Salvo em Meus editais' : 'Salvar em Meus editais'}
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              {e.titulo}
              {e.processo ? ` · Processo ${e.processo}` : ''}
            </p>
            <h3 className="mt-1 text-lg font-bold text-[#0F2053] leading-snug">{e.objeto}</h3>
            <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-[15px]">
              <div className="min-w-0">
                <dt className="text-sm text-slate-500">Órgão</dt>
                <dd className="font-semibold text-slate-800">{e.orgao}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Cidade</dt>
                <dd className="font-semibold text-slate-800">
                  {e.municipio} · {e.uf}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Valor estimado</dt>
                <dd className="font-semibold text-slate-800 tabular-nums">{e.valor ? formatBRL(e.valor, 2) : 'Não informado'}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Propostas até</dt>
                <dd className={`font-semibold tabular-nums ${d !== null && d >= 0 && d <= 3 ? 'text-red-700' : 'text-slate-800'}`}>
                  {dataHora(e.propostasAte)}
                  {d !== null && d >= 0 && <span className="ml-2 text-xs font-bold">{d === 0 ? '(hoje)' : `(faltam ${d} ${d === 1 ? 'dia' : 'dias'})`}</span>}
                  {d !== null && d < 0 && <span className="ml-2 text-xs font-bold text-slate-500">(encerrado)</span>}
                </dd>
              </div>
            </dl>
            {e.informacao && <p className="mt-3 text-[15px] text-slate-600">{e.informacao}</p>}
            {e.compra && <DetalheCompra key={e.id} compra={e.compra} edital={e} abertoInicial />}
            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              <a
                href={e.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0478CA] hover:bg-[#03609F] text-white text-[15px] font-bold"
              >
                Ver edital no PNCP <Icon name="arrow" className="w-4 h-4" />
              </a>
              {e.linkOrigem && /^https?:\/\//.test(e.linkOrigem) && (
                <a
                  href={e.linkOrigem}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 hover:border-[#0478CA] text-[#0F2053] text-[15px] font-bold"
                >
                  Abrir {e.local && e.local !== 'Não informado' ? `em ${e.local}` : 'na plataforma'}
                </a>
              )}
            </div>
          </article>
        )}
      </Container>
    </section>
  );
}
