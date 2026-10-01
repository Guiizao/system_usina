/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* O aplicativo do jeito que vai no APK (código embaralhado pelo terser, como no gerar-apk.ps1):
   o fluxo da dorna e os pedidos de 24/09.   node testes/rodar-apk-web.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { abrirNavegador, TAMANHOS } from './navegador.mjs';
import { novoGrupo, resumo, teste, certo } from './teste.mjs';
import { testarDornas } from './dornas.mjs';
import { testarPedidos24 } from './pedidos24.mjs';
import { testarPedidos26 } from './pedidos26.mjs';
import { centralNode, pastaTemporaria, APP } from './servidores.mjs';

/** Copia a pasta public e embaralha os .js do mesmo jeito que o gerar-apk.ps1 faz. Devolve a pasta. */
export function copiaEmbaralhada() {
  const destino = pastaTemporaria('www');
  fs.cpSync(path.join(APP, 'public'), destino, { recursive: true });
  for (const js of ['app.js', 'forms.js', 'modelos.js', 'pdf.js', 'xlsx.js', 'leitor.js', 'cifra.js']) { // qrcode.js (MIT) vai como está
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
  const g26 = novoGrupo('Código embaralhado do APK: volume de vinho e dornas de fermentação');
  await testarPedidos26(nav, (porta, pasta) => centralNode(porta, pasta, www), 8172, g26);
  grupos.push(g26);
  // a criptografia escrita em JavaScript (navegador sem WebCrypto) também vai embaralhada: tem de dar o mesmo resultado
  const g3 = novoGrupo('Código embaralhado do APK: criptografia escrita em JavaScript');
  const c3 = await centralNode(8173, pastaTemporaria('apk3'), www);
  const a = await nav.novoAparelho('conferir a criptografia', TAMANHOS.tablet);
  try {
    await teste(g3, 'AES-GCM e X25519 embaralhados dão o mesmo resultado que o WebCrypto do navegador', async () => {
      await a.ir(c3.url + '/');
      const r = await a.avaliar(`(async () => {
        const k = crypto.getRandomValues(new Uint8Array(32)), iv = crypto.getRandomValues(new Uint8Array(12)), aad = new Uint8Array([1, 2, 3]);
        const ruins = [];
        for (const n of [0, 15, 16, 17, 1000, 70000]) {
          const m = crypto.getRandomValues(new Uint8Array(Math.min(n, 65536))).slice(0, n);
          const chave = await crypto.subtle.importKey('raw', k, 'AES-GCM', false, ['encrypt']);
          const w = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, chave, m));
          if (Cifra.hex(w) !== Cifra.hex(Cifra.gcm(k, iv, m, aad, false))) ruins.push('aes ' + n);
        }
        const a1 = crypto.getRandomValues(new Uint8Array(32)), b1 = crypto.getRandomValues(new Uint8Array(32));
        if (Cifra.hex(Cifra.x25519(a1, Cifra.x25519(b1, Cifra.BASE))) !== Cifra.hex(Cifra.x25519(b1, Cifra.x25519(a1, Cifra.BASE)))) ruins.push('x25519');
        if (Cifra.hex(Cifra.sha256(Cifra.utf8('abc'))) !== 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad') ruins.push('sha256');
        return ruins;
      })()`);
      certo(!r.length, 'diferente: ' + r.join(', '));
    });
  } finally { await a.fechar(); await c3.desligar(); }
  grupos.push(g3);
}

if (process.argv[1] && process.argv[1].endsWith('rodar-apk-web.mjs')) {
  const grupos = [];
  const nav = await abrirNavegador();
  try { await testarApkWeb(nav, grupos); } finally { await nav.fechar(); }
  const r = resumo(grupos);
  console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
  process.exitCode = r.falharam ? 1 : 0;
}
