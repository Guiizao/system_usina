/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Só as telas do computador e da entrada pela nuvem (2.17): node testes/rodar-pc217.mjs */
import { abrirNavegador } from './navegador.mjs';
import { novoGrupo, resumo } from './teste.mjs';
import { testarNivelNaTela217, testarNotificacoes217, testarEntrarPC217, testarPainelPC217, testarLogoEAbertura217, testarTecladoDoPC217 } from './pc217.mjs';

const g = novoGrupo('Telas da 2.17');
const nav = await abrirNavegador();
try {
  for (const f of [testarNivelNaTela217, testarNotificacoes217, testarEntrarPC217, testarPainelPC217, testarLogoEAbertura217, testarTecladoDoPC217]) await f(nav, g);
} finally { await nav.fechar(); }
const r = resumo([g]);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
