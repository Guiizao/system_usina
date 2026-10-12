import { novoGrupo, resumo } from './teste.mjs';
import { testarEscritorio } from './escritorio213.mjs';
import { centralNode, centralJava } from './servidores.mjs';

const grupos = [];
for (const [nome, ligar, porta] of [['node', centralNode, 8171], ['java', centralJava, 8172]]) {
  if (process.argv[2] && process.argv[2] !== nome) continue;
  const g = novoGrupo('Escritório 2.13 — ' + nome);
  await testarEscritorio(ligar, porta, g);
  grupos.push(g);
}
const r = resumo(grupos);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
