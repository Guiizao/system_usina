/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Aparelhos virtuais para os testes: um Chrome sem janela, e cada aparelho num perfil separado
 * (memória, cookies e service worker próprios), como se fossem tablets e celulares diferentes.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
  .find((c) => fs.existsSync(c));
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Troca o Date da página por um que pode ser adiantado; o quanto adiantou fica guardado na aba
const RELOGIO_FALSO = `(() => {
  const D = Date; let ad = 0;
  try { ad = Number(sessionStorage.getItem('__adiantado') || 0); } catch (e) {}
  function F(...a) { if (!(this instanceof F)) return new D(D.now() + ad).toString(); return a.length ? new D(...a) : new D(D.now() + ad); }
  F.prototype = D.prototype; F.now = () => D.now() + ad; F.parse = D.parse; F.UTC = D.UTC;
  Object.setPrototypeOf(F, D);
  window.Date = F;
  window.__adiantar = (ms) => { ad += ms; try { sessionStorage.setItem('__adiantado', String(ad)); } catch (e) {} };
})();`;

export const TAMANHOS = {
  celular: { largura: 360, altura: 800, dpr: 3, celular: true },
  celularGrande: { largura: 412, altura: 915, dpr: 2.6, celular: true },
  celularDeitado: { largura: 800, altura: 360, dpr: 3, celular: true },
  tablet8: { largura: 600, altura: 960, dpr: 2, celular: true },
  tablet8Deitado: { largura: 960, altura: 600, dpr: 2, celular: true },
  tablet: { largura: 1280, altura: 800, dpr: 2, celular: true },
  tabletEmPe: { largura: 800, altura: 1280, dpr: 2, celular: true },
  tablet10: { largura: 1000, altura: 600, dpr: 2, celular: true },
  motorola: { largura: 393, altura: 852, dpr: 2.75, celular: true },
  // Galaxy Tab S9+ (12,4"), deitado e em pé, e com a tela dividida com outro app (metade e dois terços)
  s9: { largura: 1400, altura: 876, dpr: 2, celular: true },
  s9EmPe: { largura: 876, altura: 1400, dpr: 2, celular: true },
  s9Metade: { largura: 694, altura: 876, dpr: 2, celular: true },
  s9DoisTercos: { largura: 930, altura: 876, dpr: 2, celular: true },
  computador: { largura: 1440, altura: 900, dpr: 1, celular: false },
  pcGrande: { largura: 1920, altura: 1080, dpr: 1, celular: false },
};

export async function abrirNavegador({ porta = 9340 + Math.floor(Math.random() * 400) } = {}) {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'pranchetas-teste-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--disable-features=Translate', `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`, 'about:blank'], { stdio: 'ignore' });
  let versao;
  for (let i = 0; i < 80 && !versao; i++) {
    try { versao = await (await fetch(`http://127.0.0.1:${porta}/json/version`)).json(); } catch { await dormir(250); }
  }
  if (!versao) throw new Error('O Chrome não abriu');
  const ws = new WebSocket(versao.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let seq = 0;
  const pend = new Map();
  const ouvintes = new Map(); // sessionId -> [fn]
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) {
      const { res, rej } = pend.get(m.id); pend.delete(m.id);
      m.error ? rej(new Error(m.error.message + ' ' + (m.error.data || ''))) : res(m.result);
    } else if (m.method && m.sessionId && ouvintes.has(m.sessionId)) ouvintes.get(m.sessionId).forEach((f) => f(m));
  });
  const cdp = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const id = ++seq; pend.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

  async function novoAparelho(nome, tamanho = TAMANHOS.tablet, opcoes = {}) {
    const { browserContextId } = await cdp('Target.createBrowserContext', { disposeOnDetach: true });
    const { targetId } = await cdp('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
    const erros = [];
    const avisosConsole = [];
    ouvintes.set(sessionId, [(m) => {
      if (m.method === 'Runtime.exceptionThrown') erros.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') erros.push('console: ' + m.params.args.map((a) => a.value || a.description || '').join(' '));
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon|fonts\.g/.test(m.params.entry.url || '')) avisosConsole.push(m.params.entry.text + ' ' + (m.params.entry.url || ''));
    }]);
    await cdp('Runtime.enable', {}, sessionId);
    await cdp('Log.enable', {}, sessionId);
    await cdp('Page.enable', {}, sessionId);
    // HORA=07:30 node testes/...: os aparelhos acham que é essa hora de hoje (a central não): reproduz o que só falha num horário
    if (/^\d\d:\d\d$/.test(process.env.HORA || '')) {
      const alvo = new Date(); alvo.setHours(...process.env.HORA.split(':').map(Number), 0, 0);
      await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `try { sessionStorage.setItem('__adiantado', sessionStorage.getItem('__adiantado') || '${alvo.getTime() - Date.now()}'); } catch (e) {}` }, sessionId);
      await cdp('Page.addScriptToEvaluateOnNewDocument', { source: RELOGIO_FALSO }, sessionId);
    }
    const a = {
      nome, sessionId, erros, avisosConsole, tamanho,
      async tamanhoTela(t) {
        a.tamanho = t;
        await cdp('Emulation.setDeviceMetricsOverride', { width: t.largura, height: t.altura, deviceScaleFactor: t.dpr, mobile: !!t.celular, screenWidth: t.largura, screenHeight: t.altura }, sessionId);
        await cdp('Emulation.setTouchEmulationEnabled', t.celular ? { enabled: true, maxTouchPoints: 5 } : { enabled: false }, sessionId);
        if (t.celular) await cdp('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X230) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36' }, sessionId);
      },
      async escuro(ligado) { await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: ligado ? 'dark' : 'light' }] }, sessionId); },
      async ir(url, espera = 'document.readyState === "complete"') {
        await cdp('Page.navigate', { url }, sessionId);
        await dormir(150);
        await a.esperar(espera, 20000);
        await a.avaliar('document.fonts.ready.then(() => true)');
        await dormir(250);
      },
      async recarregar() { await cdp('Page.reload', {}, sessionId); await dormir(300); await a.esperar('document.readyState === "complete"', 20000); await dormir(300); },
      async avaliar(expr) {
        const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
        if (r.exceptionDetails) throw new Error(`[${nome}] ${r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text}`);
        return r.result.value;
      },
      async esperar(expr, ms = 15000, descricao) {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) {
          try { if (await a.avaliar(`!!(${expr})`)) return true; } catch { /* página trocando */ }
          await dormir(150);
        }
        throw new Error(`[${nome}] esperei ${ms / 1000}s e não aconteceu: ${descricao || expr}`);
      },
      /** Toca no centro de um elemento (acha pelo seletor e, se dado, pelo texto). */
      async tocar(seletor, texto, { indice = 0, esperarMs = 8000 } = {}) {
        const busca = `(() => { const lista = [...document.querySelectorAll(${JSON.stringify(seletor)})].filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed')${texto ? `.filter((e) => e.textContent.replace(/\\s+/g, ' ').includes(${JSON.stringify(texto)}))` : ''}; return lista[${indice}] || null; })()`;
        await a.esperar(busca, esperarMs, `achar ${seletor}${texto ? ' "' + texto + '"' : ''}`);
        const caixa = await a.avaliar(`(() => { const e = ${busca}; e.scrollIntoView({ block: 'center', inline: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
        // notificação (#toast) por cima do botão, como a "Folha de ontem guardada" do tablet chefe entre 07:05 e 07:59:
        // a pessoa fecha a notificação e toca de novo no botão
        const coberto = `(() => { const e = ${busca}; const p = document.elementFromPoint(${caixa.x}, ${caixa.y}); return !e.closest('#toast') && !!(p && p.closest('#toast')); })()`;
        if (await a.avaliar(coberto)) { await a.avaliar('document.getElementById("toast").click()'); await dormir(350); }
        await dormir(60);
        for (const type of ['mousePressed', 'mouseReleased']) {
          await cdp('Input.dispatchMouseEvent', { type, x: caixa.x, y: caixa.y, button: 'left', clickCount: 1 }, sessionId);
        }
        await dormir(120);
      },
      async existe(seletor, texto) {
        return a.avaliar(`[...document.querySelectorAll(${JSON.stringify(seletor)})].some((e) => (e.offsetParent !== null || getComputedStyle(e).position === 'fixed')${texto ? ` && e.textContent.replace(/\\s+/g, ' ').includes(${JSON.stringify(texto)})` : ''})`);
      },
      texto: () => a.avaliar('document.body.innerText'),
      async teclar(teclas) { for (const k of teclas) await a.tocar(`[data-ed="${k}"], [data-k="${k}"]`); },
      /** Limpar do teclado (2.16): apagar um valor salvo pergunta antes; confirma o Sim se a pergunta aparecer. */
      async limpar() {
        await a.tocar('[data-ed="limpar"]');
        if (await a.avaliar('new Promise((r) => setTimeout(() => r(!!document.querySelector(\'.modal [data-k="sim"]\')), 250))')) await a.tocar('.modal [data-k="sim"]');
      },
      async digitar(texto) { await cdp('Input.insertText', { text: texto }, sessionId); await dormir(80); },
      async foto(arquivo, { inteira = false } = {}) {
        fs.mkdirSync(path.dirname(arquivo), { recursive: true });
        const r = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: inteira }, sessionId);
        fs.writeFileSync(arquivo, Buffer.from(r.data, 'base64'));
      },
      /** Toca num ponto da tela (por exemplo, no fundo escuro de uma janela). */
      async tocarEm(x, y) {
        for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }, sessionId);
        await dormir(150);
      },
      /** Relógio que dá para adiantar (troca de turno, virada do dia, travas). Chamar antes de abrir a página. */
      /** Roda este código antes do app em toda página que abrir (ex.: o plugin do Android de mentira). */
      async antesDeAbrir(js) { await cdp('Page.addScriptToEvaluateOnNewDocument', { source: js }, sessionId); },
      async relogioFalso() { await cdp('Page.addScriptToEvaluateOnNewDocument', { source: RELOGIO_FALSO }, sessionId); },
      async adiantar(ms) { await a.avaliar(`window.__adiantar(${ms})`); },
      /** Adianta o relógio até a próxima vez que der h:m:s. */
      async irParaHora(h, m = 0, s = 0) {
        await a.avaliar(`(() => { const d = new Date(); const alvo = new Date(d.getTime()); alvo.setHours(${h}, ${m}, ${s}, 0); if (alvo <= d) alvo.setDate(alvo.getDate() + 1); window.__adiantar(alvo.getTime() - d.getTime()); })()`);
      },
      async semRede(ligado) {
        await cdp('Network.enable', {}, sessionId);
        await cdp('Network.emulateNetworkConditions', { offline: !!ligado, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, sessionId);
      },
      async fechar() { ouvintes.delete(sessionId); await cdp('Target.closeTarget', { targetId }).catch(() => {}); await cdp('Target.disposeBrowserContext', { browserContextId }).catch(() => {}); },
    };
    await a.tamanhoTela(tamanho);
    if (opcoes.escuro) await a.escuro(true);
    return a;
  }

  return {
    novoAparelho,
    cdp,
    async fechar() { try { ws.close(); } catch { /* já fechado */ } proc.kill(); await dormir(300); try { fs.rmSync(perfil, { recursive: true, force: true }); } catch { /* Chrome ainda soltando */ } },
  };
}

/**
 * Procura problemas de layout na tela atual: texto saindo da caixa, palavra quebrada no meio,
 * rolagem para o lado, caixa fixa passando da borda, letra pequena demais, pouco contraste entre a letra e o fundo e botão
 * pequeno demais para o dedo.
 */
export const auditarLayout = (minLetra = 11.5) => `(() => {
  const probs = [];
  const doc = document.documentElement;
  const larg = innerWidth;
  if (doc.scrollWidth > larg + 1) probs.push({ tipo: 'rolagem-lateral', texto: 'página mais larga que a tela: ' + doc.scrollWidth + ' > ' + larg });
  const visivel = (e) => { const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const nomeDe = (e) => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\\s+/).join('.') : ''));
  const recorte = (e) => { let p = e.parentElement; while (p && p !== document.body) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX + s.overflowY)) return p; p = p.parentElement; } return null; };
  // caixa fixa (faixa do lembrete, notificação) passando da borda: não cria rolagem para o lado, então só aparece assim
  document.querySelectorAll('body *').forEach((e) => {
    if (getComputedStyle(e).position !== 'fixed' || !visivel(e)) return;
    const b = e.getBoundingClientRect();
    if (b.left < -1 || b.right > larg + 1) probs.push({ tipo: 'fora-da-tela', onde: nomeDe(e), texto: 'passa da borda da tela: ' + Math.round(b.left) + ' a ' + Math.round(b.right) + ' de ' + larg });
  });
  // janela cujo formulário rola para baixo e passou a rolar para o lado: algo largo demais lá dentro corta a borda direita
  document.querySelectorAll('.modal, .modal *').forEach((e) => {
    if (!/(auto|scroll)/.test(getComputedStyle(e).overflowX) || !visivel(e)) return;
    if (e.scrollWidth > e.clientWidth + 2) probs.push({ tipo: 'rolagem-lateral', onde: nomeDe(e), texto: 'mais largo que a janela: ' + e.scrollWidth + ' > ' + e.clientWidth });
  });
  const caixas = document.querySelectorAll('button, .quadro, .chip, .item, .setor-cartao, .papel-cartao, .atalho, .modal, #toast, th, td, label, .aviso, .bloco, .conexao, .faixa > *, .titulo, .relogio, .numeros > div, .escolhas > button, .aviso-chefe, .aviso-item');
  const vistos = new Set();
  caixas.forEach((cx) => {
    if (!visivel(cx)) return;
    const bc = cx.getBoundingClientRect();
    const walker = document.createTreeWalker(cx, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = n.textContent;
      if (!t.trim() || !n.parentElement || !visivel(n.parentElement)) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      const rects = [...r.getClientRects()].filter((x) => x.width > 0);
      // no alto e embaixo, a letra pode passar um pouco da linha (acentos): só conta se passar de 30% da letra
      const folgaV = parseFloat(getComputedStyle(n.parentElement).fontSize) * 0.3 + 1;
      const clip = recorte(n.parentElement);
      // texto numa lista que rola (para cima e para baixo) dentro da caixa: dá para rolar até ele, não está cortado
      const rolaDentro = clip && clip !== cx && cx.contains(clip) && /(auto|scroll)/.test(getComputedStyle(clip).overflowY);
      const fora = rects.some((x) => x.right > bc.right + 1.5 || x.left < bc.left - 1.5 || (!rolaDentro && (x.bottom > bc.bottom + folgaV || x.top < bc.top - folgaV)));
      // texto maior que o próprio elemento (ex.: nome espremido por um selo do lado, que fica por cima)
      const pai = n.parentElement;
      if (getComputedStyle(pai).display !== 'inline') {
        const pb = pai.getBoundingClientRect();
        if (rects.some((x) => x.right > pb.right + 1.5 || x.left < pb.left - 1.5) && !vistos.has(n)) { vistos.add(n); probs.push({ tipo: 'texto-sai-do-elemento', onde: nomeDe(pai), texto: t.trim().slice(0, 60) }); }
      }
      const cortado = clip && rects.some((x) => { const bb = clip.getBoundingClientRect(); return x.right > bb.right + 1.5 || x.bottom > bb.bottom + 1.5; }) && !/(auto|scroll)/.test(getComputedStyle(clip).overflowX + getComputedStyle(clip).overflowY);
      if ((fora || cortado) && !vistos.has(n)) { vistos.add(n); probs.push({ tipo: 'texto-fora-da-caixa', onde: nomeDe(cx), texto: t.trim().slice(0, 60) }); }
      // palavra quebrada no meio (uma palavra em duas linhas)
      const re = /[\\p{L}\\p{N}][\\p{L}\\p{N}.,:\\/-]{3,}/gu; let m;
      while ((m = re.exec(t))) {
        const rw = document.createRange(); rw.setStart(n, m.index); rw.setEnd(n, m.index + m[0].length);
        const linhas = new Set([...rw.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top)));
        if (linhas.size > 1 && !vistos.has(m[0] + nomeDe(cx))) { vistos.add(m[0] + nomeDe(cx)); probs.push({ tipo: 'palavra-quebrada', onde: nomeDe(cx), texto: m[0] }); }
      }
    }
  });
  // letra pequena demais e botão pequeno demais (medidas já com o zoom da tela)
  document.querySelectorAll('body *').forEach((e) => {
    if (!visivel(e) || !e.childNodes.length) return;
    const temTexto = [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    if (!temTexto) return;
    const s = getComputedStyle(e);
    const z = parseFloat(getComputedStyle(document.documentElement).zoom || 1) * parseFloat(getComputedStyle(document.body).zoom || 1);
    const px = parseFloat(s.fontSize) * z;
    if (px < ${minLetra} && !e.closest('.folha-imp, svg, .qr, .et-previa')) probs.push({ tipo: 'letra-pequena', onde: nomeDe(e), texto: e.textContent.trim().slice(0, 40) + ' (' + px.toFixed(1) + 'px)' });
  });
  // ícone desproporcional ao texto do lado (fora das caixinhas de ícone, que são grandes de propósito)
  const zoomTela = parseFloat(getComputedStyle(document.documentElement).zoom || 1) * parseFloat(getComputedStyle(document.body).zoom || 1);
  document.querySelectorAll('svg.ico').forEach((ic) => {
    if (!visivel(ic) || ic.closest('.desenho, .escolha-ico, .aviso-sino, .grande-ico, .preparo-ico, .marca, #toast, .teclas, .mm, .folha-imp, .qr')) return;
    const pai = ic.parentElement;
    const texto = [...pai.childNodes].some((c) => (c.nodeType === 3 && c.textContent.trim()) || (c.nodeType === 1 && c !== ic && c.tagName !== 'svg' && c.textContent.trim()));
    if (!texto) return;
    const fonte = parseFloat(getComputedStyle(pai).fontSize) * zoomTela;
    const razao = ic.getBoundingClientRect().height / fonte;
    if (razao > 2.1 || razao < 0.7) probs.push({ tipo: 'icone-desproporcional', onde: nomeDe(pai), texto: (pai.textContent.trim().slice(0, 30) || '(ícone)') + ' (ícone ' + razao.toFixed(1) + 'x o texto)' });
  });
  // contraste entre a letra e o fundo (sol na área, tela suja ou riscada): mínimo 4,5 no texto normal e 3 no texto grande.
  // Cada elemento é medido uma vez só (o fundo e a transparência de cada um aproveitam o do elemento de fora).
  const estilos = new Map();
  const est = (e) => { let x = estilos.get(e); if (!x) { x = getComputedStyle(e); estilos.set(e, x); } return x; };
  const cor = (txt) => { const m = String(txt).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[\\s,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const misturar = (c, f, a) => ({ r: c.r * a + f.r * (1 - a), g: c.g * a + f.g * (1 - a), b: c.b * a + f.b * (1 - a), a: 1 });
  const luz = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const fundos = new Map(), opacidades = new Map();
  const BRANCO = { r: 255, g: 255, b: 255, a: 1 };
  const fundoDe = (e) => {
    if (!e) return BRANCO;
    if (fundos.has(e)) return fundos.get(e);
    const s = est(e);
    let f;
    if (s.backgroundImage && s.backgroundImage !== 'none') f = null; // degradê ou imagem: não dá para medir
    else {
      const c = cor(s.backgroundColor);
      if (c && c.a >= 1) f = c;
      else { const debaixo = fundoDe(e.parentElement); f = debaixo && c && c.a > 0 ? misturar(c, debaixo, c.a) : debaixo; }
    }
    fundos.set(e, f);
    return f;
  };
  const opacidadeDe = (e) => {
    if (!e) return 1;
    if (opacidades.has(e)) return opacidades.get(e);
    const v = parseFloat(est(e).opacity) * opacidadeDe(e.parentElement);
    opacidades.set(e, v);
    return v;
  };
  document.querySelectorAll('body *').forEach((e) => {
    if (![...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) return;
    if (e.closest('.folha-imp, svg, .qr, [disabled], #impressao') || !visivel(e)) return;
    if (opacidadeDe(e) < 0.99) return; // entrando ou saindo com animação
    const s = est(e);
    const letra = cor(s.color); const fundo = fundoDe(e);
    if (!letra || !fundo) return;
    const efetiva = misturar(letra, fundo, letra.a);
    const l1 = luz(efetiva), l2 = luz(fundo);
    const razao = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(s.fontSize) * zoomTela;
    const grande = px >= 24 || (px >= 18.6 && parseInt(s.fontWeight, 10) >= 700);
    if (razao < (grande ? 3 : 4.5)) probs.push({ tipo: 'contraste-baixo', onde: nomeDe(e), texto: e.textContent.trim().slice(0, 40) + ' (' + razao.toFixed(2) + ':1)' });
  });
  document.querySelectorAll('button, [data-a], [data-k], [data-ed]').forEach((b) => {
    if (!visivel(b) || b.closest('.tabela-wrap, .folha-imp, .qr')) return;
    const bb = b.getBoundingClientRect();
    if (Math.min(bb.width, bb.height) < 34) probs.push({ tipo: 'botao-pequeno', onde: nomeDe(b), texto: (b.textContent.trim() || b.getAttribute('aria-label') || '').slice(0, 30) + ' (' + Math.round(bb.width) + 'x' + Math.round(bb.height) + ')' });
  });
  return probs;
})()`;

export const AUDITAR_LAYOUT = auditarLayout();
