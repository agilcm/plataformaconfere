// Peças comuns das abas "Possíveis clientes" e "Campeões" (Licitações): carregar a lista publicada, estilos e a nota
// sobre de onde vêm os dados.
import { useCallback, useEffect, useState } from 'react';
import { chaveDaSenha, chaveDoTexto, chaveParaTexto, decifrar } from '../lib/cofre.js';
import { CHAVE_PROSPECCAO } from '../lib/privado/auth.ts';
import { ROUTES } from '../lib/routes.ts';
import { Icon } from '../components/ui.tsx';

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
  /** licitação da Zona da Mata */
  zm?: number;
}
export interface MetaProspeccao {
  atualizadoEm?: string;
  desde?: string;
  ate?: string;
  /** onde estão as licitações da lista: "Minas Gerais" (Possíveis clientes) ou "Zona da Mata" (Campeões) */
  abrangencia?: string;
  /** parte da busca no PNCP (Minas inteira, 12 meses) já feita, de 0 a 100 */
  buscaFeita?: number;
  portal?: string;
  licitacoesNoPeriodo?: number;
  licitacoesLidas?: number;
  /** licitações ainda não procuradas */
  aindaNaFila?: number;
  /** licitações recentes cuja ata ainda não saiu */
  aguardandoAta?: number;
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

/** Estado da lista cifrada: sem a chave ('bloqueado'), senha errada ('senha'), aberta ('ok') ou ainda não publicada ('sem') */
export type EstadoCofre = 'bloqueado' | 'abrindo' | 'senha' | 'ok' | 'sem' | 'erro';

/**
 * Uma lista só da equipe, cifrada com a senha do Privado (src/lib/cofre.js): Possíveis clientes
 * (prospeccao/clientes.bin), o cadastro da Consulta CNPJ (prospeccao/cadastro.bin) ou o CNPJ problemático
 * (prospeccao/problematicos.bin).
 * Quem já entrou no Privado nesta aba do navegador abre direto; os outros digitam a senha.
 */
export function useClientesCifrados<T extends { empresas: unknown[] }>(arquivo: 'clientes' | 'cadastro' | 'problematicos' = 'clientes') {
  const [dados, setDados] = useState<T | null>(null);
  const [estado, setEstado] = useState<EstadoCofre>('abrindo');
  const abrir = useCallback(
    async (chave: CryptoKey): Promise<boolean> => {
      setEstado('abrindo');
      let bytes: Uint8Array;
      try {
        const r = await fetch(`${import.meta.env.BASE_URL}prospeccao/${arquivo}.bin?t=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) {
          setEstado(r.status === 404 ? 'sem' : 'erro');
          return false;
        }
        bytes = new Uint8Array(await r.arrayBuffer());
      } catch {
        setEstado('erro');
        return false;
      }
      let aberto: Uint8Array;
      try {
        aberto = await decifrar(bytes, chave);
      } catch {
        setEstado('senha');
        return false;
      }
      try {
        const texto = await new Response(new Blob([aberto as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
        setDados(JSON.parse(texto));
        setEstado('ok');
        return true;
      } catch {
        setEstado('erro');
        return false;
      }
    },
    [arquivo],
  );
  useEffect(() => {
    let guardada = '';
    try {
      guardada = sessionStorage.getItem(CHAVE_PROSPECCAO) || '';
    } catch {
      /* sem armazenamento */
    }
    if (!guardada) {
      setEstado('bloqueado');
      return;
    }
    chaveDoTexto(guardada)
      .then((chave) => abrir(chave))
      .then((ok) => {
        if (!ok) setEstado((e) => (e === 'senha' ? 'bloqueado' : e));
      })
      .catch(() => setEstado('bloqueado'));
  }, [abrir]);
  const desbloquear = useCallback(
    async (senha: string) => {
      const chave = await chaveDaSenha(senha);
      if (await abrir(chave)) {
        try {
          sessionStorage.setItem(CHAVE_PROSPECCAO, await chaveParaTexto(chave));
        } catch {
          /* vale só enquanto a página estiver aberta */
        }
      }
    },
    [abrir],
  );
  const trancar = useCallback(() => {
    try {
      sessionStorage.removeItem(CHAVE_PROSPECCAO);
    } catch {
      /* nada a limpar */
    }
    setDados(null);
    setEstado('bloqueado');
  }, []);
  return { dados, estado, desbloquear, trancar };
}

/** Tela de senha das listas só da equipe (cifradas com a senha do Privado) */
export function Cadeado({
  estado,
  desbloquear,
  oQue = 'A lista de possíveis clientes',
}: {
  estado: EstadoCofre;
  desbloquear: (senha: string) => Promise<void>;
  oQue?: string;
}) {
  const [senha, setSenha] = useState('');
  const abrindo = estado === 'abrindo';
  return (
    <div className="mt-6 max-w-xl p-5 sm:p-6 rounded-2xl bg-white border border-slate-200">
      <h3 className="flex items-center gap-2 text-xl font-bold font-display text-[#0F2053]">
        <Icon name="shield" className="w-6 h-6" />
        Área da equipe da Ágil CM
      </h3>
      <p className="mt-2 text-[16px] text-slate-700 leading-relaxed">
        {oQue} é só da equipe. Digite a senha do Privado para abrir (quem já entrou no Privado nesta aba do navegador abre direto).
      </p>
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          if (senha) desbloquear(senha);
        }}
        className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-end"
      >
        <label className="flex-1 block">
          <span className="text-sm font-bold text-slate-700">Senha do Privado</span>
          <input
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(ev) => setSenha(ev.target.value)}
            aria-invalid={estado === 'senha'}
            aria-describedby={estado === 'senha' ? 'cadeado-erro' : undefined}
            className={`mt-1 ${campo}`}
          />
        </label>
        <button
          type="submit"
          disabled={abrindo || !senha}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0F2053] hover:bg-[#13306f] text-white text-base font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait"
        >
          {abrindo ? 'Abrindo…' : 'Abrir a lista'}
        </button>
      </form>
      <div role="status" className="mt-3 text-[15px]">
        {estado === 'senha' && (
          <p id="cadeado-erro" className="text-red-700 font-semibold">
            Senha errada. Use a mesma senha do Privado.
          </p>
        )}
        {estado === 'sem' && (
          <p className="text-amber-900">A lista ainda não foi publicada com a senha. Tente de novo depois da próxima atualização do site.</p>
        )}
        {estado === 'erro' && <p className="text-amber-900">Não consegui abrir a lista agora. Tente de novo em alguns instantes.</p>}
      </div>
      <p className="mt-4 pt-4 border-t border-slate-100 text-[15px] text-slate-700">
        É de uma empresa e quer saber onde perdeu licitações?{' '}
        <a href={ROUTES.diagnostico} className="font-bold text-[#0369B3] underline underline-offset-4">
          Faça o diagnóstico grátis pelo CNPJ
        </a>
        .
      </p>
    </div>
  );
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

/** "em Minas Gerais" ou "na Zona da Mata" */
const ondeTexto = (dados: MetaProspeccao) => (dados.abrangencia === 'Minas Gerais' ? 'em Minas Gerais' : 'na Zona da Mata');

/** Período das licitações (últimos 12 meses) e quanto da leitura já foi feito */
export function Periodo({ dados }: { dados: MetaProspeccao }) {
  const lidas = dados.licitacoesLidas ?? 0;
  const total = dados.licitacoesNoPeriodo ?? 0;
  const naFila = dados.aindaNaFila ?? 0;
  const busca = dados.buscaFeita ?? 100;
  const emAndamento = naFila > 0 || busca < 100;
  return (
    <div className="mt-4 p-3 sm:p-4 rounded-2xl bg-white border border-slate-200 text-[15px] text-slate-700 leading-relaxed">
      <p>
        <strong className="text-[#0F2053]">Licitações dos últimos 12 meses</strong>
        {dados.desde && (
          <>
            : de {dataBR(dados.desde)} a {dataBR(dados.ate || dados.atualizadoEm)}
          </>
        )}
        , {ondeTexto(dados)}.
      </p>
      {emAndamento ? (
        <p className="mt-1">
          <span className="font-semibold text-amber-800">Leitura em andamento:</span> {lidas} atas lidas de {total} licitações já encontradas
          {naFila ? ` (${naFila} na fila)` : ''}
          {busca < 100 ? `; a busca das licitações no PNCP está em ${busca}%` : ''}. A lista cresce a cada leitura (8 por dia), começando pelas licitações mais
          perto das cidades escolhidas, até cobrir o período inteiro.
        </p>
      ) : (
        <p className="mt-1">
          Todas as {total} licitações do período {ondeTexto(dados)} já foram procuradas: {lidas} tinham a ata com os lances
          {dados.aguardandoAta ? ` e ${dados.aguardandoAta} ainda esperam a ata da sessão` : ''}.
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
        {dados.licitacoesNoPeriodo ?? 0} licitações desse portal {ondeTexto(dados)} desde {dataBR(dados.desde)}
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
