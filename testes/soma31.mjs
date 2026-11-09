/* Tarefas 2, 3 e 4 da 3.1: conta do período, folhas somadas e cálculo de produção no envio. */
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { novoGrupo, teste, certo, igual, resumo } from './teste.mjs';
import { abrirNavegador, TAMANHOS, dormir } from './navegador.mjs';
import { centralNode, pastaTemporaria } from './servidores.mjs';

const require = createRequire(import.meta.url);
const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const Consolidar = require('../public/bibliotecas/consolidar.js');
const { carregarUsina } = require('../carregar-usina.js');

const g = novoGrupo('Conta do período (3.1)');
const dia = (d, chave, valores, operador = 'A') => ({ data: d, chave, valores, operador });
const P = { tipo: 'grade', itens: [{ id: 'producao', label: 'Produção', type: 'num', agrega: 'soma', unidade: 'L' }, { id: 'inpm', label: 'INPM', type: 'num', unidade: '°' }] };
const DIAS = ['2026-10-01', '2026-10-02', '2026-10-03'];

await teste(g, 'soma quantidades, faz média das medições e lista operadores e dias vazios', async () => {
  const r = Consolidar.daFolha(P, { [DIAS[0]]: [dia(DIAS[0], '7', { producao: '10,5', inpm: '90' })], [DIAS[1]]: [dia(DIAS[1], '7', { producao: '4', inpm: '94' }, 'B')], [DIAS[2]]: [] }, DIAS);
  igual(r.quantidades[0].total, 14.5);
  igual([r.medicoes[0].media, r.medicoes[0].minima, r.medicoes[0].maxima, r.medicoes[0].leituras], [92, 90, 94, 2]);
  igual(r.operadores, ['A', 'B']);
  igual(r.diasSemAnotacao, ['2026-10-03']);
});
await teste(g, 'valor "x" e vazio são ignorados, sem NaN', async () => {
  const r = Consolidar.daFolha(P, { [DIAS[0]]: [dia(DIAS[0], '7', { producao: 'x', inpm: '' }), dia(DIAS[0], '8', { producao: '2', inpm: '12,5' })] }, [DIAS[0]]);
  igual(r.quantidades[0].total, 2);
  igual(r.medicoes[0].media, 12.5);
  certo(!JSON.stringify(r).includes('NaN') && !JSON.stringify(r).includes('null'), JSON.stringify(r));
});
await teste(g, 'linha obs da grade não entra', async () => {
  const r = Consolidar.daFolha(P, { [DIAS[0]]: [dia(DIAS[0], 'obs', { producao: '99' }), dia(DIAS[0], '7', { producao: '1' })] }, [DIAS[0]]);
  igual(r.quantidades[0].total, 1);
});
await teste(g, 'registro apagado não entra', async () => {
  const r = Consolidar.daFolha(P, { [DIAS[0]]: [Object.assign(dia(DIAS[0], '7', { producao: '99' }), { apagado: true })] }, [DIAS[0]]);
  igual(r.quantidades, []);
  igual(r.diasSemAnotacao, [DIAS[0]]);
});
await teste(g, 'campo com agrega nenhum não aparece em quantidades nem em medições', async () => {
  const F = { tipo: 'dornas', campos: [{ id: 'sac', label: 'SAC', type: 'num', agrega: 'nenhum' }] };
  const r = Consolidar.daFolha(F, { [DIAS[0]]: [dia(DIAS[0], 'd1', { sac: '4' })] }, [DIAS[0]]);
  igual([r.quantidades, r.medicoes], [[], []]);
});
await teste(g, 'área sem nenhuma anotação devolve listas vazias', async () => {
  const r = Consolidar.daFolha(P, {}, DIAS);
  igual([r.quantidades, r.medicoes, r.operadores], [[], [], []]);
  igual(r.diasSemAnotacao, DIAS);
});
await teste(g, 'producao soma quantidades, faz média de INPM e Brix e conta os não conferidos', async () => {
  const r = Consolidar.producao([
    { dia: DIAS[0], conferido: true, alcool: 100, vinhaca: 900, hidrolisado: 50, vinho: 70, inpm: 92, brix: 10, lote: 'A' },
    { dia: DIAS[1], conferido: false, alcool: '50,5', vinhaca: '', hidrolisado: 50, vinho: 30, inpm: 94, brix: '', lote: 'B' },
  ]);
  igual(r, { alcool: 150.5, vinhaca: 900, hidrolisado: 100, vinho: 100, inpm: 93, brix: 10, dias: 2, naoConferidos: 1 });
});
await teste(g, 'todo campo numérico de todas as folhas tem classificação', async () => {
  const C = carregarUsina(path.join(APP, 'public'));
  const marca = {};
  for (const [pid, p] of Object.entries(C.pranchetas)) {
    for (const c of [...(p.campos || []), ...(p.itens || []), ...(p.parametros || [])].filter((x) => x.type === 'num')) {
      const a = Consolidar.agregaDoCampo(c);
      certo(['soma', 'media', 'nenhum'].includes(a), `${pid}.${c.id}: ${a}`);
      marca[`${pid}.${c.id}`] = a;
    }
  }
  for (const k of ['hid_anexo1.cal', 'hid_anexo1.anti', 'hid_anexo1.enzi', 'hid_anexo2.enz', 'hid_anexo2.anti', 'destilaria.producao']) igual(marca[k], 'soma', k);
  igual(marca['hid_anexo2.sac'], 'nenhum');
  igual(marca['nova_destilaria.producao_lth'], 'media');
  igual(marca['destilaria.carregamento'], 'media');
  igual(marca['destilaria.inpm'], 'media');
});

/* Tarefas 3 e 4, no aplicativo: dois dias semeados na demonstração. */
const g2 = novoGrupo('Envio do período (3.1)');
const D1 = '2026-10-01', D2 = '2026-10-02';
let nav, c;
try {
  nav = await abrirNavegador(); c = await centralNode(8574, pastaTemporaria('soma31'));
  const a = await nav.novoAparelho('soma31', TAMANHOS.tablet);
  await a.ir(`http://127.0.0.1:8574/?demo&papel=central`, 'document.querySelector("#app main")');
  await dormir(400);
  await a.avaliar(`(() => {
    window.print = () => {};
    window.__D = ['${D1}', '${D2}'];
    window.__ids = setores().map((s) => s.id);
    const pos = (d, pid, chave, valores, operador) => { const s = setorDaPrancheta(pid); registros[\`\${d}|\${pid}|\${chave}\`] = { id: \`\${d}|\${pid}|\${chave}\`, data: d, prancheta: pid, setor: s ? s.id : '', chave, valores, operador, apagado: false, criadoEm: 1, atualizadoEm: 1 }; };
    pos('${D1}', 'destilaria', '7', { producao: '10', inpm: '90', temp_pe_a: '80' }, 'A');
    pos('${D1}', 'destilaria', '23', { producao: '5', inpm: '92', temp_pe_a: '84' }, 'B');
    pos('${D2}', 'destilaria', '7', { producao: '20', inpm: '94', temp_pe_a: '82' }, 'A');
    salvarRegistros();
    window.__nomes = async (f) => { const t = new TextDecoder('utf-8').decode(new Uint8Array(await f.arrayBuffer())); return [...t.matchAll(/<sheet [^>]*name="([^"]*)"/g)].map((m) => m[1]); };
    window.__texto = (f) => f.arrayBuffer().then((b) => new TextDecoder('latin1').decode(new Uint8Array(b)));
    window.__impressas = async (...args) => { await imprimirFolhas(...args); const n = document.querySelectorAll('#impressao .folha-imp').length; document.body.classList.remove('imprimindo'); return n; };
    window.__resumo = (somar, extras = [], dias = window.__D) => resumoDoEnvio({ dias, setores: window.__ids, turnos: C.turnos.map((t) => t.id), totalTurnos: C.turnos.length, somar, extras });
    return 1;
  })()`);
  const conta = (t, x) => t.split(x).length - 1;
  const pv = (js) => a.avaliar(`(async () => { ${js} })()`);

  await teste(g2, 'período somando: uma aba por área, sem as abas dos dias', async () => {
    igual(await pv('return window.__nomes(gerarArquivo("xlsx", window.__D, window.__ids, true))'), await pv('return setores().map((s) => s.nome.replace(/[\\\\/:*?\\[\\]]/g, "-").slice(0, 31))'));
  });
  await teste(g2, 'período sem somar: uma aba por folha e por dia', async () => {
    igual((await pv('return window.__nomes(gerarArquivo("xlsx", window.__D, window.__ids, false))')).length, 2 * await pv('return folhasDosSetores(window.__ids).length'));
  });
  await teste(g2, 'PDF somando tem uma página por área', async () => {
    const t = await pv('return window.__texto(await gerarPdf(window.__D, window.__ids, true))');
    igual((t.match(/\/Type \/Page[^s]/g) || []).length, await pv('return setores().length'));
  });
  await teste(g2, 'imprimir somando gera uma .folha-imp por área', async () => {
    igual(await pv('return window.__impressas(window.__D, window.__ids, true)'), await pv('return setores().length'));
  });
  await teste(g2, 'XML ignora somar e sai dia a dia', async () => {
    const t = await pv('return window.__texto(gerarArquivo("xml", window.__D, window.__ids, true))');
    igual(conta(t, '<folha '), 2 * await pv('return folhasDosSetores(window.__ids).length'));
  });
  await teste(g2, 'Resumo sem somar tem um bloco por dia', async () => {
    igual(conta(await pv('return window.__resumo(false)'), 'Folha de '), 2);
  });
  await teste(g2, 'Resumo somando tem um bloco por área, com média, mínima e máxima', async () => {
    const t = await pv('return window.__resumo(true)');
    igual(conta(t, '*DESTILARIA E FERMENTAÇÃO*'), 1);
    igual(conta(t, 'Folha de '), 0);
    certo(/Produção Álcool: 35\b/.test(t), t);
    certo(/INPM \(°\): média 92 \(mín\. 90, máx\. 94\)/.test(t), t);
  });
  await teste(g2, 'turno desmarcado não entra na soma', async () => {
    const m = await pv('return (await montarEnvio({ formato: "texto", dias: window.__D, setores: window.__ids, turnos: [1], totalTurnos: 3, somar: true, extras: [] })).texto');
    certo(/Produção Álcool: 30\b/.test(m), m);
  });

  await teste(g2, 'Áreas tem Cálculo de produção e Rastreamento', async () => {
    await a.tocar('[data-a="compartilhar"][data-destino="whatsapp"]'); await dormir(300);
    igual(await pv('return [...document.querySelectorAll(".modal .setores-envio [data-k^=\'x:\']")].map((b) => [b.dataset.k, b.classList.contains("sel")])'), [['x:calculo', true], ['x:rastreamento', true]]);
    await a.tocar('.modal [data-k="x"]'); await dormir(300);
  });
  await teste(g2, 'Resumo traz o bloco de produção com "calculado, não conferido" se o dia não foi salvo', async () => {
    const t = await pv(`return window.__resumo(false, ['calculo', 'rastreamento'], ['${D1}'])`);
    certo(t.includes('*PRODUÇÃO (calculado, não conferido)*'), t);
    certo(/Álcool: 15\b/.test(t), t);
    certo(t.includes('Lote:'), t);
  });
  await teste(g2, 'dia salvo sai sem o aviso e com os números salvos', async () => {
    await pv(`const v = valoresDoDia('${D2}'); v.alcool.producao = 777; v.operadores = []; registros['${D2}|rastreamento|dia'] = { id: '${D2}|rastreamento|dia', data: '${D2}', prancheta: 'rastreamento', chave: 'dia', valores: v, apagado: false, atualizadoEm: 1 }; salvarRegistros();`);
    const t = await pv(`return window.__resumo(false, ['calculo'], ['${D2}'])`);
    certo(t.includes('*PRODUÇÃO*'), t);
    certo(/Álcool: 777\b/.test(t), t);
  });
  await teste(g2, 'período somando soma álcool e faz média de INPM', async () => {
    const t = await pv("return window.__resumo(true, ['calculo'])");
    igual(conta(t, 'PRODUÇÃO'), 1);
    certo(/Álcool: 792\b/.test(t), t);
    certo(/INPM médio: 92/.test(t), t);
  });
  await teste(g2, 'período sem somar tem um bloco de produção por dia', async () => {
    igual(conta(await pv("return window.__resumo(false, ['calculo'])"), 'PRODUÇÃO'), 2);
  });
  await teste(g2, 'desmarcado não sai no Excel, no PDF, na impressão nem no Resumo', async () => {
    const com = (x) => `[${x.map((k) => `'${k}'`).join(',')}]`;
    const nomes = (x) => pv(`return window.__nomes(gerarArquivo('xlsx', window.__D, window.__ids, true, ${com(x)}))`);
    const base = (await nomes([])).length;
    igual((await nomes(['calculo'])).length, base + 1);
    igual((await nomes(['rastreamento'])).length, base + 2);
    const paginas = async (x) => ((await pv(`return window.__texto(await gerarPdf(window.__D, window.__ids, true, ${com(x)}))`)).match(/\/Type \/Page[^s]/g) || []).length;
    igual(await paginas([]), base);
    igual(await paginas(['calculo']), base + 1);
    igual(await pv(`return window.__impressas(window.__D, window.__ids, true, ${com([])})`), base);
    igual(await pv(`return window.__impressas(window.__D, window.__ids, true, ${com(['calculo', 'rastreamento'])})`), base + 3);
    certo(!(await pv('return window.__resumo(true, [])')).includes('PRODUÇÃO'));
  });
  await teste(g2, 'botão Enviar ou imprimir no cálculo só com a função relatorios', async () => {
    const comFuncoes = (f) => pv(`const antes = demoFuncoes; demoFuncoes = ${JSON.stringify(f)}; try { return telaEscCalculos({ data: '${D1}' }).includes('data-a="relatorio-enviar"'); } finally { demoFuncoes = antes; }`);
    certo(await comFuncoes(['escritorio', 'relatorios']), 'com a função');
    certo(!(await comFuncoes(['escritorio'])), 'sem a função');
  });
  await a.fechar();
} finally { if (nav) await nav.fechar(); if (c) await c.desligar(); }

const r = resumo([g, g2]);
console.log(`\n${r.passaram} de ${r.total} testes passaram; ${r.falharam} falharam`);
process.exitCode = r.falharam ? 1 : 0;
