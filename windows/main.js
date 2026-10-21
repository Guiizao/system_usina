/* Pranchetas Digitais - © 2026 Guilherme. */
/* Programa do Windows (2.16, decisão do Guilherme): o painel administrativo pela nuvem. A central continua no tablet
   chefe; o computador não liga central, não abre porta no firewall e não entrega APK. Ele só mostra as telas que vêm
   dentro do programa (servidas aqui mesmo, num endereço local) e a pessoa entra com a sua senha pela nuvem. */
const { app, BrowserWindow, Menu, Tray, dialog, shell, nativeImage, session } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const raiz = app.isPackaged ? __dirname : path.resolve(__dirname, '..');
const publico = path.join(raiz, 'public');
let janela, bandeja, saindo = false, endereco = '';

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.onnx': 'application/octet-stream' };

/** As telas do programa num endereço só deste computador (127.0.0.1, porta escolhida pelo Windows): nada fica aberto na rede. */
function servirTelas() {
  return new Promise((resolve, reject) => {
    const servidor = http.createServer((req, res) => {
      let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (rel === '/') rel = '/index.html';
      const alvo = path.normalize(path.join(publico, rel));
      if (!alvo.startsWith(publico + path.sep)) { res.writeHead(403); return res.end(); }
      fs.readFile(alvo, (erro, dados) => {
        if (erro) { res.writeHead(404); return res.end('Não encontrado'); }
        res.writeHead(200, { 'Content-Type': TIPOS[path.extname(alvo)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        res.end(dados);
      });
    });
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${servidor.address().port}`));
  });
}

function abrir() {
  if (!janela) return;
  if (janela.isMinimized()) janela.restore();
  janela.show();
  janela.focus();
}

function externo(url) {
  // Nunca entregue file:, javascript: ou protocolos arbitrários ao Windows.
  if (/^(https?:|mailto:|whatsapp:)/i.test(url)) shell.openExternal(url).catch((erro) => dialog.showErrorBox('Não foi possível abrir o link', erro.message));
}
const local = (url) => { try { return new URL(url).origin === endereco; } catch { return false; } };

async function ligar() {
  endereco = await servirTelas();
  // O Chromium do Electron derruba a página quando o service worker grava no cache ("bad IPC message, CacheStorageCache"):
  // aqui ele não faz falta. Apaga o que ficou de uma versão anterior (as anotações guardadas na página ficam).
  await session.defaultSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] }).catch(() => {});
  const icone = nativeImage.createFromPath(path.join(publico, 'icons', 'icon-512.png'));
  janela = new BrowserWindow({ title: 'Pranchetas Ubirálcool', width: 1440, height: 900, show: false, icon: icone, autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  janela.setMenu(null);
  // registro da janela (fica com o programa): ajuda a achar tela branca, erro de página ou travamento
  const registro = (...x) => { try { fs.appendFileSync(path.join(app.getPath('userData'), 'janela.log'), new Date().toISOString() + ' ' + x.join(' ') + '\n'); } catch { /* sem registro, segue */ } };
  janela.webContents.on('console-message', (e) => registro('console', e.level, e.message, (e.sourceId || '') + ':' + (e.lineNumber || '')));
  janela.webContents.on('did-fail-load', (e, codigo, desc, url) => registro('não carregou', codigo, desc, url));
  janela.on('unresponsive', () => registro('a janela parou de responder'));
  // a página caiu: anota e abre de novo (até 3 vezes, para não ficar em volta)
  let quedas = 0;
  janela.webContents.on('render-process-gone', (e, d) => { registro('a página caiu', JSON.stringify(d)); if (++quedas <= 3) setTimeout(() => janela.reload(), 500); });
  janela.on('close', (evento) => { if (!saindo) { evento.preventDefault(); janela.hide(); } });
  janela.webContents.setWindowOpenHandler(({ url }) => { if (local(url)) janela.loadURL(url).catch(() => {}); else externo(url); return { action: 'deny' }; });
  janela.webContents.on('will-navigate', (evento, url) => { if (!local(url)) { evento.preventDefault(); externo(url); } });
  janela.webContents.on('will-redirect', (evento, url) => { if (!local(url)) { evento.preventDefault(); externo(url); } });

  bandeja = new Tray(icone.resize({ width: 32, height: 32 }));
  bandeja.setToolTip('Pranchetas Ubirálcool — painel pela nuvem');
  bandeja.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir', click: abrir },
    { label: 'Iniciar com o Windows', type: 'checkbox', enabled: app.isPackaged,
      checked: app.isPackaged && app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() },
  ]));
  bandeja.on('double-click', abrir);
  registro('abrindo', endereco);
  // ?nuvem=1: a primeira tela é "Entrar pela nuvem" (não a de conectar na rede da usina)
  await janela.loadURL(endereco + '/?nuvem=1');
  abrir();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.setAppUserModelId('br.com.ubiralcool.pranchetas');
  app.on('second-instance', abrir);
  app.on('activate', abrir);
  app.on('before-quit', () => { saindo = true; });
  app.on('window-all-closed', () => {});
  app.whenReady().then(ligar).catch(async (erro) => {
    await dialog.showMessageBox({ type: 'error', title: 'Pranchetas Ubirálcool', message: 'Não foi possível abrir o painel.', detail: erro.message, buttons: ['Fechar'] });
    app.exit(1);
  });
}
