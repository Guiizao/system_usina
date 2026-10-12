/* Alternativa explícita para ambientes sem os subprocessos do Wrangler.
 * Executa o Worker real e seu SQL em SQLite; não substitui a validação no workerd.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import worker from '../nuvem/src/index.js';
import { pastaTemporaria, APP } from './servidores.mjs';

export async function ligarNuvemSQLite(porta, segredo, token) {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(path.join(APP, 'nuvem/schema.sql'), 'utf8'));
  const publico = pastaTemporaria('nuvem-sqlite-publico');
  fs.cpSync(path.join(APP, 'nuvem/publico'), publico, { recursive: true });
  const prepare = (sql, params = []) => ({
    bind: (...valores) => prepare(sql, valores),
    all: () => ({ results: db.prepare(sql).all(...params) }),
    first: () => db.prepare(sql).get(...params) || null,
    run: () => db.prepare(sql).run(...params),
  });
  const env = { SEGREDO_CENTRAL: segredo, TOKEN_LEITURA: token, DB: {
    prepare,
    batch(consultas) {
      db.exec('BEGIN');
      try { const r = consultas.map((c) => c.run()); db.exec('COMMIT'); return r; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  } };
  const anterior = crypto.subtle.timingSafeEqual;
  crypto.subtle.timingSafeEqual = (a, b) => timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
  const url = `http://127.0.0.1:${porta}`;
  const servidor = http.createServer(async (req, res) => {
    try {
      const arquivo = path.resolve(publico, '.' + new URL(req.url, url).pathname);
      if (arquivo.startsWith(publico + path.sep) && fs.existsSync(arquivo) && fs.statSync(arquivo).isFile()) {
        res.writeHead(200, { 'Access-Control-Allow-Origin': '*' }); res.end(fs.readFileSync(arquivo)); return;
      }
      const partes = []; for await (const parte of req) partes.push(parte);
      const pedido = new Request(url + req.url, { method: req.method, headers: req.headers,
        ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Buffer.concat(partes) }) });
      const resposta = await worker.fetch(pedido, env);
      res.writeHead(resposta.status, Object.fromEntries(resposta.headers));
      res.end(Buffer.from(await resposta.arrayBuffer()));
    } catch (e) { res.writeHead(500); res.end(String(e)); }
  });
  await new Promise((resolve) => servidor.listen(porta, '127.0.0.1', resolve));
  return { url, publico,
    consultar: (sql) => db.prepare(sql).all(),
    async pedir(rota, { senha = token, corpo, aparelho } = {}) {
      const r = await fetch(url + rota, { method: corpo ? 'POST' : 'GET', headers: {
        Authorization: 'Bearer ' + senha, ...(aparelho ? { 'X-Aparelho': aparelho } : {}),
      }, body: corpo ? JSON.stringify(corpo) : undefined });
      const texto = await r.text(); let json = null; try { json = JSON.parse(texto); } catch { }
      return { status: r.status, json, texto, cabecalhos: r.headers };
    },
    async desligar() {
      await new Promise((resolve) => servidor.close(resolve)); db.close();
      if (anterior) crypto.subtle.timingSafeEqual = anterior; else delete crypto.subtle.timingSafeEqual;
    },
  };
}
