/* Tarefa 1 da 3.1: prazo fixo na nuvem, inclusive na sala e no aparelho. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import { Sala } from '../nuvem/src/banco.js';
import { ligarNuvemSQLite } from './nuvem-sqlite.mjs';
import { ligarNuvem, temWrangler } from './nuvem.mjs';
import { abrirNavegador, TAMANHOS, dormir } from './navegador.mjs';
import { centralNode, pastaTemporaria } from './servidores.mjs';
import { novoGrupo, teste, certo, igual, resumo } from './teste.mjs';

const g = novoGrupo('Sessão pela nuvem (3.1)');
const SEGREDO = 'segredo-da-central-de-teste';
const token = (id) => crypto.createHmac('sha256', SEGREDO).update('aparelho|' + id).digest('hex');
const sal = '0123456789abcdef0123456789abcdef';
const pessoa = { id: 'p31', nome: 'Pessoa de teste', ativo: true, nivel: 'administrador', funcoes: ['relatorios', 'sistema'],
  nuvem: { sal, iteracoes: 1000, verificador: crypto.pbkdf2Sync('123456', sal, 1000, 32, 'sha256').toString('hex') } };
const preparar = (n) => n.pedir('/central/sincronia', { senha: SEGREDO, corpo: { pessoas: [pessoa], estado: {} } });
const entrar = (n, aparelho, extra = {}) => n.pedir('/aparelho/entrar', { corpo: { aparelho, pessoa: pessoa.id, pin: '123456', ...extra } });
const ler = (n, aparelho, senha) => n.pedir('/banco/api/dias', { aparelho, senha });
const n = await ligarNuvemSQLite(8571, SEGREDO, 'leitura-ficticia31');
try {
  await preparar(n);
  const diasDe = async (extra) => {
    const antes = Date.now(), r = await entrar(n, 'dias31', extra);
    igual(r.status, 200);
    certo(Number.isFinite(r.json.expira), 'faltou expira');
    const dias = Math.round((r.json.expira - antes) / 86400000);
    certo(Math.abs(r.json.expira - antes - dias * 86400000) < 3000, 'prazo em dias inteiros');
    return dias;
  };
  await teste(g, 'celular recebe 5 dias, pc 1, pc com lembrar 7, sem tipo 1', async () => {
    igual(await diasDe({ tipo: 'celular' }), 5); igual(await diasDe({ tipo: 'pc' }), 1);
    igual(await diasDe({ tipo: 'pc', lembrar: true }), 7); igual(await diasDe({}), 1);
    igual(await diasDe({ tipo: 'celular', lembrar: true }), 5);
    igual(await diasDe({ tipo: 'outro', lembrar: true }), 1);
  });
  await teste(g, 'configuração acima do teto vale 7 dias', async () => {
    const r = { id: 'config|sistema|geral', data: 'config', prancheta: 'sistema', chave: 'geral', valores: { sessaoNuvem: { celularDias: 30, pcDias: 0, lembrarDias: 3 } }, atualizadoEm: Date.now() };
    await n.pedir('/central/enviar', { senha: SEGREDO, corpo: { geracao: 'sessao31', registros: [r] } });
    igual(await diasDe({ tipo: 'celular' }), 7); igual(await diasDe({ tipo: 'pc' }), 1);
    igual(await diasDe({ tipo: 'pc', lembrar: true }), 3); igual(await diasDe({}), 1);
  });
  await teste(g, 'uso não renova o prazo e nova entrada invalida a chave anterior', async () => {
    const a = (await entrar(n, 'fixo31')).json;
    igual((await ler(n, 'fixo31', a.token)).status, 200);
    igual(n.consultar("SELECT expira FROM prazos_nuvem WHERE aparelho = 'fixo31'")[0].expira, a.expira);
    const b = (await entrar(n, 'fixo31')).json;
    igual((await ler(n, 'fixo31', a.token)).status, 401);
    igual((await ler(n, 'fixo31', b.token)).status, 200);
  });
  await teste(g, 'token vencido recebe 401', async () => {
    const r = await entrar(n, 'vence31');
    n.consultar("UPDATE prazos_nuvem SET expira = 1 WHERE aparelho = 'vence31'");
    igual((await ler(n, 'vence31', r.json.token)).status, 401);
    igual((await n.pedir('/aparelho/sync', { aparelho: 'vence31', senha: r.json.token, corpo: { registros: [] } })).status, 401);
  });
  await teste(g, 'sessão sem linha de prazo recebe 401', async () => {
    const r = await entrar(n, 'antiga31');
    n.consultar("DELETE FROM prazos_nuvem WHERE aparelho = 'antiga31'");
    igual((await ler(n, 'antiga31', r.json.token)).status, 401);
    n.consultar("DELETE FROM sessoes_nuvem WHERE aparelho = 'antiga31'");
    const p = JSON.parse(n.consultar("SELECT json FROM pessoas WHERE id = 'p31'")[0].json);
    const antiga = crypto.createHmac('sha256', SEGREDO).update(`leitura|antiga31|p31|${p.nuvem.selado}`).digest('hex');
    igual((await ler(n, 'antiga31', antiga)).status, 401);
  });
  await teste(g, 'tablet com token de aparelho não vence', async () => {
    igual((await ler(n, 'tablet31', token('tablet31'))).status, 200);
  });
  await teste(g, 'limites continuam: 6ª senha errada da mesma pessoa dá 429', async () => {
    n.consultar('DELETE FROM tentativas_entrada');
    for (let i = 0; i < 5; i++) igual((await entrar(n, 'erro31-' + i, { pin: '000000' })).status, 401);
    igual((await entrar(n, 'erro31-6', { pin: '000000' })).status, 429);
  });
  await teste(g, '429 informa esperaSegundos > 0', async () => {
    const r = await entrar(n, 'erro31-7', { pin: '000000' });
    igual(r.status, 429); certo(r.json.esperaSegundos > 0, 'faltou tempo de espera');
    certo(r.json.esperaSegundos <= 60, 'primeiro bloqueio dura um minuto');
  });
} finally { await n.desligar(); }

// Scripts comuns reais: verifica o relógio e a persistência mesmo sem navegador disponível.
const carregar = (ctx, arquivo) => vm.runInContext(fs.readFileSync(new URL('../public/' + arquivo, import.meta.url), 'utf8'), ctx);
const contexto = () => {
  const campos = { 'nuvem-nome': { value: 'p31' }, 'nuvem-senha': { value: '123456' }, 'nuvem-lembrar': { checked: true } };
  const ctx = vm.createContext({ Date, URLSearchParams, AbortController, setTimeout, clearTimeout,
    cfg: { soNuvem: true, papel: 'central', pessoa: { id: 'p31' }, pessoaTurno: 'anterior', nuvemExpira: Date.now() + 86400000, nuvemToken: 'teste' },
    NO_APK: false, matchMedia: () => ({ matches: false }),
    document: { addEventListener() {}, getElementById: (id) => campos[id] || null },
    C: { inicioDoDia: 7 }, ed: {}, pilha: [{ tela: 'central' }], registros: { teste: { valores: { pressao: '6' } } },
    sync: { modo: 'offline' }, redesenharDepois: false, rascunho: null, ultimoToque: Date.now(),
    ehCentral: () => true, ehEscritorio: () => false, turnoDaPessoa: () => 'atual',
    dataProducao: () => '2026-11-09', turnoAtual: () => ({ id: 'A' }), guardarRascunhoAberto() {}, rascunhoSujo: () => false,
    enderecoNuvemSeguro: () => true, salvarCfg() { ctx.salvo = JSON.stringify(ctx.cfg); },
    render() { ctx.desenhos = (ctx.desenhos || 0) + 1; }, toast(t) { ctx.aviso = t; },
    sairDoChefe() { ctx.cfg.pessoa = null; }, setInterval(fn) { ctx.tick = fn; },
    telaInicial: () => ({ tela: 'central' }), sincronizar() {}, conferirSessao() {},
    fetch: async () => ({ status: 200, ok: true, json: async () => ({ token: 'nova-chave', expira: 123456789, pessoa: { id: 'p31', nome: 'Teste' } }) }),
  });
  carregar(ctx, 'paginas/entrar-pela-nuvem.js');
  carregar(ctx, 'nucleo/operador.js'); carregar(ctx, 'nucleo/relogio.js');
  return ctx;
};
await teste(g, 'scripts reais: turno mantém sessão da nuvem e continua encerrando a local', async () => {
  const ctx = contexto();
  vm.runInContext('travarPorInatividade()', ctx); certo(ctx.cfg.pessoa);
  ctx.cfg.soNuvem = false; vm.runInContext('travarPorInatividade()', ctx); igual(ctx.cfg.pessoa, null);
});
await teste(g, 'scripts reais: relógio encerra uma vez, limpa prazo e conserva anotações offline', async () => {
  const ctx = contexto(), antes = JSON.stringify(ctx.registros);
  ctx.cfg.nuvemExpira = 1; ctx.cfg.nuvemToken = '';
  ctx.tick(); igual(ctx.pilha[0].tela, 'nuvem-entrar'); igual(ctx.cfg.pessoa, null); igual(ctx.cfg.nuvemExpira, null);
  igual(ctx.aviso, 'O prazo acabou: entre de novo com a sua senha'); igual(JSON.stringify(ctx.registros), antes);
  const desenhos = ctx.desenhos; ctx.tick(); ctx.tick(); igual(ctx.desenhos, desenhos);
});
await teste(g, 'scripts reais: login guarda expira e não guarda a senha; tipo respeita toque e APK', async () => {
  const ctx = contexto();
  vm.runInContext("nuvemForm.url = 'http://127.0.0.1:8571'", ctx);
  await vm.runInContext('entrarPelaNuvem()', ctx);
  igual(ctx.cfg.nuvemExpira, 123456789); igual(JSON.parse(ctx.salvo).nuvemToken, 'nova-chave');
  certo(!ctx.salvo.includes('123456"'), 'senha foi persistida');
  igual(vm.runInContext('tipoDoAparelho()', ctx), 'pc');
  ctx.matchMedia = () => ({ matches: true }); igual(vm.runInContext('tipoDoAparelho()', ctx), 'celular');
  ctx.matchMedia = () => ({ matches: false }); ctx.NO_APK = true; igual(vm.runInContext('tipoDoAparelho()', ctx), 'celular');
});

// A classe real, sem substituir sua lógica: relógio/prazos e entregas verificáveis sem workerd.
await teste(g, 'sala fecha conexão vencida e não repassa rascunho', async () => {
  const anterior = globalThis.WebSocketRequestResponsePair;
  globalThis.WebSocketRequestResponsePair = class {};
  try {
    const socket = (expira) => ({ expira, recebidas: [], codigo: null,
      deserializeAttachment() { return { aparelho: 'teste', expira: this.expira }; },
      close(codigo) { this.codigo = codigo; }, send(msg) { this.recebidas.push(msg); } });
    const vencida = socket(1), viva = socket(Date.now() + 60000), tablet = socket(0);
    let alarme;
    const sala = new Sala({ setWebSocketAutoResponse() {}, getWebSockets: () => [vencida, viva, tablet],
      storage: { setAlarm: async (em) => { alarme = em; }, deleteAlarm: async () => { alarme = null; } } });
    const msg = JSON.stringify({ tipo: 'rascunho', valores: { pressao: '6' } });
    sala.webSocketMessage(vencida, msg);
    igual(vencida.codigo, 4401); igual(viva.recebidas.length, 0);
    sala.webSocketMessage(tablet, msg);
    igual(vencida.recebidas.length, 0); igual(viva.recebidas.length, 1);
    await sala.fetch(new Request('https://sala/avisar', { method: 'POST', body: 'aviso' }));
    igual(vencida.recebidas.length, 0); igual(viva.recebidas.length, 2);
    await sala.alarm(); igual(alarme, viva.expira);
    viva.expira = 1; await sala.alarm(); igual(viva.codigo, 4401); igual(alarme, null); igual(tablet.codigo, null);
  } finally {
    if (anterior) globalThis.WebSocketRequestResponsePair = anterior; else delete globalThis.WebSocketRequestResponsePair;
  }
});

if (!process.argv.includes('--node') && !process.argv.includes('--sem-wrangler')) await teste(g, 'sala fecha conexão parada ao vencer, sem nenhuma mensagem', async () => {
  certo(temWrangler(), 'Wrangler não instalado');
  const w = await ligarNuvem(8572);
  let ws;
  try {
    await preparar(w);
    const r = await entrar(w, 'parada31'); igual(r.status, 200);
    w.consultar("UPDATE prazos_nuvem SET expira = " + (Date.now() + 2000) + " WHERE aparelho = 'parada31'");
    ws = new WebSocket(w.url.replace('http', 'ws') + '/banco/aovivo?a=parada31', ['pranchetas', r.json.token]);
    const codigo = await new Promise((resolve, reject) => {
      const tempo = setTimeout(() => reject(new Error('conexão parada não venceu em 15 s')), 15000);
      ws.onclose = (e) => { clearTimeout(tempo); resolve(e.code); };
      ws.onerror = () => { clearTimeout(tempo); reject(new Error('WebSocket recusado')); };
    });
    igual(codigo, 4401);
  } finally { if (ws) ws.close(); await w.desligar(); }
});

if (!process.argv.includes('--node')) {
let nav, c;
await teste(g, 'preparar navegador para os testes de sessão', async () => {
  nav = await abrirNavegador(); c = await centralNode(8573, pastaTemporaria('sessao31'));
});
const pagina = async (tamanho = TAMANHOS.computador) => {
  certo(nav && c, 'navegador indisponível');
  const a = await nav.novoAparelho('sessao31', tamanho);
  await a.ir(c.url + '/');
  await a.avaliar(`(() => {
    cfg.demo = false; cfg.soNuvem = true; cfg.papel = 'central'; cfg.chave = null;
    cfg.nuvemUrl = ''; cfg.nuvemToken = ''; cfg.nuvemExpira = Date.now() + 86400000;
    cfg.pessoa = { id: 'p31', nome: 'Teste', funcoes: ['relatorios', 'sistema'] }; cfg.pessoaTurno = turnoDaPessoa();
    nuvemForm.pessoas = [{ id: 'p31', nome: 'Teste' }]; nuvemForm.buscando = false;
    localStorage.setItem('usina.registros', JSON.stringify({ teste: { valores: { pressao: '6' } } }));
    return true;
  })()`);
  return a;
};
try {
  await teste(g, 'troca de turno não derruba quem entrou pela nuvem', async () => {
    const a = await pagina();
    try { certo(await a.avaliar('cfg.pessoaTurno = "turno-anterior"; travarPorInatividade(); !!cfg.pessoa')); }
    finally { await a.fechar(); }
  });
  await teste(g, 'prazo vencido volta para Entrar e mantém as anotações', async () => {
    const a = await pagina();
    try {
      const antes = await a.avaliar('localStorage.getItem("usina.registros")');
      await a.avaliar('cfg.nuvemExpira = 1');
      await a.esperar('view().tela === "nuvem-entrar" && !cfg.pessoa', 4000);
      igual(await a.avaliar('localStorage.getItem("usina.registros")'), antes);
      certo(await a.avaliar('!cfg.nuvemToken && !cfg.nuvemExpira'));
    } finally { await a.fechar(); }
  });
  await teste(g, 'depois de vencer, o formulário de entrar não é redesenhado', async () => {
    const a = await pagina();
    try {
      await a.avaliar('cfg.nuvemExpira = 1');
      await a.esperar('view().tela === "nuvem-entrar"', 4000);
      await a.avaliar('document.getElementById("nuvem-senha").value = "1234"');
      await dormir(3100);
      igual(await a.avaliar('document.getElementById("nuvem-senha").value'), '1234');
    } finally { await a.fechar(); }
  });
  for (const [nome, tamanho, tipo] of [['celular', TAMANHOS.celular, 'celular'], ['PC', TAMANHOS.computador, 'pc']]) {
    await teste(g, nome === 'celular' ? 'celular no navegador envia tipo celular e não mostra Lembrar' : 'PC mostra Lembrar e envia a escolha sem guardar senha', async () => {
      const a = await pagina(tamanho);
      try {
        const r = await a.avaliar(`(async () => {
          sairDaNuvem(); nuvemForm.url = 'http://127.0.0.1:8571';
          document.getElementById('nuvem-nome').value = 'p31'; document.getElementById('nuvem-senha').value = '123456';
          const lembrar = document.getElementById('nuvem-lembrar'); if (lembrar) lembrar.checked = true;
          const anterior = window.fetch; let corpo;
          window.fetch = async (url, op) => { corpo = JSON.parse(op.body); return { status: 429, json: async () => ({ esperaSegundos: 61 }) }; };
          try { await entrarPelaNuvem(); } finally { window.fetch = anterior; }
          return { corpo, lembrar: !!lembrar, texto: document.body.innerText, cfg: localStorage.getItem('usina.cfg') };
        })()`);
        igual(r.corpo.tipo, tipo); igual(r.lembrar, tipo === 'pc'); igual(r.corpo.lembrar, tipo === 'pc');
        certo(r.texto.includes('Muitas senhas erradas. Tente de novo em 2 min.'));
        certo(!r.cfg.includes('123456'), 'senha persistida');
      } finally { await a.fechar(); }
    });
  }
  await teste(g, 'prazos em Sistema: três campos de 1 a 7, somente com sistema', async () => {
    certo(nav && c, 'navegador indisponível');
    const a = await nav.novoAparelho('config31', TAMANHOS.tablet);
    try {
      await a.ir(c.url + '/?demo&papel=central&tela=config&cat=sistema');
      igual(await a.avaliar('document.querySelectorAll("[data-sessao-nuvem]").length'), 3);
      certo(await a.avaliar('[...document.querySelectorAll("[data-sessao-nuvem]")].every(e => e.options.length === 7 && e.options[0].value === "1" && e.options[6].value === "7")'));
      await a.avaliar('(() => { const e = document.querySelector("[data-sessao-nuvem=celularDias]"); e.value = "3"; e.dispatchEvent(new Event("change", { bubbles: true })); })()');
      igual(await a.avaliar('configSistema().sessaoNuvem.celularDias'), 3);
      await a.ir(c.url + '/?demo&papel=central&funcoes=usina,relatorios&tela=config&cat=sistema');
      igual(await a.avaliar('document.querySelectorAll("[data-sessao-nuvem]").length'), 0);
    } finally { await a.fechar(); }
  });
} finally { if (nav) await nav.fechar(); if (c) await c.desligar(); }
}
const { passaram, total, falharam } = resumo([g]);
console.log(`\n${passaram} de ${total} testes passaram; ${falharam} falharam`);
process.exitCode = falharam ? 1 : 0;
