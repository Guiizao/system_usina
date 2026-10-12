/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. */
/* Contas e papel, sem central: node testes/rodar-rastreamento213.mjs [--amostras] */
import { novoGrupo, resumo } from './teste.mjs';
import { testarRastreamento213, gravarAmostras } from './rastreamento213.mjs';

const grupo = novoGrupo('Rastreamento de lotes e papel da versão 2.13');
await testarRastreamento213(grupo);
const r = resumo([grupo]);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
if (!r.falharam && process.argv.includes('--amostras')) console.log('Amostras temporárias: ' + await gravarAmostras());
process.exitCode = r.falharam ? 1 : 0;
