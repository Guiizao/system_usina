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
const achou = /const VERSAO = '(\d+)\.(\d+)\.(\d+)'/.exec(fs.readFileSync(path.join(PUBLICO, 'app.js'), 'utf8'));
if (!achou) throw new Error('não achei o VERSAO no app.js');
const versao = `${achou[1]}.${achou[2]}.${achou[3]}`;
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
  vm.runInNewContext(fs.readFileSync(path.join(PUBLICO, 'novidades.js'), 'utf8'), contexto);
  const novidades = contexto.window.NOVIDADES || [];
  if (!novidades.length || novidades[0].versao !== versao) throw new Error(`faltam as novidades da versão ${versao} em public/novidades.js`);
  const info = { versao, codigo, tamanho: apk.length, sha256: crypto.createHash('sha256').update(apk).digest('hex'), novidades };
  fs.writeFileSync(path.join(__dirname, 'saida', 'versao.json'), JSON.stringify(info, null, 2));
  console.log(`saida\\versao.json: versão ${versao}, ${(apk.length / 1048576).toFixed(1)} MB`);
} else {
  console.log('uso: node versao-do-apk.js gradle | json');
}
