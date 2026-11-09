/* Versão 3.0: a sala do banco no Worker de verdade (wrangler dev), porque o SQLite não tem Durable Object: node testes/sala30.mjs
 * Aviso de novidade em tempo real, rascunho passando sem gravar, e quem não tem a chave do aparelho não entra.
 */
import crypto from 'node:crypto';
import { ligarNuvem, temWrangler } from './nuvem.mjs';
import { novoGrupo, teste, certo, igual, resumo } from './teste.mjs';

const SEGREDO = 'segredo-da-central-de-teste';
const g = novoGrupo('Sala do banco 3.0 (wrangler)');
if (!temWrangler()) { console.log('Sem o wrangler instalado em nuvem/: teste não rodou'); process.exit(1); }
const n = await ligarNuvem(8511);
const token = (id) => crypto.createHmac('sha256', SEGREDO).update('aparelho|' + id).digest('hex');
const dia = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
function entrar(id, senha = token(id)) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${n.url.replace('http', 'ws')}/banco/aovivo?a=${id}`, ['pranchetas', senha]);
    const recebidas = [];
    ws.onmessage = (e) => recebidas.push(e.data);
    ws.onopen = () => resolve({ ws, recebidas });
    ws.onerror = () => reject(new Error('recusada'));
  });
}
const esperar = async (fn, descricao) => {
  for (let i = 0; i < 40; i++) { const r = fn(); if (r) return r; await new Promise((res) => setTimeout(res, 150)); }
  throw new Error('Não aconteceu: ' + descricao);
};
const sync = (id, registros = []) => n.pedir('/banco/api/sync', { aparelho: id, senha: token(id), corpo: { aparelho: id, papel: 'caldeira', versao: '3.0.0', registros } });

try {
  await n.pedir('/central/enviar', { senha: SEGREDO, corpo: { geracao: 'g30', registros: [] } });
  await teste(g, 'quem não tem a chave do aparelho não entra na sala', async () => {
    let entrou = true;
    try { const x = await entrar('sala-intruso', 'chave-errada'); x.ws.close(); } catch (e) { entrou = false; }
    igual(entrou, false);
  });
  const a = await entrar('sala-a'), b = await entrar('sala-b');
  await teste(g, 'quando um aparelho anota, o outro fica sabendo na hora; quem anotou se reconhece', async () => {
    const r = await sync('sala-a', [{ id: `${dia}|caldeira|8`, data: dia, prancheta: 'caldeira', chave: '8', valores: { pressao: '6' }, atualizadoEm: Date.now() - 1000 }]);
    igual(r.status, 200);
    const msg = await esperar(() => b.recebidas.map((x) => JSON.parse(x)).find((x) => x.seq), 'aviso no outro aparelho');
    igual(msg.de, 'sala-a');
    certo(msg.seq > 0, 'aviso sem número');
  });
  await teste(g, 'o rascunho passa para os outros e não fica gravado nem volta para quem digitou', async () => {
    const antes = (await n.pedir('/banco/api/registros?desde=0', { aparelho: 'sala-a', senha: token('sala-a') })).json.seq;
    a.recebidas.length = 0; b.recebidas.length = 0;
    a.ws.send(JSON.stringify({ tipo: 'rascunho', pid: 'caldeira', data: dia, chave: '9', quem: 'Alberto', valores: { pressao: '7' } }));
    const r = await esperar(() => b.recebidas.map((x) => JSON.parse(x)).find((x) => x.tipo === 'rascunho'), 'o rascunho chegar');
    igual(r.de, 'sala-a'); igual(r.quem, 'Alberto'); igual(r.valores, { pressao: '7' });
    await new Promise((res) => setTimeout(res, 300));
    igual(a.recebidas.filter((x) => x !== 'pong').length, 0, 'voltou para quem digitou');
    igual((await n.pedir('/banco/api/registros?desde=0', { aparelho: 'sala-a', senha: token('sala-a') })).json.seq, antes, 'rascunho gravou no banco');
    a.ws.send(JSON.stringify({ tipo: 'outro', valores: {} }));
    a.ws.send('{quebrado');
    await new Promise((res) => setTimeout(res, 300));
    igual(b.recebidas.filter((x) => JSON.parse(x).tipo !== 'rascunho').length, 0, 'mensagem estranha passou');
  });
  await teste(g, 'a lista de aparelhos sabe quem está na sala (em tempo real)', async () => {
    await n.pedir('/central/sincronia', { senha: SEGREDO, corpo: { pessoas: [], estado: { aparelhosChefe: { 'sala-a': { nivel: 3, em: 1 } } } } });
    await sync('sala-a'); await sync('sala-b');
    igual((await n.pedir('/banco/api/status', { aparelho: 'sala-a', senha: token('sala-a') })).status, 200);
    const vivos = (await n.pedir('/banco/api/status', { aparelho: 'sala-a', senha: token('sala-a') })).json.aparelhos;
    certo(vivos.some((x) => x.id === 'sala-b' && x.aoVivo && x.online), JSON.stringify(vivos.map((x) => [x.id, x.aoVivo])));
  });
  a.ws.close(); b.ws.close();
} finally { await n.desligar(); }
const r = resumo([g]);
console.log(`\n${r.passaram} de ${r.total} testes passaram; ${r.falharam} falharam`);
process.exitCode = r.falharam ? 1 : 0;
