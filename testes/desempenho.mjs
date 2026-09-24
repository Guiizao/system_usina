/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Quanto tempo cada toque leva, num tablet mais lento (processador do computador 4 vezes mais devagar,
 * perto de um Galaxy Tab de preço médio) e com a central com 90 dias de uso.
 * Mede o trabalho do toque (o app responder e a tela se arrumar), sem contar a espera pelo próximo quadro da tela.
 *   node testes/desempenho.mjs [node|java]    resultado em testes/saida/desempenho.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, TAMANHOS, dormir } from './navegador.mjs';
import { centralNode, centralJava, APP } from './servidores.mjs';
import { diaDaUsina, diasAtras } from './robustez.mjs';

const LENTIDAO = 4;

/** Mede um toque: o clique, o redesenho e o que roda no quadro seguinte (ajuste das letras). */
const MEDIR = `window.__medir = (seletor, texto) => new Promise((ok) => {
  const lista = [...document.querySelectorAll(seletor)].filter((e) => e.offsetParent !== null && (!texto || e.textContent.includes(texto)));
  const el = lista[0];
  if (!el) return ok(-1);
  const t0 = performance.now();
  el.click();
  document.body.offsetHeight; // o navegador arruma a tela na hora
  const depoisDoClique = performance.now() - t0;
  requestAnimationFrame((inicioDoQuadro) => {
    // este é chamado depois dos que o app pediu no clique: o tempo desde o início do quadro é o trabalho deles
    const t1 = performance.now();
    document.body.offsetHeight;
    // o início do quadro pode ter sido antes do fim do clique: não conta o clique duas vezes
    ok(Math.round((depoisDoClique + (performance.now() - Math.max(inicioDoQuadro, t0 + depoisDoClique))) * 10) / 10);
  });
});`;

export async function medirDesempenho(ligar, porta, nav) {
  const c = await ligar(porta);
  const api = async (rota, corpo) => (await fetch(c.url + rota, { method: corpo ? 'POST' : 'GET', headers: { 'X-Chave': c.chave(), 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined })).json();
  const res = {};
  try {
    const tudo = [];
    for (let n = 89; n >= 1; n--) tudo.push(...diaDaUsina(diasAtras(n)));
    for (let i = 0; i < tudo.length; i += 1500) await api('/api/sync', { aparelho: 'semeador', registros: tudo.slice(i, i + 1500) });

    async function preparar(a, papel, operador) {
      await a.ir(c.url + '/', 'document.querySelector("[data-quadro=\\"codigo\\"]")');
      await a.tocar('[data-quadro="codigo"]');
      await a.teclar(c.codigo().split(''));
      await a.tocar('[data-ed="ocultar"]');
      await a.tocar('[data-a="conectar"]');
      await a.tocar(`[data-a="papel"][data-id="${papel}"]`, null, { esperarMs: 15000 });
      if (operador) await a.tocar(`[data-a="escolher-operador"][data-nome="${operador}"]`);
      await a.esperar('JSON.parse(localStorage.getItem("usina.cfg") || "{}").ultimoSeq > 0', 30000, 'primeira sincronização');
      await nav.cdp('Emulation.setCPUThrottlingRate', { rate: LENTIDAO }, a.sessionId);
    }
    const medir = async (a, nome, seletor, texto, vezes = 5) => {
      await a.avaliar(MEDIR);
      const tempos = [];
      for (let i = 0; i < vezes; i++) { tempos.push(await a.avaliar(`window.__medir(${JSON.stringify(seletor)}, ${JSON.stringify(texto || '')})`)); await dormir(250); }
      const ok = tempos.filter((t) => t >= 0).sort((x, y) => x - y);
      res[nome] = ok.length ? ok[Math.floor(ok.length / 2)] : null; // o do meio
    };
    const abrir = async (a, nome) => {
      await a.recarregar();
      await a.esperar('document.querySelector("#app header")', 20000);
      res[nome] = Math.round(await a.avaliar(`(() => { const n = performance.getEntriesByType('navigation')[0]; return window.__primeiraTela || (performance.now() - n.startTime); })()`));
    };

    // tablet da Hidrólise
    const tab = await nav.novoAparelho('tablet', TAMANHOS.tablet);
    await preparar(tab, 'hidrolise', 'Felipe');
    await abrir(tab, 'tablet: abrir o aplicativo até a primeira tela (ms)');
    await tab.tocar('[data-a="abrir-prancheta"][data-id="hid_anexo1"]');
    await tab.tocar('[data-quadro="brix"]');
    await medir(tab, 'tablet: tecla do teclado', '[data-ed="1"]');
    await medir(tab, 'tablet: Próximo', '[data-ed="prox"]');
    await tab.tocar('[data-ed="ocultar"]');
    await medir(tab, 'tablet: trocar de dorna', '.seletor button', 'Nº');
    const vaiEVolta = async (a, nome1, sel1, nome2, sel2, vezes = 3) => {
      const t1 = [], t2 = [];
      for (let i = 0; i < vezes; i++) {
        await medir(a, nome1, sel1, '', 1); t1.push(res[nome1]);
        await medir(a, nome2, sel2, '', 1); t2.push(res[nome2]);
      }
      const meio = (l) => l.filter((x) => x != null && x >= 0).sort((x, y) => x - y)[Math.floor(l.length / 2)];
      res[nome1] = meio(t1); res[nome2] = meio(t2);
    };
    await vaiEVolta(tab, 'tablet: trocar de aba (Sacarificação)', '[data-a="aba"][data-id="hid_anexo2"]', 'tablet: trocar de aba (Hidrólise)', '[data-a="aba"][data-id="hid_anexo1"]');
    await vaiEVolta(tab, 'tablet: abrir o monitoramento', '[data-a="monitor"]', 'tablet: voltar para anotar', '[data-a="monitor"]');
    await tab.tocar('[data-quadro="brix"]'); await tab.teclar(['2']); await tab.tocar('[data-ed="ocultar"]');
    await medir(tab, 'tablet: Salvar a dorna', '[data-a="salvar"]', '', 1);
    res['tablet: memória usada (mil letras)'] = Math.round((await tab.avaliar('(localStorage.getItem("usina.registros") || "").length')) / 1000);
    await tab.fechar();

    // tablet chefe (painel do escritório) com 20 dias guardados
    const esc = await nav.novoAparelho('escritório', TAMANHOS.tablet);
    await preparar(esc, 'central');
    await abrir(esc, 'chefe: abrir o aplicativo até o painel (ms)');
    await medir(esc, 'chefe: dia anterior no painel', '[data-a="dia"][data-n="-1"]');
    await medir(esc, 'chefe: próximo dia no painel', '[data-a="dia"][data-n="1"]', '', 2);
    const vaiEVolta2 = async (nome1, sel1, nome2, sel2, vezes = 3) => {
      const t1 = [], t2 = [];
      for (let i = 0; i < vezes; i++) {
        await medir(esc, nome1, sel1, '', 1); t1.push(res[nome1]);
        await medir(esc, nome2, sel2, '', 1); t2.push(res[nome2]);
      }
      const meio = (l) => l.filter((x) => x != null && x >= 0).sort((x, y) => x - y)[Math.floor(l.length / 2)];
      res[nome1] = meio(t1); res[nome2] = meio(t2);
    };
    await vaiEVolta2('chefe: abrir a Caldeira', '[data-a="abrir-setor"][data-id="caldeira"]', 'chefe: voltar ao painel', '[data-a="painel"]');
    await medir(esc, 'chefe: abrir a Caldeira', '[data-a="abrir-setor"][data-id="caldeira"]', '', 1);
    await vaiEVolta2('chefe: monitorar a Caldeira', '[data-a="monitor"]', 'chefe: voltar a anotar na Caldeira', '[data-a="monitor"]');
    res['chefe: memória usada (mil letras)'] = Math.round((await esc.avaliar('(localStorage.getItem("usina.registros") || "").length')) / 1000);
    res['chefe: gravar a memória uma vez (ms)'] = await esc.avaliar(`(() => { const s = localStorage.getItem('usina.registros'); const t0 = performance.now(); const o = JSON.parse(s); localStorage.setItem('usina.teste', JSON.stringify(o)); localStorage.removeItem('usina.teste'); return Math.round(performance.now() - t0); })()`);
    // tarefas longas (mais de 50 ms) enquanto o painel sincroniza sozinho por 20 segundos
    await esc.avaliar(`window.__longas = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__longas.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: false });`);
    await dormir(20000);
    res['chefe: travadas de mais de 50 ms em 20 s parado'] = await esc.avaliar('JSON.stringify(window.__longas)');
    await esc.fechar();
  } finally { await c.desligar(); }
  return res;
}

if (process.argv[1] && process.argv[1].endsWith('desempenho.mjs')) {
  const qual = process.argv[2] || 'node';
  const nav = await abrirNavegador();
  try {
    const r = await medirDesempenho(qual === 'java' ? centralJava : centralNode, 8185, nav);
    const saida = path.join(APP, 'testes', 'saida', 'desempenho.json');
    fs.writeFileSync(saida, JSON.stringify({ quando: new Date().toISOString(), lentidao: LENTIDAO, central: qual, r }, null, 1));
    for (const [k, v] of Object.entries(r)) console.log(`${k.padEnd(52)} ${v}`);
  } finally { await nav.fechar(); }
}
