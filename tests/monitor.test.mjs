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

test('alerta diário: mensagem por cidade, com prazo, motivo e link', async () => {
  const { mensagem } = await import('../scripts/alerta-diario.mjs');
  const e = { id: '1', municipio: 'Rodeiro', orgao: 'PREFEITURA DE RODEIRO', objeto: 'Aquisição de gêneros alimentícios', valor: 1000, propostasAte: '2026-11-12T09:00:00', link: 'https://pncp.gov.br/app/editais/1/2026/2', motivos: ['generos alimenticios'] };
  const m = mensagem([e], { hoje: new Date('2026-11-03T10:00:00Z') });
  assert.ok(m.includes('1 edital novo ligado'));
  assert.ok(m.includes('📍 <b>Rodeiro</b>'));
  assert.ok(m.includes('propostas até 12/11 às 09:00'));
  assert.ok(m.includes('<a href="https://pncp.gov.br/app/editais/1/2026/2">ver edital</a>'));
  assert.ok(mensagem([]).includes('Nenhum edital novo'));
});
