/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Bateria completa de testes. Uso (na pasta app):   node testes/rodar-tudo.mjs
 *  1. código sem erro de escrita          4. aparelhos virtuais usando o app, nas duas centrais
 *  2. configuração das folhas             5. leitura de foto, impressão e app sem rede
 *  3. central pela rede, nas duas         6. todas as telas em 9 tamanhos de tela
 *  4b. fluxo da dorna (enchendo, enviando, anotada), nas duas centrais
 *  3b e 4c. longo prazo (90 dias), troca de turno, virada das 07:00, central nova e sem Wi-Fi, nas duas
 *  4d. velocidade de cada toque num tablet 4 vezes mais lento
 *  4e. pedidos do teste de 24/09 (aviso curto, senha do operador no tablet chefe, relatórios, WhatsApp...), nas duas
 *  4f. o aplicativo com o código embaralhado, como vai no APK
 * Resultado em testes/saida/resultado.json e testes/saida/resultado.txt
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { abrirNavegador } from './navegador.mjs';
import { novoGrupo, teste, certo, resumo } from './teste.mjs';
import { testarApi } from './api.mjs';
import { testarAparelhos } from './aparelhos.mjs';
import { testarDornas } from './dornas.mjs';
import { testarConfiguracao, testarExtras } from './extras.mjs';
import { testarRobustezCentral, testarRobustezAparelhos } from './robustez.mjs';
import { medirDesempenho } from './desempenho.mjs';
import { testarPedidos24 } from './pedidos24.mjs';
import { testarCifra } from './cifra.mjs';
import { testarBase44Central, testarPedidos25, testarFuncaoBase44 } from './pedidos25.mjs';
import { testarPedidos26 } from './pedidos26.mjs';
import { testarApkWeb } from './rodar-apk-web.mjs';
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
// 3c. criptografia do Wi-Fi (a escrita em JavaScript igual à do Node) e envio dos totais para o Base44
const gc = novoGrupo('Criptografia do Wi-Fi: a escrita em JavaScript igual à do Node');
await testarCifra(gc);
grupos.push(gc);
const gf = novoGrupo('Função que vai no Base44 do escritório (com o Base44 simulado)');
await testarFuncaoBase44(gf);
grupos.push(gf);
for (const [nome, ligar, porta] of [['computador', centralNode, 8265], ['tablet chefe', centralJava, 8266]]) {
  const g = novoGrupo('Totais no Base44, direto na central do ' + nome);
  const c = await ligar(porta);
  try { await testarBase44Central(c, porta + 10, g); } finally { await c.desligar(); }
  grupos.push(g);
}
// 3b. longo prazo direto na central: dias guardados, dias antigos no BackupUsina, central nova, 90 dias de uso
for (const [nome, ligar, porta] of [['computador', centralNode, 8271], ['tablet chefe', centralJava, 8272]]) {
  const g = novoGrupo('Longo prazo e central nova, direto na central do ' + nome);
  await testarRobustezCentral(ligar, porta, g);
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
  // 4b. o dia da Hidrólise: enchendo, enviando, anotada; Sacarificação e insumos acompanhando
  for (const [nome, ligar, porta] of [['computador', centralNode, 8297], ['tablet chefe', centralJava, 8298]]) {
    const g = novoGrupo('Fluxo da dorna (Hidrólise, Sacarificação e insumos) na central do ' + nome);
    const c = await ligar(porta);
    try { await testarDornas(nav, c, g); } finally { await c.desligar(); }
    grupos.push(g);
  }
  // 4e. pedidos do teste de 24/09
  for (const [nome, ligar, porta] of [['computador', centralNode, 8279], ['tablet chefe', centralJava, 8280]]) {
    const g = novoGrupo('Pedidos do teste de 24/09 na central do ' + nome);
    await testarPedidos24(nav, ligar, porta, g);
    grupos.push(g);
  }
  // 4g. versão 2.5: totais no Base44 sozinhos e pelas configurações; Wi-Fi embaralhado no navegador sem WebCrypto
  for (const [nome, ligar, porta] of [['computador', centralNode, 8267], ['tablet chefe', centralJava, 8268]]) {
    const g = novoGrupo('Versão 2.5 (Base44 e Wi-Fi embaralhado) na central do ' + nome);
    await testarPedidos25(nav, ligar, porta, g, { correcao: nome === 'computador' });
    grupos.push(g);
  }
  // 4h. versão 2.6: volume de vinho (folga -> litros) e dornas de fermentação com a volante
  for (const [nome, ligar, porta] of [['computador', centralNode, 8263], ['tablet chefe', centralJava, 8264]]) {
    const g = novoGrupo('Volume de vinho e dornas de fermentação na central do ' + nome);
    await testarPedidos26(nav, ligar, porta, g);
    grupos.push(g);
  }
  // 4f. o aplicativo embaralhado (como vai no APK) continua funcionando igual
  await testarApkWeb(nav, grupos);
  // 4c. 90 dias de uso, troca de turno e virada das 07:00 no meio da anotação, central nova, sem Wi-Fi
  for (const [nome, ligar, porta] of [['computador', centralNode, 8273], ['tablet chefe', centralJava, 8274]]) {
    const g = novoGrupo('Longo prazo, turnos e central nova com aparelhos, na central do ' + nome);
    await testarRobustezAparelhos(nav, ligar, porta, g);
    grupos.push(g);
  }
  // 4d. velocidade: num tablet 4 vezes mais lento e com 90 dias de uso, cada toque responde em menos de 100 ms
  const gv = novoGrupo('Velocidade num tablet mais lento (4 vezes), com 90 dias de uso');
  let tempos = {};
  await teste(gv, 'medir os toques no tablet do setor e no tablet chefe', async () => {
    tempos = await medirDesempenho(centralNode, 8275, nav);
    fs.writeFileSync(path.join(SAIDA, 'desempenho.json'), JSON.stringify({ quando: new Date().toISOString(), lentidao: 4, r: tempos }, null, 1));
  });
  for (const [nome, ms] of Object.entries(tempos)) {
    if (/memória|travadas/.test(nome)) continue;
    const limite = /abrir o aplicativo/.test(nome) ? 2500 : 100;
    await teste(gv, `${nome.replace(' (ms)', '')}: ${ms} ms`, async () => certo(ms != null && ms >= 0 && ms < limite, `passou de ${limite} ms`));
  }
  await teste(gv, 'tablet chefe parado sincronizando: nenhuma travada de mais de 200 ms', async () => {
    const longas = JSON.parse(tempos['chefe: travadas de mais de 50 ms em 20 s parado'] || '[]');
    certo(longas.every((ms) => ms < 200), 'travadas: ' + longas.join(', '));
    return longas.length ? `${longas.length} de ${Math.max(...longas)} ms` : 'nenhuma acima de 50 ms';
  });
  grupos.push(gv);
  // 5. extras
  const g5 = novoGrupo('Leitura de foto, impressão e aplicativo sem rede');
  const c5 = await centralNode(8295);
  try { await testarExtras(nav, c5, g5); } finally { await c5.desligar(); }
  grupos.push(g5);
} finally { await nav.fechar(); }

// 6. telas (roda separado, com a própria central)
const g6 = novoGrupo('Todas as telas em 9 tamanhos (celulares, celular deitado, tablets pequenos, tablets e tablet em pé)');
const c6 = await centralNode(8296);
try {
  spawnSync(process.execPath, [path.join(APP, 'testes', 'telas.mjs'), c6.url, 'celular,motorola,celularGrande,celularDeitado,tablet8,tablet8Deitado,tablet10,tablet,tabletEmPe'], { stdio: 'inherit' });
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
