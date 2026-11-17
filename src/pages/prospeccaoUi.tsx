// Peças comuns das abas "Possíveis clientes" e "Campeões" (Licitações): carregar a lista publicada, estilos e a nota
// sobre de onde vêm os dados.
import { useEffect, useState } from 'react';

export const campo =
  'w-full px-4 py-3 rounded-xl border border-slate-300 text-base focus:outline-none focus:border-[#0478CA] focus:ring-2 focus:ring-[#0478CA]/20';
export const chip = (ativo: boolean) =>
  `px-3.5 py-2 rounded-full border text-[15px] font-semibold cursor-pointer ${
    ativo ? 'bg-[#0F2053] border-[#0F2053] text-white' : 'bg-white border-slate-300 text-[#0F2053] hover:border-[#0478CA]'
  }`;
export const brl = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: v < 10 ? 4 : 2 });
/** Lance ou valor vencedor: em reais ou, no maior desconto, em percentual */
export const valorLance = (v: number | null | undefined, desconto?: boolean) =>
  v == null ? '—' : desconto ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% de desconto` : brl(v);
export const dataBR = (iso?: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

export interface Licitacao {
  id: string;
  orgao: string;
  municipio: string;
  uf: string;
  titulo: string;
  objeto: string;
  modalidade: string;
  data: string;
}
export interface MetaProspeccao {
  atualizadoEm?: string;
  desde?: string;
  ate?: string;
  municipiosConsultados?: number;
  municipiosTotal?: number;
  portal?: string;
  licitacoesNoPeriodo?: number;
  licitacoesLidas?: number;
  aindaNaFila?: number;
  cidades: string[];
  licitacoes: Licitacao[];
}

/** Carrega uma das listas de public/prospeccao/ (geradas por scripts/possiveis-clientes.mjs) */
export function useProspeccao<T extends { empresas: unknown[] }>(arquivo: 'clientes' | 'campeoes') {
  const [dados, setDados] = useState<T | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'sem'>('carregando');
  useEffect(() => {
    let vivo = true;
    fetch(`${import.meta.env.BASE_URL}prospeccao/${arquivo}.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!vivo) return;
        if (j && Array.isArray(j.empresas)) {
          setDados(j);
          setEstado('ok');
        } else setEstado('sem');
      })
      .catch(() => vivo && setEstado('sem'));
    return () => {
      vivo = false;
    };
  }, [arquivo]);
  return { dados, estado };
}

export function AvisoCarregando({ estado }: { estado: 'carregando' | 'ok' | 'sem' }) {
  if (estado === 'carregando')
    return (
      <p role="status" className="mt-6 text-slate-700">
        Carregando a lista…
      </p>
    );
  if (estado === 'sem')
    return (
      <p role="status" className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
        A lista ainda não foi gerada. Ela é montada pelo GitHub a cada publicação do site; tente de novo em algumas horas.
      </p>
    );
  return null;
}

/** "Cataguases, Miraí e Rodeiro" */
export const listaCidades = (cidades: string[]) => cidades.join(', ').replace(/, ([^,]*)$/, ' e $1');

/** Período das licitações (últimos 12 meses) e quanto da leitura já foi feito */
export function Periodo({ dados }: { dados: MetaProspeccao }) {
  const lidas = dados.licitacoesLidas ?? 0;
  const total = dados.licitacoesNoPeriodo ?? 0;
  const faltaMun = dados.municipiosTotal ? dados.municipiosTotal - (dados.municipiosConsultados ?? 0) : 0;
  const emAndamento = (dados.aindaNaFila ?? 0) > 0 || faltaMun > 0;
  return (
    <div className="mt-4 p-3 sm:p-4 rounded-2xl bg-white border border-slate-200 text-[15px] text-slate-700 leading-relaxed">
      <p>
        <strong className="text-[#0F2053]">Licitações dos últimos 12 meses</strong>
        {dados.desde && (
          <>
            : de {dataBR(dados.desde)} a {dataBR(dados.ate || dados.atualizadoEm)}
          </>
        )}
        , na Zona da Mata.
      </p>
      {emAndamento ? (
        <p className="mt-1">
          <span className="font-semibold text-amber-800">Leitura em andamento:</span> {lidas} de {total} licitações lidas
          {dados.municipiosTotal ? `, ${dados.municipiosConsultados ?? 0} de ${dados.municipiosTotal} municípios consultados` : ''}. A lista cresce a cada
          leitura (4 por dia) até cobrir o período inteiro.
        </p>
      ) : (
        <p className="mt-1">
          Todas as {total} licitações do período já foram lidas, nos {dados.municipiosTotal ?? ''} municípios da Zona da Mata.
        </p>
      )}
    </div>
  );
}

export function NotaFonte({ dados, campeoes = false }: { dados: MetaProspeccao; campeoes?: boolean }) {
  return (
    <div className="mt-8 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 text-[15px] text-slate-700 leading-relaxed space-y-2">
      <h3 className="text-base font-bold text-[#0F2053]">De onde vem a lista e o que fica de fora</h3>
      <p>
        {campeoes
          ? 'A vencedora de cada item e o valor que ela levou saem da ata da sessão'
          : 'O PNCP só registra a vencedora de cada item. A colocação das outras empresas sai da ata da sessão'}{' '}
        que o {dados.portal || 'Portal de Compras Públicas'} anexa no PNCP, com todos os lances: {dados.licitacoesLidas ?? 0} atas lidas de{' '}
        {dados.licitacoesNoPeriodo ?? 0} licitações desse portal na Zona da Mata desde {dataBR(dados.desde)}
        {dados.aindaNaFila ? ` (${dados.aindaNaFila} ainda na fila; a lista cresce a cada atualização)` : ''}.
      </p>
      <p>
        Licitações feitas no Compras.gov.br, na Licitar Digital e em outros portais não entram, porque eles não publicam a ata com os lances no PNCP. A cidade
        de cada empresa vem do cadastro do CNPJ na Receita Federal. Pessoas físicas (CPF) ficam de fora.
        {campeoes &&
          ' O valor ganho é o da ata da sessão; o homologado pelo órgão pode mudar depois de recursos. Em registro de preços, o total é o da ata (quantidade estimada): o órgão pode comprar menos.'}
      </p>
      {dados.atualizadoEm && <p>Atualizada em {new Date(dados.atualizadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.</p>}
    </div>
  );
}

/** Link da licitação no PNCP, com o órgão, a cidade, o edital e a data */
export function LinhaLicitacao({ lic }: { lic: Licitacao }) {
  return (
    <p className="mt-1 text-slate-700">
      <strong className="text-[#0F2053]">{lic.orgao}</strong> · {lic.municipio} - {lic.uf} · {lic.titulo} · {dataBR(lic.data)} ·{' '}
      <a
        href={`https://pncp.gov.br/app/editais/${lic.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-bold text-[#0369B3] underline underline-offset-4"
      >
        abrir no PNCP<span className="sr-only"> (abre em nova aba)</span>
      </a>
    </p>
  );
}
