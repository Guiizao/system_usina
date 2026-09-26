/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Volume de vinho e dornas de fermentação (versão 2.6) nas duas centrais: node testes/rodar-pedidos26.mjs [node|java] */
import { abrirNavegador } from './navegador.mjs';
import { novoGrupo, resumo } from './teste.mjs';
import { testarPedidos26 } from './pedidos26.mjs';
import { centralNode, centralJava } from './servidores.mjs';

const qual = process.argv[2];
const grupos = [];
const nav = await abrirNavegador();
try {
  for (const [nome, ligar, porta] of [['node', centralNode, 8153], ['java', centralJava, 8154]]) {
    if (qual && qual !== nome) continue;
    const g = novoGrupo('Volume de vinho e fermentação na central ' + (nome === 'node' ? 'do computador' : 'do tablet chefe'));
    await testarPedidos26(nav, ligar, porta, g);
    grupos.push(g);
  }
} finally { await nav.fechar(); }
const r = resumo(grupos);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
