/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Versão 2.12, direto na central (as duas: computador e tablet chefe):
 *   - tablet chefe novo precisa ser liberado com uma senha (nível 3 só o dono; 1 ou 2 quem libera tablets chefe);
 *   - nível 1 vê, corrige e envia: a central recusa o resto (rotas, Vinho e Fermentação);
 *   - anotação de tablet chefe pede a função de quem está dentro (sem ninguém dentro, ela espera);
 *   - nível 3 só aceita o dono, e só nele valem as configurações do sistema;
 *   - configuração da usina: quem pode mudar cada parte, conflito pela revisão, propriedades do sistema protegidas;
 *   - tablet de setor não muda os campos do escritório; recuperação do dono com a senha do programador;
 *   - o que a revisão do Codex achou: configuração disfarçada de anotação, permissões vindas das folhas, a senha do
 *     dono num tablet de setor, apagar a configuração, dia arquivado, Base44 e relatório, aplicativo antigo.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import { teste, certo, igual, SENHA_ENCARREGADO } from './teste.mjs';
import { pastaTemporaria, SENHA_PROGRAMADOR_TESTE } from './servidores.mjs';
import { conectarTeste } from './cifra.mjs';

/** As folhas como o aplicativo do tablet chefe manda para a central (a central do tablet só conhece por elas). */
function formsDoApp() {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(new URL('../public/forms.js', import.meta.url), 'utf8'), ctx);
  return JSON.parse(JSON.stringify(ctx.window.USINA));
}
const diaProducao = (diasAntes = 0) => { const d = new Date(Date.now() - 7 * 3600000 - diasAntes * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export async function testarNiveis(ligar, porta, grupo) {
  const c = await ligar(porta, pastaTemporaria('niveis'), {});
  const p = async (cli, rota, corpo) => { const r = await cli.pedir(rota, corpo === undefined ? {} : { corpo }); return Object.assign({ status: r.status }, r.json || {}); };
  const sync = (cli, registros, extra = {}) => p(cli, '/api/sync', Object.assign({ aparelho: cli.aparelho, papel: 'central', nome: 'Tablet chefe', versao: '2.12.0', registros }, extra));
  const reg = (id, valores, extra = {}) => Object.assign({ id, data: id.split('|')[0], prancheta: id.split('|')[1], chave: id.split('|')[2], valores, atualizadoEm: Date.now(), criadoEm: Date.now() }, extra);
  const hoje = diaProducao();
  try {
    const adm = await conectarTeste(c.url, c.codigo());
    const n1 = await conectarTeste(c.url, c.codigo());
    const n3 = await conectarTeste(c.url, c.codigo());
    const setor = await conectarTeste(c.url, c.codigo());

    await teste(grupo, 'tablet chefe novo não entra sem ser liberado; a senha errada não libera', async () => {
      const r = await p(adm, '/api/pessoas', { acao: 'entrar', pin: SENHA_ENCARREGADO });
      igual(r.status, 403); certo(r.naoLiberado, JSON.stringify(r));
      igual((await p(adm, '/api/chefes', { acao: 'liberar', pin: '000000', nivel: 2 })).status, 403);
      igual((await p(adm, '/api/chefes', { acao: 'estado' })).nivel, 0);
    });

    await teste(grupo, 'o dono libera o nível 2; entrando, a central diz o nível e as funções que valem nele', async () => {
      const l = await p(adm, '/api/chefes', { acao: 'liberar', pin: SENHA_ENCARREGADO, nivel: 2 });
      igual(l.status, 200); igual(l.nivel, 2);
      const e = await p(adm, '/api/pessoas', { acao: 'entrar', pin: SENHA_ENCARREGADO });
      igual(e.status, 200); igual(e.nivel, 2); certo(e.dono, 'é o dono');
      certo(e.funcoes.includes('pessoas') && e.funcoes.includes('chefes') && !e.funcoes.includes('sistema'), 'nível 2 sem sistema: ' + e.funcoes);
      // cadastra uma encarregada (não libera tablet chefe) e uma administradora
      igual((await p(adm, '/api/pessoas', { acao: 'salvar', pessoa: { nome: 'Ana', nivel: 'encarregado', pin: '1111' } })).status, 200);
      igual((await p(adm, '/api/pessoas', { acao: 'salvar', pessoa: { nome: 'Bia', nivel: 'administrador', pin: '2222' } })).status, 200);
    });

    await teste(grupo, 'nível 1: só quem libera tablets chefe; a encarregada não; nível 3 só o dono', async () => {
      igual((await p(n1, '/api/chefes', { acao: 'liberar', pin: '1111', nivel: 1 })).status, 403, 'encarregada não libera');
      igual((await p(n1, '/api/chefes', { acao: 'liberar', pin: '2222', nivel: 3 })).status, 403, 'administradora não libera o 3');
      igual((await p(n1, '/api/chefes', { acao: 'liberar', pin: '2222', nivel: 1 })).status, 200, 'administradora libera o 1');
      const e = await p(n1, '/api/pessoas', { acao: 'entrar', pin: '1111' });
      igual(e.status, 200); igual(e.nivel, 1);
      certo(e.funcoes.every((f) => ['corrigir', 'relatorios'].includes(f)) && e.funcoes.includes('corrigir'), 'nível 1: ' + e.funcoes);
    });

    await teste(grupo, 'nível 1: a central recusa trocar o código, registro, nuvem, apagar relatório, pessoas e bloquear', async () => {
      igual((await p(n1, '/api/novo-codigo', {})).status, 403);
      igual((await n1.pedir('/api/registro?dia=' + hoje)).status, 403);
      igual((await p(n1, '/api/nuvem', { acao: 'configurar', url: '' })).status, 403);
      igual((await p(n1, '/api/nuvem', { acao: 'estado' })).status, 200, 'o estado da nuvem continua livre');
      igual((await p(n1, '/api/relatorio-apagar', { data: hoje })).status, 403);
      igual((await p(n1, '/api/pessoas', { acao: 'lista' })).status, 403);
      igual((await p(n1, '/api/aparelhos', { acao: 'bloquear', id: setor.aparelho, modo: 'trava' })).status, 403);
    });

    await teste(grupo, 'nível 1: corrige o que o setor anotou e põe a linha que faltou; Vinho e Fermentação não', async () => {
      // A Hidrólise tem seu próprio aparelho; o fixture de setor abaixo é do Ralo.
      await c.reiniciar(); // nova janela de pareamento para o aparelho da Hidrólise
      const hidrolise = await conectarTeste(c.url, c.codigo());
      await p(hidrolise, '/api/sync', { aparelho: hidrolise.aparelho, papel: 'hidrolise', registros: [reg(`${hoje}|hid_anexo1|1`, { brix: '17' })] });
      const r = await sync(n1, [reg(`${hoje}|hid_anexo1|2`, { brix: '15' }), reg(`${hoje}|hid_anexo1|1`, { brix: '18' }), reg(`${hoje}|med_dornas|fermentacao`, { d7: '1.2' })]);
      igual(r.status, 200);
      igual(JSON.stringify(r.recusados.map((x) => [x.id, x.motivo])), JSON.stringify([[`${hoje}|med_dornas|fermentacao`, 'sem_permissao']]), 'só o Vinho recusado');
      const lista = (await p(adm, '/api/registros?desde=0')).registros;
      certo(lista.find((x) => x.id === `${hoje}|hid_anexo1|1`).valores.brix === '18', 'a correção entrou');
      certo(lista.find((x) => x.id === `${hoje}|hid_anexo1|2`), 'a linha que faltava entrou');
    });

    await teste(grupo, 'nível 3: só o dono entra; só nele valem as configurações do sistema', async () => {
      igual((await p(n3, '/api/chefes', { acao: 'liberar', pin: SENHA_ENCARREGADO, nivel: 3 })).status, 200);
      igual((await p(n3, '/api/pessoas', { acao: 'entrar', pin: '2222' })).status, 403, 'a administradora não entra no 3');
      const e = await p(n3, '/api/pessoas', { acao: 'entrar', pin: SENHA_ENCARREGADO });
      igual(e.status, 200); certo(e.funcoes.includes('sistema'), 'no 3 o dono tem sistema');
    });

    const CFG = 'config|sistema|geral';
    await teste(grupo, 'configuração: o nível 1 não muda; o administrador muda com a revisão certa; cópia velha é conflito', async () => {
      const s1 = await sync(n1, [reg(CFG, { operadores: { hidrolise: ['Felipe'] } }, { base: 0 })]);
      certo(s1.recusados.some((x) => x.id === CFG && x.motivo === 'sem_permissao'), 'nível 1 recusado: ' + JSON.stringify(s1.recusados));
      const a1 = await sync(adm, [reg(CFG, { operadores: { hidrolise: ['Felipe'] } }, { base: 0 })]);
      igual(a1.recusados.length, 0, JSON.stringify(a1.recusados));
      const guardada = (await p(adm, '/api/registros?desde=0')).registros.find((x) => x.id === CFG);
      igual(guardada.rev, 1, 'revisão 1');
      const velha = await sync(adm, [reg(CFG, { operadores: { hidrolise: ['Felipe', 'Carlos'] } }, { base: 0 })]);
      certo(velha.recusados.some((x) => x.id === CFG && x.motivo === 'conflito' && x.atual && x.atual.rev === 1), 'conflito com a atual: ' + JSON.stringify(velha.recusados));
      const certa = await sync(adm, [reg(CFG, { operadores: { hidrolise: ['Felipe', 'Carlos'] } }, { base: 1 })]);
      igual(certa.recusados.length, 0, JSON.stringify(certa.recusados));
    });

    await teste(grupo, 'folhas: vírgula e campos novos só o dono no nível 3; quem não pode não apaga o que ele fez', async () => {
      const rev = () => p(adm, '/api/registros?desde=0').then((x) => x.registros.find((y) => y.id === CFG));
      // no nível 2 (mesmo sendo o dono) a vírgula não entra
      let atual = await rev();
      await sync(adm, [reg(CFG, Object.assign({}, atual.valores, { folhas: { caldeira: { pressao: { dec: 2, label: 'Pressão da caldeira' } } } }), { base: atual.rev })]);
      atual = await rev();
      igual(JSON.stringify(atual.valores.folhas), JSON.stringify({ caldeira: { pressao: { label: 'Pressão da caldeira' } } }), 'o nome entrou, a vírgula não');
      // no nível 3 o dono põe a vírgula e um campo novo
      const novos = [{ id: 'x_teste1', label: 'Temperatura extra', type: 'num', unidade: '°C', dec: 1 }];
      await sync(n3, [reg(CFG, Object.assign({}, atual.valores, { folhas: { caldeira: { pressao: { dec: 2, label: 'Pressão da caldeira' }, _novos: novos } } }), { base: atual.rev })]);
      atual = await rev();
      igual(atual.valores.folhas.caldeira.pressao.dec, 2, 'a vírgula entrou no nível 3');
      igual(atual.valores.folhas.caldeira._novos[0].id, 'x_teste1', 'o campo novo entrou');
      // um aparelho sem o sistema (como o aplicativo antigo) muda só o nome e manda sem a vírgula: ela continua
      await sync(adm, [reg(CFG, Object.assign({}, atual.valores, { folhas: { caldeira: { pressao: { label: 'Pressão' } } } }), { base: atual.rev })]);
      atual = await rev();
      igual(atual.valores.folhas.caldeira.pressao.label, 'Pressão');
      igual(atual.valores.folhas.caldeira.pressao.dec, 2, 'a vírgula do dono continua');
      igual(atual.valores.folhas.caldeira._novos.length, 1, 'o campo novo continua');
    });

    await teste(grupo, 'tablet de setor: não muda os campos do escritório (NF); os ajustes de operadores precisam da senha', async () => {
      igual((await p(adm, '/api/nuvem', { acao: 'forms', forms: formsDoApp() })).status, 200, 'o tablet chefe manda as folhas ao abrir');
      const id = `${hoje}|ins_materia_prima|08`;
      await sync(adm, [reg(id, { qtd: '500', nf: '123' })]);
      await p(setor, '/api/sync', { aparelho: setor.aparelho, papel: 'ralo', registros: [reg(id, { qtd: '600', nf: '999' })] });
      const guardado = (await p(adm, '/api/registros?desde=0')).registros.find((x) => x.id === id);
      igual(guardado.valores.qtd, '600', 'a quantidade (do operador) mudou');
      igual(guardado.valores.nf, '123', 'a NF (do escritório) não mudou');
      const atual = (await p(adm, '/api/registros?desde=0')).registros.find((x) => x.id === CFG);
      const semSenha = await p(setor, '/api/sync', { aparelho: setor.aparelho, papel: 'ralo', registros: [reg(CFG, Object.assign({}, atual.valores, { operadores: { ralo: ['Jair', 'Zé'] } }), { base: atual.rev })] });
      certo(semSenha.recusados.some((x) => x.id === CFG && x.motivo === 'sem_permissao'), 'sem a senha: ' + JSON.stringify(semSenha.recusados));
      igual((await p(setor, '/api/pessoas', { acao: 'verificar', pin: '1111' })).status, 200, 'a encarregada confere a senha no setor');
      const comSenha = await p(setor, '/api/sync', { aparelho: setor.aparelho, papel: 'ralo', registros: [reg(CFG, Object.assign({}, atual.valores, { operadores: { ralo: ['Jair', 'Zé'] } }), { base: atual.rev })] });
      igual(comSenha.recusados.length, 0, 'com a senha: ' + JSON.stringify(comSenha.recusados));
    });

    await teste(grupo, 'anotação disfarçada de configuração (id da configuração com a data de hoje) é recusada', async () => {
      const antes = (await p(adm, '/api/registros?desde=0')).registros.find((x) => x.id === CFG);
      const falsa = { id: CFG, data: hoje, prancheta: 'caldeira', chave: '10', valores: { operadores: {} }, atualizadoEm: Date.now() + 60000, criadoEm: Date.now() };
      const r = await p(setor, '/api/sync', { aparelho: setor.aparelho, papel: 'caldeira', registros: [falsa] });
      certo(r.recusados.some((x) => x.id === CFG && x.motivo === 'invalido'), JSON.stringify(r.recusados));
      const depois = (await p(adm, '/api/registros?desde=0')).registros.find((x) => x.id === CFG);
      igual(JSON.stringify(depois.valores), JSON.stringify(antes.valores), 'a configuração não mudou');
    });

    const cons = await conectarTeste(c.url, c.codigo());
    await teste(grupo, 'as permissões não vêm das folhas que o aplicativo manda (Consulta continua Consulta)', async () => {
      igual((await p(adm, '/api/pessoas', { acao: 'salvar', pessoa: { nome: 'Cris', nivel: 'consulta', pin: '3333' } })).status, 200);
      const falsas = formsDoApp();
      falsas.niveis.consulta.funcoes = ['chefes', 'pessoas', 'sistema', 'usina'];
      igual((await p(adm, '/api/nuvem', { acao: 'forms', forms: falsas })).status, 200);
      igual((await p(cons, '/api/chefes', { acao: 'liberar', pin: '3333', nivel: 2 })).status, 403, 'a Consulta não libera tablet chefe');
      igual((await p(cons, '/api/chefes', { acao: 'liberar', pin: SENHA_ENCARREGADO, nivel: 2 })).status, 200);
      const e = await p(cons, '/api/pessoas', { acao: 'entrar', pin: '3333' });
      igual(JSON.stringify(e.funcoes), JSON.stringify(['relatorios']), 'Consulta só tem relatórios');
      igual((await p(cons, '/api/pessoas', { acao: 'lista' })).status, 403, 'nem vê as pessoas');
      igual((await p(adm, '/api/nuvem', { acao: 'forms', forms: formsDoApp() })).status, 200, 'as folhas de verdade de volta');
    });

    await teste(grupo, 'tablet chefe: anotação pede a função de quem está dentro; sem ninguém dentro ela espera', async () => {
      const id = `${hoje}|caldeira|11`;
      const r1 = await sync(cons, [reg(id, { pressao: '7' })]);
      certo(r1.recusados.some((x) => x.id === id && x.motivo === 'sem_permissao'), 'Consulta: ' + JSON.stringify(r1.recusados));
      igual((await p(cons, '/api/pessoas', { acao: 'sair' })).status, 200);
      const r2 = await sync(cons, [reg(id, { pressao: '7' })]);
      certo(r2.recusados.some((x) => x.id === id && x.motivo === 'sem_sessao'), 'ninguém dentro: ' + JSON.stringify(r2.recusados));
      const r3 = await sync(cons, [reg(`${hoje}|registro|teste1`, { tipo: 'entrada', texto: 'saiu' })]);
      igual(r3.recusados.length, 0, 'o registro do sistema passa sem ninguém dentro');
      igual((await p(cons, '/api/pessoas', { acao: 'entrar', pin: '1111' })).status, 200, 'a encarregada entra');
      const r4 = await sync(cons, [reg(id, { pressao: '7' }), reg(`${hoje}|med_dornas|fermentacao`, { d7: '1.3' })]);
      igual(r4.recusados.length, 0, 'encarregada anota e corrige: ' + JSON.stringify(r4.recusados));
      const r5 = await sync(cons, [reg(`${hoje}|avisos|av1`, { texto: 'teste', paraSetor: 'caldeira' })]);
      igual(r5.recusados.length, 0, 'a encarregada manda aviso');
      const r6 = await p(setor, '/api/sync', { aparelho: setor.aparelho, papel: 'caldeira', registros: [reg(`${hoje}|avisos|av2`, { texto: 'falso' })] });
      certo(r6.recusados.some((x) => x.motivo === 'sem_permissao'), 'aviso não sai do tablet de setor');
    });

    await teste(grupo, 'a senha do dono num tablet de setor abre só os operadores, não as folhas nem as do sistema', async () => {
      igual((await p(setor, '/api/pessoas', { acao: 'verificar', pin: SENHA_ENCARREGADO })).status, 200);
      const cfgAtual = async () => (await p(adm, '/api/registros?desde=0')).registros.find((x) => x.id === CFG);
      const pelo = async (valores, atual) => p(setor, '/api/sync', { aparelho: setor.aparelho, papel: 'ralo', registros: [reg(CFG, Object.assign({}, atual.valores, valores), { base: atual.rev })] });
      let atual = await cfgAtual();
      const folhas = JSON.parse(JSON.stringify(atual.valores.folhas));
      folhas.caldeira.pressao.dec = 0;
      await pelo({ folhas }, atual);
      atual = await cfgAtual();
      igual(atual.valores.folhas.caldeira.pressao.dec, 2, 'a vírgula do dono continua');
      folhas.caldeira.pressao.label = 'Pressão do setor';
      const r = await pelo({ folhas }, atual);
      certo(r.recusados.some((x) => x.id === CFG && x.motivo === 'sem_permissao'), 'nome do quadro pelo setor: ' + JSON.stringify(r.recusados));
      atual = await cfgAtual();
      const r2 = await pelo({ operadores: { ralo: ['Jair'] } }, atual);
      igual(r2.recusados.length, 0, 'operadores pelo setor: ' + JSON.stringify(r2.recusados));
    });

    await teste(grupo, 'nível 2 não apaga a configuração da usina (nem as folhas do dono junto)', async () => {
      const atual = (await p(adm, '/api/registros?desde=0')).registros.find((x) => x.id === CFG);
      const r = await sync(adm, [reg(CFG, atual.valores, { base: atual.rev, apagado: true })]);
      certo(r.recusados.some((x) => x.id === CFG && x.motivo === 'sem_permissao'), JSON.stringify(r.recusados));
      const depois = (await p(adm, '/api/registros?desde=0')).registros.find((x) => x.id === CFG);
      certo(!depois.apagado && depois.valores.folhas.caldeira._novos.length === 1, 'continua com as folhas');
    });

    await teste(grupo, 'dia arquivado: a correção do nível 1 entra e o setor não muda a NF de lá', async () => {
      const antigo = diaProducao(75);
      const idH = `${antigo}|hid_anexo1|1`, idI = `${antigo}|ins_materia_prima|08`;
      await sync(adm, [reg(idH, { brix: '10' }), reg(idI, { qtd: '5', nf: '111' })]);
      const r = await sync(n1, [reg(idH, { brix: '11' }, { atualizadoEm: Date.now() + 1000 })]);
      igual(r.recusados.length, 0, 'nível 1 corrige dia antigo: ' + JSON.stringify(r.recusados));
      await p(setor, '/api/sync', { aparelho: setor.aparelho, papel: 'ralo', registros: [reg(idI, { qtd: '6', nf: '999' }, { atualizadoEm: Date.now() + 2000 })] });
      const dia = (await adm.pedir('/api/registros?dia=' + antigo)).json.registros;
      igual(dia.find((x) => x.id === idH).valores.brix, '11', 'a correção ficou no arquivo');
      const ins = dia.find((x) => x.id === idI);
      igual(ins.valores.qtd, '6'); igual(ins.valores.nf, '111', 'a NF de dia antigo não mudou');
    });

    await teste(grupo, 'relatório e totais do Base44 só saem do tablet chefe liberado', async () => {
      igual((await p(setor, '/api/relatorio', { data: hoje, nome: 'teste.xlsx', base64: '' })).status, 403);
      igual((await p(setor, '/api/base44', { acao: 'enviar', data: hoje, hash: 'x', dados: {} })).status, 403);
      igual((await p(adm, '/api/relatorio', { data: hoje, nome: 'teste.xlsx', base64: '' })).status, 200);
    });

    await teste(grupo, 'aplicativo antigo (sem revisão): vale o que ele podia mudar e a configuração volta para ele', async () => {
      let atual = (await p(adm, '/api/registros?desde=0')).registros.find((x) => x.id === CFG);
      // o setor com a cópia velha das folhas (sem nada do dono) muda os operadores
      const hora = Date.now() + 5000;
      const r = await p(setor, '/api/sync', { aparelho: setor.aparelho, papel: 'ralo', registros: [reg(CFG, { operadores: { ralo: ['Jair', 'Tião'] } }, { atualizadoEm: hora })] });
      igual(r.recusados.length, 0, JSON.stringify(r.recusados));
      atual = (await p(adm, '/api/registros?desde=0')).registros.find((x) => x.id === CFG);
      igual(JSON.stringify(atual.valores.operadores.ralo), JSON.stringify(['Jair', 'Tião']), 'os operadores entraram');
      igual(atual.valores.folhas.caldeira.pressao.dec, 2, 'as folhas do dono continuam');
      certo(atual.atualizadoEm > hora, 'volta para o aparelho com horário mais novo');
      // e apagar, do antigo, também não apaga: ela volta
      await p(setor, '/api/sync', { aparelho: setor.aparelho, papel: 'ralo', registros: [reg(CFG, {}, { apagado: true, atualizadoEm: Date.now() + 9000 })] });
      atual = (await p(adm, '/api/registros?desde=0')).registros.find((x) => x.id === CFG);
      certo(!atual.apagado && atual.valores.folhas.caldeira._novos.length === 1, 'não apagou');
    });

    await teste(grupo, 'o nível que muda vale na hora: quem estava dentro sai', async () => {
      const r = await p(adm, '/api/pessoas', { acao: 'aparelho', id: n1.aparelho, nivel: 2 });
      igual(r.status, 200);
      igual((await p(n1, '/api/pessoas', { acao: 'quem' })).pessoa, null, 'a sessão do nível 1 caiu');
      // a administradora (não é o dono) não põe ninguém no nível 3; o dono põe
      const bia = await conectarTeste(c.url, c.codigo());
      igual((await p(bia, '/api/chefes', { acao: 'liberar', pin: '2222', nivel: 2 })).status, 200);
      igual((await p(bia, '/api/pessoas', { acao: 'entrar', pin: '2222' })).status, 200);
      igual((await p(bia, '/api/pessoas', { acao: 'aparelho', id: n1.aparelho, nivel: 3 })).status, 403, 'a administradora não põe no 3');
      igual((await p(bia, '/api/pessoas', { acao: 'aparelho', id: bia.aparelho, nivel: 1 })).status, 403, 'nem muda o próprio aparelho');
      igual((await p(adm, '/api/pessoas', { acao: 'aparelho', id: n1.aparelho, nivel: 3 })).status, 200, 'o dono põe no 3');
    });

    await teste(grupo, 'recuperar o dono com a senha do programador: este aparelho vira o nível 3 e a senha nova vale', async () => {
      const novo = cons; // um aparelho que já existe (a central limita os aparelhos novos por minuto)
      igual((await p(novo, '/api/chefes', { acao: 'recuperar', senha: '11112222' })).status, 403);
      const r = await p(novo, '/api/chefes', { acao: 'recuperar', senha: SENHA_PROGRAMADOR_TESTE, novaSenha: '7777' });
      igual(r.status, 200); igual(r.nivel, 3);
      igual((await p(adm, '/api/pessoas', { acao: 'quem' })).pessoa, null, 'a sessão antiga do dono caiu');
      igual((await p(novo, '/api/pessoas', { acao: 'entrar', pin: SENHA_ENCARREGADO })).status, 403, 'a senha antiga não vale mais');
      const e = await p(novo, '/api/pessoas', { acao: 'entrar', pin: '7777' });
      igual(e.status, 200); certo(e.dono && e.funcoes.includes('sistema'), JSON.stringify(e));
    });
  } finally {
    await c.desligar();
  }
}
