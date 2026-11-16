// "Onde já atuamos" (/onde-atuamos/): órgãos públicos em que a Ágil CM venceu licitação e o tipo de material fornecido.
// O resumo (src/data/ondeAtuamos.json) é gerado no build por scripts/onde-atuamos.mjs a partir dos termos de
// homologação e adjudicação lidos na área Privado. Não entram valores, quantidades nem preços.
import Header from '../components/Header.tsx';
import Footer from '../components/Footer.tsx';
import ContactSection from '../components/ContactSection.tsx';
import WhatsAppFloatingButton from '../components/WhatsAppFloatingButton.tsx';
import { btnWhatsApp, Container, Icon, WhatsAppIcon } from '../components/ui.tsx';
import { whatsappLink } from '../data/servicesData.ts';
import { nomeCategoria } from '../lib/ondeAtuamos.js';
import { ROUTES, rotaServico } from '../lib/routes.ts';
import dadosJson from '../data/ondeAtuamos.json';

export interface Fornecimento {
  ano: string;
  modalidade: string;
  objeto: string;
  categorias: string[];
}
export interface OrgaoAtendido {
  nome: string;
  tipo: string;
  processos: number;
  anos: string[];
  categorias: string[];
  fornecimentos: Fornecimento[];
}
export interface ResumoAtuacao {
  atualizadoEm: string;
  totais: { processos: number; orgaos: number; municipios: number; desde: string; ate: string };
  categorias: { id: string; nome: string; processos: number }[];
  municipios: { nome: string; uf: string; processos: number; orgaos: OrgaoAtendido[] }[];
}
export const ATUACAO = dadosJson as ResumoAtuacao;

const h2 = 'text-2xl sm:text-3xl font-bold font-display text-[#0F2053] tracking-tight [text-wrap:balance]';
const n = (q: number, um: string, varios: string) => `${q} ${q === 1 ? um : varios}`;
const periodo = (anos: string[]) => (anos.length <= 1 ? anos[0] || '' : `${anos[0]} a ${anos.at(-1)}`);
const ancora = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Frase-resumo, usada no topo da página, na descrição para o Google e no llms.txt */
export function resumoEmFrase(d: ResumoAtuacao = ATUACAO) {
  const t = d.totais;
  const quando = t.desde === t.ate ? `em ${t.desde}` : `de ${t.desde} a ${t.ate}`;
  return `${n(t.processos, 'processo vencido', 'pregões e dispensas vencidos')} em ${n(t.orgaos, 'órgão público', 'órgãos públicos')} de ${n(t.municipios, 'município', 'municípios')}, ${quando}`;
}

function Orgao({ o, id }: { o: OrgaoAtendido; id?: string }) {
  return (
    <li id={id} className="scroll-mt-28 p-5 sm:p-6 rounded-2xl bg-white border border-slate-200">
      <h4 className="text-lg font-bold font-display text-[#0F2053] leading-snug">{o.nome}</h4>
      <p className="mt-1 text-base text-slate-700">
        {n(o.processos, 'processo vencido', 'processos vencidos')} · {periodo(o.anos)}
      </p>
      {o.categorias.length > 0 && (
        <ul aria-label={`Tipos de material fornecidos a ${o.nome}`} className="mt-3 flex flex-wrap gap-2">
          {o.categorias.map((c) => (
            <li key={c} className="px-3 py-1 rounded-full bg-[#EAF4FC] text-[#0F2053] text-sm font-semibold">
              {nomeCategoria(c)}
            </li>
          ))}
        </ul>
      )}
      <details className="group mt-4">
        <summary className="inline-flex items-center gap-1.5 cursor-pointer text-base font-bold text-[#0369B3] hover:text-[#03609F] underline underline-offset-4 list-none [&::-webkit-details-marker]:hidden">
          Ver {o.processos === 1 ? 'o objeto do processo' : `os objetos dos ${o.processos} processos`}
          <Icon name="arrow" className="w-4 h-4 transition-transform group-open:rotate-90" />
        </summary>
        <ul className="mt-3 space-y-2.5 text-base text-slate-700 leading-relaxed">
          {o.fornecimentos.map((f, i) => (
            <li key={i} className="pl-3 border-l-2 border-slate-200">
              <span className="font-semibold text-[#0F2053]">
                {[f.ano, f.modalidade].filter(Boolean).join(' · ')}
                {': '}
              </span>
              {f.objeto}
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

export default function OndeAtuamosPage() {
  const d = ATUACAO;
  const t = d.totais;
  const principais = d.municipios.filter((m) => m.processos > 1);
  const demais = d.municipios.filter((m) => m.processos <= 1);
  const atualizado = d.atualizadoEm ? d.atualizadoEm.split('-').reverse().join('/') : '';
  const ESTADOS: Record<string, string> = { SP: 'em São Paulo', RJ: 'no Rio de Janeiro', ES: 'no Espírito Santo' };
  const outrosEstados = [...new Set(d.municipios.map((m) => m.uf).filter((uf) => uf !== 'MG'))].map((uf) => ESTADOS[uf] || `em ${uf}`).join(' e ');
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
                  Onde já atuamos
                </li>
              </ol>
            </nav>
            <p className="mt-6 text-sm font-bold text-[#9fd3ff]">Fornecimento ao poder público</p>
            <h1 className="mt-2 max-w-4xl text-3xl sm:text-5xl font-bold font-display tracking-tight leading-tight [text-wrap:balance]">
              Onde a Ágil CM já forneceu
            </h1>
            <p className="mt-5 max-w-3xl text-lg sm:text-xl text-white/90 leading-relaxed">
              {resumoEmFrase(d)}. Prefeituras, câmaras municipais e autarquias que compraram da Ágil CM por pregão ou dispensa, com o que foi fornecido a cada
              uma.
            </p>
            <ul className="mt-8 grid grid-cols-3 gap-3 max-w-2xl">
              {[
                [t.processos, 'pregões e dispensas vencidos'],
                [t.orgaos, 'órgãos públicos'],
                [t.municipios, 'municípios'],
              ].map(([valor, rotulo]) => (
                <li key={rotulo} className="p-4 rounded-2xl bg-white/10 border border-white/15">
                  <strong className="block text-3xl sm:text-4xl font-bold font-display">{valor}</strong>
                  <span className="mt-1 block text-sm sm:text-base text-white/90">{rotulo}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a
                href={whatsappLink('Olá! Sou de um órgão público e quero uma cotação da Ágil CM.')}
                target="_blank"
                rel="noopener noreferrer"
                className={btnWhatsApp}
              >
                <WhatsAppIcon className="w-5 h-5" />
                Pedir cotação pelo WhatsApp
              </a>
              <a
                href={rotaServico('suprimentos')}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-bold text-[#0F2053] bg-white hover:bg-slate-100 rounded-xl transition-colors"
              >
                Ver o que fornecemos
                <Icon name="arrow" className="w-5 h-5" />
              </a>
            </div>
          </Container>
        </section>

        <section aria-labelledby="titulo-tipos" className="py-10 sm:py-14 bg-white">
          <Container>
            <h2 id="titulo-tipos" className={h2}>
              O que já fornecemos
            </h2>
            <p className="mt-3 max-w-3xl text-lg text-slate-700 leading-relaxed">
              Tipos de material entregues nesses processos. O número ao lado é a quantidade de processos em que cada tipo apareceu.
            </p>
            <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...d.categorias]
                .sort((a, b) => b.processos - a.processos)
                .map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-[#F7FAFD] border border-slate-200">
                    <span className="text-lg font-semibold text-[#0F2053]">{c.nome}</span>
                    <span className="shrink-0 px-3 py-1 rounded-full bg-[#0F2053] text-white text-sm font-bold">
                      {c.processos}
                      <span className="sr-only"> {c.processos === 1 ? 'processo' : 'processos'}</span>
                    </span>
                  </li>
                ))}
            </ul>
          </Container>
        </section>

        <section aria-labelledby="titulo-municipios" className="py-10 sm:py-14 bg-[#F4F7FB]">
          <Container>
            <h2 id="titulo-municipios" className={h2}>
              Municípios e órgãos atendidos
            </h2>
            <p className="mt-3 max-w-3xl text-lg text-slate-700 leading-relaxed">
              A sede fica em Astolfo Dutra, na Zona da Mata mineira, e a maior parte das entregas é na região. Também há entregas em outras regiões de Minas
              Gerais{outrosEstados && ` e ${outrosEstados}`}.
            </p>
            <nav aria-label="Municípios atendidos" className="mt-5">
              <ul className="flex flex-wrap gap-2">
                {d.municipios.map((m) => (
                  <li key={m.nome}>
                    <a
                      href={`#${ancora(m.nome)}`}
                      className="inline-block px-3.5 py-1.5 rounded-full bg-white border border-slate-300 text-[15px] font-semibold text-[#0F2053] hover:border-[#0478CA]"
                    >
                      {m.nome}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-8 space-y-10">
              {principais.map((m) => (
                <section key={m.nome} aria-labelledby={ancora(m.nome)}>
                  <h3 id={ancora(m.nome)} className="scroll-mt-28 text-xl sm:text-2xl font-bold font-display text-[#0F2053]">
                    {m.nome} - {m.uf}
                    <span className="ml-2 text-base font-semibold text-slate-600">{n(m.processos, 'processo', 'processos')}</span>
                  </h3>
                  <ul className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                    {m.orgaos.map((o) => (
                      <Orgao key={o.nome} o={o} />
                    ))}
                  </ul>
                </section>
              ))}
              {demais.length > 0 && (
                <section aria-labelledby="titulo-demais">
                  <h3 id="titulo-demais" className="text-xl sm:text-2xl font-bold font-display text-[#0F2053]">
                    Outros municípios
                  </h3>
                  <ul className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                    {demais.map((m) =>
                      m.orgaos.map((o, i) => <Orgao key={o.nome} id={i === 0 ? ancora(m.nome) : undefined} o={{ ...o, nome: `${o.nome} - ${m.uf}` }} />),
                    )}
                  </ul>
                </section>
              )}
            </div>
            <p className="mt-8 max-w-3xl text-[15px] text-slate-600 leading-relaxed">
              Fonte: termos de homologação e de adjudicação publicados pelos próprios órgãos. Os tipos de material vêm dos itens em que a Ágil CM foi a
              vencedora. Esta página não mostra valores.{atualizado && ` Atualizada em ${atualizado}.`}
            </p>
          </Container>
        </section>

        <section aria-labelledby="titulo-orgao" className="py-10 sm:py-14 bg-white">
          <Container>
            <div className="p-6 sm:p-8 rounded-3xl bg-[#0F2053] text-white max-w-4xl">
              <h2 id="titulo-orgao" className="text-2xl font-bold font-display">
                É de um órgão público e precisa de cotação?
              </h2>
              <p className="mt-2 text-lg text-white/90 leading-relaxed">
                A Ágil CM vende para prefeituras e órgãos públicos, com documentação pronta para licitações e contratações diretas.
              </p>
              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <a
                  href={rotaServico('suprimentos')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-[#0F2053] font-bold hover:bg-slate-100"
                >
                  Fornecimento de suprimentos
                  <Icon name="arrow" className="w-5 h-5" />
                </a>
                <a
                  href={ROUTES.licitacoes}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-2 border-white/70 text-white font-bold hover:bg-white hover:text-[#0F2053]"
                >
                  Editais abertos em Minas Gerais
                  <Icon name="arrow" className="w-5 h-5" />
                </a>
              </div>
            </div>
          </Container>
        </section>

        <ContactSection defaultService="Fornecimento de Suprimentos" />
      </main>
      <Footer page="servico" />
      <WhatsAppFloatingButton />
    </>
  );
}
