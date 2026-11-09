/* 3.1: teclado de letras no padrão do celular e nome do operador escolhido na lista. */
import { abrirNavegador, TAMANHOS, dormir } from './navegador.mjs';
import { centralNode, pastaTemporaria } from './servidores.mjs';
import { novoGrupo, teste, certo, igual, resumo } from './teste.mjs';

const g = novoGrupo('Teclado (3.1)');
let nav, c;
try {
  nav = await abrirNavegador(); c = await centralNode(8577, pastaTemporaria('teclado31'));
  const url = 'http://127.0.0.1:8577';
  const a = await nav.novoAparelho('tec31', TAMANHOS.celular);
  await a.ir(url + '/?demo&papel=caldeira', 'document.querySelector("#app main")');
  await dormir(400);
  await a.avaliar(`(() => { ir({ tela: 'prancheta', pid: 'caldeira', data: dataProducao(), chave: 8 }); return 1; })()`);
  await dormir(400);
  await a.tocar('[data-quadro="obs"]');
  await dormir(200);
  const eds = () => a.avaliar(`[...document.querySelectorAll('.teclas.letras button')].map((b) => b.dataset.ed)`);

  await teste(g, 'letras na ordem do celular, com apagar, vírgula, ponto e espaço', async () => {
    const k = await eds();
    igual(k.slice(0, 10).join(''), 'QWERTYUIOP');
    igual(k.slice(10, 20).join(''), 'ASDFGHJKLÇ');
    for (const x of ['apagar', ',', '.', 'espaco', 'abc', 'acento', 'limpar']) certo(k.includes(x), x);
  });
  await teste(g, 'acento troca a última letra e a vírgula escreve', async () => {
    await a.teclar(['A', 'acento', 'acento', ',']);
    certo((await a.avaliar('document.querySelector(".visor").textContent.trim()')).endsWith('Ã,'), 'visor');
    await a.teclar(['apagar', 'apagar']);
  });
  await teste(g, 'página de símbolos tem números, vírgula e apagar', async () => {
    await a.teclar(['abc']);
    await dormir(150);
    const k = await eds();
    igual(k.slice(0, 10).join(''), '1234567890');
    for (const x of ['apagar', ',', 'espaco', 'abc']) certo(k.includes(x), x);
    certo(await a.avaliar('!!document.querySelector(".edicao.modo-letras")'), 'painel largo');
    await a.teclar(['abc']);
  });
  await teste(g, 'teclas não saem da tela no celular', async () => {
    igual(await a.avaliar(`[...document.querySelectorAll('.teclas.letras button')].filter((b) => { const r = b.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth || r.width < 20; }).length`), 0);
  });
  await teste(g, 'campo de número continua com o teclado de números', async () => {
    await a.tocar('[data-quadro="pressao"]');
    await dormir(150);
    certo(await a.avaliar(`!document.querySelector('.teclas.letras') && !!document.querySelector('.teclas [data-ed="7"]')`));
  });
  await a.fechar();

  await teste(g, 'no tablet chefe, o nome do operador é escolhido na lista', async () => {
    const b = await nav.novoAparelho('tec31b', TAMANHOS.celular);
    try {
      await b.ir(url + '/?demo&papel=central', 'document.querySelector("#app main")');
      await dormir(400);
      await b.avaliar(`(() => { const d = dataProducao(), id = d + '|ins_materia_prima|8'; registros[id] = { id, data: d, prancheta: 'ins_materia_prima', setor: 'ralo', chave: '8', valores: { qtd: '10', unidade: 'kg' }, operador: 'Lido da folha', apagado: false, criadoEm: 1, atualizadoEm: 1 }; salvarRegistros(); ir({ tela: 'prancheta', pid: 'ins_materia_prima', data: d, monitor: true }); return 1; })()`);
      await dormir(500);
      await b.tocar('[data-a="linha"][data-chave="8"]');
      await dormir(400);
      await b.tocar('[data-quadro="operador"]');
      await dormir(200);
      certo(!(await b.avaliar(`!!document.querySelector('.teclas.letras')`)), 'não abre o teclado');
      const nomes = await b.avaliar(`[...document.querySelectorAll('.opcoes-painel button')].map((x) => x.textContent.trim())`);
      const cad = await b.avaliar(`operadoresDo('ralo').map((o) => o.nome)`);
      certo(cad.length > 0, 'demonstração sem operadores');
      for (const n of cad) certo(nomes.includes(n), n + ' em ' + nomes);
      certo(nomes.includes('Lido da folha'), 'nome atual continua');
    } finally { await b.fechar(); }
  });
} finally { if (nav) await nav.fechar(); if (c) await c.desligar(); }

const r = resumo([g]);
console.log(`\n${r.passaram} de ${r.total} testes passaram; ${r.falharam} falharam`);
process.exitCode = r.falharam ? 1 : 0;
