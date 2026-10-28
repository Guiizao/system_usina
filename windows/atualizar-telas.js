/* Pranchetas Digitais - © 2026 Guilherme. Atualizador testável sem Electron. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { maisNova } = require('./pacote');

const versaoValida = (v) => typeof v === 'string' && /^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(v);
const hash = (dados) => crypto.createHash('sha256').update(dados).digest('hex');
const LIMITE = 25 * 1024 * 1024; // Limite por arquivo dos assets da nuvem.

async function baixar(url, limite, buscar) {
  const r = await buscar(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(30000) });
  if (!r.ok || !r.body) throw new Error('Não foi possível baixar as telas');
  const partes = []; let tamanho = 0;
  for await (const parte of r.body) {
    tamanho += parte.length;
    if (tamanho > limite) throw new Error('Arquivo das telas grande demais');
    partes.push(parte);
  }
  return Buffer.concat(partes);
}

class AtualizadorTelas {
  constructor({ publico, destino, versao }) {
    if (!versaoValida(versao)) throw new Error('Versão do programa inválida');
    this.publico = publico; this.destino = path.resolve(destino); this.versao = versao;
    this.ativa = null; this.estado = { maior: versao, falhas: 0 };
    this.registro = path.join(this.destino, 'telas-estado.json');
    try {
      const e = JSON.parse(fs.readFileSync(this.registro, 'utf8'));
      if (versaoValida(e.maior) && maisNova(e.maior, versao)) this.estado.maior = e.maior;
      if (!versaoValida(e.ativa) || !maisNova(e.ativa, versao)) return;
      this.estado.falhas = Number.isInteger(e.falhas) && e.falhas >= 0 ? e.falhas : 2;
      if (this.estado.falhas >= 2) return;
      const pasta = path.join(this.destino, 'telas-' + e.ativa);
      const pacote = this.validar(fs.readFileSync(path.join(pasta, 'pacote.json')), fs.readFileSync(path.join(pasta, 'pacote.sig')));
      if (pacote.versao !== e.ativa || !this.compativel(pacote)) return;
      const candidata = { pasta, pacote };
      for (const rel of Object.keys(pacote.arquivos)) {
        const real = fs.realpathSync(path.join(pasta, rel));
        if (!real.startsWith(fs.realpathSync(pasta) + path.sep) || !this.confere(candidata, rel, fs.readFileSync(real))) return;
      }
      this.ativa = candidata; this.estado.ativa = e.ativa;
      if (maisNova(e.ativa, this.estado.maior)) this.estado.maior = e.ativa;
    } catch { /* Sem pacote íntegro, abre as telas que vieram com o programa. */ }
  }

  validar(json, assinatura) {
    if (json.length > 2 * 1024 * 1024 || assinatura.length > 1024) throw new Error('Manifesto grande demais');
    const sig = assinatura.toString('utf8').trim();
    const chave = crypto.createPublicKey({ key: Buffer.from(fs.readFileSync(path.join(this.publico, 'chave-telas.txt'), 'utf8').trim(), 'base64'), format: 'der', type: 'spki' });
    if (Buffer.from(sig, 'base64').toString('base64') !== sig || !crypto.verify('sha256', json, chave, Buffer.from(sig, 'base64')))
      throw new Error('Assinatura das telas inválida');
    const p = JSON.parse(json);
    if (!versaoValida(p.versao) || (p.windowsMinimo !== undefined && !versaoValida(p.windowsMinimo)) ||
        !p.arquivos || Array.isArray(p.arquivos) || !Object.hasOwn(p.arquivos, 'index.html')) throw new Error('Pacote das telas inválido');
    const nomes = new Set(); let total = 0;
    for (const [rel, a] of Object.entries(p.arquivos)) {
      if (rel.length > 240 || rel.split('/').some((n) => !n || n === '.' || n === '..' || /[\\:*?"<>|\x00-\x1f]/.test(n) ||
          /[. ]$/.test(n) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(n)) ||
          ['pacote.json', 'pacote.sig'].includes(rel.toLowerCase()) || nomes.has(rel.toLowerCase())) throw new Error('Caminho das telas inválido');
      nomes.add(rel.toLowerCase());
      if (!a || !/^[a-f0-9]{64}$/.test(a.sha256) || !Number.isSafeInteger(a.tamanho) || a.tamanho < 0 || a.tamanho > LIMITE)
        throw new Error('Resumo das telas inválido');
      total += a.tamanho;
    }
    if (nomes.size > 10000 || total > 250 * 1024 * 1024) throw new Error('Pacote das telas grande demais');
    return p;
  }

  compativel(p) { return !p.windowsMinimo || !maisNova(p.windowsMinimo, this.versao); }

  confere(ativa, rel, dados) {
    const a = Object.hasOwn(ativa.pacote.arquivos, rel) && ativa.pacote.arquivos[rel];
    return !!a && dados.length === a.tamanho && hash(dados) === a.sha256;
  }

  salvar() {
    fs.mkdirSync(this.destino, { recursive: true });
    fs.writeFileSync(this.registro + '.novo', JSON.stringify(this.estado));
    fs.renameSync(this.registro + '.novo', this.registro);
  }

  async atualizar(nuvem, buscar = fetch) {
    if (this.baixando) return false;
    const url = new URL(nuvem);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) ||
        url.username || url.password || url.search || url.hash) throw new Error('Endereço da nuvem inválido');
    const base = url.href.replace(/\/+$/, '') + '/telas/';
    this.baixando = true;
    let tmp;
    try {
      const json = await baixar(base + 'pacote.json', 2 * 1024 * 1024, buscar);
      const assinatura = await baixar(base + 'pacote.sig', 1024, buscar);
      const pacote = this.validar(json, assinatura);
      if (!maisNova(pacote.versao, this.estado.maior) || !this.compativel(pacote)) return false;
      fs.mkdirSync(this.destino, { recursive: true });
      tmp = fs.mkdtempSync(path.join(this.destino, '.telas-'));
      const candidata = { pasta: tmp, pacote };
      for (const [rel, a] of Object.entries(pacote.arquivos)) {
        const dados = await baixar(base + rel.split('/').map(encodeURIComponent).join('/'), a.tamanho, buscar);
        if (!this.confere(candidata, rel, dados)) throw new Error('Hash das telas inválido');
        const arquivo = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(arquivo), { recursive: true });
        const pai = fs.realpathSync(path.dirname(arquivo)), raiz = fs.realpathSync(tmp);
        if (pai !== raiz && !pai.startsWith(raiz + path.sep)) throw new Error('Pasta das telas inválida');
        fs.writeFileSync(arquivo, dados, { flag: 'wx' });
      }
      fs.writeFileSync(path.join(tmp, 'pacote.json'), json);
      fs.writeFileSync(path.join(tmp, 'pacote.sig'), assinatura);
      const pasta = path.join(this.destino, 'telas-' + pacote.versao);
      // O nome vem da versão validada; nunca remove um caminho fornecido pelo manifesto.
      if (path.dirname(pasta) !== this.destino) throw new Error('Pasta das telas inválida');
      fs.rmSync(pasta, { recursive: true, force: true });
      fs.renameSync(tmp, pasta); tmp = null;
      const anterior = this.estado;
      this.estado = { maior: pacote.versao, ativa: pacote.versao, falhas: 0 };
      try { this.salvar(); } catch (erro) { this.estado = anterior; throw erro; }
      this.ativa = { pasta, pacote };
      return true;
    } finally {
      this.baixando = false;
      if (tmp && path.dirname(tmp) === this.destino) fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  iniciarAbertura() {
    if (!this.ativa) return;
    this.estado.falhas++;
    this.salvar(); // Antes de abrir: queda/encerramento do processo também conta.
  }

  confirmarAbertura() {
    if (!this.ativa) return;
    this.estado.falhas = 0; this.salvar();
  }

  falhou() {
    if (!this.ativa) return;
    if (this.estado.falhas >= 2) { this.ativa = null; delete this.estado.ativa; }
    this.salvar();
  }
}

module.exports = { AtualizadorTelas };
