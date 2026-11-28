// CNPJ problemático: leitura das linhas da Receita, motivo provável da exclusão do Simples e do MEI, prioridade, busca,
// filtros, mensagem e planilha. Os dados abaixo são inventados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campos, chaveCidade, estabelecimentoDe, simplesDe, socioDe } from '../scripts/cnpj-problematico.mjs';
import {
  casosDe,
  classeDe,
  docMascarado,
  emailDeContador,
  abasPlanilhaProblematicos,
  filtrarProblematicos,
  linhasPlanilhaProblematicos,
  linkWhatsAppProblematico,
  mensagemProblematico,
  motivoMei,
  motivoSimples,
  nomeTitular,
  ordemProblematicos,
  primeiroNome,
  prioridadeDe,
  semCpf,
  semFormatacao,
  telefone,
  telefonesWhatsApp,
  titularCpf,
} from '../src/lib/cnpjProblematico.js';

const ANOS = ['2025', '2026'];
const MOTIVOS = new Map([['21', 'OMISSAO DE DECLARACOES']]);
const linhaEst = (sit, data, motivo, extra = {}) => {
  const c = Array(30).fill('');
  Object.assign(c, {
    0: '12345678',
    1: '0001',
    2: '95',
    3: '1',
    4: 'BOM PAO',
    5: sit,
    6: data,
    7: motivo,
    10: '20150310',
    11: '1091102',
    12: '4721102,5611203',
    13: 'RUA',
    14: 'DAS FLORES',
    15: '10',
    16: 'SALA 2',
    17: 'CENTRO',
    18: '36770000',
    19: 'MG',
    20: '4305',
    21: '32',
    22: '88887777',
    27: 'Padaria@Exemplo.com',
    ...extra,
  });
  return `"${c.join('";"')}"`;
};
const est = (sit, data = '', motivo = '00') => estabelecimentoDe(campos(linhaEst(sit, data, motivo)), MOTIVOS, 'Cataguases');
const simples = (opcao, dataOpcao, dataExclusao, mei, dataOpcaoMei, dataExclusaoMei) => ({
  opcao,
  dataOpcao,
  dataExclusao,
  mei,
  dataOpcaoMei,
  dataExclusaoMei,
});

test('linha da Receita: campos entre aspas, estabelecimento, Simples e sócio', () => {
  assert.deepEqual(campos('"1";"A;B";"";"x"\r'), ['1', 'A;B', '', 'x']);
  const e = est('04', '20260514', '21');
  assert.equal(e.cnpj, '12345678000195');
  assert.equal(e.situacao, '04');
  assert.equal(e.dataSituacao, '2026-05-14');
  assert.equal(e.motivoSituacao, 'OMISSAO DE DECLARACOES');
  assert.equal(e.endereco, 'RUA DAS FLORES, 10 SALA 2');
  assert.deepEqual(e.cnaes, ['4721102', '5611203']);
  assert.equal(e.tel1, '3288887777');
  assert.equal(e.email, 'padaria@exemplo.com');
  assert.equal(estabelecimentoDe(campos(linhaEst('04', '20260514', '32')), MOTIVOS, 'X').motivoSituacao, 'código 32, sem descrição na tabela da Receita');
  assert.deepEqual(simplesDe(['12345678', 'N', '20100101', '00000000', 'N', '0', '']), {
    opcao: 'N',
    dataOpcao: '2010-01-01',
    dataExclusao: '',
    mei: 'N',
    dataOpcaoMei: '',
    dataExclusaoMei: '',
  });
  const s = socioDe(['12345678', '2', 'MARIA DA SILVA', '***654321**', '49', '20150310', '', '***000000**', '', '00', '5']);
  assert.deepEqual(s, { nome: 'MARIA DA SILVA', doc: '***654321**', pj: false, qual: '49', entrada: '2015-03-10', faixa: 5 });
  assert.equal(chaveCidade('Dona Euzébia'), chaveCidade('DONA EUSEBIA'));
  assert.equal(chaveCidade('Miraí'), 'MIRAI');
});

test('formatos: documento mascarado, titular do MEI, telefone e e-mail de contador', () => {
  assert.equal(docMascarado('***654321**'), '***.654.321-**');
  assert.equal(docMascarado('12345678000195'), '12.345.678/0001-95');
  assert.equal(titularCpf('11.222.333 FULANA DE TAL 12345678901'), '***.456.789-**');
  assert.equal(semCpf('FULANA DE TAL 12345678901'), 'FULANA DE TAL');
  assert.equal(nomeTitular('11.222.333 FULANA DE TAL 12345678901'), 'FULANA DE TAL');
  assert.equal(telefone('32', '8888-7777'), '3288887777');
  assert.equal(telefone('32', ''), '');
  assert.ok(emailDeContador('fiscal@contabilidadex.com.br'));
  assert.ok(!emailDeContador('padaria@gmail.com'));
});

test('motivo do MEI: inapto, de ofício, crescimento, excluído depois do Simples e a verificar', () => {
  assert.equal(motivoMei(est('04', '20260510', '21'), simples('N', '', '', 'N', '2020-01-01', '2026-05-20'), '').classe, 'problema');
  assert.match(motivoMei(est('04', '20260510', '21'), simples('N', '', '', 'N', '', '2026-05-20'), '').motivo, /inapto \(omissao de declaracoes\)/);
  assert.match(motivoMei(est('02'), simples('N', '2020-01-01', '2026-03-01', 'N', '', '2026-03-01'), '').motivo, /mesma data, de ofício/);
  const cresc = motivoMei(est('02'), simples('S', '2020-01-01', '', 'N', '', '2026-03-01'), 'Sociedade Empresária Limitada');
  assert.equal(cresc.classe, 'crescimento');
  assert.match(cresc.motivo, /Hoje é Sociedade Empresária Limitada$/);
  assert.doesNotMatch(motivoMei(est('02'), simples('S', '', '', 'N', '', '2026-03-01'), 'Empresário (Individual)').motivo, /Hoje é/);
  assert.match(
    motivoMei(est('02'), simples('N', '', '2026-08-01', 'N', '', '2026-03-01'), '').motivo,
    /depois foi excluído também do Simples, em 01\/08\/2026/,
  );
  assert.equal(motivoMei(est('02'), simples('N', '', '', 'N', '', '2026-03-01'), '').classe, 'verificar');
});

test('motivo do Simples: inapto, junto com o MEI, 1º de janeiro, meio do ano e volta ao Simples', () => {
  assert.match(motivoSimples(est('04', '20251215', '21'), simples('N', '', '2025-12-31', 'N', '', '')).motivo, /declarado inapto/);
  assert.match(motivoSimples(est('02'), simples('N', '', '2026-03-01', 'N', '', '2026-03-01')).motivo, /Simples e do MEI na mesma data/);
  const jan = motivoSimples(est('02'), simples('S', '2026-02-01', '2025-12-31', 'N', '', ''));
  assert.equal(jan.classe, 'problema');
  assert.match(jan.motivo, /1º de janeiro.*Já voltou ao Simples em 01\/02\/2026\.$/);
  assert.equal(motivoSimples(est('02'), simples('N', '', '2026-06-15', 'N', '', '')).classe, 'verificar');
});

test('casos: inapta sempre entra; exclusões só dos anos pedidos e de empresa ainda aberta; prioridade', () => {
  const s = simples('N', '', '2025-12-31', 'N', '2019-01-01', '2024-06-01');
  const inapta = casosDe(est('04', '20260514', '21'), s, '', ANOS);
  assert.deepEqual(
    inapta.map((c) => c.tipo),
    ['inapta', 'simples'],
    'MEI de 2024 fica de fora',
  );
  assert.equal(classeDe(inapta), 'problema');
  assert.deepEqual(casosDe(est('08', '20260101', '01'), s, '', ANOS), [], 'baixada não entra pelas exclusões');
  assert.deepEqual(casosDe(est('02'), null, '', ANOS), []);
  const cresc = casosDe(est('02'), simples('S', '', '', 'N', '', '2026-03-01'), '', ANOS);
  assert.equal(classeDe(cresc), 'crescimento');
  assert.equal(classeDe([...cresc, { classe: 'verificar' }]), 'verificar');

  assert.equal(prioridadeDe({ classe: 'problema', tel1: '3288887777', tel2: '', email: '' }), 'alta');
  assert.equal(prioridadeDe({ classe: 'problema', tel1: '', tel2: '', email: 'contabil@x.com' }), 'media');
  assert.equal(prioridadeDe({ classe: 'crescimento', tel1: '', tel2: '', email: 'loja@x.com' }), 'media');
  assert.equal(prioridadeDe({ classe: 'problema', tel1: '', tel2: '', email: '' }), 'baixa');
  assert.equal(prioridadeDe({ classe: 'verificar', tel1: '3288887777', tel2: '', email: '' }), 'baixa');
});

const registro = (over) => {
  const e = est('02');
  const r = {
    ...e,
    razao: 'PADARIA BOM PAO LTDA',
    natureza: '2062',
    qualResp: '49',
    capital: 10000,
    porte: '01',
    simples: simples('N', '2015-03-10', '2025-12-31', 'N', '', ''),
    socios: [{ nome: 'MARIA DA SILVA', doc: '***654321**', pj: false, qual: '49', entrada: '2015-03-10', faixa: 5 }],
    titularCpf: '',
    ...over,
  };
  r.casos = r.casos || casosDe(r, r.simples, 'Sociedade Empresária Limitada', ANOS);
  r.classe = classeDe(r.casos);
  r.prioridade = prioridadeDe(r);
  return r;
};

test('lista: busca por sócio e CNPJ, filtros e ordem', () => {
  const a = registro({});
  const b = registro({ cnpj: '99999999000199', razao: 'LOJA X', cidade: 'Ubá', tel1: '', email: '', socios: [] });
  const c = registro({ cnpj: '88888888000188', razao: 'MERCADO Y', simples: simples('S', '', '', 'N', '', '2026-03-01') });
  const dados = { empresas: [b, c, a], cnae: { 1091102: 'Fabricação de produtos de panificação' } };
  assert.deepEqual(
    filtrarProblematicos(dados, { q: 'maria' }).map((r) => r.cnpj),
    [c.cnpj, a.cnpj],
  );
  assert.deepEqual(
    filtrarProblematicos(dados, { q: '12.345.678' }).map((r) => r.cnpj),
    [a.cnpj],
  );
  assert.equal(filtrarProblematicos(dados, { q: 'panificacao' }).length, 3);
  assert.deepEqual(
    filtrarProblematicos(dados, { cidade: 'Ubá' }).map((r) => r.cnpj),
    [b.cnpj],
  );
  assert.deepEqual(
    filtrarProblematicos(dados, { caso: 'mei-2026' }).map((r) => r.cnpj),
    [c.cnpj],
  );
  assert.equal(filtrarProblematicos(dados, { caso: 'simples-2026' }).length, 0);
  assert.equal(filtrarProblematicos(dados, { caso: 'simples' }).length, 2);
  assert.deepEqual(
    filtrarProblematicos(dados, { telefone: true, classe: 'problema' }).map((r) => r.cnpj),
    [a.cnpj],
  );
  assert.deepEqual(
    [...dados.empresas].sort(ordemProblematicos).map((r) => r.cnpj),
    [a.cnpj, c.cnpj, b.cnpj],
    'alta, depois média, depois baixa',
  );
});

test('mensagem e planilha', () => {
  const a = registro({});
  const msg = mensagemProblematico(a, { remetente: 'Allan' });
  assert.match(msg, /^Olá, Maria, tudo bem\?\n\nAqui é Allan, da \*Ágil CM\*, empresa de consultoria\./);
  assert.ok(!/Astolfo/.test(msg), 'sem a cidade');
  // sociedade: a dívida pode chegar ao CPF do sócio (não em todo caso), por isso "podem acabar"
  assert.match(msg, /E o problema não fica só na empresa: multas e dívidas da empresa podem acabar no \*seu CPF\*\./);
  assert.match(msg, /a \*PADARIA BOM PAO LTDA\* \(CNPJ 12\.345\.678\/0001-95\) foi \*excluída do Simples Nacional\* em 31\/12\/2025/);
  assert.match(
    msg,
    /\n\n_Se este número não for de Maria ou da PADARIA BOM PAO LTDA, por favor desconsidere esta mensagem\. Pedimos desculpas pelo incômodo\._$/,
  );
  assert.match(mensagemProblematico(a), /^Olá, Maria, tudo bem\?\n\nSomos da \*Ágil CM\*/, 'sem remetente');
  assert.match(
    mensagemProblematico(registro({ situacao: '04', dataSituacao: '2026-05-14', motivoSituacao: 'OMISSAO DE DECLARACOES' })),
    /\*CNPJ inapto\* por falta de declarações/,
  );
  assert.match(mensagemProblematico(registro({ simples: simples('S', '', '', 'N', '', '2026-03-01') })), /passou a ser microempresa/);
  assert.ok(!semFormatacao(msg).includes('*') && !semFormatacao(msg).includes('_'), 'sem as marcas do WhatsApp para e-mail e planilha');
  // MEI (sem sócios, CPF no fim do nome): fala com o titular e não repete o nome da empresa no pedido de desculpas
  const mei = registro({ razao: 'JOSE PEREIRA 12345678901', socios: [] });
  assert.equal(primeiroNome(mei), 'Jose');
  assert.match(mensagemProblematico(mei), /a empresa \*JOSE PEREIRA\*/);
  assert.match(mensagemProblematico(mei), /_Se este número não for de Jose, por favor desconsidere/);
  // MEI: a empresa é a própria pessoa, então cai direto no CPF
  assert.match(mensagemProblematico(mei), /como a empresa está no seu nome, as multas e dívidas dela caem direto no \*seu CPF\*\./);
  // empresa sem sócio pessoa física: sem nome no cumprimento
  assert.match(
    mensagemProblematico(registro({ socios: [{ nome: 'HOLDING X LTDA', pj: true, doc: '11222333000181', qual: '22', entrada: '' }] })),
    /^Olá, tudo bem\?[\s\S]*podem acabar no \*CPF dos sócios\*/,
  );
  // link do WhatsApp: celular primeiro, com a mensagem; fixo também entra
  const dois = registro({ tel1: '3234221234', tel2: '32988887777' });
  assert.deepEqual(
    telefonesWhatsApp(dois).map((t) => [t.numero, t.celular]),
    [
      ['32988887777', true],
      ['3234221234', false],
    ],
  );
  const link = linkWhatsAppProblematico(dois, 'Olá, tudo bem?');
  assert.equal(link, 'https://wa.me/5532988887777?text=Ol%C3%A1%2C%20tudo%20bem%3F');
  assert.equal(linkWhatsAppProblematico(registro({ tel1: '', tel2: '' }), 'x'), '');

  const socios = Array.from({ length: 6 }, (_, i) => ({ nome: `SOCIO ${i + 1}`, doc: '***123456**', pj: false, qual: '22', entrada: '2020-01-01' }));
  const [l] = linhasPlanilhaProblematicos({ qualificacao: { 22: 'Sócio', 49: 'Sócio-Administrador' }, natureza: {}, cnae: {} }, [registro({ socios })]);
  assert.equal(l.CNPJ, '12.345.678/0001-95');
  assert.equal(l.Prioridade, 'Alta');
  assert.equal(l['Telefone 1'], '(32) 98888-7777', 'celular antigo ganha o 9');
  assert.equal(l['Sócio 1 - CPF/CNPJ'], '***.123.456-**');
  assert.equal(l['Sócio 4 - nome'], 'SOCIO 4');
  assert.equal(l['Demais sócios'], 'SOCIO 5 (sócio); SOCIO 6 (sócio)');
  assert.equal(l['Exclusão do Simples'], '31/12/2025');
  assert.equal(l.CEP, '36770-000');
  const [sem] = linhasPlanilhaProblematicos({ qualificacao: {}, natureza: {}, cnae: {} }, [registro({ socios: [] })]);
  assert.equal(sem['Sócio 1 - nome'], '', 'colunas dos sócios existem mesmo sem sócios');
});

test('planilha em abas: leia-me, resumo, contatos e uma aba por situação e ano', () => {
  const a = registro({});
  const b = registro({
    cnpj: '99999999000199',
    razao: 'LOJA X',
    cidade: 'Ubá',
    situacao: '04',
    dataSituacao: '2026-05-14',
    motivoSituacao: 'OMISSAO DE DECLARACOES',
  });
  const c = registro({ cnpj: '88888888000188', razao: 'MERCADO Y', simples: simples('S', '', '', 'N', '', '2026-03-01') });
  const dados = { base: '2026-11', anos: ['2025', '2026'], cidades: ['Cataguases', 'Ubá'], qualificacao: {}, natureza: {}, cnae: {} };
  const abas = abasPlanilhaProblematicos(dados, [a, b, c], (cnpj) => (cnpj === a.cnpj ? 'Respondeu' : 'Sem contato'));
  assert.deepEqual(
    abas.map((x) => x.nome),
    ['Leia-me', 'Resumo', 'Contatos', 'Inaptas', 'Excluídas do Simples 2025', 'Excluídas do MEI 2026'],
    'abas vazias (Simples 2026, MEI 2025) saem',
  );
  const contatos = abas.find((x) => x.nome === 'Contatos').linhas;
  assert.equal(contatos.length, 3);
  assert.equal(contatos[0]['Etapa da prospecção'], 'Respondeu');
  const inaptas = abas.find((x) => x.nome === 'Inaptas').linhas;
  assert.equal(inaptas.length, 1);
  assert.equal(inaptas[0]['Inapta desde'], '14/05/2026');
  assert.match(inaptas[0]['Motivo provável deste caso'], /omissao de declaracoes/);
  const simples25 = abas.find((x) => x.nome === 'Excluídas do Simples 2025').linhas;
  assert.equal(simples25.length, 2, 'a inapta também foi excluída do Simples em 31/12/2025');
  assert.equal(simples25[0]['Data da exclusão'], '31/12/2025');
  const mei = abas.find((x) => x.nome === 'Excluídas do MEI 2026').linhas;
  assert.equal(mei[0]['Tipo deste caso'], 'Crescimento (faturamento)');
  const resumo = abas.find((x) => x.nome === 'Resumo').linhas;
  assert.deepEqual(
    resumo.map((l) => [l.Cidade, l.Estabelecimentos, l.Inaptas, l['Excluídas do MEI 2026']]),
    [
      ['Cataguases', 2, 0, 1],
      ['Ubá', 1, 1, 0],
      ['Total', 3, 1, 1],
    ],
  );
});

test('planilha: coluna WhatsApp vira link clicável no Excel', async () => {
  const { criarXlsx } = await import('../src/lib/xlsx.js');
  const b = criarXlsx([
    {
      nome: 'Contatos',
      colunas: [{ titulo: 'Empresa' }, { titulo: 'WhatsApp' }],
      linhas: [
        ['A', { texto: 'Abrir conversa', link: 'https://wa.me/5532988887777?text=Ol%C3%A1&x=1' }],
        ['B', ''],
      ],
    },
  ]);
  // o zip é guardado sem compressão: dá para achar os arquivos no próprio conteúdo
  const t = Buffer.from(b).toString('utf8');
  assert.ok(t.includes('xl/worksheets/_rels/sheet1.xml.rels'), 'a aba ganha o arquivo de relações dos links');
  assert.match(t, /<hyperlink ref="B2" r:id="rId1"\/>/);
  assert.match(t, /Target="https:\/\/wa\.me\/5532988887777\?text=Ol%C3%A1&amp;x=1" TargetMode="External"/);
  assert.match(t, /<c r="B2" s="6" t="inlineStr"><is><t xml:space="preserve">Abrir conversa<\/t><\/is><\/c>/);
  assert.ok(!/<hyperlink ref="B3"/.test(t), 'célula vazia não vira link');
});
