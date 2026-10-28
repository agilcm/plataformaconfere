import { useEffect, useState } from 'react';
import Header from '../components/Header.tsx';
import Footer from '../components/Footer.tsx';
import WhatsAppFloatingButton from '../components/WhatsAppFloatingButton.tsx';
import { Container, Icon } from '../components/ui.tsx';
import { ROUTES } from '../lib/routes.ts';
import EditaisTab from './EditaisTab.tsx';
import ContratosTab from './ContratosTab.tsx';

type Aba = 'editais' | 'contratos' | 'agil';

const ABAS: { id: Aba; label: string; desc: string; icon: string }[] = [
  { id: 'editais', label: 'Editais abertos', desc: 'Licitações recebendo propostas agora', icon: 'doc' },
  { id: 'contratos', label: 'CONTRATOS', desc: 'Quem comprou, o quê e por quanto', icon: 'receipt' },
  { id: 'agil', label: 'AGIL CNAE', desc: 'Editais abertos ligados aos CNAEs da Ágil CM', icon: 'building' },
];

const HASH_ABA: Record<string, Aba> = { '#contratos': 'contratos', '#agil-cnae': 'agil' };
const ABA_HASH: Record<Aba, string> = { editais: '', contratos: '#contratos', agil: '#agil-cnae' };

export default function LicitacoesPage() {
  const [aba, setAba] = useState<Aba>('editais');

  // Permite abrir direto em /licitacoes/#contratos ou /licitacoes/#agil-cnae
  useEffect(() => {
    const fromHash = () => setAba(HASH_ABA[window.location.hash] ?? 'editais');
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);

  const trocar = (a: Aba) => {
    setAba(a);
    try {
      history.replaceState(null, '', ABA_HASH[a] || window.location.pathname);
    } catch {
      /* sem histórico disponível */
    }
  };

  return (
    <>
      <a
        href="#painel"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2 focus:bg-[#0478CA] focus:text-white focus:rounded-lg"
      >
        Pular para o conteúdo
      </a>
      <Header page="licitacoes" />
      <main id="conteudo">
        <section className="relative bg-gradient-to-br from-[#0F2053] via-[#13306f] to-[#0A1640] text-white overflow-hidden">
          <div aria-hidden="true" className="absolute -top-32 -right-20 w-[30rem] h-[30rem] rounded-full bg-[#0478CA]/30 blur-3xl" />
          <Container className="relative pt-12 sm:pt-16 pb-0">
            <nav aria-label="Você está em" className="text-sm text-white/70">
              <ol className="flex items-center gap-2">
                <li>
                  <a href={ROUTES.home} className="hover:text-white underline-offset-2 hover:underline">
                    Início
                  </a>
                </li>
                <li aria-hidden="true">›</li>
                <li aria-current="page" className="text-white">
                  Licitações
                </li>
              </ol>
            </nav>
            <h1 className="mt-4 text-3xl sm:text-5xl font-bold font-display tracking-tight [text-wrap:balance]">
              Licitações e contratos públicos em Minas Gerais
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-white/85 max-w-2xl leading-relaxed">
              Dados oficiais do Portal Nacional de Contratações Públicas (PNCP): editais abertos e o histórico de compras das
              prefeituras, com foco na Zona da Mata.
            </p>
            <a
              href={`${ROUTES.home}#licitacoes`}
              className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-[#0F2053] font-bold hover:bg-slate-100"
            >
              Como a Ágil CM ajuda sua empresa a vencer
              <Icon name="arrow" className="w-5 h-5" />
            </a>

            {/* Abas */}
            <div role="tablist" aria-label="O que você quer ver" className="mt-10 grid grid-cols-3 gap-2 sm:gap-3 max-w-4xl">
              {ABAS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`aba-${t.id}`}
                  aria-selected={aba === t.id}
                  aria-controls="painel"
                  onClick={() => trocar(t.id)}
                  className={`text-left px-3 sm:px-5 py-3.5 rounded-t-2xl transition-colors cursor-pointer ${
                    aba === t.id ? 'bg-[#F4F7FB] text-[#0F2053]' : 'bg-white/10 text-white hover:bg-white/15'
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm sm:text-lg font-extrabold tracking-wide">
                    <Icon name={t.icon} className="hidden sm:block w-5 h-5 shrink-0" />
                    {t.label}
                  </span>
                  <span className={`hidden sm:block mt-0.5 text-sm ${aba === t.id ? 'text-slate-600' : 'text-white/75'}`}>{t.desc}</span>
                </button>
              ))}
            </div>
          </Container>
        </section>

        <div id="painel" role="tabpanel" aria-labelledby={`aba-${aba}`}>
          {aba === 'contratos' ? <ContratosTab /> : <EditaisTab key={aba} agil={aba === 'agil'} />}
        </div>
      </main>
      <Footer page="licitacoes" />
      <WhatsAppFloatingButton />
    </>
  );
}
