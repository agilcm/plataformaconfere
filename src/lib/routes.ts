// Endereços das páginas do site. Na hospedagem normal: "/" e "/licitacoes/".
// (A visualização de demonstração troca esses caminhos por arquivos locais.)
type Routes = { home: string; licitacoes: string; privado: string; docpref: string; ondeAtuamos: string; diagnostico: string; consultaCnpj: string };

const override: Partial<Routes> = (typeof window !== 'undefined' && (window as unknown as { __AGIL_ROUTES__?: Partial<Routes> }).__AGIL_ROUTES__) || {};

/** Página própria de um serviço: /terceirizacao/, /gilrat/… (src/data/paginasServico.ts) */
export const rotaServico = (slug: string) => `${import.meta.env.BASE_URL}${slug}/`;

export const ROUTES: Routes = {
  home: override.home ?? import.meta.env.BASE_URL,
  licitacoes: override.licitacoes ?? `${import.meta.env.BASE_URL}licitacoes/`,
  privado: override.privado ?? `${import.meta.env.BASE_URL}privado/`,
  docpref: override.docpref ?? `${import.meta.env.BASE_URL}docpref/`,
  ondeAtuamos: override.ondeAtuamos ?? `${import.meta.env.BASE_URL}onde-atuamos/`,
  diagnostico: override.diagnostico ?? `${import.meta.env.BASE_URL}diagnostico-licitacoes/`,
  consultaCnpj: override.consultaCnpj ?? `${import.meta.env.BASE_URL}consulta-cnpj/`,
};
