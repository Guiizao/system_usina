/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Versão 2.13: a folha de enviar (período, turnos, resumo somado e Excel com os totais): node testes/rodar-envio213.mjs */
import { abrirNavegador } from './navegador.mjs';
import { novoGrupo, resumo } from './teste.mjs';
import { testarEnvio213 } from './envio213.mjs';
import { centralNode } from './servidores.mjs';

const c = await centralNode(8187);
const nav = await abrirNavegador();
const grupo = novoGrupo('Enviar: período, turnos, resumo somado e Excel com os totais');
try { await testarEnvio213(nav, c.url, grupo); } finally { await nav.fechar(); await c.desligar(); }
const r = resumo([grupo]);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
