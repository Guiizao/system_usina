/* Versão 3.0: os menus de configuração em quadros, dois a dois, numa tela só e sem rolar. node testes/menus30.mjs */
import { abrirNavegador, TAMANHOS } from './navegador.mjs';
import { novoGrupo, teste, certo, igual, resumo } from './teste.mjs';
import { centralNode, pastaTemporaria } from './servidores.mjs';

const g = novoGrupo('Menus em quadros (3.0)');
const nav = await abrirNavegador();
const c = await centralNode(8561, pastaTemporaria('menus30'));
const MEDIDAS = `(() => { const m = document.querySelector('main.quadros-menu'), q = [...m.querySelectorAll('.quadro-menu')];
  return { n: q.length, colunas: getComputedStyle(m).gridTemplateColumns.split(' ').length, rola: m.scrollHeight > m.clientHeight + 1 || m.scrollWidth > m.clientWidth + 1 || document.scrollingElement.scrollHeight > innerHeight + 1,
    cortado: q.filter((x) => x.scrollHeight > x.clientHeight + 1 || x.scrollWidth > x.clientWidth + 1).map((x) => x.innerText.split('\\n')[0]),
    baixo: q.filter((x) => x.getBoundingClientRect().height < 44).length }; })()`;
try {
  for (const [tamanho, medidas] of Object.entries(TAMANHOS)) {
    await teste(g, `${tamanho}: Usina e engrenagem em duas colunas, sem rolar e sem texto cortado`, async () => {
      const a = await nav.novoAparelho(tamanho, medidas);
      try {
        for (const [url, n] of [['&papel=central&tela=config', 8], ['&papel=hidrolise&op=Guilherme&tela=admin', 6], ['&papel=central&tela=admin', 5]]) {
          await a.ir(`${c.url}/?demo${url}`, '!!document.querySelector("main.quadros-menu")');
          const r = await a.avaliar(MEDIDAS);
          // 3.1.7: no PC largo as Configurações (8 quadros e o "Você está") ficam em 3 colunas, 3 + 3 + 3
          igual(r.n, n, url); igual(r.colunas, !medidas.celular && medidas.largura >= 1300 && url.includes('central&tela=config') ? 3 : 2, url);
          certo(!r.rola, 'apareceu rolagem em ' + url);
          igual(r.cortado, [], url); igual(r.baixo, 0, url);
        }
      } finally { await a.fechar(); }
    });
  }
  const a = await nav.novoAparelho('tablet', TAMANHOS.tablet);
  await teste(g, 'quadro abre a parte dele, o Voltar volta aos quadros', async () => {
    await a.ir(`${c.url}/?demo&papel=central&tela=config`, '!!document.querySelector("main.quadros-menu")');
    await a.tocar('[data-a="categoria"][data-cat="operadores"]');
    await a.esperar('!!document.querySelector("[data-a=op-senha]")', 5000, 'os operadores');
    certo(!(await a.existe('.setor-config')), 'as áreas não deviam estar nos operadores');
    await a.tocar('[data-a="voltar"]');
    await a.esperar('!!document.querySelector("main.quadros-menu")', 5000, 'os quadros');
    await a.tocar('[data-a="categoria"][data-cat="areas"]');
    await a.esperar('!!document.querySelector(".setor-config [data-a=setor-liga]")', 5000, 'as áreas');
    certo(await a.existe('[data-a="area-nova"]'), 'o dono cria área nova aqui');
    certo(await a.existe('[data-a="folhas"]'), 'entrada e saída ficam a um toque daqui');
  });
  await teste(g, 'o que cada um vê: o encarregado não vê Pessoas, Folhas, área nova nem o que é da nuvem', async () => {
    const base = `${c.url}/?demo&papel=central&funcoes=corrigir,relatorios,usina,avisos&tela=config`;
    await a.ir(base, '!!document.querySelector("main.quadros-menu")');
    igual(await a.avaliar('document.querySelectorAll(".quadro-menu").length'), 6);
    certo(!(await a.existe('.quadro-menu[data-a="pessoas"], .quadro-menu[data-a="folhas"]')), 'Pessoas ou Folhas apareceram');
    await a.ir(base + '&cat=areas', '!!document.querySelector(".setor-config")');
    certo(!(await a.existe('[data-a="area-nova"], [data-a="folha-tabela"]')), 'criar área e tabela é só do dono');
  });
  await teste(g, 'em cima da tabela: caixinhas com o total de cada parte da área, antes da tabela', async () => {
    await a.ir(`${c.url}/?demo&papel=central&tela=prancheta&pid=hid_anexo1&monitor=1`, '!!document.querySelector("table.papel")');
    const t = await a.avaliar('[...document.querySelectorAll(".caixa-total")].map((x) => x.innerText.replace(/\\s+/g, " "))');
    certo(t.some((x) => x.startsWith('Dornas anotadas')), 'sem a conta de dornas: ' + t);
    certo(t.some((x) => /^Cal \d/.test(x)), 'sem o total de cal: ' + t);
    certo(await a.avaliar('!!(document.querySelector(".caixas-total").compareDocumentPosition(document.querySelector("table.papel")) & Node.DOCUMENT_POSITION_FOLLOWING)'), 'as caixinhas ficaram depois da tabela');
    // a mesma conta que a tabela mostra no fim, na folha de insumo
    await a.ir(`${c.url}/?demo&papel=central&tela=prancheta&pid=ins_cal&monitor=1`, '!!document.querySelector("table.papel")');
    const [caixa, fim] = await a.avaliar('[document.querySelector(".caixa-total.aqui").innerText.replace(/\\s+/g, " "), [...document.querySelectorAll("table.papel tr")].pop().cells[1].innerText.replace(/\\s+/g, " ")]');
    certo(caixa.includes(fim), `a caixinha (${caixa}) não traz o total do fim da tabela (${fim})`);
  });
  await teste(g, 'pessoa nova: o encarregado já nasce com a conexão ligada, outro cargo não, e dá para desligar', async () => {
    await a.ir(`${c.url}/?demo&papel=central&tela=pessoas`, '!!document.querySelector("[data-a=pessoa-nova]")');
    await a.tocar('[data-a="pessoa-nova"]');
    const ligada = () => a.avaliar('document.querySelector("[data-k=\\"f:conexao\\"]").classList.contains("sel")');
    await a.esperar('!!document.querySelector("[data-k=\\"f:conexao\\"]")', 5000, 'a opção de conexão na ficha');
    certo(await ligada(), 'encarregado devia nascer com a conexão ligada');
    await a.tocar('[data-k="n:consulta"]');
    certo(!(await ligada()), 'usuário não ganha conexão');
    await a.tocar('[data-k="n:encarregado"]');
    certo(await ligada(), 'voltou a encarregado');
    await a.tocar('[data-k="f:conexao"]');
    certo(!(await ligada()), 'o dono desliga por pessoa');
    await a.tocar('.modal [data-k="x"]');
  });
  await teste(g, 'lista de relatórios: abre com 90 dias e o botão traz os mais antigos', async () => {
    await a.ir(`${c.url}/?demo&papel=central&tela=relatorios`, '!!document.querySelector(".relatorios")');
    await a.avaliar('(() => { const v = view(); v.diasComDados = Array.from({ length: 200 }, (_, i) => somarDias(dataProducao(), -i)); v.carregado = true; render(); return true; })()');
    igual(await a.avaliar('document.querySelectorAll(".relatorio-dia").length'), 90);
    await a.tocar('[data-a="relatorios-mais"]');
    await a.esperar('document.querySelectorAll(".relatorio-dia").length === 180', 5000, 'mais 90 dias');
    await a.tocar('[data-a="relatorios-mais"]');
    await a.esperar('document.querySelectorAll(".relatorio-dia").length === 200 && !document.querySelector("[data-a=relatorios-mais]")', 5000, 'todos, sem botão');
  });
  await teste(g, 'parte que não existe, ou que esse aparelho não tem, cai nos quadros', async () => {
    await a.ir(`${c.url}/?demo&papel=central&tela=config&cat=nao-existe`, '!!document.querySelector("main.quadros-menu")');
    await a.ir(`${c.url}/?demo&papel=central&tela=admin&cat=operadores`, '!!document.querySelector("main.quadros-menu")');
  });
  await teste(g, '3.0.1: lote, folha e etiqueta seguem a data do painel; hoje continua no dia que fechou', async () => {
    await a.ir(`${c.url}/?demo&papel=central&op=Guilherme`, '!!document.querySelector(".escritorio-bloco")');
    const BOTAO = '.escritorio-bloco [data-t="esc-rastreamento"]';
    const diaDoBotao = () => a.avaliar(`document.querySelector('${BOTAO}').dataset.dia`);
    igual(await diaDoBotao(), await a.avaliar('somarDias(dataProducao(), -1)'), 'hoje ainda não fechou');
    const dia = await a.avaliar('somarDias(dataProducao(), -3)');
    for (let i = 0; i < 3; i++) await a.tocar('.barra-dia [data-a="dia"][data-n="-1"]');
    igual(await diaDoBotao(), dia);
    const lote = await a.avaliar(`window.Rastreamento.lote(C, somarDias('${dia}', 1))`);
    certo((await a.avaliar('document.querySelector(".escritorio-bloco").innerText')).includes(lote), 'o quadro mostra o lote do dia escolhido');
    await a.tocar(BOTAO);
    await a.esperar('!!document.querySelector("main [data-a=esc-etiqueta]")', 5000, 'a folha');
    certo((await a.avaliar('document.querySelector("main.escritorio").innerText')).includes(`Início 07:00 de ${await a.avaliar(`fmtData('${dia}')`)}`), 'a folha é do dia escolhido');
    await a.tocar('main [data-a="esc-etiqueta"]');
    await a.esperar('!!document.querySelector(".modal #et-previa")', 5000, 'a etiqueta');
    certo((await a.avaliar('document.querySelector(".modal .dica").innerText')).includes(lote), 'a etiqueta é do lote escolhido');
    await a.tocar('.modal [data-k="x"]');
  });
  await teste(g, '3.0.1: dia antigo: a folha só abre depois de as anotações chegarem', async () => {
    await a.ir(`${c.url}/?demo&papel=central&op=Guilherme`, '!!document.querySelector(".escritorio-bloco")');
    await a.avaliar('(() => { window.__chegou = false; buscarDia = () => new Promise((r) => setTimeout(() => { window.__chegou = true; r(); }, 300)); return 1; })()');
    await a.tocar('.escritorio-bloco [data-t="esc-rastreamento"]');
    await a.esperar('view().tela === "esc-rastreamento"', 5000, 'a folha');
    certo(await a.avaliar('window.__chegou'), 'abriu antes de chegar: a conta ficaria incompleta');
  });
  await teste(g, '3.0.1: no computador, o menu Produção e rastreio (3.1.7: no lugar do Escritório) também abre no dia do painel', async () => {
    const pc = await nav.novoAparelho('computador', TAMANHOS.computador);
    try {
      await pc.ir(`${c.url}/?demo&papel=central&op=Guilherme`, '!!document.querySelector(".pn-visao")');
      const MENU = '.menu-pc [data-a="esc-abrir"][data-t="esc-calculos"]';
      igual(await pc.avaliar(`document.querySelector('${MENU}').dataset.dia`), await pc.avaliar('somarDias(dataProducao(), -1)'));
      for (let i = 0; i < 2; i++) await pc.tocar('.nav-data [data-a="dia"][data-n="-1"]');
      const dia = await pc.avaliar('somarDias(dataProducao(), -2)');
      igual(await pc.avaliar(`document.querySelector('${MENU}').dataset.dia`), dia);
      await pc.tocar(MENU);
      await pc.esperar('view().tela === "esc-calculos"', 5000, 'a Produção');
      igual(await pc.avaliar('view().data'), dia);
    } finally { await pc.fechar(); }
  });
  await a.fechar();
} finally { await c.desligar(); await nav.fechar(); }
const r = resumo([g]);
console.log(`\n${r.passaram} de ${r.total} testes passaram; ${r.falharam} falharam`);
process.exitCode = r.falharam ? 1 : 0;
