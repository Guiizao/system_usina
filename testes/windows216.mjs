/* Pranchetas Digitais - © 2026 Guilherme. */
/* Programa do Windows (2.16): só o painel pela nuvem. Abre as telas num endereço local (127.0.0.1, porta do Windows),
   sem central, sem a porta 8080 e sem APK; uma instância só. node testes/windows216.mjs */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { novoGrupo, teste, certo, resumo } from './teste.mjs';

const require = createRequire(import.meta.url);
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { lerVersao } = require('../windows/pacote.js');
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
async function esperar(fn, descricao, ms = 25000) {
  const fim = Date.now() + ms;
  do { const v = await fn(); if (v) return v; await dormir(150); } while (Date.now() < fim);
  throw new Error('Tempo esgotado: ' + descricao);
}
const portaOcupada = (porta) => new Promise((r) => { const s = net.connect(porta, '127.0.0.1'); s.once('connect', () => { s.destroy(); r(true); }); s.once('error', () => r(false)); });

export async function testarWindows216(g) {
  const exe = path.join(APP, 'windows', 'node_modules', 'electron', 'dist', 'electron.exe');
  await teste(g, 'versão encontrada nas pastas do public/', async () => {
    certo(/^\d+\.\d+\.\d+$/.test(lerVersao(path.join(APP, 'public'))), 'versão real inválida');
  });
  if (!fs.existsSync(exe)) { console.log('  PULADO: windows/node_modules/electron não está instalado.'); return; }
  // abre a janela do programa na tela deste computador: só com --janela (pedido do Guilherme: o teste do painel é pela
  // nuvem, no navegador, em testes/painel-nuvem216.mjs)
  if (!process.argv.includes('--janela')) { console.log('  PULADO: a janela do programa (node testes/windows216.mjs --janela).'); return; }
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'pranchetas-windows216-'));
  const abrir = () => spawn(exe, [path.join(APP, 'windows', 'main.js'), `--user-data-dir=${dados}`], { stdio: 'ignore' });
  const primeira = abrir();
  try {
    let endereco = '';
    await teste(g, 'abre o painel num endereço local, com a tela de entrar pela nuvem', async () => {
      const log = path.join(dados, 'janela.log');
      endereco = await esperar(() => fs.existsSync(log) && (/abrindo (http:\/\/127\.0\.0\.1:\d+)/.exec(fs.readFileSync(log, 'utf8')) || [])[1], 'o registro da janela');
      const html = await (await fetch(endereco + '/?nuvem=1')).text();
      certo(html.includes('entrar-pela-nuvem.js') || html.includes('app.js'), 'as telas não vieram');
      certo((await fetch(endereco + '/../server.js')).status !== 200, 'entregou arquivo fora das telas');
      certo(!/a página caiu/.test(fs.readFileSync(log, 'utf8')), 'a página caiu: ' + fs.readFileSync(log, 'utf8').slice(-300));
    });
    await teste(g, 'sem central: a porta 8080 continua livre', async () => {
      certo(!(await portaOcupada(8080)) || !endereco.endsWith(':8080'), 'o programa abriu a porta 8080');
    });
    await teste(g, 'segunda instância fecha sem derrubar a primeira', async () => {
      const segunda = abrir();
      const saiu = await new Promise((r) => { segunda.once('exit', () => r(true)); setTimeout(() => r(false), 15000); });
      certo(saiu, 'a segunda instância ficou aberta');
      certo(primeira.exitCode === null, 'a primeira fechou');
    });
  } finally {
    primeira.kill();
    await dormir(500);
    fs.rmSync(dados, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const g = novoGrupo('Aplicativo Windows 2.16');
  await testarWindows216(g);
  resumo([g]);
}
