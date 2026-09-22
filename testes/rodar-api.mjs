/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Roda os testes da central nas duas centrais: node testes/rodar-api.mjs [node|java] */
import { novoGrupo, resumo } from './teste.mjs';
import { testarApi } from './api.mjs';
import { centralNode, centralJava } from './servidores.mjs';

const qual = process.argv[2];
const grupos = [];
if (!qual || qual === 'node') {
  const c = await centralNode(8191);
  const g = novoGrupo('Central do computador (server.js)');
  try { await testarApi(c, g); } finally { await c.desligar(); }
  grupos.push(g);
}
if (!qual || qual === 'java') {
  const c = await centralJava(8192);
  const g = novoGrupo('Central do tablet chefe (ServidorCentral.java)');
  try { await testarApi(c, g); } finally { await c.desligar(); }
  grupos.push(g);
}
const r = resumo(grupos);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
