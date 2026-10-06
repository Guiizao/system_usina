/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Versão 2.12 no aplicativo (configurações do sistema) nas duas centrais: node testes/rodar-pedidos212.mjs [node|java] */
import { abrirNavegador } from './navegador.mjs';
import { novoGrupo, resumo } from './teste.mjs';
import { testarPedidos212 } from './pedidos212.mjs';
import { centralNode, centralJava } from './servidores.mjs';

const qual = process.argv[2];
const grupos = [];
const nav = await abrirNavegador();
try {
  for (const [nome, ligar, porta] of [['node', (p, d) => centralNode(p, d), 8181], ['java', centralJava, 8182]]) {
    if (qual && qual !== nome) continue;
    const g = novoGrupo('Versão 2.12 (configurações do sistema) na central ' + (nome === 'node' ? 'do computador' : 'do tablet chefe'));
    await testarPedidos212(nav, ligar, porta, g, nome === 'node');
    grupos.push(g);
  }
} finally { await nav.fechar(); }
const r = resumo(grupos);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
