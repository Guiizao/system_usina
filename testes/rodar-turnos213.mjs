/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Versão 2.13.4: turnos de cada setor (3 ou 2 de 12 horas): node testes/rodar-turnos213.mjs */
import { abrirNavegador } from './navegador.mjs';
import { novoGrupo, resumo } from './teste.mjs';
import { testarTurnos213 } from './turnos213.mjs';
import { centralNode } from './servidores.mjs';

const c = await centralNode(8196);
const nav = await abrirNavegador();
const grupo = novoGrupo('Turnos de cada setor: 3 ou 2 de 12 horas');
try { await testarTurnos213(nav, c.url, grupo); } finally { await nav.fechar(); await c.desligar(); }
const r = resumo([grupo]);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
