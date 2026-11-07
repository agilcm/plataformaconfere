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
  assert.deepEqual(fw, { comp: '2026-04', ativos: 2, inativos: 1, linhas: 3, admissoes: 0, demissoes: 0, afastados: 0 });
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
  assert.ok(av.achados.some((a) => /FGTS fora do prazo legal/.test(a.titulo) && /encargos/.test(a.texto)));
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

test('força de trabalho: movimento do mês e datas do Excel', async () => {
  const { dataCelula } = await import('../src/lib/docprefLeitor.js');
  assert.equal(dataCelula(46174), '2026-06-01'); // número de série do Excel
  assert.equal(dataCelula('16/06/2026'), '2026-06-16');
  assert.equal(dataCelula(''), null);
  const fw = lerForcaDeTrabalho([
    [
      'Empresa',
      'Ano competência',
      'Mês competência',
      'Nome do Colaborador',
      'Situação',
      'Data admissão',
      'Data alocação',
      'Data demissão',
      'Motivo do Afastamento',
    ],
    ['X', 2026, 6, 'A', 'A', '01/02/2023', '', '', ''],
    ['X', 2026, 6, 'B', 'A', 46189, '', '', ''], // admitida em 16/06/2026
    ['X', 2026, 6, 'C', 'I', '23/02/2026', '', '20/06/2026', ''],
    ['X', 2026, 6, 'D', 'I', '23/02/2026', '', '', 'Licença-maternidade'],
  ]);
  assert.deepEqual(fw, { comp: '2026-06', ativos: 2, inativos: 2, linhas: 4, admissoes: 1, demissoes: 1, afastados: 1 });
});

test('a planilha de força de trabalho também responde se houve admissão ou demissão', () => {
  const m = mesCompleto('2026-06');
  m.arquivos = m.arquivos.map((a) => (a.tipo === 'forca' ? { ...a, ativos: 20, admissoes: 2, demissoes: 0 } : a));
  const av = avaliarMes(m, { hoje: '2026-08-02' });
  assert.equal(av.situacoes.admissoes.valor, true);
  assert.match(av.situacoes.admissoes.fonte, /planilha/);
  assert.equal(av.situacoes.admissoes.contraditorio, true); // a declaração dizia que não houve
  assert.ok(av.achados.some((a) => /não batem/.test(a.titulo)));
  assert.equal(av.indicadores.turnover, 5); // ((2 + 0) / 2) / 20
  assert.equal(av.itens.find((i) => i.id === 'adm-aso').status, 'faltando');
});

test('vencimentos, regularidade e planilhas do Excel', async () => {
  const { vencimentos, performance, abasAno, abasMes, abasFarol } = await import('../src/lib/docpref.js');
  const empresa = {
    meses: [
      { comp: '2026-02', arquivos: [{ tipo: 'cndt', validade: '2026-03-20' }, { tipo: 'crf', validade: '2026-12-01' }, { tipo: 'pgr' }] },
      { comp: '2026-03', arquivos: [{ tipo: 'cert-federal', validade: '2026-04-10' }] },
    ],
  };
  const v = vencimentos(empresa, { hoje: '2026-04-01' });
  const st = Object.fromEntries(v.map((x) => [x.id, x.status]));
  assert.equal(st.cndt, 'vencido');
  assert.equal(st['cert-federal'], 'a-vencer');
  assert.equal(st.crf, 'valido');
  assert.equal(st.pgr, 'sem-validade');
  assert.equal(st['cert-estadual'], 'nunca');
  assert.equal(v[0].status, 'vencido'); // vencidos primeiro

  const avs = avaliarEmpresa({ meses: [mesCompleto('2026-02'), { comp: '2026-03', arquivos: [] }] }, { hoje: '2026-05-10' });
  assert.equal(avs[0].regularidade, 100);
  assert.ok(avs[1].regularidade < 20);
  const p = performance(avs);
  assert.equal(p.meses, 2);
  assert.equal(p.travados, 1);
  assert.ok(p.regularidade > 40 && p.regularidade < 60);

  const ano = abasAno('Empresa Exemplo', '2026', avs);
  assert.deepEqual(
    ano.map((a) => a.nome),
    ['Meses', 'Cobranças', 'Achados'],
  );
  assert.ok(ano[0].linhas.every((l) => l.length === ano[0].colunas.length));
  assert.ok(abasMes(avs[1])[0].linhas.length > 20);
  const farol = abasFarol([{ nome: 'Empresa Exemplo', avs, venc: v }], ['2026-02', '2026-03']);
  assert.equal(farol[0].linhas[0][1], 'Pode pagar (100%)');
});

test('organização da pasta: várias prestadoras, pastas de ano, documentos da empresa e pastas ignoradas', async () => {
  const { organizarPasta, PASTA_MIME } = await import('../src/lib/docprefLeitor.js');
  const pasta = (name, filhos = []) => ({ name, mimeType: PASTA_MIME, filhos });
  const arq = (name) => ({ id: name, name, mimeType: 'application/pdf' });
  const raiz = pasta('Documentos - Analise Documental', [
    pasta('Empresa A', [
      pasta('Documentos', [arq('Relatorio_Geral_Agil_A_2026.pdf'), pasta('03-2026', [arq('Relatorio_Agil_A_03_2026.pdf'), pasta('FGTS', [arq('guia.pdf')])])]),
      arq('PGR 2026.pdf'),
    ]),
    pasta('Empresa B', [
      pasta('2026', [pasta('04 - Abril', [pasta('Admissão-alocação', [pasta('Fulano', [arq('aso.pdf')]), pasta('Beltrano')]), arq('FORÇA DE TRABALHO.xlsx')])]),
      pasta('Documentos da empresa', [arq('Contrato social.pdf')]),
    ]),
    pasta('Modelos', [arq('modelo.pdf')]),
    arq('leia-me.pdf'),
  ]);
  const org = organizarPasta(raiz);
  assert.deepEqual(
    org.empresas.map((e) => e.nome),
    ['Empresa A', 'Empresa B'],
  );
  assert.deepEqual(org.ignoradas, ['Modelos']);
  assert.deepEqual(org.soltosRaiz, ['leia-me.pdf']);
  const [a, b] = org.empresas;
  assert.deepEqual(
    a.meses.map((m) => m.comp),
    ['2026-03'],
  );
  assert.deepEqual(
    a.meses[0].arquivos.map((x) => [x.f.name, x.categoria]),
    [['guia.pdf', 'fgts']],
  ); // os relatórios da própria análise ficam de fora
  assert.deepEqual(
    a.documentos.map((x) => x.f.name),
    ['PGR 2026.pdf'],
  );
  assert.equal(b.meses[0].comp, '2026-04');
  assert.equal(b.meses[0].pessoas.admissao, 2); // duas subpastas de pessoas
  assert.deepEqual(
    b.meses[0].arquivos.map((x) => [x.f.name, x.categoria, x.pessoa]),
    [
      ['aso.pdf', 'admissao', true],
      ['FORÇA DE TRABALHO.xlsx', 'raiz', false],
    ],
  );
  assert.deepEqual(
    b.documentos.map((x) => [x.f.name, x.nomeCategoria]),
    [['Contrato social.pdf', 'Documentos da empresa']],
  );
  // uma prestadora só: a raiz já tem as pastas dos meses
  const unica = organizarPasta(pasta('Pilar', [pasta('05-2026', [arq('x.pdf')])]));
  assert.deepEqual(
    unica.empresas.map((e) => [e.nome, e.meses.length]),
    [['Pilar', 1]],
  );
});

test('prazos legais: 5º dia útil, DCTFWeb dia 15, FGTS e INSS dia 20 (antecipados)', async () => {
  const { quintoDiaUtil, vencimentoLegal, feriadosNacionais, prazosLegais } = await import('../src/lib/docpref.js');
  assert.ok(feriadosNacionais(2026).has('2026-02-17')); // Carnaval
  assert.ok(feriadosNacionais(2026).has('2026-04-03')); // Sexta-feira Santa
  assert.ok(feriadosNacionais(2026).has('2026-06-04')); // Corpus Christi
  assert.equal(quintoDiaUtil('2026-04'), '2026-05-08'); // 1º de maio é feriado
  assert.equal(quintoDiaUtil('2026-07'), '2026-08-07');
  assert.equal(vencimentoLegal('2026-05', 20), '2026-06-19'); // 20/06/2026 é sábado: antecipa
  assert.equal(vencimentoLegal('2026-03', 15), '2026-04-15');
  const p = prazosLegais('2026-04', [
    { tipo: 'comp-salarios', pagoEm: '2026-05-07' },
    { tipo: 'comp-salarios', pagoEm: '2026-05-11' },
    { tipo: 'dctf-completa', comp: '2026-04', transmissao: '2026-06-08', retificadora: true },
    { tipo: 'fgts-guia', comp: '2026-04', vencimento: '2026-06-17', valor: 100, encargos: 9 },
    { tipo: 'fgts-pagamento', pagoEm: '2026-06-17', valor: 100 },
  ]);
  const por = Object.fromEntries(p.map((x) => [x.id, x]));
  assert.equal(por.salario.situacao, 'atraso');
  assert.match(por.salario.texto, /1 pagamento depois do 5º dia útil \(08\/05\/2026\)/);
  assert.equal(por.dctfweb.situacao, 'retificadora');
  assert.equal(por.fgts.situacao, 'atraso');
  assert.match(por.fgts.texto, /20\/05\/2026.*17\/06\/2026.*encargos/);
});

test('comprovante sem competência ligado à guia pelo valor e pessoas do mês', async () => {
  const { vincularPorValor, coberturaDoMes } = await import('../src/lib/docpref.js');
  const v = vincularPorValor([
    { tipo: 'fgts-guia', comp: '2026-04', valor: 3861.16 },
    { tipo: 'fgts-pagamento', valor: 3861.16 },
    { tipo: 'vavr-guia', valor: 50 },
    { tipo: 'vavr-pagamento', valor: 50 },
  ]);
  assert.equal(v[1].comp, '2026-04');
  assert.match(v[1].vinculo, /Mesmo valor da guia FGTS de 04\/2026/);
  assert.ok(v[2].vinculado && v[3].vinculado);
  const m = mesCompleto('2026-04');
  m.arquivos = m.arquivos.filter((a) => a.tipo !== 'fgts-pagamento').concat({ rotulo: 'pix.pdf', categoria: 'fgts', tipo: 'fgts-pagamento', valor: 100 });
  assert.equal(avaliarMes(m, { hoje: '2026-05-10' }).itens.find((i) => i.id === 'fgts-pagamento').status, 'ok');

  const c = coberturaDoMes(
    [
      { tipo: 'forca', ativos: 19, afastados: 1, admissoes: 1, demissoes: 1 },
      { tipo: 'comp-salarios' },
      { tipo: 'comp-salarios', lote: 9 },
      { tipo: 'ponto' },
      { tipo: 'ponto' },
      { tipo: 'decl-admissoes', houve: true, pessoas: 1 },
      { tipo: 'decl-demissoes', houve: false },
    ],
    { admissao: 1 },
  );
  assert.equal(c.devidos, 18);
  assert.equal(c.pagamentos, 10);
  assert.equal(c.ponto, 2);
  assert.deepEqual(c.admissoes, { planilha: 1, declaracao: 1, pastas: 1 });
  assert.deepEqual(c.demissoes, { planilha: 1, declaracao: 0, pastas: null }); // sem subpastas de pessoas: não entra na conta

  const mes = mesCompleto('2026-04');
  mes.arquivos = mes.arquivos.map((a) => (a.tipo === 'forca' ? { ...a, ativos: 19, demissoes: 1 } : a));
  const av = avaliarMes(mes, { hoje: '2026-05-10' });
  assert.ok(av.achados.some((x) => x.titulo === 'Comprovantes de salário não cobrem todos'));
  assert.ok(av.achados.some((x) => x.titulo === 'Desligamentos não batem'));
});

test('OCR e texto primeiro: comunicado de término, notificação de férias, declaração do banco e ponto com período', () => {
  const aviso = lerDocumento({
    nome: 'rescisão fulano.pdf',
    categoria: 'demissao',
    ocr: true,
    texto:
      'COMUNICADO\nComunicamos que o contrato de trabalho de Experiência, firmado por ambas as partes, fica rompido uma vez que não existe interesse desta empresa em continuá-lo.\nTERMO DE RESCISÃO DO CONTRATO DE TRABALHO\nVerbas rescisórias',
  });
  assert.equal(aviso.tipo, 'dem-trct');
  assert.deepEqual(aviso.tambem, ['dem-aviso']); // o PDF junta os dois documentos
  assert.equal(aviso.ocr, true);
  const so = lerDocumento({
    nome: 'rescisão fulano.pdf',
    categoria: 'demissao',
    texto: 'COMUNICADO\nComunicamos que o contrato de trabalho de experiência fica rompido, não existe interesse desta empresa em continuá-lo.',
  });
  assert.equal(so.tipo, 'dem-aviso'); // o nome diz "rescisão", mas o texto é o aviso
  const ferias = lerDocumento({
    nome: 'Ferias X.pdf',
    categoria: 'ferias',
    texto: 'NOTIFICAÇÃO DE FÉRIAS\nEmpresa: EXEMPLO LTDA\nPeríodo a ser gozado 18/05/2026 a 16/06/2026',
  });
  assert.equal(ferias.tipo, 'fer-aviso');
  const banco = lerDocumento({
    nome: 'Declaracao Caixa.pdf',
    categoria: 'fopag',
    texto:
      'CAIXA\nDECLARAÇÃO DE PAGAMENTO\nDeclaramos, para os devidos fins, que os pagamentos constantes na listagem foram devidamente processados e creditados pela CAIXA ECONÔMICA FEDERAL.\nCataguases/MG, 13 de março de 2026.',
  });
  assert.equal(banco.tipo, 'comp-salarios');
  assert.equal(banco.declaracaoBanco, true);
  assert.equal(banco.emitidaEm, '2026-03-13');
  const ponto = lerDocumento({
    nome: 'Folha de Ponto.pdf',
    categoria: 'ponto',
    texto: 'Folha de Ponto\nEXEMPLO LTDA\nPeríodo de 01/02/2026 a 28/02/2026\nEntrada 08:30',
  });
  assert.equal(ponto.comp, '2026-02');
  const cred = lerDocumento({
    nome: 'ResumoCreditos_x.pdf',
    categoria: 'inss',
    texto:
      'RELATÓRIO RESUMO DE CRÉDITOS - DCTFWeb\nPeríodo de Apuração   04/2026\nDescrição   Valor Informado/Importado   Valor Vinculado a Débito   Saldo disponível\nRetenção Lei 9711/98 ou\n6.741,91   3.508,44   3.233,47\nadiantamento de retenção',
  });
  assert.deepEqual(cred.retencao, { informada: 6741.91, usada: 3508.44, saldo: 3233.47 });
});

test('folha: total líquido de todos os departamentos × soma dos comprovantes', async () => {
  const { totaisDaFolha } = await import('../src/lib/docprefLeitor.js');
  const texto =
    'Resumo da Folha\nTotal Geral da Folha   15.524,01   Total Funcionários ......................   7\n( = ) Total Líquido   13.460,00\n' +
    '(=) Total Líqüido ..........................: *****************************\n' +
    'Resumo da Folha\nTotal Geral da Folha   23.182,75   Total Funcionários ......................   9\n( = ) Total Líquido   20.734,00\n' +
    'Resumo da Folha\nTotal Geral da Folha   8.183,73   Total Funcionários ......................   3\n( = ) Total Líquido   7.076,00\n';
  assert.deepEqual(totaisDaFolha(texto), { liquido: 41270, funcionarios: 19 });
  // com um bloco final de total geral (igual à soma dos anteriores), usa só ele
  assert.deepEqual(totaisDaFolha(`${texto}( = ) Total Líquido   41.270,00\nTotal Funcionários ... 19`), { liquido: 41270, funcionarios: 19 });

  const { pagamentosDoMes } = await import('../src/lib/docpref.js');
  const base = [
    { tipo: 'folha', liquido: 47632.77 },
    { tipo: 'comp-salarios', valor: 24099, lote: 11 },
    { tipo: 'comp-salarios', valor: 17696 },
    { tipo: 'comp-salarios', declaracaoBanco: true, emitidaEm: '2026-03-13' },
    { tipo: 'fgts-guia', comp: '2026-07', valor: 4754.78 },
    { tipo: 'fgts-pagamento', valor: 4754.78, pagoEm: '2026-08-20' },
    { tipo: 'vavr-guia', valor: 100 },
  ];
  const pg = Object.fromEntries(pagamentosDoMes(base, { darfDevido: false, situacoes: { demissoes: { valor: true } } }).map((x) => [x.id, x]));
  assert.equal(pg.salarios.situacao, 'falta');
  assert.match(pg.salarios.texto, /faltam R\$ 5\.837,77/);
  assert.equal(pg.fgts.situacao, 'pago');
  assert.equal(pg.inss.situacao, 'nao-devido');
  assert.equal(pg.vavr.situacao, 'sem-comprovante');
  assert.match(pg.vavr.texto, /colocar o comprovante do banco/);
  assert.equal(pg.vt.situacao, 'sem-documentos');
  assert.equal(pg.rescisoes.situacao, 'sem-comprovante');
});

test('relatório rápido em itens a), b), c) e "não se aplica nesta prestadora"', async () => {
  const { relatorioRapido, pendenciasSinteticas, FUNDAMENTO_LEGAL, blocosNotificacao, mensagemPendencias } = await import('../src/lib/docpref.js');
  const m = mesCompleto('2026-03');
  m.arquivos = m.arquivos.filter((a) => !['crf', 'fgts-pagamento', 'folha'].includes(a.tipo));
  const i = m.arquivos.findIndex((a) => a.tipo === 'decl-ferias');
  m.arquivos[i] = { ...m.arquivos[i], mesDeclarado: '2026-02' };
  const av = avaliarMes(m, { hoje: '2026-05-02' });
  const itens = pendenciasSinteticas(av);
  assert.ok(itens.includes('FOPAG e Comp. de Pgto: folha analítica'));
  assert.ok(itens.includes('FGTS: comprovante'));
  assert.ok(itens.includes('Certidões: CRF'));
  assert.ok(itens.some((t) => t.startsWith('Divergência em férias: traz 02/2026')));
  const r = relatorioRapido([{ nome: 'Empresa Exemplo', avs: [av], venc: [] }], { contratante: 'Prefeitura de Exemplo', hoje: '2026-05-02' });
  assert.match(r.texto, /03\/2026 · Travar pagamento/);
  assert.match(r.texto, /\na\) /);
  assert.match(r.texto, /Contratante: Prefeitura de Exemplo/);
  assert.ok(r.blocos.length > 4);

  // VT não se aplica a esta prestadora: some de todos os meses
  const semVt = mesCompleto('2026-03');
  semVt.arquivos = semVt.arquivos.filter((a) => a.tipo !== 'vt-relacao');
  assert.equal(avaliarMes(semVt, { hoje: '2026-04-10' }).itens.find((x) => x.id === 'vt-guia').status, 'faltando');
  const ajustado = avaliarMes(semVt, { hoje: '2026-04-10', naoAplica: ['vt-relacao', 'vt-guia', 'vt-pagamento'] });
  assert.equal(ajustado.itens.find((x) => x.id === 'vt-guia').status, 'na');
  assert.equal(ajustado.sinal, 'pagar');

  // notificação com o contratante, o fundamento legal e o prazo para regularizar
  const n = blocosNotificacao({ razao: 'Empresa Exemplo LTDA' }, av, { contratante: 'Prefeitura de Exemplo', prazoRegularizacao: 5, fiscal: 'Fulano' });
  const tn = JSON.stringify(n);
  assert.ok(tn.includes('Contratante: Prefeitura de Exemplo') && tn.includes('5 (cinco) dias úteis') && tn.includes('14.133/2021'));
  assert.ok(mensagemPendencias({ razao: 'Empresa Exemplo' }, av, { prazoRegularizacao: 5 }).includes(FUNDAMENTO_LEGAL));
});

test('modelos para baixar: arquivos no site, declarações sem escolha e "não se aplica"', async () => {
  const fs = await import('node:fs');
  const { MODELOS } = await import('../src/lib/docprefCartilha.js');
  for (const m of MODELOS) assert.ok(fs.existsSync(new URL(`../public/docpref/modelos/${m.arquivo}`, import.meta.url)), m.arquivo);
  assert.ok(fs.existsSync(new URL('../public/docpref/modelos/modelos-docpref.zip', import.meta.url)));

  // "houve / não houve" sem apagar a opção: não dá para saber; a declaração volta como divergência
  const sem = lerDocumento({
    nome: 'Declaração de acidente.pdf',
    categoria: 'declaracoes',
    compPasta: '2026-07',
    texto:
      'DECLARAÇÃO DE REGISTRO DE ACIDENTE DE TRABALHO\nDeclaramos para os devidos fins, que EXEMPLO LTDA, declara que houve / não houve acidente de trabalho no mês de julho, vinculado ao contrato nº 1.',
  });
  assert.equal(sem.houve, null);
  assert.equal(sem.semEscolha, true);
  const m = mesCompleto('2026-07');
  m.arquivos = m.arquivos.map((a) => (a.tipo === 'decl-acidente' ? { ...a, semEscolha: true, houve: null } : a));
  assert.equal(avaliarMes(m, { hoje: '2026-08-10' }).itens.find((i) => i.id === 'decl-acidente').status, 'divergencia');

  // declaração de não fornecimento de VT: "não se aplica" = não houve, e o grupo VT deixa de ser cobrado
  const vt = lerDocumento({
    nome: 'declaracao-nao-aplicacao-vt.pdf',
    categoria: 'declaracoes',
    compPasta: '2026-07',
    texto:
      'DECLARAÇÃO DE NÃO FORNECIMENTO DE VALE-TRANSPORTE\nDeclaramos para os devidos fins, que EXEMPLO LTDA, declara que, no mês de julho, não se aplica o vale-transporte aos empregados do contrato nº 1.',
  });
  assert.equal(vt.tipo, 'vt-relacao');
  assert.equal(vt.houve, false);
  assert.equal(vt.mesDeclarado, '2026-07');
  // subcontratação escreve "na competência 07/2026"
  const sub = lerDocumento({
    nome: 'Declaração de subcontratação.pdf',
    categoria: 'declaracoes',
    compPasta: '2026-07',
    texto: 'DECLARAÇÃO DE SUBCONTRATAÇÃO\nDeclaramos para os devidos fins, que EXEMPLO LTDA, que na competência 07/2026 não houve subcontratação de empresas.',
  });
  assert.equal(sub.tipo, 'decl-subcontratacao');
  assert.equal(sub.mesDeclarado, '2026-07');
  assert.equal(sub.houve, false);
  // mobilização: "houve / haverá" é sempre mobilização
  const mob = lerDocumento({
    nome: 'Declaração de mobilização.pdf',
    categoria: 'mobilizacao',
    texto: 'DECLARAÇÃO DE MOBILIZAÇÃO DO CONTRATO\nDeclaramos que haverá mobilização no contrato de nº 1, a partir do dia 01/03/2026.',
  });
  assert.equal(mob.tipo, 'decl-mobilizacao');
  assert.equal(mob.houve, true);
});
