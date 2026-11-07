import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CERTIDOES,
  GRUPOS,
  avaliarEmpresa,
  avaliarMes,
  competenciaAtual,
  mensagemPendencias,
  nomeCompetencia,
  prazoDe,
  blocosRelatorioMensal,
} from '../src/lib/docpref.js';
import { categoriaDaPasta, compDaPasta, lerDocumento, lerForcaDeTrabalho, pagoATerceiro } from '../src/lib/docprefLeitor.js';
import { abasForcaDeTrabalho, blocosCartilha } from '../src/lib/docprefCartilha.js';

test('prazo: último dia do mês seguinte, ou o dia combinado', () => {
  assert.equal(prazoDe('2026-03'), '2026-04-30');
  assert.equal(prazoDe('2026-01'), '2026-02-28');
  assert.equal(prazoDe('2026-12'), '2027-01-31');
  assert.equal(prazoDe('2026-10', 25), '2026-11-25');
  assert.equal(prazoDe('2027-01', 31), '2027-02-28');
  assert.equal(competenciaAtual(new Date(2026, 10, 7)), '2026-10');
  assert.equal(nomeCompetencia('2026-10'), 'outubro/2026');
});

test('pastas: mês e categoria pelo nome', () => {
  assert.equal(compDaPasta('03-2026'), '2026-03');
  assert.equal(compDaPasta('2026.04'), '2026-04');
  assert.equal(compDaPasta('Março 2026'), '2026-03');
  assert.equal(compDaPasta('Documentos'), null);
  assert.equal(categoriaDaPasta('FOPAG e Comp. de Pgto'), 'fopag');
  assert.equal(categoriaDaPasta('Demissão-transferência'), 'demissao');
  assert.equal(categoriaDaPasta('Admissão-alocação'), 'admissao');
  assert.equal(categoriaDaPasta('VA e VR'), 'vavr');
  assert.equal(categoriaDaPasta('VT'), 'vt');
  assert.equal(categoriaDaPasta('INSS + FGTS'), 'inss-fgts');
  assert.equal(categoriaDaPasta('Acordo Coletivo'), 'acordo');
  const ids = [...GRUPOS.flatMap((g) => g.itens.map((i) => i.id)), ...CERTIDOES.map((c) => c.id)];
  assert.equal(new Set(ids).size, ids.length); // ids únicos
});

test('leitura dos documentos: competência pelo período de apuração', () => {
  const recibo = lerDocumento({
    nome: 'Recibo_x.pdf',
    categoria: 'inss',
    texto:
      'Recibo de Entrega da Declaração de Débitos e Créditos Tributários Federais - DCTFWeb\nCNPJ/CPF 00.000.000/0001-00\nPeríodo de apuração 04/2026\nTOTAL   R$ 3.508,44   R$ 0,00\n',
  });
  assert.equal(recibo.tipo, 'dctf-recibo');
  assert.equal(recibo.comp, '2026-04');
  assert.equal(recibo.saldo, 0);

  const guia = lerDocumento({
    nome: 'guia.pdf',
    categoria: 'fgts',
    texto:
      'GFD - Guia do FGTS Digital\nPagar este documento até\n17/06/2026\nValor a recolher\n3.861,16\n1   0126   00000000 04/2026 MENSAL\nCompetência   Trabalhadores\n04/2026   19   3.489,30   0,00   0,00   371,86   3.861,16\nTotal FGTS:   3.489,30   0,00   0,00   371,86   3.861,16\nTotal da Guia:   3.861,16\n',
  });
  assert.equal(guia.tipo, 'fgts-guia');
  assert.equal(guia.comp, '2026-04');
  assert.equal(guia.valor, 3861.16);
  assert.equal(guia.encargos, 371.86);
  assert.equal(guia.vencimento, '2026-06-17');

  // a data de pagamento vem do ID do Pix, não da data de impressão no alto da página
  const pix = lerDocumento({
    nome: 'Comprovante.pdf',
    categoria: 'fgts',
    texto:
      '26/08/2026\nComprovante de Transação Pix\nID da transação:   E0036030520260820190744ebe68856c\nSituação:   EFETIVADA   Data e Hora:\nValor Original:   R$ 4.754,78\nDetalhes:   FGTS MES 7\nDestino\nNome:   CAIXA ECONOMICA FEDERAL\n',
  });
  assert.equal(pix.tipo, 'fgts-pagamento');
  assert.equal(pix.pagoEm, '2026-08-20');
  assert.equal(pix.valor, 4754.78);
  assert.equal(pix.mesInformado, 7);

  const decl = lerDocumento({
    nome: 'Declaração de Demissão.pdf',
    categoria: 'declaracoes',
    compPasta: '2026-04',
    texto:
      'DECLARAÇÃO DE DEMISSÃO\nDeclaramos para os devidos fins que a EMPRESA EXEMPLO LTDA declara que houve demissões no mês de março, vinculado ao contrato nº 1, conforme relação abaixo:\nNome   CPF   Data\n',
  });
  assert.equal(decl.tipo, 'decl-demissoes');
  assert.equal(decl.mesDeclarado, '2026-03');
  assert.equal(decl.houve, true);
  const nao = lerDocumento({
    nome: 'Declaração de férias.pdf',
    categoria: 'declaracoes',
    compPasta: '2026-04',
    texto:
      'DECLARAÇÃO DE FÉRIAS\nDeclaramos para os devidos fins que a EMPRESA EXEMPLO LTDA declara que não houve profissionais em gozo de férias no mês de abril, vinculado ao contrato nº 1.\n',
  });
  assert.equal(nao.houve, false);
  assert.equal(nao.mesDeclarado, '2026-04');

  const cct = lerDocumento({
    nome: 'convencao.pdf',
    categoria: 'acordo',
    texto:
      'CONVENÇÃO COLETIVA DE TRABALHO 2026/2026\nCLÁUSULA PRIMEIRA - VIGÊNCIA E DATA-BASE\nAs partes fixam a vigência da presente Convenção Coletiva de Trabalho no período de 01º de janeiro de 2026 a 31 de dezembro de 2026 e a data-base em 01º de janeiro.',
  });
  assert.deepEqual(cct.vigencia, ['2026-01-01', '2026-12-31']);

  const folha = lerDocumento({
    nome: 'Folha de pagamento.pdf',
    categoria: 'fopag',
    texto: 'FOLHA DE PAGAMENTO ANALÍTICA\nRef.:   01/04/2026   a   30/04/2026\nResumo do Líquido',
  });
  assert.equal(folha.tipo, 'folha');
  assert.equal(folha.comp, '2026-04');
  // foto na pasta Ponto conta como ponto, para conferir visualmente
  assert.equal(lerDocumento({ nome: 'Fulano.jpeg', categoria: 'ponto' }).tipo, 'ponto');
});

test('salário pago a outra pessoa e planilha de força de trabalho', () => {
  assert.equal(pagoATerceiro('Andrea.pdf', 'ROBERTO DA SILVA'), true);
  assert.equal(pagoATerceiro('andre.pdf', 'ANDRE LUIS DE MELO'), false);
  assert.equal(pagoATerceiro('Walison.pdf', 'WALLISON MACHADO'), false);
  const fw = lerForcaDeTrabalho([
    ['Empresa', 'Contrato', 'Ano competência', 'Mês competência', 'Colaborador', 'Situação'],
    ['X', 1, 2026, 4, 'A B', 'A'],
    ['X', 1, 2026, 4, 'C D', 'A'],
    ['X', 1, 2026, 4, 'E F', 'I'],
  ]);
  assert.deepEqual(fw, { comp: '2026-04', ativos: 2, inativos: 1, linhas: 3 });
});

/** Um mês completo, como a leitura do Actions entrega */
function mesCompleto(comp) {
  const a = (tipo, extra = {}) => ({ rotulo: `${tipo}.pdf`, categoria: 'x', pasta: 'x', tipo, comp, ...extra });
  const decl = (tipo) => ({ rotulo: `${tipo}.pdf`, categoria: 'declaracoes', pasta: 'Declarações', tipo, mesDeclarado: comp, houve: false });
  return {
    comp,
    arquivos: [
      ...['decl-acidente', 'decl-admissoes', 'decl-demissoes', 'decl-transferencias', 'decl-ferias', 'decl-subcontratacao'].map(decl),
      a('folha'),
      a('comp-salarios'),
      a('ponto'),
      a('dctf-completa', { saldo: 0 }),
      a('dctf-recibo', { saldo: 0 }),
      a('dctf-debitos'),
      a('dctf-creditos'),
      a('fgts-guia', { valor: 100 }),
      a('fgts-detalhe'),
      a('fgts-pagamento', { valor: 100, situacao: 'efetivada' }),
      a('vavr-relacao'),
      a('vavr-guia'),
      a('vavr-pagamento'),
      { rotulo: 'vt.pdf', categoria: 'declaracoes', pasta: 'Declarações', tipo: 'vt-relacao', houve: false },
      a('forca'),
      { rotulo: 'cct.pdf', categoria: 'acordo', pasta: 'Acordo', tipo: 'convencao', vigencia: ['2026-01-01', '2026-12-31'] },
      a('crf', { validade: '2026-12-31' }),
      ...(Number(comp.slice(5)) % 2 === 0
        ? ['cert-federal', 'cert-estadual', 'cert-municipal', 'cndt', 'cert-falencia'].map((t) => a(t, { validade: '2026-12-31' }))
        : []),
    ],
  };
}

test('semáforo: pode pagar, não pagar ainda e travar', () => {
  const ok = avaliarMes(mesCompleto('2026-03'), { hoje: '2026-04-10' });
  assert.equal(ok.sinal, 'pagar', ok.pendencias.map((p) => p.id).join());
  // DARF não é cobrado quando a DCTFWeb não tem saldo a pagar; VT declarado como não aplicável
  assert.equal(ok.itens.find((i) => i.id === 'darf').status, 'na');
  assert.equal(ok.itens.find((i) => i.id === 'vt-guia').status, 'na');
  assert.equal(ok.itens.find((i) => i.id === 'convencao').status, 'ok');

  const semCrf = mesCompleto('2026-03');
  semCrf.arquivos = semCrf.arquivos.filter((a) => a.tipo !== 'crf');
  assert.equal(avaliarMes(semCrf, { hoje: '2026-04-10' }).sinal, 'aguardando');
  const travado = avaliarMes(semCrf, { hoje: '2026-05-02' });
  assert.equal(travado.sinal, 'travar');
  assert.equal(travado.certidoes.find((c) => c.id === 'crf').status, 'faltando');
  assert.ok(mensagemPendencias({ razao: 'Empresa Exemplo' }, travado).includes('Certificado de regularidade do FGTS'));

  // mês par: as cinco certidões também
  const par = mesCompleto('2026-04');
  par.arquivos = par.arquivos.filter((a) => a.tipo !== 'cndt');
  assert.equal(avaliarMes(par, { hoje: '2026-06-02' }).certidoes.find((c) => c.id === 'cndt').status, 'faltando');

  // a equipe marca "não se aplica" e o mês libera
  const liberado = avaliarMes(semCrf, { hoje: '2026-05-02', conf: { itens: { crf: { status: 'na' } } } });
  assert.equal(liberado.sinal, 'pagar');
  // recusado trava, com o motivo
  const recusa = avaliarMes(mesCompleto('2026-03'), {
    hoje: '2026-05-02',
    conf: { itens: { folha: { status: 'recusado', motivo: 'sem resumo por rubrica' } } },
  });
  assert.equal(recusa.sinal, 'travar');
  assert.equal(recusa.recusados[0].motivo, 'sem resumo por rubrica');
});

test('divergências, situações do mês e achados', () => {
  const m = mesCompleto('2026-04');
  const i = m.arquivos.findIndex((a) => a.tipo === 'decl-admissoes');
  m.arquivos[i] = { ...m.arquivos[i], mesDeclarado: '2026-03', houve: true };
  m.arquivos.push({ rotulo: 'guia.pdf', categoria: 'fgts', pasta: 'FGTS', tipo: 'fgts-guia', comp: '2026-04', valor: 100, encargos: 5 });
  const av = avaliarMes(m, { hoje: '2026-05-10' });
  assert.equal(av.itens.find((x) => x.id === 'decl-admissoes').status, 'divergencia');
  // a declaração diz que houve admissão: os documentos admissionais passam a ser cobrados
  assert.equal(av.situacoes.admissoes.valor, true);
  assert.equal(av.itens.find((x) => x.id === 'adm-aso').status, 'faltando');
  assert.equal(av.itens.find((x) => x.id === 'fer-aviso').status, 'na');
  assert.ok(av.achados.some((a) => /cita outro mês/.test(a.titulo)));
  assert.ok(av.achados.some((a) => /encargos/.test(a.titulo)));
  const pdf = blocosRelatorioMensal('Empresa Exemplo', av, { atualizadoEm: '2026-05-10' });
  assert.ok(pdf.some((b) => b.type === 'heading' && /Arquivos localizados/.test(b.text)));
});

test('meses da prestadora: antes do início, em curso e certidão a renovar', () => {
  const empresa = {
    meses: [
      { comp: '2026-01', arquivos: [] },
      { ...mesCompleto('2026-02') },
      { comp: '2026-03', arquivos: mesCompleto('2026-03').arquivos.filter((a) => a.tipo !== 'crf') },
      { comp: '2026-05', arquivos: [] },
    ],
  };
  // CNDT apresentada em fevereiro vencendo em março: renovar em março, mesmo sendo ímpar
  empresa.meses[1].arquivos = empresa.meses[1].arquivos.map((a) => (a.tipo === 'cndt' ? { ...a, validade: '2026-03-20' } : a));
  const avs = avaliarEmpresa(empresa, { hoje: '2026-05-15' });
  assert.deepEqual(
    avs.map((a) => [a.comp, a.sinal]),
    [
      ['2026-01', 'fora'],
      ['2026-02', 'pagar'],
      ['2026-03', 'travar'],
      ['2026-04', 'aguardando'],
      ['2026-05', 'futuro'],
    ],
  );
  assert.equal(avs[2].certidoes.find((c) => c.id === 'cndt').status, 'renovar');
});

test('cartilha do fornecedor no padrão da Ágil CM', () => {
  const b = blocosCartilha({ nome: 'Ágil CM', email: 'contato@agilcm.com.br' });
  const texto = JSON.stringify(b);
  assert.ok(!/energisa/i.test(texto));
  assert.ok(texto.includes('contato@agilcm.com.br'));
  assert.ok(texto.includes('último dia do mês seguinte'));
  assert.equal(b.filter((x) => x.type === 'para' && x.text === 'Representante legal da empresa').length, 8); // oito modelos de declaração
  assert.ok(!b.some((x) => x.type === 'signature')); // quem assina é a prestadora, não a Ágil CM
  const abas = abasForcaDeTrabalho({ nome: 'Ágil CM', cnpj: '00.000.000/0001-00' });
  assert.equal(abas[0].colunas.length, 21);
});
