/* 2.17: nomes, entrada por pessoa e aparelhos. Worker real + SQLite e centrais temporárias.
 * Uso: node testes/nuvem217.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { pbkdf2Sync, createHmac } from 'node:crypto';
import { ligarNuvemSQLite } from './nuvem-sqlite.mjs';
import { centralNode, centralJava } from './servidores.mjs';
import { conectarTeste } from './cifra.mjs';
import { novoGrupo, teste, igual, certo, resumo, SENHA_ENCARREGADO } from './teste.mjs';

const SEGREDO = 'segredo-ficticio-nuvem217';
const g = novoGrupo('Nuvem 2.17 (SQLite, Node e Java)');
const n = await ligarNuvemSQLite(8370, SEGREDO, 'leitura-ficticia217');
const pessoa = (id, nome, pin, funcoes = ['relatorios']) => ({ id, nome, nivel: 'consulta', ativo: true, funcoes,
  nuvem: { sal: 'a'.repeat(32), iteracoes: 1000, verificador: pbkdf2Sync(pin, 'a'.repeat(32), 1000, 32, 'sha256').toString('hex') } });
const pessoas = [pessoa('zoe', 'Zoe', '4567'), pessoa('ana', 'Á Ana', '6789', ['escritorio']),
  pessoa('sem', 'Sem acesso', '1122', ['corrigir']), { ...pessoa('inativa', 'Inativa', '2233'), ativo: false },
  { ...pessoa('antiga', 'Antiga', '3344'), nuvem: undefined }];
const enviar = (corpo) => n.pedir('/central/enviar', { senha: SEGREDO, corpo: { registros: [], geracao: 'g217', ...corpo } });
const entrar = async (pessoa, pin = '4567', aparelho = 'pc-217', ip = '192.0.2.1') => {
  const r = await fetch(n.url + '/aparelho/entrar', { method: 'POST', headers: { 'CF-Connecting-IP': ip }, body: JSON.stringify({ pessoa, pin, aparelho }) });
  return { status: r.status, json: await r.json() };
};
const limparTentativas = () => n.consultar('DELETE FROM tentativas_entrada RETURNING chave');
const sync = (senha, aparelho = 'pc-217') => n.pedir('/aparelho/sync', { senha, aparelho, corpo: { registros: [] } });
const campos = ['id', 'nome', 'papel', 'setor', 'operador', 'pessoa', 'versao', 'vistoEm'].sort();
const aparelho = { id: 'tablet-217', nome: 'Caldeira', papel: 'caldeira', setor: 'caldeira', operador: 'José', pessoa: '', versao: '2.17', vistoEm: 123456 };
let login;
// Observa o corpo que sai das centrais, antes da validação da nuvem.
const envios = [];
const ponte = http.createServer(async (req, res) => {
  try {
    const partes = []; for await (const p of req) partes.push(p);
    const body = Buffer.concat(partes);
    if (req.url === '/central/enviar') envios.push(JSON.parse(body));
    const r = await fetch(n.url + req.url, { method: req.method, headers: { Authorization: req.headers.authorization || '' },
      ...(['GET', 'HEAD'].includes(req.method) ? {} : { body }) });
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
  } catch { res.writeHead(502); res.end(); }
});
await new Promise((resolve) => ponte.listen(8371, '127.0.0.1', resolve));
try {
  await teste(g, 'lista pública alfabética contém somente id e nome de quem veNaNuvem', async () => {
    igual((await enviar({ pessoas })).status, 200);
    const r = await fetch(n.url + '/aparelho/pessoas');
    igual(r.status, 200); igual(await r.json(), { pessoas: [{ id: 'ana', nome: 'Á Ana' }, { id: 'zoe', nome: 'Zoe' }] });
    igual(r.headers.get('Cache-Control'), 'no-store'); igual(r.headers.get('Access-Control-Allow-Origin'), '*');
    igual((await fetch(n.url + '/aparelho/pessoas', { method: 'POST' })).status, 405);
  });
  await teste(g, 'quem chegou antes do selo (2.16.0) aparece na lista e entra (é selado na entrada)', async () => {
    const velho = JSON.stringify({ ...pessoa('velho', 'Velho', '5566'), nuvem: { sal: 'a'.repeat(32), iteracoes: 1000, verificador: pbkdf2Sync('5566', 'a'.repeat(32), 1000, 32, 'sha256').toString('hex') } });
    n.consultar(`INSERT INTO pessoas (id, json) VALUES ('velho', '${velho}') RETURNING id`);
    certo((await (await fetch(n.url + '/aparelho/pessoas')).json()).pessoas.some((p) => p.id === 'velho'), 'velho na lista');
    igual((await entrar('velho', '5566')).status, 200);
    n.consultar("DELETE FROM pessoas WHERE id = 'velho' RETURNING id"); limparTentativas();
  });
  await teste(g, 'pessoa escolhida exige a própria senha; formato inválido e pessoa sem acesso não entram', async () => {
    igual((await entrar('ana', '4567')).status, 401);
    igual((await entrar('ausente')).status, 401);
    igual((await entrar('sem', '1122')).status, 401);
    for (const id of ['', null, 7, {}, '../ana', 'a'.repeat(81)]) igual((await entrar(id)).status, 400);
    limparTentativas();
    login = await entrar('zoe'); igual(login.status, 200); igual(login.json.pessoa.id, 'zoe');
    igual((await entrar(undefined, '6789', 'pc-legado')).json.pessoa.id, 'ana');
    limparTentativas();
  });
  await teste(g, 'cinco erros por pessoa com IPs e aparelhos diferentes: 1 minuto, depois 15', async () => {
    limparTentativas();
    for (const rodada of [0, 1]) {
      for (let i = 0; i < 5; i++) igual((await entrar('zoe', '0000', `erro-${rodada}-${i}`, `198.51.${rodada}.${i + 1}`)).status, 401);
      const linha = n.consultar("SELECT * FROM tentativas_entrada WHERE chave = 'pessoa:zoe'")[0];
      const espera = rodada ? 900000 : 60000;
      certo(linha.ate - Date.now() > espera - 5000 && linha.ate - Date.now() <= espera);
      igual((await entrar('zoe', '4567', 'novo-' + rodada, '203.0.113.' + rodada)).status, 429);
      n.consultar("UPDATE tentativas_entrada SET ate = 1 WHERE chave = 'pessoa:zoe' RETURNING chave");
    }
    igual((await entrar('ana', '6789', 'outra-pessoa', '203.0.113.10')).status, 200);
    limparTentativas();
  });
  await teste(g, 'pedidos simultâneos à mesma pessoa não contornam o limite; acertos preservam erros', async () => {
    const r = await Promise.all(Array.from({ length: 12 }, (_, i) => entrar('zoe', '0000', 'paralelo-' + i, '198.18.0.' + i)));
    igual(r.filter((x) => x.status === 401).length, 5); igual(r.filter((x) => x.status === 429).length, 7);
    limparTentativas();
    for (let i = 0; i < 4; i++) igual((await entrar('zoe', '0000', 'misto-' + i, '198.18.1.' + i)).status, 401);
    for (let i = 0; i < 6; i++) igual((await entrar('zoe', '4567', 'certo-' + i, '198.18.2.' + i)).status, 200);
    igual((await entrar('zoe', '0000', 'ultimo-erro', '198.18.3.1')).status, 401);
    igual((await entrar('zoe', '4567', 'barrado', '198.18.3.2')).status, 429);
    limparTentativas();
  });
  await teste(g, 'só a chave pessoal recebe aparelhos e hora da nuvem; ausência preserva e lista vazia limpa', async () => {
    const antes = Date.now();
    igual((await enviar({ aparelhos: [aparelho], aparelhosEm: 1 })).status, 200);
    let r = await sync(login.json.token); igual(r.status, 200); igual(r.json.aparelhos, [aparelho]);
    certo(r.json.aparelhosEm >= antes && r.json.aparelhosEm <= Date.now());
    const em = r.json.aparelhosEm;
    await enviar({}); r = await sync(login.json.token); igual(r.json.aparelhosEm, em); igual(r.json.aparelhos, [aparelho]);
    const token = createHmac('sha256', SEGREDO).update('aparelho|tablet-comum').digest('hex');
    r = await sync(token, 'tablet-comum'); igual(r.status, 200);
    certo(!('aparelhos' in r.json) && !('aparelhosEm' in r.json));
    igual((await sync('chave-errada')).status, 401);
    await enviar({ aparelhos: [] }); igual((await sync(login.json.token)).json.aparelhos, []);
  });
  await teste(g, 'aparelhos: até 200, textos até 80, timestamp inteiro; campos privados recusados sem gravar', async () => {
    igual((await enviar({ aparelhos: Array.from({ length: 200 }, (_, i) => ({ ...aparelho, id: 't-' + i, nome: 'n'.repeat(80) })) })).status, 200);
    const antes = n.consultar("SELECT * FROM info WHERE chave IN ('aparelhos', 'aparelhosEm') ORDER BY chave");
    for (const lista of [null, {}, Array(201).fill(aparelho), [null], [{ ...aparelho, nome: 'n'.repeat(81) }],
      [{ ...aparelho, setor: 1 }], [{ ...aparelho, vistoEm: -1 }], [{ ...aparelho, vistoEm: '1' }], [{ ...aparelho, vistoEm: 1.5 }],
      ...['ip', 'chave', 'codigo', 'info', 'extra'].map((k) => [{ ...aparelho, [k]: 'privado' }])]) {
      igual((await enviar({ aparelhos: lista })).status, 400);
      igual(n.consultar("SELECT * FROM info WHERE chave IN ('aparelhos', 'aparelhosEm') ORDER BY chave"), antes);
    }
  });
  await teste(g, 'troca explícita de geração sem lista não conserva aparelhos da central anterior', async () => {
    await enviar({ aparelhos: [aparelho] });
    igual((await enviar({ geracao: 'nova217', geracoesZeradas: ['g217'], pessoas })).status, 200);
    login = await entrar('zoe'); igual(login.status, 200);
    const r = await sync(login.json.token); igual(r.json.aparelhos, []); igual(r.json.aparelhosEm, 0);
  });
  for (const [nome, ligar, porta] of [['Node', centralNode, 8372], ['Java', centralJava, 8373]]) {
    const c = await ligar(porta);
    let inicio, cli;
    try {
      await teste(g, `${nome}: envio real contém os oito campos públicos, setor e último sinal, sem ip/Android`, async () => {
        await c.cliente();
        cli = await conectarTeste(c.url, c.codigo(), 'tablet-' + nome);
        const r = await cli.pedir('/api/sync', { corpo: { aparelho: cli.aparelho, papel: 'caldeira', operador: 'José', versao: '2.17',
          info: { modelo: 'Android privado' }, registros: [] } });
        igual(r.status, 200);
        inicio = envios.length;
        await c.api('/api/chefes', { acao: 'liberar', pin: SENHA_ENCARREGADO, nivel: 3 });
        await c.api('/api/pessoas', { acao: 'entrar', pin: SENHA_ENCARREGADO });
        const anterior = (await n.pedir('/central/estado', { senha: SEGREDO })).json.geracao;
        igual((await enviar({ geracao: r.json.geracao, geracoesZeradas: [anterior] })).status, 200);
        await c.api('/api/nuvem', { acao: 'configurar', url: 'http://127.0.0.1:8371', segredo: SEGREDO });
        const envio = await c.api('/api/nuvem', { acao: 'enviar' }); certo(!envio.erro, envio.erro);
        const foto = envios.slice(inicio).find((x) => x.aparelhos)?.aparelhos;
        certo(Array.isArray(foto), 'a central não enviou aparelhos');
        for (const a of foto) igual(Object.keys(a).sort(), campos);
        const a = foto.find((x) => x.id === cli.aparelho); certo(a, 'faltou o tablet');
        igual(a.setor, 'caldeira'); igual(a.operador, 'José'); igual(a.versao, '2.17');
        certo(Number.isSafeInteger(a.vistoEm) && Date.now() - a.vistoEm < 15000);
        igual(JSON.parse(n.consultar("SELECT valor FROM info WHERE chave = 'aparelhos'")[0].valor), foto);
      });
      await teste(g, `${nome}: envios repetidos e reinício respeitam um minuto; depois renova sem anotações`, async () => {
        for (let i = 0; i < 2; i++) await c.api('/api/nuvem', { acao: 'enviar' });
        await c.reiniciar();
        await c.api('/api/nuvem', { acao: 'enviar' });
        igual(envios.slice(inicio).filter((x) => x.aparelhos).length, 1);
        // Avança somente a marca do envio no config temporário: dispensa esperar um minuto real por central.
        await c.desligar();
        const arquivo = path.join(c.pastaServidor, 'config.json'), cfg = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
        cfg.nuvem.aparelhosEnviadosEm = Date.now() - 61000;
        fs.writeFileSync(arquivo, JSON.stringify(cfg));
        await c.reiniciar();
        await cli.pedir('/api/sync', { corpo: { aparelho: cli.aparelho, papel: 'caldeira', operador: 'Maria', versao: '2.17', registros: [] } });
        await c.api('/api/nuvem', { acao: 'enviar' });
        const fotos = envios.slice(inicio).filter((x) => x.aparelhos);
        igual(fotos.length, 2); igual(fotos[1].aparelhos.find((a) => a.id === cli.aparelho).operador, 'Maria');
      });
    } finally { await c.desligar(); }
  }
} finally {
  await new Promise((resolve) => ponte.close(resolve));
  await n.desligar();
}
const r = resumo([g]); console.log(`\n${r.passaram} de ${r.total} testes passaram`); process.exitCode = r.falharam ? 1 : 0;
