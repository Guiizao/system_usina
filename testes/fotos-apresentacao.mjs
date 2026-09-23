/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Tira as imagens das telas usadas na apresentação, com o relógio do app num horário de trabalho.
 * Uso: node testes/fotos-apresentacao.mjs <pasta de saída> [http://localhost:8080] [HH:MM]
 * A leitura de folha usa public/_apres_folha.jpg (copie uma foto de folha preenchida para lá antes).
 */
import path from 'node:path';
import fs from 'node:fs';
import { abrirNavegador, dormir } from './navegador.mjs';

const SAIDA = process.argv[2];
const BASE = (process.argv[3] || 'http://localhost:8080').replace(/\/$/, '');
const [hh, mm] = (process.argv[4] || '10:58').split(':').map(Number);
fs.mkdirSync(SAIDA, { recursive: true });

const alvo = new Date(); alvo.setHours(hh, mm, 0, 0);
const adiantar = alvo.getTime() - Date.now();
const RELOGIO = `(() => { const D = Date; const ad = ${adiantar};
  function F(...a) { if (!(this instanceof F)) return new D(D.now() + ad).toString(); return a.length ? new D(...a) : new D(D.now() + ad); }
  F.prototype = D.prototype; F.now = () => D.now() + ad; F.parse = D.parse; F.UTC = D.UTC; Object.setPrototypeOf(F, D); window.Date = F; })();`;

const B = BASE + '/?demo';
const HID = '&papel=hidrolise&op=Guilherme&tela=prancheta&pid=hid_anexo1';
const TABLET = { largura: 1280, altura: 800, dpr: 1.5, celular: false };
const FOTOS = [
  ['tela-operador', '&papel=hidrolise&tela=operador'],
  ['tela-dorna', HID + '&campo=brix&teclas=1|8'],
  ['tela-ph', HID + '&campo=phf&teclas=4|,|6'],
  ['tela-chefe', '&papel=central'],
  ['tela-avisos', '&papel=central&tela=avisos'],
  ['tela-aviso-na-tela', '&papel=hidrolise&op=Guilherme&aviso=1', '.modal.aviso-grande'],
  ['tela-leitura', '&papel=central&lerfoto=_apres_folha.jpg&pid=hid_anexo1', '.tabela-leitura', 150000],
  ['tela-folha', '&papel=central&folhas=hid_anexo1', '.folha-imp', 20000, { largura: 1100, altura: 1500, dpr: 1.5, celular: false }, '.folha-imp'],
];

const nav = await abrirNavegador();
try {
  for (const [nome, sufixo, espera, ms, tamanho, recorte] of FOTOS) {
    const a = await nav.novoAparelho(nome, tamanho || TABLET);
    await nav.cdp('Page.addScriptToEvaluateOnNewDocument', { source: RELOGIO }, a.sessionId);
    await a.ir(B + sufixo, 'document.querySelector("#app header, #app main")');
    if (espera) await a.esperar(`document.querySelector(${JSON.stringify(espera)})`, ms || 15000, nome);
    await dormir(900);
    const args = { format: 'png' };
    if (recorte) {
      const c = await a.avaliar(`(() => { const b = document.querySelector(${JSON.stringify(recorte)}).getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, width: b.width, height: b.height, scale: 1 }; })()`);
      Object.assign(args, { clip: c, captureBeyondViewport: true });
    }
    const r = await nav.cdp('Page.captureScreenshot', args, a.sessionId);
    fs.writeFileSync(path.join(SAIDA, nome + '.png'), Buffer.from(r.data, 'base64'));
    console.log('ok', nome, a.erros.length ? 'ERROS: ' + a.erros.join(' | ') : '');
    await a.fechar();
  }
} finally { await nav.fechar(); }
