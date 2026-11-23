// Consulta CNPJ → "CNPJ problemático" (só da equipe): empresas das cidades da região com o CNPJ inapto ou excluídas do
// Simples ou do MEI no ano da base da Receita ou no anterior, com sócios, contato e o motivo provável (regras em
// src/lib/cnpjProblematico.js). A lista é montada pelo workflow "CNPJ problemático" (scripts/cnpj-problematico.mjs) e
// publicada cifrada com a senha do Privado (prospeccao/problematicos.bin). Serve para oferecer a regularização.
import { useMemo, useState, type FormEvent } from 'react';
import { Container, Icon } from '../components/ui.tsx';
import { cnpjFormatado } from '../lib/possiveisClientes.js';
import {
  CLASSES,
  docMascarado,
  emailDeContador,
  FAIXAS,
  filtrarProblematicos,
  individual,
  linhasPlanilhaProblematicos,
  mensagemProblematico,
  nomeTitular,
  ordemProblematicos,
  PORTES,
  PRIORIDADES,
  rotuloCaso,
  semCpf,
  SITUACOES,
  textoBuscaProblematico,
} from '../lib/cnpjProblematico.js';
import { linkWhatsApp, telefonesDe } from '../lib/contatoCnpj.js';
import { atualizarFunil, ETAPAS_FUNIL, PREFIXO_FUNIL, useFunil, type EtapaFunil, type MeuEdital } from '../lib/meusEditais.ts';
import { baixarXlsx } from '../lib/xlsx.js';
import { Cadeado, campo, chip, dataBR, useClientesCifrados } from './prospeccaoUi.tsx';

type Classe = 'problema' | 'crescimento' | 'verificar';
type Prioridade = 'alta' | 'media' | 'baixa';
interface Caso {
  tipo: 'inapta' | 'simples' | 'mei';
  data: string;
  classe: Classe;
  motivo: string;
}
interface Socio {
  nome: string;
  doc: string;
  pj: boolean;
  qual: string;
  entrada: string;
  faixa?: number;
  rep?: string;
  repQual?: string;
}
interface Registro {
  cnpj: string;
  matriz: boolean;
  razao: string;
  fantasia: string;
  situacao: string;
  dataSituacao: string;
  motivoSituacao: string;
  situacaoEspecial: string;
  abertura: string;
  cnae: string;
  cnaes: string[];
  endereco: string;
  bairro: string;
  cep: string;
  cidade: string;
  uf: string;
  tel1: string;
  tel2: string;
  fax: string;
  email: string;
  natureza: string;
  qualResp: string;
  capital: number | null;
  porte: string;
  simples: { opcao: string; dataOpcao: string; dataExclusao: string; mei: string; dataOpcaoMei: string; dataExclusaoMei: string } | null;
  socios: Socio[];
  titularCpf: string;
  casos: Caso[];
  classe: Classe;
  prioridade: Prioridade;
}
interface Dados {
  geradoEm: string;
  base: string;
  fonte?: string;
  anos: string[];
  cidades: string[];
  cnae: Record<string, string>;
  natureza: Record<string, string>;
  qualificacao: Record<string, string>;
  empresas: Registro[];
}

const COR_PRIORIDADE: Record<Prioridade, string> = {
  alta: 'bg-red-100 text-red-800',
  media: 'bg-amber-100 text-amber-900',
  baixa: 'bg-slate-100 text-slate-700',
};
const COR_CLASSE: Record<Classe, string> = {
  problema: 'bg-red-50 text-red-800 border border-red-200',
  crescimento: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  verificar: 'bg-slate-50 text-slate-700 border border-slate-200',
};
const acao =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-bold cursor-pointer border-2 border-slate-200 bg-white text-[#0F2053] hover:border-[#0478CA]';
const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const etapaDe = (r?: MeuEdital) => (r ? ETAPAS_FUNIL.find((x) => x.id === r.etapa) : undefined);
const paraFunil = (r: Registro) => ({ cnpj: r.cnpj, razao: semCpf(r.razao), cidade: r.cidade, uf: r.uf });

function Grupo<T extends string>({
  id,
  rotulo,
  valor,
  opcoes,
  mudar,
}: {
  id: string;
  rotulo: string;
  valor: T | '';
  opcoes: { id: T; nome: string; n?: number }[];
  mudar: (v: T | '') => void;
}) {
  return (
    <div>
      <p id={id} className="text-sm font-bold text-slate-700">
        {rotulo}
      </p>
      <div role="group" aria-labelledby={id} className="mt-2 flex flex-wrap gap-2">
        <button type="button" aria-pressed={!valor} onClick={() => mudar('')} className={chip(!valor)}>
          Todos
        </button>
        {opcoes.map((o) => (
          <button key={o.id} type="button" aria-pressed={valor === o.id} onClick={() => mudar(valor === o.id ? '' : o.id)} className={chip(valor === o.id)}>
            {o.nome}
            {o.n != null && <span className="tabular-nums opacity-80"> ({o.n.toLocaleString('pt-BR')})</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function Cartao({ r, dados, registro, onConsultar }: { r: Registro; dados: Dados; registro?: MeuEdital; onConsultar: (cnpj: string) => void }) {
  const [copiado, setCopiado] = useState(false);
  const telefones = telefonesDe({ ddd_telefone_1: r.tel1, ddd_telefone_2: r.tel2 });
  const msg = mensagemProblematico(r);
  const razao = semCpf(r.razao) || 'Empresa sem nome no cadastro';
  const contador = emailDeContador(r.email);
  const q = dados.qualificacao;
  const titular = !r.socios.length && individual(dados.natureza[r.natureza]) ? nomeTitular(r.razao) : '';
  const s = r.simples;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(msg);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      if (!registro) atualizarFunil(paraFunil(r), { etapa: 'contato' });
    } catch {
      /* sem área de transferência */
    }
  };
  const detalhes: [string, string][] = [
    ['Atividade principal', r.cnae ? `${r.cnae} - ${dados.cnae[r.cnae] || ''}` : ''],
    ['Natureza jurídica', dados.natureza[r.natureza] || r.natureza],
    ['Porte', PORTES[r.porte as keyof typeof PORTES] || ''],
    ['Capital social', r.capital ? moeda(r.capital) : ''],
    ['Aberta em', dataBR(r.abertura)],
    [
      'Situação na Receita',
      `${SITUACOES[r.situacao as keyof typeof SITUACOES] || r.situacao}${r.dataSituacao ? ` desde ${dataBR(r.dataSituacao)}` : ''}${r.motivoSituacao ? ` (${r.motivoSituacao.toLowerCase()})` : ''}`,
    ],
    ['Situação especial', r.situacaoEspecial],
    [
      'Simples Nacional',
      s
        ? `${s.opcao === 'S' ? 'optante hoje' : 'não optante hoje'}${s.dataOpcao ? ` · opção em ${dataBR(s.dataOpcao)}` : ''}${s.dataExclusao ? ` · exclusão em ${dataBR(s.dataExclusao)}` : ''}`
        : 'sem registro',
    ],
    [
      'MEI',
      s && (s.dataOpcaoMei || s.mei === 'S')
        ? `${s.mei === 'S' ? 'MEI hoje' : 'não é MEI hoje'}${s.dataOpcaoMei ? ` · opção em ${dataBR(s.dataOpcaoMei)}` : ''}${s.dataExclusaoMei ? ` · exclusão em ${dataBR(s.dataExclusaoMei)}` : ''}`
        : '',
    ],
    ['Atividades secundárias', r.cnaes.map((c) => `${c} - ${dados.cnae[c] || ''}`).join('; ')],
  ];
  return (
    <li className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200">
      <p className="flex flex-wrap gap-1.5">
        <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold ${COR_PRIORIDADE[r.prioridade]}`}>
          Prioridade {PRIORIDADES[r.prioridade].toLowerCase()}
        </span>
        <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold ${COR_CLASSE[r.classe]}`}>{CLASSES[r.classe]}</span>
        {r.casos.map((c) => (
          <span key={c.tipo} className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-[#0F2053] text-white">
            {rotuloCaso(c)}
          </span>
        ))}
        {etapaDe(registro) && <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold ${etapaDe(registro)!.cor}`}>{etapaDe(registro)!.nome}</span>}
      </p>
      <p className="mt-2 text-lg font-bold font-display text-[#0F2053] leading-snug">{razao}</p>
      <p className="mt-0.5 text-[15px] text-slate-700">
        {r.fantasia && r.fantasia !== razao ? `${r.fantasia} · ` : ''}CNPJ {cnpjFormatado(r.cnpj)}
        {r.matriz ? '' : ' (filial)'} · {r.cidade} - {r.uf}
      </p>

      <div className="mt-3 p-3 rounded-xl bg-[#F7FAFD] border border-slate-200">
        <p className="text-sm font-bold text-slate-600">Motivo provável</p>
        <ul className="mt-1 space-y-1 text-[15px] text-slate-900">
          {r.casos.map((c) => (
            <li key={c.tipo}>
              <strong>{c.tipo === 'inapta' ? 'Inapta' : c.tipo === 'simples' ? 'Simples' : 'MEI'}:</strong> {c.motivo}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3">
        <p className="text-sm font-bold text-slate-600">{r.socios.length ? `Sócios (${r.socios.length})` : 'Responsável'}</p>
        {r.socios.length ? (
          <ul className="mt-1 space-y-0.5 text-[15px] text-slate-900">
            {r.socios.map((x, i) => (
              <li key={`${x.nome}-${i}`}>
                <strong>{x.nome}</strong>
                {' — '}
                {[
                  (q[x.qual] || x.qual || '').toLowerCase(),
                  x.doc && `${x.pj ? 'CNPJ' : 'CPF'} ${docMascarado(x.doc)}`,
                  x.entrada && `desde ${dataBR(x.entrada)}`,
                  !x.pj && x.faixa ? FAIXAS[x.faixa as keyof typeof FAIXAS]?.toLowerCase() : '',
                  x.rep && `representado por ${x.rep}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[15px] text-slate-900">
            {titular ? (
              <>
                <strong>{titular}</strong> (titular){r.titularCpf ? ` · CPF ${r.titularCpf}` : ''}
              </>
            ) : (
              <span className="text-slate-600">Sem quadro de sócios no cadastro da Receita.</span>
            )}
          </p>
        )}
      </div>

      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
        {telefones.map((t) =>
          t.celular ? (
            <a
              key={t.numero}
              href={linkWhatsApp(t.numero, msg)}
              target="_blank"
              rel="noopener noreferrer"
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
        {r.email && (
          <a
            href={`mailto:${r.email}?subject=${encodeURIComponent(`Regularização do CNPJ ${cnpjFormatado(r.cnpj)}`)}&body=${encodeURIComponent(msg)}`}
            className="font-bold text-[#0369B3] underline underline-offset-4 break-all"
          >
            {r.email}
          </a>
        )}
        {contador && <span className="px-2 py-0.5 rounded-full text-sm font-bold bg-slate-100 text-slate-700">parece e-mail de contador</span>}
        {!telefones.length && !r.email && <span className="text-slate-600">Sem telefone nem e-mail no cadastro da Receita.</span>}
      </p>
      {(r.endereco || r.bairro) && (
        <p className="mt-1 text-sm text-slate-600">
          {[r.endereco, r.bairro, r.cep && `CEP ${r.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}`].filter(Boolean).join(' · ')}
        </p>
      )}

      <details className="mt-3 group">
        <summary className="cursor-pointer text-[15px] font-bold text-[#0369B3] underline underline-offset-4">Mais dados do cadastro</summary>
        <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {detalhes
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className={`p-2.5 rounded-xl bg-[#F7FAFD] border border-slate-200 ${k === 'Atividades secundárias' ? 'sm:col-span-2' : ''}`}>
                <dt className="text-sm font-bold text-slate-600">{k}</dt>
                <dd className="text-[15px] text-slate-900">{v}</dd>
              </div>
            ))}
        </dl>
      </details>

      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-end gap-2">
        <button type="button" onClick={copiar} className={acao}>
          {copiado ? 'Mensagem copiada' : 'Copiar mensagem'}
          <span className="sr-only"> para {razao}</span>
        </button>
        <button type="button" onClick={() => onConsultar(r.cnpj)} className={acao}>
          Ver a ficha de hoje na Receita<span className="sr-only"> de {razao}</span>
        </button>
        <label className="block">
          <span className="block text-sm font-bold text-slate-700">Prospecção</span>
          <select
            value={registro?.etapa || ''}
            onChange={(ev) => atualizarFunil(paraFunil(r), { etapa: ev.target.value as EtapaFunil | '' })}
            className="mt-1 px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-[15px]"
          >
            <option value="">Sem contato</option>
            {ETAPAS_FUNIL.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
    </li>
  );
}

export default function CnpjProblematico({ onConsultar }: { onConsultar: (cnpj: string) => void }) {
  const { dados, estado, desbloquear, trancar } = useClientesCifrados<Dados>('problematicos');
  const funil = useFunil();
  const [q, setQ] = useState('');
  const [busca, setBusca] = useState('');
  const [cidade, setCidade] = useState('');
  const [caso, setCaso] = useState('');
  const [classe, setClasse] = useState<Classe | ''>('');
  const [prioridade, setPrioridade] = useState<Prioridade | ''>('');
  const [telefone, setTelefone] = useState(false);
  const [email, setEmail] = useState(false);
  const [semContador, setSemContador] = useState(false);
  const [mostrar, setMostrar] = useState(30);

  const indice = useMemo(() => new Map((dados?.empresas || []).map((r) => [r, textoBuscaProblematico(r, dados!.cnae)])), [dados]);
  const lista = useMemo(
    () =>
      dados
        ? (filtrarProblematicos(dados, { q: busca, cidade, caso, classe, prioridade, telefone, email, semContador }, indice) as Registro[]).sort(
            ordemProblematicos,
          )
        : [],
    [dados, busca, cidade, caso, classe, prioridade, telefone, email, semContador, indice],
  );
  const contagem = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of dados?.empresas || []) {
      c[`cidade:${r.cidade}`] = (c[`cidade:${r.cidade}`] || 0) + 1;
      c[`classe:${r.classe}`] = (c[`classe:${r.classe}`] || 0) + 1;
      c[`prioridade:${r.prioridade}`] = (c[`prioridade:${r.prioridade}`] || 0) + 1;
      for (const x of r.casos) {
        const k = x.tipo === 'inapta' ? 'inapta' : `${x.tipo}-${x.data.slice(0, 4)}`;
        c[`caso:${k}`] = (c[`caso:${k}`] || 0) + 1;
      }
    }
    return c;
  }, [dados]);
  const casos = useMemo(
    () =>
      dados
        ? [
            { id: 'inapta', nome: 'CNPJ inapto' },
            ...dados.anos.map((a) => ({ id: `simples-${a}`, nome: `Excluídas do Simples em ${a}` })),
            ...dados.anos.map((a) => ({ id: `mei-${a}`, nome: `Excluídas do MEI em ${a}` })),
          ].map((x) => ({ ...x, n: contagem[`caso:${x.id}`] || 0 }))
        : [],
    [dados, contagem],
  );
  const filtrar = (fn: () => void) => {
    fn();
    setMostrar(30);
  };
  const buscar = (ev: FormEvent) => {
    ev.preventDefault();
    filtrar(() => setBusca(q));
  };

  const excel = () => {
    if (!dados || !lista.length) return;
    type Linha = Record<string, string | number | null>;
    const linhas = (linhasPlanilhaProblematicos(dados, lista) as unknown as Linha[]).map((l): Linha => {
      const r = funil[PREFIXO_FUNIL + String(l.CNPJ).replace(/\D/g, '')];
      return { ...l, 'Etapa da prospecção': etapaDe(r)?.nome || 'Sem contato' };
    });
    const titulos = Object.keys(linhas[0]);
    const larga = new Set([
      'Motivo provável',
      'Razão social',
      'Nome fantasia',
      'Atividade principal',
      'Atividades secundárias',
      'Endereço',
      'E-mail',
      'Demais sócios',
    ]);
    baixarXlsx(`cnpj-problematico-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        nome: 'CNPJ problemático',
        colunas: titulos.map((t) => ({
          titulo: t,
          largura: larga.has(t) ? 48 : /nome/.test(t) ? 34 : 18,
          tipo: t === 'Capital social' ? 'moeda' : t === 'Nº de sócios' ? 'numero' : 'texto',
        })),
        linhas: linhas.map((l) => titulos.map((t) => l[t] ?? '')),
      },
    ]);
  };

  return (
    <section aria-labelledby="titulo-problematico" className="bg-[#F4F7FB] py-8 sm:py-10">
      <Container>
        <h2 id="titulo-problematico" className="text-2xl sm:text-3xl font-bold font-display text-[#0F2053] tracking-tight">
          CNPJ problemático
        </h2>
        <p className="mt-2 max-w-4xl text-base sm:text-lg text-slate-700 leading-relaxed">
          Empresas da região com o CNPJ inapto ou que saíram do Simples ou do MEI, com os sócios, o contato e o motivo provável. Quem saiu por ato da Receita
          (débitos, falta de declaração) precisa de regularização; quem saiu do MEI por faturamento está crescendo e precisa de contabilidade.
        </p>

        {estado !== 'ok' && <Cadeado estado={estado} desbloquear={desbloquear} oQue="A lista de CNPJs problemáticos" />}
        {estado === 'ok' && dados && (
          <>
            <p className="mt-2 text-sm text-slate-600">
              {dados.empresas.length.toLocaleString('pt-BR')} estabelecimentos de {dados.cidades.join(', ')}. Base da Receita de{' '}
              {dados.base.split('-').reverse().join('/')}
              {dados.fonte ? ` (${dados.fonte})` : ''}, lida em {dataBR(dados.geradoEm)}.{' '}
              <button type="button" onClick={trancar} className="font-bold text-[#0369B3] underline underline-offset-4 cursor-pointer">
                Fechar
              </button>
            </p>

            <div className="mt-5 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
              <form onSubmit={buscar} role="search" className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <label className="flex-1 block">
                  <span className="text-sm font-bold text-slate-700">CNPJ, nome da empresa, sócio, e-mail ou ramo</span>
                  <input
                    type="search"
                    value={q}
                    onChange={(ev) => setQ(ev.target.value)}
                    placeholder="ex.: 12.345.678/0001-95, padaria, nome de um sócio"
                    className={`mt-1 ${campo}`}
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0F2053] hover:bg-[#13306f] text-white text-base font-bold cursor-pointer"
                >
                  <Icon name="search" className="w-5 h-5" />
                  Buscar
                </button>
              </form>
              <Grupo id="rotulo-prob-caso" rotulo="Situação" valor={caso} opcoes={casos} mudar={(v) => filtrar(() => setCaso(v))} />
              <Grupo
                id="rotulo-prob-cidade"
                rotulo="Cidade"
                valor={cidade}
                opcoes={dados.cidades.map((c) => ({ id: c, nome: c, n: contagem[`cidade:${c}`] || 0 }))}
                mudar={(v) => filtrar(() => setCidade(v))}
              />
              <div className="flex flex-col lg:flex-row gap-4">
                <Grupo
                  id="rotulo-prob-classe"
                  rotulo="Tipo de caso"
                  valor={classe}
                  opcoes={(Object.keys(CLASSES) as Classe[]).map((k) => ({ id: k, nome: CLASSES[k], n: contagem[`classe:${k}`] || 0 }))}
                  mudar={(v) => filtrar(() => setClasse(v))}
                />
                <Grupo
                  id="rotulo-prob-prioridade"
                  rotulo="Prioridade"
                  valor={prioridade}
                  opcoes={(Object.keys(PRIORIDADES) as Prioridade[]).map((k) => ({ id: k, nome: PRIORIDADES[k], n: contagem[`prioridade:${k}`] || 0 }))}
                  mudar={(v) => filtrar(() => setPrioridade(v))}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <label className="flex items-center gap-2 text-base text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={telefone}
                    onChange={(ev) => filtrar(() => setTelefone(ev.target.checked))}
                    className="w-5 h-5 accent-[#0F2053]"
                  />
                  Com telefone
                </label>
                <label className="flex items-center gap-2 text-base text-slate-800 cursor-pointer">
                  <input type="checkbox" checked={email} onChange={(ev) => filtrar(() => setEmail(ev.target.checked))} className="w-5 h-5 accent-[#0F2053]" />
                  Com e-mail
                </label>
                <label className="flex items-center gap-2 text-base text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={semContador}
                    onChange={(ev) => filtrar(() => setSemContador(ev.target.checked))}
                    className="w-5 h-5 accent-[#0F2053]"
                  />
                  Sem e-mail de contador
                </label>
                <button
                  type="button"
                  onClick={excel}
                  disabled={!lista.length}
                  className="ml-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0F2053] hover:bg-[#13306f] text-white text-base font-bold cursor-pointer disabled:opacity-50"
                >
                  <Icon name="sheet" className="w-5 h-5" />
                  Baixar em Excel
                </button>
              </div>
            </div>

            <p role="status" className="mt-5 text-base text-slate-800">
              <strong className="text-[#0F2053]">
                {lista.length.toLocaleString('pt-BR')} {lista.length === 1 ? 'estabelecimento' : 'estabelecimentos'}
              </strong>{' '}
              com esses filtros. Primeiro os de prioridade alta.
            </p>
            <ul className="mt-4 space-y-3">
              {lista.slice(0, mostrar).map((r) => (
                <Cartao key={r.cnpj} r={r} dados={dados} registro={funil[PREFIXO_FUNIL + r.cnpj]} onConsultar={onConsultar} />
              ))}
            </ul>
            {lista.length > mostrar && (
              <button
                type="button"
                onClick={() => setMostrar(mostrar + 30)}
                className="mt-4 px-5 py-3 rounded-xl border-2 border-slate-300 bg-white text-[#0F2053] text-base font-bold hover:border-[#0478CA] cursor-pointer"
              >
                Mostrar mais {Math.min(30, lista.length - mostrar)} de {(lista.length - mostrar).toLocaleString('pt-BR')}
              </button>
            )}

            <div className="mt-8 max-w-4xl space-y-3 text-[15px] text-slate-600 leading-relaxed">
              <p>
                <strong className="text-slate-800">Como o motivo é deduzido.</strong> A Receita não publica o motivo da exclusão do Simples ou do MEI na base
                aberta; ele só aparece por CNPJ na Consulta Optantes do Portal do Simples. Por isso o motivo é deduzido pelo que aconteceu com a empresa.{' '}
                <em>Problema</em>: CNPJ inapto, saída do MEI e do Simples na mesma data, exclusão do Simples com efeito em 1º de janeiro (a exclusão anual de
                ofício por débitos) ou saída do MEI seguida de exclusão do Simples. <em>Crescimento</em>: saiu do MEI e continua no Simples como microempresa
                (em geral faturamento acima do limite, entrada de sócio, filial ou atividade não permitida ao MEI). <em>Verificar</em>: exclusão no meio do ano,
                que pode ser pedido da empresa ou ato de ofício; confirme na Consulta Optantes.
              </p>
              <p>
                <strong className="text-slate-800">Prioridade.</strong> Alta: problema e com telefone ou e-mail que não é de contador. Média: problema com
                e-mail de contador, ou crescimento sem contador. Baixa: o resto. Nas exclusões entram só empresas ainda abertas (ativas, suspensas ou inaptas).
              </p>
              <p>
                Fonte: Dados Abertos do CNPJ da Receita Federal (estabelecimentos, empresas, sócios e Simples/MEI). CPFs mascarados como a Receita publica.
                Telefone e e-mail são os informados à Receita e podem estar desatualizados ou ser do contador. São dados públicos, mas com nomes de pessoas: use
                só para oferecer o serviço e tire da lista quem pedir para não ser procurado (LGPD). Esta lista é só da equipe e não aparece para os visitantes
                do site.
              </p>
            </div>
          </>
        )}
      </Container>
    </section>
  );
}
