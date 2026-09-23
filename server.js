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
 *  - depois de conectado, o aparelho recebe uma chave e só ela abre os dados
 *
 * Não precisa instalar nada além do Node.js. Os dados ficam em ./dados/ServidorUsina,
 * os relatórios em ./dados/RelatoriosUsina e os backups diários em ./dados/BackupUsina.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORTA = Number(process.env.PORTA || process.env.PORT || 8080);
const PUBLICO = path.join(__dirname, 'public');
const APK = path.join(__dirname, 'apk', 'saida', 'pranchetas.apk');
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
function backupDoDia(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return;
  const doDia = Object.values(db.registros).filter((r) => r.data === data);
  fs.writeFile(path.join(PASTAS.backup, `${data}.json`), JSON.stringify(doDia, null, 1), () => {});
}
function listaDeRelatorios() {
  if (!fs.existsSync(PASTAS.relatorios)) return [];
  return fs.readdirSync(PASTAS.relatorios).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse().map((d) => ({
    data: d,
    arquivos: fs.readdirSync(path.join(PASTAS.relatorios, d)).sort().map((nome) => ({ nome, tamanho: fs.statSync(path.join(PASTAS.relatorios, d, nome)).size })),
  }));
}

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

// ---------- HTTP ----------
function cabecalhosCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // o APK roda em http://localhost
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Chave');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}
function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function lerCorpo(req, limite = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let tamanho = 0;
    const partes = [];
    req.on('data', (c) => {
      tamanho += c.length;
      if (tamanho > limite) { reject(new Error('muito grande')); req.destroy(); return; }
      partes.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
    req.on('error', reject);
  });
}
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.svg': 'image/svg+xml',
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
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap">
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
    if (p === '/api/ping') return json(res, 200, { app: 'pranchetas', rede: config.nome, apk: fs.existsSync(APK) });

    if (p === '/api/parear' && req.method === 'POST') {
      const agora = Date.now();
      tentativas[ip] = (tentativas[ip] || []).filter((t) => agora - t < 60000);
      if (tentativas[ip].length >= 6) return json(res, 429, { erro: 'Muitas tentativas. Espere um minuto.' });
      tentativas[ip].push(agora);
      const corpo = JSON.parse(await lerCorpo(req, 10000));
      if (String(corpo.codigo || '') !== config.codigo) return json(res, 403, { erro: 'Código errado' });
      return json(res, 200, { chave: config.chave, rede: config.nome });
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

    // ----- rotas protegidas pela chave -----
    if (p.startsWith('/api/')) {
      if (req.headers['x-chave'] !== config.chave) return json(res, 401, { erro: 'Aparelho não conectado à central' });

      if (p === '/api/sync' && req.method === 'POST') {
        const corpo = JSON.parse(await lerCorpo(req));
        if (corpo.aparelho) aparelhos[corpo.aparelho] = { papel: corpo.papel, operador: corpo.operador, versao: corpo.versao || '', vistoEm: Date.now(), ip };
        guardarErros(corpo.aparelho, corpo.erros, ip);
        // aparelho com anotações de antes de zerar: não aceita, manda ele limpar
        if (corpo.geracao && corpo.geracao !== config.geracao) return json(res, 200, { ok: false, zerar: true, geracao: config.geracao, seq: db.seq, agora: Date.now() });
        const dias = new Set();
        let aceitos = 0;
        for (const r of Array.isArray(corpo.registros) ? corpo.registros : []) {
          if (!r || typeof r.id !== 'string' || typeof r.atualizadoEm !== 'number') continue;
          const atual = db.registros[r.id];
          if (!atual || r.atualizadoEm >= atual.atualizadoEm) {
            db.seq += 1;
            const limpo = Object.assign({}, r, { seq: db.seq, recebidoEm: Date.now() });
            delete limpo.sincronizado;
            db.registros[r.id] = limpo;
            dias.add(r.data);
            aceitos += 1;
          }
        }
        if (aceitos) { gravarDisco(); dias.forEach(backupDoDia); }
        return json(res, 200, { ok: true, aceitos, seq: db.seq, agora: Date.now(), geracao: config.geracao });
      }

      if (p === '/api/registros') {
        const desde = Number(url.searchParams.get('desde') || 0);
        const base = desde > db.seq ? 0 : desde; // servidor foi zerado: manda tudo
        return json(res, 200, { seq: db.seq, geracao: config.geracao, registros: Object.values(db.registros).filter((r) => r.seq > base) });
      }

      if (p === '/api/status') {
        const agora = Date.now();
        return json(res, 200, {
          seq: db.seq, total: Object.keys(db.registros).length,
          codigo: config.codigo, enderecos: enderecosLocais(), apk: fs.existsSync(APK),
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

      if (p === '/api/relatorios') return json(res, 200, { pasta: 'RelatoriosUsina', dias: listaDeRelatorios() });

      if (p === '/api/erros') return json(res, 200, { erros: ultimosErros(100) });

      // Zerar as anotações de teste: guarda uma cópia em BackupUsina e apaga tudo, menos a configuração da usina
      if (p === '/api/zerar' && req.method === 'POST') {
        const corpo = JSON.parse(await lerCorpo(req, 10000));
        if (corpo.confirmar !== 'ZERAR') return json(res, 400, { erro: 'faltou confirmar' });
        const agora = new Date();
        const carimbo = agora.toISOString().slice(0, 16).replace(/[-:T]/g, '');
        fs.writeFileSync(path.join(PASTAS.backup, `antes-de-zerar-${carimbo}.json`), JSON.stringify(Object.values(db.registros), null, 1));
        let apagados = 0;
        Object.keys(db.registros).forEach((id) => { if (db.registros[id].data !== 'config') { delete db.registros[id]; apagados += 1; } });
        config.geracao = crypto.randomBytes(6).toString('hex'); salvarConfig();
        gravarDisco();
        return json(res, 200, { ok: true, apagados, geracao: config.geracao, copia: `BackupUsina/antes-de-zerar-${carimbo}.json` });
      }

      if (p === '/api/novo-codigo' && req.method === 'POST') {
        config.codigo = novoCodigo(); salvarConfig();
        return json(res, 200, { codigo: config.codigo });
      }
      return json(res, 404, { erro: 'rota desconhecida' });
    }

    if (req.method !== 'GET') { res.writeHead(405); return res.end(); }

    // Página do escritório com os relatórios já prontos, por dia
    if (p === '/relatorios' || p.startsWith('/relatorios/')) return paginaRelatorios(res, p);

    return arquivoEstatico(res, p);
  } catch (e) {
    return json(res, 400, { erro: e.message });
  }
});

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
