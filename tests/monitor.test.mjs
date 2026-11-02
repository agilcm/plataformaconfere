import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compararCompra, lerLinha } from '../scripts/monitor-pregoes.mjs';

test('monitor: aceita link do PNCP, número de controle e CNPJ/ANO/SEQ, com apelido', () => {
  assert.deepEqual(lerLinha('https://pncp.gov.br/app/editais/18338178000102/2026/15 Ubá merenda'), { ref: { cnpj: '18338178000102', ano: '2026', seq: '15' }, apelido: 'Ubá merenda' });
  assert.deepEqual(lerLinha('18338178000102-1-000015/2026').ref, { cnpj: '18338178000102', ano: '2026', seq: '15' });
  assert.deepEqual(lerLinha('18338178000102/2026/15').ref, { cnpj: '18338178000102', ano: '2026', seq: '15' });
  assert.equal(lerLinha('# comentário'), null);
  assert.ok(lerLinha('qualquer coisa').erro);
});

test('monitor: avisa mudança de situação, resultado (destacando a AGIL) e documento novo, uma vez só', () => {
  const antes = { situacao: 'Divulgada no PNCP', itens: { 1: { situacao: 'Em andamento', resultados: [] }, 2: { situacao: 'Em andamento', resultados: [] } }, arquivos: ['u1'] };
  const agora = {
    situacao: 'Suspensa',
    itens: [
      { numero: 1, descricao: 'TONER HP', situacao: 'Homologado', resultados: [{ fornecedor: 'AGIL CM', fornecedorDoc: '51328978000118', quantidade: 10, valorUnitario: 50, valorTotal: 500 }] },
      { numero: 2, descricao: 'PAPEL A4', situacao: 'Homologado', resultados: [{ fornecedor: 'OUTRA LTDA', fornecedorDoc: '11222333000181', valorTotal: 90 }] },
    ],
    arquivos: [{ url: 'u1', tipo: 'Edital', titulo: 'edital.pdf' }, { url: 'u2', tipo: 'Outros Documentos', titulo: 'Esclarecimento_01.pdf' }],
  };
  const avisos = compararCompra(antes, agora);
  assert.equal(avisos.length, 6);
  assert.match(avisos[0], /Divulgada no PNCP → <b>Suspensa/);
  assert.ok(avisos.some((a) => /AGIL venceu<\/b> item 1/.test(a) && /R\$ 500,00/.test(a)));
  assert.ok(avisos.some((a) => /Resultado item 2.*OUTRA LTDA/.test(a)));
  assert.ok(avisos.some((a) => /⚠️ <b>Documento novo<\/b>: Outros Documentos: Esclarecimento/.test(a)));
  const primeira = compararCompra(null, agora);
  assert.equal(primeira.length, 1);
  assert.match(primeira[0], /Começando a monitorar/);
});

test('alerta diário: Zona da Mata repete até o pregão (🆕 nos novos) e Minas mostra só os novos', async () => {
  const { mensagem } = await import('../scripts/alerta-diario.mjs');
  const ed = (id, municipio, propostasAte) => ({ id, municipio, orgao: 'PREFEITURA', objeto: `Gêneros alimentícios ${id}`, valor: 1000, propostasAte, link: `https://pncp.gov.br/app/editais/${id}`, motivos: ['generos alimenticios'] });
  const hoje = new Date('2026-11-03T10:00:00Z'); // 7h em Brasília
  const m = mensagem({
    zm: [ed('a', 'Rodeiro', '2026-11-10T09:00:00'), ed('b', 'Ubá', '2026-11-04T09:00:00'), ed('c', 'Cataguases', '2026-11-01T09:00:00')],
    novosZm: new Set(['a']),
    mg: [ed('d', 'Varginha', '2026-11-20T09:00:00')],
    hoje,
  });
  const zm = m.slice(0, m.indexOf('MINAS GERAIS'));
  assert.ok(zm.includes('ZONA DA MATA</b> · 2 editais abertos (1 novo 🆕)'));
  assert.ok(zm.indexOf('Ubá') < zm.indexOf('Rodeiro'), 'prazo mais próximo primeiro');
  assert.ok(zm.includes('🆕 <b>Rodeiro</b>'));
  assert.ok(zm.includes('⏰ <b>amanhã</b>'));
  assert.ok(!zm.includes('Cataguases'), 'pregão que já passou sai da lista');
  assert.ok(m.slice(m.indexOf('MINAS GERAIS')).includes('<b>Varginha</b>'));
  assert.ok(mensagem({ zm: [], mg: null, hoje }).includes('O PNCP não respondeu para Minas Gerais'));
});
