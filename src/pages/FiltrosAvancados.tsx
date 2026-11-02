// Painel "Mais filtros" de Editais abertos: modalidade, valor, prazo, registro de preços, esfera,
// palavras a excluir, distância até uma cidade e ordenação (lógica em lib/filtrosEditais.js).
import { useEffect, useState } from 'react';
import { ESFERAS, FAIXAS_VALOR, MODALIDADES, ORDENS, PRAZOS, RAIOS } from '../lib/filtrosEditais.js';

export interface Avancado {
  modalidades: string[];
  valor: string;
  prazo: string;
  srp: string;
  esfera: string;
  excluir: string;
  raio: number;
  base: string; // código IBGE da cidade de onde se mede a distância
}

export const BASE_PADRAO = '3104601'; // Astolfo Dutra, sede da Ágil CM
export const AVANCADO_VAZIO: Avancado = { modalidades: [], valor: '', prazo: '', srp: '', esfera: '', excluir: '', raio: 0, base: BASE_PADRAO };

/** Quantos filtros avançados estão ligados (para o número no botão) */
export const contarAvancado = (a: Avancado) =>
  (a.modalidades.length ? 1 : 0) + [a.valor, a.prazo, a.srp, a.esfera, a.excluir.trim()].filter(Boolean).length + (a.raio ? 1 : 0);

const chip = (on: boolean) =>
  `px-3.5 py-2 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${
    on ? 'bg-[#0F2053] border-[#0F2053] text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-[#0478CA]'
  }`;

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-600 mb-2">{titulo}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export default function FiltrosAvancados({
  valor,
  onChange,
  ordem,
  onOrdem,
  cidades,
  contagemModalidade,
}: {
  valor: Avancado;
  onChange: (a: Avancado) => void;
  ordem: string;
  onOrdem: (o: string) => void;
  cidades: [string, string][] | null; // [nome, ibge] de MG (carregadas sob demanda)
  contagemModalidade: Map<string, number> | null;
}) {
  const set = (p: Partial<Avancado>) => onChange({ ...valor, ...p });
  // palavras a excluir: aplica depois de uma pausa na digitação
  const [excluir, setExcluir] = useState(valor.excluir);
  useEffect(() => setExcluir(valor.excluir), [valor.excluir]);
  useEffect(() => {
    if (excluir === valor.excluir) return;
    const t = setTimeout(() => set({ excluir }), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excluir]);
  const nomeBase = cidades?.find(([, ib]) => ib === valor.base)?.[0] || 'Astolfo Dutra';
  const [cidadeTexto, setCidadeTexto] = useState(nomeBase);
  useEffect(() => setCidadeTexto(nomeBase), [nomeBase]);
  const escolherCidade = (texto: string) => {
    setCidadeTexto(texto);
    const achou = cidades?.find(([n]) => n.toLowerCase() === texto.trim().toLowerCase());
    if (achou) set({ base: achou[1] });
  };
  const ativos = contarAvancado(valor);

  return (
    <div id="filtro-avancado" className="mt-4 pt-4 border-t border-slate-100 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-base font-bold text-[#0F2053]">Mais filtros</p>
        {(ativos > 0 || ordem !== 'recentes') && (
          <button
            type="button"
            onClick={() => {
              onChange({ ...AVANCADO_VAZIO, base: valor.base });
              onOrdem('recentes');
            }}
            className="text-sm font-bold text-[#0478CA] underline cursor-pointer"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <Grupo titulo="Modalidade">
        {MODALIDADES.map((m) => {
          const on = valor.modalidades.includes(m);
          const n = contagemModalidade?.get(m);
          if (contagemModalidade && !n && !on) return null;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              onClick={() => set({ modalidades: on ? valor.modalidades.filter((x) => x !== m) : [...valor.modalidades, m] })}
              className={chip(on)}
            >
              {m}
              {n ? <span className={on ? 'text-white/75' : 'text-slate-400'}> · {n.toLocaleString('pt-BR')}</span> : null}
            </button>
          );
        })}
      </Grupo>

      <Grupo titulo="Prazo para enviar a proposta">
        {[{ id: '', nome: 'Qualquer prazo' }, ...PRAZOS].map((p) => (
          <button
            key={p.id || 'todos'}
            type="button"
            aria-pressed={valor.prazo === p.id}
            onClick={() => set({ prazo: p.id })}
            className={chip(valor.prazo === p.id)}
          >
            {p.nome}
          </button>
        ))}
      </Grupo>

      <Grupo titulo="Valor estimado">
        {[{ id: '', nome: 'Qualquer valor' }, ...FAIXAS_VALOR, { id: 'sem', nome: 'Sem valor informado' }].map((f) => (
          <button
            key={f.id || 'todos'}
            type="button"
            aria-pressed={valor.valor === f.id}
            onClick={() => set({ valor: f.id })}
            className={chip(valor.valor === f.id)}
          >
            {f.nome}
          </button>
        ))}
      </Grupo>

      <div className="grid sm:grid-cols-2 gap-4">
        <Grupo titulo="Registro de preços">
          {[
            ['', 'Tanto faz'],
            ['sim', 'Só registro de preços'],
            ['nao', 'Sem registro de preços'],
          ].map(([id, nome]) => (
            <button key={id || 'todos'} type="button" aria-pressed={valor.srp === id} onClick={() => set({ srp: id })} className={chip(valor.srp === id)}>
              {nome}
            </button>
          ))}
        </Grupo>
        <Grupo titulo="Esfera do órgão">
          {[{ id: '', nome: 'Todas' }, ...ESFERAS].map((e) => (
            <button
              key={e.id || 'todas'}
              type="button"
              aria-pressed={valor.esfera === e.id}
              onClick={() => set({ esfera: e.id })}
              className={chip(valor.esfera === e.id)}
            >
              {e.nome}
            </button>
          ))}
        </Grupo>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-600 mb-2">Distância (em linha reta) até a cidade do edital</p>
        <div className="flex flex-wrap items-center gap-2">
          {[0, ...RAIOS].map((r) => (
            <button key={r} type="button" aria-pressed={valor.raio === r} onClick={() => set({ raio: r })} className={chip(valor.raio === r)}>
              {r ? `Até ${r} km` : 'Qualquer distância'}
            </button>
          ))}
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            de
            <input
              list="cidades-mg"
              value={cidadeTexto}
              onChange={(e) => escolherCidade(e.target.value)}
              onBlur={() => setCidadeTexto(nomeBase)}
              placeholder="Cidade"
              aria-label="Cidade de onde medir a distância"
              className="w-48 px-3 py-2 rounded-xl border border-slate-300 text-[15px] font-semibold text-slate-800 focus:outline-none focus:border-[#0478CA]"
            />
            <datalist id="cidades-mg">
              {cidades?.map(([n, ib]) => (
                <option key={ib} value={n} />
              ))}
            </datalist>
          </label>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-semibold text-slate-600 mb-2">Não mostrar editais com estas palavras (separe por vírgula)</span>
          <input
            value={excluir}
            onChange={(e) => setExcluir(e.target.value)}
            placeholder="ex.: obra, engenharia, locação de veículos"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-[15px] focus:outline-none focus:border-[#0478CA] focus:ring-2 focus:ring-[#0478CA]/20"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-slate-600 mb-2">Ordenar por</span>
          <select
            value={ordem}
            onChange={(e) => onOrdem(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-[15px] font-semibold bg-white focus:outline-none focus:border-[#0478CA] cursor-pointer"
          >
            {ORDENS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
                {o.id === 'distancia' ? ` de ${nomeBase}` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
