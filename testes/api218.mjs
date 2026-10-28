/* 2.18: kg no período/Base44/API e rastreamento salvo no Node e Worker real com SQLite. */
import fs from 'node:fs';
import vm from 'node:vm';
import leitura from '../api-leitura.js';
import { centralNode, pastaTemporaria } from './servidores.mjs';
import { ligarNuvemSQLite } from './nuvem-sqlite.mjs';
import { teste, certo, igual, novoGrupo, resumo, usinaNoContexto } from './teste.mjs';

const g = novoGrupo('API e totais 2.18');
const ctx = { window: {} }; usinaNoContexto(ctx);
const C = JSON.parse(JSON.stringify(ctx.window.USINA)), api = leitura.criar(C);
const dias = Array.from({ length: 5 }, (_, i) => new Date(Date.now() - (5 - i) * 86400000).toISOString().slice(0, 10));
let seq = 0;
const reg = (data, prancheta, chave, valores, extra = {}) => ({ id: `${data}|${prancheta}|${chave}`, data, prancheta, chave, valores,
  atualizadoEm: Date.now() + seq, seq: ++seq, operador: 'Lucas', ...extra });
const rastreio = { fechamento: dias[4], lote: 'UB218', alcool: { producao: 3730, lote: 'A218', validade: '2029-10-28' },
  vinhaca: { producao: 1270, lote: 'V218', validade: '2026-11-02' }, volumeDestilado: 5000,
  pi: { hidrolise: 4685.5, vinho: 10222.9 }, insumos: { cal: { qtd: 2.04, unidade: 'kg', lote: 'L218', nf: '987', validade: '2027-01-01' } },
  salvoPor: 'Lucas', salvoEm: Date.now(), origem: { volumeDestilado: 'digitado no Escritório' } };
const regs = dias.flatMap(d => [reg(d, 'ins_cal', '8', { qtd: '3', unidade: 'copos' }), reg(d, 'ins_ureia', '17', { qtd: '2', unidade: 'canecas' }),
  reg(d, 'ins_ureia', '18', { qtd: '0.5', unidade: 'kg' }), reg(d, 'ins_cal', 'meta', { lote: 'L218', verificado: 'Lucas' }),
  reg(d, 'ins_cal', '19', { qtd: '999' }, { apagado: true }), reg(d, 'rastreamento', 'dia', rastreio)]);
const intervalo = { de: dias[0], ate: dias[4], dias };
const totais = api.totais(intervalo, regs);
const app = vm.createContext({ C, setores: () => C.setores, folhasDe: (pid) => C.pranchetas[pid].partes?.map(p => p.prancheta) || [pid],
  prancheta: pid => C.pranchetas[pid], linhasDeHora: lista => lista.filter(r => !r.apagado && /^\d+$/.test(r.chave)),
  listar: (d, pid) => regs.filter(r => r.data === d && r.prancheta === pid) });
vm.runInContext(fs.readFileSync(new URL('../public/chefe/base44.js', import.meta.url), 'utf8'), app);

await teste(g, 'X5: Base44 e aba Totais/período de cinco dias usam 10,20 kg de cal e 10,30 kg de uréia', async () => {
  const itens = dias.flatMap(d => app.totaisDoDia(d));
  for (const [pid, valor] of [['ins_cal', 10.2], ['ins_ureia', 10.3]]) {
    const linhas = itens.filter(x => x.folha === pid);
    certo(linhas.every(x => x.unidade === 'kg'), pid + ' em kg');
    igual(Math.round(linhas.reduce((s, x) => s + x.quantidade, 0) * 100) / 100, valor);
    igual(totais.total.insumos.find(x => x.prancheta === pid).quantidade, valor);
  }
});
await teste(g, 'X5: /dias soma em kg e preserva copos/canecas nas anotações originais', async () => {
  const d = api.dia(dias[0], regs.filter(r => r.data === dias[0]));
  const folhas = d.setores.flatMap(s => s.pranchetas);
  igual(folhas.find(p => p.id === 'ins_cal').total, [{ quantidade: 2.04, unidade: 'kg' }]);
  igual(folhas.find(p => p.id === 'ins_ureia').total, [{ quantidade: 2.06, unidade: 'kg' }]);
  igual(folhas.find(p => p.id === 'ins_cal').linhas[0].unidade, 'copos');
  igual(folhas.find(p => p.id === 'ins_cal').linhas[0].quantidade, 3);
  igual(api.dia('2026-01-01', []).totais.insumos.find(i => i.prancheta === 'ins_cal').unidade, 'kg');
  igual(app.totaisDoDia('2026-01-01').find(i => i.folha === 'ins_cal').unidade, 'kg');
});
await teste(g, 'X5: esquema documenta o fator 0,68 e 0,78; uréia antiga sem unidade continua kg', async () => {
  const ps = api.esquema().setores.flatMap(s => s.pranchetas);
  igual(ps.find(p => p.id === 'ins_cal').conversoesDosTotais.copos, { unidade: 'kg', fator: 0.68 });
  igual(ps.find(p => p.id === 'ins_ureia').conversoesDosTotais.canecas, { unidade: 'kg', fator: 0.78 });
  const d = api.dia(dias[0], [reg(dias[0], 'ins_ureia', '8', { qtd: '1' })]);
  igual(d.totais.insumos.find(i => i.prancheta === 'ins_ureia').quantidade, 1);
});
await teste(g, 'X6: API conserva o rastreamento salvo sem recalcular e distingue ausente de apagado', async () => {
  igual(api.registro(regs.find(r => r.prancheta === 'rastreamento')).campos, rastreio);
  igual(api.dia(dias[0], regs.filter(r => r.data === dias[0])).rastreamento[0].campos, rastreio);
  igual(api.dia(dias[0], []).rastreamento, []);
  const apagado = reg(dias[0], 'rastreamento', 'dia', rastreio, { apagado: true });
  igual(api.dia(dias[0], [apagado]).rastreamento, []);
  igual(api.registro(apagado).apagado, true);
  const campos = api.esquema().rastreamento.campos;
  for (const chave of ['lote', 'alcool', 'vinhaca', 'volumeDestilado', 'pi', 'insumos']) certo(campos[chave], 'esquema de ' + chave);
});

const token = 'leitura-ficticia218', segredo = 'central-ficticia218';
const c = await centralNode(18283, pastaTemporaria('api218'), undefined, { TOKEN_LEITURA: token });
const n = await ligarNuvemSQLite(18284, segredo, token);
try {
  const s = await c.api('/api/sync', { papel: 'central', registros: regs });
  igual(s.aceitos, regs.length, JSON.stringify(s));
  igual((await n.pedir('/central/enviar', { senha: segredo, corpo: { registros: regs, forms: C, geracao: 'api218' } })).status, 200);
  for (const [nome, url] of [['Node', c.url], ['Worker/SQLite', n.url]]) {
    const get = async rota => { const r = await fetch(url + '/api/v1/' + rota, { headers: { Authorization: 'Bearer ' + token } }); igual(r.status, 200); return r.json(); };
    await teste(g, `${nome}: /dias e /totais concordam em kg`, async () => {
      const d = await get('dias/' + dias[0]), t = await get('totais?dia=' + dias[0]);
      for (const pid of ['ins_cal', 'ins_ureia']) {
        const folha = d.setores.flatMap(s => s.pranchetas).find(p => p.id === pid);
        const total = t.total.insumos.find(p => p.prancheta === pid);
        igual(folha.total, [{ quantidade: total.quantidade, unidade: 'kg' }]);
      }
    });
    await teste(g, `${nome}: /registros e /dias expõem lote, validade, produções e volumes`, async () => {
      const r = await get('registros'), d = await get('dias/' + dias[0]);
      igual(r.registros.find(x => x.prancheta === 'rastreamento').campos, rastreio);
      igual(d.rastreamento[0].campos, rastreio);
    });
    await teste(g, `${nome}: /esquema descreve rastreamento e conversão, sem senha pública`, async () => {
      const e = await get('esquema');
      igual(e.rastreamento.campos.pi, { hidrolise: 'L', vinho: 'L' });
      igual(e.setores.flatMap(s => s.pranchetas).find(p => p.id === 'ins_cal').conversoesDosTotais.copos.fator, 0.68);
      certo(!JSON.stringify(e).includes('159357'), 'sem senha');
    });
  }
} finally { await c.desligar(); await n.desligar(); }
const r = resumo([g]); console.log(`\n${r.passaram} de ${r.total} testes passaram`); process.exitCode = r.falharam ? 1 : 0;
