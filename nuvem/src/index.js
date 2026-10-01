/* Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt). */
/*
 * Nuvem das Pranchetas (Cloudflare Workers, plano grátis).
 *
 * A central da usina (computador ou tablet chefe) manda uma cópia das anotações para cá pela internet.
 * Daqui sai a API só de leitura para o sistema do escritório (a mesma da central) e as atualizações do aplicativo.
 * A usina continua funcionando sem internet: a nuvem é só uma cópia.
 *
 *   POST /central/enviar     a central manda as anotações novas      (Authorization: Bearer <SEGREDO_CENTRAL>)
 *   GET  /central/estado     a central pergunta até onde a nuvem tem  (Authorization: Bearer <SEGREDO_CENTRAL>)
 *   GET  /api/v1/...         a API de leitura, igual à da central     (Authorization: Bearer <TOKEN_LEITURA>)
 *   GET  /atualizacao/...    versao.json e pranchetas.apk (arquivos da pasta publico, sem passar por aqui)
 *
 * Banco: D1 (SQLite). O plano grátis deixa 50 consultas por pedido, então cada envio grava tudo
 * numa consulta só (a lista inteira vai como um JSON e o próprio banco abre com json_each).
 */
import leitura from '../../api-leitura.js';

const FUSO = -180; // a usina fica em -03:00 (o Brasil não tem mais horário de verão)
const MAX_POR_ENVIO = 500;

const cabecalhos = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Cache-Control': 'no-store',
};
const responder = (status, corpo) => new Response(JSON.stringify(corpo), { status, headers: cabecalhos });

/** Compara o segredo sem deixar escapar pelo tempo de resposta. */
async function mesmoSegredo(recebido, certo) {
  if (!recebido || !certo) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(recebido)), crypto.subtle.digest('SHA-256', enc.encode(certo))]);
  return crypto.subtle.timingSafeEqual(a, b);
}
const senhaDoPedido = (req) => String(req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();

async function lerInfo(env) {
  const { results } = await env.DB.prepare('SELECT chave, valor FROM info').all();
  const info = {};
  results.forEach((l) => { info[l.chave] = l.valor; });
  return info;
}

/* ---------- a central manda as anotações ---------- */
async function receber(req, env) {
  let corpo;
  try { corpo = await req.json(); } catch (e) { return responder(400, { erro: 'JSON inválido' }); }
  const lista = Array.isArray(corpo.registros) ? corpo.registros : null;
  if (!lista || lista.length > MAX_POR_ENVIO) return responder(400, { erro: `mande de 0 a ${MAX_POR_ENVIO} anotações por vez` });
  // só o que pode sair: dia de produção e nada de avisos internos (a central já filtra; aqui confere de novo)
  const regs = lista.filter((r) => r && typeof r.id === 'string' && leitura.publica(r) && Number.isFinite(Number(r.seq)));
  const info = await lerInfo(env);
  const consultas = [];
  const geracao = String(corpo.geracao || '');
  // a central foi zerada (Apagar todos os dados do sistema) ou é outra central: a cópia começa de novo
  if (geracao && info.geracao && geracao !== info.geracao) {
    consultas.push(env.DB.prepare('DELETE FROM registros'), env.DB.prepare('DELETE FROM dias'));
  }
  const novasInfo = { geracao, ultimoEnvio: String(Date.now()) };
  if (corpo.forms && typeof corpo.forms === 'object') novasInfo.forms = JSON.stringify(corpo.forms);
  if ('medidas' in corpo) novasInfo.medidas = corpo.medidas ? JSON.stringify(corpo.medidas) : '';
  consultas.push(env.DB.prepare(`INSERT INTO info (chave, valor) SELECT key, value FROM json_each(?) WHERE true
    ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`).bind(JSON.stringify(novasInfo)));
  if (regs.length) {
    const texto = JSON.stringify(regs);
    consultas.push(env.DB.prepare(`INSERT INTO registros (id, data, prancheta, setor, chave, seq, atualizadoEm, apagado, json)
      SELECT json_extract(value, '$.id'), json_extract(value, '$.data'), json_extract(value, '$.prancheta'), json_extract(value, '$.setor'),
             json_extract(value, '$.chave'), json_extract(value, '$.seq'), json_extract(value, '$.atualizadoEm'),
             CASE WHEN json_extract(value, '$.apagado') THEN 1 ELSE 0 END, value
      FROM json_each(?) WHERE true
      ON CONFLICT(id) DO UPDATE SET data = excluded.data, prancheta = excluded.prancheta, setor = excluded.setor, chave = excluded.chave,
        seq = excluded.seq, atualizadoEm = excluded.atualizadoEm, apagado = excluded.apagado, json = excluded.json
      WHERE excluded.seq >= registros.seq`).bind(texto));
    // quantas anotações cada dia tem (a lista de dias não precisa ler o banco inteiro)
    const dias = JSON.stringify([...new Set(regs.map((r) => r.data))]);
    consultas.push(env.DB.prepare('UPDATE dias SET anotacoes = 0 WHERE data IN (SELECT value FROM json_each(?))').bind(dias));
    consultas.push(env.DB.prepare(`INSERT INTO dias (data, anotacoes)
      SELECT data, COUNT(*) FROM registros WHERE apagado = 0 AND data IN (SELECT value FROM json_each(?)) GROUP BY data
      ON CONFLICT(data) DO UPDATE SET anotacoes = excluded.anotacoes`).bind(dias));
  }
  await env.DB.batch(consultas);
  const maior = regs.reduce((m, r) => Math.max(m, Number(r.seq)), 0);
  return responder(200, { ok: true, recebidos: regs.length, seq: maior });
}

async function estado(env) {
  const info = await lerInfo(env);
  const linha = await env.DB.prepare('SELECT COUNT(*) AS n, MAX(seq) AS seq FROM registros').first();
  return responder(200, {
    geracao: info.geracao || '', ultimoEnvio: Number(info.ultimoEnvio) || 0, temForms: !!info.forms,
    registros: (linha && linha.n) || 0, seq: (linha && linha.seq) || 0,
  });
}

/* ---------- a API de leitura (a mesma da central, com os mesmos nomes) ---------- */
async function apiDeLeitura(url, env) {
  const info = await lerInfo(env);
  if (!info.forms) return responder(503, { erro: 'A central da usina ainda não mandou nada para a nuvem' });
  const C = JSON.parse(info.forms);
  const medidas = info.medidas ? JSON.parse(info.medidas) : null;
  const api = leitura.criar(C, () => medidas, { fusoMin: FUSO });
  const p = url.pathname;
  if (p === '/api/v1/esquema') return responder(200, api.esquema());
  if (p === '/api/v1/dias') {
    const de = url.searchParams.get('de'); const ate = url.searchParams.get('ate');
    const { results } = await env.DB.prepare('SELECT data, anotacoes FROM dias WHERE anotacoes > 0 AND data >= ? AND data <= ? ORDER BY data DESC')
      .bind(leitura.ehDia(de) ? de : '0000-00-00', leitura.ehDia(ate) ? ate : '9999-99-99').all();
    return responder(200, { dias: results.map((l) => ({ data: l.data, anotacoes: l.anotacoes })) });
  }
  const m = p.match(/^\/api\/v1\/dias\/(\d{4}-\d{2}-\d{2})$/);
  if (m) {
    const { results } = await env.DB.prepare('SELECT json FROM registros WHERE data = ?').bind(m[1]).all();
    return responder(200, api.dia(m[1], results.map((l) => JSON.parse(l.json))));
  }
  if (p === '/api/v1/registros') {
    const desde = Number(url.searchParams.get('desde') || 0) || 0;
    const limite = Math.min(2000, Math.max(1, Number(url.searchParams.get('limite') || 500) || 500));
    const { results } = await env.DB.prepare('SELECT json FROM registros WHERE seq > ? ORDER BY seq LIMIT ?').bind(desde, limite + 1).all();
    const lote = results.slice(0, limite).map((l) => JSON.parse(l.json));
    const ultimo = await env.DB.prepare('SELECT MAX(seq) AS seq FROM registros').first();
    return responder(200, { seq: lote.length ? lote[lote.length - 1].seq : (ultimo && ultimo.seq) || 0, maisDepois: results.length > limite, registros: lote.map(api.registro) });
  }
  return responder(404, { erro: 'rota desconhecida' });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cabecalhos });
    try {
      if (p === '/' || p === '') {
        return new Response('Nuvem das Pranchetas Digitais da Ubirálcool: no ar.\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      if (p.startsWith('/central/')) {
        if (!(await mesmoSegredo(senhaDoPedido(req), env.SEGREDO_CENTRAL))) return responder(401, { erro: 'Senha da central errada' });
        if (p === '/central/enviar' && req.method === 'POST') return await receber(req, env);
        if (p === '/central/estado' && req.method === 'GET') return await estado(env);
        return responder(404, { erro: 'rota desconhecida' });
      }
      if (p.startsWith('/api/v1/')) {
        if (req.method !== 'GET') return responder(405, { erro: 'A API é só de leitura: use GET' });
        if (!(await mesmoSegredo(senhaDoPedido(req), env.TOKEN_LEITURA))) {
          return responder(401, { erro: 'Senha de leitura errada ou faltando. Mande o cabeçalho Authorization: Bearer <senha>' });
        }
        return await apiDeLeitura(url, env);
      }
      return responder(404, { erro: 'não existe' });
    } catch (e) {
      return responder(500, { erro: 'erro na nuvem: ' + (e && e.message ? e.message : e) });
    }
  },
};
