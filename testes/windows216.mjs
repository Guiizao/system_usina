/* Pranchetas Digitais - © 2026 Guilherme. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { novoGrupo, teste, certo, resumo } from './teste.mjs';

const require = createRequire(import.meta.url);
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { lerVersao, semearApk } = require('../windows/pacote.js');
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function esperar(fn, descricao, ms = 25000) {
  const fim = Date.now() + ms;
  do { if (await fn()) return; await dormir(100); } while (Date.now() < fim);
  throw new Error('Tempo esgotado: ' + descricao);
}

async function portaLivre() {
  const s = net.createServer();
  await new Promise((r, j) => { s.once('error', j); s.listen(0, '127.0.0.1', r); });
  const porta = s.address().port;
  await new Promise((r) => s.close(r));
  return porta;
}

export async function testarWindows216(g) {
  const electron = path.join(APP, 'windows', 'node_modules', 'electron');
  if (!fs.existsSync(electron)) {
    console.log('  PULADO: windows/node_modules/electron não está instalado.');
    return;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pranchetas-windows216-'));
  const processos = [];
  let ocupada;
  try {
    await teste(g, 'versão encontrada também em subpastas de public/', async () => {
      const publico = path.join(tmp, 'public', 'js');
      fs.mkdirSync(publico, { recursive: true });
      fs.writeFileSync(path.join(publico, 'versao.js'), "const VERSAO = '2.16.3';");
      certo(lerVersao(path.dirname(publico)) === '2.16.3', 'não encontrou a versão movida');
      certo(/^\d+\.\d+\.\d+$/.test(lerVersao(path.join(APP, 'public'))), 'versão real inválida');
    });
    const origem = path.join(tmp, 'semente'), destino = path.join(tmp, 'atualizacoes');
    function pacote(versao, telas = versao) {
      fs.mkdirSync(path.join(origem, 'telas'), { recursive: true });
      fs.writeFileSync(path.join(origem, 'pranchetas.apk'), versao);
      fs.writeFileSync(path.join(origem, 'versao.json'), JSON.stringify({ versao }));
      fs.writeFileSync(path.join(origem, 'telas', 'pacote.json'), JSON.stringify({ versao: telas }));
      fs.writeFileSync(path.join(origem, 'telas', 'index.html'), telas);
    }
    await teste(g, 'primeira abertura semeia o APK e as telas', async () => {
      pacote('2.9.0'); semearApk(origem, destino);
      certo(fs.readFileSync(path.join(destino, 'pranchetas.apk'), 'utf8') === '2.9.0', 'APK não copiado');
      certo(fs.existsSync(path.join(destino, 'telas', 'index.html')), 'telas não copiadas');
    });
    await teste(g, 'atualiza com versão numérica maior e preserva telas mais novas', async () => {
      pacote('2.10.0', '2.20.0'); semearApk(origem, destino);
      pacote('2.11.0'); semearApk(origem, destino);
      certo(fs.readFileSync(path.join(destino, 'pranchetas.apk'), 'utf8') === '2.11.0', 'APK não atualizado');
      certo(fs.readFileSync(path.join(destino, 'telas', 'index.html'), 'utf8') === '2.20.0', 'telas regrediram');
    });
    await teste(g, 'versões iguais ou antigas e pacote ausente preservam o APK local', async () => {
      fs.writeFileSync(path.join(destino, 'pranchetas.apk'), 'preservado');
      pacote('2.11.0'); semearApk(origem, destino);
      pacote('2.8.0'); semearApk(origem, destino);
      semearApk(path.join(tmp, 'ausente'), destino);
      certo(fs.readFileSync(path.join(destino, 'pranchetas.apk'), 'utf8') === 'preservado', 'APK foi sobrescrito');
    });

    // A instrumentação fica no teste, fora do main de produção. Nunca usa o perfil real.
    const wrapper = path.join(tmp, 'iniciar.cjs');
    fs.writeFileSync(wrapper, `
const fs = require('node:fs');
const path = require('node:path');
const { app, dialog } = require('electron');
const pasta = process.env.WINDOWS216_PERFIL;
app.setPath('userData', path.join(pasta, 'perfil'));
dialog.showMessageBox = async (opcoes) => {
  fs.writeFileSync(path.join(pasta, 'erro.json'), JSON.stringify(opcoes));
  return { response: 0 };
};
app.on('browser-window-created', (_, janela) => {
  janela.webContents.once('did-finish-load', () => setTimeout(async () => {
    try {
      const isolado = await janela.webContents.executeJavaScript('typeof require === "undefined" && typeof process === "undefined"');
      const url = janela.webContents.getURL();
      const foto = await janela.capturePage();
      fs.writeFileSync(path.join(pasta, 'janela.png'), foto.toPNG());
      janela.close();
      fs.writeFileSync(path.join(pasta, 'pronto.json'), JSON.stringify({ isolado, url, escondida: !janela.isVisible(), destruida: janela.isDestroyed(), dados: process.env.PASTA_DADOS, apk: process.env.PASTA_APK, publico: process.env.PASTA_PUBLICA }));
    } catch (e) { fs.writeFileSync(path.join(pasta, 'falha.txt'), e.stack); app.exit(2); }
  }, 500));
});
setInterval(() => { if (fs.existsSync(path.join(pasta, 'parar'))) app.quit(); }, 100).unref();
require(${JSON.stringify(path.join(APP, 'windows', 'main.js'))});
`);
    function iniciar(pasta, porta) {
      fs.mkdirSync(path.join(pasta, 'perfil'), { recursive: true });
      const env = { ...process.env, WINDOWS216_PERFIL: pasta, PORTA: String(porta),
        PASTA_DADOS: path.join(pasta, 'dados'), PASTA_APK: path.join(pasta, 'perfil', 'apk'),
        ENDERECO: '127.0.0.1', ATUALIZACAO_ONLINE: '' };
      delete env.ELECTRON_RUN_AS_NODE;
      const executavel = path.join(electron, 'dist', fs.readFileSync(path.join(electron, 'path.txt'), 'utf8').trim());
      certo(fs.existsSync(executavel), 'binário local do Electron ausente; nenhum download foi tentado');
      const diagnostico = path.join(pasta, 'electron.log');
      const fd = fs.openSync(diagnostico, 'a');
      let proc;
      try { proc = spawn(executavel, [wrapper], { env, stdio: ['ignore', 'ignore', fd], windowsHide: true }); }
      finally { fs.closeSync(fd); }
      proc.diagnostico = () => fs.readFileSync(diagnostico, 'utf8').slice(-2000);
      proc.on('error', (e) => { proc.falha = e; });
      processos.push(proc);
      return proc;
    }
    const pasta = path.join(tmp, 'normal'), porta = await portaLivre();
    let principal;
    await teste(g, 'Electron liga /api/ping, abre a janela isolada e continua na bandeja ao fechar', async () => {
      principal = iniciar(pasta, porta);
      await esperar(async () => {
        if (principal.falha) throw principal.falha;
        if (principal.exitCode !== null) throw new Error('Electron encerrou com código ' + principal.exitCode + ': ' + principal.diagnostico());
        try { return (await (await fetch(`http://127.0.0.1:${porta}/api/ping`, { signal: AbortSignal.timeout(500) })).json()).app === 'pranchetas'; } catch { return false; }
      }, '/api/ping');
      await esperar(() => {
        if (fs.existsSync(path.join(pasta, 'falha.txt'))) throw new Error(fs.readFileSync(path.join(pasta, 'falha.txt'), 'utf8'));
        return fs.existsSync(path.join(pasta, 'pronto.json'));
      }, 'janela do Electron');
      const r = JSON.parse(fs.readFileSync(path.join(pasta, 'pronto.json'), 'utf8'));
      certo(r.url === `http://127.0.0.1:${porta}/` && r.isolado, 'URL ou isolamento incorretos');
      certo(r.escondida && !r.destruida, 'fechar não escondeu a janela');
      certo(r.dados === path.join(pasta, 'dados') && r.apk === path.join(pasta, 'perfil', 'apk'), 'pastas fora do perfil temporário');
      certo(r.publico === path.join(APP, 'public'), 'pasta pública incorreta');
      certo(fs.existsSync(path.join(r.dados, 'ServidorUsina', 'config.json')), 'configuração não foi gravada');
      certo(!fs.existsSync(path.join(pasta, 'perfil', 'windows.json')), 'teste configurou início automático');
      certo((await fetch(`http://127.0.0.1:${porta}/api/ping`)).ok, 'central parou ao fechar');
      fs.mkdirSync(path.join(APP, 'testes', 'saida'), { recursive: true });
      fs.copyFileSync(path.join(pasta, 'janela.png'), path.join(APP, 'testes', 'saida', 'windows216.png'));
    });
    await teste(g, 'segunda instância encerra sem desligar a primeira', async () => {
      certo(principal && principal.exitCode === null, 'a primeira instância não está ligada');
      const segunda = iniciar(pasta, porta);
      await esperar(() => segunda.exitCode !== null, 'segunda instância encerrar');
      certo(segunda.exitCode === 0, 'segunda instância não encerrou normalmente');
      certo(!fs.existsSync(path.join(pasta, 'erro.json')), 'segunda instância tentou ligar outra central');
      certo((await fetch(`http://127.0.0.1:${porta}/api/ping`)).ok, 'primeira central parou');
    });
    await teste(g, 'Sair encerra o Electron e libera a porta', async () => {
      certo(principal && principal.exitCode === null, 'a instância principal não está ligada');
      fs.writeFileSync(path.join(pasta, 'parar'), '');
      await esperar(() => principal.exitCode !== null, 'Electron encerrar');
      certo(principal.exitCode === 0, 'Electron não encerrou normalmente');
      const s = net.createServer();
      await new Promise((r, j) => { s.once('error', j); s.listen(porta, '127.0.0.1', r); });
      await new Promise((r) => s.close(r));
    });
    await teste(g, 'porta ocupada exibe explicação sem tocar nos dados', async () => {
      ocupada = net.createServer();
      await new Promise((r, j) => { ocupada.once('error', j); ocupada.listen(0, '127.0.0.1', r); });
      const conflito = path.join(tmp, 'conflito');
      const proc = iniciar(conflito, ocupada.address().port);
      await esperar(() => proc.exitCode !== null, 'aviso de porta ocupada');
      certo(fs.existsSync(path.join(conflito, 'erro.json')), 'Electron não abriu o aviso: ' + proc.diagnostico());
      const erro = JSON.parse(fs.readFileSync(path.join(conflito, 'erro.json'), 'utf8'));
      certo(proc.exitCode === 1 && erro.message.includes('já está sendo usada'), 'não explicou a porta ocupada');
      certo(!fs.existsSync(path.join(conflito, 'dados')), 'alterou dados antes de conferir a porta');
      certo(ocupada.listening, 'encerrou o servidor que ocupava a porta');
    });
  } finally {
    if (ocupada?.listening) await new Promise((r) => ocupada.close(r));
    for (const proc of processos) {
      if (proc.exitCode !== null || !proc.pid) continue;
      if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      else proc.kill();
    }
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const g = novoGrupo('Aplicativo Windows 2.16');
  await testarWindows216(g);
  const r = resumo([g]);
  console.log(`${r.passaram} de ${r.total} testes passaram.`);
  process.exitCode = r.falharam ? 1 : 0;
}
