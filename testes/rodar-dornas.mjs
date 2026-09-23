/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Fluxo da dorna nas duas centrais: node testes/rodar-dornas.mjs [node|java] */
import { abrirNavegador } from './navegador.mjs';
import { novoGrupo, resumo } from './teste.mjs';
import { testarDornas } from './dornas.mjs';
import { centralNode, centralJava } from './servidores.mjs';

const qual = process.argv[2];
const grupos = [];
const nav = await abrirNavegador();
try {
  for (const [nome, ligar, porta] of [['node', centralNode, 8197], ['java', centralJava, 8198]]) {
    if (qual && qual !== nome) continue;
    const c = await ligar(porta);
    const g = novoGrupo('Dornas na central ' + (nome === 'node' ? 'do computador' : 'do tablet chefe'));
    try { await testarDornas(nav, c, g); } finally { await c.desligar(); }
    grupos.push(g);
  }
} finally { await nav.fechar(); }
const r = resumo(grupos);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
