// Atividades dos simuladores de /dados/: anexo do Simples Nacional, presunções do Lucro Presumido
// (IRPJ e CSLL, em % da receita) e o imposto local (ISS para serviços, ICMS para comércio e indústria).
export const ATIVIDADES = [
  { id: 'comercio', nome: 'Comércio (revenda de mercadorias)', anexo: 'I', presIrpj: 0.08, presCsll: 0.12, local: 'ICMS', localPadrao: 0.03 },
  { id: 'industria', nome: 'Indústria (fabricação)', anexo: 'II', presIrpj: 0.08, presCsll: 0.12, local: 'ICMS', localPadrao: 0.03 },
  {
    id: 'servicos-iii',
    nome: 'Serviços do Anexo III (manutenção e reparos, instalações, academias, agências de viagem, contabilidade…)',
    anexo: 'III',
    presIrpj: 0.32,
    presCsll: 0.32,
    local: 'ISS',
    localPadrao: 0.03,
  },
  {
    id: 'servicos-iv',
    nome: 'Serviços do Anexo IV (limpeza, conservação, vigilância, construção civil, advocacia)',
    anexo: 'IV',
    presIrpj: 0.32,
    presCsll: 0.32,
    local: 'ISS',
    localPadrao: 0.03,
  },
  {
    id: 'servicos-fator-r',
    nome: 'Serviços com Fator R (TI, engenharia, arquitetura, consultoria, medicina, odontologia, publicidade…)',
    anexo: 'V',
    fatorR: true,
    presIrpj: 0.32,
    presCsll: 0.32,
    local: 'ISS',
    localPadrao: 0.03,
  },
  { id: 'transporte-cargas', nome: 'Transporte de cargas', anexo: 'III', presIrpj: 0.08, presCsll: 0.12, local: 'ICMS', localPadrao: 0.03 },
];

export const atividade = (id) => ATIVIDADES.find((a) => a.id === id) || ATIVIDADES[0];
