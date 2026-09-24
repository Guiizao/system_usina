/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Pedidos do teste de 24/09 nas duas centrais: node testes/rodar-pedidos24.mjs [node|java] */
import { abrirNavegador } from './navegador.mjs';
import { novoGrupo, resumo } from './teste.mjs';
import { testarPedidos24 } from './pedidos24.mjs';
import { centralNode, centralJava } from './servidores.mjs';

const qual = process.argv[2];
const grupos = [];
const nav = await abrirNavegador();
try {
  for (const [nome, ligar, porta] of [['node', centralNode, 8177], ['java', centralJava, 8178]]) {
    if (qual && qual !== nome) continue;
    const g = novoGrupo('Pedidos de 24/09 na central ' + (nome === 'node' ? 'do computador' : 'do tablet chefe'));
    await testarPedidos24(nav, ligar, porta, g);
    grupos.push(g);
  }
} finally { await nav.fechar(); }
const r = resumo(grupos);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
