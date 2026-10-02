/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Versão 2.11 no aplicativo, nas duas centrais:
 *   - a tela Aparelhos mostra quem está usando, o aparelho e, no +, o endereço na rede;
 *   - o administrador bloqueia o tablet da Hidrólise pela tela (pede senha e apaga): ele trava e apaga o que guarda;
 *   - a senha errada não libera; a certa libera (e a central fica sabendo);
 *   - "trava de vez": só o administrador desbloqueia, e o tablet volta sozinho.
 */
import { TAMANHOS, dormir } from './navegador.mjs';
import { teste, certo, igual, entrarComoChefe } from './teste.mjs';
import { pastaTemporaria } from './servidores.mjs';

const diaProducao = () => { const d = new Date(Date.now() - 7 * 3600000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export async function testarPedidos211(nav, ligar, porta, grupo) {
  const c = await ligar(porta, pastaTemporaria('v211'));
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
  const registro = async () => (await c.api('/api/registro?dia=' + diaProducao())).registros.map((r) => r.valores.texto);
  const guardadas = (a) => a.avaliar('Object.keys(JSON.parse(localStorage.getItem("usina.registros") || "{}")).length');
  try {
    const chefe = await novo('tablet chefe', TAMANHOS.tablet);
    const hid = await novo('tablet da Hidrólise', TAMANHOS.tablet);
    await conectar(chefe, 'central');
    await conectar(hid, 'hidrolise', 'Felipe');
    const idHid = await hid.avaliar('JSON.parse(localStorage.getItem("usina.cfg")).deviceId');

    await teste(grupo, 'o setor anota uma dorna (fica guardada no tablet)', async () => {
      await semNotificacao(hid);
      await hid.tocar('[data-a="abrir-prancheta"][data-id="hid_anexo1"]');
      await hid.tocar('[data-quadro="brix"]'); await hid.teclar(['1', '8']);
      await hid.tocar('[data-ed="ocultar"]');
      await hid.tocar('[data-a="salvar"]');
      await hid.esperar('Object.values(JSON.parse(localStorage.getItem("usina.registros") || "{}")).some((r) => r.prancheta === "hid_anexo1")', 8000, 'dorna guardada');
    });

    await teste(grupo, 'Aparelhos: quem está usando, o aparelho e, no +, o endereço na rede', async () => {
      await semNotificacao(chefe);
      await chefe.tocar('.numeros [data-a="aparelhos"]');
      await chefe.esperar(`!!document.querySelector('main.tela-aparelhos [data-a="aparelho-info"][data-id="${idHid}"]')`, 15000, 'o tablet da Hidrólise na lista');
      const linha = await chefe.avaliar(`document.querySelector('[data-a="aparelho-info"][data-id="${idHid}"]').closest('.aparelho-linha').innerText`);
      certo(/Felipe/.test(linha) && /Tablet da Hidrólise/.test(linha) && /Ligado/.test(linha), linha);
      await chefe.tocar(`[data-a="aparelho-info"][data-id="${idHid}"]`);
      const ficha = await chefe.avaliar('document.querySelector(".modal .ficha").innerText');
      certo(/127\.0\.0\.1/.test(ficha) && /Android|Chrome/.test(ficha) && ficha.includes(idHid), ficha);
    });

    await teste(grupo, 'o administrador bloqueia pela tela (pede senha e apaga): o tablet trava e apaga o que guardava', async () => {
      await chefe.tocar('.modal [data-k="bloquear"]');
      await chefe.esperar('!!document.querySelector(".modal #b-senha")', 5000, 'janela de bloquear');
      await chefe.avaliar('(() => { document.getElementById("b-senha").value = "2580"; return true; })()');
      await chefe.tocar('.modal [data-k="apagar"]');
      await chefe.tocar('.modal [data-k="ok"]');
      await chefe.esperar(`(() => { const b = document.querySelector('[data-a="aparelho-info"][data-id="${idHid}"]'); return !!b && b.closest('.aparelho-linha').classList.contains('bloqueado'); })()`, 8000, 'bloqueado na lista');
      await hid.esperar('document.body.innerText.includes("Aparelho bloqueado")', 20000, 'tela de bloqueado');
      igual(await guardadas(hid), 0, 'o tablet apagou o que guardava');
      certo((await registro()).some((t) => /bloqueou o Tablet da Hidrólise \(pede a senha de desbloqueio, apagando/.test(t)), 'no registro');
    });

    await teste(grupo, 'a senha errada não libera; a certa libera e a central fica sabendo', async () => {
      await hid.tocar('[data-a="liberar-senha"]');
      await hid.teclar(['1', '1', '1', '1', 'ok']);
      await hid.esperar('document.getElementById("toast").textContent.includes("Senha errada")', 15000, 'senha errada');
      certo(await hid.avaliar('document.body.innerText.includes("Aparelho bloqueado")'), 'continua bloqueado');
      await semNotificacao(hid);
      await hid.tocar('[data-a="liberar-senha"]');
      await hid.teclar(['2', '5', '8', '0', 'ok']);
      await hid.esperar('!document.body.innerText.includes("Aparelho bloqueado")', 20000, 'liberado');
      const t0 = Date.now();
      let l = [];
      while (Date.now() - t0 < 20000) { l = await registro(); if (l.some((t) => /foi liberado com a senha de desbloqueio/.test(t))) break; await dormir(700); }
      certo(l.some((t) => /Tablet da Hidrólise foi liberado com a senha de desbloqueio/.test(t)), 'no registro: ' + l.join(' / '));
    });

    await teste(grupo, 'trava de vez: o tablet trava; o administrador desbloqueia pela tela e ele volta sozinho', async () => {
      await semNotificacao(chefe);
      // a lista do chefe atualiza na próxima sincronização: espera sair o "Bloqueado" da liberação anterior
      await chefe.esperar(`(() => { const b = document.querySelector('[data-a="aparelho-info"][data-id="${idHid}"]'); return !!b && !b.closest('.aparelho-linha').classList.contains('bloqueado'); })()`, 15000, 'liberado na lista');
      await chefe.tocar(`[data-a="aparelho-info"][data-id="${idHid}"]`);
      await chefe.tocar('.modal [data-k="bloquear"]');
      await chefe.tocar('.modal [data-k="m:trava"]');
      await chefe.tocar('.modal [data-k="ok"]');
      await hid.esperar('document.body.innerText.includes("Fale com o escritório para liberar")', 20000, 'travado de vez');
      certo(!(await hid.avaliar('!!document.querySelector("[data-a=\\"liberar-senha\\"]")')), 'sem botão de senha');
      await semNotificacao(chefe);
      await chefe.tocar(`[data-a="aparelho-info"][data-id="${idHid}"]`);
      await chefe.tocar('.modal [data-k="desbloquear"]');
      await chefe.tocar('.modal [data-k="sim"]');
      await hid.esperar('!document.body.innerText.includes("Aparelho bloqueado")', 20000, 'o tablet voltou sozinho');
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
