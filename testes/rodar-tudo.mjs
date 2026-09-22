/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Bateria completa de testes. Uso (na pasta app):   node testes/rodar-tudo.mjs
 *  1. código sem erro de escrita          4. aparelhos virtuais usando o app, nas duas centrais
 *  2. configuração das folhas             5. leitura de foto, impressão e app sem rede
 *  3. central pela rede, nas duas         6. todas as telas em 7 tamanhos de tela
 * Resultado em testes/saida/resultado.json e testes/saida/resultado.txt
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { abrirNavegador } from './navegador.mjs';
import { novoGrupo, teste, certo, resumo } from './teste.mjs';
import { testarApi } from './api.mjs';
import { testarAparelhos } from './aparelhos.mjs';
import { testarConfiguracao, testarExtras } from './extras.mjs';
import { centralNode, centralJava, APP } from './servidores.mjs';

const SAIDA = path.join(APP, 'testes', 'saida');
fs.mkdirSync(SAIDA, { recursive: true });
const t0 = Date.now();
const grupos = [];

// 1. código
const g1 = novoGrupo('Código sem erro de escrita');
const js = ['server.js', ...fs.readdirSync(path.join(APP, 'public')).filter((n) => n.endsWith('.js')).map((n) => 'public/' + n), ...fs.readdirSync(path.join(APP, 'testes')).filter((n) => n.endsWith('.mjs')).map((n) => 'testes/' + n)];
for (const f of js) await teste(g1, f, async () => { execFileSync(process.execPath, ['--check', path.join(APP, f)], { stdio: 'pipe' }); });
await teste(g1, 'scripts de treino do leitor (Python)', async () => {
  for (const f of fs.readdirSync(path.join(APP, 'treino-leitor')).filter((n) => n.endsWith('.py'))) {
    const r = spawnSync('python', ['-m', 'py_compile', path.join(APP, 'treino-leitor', f)], { encoding: 'utf8' });
    certo(r.status === 0, f + ': ' + r.stderr);
  }
});
grupos.push(g1);

// 2. configuração
const g2 = novoGrupo('Configuração das folhas (forms.js)');
await testarConfiguracao(g2);
grupos.push(g2);

// 3. central pela rede
for (const [nome, ligar, porta] of [['computador (server.js)', centralNode, 8291], ['tablet chefe (ServidorCentral.java)', centralJava, 8292]]) {
  const g = novoGrupo('Central do ' + nome);
  const c = await ligar(porta);
  try { await testarApi(c, g); } finally { await c.desligar(); }
  grupos.push(g);
}

const nav = await abrirNavegador();
try {
  // 4. aparelhos virtuais
  for (const [nome, ligar, porta] of [['computador', centralNode, 8293], ['tablet chefe', centralJava, 8294]]) {
    const g = novoGrupo('Aparelhos virtuais (escritório, tablet e celular) na central do ' + nome);
    const c = await ligar(porta);
    try { await testarAparelhos(nav, c, g); } finally { await c.desligar(); }
    grupos.push(g);
  }
  // 5. extras
  const g5 = novoGrupo('Leitura de foto, impressão e aplicativo sem rede');
  const c5 = await centralNode(8295);
  try { await testarExtras(nav, c5, g5); } finally { await c5.desligar(); }
  grupos.push(g5);
} finally { await nav.fechar(); }

// 6. telas (roda separado, com a própria central)
const g6 = novoGrupo('Todas as telas em 7 tamanhos (celular, celular deitado, tablet pequeno, tablet e tablet em pé)');
const c6 = await centralNode(8296);
try {
  spawnSync(process.execPath, [path.join(APP, 'testes', 'telas.mjs'), c6.url, 'celular,celularGrande,celularDeitado,tablet8,tablet8Deitado,tablet,tabletEmPe'], { stdio: 'inherit' });
} finally { await c6.desligar(); }
const telas = JSON.parse(fs.readFileSync(path.join(SAIDA, 'telas.json'), 'utf8')).telas;
const porTamanho = {};
telas.forEach((t) => { (porTamanho[t.tamanho] = porTamanho[t.tamanho] || []).push(t); });
for (const [tam, lista] of Object.entries(porTamanho)) {
  await teste(g6, `${tam}: ${lista.length} telas sem texto cortado, sem rolagem para o lado e sem erro`, async () => {
    const ruins = lista.filter((t) => t.falhou || t.erros.length || t.problemas.some((p) => p.tipo !== 'botao-pequeno'));
    certo(!ruins.length, ruins.map((t) => `${t.tela}: ${t.falhou || t.erros[0] || t.problemas.filter((p) => p.tipo !== 'botao-pequeno').map((p) => p.tipo + ' ' + p.texto).slice(0, 2).join('; ')}`).join(' | ').slice(0, 600));
    const pequenos = lista.reduce((s, t) => s + t.problemas.filter((p) => p.tipo === 'botao-pequeno').length, 0);
    return pequenos ? `${pequenos} botões abaixo de 34 px (aceitável só no celular deitado)` : '';
  });
}
grupos.push(g6);

const r = resumo(grupos);
const minutos = Math.round((Date.now() - t0) / 60000);
const linhas = [`Bateria de testes das Pranchetas Digitais, ${new Date().toLocaleString('pt-BR')} (${minutos} min)`, `${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`, ''];
for (const g of grupos) {
  const ok = g.resultados.filter((x) => x.ok).length;
  linhas.push(`${g.titulo}: ${ok} de ${g.resultados.length}`);
  g.resultados.forEach((x) => linhas.push(`   ${x.ok ? 'ok     ' : 'FALHOU '} ${x.nome}${x.ok ? (x.obs ? '  (' + x.obs + ')' : '') : ': ' + x.erro}`));
}
fs.writeFileSync(path.join(SAIDA, 'resultado.txt'), linhas.join('\n'));
fs.writeFileSync(path.join(SAIDA, 'resultado.json'), JSON.stringify({ quando: new Date().toISOString(), minutos, resumo: r, grupos }, null, 1));
console.log('\n' + linhas.slice(0, 2).join('\n'));
process.exitCode = r.falharam ? 1 : 0;
