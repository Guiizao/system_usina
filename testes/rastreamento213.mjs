/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { teste, certo, igual, usinaNoContexto, caminhoNovo } from './teste.mjs';

const require = createRequire(import.meta.url), R = require('../public/bibliotecas/rastreamento.js');
const DIA = '2026-10-07';
const fonte = (nome) => fs.readFileSync(new URL('../public/' + caminhoNovo(nome), import.meta.url), 'utf8');
const fmtNum = (v) => String(v).replace('.', ',');
const fmtData = (v) => v.split('-').reverse().join('/');
const reg = (prancheta, chave, valores, extra = {}) => ({ prancheta, chave, valores, data: DIA, operador: 'Bruno', ...extra });
const perto = (n, esperado) => certo(Math.abs(n - esperado) < 0.000001, `${n} difere de ${esperado}`);
function forms() { const c = { window: {} }; usinaNoContexto(c); return JSON.parse(JSON.stringify(c.window.USINA)); }
function exemplo(C) {
  const registros = [
    reg('ins_materia_prima', '7', { qtd: '15000', unidade: 'kg', produto: 'Milho', fornecedor: 'Fornecedor A', nf: '123' }),
    reg('med_dornas', 'param', { brix_hid: '22', brix_ferm: '13' }),
    reg('med_dornas', 'hid', { hid1_folga: '0.50', hid2_folga: '0.25', sac1_folga: '0' }),
    reg('med_dornas', 'dsc', { dsc11_folga: '1.25' }),
    ...Array.from({ length: 9 }, (_, i) => reg('hid_anexo1', String(i + 1), { brix: '20', phf: i ? '6.5' : '6.0' })),
    reg('fermentacao', 'ciclo-1', { brix_inicial: '12' }),
    ...Array.from({ length: 24 }, (_, i) => reg('destilaria', String(i), { producao: '100', inpm: '93' })),
    reg('nova_destilaria', '7', { producao_lth: '200', inpm: '92' }, { operador: 'Ricardo' }),
    reg('ins_lphera', '7', { qtd: '500', unidade: 'mL', lote: 'L1', validade: '2027-10-01', fornecedor: 'Empresa A', nf: '111' }),
    reg('ins_lphera', '8', { qtd: '1', unidade: 'L', lote: 'L2', validade: '2027-11-01', fornecedor: 'Empresa B', nf: '222' }),
    reg('ins_cal', '7', { qtd: '3', unidade: 'copos' }),
    reg('ins_ureia', '7', { qtd: '1500', unidade: 'g' }),
  ];
  return { registros, valores: R.calcular(C, DIA, registros) };
}
function ambiente(C, valores, registros = []) {
  const window = {}, c = { window, TextEncoder, Blob };
  ['modelos.js', 'xlsx.js', 'pdf.js'].forEach((n) => vm.runInNewContext(fonte(n), c));
  const regs = [...registros, ...(valores ? [reg('rastreamento', 'dia', valores)] : [])];
  const listar = (data, pid) => regs.filter((r) => r.data === data && r.prancheta === pid && !r.apagado);
  const papel = window.ModelosPapel.montar({ C, prancheta: (pid) => C.pranchetas[pid], listar,
    pegar: (data, pid, chave) => listar(data, pid).find((r) => r.chave === chave),
    setorDaPrancheta: () => null, fmtNum, fmtData,
    somarDias: (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10),
  });
  return { window, folha: papel.folha('rastreamento', DIA) };
}
function pdf(window, folha) {
  const fontes = [400, 700].map((peso) => {
    const b = fs.readFileSync(new URL(`../public/fonts/atkinson-pdf-${peso}.ttf`, import.meta.url));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  });
  return window.criarPdf([folha], { fontes, fmtNum });
}

export async function testarRastreamento213(grupo) {
  await teste(grupo, 'UMD no navegador e Node; doze letras e configuração do lote', () => {
    const C = forms(), window = { USINA: C };
    vm.runInNewContext(fonte('rastreamento.js'), { window });
    igual(Array.from({ length: 12 }, (_, i) => R.letraDoMes(i + 1)).join(''), 'LABCDEFGHIJK');
    igual(window.Rastreamento.lote(C, '2026-10-08'), 'UB26I080700');
    igual(R.letraDoMes(0), ''); igual(R.letraDoMes(13), '');
    C.rastreamento.letrasDosMeses = 'ABCDEFGHIJKL';
    igual(R.lote(C, '2026-10-08'), 'UB26J080700');
  });
  await teste(grupo, '15000 kg → 51724,1 L → 87533,2 L sem arredondamento intermediário', () => {
    const { valores: v } = exemplo(forms());
    igual(v.calculo.mpKg, 15000); igual(v.pi.hidrolise.toFixed(1), '51724.1'); igual(v.pi.vinho.toFixed(1), '87533.2');
    perto(v.pi.vinho, 15000 / .29 * 22 / 13);
    igual(v.fechamento, '2026-10-08'); igual(v.lote, 'UB26I080700'); igual(v.alcool.lote, v.lote);
    igual(v.calculo.alcoolDestilaria, 2400); igual(v.calculo.alcoolNova, 200); igual(v.alcool.producao, 2600);
    igual(v.vinhaca.producao, ''); igual(v.vinhaca.lote, '');
    igual(v.origem['calculo.alcoolDestilaria'], 'soma de 24 horas da Destilaria');
  });
  await teste(grupo, 'validade por fechamento, viradas de mês/ano e 29 de fevereiro', () => {
    const C = forms(), v = R.calcular(C, DIA, []);
    igual(v.alcool.validade, '2029-10-08'); igual(v.vinhaca.validade, '2026-10-13');
    const ano = R.calcular(C, '2026-12-31', []);
    igual(ano.lote, 'UB27L010700'); igual(ano.alcool.validade, '2030-01-01');
    igual(R.calcular(C, '2028-02-28', []).alcool.validade, '2031-02-28');
    igual(R.calcular(C, '2026-10-30', []).vinhaca.validade, '2026-11-05');
  });
  await teste(grupo, 'médias das dornas são fallback; INPM ponderado pelo número de leituras', () => {
    const C = forms(), { registros } = exemplo(C);
    const v = R.calcular(C, DIA, registros.filter((r) => r.chave !== 'param'));
    igual(v.calculo.brixInicial, 20); igual(v.calculo.brixFinal, 12);
    igual(v.origem['calculo.brixInicial'], 'média de 9 dornas');
    perto(v.hidrolise.ph, (6 + 8 * 6.5) / 9); igual(v.hidrolise.brix, 20);
    perto(v.alcoolParam.inpm, (24 * 93 + 92) / 25);
    igual(v.hidrolise.temp, ''); igual(v.alcoolParam.gl, ''); igual(v.alcoolParam.acidez, '');
  });
  await teste(grupo, 'Brix zero medido prevalece; denominador zero deixa vinho vazio', () => {
    const C = forms(), { registros } = exemplo(C);
    const r = registros.find((r) => r.chave === 'param');
    r.valores.brix_hid = '0'; igual(R.calcular(C, DIA, registros).pi.vinho, 0);
    r.valores.brix_ferm = '0'; igual(R.calcular(C, DIA, registros).pi.vinho, '');
  });
  await teste(grupo, 'folgas seguem o terceiro elemento dos tanques, incluindo zero', () => {
    const v = exemplo(forms()).valores;
    igual(v.tanques.h1.folga, .5); igual(v.tanques.h2.folga, .25); igual(v.tanques.s1.folga, 0); igual(v.tanques.d11.folga, 1.25);
    igual(v.tanques.f1.folga, ''); igual(v.tanques.h1.ph, ''); igual(v.origem['tanques.f1.folga'], '');
  });
  await teste(grupo, 'insumos convertem mL/L e g/kg; copos e documentos distintos são preservados', () => {
    const v = exemplo(forms()).valores;
    igual(v.insumos.lphera, { qtd: 1.5, unidade: 'L', lote: 'L1 / L2', validade: '2027-10-01 / 2027-11-01', nf: '111 / 222', fornecedor: 'Empresa A / Empresa B' });
    igual(v.insumos.cal.qtd, 3); igual(v.insumos.cal.unidade, 'copos'); igual(v.insumos.ureia.qtd, 1.5); igual(v.insumos.ureia.unidade, 'kg');
    for (const k of ['amersite', 'cloro', 'soda']) igual(v.insumos[k].qtd, '');
  });
  await teste(grupo, 'matéria-prima agrupa produto, converte gramas e mantém NFs/fornecedores', () => {
    const C = forms(), rs = [reg('ins_materia_prima', '7', { produto: 'Milho', qtd: '1000', unidade: 'g', fornecedor: 'A', nf: '1' }),
      reg('ins_materia_prima', '8', { produto: 'Milho', qtd: '2', unidade: 'kg', fornecedor: 'B', nf: '1' }),
      reg('ins_materia_prima', '9', { tipo: 'Arroz', qtd: '4', unidade: 'kg' }), reg('ins_materia_prima', '10', { qtd: '5' })];
    const v = R.calcular(C, DIA, rs);
    igual(v.calculo.mpKg, 12); igual(v.mp[0], { produto: 'Milho', kg: 3, fornecedor: 'A / B', nf: '1' });
    igual(v.mp[1].produto, 'Arroz'); igual(v.mp[2].kg, 5);
  });
  await teste(grupo, 'não soma unidades incompatíveis nem trata entrada inválida como zero', () => {
    const C = forms(), rs = [reg('ins_lphera', '7', { qtd: '2', unidade: 'L' }), reg('ins_lphera', '8', { qtd: '2', unidade: 'kg' }),
      reg('hid_anexo1', '1', { brix: 'abc', phf: 'Infinity' }), reg('destilaria', '7', { producao: ' ', inpm: null })];
    const v = R.calcular(C, DIA, rs);
    igual(v.insumos.lphera.qtd, ''); igual(v.insumos.lphera.unidade, 'L / kg'); igual(v.hidrolise.brix, ''); igual(v.hidrolise.ph, ''); igual(v.alcool.producao, '');
  });
  await teste(grupo, 'ignora outros dias, apagados, totais/observações e fechamento anterior', () => {
    const C = forms(), rs = [reg('destilaria', '7', { producao: '10' }), reg('destilaria', '8', { producao: '999' }, { apagado: true }),
      reg('destilaria', '9', { producao: '999' }, { data: '2026-10-08' }), reg('destilaria', 'obs1', { producao: '999' }),
      reg('rastreamento', 'dia', { alcool: { producao: 999 } }, { operador: 'Escritório' })];
    const v = R.calcular(C, DIA, rs); igual(v.alcool.producao, 10); igual(v.operadores, ['Bruno']);
  });
  await teste(grupo, 'entradas não mudam e todo número calculado tem origem, inclusive zero', () => {
    const C = forms(), { registros } = exemplo(C), antes = JSON.stringify([C, registros]);
    const v = R.calcular(C, DIA, registros); igual(JSON.stringify([C, registros]), antes); igual(v.operadores, ['Bruno', 'Ricardo']);
    const visitar = (o, prefixo = '') => Object.entries(o).forEach(([k, n]) => {
      const campo = prefixo ? prefixo + '.' + k : k;
      if (typeof n === 'number') certo(v.origem[campo], 'sem origem: ' + campo);
      else if (n && typeof n === 'object') visitar(n, campo);
    });
    visitar(v);
  });
  await teste(grupo, 'dia vazio não inventa produção ou vinho; origens ausentes vazias', () => {
    const v = R.calcular(forms(), DIA, []);
    for (const campo of ['mpKg', 'brixInicial', 'brixFinal', 'alcoolDestilaria', 'alcoolNova']) { igual(v.calculo[campo], ''); igual(v.origem['calculo.' + campo], ''); }
    igual(v.pi, { hidrolise: '', vinho: '' }); igual(v.mp, []); igual(v.lenha, []); igual(v.operadores, []);
  });
  await teste(grupo, 'edição recalcula dependências e limpeza apaga resultado derivado', () => {
    const v = exemplo(forms()).valores;
    igual(R.recalcular(v, { campo: 'volumeDestilado', valor: '10000' }), v); igual(v.vinhaca.producao, 7400);
    R.recalcular(v, { 'alcool.producao': '3000' }); igual(v.vinhaca.producao, 7000);
    R.recalcular(v, { calculo: { mpKg: 2900, brixInicial: 20, brixFinal: 10 } }); igual(v.pi.hidrolise, 10000); igual(v.pi.vinho, 20000);
    R.recalcular(v, { campo: 'pi.hidrolise', valor: '5000' }); igual(v.pi.vinho, 10000);
    R.recalcular(v, { campo: 'calculo.brixFinal', valor: '' }); igual(v.pi.vinho, ''); igual(v.origem['pi.vinho'], '');
    R.recalcular(v, { campo: 'volumeDestilado', valor: '' }); igual(v.vinhaca.producao, '');
  });
  await teste(grupo, 'edição isolada preserva campos manuais e rejeita protótipos', () => {
    const v = exemplo(forms()).valores;
    R.recalcular(v, { campo: 'pi.hidrolise', valor: 100 });
    R.recalcular(v, { campo: 'encarregado', valor: 'Maria' }); igual(v.pi.hidrolise, 100);
    R.recalcular(v, { campo: '__proto__.poluido', valor: true }); igual({}.poluido, undefined);
    R.recalcular(v, { campo: 'calculo.fator', valor: 0 }); igual(v.pi.hidrolise, ''); igual(v.pi.vinho, '');
    R.recalcular(v, { campo: 'hidrolise.ph', valor: '6,25' }); igual(v.hidrolise.ph, 6.25);
  });
  await teste(grupo, 'etiqueta: 50 L = 40,45 kg líquido e 42,70 kg bruto; tara ausente fica vazia', () => {
    const C = forms(); igual(R.etiqueta(C, 50), { volume: 50, pesoLiquido: 40.45, pesoBruto: 42.7 });
    igual(R.etiqueta(C, '50'), R.etiqueta(C, 50)); igual(R.etiqueta(C, 20).pesoBruto, '');
    igual(R.etiqueta(C, '').pesoLiquido, ''); igual(R.etiqueta(C, -1).pesoLiquido, '');
  });
  await teste(grupo, 'modelo usa valores guardados e não recalcula com registros posteriores', () => {
    const C = forms(), v = exemplo(C).valores;
    v.alcool.producao = 1234.5; v.pi.vinho = 4321.25;
    const antes = JSON.stringify(v), a = ambiente(C, v, [reg('destilaria', '7', { producao: 9999 })]);
    const vs = Object.values(a.folha.grade.cel).map((x) => x.v);
    certo(vs.includes(1234.5) && vs.includes(4321.25), 'valores guardados no papel'); certo(!vs.includes(9999), 'não recalcula');
    igual(JSON.stringify(v), antes); igual(a.folha.paisagem, true);
    igual(ambiente(C).folha.dados.linhas.filter((l) => l.preenchida).length, 0);
  });
  await teste(grupo, 'grade mantém tanques à esquerda/insumos à direita sem mesclas sobrepostas', () => {
    const a = ambiente(forms(), exemplo(forms()).valores), g = a.folha.grade, ocupadas = new Set();
    for (const [r1, c1, r2, c2] of g.mesclas) {
      certo(r2 < g.linhas && c2 < g.larguras.length, 'mescla fora da grade');
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) { const k = r + ',' + c; certo(!ocupadas.has(k), 'mescla sobreposta ' + k); ocupadas.add(k); }
    }
    const pos = (texto) => Object.entries(g.cel).find(([, c]) => c.v === texto)[0].split(',').map(Number);
    certo(pos('LPHERA')[1] > pos('F1-7.5')[1], 'insumos do lado direito');
    certo(pos('MOAGEM DE MATÉRIA-PRIMA (MP)')[0] > pos('LPHERA')[0], 'MP abaixo dos insumos');
    certo(pos('D11-30')[1] < pos('LPHERA')[1], 'dornas à esquerda');
  });
  await teste(grupo, 'Excel numérico, HTML escapado e XML carregam lote e resultado guardados', async () => {
    const C = forms(), v = exemplo(C).valores; v.insumos.lphera.fornecedor = '<Empresa> & "A"';
    const { window: w, folha: f } = ambiente(C, v), m = w.ModelosPapel;
    const planilha = m.paraPlanilha(f), xlsx = await w.criarXlsx([planilha]).text();
    certo(planilha.rows.flat().some((c) => c.v === v.pi.vinho), 'célula numérica');
    certo(xlsx.includes('orientation="landscape"') && xlsx.includes('paperSize="9"'), 'A4 paisagem');
    certo(xlsx.includes(v.lote) && xlsx.includes('<v>1.5</v>'), 'lote e insumo no arquivo');
    const html = m.paraHtml(f, '', fmtNum);
    certo(/87\.?533,2/.test(html) && html.includes('UB26I080700'), 'vinho e lote no HTML: ' + (html.match(/87[.\d]*,\d/) || [''])[0]);
    certo(html.includes('&lt;Empresa&gt; &amp; &quot;A&quot;') && !html.includes('<Empresa>'), 'HTML escapado');
    const xml = m.paraXml(f, DIA, w.xmlEscape); certo(xml.includes(v.lote) && xml.includes('4321') === false, 'XML do fechamento');
  });
  await teste(grupo, 'PDF real de uma página A4 paisagem a partir da mesma grade', () => {
    const C = forms(), { window, folha } = ambiente(C, exemplo(C).valores);
    const b = Buffer.from(pdf(window, folha)), texto = b.toString('latin1');
    certo(texto.startsWith('%PDF-1.'), 'assinatura do PDF');
    igual((texto.match(/\/Type \/Page\b/g) || []).length, 1);
    certo(/\/MediaBox\s*\[0 0 841\.89 595\.28\]/.test(texto), 'A4 paisagem'); certo(b.length > 10000, 'fontes embutidas');
  });
  await teste(grupo, 'mais matérias-primas e lenhas ampliam linhas sem perder registros', () => {
    const C = forms(), v = exemplo(C).valores;
    v.mp = Array.from({ length: 6 }, (_, i) => ({ produto: 'Produto ' + i, kg: i, fornecedor: 'Fornecedor ' + i, nf: String(i) }));
    v.lenha = Array.from({ length: 4 }, (_, i) => ({ tipo: 'Lenha ' + i, m3: i, fornecedor: 'Madeireira ' + i }));
    const a = ambiente(C, v), html = a.window.ModelosPapel.paraHtml(a.folha, '', fmtNum);
    certo(html.includes('Produto 5') && html.includes('Lenha 3'), 'todas as linhas');
  });
}

/** Amostras opcionais em pasta temporária; nunca lê nem escreve dados/ da usina. */
export async function gravarAmostras() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usina-rastreamento213-'));
  const C = forms(), v = exemplo(C).valores;
  R.recalcular(v, { campo: 'volumeDestilado', valor: 10000 });
  const { window: w, folha: f } = ambiente(C, v);
  fs.writeFileSync(path.join(dir, 'rastreamento.pdf'), pdf(w, f));
  fs.writeFileSync(path.join(dir, 'rastreamento.xlsx'), Buffer.from(await w.criarXlsx([w.ModelosPapel.paraPlanilha(f)]).arrayBuffer()));
  const css = new URL('../public/styles.css', import.meta.url).href, logo = new URL('../public/icons/logo.png', import.meta.url).href;
  fs.writeFileSync(path.join(dir, 'rastreamento.html'), `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><link rel="stylesheet" href="${css}"><body class="ver-folhas"><div id="impressao">${w.ModelosPapel.paraHtml(f, logo, fmtNum)}</div></body></html>`);
  return dir;
}
