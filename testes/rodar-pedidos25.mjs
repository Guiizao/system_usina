/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Versão 2.5 (Base44 e Wi-Fi embaralhado) nas duas centrais: node testes/rodar-pedidos25.mjs [node|java] */
import { abrirNavegador } from './navegador.mjs';
import { novoGrupo, resumo } from './teste.mjs';
import { testarCifra } from './cifra.mjs';
import { testarBase44Central, testarPedidos25, testarFuncaoBase44 } from './pedidos25.mjs';
import { centralNode, centralJava } from './servidores.mjs';

const qual = process.argv[2];
const grupos = [];
const g0 = novoGrupo('Criptografia: a escrita em JavaScript igual à do Node');
await testarCifra(g0);
grupos.push(g0);
const gf = novoGrupo('Função que vai no Base44 do escritório');
await testarFuncaoBase44(gf);
grupos.push(gf);
for (const [nome, ligar, porta] of [['node', centralNode, 8161], ['java', centralJava, 8162]]) {
  if (qual && qual !== nome) continue;
  const c = await ligar(porta);
  const g = novoGrupo('Base44 na central ' + (nome === 'node' ? 'do computador' : 'do tablet chefe'));
  try { await testarBase44Central(c, porta + 10, g); } finally { await c.desligar(); }
  grupos.push(g);
}
const nav = await abrirNavegador();
try {
  for (const [nome, ligar, porta] of [['node', centralNode, 8163], ['java', centralJava, 8164]]) {
    if (qual && qual !== nome) continue;
    const g = novoGrupo('Versão 2.5 no aplicativo, central ' + (nome === 'node' ? 'do computador' : 'do tablet chefe'));
    await testarPedidos25(nav, ligar, porta, g, { correcao: nome === 'node' });
    grupos.push(g);
  }
} finally { await nav.fechar(); }
const r = resumo(grupos);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
