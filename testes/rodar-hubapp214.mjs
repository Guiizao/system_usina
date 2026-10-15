/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Versão 2.14: aparelhos trocando anotações pela nuvem com a central desligada: node testes/rodar-hubapp214.mjs
   Precisa do wrangler em nuvem/node_modules (npm install na pasta nuvem). */
import { abrirNavegador } from './navegador.mjs';
import { novoGrupo, resumo } from './teste.mjs';
import { testarHubApp } from './hubapp214.mjs';
import { centralNode, centralJava } from './servidores.mjs';
import { ligarNuvem } from './nuvem.mjs';

const nav = await abrirNavegador();
const grupos = [];
try {
  // cada central com a sua nuvem: senão o tablet da segunda rodada recebe a dorna da primeira
  for (const [nome, ligar, porta, portaNuvem] of [['computador', centralNode, 8201, 8892], ['tablet chefe', centralJava, 8202, 8893]]) {
    const grupo = novoGrupo(`Sem a central (${nome}): os aparelhos trocam as anotações pela nuvem`);
    grupos.push(grupo);
    const nuvem = await ligarNuvem(portaNuvem);
    const central = await ligar(porta);
    try { await testarHubApp(nav, central, nuvem, grupo); } finally { await central.desligar(); await nuvem.desligar(); }
  }
} finally { await nav.fechar(); }
const r = resumo(grupos);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
