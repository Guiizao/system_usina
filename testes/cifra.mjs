/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* A criptografia escrita no public/cifra.js (usada no navegador do computador, sem WebCrypto) tem de dar
   exatamente o mesmo resultado que a do Node (OpenSSL). Também guarda o cliente de teste das centrais. */
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { teste, certo, igual } from './teste.mjs';

const require = createRequire(import.meta.url);
export const Cifra = require(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'cifra.js'));

/** X25519 do Node (OpenSSL), para conferir a versão escrita em JavaScript. */
function x25519Node(escalar, u) {
  const privateKey = crypto.createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b656e04220420', 'hex'), Buffer.from(escalar)]), format: 'der', type: 'pkcs8' });
  const publicKey = crypto.createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b656e032100', 'hex'), Buffer.from(u)]), format: 'der', type: 'spki' });
  return new Uint8Array(crypto.diffieHellman({ privateKey, publicKey }));
}

export async function testarCifra(grupo) {
  await teste(grupo, 'SHA-256 e HMAC iguais aos do Node', async () => {
    for (const n of [0, 1, 55, 56, 63, 64, 65, 119, 1000, 70000]) {
      const m = crypto.randomBytes(n);
      igual(Cifra.hex(Cifra.sha256(m)), crypto.createHash('sha256').update(m).digest('hex'), 'sha256 de ' + n);
      const k = crypto.randomBytes(n % 3 ? 32 : 100);
      igual(Cifra.hex(Cifra.hmac(k, m)), crypto.createHmac('sha256', k).update(m).digest('hex'), 'hmac de ' + n);
    }
    igual(Cifra.hex(Cifra.sha256(Cifra.utf8('abc'))), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'vetor do padrão');
  });
  await teste(grupo, 'AES-256-GCM escrito em JavaScript igual ao do Node, e recusa pacote alterado', async () => {
    for (const n of [0, 1, 15, 16, 17, 31, 32, 33, 100, 1000, 65537]) {
      const k = crypto.randomBytes(32); const iv = crypto.randomBytes(12); const m = crypto.randomBytes(n); const aad = crypto.randomBytes(n % 40);
      const c = crypto.createCipheriv('aes-256-gcm', k, iv); c.setAAD(aad);
      const esperado = Buffer.concat([c.update(m), c.final(), c.getAuthTag()]);
      const meu = Cifra.gcm(k, iv, m, aad, false);
      igual(Buffer.from(meu).toString('hex'), esperado.toString('hex'), 'cifrado de ' + n);
      igual(Buffer.from(Cifra.gcm(k, iv, esperado, aad, true)).toString('hex'), m.toString('hex'), 'decifrado de ' + n);
      const mexido = Buffer.from(esperado); mexido[Math.floor(Math.random() * mexido.length)] ^= 1;
      let recusou = false; try { Cifra.gcm(k, iv, mexido, aad, true); } catch { recusou = true; }
      certo(recusou, 'aceitou pacote alterado de ' + n);
    }
  });
  await teste(grupo, 'X25519 escrito em JavaScript igual ao do padrão (RFC 7748) e ao do Node', async () => {
    const r = Cifra.x25519(Cifra.deHex('a546e36bf0527c9d3b16154b82465edd62144c0ac1fc5a18506a2244ba449ac4'), Cifra.deHex('e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1c4c'));
    igual(Cifra.hex(r), 'c3da55379de9c6908e94ea4df28d084f32eccf03491c71f754b4075577a28552', 'vetor 1 do RFC 7748');
    for (let i = 0; i < 5; i++) {
      const a = crypto.randomBytes(32); const b = crypto.randomBytes(32);
      const A = Cifra.x25519(a, Cifra.BASE); const B = Cifra.x25519(b, Cifra.BASE);
      igual(Cifra.hex(Cifra.x25519(a, B)), Cifra.hex(Cifra.x25519(b, A)), 'segredo comum');
      igual(Cifra.hex(Cifra.x25519(a, B)), Buffer.from(x25519Node(a, B)).toString('hex'), 'igual ao do Node');
    }
  });
}

/* ---------------- cliente de teste: faz o que o aplicativo faz com a central ---------------- */
/** Conecta um aparelho de teste na central com o código. Devolve o cliente, ou { status, erro } se a central recusar. */
export async function conectarTeste(url, codigo, aparelho = 'teste-' + crypto.randomBytes(3).toString('hex')) {
  const ping = await (await fetch(url + '/api/ping')).json();
  const { corpo, chavePar } = Cifra.pedidoDeConexao(ping.pub, aparelho, codigo);
  const r = await fetch(url + '/api/parear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return { status: r.status, erro: d.erro };
  const { chave } = await Cifra.abrirConexao(chavePar, aparelho, d.cifrado);
  return clienteCifrado(url, aparelho, chave);
}
/** Pedidos embaralhados com a chave do aparelho. pedir() devolve { status, json, texto } como a central respondeu por dentro;
    fora: true quando a central recusou o pacote (401, 409...). */
export function clienteCifrado(url, aparelho, chave) {
  let desvio = 0;
  const cli = {
    aparelho, chave, gravados: [],
    async pedir(caminho, { metodo, corpo, texto, agora } = {}) {
      const m = metodo || (corpo !== undefined || texto !== undefined ? 'POST' : 'GET');
      const corpoTexto = texto !== undefined ? texto : corpo !== undefined ? JSON.stringify(corpo) : '';
      for (let vez = 0; vez < 2; vez++) {
        const { corpo: pacote, iv } = await Cifra.pedido(cli.chave, aparelho, m, caminho.replace(/^\//, ''), corpoTexto, agora != null ? agora : Date.now() + desvio);
        const r = await fetch(`${url}/api/c?a=${encodeURIComponent(aparelho)}`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: pacote });
        const bruto = new Uint8Array(await r.arrayBuffer());
        cli.gravados.push({ pedido: pacote, resposta: bruto, status: r.status });
        if (cli.gravados.length > 50) cli.gravados.shift();
        if (r.status === 409 && vez === 0 && agora == null) { const d = JSON.parse(Cifra.deUtf8(bruto)); if (d.agora) { desvio = d.agora - Date.now(); continue; } }
        if (r.status !== 200) {
          const t = Cifra.deUtf8(bruto); let json = null; try { json = JSON.parse(t); } catch { /* não é JSON */ }
          return { status: r.status, json, texto: t, fora: true };
        }
        const resp = await Cifra.resposta(cli.chave, iv, bruto);
        let json = null; try { json = JSON.parse(resp.texto); } catch { /* não é JSON */ }
        return { status: resp.status, json, texto: resp.texto };
      }
      return { status: 409, json: null, texto: 'relógio', fora: true };
    },
  };
  return cli;
}
