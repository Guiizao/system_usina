/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Versão 2.12 só em Node: node testes/rodar-papel212.mjs */
import { novoGrupo, resumo } from './teste.mjs';
import { testarPapel212 } from './papel212.mjs';

const grupo = novoGrupo('Folhas de papel e API de leitura da versão 2.12');
await testarPapel212(grupo);
const r = resumo([grupo]);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
