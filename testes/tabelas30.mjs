/* Versão 3.0: tabela nova por setor e saída de cada parâmetro. node testes/tabelas30.mjs [node|java]
 * A tabela nasce como dado (config|sistema|geral, folhas._tabelas): só o dono cria, chega nos tablets pela sincronização,
 * o operador anota, e ela sai no relatório e na API com os totais que o dono escolheu.
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { abrirNavegador, TAMANHOS, dormir } from './navegador.mjs';
import { novoGrupo, teste, certo, igual, resumo, entrarComoChefe, liberarSePedir, SENHA_ENCARREGADO } from './teste.mjs';
import { centralNode, centralJava, pastaTemporaria, APP } from './servidores.mjs';
import { conectarTeste } from './cifra.mjs';

const require = createRequire(import.meta.url);
const { carregarUsina } = require('../carregar-usina.js');
const Folhas = require('../public/config/folhas.js');
const leitura = require('../api-leitura.js');
const formsNovos = () => carregarUsina(path.join(APP, 'public'));
const dia = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const CFG = 'config|sistema|geral';
const TABELA = 't_abc123';
const campoA = { id: 'x_vazao', label: 'Vazão', type: 'num', dec: 1, unidade: 'L/h' };
const campoB = { id: 'x_turma', label: 'Turma', type: 'text', soLetras: true };
const folhasDeTeste = () => ({
  _tabelas: { [TABELA]: { nome: 'Economizador', setor: 'caldeira' }, t_sem: { nome: 'Sem setor', setor: 'nao-existe' }, MAU: { nome: 'id ruim', setor: 'caldeira' } },
  [TABELA]: { _novos: [campoA, campoB], x_vazao: { saida: { total: 'soma' } }, x_turma: { saida: { api: false } } },
});

const g = novoGrupo('Tabelas novas e saída (3.0)');
await teste(g, 'tabela nova entra no setor, com os campos e o nome; id ruim e setor inexistente não entram', async () => {
  const C = formsNovos();
  Folhas.aplicar(C, folhasDeTeste(), new Map());
  const p = C.pranchetas[TABELA];
  igual(p.tipo, 'grade'); igual(p.nome, 'Economizador'); igual(p.itens.map((c) => c.id), ['x_vazao', 'x_turma']);
  igual(p.itens[1].soLetras, true); igual(p.grupos[0].titulo, 'Economizador');
  certo(C.setores.find((s) => s.id === 'caldeira').pranchetas.includes(TABELA), 'fora do setor');
  certo(!C.pranchetas.t_sem && !C.pranchetas.MAU, 'entrou tabela inválida');
});
await teste(g, 'área nova entra uma vez só, sem folhas; id ruim não entra', async () => {
  const C = formsNovos(), originais = new Map(), n = C.setores.length;
  const f = { _areas: { a_moenda1: { nome: 'Moenda' }, MAU: { nome: 'id ruim' } } };
  Folhas.aplicar(C, f, originais); Folhas.aplicar(C, f, originais);
  igual(C.setores.length, n + 1);
  igual(C.setores.at(-1).pranchetas, []);
});
await teste(g, 'tabela removida de vez sai do setor, nova ou de fábrica; a definição fica para os dias já anotados', async () => {
  const C = formsNovos();
  const deFabrica = C.setores.find((s) => s.id === 'caldeira').pranchetas[0];
  Folhas.aplicar(C, { ...folhasDeTeste(), _removidas: [TABELA, deFabrica] }, new Map());
  const caldeira = C.setores.find((s) => s.id === 'caldeira');
  certo(!caldeira.pranchetas.includes(TABELA) && !caldeira.pranchetas.includes(deFabrica), 'continuou no setor');
  certo(C.pranchetas[TABELA] && C.pranchetas[deFabrica], 'a definição sumiu');
});
await teste(g, 'aplicar de novo não duplica no setor', async () => {
  const C = formsNovos(), originais = new Map();
  Folhas.aplicar(C, folhasDeTeste(), originais); Folhas.aplicar(C, folhasDeTeste(), originais);
  igual(C.setores.find((s) => s.id === 'caldeira').pranchetas.filter((x) => x === TABELA).length, 1);
  igual(C.pranchetas[TABELA].itens.length, 2);
});
await teste(g, 'total do dia: soma, média e último; sem anotação não inventa zero', async () => {
  const c = (total) => ({ saida: { total } });
  igual(Folhas.totalDoCampo(c('soma'), ['1.5', '', '2']), 3.5); igual(Folhas.totalDoCampo(c('media'), ['1', '2']), 1.5);
  igual(Folhas.totalDoCampo(c('ultimo'), ['1', '2', '']), '2'); igual(Folhas.totalDoCampo(c('soma'), ['', null]), null);
  igual(Folhas.totalDoCampo({}, ['1']), null);
});
await teste(g, 'API: a tabela sai com o total; o que o dono tirou da API não sai', async () => {
  const C = formsNovos();
  Folhas.aplicar(C, folhasDeTeste(), new Map());
  const api = leitura.criar(C, () => null, { fusoMin: -180 });
  const reg = (h, valores) => ({ id: `${dia}|${TABELA}|${h}`, data: dia, prancheta: TABELA, chave: String(h), valores, atualizadoEm: 1, operador: 'X' });
  const d = api.dia(dia, [reg(9, { x_vazao: '10.5', x_turma: 'A' }), reg(10, { x_vazao: '4' })]);
  const p = d.setores.find((s) => s.id === 'caldeira').pranchetas.find((x) => x.id === TABELA);
  igual(p.saidas, [{ id: 'x_vazao', rotulo: 'Vazão', tipoDeTotal: 'soma', total: 14.5, unidade: 'L/h' }]);
  certo(p.linhas[0].campos.x_vazao && !p.linhas[0].campos.x_turma, 'x_turma tirado da API apareceu');
  const esq = api.esquema().setores.find((s) => s.id === 'caldeira').pranchetas.find((x) => x.id === TABELA);
  igual(esq.campos.map((c) => c.id), ['x_vazao']);
});

const qual = process.argv[2];
const nav = await abrirNavegador();
try {
  for (const [nome, ligar, porta] of [['Node', centralNode, 8501], ['Java', centralJava, 8502]]) {
    if (qual && qual !== nome.toLowerCase()) continue;
    const c = await ligar(porta, pastaTemporaria('tabelas30'));
    const p = async (cli, rota, corpo) => { const r = await cli.pedir(rota, corpo === undefined ? {} : { corpo }); return Object.assign({ status: r.status }, r.json || {}); };
    const mudarConfig = async (cli, folhas) => {
      const atual = (await p(cli, '/api/registros?desde=0')).registros.find((r) => r.id === CFG);
      return p(cli, '/api/sync', { aparelho: cli.aparelho, papel: 'central', versao: '3.0.0', registros: [{ id: CFG, data: 'config', prancheta: 'sistema', chave: 'geral', valores: { ...(atual?.valores || {}), folhas }, atualizadoEm: Date.now(), base: atual?.rev || 0 }] });
    };
    const chefes = {};
    const aparelhos = [];
    try {
      chefes.n2 = await conectarTeste(c.url, c.codigo());
      igual((await p(chefes.n2, '/api/pessoas', { acao: 'entrar', pin: SENHA_ENCARREGADO })).status, 200);
      await teste(g, `${nome}: no nível 2 nem o dono cria tabela: ela não fica guardada`, async () => {
        await mudarConfig(chefes.n2, folhasDeTeste());
        const guardada = (await p(chefes.n2, '/api/registros?desde=0')).registros.find((r) => r.id === CFG);
        certo(!guardada || !(guardada.valores.folhas || {})._tabelas, 'a tabela ficou guardada: ' + JSON.stringify(guardada && guardada.valores.folhas));
      });
      const novo = async (n, t) => { const a = await nav.novoAparelho(n, t); aparelhos.push(a); return a; };
      const entrarEm = async (a, papel) => {
        await a.ir(c.url + '/', 'document.querySelector("[data-quadro=\\"codigo\\"]")');
        await a.tocar('[data-quadro="codigo"]'); await a.teclar(c.codigo().split('')); await a.tocar('[data-ed="ocultar"]'); await a.tocar('[data-a="conectar"]');
        await a.tocar(`[data-a="papel"][data-id="${papel}"]`, null, { esperarMs: 15000 });
      };
      let chefe, cal;
      await teste(g, `${nome}: o dono cria a tabela no tablet, o operador da Caldeira vê, anota e chega na central`, async () => {
        chefe = await novo('chefe', TAMANHOS.tablet);
        await entrarEm(chefe, 'central');
        await liberarSePedir(chefe, 3);
        await entrarComoChefe(chefe);
        cal = await novo('caldeira', TAMANHOS.tablet);
        await entrarEm(cal, 'caldeira');
        await cal.tocar('[data-a="escolher-operador"][data-nome="Alberto"]');
        await chefe.avaliar('ir({ tela: "folhas" }); true');
        await chefe.tocar('[data-a="folha-tabela"][data-setor="caldeira"]');
        await chefe.esperar('!!document.querySelector(".modal #txt")', 5000, 'pede o nome');
        await chefe.avaliar('(() => { document.getElementById("txt").value = "Economizador"; return true; })()');
        await chefe.tocar('.modal [data-k="ok"]');
        await chefe.esperar('!!document.querySelector(".modal #est-novos")', 8000, 'abre os campos da tabela');
        await chefe.tocar('.modal [data-k="novo"]');
        await chefe.esperar('!!document.querySelector(".modal #cn-nome")', 5000, 'janela do campo novo');
        await chefe.avaliar('(() => { document.getElementById("cn-nome").value = "Vazão"; document.getElementById("cn-min").value = "10"; document.getElementById("cn-max").value = "50,5"; return true; })()');
        await chefe.tocar('.modal [data-k="ok"]');
        await chefe.esperar('document.querySelector(".modal") && document.querySelector(".modal").innerText.includes("Vazão")', 5000, 'campo na lista');
        await chefe.tocar('.modal [data-k="ok"]');
        await chefe.esperar('!document.querySelector(".modal")', 8000, 'salvou a tabela');
        const pid = await chefe.avaliar('Object.keys(USINA.pranchetas).find((k) => USINA.pranchetas[k].novaTabela)');
        certo(/^t_/.test(pid), 'a tabela não apareceu: ' + pid);
        const idCampo = await chefe.avaliar(`USINA.pranchetas[${JSON.stringify(pid)}].itens[0].id`);
        // o mínimo e o máximo do campo novo viram os avisos de baixo e de alto
        const avisoEm = (v) => chefe.avaliar(`avisosDe(USINA.pranchetas[${JSON.stringify(pid)}].itens[0], ${JSON.stringify(v)}).map((a) => a.curto)`);
        igual(await avisoEm('9'), ['Vazão baixo']); igual(await avisoEm('51'), ['Vazão alto']); igual(await avisoEm('30'), []);
        await cal.esperar(`!!USINA.pranchetas[${JSON.stringify(pid)}] && USINA.pranchetas[${JSON.stringify(pid)}].itens.length === 1`, 25000, 'a tabela no tablet da Caldeira');
        await cal.esperar(`!!document.querySelector('[data-a="abrir-prancheta"][data-id="${pid}"], [data-a="aba"][data-id="${pid}"]')`, 15000, 'o botão da tabela na tela do operador');
        await cal.tocar(`[data-a="abrir-prancheta"][data-id="${pid}"], [data-a="aba"][data-id="${pid}"]`);
        await cal.tocar(`[data-quadro="${idCampo}"]`);
        await cal.teclar(['4', '2']);
        await cal.tocar('[data-ed="ocultar"]');
        await cal.tocar('[data-a="salvar"]');
        for (let i = 0; i < 40; i++) {
          const l = (await c.api('/api/registros?desde=0')).registros;
          if (l.some((r) => r.prancheta === pid && r.valores[idCampo] === '42')) return;
          await dormir(500);
        }
        throw new Error('a anotação da tabela nova não chegou na central');
      });
      await teste(g, `${nome}: o dono cria uma área nova com tabela e operador; um tablet escolhe a área, anota e chega na central`, async () => {
        await chefe.avaliar('ir({ tela: "config", cat: "areas" }); true');
        await chefe.tocar('[data-a="area-nova"]');
        await chefe.esperar('!!document.querySelector(".modal #txt")', 5000, 'pede o nome da área');
        await chefe.avaliar('(() => { document.getElementById("txt").value = "Moenda"; return true; })()');
        await chefe.tocar('.modal [data-k="ok"]');
        await chefe.esperar('document.querySelector(".modal #txt") && document.querySelector(".modal").innerText.includes("Moenda")', 5000, 'pede a primeira tabela');
        await chefe.avaliar('(() => { document.getElementById("txt").value = "Ternos"; return true; })()');
        await chefe.tocar('.modal [data-k="ok"]');
        await chefe.esperar('!!document.querySelector(".modal #est-novos")', 8000, 'abre os campos da tabela');
        await chefe.tocar('.modal [data-k="novo"]');
        await chefe.esperar('!!document.querySelector(".modal #cn-nome")', 5000, 'janela do campo novo');
        await chefe.avaliar('(() => { document.getElementById("cn-nome").value = "Rotação"; return true; })()');
        await chefe.tocar('.modal [data-k="ok"]');
        await chefe.esperar('document.querySelector(".modal") && document.querySelector(".modal").innerText.includes("Rotação")', 5000, 'campo na lista');
        await chefe.tocar('.modal [data-k="ok"]');
        await chefe.esperar('!document.querySelector(".modal")', 8000, 'salvou a tabela');
        const { id, pid } = await chefe.avaliar('(() => { const s = todosSetores.find((x) => x.nome === "Moenda"); return { id: s.id, pid: s.pranchetas[0] }; })()');
        certo(/^a_/.test(id) && /^t_/.test(pid), `área ${id}, tabela ${pid}`);
        const idCampo = await chefe.avaliar(`USINA.pranchetas[${JSON.stringify(pid)}].itens[0].id`);
        await chefe.avaliar('ir({ tela: "config", cat: "operadores" }); true');
        await chefe.tocar(`[data-a="op-add"][data-setor="${id}"]`);
        await chefe.esperar('!!document.querySelector(".modal #txt")', 5000, 'pede o operador');
        await chefe.avaliar('(() => { document.getElementById("txt").value = "Rui"; return true; })()');
        await chefe.tocar('.modal [data-k="ok"]');
        await chefe.tocar('.modal [data-k="ok"]'); // sem senha
        await chefe.esperar('!document.querySelector(".modal")', 8000, 'salvou o operador');
        const m = await novo('moenda', TAMANHOS.tablet);
        await entrarEm(m, id);
        await m.tocar('[data-a="escolher-operador"][data-nome="Rui"]');
        await m.tocar(`[data-a="abrir-prancheta"][data-id="${pid}"], [data-a="aba"][data-id="${pid}"]`);
        await m.tocar(`[data-quadro="${idCampo}"]`);
        await m.teclar(['7']);
        await m.tocar('[data-ed="ocultar"]');
        await m.tocar('[data-a="salvar"]');
        for (let i = 0; i < 40; i++) {
          const l = (await c.api('/api/registros?desde=0')).registros;
          if (l.some((r) => r.prancheta === pid && r.valores[idCampo] === '7')) return;
          await dormir(500);
        }
        throw new Error('a anotação da área nova não chegou na central');
      });
      await teste(g, `${nome}: o dono remove a tabela de vez: some do tablet e o nome fica livre; o que foi anotado continua na central`, async () => {
        const pid = await chefe.avaliar('Object.keys(USINA.pranchetas).find((k) => USINA.pranchetas[k].nome === "Economizador")');
        await chefe.avaliar('ir({ tela: "folhas" }); true');
        await chefe.tocar(`[data-a="folha-remover"][data-id="${pid}"]`);
        await chefe.esperar('!!document.querySelector(".modal [data-k=sim]")', 5000, 'pede para confirmar');
        await chefe.tocar('.modal [data-k="sim"]');
        await chefe.esperar(`!document.querySelector('[data-a="folha-remover"][data-id="${pid}"]')`, 8000, 'saiu da lista de folhas');
        await cal.esperar(`!setorPorId('caldeira').pranchetas.includes(${JSON.stringify(pid)})`, 25000, 'saiu do tablet da Caldeira');
        certo((await c.api('/api/registros?desde=0')).registros.some((x) => x.prancheta === pid && x.valores && Object.values(x.valores).includes('42')), 'a anotação sumiu da central');
        await chefe.tocar('[data-a="folha-tabela"][data-setor="caldeira"]');
        await chefe.esperar('!!document.querySelector(".modal #txt")', 5000, 'pede o nome');
        await chefe.avaliar('(() => { document.getElementById("txt").value = "Economizador"; return true; })()');
        await chefe.tocar('.modal [data-k="ok"]');
        await chefe.esperar('!!document.querySelector(".modal #est-novos")', 8000, 'o nome da removida ficou livre');
        await chefe.tocar('.modal [data-k="x"]');
      });
    } finally {
      for (const a of aparelhos) await a.fechar().catch(() => {});
      await c.desligar();
    }
  }
} finally { await nav.fechar(); }
const r = resumo([g]);
console.log(`\n${r.passaram} de ${r.total} testes passaram; ${r.falharam} falharam`);
process.exitCode = r.falharam ? 1 : 0;
