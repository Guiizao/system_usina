/* 3.1: chave do Painel novo, aberturas e sons. */
import { abrirNavegador, TAMANHOS, dormir } from './navegador.mjs';
import { centralNode, pastaTemporaria } from './servidores.mjs';
import { novoGrupo, teste, certo, igual, resumo } from './teste.mjs';

const g = novoGrupo('Painel novo (3.1)');
let nav, c;
const ERROS = `window.__erros = []; window.addEventListener('error', (e) => window.__erros.push(e.message));`;
try {
  nav = await abrirNavegador(); c = await centralNode(8580, pastaTemporaria('painel31'));
  const url = 'http://127.0.0.1:8580/?demo&papel=';
  const abrir = async (nome, t, papel, ligar) => {
    const a = await nav.novoAparelho(nome, t);
    await a.ir(url + papel, 'document.querySelector("#app main")');
    if (ligar) {
      await a.avaliar(`(() => { ${ERROS} cfg.painelNovo = true; aplicarPainelNovo(); sessionStorage.removeItem('abertura'); mostrarAbertura(); return 1; })()`);
    }
    return a;
  };

  await teste(g, 'desligado no início: sem abertura, sem marca e sem carregar as animações', async () => {
    const a = await abrir('p1', TAMANHOS.celular, 'central', false);
    igual(await a.avaliar(`[!!document.querySelector('#abertura-nova'), document.documentElement.hasAttribute('data-painel-novo'), !!window.Aberturas]`), [false, false, false]);
    await a.fechar();
  });
  await teste(g, 'ligado no celular: a abertura desenha, termina em até 2,6 s e sai sozinha', async () => {
    const a = await abrir('p2', TAMANHOS.celular, 'central', true);
    certo(await a.avaliar(`document.documentElement.hasAttribute('data-painel-novo')`), 'marca');
    await dormir(700);
    certo(await a.avaliar(`!!window.Aberturas && !!document.querySelector('#abertura-nova canvas')`), 'canvas');
    const claro = await a.avaliar(`(() => { const c = document.querySelector('#abertura-nova canvas'); const d = c.getContext('2d').getImageData(c.width / 2 - 60, c.height / 2 - 60, 120, 120).data; let m = 0; for (let i = 0; i < d.length; i += 4) m = Math.max(m, d[i + 1]); return m; })()`);
    certo(claro > 60, 'desenhou algo: ' + claro);
    await dormir(1900);
    igual(await a.avaliar(`!!document.querySelector('#abertura-nova')`), false);
    await a.fechar();
  });
  await teste(g, 'um toque pula a abertura', async () => {
    const a = await abrir('p3', TAMANHOS.computador, 'central', true);
    await dormir(300);
    await a.avaliar(`document.querySelector('#abertura-nova').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); 1`);
    await dormir(80);
    igual(await a.avaliar(`!!document.querySelector('#abertura-nova')`), false);
    await a.fechar();
  });
  await teste(g, 'PC: painel novo sempre, sem chave; tablet não mostra chave', async () => {
    const pc = await abrir('p9', TAMANHOS.computador, 'central', false);
    igual(await pc.avaliar(`[document.documentElement.hasAttribute('data-painel-novo'), /Painel novo/.test(blocoPainelNovo()), /Sons do painel/.test(blocoPainelNovo())]`), [true, false, true]);
    await pc.fechar();
    const t = await abrir('p10', TAMANHOS.tablet, 'central', false);
    igual(await t.avaliar('blocoPainelNovo()'), '');
    await t.fechar();
  });
  await teste(g, 'trocar o aparelho para setor tira o painel novo na hora', async () => {
    const a = await abrir('p8', TAMANHOS.computador, 'central', true);
    certo(await a.avaliar(`document.documentElement.hasAttribute('data-painel-novo')`), 'ligado no chefe');
    await a.avaliar(`document.querySelector('#app main').insertAdjacentHTML('afterbegin', '<button id="t" data-a="papel" data-id="caldeira">x</button>'); 1`);
    await dormir(2800);
    await a.tocar('#t');
    igual(await a.avaliar(`document.documentElement.hasAttribute('data-painel-novo')`), false);
    await a.fechar();
  });
  await teste(g, 'tablet chefe e tablet de setor não têm abertura', async () => {
    for (const [papel, n] of [['central', 'p4'], ['caldeira', 'p5']]) {
      const a = await abrir(n, TAMANHOS.tablet, papel, true);
      await dormir(400);
      igual(await a.avaliar(`!!document.querySelector('#abertura-nova')`), false, papel);
      igual(await a.avaliar(`document.documentElement.hasAttribute('data-painel-novo')`), false, papel);
      await a.fechar();
    }
  });
  await teste(g, 'chave em Ajustes liga, desliga e guarda; o som tem chave própria', async () => {
    const a = await abrir('p6', TAMANHOS.celular, 'central', false);
    await a.avaliar(`(() => { document.querySelector('#app main').insertAdjacentHTML('afterbegin', '<div id="t">' + blocoPainelNovo() + '</div>'); return 1; })()`);
    await a.tocar('#t [data-a="painel-novo"][data-valor="1"]');
    igual(await a.avaliar('cfg.painelNovo'), true);
    await a.avaliar(`document.querySelector('#app main').insertAdjacentHTML('afterbegin', '<div id="t">' + blocoPainelNovo() + '</div>'); 1`);
    await a.tocar('#t [data-a="som-painel"][data-valor="0"]');
    igual(await a.avaliar('cfg.somDesligado'), true);
    await a.avaliar(`document.querySelector('#app main').insertAdjacentHTML('afterbegin', '<div id="t">' + blocoPainelNovo() + '</div>'); 1`);
    await a.tocar('#t [data-a="painel-novo"][data-valor="0"]');
    igual(await a.avaliar('[cfg.painelNovo, document.documentElement.hasAttribute("data-painel-novo")]'), [false, false]);
    await a.fechar();
  });
  await teste(g, 'as 10 aberturas desenham sem erro', async () => {
    const a = await abrir('p7', TAMANHOS.celular, 'central', true);
    await dormir(2800);
    const r = await a.avaliar(`(async () => {
      const c = document.createElement('canvas'); c.style.cssText = 'width:300px;height:300px;position:fixed;left:0;top:0'; document.body.appendChild(c);
      const res = [];
      for (let i = 0; i < Aberturas.total; i++) { const t0 = performance.now(); await new Promise((ok) => Aberturas.tocar(i, c, false, ok)); res.push(Math.round(performance.now() - t0)); }
      return { res, erros: window.__erros };
    })()`);
    igual(r.erros, []);
    igual(r.res.length, 10);
    certo(r.res.every((ms) => ms >= 1600 && ms <= 2600), r.res.join(','));
    await a.fechar();
  });
} finally { if (nav) await nav.fechar(); if (c) await c.desligar(); }

const r = resumo([g]);
console.log(`\n${r.passaram} de ${r.total} testes passaram; ${r.falharam} falharam`);
process.exitCode = r.falharam ? 1 : 0;
