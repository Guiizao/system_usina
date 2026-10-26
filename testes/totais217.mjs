/* Pranchetas Digitais - © 2026 Guilherme. */
/* 2.17 (pedido do Ademir, 25/10): o escritório vê a cal e a uréia em kg (1 copo de cal = 680 g, 1 caneca de uréia = 780 g);
   o operário continua anotando e vendo copos e canecas. node testes/totais217.mjs */
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import leitura from '../api-leitura.js';
import { teste, certo, igual, novoGrupo, resumo, usinaNoContexto } from './teste.mjs';
import { centralNode, pastaTemporaria } from './servidores.mjs';
import { abrirNavegador, TAMANHOS } from './navegador.mjs';

const require = createRequire(import.meta.url);
const Rastreamento = require('../public/bibliotecas/rastreamento.js');
const dia = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
function forms() { const ctx = { window: {} }; usinaNoContexto(ctx); return JSON.parse(JSON.stringify(ctx.window.USINA)); }
const reg = (prancheta, chave, valores) => ({ id: `${dia}|${prancheta}|${chave}`, data: dia, prancheta, chave: String(chave), valores, atualizadoEm: Date.now() });
// 3 copos de cal no 1º turno; uréia: 2 canecas e mais 0,5 kg (anotação antiga em kg) no 2º turno
const regs = [reg('ins_cal', 8, { qtd: '3' }), reg('ins_ureia', 17, { qtd: '2', unidade: 'canecas' }), reg('ins_ureia', 18, { qtd: '0.5', unidade: 'kg' })];

export async function testarTotais217(g) {
  const C = forms();
  await teste(g, 'a uréia anota em canecas (primeira unidade da folha); a cal continua em copos', async () => {
    igual(C.pranchetas.ins_ureia.unidades[0], 'canecas');
    igual(C.pranchetas.ins_cal.unidades, ['copos']);
  });
  await teste(g, 'API do escritório: 3 copos de cal = 2,04 kg; 2 canecas de uréia + 0,5 kg = 2,06 kg', async () => {
    const t = leitura.criar(C).totais({ de: dia, ate: dia, dias: [dia] }, regs);
    const cal = t.total.insumos.find((i) => i.prancheta === 'ins_cal'), ure = t.total.insumos.find((i) => i.prancheta === 'ins_ureia');
    igual([cal.unidade, cal.quantidade], ['kg', 2.04]);
    igual([ure.unidade, ure.quantidade], ['kg', 2.06]);
    igual(t.total.insumos.filter((i) => i.prancheta === 'ins_ureia').length, 1, 'uma linha só para a uréia');
  });
  await teste(g, 'uréia anotada antes da 2.17 sem unidade continua kg (não vira caneca)', async () => {
    const antigo = [reg('ins_ureia', 20, { qtd: '1' })];
    const ure = leitura.criar(C).totais({ de: dia, ate: dia, dias: [dia] }, antigo).total.insumos.find((i) => i.prancheta === 'ins_ureia');
    igual([ure.unidade, ure.quantidade], ['kg', 1]);
    igual([Rastreamento.calcular(C, dia, antigo).insumos.ureia.qtd], [1]);
  });
  await teste(g, 'Escritório (cálculos e rastreamento): cal 2,04 kg e uréia 2,06 kg', async () => {
    const R = Rastreamento.calcular(C, dia, regs);
    igual([R.insumos.cal.qtd, R.insumos.cal.unidade], [2.04, 'kg']);
    igual([R.insumos.ureia.qtd, R.insumos.ureia.unidade], [2.06, 'kg']);
  });
  // no aplicativo: os totais do painel e do resumo em kg; a folha da cal do operário em copos
  const c = await centralNode(8364, pastaTemporaria('totais217'));
  const nav = await abrirNavegador();
  try {
    const a = await nav.novoAparelho('demonstração', TAMANHOS.tablet);
    await a.ir(c.url + '/?demo&papel=central');
    await a.esperar('typeof totaisPorTurno === "function" && Object.keys(registros).length > 50', 15000, 'demonstração');
    await teste(g, 'painel e resumo do dia: a cal da demonstração soma em kg', async () => {
      const cal = await a.avaliar('JSON.stringify(totaisPorTurno(dataProducao()).filter((l) => l.folha === "ins_cal").map((l) => l.unidade))');
      certo(JSON.parse(cal).length && JSON.parse(cal).every((u) => u === 'kg'), 'cal em kg: ' + cal);
      certo(!/copos/.test(await a.avaliar('resumoDoDia(dataProducao())')), 'o resumo não fala em copos');
    });
    await teste(g, 'o operário continua com copos: a anotação da cal na demonstração fica em copos', async () => {
      igual(await a.avaliar('JSON.stringify(prancheta("ins_cal").unidades)'), '["copos"]');
      certo(await a.avaliar('Object.values(registros).filter((r) => r.prancheta === "ins_cal" && !r.apagado).every((r) => !r.valores.unidade || r.valores.unidade === "copos")'), 'anotação guardada em copos');
    });
    await teste(g, 'operário da destilaria: linha nova da uréia já vem em canecas e grava a unidade', async () => {
      const d = await nav.novoAparelho('destilaria', TAMANHOS.tablet);
      // a linha das 07h (a demonstração tem uréia em kg às 11h: o teste não pode depender da hora em que roda)
      await d.ir(c.url + '/?demo&papel=destilaria&op=Mateus&tela=prancheta&pid=ins_ureia&chave=7');
      await d.tocar('[data-quadro="qtd"]');
      igual(await d.avaliar(`(document.querySelector('[data-ed^="u:"].sel') || {}).textContent`), 'canecas', 'a unidade marcada');
      await d.teclar(['2']); await d.tocar('[data-ed="ocultar"]'); await d.tocar('[data-a="salvar"]');
      await d.esperar('Object.values(registros).some((r) => r.prancheta === "ins_ureia" && r.valores.qtd === "2" && r.valores.unidade === "canecas")', 5000, 'gravou 2 canecas');
      certo(!d.erros.length, d.erros.join(' | '));
    });
    certo(!a.erros.length, a.erros.join(' | '));
  } finally { await nav.fechar(); await c.desligar(); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const g = novoGrupo('Escritório em kg (2.17)');
  await testarTotais217(g);
  const r = resumo([g]);
  console.log(`
${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
  process.exitCode = r.falharam ? 1 : 0;
}
