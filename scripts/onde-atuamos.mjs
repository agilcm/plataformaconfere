// Página pública "Onde já atuamos": monta o resumo (src/data/ondeAtuamos.json) a partir da leitura da área Privado
// (public/privado/leitura.json, gravada por scripts/privado-dados.mjs no mesmo build).
// Do resumo saem só dados públicos e sem valor: órgão, município, ano, modalidade, objeto e tipo de material.
// Se a leitura não existir ou vier vazia (Drive fora do ar), fica valendo o resumo que já está no repositório.
import fs from 'node:fs';
import { resumoAtuacao } from '../src/lib/ondeAtuamos.js';

const ENTRADA = process.env.PRIVADO_SAIDA || 'public/privado/leitura.json';
const SAIDA = 'src/data/ondeAtuamos.json';

let leitura = null;
try {
  leitura = JSON.parse(fs.readFileSync(ENTRADA, 'utf8'));
} catch {
  /* sem leitura: mantém o resumo atual */
}
const processos = leitura?.resultado?.processos || [];
const resumo = resumoAtuacao(processos, leitura?.atualizadoEm);
let atual = null;
try {
  atual = JSON.parse(fs.readFileSync(SAIDA, 'utf8'));
} catch {
  /* primeira vez */
}
// uma leitura muito menor que a anterior é sinal de falha na pasta, não de licitação perdida
if (!resumo.totais.processos || (atual && resumo.totais.processos < atual.totais.processos * 0.7)) {
  console.log(`Onde já atuamos: leitura com ${resumo.totais.processos} processo(s); mantido o resumo atual (${atual?.totais.processos ?? 0}).`);
} else {
  fs.writeFileSync(SAIDA, `${JSON.stringify(resumo, null, 1)}\n`);
  console.log(`Onde já atuamos: ${resumo.totais.processos} processos, ${resumo.totais.orgaos} órgãos, ${resumo.totais.municipios} municípios.`);
}
