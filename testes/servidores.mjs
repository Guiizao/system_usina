/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Liga centrais de teste, cada uma com a sua pasta de dados: a do computador (server.js) e a do tablet chefe (ServidorCentral.java). */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dormir } from './navegador.mjs';
import { conectarTeste } from './cifra.mjs';
import { SENHA_ENCARREGADO } from './teste.mjs';

export const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const JDK = path.join(os.homedir(), 'android-build', 'jdk', 'bin');

async function esperarNoAr(url, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url + '/api/ping'); if (r.ok) return; } catch { /* ainda ligando */ }
    await dormir(200);
  }
  throw new Error('a central não ligou: ' + url);
}

/** Senha do programador nas centrais de teste (a de verdade não fica nos testes). */
export const SENHA_PROGRAMADOR_TESTE = '24682468';
const HASH_TESTE = 'pbkdf2$600000$eca09b6f4e096eed6a6b4bc6d7ad3de4$c236989776ddd876e1035cc4d8696150908b24fff8e70ea34b476475092e374f'; // PBKDF2 (versão 2.12), como o da senha de verdade

export function pastaTemporaria(nome) { return fs.mkdtempSync(path.join(os.tmpdir(), `pranchetas-${nome}-`)); }

/** Um aparelho de teste conectado na central (pelo código, com a conexão embaralhada, como o aplicativo).
    api(rota, corpo) devolve o JSON; se o código for trocado, conecta de novo. */
function comCliente(central) {
  let cli = null;
  central.cliente = async () => {
    if (!cli) {
      cli = await conectarTeste(central.url, central.codigo());
      if (!cli.pedir) throw new Error('a central recusou o aparelho de teste: ' + cli.erro);
      // versão 2.12: o aparelho de teste é um tablet chefe liberado (nível 2) com o dono dentro, como no escritório
      await cli.pedir('/api/chefes', { corpo: { acao: 'liberar', pin: SENHA_ENCARREGADO, nivel: 2 } });
      await cli.pedir('/api/pessoas', { corpo: { acao: 'entrar', pin: SENHA_ENCARREGADO } });
    }
    return cli;
  };
  central.api = async (rota, corpo) => {
    let r = await (await central.cliente()).pedir(rota, { corpo });
    if (r.status === 401 && r.fora) { cli = null; r = await (await central.cliente()).pedir(rota, { corpo }); }
    return r.json;
  };
  return central;
}

/** Central do computador. Devolve { url, pasta, codigo(), chave(), api(), reiniciar(), desligar() }. */
export async function centralNode(porta, pasta = pastaTemporaria('node'), publico, extras = {}) {
  let proc;
  const ligar = async () => {
    proc = spawn(process.execPath, [path.join(APP, 'server.js')], { env: Object.assign({}, process.env, { PORTA: String(porta), PASTA_DADOS: pasta, ENDERECO: '127.0.0.1', SENHA_PROGRAMADOR_HASH: HASH_TESTE, ATUALIZACAO_ONLINE: '' }, publico ? { PASTA_PUBLICA: publico } : {}, extras), stdio: 'ignore' });
    await esperarNoAr(`http://127.0.0.1:${porta}`);
  };
  await ligar();
  const cfg = () => JSON.parse(fs.readFileSync(path.join(pasta, 'ServidorUsina', 'config.json'), 'utf8'));
  return comCliente({
    tipo: 'computador (server.js)', url: `http://127.0.0.1:${porta}`, pasta, pastaServidor: path.join(pasta, 'ServidorUsina'), pastaRelatorios: path.join(pasta, 'RelatoriosUsina'), pastaBackup: path.join(pasta, 'BackupUsina'),
    codigo: () => cfg().codigo, chave: () => cfg().chave,
    async reiniciar() { proc.kill(); await dormir(700); await ligar(); },
    async desligar() { proc.kill(); await dormir(300); },
  });
}

/** Central do tablet chefe (o mesmo ServidorCentral.java do APK), rodando no computador com peças do Android simuladas. */
export async function centralJava(porta, pasta = pastaTemporaria('java'), extras = {}) {
  const pastaJava = path.join(APP, 'testes', 'java');
  const saida = path.join(pastaJava, 'saida');
  const fontes = [];
  const juntar = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? juntar(path.join(d, e.name)) : e.name.endsWith('.java') && fontes.push(path.join(d, e.name))));
  juntar(path.join(pastaJava, 'stubs'));
  fontes.push(path.join(APP, 'apk', 'nativo', 'java', 'br', 'com', 'ubiralcool', 'pranchetas', 'ServidorCentral.java'), path.join(APP, 'apk', 'nativo', 'java', 'br', 'com', 'ubiralcool', 'pranchetas', 'AtualizadorDeTelas.java'), path.join(pastaJava, 'RodarServidorJava.java'));
  fs.rmSync(saida, { recursive: true, force: true });
  execFileSync(path.join(JDK, 'javac.exe'), ['-encoding', 'UTF-8', '-d', saida, ...fontes], { stdio: 'inherit' });
  let proc;
  const ligar = async () => {
    const opcoes = [
      ...(extras.REGISTRO_SEM_SINAL_MS ? ['-Dpranchetas.semSinal=' + extras.REGISTRO_SEM_SINAL_MS] : []),
    ];
    proc = spawn(path.join(JDK, 'java.exe'), ['-Dpranchetas.ip=127.0.0.1', '-Dpranchetas.senhaProgramadorHash=' + HASH_TESTE, ...opcoes, '-cp', saida, 'RodarServidorJava', String(porta), pasta, APP], { stdio: 'ignore' });
    await esperarNoAr(`http://127.0.0.1:${porta}`);
  };
  await ligar();
  const cfg = () => JSON.parse(fs.readFileSync(path.join(pasta, 'ServidorUsina', 'config.json'), 'utf8'));
  return comCliente({
    tipo: 'tablet chefe (ServidorCentral.java)', url: `http://127.0.0.1:${porta}`, pasta, pastaServidor: path.join(pasta, 'ServidorUsina'), pastaRelatorios: path.join(pasta, 'RelatoriosUsina'), pastaBackup: path.join(pasta, 'BackupUsina'),
    codigo: () => cfg().codigo, chave: () => cfg().chave,
    async reiniciar() { proc.kill(); await dormir(900); await ligar(); },
    async desligar() { proc.kill(); await dormir(300); },
  });
}
