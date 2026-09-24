/* Pranchetas Ubirálcool - app principal
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
(function () {
  'use strict';
  const C = window.USINA;
  const VERSAO = '2.5.0'; // aparece nos ajustes e vai junto com cada envio para a central
  const AUTORIA = '© 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor.';
  const params = new URLSearchParams(location.search);
  const DEMO_IMG = params.has('demo'); // usado só para gerar imagens de apresentação
  const NO_APK = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  /* =========================================================
   * Armazenamento local
   * ========================================================= */
  const LS = {
    get(k, padrao) { try { const v = localStorage.getItem('usina.' + k); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; } },
    set(k, v) { try { localStorage.setItem('usina.' + k, JSON.stringify(v)); } catch (e) { toast('A memória do aparelho está cheia. Chame o encarregado.', 'erro'); } },
  };
  const cfg = Object.assign({
    papel: null,          // id do setor ou 'central'
    deviceId: 'ap-' + Math.random().toString(36).slice(2, 8),
    op: null,             // { nome, chave } operador do turno
    operadores: {},       // nomes cadastrados neste aparelho (quando não há central)
    tema: 'claro',        // claro ou escuro, escolhido no botão do topo
    escala: 'normal',     // menor, normal ou maior (tamanho da tela)
    telaCheia: false,     // esconde a barra de bateria e hora do Android (liga nos ajustes do aparelho)
    central: '',          // endereço da central (vazio = o próprio site)
    chave: null,          // chave deste aparelho, recebida ao conectar na central (tudo vai embaralhado com ela)
    demo: false,          // modo demonstração, sem central
    ultimoContato: 0,
    ultimoSeq: 0,
  }, DEMO_IMG ? {} : LS.get('cfg', {}));
  const salvarCfg = () => { if (!DEMO_IMG) LS.set('cfg', cfg); };
  if (DEMO_IMG) cfg.demo = true;
  /* Até a versão 2.4 o aparelho guardava a chave da rede, que passava aberta no Wi-Fi.
     Agora cada aparelho usa a sua, tirada da chave da rede (public/cifra.js). */
  const usarChaveDaRede = (chaveRede) => { cfg.chave = Cifra.chaveDoAparelho(chaveRede, cfg.deviceId); cfg.cifra = 1; };
  if (cfg.chave && !cfg.cifra) usarChaveDaRede(cfg.chave);
  salvarCfg();

  let registros = DEMO_IMG ? {} : LS.get('registros', {});
  // toda mudança nas anotações passa por aqui (grava na memória do aparelho e avisa o índice abaixo)
  let versaoRegistros = 0;
  const salvarRegistros = () => { versaoRegistros++; if (!DEMO_IMG) LS.set('registros', registros); };

  /* Erros inesperados ficam guardados e vão para a central na próxima sincronização
     (pasta ServidorUsina, arquivo erros.log). Assim dá para descobrir o que aconteceu num tablet da área. */
  const errosGuardados = DEMO_IMG ? [] : LS.get('erros', []);
  function guardarErro(msg, detalhe) {
    try {
      if (errosGuardados.length >= 30) errosGuardados.shift();
      const tela = typeof pilha !== 'undefined' && pilha.length ? pilha[pilha.length - 1].tela : '';
      errosGuardados.push({ quando: Date.now(), versao: VERSAO, papel: cfg.papel, tela, msg: String(msg || '').slice(0, 300), detalhe: String(detalhe || '').slice(0, 900) });
      if (!DEMO_IMG) LS.set('erros', errosGuardados);
    } catch (e) { /* nunca deixa um erro no registro de erros travar o app */ }
  }
  window.addEventListener('error', (e) => guardarErro(e.message, `${e.filename || ''}:${e.lineno || ''}:${e.colno || ''} ${e.error && e.error.stack ? e.error.stack : ''}`));
  window.addEventListener('unhandledrejection', (e) => guardarErro('promessa: ' + (e.reason && e.reason.message ? e.reason.message : e.reason), e.reason && e.reason.stack));

  /* =========================================================
   * Ícones de linha (sempre com texto do lado)
   * ========================================================= */
  const ICONES = {
    voltar: '<path d="M15 5l-7 7 7 7"/>', seta: '<path d="M9 5l7 7-7 7"/>',
    casa: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    pessoas: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.8"/><path d="M16.5 14.2c3 .2 5 2.3 5 5.3"/>',
    ajustes: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.6a7.7 7.7 0 000-3.2l2-1.4-2-3.4-2.3 1a7.6 7.6 0 00-2.8-1.6L13.9 2h-3.8l-.4 2.4a7.6 7.6 0 00-2.8 1.6l-2.3-1-2 3.4 2 1.4a7.7 7.7 0 000 3.2l-2 1.4 2 3.4 2.3-1a7.6 7.6 0 002.8 1.6l.4 2.6h3.8l.4-2.6a7.6 7.6 0 002.8-1.6l2.3 1 2-3.4-2-1.4z"/>',
    sol: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"/>',
    lua: '<path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/>',
    mais: '<path d="M12 5v14M5 12h14"/>', certo: '<path d="M5 12.5l4.5 4.5L19 7"/>', fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
    lixeira: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    enviar: '<path d="M4 12l16-8-6 16-3-7-7-1z"/>', baixar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    compartilhar: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3"/>',
    whatsapp: '<path d="M4 20l1.3-3.8A8 8 0 1112 20a8 8 0 01-4.1-1.1L4 20z"/><path d="M9 9.5c.3 2.3 2.2 4.2 4.5 4.6l1.3-1.3 1.7.8-.3 1.6c-3.9.3-8-3.8-7.7-7.7l1.6-.3.8 1.7L9 9.5z"/>',
    email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6l8.5 7 8.5-7"/>',
    imprimir: '<path d="M7 9V4h10v5M7 17H4v-7h16v7h-3M7 14h10v6H7z"/>',
    alerta: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.5"/>',
    apagar: '<path d="M9 5h11v14H9l-6-7 6-7z"/><path d="M12 9l5 6M17 9l-5 6"/>',
    teclado: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h1M10 10h1M14 10h1M18 10h0M7 14h10"/>',
    telaCheia: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="4"/>',
    instalar: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M12 7v7M9 11l3 3 3-3"/>',
    fim: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
    wifi: '<path d="M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0"/><circle cx="12" cy="19.5" r="1"/>',
    pasta: '<path d="M3 6h6l2 2h10v11H3z"/>',
    servidor: '<rect x="4" y="3" width="16" height="7" rx="1.5"/><rect x="4" y="14" width="16" height="7" rx="1.5"/><path d="M8 6.5h.01M8 17.5h.01"/>',
    tanque: '<path d="M6 4h12v13a3 3 0 01-3 3H9a3 3 0 01-3-3V4z"/><path d="M6 11h12M10 4V2h4v2"/>',
    balanca: '<path d="M12 4v16M6 20h12M4 8h16M7 8l-3 6h6l-3-6zM17 8l-3 6h6l-3-6z"/>',
    chama: '<path d="M12 21c-4 0-7-2.7-7-6.5C5 10 9 8 9 3c3 2 4 4 4 6 1-1 1.6-2 2-3 2.5 2.5 4 5.4 4 8.5C19 18.3 16 21 12 21z"/>',
    coluna: '<rect x="8" y="2" width="8" height="20" rx="3"/><path d="M8 7h8M8 12h8M8 17h8M16 9h4v8"/>',
    fabrica: '<path d="M3 21V10l6 3V9l6 3V4h6v17H3z"/><path d="M7 17h2M12 17h2M17 17h2"/>',
    escritorio: '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8M12 16v4"/>',
    planilha: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M4 9h16M4 15h16M10 3v18"/>',
    codigo: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
    nota: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13 7l4 4"/>',
    tamanho: '<path d="M4 20l7-16h2l7 16M7 14h10"/>',
    sino: '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4l2-2z"/><path d="M10 21h4"/>',
  };
  const ico = (nome) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome] || ''}</svg>`;

  /* =========================================================
   * Datas, turnos e formatos
   * ========================================================= */
  const pad2 = (n) => String(n).padStart(2, '0');
  const isoData = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const HORAS = Array.from({ length: 24 }, (_, i) => (C.inicioDoDia + i) % 24);
  function dataProducao(agora = new Date()) {
    const d = new Date(agora);
    if (d.getHours() < C.inicioDoDia) d.setDate(d.getDate() - 1);
    return isoData(d);
  }
  function somarDias(iso, n) { const [y, m, d] = iso.split('-').map(Number); return isoData(new Date(y, m - 1, d + n)); }
  const fmtData = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
  function diaSemana(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'][new Date(y, m - 1, d).getDay()];
  }
  const turnoDaHora = (h) => C.turnos.find((t) => h >= t.inicio && h < t.fim) || C.turnos[0];
  const turnoAtual = () => turnoDaHora(new Date().getHours());
  const horaAgora = () => { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
  const rotuloHora = (h) => `${pad2(h)}:00`;
  const rotuloHoraPapel = (h) => (h === 0 ? '24:00' : rotuloHora(h));
  const faixaTurno = (t) => `${pad2(t.inicio)}:00 às ${pad2(t.fim % 24)}:00`;
  const horaDoTexto = (hhmm) => (/^\d\d:\d\d$/.test(hhmm || '') ? Number(hhmm.slice(0, 2)) : null);

  /** 1 anotação, 2 anotações (em vez de "anotação(ões)", que é mais difícil de ler) */
  const contar = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  /** 2, 3 e 4 (em vez de 2 e 3 e 4) */
  const listaE = (l) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}` : l.join(''));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const vazio = (v) => v === '' || v == null;
  const fmtNum = (v) => (vazio(v) ? '' : String(v).replace('.', ','));
  const fmtCampo = (c, v) => (vazio(v) ? '' : c.type === 'num' ? fmtNum(v) : String(v));
  const fmtTamanho = (b) => (b > 1048576 ? `${fmtNum((b / 1048576).toFixed(1))} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

  /** Avisos de um valor: regras do processo (ex.: pH abaixo de 5 pede cal) e valor muito fora. */
  function avisosDe(c, v) {
    if (vazio(v) || (c.type && c.type !== 'num')) return [];
    const n = parseFloat(v);
    const lista = [];
    (c.avisos || []).forEach((a) => {
      const bate = { '<': n < a.valor, '<=': n <= a.valor, '>': n > a.valor, '>=': n >= a.valor }[a.quando];
      if (bate) lista.push({ nivel: a.nivel || 'alerta', texto: a.texto, curto: a.curto || a.texto });
    });
    const fora = (c.min != null && n < c.min) || (c.max != null && n > c.max);
    if (fora && !lista.length) lista.push({ nivel: 'alerta', texto: `Valor muito fora (esperado de ${fmtNum(c.min)} a ${fmtNum(c.max)}). Confira.`, curto: `${c.labelCurto || c.label} ${c.min != null && n < c.min ? 'baixo' : 'alto'}` });
    return lista;
  }
  const nivelDe = (c, v) => { const l = avisosDe(c, v); return l.some((x) => x.nivel === 'alerta') ? 'fora' : l.length ? 'atencao' : ''; };

  /* =========================================================
   * Setores, pranchetas e configuração da usina
   * ========================================================= */
  const todosSetores = C.setores;
  const setorPorId = (id) => todosSetores.find((s) => s.id === id);
  const prancheta = (pid) => C.pranchetas[pid];
  /** Setor de uma prancheta. Prancheta de insumo que fica dentro de uma tela "juntas" pertence ao setor da tela. */
  function setorDaPrancheta(pid) {
    const direto = todosSetores.find((s) => s.pranchetas.includes(pid));
    if (direto) return direto;
    const juntas = Object.keys(C.pranchetas).find((k) => C.pranchetas[k].tipo === 'juntas' && C.pranchetas[k].partes.some((pt) => pt.prancheta === pid));
    return juntas ? todosSetores.find((s) => s.pranchetas.includes(juntas)) : null;
  }
  /** Folhas de papel por trás de uma prancheta da tela (uma tela "juntas" tem duas folhas). */
  const folhasDe = (pid) => (prancheta(pid).tipo === 'juntas' ? prancheta(pid).partes.map((pt) => pt.prancheta) : [pid]);

  /* Configuração que o tablet chefe define e vale para todos os aparelhos.
     Fica guardada como um registro normal, então viaja pela mesma sincronização. */
  const CFG_SISTEMA = { data: 'config', pid: 'sistema', chave: 'geral' };
  const configSistema = () => (pegar(CFG_SISTEMA.data, CFG_SISTEMA.pid, CFG_SISTEMA.chave) || { valores: {} }).valores;
  function salvarConfigSistema(mudanca) {
    gravar(CFG_SISTEMA.data, CFG_SISTEMA.pid, CFG_SISTEMA.chave, mudanca, { operador: 'escritório' });
  }
  const listaDaUsina = (nome) => configSistema()[nome] || (nome === 'produtos' ? C.produtosPadrao : C.fornecedoresPadrao) || [];
  const opcoesDe = (c) => (Array.isArray(c.opcoes) ? c.opcoes : listaDaUsina(c.opcoes));

  const setorAtivo = (id) => (configSistema().setoresDesligados || []).indexOf(id) < 0;
  const setoresAtivos = () => todosSetores.filter((s) => setorAtivo(s.id));
  function pranchetasDo(setorId) {
    const s = setorPorId(setorId);
    if (!s) return [];
    const desligadas = (configSistema().pranchetasDesligadas || {})[setorId] || [];
    return s.pranchetas.filter((pid) => desligadas.indexOf(pid) < 0);
  }
  /** Setores ligados, já com as pranchetas ligadas de cada um. */
  const setores = () => setoresAtivos().map((s) => Object.assign({}, s, { pranchetas: pranchetasDo(s.id) }));
  const ehCentral = () => cfg.papel === 'central';

  /* Operadores: cada um tem a sua senha de 4 números, para ninguém anotar no nome do outro.
     A senha é guardada embaralhada, não em texto puro. Serve para evitar troca sem autorização,
     não é segurança de banco. O encarregado sempre consegue destravar com a senha dele. */
  const comoOperador = (o) => (typeof o === 'string' ? { nome: o, senha: '' } : { nome: o.nome, senha: o.senha || '' });
  const operadoresDo = (id) => ((configSistema().operadores || {})[id] || cfg.operadores[id] || (setorPorId(id) || {}).operadores || []).map(comoOperador);
  const operadorPorNome = (id, nome) => operadoresDo(id).find((o) => o.nome === nome);
  function embaralharSenha(nome, senha) {
    let h = 5381;
    const texto = `${nome}:${senha}:ubiralcool`;
    for (let i = 0; i < texto.length; i++) h = ((h * 33) ^ texto.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  function salvarOperadores(setorId, lista) {
    const mapa = Object.assign({}, configSistema().operadores || {});
    mapa[setorId] = lista;
    if (ehCentral() || cfg.chave) salvarConfigSistema({ operadores: mapa });
    else { cfg.operadores[setorId] = lista; salvarCfg(); }
  }

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
    const corte = primeiroDiaGuardado();
    const corteAvisos = somarDias(dataProducao(), -DIAS_DOS_AVISOS);
    let n = 0;
    Object.keys(registros).forEach((id) => {
      const r = registros[id];
      if (!r.sincronizado || !/^\d{4}-\d{2}-\d{2}$/.test(r.data) || diasAbertos.has(r.data)) return;
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

  /* =========================================================
   * Dornas: etapas, Sacarificação e insumos que acompanham a Hidrólise
   * ========================================================= */
  /** enchendo (sem início) -> enviando (tem início, a bomba está mandando para cima) -> anotada (tem fim). */
  function etapaDaDorna(p, r) {
    if (!r) return 'nova';
    if (!p.envio) return 'anotada';
    if (!vazio(r.valores[p.envio.fim])) return 'anotada';
    return vazio(r.valores[p.envio.inicio]) ? 'enchendo' : 'enviando';
  }
  const dependentesDe = (pid) => Object.keys(C.pranchetas).filter((x) => C.pranchetas[x].vemDe && C.pranchetas[x].vemDe.prancheta === pid);
  const dornasDoDia = (data, pid) => listar(data, pid).filter((r) => /^\d+$/.test(r.chave)).sort((a, b) => a.chave - b.chave);
  const ordemNoDia = (h) => (h - C.inicioDoDia + 24) % 24;
  const nomesDasHoras = (horas) => [...horas].sort((a, b) => ordemNoDia(a) - ordemNoDia(b)).map((h) => pad2(h) + 'h').join(', ');

  /** A Sacarificação acompanha a dorna de mesmo número da Hidrólise: cria a linha e copia horário, pH e Brix finais.
      Quadro mudado à mão na Sacarificação para de copiar ("manuais"). */
  function acompanharDorna(data, pid, chave) {
    const base = pegar(data, pid, chave);
    if (!base) return;
    dependentesDe(pid).forEach((pid2) => {
      const p2 = prancheta(pid2);
      const r = pegar(data, pid2, chave);
      const manuais = (r && r.manuais) || [];
      const novos = {};
      Object.entries(p2.vemDe.campos).forEach(([meu, dela]) => {
        if (manuais.includes(meu)) return;
        const x = base.valores[dela];
        if (!vazio(x) && (!r || r.valores[meu] !== x)) novos[meu] = x;
      });
      if (!r) {
        const ant = dornasDoDia(data, pid2).filter((x) => Number(x.chave) < Number(chave)).pop();
        const inicial = {};
        (p2.copiarDaAnterior || []).forEach((id) => { if (ant && !vazio(ant.valores[id])) inicial[id] = ant.valores[id]; });
        p2.campos.forEach((c) => { if (c.padrao != null && vazio(inicial[c.id])) inicial[c.id] = c.padrao; });
        gravar(data, pid2, chave, Object.assign(inicial, novos), { operador: base.operador || '', manuais: [] });
      } else if (Object.keys(novos).length) gravar(data, pid2, chave, novos, { operador: r.operador || base.operador || '' });
    });
  }

  /** LPHERA, Cal, Saczyme e Antibiótico de cada hora somados das dornas enviadas naquela hora, quando elas terminam
      (duas dornas das 08h = 140 de LPHERA, 200 de Saczyme). O operador só confere e confirma.
      Hora que alguém anotou ou confirmou não é mais mexida. */
  function somarInsumosDoDia(data) {
    Object.values(C.pranchetas).filter((pj) => pj.tipo === 'juntas').forEach((pj) => pj.partes.forEach((pt) => {
      const sug = pt.sugestao;
      const folha = prancheta(pt.prancheta);
      const porHora = {};
      listar(data, sug.prancheta).filter((r) => dornaTerminada(data, sug.prancheta, r)).forEach((r) => {
        const h = horaDoTexto(r.valores[sug.hora]);
        const n = parseFloat(r.valores[sug.campo]);
        if (h == null || isNaN(n)) return;
        const x = porHora[h] || (porHora[h] = { total: 0, dornas: [], operador: '' });
        x.total += n; x.dornas.push(Number(r.chave)); x.operador = r.operador || x.operador;
      });
      Object.entries(porHora).forEach(([h, x]) => {
        const r = pegar(data, pt.prancheta, h);
        const dornas = x.dornas.sort((a, b) => a - b);
        const valor = String(Math.round(x.total * 100) / 100);
        const igual = (reg) => reg.valores.qtd === valor && JSON.stringify(reg.dornas || []) === JSON.stringify(dornas);
        // anotada à mão: não mexe. Só confirmou a soma e depois entrou ou saiu uma dorna dessa hora: volta para conferir
        if (r && !r.auto && (!r.somaConfirmada || igual(r))) return;
        if (x.total <= 0) { if (r) apagar(data, pt.prancheta, h); return; }
        if (r && r.auto && igual(r)) return;
        gravar(data, pt.prancheta, h, { qtd: valor, unidade: (r && r.valores.unidade) || folha.unidade }, { operador: x.operador, auto: true, conferir: true, somaConfirmada: false, dornas });
      });
      linhasDeHora(listar(data, pt.prancheta)).filter((r) => (r.auto || r.somaConfirmada) && !porHora[r.chave]).forEach((r) => apagar(data, pt.prancheta, r.chave));
    }));
  }
  /** Depois que uma dorna mudou neste aparelho: Sacarificação e insumos acompanham. */
  function depoisDeMudarDorna(data, pid, chave) {
    if (chave != null) acompanharDorna(data, pid, chave);
    somarInsumosDoDia(data);
  }

  /** Apaga a dorna e sobe as seguintes um número (3 vira 2), na Hidrólise e na Sacarificação, como na folha de papel. */
  function apagarDorna(data, pid, k) {
    [pid, ...dependentesDe(pid)].forEach((x) => {
      const seguintes = dornasDoDia(data, x).filter((r) => Number(r.chave) > k);
      apagar(data, x, k);
      seguintes.forEach((r) => {
        const n = Number(r.chave);
        const resto = Object.assign({}, r);
        ['id', 'chave', 'valores', 'atualizadoEm', 'sincronizado', 'seq', 'recebidoEm', 'apagado', 'aparelho'].forEach((c) => delete resto[c]);
        gravar(data, x, n - 1, r.valores, resto);
        apagar(data, x, n);
      });
    });
    somarInsumosDoDia(data);
  }

  /* =========================================================
   * Central: conexão pela rede da usina
   * ========================================================= */
  const sync = { modo: 'verificando', ocupado: false, status: null, statusJson: '' };

  /* Central dentro do próprio tablet chefe (só no aplicativo instalado).
     Assim a usina não precisa de um computador ligado o tempo todo. */
  const pluginCentral = NO_APK && window.Capacitor.Plugins ? window.Capacitor.Plugins.Central : null;
  /* O servidor da usina roda neste aparelho? (é separado de ser o tablet chefe: o tablet chefe pode usar um servidor
     que está em outro aparelho, e o servidor pode ficar num aparelho que não é o tablet chefe) */
  const centralNoTablet = () => NO_APK && !!cfg.servidor && !!pluginCentral;
  async function ligarCentralDoTablet() {
    if (!centralNoTablet()) return false;
    try {
      await garantirRedeLocal(true);
      await pluginCentral.criarPastas();
      const r = await pluginCentral.iniciar({ porta: C.portaCentral });
      pluginCentral.manterLigado().catch(() => {});
      cfg.central = `http://127.0.0.1:${C.portaCentral}`;
      usarChaveDaRede(r.chave);
      cfg.demo = false;
      cfg.ultimoContato = Date.now();
      salvarCfg();
      return true;
    } catch (e) {
      toast('Não consegui ligar o servidor neste tablet', 'erro');
      return false;
    }
  }
  /* Android 16 e 17 podem bloquear a rede local (permissão "Dispositivos por perto" ou "Rede local").
     Sem ela, o tablet não acha o tablet chefe e o tablet chefe não recebe ninguém, mesmo no mesmo Wi-Fi. */
  let jaExpliqueiRede = false;
  async function garantirRedeLocal(pedir = true) {
    if (!NO_APK || !pluginCentral || !pluginCentral.permissaoRede) return true;
    try {
      const r = await pluginCentral.permissaoRede({ pedir });
      if (r.estado === 'livre' || r.estado === 'concedida') return true;
      if (pedir || !jaExpliqueiRede) await explicarRedeBloqueada();
      return false;
    } catch (e) { return true; }
  }
  async function explicarRedeBloqueada() {
    if (modalAberto()) return;
    jaExpliqueiRede = true;
    const abrir = await confirmar('O Android bloqueou a rede local',
      'Sem essa permissão o aplicativo não acha os outros tablets no Wi-Fi. Toque em Abrir ajustes, depois em Permissões, e deixe "Dispositivos por perto" (ou "Rede local") em Permitir.', 'Abrir ajustes');
    if (abrir && pluginCentral.abrirAjustesDoApp) pluginCentral.abrirAjustesDoApp().catch(() => {});
  }
  const baseCentral = () => (cfg.central ? cfg.central.replace(/\/$/, '') + '/' : '');

  /* Tudo que vai para a central passa embaralhado com a chave deste aparelho (public/cifra.js).
     Só o "ping" (a central está aí?) e o pedido de conexão vão abertos, e neles não há anotação nem chave. */
  let desvioCentral = 0; // diferença entre o relógio da central e o deste aparelho (a central só aceita pedido recente)
  async function pedirCifrado(base, caminho, opcoes = {}, ms = 4000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      for (let vez = 0; vez < 2; vez++) {
        const { corpo, iv } = await Cifra.pedido(cfg.chave, cfg.deviceId, opcoes.method || 'GET', caminho, opcoes.body || '', Date.now() + desvioCentral);
        const r = await fetch(`${base}api/c?a=${encodeURIComponent(cfg.deviceId)}`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: corpo, signal: ctrl.signal, cache: 'no-store' });
        if (r.status === 409 && vez === 0) {
          // o relógio deste aparelho está longe do da central: acerta a diferença e pede de novo
          const d = await r.json().catch(() => ({}));
          if (d.agora) { desvioCentral = d.agora - Date.now(); continue; }
        }
        if (r.status !== 200) return r; // 401: a chave não vale mais (o código de conexão foi trocado)
        const resp = await Cifra.resposta(cfg.chave, iv, new Uint8Array(await r.arrayBuffer()));
        return new Response(resp.texto, { status: resp.status, headers: { 'Content-Type': 'application/json' } });
      }
      throw new Error('relógio');
    } finally { clearTimeout(t); }
  }
  async function buscar(caminho, opcoes = {}, ms = 4000) {
    if (cfg.chave && caminho !== 'api/ping' && caminho !== 'api/parear') return pedirCifrado(baseCentral(), caminho, opcoes, ms);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try { return await fetch(baseCentral() + caminho, Object.assign({}, opcoes, { signal: ctrl.signal, cache: 'no-store' })); } finally { clearTimeout(t); }
  }
  const avisarCentralAntiga = () => toast(`O servidor da usina está com o aplicativo antigo. Atualize o servidor (tablet chefe ou computador) para a versão ${VERSAO}.`, 'erro');
  const postJson = (caminho, corpo, ms) => buscar(caminho, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }, ms);

  async function sincronizar() {
    if (cfg.demo || !cfg.chave || sync.ocupado) return;
    sync.ocupado = true;
    const bloqueadoAntes = foraDaRede();
    try {
      const r0 = await buscar('api/ping');
      const info = r0.ok ? await r0.json() : null;
      if (!info || info.app !== 'pranchetas') throw new Error('sem central');
      if (!info.cifra) {
        // central ainda na versão antiga (sem a conexão embaralhada): espera ela ser atualizada, sem apagar nada
        if (Date.now() - (sync.avisoAntiga || 0) > 10 * 60000) { sync.avisoAntiga = Date.now(); avisarCentralAntiga(); }
        throw new Error('central antiga');
      }
      if (info.agora) desvioCentral = info.agora - Date.now();
      cfg.ultimoContato = Date.now(); salvarCfg();
      sync.modo = 'online'; sync.falhas = 0;

      // em lotes: um aparelho que ficou muito tempo sem Wi-Fi não manda tudo de uma vez
      const envio = Object.values(registros).filter((r) => !r.sincronizado).slice(0, LOTE_ENVIO);
      const erros = errosGuardados.slice();
      const antesDoEnvio = Date.now();
      const r1 = await postJson('api/sync', { aparelho: cfg.deviceId, papel: cfg.papel, operador: operadorAtual(), versao: VERSAO, geracao: cfg.geracao || '', novaConexao: !!cfg.novaConexao, registros: envio, erros }, 15000);
      if (r1.status === 401) {
        // o servidor está neste aparelho: pega a chave nova com ele (o código de conexão foi trocado)
        if (centralNoTablet()) { try { const e = await pluginCentral.estado(); if (e && e.chave) { usarChaveDaRede(e.chave); salvarCfg(); } } catch (x) { /* tenta de novo */ } return; }
        return desconectar('O código de conexão mudou (ou a central foi trocada). Digite o código novo que aparece no tablet chefe.');
      }
      const resp1 = r1.ok ? await r1.clone().json().catch(() => ({})) : {};
      // o escritório zerou as anotações de teste: limpa as deste aparelho e começa de novo
      if (resp1.zerar) { zerarLocal(resp1.geracao); toast('O escritório zerou as anotações. Este aparelho começou do zero.'); render(true); return; }
      if (r1.ok && resp1.geracao && resp1.geracao !== cfg.geracao) {
        // conectou numa central nova (tablet chefe trocado ou reinstalado): manda de novo o que este aparelho guarda,
        // para a central não começar vazia
        const outraCentral = !!cfg.geracao;
        cfg.geracao = resp1.geracao; cfg.ultimoSeq = 0;
        if (outraCentral) { Object.values(registros).forEach((r) => { if (!envio.includes(r)) r.sincronizado = false; }); salvarRegistros(); }
        salvarCfg();
      }
      if (r1.ok && cfg.novaConexao) { cfg.novaConexao = false; salvarCfg(); }
      if (r1.ok && envio.length) {
        envio.forEach((e) => { const atual = registros[e.id]; if (atual && atual.atualizadoEm === e.atualizadoEm) atual.sincronizado = true; });
        salvarRegistros();
      }
      if (r1.ok) {
        const resp = await r1.json().catch(() => ({}));
        if (erros.length) { errosGuardados.splice(0, erros.length); LS.set('erros', errosGuardados); }
        if (resp.agora) conferirRelogio(resp.agora - (antesDoEnvio + Date.now()) / 2);
      }
      let mudou = false;
      // o aparelho passou a guardar mais dias (virou tablet chefe): busca de novo, desde o começo
      const corte = primeiroDiaGuardado();
      if (cfg.corteSync && corte < cfg.corteSync) cfg.ultimoSeq = 0;
      const r2 = await buscar(`api/registros?desde=${cfg.ultimoSeq || 0}&aPartirDe=${corte}`, {}, 15000);
      if (r2.ok) {
        const dados = await r2.json();
        for (const rec of dados.registros) {
          const local = registros[rec.id];
          if (!local || rec.atualizadoEm > local.atualizadoEm) { registros[rec.id] = Object.assign({}, rec, { sincronizado: true }); mudou = true; }
        }
        cfg.ultimoSeq = dados.seq; cfg.corteSync = corte; salvarCfg();
        if (mudou) { podar(); salvarRegistros(); }
      }
      if (ehCentral()) {
        const r3 = await buscar('api/status');
        if (r3.ok) {
          const texto = await r3.text();
          // só redesenha se algo mudou de verdade, para não pular a tela de quem está olhando
          if (texto !== sync.statusJson) { sync.statusJson = texto; sync.status = JSON.parse(texto); mudou = true; }
          verificarBase44();
        }
      }
      if (mudou && ['central', 'inicio', 'prancheta', 'config'].includes(view().tela)) {
        if (podeRedesenhar()) render(); else redesenharDepois = true;
      }
      if (mudou && view().tela === 'avisos') atualizarTelaAvisos();
      revisarAvisoNaTela();
      verificarAvisos();
      if (envio.length === LOTE_ENVIO) sincronizarLogo(); // ainda tem anotação esperando: manda o próximo lote
    } catch (e) {
      sync.modo = 'offline';
      sync.falhas = (sync.falhas || 0) + 1;
      // no aplicativo: depois de umas falhas seguidas, procura o tablet chefe no Wi-Fi (no máximo a cada 3 minutos)
      if (NO_APK && sync.falhas >= 3 && Date.now() - (sync.ultimaBusca || 0) > 180000) { sync.ultimaBusca = Date.now(); setTimeout(reencontrarCentral, 0); }
    } finally {
      sync.ocupado = false;
      if (bloqueadoAntes !== foraDaRede()) render(); else atualizarConexao();
    }
  }
  /* A hora de cada anotação vem do relógio do aparelho. Se ele estiver muito diferente da central,
     avisa (a folha do dia e o turno dependem da hora certa). */
  function conferirRelogio(diferenca) {
    sync.relogio = diferenca;
    const minutos = Math.round(diferenca / 60000);
    if (Math.abs(minutos) < 5) { sync.avisoRelogio = 0; return; }
    if (Date.now() - (sync.avisoRelogio || 0) < 30 * 60000) return;
    sync.avisoRelogio = Date.now();
    toast(`O relógio deste aparelho está ${Math.abs(minutos)} min ${minutos > 0 ? 'atrasado' : 'adiantado'}. Acerte a hora nos ajustes do Android.`, 'erro');
  }
  const textoRelogio = () => {
    if (sync.relogio == null) return 'ainda não conferido';
    const m = Math.round(sync.relogio / 60000);
    return Math.abs(m) < 2 ? 'certo' : `${Math.abs(m)} min ${m > 0 ? 'atrasado' : 'adiantado'}`;
  };
  const LOTE_ENVIO = 300;
  let syncTimer = null;
  function sincronizarLogo() { clearTimeout(syncTimer); syncTimer = setTimeout(sincronizar, 400); atualizarConexao(); }
  const foraDaRede = () => !cfg.demo && !!cfg.chave && !ehCentral() && Date.now() - (cfg.ultimoContato || 0) > C.horasForaDaRede * 3600 * 1000;
  /** Apaga as anotações guardadas neste aparelho (a configuração da usina fica). */
  function zerarLocal(geracao) {
    Object.keys(registros).forEach((id) => { if (registros[id].data !== 'config') delete registros[id]; });
    salvarRegistros();
    cfg.ultimoSeq = 0; cfg.geracao = geracao || ''; salvarCfg();
    rascunho = null; ed.alvoId = null;
    Object.keys(lembrar).forEach((k) => delete lembrar[k]);
    pilha = [telaInicial()];
    if (cfg.papel && !ehCentral() && !operadorAtual()) pilha.push({ tela: 'operador' });
  }
  /** Tablet chefe abrindo um dia que não está mais guardado nele: busca as anotações na central.
      Devolve uma promessa: quem vai gerar o relatório de um dia antigo espera ele chegar. */
  const promessasDoDia = new Map();
  function buscarDia(data) {
    if (!ehCentral() || cfg.demo || !cfg.chave || !/^\d{4}-\d{2}-\d{2}$/.test(data || '') || data >= primeiroDiaGuardado()) return Promise.resolve();
    if (promessasDoDia.has(data)) return promessasDoDia.get(data);
    const promessa = (async () => {
      diasAbertos.add(data); diasBuscando.add(data);
      try {
        const r = await buscar('api/registros?dia=' + data, {}, 20000);
        if (!r.ok) throw new Error('central');
        const dados = await r.json();
        (dados.registros || []).forEach((rec) => {
          const local = registros[rec.id];
          if (!local || rec.atualizadoEm > local.atualizadoEm) registros[rec.id] = Object.assign({}, rec, { sincronizado: true });
        });
        salvarRegistros();
      } catch (e) {
        diasAbertos.delete(data); promessasDoDia.delete(data); // na próxima vez tenta de novo
        toast(`Não consegui buscar a folha de ${fmtData(data)} na central`, 'erro');
      }
      diasBuscando.delete(data);
      if (podeRedesenhar()) render(); else redesenharDepois = true;
    })();
    promessasDoDia.set(data, promessa);
    return promessa;
  }
  function desconectar(msg) { cfg.chave = null; salvarCfg(); pilha = [{ tela: 'conectar' }]; render(); toast(msg, 'erro'); }

  function textoConexao() {
    const p = pendentes();
    if (cfg.demo) return 'Demonstração, dados só neste aparelho';
    if (sync.modo === 'online') return p ? `Enviando ${contar(p, 'anotação', 'anotações')}` : 'Tudo enviado para a central';
    if (sync.modo === 'offline') return p ? `Sem Wi-Fi. ${contar(p, 'anotação guardada', 'anotações guardadas')} aqui` : 'Sem Wi-Fi. Pode anotar: fica guardado aqui';
    return 'Procurando a central';
  }
  const classeConexao = () => (cfg.demo ? '' : sync.modo === 'online' ? 'ok' : sync.modo === 'offline' ? 'off' : '');
  const subtituloDaFolha = (data) => `Folha de ${fmtData(data)}, ${cfg.demo ? 'demonstração' : sync.modo === 'online' ? (pendentes() ? 'enviando para a central' : 'tudo enviado para a central') : sync.modo === 'offline' ? 'guardando no aparelho' : 'procurando a central'}`;
  function atualizarConexao() {
    const el = document.getElementById('conexao');
    if (el) { el.className = `conexao ${classeConexao()}`; el.innerHTML = `<i></i>${esc(textoConexao())}`; }
    const sub = document.getElementById('subtitulo-topo');
    const v = view();
    if (sub && v && v.tela === 'prancheta') sub.textContent = subtituloDaFolha(dataDaView(v));
  }

  /* =========================================================
   * Operador do turno e trava por inatividade
   * ========================================================= */
  let ultimaAtividade = Date.now();
  const marcarAtividade = () => { ultimaAtividade = Date.now(); };
  document.addEventListener('pointerdown', marcarAtividade, { passive: true });
  document.addEventListener('keydown', marcarAtividade, { passive: true });
  function travarPorInatividade() {
    if (ehCentral() || !cfg.papel || !operadorAtual()) return;
    if (Date.now() - ultimaAtividade < (C.minutosSemMexer || 30) * 60000) return;
    if (modalAberto()) fecharModalAtual();
    if (rascunhoSujo()) salvarRascunho(true);
    cfg.op = null; salvarCfg();
    rascunho = null; ed.alvoId = null;
    pilha = [telaInicial(), { tela: 'operador', travado: true }];
    render();
    marcarAtividade();
  }
  const chaveTurno = () => `${dataProducao()}-${turnoAtual().id}`;
  const operadorAtual = () => (cfg.op && cfg.op.chave === chaveTurno() ? cfg.op.nome : null);
  function definirOperador(nome) { cfg.op = { nome, chave: chaveTurno() }; salvarCfg(); }

  /* =========================================================
   * Janelas por cima da tela (fundo escurecido)
   * ========================================================= */
  const raizModal = document.getElementById('modal-root');
  let fecharModalAtual = null;
  let modalFixo = false; // janela que só fecha no botão (aviso do escritório)
  const modalAberto = () => !!fecharModalAtual;
  function abrirModal(html, aoClicar, opcoes = {}) {
    return new Promise((resolve) => {
      raizModal.innerHTML = `<div class="fundo-modal ${opcoes.fundo || ''}"><div class="modal ${opcoes.classe || ''}" role="dialog" aria-modal="true">${html}</div></div>`;
      const fundo = raizModal.firstElementChild;
      let fechado = false;
      modalFixo = !!opcoes.fixo;
      const fechar = (valor) => {
        if (fechado) return;
        fechado = true; document.removeEventListener('keydown', teclas); fecharModalAtual = null; modalFixo = false;
        // sai com animação curta; outra janela que abrir logo em seguida não é apagada junto
        fundo.classList.add('fechando');
        setTimeout(() => fundo.remove(), movimentoReduzido() ? 0 : 170);
        resolve(valor);
      };
      const teclas = (e) => { if (opcoes.aoTeclar) opcoes.aoTeclar(e, fechar); if (e.key === 'Escape' && !opcoes.fixo) fechar(undefined); };
      document.addEventListener('keydown', teclas);
      fecharModalAtual = () => fechar(undefined);
      fundo.addEventListener('click', (e) => {
        if (e.target === fundo) return opcoes.fixo ? undefined : fechar(undefined);
        const b = e.target.closest('[data-k]');
        if (b) aoClicar(b.dataset.k, b, fechar, fundo);
      });
      if (opcoes.aoAbrir) opcoes.aoAbrir(fundo, fechar);
      agendarCaber();
    });
  }
  const movimentoReduzido = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function pedirSenhaModal(titulo, dica) {
    let s = '';
    const desenhar = (f) => { f.querySelector('.visor').innerHTML = s ? s.replace(/./g, '•') : '<span class="apagado">----</span>'; };
    return abrirModal(`<h3>${esc(titulo || 'Senha do encarregado')}</h3><p class="dica">${esc(dica || 'Os ajustes do aparelho ficam protegidos.')}</p>
      <div class="visor"></div>
      <div class="teclas">${[7, 8, 9, 4, 5, 6, 1, 2, 3].map((n) => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="c" class="menor">Limpar</button><button data-k="0">0</button><button data-k="b">${ico('apagar')}</button></div>
      <div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn primario" data-k="ok">Entrar</button></div>`,
    (k, b, fechar, f) => {
      if (/^\d$/.test(k) && s.length < 8) s += k;
      else if (k === 'b') s = s.slice(0, -1);
      else if (k === 'c') s = '';
      else if (k === 'x') return fechar(undefined);
      else if (k === 'ok') return fechar(s);
      desenhar(f);
    }, { aoAbrir: desenhar });
  }
  function textoLivre(o) {
    return abrirModal(`<h3>${esc(o.titulo)}</h3>${o.dica ? `<p class="dica">${esc(o.dica)}</p>` : ''}
      <input type="${o.tipo || 'text'}" id="txt" maxlength="${o.max || 80}" value="${esc(o.valor || '')}" ${o.tipo === 'tel' ? 'inputmode="numeric"' : ''} autocapitalize="off" spellcheck="false">
      <div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn primario" data-k="ok">Salvar</button></div>`,
    (k, b, fechar, f) => { if (k === 'x') fechar(undefined); if (k === 'ok') fechar(f.querySelector('#txt').value.trim()); },
    { aoAbrir: (f) => setTimeout(() => f.querySelector('#txt').focus(), 50) });
  }
  function confirmar(titulo, dica, textoSim = 'Sim', perigo = false) {
    return abrirModal(`<h3>${esc(titulo)}</h3><p class="dica">${esc(dica || '')}</p>
      <div class="acoes-modal"><button class="btn" data-k="nao">Não</button><button class="btn ${perigo ? 'perigo' : 'primario'}" data-k="sim">${esc(textoSim)}</button></div>`,
    (k, b, fechar) => fechar(k === 'sim')).then((v) => !!v);
  }
  /** Pergunta qual arquivo mandar. Resolve 'xlsx', 'xml', 'texto' ou undefined. */
  /** Escolhe de quais setores (todos vêm marcados) e, para enviar, qual arquivo. Resolve { formato, setores } ou undefined.
      soSetores: para imprimir, só escolhe os setores. */
  function escolherEnvio(titulo, comTexto, soSetores) {
    const todos = setores();
    const marcados = new Set(todos.map((s) => s.id));
    const chips = () => todos.map((s) => `<button data-k="s:${s.id}" class="${marcados.has(s.id) ? 'sel' : ''}">${ico(marcados.has(s.id) ? 'certo' : s.icone)}<span>${esc(s.nome)}</span></button>`).join('');
    const opcoes = soSetores
      ? `<div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn primario" data-k="f:imprimir">${ico('imprimir')} Imprimir</button></div>`
      : `<div class="escolhas">
        <button data-k="f:xlsx"><span class="escolha-ico">${ico('planilha')}</span><b>Excel</b><small>Planilha com as folhas do dia, igual ao papel</small></button>
        <button data-k="f:xml"><span class="escolha-ico">${ico('codigo')}</span><b>XML</b><small>Arquivo para o sistema do escritório</small></button>
        ${comTexto ? `<button data-k="f:texto"><span class="escolha-ico">${ico('nota')}</span><b>Resumo em texto</b><small>Mensagem organizada por setor, com os totais de cada insumo</small></button>` : ''}
      </div>
      <div class="acoes-modal um"><button class="btn" data-k="x">Cancelar</button></div>`;
    return abrirModal(`<h3>${esc(titulo)}</h3><p class="dica">Toque num setor para tirar ou pôr de volta.</p>
      <div class="chips-escolha setores-envio">${chips()}</div>${opcoes}`,
    (k, b, fechar, fundo) => {
      if (k === 'x') return fechar(undefined);
      if (k.startsWith('s:')) {
        const id = k.slice(2);
        if (marcados.has(id)) marcados.delete(id); else marcados.add(id);
        fundo.querySelector('.setores-envio').innerHTML = chips();
        return;
      }
      if (k.startsWith('f:')) {
        if (!marcados.size) return toast('Escolha pelo menos um setor', 'erro');
        return fechar({ formato: k.slice(2), setores: todos.filter((s) => marcados.has(s.id)).map((s) => s.id) });
      }
    }, { classe: 'largo' });
  }
  /** Imprimir: escolhe os setores e abre a impressão (dia antigo é buscado na central antes). */
  async function imprimirEscolhendo(data) {
    const escolha = await escolherEnvio(`Imprimir as folhas de ${fmtData(data)}`, false, true);
    if (!escolha) return;
    await buscarDia(data);
    return imprimirFolhas(data, escolha.setores);
  }
  let toastTimer, toastSaindo;
  function esconderToast() {
    const t = document.getElementById('toast');
    if (t.hidden || t.classList.contains('saindo')) return;
    t.classList.add('saindo');
    clearTimeout(toastSaindo);
    toastSaindo = setTimeout(() => { t.hidden = true; t.classList.remove('saindo'); }, movimentoReduzido() ? 0 : 200);
  }
  function toast(msg, tipo = 'ok') {
    const t = document.getElementById('toast');
    clearTimeout(toastSaindo);
    t.innerHTML = (tipo === 'ok' ? ico('certo') : ico('alerta')) + `<span>${esc(msg)}</span>`;
    // reinicia a animação de entrada mesmo se já havia outra notificação na tela
    t.className = ''; void t.offsetWidth; t.className = tipo; t.hidden = false;
    t.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
    t.onclick = esconderToast; // um toque fecha
    // mensagem longa fica um pouco mais na tela
    clearTimeout(toastTimer); toastTimer = setTimeout(esconderToast, Math.min(6000, 2600 + String(msg).length * 45));
  }

  /* =========================================================
   * Avisos do escritório para quem está trabalhando
   * O tablet chefe manda um aviso para uma pessoa (ou para quem estiver no setor).
   * Se ela está trabalhando, o aviso aparece grande na tela dela na hora; se não, fica guardado
   * e aparece quando ela entrar com o nome dela. Só sai da tela no botão OK.
   * O aviso viaja como uma anotação comum (folha "avisos"), então funciona com o computador ou com
   * o tablet chefe como central, e quem estava sem Wi-Fi recebe quando a rede volta.
   * A confirmação de leitura é uma anotação separada ("avisos-recibo"), escrita só pelo aparelho que leu,
   * para o escritório e o aparelho nunca escreverem na mesma anotação ao mesmo tempo.
   * ========================================================= */
  const PID_AVISO = 'avisos', PID_RECIBO = 'avisos-recibo';
  const TAMANHO_AVISO = 300;
  const horaCurta = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  function todosAvisos() {
    return indiceDasFolhas().avisos
      .map((r) => Object.assign({ id: r.chave, data: r.data }, r.valores))
      .sort((a, b) => (b.enviadoEm || 0) - (a.enviadoEm || 0));
  }
  const reciboDo = (av) => { const r = pegar(av.data, PID_RECIBO, av.id); return r ? r.valores : {}; };
  function situacaoDoAviso(av) {
    const rc = reciboDo(av);
    const setor = (setorPorId(av.paraSetor) || {}).nome || av.paraSetor;
    if (rc.lidoEm) return { estado: 'lido', texto: `Lido por ${rc.lidoPor || 'alguém'} às ${horaCurta(rc.lidoEm)}${isoData(new Date(rc.lidoEm)) !== isoData(new Date()) ? ` de ${fmtData(isoData(new Date(rc.lidoEm)))}` : ''}` };
    if (av.cancelado) return { estado: 'cancelado', texto: 'Cancelado pelo escritório' };
    if (rc.mostradoEm) return { estado: 'na-tela', texto: `Na tela de ${rc.mostradoPara || 'alguém'} desde ${horaCurta(rc.mostradoEm)}` };
    return { estado: 'esperando', texto: av.paraNome ? `Esperando ${av.paraNome} entrar` : `Esperando alguém entrar na ${setor}` };
  }
  const avisosEmAberto = () => todosAvisos().filter((av) => ['esperando', 'na-tela'].includes(situacaoDoAviso(av).estado));
  /** Quem está trabalhando agora em cada setor, pelos aparelhos ligados na central. */
  function trabalhandoAgora(setorId, nome) {
    const st = sync.status;
    return !!(st && st.aparelhos && st.aparelhos.some((a) => a.online && a.papel === setorId && a.operador && (!nome || a.operador === nome)));
  }
  function enviarAviso(setorId, nome, texto) {
    const id = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    gravar(dataProducao(), PID_AVISO, id, { paraSetor: setorId, paraNome: nome || '', texto, de: 'escritório', enviadoEm: Date.now() }, { operador: 'escritório' });
    return id;
  }
  function avisoParaMim() {
    if (!cfg.papel || ehCentral()) return null;
    const op = operadorAtual();
    if (!op) return null;
    return todosAvisos().filter((av) => !av.cancelado && av.paraSetor === cfg.papel && (!av.paraNome || av.paraNome === op) && !reciboDo(av).lidoEm)
      .sort((a, b) => (a.enviadoEm || 0) - (b.enviadoEm || 0))[0] || null;
  }
  function chamarAtencao() {
    try { if (navigator.vibrate) navigator.vibrate([250, 120, 250]); } catch (e) { /* sem vibração */ }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      [0, 0.28].forEach((t) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.22);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.24);
      });
      setTimeout(() => ctx.close().catch(() => {}), 900);
    } catch (e) { /* sem som */ }
  }
  let avisoNaTela = null;
  /** Mostra o aviso mais antigo que ainda não foi lido por quem está trabalhando neste aparelho. */
  function verificarAvisos() {
    if (avisoNaTela || modalAberto()) return;
    const av = avisoParaMim();
    if (!av) return;
    const op = operadorAtual();
    avisoNaTela = av.id;
    if (!reciboDo(av).mostradoEm) gravar(av.data, PID_RECIBO, av.id, { mostradoEm: Date.now(), mostradoPara: op, aparelhoMostrou: cfg.deviceId }, { operador: op });
    const setor = (setorPorId(av.paraSetor) || {}).nome || '';
    const quando = av.enviadoEm ? `${horaCurta(av.enviadoEm)}${av.data !== dataProducao() ? ` de ${fmtData(isoData(new Date(av.enviadoEm)))}` : ''}` : '';
    chamarAtencao();
    abrirModal(`<div class="aviso-cab"><span class="aviso-sino">${ico('sino')}</span>
        <div><small>Aviso do escritório</small><b>Para ${esc(av.paraNome || `quem estiver na ${setor}`)}</b></div></div>
      <p class="aviso-texto">${esc(av.texto)}</p>
      <p class="aviso-de">Enviado pelo escritório${quando ? ` às ${esc(quando)}` : ''}</p>
      <button class="btn primario aviso-ok" data-k="ok">${ico('certo')} OK, entendi</button>`,
    (k, b, fechar) => { if (k === 'ok') fechar('ok'); }, { classe: 'aviso-grande', fundo: 'fundo-aviso', fixo: true })
      .then((r) => {
        avisoNaTela = null;
        if (r === 'ok') {
          gravar(av.data, PID_RECIBO, av.id, { lidoEm: Date.now(), lidoPor: operadorAtual() || op, aparelhoLeu: cfg.deviceId }, { operador: operadorAtual() || op });
          toast('Aviso confirmado. O escritório já sabe que você leu.');
        }
        setTimeout(verificarAvisos, 600); // se tiver outro aviso, mostra em seguida
      });
  }

  /* =========================================================
   * Teclado fixo (30% da tela no tablet deitado, embaixo no celular)
   * ========================================================= */
  const ed = { alvoId: null, oculto: false, letras: false, texto: '', substituir: true };
  let alvos = [];          // quadros editáveis da tela atual
  let contextoEdicao = ''; // ex.: "dorna Nº 9"
  const alvoAtual = () => alvos.find((a) => a.id === ed.alvoId);
  const painelVisivel = () => !!alvoAtual() && !ed.oculto;

  function textoInicial(a) {
    const v = a.get();
    if (vazio(v)) return '';
    if (a.type === 'time') return String(v).replace(':', '');
    if (a.type === 'num') return String(v).replace('.', ',');
    return String(v);
  }
  function selecionar(id) {
    const a = alvos.find((x) => x.id === id);
    if (!a) return;
    // número: a primeira tecla troca o valor antigo (fica marcado em azul); texto: continua escrevendo
    const antes = ed.alvoId;
    ed.alvoId = id; ed.oculto = false; ed.substituir = a.type === 'num' || a.type === 'time';
    ed.letras = a.type === 'text';
    ed.texto = textoInicial(a);
    atualizarEdicao(antes && antes !== id ? [antes, id] : [id]);
  }
  const passoDo = (a) => a.passo || Math.pow(10, -(a.dec || 0));

  function tecla(k) {
    const a = alvoAtual();
    if (!a) return;
    const dec = a.dec || 0;
    if (k === 'ocultar') { ed.oculto = true; return atualizarEdicao(); }
    if (k === 'prox' || k === 'ant') {
      const i = alvos.indexOf(a) + (k === 'prox' ? 1 : -1);
      if (i >= alvos.length) { ed.oculto = true; return atualizarEdicao(); }
      if (i >= 0) selecionar(alvos[i].id);
      return;
    }
    if (rascunho && rascunho.tocados) rascunho.tocados[a.id] = true; // mexeu: a hora para de seguir o relógio
    if (k === 'abc') { ed.letras = !ed.letras; return atualizarEdicao(); }
    if (k.startsWith('u:')) { a.setUnidade(k.slice(2)); return atualizarEdicao([a.id]); }
    if (k.startsWith('o:')) { a.set(a.opcoes[Number(k.slice(2))]); atualizarEdicao([a.id]); return setTimeout(() => tecla('prox'), 180); }
    if (k === 'marcar') { a.set(vazio(a.get()) ? 'OK' : ''); return atualizarEdicao([a.id]); }
    if (k === 'limpar') { ed.texto = ''; a.set(''); ed.substituir = false; return atualizarEdicao([a.id]); }

    let s = ed.substituir && (/^[\d,.]$/.test(k) || k.length === 1) && k !== '+' && k !== '-' ? '' : ed.texto;
    ed.substituir = false;

    if (a.digitos) {
      // código de conexão: sequência de números, com zero na frente (014204), nunca vira conta
      if (/^\d$/.test(k) && s.length < a.digitos) s += k;
      else if (k === 'apagar') s = s.slice(0, -1);
      ed.texto = s; a.set(s);
    } else if (a.type === 'num') {
      if (k === '+' || k === '-') {
        const base = vazio(a.get()) ? 0 : parseFloat(a.get());
        let n = base + (k === '+' ? passoDo(a) : -passoDo(a));
        if (n < 0 && !a.negativo) n = 0;
        s = n.toFixed(dec).replace('.', ',');
      } else if (/^\d$/.test(k)) {
        const partes = s.split(',');
        if (partes[1] != null && partes[1].length >= dec) return atualizarEdicao([a.id]);
        if (s.replace(',', '').length >= 7) return atualizarEdicao([a.id]);
        s = s === '0' ? k : s + k;
      } else if ((k === ',' || k === '.') && dec > 0) {
        if (!s.includes(',')) s = (s || '0') + ',';
      } else if (k === 'apagar') s = s.slice(0, -1);
      ed.texto = s;
      a.set(s.replace(',', '.').replace(/\.$/, ''));
    } else if (a.type === 'time') {
      if (k === '+' || k === '-' || k === 'agora') {
        let min;
        if (k === 'agora') { const d = new Date(); min = d.getHours() * 60 + d.getMinutes(); }
        else {
          const atual = vazio(a.get()) ? horaAgora() : a.get();
          const [h, m] = atual.split(':').map(Number);
          min = (h * 60 + m + (k === '+' ? 1 : -1) + 1440) % 1440;
        }
        s = pad2(Math.floor(min / 60)) + pad2(min % 60);
      } else if (/^\d$/.test(k)) { if (s.length < 4) s += k; }
      else if (k === 'apagar') s = s.slice(0, -1);
      ed.texto = s;
      if (s.length === 4 && Number(s.slice(0, 2)) < 24 && Number(s.slice(2)) < 60) a.set(`${s.slice(0, 2)}:${s.slice(2)}`);
      else if (!s.length) a.set('');
    } else if (a.type === 'ip') {
      if (/^\d$/.test(k) || k === '.' || k === ',') { if (s.length < 15) s += k === ',' ? '.' : k; }
      else if (k === 'apagar') s = s.slice(0, -1);
      ed.texto = s; a.set(s);
    } else if (a.type === 'text') {
      if (k === 'apagar') s = s.slice(0, -1);
      else if (k === 'espaco') s += ' ';
      else if (k.length === 1 && s.length < (a.max || 80)) s += k.toUpperCase();
      ed.texto = s; a.set(s);
    }
    atualizarEdicao([a.id]);
  }

  function mostrarNoVisor(a) {
    const s = ed.texto;
    if (a.type === 'time') { const d = s.padEnd(4, '-'); return `${d.slice(0, 2)}:${d.slice(2, 4)}`; }
    if (!s) return a.type === 'text' || a.type === 'ip' ? '<span class="cursor"></span>' : '<span class="apagado">0</span>';
    const txt = esc(s);
    if (ed.substituir && a.type !== 'text') return `<span class="marcado">${txt}</span>`;
    return txt + (a.type === 'text' || a.type === 'ip' ? '<span class="cursor"></span>' : '');
  }

  function htmlPainel() {
    const a = alvoAtual();
    if (!a || ed.oculto) return '';
    const i = alvos.indexOf(a);
    const ultimo = i === alvos.length - 1;
    const limparNoCab = !ed.letras && (a.type === 'ip' || (a.type === 'num' && (a.dec || 0) > 0));
    const avisoCab = a.type === 'num' || a.type === 'time' ? (a.type === 'time' && ed.texto.length === 4 && !(Number(ed.texto.slice(0, 2)) < 24 && Number(ed.texto.slice(2)) < 60) ? [{ nivel: 'alerta', curto: 'Hora inválida' }] : avisosDe(a, a.get())) : [];
    const cab = `<div class="painel-cab"><div><small>Anotando agora</small><b class="${avisoCab.some((x) => x.nivel === 'alerta') ? 'fora' : avisoCab.length ? 'atencao' : ''}">${esc(a.label)}${avisoCab.length ? `<em class="tag-aviso">${ico('alerta')}${esc(avisoCab[0].curto)}</em>` : ''}</b><span>${esc(contextoEdicao)}</span></div>
      <div class="painel-cab-botoes">${limparNoCab ? '<button class="btn" data-ed="limpar">Limpar</button>' : ''}<button class="btn" data-ed="ocultar">${ico('teclado')} Ocultar</button></div></div>`;
    const nav = `<div class="painel-nav"><button class="btn" data-ed="ant" ${i === 0 ? 'disabled' : ''}>${ico('voltar')} Anterior</button>
      <button class="btn primario" data-ed="prox">${ultimo ? `${ico('certo')} Concluir` : `Próximo ${ico('seta')}`}</button></div>`;

    if (a.type === 'choice') {
      return `${cab}<p class="dica-painel">${esc(a.dica || 'Toque na opção certa')}</p>
        <div class="opcoes-painel">${a.opcoes.map((op, j) => `<button data-ed="o:${j}" class="${a.get() === op ? 'sel' : ''}">${a.get() === op ? ico('certo') : ''}${esc(op)}</button>`).join('')}
        ${!a.opcoes.length ? '<p class="dica-painel">Nenhuma opção cadastrada. O escritório cadastra no tablet chefe.</p>' : ''}</div>${nav}`;
    }
    if (a.type === 'check') {
      const marcado = !vazio(a.get());
      return `${cab}<div class="opcoes-painel"><button data-ed="marcar" class="${marcado ? 'sel' : ''}">${marcado ? `${ico('certo')} Marcado OK` : 'Toque para marcar OK'}</button>
        ${marcado ? '<p class="dica-painel">Toque de novo para desmarcar.</p>' : ''}</div>${nav}`;
    }

    const horaInvalida = a.type === 'time' && ed.texto.length === 4 && !(Number(ed.texto.slice(0, 2)) < 24 && Number(ed.texto.slice(2)) < 60);
    const avisos = horaInvalida ? [{ nivel: 'alerta', texto: 'Hora que não existe. Use de 00:00 a 23:59.', curto: 'Hora inválida' }] : avisosDe(a, a.get());
    const nivel = horaInvalida ? 'fora' : nivelDe(a, a.get());
    const maisMenos = (a.type === 'num' || a.type === 'time') && !a.semMaisMenos;
    const unidade = a.unidade || (a.getUnidade ? a.getUnidade() : '');
    let teclas;
    if (ed.letras) {
      const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      teclas = `<div class="teclas letras">${letras.map((l) => `<button data-ed="${l}">${l}</button>`).join('')}
        <button data-ed="espaco" class="span2 menor">Espaço</button><button data-ed="abc" class="escura">123</button><button data-ed="apagar" aria-label="Apagar">${ico('apagar')}</button></div>`;
    } else {
      const sep = a.type === 'ip' ? '.' : ',';
      const temSep = a.type === 'ip' || (a.type === 'num' && (a.dec || 0) > 0);
      teclas = `<div class="teclas">${[7, 8, 9, 4, 5, 6, 1, 2, 3].map((n) => `<button data-ed="${n}">${n}</button>`).join('')}
        ${temSep ? `<button data-ed="${sep}">${sep}</button>` : '<button data-ed="limpar" class="menor">Limpar</button>'}
        <button data-ed="0">0</button><button data-ed="apagar" aria-label="Apagar">${ico('apagar')}</button>
        ${a.type === 'text' ? '<button data-ed="abc" class="escura span2">ABC letras</button><button data-ed="limpar" class="menor">Limpar</button>' : ''}
</div>`;
    }
    return `${cab}
      <div class="valor-linha ${maisMenos ? '' : 'sem-mm'}">
        ${maisMenos ? '<button class="mm" data-ed="-" aria-label="Diminuir">−</button>' : ''}
        <div class="visor ${nivel} ${a.type === 'text' ? 'texto' : ''} ${ed.texto.length > 4 && a.type === 'num' ? 'longo' : ''}">${mostrarNoVisor(a)}${unidade ? `<small>${esc(unidade)}</small>` : ''}</div>
        ${maisMenos ? '<button class="mm" data-ed="+" aria-label="Aumentar">+</button>' : ''}
      </div>
      ${a.dica ? `<p class="dica-painel">${esc(a.dica)}</p>` : ''}
      ${a.sugestao ? `<p class="dica-painel">${esc(a.sugestao)}</p>` : ''}
      ${a.type === 'time' ? `<div class="fichas"><button class="largo" data-ed="agora">${ico('relogio')} Agora, ${horaAgora()}</button></div>` : ''}
      ${a.unidades && a.unidades.length > 1 ? `<div class="fichas">${a.unidades.map((u) => `<button data-ed="u:${u}" class="${u === unidade ? 'sel' : ''}">${u}</button>`).join('')}</div>` : ''}
      ${teclas}${nav}`;
  }

  function quadro(a, curto) {
    const v = a.get();
    const ativo = a.id === ed.alvoId && !ed.oculto;
    const nivel = nivelDe(a, v);
    const avisos = avisosDe(a, v);
    const cls = ['campo', vazio(v) ? '' : 'preenchido', nivel, ativo ? 'ativo' : '', a.largo ? 'largo' : ''].join(' ');
    const u = a.unidade || (a.getUnidade ? a.getUnidade() : '');
    let mostra;
    if (vazio(v)) mostra = `<span class="val vazio">${esc(a.vazioTexto || (a.type === 'check' ? 'Toque para marcar' : a.type === 'choice' ? 'Toque para escolher' : 'Toque para anotar'))}</span>`;
    else if (a.type === 'check') mostra = `<span class="val marca">${ico('certo')} ${esc(v)}</span>`;
    else if (a.type === 'text' || a.type === 'choice') mostra = `<span class="val texto">${esc(v)}</span>`;
    // o aviso (pH baixo, Brix alto) fica do lado do número, curto: a caixa não muda de tamanho
    else mostra = `<span class="val">${esc(fmtCampo(a, v))}${u ? `<small>${esc(u)}</small>` : ''}${avisos.length ? `<em class="tag-aviso">${esc(avisos[0].curto)}</em>` : ''}</span>`;
    const rotulo = curto && a.labelCurto ? a.labelCurto : a.label;
    return `<button class="${cls}" data-quadro="${esc(a.id)}"><span class="rot">${esc(rotulo)}${avisos.length ? ` ${ico('alerta')}` : ''}</span>${mostra}</button>`;
  }
  const htmlQuadros = (lista, curto) => lista.map((a) => quadro(a, curto)).join('');

  /** Deixa a linha escolhida (dorna ou hora) no meio do seletor, inteira à vista. */
  let rolarDepois = false; // pedido para o próximo quadro (junto com o ajuste da letra)
  function rolarSeletor() {
    const alvo = app.querySelector('.seletor [data-rolar-para]');
    if (alvo) alvo.parentElement.scrollLeft = alvo.offsetLeft - alvo.parentElement.clientWidth / 2 + alvo.clientWidth / 2;
    const aba = app.querySelector('.abas button.sel');
    if (aba) aba.parentElement.scrollLeft = aba.offsetLeft - aba.parentElement.clientWidth / 2 + aba.clientWidth / 2;
  }
  /** Atualiza só os quadros e o teclado, sem redesenhar a tela toda.
      Com "mexidos" (ids dos quadros que mudaram), refaz só os blocos deles: ao teclar, o resto da tela fica parado. */
  function atualizarEdicao(mexidos) {
    const box = document.querySelector('.edicao');
    if (!box) return;
    // o teclado abriu ou fechou (ou trocou para letras): a coluna muda de largura, então tudo é refeito
    const trocouPainel = box.classList.contains('com-painel') !== painelVisivel() || box.classList.contains('modo-letras') !== (painelVisivel() && ed.letras);
    // e a linha escolhida volta para o meio do seletor
    if (box.classList.contains('com-painel') !== painelVisivel()) rolarDepois = true;
    box.classList.toggle('com-painel', painelVisivel());
    box.classList.toggle('modo-letras', painelVisivel() && ed.letras);
    const tudo = trocouPainel || !mexidos;
    const refeitos = [];
    document.querySelectorAll('[data-grupo]').forEach((g) => {
      const ids = g.dataset.grupo.split(',');
      if (!tudo && !ids.some((id) => mexidos.includes(id))) return;
      g.innerHTML = htmlQuadros(alvos.filter((a) => ids.includes(a.id)), g.classList.contains('par'));
      refeitos.push(g);
    });
    const p = document.getElementById('painel');
    if (p) { p.innerHTML = htmlPainel(); refeitos.push(p); }
    const ativo = document.querySelector('.campo.ativo');
    // depois que o teclado abriu e a tela se ajeitou
    if (ativo && ed.alvoId !== ed.rolouPara) requestAnimationFrame(() => { const el = document.querySelector('.campo.ativo'); if (el) el.scrollIntoView({ block: 'nearest' }); });
    ed.rolouPara = ativo ? ed.alvoId : null;
    agendarCaber(tudo ? null : refeitos);
  }
  function grupoQuadros(lista) { return `<div class="campos" data-grupo="${lista.map((a) => esc(a.id)).join(',')}">${htmlQuadros(lista)}</div>`; }

  /** Quadros em blocos: o que anda junto fica junto (hora início e fim, Brix e BHX...). */
  function blocosDeQuadros(grupos, lista) {
    if (!grupos) return grupoQuadros(lista);
    const emGrupo = new Set(grupos.flatMap((g) => g.campos));
    const soltos = lista.filter((a) => !emGrupo.has(a.id));
    const blocos = grupos.map((g) => {
      const doGrupo = g.campos.map((id) => lista.find((a) => a.id === id)).filter(Boolean);
      if (!doGrupo.length) return '';
      return `<section class="grupo"><h3>${esc(g.titulo)}</h3>
        <div class="par n${Math.min(doGrupo.length, 3)}" data-grupo="${doGrupo.map((a) => esc(a.id)).join(',')}">${htmlQuadros(doGrupo, true)}</div></section>`;
    }).join('');
    return `<div class="grupos">${blocos}</div>${soltos.length ? grupoQuadros(soltos) : ''}`;
  }
  function telaEdicao(conteudo, rodape, fixoTopo) {
    // as abas e o seletor ficam presos no alto; só os quadros rolam, se precisar
    return `<div class="edicao ${painelVisivel() ? 'com-painel' : ''} ${painelVisivel() && ed.letras ? 'modo-letras' : ''}">
      <div class="coluna">${fixoTopo ? `<div class="barra-trabalho">${fixoTopo}</div>` : ''}<main>${conteudo}</main>${rodape ? `<div class="rodape">${rodape}</div>` : ''}</div>
      <aside class="painel" id="painel">${htmlPainel()}</aside></div>`;
  }

  /* =========================================================
   * Navegação (o botão voltar do Android fica dentro do app)
   * ========================================================= */
  let pilha = [];
  let rascunho = null;
  const rascunhoSujo = () => !!rascunho && (JSON.stringify(rascunho.valores) !== JSON.stringify(rascunho.original) || JSON.stringify(rascunho.extras) !== rascunho.originalExtras);
  const view = () => pilha[pilha.length - 1];
  // enquanto a pessoa arrasta ou rola (tabela do monitoramento, lista), a tela não é redesenhada: senão a rolagem pula
  let dedosNaTela = 0, ultimoToque = 0, ultimaRolagem = 0, redesenharDepois = false;
  document.addEventListener('pointerdown', () => { dedosNaTela += 1; ultimoToque = Date.now(); }, { passive: true, capture: true });
  ['pointerup', 'pointercancel'].forEach((ev) => document.addEventListener(ev, () => { dedosNaTela = Math.max(0, dedosNaTela - 1); ultimaRolagem = Date.now(); }, { passive: true, capture: true }));
  document.addEventListener('scroll', () => { ultimaRolagem = Date.now(); }, { passive: true, capture: true });
  const mexendoNaTela = () => {
    // o Android às vezes não avisa que o dedo saiu: depois de 20 segundos parado, a tela volta a se atualizar
    if (dedosNaTela > 0 && Date.now() - ultimoToque > 20000) dedosNaTela = 0;
    return dedosNaTela > 0 || Date.now() - ultimaRolagem < 1500;
  };
  const podeRedesenhar = () => !modalAberto() && !rascunhoSujo() && !painelVisivel() && !mexendoNaTela();

  function ir(v, substituir = false) {
    if (rascunhoSujo()) salvarRascunho(true);
    if (substituir) pilha[pilha.length - 1] = v; else pilha.push(v);
    rascunho = null; ed.alvoId = null;
    render(true);
  }
  function voltar() {
    if (modalAberto()) return modalFixo ? undefined : fecharModalAtual();
    if (painelVisivel()) { ed.oculto = true; return atualizarEdicao(); }
    if (rascunhoSujo()) salvarRascunho(true);
    if (pilha.length > 1) { pilha.pop(); rascunho = null; ed.alvoId = null; render(true); }
  }
  if (!DEMO_IMG) {
    history.pushState({ app: 1 }, '');
    window.addEventListener('popstate', () => { history.pushState({ app: 1 }, ''); voltar(); });
  }
  function telaInicial() {
    if (!cfg.chave && !cfg.demo) return { tela: 'conectar' };
    if (!cfg.papel) return { tela: 'configurar' };
    if (ehCentral()) return { tela: 'central', data: dataProducao() };
    return { tela: 'inicio' };
  }

  /* =========================================================
   * Partes comuns
   * ========================================================= */
  const topo = (titulo, subtitulo, podeVoltar, atalhos) => cabecalho(titulo, subtitulo, podeVoltar, atalhos) + faixa();
  /** Barra de cima. Leva título, atalhos, relógio e, no canto, os ajustes e o botão claro/escuro. */
  function cabecalho(titulo, subtitulo, podeVoltar, atalhos) {
    const escuro = cfg.tema === 'escuro';
    const configurado = cfg.papel && (cfg.chave || cfg.demo);
    return `<header class="topo">
        ${podeVoltar ? `<button class="voltar" data-a="voltar">${ico('voltar')} Voltar</button>` : '<img class="logo" src="icons/logo.png" alt="Ubirálcool">'}
        <div class="titulo ${String(titulo).length > 17 ? 'longo' : ''}"><div class="titulo-linha"><b>${esc(titulo)}</b><em class="turno-topo" id="turno-topo">${esc(turnoAtual().nome)}</em></div>${subtitulo ? `<span id="subtitulo-topo">${esc(subtitulo)}</span>` : ''}</div>
        ${atalhos ? `<div class="atalhos">${atalhos}</div>` : ''}
        <div class="relogio"><b id="relogio">${horaAgora()}</b></div>
        ${configurado && (view() || {}).tela !== 'admin' ? `<button class="tema" data-a="admin" aria-label="Ajustes do aparelho">${ico('ajustes')}<span>Ajustes</span></button>` : ''}
        <button class="tema" data-a="tema" aria-label="${escuro ? 'Mudar para tela clara' : 'Mudar para tela escura'}">${ico(escuro ? 'sol' : 'lua')}<span>${escuro ? 'Claro' : 'Escuro'}</span></button>
      </header>`;
  }
  function atalhosOperador() {
    const op = operadorAtual();
    const v = view();
    return `${!ehCentral() ? `<button class="atalho ${op ? '' : 'alerta'}" data-a="trocar-operador">${ico('pessoa')}<span>${esc(op || 'Seu nome')}</span></button>` : ''}
      ${v && v.tela === 'prancheta' ? `<button class="atalho ${v.monitor ? 'sel' : ''}" data-a="monitor">${ico('planilha')}<span>${v.monitor ? 'Anotar' : 'Monitorar'}</span></button>` : ''}`;
  }
  function aplicarTema() {
    document.documentElement.dataset.tema = cfg.tema === 'escuro' ? 'escuro' : 'claro';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', cfg.tema === 'escuro' ? '#0d0f10' : '#2e3431');
  }
  function faixa() {
    const op = operadorAtual();
    const configurado = cfg.papel && (cfg.chave || cfg.demo);
    if (!configurado || ehCentral()) return '';
    const escolhendo = (view() || {}).tela === 'operador'; // já está na tela de escolher o nome: não repete o botão
    return `<div class="faixa">
        <span class="data">Folha de ${fmtData(dataProducao())}</span>
        <span id="conexao" class="conexao ${classeConexao()}"><i></i>${esc(textoConexao())}</span>
        <span class="espaco"></span>
        ${escolhendo ? '' : `<button class="chip ${op ? '' : 'alerta'}" data-a="trocar-operador">${ico('pessoa')} ${op ? `Operador: <b>${esc(op)}</b>` : 'Toque aqui e escolha seu nome'}</button>`}
      </div>`;
  }

  const app = document.getElementById('app');
  let ultimaChaveTela = '';
  /** Redesenha a tela. Mantém a posição da rolagem quando continua na mesma tela. */
  function render(trocouDeTela) {
    let v = view();
    if (foraDaRede() && v.tela !== 'bloqueado') v = { tela: 'bloqueado' };
    const telas = {
      conectar: telaConectar, preparando: telaPreparando, bloqueado: telaBloqueado, configurar: telaConfigurar, operador: telaOperador,
      inicio: telaInicio, prancheta: telaPrancheta, central: telaCentral, relatorios: telaRelatorios, leitura: telaLeitura, config: telaConfig, admin: telaAdmin, avisos: telaAvisos,
    };
    const chaveTela = JSON.stringify([v.tela, v.pid, v.data, v.monitor]);
    const outraTela = chaveTela !== ultimaChaveTela;
    const mesmaTela = !trocouDeTela && !outraTela;
    // a atualização que vem da central (a cada 5 s) não pode mudar onde a pessoa está: guarda e volta cada rolagem
    const ROLAM = '.abas, .seletor, .tabela-wrap, .cabecalho-form, .chips-escolha, .lista-avisos, main';
    const rolagens = mesmaTela ? [...app.querySelectorAll(ROLAM)].map((el) => [el.scrollLeft, el.scrollTop]) : [];
    alvos = [];
    app.innerHTML = (telas[v.tela] || telaInicio)(v);
    ultimaChaveTela = chaveTela;
    if (mesmaTela) app.querySelectorAll(ROLAM).forEach((el, i) => { if (rolagens[i]) { el.scrollLeft = rolagens[i][0]; el.scrollTop = rolagens[i][1]; } });
    else rolarDepois = true; // abriu a tela ou trocou a linha: a escolhida vai para o meio
    if (v.tela === 'central') desenharQr();
    if (v.tela === 'conectar' && NO_APK && pluginCentral && !procura.feita && !conexaoForm.endereco) setTimeout(procurarCentral, 300);
    if (v.tela === 'relatorios' && !v.carregado) carregarRelatorios();
    if (v.data) buscarDia(v.data);
    if (trocouDeTela) {
      app.classList.remove('troca', 'troca-linha'); void app.offsetWidth;
      app.classList.add(outraTela ? 'troca' : 'troca-linha');
    }
    agendarCaber();
    requestAnimationFrame(caberFolhas); // folha inteira na tela (monitoramento)
  }

  /* =========================================================
   * Tela: conectar na central da usina
   * ========================================================= */
  const conexaoForm = { endereco: NO_APK ? '' : location.hostname, codigo: '' };
  const procura = { ativa: false, feita: false, texto: '' };
  /** Varre o Wi-Fi (mesma faixa de endereço deste aparelho) atrás do servidor das pranchetas. */
  async function varrerRede(aceita, aoProgresso) {
    const st = await pluginCentral.estado();
    const meus = (st.enderecos || []).map((u) => u.replace(/^https?:\/\//, '').split(':')[0]).filter((ip) => /^(192\.168|10\.|172\.)/.test(ip));
    const testar = async (ip) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1800);
      try {
        const r = await fetch(`http://${ip}:${C.portaCentral}/api/ping`, { signal: ctrl.signal, cache: 'no-store' });
        const d = await r.json();
        return d && d.app === 'pranchetas' && (await aceita(ip)) ? ip : '';
      } catch (e) { return ''; } finally { clearTimeout(t); }
    };
    for (const meu of meus) {
      const base = meu.split('.').slice(0, 3).join('.');
      const lista = [];
      for (let i = 1; i < 255; i++) if (`${base}.${i}` !== meu) lista.push(`${base}.${i}`);
      for (let i = 0; i < lista.length; i += 48) {
        if (aoProgresso && aoProgresso(Math.min(100, Math.round(((i + 48) / lista.length) * 100))) === false) return '';
        const achou = (await Promise.all(lista.slice(i, i + 48).map(testar))).find(Boolean);
        if (achou) return achou;
      }
    }
    return '';
  }
  /** Procura sozinho o tablet chefe no Wi-Fi, para a pessoa só digitar o código. */
  async function procurarCentral() {
    if (!NO_APK || !pluginCentral || procura.ativa) return;
    procura.feita = true;
    procura.texto = 'O Android pode perguntar sobre "dispositivos por perto": toque em Permitir.';
    render();
    if (!(await garantirRedeLocal(true))) {
      procura.texto = 'O Android está bloqueando a rede local. Libere "Dispositivos por perto" nos ajustes e toque em Procurar sozinho.';
      return render();
    }
    procura.ativa = true; procura.texto = 'Procurando o tablet chefe no Wi-Fi...';
    render();
    let achou = '';
    try {
      achou = await varrerRede(async () => true, (pct) => {
        if (view().tela !== 'conectar') return false;
        procura.texto = `Procurando o tablet chefe no Wi-Fi... ${pct}%`;
        const t = app.querySelector('.procura-central span');
        if (t) t.textContent = procura.texto;
        return true;
      });
    } catch (e) { /* segue para a mensagem */ }
    procura.ativa = false;
    if (achou) {
      conexaoForm.endereco = achou;
      procura.texto = `Tablet chefe encontrado: ${achou}. Agora digite o código.`;
      ed.alvoId = 'codigo';
    } else {
      procura.texto = 'Não achei o tablet chefe. Confira o Wi-Fi ou digite o endereço que aparece no painel dele.';
    }
    if (view().tela === 'conectar') render();
  }
  /** O endereço do tablet chefe mudou (roteador reiniciou)? Procura de novo o servidor com a mesma chave. */
  async function reencontrarCentral() {
    if (!NO_APK || !pluginCentral || centralNoTablet() || !cfg.chave || procura.ativa) return;
    if (!(await garantirRedeLocal(false))) return;
    procura.ativa = true;
    try {
      const achou = await varrerRede(async (ip) => {
        // só a central deste aparelho abre o pedido embaralhado com a chave dele
        try { return (await pedirCifrado(`http://${ip}:${C.portaCentral}/`, 'api/status', {}, 3000)).ok; } catch (e) { return false; }
      });
      if (achou) {
        cfg.central = `http://${achou}:${C.portaCentral}`; salvarCfg();
        toast('Tablet chefe encontrado de novo');
        procura.ativa = false;
        sincronizar();
      }
    } catch (e) { /* tenta de novo mais tarde */ }
    procura.ativa = false;
  }
  function telaConectar() {
    alvos = [];
    if (NO_APK) alvos.push({ id: 'endereco', label: 'Endereço da central', type: 'ip', get: () => conexaoForm.endereco, set: (x) => { conexaoForm.endereco = x; } });
    alvos.push({ id: 'codigo', label: 'Código (6 números)', type: 'num', dec: 0, digitos: 6, semMaisMenos: true, get: () => conexaoForm.codigo, set: (x) => { conexaoForm.codigo = x; } });
    contextoEdicao = 'conectar este aparelho';
    const conteudo = `<div class="boas-vindas">
        <header><img src="icons/logo.png" alt="Ubirálcool"><div><h1>Conectar na rede da usina</h1>
        <p>O aplicativo só funciona dentro da rede da Ubirálcool. Peça ao escritório o ${NO_APK ? 'endereço e o ' : ''}código que aparece no tablet chefe.</p></div></header>
        ${grupoQuadros(alvos)}
        ${NO_APK && pluginCentral ? `<div class="procura-central ${procura.ativa ? 'ativa' : ''}">
          ${procura.ativa ? '<i class="giro"></i>' : ico(conexaoForm.endereco ? 'certo' : 'wifi')}
          <span>${esc(procura.texto || 'O endereço aparece no painel do tablet chefe, embaixo do QR code.')}</span>
          ${procura.ativa ? '' : `<button class="btn" data-a="procurar-central">${ico('wifi')} Procurar sozinho</button>`}
        </div>` : ''}
        <div class="linha-botoes" style="margin-top:22px">
          <button class="btn primario" data-a="conectar" style="min-width:300px">${ico('wifi')} Conectar</button>
          <button class="btn" data-a="modo-demo">Só demonstração, sem central</button>
        </div>
        ${pluginCentral ? `<div class="bloco destaque-chefe">
          <span class="escolha-ico">${ico('servidor')}</span>
          <div><b>Usar este aparelho como servidor da usina?</b><p>Ele guarda tudo e recebe os tablets dos setores (pastas ServidorUsina, RelatoriosUsina e BackupUsina). Depois você escolhe se ele também é o tablet chefe ou um setor. Nada que já está guardado é apagado.</p></div>
          <button class="btn primario" data-a="virar-central">Usar como servidor</button>
        </div>` : ''}
        <p class="autoria">Pranchetas Digitais ${VERSAO} · ${esc(AUTORIA)}</p>
      </div>`;
    return `${cabecalho('Pranchetas digitais', 'Primeiro acesso', false)}${telaEdicao(conteudo)}`;
  }
  async function conectar() {
    const endereco = NO_APK ? conexaoForm.endereco.trim() : '';
    if (NO_APK && !/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(endereco)) return toast('Endereço incompleto. Exemplo: 192.168.1.113', 'erro');
    if (!/^\d{6}$/.test(conexaoForm.codigo)) return toast('O código tem 6 números', 'erro');
    if (!(await garantirRedeLocal(true))) return;
    cfg.central = NO_APK ? `http://${endereco.includes(':') ? endereco : endereco + ':' + C.portaCentral}` : '';
    try {
      const r0 = await buscar('api/ping', {}, 5000);
      const info = await r0.json().catch(() => ({}));
      if (!info || info.app !== 'pranchetas') throw new Error('sem central');
      if (!info.cifra || !info.pub) return avisarCentralAntiga();
      // o código não vai aberto: vai uma prova dele, que só a central consegue conferir
      const { corpo, chavePar } = Cifra.pedidoDeConexao(info.pub, cfg.deviceId, conexaoForm.codigo);
      const r = await postJson('api/parear', corpo, 6000);
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) return toast(dados.erro === 'Código errado' ? 'Código errado. Confira no tablet chefe.' : (dados.erro || 'A central recusou a conexão'), 'erro');
      const { chave } = await Cifra.abrirConexao(chavePar, cfg.deviceId, dados.cifrado);
      cfg.chave = chave; cfg.cifra = 1; cfg.demo = false; cfg.ultimoContato = Date.now(); cfg.novaConexao = true; salvarCfg();
      toast('Aparelho conectado na rede da usina');
      ed.alvoId = null; pilha = [telaInicial()]; render(true); sincronizar();
    } catch (e) {
      toast('Não achei a central. Confira se está no Wi-Fi da usina e se o endereço é o que aparece no tablet chefe.', 'erro');
    }
  }

  /* =========================================================
   * Tela: preparando o tablet chefe (servidor da usina)
   * ========================================================= */
  function telaPreparando(v) {
    const passos = v.passos || [];
    const terminou = v.fim;
    const erro = passos.some((p) => p.estado === 'erro');
    return `${cabecalho('Preparando o servidor', 'Servidor da usina neste aparelho', false)}
      <main><div class="preparo">
        <div class="preparo-cab">
          <span class="preparo-ico ${terminou ? (erro ? 'erro' : 'ok') : 'girando'}">${ico(terminou ? (erro ? 'alerta' : 'certo') : 'servidor')}</span>
          <div><h1>${terminou ? (erro ? 'Faltou um passo' : 'Tudo pronto') : 'Preparando o servidor da usina'}</h1>
          <p>${terminou ? (erro ? 'Resolva o item marcado e tente de novo.' : 'Os tablets já podem se conectar neste aparelho. Tudo que já estava guardado continua aqui.') : 'Não feche o aplicativo. Leva poucos segundos.'}</p></div>
          ${terminou ? `<div class="preparo-botoes">${erro
            ? `<button class="btn primario" data-a="virar-central">${ico('servidor')} Tentar de novo</button><button class="btn" data-a="voltar-conectar">Voltar</button>`
            : `<button class="btn primario" data-a="abrir-painel">${ico('seta')} Continuar</button>`}</div>` : ''}
        </div>
        <ol class="passos-preparo">${passos.map((p) => `<li class="${p.estado}">
          <span class="marca">${p.estado === 'ok' ? ico('certo') : p.estado === 'erro' ? ico('alerta') : p.estado === 'fazendo' ? '<i class="giro"></i>' : ''}</span>
          <div><b>${esc(p.texto)}</b>${p.detalhe ? `<small>${esc(p.detalhe)}</small>` : ''}</div></li>`).join('')}</ol>

      </div></main>`;
  }
  /** Executa de verdade cada passo e mostra o resultado na tela. */
  async function prepararTabletChefe() {
    const passos = [];
    pilha = [{ tela: 'preparando', passos }];
    const passo = async (texto, acao) => {
      const item = { texto, estado: 'fazendo', detalhe: '' };
      passos.push(item); render(true);
      const inicio = Date.now();
      try {
        item.detalhe = (await acao()) || '';
        item.estado = 'ok';
      } catch (e) {
        item.estado = 'erro'; item.detalhe = e && e.message ? e.message : String(e);
      }
      await new Promise((r) => setTimeout(r, Math.max(0, 450 - (Date.now() - inicio)))); // dá tempo de ler
      render(true);
      return item.estado === 'ok';
    };
    // liga o servidor neste aparelho; a função dele (tablet chefe ou setor) continua a mesma e nenhum dado é apagado
    cfg.servidor = true; salvarCfg();
    let ok = true;
    let estado = null;
    if (pluginCentral) {
      ok = ok && await passo('Permissão para os tablets acharem este aparelho no Wi-Fi', async () => {
        if (!(await garantirRedeLocal(true))) throw new Error('Libere "Dispositivos por perto" (ou "Rede local") nos ajustes do Android e toque em Tentar de novo.');
        return 'Rede local liberada';
      });
      ok = ok && await passo('Criando as pastas ServidorUsina, RelatoriosUsina e BackupUsina', async () => {
        const r = await pluginCentral.criarPastas();
        return r.documentos ? `No aparelho e em ${r.documentos}` : `Em ${r.pasta}`;
      });
      ok = ok && await passo(`Ligando o servidor na rede, porta ${C.portaCentral}`, async () => {
        const r = await pluginCentral.iniciar({ porta: C.portaCentral });
        cfg.central = `http://127.0.0.1:${C.portaCentral}`; usarChaveDaRede(r.chave); cfg.demo = false; cfg.ultimoContato = Date.now(); salvarCfg();
        return 'Servidor ligado';
      });
      ok = ok && await passo('Mantendo o servidor ligado com a tela apagada', async () => {
        const r = await pluginCentral.manterLigado({ perguntar: true });
        return r && r.bateriaLivre === false ? 'Toque em Permitir na pergunta sobre a bateria' : 'Aparece um aviso fixo na barra de notificações';
      });
      ok = ok && await passo('Procurando o endereço deste tablet no Wi-Fi', async () => {
        estado = await pluginCentral.estado();
        if (!estado.enderecos || !estado.enderecos.length) throw new Error('Este tablet não está em nenhum Wi-Fi. Conecte no Wi-Fi da usina.');
        return estado.enderecos.join(', ');
      });
    } else {
      ok = ok && await passo('Procurando o servidor da usina', async () => {
        const r = await buscar('api/ping', {}, 5000);
        if (!r.ok) throw new Error('A central não respondeu');
        return 'Servidor encontrado';
      });
    }
    ok = ok && await passo('Testando o servidor', async () => {
      const r = await buscar('api/status', {}, 5000);
      if (!r.ok) throw new Error('O servidor não respondeu. Tente de novo.');
      estado = await r.json();
      sync.status = estado; sync.statusJson = JSON.stringify(estado);
      return estado.pastas ? `Relatórios em ${estado.pastas.relatorios}` : 'Respondendo';
    });
    ok = ok && await passo('Gerando o código de conexão dos tablets', async () => `Código ${String(estado.codigo).replace(/(\d{3})(\d{3})/, '$1 $2')}`);
    view().fim = true;
    render(true);
    if (ok) { sync.modo = 'online'; sincronizar(); }
  }

  function telaBloqueado() {
    return `${topo('Pranchetas digitais', 'Fora da rede da usina', false)}
      <main><div class="tela-aviso"><div class="grande-ico">${ico('wifi')}</div>
        <h1>Conecte no Wi-Fi da usina</h1>
        <p>Este aparelho está há mais de ${C.horasForaDaRede} horas sem falar com a central. As anotações guardadas continuam salvas e serão enviadas quando voltar para a rede.</p>
        <button class="btn primario largo" data-a="tentar" style="margin-top:20px">${ico('wifi')} Tentar de novo</button>
      </div></main>`;
  }

  /* =========================================================
   * Tela: onde este aparelho vai ficar
   * ========================================================= */
  function cartaoPapel(id, icone, nome, detalhe, atual) {
    return `<button class="papel-cartao ${atual ? 'sel' : ''}" data-a="papel" data-id="${id}">
      <span class="escolha-ico">${ico(icone)}</span><b>${esc(nome)}</b><small>${esc(detalhe)}</small>${atual ? `<em>${ico('certo')} Este aparelho</em>` : ''}</button>`;
  }
  const nomeDoChefe = () => (pluginCentral ? 'Tablet chefe' : 'Painel do escritório');
  const detalheDoChefe = () => 'Acompanha todos os setores, manda avisos e relatórios';
  function gradePapeis() {
    return `<div class="papeis">
      ${todosSetores.map((s) => cartaoPapel(s.id, s.icone, s.nome, pranchetasDo(s.id).map((pid) => prancheta(pid).nome).join(', '), cfg.papel === s.id)).join('')}
      ${cartaoPapel('central', 'escritorio', nomeDoChefe(), detalheDoChefe(), ehCentral())}
    </div>`;
  }
  function telaConfigurar() {
    return `${topo('Pranchetas digitais', 'Configuração do aparelho', false)}
      <main><div class="boas-vindas">
        <header><img src="icons/logo.png" alt="Ubirálcool"><div><h1>Onde este aparelho vai ficar?</h1><p>Toque no setor. Depois só o encarregado muda, com a senha.</p></div></header>
        ${gradePapeis()}
      </div></main>`;
  }

  function telaOperador(v) {
    const s = setorPorId(cfg.papel);
    const t = turnoAtual();
    return `${topo('Quem está trabalhando?', s.nome, !!operadorAtual())}
      <main>
        <h2>${esc(t.nome)}, das ${faixaTurno(t)}</h2>
        ${v && v.travado
          ? `<p class="sub"><span class="aviso atencao">${ico('alerta')} O tablet ficou ${Math.round(C.minutosSemMexer)} minutos sem ninguém mexer. Toque no seu nome e digite a senha para continuar. O que já estava anotado foi salvo.</span></p>`
          : '<p class="sub">Toque no seu nome. Ele vai como responsável em tudo que você anotar neste turno.</p>'}
        <div class="opcoes nomes">${operadoresDo(cfg.papel).map((o) => `<button data-a="escolher-operador" data-nome="${esc(o.nome)}" class="${o.nome === operadorAtual() ? 'sel' : ''}">${ico('pessoa')}<span class="nome-op"><b>${esc(o.nome)}</b>${o.senha ? '' : '<small class="sem-senha">sem senha</small>'}</span></button>`).join('')}</div>
        <p class="sub" style="margin-top:24px">Cada um entra com a sua senha de 4 números. Esqueceu? Chame o encarregado. Nome novo, também é com ele.</p>
      </main>`;
  }

  /* =========================================================
   * Tela inicial do setor
   * ========================================================= */
  function resumoPrancheta(pid, data) {
    const p = prancheta(pid);
    const hoje = data === dataProducao();
    if (p.tipo === 'dornas') {
      const linhas = dornasDoDia(data, pid);
      if (!linhas.length) return { texto: hoje ? 'Nada anotado hoje' : 'Nada anotado neste dia' };
      if (p.envio && hoje) {
        const indo = linhas.find((r) => etapaDaDorna(p, r) === 'enviando');
        const enchendo = linhas.filter((r) => etapaDaDorna(p, r) === 'enchendo').map((r) => r.chave);
        const partes = [];
        if (indo) partes.push(`Nº ${indo.chave} enviando desde ${indo.valores[p.envio.inicio]}`);
        if (enchendo.length) partes.push(`Nº ${listaE(enchendo)} enchendo`);
        // dorna enchendo ou indo para cima é o trabalho normal, não é pendência
        if (partes.length) return { texto: partes.join('. ') + '.', estado: 'andamento' };
      }
      return { texto: `${contar(linhas.length, 'dorna anotada', 'dornas anotadas')}. Última: Nº ${linhas[linhas.length - 1].chave}`, estado: 'feito' };
    }
    if (p.tipo === 'juntas') {
      const conferir = new Set(p.partes.flatMap((pt) => linhasDeHora(listar(data, pt.prancheta)).filter((r) => r.conferir).map((r) => Number(r.chave))));
      if (conferir.size) return { texto: `Conferir: ${nomesDasHoras(conferir)}`, estado: 'pendente' };
      const horasAnotadas = new Set(p.partes.flatMap((pt) => linhasDeHora(listar(data, pt.prancheta)).filter((r) => !vazio(r.valores.qtd)).map((r) => Number(r.chave))));
      const horasDasDornas = new Set(p.partes.flatMap((pt) => listar(data, pt.sugestao.prancheta).map((r) => horaDoTexto(r.valores[pt.sugestao.hora])).filter((h) => h != null)));
      const faltam = [...horasDasDornas].filter((h) => !horasAnotadas.has(h));
      if (faltam.length && hoje) return { texto: `Falta anotar das ${faltam.map((h) => pad2(h) + 'h').join(', ')}`, estado: 'pendente' };
      if (!horasAnotadas.size) return { texto: hoje ? 'Nada adicionado hoje' : 'Nada adicionado neste dia' };
      return { texto: contar(horasAnotadas.size, 'hora anotada', 'horas anotadas'), estado: 'feito' };
    }
    if (p.tipo === 'insumo') {
      const linhas = linhasDeHora(listar(data, pid)).filter((r) => !vazio(r.valores.qtd));
      if (!linhas.length) return { texto: hoje ? 'Nada adicionado hoje' : 'Nada adicionado neste dia' };
      return { texto: `${contar(linhas.length, 'adição', 'adições')}. Total: ${totalInsumo(linhas)}`, estado: 'feito' };
    }
    const feitas = linhasDeHora(listar(data, pid)).length;
    const h = new Date().getHours();
    // setor que ainda não começou o dia não conta como pendência (antes aparecia "falta a leitura" em setor parado)
    if (!feitas) return { texto: hoje ? 'Nenhuma leitura hoje' : 'Nenhuma leitura neste dia' };
    if (hoje && !pegar(data, pid, h)) return { texto: `Falta a leitura das ${rotuloHora(h)}. Feitas: ${feitas} de 24`, estado: 'pendente' };
    return { texto: `${feitas} de 24 leituras feitas`, estado: 'feito' };
  }
  const iconeDaPrancheta = (pid) => { const p = prancheta(pid); return p.tipo === 'insumo' || p.tipo === 'juntas' ? 'balanca' : p.tipo === 'grade' ? 'relogio' : setorDaPrancheta(pid).icone; };

  function telaInicio() {
    const s = setorPorId(cfg.papel);
    const data = dataProducao();
    if (!pranchetasDo(s.id).length) {
      return `${topo(s.nome, 'Pranchetas do setor', false)}
        <main><div class="tela-aviso"><div class="grande-ico">${ico('ajustes')}</div>
          <h1>Sem prancheta para preencher</h1>
          <p>O escritório desligou as pranchetas deste setor no tablet chefe. Fale com o encarregado.</p></div></main>`;
    }
    return `${topo(s.nome, 'Pranchetas do setor', false)}
      <main>
        <h2>Qual prancheta você vai preencher?</h2>
        <div class="lista">${pranchetasDo(s.id).map((pid) => {
          const p = prancheta(pid); const r = resumoPrancheta(pid, data);
          return `<button class="item ${r.estado || ''}" data-a="abrir-prancheta" data-id="${pid}"><span class="desenho">${ico(iconeDaPrancheta(pid))}</span>
            <span class="texto"><b>${esc(p.nome)}</b><small>${esc(p.codigo)}</small><span class="situacao">${esc(r.texto)}</span></span><span class="seta">${ico('seta')}</span></button>`;
        }).join('')}</div>
      </main>`;
  }

  /* =========================================================
   * Prancheta: uma tela só
   *   seletor da linha -> quadros; teclado ao lado; folha do dia no monitoramento
   * ========================================================= */
  const dataDaView = (v) => v.data || dataProducao();
  /** Última linha aberta em cada folha, para voltar nela ao trocar de aba. */
  const lembrar = {};
  function chavePadrao(p, pid, data) {
    const lembrada = lembrar[`${data}|${pid}`];
    if (lembrada != null) return lembrada;
    if (p.tipo === 'dornas') {
      const l = dornasDoDia(data, pid);
      const proxima = l.length ? Math.max(...l.map((r) => Number(r.chave))) + 1 : 1;
      // abre a dorna que está em andamento (enchendo, depois a que está indo para cima)
      const ref = p.envio ? p : p.vemDe ? prancheta(p.vemDe.prancheta) : null;
      const pidRef = p.envio ? pid : p.vemDe ? p.vemDe.prancheta : null;
      if (ref && ref.envio) {
        const lr = dornasDoDia(data, pidRef);
        const andando = lr.find((r) => etapaDaDorna(ref, r) === 'enchendo') || lr.find((r) => etapaDaDorna(ref, r) === 'enviando');
        if (andando) return Number(andando.chave);
      }
      return p.vemDe && l.length ? Number(l[l.length - 1].chave) : proxima;
    }
    return data === dataProducao() ? new Date().getHours() : C.inicioDoDia;
  }
  /** Ao trocar de aba: Hidrólise e Sacarificação abrem na mesma dorna; os insumos, na hora em que ela foi enviada. */
  function chaveParaAba(v, alvo) {
    const de = prancheta(v.pid), para = prancheta(alvo);
    const data = dataDaView(v);
    const atual = rascunho ? rascunho.chave : v.chave;
    if (atual != null && de.tipo === 'dornas' && para.tipo === 'dornas' && (pegar(data, alvo, atual) || pegar(data, v.pid, atual))) return atual;
    if (atual != null && de.tipo === 'dornas' && (para.tipo === 'juntas' || para.tipo === 'insumo')) {
      const r = pegar(data, v.pid, atual);
      const campoHora = de.envio ? de.envio.inicio : (de.campos.find((c) => c.type === 'time') || {}).id;
      const h = r && campoHora ? horaDoTexto(r.valores[campoHora]) : null;
      if (h != null) return h;
    }
    return undefined;
  }
  /** Colunas de insumo que o operador preenche, sem repetir as do escritório. */
  const extrasOperador = (p) => (p.camposOperador || []).filter((c) => !p.camposEscritorio.some((e) => e.id === c.id));
  const operadorPreenche = (p, id) => (p.camposOperador || []).some((c) => c.id === id);

  function prepararRascunho(v) {
    const p = prancheta(v.pid);
    const data = dataDaView(v);
    const chave = v.chave != null ? v.chave : chavePadrao(p, v.pid, data);
    const chaveView = `${data}|${v.pid}|${chave}`;
    if (rascunho && rascunho.chaveView === chaveView) return { p, data, chave };
    const extras = { operador: '' };
    let valores = {};
    let novo = true;
    let origem = '';
    let horaAuto = [];

    if (p.tipo === 'juntas') {
      p.partes.forEach((pt) => {
        const r = pegar(data, pt.prancheta, chave);
        const folha = prancheta(pt.prancheta);
        if (r) { novo = false; extras.operador = extras.operador || r.operador || ''; valores[pt.prancheta] = { qtd: r.valores.qtd || '', unidade: r.valores.unidade || folha.unidade }; }
        else {
          const sug = sugestaoDaHora(data, pt.sugestao, chave);
          valores[pt.prancheta] = { qtd: sug ? sug.valor : '', unidade: folha.unidade };
          if (sug) origem = `Valores vindos da${sug.dornas.length > 1 ? 's' : ''} dorna${sug.dornas.length > 1 ? 's' : ''} Nº ${listaE(sug.dornas)}, que começ${sug.dornas.length > 1 ? 'aram' : 'ou'} às ${pad2(chave)}h`;
        }
      });
    } else {
      const r = pegar(data, v.pid, chave);
      novo = !r;
      valores = r ? Object.assign({}, r.valores) : {};
      extras.operador = r ? r.operador || '' : '';
      if (!r && p.tipo === 'dornas') {
        const ant = dornasDoDia(data, v.pid).filter((x) => Number(x.chave) < Number(chave)).pop();
        if (ant) { (p.copiarDaAnterior || []).forEach((id) => { if (!vazio(ant.valores[id])) valores[id] = ant.valores[id]; }); origem = `Valores repetidos da Nº ${ant.chave}`; }
        p.campos.forEach((c) => { if (c.padrao != null && vazio(valores[c.id])) valores[c.id] = c.padrao; });
        // hora que acompanha o relógio do aparelho até a pessoa mudar
        p.campos.filter((c) => c.agoraAoCriar).forEach((c) => { valores[c.id] = horaAgora(); horaAuto.push(c.id); });
        if (p.vemDe) {
          const base = pegar(data, p.vemDe.prancheta, chave);
          if (base) {
            Object.entries(p.vemDe.campos).forEach(([meu, dela]) => { if (!vazio(base.valores[dela])) { valores[meu] = base.valores[dela]; horaAuto = horaAuto.filter((x) => x !== meu); } });
            origem = `Valores vindos da ${prancheta(p.vemDe.prancheta).nome}, dorna Nº ${chave}`;
          }
        }
      }
      if (!r && p.tipo === 'insumo') valores.unidade = p.unidade;
      if (p.tipo === 'grade') { const t = turnoDaHora(chave); const o = pegar(data, v.pid, 'obs' + t.id); extras.obs = o ? o.valores.texto || '' : ''; }
      if (p.tipo === 'insumo') { const m = pegar(data, v.pid, 'meta'); extras.meta = m ? Object.assign({}, m.valores) : {}; }
    }
    // um rascunho novo com valores sugeridos não conta como "mudado" até a pessoa mexer
    // guarda o dia e quem abriu: se o turno trocar ou a folha virar às 07:00 no meio da anotação, salva no dia e no nome certos
    rascunho = { chaveView, chave, data, operador: operadorAtual(), novo, origem, valores, extras, horaAuto, tocados: {}, original: JSON.parse(JSON.stringify(valores)), originalExtras: JSON.stringify(extras) };
    return { p, data, chave };
  }

  function montarAlvos(p, chave) {
    const val = rascunho.valores;
    const campo = (c) => Object.assign({}, c, { opcoes: c.type === 'choice' ? opcoesDe(c) : c.opcoes, get: () => val[c.id], set: (x) => { val[c.id] = x; } });
    if (p.tipo === 'dornas') {
      const ordem = p.grupos ? p.grupos.flatMap((g) => g.campos) : p.campos.map((c) => c.id);
      return ordem.map((id) => p.campos.find((c) => c.id === id)).filter(Boolean).map(campo);
    }
    if (p.tipo === 'grade') {
      const t = turnoDaHora(chave);
      return [...p.itens.map(campo), { id: 'obs', label: `Observação do ${t.nome}`, type: 'text', largo: true, get: () => rascunho.extras.obs, set: (x) => { rascunho.extras.obs = x; } }];
    }
    if (p.tipo === 'juntas') {
      return p.partes.map((pt) => {
        const folha = prancheta(pt.prancheta);
        const item = val[pt.prancheta];
        return {
          id: pt.prancheta, label: folha.nome, type: 'num', dec: 2, unidades: folha.unidades,
          dica: `Quanto de ${folha.nome} foi colocado às ${rotuloHoraPapel(chave)}.`,
          get: () => item.qtd, set: (x) => { item.qtd = x; }, getUnidade: () => item.unidade || folha.unidade, setUnidade: (u) => { item.unidade = u; },
        };
      });
    }
    const lista = [{ id: 'qtd', label: p.rotuloQtd || 'Quantidade adicionada', type: 'num', dec: 2, unidades: p.unidades, get: () => val.qtd, set: (x) => { val.qtd = x; }, getUnidade: () => val.unidade || p.unidade, setUnidade: (u) => { val.unidade = u; } }];
    (p.camposOperador || []).forEach((c) => {
      if (c.opcional && !opcoesDe(c).length) return;
      lista.push(campo(c));
    });
    if (ehCentral()) {
      p.camposEscritorio.filter((c) => !operadorPreenche(p, c.id)).forEach((c) => lista.push({ id: c.id, label: c.label, type: 'text', get: () => val[c.id], set: (x) => { val[c.id] = x; } }));
      lista.push({ id: 'operador', label: 'Nome operador', type: 'text', get: () => rascunho.extras.operador, set: (x) => { rascunho.extras.operador = x; } });
      lista.push({ id: 'meta_lote', label: 'Lote da folha', type: 'text', get: () => rascunho.extras.meta.lote, set: (x) => { rascunho.extras.meta.lote = x; } });
      lista.push({ id: 'meta_verificado', label: 'Verificado por', type: 'text', get: () => rascunho.extras.meta.verificado, set: (x) => { rascunho.extras.meta.verificado = x; } });
    }
    return lista;
  }

  /** Pranchetas que aparecem nas abas. No tablet chefe as telas "juntas" abrem separadas, para o escritório completar cada folha. */
  function pranchetasDasAbas(setorId) {
    const lista = pranchetasDo(setorId);
    return ehCentral() ? lista.flatMap(folhasDe) : lista;
  }
  /** Abas com as pranchetas do setor. A casinha leva de volta para o painel. */
  function abasDoSetor(v) {
    const s = setorDaPrancheta(v.pid);
    const inicio = ehCentral()
      ? `<button class="casa" data-a="painel">${ico('casa')}<span>Painel</span></button>`
      : `<button class="casa" data-a="inicio-setor">${ico('casa')}<span>Início</span></button>`;
    return `<div class="abas">${inicio}${pranchetasDasAbas(s.id).map((pid) => `<button class="${pid === v.pid ? 'sel' : ''}" data-a="aba" data-id="${pid}">${esc(prancheta(pid).nome)}</button>`).join('')}</div>`;
  }
  /** Setas para andar a folha para o lado (aparecem só quando a tabela não cabe na tela). */
  const setasDaFolha = () => `<span class="rolar-folha"><button class="btn pequeno" data-a="rolar-folha" data-dir="-1" aria-label="Rolar a folha para a esquerda">${ico('voltar')}</button><button class="btn pequeno" data-a="rolar-folha" data-dir="1" aria-label="Rolar a folha para a direita">${ico('seta')}</button></span>`;
  /** Botão da folha: inteira na tela (letra menor) ou no tamanho normal (rola com o dedo). */
  const botaoCaber = () => `<button class="btn pequeno" data-a="caber-folha">${ico(cfg.folhaNormal ? 'telaCheia' : 'mais')} ${cfg.folhaNormal ? 'Folha inteira' : 'Letra maior'}</button>`;
  const cabecalhoFolha = (p, data) => `<div class="folha-cab"><div><b>${esc(p.titulo || p.nome)}</b><span>${esc(p.codigo)}. ${esc(C.empresa)}. Data ${fmtData(data)}</span></div><span class="botoes-folha">${botaoCaber()}${setasDaFolha()}</span></div>`;
  /** Folha inteira: a tabela diminui até caber na largura da tela (sem ficar pequena demais para ler). */
  function caberFolhas() {
    app.querySelectorAll('.folha .tabela-wrap').forEach((w) => {
      const t = w.querySelector('table');
      if (!t) return;
      t.style.zoom = '';
      if (cfg.folhaNormal) return;
      const largura = t.scrollWidth;
      if (largura > w.clientWidth + 2) t.style.zoom = Math.max(0.5, (w.clientWidth - 2) / largura).toFixed(3);
    });
    marcarFolhasLargas();
  }
  function marcarFolhasLargas() {
    app.querySelectorAll('.folha').forEach((f) => {
      const w = f.querySelector('.tabela-wrap');
      f.classList.toggle('larga', !!w && w.scrollWidth > w.clientWidth + 2);
    });
  }
  const classeCelula = (c, x) => nivelDe(c, x);

  function seletorDeHoras(chave, hoje, feitaNaHora, legendaDaHora, conferirNaHora) {
    const hAgora = new Date().getHours();
    return `<div class="seletor">${HORAS.map((h) => {
      const feita = feitaNaHora(h);
      const cls = h === chave ? 'sel' : conferirNaHora && conferirNaHora(h) ? 'atual' : hoje && h === hAgora && !feita ? 'atual' : feita ? 'feita' : '';
      const legenda = feita ? legendaDaHora(h) : hoje && h === hAgora ? 'agora' : '';
      return `<button data-a="linha" data-chave="${h}" class="${cls}" ${h === chave ? 'data-rolar-para' : ''}>${pad2(h)}h<small>${esc(legenda)}</small></button>`;
    }).join('')}</div>`;
  }

  function telaPrancheta(v) {
    const { p, data, chave } = prepararRascunho(v);
    const hoje = data === dataProducao();
    const hAgora = new Date().getHours();
    alvos = montarAlvos(p, chave);
    // a folha do dia (tabela do monitoramento) só é montada quando alguém abre o monitoramento
    let seletor = '', cabecalhoForm = '', folha = () => '', rotuloSalvar = '', grupos = p.grupos, etapa = '';
    const origem = rascunho.novo && rascunho.origem ? `<span class="aviso">${esc(rascunho.origem)}</span>` : '';

    if (p.tipo === 'dornas') {
      const linhas = dornasDoDia(data, v.pid);
      const proximo = linhas.length ? Math.max(...linhas.map((r) => Number(r.chave))) + 1 : 1;
      const regAtual = pegar(data, v.pid, chave);
      etapa = etapaDaDorna(p, regAtual);
      // outra dorna ainda indo para cima: dá para marcar que terminou sem sair desta
      const indo = p.envio && !ehCentral() ? linhas.filter((r) => Number(r.chave) !== chave && etapaDaDorna(p, r) === 'enviando') : [];
      contextoEdicao = `${p.rotulo.toLowerCase()} Nº ${chave}`;
      // a "Nova Nº" fica numa caixa própria, à direita: sempre à vista, mesmo com muitas dornas no dia
      seletor = `<div class="seletor-dornas"><div class="seletor">${linhas.map((r) => {
          const n = Number(r.chave); const et = etapaDaDorna(p, r);
          const cls = n === chave ? 'sel' : et === 'enchendo' ? 'atual' : et === 'enviando' ? 'enviando' : 'feita';
          return `<button data-a="linha" data-chave="${n}" class="${cls}" ${n === chave ? 'data-rolar-para' : ''}>Nº ${n}<small>${et}</small></button>`;
        }).join('')}</div>
        ${proximo <= p.maxLinhas ? `<div class="seletor seletor-nova"><button data-a="linha" data-chave="${proximo}" class="${chave === proximo ? 'sel' : 'nova'}">${ico('mais')} Nova Nº ${proximo}</button></div>` : ''}</div>`;
      const quem = esc(rascunho.extras.operador || 'sem nome');
      let status;
      if (!regAtual) status = origem || `<span class="aviso">${p.envio ? 'Dorna nova: anote enquanto ela enche' : 'Toque nos quadros para anotar'}</span>`;
      else if (etapa === 'enchendo') status = `<span class="aviso atencao">${ico('tanque')} Enchendo · ${quem}</span>`;
      else if (etapa === 'enviando') status = `<span class="aviso info">${ico('enviar')} Enviando para cima desde ${esc(regAtual.valores[p.envio.inicio])}</span>`;
      else status = `<span class="aviso ok">${ico('certo')} Anotada por ${quem}</span>`;
      let ligacao = '';
      if (p.vemDe) {
        const base = pegar(data, p.vemDe.prancheta, chave);
        const manuais = (regAtual && regAtual.manuais) || [];
        const nomeBase = prancheta(p.vemDe.prancheta).nome;
        if (base && manuais.length) {
          const nomes = manuais.map((id) => (p.campos.find((c) => c.id === id) || { label: id }).label).join(', ');
          ligacao = `<span class="aviso atencao">${esc(nomes)} mudado aqui</span><button class="btn pequeno" data-a="copiar-vemde">${ico('seta')} Copiar da ${esc(nomeBase)}</button>`;
        } else if (base && regAtual) ligacao = `<span class="aviso">${ico('certo')} Acompanha a ${esc(nomeBase)}, dorna Nº ${chave}</span>`;
      }
      cabecalhoForm = `${status}${ligacao}
        ${indo.map((r) => `<button class="btn pequeno atencao" data-a="terminar-dorna" data-chave="${r.chave}">${ico('fim')} Terminou a Nº ${r.chave}</button>`).join('')}
        ${regAtual ? `<button class="btn pequeno perigo" data-a="apagar-linha">${ico('lixeira')} Apagar a Nº ${chave}</button>` : ''}`;
      rotuloSalvar = `Salvar ${p.rotulo.toLowerCase()} Nº ${chave}`;
      folha = () => `<div class="folha">${cabecalhoFolha(p, data)}<div class="tabela-wrap"><table class="papel">
        <thead><tr><th>Nº</th>${p.campos.map((c) => `<th>${esc(c.label)}</th>`).join('')}<th>Responsável</th></tr></thead>
        <tbody>${linhas.map((r) => `<tr class="clicavel ${Number(r.chave) === chave ? 'sel' : ''}" data-a="linha" data-chave="${r.chave}"><td><b>${r.chave}</b></td>
          ${p.campos.map((c) => { const x = r.valores[c.id]; if (vazio(x) && p.envio && c.id === p.envio.fim) return `<td class="aberta">${etapaDaDorna(p, r)}</td>`; return `<td class="${classeCelula(c, x)}">${esc(fmtCampo(c, x))}</td>`; }).join('')}
          <td>${esc(r.operador || '')}</td></tr>`).join('')}
          ${!linhas.length ? `<tr><td colspan="${p.campos.length + 2}" class="vazia">A folha de hoje ainda está em branco.</td></tr>` : ''}</tbody></table></div></div>`;
    } else if (p.tipo === 'juntas') {
      const regsPorParte = p.partes.map((pt) => { const m = {}; linhasDeHora(listar(data, pt.prancheta)).forEach((r) => { if (!vazio(r.valores.qtd)) m[r.chave] = r; }); return m; });
      const conferirNa = (h) => regsPorParte.some((m) => m[h] && m[h].conferir);
      contextoEdicao = `${p.nome}, ${rotuloHoraPapel(chave)}`;
      seletor = seletorDeHoras(chave, hoje, (h) => regsPorParte.some((m) => m[h]), (h) => (conferirNa(h) ? 'conferir' : 'feita'), conferirNa);
      const auto = regsPorParte.map((m) => m[chave]).filter((r) => r && r.conferir);
      const dornasAuto = [...new Set(auto.flatMap((r) => r.dornas || []))].sort((a, b) => a - b);
      if (auto.length) cabecalhoForm = `<span class="aviso atencao">${ico('alerta')} Somado da${dornasAuto.length > 1 ? 's' : ''} dorna${dornasAuto.length > 1 ? 's' : ''} Nº ${listaE(dornasAuto)}. Confira e confirme.</span>`;
      else cabecalhoForm = rascunho.novo ? (origem || '<span class="aviso">Anote quanto foi colocado</span>') : `<span class="aviso ok">${ico('certo')} Anotado por ${esc(rascunho.extras.operador || 'sem nome')}</span>`;
      rotuloSalvar = `${auto.length ? 'Confirmar' : 'Salvar'} ${p.nome} das ${rotuloHoraPapel(chave)}`;
      grupos = [{ titulo: `Quantidades das ${rotuloHoraPapel(chave)}`, campos: p.partes.map((pt) => pt.prancheta) }];
      folha = () => `<div class="folha"><div class="folha-cab"><div><b>${esc(p.nome)}</b><span>${esc(p.codigo)}. Cada coluna é uma folha separada no Excel. Data ${fmtData(data)}</span></div><span class="botoes-folha">${botaoCaber()}${setasDaFolha()}</span></div>
        <div class="tabela-wrap"><table class="papel">
          <thead><tr><th>Horas</th>${p.partes.map((pt) => `<th>${esc(prancheta(pt.prancheta).nome)}</th>`).join('')}<th>Nome operador</th></tr></thead>
          <tbody>${HORAS.map((h) => {
            const regs = regsPorParte.map((m) => m[h]);
            const op = (regs.find(Boolean) || {}).operador || '';
            return `<tr class="clicavel ${h === chave ? 'sel' : ''}" data-a="linha" data-chave="${h}"><td class="${hoje && h === hAgora ? 'agora' : ''}"><b>${rotuloHoraPapel(h)}</b></td>
              ${regs.map((r) => `<td><b>${r ? `${esc(fmtNum(r.valores.qtd))} ${esc(r.valores.unidade || '')}` : ''}</b></td>`).join('')}<td>${esc(op)}</td></tr>`;
          }).join('')}
          <tr><td><b>Total</b></td>${p.partes.map((pt) => `<td><b>${esc(totalInsumo(linhasDeHora(listar(data, pt.prancheta))) || '0')}</b></td>`).join('')}<td></td></tr></tbody>
        </table></div></div>`;
    } else if (p.tipo === 'grade') {
      const porHora = {};
      linhasDeHora(listar(data, v.pid)).forEach((r) => { porHora[r.chave] = r; });
      contextoEdicao = `leitura das ${rotuloHora(chave)}`;
      seletor = seletorDeHoras(chave, hoje, (h) => !!porHora[h], () => 'feita');
      const reg = porHora[chave];
      cabecalhoForm = `<span class="aviso">${esc(turnoDaHora(chave).nome)}</span>${reg ? `<span class="aviso ok">${ico('certo')} Anotada por ${esc(reg.operador || 'sem nome')}</span>` : ''}`;
      rotuloSalvar = `Salvar leitura das ${rotuloHora(chave)}`;
      const regs = listar(data, v.pid);
      folha = () => `<div class="turnos">${C.turnos.map((t) => {
          const nomes = [...new Set(linhasDeHora(regs).filter((r) => turnoDaHora(Number(r.chave)).id === t.id).map((r) => r.operador).filter(Boolean))];
          const obs = pegar(data, v.pid, 'obs' + t.id);
          return `<div class="turno"><h3>${esc(t.nome)}, ${faixaTurno(t)}</h3><p><span>Operador:</span> ${esc(nomes.join(', ') || 'ninguém anotou')}</p><p><span>Observação:</span> ${esc(obs && obs.valores.texto ? obs.valores.texto : 'nenhuma')}</p></div>`;
        }).join('')}</div>
        <div class="folha" style="margin-top:12px">${cabecalhoFolha(p, data)}<div class="tabela-wrap"><table class="papel">
          <thead><tr><th class="lateral">Itens / Horas</th>${HORAS.map((h) => `<th class="${h === chave ? 'sel' : ''} ${hoje && h === hAgora ? 'agora' : ''}">${h}</th>`).join('')}</tr></thead>
          <tbody>${p.itens.map((c) => `<tr><td class="lateral">${esc(c.label)}</td>${HORAS.map((h) => { const x = porHora[h] ? porHora[h].valores[c.id] : ''; return `<td class="clicavel ${classeCelula(c, x)} ${h === chave ? 'sel' : ''}" data-a="linha" data-chave="${h}">${esc(fmtCampo(c, x))}</td>`; }).join('')}</tr>`).join('')}</tbody>
        </table></div></div>`;
    } else {
      const porHora = {};
      linhasDeHora(listar(data, v.pid)).forEach((r) => { porHora[r.chave] = r; });
      contextoEdicao = `${p.nome}, ${rotuloHoraPapel(chave)}`;
      seletor = seletorDeHoras(chave, hoje, (h) => porHora[h] && !vazio(porHora[h].valores.qtd), (h) => `${fmtNum(porHora[h].valores.qtd)} ${porHora[h].valores.unidade || ''}`);
      const reg = porHora[chave];
      cabecalhoForm = reg && !vazio(reg.valores.qtd) ? `<span class="aviso ok">${ico('certo')} Anotado por ${esc(reg.operador || 'sem nome')}</span>` : `<span class="aviso">${p.rotuloQtd ? `Anote o ${esc(p.rotuloQtd.toLowerCase())}` : 'Anote quanto foi colocado'}</span>`;
      rotuloSalvar = `Salvar ${p.nome} das ${rotuloHoraPapel(chave)}`;
      const meta = (pegar(data, v.pid, 'meta') || { valores: {} }).valores;
      const extras = extrasOperador(p);
      folha = () => `<div class="folha">${cabecalhoFolha(p, data)}
        <div class="folha-cab"><span>Lote: <b>${esc(meta.lote || 'o escritório preenche')}</b></span><span>Verificado por: <b>${esc(meta.verificado || 'o escritório preenche')}</b></span></div>
        <div class="tabela-wrap"><table class="papel">
          <thead><tr><th>Horas</th><th>${esc(p.rotuloQtd || 'Quant. adicionada')}</th>${extras.map((c) => `<th>${esc(c.label)}</th>`).join('')}<th>Nome operador</th>${p.camposEscritorio.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
          <tbody>${HORAS.map((h) => { const r = porHora[h]; const x = r ? r.valores : {};
            return `<tr class="clicavel ${h === chave ? 'sel' : ''}" data-a="linha" data-chave="${h}"><td class="${hoje && h === hAgora ? 'agora' : ''}"><b>${rotuloHoraPapel(h)}</b></td>
              <td><b>${vazio(x.qtd) ? '' : `${esc(fmtNum(x.qtd))} ${esc(x.unidade || '')}`}</b></td>
              ${extras.map((c) => `<td>${esc(x[c.id] || '')}</td>`).join('')}
              <td>${esc(r ? r.operador || '' : '')}</td>
              ${p.camposEscritorio.map((c) => `<td class="${operadorPreenche(p, c.id) ? '' : 'escritorio'}">${esc(x[c.id] || '')}</td>`).join('')}</tr>`; }).join('')}
            <tr><td><b>Total</b></td><td><b>${esc(totalInsumo(linhasDeHora(listar(data, v.pid))) || '0')}</b></td><td colspan="${p.camposEscritorio.length + extras.length + 1}"></td></tr></tbody>
        </table></div></div>`;
    }

    const subtituloTopo = subtituloDaFolha(data);

    // Monitoramento: a folha do dia inteira, fora da tela de anotar
    if (v.monitor) {
      return `${cabecalho(p.nome, subtituloTopo, false, atalhosOperador())}
        <div class="edicao"><div class="coluna"><div class="barra-trabalho">${abasDoSetor(v)}</div><main>
          <p class="sub" style="margin:2px 0 10px">Toque em uma linha para abrir e corrigir.</p>
          ${folha()}</main>
        <div class="rodape"><button class="btn primario" data-a="monitor">${ico('voltar')} Voltar para anotar</button></div></div></div>`;
    }

    const fixoTopo = `${abasDoSetor(v)}${seletor}${cabecalhoForm ? `<div class="cabecalho-form">${cabecalhoForm}</div>` : ''}`;
    const conteudo = blocosDeQuadros(grupos, alvos);
    lembrar[`${data}|${v.pid}`] = chave;
    let rodape = `<button class="btn primario" data-a="salvar">${ico('certo')} ${esc(rotuloSalvar)}</button>`;
    if (p.envio && !ehCentral() && (etapa === 'nova' || etapa === 'enchendo')) {
      rodape = `<button class="btn" data-a="salvar">${ico('certo')} Salvar</button><button class="btn primario" data-a="enviar-dorna">${ico('enviar')} Enviar Nº ${chave}</button>`;
    } else if (p.envio && !ehCentral() && etapa === 'enviando') {
      rodape = `<button class="btn" data-a="salvar">${ico('certo')} Salvar</button><button class="btn primario" data-a="terminar-dorna" data-chave="${chave}">${ico('fim')} Terminou de enviar</button>`;
    }
    return `${cabecalho(p.nome, subtituloTopo, false, atalhosOperador())}${telaEdicao(conteudo, rodape, fixoTopo)}`;
  }

  /* No tablet chefe, mudar o que um operador anotou precisa da senha dele: os dois ficam sabendo da alteração.
     Operador sem senha (ou nome que não está na lista do setor): o encarregado autoriza com a senha dele.
     Linha nova e campos do escritório (NF, lote, validade, fornecedor, verificado por) não pedem senha. */
  function quemPrecisaAutorizar() {
    const v = view();
    if (!ehCentral() || !rascunho || v.tela !== 'prancheta') return [];
    const p = prancheta(v.pid);
    const { data, chave } = rascunho;
    const mudou = (a, b) => JSON.stringify(a == null ? '' : a) !== JSON.stringify(b == null ? '' : b);
    const nomes = new Set();
    if (p.tipo === 'juntas') {
      p.partes.forEach((pt) => {
        const existente = pegar(data, pt.prancheta, chave);
        if (existente && existente.operador && mudou(rascunho.valores[pt.prancheta].qtd, rascunho.original[pt.prancheta].qtd)) nomes.add(existente.operador);
      });
    } else {
      const existente = pegar(data, v.pid, chave);
      if (existente && existente.operador) {
        const doEscritorio = new Set((p.camposEscritorio || []).filter((c) => !operadorPreenche(p, c.id)).map((c) => c.id));
        const antes = JSON.parse(rascunho.originalExtras || '{}');
        const campos = Object.keys(Object.assign({}, rascunho.valores, rascunho.original)).filter((k) => !doEscritorio.has(k) && mudou(rascunho.valores[k], rascunho.original[k]));
        if (campos.length || (p.tipo === 'grade' && mudou(rascunho.extras.obs, antes.obs)) || (p.tipo === 'insumo' && mudou(rascunho.extras.operador, antes.operador))) nomes.add(existente.operador);
      }
    }
    return [...nomes].filter((n) => n && n !== 'escritório');
  }
  /** Pede a senha de cada operador (ou do encarregado). Resolve true se todas estão certas. */
  async function autorizar(nomes) {
    const setor = setorDaPrancheta(view().pid);
    for (const nome of nomes) {
      const op = setor ? operadorPorNome(setor.id, nome) : null;
      const comSenha = !!(op && op.senha);
      const s = await pedirSenhaModal(comSenha ? `Senha de ${nome}` : 'Senha do encarregado',
        comSenha ? `Para mudar o que ${nome} anotou, ${nome} digita a senha. Assim os dois ficam sabendo da alteração.` : `${nome} não tem senha cadastrada: o encarregado autoriza a alteração.`);
      if (s === undefined) return false;
      if (comSenha ? embaralharSenha(nome, s) !== op.senha : s !== C.pinAdmin) { toast('Senha errada. A alteração não foi salva.', 'erro'); return false; }
    }
    return true;
  }

  function salvarRascunho(automatico, opcoes = {}) {
    const v = view();
    if (!rascunho || v.tela !== 'prancheta') return false;
    // salvando sozinho (troca de turno, virada do dia, saiu da tela): vale o nome de quem abriu a linha
    const quem = ehCentral() ? '' : operadorAtual() || (automatico ? rascunho.operador : null);
    if (!ehCentral() && !quem) { if (!automatico) exigeOperador(); return false; }
    // tablet chefe mudando o que um operador anotou: só com a senha dele (salvar sozinho, ao sair da tela, não vale)
    const precisaAutorizar = ehCentral() ? quemPrecisaAutorizar() : [];
    if (precisaAutorizar.length && !opcoes.autorizado) {
      toast(`A alteração não foi salva: para mudar o que ${listaE(precisaAutorizar)} anotou, toque em Salvar e digite a senha.`, 'erro');
      return false;
    }
    const marcaAlteracao = precisaAutorizar.length ? { alteradoPeloEscritorio: { em: Date.now(), autorizadoPor: precisaAutorizar } } : {};
    const p = prancheta(v.pid);
    const data = rascunho.data;
    const chave = rascunho.chave;

    if (p.tipo === 'juntas') {
      let algum = false;
      p.partes.forEach((pt) => {
        const item = rascunho.valores[pt.prancheta];
        const existente = pegar(data, pt.prancheta, chave);
        // hora somada sozinha: quem confirma vira o responsável
        const operador = ehCentral() ? (existente && existente.operador) || '' : (existente && !existente.auto && existente.operador) || quem;
        // confirmou a soma das dornas (não mudou o valor): se depois entrar outra dorna nessa hora, a soma volta para conferir
        const somaConfirmada = !!(existente && (existente.auto || existente.somaConfirmada) && existente.dornas && existente.valores.qtd === item.qtd);
        if (!vazio(item.qtd)) { gravar(data, pt.prancheta, chave, { qtd: item.qtd, unidade: item.unidade }, Object.assign({ operador, auto: false, conferir: false, somaConfirmada, dornas: somaConfirmada ? existente.dornas : [] }, marcaAlteracao)); algum = true; }
        else if (existente) apagar(data, pt.prancheta, chave);
      });
      if (!algum && !automatico && rascunho.novo) { toast('Anote pelo menos uma quantidade antes de salvar', 'erro'); return false; }
      if (!opcoes.silencioso) toast(`${p.nome} das ${rotuloHoraPapel(chave)} ${automatico ? 'salvo' : 'confirmado'}`);
    } else {
      const existente = pegar(data, v.pid, chave);
      const temAlgo = Object.entries(rascunho.valores).some(([k, x]) => k !== 'unidade' && !vazio(x));
      const operador = ehCentral() ? (rascunho.extras.operador || (existente && existente.operador) || '') : (existente && existente.operador) || quem;
      const extrasMudaram = JSON.stringify(rascunho.extras) !== rascunho.originalExtras;

      const extra = Object.assign({ operador }, marcaAlteracao);
      if (p.vemDe) {
        // quadro que veio de outra folha e foi mudado aqui para de acompanhar; voltou ao mesmo valor, acompanha de novo
        const base = pegar(data, p.vemDe.prancheta, chave);
        const manuais = new Set((existente && existente.manuais) || []);
        Object.entries(p.vemDe.campos).forEach(([meu, dela]) => {
          if (rascunho.valores[meu] === rascunho.original[meu]) return;
          if (base && rascunho.valores[meu] === base.valores[dela]) manuais.delete(meu); else manuais.add(meu);
        });
        extra.manuais = [...manuais];
      }
      if (temAlgo) gravar(data, v.pid, chave, rascunho.valores, extra);
      else if (existente) apagar(data, v.pid, chave); // quadros todos limpos: só a linha sai (renumerar é só no botão Apagar)
      else if (!automatico && !extrasMudaram) { toast('Anote pelo menos um quadro antes de salvar', 'erro'); return false; }
      if (p.tipo === 'dornas' && (temAlgo || existente)) depoisDeMudarDorna(data, v.pid, temAlgo ? Number(chave) : null);

      if (p.tipo === 'grade' && extrasMudaram) gravar(data, v.pid, 'obs' + turnoDaHora(chave).id, { texto: rascunho.extras.obs }, { operador: quem || '' });
      if (p.tipo === 'insumo' && ehCentral() && extrasMudaram) gravar(data, v.pid, 'meta', rascunho.extras.meta);
      const nome = p.tipo === 'dornas' ? `${p.rotulo} Nº ${chave}` : p.tipo === 'grade' ? `Leitura das ${rotuloHora(chave)}` : `${p.nome} das ${rotuloHoraPapel(chave)}`;
      const et = p.envio && temAlgo ? etapaDaDorna(p, pegar(data, v.pid, chave)) : '';
      if (!opcoes.silencioso) toast(`${nome} salva${et && et !== 'anotada' ? ` (${et})` : ''}`);
    }
    rascunho.original = JSON.parse(JSON.stringify(rascunho.valores));
    rascunho.originalExtras = JSON.stringify(rascunho.extras);
    return true;
  }

  function totalInsumo(linhas) {
    const soma = {};
    linhas.forEach((r) => { const n = parseFloat(r.valores.qtd); if (isNaN(n)) return; const u = r.valores.unidade || ''; soma[u] = (soma[u] || 0) + n; });
    return Object.entries(soma).map(([u, n]) => `${fmtNum(Math.round(n * 100) / 100)} ${u}`.trim()).join(' + ');
  }

  /* =========================================================
   * Tablet chefe: painel
   * ========================================================= */
  function atalhosChefe() {
    const abertos = avisosEmAberto().length;
    return `<button class="atalho" data-a="avisos" aria-label="Avisos${abertos ? `, ${abertos} esperando` : ''}">${ico('sino')}<span>Avisos</span>${abertos ? `<em class="contador">${abertos}</em>` : ''}</button>
      <button class="atalho" data-a="ler-folha">${ico('camera')}<span>Ler folha</span></button>
      <button class="atalho" data-a="relatorios">${ico('pasta')}<span>Relatórios</span></button>
      <button class="atalho" data-a="config">${ico('pessoas')}<span>Usina</span></button>`;
  }
  function telaCentral(v) {
    const data = v.data;
    const hoje = dataProducao();
    const st = sync.status;
    const lista = setores();
    const todos = lista.flatMap((s) => s.pranchetas.flatMap(folhasDe).flatMap((pid) => listar(data, pid)));
    const pend = data === hoje ? lista.flatMap((s) => s.pranchetas.map((pid) => resumoPrancheta(pid, data))).filter((r) => r.estado === 'pendente').length : 0;
    const ligados = st ? st.aparelhos.filter((a) => a.online).length : 0;
    const subtitulo = cfg.demo ? 'Demonstração, dados só neste aparelho' : sync.modo === 'online' ? (centralNoTablet() ? 'Servidor ligado neste aparelho' : 'Acompanhando a central em tempo real') : 'Procurando o servidor';

    return `${cabecalho(nomeDoChefe(), subtitulo, false, atalhosChefe())}
      <main class="painel-chefe">
        <div class="barra-dia">
          <div class="nav-data">
            <button class="btn" data-a="dia" data-n="-1" aria-label="Dia anterior">${ico('voltar')}</button>
            <div class="data-grande"><b>${fmtData(data)}</b><span>${diaSemana(data)}, das 07:00 até 06:59 do dia seguinte</span></div>
            <button class="btn" data-a="dia" data-n="1" aria-label="Próximo dia" ${data >= hoje ? 'disabled' : ''}>${ico('seta')}</button>
            ${data !== hoje ? '<button class="btn pequeno" data-a="dia-hoje">Hoje</button>' : ''}
          </div>
          <div class="numeros">
            <div><b>${todos.length}</b><span>anotações</span></div>
            <div class="${pend ? 'atencao' : ''}"><b>${pend}</b><span>pendências</span></div>
            <div><b>${cfg.demo ? '-' : ligados}</b><span>aparelhos ligados</span></div>
          </div>
        </div>

        <div class="central-grade">
          <section>
            <h2>Setores</h2>
            <div class="setores-grade">${lista.map((s) => {
              const regs = s.pranchetas.flatMap(folhasDe).flatMap((pid) => listar(data, pid)).sort((a, b) => b.atualizadoEm - a.atualizadoEm);
              const resumos = data === hoje ? s.pranchetas.map((pid) => resumoPrancheta(pid, data)) : [];
              const pends = resumos.filter((r) => r.estado === 'pendente');
              const andando = resumos.filter((r) => r.estado === 'andamento');
              const disp = st && st.aparelhos.find((a) => a.papel === s.id);
              const hora = regs[0] ? new Date(regs[0].atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
              // o que falta vem primeiro; depois a dorna em andamento (o escritório vê as duas coisas)
              const agora = [pends[0], andando[0]].filter(Boolean).map((r) => r.texto.replace(/\.$/, '')).join('. ');
              const situacao = diasBuscando.has(data) ? 'Buscando as anotações na central...' : agora ? agora + '.' : regs.length ? `${contar(regs.length, 'anotação', 'anotações')}, a última às ${hora}` : 'Nada anotado neste dia';
              const aparelho = cfg.demo ? '' : disp ? (disp.online ? `Ligado${disp.operador ? `, ${disp.operador}` : ''}` : `Sem sinal há ${disp.minutos} min`) : 'Tablet não conectado';
              const sinal = cfg.demo ? '' : disp && disp.online ? 'ok' : disp ? 'off' : '';
              return `<button class="setor-cartao ${pends.length ? 'pendente' : andando.length ? 'andamento' : regs.length ? 'feito' : ''}" data-a="abrir-setor" data-id="${s.id}">
                <span class="desenho">${ico(s.icone)}</span>
                <span class="texto"><b>${esc(s.nome)}</b>${aparelho ? `<span class="conexao ${sinal}"><i></i>${esc(aparelho)}</span>` : ''}
                <span class="situacao">${esc(situacao)}</span></span><span class="seta">${ico('seta')}</span></button>`;
            }).join('')}</div>
          </section>

          <aside class="lateral-chefe">
            <section class="bloco">
              <h2>Compartilhar a folha do dia</h2>
              <button class="btn primario largo" data-a="compartilhar" data-destino="escritorio">${ico('enviar')} Enviar para o escritório</button>
              <div class="grade-acoes">
                <button data-a="compartilhar" data-destino="whatsapp">${ico('whatsapp')}<span>WhatsApp</span></button>
                <button data-a="compartilhar" data-destino="email">${ico('email')}<span>E-mail</span></button>
                <button data-a="compartilhar" data-destino="outros">${ico('compartilhar')}<span>Outros apps</span></button>
                <button data-a="compartilhar" data-destino="baixar">${ico('baixar')}<span>Guardar</span></button>
                <button data-a="imprimir">${ico('imprimir')}<span>Imprimir</span></button>
                <button data-a="relatorios">${ico('pasta')}<span>Relatórios</span></button>
              </div>
            </section>
            <section class="bloco conectar">
              <h2>Conectar um tablet</h2>
              ${cfg.demo
                ? '<p class="sub" style="margin:0">Na usina, aqui aparecem o QR code para baixar o aplicativo e o código de conexão.</p>'
                : `<div class="conectar-linha">
                  <button class="qr" id="qr" data-a="qr-grande" aria-label="Ampliar o QR code"></button>
                  <div class="conectar-info"><small>Código de conexão</small>
                  <p class="codigo-grande">${st ? esc(String(st.codigo).replace(/(\d{3})(\d{3})/, '$1 $2')) : '--- ---'}</p>
                  <div class="linha-botoes"><button class="btn pequeno" data-a="qr-grande">Ampliar QR code</button><button class="btn pequeno" data-a="novo-codigo">Trocar código</button></div></div></div>`}
            </section>
          </aside>
        </div>
      </main>`;
  }
  function desenharQr() {
    const el = document.getElementById('qr');
    if (!el || typeof window.qrcode !== 'function' || cfg.demo) return;
    const st = sync.status;
    const url = st && st.enderecos && st.enderecos[0] ? st.enderecos[0] + '/baixar' : '';
    if (!url) { el.innerHTML = '<span class="sub">Procurando o Wi-Fi</span>'; return; }
    // montar o QR code é pesado: guarda o desenho e só refaz se o endereço mudar
    if (qrGuardado.url !== url) {
      const q = window.qrcode(0, 'M'); q.addData(url); q.make();
      qrGuardado.url = url; qrGuardado.svg = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    }
    el.innerHTML = qrGuardado.svg;
  }
  const qrGuardado = { url: '', svg: '' };

  /* =========================================================
   * Tela de avisos do tablet chefe: escrever, mandar e acompanhar
   * ========================================================= */
  const FRASES_AVISO = ['Passe no escritório.', 'Ligue para o escritório.', 'Venha falar comigo quando puder.'];
  function previaDoAviso(f) {
    const setor = (setorPorId(f.setor) || {}).nome || '';
    const quem = f.nome || 'alguém';
    if (cfg.demo) return `Demonstração: no aparelho da ${setor}, o aviso aparece quando ${quem} entrar.`;
    if (trabalhandoAgora(f.setor, f.nome)) return f.nome ? `${f.nome} está trabalhando agora: o aviso aparece na tela em poucos segundos.` : `Tem gente trabalhando agora na ${setor}: o aviso aparece na tela em poucos segundos.`;
    return f.nome ? `${f.nome} não está trabalhando agora. O aviso fica guardado e aparece quando ${f.nome} entrar.` : `Ninguém trabalhando agora na ${setor}. O aviso fica guardado e aparece quando alguém entrar.`;
  }
  function htmlListaAvisos() {
    const lista = todosAvisos().slice(0, 50);
    if (!lista.length) return '<p class="sub">Nenhum aviso enviado ainda.</p>';
    return lista.map((av) => {
      const s = situacaoDoAviso(av);
      const setor = (setorPorId(av.paraSetor) || {}).nome || av.paraSetor;
      const quando = av.enviadoEm ? horaCurta(av.enviadoEm) + (av.data !== dataProducao() ? ` · ${fmtData(av.data)}` : '') : '';
      return `<div class="aviso-item ${s.estado}">
        <div class="aviso-item-cab"><b>${esc(av.paraNome || 'Quem estiver no setor')}</b><span>${esc(setor)}${quando ? ` · ${esc(quando)}` : ''}</span></div>
        <p>${esc(av.texto)}</p>
        <div class="aviso-item-pe"><span class="selo ${s.estado}">${esc(s.texto)}</span>
          ${['esperando', 'na-tela'].includes(s.estado) ? `<button class="btn pequeno" data-a="aviso-cancelar" data-id="${esc(av.id)}" data-data="${esc(av.data)}">Cancelar</button>` : ''}</div>
      </div>`;
    }).join('');
  }
  function telaAvisos(v) {
    const lista = setores();
    const f = v.form || (v.form = { setor: (lista[0] || {}).id, nome: '', texto: '' });
    if (!lista.some((s) => s.id === f.setor)) { f.setor = (lista[0] || {}).id; f.nome = ''; }
    const ops = f.setor ? operadoresDo(f.setor) : [];
    if (f.nome && !ops.some((o) => o.nome === f.nome)) f.nome = '';
    return `${cabecalho('Avisos', 'Mensagens para quem está trabalhando', true)}
      <main class="tela-avisos">
        <div class="avisos-grade">
          <section class="bloco novo-aviso">
            <h2>${ico('sino')} Novo aviso</h2>
            <h3>Para qual setor?</h3>
            <div class="chips-escolha">${lista.map((s) => `<button class="${s.id === f.setor ? 'sel' : ''}" data-a="aviso-setor" data-id="${s.id}">${ico(s.icone)}<span>${esc(s.nome)}</span></button>`).join('')}</div>
            <h3>Para quem?</h3>
            <div class="chips-escolha">
              <button class="${!f.nome ? 'sel' : ''}" data-a="aviso-pessoa" data-nome="">${ico('pessoas')}<span>Quem estiver no setor</span></button>
              ${ops.map((o) => `<button class="${f.nome === o.nome ? 'sel' : ''}" data-a="aviso-pessoa" data-nome="${esc(o.nome)}">${ico('pessoa')}<span>${esc(o.nome)}</span>${trabalhandoAgora(f.setor, o.nome) ? '<small class="trabalhando">trabalhando</small>' : ''}</button>`).join('')}
            </div>
            <h3><label for="aviso-texto">Mensagem</label></h3>
            <textarea id="aviso-texto" maxlength="${TAMANHO_AVISO}" rows="3" placeholder="Escreva aqui o aviso">${esc(f.texto)}</textarea>
            <div class="frases">${FRASES_AVISO.map((t) => `<button class="btn pequeno" data-a="aviso-frase" data-texto="${esc(t)}">${esc(t)}</button>`).join('')}</div>
            <p class="aviso-previa" id="aviso-previa">${esc(previaDoAviso(f))}</p>
            <button class="btn primario largo" data-a="aviso-enviar">${ico('enviar')} Enviar aviso</button>
          </section>
          <section class="bloco">
            <h2>Avisos enviados</h2>
            <div id="lista-avisos" class="lista-avisos">${htmlListaAvisos()}</div>
          </section>
        </div>
      </main>`;
  }
  function atualizarTelaAvisos() {
    const el = document.getElementById('lista-avisos');
    if (el) el.innerHTML = htmlListaAvisos();
    const v = view();
    const p = document.getElementById('aviso-previa');
    if (p && v.form) p.textContent = previaDoAviso(v.form);
  }
  /** Fecha o aviso da tela se o escritório cancelou enquanto ele estava aberto. */
  function revisarAvisoNaTela() {
    if (!avisoNaTela) return;
    const av = todosAvisos().find((x) => x.id === avisoNaTela);
    if (av && av.cancelado && modalAberto()) { fecharModalAtual(); toast('O escritório cancelou o aviso'); }
  }

  /* =========================================================
   * Relatórios guardados no servidor (pasta RelatoriosUsina)
   * ========================================================= */
  /* Relatórios: um por dia, com as folhas de todos os setores. O XML não aparece aqui: é só outro tipo de arquivo
     que dá para escolher na hora de enviar. */
  function telaRelatorios(v) {
    const guardados = new Map((v.dias || []).map((d) => [d.data, d.arquivos || []]));
    const dias = [...new Set([...(v.diasComDados || []), ...guardados.keys()])].sort().reverse();
    return `${cabecalho('Relatórios', 'Um por dia, com todos os setores', true, `<button class="atalho" data-a="gerar-hoje">${ico('planilha')}<span>Gerar agora</span></button>`)}
      <main>
        ${cfg.demo ? '<div class="tela-aviso"><h1>Sem servidor na demonstração</h1><p>Na usina, aqui aparece um relatório por dia, com as folhas de todos os setores, para abrir, corrigir e enviar.</p></div>' : ''}
        ${!cfg.demo && !v.carregado ? '<p class="sub">Buscando os relatórios...</p>' : ''}
        ${!cfg.demo && v.carregado && !dias.length ? '<div class="tela-aviso"><div class="grande-ico">' + ico('pasta') + '</div><h1>Nenhum relatório ainda</h1><p>Assim que os setores anotarem, o dia aparece aqui. Às 07:00 o Excel do dia anterior é guardado sozinho.</p></div>' : ''}
        <div class="relatorios">${dias.map((d) => {
          const excel = (guardados.get(d) || []).some((a) => /\.xlsx$/i.test(a.nome));
          return `<section class="bloco relatorio-dia">
            <div class="relatorio-cab"><span class="escolha-ico">${ico('planilha')}</span>
              <div><b>Folhas de ${fmtData(d)}</b><small>${diaSemana(d)}${d === dataProducao() ? ' (hoje)' : ''} · ${excel ? 'Excel guardado em RelatoriosUsina' : 'ainda sem Excel guardado'}</small></div></div>
            <div class="linha-botoes">
              <button class="btn pequeno primario" data-a="relatorio-abrir" data-data="${d}">${ico('seta')} Abrir e corrigir</button>
              <button class="btn pequeno" data-a="relatorio-enviar" data-data="${d}">${ico('enviar')} Enviar ou imprimir</button>
              ${(guardados.get(d) || []).length ? `<button class="btn pequeno perigo" data-a="relatorio-apagar" data-data="${d}">${ico('lixeira')} Apagar o arquivo</button>` : ''}
            </div></section>`;
        }).join('')}</div>
      </main>`;
  }
  async function carregarRelatorios() {
    const v = view();
    if (cfg.demo) { v.carregado = true; return; }
    try {
      const r = await buscar('api/relatorios', {}, 8000);
      const dados = r.ok ? await r.json() : { dias: [] };
      v.dias = dados.dias || []; v.diasComDados = dados.diasComDados || []; v.pasta = dados.pasta || '';
    } catch (e) { v.dias = []; toast('Não consegui ler os relatórios do servidor', 'erro'); }
    v.carregado = true;
    if (view() === v) render();
  }

  /* =========================================================
   * Ler folha de papel (tablet chefe): foto -> leitura -> conferir -> salvar
   * Tudo dentro do aparelho, sem internet (leitor.js + lib/opencv.js + lib/leitor.onnx)
   * ========================================================= */
  /** qual molde do papel cada prancheta usa */
  function moldeDaFolha(pid) {
    const p = prancheta(pid);
    if (!p) return null;
    if (p.papel && p.papel.modelo === 'pop011') return pid === 'hid_anexo1' ? 'anexo1' : pid === 'hid_anexo2' ? 'anexo2' : null;
    if (p.tipo === 'insumo') return 'pop03';
    return null;
  }
  const folhasQueLeio = () => setores().flatMap((s) => s.pranchetas.flatMap(folhasDe).map((pid) => ({ pid, setor: s }))).filter((x) => moldeDaFolha(x.pid));

  function specDoCampo(c) {
    if (!c) return { tipo: 'texto' };
    if (c.type === 'time') return { tipo: 'hora' };
    if (c.type === 'choice') return { tipo: 'opcoes', opcoes: opcoesDe(c) };
    if (c.type === 'num' && (c.dec || 0) > 0) return { tipo: 'decimal', min: c.min != null ? c.min : 0, max: c.max != null ? c.max : 20 };
    if (c.type === 'num') return { tipo: 'inteiro', min: Math.max(0, c.min || 0), max: c.max != null ? c.max : 300, padrao: c.padrao };
    return { tipo: 'texto' };
  }
  /** colunas que o leitor lê em cada folha: nome no molde -> { campo, rotulo, spec } */
  function colunasDaLeitura(pid) {
    const p = prancheta(pid); const s = setorDaPrancheta(pid);
    const nomes = operadoresDo(s.id).map((o) => o.nome);
    const pessoa = nomes.length ? { tipo: 'opcoes', opcoes: nomes } : { tipo: 'texto' };
    const molde = moldeDaFolha(pid);
    const cols = {};
    if (molde === 'pop03') {
      cols.qtd = { campo: 'qtd', rotulo: 'Quant.', spec: { tipo: 'quantidade', max: 999 }, numero: true, limiar: 0.9 };
      cols.fornecedor = { campo: 'fornecedor', rotulo: 'Fornecedor', spec: { tipo: 'texto' }, limiar: 0.95 };
      cols.operador = { campo: '_operador', rotulo: 'Operador', spec: pessoa, limiar: 0.95 };
    } else {
      p.campos.forEach((c) => { cols[c.id] = { campo: c.id, rotulo: c.labelCurto || c.label, spec: specDoCampo(c), c }; });
      cols.responsavel = { campo: '_operador', rotulo: 'Responsável', spec: pessoa, limiar: 0.95 };
    }
    return cols;
  }
  const minutosDoDia = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return ((h * 60 + m) - C.inicioDoDia * 60 + 1440) % 1440; };
  const semAcento = (t) => String(t || '').toUpperCase().normalize('NFD').replace(/[^A-Z0-9]/g, '');
  function parecido(a, b) {
    a = semAcento(a); b = semAcento(b);
    if (!a || !b) return 0;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return 1 - d[a.length][b.length] / Math.max(a.length, b.length);
  }

  /** transforma o que a rede leu em valores da prancheta, linha por linha (com as horas em ordem) */
  function interpretarLeitura(pid, data, bruto) {
    const p = prancheta(pid); const cols = colunasDaLeitura(pid);
    const insumo = p.tipo === 'insumo';
    let horaAnterior = null;
    const linhas = bruto.linhas.map((l) => {
      const chave = insumo ? HORAS[l.m] : l.m + 1;
      const celulas = {};
      Object.entries(cols).forEach(([nome, col]) => {
        const cel = l.celulas[nome];
        if (!cel) return;
        let lido = { valor: '', confianca: 1 };
        if (!cel.vazia) {
          let prior = null;
          if (col.spec.tipo === 'hora') {
            const ref = nome === 'fim' ? celulas.inicio && celulas.inicio.valor : horaAnterior;
            prior = (v) => {
              if (!v || !ref) return 1;
              const dt = minutosDoDia(v) - minutosDoDia(ref);
              if (dt < -5) return 0.12;
              if (dt > (nome === 'fim' ? 180 : 300)) return 0.35;
              return 1;
            };
          }
          lido = window.LeitorFolhas.lerCelula(cel.r, col.spec, prior);
          if (col.numero) { // quantidade: pega o número escrito (160, 188,8)
            const m = String(lido.valor).replace(',', '.').match(/\d+(\.\d+)?/);
            lido = { valor: m ? m[0] : '', confianca: m ? lido.confianca : 0 };
          }
          if (col.campo === 'fornecedor' && lido.valor) {
            const lista = listaDaUsina('fornecedores');
            const melhor = lista.map((f) => [f, parecido(f, lido.valor)]).sort((a, b) => b[1] - a[1])[0];
            if (melhor && melhor[1] >= 0.6) lido = { valor: melhor[0], confianca: Math.min(1, lido.confianca + 0.2) };
          }
        }
        celulas[nome] = { valor: lido.valor, confianca: lido.confianca, alternativas: lido.alternativas || [], imagem: cel.imagem, tinta: !cel.vazia };
        if (col.spec.tipo === 'hora' && nome !== 'fim' && lido.valor) horaAnterior = lido.valor;
        if (nome === 'fim' && lido.valor) horaAnterior = lido.valor;
      });
      return { chave, celulas, riscos: Object.fromEntries(Object.keys(cols).map((n) => [n, !!(l.celulas[n] && l.celulas[n].risco)])) };
    });
    // coluna riscada de cima a baixo (sem valor): as pontas do risco não são o número 1
    linhas.forEach((l, m) => Object.keys(cols).forEach((nome) => {
      const c = l.celulas[nome];
      if (!c || !['1', '11'].includes(String(c.valor))) return;
      const vizinho = [linhas[m - 1], linhas[m + 1]].some((x) => x && x.riscos[nome]);
      if (vizinho) Object.assign(c, { valor: '', confianca: 1, alternativas: [] });
    }));
    linhas.forEach((l) => {
      l.temValor = Object.values(l.celulas).some((c) => c.valor !== '' && c.valor != null);
      l.existe = !!pegar(data, pid, l.chave);
      l.incluir = l.temValor && !l.existe;
    });
    return { pid, data, colunas: cols, linhas };
  }

  function escolherFolhaParaLer(data) {
    const lista = folhasQueLeio();
    if (!lista.length) return toast('Nenhuma folha com leitura disponível', 'erro');
    return abrirModal(`<h3>Qual folha vai ler?</h3><p class="dica">Tire a foto com a folha inteira, reta e bem iluminada. Folha do dia ${fmtData(data)}.</p>
      <div class="escolhas lista-folhas">${lista.map((x) => { const p = prancheta(x.pid); return `<button data-k="${x.pid}"><span class="escolha-ico">${ico(x.setor.icone)}</span><b>${esc(p.nome)}</b><small>${esc(x.setor.nome)} · ${esc(p.codigo)}</small></button>`; }).join('')}</div>
      <div class="acoes-modal um"><button class="btn" data-k="x">Cancelar</button></div>`,
    (k, b, fechar) => fechar(k === 'x' ? undefined : k), { classe: 'largo' });
  }
  function pedirFoto(camera) {
    return new Promise((ok) => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      if (camera) inp.setAttribute('capture', 'environment');
      inp.onchange = () => ok(inp.files && inp.files[0] ? inp.files[0] : null);
      inp.click();
    });
  }
  async function comecarLeitura(data) {
    const pid = await escolherFolhaParaLer(data);
    if (!pid) return;
    const como = await abrirModal(`<h3>Foto da folha</h3><p class="dica">${esc(prancheta(pid).nome)} de ${fmtData(data)}</p>
      <div class="escolhas"><button data-k="camera"><span class="escolha-ico">${ico('camera')}</span><b>Tirar foto agora</b><small>Abre a câmera do tablet</small></button>
      <button data-k="galeria"><span class="escolha-ico">${ico('pasta')}</span><b>Escolher uma foto</b><small>Foto que já está no aparelho</small></button></div>
      <div class="acoes-modal um"><button class="btn" data-k="x">Cancelar</button></div>`, (k, b, fechar) => fechar(k === 'x' ? undefined : k), { classe: 'largo' });
    if (!como) return;
    const arquivo = await pedirFoto(como === 'camera');
    if (!arquivo) return;
    return lerFolhaDeArquivo(pid, data, arquivo);
  }
  async function lerFolhaDeArquivo(pid, data, arquivo) {
    const v = { tela: 'leitura', pid, data, fase: 'lendo', texto: 'Preparando o leitor', foto: URL.createObjectURL(arquivo) };
    ir(v);
    try {
      const molde = moldeDaFolha(pid);
      const bruto = await window.LeitorFolhas.lerFoto(arquivo, molde, colunasDaLeitura(pid), (t) => {
        v.texto = t;
        const el = document.getElementById('texto-leitura'); if (el) el.textContent = t;
      });
      v.texto = 'Conferindo as horas e os valores';
      const el = document.getElementById('texto-leitura'); if (el) el.textContent = v.texto;
      await new Promise((ok) => setTimeout(ok, 20));
      v.leitura = interpretarLeitura(pid, data, bruto);
      v.fase = 'revisar';
    } catch (e) {
      v.fase = 'erro'; v.texto = (e && e.message) || 'Não consegui ler a foto';
    }
    if (view() === v) render(true);
  }

  const LIMIAR_CONFERIR = 0.8;
  function textoDoValor(col, valor) {
    if (valor === '' || valor == null) return '';
    if (col.spec.tipo === 'decimal' || col.numero) return fmtNum(valor);
    return String(valor);
  }
  function telaLeitura(v) {
    const p = prancheta(v.pid);
    if (v.fase === 'lendo' || v.fase === 'erro') {
      const erro = v.fase === 'erro';
      return `${cabecalho('Ler folha de papel', `${p.nome} · ${fmtData(v.data)}`, !erro ? false : true)}
        <main><div class="preparo">
          <div class="preparo-cab">
            <span class="preparo-ico ${erro ? 'erro' : 'girando'}">${ico(erro ? 'alerta' : 'camera')}</span>
            <div><h1>${erro ? 'Não deu para ler' : 'Lendo a folha'}</h1><p id="texto-leitura">${esc(v.texto || '')}</p></div>
            ${erro ? `<div class="preparo-botoes"><button class="btn primario" data-a="ler-folha">${ico('camera')} Tirar outra foto</button></div>` : ''}
          </div>
          ${v.foto ? `<img class="foto-leitura" src="${v.foto}" alt="Foto da folha">` : ''}
          <p class="sub">${erro ? 'Dicas: folha inteira na foto, sem dobra, sem sombra forte e com o celular reto em cima da folha.' : 'Tudo acontece neste aparelho, sem internet. Leva alguns segundos.'}</p>
        </div></main>`;
    }
    const L = v.leitura; const cols = Object.entries(L.colunas);
    const emDuvida = (nome, c) => c && c.tinta && c.confianca < ((L.colunas[nome] && L.colunas[nome].limiar) || LIMIAR_CONFERIR);
    const duvidas = L.linhas.reduce((s, l) => s + (l.temValor ? Object.entries(l.celulas).filter(([nome, c]) => emDuvida(nome, c)).length : 0), 0);
    const incluidas = L.linhas.filter((l) => l.incluir).length;
    const visiveis = L.linhas.map((l, i) => [l, i]).filter(([l]) => l.temValor || l.existe);
    return `${cabecalho('Conferir a leitura', `${p.nome} · ${fmtData(v.data)}`, true, `<button class="atalho" data-a="ler-folha">${ico('camera')}<span>Outra foto</span></button>`)}
      <main class="leitura">
        <div class="aviso-leitura ${duvidas ? 'duvida' : 'ok'}">${ico(duvidas ? 'alerta' : 'certo')}
          <span>${duvidas ? `<b>${contar(duvidas, 'valor', 'valores')} em amarelo para conferir.</b> Toque no valor para corrigir.` : '<b>Leitura sem dúvidas.</b> Mesmo assim, confira antes de salvar.'} A foto de cada célula aparece em cima do valor lido.</span></div>
        ${visiveis.length ? `<div class="tabela-leitura"><table>
          <thead><tr><th class="inc">Salvar</th><th>${p.tipo === 'insumo' ? 'Hora' : 'Nº'}</th>${cols.map(([, col]) => `<th>${esc(col.rotulo)}</th>`).join('')}</tr></thead>
          <tbody>${visiveis.map(([l, i]) => `<tr class="${l.incluir ? '' : 'fora'}">
            <td class="inc"><button class="marca-linha ${l.incluir ? 'sel' : ''}" data-a="leitura-linha" data-i="${i}" aria-label="Salvar esta linha">${l.incluir ? ico('certo') : ''}</button></td>
            <td class="chave"><b>${p.tipo === 'insumo' ? rotuloHoraPapel(l.chave) : l.chave}</b>${l.existe ? '<small>já anotada</small>' : ''}</td>
            ${cols.map(([nome, col]) => { const c = l.celulas[nome] || { valor: '', confianca: 1 }; const duv = emDuvida(nome, c);
              return `<td><button class="cel-leitura ${duv ? 'duvida' : ''} ${c.valor === '' ? 'vazia' : ''}" data-a="leitura-cel" data-i="${i}" data-c="${nome}" data-conf="${Math.round((c.confianca || 0) * 100)}">
                ${c.imagem ? `<img src="${c.imagem}" alt="">` : ''}<b>${esc(textoDoValor(col, c.valor)) || '&nbsp;'}</b></button></td>`; }).join('')}
          </tr>`).join('')}</tbody></table></div>` : '<div class="tela-aviso"><h1>Nada escrito nesta folha</h1><p>Não achei valores anotados. Confira se escolheu a folha certa ou tire outra foto.</p></div>'}
      </main>
      <div class="rodape"><button class="btn" data-a="voltar">Cancelar</button><button class="btn primario" data-a="leitura-salvar" ${incluidas ? '' : 'disabled'}>${ico('certo')} Salvar ${contar(incluidas, 'linha', 'linhas')}</button></div>`;
  }

  /** corrigir um valor: mostra a foto da célula grande e deixa digitar ou escolher */
  async function corrigirCelula(v, i, nome) {
    const L = v.leitura; const linha = L.linhas[i]; const col = L.colunas[nome]; const cel = linha.celulas[nome];
    const tipo = col.spec.tipo;
    let texto = textoDoValor(col, cel.valor);
    const alternativas = (cel.alternativas || []).filter((a) => a.valor !== '' && a.valor !== cel.valor).slice(0, 3);
    const teclado = tipo === 'opcoes'
      ? `<div class="escolhas">${col.spec.opcoes.map((o) => `<button data-k="op:${esc(o)}" class="${o === cel.valor ? 'sel' : ''}"><b>${esc(o)}</b></button>`).join('')}</div>`
      : tipo === 'texto' && !col.numero
        ? '<input type="text" id="txt-leitura" maxlength="60">'
        : `<div class="teclas">${[7, 8, 9, 4, 5, 6, 1, 2, 3].map((n) => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="${tipo === 'hora' ? ':' : ','}">${tipo === 'hora' ? ':' : ','}</button><button data-k="0">0</button><button data-k="b">${ico('apagar')}</button></div>`;
    const resultado = await abrirModal(`<h3>${esc(col.rotulo)} · ${linha.chave}</h3>
      ${cel.imagem ? `<img class="celula-grande" src="${cel.imagem}" alt="Foto da célula">` : ''}
      ${tipo !== 'opcoes' ? `<div class="visor">${esc(texto) || '<span class="apagado">vazio</span>'}</div>` : ''}
      ${alternativas.length ? `<p class="dica">Pode ser: ${alternativas.map((a) => `<button class="btn pequeno" data-k="alt:${esc(a.valor)}">${esc(textoDoValor(col, a.valor))}</button>`).join(' ')}</p>` : ''}
      ${teclado}
      <div class="acoes-modal"><button class="btn" data-k="vazio">Deixar vazio</button><button class="btn primario" data-k="ok">Pronto</button></div>`,
    (k, b, fechar, fundo) => {
      const visor = fundo.querySelector('.visor');
      const mostrar = () => { if (visor) visor.innerHTML = esc(texto) || '<span class="apagado">vazio</span>'; };
      if (k.startsWith('op:')) return fechar({ valor: k.slice(3) });
      if (k.startsWith('alt:')) return fechar({ valor: k.slice(4) });
      if (k === 'vazio') return fechar({ valor: '' });
      if (k === 'ok') {
        const inp = fundo.querySelector('#txt-leitura');
        return fechar({ valor: inp ? inp.value.trim().toUpperCase() : texto });
      }
      if (k === 'b') { texto = texto.slice(0, -1); return mostrar(); }
      if (/^[0-9:,]$/.test(k) && texto.length < 8) { texto += k; return mostrar(); }
    }, { classe: 'largo', aoAbrir: (fundo) => { const inp = fundo.querySelector('#txt-leitura'); if (inp) { inp.value = cel.valor || ''; inp.focus(); } } });
    if (!resultado) return;
    let valor = resultado.valor;
    if (valor && tipo === 'hora') {
      const d = valor.replace(/\D/g, '');
      if (d.length < 3) return toast('Hora incompleta', 'erro');
      const h = Number(d.slice(0, -2)), m = Number(d.slice(-2));
      if (h > 23 || m > 59) return toast('Hora inválida', 'erro');
      valor = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    } else if (valor && (tipo === 'decimal' || tipo === 'inteiro' || col.numero)) {
      valor = valor.replace(',', '.');
      if (!/^\d+(\.\d+)?$/.test(valor)) return toast('Número inválido', 'erro');
    }
    linha.celulas[nome] = Object.assign({}, cel, { valor, confianca: 1 });
    linha.temValor = Object.values(linha.celulas).some((c) => c.valor !== '');
    if (linha.temValor && !linha.existe) linha.incluir = true;
    render();
  }

  function salvarLeitura(v) {
    const L = v.leitura; const p = prancheta(L.pid);
    let n = 0;
    L.linhas.forEach((l) => {
      if (!l.incluir) return;
      const valores = {}; let operador = '';
      Object.entries(L.colunas).forEach(([nome, col]) => {
        const c = l.celulas[nome]; if (!c || c.valor === '' || c.valor == null) return;
        if (col.campo === '_operador') operador = c.valor;
        else valores[col.campo] = String(c.valor);
      });
      if (p.tipo === 'insumo' && valores.qtd) valores.unidade = p.unidade;
      if (!Object.keys(valores).length) return;
      gravar(L.data, L.pid, l.chave, valores, { operador: operador || 'Lido da folha', origem: 'foto' });
      n++;
    });
    toast(`${contar(n, 'linha salva', 'linhas salvas')} da folha de papel`);
    ir({ tela: 'prancheta', pid: L.pid, data: L.data, monitor: true }, true);
  }

  /* =========================================================
   * Configurações da usina (tablet chefe): valem para todos os aparelhos
   * ========================================================= */
  const LIMITE_NOMES = 4;
  function telaConfig(v) {
    const cs = configSistema();
    const desligadas = cs.pranchetasDesligadas || {};
    const abertos = v.abertos || {};
    const lista = (nome, rotulo) => `<div class="chips">${listaDaUsina(nome).map((x, i) => `<span class="chip-item">${esc(x)}<button data-a="lista-remove" data-lista="${nome}" data-i="${i}" aria-label="Remover ${esc(x)}">${ico('fechar')}</button></span>`).join('') || `<span class="sub" style="margin:0">Nenhum ${rotulo} cadastrado</span>`}
      <button class="btn pequeno" data-a="lista-add" data-lista="${nome}">${ico('mais')} Adicionar</button></div>`;
    return `${topo('Configurações da usina', 'Vale para todos os tablets', true)}
      <main class="config">
        <p class="sub">O que você mudar aqui chega nos tablets dos setores em alguns segundos.</p>
        <div class="config-grade">
          <section class="bloco">
            <h2>${ico('enviar')} Enviar para o escritório</h2>
            <p class="sub">O botão "Enviar para o escritório" manda direto para o WhatsApp. Sem número, usa o e-mail.</p>
            <div class="linha-config"><span class="escolha-ico">${ico('whatsapp')}</span><div><b>WhatsApp</b><small>${esc(cs.whatsapp ? formatarTelefone(cs.whatsapp) : 'não cadastrado')}</small></div>
              <button class="btn pequeno" data-a="contato" data-campo="whatsapp">${cs.whatsapp ? 'Trocar' : 'Cadastrar'}</button></div>
            <div class="linha-config"><span class="escolha-ico">${ico('email')}</span><div><b>E-mail</b><small>${esc(cs.email || 'não cadastrado')}</small></div>
              <button class="btn pequeno" data-a="contato" data-campo="email">${cs.email ? 'Trocar' : 'Cadastrar'}</button></div>
          </section>
          <section class="bloco" id="bloco-base44">
            <h2>${ico('escritorio')} Totais do dia no Base44</h2>
            ${htmlBase44()}
          </section>
          <section class="bloco">
            <h2>${ico('balanca')} Listas do ralo</h2>
            <h3>Tipos de produto</h3>${lista('produtos', 'produto')}
            <h3 style="margin-top:14px">Fornecedores</h3>${lista('fornecedores', 'fornecedor')}
          </section>
          <section class="bloco">
            <h2>${ico('wifi')} Aparelhos conectados</h2>
            ${htmlAparelhos()}
            <div class="linha-botoes"><button class="btn pequeno" data-a="ver-erros">${ico('alerta')} Ver erros dos aparelhos</button></div>
          </section>
          <section class="bloco">
            <h2>${ico('lixeira')} Apagar todos os dados do sistema</h2>
            <p class="sub" style="margin:0 0 10px">Apaga as anotações de todos os setores, na central e em todos os tablets. Operadores, senhas, contatos e listas continuam. Uma cópia fica em BackupUsina. Pede a senha do programador.</p>
            <div class="linha-botoes"><button class="btn pequeno perigo" data-a="zerar-tudo">${ico('lixeira')} Apagar todos os dados do sistema</button></div>
          </section>
        </div>
        <h2 style="margin-top:8px">Setores</h2>
        <div class="config-grade">${todosSetores.map((s) => {
          const ligado = setorAtivo(s.id);
          const off = desligadas[s.id] || [];
          const ops = operadoresDo(s.id);
          const aberto = abertos[s.id];
          const visiveis = aberto ? ops : ops.slice(0, LIMITE_NOMES);
          return `<section class="bloco setor-config ${ligado ? '' : 'desligado'}">
            <div class="setor-config-cab"><span class="desenho">${ico(s.icone)}</span><h2>${esc(s.nome)}</h2>
              <button class="interruptor ${ligado ? 'ligado' : ''}" data-a="setor-liga" data-id="${s.id}" aria-label="${ligado ? 'Desligar' : 'Ligar'} ${esc(s.nome)}"><i></i><span>${ligado ? 'Ligado' : 'Desligado'}</span></button></div>
            ${ligado ? `<h3>Pranchetas</h3>
              <div class="chips">${s.pranchetas.map((pid) => {
                const on = off.indexOf(pid) < 0;
                return `<button class="chip-liga ${on ? 'sel' : ''}" data-a="prancheta-liga" data-setor="${s.id}" data-id="${pid}">${on ? ico('certo') : ico('fechar')} ${esc(prancheta(pid).nome)}</button>`;
              }).join('')}</div>
              <h3 style="margin-top:14px">Operadores <small>${ops.length}</small></h3>
              <div class="pessoas">${visiveis.map((o) => {
                const i = ops.indexOf(o);
                return `<div><span class="nome">${ico('pessoa')} <b>${esc(o.nome)}</b><small class="${o.senha ? '' : 'sem-senha'}">${o.senha ? 'com senha' : 'sem senha'}</small></span>
                <span class="acoes"><button class="btn pequeno" data-a="op-senha" data-setor="${s.id}" data-i="${i}">Senha</button>
                <button class="btn pequeno perigo" data-a="op-remove" data-setor="${s.id}" data-i="${i}" aria-label="Remover ${esc(o.nome)}">${ico('lixeira')}</button></span></div>`;
              }).join('') || '<div class="vazio">Nenhum operador cadastrado</div>'}</div>
              <div class="linha-botoes">
                ${ops.length > LIMITE_NOMES ? `<button class="btn pequeno" data-a="mostrar-mais" data-setor="${s.id}">${aberto ? 'Mostrar menos' : `Mostrar mais (${ops.length - LIMITE_NOMES})`}</button>` : ''}
                <button class="btn pequeno" data-a="op-add" data-setor="${s.id}">${ico('mais')} Cadastrar operador</button></div>` : '<p class="sub" style="margin:8px 0 0">Setor desligado. O tablet dele mostra um aviso e não deixa anotar.</p>'}
          </section>`;
        }).join('')}</div>
      </main>`;
  }
  function htmlAparelhos() {
    const st = sync.status;
    if (cfg.demo) return '<p class="sub" style="margin:0">Na demonstração não há outros aparelhos.</p>';
    const lista = st && st.aparelhos ? st.aparelhos.slice().sort((a, b) => a.minutos - b.minutos) : [];
    if (!lista.length) return '<p class="sub" style="margin:0">Nenhum aparelho mandou nada desde que a central ligou.</p>';
    return `<div class="aparelhos">${lista.map((a) => {
      const nome = a.papel === 'central' ? nomeDoChefe() : (setorPorId(a.papel) || {}).nome || 'sem setor';
      const velho = a.versao && a.versao !== VERSAO;
      return `<div class="aparelho"><span class="conexao ${a.online ? 'ok' : 'off'}"><i></i>${a.online ? 'Ligado' : `Sem sinal há ${a.minutos} min`}</span>
        <b>${esc(nome)}</b><small>${esc(a.operador || 'ninguém no turno')} · ${esc(a.id)} · versão ${esc(a.versao || 'antiga')}${velho ? ' (atualizar)' : ''}</small></div>`;
    }).join('')}</div>`;
  }
  async function verErros() {
    let lista = [];
    try {
      const r = await buscar('api/erros', {}, 6000);
      lista = r.ok ? (await r.json()).erros || [] : [];
    } catch (e) { return toast('Não consegui falar com a central', 'erro'); }
    const quando = (ms) => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    await abrirModal(`<h3>Erros dos aparelhos</h3>
      <p class="dica">${lista.length ? `Os ${Math.min(lista.length, 40)} mais recentes. Ficam guardados em ServidorUsina, no arquivo erros.log.` : 'Nenhum erro registrado. Tudo certo.'}</p>
      <div class="lista-erros">${lista.slice(-40).reverse().map((e) => `<div><b>${esc(quando(e.quando || e.recebidoEm))} · ${esc((setorPorId(e.papel) || {}).nome || e.papel || '')} · ${esc(e.aparelho || '')}</b><span>${esc(e.msg)}</span><small>tela ${esc(e.tela || '-')} · versão ${esc(e.versao || '-')}</small></div>`).join('')}</div>
      <div class="acoes-modal um"><button class="btn primario" data-k="x">Fechar</button></div>`, (k, b, fechar) => fechar(), { classe: 'largo' });
  }
  function mudarConfigLista(tipo, setorId, pid) {
    const cs = configSistema();
    if (tipo === 'setor') {
      const lista = [...(cs.setoresDesligados || [])];
      const i = lista.indexOf(setorId);
      if (i < 0) lista.push(setorId); else lista.splice(i, 1);
      salvarConfigSistema({ setoresDesligados: lista });
    } else {
      const mapa = Object.assign({}, cs.pranchetasDesligadas || {});
      const lista = [...(mapa[setorId] || [])];
      const i = lista.indexOf(pid);
      if (i < 0) lista.push(pid); else lista.splice(i, 1);
      mapa[setorId] = lista;
      salvarConfigSistema({ pranchetasDesligadas: mapa });
    }
    render();
  }
  const telefoneLimpo = (t) => String(t || '').replace(/\D/g, '');
  const telefoneInternacional = (t) => { const n = telefoneLimpo(t); return n.length <= 11 ? '55' + n : n; };
  function formatarTelefone(t) {
    const n = telefoneLimpo(t);
    return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n.length === 10 ? `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}` : n;
  }

  /* =========================================================
   * Exportar: Excel (.xlsx), XML e compartilhar
   * ========================================================= */
  /* Folhas iguais ao papel: o mesmo molde (modelos.js) gera o Excel, o XML e a impressão */
  let LOGO_PNG = null;
  fetch('icons/logo.png').then((r) => r.arrayBuffer()).then((b) => { LOGO_PNG = new Uint8Array(b); }).catch(() => {});
  let modelosPapel = null;
  const papel = () => modelosPapel || (modelosPapel = window.ModelosPapel.montar({
    C, prancheta, setorDaPrancheta, listar, pegar, fmtData, fmtNum, rotuloHoraPapel, HORAS, linhasDeHora, totalInsumo, extrasOperador, somarDias,
  }));
  function planilhaDaPrancheta(pid, data) {
    return window.ModelosPapel.paraPlanilha(papel().folha(pid, data));
  }
  function gerarXml(data, pids) {
    const X = window.xmlEscape;
    const partes = ['<?xml version="1.0" encoding="UTF-8"?>', `<pranchetas empresa="${X(C.empresa)}" data="${data}" gerado="${new Date().toISOString()}">`];
    pids.forEach((pid) => partes.push(window.ModelosPapel.paraXml(papel().folha(pid, data), data, X)));
    partes.push('</pranchetas>');
    return new Blob([partes.join('\n')], { type: 'application/xml' });
  }
  /** Imprime as folhas do dia iguais ao papel (no Android abre a impressão do sistema, que também salva em PDF). */
  async function imprimirFolhas(data, setorIds) {
    const pids = folhasDosSetores(setorIds);
    let area = document.getElementById('impressao');
    if (!area) { area = document.createElement('div'); area.id = 'impressao'; document.body.appendChild(area); }
    area.innerHTML = pids.map((pid) => window.ModelosPapel.paraHtml(papel().folha(pid, data), 'icons/logo.png', fmtNum)).join('');
    // a primeira página já nasce no tamanho da primeira folha (sem página em branco antes de uma folha deitada)
    const primeira = area.querySelector('.folha-imp');
    area.style.page = document.body.style.page = primeira && primeira.classList.contains('paisagem') ? 'paisagem' : 'retrato';
    document.body.classList.add('imprimindo');
    await Promise.all([...area.querySelectorAll('img')].map((im) => (im.complete ? 0 : new Promise((ok) => { im.onload = ok; im.onerror = ok; }))));
    if (NO_APK && pluginCentral && pluginCentral.imprimir) {
      // a folha fica escondida na tela; o Android desenha a impressão quando a pessoa escolhe a impressora
      try { await pluginCentral.imprimir({ nome: `Pranchetas ${fmtData(data)}` }); } catch (e) { toast('Não consegui abrir a impressão', 'erro'); }
      return;
    }
    window.addEventListener('afterprint', () => { document.body.classList.remove('imprimindo'); area.innerHTML = ''; }, { once: true });
    window.print();
  }
  const folhasDosSetores = (setorIds) => setores().filter((s) => setorIds.includes(s.id)).flatMap((s) => s.pranchetas.flatMap(folhasDe));
  const MIME = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xml: 'application/xml' };
  function gerarArquivo(formato, data, setorIds) {
    const pids = folhasDosSetores(setorIds);
    // o relatório do dia (todos os setores) tem sempre o mesmo nome: um por dia; só alguns setores ganham o nome deles
    const parcial = setorIds.length < setores().length;
    const nome = `Pranchetas_${data}${parcial ? '_' + setorIds.join('-') : ''}`;
    if (formato === 'xml') return new File([gerarXml(data, pids)], nome + '.xml', { type: MIME.xml });
    return new File([window.criarXlsx(pids.map((pid) => planilhaDaPrancheta(pid, data)), LOGO_PNG)], nome + '.xlsx', { type: MIME.xlsx });
  }
  const paraBase64 = (arquivo) => new Promise((ok, erro) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(',')[1]);
    fr.onerror = erro;
    fr.readAsDataURL(arquivo);
  });

  /** Guarda o arquivo na pasta RelatoriosUsina do servidor. */
  async function guardarNaCentral(data, arquivos) {
    if (cfg.demo || !cfg.chave) return false;
    try {
      for (const f of arquivos) {
        const r = await postJson('api/relatorio', { data, nome: f.name, base64: await paraBase64(f) }, 30000);
        if (!r.ok) return false;
      }
      return true;
    } catch (e) { return false; }
  }

  /** Resumo em texto do dia, para mandar numa mensagem */
  function resumoDoDia(data, setorIds) {
    const lista = setores().filter((s) => !setorIds || setorIds.includes(s.id));
    const linhas = ['*PRANCHETAS UBIRÁLCOOL*', `Folha de ${fmtData(data)} (${diaSemana(data)}), das ${pad2(C.inicioDoDia)}:00 às ${pad2((C.inicioDoDia + 23) % 24)}:59`];
    lista.forEach((s) => {
      linhas.push('', `*${s.nome.toUpperCase()}*`);
      s.pranchetas.forEach((pid) => linhas.push(`• ${prancheta(pid).nome}: ${resumoPrancheta(pid, data).texto}`));
    });
    // total do dia de cada insumo: o que o escritório lança no sistema dele
    const insumos = lista.flatMap((s) => s.pranchetas.flatMap(folhasDe)).filter((pid) => prancheta(pid).tipo === 'insumo');
    if (insumos.length) {
      linhas.push('', '*TOTAIS DO DIA (insumos)*');
      insumos.forEach((pid) => linhas.push(`• ${prancheta(pid).nome}: ${totalInsumo(linhasDeHora(listar(data, pid))) || 'nada adicionado'}`));
    }
    return linhas.join('\n');
  }

  /* =========================================================
   * Totais do dia no Base44 (o sistema do escritório onde o Lucas lança os totais)
   * Quando o dia fecha (07:00), o tablet chefe soma cada insumo e a central manda pela internet.
   * Se alguém corrigir a folha depois, os totais mudam e vão de novo. O endereço e o segredo ficam só na central.
   * ========================================================= */
  const DIAS_BASE44 = 7;
  let base44Info = null;       // estado completo (endereço, erros), buscado ao abrir as configurações
  const base44Avisado = {};    // dia -> já avisou do erro (avisa uma vez só)
  let base44Ocupado = false;
  let base44Visto = 0;
  function totaisDoDia(data) {
    const itens = [];
    setores().forEach((s) => s.pranchetas.flatMap(folhasDe).filter((pid) => prancheta(pid).tipo === 'insumo').forEach((pid) => {
      const p = prancheta(pid);
      const soma = {};
      linhasDeHora(listar(data, pid)).forEach((r) => {
        const n = parseFloat(r.valores.qtd);
        if (isNaN(n)) return;
        const u = r.valores.unidade || p.unidade || '';
        soma[u] = (soma[u] || 0) + n;
      });
      const unidades = Object.keys(soma);
      if (!unidades.length) itens.push({ setor: s.nome, insumo: p.nome, folha: pid, quantidade: 0, unidade: p.unidade || '' });
      unidades.forEach((u) => itens.push({ setor: s.nome, insumo: p.nome, folha: pid, quantidade: Math.round(soma[u] * 100) / 100, unidade: u }));
    }));
    return itens;
  }
  async function enviarBase44(data, forcar) {
    await buscarDia(data);
    const itens = totaisDoDia(data);
    const hash = Cifra.hex(Cifra.sha256(Cifra.utf8(JSON.stringify({ data, itens })))).slice(0, 16);
    const dados = { origem: 'Pranchetas Ubirálcool', data, dataBr: fmtData(data), itens, resumo: resumoDoDia(data), enviadoEm: new Date().toISOString() };
    try {
      const r = await postJson('api/base44', { acao: 'enviar', data, hash, dados, forcar: !!forcar }, 30000);
      const d = await r.json().catch(() => ({}));
      return r.ok ? d : { ok: false, erro: d.erro || 'A central recusou' };
    } catch (e) { return { ok: false, erro: 'Não consegui falar com a central' }; }
  }
  /** Dias fechados que ainda não foram (ou mudaram depois que foram). Só dias depois de ligar o envio:
      os anteriores o escritório já lançou à mão (dá para mandar um por um nas configurações). */
  function diasParaBase44(b) {
    const hoje = dataProducao();
    const comDados = new Set();
    Object.values(registros).forEach((r) => { if (!r.apagado && /^\d{4}-\d{2}-\d{2}$/.test(r.data)) comDados.add(r.data); });
    const dias = [];
    for (let i = DIAS_BASE44; i >= 1; i--) {
      const d = somarDias(hoje, -i);
      if (b.desde && d < b.desde) continue;
      if (comDados.has(d)) dias.push(d);
    }
    return dias;
  }
  async function verificarBase44() {
    const b = sync.status && sync.status.base44;
    if (!ehCentral() || cfg.demo || !b || !b.ligado || base44Ocupado || Date.now() - base44Visto < 60000) return;
    base44Visto = Date.now();
    base44Ocupado = true;
    try {
      for (const d of diasParaBase44(b)) {
        const e = (b.enviados || {})[d];
        const itens = totaisDoDia(d);
        const hash = Cifra.hex(Cifra.sha256(Cifra.utf8(JSON.stringify({ data: d, itens })))).slice(0, 16);
        if (e && e.ok && e.hash === hash) continue;
        if (e && !e.ok && Date.now() - e.em < 10 * 60000) continue; // deu erro há pouco: tenta de novo daqui a 10 minutos
        const r = await enviarBase44(d);
        if (!r.ok && !base44Avisado[d]) { base44Avisado[d] = true; toast(`Não consegui mandar os totais de ${fmtData(d)} para o Base44: ${r.erro}. Tento de novo a cada 10 minutos.`, 'erro'); }
        sync.statusJson = ''; // pega o estado novo na próxima sincronização
        break; // um dia por vez, para não pesar
      }
    } finally { base44Ocupado = false; }
  }
  async function carregarBase44() {
    try {
      const r = await postJson('api/base44', { acao: 'estado' }, 8000);
      if (r.ok) { base44Info = await r.json(); if (sync.status) sync.status.base44 = Object.assign({}, base44Info); if (view().tela === 'config' && podeRedesenhar()) render(); }
    } catch (e) { /* mostra o que veio na sincronização */ }
  }
  /** O endereço inteiro não cabe no celular: mostra o começo e o fim do nome do site (o inteiro aparece ao tocar em Trocar). */
  function enderecoCurto(u) {
    let host = u;
    try { host = new URL(u).hostname; } catch (e) { /* mostra como veio */ }
    return host.length <= 20 ? host : `${host.slice(0, 10)}…${host.split('.').slice(-2).join('.')}`;
  }
  function htmlBase44() {
    // o que muda (dias enviados) vem da sincronização; o endereço só vem ao abrir as configurações
    const b = Object.assign({ enviados: {} }, base44Info, sync.status && sync.status.base44);
    if (base44Info) b.url = base44Info.url;
    if (cfg.demo && !base44Info) return '<p class="sub" style="margin:0">Na demonstração não há central para mandar os totais.</p>';
    const hoje = dataProducao();
    const quando = (ms) => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');
    const dias = [];
    for (let i = 1; i <= DIAS_BASE44; i++) dias.push(somarDias(hoje, -i));
    const linhas = dias.map((d) => {
      const e = (b.enviados || {})[d];
      const texto = !e ? (b.desde && d >= b.desde ? 'Ainda não foi' : 'Não enviado (lançado à mão)') : e.ok ? `Enviado ${quando(e.em)}` : `Erro: ${e.erro || 'não foi'}`;
      return `<div class="linha-config base44-dia ${e ? (e.ok ? 'ok' : 'erro') : ''}"><div><b>${fmtData(d).slice(0, 5)} <small class="dia-semana">${esc(diaSemana(d))}</small></b><small>${esc(texto)}</small></div>
        <button class="btn pequeno" data-a="base44-enviar" data-data="${d}" ${b.ligado ? '' : 'disabled'}>${e && e.ok ? 'De novo' : 'Enviar'}</button></div>`;
    }).join('');
    return `<p class="sub" style="margin:0 0 6px">Quando o dia fecha, às ${pad2(C.inicioDoDia)}:00, os totais de cada insumo vão sozinhos para o sistema do escritório. Se alguém corrigir a folha depois, vão de novo. Precisa de internet no servidor da usina.</p>
      <div class="linha-config"><span class="escolha-ico">${ico('escritorio')}</span><div><b>Endereço no Base44</b><small>${esc(b.url ? enderecoCurto(b.url) : b.ligado ? 'cadastrado' : 'não cadastrado')}</small></div>
        <button class="btn pequeno" data-a="base44-url">${b.ligado ? 'Trocar' : 'Cadastrar'}</button></div>
      <div class="linha-config"><span class="escolha-ico">${ico('codigo')}</span><div><b>Segredo</b><small>${b.temSegredo ? 'cadastrado (não aparece aqui)' : 'não cadastrado'}</small></div>
        <button class="btn pequeno" data-a="base44-segredo">${b.temSegredo ? 'Trocar' : 'Cadastrar'}</button></div>
      ${b.ligado ? `<h3 style="margin-top:12px">Últimos dias</h3>${linhas}` : ''}`;
  }

  /**
   * Compartilhar. destino: escritorio | whatsapp | email | outros | baixar
   * No aplicativo o arquivo vai direto para o WhatsApp ou para o e-mail.
   * No navegador usa o que o aparelho permitir.
   */
  async function compartilhar(destino, data, arquivoPronto) {
    const cs = configSistema();
    let alvo = destino;
    if (destino === 'escritorio') {
      alvo = cs.whatsapp ? 'whatsapp' : cs.email ? 'email' : '';
      if (!alvo) {
        if (await confirmar('Falta o contato do escritório', 'Cadastre o WhatsApp ou o e-mail do escritório em Configurações da usina.', 'Abrir configurações')) ir({ tela: 'config' });
        return;
      }
    }
    const nomes = { whatsapp: 'Enviar pelo WhatsApp', email: 'Enviar por e-mail', outros: 'Compartilhar com outro aplicativo', baixar: 'Guardar no servidor e no aparelho' };
    let arquivo = arquivoPronto;
    let formato = arquivo ? (/\.xml$/i.test(arquivo.name) ? 'xml' : 'xlsx') : null;
    let escolhidos = setores().map((s) => s.id);
    if (!arquivo) {
      const escolha = await escolherEnvio(destino === 'escritorio' ? `Enviar para o escritório (${alvo === 'whatsapp' ? 'WhatsApp' : 'e-mail'})` : nomes[alvo], alvo === 'whatsapp');
      if (!escolha) return;
      formato = escolha.formato; escolhidos = escolha.setores;
      await buscarDia(data); // dia antigo: as anotações vêm da central antes de montar o arquivo
      if (formato !== 'texto') arquivo = gerarArquivo(formato, data, escolhidos);
    }
    const texto = formato === 'texto' ? resumoDoDia(data, escolhidos) : `Pranchetas Ubirálcool, folha de ${fmtData(data)}`;
    const assunto = `Pranchetas Ubirálcool - ${fmtData(data)}`;
    // só o relatório com todos os setores fica guardado (um por dia, na pasta RelatoriosUsina)
    if (arquivo && !arquivoPronto && escolhidos.length === setores().length) guardarNaCentral(data, [arquivo]);

    if (alvo === 'baixar') {
      if (!arquivo) return;
      if (NO_APK && pluginCentral) {
        try { const r = await pluginCentral.guardarDocumento({ nome: arquivo.name, mime: arquivo.type, base64: await paraBase64(arquivo), data }); return toast(`Guardado em ${r.caminho}`); } catch (e) { /* segue */ }
      }
      return baixar(arquivo);
    }

    const numero = alvo === 'whatsapp' && destino === 'escritorio' ? telefoneInternacional(cs.whatsapp) : '';
    const email = alvo === 'email' && destino === 'escritorio' ? cs.email : '';

    if (NO_APK && pluginCentral) {
      try {
        await pluginCentral.compartilhar({
          destino: alvo, numero, email, assunto, texto,
          nome: arquivo ? arquivo.name : '', mime: arquivo ? arquivo.type : 'text/plain', base64: arquivo ? await paraBase64(arquivo) : '',
        });
        return;
      } catch (e) {
        toast(e && e.message ? e.message : 'Não consegui abrir o aplicativo', 'erro');
        return;
      }
    }

    // navegador
    if (!arquivo && alvo === 'whatsapp') { window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener'); return; }
    if (arquivo && navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      try { await navigator.share({ files: [arquivo], title: assunto, text: texto }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    if (arquivo) baixar(arquivo);
    if (alvo === 'whatsapp') window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto + (arquivo ? '\n(o arquivo foi baixado no aparelho, anexe na conversa)' : ''))}`, '_blank', 'noopener');
    else if (alvo === 'email') location.href = `mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto + '\n\nO arquivo foi baixado no aparelho. Anexe antes de enviar.')}`;
    else if (!arquivo) toast('Este aparelho não compartilha arquivos', 'erro');
  }
  function baixar(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast(`Arquivo ${file.name} baixado`);
  }
  /** Enviar ou imprimir as folhas de um dia (o arquivo é montado na hora, com as últimas correções). */
  async function enviarDia(data) {
    const destino = await abrirModal(`<h3>Folhas de ${fmtData(data)}</h3><p class="dica">Para onde?</p>
      <div class="escolhas">
        <button data-k="escritorio"><span class="escolha-ico">${ico('enviar')}</span><b>Escritório</b><small>Usa o WhatsApp ou o e-mail cadastrado</small></button>
        <button data-k="whatsapp"><span class="escolha-ico">${ico('whatsapp')}</span><b>WhatsApp</b><small>Escolher a conversa</small></button>
        <button data-k="email"><span class="escolha-ico">${ico('email')}</span><b>E-mail</b><small>Com o arquivo anexado</small></button>
        <button data-k="outros"><span class="escolha-ico">${ico('compartilhar')}</span><b>Outros apps</b><small>Drive, Bluetooth e outros</small></button>
        <button data-k="baixar"><span class="escolha-ico">${ico('baixar')}</span><b>Guardar</b><small>No servidor e neste aparelho</small></button>
        <button data-k="imprimir"><span class="escolha-ico">${ico('imprimir')}</span><b>Imprimir</b><small>Ou salvar em PDF</small></button>
      </div><div class="acoes-modal um"><button class="btn" data-k="x">Cancelar</button></div>`,
    (k, b, fechar) => fechar(k === 'x' ? undefined : k), { classe: 'largo' });
    if (!destino) return;
    if (destino === 'imprimir') return imprimirEscolhendo(data);
    return compartilhar(destino, data);
  }

  /* =========================================================
   * Ajustes deste aparelho (com a senha do encarregado)
   * ========================================================= */
  function telaAdmin(v) {
    const s = setorPorId(cfg.papel);
    const ops = s ? operadoresDo(s.id) : [];
    const aberto = v.abertos && s && v.abertos[s.id];
    const visiveis = aberto ? ops : ops.slice(0, LIMITE_NOMES);
    const papelAtual = ehCentral() ? nomeDoChefe() : s ? s.nome : 'não escolhido';
    return `${topo('Ajustes do aparelho', 'Protegido pela senha do encarregado', true)}
      <main class="config">
        <div class="config-grade">
          <section class="bloco">
            <h2>${ico('instalar')} Este aparelho é</h2>
            <p class="papel-atual"><span class="escolha-ico">${ico(ehCentral() ? 'escritorio' : s ? s.icone : 'ajustes')}</span><b>${esc(papelAtual)}</b></p>
            <p class="sub">Para trocar, toque em outra função:</p>
            ${gradePapeis()}
          </section>
          <section class="bloco">
            <h2>${ico('tamanho')} Tela</h2>
            <h3>Tamanho das letras e botões</h3>
            <div class="segmentos">${['menor', 'normal', 'maior'].map((x) => `<button class="${cfg.escala === x ? 'sel' : ''}" data-a="escala" data-valor="${x}">${x === 'menor' ? 'Menor' : x === 'normal' ? 'Normal' : 'Maior'}</button>`).join('')}</div>
            <h3 style="margin-top:14px">Cores</h3>
            <div class="segmentos"><button class="${cfg.tema !== 'escuro' ? 'sel' : ''}" data-a="tema-fixo" data-valor="claro">${ico('sol')} Claro</button><button class="${cfg.tema === 'escuro' ? 'sel' : ''}" data-a="tema-fixo" data-valor="escuro">${ico('lua')} Escuro</button></div>
            <h3 style="margin-top:14px">Tela cheia</h3>
            <p class="sub" style="margin:0 0 8px">Ligada, some a barra de cima com bateria e hora. Para ver a barra, arraste o dedo da borda da tela.</p>
            <div class="segmentos"><button class="${!cfg.telaCheia ? 'sel' : ''}" data-a="tela-cheia" data-valor="0">Desligada</button><button class="${cfg.telaCheia ? 'sel' : ''}" data-a="tela-cheia" data-valor="1">${ico('telaCheia')} Ligada</button></div>
            ${NO_APK ? '' : `<div class="linha-botoes"><button class="btn pequeno" data-a="instalar">${ico('instalar')} Instalar na tela inicial</button></div>`}
          </section>
          ${s ? `<section class="bloco">
            <h2>${ico('pessoas')} Operadores da ${esc(s.nome)} <small>${ops.length}</small></h2>
            <div class="pessoas">${visiveis.map((o) => {
              const i = ops.indexOf(o);
              return `<div><span class="nome">${ico('pessoa')} <b>${esc(o.nome)}</b><small class="${o.senha ? '' : 'sem-senha'}">${o.senha ? 'com senha' : 'sem senha'}</small></span>
              <span class="acoes"><button class="btn pequeno" data-a="op-senha" data-setor="${s.id}" data-i="${i}">Senha</button>
              <button class="btn pequeno perigo" data-a="op-remove" data-setor="${s.id}" data-i="${i}" aria-label="Remover ${esc(o.nome)}">${ico('lixeira')}</button></span></div>`;
            }).join('') || '<div class="vazio">Nenhum operador cadastrado</div>'}</div>
            <div class="linha-botoes">
              ${ops.length > LIMITE_NOMES ? `<button class="btn pequeno" data-a="mostrar-mais" data-setor="${s.id}">${aberto ? 'Mostrar menos' : `Mostrar mais (${ops.length - LIMITE_NOMES})`}</button>` : ''}
              <button class="btn pequeno" data-a="op-add" data-setor="${s.id}">${ico('mais')} Cadastrar operador</button></div>
          </section>` : ''}
          <section class="bloco">
            <h2>${ico('wifi')} Rede</h2>
            <dl class="kv"><dt>Situação</dt><dd><span class="conexao ${classeConexao()}"><i></i>${esc(textoConexao())}</span></dd>
              <dt>Servidor</dt><dd>${esc(cfg.demo ? 'demonstração' : centralNoTablet() ? 'este próprio aparelho' : cfg.central || location.host)}</dd>
              <dt>Código do aparelho</dt><dd>${esc(cfg.deviceId)}</dd><dt>Esperando envio</dt><dd>${pendentes()}</dd>
              <dt>Relógio</dt><dd>${esc(cfg.demo ? 'demonstração' : textoRelogio())}</dd><dt>Versão do aplicativo</dt><dd>${VERSAO}</dd></dl>
            <div class="linha-botoes">${centralNoTablet()
              ? `<button class="btn pequeno perigo" data-a="desligar-servidor">${ico('servidor')} Desligar o servidor deste aparelho</button>`
              : `${NO_APK && pluginCentral ? `<button class="btn pequeno" data-a="virar-central">${ico('servidor')} Usar este aparelho como servidor</button>` : ''}<button class="btn pequeno perigo" data-a="desconectar">${ico('wifi')} Desconectar da central</button>`}</div>
          </section>
          <section class="bloco">
            <h2>${ico('planilha')} Dados</h2>
            <p class="sub" style="margin:0 0 8px">Apagar os dados deste aparelho tira daqui as anotações e a função dele (para usar em outro setor, por exemplo). O que já foi enviado continua na central.</p>
            <div class="linha-botoes">
              <button class="btn pequeno" data-a="compartilhar" data-destino="outros">${ico('compartilhar')} Compartilhar folhas de hoje</button>
              <button class="btn pequeno" data-a="exemplo">Preencher com dados de exemplo</button>
              <button class="btn pequeno perigo" data-a="limpar-tudo">${ico('lixeira')} Apagar dados deste aparelho</button></div>
          </section>
        </div>
        <p class="autoria">Pranchetas Digitais ${VERSAO} · ${esc(AUTORIA)}</p>
      </main>`;
  }

  /* =========================================================
   * Dados de exemplo (copiados das fotos e do vídeo das pranchetas)
   * ========================================================= */
  function preencherExemplo() {
    const data = dataProducao();
    const ex = (pid, chave, valores, operador) => { if (!pegar(data, pid, chave)) gravar(data, pid, chave, valores, { operador }); };
    [['08:43', '09:00', '3.5', '4', '20', '6.0', '70', '20', 'FINI', 'Guilherme'], ['09:00', '09:18', '3.5', '4', '21', '6.0', '70', '20', 'FINI', 'Guilherme'],
      ['09:31', '09:55', '5.1', '', '17', '5.2', '70', '20', 'MASSA', 'Guilherme'], ['09:55', '10:14', '5.0', '', '18', '5.1', '70', '19', 'MASSA', 'Guilherme'],
      ['10:35', '10:55', '4.8', '2', '26', '5.0', '70', '22', 'MASSA', 'Guilherme'], ['10:55', '', '5.2', '', '19', '5.2', '70', '18', 'FINI', 'Guilherme']]
      .forEach((l, i) => ex('hid_anexo1', i + 1, { inicio: l[0], fim: l[1], phf: l[2], cal: l[3], brix: l[4], phf2: l[5], enzi: l[6], bhx: l[7], produto: l[8] }, l[9]));
    [['08:43', '6.0', '20'], ['09:00', '6.0', '20'], ['09:31', '5.2', '20'], ['09:55', '5.1', '19'], ['10:35', '5.0', '22']]
      .forEach((l, i) => ex('hid_anexo2', i + 1, { horario: l[0], sac: '4', phf: l[1], bhx: l[2], enz: '100', anti: '100' }, 'Guilherme'));
    [[8, '70', '4', '100', '100'], [9, '210', '4', '300', '300'], [10, '70', '2', '100', '100']].forEach(([h, lp, cal, sac, alc]) => {
      ex('ins_lphera', h, { qtd: lp, unidade: 'mL' }, 'Guilherme');
      ex('ins_cal', h, { qtd: cal, unidade: 'copos' }, 'Guilherme');
      ex('ins_saczyme', h, { qtd: sac, unidade: 'mL' }, 'Guilherme');
      ex('ins_alcolina', h, { qtd: alc, unidade: 'mL' }, 'Guilherme');
    });
    ex('ins_materia_prima', 9, { qtd: '160', unidade: 'kg', produto: 'MASSA' }, 'Jair');
    ex('ins_materia_prima', 10, { qtd: '188.8', unidade: 'kg', produto: 'FINI' }, 'Jair');
    ex('ins_ureia', 11, { qtd: '20', unidade: 'kg' }, 'Mateus');
    [[7, '6', '42', '02', 'OK'], [8, '6', '33', '03', ''], [9, '6', '56', '01', ''], [10, '6', '', '02', ''], [11, '6', '', '03', ''], [12, '6', '', '01', ''],
      [13, '6', '', '02', ''], [14, '6', '', '03', ''], [15, '6', '', '01', ''], [16, '6', '', '02', '']]
      .forEach((l) => ex('caldeira', l[0], { pressao: l[1], temp_agua: l[2], descarga_fundo: l[3], descarga_garrafa: l[4] }, l[0] < 16 ? 'Alberto' : 'Diego'));
    ex('caldeira', 'obs1', { texto: 'DESCARGA DE GARRAFA FEITA AS 07:00' }, 'Alberto');
    [[7, '107.3', '150', '371', '2', '93.7'], [8, '107.3', '150', '375', '2', '93.7'], [9, '107.3', '180', '800', '2', '93.9'], [10, '107.3', '180', '800', '2', '93.5'],
      [11, '107.3', '180', '900', '2', '92.9'], [12, '107.1', '180', '372', '2', '91.0'], [13, '107.0', '180', '979', '2', '93.0'], [14, '107.0', '150', '990', '2', '92.4'], [15, '107.3', '150', '981', '2', '92.6']]
      .forEach((l) => ex('destilaria', l[0], { temp_pe_a: l[1], producao: l[2], carregamento: l[3], vapor: l[4], inpm: l[5] }, 'Mateus'));
  }

  /* =========================================================
   * Toques
   * ========================================================= */
  document.addEventListener('click', (e) => {
    if (modalAberto()) return;
    const q = e.target.closest('[data-quadro]');
    if (q) {
      const a = alvos.find((x) => x.id === q.dataset.quadro);
      if (a && a.type === 'check' && ed.alvoId === a.id && !ed.oculto) { a.set(vazio(a.get()) ? 'OK' : ''); return atualizarEdicao(); }
      if (a && a.type === 'check' && vazio(a.get())) a.set('OK');
      return selecionar(q.dataset.quadro);
    }
    const t = e.target.closest('[data-ed]');
    if (t) return tecla(t.dataset.ed);
  });

  app.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]');
    if (!b || modalAberto()) return;
    const a = b.dataset.a;
    const v = view();
    switch (a) {
      case 'voltar': return voltar();
      case 'tema':
        cfg.tema = cfg.tema === 'escuro' ? 'claro' : 'escuro'; salvarCfg(); aplicarTema();
        return render();
      case 'tema-fixo': cfg.tema = b.dataset.valor; salvarCfg(); aplicarTema(); return render();
      case 'escala': cfg.escala = b.dataset.valor; salvarCfg(); ajustarEscala(); return render();
      case 'conectar': return conectar();
      case 'procurar-central': return procurarCentral();
      case 'modo-demo': cfg.demo = true; salvarCfg(); ed.alvoId = null; pilha = [telaInicial()]; return render(true);
      case 'virar-central': return prepararTabletChefe();
      case 'voltar-conectar': cfg.papel = null; salvarCfg(); pilha = [telaInicial()]; return render(true);
      case 'abrir-painel': pilha = [telaInicial()]; return render(true);
      case 'desligar-servidor': {
        if (!(await confirmar('Desligar o servidor deste aparelho?', 'Os tablets param de enviar até ele ser ligado de novo (aqui ou em outro aparelho). Nada é apagado: as anotações continuam guardadas neste aparelho.', 'Desligar', true))) return;
        try { await pluginCentral.parar(); } catch (e) { /* já estava desligado */ }
        cfg.servidor = false; cfg.chave = null; cfg.central = ''; salvarCfg();
        toast('Servidor desligado. Conecte este aparelho numa central.');
        pilha = [telaInicial()]; return render(true);
      }
      case 'tentar': await sincronizar(); if (foraDaRede()) toast('Ainda sem a central. Confira o Wi-Fi.', 'erro'); return render();
      case 'papel': {
        cfg.papel = b.dataset.id; salvarCfg();
        pilha = [telaInicial()];
        if (!ehCentral() && !operadorAtual()) pilha.push({ tela: 'operador' });
        rascunho = null; ed.alvoId = null; render(true); entrarTelaCheia(); sincronizar();
        return;
      }
      case 'trocar-operador': return ir({ tela: 'operador' });
      case 'escolher-operador': {
        const nome = b.dataset.nome;
        const op = operadorPorNome(cfg.papel, nome);
        if (op && op.senha) {
          const digitada = await pedirSenhaModal(`Senha de ${nome}`, 'Só quem sabe a senha entra com este nome.');
          if (digitada === undefined) return;
          if (embaralharSenha(nome, digitada) !== op.senha) {
            const comEncarregado = await confirmar('Senha errada', 'Se esqueceu a senha, o encarregado pode liberar com a senha dele.', 'Chamar encarregado', false);
            if (!comEncarregado) return;
            const senhaChefe = await pedirSenhaModal('Senha do encarregado', `Liberar ${nome} neste turno.`);
            if (senhaChefe !== C.pinAdmin) return toast('Senha errada', 'erro');
          }
        }
        definirOperador(nome); toast(`Bom trabalho, ${nome}`);
        if (pilha.length > 1) pilha.pop(); else pilha = [telaInicial()];
        rascunho = null; render(true);
        setTimeout(verificarAvisos, 700); // aviso guardado para esta pessoa aparece logo que ela entra
        return;
      }
      case 'admin': {
        const s = await pedirSenhaModal();
        if (s === undefined) return;
        if (s !== C.pinAdmin) return toast('Senha errada', 'erro');
        return ir({ tela: 'admin' });
      }
      case 'abrir-prancheta': return ir({ tela: 'prancheta', pid: b.dataset.id });
      // ao trocar de prancheta, continua no modo que a pessoa estava (anotando ou monitorando)
      case 'aba': {
        const nova = { tela: 'prancheta', pid: b.dataset.id, data: v.data, monitor: v.monitor };
        const ch = v.tela === 'prancheta' ? chaveParaAba(v, b.dataset.id) : undefined;
        if (ch != null) { nova.chave = ch; lembrar[`${dataDaView(v)}|${b.dataset.id}`] = ch; }
        return ir(nova, true);
      }
      case 'monitor': return ir(Object.assign({}, v, { monitor: !v.monitor }), true);
      case 'inicio-setor': return ir({ tela: 'inicio' }, true);
      case 'painel': return ir({ tela: 'central', data: v.data || dataProducao() }, true);
      case 'linha': {
        const chave = Number(b.dataset.chave);
        if (rascunho && rascunho.chave === chave && !v.monitor) return;
        if (rascunhoSujo()) salvarRascunho(true);
        rascunho = null; ed.alvoId = null;
        pilha[pilha.length - 1] = Object.assign({}, v, { chave, monitor: false });
        return render(true);
      }
      case 'salvar': {
        if (!exigeOperador()) return;
        const nomesAutorizar = quemPrecisaAutorizar();
        if (nomesAutorizar.length && !(await autorizar(nomesAutorizar))) return;
        if (!salvarRascunho(false, { autorizado: true })) return;
        // continua na mesma linha, para ver como ela ficou
        pilha[pilha.length - 1] = Object.assign({}, v, { chave: rascunho.chave });
        ed.alvoId = null; rascunho = null;
        return render();
      }
      case 'enviar-dorna': {
        if (!exigeOperador()) return;
        const p = prancheta(v.pid);
        const data = dataDaView(v);
        const k = Number(rascunho.chave);
        if (vazio(rascunho.valores[p.envio.inicio])) rascunho.valores[p.envio.inicio] = horaAgora();
        const hora = rascunho.valores[p.envio.inicio];
        // a bomba manda uma dorna de cada vez: a que estava indo para cima termina agora
        const indo = dornasDoDia(data, v.pid).filter((r) => Number(r.chave) !== k && etapaDaDorna(p, r) === 'enviando');
        if (!salvarRascunho(false, { silencioso: true })) return;
        indo.forEach((r) => { gravar(data, v.pid, r.chave, { [p.envio.fim]: hora }); depoisDeMudarDorna(data, v.pid, Number(r.chave)); });
        toast(indo.length ? `Nº ${listaE(indo.map((r) => r.chave))} terminou às ${hora}. Nº ${k} enviando.` : `Dorna Nº ${k} enviando desde ${hora}`);
        pilha[pilha.length - 1] = Object.assign({}, v, { chave: k });
        ed.alvoId = null; rascunho = null;
        return render();
      }
      case 'terminar-dorna': {
        if (!exigeOperador()) return;
        const p = prancheta(v.pid);
        const data = dataDaView(v);
        const k = Number(b.dataset.chave);
        const hora = horaAgora();
        if (rascunho && Number(rascunho.chave) === k) {
          if (vazio(rascunho.valores[p.envio.fim])) rascunho.valores[p.envio.fim] = hora;
          if (!salvarRascunho(false, { silencioso: true })) return;
        } else {
          // o que estava sendo anotado na dorna aberta é salvo antes
          if (rascunhoSujo()) salvarRascunho(true, { silencioso: true });
          gravar(data, v.pid, k, { [p.envio.fim]: hora });
          depoisDeMudarDorna(data, v.pid, k);
        }
        toast(`Dorna Nº ${k} terminou de enviar às ${hora}`);
        // vai para a próxima que está enchendo, se tiver
        const proxima = rascunho && Number(rascunho.chave) === k ? dornasDoDia(data, v.pid).find((r) => etapaDaDorna(p, r) === 'enchendo') : null;
        if (proxima) pilha[pilha.length - 1] = Object.assign({}, v, { chave: Number(proxima.chave) });
        ed.alvoId = null; rascunho = null;
        return render(true);
      }
      case 'copiar-vemde': {
        const p = prancheta(v.pid);
        const data = dataDaView(v);
        const base = pegar(data, p.vemDe.prancheta, rascunho.chave);
        if (!base) return;
        const antes = pegar(data, v.pid, rascunho.chave);
        if (ehCentral() && antes && antes.operador && antes.operador !== 'escritório' && !(await autorizar([antes.operador]))) return;
        Object.entries(p.vemDe.campos).forEach(([meu, dela]) => { if (!vazio(base.valores[dela])) rascunho.valores[meu] = base.valores[dela]; });
        const r = pegar(data, v.pid, rascunho.chave);
        gravar(data, v.pid, rascunho.chave, rascunho.valores, { operador: (r && r.operador) || operadorAtual() || '', manuais: [] });
        somarInsumosDoDia(data);
        toast(`Copiado da ${prancheta(p.vemDe.prancheta).nome}. Volta a acompanhar.`);
        ed.alvoId = null; rascunho = null;
        return render();
      }
      case 'apagar-linha': {
        const p = prancheta(v.pid);
        const k = Number(rascunho.chave);
        const dep = dependentesDe(v.pid).map((x) => prancheta(x).nome);
        const texto = p.vemDe
          ? `A linha sai da folha. Ela volta se a dorna Nº ${k} for salva de novo na ${prancheta(p.vemDe.prancheta).nome}.`
          : `A dorna sai da folha${dep.length ? ` e da ${dep.join(' e da ')}` : ''}. As seguintes sobem um número (${k + 1} vira ${k}), como no papel.`;
        const dona = pegar(dataDaView(v), v.pid, k);
        if (await confirmar(`Apagar a ${p.rotulo.toLowerCase()} Nº ${k}?`, texto, 'Apagar', true)) {
          const data = dataDaView(v);
          if (ehCentral() && dona && dona.operador && dona.operador !== 'escritório' && !(await autorizar([dona.operador]))) return;
          if (p.vemDe) { apagar(data, v.pid, k); somarInsumosDoDia(data); } else apagarDorna(data, v.pid, k);
          toast(`Dorna Nº ${k} apagada`); rascunho = null; ed.alvoId = null;
          delete lembrar[`${data}|${v.pid}`];
          pilha[pilha.length - 1] = Object.assign({}, v, { chave: undefined }); render(true);
        }
        return;
      }
      case 'dia': return ir(Object.assign({}, v, { data: somarDias(v.data, Number(b.dataset.n)) }), true);
      case 'dia-hoje': return ir(Object.assign({}, v, { data: dataProducao() }), true);
      case 'abrir-setor': return ir({ tela: 'prancheta', pid: pranchetasDasAbas(b.dataset.id)[0], data: v.data });
      case 'compartilhar': return compartilhar(b.dataset.destino, v.data || dataProducao());
      case 'relatorios': return ir({ tela: 'relatorios' });
      case 'avisos': return ir({ tela: 'avisos' });
      case 'ver-erros': return verErros();
      case 'caber-folha': cfg.folhaNormal = !cfg.folhaNormal; salvarCfg(); return render();
      case 'rolar-folha': {
        const w = b.closest('.folha') && b.closest('.folha').querySelector('.tabela-wrap');
        if (w) w.scrollBy({ left: Number(b.dataset.dir) * w.clientWidth * 0.75, behavior: movimentoReduzido() ? 'auto' : 'smooth' });
        return;
      }
      case 'zerar-tudo': {
        if (!(await confirmar('Apagar todos os dados do sistema?', 'Somem as anotações de todos os setores, nesta central e nos tablets, assim que eles se conectarem. Operadores, senhas e contatos continuam. Uma cópia fica em BackupUsina.', 'Apagar tudo', true))) return;
        if (cfg.demo) { zerarLocal(''); toast('Anotações apagadas'); return render(true); }
        const senha = await pedirSenhaModal('Senha do programador', 'Só quem programa o sistema tem esta senha.');
        if (senha === undefined) return;
        try {
          const r = await postJson('api/zerar', { confirmar: 'ZERAR', senha }, 15000);
          const d = await r.json();
          if (r.status === 403) return toast('Senha do programador errada. Nada foi apagado.', 'erro');
          if (!r.ok || !d.ok) throw new Error(d.erro || 'falhou');
          zerarLocal(d.geracao);
          toast(`${contar(d.apagados, 'anotação apagada', 'anotações apagadas')}. Cópia em ${d.copia}.`);
        } catch (e) { toast('Não consegui zerar. Confira se a central está ligada.', 'erro'); }
        return render(true);
      }
      case 'aviso-setor': v.form.setor = b.dataset.id; v.form.nome = ''; return render();
      case 'aviso-pessoa': v.form.nome = b.dataset.nome; return render();
      case 'aviso-frase': {
        const junto = ((v.form.texto || '').trim() + ' ' + b.dataset.texto).trim();
        v.form.texto = junto.slice(0, TAMANHO_AVISO); return render();
      }
      case 'aviso-enviar': {
        const f = v.form;
        const campo = document.getElementById('aviso-texto');
        if (campo) f.texto = campo.value;
        const texto = (f.texto || '').replace(/\s+/g, ' ').trim();
        if (!f.setor) return toast('Escolha o setor', 'erro');
        if (texto.length < 2) return toast('Escreva a mensagem do aviso', 'erro');
        enviarAviso(f.setor, f.nome, texto.slice(0, TAMANHO_AVISO));
        const setor = setorPorId(f.setor).nome;
        const agora = !cfg.demo && trabalhandoAgora(f.setor, f.nome);
        toast(agora ? `Aviso enviado. Aparece agora na tela da ${setor}.` : `Aviso guardado. Aparece quando ${f.nome || 'alguém'} entrar na ${setor}.`);
        f.texto = ''; return render();
      }
      case 'aviso-cancelar': {
        if (!(await confirmar('Cancelar este aviso?', 'Ele não vai mais aparecer na tela da pessoa.', 'Cancelar aviso', true))) return;
        gravar(b.dataset.data, PID_AVISO, b.dataset.id, { cancelado: true, canceladoEm: Date.now() }, { operador: 'escritório' });
        toast('Aviso cancelado'); return render();
      }
      case 'ler-folha': return comecarLeitura(v.data || dataProducao());
      case 'leitura-linha': { const l = v.leitura.linhas[Number(b.dataset.i)]; if (l.temValor) l.incluir = !l.incluir; return render(); }
      case 'leitura-cel': return corrigirCelula(v, Number(b.dataset.i), b.dataset.c);
      case 'leitura-salvar': return salvarLeitura(v);
      case 'relatorio-enviar': return enviarDia(b.dataset.data);
      case 'relatorio-abrir': return ir({ tela: 'central', data: b.dataset.data });
      case 'relatorio-apagar': {
        if (!(await confirmar(`Apagar o arquivo de ${fmtData(b.dataset.data)}?`, 'O Excel e o XML guardados deste dia são apagados. As anotações continuam no sistema e dá para gerar o arquivo de novo.', 'Apagar', true))) return;
        const r = await postJson('api/relatorio-apagar', { data: b.dataset.data }).catch(() => null);
        toast(r && r.ok ? 'Arquivo apagado' : 'Não consegui apagar o arquivo', r && r.ok ? 'ok' : 'erro');
        v.carregado = false; return render();
      }
      case 'gerar-hoje': {
        const data = dataProducao();
        const ok = await guardarNaCentral(data, [gerarArquivo('xlsx', data, setores().map((s) => s.id)), gerarArquivo('xml', data, setores().map((s) => s.id))]);
        toast(ok ? 'Excel e XML de hoje guardados' : 'Não consegui guardar no servidor', ok ? 'ok' : 'erro');
        v.carregado = false; return render();
      }
      case 'config': {
        // mexe no número do escritório, operadores e setores de todos os tablets: pede a senha do encarregado
        const s = await pedirSenhaModal('Senha do encarregado', 'As configurações da usina valem para todos os tablets.');
        if (s === undefined) return;
        if (s !== C.pinAdmin) return toast('Senha errada', 'erro');
        carregarBase44();
        return ir({ tela: 'config' });
      }
      case 'base44-url': {
        const atual = (base44Info && base44Info.url) || '';
        const valor = await textoLivre({ titulo: 'Endereço no Base44', dica: 'Quem montou o sistema do escritório copia do Base44 (a função receberTotaisPranchetas). Começa com https://. Deixe em branco para parar de enviar.', valor: atual, tipo: 'url', max: 300 });
        if (valor === undefined) return;
        if (valor && !/^https?:\/\/\S+\.\S+$/i.test(valor)) return toast('Endereço incompleto. Ele começa com https://', 'erro');
        const r = await postJson('api/base44', { acao: 'configurar', url: valor, desde: dataProducao() }, 8000).catch(() => null);
        if (!r || !r.ok) return toast(r ? ((await r.json().catch(() => ({}))).erro || 'A central recusou') : 'Não consegui falar com a central', 'erro');
        base44Info = await r.json(); if (sync.status) sync.status.base44 = Object.assign({}, base44Info); sync.statusJson = '';
        toast(valor ? 'Endereço salvo. Os totais vão sozinhos quando o dia fechar.' : 'Envio para o Base44 desligado');
        return render();
      }
      case 'base44-segredo': {
        let valor = await textoLivre({ titulo: 'Segredo do Base44', dica: 'O mesmo texto cadastrado no Base44 como PRANCHETAS_SEGREDO. Deixe em branco e toque em Salvar para o aplicativo criar um.', tipo: 'text', max: 200 });
        if (valor === undefined) return;
        const criado = !valor;
        if (criado) {
          const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          valor = Array.from(crypto.getRandomValues(new Uint8Array(20)), (x) => letras[x % letras.length]).join('').replace(/(.{5})(?=.)/g, '$1-');
        }
        const r = await postJson('api/base44', { acao: 'configurar', url: (base44Info && base44Info.url) || '', segredo: valor }, 8000).catch(() => null);
        if (!r || !r.ok) return toast('Não consegui falar com a central', 'erro');
        base44Info = await r.json(); if (sync.status) sync.status.base44 = Object.assign({}, base44Info); sync.statusJson = '';
        if (criado) {
          await abrirModal(`<h3>Segredo criado</h3><p class="dica">Passe para quem montou o Base44 cadastrar como PRANCHETAS_SEGREDO. Ele não aparece de novo aqui.</p>
            <p class="segredo-grande">${esc(valor)}</p>
            <div class="acoes-modal um"><button class="btn primario" data-k="x">Anotei</button></div>`, (k, b2, fechar) => fechar());
        } else toast('Segredo salvo');
        return render();
      }
      case 'base44-enviar': {
        const data = b.dataset.data;
        b.disabled = true;
        toast(`Mandando os totais de ${fmtData(data)} para o Base44...`);
        const r = await enviarBase44(data, true);
        if (r.ok) toast(`Totais de ${fmtData(data)} enviados para o Base44`);
        else toast(`Não foi: ${r.erro}`, 'erro');
        sync.statusJson = '';
        await carregarBase44();
        return render();
      }
      case 'contato': {
        const campo = b.dataset.campo;
        const atual = configSistema()[campo] || '';
        const valor = await textoLivre(campo === 'whatsapp'
          ? { titulo: 'WhatsApp do escritório', dica: 'Com DDD, só números. Exemplo: 14991234567', valor: atual, tipo: 'tel' }
          : { titulo: 'E-mail do escritório', dica: 'Exemplo: escritorio@ubiralcool.com.br', valor: atual, tipo: 'email' });
        if (valor === undefined) return;
        if (campo === 'whatsapp' && valor && telefoneLimpo(valor).length < 10) return toast('Número incompleto. Coloque o DDD e o número.', 'erro');
        if (campo === 'email' && valor && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor)) return toast('E-mail incompleto. Confira.', 'erro');
        salvarConfigSistema({ [campo]: campo === 'whatsapp' ? telefoneLimpo(valor) : valor });
        toast(valor ? 'Contato salvo' : 'Contato apagado');
        return render();
      }
      case 'lista-add': {
        const nome = b.dataset.lista;
        const valor = await textoLivre({ titulo: nome === 'produtos' ? 'Novo tipo de produto' : 'Novo fornecedor', dica: 'Escreva como deve aparecer para o operador.' });
        if (!valor) return;
        const lista = [...listaDaUsina(nome)];
        if (!lista.includes(valor.toUpperCase())) lista.push(valor.toUpperCase());
        salvarConfigSistema({ [nome]: lista });
        return render();
      }
      case 'lista-remove': {
        const nome = b.dataset.lista;
        const lista = [...listaDaUsina(nome)];
        lista.splice(Number(b.dataset.i), 1);
        salvarConfigSistema({ [nome]: lista });
        return render();
      }
      case 'mostrar-mais': { const abertos = Object.assign({}, v.abertos); abertos[b.dataset.setor] = !abertos[b.dataset.setor]; v.abertos = abertos; return render(); }
      case 'setor-liga': return mudarConfigLista('setor', b.dataset.id);
      case 'prancheta-liga': return mudarConfigLista('prancheta', b.dataset.setor, b.dataset.id);
      case 'op-add': {
        const setor = b.dataset.setor;
        const nome = await textoLivre({ titulo: `Novo operador da ${setorPorId(setor).nome}`, dica: 'Escreva como deve aparecer na prancheta.' });
        if (!nome) return;
        const senha = await pedirSenhaModal(`Senha de ${nome}`, 'Quatro números, que só essa pessoa vai saber. Pode deixar em branco.');
        salvarOperadores(setor, [...operadoresDo(setor), { nome, senha: senha ? embaralharSenha(nome, senha) : '' }]);
        toast(senha ? `${nome} cadastrado com senha` : `${nome} cadastrado sem senha`);
        return render();
      }
      case 'op-senha': {
        const setor = b.dataset.setor;
        const lista = [...operadoresDo(setor)];
        const op = lista[Number(b.dataset.i)];
        const senha = await pedirSenhaModal(`Nova senha de ${op.nome}`, 'Quatro números. Em branco, tira a senha.');
        if (senha === undefined) return;
        lista[Number(b.dataset.i)] = { nome: op.nome, senha: senha ? embaralharSenha(op.nome, senha) : '' };
        salvarOperadores(setor, lista);
        toast(senha ? `Senha de ${op.nome} trocada` : `${op.nome} ficou sem senha`);
        return render();
      }
      case 'op-remove': {
        const setor = b.dataset.setor;
        const lista = [...operadoresDo(setor)];
        const op = lista[Number(b.dataset.i)];
        if (!(await confirmar(`Remover ${op.nome}?`, 'O nome sai da lista. O que essa pessoa já anotou continua na folha.', 'Remover', true))) return;
        lista.splice(Number(b.dataset.i), 1);
        salvarOperadores(setor, lista);
        return render();
      }
      case 'imprimir': return imprimirEscolhendo(v.data || dataProducao());
      case 'qr-grande': {
        const st = sync.status;
        const endereco = st && st.enderecos && st.enderecos[0] ? st.enderecos[0] : '';
        if (!endereco || typeof window.qrcode !== 'function') return toast('Ainda procurando o endereço no Wi-Fi', 'erro');
        const q = window.qrcode(0, 'M'); q.addData(endereco + '/baixar'); q.make();
        await abrirModal(`<h3>Conectar um tablet</h3>
          <div class="qr-modal">
            <div class="qr-grande">${q.createSvgTag({ cellSize: 8, margin: 2, scalable: true })}</div>
            <ol class="passos-conectar">
              <li><b>Aponte a câmera</b> do tablet novo para o QR code e baixe o aplicativo.</li>
              <li><b>Instale e abra.</b> Ele procura este tablet sozinho. Se pedir o endereço: <span class="endereco">${esc(endereco.replace(/^http:\/\//, ''))}</span></li>
              <li><b>Digite o código</b> <span class="codigo-grande">${esc(String(st.codigo).replace(/(\d{3})(\d{3})/, '$1 $2'))}</span></li>
            </ol>
          </div>
          <div class="acoes-modal um"><button class="btn primario" data-k="x">Fechar</button></div>`,
        (k, b2, fechar) => fechar(), { classe: 'largo' });
        return;
      }
      case 'novo-codigo': {
        if (!(await confirmar('Trocar o código de conexão?', 'Todos os outros aparelhos são desconectados e só voltam com o código novo. Use se um aparelho foi perdido ou roubado.', 'Trocar', true))) return;
        const r = await postJson('api/novo-codigo', {}).catch(() => null);
        if (r && r.ok) {
          const d = await r.json().catch(() => ({}));
          if (d.chave) { cfg.chave = d.chave; cfg.cifra = 1; salvarCfg(); } // este aparelho continua conectado
          sync.statusJson = ''; await sincronizar(); toast('Código trocado. Os outros aparelhos vão pedir o código novo.'); render();
        }
        return;
      }
      case 'exemplo': preencherExemplo(); toast('Dados de exemplo adicionados'); return render();
      case 'limpar-tudo': {
        const aviso = pendentes() ? `Atenção: ${contar(pendentes(), 'anotação ainda não chegou', 'anotações ainda não chegaram')} na central.` : 'O que já foi enviado continua guardado na central.';
        if (centralNoTablet()) return toast('Este aparelho é o servidor da usina. Desligue o servidor antes de apagar os dados dele.', 'erro');
        if (await confirmar('Apagar os dados deste aparelho?', `${aviso} Depois você escolhe de novo onde ele vai ficar.`, 'Apagar tudo', true)) {
          registros = {}; salvarRegistros();
          cfg.ultimoSeq = 0; cfg.papel = null; cfg.op = null; salvarCfg();
          toast('Dados deste aparelho apagados'); pilha = [telaInicial()]; render(true);
        }
        return;
      }
      case 'desconectar':
        if (await confirmar('Desconectar da central?', 'Para usar de novo vai ser preciso digitar o código de conexão.', 'Desconectar', true)) {
          cfg.chave = null; cfg.demo = false; cfg.papel = null; salvarCfg(); pilha = [telaInicial()]; render(true);
        }
        return;
      case 'tela-cheia': {
        cfg.telaCheia = b.dataset.valor === '1'; salvarCfg();
        aplicarTelaCheia();
        return render();
      }
      case 'instalar':
        if (eventoInstalar) { eventoInstalar.prompt(); eventoInstalar = null; }
        else await confirmar('Como instalar', 'No Chrome do Android, toque nos três pontinhos no canto de cima e depois em "Adicionar à tela inicial".', 'Entendi');
        return;
    }
  });
  app.addEventListener('input', (e) => {
    if (e.target.id !== 'aviso-texto') return;
    const v = view();
    if (v.form) { v.form.texto = e.target.value; atualizarTelaAvisos(); }
  });
  let eventoInstalar = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); eventoInstalar = e; });

  function exigeOperador() {
    if (ehCentral() || operadorAtual()) return true;
    toast('Primeiro escolha o seu nome', 'erro');
    ir({ tela: 'operador' });
    return false;
  }

  // teclado físico (útil no computador do escritório)
  document.addEventListener('keydown', (e) => {
    if (modalAberto() || !painelVisivel() || e.ctrlKey || e.altKey || e.metaKey) return;
    const a = alvoAtual();
    let k = null;
    if (/^\d$/.test(e.key)) k = e.key;
    else if (e.key === ',' || e.key === '.') k = e.key;
    else if (e.key === 'Backspace') k = 'apagar';
    else if (e.key === 'Enter' || e.key === 'Tab') k = 'prox';
    else if (e.key === '+' || e.key === '-') k = e.key;
    else if (e.key === ' ' && a.type === 'text') k = 'espaco';
    else if (/^[a-zA-ZÀ-ú]$/.test(e.key) && a.type === 'text') k = e.key;
    if (k) { e.preventDefault(); tecla(k); }
  });

  /* =========================================================
   * Tamanho da tela: tablets diferentes ficam com a mesma cara
   * ========================================================= */
  function ajustarEscala() {
    // celular: tela pequena, ou janela estreita (navegador dividido ou moldura de apresentação)
    const celular = Math.min(screen.width, screen.height) < 600 || Math.min(window.innerWidth, window.innerHeight) < 520;
    document.documentElement.dataset.dispositivo = celular ? 'celular' : 'tablet';
    const w = window.innerWidth, h = window.innerHeight;
    // referência 1100 x 690: um tablet de 10 polegadas (Tab S6, 1280 x 800) fica com tudo uns 15% maior,
    // e todos os tablets mostram a mesma tela, só maior ou menor conforme o tamanho
    let z = celular ? 0.94 : Math.max(1, Math.min(w >= h ? Math.min(w / 1100, h / 690) : Math.min(w / 690, h / 1100), 1.8));
    z *= { menor: 0.88, normal: 1, maior: 1.14 }[cfg.escala] || 1;
    z = Math.round(z * 100) / 100;
    document.documentElement.style.setProperty('--escala', z);
    document.documentElement.dataset.escala = cfg.escala || 'normal';
    document.body.style.zoom = z;
  }
  window.addEventListener('resize', () => { ajustarEscala(); rolarDepois = true; agendarCaber(); });

  /* =========================================================
   * Texto que não cabe: diminui a letra em vez de quebrar a palavra no meio
   * (nome comprido de operador, quadro estreito, botão do celular...)
   * ========================================================= */
  const CABER = [
    '.opcoes.nomes .nome-op b', '.campo .rot', '.campo .val', '.item .texto b', '.setor-cartao .texto b', '.papel-cartao b',
    '.abas button', '.seletor button', '.rodape .btn', '.painel-nav .btn', '.chip', '.topo .titulo b', '.topo .titulo span', '.topo .atalho span',
    '.chips-escolha button span', '.escolhas button b', '.cabecalho-form .aviso', '.cabecalho-form .btn', '.opcoes-painel button',
    '.linha-botoes .btn', '.acoes-modal .btn', '.btn.largo', '.aviso-item-cab b', '.aparelho b', '.data-grande b', '.boas-vindas h1',
  ].join(', ');
  const cabe = (el) => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1;
  function caberTextos(raiz = document) {
    // o selo do turno fica do lado do nome da tela só se o nome couber inteiro; senão ele some (o nome vem primeiro)
    raiz.querySelectorAll('.topo .titulo-linha').forEach((l) => {
      const selo = l.querySelector('.turno-topo'); const nome = l.querySelector('b');
      if (!selo || !nome) return;
      selo.style.display = ''; nome.style.fontSize = '';
      nome.style.whiteSpace = 'nowrap'; // mede o nome numa linha só
      const naoCabe = nome.scrollWidth > nome.clientWidth + 1;
      nome.style.whiteSpace = '';
      if (naoCabe) selo.style.display = 'none';
    });
    const lista = [...raiz.querySelectorAll(CABER)].filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed');
    lista.forEach((el) => { el.style.fontSize = ''; el.style.whiteSpace = ''; });
    // primeiro só mede (sem mexer), para a tela não recalcular a cada elemento
    const apertados = lista.filter((el) => el.clientWidth > 0 && !cabe(el)).map((el) => ({ el, base: parseFloat(getComputedStyle(el).fontSize) }));
    apertados.forEach(({ el, base }) => {
      const minimo = Math.min(base, Math.max(13, base * 0.6));
      let t = base;
      while (t > minimo && !cabe(el)) { t = Math.max(minimo, t * 0.92); el.style.fontSize = t.toFixed(1) + 'px'; }
      // nem assim coube: vai para a linha de baixo, sempre entre uma palavra e outra
      if (!cabe(el)) el.style.whiteSpace = 'normal';
    });
  }
  /* Ajusta a letra no próximo quadro da tela. Com "partes", só dentro delas (ao teclar, só o quadro e o teclado);
     sem, a tela inteira. */
  let caberPendente = false, caberTudo = false;
  const partesParaCaber = new Set();
  function agendarCaber(partes) {
    if (partes) partes.forEach((el) => partesParaCaber.add(el)); else caberTudo = true;
    if (caberPendente) return;
    caberPendente = true;
    requestAnimationFrame(() => {
      caberPendente = false;
      if (caberTudo) caberTextos();
      else partesParaCaber.forEach((el) => { if (el.isConnected) caberTextos(el); });
      caberTudo = false; partesParaCaber.clear();
      if (rolarDepois) { rolarDepois = false; rolarSeletor(); }
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => agendarCaber());

  /* =========================================================
   * Quiosque: tela cheia e tela acesa
   * ========================================================= */
  /** Tela cheia só quando ligada nos ajustes. Desligada, o app respeita a barra de bateria e hora. */
  function aplicarTelaCheia() {
    document.documentElement.toggleAttribute('data-cheia', !!cfg.telaCheia); // no celular, a hora do app só aparece em tela cheia
    if (DEMO_IMG) return;
    if (NO_APK) {
      if (pluginCentral) pluginCentral.telaCheia({ ligar: !!cfg.telaCheia }).catch(() => {});
      return;
    }
    const el = document.documentElement;
    if (cfg.telaCheia && !document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    if (!cfg.telaCheia && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }
  function entrarTelaCheia() {
    if (!NO_APK && cfg.telaCheia) aplicarTelaCheia(); // no navegador, só depois de um toque na tela
    if (navigator.wakeLock && document.visibilityState === 'visible') navigator.wakeLock.request('screen').catch(() => {});
  }
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input, textarea')) e.preventDefault(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { entrarTelaCheia(); sincronizar(); } });

  /* =========================================================
   * Relógio: troca de folha às 07:00 e de turno
   * ========================================================= */
  /** Todo dia, pouco depois das 07:00, o tablet chefe guarda o Excel e o XML do dia que fechou. */
  function fechamentoDoDia(dataHoje) {
    if (!ehCentral() || cfg.demo || !cfg.chave || sync.modo !== 'online') return;
    const agora = new Date();
    if (agora.getHours() !== C.inicioDoDia || agora.getMinutes() < 5) return;
    const ontem = somarDias(dataHoje, -1);
    if (cfg.ultimoFechamento === ontem) return;
    cfg.ultimoFechamento = ontem; salvarCfg();
    const todos = setores().map((s) => s.id);
    guardarNaCentral(ontem, [gerarArquivo('xlsx', ontem, todos), gerarArquivo('xml', ontem, todos)])
      .then((ok) => { if (ok) toast(`Folha de ${fmtData(ontem)} guardada em RelatoriosUsina`); });
  }

  let ultimaData = dataProducao(), ultimoTurno = turnoAtual().id, ultimaHora = new Date().getHours();
  setInterval(() => {
    const rel = document.getElementById('relogio');
    if (rel) rel.textContent = horaAgora();
    const tt = document.getElementById('turno-topo');
    if (tt && tt.textContent !== turnoAtual().nome) tt.textContent = turnoAtual().nome;
    // chegou anotação nova enquanto a pessoa rolava: redesenha quando ela soltar
    if (redesenharDepois && podeRedesenhar()) { redesenharDepois = false; if (['central', 'inicio', 'prancheta', 'config'].includes(view().tela)) render(); }
    // hora da linha nova acompanha o relógio até a pessoa mudar
    if (rascunho && rascunho.horaAuto && rascunho.horaAuto.length && view().tela === 'prancheta') {
      let mudou = false;
      rascunho.horaAuto.forEach((id) => {
        if (rascunho.tocados[id] || rascunho.valores[id] === horaAgora()) return;
        rascunho.valores[id] = horaAgora(); rascunho.original[id] = horaAgora(); mudou = true;
      });
      if (mudou) atualizarEdicao();
    }
    const d = dataProducao(), t = turnoAtual().id, h = new Date().getHours();
    fechamentoDoDia(d);
    travarPorInatividade();
    if (d !== ultimaData) {
      if (rascunhoSujo()) salvarRascunho(true);
      ultimaData = d; ultimoTurno = t; ultimaHora = h;
      if (modalAberto()) fecharModalAtual();
      pilha = [telaInicial()]; rascunho = null; ed.alvoId = null;
      if (cfg.papel && !ehCentral()) pilha.push({ tela: 'operador' });
      if (!DEMO_IMG) podar();
      render(true); toast(`Nova folha começou: ${fmtData(d)}`);
      return;
    }
    if (t !== ultimoTurno) {
      ultimoTurno = t;
      if (cfg.papel && !ehCentral() && podeRedesenhar()) { pilha = [telaInicial(), { tela: 'operador' }]; rascunho = null; render(true); }
    } else if (h !== ultimaHora && podeRedesenhar() && ['inicio', 'central'].includes(view().tela)) render();
    ultimaHora = h;
  }, 1000);

  /* =========================================================
   * Início
   * ========================================================= */
  function iniciarImagens() {
    // ?demo&papel=hidrolise&op=Guilherme&tela=prancheta&pid=hid_anexo1&chave=9&campo=brix&teclas=18
    cfg.papel = params.get('papel') || null;
    if (params.get('tema')) { cfg.tema = params.get('tema'); aplicarTema(); }
    if (params.get('escala')) { cfg.escala = params.get('escala'); ajustarEscala(); }
    if (params.get('op')) definirOperador(params.get('op'));
    if (params.get('nomesLongos') && cfg.papel) cfg.operadores[cfg.papel] = ['Romenique', 'Maximiliano Aparecido', 'Carlindo Ferreira Júnior', 'Cleber', 'Guilherme', 'Wellington'];
    // demonstração da seção do Base44 (para conferir a tela)
    if (params.get('base44')) {
      const d = (n) => somarDias(dataProducao(), -n);
      base44Info = { ligado: true, temSegredo: true, url: 'https://sistema-do-escritorio-ubiralcool-7f3a9c.base44.app/functions/receberTotaisPranchetas', desde: d(5),
        enviados: { [d(1)]: { ok: true, em: Date.now() - 3600000, hash: 'a' }, [d(2)]: { ok: false, em: Date.now() - 600000, erro: 'Sem internet na central (ou endereço errado)' }, [d(3)]: { ok: true, em: Date.now() - 2 * 86400000, hash: 'b' } } };
    }
    preencherExemplo();
    Object.values(registros).forEach((r) => { r.sincronizado = true; });
    const tela = params.get('tela');
    sync.modo = 'online';
    if (tela === 'conectar') { cfg.demo = false; pilha = [{ tela: 'conectar' }]; }
    else if (tela === 'preparando') {
      pilha = [{ tela: 'preparando', fim: params.get('fim') === '1', passos: [
        { texto: 'Criando as pastas ServidorUsina, RelatoriosUsina e BackupUsina', estado: 'ok', detalhe: 'No aparelho e em Documentos/Usina' },
        { texto: 'Ligando o servidor na rede, porta 8080', estado: 'ok', detalhe: 'Servidor ligado' },
        { texto: 'Mantendo o servidor ligado com a tela apagada', estado: 'ok', detalhe: 'Aparece um aviso fixo na barra de notificações' },
        { texto: 'Procurando o endereço deste tablet no Wi-Fi', estado: params.get('fim') === '1' ? 'ok' : 'fazendo', detalhe: params.get('fim') === '1' ? 'http://192.168.0.20:8080' : '' },
      ].concat(params.get('fim') === '1' ? [{ texto: 'Testando o servidor', estado: 'ok', detalhe: 'Respondendo' }, { texto: 'Gerando o código de conexão dos tablets', estado: 'ok', detalhe: 'Código 504 140' }] : []) }];
    } else {
      pilha = [telaInicial()];
      if (tela === 'operador') { cfg.op = null; pilha.push({ tela: 'operador' }); }
      else if (tela === 'config' || tela === 'admin' || tela === 'relatorios') pilha.push({ tela });
      else if (tela === 'avisos') {
        // exemplos: um lido, um na tela e um esperando
        const a1 = enviarAviso('hidrolise', 'Guilherme', 'Passe no escritório antes de sair, por favor.');
        gravar(dataProducao(), PID_RECIBO, a1, { mostradoEm: Date.now() - 600000, mostradoPara: 'Guilherme', lidoEm: Date.now() - 540000, lidoPor: 'Guilherme' }, { operador: 'Guilherme' });
        const a2 = enviarAviso('caldeira', 'Alberto', 'O técnico da caldeira chega às 14h. Acompanhe ele, por favor.');
        gravar(dataProducao(), PID_RECIBO, a2, { mostradoEm: Date.now() - 120000, mostradoPara: 'Alberto' }, { operador: 'Alberto' });
        enviarAviso('destilaria', '', 'Ligue para o escritório.');
        pilha.push({ tela: 'avisos', form: { setor: 'hidrolise', nome: 'Felipe', texto: 'Amanhã o turno começa mais cedo, às 6h.' } });
      }
      else if (tela === 'prancheta') {
        const pv = { tela, pid: params.get('pid') };
        if (params.get('chave')) pv.chave = Number(params.get('chave'));
        if (params.get('monitor')) pv.monitor = true;
        if (ehCentral()) pv.data = dataProducao();
        pilha.push(pv);
      }
    }
    render(true);
    if (params.get('campo')) {
      selecionar(params.get('campo'));
      (params.get('teclas') || '').split('|').filter(Boolean).forEach((k) => tecla(k));
    }
    if (params.get('modal') === 'formato') compartilhar('whatsapp', dataProducao());
    if (params.get('aviso') && cfg.papel && !ehCentral() && operadorAtual()) {
      enviarAviso(cfg.papel, operadorAtual(), 'Passe no escritório antes de sair, por favor. O encarregado quer falar sobre a troca de turno de amanhã.');
      verificarAvisos();
    }
    if (params.get('lerfoto')) {
      // ?demo&papel=central&lerfoto=teste.jpg&pid=hid_anexo2 : lê uma foto de teste sem abrir a câmera
      fetch(params.get('lerfoto')).then((r) => r.blob()).then((b) => lerFolhaDeArquivo(params.get('pid'), dataProducao(), new File([b], 'folha.jpg', { type: b.type })));
    }
    if (params.get('folhas')) {
      // ?demo&papel=central&folhas=hid_anexo1,ins_lphera  (ou folhas=todas): mostra as folhas iguais ao papel
      const escolha = params.get('folhas');
      const pids = escolha === 'todas' ? folhasDosSetores(setores().map((x) => x.id)) : escolha.split(',');
      const area = document.createElement('div'); area.id = 'impressao'; document.body.appendChild(area);
      area.innerHTML = pids.map((pid) => window.ModelosPapel.paraHtml(papel().folha(pid, dataProducao()), 'icons/logo.png', fmtNum)).join('');
      const primeira = area.querySelector('.folha-imp');
      area.style.page = document.body.style.page = primeira && primeira.classList.contains('paisagem') ? 'paisagem' : 'retrato';
      document.body.classList.add('ver-folhas');
    }
  }

  aplicarTema();
  ajustarEscala();
  document.documentElement.toggleAttribute('data-cheia', !!cfg.telaCheia);
  if (DEMO_IMG) iniciarImagens();
  else {
    if (NO_APK && pluginCentral && cfg.servidor === undefined && ehCentral()) { cfg.servidor = true; salvarCfg(); }
    if (centralNoTablet()) ligarCentralDoTablet().then(sincronizar);
    // não é mais o servidor, mas ele ficou ligado (ligou sozinho ao religar): desliga
    else if (NO_APK && pluginCentral && pluginCentral.estado) pluginCentral.estado().then((r) => { if (r && r.rodando) pluginCentral.parar().catch(() => {}); }).catch(() => {});
    // no aplicativo, quem guarda se a tela cheia está ligada é o Android
    if (NO_APK && pluginCentral && pluginCentral.telaCheia) pluginCentral.telaCheia({}).then((r) => { if (!!r.ligada !== !!cfg.telaCheia) { cfg.telaCheia = !!r.ligada; salvarCfg(); document.documentElement.toggleAttribute('data-cheia', cfg.telaCheia); } }).catch(() => {});
    podar();
    pilha = [telaInicial()];
    if (cfg.papel && (cfg.chave || cfg.demo) && !ehCentral() && !operadorAtual()) pilha.push({ tela: 'operador' });
    render(true);
    sincronizar();
    setTimeout(verificarAvisos, 800); // aviso que já estava guardado neste aparelho
    // todos os aparelhos sincronizam a cada 5 segundos
    setInterval(sincronizar, 5000);
    setInterval(() => { if (foraDaRede() && view().tela !== 'bloqueado' && !modalAberto()) render(); }, 60000);
    app.addEventListener('pointerdown', function primeira() { entrarTelaCheia(); app.removeEventListener('pointerdown', primeira); });
    if (!NO_APK && 'serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
