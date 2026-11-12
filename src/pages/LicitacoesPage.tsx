import { useEffect, useState } from 'react';
import Header from '../components/Header.tsx';
import Footer from '../components/Footer.tsx';
import WhatsAppFloatingButton from '../components/WhatsAppFloatingButton.tsx';
import { Container, Icon } from '../components/ui.tsx';
import { ROUTES, rotaServico } from '../lib/routes.ts';
import EditaisTab from './EditaisTab.tsx';
import ContratosTab from './ContratosTab.tsx';
import MeusEditaisTab from './MeusEditaisTab.tsx';
import RaioXTab from './RaioXTab.tsx';
import { useMeusEditais } from '../lib/meusEditais.ts';

type Aba = 'editais' | 'contratos' | 'agil' | 'raiox' | 'meus';

const ABAS: { id: Aba; label: string; desc: string; icon: string }[] = [
  { id: 'editais', label: 'Editais abertos', desc: 'Licitações recebendo propostas agora', icon: 'doc' },
  { id: 'contratos', label: 'CONTRATOS', desc: 'Quem comprou, o quê e por quanto', icon: 'receipt' },
  { id: 'agil', label: 'AGIL CNAE', desc: 'Editais abertos ligados aos CNAEs da Ágil CM', icon: 'building' },
  { id: 'raiox', label: 'RAIO-X', desc: 'Analise qualquer edital pelo link do PNCP', icon: 'doc' },
  { id: 'meus', label: 'MEUS EDITAIS', desc: 'Salvos, etapas e prazos na agenda', icon: 'star' },
];

// Texto fixo abaixo do painel: explica cada aba e de onde vêm os dados (também é o que o Google lê da página)
const COMO_USAR = [
  {
    titulo: 'Editais abertos',
    texto: 'Licitações de Minas Gerais que estão recebendo propostas agora. Filtre por palavra, cidade, valor e distância até a cidade do edital, e ordene do jeito que preferir.',
  },
  {
    titulo: 'Contratos',
    texto: 'O histórico de compras das prefeituras: o órgão que comprou, o produto ou serviço, a quantidade, o fornecedor vencedor e o valor do contrato.',
  },
  {
    titulo: 'Raio-X',
    texto: 'Cole o link ou o número de controle de um edital do PNCP para ver o órgão, o prazo das propostas, o valor estimado, os itens e os documentos.',
  },
  {
    titulo: 'Meus editais',
    texto: 'Salve os editais que interessam, anote documentos e dúvidas e acompanhe as etapas e os prazos de cada um.',
  },
];

const HASH_ABA: Record<string, Aba> = { '#contratos': 'contratos', '#agil-cnae': 'agil', '#raio-x': 'raiox', '#meus-editais': 'meus' };
const ABA_HASH: Record<Aba, string> = { editais: '', contratos: '#contratos', agil: '#agil-cnae', raiox: '#raio-x', meus: '#meus-editais' };

export default function LicitacoesPage() {
  const [aba, setAba] = useState<Aba>('editais');
  const salvos = Object.keys(useMeusEditais()).length;

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
              href={rotaServico('assessoria-licitacoes')}
              className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-[#0F2053] font-bold hover:bg-slate-100"
            >
              Como a Ágil CM ajuda sua empresa a vencer
              <Icon name="arrow" className="w-5 h-5" />
            </a>

            {/* Abas */}
            <div role="tablist" aria-label="O que você quer ver" className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
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
                    {t.id === 'meus' && salvos > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-[#F5A623] text-[#0F2053] text-xs font-extrabold tabular-nums">{salvos}</span>
                    )}
                  </span>
                  <span className={`hidden sm:block mt-0.5 text-sm ${aba === t.id ? 'text-slate-600' : 'text-white/75'}`}>{t.desc}</span>
                </button>
              ))}
            </div>
          </Container>
        </section>

        <div id="painel" role="tabpanel" aria-labelledby={`aba-${aba}`}>
          {aba === 'contratos' ? (
            <ContratosTab />
          ) : aba === 'meus' ? (
            <MeusEditaisTab />
          ) : aba === 'raiox' ? (
            <RaioXTab />
          ) : (
            <EditaisTab key={aba} agil={aba === 'agil'} />
          )}
        </div>

        <section aria-labelledby="titulo-como-usar" className="py-12 sm:py-16 bg-white border-t border-slate-200">
          <Container>
            <h2 id="titulo-como-usar" className="text-2xl sm:text-3xl font-bold font-display text-[#0F2053] tracking-tight">
              Como usar o painel de licitações
            </h2>
            <p className="mt-3 max-w-3xl text-lg text-slate-700 leading-relaxed">
              O painel é gratuito e reúne, numa tela só, os editais abertos e o histórico de contratos das prefeituras de Minas Gerais, com foco na Zona
              da Mata. Os dados são oficiais: vêm do Portal Nacional de Contratações Públicas (PNCP) e são consultados na hora em que você abre a página.
            </p>
            <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {COMO_USAR.map((c) => (
                <li key={c.titulo} className="p-6 rounded-2xl bg-[#F7FAFD] border border-slate-200">
                  <h3 className="text-lg font-bold font-display text-[#0F2053]">{c.titulo}</h3>
                  <p className="mt-2 text-base text-slate-700 leading-relaxed">{c.texto}</p>
                </li>
              ))}
            </ul>
            <div className="mt-8 p-6 sm:p-8 rounded-3xl bg-[#0F2053] text-white max-w-4xl">
              <h2 className="text-2xl font-bold font-display">Quer ajuda para disputar e vencer?</h2>
              <p className="mt-2 text-lg text-white/90 leading-relaxed">
                A Ágil CM também vende para o poder público. Na assessoria em licitações, monitoramos os editais, preparamos a habilitação, montamos a
                proposta e operamos o pregão eletrônico até o empenho.
              </p>
              <a
                href={rotaServico('assessoria-licitacoes')}
                className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-[#0F2053] font-bold hover:bg-slate-100"
              >
                Conhecer a assessoria em licitações
                <Icon name="arrow" className="w-5 h-5" />
              </a>
            </div>
          </Container>
        </section>
      </main>
      <Footer page="licitacoes" />
      <WhatsAppFloatingButton />
    </>
  );
}
