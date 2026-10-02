/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Versão 2.11 no aplicativo (aparelhos e bloqueio) nas duas centrais: node testes/rodar-pedidos211.mjs [node|java] */
import { abrirNavegador } from './navegador.mjs';
import { novoGrupo, resumo } from './teste.mjs';
import { testarPedidos211 } from './pedidos211.mjs';
import { centralNode, centralJava } from './servidores.mjs';

const qual = process.argv[2];
const grupos = [];
const nav = await abrirNavegador();
try {
  for (const [nome, ligar, porta] of [['node', (p, d) => centralNode(p, d), 8165], ['java', centralJava, 8166]]) {
    if (qual && qual !== nome) continue;
    const g = novoGrupo('Versão 2.11 (aparelhos e bloqueio) na central ' + (nome === 'node' ? 'do computador' : 'do tablet chefe'));
    await testarPedidos211(nav, ligar, porta, g);
    grupos.push(g);
  }
} finally { await nav.fechar(); }
const r = resumo(grupos);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
