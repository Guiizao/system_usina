/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Versão 2.8: a Nuvem das Pranchetas (Cloudflare Workers + D1), rodando aqui no computador com o próprio wrangler
 * (o mesmo programa que roda no Cloudflare, sem precisar de conta).
 *   - a central (computador e tablet chefe) manda a cópia das anotações sozinha;
 *   - a API de leitura da nuvem responde igual à da central (mesmo dia, mesmo esquema, mesma lista do que mudou);
 *   - anotação corrigida e apagada chegam na nuvem; senha errada aparece como erro no tablet chefe;
 *   - versao.json e o APK saem da nuvem para a central baixar.
 * Precisa do wrangler instalado em nuvem/node_modules (npm install na pasta nuvem).
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { dormir } from './navegador.mjs';
import { teste, certo, igual, SENHA_ENCARREGADO } from './teste.mjs';
import { centralNode, centralJava, pastaTemporaria, APP } from './servidores.mjs';
import { diaDeExemplo } from './api-leitura.mjs';
import { chaveDeTeste, telasDeTeste, montarPacote } from './atualizacao.mjs';
import { conectarTeste } from './cifra.mjs';

const NUVEM = path.join(APP, 'nuvem');
const WRANGLER = path.join(NUVEM, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const SEGREDO = 'segredo-da-central-de-teste';
const TOKEN = 'senha-de-leitura-de-teste';
const pad2 = (n) => String(n).padStart(2, '0');
const diaProducao = (atras = 0) => { const d = new Date(Date.now() - 7 * 3600000 - atras * 86400000); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

export const temWrangler = () => fs.existsSync(WRANGLER);

/** Liga a nuvem aqui no computador (wrangler dev), com o banco numa pasta temporária. */
async function ligarNuvem(porta) {
  const banco = pastaTemporaria('nuvem-banco');
  const publico = pastaTemporaria('nuvem-publico');
  fs.cpSync(path.join(NUVEM, 'publico'), publico, { recursive: true });
  const env = Object.assign({}, process.env, { WRANGLER_SEND_METRICS: 'false', CI: '1', NO_COLOR: '1' });
  execFileSync(process.execPath, [WRANGLER, 'd1', 'execute', 'pranchetas', '--local', '--persist-to', banco, '--file', 'schema.sql'], { cwd: NUVEM, env, stdio: 'inherit' });
  const proc = spawn(process.execPath, [WRANGLER, 'dev', '--local', '--ip', '127.0.0.1', '--port', String(porta), '--persist-to', banco, '--assets', publico,
    '--var', `SEGREDO_CENTRAL:${SEGREDO}`, '--var', `TOKEN_LEITURA:${TOKEN}`, '--show-interactive-dev-session=false'], { cwd: NUVEM, env, stdio: 'ignore' });
  const url = `http://127.0.0.1:${porta}`;
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    try { const r = await fetch(url + '/'); if (r.ok) break; } catch { /* ainda ligando */ }
    await dormir(500);
  }
  return {
    url, publico,
    /** Uma consulta direto no banco local da nuvem (para conferir o que ficou guardado). */
    consultar(sql) {
      const saida = execFileSync(process.execPath, [WRANGLER, 'd1', 'execute', 'pranchetas', '--local', '--persist-to', banco, '--command', sql, '--json'], { cwd: NUVEM, env, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
      return JSON.parse(saida.slice(saida.indexOf('['))) [0].results;
    },
    async pedir(rota, { senha = TOKEN, corpo, aparelho } = {}) {
      const r = await fetch(url + rota, { method: corpo ? 'POST' : 'GET', headers: Object.assign({ Authorization: 'Bearer ' + senha }, aparelho ? { 'X-Aparelho': aparelho } : {}, corpo ? { 'Content-Type': 'application/json' } : {}), body: corpo ? JSON.stringify(corpo) : undefined });
      const texto = await r.text();
      let json = null; try { json = JSON.parse(texto); } catch { /* não é JSON */ }
      return { status: r.status, json, texto, cabecalhos: r.headers };
    },
    async desligar() {
      try { execFileSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { proc.kill(); }
      await dormir(500);
    },
  };
}

/** As folhas (forms.js) como o aplicativo do tablet chefe manda para a central do tablet. */
function formsDoApp() {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(APP, 'public', 'forms.js'), 'utf8'), ctx);
  return JSON.parse(JSON.stringify(ctx.window.USINA));
}

async function esperar(fn, descricao, ms = 40000) {
  const t0 = Date.now();
  let ultimo;
  while (Date.now() - t0 < ms) { ultimo = await fn(); if (ultimo) return ultimo; await dormir(700); }
  throw new Error(`não aconteceu em ${ms / 1000}s: ${descricao}`);
}

export async function testarNuvem(grupo, sqlite = false) {
  if (!sqlite && !temWrangler()) {
    await teste(grupo, 'nuvem: wrangler instalado (npm install na pasta nuvem)', async () => certo(false, 'falta rodar npm install em app/nuvem'));
    return;
  }
  const nuvem = sqlite ? await (await import('./nuvem-sqlite.mjs')).ligarNuvemSQLite(8791, SEGREDO, TOKEN) : await ligarNuvem(8791);
  try {
    await teste(grupo, 'a nuvem liga e recusa quem não tem a senha', async () => {
      certo((await (await fetch(nuvem.url + '/')).text()).includes('no ar'), 'página inicial');
      igual((await nuvem.pedir('/central/estado', { senha: 'errada' })).status, 401);
      igual((await nuvem.pedir('/api/v1/esquema', { senha: 'errada' })).status, 401);
      igual((await nuvem.pedir('/api/v1/esquema')).status, 503, 'sem nada da central, a API avisa');
    });

    const tokenFila = (id) => crypto.createHmac('sha256', SEGREDO).update('aparelho|' + id).digest('hex');
    const lerFila = async () => (await nuvem.pedir('/fila', { senha: SEGREDO })).json.itens;
    const confirmar = (itens) => nuvem.pedir('/fila/confirmar', { senha: SEGREDO, corpo: { itens } });
    const recibos = (itens) => itens.map((x) => ({ aparelho: x.aparelho, id: x.registro.id, atualizadoEm: x.registro.atualizadoEm }));
    const exemploFila = { id: '2026-10-10|caldeira|20', data: '2026-10-10', prancheta: 'caldeira', chave: '20', atualizadoEm: 100, valores: { pressao: '6' } };
    const enviarFila = (aparelho, registros, extra = {}) => nuvem.pedir('/fila', { aparelho, senha: tokenFila(aparelho), corpo: { registros, ...extra } });
    await teste(grupo, 'fila: token errado, token de outro aparelho e acesso à leitura/confirmação são recusados', async () => {
      igual((await nuvem.pedir('/fila', { aparelho: 'a', senha: 'errado', corpo: { registros: [] } })).status, 401);
      igual((await nuvem.pedir('/fila', { aparelho: 'b', senha: tokenFila('a'), corpo: { registros: [] } })).status, 401);
      igual((await nuvem.pedir('/fila', { senha: SEGREDO, corpo: { registros: [] } })).status, 401);
      igual((await nuvem.pedir('/fila', { senha: tokenFila('a') })).status, 401);
      igual((await nuvem.pedir('/fila/confirmar', { senha: tokenFila('a'), corpo: { itens: [] } })).status, 401);
      const options = await fetch(nuvem.url + '/fila', { method: 'OPTIONS' });
      certo(options.headers.get('access-control-allow-headers').includes('X-Aparelho'), 'CORS para o aparelho');
      igual((await enviarFila('a', [])).status, 200);
    });
    await teste(grupo, 'fila: limite de 500 anotações, 1 MB e estrutura validada antes de gravar', async () => {
      igual((await enviarFila('a', Array(501).fill(exemploFila))).status, 400);
      igual((await enviarFila('a', [{ ...exemploFila, valores: { texto: 'a'.repeat(1024 * 1024) } }])).status, 413);
      igual((await enviarFila('a', [{ ...exemploFila, atualizadoEm: '100' }])).status, 400);
      igual((await enviarFila('a', [{ ...exemploFila, id: 'config|sistema|geral' }])).status, 400);
      igual((await lerFila()).length, 0);
    });
    await teste(grupo, 'fila separada por aparelho/id; só versão mais nova substitui; confirmação antiga não apaga a nova', async () => {
      igual((await enviarFila('a', [exemploFila])).status, 200);
      await enviarFila('b', [exemploFila]);
      const antigos = recibos(await lerFila());
      await enviarFila('a', [{ ...exemploFila, atualizadoEm: 101, valores: { pressao: '7' } }]);
      await enviarFila('a', [{ ...exemploFila, atualizadoEm: 100, valores: { pressao: '8' } }]);
      await enviarFila('a', [{ ...exemploFila, atualizadoEm: 101, valores: { pressao: '9' } }]);
      let itens = await lerFila();
      igual(itens.length, 2);
      igual(itens.find((x) => x.aparelho === 'a').registro.valores.pressao, '7');
      // A fila não alimenta a API de leitura: a central ainda não mandou forms nem anotações.
      igual((await nuvem.pedir('/api/v1/esquema')).status, 503);
      igual((await nuvem.pedir('/central/estado', { senha: SEGREDO })).json.registros, 0);
      await confirmar(antigos);
      itens = await lerFila(); igual(itens.length, 1); igual(itens[0].registro.atualizadoEm, 101);
      await confirmar(recibos(itens)); igual((await lerFila()).length, 0);
    });

    for (const [nome, ligar, porta] of [['computador', centralNode, 8792], ['tablet chefe', centralJava, 8793]]) {
      const c = nome === 'computador'
        ? await ligar(porta, pastaTemporaria('nuvem-central'), undefined, { NUVEM_ESPERA_MS: '500' })
        : await ligar(porta, pastaTemporaria('nuvem-java'));
      const tokenLocal = () => JSON.parse(fs.readFileSync(path.join(c.pastaServidor, 'config.json'), 'utf8')).tokenLeitura;
      const dia = diaProducao(1);
      try {
        await teste(grupo, `${nome}: manda a cópia sozinha e a nuvem fica com tudo`, async () => {
          // começa de uma nuvem vazia (cada central é uma "geração" diferente: a nuvem limpa e recebe tudo de novo)
          const regs = diaDeExemplo(dia);
          await c.api('/api/sync', { aparelho: 'teste-nuvem', registros: regs });
          // o aplicativo do tablet chefe manda as folhas (a central do computador lê o forms.js sozinha)
          const r = await c.api('/api/nuvem', { acao: 'configurar', url: nuvem.url, segredo: SEGREDO, forms: formsDoApp() });
          certo(r && r.url === nuvem.url && r.temSegredo, 'configurar: ' + JSON.stringify(r));
          const publicas = regs.filter((x) => /^\d{4}-/.test(x.data) && x.prancheta !== 'avisos').length;
          const e = await esperar(async () => { const x = (await nuvem.pedir('/central/estado', { senha: SEGREDO })).json; return x && x.registros === publicas ? x : null; }, 'anotações na nuvem (só as desta central: a da rodada anterior sai quando esta manda tudo)');
          igual(e.registros, publicas, 'a configuração da usina e os avisos não sobem');
          const st = await esperar(async () => { const x = await c.api('/api/nuvem', { acao: 'estado' }); return x && x.ultimoEnvio && !x.faltam ? x : null; }, 'estado da central');
          igual(st.erro, '');
          // a senha do administrador (pinAdmin do forms.js) não fica guardada na nuvem
          const forms = nuvem.consultar("SELECT valor FROM info WHERE chave = 'forms'");
          certo(forms.length && forms[0].valor.includes('"setores"'), 'as folhas chegaram');
          certo(!forms[0].valor.includes('pinAdmin'), 'a senha do administrador não pode ficar na nuvem');
        });

        await teste(grupo, `${nome}: a API da nuvem responde igual à da central (dia, esquema e o que mudou)`, async () => {
          const local = async (rota) => (await (await fetch(c.url + rota, { headers: { Authorization: 'Bearer ' + tokenLocal() } })).json());
          if (nome === 'computador') {
            igual(JSON.stringify((await nuvem.pedir(`/api/v1/dias/${dia}`)).json), JSON.stringify(await local(`/api/v1/dias/${dia}`)), 'o dia');
            igual(JSON.stringify((await nuvem.pedir('/api/v1/esquema')).json), JSON.stringify(await local('/api/v1/esquema')), 'o esquema');
            const n = (await nuvem.pedir('/api/v1/registros?desde=0&limite=10')).json;
            const l = await local('/api/v1/registros?desde=0&limite=10');
            igual(JSON.stringify(n.registros), JSON.stringify(l.registros), 'o que mudou');
          }
          const d = (await nuvem.pedir(`/api/v1/dias/${dia}`)).json;
          certo(d.periodo.inicio === `${dia}T07:00:00-03:00`, 'dia de produção às 07:00 da usina: ' + d.periodo.inicio);
          const hid = d.setores.find((s) => s.id === 'hidrolise').pranchetas.find((p) => p.id === 'hid_anexo1');
          igual(hid.linhas.length, 6, 'dornas da Hidrólise');
          const dias = (await nuvem.pedir('/api/v1/dias')).json.dias;
          certo(dias.some((x) => x.data === dia && x.anotacoes > 30), 'lista de dias: ' + JSON.stringify(dias));
        });

        await teste(grupo, `${nome}: anotação corrigida e apagada chegam na nuvem`, async () => {
          const antes = (await nuvem.pedir(`/api/v1/dias`)).json.dias.find((x) => x.data === dia).anotacoes;
          const t = Date.now();
          await c.api('/api/sync', { aparelho: 'teste-nuvem', registros: [
            { id: `${dia}|caldeira|7`, data: dia, prancheta: 'caldeira', setor: 'caldeira', chave: '7', valores: { pressao: '7', temp_agua: '44' }, criadoEm: t, atualizadoEm: t + 1, aparelho: 'teste-nuvem', apagado: false, operador: 'Alberto' },
            { id: `${dia}|caldeira|8`, data: dia, prancheta: 'caldeira', setor: 'caldeira', chave: '8', valores: {}, criadoEm: t, atualizadoEm: t + 1, aparelho: 'teste-nuvem', apagado: true, operador: 'Alberto' },
          ] });
          await esperar(async () => {
            const d = (await nuvem.pedir(`/api/v1/dias/${dia}`)).json;
            const linhas = d.setores.find((s) => s.id === 'caldeira').pranchetas.find((p) => p.id === 'caldeira').linhas;
            const l7 = linhas.find((l) => l.hora === '07:00');
            return l7 && l7.campos.pressao.valor === 7 && !linhas.some((l) => l.hora === '08:00');
          }, 'correção e apagado na nuvem');
          const depois = (await nuvem.pedir(`/api/v1/dias`)).json.dias.find((x) => x.data === dia).anotacoes;
          igual(depois, antes - 1, 'o dia conta uma anotação a menos');
        });

        await teste(grupo, `${nome}: senha errada aparece como erro para o tablet chefe`, async () => {
          await c.api('/api/nuvem', { acao: 'configurar', url: nuvem.url, segredo: 'errada' });
          const r = await c.api('/api/nuvem', { acao: 'enviar' });
          certo(/recusou a senha/.test(r.erro), 'erro: ' + r.erro);
          const st = await c.api('/api/status');
          certo(st.nuvem && /recusou a senha/.test(st.nuvem.erro), 'o erro vai no estado da central');
          await c.api('/api/nuvem', { acao: 'configurar', url: nuvem.url, segredo: SEGREDO });
          const ok = await c.api('/api/nuvem', { acao: 'enviar' });
          igual(ok.erro, '');
        });

        await teste(grupo, `${nome}: aparelho bloqueado aparece na nuvem (longe da usina ele pergunta lá) e sai quando desbloqueia`, async () => {
          igual((await c.api('/api/pessoas', { acao: 'entrar', pin: SENHA_ENCARREGADO })).pessoa.nome, 'Guilherme');
          igual((await c.api('/api/aparelhos', { acao: 'bloquear', id: 'teste-nuvem', modo: 'senha', apagar: true, codigo: '4321' })).ok, true);
          const resp = await esperar(async () => { const d = await (await fetch(nuvem.url + '/aparelho/teste-nuvem')).json(); return d.bloqueio ? d : null; }, 'o bloqueio na nuvem');
          const b = resp.bloqueio;
          certo(b.modo === 'senha' && b.apagar === true && b.em > 0 && b.rev > 0, JSON.stringify(b));
          // revisão do Codex (06/10/2026): a rota é aberta, então nada da senha de desbloqueio sai por ela
          certo(!('sal' in b) && !('resumo' in b), 'sem a senha: ' + JSON.stringify(b));
          certo(resp.revisao >= b.rev, 'a revisão da lista (número da central) vem junto: ' + JSON.stringify(resp));
          certo(typeof resp.geracao === 'string' && resp.geracao.length > 3, 'e de qual central é a lista (geração): ' + JSON.stringify(resp));
          const outro = await fetch(nuvem.url + '/aparelho/outro-aparelho');
          igual(outro.headers.get('access-control-allow-origin'), '*', 'o aplicativo pergunta direto');
          igual((await outro.json()).bloqueio, null, 'aparelho que não foi bloqueado');
          await c.api('/api/aparelhos', { acao: 'desbloquear', id: 'teste-nuvem' });
          const solto = await esperar(async () => { const d = await (await fetch(nuvem.url + '/aparelho/teste-nuvem')).json(); return d.bloqueio === null ? d : null; }, 'o desbloqueio na nuvem');
          certo(solto.revisao > b.rev, 'o desbloqueio é mais novo que o bloqueio (o aparelho só destrava assim): ' + JSON.stringify(solto));
        });

        const remoto = await conectarTeste(c.url, c.codigo());
        const syncRemoto = async (registros = []) => (await remoto.pedir('/api/sync', { corpo: { aparelho: remoto.aparelho, papel: 'escritorio', registros } })).json;
        const credencial = await syncRemoto();
        const mandar = (registros, extra = {}) => nuvem.pedir('/fila', { aparelho: remoto.aparelho, senha: credencial.nuvemToken, corpo: { registros, geracao: credencial.geracao, ...extra } });
        const puxar = async () => {
          await c.api('/api/nuvem', { acao: 'enviar' });
          await esperar(async () => !(await lerFila()).length, 'central confirmou a fila');
        };
        const registros = async () => (await c.api('/api/registros?desde=0')).registros;
        const t = Date.now();
        const r = { id: `${dia}|caldeira|fila`, data: dia, prancheta: 'caldeira', chave: 'fila', aparelho: remoto.aparelho, atualizadoEm: t, valores: { pressao: '5' } };
        await teste(grupo, `${nome}: fila chega pelo aparelho certo, grava no disco e confirmado some`, async () => {
          igual(credencial.nuvemToken, tokenFila(remoto.aparelho));
          igual((await mandar([r])).status, 200);
          await puxar();
          igual((await registros()).find((x) => x.id === r.id).valores.pressao, '5');
          const disco = JSON.parse(fs.readFileSync(path.join(c.pastaServidor, 'registros.json'), 'utf8'));
          igual(disco.registros[r.id].valores.pressao, '5', 'gravado antes da confirmação');
        });
        await teste(grupo, `${nome}: fila mais velha perde; mais nova vence`, async () => {
          await syncRemoto([{ ...r, atualizadoEm: t + 100, valores: { pressao: '6' } }]);
          await mandar([{ ...r, atualizadoEm: t + 50, valores: { pressao: '4' } }]); await puxar();
          igual((await registros()).find((x) => x.id === r.id).valores.pressao, '6');
          await mandar([{ ...r, atualizadoEm: t + 200, valores: { pressao: '7' } }]); await puxar();
          igual((await registros()).find((x) => x.id === r.id).valores.pressao, '7');
        });
        await teste(grupo, `${nome}: config pela fila respeita permissão, revisão e registro das recusas`, async () => {
          const id = 'config|sistema|geral';
          let cfg = (await registros()).find((x) => x.id === id);
          const entrada = { id, data: 'config', prancheta: 'sistema', chave: 'geral', base: cfg?.rev || 0, valores: { ...(cfg?.valores || {}), operadores: { caldeira: ['Fila'] } }, atualizadoEm: t + 300 };
          await mandar([entrada]); await puxar();
          igual(JSON.stringify((await registros()).find((x) => x.id === id)?.valores), JSON.stringify(cfg?.valores));
          await remoto.pedir('/api/pessoas', { corpo: { acao: 'verificar', pin: SENHA_ENCARREGADO } });
          await mandar([{ ...entrada, atualizadoEm: t + 301 }]); await puxar();
          cfg = (await registros()).find((x) => x.id === id);
          igual(cfg.valores.operadores.caldeira[0], 'Fila');
          await mandar([{ ...entrada, atualizadoEm: t + 302 }]); await puxar();
          igual((await registros()).find((x) => x.id === id).rev, cfg.rev);
          const log = (await c.api('/api/registro?dia=' + diaProducao())).registros;
          certo(log.some((x) => x.valores.texto.includes('Fila recusada: ' + id) && x.valores.texto.includes('sem_permissao')), 'recusa registrada');
          certo(log.some((x) => x.valores.texto.includes('Fila recusada: ' + id) && x.valores.texto.includes('conflito')), 'conflito registrado');
        });
        await teste(grupo, `${nome}: rastreamento sem permissão e aparelho bloqueado não entram pela fila`, async () => {
          await remoto.pedir('/api/pessoas', { corpo: { acao: 'verificar', pin: SENHA_ENCARREGADO } });
          const rast = { ...r, id: `${dia}|rastreamento|fila`, prancheta: 'rastreamento', atualizadoEm: t + 400 };
          await mandar([rast]); await puxar();
          certo((await registros()).some((x) => x.id === rast.id), 'com escritório entra');
          await c.api('/api/pessoas', { acao: 'salvar', pessoa: { nome: 'Consulta fila', nivel: 'consulta', pin: '3333' } });
          await remoto.pedir('/api/pessoas', { corpo: { acao: 'verificar', pin: '3333' } });
          await mandar([{ ...rast, atualizadoEm: t + 401, valores: { pressao: '999' } }]); await puxar();
          igual((await registros()).find((x) => x.id === rast.id).atualizadoEm, t + 400);
          igual((await c.api('/api/aparelhos', { acao: 'bloquear', id: remoto.aparelho, modo: 'trava' })).ok, true);
          await mandar([{ ...r, atualizadoEm: t + 402, valores: { pressao: '999' } }]); await puxar();
          igual((await registros()).find((x) => x.id === r.id).valores.pressao, '7');
          const log = (await c.api('/api/registro?dia=' + diaProducao())).registros;
          certo(log.some((x) => x.valores.texto.includes('Fila recusada: ' + r.id) && x.valores.texto.includes('bloqueado')), 'bloqueio registrado');
          await c.api('/api/aparelhos', { acao: 'desbloquear', id: remoto.aparelho });
        });
        await teste(grupo, `${nome}: fila de outra geração não ressuscita anotações`, async () => {
          await mandar([{ ...r, atualizadoEm: t + 500, valores: { pressao: '999' } }], { geracao: 'geracao-antiga' }); await puxar();
          igual((await registros()).find((x) => x.id === r.id).valores.pressao, '7');
        });

      } finally { await c.desligar(); }
    }

    // revisão do Codex (06/10/2026): antes a nuvem cortava no 500º sem avisar e o aparelho cortado podia destravar
    await teste(grupo, 'a nuvem recusa (em vez de cortar) uma lista com mais de 500 aparelhos bloqueados', async () => {
      const bloqueios = Array.from({ length: 501 }, (_, i) => ({ id: 'ap-' + i, em: 1, modo: 'trava' }));
      const r = await nuvem.pedir('/central/enviar', { senha: SEGREDO, corpo: { registros: [], bloqueios } });
      igual(r.status, 400, r.texto);
    });

    await teste(grupo, 'atualização: o APK e o pacote das telas saem da nuvem e a central do computador baixa (conferindo a assinatura)', async () => {
      const chave = chaveDeTeste();
      montarPacote(telasDeTeste('9.9.9'), path.join(nuvem.publico, 'telas'), chave, '9.9.9', '2.0.0');
      const pasta = path.join(nuvem.publico, 'atualizacao');
      const apk = crypto.randomBytes(200000);
      fs.writeFileSync(path.join(pasta, 'pranchetas.apk'), apk);
      fs.writeFileSync(path.join(pasta, 'versao.json'), JSON.stringify({ versao: '9.9.9', tamanho: apk.length, sha256: sha(apk), novidades: [{ versao: '9.9.9', itens: ['teste da nuvem'] }] }));
      await dormir(2500); // o wrangler percebe os arquivos novos
      const v = await nuvem.pedir('/atualizacao/versao.json');
      igual(v.json && v.json.versao, '9.9.9');
      igual(v.cabecalhos.get('access-control-allow-origin'), '*', 'o aplicativo lê o versao.json direto da nuvem');
      const t = await nuvem.pedir('/telas/pacote.json');
      igual(t.json && t.json.versao, '9.9.9');
      igual(t.cabecalhos.get('access-control-allow-origin'), '*', 'o tablet chefe lê o pacote das telas direto da nuvem');
      const pastaApk = pastaTemporaria('nuvem-apk');
      const c = await centralNode(8794, pastaTemporaria('nuvem-atualizacao'), undefined, { PASTA_APK: pastaApk, ATUALIZACAO_ONLINE: nuvem.url + '/atualizacao/', ATUALIZACAO_ESPERA_MS: '300', CHAVE_TELAS: chave.publica });
      try {
        const x = await esperar(async () => { const r = await (await fetch(c.url + '/api/versao')).json(); return r.versao === '9.9.9' ? r : null; }, 'a central baixou o APK da nuvem');
        igual(x.sha256, sha(apk));
        const tl = await esperar(async () => { const r = await fetch(c.url + '/telas/pacote.json'); return r.ok ? r.json() : null; }, 'a central baixou as telas da nuvem');
        igual(tl.versao, '9.9.9');
      } finally { await c.desligar(); }
      // pacote com outra assinatura: a central não aceita
      montarPacote(telasDeTeste('9.9.10'), path.join(nuvem.publico, 'telas'), chaveDeTeste(), '9.9.10', '2.0.0');
      await dormir(2500);
      const pastaApk2 = pastaTemporaria('nuvem-apk2');
      const c2 = await centralNode(8795, pastaTemporaria('nuvem-atualizacao2'), undefined, { PASTA_APK: pastaApk2, ATUALIZACAO_ONLINE: nuvem.url + '/atualizacao/', ATUALIZACAO_ESPERA_MS: '300', CHAVE_TELAS: chave.publica });
      try {
        await esperar(async () => { const r = await (await fetch(c2.url + '/api/versao')).json(); return r.versao === '9.9.9'; }, 'a central baixou o APK');
        await dormir(1500);
        igual((await fetch(c2.url + '/telas/pacote.json')).status, 404, 'telas com outra assinatura não podem entrar');
      } finally { await c2.desligar(); }
    });
  } finally {
    await nuvem.desligar();
  }
}
