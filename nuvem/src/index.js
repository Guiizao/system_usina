/* Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt). */
/*
 * Nuvem das Pranchetas (Cloudflare Workers, plano grátis).
 *
 * A central da usina (computador ou tablet chefe) manda uma cópia das anotações para cá pela internet.
 * Daqui sai a API só de leitura para o sistema do escritório (a mesma da central) e as atualizações do aplicativo.
 * Sem a central, os aparelhos trocam pendências pela nuvem; a central confere quando volta.
 *
 *   POST /aparelho/sync      os aparelhos enviam e puxam anotações   (X-Aparelho + Bearer HMAC)
 *   POST /central/enviar     a central manda as anotações novas      (Authorization: Bearer <SEGREDO_CENTRAL>)
 *   GET  /central/estado     a central pergunta até onde a nuvem tem  (Authorization: Bearer <SEGREDO_CENTRAL>)
 *   GET  /api/v1/...         a API de leitura, igual à da central     (Authorization: Bearer <TOKEN_LEITURA>)
 *   GET  /aparelho/<id>      o aplicativo pergunta se este aparelho foi bloqueado (sem senha; responde só sobre ele)
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
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Aparelho',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store',
};
// banco de uma nuvem da 2.10: as folhas guardadas podiam ter a senha do administrador
const TIRAR_PIN_ANTIGO = "UPDATE info SET valor = json_remove(valor, '$.pinAdmin') WHERE chave = 'forms' AND json_valid(valor) AND json_extract(valor, '$.pinAdmin') IS NOT NULL";
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

/* ---------- fila dos aparelhos longe da central (2.13) ----------
 * POST /fila: { registros, geracao? }, X-Aparelho + Bearer HMAC em hexadecimal.
 * GET /fila: { itens: [{ aparelho, geracao, registro }] }, segredo da central.
 * POST /fila/confirmar: { itens: [{ aparelho, id, atualizadoEm }] }, segredo da central.
 * Só a central decide permissões e publica as anotações na API de leitura.
 */
const MAX_FILA_BYTES = 1024 * 1024;
const idAparelho = (id) => typeof id === 'string' && /^[\w.-]{1,80}$/.test(id);
async function tokenDoAparelho(segredo, aparelho) {
  const enc = new TextEncoder();
  const chave = await crypto.subtle.importKey('raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', chave, enc.encode('aparelho|' + aparelho)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
/** Limita os bytes recebidos também quando não há Content-Length. */
async function corpoFila(req) {
  if (Number(req.headers.get('Content-Length')) > MAX_FILA_BYTES) throw 413;
  const leitor = req.body && req.body.getReader();
  if (!leitor) throw 400;
  const partes = []; let tamanho = 0;
  while (true) {
    const { done, value } = await leitor.read();
    if (done) break;
    tamanho += value.byteLength;
    if (tamanho > MAX_FILA_BYTES) { await leitor.cancel(); throw 413; }
    partes.push(value);
  }
  const bytes = new Uint8Array(tamanho); let pos = 0;
  for (const parte of partes) { bytes.set(parte, pos); pos += parte.byteLength; }
  let corpo;
  try { corpo = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw 400; }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) throw 400;
  return corpo;
}
async function fila(req, env, confirmar, sync = false) {
  if (sync && req.method !== 'POST') return responder(405, { erro: 'Use POST' });
  const aparelho = req.headers.get('X-Aparelho');
  const envio = !confirmar && req.method === 'POST';
  const senha = envio && idAparelho(aparelho) && env.SEGREDO_CENTRAL ? await tokenDoAparelho(env.SEGREDO_CENTRAL, aparelho) : envio ? '' : env.SEGREDO_CENTRAL;
  if (!(await mesmoSegredo(senhaDoPedido(req), senha))) return responder(401, { erro: 'Credencial da fila inválida' });
  if (!confirmar && req.method === 'GET') {
    // Lotes de até 150 e 1 MB; nem uma fila grande faz a central baixar tudo de uma vez.
    const { results } = await env.DB.prepare(`WITH lote AS (SELECT rowid AS posicao, * FROM pendentes ORDER BY rowid LIMIT 150),
      tamanhos AS (SELECT *, SUM(length(CAST(json AS BLOB))) OVER (ORDER BY posicao) AS bytes FROM lote)
      SELECT aparelho, geracao, json FROM tamanhos WHERE bytes <= ? ORDER BY posicao`).bind(MAX_FILA_BYTES).all();
    return responder(200, { itens: results.map((r) => ({ aparelho: r.aparelho, geracao: r.geracao, registro: JSON.parse(r.json) })) });
  }
  if (req.method !== 'POST') return responder(405, { erro: 'Use GET ou POST' });
  let corpo;
  try { corpo = await corpoFila(req); } catch (status) { return responder(status === 413 ? 413 : 400, { erro: status === 413 ? 'Máximo de 1 MB por envio' : 'JSON inválido' }); }
  const lista = confirmar ? corpo.itens : corpo.registros;
  if (!Array.isArray(lista) || lista.length > MAX_POR_ENVIO) return responder(400, { erro: 'Máximo de 500 anotações por envio' });
  if (confirmar) {
    if (lista.some((r) => !r || !idAparelho(r.aparelho) || typeof r.id !== 'string' || !Number.isSafeInteger(r.atualizadoEm))) return responder(400, { erro: 'Confirmação inválida' });
    // O horário faz parte da confirmação: não apaga uma versão posterior ao GET.
    await env.DB.prepare(`DELETE FROM pendentes WHERE (aparelho, id, atualizadoEm) IN
      (SELECT json_extract(value, '$.aparelho'), json_extract(value, '$.id'), json_extract(value, '$.atualizadoEm') FROM json_each(?))`).bind(JSON.stringify(lista)).run();
    return responder(200, { ok: true });
  }
  if (corpo.geracao !== undefined && (typeof corpo.geracao !== 'string' || corpo.geracao.length > 100)) return responder(400, { erro: 'Geração inválida' });
  if (lista.some((r) => !r || typeof r.id !== 'string' || r.id.length > 300 || typeof r.data !== 'string' || typeof r.prancheta !== 'string' || typeof r.chave !== 'string'
    || r.id !== `${r.data}|${r.prancheta}|${r.chave}` || !(r.data === 'config' || leitura.ehDia(r.data))
    || !Number.isSafeInteger(r.atualizadoEm) || r.atualizadoEm < 0)) return responder(400, { erro: 'Anotação inválida' });
  if (sync) {
    if (['desdeSeq', 'desdeOrdem'].some((k) => corpo[k] !== undefined && (!Number.isSafeInteger(corpo[k]) || corpo[k] < 0))
      || (corpo.desdeDia !== undefined && !leitura.ehDia(corpo.desdeDia))) return responder(400, { erro: 'Cursor inválido' });
    const estado = await env.DB.prepare("SELECT (SELECT json FROM bloqueios WHERE id = ?) AS bloqueio, (SELECT valor FROM info WHERE chave = 'geracao') AS geracao").bind(aparelho).first();
    if (estado.bloqueio) return responder(423, { erro: 'bloqueado' });
    if (corpo.geracao && estado.geracao && corpo.geracao !== estado.geracao) return responder(409, { geracao: estado.geracao });
  }
  if (lista.length) await gravarPendentes(env, aparelho, corpo.geracao || '', lista);
  if (sync) return puxarAparelho(env, aparelho, corpo);
  return responder(200, { ok: true, recebidos: lista.length });
}

/** Reserva uma faixa por lote na mesma transação; cada item tem seu próprio cursor. */
async function gravarPendentes(env, aparelho, geracao, lista) {
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO info (chave, valor) VALUES ('ordemPendentes', ?)
      ON CONFLICT(chave) DO UPDATE SET valor = CAST(info.valor AS INTEGER) + excluded.valor`).bind(lista.length),
    env.DB.prepare(`INSERT INTO pendentes (aparelho, id, atualizadoEm, geracao, ordem, json)
      SELECT ?, json_extract(value, '$.id'), json_extract(value, '$.atualizadoEm'), ?,
        (SELECT CAST(valor AS INTEGER) FROM info WHERE chave = 'ordemPendentes') - ? + CAST(key AS INTEGER) + 1, value
      FROM json_each(?) WHERE true
      ON CONFLICT(aparelho, id) DO UPDATE SET atualizadoEm = excluded.atualizadoEm, geracao = excluded.geracao,
        ordem = excluded.ordem, json = excluded.json
      WHERE excluded.atualizadoEm > pendentes.atualizadoEm`).bind(aparelho, geracao, lista.length, JSON.stringify(lista)),
  ]);
}

async function telasPublicadas(env) {
  // O binding lê o pacote deste deploy, sem depender do cache HTTP de uma publicação anterior.
  try {
    const r = await env.ASSETS.fetch('https://assets.local/telas/pacote.json');
    if (!r.ok) return null;
    const p = await r.json();
    const valida = (v) => typeof v === 'string' && /^\d{1,2}\.\d{1,2}(\.\d{1,2})?$/.test(v);
    return valida(p.versao) && valida(p.apkMinimo) ? { versao: p.versao, apkMinimo: p.apkMinimo } : null;
  } catch { return null; } // um pacote ausente não interrompe a sincronização
}
/** Dois cursores independentes: só avançam sobre os itens efetivamente entregues. */
async function puxarAparelho(env, aparelho, corpo) {
  const resposta = { registros: [], seq: corpo.desdeSeq || 0, ordem: corpo.desdeOrdem || 0, mais: false, telas: await telasPublicadas(env) };
  const { results } = await env.DB.prepare(`SELECT json, seq AS cursor, 0 AS fonte FROM
      (SELECT json, seq FROM registros WHERE seq > ? AND data >= ? ORDER BY seq LIMIT 501)
    UNION ALL SELECT json, ordem AS cursor, 1 AS fonte FROM
      (SELECT json, ordem FROM pendentes WHERE ordem > ? AND aparelho <> ?
        AND json_extract(json, '$.data') <> 'config' AND json_extract(json, '$.prancheta') <> 'registro'
        AND (geracao = '' OR geracao = COALESCE((SELECT valor FROM info WHERE chave = 'geracao'), geracao))
        ORDER BY ordem LIMIT 501)
    ORDER BY fonte, cursor LIMIT 501`).bind(resposta.seq, corpo.desdeDia || '0000-00-00', resposta.ordem, aparelho).all();
  // Reserva o envelope com os maiores cursores possíveis; conta bytes UTF-8, inclusive as vírgulas.
  const enc = new TextEncoder();
  let bytes = enc.encode(JSON.stringify({ ...resposta, seq: Number.MAX_SAFE_INTEGER, ordem: Number.MAX_SAFE_INTEGER })).length;
  for (const linha of results) {
    const registro = JSON.parse(linha.json);
    const tamanho = enc.encode(JSON.stringify(registro)).length + (resposta.registros.length ? 1 : 0);
    if (resposta.registros.length === MAX_POR_ENVIO || bytes + tamanho > MAX_FILA_BYTES) {
      if (!resposta.registros.length) return responder(413, { erro: 'Anotação excede o limite de resposta de 1 MB' });
      resposta.mais = true; break;
    }
    resposta.registros.push(registro); bytes += tamanho;
    resposta[linha.fonte ? 'ordem' : 'seq'] = linha.cursor;
  }
  return responder(200, resposta);
}

/* ---------- a central manda as anotações ---------- */
async function receber(req, env) {
  let corpo;
  try { corpo = await req.json(); } catch (e) { return responder(400, { erro: 'JSON inválido' }); }
  const lista = Array.isArray(corpo.registros) ? corpo.registros : null;
  if (!lista || lista.length > MAX_POR_ENVIO) return responder(400, { erro: `mande de 0 a ${MAX_POR_ENVIO} anotações por vez` });
  // Dias de produção para os aparelhos, incluindo avisos; a API do escritório continua filtrando os internos.
  const regs = lista.filter((r) => r && typeof r.id === 'string' && leitura.ehDia(r.data) && r.prancheta !== 'registro' && Number.isFinite(Number(r.seq)));
  // aparelhos bloqueados: a central manda a lista inteira quando ela muda (vazia = ninguém bloqueado).
  // Lista grande demais é recusada (antes era cortada sem avisar). Só fica o que o aparelho precisa saber: nada da senha.
  let bloqueios = null;
  if (Array.isArray(corpo.bloqueios)) {
    if (corpo.bloqueios.length > 500) return responder(400, { erro: 'mande no máximo 500 aparelhos bloqueados' });
    bloqueios = corpo.bloqueios.filter((b) => b && typeof b.id === 'string' && /^[\w.-]{1,80}$/.test(b.id))
      .map((b) => ({ id: b.id, em: Number(b.em) || 0, rev: Number(b.rev) || 0, modo: b.modo === 'senha' ? 'senha' : 'trava', apagar: !!b.apagar }));
  }
  const info = await lerInfo(env);
  const consultas = [];
  const geracao = String(corpo.geracao || '');
  // a central foi zerada (Apagar todos os dados do sistema) ou é outra central: a cópia começa de novo
  if (geracao && info.geracao && geracao !== info.geracao) {
    consultas.push(env.DB.prepare('DELETE FROM registros'), env.DB.prepare('DELETE FROM dias'));
  }
  const novasInfo = { geracao, ultimoEnvio: String(Date.now()) };
  if (corpo.forms && typeof corpo.forms === 'object') {
    // senha não fica na nuvem (as centrais até a 2.10 mandavam o forms.js inteiro, com a pinAdmin)
    const forms = Object.assign({}, corpo.forms);
    delete forms.pinAdmin;
    novasInfo.forms = JSON.stringify(forms);
  }
  if ('medidas' in corpo) novasInfo.medidas = corpo.medidas ? JSON.stringify(corpo.medidas) : '';
  // a revisão (da central) em que a lista de bloqueios foi montada: o aparelho só destrava pela nuvem se ela for mais nova que o bloqueio dele
  // e de qual central é a lista (gravada junto com ela: as anotações de outra central não mudam isto)
  if (bloqueios) { novasInfo.bloqueiosRev = String(Number(corpo.bloqueiosRev) || 0); novasInfo.bloqueiosGeracao = geracao; }
  // banco de uma nuvem da 2.10: as folhas guardadas ainda podem ter a senha do administrador (só mexe se tiver)
  consultas.push(env.DB.prepare(TIRAR_PIN_ANTIGO));
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
      SELECT data, COUNT(*) FROM registros WHERE apagado = 0 AND prancheta NOT IN ('avisos', 'avisos-recibo') AND data IN (SELECT value FROM json_each(?)) GROUP BY data
      ON CONFLICT(data) DO UPDATE SET anotacoes = excluded.anotacoes`).bind(dias));
  }
  if (bloqueios) {
    consultas.push(env.DB.prepare('DELETE FROM bloqueios'));
    if (bloqueios.length) consultas.push(env.DB.prepare("INSERT INTO bloqueios (id, json) SELECT json_extract(value, '$.id'), value FROM json_each(?) WHERE true").bind(JSON.stringify(bloqueios)));
  }
  await env.DB.batch(consultas);
  const maior = regs.reduce((m, r) => Math.max(m, Number(r.seq)), 0);
  return responder(200, { ok: true, recebidos: regs.length, seq: maior, telas: await telasPublicadas(env) });
}

async function estado(env) {
  await env.DB.prepare(TIRAR_PIN_ANTIGO).run();
  const info = await lerInfo(env);
  // sem contar o banco inteiro (o plano grátis conta cada linha lida): a soma vem da tabela dos dias e o MAX usa o índice
  const linha = await env.DB.prepare('SELECT (SELECT COALESCE(SUM(anotacoes), 0) FROM dias) AS n, (SELECT MAX(seq) FROM registros) AS seq').first();
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
  if (p === '/api/v1/totais') {
    const intervalo = leitura.intervaloTotais(url.searchParams);
    if (!intervalo) return responder(400, { erro: 'Use dia=AAAA-MM-DD ou de=AAAA-MM-DD&ate=AAAA-MM-DD, até 62 dias' });
    const { results } = await env.DB.prepare("SELECT json FROM registros WHERE data >= ? AND data <= ? AND apagado = 0 AND prancheta NOT IN ('avisos', 'avisos-recibo', 'registro')")
      .bind(intervalo.de, intervalo.ate).all();
    return responder(200, api.totais(intervalo, results.map((l) => JSON.parse(l.json))));
  }
  if (p === '/api/v1/dias') {
    const de = url.searchParams.get('de'); const ate = url.searchParams.get('ate');
    const { results } = await env.DB.prepare('SELECT data, anotacoes FROM dias WHERE anotacoes > 0 AND data >= ? AND data <= ? ORDER BY data DESC')
      .bind(leitura.ehDia(de) ? de : '0000-00-00', leitura.ehDia(ate) ? ate : '9999-99-99').all();
    return responder(200, { dias: results.map((l) => ({ data: l.data, anotacoes: l.anotacoes })) });
  }
  const m = p.match(/^\/api\/v1\/dias\/(\d{4}-\d{2}-\d{2})$/);
  if (m) {
    const { results } = await env.DB.prepare("SELECT json FROM registros WHERE data = ? AND prancheta NOT IN ('avisos', 'avisos-recibo')").bind(m[1]).all();
    return responder(200, api.dia(m[1], results.map((l) => JSON.parse(l.json))));
  }
  if (p === '/api/v1/registros') {
    const desde = Number(url.searchParams.get('desde') || 0) || 0;
    const limite = Math.min(2000, Math.max(1, Number(url.searchParams.get('limite') || 500) || 500));
    const { results } = await env.DB.prepare("SELECT json FROM registros WHERE seq > ? AND prancheta NOT IN ('avisos', 'avisos-recibo') ORDER BY seq LIMIT ?").bind(desde, limite + 1).all();
    const lote = results.slice(0, limite).map((l) => JSON.parse(l.json));
    const ultimo = await env.DB.prepare("SELECT MAX(seq) AS seq FROM registros WHERE prancheta NOT IN ('avisos', 'avisos-recibo')").first();
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
      if (p === '/aparelho/sync') return await fila(req, env, false, true);
      if (p === '/fila' || p === '/fila/confirmar') return await fila(req, env, p === '/fila/confirmar');
      if (p.startsWith('/central/')) {
        if (!(await mesmoSegredo(senhaDoPedido(req), env.SEGREDO_CENTRAL))) return responder(401, { erro: 'Senha da central errada' });
        if (p === '/central/enviar' && req.method === 'POST') return await receber(req, env);
        if (p === '/central/estado' && req.method === 'GET') return await estado(env);
        return responder(404, { erro: 'rota desconhecida' });
      }
      // o aplicativo pergunta se foi bloqueado (versão 2.11): só responde sobre o aparelho pedido, sem nada da senha.
      // revisao: até onde a lista está certa (número da central); o aparelho ignora resposta mais velha que o bloqueio que ele tem.
      const ap = p.match(/^\/aparelho\/([\w.-]{1,80})$/);
      if (ap && req.method === 'GET') {
        // geracao: de qual central é a lista (a revisão recomeça numa central nova; o aparelho ignora lista de outra central)
        const linha = await env.DB.prepare("SELECT (SELECT json FROM bloqueios WHERE id = ?) AS json, (SELECT valor FROM info WHERE chave = 'bloqueiosRev') AS rev, (SELECT valor FROM info WHERE chave = 'bloqueiosGeracao') AS geracao").bind(ap[1]).first();
        const b = linha && linha.json ? JSON.parse(linha.json) : null;
        return responder(200, { bloqueio: b ? { em: b.em, rev: Number(b.rev) || 0, modo: b.modo, apagar: !!b.apagar } : null, revisao: Number(linha && linha.rev) || 0, geracao: (linha && linha.geracao) || '' });
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
