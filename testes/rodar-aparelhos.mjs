/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Aparelhos virtuais usando o aplicativo, nas duas centrais: node testes/rodar-aparelhos.mjs [node|java] */
import { abrirNavegador } from './navegador.mjs';
import { novoGrupo, resumo } from './teste.mjs';
import { testarAparelhos } from './aparelhos.mjs';
import { centralNode, centralJava } from './servidores.mjs';

const qual = process.argv[2];
const grupos = [];
const nav = await abrirNavegador();
try {
  if (!qual || qual === 'node') {
    const c = await centralNode(8193);
    const g = novoGrupo('Aparelhos na central do computador');
    try { await testarAparelhos(nav, c, g); } finally { await c.desligar(); }
    grupos.push(g);
  }
  if (!qual || qual === 'java') {
    const c = await centralJava(8194);
    const g = novoGrupo('Aparelhos na central do tablet chefe');
    try { await testarAparelhos(nav, c, g); } finally { await c.desligar(); }
    grupos.push(g);
  }
} finally { await nav.fechar(); }
const r = resumo(grupos);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
