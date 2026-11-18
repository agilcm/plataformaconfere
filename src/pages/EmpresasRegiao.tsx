// Consulta CNPJ → "Empresas da região" (só da equipe): o cadastro da Receita das empresas ativas das cidades escolhidas,
// tirado do cnpj.db (scripts/cadastro-cnpj.mjs) e cifrado com a senha do Privado (prospeccao/cadastro.bin). Busca por
// CNPJ, nome ou ramo; filtros de cidade, porte, contato e licitações; telefone com WhatsApp, e-mail, endereço, o que a
// empresa já disputou nas atas lidas, planilha Excel e o funil de prospecção. CNPJ de fora das cidades: vai para
// "Consultar um CNPJ" (Receita na hora).
import { useMemo, useState, type FormEvent } from 'react';
import { Container, Icon } from '../components/ui.tsx';
import { cnpjFormatado, cnpjValido } from '../lib/possiveisClientes.js';
import { filtrarCadastro, linhasPlanilhaCadastro, mensagemCadastro, ordemCadastro, porteDe, textoBusca } from '../lib/consultaCnpj.js';
import { linkWhatsApp, telefonesDe } from '../lib/contatoCnpj.js';
import { atualizarFunil, ETAPAS_FUNIL, PREFIXO_FUNIL, useFunil, type EtapaFunil, type MeuEdital } from '../lib/meusEditais.ts';
import { baixarXlsx } from '../lib/xlsx.js';
import { ROUTES } from '../lib/routes.ts';
import { Cadeado, campo, chip, dataBR, useClientesCifrados } from './prospeccaoUi.tsx';

interface Empresa {
  cnpj: string;
  matriz: boolean;
  razao: string;
  fantasia: string;
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
  email: string;
  porte: string;
  natureza: string;
  capital: number;
  simples?: boolean;
  mei?: boolean;
  lic?: { itens: number; vitorias: number; perto: number; ultima: string };
}
interface Cadastro {
  geradoEm: string;
  publicadoEm?: string;
  cidades: string[];
  cnae: Record<string, string>;
  natureza: Record<string, string>;
  empresas: Empresa[];
}

const PORTES = ['MEI', 'Microempresa', 'Empresa de pequeno porte', 'Demais'];
const LICITACAO: { id: '' | 'sim' | 'nao'; rotulo: string }[] = [
  { id: '', rotulo: 'Todas' },
  { id: 'sim', rotulo: 'Já disputaram licitação' },
  { id: 'nao', rotulo: 'Nunca disputaram' },
];
const acao =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-bold cursor-pointer border-2 border-slate-200 bg-white text-[#0F2053] hover:border-[#0478CA]';
const idade = (iso: string) => {
  if (!iso) return '';
  const anos = Math.floor((Date.now() - Date.parse(iso)) / (365.25 * 86400e3));
  return anos < 1 ? 'aberta há menos de 1 ano' : `aberta há ${anos} ${anos === 1 ? 'ano' : 'anos'}`;
};
const etapaDe = (r?: MeuEdital) => (r ? ETAPAS_FUNIL.find((x) => x.id === r.etapa) : undefined);

function Cartao({ e, cnae, registro, ramos }: { e: Empresa; cnae: Record<string, string>; registro?: MeuEdital; ramos: number }) {
  const [copiado, setCopiado] = useState(false);
  const telefones = telefonesDe({ ddd_telefone_1: e.tel1, ddd_telefone_2: e.tel2 });
  const msg = mensagemCadastro(e);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(msg);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      if (!registro) atualizarFunil(e, { etapa: 'contato' });
    } catch {
      /* sem área de transferência */
    }
  };
  return (
    <li className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200">
      <p className="text-lg font-bold font-display text-[#0F2053] leading-snug">{e.razao}</p>
      <p className="mt-0.5 text-[15px] text-slate-700">
        {e.fantasia && e.fantasia !== e.razao ? `${e.fantasia} · ` : ''}CNPJ {cnpjFormatado(e.cnpj)}
        {e.matriz ? '' : ' (filial)'} · {e.cidade} - {e.uf}
      </p>
      <p className="mt-0.5 text-sm text-slate-600">
        {[porteDe(e), idade(e.abertura), cnae[e.cnae] || (e.cnae ? `atividade ${e.cnae}` : '')].filter(Boolean).join(' · ')}
        {ramos > 0 ? ` · mais ${ramos} ${ramos === 1 ? 'atividade' : 'atividades'}` : ''}
      </p>
      <p className="mt-2 flex flex-wrap gap-1.5">
        {e.lic ? (
          <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-amber-100 text-amber-900">
            disputou {e.lic.itens} {e.lic.itens === 1 ? 'item' : 'itens'} em licitações
            {e.lic.vitorias ? ` · venceu ${e.lic.vitorias}` : ''}
            {e.lic.perto ? ` · ${e.lic.perto} do 2º ao 5º lugar` : ''}
          </span>
        ) : (
          <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-slate-100 text-slate-700">nunca apareceu nas atas lidas</span>
        )}
        {etapaDe(registro) && <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold ${etapaDe(registro)!.cor}`}>{etapaDe(registro)!.nome}</span>}
      </p>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
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
        {e.email && (
          <a href={`mailto:${e.email}`} className="font-bold text-[#0369B3] underline underline-offset-4 break-all">
            {e.email}
          </a>
        )}
        {!telefones.length && !e.email && <span className="text-slate-600">Sem telefone nem e-mail no cadastro da Receita.</span>}
      </p>
      {(e.endereco || e.bairro) && (
        <p className="mt-1 text-sm text-slate-600">
          {[e.endereco, e.bairro, e.cep && `CEP ${e.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}`].filter(Boolean).join(' · ')}
        </p>
      )}
      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-end gap-2">
        <button type="button" onClick={copiar} className={acao}>
          {copiado ? 'Mensagem copiada' : 'Copiar mensagem'}
          <span className="sr-only"> para {e.razao}</span>
        </button>
        {e.lic && (
          <a href={`${ROUTES.diagnostico}?cnpj=${e.cnpj}`} target="_blank" rel="noopener noreferrer" className={acao}>
            Ver o diagnóstico<span className="sr-only"> de {e.razao} (abre em nova aba)</span>
          </a>
        )}
        <label className="block">
          <span className="block text-sm font-bold text-slate-700">Prospecção</span>
          <select
            value={registro?.etapa || ''}
            onChange={(ev) => atualizarFunil(e, { etapa: ev.target.value as EtapaFunil | '' })}
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

export default function EmpresasRegiao({ onConsultar }: { onConsultar: (cnpj: string) => void }) {
  const { dados, estado, desbloquear, trancar } = useClientesCifrados<Cadastro>('cadastro');
  const funil = useFunil();
  const [q, setQ] = useState('');
  const [busca, setBusca] = useState('');
  const [cidade, setCidade] = useState('');
  const [porte, setPorte] = useState('');
  const [telefone, setTelefone] = useState(false);
  const [email, setEmail] = useState(false);
  const [licitacao, setLicitacao] = useState<'' | 'sim' | 'nao'>('');
  const [mostrar, setMostrar] = useState(30);

  const indice = useMemo(() => new Map((dados?.empresas || []).map((e) => [e, textoBusca(e, dados!.cnae)])), [dados]);
  const lista = useMemo(
    () => (dados ? (filtrarCadastro(dados, { q: busca, cidade, porte, telefone, email, licitacao }, indice) as Empresa[]).sort(ordemCadastro) : []),
    [dados, busca, cidade, porte, telefone, email, licitacao, indice],
  );
  const porCidade = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of dados?.empresas || []) m[e.cidade] = (m[e.cidade] || 0) + 1;
    return m;
  }, [dados]);
  const buscar = (ev: FormEvent) => {
    ev.preventDefault();
    setBusca(q);
    setMostrar(30);
  };
  const digitos = busca.replace(/\D/g, '');
  const cnpjDeFora = digitos.length === 14 && cnpjValido(digitos) && !lista.length;

  const excel = () => {
    if (!dados || !lista.length) return;
    const linhas = (linhasPlanilhaCadastro(dados, lista.slice(0, 20000)) as Record<string, string | number>[]).map((l) => {
      const r = funil[PREFIXO_FUNIL + String(l.CNPJ).replace(/\D/g, '')];
      return { ...l, 'Etapa da prospecção': etapaDe(r)?.nome || 'Sem contato' };
    });
    const titulos = Object.keys(linhas[0]);
    const numero = new Set(['Itens disputados em licitações', 'Itens vencidos']);
    const larga = new Set(['Empresa', 'Nome fantasia', 'Atividade principal', 'Endereço', 'E-mail']);
    baixarXlsx(`consulta-cnpj-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        nome: 'Consulta CNPJ',
        colunas: titulos.map((t) => ({ titulo: t, largura: larga.has(t) ? 44 : 20, tipo: numero.has(t) ? 'numero' : 'texto' })),
        linhas: linhas.map((l) => titulos.map((t) => (l as Record<string, string | number>)[t])),
      },
    ]);
  };

  return (
    <section aria-labelledby="titulo-regiao" className="bg-[#F4F7FB] py-8 sm:py-10">
      <Container>
        <h2 id="titulo-regiao" className="text-2xl sm:text-3xl font-bold font-display text-[#0F2053] tracking-tight">
          Empresas da região
        </h2>
        <p className="mt-2 max-w-4xl text-base sm:text-lg text-slate-700 leading-relaxed">
          O cadastro da Receita das empresas ativas das cidades da região, com telefone, e-mail, endereço, ramo e o que cada uma já disputou em licitações.
          Serve para achar clientes novos, inclusive quem ainda não vende para prefeituras.
        </p>

        {estado !== 'ok' && <Cadeado estado={estado} desbloquear={desbloquear} oQue="O cadastro das empresas da região" />}
        {estado === 'ok' && dados && (
          <>
            <p className="mt-2 text-sm text-slate-600">
              {dados.empresas.length.toLocaleString('pt-BR')} empresas ativas de {dados.cidades.join(', ')}. Cadastro da Receita lido em{' '}
              {dataBR(dados.geradoEm)}.{' '}
              <button type="button" onClick={trancar} className="font-bold text-[#0369B3] underline underline-offset-4 cursor-pointer">
                Fechar
              </button>
            </p>

            <div className="mt-5 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
              <form onSubmit={buscar} role="search" className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <label className="flex-1 block">
                  <span className="text-sm font-bold text-slate-700">CNPJ, nome da empresa ou ramo</span>
                  <input
                    type="search"
                    value={q}
                    onChange={(ev) => setQ(ev.target.value)}
                    placeholder="ex.: 27.750.870/0001-34, papelaria, material de construção"
                    className={`mt-1 ${campo}`}
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0F2053] hover:bg-[#13306f] text-white text-base font-bold cursor-pointer"
                >
                  <Icon name="search" className="w-5 h-5" />
                  Consultar
                </button>
              </form>
              <div>
                <p id="rotulo-cnpj-cidade" className="text-sm font-bold text-slate-700">
                  Cidade
                </p>
                <div role="group" aria-labelledby="rotulo-cnpj-cidade" className="mt-2 flex flex-wrap gap-2">
                  <button type="button" aria-pressed={!cidade} onClick={() => setCidade('')} className={chip(!cidade)}>
                    Todas
                  </button>
                  {dados.cidades.map((c) => (
                    <button key={c} type="button" aria-pressed={cidade === c} onClick={() => setCidade(cidade === c ? '' : c)} className={chip(cidade === c)}>
                      {c} <span className="tabular-nums opacity-80">({(porCidade[c] || 0).toLocaleString('pt-BR')})</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col lg:flex-row gap-4">
                <div>
                  <p id="rotulo-cnpj-porte" className="text-sm font-bold text-slate-700">
                    Porte
                  </p>
                  <div role="group" aria-labelledby="rotulo-cnpj-porte" className="mt-2 flex flex-wrap gap-2">
                    <button type="button" aria-pressed={!porte} onClick={() => setPorte('')} className={chip(!porte)}>
                      Todos
                    </button>
                    {PORTES.map((p) => (
                      <button key={p} type="button" aria-pressed={porte === p} onClick={() => setPorte(porte === p ? '' : p)} className={chip(porte === p)}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p id="rotulo-cnpj-lic" className="text-sm font-bold text-slate-700">
                    Licitações
                  </p>
                  <div role="group" aria-labelledby="rotulo-cnpj-lic" className="mt-2 flex flex-wrap gap-2">
                    {LICITACAO.map((x) => (
                      <button
                        key={x.id || 'todas'}
                        type="button"
                        aria-pressed={licitacao === x.id}
                        onClick={() => setLicitacao(x.id)}
                        className={chip(licitacao === x.id)}
                      >
                        {x.rotulo}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <label className="flex items-center gap-2 text-base text-slate-800 cursor-pointer">
                  <input type="checkbox" checked={telefone} onChange={(ev) => setTelefone(ev.target.checked)} className="w-5 h-5 accent-[#0F2053]" />
                  Com telefone
                </label>
                <label className="flex items-center gap-2 text-base text-slate-800 cursor-pointer">
                  <input type="checkbox" checked={email} onChange={(ev) => setEmail(ev.target.checked)} className="w-5 h-5 accent-[#0F2053]" />
                  Com e-mail
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
                {lista.length.toLocaleString('pt-BR')} {lista.length === 1 ? 'empresa' : 'empresas'}
              </strong>{' '}
              com esses filtros. Primeiro as que já disputaram licitação.
              {lista.length > 20000 ? ' A planilha leva as primeiras 20 mil.' : ''}
            </p>
            {cnpjDeFora && (
              <p className="mt-4 p-4 rounded-2xl bg-white border border-slate-200 text-[15px] text-slate-800">
                O CNPJ {cnpjFormatado(digitos)} não é de uma empresa ativa das cidades da região.{' '}
                <button type="button" onClick={() => onConsultar(digitos)} className="font-bold text-[#0369B3] underline underline-offset-4 cursor-pointer">
                  Consultar na Receita
                </button>
              </p>
            )}
            <ul className="mt-4 space-y-3">
              {lista.slice(0, mostrar).map((e) => (
                <Cartao key={e.cnpj} e={e} cnae={dados.cnae} registro={funil[PREFIXO_FUNIL + e.cnpj]} ramos={e.cnaes?.length || 0} />
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
            <p className="mt-8 max-w-4xl text-[15px] text-slate-600 leading-relaxed">
              Fonte: cadastro de CNPJ da Receita Federal (dados abertos), só empresas com situação ativa. O telefone e o e-mail são os do cadastro, às vezes do
              contador. O histórico em licitações vem das atas do Portal de Compras Públicas lidas na Prospecção (Minas Gerais, últimos 12 meses). Esta lista é
              só da equipe e não aparece para os visitantes do site.
            </p>
          </>
        )}
      </Container>
    </section>
  );
}
