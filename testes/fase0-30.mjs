/* Fase 0 da 3.0: gerações desconhecidas preservam dados. Node, Java e Worker real com SQLite local.
 * Uso: node testes/fase0-30.mjs (somente pastas temporárias, nenhuma publicação).
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import { createHmac } from 'node:crypto';
import { centralNode, centralJava, APP, SENHA_PROGRAMADOR_TESTE } from './servidores.mjs';
import { ligarNuvemSQLite } from './nuvem-sqlite.mjs';
import { conectarTeste } from './cifra.mjs';
import { novoGrupo, teste, igual, certo, resumo } from './teste.mjs';

const g = novoGrupo('Fase 0 da 3.0: preservar antes de sincronizar');
const SEGREDO = 'segredo-ficticio-fase0-30';
const n = await ligarNuvemSQLite(8380, SEGREDO, 'leitura-ficticia-fase0');
const dia = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const reg = (chave, extra = {}) => ({ id: `${dia}|caldeira|${chave}`, data: dia, prancheta: 'caldeira', setor: 'caldeira', chave: String(chave), valores: { pressao: '6' }, atualizadoEm: Date.now(), seq: 1, ...extra });
const pessoa = { id: 'pessoa-teste', nome: 'Pessoa fictícia', nivel: 'consulta', ativo: true, funcoes: ['relatorios'] };
const enviar = (corpo) => n.pedir('/central/enviar', { senha: SEGREDO, corpo: { registros: [], ...corpo } });
const tabelas = ['registros', 'dias', 'pessoas', 'bloqueios', 'info', 'pendentes'];
const foto = () => Object.fromEntries(tabelas.map((t) => [t, n.consultar(`SELECT * FROM ${t} ORDER BY 1`)]));
const limpar = () => tabelas.forEach((t) => n.consultar(`DELETE FROM ${t} RETURNING *`));
async function preencher(geracao) {
  limpar();
  igual((await enviar({ geracao, registros: [reg('nuvem')], pessoas: [pessoa], forms: { setores: [], pranchetas: {} }, medidas: { teste: 1 }, bloqueios: [{ id: 'bloqueado', modo: 'trava', em: 10 }], bloqueiosRev: 4 })).status, 200);
}
const envios = [];
const ponte = http.createServer(async (req, res) => {
  try {
    const partes = []; for await (const p of req) partes.push(p);
    const body = Buffer.concat(partes);
    if (req.url === '/central/enviar') envios.push(JSON.parse(body));
    const r = await fetch(n.url + req.url, { method: req.method, headers: { Authorization: req.headers.authorization || '' }, ...(['GET', 'HEAD'].includes(req.method) ? {} : { body }) });
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) { res.writeHead(502); res.end(String(e)); }
});
await new Promise((resolve) => ponte.listen(8381, '127.0.0.1', resolve));

// Executa a lógica real do aplicativo; somente rede, armazenamento e funções de tela são simulados.
function tablet(resposta, falharCopia = false) {
  const armazenamento = new Map(), avisos = [], erros = [], pedidos = [], gravacoes = [];
  const cfg = { chave: 'ficticia', deviceId: 'tablet-teste', papel: 'caldeira', geracao: 'tablet-antigo', ultimoSeq: 77 };
  const registros = { [reg('tablet').id]: reg('tablet', { sincronizado: false }), 'config|sistema|geral': { id: 'config|sistema|geral', data: 'config', valores: { manter: true }, sincronizado: true } };
  const localStorage = {
    getItem: (k) => armazenamento.get(k) ?? null,
    setItem(k, v) {
      if (falharCopia && !['usina.cfg', 'usina.registros', 'usina.erros'].includes(k)) throw new Error('cópia indisponível');
      gravacoes.push({ chave: k, valor: String(v), registros: JSON.stringify(registros) }); armazenamento.set(k, String(v));
    },
  };
  const LS = { get: (k, padrao) => JSON.parse(localStorage.getItem('usina.' + k) || 'null') ?? padrao, set: (k, v) => localStorage.setItem('usina.' + k, JSON.stringify(v)) };
  const ctx = vm.createContext({ cfg, registros, LS, localStorage, setInterval: () => 0, DEMO_IMG: false, NO_APK: false, window: {}, C: {}, VERSAO: 'teste',
    document: { getElementById: () => null, documentElement: { dataset: {} } }, screen: { width: 800, height: 1280 }, navigator: {}, console, setTimeout, clearTimeout, AbortController,
    errosGuardados: [], guardarErro: (...args) => erros.push(args), toast: (...args) => avisos.push(args),
    salvarCfg: () => LS.set('cfg', cfg), salvarRegistros: () => LS.set('registros', registros),
    rascunho: {}, ed: { alvoId: 'tablet' }, lembrar: { exemplo: true }, pilha: [{ tela: 'inicio' }], setorDaPrancheta: () => ({ id: cfg.papel }),
    telaInicial: () => ({ tela: 'inicio' }), ehCentral: () => false, operadorAtual: () => 'Operador',
    nomeDesteAparelho: () => 'Tablet', infoAparelho: {}, versaoNaSincronizacao() {}, conhecerCentralDoBloqueio() {},
    render() {}, primeiroDiaGuardado: () => dia, receberRegistro: () => false, podar() {},
    view: () => ({ tela: 'inicio' }), revisarAvisoNaTela() {}, verificarAvisos() {}, conferirNaNuvem() {},
    enderecoNuvemSeguro: () => false, pendentes: () => 1, contar: () => '1 anotação',
  });
  vm.runInContext(fs.readFileSync(path.join(APP, 'public/nucleo/conexao.js'), 'utf8'), ctx);
  ctx.responderTeste = async (rota, corpo) => {
    pedidos.push({ rota, corpo });
    return new Response(JSON.stringify(rota === 'api/ping' ? { app: 'pranchetas', cifra: 1 }
      : rota === 'api/sync' ? resposta : { registros: [], seq: 88 }), { status: 200 });
  };
  vm.runInContext('buscar = (rota, opcoes = {}) => responderTeste(rota, opcoes.body ? JSON.parse(opcoes.body) : undefined);', ctx); // postJson usa essa rede.
  return { ctx, cfg, registros, armazenamento, gravacoes, avisos, erros, pedidos,
    sincronizar: () => vm.runInContext('sincronizar()', ctx), zerar: () => vm.runInContext('zerarLocal("nova")', ctx) };
}

try {
  for (const extras of [{}, { geracoesZeradas: ['outra-geracao'] }, { geracoesZeradas: 'nuvem-cheia' }, { geracao: '' }, { geracao: undefined }]) await teste(g, 'nuvem: geração desconhecida recebe 409 e preserva todas as tabelas, inclusive info ' + JSON.stringify(extras), async () => {
    await preencher('nuvem-cheia'); const antes = foto();
    const r = await enviar({ geracao: 'central-nova', registros: [reg('invasora')], pessoas: [], forms: { alterado: true }, medidas: null, bloqueios: [], ...extras });
    igual(r.status, 409); igual(r.json.geracao, 'nuvem-cheia'); certo(typeof r.json.erro === 'string' && r.json.erro.length > 0, 'erro explicativo'); igual(foto(), antes);
  });
  await teste(g, 'nuvem: pessoas vazias preservam os cadastros existentes', async () => {
    await preencher('pessoas'); const antes = n.consultar('SELECT * FROM pessoas');
    igual((await enviar({ geracao: 'pessoas', pessoas: [] })).status, 200); igual(n.consultar('SELECT * FROM pessoas'), antes);
    igual((await enviar({ geracao: 'pessoas', pessoas: [{ ...pessoa, ativo: false }] })).status, 200); igual(n.consultar('SELECT * FROM pessoas'), antes, 'lista só com inativos também não esvazia');
  });
  await teste(g, 'nuvem: geração explicitamente zerada limpa anotações e dias, e fica com as pessoas', async () => {
    await preencher('zerada');
    igual((await enviar({ geracao: 'depois', geracoesZeradas: ['zerada'], registros: [reg('novo')] })).status, 200);
    igual(n.consultar('SELECT id FROM registros'), [{ id: reg('novo').id }]); igual(n.consultar('SELECT id FROM pessoas'), [{ id: pessoa.id }], 'as pessoas são da usina: zerar não tira');
    igual(n.consultar('SELECT anotacoes FROM dias'), [{ anotacoes: 1 }]);
  });

  for (const [nome, ligar, porta] of [['Node', centralNode, 8382], ['Java', centralJava, 8383]]) {
    await preencher('central-anterior-' + nome);
    const c = await ligar(porta);
    const config = () => JSON.parse(fs.readFileSync(path.join(c.pastaServidor, 'config.json'), 'utf8'));
    const locais = async () => (await c.api('/api/registros?desde=0')).registros;
    let geracao;
    try {
      const cli = await c.cliente();
      geracao = (await c.api('/api/sync', { aparelho: cli.aparelho, registros: [reg('local')] })).geracao;
      for (const novaConexao of [false, true]) await teste(g, `${nome}: geração desconhecida aceita tablet 2.17 com novaConexao=${novaConexao}`, async () => {
        const r = reg('desconhecida-' + novaConexao);
        const d = await c.api('/api/sync', { aparelho: cli.aparelho, geracao: 'desconhecida', novaConexao, registros: [r] });
        certo(!d.zerar && d.ok, JSON.stringify(d)); igual(d.geracao, geracao); certo((await locais()).some((x) => x.id === r.id), 'anotação preservada na central');
      });
      await teste(g, `${nome}: central nova não substitui o banco cheio: adota a geração dele e junta o que tinha`, async () => {
        const antes = n.consultar('SELECT id FROM registros ORDER BY id').map((x) => x.id);
        await c.api('/api/nuvem', { acao: 'configurar', url: 'http://127.0.0.1:8381', segredo: SEGREDO });
        const r = await c.api('/api/nuvem', { acao: 'enviar' });
        certo(!r.erro, r.erro);
        igual(config().geracao, 'central-anterior-' + nome, 'central ficou com a geração do banco');
        const depois = n.consultar('SELECT id FROM registros').map((x) => x.id);
        antes.forEach((id) => certo(depois.includes(id), 'sumiu do banco: ' + id));
        certo(depois.includes(reg('local').id), 'o que a central tinha subiu');
        certo((await locais()).some((x) => antes.includes(x.id)), 'a central puxou o que estava no banco');
        certo(n.consultar('SELECT id FROM pessoas').some((x) => x.id === pessoa.id), 'a pessoa do banco veio para ficar');
        certo(config().pessoas.some((x) => x.id === pessoa.id), 'a central conhece a pessoa do banco');
      });
      geracao = config().geracao;
      const remoto = await conectarTeste(c.url, c.codigo(), 'fila-' + nome);
      await remoto.pedir('/api/sync', { corpo: { aparelho: remoto.aparelho, papel: 'caldeira', registros: [] } });
      const fila = (r, geracao) => n.pedir('/fila', { aparelho: remoto.aparelho, senha: createHmac('sha256', SEGREDO).update('aparelho|' + remoto.aparelho).digest('hex'), corpo: { registros: [r], geracao } });
      await teste(g, `${nome}: fila de geração desconhecida é preservada e incorporada`, async () => {
        const r = reg('fila-desconhecida'); igual((await fila(r, 'desconhecida')).status, 200);
        await c.api('/api/nuvem', { acao: 'enviar' });
        const guardada = (await locais()).find((x) => x.id === r.id);
        certo(guardada && !guardada.apagado && guardada.valores.pressao === '6', 'anotação da fila recusada ou apagada');
        igual(n.consultar('SELECT * FROM pendentes'), []);
      });
      const z = await c.api('/api/zerar', { confirmar: 'ZERAR', senha: SENHA_PROGRAMADOR_TESTE });
      await teste(g, `${nome}: zerar explícito responde zerada:true ao tablet, mesmo com novaConexao`, async () => {
        certo(z.ok, JSON.stringify(z));
        for (const novaConexao of [false, true]) {
          const d = await c.api('/api/sync', { aparelho: cli.aparelho, geracao, novaConexao, registros: [reg('ressuscitada')] });
          igual(d.zerar, true); igual(d.zerada, true); igual(d.geracao, z.geracao);
        }
        certo(!(await locais()).some((x) => x.id === reg('ressuscitada').id));
      });
      await teste(g, `${nome}: envio leva geracoesZeradas e zerar explícito limpa a nuvem`, async () => {
        const inicio = envios.length;
        const r = await c.api('/api/nuvem', { acao: 'enviar' }); certo(!r.erro, r.erro);
        certo(envios.slice(inicio).some((x) => x.geracoesZeradas?.includes(geracao)), 'geracoesZeradas ausente');
        igual(n.consultar("SELECT * FROM registros WHERE prancheta <> 'registro' AND data <> 'config'"), []); igual(n.consultar("SELECT valor FROM info WHERE chave = 'geracao'")[0].valor, z.geracao);
      });
      await teste(g, `${nome}: fila de geração explicitamente zerada não ressuscita dados`, async () => {
        await fila(reg('fila-zerada'), geracao); await c.api('/api/nuvem', { acao: 'enviar' });
        certo(!(await locais()).some((x) => x.id === reg('fila-zerada').id && !x.apagado)); igual(n.consultar('SELECT * FROM pendentes'), []);
      });
    } finally { await c.desligar(); }
  }

  await teste(g, 'tablet: central antiga sem zerada não apaga, não confirma envio, não busca registros e avisa uma vez', async () => {
    const t = tablet({ zerar: true, geracao: 'nova' }), antes = JSON.stringify(t.registros);
    await t.sincronizar(); await t.sincronizar();
    igual(JSON.stringify(t.registros), antes); igual(t.cfg.geracao, 'tablet-antigo'); igual(t.cfg.ultimoSeq, 77);
    igual(t.pedidos.filter((x) => x.rota.startsWith('api/registros')).length, 0); igual(t.avisos.length, 1);
    certo(/atualiz|antig/i.test(t.avisos[0][0]), 'aviso pede atualização da central');
  });
  await teste(g, 'tablet: geração nova conserva anotações já sincronizadas para reenviar', async () => {
    const t = tablet({ ok: true, geracao: 'nova' }); const r = t.registros[reg('tablet').id]; r.sincronizado = true;
    await t.sincronizar(); igual(t.cfg.geracao, 'nova'); igual(r.sincronizado, false); certo(t.registros[r.id]);
    await t.sincronizar(); igual(r.sincronizado, true);
    certo(t.pedidos.filter((x) => x.rota === 'api/sync')[1].corpo.registros.some((x) => x.id === r.id), 'anotação reenviada no segundo sync');
  });
  await teste(g, 'tablet: reset confirmado faz cópia antes de apagar e mantém configuração', async () => {
    const t = tablet({ zerar: true, zerada: true, geracao: 'nova' }), antes = JSON.stringify(t.registros);
    await t.sincronizar(); igual(t.cfg.geracao, 'nova'); igual(Object.keys(t.registros), ['config|sistema|geral']);
    const copia = t.gravacoes.find((x) => !['usina.registros', 'usina.cfg', 'usina.erros'].includes(x.chave) && x.valor.includes(reg('tablet').id));
    certo(copia, 'faltou cópia recuperável'); igual(copia.registros, antes, 'cópia feita antes da exclusão');
  });
  await teste(g, 'tablet: falha da cópia não apaga, mantém geração e registra erro', async () => {
    const t = tablet({ zerar: true, zerada: true, geracao: 'nova' }, true), antes = JSON.stringify(t.registros);
    await t.sincronizar(); igual(JSON.stringify(t.registros), antes); igual(t.cfg.geracao, 'tablet-antigo'); igual(t.cfg.ultimoSeq, 77);
    certo(t.erros.length > 0, 'faltou registro do erro da cópia');
    certo(!t.avisos.some((x) => /começou do zero/.test(x[0])), 'não anuncia apagamento que falhou');
  });
} finally {
  await new Promise((resolve) => ponte.close(resolve)); await n.desligar();
}
const r = resumo([g]); console.log(`\n${r.passaram} de ${r.total} testes passaram; ${r.falharam} falharam`); process.exitCode = r.falharam ? 1 : 0;
