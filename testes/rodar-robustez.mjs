/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Longo prazo, turnos e central nova nas duas centrais: node testes/rodar-robustez.mjs [node|java] */
import { abrirNavegador } from './navegador.mjs';
import { novoGrupo, resumo } from './teste.mjs';
import { testarRobustezCentral, testarRobustezAparelhos } from './robustez.mjs';
import { centralNode, centralJava } from './servidores.mjs';

const qual = process.argv[2];
const grupos = [];
const nav = await abrirNavegador();
try {
  for (const [nome, ligar, porta] of [['node', centralNode, 8187], ['java', centralJava, 8188]]) {
    if (qual && qual !== nome) continue;
    const onde = nome === 'node' ? 'do computador' : 'do tablet chefe';
    const g1 = novoGrupo('Longo prazo e central nova, direto na central ' + onde);
    await testarRobustezCentral(ligar, porta, g1);
    grupos.push(g1);
    const g2 = novoGrupo('Longo prazo, turnos e central nova com aparelhos, na central ' + onde);
    await testarRobustezAparelhos(nav, ligar, porta + 10, g2);
    grupos.push(g2);
  }
} finally { await nav.fechar(); }
const r = resumo(grupos);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
