// Página própria de um serviço (/terceirizacao/, /gilrat/…). O conteúdo vem de src/data/paginasServico.ts e o HTML é
// pré-renderizado no build, para o Google ler cada serviço numa página só dele.
import Header from '../components/Header.tsx';
import Footer from '../components/Footer.tsx';
import ContactSection from '../components/ContactSection.tsx';
import WhatsAppFloatingButton from '../components/WhatsAppFloatingButton.tsx';
import { btnWhatsApp, Container, Icon, WhatsAppIcon } from '../components/ui.tsx';
import { whatsappLink } from '../data/servicesData.ts';
import { paginaServico, type Bloco, type Link, type PaginaServico } from '../data/paginasServico.ts';
import { ROUTES, rotaServico } from '../lib/routes.ts';

const resolver = (href: Link) =>
  href.startsWith('servico:')
    ? rotaServico(href.slice(8))
    : href.startsWith('rota:')
      ? ROUTES[href.slice(5) as 'licitacoes']
      : href.startsWith('home:')
        ? ROUTES.home + href.slice(5)
        : href;

const h2 = 'text-2xl sm:text-3xl font-bold font-display text-[#0F2053] tracking-tight [text-wrap:balance]';
const colunas = (n: number) => (n === 2 ? 'sm:grid-cols-2' : n === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3');

function BlocoView({ bloco, id }: { bloco: Bloco; id: string }) {
  if (bloco.tipo === 'texto')
    return (
      <>
        <h2 id={id} className={h2}>
          {bloco.titulo}
        </h2>
        <div className="mt-4 max-w-3xl space-y-4 text-lg text-slate-700 leading-relaxed">
          {bloco.paragrafos.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </>
    );

  if (bloco.tipo === 'cards')
    return (
      <>
        <h2 id={id} className={h2}>
          {bloco.titulo}
        </h2>
        {bloco.intro && <p className="mt-3 max-w-3xl text-lg text-slate-700 leading-relaxed">{bloco.intro}</p>}
        <ul className={`mt-6 grid grid-cols-1 ${colunas(bloco.itens.length)} gap-4`}>
          {bloco.itens.map((it) => (
            <li key={it.titulo} className="flex flex-col p-6 rounded-2xl bg-white border border-slate-200">
              <h3 className="text-lg font-bold font-display text-[#0F2053] leading-snug">{it.titulo}</h3>
              {it.texto && <p className="mt-2 text-base text-slate-700 leading-relaxed">{it.texto}</p>}
              {it.href && (
                <a
                  href={resolver(it.href)}
                  className="mt-auto pt-4 inline-flex items-center gap-1.5 text-base font-bold text-[#0369B3] hover:text-[#03609F] underline underline-offset-4"
                >
                  Saiba mais<span className="sr-only"> sobre {it.titulo}</span>
                  <Icon name="arrow" className="w-4 h-4" />
                </a>
              )}
            </li>
          ))}
        </ul>
      </>
    );

  if (bloco.tipo === 'lista')
    return (
      <>
        <h2 id={id} className={h2}>
          {bloco.titulo}
        </h2>
        {bloco.intro && <p className="mt-3 max-w-3xl text-lg text-slate-700 leading-relaxed">{bloco.intro}</p>}
        <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 max-w-4xl">
          {bloco.itens.map((it) => {
            const texto = typeof it === 'string' ? it : it.texto;
            return (
              <li key={texto} className="flex items-start gap-2.5 text-lg text-slate-800">
                <Icon name="check" className="w-5 h-5 mt-1 text-[#0369B3] shrink-0" />
                {typeof it === 'string' ? (
                  it
                ) : (
                  <a href={resolver(it.href)} className="font-semibold text-[#0369B3] hover:text-[#03609F] underline underline-offset-4">
                    {it.texto}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </>
    );

  if (bloco.tipo === 'passos')
    return (
      <>
        <h2 id={id} className={h2}>
          {bloco.titulo}
        </h2>
        <ol className={`mt-6 grid grid-cols-1 ${colunas(bloco.itens.length === 6 ? 3 : bloco.itens.length)} gap-4`}>
          {bloco.itens.map((it, i) => (
            <li key={it.titulo} className="p-6 rounded-2xl bg-white border border-slate-200">
              <span className="flex items-center gap-3">
                <span className="w-10 h-10 shrink-0 rounded-xl bg-[#0F2053] text-white font-bold text-lg flex items-center justify-center font-display">
                  {i + 1}
                </span>
                <h3 className="text-lg font-bold font-display text-[#0F2053] leading-snug">{it.titulo}</h3>
              </span>
              {it.texto && <p className="mt-3 text-base text-slate-700 leading-relaxed">{it.texto}</p>}
            </li>
          ))}
        </ol>
      </>
    );

  return (
    <div className="p-6 sm:p-8 rounded-3xl bg-[#0F2053] text-white max-w-4xl">
      <h2 id={id} className="text-2xl font-bold font-display">
        {bloco.titulo}
      </h2>
      <p className="mt-2 text-lg text-white/90 leading-relaxed">{bloco.texto}</p>
      {bloco.link && (
        <a
          href={resolver(bloco.link.href)}
          className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-[#0F2053] font-bold hover:bg-slate-100"
        >
          {bloco.link.rotulo}
          <Icon name="arrow" className="w-5 h-5" />
        </a>
      )}
    </div>
  );
}

export default function ServicoPage({ pagina }: { pagina: PaginaServico }) {
  const relacionados = pagina.relacionados.map(paginaServico).filter((p): p is PaginaServico => !!p);
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
                  {pagina.nav}
                </li>
              </ol>
            </nav>
            <p className="mt-6 text-sm font-bold text-[#9fd3ff]">{pagina.eyebrow}</p>
            <h1 className="mt-2 max-w-4xl text-3xl sm:text-5xl font-bold font-display tracking-tight [text-wrap:balance]">{pagina.h1}</h1>
            <p className="mt-4 text-lg sm:text-xl text-white/90 max-w-3xl leading-relaxed">{pagina.lead}</p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <a href={whatsappLink(pagina.whatsapp)} target="_blank" rel="noopener noreferrer" className={btnWhatsApp}>
                <WhatsAppIcon className="w-5 h-5" />
                Falar no WhatsApp
              </a>
              <a
                href={pagina.acao ? resolver(pagina.acao.href) : '#contato'}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-bold text-[#0F2053] bg-white hover:bg-slate-100 rounded-xl transition-colors"
              >
                {pagina.acao ? pagina.acao.rotulo : 'Pedir contato da equipe'}
                <Icon name="arrow" className="w-5 h-5" />
              </a>
            </div>
          </Container>
        </section>

        {pagina.blocos.map((b, i) => (
          <section key={b.titulo} aria-labelledby={`bloco-${i}`} className={`py-10 sm:py-14 ${i % 2 ? 'bg-[#F4F7FB]' : 'bg-white'}`}>
            <Container>
              <BlocoView bloco={b} id={`bloco-${i}`} />
            </Container>
          </section>
        ))}

        <section aria-labelledby="titulo-duvidas" className={`py-10 sm:py-14 ${pagina.blocos.length % 2 ? 'bg-[#F4F7FB]' : 'bg-white'}`}>
          <Container className="max-w-4xl">
            <h2 id="titulo-duvidas" className={h2}>
              Perguntas frequentes
            </h2>
            <div className="mt-6 space-y-3">
              {pagina.faq.map((item) => (
                <details key={item.q} className="group rounded-2xl border border-slate-200 bg-white open:border-[#0478CA]/40">
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none p-5 text-[#0F2053] [&::-webkit-details-marker]:hidden">
                    <h3 className="text-lg font-semibold">{item.q}</h3>
                    <svg
                      className="w-6 h-6 shrink-0 text-[#0369B3] transition-transform group-open:rotate-45"
                      aria-hidden="true"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m-7-7h14" />
                    </svg>
                  </summary>
                  <p className="px-5 pb-5 -mt-1 text-base text-slate-700 leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </Container>
        </section>

        {relacionados.length > 0 && (
          <nav aria-labelledby="titulo-relacionados" className="py-10 sm:py-14 bg-white border-t border-slate-200">
            <Container>
              <h2 id="titulo-relacionados" className={h2}>
                Veja também
              </h2>
              <ul className={`mt-6 grid grid-cols-1 ${colunas(relacionados.length)} gap-4`}>
                {relacionados.map((r) => (
                  <li key={r.slug}>
                    <a
                      href={rotaServico(r.slug)}
                      className="flex flex-col h-full p-6 rounded-2xl bg-[#F7FAFD] border border-slate-200 hover:border-[#0478CA] transition-colors"
                    >
                      <span className="text-lg font-bold font-display text-[#0F2053]">{r.nav}</span>
                      <span className="mt-1 text-base text-slate-700 leading-relaxed">{r.description}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Container>
          </nav>
        )}

        <ContactSection defaultService={pagina.contato} />
      </main>
      <Footer page="servico" />
      <WhatsAppFloatingButton />
    </>
  );
}
