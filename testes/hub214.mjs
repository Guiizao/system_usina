/* Ponto de encontro 2.14: node testes/hub214.mjs (Wrangler local).
 * --sqlite é a alternativa explícita quando o ambiente impede o workerd.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ligarNuvem } from './nuvem.mjs';
import { centralNode, centralJava, pastaTemporaria } from './servidores.mjs';
import { conectarTeste } from './cifra.mjs';
import { novoGrupo, teste, certo, igual, resumo } from './teste.mjs';

const SEGREDO = 'segredo-da-central-de-teste';
const TOKEN = 'senha-de-leitura-de-teste';
const g = novoGrupo('Nuvem como ponto de encontro 2.14');
const n = process.argv.includes('--sqlite')
  ? await (await import('./nuvem-sqlite.mjs')).ligarNuvemSQLite(8891, SEGREDO, TOKEN)
  : await ligarNuvem(8891);
const token = (id) => crypto.createHmac('sha256', SEGREDO).update('aparelho|' + id).digest('hex');
const dia = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const reg = (chave, extra = {}) => ({ id: `${dia}|caldeira|${chave}`, data: dia, prancheta: 'caldeira', chave: String(chave), atualizadoEm: 100, valores: { pressao: '6' }, ...extra });
const sync = (aparelho, registros = [], extra = {}) => n.pedir('/aparelho/sync', { aparelho, senha: token(aparelho), corpo: { registros, ...extra } });
const enviar = (registros = [], extra = {}) => n.pedir('/central/enviar', { senha: SEGREDO, corpo: { registros, geracao: 'g214', ...extra } });
const fila = async () => (await n.pedir('/fila', { senha: SEGREDO })).json.itens;
const limpar = () => { for (const tabela of ['pendentes', 'registros', 'dias', 'bloqueios', 'info']) n.consultar(`DELETE FROM ${tabela}`); };
async function esperar(fn, descricao) {
  for (let i = 0; i < 100; i++) { const r = await fn(); if (r) return r; await new Promise((r) => setTimeout(r, 300)); }
  throw new Error('Não aconteceu: ' + descricao);
}
try {
  await teste(g, 'A envia e B recebe sem central; A não recebe a própria pendência', async () => {
    igual((await sync('a', [reg('primeiro')])).status, 200);
    const b = await sync('b'); igual(b.status, 200); igual(b.json.registros, [reg('primeiro')]);
    certo(b.json.ordem > 0); igual(b.json.seq, 0); igual(b.json.mais, false);
    igual((await sync('a')).json.registros, []);
  });
  await teste(g, 'HMAC errado, de outro aparelho e senha da central são recusados', async () => {
    for (const senha of ['errada', token('b'), SEGREDO]) igual((await n.pedir('/aparelho/sync', { aparelho: 'a', senha, corpo: { registros: [] } })).status, 401);
    igual((await n.pedir('/aparelho/sync')).status, 405);
  });
  await teste(g, '423 não grava; /fila da 2.13 continua recebendo aparelho bloqueado', async () => {
    await enviar([], { bloqueios: [{ id: 'travado', em: 1, rev: 1 }] });
    igual((await sync('travado', [reg('bloqueado')])).status, 423);
    certo(!(await fila()).some((x) => x.aparelho === 'travado'));
    igual((await n.pedir('/fila', { aparelho: 'travado', senha: token('travado'), corpo: { registros: [reg('legado')] } })).status, 200);
  });
  await teste(g, '409 informa geração e não grava; geração ausente continua permitida', async () => {
    const r = await sync('a', [reg('geracao')], { geracao: 'antiga' });
    igual(r.status, 409); igual(r.json, { geracao: 'g214' });
    certo(!(await fila()).some((x) => x.registro.chave === 'geracao'));
    igual((await sync('a', [], { geracao: 'g214' })).status, 200);
    igual((await sync('a')).status, 200);
  });
  await teste(g, 'valida cursores, data, registros, 500 itens e 1 MB antes de gravar', async () => {
    for (const extra of [{ desdeSeq: -1 }, { desdeOrdem: '1' }, { desdeSeq: 1.5 }, { desdeDia: 'ontem' }, { geracao: 2 }]) igual((await sync('a', [], extra)).status, 400);
    igual((await sync('a', Array(501).fill(reg('x')))).status, 400);
    igual((await sync('a', [reg('x', { atualizadoEm: '1' })])).status, 400);
    igual((await sync('a', [reg('x', { id: 'outro' })])).status, 400);
    igual((await sync('a', [reg('x', { valores: { texto: 'x'.repeat(1024 * 1024) } })])).status, 413);
  });
  await teste(g, 'config e registro não saem; pendência de geração antiga não vaza', async () => {
    limpar(); await enviar();
    const cfg = { id: 'config|sistema|geral', data: 'config', prancheta: 'sistema', chave: 'geral', atualizadoEm: 100 };
    await sync('a', [cfg, reg('log', { id: `${dia}|registro|log`, prancheta: 'registro' }), reg('visivel')]);
    await n.pedir('/fila', { aparelho: 'antigo', senha: token('antigo'), corpo: { registros: [reg('velho')], geracao: 'antiga' } });
    igual((await sync('b')).json.registros.map((r) => r.chave), ['visivel']);
    igual((await fila()).length, 4);
  });
  await teste(g, 'cópia publicada usa desdeSeq e desdeDia, incluindo apagados', async () => {
    limpar(); await enviar([reg('ontem', { seq: 1, data: '2020-01-01', id: '2020-01-01|caldeira|ontem' }), reg('hoje', { seq: 2 }), reg('apagado', { seq: 3, apagado: true })]);
    const r = (await sync('b', [], { desdeDia: dia })).json;
    igual(r.registros.map((x) => x.chave), ['hoje', 'apagado']); igual(r.seq, 3);
    igual((await sync('b', [], { desdeSeq: r.seq, desdeOrdem: r.ordem })).json.registros, []);
  });
  await teste(g, 'versão velha/igual não substitui nem reaparece; nova recebe ordem maior', async () => {
    limpar(); await sync('a', [reg('v')]); const antes = (await sync('b')).json;
    await sync('a', [reg('v', { atualizadoEm: 99 }), reg('v')]);
    igual((await sync('b', [], { desdeOrdem: antes.ordem })).json.registros, []);
    await sync('a', [reg('v', { atualizadoEm: 101 })]);
    const depois = (await sync('b', [], { desdeOrdem: antes.ordem })).json;
    igual(depois.registros[0].atualizadoEm, 101); certo(depois.ordem > antes.ordem);
  });
  await teste(g, 'mesmo id de aparelhos diferentes e confirmação antiga preservam versão nova', async () => {
    limpar(); await sync('a', [reg('v')]); await sync('b', [reg('v')]);
    const antigo = await fila(); await sync('a', [reg('v', { atualizadoEm: 101 })]);
    await n.pedir('/fila/confirmar', { senha: SEGREDO, corpo: { itens: antigo.map((x) => ({ aparelho: x.aparelho, id: x.registro.id, atualizadoEm: x.registro.atualizadoEm })) } });
    const resto = await fila(); igual(resto.length, 1); igual(resto[0].registro.atualizadoEm, 101);
  });
  await teste(g, '501 itens mistos: corte no meio do lote não perde nem repete anotações', async () => {
    limpar(); await enviar([reg('central', { seq: 1 })]);
    await sync('a', Array.from({ length: 500 }, (_, i) => reg('p' + i)));
    const p1 = (await sync('b')).json; igual(p1.registros.length, 500); igual(p1.mais, true);
    const p2 = (await sync('b', [], { desdeSeq: p1.seq, desdeOrdem: p1.ordem })).json;
    igual(p2.registros.length, 1); igual(p2.mais, false); igual(new Set([...p1.registros, ...p2.registros].map((r) => r.id)).size, 501);
  });
  await teste(g, 'limite de 1 MB conta UTF-8 e pagina dentro do lote', async () => {
    limpar(); await enviar([reg('grande', { seq: 1, valores: { texto: 'á'.repeat(200000) } })]);
    await sync('a', [reg('b1', { valores: { texto: 'á'.repeat(200000) } }), reg('b2', { valores: { texto: 'á'.repeat(200000) } })]);
    const p1 = await sync('b'); igual(p1.status, 200); igual(p1.json.registros.length, 2); igual(p1.json.mais, true); certo(Buffer.byteLength(p1.texto) <= 1024 * 1024);
    const p2 = await sync('b', [], { desdeSeq: p1.json.seq, desdeOrdem: p1.json.ordem });
    igual(p2.json.registros.length, 1); igual(p2.json.mais, false); certo(Buffer.byteLength(p2.texto) <= 1024 * 1024);
  });
  await teste(g, '500 exatos sem item restante retornam mais false', async () => {
    limpar(); await sync('a', Array.from({ length: 500 }, (_, i) => reg('e' + i)));
    const r = (await sync('b')).json; igual(r.registros.length, 500); igual(r.mais, false);
  });
  await teste(g, 'mais de 500 publicados preservam também o cursor das pendências ainda não lidas', async () => {
    limpar(); await enviar(Array.from({ length: 500 }, (_, i) => reg('c' + i, { seq: i + 1 })));
    await enviar([reg('c500', { seq: 501 })]); await sync('a', [reg('pendente')]);
    const p1 = (await sync('b')).json; igual(p1.registros.length, 500); igual(p1.seq, 500); igual(p1.ordem, 0); igual(p1.mais, true);
    const p2 = (await sync('b', [], { desdeSeq: p1.seq, desdeOrdem: p1.ordem })).json;
    igual(p2.registros.map((r) => r.chave), ['c500', 'pendente']); igual(p2.mais, false);
  });
  await teste(g, 'lotes simultâneos reservam ordens únicas e contador não recomeça após confirmação', async () => {
    limpar(); await Promise.all(Array.from({ length: 6 }, (_, i) => sync('a' + i, Array.from({ length: 10 }, (_, j) => reg(i + '-' + j)))));
    const ordens = n.consultar('SELECT ordem FROM pendentes'); igual(ordens.length, 60); igual(new Set(ordens.map((x) => x.ordem)).size, 60);
    const cursor = (await sync('leitor')).json.ordem;
    const itens = await fila(); await n.pedir('/fila/confirmar', { senha: SEGREDO, corpo: { itens: itens.map((x) => ({ aparelho: x.aparelho, id: x.registro.id, atualizadoEm: x.registro.atualizadoEm })) } });
    await sync('novo', [reg('depois')]); certo((await sync('leitor', [], { desdeOrdem: cursor })).json.ordem > cursor);
  });

  for (const [nome, ligar, porta] of [['Node', centralNode, 8892], ['Java', centralJava, 8893]]) {
    limpar();
    const c = await ligar(porta, pastaTemporaria('hub214-' + nome));
    try {
      await c.api('/api/nuvem', { acao: 'configurar', url: n.url, segredo: SEGREDO });
      const remoto = await conectarTeste(c.url, c.codigo());
      const cred = (await remoto.pedir('/api/sync', { corpo: { aparelho: remoto.aparelho, registros: [] } })).json;
      const rast = (chave, extra = {}) => reg(chave, { id: `${dia}|rastreamento|${chave}`, prancheta: 'rastreamento', ...extra });
      const puxar = async () => {
        await c.api('/api/nuvem', { acao: 'enviar' });
        await esperar(async () => (await fila()).length === 0, 'confirmação da fila');
      };
      const correcao = async (r) => esperar(async () => {
        const l = (await sync('observador')).json.registros;
        return l.find((x) => x.id === r.id && x.atualizadoEm > r.atualizadoEm);
      }, 'correção publicada');
      await teste(g, `${nome}: recusa sem registro anterior publica apagado e persiste antes de confirmar`, async () => {
        const r = rast('recusado', { atualizadoEm: Date.now() + 60000 });
        igual((await sync(remoto.aparelho, [r], { geracao: cred.geracao })).status, 200);
        certo((await sync('observador')).json.registros.some((x) => x.id === r.id && !x.apagado));
        await puxar(); const corrigido = await correcao(r); igual(corrigido.apagado, true); igual(corrigido.valores, {});
        const disco = JSON.parse(fs.readFileSync(path.join(c.pastaServidor, 'registros.json'), 'utf8'));
        igual(disco.registros[r.id].atualizadoEm, corrigido.atualizadoEm);
      });
      await teste(g, `${nome}: recusa restaura valores da central com seq e horário maiores`, async () => {
        const original = rast('existente', { atualizadoEm: Date.now(), valores: { lote: 'certo' } });
        await c.api('/api/sync', { registros: [original] }); await puxar();
        const r = { ...original, atualizadoEm: Date.now() + 90000, valores: { lote: 'errado' } };
        await sync(remoto.aparelho, [r], { geracao: cred.geracao }); await puxar();
        const corrigido = await correcao(r); igual(corrigido.valores, original.valores); certo(corrigido.seq > 0); certo(!corrigido.apagado);
      });
      await teste(g, `${nome}: recusa por bloqueio e por geração também publica correção`, async () => {
        await c.api('/api/aparelhos', { acao: 'bloquear', id: remoto.aparelho, modo: 'trava' });
        for (const geracao of [cred.geracao, 'antiga']) {
          const r = reg('recusa-' + geracao, { atualizadoEm: Date.now() + 120000 });
          igual((await n.pedir('/fila', { aparelho: remoto.aparelho, senha: token(remoto.aparelho), corpo: { registros: [r], geracao } })).status, 200);
          await puxar(); igual((await correcao(r)).apagado, true);
          await c.api('/api/aparelhos', { acao: 'desbloquear', id: remoto.aparelho });
        }
      });
      await teste(g, `${nome}: recusa em dia arquivado restaura o backup e chega à nuvem`, async () => {
        const data = '2020-01-01';
        const original = rast('arquivo', { id: `${data}|rastreamento|arquivo`, data, valores: { lote: 'arquivo-certo' } });
        await c.api('/api/sync', { registros: [original] });
        const r = { ...original, atualizadoEm: Date.now() + 150000, valores: { lote: 'errado' } };
        await sync(remoto.aparelho, [r], { geracao: cred.geracao }); await puxar();
        igual((await correcao(r)).valores, original.valores);
        const backup = JSON.parse(fs.readFileSync(path.join(c.pastaBackup, data + '.json'), 'utf8'));
        certo(backup.find((x) => x.id === r.id).atualizadoEm > r.atualizadoEm);
      });
      await teste(g, `${nome}: aviso recusado é corrigido nos aparelhos e continua fora da API do escritório`, async () => {
        const r = reg('aviso', { id: `${dia}|avisos|aviso`, prancheta: 'avisos', atualizadoEm: Date.now() + 180000, valores: { texto: 'indevido' } });
        await sync(remoto.aparelho, [r], { geracao: cred.geracao });
        certo((await sync('observador')).json.registros.some((x) => x.id === r.id && !x.apagado));
        await puxar(); igual((await correcao(r)).apagado, true);
        const total = (await n.pedir('/central/estado', { senha: SEGREDO })).json.registros;
        await enviar([], { geracao: cred.geracao, forms: { setores: [], pranchetas: {} } });
        const api = await n.pedir('/api/v1/registros?desde=0'); igual(api.status, 200, api.texto);
        certo(!api.json.registros.some((x) => x.prancheta === 'avisos'));
        igual((await n.pedir('/central/estado', { senha: SEGREDO })).json.registros, total);
      });
    } finally { await c.desligar(); }
  }
} finally { await n.desligar(); }
const r = resumo([g]);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
