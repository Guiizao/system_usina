/* Totais por turno: cálculo e agendamento na central, sem depender de um tablet aberto. */
'use strict';
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const leitura = require('./api-leitura');

// http só dentro da rede da usina; pela internet o segredo e os totais iriam abertos (2.16, revisão de segurança)
const naRedeLocal = (host) => /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[::1\]|[^.:]+|.+\.local)$/i.test(host);
const dataLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function diaProducao(C, agora) {
  const d = new Date(agora);
  if (d.getHours() < C.inicioDoDia) d.setDate(d.getDate() - 1);
  return dataLocal(d);
}
function encerrados(C, desde, agora) {
  const hoje = diaProducao(C, agora), eventos = [], turnos = new Map();
  C.setores.forEach((s) => ((C.turnosSetor || {})[s.id] === '12h' ? C.turnos12h : C.turnos).forEach((t) => {
    turnos.set(`${t.id}-${t.inicio}-${t.fim}`, t);
  }));
  // Como o Base44, revisita sete dias para pegar correções, mais o dia em andamento.
  for (let i = 7; i >= 0; i--) {
    const d = new Date(hoje + 'T12:00:00'); d.setDate(d.getDate() - i);
    const data = dataLocal(d);
    if (data < desde) continue;
    for (const [chave, t] of turnos) {
      const fim = new Date(data + 'T00:00:00'); fim.setHours(t.fim <= C.inicioDoDia ? t.fim + 24 : t.fim);
      if (fim.getTime() <= agora) eventos.push({ data, chave: `${data}|${chave}`, turno: t, em: fim.getTime() });
    }
  }
  return eventos.sort((a, b) => a.em - b.em || a.chave.localeCompare(b.chave));
}
function postar(url, segredo, dados) {
  return new Promise((resolve) => {
    const corpo = Buffer.from(JSON.stringify(dados));
    const req = (url.startsWith('https:') ? https : http).request(url, { method: 'POST', timeout: 20000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': corpo.length, 'X-Pranchetas-Segredo': segredo } }, (r) => {
      r.resume(); r.on('end', () => resolve(r.statusCode)); r.on('error', () => resolve(0));
    });
    req.on('timeout', () => req.destroy()); req.on('error', () => resolve(0)); req.end(corpo);
  });
}
function criar({ config, salvar, forms, registros, agora = Date.now }) {
  const b = config.envioTurnos ||= { url: '', segredo: '', ligado: false, enviados: {} };
  b.enviados ||= {};
  let ocupado = false;
  function estado() {
    return { url: b.url, ligado: b.ligado, temSegredo: !!b.segredo, desde: b.desde || '',
      enviados: Object.fromEntries(Object.entries(b.enviados).sort((a, z) => z[1].em - a[1].em).slice(0, 15)) };
  }
  function configurar(p) {
    if ((p.url !== undefined && (typeof p.url !== 'string' || p.url.length > 2000)) ||
        (p.segredo !== undefined && (typeof p.segredo !== 'string' || p.segredo.length > 200 || /[^\x20-\x7e]/.test(p.segredo))) ||
        (p.ligado !== undefined && typeof p.ligado !== 'boolean')) throw new Error('Configuração inválida');
    const url = p.url === undefined ? b.url : p.url.trim();
    if (url) {
      let u; try { u = new URL(url); } catch (_) { throw new Error('Endereço inválido'); }
      if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.hash) throw new Error('Endereço inválido');
      if (u.protocol === 'http:' && !naRedeLocal(u.hostname)) throw new Error('Pela internet, o endereço começa com https:// (com http o segredo iria aberto)');
    }
    const ligado = p.ligado === undefined ? b.ligado : p.ligado;
    if (ligado && !url) throw new Error('Cadastre o endereço primeiro');
    if (ligado && (!b.ligado || url !== b.url)) b.desde = diaProducao(forms(), agora());
    if (url !== b.url || p.segredo !== undefined) b.enviados = {};
    b.url = url; b.ligado = ligado;
    let segredoCriado;
    if (p.segredo !== undefined) b.segredo = p.segredo.trim();
    if (!b.segredo) b.segredo = segredoCriado = crypto.randomBytes(24).toString('hex');
    salvar();
    return { ...estado(), ...(segredoCriado ? { segredoCriado } : {}) };
  }
  async function verificar(manual = false) {
    if (ocupado) return { ok: false, erro: 'Já está enviando' };
    if (!b.ligado || !b.url) return { ok: false, erro: 'O envio por turno está desligado' };
    ocupado = true;
    let quantidade = 0;
    try {
      const C = forms(), api = leitura.criar(C), momento = agora();
      for (const e of encerrados(C, b.desde || diaProducao(C, momento), momento)) {
        if (!b.ligado) break;
        const dados = { ...api.totais({ de: e.data, ate: e.data, dias: [e.data] }, registros(e.data)), turnoEncerrado: e.turno };
        const hash = crypto.createHash('sha256').update(JSON.stringify(dados)).digest('hex');
        const antes = b.enviados[e.chave];
        if (antes && antes.ok && antes.hash === hash) continue;
        if (!manual && antes && !antes.ok && momento - antes.em < 600000) continue;
        const url = b.url, segredo = b.segredo;
        const status = await postar(url, segredo, dados), ok = status >= 200 && status < 300;
        const erro = ok ? '' : !status ? 'Sem resposta do destino' : status === 401 || status === 403 ? 'O destino recusou o segredo' : `O destino respondeu ${status}`;
        // Uma configuração trocada durante o pedido não herda o recibo do destino anterior.
        if (url !== b.url || segredo !== b.segredo) break;
        b.enviados[e.chave] = { data: e.data, turno: e.turno, hash, ok, em: agora(), status, erro };
        Object.keys(b.enviados).sort().slice(0, -80).forEach((k) => delete b.enviados[k]);
        salvar(); quantidade++;
        if (!ok) return { ok, erro, quantidade };
      }
      return { ok: true, quantidade };
    } finally { ocupado = false; }
  }
  return { estado, configurar, verificar };
}
module.exports = { criar, encerrados, diaProducao, naRedeLocal };
