/* node testes/turno216.mjs — destino simulado; somente pastas temporárias. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import envio from '../envio-turnos.js';
import leitura from '../api-leitura.js';
import { carregarUsina } from '../carregar-usina.js';
import { APP, centralNode, centralJava, pastaTemporaria } from './servidores.mjs';
import { base44Falso } from './pedidos25.mjs';
import { conectarTeste } from './cifra.mjs';
import { novoGrupo, teste, igual, certo, resumo } from './teste.mjs';

const C = JSON.parse(JSON.stringify(carregarUsina(path.join(APP, 'public'))));
const data = new Date().toLocaleDateString('en-CA');
const em = (hora) => new Date(`${data}T${hora}:00`).getTime();
const antigo = new Date(Date.parse(data) - 86400000).toISOString().slice(0, 10);
const reg = (dia, pid, hora, valores, extra = {}) => ({ id: `${dia}|${pid}|${hora}`, data: dia, prancheta: pid, chave: String(hora), valores, atualizadoEm: Date.now(), ...extra });
async function esperar(fn) {
  const fim = Date.now() + 12000;
  while (Date.now() < fim) { if (await fn()) return; await new Promise((r) => setTimeout(r, 100)); }
  throw new Error('não aconteceu em 12 segundos');
}
export async function testarTurno216(g) {
  await teste(g, 'fronteiras 16h, 19h, meia-noite e 7h; dia de produção e turnos 12h distintos', async () => {
    const f = { ...C, turnosSetor: { hidrolise: '12h' } };
    igual(envio.encerrados(f, data, em('15:59')).length, 0);
    igual(envio.encerrados(f, data, em('16:00')).map((e) => e.turno.fim), [16]);
    igual(envio.encerrados(f, data, em('19:00')).map((e) => e.turno.fim), [16, 19]);
    const amanha = new Date(data + 'T00:00:00'); amanha.setDate(amanha.getDate() + 1);
    igual(envio.encerrados(f, data, amanha.getTime()).map((e) => e.turno.fim), [16, 19, 24]);
    amanha.setHours(7);
    const fim = envio.encerrados(f, data, amanha.getTime());
    igual(fim.map((e) => e.turno.fim), [16, 19, 24, 7, 7]);
    certo(fim.every((e) => e.data === data), 'virada preserva o dia de produção');
    igual(new Set(fim.map((e) => e.chave)).size, 5);
  });
  await teste(g, 'g e kg, L e mL, unidade sem conversão e arredondamento depois da soma', async () => {
    const regs = [reg(data, 'ins_cal', 7, { qtd: '1000', unidade: 'g' }), reg(data, 'ins_cal', 8, { qtd: '2', unidade: 'kg' }),
      reg(data, 'ins_lphera', 7, { qtd: '1.5', unidade: 'L' }), reg(data, 'ins_lphera', 8, { qtd: '10', unidade: 'mL' })];
    const r = leitura.criar(C).totais({ de: data, ate: data, dias: [data] }, regs);
    igual(r.total.insumos.filter((x) => x.prancheta === 'ins_cal').map((x) => [x.unidade, x.quantidade]), [['kg', 3]]);
    igual(r.total.insumos.filter((x) => x.prancheta === 'ins_lphera').map((x) => [x.unidade, x.quantidade]), [['mL', 1510]]);
    const copos = leitura.criar(C).totais({ de: data, ate: data, dias: [data] }, [reg(data, 'ins_cal', 7, { qtd: '2', unidade: 'copos' })]);
    igual(copos.total.insumos.find((x) => x.prancheta === 'ins_cal').unidade, 'copos');
  });
  for (const [nome, ligar, porta] of [['Node', centralNode, 8840], ['Java', centralJava, 8841]]) {
    const destino = await base44Falso(porta + 10), extras = { TURNO_AGORA: String(em('15:59')), TURNO_INTERVALO_MS: '150' };
    const pasta = pastaTemporaria('turno216');
    const c = nome === 'Node' ? await ligar(porta, pasta, undefined, extras) : await ligar(porta, pasta, extras);
    const cfgPath = path.join(c.pastaServidor, 'config.json');
    const estado = () => c.api('/api/turnos', { acao: 'estado' });
    try {
      await teste(g, nome + ': autenticação e função integracoes nas três ações', async () => {
        const sem = await fetch(c.url + '/api/turnos', { method: 'POST', body: JSON.stringify({ acao: 'estado' }) });
        certo([400, 401, 403, 426].includes(sem.status), 'sem conexão foi aceito: ' + sem.status);
        const setor = await conectarTeste(c.url, c.codigo());
        for (const acao of ['estado', 'configurar', 'enviar']) igual((await setor.pedir('/api/turnos', { corpo: { acao, url: destino.url, ligado: true } })).status, 403);
      });
      await teste(g, nome + ': valida URL, tipos e segredo; segredo criado só aparece uma vez', async () => {
        const cli = await c.cliente();
        // http pela internet: o segredo iria aberto (só https; http só na rede da usina, como o destino deste teste)
        for (const p of [{ url: 'javascript:alert(1)' }, { url: 'https://usuario:senha@example.com/' }, { url: 'http://example.com/totais' }, { url: 'http://8.8.8.8/totais' }, { ligado: 'sim' }, { segredo: 'x\r\ny' }, { segredo: '🔑' }])
          igual((await cli.pedir('/api/turnos', { corpo: { acao: 'configurar', ...p } })).status, 400);
        const e = await c.api('/api/turnos', { acao: 'configurar', url: destino.url, segredo: '', ligado: true, forms: C });
        certo(e.segredoCriado?.length >= 20, 'não criou segredo');
        igual(e.desde, data);
        const s = await estado(); certo(s.temSegredo && !s.segredo && !s.segredoCriado, 'segredo vazou no estado');
        await c.api('/api/turnos', { acao: 'configurar', segredo: 'SEGREDO-TURNO216' });
      });
      const regs = [reg(data, 'ins_lphera', 7, { qtd: '10' }), reg(data, 'ins_lphera', 8, { qtd: '2', unidade: 'L' }),
        reg(data, 'ins_cal', 7, { qtd: '1000', unidade: 'g' }), reg(data, 'ins_cal', 8, { qtd: '2', unidade: 'kg' }),
        reg(data, 'ins_materia_prima', 7, { qtd: '3', produto: 'MASSA' }), reg(data, 'hid_anexo1', 1, { fim: '10:00' }),
        reg(data, 'ins_lphera', 9, { qtd: '500' }, { apagado: true }), reg(data, 'ins_lphera', 'obs1', { qtd: '900' }),
        reg(antigo, 'ins_lphera', 7, { qtd: '99' })];
      await c.api('/api/sync', { registros: [...regs, reg('config', 'sistema', 'geral', { turnosSetor: { hidrolise: '12h' } })] });
      await teste(g, nome + ': não envia turno aberto nem histórico anterior a ligar', async () => {
        await new Promise((r) => setTimeout(r, 400));
        igual((await c.api('/api/turnos', { acao: 'enviar' })).quantidade, 0);
        igual(destino.recebidos.length, 0);
      });
      await teste(g, nome + ': agenda sozinha sem tela; POST idêntico à API, 12h e segredo', async () => {
        extras.TURNO_AGORA = String(em('19:00')); await c.reiniciar();
        await esperar(() => destino.recebidos.length === 2);
        await esperar(async () => Object.values((await estado()).enviados).filter((e) => e.ok).length === 2);
        const f = { ...C, turnosSetor: { hidrolise: '12h' } };
        const esperado = leitura.criar(f).totais({ de: data, ate: data, dias: [data] }, regs);
        for (const recebido of destino.recebidos) {
          igual(recebido.metodo, 'POST'); igual(recebido.segredo, 'SEGREDO-TURNO216');
          const { turnoEncerrado, ...total } = recebido.corpo;
          assert.deepEqual(total, esperado);
          certo([16, 19].includes(turnoEncerrado.fim), 'horário errado');
        }
        if (nome === 'Node') {
          const cfg = JSON.parse(fs.readFileSync(cfgPath));
          const r = await fetch(`${c.url}/api/v1/totais?dia=${data}`, { headers: { Authorization: 'Bearer ' + cfg.tokenLeitura } });
          assert.deepEqual(await r.json(), esperado);
        }
      });
      await teste(g, nome + ': persiste recibos; Mandar agora não duplica sem mudança', async () => {
        await c.reiniciar(); await c.api('/api/turnos', { acao: 'enviar' });
        igual(destino.recebidos.length, 2);
      });
      await teste(g, nome + ': correção reenvia; erro aguarda 10 minutos inclusive depois de reiniciar', async () => {
        destino.responder = 503;
        await c.api('/api/sync', { registros: [{ ...regs[0], valores: { qtd: '20' }, atualizadoEm: Date.now() + 2000 }] });
        await esperar(async () => Object.values((await estado()).enviados).some((e) => !e.ok));
        // Cada turno com erro ganha seu próprio intervalo; espere os dois serem tentados.
        await esperar(async () => Object.values((await estado()).enviados).filter((e) => !e.ok).length === 2);
        const n = destino.recebidos.length;
        await c.reiniciar(); await new Promise((r) => setTimeout(r, 400)); igual(destino.recebidos.length, n);
        extras.TURNO_AGORA = String(em('19:09')); await c.reiniciar(); await new Promise((r) => setTimeout(r, 400)); igual(destino.recebidos.length, n);
        destino.responder = 200; extras.TURNO_AGORA = String(em('19:10')); await c.reiniciar();
        await esperar(async () => Object.values((await estado()).enviados).every((e) => e.ok));
        igual(destino.recebidos.length, n + 2);
      });
      await teste(g, nome + ': meia-noite e 7h enviam os turnos finais do dia anterior', async () => {
        const amanha = new Date(data + 'T00:00:00'); amanha.setDate(amanha.getDate() + 1);
        extras.TURNO_AGORA = String(amanha.getTime()); await c.reiniciar();
        await esperar(() => destino.recebidos.some((r) => r.corpo.turnoEncerrado.fim === 24));
        amanha.setHours(7); extras.TURNO_AGORA = String(amanha.getTime()); await c.reiniciar();
        await esperar(() => destino.recebidos.filter((r) => r.corpo.turnoEncerrado.fim === 7).length === 2);
        certo(destino.recebidos.every((r) => r.corpo.de === data && r.corpo.ate === data), 'dia civil substituiu dia de produção');
      });
      await teste(g, nome + ': desligar impede envios e conserva endereço', async () => {
        const n = destino.recebidos.length;
        const e = await c.api('/api/turnos', { acao: 'configurar', ligado: false });
        igual(e.url, destino.url); igual(e.ligado, false);
        await c.api('/api/sync', { registros: [{ ...regs[0], valores: { qtd: '30' }, atualizadoEm: Date.now() + 4000 }] });
        igual((await c.api('/api/turnos', { acao: 'enviar' })).ok, false);
        await new Promise((r) => setTimeout(r, 400)); igual(destino.recebidos.length, n);
      });
    } finally { await c.desligar(); await destino.desligar(); }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const g = novoGrupo('Totais por turno 2.16'); await testarTurno216(g);
  const r = resumo([g]); console.log(`\n${r.passaram} de ${r.total} testes passaram`); process.exitCode = r.falharam ? 1 : 0;
}
