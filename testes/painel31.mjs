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
  await teste(g, 'ligado no celular: a abertura desenha, termina em até 4,6 s e sai sozinha', async () => {
    const a = await abrir('p2', TAMANHOS.celular, 'central', true);
    certo(await a.avaliar(`document.documentElement.hasAttribute('data-painel-novo')`), 'marca');
    await dormir(700);
    certo(await a.avaliar(`!!window.Aberturas && !!document.querySelector('#abertura-nova canvas')`), 'canvas');
    const claro = await a.avaliar(`(() => { const c = document.querySelector('#abertura-nova canvas'); const d = c.getContext('2d').getImageData(c.width / 2 - 60, c.height / 2 - 60, 120, 120).data; let m = 0; for (let i = 0; i < d.length; i += 4) m = Math.max(m, d[i + 1]); return m; })()`);
    certo(claro > 60, 'desenhou algo: ' + claro);
    await dormir(3900);
    igual(await a.avaliar(`!!document.querySelector('#abertura-nova') || !!document.querySelector('.abertura-voa')`), false);
    await a.fechar();
  });
  await teste(g, 'um toque pula a abertura', async () => {
    const a = await abrir('p3', TAMANHOS.computador, 'central', true);
    await dormir(300);
    await a.avaliar(`document.querySelector('#abertura-nova').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); 1`);
    certo(await a.avaliar(`document.querySelector('#abertura-nova').classList.contains('saindo')`), 'começou a sair');
    await dormir(800);
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
    await dormir(4800);
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
    await a.tocar('#t [data-a="painel-novo"][data-valor="1"]'); await dormir(700);
    igual(await a.avaliar('cfg.painelNovo'), true);
    await a.avaliar(`document.querySelector('#app main').insertAdjacentHTML('afterbegin', '<div id="t">' + blocoPainelNovo() + '</div>'); 1`);
    await a.tocar('#t [data-a="som-painel"][data-valor="0"]');
    igual(await a.avaliar('cfg.somDesligado'), true);
    await a.avaliar(`document.querySelector('#app main').insertAdjacentHTML('afterbegin', '<div id="t">' + blocoPainelNovo() + '</div>'); 1`);
    await a.tocar('#t [data-a="painel-novo"][data-valor="0"]'); await dormir(700);
    igual(await a.avaliar('[cfg.painelNovo, document.documentElement.hasAttribute("data-painel-novo")]'), [false, false]);
    await a.fechar();
  });
  await teste(g, 'celular com a chave: início novo, barra de 5; desligar volta ao painel de antes', async () => {
    const a = await abrir('p11', TAMANHOS.celular, 'central', false);
    igual(await a.avaliar(`[!!document.querySelector('.pn-heroi'), !!document.querySelector('.pn-barra')]`), [false, false]);
    await a.avaliar(`cfg.painelNovo = true; pilha = [telaInicial()]; render(true); 1`);
    igual(await a.avaliar(`[!!document.querySelector('.pn-heroi'), document.querySelectorAll('.pn-barra button, .pn-barra .vago').length]`), [true, 5]);
    await dormir(4800);
    const naoRola = `(() => { const m = document.querySelector('.pn-cel.cabe'); return m.scrollHeight - m.clientHeight; })()`;
    certo(await a.avaliar(naoRola) <= 1, 'o início cabe sem rolar');
    certo(await a.avaliar(`(() => { const l = document.querySelector('.pn-graf .media'); return !l || [...document.querySelectorAll('.pn-graf button span')].every((s) => s.getBoundingClientRect().bottom <= l.getBoundingClientRect().top); })()`), 'o traço da média não passa em cima dos números');
    await a.tocar('.pn-barra [data-a="setores-cel"]');
    certo(await a.avaliar(naoRola) <= 1, 'os setores cabem sem rolar');
    certo(await a.avaliar(`document.querySelectorAll('.pn-setores button').length === setores().length`), 'um cartão por setor');
    await a.tocar('.pn-setores [data-a="abrir-setor"]');
    igual(await a.avaliar(`!!document.querySelector('.pn-barra')`), false, 'sem barra na folha');
    await a.avaliar(`ir({ tela: 'mais-cel' }); 1`);
    await a.tocar('.pn-chave');
    igual(await a.avaliar(`[cfg.painelNovo, document.documentElement.hasAttribute('data-painel-novo')]`), [false, false]);
    await a.avaliar(`pilha = [telaInicial()]; render(true); 1`);
    igual(await a.avaliar(`[!!document.querySelector('.pn-heroi'), !!document.querySelector('.pn-barra'), !!document.querySelector('.setores-grade')]`), [false, false, true]);
    await a.fechar();
  });
  await teste(g, 'assistente: pergunta aparece, responde e o aviso só abre depois de confirmar', async () => {
    const a = await abrir('p12', TAMANHOS.computador, 'central', false);
    await a.tocar('.ia-busca');
    igual(await a.avaliar(`!!document.querySelector('.ia-gaveta')`), true);
    await a.avaliar(`ia.rascunho = 'Quanto deu?'; iaEnviar(); 1`);
    await a.esperar(`document.querySelectorAll('.ia-resp').length === 1 && !ia.ocupado`, 5000, 'resposta');
    await a.avaliar(`ia.msgs.push({ de: 'ia', texto: 'Confira.', acao: { tipo: 'aviso', resumo: 'Aviso', dados: { setor: 'caldeira', texto: 'Medir' } } }); render(); 1`);
    igual(await a.avaliar('view().tela'), 'central', 'nada abriu antes de confirmar');
    await a.tocar('[data-a="ia-acao"]');
    await a.esperar(`view().tela === 'avisos'`, 5000, 'avisos');
    igual(await a.avaliar('[view().tela, view().form.setor, view().form.texto, ia.aberto]'), ['avisos', 'caldeira', 'Medir', false]);
    await a.fechar();
  });
  await teste(g, 'assistente: gráfico na conversa, imagem e PDF prontos e WhatsApp pelo envio de sempre', async () => {
    const a = await abrir('p17', TAMANHOS.computador, 'central', false);
    await a.avaliar(`window.compartilhar = (destino, data, arq, texto) => { window.env = { destino, data, nome: arq.name, tipo: arq.type, tam: arq.size, texto }; arq.slice(0, 4).text().then((t) => { window.env.ini = t; }); }; ia.msgs = [{ de: 'ia', titulo: 'Produção Álcool, soma por dia', texto: 'Soma do período.', unidade: 'L', linhas: [['Soma (L)', 6453.54]], serie: [{ x: '2026-11-01', y: 3137.08 }, { x: '2026-11-02', y: null }, { x: '2026-11-03', y: 3316.46 }], arquivo: { nome: 'producao-alcool' }, consulta: { folha: 'destilaria', campo: 'producao', de: '2026-11-01', ate: '2026-11-03', por: 'dia', operacao: 'soma' } }]; abrirAssistente(); 1`);
    await dormir(500); // a gaveta termina de deslizar
    igual(await a.avaliar(`[document.querySelectorAll('.ia-grafico rect[rx]').length, document.querySelectorAll('[data-a="ia-arquivo"]').length]`), [2, 3]);
    await a.tocar('[data-a="ia-arquivo"][data-t="whatsapp"]');
    await a.esperar('!!(window.env && window.env.ini)', 5000, 'imagem pronta');
    igual(await a.avaliar('[env.destino, env.data, env.nome, env.tipo, env.tam > 2000, env.ini.slice(1), env.texto]'), ['whatsapp', '2026-11-01', 'producao-alcool.png', 'image/png', true, 'PNG', 'Produção Álcool, soma por dia, 01/11/2026 a 03/11/2026']);
    await a.avaliar('window.env = null; 1');
    await a.tocar('[data-a="ia-arquivo"][data-t="pdf"]');
    await a.esperar('!!(window.env && window.env.ini)', 8000, 'PDF pronto');
    igual(await a.avaliar('[env.destino, env.nome, env.tipo, env.ini]'), ['baixar', 'producao-alcool.pdf', 'application/pdf', '%PDF']);
    await a.fechar();
  });
  await teste(g, 'som: avançar toca um, voltar toca outro, e os dois desenham', async () => {
    const a = await abrir('p18', TAMANHOS.computador, 'central', true);
    await a.esperar('!!window.Aberturas', 8000, 'as aberturas');
    await dormir(4800);
    const iniciados = await a.avaliar(`(async () => { let n = 0; const s = OscillatorNode.prototype.start; OscillatorNode.prototype.start = function (...x) { n++; return s.apply(this, x); }; window.Aberturas.somDaTela(0); window.Aberturas.somDaTela(4); OscillatorNode.prototype.start = s; return n; })()`);
    igual(iniciados, 2);
    await a.avaliar(`window.sons = []; window.Aberturas.somDaTela = (i) => window.sons.push(i); ir({ tela: 'relatorios' }); 1`);
    await a.tocar('[data-a="voltar"]');
    await a.tocar('.menu-pc [data-a="relatorios"]');
    igual(await a.avaliar('window.sons.filter((i) => i === 0 || i === 4)'), [4, 0]);
    await a.fechar();
  });
  await teste(g, 'trocar de pessoa limpa a conversa do assistente e descarta a resposta pendente', async () => {
    const a = await abrir('p14', TAMANHOS.computador, 'central', false);
    await a.avaliar(`cfg.demo = false; cfg.soNuvem = true; cfg.nuvemUrl = 'http://nuvem.invalid'; cfg.nuvemToken = 't'; cfg.pessoa = { id: 'a', nome: 'Ana', funcoes: ['relatorios', 'assistente'] }; window.fetch = () => new Promise((ok) => { window.soltar = ok; }); abrirAssistente(); ia.msgs.push({ de: 'ia', texto: 'Produção 123' }); render(); 1`);
    igual(await a.avaliar(`document.querySelectorAll('.ia-gaveta .ia-resp').length`), 1);
    await a.avaliar(`ia.rascunho = 'Quanto deu?'; iaEnviar(); cfg.pessoa = { id: 'b', nome: 'Beto', funcoes: [] }; render(); window.soltar({ ok: true, json: async () => ({ texto: 'Resposta da Ana' }) }); 1`);
    await dormir(200);
    igual(await a.avaliar(`[ia.msgs.length, ia.ocupado, ia.rascunho, document.querySelectorAll('.ia-gaveta .ia-resp').length]`), [0, false, '', 0]);
    await a.fechar();
  });
  await teste(g, 'celular: Abrir e corrigir de um dia antigo leva aos setores daquele dia', async () => {
    const a = await abrir('p16', TAMANHOS.celular, 'central', false);
    await a.avaliar(`cfg.painelNovo = true; pilha = [telaInicial()]; ir({ tela: 'relatorios' }); 1`);
    await dormir(200);
    const dia = await a.avaliar(`document.querySelectorAll('.rel-grade [data-a="rel-dia"]')[1].dataset.data`);
    await a.tocar('.rel-grade [data-a="rel-dia"]', undefined, { indice: 1 }); await dormir(800);
    igual(await a.avaliar(`[!!document.querySelector('.rel-painel'), !!document.querySelector('.rel-cal')]`), [true, false], 'o calendário saiu e o dia ficou');
    await a.tocar('[data-a="relatorio-abrir"]');
    await a.esperar(`view().tela === 'setores-cel'`, 5000, 'setores do dia');
    igual(await a.avaliar(`view().data`), dia);
    await a.tocar('.pn-setores [data-a="abrir-setor"]');
    igual(await a.avaliar(`[view().tela, view().data]`), ['prancheta', dia]);
    await a.fechar();
  });
  await teste(g, 'celular: sem corrigir nem relatórios não há Setores nem abertura de folha', async () => {
    const a = await nav.novoAparelho('p15', TAMANHOS.celular);
    await a.ir(url + 'central&funcoes=avisos', 'document.querySelector("#app main")');
    await a.avaliar(`cfg.painelNovo = true; pilha = [telaInicial()]; render(true); 1`);
    igual(await a.avaliar(`[document.querySelectorAll('.pn-barra button, .pn-barra .vago').length, !!document.querySelector('.pn-barra [data-a="setores-cel"]')]`), [5, false]);
    await a.avaliar(`ir({ tela: 'setores-cel', data: dataProducao() }); 1`);
    igual(await a.avaliar(`!!document.querySelector('.pn-setores')`), false);
    await a.avaliar(`const b = document.createElement('button'); b.dataset.a = 'abrir-setor'; b.dataset.id = setores()[0].id; document.querySelector('#app').appendChild(b); b.click(); 1`);
    await dormir(100);
    igual(await a.avaliar(`view().tela`), 'setores-cel', 'não abriu a folha');
    await a.fechar();
  });
  await teste(g, 'fundo: cinco efeitos, um por vez, só no painel novo, atrás de tudo e sem reiniciar no redesenho', async () => {
    const pc = await abrir('p19', TAMANHOS.computador, 'central', false);
    igual(await pc.avaliar(`(() => { const f = document.getElementById('fundo-vivo'); return [getComputedStyle(f).display, f.querySelectorAll('.fv').length, f.querySelectorAll('.fv.ativo').length, document.documentElement.scrollWidth <= innerWidth]; })()`), ['block', 5, 1, true]);
    await pc.avaliar(`window.camada = document.getElementById('fundo-vivo'); render(true); 1`);
    igual(await pc.avaliar(`[window.camada.isConnected, !document.elementFromPoint(700, 300).closest('#fundo-vivo')]`), [true, true]);
    await pc.fechar();
    const t = await abrir('p20', TAMANHOS.tablet, 'central', false);
    igual(await t.avaliar(`getComputedStyle(document.getElementById('fundo-vivo')).display`), 'none');
    await t.fechar();
  });
  await teste(g, 'quem não vê produção não recebe os números no painel novo', async () => {
    const a = await nav.novoAparelho('p13', TAMANHOS.computador);
    await a.ir(url + 'central&funcoes=corrigir', 'document.querySelector("#app main")');
    igual(await a.avaliar(`[!!document.querySelector('.pn-visao'), !!document.querySelector('.pn-heroi'), !!document.querySelector('.pn-linha')]`), [true, false, false]);
    await a.fechar();
  });
  await teste(g, 'as 11 aberturas desenham sem erro', async () => {
    const a = await abrir('p7', TAMANHOS.celular, 'central', true);
    await dormir(4800);
    const r = await a.avaliar(`(async () => {
      const c = document.createElement('canvas'); c.style.cssText = 'width:300px;height:300px;position:fixed;left:0;top:0'; document.body.appendChild(c);
      const res = [];
      for (let i = 0; i < Aberturas.total; i++) { const t0 = performance.now(); await new Promise((ok) => Aberturas.tocar(i, c, false, ok)); res.push(Math.round(performance.now() - t0)); }
      return { res, erros: window.__erros };
    })()`);
    igual(r.erros, []);
    igual(r.res.length, 11);
    certo(r.res.every((ms) => ms >= 3200 && ms <= 3900), r.res.join(',')); // 3,3 s de animação; a passagem de 0,8 s é do iniciar.js
    await a.fechar();
  });
} finally { if (nav) await nav.fechar(); if (c) await c.desligar(); }

const r = resumo([g]);
console.log(`\n${r.passaram} de ${r.total} testes passaram; ${r.falharam} falharam`);
process.exitCode = r.falharam ? 1 : 0;
