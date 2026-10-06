/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Versão 2.11 no aplicativo, nas duas centrais:
 *   - a tela Aparelhos mostra quem está usando, o aparelho e, no +, o endereço na rede;
 *   - o administrador bloqueia o tablet da Hidrólise pela tela (pede senha e apaga): ele trava e apaga o que guarda;
 *   - a senha errada não libera; a certa libera (e a central fica sabendo);
 *   - "trava de vez": só o administrador desbloqueia, e o tablet volta sozinho.
 */
import http from 'node:http';
import { TAMANHOS, dormir } from './navegador.mjs';
import { teste, certo, igual, entrarComoChefe, SENHA_ENCARREGADO } from './teste.mjs';
import { pastaTemporaria } from './servidores.mjs';

/** Uma nuvem de mentira que só responde a rota do aparelho (GET /aparelho/<id>) com o que o teste mandar. */
function nuvemDeMentira() {
  const n = { resposta: { bloqueio: null, revisao: 0 }, pedidos: 0 };
  const srv = http.createServer((req, res) => {
    if (/^\/aparelho\//.test(req.url)) n.pedidos++;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(n.resposta));
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => { n.url = `http://127.0.0.1:${srv.address().port}`; n.fechar = () => srv.close(); ok(n); }));
}

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

    // revisão do Codex (06/10/2026): longe da usina, uma nuvem atrasada não pode destravar o que a central bloqueou.
    // Fica por último: o tablet perde a central de propósito.
    await teste(grupo, 'longe da usina: a nuvem atrasada ou de outra central não destrava; a lista mais nova destrava', async () => {
      const nuvem = await nuvemDeMentira();
      try {
        igual((await c.api('/api/pessoas', { acao: 'entrar', pin: SENHA_ENCARREGADO })).pessoa.nome, 'Guilherme');
        igual((await c.api('/api/aparelhos', { acao: 'bloquear', id: idHid, modo: 'trava' })).ok, true);
        await hid.esperar('document.body.innerText.includes("Fale com o escritório para liberar")', 20000, 'travado pela central');
        const rev = await hid.avaliar('JSON.parse(localStorage.getItem("usina.cfg")).bloqueio.rev');
        certo(rev > 0, 'o bloqueio veio com a revisão: ' + rev);
        // de qual central é o bloqueio (a geração): a nuvem diz de qual central é a lista
        const geracao = await hid.avaliar('JSON.parse(localStorage.getItem("usina.cfg")).blqGeracao');
        certo(geracao && geracao.length > 3, 'o tablet sabe de qual central é o bloqueio: ' + geracao);
        // a nuvem ainda não recebeu o bloqueio (lista mais velha); o tablet sai da usina (a central some)
        nuvem.resposta = { bloqueio: null, revisao: rev - 1, geracao };
        await hid.avaliar(`(() => { const c = JSON.parse(localStorage.getItem("usina.cfg")); c.central = "http://127.0.0.1:9/"; c.nuvemUrl = "${nuvem.url}"; localStorage.setItem("usina.cfg", JSON.stringify(c)); return true; })()`);
        await hid.ir(c.url + '/', 'document.body.innerText.includes("Aparelho bloqueado")');
        const t0 = Date.now();
        while (Date.now() - t0 < 15000 && !nuvem.pedidos) await dormir(300);
        certo(nuvem.pedidos > 0, 'o tablet perguntou na nuvem');
        await dormir(1500);
        certo(await hid.avaliar('document.body.innerText.includes("Aparelho bloqueado")'), 'resposta atrasada não destrava');
        // lista de outra central (outra geração), mesmo com revisão bem maior: não vale para este tablet
        nuvem.resposta = { bloqueio: null, revisao: rev + 50, geracao: 'outra-central' };
        let pedidosAntes = nuvem.pedidos;
        await hid.tocar('[data-a="conferir-bloqueio"]');
        const t2 = Date.now();
        while (Date.now() - t2 < 10000 && nuvem.pedidos === pedidosAntes) await dormir(300);
        await dormir(1200);
        certo(nuvem.pedidos > pedidosAntes && await hid.avaliar('document.body.innerText.includes("Aparelho bloqueado")'), 'lista de outra central não destrava');
        // agora a nuvem tem a lista mais nova, sem o bloqueio (o administrador desbloqueou)
        // (o administrador ainda bloqueou e desbloqueou outras vezes: a lista está 4 revisões na frente)
        nuvem.resposta = { bloqueio: null, revisao: rev + 4, geracao };
        await hid.tocar('[data-a="conferir-bloqueio"]');
        await hid.esperar('!document.body.innerText.includes("Aparelho bloqueado")', 15000, 'destravou com a lista mais nova');
        // uma resposta velha (com um bloqueio intermediário, já retirado) não trava de novo
        const em = await hid.avaliar('Date.now()');
        nuvem.resposta = { bloqueio: { em, rev: rev + 2, modo: 'trava', apagar: false }, revisao: rev + 2, geracao };
        let antes = nuvem.pedidos;
        await hid.ir(c.url + '/', '!!document.querySelector("main")');
        let t1 = Date.now();
        while (Date.now() - t1 < 15000 && nuvem.pedidos === antes) await dormir(300);
        await dormir(1500);
        certo(nuvem.pedidos > antes && !(await hid.avaliar('document.body.innerText.includes("Aparelho bloqueado")')), 'o bloqueio já retirado não volta');
        // um bloqueio mais novo, que só a nuvem conhece, trava
        nuvem.resposta = { bloqueio: { em, rev: rev + 5, modo: 'trava', apagar: false }, revisao: rev + 5, geracao };
        antes = nuvem.pedidos;
        await hid.ir(c.url + '/', '!!document.querySelector("main")');
        await hid.esperar('document.body.innerText.includes("Aparelho bloqueado")', 15000, 'o bloqueio novo da nuvem trava');
      } finally { nuvem.fechar(); }
    });
  } finally {
    await Promise.all(aparelhos.map((a) => a.fechar()));
    await c.desligar();
  }
}
