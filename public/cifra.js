/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Criptografia do Wi-Fi: as anotações passam embaralhadas entre os aparelhos e a central.
 *
 *  - Conectar: o aparelho e a central combinam um segredo (X25519) que quem espia o Wi-Fi não consegue calcular.
 *    O código de 6 números nunca passa aberto: vai só uma prova dele, presa a esse segredo.
 *    A central devolve a chave deste aparelho, embaralhada.
 *  - Depois: cada pedido vai embaralhado com a chave do aparelho (AES-256-GCM). Quem mexer no meio do caminho
 *    é descoberto (a central e o aparelho recusam). Pedido repetido (gravado e mandado de novo) é recusado.
 *
 * No aplicativo instalado usa a criptografia do próprio Android (WebCrypto). No navegador do computador aberto por
 * http://endereço ela não existe, então usa a versão escrita aqui (mesmo resultado, só mais lenta).
 */
(function (raiz) {
  'use strict';
  const te = new TextEncoder();
  const td = new TextDecoder();
  const utf8 = (s) => te.encode(s);
  const deUtf8 = (b) => td.decode(b);
  const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  function deHex(h) {
    const b = new Uint8Array(h.length >> 1);
    for (let i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16);
    return b;
  }
  function juntar(...partes) {
    const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
    let o = 0;
    partes.forEach((p) => { out.set(p, o); o += p.length; });
    return out;
  }
  const aleatorio = (n) => raiz.crypto.getRandomValues(new Uint8Array(n));
  function base64(b) {
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function deBase64(s) {
    const t = atob(s);
    const b = new Uint8Array(t.length);
    for (let i = 0; i < t.length; i++) b[i] = t.charCodeAt(i);
    return b;
  }

  /* ---------------- SHA-256 e HMAC ---------------- */
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256(msg) {
    const l = msg.length;
    const m = new Uint8Array(((l + 9 + 63) >> 6) << 6);
    m.set(msg); m[l] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(m.length - 4, (l * 8) >>> 0);
    dv.setUint32(m.length - 8, Math.floor((l * 8) / 0x100000000));
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const W = new Uint32Array(64);
    for (let o = 0; o < m.length; o += 64) {
      for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const x = W[i - 15]; const y = W[i - 2];
        const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    const out = new Uint8Array(32);
    const dvo = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) dvo.setUint32(i * 4, H[i]);
    return out;
  }
  function hmac(chave, msg) {
    const k = new Uint8Array(64);
    k.set(chave.length > 64 ? sha256(chave) : chave);
    const dentro = new Uint8Array(64); const fora = new Uint8Array(64);
    for (let i = 0; i < 64; i++) { dentro[i] = k[i] ^ 0x36; fora[i] = k[i] ^ 0x5c; }
    return sha256(juntar(fora, sha256(juntar(dentro, msg))));
  }

  /* ---------------- AES-256-GCM (para quando o navegador não tem WebCrypto) ---------------- */
  const SBOX = new Uint8Array(256);
  const T0 = new Uint32Array(256); const T1 = new Uint32Array(256); const T2 = new Uint32Array(256); const T3 = new Uint32Array(256);
  const xtime = (x) => ((x << 1) ^ (x & 0x80 ? 0x11b : 0)) & 0xff;
  function gmul(a, b) { let p = 0; while (b) { if (b & 1) p ^= a; a = xtime(a); b >>= 1; } return p; }
  (function tabelas() {
    const inv = new Uint8Array(256);
    for (let x = 1; x < 256; x++) for (let y = 1; y < 256; y++) if (gmul(x, y) === 1) { inv[x] = y; break; }
    for (let x = 0; x < 256; x++) {
      const b = inv[x];
      let s = b;
      for (let r = 1; r <= 4; r++) s ^= ((b << r) | (b >> (8 - r))) & 0xff;
      SBOX[x] = s ^ 0x63;
    }
    for (let x = 0; x < 256; x++) {
      const s = SBOX[x]; const s2 = xtime(s); const s3 = s2 ^ s;
      const t = ((s2 << 24) | (s << 16) | (s << 8) | s3) >>> 0;
      T0[x] = t; T1[x] = ((t >>> 8) | (t << 24)) >>> 0; T2[x] = ((t >>> 16) | (t << 16)) >>> 0; T3[x] = ((t >>> 24) | (t << 8)) >>> 0;
    }
  })();
  const sub = (t) => (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 255] << 16) | (SBOX[(t >>> 8) & 255] << 8) | SBOX[t & 255];
  function expandir(k) {
    const nk = k.length >> 2; const w = new Int32Array(4 * (nk + 7));
    for (let i = 0; i < nk; i++) w[i] = (k[4 * i] << 24) | (k[4 * i + 1] << 16) | (k[4 * i + 2] << 8) | k[4 * i + 3];
    let rcon = 1;
    for (let i = nk; i < w.length; i++) {
      let t = w[i - 1];
      if (i % nk === 0) { t = sub((t << 8) | (t >>> 24)) ^ (rcon << 24); rcon = xtime(rcon); } else if (nk > 6 && i % nk === 4) t = sub(t);
      w[i] = w[i - nk] ^ t;
    }
    return w;
  }
  function bloco(w, e0, e1, e2, e3, out) {
    let s0 = e0 ^ w[0], s1 = e1 ^ w[1], s2 = e2 ^ w[2], s3 = e3 ^ w[3];
    const nr = (w.length >> 2) - 1;
    let k = 4;
    for (let r = 1; r < nr; r++, k += 4) {
      const t0 = T0[s0 >>> 24] ^ T1[(s1 >>> 16) & 255] ^ T2[(s2 >>> 8) & 255] ^ T3[s3 & 255] ^ w[k];
      const t1 = T0[s1 >>> 24] ^ T1[(s2 >>> 16) & 255] ^ T2[(s3 >>> 8) & 255] ^ T3[s0 & 255] ^ w[k + 1];
      const t2 = T0[s2 >>> 24] ^ T1[(s3 >>> 16) & 255] ^ T2[(s0 >>> 8) & 255] ^ T3[s1 & 255] ^ w[k + 2];
      const t3 = T0[s3 >>> 24] ^ T1[(s0 >>> 16) & 255] ^ T2[(s1 >>> 8) & 255] ^ T3[s2 & 255] ^ w[k + 3];
      s0 = t0; s1 = t1; s2 = t2; s3 = t3;
    }
    out[0] = ((SBOX[s0 >>> 24] << 24) | (SBOX[(s1 >>> 16) & 255] << 16) | (SBOX[(s2 >>> 8) & 255] << 8) | SBOX[s3 & 255]) ^ w[k];
    out[1] = ((SBOX[s1 >>> 24] << 24) | (SBOX[(s2 >>> 16) & 255] << 16) | (SBOX[(s3 >>> 8) & 255] << 8) | SBOX[s0 & 255]) ^ w[k + 1];
    out[2] = ((SBOX[s2 >>> 24] << 24) | (SBOX[(s3 >>> 16) & 255] << 16) | (SBOX[(s0 >>> 8) & 255] << 8) | SBOX[s1 & 255]) ^ w[k + 2];
    out[3] = ((SBOX[s3 >>> 24] << 24) | (SBOX[(s0 >>> 16) & 255] << 16) | (SBOX[(s1 >>> 8) & 255] << 8) | SBOX[s2 & 255]) ^ w[k + 3];
    return out;
  }
  const palavra = (b, o) => ((b[o] | 0) << 24) | ((b[o + 1] | 0) << 16) | ((b[o + 2] | 0) << 8) | (b[o + 3] | 0);
  /** Multiplicação no corpo do GCM (NIST SP 800-38D, algoritmo 1). */
  function vezesH(x, h) {
    let z0 = 0, z1 = 0, z2 = 0, z3 = 0, v0 = h[0], v1 = h[1], v2 = h[2], v3 = h[3];
    for (let i = 0; i < 128; i++) {
      if ((x[i >> 5] >>> (31 - (i & 31))) & 1) { z0 ^= v0; z1 ^= v1; z2 ^= v2; z3 ^= v3; }
      const baixo = v3 & 1;
      v3 = (v3 >>> 1) | (v2 << 31); v2 = (v2 >>> 1) | (v1 << 31); v1 = (v1 >>> 1) | (v0 << 31); v0 >>>= 1;
      if (baixo) v0 ^= 0xe1000000;
    }
    x[0] = z0; x[1] = z1; x[2] = z2; x[3] = z3;
  }
  function ghash(h, aad, c) {
    const x = new Int32Array(4);
    const passar = (b) => {
      for (let o = 0; o < b.length; o += 16) {
        x[0] ^= palavra(b, o); x[1] ^= palavra(b, o + 4); x[2] ^= palavra(b, o + 8); x[3] ^= palavra(b, o + 12);
        vezesH(x, h);
      }
    };
    passar(aad); passar(c);
    x[0] ^= Math.floor((aad.length * 8) / 0x100000000); x[1] ^= (aad.length * 8) >>> 0;
    x[2] ^= Math.floor((c.length * 8) / 0x100000000); x[3] ^= (c.length * 8) >>> 0;
    vezesH(x, h);
    return x;
  }
  /** AES-GCM com IV de 12 bytes e etiqueta de 16. Cifrar: devolve cifrado+etiqueta. Decifrar: recebe cifrado+etiqueta. */
  function gcm(chave, iv, dados, aad, decifrar) {
    const w = expandir(chave);
    const h = bloco(w, 0, 0, 0, 0, new Int32Array(4));
    const j0 = [palavra(iv, 0), palavra(iv, 4), palavra(iv, 8)];
    const n = decifrar ? dados.length - 16 : dados.length;
    if (n < 0) throw new Error('pacote curto');
    const entrada = decifrar ? dados.subarray(0, n) : dados;
    const saida = new Uint8Array(n);
    const ks = new Int32Array(4);
    let ctr = 2;
    for (let o = 0; o < n; o += 16) {
      bloco(w, j0[0], j0[1], j0[2], ctr++, ks);
      const fim = Math.min(16, n - o);
      for (let i = 0; i < fim; i++) saida[o + i] = entrada[o + i] ^ ((ks[i >> 2] >>> (24 - 8 * (i & 3))) & 255);
    }
    const s = ghash(h, aad, decifrar ? entrada : saida);
    const e = bloco(w, j0[0], j0[1], j0[2], 1, new Int32Array(4));
    const etiqueta = new Uint8Array(16);
    for (let i = 0; i < 16; i++) etiqueta[i] = (((s[i >> 2] ^ e[i >> 2]) >>> (24 - 8 * (i & 3))) & 255);
    if (!decifrar) return juntar(saida, etiqueta);
    let dif = 0;
    for (let i = 0; i < 16; i++) dif |= etiqueta[i] ^ dados[n + i];
    if (dif) throw new Error('pacote alterado ou chave errada');
    return saida;
  }

  /* WebCrypto só existe em página segura (o aplicativo instalado e http://localhost). */
  let soJs = false;
  try { soJs = raiz.localStorage && raiz.localStorage.getItem('cifraSoJs') === '1'; } catch (e) { /* sem armazenamento */ }
  const subtil = () => (!soJs && raiz.crypto && raiz.crypto.subtle && raiz.isSecureContext !== false ? raiz.crypto.subtle : null);
  const chavesProntas = new Map();
  function chaveSubtil(chave) {
    const id = hex(chave);
    if (!chavesProntas.has(id)) {
      if (chavesProntas.size > 20) chavesProntas.clear();
      chavesProntas.set(id, subtil().importKey('raw', chave, 'AES-GCM', false, ['encrypt', 'decrypt']));
    }
    return chavesProntas.get(id);
  }
  /** Embaralha: devolve iv (12) + cifrado + etiqueta (16). */
  async function selar(chave, dados, aad) {
    const iv = aleatorio(12);
    const texto = typeof dados === 'string' ? utf8(dados) : dados;
    const s = subtil();
    const c = s ? new Uint8Array(await s.encrypt({ name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, await chaveSubtil(chave), texto))
      : gcm(chave, iv, texto, aad, false);
    return juntar(iv, c);
  }
  /** Desembaralha o que selar() fez. Se alguém mexeu no pacote (ou a chave é outra), dá erro. */
  async function abrir(chave, pacote, aad) {
    if (pacote.length < 28) throw new Error('pacote curto');
    const iv = pacote.subarray(0, 12); const c = pacote.subarray(12);
    const s = subtil();
    if (!s) return gcm(chave, iv, c, aad, true);
    try { return new Uint8Array(await s.decrypt({ name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, await chaveSubtil(chave), c)); } catch (e) { throw new Error('pacote alterado ou chave errada'); }
  }

  /* ---------------- X25519 (RFC 7748) ---------------- */
  const P = (1n << 255n) - 19n;
  const paraNumero = (b) => { let n = 0n; for (let i = b.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(b[i]); return n; };
  const paraBytes = (n) => { const b = new Uint8Array(32); for (let i = 0; i < 32; i++) { b[i] = Number(n & 255n); n >>= 8n; } return b; };
  function potencia(b, e) { let r = 1n; b %= P; while (e > 0n) { if (e & 1n) r = (r * b) % P; b = (b * b) % P; e >>= 1n; } return r; }
  function x25519(escalar, u) {
    const k = escalar.slice(); k[0] &= 248; k[31] &= 127; k[31] |= 64;
    const n = paraNumero(k);
    const uu = u.slice(); uu[31] &= 127;
    const x1 = paraNumero(uu) % P;
    let x2 = 1n, z2 = 0n, x3 = x1, z3 = 1n, troca = 0n;
    for (let t = 254; t >= 0; t--) {
      const bit = (n >> BigInt(t)) & 1n;
      troca ^= bit;
      if (troca) { [x2, x3] = [x3, x2]; [z2, z3] = [z3, z2]; }
      troca = bit;
      const A = (x2 + z2) % P; const AA = (A * A) % P;
      const B = (x2 - z2 + P) % P; const BB = (B * B) % P;
      const E = (AA - BB + P) % P;
      const C = (x3 + z3) % P; const D = (x3 - z3 + P) % P;
      const DA = (D * A) % P; const CB = (C * B) % P;
      x3 = (DA + CB) % P; x3 = (x3 * x3) % P;
      z3 = (DA - CB + P) % P; z3 = (x1 * ((z3 * z3) % P)) % P;
      x2 = (AA * BB) % P;
      z2 = (E * ((AA + 121665n * E) % P)) % P;
    }
    if (troca) { [x2, x3] = [x3, x2]; [z2, z3] = [z3, z2]; }
    return paraBytes((x2 * potencia(z2, P - 2n)) % P);
  }
  const BASE = (() => { const b = new Uint8Array(32); b[0] = 9; return b; })();

  /* ---------------- o que o aplicativo usa ---------------- */
  /** Chave deste aparelho, a partir da chave da rede (só a central e o servidor no tablet conhecem a da rede). */
  const chaveDoAparelho = (chaveRede, aparelho) => hex(hmac(utf8(chaveRede), utf8('aparelho|' + aparelho)));
  /** Prepara o pedido de conexão. Devolve o que vai para a central e a chave para abrir a resposta. */
  function pedidoDeConexao(pubCentral, aparelho, codigo) {
    const segredo = aleatorio(32);
    const pub = hex(x25519(segredo, BASE));
    const comum = x25519(segredo, deHex(pubCentral));
    const chavePar = hmac(comum, utf8(`parear|${aparelho}|${pub}`));
    return { corpo: { aparelho, pub, prova: hex(hmac(chavePar, utf8('codigo|' + codigo))) }, chavePar };
  }
  async function abrirConexao(chavePar, aparelho, cifrado) {
    return JSON.parse(deUtf8(await abrir(chavePar, deBase64(cifrado), utf8('parear|' + aparelho))));
  }
  /** Pedido embaralhado para a central: devolve { corpo, iv }. */
  async function pedido(chaveHex, aparelho, metodo, caminho, corpo, agora) {
    const texto = JSON.stringify({ m: metodo, c: caminho, t: agora }) + '\n' + (corpo || '');
    const pacote = await selar(deHex(chaveHex), texto, utf8('pedido|' + aparelho));
    return { corpo: pacote, iv: pacote.subarray(0, 12) };
  }
  /** Resposta da central: { status, texto }. */
  async function resposta(chaveHex, iv, pacote) {
    const t = deUtf8(await abrir(deHex(chaveHex), pacote, juntar(utf8('resposta|'), iv)));
    const nl = t.indexOf('\n');
    return { status: Number(t.slice(0, nl)), texto: t.slice(nl + 1) };
  }

  const Cifra = { utf8, deUtf8, hex, deHex, base64, deBase64, sha256, hmac, gcm, selar, abrir, x25519, BASE, chaveDoAparelho, pedidoDeConexao, abrirConexao, pedido, resposta, usaWebCrypto: () => !!subtil() };
  raiz.Cifra = Cifra;
  if (typeof module !== 'undefined' && module.exports) module.exports = Cifra;
})(typeof window !== 'undefined' ? window : globalThis);
