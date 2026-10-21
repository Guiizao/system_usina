/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Versões 2.7 e 2.8: o aplicativo se atualiza sozinho.
 *   - a central diz em /api/versao qual APK ela tem e entrega o pacote das telas em /telas/ (atualização rápida);
 *   - o pacote das telas é assinado (gerar-apk.ps1) e o AtualizadorDeTelas (Java) confere a assinatura e cada arquivo;
 *   - no aplicativo, a janela da versão nova abre sozinha; a rápida baixa as telas com a barra, a de APK abre o Android;
 *   - com a nuvem, a central do computador baixa o APK novo, confere e passa a entregar;
 *   - depois de atualizar, a janela com as novidades aparece uma vez.
 * O Android aqui é de mentira: o teste finge o plugin nativo e guarda o que o aplicativo pediu para ele.
 * As chaves e as versões daqui são de teste (a chave de verdade fica só no computador do Guilherme).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { TAMANHOS, dormir } from './navegador.mjs';
import { teste, certo, igual } from './teste.mjs';
import { centralNode, centralJava, pastaTemporaria, APP } from './servidores.mjs';
import { conectarTeste } from './cifra.mjs';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const VERSAO = /const VERSAO = '([\d.]+)'/.exec(fs.readFileSync(path.join(APP, 'public', 'nucleo', 'base.js'), 'utf8'))[1];
const JDK = path.join(os.homedir(), 'android-build', 'jdk', 'bin');
function novidades() {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(APP, 'public', 'config', 'novidades.js'), 'utf8'), ctx);
  return ctx.window.NOVIDADES;
}

/** APK de mentira (bytes aleatórios) com o versao.json do lado, como o gerar-apk.ps1 deixa. */
function apkFalso(pasta, versao, tamanho = 300000) {
  fs.mkdirSync(pasta, { recursive: true });
  const bytes = crypto.randomBytes(tamanho);
  fs.writeFileSync(path.join(pasta, 'pranchetas.apk'), bytes);
  const info = { versao, tamanho, sha256: sha(bytes), novidades: [{ versao, data: '2026-10-01', itens: ['Teste de atualização'] }] };
  fs.writeFileSync(path.join(pasta, 'versao.json'), JSON.stringify(info));
  return info;
}

/** Chave de teste para assinar as telas (a de verdade fica só no computador do Guilherme). */
export function chaveDeTeste() {
  const pasta = pastaTemporaria('chave');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const privada = path.join(pasta, 'chave.pem');
  fs.writeFileSync(privada, privateKey.export({ format: 'pem', type: 'pkcs8' }));
  return { privada, publicaArquivo: path.join(pasta, 'chave-telas.txt'), publica: publicKey.export({ format: 'der', type: 'spki' }).toString('base64') };
}
/** Telas pequenas de teste (index.html, um script e um arquivo numa subpasta). */
export function telasDeTeste(texto = 'versão de teste') {
  const pasta = pastaTemporaria('telas-origem');
  fs.writeFileSync(path.join(pasta, 'index.html'), `<!doctype html><title>${texto}</title>`);
  fs.writeFileSync(path.join(pasta, 'app.js'), `console.log(${JSON.stringify(texto)});`);
  fs.mkdirSync(path.join(pasta, 'fonts'));
  fs.writeFileSync(path.join(pasta, 'fonts', 'letra.woff2'), crypto.randomBytes(5000));
  return pasta;
}
/** Monta o pacote das telas com o mesmo programa do gerar-apk.ps1 (versao-do-apk.js telas), com a chave de teste. */
export function montarPacote(origem, destino, chave, versao, apkMinimo) {
  execFileSync(process.execPath, [path.join(APP, 'apk', 'versao-do-apk.js'), 'telas', origem, destino], {
    env: Object.assign({}, process.env, { PRANCHETAS_CHAVE_TELAS: chave.privada, PRANCHETAS_CHAVE_PUBLICA: chave.publicaArquivo, PRANCHETAS_VERSAO: versao, APK_MINIMO: apkMinimo }), stdio: 'inherit',
  });
  return JSON.parse(fs.readFileSync(path.join(destino, 'pacote.json'), 'utf8'));
}

/** O AtualizadorDeTelas.java (o mesmo do APK) rodando no computador. */
let javaPronto = null;
function atualizadorJava(base, versao, chave, nativa, pastaTelas, pastaAtual) {
  if (!javaPronto) {
    javaPronto = pastaTemporaria('java-telas');
    const fontes = [];
    const juntar = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? juntar(path.join(d, e.name)) : e.name.endsWith('.java') && fontes.push(path.join(d, e.name))));
    juntar(path.join(APP, 'testes', 'java', 'stubs'));
    fontes.push(path.join(APP, 'apk', 'nativo', 'java', 'br', 'com', 'ubiralcool', 'pranchetas', 'AtualizadorDeTelas.java'), path.join(APP, 'testes', 'java', 'TestarTelas.java'));
    execFileSync(path.join(JDK, 'javac.exe'), ['-encoding', 'UTF-8', '-d', javaPronto, ...fontes], { stdio: 'pipe' });
  }
  const saida = execFileSync(path.join(JDK, 'java.exe'), ['-cp', javaPronto, 'TestarTelas', base, versao, chave, nativa, pastaTelas, pastaAtual], { encoding: 'utf8' });
  return JSON.parse(saida.trim().split('\n').pop());
}

/** Uma nuvem de mentira: entrega o versao.json e o pranchetas.apk de uma pasta. */
function nuvemFalsa(porta, pasta) {
  const s = http.createServer((req, res) => {
    const f = path.join(pasta, path.basename(new URL(req.url, 'http://x').pathname));
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200);
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((ok) => s.listen(porta, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${porta}/atualizacao/`, fechar: () => new Promise((f) => s.close(f)) })));
}

/** O plugin nativo do Android, de mentira: responde o básico e guarda os pedidos de atualizar. */
const ANDROID_FALSO = (nativa) => `(() => {
  window.__pedidosAtualizar = [];
  window.__respostasAtualizar = [];
  window.__pedidosTelas = [];
  window.__telasOk = 0;
  const ouvintes = {};
  const central = {
    permissaoRede: async () => ({ estado: 'livre' }),
    estado: async () => ({ rodando: false }),
    telaCheia: async () => ({ ligada: false }),
    versaoInstalada: async () => ({ versao: ${JSON.stringify(nativa)} }),
    telasOk: async () => { window.__telasOk++; return { voltou: '' }; },
    addListener: async (nome, f) => { ouvintes[nome] = f; return { remove() { delete ouvintes[nome]; } }; },
    atualizar: async (o) => {
      window.__pedidosAtualizar.push(o);
      if (ouvintes.progressoAtualizacao) ouvintes.progressoAtualizacao({ baixado: 1, total: 2 });
      const r = window.__respostasAtualizar.shift() || { aberto: true };
      if (r.erro) throw new Error(r.erro);
      return r;
    },
    atualizarTelas: async (o) => {
      window.__pedidosTelas.push(o);
      if (ouvintes.progressoTelas) ouvintes.progressoTelas({ feito: 3, total: 4 });
      return { pronto: true, versao: o.versao };
    },
  };
  window.Capacitor = { isNativePlatform: () => true, Plugins: { Central: new Proxy(central, { get: (t, k) => (k in t ? t[k] : k === 'then' ? undefined : async () => ({})) }) } };
})();`;

async function esperarVersao(url, versao, ms = 15000) {
  const t0 = Date.now();
  let v = {};
  while (Date.now() - t0 < ms) {
    v = await (await fetch(url + '/api/versao')).json();
    if (v.versao === versao) return v;
    await dormir(300);
  }
  return v;
}
const modalTem = (texto) => `document.querySelector(".modal") && document.querySelector(".modal").textContent.includes(${JSON.stringify(texto)})`;

export async function testarAtualizacao(nav, grupo) {
  await teste(grupo, 'novidades.js começa pela versão atual do aplicativo', async () => {
    const n = novidades();
    igual(n[0].versao, VERSAO, 'a primeira novidade tem de ser a da versão do app.js');
    certo(n[0].itens.length > 0, 'sem itens');
    return `${VERSAO}: ${n[0].itens.length} itens`;
  });

  // ---------- pacote das telas: montado e conferido ----------
  const chave = chaveDeTeste();
  const pastaApk = pastaTemporaria('apk-saida');
  const origem = telasDeTeste('9.5.0');
  let pacote;
  await teste(grupo, 'pacote das telas: lista de cada arquivo com SHA-256 e assinatura que confere', async () => {
    pacote = montarPacote(origem, path.join(pastaApk, 'telas'), chave, '9.5.0', '2.0.0');
    igual(pacote.versao, '9.5.0'); igual(pacote.apkMinimo, '2.0.0');
    igual(Object.keys(pacote.arquivos).sort(), ['app.js', 'chave-telas.txt', 'fonts/letra.woff2', 'index.html']);
    igual(pacote.arquivos['app.js'].sha256, sha(fs.readFileSync(path.join(origem, 'app.js'))));
    const dados = fs.readFileSync(path.join(pastaApk, 'telas', 'pacote.json'));
    const assinatura = Buffer.from(fs.readFileSync(path.join(pastaApk, 'telas', 'pacote.sig'), 'utf8'), 'base64');
    certo(crypto.verify('sha256', dados, crypto.createPublicKey({ key: Buffer.from(chave.publica, 'base64'), format: 'der', type: 'spki' }), assinatura), 'a assinatura não confere');
    igual(fs.readFileSync(path.join(origem, 'chave-telas.txt'), 'utf8').trim(), chave.publica, 'a chave pública vai junto das telas (dentro do APK)');
  });

  // ---------- central do computador ----------
  const c = await centralNode(8181, pastaTemporaria('atualizacao'), undefined, { PASTA_APK: pastaApk });
  const aparelhos = [];
  let info;
  try {
    await teste(grupo, 'central sem APK gerado: não oferece APK', async () => {
      igual((await (await fetch(c.url + '/api/versao')).json()).versao, null);
    });
    await teste(grupo, 'central com APK novo: diz a versão, o tamanho, o SHA-256 e as novidades', async () => {
      info = apkFalso(pastaApk, '9.1.0');
      const v = await (await fetch(c.url + '/api/versao')).json();
      igual(v.versao, '9.1.0'); igual(v.tamanho, info.tamanho); igual(v.sha256, info.sha256); igual(v.url, '/apk/pranchetas.apk');
      igual(v.novidades[0].itens[0], 'Teste de atualização');
      const apk = Buffer.from(await (await fetch(c.url + '/apk/pranchetas.apk')).arrayBuffer());
      igual(sha(apk), info.sha256, 'o APK que a central entrega tem de ser o do versao.json');
    });
    await teste(grupo, 'APK trocado sem o versao.json novo: a central não oferece (não instala arquivo errado)', async () => {
      fs.appendFileSync(path.join(pastaApk, 'pranchetas.apk'), 'x');
      igual((await (await fetch(c.url + '/api/versao')).json()).versao, null);
      info = apkFalso(pastaApk, '9.1.0');
    });
    await teste(grupo, 'central entrega o pacote das telas (e nada fora da pasta dele)', async () => {
      const p = await (await fetch(c.url + '/telas/pacote.json')).json();
      igual(p.versao, '9.5.0');
      igual(await (await fetch(c.url + '/telas/fonts/letra.woff2')).arrayBuffer().then((b) => sha(Buffer.from(b))), pacote.arquivos['fonts/letra.woff2'].sha256);
      igual((await fetch(c.url + '/telas/%2e%2e/versao.json')).status, 404, 'não pode sair da pasta das telas');
    });

    // ---------- o AtualizadorDeTelas (Java, o mesmo do APK) baixando da central ----------
    const pastaTelas = pastaTemporaria('telas-tablet');
    const vazia = pastaTemporaria('telas-vazia');
    let primeira;
    await teste(grupo, 'atualização rápida (Java): baixa o pacote, confere a assinatura e cada arquivo', async () => {
      primeira = atualizadorJava(c.url + '/telas/', '9.5.0', chave.publica, '2.8.0', pastaTelas, vazia);
      certo(primeira.ok, 'erro: ' + primeira.erro);
      igual(primeira.baixados, 4); igual(primeira.copiados, 0);
      igual(fs.readFileSync(path.join(primeira.pasta, 'app.js'), 'utf8'), fs.readFileSync(path.join(origem, 'app.js'), 'utf8'));
      certo(fs.existsSync(path.join(primeira.pasta, 'pacote.sig')), 'guarda o pacote assinado (para entregar a outros tablets)');
    });
    await teste(grupo, 'atualização rápida (Java): o que não mudou é copiado, não baixa de novo', async () => {
      const r = atualizadorJava(c.url + '/telas/', '9.5.0', chave.publica, '2.8.0', pastaTemporaria('telas-tablet2'), primeira.pasta);
      certo(r.ok, 'erro: ' + r.erro);
      igual(r.copiados, 4); igual(r.baixados, 0);
    });
    await teste(grupo, 'atualização rápida (Java): recusa assinatura errada, arquivo alterado e pacote que pede APK mais novo', async () => {
      const outra = chaveDeTeste();
      const r1 = atualizadorJava(c.url + '/telas/', '9.5.0', outra.publica, '2.8.0', pastaTemporaria('t1'), vazia);
      certo(!r1.ok && /assinatura/.test(r1.erro), 'assinatura: ' + JSON.stringify(r1));
      const r2 = atualizadorJava(c.url + '/telas/', '9.5.0', chave.publica, '1.9.0', pastaTemporaria('t2'), vazia);
      certo(!r2.ok && /APK novo/.test(r2.erro), 'APK mínimo: ' + JSON.stringify(r2));
      const alvo = path.join(pastaApk, 'telas', 'app.js');
      const original = fs.readFileSync(alvo);
      fs.writeFileSync(alvo, 'console.log("telas alteradas por alguém no Wi-Fi")');
      try {
        const r3 = atualizadorJava(c.url + '/telas/', '9.5.0', chave.publica, '2.8.0', pastaTemporaria('t3'), vazia);
        certo(!r3.ok && /defeito|tamanho/.test(r3.erro), 'arquivo alterado: ' + JSON.stringify(r3));
      } finally { fs.writeFileSync(alvo, original); }
    });

    // ---------- o aplicativo (APK, com o Android de mentira) ----------
    const cli = await conectarTeste(c.url, c.codigo());
    const a = await nav.novoAparelho('tablet com o aplicativo', TAMANHOS.tablet);
    aparelhos.push(a);
    await a.antesDeAbrir(ANDROID_FALSO('2.8.0'));
    await a.ir(c.url + '/api/ping'); // mesma origem: guarda os ajustes de um tablet já conectado antes de abrir o app
    await a.avaliar(`localStorage.setItem('usina.cfg', JSON.stringify({ deviceId: ${JSON.stringify(cli.aparelho)}, chave: ${JSON.stringify(cli.chave)}, cifra: 1, central: ${JSON.stringify(c.url)}, papel: 'hidrolise', ultimoContato: Date.now(), versaoVista: ${JSON.stringify(VERSAO)}, op: null }))`);
    await a.ir(c.url + '/');

    // 2.16: a rápida (só as telas) não abre janela: instala sozinha quando ninguém mexe no aparelho há um minuto
    await teste(grupo, 'achou versão nova: a rápida ganha do APK e instala sozinha com o aparelho parado (sem janela)', async () => {
      await a.esperar('!!document.querySelector(".topo .tema.atualizar")', 35000, 'botão Atualizar no alto');
      certo(await a.avaliar('!document.querySelector(".modal")'), 'a rápida não abre janela');
      await a.avaliar('ultimaAtividade = 0; avisarAtualizacao(); 1'); // parado há mais de um minuto
      await a.esperar('(window.__pedidosTelas || []).length === 1', 8000, 'instalou sozinha');
      const p = await a.avaliar('window.__pedidosTelas[0]');
      igual(p.base, c.url + '/telas/'); igual(p.versao, '9.5.0');
      igual(await a.avaliar('window.__pedidosAtualizar.length'), 0, 'não pode ter aberto o instalador do Android');
    });
    await teste(grupo, 'atualização rápida pelo botão Atualizar: barra de progresso e as telas novas vêm da central', async () => {
      await a.avaliar('atualizacao.instalando = false; 1');
      await a.tocar('.topo .tema.atualizar');
      await a.esperar(modalTem('baixa só o que mudou'), 8000, 'janela da atualização rápida');
      await a.tocar('.modal [data-k="ok"]');
      await a.esperar(modalTem('Abrindo a versão nova'), 8000, 'fim da atualização rápida');
      const p = await a.avaliar('window.__pedidosTelas[1]');
      igual(p.base, c.url + '/telas/'); igual(p.versao, '9.5.0');
      igual(await a.avaliar('document.querySelector("#barra-atualizacao > i").style.width'), '100%');
      igual(await a.avaliar('window.__pedidosAtualizar.length'), 0, 'não pode ter aberto o instalador do Android');
    });
    await teste(grupo, 'o aplicativo confirma que as telas abriram (senão o Android volta para as de antes)', async () => {
      await a.esperar('window.__telasOk >= 1', 10000, 'telasOk');
    });

    // a parte em Java mudou (o pacote pede APK 9.9.0): esse tablet recebe o APK
    montarPacote(telasDeTeste('9.6.0'), path.join(pastaApk, 'telas'), chave, '9.6.0', '9.9.0');
    info = apkFalso(pastaApk, '9.9.0');
    await a.recarregar();
    await teste(grupo, 'pacote que pede APK mais novo: a janela oferece o APK e o Android confirma', async () => {
      await a.esperar(modalTem('Versão nova: 9.9.0'), 35000, 'janela do APK');
      certo(await a.avaliar(modalTem('janela do Android')), 'devia ser pelo APK');
      await a.tocar('.modal [data-k="ok"]');
      await a.esperar('window.__pedidosAtualizar.length === 1 && !document.querySelector(".modal")', 8000, 'pedido ao Android');
      const p = await a.avaliar('window.__pedidosAtualizar[0]');
      igual(p.url, c.url + '/apk/pranchetas.apk'); igual(p.sha256, info.sha256); igual(p.tamanho, info.tamanho);
    });
    await teste(grupo, 'sem a permissão de instalar: explica o que ligar e deixa tentar de novo', async () => {
      await a.avaliar('window.__respostasAtualizar.push({ precisaPermissao: true })');
      await a.tocar('.topo .tema.atualizar');
      await a.tocar('.modal [data-k="ok"]');
      await a.esperar('(document.querySelector("#passo-atualizacao") || {}).textContent.includes("Permitir desta fonte")', 8000, 'explicação da permissão');
      await a.tocar('.modal [data-k="ok"]');
      await a.esperar('window.__pedidosAtualizar.length === 3 && !document.querySelector(".modal")', 8000, 'segunda tentativa');
    });
    await teste(grupo, 'arquivo com defeito: avisa na janela, sem fechar', async () => {
      await a.avaliar('window.__respostasAtualizar.push({ erro: "o arquivo chegou com defeito" })');
      await a.tocar('.topo .tema.atualizar');
      await a.tocar('.modal [data-k="ok"]');
      await a.esperar('(document.querySelector("#passo-atualizacao") || {}).textContent.includes("o arquivo chegou com defeito")', 8000, 'aviso do defeito');
      await a.tocar('.modal [data-k="x"]');
      await a.esperar('!document.querySelector(".modal")', 5000);
    });
    await teste(grupo, 'depois de atualizar, as novidades aparecem uma vez', async () => {
      // tira a versão nova da central, para a janela dela não abrir junto
      fs.rmSync(path.join(pastaApk, 'telas'), { recursive: true, force: true });
      fs.rmSync(path.join(pastaApk, 'versao.json'), { force: true });
      await a.avaliar(`(() => { const x = JSON.parse(localStorage.getItem('usina.cfg')); x.versaoVista = '2.6.0'; localStorage.setItem('usina.cfg', JSON.stringify(x)); })()`);
      await a.recarregar();
      await a.esperar(modalTem(`Aplicativo atualizado: versão ${VERSAO}`), 10000, 'janela das novidades');
      // veio da 2.6: mostra o que mudou em todas as versões depois dela
      // a janela troca o hífen pelo que não quebra a linha (2.13.1): volta ele para comparar com o novidades.js
      igual(await a.avaliar('[...document.querySelectorAll(".modal li")].map((l) => l.textContent.replace(/\u2011/g, "-"))'), novidades().flatMap((n) => n.itens));
      await a.tocar('.modal [data-k="ok"]');
      igual(await a.avaliar('JSON.parse(localStorage.getItem("usina.cfg")).versaoVista'), VERSAO);
      await a.recarregar();
      await dormir(2500);
      certo(!(await a.avaliar('!!document.querySelector(".modal")')), 'a janela das novidades apareceu de novo');
    });
    await teste(grupo, 'nenhum erro de JavaScript', async () => {
      certo(!a.erros.length, a.erros.join(' | ').slice(0, 500));
    });
  } finally {
    for (const x of aparelhos) await x.fechar();
    await c.desligar();
  }

  // ---------- nuvem: a central do computador busca o APK novo na internet ----------
  await teste(grupo, 'nuvem: a central do computador baixa o APK novo, confere e passa a entregar aos tablets', async () => {
    const pastaNuvem = path.join(pastaTemporaria('nuvem'), 'atualizacao');
    const nv = apkFalso(pastaNuvem, '9.2.1', 500000);
    const nuvem = await nuvemFalsa(8183, pastaNuvem);
    const pastaApk2 = pastaTemporaria('apk-saida2');
    apkFalso(pastaApk2, '9.1.0');
    const c2 = await centralNode(8182, pastaTemporaria('atualizacao2'), undefined, { PASTA_APK: pastaApk2, ATUALIZACAO_ONLINE: nuvem.url, ATUALIZACAO_ESPERA_MS: '300' });
    try {
      const v = await esperarVersao(c2.url, '9.2.1');
      igual(v.versao, '9.2.1'); igual(v.sha256, nv.sha256); igual(v.novidades[0].versao, '9.2.1');
      igual(sha(Buffer.from(await (await fetch(c2.url + '/apk/pranchetas.apk')).arrayBuffer())), nv.sha256);
    } finally { await c2.desligar(); await nuvem.fechar(); }
  });
  await teste(grupo, 'nuvem com APK diferente do versao.json, ou com versão mais velha: a central fica com o que tem', async () => {
    const pastaNuvem = path.join(pastaTemporaria('nuvem2'), 'atualizacao');
    apkFalso(pastaNuvem, '9.2.2');
    fs.appendFileSync(path.join(pastaNuvem, 'pranchetas.apk'), 'estragado');
    const nuvem = await nuvemFalsa(8185, pastaNuvem);
    const pastaApk3 = pastaTemporaria('apk-saida3');
    const antes = apkFalso(pastaApk3, '9.1.0');
    const c3 = await centralNode(8186, pastaTemporaria('atualizacao3'), undefined, { PASTA_APK: pastaApk3, ATUALIZACAO_ONLINE: nuvem.url, ATUALIZACAO_ESPERA_MS: '300' });
    try {
      await dormir(3000);
      const v = await (await fetch(c3.url + '/api/versao')).json();
      igual(v.versao, '9.1.0'); igual(v.sha256, antes.sha256);
      // versão mais velha na nuvem: também não troca
      apkFalso(pastaNuvem, '9.0.9');
      await c3.reiniciar();
      await dormir(3000);
      igual((await (await fetch(c3.url + '/api/versao')).json()).versao, '9.1.0');
    } finally { await c3.desligar(); await nuvem.fechar(); }
  });

  // ---------- tablet chefe (ServidorCentral.java) ----------
  await teste(grupo, 'tablet chefe: entrega a versão do aplicativo instalado nele, as novidades e as telas que ele usa', async () => {
    const j = await centralJava(8184);
    try {
      const v = await (await fetch(j.url + '/api/versao')).json();
      igual(v.versao, '2.7.0'); // nos testes, o Android de mentira diz 2.7.0
      igual(v.url, '/apk/pranchetas.apk');
      igual(v.novidades[0].versao, VERSAO);
      const apk = path.join(APP, 'apk', 'saida', 'pranchetas.apk');
      if (fs.existsSync(apk)) { igual(v.tamanho, fs.statSync(apk).size); igual(v.sha256, sha(fs.readFileSync(apk))); }
      const outra = await (await fetch(j.url + '/api/versao')).json();
      igual(outra.sha256, v.sha256, 'a segunda vez usa a conta guardada');
      // telas: as que vieram no APK (nos testes, a pasta public)
      const index = await (await fetch(j.url + '/telas/index.html')).text();
      igual(index, fs.readFileSync(path.join(APP, 'public', 'index.html'), 'utf8'));
    } finally { await j.desligar(); }
  });
}
