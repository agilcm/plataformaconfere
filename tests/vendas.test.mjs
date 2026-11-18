// Ferramentas de venda da aba Possíveis clientes: nota de oportunidade, editais abertos que combinam, contato pelo
// cadastro do CNPJ, lembrete do funil no Telegram e diagnóstico por CNPJ (página pública).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensagemContato, mensagemEdital, notaOportunidade, objetoLegivel } from '../src/lib/diagnostico.js';
import { editaisParaEmpresa, indiceEditais, palavras, perfilEmpresa } from '../src/lib/editaisParaEmpresa.js';
import { buscarContato, contatoDe, linkWhatsApp, telefonesDe } from '../src/lib/contatoCnpj.js';
import { mensagemRetornos, quentesSemContato, retornosDoFunil } from '../src/lib/funilAviso.js';
import { cnpjValido, DIGITOS_PARTE, expandirDiagnostico, montarDiagnosticos } from '../src/lib/possiveisClientes.js';

const LICS = [
  { id: '1/2026/1', orgao: 'Prefeitura de Ubá', municipio: 'Ubá', uf: 'MG', data: '2026-11-01', objeto: 'Aquisição de material de limpeza e higiene' },
  { id: '1/2026/2', orgao: 'Prefeitura de Muriaé', municipio: 'Muriaé', uf: 'MG', data: '2026-06-10', objeto: 'Registro de preços de material de limpeza' },
  { id: '1/2026/3', orgao: 'Câmara de Leopoldina', municipio: 'Leopoldina', uf: 'MG', data: '2025-12-01', objeto: 'Detergente e desinfetante' },
];
const QUENTE = {
  cnpj: '11111111000111',
  razao: 'BETA LIMPEZA LTDA',
  cidade: 'Cataguases',
  disputas: [
    { lic: 0, item: '1', desc: 'DETERGENTE LÍQUIDO 500 ML', col: 2, melhor: 10.2, venc: 10, lances: 3, vt: 150000 },
    { lic: 0, item: '2', desc: 'DESINFETANTE 2 LITROS', col: 0, melhor: 9, venc: 10, lances: 2, vt: 5000 },
    { lic: 1, item: '1', desc: 'SABÃO EM PÓ 1 KG', col: 4, melhor: 20, venc: 10, lances: 1, vt: 1e6 },
  ],
};
const FRIA = {
  cnpj: '22222222000122',
  razao: 'GAMA LTDA',
  cidade: 'Ubá',
  disputas: [{ lic: 2, item: '1', desc: 'CANETA', col: 5, melhor: 20, venc: 10, lances: 1 }],
};

test('nota de oportunidade: perdas viráveis, recência, valor e frequência', () => {
  const q = notaOportunidade(QUENTE, LICS, '2026-11-17');
  assert.equal(q.nota, 8 * 2 + 25 + 15 + 6, '2 itens viráveis, 16 dias, R$ 155 mil, 2 licitações');
  assert.equal(q.faixa, 'quente');
  assert.deepEqual(q.motivos, [
    'perdeu 2 itens por pouco ou com o melhor preço',
    'última disputa há 16 dias',
    'R$ 155 mil levados pelas vencedoras nesses itens',
    '2 licitações disputadas',
  ]);
  const f = notaOportunidade(FRIA, LICS, '2026-11-17');
  assert.equal(f.faixa, 'fria');
  assert.equal(f.nota, 3, 'só a frequência: a disputa é antiga (mais de 180 dias) e ficou longe');
  assert.equal(notaOportunidade({ disputas: [] }, LICS, '2026-11-17').nota, 0);
});

test('mensagens: com o edital aberto e com o link do diagnóstico', () => {
  const m = mensagemEdital(QUENTE, {
    orgao: 'Consórcio Intermunicipal de Saúde',
    municipio: 'Lavras',
    objeto: 'Aquisição de material de limpeza.',
    propostasAte: '2026-11-25T09:00:00',
  });
  assert.match(m, /licitação de Consórcio Intermunicipal de Saúde de Lavras \(propostas até 25\/11\/2026\): aquisição de material de limpeza\. /);
  assert.match(m, /BETA LIMPEZA LTDA já disputou/);
  assert.doesNotMatch(mensagemEdital(QUENTE, { orgao: 'Prefeitura de Ubá', municipio: 'Ubá', objeto: 'X' }), / de Ubá \(/, 'o órgão já diz a cidade');
  assert.equal(
    objetoLegivel('[Portal de Compras Públicas] - REGISTRO DE PREÇOS PARA FUTURA E EVENTUAL AQUISIÇÃO DE FÓRMULAS INFANTIS'),
    'Aquisição de fórmulas infantis',
  );
  assert.equal(objetoLegivel('OBJETO: Registro de preços visando a aquisição de pneus'), 'Aquisição de pneus');
  assert.equal(objetoLegivel('Aquisição de material de limpeza'), 'Aquisição de material de limpeza');
  const link = 'https://www.agilcm.com.br/diagnostico-licitacoes/?cnpj=11111111000111';
  assert.match(
    mensagemContato(QUENTE, { licitacoes: LICS }, { link }),
    /que você pode ver aqui: https:\/\/www\.agilcm\.com\.br\/diagnostico-licitacoes\/\?cnpj=11111111000111 \. Podemos conversar\?$/,
  );
});

test('editais abertos que combinam: palavras do que a empresa disputou, raras nos editais', () => {
  assert.deepEqual(
    palavras('Aquisição de PNEUS e câmaras de ar para a frota municipal'),
    ['pneu', 'frota'],
    '"câmara" fica de fora: também é o nome de órgão (Câmara Municipal)',
  );
  assert.deepEqual(palavras('Botões descartáveis ornamentais lugares'), ['botao', 'descartavel', 'ornamental', 'lugar']);
  const editais = [
    {
      id: 'a',
      objeto: 'Registro de preços para aquisição de material de limpeza: detergente, desinfetante e sabão',
      orgao: 'Prefeitura de Lavras',
      municipio: 'Lavras',
      microrregiao: null,
      propostasAte: '2026-12-01T09:00:00',
    },
    {
      id: 'b',
      objeto: 'Aquisição de pneus para a frota',
      orgao: 'Prefeitura de Ubá',
      municipio: 'Ubá',
      microrregiao: 'Ubá',
      propostasAte: '2026-12-01T09:00:00',
    },
    {
      id: 'c',
      objeto: 'Material de limpeza e desinfetante para as escolas',
      orgao: 'Prefeitura de Muriaé',
      municipio: 'Muriaé',
      microrregiao: 'Muriaé',
      propostasAte: '2026-11-10T09:00:00',
    },
    { id: 'd', objeto: 'Contratação de serviços de engenharia', orgao: 'X', municipio: 'Y', microrregiao: null, propostasAte: null },
    { id: 'e', objeto: 'Aquisição de gêneros alimentícios', orgao: 'X', municipio: 'Y', microrregiao: null, propostasAte: null },
  ];
  // a raridade das palavras depende de quantos editais há (no site são os ~4 mil abertos de Minas): completa com outros
  const outros = Array.from({ length: 80 }, (_, i) => ({
    id: `o${i}`,
    objeto: ['Contratação de obra de pavimentação', 'Aquisição de gêneros alimentícios', 'Serviços de transporte escolar', 'Locação de veículos'][i % 4],
    orgao: 'X',
    municipio: 'Y',
    microrregiao: null,
    propostasAte: null,
  }));
  const idx = indiceEditais([...editais, ...outros]);
  const perfil = perfilEmpresa(QUENTE, LICS, idx.idf);
  assert.ok(perfil.has('limpeza') && perfil.has('detergente'));
  assert.ok(!perfil.has('uba') && !perfil.has('prefeitura'), 'nome da cidade e do órgão não contam');
  const agora = Date.parse('2026-11-17T12:00:00Z');
  const m = editaisParaEmpresa(QUENTE, LICS, idx, { agora });
  assert.deepEqual(
    m.map((x) => x.edital.id),
    ['a'],
    'o de pneus não combina; o de Muriaé já encerrou as propostas',
  );
  assert.ok(m[0].termos.includes('detergente'));
  assert.equal(editaisParaEmpresa(QUENTE, LICS, idx, { agora, soZonaDaMata: true }).length, 0, 'Lavras não é da Zona da Mata');
});

test('contato pelo cadastro do CNPJ: telefones, celular com WhatsApp, e-mail e a segunda fonte', async () => {
  assert.deepEqual(telefonesDe({ ddd_telefone_1: '3234221234', ddd_telefone_2: '32999217912' }), [
    { texto: '(32) 3422-1234', numero: '3234221234', celular: false },
    { texto: '(32) 99921-7912', numero: '32999217912', celular: true },
  ]);
  assert.deepEqual(telefonesDe({ ddd_telefone_1: '', ddd_telefone_2: '123' }), []);
  assert.deepEqual(
    telefonesDe({ ddd_telefone_1: '3285060170' }),
    [{ texto: '(32) 98506-0170', numero: '32985060170', celular: true }],
    'celular antigo, sem o 9',
  );
  const c = contatoDe({
    email: ' Contato@Empresa.com.br ',
    logradouro: 'RUA A',
    descricao_tipo_de_logradouro: 'RUA',
    numero: '10',
    bairro: 'CENTRO',
    municipio: 'UBA',
    uf: 'MG',
  });
  assert.equal(c.email, 'contato@empresa.com.br');
  assert.equal(c.endereco, 'RUA RUA A, 10, CENTRO, UBA - MG');
  assert.equal(contatoDe({ email: 'sem-arroba' }).email, '');
  assert.equal(linkWhatsApp('32999217912', 'Olá!'), 'https://wa.me/5532999217912?text=Ol%C3%A1!');
  const pedidos = [];
  const falsa = async (url) => {
    pedidos.push(url);
    if (url.includes('brasilapi')) return { ok: false, status: 503 };
    return { ok: true, status: 200, json: async () => ({ ddd_telefone_1: '3234221234' }) };
  };
  const r = await buscarContato('11111111000111', falsa);
  assert.equal(r.telefones[0].texto, '(32) 3422-1234');
  assert.equal(pedidos.length, 2, 'a BrasilAPI falhou e foi para o minhareceita.org');
  await assert.rejects(
    buscarContato('11111111000111', async () => ({ ok: false, status: 404 })),
    /não encontrado/,
  );
});

test('lembrete do funil: retornar hoje, atrasados e quentes sem contato', () => {
  const registros = {
    'funil:11111111000111': {
      edital: { titulo: 'BETA LIMPEZA LTDA', municipio: 'Cataguases', propostasAte: '2026-11-18' },
      etapa: 'contato',
      nota: 'falar com João',
      por: 'Allan',
    },
    'funil:33333333000133': { edital: { titulo: 'DELTA LTDA', municipio: 'Ubá', propostasAte: '2026-11-14' }, etapa: 'respondeu', nota: '' },
    'funil:44444444000144': { edital: { titulo: 'FECHADA LTDA', municipio: 'Ubá', propostasAte: '2026-11-10' }, etapa: 'fechou' },
    'funil:55555555000155': { edital: { titulo: 'FUTURA LTDA', municipio: 'Ubá', propostasAte: '2026-11-30' }, etapa: 'contato' },
    'funil:66666666000166': { edital: { titulo: 'APAGADA', propostasAte: '2026-11-18' }, etapa: 'contato', removido: true },
    'abc/2026/1': { edital: { titulo: 'Edital qualquer', propostasAte: '2026-11-18' }, etapa: 'interesse' },
  };
  const r = retornosDoFunil(registros, '2026-11-18');
  assert.deepEqual(
    r.hoje.map((x) => x.razao),
    ['BETA LIMPEZA LTDA'],
  );
  assert.deepEqual(
    r.atrasados.map((x) => [x.razao, x.atraso]),
    [['DELTA LTDA', 4]],
  );
  assert.equal(r.noFunil.size, 4, 'quem fechou e quem está para depois também já está no funil; o removido não');
  const clientes = { empresas: [QUENTE, { ...QUENTE, cnpj: '77777777000177', razao: 'NOVA LTDA' }], licitacoes: LICS };
  const q = quentesSemContato(clientes, r.noFunil, '2026-11-17');
  assert.deepEqual(
    q.map((x) => x.razao),
    ['NOVA LTDA'],
    'BETA já está no funil',
  );
  const t = mensagemRetornos(r, q, { hoje: '2026-11-18' });
  assert.match(t, /Prospecção de hoje · 18\/11\/2026/);
  assert.match(t, /Retornar hoje \(1\)<\/b>\n• <b>BETA LIMPEZA LTDA<\/b> \(Cataguases\) · Mensagem enviada\n {2}falar com João · Allan/);
  assert.match(t, /DELTA LTDA<\/b> \(Ubá\) · Respondeu · era para 14\/11\/2026 \(4 dias de atraso\)/);
  assert.match(t, /Quentes ainda sem contato<\/b>\n• <b>NOVA LTDA<\/b> \(Cataguases\) · nota 62/);
  assert.equal(mensagemRetornos({ hoje: [], atrasados: [], noFunil: new Set() }, [], { hoje: '2026-11-18' }), '');
});

test('diagnóstico por CNPJ: partes pelo começo do CNPJ, formato enxuto e de volta', () => {
  assert.equal(cnpjValido('27.750.870/0001-34'), true);
  assert.equal(cnpjValido('27.750.870/0001-35'), false);
  assert.equal(cnpjValido('11111111111111'), false);
  const cache = {
    compras: {
      'X/2026/1': {
        orgao: 'Prefeitura de Lavras',
        municipio: 'Lavras',
        uf: 'MG',
        titulo: 'Edital 1',
        objeto: 'Limpeza',
        data: '2026-10-01',
        itens: [
          {
            n: '0001',
            d: 'DETERGENTE NEUTRO, FRASCO DE 500 ML, COM TAMPA ABRE E FECHA, BIODEGRADÁVEL, CONFORME NORMAS DA ANVISA',
            v: 10,
            t: 1000,
            l: 1,
            c: [
              ['27750870000134', 1, 10, 3, 'PAPELARIA'],
              ['11111111000111', 2, 10.3, 4, 'BETA'],
              ['22222222000122', 7, 30, 1, 'LONGE'],
            ],
          },
        ],
      },
    },
    cnpj: { 11111111000111: { r: 'BETA LIMPEZA LTDA', m: 'CATAGUASES', u: 'MG' } },
  };
  const partes = montarDiagnosticos(cache);
  assert.deepEqual([...partes.keys()], ['111'], 'quem só venceu e quem ficou depois do 5º lugar não entram');
  assert.equal(DIGITOS_PARTE, 3);
  const x = expandirDiagnostico(partes.get('111'), '11111111000111');
  assert.equal(x.empresa.razao, 'BETA LIMPEZA LTDA');
  assert.equal(x.empresa.cidade, '', 'a cidade não vai para o arquivo público');
  assert.deepEqual(x.licitacoes, [{ id: 'X/2026/1', orgao: 'Prefeitura de Lavras', municipio: 'Lavras', uf: 'MG', data: '2026-10-01' }]);
  assert.deepEqual(x.empresa.disputas[0], {
    lic: 0,
    item: '0001',
    desc: 'DETERGENTE NEUTRO, FRASCO DE 500 ML, COM TAMPA ABRE E FECHA,…',
    col: 2,
    melhor: 10.3,
    venc: 10,
    lances: 4,
    participantes: 3,
    vt: 1000,
    lote: true,
  });
  assert.equal(expandirDiagnostico(partes.get('111'), '11111111000199'), null);
});

test('cofre da lista: abre com a senha do Privado e falha com outra', async () => {
  const { chaveDaSenha, chaveDoTexto, chaveParaTexto, cifrar, decifrar } = await import('../src/lib/cofre.js');
  const chave = await chaveDaSenha('senha-de-teste');
  const texto = new TextEncoder().encode('{"empresas":[]}');
  const arquivo = await cifrar(texto, chave);
  assert.deepEqual([...arquivo.subarray(0, 4)], [0x41, 0x47, 0x43, 0x31], 'começa com AGC1');
  assert.ok(!Buffer.from(arquivo).toString('latin1').includes('empresas'), 'o conteúdo não aparece no arquivo');
  assert.equal(new TextDecoder().decode(await decifrar(arquivo, chave)), '{"empresas":[]}');
  const deNovo = await chaveDoTexto(await chaveParaTexto(chave));
  assert.equal(new TextDecoder().decode(await decifrar(arquivo, deNovo)), '{"empresas":[]}', 'a chave guardada na sessão abre igual');
  await assert.rejects(decifrar(arquivo, await chaveDaSenha('outra')));
  await assert.rejects(decifrar(new Uint8Array([1, 2, 3]), chave), /formato desconhecido/);
});
