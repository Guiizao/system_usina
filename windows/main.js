/* Pranchetas Digitais - © 2026 Guilherme. */
/* Programa do Windows (2.16, decisão do Guilherme): o painel administrativo pela nuvem. A central continua no tablet
   chefe; o computador não liga central, não abre porta no firewall e não entrega APK. Ele só mostra as telas que vêm
   dentro do programa ou as atualizadas com assinatura (2.18), num endereço local. A pessoa entra pela nuvem. */
const { app, BrowserWindow, Menu, Tray, dialog, shell, nativeImage, session, ipcMain } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { AtualizadorTelas } = require('./atualizar-telas');
const { lerVersao } = require('./pacote');

const raiz = app.isPackaged ? __dirname : path.resolve(__dirname, '..');
const publico = path.join(raiz, 'public');
let janela, bandeja, atualizador, saindo = false, endereco = '', arquivoFalhou = false;

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.onnx': 'application/octet-stream' };

/** As telas do programa num endereço só deste computador (127.0.0.1, porta escolhida pelo Windows): nada fica aberto na rede. */
function servirTelas() {
  return new Promise((resolve, reject) => {
    const servidor = http.createServer((req, res) => {
      // Mantém a mesma versão durante toda a resposta, mesmo se terminar um download.
      const ativa = atualizador && atualizador.ativa;
      const pasta = ativa ? ativa.pasta : publico;
      let publicoReal;
      try { publicoReal = fs.realpathSync(pasta); } catch { res.writeHead(404); return res.end(); }
      // endereço com % quebrado (ex.: /%E0%A4%A) não pode derrubar o programa
      let rel;
      try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
      if (rel === '/') rel = '/index.html';
      const alvo = path.normalize(path.join(pasta, rel));
      if (!alvo.startsWith(pasta + path.sep)) { res.writeHead(403); return res.end(); }
      fs.realpath(alvo, (erro, real) => {
        if (erro) { res.writeHead(404); return res.end('Não encontrado'); }
        if (!real.startsWith(publicoReal + path.sep)) { res.writeHead(403); return res.end(); }
        fs.readFile(real, (erro, dados) => {
          if (erro) { res.writeHead(404); return res.end('Não encontrado'); }
          // Confere os bytes que vão na resposta, não uma leitura anterior do arquivo gravável.
          if (ativa && !atualizador.confere(ativa, path.relative(pasta, alvo).split(path.sep).join('/'), dados)) {
            arquivoFalhou = true; res.writeHead(403); return res.end();
          }
          res.writeHead(200, { 'Content-Type': TIPOS[path.extname(alvo)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
          res.end(dados);
        });
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

/* 3.0: a cópia dos dados, em Documentos/Usina/BackupUsina. Só a tela do programa pede, só com nome de cópia e sempre nessa pasta. */
const NOME_DA_COPIA = /^(\d{4}-\d{2}-\d{2}|copia-[\w-]{1,80})\.json$/;
function lerCopia(evento, nome) {
  if (!evento.senderFrame || !local(evento.senderFrame.url)) throw new Error('pedido de fora do programa');
  if (!NOME_DA_COPIA.test(String(nome))) throw new Error('cópia inválida');
  try { return fs.readFileSync(path.join(app.getPath('documents'), 'Usina', 'BackupUsina', nome), 'utf8'); } catch (e) { return ''; }
}
function guardarCopia(evento, nome, texto) {
  if (!evento.senderFrame || !local(evento.senderFrame.url)) throw new Error('pedido de fora do programa');
  if (!NOME_DA_COPIA.test(String(nome)) || typeof texto !== 'string' || texto.length > 20 * 1024 * 1024) throw new Error('cópia inválida');
  const pasta = path.join(app.getPath('documents'), 'Usina', 'BackupUsina');
  fs.mkdirSync(pasta, { recursive: true });
  const provisorio = path.join(pasta, `${nome}.tmp`);
  fs.writeFileSync(provisorio, texto, 'utf8');
  fs.renameSync(provisorio, path.join(pasta, nome));
}

async function ligar() {
  ipcMain.handle('guardar-copia', guardarCopia);
  ipcMain.handle('ler-copia', lerCopia);
  atualizador = new AtualizadorTelas({ publico,
    destino: path.join(process.env.LOCALAPPDATA || path.join(app.getPath('appData'), '..', 'Local'), 'Pranchetas'),
    versao: app.isPackaged ? app.getVersion() : lerVersao(publico) });
  endereco = await servirTelas();
  // O Chromium do Electron derruba a página quando o service worker grava no cache ("bad IPC message, CacheStorageCache"):
  // aqui ele não faz falta. Apaga o que ficou de uma versão anterior (as anotações guardadas na página ficam).
  await session.defaultSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] }).catch(() => {});
  const icone = nativeImage.createFromPath(path.join(publico, 'icons', 'icon-512.png'));
  janela = new BrowserWindow({ title: 'Pranchetas Ubirálcool', width: 1440, height: 900, show: false, icon: icone, autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') } });
  janela.setMenu(null);
  // registro da janela (fica com o programa): ajuda a achar tela branca, erro de página ou travamento
  const registro = (...x) => { try { fs.appendFileSync(path.join(app.getPath('userData'), 'janela.log'), new Date().toISOString() + ' ' + x.join(' ') + '\n'); } catch { /* sem registro, segue */ } };
  // Mensagens e endereços podem carregar senha ou chave: o registro guarda o texto (é ele que acha a causa de uma tela
  // branca) sem o valor depois de senha=/token=/chave=..., sem ?parâmetros e #fragmentos e sem sequência longa de chave.
  const limpo = (s) => String(s || '').replace(/\b(senha|pin|token|chave|segredo|password|authorization|bearer)\b\s*[=:]?\s*\S+/gi, '$1=…')
    .replace(/[?#]\S*/g, '?…').replace(/[A-Za-z0-9_+/=-]{24,}/g, '…').slice(0, 300);
  janela.webContents.on('console-message', (e) => registro('console', Number(e.level) || 0, limpo(e.message), limpo(e.sourceId) + ':' + (Number(e.lineNumber) || 0)));
  janela.webContents.on('did-fail-load', (e, codigo, desc, url) => registro('não carregou', Number(codigo) || 0, /^ERR_[A-Z_]+$/.test(desc) ? desc : '', limpo(url)));
  janela.on('unresponsive', () => registro('a janela parou de responder'));
  // a página caiu: anota e abre de novo (até 3 vezes, para não ficar em volta)
  let quedas = 0;
  janela.webContents.on('render-process-gone', (e, d) => {
    registro('a página caiu', JSON.stringify(d));
    if (!carregando && ++quedas <= 3) setTimeout(() => carregarPainel().catch(() => {}), 500);
  });
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
  let carregando = false, conferindo = false;
  const comPrazo = (promessa, ms) => {
    let timer;
    return Promise.race([promessa, new Promise((_, rejeitar) => { timer = setTimeout(() => rejeitar(new Error('A tela não abriu a tempo')), ms); })])
      .finally(() => clearTimeout(timer));
  };
  async function carregarPainel() {
    if (carregando) return;
    carregando = true;
    try {
      // Até duas tentativas da atualização, depois uma das telas internas.
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        const nova = atualizador.ativa;
        arquivoFalhou = false;
        atualizador.iniciarAbertura();
        try {
          await comPrazo((async () => {
            // ?nuvem=1: começa em Entrar pela nuvem.
            await janela.loadURL(endereco + '/?nuvem=1');
            abrir(); // 3.1.10: aparece logo depois de carregar (a abertura espera por isso); antes, com telas novas, esperava mais 5 s
            if (nova) {
              await new Promise((r) => setTimeout(r, 5000));
              const ok = await janela.webContents.executeJavaScript('!!document.querySelector("#app main")?.textContent.trim()');
              if (!ok || arquivoFalhou) throw new Error('A tela nova não abriu');
            }
          })(), 20000);
          atualizador.confirmarAbertura();
          abrir(); return;
        } catch (erro) {
          if (!nova) throw erro;
          atualizador.falhou();
          registro('telas', atualizador.ativa ? 'tentando novamente' : 'voltando para as internas');
        }
      }
    } finally { carregando = false; }
  }
  async function conferirTelas() {
    if (conferindo || carregando || saindo) return;
    conferindo = true;
    try {
      // Só o endereço público: não leva PIN nem token ao processo principal ou ao download.
      const nuvem = await comPrazo(janela.webContents.executeJavaScript(`(() => {
        try { return JSON.parse(localStorage.getItem('usina.cfg') || '{}').nuvemUrl || window.USINA?.nuvemPadrao || ''; }
        catch { return ''; }
      })()`), 10000);
      if (nuvem && await atualizador.atualizar(nuvem)) {
        registro('telas', 'atualização verificada');
        await carregarPainel();
      }
    } catch { registro('telas', 'atualização indisponível ou recusada'); }
    finally { conferindo = false; }
  }
  registro('abrindo', endereco);
  await carregarPainel();
  void conferirTelas();
  const intervalo = setInterval(conferirTelas, 30 * 60000);
  intervalo.unref();
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
