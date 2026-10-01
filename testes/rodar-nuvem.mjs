/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Nuvem das Pranchetas (versão 2.8), rodando aqui no computador: node testes/rodar-nuvem.mjs */
import { novoGrupo, resumo } from './teste.mjs';
import { testarNuvem } from './nuvem.mjs';

const g = novoGrupo('Nuvem das Pranchetas (Cloudflare, rodando no computador)');
await testarNuvem(g);
const r = resumo([g]);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
