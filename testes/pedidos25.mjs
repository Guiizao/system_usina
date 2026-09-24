/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Versão 2.5 (pedidos de 24/09, escolhidos depois do teste na área):
 *   - Totais direto no Base44: os totais de cada insumo vão sozinhos para o sistema do escritório quando o dia fecha.
 *   - Criptografar o Wi-Fi: tudo entre os aparelhos e a central passa embaralhado (também no navegador sem WebCrypto).
 * O Base44 aqui é um servidor de mentira no próprio computador, que guarda o que recebeu.
 */
import http from 'node:http';
import { TAMANHOS, dormir } from './navegador.mjs';
import { teste, certo, igual, teclasDaSenha } from './teste.mjs';

/** Base44 de mentira: guarda cada envio. responder = status que ele devolve (200, 401...). */
export async function base44Falso(porta) {
  const recebidos = [];
  const b = { recebidos, responder: 200, url: `http://127.0.0.1:${porta}/functions/receberTotaisPranchetas` };
  const srv = http.createServer((req, res) => {
    const partes = [];
    req.on('data', (c) => partes.push(c));
    req.on('end', () => {
      let corpo = null; try { corpo = JSON.parse(Buffer.concat(partes).toString('utf8')); } catch { /* não é JSON */ }
      recebidos.push({ caminho: req.url, metodo: req.method, segredo: req.headers['x-pranchetas-segredo'], corpo, em: Date.now() });
      res.writeHead(b.responder, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(b.responder === 200 ? { ok: true, gravados: corpo && corpo.itens ? corpo.itens.length : 0 } : { erro: 'segredo errado' }));
    });
  });
  await new Promise((r) => srv.listen(porta, '127.0.0.1', r));
  b.desligar = () => new Promise((r) => srv.close(r));
  return b;
}

const diaProducao = (n = 0) => { const d = new Date(Date.now() - 7 * 3600000); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const insumo = (data, pid, hora, qtd, unidade, t = Date.now()) => ({ id: `${data}|${pid}|${hora}`, data, prancheta: pid, setor: 'hidrolise', chave: String(hora), valores: { qtd: String(qtd), unidade }, criadoEm: t, atualizadoEm: t, aparelho: 'tablet-teste', apagado: false, operador: 'Teste' });

/** A central manda os totais para o Base44 (sem navegador). Roda nas duas centrais. */
export async function testarBase44Central(central, porta, grupo) {
  const b44 = await base44Falso(porta);
  const api = (rota, corpo) => central.api(rota, corpo);
  const dados = (data, qtd) => ({ origem: 'Pranchetas Ubirálcool', data, itens: [{ setor: 'Hidrólise', insumo: 'LPHERA', folha: 'ins_lphera', quantidade: qtd, unidade: 'mL' }] });
  const ontem = diaProducao(1);
  try {
    await teste(grupo, 'sem endereço cadastrado o envio é recusado e o estado diz desligado', async () => {
      const e = await api('/api/base44', { acao: 'estado' });
      igual(e.ligado, false); igual(e.temSegredo, false);
      const r = await api('/api/base44', { acao: 'enviar', data: ontem, hash: 'a', dados: dados(ontem, 1) });
      certo(/não foi cadastrado/.test(r.erro || ''), 'erro: ' + r.erro);
    });
    await teste(grupo, 'endereço errado é recusado; o certo fica guardado só na central', async () => {
      const ruim = await api('/api/base44', { acao: 'configurar', url: 'base44 do lucas' });
      certo(/Endereço inválido/.test(ruim.erro || ''), 'aceitou endereço errado');
      const e = await api('/api/base44', { acao: 'configurar', url: b44.url, segredo: 'SEGREDO-TESTE-123', desde: ontem });
      igual(e.ligado, true); igual(e.url, b44.url); igual(e.temSegredo, true); igual(e.desde, ontem);
      certo(!JSON.stringify(e).includes('SEGREDO-TESTE-123'), 'o segredo voltou para o aparelho');
      const st = await api('/api/status');
      igual(st.base44.ligado, true, 'status');
      certo(!JSON.stringify(st).includes('SEGREDO-TESTE-123') && !JSON.stringify(st).includes(b44.url), 'o status (que vai para os tablets chefes) levou o endereço ou o segredo');
    });
    await teste(grupo, 'enviar: chega no Base44 com o segredo e os totais; sem mudança não vai de novo', async () => {
      const r = await api('/api/base44', { acao: 'enviar', data: ontem, hash: 'h1', dados: dados(ontem, 100) });
      igual(r.ok, true, 'envio ' + r.erro);
      igual(b44.recebidos.length, 1, 'chegou no Base44');
      const x = b44.recebidos[0];
      igual(x.metodo, 'POST'); igual(x.caminho, '/functions/receberTotaisPranchetas'); igual(x.segredo, 'SEGREDO-TESTE-123', 'segredo');
      igual(x.corpo.data, ontem); igual(x.corpo.itens[0].quantidade, 100);
      const de = await api('/api/base44', { acao: 'enviar', data: ontem, hash: 'h1', dados: dados(ontem, 100) });
      igual(de.jaEnviado, true, 'foi de novo sem mudança'); igual(b44.recebidos.length, 1);
      const mudou = await api('/api/base44', { acao: 'enviar', data: ontem, hash: 'h2', dados: dados(ontem, 120) });
      igual(mudou.ok, true); igual(b44.recebidos.length, 2, 'folha corrigida não foi de novo'); igual(b44.recebidos[1].corpo.itens[0].quantidade, 120);
      await api('/api/base44', { acao: 'enviar', data: ontem, hash: 'h2', dados: dados(ontem, 120), forcar: true });
      igual(b44.recebidos.length, 3, 'mandar de novo à mão');
      const st = await api('/api/status');
      igual(st.base44.enviados[ontem].ok, true); igual(st.base44.enviados[ontem].hash, 'h2');
    });
    await teste(grupo, 'Base44 recusando o segredo, ou sem internet: fica anotado o erro', async () => {
      b44.responder = 401;
      const r = await api('/api/base44', { acao: 'enviar', data: diaProducao(2), hash: 'x', dados: dados(diaProducao(2), 5) });
      igual(r.ok, false); igual(r.erro, 'O Base44 recusou o segredo');
      b44.responder = 200;
      await api('/api/base44', { acao: 'configurar', url: 'http://127.0.0.1:1/functions/x' });
      const sem = await api('/api/base44', { acao: 'enviar', data: diaProducao(3), hash: 'y', dados: dados(diaProducao(3), 5) });
      igual(sem.ok, false); igual(sem.erro, 'Sem internet na central (ou endereço errado)');
      const e = await api('/api/base44', { acao: 'estado' });
      igual(e.enviados[diaProducao(2)].erro, 'O Base44 recusou o segredo'); igual(e.enviados[diaProducao(3)].ok, false);
      await api('/api/base44', { acao: 'configurar', url: b44.url });
      igual((await api('/api/base44', { acao: 'estado' })).temSegredo, true, 'trocar o endereço apagou o segredo');
    });
    await teste(grupo, 'central reiniciada: endereço, segredo e dias enviados continuam', async () => {
      await dormir(600);
      await central.reiniciar();
      const e = await api('/api/base44', { acao: 'estado' });
      igual(e.url, b44.url); igual(e.temSegredo, true); igual(e.enviados[ontem].hash, 'h2');
      await api('/api/base44', { acao: 'configurar', url: '' });
      igual((await api('/api/base44', { acao: 'estado' })).ligado, false, 'desligar');
    });
  } finally { await b44.desligar(); }
}

/** No aplicativo: o tablet chefe manda sozinho quando o dia fecha, e à mão pelas configurações. E o Wi-Fi embaralhado
    também no navegador sem WebCrypto (o computador do escritório aberto por http://endereço). */
export async function testarPedidos25(nav, ligar, porta, grupo, { correcao = true } = {}) {
  const c = await ligar(porta);
  const b44 = await base44Falso(porta + 50);
  const aparelhos = [];
  async function novo(nome, tamanho) { const a = await nav.novoAparelho(nome, tamanho); aparelhos.push(a); return a; }
  async function conectar(a, papel, operador, { semIr = false } = {}) {
    if (!semIr) await a.ir(c.url + '/', 'document.querySelector("[data-quadro=\\"codigo\\"]")');
    await a.tocar('[data-quadro="codigo"]');
    await a.teclar(c.codigo().split(''));
    await a.tocar('[data-ed="ocultar"]');
    await a.tocar('[data-a="conectar"]');
    await a.tocar(`[data-a="papel"][data-id="${papel}"]`, null, { esperarMs: 15000 });
    if (operador) await a.tocar(`[data-a="escolher-operador"][data-nome="${operador}"]`);
  }
  const esperarBase44 = async (filtro, descricao, ms = 30000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const r = b44.recebidos.find(filtro); if (r) return r; await dormir(500); }
    throw new Error(`não chegou no Base44 em ${ms / 1000}s: ${descricao}`);
  };
  const ontem = diaProducao(1);
  // a notificação fica no alto, por cima dos botões da barra: um toque fecha (como a pessoa faria)
  const semNotificacao = async (a) => { await a.avaliar('(() => { const t = document.getElementById("toast"); if (!t.hidden) t.click(); })()'); await dormir(350); };
  const lphera = (x) => x.corpo.itens.find((i) => i.folha === 'ins_lphera' && i.unidade === 'mL');
  try {
    const esc = await novo('tablet chefe', TAMANHOS.computador);
    await teste(grupo, 'dia fechado: os totais de cada insumo vão sozinhos para o Base44', async () => {
      await conectar(esc, 'central');
      // o tablet da hidrólise anotou ontem: LPHERA 70 + 30 mL, Cal 3 copos
      await c.api('/api/sync', { aparelho: 'tablet-teste', registros: [insumo(ontem, 'ins_lphera', 8, 70, 'mL'), insumo(ontem, 'ins_lphera', 9, 30, 'mL'), insumo(ontem, 'ins_cal', 8, 3, 'copos')] });
      await c.api('/api/base44', { acao: 'configurar', url: b44.url, segredo: 'SEGREDO-APP', desde: ontem });
      const x = await esperarBase44((r) => r.corpo && r.corpo.data === ontem, 'totais de ontem', 40000);
      igual(x.segredo, 'SEGREDO-APP', 'segredo');
      igual(lphera(x).quantidade, 100, 'LPHERA');
      igual(x.corpo.itens.find((i) => i.folha === 'ins_cal').quantidade, 3, 'Cal');
      certo(x.corpo.itens.every((i) => i.setor && i.insumo && typeof i.quantidade === 'number'), 'item sem setor, nome ou número');
      certo(/TOTAIS DO DIA/.test(x.corpo.resumo || ''), 'sem o resumo do dia');
      igual(b44.recebidos.filter((r) => r.corpo.data === diaProducao(0)).length, 0, 'mandou o dia que ainda não fechou');
      return `${x.corpo.itens.length} itens`;
    });
    if (correcao) {
      await teste(grupo, 'folha de ontem corrigida: os totais vão de novo sozinhos', async () => {
        await c.api('/api/sync', { aparelho: 'tablet-teste', registros: [insumo(ontem, 'ins_lphera', 9, 50, 'mL', Date.now() + 5)] });
        const x = await esperarBase44((r) => r.corpo && r.corpo.data === ontem && lphera(r).quantidade === 120, 'totais corrigidos (120 mL)', 90000);
        return `${Math.round((x.em - Date.now()) / -1000)} s atrás`;
      });
    }
    await teste(grupo, 'configurações da usina: situação de cada dia, mandar de novo e criar o segredo', async () => {
      await semNotificacao(esc);
      await esc.tocar('[data-a="config"]');
      await esc.teclar(teclasDaSenha());
      // o endereço aparece encurtado (só o nome do site): aqui, 127.0.0.1
      await esc.esperar('!!document.querySelector("#bloco-base44") && document.querySelector("#bloco-base44").textContent.includes("127.0.0.1")', 15000, 'endereço na tela');
      const texto = await esc.avaliar('document.querySelector("#bloco-base44").textContent');
      certo(/Enviado/.test(texto), 'ontem não aparece como enviado: ' + texto.slice(0, 300));
      const antes = b44.recebidos.length;
      await esc.tocar(`[data-a="base44-enviar"][data-data="${ontem}"]`);
      await esperarBase44((r, i) => i >= antes && r.corpo.data === ontem, 'mandar de novo');
      // segredo em branco: o aplicativo cria um e mostra para passar a quem montou o Base44
      await esc.tocar('[data-a="base44-segredo"]');
      await esc.tocar('[data-k="ok"]');
      await esc.esperar('!!document.querySelector(".segredo-grande")', 10000, 'segredo criado');
      const segredo = await esc.avaliar('document.querySelector(".segredo-grande").textContent');
      certo(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/.test(segredo), 'segredo: ' + segredo);
      await esc.tocar('[data-k="x"]');
      const n = b44.recebidos.length;
      await esc.tocar(`[data-a="base44-enviar"][data-data="${ontem}"]`);
      const x = await esperarBase44((r, i) => i >= n, 'com o segredo novo');
      igual(x.segredo, segredo, 'o Base44 recebeu outro segredo');
    });
    await teste(grupo, 'navegador sem WebCrypto (computador por http://endereço): conecta e anota embaralhado', async () => {
      const pc = await novo('computador sem WebCrypto', TAMANHOS.computador);
      await pc.ir(c.url + '/');
      await pc.avaliar('localStorage.setItem("cifraSoJs", "1")');
      await pc.recarregar();
      igual(await pc.avaliar('Cifra.usaWebCrypto()'), false, 'usou WebCrypto');
      // guarda o que passa na rede, para conferir que nada vai aberto
      await pc.avaliar(`(() => { window.__rede = []; const f = window.fetch; const txt = (b) => typeof b === 'string' ? b : b ? Array.from(new Uint8Array(b.buffer || b)).map((x) => String.fromCharCode(x)).join('') : '';
        window.fetch = (u, o) => { if (o && o.body) window.__rede.push(txt(o.body)); return f(u, o).then((r) => { r.clone().arrayBuffer().then((b) => window.__rede.push(txt(b))).catch(() => {}); return r; }); }; })()`);
      await conectar(pc, 'hidrolise', 'Guilherme', { semIr: true });
      await pc.tocar('[data-a="abrir-prancheta"][data-id="hid_anexo1"]');
      await pc.tocar('[data-quadro="phf"]'); await pc.teclar(['4', ',', '6']);
      await pc.tocar('[data-quadro="brix"]'); await pc.teclar(['1', '9']);
      await pc.tocar('[data-ed="ocultar"]');
      await pc.tocar('[data-a="salvar"]');
      const hoje = diaProducao(0);
      const t0 = Date.now();
      let r;
      while (Date.now() - t0 < 25000) {
        r = (await c.api('/api/registros?desde=0')).registros.find((x) => x.data === hoje && x.prancheta === 'hid_anexo1' && x.valores.brix === '19' && x.valores.phf === '4.6');
        if (r) break;
        await dormir(700);
      }
      certo(r, 'a dorna não chegou na central');
      const rede = await pc.avaliar('window.__rede.join("\\n")');
      certo(rede.length > 1000, 'não passou nada pela rede');
      // (números curtos como o brix podem aparecer por acaso no meio do embaralhado; os nomes e o código não)
      for (const s of ['Guilherme', 'hid_anexo1', '"valores"', '"brix"', c.codigo()]) certo(!rede.includes(s), `"${s}" passou aberto no Wi-Fi`);
    });
    await teste(grupo, 'nenhum erro de JavaScript', async () => {
      const erros = aparelhos.flatMap((a) => a.erros.map((e) => `${a.nome}: ${e}`));
      certo(!erros.length, erros.join(' | '));
    });
  } finally {
    await Promise.all(aparelhos.map((a) => a.fechar()));
    await b44.desligar();
    await c.desligar();
  }
}

/** A função que vai no Base44 do escritório (integracoes/base44), rodando aqui com um Base44 simulado na memória. */
export async function testarFuncaoBase44(grupo) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const pasta = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'integracoes', 'base44');
  const tabela = [];
  let id = 0;
  const Totais = {
    async filter(q) { return tabela.filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)).map((r) => Object.assign({}, r)); },
    async create(d) { const r = Object.assign({ id: String(++id) }, d); tabela.push(r); return r; },
    async update(i, d) { Object.assign(tabela.find((r) => r.id === i), d); },
    async delete(i) { tabela.splice(tabela.findIndex((r) => r.id === i), 1); },
  };
  let atender = null;
  globalThis.Deno = { serve: (h) => { atender = h; }, env: { get: (k) => (k === 'PRANCHETAS_SEGREDO' ? 'SEGREDO-X' : undefined) } };
  globalThis.__base44Simulado = { createClientFromRequest: () => ({ asServiceRole: { entities: { TotalInsumoDia: Totais } } }) };
  const codigo = fs.readFileSync(path.join(pasta, 'functions', 'receberTotaisPranchetas', 'entry.ts'), 'utf8')
    .replace(/import \{ createClientFromRequest \} from "npm:@base44\/sdk";/, 'const { createClientFromRequest } = globalThis.__base44Simulado;');
  await import('data:text/javascript;base64,' + Buffer.from(codigo).toString('base64'));
  const mandar = (corpo, segredo = 'SEGREDO-X') => atender(new Request('https://app.base44.app/functions/receberTotaisPranchetas', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Pranchetas-Segredo': segredo }, body: JSON.stringify(corpo) }));
  const item = (insumo, folha, quantidade, unidade) => ({ setor: 'Hidrólise', insumo, folha, quantidade, unidade });
  await teste(grupo, 'função do Base44: grava os totais do dia, atualiza sem duplicar e recusa segredo errado', async () => {
    igual((await mandar({ data: '2026-09-23', itens: [] }, 'errado')).status, 401, 'segredo errado');
    igual((await mandar({ data: '23/09/2026', itens: [] })).status, 400, 'data errada');
    const r1 = await mandar({ data: '2026-09-23', itens: [item('LPHERA', 'ins_lphera', 100, 'mL'), item('Cal', 'ins_cal', 3, 'copos')] });
    igual(r1.status, 200); igual((await r1.json()).gravados, 2);
    igual(tabela.length, 2, 'linhas');
    await mandar({ data: '2026-09-23', itens: [item('LPHERA', 'ins_lphera', 120, 'mL')] }); // corrigida: a cal saiu
    igual(tabela.length, 1, 'duplicou ou não tirou a cal');
    igual(tabela[0].quantidade, 120, 'não atualizou');
    await mandar({ data: '2026-09-24', itens: [item('LPHERA', 'ins_lphera', 50, 'mL')] });
    igual(tabela.length, 2, 'outro dia');
    igual(tabela.find((r) => r.data === '2026-09-23').quantidade, 120, 'mexeu no outro dia');
  });
  delete globalThis.Deno; delete globalThis.__base44Simulado;
}
