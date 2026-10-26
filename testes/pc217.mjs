/* Pranchetas Digitais - © 2026 Guilherme. */
/* Telas da 2.17: liberar sem escolher nível e aparelhos fixos da pessoa (2b). Fotos em testes/saida/pc217/.
   node testes/pc217.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { abrirNavegador, TAMANHOS, dormir } from './navegador.mjs';
import { novoGrupo, teste, certo, igual, resumo, entrarComoChefe, teclasDaSenha } from './teste.mjs';
import { centralNode, pastaTemporaria, APP } from './servidores.mjs';

const FOTOS = path.join(APP, 'testes', 'saida', 'pc217');
const semNotificacao = async (a) => { await a.avaliar('(() => { const t = document.getElementById("toast"); if (t && !t.hidden) t.click(); return 1; })()'); await dormir(350); };

export async function testarNivelNaTela217(nav, g) {
  fs.mkdirSync(FOTOS, { recursive: true });
  const c = await centralNode(8366, pastaTemporaria('pc217-nivel'));
  const aparelhos = [];
  try {
    const chefe = await nav.novoAparelho('tablet chefe', TAMANHOS.tablet); aparelhos.push(chefe);
    await teste(g, 'liberar tablet chefe: a janela não pergunta o nível; com a senha fica no nível 2', async () => {
      await chefe.ir(c.url + '/', 'document.querySelector("[data-quadro=\\"codigo\\"]")');
      await chefe.tocar('[data-quadro="codigo"]'); await chefe.teclar(c.codigo().split('')); await chefe.tocar('[data-ed="ocultar"]');
      await chefe.tocar('[data-a="conectar"]');
      await chefe.tocar('[data-a="papel"][data-id="central"]', null, { esperarMs: 15000 });
      await chefe.esperar('!!document.querySelector(".modal .liberar-chefe")', 10000, 'janela de liberar');
      certo(!(await chefe.avaliar('!!document.querySelector(".modal .opcoes-nivel, .modal [data-k^=\\"n:\\"]")')), 'não pergunta o nível');
      await chefe.foto(path.join(FOTOS, 'liberar.png'));
      await chefe.tocar('.modal [data-k="ok"]'); await chefe.teclar(teclasDaSenha());
      await chefe.esperar('JSON.parse(localStorage.getItem("usina.cfg") || "{}").nivelChefe === 2 && !document.querySelector(".modal")', 10000, 'nível 2');
      await entrarComoChefe(chefe);
    });
    await teste(g, 'pessoa nova: "Vale em" qualquer aparelho ou só nos fixos; marcar este tablet grava a lista', async () => {
      await semNotificacao(chefe);
      await chefe.tocar('[data-a="pessoa"]'); await chefe.tocar('[data-k="pessoas"]');
      await chefe.esperar('!!document.querySelector("[data-a=\\"pessoa-nova\\"]")', 10000, 'tela de pessoas');
      await chefe.tocar('[data-a="pessoa-nova"]');
      await chefe.esperar('!!document.querySelector(".modal [data-k=\\"v:todos\\"]")', 5000, 'Vale em');
      certo(await chefe.avaliar('document.querySelector(".modal [data-k=\\"v:todos\\"]").classList.contains("sel")'), 'qualquer aparelho vem marcado');
      await chefe.tocar('.modal [data-k="v:fixos"]');
      const id = await chefe.avaliar('cfg.deviceId');
      await chefe.tocar(`.modal [data-k="a:${id}"]`);
      await chefe.avaliar('(() => { document.getElementById("p-nome").value = "Lucas"; document.getElementById("p-pin").value = "3344"; return 1; })()');
      await chefe.foto(path.join(FOTOS, 'pessoa-vale-em.png'));
      await chefe.tocar('.modal [data-k="ok"]');
      await chefe.esperar('!document.querySelector(".modal")', 8000, 'salvou');
      const lucas = (await c.api('/api/pessoas', { acao: 'lista' })).pessoas.find((p) => p.nome === 'Lucas');
      igual(lucas.aparelhos, [id]);
    });
    await teste(g, 'só nos fixos sem marcar aparelho não salva', async () => {
      await chefe.tocar('[data-a="pessoa-nova"]');
      await chefe.tocar('.modal [data-k="v:fixos"]');
      await chefe.avaliar('(() => { document.getElementById("p-nome").value = "Bruno"; document.getElementById("p-pin").value = "5566"; return 1; })()');
      await chefe.tocar('.modal [data-k="ok"]');
      await chefe.esperar('document.getElementById("toast").textContent.includes("Escolha pelo menos um aparelho")', 5000, 'aviso');
      await chefe.tocar('.modal [data-k="x"]');
    });
    certo(!chefe.erros.length, chefe.erros.join(' | '));
  } finally {
    for (const a of aparelhos) await a.fechar().catch(() => {});
    await c.desligar();
  }
}

/** Task 7: notificação rápida com ×, ícone por tipo e tempo na tela. */
export async function testarNotificacoes217(nav, g) {
  const c = await centralNode(8367, pastaTemporaria('pc217-toast'));
  const a = await nav.novoAparelho('notificações', TAMANHOS.tablet);
  try {
    await a.ir(c.url + '/?demo&papel=central', 'typeof toast === "function"');
    const estado = () => a.avaliar(`(() => { const t = document.getElementById('toast'); return JSON.stringify({ visivel: !t.hidden && !t.classList.contains('saindo'),
      tipo: t.className.replace('saindo', '').trim(), ico: (t.querySelector('.toast-ico') || {}).innerHTML || '',
      x: !!t.querySelector('button.toast-x[aria-label="Fechar"]'), texto: (t.querySelector('.toast-texto') || {}).textContent || '' }); })()`).then(JSON.parse);
    await teste(g, 'cada tipo tem o seu ícone e o botão ×', async () => {
      const icones = {};
      for (const tipo of ['ok', 'erro', 'aviso', 'info']) {
        await a.avaliar(`(() => { toast('Teste ${tipo}', '${tipo}'); return 1; })()`);
        const e = await estado();
        igual(e.tipo, tipo); certo(e.x, 'tem o ×'); igual(e.texto, 'Teste ' + tipo);
        icones[tipo] = e.ico;
        await a.foto(path.join(FOTOS, `notificacao-${tipo}.png`));
      }
      igual(new Set(Object.values(icones)).size, 4, 'quatro ícones diferentes');
    });
    await teste(g, 'o × fecha na hora', async () => {
      await a.avaliar(`(() => { toast('Fecha já', 'info'); return 1; })()`);
      await a.tocar('#toast button.toast-x');
      await a.esperar(`document.getElementById('toast').hidden`, 600, 'fechou');
    });
    await teste(g, 'ok curto some em até 3 s; erro fica pelo menos 5,5 s', async () => {
      await a.avaliar(`(() => { toast('Anotação salva aqui', 'ok'); return 1; })()`);
      await a.esperar(`document.getElementById('toast').hidden`, 3200, 'ok sumiu');
      await a.avaliar(`(() => { toast('Não consegui falar com a central', 'erro'); return 1; })()`);
      await dormir(5500);
      certo((await estado()).visivel, 'erro ainda na tela aos 5,5 s');
      await a.esperar(`document.getElementById('toast').hidden`, 1500, 'erro sumiu');
    });
    await teste(g, 'notificação nova troca o texto e recomeça o tempo', async () => {
      await a.avaliar(`(() => { toast('Primeira', 'ok'); return 1; })()`);
      await dormir(1800);
      await a.avaliar(`(() => { toast('Segunda', 'ok'); return 1; })()`);
      await dormir(1500);
      const e = await estado(); certo(e.visivel, 'ainda na tela'); igual(e.texto, 'Segunda');
      await a.tocar('#toast button.toast-x');
    });
    certo(!a.erros.length, a.erros.join(' | '));
  } finally { await a.fechar().catch(() => {}); await c.desligar(); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const nav = await abrirNavegador();
  const g = novoGrupo('Telas da 2.17');
  try {
    const so = process.argv[2];
    if (!so || so === 'nivel') await testarNivelNaTela217(nav, g);
    if (!so || so === 'toast') await testarNotificacoes217(nav, g);
  } finally { await nav.fechar(); }
  resumo([g]);
}
