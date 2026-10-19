/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Pedidos do teste na área de 24/09/2026 (áudios):
 *   aviso curto do lado do número (a caixa não cresce) e só no primeiro pH; tablet chefe mudando o que o operador
 *   anotou pede a senha dele; relatórios um por dia (abrir, gerar, apagar o arquivo); WhatsApp organizado por setor
 *   com os totais dos insumos; a atualização a cada 5 s não mexe onde a pessoa está; folha inteira no celular;
 *   apagar os dados do aparelho; trocar o código desconecta os outros aparelhos.
 */
import fs from 'node:fs';
import path from 'node:path';
import { TAMANHOS, dormir } from './navegador.mjs';
import { teste, certo, igual, entrarComoChefe, senhaSeAparecer } from './teste.mjs';

export async function testarPedidos24(nav, ligar, porta, grupo) {
  const c = await ligar(porta);
  const api = (rota) => c.api(rota);
  const regs = async () => (await api('/api/registros?desde=0')).registros.filter((r) => !r.apagado);
  const esperarCentral = async (filtro, descricao, ms = 25000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const r = filtro(await regs()); if (r) return r; await dormir(700); }
    throw new Error(`não aconteceu na central em ${ms / 1000}s: ${descricao}`);
  };
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
  const hoje = () => { const d = new Date(); if (d.getHours() < 7) d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const dorna = (l, n) => l.find((r) => r.id === `${hoje()}|hid_anexo1|${n}`);
  // a notificação fica no alto, por cima dos botões da barra: um toque fecha (como a pessoa faria)
  const semNotificacao = async (a) => { await a.avaliar('(() => { const t = document.getElementById("toast"); if (!t.hidden) t.click(); })()'); await dormir(350); };

  try {
    const tab = await novo('tablet Hidrólise', TAMANHOS.tablet);
    const esc = await novo('escritório', TAMANHOS.computador);
    await teste(grupo, 'aviso curto só no primeiro pH; a caixa com aviso fica do mesmo tamanho das outras', async () => {
      await conectar(esc, 'central');
      await conectar(tab, 'hidrolise', 'Guilherme');
      await tab.tocar('[data-a="abrir-prancheta"][data-id="hid_anexo1"]');
      await tab.tocar('[data-quadro="phf"]'); await tab.teclar(['4', ',', '6']);
      await tab.tocar('[data-quadro="phf2"]'); await tab.teclar(['4', ',', '8']);
      await tab.tocar('[data-quadro="brix"]'); await tab.teclar(['1', '8']);
      await tab.tocar('[data-ed="ocultar"]');
      const info = await tab.avaliar(`(() => { const q = (id) => document.querySelector('[data-quadro="' + id + '"]'); return { tag1: (q('phf').querySelector('.tag-aviso') || {}).textContent || '', tag2: !!q('phf2').querySelector('.tag-aviso'), h1: q('phf').offsetHeight, h2: q('phf2').offsetHeight, hb: q('brix').offsetHeight }; })()`);
      igual(info.tag1, 'pH baixo', 'aviso do primeiro pH');
      certo(!info.tag2, 'o segundo pH (depois da cal) também avisou');
      certo(Math.abs(info.h1 - info.h2) <= 1, `a caixa com aviso ficou de outro tamanho: ${info.h1} e ${info.h2}`);
      await tab.tocar('[data-a="salvar"]');
      await esperarCentral((l) => dorna(l, 1) && dorna(l, 1).valores.brix === '18', 'dorna 1 na central');
      // o tablet chefe recebe a dorna (sincroniza a cada 5 s)
      await esc.esperar(`(JSON.parse(localStorage.getItem('usina.registros') || '{}')['${hoje()}|hid_anexo1|1'] || { valores: {} }).valores.brix === '18'`, 20000, 'o tablet chefe receber a dorna');
    });

    await teste(grupo, 'tablet chefe mudando o que o operador anotou: pede a senha dele; senha errada não salva', async () => {
      // o encarregado cadastra a senha de Guilherme
      await esc.tocar('[data-a="config"]'); await senhaSeAparecer(esc);
      await esc.tocar('[data-a="op-senha"][data-setor="hidrolise"][data-i="0"]'); await esc.teclar(['4', '3', '2', '1', 'ok']);
      await esc.tocar('[data-a="voltar"]');
      await esc.tocar('[data-a="abrir-setor"][data-id="hidrolise"]');
      await esc.tocar('[data-a="linha"][data-chave="1"]');
      await esc.tocar('[data-quadro="brix"]'); await esc.teclar(['2', '0']); await esc.tocar('[data-ed="ocultar"]');
      await esc.tocar('[data-a="salvar"]');
      await esc.esperar('document.body.innerText.includes("Senha de Guilherme")', 5000, 'pedir a senha de Guilherme');
      await esc.teclar(['1', '1', '1', '1', 'ok']);
      await dormir(1500);
      certo(dorna(await regs(), 1).valores.brix === '18', 'salvou com a senha errada');
      await esc.tocar('[data-a="salvar"]');
      await esc.teclar(['4', '3', '2', '1', 'ok']);
      const r = await esperarCentral((l) => dorna(l, 1) && dorna(l, 1).valores.brix === '20' && dorna(l, 1), 'alteração salva com a senha certa');
      certo(r.alteradoPeloEscritorio && (r.alteradoPeloEscritorio.autorizadoPor || []).includes('Guilherme'), 'não ficou marcado quem autorizou');
      igual(r.operador, 'Guilherme', 'responsável');
    });

    await teste(grupo, 'tablet chefe saindo da dorna sem salvar: a alteração do operador não é gravada sozinha', async () => {
      await esc.tocar('[data-quadro="brix"]'); await esc.teclar(['3', '0']); await esc.tocar('[data-ed="ocultar"]');
      await esc.tocar('.seletor button.nova, .seletor-nova button');
      await esc.esperar('document.body.innerText.includes("A alteração não foi salva")', 5000, 'avisar que não salvou');
      await dormir(1200);
      igual(dorna(await regs(), 1).valores.brix, '20', 'Brix da dorna 1');
    });

    await teste(grupo, 'relatórios: um por dia; gerar guarda o Excel; apagar o arquivo mantém o dia', async () => {
      await semNotificacao(esc);
      await esc.tocar('[data-a="painel"]');
      await semNotificacao(esc);
      await esc.tocar('[data-a="relatorios"]');
      await esc.esperar('document.querySelector(".relatorio-dia")', 10000, 'relatório do dia');
      // das 07:05 às 07:59 o tablet chefe guarda sozinho a folha de ontem, e ontem aparece na lista também
      const deHoje = '[...document.querySelectorAll(".relatorio-dia")].filter((e) => e.innerText.includes("(hoje)")).length';
      igual(await esc.avaliar(deHoje), 1, 'relatórios de hoje');
      await esc.tocar('[data-a="gerar-hoje"]');
      await esc.esperar('document.body.innerText.includes("Excel guardado em RelatoriosUsina")', 15000, 'Excel guardado');
      certo(fs.readdirSync(path.join(c.pastaRelatorios, hoje())).some((n) => n.endsWith('.xlsx')), 'sem o Excel na pasta');
      await esc.tocar(`[data-a="relatorio-apagar"][data-data="${hoje()}"]`); await esc.tocar('[data-k="sim"]');
      await esc.esperar('document.body.innerText.includes("ainda sem Excel guardado")', 10000, 'arquivo apagado');
      certo(!fs.existsSync(path.join(c.pastaRelatorios, hoje())) || !fs.readdirSync(path.join(c.pastaRelatorios, hoje())).length, 'o arquivo continua na pasta');
      igual(await esc.avaliar(deHoje), 1, 'o dia continua na lista');
    });

    await teste(grupo, 'WhatsApp: resumo organizado por setor, com os totais dos insumos, só dos setores escolhidos', async () => {
      await esc.tocar('[data-a="voltar"]');
      await esc.avaliar('window.__abriu = []; window.open = (u) => { window.__abriu.push(u); return null; }');
      await esc.tocar('[data-a="compartilhar"][data-destino="whatsapp"]');
      for (const s of ['caldeira', 'ralo', 'destilaria', 'nova_destilaria']) await esc.tocar(`[data-k="s:${s}"]`);
      await esc.tocar('[data-k="f:texto"]');
      await esc.esperar('window.__abriu.length', 5000, 'abrir o WhatsApp');
      const texto = await esc.avaliar('decodeURIComponent(window.__abriu[0].split("text=")[1] || "")');
      certo(texto.includes('*HIDRÓLISE*') && texto.includes('*TOTAIS DO DIA (insumos)*') && /LPHERA: /.test(texto), 'faltou parte do resumo: ' + texto.slice(0, 200));
      certo(!texto.includes('*CALDEIRA*'), 'mandou um setor que foi tirado');
      return texto.split('\n').length + ' linhas';
    });

    const chefeCel = await novo('tablet chefe no celular', TAMANHOS.motorola);
    await teste(grupo, 'celular do tablet chefe: a atualização a cada 5 s não mexe na rolagem das abas nem pisca a tela', async () => {
      await conectar(chefeCel, 'central');
      await chefeCel.tocar('[data-a="abrir-setor"][data-id="hidrolise"]');
      await chefeCel.esperar('document.querySelector(".abas").scrollWidth > document.querySelector(".abas").clientWidth', 5000, 'abas maiores que a tela');
      await chefeCel.avaliar('document.querySelector(".abas").scrollLeft = 160');
      // 2.13: cada tela redesenhada por trás não pode entrar com a animação da troca de tela (piscava a cada 5 s)
      await chefeCel.avaliar(`(() => { window.__animacoes = []; new MutationObserver(() => { const m = document.querySelector('#app main');
        if (m && !m.__visto) { m.__visto = 1; window.__animacoes.push(getComputedStyle(m).animationName); } }).observe(document.getElementById('app'), { childList: true }); return 1; })()`);
      await dormir(1800);
      // chega anotação nova de outro aparelho: o celular redesenha a tela por trás
      await tab.tocar('[data-a="linha"][data-chave="1"]');
      await tab.tocar('[data-quadro="bhx"]'); await tab.teclar(['1', '7']); await tab.tocar('[data-ed="ocultar"]');
      await tab.tocar('[data-a="salvar"]');
      await chefeCel.esperar(`JSON.parse(localStorage.getItem('usina.registros') || '{}')['${hoje()}|hid_anexo1|1'].valores.bhx === '17'`, 20000, 'receber a anotação nova');
      await dormir(1200);
      const rolagem = await chefeCel.avaliar('document.querySelector(".abas").scrollLeft');
      certo(rolagem >= 150, 'as abas voltaram para o começo: ' + rolagem);
      const animacoes = await chefeCel.avaliar('window.__animacoes');
      certo(animacoes.length > 0, 'a tela não foi redesenhada');
      certo(animacoes.every((x) => x === 'none'), 'a tela piscou ao redesenhar: ' + animacoes.join(', '));
    });

    await teste(grupo, 'monitoramento no celular: a folha aparece inteira (sem corte) e a área rola com o dedo', async () => {
      await chefeCel.tocar('[data-a="monitor"]');
      await chefeCel.esperar('document.querySelector(".folha .tabela-wrap")', 5000);
      await dormir(500);
      const f = await chefeCel.avaliar('(() => { const f = document.querySelector(".folha"); const m = document.querySelector(".edicao main"); return { corte: f.scrollHeight - f.clientHeight, podeRolar: getComputedStyle(m).overflowY }; })()');
      certo(f.corte <= 1, `a folha ficou cortada em ${f.corte} px`);
      igual(f.podeRolar, 'auto', 'rolagem da área');
    });

    await teste(grupo, 'apagar os dados deste aparelho: volta para escolher onde ele vai ficar', async () => {
      await chefeCel.tocar('[data-a="admin"]'); await senhaSeAparecer(chefeCel);
      await chefeCel.tocar('[data-a="limpar-tudo"]'); await chefeCel.tocar('[data-k="sim"]');
      await chefeCel.esperar('document.body.innerText.includes("Onde este aparelho vai ficar?")', 8000, 'escolher a função de novo');
      igual(await chefeCel.avaliar('Object.keys(JSON.parse(localStorage.getItem("usina.registros") || "{}")).filter((id) => !id.startsWith("config")).length'), 0, 'anotações que sobraram');
    });

    await teste(grupo, 'trocar o código desconecta os outros aparelhos; quem trocou continua conectado', async () => {
      // 2.15: no nível 2 o Trocar código não aparece (sem a função Conexão); o dono passa este tablet para o nível 3
      await semNotificacao(esc);
      certo(!(await esc.existe('[data-a="novo-codigo"]')), 'o nível 2 vê o Trocar código');
      const id = await esc.avaliar('JSON.parse(localStorage.getItem("usina.cfg")).deviceId');
      await esc.tocar('.ir-para [data-a="pessoas"]');
      await esc.tocar(`[data-a="aparelho-chefe"][data-id="${id}"]`, null, { esperarMs: 15000 });
      await esc.tocar('[data-k="nv:3"]'); await esc.tocar('.modal [data-k="ok"]');
      await esc.esperar('!JSON.parse(localStorage.getItem("usina.cfg")).pessoa', 10000, 'sair ao mudar o nível');
      await semNotificacao(esc);
      await esc.tocar('[data-a="voltar"]');
      await entrarComoChefe(esc);
      await semNotificacao(esc);
      await esc.tocar('[data-a="novo-codigo"]'); await esc.tocar('[data-k="sim"]');
      await tab.esperar('document.querySelector("[data-quadro=\\"codigo\\"]")', 20000, 'o tablet pedir o código novo');
      await dormir(6000);
      certo(!(await esc.existe('[data-quadro="codigo"]')), 'o escritório (quem trocou) foi desconectado');
      certo(await esc.avaliar('document.body.innerText.includes("Painel do escritório")'), 'o escritório saiu do painel');
    });

    await teste(grupo, 'nenhum erro de JavaScript', async () => {
      const erros = aparelhos.flatMap((a) => a.erros.map((e) => `${a.nome}: ${e}`));
      certo(!erros.length, erros.join(' | ').slice(0, 500));
    });
  } finally {
    for (const a of aparelhos) await a.fechar().catch(() => {});
    await c.desligar();
  }
}
