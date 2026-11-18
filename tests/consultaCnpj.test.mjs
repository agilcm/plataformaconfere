// Consulta CNPJ: reconhecimento das tabelas do cnpj.db, montagem de cada empresa, histórico em licitações, busca,
// filtros, planilha e mensagem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colunas, estabelecimento, historicoLicitacoes, tabelaDaLinha } from '../scripts/cadastro-cnpj.mjs';
import { filtrarCadastro, linhasPlanilhaCadastro, mensagemCadastro, ordemCadastro, porteDe, temRamo, textoBusca } from '../src/lib/consultaCnpj.js';

const SQL_EST =
  'CREATE TABLE estabelecimento ( cnpj_basico TEXT, cnpj_ordem TEXT, cnpj_dv TEXT, matriz_filial TEXT, nome_fantasia TEXT, situacao_cadastral TEXT, data_situacao_cadastral TEXT, motivo_situacao_cadastral TEXT, nome_cidade_exterior TEXT, pais TEXT, data_inicio_atividades TEXT, cnae_fiscal TEXT, cnae_fiscal_secundaria TEXT, tipo_logradouro TEXT, logradouro TEXT, numero TEXT, complemento TEXT, bairro TEXT, cep TEXT, uf TEXT, municipio TEXT, ddd1 TEXT, telefone1 TEXT, ddd2 TEXT, telefone2 TEXT, ddd_fax TEXT, fax TEXT, correio_eletronico TEXT, situacao_especial TEXT, data_situacao_especial TEXT)';

test('cnpj.db: tabela de cada linha pelo número de colunas e pelo conteúdo, e as colunas pelo CREATE TABLE', () => {
  assert.equal(tabelaDaLinha(new Array(30).fill('x')), 'estabelecimento');
  assert.equal(tabelaDaLinha(new Array(11).fill('x')), 'socios');
  assert.equal(tabelaDaLinha(['12345678', 'PADARIA BOM PAO LTDA', '2062', '49', '1000,00', '01', null]), 'empresas', 'empresa antiga, de antes da coluna nova');
  assert.equal(tabelaDaLinha(['12345678', 'PADARIA BOM PAO LTDA', '2062', '49', '1000,00', '01', null, 1000]), 'empresas');
  assert.equal(tabelaDaLinha(['12345678', 'S', '20200101', '', 'N', '', '']), 'simples');
  assert.equal(tabelaDaLinha(['4305', 'CATAGUASES']), 'dicionario');
  const c = colunas(SQL_EST);
  assert.equal(c.length, 30);
  assert.equal(c[20], 'municipio');
  assert.deepEqual(colunas('CREATE TABLE "cnae" ( "codigo" TEXT,   "descricao" TEXT )'), ['codigo', 'descricao']);
});

test('cnpj.db: o estabelecimento vira a empresa do site (CNPJ, telefones, endereço, atividades)', () => {
  const col = Object.fromEntries(colunas(SQL_EST).map((n, i) => [n, i]));
  const v = new Array(30).fill('');
  Object.assign(v, {
    [col.cnpj_basico]: '27750870',
    [col.cnpj_ordem]: '0001',
    [col.cnpj_dv]: '34',
    [col.matriz_filial]: '1',
    [col.nome_fantasia]: 'PAPELARIA LEOPOLDINA',
    [col.situacao_cadastral]: '02',
    [col.data_inicio_atividades]: '20170605',
    [col.cnae_fiscal]: '4761003',
    [col.cnae_fiscal_secundaria]: '4751201,4789005',
    [col.tipo_logradouro]: 'RUA',
    [col.logradouro]: 'COTEGIPE',
    [col.numero]: '100',
    [col.bairro]: 'CENTRO',
    [col.cep]: '36700000',
    [col.uf]: 'MG',
    [col.municipio]: '4767',
    [col.ddd1]: '32',
    [col.telefone1]: '34411234',
    [col.ddd2]: '',
    [col.telefone2]: '',
    [col.correio_eletronico]: 'Contato@Papelaria.com.BR',
  });
  v[col.ddd_fax] = null;
  const e = estabelecimento(v, col);
  assert.deepEqual(e, {
    cnpj: '27750870000134',
    matriz: true,
    fantasia: 'PAPELARIA LEOPOLDINA',
    abertura: '20170605',
    cnae: '4761003',
    cnaes: ['4751201', '4789005'],
    endereco: 'RUA COTEGIPE, 100',
    bairro: 'CENTRO',
    cep: '36700000',
    municipio: '4767',
    uf: 'MG',
    tel1: '3234411234',
    tel2: '',
    email: 'contato@papelaria.com.br',
  });
});

test('histórico em licitações de cada CNPJ, pelas atas lidas', () => {
  const cache = {
    compras: {
      a: {
        data: '2026-10-01',
        itens: [
          {
            v: 10,
            c: [
              ['111', 1, 10],
              ['222', 2, 11],
              ['333', 7, 20],
            ],
          },
          { v: null, c: [['111', 1, 5]] },
        ],
      },
      b: {
        data: '2026-11-01',
        itens: [
          {
            v: 3,
            c: [
              ['222', 0, 2.5],
              ['111', 1, 3],
            ],
          },
        ],
      },
    },
  };
  const h = historicoLicitacoes(cache);
  assert.deepEqual(h.get('111'), { itens: 3, vitorias: 2, perto: 0, ultima: '2026-11-01' }, 'sem vencedora identificada não conta como vitória');
  assert.deepEqual(h.get('222'), { itens: 2, vitorias: 0, perto: 2, ultima: '2026-11-01' });
  assert.deepEqual(h.get('333'), { itens: 1, vitorias: 0, perto: 0, ultima: '2026-10-01' });
  assert.equal(historicoLicitacoes(null).size, 0);
});

const DADOS = {
  cnae: { 4761003: 'Comércio varejista de artigos de papelaria', 4744099: 'Comércio varejista de materiais de construção em geral', 5611201: 'Restaurantes' },
  empresas: [
    {
      cnpj: '27750870000134',
      razao: 'PAPELARIA LEOPOLDINA LTDA',
      fantasia: '',
      cidade: 'Leopoldina',
      uf: 'MG',
      porte: '01',
      cnae: '4761003',
      cnaes: [],
      bairro: 'CENTRO',
      tel1: '3234411234',
      tel2: '',
      email: '',
      lic: { itens: 12, vitorias: 2, perto: 9, ultima: '2026-10-29' },
    },
    {
      cnpj: '11111111000111',
      razao: 'CONSTRUFORTE MATERIAIS LTDA',
      fantasia: 'CONSTRUFORTE',
      cidade: 'Ubá',
      uf: 'MG',
      porte: '03',
      cnae: '4744099',
      cnaes: ['4761003'],
      bairro: 'SÃO JOÃO',
      tel1: '',
      tel2: '',
      email: 'a@b.com',
    },
    {
      cnpj: '22222222000122',
      razao: 'MARIA DA SILVA',
      fantasia: 'RESTAURANTE DA MARIA',
      cidade: 'Ubá',
      uf: 'MG',
      porte: '01',
      mei: true,
      cnae: '5611201',
      cnaes: [],
      bairro: 'CENTRO',
      tel1: '32988887777',
      tel2: '',
      email: '',
    },
  ],
};

test('busca e filtros: CNPJ, nome, ramo (principal ou secundário), cidade, porte, contato e licitações', () => {
  const nomes = (f) => filtrarCadastro(DADOS, f).map((e) => e.razao.split(' ')[0]);
  assert.deepEqual(nomes({ q: '27.750.870' }), ['PAPELARIA']);
  assert.deepEqual(nomes({ q: 'papelaria' }), ['PAPELARIA', 'CONSTRUFORTE'], 'a Construforte tem papelaria como atividade secundária');
  assert.deepEqual(nomes({ q: 'construcao uba' }), ['CONSTRUFORTE'], 'sem acento e com a cidade');
  assert.deepEqual(nomes({ cidade: 'Ubá' }), ['CONSTRUFORTE', 'MARIA']);
  assert.deepEqual(nomes({ porte: 'MEI' }), ['MARIA']);
  assert.deepEqual(nomes({ porte: 'Empresa de pequeno porte' }), ['CONSTRUFORTE']);
  assert.deepEqual(nomes({ telefone: true }), ['PAPELARIA', 'MARIA']);
  assert.deepEqual(nomes({ email: true }), ['CONSTRUFORTE']);
  assert.deepEqual(nomes({ licitacao: 'sim' }), ['PAPELARIA']);
  assert.deepEqual(nomes({ licitacao: 'nao' }), ['CONSTRUFORTE', 'MARIA']);
  assert.equal(porteDe(DADOS.empresas[2]), 'MEI');
  assert.ok(temRamo(DADOS.empresas[1], 'papelaria', DADOS.cnae));
  assert.ok(textoBusca(DADOS.empresas[1], DADOS.cnae).includes('SAO JOAO'));
  assert.deepEqual(
    [...DADOS.empresas].sort(ordemCadastro).map((e) => e.razao.split(' ')[0]),
    ['PAPELARIA', 'CONSTRUFORTE', 'MARIA'],
    'quem já disputou licitação primeiro',
  );
});

test('planilha e mensagem: quem já disputa recebe o diagnóstico; quem nunca disputou, o convite', () => {
  const l = linhasPlanilhaCadastro(DADOS, DADOS.empresas);
  assert.equal(l[0].CNPJ, '27.750.870/0001-34');
  assert.equal(l[0].Telefone, '(32) 3441-1234');
  assert.equal(l[2].Telefone, '(32) 98888-7777');
  assert.equal(l[0]['Atividade principal'], 'Comércio varejista de artigos de papelaria');
  assert.equal(l[0]['Itens vencidos'], 2);
  assert.equal(l[0]['Última licitação'], '29/10/2026');
  assert.equal(l[1]['Itens disputados em licitações'], 0);
  assert.match(mensagemCadastro(DADOS.empresas[0]), /diagnostico-licitacoes\/\?cnpj=27750870000134/);
  assert.match(
    mensagemCadastro(DADOS.empresas[1]),
    /prefeituras e órgãos públicos de Ubá e região compram o ano inteiro por licitação, e a CONSTRUFORTE MATERIAIS LTDA pode vender/,
  );
});

test('vários CNPJs: acha no texto colado, separa os de número errado e limita a 100', async () => {
  const { cnpjsDoTexto } = await import('../src/lib/consultaCnpj.js');
  const r = cnpjsDoTexto('27.750.870/0001-34; 27750870000134\n00.000.000/0001-91 e 11.222.333/0001-99, telefone 32 99999-0000');
  assert.deepEqual(r, { validos: ['27750870000134', '00000000000191'], invalidos: ['11222333000199'], sobraram: 0 });
  assert.equal(cnpjsDoTexto('27750870000134 00000000000191', 1).sobraram, 1);
});

test('ficha da Receita: o formato da BrasilAPI vira a ficha da tela, sem os sócios', async () => {
  const { cadastroDaReceita, linhasPlanilhaReceita, textoCadastro } = await import('../src/lib/consultaCnpj.js');
  const d = {
    cnpj: '27750870000134',
    razao_social: 'PAPELARIA LEOPOLDINA LTDA',
    nome_fantasia: 'PAPELARIA LEOPOLDINA',
    descricao_situacao_cadastral: 'ATIVA',
    data_situacao_cadastral: '2017-05-17',
    data_inicio_atividade: '2017-05-17',
    natureza_juridica: '206-2 - Sociedade Empresária Limitada',
    porte: 'MICRO EMPRESA',
    opcao_pelo_simples: true,
    opcao_pelo_mei: false,
    capital_social: 30000,
    cnae_fiscal: 4761003,
    cnae_fiscal_descricao: 'Comércio varejista de artigos de papelaria',
    cnaes_secundarios: [
      { codigo: 4751201, descricao: 'Equipamentos de informática' },
      { codigo: 0, descricao: '' },
    ],
    descricao_tipo_de_logradouro: 'RUA',
    logradouro: 'JOSE SILVA',
    numero: '235',
    complemento: '',
    bairro: 'CENTRO',
    cep: '36700000',
    municipio: 'LEOPOLDINA',
    uf: 'MG',
    ddd_telefone_1: '3234494338',
    ddd_telefone_2: '',
    email: 'Contato@Papelaria.COM',
    qsa: [{ nome_socio: 'FULANO' }],
  };
  const c = cadastroDaReceita(d);
  assert.equal(c.situacao, 'Ativa');
  assert.equal(c.natureza, 'Sociedade Empresária Limitada');
  assert.equal(c.porte, 'Microempresa');
  assert.deepEqual(c.cnae, { codigo: '4761003', descricao: 'Comércio varejista de artigos de papelaria' });
  assert.equal(c.cnaes.length, 1, 'a secundária "0" (sem atividade) fica de fora');
  assert.equal(c.endereco, 'RUA JOSE SILVA, 235');
  assert.equal(c.cidade, 'Leopoldina');
  assert.equal(c.email, 'contato@papelaria.com');
  assert.ok(!JSON.stringify(c).includes('FULANO'), 'os sócios não entram');
  assert.equal(cadastroDaReceita({ ...d, opcao_pelo_mei: true }).porte, 'MEI');
  const t = textoCadastro(c);
  assert.match(t, /^PAPELARIA LEOPOLDINA LTDA\nNome fantasia: PAPELARIA LEOPOLDINA\nCNPJ: 27\.750\.870\/0001-34\nSituação: Ativa desde 17\/05\/2017/);
  assert.match(t, /Endereço: RUA JOSE SILVA, 235, CENTRO, Leopoldina - MG, CEP 36700-000\nTelefone: \(32\) 3449-4338\nE-mail: contato@papelaria\.com$/);
  const l = linhasPlanilhaReceita([
    { cnpj: c.cnpj, c },
    { cnpj: '00000000000191', erro: 'CNPJ não encontrado no cadastro da Receita.' },
  ]);
  assert.equal(l[0].Situação, 'Ativa');
  assert.equal(l[0]['Simples Nacional'], 'Sim');
  assert.equal(l[0]['Capital social'], 'R$ 30.000,00');
  assert.equal(l[1].Situação, 'CNPJ não encontrado no cadastro da Receita.');
  assert.equal(l[1].Empresa, '');
});
