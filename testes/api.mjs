/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Testes da central pela rede, iguais para as duas centrais: a do computador (server.js)
 * e a do tablet chefe (ServidorCentral.java). Mesmo pedido, mesma resposta esperada.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { teste, certo, igual } from './teste.mjs';
import { dormir } from './navegador.mjs';

const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Pedido HTTP sem o navegador arrumar o caminho (para testar tentativas de sair da pasta). */
function cru(url, caminho, metodo = 'GET') {
  const u = new URL(url);
  return new Promise((resolve) => {
    const r = http.request({ host: u.hostname, port: u.port, path: caminho, method: metodo }, (res) => {
      const partes = []; res.on('data', (c) => partes.push(c)); res.on('end', () => resolve({ status: res.statusCode, texto: Buffer.concat(partes).toString('utf8'), headers: res.headers }));
    });
    r.on('error', (e) => resolve({ status: 0, texto: e.message, headers: {} }));
    r.end();
  });
}

export async function testarApi(central, grupo) {
  const U = central.url;
  const pedir = async (caminho, { metodo = 'GET', corpo, chave, texto } = {}) => {
    const headers = {};
    if (chave) headers['X-Chave'] = chave;
    let body;
    if (corpo !== undefined || texto !== undefined) { headers['Content-Type'] = 'application/json'; body = texto !== undefined ? texto : JSON.stringify(corpo); }
    try {
      const r = await fetch(U + caminho, { method: metodo, headers, body });
      const t = await r.text();
      let json = null; try { json = JSON.parse(t); } catch { /* não é JSON */ }
      return { status: r.status, json, texto: t, headers: r.headers };
    } catch (e) { return { status: 0, json: null, texto: e.message, headers: new Headers() }; }
  };
  const registro = (chaveLinha, valores, atualizadoEm = Date.now(), extra = {}) => Object.assign({
    id: `${hoje()}|hid_anexo1|${chaveLinha}`, data: hoje(), prancheta: 'hid_anexo1', setor: 'hidrolise', chave: String(chaveLinha),
    valores, criadoEm: atualizadoEm, atualizadoEm, aparelho: 'teste-api', apagado: false, sincronizado: false, operador: 'Teste',
  }, extra);
  let chave = null;

  await teste(grupo, 'ping responde e não entrega a chave', async () => {
    const r = await pedir('/api/ping');
    igual(r.status, 200); igual(r.json.app, 'pranchetas');
    certo(!r.texto.includes(central.chave()), 'a chave apareceu no ping');
  });
  await teste(grupo, 'código de conexão errado é recusado', async () => {
    const errado = central.codigo() === '000000' ? '111111' : '000000';
    const r = await pedir('/api/parear', { metodo: 'POST', corpo: { codigo: errado } });
    igual(r.status, 403); igual(r.json.erro, 'Código errado');
  });
  await teste(grupo, 'código certo entrega a chave da rede', async () => {
    const r = await pedir('/api/parear', { metodo: 'POST', corpo: { codigo: central.codigo(), aparelho: 'teste-api' } });
    igual(r.status, 200); certo(r.json.chave && r.json.chave === central.chave(), 'chave diferente');
    chave = r.json.chave;
  });
  await teste(grupo, 'sem chave, ou com chave errada, os dados ficam fechados', async () => {
    for (const c of [undefined, 'chave-errada']) {
      for (const rota of ['/api/registros', '/api/status', '/api/relatorios', '/api/erros']) {
        const r = await pedir(rota, { chave: c });
        igual(r.status, 401, rota);
      }
      const s = await pedir('/api/sync', { metodo: 'POST', corpo: { registros: [] }, chave: c });
      igual(s.status, 401, 'sync');
    }
  });
  let seqDepois = 0;
  await teste(grupo, 'envio de anotações: aceita, numera e manda a hora da central', async () => {
    const r = await pedir('/api/sync', { metodo: 'POST', chave, corpo: { aparelho: 'teste-api', papel: 'hidrolise', operador: 'Teste', versao: '9.9.9', registros: [registro(1, { phf: '4.6', brix: '18' }), registro(2, { phf: '5.1' })] } });
    igual(r.status, 200); igual(r.json.aceitos, 2); certo(r.json.seq >= 2, 'seq');
    certo(Math.abs(r.json.agora - Date.now()) < 5000, 'a central não mandou a hora certa: ' + r.json.agora);
    seqDepois = r.json.seq;
  });
  await teste(grupo, 'busca de anotações a partir de um número (só o que é novo)', async () => {
    const tudo = await pedir('/api/registros?desde=0', { chave });
    certo(tudo.json.registros.some((x) => x.id.endsWith('|1') && x.valores.phf === '4.6'), 'não voltou a dorna 1');
    const nada = await pedir('/api/registros?desde=' + seqDepois, { chave });
    igual(nada.json.registros.length, 0, 'depois do último número');
    const zerado = await pedir('/api/registros?desde=' + (seqDepois + 5000), { chave });
    certo(zerado.json.registros.length >= 2, 'aparelho com número maior que o da central deveria receber tudo');
  });
  await teste(grupo, 'conflito: versão mais antiga não apaga a mais nova', async () => {
    const velho = await pedir('/api/sync', { metodo: 'POST', chave, corpo: { aparelho: 'teste-api', registros: [registro(1, { phf: '9.9' }, Date.now() - 3600000)] } });
    igual(velho.json.aceitos, 0, 'aceitou a versão velha');
    const novo = await pedir('/api/sync', { metodo: 'POST', chave, corpo: { aparelho: 'teste-api', registros: [registro(1, { phf: '4.7', brix: '18' }, Date.now() + 10)] } });
    igual(novo.json.aceitos, 1);
    const r = await pedir('/api/registros?desde=0', { chave });
    igual(r.json.registros.find((x) => x.id.endsWith('|1')).valores.phf, '4.7');
  });
  await teste(grupo, 'anotação sem identificação é ignorada', async () => {
    const r = await pedir('/api/sync', { metodo: 'POST', chave, corpo: { registros: [{ valores: { a: 1 } }, { id: 'x' }, null, 'lixo'] } });
    igual(r.status, 200); igual(r.json.aceitos, 0);
  });
  await teste(grupo, 'pedido com JSON quebrado não derruba a central', async () => {
    const r = await pedir('/api/sync', { metodo: 'POST', chave, texto: '{"registros": [ quebrado' });
    igual(r.status, 400);
    const ping = await pedir('/api/ping'); igual(ping.status, 200, 'central caiu');
  });
  await teste(grupo, 'lista de aparelhos mostra versão e se está ligado', async () => {
    await pedir('/api/sync', { metodo: 'POST', chave, corpo: { aparelho: 'teste-api', papel: 'hidrolise', operador: 'Teste', versao: '9.9.9', registros: [] } });
    const r = await pedir('/api/status', { chave });
    const a = r.json.aparelhos.find((x) => x.id === 'teste-api');
    certo(a, 'aparelho não apareceu'); igual(a.online, true); igual(a.versao, '9.9.9'); igual(a.papel, 'hidrolise');
    certo(/^\d{6}$/.test(r.json.codigo), 'código');
  });
  await teste(grupo, 'relatório: recusa data e tipo de arquivo errados', async () => {
    const b64 = Buffer.from('conteudo').toString('base64');
    igual((await pedir('/api/relatorio', { metodo: 'POST', chave, corpo: { data: '21/09/2026', nome: 'a.xlsx', base64: b64 } })).status, 400, 'data');
    igual((await pedir('/api/relatorio', { metodo: 'POST', chave, corpo: { data: hoje(), nome: 'virus.exe', base64: b64 } })).status, 400, 'exe');
  });
  await teste(grupo, 'relatório: nome com ../ fica preso na pasta do dia', async () => {
    const conteudo = Buffer.from('PK teste ' + Date.now());
    const r = await pedir('/api/relatorio', { metodo: 'POST', chave, corpo: { data: hoje(), nome: '../../../fora.xlsx', base64: conteudo.toString('base64') } });
    igual(r.status, 200);
    certo(!fs.existsSync(path.join(central.pasta, 'fora.xlsx')) && !fs.existsSync(path.join(path.dirname(central.pasta), 'fora.xlsx')), 'saiu da pasta');
    const arq = path.join(central.pastaRelatorios, hoje(), 'fora.xlsx');
    certo(fs.existsSync(arq), 'não salvou na pasta do dia: ' + arq);
    igual(fs.readFileSync(arq).toString(), conteudo.toString(), 'conteúdo');
  });
  await teste(grupo, 'relatório guardado aparece na lista, na página e baixa igual', async () => {
    const conteudo = 'PK' + 'x'.repeat(5000);
    await pedir('/api/relatorio', { metodo: 'POST', chave, corpo: { data: hoje(), nome: 'Pranchetas_teste.xlsx', base64: Buffer.from(conteudo).toString('base64') } });
    const l = await pedir('/api/relatorios', { chave });
    const dia = l.json.dias.find((d) => d.data === hoje());
    certo(dia && dia.arquivos.some((a) => a.nome === 'Pranchetas_teste.xlsx' && a.tamanho === conteudo.length), 'não está na lista');
    const pagina = await pedir('/relatorios');
    igual(pagina.status, 200, 'página'); certo(pagina.texto.includes('Pranchetas_teste.xlsx'), 'página sem o arquivo');
    const baixado = await pedir(`/relatorios/${hoje()}/Pranchetas_teste.xlsx`);
    igual(baixado.status, 200); igual(baixado.texto, conteudo, 'arquivo baixado');
  });
  await teste(grupo, 'erros dos aparelhos ficam guardados (e cortados se forem enormes)', async () => {
    await pedir('/api/sync', { metodo: 'POST', chave, corpo: { aparelho: 'teste-api', registros: [], erros: [{ quando: Date.now(), versao: '9.9.9', papel: 'hidrolise', tela: 'prancheta', msg: 'erro de teste <script>' + 'x'.repeat(1000), detalhe: 'pilha' }] } });
    const r = await pedir('/api/erros', { chave });
    igual(r.status, 200);
    const e = r.json.erros.find((x) => String(x.msg).startsWith('erro de teste'));
    certo(e, 'erro não guardado'); certo(e.msg.length <= 300, 'não cortou: ' + e.msg.length); igual(e.aparelho, 'teste-api');
    certo(fs.existsSync(path.join(central.pastaServidor, 'erros.log')), 'sem erros.log');
  });
  await teste(grupo, 'arquivos do aplicativo: página, script, página de baixar e 404', async () => {
    const pag = await pedir('/'); igual(pag.status, 200); certo(/text\/html/.test(pag.headers.get('content-type')), 'tipo da página');
    const js = await pedir('/app.js'); igual(js.status, 200); certo(/javascript/.test(js.headers.get('content-type')), 'tipo do script');
    igual((await pedir('/baixar')).status, 200, 'baixar');
    igual((await pedir('/nao-existe.js')).status, 404, '404');
  });
  await teste(grupo, 'tentativas de sair da pasta não entregam arquivos da central', async () => {
    const segredos = [central.chave(), 'registros', '"codigo"'];
    const caminhos = ['/..%2fserver.js', '/..%5cserver.js', '/%2e%2e/server.js', '/..%2f..%2fdados%2fServidorUsina%2fconfig.json',
      '/relatorios/..%2f..%2fServidorUsina%2fconfig.json', `/relatorios/${hoje()}/..%5c..%5cServidorUsina%5cconfig.json`,
      `/relatorios/${hoje()}/..%2f..%2fServidorUsina%2fconfig.json`, '/../ServidorUsina/config.json', '/public/../../server.js'];
    for (const c of caminhos) {
      const r = await cru(U, c);
      certo(!(r.status === 200 && segredos.some((s) => r.texto.includes(s)) && !r.texto.startsWith('<!doctype')), `vazou com ${c} (status ${r.status})`);
      certo(!r.texto.includes(central.chave()), `a chave apareceu com ${c}`);
    }
  });
  await teste(grupo, 'CORS e pedido OPTIONS (o aplicativo roda em outro endereço)', async () => {
    const r = await cru(U, '/api/sync', 'OPTIONS');
    igual(r.status, 204); igual(r.headers['access-control-allow-origin'], '*');
    certo(/X-Chave/i.test(r.headers['access-control-allow-headers'] || ''), 'X-Chave não liberado');
  });
  await teste(grupo, 'download do aplicativo informa o tamanho (HEAD)', async () => {
    const r = await cru(U, '/apk/pranchetas.apk', 'HEAD');
    if (r.status === 404) return 'sem APK gerado';
    igual(r.status, 200); certo(Number(r.headers['content-length']) > 1000000, 'tamanho: ' + r.headers['content-length']);
    return (Number(r.headers['content-length']) / 1048576).toFixed(1) + ' MB';
  });
  await teste(grupo, 'rota desconhecida responde 404 em JSON', async () => {
    const r = await pedir('/api/nao-existe', { chave }); igual(r.status, 404); certo(r.json && r.json.erro, 'sem erro em JSON');
  });
  await teste(grupo, 'muitos aparelhos mandando ao mesmo tempo: nada se perde', async () => {
    const antes = (await pedir('/api/registros?desde=0', { chave })).json.registros.length;
    const envios = Array.from({ length: 20 }, (_, a) => pedir('/api/sync', { metodo: 'POST', chave, corpo: {
      aparelho: 'carga-' + a, registros: Array.from({ length: 50 }, (_, i) => registro(`c${a}-${i}`, { brix: String(i) }, Date.now(), { id: `${hoje()}|caldeira|c${a}-${i}`, prancheta: 'caldeira' })),
    } }));
    const respostas = await Promise.all(envios);
    certo(respostas.every((r) => r.status === 200 && r.json.aceitos === 50), 'algum envio falhou');
    const depois = (await pedir('/api/registros?desde=0', { chave })).json.registros;
    igual(depois.length - antes, 1000, 'anotações novas');
    igual(new Set(depois.map((r) => r.seq)).size, depois.length, 'número repetido');
  });
  await teste(grupo, 'volume de um mês (7.500 anotações): tempo de envio e de busca', async () => {
    const t0 = Date.now();
    for (let lote = 0; lote < 15; lote++) {
      const r = await pedir('/api/sync', { metodo: 'POST', chave, corpo: { aparelho: 'mes', registros: Array.from({ length: 500 }, (_, i) => registro(`m${lote}-${i}`, { phf: '5.0', brix: '17', enzi: '70', produto: 'MASSA' }, Date.now(), { id: `2026-08-${String((i % 28) + 1).padStart(2, '0')}|hid_anexo1|m${lote}-${i}`, data: `2026-08-${String((i % 28) + 1).padStart(2, '0')}` })) } });
      igual(r.status, 200, 'lote ' + lote);
    }
    const envio = Date.now() - t0;
    const t1 = Date.now();
    const r = await pedir('/api/registros?desde=0', { chave });
    const busca = Date.now() - t1;
    certo(r.json.registros.length > 8000, 'faltou anotação');
    certo(busca < 8000, 'busca lenta: ' + busca + ' ms');
    return `envio ${envio} ms, busca de tudo ${busca} ms, ${(r.texto.length / 1048576).toFixed(1)} MB`;
  });
  await teste(grupo, 'central reiniciada: nada se perde e o código continua o mesmo', async () => {
    const codigo = central.codigo(); const seq = (await pedir('/api/status', { chave })).json.seq;
    await dormir(800); // espera a gravação em disco
    await central.reiniciar();
    const st = await pedir('/api/status', { chave });
    igual(st.status, 200, 'chave depois de reiniciar'); igual(st.json.seq, seq, 'número'); igual(central.codigo(), codigo, 'código');
    const r = await pedir('/api/registros?desde=0', { chave });
    certo(r.json.registros.find((x) => x.id.endsWith('|hid_anexo1|1')).valores.phf === '4.7', 'dorna 1 sumiu');
    certo(fs.existsSync(path.join(central.pastaBackup, hoje() + '.json')), 'sem backup do dia');
  });
  await teste(grupo, 'trocar o código: o antigo para de funcionar e o novo funciona', async () => {
    const antigo = central.codigo();
    const r = await pedir('/api/novo-codigo', { metodo: 'POST', chave, corpo: {} });
    igual(r.status, 200); certo(r.json.codigo !== antigo && /^\d{6}$/.test(r.json.codigo), 'código novo');
    igual((await pedir('/api/parear', { metodo: 'POST', corpo: { codigo: antigo } })).status, 403, 'antigo');
    igual((await pedir('/api/parear', { metodo: 'POST', corpo: { codigo: r.json.codigo } })).status, 200, 'novo');
  });
  await teste(grupo, 'quem chuta códigos é bloqueado por um minuto', async () => {
    let bloqueou = false;
    for (let i = 0; i < 9 && !bloqueou; i++) {
      const r = await pedir('/api/parear', { metodo: 'POST', corpo: { codigo: '99999' + (i % 10) } });
      if (r.status === 429) bloqueou = true;
    }
    certo(bloqueou, 'nunca bloqueou');
  });
}
