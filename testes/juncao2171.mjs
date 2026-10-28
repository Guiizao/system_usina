/* 2.17.1: concorrência por campo nas duas centrais, Worker real/SQLite e aplicativo real. */
import fs from 'node:fs';
import vm from 'node:vm';
import { createHmac } from 'node:crypto';
import Juncao from '../public/nucleo/juncao.js';
import { centralNode, centralJava } from './servidores.mjs';
import { conectarTeste } from './cifra.mjs';
import { ligarNuvemSQLite } from './nuvem-sqlite.mjs';
import { novoGrupo, teste, igual, certo, resumo, SENHA_ENCARREGADO } from './teste.mjs';

const g = novoGrupo('Junção 2.17.1 (Node, Java, nuvem e aparelho)');
const dia = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const registro = (chave, data = dia) => ({ id: `${data}|caldeira|${chave}`, data, prancheta: 'caldeira', setor: 'caldeira', chave,
  criadoEm: 100, atualizadoEm: 100, aparelho: 'base', apagado: false, valores: { ph: '5', brix: '10' }, camposEm: { ph: 100, brix: 100 } });
const editar = (r, aparelho, campo, valor, em) => ({ ...r, aparelho, atualizadoEm: em,
  valores: { ...r.valores, [campo]: valor }, camposEm: { ...r.camposEm, [campo]: em } });
const fonte = (nome) => fs.readFileSync(new URL('../public/nucleo/' + nome, import.meta.url), 'utf8');
function aplicativo() {
  const ctx = vm.createContext({ registros: {}, cfg: { deviceId: 'a' }, setorDaPrancheta: () => ({ id: 'caldeira' }),
    salvarRegistros() {}, sincronizarLogo() {}, verificarLembrete() {}, PID_REGISTRO: 'registro', Juncao });
  vm.runInContext(fonte('registros.js'), ctx);
  return ctx;
}
await teste(g, 'aparelho marca só campo alterado, limpeza e mantém horários em gravações completas', () => {
  const c = aplicativo(), r = registro('8'); c.registros[r.id] = r;
  const a = c.gravar(dia, 'caldeira', '8', { ph: '6', brix: '10' });
  certo(a.camposEm.ph > 100); igual(a.camposEm.brix, 100);
  const b = c.gravar(dia, 'caldeira', '8', { ph: '', brix: '10' });
  igual(b.valores.ph, ''); certo(b.camposEm.ph > a.camposEm.ph); igual(b.camposEm.brix, 100);
  const d = c.gravar(dia, 'caldeira', '8', { ph: '', brix: '10' }); igual(d.camposEm, b.camposEm);
  c.apagar(dia, 'caldeira', '8'); certo(c.registros[r.id].atualizadoEm > d.atualizadoEm); certo(Juncao.valido(c.registros[r.id]));
});
await teste(g, 'primeira edição de linha antiga inicia horários; config continua sem camposEm', () => {
  const c = aplicativo(), r = registro('8'); delete r.camposEm; c.registros[r.id] = r;
  const a = c.gravar(dia, 'caldeira', '8', { ph: '' }); igual(a.camposEm.brix, 100); certo(a.camposEm.ph > 100);
  certo(!('camposEm' in c.gravar('config', 'sistema', 'geral', { nome: 'Usina' })));
});
await teste(g, 'salvar rascunho aberto antes de receber conserva os campos que a pessoa não tocou', () => {
  const c = aplicativo(), r = registro('8'); c.registros[r.id] = r;
  c.receberRegistro(editar(r, 'b', 'brix', '11', 300));
  const salvo = c.gravar(dia, 'caldeira', '8', { ph: '6', brix: '10' }, {}, r.valores);
  igual(salvo.valores, { ph: '6', brix: '11' }); igual(salvo.camposEm.brix, 300); certo(salvo.camposEm.ph > 300);
});
await teste(g, 'salvarRascunho real preserva chegada remota entre duas gravações da mesma tela', () => {
  const c = aplicativo();
  Object.assign(c, { view: () => ({ tela: 'prancheta', pid: 'caldeira' }), ehCentral: () => false,
    operadorAtual: () => 'Operador', prancheta: () => ({ tipo: 'grade', nome: 'Caldeira' }),
    vazio: (x) => x === '' || x == null, rotuloHora: () => '08:00', toast() {}, mudancasDoRascunho: () => [],
    rascunho: { data: dia, chave: '8', novo: true, valores: { ph: '5', brix: '10' }, original: {},
      extras: { operador: '' }, originalExtras: '{"operador":""}' },
  });
  vm.runInContext(fs.readFileSync(new URL('../public/paginas/prancheta.js', import.meta.url), 'utf8'), c);
  certo(c.salvarRascunho(false)); igual(c.rascunho.novo, false);
  const r = c.registros[`${dia}|caldeira|8`];
  c.receberRegistro(editar(r, 'b', 'brix', '11', r.atualizadoEm + 10));
  c.rascunho.valores.ph = '6'; certo(c.salvarRascunho(false));
  igual(c.registros[r.id].valores, { ph: '6', brix: '11' }); igual(c.rascunho.fonte, null);
});
await teste(g, 'rascunho limpo se atualiza quando chega campo novo sem mudar horário da linha', () => {
  const c = aplicativo(), r = registro('8');
  Object.assign(c, { operadorAtual: () => 'Operador', prancheta: () => ({ tipo: 'teste' }), rascunho: null,
    rascunhoSujo: () => false });
  c.registros[r.id] = editar(r, 'a', 'ph', '6', 300);
  vm.runInContext(fs.readFileSync(new URL('../public/paginas/prancheta.js', import.meta.url), 'utf8'), c);
  const v = { pid: 'caldeira', data: dia, chave: '8' };
  c.prepararRascunho(v); igual(c.rascunho.valores.brix, '10');
  c.receberRegistro(editar(r, 'b', 'brix', '11', 200)); igual(c.registros[r.id].atualizadoEm, 300);
  c.prepararRascunho(v); igual(c.rascunho.valores, { ph: '6', brix: '11' });
});
await teste(g, 'aparelho conserva mudança não enviada ao receber horário de linha maior, menor ou igual', () => {
  for (const em of [150, 200, 300]) {
    const c = aplicativo(), r = registro('8');
    c.registros[r.id] = { ...editar(r, 'a', 'ph', '6', 200), sincronizado: false, naNuvem: 200 };
    certo(c.receberRegistro(editar(r, 'b', 'brix', '11', em)));
    igual(c.registros[r.id].valores, { ph: '6', brix: '11' }); igual(c.registros[r.id].sincronizado, false);
    certo(!('naNuvem' in c.registros[r.id]));
  }
});
await teste(g, 'esperaEntrar permanece local, legado recebe linha inteira e apagado continua por linha', () => {
  const c = aplicativo(), r = registro('8');
  c.registros[r.id] = { ...editar(r, 'a', 'ph', '6', 200), esperaEntrar: true };
  igual(c.receberRegistro(editar(r, 'b', 'brix', '11', 300)), false); igual(c.registros[r.id].valores.ph, '6');
  delete c.registros[r.id].esperaEntrar;
  const velho = editar(r, 'b', 'brix', '12', 400); delete velho.camposEm;
  c.receberRegistro(velho); igual(c.registros[r.id].valores, velho.valores);
  c.receberRegistro({ ...r, apagado: true, atualizadoEm: 500 }); igual(c.registros[r.id].apagado, true);
});
await teste(g, 'empate converge nos dois sentidos, mesmo campo respeita hora e limpeza', () => {
  const r = registro('8'), a = editar(r, 'a', 'ph', '6', 200), b = editar(r, 'b', 'ph', '7', 200);
  igual(Juncao.juntar(a, b).valores, Juncao.juntar(b, a).valores);
  igual(Juncao.juntar(editar(r, 'a', 'ph', '', 300), b).valores.ph, '');
  igual(Juncao.juntar({ ...a, data: 'config' }, { ...b, data: 'config' }), null);
});
await teste(g, 'sincronizar real no Wi-Fi preserva edição durante o envio, inclusive horário igual', async () => {
  for (const delta of [0, 100]) {
    const c = aplicativo(), r = registro('8');
    Object.assign(c, { NO_APK: false, window: {}, errosGuardados: [], infoAparelho: {}, VERSAO: '2.17.1',
      nomeDesteAparelho: () => 'A', operadorAtual: () => '', salvarCfg() {}, versaoNaSincronizacao() {},
      conhecerCentralDoBloqueio() {},
      dataProducao: () => dia, somarDias: () => dia,
      ehCentral: () => false, LS: { set() {} }, view: () => ({ tela: 'outra' }), conferirNaNuvem() {},
      revisarAvisoNaTela() {}, verificarAvisos() {}, toast() {}, document: { getElementById: () => null },
    });
    c.cfg.chave = 'teste'; c.cfg.geracao = 'g'; c.registros[r.id] = { ...r, sincronizado: false };
    vm.runInContext(fonte('conexao.js'), c);
    c.primeiroDiaGuardado = () => dia; c.podar = () => {}; c.sincronizarLogo = () => {};
    let pedidos = 0;
    c.buscar = async (rota) => {
      pedidos++;
      if (rota === 'api/ping') return new Response(JSON.stringify({ app: 'pranchetas', cifra: true }));
      if (rota === 'api/sync') {
        c.gravar(dia, 'caldeira', '8', { ph: '6' }); // mudança enquanto o envio anterior está em voo
        return new Response(JSON.stringify({ ok: true, recusados: [], geracao: 'g' }));
      }
      if (rota.startsWith('api/registros')) {
        const remoto = editar(r, 'b', 'brix', '11', c.registros[r.id].atualizadoEm + delta);
        return new Response(JSON.stringify({ registros: [remoto], seq: 5 }));
      }
      throw new Error('rota inesperada: ' + rota);
    };
    await c.sincronizar();
    igual(pedidos, 3); igual(vm.runInContext('sync.modo', c), 'online'); igual(c.cfg.ultimoSeq, 5);
    igual(c.registros[r.id].valores, { ph: '6', brix: '11' }); igual(c.registros[r.id].sincronizado, false);
  }
});

const segredo = 'segredo-ficticio-juncao2171';
const n = await ligarNuvemSQLite(18371, segredo, 'leitura-ficticia-juncao2171');
const token = (aparelho) => createHmac('sha256', segredo).update('aparelho|' + aparelho).digest('hex');
const syncNuvem = (aparelho, registros = [], extra = {}) => n.pedir('/aparelho/sync', { aparelho, senha: token(aparelho), corpo: { registros, ...extra } });
const limparNuvem = () => { for (const tabela of ['pendentes', 'registros', 'dias', 'info', 'bloqueios']) n.consultar(`DELETE FROM ${tabela}`); };
try {
  await teste(g, 'nuvem junta campos de aparelhos diferentes e guarda originais para autorização da central', async () => {
    const r = registro('nuvem'), a = editar(r, 'a', 'ph', '6', 200), b = editar(r, 'b', 'brix', '11', 300);
    igual((await syncNuvem('a', [a])).status, 200); igual((await syncNuvem('b', [b])).status, 200);
    const d = (await syncNuvem('observador')).json; igual(d.registros.length, 1); igual(d.registros[0].valores, { ph: '6', brix: '11' });
    igual(d.registros[0].camposEm, { ph: 200, brix: 300 });
    const fila = (await n.pedir('/fila', { senha: segredo })).json.itens;
    igual(fila.length, 2); igual(fila.find(x => x.aparelho === 'b').registro.valores.ph, '5');
    const posterior = editar(b, 'b', 'ph', '', 400);
    await syncNuvem('b', [posterior]); igual((await syncNuvem('observador')).json.registros[0].valores.ph, '');
    igual((await syncNuvem('observador', [], { desdeOrdem: 3 })).json.registros, []);
  });
  await teste(g, 'nuvem mantém regra antiga sem camposEm e recusa horários inválidos', async () => {
    limparNuvem(); const r = registro('legado'); delete r.camposEm;
    await syncNuvem('a', [{ ...r, atualizadoEm: 200, valores: { ph: '6', brix: '10' } }]);
    await syncNuvem('b', [{ ...r, atualizadoEm: 300, valores: { ph: '5', brix: '11' } }]);
    igual((await syncNuvem('observador')).json.registros[0].valores, { ph: '5', brix: '11' });
    for (const camposEm of [null, [], { ph: '100' }, { ph: -1 }, { ph: 100.5 }, { ph: 101 }]) {
      igual((await syncNuvem('a', [{ ...registro('invalido'), camposEm }])).status, 400);
    }
  });
  for (const [nome, ligar, porta] of [['Node', centralNode, 18372], ['Java', centralJava, 18373]]) {
    if (process.argv.includes('--node') && nome === 'Java') continue;
    limparNuvem();
    const c = await ligar(porta);
    try {
      const a = await conectarTeste(c.url, c.codigo(), 'a'), b = await conectarTeste(c.url, c.codigo(), 'b');
      const enviar = async (cli, registros) => {
        const r = await cli.pedir('/api/sync', { corpo: { aparelho: cli.aparelho, papel: 'caldeira', registros } });
        igual(r.status, 200); igual(r.json.recusados, []); return r.json;
      };
      const ler = async (r) => (await c.api('/api/registros?dia=' + r.data)).registros.find(x => x.id === r.id);
      for (const data of [dia, '2020-01-01']) {
        await teste(g, `${nome}: mesma linha (${data}), campos diferentes e envio fora de ordem`, async () => {
          const r = registro('campos', data); await enviar(a, [r]);
          const ra = editar(r, 'a', 'ph', '6', 200), rb = editar(r, 'b', 'brix', '11', 300);
          await enviar(b, [rb]); await enviar(a, [ra]);
          const salvo = await ler(r); igual(salvo.valores, { ph: '6', brix: '11' }); igual(salvo.camposEm, { ph: 200, brix: 300 });
          await enviar(a, [ra]); igual((await ler(r)).valores, salvo.valores);
        });
      }
      await teste(g, `${nome}: mesmo campo usa horário do campo; limpar vence valor anterior`, async () => {
        const r = registro('mesmo');
        await enviar(a, [editar(r, 'a', 'ph', '6', 200)]);
        const velho = { ...editar(r, 'b', 'ph', '7', 150), atualizadoEm: 400, camposEm: { ph: 150, brix: 400 } };
        await enviar(b, [velho]); igual((await ler(r)).valores.ph, '6');
        await enviar(b, [editar(r, 'b', 'ph', '', 300)]); igual((await ler(r)).valores.ph, '');
        await enviar(a, [editar(r, 'a', 'ph', '8', 250)]); igual((await ler(r)).valores.ph, '');
      });
      await teste(g, `${nome}: empate numérico converge independentemente da ordem de chegada`, async () => {
        for (const ordem of [[1, 10], [10, 1]]) {
          const r = registro('empate-' + ordem[0]);
          await enviar(a, [editar(r, 'a', 'ph', ordem[0], 200)]);
          await enviar(b, [editar(r, 'b', 'ph', ordem[1], 200)]);
          igual((await ler(r)).valores.ph, 10);
        }
      });
      await teste(g, `${nome}: legado preserva substituição da linha e junção de criações independentes`, async () => {
        const r = registro('legado'); delete r.camposEm;
        await enviar(a, [{ ...r, aparelho: 'a', atualizadoEm: 200, valores: { ph: '6', brix: '10' } }]);
        await enviar(b, [{ ...r, aparelho: 'b', atualizadoEm: 300, valores: { ph: '5', brix: '11' } }]);
        igual((await ler(r)).valores, { ph: '5', brix: '11' });
        await enviar(a, [{ ...r, aparelho: 'a', criadoEm: 150, atualizadoEm: 400, valores: { ph: '', brix: '12' } }]);
        igual((await ler(r)).valores, { ph: '5', brix: '12' });
        await enviar(b, [{ ...registro('legado'), criadoEm: 175, atualizadoEm: 500 }]);
        certo(!('camposEm' in await ler(r)), 'mescla legada não inventa relógios por campo');
      });
      await teste(g, `${nome}: horário protegido do escritório não impede novo campo válido do setor`, async () => {
        const r = { ...registro('8'), id: `${dia}|ins_cal|8`, prancheta: 'ins_cal', valores: { qtd: '1', nf: 'protegida' },
          camposEm: { qtd: 100, nf: 1000 }, atualizadoEm: 1000 };
        igual((await c.api('/api/sync', { registros: [r] })).recusados, []);
        const hid = await conectarTeste(c.url, c.codigo(), 'hid');
        const novo = { ...r, aparelho: 'hid', atualizadoEm: 300, valores: { qtd: '2', nf: 'forjada' }, camposEm: { qtd: 300, nf: 300 } };
        const s = await hid.pedir('/api/sync', { corpo: { papel: 'hidrolise', registros: [novo] } });
        igual(s.json.recusados, []); const salvo = await ler(r);
        igual(salvo.valores, { qtd: '2', nf: 'protegida' }); igual(salvo.camposEm, { qtd: 300, nf: 1000 });
      });
      await teste(g, `${nome}: apagado decide por linha e metadados inválidos são recusados`, async () => {
        const r = registro('apagado'); await enviar(a, [r]);
        await enviar(b, [{ ...r, apagado: true, atualizadoEm: 300 }]);
        await enviar(a, [editar(r, 'a', 'ph', '6', 200)]); igual((await ler(r)).apagado, true);
        for (const camposEm of [null, [], { ph: '100' }, { ph: -1 }, { ph: 100.5 }, { ph: 101 }]) {
          const erro = await a.pedir('/api/sync', { corpo: { papel: 'caldeira', registros: [{ ...registro('invalido'), camposEm }] } });
          igual(erro.json.recusados[0].motivo, 'invalido');
        }
      });
      await teste(g, `${nome}: central volta, junta pendências e publica a mesma linha para todos`, async () => {
        const r = registro('volta'); await enviar(a, [r]); await enviar(b, []);
        await c.api('/api/chefes', { acao: 'liberar', pin: SENHA_ENCARREGADO, nivel: 3 });
        await c.api('/api/pessoas', { acao: 'entrar', pin: SENHA_ENCARREGADO });
        await c.api('/api/nuvem', { acao: 'configurar', url: n.url, segredo });
        await c.api('/api/nuvem', { acao: 'enviar' });
        await syncNuvem('a', [editar(r, 'a', 'ph', '6', 200)]); await syncNuvem('b', [editar(r, 'b', 'brix', '11', 300)]);
        for (let i = 0; i < 3; i++) await c.api('/api/nuvem', { acao: 'enviar' });
        igual((await ler(r)).valores, { ph: '6', brix: '11' });
        igual((await syncNuvem('observador')).json.registros.find(x => x.id === r.id).valores, { ph: '6', brix: '11' });
        igual((await n.pedir('/fila', { senha: segredo })).json.itens.length, 0);
      });
      await teste(g, `${nome}: correção da central desfaz campos de pendência recusada já recebida`, async () => {
        const r = registro('recusa'); await enviar(a, [r]);
        await c.api('/api/nuvem', { acao: 'enviar' });
        await c.api('/api/aparelhos', { acao: 'bloquear', id: 'b', modo: 'trava' });
        const ruim = editar(editar(r, 'b', 'intruso', 'novo', 500), 'b', 'ph', '99', 600);
        igual((await n.pedir('/fila', { aparelho: 'b', senha: token('b'), corpo: { registros: [ruim] } })).status, 200);
        const app = aplicativo(); app.registros[r.id] = { ...ruim, sincronizado: true };
        for (let i = 0; i < 3; i++) await c.api('/api/nuvem', { acao: 'enviar' });
        const corrigido = (await syncNuvem('observador')).json.registros.find(x => x.id === r.id);
        certo(corrigido.camposEm.ph > ruim.camposEm.ph); app.receberRegistro(corrigido);
        igual(app.registros[r.id].valores, r.valores); certo(!('intruso' in app.registros[r.id].valores));
        await c.api('/api/aparelhos', { acao: 'desbloquear', id: 'b' });
      });
      await teste(g, `${nome}: pendência recusada antes da válida não carimba campo intacto`, async () => {
        const r = registro('recusa-parcial'); await enviar(a, [r]);
        await c.api('/api/aparelhos', { acao: 'bloquear', id: 'b', modo: 'trava' });
        await n.pedir('/fila', { aparelho: 'b', senha: token('b'), corpo: { registros: [editar(r, 'b', 'brix', '99', 300)] } });
        await syncNuvem('a', [editar(r, 'a', 'ph', '6', 200)]);
        for (let i = 0; i < 3; i++) await c.api('/api/nuvem', { acao: 'enviar' });
        igual((await ler(r)).valores, { ph: '6', brix: '10' }); igual((await ler(r)).camposEm.ph, 200);
        await c.api('/api/aparelhos', { acao: 'desbloquear', id: 'b' });
      });
      await teste(g, `${nome}: campos persistem após reiniciar`, async () => {
        await c.reiniciar(); const r = await ler(registro('campos'));
        igual(r.valores, { ph: '6', brix: '11' }); igual(r.camposEm, { ph: 200, brix: 300 });
      });
    } finally { await c.desligar(); }
  }
} finally { await n.desligar(); }
const r = resumo([g]); console.log(`\n${r.passaram} de ${r.total} testes passaram`); process.exitCode = r.falharam ? 1 : 0;
