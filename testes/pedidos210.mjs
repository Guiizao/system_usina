/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Versão 2.10 (só telas, vai pela atualização rápida), nas duas centrais:
 *   - exportar em PDF escolhendo os setores: uma página para cada folha de papel;
 *   - gráficos do dia no painel do tablet chefe (Brix, pH e temperaturas) e a tela com todos;
 *   - Folhas e avisos: o tablet chefe muda o nome do quadro e o aviso do pH, e o tablet do setor já usa o novo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { TAMANHOS, dormir } from './navegador.mjs';
import { teste, certo, igual, entrarComoChefe } from './teste.mjs';
import { pastaTemporaria, APP } from './servidores.mjs';

const diaProducao = () => { const d = new Date(Date.now() - 7 * 3600000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export async function testarPedidos210(nav, ligar, porta, grupo) {
  const c = await ligar(porta, pastaTemporaria('v210'));
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
  const registro = async () => (await c.api('/api/registro?dia=' + diaProducao())).registros.map((r) => r.valores);

  try {
    const chefe = await novo('tablet chefe', TAMANHOS.tablet);
    const hid = await novo('tablet da Hidrólise', TAMANHOS.tablet);
    await conectar(chefe, 'central');
    await conectar(hid, 'hidrolise', 'Felipe');

    await teste(grupo, 'o setor anota duas dornas (Brix e pH) e o tablet chefe recebe', async () => {
      await semNotificacao(hid);
      await hid.tocar('[data-a="abrir-prancheta"][data-id="hid_anexo1"]');
      for (const [brix, ph] of [[['1', '8'], ['4', ',', '6']], [['2', '2'], ['5', ',', '1']]]) {
        await hid.tocar('[data-quadro="brix"]'); await hid.teclar(brix);
        await hid.tocar('[data-quadro="phf"]'); await hid.teclar(ph);
        await hid.tocar('[data-ed="ocultar"]');
        await hid.tocar('[data-a="salvar"]');
        await dormir(400);
        await hid.tocar('.seletor-nova [data-a="linha"]');
      }
      await chefe.esperar(`Object.values(JSON.parse(localStorage.getItem("usina.registros") || "{}")).filter((r) => r.prancheta === "hid_anexo1" && !r.apagado).length >= 2`, 20000, 'as duas dornas no tablet chefe');
    });

    await teste(grupo, 'gráficos no painel: Hidrólise Brix e pH com os pontos anotados e a linha do aviso', async () => {
      await chefe.esperar('document.querySelectorAll(".graficos-painel .grafico:not(.vazio)").length >= 2', 15000, 'gráficos no painel');
      const brix = await chefe.avaliar('(() => { const g = [...document.querySelectorAll(".graficos-painel .grafico")].find((x) => x.textContent.includes("Hidrólise: Brix")); return g ? { pontos: g.querySelectorAll(".graf-ponto").length, texto: g.textContent, faixa: g.querySelectorAll(".graf-faixa").length } : null; })()');
      certo(brix, 'gráfico do Brix');
      igual(brix.pontos, 2, 'dois pontos de Brix');
      certo(brix.texto.includes('22'), 'último Brix na legenda: ' + brix.texto);
      const ph = await chefe.avaliar('(() => { const g = [...document.querySelectorAll(".graficos-painel .grafico")].find((x) => x.textContent.includes("Hidrólise: pH")); return g ? g.querySelectorAll(".graf-faixa.alerta").length : -1; })()');
      certo(ph >= 1, 'linha do aviso de pH 5');
    });

    await teste(grupo, 'tela dos gráficos: todos os setores e o filtro por setor', async () => {
      await chefe.tocar('.titulo-secao [data-a="graficos"]');
      await chefe.esperar('!!document.querySelector("main.graficos")', 8000, 'tela dos gráficos');
      const total = await chefe.avaliar('document.querySelectorAll(".graficos-lista .grafico").length');
      certo(total >= 6, 'gráficos de todos os setores: ' + total);
      await chefe.tocar('[data-a="graficos-setor"][data-setor="hidrolise"]');
      const titulos = await chefe.avaliar('[...document.querySelectorAll(".graficos-lista .graf-cab b")].map((b) => b.textContent)');
      certo(titulos.length && titulos.every((t) => /Hidrólise|Sacarificação/.test(t)), 'só da Hidrólise: ' + titulos.join(', '));
      await chefe.tocar('[data-a="voltar"]');
    });

    await teste(grupo, 'exportar PDF só da Hidrólise: uma página para cada folha de papel', async () => {
      await semNotificacao(chefe);
      await chefe.avaliar('(() => { window.__arquivos = []; const o = URL.createObjectURL; URL.createObjectURL = (b) => { window.__arquivos.push(b); return o.call(URL, b); }; return true; })()');
      await chefe.tocar('[data-a="compartilhar"][data-destino="baixar"]');
      const outros = await chefe.avaliar('[...document.querySelectorAll(".setores-envio [data-k^=\\"s:\\"]")].map((b) => b.dataset.k).filter((k) => k !== "s:hidrolise")');
      for (const k of outros) await chefe.tocar(`.setores-envio [data-k="${k}"]`);
      await chefe.tocar('[data-k="f:pdf"]');
      await chefe.esperar('window.__arquivos.length > 0', 15000, 'arquivo PDF');
      const r = await chefe.avaliar(`(async () => {
        const f = window.__arquivos[0];
        const b = new Uint8Array(await f.arrayBuffer());
        let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
        const esperadas = USINA.setores.find((x) => x.id === 'hidrolise').pranchetas.flatMap((pid) => USINA.pranchetas[pid].tipo === 'juntas' ? USINA.pranchetas[pid].partes.map((p) => p.prancheta) : [pid]).length;
        let b64 = ''; for (let i = 0; i < b.length; i += 8192) b64 += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
        return { nome: f.name, tipo: f.type, inicio: s.slice(0, 8), fim: s.slice(-6).trim(), paginas: (s.match(/\\/Type \\/Page /g) || []).length, esperadas, logo: s.includes('/DCTDecode'), b64: btoa(b64) };
      })()`);
      certo(/^Pranchetas_\d{4}-\d{2}-\d{2}_hidrolise\.pdf$/.test(r.nome), 'nome: ' + r.nome);
      igual(r.tipo, 'application/pdf');
      igual(r.inicio, '%PDF-1.4');
      igual(r.fim, '%%EOF');
      igual(r.paginas, r.esperadas, 'uma página por folha');
      certo(r.logo, 'com o logo');
      fs.mkdirSync(path.join(APP, 'testes', 'saida'), { recursive: true });
      fs.writeFileSync(path.join(APP, 'testes', 'saida', 'folhas-2.10.pdf'), Buffer.from(r.b64, 'base64'));
      return `${r.paginas} páginas`;
    });

    await teste(grupo, 'Folhas e avisos: o chefe muda o aviso do pH e o nome do Brix; o tablet do setor já usa o novo', async () => {
      await semNotificacao(chefe);
      await chefe.tocar('[data-a="pessoa"]'); await chefe.tocar('[data-k="folhas"]');
      await chefe.esperar('!!document.querySelector("main.tela-folhas")', 8000, 'tela Folhas e avisos');
      await chefe.tocar('[data-a="folha-campo"][data-pid="hid_anexo1"][data-id="phf"]');
      await chefe.avaliar('(() => { const d = document.querySelector(".aviso-editar"); d.querySelector(".av-valor").value = "4,5"; d.querySelector(".av-texto").value = "pH abaixo de 4,5: coloque cal"; return true; })()');
      await chefe.tocar('.modal [data-k="ok"]');
      await chefe.esperar('!document.querySelector(".modal")', 8000, 'salvou o pH');
      await chefe.tocar('[data-a="folha-campo"][data-pid="hid_anexo1"][data-id="brix"]');
      await chefe.avaliar('(() => { document.getElementById("f-label").value = "Brix da dorna"; return true; })()');
      await chefe.tocar('.modal [data-k="ok"]');
      await chefe.esperar('!document.querySelector(".modal") && document.body.innerText.includes("Brix da dorna")', 8000, 'salvou o Brix');
      // no tablet do setor: pH 4,6 não avisa mais (o aviso agora é abaixo de 4,5); 4,4 avisa
      await hid.esperar('(document.querySelector("[data-quadro=\\"brix\\"]") || {}).textContent.includes("Brix da dorna")', 20000, 'nome novo no tablet do setor');
      await hid.tocar('[data-quadro="phf"]'); await hid.tocar('[data-ed="limpar"]'); await hid.teclar(['4', ',', '6']);
      certo(!(await hid.avaliar('document.querySelector("[data-quadro=\\"phf\\"]").className')).match(/\bfora\b/), 'pH 4,6 sem aviso');
      await hid.tocar('[data-ed="limpar"]'); await hid.teclar(['4', ',', '4']);
      await hid.esperar('/\\bfora\\b/.test(document.querySelector("[data-quadro=\\"phf\\"]").className)', 3000, 'pH 4,4 com aviso');
      await hid.tocar('[data-ed="ocultar"]');
      // salva: com a anotação pela metade a tela do setor não se redesenha sozinha
      await hid.tocar('[data-a="salvar"]');
    });

    await teste(grupo, 'a mudança das folhas fica no registro, com o antes e o depois', async () => {
      const t0 = Date.now();
      let l = [];
      while (Date.now() - t0 < 15000) { l = await registro(); if (l.some((x) => /mudou a faixa e os avisos de PHF/.test(x.texto)) && l.some((x) => /Brix da dorna/.test(x.texto))) break; await dormir(600); }
      const av = l.find((x) => /mudou a faixa e os avisos de PHF/.test(x.texto));
      certo(av, 'aviso do pH no registro: ' + l.map((x) => x.texto).join(' / '));
      certo((av.mudancas || []).some((m) => /5/.test(m.antes) && /4,5/.test(m.depois)), 'antes 5, depois 4,5: ' + JSON.stringify(av.mudancas));
      certo(l.some((x) => /nome Brix -> Brix da dorna/.test(x.texto)), 'nome no registro');
    });

    await teste(grupo, 'voltar ao original: o aviso do pH volta a ser abaixo de 5', async () => {
      await chefe.tocar('[data-a="folha-campo"][data-pid="hid_anexo1"][data-id="phf"]');
      await chefe.tocar('.modal [data-k="original"]');
      await chefe.esperar('!document.querySelector(".modal")', 8000, 'voltou');
      await hid.esperar('USINA.pranchetas.hid_anexo1.campos.find((c) => c.id === "phf").avisos[0].valor === 5', 20000, 'o original chegou no tablet do setor');
      await hid.tocar('.seletor-nova [data-a="linha"]');
      await hid.tocar('[data-quadro="phf"]'); await hid.tocar('[data-ed="limpar"]'); await hid.teclar(['4', ',', '6']);
      await hid.esperar('/\\bfora\\b/.test(document.querySelector("[data-quadro=\\"phf\\"]").className)', 20000, 'pH 4,6 avisa de novo');
      await hid.tocar('[data-ed="ocultar"]');
    });

    await teste(grupo, 'Consulta não mexe nas folhas', async () => {
      const temFolhas = await chefe.avaliar('USINA.niveis.consulta.funcoes.includes("folhas") || USINA.niveis.encarregado.funcoes.includes("folhas")');
      igual(temFolhas, false, 'só o administrador, ou quem ganhar a função');
      certo((await chefe.avaliar('USINA.funcoes.map((f) => f.id)')).includes('folhas'), 'função folhas na lista');
    });

    await teste(grupo, 'nenhum erro de JavaScript', async () => {
      const erros = aparelhos.flatMap((a) => a.erros.map((e) => `${a.nome}: ${e}`));
      certo(!erros.length, erros.join(' | ').slice(0, 500));
    });
  } finally {
    await Promise.all(aparelhos.map((a) => a.fechar()));
    await c.desligar();
  }
}
