/* Tarefa 5 da 3.1: cálculo, rastreamento e etiqueta. */
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { novoGrupo, teste, certo, igual, resumo } from './teste.mjs';
import { abrirNavegador, TAMANHOS } from './navegador.mjs';
import { centralNode, pastaTemporaria, APP } from './servidores.mjs';
const require = createRequire(import.meta.url);
const R = require('../public/bibliotecas/rastreamento.js');
const C = require('../carregar-usina.js').carregarUsina(APP + '/public');
const D = '2026-10-01';
const reg = (prancheta, chave, valores) => ({ data: D, prancheta, chave, valores });
const regs = [reg('ins_materia_prima', '1', { produto: 'Milho', qtd: '100', unidade: 'kg' }), reg('ins_materia_prima', '2', { produto: 'Arroz', qtd: '200', unidade: 'kg' }), reg('med_dornas', 'param', { brix_hid: '20', brix_ferm: '10' }), reg('destilaria', '7', { producao: '100' })];
const corrigidos = [...regs.slice(0, -1), reg('destilaria', '7', { producao: '250' })];
const calcular = () => R.calcular(C, D, regs);
const novo = () => R.calcular(C, D, corrigidos);
const g = novoGrupo('Rastreamento (3.1)');
await teste(g, 'kg por produto refaz matéria-prima e hidrólise', () => {
  const v = calcular(); R.recalcular(v, { campo: 'mp.0.kg', valor: 150 });
  igual(v.calculo.mpKg, 350); igual(v.pi.hidrolise, 350 / v.calculo.fator);
  igual(v.origem['calculo.mpKg'], 'soma da matéria-prima por produto');
});
await teste(g, 'Atualizar preserva digitado, refaz dependentes e não altera salvo', () => {
  const salvo = calcular(); R.recalcular(salvo, { campo: 'volumeDestilado', valor: 9000 });
  const antes = JSON.stringify(salvo), n = novo(), u = R.atualizar(salvo, n);
  igual(u.volumeDestilado, 9000); igual(u.calculo.alcoolDestilaria, n.calculo.alcoolDestilaria);
  igual(u.vinhaca.producao, 9000 - u.alcool.producao); igual(JSON.stringify(salvo), antes);
  igual(u.origem['calculo.alcoolDestilaria'], n.origem['calculo.alcoolDestilaria']);
});
await teste(g, 'calculado digitado sobrevive e seus dependentes usam o digitado', () => {
  const salvo = calcular(); R.recalcular(salvo, { campo: 'pi.hidrolise', valor: 7777 });
  const u = R.atualizar(salvo, novo());
  igual(u.pi.hidrolise, 7777); igual(u.pi.vinho, 7777 * u.calculo.brixInicial / u.calculo.brixFinal);
});
await teste(g, 'mp digitada é preservada inteira e mantém a soma coerente', () => {
  const salvo = calcular(); R.recalcular(salvo, { campo: 'mp.0.kg', valor: 150 });
  const u = R.atualizar(salvo, novo());
  igual(u.mp, salvo.mp); igual(u.calculo.mpKg, 350);
});
await teste(g, 'mp sem ajuste é substituída incluindo novos produtos', () => {
  const n = R.calcular(C, D, [...regs, reg('ins_materia_prima', '3', { produto: 'Sorgo', qtd: '50', unidade: 'kg' })]);
  const u = R.atualizar(calcular(), n); igual(u.mp, n.mp); igual(u.calculo.mpKg, 350);
});
await teste(g, 'diferenças ignoram ajustes manuais e metadados e identificam folhas corrigidas', () => {
  const salvo = calcular(); igual(R.diferencas(salvo, salvo), []);
  R.recalcular(salvo, { campo: 'pi.hidrolise', valor: 7777 }); salvo.salvoEm = 123;
  igual(R.diferencas(salvo, calcular()), []);
  certo(R.diferencas(salvo, novo()).includes('calculo.alcoolDestilaria'));
});
await teste(g, 'lote da etiqueta prefere álcool e usa geral quando vazio', () => {
  igual(R.loteDaEtiqueta({ lote: 'A', alcool: { lote: 'B' } }), 'B');
  igual(R.loteDaEtiqueta({ lote: 'A', alcool: { lote: '' } }), 'A');
});
await teste(g, 'soVer exporta PDF, Excel, XML, impressão e etiqueta do rascunho sem salvar', async () => {
  const salvo = calcular(), x = calcular(); R.recalcular(x, { campo: 'alcool.lote', valor: 'LOTE-TELA-31' });
  const ctx = vm.createContext({ window: { Rastreamento: R }, C, Blob, File, TextEncoder, Uint8Array,
    fetch: async () => { throw new Error('sem rede no teste'); },
    cfg: { demo: true }, soVer: () => true, copia: (v) => JSON.parse(JSON.stringify(v)),
    pegar: () => ({ valores: salvo }), prancheta: (pid) => C.pranchetas[pid], setorDaPrancheta: () => null,
    turnosDaPrancheta: () => [], listarPapel: () => [], fmtData: (d) => d.split('-').reverse().join('/'),
    fmtNum: (n) => String(n).replace('.', ','), rotuloHoraPapel: () => '', HORAS: [], linhasDeHora: () => [],
    totalInsumo: () => 0, extrasOperador: () => [], somarDias: (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10),
    fermentacaoDoDia: () => ({}), esc: (v) => String(v), ico: () => '', registrar: () => {},
    ehCentral: () => false, MIME: { pdf: 'application/pdf', xml: 'application/xml', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    __v: { data: D, valores: x, sujo: true },
  });
  for (const arq of ['bibliotecas/modelos.js', 'bibliotecas/pdf.js', 'bibliotecas/xlsx.js', 'chefe/exportar.js', 'chefe/escritorio.js']) vm.runInContext(fs.readFileSync(APP + '/public/' + arq, 'utf8'), ctx);
  ctx.__fontes = [400, 700].map((peso) => { const b = fs.readFileSync(APP + '/public/fonts/atkinson-pdf-' + peso + '.ttf'); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); });
  const r = await vm.runInContext(`(async () => {
    let impressao = '', previa = '', pdfHtml = '';
    imprimirHtml = (h) => { impressao = h; };
    abrirModal = async (h) => { previa = h; return true; };
    pecasPdf = async () => ({ fontes: __fontes });
    const pdfReal = window.criarPdf;
    window.criarPdf = (folhas, opts) => { pdfHtml = window.ModelosPapel.paraHtml(folhas[0], '', fmtNum); return pdfReal(folhas, opts); };
    const pdf = await arquivoEsc(__v, 'pdf');
    const excel = await arquivoEsc(__v, 'xlsx');
    const xml = await arquivoEsc(__v, 'xml');
    await imprimirFolhaEsc(__v); const folhaOk = impressao.includes('LOTE-TELA-31');
    await etiquetaEsc(__v);
    return [pdf.size > 0 && pdfHtml.includes('LOTE-TELA-31'), (await excel.text()).includes('LOTE-TELA-31'), (await xml.text()).includes('LOTE-TELA-31'), folhaOk, impressao.includes('LOTE-TELA-31'), previa.includes('LOTE-TELA-31'), rascunhoRastreio === null];
  })()`, ctx);
  igual(r, [true, true, true, true, true, true, true]);
  certo(salvo.alcool.lote !== 'LOTE-TELA-31');
});
const g2 = novoGrupo('Telas do rastreamento (3.1)');
let nav, c;
if (!process.argv.includes('--so-logica')) try {
  nav = await abrirNavegador(); c = await centralNode(8575, pastaTemporaria('rastreio31'));
  let limite;
  const a = await Promise.race([nav.novoAparelho('rastreio31', TAMANHOS.tablet), new Promise((_, rejeitar) => { limite = setTimeout(() => rejeitar(new Error('Navegador não criou o aparelho em 25 s')), 25000); })]).finally(() => clearTimeout(limite));
  await a.ir('http://127.0.0.1:8575/?demo&papel=central', 'document.querySelector("#app main")');
  const pv = (js) => a.avaliar(`(async () => { ${js} })()`);
  // A emulação termina antes do resize e dos ajustes de escala/letra do aplicativo.
  // Aguarda esses quadros antes de fotografar ou medir as coordenadas do toque.
  const tamanhoPronto = async (tamanho) => {
    await a.tamanhoTela(tamanho);
    await pv('await document.fonts.ready; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));');
  };
  await pv(`window.__v = { tela: 'escritorio', data: '${D}' }; registros = {}; window.__regs = ${JSON.stringify(regs)}; __regs.forEach((r) => { r.id = r.data + '|' + r.prancheta + '|' + r.chave; registros[r.id] = r; }); gravar('${D}', 'rastreamento', 'dia', Rastreamento.calcular(C, '${D}', __regs)); ir(__v);`);
  await teste(g2, 'aviso "as folhas mudaram" aparece só com diferença', async () => {
    certo(!(await pv('return telaEscritorio(__v)')).includes('esc-atualizar'));
    await pv(`registros['${D}|destilaria|7'].valores.producao = '250'; render();`);
    certo((await pv('return telaEscritorio(__v)')).includes('esc-atualizar'));
    for (const [nome, tamanho] of Object.entries(TAMANHOS)) {
      await tamanhoPronto(tamanho);
      await a.foto(APP + '/testes/saida/telas/' + nome + '/escritorio-folhas-mudaram.png');
    }
    await tamanhoPronto(TAMANHOS.tablet);
  });
  await teste(g2, 'Atualizar mantém o digitado e pede Salvar', async () => {
    await pv(`Rastreamento.recalcular(valoresDaTela(pilha[pilha.length - 1]), { campo: 'volumeDestilado', valor: 9000 });`);
    await a.tocar('[data-a="esc-atualizar"]');
    igual(await pv('const v = pilha[pilha.length - 1]; return [v.sujo, valoresDaTela(v).volumeDestilado, valoresDaTela(v).alcool.producao]'), [true, 9000, 250]);
    certo(await pv('return !!document.querySelector("[data-a=esc-salvar]")'));
    igual(await pv(`return rastreioGuardado('${D}').valores.alcool.producao`), 100);
    certo(!(await pv('return telaEscritorio(pilha[pilha.length - 1])')).includes('esc-atualizar'));
    for (const [nome, tamanho] of Object.entries(TAMANHOS)) {
      await tamanhoPronto(tamanho);
      await a.foto(APP + '/testes/saida/telas/' + nome + '/escritorio-atualizado.png');
    }
    await tamanhoPronto(TAMANHOS.tablet);
  });
  await teste(g2, 'soVer: PDF e etiqueta saem com o que está na tela', async () => {
    const r = await pv(`const anterior = [cfg.soNuvem, sync.bancoAntigo]; cfg.soNuvem = true; sync.bancoAntigo = true;
      const v = { data: '${D}', valores: valoresDoDia('${D}'), sujo: true };
      Rastreamento.recalcular(v.valores, { campo: 'alcool.lote', valor: 'LOTE-TELA-31' });
      const imprimirAntes = imprimirHtml, modalAntes = abrirModal, pdfAntes = window.criarPdf;
      let html = '', folha = '';
      try {
        imprimirHtml = (h) => { html = h; };
        window.criarPdf = (fs, opts) => { folha = window.ModelosPapel.paraHtml(fs[0], '', fmtNum); return pdfAntes(fs, opts); };
        const pdf = await arquivoEsc(v, 'pdf');
        const pdfOk = pdf.size > 0 && folha.includes('LOTE-TELA-31');
        await imprimirFolhaEsc(v); const impOk = html.includes('LOTE-TELA-31');
        abrirModal = async () => true; await etiquetaEsc(v);
        return [pdfOk, impOk, html.includes('LOTE-TELA-31'), rastreioGuardado('${D}').valores.alcool.lote !== 'LOTE-TELA-31', rascunhoRastreio === null];
      } finally { [cfg.soNuvem, sync.bancoAntigo] = anterior; imprimirHtml = imprimirAntes; abrirModal = modalAntes; window.criarPdf = pdfAntes; }`);
    igual(r, [true, true, true, true, true]);
  });
  await a.fechar();
} catch (e) { await teste(g2, 'infraestrutura do navegador', () => { throw e; }); }
finally { if (nav) await nav.fechar(); if (c) await c.desligar(); }
const { passaram, total, falharam } = resumo([g, g2]);
console.log(`\n${passaram} de ${total} testes passaram; ${falharam} falharam`);
process.exitCode = falharam ? 1 : 0;
