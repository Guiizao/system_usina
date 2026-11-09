/* Versão 3.0: o banco cai e nada para. node testes/sem-nuvem30.mjs [node|java]
 * Cada aparelho guarda em si, todos trocam pelo Wi-Fi da central, aparelho novo puxa tudo, e quando o banco volta tudo sobe sozinho.
 * Aparelho que estava desligado atualiza ao ligar. Nenhum passo aqui apaga nada: a central continua a mesma do começo ao fim.
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { abrirNavegador, TAMANHOS, dormir } from './navegador.mjs';
import { novoGrupo, teste, certo, resumo } from './teste.mjs';
import { centralNode, centralJava, pastaTemporaria, APP } from './servidores.mjs';
import { ligarNuvemSQLite } from './nuvem-sqlite.mjs';

const { carregarUsina } = createRequire(import.meta.url)('../carregar-usina.js');
const SEGREDO = 'segredo-ficticio-sem-nuvem30';
const g = novoGrupo('Sem a nuvem: guarda, troca pelo Wi-Fi e sobe quando ela voltar (3.0)');
const qual = process.argv[2];
const nav = await abrirNavegador();
const tem = (campo, valor) => `Object.values(registros).some((r) => !r.apagado && r.valores && r.valores.${campo} === ${JSON.stringify(valor)})`;

try {
  for (const [nome, ligar, porta] of [['Node', centralNode, 8571], ['Java', centralJava, 8572]]) {
    if (qual && qual !== nome.toLowerCase()) continue;
    const n = await ligarNuvemSQLite(porta + 10, SEGREDO, 'token-sem-nuvem30');
    const c = await ligar(porta, pastaTemporaria('sem-nuvem30'));
    const aparelhos = [];
    const noBanco = (campo, valor) => JSON.stringify(n.consultar('SELECT * FROM registros')).includes(`\\"${campo}\\":\\"${valor}\\"`);
    const naCentral = async (campo, valor) => (await c.api('/api/registros?desde=0')).registros.some((r) => r.valores && r.valores[campo] === valor);
    const esperarBanco = async (campo, valor, ms = 90000) => { for (const t0 = Date.now(); Date.now() - t0 < ms; await dormir(500)) if (noBanco(campo, valor)) return true; return false; };
    const tablet = async (rotulo, papel, operador) => {
      const a = await nav.novoAparelho(rotulo, TAMANHOS.tablet); aparelhos.push(a);
      await a.ir(c.url + '/', 'document.querySelector("[data-quadro=\\"codigo\\"]")');
      await a.tocar('[data-quadro="codigo"]'); await a.teclar(c.codigo().split('')); await a.tocar('[data-ed="ocultar"]'); await a.tocar('[data-a="conectar"]');
      await a.tocar(`[data-a="papel"][data-id="${papel}"]`, null, { esperarMs: 15000 });
      await a.tocar(`[data-a="escolher-operador"][data-nome="${operador}"]`);
      return a;
    };
    const anotar = async (a, pid, campo, valor) => {
      await a.avaliar(`ir({ tela: "prancheta", pid: "${pid}" }); true`);
      await a.tocar(`[data-quadro="${campo}"]`); await a.teclar(valor.split(''));
      await a.avaliar('ir(telaInicial()); true'); // saiu da folha: salva e envia sozinho
    };
    try {
      certo(!(await c.api('/api/nuvem', { acao: 'configurar', url: n.url, segredo: SEGREDO })).erro, 'configurar a nuvem');
      await c.api('/api/nuvem', { acao: 'forms', forms: carregarUsina(path.join(APP, 'public')) });
      await c.api('/api/nuvem', { acao: 'enviar' });
      const a = await tablet('a', 'caldeira', 'Alberto');
      const b = await tablet('b', 'hidrolise', 'Guilherme');

      await teste(g, `${nome}: com a nuvem ligada, o que um anota chega no banco e no outro`, async () => {
        await a.esperar('sync.viaBanco', 30000, 'o tablet A falar com o banco');
        await anotar(a, 'caldeira', 'pressao', '6');
        certo(await esperarBanco('pressao', '6', 30000), 'não chegou no banco');
        await b.esperar(tem('pressao', '6'), 30000, 'chegar no tablet B');
      });
      await teste(g, `${nome}: a nuvem caiu: cada um guarda em si, e os dois trocam pelo Wi-Fi nos dois sentidos`, async () => {
        n.foraDoAr(true);
        await anotar(a, 'caldeira', 'temp_agua', '42');
        certo(await a.avaliar(tem('temp_agua', '42')), 'o tablet A não guardou');
        await b.esperar(tem('temp_agua', '42'), 60000, 'o tablet B receber pelo Wi-Fi');
        certo(await naCentral('temp_agua', '42'), 'a central não recebeu');
        certo(!noBanco('temp_agua', '42'), 'o banco estava fora');
        await b.tocar('[data-a="abrir-prancheta"][data-id="hid_anexo1"]');
        await b.tocar('[data-quadro="brix"]'); await b.teclar(['1', '9']);
        await b.tocar('[data-ed="ocultar"]');
        await b.tocar('[data-a="salvar"]');
        await a.esperar(tem('brix', '19'), 60000, 'o tablet A receber pelo Wi-Fi');
      });
      await teste(g, `${nome}: aparelho novo configurado com a nuvem fora puxa tudo pelo Wi-Fi`, async () => {
        const novo = await tablet('novo', 'caldeira', 'Diego');
        for (const [campo, valor] of [['pressao', '6'], ['temp_agua', '42'], ['brix', '19']]) await novo.esperar(tem(campo, valor), 30000, `receber ${campo} ${valor}`);
      });
      await teste(g, `${nome}: a nuvem voltou: tudo o que ficou aqui sobe sozinho, sem ninguém mexer`, async () => {
        await b.ir('about:blank'); // este fica desligado: o próximo teste liga de novo
        await anotar(a, 'caldeira_2', 'pressao', '8'); // anotado com a nuvem ainda fora e o tablet B desligado
        await dormir(1000);
        n.foraDoAr(false);
        for (const [campo, valor] of [['temp_agua', '42'], ['brix', '19'], ['pressao', '8']]) certo(await esperarBanco(campo, valor), `${campo} ${valor} não subiu para o banco`);
      });
      await teste(g, `${nome}: aparelho que estava desligado, ao ligar, atualiza com o que é novo`, async () => {
        await b.ir(c.url + '/', 'typeof registros === "object"');
        await b.esperar(tem('pressao', '8'), 45000, 'receber o que foi anotado com ele desligado');
        certo(await b.avaliar(tem('brix', '19')), 'perdeu o que ele mesmo anotou');
      });
      await teste(g, `${nome}: aparelho novo configurado com a nuvem ligada puxa tudo`, async () => {
        const novo = await tablet('novo2', 'caldeira', 'Lucas');
        for (const [campo, valor] of [['pressao', '6'], ['temp_agua', '42'], ['pressao', '8'], ['brix', '19']]) await novo.esperar(tem(campo, valor), 45000, `receber ${campo} ${valor}`);
      });
      await teste(g, `${nome}: relatórios de qualquer dia: anotação de 200 dias atrás sobe ao banco; quem não tem vê o dia na lista e abre`, async () => {
        const antigo = await b.avaliar('somarDias(dataProducao(), -200)');
        await b.avaliar(`gravar(${JSON.stringify(antigo)}, 'ins_cal', '9', { qtd: '4', unidade: 'copos' }, { operador: 'Guilherme' }); sincronizarLogo(); true`);
        certo(await esperarBanco('qtd', '4'), 'o dia antigo não subiu ao banco');
        await a.esperar(`usarBanco()`, 40000, 'o outro aparelho falando com o banco');
        certo(await a.avaliar(`diasDoBancoEDaPasta().then((d) => d.includes(${JSON.stringify(antigo)}))`), 'o dia não veio na lista do banco');
        await a.avaliar(`buscarDia(${JSON.stringify(antigo)}).then(() => true)`);
        certo(await a.avaliar(`listar(${JSON.stringify(antigo)}, 'ins_cal').length === 1`), 'o dia não abriu');
      });
      await teste(g, `${nome}: ninguém apagou nada: central e banco ficam com as quatro anotações`, async () => {
        for (const [campo, valor] of [['pressao', '6'], ['temp_agua', '42'], ['pressao', '8'], ['brix', '19']]) {
          certo(await naCentral(campo, valor), `${campo} ${valor} sumiu da central`);
          certo(noBanco(campo, valor), `${campo} ${valor} sumiu do banco`);
        }
      });
    } finally {
      for (const x of aparelhos) await x.fechar().catch(() => {});
      await c.desligar();
      n.foraDoAr(false);
      await n.desligar();
    }
  }
} finally { await nav.fechar(); }
const r = resumo([g]);
console.log(`\n${r.passaram} de ${r.total} testes passaram; ${r.falharam} falharam`);
process.exitCode = r.falharam ? 1 : 0;
