/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Revisão das telas com uma central de teste própria (não precisa de nada ligado):
   node testes/rodar-telas.mjs [tamanho1,tamanho2] [tela1,tela2] */
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { centralNode, APP } from './servidores.mjs';

const c = await centralNode(8186);
try {
  spawnSync(process.execPath, [path.join(APP, 'testes', 'telas.mjs'), c.url, ...process.argv.slice(2)], { stdio: 'inherit' });
} finally { await c.desligar(); }
