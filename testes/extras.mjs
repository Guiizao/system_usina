/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Testes que não cabem nos outros: configuração das folhas, leitura de foto, impressão e aplicativo sem rede. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { TAMANHOS, dormir } from './navegador.mjs';
import { teste, certo, igual } from './teste.mjs';
import { APP } from './servidores.mjs';

const SAIDA = path.join(APP, 'testes', 'saida');

export async function testarConfiguracao(grupo) {
  const contexto = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(APP, 'public', 'forms.js'), 'utf8'), contexto);
  const C = contexto.window.USINA;
  const modelos = fs.readFileSync(path.join(APP, 'public', 'modelos.js'), 'utf8');
  await teste(grupo, 'forms.js: todo setor aponta para pranchetas que existem', async () => {
    for (const s of C.setores) for (const pid of s.pranchetas) certo(C.pranchetas[pid], `${s.nome}: prancheta ${pid} não existe`);
  });
  await teste(grupo, 'forms.js: todo campo tem tipo conhecido e id sem repetir', async () => {
    const tipos = ['num', 'time', 'choice', 'check', 'text'];
    for (const [pid, p] of Object.entries(C.pranchetas)) {
      const campos = [].concat(p.campos || [], p.itens || [], p.camposOperador || [], p.camposEscritorio || []);
      const ids = new Set();
      for (const c of p.campos || []) { certo(tipos.includes(c.type), `${pid}.${c.id}: tipo ${c.type}`); certo(!ids.has(c.id), `${pid}: campo repetido ${c.id}`); ids.add(c.id); }
      for (const c of campos) certo(c.id && c.label, `${pid}: campo sem id ou nome`);
    }
  });
  await teste(grupo, 'forms.js: avisos de pH e Brix com as regras combinadas', async () => {
    const a1 = C.pranchetas.hid_anexo1.campos;
    const ph = a1.find((c) => c.id === 'phf').avisos; const brix = a1.find((c) => c.id === 'brix').avisos;
    certo(ph.some((x) => x.quando === '<' && x.valor === 5 && x.nivel === 'alerta'), 'pH < 5');
    certo(ph.some((x) => x.quando === '>=' && x.valor === 7), 'pH >= 7');
    certo(brix.some((x) => x.quando === '>' && x.valor === 25), 'Brix > 25');
  });
  await teste(grupo, 'forms.js: telas juntas e sugestões apontam para folhas que existem', async () => {
    for (const [pid, p] of Object.entries(C.pranchetas)) {
      if (p.tipo === 'juntas') for (const pt of p.partes) { certo(C.pranchetas[pt.prancheta], `${pid}: ${pt.prancheta}`); certo(C.pranchetas[pt.sugestao.prancheta], `${pid}: sugestão ${pt.sugestao.prancheta}`); }
      if (p.vemDe) certo(C.pranchetas[p.vemDe.prancheta], `${pid}: vemDe`);
    }
  });
  await teste(grupo, 'forms.js: cada folha com modelo de papel tem o modelo pronto', async () => {
    for (const [pid, p] of Object.entries(C.pranchetas)) if (p.papel) certo(modelos.includes(p.papel.modelo), `${pid}: modelo ${p.papel.modelo} não existe em modelos.js`);
  });
  await teste(grupo, 'forms.js: todo setor tem operadores e a senha do encarregado ainda é a de teste', async () => {
    for (const s of C.setores) certo(s.operadores && s.operadores.length, `${s.nome} sem operadores`);
    return C.pinAdmin === '1234' ? 'lembrete: trocar a senha 1234 antes de usar de verdade' : 'senha trocada';
  });
}

export async function testarExtras(nav, central, grupo) {
  await teste(grupo, 'código de conexão com zero na frente (014204) é digitado inteiro', async () => {
    const a = await nav.novoAparelho('código', TAMANHOS.celular);
    try {
      await a.ir(central.url + '/', 'document.querySelector("[data-quadro=\\"codigo\\"]")');
      await a.tocar('[data-quadro="codigo"]');
      await a.teclar(['0', '1', '4', '2', '0', '4', '9']);
      const txt = await a.avaliar('document.querySelector("[data-quadro=\\"codigo\\"] .val").textContent.trim()');
      igual(txt, '014204', 'código no quadro');
    } finally { await a.fechar(); }
  });
  await teste(grupo, 'leitura de uma folha de papel fotografada, sem internet', async () => {
    const foto = 'C:/Users/guilh/Downloads/Phone Link/Hidrolise 1.jpg';
    if (!fs.existsSync(foto)) return 'foto de teste não encontrada, pulei';
    const temp = path.join(APP, 'public', '_teste_folha.jpg');
    fs.copyFileSync(foto, temp);
    const a = await nav.novoAparelho('leitura', TAMANHOS.tablet);
    try {
      const t0 = Date.now();
      await a.ir(central.url + '/?demo&papel=central&lerfoto=_teste_folha.jpg&pid=hid_anexo1', 'document.readyState === "complete"');
      await a.esperar('document.querySelector(".tabela-leitura") || /Não deu para ler/.test(document.body.innerText)', 120000, 'terminar a leitura');
      const txt = await a.texto();
      certo(!/Não deu para ler/.test(txt), 'não achou a tabela na foto');
      const linhas = Number((txt.match(/Salvar (\d+) linha/) || [])[1] || 0);
      const amarelos = Number((txt.match(/(\d+) valor(?:es)? em amarelo/) || [])[1] || 0);
      certo(linhas >= 10, 'leu poucas linhas: ' + linhas);
      await a.foto(path.join(SAIDA, 'extras', 'leitura.png'));
      certo(!a.erros.length, a.erros.join(' | '));
      return `${linhas} linhas lidas, ${amarelos} valores para conferir, ${Math.round((Date.now() - t0) / 1000)} s`;
    } finally { await a.fechar(); fs.rmSync(temp, { force: true }); }
  });
  await teste(grupo, 'impressão: cada folha numa página, deitada ou em pé como o papel', async () => {
    const a = await nav.novoAparelho('impressão', TAMANHOS.computador);
    try {
      await a.ir(central.url + '/?demo&papel=central&folhas=todas', 'document.querySelector(".folha-imp")');
      const n = await a.avaliar('document.querySelectorAll(".folha-imp").length');
      const deitadas = await a.avaliar('document.querySelectorAll(".folha-imp.paisagem").length');
      const r = await nav.cdp('Page.printToPDF', { printBackground: true, preferCSSPageSize: true }, a.sessionId);
      const pdf = path.join(SAIDA, 'extras', 'folhas.pdf');
      fs.mkdirSync(path.dirname(pdf), { recursive: true });
      fs.writeFileSync(pdf, Buffer.from(r.data, 'base64'));
      const info = JSON.parse(execFileSync('python', ['-X', 'utf8', '-c', `import pymupdf,json,sys
d=pymupdf.open(sys.argv[1]); print(json.dumps({'paginas': d.page_count, 'deitadas': sum(1 for p in d if p.rect.width > p.rect.height)}))`, pdf], { encoding: 'utf8' }));
      igual(info.paginas, n, 'páginas'); igual(info.deitadas, deitadas, 'páginas deitadas');
      return `${n} folhas, ${deitadas} deitadas`;
    } finally { await a.fechar(); }
  });
  await teste(grupo, 'sem rede, o aplicativo abre do mesmo jeito (fica guardado no aparelho)', async () => {
    const a = await nav.novoAparelho('sem rede', TAMANHOS.tablet);
    try {
      await a.ir(central.url + '/', 'document.querySelector("#app main, #app header")');
      await a.esperar('navigator.serviceWorker && navigator.serviceWorker.ready.then(() => true)', 15000, 'service worker');
      await a.recarregar();
      await a.esperar('!!navigator.serviceWorker.controller', 10000, 'página controlada pelo service worker');
      await dormir(1500);
      await a.semRede(true);
      await a.recarregar();
      await a.esperar('document.querySelector("#app main, #app header")', 10000, 'abrir sem rede');
      await a.semRede(false);
    } finally { await a.fechar(); }
  });
}
