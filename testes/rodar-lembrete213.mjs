/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Versão 2.13.2: "Anotar agora" cala o apito do lembrete e tira a faixa: node testes/rodar-lembrete213.mjs */
import { abrirNavegador } from './navegador.mjs';
import { novoGrupo, resumo } from './teste.mjs';
import { testarLembrete213 } from './lembrete213.mjs';
import { centralNode } from './servidores.mjs';

const c = await centralNode(8189);
const nav = await abrirNavegador();
const grupo = novoGrupo('Lembrete de anotar: Anotar agora cala o apito');
try { await testarLembrete213(nav, c.url, grupo); } finally { await nav.fechar(); await c.desligar(); }
const r = resumo([grupo]);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
