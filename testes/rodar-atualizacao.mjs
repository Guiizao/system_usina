/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Atualização pelo próprio aplicativo (versão 2.7): node testes/rodar-atualizacao.mjs */
import { abrirNavegador } from './navegador.mjs';
import { novoGrupo, resumo } from './teste.mjs';
import { testarAtualizacao } from './atualizacao.mjs';

const grupos = [];
const nav = await abrirNavegador();
try {
  const g = novoGrupo('Atualização pelo próprio aplicativo e novidades');
  await testarAtualizacao(nav, g);
  grupos.push(g);
} finally { await nav.fechar(); }
const r = resumo(grupos);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
