/* Pranchetas Ubirálcool - registros (as anotações)
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Registros
   * ========================================================= */
  const idReg = (data, pid, chave) => `${data}|${pid}|${chave}`;
  const pegar = (data, pid, chave) => { const r = registros[idReg(data, pid, chave)]; return r && !r.apagado ? r : null; };
  /* Índice das anotações por dia e folha. Antes, cada tela percorria todas as anotações guardadas dezenas de vezes
     (no tablet chefe, com 20 dias, eram uns 90 ms a cada troca de dia num tablet mais lento).
     É montado de novo só quando alguma anotação muda (salvarRegistros). */
  let indice = null, versaoDoIndice = -1;
  function indiceDasFolhas() {
    if (!indice || versaoDoIndice !== versaoRegistros) {
      const porFolha = new Map(), avisos = [];
      for (const id in registros) {
        const r = registros[id];
        if (r.apagado) continue;
        const p2 = id.indexOf('|', id.indexOf('|') + 1); // "dia|folha|linha" -> "dia|folha"
        const k = id.slice(0, p2);
        const l = porFolha.get(k);
        if (l) l.push(r); else porFolha.set(k, [r]);
        if (r.prancheta === 'avisos') avisos.push(r);
      }
      indice = { porFolha, avisos };
      versaoDoIndice = versaoRegistros;
    }
    return indice;
  }
  const listar = (data, pid) => (indiceDasFolhas().porFolha.get(`${data}|${pid}`) || []).slice();
  const linhasDeHora = (regs) => regs.filter((r) => /^\d+$/.test(r.chave));

  function gravar(data, pid, chave, valores, extra = {}) {
    const id = idReg(data, pid, chave);
    const antigo = registros[id] && !registros[id].apagado ? registros[id] : null;
    const agora = Date.now();
    registros[id] = Object.assign({}, antigo || {}, {
      id, data, prancheta: pid, setor: (setorDaPrancheta(pid) || {}).id, chave: String(chave),
      valores: Object.assign({}, antigo ? antigo.valores : {}, valores),
      criadoEm: antigo ? antigo.criadoEm : agora, atualizadoEm: agora,
      aparelho: cfg.deviceId, apagado: false, sincronizado: false,
    }, extra);
    salvarRegistros(); sincronizarLogo();
    if (registros[id].prancheta !== PID_REGISTRO) verificarLembrete();
    return registros[id];
  }
  function apagar(data, pid, chave) {
    const id = idReg(data, pid, chave);
    if (!registros[id]) return;
    registros[id] = Object.assign({}, registros[id], { apagado: true, atualizadoEm: Date.now(), sincronizado: false, aparelho: cfg.deviceId });
    salvarRegistros(); sincronizarLogo();
  }
  const pendentes = () => Object.values(registros).filter((r) => !r.sincronizado).length;

  /* Quanto cada aparelho guarda. A memória do navegador do Android é pequena (uns 5 milhões de letras,
     perto de 2 meses de anotações da usina inteira): o tablet do setor guarda só os últimos dias e o tablet chefe
     um pouco mais. Tudo continua guardado na central; o tablet chefe busca lá um dia antigo quando alguém abre. */
  const DIAS_NO_SETOR = 3, DIAS_NO_CHEFE = 20, DIAS_DOS_AVISOS = 30;
  const primeiroDiaGuardado = () => somarDias(dataProducao(), -((ehCentral() ? DIAS_NO_CHEFE : DIAS_NO_SETOR) - 1));
  const diasAbertos = new Set();   // dias antigos que o tablet chefe buscou na central (ficam enquanto o app estiver aberto)
  const diasBuscando = new Set();
  /** Tira do aparelho as anotações antigas que já estão na central. O que não foi enviado nunca sai. */
  function podar() {
    // o registro do sistema fica na central: depois de chegar lá, sai do tablet
    Object.keys(registros).forEach((id) => { const r = registros[id]; if (r.prancheta === 'registro' && r.sincronizado) delete registros[id]; });
    const corte = primeiroDiaGuardado();
    const corteAvisos = somarDias(dataProducao(), -DIAS_DOS_AVISOS);
    // o último enchimento de cada dorna de fermentação fica sempre (a dorna pode passar vários dias fermentando).
    // Olha as anotações direto: o que acabou de chegar da central ainda não está no índice
    const ultimos = new Map();
    const quando = (r) => r.valores.inicioEm || r.criadoEm || 0;
    for (const id in registros) {
      const r = registros[id];
      if (r.prancheta !== PID_FERMENTACAO || r.apagado) continue;
      const x = ultimos.get(Number(r.valores.dorna));
      if (!x || quando(r) > quando(x)) ultimos.set(Number(r.valores.dorna), r);
    }
    const ultimosCiclos = new Set([...ultimos.values()].map((r) => r.id));
    let n = 0;
    Object.keys(registros).forEach((id) => {
      const r = registros[id];
      if (!r.sincronizado || !/^\d{4}-\d{2}-\d{2}$/.test(r.data) || diasAbertos.has(r.data) || ultimosCiclos.has(id)) return;
      const aviso = r.prancheta === 'avisos' || r.prancheta === 'avisos-recibo';
      if (r.data < (aviso ? corteAvisos : corte)) { delete registros[id]; n++; }
    });
    if (n) salvarRegistros();
    return n;
  }

  /** A dorna já foi anotada (terminou de enviar)? Só ela entra na soma dos insumos: dorna de teste ou em andamento não conta.
      Na Sacarificação vale a dorna de mesmo número da Hidrólise. */
  function dornaTerminada(data, pid, r) {
    const p = prancheta(pid);
    if (p.envio) return etapaDaDorna(p, r) === 'anotada';
    if (p.vemDe) { const base = pegar(data, p.vemDe.prancheta, r.chave); return !base || etapaDaDorna(prancheta(p.vemDe.prancheta), base) === 'anotada'; }
    return true;
  }
  /** Soma de um campo das dornas que começaram numa hora (ex.: enzima das dornas das 08h vai para a LPHERA das 08:00). */
  function sugestaoDaHora(data, sug, hora) {
    const dornas = listar(data, sug.prancheta).filter((r) => horaDoTexto(r.valores[sug.hora]) === hora && !vazio(r.valores[sug.campo]) && dornaTerminada(data, sug.prancheta, r));
    if (!dornas.length) return null;
    const total = dornas.reduce((s, r) => s + (parseFloat(r.valores[sug.campo]) || 0), 0);
    return { valor: String(Math.round(total * 100) / 100), dornas: dornas.map((r) => Number(r.chave)).sort((a, b) => a - b) };
  }
