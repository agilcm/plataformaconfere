// Raio-X do edital e a lista de itens e documentos de uma compra no PNCP.
// Usado nos editais de Editais abertos e AGIL CNAE e na aba RAIO-X (qualquer edital pelo link do PNCP).
import { useEffect, useState } from 'react';
import { Icon } from '../components/ui.tsx';
import { formatBRL } from '../data/servicesData.ts';
import { raioXItens } from '../lib/filtrosEditais.js';
import { fetchDetalheCompra } from '../lib/pncp.js';
import { callApi } from '../lib/pncpClient.ts';

/** O que o Raio-X usa de um edital (formato mapItem de lib/pncp.js) */
export interface EditalRaioX {
  modalidade: string;
  modoDisputa?: string;
  srp?: boolean;
  amparo?: string;
  propostasDe?: string | null;
  propostasAte: string | null;
}

// Datas do PNCP vêm no horário de Brasília, sem fuso
const parseBR = (s?: string | null) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? { d: `${m[3]}/${m[2]}/${m[1]}`, h: `${m[4]}:${m[5]}` } : null;
};

// Itens (o que está sendo comprado) e documentos (edital, termo de referência) de uma compra
export function DetalheCompra({
  compra,
  edital,
  abertoInicial = false,
}: {
  compra: { cnpj: string; ano: string; seq: string };
  edital?: EditalRaioX;
  abertoInicial?: boolean;
}) {
  const [aberto, setAberto] = useState(abertoInicial);
  const [estado, setEstado] = useState<'idle' | 'loading' | 'ok' | 'erro'>('idle');
  const [dados, setDados] = useState<{ itens: Item[] | null; arquivos: Arquivo[] | null } | null>(null);

  const carregar = async () => {
    setEstado('loading');
    const viaApi = await callApi<{ itens: Item[] | null; arquivos: Arquivo[] | null }>('compra', compra);
    if (viaApi) {
      setDados(viaApi);
      return setEstado('ok');
    }
    try {
      setDados(await fetchDetalheCompra(compra));
      setEstado('ok');
    } catch {
      setEstado('erro');
    }
  };

  // aba RAIO-X: já abre carregando
  useEffect(() => {
    if (abertoInicial) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const next = !aberto;
    setAberto(next);
    if (next && estado === 'idle') carregar();
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={aberto}
        className="inline-flex items-center gap-2 text-[15px] font-bold text-[#0F2053] hover:text-[#0369B3] cursor-pointer"
      >
        <span className={`inline-block transition-transform ${aberto ? 'rotate-90' : ''}`} aria-hidden="true">
          ›
        </span>
        {aberto ? 'Ocultar itens e documentos' : edital ? 'Raio-X: itens, ME/EPP e documentos do edital' : 'Ver itens e documentos do edital'}
      </button>
      {aberto && (
        <div className="mt-3 p-4 rounded-xl bg-[#F7FAFD] border border-slate-200">
          {edital && <RaioX edital={edital} itens={estado === 'ok' ? (dados?.itens ?? null) : null} lendo={estado === 'loading'} />}
          {estado === 'loading' && <p className={`text-[15px] text-slate-600 ${edital ? 'mt-3' : ''}`}>Carregando itens e documentos do PNCP…</p>}
          {estado === 'erro' && (
            <p className={`text-[15px] text-amber-900 ${edital ? 'mt-3' : ''}`}>
              O PNCP não respondeu.{' '}
              <button type="button" onClick={carregar} className="font-bold underline cursor-pointer">
                Tentar de novo
              </button>
            </p>
          )}
          {estado === 'ok' && dados && (
            <div className={`space-y-4 ${edital ? 'mt-4' : ''}`}>
              {dados.arquivos && dados.arquivos.length > 0 && (
                <div>
                  <p className="text-sm font-bold text-slate-500 mb-2">Documentos</p>
                  <ul className="flex flex-wrap gap-2">
                    {dados.arquivos.map((a) => (
                      <li key={a.url}>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-[#0369B3] hover:border-[#0478CA]"
                        >
                          <Icon name="doc" className="w-4 h-4" />
                          {a.tipo}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {dados.itens && dados.itens.length > 0 ? (
                <div>
                  <p className="text-sm font-bold text-slate-500 mb-2">Itens ({dados.itens.length})</p>
                  <ul className="divide-y divide-slate-200 max-h-80 overflow-y-auto pr-1">
                    {dados.itens.map((i) => (
                      <li key={i.numero} className="py-2.5 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 text-[15px]">
                        <span className="text-slate-500 tabular-nums shrink-0 w-8">{i.numero}</span>
                        <span className="flex-1 min-w-0 text-slate-800">
                          {i.descricao}
                          {edital && i.beneficio && /exclusiva|cota|subcontrata/i.test(i.beneficio) && (
                            <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold align-middle">
                              {/exclusiva/i.test(i.beneficio) ? 'Exclusivo ME/EPP' : /cota/i.test(i.beneficio) ? 'Cota ME/EPP' : 'Subcontratação ME/EPP'}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-slate-600 tabular-nums sm:text-right">
                          {i.quantidade?.toLocaleString('pt-BR')} {i.unidade}
                          {i.valorUnitarioEstimado ? (
                            <>
                              <br className="hidden sm:block" /> <strong className="text-slate-800">{formatBRL(i.valorUnitarioEstimado, 2)}</strong> /un.
                            </>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-[15px] text-slate-600">O órgão ainda não publicou os itens desta compra no PNCP.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Item {
  numero: number;
  descricao: string;
  quantidade: number | null;
  unidade: string;
  valorUnitarioEstimado: number | null;
  valorTotalEstimado?: number | null;
  tipo?: string;
  beneficio?: string;
  criterio?: string;
  sigiloso?: boolean;
}

// Raio-X do edital: o que decide se vale a pena entrar, num quadro só (dados do PNCP)
export function RaioX({ edital, itens, lendo }: { edital: EditalRaioX; itens: Item[] | null; lendo?: boolean }) {
  const r = itens && itens.length ? raioXItens(itens) : null;
  const de = parseBR(edital.propostasDe);
  const ate = parseBR(edital.propostasAte);
  const linhas: [string, React.ReactNode][] = [
    ['Modalidade', edital.modalidade || '—'],
    ['Modo de disputa', edital.modoDisputa || '—'],
    ['Registro de preços', edital.srp ? 'Sim: o órgão registra o preço e compra conforme a necessidade, enquanto a ata valer' : 'Não'],
    ['Propostas', `${de ? `de ${de.d} às ${de.h} ` : ''}${ate ? `até ${ate.d} às ${ate.h}` : '—'}`],
  ];
  if (edital.amparo) linhas.push(['Base legal', edital.amparo]);
  if (r) {
    if (r.criterios.length) linhas.push(['Critério de julgamento', r.criterios.join(' · ')]);
    linhas.push([
      'Itens',
      `${r.total} ${r.total === 1 ? 'item' : 'itens'}${r.materiais || r.servicos ? ` · ${r.materiais} de material e ${r.servicos} de serviço` : ''}`,
    ]);
    if (r.valor) linhas.push(['Soma estimada dos itens', formatBRL(r.valor, 2)]);
    if (r.sigilosos) linhas.push(['Orçamento sigiloso', `${r.sigilosos} ${r.sigilosos === 1 ? 'item' : 'itens'} sem valor de referência divulgado`]);
  }
  const mpe = r && (r.exclusivos || r.cota || r.subcontratacao);
  return (
    <div className="p-4 rounded-xl bg-white border border-[#0478CA]/25">
      <p className="text-sm font-extrabold tracking-wide text-[#0369B3] uppercase">Raio-X do edital</p>
      {lendo && <p className="mt-2 px-3 py-2 rounded-lg bg-slate-50 text-[15px] text-slate-600">Conferindo os itens exclusivos para ME/EPP…</p>}
      {r && (
        <p className={`mt-2 px-3 py-2 rounded-lg text-[15px] font-bold ${mpe ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-700'}`}>
          {mpe
            ? [
                r.exclusivos ? `${r.exclusivos} de ${r.total} ${r.exclusivos === 1 ? 'item exclusivo' : 'itens exclusivos'} para ME/EPP` : '',
                r.cota ? `${r.cota} com cota reservada para ME/EPP` : '',
                r.subcontratacao ? `${r.subcontratacao} com subcontratação de ME/EPP` : '',
              ]
                .filter(Boolean)
                .join(' · ')
            : 'Nenhum item com benefício para ME/EPP informado no PNCP (ampla concorrência)'}
        </p>
      )}
      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[15px]">
        {linhas.map(([k, v]) => (
          <div key={k}>
            <dt className="text-sm text-slate-500">{k}</dt>
            <dd className="font-semibold text-slate-800">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
interface Arquivo {
  titulo: string;
  tipo: string;
  url: string;
}
