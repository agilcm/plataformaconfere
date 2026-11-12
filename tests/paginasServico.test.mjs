import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGINAS_SERVICO, paginaServico } from '../src/data/paginasServico.ts';
import { CONTACT_OPTIONS } from '../src/data/servicesData.ts';

test('páginas de serviço: título, descrição e endereço prontos para o Google', () => {
  const slugs = PAGINAS_SERVICO.map((p) => p.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'endereços sem repetição');
  assert.equal(new Set(PAGINAS_SERVICO.map((p) => p.title)).size, slugs.length, 'títulos sem repetição');
  assert.equal(new Set(PAGINAS_SERVICO.map((p) => p.description)).size, slugs.length, 'descrições sem repetição');
  for (const p of PAGINAS_SERVICO) {
    assert.match(p.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, p.slug);
    assert.ok(p.title.length <= 60, `${p.slug}: título com ${p.title.length} caracteres`);
    assert.ok(p.title.endsWith('| Ágil CM'), p.slug);
    assert.ok(p.description.length >= 110 && p.description.length <= 155, `${p.slug}: descrição com ${p.description.length} caracteres`);
    assert.match(p.atualizado, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(p.blocos.length >= 3 && p.faq.length >= 2, `${p.slug}: conteúdo e perguntas`);
    assert.ok(
      CONTACT_OPTIONS.some((o) => o.value === p.contato),
      `${p.slug}: opção do formulário de contato`,
    );
    assert.equal(new Set(p.blocos.map((b) => b.titulo)).size, p.blocos.length, `${p.slug}: títulos de bloco sem repetição`);
  }
});

test('páginas de serviço: todo link interno aponta para uma página que existe', () => {
  const links = [];
  for (const p of PAGINAS_SERVICO) {
    for (const r of p.relacionados) {
      assert.ok(paginaServico(r), `${p.slug}: "veja também" ${r}`);
      assert.notEqual(r, p.slug, `${p.slug} não aponta para si mesma`);
    }
    if (p.acao) links.push([p.slug, p.acao.href]);
    for (const b of p.blocos) {
      if (b.tipo === 'destaque' && b.link) links.push([p.slug, b.link.href]);
      if (b.tipo === 'cards') for (const i of b.itens) if (i.href) links.push([p.slug, i.href]);
      if (b.tipo === 'lista') for (const i of b.itens) if (typeof i !== 'string') links.push([p.slug, i.href]);
    }
  }
  assert.ok(links.length >= 8);
  for (const [slug, href] of links) {
    if (href.startsWith('servico:')) assert.ok(paginaServico(href.slice(8)), `${slug}: ${href}`);
    else assert.match(href, /^(rota:licitacoes|home:#[a-z-]+)$/, `${slug}: ${href}`);
  }
});
