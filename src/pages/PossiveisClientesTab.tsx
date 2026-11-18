// Aba "Possíveis clientes" das Licitações (aberta a todos): empresas das cidades vizinhas que disputaram licitações de
// Minas Gerais e ficaram do 2º ao 5º lugar (ou ofertaram o melhor preço e não levaram), com a licitação, o item e a
// colocação. Só para a equipe: os dados vêm de prospeccao/clientes.bin, cifrado com a senha do Privado (src/lib/cofre.js),
// gerado por scripts/possiveis-clientes.mjs a partir das atas do PNCP.
import { useMemo, useState } from 'react';
import { Container, Icon } from '../components/ui.tsx';
import { cnpjFormatado, diferenca, filtrarClientes, linhasPlanilha, textoColocacao } from '../lib/possiveisClientes.js';
import { baixarXlsx } from '../lib/xlsx.js';
import { blocosDiagnostico, mensagemContato, mensagemEdital, notaOportunidade, objetoLegivel } from '../lib/diagnostico.js';
import { editaisParaEmpresa, indiceEditais } from '../lib/editaisParaEmpresa.js';
import { buscarContato, linkWhatsApp } from '../lib/contatoCnpj.js';
import { listaDe, listaPronta } from '../lib/listasEditais.ts';
import { ROUTES } from '../lib/routes.ts';
import { dateText, downloadPdf, slug } from '../lib/pdfReport.ts';
import { COMPANY_PROFILE } from '../data/servicesData.ts';
import { atualizarFunil, ETAPAS_FUNIL, PREFIXO_FUNIL, useFunil, type EtapaFunil, type MeuEdital } from '../lib/meusEditais.ts';
import {
  campo,
  chip,
  LinhaLicitacao,
  listaCidades,
  NotaFonte,
  Periodo,
  useClientesCifrados,
  type EstadoCofre,
  valorLance,
  type Licitacao,
  type MetaProspeccao,
} from './prospeccaoUi.tsx';

interface Disputa {
  lic: number;
  item: string;
  desc: string;
  col: number;
  melhor: number;
  venc: number | null;
  lances: number;
  participantes: number;
  /** julgamento por lote: a disputa foi pelo lote inteiro */
  lote?: boolean;
  /** maior desconto: os valores são percentuais */
  desconto?: boolean;
  /** valor total que a vencedora levou no item */
  vt?: number;
}
interface Empresa {
  cnpj: string;
  razao: string;
  fantasia: string;
  cidade: string;
  uf: string;
  porte: string;
  atividade: string;
  situacao: string;
  vitorias: number;
  disputas: Disputa[];
}
interface Dados extends MetaProspeccao {
  /** quanto da leitura já foi feito só nas licitações da Zona da Mata */
  zonaDaMata?: Pick<MetaProspeccao, 'licitacoesNoPeriodo' | 'licitacoesLidas' | 'aindaNaFila' | 'aguardandoAta'>;
  resumo: { empresas: number; disputas: number; licitacoes: number };
  empresas: Empresa[];
}

const COR: Record<string, string> = {
  0: 'bg-violet-100 text-violet-900',
  2: 'bg-amber-100 text-amber-900',
  3: 'bg-sky-100 text-sky-900',
  4: 'bg-slate-200 text-slate-800',
  5: 'bg-rose-100 text-rose-900',
};
const corDe = (col: number) => COR[col] || 'bg-slate-100 text-slate-700';
// faixas do filtro de colocação
const FAIXAS: { id: string; rotulo: string; cols: number[] }[] = [
  { id: '2', rotulo: '2º lugar', cols: [2] },
  { id: '3', rotulo: '3º lugar', cols: [3] },
  { id: '4', rotulo: '4º lugar', cols: [4] },
  { id: '5', rotulo: '5º lugar', cols: [5] },
  { id: '0', rotulo: 'Melhor preço, não levou', cols: [0] },
];
// as duas listas: licitações da Zona da Mata e licitações de Minas inteira (a Zona da Mata incluída)
type Vista = 'zm' | 'mg';
const VISTAS: { id: Vista; titulo: string; abrangencia: string }[] = [
  { id: 'zm', titulo: 'Licitações na Zona da Mata', abrangencia: 'Zona da Mata' },
  { id: 'mg', titulo: 'Licitações em Minas Gerais', abrangencia: 'Minas Gerais' },
];

// ---------------------------------------------------------------- funil de prospecção
const hojeISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const somarDias = (n: number) => new Date(Date.now() - 3 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const etapaDe = (r?: MeuEdital) => (r ? ETAPAS_FUNIL.find((x) => x.id === r.etapa) : undefined);
const EM_ANDAMENTO = new Set<string>(['contato', 'respondeu', 'diagnostico', 'reuniao']);
/** Retorno marcado para hoje ou antes, numa etapa ainda em andamento */
const retornoVencido = (r?: MeuEdital) => !!r && EM_ANDAMENTO.has(r.etapa) && !!r.edital.propostasAte && r.edital.propostasAte <= hojeISO();
// grupos do filtro do funil
const FILTROS_FUNIL: { id: string; rotulo: string; teste: (r?: MeuEdital) => boolean }[] = [
  { id: '', rotulo: 'Todas', teste: () => true },
  { id: 'sem', rotulo: 'Sem contato', teste: (r) => !r },
  { id: 'andamento', rotulo: 'Em andamento', teste: (r) => !!r && EM_ANDAMENTO.has(r.etapa) },
  { id: 'retornar', rotulo: 'Retornar hoje', teste: retornoVencido },
  { id: 'fechou', rotulo: 'Fecharam', teste: (r) => r?.etapa === 'fechou' },
  { id: 'naoquis', rotulo: 'Não quiseram', teste: (r) => r?.etapa === 'naoquis' },
];

// ---------------------------------------------------------------- nota, editais abertos e contato
interface Nota {
  nota: number;
  faixa: 'quente' | 'morna' | 'fria';
  motivos: string[];
}
interface EditalAberto {
  id: string;
  titulo: string;
  objeto: string;
  orgao: string;
  municipio: string;
  propostasAte: string | null;
  link: string;
  local?: string;
  microrregiao?: string | null;
}
interface Combina {
  edital: EditalAberto;
  pontos: number;
  termos: string[];
}
interface Contato {
  telefones: { texto: string; numero: string; celular: boolean }[];
  email: string;
  endereco: string;
}
const FAIXA: Record<Nota['faixa'], { nome: string; cor: string }> = {
  quente: { nome: 'Quente', cor: 'bg-red-100 text-red-800' },
  morna: { nome: 'Morna', cor: 'bg-amber-100 text-amber-900' },
  fria: { nome: 'Fria', cor: 'bg-slate-100 text-slate-700' },
};
const ORDENS = [
  { id: 'nota', nome: 'Mais quentes primeiro (nota)' },
  { id: 'colocacoes', nome: 'Mais vezes entre o 2º e o 5º lugar' },
  { id: 'recentes', nome: 'Disputa mais recente' },
  { id: 'nome', nome: 'Nome da empresa' },
] as const;
type Ordem = (typeof ORDENS)[number]['id'];
const FILTROS_FAIXA: { id: '' | Nota['faixa']; rotulo: string }[] = [
  { id: '', rotulo: 'Todas' },
  { id: 'quente', rotulo: 'Quentes' },
  { id: 'morna', rotulo: 'Mornas' },
  { id: 'fria', rotulo: 'Frias' },
];
const prazoBR = (iso: string | null) => {
  if (!iso) return 'prazo não informado';
  const d = new Date(iso);
  return `propostas até ${d.toLocaleDateString('pt-BR')}${/T\d/.test(iso) ? ` às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}`;
};
const curto = (t: string, max: number) => (t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, '')}…` : t);
type EstadoEditais = { estado: 'nada' | 'carregando' | 'ok' | 'erro'; lidos?: number; total?: number; erro?: string };

// contato da Ágil CM no diagnóstico
const CONTATO = { whatsapp: COMPANY_PROFILE.phoneDisplay, email: COMPANY_PROFILE.email, site: 'www.agilcm.com.br/assessoria-licitacoes/' };
const acao =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait';

/**
 * Um cartão por empresa. `e` traz as disputas do filtro atual; `completa`, todas as da lista escolhida (Zona da Mata
 * ou Minas Gerais): o diagnóstico e a mensagem usam essas.
 */
function CartaoEmpresa({
  e,
  completa,
  dados,
  registro,
  abrangencia,
  nota,
  combina,
  editais,
  carregarEditais,
}: {
  e: Empresa;
  completa: Empresa;
  dados: Dados;
  registro?: MeuEdital;
  abrangencia: string;
  nota?: Nota;
  /** editais abertos que combinam (undefined: a lista de editais ainda não foi carregada) */
  combina?: Combina[];
  editais: EstadoEditais;
  carregarEditais: () => void;
}) {
  const licitacoes = dados.licitacoes;
  // o diagnóstico da empresa no site, para ir junto na mensagem
  const linkDiagnostico = `${COMPANY_PROFILE.siteUrl}/diagnostico-licitacoes/?cnpj=${e.cnpj}`;
  const [copiado, setCopiado] = useState('');
  const [gerando, setGerando] = useState(false);
  const [contato, setContato] = useState<{ estado: 'nada' | 'buscando' | 'ok' | 'erro'; dados?: Contato; erro?: string }>({ estado: 'nada' });
  const verContato = async () => {
    setContato({ estado: 'buscando' });
    try {
      setContato({ estado: 'ok', dados: (await buscarContato(e.cnpj)) as Contato });
    } catch (err) {
      setContato({ estado: 'erro', erro: (err as Error).message });
    }
  };
  // primeira abordagem: entra no funil como "Mensagem enviada", com retorno em 3 dias
  const marcarContato = () => {
    if (!registro) atualizarFunil(e, { etapa: 'contato', retornarEm: somarDias(3) });
  };
  const copiarEdital = async (x: Combina) => {
    try {
      await navigator.clipboard.writeText(mensagemEdital(completa, x.edital));
      avisar(`edital:${x.edital.id}`);
      marcarContato();
    } catch {
      /* sem área de transferência */
    }
  };
  const avisar = (o: string) => {
    setCopiado(o);
    setTimeout(() => setCopiado(''), 2000);
  };
  const diagnostico = async () => {
    setGerando(true);
    try {
      await downloadPdf(
        `diagnostico-licitacoes-${slug(completa.razao)}.pdf`,
        `Diagnóstico de licitações - ${completa.razao}`,
        blocosDiagnostico(completa, dados, { data: dateText(), contato: CONTATO, abrangencia }) as Parameters<typeof downloadPdf>[2],
      );
    } finally {
      setGerando(false);
    }
  };
  const copiarMensagem = async () => {
    try {
      await navigator.clipboard.writeText(mensagemContato(completa, dados, { abrangencia, link: linkDiagnostico }));
      avisar('mensagem');
      marcarContato();
    } catch {
      /* sem área de transferência */
    }
  };
  const conta = (cols: number[]) => e.disputas.filter((d) => cols.includes(d.col)).length;
  const nLic = new Set(e.disputas.map((d) => d.lic)).size;
  const resumo = [
    [2, '2º'],
    [3, '3º'],
    [4, '4º'],
    [5, '5º'],
    [0, 'melhor preço sem levar'],
  ] as const;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(cnpjFormatado(e.cnpj));
      avisar('cnpj');
    } catch {
      /* sem área de transferência */
    }
  };
  return (
    <li className="rounded-2xl bg-white border border-slate-200">
      <details className="group">
        <summary className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 sm:p-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <span className="flex-1 min-w-0">
            <span className="block text-lg font-bold font-display text-[#0F2053] leading-snug">{e.razao}</span>
            <span className="block mt-0.5 text-[15px] text-slate-700">
              {e.cidade} - {e.uf} · CNPJ {cnpjFormatado(e.cnpj)}
              {e.fantasia && e.fantasia !== e.razao ? ` · ${e.fantasia}` : ''}
            </span>
            <span className="block mt-0.5 text-sm text-slate-600">
              {[e.porte && e.porte.toLowerCase().replace(/^./, (c) => c.toUpperCase()), e.atividade].filter(Boolean).join(' · ')}
              {e.situacao && e.situacao !== 'ATIVA' ? ` · situação na Receita: ${e.situacao.toLowerCase()}` : ''}
            </span>
            {nota && (
              <span className="block mt-1.5 text-[15px] text-slate-800">
                <span className={`inline-block mr-2 px-2.5 py-0.5 rounded-full text-sm font-bold ${FAIXA[nota.faixa].cor}`}>
                  {FAIXA[nota.faixa].nome} · nota {nota.nota}
                </span>
                {nota.motivos.join('; ')}
              </span>
            )}
            <span className="mt-2 flex flex-wrap gap-1.5">
              {resumo.map(([col, rotulo]) =>
                conta([col]) ? (
                  <span key={col} className={`px-2.5 py-0.5 rounded-full text-sm font-bold ${corDe(col)}`}>
                    {rotulo}: {conta([col])}
                  </span>
                ) : null,
              )}
              {e.vitorias > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-emerald-100 text-emerald-900">venceu {e.vitorias} no período</span>
              )}
              {etapaDe(registro) && <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold ${etapaDe(registro)!.cor}`}>{etapaDe(registro)!.nome}</span>}
              {registro?.edital.propostasAte && EM_ANDAMENTO.has(registro.etapa) && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-sm font-bold ${retornoVencido(registro) ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`}
                >
                  retornar {registro.edital.propostasAte <= hojeISO() ? (registro.edital.propostasAte < hojeISO() ? '(atrasado) ' : 'hoje ') : 'em '}
                  {registro.edital.propostasAte.split('-').reverse().join('/')}
                </span>
              )}
            </span>
          </span>
          <span className="shrink-0 inline-flex items-center gap-1.5 text-[15px] font-bold text-[#0369B3]">
            {e.disputas.length} {e.disputas.length === 1 ? 'item' : 'itens'} em {nLic} {nLic === 1 ? 'licitação' : 'licitações'}
            <Icon name="arrow" className="w-4 h-4 transition-transform group-open:rotate-90" />
          </span>
        </summary>
        <div className="px-4 sm:px-5 pb-5">
          <ul className="space-y-2.5">
            {e.disputas.map((d, i) => {
              const lic = licitacoes[d.lic];
              const dif = diferenca(d);
              return (
                <li key={i} className="p-3 sm:p-4 rounded-xl bg-[#F7FAFD] border border-slate-200 text-[15px] leading-relaxed">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold ${corDe(d.col)}`}>{textoColocacao(d.col)}</span>
                    <strong className="text-[#0F2053]">
                      {d.lote ? 'Lote' : 'Item'} {Number(d.item) || d.item}:
                    </strong>
                    <span className="text-slate-800">{d.desc}</span>
                  </p>
                  <p className="mt-1 text-slate-700">
                    Melhor lance {valorLance(d.melhor, d.desconto)}
                    {d.venc != null && <> · vencedora {valorLance(d.venc, d.desconto)}</>}
                    {dif != null && Math.abs(dif) < 1000 && (
                      <>
                        {' '}
                        ({dif > 0 ? '+' : ''}
                        {dif.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)
                      </>
                    )}{' '}
                    · {d.participantes} empresas {d.lote ? 'no lote' : 'no item'}
                  </p>
                  <LinhaLicitacao lic={lic} />
                </li>
              );
            })}
          </ul>
        </div>
      </details>
      {combina && combina.length > 0 && (
        <details className="mx-4 sm:mx-5 mb-3 rounded-xl border border-emerald-200 bg-emerald-50/60">
          <summary className="px-3 sm:px-4 py-2.5 cursor-pointer text-[15px] font-bold text-emerald-900">
            {combina.length} {combina.length === 1 ? 'edital aberto combina' : 'editais abertos combinam'} com o que ela disputa: motivo para ligar hoje
          </summary>
          <ul className="px-3 sm:px-4 pb-3 space-y-2">
            {combina.map((x) => (
              <li key={x.edital.id} className="p-3 rounded-lg bg-white border border-emerald-100 text-[15px] leading-relaxed">
                <p className="text-slate-800">{curto(objetoLegivel(x.edital.objeto), 220)}</p>
                <p className="mt-1 text-slate-700">
                  <strong className="text-[#0F2053]">{x.edital.orgao}</strong> · {x.edital.municipio} · {prazoBR(x.edital.propostasAte)}
                  {x.edital.local ? ` · ${x.edital.local}` : ''}
                </p>
                <p className="mt-1 text-sm text-slate-600">Combina por: {x.termos.slice(0, 5).join(', ')}</p>
                <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                  <a href={x.edital.link} target="_blank" rel="noopener noreferrer" className="font-bold text-[#0369B3] underline underline-offset-4">
                    abrir no PNCP<span className="sr-only"> (abre em nova aba)</span>
                  </a>
                  <button type="button" onClick={() => copiarEdital(x)} className="font-bold text-[#0369B3] underline underline-offset-4 cursor-pointer">
                    {copiado === `edital:${x.edital.id}` ? 'Mensagem copiada' : 'Copiar mensagem sobre este edital'}
                  </button>
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
      {contato.estado === 'ok' && contato.dados && (
        <div className="mx-4 sm:mx-5 mb-3 p-3 sm:p-4 rounded-xl border border-sky-200 bg-sky-50/60 text-[15px] leading-relaxed">
          {contato.dados.telefones.length || contato.dados.email ? (
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              {contato.dados.telefones.map((t) =>
                t.celular ? (
                  <a
                    key={t.numero}
                    href={linkWhatsApp(t.numero, mensagemContato(completa, dados, { abrangencia, link: linkDiagnostico }))}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={marcarContato}
                    className="font-bold text-emerald-800 underline underline-offset-4"
                  >
                    WhatsApp {t.texto}
                    <span className="sr-only"> (abre o WhatsApp com a mensagem pronta)</span>
                  </a>
                ) : (
                  <a key={t.numero} href={`tel:+55${t.numero}`} className="font-bold text-[#0369B3] underline underline-offset-4">
                    Telefone {t.texto}
                  </a>
                ),
              )}
              {contato.dados.email && (
                <a href={`mailto:${contato.dados.email}`} className="font-bold text-[#0369B3] underline underline-offset-4 break-all">
                  {contato.dados.email}
                </a>
              )}
            </p>
          ) : (
            <p className="text-slate-800">O cadastro da Receita não tem telefone nem e-mail desta empresa.</p>
          )}
          {contato.dados.endereco && <p className="mt-1 text-slate-700">{contato.dados.endereco}</p>}
          <p className="mt-1 text-sm text-slate-600">
            Do cadastro do CNPJ na Receita Federal, consultado agora (às vezes é o telefone do contador). Não fica gravado no site.
          </p>
        </div>
      )}
      {contato.estado === 'erro' && (
        <p role="alert" className="mx-4 sm:mx-5 mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[15px]">
          {contato.erro}
        </p>
      )}
      <div className="px-4 sm:px-5 pb-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <button type="button" onClick={diagnostico} disabled={gerando} className={`${acao} bg-[#0F2053] hover:bg-[#13306f] text-white`}>
          <Icon name="doc" className="w-5 h-5" />
          {gerando ? 'Gerando o diagnóstico…' : 'Gerar diagnóstico (PDF)'}
          <span className="sr-only"> de {e.razao}</span>
        </button>
        <button type="button" onClick={copiarMensagem} className={`${acao} border-2 border-slate-200 bg-white text-[#0F2053] hover:border-[#0478CA]`}>
          {copiado === 'mensagem' ? 'Mensagem copiada' : 'Copiar mensagem para o WhatsApp'}
          <span className="sr-only"> para {e.razao}</span>
        </button>
        <button
          type="button"
          onClick={verContato}
          disabled={contato.estado === 'buscando'}
          className={`${acao} border-2 border-slate-200 bg-white text-[#0F2053] hover:border-[#0478CA]`}
        >
          <Icon name="phone" className="w-5 h-5" />
          {contato.estado === 'buscando' ? 'Buscando o contato…' : contato.estado === 'ok' ? 'Buscar o contato de novo' : 'Buscar telefone e e-mail'}
          <span className="sr-only"> de {e.razao}</span>
        </button>
        {combina === undefined && (
          <button
            type="button"
            onClick={carregarEditais}
            disabled={editais.estado === 'carregando'}
            className={`${acao} border-2 border-slate-200 bg-white text-[#0F2053] hover:border-[#0478CA]`}
          >
            {editais.estado === 'carregando'
              ? `Carregando editais abertos${editais.total ? ` (${editais.lidos} de ${editais.total})` : ''}…`
              : 'Ver editais abertos para ela'}
          </button>
        )}
        {combina && combina.length === 0 && <span className="px-2 text-sm text-slate-600">Nenhum edital aberto combina agora.</span>}
        <button type="button" onClick={copiar} className="px-2 py-2.5 text-sm font-bold text-[#0369B3] underline underline-offset-4 cursor-pointer">
          {copiado === 'cnpj' ? 'CNPJ copiado' : 'Copiar o CNPJ'}
        </button>
        <span role="status" className="sr-only">
          {copiado === 'mensagem'
            ? registro
              ? 'Mensagem copiada'
              : 'Mensagem copiada e empresa marcada como Mensagem enviada'
            : copiado === 'cnpj'
              ? 'CNPJ copiado'
              : ''}
        </span>
        <div className="w-full grid grid-cols-1 sm:grid-cols-[auto_auto_1fr] gap-2 sm:gap-3 sm:items-end mt-1">
          <label className="block">
            <span className="block text-sm font-bold text-slate-700">Etapa</span>
            <select
              value={registro?.etapa || ''}
              onChange={(ev) => atualizarFunil(e, { etapa: ev.target.value as EtapaFunil | '' })}
              className="mt-1 w-full sm:w-auto px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-[15px]"
            >
              <option value="">Sem contato</option>
              {ETAPAS_FUNIL.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-slate-700">Retornar em</span>
            <input
              type="date"
              value={registro?.edital.propostasAte || ''}
              disabled={!registro}
              onChange={(ev) => atualizarFunil(e, { retornarEm: ev.target.value || null })}
              className="mt-1 w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-300 bg-white text-[15px] disabled:bg-slate-50 disabled:text-slate-400"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-slate-700">Anotação</span>
            <input
              key={registro?.nota || ''}
              defaultValue={registro?.nota || ''}
              disabled={!registro}
              onBlur={(ev) => ev.target.value !== (registro?.nota || '') && atualizarFunil(e, { nota: ev.target.value })}
              placeholder={registro ? 'ex.: falar com o João, prefere WhatsApp' : 'Escolha uma etapa para anotar'}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-[15px] disabled:bg-slate-50"
            />
          </label>
        </div>
      </div>
    </li>
  );
}

/** Tela de senha: a lista é só da equipe (cifrada com a senha do Privado) */
function Cadeado({ estado, desbloquear }: { estado: EstadoCofre; desbloquear: (senha: string) => Promise<void> }) {
  const [senha, setSenha] = useState('');
  const abrindo = estado === 'abrindo';
  return (
    <div className="mt-6 max-w-xl p-5 sm:p-6 rounded-2xl bg-white border border-slate-200">
      <h3 className="flex items-center gap-2 text-xl font-bold font-display text-[#0F2053]">
        <Icon name="shield" className="w-6 h-6" />
        Área da equipe da Ágil CM
      </h3>
      <p className="mt-2 text-[16px] text-slate-700 leading-relaxed">
        A lista de possíveis clientes é só da equipe. Digite a senha do Privado para abrir (quem já entrou no Privado nesta aba do navegador abre direto).
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

export default function PossiveisClientesTab() {
  const { dados, estado, desbloquear, trancar } = useClientesCifrados<Dados>();
  const [cidade, setCidade] = useState('');
  const [vista, setVista] = useState<Vista>('zm');
  const [soFora, setSoFora] = useState(false);
  const regiao = vista === 'zm' ? 'zm' : soFora ? 'fora' : '';
  const abrangencia = VISTAS.find((v) => v.id === vista)!.abrangencia;
  const [faixas, setFaixas] = useState<string[]>(FAIXAS.map((f) => f.id));
  const [q, setQ] = useState('');
  const [mostrar, setMostrar] = useState(30);
  const funil = useFunil();
  const [filtroFunil, setFiltroFunil] = useState('');
  const [ordem, setOrdem] = useState<Ordem>('nota');
  const [filtroFaixa, setFiltroFaixa] = useState<'' | Nota['faixa']>('');
  const registroDe = (cnpj: string) => funil[PREFIXO_FUNIL + cnpj];

  // editais abertos de Minas (a mesma lista de Editais abertos, guardada por 30 minutos): carregados quando pedidos
  const [editais, setEditais] = useState<EstadoEditais>(() => (listaPronta('mg') ? { estado: 'ok' } : { estado: 'nada' }));
  const [listaEditais, setListaEditais] = useState<EditalAberto[] | null>(() => (listaPronta('mg')?.items as EditalAberto[]) || null);
  const carregarEditais = () => {
    if (editais.estado === 'carregando') return;
    setEditais({ estado: 'carregando' });
    listaDe('mg', (lidos, total) => setEditais({ estado: 'carregando', lidos, total }))
      .then((l) => {
        setListaEditais(l.items as EditalAberto[]);
        setEditais({ estado: 'ok' });
      })
      .catch(() => setEditais({ estado: 'erro', erro: 'O PNCP não respondeu agora. Tente de novo em alguns minutos.' }));
  };
  const indice = useMemo(() => (listaEditais ? indiceEditais(listaEditais) : null), [listaEditais]);

  const colocacoes = useMemo(() => FAIXAS.filter((f) => faixas.includes(f.id)).flatMap((f) => f.cols), [faixas]);
  const filtradas = useMemo(
    () => (dados ? (filtrarClientes(dados, { cidade, colocacoes, q, regiao }) as Empresa[]) : []),
    [dados, cidade, colocacoes, q, regiao],
  );
  const testeFunil = FILTROS_FUNIL.find((f) => f.id === filtroFunil)?.teste || (() => true);
  // nota de cada empresa, pelas disputas da lista escolhida (Zona da Mata ou Minas)
  const notas = useMemo(() => {
    const m = new Map<string, Nota>();
    if (dados)
      for (const x of filtrarClientes(dados, { regiao: vista === 'zm' ? 'zm' : '' }) as Empresa[])
        m.set(x.cnpj, notaOportunidade(x, dados.licitacoes, hojeISO()));
    return m;
  }, [dados, vista]);
  const ultimaData = (x: Empresa) => x.disputas.reduce((m, d) => (dados!.licitacoes[d.lic].data > m ? dados!.licitacoes[d.lic].data : m), '');
  const entre2e5 = (x: Empresa) => x.disputas.filter((d) => d.col >= 2).length;
  const lista = filtradas
    .filter((e) => testeFunil(funil[PREFIXO_FUNIL + e.cnpj]) && (!filtroFaixa || notas.get(e.cnpj)?.faixa === filtroFaixa))
    .sort((a, b) =>
      ordem === 'nota'
        ? (notas.get(b.cnpj)?.nota ?? 0) - (notas.get(a.cnpj)?.nota ?? 0)
        : ordem === 'recentes'
          ? ultimaData(b).localeCompare(ultimaData(a))
          : ordem === 'nome'
            ? a.razao.localeCompare(b.razao, 'pt-BR')
            : entre2e5(b) - entre2e5(a),
    );
  const contaFaixa = (id: '' | Nota['faixa']) =>
    filtradas.filter((e) => testeFunil(funil[PREFIXO_FUNIL + e.cnpj]) && (!id || notas.get(e.cnpj)?.faixa === id)).length;
  const contaFunil = (id: string) =>
    filtradas.filter((e) => (FILTROS_FUNIL.find((f) => f.id === id)?.teste || (() => true))(funil[PREFIXO_FUNIL + e.cnpj])).length;
  const itens = lista.reduce((s, e) => s + e.disputas.length, 0);
  // a lista escolhida inteira, sem os outros filtros: números do topo, diagnóstico e mensagem
  const daVista = useMemo(() => (dados ? (filtrarClientes(dados, { regiao: vista === 'zm' ? 'zm' : '' }) as Empresa[]) : []), [dados, vista]);
  const porCnpj = useMemo(() => new Map(daVista.map((x) => [x.cnpj, x])), [daVista]);
  // editais abertos que combinam com cada empresa (na lista da Zona da Mata, só os da Zona da Mata)
  const combinam = useMemo(() => {
    if (!indice || !dados) return null;
    const agora = Date.now();
    return new Map(daVista.map((x) => [x.cnpj, editaisParaEmpresa(x, dados.licitacoes, indice, { agora, soZonaDaMata: vista === 'zm' }) as Combina[]]));
  }, [indice, daVista, dados, vista]);
  const contaVista: Record<Vista, number> = useMemo(
    () => ({ zm: dados ? filtrarClientes(dados, { regiao: 'zm' }).length : 0, mg: dados?.empresas.length ?? 0 }),
    [dados],
  );
  const resumoVista = useMemo(() => {
    const disputas = daVista.reduce((s, e) => s + e.disputas.length, 0);
    const lics = new Set(daVista.flatMap((e) => e.disputas.map((d) => d.lic))).size;
    return { empresas: daVista.length, disputas, licitacoes: lics };
  }, [daVista]);
  // período e andamento da leitura da lista escolhida (a Zona da Mata já tinha sido toda procurada antes de Minas)
  const metaVista: Dados | null =
    dados && (vista === 'zm' ? { ...dados, ...(dados.zonaDaMata || {}), abrangencia: 'Zona da Mata', buscaFeita: undefined } : dados);
  const porCidade = useMemo(() => {
    const m: Record<string, number> = {};
    if (dados) for (const e of filtrarClientes(dados, { colocacoes, q, regiao }) as Empresa[]) m[e.cidade] = (m[e.cidade] || 0) + 1;
    return m;
  }, [dados, colocacoes, q, regiao]);
  const foraDaZm = useMemo(() => (dados ? filtrarClientes(dados, { cidade, colocacoes, q, regiao: 'fora' }).length : 0), [dados, cidade, colocacoes, q]);

  const excel = () => {
    if (!dados) return;
    const linhas = (linhasPlanilha(dados, lista) as Record<string, string | number>[]).map((l) => {
      const r = registroDe(String(l.CNPJ).replace(/\D/g, ''));
      const n = notas.get(String(l.CNPJ).replace(/\D/g, ''));
      const linha: Record<string, string | number> = {
        'Nota da empresa': n?.nota ?? '',
        Temperatura: n ? FAIXA[n.faixa].nome : '',
        ...l,
        'Etapa da prospecção': etapaDe(r)?.nome || 'Sem contato',
        'Retornar em': r?.edital.propostasAte ? r.edital.propostasAte.split('-').reverse().join('/') : '',
        Anotação: r?.nota || '',
      };
      return linha;
    });
    if (!linhas.length) return;
    const titulos = Object.keys(linhas[0]);
    const moeda = new Set(['Melhor lance', 'Valor da vencedora']);
    const numero = new Set(['Diferença (%)', 'Empresas no item', 'Nota da empresa']);
    const larga = new Set(['Empresa', 'Descrição do item', 'Órgão', 'Objeto', 'Atividade principal', 'Link no PNCP', 'Anotação']);
    baixarXlsx(`possiveis-clientes-${vista === 'zm' ? 'zona-da-mata' : 'minas-gerais'}-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        nome: 'Possíveis clientes',
        colunas: titulos.map((t) => ({ titulo: t, largura: larga.has(t) ? 44 : 20, tipo: moeda.has(t) ? 'moeda' : numero.has(t) ? 'numero' : 'texto' })),
        linhas: linhas.map((l) => titulos.map((t) => l[t])),
      },
    ]);
  };

  return (
    <section aria-labelledby="titulo-clientes" className="bg-[#F4F7FB] py-8 sm:py-10">
      <Container>
        <h2 id="titulo-clientes" className="text-2xl sm:text-3xl font-bold font-display text-[#0F2053] tracking-tight">
          Possíveis clientes
        </h2>
        <p className="mt-2 max-w-4xl text-base sm:text-lg text-slate-700 leading-relaxed">
          Empresas de {dados ? listaCidades(dados.cidades) : 'cidades vizinhas'} que disputaram licitações e ficaram do 2º ao 5º lugar. Quem chega perto já
          participa, mas perde: é para essas empresas que a assessoria em licitações faz diferença.
        </p>

        {estado !== 'ok' && <Cadeado estado={estado} desbloquear={desbloquear} />}
        {estado === 'ok' && (
          <p className="mt-2 text-sm text-slate-600">
            Lista só da equipe, aberta com a senha do Privado.{' '}
            <button type="button" onClick={trancar} className="font-bold text-[#0369B3] underline underline-offset-4 cursor-pointer">
              Fechar a lista
            </button>
          </p>
        )}

        {estado === 'ok' && dados && metaVista && (
          <>
            <div role="group" aria-label="Quais licitações" className="mt-5 grid sm:grid-cols-2 gap-3">
              {VISTAS.map((v) => {
                const ativo = vista === v.id;
                const n = contaVista[v.id];
                return (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => {
                      setVista(v.id);
                      setMostrar(30);
                    }}
                    className={`text-left p-4 sm:p-5 rounded-2xl border-2 cursor-pointer ${
                      ativo ? 'bg-[#0F2053] border-[#0F2053] text-white' : 'bg-white border-slate-300 text-[#0F2053] hover:border-[#0478CA]'
                    }`}
                  >
                    <span className="block text-lg sm:text-xl font-bold font-display">{v.titulo}</span>
                    <span className={`block mt-0.5 text-[15px] ${ativo ? 'text-white/90' : 'text-slate-700'}`}>
                      {n} {n === 1 ? 'fornecedor' : 'fornecedores'} das {dados.cidades.length} cidades
                      {v.id === 'mg' ? ' (a Zona da Mata incluída)' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
            <Periodo dados={metaVista} />
            <ul className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                [resumoVista.empresas, resumoVista.empresas === 1 ? 'empresa' : 'empresas'],
                [resumoVista.disputas, 'itens disputados sem vencer'],
                [resumoVista.licitacoes, 'licitações com essas empresas'],
                [metaVista.licitacoesLidas ?? 0, 'atas lidas no período'],
              ].map(([valor, rotulo]) => (
                <li key={rotulo} className="p-4 rounded-2xl bg-white border border-slate-200">
                  <strong className="block text-2xl sm:text-3xl font-bold font-display text-[#0F2053] tabular-nums">{valor}</strong>
                  <span className="block text-sm sm:text-[15px] text-slate-700">{rotulo}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
              <div>
                <p id="rotulo-cidade" className="text-sm font-bold text-slate-700">
                  Cidade da empresa
                </p>
                <div role="group" aria-labelledby="rotulo-cidade" className="mt-2 flex flex-wrap gap-2">
                  <button type="button" aria-pressed={!cidade} onClick={() => setCidade('')} className={chip(!cidade)}>
                    Todas
                  </button>
                  {dados.cidades.map((c) => (
                    <button key={c} type="button" aria-pressed={cidade === c} onClick={() => setCidade(cidade === c ? '' : c)} className={chip(cidade === c)}>
                      {c} <span className="tabular-nums opacity-80">({porCidade[c] || 0})</span>
                    </button>
                  ))}
                </div>
              </div>
              {vista === 'mg' && (
                <label className="flex items-center gap-3 text-base text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={soFora}
                    onChange={(ev) => {
                      setSoFora(ev.target.checked);
                      setMostrar(30);
                    }}
                    className="w-5 h-5 accent-[#0F2053]"
                  />
                  Só licitações fora da Zona da Mata <span className="tabular-nums text-slate-600">({foraDaZm})</span>
                </label>
              )}
              <div>
                <p id="rotulo-funil" className="text-sm font-bold text-slate-700">
                  Prospecção
                </p>
                <div role="group" aria-labelledby="rotulo-funil" className="mt-2 flex flex-wrap gap-2">
                  {FILTROS_FUNIL.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={filtroFunil === f.id}
                      onClick={() => {
                        setFiltroFunil(f.id);
                        setMostrar(30);
                      }}
                      className={`${chip(filtroFunil === f.id)} ${f.id === 'retornar' && contaFunil('retornar') && filtroFunil !== f.id ? '!border-red-400 !text-red-800' : ''}`}
                    >
                      {f.rotulo} <span className="tabular-nums opacity-80">({contaFunil(f.id)})</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  A etapa, o retorno e a anotação de cada empresa ficam neste navegador. Com a planilha da equipe conectada (em Meus editais), ficam iguais para
                  todos.
                </p>
              </div>
              <div>
                <p id="rotulo-colocacao" className="text-sm font-bold text-slate-700">
                  Colocação no item
                </p>
                <div role="group" aria-labelledby="rotulo-colocacao" className="mt-2 flex flex-wrap gap-2">
                  {FAIXAS.map((f) => {
                    const ativo = faixas.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => setFaixas(ativo ? faixas.filter((x) => x !== f.id) : [...faixas, f.id])}
                        className={chip(ativo)}
                      >
                        {f.rotulo}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  “Melhor preço, não levou”: a empresa ofertou menos que a vencedora e mesmo assim perdeu o item (desclassificada, inabilitada ou desistente).
                </p>
              </div>
              <div>
                <p id="rotulo-faixa" className="text-sm font-bold text-slate-700">
                  Temperatura (nota de 0 a 100)
                </p>
                <div role="group" aria-labelledby="rotulo-faixa" className="mt-2 flex flex-wrap gap-2">
                  {FILTROS_FAIXA.map((f) => (
                    <button
                      key={f.id || 'todas'}
                      type="button"
                      aria-pressed={filtroFaixa === f.id}
                      onClick={() => {
                        setFiltroFaixa(f.id);
                        setMostrar(30);
                      }}
                      className={chip(filtroFaixa === f.id)}
                    >
                      {f.rotulo} <span className="tabular-nums opacity-80">({contaFaixa(f.id)})</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  A nota soma os itens perdidos por pouco ou com o melhor preço (até 40), quão recente foi a última disputa (até 25), quanto as vencedoras
                  levaram nesses itens (até 20) e quantas licitações a empresa disputou (até 15). Quente: 60 ou mais; morna: de 35 a 59.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Ordem</span>
                  <select value={ordem} onChange={(ev) => setOrdem(ev.target.value as Ordem)} className={`mt-1 ${campo} bg-white`}>
                    {ORDENS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex-1">
                  <span className="block text-sm font-bold text-slate-700">Editais abertos agora</span>
                  {editais.estado === 'ok' ? (
                    <p className="mt-1 py-3 text-[15px] text-slate-700">
                      {listaEditais?.length ?? 0} editais abertos de Minas carregados: cada empresa mostra os que combinam com ela.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={carregarEditais}
                      disabled={editais.estado === 'carregando'}
                      className="mt-1 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-2 border-[#0F2053] bg-white text-[#0F2053] text-base font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                    >
                      <Icon name="search" className="w-5 h-5" />
                      {editais.estado === 'carregando'
                        ? `Carregando${editais.total ? ` ${editais.lidos} de ${editais.total} páginas` : ''}…`
                        : 'Buscar editais abertos para todas'}
                    </button>
                  )}
                  {editais.estado === 'erro' && (
                    <p role="alert" className="mt-1 text-sm text-amber-900">
                      {editais.erro}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <label className="flex-1 block">
                  <span className="text-sm font-bold text-slate-700">Buscar por empresa, CNPJ, produto ou órgão</span>
                  <input
                    id="clientes-busca"
                    type="search"
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setMostrar(30);
                    }}
                    placeholder="ex.: papelaria, merenda, Ubá"
                    className={`mt-1 ${campo}`}
                  />
                </label>
                <button
                  type="button"
                  onClick={excel}
                  disabled={!lista.length}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0F2053] hover:bg-[#13306f] text-white text-base font-bold cursor-pointer disabled:opacity-50"
                >
                  <Icon name="sheet" className="w-5 h-5" />
                  Baixar em Excel
                </button>
              </div>
            </div>

            <p role="status" className="mt-5 text-base text-slate-800">
              <strong className="text-[#0F2053]">
                {lista.length} {lista.length === 1 ? 'empresa' : 'empresas'}
              </strong>{' '}
              e {itens} {itens === 1 ? 'item' : 'itens'} com esses filtros. Ordem: {ORDENS.find((o) => o.id === ordem)!.nome.toLowerCase()}.
            </p>
            {lista.length === 0 && (
              <p className="mt-3 p-4 rounded-xl bg-white border border-slate-200 text-slate-700">
                Nenhuma empresa com esses filtros. Marque mais colocações, escolha outra etapa da prospecção ou limpe a busca.
              </p>
            )}
            <ul className="mt-4 space-y-3">
              {lista.slice(0, mostrar).map((e) => (
                <CartaoEmpresa
                  key={e.cnpj}
                  e={e}
                  completa={porCnpj.get(e.cnpj) || e}
                  dados={dados}
                  registro={registroDe(e.cnpj)}
                  abrangencia={abrangencia}
                  nota={notas.get(e.cnpj)}
                  combina={combinam ? combinam.get(e.cnpj) || [] : undefined}
                  editais={editais}
                  carregarEditais={carregarEditais}
                />
              ))}
            </ul>
            {lista.length > mostrar && (
              <button
                type="button"
                onClick={() => setMostrar(mostrar + 30)}
                className="mt-4 px-5 py-3 rounded-xl border-2 border-slate-300 bg-white text-[#0F2053] text-base font-bold hover:border-[#0478CA] cursor-pointer"
              >
                Mostrar mais {Math.min(30, lista.length - mostrar)} de {lista.length - mostrar}
              </button>
            )}

            <NotaFonte dados={metaVista} />
          </>
        )}
      </Container>
    </section>
  );
}
