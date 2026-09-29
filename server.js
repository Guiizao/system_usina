/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Central das Pranchetas Ubirálcool
 * ---------------------------------
 * Roda no computador do escritório (ou mini PC) ligado no Wi-Fi da usina.
 * Os tablets e celulares se conectam nela pela rede da usina.
 *
 * Uso:  node server.js          (porta padrão 8080)
 *       PORTA=9000 node server.js
 *
 * Segurança:
 *  - só aceita aparelhos da rede interna (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
 *  - cada aparelho precisa do código de conexão (6 números) mostrado aqui e no tablet chefe
 *  - o código não passa aberto no Wi-Fi: vai só uma prova dele, presa a um segredo combinado (X25519)
 *  - depois de conectado, cada aparelho tem a sua chave e tudo passa embaralhado (AES-256-GCM, public/cifra.js)
 *
 * Não precisa instalar nada além do Node.js. Os dados ficam em ./dados/ServidorUsina,
 * os relatórios em ./dados/RelatoriosUsina e os backups diários em ./dados/BackupUsina.
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORTA = Number(process.env.PORTA || process.env.PORT || 8080);
// PASTA_PUBLICA: os testes usam para rodar o aplicativo do jeito que vai no APK (embaralhado)
const PUBLICO = process.env.PASTA_PUBLICA ? path.resolve(process.env.PASTA_PUBLICA) : path.join(__dirname, 'public');
// PASTA_APK: os testes usam outra pasta, para não mexer no APK de verdade
const PASTA_APK = process.env.PASTA_APK ? path.resolve(process.env.PASTA_APK) : path.join(__dirname, 'apk', 'saida');
const APK = path.join(PASTA_APK, 'pranchetas.apk');
// versão, tamanho, SHA-256 e novidades do APK (o gerar-apk.ps1 escreve, ou vem da nuvem junto com o APK)
const APK_VERSAO = path.join(PASTA_APK, 'versao.json');
// Pastas da usina, todas com final "Usina", dentro de app/dados
const DADOS = process.env.PASTA_DADOS ? path.resolve(process.env.PASTA_DADOS) : path.join(__dirname, 'dados'); // os testes usam uma pasta separada
const PASTAS = {
  servidor: path.join(DADOS, 'ServidorUsina'),
  relatorios: path.join(DADOS, 'RelatoriosUsina'),
  backup: path.join(DADOS, 'BackupUsina'),
};
Object.values(PASTAS).forEach((p) => fs.mkdirSync(p, { recursive: true }));
// quem já usava a versão antiga: move os arquivos para as pastas novas
[['registros.json', PASTAS.servidor], ['config.json', PASTAS.servidor]].forEach(([nome, destino]) => {
  const antigo = path.join(DADOS, nome);
  if (fs.existsSync(antigo) && !fs.existsSync(path.join(destino, nome))) fs.renameSync(antigo, path.join(destino, nome));
});
[['backup', PASTAS.backup], ['relatorios', PASTAS.relatorios]].forEach(([nome, destino]) => {
  const antiga = path.join(DADOS, nome);
  if (!fs.existsSync(antiga)) return;
  fs.readdirSync(antiga).forEach((item) => { if (!fs.existsSync(path.join(destino, item))) fs.renameSync(path.join(antiga, item), path.join(destino, item)); });
  fs.rmSync(antiga, { recursive: true, force: true });
});
const ARQUIVO = path.join(PASTAS.servidor, 'registros.json');
const CONFIG = path.join(PASTAS.servidor, 'config.json');
const ERROS = path.join(PASTAS.servidor, 'erros.log');

// erros que os aparelhos mandam: uma linha JSON por erro; passou de 2 MB, guarda o antigo e começa outro
function guardarErros(aparelho, lista, ip) {
  if (!Array.isArray(lista) || !lista.length) return;
  const corta = (v, n) => String(v == null ? '' : v).slice(0, n);
  const linhas = lista.slice(0, 50).map((e) => JSON.stringify({
    recebidoEm: Date.now(), aparelho: corta(aparelho, 40), ip, quando: Number(e && e.quando) || null,
    versao: corta(e && e.versao, 20), papel: corta(e && e.papel, 40), tela: corta(e && e.tela, 40),
    msg: corta(e && e.msg, 300), detalhe: corta(e && e.detalhe, 900),
  })).join('\n') + '\n';
  try {
    if (fs.existsSync(ERROS) && fs.statSync(ERROS).size > 2 * 1024 * 1024) fs.renameSync(ERROS, ERROS.replace('.log', '-antigo.log'));
    fs.appendFileSync(ERROS, linhas);
  } catch (e) { /* registro de erro é melhor esforço */ }
}
function ultimosErros(n) {
  try {
    return fs.readFileSync(ERROS, 'utf8').trim().split('\n').slice(-n).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  } catch (e) { return []; }
}

// ---------- senha do programador: só ela apaga todos os dados do sistema ----------
// fica só o resumo (hash) da senha; os testes usam uma senha própria (SENHA_PROGRAMADOR_HASH)
const HASH_PROGRAMADOR = process.env.SENHA_PROGRAMADOR_HASH || 'f3a1f608cc2b347ff635467ec7440a8e1f8171a889e3feb02137a7d642debbc1';
const senhaDoProgramador = (s) => crypto.createHash('sha256').update(String(s || '')).digest('hex') === HASH_PROGRAMADOR;

// ---------- configuração: chave da rede e código de conexão ----------
const novoCodigo = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
let config;
try { config = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch (e) {
  config = { nome: 'Rede Ubirálcool', chave: crypto.randomBytes(18).toString('hex'), codigo: novoCodigo() };
  fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2));
}
const salvarConfig = () => fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2));
// "geração" dos dados: muda quando o escritório zera as anotações de teste; os tablets veem e limpam o que têm
if (!config.geracao) { config.geracao = crypto.randomBytes(6).toString('hex'); salvarConfig(); }

// ---------- criptografia do Wi-Fi (a mesma do public/cifra.js) ----------
// par de chaves da central: o aparelho que conecta combina com ela um segredo que quem espia o Wi-Fi não calcula
const DER_PRIVADA = Buffer.from('302e020100300506032b656e04220420', 'hex');
const DER_PUBLICA = Buffer.from('302a300506032b656e032100', 'hex');
if (!/^[0-9a-f]{64}$/.test(config.par || '')) {
  config.par = crypto.generateKeyPairSync('x25519').privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32).toString('hex');
  salvarConfig();
}
const privadaPar = crypto.createPrivateKey({ key: Buffer.concat([DER_PRIVADA, Buffer.from(config.par, 'hex')]), format: 'der', type: 'pkcs8' });
const PUB_PAR = crypto.createPublicKey(privadaPar).export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
const hmac = (chave, texto) => crypto.createHmac('sha256', chave).update(texto).digest();
/** Chave de cada aparelho: sai da chave da rede (trocar o código troca a da rede e desconecta todos). */
const chaveDoAparelho = (aparelho) => hmac(config.chave, 'aparelho|' + aparelho);
function selar(chave, texto, aad) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', chave, iv); c.setAAD(aad);
  return Buffer.concat([iv, c.update(texto), c.final(), c.getAuthTag()]);
}
function abrir(chave, pacote, aad) {
  if (pacote.length < 28) throw new Error('pacote curto');
  const d = crypto.createDecipheriv('aes-256-gcm', chave, pacote.subarray(0, 12)); d.setAAD(aad); d.setAuthTag(pacote.subarray(pacote.length - 16));
  return Buffer.concat([d.update(pacote.subarray(12, pacote.length - 16)), d.final()]);
}
// pedido gravado por alguém e mandado de novo é recusado: vale só por 5 minutos e cada um só uma vez
const JANELA = 5 * 60000;
const pedidosVistos = new Map(); // iv -> quando
function jaVisto(iv) {
  const agora = Date.now();
  for (const [k, t] of pedidosVistos) { if (agora - t < 2 * JANELA) break; pedidosVistos.delete(k); }
  if (pedidosVistos.has(iv)) return true;
  pedidosVistos.set(iv, agora);
  return false;
}
const ATUALIZE = 'Atualize o aplicativo: a central agora usa a conexão embaralhada (versão 2.5).';

// ---------- API só de leitura para o sistema do escritório (api-leitura.js) ----------
// senha de leitura: a do ambiente TOKEN_LEITURA ou uma sorteada na primeira vez (fica em ServidorUsina/config.json)
if (!config.tokenLeitura) { config.tokenLeitura = crypto.randomBytes(24).toString('base64url'); salvarConfig(); }
const TOKEN_LEITURA = process.env.TOKEN_LEITURA || config.tokenLeitura;
const leitura = require('./api-leitura');
let apiLeituraPronta = null;
const medidasDoEscritorio = () => { const c = db.registros['config|sistema|geral']; return c && !c.apagado && c.valores ? c.valores.medicao || null : null; };
const apiDeLeitura = () => apiLeituraPronta || (apiLeituraPronta = leitura.criar(leitura.carregarPranchetas(PUBLICO), medidasDoEscritorio));

/* ---------- Atualização do aplicativo (versão 2.7) ----------
   Os tablets perguntam em /api/versao qual APK a central tem. Se for mais novo que o deles, aparece o botão Atualizar.
   Com o endereço da nuvem (forms.js: atualizacaoOnline, ou ATUALIZACAO_ONLINE), a central olha lá de tempos em tempos,
   baixa o APK novo, confere o tamanho e o SHA-256 e passa a entregar para os tablets pelo Wi-Fi. */
const numeroDaVersao = (v) => { const p = String(v || '').split('.').map((x) => parseInt(x, 10) || 0); return (p[0] || 0) * 10000 + (p[1] || 0) * 100 + (p[2] || 0); };
function versaoDoApk() {
  try {
    const v = JSON.parse(fs.readFileSync(APK_VERSAO, 'utf8'));
    if (!v.versao || fs.statSync(APK).size !== v.tamanho) return null; // APK trocado sem o versao.json: não oferece
    return { versao: v.versao, tamanho: v.tamanho, sha256: v.sha256, url: '/apk/pranchetas.apk', novidades: Array.isArray(v.novidades) ? v.novidades : [] };
  } catch (e) { return null; }
}
/** GET simples (http ou https, segue até 3 redirecionamentos). Devolve os bytes. */
function baixarDaInternet(endereco, limite, voltas = 0) {
  return new Promise((resolve, reject) => {
    const cliente = endereco.startsWith('https:') ? https : http;
    const req = cliente.get(endereco, { timeout: 30000, headers: { 'User-Agent': 'pranchetas-central' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && voltas < 3) {
        res.resume();
        return resolve(baixarDaInternet(new URL(res.headers.location, endereco).href, limite, voltas + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`${endereco} respondeu ${res.statusCode}`)); }
      const partes = []; let total = 0;
      res.on('data', (b) => { total += b.length; if (total > limite) { req.destroy(new Error('arquivo grande demais')); return; } partes.push(b); });
      res.on('end', () => resolve(Buffer.concat(partes)));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('a internet não respondeu')));
    req.on('error', reject);
  });
}
let procurandoOnline = false;
async function buscarAtualizacaoOnline() {
  let base = process.env.ATUALIZACAO_ONLINE;
  if (base === undefined) { try { base = leitura.carregarPranchetas(PUBLICO).atualizacaoOnline; } catch (e) { base = ''; } }
  if (!base || procurandoOnline) return;
  procurandoOnline = true;
  const raiz = base.replace(/\/?$/, '/');
  try {
    const v = JSON.parse((await baixarDaInternet(raiz + 'versao.json', 1024 * 1024)).toString('utf8'));
    const atual = versaoDoApk();
    if (!v.versao || numeroDaVersao(v.versao) <= numeroDaVersao(atual ? atual.versao : '0')) return;
    const apk = await baixarDaInternet(new URL(v.url || 'pranchetas.apk', raiz).href, 300 * 1024 * 1024);
    if (apk.length !== v.tamanho || crypto.createHash('sha256').update(apk).digest('hex') !== String(v.sha256 || '').toLowerCase()) {
      throw new Error('o APK da internet veio diferente do versao.json');
    }
    fs.mkdirSync(PASTA_APK, { recursive: true });
    fs.writeFileSync(APK + '.novo', apk);
    fs.renameSync(APK + '.novo', APK);
    fs.writeFileSync(APK_VERSAO, JSON.stringify({ versao: v.versao, tamanho: v.tamanho, sha256: String(v.sha256).toLowerCase(), novidades: Array.isArray(v.novidades) ? v.novidades : [] }, null, 2));
    console.log(`  Versão ${v.versao} do aplicativo baixada da internet. Os tablets já podem atualizar.`);
  } catch (e) {
    console.log('  Atualização pela internet: ' + e.message);
  } finally { procurandoOnline = false; }
}
const mesmoSegredo = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
function diasComAnotacao() {
  const n = {};
  Object.values(db.registros).forEach((r) => { if (leitura.publica(r) && !r.apagado) n[r.data] = (n[r.data] || 0) + 1; });
  fs.readdirSync(PASTAS.backup).forEach((f) => { const m = f.match(/^(\d{4}-\d{2}-\d{2})\.json$/); if (m && !n[m[1]]) n[m[1]] = lerDiaArquivado(m[1]).filter((r) => leitura.publica(r) && !r.apagado).length; });
  return n;
}
function apiLeitura(req, res, url) {
  if (req.method !== 'GET') return json(res, 405, { erro: 'A API é só de leitura: use GET' });
  const auth = String(req.headers.authorization || '');
  if (!/^Bearer\s+/i.test(auth) || !mesmoSegredo(auth.replace(/^Bearer\s+/i, '').trim(), TOKEN_LEITURA)) {
    return json(res, 401, { erro: 'Senha de leitura errada ou faltando. Mande o cabeçalho Authorization: Bearer <senha>' });
  }
  const api = apiDeLeitura();
  const p = url.pathname;
  if (p === '/api/v1/esquema') return json(res, 200, api.esquema());
  if (p === '/api/v1/dias') {
    const de = url.searchParams.get('de'); const ate = url.searchParams.get('ate');
    const dias = Object.entries(diasComAnotacao()).filter(([d, n]) => n && (!leitura.ehDia(de) || d >= de) && (!leitura.ehDia(ate) || d <= ate))
      .sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([data, anotacoes]) => ({ data, anotacoes }));
    return json(res, 200, { dias });
  }
  const m = p.match(/^\/api\/v1\/dias\/(\d{4}-\d{2}-\d{2})$/);
  if (m) {
    const regs = arquivado(m[1]) ? lerDiaArquivado(m[1]) : Object.values(db.registros).filter((r) => r.data === m[1]);
    return json(res, 200, api.dia(m[1], regs.filter(leitura.publica)));
  }
  if (p === '/api/v1/registros') {
    const desde = Number(url.searchParams.get('desde') || 0) || 0;
    const limite = Math.min(2000, Math.max(1, Number(url.searchParams.get('limite') || 500) || 500));
    const novos = Object.values(db.registros).filter((r) => r.seq > desde && leitura.publica(r)).sort((a, b) => a.seq - b.seq);
    const lote = novos.slice(0, limite);
    return json(res, 200, { seq: lote.length ? lote[lote.length - 1].seq : db.seq, maisDepois: novos.length > limite, registros: lote.map(api.registro) });
  }
  return json(res, 404, { erro: 'rota desconhecida' });
}

// ---------- totais do dia para o sistema do escritório (Base44) ----------
// o endereço e o segredo ficam só aqui na central, não vão para os tablets
if (!config.base44) config.base44 = { url: '', segredo: '', enviados: {} };
function estadoBase44(completo) {
  const b = config.base44;
  const enviados = {};
  Object.keys(b.enviados || {}).sort().reverse().slice(0, 15).forEach((d) => {
    const e = b.enviados[d];
    enviados[d] = completo ? e : { hash: e.hash, ok: e.ok, em: e.em, erro: e.erro || '' };
  });
  return Object.assign({ ligado: !!b.url, temSegredo: !!b.segredo, desde: b.desde || '', enviados }, completo ? { url: b.url } : {});
}
const enviandoBase44 = new Set();
function postarBase44(dados) {
  const b = config.base44;
  return new Promise((resolve) => {
    let u;
    try { u = new URL(b.url); } catch (e) { return resolve({ status: 0, erro: 'Endereço do Base44 inválido' }); }
    const corpo = Buffer.from(JSON.stringify(dados));
    const pedido = (u.protocol === 'http:' ? http : https).request(u, {
      method: 'POST', timeout: 20000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': corpo.length, 'X-Pranchetas-Segredo': b.segredo || '' },
    }, (r) => {
      const partes = [];
      r.on('data', (c) => partes.push(c));
      r.on('end', () => resolve({ status: r.statusCode, texto: Buffer.concat(partes).toString('utf8').slice(0, 2000) }));
    });
    pedido.on('timeout', () => pedido.destroy(new Error('O Base44 não respondeu em 20 segundos')));
    pedido.on('error', (e) => resolve({ status: 0, erro: /ENOTFOUND|EAI_AGAIN|ENETUNREACH|ECONNREFUSED/.test(e.code || '') ? 'Sem internet na central (ou endereço errado)' : e.message }));
    pedido.end(corpo);
  });
}

// ---------- banco de dados simples em arquivo JSON ----------
let db = { seq: 0, registros: {} };
try { db = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')); } catch (e) { /* primeira vez */ }
const aparelhos = {}; // id -> { papel, operador, vistoEm, ip }

let gravarTimer = null;
function gravarDisco() {
  clearTimeout(gravarTimer);
  gravarTimer = setTimeout(() => {
    const tmp = ARQUIVO + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, ARQUIVO);
  }, 500);
}
// backup: um arquivo por dia de produção
const ehDia = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const arquivoDoDia = (data) => path.join(PASTAS.backup, `${data}.json`);
function backupDoDia(data) {
  if (!ehDia(data) || arquivado(data)) return;
  const doDia = Object.values(db.registros).filter((r) => r.data === data);
  fs.writeFile(arquivoDoDia(data), JSON.stringify(doDia, null, 1), () => {});
}

/* A central guarda na memória os últimos 60 dias. Os mais antigos ficam só no BackupUsina (um arquivo por dia)
   e são lidos de lá quando o tablet chefe abre um dia antigo. Assim a central não fica mais lenta com o tempo. */
const DIAS_NA_CENTRAL = Number(process.env.DIAS_NA_CENTRAL || 60);
function diasAtras(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function arquivado(data) { return ehDia(data) && data < diasAtras(DIAS_NA_CENTRAL); }
function lerDiaArquivado(data) {
  try { return JSON.parse(fs.readFileSync(arquivoDoDia(data), 'utf8')); } catch (e) { return []; }
}
/** Junta anotações num dia que só está no BackupUsina (ex.: o tablet chefe corrigiu uma folha antiga). */
function juntarNoArquivo(data, novos) {
  const mapa = {};
  lerDiaArquivado(data).forEach((r) => { mapa[r.id] = r; });
  let n = 0;
  novos.forEach((r) => { const a = mapa[r.id]; if (!a || r.atualizadoEm >= a.atualizadoEm) { mapa[r.id] = r; n += 1; } });
  fs.writeFileSync(arquivoDoDia(data), JSON.stringify(Object.values(mapa), null, 1));
  return n;
}
/** Tira da memória os dias antigos (eles continuam no BackupUsina). */
function arquivarDiasAntigos() {
  const porDia = {};
  Object.values(db.registros).forEach((r) => { if (arquivado(r.data)) (porDia[r.data] = porDia[r.data] || []).push(r); });
  const dias = Object.keys(porDia);
  dias.forEach((d) => { juntarNoArquivo(d, porDia[d]); porDia[d].forEach((r) => { delete db.registros[r.id]; }); });
  if (dias.length) gravarDisco();
  return dias.length;
}
function listaDeRelatorios() {
  if (!fs.existsSync(PASTAS.relatorios)) return [];
  return fs.readdirSync(PASTAS.relatorios).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse().map((d) => ({
    data: d,
    arquivos: fs.readdirSync(path.join(PASTAS.relatorios, d)).sort().map((nome) => ({ nome, tamanho: fs.statSync(path.join(PASTAS.relatorios, d, nome)).size })),
  }));
}

/* Dois aparelhos criaram a mesma linha sem um saber do outro (ex.: o tablet chefe corrigiu uma dorna nos segundos
   antes de recebê-la): em vez de a última apagar a primeira, os valores se juntam. O mais novo vale nos quadros que ele
   preencheu; o resto continua. A linha junta ganha um horário novo, para chegar de novo nos dois aparelhos. */
function juntarLinhas(a, b) {
  const [velho, novo] = b.atualizadoEm >= a.atualizadoEm ? [a, b] : [b, a];
  const valores = Object.assign({}, velho.valores);
  Object.entries(novo.valores || {}).forEach(([k, x]) => { if (x !== '' && x != null) valores[k] = x; });
  return Object.assign({}, velho, novo, {
    valores, operador: novo.operador || velho.operador,
    criadoEm: Math.min(a.criadoEm, b.criadoEm), atualizadoEm: Math.max(a.atualizadoEm, b.atualizadoEm) + 1,
  });
}
// só entre aparelhos diferentes: o mesmo aparelho mudando a própria linha vale a versão mais nova, como sempre
const criadasSemSaber = (atual, r) => !!(atual && !atual.apagado && !r.apagado && atual.valores && r.valores
  && r.aparelho && atual.aparelho && r.aparelho !== atual.aparelho
  && r.criadoEm && atual.criadoEm && r.criadoEm !== atual.criadoEm);

// ---------- rede ----------
function ipDoCliente(req) { return (req.socket.remoteAddress || '').replace(/^::ffff:/, ''); }
function redeInterna(ip) {
  return ip === '::1' || /^127\./.test(ip) || /^10\./.test(ip) || /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) || /^fe80:/i.test(ip) || /^f[cd]/i.test(ip);
}
/** Endereços deste computador. O do Wi-Fi/rede comum (192.168...) vem primeiro; placas virtuais vão para o fim. */
function enderecosLocais() {
  const virtual = /vethernet|virtualbox|vmware|hyper-v|wsl|docker|vpn|tailscale|zerotier|loopback/i;
  return Object.entries(os.networkInterfaces())
    .flatMap(([nome, lista]) => (lista || []).map((i) => Object.assign({ nome }, i)))
    .filter((i) => i.family === 'IPv4' && !i.internal && !/^169\.254\./.test(i.address))
    .sort((a, b) => {
      const peso = (i) => (virtual.test(i.nome) ? 3 : /^192\.168\./.test(i.address) ? 0 : /^10\./.test(i.address) ? 1 : 2);
      return peso(a) - peso(b);
    })
    .map((i) => `http://${i.address}:${PORTA}`);
}const tentativas = {}; // ip -> [horários] para limitar chutes de código
let tentativasTodas = []; // e no total, para quem troca de endereço a cada chute

// ---------- HTTP ----------
function cabecalhosCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // o APK roda em http://localhost
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}
function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function lerCorpo(req, limite = 5 * 1024 * 1024) {
  // pedido que veio embaralhado: o corpo já foi aberto
  if (req.corpoPronto !== undefined) return req.corpoPronto.length > limite ? Promise.reject(new Error('muito grande')) : Promise.resolve(req.corpoPronto);
  return lerBytes(req, limite).then((b) => b.toString('utf8'));
}
function lerBytes(req, limite) {
  return new Promise((resolve, reject) => {
    let tamanho = 0;
    const partes = [];
    req.on('data', (c) => {
      tamanho += c.length;
      if (tamanho > limite) { reject(new Error('muito grande')); req.destroy(); return; }
      partes.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(partes)));
    req.on('error', reject);
  });
}
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.onnx': 'application/octet-stream',
};
function arquivoEstatico(res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  if (rel === '/baixar') rel = '/baixar.html';
  const alvo = path.normalize(path.join(PUBLICO, rel));
  if (!alvo.startsWith(PUBLICO)) { res.writeHead(403); return res.end(); }
  fs.readFile(alvo, (err, dados) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Não encontrado'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(alvo)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(dados);
  });
}

function paginaRelatorios(res, p) {
  const raiz = PASTAS.relatorios;
  const partes = p.split('/').filter(Boolean); // relatorios[/data[/arquivo]]
  const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  if (partes.length === 3) { // baixar um arquivo
    const alvo = path.normalize(path.join(raiz, partes[1], partes[2]));
    if (!alvo.startsWith(raiz) || !fs.existsSync(alvo)) { res.writeHead(404); return res.end('Não encontrado'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(alvo)] || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${path.basename(alvo)}"` });
    return fs.createReadStream(alvo).pipe(res);
  }

  const dias = fs.existsSync(raiz) ? fs.readdirSync(raiz).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse() : [];
  const linhas = dias.map((d) => {
    const arquivos = fs.readdirSync(path.join(raiz, d)).sort();
    const [ano, mes, dia] = d.split('-');
    return `<tr><td><b>${dia}/${mes}/${ano}</b></td><td>${arquivos.map((a) => `<a href="/relatorios/${d}/${encodeURIComponent(a)}">${escHtml(a)}</a>`).join(' &nbsp; ') || 'sem arquivos'}</td></tr>`;
  }).join('');

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Relatórios das pranchetas</title>
    <link rel="stylesheet" href="/styles.css"></head>
    <body><header class="topo"><img class="logo" src="/icons/logo.png" alt="Ubirálcool">
      <div class="titulo"><b>Relatórios das pranchetas</b><span>Arquivos guardados pela central</span></div></header>
    <main><p class="sub">Os arquivos são enviados pelo tablet chefe. Clique para baixar e anexar no e-mail ou no sistema da empresa.</p>
      <div class="folha"><div class="tabela-wrap"><table class="papel"><thead><tr><th>Dia</th><th>Arquivos</th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="2" class="vazia">Nenhum relatório guardado ainda.</td></tr>'}</tbody></table></div></div>
    </main></body></html>`);
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const ip = ipDoCliente(req);
  cabecalhosCors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (!redeInterna(ip)) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Acesso permitido só pela rede da usina.'); }

  try {
    // ----- rotas abertas na rede da usina -----
    if (p === '/api/ping') return json(res, 200, { app: 'pranchetas', rede: config.nome, apk: fs.existsSync(APK), cifra: 1, pub: PUB_PAR, agora: Date.now() });

    // conectar: o código de 6 números não passa aberto; a chave deste aparelho volta embaralhada
    if (p === '/api/parear' && req.method === 'POST') {
      const agora = Date.now();
      tentativas[ip] = (tentativas[ip] || []).filter((t) => agora - t < 60000);
      tentativasTodas = tentativasTodas.filter((t) => agora - t < 60000);
      if (tentativas[ip].length >= 6 || tentativasTodas.length >= 30) return json(res, 429, { erro: 'Muitas tentativas. Espere um minuto.' });
      tentativas[ip].push(agora); tentativasTodas.push(agora);
      const corpo = JSON.parse(await lerCorpo(req, 10000));
      const aparelho = String(corpo.aparelho || '');
      if (!/^[0-9a-f]{64}$/.test(corpo.pub || '') || !/^[0-9a-f]{64}$/.test(corpo.prova || '') || !aparelho || aparelho.length > 80) {
        return json(res, 400, { erro: corpo.codigo ? ATUALIZE : 'Pedido de conexão inválido' });
      }
      let comum;
      try {
        comum = crypto.diffieHellman({ privateKey: privadaPar, publicKey: crypto.createPublicKey({ key: Buffer.concat([DER_PUBLICA, Buffer.from(corpo.pub, 'hex')]), format: 'der', type: 'spki' }) });
      } catch (e) { return json(res, 403, { erro: 'Código errado' }); }
      const chavePar = hmac(comum, `parear|${aparelho}|${corpo.pub}`);
      if (!crypto.timingSafeEqual(hmac(chavePar, 'codigo|' + config.codigo), Buffer.from(corpo.prova, 'hex'))) return json(res, 403, { erro: 'Código errado' });
      const pacote = selar(chavePar, JSON.stringify({ chave: chaveDoAparelho(aparelho).toString('hex') }), Buffer.from('parear|' + aparelho));
      return json(res, 200, { rede: config.nome, cifrado: pacote.toString('base64') });
    }

    if (p === '/api/versao') return json(res, 200, versaoDoApk() || { versao: null });

    if (p === '/apk/pranchetas.apk') {
      if (!fs.existsSync(APK)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('APK ainda não gerado'); }
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': fs.statSync(APK).size, // sem o tamanho, alguns Android acham que o download falhou
        'Content-Disposition': 'attachment; filename="pranchetas-ubiralcool.apk"',
        'Cache-Control': 'no-store',
      });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(APK).pipe(res);
    }

    // ----- API só de leitura para o sistema do escritório (JSON, com a senha de leitura) -----
    if (p.startsWith('/api/v1/')) return apiLeitura(req, res, url);

    // ----- rotas protegidas: só por pedido embaralhado com a chave do aparelho -----
    if (p === '/api/c' && req.method === 'POST') {
      const aparelho = String(url.searchParams.get('a') || '').slice(0, 80);
      const pacote = await lerBytes(req, 40 * 1024 * 1024);
      const chave = chaveDoAparelho(aparelho);
      let texto;
      try { texto = abrir(chave, pacote, Buffer.from('pedido|' + aparelho)).toString('utf8'); } catch (e) { return json(res, 401, { erro: 'Aparelho não conectado à central' }); }
      const nl = texto.indexOf('\n');
      const cab = JSON.parse(texto.slice(0, nl));
      const agora = Date.now();
      // relógio do aparelho muito diferente: ele acerta com a hora da central e pede de novo
      if (!(Math.abs(agora - Number(cab.t)) <= JANELA)) return json(res, 409, { erro: 'relogio', agora });
      const iv = pacote.subarray(0, 12);
      if (jaVisto(iv.toString('hex'))) return json(res, 401, { erro: 'Pedido repetido' });
      const caminho = String(cab.c || '');
      if (!/^api\/[a-z0-9-]+(\?.*)?$/.test(caminho) || /^api\/(c|ping|parear)(\?|$)/.test(caminho)) return json(res, 400, { erro: 'caminho inválido' });
      const falso = { status: 200, corpo: '', setHeader() {}, writeHead(s) { this.status = s; }, end(b) { this.corpo = b == null ? '' : String(b); } };
      await rotaProtegida({ method: cab.m === 'POST' ? 'POST' : 'GET', corpoPronto: texto.slice(nl + 1), aparelho }, falso, new URL('/' + caminho, 'http://localhost'), ip);
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' });
      return res.end(selar(chave, `${falso.status}\n${falso.corpo}`, Buffer.concat([Buffer.from('resposta|'), iv])));
    }
    // aparelho com o aplicativo antigo (chave aberta no Wi-Fi): não recebe nada até atualizar
    if (p.startsWith('/api/')) return json(res, 426, { erro: ATUALIZE });

    if (req.method !== 'GET') { res.writeHead(405); return res.end(); }

    // Página do escritório com os relatórios já prontos, por dia
    if (p === '/relatorios' || p.startsWith('/relatorios/')) return paginaRelatorios(res, p);

    return arquivoEstatico(res, p);
  } catch (e) {
    return json(res, 400, { erro: e.message });
  }
});

/** As rotas com os dados da usina. Chegam aqui só depois de abrir o pedido embaralhado. */
async function rotaProtegida(req, res, url, ip) {
  const p = url.pathname;
  try {
      if (p === '/api/sync' && req.method === 'POST') {
        const corpo = JSON.parse(await lerCorpo(req));
        if (corpo.aparelho) aparelhos[corpo.aparelho] = { papel: corpo.papel, operador: corpo.operador, versao: corpo.versao || '', vistoEm: Date.now(), ip };
        guardarErros(corpo.aparelho, corpo.erros, ip);
        // aparelho com anotações de antes de zerar: não aceita, manda ele limpar.
        // Aparelho que acabou de conectar numa central nova (tablet chefe trocado ou reinstalado): aceita o que ele tem.
        if (corpo.geracao && corpo.geracao !== config.geracao) {
          const zerada = (config.geracoesZeradas || []).includes(corpo.geracao);
          if (zerada || !corpo.novaConexao) return json(res, 200, { ok: false, zerar: true, geracao: config.geracao, seq: db.seq, agora: Date.now() });
        }
        const dias = new Set();
        const antigos = {};
        let aceitos = 0;
        for (const r of Array.isArray(corpo.registros) ? corpo.registros : []) {
          if (!r || typeof r.id !== 'string' || typeof r.atualizadoEm !== 'number') continue;
          if (arquivado(r.data)) {
            const limpo = Object.assign({}, r, { recebidoEm: Date.now() });
            delete limpo.sincronizado;
            (antigos[r.data] = antigos[r.data] || []).push(limpo);
            continue;
          }
          const atual = db.registros[r.id];
          const entrada = criadasSemSaber(atual, r) ? juntarLinhas(atual, r) : r;
          if (!atual || entrada !== r || r.atualizadoEm >= atual.atualizadoEm) {
            db.seq += 1;
            const limpo = Object.assign({}, entrada, { seq: db.seq, recebidoEm: Date.now() });
            delete limpo.sincronizado;
            db.registros[r.id] = limpo;
            dias.add(r.data);
            aceitos += 1;
          }
        }
        Object.entries(antigos).forEach(([d, lista]) => { aceitos += juntarNoArquivo(d, lista); });
        if (aceitos) { gravarDisco(); dias.forEach(backupDoDia); }
        return json(res, 200, { ok: true, aceitos, seq: db.seq, agora: Date.now(), geracao: config.geracao });
      }

      // totais do dia para o Base44 (sistema do escritório): o tablet chefe calcula, a central manda pela internet
      if (p === '/api/base44' && req.method === 'POST') {
        const corpo = JSON.parse(await lerCorpo(req, 2 * 1024 * 1024));
        const b = config.base44;
        if (corpo.acao === 'estado') return json(res, 200, estadoBase44(true));
        if (corpo.acao === 'configurar') {
          const endereco = String(corpo.url || '').trim();
          if (endereco && !/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(endereco) && !/^http:\/\/127\.0\.0\.1:\d+\//.test(endereco)) return json(res, 400, { erro: 'Endereço inválido. Ele começa com https://' });
          // só os dias depois de ligar vão sozinhos (os anteriores o escritório já lançou à mão)
          if (endereco && endereco !== b.url && ehDia(corpo.desde)) b.desde = corpo.desde;
          b.url = endereco;
          if (typeof corpo.segredo === 'string') b.segredo = corpo.segredo.trim().slice(0, 200);
          salvarConfig();
          return json(res, 200, estadoBase44(true));
        }
        if (corpo.acao === 'enviar') {
          if (!b.url) return json(res, 400, { erro: 'O endereço do Base44 não foi cadastrado' });
          if (!ehDia(corpo.data) || !corpo.dados || typeof corpo.dados !== 'object') return json(res, 400, { erro: 'dados inválidos' });
          const antes = (b.enviados || {})[corpo.data];
          if (!corpo.forcar && antes && antes.ok && antes.hash === corpo.hash) return json(res, 200, { ok: true, jaEnviado: true });
          if (enviandoBase44.has(corpo.data)) return json(res, 200, { ok: false, erro: 'Já está enviando este dia' });
          enviandoBase44.add(corpo.data);
          let r;
          try { r = await postarBase44(corpo.dados); } finally { enviandoBase44.delete(corpo.data); }
          const ok = r.status >= 200 && r.status < 300;
          const erro = ok ? '' : r.erro || (r.status === 401 || r.status === 403 ? 'O Base44 recusou o segredo' : `O Base44 respondeu ${r.status}: ${(r.texto || '').slice(0, 200)}`);
          b.enviados = b.enviados || {};
          b.enviados[corpo.data] = { hash: String(corpo.hash || ''), ok, em: Date.now(), status: r.status, erro };
          Object.keys(b.enviados).sort().slice(0, -60).forEach((d) => delete b.enviados[d]);
          salvarConfig();
          return json(res, 200, { ok, erro, status: r.status });
        }
        return json(res, 400, { erro: 'ação desconhecida' });
      }

      if (p === '/api/registros') {
        const dia = url.searchParams.get('dia');
        if (dia) { // o tablet chefe abriu um dia que não guarda mais
          if (!ehDia(dia)) return json(res, 400, { erro: 'dia inválido' });
          const lista = arquivado(dia) ? lerDiaArquivado(dia) : Object.values(db.registros).filter((r) => r.data === dia);
          return json(res, 200, { seq: db.seq, geracao: config.geracao, registros: lista });
        }
        const desde = Number(url.searchParams.get('desde') || 0);
        const base = desde > db.seq ? 0 : desde; // servidor foi zerado: manda tudo
        // cada aparelho guarda só os últimos dias (a configuração da usina, os avisos e os enchimentos das dornas de
        // fermentação vão sempre: uma dorna pode passar vários dias fermentando)
        const aPartirDe = url.searchParams.get('aPartirDe');
        const serve = (r) => !ehDia(aPartirDe) || !ehDia(r.data) || r.data >= aPartirDe || r.prancheta === 'avisos' || r.prancheta === 'avisos-recibo' || r.prancheta === 'fermentacao';
        return json(res, 200, { seq: db.seq, geracao: config.geracao, registros: Object.values(db.registros).filter((r) => r.seq > base && serve(r)) });
      }

      if (p === '/api/status') {
        const agora = Date.now();
        return json(res, 200, {
          seq: db.seq, total: Object.keys(db.registros).length,
          codigo: config.codigo, enderecos: enderecosLocais(), apk: fs.existsSync(APK), base44: estadoBase44(false),
          pastas: { servidor: PASTAS.servidor, relatorios: PASTAS.relatorios, backup: PASTAS.backup },
          aparelhos: Object.entries(aparelhos).map(([id, a]) => ({
            id, papel: a.papel, operador: a.operador, ip: a.ip, versao: a.versao || '',
            online: agora - a.vistoEm < 30000, minutos: Math.round((agora - a.vistoEm) / 60000),
          })),
        });
      }

      // O tablet chefe manda o Excel e o XML do dia para ficarem guardados aqui
      if (p === '/api/relatorio' && req.method === 'POST') {
        const corpo = JSON.parse(await lerCorpo(req, 30 * 1024 * 1024));
        if (!/^\d{4}-\d{2}-\d{2}$/.test(corpo.data || '')) return json(res, 400, { erro: 'data inválida' });
        const nome = path.basename(String(corpo.nome || '')).replace(/[^\w.\-]/g, '_');
        if (!/\.(xlsx|xml|csv)$/i.test(nome)) return json(res, 400, { erro: 'tipo de arquivo não aceito' });
        const pasta = path.join(PASTAS.relatorios, corpo.data);
        fs.mkdirSync(pasta, { recursive: true });
        fs.writeFileSync(path.join(pasta, nome), Buffer.from(String(corpo.base64 || ''), 'base64'));
        return json(res, 200, { ok: true });
      }

      if (p === '/api/relatorios') {
        // dias com anotações (na memória e no BackupUsina): o tablet chefe vê, corrige e envia os dias anteriores
        const comDados = new Set(Object.values(db.registros).map((r) => r.data).filter(ehDia));
        fs.readdirSync(PASTAS.backup).forEach((n) => { const m = n.match(/^(\d{4}-\d{2}-\d{2})\.json$/); if (m) comDados.add(m[1]); });
        return json(res, 200, { pasta: 'RelatoriosUsina', dias: listaDeRelatorios(), diasComDados: [...comDados].sort().reverse() });
      }
      if (p === '/api/relatorio-apagar' && req.method === 'POST') {
        const corpo = JSON.parse(await lerCorpo(req, 10000));
        if (!ehDia(corpo.data)) return json(res, 400, { erro: 'data inválida' });
        fs.rmSync(path.join(PASTAS.relatorios, corpo.data), { recursive: true, force: true });
        return json(res, 200, { ok: true });
      }

      if (p === '/api/erros') return json(res, 200, { erros: ultimosErros(100) });

      // Zerar as anotações de teste: guarda uma cópia em BackupUsina e apaga tudo, menos a configuração da usina
      if (p === '/api/zerar' && req.method === 'POST') {
        const corpo = JSON.parse(await lerCorpo(req, 10000));
        if (corpo.confirmar !== 'ZERAR') return json(res, 400, { erro: 'faltou confirmar' });
        if (!senhaDoProgramador(corpo.senha)) return json(res, 403, { erro: 'senha do programador errada' });
        const agora = new Date();
        const carimbo = agora.toISOString().slice(0, 16).replace(/[-:T]/g, '');
        fs.writeFileSync(path.join(PASTAS.backup, `antes-de-zerar-${carimbo}.json`), JSON.stringify(Object.values(db.registros), null, 1));
        let apagados = 0;
        Object.keys(db.registros).forEach((id) => { if (db.registros[id].data !== 'config') { delete db.registros[id]; apagados += 1; } });
        // os arquivos de cada dia (inclusive os dias antigos) vão para uma pasta, para não voltarem na folha
        const guardados = path.join(PASTAS.backup, `antes-de-zerar-${carimbo}`);
        fs.readdirSync(PASTAS.backup).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).forEach((n) => {
          fs.mkdirSync(guardados, { recursive: true });
          fs.renameSync(path.join(PASTAS.backup, n), path.join(guardados, n));
        });
        config.geracoesZeradas = [...(config.geracoesZeradas || []), config.geracao].slice(-50);
        config.geracao = crypto.randomBytes(6).toString('hex'); salvarConfig();
        gravarDisco();
        return json(res, 200, { ok: true, apagados, geracao: config.geracao, copia: `BackupUsina/antes-de-zerar-${carimbo}.json` });
      }

      // trocar o código também troca a chave: todos os outros aparelhos são desconectados (aparelho perdido ou roubado)
      if (p === '/api/novo-codigo' && req.method === 'POST') {
        config.codigo = novoCodigo(); config.chave = crypto.randomBytes(18).toString('hex'); salvarConfig();
        // quem trocou recebe a chave nova dele (a resposta vai embaralhada com a chave antiga)
        return json(res, 200, { codigo: config.codigo, chave: chaveDoAparelho(req.aparelho).toString('hex') });
      }
      return json(res, 404, { erro: 'rota desconhecida' });
  } catch (e) {
    return json(res, 400, { erro: e.message });
  }
}

arquivarDiasAntigos();
setInterval(arquivarDiasAntigos, 3600 * 1000).unref();
// versão nova na internet: olha logo depois de ligar e a cada 6 horas
setTimeout(buscarAtualizacaoOnline, Number(process.env.ATUALIZACAO_ESPERA_MS || 20000)).unref();
setInterval(buscarAtualizacaoOnline, 6 * 3600 * 1000).unref();

// ENDERECO=127.0.0.1 deixa a central só neste computador (usado nos testes, para o Windows não perguntar do firewall)
servidor.listen(PORTA, process.env.ENDERECO || '0.0.0.0', () => {
  console.log('\n  Central das Pranchetas rodando\n');
  console.log(`  Neste computador:     http://localhost:${PORTA}`);
  enderecosLocais().forEach((e) => console.log(`  Nos tablets (Wi-Fi):  ${e}`));
  console.log(`\n  Código de conexão dos aparelhos: ${config.codigo}`);
  console.log(`  Página para baixar o app:        ${(enderecosLocais()[0] || 'http://localhost:' + PORTA)}/baixar`);
  console.log(`\n  Pastas: ${PASTAS.servidor}\n          ${PASTAS.relatorios}\n          ${PASTAS.backup}`);
  console.log('\n  Tablet não consegue baixar o app? Rode uma vez, como administrador: liberar-firewall.ps1\n');
});
