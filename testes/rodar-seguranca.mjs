/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Versão 2.11 direto nas duas centrais (bloqueio de aparelho e informações): node testes/rodar-seguranca.mjs [node|java] */
import { novoGrupo, resumo } from './teste.mjs';
import { testarSeguranca } from './seguranca.mjs';
import { centralNode, centralJava } from './servidores.mjs';

const qual = process.argv[2];
const grupos = [];
for (const [nome, ligar, porta] of [['node', (p, d, x) => centralNode(p, d, undefined, x), 8163], ['java', centralJava, 8164]]) {
  if (qual && qual !== nome) continue;
  const g = novoGrupo('Bloqueio e informações dos aparelhos na central ' + (nome === 'node' ? 'do computador' : 'do tablet chefe'));
  await testarSeguranca(ligar, porta, g);
  grupos.push(g);
}
const r = resumo(grupos);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
