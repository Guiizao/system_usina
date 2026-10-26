/* 2.17.1: revogacao pessoal, migracao SQLite e saida do aplicativo sem depender da rede. */
import fs from 'node:fs';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { pbkdf2Sync, createHmac, timingSafeEqual } from 'node:crypto';
import worker from '../nuvem/src/index.js';
import { novoGrupo, teste, igual, certo, resumo } from './teste.mjs';

const g = novoGrupo('Sair 2.17.1 (Worker real, SQLite e aplicativo)');
const segredo = 'segredo-ficticio-sair2171', aparelho = 'pc-2171';
const db = new DatabaseSync(':memory:');
const schema = fs.readFileSync(new URL('../nuvem/schema.sql', import.meta.url), 'utf8');
// Banco 2.16 existente: reaplicar o schema duas vezes deve preservar a entrada antiga.
db.exec("CREATE TABLE acessos_nuvem (aparelho TEXT PRIMARY KEY, pessoa TEXT NOT NULL); INSERT INTO acessos_nuvem VALUES ('pc-legado', 'ana')");
db.exec(schema); db.exec(schema);
let antesDeRevogar;
const prepare = (sql, params = []) => ({
  bind: (...args) => prepare(sql, args),
  all: () => ({ results: db.prepare(sql).all(...params) }),
  first: () => db.prepare(sql).get(...params) || null,
  async run() {
    if (sql.startsWith('DELETE FROM acessos_nuvem') && antesDeRevogar) {
      const executar = antesDeRevogar; antesDeRevogar = null; await executar();
    }
    return db.prepare(sql).run(...params);
  },
});
const env = { SEGREDO_CENTRAL: segredo, TOKEN_LEITURA: 'leitura-geral-ficticia', DB: { prepare,
  async batch(consultas) {
    db.exec('BEGIN');
    try { const resultados = []; for (const c of consultas) resultados.push(await c.run()); db.exec('COMMIT'); return resultados; }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  },
} };
const anterior = crypto.subtle.timingSafeEqual;
crypto.subtle.timingSafeEqual = (a, b) => timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
const pedir = async (rota, { token = '', id = aparelho, corpo, metodo = 'POST' } = {}) => {
  const r = await worker.fetch(new Request('https://nuvem.exemplo' + rota, { method: metodo,
    headers: { Authorization: 'Bearer ' + token, 'X-Aparelho': id, 'CF-Connecting-IP': '192.0.2.1' },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  }), env);
  return { status: r.status, json: await r.json() };
};
const entrar = (id = aparelho) => pedir('/aparelho/entrar', { corpo: { pessoa: 'ana', pin: '4567', aparelho: id } });
const sync = (token, id = aparelho) => pedir('/aparelho/sync', { token, id, corpo: { registros: [] } });
const sair = (token, id = aparelho) => pedir('/aparelho/sair', { token, id });
const fonteApp = fs.readFileSync(new URL('../public/paginas/entrar-pela-nuvem.js', import.meta.url), 'utf8');
function aplicativo(token, fetchApp) {
  const ctx = { cfg: { nuvemUrl: 'https://nuvem.exemplo/', nuvemToken: token, deviceId: aparelho, pessoa: { id: 'ana' } },
    pilha: [], salvos: 0, renders: 0, document: { addEventListener() {} }, fetch: fetchApp, AbortController,
    setTimeout: (fn, ms) => { igual(ms, 8000); ctx.expirar = fn; return 1; }, clearTimeout: () => { ctx.expirar = null; },
    enderecoNuvemSeguro: (url) => url === 'https://nuvem.exemplo',
  };
  ctx.salvarCfg = () => ctx.salvos++; ctx.render = () => ctx.renders++;
  vm.createContext(ctx); vm.runInContext(fonteApp, ctx);
  return ctx;
}
let primeira, segunda;
try {
  await teste(g, 'schema reaplicado duas vezes conserva a entrada 2.16', async () => {
    igual(db.prepare("SELECT pessoa FROM acessos_nuvem WHERE aparelho = 'pc-legado'").get().pessoa, 'ana');
    const sal = 'a'.repeat(32);
    igual((await pedir('/central/enviar', { token: segredo, corpo: { registros: [], geracao: 'g2171', pessoas: [{
      id: 'ana', nome: 'Ana', nivel: 'consulta', ativo: true, funcoes: ['relatorios'],
      nuvem: { sal, iteracoes: 1000, verificador: pbkdf2Sync('4567', sal, 1000, 32, 'sha256').toString('hex') },
    }] } })).status, 200);
  });
  await teste(g, 'chave antiga 2.16 funciona, Sair revoga e nova entrada nao ressuscita a antiga', async () => {
    const p = JSON.parse(db.prepare("SELECT json FROM pessoas WHERE id = 'ana'").get().json);
    const antiga = createHmac('sha256', segredo).update(`leitura|pc-legado|ana|${p.nuvem.selado}`).digest('hex');
    igual((await sync(antiga, 'pc-legado')).status, 200);
    igual((await sair(antiga, 'pc-legado')).status, 200);
    igual((await sync(antiga, 'pc-legado')).status, 401);
    const nova = await entrar('pc-legado'); igual(nova.status, 200); certo(nova.json.token !== antiga);
    igual((await sync(nova.json.token, 'pc-legado')).status, 200);
    igual((await sync(antiga, 'pc-legado')).status, 401);
  });
  await teste(g, 'entrada pessoal funciona; Sair revoga a chave em sync e fila', async () => {
    primeira = await entrar(); igual(primeira.status, 200);
    igual((await sync(primeira.json.token)).status, 200);
    igual((await sair(primeira.json.token)).status, 200);
    igual((await sync(primeira.json.token)).status, 401);
    igual((await pedir('/fila', { token: primeira.json.token, corpo: { registros: [] } })).status, 401);
    igual((await sair(primeira.json.token)).status, 401);
  });
  await teste(g, 'entrar novamente emite outra chave valida; chave revogada continua em 401', async () => {
    segunda = await entrar(); igual(segunda.status, 200); certo(segunda.json.token !== primeira.json.token);
    igual((await sync(segunda.json.token)).status, 200); igual((await sync(primeira.json.token)).status, 401);
  });
  await teste(g, 'GET, credenciais gerais, tablet, aparelho errado e chave ausente nao revogam', async () => {
    igual((await pedir('/aparelho/sair', { metodo: 'GET', token: segunda.json.token })).status, 405);
    const tablet = createHmac('sha256', segredo).update('aparelho|' + aparelho).digest('hex');
    for (const token of ['', 'invalida', segredo, env.TOKEN_LEITURA, tablet]) igual((await sair(token)).status, 401);
    igual((await sair(segunda.json.token, 'outro-pc')).status, 401);
    igual((await sync(segunda.json.token)).status, 200);
  });
  await teste(g, 'sair de um aparelho conserva a sessao da mesma pessoa no outro', async () => {
    const outro = await entrar('outro-pc'); igual(outro.status, 200);
    igual((await sair(outro.json.token, 'outro-pc')).status, 200);
    igual((await sync(outro.json.token, 'outro-pc')).status, 401);
    igual((await sync(segunda.json.token)).status, 200);
  });
  await teste(g, 'saida autenticada antes de uma entrada concorrente nao apaga a sessao nova', async () => {
    let nova;
    antesDeRevogar = async () => { nova = await entrar(); igual(nova.status, 200); };
    igual((await sair(segunda.json.token)).status, 200);
    igual((await sync(segunda.json.token)).status, 401); igual((await sync(nova.json.token)).status, 200);
    igual((await sair(segunda.json.token)).status, 401); igual((await sync(nova.json.token)).status, 200);
    segunda = nova;
  });
  await teste(g, 'aplicativo real limpa estado e envia POST com a chave anterior; Worker a revoga', async () => {
    let pedido;
    const ctx = aplicativo(segunda.json.token, (url, opcoes) => {
      igual(url, 'https://nuvem.exemplo/aparelho/sair'); igual(opcoes.method, 'POST'); igual(opcoes.keepalive, true);
      igual(opcoes.headers.Authorization, 'Bearer ' + segunda.json.token); igual(opcoes.headers['X-Aparelho'], aparelho);
      pedido = worker.fetch(new Request(url, opcoes), env); return pedido;
    });
    ctx.sairDaNuvem();
    igual(ctx.cfg.nuvemToken, ''); igual(ctx.cfg.pessoa, null); igual(ctx.cfg.soNuvem, true);
    igual(ctx.salvos, 1); igual(ctx.renders, 1); igual(ctx.pilha[0].tela, 'nuvem-entrar');
    igual((await pedido).status, 200); igual((await sync(segunda.json.token)).status, 401);
  });
  await teste(g, 'sem internet o aplicativo sai imediatamente e absorve a falha da rede', async () => {
    let chamadas = 0;
    const ctx = aplicativo('chave-offline', () => { chamadas++; return Promise.reject(new Error('sem internet')); });
    ctx.sairDaNuvem(); igual(ctx.cfg.nuvemToken, ''); igual(ctx.cfg.pessoa, null);
    igual(ctx.pilha[0].tela, 'nuvem-entrar'); igual(ctx.salvos, 1); igual(ctx.renders, 1); igual(chamadas, 1);
    await new Promise((resolve) => setImmediate(resolve));
    ctx.sairDaNuvem(); igual(chamadas, 1);
  });
  await teste(g, 'rede pendurada nao atrasa a saida local e o pedido e abortado em oito segundos', async () => {
    let sinal;
    const ctx = aplicativo('chave-pendente', (url, opcoes) => {
      sinal = opcoes.signal;
      return new Promise((resolve, reject) => sinal.addEventListener('abort', () => reject(new Error('abortado'))));
    });
    igual(ctx.sairDaNuvem(), undefined); igual(ctx.cfg.nuvemToken, ''); igual(ctx.pilha[0].tela, 'nuvem-entrar');
    igual(sinal.aborted, false); ctx.expirar(); igual(sinal.aborted, true);
    await new Promise((resolve) => setImmediate(resolve)); igual(ctx.expirar, null);
  });
} finally {
  db.close();
  if (anterior) crypto.subtle.timingSafeEqual = anterior; else delete crypto.subtle.timingSafeEqual;
}
const r = resumo([g]); console.log(`\n${r.passaram} de ${r.total} testes passaram`); process.exitCode = r.falharam ? 1 : 0;
