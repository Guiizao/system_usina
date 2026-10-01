/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Pessoas, permissões e registro do sistema (versão 2.9) nas duas centrais: node testes/rodar-pessoas.mjs [node|java] */
import { abrirNavegador } from './navegador.mjs';
import { novoGrupo, resumo } from './teste.mjs';
import { testarPessoas } from './pessoas.mjs';
import { centralNode, centralJava } from './servidores.mjs';

const qual = process.argv[2];
const grupos = [];
const nav = await abrirNavegador();
try {
  for (const [nome, ligar, porta] of [['node', (p, d, x) => centralNode(p, d, undefined, x), 8157], ['java', centralJava, 8158]]) {
    if (qual && qual !== nome) continue;
    const g = novoGrupo('Pessoas, permissões e registro na central ' + (nome === 'node' ? 'do computador' : 'do tablet chefe'));
    await testarPessoas(nav, ligar, porta, g);
    grupos.push(g);
  }
} finally { await nav.fechar(); }
const r = resumo(grupos);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
