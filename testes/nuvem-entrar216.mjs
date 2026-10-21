/* Login pela nuvem: Worker real + SQLite e as duas centrais, sempre com dados temporários.
 * Uso: node testes/nuvem-entrar216.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { pbkdf2Sync, createHmac } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { DatabaseSync } from 'node:sqlite';
import { ligarNuvemSQLite } from './nuvem-sqlite.mjs';
import { centralNode, centralJava } from './servidores.mjs';
import { novoGrupo, teste, igual, certo, resumo, SENHA_ENCARREGADO } from './teste.mjs';

const SEGREDO = 'segredo-ficticio-entrada216';
const verificador = (pin, sal = 'a'.repeat(32)) => ({ sal, iteracoes: 1000, verificador: pbkdf2Sync(pin, sal, 1000, 32, 'sha256').toString('hex') });
const pessoa = (id, pin) => ({ id, nome: id, nivel: 'consulta', ativo: true, funcoes: ['relatorios'], ...(pin ? { nuvem: verificador(pin) } : {}) });

export async function testarNuvemEntrar216(g) {
  const n = await ligarNuvemSQLite(8340, SEGREDO, 'leitura-ficticia');
  const entrar = async (aparelho, pin = '4567', ip = '192.0.2.1') => {
    const r = await fetch(n.url + '/aparelho/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify({ aparelho, pin }) });
    return { status: r.status, json: await r.json(), headers: r.headers };
  };
  const enviar = (corpo) => n.pedir('/central/enviar', { senha: SEGREDO, corpo: { geracao: 'teste216', registros: [], ...corpo } });
  const limparTentativas = () => n.consultar('DELETE FROM tentativas_entrada RETURNING chave');
  try {
    await teste(g, 'migração idempotente preserva as tabelas existentes', async () => {
      const db = new DatabaseSync(':memory:');
      try {
        const schema = fs.readFileSync(new URL('../nuvem/schema.sql', import.meta.url), 'utf8');
        db.exec(schema.split('-- 2.16:')[0]);
        db.exec("INSERT INTO info VALUES ('geracao', 'preservada')");
        db.exec(schema); db.exec(schema);
        igual(db.prepare("SELECT valor FROM info WHERE chave = 'geracao'").get().valor, 'preservada');
      } finally { db.close(); }
      const tabelas = n.consultar("SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r.name);
      for (const nome of ['pessoas', 'tentativas_entrada', 'acessos_nuvem', 'registros', 'pendentes']) certo(tabelas.includes(nome), nome);
    });
    await teste(g, 'lista sanitizada: sem senha, resumo, sal da central nem funções locais', async () => {
      const p = { ...pessoa('Lucas', '4567'), pin: 'nao-guardar', sal: 'sal-central', resumo: 'resumo-central', funcoes: ['relatorios', 'conexao', 'sistema'], nuvem: { ...verificador('4567'), pin: 'nao-guardar' } };
      igual((await enviar({ pessoas: [p, pessoa('Antiga'), { ...pessoa('Inativa', '5678'), ativo: false }] })).status, 200);
      const rows = n.consultar('SELECT json FROM pessoas');
      igual(rows.length, 2);
      const texto = JSON.stringify(rows);
      for (const s of ['nao-guardar', 'sal-central', 'resumo-central', 'conexao', 'sistema']) certo(!texto.includes(s), s);
      igual((await enviar({ pessoas: [{ ...p, nuvem: { ...p.nuvem, iteracoes: 999999 } }] })).status, 400);
      igual(n.consultar('SELECT id FROM pessoas').length, 2, 'envio inválido preserva a lista');
    });
    let login;
    await teste(g, 'login sem token retorna HMAC do aparelho e apenas os dados públicos da pessoa', async () => {
      login = await entrar('pc-lucas');
      igual(login.status, 200);
      igual(login.json.token, createHmac('sha256', SEGREDO).update('aparelho|pc-lucas').digest('hex'));
      igual(login.json.pessoa, { id: 'Lucas', nome: 'Lucas', nivel: 'consulta', funcoes: ['relatorios'] });
      igual(login.headers.get('Access-Control-Allow-Origin'), '*');
      igual(n.consultar('SELECT pessoa FROM acessos_nuvem')[0].pessoa, 'Lucas');
    });
    await teste(g, 'senha errada, pessoa antiga e inativa não entram; entrada inválida e método recusados', async () => {
      for (const pin of ['1111', '2222', '5678']) igual((await entrar('erro-' + pin, pin)).status, 401);
      igual((await entrar('pc-invalido', 4567)).status, 400);
      igual((await entrar('../pc')).status, 400);
      igual((await entrar('pc-invalido', '4'.repeat(2000))).status, 413);
      igual((await fetch(n.url + '/aparelho/entrar')).status, 405);
      limparTentativas();
    });
    const data = new Date().toISOString().slice(0, 10);
    const registro = { id: `${data}|teste|1`, data, prancheta: 'teste', chave: '1', atualizadoEm: Date.now(), seq: 1, valores: { valor: 'publicado' } };
    await teste(g, 'somente leitura recebe registros e recusa escrita no sync e na fila antiga', async () => {
      igual((await enviar({ registros: [registro] })).status, 200);
      const corpo = { registros: [{ ...registro, valores: { valor: 'forjado' } }], desdeSeq: 0 };
      for (const rota of ['/aparelho/sync', '/fila']) {
        const r = await n.pedir(rota, { senha: login.json.token, aparelho: 'pc-lucas', corpo });
        igual(r.status, 200);
        igual(r.json.recusados, [{ id: registro.id, motivo: 'somente_leitura' }]);
        if (rota.endsWith('sync')) certo(r.json.registros.some((r) => r.valores.valor === 'publicado'));
      }
      certo(!JSON.stringify(n.consultar('SELECT json FROM pendentes')).includes('forjado'));
      const fila = await n.pedir('/fila', { senha: SEGREDO });
      certo(fila.json.itens.some((r) => r.registro.valores.texto === 'Lucas entrou pela nuvem no PC pc-lucas'));
      igual((await n.pedir('/aparelho/sync', { senha: login.json.token, aparelho: 'outro', corpo: { registros: [] } })).status, 401);
    });
    await teste(g, 'bloqueio por aparelho, 1 minuto e depois 15 minutos, persiste no D1', async () => {
      limparTentativas();
      for (let i = 0; i < 5; i++) igual((await entrar('forca', '0000', `192.0.2.${i + 2}`)).status, 401);
      let linha = n.consultar("SELECT * FROM tentativas_entrada WHERE chave = 'aparelho:forca'")[0];
      certo(linha.ate - Date.now() > 55000 && linha.ate - Date.now() <= 60000);
      igual((await entrar('forca')).status, 429);
      n.consultar("UPDATE tentativas_entrada SET ate = 1 WHERE chave = 'aparelho:forca' RETURNING chave");
      for (let i = 0; i < 5; i++) igual((await entrar('forca', '0000', `192.0.2.${i + 10}`)).status, 401);
      linha = n.consultar("SELECT * FROM tentativas_entrada WHERE chave = 'aparelho:forca'")[0];
      igual(linha.bloqueios, 2); certo(linha.ate - Date.now() > 895000 && linha.ate - Date.now() <= 900000);
      igual((await entrar('forca')).status, 429);
      limparTentativas();
    });
    await teste(g, 'bloqueio por IP sobrevive à troca de aparelho; cinco pedidos simultâneos no máximo', async () => {
      const resultados = await Promise.all(Array.from({ length: 12 }, (_, i) => entrar('paralelo-' + i, '0000', '198.51.100.1')));
      igual(resultados.filter((r) => r.status === 401).length, 5);
      igual(resultados.filter((r) => r.status === 429).length, 7);
      igual((await entrar('outro-ip-mesmo', '4567', '198.51.100.1')).status, 429);
      igual(n.consultar("SELECT chave FROM tentativas_entrada WHERE chave = 'aparelho:outro-ip-mesmo'").length, 0);
      igual((await entrar('outro-ip-diferente', '4567', '198.51.100.2')).status, 200);
      limparTentativas();
    });
    await teste(g, 'pedidos simultâneos ao mesmo aparelho não contornam o limite trocando IP', async () => {
      const resultados = await Promise.all(Array.from({ length: 12 }, (_, i) => entrar('paralelo-unico', '0000', `203.0.113.${i + 1}`)));
      igual(resultados.filter((r) => r.status === 401).length, 5);
      igual(resultados.filter((r) => r.status === 429).length, 7);
      limparTentativas();
    });
    await teste(g, 'entradas certas não gastam tentativas nem apagam os erros anteriores', async () => {
      for (let i = 0; i < 4; i++) igual((await entrar('misto', '0000')).status, 401);
      for (let i = 0; i < 6; i++) igual((await entrar('misto')).status, 200);
      igual((await entrar('misto', '0000')).status, 401);
      igual((await entrar('misto')).status, 429);
      limparTentativas();
    });
    await teste(g, 'aparelho bloqueado não entra nem sincroniza; pessoa removida revoga a leitura', async () => {
      await enviar({ bloqueios: [{ id: 'pc-lucas', modo: 'trava' }] });
      igual((await entrar('pc-lucas')).status, 423);
      igual((await n.pedir('/aparelho/sync', { senha: login.json.token, aparelho: 'pc-lucas', corpo: { registros: [] } })).status, 423);
      await enviar({ bloqueios: [], pessoas: [] });
      igual((await entrar('pc-lucas')).status, 401);
      igual((await n.pedir('/aparelho/sync', { senha: login.json.token, aparelho: 'pc-lucas', corpo: { registros: [] } })).status, 401);
      limparTentativas();
    });
    await teste(g, 'PBKDF2 WebCrypto: medição local por verificador', async () => {
      const enc = new TextEncoder(), chave = await crypto.subtle.importKey('raw', enc.encode('4567'), 'PBKDF2', false, ['deriveBits']);
      const tempos = [];
      for (let i = 0; i < 110; i++) {
        const t = performance.now();
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('a'.repeat(32)), iterations: 1000 }, chave, 256);
        const tempo = performance.now() - t;
        igual(Buffer.from(bits).toString('hex'), verificador('4567').verificador);
        if (i >= 10) tempos.push(tempo);
      }
      tempos.sort((a, b) => a - b);
      return `1000 iterações, 100 amostras: p50=${tempos[50].toFixed(3)} ms, p95=${tempos[95].toFixed(3)} ms; estimativa 10 verificadores=${(tempos[95] * 10).toFixed(3)} ms (local, não CPU do Worker)`;
    });
    await teste(g, 'custo de buscar 10 pessoas pelo PIN, com WebCrypto e sais distintos', async () => {
      await enviar({ pessoas: Array.from({ length: 10 }, (_, i) => ({ ...pessoa('p' + i, '9876'), nuvem: verificador('9876', i.toString(16).padStart(32, '0')) })) });
      const tempos = [];
      for (let i = 0; i < 35; i++) {
        limparTentativas();
        const inicio = performance.now();
        const r = await entrar('medicao', '0000');
        const tempo = performance.now() - inicio;
        igual(r.status, 401);
        if (i >= 5) tempos.push(tempo);
      }
      tempos.sort((a, b) => a - b);
      limparTentativas();
      return `30 amostras, latência HTTP+SQLite local: p50=${tempos[15].toFixed(3)} ms, p95=${tempos[28].toFixed(3)} ms (inclui I/O; não é tempo de CPU)`;
    });

    for (const [nome, ligar, porta] of [['Node', centralNode, 8341], ['Java', centralJava, 8342]]) {
      const c = await ligar(porta);
      const arquivo = path.join(c.pastaServidor, 'config.json');
      const config = () => JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      const mandar = async () => {
        const r = await c.api('/api/nuvem', { acao: 'enviar' });
        certo(!r.erro, JSON.stringify(r));
      };
      let lucas;
      try {
        await c.cliente();
        await teste(g, `${nome}: cadastro gera PBKDF2 e nuvem recebe funções da pessoa sem teto`, async () => {
          const r = await c.api('/api/pessoas', { acao: 'salvar', pessoa: { nome: 'Lucas', nivel: 'consulta', pin: '4567', extras: { escritorio: true, relatorios: false, conexao: true } } });
          lucas = r.pessoas.find((p) => p.nome === 'Lucas'); certo(lucas);
          const p = config().pessoas.find((p) => p.id === lucas.id);
          igual(p.nuvem, verificador('4567', p.nuvem.sal));
          const cli = await c.cliente();
          await c.api('/api/pessoas', { acao: 'aparelho', id: cli.aparelho, teto: ['integracoes', 'pessoas'] });
          await c.api('/api/nuvem', { acao: 'configurar', url: n.url, segredo: SEGREDO });
          await mandar();
          const login = await entrar('pc-' + nome);
          igual(login.status, 200); igual(login.json.pessoa.id, lucas.id);
          certo(login.json.pessoa.funcoes.includes('escritorio'));
          for (const f of ['conexao', 'sistema', 'relatorios']) certo(!login.json.pessoa.funcoes.includes(f), f);
          const texto = JSON.stringify(n.consultar('SELECT json FROM pessoas'));
          for (const p of config().pessoas) { certo(!texto.includes(p.resumo)); certo(!texto.includes(p.sal)); }
          await c.api('/api/pessoas', { acao: 'aparelho', id: cli.aparelho, teto: null });
        });
        await teste(g, `${nome}: registro da entrada chega à central pelo caminho de pendentes`, async () => {
          await mandar();
          const dia = new Date(Date.now() - 180 * 60000).toISOString().slice(0, 10);
          const r = await c.api('/api/registro?dia=' + dia);
          certo(r.registros.some((r) => r.valores.texto === `Lucas entrou pela nuvem no PC pc-${nome}`), JSON.stringify(r));
          certo(!(await n.pedir('/fila', { senha: SEGREDO })).json.itens.length);
        });
        await teste(g, `${nome}: lista sem mudança não é regravada; troca de senha e desativação sobem`, async () => {
          // Trigger de teste: detecta reenvio mesmo que o conteúdo seja idêntico.
          n.consultar("CREATE TRIGGER IF NOT EXISTS contar_pessoas AFTER DELETE ON pessoas BEGIN INSERT INTO info (chave, valor) VALUES ('testePessoas', '1') ON CONFLICT(chave) DO UPDATE SET valor = CAST(valor AS INTEGER) + 1; END");
          const antes = n.consultar("SELECT valor FROM info WHERE chave = 'testePessoas'");
          await mandar();
          igual(n.consultar("SELECT valor FROM info WHERE chave = 'testePessoas'"), antes);
          await c.api('/api/pessoas', { acao: 'salvar', pessoa: { ...lucas, pin: '6789' } });
          await mandar();
          igual((await entrar('troca-' + nome, '4567')).status, 401);
          igual((await entrar('troca-' + nome, '6789')).status, 200);
          await c.api('/api/pessoas', { acao: 'salvar', pessoa: { ...lucas, ativo: false } });
          await mandar();
          igual((await entrar('inativa-' + nome, '6789')).status, 401);
          certo(!n.consultar('SELECT id FROM pessoas').some((p) => p.id === lucas.id));
          limparTentativas();
        });
        await teste(g, `${nome}: pessoa antiga recebe verificador só depois de entrar; persiste ao reiniciar`, async () => {
          await c.api('/api/pessoas', { acao: 'salvar', pessoa: { ...lucas, ativo: true } });
          await c.desligar();
          const cfg = config(); delete cfg.pessoas.find((p) => p.id === lucas.id).nuvem;
          fs.writeFileSync(arquivo, JSON.stringify(cfg));
          await c.reiniciar();
          await mandar();
          igual((await entrar('antiga-' + nome, '6789')).status, 401);
          await c.api('/api/pessoas', { acao: 'entrar', pin: '6789' });
          const p = config().pessoas.find((p) => p.id === lucas.id);
          igual(p.nuvem, verificador('6789', p.nuvem.sal));
          await c.api('/api/pessoas', { acao: 'entrar', pin: SENHA_ENCARREGADO });
          await mandar();
          igual((await entrar('antiga-' + nome, '6789')).status, 200);
          await c.reiniciar(); igual(config().pessoas.find((p) => p.id === lucas.id).nuvem, p.nuvem);
          limparTentativas();
        });
      } finally { await c.desligar(); }
    }
  } finally { await n.desligar(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const g = novoGrupo('Entrada pela nuvem 2.16 (SQLite, Node e Java)');
  await testarNuvemEntrar216(g);
  const r = resumo([g]); console.log(`\n${r.passaram} de ${r.total} testes passaram`); process.exitCode = r.falharam ? 1 : 0;
}
