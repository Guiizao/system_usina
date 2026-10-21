/* Totais e aviso de atualização 2.16: node testes/totais216.mjs [--sqlite]. Só pastas temporárias. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import leitura from '../api-leitura.js';
import { teste, certo, igual, novoGrupo, resumo } from './teste.mjs';
import { APP, centralNode, centralJava, pastaTemporaria } from './servidores.mjs';
import { ligarNuvem } from './nuvem.mjs';
import { chaveDeTeste } from './atualizacao.mjs';

const SEGREDO = 'segredo-totais216', TOKEN = 'leitura-totais216';
const dia = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
const seguinte = new Date(Date.parse(dia) + 86400000).toISOString().slice(0, 10);
const terceiro = new Date(Date.parse(dia) + 2 * 86400000).toISOString().slice(0, 10);
function forms() {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(APP, 'public/forms.js'), 'utf8'), ctx);
  return JSON.parse(JSON.stringify(ctx.window.USINA));
}
function registros(data) {
  const reg = (prancheta, chave, valores, extra = {}) => ({ id: `${data}|${prancheta}|${chave}`, data, prancheta,
    chave: String(chave), valores, atualizadoEm: Date.now(), ...extra });
  return [
    ...[7, 15, 16, 18, 19, 23, 0, 6].map((h, i) => reg('ins_lphera', h, { qtd: String(i + 1) })),
    reg('ins_lphera', 8, { qtd: '2', unidade: 'L' }),
    reg('ins_lphera', 9, { qtd: '900' }, { apagado: true }),
    reg('ins_lphera', 'meta', { qtd: '900' }), reg('ins_lphera', 'obs1', { qtd: '900' }),
    reg('ins_lphera', 10, { qtd: '' }), reg('ins_lphera', 11, { qtd: 'inválido' }),
    reg('ins_materia_prima', 7, { qtd: '1.25', produto: 'MASSA' }),
    reg('ins_materia_prima', 19, { qtd: '2.75', produto: 'FINI' }),
    reg('ins_materia_prima', 0, { qtd: '3', produto: 'MASSA' }),
    reg('ins_cal', 7, { qtd: '0.004' }),
    reg('hid_anexo1', 1, { fim: '08:00' }), reg('hid_anexo1', 2, { fim: '' }),
    reg('hid_anexo1', 3, { fim: '09:00' }, { apagado: true }), reg('hid_anexo1', 'meta', { fim: '10:00' }),
    reg('caldeira', 7, { qtd: '900', pressao: '7' }), reg('destilaria', 7, { qtd: '900', producao: '150' }),
  ];
}
const item = (total, pid, unidade) => total.insumos.find((x) => x.prancheta === pid && (!unidade || x.unidade === unidade));
async function esperar(fn) {
  const inicio = Date.now();
  while (Date.now() - inicio < 12000) { if (await fn()) return; await new Promise((r) => setTimeout(r, 100)); }
  throw new Error('não aconteceu em 12 segundos');
}

export async function testarTotais216(g, sqlite = false) {
  const C = forms(), intervalo = leitura.intervaloTotais(new URLSearchParams({ de: dia, ate: terceiro }));
  const regs = [...registros(dia), ...registros(seguinte)];
  await teste(g, 'soma por unidade e por hora do turno, produtos e dornas; exclui meta, apagados e grades', async () => {
    const r = leitura.criar(C).totais(intervalo, regs), d = r.dias[0];
    igual(item(d, 'ins_lphera', 'mL').quantidade, 36);
    igual(item(d, 'ins_lphera', 'mL').turnos.map((t) => t.quantidade), [3, 18, 15]);
    igual(item(d, 'ins_lphera', 'L').quantidade, 2);
    igual(item(d, 'ins_materia_prima').produtos, [{ produto: 'MASSA', quantidade: 4.25 }, { produto: 'FINI', quantidade: 2.75 }]);
    igual(d.dornasFinalizadas, 1); igual(r.total.dornasFinalizadas, 2);
    certo(d.insumos.every((x) => C.pranchetas[x.prancheta].tipo === 'insumo'), 'só insumos');
    igual(item(r.total, 'ins_lphera', 'mL').quantidade, 72);
    igual(item(r.total, 'ins_cal').quantidade, 0.01, 'arredonda só depois de somar o período');
    certo(r.dias[2].insumos.every((x) => x.quantidade === 0), 'dia vazio com zeros');
    igual(r.dias[2].dornasFinalizadas, 0);
  });
  await teste(g, '12 h por setor: 19h, meia-noite e 6h ficam no segundo turno', async () => {
    const r = leitura.criar({ ...C, turnosSetor: { hidrolise: '12h' } }).totais(intervalo, regs);
    igual(item(r.dias[0], 'ins_lphera', 'mL').turnos.map((t) => t.quantidade), [10, 26]);
    igual(item(r.dias[0], 'ins_materia_prima').turnos.length, 3, 'outro setor mantém os turnos');
  });

  const nuvem = sqlite ? await (await import('./nuvem-sqlite.mjs')).ligarNuvemSQLite(8836, SEGREDO, TOKEN) : await ligarNuvem(8836);
  // O helper Wrangler usa as credenciais comuns da suíte.
  const segredo = sqlite ? SEGREDO : 'segredo-da-central-de-teste';
  const token = sqlite ? TOKEN : 'senha-de-leitura-de-teste';
  const chave = chaveDeTeste();
  const pacote = path.join(nuvem.publico, 'telas');
  const publicar = async (versao, defeito = '') => {
    fs.mkdirSync(pacote, { recursive: true });
    const html = Buffer.from('<title>' + versao + '</title>');
    const p = JSON.stringify({ versao, apkMinimo: '2.15.0', arquivos: {
      'index.html': { tamanho: html.length, sha256: crypto.createHash('sha256').update(html).digest('hex') },
    } });
    fs.writeFileSync(path.join(pacote, 'index.html'), html);
    fs.writeFileSync(path.join(pacote, 'pacote.json'), p);
    fs.writeFileSync(path.join(pacote, 'pacote.sig'), crypto.sign('sha256', Buffer.from(p), fs.readFileSync(chave.privada)).toString('base64'));
    if (defeito === 'assinatura') fs.writeFileSync(path.join(pacote, 'pacote.sig'), 'inválida');
    if (defeito === 'arquivo') fs.writeFileSync(path.join(pacote, 'index.html'), 'adulterado');
    if (!sqlite) await new Promise((r) => setTimeout(r, 2500)); // o Wrangler observa os arquivos
  };
  try {
    await publicar('2.16.0');
    await teste(g, 'nuvem devolve o pacote publicado ao enviar e ao sync sem central', async () => {
      const envio = await nuvem.pedir('/central/enviar', { senha: segredo, corpo: { registros: [], forms: C, geracao: 'teste216' } });
      igual(envio.json.telas, { versao: '2.16.0', apkMinimo: '2.15.0' });
      const aparelho = 'tablet216', senha = crypto.createHmac('sha256', segredo).update('aparelho|' + aparelho).digest('hex');
      const sync = await nuvem.pedir('/aparelho/sync', { senha, aparelho, corpo: { registros: [], geracao: 'teste216' } });
      igual(sync.status, 200); igual(sync.json.telas, envio.json.telas);
    });
    for (const [nome, ligar, porta] of [['computador', centralNode, 8236], ['tablet chefe', centralJava, 8237]]) {
      const pasta = pastaTemporaria('totais216'), apk = pastaTemporaria('apk216');
      const c = nome === 'computador' ? await ligar(porta, pasta, undefined, { PASTA_APK: apk, CHAVE_TELAS: chave.publica }) : await ligar(porta, pasta);
      const local = nome === 'computador' ? path.join(apk, 'telas') : path.join(pasta, 'telas/2.15.0');
      fs.mkdirSync(local, { recursive: true });
      fs.writeFileSync(path.join(local, 'index.html'), '<title>teste</title>');
      fs.writeFileSync(path.join(local, 'pacote.json'), JSON.stringify({ versao: '2.15.0', apkMinimo: '2.14.0' }));
      if (nome !== 'computador') fs.writeFileSync(path.join(pasta, 'telas/ativa.txt'), '2.15.0|2.7.0');
      await publicar('2.16.0');
      try {
        await teste(g, nome + ': sync anuncia o pacote local antes de ligar a nuvem', async () => {
          igual((await c.api('/api/sync', { registros: [] })).atualizacao, { versao: '2.15.0', apkMinimo: '2.14.0' });
        });
        await c.api('/api/sync', { registros: [...regs, ...registros('2020-01-01'), {
          id: 'config|sistema|geral', data: 'config', prancheta: 'sistema', chave: 'geral',
          valores: { turnosSetor: { hidrolise: '12h' } }, atualizadoEm: Date.now(),
        }] });
        await c.api('/api/nuvem', { acao: 'forms', forms: { ...C, turnosSetor: { hidrolise: '12h' } } });
        await c.api('/api/nuvem', { acao: 'configurar', url: nuvem.url, segredo });
        await c.api('/api/nuvem', { acao: 'enviar' });
        await teste(g, nome + ': nuvem vira aviso no sync, persiste e ganha da versão local', async () => {
          await esperar(async () => (await c.api('/api/sync', { registros: [] })).atualizacao?.versao === '2.16.0');
          igual(JSON.parse(fs.readFileSync(path.join(c.pastaServidor, 'config.json'))).nuvem.telas, { versao: '2.16.0', apkMinimo: '2.15.0' });
          await c.reiniciar();
          igual((await c.api('/api/sync', { registros: [] })).atualizacao.versao, '2.16.0');
        });
        const pedirLocal = async (query, senha = JSON.parse(fs.readFileSync(path.join(c.pastaServidor, 'config.json'))).tokenLeitura, method = 'GET') => {
          const r = await fetch(c.url + '/api/v1/totais?' + query, { method, headers: { Authorization: 'Bearer ' + senha } });
          return { status: r.status, json: await r.json() };
        };
        const pedirNuvem = (query, senha = token) => nuvem.pedir('/api/v1/totais?' + query, { senha });
        for (const [onde, pedir] of [...(nome === 'computador' ? [['API local', pedirLocal]] : []), ['nuvem via ' + nome, pedirNuvem]]) {
          await teste(g, onde + ': período, dia e 12 h configuradas' + (onde === 'API local' ? ', incluindo arquivo antigo' : ''), async () => {
            const r = await pedir(`de=${dia}&ate=${terceiro}`);
            igual(r.status, 200);
            igual(item(r.json.total, 'ins_lphera', 'mL').quantidade, 72);
            igual(item(r.json.dias[0], 'ins_lphera', 'mL').turnos.map((t) => t.quantidade), [10, 26]);
            igual((await pedir('dia=' + dia)).json.total.dornasFinalizadas, 1);
            if (onde === 'API local') igual(item((await pedir('dia=2020-01-01')).json.total, 'ins_lphera', 'mL').quantidade, 36);
          });
          await teste(g, onde + ': Bearer obrigatório, datas reais, intervalo inclusivo de até 62 dias', async () => {
            igual((await pedir('dia=' + dia, 'errada')).status, 401);
            for (const q of ['', 'dia=2026-02-30', 'dia=2025-02-29', 'de=2026-01-01', 'de=2026-02-01&ate=2026-01-01',
              'de=2026-01-01&ate=2026-03-04', `dia=${dia}&de=${dia}`, `dia=${dia}&dia=${dia}`, `dia=${dia}&extra=1`]) igual((await pedir(q)).status, 400, q);
            igual((await pedir('de=2026-01-01&ate=2026-03-03')).json.dias.length, 62);
            igual((await pedir('dia=2024-02-29')).status, 200);
            if (onde === 'API local') igual((await pedirLocal('dia=' + dia, undefined, 'POST')).status, 405);
          });
        }
        await teste(g, nome + ': corrigir e apagar recalcula o total da nuvem, sem duplicar', async () => {
          const base = registros(dia), atualizadoEm = Date.now() + 2000;
          await c.api('/api/sync', { registros: [
            { ...base[0], valores: { qtd: '11' }, atualizadoEm },
            { ...base[1], apagado: true, atualizadoEm },
          ] });
          await c.api('/api/nuvem', { acao: 'enviar' });
          igual(item((await pedirNuvem(`de=${dia}&ate=${terceiro}`)).json.total, 'ins_lphera', 'mL').quantidade, 80);
          if (nome === 'computador') igual((await pedirLocal(`de=${dia}&ate=${terceiro}`)).json, (await pedirNuvem(`de=${dia}&ate=${terceiro}`)).json);
        });
        await teste(g, nome + ': versão nova sem lançamentos chega no próximo envio vazio', async () => {
          await publicar('2.16.1');
          await c.api('/api/nuvem', { acao: 'enviar' });
          await esperar(async () => (await c.api('/api/sync', { registros: [] })).atualizacao?.versao === '2.16.1');
          if (nome === 'computador') igual((await (await fetch(c.url + '/telas/pacote.json')).json()).versao, '2.16.1', 'baixou já, sem esperar seis horas');
        });
        await teste(g, nome + ': pacote local mais novo vence; reinício/geração antiga também informa', async () => {
          fs.writeFileSync(path.join(local, 'pacote.json'), JSON.stringify({ versao: '2.17.0', apkMinimo: '2.16.0' }));
          igual((await c.api('/api/sync', { registros: [], geracao: 'antiga' })).atualizacao, { versao: '2.17.0', apkMinimo: '2.16.0' });
        });
        if (nome === 'computador') await teste(g, 'computador: assinatura inválida não substitui telas, mas o aviso permanece', async () => {
          await publicar('2.18.0', 'assinatura');
          await c.api('/api/nuvem', { acao: 'enviar' });
          igual((await c.api('/api/sync', { registros: [] })).atualizacao.versao, '2.18.0');
          igual((await (await fetch(c.url + '/telas/pacote.json')).json()).versao, '2.17.0');
        });
        if (nome === 'computador') await teste(g, 'computador: arquivo alterado também é recusado após conferir a assinatura', async () => {
          await publicar('2.18.1', 'arquivo');
          await c.api('/api/nuvem', { acao: 'enviar' });
          igual((await (await fetch(c.url + '/telas/pacote.json')).json()).versao, '2.17.0');
        });
      } finally { await c.desligar(); }
    }
    await teste(g, 'pacote ausente não quebra envio nem sync da nuvem', async () => {
      fs.unlinkSync(path.join(pacote, 'pacote.json'));
      if (!sqlite) await new Promise((r) => setTimeout(r, 2500));
      igual((await nuvem.pedir('/central/enviar', { senha: segredo, corpo: { registros: [] } })).json.telas, null);
      const aparelho = 'tablet216', senha = crypto.createHmac('sha256', segredo).update('aparelho|' + aparelho).digest('hex');
      igual((await nuvem.pedir('/aparelho/sync', { senha, aparelho, corpo: { registros: [] } })).json.telas, null);
    });
  } finally { await nuvem.desligar(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const g = novoGrupo('Totais e atualização 2.16');
  await testarTotais216(g, process.argv.includes('--sqlite'));
  const r = resumo([g]); console.log(`\n${r.passaram} de ${r.total} testes passaram`);
  process.exitCode = r.falharam ? 1 : 0;
}
