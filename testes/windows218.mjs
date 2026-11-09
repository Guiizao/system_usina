/* Atualização do Windows: somente Node, chaves e pastas temporárias. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import http from 'node:http';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { novoGrupo, teste, resumo } from './teste.mjs';

const require = createRequire(import.meta.url);
const raiz = fileURLToPath(new URL('../', import.meta.url));
const { AtualizadorTelas } = require('../windows/atualizar-telas.js');
const g = novoGrupo('Windows 2.18 (sem Electron)');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'windows218-'));
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const publico = path.join(tmp, 'public');
fs.mkdirSync(publico);
fs.writeFileSync(path.join(publico, 'index.html'), 'telas internas');
fs.writeFileSync(path.join(publico, 'chave-telas.txt'), publicKey.export({ format: 'der', type: 'spki' }).toString('base64'));
let seq = 0;
const novo = (destino = path.join(tmp, String(++seq))) => new AtualizadorTelas({ publico, destino, versao: '2.18.0' });
function pacote(versao = '2.19.0', extras = {}) {
  const dados = Buffer.from('<main>telas novas</main>');
  const json = Buffer.from(JSON.stringify({ versao, ...extras, arquivos: { 'index.html': {
    sha256: crypto.createHash('sha256').update(dados).digest('hex'), tamanho: dados.length,
  } } }));
  const sig = Buffer.from(crypto.sign('sha256', json, privateKey).toString('base64'));
  return { 'pacote.json': json, 'pacote.sig': sig, 'index.html': dados };
}
const baixar = (p) => async (url) => new Response(p[decodeURIComponent(new URL(url).pathname.split('/').pop())], { status: 200 });
const instalar = (a, p) => a.atualizar('https://nuvem.example', baixar(p));
const assinar = (json) => crypto.sign('sha256', json, privateKey).toString('base64');
async function esperar(fn) {
  for (let i = 0; i < 300; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.fail('A atualização não terminou');
}
// Executa o main.js real com a janela simulada e HTTP real em loopback.
async function programa({ preinstalar = false, saudavel = true, rede = false, falhaCarga = false } = {}) {
  const pasta = path.join(tmp, 'programa-' + ++seq), publicApp = path.join(pasta, 'public');
  fs.mkdirSync(pasta); fs.cpSync(publico, publicApp, { recursive: true });
  const destino = path.join(pasta, 'Pranchetas');
  if (preinstalar) await instalar(new AtualizadorTelas({ publico: publicApp, destino, versao: '2.18.0' }), pacote());
  const servidores = [], cargas = [], intervalos = [], eventos = {}, pedidos = [], maos = {};
  let remoto = pacote(), endereco;
  const nuvem = http.createServer((req, res) => {
    pedidos.push(req); const dados = remoto[req.url.slice('/telas/'.length)];
    res.writeHead(dados ? 200 : 404); res.end(dados);
  });
  await new Promise((r) => nuvem.listen(0, '127.0.0.1', r));
  const janela = { webContents: {
    on: (n, f) => eventos[n] = f, setWindowOpenHandler() {},
    executeJavaScript: async (s) => s.includes('localStorage') ? (rede ? `http://127.0.0.1:${nuvem.address().port}` : '') : saudavel,
  }, on() {}, setMenu() {}, isMinimized: () => false, show() {}, focus() {},
    loadURL: async (url) => {
      endereco = new URL(url).origin;
      const texto = await (await fetch(url)).text(); cargas.push(texto);
      if (falhaCarga && texto !== 'telas internas') throw new Error('ERR_FAILED');
    } };
  const electron = { app: { isPackaged: true, requestSingleInstanceLock: () => false, quit() {},
    getVersion: () => '2.18.0', getPath: () => pasta, getLoginItemSettings: () => ({}) },
    BrowserWindow: function () { return janela; }, Menu: { buildFromTemplate: (x) => x },
    Tray: function () { this.setToolTip = this.setContextMenu = this.on = () => {}; },
    nativeImage: { createFromPath: () => ({ resize: () => ({}) }) },
    session: { defaultSession: { clearStorageData: async () => {} } }, ipcMain: { handle(nome, fn) { maos[nome] = fn; } } };
  const requireWindows = createRequire(new URL('../windows/main.js', import.meta.url));
  const ctx = vm.createContext({ __dirname: pasta, URL, process: { env: { LOCALAPPDATA: pasta } },
    setTimeout: (f, ms) => setTimeout(f, ms === 5000 ? 1 : ms), clearTimeout,
    setInterval: (fn, ms) => { intervalos.push({ fn, ms }); return { unref() {} }; },
    require: (n) => n === 'electron' ? electron : n === 'node:http' ? { createServer: (...args) => {
      const s = http.createServer(...args); servidores.push(s); return s;
    } } : requireWindows(n) });
  const fechar = async () => {
    for (const s of [...servidores, nuvem]) { s.closeAllConnections(); await new Promise((r) => s.close(r)); }
  };
  try {
    vm.runInContext(fs.readFileSync(path.join(raiz, 'windows/main.js'), 'utf8'), ctx);
    await vm.runInContext('ligar()', ctx);
    await esperar(() => fs.existsSync(path.join(pasta, 'janela.log')));
    return { cargas, intervalos, eventos, pedidos, destino, endereco, fechar, ctx, maos, pasta,
      remoto: (p) => { remoto = p; } };
  } catch (e) { await fechar(); throw e; }
}
try {
  await teste(g, 'pacote assinado aceito e persistido; reabre offline', async () => {
    const a = novo(); assert.equal(await instalar(a, pacote()), true);
    assert.equal(a.ativa.pacote.versao, '2.19.0');
    assert.equal(path.basename(a.ativa.pasta), 'telas-2.19.0');
    assert.equal(novo(a.destino).ativa.pacote.versao, '2.19.0');
  });
  await teste(g, 'assinatura ou arquivo adulterado recusados sem ativar', async () => {
    for (const alvo of ['pacote.json', 'pacote.sig', 'index.html']) {
      const a = novo(), p = pacote(); p[alvo] = Buffer.concat([p[alvo], Buffer.from('x')]);
      await assert.rejects(instalar(a, p)); assert.equal(a.ativa, null);
    }
  });
  await teste(g, 'chave de fora não substitui a chave pública da instalação', async () => {
    const a = novo(), p = pacote();
    const outra = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    p['pacote.sig'] = Buffer.from(crypto.sign('sha256', p['pacote.json'], outra.privateKey).toString('base64'));
    await assert.rejects(instalar(a, p), /Assinatura/); assert.equal(a.ativa, null);
  });
  await teste(g, 'versões menor e igual ignoradas, comparação numérica', async () => {
    const a = novo();
    for (const v of ['2.9.0', '2.18.0']) assert.equal(await instalar(a, pacote(v)), false);
    assert.equal(await instalar(a, pacote('2.19.0')), true);
    assert.equal(await instalar(a, pacote('2.18.9')), false);
  });
  await teste(g, 'windowsMinimo maior ignora; igual aceita', async () => {
    const a = novo();
    assert.equal(await instalar(a, pacote('2.19.0', { windowsMinimo: '2.18.1' })), false);
    assert.equal(await instalar(a, pacote('2.19.0', { windowsMinimo: '2.18.0' })), true);
    assert.equal(new AtualizadorTelas({ publico, destino: a.destino, versao: '2.17.0' }).ativa, null);
    assert.equal(new AtualizadorTelas({ publico, destino: a.destino, versao: '2.19.0' }).ativa, null);
  });
  await teste(g, 'duas aberturas ruins voltam às internas e não reinstalam a ruim', async () => {
    let a = novo(); await instalar(a, pacote());
    a.iniciarAbertura(); a.falhou(); assert.ok(a.ativa);
    a = novo(a.destino); a.iniciarAbertura(); a.falhou(); assert.equal(a.ativa, null);
    a = novo(a.destino); assert.equal(a.ativa, null);
    assert.equal(await instalar(a, pacote()), false);
    assert.equal(await instalar(a, pacote('2.20.0')), true);
  });
  await teste(g, 'processo encerrado durante duas aberturas também reverte', async () => {
    let a = novo(); await instalar(a, pacote()); a.iniciarAbertura();
    a = novo(a.destino); a.iniciarAbertura();
    assert.equal(novo(a.destino).ativa, null);
  });
  await teste(g, 'abertura confirmada zera tentativas', async () => {
    const a = novo(); await instalar(a, pacote());
    for (let i = 0; i < 3; i++) { a.iniciarAbertura(); a.confirmarAbertura(); }
    assert.ok(novo(a.destino).ativa);
  });
  await teste(g, 'arquivo alterado depois de instalar não passa na conferência ao servir', async () => {
    const a = novo(); await instalar(a, pacote());
    const dados = fs.readFileSync(path.join(a.ativa.pasta, 'index.html'));
    assert.equal(a.confere(a.ativa, 'index.html', dados), true);
    assert.equal(a.confere(a.ativa, 'index.html', Buffer.from('invasor')), false);
    assert.equal(a.confere(a.ativa, 'extra.js', dados), false);
    fs.writeFileSync(path.join(a.ativa.pasta, 'index.html'), 'invasor');
    assert.equal(novo(a.destino).ativa, null);
  });
  await teste(g, 'manifesto local adulterado não é confiado ao reabrir', async () => {
    const a = novo(); await instalar(a, pacote());
    fs.appendFileSync(path.join(a.ativa.pasta, 'pacote.json'), ' ');
    assert.equal(novo(a.destino).ativa, null);
  });
  await teste(g, 'caminhos perigosos e metadados inválidos, mesmo assinados, são recusados', async () => {
    for (const rel of ['../fora', '/absoluto', 'C:/arquivo', 'pasta\\arquivo', 'NUL', 'x:stream', 'arquivo.', 'pacote.sig']) {
      const a = novo(), p = pacote(), m = JSON.parse(p['pacote.json']);
      m.arquivos[rel] = m.arquivos['index.html']; p['pacote.json'] = Buffer.from(JSON.stringify(m));
      p['pacote.sig'] = Buffer.from(assinar(p['pacote.json']));
      await assert.rejects(instalar(a, p), /Caminho/);
    }
    for (const extras of [{ windowsMinimo: 'inválido' }, { versao: '../9' }]) {
      await assert.rejects(instalar(novo(), pacote('2.19.0', extras)), /inválido/);
    }
  });
  await teste(g, 'rede, tamanho e redirect falhos preservam o pacote ativo', async () => {
    const a = novo(); await instalar(a, pacote());
    await assert.rejects(a.atualizar('https://nuvem.example', async () => { throw new Error('offline'); }));
    await assert.rejects(a.atualizar('https://nuvem.example', async () => new Response('', { status: 302 })));
    const p = pacote('2.20.0'); p['index.html'] = Buffer.alloc(100);
    await assert.rejects(instalar(a, p), /grande demais/);
    assert.equal(a.ativa.pacote.versao, '2.19.0');
    for (const url of ['file:///tmp', 'http://localhost.example.com', 'https://a:b@x/', 'https://x/?token=teste'])
      await assert.rejects(a.atualizar(url, () => assert.fail('Não deveria baixar')));
    assert.ok(!fs.readdirSync(a.destino).some((n) => n.startsWith('.telas-')));
  });
  await teste(g, 'cópia em Documentos: só pede a tela do programa, só nome de cópia, e fica na pasta certa', async () => {
    const p = await programa({});
    try {
      const guardar = p.maos['guardar-copia'], daTela = { senderFrame: { url: p.endereco + '/' } };
      guardar(daTela, '2026-11-02.json', '[]');
      assert.equal(fs.readFileSync(path.join(p.pasta, 'Usina', 'BackupUsina', '2026-11-02.json'), 'utf8'), '[]');
      assert.throws(() => guardar(daTela, '../../fora.json', '[]'));
      assert.throws(() => guardar(daTela, 'programa.exe', '[]'));
      assert.throws(() => guardar({ senderFrame: { url: 'https://site-qualquer.com/' } }, '2026-11-02.json', '[]'));
    } finally { await p.fechar(); }
  });
  await teste(g, 'main.js serve bytes verificados e bloqueia alteração, extras e junction', async () => {
    const p = await programa({ preinstalar: true });
    try {
      assert.equal((await fetch(p.endereco)).status, 200);
      const pasta = path.join(p.destino, 'telas-2.19.0');
      fs.writeFileSync(path.join(pasta, 'index.html'), 'invasor');
      fs.writeFileSync(path.join(pasta, 'extra.js'), 'invasor');
      assert.equal((await fetch(p.endereco + '/index.html')).status, 403);
      assert.equal((await fetch(p.endereco + '/extra.js')).status, 403);
      fs.symlinkSync(publico, path.join(pasta, 'atalho'), process.platform === 'win32' ? 'junction' : 'dir');
      try { assert.equal((await fetch(p.endereco + '/atalho/index.html')).status, 403); }
      finally { fs.rmSync(path.join(pasta, 'atalho'), { recursive: true, force: true }); }
    } finally { await p.fechar(); }
  });
  await teste(g, 'main.js: página vazia ou erro de carga duas vezes retorna às internas', async () => {
    for (const falhaCarga of [false, true]) {
      const p = await programa({ preinstalar: true, saudavel: false, falhaCarga });
      try {
        assert.equal(p.cargas.length, 3); assert.equal(p.cargas[2], 'telas internas');
        assert.equal((await (await fetch(p.endereco)).text()), 'telas internas');
      } finally { await p.fechar(); }
    }
  });
  await teste(g, 'main.js: busca ao abrir e a cada 30 min, sem credenciais', async () => {
    const p = await programa({ rede: true });
    try {
      await esperar(() => p.cargas.length === 2 && vm.runInContext('atualizador.estado.falhas === 0', p.ctx));
      assert.equal(p.intervalos.length, 1); assert.equal(p.intervalos[0].ms, 30 * 60000);
      assert.equal(p.cargas[0], 'telas internas'); assert.match(p.cargas[1], /telas novas/);
      p.remoto(pacote('2.20.0')); await p.intervalos[0].fn();
      assert.equal(vm.runInContext('atualizador.ativa.pacote.versao', p.ctx), '2.20.0');
      assert.equal(p.cargas.length, 3);
      assert.ok(p.pedidos.every((r) => !r.headers.authorization && !r.headers.cookie && r.url.startsWith('/telas/')));
    } finally { await p.fechar(); }
  });
  await teste(g, 'gerador dos tablets assina windowsMinimo e pacote continua compatível com web', async () => {
    const origem = path.join(tmp, 'origem'), saida = path.join(tmp, 'saida'), chave = path.join(tmp, 'chave.pem');
    fs.mkdirSync(origem); fs.writeFileSync(path.join(origem, 'index.html'), '<main>teste</main>');
    fs.writeFileSync(path.join(origem, 'cordova.js'), '');
    fs.writeFileSync(chave, privateKey.export({ format: 'pem', type: 'pkcs8' }));
    vm.runInNewContext(fs.readFileSync(path.join(raiz, 'apk/versao-do-apk.js'), 'utf8'), {
      require, __dirname: path.join(raiz, 'apk'), console: { log() {} }, process: {
        argv: ['node', 'versao-do-apk.js', 'telas', origem, saida],
        env: { PRANCHETAS_CHAVE_TELAS: chave, PRANCHETAS_CHAVE_PUBLICA: path.join(tmp, 'chave-publica.txt'),
          PRANCHETAS_VERSAO: '2.19.0', APK_MINIMO: '2.16.0', WINDOWS_MINIMO: '2.18.0' },
      }, Buffer,
    });
    const a = novo(), p = Object.fromEntries(fs.readdirSync(saida).map((n) => [n, fs.readFileSync(path.join(saida, n))]));
    assert.equal(await instalar(a, p), true); assert.equal(a.ativa.pacote.windowsMinimo, '2.18.0');
    // O Capacitor injeta a ponte no Android; o HTML do public não a carrega no navegador.
    const html = fs.readFileSync(path.join(raiz, 'public/index.html'), 'utf8');
    assert.doesNotMatch(html, /<script[^>]+src=["'][^"']*(cordova|capacitor)/i);
    const fonteBase = fs.readFileSync(path.join(raiz, 'public/nucleo/base.js'), 'utf8');
    const expressao = /const NO_APK = ([^;]+);/.exec(fonteBase)[1];
    assert.equal(vm.runInNewContext(expressao, { window: {} }), false);
  });
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
const r = resumo([g]); console.log(JSON.stringify(r)); process.exitCode = r.falharam ? 1 : 0;
