import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import crypto from 'node:crypto';
import { teste, certo, igual, SENHA_ENCARREGADO } from './teste.mjs';
import { pastaTemporaria } from './servidores.mjs';
import { conectarTeste, clienteCifrado, Cifra } from './cifra.mjs';

export async function testarProducao(ligar, porta, grupo) {
  const c = await ligar(porta, pastaTemporaria('producao215'));
  const p = async (cli, rota, corpo) => {
    const r = await cli.pedir(rota, corpo === undefined ? {} : { corpo });
    return { ...r.json, status: r.status };
  };
  const sync = (cli, registros = [], extra = {}) => p(cli, '/api/sync', { aparelho: cli.aparelho, papel: 'central', registros, ...extra });
  let hora = Date.now();
  const reg = (id, valores, extra = {}) => ({ id, data: id.split('|')[0], prancheta: id.split('|')[1], chave: id.split('|')[2], valores, criadoEm: 1, atualizadoEm: ++hora, ...extra });
  const CFG = 'config|sistema|geral';
  const cfgDisco = () => JSON.parse(fs.readFileSync(path.join(c.pastaServidor, 'config.json'), 'utf8'));
  const entrar = async (cli, nivel, pin = SENHA_ENCARREGADO) => {
    igual((await p(cli, '/api/chefes', { acao: 'liberar', pin: SENHA_ENCARREGADO, nivel })).status, 200);
    igual((await p(cli, '/api/pessoas', { acao: 'entrar', pin })).status, 200);
  };
  const funcoes = async (cli) => (await p(cli, '/api/pessoas', { acao: 'quem' })).funcoes;
  let dono, outroDono, chefe, setor, n1, consulta;
  const cfgAtual = async () => (await p(dono, '/api/registros?desde=0')).registros.find((r) => r.id === CFG);
  const configurar = async (cli, niveisChefe, extra = {}) => {
    const atual = await cfgAtual();
    return sync(cli, [reg(CFG, { ...(atual?.valores || {}), niveisChefe }, { base: atual?.rev || 0, ...extra })]);
  };
  const todas = ['anotar', 'corrigir', 'avisos', 'relatorios', 'ler_folha', 'usina', 'folhas', 'conexao', 'integracoes', 'ajustes', 'registro', 'chefes', 'escritorio', 'pessoas'];
  const padrao = { 1: ['corrigir', 'relatorios', 'escritorio'], 2: todas.filter((f) => f !== 'conexao') };
  let pendente, codigoAntes, chaveAntes;
  try {
    dono = await conectarTeste(c.url, c.codigo());
    outroDono = await conectarTeste(c.url, c.codigo());
    chefe = await conectarTeste(c.url, c.codigo());
    setor = await conectarTeste(c.url, c.codigo());
    n1 = await conectarTeste(c.url, c.codigo());
    consulta = await conectarTeste(c.url, c.codigo());
    await entrar(dono, 3); await entrar(outroDono, 3); await entrar(chefe, 2); await entrar(n1, 1);
    await p(dono, '/api/pessoas', { acao: 'salvar', pessoa: { nome: 'Leitura de teste', nivel: 'consulta', extras: { ler_folha: true }, pin: '3333' } });
    await entrar(consulta, 2, '3333');
    const ctx = { window: {} };
    vm.runInNewContext(fs.readFileSync(new URL('../public/forms.js', import.meta.url), 'utf8'), ctx);
    await p(dono, '/api/nuvem', { acao: 'forms', forms: JSON.parse(JSON.stringify(ctx.window.USINA)) });

    await teste(grupo, 'padrões: nível 1 inclui escritório; nível 2 não tem conexão nem sistema; nível 3 mantém tudo', async () => {
      igual((await funcoes(n1)).sort(), [...padrao[1]].sort());
      certo(!(await funcoes(chefe)).includes('conexao') && !(await funcoes(chefe)).includes('sistema'), 'nível 2 limitado');
      certo((await funcoes(dono)).includes('sistema') && (await funcoes(dono)).includes('conexao'), 'dono completo');
      igual((await p(chefe, '/api/novo-codigo', {})).status, 403);
    });
    await teste(grupo, 'só sistema configura níveis; setor e nível 2 não elevam permissões', async () => {
      igual((await configurar(chefe, padrao)).recusados[0].motivo, 'sem_permissao');
      await p(setor, '/api/pessoas', { acao: 'verificar', pin: SENHA_ENCARREGADO });
      igual((await configurar(setor, padrao)).recusados[0].motivo, 'sem_permissao');
      igual((await configurar(dono, padrao)).recusados.length, 0);
    });
    await teste(grupo, 'níveis recusam tipos, níveis extras, funções desconhecidas, repetidas e sistema', async () => {
      for (const n of [null, [], { 1: [] }, { 1: [], 2: [], 3: [] }, { 1: 'corrigir', 2: [] }, { 1: ['inexistente'], 2: [] }, { 1: ['sistema'], 2: [] }, { 1: ['corrigir', 'corrigir'], 2: [] }, { 1: [1], 2: [] }]) {
        igual((await configurar(dono, n)).recusados[0].motivo, 'invalido');
      }
    });
    await teste(grupo, 'configuração vale na sessão existente, intersecta pessoa e permite nível vazio', async () => {
      igual((await configurar(dono, { 1: [], 2: ['relatorios', 'escritorio', 'conexao'] })).recusados.length, 0);
      igual(await funcoes(n1), []);
      igual(await funcoes(consulta), ['relatorios']);
      igual((await funcoes(chefe)).sort(), ['conexao', 'escritorio', 'relatorios']);
      igual((await configurar(dono, padrao)).recusados.length, 0);
    });
    await teste(grupo, 'teto limita inclusive administrador nos níveis 1 e 2; nível 3 continua igual', async () => {
      for (const cli of [chefe, n1, dono]) await p(dono, '/api/pessoas', { acao: 'aparelho', id: cli.aparelho, teto: ['relatorios'] });
      igual(await funcoes(chefe), ['relatorios']); igual(await funcoes(n1), ['relatorios']);
      certo((await funcoes(dono)).includes('sistema'), 'dono mantém acesso no 3');
      for (const cli of [chefe, n1, dono]) await p(dono, '/api/pessoas', { acao: 'aparelho', id: cli.aparelho, teto: null });
    });
    await teste(grupo, 'aplicativo antigo não apaga níveis; revisão velha é recusada', async () => {
      const atual = await cfgAtual();
      igual((await sync(chefe, [reg(CFG, { operadores: {} })])).recusados.length, 0);
      igual((await cfgAtual()).valores.niveisChefe, padrao);
      igual((await configurar(dono, padrao, { base: atual.rev })).recusados[0].motivo, 'conflito');
    });
    await teste(grupo, 'configuração usa revisão, sem ressuscitar permissões pelo relógio de outro aparelho', async () => {
      await configurar(dono, { 1: padrao[1], 2: todas }, { aparelho: 'origem-a', criadoEm: 100, atualizadoEm: Date.now() + 60000 });
      igual((await configurar(dono, padrao, { aparelho: 'origem-b', criadoEm: 200 })).recusados.length, 0);
      igual((await cfgAtual()).valores.niveisChefe, padrao);
      certo(!(await funcoes(chefe)).includes('conexao'), 'a permissão revogada não voltou');
    });
    await teste(grupo, 'pedido recusado de mudança de nível não altera nome nem teto em memória', async () => {
      await p(dono, '/api/pessoas', { acao: 'salvar', pessoa: { nome: 'Administradora de teste', nivel: 'administrador', pin: '4444' } });
      await p(chefe, '/api/pessoas', { acao: 'entrar', pin: '4444' });
      const antes = JSON.stringify(cfgDisco().aparelhosChefe[dono.aparelho]);
      const r = await p(chefe, '/api/pessoas', { acao: 'aparelho', id: dono.aparelho, nivel: 1, nome: 'Recusado', teto: [] });
      igual(r.status, 403);
      const lista = await p(dono, '/api/pessoas', { acao: 'lista' });
      igual(JSON.stringify(lista.aparelhos[dono.aparelho]), antes);
      await p(chefe, '/api/pessoas', { acao: 'entrar', pin: SENHA_ENCARREGADO });
    });
    await teste(grupo, 'relatórios lê todos os setores e dias arquivados; ler_folha sozinho não corrige', async () => {
      for (const dia of ['2020-01-01', new Date().toISOString().slice(0, 10)]) {
        const ids = [`${dia}|caldeira|10`, `${dia}|hid_anexo1|1`];
        igual((await sync(dono, ids.map((id) => reg(id, { valor: '10' })))).recusados.length, 0);
        const lista = (await p(consulta, '/api/registros?dia=' + dia)).registros;
        certo(ids.every((id) => lista.some((r) => r.id === id)), 'todos os setores no dia');
        igual((await sync(consulta, [reg(ids[0], { valor: '99' })])).recusados[0].motivo, 'sem_permissao');
        igual((await sync(n1, [reg(ids[0], { valor: '11' })])).recusados.length, 0);
      }
    });
    await teste(grupo, 'escritório central respeita teto e a rota antiga do escritório continua aceita', async () => {
      const anotacao = () => reg('2020-01-02|rastreamento|lote', { lote: 'teste' });
      igual((await sync(n1, [anotacao()])).recusados.length, 0);
      await p(dono, '/api/pessoas', { acao: 'aparelho', id: n1.aparelho, teto: ['relatorios'] });
      igual((await sync(n1, [anotacao()])).recusados[0].motivo, 'sem_permissao');
      await p(dono, '/api/pessoas', { acao: 'aparelho', id: n1.aparelho, teto: null });
      igual((await sync(setor, [anotacao()], { papel: 'escritorio' })).recusados.length, 0);
    });
    await teste(grupo, 'sync não falsifica a identidade de outro aparelho na lista', async () => {
      await sync(dono, [], { nome: 'Dono verdadeiro' });
      await sync(setor, [], { aparelho: dono.aparelho, nome: 'Nome falsificado', papel: 'escritorio' });
      const lista = (await p(dono, '/api/status')).aparelhos;
      igual(lista.find((a) => a.id === dono.aparelho).nome, 'Dono verdadeiro');
    });
    const hoje = new Date().toISOString().slice(0, 10);
    const folha = (pid, chave, extra = {}) => reg(hoje + '|' + pid + '|' + chave, { valor: '10' }, extra);
    let tabletSetor;
    await c.reiniciar(); // nova janela de pareamento para os seis aparelhos dos cenários de setor
    await teste(grupo, 'setor: mapa inteiro aceita só suas folhas e ignora setor e aparelho forjados no registro', async () => {
      for (const s of ctx.window.USINA.setores.filter((s) => !s.soChefe)) {
        const cli = await conectarTeste(c.url, c.codigo());
        for (const pid of s.pranchetas) igual((await sync(cli, [folha(pid, 'permitida')], { papel: s.id })).recusados.length, 0);
        const outra = s.id === 'caldeira' ? 'hid_anexo1' : 'caldeira';
        const r = await sync(cli, [folha(outra, 'forjada', { setor: s.id, aparelho: dono.aparelho })], { papel: s.id, aparelho: dono.aparelho });
        igual(r.recusados[0].motivo, 'sem_permissao');
        igual(cfgDisco().setoresAparelhos[cli.aparelho].atual, s.id);
        if (s.id === 'caldeira') tabletSetor = cli;
      }
    });
    await teste(grupo, 'setor: papel trocado ou ausente não libera outra folha, inclusive fila sem corpo.aparelho', async () => {
      for (const papel of ['hidrolise', 'central', 'escritorio', 'inexistente', null]) {
        igual((await sync(tabletSetor, [folha('hid_anexo1', 'invasao')], { papel, aparelho: '' })).recusados[0].motivo, 'sem_permissao');
      }
      igual((await sync(tabletSetor, [folha('caldeira', 'fila')], { papel: null, aparelho: '' })).recusados.length, 0);
      igual(cfgDisco().setoresAparelhos[tabletSetor.aparelho].atual, 'caldeira');
    });
    await teste(grupo, 'setor: aparelho antigo sem vínculo adota declaração; folhas fora dos setores mantêm a regra', async () => {
      const cli = await conectarTeste(c.url, c.codigo());
      await sync(cli);
      certo(!cfgDisco().setoresAparelhos[cli.aparelho], 'antigo ainda sem setor');
      igual((await sync(cli, [folha('hid_anexo1', 'migrada')], { papel: 'hidrolise' })).recusados.length, 0);
      igual(cfgDisco().setoresAparelhos[cli.aparelho].atual, 'hidrolise');
      igual((await sync(cli, [folha('avisos-recibo', 'recibo'), folha('med_dornas', 'pendente-chefe')], { papel: 'hidrolise' })).recusados.length, 0);
    });
    await teste(grupo, 'setor: senha sem ajustes/usina não troca; troca autorizada conserva só pendências anteriores', async () => {
      await p(tabletSetor, '/api/pessoas', { acao: 'verificar', pin: '3333' });
      igual((await sync(tabletSetor, [folha('hid_anexo1', 'sem-funcao')], { papel: 'hidrolise' })).recusados[0].motivo, 'sem_permissao');
      await p(tabletSetor, '/api/pessoas', { acao: 'verificar', pin: SENHA_ENCARREGADO });
      const pendente = folha('caldeira', 'antes-troca', { atualizadoEm: Date.now() - 1000 });
      igual((await sync(tabletSetor, [pendente, folha('hid_anexo1', 'apos-troca')], { papel: 'hidrolise' })).recusados.length, 0);
      const salvo = cfgDisco().setoresAparelhos[tabletSetor.aparelho];
      igual(salvo.atual, 'hidrolise');
      igual((await sync(tabletSetor, [folha('caldeira', 'nova-indevida', { atualizadoEm: salvo.anteriores.caldeira + 1 })], { papel: 'hidrolise' })).recusados[0].motivo, 'sem_permissao');
      await c.reiniciar();
      igual((await sync(tabletSetor, [pendente], { papel: 'hidrolise' })).recusados.length, 0, 'pendência depois do reinício');
      igual((await sync(tabletSetor, [folha('caldeira', 'volta-sem-senha', { atualizadoEm: Date.now() })], { papel: 'caldeira' })).recusados[0].motivo, 'sem_permissao');
    });
    await teste(grupo, 'setor: falha ao persistir troca não concede setor em memória nem no disco', async () => {
      await p(tabletSetor, '/api/pessoas', { acao: 'verificar', pin: SENHA_ENCARREGADO });
      const antes = cfgDisco().setoresAparelhos[tabletSetor.aparelho];
      const tmp = path.join(c.pastaServidor, 'config.json.tmp');
      fs.mkdirSync(tmp);
      try { igual((await sync(tabletSetor, [], { papel: 'ralo' })).status, 400); }
      finally { fs.rmdirSync(tmp); }
      igual(cfgDisco().setoresAparelhos[tabletSetor.aparelho], antes);
      igual((await sync(tabletSetor, [folha('ins_materia_prima', 'falha-troca')], { papel: 'hidrolise' })).recusados[0].motivo, 'sem_permissao');
    });
    await teste(grupo, 'setor: cada função ajustes ou usina autoriza a troca; permissão revogada deixa de autorizar', async () => {
      for (const [funcao, pin, destino] of [['ajustes', '7777', 'ralo'], ['usina', '8888', 'destilaria']]) {
        await p(dono, '/api/pessoas', { acao: 'salvar', pessoa: { nome: funcao, nivel: 'consulta', pin, extras: { [funcao]: true } } });
        await p(tabletSetor, '/api/pessoas', { acao: 'verificar', pin });
        await sync(tabletSetor, [], { papel: destino });
        igual(cfgDisco().setoresAparelhos[tabletSetor.aparelho].atual, destino);
        const pessoa = cfgDisco().pessoas.find((x) => x.nome === funcao);
        await p(dono, '/api/pessoas', { acao: 'salvar', pessoa: { ...pessoa, extras: {} } });
        await sync(tabletSetor, [], { papel: 'nova_destilaria' });
        igual(cfgDisco().setoresAparelhos[tabletSetor.aparelho].atual, destino);
      }
    });
    const arquivoRelatorio = { data: hoje, nome: 'seguranca.csv', base64: Buffer.from('arquivo protegido').toString('base64') };
    const loginWeb = async (cli, acao = 'entrar', pin = '3333') => {
      const { corpo, iv } = await Cifra.pedido(cli.chave, cli.aparelho, 'POST', 'api/pessoas', JSON.stringify({ acao, pin }), Date.now());
      const r = await fetch(c.url + '/api/c?a=' + cli.aparelho, { method: 'POST', body: corpo });
      igual(r.status, 200, 'pedido cifrado aceito');
      const resposta = await Cifra.resposta(cli.chave, iv, new Uint8Array(await r.arrayBuffer()));
      return { status: resposta.status, cookie: r.headers.get('set-cookie') || '' };
    };
    const comCookie = (cookie) => ({ headers: { Cookie: cookie.split(';')[0] } });
    const urlArquivo = c.url + '/relatorios/' + hoje + '/seguranca.csv';
    let cookieEscritorio;
    await teste(grupo, 'relatórios: login cifrado emite cookie HttpOnly de 30 min; página e arquivo exigem cookie', async () => {
      igual((await p(dono, '/api/relatorio', arquivoRelatorio)).status, 200);
      const login = await loginWeb(consulta);
      igual(login.status, 200); cookieEscritorio = login.cookie;
      certo(['HttpOnly', 'SameSite=Strict', 'Path=/relatorios', 'Max-Age=1800'].every((x) => cookieEscritorio.includes(x)), 'cookie curto e restrito');
      for (const rota of ['/relatorios', '/relatorios/', '/relatorios/' + hoje + '/seguranca.csv']) {
        const sem = await fetch(c.url + rota);
        igual(sem.status, 401); igual(sem.headers.get('cache-control'), 'no-store');
        const com = await fetch(c.url + rota, comCookie(cookieEscritorio));
        igual(com.status, 200); igual(com.headers.get('cache-control'), 'no-store');
        const texto = await com.text();
        certo(rota.endsWith('.csv') ? texto === 'arquivo protegido' : texto.includes('seguranca.csv'), 'conteúdo protegido disponível');
      }
    });
    await teste(grupo, 'relatórios: senha errada não emite cookie; função e teto revogados negam cookie já emitido', async () => {
      const errado = await loginWeb(consulta, 'entrar', '0000');
      igual(errado.status, 403); certo(!errado.cookie, 'sem cookie na senha errada');
      const pessoa = cfgDisco().pessoas.find((x) => x.nome === 'Leitura de teste');
      await p(dono, '/api/pessoas', { acao: 'salvar', pessoa: { ...pessoa, extras: { relatorios: false } } });
      igual((await fetch(urlArquivo, comCookie(cookieEscritorio))).status, 401);
      await p(dono, '/api/pessoas', { acao: 'salvar', pessoa });
      await p(dono, '/api/pessoas', { acao: 'aparelho', id: consulta.aparelho, teto: [] });
      igual((await fetch(urlArquivo, comCookie(cookieEscritorio))).status, 401);
      await p(dono, '/api/pessoas', { acao: 'aparelho', id: consulta.aparelho, teto: null });
      igual((await fetch(urlArquivo, comCookie(cookieEscritorio))).status, 200);
    });
    await teste(grupo, 'relatórios: sair limpa cookie e invalida cópia; novo login e bloqueio não reaproveitam a sessão anterior', async () => {
      const saiu = await loginWeb(consulta, 'sair');
      igual(saiu.status, 200); certo(saiu.cookie.includes('Max-Age=0'), 'cookie apagado ao sair');
      igual((await fetch(urlArquivo, comCookie(cookieEscritorio))).status, 401);
      const novo = await loginWeb(consulta);
      igual((await fetch(urlArquivo, comCookie(cookieEscritorio))).status, 401, 'login novo não revalida o antigo');
      cookieEscritorio = novo.cookie;
      igual((await fetch(urlArquivo, comCookie(cookieEscritorio))).status, 200);
      await p(dono, '/api/aparelhos', { acao: 'bloquear', id: consulta.aparelho, modo: 'trava' });
      igual((await fetch(urlArquivo, comCookie(cookieEscritorio))).status, 401);
      await p(dono, '/api/aparelhos', { acao: 'desbloquear', id: consulta.aparelho });
      igual((await fetch(urlArquivo, comCookie(cookieEscritorio))).status, 401);
      cookieEscritorio = (await loginWeb(consulta)).cookie;
    });
    await teste(grupo, 'relatórios: pessoa inativa não usa cookie; quem renova acesso apenas com função e sessão atuais', async () => {
      const pessoa = cfgDisco().pessoas.find((x) => x.nome === 'Leitura de teste');
      await p(dono, '/api/pessoas', { acao: 'salvar', pessoa: { ...pessoa, ativo: false } });
      igual((await fetch(urlArquivo, comCookie(cookieEscritorio))).status, 401);
      const semSessao = await loginWeb(consulta, 'quem');
      certo(semSessao.cookie.includes('Max-Age=0'), 'sem sessão não cria acesso web');
      await p(dono, '/api/pessoas', { acao: 'salvar', pessoa });
      await loginWeb(consulta);
      cookieEscritorio = (await loginWeb(consulta, 'quem')).cookie;
      igual((await fetch(urlArquivo, comCookie(cookieEscritorio))).status, 200);
    });
    await teste(grupo, 'relatórios: assinatura alterada e cookie vencido com assinatura válida são recusados', async () => {
      const token = cookieEscritorio.split(';')[0];
      const adulterado = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
      igual((await fetch(urlArquivo, comCookie(adulterado))).status, 401);
      const payload = JSON.parse(Buffer.from(token.split('=')[1].split('.')[0], 'hex').toString('utf8'));
      payload.ate = Date.now() - 1;
      const hex = Buffer.from(JSON.stringify(payload)).toString('hex');
      // Assina só com a chave da central temporária para exercitar a expiração real, sem esperar 30 minutos.
      const assinatura = crypto.createHmac('sha256', c.chave()).update('relatorios|' + hex).digest('hex');
      igual((await fetch(urlArquivo, comCookie('usina_relatorios=' + hex + '.' + assinatura))).status, 401);
      await c.reiniciar();
      igual((await fetch(urlArquivo, comCookie(cookieEscritorio))).status, 200, 'reinício conserva o prazo, sem alongá-lo');
    });
    await teste(grupo, 'envios automáticos: valem o nível e o teto do aparelho, mesmo sem ninguém dentro; autorizado chega ao destino', async () => {
      let recebidos = 0;
      const destino = http.createServer((req, res) => { req.resume(); recebidos++; res.end('{}'); });
      await new Promise((resolve) => destino.listen(0, '127.0.0.1', resolve));
      const base44 = { acao: 'enviar', data: hoje, hash: 'seguranca', dados: { teste: true }, forcar: true };
      const negarEnvios = async (cli) => {
        igual((await p(cli, '/api/base44', base44)).status, 403);
        igual((await p(cli, '/api/relatorio', arquivoRelatorio)).status, 403);
        igual(recebidos, 0);
      };
      try {
        igual((await p(dono, '/api/base44', { acao: 'configurar', url: 'http://127.0.0.1:' + destino.address().port + '/totais' })).status, 200);
        await p(dono, '/api/pessoas', { acao: 'aparelho', id: chefe.aparelho, teto: [] });
        await negarEnvios(chefe);
        await p(dono, '/api/pessoas', { acao: 'aparelho', id: chefe.aparelho, teto: null });
        // o tablet chefe manda sozinho (relatório das 07:05 e totais) sem ninguém dentro: às 07:05 o turno virou
        await p(chefe, '/api/pessoas', { acao: 'sair' });
        igual((await p(chefe, '/api/base44', base44)).status, 200, 'totais sem ninguém dentro');
        igual((await p(chefe, '/api/relatorio', arquivoRelatorio)).status, 200, 'relatório sem ninguém dentro');
        await p(dono, '/api/pessoas', { acao: 'salvar', pessoa: { nome: 'Sem envios', nivel: 'consulta', pin: '6666', extras: { relatorios: false } } });
        await p(chefe, '/api/pessoas', { acao: 'entrar', pin: '6666' });
        igual((await p(chefe, '/api/relatorio', arquivoRelatorio)).status, 200, 'o aparelho pode, mesmo com quem não tem a função');
        recebidos = 0;
        await p(chefe, '/api/pessoas', { acao: 'entrar', pin: SENHA_ENCARREGADO });
        await configurar(dono, { 1: [], 2: [] });
        await negarEnvios(chefe);
        await configurar(dono, padrao);
        igual((await p(n1, '/api/base44', base44)).status, 403, 'nível 1 não tem Integrações');
        igual((await p(n1, '/api/relatorio', arquivoRelatorio)).status, 200, 'nível 1 tem Relatórios');
        igual((await p(chefe, '/api/base44', base44)).status, 200); igual(recebidos, 1);
        igual((await p(chefe, '/api/relatorio', arquivoRelatorio)).status, 200);
      } finally {
        await p(dono, '/api/base44', { acao: 'configurar', url: '' });
        await new Promise((resolve) => destino.close(resolve));
      }
    });

    await teste(grupo, 'sync confirmado já está no disco e sobrevive a desligamento imediato', async () => {
      const id = new Date().toISOString().slice(0, 10) + '|caldeira|duravel';
      igual((await sync(dono, [reg(id, { valor: 'salvo' })])).status, 200);
      certo(JSON.parse(fs.readFileSync(path.join(c.pastaServidor, 'registros.json'), 'utf8')).registros[id], 'registro já persistido');
      await c.reiniciar();
      certo((await p(dono, '/api/registros?desde=0')).registros.some((r) => r.id === id), 'sobreviveu ao reinício');
    });
    await teste(grupo, 'arquivo histórico danificado não vira lista vazia nem é sobrescrito', async () => {
      const arquivo = path.join(c.pastaBackup, '2020-01-03.json');
      fs.writeFileSync(arquivo, '[arquivo incompleto');
      igual((await sync(dono, [reg('2020-01-03|caldeira|10', { valor: 'novo' })])).status, 400);
      igual(fs.readFileSync(arquivo, 'utf8'), '[arquivo incompleto');
      igual((await p(dono, '/api/registros?dia=2020-01-03')).status, 400);
      fs.unlinkSync(arquivo);
    });
    await teste(grupo, 'falha na gravação não confirma sync nem troca de código; arquivo anterior permanece', async () => {
      for (const nome of ['registros.json', 'config.json']) {
        const arquivo = path.join(c.pastaServidor, nome);
        const tmp = arquivo + '.tmp';
        const antes = fs.readFileSync(arquivo);
        fs.mkdirSync(tmp);
        try {
          const r = nome === 'config.json' ? await p(dono, '/api/novo-codigo', {}) : await sync(dono, [reg(new Date().toISOString().slice(0, 10) + '|caldeira|falha', { valor: 'teste' })]);
          igual(r.status, 400);
          certo(fs.readFileSync(arquivo).equals(antes), 'arquivo anterior preservado');
        } finally { fs.rmdirSync(tmp); }
        igual((await sync(dono)).status, 200, 'aparelho continua conectado');
      }
    });
    const falharConfig = async (acao) => {
      const arquivo = path.join(c.pastaServidor, 'config.json');
      const antes = fs.readFileSync(arquivo);
      const lista = await p(dono, '/api/pessoas', { acao: 'lista' });
      const sessao = await p(chefe, '/api/pessoas', { acao: 'quem' });
      fs.mkdirSync(arquivo + '.tmp');
      try {
        igual((await acao()).status, 400, 'falha devolvida ao aparelho');
        certo(fs.readFileSync(arquivo).equals(antes), 'config anterior preservada');
        igual(await p(dono, '/api/pessoas', { acao: 'lista' }), lista, 'pessoas e permissões desfeitas');
        igual(await p(chefe, '/api/pessoas', { acao: 'quem' }), sessao, 'sessão desfeita');
      } finally { fs.rmdirSync(arquivo + '.tmp'); }
    };
    await teste(grupo, 'falha em pessoas desfaz cadastro, edição e sessões em memória', async () => {
      await falharConfig(() => p(dono, '/api/pessoas', { acao: 'salvar', pessoa: { nome: 'Não gravada', nivel: 'consulta', pin: '5555' } }));
      const pessoa = cfgDisco().pessoas.find((x) => x.nome === 'Administradora de teste');
      await falharConfig(() => p(dono, '/api/pessoas', { acao: 'salvar', pessoa: { ...pessoa, nome: 'Não editada', ativo: false } }));
      await falharConfig(() => p(chefe, '/api/pessoas', { acao: 'sair' }));
      await falharConfig(() => p(chefe, '/api/pessoas', { acao: 'entrar', pin: '4444' }));
      await falharConfig(() => p(dono, '/api/pessoas', { acao: 'aparelho', id: chefe.aparelho, nome: 'Não renomeado', teto: [], nivel: 1 }));
      await falharConfig(() => p(chefe, '/api/chefes', { acao: 'liberar', pin: SENHA_ENCARREGADO, nivel: 1 }));
    });
    await teste(grupo, 'falha em bloqueio e desbloqueio mantém revisão, bloqueio e sessão anteriores', async () => {
      await sync(chefe);
      await falharConfig(() => p(dono, '/api/aparelhos', { acao: 'bloquear', id: chefe.aparelho, modo: 'trava' }));
      igual((await sync(chefe)).status, 200, 'bloqueio recusado não ficou em memória');
      igual((await p(dono, '/api/aparelhos', { acao: 'bloquear', id: setor.aparelho, modo: 'senha', codigo: '5678' })).status, 200);
      const antes = cfgDisco().bloqueios[setor.aparelho];
      await falharConfig(() => p(dono, '/api/aparelhos', { acao: 'desbloquear', id: setor.aparelho }));
      igual((await sync(setor)).status, 423);
      await falharConfig(() => p(setor, '/api/liberar', { codigo: '5678', rev: antes.rev, geracao: cfgDisco().geracao }));
      igual((await sync(setor)).status, 423);
      certo(JSON.stringify(cfgDisco().bloqueios[setor.aparelho]) === JSON.stringify(antes), 'bloqueio anterior preservado');
      igual((await p(dono, '/api/aparelhos', { acao: 'desbloquear', id: setor.aparelho })).status, 200);
      await c.reiniciar();
      igual((await sync(chefe)).status, 200);
    });
    await teste(grupo, 'falha ao guardar a cópia anterior não substitui config, banco ou backup', async () => {
      for (const nome of ['config.json', 'registros.json']) {
        const arquivo = path.join(c.pastaServidor, nome);
        const antes = fs.readFileSync(arquivo), bak = fs.readFileSync(arquivo + '.bak');
        fs.mkdirSync(arquivo + '.bak.tmp');
        try {
          const r = nome === 'config.json' ? await p(dono, '/api/novo-codigo', {}) : await sync(dono, [reg(new Date().toISOString().slice(0, 10) + '|caldeira|falha-backup', { valor: 'recusado' })]);
          igual(r.status, 400);
          certo(fs.readFileSync(arquivo).equals(antes) && fs.readFileSync(arquivo + '.bak').equals(bak), 'principal e backup preservados');
        } finally { fs.rmdirSync(arquivo + '.bak.tmp'); }
        igual((await sync(dono)).status, 200);
      }
    });
    await teste(grupo, 'troca delegada mantém os dois níveis 3 e desconecta os demais pela chave antiga', async () => {
      await configurar(dono, { 1: padrao[1], 2: todas });
      codigoAntes = c.codigo(); chaveAntes = c.chave();
      const r = await p(chefe, '/api/novo-codigo', {});
      igual(r.status, 200); chefe.chave = r.chave;
      const s = await sync(dono); igual(s.status, 200); pendente = s.codigoTrocado;
      igual(Object.keys(pendente).sort(), ['aparelho', 'em', 'id', 'quem']);
      igual((await sync(outroDono)).codigoTrocado, pendente);
      igual((await sync(setor)).status, 401); igual((await sync(n1)).status, 401);
      certo(!(await sync(chefe)).codigoTrocado, 'nível 2 não recebe pendência');
      const disk = cfgDisco(); certo(disk.codigoAnterior === codigoAntes && disk.chaveAnterior === chaveAntes, 'anteriores guardados apenas na config');
    });
    await teste(grupo, 'pendência sobrevive ao reinício, não vaza segredos e não pode ser substituída pelo nível 2', async () => {
      await c.reiniciar();
      igual((await sync(dono)).codigoTrocado, pendente);
      igual((await p(chefe, '/api/novo-codigo', {})).status, 409);
      igual((await p(chefe, '/api/codigo-trocado', { id: pendente.id, acao: 'voltar' })).status, 403);
      igual((await p(dono, '/api/codigo-trocado', { id: 'velho', acao: 'manter' })).status, 409);
      igual((await p(dono, '/api/codigo-trocado', { id: pendente.id, acao: 'invalida' })).status, 400);
      igual((await sync(dono, [], { geracao: 'geracao-antiga' })).codigoTrocado, pendente);
      const publico = JSON.stringify(await sync(dono));
      certo(!publico.includes(chaveAntes) && !publico.includes(codigoAntes) && !publico.includes('chaveAnterior'), 'sync sem segredos anteriores');
    });
    await teste(grupo, 'chave anterior continua sujeita ao bloqueio e decisão exige sessão do dono', async () => {
      await p(chefe, '/api/aparelhos', { acao: 'bloquear', id: outroDono.aparelho, modo: 'trava' });
      igual((await sync(outroDono)).status, 423);
      await p(chefe, '/api/aparelhos', { acao: 'desbloquear', id: outroDono.aparelho });
      igual((await p(outroDono, '/api/codigo-trocado', { id: pendente.id, acao: 'voltar', aparelho: dono.aparelho })).status, 403);
      igual((await p(outroDono, '/api/pessoas', { acao: 'entrar', pin: SENHA_ENCARREGADO })).status, 200);
    });
    await teste(grupo, 'voltar restaura código e chave; novo código cai; decisão repetida é recusada', async () => {
      const r = await p(dono, '/api/codigo-trocado', { id: pendente.id, acao: 'voltar' });
      igual(r.status, 200); dono.chave = r.chave;
      certo(c.codigo() === codigoAntes && c.chave() === chaveAntes, 'rede anterior restaurada');
      igual((await sync(chefe)).status, 401); igual((await sync(setor)).status, 200);
      igual((await sync(outroDono)).status, 200);
      igual((await p(dono, '/api/codigo-trocado', { id: pendente.id, acao: 'voltar' })).status, 409);
      const cfg = cfgDisco(); certo(!cfg.codigoTrocado && !cfg.codigoAnterior && !cfg.chaveAnterior, 'pendência limpa');
      chefe = await conectarTeste(c.url, c.codigo(), chefe.aparelho);
    });
    await teste(grupo, 'manter entrega a chave atual ao dono e encerra o acesso pela chave anterior', async () => {
      const r = await p(chefe, '/api/novo-codigo', {}); igual(r.status, 200); chefe.chave = r.chave;
      pendente = (await sync(dono)).codigoTrocado;
      const cliAntigo = clienteCifrado(c.url, dono.aparelho, dono.chave);
      const aceita = await p(dono, '/api/codigo-trocado', { id: pendente.id, acao: 'manter' });
      igual(aceita.status, 200); dono.chave = aceita.chave;
      igual((await sync(dono)).status, 200); igual((await sync(cliAntigo)).status, 401);
      igual((await sync(chefe)).status, 200);
      certo(!(await sync(dono)).codigoTrocado && !cfgDisco().chaveAnterior, 'pendência e segredo removidos');
      await c.reiniciar(); igual((await sync(dono)).status, 200);
    });
    await teste(grupo, 'troca do próprio nível 3 continua imediata e sem pendência', async () => {
      const r = await p(dono, '/api/novo-codigo', {}); igual(r.status, 200); dono.chave = r.chave;
      igual((await sync(dono)).status, 200); igual((await sync(chefe)).status, 401);
      certo(!cfgDisco().codigoTrocado && !(await sync(dono)).codigoTrocado, 'sem pendência');
    });
    await teste(grupo, 'falha no registro de auditoria não esconde a chave já trocada do dono', async () => {
      const tmp = path.join(c.pastaServidor, 'registros.json.tmp');
      fs.mkdirSync(tmp);
      try {
        const r = await p(dono, '/api/novo-codigo', {});
        igual(r.status, 200); igual(r.registroPendente, true); dono.chave = r.chave;
      } finally { fs.rmdirSync(tmp); }
      igual((await sync(dono)).status, 200, 'dono continua conectado');
      // Uma nova gravação também persiste o evento que ficou na memória.
      await sync(dono, [reg(new Date().toISOString().slice(0, 10) + '|caldeira|auditoria', { valor: 'teste' })]);
    });
    await teste(grupo, 'registro do sistema anota troca, manutenção e restauração sem código ou chave', async () => {
      const registros = Object.values(JSON.parse(fs.readFileSync(path.join(c.pastaServidor, 'registros.json'), 'utf8')).registros);
      const textos = registros.filter((r) => r.prancheta === 'registro').map((r) => r.valores.texto).join('\n');
      certo(textos.includes('trocou o código') && textos.includes('manteve o novo código') && textos.includes('restaurou o código'), 'três eventos registrados');
      certo(!textos.includes(chaveAntes) && !textos.includes(codigoAntes) && !textos.includes(c.chave()), 'sem segredos no registro');
    });
    for (const nome of ['config.json', 'registros.json']) {
      await teste(grupo, nome + ': gravação conserva versão anterior boa em .bak e partida recupera sem perder identidade ou histórico', async () => {
        const arquivo = path.join(c.pastaServidor, nome);
        const id = new Date().toISOString().slice(0, 10) + '|caldeira|recuperar';
        await sync(dono, [reg(id, { valor: 'preservado' })]);
        // Duas gravações garantem que a cópia anterior já contém o registro e a sessão.
        const antes = fs.readFileSync(arquivo);
        if (nome === 'config.json') await p(dono, '/api/pessoas', { acao: 'aparelho', id: dono.aparelho, nome: 'Dono recuperado' });
        else await sync(dono, [reg(id, { valor: 'mais recente' })]);
        certo(fs.existsSync(arquivo + '.bak'), 'cópia anterior criada');
        certo(fs.readFileSync(arquivo + '.bak').equals(antes), 'cópia é a versão anterior exata');
        await c.desligar();
        const cfg = cfgDisco();
        const backup = JSON.parse(fs.readFileSync(arquivo + '.bak', 'utf8'));
        fs.writeFileSync(arquivo, '{interrompido');
        await c.reiniciar();
        certo(['chave', 'codigo', 'geracao'].every((k) => cfgDisco()[k] === cfg[k]), 'identidade preservada sem expor segredos');
        const banco = JSON.parse(fs.readFileSync(path.join(c.pastaServidor, 'registros.json'), 'utf8'));
        certo(banco.registros[id], 'histórico preservado');
        if (nome === 'registros.json') igual(banco.registros[id], backup.registros[id]);
        certo(Object.values(banco.registros).some((r) => r.valores?.texto?.includes(nome + ' recuperado da cópia .bak')), 'recuperação registrada antes de aceitar pedidos');
        igual((await sync(dono)).status, 200, 'aparelho existente ainda conectado');
        await c.reiniciar();
        igual((await sync(dono)).status, 200, 'recuperação sobrevive ao segundo reinício');
      });
      for (const copia of ['ausente', 'ilegível']) await teste(grupo, nome + ': sem cópia boa (' + copia + '), preserva ilegível antes de recomeçar e registra', async () => {
        await c.desligar();
        const arquivo = path.join(c.pastaServidor, nome);
        const existentes = new Set(fs.readdirSync(c.pastaServidor));
        fs.writeFileSync(arquivo, '{original interrompido');
        if (copia === 'ausente') fs.rmSync(arquivo + '.bak', { force: true });
        else fs.writeFileSync(arquivo + '.bak', '{cópia interrompida');
        await c.reiniciar();
        const guardados = fs.readdirSync(c.pastaServidor).filter((n) => !existentes.has(n) && n.startsWith(nome + '.ilegivel-'));
        igual(guardados.length, 1, 'original guardado sem sobrescrever outro');
        igual(fs.readFileSync(path.join(c.pastaServidor, guardados[0]), 'utf8'), '{original interrompido');
        const banco = JSON.parse(fs.readFileSync(path.join(c.pastaServidor, 'registros.json'), 'utf8'));
        const textos = Object.values(banco.registros).filter((r) => r.prancheta === 'registro').map((r) => r.valores.texto).join('\n');
        certo(textos.includes(nome + ' sem cópia legível'), 'reinício registrado');
        certo(!textos.includes(c.chave()) && !textos.includes(c.codigo()), 'registro sem segredos');
        if (nome === 'registros.json') certo(Object.values(banco.registros).every((r) => r.prancheta === 'registro'), 'banco novo só contém auditoria');
        dono = await conectarTeste(c.url, c.codigo());
        await entrar(dono, 3);
        igual((await sync(dono)).status, 200);
      });
    }
  } finally { await c.desligar(); }
}
