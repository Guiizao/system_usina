/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Versão 2.7: o aplicativo se atualiza sozinho.
 *   - a central diz em /api/versao qual APK ela tem (versão, tamanho, SHA-256 e novidades);
 *   - com o endereço da nuvem, a central do computador baixa o APK novo, confere e passa a entregar;
 *   - no aplicativo (APK) aparece o botão Atualizar; tocando, o APK desce e o instalador do Android abre;
 *   - depois de atualizar, a janela com as novidades aparece uma vez.
 * O Android aqui é de mentira: o teste finge o plugin nativo e guarda o que o aplicativo pediu para ele.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { TAMANHOS, dormir } from './navegador.mjs';
import { teste, certo, igual } from './teste.mjs';
import { centralNode, centralJava, pastaTemporaria, APP } from './servidores.mjs';
import { conectarTeste } from './cifra.mjs';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const VERSAO = /const VERSAO = '([\d.]+)'/.exec(fs.readFileSync(path.join(APP, 'public', 'app.js'), 'utf8'))[1];
function novidades() {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(APP, 'public', 'novidades.js'), 'utf8'), ctx);
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
const ANDROID_FALSO = `(() => {
  window.__pedidosAtualizar = [];
  window.__respostasAtualizar = [];
  const ouvintes = {};
  const central = {
    permissaoRede: async () => ({ estado: 'livre' }),
    estado: async () => ({ rodando: false }),
    telaCheia: async () => ({ ligada: false }),
    addListener: async (nome, f) => { ouvintes[nome] = f; return { remove() { delete ouvintes[nome]; } }; },
    atualizar: async (o) => {
      window.__pedidosAtualizar.push(o);
      if (ouvintes.progressoAtualizacao) ouvintes.progressoAtualizacao({ baixado: 1, total: 2 });
      const r = window.__respostasAtualizar.shift() || { aberto: true };
      if (r.erro) throw new Error(r.erro);
      return r;
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

export async function testarAtualizacao(nav, grupo) {
  await teste(grupo, 'novidades.js começa pela versão atual do aplicativo', async () => {
    const n = novidades();
    igual(n[0].versao, VERSAO, 'a primeira novidade tem de ser a da versão do app.js');
    certo(n[0].itens.length > 0, 'sem itens');
    return `${VERSAO}: ${n[0].itens.length} itens`;
  });

  // ---------- central do computador ----------
  const pastaApk = pastaTemporaria('apk-saida');
  const c = await centralNode(8181, pastaTemporaria('atualizacao'), undefined, { PASTA_APK: pastaApk });
  const aparelhos = [];
  let info;
  try {
    await teste(grupo, 'central sem APK gerado: não oferece atualização', async () => {
      igual((await (await fetch(c.url + '/api/versao')).json()).versao, null);
    });
    await teste(grupo, 'central com APK novo: diz a versão, o tamanho, o SHA-256 e as novidades', async () => {
      info = apkFalso(pastaApk, '2.8.0');
      const v = await (await fetch(c.url + '/api/versao')).json();
      igual(v.versao, '2.8.0'); igual(v.tamanho, info.tamanho); igual(v.sha256, info.sha256); igual(v.url, '/apk/pranchetas.apk');
      igual(v.novidades[0].itens[0], 'Teste de atualização');
      const apk = Buffer.from(await (await fetch(c.url + '/apk/pranchetas.apk')).arrayBuffer());
      igual(sha(apk), info.sha256, 'o APK que a central entrega tem de ser o do versao.json');
    });
    await teste(grupo, 'APK trocado sem o versao.json novo: a central não oferece (não instala arquivo errado)', async () => {
      fs.appendFileSync(path.join(pastaApk, 'pranchetas.apk'), 'x');
      igual((await (await fetch(c.url + '/api/versao')).json()).versao, null);
      info = apkFalso(pastaApk, '2.8.0');
    });

    // ---------- o aplicativo (APK, com o Android de mentira) ----------
    const cli = await conectarTeste(c.url, c.codigo());
    const a = await nav.novoAparelho('tablet com o aplicativo', TAMANHOS.tablet);
    aparelhos.push(a);
    await a.antesDeAbrir(ANDROID_FALSO);
    await a.ir(c.url + '/api/ping'); // mesma origem: guarda os ajustes de um tablet já conectado antes de abrir o app
    await a.avaliar(`localStorage.setItem('usina.cfg', JSON.stringify({ deviceId: ${JSON.stringify(cli.aparelho)}, chave: ${JSON.stringify(cli.chave)}, cifra: 1, central: ${JSON.stringify(c.url)}, papel: 'hidrolise', ultimoContato: Date.now(), versaoVista: ${JSON.stringify(VERSAO)} }))`);
    await a.ir(c.url + '/');

    await teste(grupo, 'o aplicativo acha a versão nova na central e mostra o botão Atualizar no alto', async () => {
      await a.esperar('!!document.querySelector(".topo .tema.atualizar")', 30000, 'botão Atualizar');
      certo((await a.avaliar('document.querySelector(".topo .tema.atualizar").getAttribute("aria-label")')).includes('2.8.0'), 'versão no botão');
    });
    await teste(grupo, 'Atualizar: mostra as novidades, baixa da central e abre o instalador do Android', async () => {
      await a.tocar('.topo .tema.atualizar');
      await a.esperar('document.querySelector(".modal") && document.querySelector(".modal").textContent.includes("Teste de atualização")', 8000, 'novidades da versão nova');
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
      await a.avaliar(`(() => { const x = JSON.parse(localStorage.getItem('usina.cfg')); x.versaoVista = '2.6.0'; localStorage.setItem('usina.cfg', JSON.stringify(x)); })()`);
      await a.recarregar();
      await a.esperar(`document.querySelector(".modal") && document.querySelector(".modal").textContent.includes("Aplicativo atualizado: versão ${VERSAO}")`, 10000, 'janela das novidades');
      igual(await a.avaliar('[...document.querySelectorAll(".modal li")].map((l) => l.textContent)'), novidades()[0].itens);
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
    const nv = apkFalso(pastaNuvem, '2.9.1', 500000);
    const nuvem = await nuvemFalsa(8183, pastaNuvem);
    const pastaApk2 = pastaTemporaria('apk-saida2');
    apkFalso(pastaApk2, '2.8.0');
    const c2 = await centralNode(8182, pastaTemporaria('atualizacao2'), undefined, { PASTA_APK: pastaApk2, ATUALIZACAO_ONLINE: nuvem.url, ATUALIZACAO_ESPERA_MS: '300' });
    try {
      const v = await esperarVersao(c2.url, '2.9.1');
      igual(v.versao, '2.9.1'); igual(v.sha256, nv.sha256); igual(v.novidades[0].versao, '2.9.1');
      igual(sha(Buffer.from(await (await fetch(c2.url + '/apk/pranchetas.apk')).arrayBuffer())), nv.sha256);
    } finally { await c2.desligar(); await nuvem.fechar(); }
  });
  await teste(grupo, 'nuvem com APK diferente do versao.json, ou com versão mais velha: a central fica com o que tem', async () => {
    const pastaNuvem = path.join(pastaTemporaria('nuvem2'), 'atualizacao');
    apkFalso(pastaNuvem, '2.9.2');
    fs.appendFileSync(path.join(pastaNuvem, 'pranchetas.apk'), 'estragado');
    const nuvem = await nuvemFalsa(8185, pastaNuvem);
    const pastaApk3 = pastaTemporaria('apk-saida3');
    const antes = apkFalso(pastaApk3, '2.8.0');
    const c3 = await centralNode(8186, pastaTemporaria('atualizacao3'), undefined, { PASTA_APK: pastaApk3, ATUALIZACAO_ONLINE: nuvem.url, ATUALIZACAO_ESPERA_MS: '300' });
    try {
      await dormir(3000);
      const v = await (await fetch(c3.url + '/api/versao')).json();
      igual(v.versao, '2.8.0'); igual(v.sha256, antes.sha256);
      // versão mais velha na nuvem: também não troca
      apkFalso(pastaNuvem, '2.7.9');
      await c3.reiniciar();
      await dormir(3000);
      igual((await (await fetch(c3.url + '/api/versao')).json()).versao, '2.8.0');
    } finally { await c3.desligar(); await nuvem.fechar(); }
  });

  // ---------- tablet chefe (ServidorCentral.java) ----------
  await teste(grupo, 'tablet chefe: entrega a versão do aplicativo instalado nele e as novidades de dentro do APK', async () => {
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
    } finally { await j.desligar(); }
  });
}
