/* Tarefa 6 da 3.1: cartões iguais em Relatórios, Apagar dentro do dia e acertos de alinhamento. */
import { abrirNavegador, TAMANHOS, dormir } from './navegador.mjs';
import { centralNode, pastaTemporaria } from './servidores.mjs';
import { novoGrupo, teste, certo, igual, resumo } from './teste.mjs';

const g = novoGrupo('Relatórios (3.1)');
let nav, c;
try {
  nav = await abrirNavegador(); c = await centralNode(8576, pastaTemporaria('relatorios31'));
  const url = 'http://127.0.0.1:8576/?demo&papel=central';
  const a = await nav.novoAparelho('rel31', TAMANHOS.tablet);
  await a.ir(url, 'document.querySelector("#app main")');
  await dormir(400);

  await teste(g, 'todo cartão tem exatamente Abrir, Enviar e Resumo', async () => {
    await a.avaliar(`(() => { ir({ tela: 'relatorios', carregado: true, dias: [{ data: dataProducao(), arquivos: [{ nome: 'a.xlsx' }] }] }); return 1; })()`);
    await dormir(400);
    const cartoes = await a.avaliar(`[...document.querySelectorAll('.relatorio-dia')].map((s) => [...s.querySelectorAll('[data-a]')].map((b) => b.dataset.a).join(','))`);
    certo(cartoes.length > 0, 'nenhum cartão');
    for (const k of cartoes) igual(k, 'relatorio-abrir,relatorio-enviar,relatorio-resumo');
  });
  await teste(g, 'Apagar só aparece dentro do dia com Excel guardado', async () => {
    const tem = (arq, trocaDia) => a.avaliar(`(async () => { const d = dataProducao(); ir({ tela: 'central', data: d, temArquivo: ${arq ? 'd' : '""'} }); if (${!!trocaDia}) { pilha[pilha.length - 1].data = somarDias(d, -1); render(); } await new Promise((ok) => setTimeout(ok, 200)); return !!document.querySelector('[data-a="relatorio-apagar"]'); })()`);
    certo(await tem(true), 'com arquivo');
    certo(!(await tem(false)), 'sem arquivo');
    certo(!(await tem(true, true)), 'depois de trocar de dia');
  });
  await a.fechar();

  await teste(g, 'ícone e texto do chip alinhados ao centro, diferença até 1 px', async () => {
    const ruins = [];
    for (const [nome, t] of Object.entries(TAMANHOS)) {
      const b = await nav.novoAparelho('chip31' + nome, t);
      try {
        await b.ir(url, 'document.querySelector("#app main")');
        await dormir(300);
        await b.avaliar('(() => { escolherEnvio("Enviar", dataProducao()); return 1; })()');
        await dormir(400);
        const r = await b.avaliar(`[...document.querySelectorAll('.setores-envio button, .turnos-envio button')].map((x) => { const i = x.querySelector('svg').getBoundingClientRect(), s = x.querySelector('span').getBoundingClientRect(); return { k: x.dataset.k, d: Math.abs((i.top + i.height / 2) - (s.top + s.height / 2)), lado: s.left >= i.right - 1 }; })`);
        certo(r.length > 0, nome);
        r.filter((x) => x.d > 1 || !x.lado).forEach((x) => ruins.push(`${nome}:${x.k}:${x.d.toFixed(1)}`));
      } finally { await b.fechar(); }
    }
    igual(ruins, []);
  });
  await teste(g, 'nome de 40 letras não quebra a linha do operador', async () => {
    for (const t of [TAMANHOS.tablet, TAMANHOS.tablet8, TAMANHOS.celular]) {
      const b = await nav.novoAparelho('nome31', t);
      try {
        await b.ir(url, 'document.querySelector("#app main")');
        await dormir(300);
        const m = await b.avaliar(`(async () => {
          const box = document.createElement('div'); box.className = 'pessoas'; box.style.width = '100%';
          box.innerHTML = '<div><span class="nome">' + ico('pessoa') + ' <b>Ana</b><small>com senha</small></span><span class="acoes"><button class="btn pequeno">Senha</button><button class="btn pequeno perigo">' + ico('lixeira') + '</button></span></div>';
          document.querySelector('main').prepend(box);
          const linha = box.firstChild, curto = linha.getBoundingClientRect().height;
          box.querySelector('b').textContent = 'Guilherme de Souza Albuquerque Figueiredo';
          const longo = linha.getBoundingClientRect().height, b = box.querySelector('b');
          return { curto, longo, cortado: b.scrollWidth > b.clientWidth, fora: document.documentElement.scrollWidth > innerWidth };
        })()`);
        igual(m.longo, m.curto, JSON.stringify(m));
        certo(!m.fora, 'rolagem para o lado');
      } finally { await b.fechar(); }
    }
  });
} finally { if (nav) await nav.fechar(); if (c) await c.desligar(); }

const r = resumo([g]);
console.log(`\n${r.passaram} de ${r.total} testes passaram; ${r.falharam} falharam`);
process.exitCode = r.falharam ? 1 : 0;
