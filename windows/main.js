/* Pranchetas Digitais - © 2026 Guilherme. */
const { app, BrowserWindow, Menu, Tray, dialog, shell, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { semearApk } = require('./pacote');

const raiz = app.isPackaged ? __dirname : path.resolve(__dirname, '..');
const porta = Number(process.env.PORTA || 8080);
const endereco = `http://127.0.0.1:${porta}`;
let janela, bandeja, saindo = false, falhou = false;

function abrir() {
  if (!janela) return;
  if (janela.isMinimized()) janela.restore();
  janela.show();
  janela.focus();
}

async function falhar(erro) {
  if (falhou) return;
  falhou = true;
  await app.whenReady();
  await dialog.showMessageBox({ type: 'error', title: 'Central das Pranchetas',
    message: erro.code === 'EADDRINUSE' ? `A porta ${porta} já está sendo usada.` : 'Não foi possível ligar a central.',
    detail: erro.code === 'EADDRINUSE'
      ? 'Outra central ou outro programa já está ligado neste computador. Feche esse programa e abra as Pranchetas novamente. A central que já estava ligada não foi encerrada.'
      : erro.message,
    buttons: ['Fechar'] });
  app.exit(1);
}

function conferirPorta() {
  return new Promise((resolve, reject) => {
    const teste = net.createServer();
    teste.once('error', reject);
    teste.listen(porta, process.env.ENDERECO || '0.0.0.0', () => teste.close(resolve));
  });
}

function externo(url) {
  // Nunca entregue file:, javascript: ou protocolos arbitrários ao Windows.
  if (/^(https?:|mailto:|whatsapp:)/i.test(url)) {
    shell.openExternal(url).catch((erro) => dialog.showErrorBox('Não foi possível abrir o link', erro.message));
  }
}

function local(url) {
  try { return new URL(url).origin === endereco; } catch { return false; }
}

async function ligar() {
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) throw new Error('PORTA precisa estar entre 1 e 65535.');
  await conferirPorta();
  process.env.PORTA = String(porta);
  process.env.PASTA_DADOS = path.resolve(process.env.PASTA_DADOS || path.join(app.getPath('documents'), 'Usina'));
  process.env.PASTA_APK = path.resolve(process.env.PASTA_APK || path.join(app.getPath('userData'), 'apk'));
  process.env.PASTA_PUBLICA = path.join(raiz, 'public');
  semearApk(path.join(raiz, 'apk', 'saida'), process.env.PASTA_APK);
  require(path.join(raiz, 'server.js'));
  // O require inicia o listen, mas a janela só abre quando a central responder.
  let pronta = false;
  for (let i = 0; i < 100 && !falhou; i++) {
    try {
      const r = await fetch(endereco + '/api/ping', { signal: AbortSignal.timeout(500) });
      if (r.ok && (await r.json()).app === 'pranchetas') { pronta = true; break; }
    } catch { /* a central ainda está ligando */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (falhou) return;
  if (!pronta) throw new Error('A central não respondeu a tempo. Feche o aplicativo e tente novamente.');

  const icone = nativeImage.createFromPath(path.join(process.env.PASTA_PUBLICA, 'icons', 'icon-512.png'));
  janela = new BrowserWindow({ title: 'Pranchetas Ubirálcool', width: 1280, height: 800,
    show: false, icon: icone, autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  janela.setMenu(null);
  // registro da janela (Documentos não; fica com o programa): ajuda a achar tela branca, erro de página ou travamento
  const registro = (...x) => { try { fs.appendFileSync(path.join(app.getPath('userData'), 'janela.log'), new Date().toISOString() + ' ' + x.join(' ') + '\n'); } catch { /* sem registro, segue */ } };
  janela.webContents.on('console-message', (e) => registro('console', e.level, e.message, (e.sourceId || '') + ':' + (e.lineNumber || '')));
  janela.webContents.on('render-process-gone', (e, d) => registro('a página caiu', JSON.stringify(d)));
  janela.webContents.on('did-fail-load', (e, codigo, desc, url) => registro('não carregou', codigo, desc, url));
  janela.on('unresponsive', () => registro('a janela parou de responder'));
  registro('abrindo', endereco);
  janela.on('close', (evento) => { if (!saindo) { evento.preventDefault(); janela.hide(); } });
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (local(url)) janela.loadURL(url).catch(falhar); else externo(url);
    return { action: 'deny' };
  });
  janela.webContents.on('will-navigate', (evento, url) => {
    if (!local(url)) { evento.preventDefault(); externo(url); }
  });
  janela.webContents.on('will-redirect', (evento, url) => {
    if (!local(url)) { evento.preventDefault(); externo(url); }
  });

  // Somente o aplicativo instalado altera o início automático, nunca o Electron de desenvolvimento/teste.
  const preferencia = path.join(app.getPath('userData'), 'windows.json');
  if (app.isPackaged && !fs.existsSync(preferencia)) {
    app.setLoginItemSettings({ openAtLogin: true });
    fs.writeFileSync(preferencia, JSON.stringify({ inicioConfigurado: true }));
  }
  bandeja = new Tray(icone.resize({ width: 32, height: 32 }));
  bandeja.setToolTip('Pranchetas Ubirálcool — central ligada');
  bandeja.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir', click: abrir },
    { label: 'Pasta dos relatórios', click: async () => {
      const erro = await shell.openPath(path.join(process.env.PASTA_DADOS, 'RelatoriosUsina'));
      if (erro) dialog.showErrorBox('Pasta dos relatórios', erro);
    } },
    { label: 'Iniciar com o Windows', type: 'checkbox', enabled: app.isPackaged,
      checked: app.isPackaged && app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() },
  ]));
  bandeja.on('double-click', abrir);
  // a janela conecta sozinha na central daqui (2.16): o código vai no endereço, só para esta janela, e sai dele na hora
  let codigo = '';
  try { codigo = JSON.parse(fs.readFileSync(path.join(process.env.PASTA_DADOS, 'ServidorUsina', 'config.json'), 'utf8')).codigo || ''; } catch { /* sem o código, a tela pede */ }
  await janela.loadURL(endereco + '/' + (/^\d{6}$/.test(codigo) ? '?codigo=' + codigo : ''));
  abrir();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.setAppUserModelId('br.com.ubiralcool.pranchetas');
  app.on('second-instance', abrir);
  app.on('activate', abrir);
  app.on('before-quit', () => { saindo = true; });
  app.on('window-all-closed', () => {});
  process.once('uncaughtException', falhar); // inclui uma disputa pela porta entre a conferência e o listen
  app.whenReady().then(ligar).catch(falhar);
}
