/* Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt). */
/* Usado pelo gerar-apk.ps1 (versão 2.7).
     node versao-do-apk.js gradle  -> põe a versão do app.js no build.gradle (versionCode e versionName)
     node versao-do-apk.js json    -> escreve saida/versao.json do lado do pranchetas.apk
   O versao.json diz a versão, o tamanho, o SHA-256 e as novidades. A central entrega para os tablets,
   e é ele que vai para a nuvem junto com o APK. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const PUBLICO = path.join(__dirname, '..', 'public');
// 2.16: o aplicativo foi dividido em pastas; a versão fica em public/nucleo/base.js
const achou = /const VERSAO = '(\d+)\.(\d+)\.(\d+)'/.exec(fs.readFileSync(path.join(PUBLICO, 'nucleo', 'base.js'), 'utf8'));
if (!achou) throw new Error('não achei o VERSAO no nucleo/base.js');
// (os testes montam pacotes de outra versão com PRANCHETAS_VERSAO)
const versao = process.env.PRANCHETAS_VERSAO || `${achou[1]}.${achou[2]}.${achou[3]}`;
// 2.7.0 vira 20700: o Android só atualiza por cima se o número for maior que o do instalado
const codigo = Number(achou[1]) * 10000 + Number(achou[2]) * 100 + Number(achou[3]);

if (process.argv[2] === 'gradle') {
  const arquivo = path.join(__dirname, 'android', 'app', 'build.gradle');
  const texto = fs.readFileSync(arquivo, 'utf8')
    .replace(/versionCode \d+/, `versionCode ${codigo}`)
    .replace(/versionName "[^"]*"/, `versionName "${versao}"`);
  fs.writeFileSync(arquivo, texto);
  console.log(`Versão do APK: ${versao} (número ${codigo})`);
} else if (process.argv[2] === 'json') {
  const apk = fs.readFileSync(path.join(__dirname, 'saida', 'pranchetas.apk'));
  const contexto = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(PUBLICO, 'config', 'novidades.js'), 'utf8'), contexto);
  const novidades = contexto.window.NOVIDADES || [];
  if (!novidades.length || novidades[0].versao !== versao) throw new Error(`faltam as novidades da versão ${versao} em public/config/novidades.js`);
  const info = { versao, codigo, tamanho: apk.length, sha256: crypto.createHash('sha256').update(apk).digest('hex'), novidades };
  fs.writeFileSync(path.join(__dirname, 'saida', 'versao.json'), JSON.stringify(info, null, 2));
  console.log(`saida\\versao.json: versão ${versao}, ${(apk.length / 1048576).toFixed(1)} MB`);
} else if (process.argv[2] === 'chave') {
  const { publica } = chaveDasTelas();
  console.log(`Chave das telas: ${publica.slice(0, 16)}... (a privada fica em ${arquivoDaChave()})`);
} else if (process.argv[2] === 'telas') {
  pacoteDasTelas();
} else {
  console.log('uso: node versao-do-apk.js gradle | json | chave | telas');
}

/* ---------- Atualização rápida (versão 2.8): as telas sem instalar APK ----------
   Quase todo o aplicativo é HTML, CSS e JavaScript (a pasta public). O pacote das telas é essa pasta,
   com a lista dos arquivos (pacote.json: versão, tamanho e SHA-256 de cada um) assinada com uma chave
   que fica só neste computador. O aplicativo confere a assinatura com a chave pública que vai dentro
   do APK (public/chave-telas.txt): ninguém consegue mandar telas falsas pelo Wi-Fi.
   apkMinimo: a versão em que a parte em Java mudou pela última vez. Tablet com APK mais velho que isso
   recebe o APK novo, não o pacote. */
function arquivoDaChave() {
  return process.env.PRANCHETAS_CHAVE_TELAS || path.join(require('os').homedir(), '.pranchetas', 'chave-telas.pem');
}
function chaveDasTelas() {
  const arquivo = arquivoDaChave();
  let privada;
  if (fs.existsSync(arquivo)) privada = crypto.createPrivateKey(fs.readFileSync(arquivo, 'utf8'));
  else {
    // primeira vez neste computador: cria o par de chaves (guarde uma cópia dessa pasta, como a do .android)
    privada = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    fs.writeFileSync(arquivo, privada.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 });
  }
  const publica = crypto.createPublicKey(privada).export({ format: 'der', type: 'spki' }).toString('base64');
  // (os testes passam outra pasta, para não mexer na chave de verdade)
  const arqPublica = process.env.PRANCHETAS_CHAVE_PUBLICA || path.join(PUBLICO, 'chave-telas.txt');
  if (!fs.existsSync(arqPublica) || fs.readFileSync(arqPublica, 'utf8').trim() !== publica) fs.writeFileSync(arqPublica, publica + '\n');
  return { privada, publica };
}
/** Em que versão a parte em Java (e as permissões do APK) mudou pela última vez. */
function versaoDoNativo() {
  const arquivos = [];
  const juntar = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? juntar(path.join(d, e.name)) : arquivos.push(path.join(d, e.name))));
  juntar(path.join(__dirname, 'nativo'));
  arquivos.push(path.join(__dirname, 'gerar-apk.ps1'), path.join(__dirname, 'package.json'), path.join(__dirname, 'capacitor.config.json'));
  const h = crypto.createHash('sha256');
  arquivos.sort().forEach((a) => { h.update(path.relative(__dirname, a).replace(/\\/g, '/')); h.update(fs.readFileSync(a).toString('utf8').replace(/\r\n/g, '\n')); });
  const hash = h.digest('hex');
  const registro = path.join(__dirname, 'nativo-versao.json');
  let r = {};
  try { r = JSON.parse(fs.readFileSync(registro, 'utf8')); } catch (e) { /* primeira vez */ }
  if (r.hash !== hash) { r = { hash, versao }; fs.writeFileSync(registro, JSON.stringify(r, null, 2) + '\n'); console.log(`A parte em Java mudou: tablets abaixo da ${versao} recebem o APK`); }
  return r.versao;
}
/** Monta o pacote das telas a partir da pasta que vai dentro do APK. Grava em saida/telas e também dentro do APK. */
function pacoteDasTelas() {
  const origem = process.argv[3] || path.join(__dirname, 'android', 'app', 'src', 'main', 'assets', 'public');
  const destino = process.argv[4] || path.join(__dirname, 'saida', 'telas');
  const { privada, publica } = chaveDasTelas();
  fs.writeFileSync(path.join(origem, 'chave-telas.txt'), publica + '\n');
  const arquivos = {};
  const juntar = (d, rel) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) return juntar(path.join(d, e.name), r);
    if (r === 'pacote.json' || r === 'pacote.sig') return;
    const dados = fs.readFileSync(path.join(d, e.name));
    arquivos[r] = { sha256: crypto.createHash('sha256').update(dados).digest('hex'), tamanho: dados.length };
  });
  juntar(origem, '');
  const contexto = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(PUBLICO, 'config', 'novidades.js'), 'utf8'), contexto);
  const pacote = Buffer.from(JSON.stringify({ versao, apkMinimo: process.env.APK_MINIMO || versaoDoNativo(), criadoEm: new Date().toISOString(), novidades: contexto.window.NOVIDADES || [], arquivos }, null, 1));
  const assinatura = crypto.sign('sha256', pacote, privada).toString('base64'); // ECDSA P-256, formato DER (o Java confere do mesmo jeito)
  fs.writeFileSync(path.join(origem, 'pacote.json'), pacote);
  fs.writeFileSync(path.join(origem, 'pacote.sig'), assinatura);
  fs.rmSync(destino, { recursive: true, force: true });
  fs.cpSync(origem, destino, { recursive: true });
  const total = Object.values(arquivos).reduce((s, a) => s + a.tamanho, 0);
  console.log(`Pacote das telas ${versao}: ${Object.keys(arquivos).length} arquivos, ${(total / 1048576).toFixed(1)} MB`);
}
