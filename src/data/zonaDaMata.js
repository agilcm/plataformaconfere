// Municípios da mesorregião Zona da Mata (IBGE), agrupados por microrregião.
// Usado para o filtro "Zona da Mata" da página de licitações.
export const MICRORREGIOES = {
  'Juiz de Fora': [
    'Aracitaba', 'Belmiro Braga', 'Bias Fortes', 'Bicas', 'Chácara', 'Chiador', 'Coronel Pacheco', 'Descoberto',
    'Ewbank da Câmara', 'Goianá', 'Guarará', 'Juiz de Fora', 'Lima Duarte', 'Mar de Espanha', 'Maripá de Minas',
    'Matias Barbosa', 'Olaria', 'Oliveira Fortes', 'Paiva', 'Pedro Teixeira', 'Pequeri', 'Piau', 'Rio Novo', 'Rio Preto',
    'Rochedo de Minas', 'Santa Bárbara do Monte Verde', 'Santa Rita do Ibitipoca', 'Santa Rita do Jacutinga',
    'Santana do Deserto', 'Santos Dumont', 'São João Nepomuceno', 'Senador Cortes', 'Simão Pereira',
  ],
  Cataguases: [
    'Além Paraíba', 'Argirita', 'Cataguases', 'Dona Euzébia', "Estrela-d'Alva", 'Itamarati de Minas', 'Laranjal',
    'Leopoldina', 'Palma', 'Pirapetinga', 'Recreio', 'Santana de Cataguases', 'Santo Antônio do Aventureiro', 'Volta Grande',
  ],
  Ubá: [
    'Astolfo Dutra', 'Divinésia', 'Dores do Turvo', 'Guarani', 'Guidoval', 'Guiricema', 'Mercês', 'Piraúba', 'Rio Pomba',
    'Rodeiro', 'São Geraldo', 'Senador Firmino', 'Silverânia', 'Tabuleiro', 'Tocantins', 'Ubá', 'Visconde do Rio Branco',
  ],
  Muriaé: [
    'Antônio Prado de Minas', 'Barão do Monte Alto', 'Caiana', 'Carangola', 'Divino', 'Espera Feliz', 'Eugenópolis',
    'Faria Lemos', 'Fervedouro', 'Miradouro', 'Miraí', 'Muriaé', 'Orizânia', 'Patrocínio do Muriaé', 'Pedra Dourada',
    'Rosário da Limeira', 'São Francisco do Glória', 'São Sebastião da Vargem Alegre', 'Tombos', 'Vieiras',
  ],
  Viçosa: [
    'Alto Rio Doce', 'Amparo da Serra', 'Araponga', 'Brás Pires', 'Cajuri', 'Canaã', 'Cipotânea', 'Coimbra', 'Ervália',
    'Lamim', 'Paula Cândido', 'Pedra do Anta', 'Piranga', 'Porto Firme', 'Presidente Bernardes', 'Rio Espera',
    'São Miguel do Anta', 'Senhora de Oliveira', 'Teixeiras', 'Viçosa',
  ],
  Manhuaçu: [
    'Abre Campo', 'Alto Caparaó', 'Alto Jequitibá', 'Caparaó', 'Caputira', 'Chalé', 'Durandé', 'Lajinha', 'Luisburgo',
    'Manhuaçu', 'Manhumirim', 'Martins Soares', 'Matipó', 'Pedra Bonita', 'Reduto', 'Santa Margarida',
    'Santana do Manhuaçu', 'São João do Manhuaçu', 'São José do Mantimento', 'Simonésia',
  ],
  'Ponte Nova': [
    'Acaiaca', 'Barra Longa', 'Dom Silvério', 'Guaraciaba', 'Jequeri', 'Oratórios', 'Piedade de Ponte Nova', 'Ponte Nova',
    'Raul Soares', 'Rio Casca', 'Rio Doce', 'Santa Cruz do Escalvado', 'Santo Antônio do Grama', 'São Pedro dos Ferros',
    'Sem-Peixe', 'Sericita', 'Urucânia', 'Vermelho Novo',
  ],
};

// Compara nomes ignorando acentos, hífens, apóstrofos e espaços ("Estrela-d'Alva" = "Estrela Dalva")
export const normalizeName = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();

const INDEX = new Map();
for (const [micro, cidades] of Object.entries(MICRORREGIOES)) {
  for (const c of cidades) INDEX.set(normalizeName(c), micro);
}

/** Microrregião da Zona da Mata do município, ou null se não pertencer */
export const microrregiaoDe = (municipio) => INDEX.get(normalizeName(municipio)) ?? null;

export const TOTAL_MUNICIPIOS_ZM = INDEX.size;
