// Super Sugestão (aba AGIL CNAE): editais abertos onde a AGIL já ganhou o mesmo produto ou a mesma categoria.
import { useRef, useState } from 'react';
import { Icon } from '../components/ui.tsx';
import { formatBRL } from '../data/servicesData.ts';
import { lerHistorico } from '../lib/historicoVitorias.js';
import { fetchItensCompra } from '../lib/pncp.js';
import { callApi } from '../lib/pncpClient.ts';
import { ROUTES } from '../lib/routes.ts';
import { editaisNasCidades, superSugestao } from '../lib/superSugestao.js';
import { baixarXlsx } from '../lib/xlsx.js';

type Progresso = (etapa: string, feito: number, total: number) => void;

const NIVEIS = {
  forte: { titulo: 'Mesma cidade, mesmo produto', cor: 'bg-red-100 text-red-800 border-red-200', ponto: 'bg-red-600' },
  media: { titulo: 'Mesma cidade, mesma categoria', cor: 'bg-amber-100 text-amber-900 border-amber-200', ponto: 'bg-amber-500' },
  fraca: { titulo: 'Mesmo produto em outra cidade', cor: 'bg-slate-100 text-slate-700 border-slate-200', ponto: 'bg-slate-400' },
} as const;
type Nivel = keyof typeof NIVEIS;

const dataBR = (s?: string | null) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/);
  return m ? `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` às ${m[4]}` : ''}` : 'ver edital';
};
const curto = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const SIT: Record<string, string> = { vigente: 'válido', vencendo: 'vencendo', vencido: 'vencido', 'sem-data': '' };

function motivoTexto(m: any) {
  const onde = m.nivel === 'fraca' ? `${m.orgao}` : `${m.cidade} (${m.orgao})`;
  const proc = `processo ${m.processo}${SIT[m.situacao] ? `, ${SIT[m.situacao]}` : ''}`;
  return m.nivel === 'media' ? `Já ganhamos ${m.porque.toLowerCase()} em ${onde}, ${proc}` : `Já ganhamos "${m.porque}" em ${onde}, ${proc}`;
}

export default function SuperSugestaoPanel({ obterEditais, onClose }: { obterEditais: (p: Progresso) => Promise<any[]>; onClose: () => void }) {
  const [historico] = useState(() => lerHistorico());
  const [estado, setEstado] = useState<'idle' | 'loading' | 'ok' | 'erro'>('idle');
  const [prog, setProg] = useState<{ etapa: string; feito: number; total: number } | null>(null);
  const [res, setRes] = useState<any[]>([]);
  const [verFracas, setVerFracas] = useState(false);
  const cancelar = useRef(false);

  const buscar = async () => {
    if (!historico) return;
    cancelar.current = false;
    setEstado('loading');
    try {
      const editais = await obterEditais((etapa, feito, total) => setProg({ etapa, feito, total }));
      // nas cidades onde já ganhamos, os itens do edital também contam (o objeto às vezes é genérico)
      const alvo = editaisNasCidades(historico, editais).filter((e: any) => e.compra).slice(0, 400);
      const itens = new Map<string, any[]>();
      let i = 0;
      let feitos = 0;
      setProg({ etapa: 'Lendo os itens dos editais nas cidades onde já ganhamos', feito: 0, total: alvo.length });
      await Promise.all(
        Array.from({ length: Math.min(6, alvo.length) }, async () => {
          while (i < alvo.length && !cancelar.current) {
            const e = alvo[i++];
            try {
              const viaApi = await callApi<{ itens: any[] | null }>('compra', { cnpj: e.compra.cnpj, ano: e.compra.ano, seq: e.compra.seq });
              itens.set(e.id, viaApi?.itens ?? (await fetchItensCompra(e.compra)));
            } catch {
              /* sem itens: usa só o objeto do edital */
            }
            setProg({ etapa: 'Lendo os itens dos editais nas cidades onde já ganhamos', feito: ++feitos, total: alvo.length });
          }
        }),
      );
      setRes(superSugestao(historico, editais, itens));
      setEstado('ok');
    } catch {
      setEstado('erro');
    } finally {
      setProg(null);
    }
  };

  // Excel: aba 1 com as oportunidades na mesma cidade (mesmo produto e mesma categoria); aba 2 com o mesmo produto em outras cidades
  const exportar = () => {
    const colunas = [
      { titulo: 'Alerta', largura: 30 },
      { titulo: 'Órgão do edital', largura: 36 },
      { titulo: 'Cidade', largura: 20 },
      { titulo: 'Objeto do edital', largura: 70 },
      { titulo: 'Valor estimado', largura: 16, tipo: 'moeda' as const },
      { titulo: 'Propostas até', largura: 18, tipo: 'dataHora' as const },
      { titulo: 'Local do pregão', largura: 26 },
      { titulo: 'Por quê', largura: 30 },
      { titulo: 'Onde já ganhamos', largura: 36 },
      { titulo: 'Processo ganho', largura: 14 },
      { titulo: 'Situação do processo ganho', largura: 14 },
      { titulo: 'Itens ganhos (exemplos)', largura: 70 },
      { titulo: 'Link no PNCP', largura: 50 },
      { titulo: 'Link do local do pregão', largura: 50 },
    ];
    const linhas = (aqui: boolean) =>
      res
        .filter((r) => (r.nivel === 'fraca') !== aqui)
        .flatMap((r) =>
          r.motivos
            .filter((m: any) => !aqui || m.nivel !== 'fraca')
            .map((m: any) => [
            NIVEIS[m.nivel as Nivel].titulo,
            r.edital.orgao,
            r.edital.municipio,
            r.edital.objeto,
            r.edital.valor ?? null,
            r.edital.propostasAte,
            r.edital.local || '',
            m.nivel === 'media' ? `Categoria: ${m.porque}` : `Produto: ${m.porque}`,
            m.orgao,
            m.processo,
            SIT[m.situacao] || '',
            m.exemplos.map((x: any) => x.descricao).join(' | '),
            r.edital.link,
            r.edital.linkLocal || '',
          ]),
      );
    baixarXlsx(`super-sugestao-agil-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      { nome: 'Mesma cidade', colunas, linhas: linhas(true) },
      { nome: 'Outras cidades', colunas, linhas: linhas(false) },
    ]);
  };

  const grupos = (['forte', 'media', 'fraca'] as Nivel[]).map((n) => ({ n, lista: res.filter((r) => r.nivel === n) }));

  return (
    <section id="super-sugestao" aria-label="Super Sugestão" className="mt-6 p-5 sm:p-6 rounded-2xl bg-white border-2 border-[#0F2053]/20 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xl font-bold font-display text-[#0F2053]">Super Sugestão</p>
          <p className="mt-1 text-[15px] text-slate-600 max-w-3xl">
            Procura editais abertos em Minas Gerais nas cidades onde a AGIL já ganhou: o mesmo produto (ex.: toner onde já vendemos toner) ou a mesma
            categoria (ex.: brinquedos onde já vendemos carrinho).
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm font-bold text-slate-600 underline cursor-pointer">
          Fechar
        </button>
      </div>

      {!historico ? (
        <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-[15px] text-amber-900">
          <p>
            <strong>Falta o histórico do que a AGIL já ganhou neste navegador.</strong> Abra a área Privado, conecte o Google Drive e espere a leitura
            das pastas terminar. Depois volte aqui.
          </p>
          <a href={ROUTES.privado} className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F2053] text-white font-bold">
            Abrir a área Privado
          </a>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={buscar}
            disabled={estado === 'loading'}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#0F2053] hover:bg-[#13306f] text-white font-extrabold cursor-pointer disabled:opacity-50"
          >
            <Icon name="search" className="w-5 h-5" />
            {estado === 'ok' ? 'Procurar de novo' : 'Procurar oportunidades'}
          </button>
          <span className="text-sm text-slate-500">
            Histórico: {historico.processos.length} processos, {historico.processos.reduce((s: number, p: any) => s + p.itens.length, 0)} itens · atualizado em{' '}
            {dataBR(historico.atualizadoEm)}
          </span>
          {estado === 'ok' && res.length > 0 && (
            <button type="button" onClick={exportar} className="ml-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D6F42] hover:bg-[#185C37] text-white text-[15px] font-bold cursor-pointer">
              <Icon name="sheet" className="w-5 h-5" /> Exportar Excel
            </button>
          )}
        </div>
      )}

      {prog && (
        <div className="mt-4" aria-live="polite">
          <div className="flex flex-wrap justify-between gap-2 text-[15px] text-slate-700">
            <span>
              {prog.etapa}
              {prog.total ? `: ${prog.feito.toLocaleString('pt-BR')} de ${prog.total.toLocaleString('pt-BR')}` : '…'}
            </span>
            <button type="button" onClick={() => (cancelar.current = true)} className="text-sm font-bold text-slate-600 underline cursor-pointer">
              Pular esta etapa
            </button>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full bg-[#0F2053] transition-all ${prog.total ? '' : 'w-1/3 animate-pulse'}`}
              style={prog.total ? { width: `${Math.min(100, (prog.feito / Math.max(1, prog.total)) * 100)}%` } : undefined}
            />
          </div>
        </div>
      )}
      {estado === 'erro' && <p className="mt-4 text-[15px] text-amber-900">O PNCP não respondeu agora. Tente de novo em alguns minutos.</p>}
      {estado === 'ok' && !res.length && <p className="mt-4 text-[15px] text-slate-600">Nenhum edital aberto parecido com o que a AGIL já ganhou.</p>}

      {estado === 'ok' &&
        grupos.map(({ n, lista }) =>
          !lista.length ? null : (
            <div key={n} className="mt-6">
              <p className="flex items-center gap-2 text-lg font-bold text-[#0F2053]">
                <span className={`w-2.5 h-2.5 rounded-full ${NIVEIS[n].ponto}`} aria-hidden="true" />
                {NIVEIS[n].titulo} <span className="text-slate-500 font-semibold">({lista.length})</span>
              </p>
              {n === 'fraca' && !verFracas ? (
                <button type="button" onClick={() => setVerFracas(true)} className="mt-2 text-[15px] font-bold text-[#0478CA] underline cursor-pointer">
                  Mostrar {lista.length} {lista.length === 1 ? 'edital' : 'editais'}
                </button>
              ) : (
                <ul className="mt-3 space-y-3">
                  {lista.slice(0, n === 'fraca' ? 60 : 200).map((r) => (
                    <li key={r.edital.id} className={`p-4 rounded-xl border ${NIVEIS[n].cor}`}>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <strong>{r.edital.municipio}</strong>
                        <span>{r.edital.orgao}</span>
                        <span>· propostas até {dataBR(r.edital.propostasAte)}</span>
                        {r.edital.valor && <span>· {formatBRL(r.edital.valor, 2)}</span>}
                        {r.edital.local && <span>· pregão: {r.edital.local}</span>}
                      </div>
                      <p className="mt-1 font-bold text-[#0F2053] line-clamp-2">{r.edital.objeto || r.edital.titulo}</p>
                      <ul className="mt-2 space-y-1 text-[15px]">
                        {r.motivos.slice(0, 4).map((m: any, k: number) => (
                          <li key={k}>
                            <span className="font-semibold">{motivoTexto(m)}</span>
                            {m.exemplos[0] && (
                              <span className="text-slate-600">
                                {' '}
                                · ex.: {curto(m.exemplos[0].descricao)}
                                {m.exemplos[0].unitario ? ` a ${formatBRL(m.exemplos[0].unitario, 2)}` : ''}
                              </span>
                            )}
                          </li>
                        ))}
                        {r.motivos.length > 4 && <li className="text-slate-600">e mais {r.motivos.length - 4} motivo(s)</li>}
                      </ul>
                      <a href={r.edital.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[#0478CA] underline">
                        Ver edital no PNCP <Icon name="arrow" className="w-4 h-4" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ),
        )}
    </section>
  );
}
