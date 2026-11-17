import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analisar, blocosDiagnostico, distancia, ficouPerto, leituras, mensagemContato } from '../src/lib/diagnostico.js';

const licitacoes = [
  {
    id: '1/2026/1',
    orgao: 'Prefeitura de Ubá',
    municipio: 'Ubá',
    uf: 'MG',
    titulo: 'Edital 1/2026',
    objeto: 'Merenda',
    modalidade: 'Pregão',
    data: '2026-03-10',
  },
  {
    id: '2/2026/2',
    orgao: 'Câmara de Leopoldina',
    municipio: 'Leopoldina',
    uf: 'MG',
    titulo: 'Edital 2/2026',
    objeto: 'Obras',
    modalidade: 'Pregão',
    data: '2026-05-20',
  },
];
const d = (o) => ({ lic: 0, item: '0001', desc: 'Arroz 5 kg', col: 2, melhor: 10.2, venc: 10, lances: 3, participantes: 5, ...o });
const empresa = {
  cnpj: '11111111000111',
  razao: 'BETA COMERCIO LTDA',
  fantasia: 'BETA',
  cidade: 'Cataguases',
  uf: 'MG',
  vitorias: 2,
  disputas: [
    d({ item: '0001', col: 2, melhor: 10.2, venc: 10, vt: 5000 }), // 2% acima: perto
    d({ item: '0002', col: 0, melhor: 9, venc: 10, vt: 3000 }), // melhor preço e não levou
    d({ item: '0003', col: 4, melhor: 15, venc: 10, lances: 1 }), // 50% acima
    d({ lic: 1, item: '0001', col: 3, melhor: 18, venc: 20, lances: 1, desconto: true, vt: 100000 }), // 2 p.p. de desconto a menos
    d({ lic: 1, item: '0002', col: 5, melhor: 30, venc: 20, lances: 1 }),
  ],
};

test('distância para a vencedora: % no preço, pontos no desconto; perto = até 5% ou 2 pontos', () => {
  assert.equal(Math.round(distancia(empresa.disputas[0]).valor * 10) / 10, 2);
  assert.match(distancia(empresa.disputas[0]).texto, /^\+2%$/);
  assert.equal(distancia(empresa.disputas[3]).valor, 2);
  assert.match(distancia(empresa.disputas[3]).texto, /2 p\.p\. de desconto a menos/);
  assert.deepEqual(empresa.disputas.map(ficouPerto), [true, false, false, true, false]);
});

test('análise: contagens, órgãos, só proposta e valor que ficou na mesa', () => {
  const a = analisar(empresa, licitacoes);
  assert.deepEqual(
    {
      itens: a.itens,
      licitacoes: a.licitacoes,
      segundo: a.segundo,
      terceiroAoQuinto: a.terceiroAoQuinto,
      naoLevou: a.naoLevou,
      perto: a.perto,
      soProposta: a.soProposta,
      vitorias: a.vitorias,
      valorNaMesa: a.valorNaMesa,
    },
    { itens: 5, licitacoes: 2, segundo: 1, terceiroAoQuinto: 3, naoLevou: 1, perto: 2, soProposta: 3, vitorias: 2, valorNaMesa: 108000 },
  );
  assert.deepEqual(
    a.orgaos.map((o) => [o.orgao, o.itens]),
    [
      ['Prefeitura de Ubá', 3],
      ['Câmara de Leopoldina', 2],
    ],
  );
  const l = leituras(a).join('\n');
  assert.match(l, /melhor preço e mesmo assim não levou/);
  assert.match(l, /diferença para a vencedora foi pequena/);
  assert.match(l, /só a proposta e não deu lances/);
  assert.match(l, /Prefeitura de Ubá \(3 itens\)/);
  assert.match(l, /venceu 2 itens/);
});

test('PDF: dados da empresa, resumo, itens mais perto primeiro, contato e fonte', () => {
  const blocos = blocosDiagnostico(
    empresa,
    { licitacoes, desde: '2025-11-17', ate: '2026-11-17', portal: 'Portal de Compras Públicas' },
    { data: 'Astolfo Dutra, 17 de novembro de 2026', contato: { whatsapp: '(32) 9 9921-7912', email: 'contato@agilcm.com.br', site: 'www.agilcm.com.br' } },
  );
  const texto = JSON.stringify(blocos);
  assert.equal(blocos[1].text, 'Diagnóstico de licitações');
  assert.match(texto, /Analisamos as licitações de Minas Gerais de 17\/11\/2025/);
  const zm = JSON.stringify(
    blocosDiagnostico(empresa, { licitacoes, desde: '2025-11-17', ate: '2026-11-17' }, { data: '', contato: {}, abrangencia: 'Zona da Mata' }),
  );
  assert.match(zm, /Analisamos as licitações da Zona da Mata mineira de 17\/11\/2025/);
  assert.match(texto, /BETA COMERCIO LTDA/);
  assert.match(texto, /CNPJ 11\.111\.111\/0001-11 · Cataguases - MG · BETA/);
  assert.match(texto, /de 17\/11\/2025 a 17\/11\/2026/);
  const resumo = blocos.find((b) => b.type === 'table');
  assert.deepEqual(
    resumo.rows[0].map((c) => c.text),
    ['5', '2', '1', '2', '1'],
  );
  assert.match(texto, /R\$\s?108\.000/);
  const perto = blocos.filter((b) => b.type === 'table')[1];
  assert.deepEqual(
    perto.rows.map((r) => [r[1].split(':')[0], r[2].text, r[5].text]),
    [
      ['Item 2', 'Melhor preço', 'não levou'],
      ['Item 1', '2º lugar', '+2%'],
      ['Item 1', '3º lugar', '2 p.p. de desconto a menos'],
      ['Item 3', '4º lugar', '+50%'],
      ['Item 2', '5º lugar', '+50%'],
    ],
    'primeiro o que dá para virar',
  );
  assert.equal(perto.rows[2][3].text, '18% de desconto');
  assert.match(texto, /WhatsApp \(32\) 9 9921-7912/);
  assert.match(texto, /Fonte: atas das sessões publicadas no PNCP/);
});

test('mensagem para o primeiro contato', () => {
  const m = mensagemContato(empresa, { licitacoes });
  assert.match(m, /^Olá! Sou da Ágil CM/);
  assert.match(m, /BETA COMERCIO LTDA em 1 item ofereceu o melhor preço e não levou, ficou em 2º lugar em 1 item e em 2 itens perdeu por muito pouco/);
  assert.match(m, /diagnóstico gratuito/);
  assert.match(m, /licitações públicas de Minas Gerais nos últimos 12 meses/);
  assert.match(mensagemContato(empresa, { licitacoes }, { abrangencia: 'Zona da Mata' }), /licitações públicas da Zona da Mata nos últimos 12 meses/);
  assert.match(mensagemContato({ ...empresa, disputas: [d({ col: 4, melhor: 20, venc: 10 })] }, { licitacoes }), /disputou 1 item sem vencer/);
});
