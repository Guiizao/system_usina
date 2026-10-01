/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Versão 2.10 (PDF, gráficos e Folhas e avisos) nas duas centrais: node testes/rodar-pedidos210.mjs [node|java] */
import { abrirNavegador } from './navegador.mjs';
import { novoGrupo, resumo } from './teste.mjs';
import { testarPedidos210 } from './pedidos210.mjs';
import { centralNode, centralJava } from './servidores.mjs';

const qual = process.argv[2];
const grupos = [];
const nav = await abrirNavegador();
try {
  for (const [nome, ligar, porta] of [['node', (p, d) => centralNode(p, d), 8161], ['java', centralJava, 8162]]) {
    if (qual && qual !== nome) continue;
    const g = novoGrupo('Versão 2.10 (PDF, gráficos e folhas) na central ' + (nome === 'node' ? 'do computador' : 'do tablet chefe'));
    await testarPedidos210(nav, ligar, porta, g);
    grupos.push(g);
  }
} finally { await nav.fechar(); }
const r = resumo(grupos);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
