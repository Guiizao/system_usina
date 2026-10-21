/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/**
 * No código, o aplicativo fica dividido em pastas (nucleo, telas, chefe, setores, design). No APK ele volta a ser um
 * app.js só, como antes da 2.16: as partes (os <script> com data-app no index.html), na mesma ordem, dentro de uma
 * função. Assim o terser embaralha todos os nomes e o pacote das telas continua com um arquivo só.
 *   node juntar-app.js <pasta>   (a pasta é a cópia do public: apk/www, ou a dos testes)
 */
const fs = require('fs');
const path = require('path');

const pasta = path.resolve(process.argv[2] || path.join(__dirname, 'www'));
const arqIndex = path.join(pasta, 'index.html');
let html = fs.readFileSync(arqIndex, 'utf8');
const tags = [...html.matchAll(/^[ \t]*<script src="([^"]+)" data-app><\/script>\r?\n/gm)];
if (!tags.length) throw new Error('nenhum <script data-app> no index.html');
const partes = tags.map((m) => `// ---- ${m[1]} ----\n` + fs.readFileSync(path.join(pasta, m[1]), 'utf8'));
fs.writeFileSync(path.join(pasta, 'app.js'), `/* Pranchetas Ubirálcool - © 2026 Guilherme. Todos os direitos reservados. */\n(function () {\n'use strict';\n${partes.join('\n')}\n})();\n`);
// troca as linhas das partes por uma só, no lugar da primeira
html = html.replace(tags[0][0], '  <script src="app.js"></script>\n');
for (const m of tags.slice(1)) html = html.replace(m[0], '');
fs.writeFileSync(arqIndex, html);
// as partes saem da pasta (e as pastas que ficaram vazias)
for (const m of tags) fs.rmSync(path.join(pasta, m[1]));
const pastasVazias = (d) => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) { pastasVazias(p); if (!fs.readdirSync(p).length) fs.rmdirSync(p); } } };
pastasVazias(pasta);
console.log(`app.js: ${tags.length} partes juntas`);
