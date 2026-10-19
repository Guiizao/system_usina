/* Produção 2.15 nas duas centrais, somente com dados temporários. */
import { novoGrupo, resumo } from './teste.mjs';
import { testarProducao } from './producao215.mjs';
import { centralNode, centralJava } from './servidores.mjs';

const grupos = [];
for (const [nome, ligar, porta] of [['node', (p, d) => centralNode(p, d), 18185], ['java', centralJava, 18186]]) {
  if (process.argv[2] && process.argv[2] !== nome) continue;
  const g = novoGrupo('Produção 2.15 — ' + nome);
  await testarProducao(ligar, porta, g);
  grupos.push(g);
}
const r = resumo(grupos);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
