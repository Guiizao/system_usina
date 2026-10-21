/* Revisão 2.16: código real em contextos isolados, sem janela Electron nem dados da usina. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { novoGrupo, teste, certo, igual, resumo } from './teste.mjs';
const require = createRequire(import.meta.url);
const fonte = (arq) => fs.readFileSync(new URL('../' + arq, import.meta.url), 'utf8');

export async function testarWindowsSeguranca216(g) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pranchetas-seguranca216-'));
  const publico = path.join(pasta, 'public'), fora = path.join(pasta, 'fora');
  fs.mkdirSync(publico); fs.mkdirSync(fora);
  fs.writeFileSync(path.join(publico, 'index.html'), 'telas');
  fs.writeFileSync(path.join(fora, 'privado.txt'), 'segredo-ficticio');
  fs.symlinkSync(fora, path.join(publico, 'atalho'), process.platform === 'win32' ? 'junction' : 'dir');
  const eventos = {}, externos = [], servidores = [];
  const janela = { webContents: { on: (n, f) => eventos[n] = f, setWindowOpenHandler: (f) => eventos.abrir = f },
    on() {}, setMenu() {}, loadURL: async () => {}, isMinimized: () => false, show() {}, focus() {} };
  const electron = { app: { isPackaged: true, requestSingleInstanceLock: () => false, quit() {}, getPath: () => pasta,
    getLoginItemSettings: () => ({}) }, BrowserWindow: function () { return janela; },
    session: { defaultSession: { clearStorageData: async () => {} } },
    nativeImage: { createFromPath: () => ({ resize: () => ({}) }) },
    Tray: function () { this.setToolTip = this.setContextMenu = this.on = () => {}; }, Menu: { buildFromTemplate: (x) => x },
    shell: { openExternal: async (url) => externos.push(url) }, dialog: { showErrorBox() {} } };
  const ctx = vm.createContext({ __dirname: pasta, URL, setTimeout, require: (nome) => nome === 'electron' ? electron
    : nome === 'node:http' ? { createServer: (...args) => { const s = http.createServer(...args); servidores.push(s); return s; } } : require(nome) });
  try {
    vm.runInContext(fonte('windows/main.js'), ctx);
    await vm.runInContext('ligar()', ctx);
    const pedir = (caminho) => new Promise((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port: servidores[0].address().port, path: caminho }, (r) => {
        r.resume(); r.on('end', () => resolve(r.statusCode));
      }).on('error', reject);
    });
    await teste(g, 'Windows sem janela: traversal, codificação, barra invertida e % quebrado', async () => {
      for (const p of ['/../fora/privado.txt', '/%2e%2e/fora/privado.txt', '/..%5cfora%5cprivado.txt', '/%252e%252e/fora/privado.txt'])
        certo(await pedir(p) !== 200, p);
      igual(await pedir('/%E0%A4%A'), 400); igual(await pedir('/index.html'), 200);
    });
    await teste(g, 'Windows sem janela: link/junction não entrega arquivo fora de public', async () => {
      igual(await pedir('/atalho/privado.txt'), 403);
    });
    await teste(g, 'Windows sem janela: log não guarda senha, token, query nem fragmento', async () => {
      eventos['console-message']({ level: 3, message: 'senha=PIN-FICTICIO token=TOKEN-FICTICIO', sourceId: 'https://x/?token=TOKEN-FICTICIO', lineNumber: 8 });
      eventos['did-fail-load']({}, -2, 'TOKEN-FICTICIO', 'https://x/?senha=PIN-FICTICIO#TOKEN-FICTICIO');
      const log = fs.readFileSync(path.join(pasta, 'janela.log'), 'utf8');
      certo(!/PIN-FICTICIO|TOKEN-FICTICIO/.test(log), 'segredo apareceu no log');
    });
    await teste(g, 'Windows sem janela: navegação externa bloqueada e protocolos perigosos não abrem', async () => {
      for (const url of ['file:///C:/privado', 'javascript:alert(1)', 'ms-settings:']) eventos.abrir({ url });
      igual(externos.length, 0);
      let bloqueou = false;
      eventos['will-navigate']({ preventDefault: () => bloqueou = true }, 'https://example.com/');
      certo(bloqueou); igual(externos, ['https://example.com/']);
    });
  } finally {
    for (const s of servidores) { s.closeAllConnections(); await new Promise((r) => s.close(r)); }
    // Remova a junção antes da pasta temporária para nunca percorrer seu destino.
    fs.rmSync(path.join(publico, 'atalho'), { recursive: true, force: true });
    fs.rmSync(pasta, { recursive: true, force: true });
  }
}

function cliente() {
  const ctx = vm.createContext({ URL, NO_APK: false, cfg: { deviceId: 'pc-teste' }, window: {}, registros: {}, document: { getElementById: () => null },
    pedirSenhaModal: async () => '2468', toast() {}, salvarCfg() {}, salvarRegistros() {}, marcarNuvem() {},
    atualizarConexao() {}, primeiroDiaGuardado: () => '2026-10-01', render() {}, turnoDaPessoa: () => 'turno',
    ed: {}, telaInicial: () => ({}), pilha: [], view: () => ({ tela: 'nuvem-entrar' }) });
  vm.runInContext(fonte('public/nucleo/conexao.js') + '\n' + fonte('public/paginas/entrar-pela-nuvem.js'), ctx);
  return ctx;
}
export async function testarClienteSeguranca216(g) {
  await teste(g, 'cliente: endereço enganoso não recebe PIN nem solicita senha', async () => {
    for (const url of ['http://localhost.example.com', 'http://127.0.0.1.example.com', 'http://localhost@evil.example', 'https://x/#fragmento', 'https://x/?token=teste', 'https://usuario:senha@x/']) {
      const c = cliente(); let pedidos = 0, senhas = 0;
      c.fetch = async () => { pedidos++; return { status: 401, json: async () => ({}) }; };
      c.pedirSenhaModal = async () => { senhas++; return '2468'; };
      vm.runInContext('nuvemForm.url = ' + JSON.stringify(url), c);
      await vm.runInContext('entrarPelaNuvem()', c);
      igual([pedidos, senhas], [0, 0], url);
    }
  });
  await teste(g, 'cliente: login recusa redirect; PIN não persiste e sair apaga token', async () => {
    const c = cliente(); let opcoes;
    c.fetch = async (url, o) => { opcoes = o; return { status: 401, json: async () => ({}) }; };
    vm.runInContext("nuvemForm.url = 'http://127.0.0.1:1234'", c);
    await vm.runInContext('entrarPelaNuvem()', c);
    igual(opcoes.redirect, 'error'); certo(!JSON.stringify(c.cfg).includes('2468'));
    c.cfg.nuvemToken = 'token'; c.cfg.pessoa = { nome: 'Teste' };
    vm.runInContext('sairDaNuvem()', c);
    igual(c.cfg.nuvemToken, ''); igual(c.cfg.pessoa, null);
  });
  await teste(g, 'cliente: sync e fila recusam URL insegura e redirect', async () => {
    for (const funcao of ['sincronizarNuvem', 'mandarParaNuvem']) {
      const c = cliente(); let pedidos = 0, opcoes;
      Object.assign(c.cfg, { nuvemUrl: 'http://localhost.example.com', nuvemToken: 'token' });
      c.registros.r = { id: 'r', atualizadoEm: 1 };
      c.fetch = async (url, o) => { pedidos++; opcoes = o; return { status: 500 }; };
      await vm.runInContext(funcao + '()', c); igual(pedidos, 0);
      c.cfg.nuvemUrl = 'https://example.com';
      vm.runInContext('sync.nuvemEm = 0', c);
      await vm.runInContext(funcao + '()', c); igual(opcoes.redirect, 'error');
    }
  });
  await teste(g, 'cliente: 401 da fila antiga também encerra sessão de leitura', async () => {
    const c = cliente(); Object.assign(c.cfg, { soNuvem: true, nuvemUrl: 'https://example.com', nuvemToken: 'token', pessoa: {} });
    c.registros.r = { id: 'r', atualizadoEm: 1 };
    c.fetch = async () => ({ status: 401 });
    await vm.runInContext('mandarParaNuvem()', c); igual(c.cfg.nuvemToken, '');
  });
  await teste(g, 'cliente: resposta atrasada não grava depois de sair', async () => {
    const c = cliente(); Object.assign(c.cfg, { soNuvem: true, nuvemUrl: 'https://example.com', nuvemToken: 'token', pessoa: {} });
    let concluir, iniciou;
    const chamado = new Promise((r) => iniciou = r);
    c.fetch = () => new Promise((r) => { concluir = r; iniciou(); });
    c.versaoNaSincronizacao = () => {}; c.podar = () => {};
    const sync = vm.runInContext('sincronizarNuvem()', c); await chamado;
    vm.runInContext('sairDaNuvem()', c);
    concluir({ status: 200, ok: true, json: async () => ({ registros: [{ id: 'tardio', atualizadoEm: 1 }], seq: 1 }) });
    await sync; igual(Object.keys(c.registros), []);
  });
}
export async function testarTextoSeguranca216(g) {
  await teste(g, 'texto remoto fica escapado no menu, totais, gráfico e resumo exportado para a tela', async () => {
    const texto = '\"><img src=x onerror=alert(1)>';
    const totais = [{ nome: texto, unidade: texto, folha: 'insumo', total: 2, turnos: [{ t: { nome: texto }, q: 2 }] }];
    let modal;
    const c = vm.createContext({ C: { inicioDoDia: 7 }, cfg: { soNuvem: true }, texto,
      pessoaAtual: () => ({ nome: texto }), ico: () => '', pode: () => true, avisosEmAberto: () => [],
      setores: () => [{ id: 'setor', nome: texto, pranchetas: ['insumo'] }], diaFechado: () => '2026-10-20',
      totaisPorTurno: () => totais, folhasDe: (p) => [p], prancheta: () => ({ nome: texto, tipo: 'insumo' }),
      resumoPrancheta: () => ({ texto }), listarPapel: () => [], buscarDia: async () => {},
      abrirModal: async (html) => { modal = html; return 'x'; }, fetch: async () => ({ arrayBuffer: async () => new ArrayBuffer(0) }) });
    for (const arq of ['nucleo/datas-e-turnos.js', 'chefe/menu-pc.js', 'chefe/painel.js', 'chefe/graficos.js', 'chefe/exportar.js', 'chefe/relatorios.js'])
      vm.runInContext(fonte('public/' + arq), c);
    const saidas = [vm.runInContext("menuPc({ tela: 'central' })", c), vm.runInContext("blocoTotais('2026-10-20')", c),
      vm.runInContext('htmlDoGrafico({ titulo: texto, unidade: texto, faixas: [], series: [{ nome: texto, cor: 1, dec: 0, pontos: [{ x: 0, y: 2, onde: texto }] }] }, false)', c)];
    await vm.runInContext("verResumo('2026-10-20')", c); saidas.push(modal);
    for (const html of saidas) { certo(html.includes('&lt;img'), 'teste não atingiu o texto remoto'); certo(!html.includes('<img src=x'), 'HTML remoto foi interpretado'); }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const g = novoGrupo('Segurança 2.16');
  await testarWindowsSeguranca216(g); await testarClienteSeguranca216(g); await testarTextoSeguranca216(g);
  const r = resumo([g]); console.log(JSON.stringify(r)); process.exitCode = r.falharam ? 1 : 0;
}
