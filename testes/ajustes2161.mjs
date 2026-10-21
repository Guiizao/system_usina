/* Pranchetas Digitais - © 2026 Guilherme. */
/* Pedidos de 21/10 (2.16.1): Brix acima de 25 (26 avisa, 25 não), caixa de digitar legível e com cantos arredondados no
   tema claro e no escuro, e aviso com texto curto em qualquer quadro (ex.: temperatura da destilaria) pelo Folhas e avisos.
   Uso: node testes/ajustes2161.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { abrirNavegador, TAMANHOS, dormir } from './navegador.mjs';
import { novoGrupo, teste, certo, igual, resumo, entrarComoChefe } from './teste.mjs';
import { centralNode, pastaTemporaria, APP } from './servidores.mjs';

const FOTOS = path.join(APP, 'testes', 'saida', 'ajustes2161');

export async function testarAjustes2161(nav, ligar, porta, grupo) {
  fs.mkdirSync(FOTOS, { recursive: true });
  const c = await ligar(porta, pastaTemporaria('ajustes2161'));
  const aparelhos = [];
  async function novo(nome, tamanho) { const a = await nav.novoAparelho(nome, tamanho); aparelhos.push(a); return a; }
  async function conectar(a, papel, operador) {
    await a.ir(c.url + '/', 'document.querySelector("[data-quadro=\\"codigo\\"]")');
    await a.tocar('[data-quadro="codigo"]');
    await a.teclar(c.codigo().split(''));
    await a.tocar('[data-ed="ocultar"]');
    await a.tocar('[data-a="conectar"]');
    await a.tocar(`[data-a="papel"][data-id="${papel}"]`, null, { esperarMs: 15000 });
    if (papel === 'central') await entrarComoChefe(a);
    if (operador) await a.tocar(`[data-a="escolher-operador"][data-nome="${operador}"]`);
  }
  const semNotificacao = async (a) => { await a.avaliar('(() => { const t = document.getElementById("toast"); if (!t.hidden) t.click(); })()'); await dormir(350); };
  try {
    const chefe = await novo('tablet chefe', TAMANHOS.tablet);
    const hid = await novo('tablet da Hidrólise', TAMANHOS.tablet);
    await conectar(chefe, 'central');
    await conectar(hid, 'hidrolise', 'Felipe');

    await teste(grupo, 'Brix acima de 25: 25 não avisa, 26 avisa com "Brix alto" (Brix e BHX)', async () => {
      await semNotificacao(hid);
      await hid.tocar('[data-a="abrir-prancheta"][data-id="hid_anexo1"]');
      for (const q of ['brix', 'bhx']) {
        await hid.tocar(`[data-quadro="${q}"]`); await hid.limpar(); await hid.teclar(['2', '5']);
        certo(!/\bfora\b/.test(await hid.avaliar(`document.querySelector('[data-quadro="${q}"]').className`)), q + ' 25 sem aviso');
        await hid.limpar(); await hid.teclar(['2', '6']);
        await hid.esperar(`/\\bfora\\b/.test(document.querySelector('[data-quadro="${q}"]').className)`, 3000, q + ' 26 com aviso');
        certo((await hid.avaliar(`document.querySelector('[data-quadro="${q}"]').textContent`)).includes('Brix alto'), q + ': etiqueta Brix alto');
      }
      await hid.tocar('[data-ed="ocultar"]');
      // salva: com a anotação pela metade, a tela do setor não se redesenha sozinha (e as folhas novas valem no próximo desenho)
      await hid.tocar('[data-a="salvar"]');
    });

    await teste(grupo, 'caixa de digitar: fundo do papel, letra da tinta e cantos arredondados, no claro e no escuro', async () => {
      for (const tema of ['claro', 'escuro']) {
        await chefe.avaliar(`(() => { document.documentElement.dataset.tema = ${JSON.stringify(tema)}; textoLivre({ titulo: 'Endereço', tipo: 'url' }); return 1; })()`);
        await chefe.esperar('!!document.querySelector(".modal #txt")', 5000, 'janela com a caixa');
        const s = await chefe.avaliar(`(() => {
          const caixa = getComputedStyle(document.querySelector('.modal #txt')), raiz = getComputedStyle(document.documentElement);
          const cor = (v) => { const e = document.createElement('i'); e.style.color = raiz.getPropertyValue(v); document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; };
          return { fundo: caixa.backgroundColor, letra: caixa.color, papel: cor('--papel'), tinta: cor('--tinta'), canto: parseFloat(caixa.borderTopLeftRadius) };
        })()`);
        igual(s.fundo, s.papel, tema + ': fundo da caixa');
        igual(s.letra, s.tinta, tema + ': letra da caixa');
        certo(s.canto >= 8, tema + ': cantos arredondados (' + s.canto + ')');
        await chefe.tocar('.modal [data-k="x"]');
        await chefe.esperar('!document.querySelector(".modal")', 5000, 'fechou');
      }
      await chefe.avaliar('(() => { delete document.documentElement.dataset.tema; return 1; })()');
    });

    await teste(grupo, 'grades sem caixa sozinha: 4 numa linha, 6 = 3 + 3, 8 = 4 + 4, 5 = 3 + 2; no celular 4 = 2 + 2', async () => {
      // [itens, largura da grade] com caixas de no mínimo 96 px, até 4 por linha
      igual(await chefe.avaliar('[[4, 900], [6, 900], [8, 1200], [5, 900], [2, 900], [3, 900], [4, 330], [6, 330], [1, 900]].map(([n, l]) => colunasDaGrade(n, l, 96, 4, 8)).join()'),
        '4,3,4,3,2,3,2,3,1');
      const linhas = 'JSON.stringify([...new Set([...document.querySelectorAll(".modal .grade-acoes button")].map((b) => Math.round(b.getBoundingClientRect().top)))].length)';
      // o Resumo do dia (WhatsApp, E-mail, Outros apps, Copiar): no tablet, os 4 numa linha só
      await chefe.avaliar('(() => { verResumo(dataProducao()); return 1; })()');
      await chefe.esperar('document.querySelector(".modal .grade-acoes") && document.querySelector(".modal .grade-acoes").dataset.colunas === "4"', 8000, 'Resumo com 4 colunas');
      igual(await chefe.avaliar(linhas), '1', 'tablet: uma linha');
      await chefe.foto(path.join(FOTOS, 'resumo-tablet.png'));
      await chefe.tocar('.modal [data-k="x"]');
      // no celular, 2 + 2 (sem caixa sozinha)
      await chefe.tamanhoTela(TAMANHOS.celular);
      await chefe.avaliar('(() => { verResumo(dataProducao()); return 1; })()');
      await chefe.esperar('document.querySelector(".modal .grade-acoes") && document.querySelector(".modal .grade-acoes").dataset.colunas === "2"', 8000, 'Resumo com 2 colunas no celular');
      igual(await chefe.avaliar(linhas), '2', 'celular: duas linhas iguais');
      await chefe.foto(path.join(FOTOS, 'resumo-celular.png'));
      await chefe.tocar('.modal [data-k="x"]');
      await chefe.tamanhoTela(TAMANHOS.tablet);
    });

    await teste(grupo, 'aviso novo com texto curto em outra área: temperatura da destilaria acima de 90', async () => {
      await semNotificacao(chefe);
      await chefe.tocar('[data-a="pessoa"]'); await chefe.tocar('[data-k="folhas"]');
      await chefe.esperar('!!document.querySelector("main.tela-folhas")', 8000, 'tela Folhas e avisos');
      await chefe.tocar('[data-a="folha-campo"][data-pid="destilaria"][data-id="temp_pe_a"]');
      await chefe.tocar('.modal [data-k="av-mais"]');
      await chefe.avaliar(`(() => { const d = document.querySelector(".aviso-editar"); d.querySelector(".av-quando").value = ">"; d.querySelector(".av-valor").value = "90";
        d.querySelector(".av-texto").value = "Temperatura acima de 90: avise o encarregado"; d.querySelector(".av-curto").value = "Temp. alta"; return 1; })()`);
      await chefe.tocar('.modal [data-k="ok"]');
      await chefe.esperar('!document.querySelector(".modal")', 8000, 'salvou o aviso');
      // chega no tablet do setor (vale para todos os tablets) e a etiqueta vermelha é o texto curto
      const campo = 'USINA.pranchetas.destilaria.itens.find((c) => c.id === "temp_pe_a")';
      await hid.esperar(`(${campo}.avisos || []).length === 1`, 20000, 'o aviso chegou no tablet do setor');
      igual(await hid.avaliar(`JSON.stringify(avisosDe(${campo}, "95"))`), JSON.stringify([{ nivel: 'alerta', texto: 'Temperatura acima de 90: avise o encarregado', curto: 'Temp. alta' }]));
      igual(await hid.avaliar(`avisosDe(${campo}, "90").length`), 0, '90 não avisa');
    });

    await teste(grupo, 'sem texto curto, a etiqueta é o começo do texto (até os dois-pontos)', async () => {
      await chefe.tocar('[data-a="folha-campo"][data-pid="destilaria"][data-id="temp_pe_a"]');
      await chefe.avaliar('(() => { document.querySelector(".aviso-editar .av-curto").value = ""; return 1; })()');
      await chefe.tocar('.modal [data-k="ok"]');
      await chefe.esperar('!document.querySelector(".modal")', 8000, 'salvou');
      await hid.esperar(`USINA.pranchetas.destilaria.itens.find((c) => c.id === "temp_pe_a").avisos[0].curto === "Temperatura acima de"`, 20000, 'curto pelo começo do texto');
    });

    await teste(grupo, 'Usina: as seções que mandam totais dizem que não precisa preencher (o Evandro busca pela API)', async () => {
      await chefe.tocar('[data-a="voltar"]');
      await semNotificacao(chefe);
      await chefe.tocar('[data-a="config"]');
      await chefe.esperar('!!document.querySelector("main.config")', 8000, 'Usina aberta');
      for (const bloco of ['#bloco-turnos', '#bloco-base44']) {
        await chefe.esperar(`(document.querySelector(${JSON.stringify(bloco)}) || {}).textContent.includes("Não precisa preencher")`, 10000, bloco + ' com o aviso');
      }
      await chefe.foto(path.join(FOTOS, 'usina-envio.png'));
      await chefe.tocar('[data-a="voltar"]');
    });

    await teste(grupo, 'envio: as 6 áreas ficam 3 + 3 e os 3 turnos numa linha (caixas iguais, nenhuma sozinha)', async () => {
      await semNotificacao(chefe);
      await chefe.tocar('[data-a="compartilhar"][data-destino="whatsapp"]');
      await chefe.esperar('!!document.querySelector(".modal .setores-envio button")', 8000, 'janela de envio');
      await dormir(300);
      const linhas = (sel) => chefe.avaliar(`[...new Set([...document.querySelectorAll(${JSON.stringify(sel + ' button')})].map((b) => Math.round(b.getBoundingClientRect().top)))].length`);
      igual(await chefe.avaliar('document.querySelectorAll(".setores-envio button").length'), 6);
      igual(await linhas('.setores-envio'), 2, 'áreas em 2 linhas');
      igual(await chefe.avaliar('document.querySelector(".setores-envio").dataset.colunas'), '3', 'áreas 3 + 3');
      igual(await linhas('.turnos-envio'), 1, 'turnos numa linha');
      await chefe.foto(path.join(FOTOS, 'envio-tablet.png'));
      await chefe.tocar('.modal [data-k="x"]');
      await chefe.esperar('!document.querySelector(".modal")', 5000, 'fechou');
    });

    await teste(grupo, 'nenhum erro de JavaScript', async () => {
      const erros = aparelhos.flatMap((a) => a.erros.map((e) => `[${a.nome}] ${e}`));
      certo(!erros.length, erros.join(' | '));
    });
  } finally {
    for (const a of aparelhos) await a.fechar().catch(() => {});
    await c.desligar();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const g = novoGrupo('Pedidos de 21/10 (2.16.1)');
  const nav = await abrirNavegador();
  try { await testarAjustes2161(nav, centralNode, 8360, g); } finally { await nav.fechar(); }
  resumo([g]);
}
