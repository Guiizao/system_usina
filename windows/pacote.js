/* Pranchetas Digitais - © 2026 Guilherme. */
const fs = require('node:fs');
const path = require('node:path');

function lerVersao(publico) {
  const versoes = new Set();
  function visitar(pasta) {
    for (const item of fs.readdirSync(pasta, { withFileTypes: true })) {
      const arquivo = path.join(pasta, item.name);
      if (item.isDirectory()) visitar(arquivo);
      else if (item.name.endsWith('.js')) {
        for (const m of fs.readFileSync(arquivo, 'utf8').matchAll(/\bconst\s+VERSAO\s*=\s*['"](\d+\.\d+\.\d+)['"]/g)) versoes.add(m[1]);
      }
    }
  }
  visitar(publico);
  if (versoes.size !== 1) throw new Error('Esperava uma única const VERSAO em public/, encontrei: ' + [...versoes].join(', '));
  return [...versoes][0];
}

function versaoDo(arquivo) {
  if (!fs.existsSync(arquivo)) return '0.0.0';
  const { versao } = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(versao)) throw new Error('Versão inválida em ' + arquivo);
  return versao;
}

function maisNova(nova, atual) {
  const a = nova.split('.').map(Number), b = atual.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

function semearApk(origem, destino) {
  fs.mkdirSync(destino, { recursive: true });
  const meta = path.join(origem, 'versao.json');
  const apk = path.join(origem, 'pranchetas.apk');
  if (fs.existsSync(meta) && fs.existsSync(apk) &&
      (!fs.existsSync(path.join(destino, 'pranchetas.apk')) || maisNova(versaoDo(meta), versaoDo(path.join(destino, 'versao.json'))))) {
    fs.copyFileSync(apk, path.join(destino, 'pranchetas.apk.novo'));
    fs.renameSync(path.join(destino, 'pranchetas.apk.novo'), path.join(destino, 'pranchetas.apk'));
    fs.copyFileSync(meta, path.join(destino, 'versao.json'));
  }
  // As telas podem ter recebido uma atualização posterior ao APK: compare separadamente.
  const telas = path.join(origem, 'telas');
  const atuais = path.join(destino, 'telas');
  if (fs.existsSync(path.join(telas, 'pacote.json')) &&
      maisNova(versaoDo(path.join(telas, 'pacote.json')), versaoDo(path.join(atuais, 'pacote.json')))) {
    fs.cpSync(telas, atuais, { recursive: true });
  }
}

module.exports = { lerVersao, semearApk };
