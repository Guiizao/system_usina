import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { teste, certo, igual, SENHA_ENCARREGADO } from './teste.mjs';
import { pastaTemporaria } from './servidores.mjs';
import { conectarTeste, clienteCifrado } from './cifra.mjs';

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
  } finally { await c.desligar(); }
}
