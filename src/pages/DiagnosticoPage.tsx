// "Diagnóstico de licitações" (/diagnostico-licitacoes/): a empresa digita o CNPJ e vê, na hora, em quais licitações de
// Minas Gerais dos últimos 12 meses ficou do 2º ao 5º lugar (ou ofertou o melhor preço e não levou), por quanto perdeu
// e o que os números sugerem; baixa o PDF e chama a Ágil CM no WhatsApp. Os dados são as partes de
// prospeccao/cnpj/ (scripts/possiveis-clientes.mjs, a partir das atas do Portal de Compras Públicas no PNCP).
// Aceita ?cnpj= no endereço, para mandar o link pronto para a empresa.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Header from '../components/Header.tsx';
import Footer from '../components/Footer.tsx';
import ContactSection from '../components/ContactSection.tsx';
import WhatsAppFloatingButton from '../components/WhatsAppFloatingButton.tsx';
import { btnWhatsApp, Container, Icon, WhatsAppIcon } from '../components/ui.tsx';
import { COMPANY_PROFILE, whatsappLink } from '../data/servicesData.ts';
import { analisar, distancia, leituras, maisPerto } from '../lib/diagnostico.js';
import { cnpjFormatado, cnpjValido, DIGITOS_PARTE, expandirDiagnostico, textoColocacao } from '../lib/possiveisClientes.js';
import { ROUTES, rotaServico } from '../lib/routes.ts';
import { brl, dataBR, valorLance } from './prospeccaoUi.tsx';

interface Disputa {
  lic: number;
  item: string;
  desc: string;
  col: number;
  melhor: number;
  venc: number | null;
  lances: number;
  participantes: number;
  vt?: number;
  lote?: boolean;
  desconto?: boolean;
}
interface EmpresaDiag {
  cnpj: string;
  razao: string;
  fantasia: string;
  cidade: string;
  uf: string;
  porte: string;
  atividade: string;
  vitorias: number;
  disputas: Disputa[];
}
interface LicitacaoDiag {
  id: string;
  orgao: string;
  municipio: string;
  uf: string;
  data: string;
}
interface Info {
  atualizadoEm?: string;
  desde?: string;
  ate?: string;
  empresas?: number;
  licitacoesLidas?: number;
}
type Estado = 'nada' | 'buscando' | 'achou' | 'naoachou' | 'invalido' | 'erro';

const h2 = 'text-2xl sm:text-3xl font-bold font-display text-[#0F2053] tracking-tight [text-wrap:balance]';
const n = (q: number, um: string, varios: string) => `${q.toLocaleString('pt-BR')} ${q === 1 ? um : varios}`;
const mascara = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};
const CONTATO = { whatsapp: COMPANY_PROFILE.phoneDisplay, email: COMPANY_PROFILE.email, site: 'www.agilcm.com.br/assessoria-licitacoes/' };

const COMO_AJUDA = [
  [
    'Documentos em dia',
    'Conferimos a habilitação antes de cada envio: certidão vencida ou documento faltando é a causa mais comum de perder com o melhor preço.',
  ],
  ['Proposta no modelo do edital', 'Montamos a proposta e a planilha como o edital pede, para não haver desclassificação por detalhe.'],
  ['Estratégia de lances', 'Acompanhamos a sessão ao vivo e lançamos no tempo certo. Empate se perde para quem lançou primeiro.'],
  ['Recursos e impugnações', 'Quando a decisão do pregoeiro está errada, entramos com recurso no prazo.'],
];

function Resultado({ empresa, licitacoes, info }: { empresa: EmpresaDiag; licitacoes: LicitacaoDiag[]; info: Info | null }) {
  const a = analisar(empresa, licitacoes);
  const lista = (maisPerto(empresa.disputas) as Disputa[]).slice(0, 10);
  const ls = leituras(a) as string[];
  const [gerando, setGerando] = useState(false);
  const pdf = async () => {
    setGerando(true);
    try {
      const [{ downloadPdf, dateText, slug }, { blocosDiagnostico }] = await Promise.all([import('../lib/pdfReport.ts'), import('../lib/diagnostico.js')]);
      const dados = { licitacoes, desde: info?.desde, ate: info?.ate, atualizadoEm: info?.atualizadoEm };
      await downloadPdf(
        `diagnostico-licitacoes-${slug(empresa.razao)}.pdf`,
        `Diagnóstico de licitações - ${empresa.razao}`,
        blocosDiagnostico(empresa, dados, { data: dateText(), contato: CONTATO }) as Parameters<typeof downloadPdf>[2],
      );
    } finally {
      setGerando(false);
    }
  };
  const msg = `Olá! Vi no site da Ágil CM o diagnóstico de licitações da ${empresa.razao} (CNPJ ${cnpjFormatado(empresa.cnpj)}) e quero ajuda para vencer mais.`;
  const cartoes: [number, string][] = [
    [a.itens, a.itens === 1 ? 'item disputado sem vencer' : 'itens disputados sem vencer'],
    [a.licitacoes, a.licitacoes === 1 ? 'licitação' : 'licitações'],
    [a.segundo, 'vezes em 2º lugar'],
    [a.perto, 'perdidos por pouco (até 5%, empates incluídos)'],
    [a.naoLevou, 'com o melhor preço e sem levar'],
  ];
  return (
    <div className="space-y-6">
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200">
        <p className="text-sm font-bold text-[#0369B3]">Diagnóstico de licitações · últimos 12 meses · Minas Gerais</p>
        <h3 id="titulo-empresa" tabIndex={-1} className="mt-1 text-2xl sm:text-3xl font-bold font-display text-[#0F2053] leading-tight outline-none">
          {empresa.razao}
        </h3>
        <p className="mt-1 text-[15px] text-slate-700">
          CNPJ {cnpjFormatado(empresa.cnpj)}
          {empresa.cidade ? ` · ${empresa.cidade} - ${empresa.uf}` : ''}
          {empresa.vitorias > 0 ? ` · venceu ${n(empresa.vitorias, 'item', 'itens')} no período` : ''}
        </p>
        <ul className="mt-5 grid grid-cols-2 lg:grid-cols-5 gap-3">
          {cartoes.map(([v, r]) => (
            <li key={r} className="p-4 rounded-2xl bg-[#F4F7FB] border border-slate-200">
              <strong className="block text-2xl sm:text-3xl font-bold font-display text-[#0F2053] tabular-nums">{v}</strong>
              <span className="block text-sm sm:text-[15px] text-slate-700">{r}</span>
            </li>
          ))}
        </ul>
        {a.valorNaMesa > 0 && (
          <p className="mt-4 text-lg text-slate-800">
            Nesses itens, as vencedoras levaram <strong className="text-[#0F2053]">{brl(a.valorNaMesa)}</strong>, segundo as atas.
          </p>
        )}
      </div>

      {ls.length > 0 && (
        <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200">
          <h3 className="text-xl font-bold font-display text-[#0F2053]">O que os números sugerem</h3>
          <ul className="mt-3 space-y-2 list-disc pl-5 text-[16px] text-slate-800 leading-relaxed">
            {ls.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200">
        <h3 className="text-xl font-bold font-display text-[#0F2053]">
          {lista.length === 1 ? 'Onde a empresa chegou perto' : `Os ${lista.length} itens em que a empresa chegou mais perto`}
        </h3>
        <ol className="mt-4 space-y-2.5">
          {lista.map((d, i) => {
            const lic = licitacoes[d.lic];
            const x = distancia(d) as { texto: string; empate?: boolean } | null;
            return (
              <li key={i} className="p-3 sm:p-4 rounded-xl bg-[#F7FAFD] border border-slate-200 text-[15px] leading-relaxed">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-amber-100 text-amber-900">{textoColocacao(d.col)}</span>
                  <span className="text-slate-800">{d.desc}</span>
                </p>
                <p className="mt-1 text-slate-700">
                  Lance {valorLance(d.melhor, d.desconto)}
                  {d.venc != null && <> · vencedora {valorLance(d.venc, d.desconto)}</>}
                  {x && d.col !== 0 && <> · {x.empate ? `${x.texto} (perdeu no desempate)` : d.desconto ? x.texto : `${x.texto} da vencedora`}</>}
                </p>
                <p className="mt-1 text-slate-700">
                  <strong className="text-[#0F2053]">{lic.orgao}</strong> · {lic.municipio} - {lic.uf} · {dataBR(lic.data)} ·{' '}
                  <a
                    href={`https://pncp.gov.br/app/editais/${lic.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-[#0369B3] underline underline-offset-4"
                  >
                    ver no PNCP<span className="sr-only"> (abre em nova aba)</span>
                  </a>
                </p>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="p-6 sm:p-8 rounded-3xl bg-[#0F2053] text-white">
        <h3 className="text-2xl font-bold font-display">Quer virar esse resultado?</h3>
        <p className="mt-2 text-lg text-white/90 leading-relaxed">
          A Ágil CM cuida das licitações da sua empresa: documentos, proposta, lances e recursos. Fale com a gente e receba o diagnóstico completo.
        </p>
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <a href={whatsappLink(msg)} target="_blank" rel="noopener noreferrer" className={btnWhatsApp}>
            <WhatsAppIcon className="w-5 h-5" />
            Falar no WhatsApp
          </a>
          <button
            type="button"
            onClick={pdf}
            disabled={gerando}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-bold text-[#0F2053] bg-white hover:bg-slate-100 rounded-xl cursor-pointer disabled:opacity-70 disabled:cursor-wait"
          >
            <Icon name="doc" className="w-5 h-5" />
            {gerando ? 'Gerando o PDF…' : 'Baixar o diagnóstico em PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DiagnosticoPage() {
  const [cnpj, setCnpj] = useState('');
  const [estado, setEstado] = useState<Estado>('nada');
  const [achado, setAchado] = useState<{ empresa: EmpresaDiag; licitacoes: LicitacaoDiag[] } | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const resultado = useRef<HTMLDivElement>(null);

  const buscar = async (valor: string) => {
    const d = valor.replace(/\D/g, '');
    setAchado(null);
    if (!cnpjValido(d)) {
      setEstado('invalido');
      return;
    }
    setEstado('buscando');
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}prospeccao/cnpj/${d.slice(0, DIGITOS_PARTE)}.json`, { cache: 'no-cache' });
      const parte = r.ok ? await r.json() : null;
      if (!r.ok && r.status !== 404) throw new Error(String(r.status));
      const x = parte ? (expandirDiagnostico(parte, d) as { empresa: EmpresaDiag; licitacoes: LicitacaoDiag[] } | null) : null;
      setAchado(x);
      setEstado(x ? 'achou' : 'naoachou');
      // o endereço fica com o CNPJ, para compartilhar o diagnóstico
      const url = new URL(window.location.href);
      url.searchParams.set('cnpj', d);
      window.history.replaceState(null, '', url);
    } catch {
      setEstado('erro');
    }
    requestAnimationFrame(() => {
      resultado.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      (resultado.current?.querySelector('#titulo-empresa, [data-foco]') as HTMLElement | null)?.focus();
    });
  };

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}prospeccao/cnpj/info.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setInfo)
      .catch(() => setInfo(null));
    const doLink = new URLSearchParams(window.location.search).get('cnpj');
    if (doLink) {
      setCnpj(mascara(doLink));
      buscar(doLink);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enviar = (ev: FormEvent) => {
    ev.preventDefault();
    buscar(cnpj);
  };
  const cnpjDigitado = cnpjFormatado(cnpj.replace(/\D/g, ''));

  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2 focus:bg-[#0478CA] focus:text-white focus:rounded-lg focus:font-semibold"
      >
        Pular para o conteúdo
      </a>
      <Header page="servico" />
      <main id="conteudo">
        <section className="relative bg-gradient-to-br from-[#0F2053] via-[#13306f] to-[#0A1640] text-white overflow-hidden">
          <div aria-hidden="true" className="absolute -top-32 -right-20 w-[30rem] h-[30rem] rounded-full bg-[#0478CA]/30 blur-3xl" />
          <Container className="relative py-12 sm:py-16">
            <nav aria-label="Você está em" className="text-sm text-white/75">
              <ol className="flex flex-wrap items-center gap-2">
                <li>
                  <a href={ROUTES.home} className="hover:text-white underline-offset-2 hover:underline">
                    Início
                  </a>
                </li>
                <li aria-hidden="true">›</li>
                <li aria-current="page" className="text-white">
                  Diagnóstico de licitações
                </li>
              </ol>
            </nav>
            <p className="mt-6 text-sm font-bold text-[#9fd3ff]">Diagnóstico gratuito, na hora</p>
            <h1 className="mt-2 max-w-4xl text-3xl sm:text-5xl font-bold font-display tracking-tight leading-tight [text-wrap:balance]">
              Quanto sua empresa deixou de ganhar em licitações?
            </h1>
            <p className="mt-5 max-w-3xl text-lg sm:text-xl text-white/90 leading-relaxed">
              Digite o CNPJ e veja em quais licitações de Minas Gerais dos últimos 12 meses sua empresa ficou do 2º ao 5º lugar, por quanto perdeu e o que dá
              para mudar. Sem cadastro.
            </p>
            <form onSubmit={enviar} className="mt-8 max-w-2xl flex flex-col sm:flex-row gap-3 sm:items-end" role="search" aria-label="Diagnóstico por CNPJ">
              <label className="flex-1 block">
                <span className="block text-base font-bold">CNPJ da empresa</span>
                <input
                  value={cnpj}
                  onChange={(ev) => setCnpj(mascara(ev.target.value))}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="00.000.000/0000-00"
                  aria-describedby="ajuda-cnpj"
                  className="mt-2 w-full px-4 py-3.5 rounded-xl border-2 border-white/30 bg-white text-[#0F2053] text-lg font-semibold tracking-wide focus:outline-none focus:ring-4 focus:ring-[#9fd3ff]/60"
                />
              </label>
              <button
                type="submit"
                disabled={estado === 'buscando'}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#0478CA] hover:bg-[#0369B3] text-white text-lg font-bold cursor-pointer disabled:opacity-70 disabled:cursor-wait"
              >
                <Icon name="search" className="w-5 h-5" />
                {estado === 'buscando' ? 'Procurando…' : 'Ver o diagnóstico'}
              </button>
            </form>
            <p id="ajuda-cnpj" className="mt-3 max-w-2xl text-[15px] text-white/80">
              Os dados vêm das atas públicas das sessões, publicadas pelos próprios órgãos no Portal Nacional de Contratações Públicas (PNCP).
              {info?.licitacoesLidas ? ` São ${n(info.licitacoesLidas, 'ata lida', 'atas lidas')} até agora.` : ''}
            </p>
          </Container>
        </section>

        <section aria-labelledby="titulo-resultado" className="py-10 sm:py-14 bg-[#F4F7FB]">
          <Container>
            <h2 id="titulo-resultado" className="sr-only">
              Resultado
            </h2>
            <div ref={resultado} aria-live="polite" className="scroll-mt-28">
              {estado === 'nada' && (
                <div className="max-w-3xl">
                  <h2 className={h2}>O que o diagnóstico mostra</h2>
                  <ul className="mt-4 space-y-2 list-disc pl-5 text-lg text-slate-800 leading-relaxed">
                    <li>Quantos itens sua empresa disputou sem vencer, e em quantos ficou em 2º lugar.</li>
                    <li>Onde perdeu por pouco (até 5% do preço da vencedora), no empate, ou com o melhor preço e mesmo assim não levou.</li>
                    <li>Quanto as vencedoras levaram nesses itens.</li>
                    <li>Os 10 itens em que a empresa chegou mais perto, com o órgão e o link da licitação.</li>
                  </ul>
                </div>
              )}
              {estado === 'buscando' && <p className="text-lg text-slate-800">Procurando a empresa nas atas…</p>}
              {estado === 'invalido' && (
                <p
                  role="alert"
                  data-foco
                  tabIndex={-1}
                  className="max-w-3xl p-4 rounded-xl bg-amber-50 border border-amber-200 text-lg text-amber-900 outline-none"
                >
                  Esse CNPJ não parece certo. Confira os 14 números (estão no cartão do CNPJ da empresa).
                </p>
              )}
              {estado === 'erro' && (
                <p
                  role="alert"
                  data-foco
                  tabIndex={-1}
                  className="max-w-3xl p-4 rounded-xl bg-amber-50 border border-amber-200 text-lg text-amber-900 outline-none"
                >
                  Não consegui abrir os dados agora. Tente de novo em alguns instantes.
                </p>
              )}
              {estado === 'naoachou' && (
                <div data-foco tabIndex={-1} className="max-w-3xl p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 outline-none">
                  <h3 className="text-xl sm:text-2xl font-bold font-display text-[#0F2053]">Não encontramos o CNPJ {cnpjDigitado} entre o 2º e o 5º lugar</h3>
                  <p className="mt-3 text-lg text-slate-800 leading-relaxed">
                    Nas atas lidas (licitações de Minas Gerais dos últimos 12 meses feitas no Portal de Compras Públicas), essa empresa não aparece perdendo um
                    item por pouco. Pode ser que ela tenha vencido tudo o que disputou, que tenha ficado depois do 5º lugar ou que dispute em outros portais
                    (Licitar Digital, Compras.gov.br e outros), que não publicam os lances no PNCP.
                  </p>
                  <p className="mt-3 text-lg text-slate-800 leading-relaxed">Quer uma análise completa, com todos os portais? Fale com a gente.</p>
                  <a
                    href={whatsappLink(`Olá! Fiz o diagnóstico de licitações no site com o CNPJ ${cnpjDigitado} e quero uma análise completa.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-5 ${btnWhatsApp}`}
                  >
                    <WhatsAppIcon className="w-5 h-5" />
                    Pedir a análise completa
                  </a>
                </div>
              )}
              {estado === 'achou' && achado && <Resultado empresa={achado.empresa} licitacoes={achado.licitacoes} info={info} />}
            </div>
          </Container>
        </section>

        <section aria-labelledby="titulo-ajuda" className="py-10 sm:py-14 bg-white">
          <Container>
            <h2 id="titulo-ajuda" className={h2}>
              Como a Ágil CM ajuda a vencer
            </h2>
            <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {COMO_AJUDA.map(([t, d]) => (
                <li key={t} className="p-5 rounded-2xl bg-[#F7FAFD] border border-slate-200">
                  <h3 className="text-lg font-bold text-[#0F2053]">{t}</h3>
                  <p className="mt-1 text-[16px] text-slate-700 leading-relaxed">{d}</p>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <a
                href={rotaServico('assessoria-licitacoes')}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0F2053] text-white font-bold hover:bg-[#13306f]"
              >
                Assessoria em licitações
                <Icon name="arrow" className="w-5 h-5" />
              </a>
              <a
                href={ROUTES.licitacoes}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-2 border-[#0F2053] text-[#0F2053] font-bold hover:bg-[#0F2053] hover:text-white"
              >
                Editais abertos em Minas Gerais
                <Icon name="arrow" className="w-5 h-5" />
              </a>
            </div>
            <p className="mt-8 max-w-3xl text-[15px] text-slate-600 leading-relaxed">
              Fonte: o PNCP só registra a vencedora de cada item; a colocação das outras empresas sai da ata da sessão que o Portal de Compras Públicas anexa no
              PNCP, com todas as propostas e lances. Licitações de outros portais não entram. O valor das vencedoras é o da ata; o homologado pode mudar depois
              de recursos.
              {info?.atualizadoEm ? ` Atualizado em ${new Date(info.atualizadoEm).toLocaleDateString('pt-BR')}.` : ''}
            </p>
          </Container>
        </section>

        <ContactSection defaultService="Assessoria em Licitações" />
      </main>
      <Footer page="servico" />
      <WhatsAppFloatingButton />
    </>
  );
}
