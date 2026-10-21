/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Versão 2.12 no aplicativo, nas duas centrais (as configurações do sistema, só o dono no tablet chefe nível 3):
 *   - o dono libera o tablet chefe no nível 3 e entra com as configurações do sistema;
 *   - vírgula: 2 casas na Pressão da Caldeira, e o operador anota 6,25;
 *   - unidade: a Temperatura da água vira °F a partir de hoje (a de ontem continua °C, também na API);
 *   - mostrar ao operador: o quadro escondido some do tablet do setor;
 *   - campo novo na Caldeira: o operador anota e a central guarda;
 *   - campo do escritório para o operador: a NF no Ralo (a central aceita porque o dono liberou).
 */
import fs from 'node:fs';
import path from 'node:path';
import { TAMANHOS, dormir } from './navegador.mjs';
import { teste, certo, igual, entrarComoChefe, liberarSePedir } from './teste.mjs';
import { pastaTemporaria } from './servidores.mjs';

const diaProducao = (menos = 0) => { const d = new Date(Date.now() - 7 * 3600000 - menos * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export async function testarPedidos212(nav, ligar, porta, grupo, comApi) {
  const c = await ligar(porta, pastaTemporaria('v212'));
  const aparelhos = [];
  async function novo(nome, tamanho) { const a = await nav.novoAparelho(nome, tamanho); aparelhos.push(a); return a; }
  async function conectar(a, papel, operador, nivel) {
    await a.ir(c.url + '/', 'document.querySelector("[data-quadro=\\"codigo\\"]")');
    await a.tocar('[data-quadro="codigo"]');
    await a.teclar(c.codigo().split(''));
    await a.tocar('[data-ed="ocultar"]');
    await a.tocar('[data-a="conectar"]');
    await a.tocar(`[data-a="papel"][data-id="${papel}"]`, null, { esperarMs: 15000 });
    if (papel === 'central') { await liberarSePedir(a, nivel); await entrarComoChefe(a); }
    if (operador) await a.tocar(`[data-a="escolher-operador"][data-nome="${operador}"]`);
  }
  const semNotificacao = async (a) => { await a.avaliar('(() => { const t = document.getElementById("toast"); if (!t.hidden) t.click(); })()'); await dormir(350); };
  const naCentral = async (id) => ((await c.api('/api/registros?desde=0')).registros || []).find((r) => r.id === id);
  const esperarNaCentral = async (achar, descricao, ms = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const l = (await c.api('/api/registros?desde=0')).registros || []; const r = l.find(achar); if (r) return r; await dormir(600); }
    throw new Error('não chegou na central: ' + descricao);
  };
  const abrirFolhas = async (chefe) => {
    await semNotificacao(chefe);
    if (!(await chefe.avaliar('!!document.querySelector("main.tela-folhas")'))) { await chefe.tocar('[data-a="pessoa"]'); await chefe.tocar('[data-k="folhas"]'); }
    await chefe.esperar('!!document.querySelector("main.tela-folhas")', 8000, 'tela Folhas e avisos');
  };
  const anotarNaCaldeira = async (cal, quadro, teclas) => {
    await semNotificacao(cal);
    if (!(await cal.avaliar(`!!document.querySelector('[data-quadro="${quadro}"]')`))) await cal.tocar('[data-a="abrir-prancheta"][data-id="caldeira"]');
    await cal.tocar(`[data-quadro="${quadro}"]`);
    await cal.limpar().catch(() => {});
    await cal.teclar(teclas);
  };
  const CFG = 'config|sistema|geral';
  try {
    const chefe = await novo('tablet chefe', TAMANHOS.tablet);
    const cal = await novo('tablet da Caldeira', TAMANHOS.tablet);
    const ralo = await novo('tablet do Ralo', TAMANHOS.tablet);
    await conectar(chefe, 'central', null, 3);
    await conectar(cal, 'caldeira', 'Alberto');
    await conectar(ralo, 'ralo', 'Jair');

    await teste(grupo, 'o dono libera o tablet chefe no nível 3 e entra com as configurações do sistema', async () => {
      const cfg = await chefe.avaliar('JSON.parse(localStorage.getItem("usina.cfg"))');
      igual(cfg.nivelChefe, 3);
      certo(cfg.pessoa && cfg.pessoa.dono && cfg.pessoa.funcoes.includes('sistema'), 'funções: ' + JSON.stringify(cfg.pessoa));
    });

    await teste(grupo, 'vírgula: o dono põe 2 casas na Pressão; no tablet da Caldeira o operador anota 6,25', async () => {
      await abrirFolhas(chefe);
      await chefe.tocar('[data-a="folha-campo"][data-pid="caldeira"][data-id="pressao"]');
      certo(await chefe.avaliar('document.querySelector(".modal").innerText.includes("Só você (dono)")'), 'as opções do dono aparecem');
      await chefe.tocar('.modal [data-k="dec:2"]');
      await chefe.tocar('.modal [data-k="ok"]');
      await chefe.esperar('!document.querySelector(".modal")', 8000, 'salvou a vírgula');
      await cal.esperar('USINA.pranchetas.caldeira.itens.find((c) => c.id === "pressao").dec === 2', 20000, 'a vírgula nova no tablet da Caldeira');
      await anotarNaCaldeira(cal, 'pressao', ['6', ',', '2', '5']);
      certo((await cal.avaliar('document.querySelector(".visor").textContent')).includes('6,25'), 'o visor mostra 6,25');
      await cal.tocar('[data-ed="ocultar"]');
      await cal.tocar('[data-a="salvar"]');
      await esperarNaCentral((r) => r.prancheta === 'caldeira' && r.valores && r.valores.pressao === '6.25', 'pressão 6.25');
    });

    await teste(grupo, 'unidade: a Temperatura da água vira °F a partir de hoje; o dia de ontem continua °C', async () => {
      await abrirFolhas(chefe);
      await chefe.tocar('[data-a="folha-campo"][data-pid="caldeira"][data-id="temp_agua"]');
      await chefe.tocar('.modal [data-k="u:°F"]');
      await chefe.tocar('.modal [data-k="ok"]');
      await chefe.esperar('!document.querySelector(".modal")', 8000, 'salvou a unidade');
      const ontem = diaProducao(1);
      const cfg = await esperarNaCentral((r) => r.id === CFG && r.valores.folhas && r.valores.folhas.caldeira && (r.valores.folhas.caldeira.temp_agua || {}).unidade === '°F', 'unidade °F');
      igual(JSON.stringify(cfg.valores.folhas.caldeira.temp_agua.historico), JSON.stringify([{ ate: ontem, unidade: '°C' }]), 'guarda a unidade de antes até ontem');
      if (comApi) {
        // a API da central do computador: hoje °F; ontem °C (nada é convertido)
        await c.api('/api/sync', { aparelho: 'teste', registros: [{ id: `${ontem}|caldeira|10`, data: ontem, prancheta: 'caldeira', chave: '10', valores: { temp_agua: '95' }, atualizadoEm: Date.now(), criadoEm: Date.now() }] });
        const token = JSON.parse(fs.readFileSync(path.join(c.pastaServidor, 'config.json'), 'utf8')).tokenLeitura;
        const api = async (rota) => (await (await fetch(c.url + rota, { headers: { Authorization: 'Bearer ' + token } })).json());
        const esq = await api('/api/v1/esquema');
        const campoEsq = esq.setores.find((s) => s.id === 'caldeira').pranchetas.find((p) => p.id === 'caldeira').campos.find((x) => x.id === 'temp_agua');
        igual(campoEsq.unidade, '°F', 'o esquema mostra a unidade de agora');
        const dia = await api('/api/v1/dias/' + ontem);
        const linha = dia.setores.find((s) => s.id === 'caldeira').pranchetas.find((p) => p.id === 'caldeira').linhas.find((l) => l.hora === '10:00');
        igual(linha.campos.temp_agua.unidade, '°C', 'ontem continua °C');
      }
    });

    await teste(grupo, 'mostrar ao operador: o dono esconde a Retirada Cinza e ela some do tablet da Caldeira', async () => {
      await abrirFolhas(chefe);
      await chefe.tocar('[data-a="folha-campo"][data-pid="caldeira"][data-id="retirada_cinza"]');
      await chefe.tocar('.modal [data-k="oculto"]');
      await chefe.tocar('.modal [data-k="ok"]');
      await chefe.esperar('!document.querySelector(".modal")', 8000, 'salvou');
      await cal.esperar('USINA.pranchetas.caldeira.itens.find((c) => c.id === "retirada_cinza").oculto === true', 20000, 'escondido no tablet da Caldeira');
      await semNotificacao(cal);
      await cal.esperar('!document.querySelector("[data-quadro=\\"retirada_cinza\\"]")', 15000, 'o quadro sumiu da tela do operador');
    });

    await teste(grupo, 'campo novo: o dono cria "Temperatura da saída" na Caldeira; o operador anota e a central guarda', async () => {
      await abrirFolhas(chefe);
      await chefe.tocar('[data-a="folha-estrutura"][data-pid="caldeira"]');
      await chefe.tocar('.modal [data-k="novo"]');
      await chefe.esperar('!!document.querySelector(".modal #cn-nome")', 5000, 'janela do campo novo');
      await chefe.avaliar('(() => { document.getElementById("cn-nome").value = "Temperatura da saída"; return true; })()');
      await chefe.tocar('.modal [data-k="cu:°C"]');
      await chefe.tocar('.modal [data-k="d:1"]');
      await chefe.tocar('.modal [data-k="ok"]');
      await chefe.esperar('!!document.querySelector(".modal #est-novos") && document.querySelector(".modal").innerText.includes("Temperatura da saída")', 5000, 'o campo na estrutura');
      await chefe.tocar('.modal [data-k="ok"]');
      await chefe.esperar('!document.querySelector(".modal")', 8000, 'salvou a estrutura');
      const idDoNovo = '(USINA.pranchetas.caldeira.itens.find((c) => c.novo && c.label === "Temperatura da saída") || {}).id';
      await cal.esperar('!!' + idDoNovo, 20000, 'o campo novo no tablet da Caldeira');
      const id = await cal.avaliar(idDoNovo);
      try { await cal.esperar(`!!document.querySelector('[data-quadro="${id}"]')`, 15000, 'o quadro novo na tela'); } catch (e) {
        throw new Error(e.message + ' | quadros: ' + (await cal.avaliar('[...document.querySelectorAll("[data-quadro]")].map((q) => q.dataset.quadro).join(",")')) + ' | tela: ' + (await cal.avaliar('(document.querySelector("main") || document.body).innerText.slice(0, 300)')));
      }
      await anotarNaCaldeira(cal, id, ['8', '8', ',', '5']);
      await cal.tocar('[data-ed="ocultar"]');
      await cal.tocar('[data-a="salvar"]');
      await esperarNaCentral((r) => r.prancheta === 'caldeira' && r.valores && r.valores[id] === '88.5', 'o campo novo com 88.5');
    });

    await teste(grupo, 'campo do escritório para o operador: o dono libera a NF no Ralo; o operador anota e a central aceita', async () => {
      await abrirFolhas(chefe);
      await chefe.tocar('[data-a="folha-estrutura"][data-pid="ins_materia_prima"]');
      await chefe.tocar('.modal [data-k="op:nf"]');
      await chefe.tocar('.modal [data-k="ok"]');
      await chefe.esperar('!document.querySelector(".modal")', 8000, 'salvou');
      await ralo.esperar('USINA.pranchetas.ins_materia_prima.camposOperador.some((c) => c.id === "nf")', 20000, 'a NF no tablet do Ralo');
      await semNotificacao(ralo);
      if (!(await ralo.avaliar('!!document.querySelector("[data-quadro=\\"nf\\"]")'))) await ralo.tocar('[data-a="abrir-prancheta"][data-id="ins_materia_prima"]');
      await ralo.tocar('[data-quadro="qtd"]'); await ralo.teclar(['5', '0', '0']);
      await ralo.tocar('[data-quadro="nf"]'); await ralo.teclar(['N', 'F']);
      await ralo.tocar('[data-ed="ocultar"]');
      await ralo.tocar('[data-a="salvar"]');
      await esperarNaCentral((r) => r.prancheta === 'ins_materia_prima' && r.valores && r.valores.nf === 'NF', 'a NF anotada pelo operador');
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
