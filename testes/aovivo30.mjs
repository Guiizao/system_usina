/* Versão 3.0: em tempo real pelo Wi-Fi, salvar sozinho, resetar e cópia em todo aparelho. node testes/aovivo30.mjs [node|java]
 * Dois tablets de verdade na mesma central, sem internet.
 */
import { abrirNavegador, TAMANHOS, dormir } from './navegador.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { novoGrupo, teste, certo, igual, resumo, SENHA_ENCARREGADO, usinaNoContexto } from './teste.mjs';
import { centralNode, centralJava, pastaTemporaria } from './servidores.mjs';
import { conectarTeste } from './cifra.mjs';
import { ligarNuvemSQLite } from './nuvem-sqlite.mjs';

const g = novoGrupo('Tempo real pelo Wi-Fi, salvar sozinho, resetar e cópia (3.0)');
const qual = process.argv[2];
const nav = await abrirNavegador();


async function tablet(c, nome, papel, operador, comRelogio) {
  const a = await nav.novoAparelho(nome, TAMANHOS.tablet);
  // a ponte do programa do Windows, simulada: é por ela que a cópia chega na pasta
  await a.antesDeAbrir(`window.__copias = JSON.parse(localStorage.getItem('copias-teste') || '{}'); window.pranchetasPC = {
    guardarCopia: (n, t) => { window.__copias[n] = t; localStorage.setItem('copias-teste', JSON.stringify(window.__copias)); return Promise.resolve(); },
    lerCopia: (n) => Promise.resolve(window.__copias[n] || ''),
    listarCopias: () => Promise.resolve({ nomes: Object.keys(window.__copias).filter((n) => /^\\d{4}-/.test(n)).sort() }) };`);
  if (comRelogio) await a.relogioFalso();
  await a.ir(c.url + '/', 'document.querySelector("[data-quadro=\\"codigo\\"]")');
  await a.tocar('[data-quadro="codigo"]'); await a.teclar(c.codigo().split('')); await a.tocar('[data-ed="ocultar"]'); await a.tocar('[data-a="conectar"]');
  await a.tocar(`[data-a="papel"][data-id="${papel}"]`, null, { esperarMs: 15000 });
  if (operador) await a.tocar(`[data-a="escolher-operador"][data-nome="${operador}"]`);
  return a;
}
const abrirFolha = async (a) => { await a.avaliar('ir({ tela: "prancheta", pid: "caldeira" }); true'); await a.esperar('document.querySelector(\'[data-quadro="pressao"]\')', 8000, 'a folha abrir'); };
const anotar = async (a, campo, teclas) => { await a.tocar(`[data-quadro="${campo}"]`); await a.teclar(teclas); };
async function naCentral(c, campo, valor) {
  for (let i = 0; i < 40; i++) {
    const l = (await c.api('/api/registros?desde=0')).registros;
    if (l.some((r) => r.prancheta === 'caldeira' && !r.apagado && r.valores[campo] === valor)) return true;
    await dormir(400);
  }
  return false;
}

const diaAntes = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const registro = (data, valores, extra = {}) => ({ id: `${data}|caldeira|22`, data, prancheta: 'caldeira', chave: '22', valores, criadoEm: Date.now() - 10000, atualizadoEm: Date.now(), operador: 'Alberto', ...extra });
async function pedir(cli, rota, corpo) {
  const r = await cli.pedir(rota, { corpo });
  igual(r.status, 200, `${rota}: ${JSON.stringify(r.json)}`);
  return r.json;
}
async function chefe(c, nivel = 2, pin = SENHA_ENCARREGADO) {
  const cli = await conectarTeste(c.url, c.codigo());
  await pedir(cli, '/api/chefes', { acao: 'liberar', nivel, pin: SENHA_ENCARREGADO });
  await pedir(cli, '/api/pessoas', { acao: 'entrar', pin });
  return cli;
}
async function mudarConfig(c, cli, mudar) {
  const atual = (await c.api('/api/registros?desde=0')).registros.find((r) => r.id === 'config|sistema|geral');
  const r = { id: 'config|sistema|geral', data: 'config', prancheta: 'sistema', chave: 'geral',
    valores: mudar(structuredClone(atual?.valores || {})), base: atual?.rev || 0, atualizadoEm: Date.now() };
  const resposta = await pedir(cli, '/api/sync', { aparelho: cli.aparelho, papel: 'central', versao: '3.0.0', registros: [r] });
  igual(resposta.recusados, []);
  return (await c.api('/api/registros?desde=0')).registros.find((r) => r.id === 'config|sistema|geral').valores;
}

try {
  for (const [nome, ligar, porta] of [['Node', centralNode, 8541], ['Java', centralJava, 8542]]) {
    if (qual && qual !== nome.toLowerCase()) continue;
    let c = await ligar(porta, pastaTemporaria('aovivo30'));
    const aparelhos = [];
    try {
      const a = await tablet(c, 'a', 'caldeira', 'Alberto', true); aparelhos.push(a);
      const b = await tablet(c, 'b', 'caldeira', 'Diego'); aparelhos.push(b);
      await abrirFolha(a); await abrirFolha(b);

      await teste(g, `${nome}: o que um digita aparece no outro pelo Wi-Fi e não fica gravado`, async () => {
        await anotar(a, 'pressao', ['6']);
        await b.esperar('document.getElementById("rascunho-outro") && document.getElementById("rascunho-outro").textContent.includes("ainda não salvo")', 10000, 'o rascunho aparecer no outro tablet');
        const texto = await b.avaliar('document.getElementById("rascunho-outro").textContent');
        certo(texto.includes('Alberto'), texto);
        const l = (await c.api('/api/registros?desde=0')).registros;
        certo(!l.some((r) => r.prancheta === 'caldeira' && r.valores.pressao), 'o rascunho foi gravado na central');
      });
      await teste(g, `${nome}: saiu da folha sem tocar em Salvar: salva, chega na central e o aviso some no outro`, async () => {
        await a.avaliar('ir(telaInicial()); true');
        certo(await naCentral(c, 'pressao', '6'), 'não chegou na central');
        await b.esperar('!document.getElementById("rascunho-outro")', 12000, 'o aviso sumir');
      });
      await teste(g, `${nome}: o aplicativo foi para o fundo com algo digitado: salva e envia`, async () => {
        await abrirFolha(a); await anotar(a, 'temp_agua', ['4', '2']);
        await a.avaliar(`(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); return true; })()`);
        certo(await naCentral(c, 'temp_agua', '42'), 'não chegou na central');
        await a.avaliar(`(() => { delete document.visibilityState; return true; })()`);
      });
      await teste(g, `${nome}: digitou e ficou 5 minutos sem mexer: salva sozinho e continua na folha`, async () => {
        await abrirFolha(a); await anotar(a, 'temp_agua', ['7', '7']);
        await dormir(1200);
        certo(await a.avaliar('rascunhoSujo()'), 'o rascunho deveria estar aberto');
        await a.adiantar(4 * 60000);
        await dormir(1500);
        certo(await a.avaliar('rascunhoSujo()'), 'salvou antes dos 5 minutos');
        await a.adiantar(61000 + 1000);
        certo(await naCentral(c, 'temp_agua', '77'), 'não chegou na central');
        igual(await a.avaliar('view().tela'), 'prancheta');
      });
      await teste(g, `${nome}: cópia em todo aparelho: o tablet de setor guarda o dia inteiro, de todos os setores, mesmo fora dos 3 dias da memória`, async () => {
        const antigo = await a.avaliar('somarDias(dataProducao(), -10)');
        const cli = await conectarTeste(c.url, c.codigo());
        const r = await cli.pedir('/api/sync', { corpo: { aparelho: cli.aparelho, papel: 'hidrolise', versao: '3.0.0', registros: [{ id: `${antigo}|ins_cal|9`, data: antigo, prancheta: 'ins_cal', chave: '9', valores: { qtd: '2' }, atualizadoEm: Date.now() - 5000, operador: 'Mateus' }] } });
        igual(r.status, 200);
        await dormir(800);
        certo((await a.avaliar('guardarDias()')) > 0, 'nenhum dia foi guardado');
        const texto = await a.avaliar(`window.__copias[${JSON.stringify(antigo + '.json')}] || ''`);
        certo(texto.includes('ins_cal'), 'o dia antigo não foi guardado: ' + (await a.avaliar('Object.keys(window.__copias).join()')));
        certo(!(await a.avaliar(`Object.values(registros).some((x) => x.data === ${JSON.stringify(antigo)})`)), 'o dia antigo não deveria ficar na memória do tablet');
        const hojeTxt = await a.avaliar(`window.__copias[dataProducao() + '.json'] || ''`);
        certo(hojeTxt.includes('pressao'), 'o dia de hoje não foi guardado');
        igual(await a.avaliar('guardarDias()'), 0, 'sem mudança, não baixa nada de novo');
      });
      await teste(g, `${nome}: apagar os dados deste aparelho não mexe na central, e ele baixa de novo`, async () => {
        const antes = (await c.api('/api/registros?desde=0')).registros.filter((r) => !r.apagado).length;
        await a.avaliar('cfg.bancoSeq = 99; cfg.copiaSeq = 99; ir({ tela: "admin", cat: "dados" }); true');
        await a.tocar('[data-a="limpar-tudo"]');
        await a.tocar('.modal [data-k="sim"]');
        await a.esperar('Object.keys(registros).length === 0 || !cfg.papel', 5000, 'apagar');
        igual(await a.avaliar('[cfg.bancoSeq, cfg.copiaSeq]'), [0, 0]);
        await dormir(1500);
        igual((await c.api('/api/registros?desde=0')).registros.filter((r) => !r.apagado).length, antes, 'a central perdeu anotação');
        await a.tocar('[data-a="papel"][data-id="caldeira"]', null, { esperarMs: 15000 });
        await a.esperar('Object.values(registros).some((r) => r.valores && r.valores.pressao === "6")', 20000, 'baixar de novo');
      });
      await teste(g, `${nome}: a central zerou com a nuvem fora: o tablet devolve o que guarda, de todos os setores, e ela não muda o que já tem`, async () => {
        await b.fechar(); aparelhos.splice(aparelhos.indexOf(b), 1);
        const antigo = await a.avaliar('somarDias(dataProducao(), -10)');
        // a mesma cópia em outro dia: a central nova não tem esse dia, nem de outro setor
        await a.avaliar('guardarDias()');
        const dias = await a.avaliar('Object.keys(window.__copias).filter((n) => /^\\d{4}-/.test(n))');
        certo(dias.includes(antigo + '.json'), 'o tablet devia ter o dia antigo na pasta: ' + dias);
        // a central é trocada no mesmo endereço, sem nada guardado, e já recebeu uma anotação de hoje
        await c.desligar();
        c = await ligar(porta, pastaTemporaria('aovivo30-nova'));
        const cli = await conectarTeste(c.url, c.codigo());
        const hoje = await a.avaliar('dataProducao()');
        await cli.pedir('/api/sync', { corpo: { aparelho: cli.aparelho, papel: 'caldeira', versao: '3.0.0', registros: [{ id: `${hoje}|caldeira|23`, data: hoje, prancheta: 'caldeira', chave: '23', valores: { pressao: '9' }, atualizadoEm: Date.now(), operador: 'Diego' }] } });
        // o tablet entra com o código novo, como na usina
        await a.avaliar('(() => { desconectar("A central foi trocada"); return 1; })()');
        await a.esperar('document.querySelector("[data-quadro=\\"codigo\\"]")', 8000, 'a tela de conectar');
        await a.tocar('[data-quadro="codigo"]'); await a.teclar(c.codigo().split('')); await a.tocar('[data-ed="ocultar"]'); await a.tocar('[data-a="conectar"]');
        await a.esperar('cfg.chave', 15000, 'conectar');
        for (let i = 0; i < 30 && !(await a.avaliar('!!cfg.chave && cfg.geracao && !cfg.devolverPendente && !devolvendo && sync.modo === "online"')); i++) { await a.avaliar('(() => { sincronizar(); return 1; })()'); await dormir(500); }
        const l = (await c.api('/api/registros?desde=0')).registros;
        certo(l.some((r) => r.prancheta === 'ins_cal' && r.data === antigo), 'não voltou o dia antigo de outro setor');
        certo(l.some((r) => r.prancheta === 'caldeira' && r.valores.pressao === '6'), 'não voltou a anotação do tablet');
        igual(l.find((r) => r.chave === '23' && r.prancheta === 'caldeira').valores.pressao, '9', 'mudou o que a central nova já tinha');
        const texto = await a.avaliar(`window.__copias[${JSON.stringify(antigo + '.json')}] || ''`);
        certo(texto.includes('ins_cal'), 'a cópia perdeu o dia antigo');
      });
      await teste(g, `${nome}: central vazia não esvazia a cópia: o arquivo do dia fica com o que já tinha`, async () => {
        const hoje = await a.avaliar('dataProducao()');
        const antes = await a.avaliar(`JSON.parse(window.__copias[${JSON.stringify(hoje + '.json')}]).length`);
        const r = await a.avaliar(`juntarComAPasta(${JSON.stringify(hoje + '.json')}, [])`);
        igual(r.length, antes);
        // cada campo fica com o mais novo: uma central que devolve a pressão mais nova não leva o vapor mais novo da cópia
        const nome = JSON.stringify('2020-01-02.json');
        const linha = (valores, camposEm, atualizadoEm) => ({ id: '2020-01-02|caldeira|8', data: '2020-01-02', prancheta: 'caldeira', chave: '8', valores, camposEm, atualizadoEm });
        await a.avaliar(`gravarNaPasta(${nome}, ${JSON.stringify(JSON.stringify([linha({ pressao: '1', vapor: '9' }, { pressao: 10, vapor: 50 }, 50)]))})`);
        const junto = await a.avaliar(`juntarComAPasta(${nome}, [${JSON.stringify(linha({ pressao: '2', vapor: '8' }, { pressao: 60, vapor: 20 }, 60))}])`);
        igual(junto[0].valores, { pressao: '2', vapor: '9' });
      });
      // Os casos abaixo usam a API cifrada, nas duas centrais, e o Worker real com SQLite local.
      for (const x of aparelhos.splice(0)) await x.fechar();
      const cli = await c.cliente();
      const antigo = diaAntes(91), limite = diaAntes(90), em = Date.now() - 5000;
      await teste(g, `${nome}: o padrão conserva o dia de 90 dias na memória e arquiva o de 91 sem perdê-lo`, async () => {
        const r = await pedir(cli, '/api/sync', { aparelho: cli.aparelho, papel: 'central', versao: '3.0.0', registros: [
          registro(limite, { pressao: '4' }), registro(antigo, { pressao: '5', temp_agua: '42' }, { atualizadoEm: em, camposEm: { pressao: em - 2000, temp_agua: em } }),
        ] });
        igual(r.recusados, []); igual(r.aceitos, 2);
        const memoria = (await c.api('/api/registros?desde=0')).registros;
        certo(memoria.some((r) => r.data === limite), 'o dia de 90 dias saiu cedo da memória');
        certo(!memoria.some((r) => r.data === antigo), 'o dia de 91 dias deveria estar só no arquivo');
        igual((await c.api('/api/registros?dia=' + antigo)).registros[0].valores.pressao, '5');
      });
      await teste(g, `${nome}: correção Wi-Fi de arquivo já enviado sobe sozinha ao banco, inclusive junção por campo`, async () => {
        const segredo = 'segredo-ficticio-aovivo30', n = await ligarNuvemSQLite(porta + 20, segredo, 'token-aovivo30');
        try {
          certo(!(await c.api('/api/nuvem', { acao: 'configurar', url: n.url, segredo })).erro, 'configurar banco local');
          const contexto = { window: {} }; usinaNoContexto(contexto);
          await c.api('/api/nuvem', { acao: 'forms', forms: contexto.window.USINA });
          await c.api('/api/nuvem', { acao: 'enviar' });
          const noBanco = () => n.consultar(`SELECT seq, json FROM registros WHERE id = '${antigo}|caldeira|22'`)[0];
          const antes = noBanco(); certo(antes, 'o dia arquivado não chegou na carga inicial');
          igual(JSON.parse(antes.json).valores.pressao, '5');
          certo(JSON.parse(fs.readFileSync(path.join(c.pastaServidor, 'config.json'), 'utf8')).nuvem.arquivosEnviados, 'a carga inicial deve ter terminado');
          // A cópia traz o seq antigo e doBanco. O campo corrigido é novo, mesmo com o horário global menor.
          const copia = (await c.api('/api/registros?dia=' + antigo)).registros[0];
          const r = await pedir(cli, '/api/sync', { aparelho: cli.aparelho, papel: 'central', versao: '3.0.0', registros: [{ ...copia,
            doBanco: true, valores: { pressao: '7' }, camposEm: { pressao: em - 1000 }, atualizadoEm: em - 1000,
          }] });
          igual(r.recusados, []); igual(r.aceitos, 1);
          for (let i = 0; i < 60 && JSON.parse(noBanco().json).valores.pressao !== '7'; i++) await dormir(500);
          const depois = noBanco(), salvo = JSON.parse(depois.json);
          igual(salvo.valores.pressao, '7', 'correção não subiu automaticamente');
          igual(salvo.valores.temp_agua, '42', 'a correção perdeu outro campo');
          certo(depois.seq > antes.seq, 'a correção não ganhou sequência nova no banco');
          const arquivo = (await c.api('/api/registros?dia=' + antigo)).registros[0];
          igual(arquivo.valores.pressao, '7'); igual(arquivo.valores.temp_agua, '42');
        } finally {
          await c.api('/api/nuvem', { acao: 'configurar', url: '', segredo: '' });
          await n.desligar();
        }
      });
      await teste(g, `${nome}: arquivo: o banco manda linha velha e a correção daqui ainda sobe; central trocada recebe os dias arquivados, sem mudar o que tem`, async () => {
        const segredo = 'segredo-ficticio-aovivo30', n = await ligarNuvemSQLite(porta + 30, segredo, 'token-aovivo30');
        try {
          certo(!(await c.api('/api/nuvem', { acao: 'configurar', url: n.url, segredo })).erro, 'configurar banco local');
          const contexto = { window: {} }; usinaNoContexto(contexto);
          await c.api('/api/nuvem', { acao: 'forms', forms: contexto.window.USINA });
          await c.api('/api/nuvem', { acao: 'enviar' });
          const velho = diaAntes(200), id = `${velho}|caldeira|8`;
          const linha = (valores, camposEm, atualizadoEm) => ({ id, data: velho, prancheta: 'caldeira', chave: '8', valores, camposEm, criadoEm: 1000, atualizadoEm, operador: 'Alberto' });
          const devolver = (registros) => pedir(cli, '/api/devolver', { registros });
          igual((await devolver([linha({ pressao: '5', temp_agua: '30' }, { pressao: 2000, temp_agua: 2000 }, 2000)])).aceitos, 1, 'o dia arquivado não voltou');
          igual((await devolver([linha({ pressao: '6' }, { pressao: 3000 }, 3000)])).aceitos, 0, 'o devolver mudou o que a central tem');
          const noBanco = () => n.consultar(`SELECT json FROM registros WHERE id = '${id}'`).map((l) => JSON.parse(l.json))[0];
          await c.api('/api/nuvem', { acao: 'enviar' });
          for (let i = 0; i < 40 && !noBanco(); i++) await dormir(500);
          igual(noBanco().valores.pressao, '5', 'o dia devolvido não subiu');
          // a correção do Wi-Fi entra na central e, antes de subir, o banco traz uma versão mais velha da mesma linha
          const r = await pedir(cli, '/api/sync', { aparelho: cli.aparelho, papel: 'central', versao: '3.0.0', registros: [linha({ pressao: '7' }, { pressao: 9000 }, 9000)] });
          igual(r.aceitos, 1);
          await n.pedir('/central/enviar', { senha: segredo, corpo: { geracao: n.consultar("SELECT valor FROM info WHERE chave = 'geracao'")[0].valor, registros: [{ ...linha({ temp_agua: '31' }, { temp_agua: 4000 }, 4000), seq: 1 }] } });
          for (let i = 0; i < 60 && !(noBanco().valores.pressao === '7' && noBanco().valores.temp_agua === '31'); i++) { await c.api('/api/nuvem', { acao: 'enviar' }); await dormir(500); }
          igual(noBanco().valores.pressao, '7', 'a correção ficou só no arquivo');
          igual(noBanco().valores.temp_agua, '31', 'a mudança do banco se perdeu');
        } finally {
          await c.api('/api/nuvem', { acao: 'configurar', url: '', segredo: '' });
          await n.desligar();
        }
      });
      await teste(g, `${nome}: a configuração da migração só completa a da central: o que ela tem fica, inclusive a senha do operador; o resultado sobe`, async () => {
        const CFG = 'config|sistema|geral', segredo = 'segredo-ficticio-aovivo30', n = await ligarNuvemSQLite(porta + 40, segredo, 'token-aovivo30');
        const senhaOp = 'senha-embaralhada-de-teste';
        const donoDaMigracao = async () => { for (let i = 0; i < 3; i++) { try { return await chefe(c, 3); } catch (e) { if (!/pedir/.test(e.message)) throw e; await dormir(61000); } } throw new Error('não conectou'); };
        try {
          await mudarConfig(c, await donoDaMigracao(), (v) => ({ ...v, setoresDesligados: [], operadores: { ...(v.operadores || {}), caldeira: [{ nome: 'Alberto', senha: senhaOp }] } }));
          certo(!(await c.api('/api/nuvem', { acao: 'configurar', url: n.url, segredo })).erro, 'configurar banco local');
          const contexto = { window: {} }; usinaNoContexto(contexto);
          await c.api('/api/nuvem', { acao: 'forms', forms: contexto.window.USINA });
          await c.api('/api/nuvem', { acao: 'enviar' });
          const geracao = n.consultar("SELECT valor FROM info WHERE chave = 'geracao'")[0].valor;
          await n.pedir('/central/enviar', { senha: segredo, corpo: { geracao, registros: [{ id: CFG, data: 'config', prancheta: 'sistema', chave: 'geral', rev: 1000, seq: 1, aparelho: 'migracao-3.0', operador: 'Migração 3.0', criadoEm: 1, atualizadoEm: Date.now(),
            valores: { operadores: { caldeira: ['Alberto', 'Diego'], ralo: ['Jair'] } } }] } });
          const naCentral = async () => (await c.api('/api/registros?desde=0')).registros.find((r) => r.id === CFG);
          let cfg;
          for (let i = 0; i < 60; i++) { await c.api('/api/nuvem', { acao: 'enviar' }); cfg = await naCentral(); if (cfg.valores.operadores.ralo) break; await dormir(500); }
          igual(cfg.valores.operadores.ralo, ['Jair'], 'não completou o que faltava');
          igual(cfg.valores.operadores.caldeira.map((o) => o.nome || o), ['Alberto', 'Diego']);
          igual(cfg.valores.operadores.caldeira[0].senha, senhaOp, 'perdeu a senha do operador');
          certo(Array.isArray(cfg.valores.setoresDesligados), 'perdeu o que a central já tinha');
          const doBanco = () => JSON.parse(n.consultar(`SELECT json FROM registros WHERE id = '${CFG}'`)[0].json);
          for (let i = 0; i < 60 && doBanco().rev <= 1000; i++) { await c.api('/api/nuvem', { acao: 'enviar' }); await dormir(500); }
          igual(doBanco().valores.operadores.caldeira[0].senha, senhaOp, 'a junção não subiu ao banco');
        } finally {
          await c.api('/api/nuvem', { acao: 'configurar', url: '', segredo: '' });
          await n.desligar();
        }
      });
      const dono = await chefe(c, 3), nivel2 = await chefe(c, 2), pessoasConexao = [];
      for (const [i, cargo] of ['administrador', 'encarregado', 'funcionario', 'consulta'].entries()) {
        await teste(g, `${nome}: conexão de ${cargo}: só com a opção ligada na pessoa`, async () => {
          const pin = String(6200 + i);
          let pessoa = { nome: 'Conexão ' + cargo, nivel: cargo, pin, extras: {} };
          const criada = await c.api('/api/pessoas', { acao: 'salvar', pessoa });
          pessoa = criada.pessoas.find((p) => p.nome === pessoa.nome);
          certo(pessoa, 'a pessoa deve ser cadastrada');
          await pedir(nivel2, '/api/pessoas', { acao: 'entrar', pin });
          pessoasConexao.push({ pessoa, pin });
          for (const [extras, esperado] of [[{}, false], [{ conexao: false }, false], [{ conexao: true }, true]]) {
            await c.api('/api/pessoas', { acao: 'salvar', pessoa: { ...pessoa, extras } });
            const quem = await pedir(nivel2, '/api/pessoas', { acao: 'quem' });
            igual(quem.funcoes.includes('conexao'), esperado, JSON.stringify(extras));
          }
        });
      }
      await teste(g, `${nome}: lista do nível não passa por cima da recusa de conexão; dono no nível 3 continua pleno`, async () => {
        const contexto = { window: {} }; usinaNoContexto(contexto);
        // 3.1.8: como a tela de níveis, sem o assistente (é da pessoa e passa pelo nível; a central do tablet recusa a lista com ele até o próximo APK)
        const todas = [...new Set([...contexto.window.USINA.funcoes.map((f) => f.id), 'pessoas', 'chefes'])].filter((f) => f !== 'assistente');
        await mudarConfig(c, dono, (v) => ({ ...v, niveisChefe: { 1: ['conexao', 'relatorios'], 2: todas } }));
        for (const { pessoa, pin } of pessoasConexao.filter((x) => x.pessoa.nivel !== 'administrador')) {
          await c.api('/api/pessoas', { acao: 'salvar', pessoa: { ...pessoa, extras: { conexao: false } } });
          await pedir(nivel2, '/api/pessoas', { acao: 'entrar', pin });
          igual((await pedir(nivel2, '/api/pessoas', { acao: 'quem' })).funcoes.includes('conexao'), false, pessoa.nivel);
        }
        const lista = await c.api('/api/pessoas', { acao: 'lista' });
        const pessoaDono = lista.pessoas.find((p) => p.id === lista.donoId);
        await c.api('/api/pessoas', { acao: 'salvar', pessoa: { ...pessoaDono, extras: { conexao: false } } });
        const quem = await pedir(dono, '/api/pessoas', { acao: 'quem' });
        certo(quem.dono && quem.funcoes.includes('conexao') && quem.funcoes.includes('sistema'), 'dono perdeu funções no nível 3');
      });
      await teste(g, `${nome}: tablet de outro setor não mexe em tabela nova: o setor dela vem da configuração`, async () => {
        await mudarConfig(c, dono, (v) => ({ ...v, folhas: { ...(v.folhas || {}), _tabelas: { t_outro1: { nome: 'Economizador', setor: 'caldeira' } } } }));
        const hoje = diaAntes(0);
        const linha = (i) => ({ id: `${hoje}|t_outro1|${i}`, data: hoje, prancheta: 't_outro1', chave: String(i), valores: { x_a: '1' }, criadoEm: Date.now(), atualizadoEm: Date.now(), operador: 'Teste' });
        // a central aceita 6 conexões por minuto do mesmo endereço, e cada tentativa conta: espera o minuto inteiro
        const conectar = async () => { for (let i = 0; i < 3; i++) { const x = await conectarTeste(c.url, c.codigo()); if (x.pedir) return x; await dormir(61000); } throw new Error('não conectou'); };
        const doRalo = await conectar();
        const recusa = await pedir(doRalo, '/api/sync', { aparelho: doRalo.aparelho, papel: 'ralo', versao: '3.0.0', registros: [linha(8)] });
        igual(recusa.aceitos, 0, 'o tablet do ralo gravou na tabela da caldeira');
        const daCaldeira = await conectar();
        igual((await pedir(daCaldeira, '/api/sync', { aparelho: daCaldeira.aparelho, papel: 'caldeira', versao: '3.0.0', registros: [linha(9)] })).aceitos, 1, 'a caldeira deve gravar na tabela dela');
        await mudarConfig(c, dono, (v) => { const folhas = { ...v.folhas }; delete folhas._tabelas; return { ...v, folhas }; });
      });
      await teste(g, `${nome}: folhas removidas só mudam pelo dono no nível 3 e sobrevivem ao envio de outro chefe`, async () => {
        // Nem o dono no nível 2 pode mudar a estrutura.
        let valores = await mudarConfig(c, cli, (v) => ({ ...v, folhas: { ...(v.folhas || {}), _removidas: ['caldeira'] } }));
        certo(!valores.folhas?._removidas, 'nível 2 removeu uma folha');
        valores = await mudarConfig(c, dono, (v) => ({ ...v, folhas: { ...(v.folhas || {}), _removidas: ['ins_cal'] } }));
        igual(valores.folhas._removidas, ['ins_cal']);
        const outro = nivel2;
        await pedir(outro, '/api/pessoas', { acao: 'entrar', pin: pessoasConexao.find(({ pessoa }) => pessoa.nivel === 'administrador').pin });
        for (const removidas of [[], ['caldeira'], undefined]) {
          valores = await mudarConfig(c, outro, (v) => {
            const folhas = { ...(v.folhas || {}), caldeira: { pressao: { label: 'Pressão de teste' } } };
            if (removidas === undefined) delete folhas._removidas; else folhas._removidas = removidas;
            return { ...v, folhas };
          });
          igual(valores.folhas._removidas, ['ins_cal'], 'o administrador mudou a remoção do dono');
          igual(valores.folhas.caldeira.pressao.label, 'Pressão de teste', 'a mudança comum deveria entrar');
        }
        valores = await mudarConfig(c, dono, (v) => ({ ...v, folhas: { ...v.folhas, _removidas: [] } }));
        igual(valores.folhas._removidas, [], 'o dono não conseguiu restaurar a folha');
      });
    } finally {
      for (const x of aparelhos) await x.fechar().catch(() => {});
      await c.desligar();
    }
  }
} finally { await nav.fechar(); }
const r = resumo([g]);
console.log(`\n${r.passaram} de ${r.total} testes passaram; ${r.falharam} falharam`);
process.exitCode = r.falharam ? 1 : 0;
