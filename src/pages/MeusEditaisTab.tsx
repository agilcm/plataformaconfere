// Aba Meus editais: os editais salvos com a estrela em Editais abertos, como um funil
// (interesse → analisando → vamos participar → proposta enviada → ganhamos/não ganhamos),
// com a agenda de prazos, anotações e o arquivo de calendário (.ics).
import { useRef, useState } from 'react';
import { Container, Icon } from '../components/ui.tsx';
import { formatBRL } from '../data/servicesData.ts';
import { diasPara } from '../lib/filtrosEditais.js';
import { MEUS_EDITAIS_URL } from '../data/privadoConfig.ts';
import {
  agendaIcs,
  atualizarMeuEdital,
  baixarTexto,
  conectarEquipe,
  desconectarEquipe,
  equipe,
  ETAPAS,
  sincronizar,
  useSincronizacao,
  exportarMeusEditais,
  importarMeusEditais,
  removerMeuEdital,
  useMeusEditais,
  type Etapa,
  type MeuEdital,
} from '../lib/meusEditais.ts';
import { ROUTES } from '../lib/routes.ts';

const dataHora = (s: string | null) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  return m ? `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` às ${m[4]}:${m[5]}` : ''}` : 'Ver no edital';
};

const ENCERRADAS = new Set<Etapa>(['ganhamos', 'perdemos', 'desistimos']);

function grupoDoPrazo(m: MeuEdital): string {
  const d = diasPara(m.edital.propostasAte);
  if (d === null) return 'Sem data no PNCP';
  if (d < 0) return 'Prazo encerrado';
  if (d === 0) return 'Hoje';
  if (d === 1) return 'Amanhã';
  if (d <= 7) return 'Próximos 7 dias';
  if (d <= 30) return 'Próximos 30 dias';
  return 'Mais adiante';
}
const ORDEM_GRUPOS = ['Hoje', 'Amanhã', 'Próximos 7 dias', 'Próximos 30 dias', 'Mais adiante', 'Sem data no PNCP', 'Prazo encerrado'];

export default function MeusEditaisTab() {
  const meus = useMeusEditais();
  useSincronizacao(); // redesenha quando conecta ou desconecta
  const [etapa, setEtapa] = useState<Etapa | ''>('');
  const [msg, setMsg] = useState('');
  const arquivo = useRef<HTMLInputElement>(null);
  const todos = Object.values(meus);
  const contagem = new Map<string, number>();
  for (const m of todos) contagem.set(m.etapa, (contagem.get(m.etapa) || 0) + 1);
  const lista = todos.filter((m) => !etapa || m.etapa === etapa);
  const grupos = ORDEM_GRUPOS.map((g) => ({
    g,
    itens: lista.filter((m) => grupoDoPrazo(m) === g).sort((a, b) => String(a.edital.propostasAte || '9').localeCompare(String(b.edital.propostasAte || '9'))),
  })).filter((x) => x.itens.length);
  const futuros = todos.filter((m) => (diasPara(m.edital.propostasAte) ?? -1) >= 0 && !ENCERRADAS.has(m.etapa));
  const hoje = new Date().toISOString().slice(0, 10);

  const importar = async (f: File) => {
    try {
      const n = importarMeusEditais(await f.text());
      setMsg(`${n} ${n === 1 ? 'edital importado' : 'editais importados'}.`);
    } catch {
      setMsg('Esse arquivo não é uma cópia de Meus editais.');
    } finally {
      if (arquivo.current) arquivo.current.value = '';
    }
  };

  return (
    <section aria-label="Meus editais" className="bg-[#F4F7FB] py-10 sm:py-14 min-h-[60vh]">
      <Container>
        <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold text-[#0F2053]">Meus editais</h2>
              <p className="mt-1 text-[15px] text-slate-600 leading-relaxed">
                Os editais que você salvou com a estrela <Icon name="star" className="inline w-4 h-4 -mt-0.5 text-[#F5A623] fill-current" /> em Editais abertos.
                Marque a etapa de cada um, anote o que precisa e leve os prazos para a sua agenda.{' '}
                {equipe() ? 'Fica na planilha da equipe: todos veem a mesma lista.' : 'Fica guardado neste navegador.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!futuros.length}
                onClick={() => baixarTexto(`prazos-editais-${hoje}.ics`, agendaIcs(futuros), 'text/calendar;charset=utf-8')}
                title="Arquivo de calendário com o fim do prazo de cada edital em andamento (com lembrete na véspera). Abre no Google Agenda, Outlook ou no celular."
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0478CA] hover:bg-[#03609F] text-white text-[15px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon name="calendar" className="w-5 h-5" /> Prazos na agenda (.ics)
              </button>
              <button
                type="button"
                disabled={!todos.length}
                onClick={() => baixarTexto(`meus-editais-${hoje}.json`, exportarMeusEditais(), 'application/json')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 hover:border-[#0478CA] text-[#0F2053] text-[15px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Baixar cópia
              </button>
              <button
                type="button"
                onClick={() => arquivo.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 hover:border-[#0478CA] text-[#0F2053] text-[15px] font-bold cursor-pointer"
              >
                Importar cópia
              </button>
              <input
                ref={arquivo}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])}
              />
            </div>
          </div>
          {msg && (
            <p role="status" className="mt-3 text-[15px] text-slate-700">
              {msg}
            </p>
          )}
          <PainelEquipe />

          {todos.length > 0 && (
            <div role="group" aria-label="Etapa" className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
              {[{ id: '' as const, nome: 'Todos', cor: '' }, ...ETAPAS].map((e) => {
                const n = e.id ? contagem.get(e.id) || 0 : todos.length;
                if (e.id && !n) return null;
                return (
                  <button
                    key={e.id || 'todos'}
                    type="button"
                    aria-pressed={etapa === e.id}
                    onClick={() => setEtapa(e.id)}
                    className={`px-3.5 py-2 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${
                      etapa === e.id ? 'bg-[#0F2053] border-[#0F2053] text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-[#0478CA]'
                    }`}
                  >
                    {e.nome} <span className={etapa === e.id ? 'text-white/75' : 'text-slate-400'}>· {n}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!todos.length && (
          <div className="mt-6 p-8 rounded-2xl bg-white border border-slate-200 text-center">
            <p className="text-lg font-bold text-[#0F2053]">Nenhum edital salvo ainda</p>
            <p className="mt-1 text-base text-slate-600">
              Em Editais abertos, clique em <strong>☆ Salvar</strong> no edital que interessa. Ele aparece aqui com o prazo e a etapa.
            </p>
            <a href={ROUTES.licitacoes} className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#0478CA] text-white font-bold">
              Ver editais abertos <Icon name="arrow" className="w-5 h-5" />
            </a>
          </div>
        )}

        {grupos.map(({ g, itens }) => (
          <div key={g} className="mt-8">
            <p
              className={`pb-2 border-b-2 text-lg font-extrabold ${g === 'Hoje' || g === 'Amanhã' ? 'text-red-700 border-red-200' : 'text-[#0F2053] border-[#0F2053]/15'}`}
            >
              {g} <span className="text-base font-semibold text-slate-500">({itens.length})</span>
            </p>
            <ul className="mt-4 space-y-4">
              {itens.map((m) => (
                <Cartao key={m.edital.id} m={m} />
              ))}
            </ul>
          </div>
        ))}
      </Container>
    </section>
  );
}

function Cartao({ m }: { m: MeuEdital }) {
  const e = m.edital;
  const [nota, setNota] = useState(m.nota);
  const d = diasPara(e.propostasAte);
  const cor = ETAPAS.find((x) => x.id === m.etapa)?.cor || '';
  return (
    <li className="p-5 rounded-2xl bg-white border border-slate-200">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="px-2.5 py-1 rounded-full bg-[#0478CA]/10 text-[#0478CA] font-bold">{e.modalidade || 'Licitação'}</span>
        <strong className="text-slate-800">
          {e.municipio} · {e.uf || 'MG'}
        </strong>
        <span className="text-slate-500 truncate max-w-full">{e.orgao}</span>
        <label className="ml-auto inline-flex items-center gap-2">
          <span className="sr-only">Etapa</span>
          <select
            value={m.etapa}
            onChange={(ev) => atualizarMeuEdital(e.id, { etapa: ev.target.value as Etapa })}
            className={`px-3 py-1.5 rounded-full text-sm font-bold border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0478CA]/30 ${cor}`}
          >
            {ETAPAS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
      <h3 className="mt-3 text-[17px] font-bold text-[#0F2053] leading-snug line-clamp-3">{e.objeto || e.titulo}</h3>
      {m.por && (
        <p className="mt-1 text-sm text-slate-500">
          Salvo por {m.por} em {dataHora(m.salvoEm.slice(0, 10))}
        </p>
      )}
      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 text-[15px]">
        <div>
          <dt className="text-sm text-slate-500">Propostas até</dt>
          <dd className={`font-semibold tabular-nums ${d !== null && d >= 0 && d <= 3 ? 'text-red-700' : 'text-slate-800'}`}>
            {dataHora(e.propostasAte)}
            {d !== null && d >= 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                {d === 0 ? 'hoje' : `faltam ${d} ${d === 1 ? 'dia' : 'dias'}`}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Valor estimado</dt>
          <dd className="font-semibold text-slate-800 tabular-nums">{e.valor ? formatBRL(e.valor, 2) : 'Não informado'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-sm text-slate-500">Local do pregão</dt>
          <dd className="font-semibold text-slate-800 truncate">
            {e.linkLocal ? (
              <a href={e.linkLocal} target="_blank" rel="noopener noreferrer" className="text-[#0478CA] underline">
                {e.local}
              </a>
            ) : (
              e.local || 'Ver no edital'
            )}
          </dd>
        </div>
      </dl>
      <label className="mt-4 block">
        <span className="block text-sm text-slate-500 mb-1">Anotações (documentos, dúvidas, preço de compra…)</span>
        <textarea
          value={nota}
          onChange={(ev) => setNota(ev.target.value)}
          onBlur={() => nota !== m.nota && atualizarMeuEdital(e.id, { nota })}
          rows={2}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-[15px] focus:outline-none focus:border-[#0478CA] focus:ring-2 focus:ring-[#0478CA]/20"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={e.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0478CA] hover:bg-[#03609F] text-white text-[15px] font-bold"
        >
          Ver edital no PNCP <Icon name="arrow" className="w-4 h-4" />
        </a>
        {e.propostasAte && (
          <button
            type="button"
            onClick={() => baixarTexto(`prazo-${e.municipio}-${e.titulo}.ics`.replace(/[^\w.-]+/g, '-'), agendaIcs([m]), 'text/calendar;charset=utf-8')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-slate-200 hover:border-[#0478CA] text-[#0F2053] text-[15px] font-bold cursor-pointer"
          >
            <Icon name="calendar" className="w-4 h-4" /> Na agenda
          </button>
        )}
        <button
          type="button"
          onClick={() => removerMeuEdital(e.id)}
          className="ml-auto text-sm font-bold text-slate-500 hover:text-red-700 underline cursor-pointer"
        >
          Tirar da lista
        </button>
      </div>
    </li>
  );
}

// Equipe: liga este navegador à planilha Google da equipe, para todos verem os mesmos editais salvos
function PainelEquipe() {
  const sinc = useSincronizacao();
  const conectado = equipe();
  const [aberto, setAberto] = useState(false);
  const [url, setUrl] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const hora = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');

  if (conectado) {
    return (
      <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px]">
        <span className="font-bold text-emerald-900">☁ Lista da equipe{conectado.nome ? ` · você é ${conectado.nome}` : ''}</span>
        <span className={sinc.estado === 'erro' ? 'text-red-700' : 'text-emerald-800'}>
          {sinc.estado === 'sincronizando'
            ? 'Sincronizando…'
            : sinc.estado === 'erro'
              ? sinc.erro
              : sinc.em
                ? `Igual à planilha da equipe (conferido às ${hora(sinc.em)})`
                : 'Conectado'}
        </span>
        <span className="ml-auto flex gap-3">
          <button type="button" onClick={() => sincronizar()} className="font-bold text-emerald-900 underline cursor-pointer">
            Sincronizar agora
          </button>
          <button type="button" onClick={desconectarEquipe} className="text-sm text-slate-600 underline cursor-pointer">
            Desconectar
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 rounded-xl bg-[#F7FAFD] border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[15px] text-slate-700">
          <strong className="text-[#0F2053]">Só neste navegador.</strong> Para a equipe toda ver os mesmos editais salvos, em qualquer computador ou celular,
          conecte à planilha da equipe.
        </p>
        {!aberto && (
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F2053] hover:bg-[#13306f] text-white text-[15px] font-bold cursor-pointer"
          >
            ☁ Conectar à equipe
          </button>
        )}
      </div>
      {aberto && (
        <form
          className="mt-3 grid sm:grid-cols-3 gap-3"
          onSubmit={async (ev) => {
            ev.preventDefault();
            setOcupado(true);
            setErro('');
            try {
              await conectarEquipe({ url, senha, nome });
              setAberto(false);
            } catch (err) {
              setErro((err as Error).message || 'Não deu para conectar.');
            } finally {
              setOcupado(false);
            }
          }}
        >
          {!MEUS_EDITAIS_URL && (
            <label className="sm:col-span-3 block">
              <span className="block text-sm text-slate-600 mb-1">Endereço do App da Web da planilha (https://script.google.com/macros/s/…/exec)</span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-[15px] focus:outline-none focus:border-[#0478CA]"
              />
            </label>
          )}
          <label className="block">
            <span className="block text-sm text-slate-600 mb-1">Senha da equipe</span>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-[15px] focus:outline-none focus:border-[#0478CA]"
            />
          </label>
          <label className="block">
            <span className="block text-sm text-slate-600 mb-1">Seu nome (aparece em “salvo por”)</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="ex.: Allan"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-[15px] focus:outline-none focus:border-[#0478CA]"
            />
          </label>
          <div className="flex items-end gap-3">
            <button
              type="submit"
              disabled={ocupado}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F2053] hover:bg-[#13306f] text-white text-[15px] font-bold cursor-pointer disabled:opacity-50"
            >
              {ocupado ? 'Conectando…' : 'Conectar'}
            </button>
            <button type="button" onClick={() => setAberto(false)} className="py-2.5 text-sm text-slate-600 underline cursor-pointer">
              Cancelar
            </button>
          </div>
          {erro && (
            <p role="alert" className="sm:col-span-3 text-[15px] text-red-700">
              {erro}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
