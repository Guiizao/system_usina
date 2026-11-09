/* Pranchetas Digitais - © 2026 Guilherme. */
/* Telas da 2.17: liberar sem escolher nível e aparelhos fixos da pessoa (2b). Fotos em testes/saida/pc217/.
   node testes/pc217.mjs */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { abrirNavegador, TAMANHOS, dormir } from './navegador.mjs';
import { novoGrupo, teste, certo, igual, resumo, entrarComoChefe, teclasDaSenha } from './teste.mjs';
import { centralNode, pastaTemporaria, APP } from './servidores.mjs';
import { ligarNuvemSQLite } from './nuvem-sqlite.mjs';
import { pbkdf2Sync } from 'node:crypto';
import { createRequire } from 'node:module';

const SEGREDO = 'segredo-ficticio-pc217';
const { carregarUsina } = createRequire(import.meta.url)('../carregar-usina.js');
const FORMS = carregarUsina(path.join(APP, 'public'));
// senhas de teste das pessoas fictícias (nunca as de verdade)
const verificador = (pin, sal = 'c'.repeat(32)) => ({ sal, iteracoes: 1000, verificador: pbkdf2Sync(pin, sal, 1000, 32, 'sha256').toString('hex') });
const PESSOAS = [
  { id: 'lucas', nome: 'Lucas', nivel: 'consulta', ativo: true, extras: { escritorio: true }, funcoes: ['escritorio', 'relatorios'], nuvem: verificador('2468') },
  { id: 'ana', nome: 'Ana', nivel: 'consulta', ativo: true, funcoes: ['relatorios'], nuvem: verificador('1357') },
];
/** Cfg inicial só na primeira página (as recargas mantêm o que o aplicativo gravou). */
const cfgInicial = (nuvemUrl) => `if (!localStorage.getItem('usina.cfg')) localStorage.setItem('usina.cfg', JSON.stringify({ nuvemUrl: ${JSON.stringify(nuvemUrl)} }));`;

const FOTOS = path.join(APP, 'testes', 'saida', 'pc217');
const LINHA = (nome) => `[...document.querySelectorAll(".aparelhos-agora .agora-linha")].find((l) => l.innerText.includes(${JSON.stringify(nome)}))`;
const semNotificacao = async (a) => { await a.avaliar('(() => { const t = document.getElementById("toast"); if (t && !t.hidden) t.click(); return 1; })()'); await dormir(350); };

export async function testarNivelNaTela217(nav, g) {
  fs.mkdirSync(FOTOS, { recursive: true });
  const c = await centralNode(8366, pastaTemporaria('pc217-nivel'));
  const aparelhos = [];
  try {
    const chefe = await nav.novoAparelho('tablet chefe', TAMANHOS.tablet); aparelhos.push(chefe);
    await teste(g, '3.0: entra no tablet chefe sem configurar nada antes: com a senha ele fica no nível 2', async () => {
      await chefe.ir(c.url + '/', 'document.querySelector("[data-quadro=\\"codigo\\"]")');
      await chefe.tocar('[data-quadro="codigo"]'); await chefe.teclar(c.codigo().split('')); await chefe.tocar('[data-ed="ocultar"]');
      await chefe.tocar('[data-a="conectar"]');
      await chefe.tocar('[data-a="papel"][data-id="central"]', null, { esperarMs: 15000 });
      certo(!(await chefe.avaliar('!!document.querySelector(".modal .liberar-chefe")')), 'não pede para liberar antes');
      await entrarComoChefe(chefe);
      await chefe.esperar('JSON.parse(localStorage.getItem("usina.cfg") || "{}").nivelChefe === 2 && !document.querySelector(".modal")', 10000, 'nível 2');
    });
    await teste(g, 'pessoa nova: "Vale em" qualquer aparelho ou só nos fixos; marcar este tablet grava a lista', async () => {
      await semNotificacao(chefe);
      await chefe.tocar('[data-a="pessoa"]'); await chefe.tocar('[data-k="pessoas"]');
      await chefe.esperar('!!document.querySelector("[data-a=\\"pessoa-nova\\"]")', 10000, 'tela de pessoas');
      // um tablet de setor que a central conhece também pode ser fixo (revisão do Codex)
      await chefe.avaliar(`(() => { sync.status.aparelhos.push({ id: 'tab-setor', nome: 'Tablet da Hidrólise', papel: 'hidrolise' }); return 1; })()`);
      await chefe.tocar('[data-a="pessoa-nova"]');
      await chefe.esperar('!!document.querySelector(".modal [data-k=\\"v:todos\\"]")', 5000, 'Vale em');
      certo(await chefe.avaliar('document.querySelector(".modal [data-k=\\"v:todos\\"]").classList.contains("sel")'), 'qualquer aparelho vem marcado');
      await chefe.tocar('.modal [data-k="v:fixos"]');
      certo(await chefe.avaliar('!!document.querySelector(\'.modal [data-k="a:tab-setor"]\')'), 'tablet de setor na lista');
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

/** Task 4: entrar no PC por nome e senha; o endereço da nuvem fica na aba Servidor. */
export async function testarEntrarPC217(nav, g) {
  fs.mkdirSync(FOTOS, { recursive: true });
  const n = await ligarNuvemSQLite(8368, SEGREDO, 'leitura-ficticia-pc217');
  const c = await centralNode(8369, pastaTemporaria('pc217-login')); // só entrega as telas, como o programa do Windows
  const aparelhos = [];
  try {
    igual((await n.pedir('/central/enviar', { senha: SEGREDO, corpo: { geracao: 'pc217', registros: [], pessoas: PESSOAS, forms: FORMS } })).status, 200);
    const pc = await nav.novoAparelho('pc', TAMANHOS.pcGrande); aparelhos.push(pc);
    await pc.antesDeAbrir(cfgInicial(n.url));
    await teste(g, 'tela de entrar: logo, lista de nomes, senha e Entrar; o servidor fica numa aba própria', async () => {
      await pc.ir(c.url + '/?nuvem=1');
      await pc.esperar('!!document.querySelector("#nuvem-nome option[value=lucas]")', 15000, 'nomes da nuvem');
      igual(await pc.avaliar('[...document.querySelectorAll("#nuvem-nome option")].filter((o) => o.value).map((o) => o.textContent).join()'), 'Ana,Lucas');
      certo(await pc.avaliar('!!document.querySelector(".entrar-cartao img.entrar-logo") && document.querySelector("#nuvem-senha").type === "password"'), 'logo e senha');
      certo(!(await pc.avaliar('!!document.querySelector("#nuvem-url, [data-quadro=nuvem-url]")')), 'o endereço não aparece na tela de entrar');
      await pc.foto(path.join(FOTOS, 'entrar-pc.png'));
      await pc.tocar('[data-a="nuvem-servidor"]');
      await pc.esperar('!!document.querySelector(".modal #txt")', 5000, 'aba Servidor');
      igual(await pc.avaliar('document.querySelector(".modal #txt").value'), n.url);
      await pc.tocar('.modal [data-k="x"]');
    });
    await teste(g, 'senha errada avisa sem perder o nome; a certa entra como Lucas', async () => {
      await pc.avaliar(`(() => { document.getElementById('nuvem-nome').value = 'lucas'; document.getElementById('nuvem-senha').value = '1111'; return 1; })()`);
      await pc.tocar('.entrar-cartao button[type=submit]');
      await pc.esperar('document.getElementById("toast").textContent.includes("Senha não confere")', 8000, 'senha errada');
      igual(await pc.avaliar('document.getElementById("nuvem-nome").value'), 'lucas');
      await pc.avaliar(`(() => { document.getElementById('nuvem-senha').value = '2468'; return 1; })()`);
      await pc.tocar('.entrar-cartao button[type=submit]');
      await pc.esperar('cfg.soNuvem && cfg.pessoa && cfg.pessoa.nome === "Lucas" && !!document.querySelector(".menu-pc")', 15000, 'entrou');
    });
    const longe = await nav.novoAparelho('pc sem nuvem', TAMANHOS.computador); aparelhos.push(longe);
    await longe.antesDeAbrir(cfgInicial('http://127.0.0.1:9'));
    await teste(g, 'sem achar a nuvem: o nome fica desligado e a tela diz por quê', async () => {
      await longe.ir(c.url + '/?nuvem=1');
      await longe.esperar('document.querySelector("#nuvem-nome") && document.querySelector("#nuvem-nome").disabled && document.body.innerText.includes("Sem internet: não achei a nuvem")', 15000, 'aviso sem nuvem');
      await longe.foto(path.join(FOTOS, 'entrar-sem-nuvem.png'));
    });
    // nuvem que não responde (rede presa): a tela desiste em 8 s e diz por quê, em vez de ficar em "Buscando"
    const parado = http.createServer(() => {}); await new Promise((r) => parado.listen(8375, '127.0.0.1', r));
    const preso = await nav.novoAparelho('pc rede presa', TAMANHOS.computador); aparelhos.push(preso);
    await preso.antesDeAbrir(cfgInicial('http://127.0.0.1:8375'));
    await teste(g, 'nuvem que não responde: desiste em até 10 s com o aviso', async () => {
      await preso.ir(c.url + '/?nuvem=1');
      await preso.esperar('document.body.innerText.includes("Sem internet: não achei a nuvem")', 11000, 'desistiu');
    });
    // trocar o servidor com a busca antiga ainda presa: a resposta velha (que desiste em 8 s) não apaga os nomes novos
    await teste(g, 'trocar o servidor no meio da busca: a resposta da busca antiga é descartada', async () => {
      await preso.ir(c.url + '/?nuvem=1');
      await preso.esperar('nuvemForm.buscando', 5000, 'busca presa');
      await preso.avaliar(`(() => { nuvemForm.url = ${JSON.stringify(n.url)}; nuvemForm.pessoas = null; carregarNomesDaNuvem(); return 1; })()`);
      await preso.esperar('!!document.querySelector("#nuvem-nome option[value=lucas]")', 8000, 'nomes do servidor novo');
      await dormir(9000);
      certo(await preso.avaliar('!!document.querySelector("#nuvem-nome option[value=lucas]") && !nuvemForm.erro'), 'os nomes continuam');
    });
    parado.closeAllConnections(); parado.close();
    for (const a of aparelhos) certo(!a.erros.length, a.erros.join(' | '));
  } finally {
    for (const a of aparelhos) await a.fechar().catch(() => {});
    await c.desligar(); await n.desligar();
  }
}

/** Task 5: painel do PC pela nuvem com os aparelhos ao vivo, as últimas anotações e o Escritório (só ver). */
export async function testarPainelPC217(nav, g) {
  fs.mkdirSync(FOTOS, { recursive: true });
  const n = await ligarNuvemSQLite(8372, SEGREDO, 'leitura-ficticia-pc217b');
  const c = await centralNode(8373, pastaTemporaria('pc217-painel'));
  const pc = await nav.novoAparelho('pc', TAMANHOS.pcGrande);
  try {
    const agora = Date.now();
    const dia = new Date(agora - 10 * 3600000).toISOString().slice(0, 10); // dia de produção: fuso -3 e a virada às 07:00
    const reg = (prancheta, chave, operador, valores, min) => ({ id: `${dia}|${prancheta}|${chave}`, data: dia, prancheta, chave: String(chave), operador, valores, atualizadoEm: agora - min * 60000, seq: 0 });
    const regs = [reg('hid_anexo1', 1, 'Felipe', { brix: '18', inicio: '08:00' }, 30), reg('caldeira', 8, 'José', { pressao: '6' }, 20), reg('ins_cal', 9, 'Felipe', { qtd: '2' }, 10)].map((r, i) => ({ ...r, seq: i + 1 }));
    const aparelhos = [
      { id: 'tab-hid', nome: 'Tablet da Hidrólise', papel: 'hidrolise', setor: 'hidrolise', operador: 'Felipe', pessoa: '', versao: '2.17.0', vistoEm: agora - 20000 },
      { id: 'tab-cal', nome: 'Tablet da Caldeira', papel: 'caldeira', setor: 'caldeira', operador: '', pessoa: '', versao: '2.16.1', vistoEm: agora - 10 * 60000 },
    ];
    igual((await n.pedir('/central/enviar', { senha: SEGREDO, corpo: { geracao: 'pc217b', registros: regs, pessoas: PESSOAS, forms: FORMS, aparelhos } })).status, 200);
    await pc.antesDeAbrir(cfgInicial(n.url));
    await pc.ir(c.url + '/?nuvem=1');
    await pc.esperar('!!document.querySelector("#nuvem-nome option[value=lucas]")', 15000, 'nomes');
    await pc.avaliar(`(() => { document.getElementById('nuvem-nome').value = 'lucas'; document.getElementById('nuvem-senha').value = '2468'; return 1; })()`);
    await pc.tocar('.entrar-cartao button[type=submit]');
    await pc.esperar('!!document.querySelector(".menu-pc") && Object.values(registros).some((r) => r.prancheta === "caldeira")', 20000, 'painel com as anotações');
    await teste(g, 'aparelhos ao vivo pela nuvem: um verde (Felipe na Hidrólise) e um cinza; número de ligados no alto', async () => {
      await pc.esperar(`${LINHA('Tablet da Hidrólise')} && ${LINHA('Tablet da Caldeira')}`, 15000, 'aparelhos agora');
      certo(await pc.avaliar(`!!${LINHA('Tablet da Hidrólise')}.querySelector(".conexao.ok")`), 'a Hidrólise devia estar ligada');
      certo(!(await pc.avaliar(`!!${LINHA('Tablet da Caldeira')}.querySelector(".conexao.ok")`)), 'a Caldeira devia estar desligada');
      certo(/Felipe/.test(await pc.avaliar('document.querySelector(".aparelhos-agora").innerText')), 'quem opera');
      igual(await pc.avaliar('document.querySelector("[data-num=ligados] b").textContent'), '2', 'o tablet e este computador');
      await pc.foto(path.join(FOTOS, 'painel-pc.png'));
    });
    await teste(g, 'últimas anotações do dia: quem, folha e hora, a mais nova primeiro', async () => {
      const linhas = await pc.avaliar('[...document.querySelectorAll(".ultimas-anotacoes li")].map((l) => l.innerText.replace(/\\s+/g, " "))');
      certo(linhas.length === 3, 'três anotações: ' + JSON.stringify(linhas));
      certo(/Felipe/.test(linhas[0]) && /Cal/i.test(linhas[0]), 'a mais nova (cal do Felipe) primeiro: ' + linhas[0]);
    });
    await teste(g, 'central sem mandar a lista há mais de 5 min: "sem sinal da central"', async () => {
      n.consultar(`UPDATE info SET valor = '${agora - 6 * 60000}' WHERE chave = 'aparelhosEm' RETURNING chave`);
      await pc.avaliar('(() => { sync.nuvemEm = 0; sync.temNovidade = true; sincronizar(); return 1; })()');
      await pc.esperar('document.querySelector(".aparelhos-agora") && document.querySelector(".aparelhos-agora").innerText.includes("sem sinal da central")', 15000, 'sem sinal');
      certo(!(await pc.avaliar(`!!${LINHA('Tablet da Hidrólise')}.querySelector(".conexao.ok")`)), 'ninguém da central fica verde sem sinal');
    });
    await teste(g, 'Escritório pela nuvem: Cálculos e Rastreamento abrem direto, sem pedir senha, e Enviar abre os formatos', async () => {
      await pc.tocar('[data-a="esc-abrir"][data-t="esc-calculos"]');
      await pc.esperar('document.body.innerText.includes("Hidrolisado e vinho")', 10000, 'cálculos');
      certo(!(await pc.avaliar('!!document.querySelector("[data-a=esc-entrar]")')), 'cálculos sem pedir senha');
      await pc.tocar('[data-a="voltar"]');
      await pc.tocar('[data-a="esc-abrir"][data-t="esc-rastreamento"]');
      await pc.esperar('document.body.innerText.includes("Insumos utilizados")', 10000, 'rastreamento');
      certo(!(await pc.avaliar('!!document.querySelector("[data-a=esc-entrar]")')), 'rastreamento sem pedir senha');
      await pc.foto(path.join(FOTOS, 'escritorio-pc.png'));
      await pc.tocar('[data-a="esc-arquivo"]');
      await pc.esperar('!!document.querySelector(".modal")', 8000, 'enviar');
      await pc.tocar('.modal [data-k="x"]').catch(() => {});
    });
    await teste(g, 'Ajustes do computador: em quadros, sem rolar, e cada quadro abre a sua parte', async () => {
      await pc.avaliar('ir({ tela: "admin" }); true');
      await pc.esperar('document.querySelectorAll(".quadro-menu").length === 3', 8000, 'os quadros');
      certo(await pc.avaliar('(() => { const m = document.querySelector("main.quadros-menu"); return m.scrollHeight <= m.clientHeight + 1; })()'), 'apareceu rolagem');
      await pc.foto(path.join(FOTOS, 'ajustes-pc.png'));
      await pc.tocar('[data-a="categoria"][data-cat="servidor"]');
      await pc.esperar('!!document.querySelector("[data-a=sair-nuvem]")', 5000, 'a parte do servidor');
      await pc.foto(path.join(FOTOS, 'ajustes-pc-servidor.png'));
    });
    certo(!pc.erros.length, pc.erros.join(' | '));
  } finally { await pc.fechar().catch(() => {}); await c.desligar(); await n.desligar(); }
}

/** Task 6: logo do U na interface (a folha impressa continua com a logo completa) e a abertura do programa do Windows. */
export async function testarLogoEAbertura217(nav, g) {
  fs.mkdirSync(FOTOS, { recursive: true });
  const c = await centralNode(8374, pastaTemporaria('pc217-logo'));
  const aparelhos = [];
  const UA_ELECTRON = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) PranchetasUbiralcool/2.17.0 Chrome/140.0 Electron/44.5.1 Safari/537.36';
  try {
    await teste(g, 'ícones gerados do U: 192 e 512 px; a logo da interface é o logo-u.svg', async () => {
      for (const t of [192, 512]) {
        const b = fs.readFileSync(path.join(APP, 'public', 'icons', `icon-${t}.png`));
        igual([b.readUInt32BE(16), b.readUInt32BE(20)], [t, t]);
      }
      certo(/<svg[^>]+viewBox="0 0 100 100"/.test(fs.readFileSync(path.join(APP, 'public', 'icons', 'logo-u.svg'), 'utf8')), 'svg');
    });
    const tab = await nav.novoAparelho('tablet', TAMANHOS.tablet); aparelhos.push(tab);
    await teste(g, 'tablet: topo com o U e sem abertura; a folha impressa continua com a logo completa', async () => {
      await tab.ir(c.url + '/?demo&papel=central', 'typeof render === "function"');
      await dormir(400);
      certo((await tab.avaliar('document.querySelector(".topo img.logo").getAttribute("src")')).endsWith('logo-u.svg'), 'topo');
      certo(await tab.avaliar('document.getElementById("abertura").hidden'), 'sem abertura no tablet');
      certo(fs.readFileSync(path.join(APP, 'public', 'chefe', 'exportar.js'), 'utf8').includes("'icons/logo.png'"), 'documento impresso com a logo da empresa');
    });
    const pc = await nav.novoAparelho('windows', TAMANHOS.pcGrande); aparelhos.push(pc);
    await nav.cdp('Emulation.setUserAgentOverride', { userAgent: UA_ELECTRON }, pc.sessionId);
    await teste(g, 'programa do Windows: a abertura aparece, o U se monta e some sozinha em até 1,8 s', async () => {
      await pc.ir(c.url + '/?nuvem=1', '!!document.getElementById("abertura") && !document.getElementById("abertura").hidden');
      for (const ms of [300, 800]) { await dormir(ms === 300 ? 150 : 500); await pc.foto(path.join(FOTOS, `abertura-${ms}ms.png`)); }
      certo((await pc.avaliar('getComputedStyle(document.querySelector("#abertura img")).animationName')).includes('aberturaLogo'), 'o U anima');
      await pc.esperar('document.getElementById("abertura").hidden', 1800, 'abertura sumiu');
      certo((await pc.avaliar('document.querySelector(".entrar-cartao img.entrar-logo").getAttribute("src")')).endsWith('logo-u.svg'), 'logo na tela de entrar');
      await pc.foto(path.join(FOTOS, 'abertura-depois.png'));
      await pc.recarregar();
      await dormir(300);
      certo(await pc.avaliar('document.getElementById("abertura").hidden'), 'recarregar (ex.: depois de uma queda) não repete a abertura');
    });
    const calmo = await nav.novoAparelho('windows calmo', TAMANHOS.computador); aparelhos.push(calmo);
    await nav.cdp('Emulation.setUserAgentOverride', { userAgent: UA_ELECTRON }, calmo.sessionId);
    await nav.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, calmo.sessionId);
    await teste(g, 'menos movimento no Windows: a abertura some rápido', async () => {
      await calmo.ir(c.url + '/?nuvem=1', '!!document.getElementById("abertura")');
      await calmo.esperar('document.getElementById("abertura").hidden', 800, 'some em até 0,8 s');
    });
    for (const a of aparelhos) certo(!a.erros.length, a.erros.join(' | '));
  } finally {
    for (const a of aparelhos) await a.fechar().catch(() => {});
    await c.desligar();
  }
}

/** 2.17.1: o teclado do computador nas janelas (senha com teclas na tela; Enter salva o texto). */
export async function testarTecladoDoPC217(nav, g) {
  const c = await centralNode(8377, pastaTemporaria('pc217-teclado'));
  const a = await nav.novoAparelho('teclado do pc', TAMANHOS.computador);
  // tecla de verdade (como no teclado), não clique
  const tecla = async (key) => {
    const vk = { Backspace: 8, Enter: 13, Delete: 46 }[key];
    await nav.cdp('Input.dispatchKeyEvent', vk ? { type: 'rawKeyDown', key, code: key, windowsVirtualKeyCode: vk } : { type: 'keyDown', key, text: key }, a.sessionId);
    await nav.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, ...(vk ? { windowsVirtualKeyCode: vk } : {}) }, a.sessionId);
    await dormir(60);
  };
  try {
    await a.ir(c.url + '/?demo&papel=central', 'typeof pedirSenhaModal === "function"');
    await teste(g, 'senha pelo teclado do computador: números, Backspace, Delete e Enter', async () => {
      await a.avaliar(`(() => { window.__senha = 'aberta'; pedirSenhaModal('Teste').then((s) => { window.__senha = s; }); return 1; })()`);
      await a.esperar('!!document.querySelector(".modal .teclas")', 3000, 'janela da senha');
      for (const k of ['9', '9', 'Delete', '1', '2', '3', '4', 'Backspace', '5']) await tecla(k);
      igual(await a.avaliar('document.querySelector(".modal .visor").textContent'), '••••');
      await tecla('Enter');
      await a.esperar('window.__senha !== "aberta"', 3000, 'Enter confirmou');
      igual(await a.avaliar('window.__senha'), '1235');
    });
    await teste(g, 'campo de texto da janela: Enter salva', async () => {
      await a.avaliar(`(() => { window.__txt = 'aberta'; textoLivre({ titulo: 'Operadores' }).then((s) => { window.__txt = s; }); return 1; })()`);
      await a.esperar('document.activeElement && document.activeElement.id === "txt"', 3000, 'campo com o cursor');
      await a.digitar('Ana e Bruno');
      await tecla('Enter');
      await a.esperar('window.__txt !== "aberta"', 3000, 'Enter salvou');
      igual(await a.avaliar('window.__txt'), 'Ana e Bruno');
    });
    certo(!a.erros.length, a.erros.join(' | '));
  } finally { await a.fechar().catch(() => {}); await c.desligar(); }
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
    if (!so || so === 'entrar') await testarEntrarPC217(nav, g);
    if (!so || so === 'painel') await testarPainelPC217(nav, g);
    if (!so || so === 'logo') await testarLogoEAbertura217(nav, g);
    if (!so || so === 'teclado') await testarTecladoDoPC217(nav, g);
  } finally { await nav.fechar(); }
  const r = resumo([g]);
  console.log(`
${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
  process.exitCode = r.falharam ? 1 : 0;
}
