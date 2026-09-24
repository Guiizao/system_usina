/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* O aplicativo do jeito que vai no APK (código embaralhado pelo terser, como no gerar-apk.ps1):
   o fluxo da dorna e os pedidos de 24/09.   node testes/rodar-apk-web.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { abrirNavegador } from './navegador.mjs';
import { novoGrupo, resumo } from './teste.mjs';
import { testarDornas } from './dornas.mjs';
import { testarPedidos24 } from './pedidos24.mjs';
import { centralNode, pastaTemporaria, APP } from './servidores.mjs';

/** Copia a pasta public e embaralha os .js do mesmo jeito que o gerar-apk.ps1 faz. Devolve a pasta. */
export function copiaEmbaralhada() {
  const destino = pastaTemporaria('www');
  fs.cpSync(path.join(APP, 'public'), destino, { recursive: true });
  for (const js of ['app.js', 'forms.js', 'modelos.js', 'xlsx.js', 'leitor.js']) { // qrcode.js (MIT) vai como está
    const arquivo = path.join(destino, js);
    execSync(`npx terser "${arquivo}" --compress --mangle --comments "/Guilherme/" -o "${arquivo}"`, { cwd: path.join(APP, 'apk'), stdio: 'pipe' });
  }
  return destino;
}

export async function testarApkWeb(nav, grupos) {
  const www = copiaEmbaralhada();
  const g1 = novoGrupo('Código embaralhado do APK: fluxo da dorna');
  const c = await centralNode(8175, pastaTemporaria('apk'), www);
  try { await testarDornas(nav, c, g1); } finally { await c.desligar(); }
  grupos.push(g1);
  const g2 = novoGrupo('Código embaralhado do APK: pedidos de 24/09');
  await testarPedidos24(nav, (porta, pasta) => centralNode(porta, pasta, www), 8174, g2);
  grupos.push(g2);
}

if (process.argv[1] && process.argv[1].endsWith('rodar-apk-web.mjs')) {
  const grupos = [];
  const nav = await abrirNavegador();
  try { await testarApkWeb(nav, grupos); } finally { await nav.fechar(); }
  const r = resumo(grupos);
  console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
  process.exitCode = r.falharam ? 1 : 0;
}
