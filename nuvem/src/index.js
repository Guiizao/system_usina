/* Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt). */
/*
 * Nuvem das Pranchetas (Cloudflare Workers, plano grátis).
 *
 * A central da usina (computador ou tablet chefe) manda uma cópia das anotações para cá pela internet.
 * Daqui sai a API só de leitura para o sistema do escritório (a mesma da central) e as atualizações do aplicativo.
 * Sem a central, os aparelhos trocam pendências pela nuvem; a central confere quando volta.
 *
 *   GET  /aparelho/pessoas   nomes de quem pode entrar pela nuvem   (sem token)
 *   POST /aparelho/entrar    senha pessoal libera leitura remota    (sem token)
 *   POST /aparelho/sair      revoga a chave pessoal deste aparelho  (X-Aparelho + Bearer HMAC)
 *   POST /aparelho/sync      os aparelhos enviam e puxam anotações   (X-Aparelho + Bearer HMAC)
 *   /banco/...               3.0: os aparelhos falam direto com o banco, com as rotas da central (veja banco.js)
 *   POST /central/enviar     a central manda as anotações novas      (Authorization: Bearer <SEGREDO_CENTRAL>)
 *   GET  /central/novidades  a central puxa o que chegou por aqui     (Authorization: Bearer <SEGREDO_CENTRAL>)
 *   POST /central/sincronia  pessoas, níveis e código, nos dois sentidos (Authorization: Bearer <SEGREDO_CENTRAL>)
 *   GET  /central/estado     a central pergunta até onde a nuvem tem  (Authorization: Bearer <SEGREDO_CENTRAL>)
 *   GET  /api/v1/...         a API de leitura, igual à da central     (Authorization: Bearer <TOKEN_LEITURA>)
 *   GET  /aparelho/<id>      o aplicativo pergunta se este aparelho foi bloqueado (sem senha; responde só sobre ele)
 *   GET  /atualizacao/...    versao.json e pranchetas.apk (arquivos da pasta publico, sem passar por aqui)
 *
 * Banco: D1 (SQLite). O plano grátis deixa 50 consultas por pedido, então cada envio grava tudo
 * numa consulta só (a lista inteira vai como um JSON e o próprio banco abre com json_each).
 */
import leitura from '../../api-leitura.js';
import Juncao from '../../public/nucleo/juncao.js';
import { criarBanco, Sala } from './banco.js';
import { enviarAoServidorDaUsina } from './usina.js';

export { Sala };

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
const hex = (bytes) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
async function assinar(segredo, texto) {
  const enc = new TextEncoder();
  const chave = await crypto.subtle.importKey('raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', chave, enc.encode(texto)));
}
const tokenDoAparelho = (segredo, aparelho) => assinar(segredo, 'aparelho|' + aparelho);
/* 2.16: quem entra pela nuvem recebe outra chave, só de ver, presa à pessoa e à senha dela. Trocar a senha, desativar
   ou tirar Relatórios e Escritório tira o acesso; e ela nunca vale como a chave de um tablet (mesmo com o número dele). */
const FUNCOES_NA_NUVEM = ['relatorios', 'escritorio'];
const veNaNuvem = (p) => !!(p && p.ativo !== false && p.nuvem && p.nuvem.selado && Array.isArray(p.funcoes) && p.funcoes.some((f) => FUNCOES_NA_NUVEM.includes(f)));
async function pessoasDaNuvem(req, env) {
  if (req.method !== 'GET') return responder(405, { erro: 'Use GET' });
  // conferência ainda sem selo (chegou na 2.16.0) também aparece: ela é selada na primeira entrada
  const { results } = await env.DB.prepare("SELECT json FROM pessoas WHERE json_extract(json, '$.nuvem') IS NOT NULL").all();
  const pessoas = results.map((r) => JSON.parse(r.json)).filter((p) => veNaNuvem(p) || (p.nuvem.verificador && veNaNuvem({ ...p, nuvem: { selado: 1 } })))
    .map(({ id, nome }) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.id.localeCompare(b.id));
  return responder(200, { pessoas });
}
const tokenDeLeitura = (segredo, aparelho, p, nonce = '') => assinar(segredo, `leitura|${aparelho}|${p.id}|${p.nuvem.selado}${nonce ? '|' + nonce : ''}`);
// a conferência da senha fica selada com o segredo da central (que não está no banco): o banco sozinho não revela o PIN
const selar = (segredo, verificador) => assinar(segredo, 'senha|' + verificador);
async function leitorDaNuvem(env, aparelho, recebido) {
  const linha = await env.DB.prepare(`SELECT p.json, s.nonce FROM acessos_nuvem a JOIN pessoas p ON p.id = a.pessoa
    LEFT JOIN sessoes_nuvem s ON s.aparelho = a.aparelho WHERE a.aparelho = ?`).bind(aparelho).first();
  const p = linha && JSON.parse(linha.json);
  const nonce = linha?.nonce || ''; // sem sessao: chave da 2.16 continua valendo ate sair ou entrar novamente
  return veNaNuvem(p) && (await mesmoSegredo(recebido, await tokenDeLeitura(env.SEGREDO_CENTRAL, aparelho, p, nonce))) ? { pessoa: p, nonce } : null;
}

async function sair(req, env) {
  if (req.method !== 'POST') return responder(405, { erro: 'Use POST' });
  const aparelho = req.headers.get('X-Aparelho');
  const acesso = idAparelho(aparelho) && env.SEGREDO_CENTRAL && await leitorDaNuvem(env, aparelho, senhaDoPedido(req));
  if (!acesso) return responder(401, { erro: 'Credencial de leitura invalida' });
  // Uma saida atrasada nao pode revogar a chave de quem acabou de entrar no mesmo aparelho.
  await env.DB.prepare(`DELETE FROM acessos_nuvem WHERE aparelho = ? AND pessoa = ?
    AND COALESCE((SELECT nonce FROM sessoes_nuvem WHERE aparelho = ?), '') = ?`)
    .bind(aparelho, acesso.pessoa.id, aparelho, acesso.nonce).run();
  return responder(200, { ok: true });
}

/** Reserva antes da criptografia: pedidos simultâneos também respeitam as cinco tentativas. */
async function reservarTentativa(env, chave, agora, limite = 5, esperas = [60000, 900000]) {
  return env.DB.prepare(`INSERT INTO tentativas_entrada (chave, erros) VALUES (?, 1)
    ON CONFLICT(chave) DO UPDATE SET
      erros = CASE WHEN ate > 0 THEN 1 ELSE erros + 1 END,
      bloqueios = bloqueios + CASE WHEN ate = 0 AND erros = ? THEN 1 ELSE 0 END,
      ate = CASE WHEN ate = 0 AND erros = ? THEN ? + CASE WHEN bloqueios = 0 THEN ? ELSE ? END ELSE 0 END
    WHERE ate <= ? RETURNING chave`).bind(chave, limite - 1, limite - 1, agora, esperas[0], esperas[1], agora).first();
}
// 20 senhas erradas por hora na nuvem inteira (somando todos os IPs e aparelhos): trocar de IP não ajuda a chutar senhas
const LIMITE_GERAL_POR_HORA = 20;
function devolverTentativa(env, chave) {
  return env.DB.prepare(`UPDATE tentativas_entrada SET erros = MAX(0, erros - 1),
    bloqueios = MAX(0, bloqueios - CASE WHEN ate > 0 THEN 1 ELSE 0 END), ate = 0 WHERE chave = ?`).bind(chave);
}
async function entrar(req, env) {
  if (req.method !== 'POST') return responder(405, { erro: 'Use POST' });
  let corpo;
  try { corpo = await corpoFila(req, 1024); } catch (status) { return responder(status === 413 ? 413 : 400, { erro: status === 413 ? 'Máximo de 1 KB por entrada' : 'JSON inválido' }); }
  const { aparelho, pin, pessoa: pessoaId } = corpo;
  if (!idAparelho(aparelho) || typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)
    || (pessoaId !== undefined && !idAparelho(pessoaId))) return responder(400, { erro: 'Aparelho, pessoa ou senha inválidos' });
  if (!env.SEGREDO_CENTRAL) return responder(503, { erro: 'Nuvem não configurada' });
  if (await env.DB.prepare('SELECT id FROM bloqueios WHERE id = ?').bind(aparelho).first()) return responder(423, { erro: 'bloqueado' });
  // CF-Connecting-IP é preenchido pela Cloudflare, nunca X-Forwarded-For do cliente.
  // IP primeiro: um IP já bloqueado não consegue criar linhas para milhares de aparelhos inventados.
  const agora = Date.now(), geral = 'todos:' + Math.floor(agora / 3600000);
  const chaves = ['ip:' + (req.headers.get('CF-Connecting-IP') || 'sem-ip'), 'aparelho:' + aparelho, ...(pessoaId !== undefined ? ['pessoa:' + pessoaId] : []), geral];
  for (let i = 0; i < chaves.length; i++) {
    const ok = chaves[i] === geral ? await reservarTentativa(env, geral, agora, LIMITE_GERAL_POR_HORA, [3600000, 3600000]) : await reservarTentativa(env, chaves[i], agora);
    if (!ok) {
      for (const c of chaves.slice(0, i)) await devolverTentativa(env, c).run();
      return responder(429, { erro: 'Muitas tentativas. Aguarde o desbloqueio.' });
    }
  }
  const enc = new TextEncoder();
  const chave = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const consulta = pessoaId === undefined
    ? env.DB.prepare("SELECT json FROM pessoas WHERE json_extract(json, '$.nuvem') IS NOT NULL")
    : env.DB.prepare("SELECT json FROM pessoas WHERE id = ? AND json_extract(json, '$.nuvem') IS NOT NULL").bind(pessoaId);
  const { results } = await consulta.all();
  const lista = results.map((l) => JSON.parse(l.json));
  // conferência que chegou antes de ser selada (a 2.16 do dia 21/10): sela agora e não guarda mais a outra
  const antigas = lista.filter((p) => p.nuvem.verificador && !p.nuvem.selado);
  for (const p of antigas) p.nuvem = { sal: p.nuvem.sal, iteracoes: p.nuvem.iteracoes, selado: await selar(env.SEGREDO_CENTRAL, p.nuvem.verificador) };
  if (antigas.length) await env.DB.batch(antigas.map((p) => env.DB.prepare('UPDATE pessoas SET json = ? WHERE id = ?').bind(JSON.stringify(p), p.id)));
  let pessoa;
  // ponytail: busca linear na lista pequena da usina; medir novamente se crescer (custo por verificador).
  // Só quem pode ver pela nuvem: a senha de quem não pode dá o mesmo "senha errada" (não confirma que a senha existe)
  for (const p of lista.filter(veNaNuvem)) {
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(p.nuvem.sal), iterations: p.nuvem.iteracoes }, chave, 256);
    if (await mesmoSegredo(await selar(env.SEGREDO_CENTRAL, hex(bits)), p.nuvem.selado)) { pessoa = p; break; }
  }
  if (!pessoa) return responder(401, { erro: 'Senha errada (ou essa pessoa não vê pela nuvem: precisa de Relatórios ou Escritório)' });
  const { id, nome, nivel, funcoes } = pessoa;
  const nonce = crypto.randomUUID();
  const data = new Date(agora + FUSO * 60000).toISOString().slice(0, 10), linha = 'nuvem-' + crypto.randomUUID();
  const registro = { id: `${data}|registro|${linha}`, data, prancheta: 'registro', setor: 'central', chave: linha,
    criadoEm: agora, atualizadoEm: agora, aparelho, operador: nome, apagado: false,
    valores: { em: agora, tipo: 'entrada', quem: nome, aparelho: 'PC ' + aparelho, texto: `${nome} entrou pela nuvem no PC ${aparelho}` } };
  const info = await env.DB.prepare("SELECT valor FROM info WHERE chave = 'geracao'").first();
  await env.DB.batch([
    ...chaves.map((c) => devolverTentativa(env, c)),
    env.DB.prepare("DELETE FROM tentativas_entrada WHERE chave LIKE 'todos:%' AND chave <> ?").bind(geral),
    env.DB.prepare('INSERT INTO acessos_nuvem (aparelho, pessoa) VALUES (?, ?) ON CONFLICT(aparelho) DO UPDATE SET pessoa = excluded.pessoa').bind(aparelho, id),
    env.DB.prepare('INSERT INTO sessoes_nuvem (aparelho, nonce) VALUES (?, ?) ON CONFLICT(aparelho) DO UPDATE SET nonce = excluded.nonce').bind(aparelho, nonce),
    ...consultasPendentes(env, aparelho, info?.valor || '', [registro]),
  ]);
  return responder(200, { token: await tokenDeLeitura(env.SEGREDO_CENTRAL, aparelho, pessoa, nonce), pessoa: { id, nome, nivel, funcoes } });
}
/** Limita os bytes recebidos também quando não há Content-Length. */
async function corpoFila(req, limite = MAX_FILA_BYTES) {
  if (Number(req.headers.get('Content-Length')) > limite) throw 413;
  const leitor = req.body && req.body.getReader();
  if (!leitor) throw 400;
  const partes = []; let tamanho = 0;
  while (true) {
    const { done, value } = await leitor.read();
    if (done) break;
    tamanho += value.byteLength;
    if (tamanho > limite) { await leitor.cancel(); throw 413; }
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
  const recebido = senhaDoPedido(req);
  let leitor = null; // 2.16: quem entrou pela nuvem (chave de leitura): recebe, mas nada do que manda é gravado
  if (!(await mesmoSegredo(recebido, senha))) {
    if (envio && idAparelho(aparelho) && env.SEGREDO_CENTRAL) leitor = await leitorDaNuvem(env, aparelho, recebido);
    if (!leitor) return responder(401, { erro: 'Credencial da fila inválida' });
  }
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
    || !Number.isSafeInteger(r.atualizadoEm) || r.atualizadoEm < 0 || !Juncao.valido(r))) return responder(400, { erro: 'Anotação inválida' });
  const acesso = await env.DB.prepare("SELECT (SELECT id FROM bloqueios WHERE id = ?) AS bloqueio, (SELECT valor FROM info WHERE chave = 'geracao') AS geracao").bind(aparelho).first();
  const recusados = leitor ? lista.map((r) => ({ id: r.id, motivo: 'somente_leitura' })) : [];
  if (sync) {
    if (['desdeSeq', 'desdeOrdem'].some((k) => corpo[k] !== undefined && (!Number.isSafeInteger(corpo[k]) || corpo[k] < 0))
      || (corpo.desdeDia !== undefined && !leitura.ehDia(corpo.desdeDia))) return responder(400, { erro: 'Cursor inválido' });
    // só o sync recusa aparelho bloqueado: a /fila (2.13) aceita, e a central recusa e publica a correção
    if (acesso.bloqueio) return responder(423, { erro: 'bloqueado' });
    if (corpo.geracao && acesso.geracao && corpo.geracao !== acesso.geracao) return responder(409, { geracao: acesso.geracao });
  }
  if (lista.length && !leitor) await gravarPendentes(env, aparelho, corpo.geracao || '', lista);
  if (sync) return puxarAparelho(env, aparelho, corpo, recusados, !!leitor);
  return responder(200, { ok: true, recebidos: leitor ? 0 : lista.length, recusados });
}

/** Reserva uma faixa por lote na mesma transação; cada item tem seu próprio cursor. */
async function gravarPendentes(env, aparelho, geracao, lista) {
  await env.DB.batch(consultasPendentes(env, aparelho, geracao, lista));
}
function consultasPendentes(env, aparelho, geracao, lista) {
  return [
    env.DB.prepare(`INSERT INTO info (chave, valor) VALUES ('ordemPendentes', ?)
      ON CONFLICT(chave) DO UPDATE SET valor = CAST(info.valor AS INTEGER) + excluded.valor`).bind(lista.length),
    env.DB.prepare(`INSERT INTO pendentes (aparelho, id, atualizadoEm, geracao, ordem, json)
      SELECT ?, json_extract(value, '$.id'), json_extract(value, '$.atualizadoEm'), ?,
        (SELECT CAST(valor AS INTEGER) FROM info WHERE chave = 'ordemPendentes') - ? + CAST(key AS INTEGER) + 1, value
      FROM json_each(?) WHERE true
      ON CONFLICT(aparelho, id) DO UPDATE SET atualizadoEm = excluded.atualizadoEm, geracao = excluded.geracao,
        ordem = excluded.ordem, json = excluded.json
      WHERE excluded.atualizadoEm > pendentes.atualizadoEm`).bind(aparelho, geracao, lista.length, JSON.stringify(lista)),
  ];
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
async function puxarAparelho(env, aparelho, corpo, recusados = [], leitor = false) {
  const resposta = { registros: [], recusados, seq: corpo.desdeSeq || 0, ordem: corpo.desdeOrdem || 0, mais: false, telas: await telasPublicadas(env) };
  if (leitor) {
    const { results } = await env.DB.prepare("SELECT chave, valor FROM info WHERE chave IN ('aparelhos', 'aparelhosEm')").all();
    const info = Object.fromEntries(results.map((r) => [r.chave, r.valor]));
    resposta.aparelhos = JSON.parse(info.aparelhos || '[]');
    resposta.aparelhosEm = Number(info.aparelhosEm) || 0;
  }
  const { results } = await env.DB.prepare(`SELECT json, seq AS cursor, 0 AS fonte FROM
      (SELECT json, seq FROM registros WHERE seq > ? AND data >= ? AND data <> 'config' AND prancheta <> 'registro' ORDER BY seq LIMIT 501)
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
  // As pendências continuam separadas por aparelho no banco: a central confere cada permissão ao voltar.
  // Na entrega, os campos se juntam; entre páginas o aplicativo aplica a mesma regra.
  const juntas = new Map();
  for (const r of resposta.registros) {
    const a = juntas.get(r.id);
    juntas.set(r.id, Juncao.juntar(a, r) || (!a || r.atualizadoEm > a.atualizadoEm ? r : a));
  }
  resposta.registros = [...juntas.values()];
  return responder(200, resposta);
}

/* ---------- a central manda as anotações ---------- */
const TEXTOS_APARELHO = ['id', 'nome', 'papel', 'setor', 'operador', 'pessoa', 'versao'];
function aparelhosValidos(lista) {
  return Array.isArray(lista) && lista.length <= 200 && lista.every((a) => a && typeof a === 'object' && !Array.isArray(a)
    && idAparelho(a.id) && TEXTOS_APARELHO.every((k) => typeof a[k] === 'string' && a[k].length <= 80)
    && Number.isSafeInteger(a.vistoEm) && a.vistoEm >= 0
    && Object.keys(a).every((k) => k === 'vistoEm' || TEXTOS_APARELHO.includes(k)));
}
async function receber(req, env) {
  let corpo;
  try { corpo = await req.json(); } catch (e) { return responder(400, { erro: 'JSON inválido' }); }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return responder(400, { erro: 'JSON inválido' });
  const lista = Array.isArray(corpo.registros) ? corpo.registros : null;
  if (!lista || lista.length > MAX_POR_ENVIO) return responder(400, { erro: `mande de 0 a ${MAX_POR_ENVIO} anotações por vez` });
  if ('aparelhos' in corpo && !aparelhosValidos(corpo.aparelhos)) return responder(400, { erro: 'Lista de aparelhos inválida (máximo 200, textos até 80 caracteres)' });
  // 3.0: também a configuração e o registro do sistema ficam no banco; a API do escritório continua filtrando os internos.
  const regs = lista.filter((r) => r && typeof r.id === 'string' && r.id === `${r.data}|${r.prancheta}|${r.chave}` && (r.data === 'config' || leitura.ehDia(r.data)) && Number.isSafeInteger(r.atualizadoEm) && Juncao.valido(r));
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
  // Só o zerar explícito pode substituir a cópia de outra geração.
  if (info.geracao && geracao !== info.geracao) {
    if (!Array.isArray(corpo.geracoesZeradas) || !corpo.geracoesZeradas.includes(info.geracao)) {
      return responder(409, { geracao: info.geracao, erro: 'A nuvem é de outra central, nada foi enviado' });
    }
    // zerar não tira as pessoas (são da usina, não das anotações de teste)
    consultas.push(env.DB.prepare(`INSERT INTO registros_apagados (id, data, prancheta, setor, chave, seq, atualizadoEm, apagado, json, apagado_em)
      SELECT id, data, prancheta, setor, chave, seq, atualizadoEm, apagado, json, ? FROM registros`).bind(Date.now()));
    // a configuração fica, como nas centrais (operadores, contatos, listas e os limites de cada nível continuam)
    consultas.push(env.DB.prepare("DELETE FROM registros WHERE data <> 'config'"), env.DB.prepare('DELETE FROM dias'));
    consultas.push(env.DB.prepare("DELETE FROM info WHERE chave IN ('aparelhos', 'aparelhosEm', 'usinaSeq', 'usinaDesde', 'usinaInicio')"));
  }
  const novasInfo = { geracao, ultimoEnvio: String(Date.now()) };
  if ('aparelhos' in corpo) { novasInfo.aparelhos = JSON.stringify(corpo.aparelhos); novasInfo.aparelhosEm = novasInfo.ultimoEnvio; }
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
  if (bloqueios) {
    consultas.push(env.DB.prepare('DELETE FROM bloqueios'));
    if (bloqueios.length) consultas.push(env.DB.prepare("INSERT INTO bloqueios (id, json) SELECT json_extract(value, '$.id'), value FROM json_each(?) WHERE true").bind(JSON.stringify(bloqueios)));
  }
  await env.DB.batch(consultas);
  // a lista de pessoas de uma central antiga junta como a da sincronia: ninguém some por não ter vindo
  if (Array.isArray(corpo.pessoas) && corpo.pessoas.length) await banco.sincronia(new Request('https://banco/', { method: 'POST', body: JSON.stringify({ pessoas: corpo.pessoas }) }), env);
  const aceitos = await banco.gravar(env, regs);
  if (aceitos) await banco.avisar(env, { seq: await banco.seqAtual(env), de: 'central' });
  const maior = regs.reduce((m, r) => Math.max(m, Number(r.seq) || 0), 0);
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
    const { results } = await env.DB.prepare("SELECT json FROM registros WHERE data = ? AND prancheta NOT IN ('avisos', 'avisos-recibo', 'registro')").bind(m[1]).all();
    return responder(200, api.dia(m[1], results.map((l) => JSON.parse(l.json))));
  }
  if (p === '/api/v1/registros') {
    const desde = Number(url.searchParams.get('desde') || 0) || 0;
    const limite = Math.min(2000, Math.max(1, Number(url.searchParams.get('limite') || 500) || 500));
    const { results } = await env.DB.prepare("SELECT json FROM registros WHERE seq > ? AND data <> 'config' AND prancheta NOT IN ('avisos', 'avisos-recibo', 'registro') ORDER BY seq LIMIT ?").bind(desde, limite + 1).all();
    const lote = results.slice(0, limite).map((l) => JSON.parse(l.json));
    const ultimo = await env.DB.prepare("SELECT MAX(seq) AS seq FROM registros WHERE data <> 'config' AND prancheta NOT IN ('avisos', 'avisos-recibo', 'registro')").first();
    return responder(200, { seq: lote.length ? lote[lote.length - 1].seq : (ultimo && ultimo.seq) || 0, maisDepois: results.length > limite, registros: lote.map(api.registro) });
  }
  return responder(404, { erro: 'rota desconhecida' });
}

const banco = criarBanco({ responder, mesmoSegredo, tokenDoAparelho, leitorDaNuvem, idAparelho, senhaDoPedido, reservarTentativa, devolverTentativa, corpoFila, selar, hex, telasPublicadas });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cabecalhos });
    try {
      if (p === '/' || p === '') {
        return new Response('Nuvem das Pranchetas Digitais da Ubirálcool: no ar.\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      if (p.startsWith('/banco/')) return await banco.rota(req, env, url);
      if (p === '/aparelho/pessoas') return await pessoasDaNuvem(req, env);
      if (p === '/aparelho/entrar') return await entrar(req, env);
      if (p === '/aparelho/sair') return await sair(req, env);
      if (p === '/aparelho/sync') return await fila(req, env, false, true);
      if (p === '/fila' || p === '/fila/confirmar') return await fila(req, env, p === '/fila/confirmar');
      if (p.startsWith('/central/')) {
        if (!(await mesmoSegredo(senhaDoPedido(req), env.SEGREDO_CENTRAL))) return responder(401, { erro: 'Senha da central errada' });
        if (p === '/central/enviar' && req.method === 'POST') return await receber(req, env);
        if (p === '/central/estado' && req.method === 'GET') return await estado(env);
        if (p === '/central/novidades' && req.method === 'GET') return await banco.novidades(env, url);
        if (p === '/central/sincronia' && req.method === 'POST') return await banco.sincronia(req, env);
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
  // 3.0: de 10 em 10 minutos, o que falta mandar ao Servidor da Usina (sem o endereço nos segredos, não faz nada)
  scheduled: (evento, env, ctx) => ctx.waitUntil(enviarAoServidorDaUsina(env, evento.scheduledTime, FUSO)),
};
