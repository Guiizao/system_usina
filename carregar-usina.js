/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/**
 * Monta a configuração da usina (window.USINA) do jeito que o aplicativo monta: o config/forms.js e as folhas de cada
 * setor (setores/<setor>/pranchetas.js). A lista e a ordem vêm do index.html (os <script> com data-usina), então
 * setor novo é só criar a pasta e pôr a linha no index.html. Usado pela central do computador e pelos testes.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function arquivosDaUsina(pastaPublica) {
  const html = fs.readFileSync(path.join(pastaPublica, 'index.html'), 'utf8');
  return [...html.matchAll(/<script src="([^"]+)" data-usina><\/script>/g)].map((m) => m[1]);
}

function carregarUsina(pastaPublica, contexto = { window: {} }) {
  vm.createContext(contexto);
  for (const arq of arquivosDaUsina(pastaPublica)) vm.runInContext(fs.readFileSync(path.join(pastaPublica, arq), 'utf8'), contexto, { filename: arq });
  return contexto.window.USINA;
}

module.exports = { carregarUsina, arquivosDaUsina };
