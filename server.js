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
// atualização rápida (versão 2.8): o pacote das telas (gerar-apk.ps1, ou baixado da nuvem)
const TELAS = path.join(PASTA_APK, 'telas');
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
// (versão 2.12) PBKDF2 com 600 mil voltas e sal: quem abre o código não descobre a senha testando todas as combinações
const HASH_PROGRAMADOR = process.env.SENHA_PROGRAMADOR_HASH || 'pbkdf2$600000$d31d016c4915ed1a459748361e6a081e$0041ccba04c2a9ff6534039b939944d9c111263af11791b1a2fab519ed3f6e2c';
const pbkdf2 = require('util').promisify(crypto.pbkdf2);
async function senhaDoProgramador(s) {
  const [tipo, voltas, sal, resumo] = String(HASH_PROGRAMADOR).split('$');
  if (tipo !== 'pbkdf2' || !resumo || !s) return false;
  const r = await pbkdf2(String(s), Buffer.from(sal, 'hex'), Number(voltas), 32, 'sha256');
  const certo = Buffer.from(resumo, 'hex');
  return r.length === certo.length && crypto.timingSafeEqual(r, certo);
}
/** Cinco senhas do programador erradas em um minuto, por aparelho: espera um minuto. Devolve true se pode tentar. */
const tentativasProgramador = {};
function podeTentarProgramador(aparelho) {
  const agora = Date.now();
  const t = (tentativasProgramador[aparelho] = (tentativasProgramador[aparelho] || []).filter((x) => agora - x < 60000));
  return t.length < 5;
}
const errouProgramador = (aparelho) => { (tentativasProgramador[aparelho] = tentativasProgramador[aparelho] || []).push(Date.now()); };

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
/** As definições das pranchetas (o mesmo forms.js do aplicativo). */
function carregarPranchetas() {
  const contexto = { window: {} };
  require('vm').runInNewContext(fs.readFileSync(path.join(PUBLICO, 'forms.js'), 'utf8'), contexto);
  return contexto.window.USINA;
}
// versão 2.12: a API (e a cópia da nuvem) usa a folha em vigor: o forms.js com o que o tablet chefe mudou (folhas.js)
let Folhas = null;
try { Folhas = require(path.join(PUBLICO, 'folhas.js')); } catch (e) { Folhas = require(path.join(__dirname, 'public', 'folhas.js')); }
const folhasDaConfig = () => { const cs = db.registros['config|sistema|geral']; return cs && !cs.apagado && cs.valores ? cs.valores.folhas || {} : {}; };
// os turnos de cada setor (2.13.4) vão junto: a API diz o turno de cada linha pelo setor dela
const turnosDaConfig = () => { const cs = db.registros['config|sistema|geral']; return cs && !cs.apagado && cs.valores ? cs.valores.turnosSetor || {} : {}; };
const formsEmVigor = () => Object.assign(Folhas.aplicar(carregarPranchetas(), folhasDaConfig(), new Map()), { turnosSetor: turnosDaConfig() });
let folhasDaApi = '';
const apiDeLeitura = () => {
  const chave = JSON.stringify([folhasDaConfig(), turnosDaConfig()]);
  if (!apiLeituraPronta || chave !== folhasDaApi) { folhasDaApi = chave; apiLeituraPronta = leitura.criar(formsEmVigor(), medidasDoEscritorio); }
  return apiLeituraPronta;
};

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
/** A chave pública das telas (a mesma que vai dentro do APK). */
function chaveDasTelas() { try { return process.env.CHAVE_TELAS || fs.readFileSync(path.join(PUBLICO, 'chave-telas.txt'), 'utf8').trim(); } catch (e) { return ''; } }
function assinaturaConfere(dados, assinatura) {
  const chave = chaveDasTelas();
  if (!chave) return false;
  try { return crypto.verify('sha256', dados, crypto.createPublicKey({ key: Buffer.from(chave, 'base64'), format: 'der', type: 'spki' }), Buffer.from(String(assinatura).trim(), 'base64')); } catch (e) { return false; }
}
function pacoteDasTelas() { try { return JSON.parse(fs.readFileSync(path.join(TELAS, 'pacote.json'), 'utf8')); } catch (e) { return null; } }
/** Baixa da nuvem o pacote das telas mais novo (só o que mudou), confere a assinatura e cada arquivo. */
async function buscarTelasOnline(raiz) {
  const pacote = await baixarDaInternet(raiz + 'pacote.json', 2 * 1024 * 1024);
  const assinatura = (await baixarDaInternet(raiz + 'pacote.sig', 4096)).toString('utf8');
  if (!assinaturaConfere(pacote, assinatura)) throw new Error('o pacote das telas da internet não tem a assinatura certa');
  const p = JSON.parse(pacote.toString('utf8'));
  const atual = pacoteDasTelas();
  if (atual && numeroDaVersao(p.versao) <= numeroDaVersao(atual.versao)) return;
  const tmp = TELAS + '.baixando';
  fs.rmSync(tmp, { recursive: true, force: true });
  for (const [rel, a] of Object.entries(p.arquivos || {})) {
    if (!rel || rel.includes('..') || rel.startsWith('/') || rel.includes('\\')) throw new Error('caminho estranho no pacote: ' + rel);
    const destino = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    const velho = atual && atual.arquivos && atual.arquivos[rel] && atual.arquivos[rel].sha256 === a.sha256 ? path.join(TELAS, rel) : null;
    const dados = velho && fs.existsSync(velho) ? fs.readFileSync(velho) : await baixarDaInternet(raiz + rel.split('/').map(encodeURIComponent).join('/'), 30 * 1024 * 1024);
    if (dados.length !== a.tamanho || crypto.createHash('sha256').update(dados).digest('hex') !== a.sha256) throw new Error(`o arquivo ${rel} da internet veio com defeito`);
    fs.writeFileSync(destino, dados);
  }
  fs.writeFileSync(path.join(tmp, 'pacote.json'), pacote);
  fs.writeFileSync(path.join(tmp, 'pacote.sig'), assinatura);
  fs.rmSync(TELAS, { recursive: true, force: true });
  fs.renameSync(tmp, TELAS);
  console.log(`  Telas ${p.versao} baixadas da internet. Os tablets já podem atualizar.`);
}
let procurandoOnline = false;
async function buscarAtualizacaoOnline() {
  let base = process.env.ATUALIZACAO_ONLINE;
  // sem endereço no forms.js, as atualizações vêm da nuvem das pranchetas (se ela estiver ligada)
  if (base === undefined) { try { base = carregarPranchetas().atualizacaoOnline || (config.nuvem && config.nuvem.url ? config.nuvem.url + '/atualizacao/' : ''); } catch (e) { base = ''; } }
  if (!base || procurandoOnline) return;
  procurandoOnline = true;
  const raiz = base.replace(/\/?$/, '/');
  try {
    // as telas (atualização rápida) ficam do lado: .../atualizacao/ e .../telas/
    await buscarTelasOnline(new URL('../telas/', raiz).href).catch((e) => console.log('  Telas pela internet: ' + e.message));
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

// ---------- Nuvem das Pranchetas (versão 2.8): uma cópia das anotações na internet ----------
// A central manda, de minuto em minuto, o que mudou. Lá ficam a API de leitura do escritório e as atualizações.
// A usina continua funcionando sem internet: a nuvem é só uma cópia. O endereço e a senha ficam só aqui.
if (!config.nuvem) config.nuvem = { url: '', segredo: '', seq: 0 };
const NUVEM_LOTE = 150; // o plano grátis dá 10 ms de processamento por pedido: lotes pequenos
function estadoNuvem() {
  const n = config.nuvem;
  return { ligada: !!(n.url && n.segredo), url: n.url || '', temSegredo: !!n.segredo, ultimoEnvio: n.ultimoEnvio || 0, erro: n.erro || '', faltam: n.faltam || 0 };
}
function pedirNuvem(caminho, corpo) {
  const n = config.nuvem;
  return new Promise((resolve) => {
    let u;
    try { u = new URL(caminho, n.url.replace(/\/?$/, '/')); } catch (e) { return resolve({ status: 0, erro: 'Endereço da nuvem inválido' }); }
    const dados = corpo === undefined ? null : Buffer.from(JSON.stringify(corpo));
    const pedido = (u.protocol === 'http:' ? http : https).request(u, {
      method: dados ? 'POST' : 'GET', timeout: 30000,
      headers: Object.assign({ Authorization: 'Bearer ' + n.segredo }, dados ? { 'Content-Type': 'application/json', 'Content-Length': dados.length } : {}),
    }, (r) => {
      const partes = [];
      r.on('data', (c) => partes.push(c));
      r.on('end', () => { const texto = Buffer.concat(partes).toString('utf8'); let j = null; try { j = JSON.parse(texto); } catch (e) { /* não é JSON */ } resolve({ status: r.statusCode, json: j, texto }); });
    });
    pedido.on('timeout', () => pedido.destroy(new Error('A nuvem não respondeu em 30 segundos')));
    pedido.on('error', (e) => resolve({ status: 0, erro: /ENOTFOUND|EAI_AGAIN|ENETUNREACH|ECONNREFUSED/.test(e.code || '') ? 'Sem internet na central (ou endereço errado)' : e.message }));
    pedido.end(dados || undefined);
  });
}
function tokenNuvem(aparelho) {
  const n = config.nuvem;
  return n.url && n.segredo ? crypto.createHmac('sha256', n.segredo).update('aparelho|' + aparelho).digest('hex') : '';
}
/** Desfaz uma versão recusada que outros aparelhos já podem ter recebido pela nuvem. */
function corrigirRecusaNuvem(r) {
  if (!ehDia(r.data) || r.prancheta === 'registro') return;
  const atual = db.registros[r.id] || (arquivado(r.data) ? lerDiaArquivado(r.data).find((x) => x.id === r.id) : null);
  const correcao = Object.assign({}, atual || { id: r.id, data: r.data, prancheta: r.prancheta, chave: r.chave, valores: {}, apagado: true }, {
    atualizadoEm: Math.max(Date.now(), Number(atual && atual.atualizadoEm) || 0, r.atualizadoEm) + 1,
    seq: ++db.seq, recebidoEm: Date.now(),
  });
  delete correcao.sincronizado;
  db.registros[r.id] = correcao;
  if (arquivado(r.data)) {
    juntarNoArquivo(r.data, [correcao]);
    config.nuvem.arquivosEnviados = false;
  } else backupDoDia(r.data);
}
/** Confirma a versão lida; um envio mais novo durante o processamento continua na fila. */
async function puxarFilaNuvem() {
  const r = await pedirNuvem('fila');
  if (r.status !== 200 || !r.json || !Array.isArray(r.json.itens)) throw new Error(erroDaNuvem(r));
  const itens = [];
  for (const item of r.json.itens) {
    const resultado = sincronizar({ registros: [item.registro], geracao: item.geracao || '' }, item.aparelho, 'nuvem');
    const recusas = resultado.recusados || [];
    if (resultado.erro || resultado.zerar) recusas.push({ id: item.registro.id, motivo: resultado.erro || 'geracao' });
    for (const recusa of recusas) registrar('nuvem', `Fila recusada: ${recusa.id} (${recusa.motivo})`, { aparelho: nomeDoAparelho(item.aparelho) });
    if (recusas.length) corrigirRecusaNuvem(item.registro);
    itens.push({ aparelho: item.aparelho, id: item.registro.id, atualizadoEm: item.registro.atualizadoEm });
  }
  if (itens.length) {
    gravarDisco(true); // só confirma depois que as anotações e recusas estão no disco
    const c = await pedirNuvem('fila/confirmar', { itens });
    if (c.status !== 200) throw new Error(erroDaNuvem(c));
  }
}
const erroDaNuvem = (r) => r.erro || (r.status === 401 ? 'A nuvem recusou a senha da central' : `A nuvem respondeu ${r.status}: ${((r.json && r.json.erro) || r.texto || '').slice(0, 200)}`);
/** O que falta mandar: o que mudou depois do último envio (e, na primeira vez, também os dias do BackupUsina). */
function pendentesNuvem(n) {
  const mapa = new Map();
  const juntar = (r) => { if (ehDia(r.data) && r.prancheta !== 'registro' && r.seq > (n.seq || 0)) { const a = mapa.get(r.id); if (!a || r.seq > a.seq) mapa.set(r.id, r); } };
  if (!n.arquivosEnviados) {
    fs.readdirSync(PASTAS.backup).forEach((f) => { const m = f.match(/^(\d{4}-\d{2}-\d{2})\.json$/); if (m && arquivado(m[1])) lerDiaArquivado(m[1]).forEach(juntar); });
  }
  Object.values(db.registros).forEach(juntar);
  return [...mapa.values()].sort((a, b) => a.seq - b.seq);
}
const resumoHash = (x) => crypto.createHash('sha256').update(JSON.stringify(x === undefined ? null : x)).digest('hex').slice(0, 16);
let enviandoNuvem = false;
async function enviarParaNuvem() {
  const n = config.nuvem;
  if (!n.url || !n.segredo || enviandoNuvem) return;
  enviandoNuvem = true;
  try {
    await puxarFilaNuvem();
    // na primeira vez (ou se a nuvem foi trocada/zerada), confere até onde ela tem
    if (!n.conferida) {
      const e = await pedirNuvem('central/estado');
      if (e.status !== 200 || !e.json) throw new Error(erroDaNuvem(e));
      if (e.json.geracao !== config.geracao || !e.json.registros) { n.seq = 0; n.arquivosEnviados = false; n.formsHash = ''; n.medidasHash = ''; n.bloqueiosHash = ''; }
      n.conferida = true;
    }
    const forms = formsEmVigor();
    delete forms.pinAdmin; // senha não vai para a nuvem
    const formsHash = resumoHash(forms);
    // aparelhos bloqueados: longe da usina, o aparelho pergunta na nuvem (versão 2.11).
    // A senha de desbloqueio (sal e resumo) não sobe: a rota da nuvem é aberta e daria para testar senhas fora do aparelho.
    // A lista e a revisão saem juntas (sem esperar nada no meio): a revisão diz até onde a lista está certa.
    const bloqueios = Object.entries(config.bloqueios).map(([id, b]) => ({ id, em: b.em, rev: b.rev || 0, modo: b.modo, apagar: !!b.apagar }));
    const bloqueiosRev = config.bloqueiosRev;
    const bloqueiosHash = resumoHash([bloqueios, bloqueiosRev]);
    // a nuvem guarda até 500: mais que isso não vai (a lista cortada deixaria aparelho bloqueado de fora), e as anotações seguem
    const bloqueiosDemais = bloqueios.length > 500;
    const medidas = medidasDoEscritorio();
    const medidasHash = resumoHash(medidas);
    for (let vez = 0; vez < 40; vez++) {
      const pend = pendentesNuvem(n);
      const lote = pend.slice(0, NUVEM_LOTE);
      if (!lote.length && n.formsHash === formsHash && n.medidasHash === medidasHash && (bloqueiosDemais || n.bloqueiosHash === bloqueiosHash)) { n.arquivosEnviados = true; n.faltam = 0; break; }
      const corpo = { geracao: config.geracao, medidas, registros: lote };
      if (n.formsHash !== formsHash) corpo.forms = forms;
      // com a revisão: o aparelho só aceita a resposta da nuvem se ela for mais nova que o bloqueio que ele já tem
      if (!bloqueiosDemais && n.bloqueiosHash !== bloqueiosHash) { corpo.bloqueios = bloqueios; corpo.bloqueiosRev = bloqueiosRev; }
      const r = await pedirNuvem('central/enviar', corpo);
      if (r.status !== 200) throw new Error(erroDaNuvem(r));
      if (lote.length) n.seq = lote[lote.length - 1].seq;
      n.formsHash = formsHash; n.medidasHash = medidasHash; if (!bloqueiosDemais) n.bloqueiosHash = bloqueiosHash;
      n.ultimoEnvio = Date.now(); n.erro = bloqueiosDemais ? 'Mais de 500 aparelhos bloqueados: a lista não vai para a nuvem' : '';
      n.faltam = Math.max(0, pend.length - lote.length);
    }
    if (bloqueiosDemais) n.erro = 'Mais de 500 aparelhos bloqueados: a lista não vai para a nuvem';
  } catch (e) {
    n.erro = e.message; n.conferida = false;
  } finally {
    salvarConfig();
    enviandoNuvem = false;
  }
}
let nuvemTimer = null;
const agendarNuvem = (ms = 5000) => { if (!config.nuvem.url) return; clearTimeout(nuvemTimer); nuvemTimer = setTimeout(enviarParaNuvem, ms); nuvemTimer.unref(); };

// ---------- Pessoas do escritório (versão 2.9) ----------
// Cada pessoa tem nome, nível e a sua senha (só a senha já diz quem é). A senha fica só aqui, embaralhada com sal:
// nem a central guarda a senha em si. Quem entra num tablet chefe fica como responsável dele.
// Só o administrador cadastra pessoas e mexe nas permissões (o que cada uma pode fazer fica no aplicativo, forms.js).
const NIVEIS_VALIDOS = ['administrador', 'encarregado', 'consulta'];
function resumoDaSenha(pin, sal) {
  let h = crypto.createHash('sha256').update(sal + ':' + pin).digest();
  for (let i = 0; i < 20000; i++) h = crypto.createHmac('sha256', h).update(String(pin)).digest();
  return h.toString('hex');
}
const guardarSenha = (pin) => { const sal = crypto.randomBytes(16).toString('hex'); return { sal, resumo: resumoDaSenha(pin, sal) }; };
if (!Array.isArray(config.pessoas)) {
  // primeira vez: o administrador é o Guilherme, com a senha que já era a do encarregado
  let pin = '159357';
  try { pin = String(carregarPranchetas().pinAdmin || pin); } catch (e) { /* fica a de sempre */ }
  config.pessoas = [Object.assign({ id: 'p' + crypto.randomBytes(4).toString('hex'), nome: 'Guilherme', nivel: 'administrador', extras: {}, ativo: true, criadoEm: Date.now() }, guardarSenha(pin))];
  salvarConfig();
}
if (!config.sessoes) config.sessoes = {};
if (!config.aparelhosChefe) config.aparelhosChefe = {};
if (!config.aparelhosVistos) config.aparelhosVistos = {};
const pessoaPublica = (p) => ({ id: p.id, nome: p.nome, nivel: p.nivel, extras: p.extras || {}, ativo: p.ativo !== false, temSenha: !!p.resumo });
const pessoaDaSenha = (pin) => config.pessoas.find((p) => p.ativo !== false && p.resumo && mesmoSegredo(resumoDaSenha(String(pin), p.sal), p.resumo));
const pessoaDoAparelho = (id) => { const s = config.sessoes[id]; return s ? config.pessoas.find((p) => p.id === s.pessoaId && p.ativo !== false) || null : null; };
const tetoDoAparelho = (id) => { const a = config.aparelhosChefe[id]; return a && Array.isArray(a.teto) ? a.teto : null; };
let formsDaCentral = null;
const formsLidas = () => formsDaCentral || (formsDaCentral = carregarPranchetas());
/** Nome do aparelho para o registro e para a lista: o que o administrador deu, ou a função dele. */
function nomeDoAparelho(id) {
  const proprio = config.aparelhosChefe[id] && config.aparelhosChefe[id].nome;
  if (proprio) return proprio;
  // o nome que o próprio aparelho mandou (Tablet da Hidrólise, Tablet chefe...)
  const dele = (aparelhos[id] && aparelhos[id].nome) || (config.aparelhosVistos[id] && config.aparelhosVistos[id].nome);
  if (dele) return dele;
  const papel = (aparelhos[id] && aparelhos[id].papel) || (config.aparelhosVistos[id] && config.aparelhosVistos[id].papel);
  if (papel === 'central') return 'Tablet chefe';
  if (papel === 'escritorio') return 'Escritório';
  let s = null;
  try { s = formsLidas().setores.find((x) => x.id === papel); } catch (e) { /* sem o forms */ }
  return s ? `Tablet da ${s.nome}` : 'Aparelho ' + String(id).slice(-6);
}
const tentativasSenha = {};

/* ---------- Níveis do tablet chefe e o dono (versão 2.12) ----------
   Cada tablet chefe tem um nível (config.aparelhosChefe[id].nivel), que só a central guarda e confere:
     1 = vê, corrige e envia (corrigir e relatórios, sem apagar relatório);
     2 = tudo o que existe, e libera outros tablets chefe;
     3 = tudo, mais as configurações do sistema (só o dono entra nele).
   O que a pessoa faz num aparelho = funções dela ∩ funções do nível ∩ limite do aparelho (o administrador ignora só o limite).
   O dono (config.donoId) é a pessoa criada pela migração da 2.9 (o Guilherme). A identidade do aparelho é a da conexão
   cifrada (req.aparelho), nunca o que vem no pedido. Aparelho tablet chefe novo precisa ser liberado com uma senha. */
const FUNCOES_PADRAO = ['anotar', 'corrigir', 'avisos', 'relatorios', 'ler_folha', 'usina', 'folhas', 'conexao', 'integracoes', 'ajustes', 'registro', 'chefes'];
const FUNCOES_DO_NIVEL_1 = ['corrigir', 'relatorios'];
const funcoesDoForms = () => { try { return formsLidas().funcoes.map((f) => f.id); } catch (e) { return FUNCOES_PADRAO; } };
const niveisDoForms = () => { try { return formsLidas().niveis || {}; } catch (e) { return {}; } };
if (!config.donoId) {
  const dono = config.pessoas.find((p) => p.nivel === 'administrador' && p.ativo !== false) || config.pessoas.find((p) => p.nivel === 'administrador');
  if (dono) { config.donoId = dono.id; salvarConfig(); }
}
// migração única: o que a central já conhecia como tablet chefe antes da 2.12 vira nível 2 (nada muda para quem já usa)
if (!config.niveisMigrados) {
  const ids = new Set([...Object.keys(config.aparelhosChefe), ...Object.keys(config.aparelhosVistos).filter((id) => config.aparelhosVistos[id].papel === 'central')]);
  ids.forEach((id) => { const a = config.aparelhosChefe[id] || (config.aparelhosChefe[id] = {}); if (![1, 2, 3].includes(a.nivel)) a.nivel = 2; });
  config.niveisMigrados = Date.now();
  salvarConfig();
}
const nivelDoAparelho = (id) => { const a = config.aparelhosChefe[id]; return a && [1, 2, 3].includes(a.nivel) ? a.nivel : 0; };
const ehDono = (p) => !!p && !!config.donoId && p.id === config.donoId;
/** As funções da pessoa, sem olhar o aparelho. 'sistema' e 'pessoas' não se dão por ajuste. */
function funcoesDaPessoa(p) {
  if (!p) return new Set();
  const todas = funcoesDoForms();
  if (ehDono(p)) return new Set([...todas, 'pessoas', 'chefes', 'sistema']);
  if (p.nivel === 'administrador') return new Set([...todas, 'pessoas']);
  const nv = niveisDoForms()[p.nivel] || { funcoes: [] };
  const s = new Set(nv.funcoes === 'todas' ? todas : nv.funcoes || []);
  Object.entries(p.extras || {}).forEach(([f, sim]) => { if (f === 'sistema' || f === 'pessoas') return; if (sim) s.add(f); else s.delete(f); });
  return s;
}
/** O que quem está no aparelho pode fazer nele: a pessoa, o nível do aparelho e o limite dele. */
function funcoesNoAparelho(aparelho) {
  const p = pessoaDoAparelho(aparelho);
  const nivel = nivelDoAparelho(aparelho);
  if (!p || !nivel || (nivel === 3 && !ehDono(p))) return new Set();
  const s = funcoesDaPessoa(p);
  if (nivel === 1) [...s].forEach((f) => { if (!FUNCOES_DO_NIVEL_1.includes(f)) s.delete(f); });
  if (nivel !== 3) s.delete('sistema');
  const teto = tetoDoAparelho(aparelho);
  if (teto && p.nivel !== 'administrador' && !ehDono(p)) [...s].forEach((f) => { if (!teto.includes(f)) s.delete(f); });
  return s;
}
const podeNoAparelho = (aparelho, f) => funcoesNoAparelho(aparelho).has(f);
const negar = (res, f) => json(res, 403, { erro: 'Quem está neste aparelho não pode fazer isso', semPermissao: f });
// tablet de setor: quem digitou a senha nos ajustes fica liberado por 10 minutos (para a central aceitar o que ele mudar)
const liberadosNoSetor = {};
const LIBERADO_NO_SETOR_MS = 10 * 60000;
// no tablet de setor a senha só abre os ajustes dele (os operadores), seja de quem for: o resto é do tablet chefe
const FUNCOES_NO_SETOR = ['ajustes', 'usina', 'escritorio'];
function funcoesNoSetor(aparelho) {
  const l = liberadosNoSetor[aparelho];
  if (!l || Date.now() > l.ate) return new Set();
  const s = funcoesDaPessoa(config.pessoas.find((p) => p.id === l.pessoaId && p.ativo !== false));
  return new Set([...s].filter((f) => FUNCOES_NO_SETOR.includes(f)));
}
const nomeDoNivel = (n) => ({ 1: 'nível 1 (vê, corrige e envia)', 2: 'nível 2', 3: 'nível 3 (do dono)' }[n] || 'sem nível');
/** O que vai para o aplicativo mostrar só o que pode: o nível do aparelho, se é o dono e as funções que valem aqui. */
function permissoesDoAparelho(aparelho, pessoaVerificada) {
  const nivel = nivelDoAparelho(aparelho);
  const p = pessoaVerificada || pessoaDoAparelho(aparelho);
  const funcoes = pessoaVerificada && !nivel ? funcoesDaPessoa(pessoaVerificada) : funcoesNoAparelho(aparelho);
  return { nivel, dono: ehDono(p), funcoes: [...funcoes] };
}

/* ---------- O que a central aceita pela sincronização (versão 2.12) ----------
   Configuração da usina ('config|...'): cada parte mudada precisa da função de quem está no aparelho; nas folhas, as
   propriedades novas (vírgula, mostrar ao operador, campos do escritório para o operador, campos novos) só o dono num
   tablet nível 3. Quem não pode mexer nelas não as apaga: a central põe de volta as que vieram faltando.
   Conflito: a configuração leva "base" (a revisão que o aparelho editou); se outro tablet mudou antes, é recusada. */
const FOLHAS_SISTEMA = ['dec', 'oculto', '_operador', '_novos'];
/** Compara dois valores sem depender da ordem das chaves (o mesmo objeto pode chegar com as chaves em outra ordem). */
const ordenado = (x) => (Array.isArray(x) ? x.map(ordenado) : x && typeof x === 'object' ? Object.keys(x).sort().reduce((o, k) => { o[k] = ordenado(x[k]); return o; }, {}) : x);
const mesmoJson = (a, b) => JSON.stringify(ordenado(a === undefined ? null : a)) === JSON.stringify(ordenado(b === undefined ? null : b));
function mudancasDaConfig(atual, nova) {
  const a = (atual && atual.valores) || {};
  const b = nova.valores || {};
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !mesmoJson(a[k], b[k]));
}
/** Folhas: põe de volta as propriedades do sistema que vieram faltando e diz se alguma do sistema mudou. */
function conferirFolhas(antes, depois, podeSistema) {
  const a = antes || {};
  const b = JSON.parse(JSON.stringify(depois || {}));
  let mexeuSistema = false, mexeuComum = false;
  [...new Set([...Object.keys(a), ...Object.keys(b)])].forEach((pid) => {
    const fa = a[pid] || {}, fb = b[pid] || (b[pid] = {});
    [...new Set([...Object.keys(fa), ...Object.keys(fb)])].forEach((k) => {
      if (FOLHAS_SISTEMA.includes(k)) {
        if (!podeSistema) { if (k in fa) fb[k] = fa[k]; else delete fb[k]; }
        else if (!mesmoJson(fa[k], fb[k])) mexeuSistema = true;
        return;
      }
      if (k.startsWith('_')) { if (!mesmoJson(fa[k], fb[k])) mexeuComum = true; return; }
      const ca = fa[k] || {}, cb = fb[k] || (fb[k] = {});
      [...new Set([...Object.keys(ca), ...Object.keys(cb)])].forEach((prop) => {
        if (FOLHAS_SISTEMA.includes(prop)) {
          if (!podeSistema) { if (prop in ca) cb[prop] = ca[prop]; else delete cb[prop]; }
          else if (!mesmoJson(ca[prop], cb[prop])) mexeuSistema = true;
        } else if (!mesmoJson(ca[prop], cb[prop])) mexeuComum = true;
      });
      if (!Object.keys(cb).length) delete fb[k];
    });
    if (!Object.keys(fb).length) delete b[pid];
  });
  return { folhas: b, mexeuSistema, mexeuComum };
}
/**
 * Decide uma anotação de configuração que chegou. Devolve { aceita, entrada, motivo }.
 * Aplicativo de antes da 2.12 (manda sem "base"): ele não conhece a recusa e marcaria como enviado. Então vale o que
 * ele podia mudar, o resto fica como está, e a configuração volta para ele na próxima sincronização (sai com um
 * horário mais novo que o dele, e o aparelho troca a cópia).
 */
function decidirConfig(atual, r, aparelho) {
  const chefe = nivelDoAparelho(aparelho) > 0;
  const funcoes = chefe ? funcoesNoAparelho(aparelho) : funcoesNoSetor(aparelho);
  const vivo = atual && !atual.apagado ? atual : null;
  const antigo = !('base' in r);
  // conflito: alguém mudou a configuração depois da cópia que este aparelho editou
  if (!antigo && vivo && Number(r.base || 0) !== Number(vivo.rev || 0)) return { aceita: false, motivo: 'conflito' };
  const antes = (vivo && vivo.valores) || {};
  // a configuração da usina não se apaga pela sincronização (o aplicativo nunca apaga): o aparelho antigo recebe ela de volta
  if (r.apagado) return antigo && vivo ? { aceita: true, entrada: Object.assign({}, vivo, { atualizadoEm: Math.max(r.atualizadoEm, vivo.atualizadoEm || 0) + 1, rev: Number(vivo.rev || 0) + 1 }) } : { aceita: false, motivo: 'sem_permissao' };
  const entrada = JSON.parse(JSON.stringify(r));
  delete entrada.base;
  const valores = Object.assign({}, entrada.valores);
  // o que não pode: o aplicativo novo recebe a recusa; do antigo, fica como estava
  const naoPode = (k) => { if (!antigo) return true; if (k in antes) valores[k] = antes[k]; else delete valores[k]; return false; };
  if ('folhas' in valores || 'folhas' in antes) {
    const f = conferirFolhas(antes.folhas, valores.folhas, funcoes.has('sistema'));
    // folhas só no tablet chefe: as do sistema com 'sistema' (o dono no nível 3), as outras com 'folhas'
    const pode = chefe && (!f.mexeuSistema || funcoes.has('sistema')) && (!f.mexeuComum || funcoes.has('folhas') || funcoes.has('sistema'));
    if ((f.mexeuSistema || f.mexeuComum) && !pode) { if (naoPode('folhas')) return { aceita: false, motivo: 'sem_permissao' }; }
    else if (f.folhas && Object.keys(f.folhas).length) valores.folhas = f.folhas;
    else delete valores.folhas;
  }
  for (const k of mudancasDaConfig({ valores: antes }, { valores })) {
    if (k === 'folhas') continue;
    // no tablet de setor só os operadores (ajustes); no tablet chefe, o resto da usina
    const precisa = !chefe ? (k === 'operadores' ? ['ajustes', 'usina'] : null) : ['usina'];
    if ((!precisa || !precisa.some((f) => funcoes.has(f))) && naoPode(k)) return { aceita: false, motivo: 'sem_permissao' };
  }
  entrada.valores = valores;
  entrada.rev = Number(vivo ? vivo.rev || 0 : 0) + 1;
  // a central guardou diferente do que veio (do antigo, ou as do sistema que voltaram): vai de volta para o aparelho
  if (!mesmoJson(valores, r.valores || {})) entrada.atualizadoEm = Math.max(r.atualizadoEm, vivo ? vivo.atualizadoEm || 0 : 0) + 1;
  return { aceita: true, entrada };
}
/** Folhas que só o tablet chefe anota (Vinho e Fermentação): pedem 'anotar'. As dos setores, 'corrigir' ou 'ler_folha'. */
const pranchetasSoDoChefe = () => { try { return formsLidas().setores.filter((s) => s.soChefe).flatMap((s) => s.pranchetas); } catch (e) { return ['med_dornas', 'fermentacao']; } };
/**
 * Anotação que chegou de um tablet chefe: a mesma função que a tela pede, de quem está dentro dele.
 * Sem ninguém dentro: 'sem_sessao' (o aparelho guarda a anotação e manda de novo quando alguém entrar).
 */
function motivoNoChefe(aparelho, r) {
  if (!pessoaDoAparelho(aparelho)) return 'sem_sessao';
  const f = funcoesNoAparelho(aparelho);
  if (r.prancheta === 'avisos') return f.has('avisos') ? '' : 'sem_permissao';
  if (pranchetasSoDoChefe().includes(r.prancheta)) return f.has('anotar') ? '' : 'sem_permissao';
  return f.has('corrigir') || f.has('ler_folha') ? '' : 'sem_permissao';
}
/** Campos do escritório de cada folha de insumo que o operador não preenche (o tablet do setor não muda). */
function camposSoDoEscritorio(pid) {
  let p = null;
  try { p = formsLidas().pranchetas[pid]; } catch (e) { return []; }
  if (!p || p.tipo !== 'insumo') return [];
  const cs = db.registros['config|sistema|geral'];
  const folhas = cs && !cs.apagado && cs.valores ? cs.valores.folhas || {} : {};
  const liberados = new Set([...(p.camposOperador || []).map((c) => c.id), ...((folhas[pid] || {})._operador || [])]);
  return (p.camposEscritorio || []).map((c) => c.id).filter((id) => !liberados.has(id));
}

/* ---------- Registro do sistema (versão 2.9) ----------
   Cada linha é uma anotação da folha "registro" (hora, tipo, quem, aparelho, texto e o antes e depois).
   O aplicativo escreve o que a pessoa fez (ele sabe o antes e o depois); a central escreve o que só ela vê:
   entradas no tablet chefe, aparelho novo, sem sinal ou atualizado, código trocado e pessoas.
   Não vai para os tablets dos setores, nem para a API e a nuvem: o tablet chefe pede o dia quando abre o registro. */
const pad2c = (n) => String(n).padStart(2, '0');
function diaDaUsina(ms = Date.now()) {
  let inicio = 7;
  try { inicio = formsLidas().inicioDoDia; } catch (e) { /* 7 da manhã */ }
  const d = new Date(ms - inicio * 3600000);
  return `${d.getFullYear()}-${pad2c(d.getMonth() + 1)}-${pad2c(d.getDate())}`;
}
function registrar(tipo, texto, extra = {}) {
  const em = Date.now();
  const data = diaDaUsina(em);
  const chave = em.toString(36) + '-' + crypto.randomBytes(3).toString('hex');
  const id = `${data}|registro|${chave}`;
  db.seq += 1;
  db.registros[id] = { id, data, prancheta: 'registro', setor: 'central', chave, valores: Object.assign({ em, tipo, quem: '', aparelho: '', texto }, extra), criadoEm: em, atualizadoEm: em, aparelho: 'central', operador: extra.quem || '', apagado: false, seq: db.seq, recebidoEm: em };
  gravarDisco();
}
/** O que mudou num aparelho que falou com a central: novo, outra versão, outra função, voltou do sem sinal. */
function eventosDoAparelho(id, antes, corpo) {
  const visto = config.aparelhosVistos[id];
  const nome = nomeDoAparelho(id);
  if (!visto) {
    config.aparelhosVistos[id] = { papel: corpo.papel || '', nome: String(corpo.nome || '').slice(0, 60), versao: corpo.versao || '', desde: Date.now(), vistoEm: Date.now() };
    const info = infoLimpa(corpo.info);
    if (info) config.aparelhosVistos[id].info = info;
    if (aparelhos[id] && aparelhos[id].ip) config.aparelhosVistos[id].ip = aparelhos[id].ip;
    salvarConfig();
    registrar('aparelho', `${nome} conectou na central pela primeira vez`, { aparelho: nome });
    return;
  }
  let mudou = false;
  if (corpo.versao && visto.versao && corpo.versao !== visto.versao) { registrar('aparelho', `${nome} atualizou da versão ${visto.versao} para a ${corpo.versao}`, { aparelho: nome, antes: visto.versao, depois: corpo.versao }); mudou = true; }
  if (corpo.papel && visto.papel && corpo.papel !== visto.papel) { registrar('aparelho', `${nome} mudou de função`, { aparelho: nome, antes: visto.papel, depois: corpo.papel }); mudou = true; }
  if (mudou || (corpo.versao && !visto.versao) || (corpo.papel && !visto.papel) || (corpo.nome && corpo.nome !== visto.nome)) { visto.versao = corpo.versao || visto.versao; visto.papel = corpo.papel || visto.papel; visto.nome = String(corpo.nome || visto.nome || '').slice(0, 60); salvarConfig(); }
  // nome no Android, modelo e endereço: guardados quando mudam; a hora em que foi visto, de 10 em 10 minutos
  const info = infoLimpa(corpo.info);
  const ip = aparelhos[id] ? aparelhos[id].ip : '';
  if ((info && JSON.stringify(info) !== JSON.stringify(visto.info || null)) || (ip && ip !== visto.ip) || Date.now() - (visto.vistoEm || 0) > 10 * 60000) {
    if (info) visto.info = info;
    if (ip) visto.ip = ip;
    visto.vistoEm = Date.now();
    salvarConfig();
  }
  if (antes && antes.semSinal) registrar('aparelho', `${nome} voltou a falar com a central (ficou ${Math.max(1, Math.round((Date.now() - antes.vistoEm) / 60000))} min sem sinal)`, { aparelho: nome });
}
const SEM_SINAL_MS = Number(process.env.REGISTRO_SEM_SINAL_MS || 120000);
setInterval(() => {
  const agora = Date.now();
  Object.entries(aparelhos).forEach(([id, a]) => {
    if (!a.semSinal && agora - a.vistoEm > SEM_SINAL_MS) { a.semSinal = true; registrar('aparelho', `${nomeDoAparelho(id)} ficou sem sinal`, { aparelho: nomeDoAparelho(id) }); }
  });
}, Math.min(15000, SEM_SINAL_MS / 2)).unref();

// ---------- Aparelhos bloqueados (versão 2.11) ----------
// O administrador bloqueia um aparelho pelo tablet chefe. "Pede senha": ele só volta com a senha de desbloqueio que o
// administrador escolheu (o próprio aparelho confere, para funcionar até longe da usina). "Trava de vez": só o
// administrador desbloqueia. Com "apagar", o aparelho apaga as anotações que guarda. A lista também vai para a nuvem:
// o aparelho que estiver longe da usina, com internet, pergunta lá se está bloqueado.
if (!config.bloqueios) config.bloqueios = {};
// número de revisão dos bloqueios: sobe a cada bloquear, desbloquear ou liberar e fica gravado. Cada bloqueio leva o seu.
// O aparelho compara por ele (e não pelo relógio, que pode voltar para trás, nem pela hora, que pode repetir).
if (!Number.isFinite(config.bloqueiosRev)) config.bloqueiosRev = 0;
const novaRevisaoDeBloqueio = () => ++config.bloqueiosRev;
// bloqueio guardado antes da revisão existir: ganha uma agora (a nuvem e o aparelho ignoram revisão zero)
if (Object.values(config.bloqueios).some((b) => !(b.rev > 0))) { Object.values(config.bloqueios).forEach((b) => { if (!(b.rev > 0)) b.rev = novaRevisaoDeBloqueio(); }); salvarConfig(); }
const bloqueioPublico = (b) => ({ em: b.em, rev: b.rev || 0, modo: b.modo, apagar: !!b.apagar, sal: b.sal || '', resumo: b.resumo || '' });
const avisouBloqueado = {};
/** As informações que o aparelho manda dele (nome no Android, fabricante, modelo, versão do Android). */
function infoLimpa(info) {
  if (!info || typeof info !== 'object') return null;
  const limpo = {};
  ['nome', 'fabricante', 'modelo', 'android', 'navegador'].forEach((k) => { if (typeof info[k] === 'string' && info[k].trim()) limpo[k] = info[k].trim().slice(0, 60); });
  return Object.keys(limpo).length ? limpo : null;
}
/** Todos os aparelhos que já falaram com esta central: os ligados primeiro. */
function listaDeAparelhos() {
  const agora = Date.now();
  const ids = new Set([...Object.keys(aparelhos), ...Object.keys(config.aparelhosVistos)]);
  return [...ids].map((id) => {
    const a = aparelhos[id] || null;
    const v = config.aparelhosVistos[id] || {};
    const visto = a ? a.vistoEm : v.vistoEm || 0;
    const papel = (a && a.papel) || v.papel || '';
    const b = config.bloqueios[id];
    const pessoa = papel === 'central' && pessoaDoAparelho(id) ? pessoaDoAparelho(id).nome : '';
    return {
      id, papel, operador: a ? a.operador || '' : '', ip: (a && a.ip) || v.ip || '', versao: (a && a.versao) || v.versao || '',
      nome: nomeDoAparelho(id), pessoa, teto: tetoDoAparelho(id), info: (a && a.info) || v.info || null, desde: v.desde || null,
      online: !!a && agora - a.vistoEm < 30000, minutos: visto ? Math.round((agora - visto) / 60000) : null,
      bloqueio: b ? { em: b.em, modo: b.modo, apagar: !!b.apagar, por: b.por || '' } : null,
    };
  }).sort((x, y) => (y.online - x.online) || ((x.minutos == null ? 1e9 : x.minutos) - (y.minutos == null ? 1e9 : y.minutos)));
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
function gravarDisco(agora = false) {
  clearTimeout(gravarTimer);
  const gravar = () => {
    const tmp = ARQUIVO + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, ARQUIVO);
  };
  if (agora) gravar(); else gravarTimer = setTimeout(gravar, 500);
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

    // atualização rápida: o pacote das telas (pacote.json, assinatura e os arquivos)
    if (p.startsWith('/telas/')) {
      const rel = decodeURIComponent(p.slice('/telas/'.length));
      const arquivo = path.resolve(TELAS, rel);
      if (!rel || !arquivo.startsWith(path.resolve(TELAS) + path.sep) || !fs.existsSync(arquivo) || !fs.statSync(arquivo).isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('não existe'); }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream', 'Content-Length': fs.statSync(arquivo).size, 'Cache-Control': 'no-store' });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(arquivo).pipe(res);
    }

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
      const bloqueio = config.bloqueios[aparelho];
      if (bloqueio && !/^api\/liberar(\?|$)/.test(caminho)) {
        // aparelho bloqueado pelo administrador: só consegue tentar se liberar com a senha
        falso.status = 423;
        // com a geração: se o aparelho acabou de trocar de central, ele sabe que a revisão dos bloqueios recomeçou
        falso.corpo = JSON.stringify({ erro: 'bloqueado', bloqueio: bloqueioPublico(bloqueio), geracao: config.geracao });
        if (Date.now() - (avisouBloqueado[aparelho] || 0) > 3600000) { avisouBloqueado[aparelho] = Date.now(); registrar('aparelho', `${nomeDoAparelho(aparelho)} está bloqueado e tentou falar com a central`, { aparelho: nomeDoAparelho(aparelho) }); }
      } else {
        await rotaProtegida({ method: cab.m === 'POST' ? 'POST' : 'GET', corpoPronto: texto.slice(nl + 1), aparelho }, falso, new URL('/' + caminho, 'http://localhost'), ip);
      }
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

/** O sync local e a fila usam a mesma autorização, revisão e gravação. */
function sincronizar(corpo, aparelho, ip) {
  const bloqueio = config.bloqueios[aparelho];
  if (bloqueio) return { erro: 'bloqueado', bloqueio: bloqueioPublico(bloqueio), geracao: config.geracao };
  if (corpo.aparelho) {
    const antes = aparelhos[corpo.aparelho];
    aparelhos[corpo.aparelho] = { papel: corpo.papel, nome: String(corpo.nome || '').slice(0, 60), operador: corpo.operador, versao: corpo.versao || '', vistoEm: Date.now(), ip, info: infoLimpa(corpo.info) };
    eventosDoAparelho(corpo.aparelho, antes, corpo);
  }
  guardarErros(corpo.aparelho, corpo.erros, ip);
  // aparelho com anotações de antes de zerar: não aceita, manda ele limpar.
  // Aparelho que acabou de conectar numa central nova (tablet chefe trocado ou reinstalado): aceita o que ele tem.
  if (corpo.geracao && corpo.geracao !== config.geracao) {
    const zerada = (config.geracoesZeradas || []).includes(corpo.geracao);
    if (zerada || !corpo.novaConexao) return { ok: false, zerar: true, geracao: config.geracao, seq: db.seq, agora: Date.now() };
  }
  const dias = new Set();
  const antigos = {};
  let aceitos = 0;
  // o que a central não aceitou (versão 2.12): o aparelho não marca como enviado e mostra o motivo
  const recusados = [];
  const revs = {};
  const nivelAqui = nivelDoAparelho(aparelho);
  // a anotação guardada: na memória ou, de dia antigo, no BackupUsina (cada dia lido uma vez só)
  const doArquivo = {};
  const guardadaDe = (r) => db.registros[r.id] || (arquivado(r.data) ? (doArquivo[r.data] = doArquivo[r.data] || new Map(lerDiaArquivado(r.data).map((x) => [x.id, x]))).get(r.id) || null : null);
  for (const r0 of Array.isArray(corpo.registros) ? corpo.registros : []) {
    let r = r0;
    if (!r || typeof r.id !== 'string' || typeof r.atualizadoEm !== 'number') continue;
    // o id diz o que a anotação é (dia|folha|linha): com outro id, uma anotação poderia passar por configuração
    if (r.id !== `${r.data}|${r.prancheta}|${r.chave}` || !(r.data === 'config' || ehDia(r.data))) { recusados.push({ id: r.id, motivo: 'invalido' }); continue; }
    // configuração da usina: confere quem pode mudar cada parte, e o conflito
    if (r.data === 'config') {
      const d = decidirConfig(db.registros[r.id], r, aparelho);
      if (!d.aceita) { recusados.push({ id: r.id, motivo: d.motivo, atual: db.registros[r.id] || null }); continue; }
      r = d.entrada;
      revs[r.id] = r.rev;
    } else if (r.prancheta === 'rastreamento') {
      const f = nivelAqui ? funcoesNoAparelho(aparelho) : funcoesNoSetor(aparelho);
      if (!f.has('escritorio')) { recusados.push({ id: r.id, motivo: 'sem_permissao' }); continue; }
    } else if (nivelAqui && !['registro', 'avisos-recibo'].includes(r.prancheta)) {
      // tablet chefe: a função de quem está dentro (a mesma que a tela pede)
      const motivo = motivoNoChefe(aparelho, r);
      if (motivo) { recusados.push({ id: r.id, motivo }); continue; }
    } else if (r.prancheta === 'avisos') {
      // aviso só sai do tablet chefe
      recusados.push({ id: r.id, motivo: 'sem_permissao' }); continue;
    }
    // tablet de setor não muda os campos que são só do escritório (NF, lote, validade...), nem de dia antigo
    if (!nivelAqui && r.valores) {
      const soEscritorio = camposSoDoEscritorio(r.prancheta);
      if (soEscritorio.length) {
        const guardado = guardadaDe(r);
        const valores = Object.assign({}, r.valores);
        soEscritorio.forEach((c) => { if (guardado && guardado.valores && c in guardado.valores) valores[c] = guardado.valores[c]; else delete valores[c]; });
        r = Object.assign({}, r, { valores });
      }
    }
    if (r.prancheta === 'rastreamento' && !nivelAqui && liberadosNoSetor[aparelho]) liberadosNoSetor[aparelho].ate = Date.now() + LIBERADO_NO_SETOR_MS;
    if (arquivado(r.data)) {
      const limpo = Object.assign({}, r, { recebidoEm: Date.now() });
      delete limpo.sincronizado;
      (antigos[r.data] = antigos[r.data] || []).push(limpo);
      continue;
    }
    const atual = db.registros[r.id];
    const entrada = criadasSemSaber(atual, r) ? juntarLinhas(atual, r) : r;
    // a configuração já foi conferida pela revisão (o relógio do aparelho não decide)
    if (!atual || entrada !== r || r.atualizadoEm >= atual.atualizadoEm || r.data === 'config') {
      db.seq += 1;
      const limpo = Object.assign({}, entrada, { seq: db.seq, recebidoEm: Date.now() });
      delete limpo.sincronizado;
      db.registros[r.id] = limpo;
      dias.add(r.data);
      aceitos += 1;
    }
  }
  Object.entries(antigos).forEach(([d, lista]) => { aceitos += juntarNoArquivo(d, lista); });
  if (aceitos) { gravarDisco(); dias.forEach(backupDoDia); agendarNuvem(); }
  // bloqueado enquanto esta sincronização acontecia: responde como bloqueado (o 200 abaixo diz "livre até a revisão")
  const blq = config.bloqueios[aparelho];
  if (blq) return { erro: 'bloqueado', bloqueio: bloqueioPublico(blq), geracao: config.geracao };
  // o endereço da nuvem vai junto: longe da usina, o aparelho pergunta lá se foi bloqueado
  // bloqueiosRev: "não está bloqueado até esta revisão" (resposta atrasada da nuvem com bloqueio mais velho não trava)
  return { ok: true, aceitos, recusados, revs, seq: db.seq, agora: Date.now(), geracao: config.geracao, nuvem: config.nuvem.url || '', nuvemToken: tokenNuvem(aparelho), bloqueiosRev: config.bloqueiosRev };
}

/** As rotas com os dados da usina. Chegam aqui só depois de abrir o pedido embaralhado. */
async function rotaProtegida(req, res, url, ip) {
  const p = url.pathname;
  try {
      if (p === '/api/sync' && req.method === 'POST') {
        const corpo = JSON.parse(await lerCorpo(req));
        const resultado = sincronizar(corpo, req.aparelho, ip);
        return json(res, resultado.erro === 'bloqueado' ? 423 : 200, resultado);
      }

      // pessoas do escritório: entrar com a senha, sair, e (só o administrador) cadastrar e dar permissões
      if (p === '/api/pessoas' && req.method === 'POST') {
        const corpo = JSON.parse(await lerCorpo(req, 100000));
        const quem = pessoaDoAparelho(req.aparelho);
        const aqui = nomeDoAparelho(req.aparelho);
        if (corpo.acao === 'entrar' || corpo.acao === 'verificar') {
          const agora = Date.now();
          const t = (tentativasSenha[req.aparelho] = (tentativasSenha[req.aparelho] || []).filter((x) => agora - x < 60000));
          if (t.length >= 5) return json(res, 429, { erro: 'Muitas senhas erradas. Espere um minuto.' });
          const pessoa = /^\d{4,8}$/.test(String(corpo.pin || '')) ? pessoaDaSenha(corpo.pin) : null;
          if (!pessoa) { t.push(agora); registrar('entrada', `Senha errada no ${aqui}`, { aparelho: aqui }); return json(res, 403, { erro: 'Senha errada' }); }
          if (corpo.acao === 'entrar') {
            // só entra pessoa em tablet chefe liberado; no nível 3, só o dono (versão 2.12)
            const nivel = nivelDoAparelho(req.aparelho);
            if (!nivel) return json(res, 403, { erro: 'Este aparelho ainda não foi liberado como tablet chefe', naoLiberado: true });
            if (nivel === 3 && !ehDono(pessoa)) return json(res, 403, { erro: 'Este tablet é só do dono do sistema' });
            const antes = pessoaDoAparelho(req.aparelho);
            config.sessoes[req.aparelho] = { pessoaId: pessoa.id, em: agora };
            salvarConfig();
            if (!antes || antes.id !== pessoa.id) registrar('entrada', `${pessoa.nome} entrou no ${aqui}`, { quem: pessoa.nome, aparelho: aqui });
          }
          // tablet de setor: quem conferiu a senha fica liberado por 10 minutos para mudar os ajustes (operadores)
          if (corpo.acao === 'verificar' && !nivelDoAparelho(req.aparelho)) liberadosNoSetor[req.aparelho] = { pessoaId: pessoa.id, ate: agora + LIBERADO_NO_SETOR_MS };
          return json(res, 200, Object.assign({ pessoa: pessoaPublica(pessoa), teto: tetoDoAparelho(req.aparelho) }, permissoesDoAparelho(req.aparelho, corpo.acao === 'entrar' ? null : pessoa)));
        }
        if (corpo.acao === 'sair') {
          if (quem) { delete config.sessoes[req.aparelho]; salvarConfig(); registrar('entrada', `${quem.nome} saiu do ${aqui}${corpo.motivo ? ` (${String(corpo.motivo).slice(0, 60)})` : ''}`, { quem: quem.nome, aparelho: aqui }); }
          return json(res, 200, { ok: true });
        }
        if (corpo.acao === 'quem') return json(res, 200, Object.assign({ pessoa: quem ? pessoaPublica(quem) : null, teto: tetoDoAparelho(req.aparelho) }, permissoesDoAparelho(req.aparelho)));
        // daqui para baixo, só o administrador (ou o dono), num tablet chefe nível 2 ou 3
        if (!quem || !podeNoAparelho(req.aparelho, 'pessoas')) return json(res, 403, { erro: 'Só o administrador mexe nas pessoas e permissões' });
        const lista = () => json(res, 200, { pessoas: config.pessoas.map(pessoaPublica), aparelhos: config.aparelhosChefe, donoId: config.donoId || '' });
        if (corpo.acao === 'lista') return lista();
        if (corpo.acao === 'salvar') {
          const d = corpo.pessoa || {};
          const nome = String(d.nome || '').trim().slice(0, 40);
          if (!nome) return json(res, 400, { erro: 'Falta o nome' });
          if (!NIVEIS_VALIDOS.includes(d.nivel)) return json(res, 400, { erro: 'Nível inválido' });
          const existente = d.id ? config.pessoas.find((x) => x.id === d.id) : null;
          if (d.id && !existente) return json(res, 404, { erro: 'Pessoa não encontrada' });
          // o dono só o próprio dono muda; e ele continua administrador e ativo (versão 2.12)
          if (ehDono(existente) && !ehDono(quem)) return json(res, 403, { erro: 'Só o dono do sistema muda os dados dele' });
          if (ehDono(existente) && (d.nivel !== 'administrador' || d.ativo === false)) return json(res, 400, { erro: 'O dono do sistema continua administrador e ativo' });
          if (config.pessoas.some((x) => x !== existente && x.nome.toLowerCase() === nome.toLowerCase())) return json(res, 400, { erro: 'Já tem uma pessoa com esse nome' });
          const pin = d.pin == null || d.pin === '' ? null : String(d.pin);
          if (pin !== null && !/^\d{4,8}$/.test(pin)) return json(res, 400, { erro: 'A senha tem de 4 a 8 números' });
          if (!existente && !pin) return json(res, 400, { erro: 'Falta a senha' });
          if (pin && config.pessoas.some((x) => x !== existente && x.resumo && mesmoSegredo(resumoDaSenha(pin, x.sal), x.resumo))) return json(res, 400, { erro: 'Essa senha já é de outra pessoa. Escolha outra.' });
          const ativo = d.ativo !== false;
          const admins = config.pessoas.filter((x) => x !== existente && x.nivel === 'administrador' && x.ativo !== false).length;
          if (existente && existente.nivel === 'administrador' && (d.nivel !== 'administrador' || !ativo) && !admins) return json(res, 400, { erro: 'Precisa ficar pelo menos um administrador' });
          const extras = {};
          Object.entries(d.extras || {}).forEach(([k, v]) => { if (/^[a-z_]{2,30}$/.test(k) && typeof v === 'boolean') extras[k] = v; });
          const novo = existente || { id: 'p' + crypto.randomBytes(4).toString('hex'), criadoEm: Date.now() };
          const antes = existente ? { nome: existente.nome, nivel: existente.nivel, ativo: existente.ativo !== false, extras: JSON.stringify(existente.extras || {}) } : null;
          Object.assign(novo, { nome, nivel: d.nivel, extras, ativo }, pin ? guardarSenha(pin) : {});
          if (!existente) config.pessoas.push(novo);
          if (!ativo) Object.keys(config.sessoes).forEach((k) => { if (config.sessoes[k].pessoaId === novo.id) delete config.sessoes[k]; });
          salvarConfig();
          const nomeNivel = { administrador: 'Administrador', encarregado: 'Encarregado', consulta: 'Consulta' };
          const partes = [];
          if (!antes) partes.push(`cadastrou ${nome} (${nomeNivel[d.nivel]})`);
          else {
            if (antes.nome !== nome) partes.push(`mudou o nome de ${antes.nome} para ${nome}`);
            if (antes.nivel !== d.nivel) partes.push(`mudou ${nome} de ${nomeNivel[antes.nivel]} para ${nomeNivel[d.nivel]}`);
            if (antes.ativo !== ativo) partes.push(`${ativo ? 'reativou' : 'desativou'} ${nome}`);
            if (antes.extras !== JSON.stringify(extras)) partes.push(`mudou as funções de ${nome}`);
            if (pin) partes.push(`trocou a senha de ${nome}`);
          }
          if (partes.length) registrar('configuracao', `${quem.nome} ${partes.join(', ')}`, { quem: quem.nome, aparelho: aqui });
          return lista();
        }
        if (corpo.acao === 'aparelho') {
          const id = String(corpo.id || '').slice(0, 80);
          if (!id) return json(res, 400, { erro: 'Falta o aparelho' });
          const a = config.aparelhosChefe[id] || (config.aparelhosChefe[id] = {});
          const nomeAntes = nomeDoAparelho(id);
          if (typeof corpo.nome === 'string') a.nome = corpo.nome.trim().slice(0, 40);
          if ('teto' in corpo) a.teto = Array.isArray(corpo.teto) ? corpo.teto.filter((x) => /^[a-z_]{2,30}$/.test(x)) : null;
          // nível (versão 2.12): quem libera tablets chefe muda entre 1 e 2; o nível 3 (e tirar do 3) só o dono;
          // o próprio aparelho só o dono muda. Quem estava dentro sai (a regra nova vale na hora).
          if ('nivel' in corpo) {
            const novoNivel = Number(corpo.nivel) || 0;
            const nivelAntes = nivelDoAparelho(id);
            if (![0, 1, 2, 3].includes(novoNivel)) return json(res, 400, { erro: 'Nível inválido' });
            if (!podeNoAparelho(req.aparelho, 'chefes')) return json(res, 403, { erro: 'Quem está neste aparelho não libera tablets chefe', semPermissao: 'chefes' });
            if ((novoNivel === 3 || nivelAntes === 3 || id === req.aparelho) && !ehDono(quem)) return json(res, 403, { erro: 'Só o dono do sistema muda este nível' });
            if (novoNivel !== nivelAntes) {
              if (novoNivel) a.nivel = novoNivel; else delete a.nivel;
              delete config.sessoes[id];
              registrar('configuracao', `${quem.nome} mudou o ${nomeAntes} de ${nomeDoNivel(nivelAntes)} para ${nomeDoNivel(novoNivel)}`, { quem: quem.nome, aparelho: aqui });
            }
          }
          salvarConfig();
          registrar('configuracao', `${quem.nome} mudou o que o ${nomeAntes} pode fazer${a.nome && a.nome !== nomeAntes ? ` (agora se chama ${a.nome})` : ''}`, { quem: quem.nome, aparelho: aqui });
          return lista();
        }
        return json(res, 400, { erro: 'ação desconhecida' });
      }

      // liberar este aparelho como tablet chefe, e recuperar o dono com a senha do programador (versão 2.12)
      if (p === '/api/chefes' && req.method === 'POST') {
        const corpo = JSON.parse(await lerCorpo(req, 10000));
        const aqui = nomeDoAparelho(req.aparelho);
        if (corpo.acao === 'estado') return json(res, 200, { nivel: nivelDoAparelho(req.aparelho) });
        if (corpo.acao === 'liberar') {
          const agora = Date.now();
          const t = (tentativasSenha[req.aparelho] = (tentativasSenha[req.aparelho] || []).filter((x) => agora - x < 60000));
          if (t.length >= 5) return json(res, 429, { erro: 'Muitas senhas erradas. Espere um minuto.' });
          const pessoa = /^\d{4,8}$/.test(String(corpo.pin || '')) ? pessoaDaSenha(corpo.pin) : null;
          if (!pessoa) { t.push(agora); registrar('entrada', `Senha errada ao liberar o ${aqui} como tablet chefe`, { aparelho: aqui }); return json(res, 403, { erro: 'Senha errada' }); }
          const nivel = Number(corpo.nivel);
          if (![1, 2, 3].includes(nivel)) return json(res, 400, { erro: 'Nível inválido' });
          // nível 3 só o dono; 1 ou 2, quem libera tablets chefe (administrador, ou quem ganhou a função) ou o dono
          if (nivel === 3 ? !ehDono(pessoa) : !funcoesDaPessoa(pessoa).has('chefes')) return json(res, 403, { erro: nivel === 3 ? 'Só o dono do sistema libera o nível 3' : `${pessoa.nome} não pode liberar tablet chefe` });
          const a = config.aparelhosChefe[req.aparelho] || (config.aparelhosChefe[req.aparelho] = {});
          const antes = nivelDoAparelho(req.aparelho);
          Object.assign(a, { nivel, liberadoPor: pessoa.nome, liberadoEm: agora });
          delete config.sessoes[req.aparelho];
          salvarConfig();
          registrar('configuracao', `${pessoa.nome} liberou o ${aqui} como tablet chefe ${nomeDoNivel(nivel)}${antes ? ` (antes: ${nomeDoNivel(antes)})` : ''}`, { quem: pessoa.nome, aparelho: aqui });
          return json(res, 200, { ok: true, nivel });
        }
        if (corpo.acao === 'recuperar') {
          // o dono esqueceu a senha ou perdeu o tablet nível 3: com a senha do programador, este aparelho vira o do dono
          if (!podeTentarProgramador(req.aparelho)) return json(res, 429, { erro: 'Muitas senhas erradas. Espere um minuto.' });
          if (!(await senhaDoProgramador(corpo.senha))) { errouProgramador(req.aparelho); registrar('entrada', `Senha do programador errada no ${aqui}`, { aparelho: aqui }); return json(res, 403, { erro: 'Senha do programador errada' }); }
          const dono = config.pessoas.find((x) => x.id === config.donoId);
          if (!dono) return json(res, 409, { erro: 'O sistema não tem dono cadastrado' });
          const nova = corpo.novaSenha == null || corpo.novaSenha === '' ? null : String(corpo.novaSenha);
          if (nova !== null) {
            if (!/^\d{4,8}$/.test(nova)) return json(res, 400, { erro: 'A senha tem de 4 a 8 números' });
            if (config.pessoas.some((x) => x !== dono && x.resumo && mesmoSegredo(resumoDaSenha(nova, x.sal), x.resumo))) return json(res, 400, { erro: 'Essa senha já é de outra pessoa. Escolha outra.' });
            Object.assign(dono, guardarSenha(nova));
          }
          Object.assign(dono, { nivel: 'administrador', ativo: true });
          Object.keys(config.sessoes).forEach((k) => { if (config.sessoes[k].pessoaId === dono.id) delete config.sessoes[k]; });
          const a = config.aparelhosChefe[req.aparelho] || (config.aparelhosChefe[req.aparelho] = {});
          Object.assign(a, { nivel: 3, liberadoPor: 'senha do programador', liberadoEm: Date.now() });
          delete config.sessoes[req.aparelho];
          salvarConfig();
          registrar('configuracao', `Com a senha do programador, o ${aqui} virou o tablet do dono (nível 3)${nova ? ' e a senha do dono foi trocada' : ''}`, { aparelho: aqui });
          return json(res, 200, { ok: true, nivel: 3 });
        }
        return json(res, 400, { erro: 'ação desconhecida' });
      }

      // aparelho bloqueado que pede senha: a senha de desbloqueio libera (versão 2.11)
      if (p === '/api/liberar' && req.method === 'POST') {
        const corpo = JSON.parse(await lerCorpo(req, 10000));
        const b = config.bloqueios[req.aparelho];
        if (!b) return json(res, 200, { ok: true });
        // a liberação vale só para o bloqueio em que a senha foi digitada (a revisão dele): um bloqueio mais novo, mesmo com a
        // mesma senha, continua
        // e só desta central (geração): a revisão é um contador de cada central
        if (b.modo !== 'senha' || Number(corpo.rev) !== (b.rev || 0) || corpo.geracao !== config.geracao) return json(res, 423, { erro: 'bloqueado', bloqueio: bloqueioPublico(b), geracao: config.geracao });
        const agora = Date.now();
        const t = (tentativasSenha['liberar|' + req.aparelho] = (tentativasSenha['liberar|' + req.aparelho] || []).filter((x) => agora - x < 60000));
        if (t.length >= 5) return json(res, 429, { erro: 'Muitas senhas erradas. Espere um minuto.' });
        const codigo = String(corpo.codigo || '');
        if (!/^\d{4,8}$/.test(codigo) || !mesmoSegredo(resumoDaSenha(codigo, b.sal), b.resumo)) { t.push(agora); return json(res, 403, { erro: 'Senha errada', bloqueio: bloqueioPublico(b), geracao: config.geracao }); }
        delete config.bloqueios[req.aparelho];
        novaRevisaoDeBloqueio();
        salvarConfig();
        registrar('aparelho', `${nomeDoAparelho(req.aparelho)} foi liberado com a senha de desbloqueio`, { aparelho: nomeDoAparelho(req.aparelho) });
        agendarNuvem(500);
        return json(res, 200, { ok: true });
      }

      // bloquear e desbloquear um aparelho: só o administrador (versão 2.11)
      if (p === '/api/aparelhos' && req.method === 'POST') {
        const corpo = JSON.parse(await lerCorpo(req, 10000));
        const quem = pessoaDoAparelho(req.aparelho);
        if (!quem || !podeNoAparelho(req.aparelho, 'pessoas')) return json(res, 403, { erro: 'Só o administrador bloqueia e desbloqueia aparelhos' });
        const id = String(corpo.id || '').slice(0, 80);
        if (!id || !(aparelhos[id] || config.aparelhosVistos[id])) return json(res, 404, { erro: 'Aparelho não encontrado' });
        const nome = nomeDoAparelho(id);
        const aqui = nomeDoAparelho(req.aparelho);
        if (corpo.acao === 'bloquear') {
          if (id === req.aparelho) return json(res, 400, { erro: 'Não dá para bloquear o aparelho que você está usando' });
          const modo = corpo.modo === 'senha' ? 'senha' : 'trava';
          const b = { em: Date.now(), modo, apagar: !!corpo.apagar, por: quem.nome };
          if (modo === 'senha') {
            const codigo = String(corpo.codigo || '');
            if (!/^\d{4,8}$/.test(codigo)) return json(res, 400, { erro: 'A senha de desbloqueio tem de 4 a 8 números' });
            Object.assign(b, guardarSenha(codigo));
          }
          b.rev = novaRevisaoDeBloqueio();
          config.bloqueios[id] = b;
          delete config.sessoes[id];
          salvarConfig();
          registrar('configuracao', `${quem.nome} bloqueou o ${nome} (${modo === 'senha' ? 'pede a senha de desbloqueio' : 'travado de vez'}${b.apagar ? ', apagando as anotações guardadas nele' : ''})`, { quem: quem.nome, aparelho: aqui });
          agendarNuvem(500);
          return json(res, 200, { ok: true, aparelhos: listaDeAparelhos() });
        }
        if (corpo.acao === 'desbloquear') {
          if (config.bloqueios[id]) {
            delete config.bloqueios[id];
            novaRevisaoDeBloqueio();
            salvarConfig();
            registrar('configuracao', `${quem.nome} desbloqueou o ${nome}`, { quem: quem.nome, aparelho: aqui });
            agendarNuvem(500);
          }
          return json(res, 200, { ok: true, aparelhos: listaDeAparelhos() });
        }
        return json(res, 400, { erro: 'ação desconhecida' });
      }

      // registro do sistema de um dia (o tablet chefe pede quando abre o registro)
      if (p === '/api/registro') {
        if (!podeNoAparelho(req.aparelho, 'registro')) return negar(res, 'registro');
        const dia = url.searchParams.get('dia');
        if (!ehDia(dia)) return json(res, 400, { erro: 'dia inválido' });
        const todos = arquivado(dia) ? lerDiaArquivado(dia) : Object.values(db.registros).filter((r) => r.data === dia);
        return json(res, 200, { registros: todos.filter((r) => r.prancheta === 'registro' && !r.apagado).sort((a, b) => (a.valores.em || 0) - (b.valores.em || 0)) });
      }

      // nuvem das pranchetas: o tablet chefe cadastra o endereço e a senha; a central manda sozinha
      if (p === '/api/nuvem' && req.method === 'POST') {
        const corpo = JSON.parse(await lerCorpo(req, 100000));
        const n = config.nuvem;
        if (corpo.acao === 'estado' || corpo.acao === 'forms') return json(res, 200, estadoNuvem()); // o computador lê o forms.js sozinho
        if ((corpo.acao === 'configurar' || corpo.acao === 'enviar') && !podeNoAparelho(req.aparelho, 'integracoes')) return negar(res, 'integracoes');
        if (corpo.acao === 'configurar') {
          const endereco = String(corpo.url || '').trim().replace(/\/+$/, '');
          if (endereco && !/^https:\/\/[^\s/]+\.[^\s]+$/i.test(endereco) && !/^http:\/\/127\.0\.0\.1:\d+$/.test(endereco)) return json(res, 400, { erro: 'Endereço inválido. Ele começa com https://' });
          if (endereco !== n.url) Object.assign(n, { url: endereco, seq: 0, arquivosEnviados: false, conferida: false, formsHash: '', medidasHash: '', erro: '', ultimoEnvio: 0, faltam: 0 });
          if (typeof corpo.segredo === 'string') { n.segredo = corpo.segredo.trim().slice(0, 200); n.conferida = false; n.erro = ''; }
          salvarConfig();
          agendarNuvem(500);
          return json(res, 200, estadoNuvem());
        }
        if (corpo.acao === 'enviar') {
          if (!n.url || !n.segredo) return json(res, 400, { erro: 'Cadastre o endereço e a senha da nuvem' });
          await enviarParaNuvem();
          return json(res, 200, estadoNuvem());
        }
        return json(res, 400, { erro: 'ação desconhecida' });
      }

      // totais do dia para o Base44 (sistema do escritório): o tablet chefe calcula, a central manda pela internet
      if (p === '/api/base44' && req.method === 'POST') {
        const corpo = JSON.parse(await lerCorpo(req, 2 * 1024 * 1024));
        const b = config.base44;
        if (corpo.acao === 'estado') return json(res, 200, estadoBase44(true));
        if (corpo.acao === 'configurar' && !podeNoAparelho(req.aparelho, 'integracoes')) return negar(res, 'integracoes');
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
          // os totais do dia saem só do tablet chefe liberado (ele manda sozinho, mesmo sem ninguém dentro)
          if (!nivelDoAparelho(req.aparelho)) return negar(res, 'relatorios');
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
          const lista = (arquivado(dia) ? lerDiaArquivado(dia) : Object.values(db.registros).filter((r) => r.data === dia)).filter((r) => r.prancheta !== 'registro');
          return json(res, 200, { seq: db.seq, geracao: config.geracao, registros: lista });
        }
        const desde = Number(url.searchParams.get('desde') || 0);
        const base = desde > db.seq ? 0 : desde; // servidor foi zerado: manda tudo
        // cada aparelho guarda só os últimos dias (a configuração da usina, os avisos e os enchimentos das dornas de
        // fermentação vão sempre: uma dorna pode passar vários dias fermentando)
        const aPartirDe = url.searchParams.get('aPartirDe');
        // o registro do sistema não vai (o tablet chefe pede o dia quando abre o registro)
        const serve = (r) => r.prancheta !== 'registro' && (!ehDia(aPartirDe) || !ehDia(r.data) || r.data >= aPartirDe || r.prancheta === 'avisos' || r.prancheta === 'avisos-recibo' || r.prancheta === 'fermentacao');
        return json(res, 200, { seq: db.seq, geracao: config.geracao, registros: Object.values(db.registros).filter((r) => r.seq > base && serve(r)) });
      }

      if (p === '/api/status') {
        const agora = Date.now();
        return json(res, 200, {
          seq: db.seq, total: Object.keys(db.registros).length,
          codigo: config.codigo, enderecos: enderecosLocais(), apk: fs.existsSync(APK), base44: estadoBase44(false), nuvem: estadoNuvem(),
          pastas: { servidor: PASTAS.servidor, relatorios: PASTAS.relatorios, backup: PASTAS.backup },
          aparelhos: listaDeAparelhos(),
        });
      }

      // O tablet chefe manda o Excel e o XML do dia para ficarem guardados aqui
      if (p === '/api/relatorio' && req.method === 'POST') {
        // só o tablet chefe liberado guarda a folha do dia (sozinho às 07:05, mesmo sem ninguém dentro, ou pela tela)
        if (!nivelDoAparelho(req.aparelho)) return negar(res, 'relatorios');
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
        // apagar relatório: quem tem relatórios, num tablet chefe nível 2 ou 3 (o nível 1 vê, corrige e envia)
        if (!podeNoAparelho(req.aparelho, 'relatorios') || nivelDoAparelho(req.aparelho) < 2) return negar(res, 'relatorios');
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
        if (!podeNoAparelho(req.aparelho, 'ajustes')) return negar(res, 'ajustes');
        if (!podeTentarProgramador(req.aparelho)) return json(res, 429, { erro: 'Muitas senhas erradas. Espere um minuto.' });
        if (!(await senhaDoProgramador(corpo.senha))) { errouProgramador(req.aparelho); return json(res, 403, { erro: 'senha do programador errada' }); }
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
        const quemZerou = pessoaDoAparelho(req.aparelho);
        registrar('configuracao', `${quemZerou ? quemZerou.nome : 'Alguém'} apagou todas as anotações do sistema (${apagados}). A cópia ficou no BackupUsina.`, { quem: quemZerou ? quemZerou.nome : '', aparelho: nomeDoAparelho(req.aparelho) });
        gravarDisco();
        return json(res, 200, { ok: true, apagados, geracao: config.geracao, copia: `BackupUsina/antes-de-zerar-${carimbo}.json` });
      }

      // trocar o código também troca a chave: todos os outros aparelhos são desconectados (aparelho perdido ou roubado)
      if (p === '/api/novo-codigo' && req.method === 'POST') {
        if (!podeNoAparelho(req.aparelho, 'conexao')) return negar(res, 'conexao');
        config.codigo = novoCodigo(); config.chave = crypto.randomBytes(18).toString('hex'); salvarConfig();
        const quemTrocou = pessoaDoAparelho(req.aparelho);
        registrar('configuracao', `${quemTrocou ? quemTrocou.nome : 'Alguém'} trocou o código de conexão. Os outros aparelhos precisam conectar de novo.`, { quem: quemTrocou ? quemTrocou.nome : '', aparelho: nomeDoAparelho(req.aparelho) });
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
// nuvem: manda o que mudou logo depois de ligar e a cada minuto (e 5 s depois de chegar anotação nova)
setTimeout(enviarParaNuvem, Number(process.env.NUVEM_ESPERA_MS || 15000)).unref();
setInterval(enviarParaNuvem, 60 * 1000).unref();
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
