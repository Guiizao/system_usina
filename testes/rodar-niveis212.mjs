/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Versão 2.12 direto nas duas centrais (níveis do tablet chefe, dono e o que a central aceita): node testes/rodar-niveis212.mjs [node|java] */
import { novoGrupo, resumo } from './teste.mjs';
import { testarNiveis } from './niveis212.mjs';
import { centralNode, centralJava } from './servidores.mjs';

const qual = process.argv[2];
const grupos = [];
for (const [nome, ligar, porta] of [['node', (p, d, x) => centralNode(p, d, undefined, x), 8167], ['java', centralJava, 8168]]) {
  if (qual && qual !== nome) continue;
  const g = novoGrupo('Níveis do tablet chefe e permissões na central ' + (nome === 'node' ? 'do computador' : 'do tablet chefe'));
  await testarNiveis(ligar, porta, g);
  grupos.push(g);
}
const r = resumo(grupos);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
