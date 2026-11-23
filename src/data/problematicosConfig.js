// Consulta CNPJ → "CNPJ problemático" (só da equipe): de quais cidades são as empresas procuradas.
// O nome como está no cadastro da Receita (sem acento, maiúsculo) é achado sozinho na tabela de municípios da Receita;
// para incluir outra cidade, acrescente aqui.
export const CIDADES_PROBLEMATICOS = [
  { nome: 'Cataguases', uf: 'MG' },
  { nome: 'Dona Euzébia', uf: 'MG' },
  { nome: 'Leopoldina', uf: 'MG' },
  { nome: 'Astolfo Dutra', uf: 'MG' },
  { nome: 'Recreio', uf: 'MG' },
  { nome: 'Ubá', uf: 'MG' },
  { nome: 'Miraí', uf: 'MG' },
  { nome: 'Santana de Cataguases', uf: 'MG' },
];

/** Exclusões do Simples e do MEI entram se forem do ano da base da Receita ou de até tantos anos antes */
export const ANOS_EXCLUSAO_ANTES = 1;
