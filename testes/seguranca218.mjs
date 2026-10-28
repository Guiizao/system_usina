/* 2.18: permissões e senha nas duas centrais; APK assinado na central Node. Só dados temporários. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { centralNode, centralJava, pastaTemporaria, APP } from './servidores.mjs';
import { conectarTeste } from './cifra.mjs';
import { teste, certo, igual, novoGrupo, resumo, SENHA_ENCARREGADO, usinaNoContexto } from './teste.mjs';

const grupos = [], inicial = '159357';
const pedir = async (cli, rota, corpo) => { const r = await cli.pedir(rota, { corpo }); return { ...r.json, status: r.status }; };
const pessoa = (cli, corpo) => pedir(cli, '/api/pessoas', corpo);
const liberar = (cli, pin, nivel = 3) => pedir(cli, '/api/chefes', { acao: 'liberar', pin, nivel });
const entrar = (cli, pin, novaSenha) => pessoa(cli, { acao: 'entrar', pin, ...(novaSenha === undefined ? {} : { novaSenha }) });
const esperar = async (fn) => { for (let i = 0; i < 60; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 100)); } throw Error('não terminou em 6 segundos'); };

for (const [nome, ligar, porta] of [['node', (p, d, x) => centralNode(p, d, undefined, x), 18280], ['java', centralJava, 18281]]) {
  if (process.argv[2] && process.argv[2] !== nome) continue;
  const g = novoGrupo('Segurança 2.18 — ' + nome); grupos.push(g);
  const c = await ligar(porta, pastaTemporaria('seguranca218'), { DONO_INICIAL: true });
  const cfg = () => JSON.parse(fs.readFileSync(path.join(c.pastaServidor, 'config.json'), 'utf8'));
  const dono = await conectarTeste(c.url, c.codigo(), 'dono-218');
  try {
    await liberar(dono, inicial);
    await teste(g, 'X2: senha inicial pede troca, não cria sessão nem verificador da nuvem', async () => {
      const r = await entrar(dono, inicial);
      igual(r.status, 403); igual(r.pedeTrocarSenha, true);
      igual((await pessoa(dono, { acao: 'quem' })).pessoa, null);
      certo(!cfg().pessoas[0].nuvem, 'não exportar credencial inicial');
      igual((await pessoa(dono, { acao: 'lista' })).status, 403);
    });
    await teste(g, 'X2: verificar no setor também exige troca; mesma senha ou malformada não resolve', async () => {
      for (const novaSenha of [undefined, inicial, '123', 123456]) {
        const r = await pessoa(dono, { acao: 'verificar', pin: inicial, novaSenha });
        igual(r.status, 403); igual(r.pedeTrocarSenha, true);
      }
    });
    await teste(g, 'X2: troca autenticada, senha velha recusada e nova persiste após reinício', async () => {
      igual((await entrar(dono, inicial, SENHA_ENCARREGADO)).status, 200);
      igual((await entrar(dono, inicial)).status, 403);
      await c.reiniciar();
      igual((await entrar(dono, SENHA_ENCARREGADO)).status, 200);
      certo(!cfg().pessoas[0].pedeTrocarSenha, 'troca persistida');
      certo(cfg().pessoas[0].nuvem, 'credencial nova disponível para nuvem');
    });
    // Mantém os demais cenários executáveis também no código anterior (prova de regressão).
    if ((await entrar(dono, SENHA_ENCARREGADO)).status !== 200) {
      await entrar(dono, inicial);
      await pessoa(dono, { acao: 'salvar', pessoa: { id: cfg().pessoas[0].id, nome: 'Guilherme', nivel: 'administrador', pin: SENHA_ENCARREGADO } });
      await entrar(dono, SENHA_ENCARREGADO);
    }
    const ctx = { window: {} }; usinaNoContexto(ctx);
    await pedir(dono, '/api/nuvem', { acao: 'forms', forms: ctx.window.USINA });
    const adm = await conectarTeste(c.url, c.codigo(), 'bia-218');
    const esc = await conectarTeste(c.url, c.codigo(), 'lucas-218');
    const op = await conectarTeste(c.url, c.codigo(), 'operador-218');
    await pessoa(dono, { acao: 'salvar', pessoa: { nome: 'Bia', nivel: 'administrador', pin: '2222' } });
    await pessoa(dono, { acao: 'salvar', pessoa: { nome: 'Lucas', nivel: 'consulta', pin: '3333', extras: { escritorio: true } } });
    await liberar(adm, SENHA_ENCARREGADO, 2); await entrar(adm, '2222');
    await liberar(esc, SENHA_ENCARREGADO, 2); await entrar(esc, '3333');
    const recebidos = [];
    const destino = http.createServer((req, res) => { recebidos.push(req.headers); req.resume(); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}'); });
    await new Promise(r => destino.listen(0, '127.0.0.1', r));
    const url = 'http://127.0.0.1:' + destino.address().port;
    try {
      await teste(g, 'X1: administrador nível 2 e dono nível 2 não configuram Nuvem nem Base44', async () => {
        const baixo = await conectarTeste(c.url, c.codigo(), 'dono-baixo');
        await liberar(baixo, SENHA_ENCARREGADO, 2); await entrar(baixo, SENHA_ENCARREGADO);
        for (const cli of [adm, baixo]) for (const rota of ['nuvem', 'base44']) {
          igual((await pedir(cli, '/api/' + rota, { acao: 'configurar', url: rota === 'nuvem' ? url : url + '/totais', segredo: 'roubado' })).status, 403);
        }
      });
      await teste(g, 'X1: dono nível 3 configura; mudar endereço limpa segredo e não o transmite', async () => {
        for (const rota of ['nuvem', 'base44']) {
          const novo = rota === 'nuvem' ? url : url + '/totais';
          igual((await pedir(dono, '/api/' + rota, { acao: 'configurar', url: rota === 'nuvem' ? 'http://127.0.0.1:1' : 'http://127.0.0.1:1/totais', segredo: 'senha-antiga218' })).status, 200);
          igual((await pedir(dono, '/api/' + rota, { acao: 'configurar', url: novo })).status, 200);
          igual(cfg()[rota].segredo, '');
        }
        igual((await pedir(dono, '/api/nuvem', { acao: 'enviar' })).status, 400);
        await new Promise(r => setTimeout(r, 700));
        certo(!JSON.stringify(recebidos).includes('senha-antiga218'), 'segredo antigo chegou ao outro endereço');
      });
      await teste(g, 'X1: mesmo endereço conserva a senha; troca explícita aceita credencial nova', async () => {
        for (const rota of ['nuvem', 'base44']) {
          const alvo = rota === 'nuvem' ? 'http://127.0.0.1:1' : 'http://127.0.0.1:1/totais';
          await pedir(dono, '/api/' + rota, { acao: 'configurar', url: alvo, segredo: 'nova218' });
          await pedir(dono, '/api/' + rota, { acao: 'configurar', url: alvo });
          igual(cfg()[rota].segredo, 'nova218');
          await pedir(dono, '/api/' + rota, { acao: 'configurar', url: '' });
          igual(cfg()[rota].segredo, '');
        }
      });
    } finally { await new Promise(r => destino.close(r)); }
    const dia = new Date(Date.now() - 7 * 3600000).toLocaleDateString('en-CA');
    const sync = (cli, registros, papel = 'central') => pedir(cli, '/api/sync', { aparelho: cli.aparelho, papel, registros });
    await sync(dono, []); await sync(adm, []);
    await teste(g, 'X3: Bia não bloqueia nível 3 com senha, trava ou apagamento', async () => {
      for (const extra of [{ modo: 'senha', codigo: '4321' }, { modo: 'trava' }, { modo: 'trava', apagar: true }]) {
        igual((await pedir(adm, '/api/aparelhos', { acao: 'bloquear', id: dono.aparelho, ...extra })).status, 403);
      }
      certo(!cfg().bloqueios[dono.aparelho], 'dono continua livre');
    });
    await teste(g, 'X3: dono bloqueia outro nível 3; administrador continua bloqueando nível 2', async () => {
      const outro = await conectarTeste(c.url, c.codigo(), 'outro-dono218');
      await liberar(outro, SENHA_ENCARREGADO); await sync(outro, []);
      igual((await pedir(dono, '/api/aparelhos', { acao: 'bloquear', id: outro.aparelho, modo: 'trava', apagar: true })).status, 200);
      igual((await pedir(adm, '/api/aparelhos', { acao: 'desbloquear', id: outro.aparelho })).status, 403);
      igual((await pedir(dono, '/api/aparelhos', { acao: 'desbloquear', id: outro.aparelho })).status, 200);
      await sync(esc, []);
      igual((await pedir(adm, '/api/aparelhos', { acao: 'bloquear', id: esc.aparelho, modo: 'trava' })).status, 200);
      await pedir(adm, '/api/aparelhos', { acao: 'desbloquear', id: esc.aparelho }); await entrar(esc, '3333');
    });
    let hora = Date.now();
    const reg = (chave, valores, extra = {}) => ({ id: `${dia}|ins_cal|${chave}`, data: dia, prancheta: 'ins_cal', chave, valores, atualizadoEm: ++hora, operador: 'Operador', ...extra });
    const ler = async (id) => (await pedir(dono, '/api/registros?desde=0')).registros.find(r => r.id === id);
    const original = reg('8', { qtd: '3', unidade: 'copos' });
    await sync(op, [original], 'hidrolise');
    await teste(g, 'X7: Escritório preenche lote, NF e validade sem corrigir quantidade', async () => {
      const r = { ...original, atualizadoEm: ++hora, valores: { ...original.valores, lote: 'L-218', nf: '123', validade: '2027-01-01' } };
      igual((await sync(esc, [r])).aceitos, 1);
      igual((await ler(r.id)).valores.lote, 'L-218');
      const meta = reg('meta', { lote: 'L-218', verificado: 'Lucas' });
      igual((await sync(esc, [meta])).aceitos, 1);
      igual((await ler(meta.id)).valores.verificado, 'Lucas');
    });
    await teste(g, 'X7: Escritório não altera quantidade, autoria, relógio de quantidade nem apaga linha', async () => {
      const atual = await ler(original.id);
      for (const extra of [{ valores: { ...atual.valores, qtd: '99' } }, { operador: 'Outro' }, { apagado: true }, { camposEm: { qtd: hora } }]) {
        const r = { ...atual, atualizadoEm: ++hora, ...extra };
        igual((await sync(esc, [r])).recusados[0]?.motivo, 'sem_permissao');
      }
      igual((await ler(original.id)).valores.qtd, '3');
    });
    await teste(g, 'X7: operador não muda campos protegidos; senha do Escritório no setor permite', async () => {
      const atual = await ler(original.id);
      await sync(op, [{ ...atual, atualizadoEm: ++hora, valores: { ...atual.valores, lote: 'invasao' } }], 'hidrolise');
      igual((await ler(original.id)).valores.lote, 'L-218');
      const meta = reg('meta', { lote: 'invasao', verificado: 'invasao' });
      await sync(op, [meta], 'hidrolise');
      igual((await ler(meta.id)).valores.verificado, 'Lucas');
      igual((await pessoa(op, { acao: 'verificar', pin: '3333' })).status, 200);
      igual((await sync(op, [{ ...atual, atualizadoEm: ++hora, valores: { ...atual.valores, lote: 'L-setor' } }], 'hidrolise')).aceitos, 1);
      igual((await ler(original.id)).valores.lote, 'L-setor');
    });
    await teste(g, 'X1/X3: registro contém configurações e bloqueio, sem segredos', async () => {
      const r = await pedir(dono, '/api/registro?dia=' + dia);
      const textos = JSON.stringify(r.registros);
      certo(textos.includes('configurou a Nuvem') && textos.includes('configurou o Base44') && textos.includes('bloqueou'), 'ações registradas');
      certo(!textos.includes('senha-antiga218') && !textos.includes('nova218'), 'registro sem senha');
    });
    await teste(g, 'X2: migração invalida sessões antigas e a credencial da nuvem se o dono nunca trocou a senha', async () => {
      await c.desligar();
      const legado = cfg(), p = legado.pessoas.find(p => p.id === legado.donoId);
      let h = crypto.createHash('sha256').update(p.sal + ':' + inicial).digest();
      for (let i = 0; i < 20000; i++) h = crypto.createHmac('sha256', h).update(inicial).digest();
      p.resumo = h.toString('hex'); delete p.pedeTrocarSenha;
      legado.sessoes[dono.aparelho] = { pessoaId: p.id, em: Date.now() };
      fs.writeFileSync(path.join(c.pastaServidor, 'config.json'), JSON.stringify(legado));
      await c.reiniciar();
      igual((await pessoa(dono, { acao: 'quem' })).pessoa, null);
      igual((await entrar(dono, inicial)).pedeTrocarSenha, true);
      certo(!cfg().pessoas.find(x => x.id === p.id).nuvem, 'credencial padrão não vai para nuvem');
    });
  } finally { await c.desligar(); }
}

if (!process.argv[2] || process.argv[2] === 'node') {
  const g = novoGrupo('Pacote público e APK 2.18'); grupos.push(g);
  await teste(g, 'X2: forms público só tem resumo SHA-256 da senha de emergência', async () => {
    const forms = fs.readFileSync(path.join(APP, 'public/config/forms.js'), 'utf8');
    certo(!forms.includes(inicial) && !/pinAdmin\s*:/.test(forms), 'PIN não pode sair no pacote');
    const ctx = { window: {} }; usinaNoContexto(ctx);
    igual(ctx.window.USINA.resumoAdmin, crypto.createHash('sha256').update(inicial).digest('hex'));
  });
  const pasta = pastaTemporaria('apk218');
  const keys = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const chave = keys.publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  const apk = Buffer.from('APK ficticio assinado218');
  let manifesto = Buffer.from(JSON.stringify({ versao: '9.8.0', tamanho: apk.length, sha256: crypto.createHash('sha256').update(apk).digest('hex') }));
  let assinatura = '', downloads = 0, consultas = 0;
  const online = http.createServer((req, res) => {
    if (req.url.endsWith('/versao.json')) { consultas++; res.end(manifesto); }
    else if (req.url.endsWith('/versao.sig')) { if (!assinatura) res.statusCode = 404; res.end(assinatura); }
    else if (req.url.endsWith('/pranchetas.apk')) { downloads++; res.end(apk); }
    else { res.statusCode = 404; res.end(); }
  });
  await new Promise(r => online.listen(0, '127.0.0.1', r));
  const destino = path.join(pasta, 'apk');
  const c = await centralNode(18282, path.join(pasta, 'dados-teste'), undefined, { PASTA_APK: destino, CHAVE_TELAS: chave,
    ATUALIZACAO_ONLINE: `http://127.0.0.1:${online.address().port}/atualizacao/`, ATUALIZACAO_ESPERA_MS: '100' });
  const rodada = async () => { const antes = consultas; await c.reiniciar(); await esperar(() => consultas > antes); await new Promise(r => setTimeout(r, 250)); };
  try {
    await teste(g, 'X4: manifesto sem assinatura não baixa nem oferece APK', async () => {
      await esperar(() => consultas > 0); await new Promise(r => setTimeout(r, 250));
      igual(downloads, 0); certo(!fs.existsSync(path.join(destino, 'pranchetas.apk')), 'não instalou APK sem assinatura');
    });
    await teste(g, 'X4: assinatura de outra chave e manifesto adulterado são recusados', async () => {
      assinatura = crypto.sign('sha256', manifesto, crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey).toString('base64');
      await rodada(); igual(downloads, 0);
      assinatura = crypto.sign('sha256', manifesto, keys.privateKey).toString('base64');
      manifesto = Buffer.from(manifesto.toString().replace('9.8.0', '9.9.0'));
      await rodada(); igual(downloads, 0);
    });
    await teste(g, 'X4: manifesto válido continua exigindo hash do APK e tamanho corretos', async () => {
      const original = manifesto;
      manifesto = Buffer.from(JSON.stringify({ ...JSON.parse(original), sha256: '0'.repeat(64) }));
      assinatura = crypto.sign('sha256', manifesto, keys.privateKey).toString('base64');
      await rodada(); certo(!fs.existsSync(path.join(destino, 'pranchetas.apk')), 'hash errado recusado');
      manifesto = Buffer.from(JSON.stringify({ ...JSON.parse(original), tamanho: 1 }));
      assinatura = crypto.sign('sha256', manifesto, keys.privateKey).toString('base64');
      await rodada(); certo(!fs.existsSync(path.join(destino, 'pranchetas.apk')), 'tamanho errado recusado');
      manifesto = original;
    });
    await teste(g, 'X4: manifesto assinado e APK íntegro são oferecidos', async () => {
      assinatura = crypto.sign('sha256', manifesto, keys.privateKey).toString('base64');
      await rodada();
      igual(fs.readFileSync(path.join(destino, 'pranchetas.apk')).toString(), apk.toString());
      const v = await (await fetch(c.url + '/api/versao')).json(); igual(v.versao, '9.9.0');
    });
    await teste(g, 'X4: gerador assina versao.json com a mesma chave das telas', async () => {
      const build = path.join(pasta, 'build');
      for (const rel of ['apk/versao-do-apk.js', 'public/nucleo/base.js', 'public/config/novidades.js']) {
        fs.mkdirSync(path.dirname(path.join(build, rel)), { recursive: true }); fs.copyFileSync(path.join(APP, rel), path.join(build, rel));
      }
      fs.mkdirSync(path.join(build, 'apk/saida'), { recursive: true }); fs.writeFileSync(path.join(build, 'apk/saida/pranchetas.apk'), apk);
      fs.writeFileSync(path.join(build, 'chave.pem'), keys.privateKey.export({ format: 'pem', type: 'pkcs8' }));
      execFileSync(process.execPath, [path.join(build, 'apk/versao-do-apk.js'), 'json'], { env: { ...process.env,
        PRANCHETAS_CHAVE_TELAS: path.join(build, 'chave.pem'), PRANCHETAS_CHAVE_PUBLICA: path.join(build, 'publica.txt') }, stdio: 'inherit' });
      certo(crypto.verify('sha256', fs.readFileSync(path.join(build, 'apk/saida/versao.json')), keys.publicKey,
        Buffer.from(fs.readFileSync(path.join(build, 'apk/saida/versao.sig'), 'utf8'), 'base64')), 'assinatura verificável');
    });
  } finally { await c.desligar(); await new Promise(r => online.close(r)); }
}
const r = resumo(grupos); console.log(`\n${r.passaram} de ${r.total} testes passaram`); process.exitCode = r.falharam ? 1 : 0;
