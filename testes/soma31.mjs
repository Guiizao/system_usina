/* Tarefas 2, 3 e 4 da 3.1: conta do período, folhas somadas e cálculo de produção no envio. */
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { novoGrupo, teste, certo, igual, resumo } from './teste.mjs';

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

const r = resumo([g]);
console.log(`\n${r.passaram} de ${r.total} testes passaram; ${r.falharam} falharam`);
process.exitCode = r.falharam ? 1 : 0;
