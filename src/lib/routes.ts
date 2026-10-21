// Endereços das páginas do site. Na hospedagem normal: "/" e "/licitacoes/".
// (A visualização de demonstração troca esses caminhos por arquivos locais.)
type Routes = { home: string; licitacoes: string; documentos: string };

const override: Partial<Routes> =
  (typeof window !== 'undefined' && (window as unknown as { __AGIL_ROUTES__?: Partial<Routes> }).__AGIL_ROUTES__) || {};

export const ROUTES: Routes = {
  home: override.home ?? '/',
  licitacoes: override.licitacoes ?? '/licitacoes/',
  documentos: override.documentos ?? '/documentos/',
};
