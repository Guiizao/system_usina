/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Versão 2.13.5: o aplicativo não trava sem a central: node testes/rodar-conexao2135.mjs */
import { abrirNavegador } from './navegador.mjs';
import { novoGrupo, resumo } from './teste.mjs';
import { testarConexao2135 } from './conexao2135.mjs';
import { centralNode } from './servidores.mjs';

const nav = await abrirNavegador();
const grupo = novoGrupo('Sem a central: o aplicativo continua e mostra a conexão');
try { await testarConexao2135(nav, await centralNode(8199), grupo); } finally { await nav.fechar(); }
const r = resumo([grupo]);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
