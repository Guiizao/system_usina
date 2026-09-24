/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Teste de ponta a ponta com aparelhos virtuais, usando o aplicativo como uma pessoa usaria (tocando nos botões):
 *   escritório (computador)  +  tablet da Hidrólise  +  celular da Caldeira, todos ligados na mesma central.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { TAMANHOS, dormir } from './navegador.mjs';
import { teste, certo, igual, teclasDaSenha } from './teste.mjs';

export async function testarAparelhos(nav, central, grupo) {
  const U = central.url + '/';
  const api = (rota) => central.api(rota);
  const naCentral = async (filtro, ms = 25000, descricao = 'anotação na central') => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const r = await api('/api/registros?desde=0');
      const achou = r.registros.find(filtro);
      if (achou) return achou;
      await dormir(700);
    }
    throw new Error(`não chegou na central em ${ms / 1000}s: ${descricao}`);
  };

  const esc = await nav.novoAparelho('escritório', TAMANHOS.computador);
  const tab = await nav.novoAparelho('tablet Hidrólise', TAMANHOS.tablet);
  const cel = await nav.novoAparelho('celular Caldeira', TAMANHOS.celular);
  await tab.relogioFalso(); await cel.relogioFalso();
  const aparelhos = [esc, tab, cel];
  const temAviso = (a) => a.existe('.modal.aviso-grande');

  async function conectar(a, papel, operador) {
    await a.ir(U, 'document.querySelector("[data-quadro=\\"codigo\\"]")');
    await a.tocar('[data-quadro="codigo"]');
    await a.teclar(central.codigo().split(''));
    await a.tocar('[data-ed="ocultar"]');
    await a.tocar('[data-a="conectar"]');
    await a.tocar(`[data-a="papel"][data-id="${papel}"]`, null, { esperarMs: 15000 });
    if (operador) await a.tocar(`[data-a="escolher-operador"][data-nome="${operador}"]`);
  }
  async function trocarOperador(a, nome) {
    await a.tocar('[data-a="trocar-operador"]');
    await a.tocar(`[data-a="escolher-operador"][data-nome="${nome}"]`);
  }
  async function mandarAviso(setor, nome, texto) {
    if (!(await esc.existe('#aviso-texto'))) await esc.tocar('[data-a="avisos"]');
    await esc.tocar(`[data-a="aviso-setor"][data-id="${setor}"]`);
    await esc.tocar(`[data-a="aviso-pessoa"][data-nome="${nome}"]`);
    await esc.tocar('#aviso-texto');
    await esc.avaliar('document.getElementById("aviso-texto").select()');
    await esc.digitar(texto);
    await esc.tocar('[data-a="aviso-enviar"]');
  }

  try {
    await teste(grupo, 'escritório conecta com o código e abre o painel', async () => {
      await conectar(esc, 'central');
      await esc.esperar('document.body.innerText.includes("Painel do escritório")');
    });
    await teste(grupo, 'tablet da Hidrólise conecta e o operador entra', async () => {
      await conectar(tab, 'hidrolise', 'Guilherme');
      await tab.esperar('document.body.innerText.includes("Qual prancheta")');
    });
    await teste(grupo, 'celular da Caldeira conecta e o operador entra', async () => {
      await conectar(cel, 'caldeira', 'Alberto');
      await cel.esperar('document.body.innerText.includes("Qual prancheta")');
    });
    await teste(grupo, 'o escritório vê os dois aparelhos ligados, com o nome de quem está', async () => {
      await esc.esperar('document.body.innerText.includes("Ligado, Guilherme") && document.body.innerText.includes("Ligado, Alberto")', 25000);
    });
    await teste(grupo, 'dorna com pH 4,6: o aviso da cal aparece, salva enchendo e chega na central', async () => {
      await tab.tocar('[data-a="abrir-prancheta"][data-id="hid_anexo1"]');
      await tab.tocar('[data-quadro="phf"]');
      await tab.teclar(['4', ',', '6']);
      // aviso curto do lado do número (e no alto do teclado); a caixa do PHF fica do mesmo tamanho da do pHf
      await tab.esperar('document.querySelector("[data-quadro=\\"phf\\"] .tag-aviso") && document.querySelector("[data-quadro=\\"phf\\"] .tag-aviso").textContent === "pH baixo" && document.querySelector(".painel-cab b.fora")', 5000, 'aviso da cal');
      const alturas = await tab.avaliar('[document.querySelector("[data-quadro=\\"phf\\"]").offsetHeight, document.querySelector("[data-quadro=\\"phf2\\"]").offsetHeight]');
      certo(Math.abs(alturas[0] - alturas[1]) <= 1, 'a caixa com o aviso ficou de outro tamanho: ' + alturas.join(' e '));
      await tab.tocar('[data-quadro="brix"]');
      await tab.teclar(['1', '8']);
      await tab.tocar('[data-ed="ocultar"]');
      await tab.tocar('[data-a="salvar"]');
      const r = await naCentral((x) => x.prancheta === 'hid_anexo1' && x.valores.phf === '4.6');
      igual(r.valores.brix, '18', 'Brix'); igual(r.operador, 'Guilherme', 'operador'); igual(r.chave, '1', 'dorna');
      certo(!r.valores.inicio, 'início marcado antes de enviar');
      await tab.esperar('document.body.innerText.includes("Enchendo")', 5000, 'status enchendo');
      await naCentral((x) => x.prancheta === 'hid_anexo2' && x.chave === '1', 15000, 'Sacarificação da dorna 1 criada sozinha');
    });
    await teste(grupo, 'Enviar: marca o início e a Sacarificação recebe o mesmo horário', async () => {
      await tab.tocar('[data-a="enviar-dorna"]');
      const r = await naCentral((x) => x.prancheta === 'hid_anexo1' && x.chave === '1' && /^\d\d:\d\d$/.test(x.valores.inicio || ''), 15000, 'início marcado');
      await naCentral((x) => x.prancheta === 'hid_anexo2' && x.chave === '1' && x.valores.horario === r.valores.inicio, 15000, 'horário na Sacarificação');
      await tab.esperar('document.body.innerText.includes("Enviando para cima")', 5000, 'status enviando');
    });
    await teste(grupo, 'celular anota a pressão da caldeira', async () => {
      await cel.tocar('[data-a="abrir-prancheta"][data-id="caldeira"]');
      await cel.tocar('[data-quadro="pressao"]');
      await cel.teclar(['6']);
      await cel.tocar('[data-ed="ocultar"]');
      await cel.tocar('[data-a="salvar"]');
      const r = await naCentral((x) => x.prancheta === 'caldeira' && x.valores.pressao === '6');
      igual(r.operador, 'Alberto', 'operador');
    });
    await teste(grupo, 'o escritório vê a dorna sendo enviada na mesma hora', async () => {
      await esc.esperar('document.body.innerText.includes("Nº 1 enviando desde")', 20000);
    });
    await teste(grupo, 'aviso para quem está trabalhando aparece grande na tela, com o texto sem virar código', async () => {
      await mandarAviso('hidrolise', 'Guilherme', 'Passe no escritório <b>agora</b> <img src=x onerror=alert(1)>');
      await tab.esperar('document.querySelector(".modal.aviso-grande")', 25000, 'aviso na tela do tablet');
      const t = await tab.avaliar('document.querySelector(".aviso-texto").textContent');
      igual(t, 'Passe no escritório <b>agora</b> <img src=x onerror=alert(1)>', 'texto');
      certo(!(await tab.avaliar('!!document.querySelector(".aviso-texto b, .aviso-texto img")')), 'o texto virou código na tela');
    });
    await teste(grupo, 'o escritório vê que o aviso está na tela de Guilherme', async () => {
      await esc.esperar('document.body.innerText.includes("Na tela de Guilherme")', 20000);
    });
    await teste(grupo, 'o aviso não sai com toque fora nem com o Voltar, só no OK', async () => {
      await tab.tocarEm(8, 8);
      certo(await temAviso(tab), 'fechou com toque fora');
      await tab.avaliar('history.back()'); await dormir(500);
      certo(await temAviso(tab), 'fechou com o Voltar');
      await tab.tocar('.aviso-ok');
      await tab.esperar('!document.querySelector(".modal.aviso-grande")', 3000, 'fechar no OK');
    });
    await teste(grupo, 'o escritório vê "Lido por Guilherme"', async () => {
      await esc.esperar('document.body.innerText.includes("Lido por Guilherme")', 25000);
    });
    await teste(grupo, 'aviso para quem não está trabalhando fica guardado', async () => {
      await mandarAviso('caldeira', 'Diego', 'Aviso de teste guardado para o Diego');
      await esc.esperar('document.body.innerText.includes("Esperando Diego entrar")', 5000);
      await dormir(12000);
      certo(!(await temAviso(cel)), 'apareceu para o Alberto');
    });
    await teste(grupo, 'quando a pessoa entra no turno, o aviso guardado aparece', async () => {
      await trocarOperador(cel, 'Diego');
      await cel.esperar('document.querySelector(".modal.aviso-grande")', 10000, 'aviso para o Diego');
      certo((await cel.avaliar('document.querySelector(".aviso-texto").textContent')).includes('guardado para o Diego'), 'texto errado');
      await cel.tocar('.aviso-ok');
      await esc.esperar('document.body.innerText.includes("Lido por Diego")', 25000);
    });
    await teste(grupo, 'aviso cancelado pelo escritório não aparece', async () => {
      await mandarAviso('hidrolise', 'Felipe', 'Este aviso vai ser cancelado');
      await esc.tocar('[data-a="aviso-cancelar"]');
      await esc.tocar('[data-k="sim"]');
      await esc.esperar('document.body.innerText.includes("Cancelado pelo escritório")', 5000);
      await dormir(9000);
      await trocarOperador(tab, 'Felipe');
      await dormir(4000);
      certo(!(await temAviso(tab)), 'o aviso cancelado apareceu');
    });
    await teste(grupo, 'aviso para "quem estiver no setor" aparece para quem está lá', async () => {
      await mandarAviso('caldeira', '', 'Aviso de teste para quem estiver na Caldeira');
      await cel.esperar('document.querySelector(".modal.aviso-grande")', 25000, 'aviso no celular');
      await cel.tocar('.aviso-ok');
      await esc.esperar('document.body.innerText.includes("Lido por Diego")', 25000);
    });
    await teste(grupo, 'sem Wi-Fi: o tablet guarda a anotação e manda quando a rede volta', async () => {
      await tab.semRede(true);
      await tab.tocar('[data-a="abrir-prancheta"][data-id="hid_anexo1"]').catch(() => {});
      await tab.tocar('.seletor button.nova'); // dorna nova (o Salvar agora continua na mesma dorna)
      await tab.tocar('[data-quadro="phf"]');
      await tab.teclar(['5', ',', '1']);
      await tab.tocar('[data-ed="ocultar"]');
      await tab.tocar('[data-a="salvar"]');
      await tab.esperar('/guardando no aparelho|Sem Wi-Fi/.test(document.body.innerText)', 20000, 'mostrar que está sem rede');
      const antes = (await api('/api/registros?desde=0')).registros.some((x) => x.prancheta === 'hid_anexo1' && x.valores.phf === '5.1');
      certo(!antes, 'chegou na central mesmo sem rede');
      await tab.semRede(false);
      await naCentral((x) => x.prancheta === 'hid_anexo1' && x.valores.phf === '5.1', 30000, 'anotação feita sem rede');
    });
    await teste(grupo, 'senha do operador: o escritório cadastra e o tablet passa a pedir', async () => {
      await esc.tocar('[data-a="voltar"]');
      await esc.tocar('[data-a="config"]');
      await esc.teclar(teclasDaSenha());
      await esc.tocar('[data-a="op-senha"][data-setor="hidrolise"][data-i="2"]');
      await esc.teclar(['4', '3', '2', '1', 'ok']);
      await esc.esperar('document.body.innerText.includes("Senha de Carlindo trocada")', 5000);
      await dormir(10000); // o tablet recebe a configuração
      await trocarOperador(tab, 'Carlindo');
      await tab.esperar('document.body.innerText.includes("Senha de Carlindo")', 5000, 'pedir a senha');
      await tab.teclar(['1', '1', '1', '1', 'ok']);
      await tab.tocar('[data-k="nao"]');
      certo(!(await tab.avaliar('document.body.innerText.includes("Operador: Carlindo")')), 'entrou com senha errada');
      await tab.tocar(`[data-a="escolher-operador"][data-nome="Carlindo"]`);
      await tab.teclar(['4', '3', '2', '1', 'ok']);
      await tab.esperar('document.body.innerText.includes("Bom trabalho, Carlindo")', 5000, 'entrar com a senha certa');
    });
    await teste(grupo, 'senha errada do encarregado não abre os ajustes', async () => {
      await tab.tocar('[data-a="admin"]');
      await tab.teclar(['9', '9', '9', '9', 'ok']);
      await tab.esperar('document.body.innerText.includes("Senha errada")', 3000);
      certo(!(await tab.avaliar('document.body.innerText.includes("Ajustes do aparelho")')), 'abriu os ajustes');
    });
    await teste(grupo, 'relatório do dia: Excel e XML guardados na central, com o que foi anotado', async () => {
      await esc.tocar('[data-a="voltar"]');
      await esc.tocar('[data-a="relatorios"]');
      await esc.tocar('[data-a="gerar-hoje"]');
      await esc.esperar('document.body.innerText.includes("Excel e XML de hoje guardados")', 15000);
      const dias = fs.readdirSync(central.pastaRelatorios);
      const dia = dias.sort().pop();
      const arquivos = fs.readdirSync(path.join(central.pastaRelatorios, dia));
      const xlsx = arquivos.find((n) => n.endsWith('.xlsx')); const xml = arquivos.find((n) => n.endsWith('.xml'));
      certo(xlsx && xml, 'faltou arquivo: ' + arquivos.join(', '));
      const saida = execFileSync('python', ['-X', 'utf8', path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'conferir-arquivos.py'), path.join(central.pastaRelatorios, dia, xlsx), path.join(central.pastaRelatorios, dia, xml)], { encoding: 'utf8' });
      const r = JSON.parse(saida);
      certo(r.ok, r.erro || 'arquivo com problema');
      certo(r.folhas >= 5, 'poucas folhas no Excel: ' + r.folhas);
      certo(r.temValor46, 'o pH 4,6 não está no Excel');
      certo(r.xmlTem46, 'o pH 4,6 não está no XML');
      return `${r.folhas} folhas no Excel, XML com ${r.xmlItens} itens`;
    });
    // guarda toda notificação que aparecer no tablet, para conferir depois
    await tab.avaliar(`(() => { window.__notificacoes = []; const t = document.getElementById('toast'); new MutationObserver(() => { if (!t.hidden) window.__notificacoes.push(t.textContent); }).observe(t, { childList: true, subtree: true, attributes: true }); return true; })()`);
    const notificou = (texto) => `window.__notificacoes.some((t) => t.includes(${JSON.stringify(texto)}))`;
    await teste(grupo, 'virada do dia às 07:00: nova folha e pede o nome de novo', async () => {
      await tab.irParaHora(6, 59, 57);
      await tab.esperar(notificou('Nova folha começou'), 15000, 'nova folha');
      await tab.esperar('document.body.innerText.includes("Quem está trabalhando?")', 5000, 'pedir o nome');
    });
    await teste(grupo, 'relógio adiantado em relação à central: o tablet avisa', async () => {
      await tab.esperar(notificou('adiantado'), 25000, 'aviso do relógio');
      return (await tab.avaliar(`window.__notificacoes.find((t) => t.includes('adiantado'))`)).trim();
    });
    await teste(grupo, '30 minutos sem mexer: o celular pede o nome e a senha de novo', async () => {
      // perto das 07:00, 16:00 ou 00:00 os 31 minutos passam da troca de turno: aí ele pede o nome pelo turno novo
      const turnoAntes = await cel.avaliar('(document.getElementById("turno-topo") || {}).textContent || ""');
      await cel.adiantar(31 * 60000);
      await cel.esperar('document.body.innerText.includes("minutos sem ninguém mexer") || (document.querySelector(".opcoes.nomes") && (document.getElementById("turno-topo") || {}).textContent !== ' + JSON.stringify(turnoAntes) + ')', 10000, 'trava por inatividade');
      return (await cel.existe('.aviso', 'minutos sem ninguém mexer')) ? '' : 'passou da troca de turno: pediu o nome do turno novo';
    });
    await teste(grupo, '12 horas fora da rede da usina: o celular trava e destrava quando volta', async () => {
      await cel.semRede(true);
      await cel.adiantar(13 * 3600000);
      await cel.tocar('[data-a="tema"]');
      await cel.esperar('document.querySelector("[data-a=\\"tentar\\"]")', 15000, 'tela de travado');
      await cel.semRede(false);
      await cel.tocar('[data-a="tentar"]');
      await cel.esperar('!document.querySelector("[data-a=\\"tentar\\"]")', 15000, 'destravar');
    });
    await teste(grupo, 'nenhum erro de JavaScript nos três aparelhos', async () => {
      const erros = aparelhos.flatMap((a) => a.erros.map((e) => `${a.nome}: ${e}`));
      certo(!erros.length, erros.join(' | ').slice(0, 500));
      const naCentralErros = (await api('/api/erros')).erros;
      certo(!naCentralErros.length, 'erros registrados na central: ' + naCentralErros.map((e) => e.msg).join(' | ').slice(0, 300));
    });
  } finally {
    for (const a of aparelhos) {
      await a.foto(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'saida', 'aparelhos', `${grupo.titulo.replace(/\W+/g, '-')}-${a.nome.replace(/\W+/g, '-')}.png`)).catch(() => {});
      await a.fechar();
    }
  }
}
