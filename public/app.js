/* Pranchetas Ubirálcool - app principal
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
(function () {
  'use strict';
  const C = window.USINA;
  const VERSAO = '2.13.1'; // aparece nos ajustes e vai junto com cada envio para a central
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
    grafico: '<path d="M4 4v16h16"/><path d="M7 15l4-5 3 3 5-6"/>',
    cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    documento: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>',
    lapis: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
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
    regua: '<path d="M3 16.5L16.5 3 21 7.5 7.5 21z"/><path d="M7 12.5l2 2M10 9.5l2 2M13 6.5l2 2"/>',
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
    const partes = typeof textoDaConfig === 'function' ? textoDaConfig(mudanca) : [];
    if (partes.length) registrar('configuracao', `${quemEstaAqui()} ${partes.join(', ')}`);
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
  const ehEscritorio = () => cfg.papel === 'escritorio'; // versão 2.13: o aparelho do Escritório (não é setor nem tablet chefe)

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


  /* =========================================================
   * Volume de vinho (a folga de cada dorna, medida com a trena) e dornas de fermentação
   *   Volume em litros = (altura - folga) x área da base x 1000: a conta da planilha CONTROLE LTS do escritório.
   *   As medidas das dornas ficam em Configurações da usina (começam com as da planilha, em forms.js).
   * ========================================================= */
  const PID_MEDICAO = 'med_dornas', PID_FERMENTACAO = 'fermentacao';
  // as medidas trocadas pelo escritório valem só se forem da mesma versão dos grupos (forms.js)
  const medidasDasDornas = () => { const m = configSistema().medicao; return m && m.versao === C.medicaoPadrao.versao ? m : C.medicaoPadrao; };
  const emM3 = (g) => !!g && g.unidade === 'm³';
  const gruposDaMedicao = () => medidasDasDornas().grupos;
  const grupoDaMedicao = (id) => gruposDaMedicao().find((g) => g.id === id);
  const temMedida = (d) => !!d && Number(d.altura) > 0 && Number(d.area) > 0;
  const arred2 = (n) => Math.round(n * 100) / 100;
  /** Volume da dorna: em litros, ou em m³ nos tanques de álcool (g = o grupo da dorna). */
  function volumeDe(d, folga, g) {
    if (vazio(folga) || !temMedida(d)) return null;
    const v = (Number(d.altura) - Number(folga)) * Number(d.area);
    return emM3(g) ? Math.round(v * 1000) / 1000 : arred2(v * 1000);
  }
  /** Litros como na planilha (7.229,25). curto: sem as casas, para caber do lado do quadro. */
  const litros = (n, curto) => (n == null ? '' : `${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: curto ? 0 : 2, maximumFractionDigits: curto ? 0 : 2 })} L`);
  function volDoRegistro(reg, d, g) {
    if (!reg) return null;
    const x = reg.valores[d.id + '_vol'];
    return vazio(x) ? volumeDe(d, reg.valores[d.id + '_folga'], g) : Number(x);
  }
  /** Volume com a unidade do grupo: 7.229,25 L ou 4,400 m³ (curto: litros sem as casas). */
  const volumeTexto = (n, g, curto) => (n == null ? '' : emM3(g) ? `${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m³` : litros(n, curto));
  /** Dia de produção + hora (a folha vai das 07:00 às 06:59) em milissegundos. */
  function momentoDe(data, hhmm) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '') || !/^\d\d:\d\d$/.test(hhmm || '')) return 0;
    const [h, m] = hhmm.split(':').map(Number);
    const [y, mo, d] = (h < C.inicioDoDia ? somarDias(data, 1) : data).split('-').map(Number);
    return new Date(y, mo - 1, d, h, m).getTime();
  }
  /** A medição de um dia: cada grupo com as dornas, o subtotal e o total de vinho da produção.
      aoVivo: { grupo, valores } do grupo que está sendo anotado (o total muda enquanto a pessoa digita). */
  function medicaoDoDia(data, aoVivo) {
    const grupos = gruposDaMedicao().map((g) => {
      const vivo = aoVivo && aoVivo.grupo === g.id;
      const reg = vivo ? { valores: aoVivo.valores } : pegar(data, PID_MEDICAO, g.id);
      const v = reg ? reg.valores : {};
      const linhas = g.dornas.map((d) => ({ d, folga: v[d.id + '_folga'], brix: v[d.id + '_brix'], ferm: v[d.id + '_ferm'], volume: vivo ? volumeDe(d, v[d.id + '_folga'], g) : volDoRegistro(reg, d, g) }));
      const medidas = linhas.filter((l) => l.volume != null);
      return { g, hora: v.hora || '', operador: (!vivo && reg && reg.operador) || '', linhas, medidas: medidas.length, subtotal: arred2(medidas.reduce((s, l) => s + l.volume, 0)) };
    });
    const par = pegar(data, PID_MEDICAO, 'param');
    const soma = (lista) => arred2(lista.reduce((s, x) => s + x.subtotal, 0));
    return {
      grupos, param: par ? par.valores : {}, operadorParam: par ? par.operador || '' : '',
      producao: soma(grupos.filter((x) => x.g.soma)), tanques: soma(grupos.filter((x) => !x.g.soma)),
      medidas: grupos.reduce((s, x) => s + x.medidas, 0), total: grupos.reduce((s, x) => s + x.g.dornas.length, 0),
      hora: (grupos.find((x) => x.hora && x.medidas) || {}).hora || '',
    };
  }

  /* Dornas de fermentação: cada enchimento é um registro no dia em que começou a encher.
     vazia -> enchendo -> fermentando -> na volante (mandando para a coluna) -> com vinho (parou no meio) -> vazia */
  const numeroDaDorna = (d) => Number(String(d.id).replace(/\D/g, ''));
  const dornasDeFermentacao = () => { const g = grupoDaMedicao(prancheta(PID_FERMENTACAO).grupoMedicao); return g ? g.dornas.map((d) => ({ n: numeroDaDorna(d), d })) : []; };
  let ciclos = null, versaoDosCiclos = -1;
  /** Enchimentos de cada dorna, o mais novo primeiro. */
  function ciclosPorDorna() {
    if (!ciclos || versaoDosCiclos !== versaoRegistros) {
      const m = new Map();
      for (const [k, lista] of indiceDasFolhas().porFolha) {
        if (!k.endsWith('|' + PID_FERMENTACAO)) continue;
        lista.forEach((r) => { const n = Number(r.valores.dorna); if (!m.has(n)) m.set(n, []); m.get(n).push(r); });
      }
      m.forEach((l) => l.sort((a, b) => (b.valores.inicioEm || b.criadoEm) - (a.valores.inicioEm || a.criadoEm)));
      ciclos = m; versaoDosCiclos = versaoRegistros;
    }
    return ciclos;
  }
  const cicloAtual = (n) => (ciclosPorDorna().get(n) || [])[0] || null;
  /** O enchimento que estava na dorna num dia (para a folha de um dia que já passou). */
  const cicloNoDia = (n, data) => (ciclosPorDorna().get(n) || []).find((r) => r.data <= data) || null;
  function etapaFerm(r) {
    if (!r || r.valores.esvaziada) return 'vazia';
    const vol = r.valores.volante || [];
    if (vol.some((s) => !s.fim)) return 'volante';
    if (vazio(r.valores.enche_fim)) return 'enchendo';
    return vol.length ? 'com vinho' : 'fermentando';
  }
  const NOME_ETAPA = { vazia: 'vazia', enchendo: 'enchendo', fermentando: 'fermentando', volante: 'na volante', 'com vinho': 'com vinho' };
  /** A última medição da dorna (Brix, volume, fermentando) depois que ela foi enchida, até o dia pedido. */
  function medicaoDaDorna(n, ciclo, ateData) {
    const g = grupoDaMedicao(prancheta(PID_FERMENTACAO).grupoMedicao);
    const d = g && g.dornas.find((x) => numeroDaDorna(x) === n);
    if (!d) return null;
    const desde = ciclo ? ciclo.valores.inicioEm || 0 : 0;
    const fim = ateData || dataProducao();
    for (let i = 0; i < DIAS_NO_CHEFE; i++) {
      const data = somarDias(fim, -i);
      if (ciclo && data < ciclo.data) break;
      const reg = pegar(data, PID_MEDICAO, g.id);
      if (!reg) continue;
      const v = reg.valores;
      if (vazio(v[d.id + '_folga']) && vazio(v[d.id + '_brix']) && vazio(v[d.id + '_ferm'])) continue;
      const em = momentoDe(data, v.hora) || reg.atualizadoEm;
      if (desde && em < desde) return null; // medida de antes deste enchimento (era o vinho anterior)
      return { data, hora: v.hora || '', brix: v[d.id + '_brix'], ferm: v[d.id + '_ferm'], volume: volDoRegistro(reg, d, g), operador: reg.operador || '' };
    }
    return null;
  }
  /** Quem está mandando para a volante agora. */
  const naVolante = () => dornasDeFermentacao().map(({ n }) => ({ n, r: cicloAtual(n) })).filter((x) => etapaFerm(x.r) === 'volante')
    .map((x) => Object.assign({ n: x.n }, (x.r.valores.volante || []).find((s) => !s.fim)));
  function novoCiclo(n, val, operador) {
    const agora = Date.now();
    const data = dataProducao();
    let inicioEm = momentoDe(data, val.enche_inicio) || agora;
    if (inicioEm > agora + 60000) inicioEm -= 86400000; // hora de antes das 07:00 anotada depois: foi na véspera
    return gravar(data, PID_FERMENTACAO, `${n}-${agora.toString(36)}`, Object.assign({ dorna: n, enche_inicio: '', enche_fim: '', brix_inicial: '', inicioEm, volante: [], esvaziada: null }, val), { operador });
  }
  const mudarCiclo = (r, mudanca, extra = {}) => gravar(r.data, PID_FERMENTACAO, r.chave, mudanca, extra);
  /** A folha das dornas de fermentação num dia: o enchimento, a medição e o que foi para a volante naquele dia. */
  function fermentacaoDoDia(data) {
    return dornasDeFermentacao().map(({ n, d }) => {
      let c = cicloNoDia(n, data);
      if (c && c.valores.esvaziada && c.valores.esvaziada.data < data) c = null; // já estava vazia
      const v = c ? c.valores : {};
      const med = c ? medicaoDaDorna(n, c, data) : null;
      const volante = (ciclosPorDorna().get(n) || []).flatMap((r) => (r.valores.volante || []).filter((s) => s.data === data));
      return {
        n, d, ciclo: c, etapa: etapaFerm(c), enchidaEm: c ? c.data : '', inicio: v.enche_inicio || '', fim: v.enche_fim || '', brixInicial: v.brix_inicial || '', operador: c ? c.operador || '' : '',
        medicao: med, volante, esvaziou: v.esvaziada ? v.esvaziada : null,
      };
    });
  }

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
    if (cfg.chave && caminho !== 'api/ping' && caminho !== 'api/parear') {
      const r = await pedirCifrado(baseCentral(), caminho, opcoes, ms);
      // aparelho bloqueado pelo administrador (423): a tela trava
      if (r.status === 423) {
        const d = await r.clone().json().catch(() => ({}));
        conhecerCentralDoBloqueio(d.geracao);
        aplicarBloqueio(d.bloqueio);
      }
      return r;
    }
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

      // liberado aqui com a senha de desbloqueio: a central fica sabendo (e confere a senha de novo)
      if (cfg.liberacao) {
        const rl = await postJson('api/liberar', { codigo: cfg.liberacao.codigo, em: cfg.liberacao.em, rev: cfg.liberacao.rev || 0, geracao: cfg.liberacao.geracao || '' }, 10000);
        if (rl.ok) { cfg.liberacao = null; salvarCfg(); }
        else if (rl.status === 403) { const d = await rl.json().catch(() => ({})); cfg.liberacao = null; conhecerCentralDoBloqueio(d.geracao); salvarCfg(); aplicarBloqueio(d.bloqueio); return; }
        else if (rl.status === 423) { cfg.liberacao = null; salvarCfg(); return; }
      }
      // em lotes: um aparelho que ficou muito tempo sem Wi-Fi não manda tudo de uma vez
      const envio = Object.values(registros).filter((r) => !r.sincronizado && !r.esperaEntrar).slice(0, LOTE_ENVIO)
        // a configuração vai com a revisão que este aparelho conhece (a central recusa se outro tablet mudou antes)
        .map((r) => (r.data === 'config' ? Object.assign({}, r, { base: r.rev || 0 }) : r));
      const erros = errosGuardados.slice();
      const antesDoEnvio = Date.now();
      const r1 = await postJson('api/sync', { aparelho: cfg.deviceId, papel: cfg.papel, nome: nomeDesteAparelho(), info: infoAparelho, operador: operadorAtual(), versao: VERSAO, geracao: cfg.geracao || '', novaConexao: !!cfg.novaConexao, registros: envio, erros }, 15000);
      if (r1.status === 401) {
        // o servidor está neste aparelho: pega a chave nova com ele (o código de conexão foi trocado)
        if (centralNoTablet()) { try { const e = await pluginCentral.estado(); if (e && e.chave) { usarChaveDaRede(e.chave); salvarCfg(); } } catch (x) { /* tenta de novo */ } return; }
        return desconectar('O código de conexão mudou (ou a central foi trocada). Digite o código novo que aparece no tablet chefe.');
      }
      if (r1.status === 423) return; // a tela já travou (buscar)
      const resp1 = r1.ok ? await r1.clone().json().catch(() => ({})) : {};
      if (r1.ok && resp1.geracao && !resp1.zerar) {
        // a central aceitou: "este aparelho está livre até a revisão X" (da central dela)
        const revCentral = Number(resp1.bloqueiosRev) || 0;
        const mesmaCentral = resp1.geracao === cfg.blqGeracao;
        conhecerCentralDoBloqueio(resp1.geracao);
        // um bloqueio daqui mais novo que X (veio da nuvem enquanto esta resposta vinha) continua
        if (cfg.bloqueio && (!mesmaCentral || revCentral >= (cfg.bloqueio.rev || 0))) liberarAparelho('O administrador liberou este aparelho.', revCentral);
        if (revCentral > (cfg.revLiberada || 0)) { cfg.revLiberada = revCentral; salvarCfg(); }
      }
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
        // o que a central recusou (versão 2.12) volta a ser como está na central, e a pessoa fica sabendo
        const recusados = Array.isArray(resp1.recusados) ? resp1.recusados : [];
        const ids = new Set(recusados.map((x) => x.id));
        let semSessao = false;
        recusados.forEach((x) => {
          // anotação recusada no tablet chefe (ninguém dentro, ou quem está não pode): não se perde. Fica guardada aqui
          // e vai de novo quando alguém entrar neste aparelho
          const local = registros[x.id];
          if (local && local.data !== 'config' && x.motivo !== 'invalido') { local.esperaEntrar = true; semSessao = semSessao || x.motivo === 'sem_sessao'; return; }
          if (x.atual) registros[x.id] = Object.assign({}, x.atual, { sincronizado: true });
          else delete registros[x.id];
        });
        if (recusados.length) avisarRecusa(recusados);
        // a central não tem mais ninguém dentro deste aparelho (o nível mudou, a pessoa saiu de outro jeito): entra de novo
        if (semSessao && cfg.pessoa) { cfg.pessoa = null; salvarCfg(); render(); }
        envio.forEach((e) => { const atual = registros[e.id]; if (!ids.has(e.id) && atual && atual.atualizadoEm === e.atualizadoEm) { atual.sincronizado = true; delete atual.esperaEntrar; } });
        // a revisão nova da configuração aceita (a próxima mudança vai com ela)
        Object.entries(resp1.revs || {}).forEach(([id, rev]) => { if (registros[id]) registros[id].rev = rev; });
        salvarRegistros();
        if (recusados.length) render(true);
      }
      if (r1.ok) {
        const resp = await r1.json().catch(() => ({}));
        if (erros.length) { errosGuardados.splice(0, erros.length); LS.set('erros', errosGuardados); }
        if (resp.agora) conferirRelogio(resp.agora - (antesDoEnvio + Date.now()) / 2);
        // longe da usina, o aparelho pergunta na nuvem se foi bloqueado
        if (typeof resp.nuvem === 'string' && resp.nuvem !== (cfg.nuvemUrl || '')) { cfg.nuvemUrl = resp.nuvem; salvarCfg(); }
        // a chave deste aparelho para a fila da nuvem (versão 2.13), para quando estiver longe da central
        if (typeof resp.nuvemToken === 'string' && resp.nuvemToken !== (cfg.nuvemToken || '')) { cfg.nuvemToken = resp.nuvemToken; salvarCfg(); }
        sync.avisouNuvem = false;
        // tablet chefe (versão 2.12): de minuto em minuto confere com a central quem está aqui e o que pode
        if (ehCentral() && cfg.pessoa && Date.now() - (sync.quemEm || 0) > 60000) { sync.quemEm = Date.now(); conferirSessao(); }
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
          // anotação guardada esperando alguém entrar não é trocada pela da central (ela ainda vai subir)
          if (!local || (!local.esperaEntrar && rec.atualizadoEm > local.atualizadoEm)) { registros[rec.id] = Object.assign({}, rec, { sincronizado: true }); mudou = true; }
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
      if (mudou && ['central', 'inicio', 'prancheta', 'config', 'aparelhos'].includes(view().tela)) {
        if (podeRedesenhar()) render(); else redesenharDepois = true;
      }
      if (mudou && view().tela === 'avisos') atualizarTelaAvisos();
      revisarAvisoNaTela();
      verificarAvisos();
      if (envio.length === LOTE_ENVIO) sincronizarLogo(); // ainda tem anotação esperando: manda o próximo lote
    } catch (e) {
      sync.modo = 'offline';
      sync.falhas = (sync.falhas || 0) + 1;
      conferirNaNuvem();
      mandarParaNuvem();
      // no aplicativo: depois de umas falhas seguidas, procura o tablet chefe no Wi-Fi (no máximo a cada 3 minutos)
      if (NO_APK && sync.falhas >= 3 && Date.now() - (sync.ultimaBusca || 0) > 180000) { sync.ultimaBusca = Date.now(); setTimeout(reencontrarCentral, 0); }
    } finally {
      sync.ocupado = false;
      if (bloqueadoAntes !== foraDaRede()) render(); else atualizarConexao();
    }
  }
  /* Longe da central (outra rede, 4G), versão 2.13: depois de 2 minutos sem achar a central, o que ainda não subiu vai
     para a fila da nuvem. A central puxa a fila e confere tudo como se o aparelho tivesse sincronizado (a mais nova vale).
     A anotação continua esperando a central: quando ela voltar, sobe direto também (repetida não muda nada). */
  async function mandarParaNuvem() {
    if (cfg.demo || !cfg.nuvemUrl || !cfg.nuvemToken || sync.enviandoNuvem) return;
    if (Date.now() - (cfg.ultimoContato || 0) < 2 * 60000 || Date.now() - (sync.nuvemEm || 0) < 60000) return;
    const lista = Object.values(registros).filter((r) => !r.sincronizado && !r.esperaEntrar && r.naNuvem !== r.atualizadoEm).slice(0, 200);
    if (!lista.length) return;
    sync.enviandoNuvem = true; sync.nuvemEm = Date.now();
    try {
      const corpo = lista.map(({ sincronizado, naNuvem, esperaEntrar, ...r }) => (r.data === 'config' ? Object.assign(r, { base: r.rev || 0 }) : r));
      const r = await fetch(`${cfg.nuvemUrl.replace(/\/+$/, '')}/fila`, {
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.nuvemToken, 'X-Aparelho': cfg.deviceId },
        body: JSON.stringify({ registros: corpo, geracao: cfg.geracao || '' }),
      });
      if (!r.ok) return;
      lista.forEach((x) => { const local = registros[x.id]; if (local && local.atualizadoEm === x.atualizadoEm) local.naNuvem = x.atualizadoEm; });
      salvarRegistros();
      if (!sync.avisouNuvem) { sync.avisouNuvem = true; toast('Sem a central: as anotações foram pela internet. A central pega quando puder.', 'ok'); }
    } catch (e) { /* sem internet também: tenta de novo daqui a um minuto */ } finally { sync.enviandoNuvem = false; }
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
    if (cfg.demo || !cfg.chave || !/^\d{4}-\d{2}-\d{2}$/.test(data || '') || data >= primeiroDiaGuardado()) return Promise.resolve();
    if (promessasDoDia.has(data)) return promessasDoDia.get(data);
    const promessa = (async () => {
      diasAbertos.add(data); diasBuscando.add(data);
      try {
        const r = await buscar('api/registros?dia=' + data, {}, 20000);
        if (!r.ok) throw new Error('central');
        const dados = await r.json();
        (dados.registros || []).forEach((rec) => {
          const local = registros[rec.id];
          if (!local || (!local.esperaEntrar && rec.atualizadoEm > local.atualizadoEm)) registros[rec.id] = Object.assign({}, rec, { sincronizado: true });
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
    if (ehEscritorio()) {
      if (cfg.escritorio && Date.now() >= cfg.escritorio.ate) {
        cfg.escritorio = null; salvarCfg();
        if (modalAberto()) fecharModalAtual();
        pilha = [telaInicial()]; render(true); toast('Ficou 10 minutos sem mexer: entre de novo com a senha');
      }
      return;
    }
    if (ehCentral()) {
      if (cfg.pessoa && !cfg.demo) {
        if (Date.now() - pessoaAtivaEm >= limitePessoa()) sairDoChefe(`ficou ${C.minutosSemMexer || 30} minutos sem mexer`);
        else if (cfg.pessoaAtivaEm !== pessoaAtivaEm) { cfg.pessoaAtivaEm = pessoaAtivaEm; salvarCfg(); }
      }
      return;
    }
    if (!cfg.papel || !operadorAtual()) return;
    if (Date.now() - ultimaAtividade < (C.minutosSemMexer || 30) * 60000) return;
    if (modalAberto()) fecharModalAtual();
    if (rascunhoSujo()) salvarRascunho(true);
    registrar('entrada', `${operadorAtual()} saiu do ${nomeDesteAparelho()} (ficou ${C.minutosSemMexer || 30} minutos sem mexer)`);
    cfg.op = null; salvarCfg();
    rascunho = null; ed.alvoId = null;
    pilha = [telaInicial(), { tela: 'operador', travado: true }];
    render();
    marcarAtividade();
  }
  const chaveTurno = () => `${dataProducao()}-${turnoAtual().id}`;
  const operadorAtual = () => (cfg.op && cfg.op.chave === chaveTurno() ? cfg.op.nome : null);
  function definirOperador(nome) {
    const antes = operadorAtual();
    cfg.op = { nome, chave: chaveTurno() }; salvarCfg();
    if (antes !== nome && !cfg.demo && typeof registrar === 'function') registrar('entrada', `${nome} entrou no ${nomeDesteAparelho()}${antes ? ` (no lugar de ${antes})` : ''}`);
  }

  /* =========================================================
   * Atualização do aplicativo (versões 2.7 e 2.8). Dois jeitos:
   *  - rápida (telas): só o HTML, o CSS e o JavaScript mudaram. O pacote das telas vem da central (telas/)
   *    ou da nuvem, assinado no computador do Guilherme. O aplicativo baixa só o que mudou, mostra a barra
   *    e abre de novo sozinho, sem janela do Android. Se a versão nova não abrir, volta para a de antes.
   *  - APK: a parte em Java mudou (o pacote pede um APK mais novo que o deste tablet). O APK desce pelo
   *    Wi-Fi e o Android pergunta se pode instalar.
   * Achou versão nova: abre a janela (quando ninguém está anotando) e deixa o botão Atualizar no alto.
   * As anotações deste aparelho continuam nos dois jeitos.
   * ========================================================= */
  const atualizacao = { nova: null, procurando: false, avisada: '', nativa: '' };
  /** '2.7.0' vira 20700, para comparar versões. É também o número de versão do APK (versionCode). */
  const numeroDaVersao = (v) => { const p = String(v || '').split('.').map((x) => parseInt(x, 10) || 0); return (p[0] || 0) * 10000 + (p[1] || 0) * 100 + (p[2] || 0); };
  const podeAtualizar = () => NO_APK && !!pluginCentral && !!pluginCentral.atualizar;
  async function lerJson(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try { const r = await fetch(url, { cache: 'no-store', signal: ctrl.signal }); return r.ok ? await r.json() : null; } catch (e) { return null; } finally { clearTimeout(t); }
  }
  async function procurarAtualizacao(avisar) {
    if (!podeAtualizar() || atualizacao.procurando || cfg.demo) return;
    atualizacao.procurando = true;
    try {
      if (!atualizacao.nativa && pluginCentral.versaoInstalada) atualizacao.nativa = ((await pluginCentral.versaoInstalada().catch(() => null)) || {}).versao || '';
      const nativa = atualizacao.nativa || VERSAO;
      // de onde: a central (para os tablets dos setores) e a nuvem (para o tablet chefe, quando ela estiver ligada)
      const bases = [];
      if (cfg.central && !centralNoTablet()) bases.push({ apk: baseCentral() + 'api/versao', telas: baseCentral() + 'telas/' });
      const nuvem = sync.status && sync.status.nuvem && sync.status.nuvem.ligada ? sync.status.nuvem.url : '';
      const online = C.atualizacaoOnline ? C.atualizacaoOnline.replace(/\/?$/, '/') : centralNoTablet() && nuvem ? nuvem + '/atualizacao/' : '';
      if (online) bases.push({ apk: online + 'versao.json', telas: new URL('../telas/', online).href });
      // a mais nova ganha; na mesma versão, a rápida (sem janela do Android)
      let melhor = null;
      const considerar = (c) => {
        const ref = melhor ? melhor.versao : VERSAO;
        if (numeroDaVersao(c.versao) > numeroDaVersao(ref) || (melhor && c.versao === melhor.versao && c.tipo === 'telas' && melhor.tipo === 'apk')) melhor = c;
      };
      for (const b of bases) {
        const t = await lerJson(b.telas + 'pacote.json');
        // o pacote pede um APK mais novo que o deste tablet: esse vem pelo APK
        if (t && t.versao && numeroDaVersao(t.apkMinimo) <= numeroDaVersao(nativa)) considerar({ tipo: 'telas', versao: t.versao, novidades: t.novidades, base: b.telas });
        const v = await lerJson(b.apk);
        if (v && v.versao) considerar(Object.assign({}, v, { tipo: 'apk', url: new URL(v.url || 'pranchetas.apk', b.apk).href }));
      }
      const mudou = (melhor && melhor.versao) !== (atualizacao.nova && atualizacao.nova.versao);
      atualizacao.nova = melhor;
      if (mudou && !modalAberto()) render();
      if (avisar) toast(melhor ? `Tem a versão ${melhor.versao} para instalar` : `Este aparelho já está com a versão mais nova (${VERSAO})`);
      else avisarAtualizacao();
    } finally {
      atualizacao.procurando = false;
    }
  }
  /** Achou versão nova: abre a janela uma vez. Se alguém estiver anotando, espera (tenta de novo a cada minuto). */
  function avisarAtualizacao() {
    const n = atualizacao.nova;
    if (!n || atualizacao.avisada === n.versao || !podeRedesenhar()) return;
    atualizacao.avisada = n.versao;
    oferecerAtualizacao();
  }
  /** Novidades das versões depois de "de" até esta. Sem "de": só as desta versão. */
  const novidadesDesde = (de) => (window.NOVIDADES || []).filter((n) => (de ? numeroDaVersao(n.versao) > numeroDaVersao(de) && numeroDaVersao(n.versao) <= numeroDaVersao(VERSAO) : n.versao === VERSAO));
  const htmlNovidades = (lista) => `<div class="novidades-lista">${lista.map((n) => `${lista.length > 1 ? `<h4>Versão ${esc(n.versao)}</h4>` : ''}<ul>${(n.itens || []).map((i) => `<li>${esc(i).replace(/-/g, '\u2011')}</li>`).join('')}</ul>`).join('')}</div>`;
  function mostrarNovidades(de) {
    const lista = novidadesDesde(de);
    if (!lista.length) return;
    if (modalAberto()) { setTimeout(() => mostrarNovidades(de), 3000); return; } // espera fechar a janela que está aberta (aviso do escritório)
    abrirModal(`<h3>${de ? `Aplicativo atualizado: versão ${esc(VERSAO)}` : `Novidades da versão ${esc(VERSAO)}`}</h3>
      ${de ? '<p class="dica">O que mudou:</p>' : ''}${htmlNovidades(lista)}
      <div class="acoes-modal um"><button class="btn primario" data-k="ok">Entendi</button></div>`, (k, b, fechar) => { if (k === 'ok') fechar(true); }, { classe: 'largo com-novidades' });
  }
  /** Abriu numa versão nova: mostra uma vez o que mudou. Aparelho que ainda não tem função escolhida não precisa. */
  function conferirNovidades() {
    const antes = cfg.versaoVista || (cfg.papel ? '2.6.0' : VERSAO); // a 2.6 não guardava a versão vista
    if (cfg.versaoVista !== VERSAO) { cfg.versaoVista = VERSAO; salvarCfg(); }
    if (numeroDaVersao(antes) < numeroDaVersao(VERSAO)) setTimeout(() => mostrarNovidades(antes), 900);
  }
  /** Janela da versão nova: o que mudou, a barra do download e o botão Atualizar agora. */
  async function oferecerAtualizacao() {
    const n = atualizacao.nova;
    if (!n) return;
    const rapida = n.tipo === 'telas';
    const lista = Array.isArray(n.novidades) ? n.novidades.filter((x) => numeroDaVersao(x.versao) > numeroDaVersao(VERSAO)) : [];
    const mb = !rapida && n.tamanho ? ` (${(n.tamanho / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB)` : '';
    let baixando = false, pronto = false;
    await abrirModal(`<h3>Versão nova: ${esc(n.versao)}</h3>
      <p class="dica">Este aparelho está com a ${esc(VERSAO)}. As anotações daqui não se perdem.</p>
      ${lista.length ? htmlNovidades(lista) : ''}
      <div class="barra-progresso" id="barra-atualizacao" hidden><i></i></div>
      <p class="dica passo-atualizacao" id="passo-atualizacao">${rapida ? 'Toque em Atualizar agora: o aplicativo baixa só o que mudou e abre de novo sozinho.' : `Toque em Atualizar agora e confirme na janela do Android${mb}.`}</p>
      <div class="acoes-modal"><button class="btn" data-k="x">Depois</button><button class="btn primario" data-k="ok">${ico('instalar')} Atualizar agora</button></div>`,
    async (k, b, fechar, f) => {
      if (k === 'x') return baixando || pronto ? undefined : fechar(undefined);
      if (k !== 'ok' || baixando || pronto) return;
      baixando = true; b.disabled = true;
      const passo = f.querySelector('#passo-atualizacao');
      const barra = f.querySelector('#barra-atualizacao');
      const mostrar = (feito, total) => {
        if (!total) return;
        const pc = Math.min(100, Math.floor((feito * 100) / total));
        barra.hidden = false; barra.firstElementChild.style.width = pc + '%';
        passo.textContent = `Baixando: ${pc}%`;
      };
      passo.textContent = 'Baixando...';
      let ouvinte = null;
      try {
        ouvinte = await pluginCentral.addListener(rapida ? 'progressoTelas' : 'progressoAtualizacao', (p) => { if (p) mostrar(rapida ? p.feito : p.baixado, p.total); });
      } catch (e) { /* sem a barra, baixa do mesmo jeito */ }
      try {
        if (rapida) {
          await pluginCentral.atualizarTelas({ base: n.base, versao: n.versao });
          pronto = true;
          mostrar(1, 1);
          passo.textContent = 'Pronto. Abrindo a versão nova...'; // o aplicativo recarrega sozinho e mostra as novidades
          return;
        }
        const r = await pluginCentral.atualizar({ url: n.url, sha256: n.sha256 || '', tamanho: n.tamanho || 0 });
        if (r && r.precisaPermissao) {
          passo.textContent = 'Falta uma permissão. Na tela que abriu, ligue "Permitir desta fonte", volte para cá e toque em Atualizar agora de novo.';
        } else {
          fechar(true);
          toast('Agora toque em Atualizar na janela do Android');
        }
      } catch (e) {
        passo.textContent = `Não deu certo: ${(e && e.message) || e}. Confira o Wi-Fi e tente de novo.`;
      } finally {
        baixando = false;
        if (!pronto) b.disabled = false;
        if (ouvinte && ouvinte.remove) ouvinte.remove();
      }
    }, { classe: 'largo com-novidades' });
  }

  /* =========================================================
   * Pessoas do escritório e registro do sistema (versão 2.9)
   * No tablet chefe cada pessoa entra com a sua senha (só a senha já diz quem é). O painel fica sempre à vista;
   * quando alguém faz algo que precisa de permissão, o aplicativo pede a senha uma vez. Depois de 30 minutos
   * sem mexer, a pessoa sai sozinha. O que cada uma pode fazer: o nível dela (forms.js), o ajuste do
   * administrador e o que aquele tablet chefe deixa fazer. O administrador pode tudo.
   * O registro guarda cada mudança (hora, quem, aparelho, antes e depois). O aplicativo escreve o que a pessoa
   * fez; a central escreve entradas, aparelhos e código. Ele não fica nos tablets: o chefe pede o dia na central.
   * ========================================================= */
  const PID_REGISTRO = 'registro';
  // quando a pessoa mexeu pela última vez (um toque depois de 30 minutos parado não volta a valer: tem de entrar de novo)
  let pessoaAtivaEm = Number(cfg.pessoaAtivaEm) || 0;
  const limitePessoa = () => (C.minutosSemMexer || 30) * 60000;
  let demoSemPessoa = false; // demonstração do tablet chefe sem ninguém (para conferir a tela)
  const pessoaAtual = () => {
    if (cfg.demo && ehCentral()) return demoSemPessoa ? null : { nome: 'Guilherme', nivel: 'administrador', extras: {}, teto: null, dono: true };
    if (!ehCentral() || !cfg.pessoa) return null;
    return Date.now() - pessoaAtivaEm < limitePessoa() ? cfg.pessoa : null;
  };
  document.addEventListener('pointerdown', () => { if (pessoaAtual()) pessoaAtivaEm = Date.now(); }, { passive: true, capture: true });
  /** O que a pessoa pode fazer: o nível, o ajuste do administrador e o que este tablet chefe deixa. */
  function funcoesDe(p) {
    if (!p) return new Set();
    // versão 2.12: a central diz o que vale neste aparelho (a pessoa, o nível do tablet chefe e o limite dele)
    if (Array.isArray(p.funcoes)) return new Set(p.funcoes);
    const todas = C.funcoes.map((f) => f.id);
    if (p.dono) return new Set([...todas, 'pessoas', 'chefes', 'sistema']); // sem a central (demonstração): o dono pode tudo
    if (p.nivel === 'administrador') return new Set([...todas, 'pessoas']);
    const nivel = C.niveis[p.nivel] || { funcoes: [] };
    const s = new Set(nivel.funcoes === 'todas' ? todas : nivel.funcoes);
    Object.entries(p.extras || {}).forEach(([f, sim]) => { if (sim) s.add(f); else s.delete(f); });
    if (Array.isArray(p.teto)) [...s].forEach((f) => { if (!p.teto.includes(f)) s.delete(f); });
    return s;
  }
  const pode = (f) => funcoesDe(pessoaAtual()).has(f);
  const nomeDaFuncao = (f) => ((C.funcoes.find((x) => x.id === f) || {}).nome || 'isso').replace(/ \(.*\)$/, '').toLowerCase();
  /** Antes de uma ação do tablet chefe: confere a permissão (e pede a senha se ninguém entrou). */
  async function exigir(f) {
    if (pode(f)) { pessoaAtivaEm = Date.now(); return true; }
    if (!ehCentral()) return verificarNoSetor(f);
    if (!pessoaAtual()) {
      if (!(await entrarNoChefe())) return false;
      if (pode(f)) return true;
    }
    toast(`${pessoaAtual().nome} não pode ${nomeDaFuncao(f)}. Peça ao administrador.`, 'erro');
    return false;
  }
  async function entrarNoChefe(pinPronto) {
    const pin = pinPronto || await pedirSenhaModal('Quem está usando?', 'Digite a sua senha. Ela diz quem você é.');
    if (pin === undefined) return false;
    const r = await postJson('api/pessoas', { acao: 'entrar', pin }, 10000).catch(() => null);
    if (!r) { toast('Não consegui falar com a central', 'erro'); return false; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      // tablet chefe que a central ainda não conhece (versão 2.12): libera e entra
      if (d.naoLiberado) { const outra = await liberarEsteAparelho(); return outra === undefined ? false : entrarNoChefe(outra || undefined); }
      toast(d.erro || 'Senha errada', 'erro');
      return false;
    }
    pessoaAtivaEm = Date.now();
    if (d.nivel) cfg.nivelChefe = d.nivel;
    cfg.pessoa = Object.assign({}, d.pessoa, { teto: d.teto || null }, Array.isArray(d.funcoes) ? { funcoes: d.funcoes, dono: !!d.dono } : {}); cfg.pessoaAtivaEm = pessoaAtivaEm; salvarCfg();
    // o que a central não aceitou por falta de alguém dentro (ou de permissão) vai de novo, agora com esta pessoa
    let guardadas = 0;
    Object.values(registros).forEach((r) => { if (r.esperaEntrar) { delete r.esperaEntrar; guardadas += 1; } });
    if (guardadas) { salvarRegistros(); sincronizarLogo(); }
    toast(`Olá, ${d.pessoa.nome}`);
    mandarFolhasParaCentral();
    render();
    return true;
  }
  /* ---------- Liberar este aparelho como tablet chefe (versão 2.12) ----------
     A central só deixa entrar pessoa num tablet chefe liberado, com uma senha: o nível 3 (configurações do sistema)
     só o dono; o 1 ou o 2, quem libera tablets chefe (o administrador). Devolve a senha usada, para já entrar com ela
     (null: entrar pedindo a senha; undefined: não liberou). */
  const nomeDoNivelChefe = (n) => ((C.niveisDoAparelho || {})[n] || {}).nome || `Nível ${n}`;
  async function liberarEsteAparelho() {
    const niveis = C.niveisDoAparelho || {};
    let escolhido = 2;
    const resp = await abrirModal(`<h3>Liberar este aparelho como tablet chefe</h3>
      <p class="dica">Escolha o que este tablet chefe vai poder fazer. Depois, quem libera tablets chefe (o administrador) digita a senha. O nível 3 só o dono do sistema libera.</p>
      <div class="opcoes-nivel">${[1, 2, 3].map((n) => `<button class="nivel-op" data-k="n:${n}"><b>${esc(nomeDoNivelChefe(n))}</b><span>${esc((niveis[n] || {}).texto || '')}</span></button>`).join('')}</div>
      <div class="linha-botoes"><button class="btn pequeno" data-k="recuperar">Sou o dono e perdi a senha ou o tablet</button></div>
      <div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn primario" data-k="ok">Continuar</button></div>`,
    (k, b, fechar, f) => {
      if (k === 'x') return fechar(undefined);
      if (k === 'recuperar') return fechar('recuperar');
      if (k.startsWith('n:')) { escolhido = Number(k.slice(2)); f.querySelectorAll('[data-k^="n:"]').forEach((x) => x.classList.toggle('sel', x.dataset.k === k)); return; }
      if (k === 'ok') fechar(escolhido);
    }, { classe: 'largo com-niveis', aoAbrir: (f) => f.querySelector('[data-k="n:2"]').classList.add('sel') });
    if (resp === undefined) return undefined;
    if (resp === 'recuperar') return recuperarDono();
    const pin = await pedirSenhaModal(`Senha para liberar o ${nomeDoNivelChefe(resp)}`, resp === 3 ? 'Só a senha do dono do sistema libera o nível 3.' : 'A senha de quem libera tablets chefe (o administrador).');
    if (pin === undefined) return undefined;
    const r = await postJson('api/chefes', { acao: 'liberar', pin, nivel: resp }, 10000).catch(() => null);
    if (!r) { toast('Não consegui falar com a central', 'erro'); return undefined; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(d.erro || 'A central recusou', 'erro'); return undefined; }
    cfg.nivelChefe = d.nivel; salvarCfg();
    toast(`Aparelho liberado: tablet chefe ${nomeDoNivelChefe(d.nivel)}`);
    return pin;
  }
  /** O dono esqueceu a senha ou perdeu o tablet nível 3: com a senha do programador, este aparelho vira o dele. */
  async function recuperarDono() {
    const senha = await pedirSenhaModal('Senha do programador', 'Com ela, este aparelho vira o tablet do dono (nível 3).');
    if (senha === undefined) return undefined;
    const trocar = await confirmar('Trocar a senha do dono?', 'Se você esqueceu a sua senha, escolha uma nova agora. Se só perdeu o tablet, pode manter a de hoje.', 'Escolher senha nova');
    let novaSenha = '';
    if (trocar) { novaSenha = await pedirSenhaModal('Nova senha do dono', 'De 4 a 8 números.'); if (novaSenha === undefined) return undefined; }
    const r = await postJson('api/chefes', { acao: 'recuperar', senha, novaSenha }, 30000).catch(() => null);
    if (!r) { toast('Não consegui falar com a central', 'erro'); return undefined; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(d.erro || 'A central recusou', 'erro'); return undefined; }
    cfg.nivelChefe = 3; salvarCfg();
    toast('Este aparelho agora é o tablet do dono (nível 3)');
    return trocar ? novaSenha : null;
  }
  /** Ao escolher "Tablet chefe": se a central ainda não liberou este aparelho, libera agora. */
  async function garantirLiberacaoDeChefe() {
    const r = await postJson('api/chefes', { acao: 'estado' }, 8000).catch(() => null);
    if (!r || !r.ok) return true; // central de antes da 2.12 (sem a rota) ou sem resposta: ela confere de novo quando a pessoa entrar
    const d = await r.json().catch(() => ({}));
    if (d.nivel) { cfg.nivelChefe = d.nivel; return true; }
    return (await liberarEsteAparelho()) !== undefined;
  }
  /** A central diz quem está neste tablet chefe e o que pode. Se a sessão caiu (o nível mudou, a pessoa foi
      desativada, outra pessoa entrou), sai daqui também; se as funções mudaram, passa a valer na hora. */
  async function conferirSessao() {
    const r = await postJson('api/pessoas', { acao: 'quem' }, 8000).catch(() => null);
    if (!r || !r.ok || !cfg.pessoa) return;
    const d = await r.json().catch(() => ({}));
    if (d.nivel) cfg.nivelChefe = d.nivel;
    if (!d.pessoa || d.pessoa.id !== cfg.pessoa.id) {
      cfg.pessoa = null; salvarCfg();
      toast('Você saiu deste tablet chefe (o nível dele mudou ou a sessão acabou). Entre de novo.');
      return render();
    }
    if (Array.isArray(d.funcoes) && JSON.stringify(d.funcoes) !== JSON.stringify(cfg.pessoa.funcoes || null)) {
      cfg.pessoa = Object.assign({}, cfg.pessoa, { funcoes: d.funcoes, dono: !!d.dono }); salvarCfg();
      if (!modalAberto()) render();
    }
  }
  function sairDoChefe(motivo) {
    if (!cfg.pessoa) return;
    postJson('api/pessoas', { acao: 'sair', motivo: motivo || '' }, 5000).catch(() => {});
    cfg.pessoa = null; salvarCfg();
    render();
  }
  /** Tablet de setor (ajustes, liberar operador): a central confere a senha. Sem a central, só a senha de emergência. */
  async function verificarNoSetor(f, titulo, dica) {
    const pin = await pedirSenhaModal(titulo, dica);
    if (pin === undefined) return false;
    const r = cfg.demo ? null : await postJson('api/pessoas', { acao: 'verificar', pin }, 6000).catch(() => null);
    if (!r) {
      if (pin === C.pinAdmin) return true;
      toast(cfg.demo ? 'Senha errada' : 'Sem a central: só a senha do administrador funciona agora', 'erro');
      return false;
    }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(d.erro || 'Senha errada', 'erro'); return false; }
    if (!funcoesDe(d.pessoa).has(f)) { toast(`${d.pessoa.nome} não pode ${nomeDaFuncao(f)}`, 'erro'); return false; }
    registrar('entrada', `${d.pessoa.nome} liberou ${nomeDaFuncao(f)} no ${nomeDesteAparelho()}`);
    return true;
  }

  /** A central não aceitou algo deste aparelho: uma notificação só, com o motivo. */
  function avisarRecusa(recusados) {
    const m = recusados.map((x) => x.motivo);
    if (m.includes('conflito')) return toast('A configuração mudou em outro tablet. Confira e faça a mudança de novo.', 'erro');
    if (m.includes('sem_sessao')) return toast('Ninguém entrou neste tablet chefe. O que foi anotado ficou guardado aqui e sobe quando alguém entrar.', 'erro');
    if (recusados.some((x) => registros[x.id] && registros[x.id].esperaEntrar)) return toast('Quem está neste aparelho não pode fazer essa anotação. Ela ficou guardada aqui e sobe quando entrar alguém que pode.', 'erro');
    return toast('Quem está neste aparelho não pode fazer essa mudança. Ela foi desfeita.', 'erro');
  }
  const nomeDesteAparelho = () => (ehCentral() ? nomeDoChefe() : ehEscritorio() ? 'Escritório' : setorPorId(cfg.papel) ? `Tablet da ${setorPorId(cfg.papel).nome}` : 'aparelho');
  const quemEstaAqui = () => operadorAtual() || (pessoaAtual() && pessoaAtual().nome) || (ehCentral() ? nomeDoChefe() : 'Sem operador');
  /** Uma linha no registro do sistema. tipo: anotacao, entrada, aparelho ou configuracao. */
  function registrar(tipo, texto, mudancas) {
    if (cfg.demo || !cfg.chave) return;
    const em = Date.now();
    const chave = em.toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    gravar(dataProducao(), PID_REGISTRO, chave, Object.assign({ em, tipo, quem: quemEstaAqui(), aparelho: nomeDesteAparelho(), texto }, mudancas && mudancas.length ? { mudancas } : {}), { operador: quemEstaAqui() });
  }
  const valorNoRegistro = (x) => {
    if (x == null || x === '') return '(vazio)';
    if (Array.isArray(x)) return x.length ? x.map((s) => (s && typeof s === 'object' ? [s.inicio, s.fim].filter(Boolean).join('-') : String(s))).join(', ') : '(vazio)';
    if (typeof x === 'object') return x.hora || x.data || '(marcado)';
    return /^-?\d+\.\d+$/.test(String(x)) ? String(x).replace('.', ',') : String(x);
  };
  /** O que mudou no rascunho (antes e depois de cada quadro, com o nome do quadro). */
  function mudancasDoRascunho() {
    const nomes = {}; alvos.forEach((a) => { nomes[a.id] = a.label; });
    const lista = [];
    const comparar = (antes, depois, prefixo) => Object.keys(Object.assign({}, antes, depois)).forEach((k) => {
      const a = antes ? antes[k] : undefined, d = depois ? depois[k] : undefined;
      const objeto = (x) => x && typeof x === 'object' && !Array.isArray(x) && !('hora' in x) && !('data' in x);
      if (objeto(a) || objeto(d)) return comparar(a || {}, d || {}, (prancheta(k) || {}).nome || k);
      if (/_vol$|^dorna$|Em$/.test(k)) return; // o volume sai da folga; os outros são de controle
      if (JSON.stringify(a == null ? '' : a) === JSON.stringify(d == null ? '' : d)) return;
      lista.push({ campo: (prefixo ? prefixo + ': ' : '') + (nomes[k] || k), antes: valorNoRegistro(a), depois: valorNoRegistro(d) });
    });
    comparar(rascunho.original, rascunho.valores, '');
    const extrasAntes = JSON.parse(rascunho.originalExtras || '{}');
    if ((extrasAntes.obs || '') !== (rascunho.extras.obs || '')) lista.push({ campo: 'Observação', antes: valorNoRegistro(extrasAntes.obs), depois: valorNoRegistro(rascunho.extras.obs) });
    return lista.slice(0, 40);
  }
  /** O que mudou na configuração da usina, em palavras (nunca as senhas). */
  function textoDaConfig(mudanca) {
    const atual = configSistema();
    const partes = [];
    const nomeSetor = (id) => (setorPorId(id) || {}).nome || id;
    Object.keys(mudanca).forEach((k) => {
      const antes = atual[k], depois = mudanca[k];
      if (JSON.stringify(antes) === JSON.stringify(depois)) return;
      if (k === 'operadores') {
        new Set([...Object.keys(antes || {}), ...Object.keys(depois || {})]).forEach((s) => {
          const a = ((antes || {})[s] || []).map(comoOperador), d = ((depois || {})[s] || []).map(comoOperador);
          d.filter((o) => !a.some((x) => x.nome === o.nome)).forEach((o) => partes.push(`cadastrou ${o.nome} na ${nomeSetor(s)}`));
          a.filter((o) => !d.some((x) => x.nome === o.nome)).forEach((o) => partes.push(`tirou ${o.nome} da ${nomeSetor(s)}`));
          d.forEach((o) => { const x = a.find((y) => y.nome === o.nome); if (x && x.senha !== o.senha) partes.push(`${o.senha ? 'trocou' : 'tirou'} a senha de ${o.nome}`); });
        });
      } else if (k === 'setoresDesligados') {
        (depois || []).filter((s) => !(antes || []).includes(s)).forEach((s) => partes.push(`desligou o setor ${nomeSetor(s)}`));
        (antes || []).filter((s) => !(depois || []).includes(s)).forEach((s) => partes.push(`ligou o setor ${nomeSetor(s)}`));
      } else if (k === 'pranchetasDesligadas') partes.push('mudou as folhas ligadas dos setores');
      else if (k === 'medicao') partes.push(depois ? 'mudou as medidas das dornas' : 'voltou para as medidas da planilha');
      else if (k === 'folhas') { /* quem mexe nas folhas escreve o que mudou (editarCampoDaFolha) */ }
      else partes.push({ produtos: 'mudou a lista de produtos', fornecedores: 'mudou a lista de fornecedores', whatsapp: 'mudou o WhatsApp do escritório', email: 'mudou o e-mail do escritório' }[k] || `mudou ${k}`);
    });
    return partes;
  }

  /* ---------- Pessoas e permissões (só o administrador) ---------- */
  function telaPessoas(v) {
    if (!v.lista && !v.carregando) carregarPessoas(v);
    const l = v.lista || { pessoas: [], aparelhos: {} };
    const nivel = (n) => (C.niveis[n] || {}).nome || n;
    const resumoFuncoes = (p) => { const f = funcoesDe(Object.assign({}, p, { teto: null })); return p.id && p.id === l.donoId ? 'dono do sistema, pode tudo' : p.nivel === 'administrador' ? 'tudo' : `${f.size} de ${C.funcoes.length} funções`; };
    const st = sync.status;
    const chefes = new Map();
    ((st && st.aparelhos) || []).filter((a) => a.papel === 'central').forEach((a) => chefes.set(a.id, a));
    Object.keys(l.aparelhos || {}).forEach((id) => { if (!chefes.has(id)) chefes.set(id, { id, papel: 'central', nome: l.aparelhos[id].nome, online: false, minutos: 0 }); });
    return `${topo('Pessoas e permissões', 'Só o administrador mexe aqui', true)}
      <main class="config tela-pessoas">
        <div class="config-grade">
          <section class="bloco">
            <h2>${ico('pessoas')} Pessoas</h2>
            <p class="sub" style="margin:0 0 8px">Cada pessoa entra no tablet chefe com a sua senha. A senha já diz quem é.</p>
            ${v.carregando && !v.lista ? '<p class="sub">Buscando na central...</p>' : l.pessoas.map((p) => `<div class="linha-config ${p.ativo ? '' : 'desligado'}"><span class="escolha-ico">${ico('pessoa')}</span>
              <div><b>${esc(p.nome)}</b><small>${esc(nivel(p.nivel))} · ${esc(resumoFuncoes(p))}${p.ativo ? '' : ' · não entra mais'}</small></div>
              <button class="btn pequeno" data-a="pessoa-editar" data-id="${esc(p.id)}">Mudar</button></div>`).join('')}
            <div class="linha-botoes"><button class="btn pequeno" data-a="pessoa-nova">${ico('mais')} Cadastrar pessoa</button></div>
          </section>
          <section class="bloco">
            <h2>${ico('escritorio')} Tablets chefe</h2>
            <p class="sub" style="margin:0 0 8px">O nível de cada tablet chefe (1: vê, corrige e envia; 2: tudo; 3: só o dono, com as configurações do sistema) e o que ele deixa fazer, seja quem for.</p>
            ${[...chefes.values()].map((a) => {
              const teto = (l.aparelhos[a.id] || {}).teto;
              return `<div class="linha-config"><span class="escolha-ico">${ico('escritorio')}</span>
                <div><b>${esc(a.nome || 'Tablet chefe')}${a.id === cfg.deviceId ? ' (este aparelho)' : ''}</b><small>${(l.aparelhos[a.id] || {}).nivel ? `${esc(nomeDoNivelChefe(l.aparelhos[a.id].nivel))} · ` : 'Não liberado · '}${a.online ? `Ligado${a.pessoa ? `, ${esc(a.pessoa)}` : ', ninguém entrou'}` : 'Sem sinal'} · ${Array.isArray(teto) ? `${teto.length} de ${C.funcoes.length} funções` : 'tudo liberado'}${a.id === cfg.deviceId ? ' · este aparelho' : ''}</small></div>
                <button class="btn pequeno" data-a="aparelho-chefe" data-id="${esc(a.id)}">Mudar</button></div>`;
            }).join('') || '<p class="sub">Nenhum tablet chefe falou com a central ainda.</p>'}
          </section>
        </div>
      </main>`;
  }
  async function carregarPessoas(v) {
    if (cfg.demo) {
      v.lista = { pessoas: [
        { id: 'p1', nome: 'Guilherme', nivel: 'administrador', extras: {}, ativo: true, temSenha: true },
        { id: 'p2', nome: 'Fernando', nivel: 'encarregado', extras: { integracoes: true }, ativo: true, temSenha: true },
        { id: 'p3', nome: 'Lucas', nivel: 'consulta', extras: { ler_folha: true }, ativo: true, temSenha: true },
        { id: 'p4', nome: 'Bruno', nivel: 'encarregado', extras: {}, ativo: false, temSenha: true },
      ], aparelhos: { [cfg.deviceId]: { nome: 'Tablet do escritório', teto: null }, demo2: { nome: 'Tablet da sala de controle', teto: ['anotar', 'avisos', 'relatorios'] } } };
      return;
    }
    v.carregando = true;
    const r = await postJson('api/pessoas', { acao: 'lista' }, 10000).catch(() => null);
    v.carregando = false;
    if (!r) { toast('Não consegui falar com a central', 'erro'); return; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(d.erro || 'A central recusou', 'erro'); voltar(); return; }
    v.lista = d;
    if (view() === v) render();
  }
  /** Os quadradinhos das funções (marcado = pode). */
  const chipsDeFuncoes = (marcadas, prefixo) => `<div class="chips funcoes">${C.funcoes.map((f) => `<button class="chip-liga ${marcadas.has(f.id) ? 'sel' : ''}" data-k="${prefixo}:${f.id}">${marcadas.has(f.id) ? ico('certo') : ico('fechar')} ${esc(f.nome)}</button>`).join('')}</div>`;
  async function editarPessoa(v, id) {
    const atual = id ? (v.lista.pessoas.find((p) => p.id === id) || null) : null;
    const estado = { nivel: atual ? atual.nivel : 'encarregado', extras: Object.assign({}, atual ? atual.extras : {}), ativo: atual ? atual.ativo : true };
    const marcadas = () => funcoesDe({ nivel: estado.nivel, extras: estado.extras });
    const desenhar = (f) => {
      f.querySelectorAll('[data-k^="n:"]').forEach((b) => b.classList.toggle('sel', b.dataset.k === 'n:' + estado.nivel));
      f.querySelector('#funcoes-pessoa').innerHTML = estado.nivel === 'administrador' ? '<p class="sub">O administrador pode tudo, inclusive pessoas e permissões.</p>' : chipsDeFuncoes(marcadas(), 'f');
      f.querySelector('[data-k="ativo"]').classList.toggle('sel', estado.ativo);
    };
    const resp = await abrirModal(`<h3>${atual ? `Mudar ${esc(atual.nome)}` : 'Cadastrar pessoa'}</h3>
      <div class="form-pessoa">
        <label>Nome <input id="p-nome" maxlength="40" autocomplete="off" value="${esc(atual ? atual.nome : '')}"></label>
        <label>Senha (4 a 8 números)${atual ? ' <small>deixe em branco para não trocar</small>' : ''} <input id="p-pin" inputmode="numeric" maxlength="8" autocomplete="off" value=""></label>
        <div class="segmentos quebra">${Object.entries(C.niveis).map(([k, n]) => `<button data-k="n:${k}">${esc(n.nome)}</button>`).join('')}</div>
        <div id="funcoes-pessoa"></div>
        <div class="chips"><button class="chip-liga" data-k="ativo">${ico('certo')} Pode entrar</button></div>
      </div>
      <div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn primario" data-k="ok">Salvar</button></div>`,
    async (k, b, fechar, f) => {
      if (k === 'x') return fechar(undefined);
      if (k.startsWith('n:')) { estado.nivel = k.slice(2); return desenhar(f); }
      if (k.startsWith('f:')) {
        const fn = k.slice(2);
        const padrao = funcoesDe({ nivel: estado.nivel, extras: {} }).has(fn);
        const agora = marcadas().has(fn);
        if (!agora === padrao) delete estado.extras[fn]; else estado.extras[fn] = !agora;
        return desenhar(f);
      }
      if (k === 'ativo') { estado.ativo = !estado.ativo; return desenhar(f); }
      if (k !== 'ok') return;
      const nome = f.querySelector('#p-nome').value.trim();
      const pin = f.querySelector('#p-pin').value.trim();
      if (!nome) return toast('Escreva o nome', 'erro');
      if (pin && !/^\d{4,8}$/.test(pin)) return toast('A senha tem de 4 a 8 números', 'erro');
      if (!atual && !pin) return toast('Escolha a senha da pessoa', 'erro');
      const r = await postJson('api/pessoas', { acao: 'salvar', pessoa: { id: atual ? atual.id : '', nome, nivel: estado.nivel, extras: estado.nivel === 'administrador' ? {} : estado.extras, ativo: estado.ativo, pin } }, 15000).catch(() => null);
      if (!r) return toast('Não consegui falar com a central', 'erro');
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return toast(d.erro || 'A central recusou', 'erro');
      fechar(d);
    }, { classe: 'largo com-form', aoAbrir: (f) => desenhar(f) });
    if (!resp) return;
    v.lista = resp;
    toast(atual ? 'Pessoa salva' : 'Pessoa cadastrada');
    render();
  }
  async function editarAparelhoChefe(v, id) {
    const atual = (v.lista.aparelhos || {})[id] || {};
    const st = sync.status;
    const info = ((st && st.aparelhos) || []).find((a) => a.id === id) || {};
    let teto = Array.isArray(atual.teto) ? new Set(atual.teto) : new Set(C.funcoes.map((f) => f.id));
    let nivel = Number(atual.nivel) || 0;
    const souDono = !!(pessoaAtual() || {}).dono;
    const desenhar = (f) => {
      f.querySelector('#funcoes-aparelho').innerHTML = chipsDeFuncoes(teto, 'f');
      f.querySelectorAll('[data-k^="nv:"]').forEach((x) => x.classList.toggle('sel', x.dataset.k === 'nv:' + nivel));
    };
    const resp = await abrirModal(`<h3>Tablet chefe</h3><p class="dica">${esc(id)}</p>
      <div class="form-pessoa">
        <label>Nome do aparelho <input id="a-nome" maxlength="40" autocomplete="off" value="${esc(atual.nome || info.nome || '')}" placeholder="Ex.: Tablet do escritório"></label>
        ${pode('chefes') ? `<p class="sub" style="margin:4px 0">Nível deste tablet chefe:</p>
        <div class="segmentos quebra">${[1, 2, 3].map((n) => `<button data-k="nv:${n}" ${n === 3 && !souDono ? 'disabled' : ''}>${esc(nomeDoNivelChefe(n))}</button>`).join('')}</div>
        <p class="sub" style="margin:2px 0 8px">${esc(((C.niveisDoAparelho || {})[1] || {}).texto || '')}; 2: tudo; 3: só o dono. Quem estiver dentro sai quando o nível muda.</p>` : ''}
        <p class="sub" style="margin:4px 0">O que pode ser feito neste aparelho:</p>
        <div id="funcoes-aparelho"></div>
      </div>
      <div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn primario" data-k="ok">Salvar</button></div>`,
    async (k, b, fechar, f) => {
      if (k === 'x') return fechar(undefined);
      if (k.startsWith('f:')) { const fn = k.slice(2); if (teto.has(fn)) teto.delete(fn); else teto.add(fn); return desenhar(f); }
      if (k.startsWith('nv:')) { nivel = Number(k.slice(3)); return desenhar(f); }
      if (k !== 'ok') return;
      const tudo = C.funcoes.every((x) => teto.has(x.id));
      const pedido = { acao: 'aparelho', id, nome: f.querySelector('#a-nome').value.trim(), teto: tudo ? null : [...teto] };
      if (pode('chefes') && nivel !== (Number(atual.nivel) || 0)) pedido.nivel = nivel;
      const r = await postJson('api/pessoas', pedido, 10000).catch(() => null);
      if (!r) return toast('Não consegui falar com a central', 'erro');
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return toast(d.erro || 'A central recusou', 'erro');
      fechar(d);
    }, { classe: 'largo com-form', aoAbrir: (f) => desenhar(f) });
    if (!resp) return;
    v.lista = resp;
    // o nível deste próprio aparelho mudou: a central tirou quem estava dentro, então entra de novo
    if (id === cfg.deviceId && nivel !== (Number(atual.nivel) || 0)) {
      cfg.nivelChefe = nivel; cfg.pessoa = null; salvarCfg();
      toast(`Este aparelho agora é o ${nomeDoNivelChefe(nivel)}. Entre de novo com a sua senha.`);
      return render();
    }
    toast('Tablet chefe salvo');
    render();
  }

  /* ---------- Registro do sistema ---------- */
  const TIPOS_REGISTRO = [['', 'Tudo'], ['anotacao', 'Anotações'], ['entrada', 'Entradas'], ['aparelho', 'Aparelhos'], ['configuracao', 'Configurações']];
  function telaRegistro(v) {
    if (!v.data) v.data = dataProducao();
    if (!v.linhas && !v.carregando) carregarRegistro(v);
    const hoje = dataProducao();
    const linhas = (v.linhas || []).filter((r) => !v.tipo || r.valores.tipo === v.tipo).slice().reverse();
    const hora = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${topo('Registro do sistema', `${fmtData(v.data)} · o que aconteceu, de hora em hora`, true)}
      <main class="registro">
        <div class="barra-dia">
          <div class="nav-data">
            <button class="btn" data-a="registro-dia" data-n="-1" aria-label="Dia anterior">${ico('voltar')}</button>
            <div class="data-grande"><b>${fmtData(v.data)}</b><span>${diaSemana(v.data)}, das 07:00 até 06:59 do dia seguinte</span></div>
            <button class="btn" data-a="registro-dia" data-n="1" aria-label="Próximo dia" ${v.data >= hoje ? 'disabled' : ''}>${ico('seta')}</button>
          </div>
        </div>
        <div class="segmentos filtros-registro">${TIPOS_REGISTRO.map(([t, n]) => `<button class="${(v.tipo || '') === t ? 'sel' : ''}" data-a="registro-tipo" data-tipo="${t}">${n}</button>`).join('')}</div>
        <div class="lista-registro">${v.carregando && !v.linhas ? '<p class="sub">Buscando na central...</p>' : linhas.map((r) => {
          const x = r.valores;
          return `<div class="reg-linha reg-${esc(x.tipo)}"><b class="reg-hora">${hora(x.em)}</b><div class="reg-texto"><p>${esc(x.texto)}</p>
            <small>${esc([x.quem, x.aparelho].filter(Boolean).join(' · '))}</small>
            ${(x.mudancas || []).length ? `<ul>${x.mudancas.map((m) => `<li>${esc(m.campo)}: <s>${esc(m.antes)}</s> → <b>${esc(m.depois)}</b></li>`).join('')}</ul>` : ''}
            ${x.antes && x.depois ? `<ul><li><s>${esc(x.antes)}</s> → <b>${esc(x.depois)}</b></li></ul>` : ''}</div></div>`;
        }).join('') || '<p class="sub">Nada registrado neste dia.</p>'}</div>
      </main>`;
  }
  async function carregarRegistro(v) {
    v.carregando = true;
    if (cfg.demo) { v.linhas = registroDeExemplo(v.data); v.carregando = false; return; }
    const r = await buscar('api/registro?dia=' + v.data, {}, 10000).catch(() => null);
    v.carregando = false;
    if (!r || !r.ok) { toast('Não consegui buscar o registro na central', 'erro'); v.linhas = []; }
    else v.linhas = ((await r.json().catch(() => ({}))).registros || []);
    if (view() === v) render();
  }
  /** Demonstração (imagens e auditoria das telas). */
  function registroDeExemplo(data) {
    const [y, m, d] = data.split('-').map(Number);
    const em = (h, mi) => new Date(y, m - 1, d, h, mi).getTime();
    const l = (h, mi, tipo, texto, quem, aparelho, mudancas) => ({ valores: { em: em(h, mi), tipo, texto, quem, aparelho, mudancas } });
    return [
      l(7, 2, 'entrada', 'Guilherme entrou no Tablet chefe', 'Guilherme', 'Tablet chefe'),
      l(7, 10, 'entrada', 'Felipe entrou no Tablet da Hidrólise', 'Felipe', 'Tablet da Hidrólise'),
      l(8, 43, 'anotacao', 'Felipe anotou Hidrólise Nº 1', 'Felipe', 'Tablet da Hidrólise', [{ campo: 'PHF', antes: '(vazio)', depois: '3,5' }, { campo: 'Brix', antes: '(vazio)', depois: '20' }]),
      l(9, 5, 'anotacao', 'Fernando mudou Hidrólise Nº 1', 'Fernando', 'Tablet chefe', [{ campo: 'Brix', antes: '20', depois: '21' }]),
      l(9, 30, 'aparelho', 'Tablet da Caldeira ficou sem sinal', '', 'Tablet da Caldeira'),
      l(9, 41, 'aparelho', 'Tablet da Caldeira voltou a falar com a central (ficou 11 min sem sinal)', '', 'Tablet da Caldeira'),
      l(10, 2, 'configuracao', 'Guilherme cadastrou Jair na Ralo / Pesagem', 'Guilherme', 'Tablet chefe'),
      l(10, 15, 'aparelho', 'Tablet da Destilaria atualizou da versão 2.8.0 para a 2.9.0', '', 'Tablet da Destilaria'),
    ];
  }

  /* =========================================================
   * Gráficos do dia (versão 2.10): Brix, pH e temperaturas, hora a hora.
   * Quais gráficos e quais quadros entram em cada um ficam no forms.js (graficos).
   * Folha hora a hora: o ponto fica na hora da linha. Dornas: na hora em que a dorna
   * começou a ser enviada (ou no horário dela; sem horário, quando foi anotada).
   * ========================================================= */
  const numeroDe = (v) => { if (vazio(v)) return null; const n = Number(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
  function graficosDoDia(data, setorId) {
    const ligadas = new Set(setores().flatMap((s) => s.pranchetas.flatMap(folhasDe)));
    return (C.graficos || []).filter((gr) => ligadas.has(gr.prancheta)).map((gr) => {
      const p = prancheta(gr.prancheta);
      const setor = setorDaPrancheta(gr.prancheta);
      if (!p || !setor || (setorId && setor.id !== setorId)) return null;
      const campos = (p.tipo === 'grade' ? p.itens : p.campos) || [];
      const hora = campos.find((c) => c.type === 'time');
      const xDe = (r) => {
        if (p.tipo === 'grade') return /^\d+$/.test(r.chave) ? ordemNoDia(Number(r.chave)) * 60 + 30 : null;
        const h = r.valores[(p.envio || {}).inicio] || (hora && r.valores[hora.id]);
        if (h && /^\d{1,2}:\d{2}$/.test(h)) return minutosDoDia(h);
        const d = new Date(r.criadoEm);
        return minutosDoDia(`${d.getHours()}:${d.getMinutes()}`);
      };
      const regs = listar(data, gr.prancheta).filter((r) => !r.apagado);
      const series = gr.campos.map((id) => campos.find((c) => c.id === id)).filter(Boolean).map((c, i) => ({
        nome: c.label, cor: (i % 4) + 1, dec: c.dec || 0,
        pontos: regs.map((r) => {
          const y = numeroDe(r.valores[c.id]);
          const x = xDe(r);
          return y == null || x == null ? null : { x, y, onde: p.tipo === 'dornas' ? `Nº ${r.chave}` : rotuloHora(Number(r.chave)) };
        }).filter(Boolean).sort((a, b) => a.x - b.x),
      }));
      // as linhas dos avisos (pH 5, Brix 25...) aparecem tracejadas
      const faixas = [];
      gr.campos.forEach((id) => { const c = campos.find((x) => x.id === id); (c && c.avisos || []).forEach((a) => { if (!faixas.some((f) => f.valor === a.valor)) faixas.push({ valor: a.valor, nivel: a.nivel || 'alerta', texto: a.curto || a.texto }); }); });
      const unidade = (campos.find((c) => c.id === gr.campos[0]) || {}).unidade || '';
      return { id: gr.titulo, titulo: gr.titulo, setor, unidade, series, faixas, temDados: series.some((s) => s.pontos.length) };
    }).filter(Boolean);
  }
  /** Um gráfico de linhas: as linhas em SVG (esticam com a caixa) e os números em texto normal (letra de verdade em qualquer tela). */
  function htmlDoGrafico(gr, compacto) {
    const ys = gr.series.flatMap((s) => s.pontos.map((p) => p.y));
    const cab = `<div class="graf-cab"><b>${esc(gr.titulo)}</b>${gr.unidade ? `<small>${esc(gr.unidade)}</small>` : ''}</div>`;
    if (!ys.length) return `<div class="grafico vazio">${cab}<p class="sub">Nada anotado ainda neste dia.</p></div>`;
    const perto = gr.faixas.filter((f) => f.valor >= Math.min(...ys) - (Math.max(...ys) - Math.min(...ys) + 2) && f.valor <= Math.max(...ys) + (Math.max(...ys) - Math.min(...ys) + 2));
    let min = Math.min(...ys, ...perto.map((f) => f.valor)), max = Math.max(...ys, ...perto.map((f) => f.valor));
    if (max - min < 1) { min -= 1; max += 1; }
    const passo = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find((s) => (max - min) / s <= 4) || 10000;
    min = Math.floor(min / passo) * passo; max = Math.ceil(max / passo) * passo;
    if (max === min) max = min + passo;
    const X = (x) => (x / 1440) * 100;
    const Y = (y) => (1 - (y - min) / (max - min)) * 100;
    const dec = passo < 1 ? 1 : 0;
    const marcas = [];
    for (let v = min; v <= max + passo / 2; v += passo) marcas.push(Math.round(v * 10) / 10);
    const linhas = marcas.map((v) => `<line x1="0" x2="100" y1="${Y(v).toFixed(2)}" y2="${Y(v).toFixed(2)}" class="graf-grade"/>`).join('')
      + perto.map((f) => `<line x1="0" x2="100" y1="${Y(f.valor).toFixed(2)}" y2="${Y(f.valor).toFixed(2)}" class="graf-faixa ${f.nivel}"/>`).join('')
      + gr.series.filter((s) => s.pontos.length > 1).map((s) => `<polyline class="graf-linha s${s.cor}" points="${s.pontos.map((p) => `${X(p.x).toFixed(2)},${Y(p.y).toFixed(2)}`).join(' ')}"/>`).join('');
    const pontos = gr.series.flatMap((s) => s.pontos.map((p) => `<i class="graf-ponto s${s.cor}" style="left:${X(p.x).toFixed(2)}%;top:${Y(p.y).toFixed(2)}%" title="${esc(`${s.nome} ${p.onde}: ${fmtNum(p.y.toFixed(s.dec))}`)}"></i>`)).join('');
    const horas = [0, 3, 6, 9, 12, 15, 18, 21].map((i) => `<span style="left:${X(i * 60).toFixed(2)}%">${pad2((C.inicioDoDia + i) % 24)}h</span>`).join('');
    const legenda = gr.series.map((s) => { const u = s.pontos[s.pontos.length - 1]; return `<span class="graf-leg"><i class="s${s.cor}"></i>${esc(s.nome)}${u ? ` <b>${esc(fmtNum(u.y.toFixed(s.dec)))}</b>${compacto ? '' : ` <small>(${esc(u.onde)})</small>`}` : ''}</span>`; }).join('');
    return `<div class="grafico ${compacto ? 'compacto' : ''}">${cab}
      <div class="graf-corpo"><div class="graf-y">${marcas.map((v) => `<span style="top:${Y(v).toFixed(2)}%">${esc(fmtNum(v.toFixed(dec)))}</span>`).join('')}</div>
        <div class="graf-area"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${linhas}</svg>${pontos}</div></div>
      <div class="graf-x">${horas}</div>
      <div class="graf-legenda">${legenda}${perto.length && !compacto ? perto.map((f) => `<span class="graf-leg limite ${f.nivel}"><i></i>${esc(f.texto)} (${esc(fmtNum(String(f.valor)))})</span>`).join('') : ''}</div></div>`;
  }
  /** No painel: os primeiros gráficos que têm anotação no dia. */
  function htmlGraficosDoPainel(data) {
    const com = graficosDoDia(data).filter((g) => g.temDados);
    return `<section class="graficos-painel">
      <div class="titulo-secao"><h2>Gráficos do dia</h2><button class="btn pequeno" data-a="graficos">${ico('grafico')} Ver todos</button></div>
      ${com.length ? `<div class="graficos-grade">${com.slice(0, 4).map((g) => `<button class="grafico-botao" data-a="graficos" data-setor="${g.setor.id}">${htmlDoGrafico(g, true)}</button>`).join('')}</div>`
        : '<p class="sub">Os gráficos aparecem quando os setores anotarem Brix, pH e temperaturas.</p>'}
    </section>`;
  }
  function telaGraficos(v) {
    if (!v.data) v.data = dataProducao();
    const hoje = dataProducao();
    const todos = graficosDoDia(v.data);
    const setoresCom = [...new Map(todos.map((g) => [g.setor.id, g.setor])).values()];
    const lista = todos.filter((g) => !v.setor || g.setor.id === v.setor);
    return `${topo('Gráficos do dia', `${fmtData(v.data)} · Brix, pH e temperaturas, hora a hora`, true)}
      <main class="graficos">
        <div class="barra-dia">
          <div class="nav-data">
            <button class="btn" data-a="graficos-dia" data-n="-1" aria-label="Dia anterior">${ico('voltar')}</button>
            <div class="data-grande"><b>${fmtData(v.data)}</b><span>${diaSemana(v.data)}, das 07:00 até 06:59 do dia seguinte</span></div>
            <button class="btn" data-a="graficos-dia" data-n="1" aria-label="Próximo dia" ${v.data >= hoje ? 'disabled' : ''}>${ico('seta')}</button>
          </div>
        </div>
        <div class="segmentos filtros-registro"><button class="${v.setor ? '' : 'sel'}" data-a="graficos-setor" data-setor="">Todos</button>${setoresCom.map((s) => `<button class="${v.setor === s.id ? 'sel' : ''}" data-a="graficos-setor" data-setor="${s.id}">${esc(s.nome)}</button>`).join('')}</div>
        ${diasBuscando.has(v.data) ? '<p class="sub">Buscando as anotações na central...</p>' : ''}
        <div class="graficos-lista">${lista.map((g) => htmlDoGrafico(g, false)).join('') || '<p class="sub">Nenhum gráfico para estes setores.</p>'}</div>
      </main>`;
  }

  /* =========================================================
   * Folhas e avisos (versão 2.10): o tablet chefe muda nomes, unidades, a faixa esperada
   * e os avisos (pH 5, Brix 25...) sem precisar de versão nova. Fica na configuração da usina
   * (configSistema().folhas) e chega em todos os tablets pela sincronização.
   * O que vem do forms.js é o original: "Voltar ao original" apaga só a mudança.
   * ========================================================= */
  // versão 2.12: a folha em vigor é montada pelo folhas.js (o mesmo código que a central do computador usa na API)
  const ORIGINAIS_FOLHAS = new Map();
  let folhasAplicadas = '';
  const camposDaFolha = (p) => p[window.Folhas.listaDe(p)] || [];
  const copia = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  /** Como o quadro é no forms.js. Campo novo ou do escritório liberado ao operador: a definição dele (assim dá para apagar a unidade). */
  const originalDoCampo = (pid, id) => {
    const o = ORIGINAIS_FOLHAS.get(pid); const x = o && o.lista.find((e) => e.c.id === id);
    if (x) return x.o;
    const p = prancheta(pid);
    const novo = ((((configSistema().folhas || {})[pid] || {})._novos) || []).map(window.Folhas.campoNovo).find((c) => c && c.id === id);
    const base = novo || ((p && p.camposEscritorio) || []).find((c) => c.id === id) || {};
    const r = {}; window.Folhas.EDITAVEIS.forEach((k) => { if (base[k] !== undefined) r[k] = copia(base[k]); }); return r;
  };
  /** Põe as mudanças das folhas por cima do forms.js. Devolve true se mudou algo. */
  function aplicarFolhas() {
    const f = configSistema().folhas || {};
    const json = JSON.stringify(f);
    if (json === folhasAplicadas) return false;
    const primeira = !folhasAplicadas;
    folhasAplicadas = json;
    window.Folhas.aplicar(C, f, ORIGINAIS_FOLHAS);
    if (!primeira) mandarFolhasParaCentral();
    return true;
  }
  /* A central do tablet monta as permissões, os campos do escritório e a API da nuvem com as folhas que o aplicativo
     do tablet chefe manda: ao abrir, depois de entrar e quando elas mudam. */
  let folhasMandando = null;
  function mandarFolhasParaCentral() {
    if (!centralNoTablet() || cfg.demo) return;
    clearTimeout(folhasMandando);
    folhasMandando = setTimeout(() => postJson('api/nuvem', { acao: 'forms', forms: C }, 8000).catch(() => {}), 800);
  }
  const normalizarAvisos = (lista) => (lista || []).map((a) => ({ quando: a.quando, valor: a.valor, nivel: a.nivel || 'alerta', texto: a.texto, curto: a.curto || String(a.texto).split(':')[0].slice(0, 24) }));
  const QUANDO = [['<', 'abaixo de'], ['<=', 'até'], ['>=', 'a partir de'], ['>', 'acima de']];
  const resumoDoCampo = (c) => [
    c.unidade || '',
    c.min != null || c.max != null ? `esperado de ${c.min != null ? fmtNum(String(c.min)) : '...'} a ${c.max != null ? fmtNum(String(c.max)) : '...'}` : '',
    (c.avisos || []).map((a) => `${a.nivel === 'atencao' ? 'atenção' : 'aviso'} ${(QUANDO.find((q) => q[0] === a.quando) || [0, a.quando])[1]} ${fmtNum(String(a.valor))}`).join(', '),
  ].filter(Boolean).join(' · ');
  function telaFolhas(v) {
    const mud = configSistema().folhas || {};
    const vistas = new Set();
    return `${topo('Folhas e avisos', 'O que mudar aqui vale para todos os tablets', true)}
      <main class="config tela-folhas">
        <p class="sub">Mude o nome dos quadros, a unidade, a faixa esperada e os avisos (como pH abaixo de 5 ou Brix acima de 25). O desenho das folhas de papel não muda.</p>
        <div class="config-grade">${todosSetores.map((s) => {
          const pids = s.pranchetas.flatMap(folhasDe).filter((pid) => !vistas.has(pid) && vistas.add(pid));
          const blocos = pids.map((pid) => {
            const p = prancheta(pid);
            const campos = camposDaFolha(p).filter((c) => !c.arquivado && (c.type === 'num' || c.type === 'time' || c.type === 'choice' || c.type === 'check' || c.type === 'text'));
            const linhas = campos.map((c) => `<div class="linha-config"><div><b>${esc(c.label)}${c.novo ? ' <span class="selo-mudado">novo</span>' : (mud[pid] || {})[c.id] ? ' <span class="selo-mudado">mudado</span>' : ''}</b><small>${esc([resumoDoCampo(c) || 'sem aviso', c.oculto ? 'o operador não vê' : '', c.doEscritorio ? 'do escritório, o operador também preenche' : ''].filter(Boolean).join(' · '))}</small></div>
              <button class="btn pequeno" data-a="folha-campo" data-pid="${pid}" data-id="${esc(c.id)}">Mudar</button></div>`).join('');
            const unidades = p.tipo === 'insumo' ? `<div class="linha-config"><div><b>Unidades${(mud[pid] || {})._unidades ? ' <span class="selo-mudado">mudado</span>' : ''}</b><small>${esc(p.unidades.join(', '))}</small></div>
              <button class="btn pequeno" data-a="folha-unidades" data-pid="${pid}">Mudar</button></div>` : '';
            const estrutura = pode('sistema') && window.Folhas.aceitaNovo(p) ? `<div class="linha-botoes"><button class="btn pequeno" data-a="folha-estrutura" data-pid="${pid}">${ico('mais')} Estrutura da folha (campos novos${p.tipo === 'insumo' ? ', campos do escritório' : ''})</button></div>` : '';
            return linhas || unidades || estrutura ? `<h3 class="folha-titulo">${esc(p.nome)}</h3>${linhas}${unidades}${estrutura}` : '';
          }).join('');
          return blocos ? `<section class="bloco"><h2>${ico(s.icone)} ${esc(s.nome)}</h2>${blocos}</section>` : '';
        }).join('')}</div>
      </main>`;
  }
  function salvarFolhas(novo, texto) {
    const limpo = {};
    Object.entries(novo).forEach(([pid, m]) => { const x = {}; Object.entries(m).forEach(([k, v]) => { if (v && Object.keys(v).length) x[k] = v; }); if (Object.keys(x).length) limpo[pid] = x; });
    salvarConfigSistema({ folhas: limpo });
    registrar('configuracao', `${quemEstaAqui()} ${texto}`);
    aplicarFolhas();
  }
  async function editarCampoDaFolha(pid, id) {
    const p = prancheta(pid);
    const c = camposDaFolha(p).find((x) => x.id === id);
    if (!c) return;
    const o = originalDoCampo(pid, c.id);
    const num = c.type === 'num';
    // versão 2.12: só o dono, num tablet chefe nível 3, muda a vírgula e se o operador vê o quadro
    const sistema = pode('sistema');
    const est = { dec: Number(c.dec) || 0, oculto: !!c.oculto };
    const desenharSistema = (f) => {
      f.querySelectorAll('[data-k^="dec:"]').forEach((x) => x.classList.toggle('sel', x.dataset.k === 'dec:' + est.dec));
      const v = f.querySelector('[data-k="oculto"]');
      if (v) { v.classList.toggle('sel', !est.oculto); v.innerHTML = `${est.oculto ? ico('fechar') : ico('certo')} ${est.oculto ? 'O operador não vê este quadro' : 'O operador vê e anota este quadro'}`; }
    };
    const avisos = copia(c.avisos || []);
    const linhaAviso = (a, i) => `<div class="aviso-editar" data-texto="${esc(a.texto || '')}" data-curto="${esc(a.curto || '')}">
        <select class="av-quando">${QUANDO.map(([q, t]) => `<option value="${q}" ${a.quando === q ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <input class="av-valor" inputmode="decimal" value="${esc(a.valor == null ? '' : fmtNum(String(a.valor)))}" aria-label="Valor">
        <select class="av-nivel"><option value="alerta" ${a.nivel !== 'atencao' ? 'selected' : ''}>Aviso vermelho</option><option value="atencao" ${a.nivel === 'atencao' ? 'selected' : ''}>Atenção (amarelo)</option></select>
        <input class="av-texto" maxlength="80" value="${esc(a.texto || '')}" placeholder="O que aparece (ex.: pH baixo: coloque cal)" aria-label="Texto do aviso">
        <button class="btn pequeno" data-k="av-x:${i}" aria-label="Tirar este aviso">${ico('lixeira')}</button></div>`;
    const lerAvisos = (f) => [...f.querySelectorAll('.aviso-editar')].map((d) => ({
      quando: d.querySelector('.av-quando').value, valor: numeroDe(d.querySelector('.av-valor').value),
      nivel: d.querySelector('.av-nivel').value, texto: d.querySelector('.av-texto').value.trim(),
      // o texto curto (do lado do número) continua o mesmo enquanto o texto não muda
      curto: d.querySelector('.av-texto').value.trim() === d.dataset.texto && d.dataset.curto ? d.dataset.curto : '',
    }));
    const desenharAvisos = (f) => { f.querySelector('#avisos-campo').innerHTML = avisos.map(linhaAviso).join('') || '<p class="sub">Sem aviso neste quadro.</p>'; };
    const mudado = !!((configSistema().folhas || {})[pid] || {})[id];
    const resp = await abrirModal(`<h3>${esc(c.label)}</h3><p class="dica">${esc(p.nome)}${o.label && o.label !== c.label ? ` · no forms.js: ${esc(o.label)}` : ''}</p>
      <div class="form-pessoa form-folha">
        <label>Nome do quadro <input id="f-label" maxlength="40" value="${esc(c.label || '')}"></label>
        <label>Nome curto <small>quando o nome não cabe</small><input id="f-curto" maxlength="20" value="${esc(c.labelCurto || '')}"></label>
        ${num ? `<label>Unidade <small>ex.: °C, kgf, copos</small><input id="f-unidade" maxlength="12" value="${esc(c.unidade || '')}"></label>
        ${chipsDeUnidades('u')}
        <p class="sub">Trocar a unidade vale a partir de hoje: os dias antes continuam com a de antes. Nenhum número é convertido.</p>
        <label>Dica <small>aparece embaixo do teclado</small><input id="f-dica" maxlength="160" value="${esc(c.dica || '')}"></label>
        <label>Menor valor esperado <input id="f-min" inputmode="decimal" value="${esc(c.min == null ? '' : fmtNum(String(c.min)))}"></label>
        <label>Maior valor esperado <input id="f-max" inputmode="decimal" value="${esc(c.max == null ? '' : fmtNum(String(c.max)))}"></label>
        <div class="avisos-bloco"><b>Avisos</b><div id="avisos-campo"></div><button class="btn pequeno" data-k="av-mais">${ico('mais')} Pôr aviso</button></div>`
        : `<label>Dica <small>aparece embaixo do teclado</small><input id="f-dica" maxlength="160" value="${esc(c.dica || '')}"></label>`}
        ${sistema ? `<div class="avisos-bloco"><b>Só você (dono)</b>
          ${num ? `<div class="segmentos quebra">${[[0, 'Sem vírgula'], [1, '1 casa'], [2, '2 casas']].map(([d, n]) => `<button data-k="dec:${d}">${n}</button>`).join('')}</div>
          <p class="sub">A vírgula vale para o que for anotado daqui para frente; o que já foi anotado continua como está.</p>` : ''}
          <div class="chips"><button class="chip-liga" data-k="oculto"></button></div></div>` : ''}
        ${mudado ? '<div class="linha-botoes"><button class="btn pequeno" data-k="original">Voltar ao original</button></div>' : ''}
      </div>
      <div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn primario" data-k="ok">Salvar</button></div>`,
    (k, b, fechar, f) => {
      if (k === 'x') return fechar(undefined);
      if (k === 'original') return fechar('original');
      if (k === 'av-mais') { avisos.splice(0, avisos.length, ...lerAvisos(f)); avisos.push({ quando: '<', valor: null, nivel: 'alerta', texto: '' }); return desenharAvisos(f); }
      if (k.startsWith('av-x:')) { avisos.splice(0, avisos.length, ...lerAvisos(f)); avisos.splice(Number(k.slice(5)), 1); return desenharAvisos(f); }
      if (k.startsWith('u:')) { f.querySelector('#f-unidade').value = k.slice(2); return; }
      if (k.startsWith('dec:')) { est.dec = Number(k.slice(4)); return desenharSistema(f); }
      if (k === 'oculto') { est.oculto = !est.oculto; return desenharSistema(f); }
      if (k !== 'ok') return;
      const label = f.querySelector('#f-label').value.trim();
      if (!label) return toast('O quadro precisa de um nome', 'erro');
      const m = { label, labelCurto: f.querySelector('#f-curto').value.trim(), dica: f.querySelector('#f-dica').value.trim() };
      if (num) {
        m.unidade = f.querySelector('#f-unidade').value.trim();
        const mn = f.querySelector('#f-min').value.trim(), mx = f.querySelector('#f-max').value.trim();
        m.min = mn ? numeroDe(mn) : null; m.max = mx ? numeroDe(mx) : null;
        if ((mn && m.min == null) || (mx && m.max == null)) return toast('A faixa esperada tem de ser número', 'erro');
        if (m.min != null && m.max != null && m.min > m.max) return toast('O menor valor está maior que o maior', 'erro');
        const av = lerAvisos(f);
        if (av.some((a) => a.valor == null)) return toast('Cada aviso precisa de um número', 'erro');
        if (av.some((a) => !a.texto)) return toast('Escreva o que o aviso diz', 'erro');
        m.avisos = normalizarAvisos(av);
      }
      if (sistema) { if (num) m.dec = est.dec; if (est.oculto) m.oculto = true; }
      fechar(m);
    }, { classe: 'largo com-form', aoAbrir: (f) => { if (num) desenharAvisos(f); if (sistema) desenharSistema(f); } });
    if (resp === undefined) return;
    const todas = copia(configSistema().folhas || {});
    todas[pid] = todas[pid] || {};
    const antes = { label: c.label, unidade: c.unidade, min: c.min, max: c.max, avisos: resumoDoCampo(c) };
    const guardado = todas[pid][id] || {};
    // a unidade trocada vale a partir de hoje: guarda a de antes até ontem (nada é convertido)
    const comHistorico = (unidadeNova) => {
      const h = copia(guardado.historico || c.historico || []);
      const ontem = somarDias(dataProducao(), -1);
      if ((unidadeNova || '') !== (c.unidade || '') && !h.some((x) => x.ate === ontem)) h.push({ ate: ontem, unidade: c.unidade || '' });
      return h.length ? h : undefined;
    };
    // quem não é o dono não mexe (nem apaga) o que só o dono muda
    const doDono = () => { const x = {}; if (!pode('sistema')) ['dec', 'oculto'].forEach((k) => { if (guardado[k] !== undefined) x[k] = guardado[k]; }); return x; };
    if (resp === 'original') {
      const fica = Object.assign(doDono(), num && comHistorico(o.unidade) ? { historico: comHistorico(o.unidade) } : {});
      if (Object.keys(fica).length) todas[pid][id] = fica; else delete todas[pid][id];
      salvarFolhas(todas, `voltou ${c.label} (${p.nome}) para o original`);
      toast('Voltou ao original');
      return render();
    }
    // só guarda o que ficou diferente do original
    const dif = {};
    Object.keys(resp).forEach((k) => {
      const orig = k === 'avisos' ? normalizarAvisos(o.avisos) : o[k] === undefined ? (k === 'min' || k === 'max' ? null : '') : o[k];
      if (JSON.stringify(resp[k] == null || resp[k] === '' ? (k === 'avisos' ? [] : k === 'min' || k === 'max' ? null : '') : resp[k]) !== JSON.stringify(orig)) dif[k] = resp[k] === '' ? null : resp[k];
    });
    if (num) { const h = comHistorico(resp.unidade); if (h) dif.historico = h; }
    todas[pid][id] = Object.assign(dif, doDono());
    const partes = [];
    if (dif.label !== undefined && resp.label !== antes.label) partes.push(`nome ${antes.label} -> ${resp.label}`);
    if (num && (resp.unidade || '') !== (antes.unidade || '')) partes.push(`unidade ${antes.unidade || '(sem)'} -> ${resp.unidade || '(sem)'}`);
    salvarFolhas(todas, `mudou ${resp.label} (${p.nome})${partes.length ? ': ' + partes.join(', ') : ''}`);
    const depois = resumoDoCampo(c);
    if (num && depois !== antes.avisos) registrar('configuracao', `${quemEstaAqui()} mudou a faixa e os avisos de ${c.label} (${p.nome})`, [{ campo: c.label, antes: antes.avisos || '(sem)', depois: depois || '(sem)' }]);
    toast('Folha salva. Os tablets recebem na próxima sincronização.');
    render();
  }
  /** As unidades sugeridas (o dono também pode digitar outra). */
  const chipsDeUnidades = (pre) => `<div class="chips unidades">${window.Folhas.UNIDADES.map(([g, us]) => us.map((u) => `<button class="chip-liga" data-k="${pre}:${esc(u)}" title="${esc(g)}">${esc(u)}</button>`).join('')).join('')}</div>`;
  const TIPOS_DE_CAMPO = [['num', 'Número'], ['text', 'Texto'], ['choice', 'Opções'], ['time', 'Hora'], ['check', 'Marcar OK']];
  function nomeDoTipo(c) {
    const t = (TIPOS_DE_CAMPO.find((x) => x[0] === c.type) || [0, c.type])[1];
    if (c.type === 'num') return `${t}${c.unidade ? ` em ${c.unidade}` : ''}, ${c.dec ? `${c.dec} casa${c.dec > 1 ? 's' : ''} depois da vírgula` : 'sem vírgula'}`;
    return c.type === 'choice' ? `${t}: ${(c.opcoes || []).join(', ')}` : t;
  }
  /* Estrutura da folha (versão 2.12, só o dono num tablet chefe nível 3): campos novos e, nos insumos, os campos do
     escritório que o operador também preenche. O desenho do papel não muda: o que for novo aparece no aplicativo,
     no Monitorar, no XML e na API. Campo novo não se apaga: arquiva (os valores antigos continuam guardados). */
  async function editarEstruturaDaFolha(pid) {
    if (!pode('sistema')) return toast('Só o dono do sistema, no tablet chefe nível 3', 'erro');
    const p = prancheta(pid);
    const todas = copia(configSistema().folhas || {});
    const m = todas[pid] = todas[pid] || {};
    const novos = copia(m._novos || []);
    const operador = new Set(m._operador || []);
    const doOperadorNoForms = ((ORIGINAIS_FOLHAS.get(pid) || {}).ordem || []).map((c) => c.id);
    const escritorio = p.tipo === 'insumo' ? (p.camposEscritorio || []).filter((c) => !doOperadorNoForms.includes(c.id)) : [];
    const desenhar = (f) => {
      f.querySelector('#est-novos').innerHTML = novos.length ? novos.map((c, i) => `<div class="linha-config ${c.arquivado ? 'desligado' : ''}"><div><b>${esc(c.label)}</b><small>${esc(nomeDoTipo(c))}${c.arquivado ? ' · arquivado (os valores antigos continuam guardados)' : ''}</small></div>
        <button class="btn pequeno" data-k="arq:${i}">${c.arquivado ? 'Voltar a usar' : 'Arquivar'}</button></div>`).join('') : '<p class="sub">Nenhum campo novo nesta folha.</p>';
      const op = f.querySelector('#est-operador');
      if (op) op.innerHTML = `<div class="chips">${escritorio.map((c) => `<button class="chip-liga ${operador.has(c.id) ? 'sel' : ''}" data-k="op:${c.id}">${operador.has(c.id) ? ico('certo') : ico('fechar')} ${esc(c.label)}</button>`).join('')}</div>`;
    };
    for (;;) {
      const resp = await abrirModal(`<h3>Estrutura da folha: ${esc(p.nome).replace(/-/g, '\u2011')}</h3>
        <p class="dica">Só você (dono, no tablet chefe nível 3) mexe aqui. O desenho do papel não muda: o que for novo aparece no aplicativo, no Monitorar, no XML e na API.</p>
        <div class="form-pessoa form-folha">
          ${escritorio.length ? '<b>Campos do escritório que o operador também preenche</b><div id="est-operador"></div>' : ''}
          <b>Campos novos</b><div id="est-novos"></div>
          <div class="linha-botoes"><button class="btn pequeno" data-k="novo">${ico('mais')} Criar campo novo</button></div>
        </div>
        <div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn primario" data-k="ok">Salvar</button></div>`,
      (k, b, fechar, f) => {
        if (k === 'x') return fechar(undefined);
        if (k === 'novo') return fechar('novo');
        if (k.startsWith('op:')) { const id = k.slice(3); if (operador.has(id)) operador.delete(id); else operador.add(id); return desenhar(f); }
        if (k.startsWith('arq:')) { const c = novos[Number(k.slice(4))]; if (c.arquivado) delete c.arquivado; else c.arquivado = true; return desenhar(f); }
        if (k === 'ok') fechar(true);
      }, { classe: 'largo com-form', aoAbrir: (f) => desenhar(f) });
      if (resp === 'novo') { const c = await criarCampoNovo(p, novos); if (c) novos.push(c); continue; }
      if (!resp) return;
      break;
    }
    if (operador.size) m._operador = [...operador]; else delete m._operador;
    if (novos.length) m._novos = novos; else delete m._novos;
    salvarFolhas(todas, `mudou a estrutura de ${p.nome}`);
    toast('Estrutura salva. Os tablets recebem na próxima sincronização.');
    render();
  }
  /** Um campo novo: nome, tipo, unidade e vírgula (número) ou as opções. O id nunca é reaproveitado. */
  async function criarCampoNovo(p, novos) {
    const est = { type: 'num', dec: 0 };
    const desenhar = (f) => {
      f.querySelectorAll('[data-k^="t:"]').forEach((x) => x.classList.toggle('sel', x.dataset.k === 't:' + est.type));
      f.querySelectorAll('[data-k^="d:"]').forEach((x) => x.classList.toggle('sel', x.dataset.k === 'd:' + est.dec));
      f.querySelector('#cn-num').style.display = est.type === 'num' ? '' : 'none';
      f.querySelector('#cn-opcoes').style.display = est.type === 'choice' ? '' : 'none';
    };
    return abrirModal(`<h3>Campo novo em ${esc(p.nome)}</h3>
      <div class="form-pessoa form-folha">
        <label>Nome do campo <input id="cn-nome" maxlength="40" autocomplete="off" placeholder="Ex.: Temperatura da saída"></label>
        <b>Tipo</b><div class="segmentos quebra">${TIPOS_DE_CAMPO.map(([t, n]) => `<button data-k="t:${t}">${n}</button>`).join('')}</div>
        <div id="cn-num"><label>Unidade <input id="cn-unidade" maxlength="12" autocomplete="off"></label>${chipsDeUnidades('cu')}
          <b>Vírgula</b><div class="segmentos quebra">${[[0, 'Sem vírgula'], [1, '1 casa'], [2, '2 casas']].map(([d, n]) => `<button data-k="d:${d}">${n}</button>`).join('')}</div></div>
        <label id="cn-opcoes">Opções <small>separe por vírgula</small><input id="cn-op" maxlength="200" autocomplete="off" placeholder="Ex.: Sim, Não"></label>
      </div>
      <div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn primario" data-k="ok">Criar</button></div>`,
    (k, b, fechar, f) => {
      if (k === 'x') return fechar(null);
      if (k.startsWith('t:')) { est.type = k.slice(2); return desenhar(f); }
      if (k.startsWith('d:')) { est.dec = Number(k.slice(2)); return desenhar(f); }
      if (k.startsWith('cu:')) { f.querySelector('#cn-unidade').value = k.slice(3); return; }
      if (k !== 'ok') return;
      const label = f.querySelector('#cn-nome').value.trim();
      if (!label) return toast('O campo precisa de um nome', 'erro');
      if ([...camposDaFolha(p), ...novos].some((c) => (c.label || '').toLowerCase() === label.toLowerCase())) return toast('Já tem um campo com esse nome nesta folha', 'erro');
      let id;
      do { id = 'x_' + Math.random().toString(36).slice(2, 10); } while (!/^x_[a-z0-9]{3,20}$/.test(id) || novos.some((c) => c.id === id));
      const c = { id, label, type: est.type };
      if (est.type === 'num') { c.dec = est.dec; const u = f.querySelector('#cn-unidade').value.trim(); if (u) c.unidade = u; }
      if (est.type === 'choice') {
        c.opcoes = [...new Set(f.querySelector('#cn-op').value.split(',').map((x) => x.trim()).filter(Boolean))];
        if (!c.opcoes.length) return toast('Escreva as opções, separadas por vírgula', 'erro');
      }
      fechar(c);
    }, { classe: 'largo com-form', aoAbrir: (f) => desenhar(f) });
  }
  async function editarUnidadesDaFolha(pid) {
    const p = prancheta(pid);
    const txt = await textoLivre({ titulo: `Unidades de ${p.nome}`, dica: 'Separe por vírgula. A primeira é a que já vem marcada.', valor: p.unidades.join(', '), max: 60 });
    if (txt === undefined) return;
    const lista = [...new Set(txt.split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 6);
    const todas = copia(configSistema().folhas || {});
    todas[pid] = todas[pid] || {};
    const orig = ((ORIGINAIS_FOLHAS.get(pid) || {}).unidades || p.unidades).join(', ');
    if (!lista.length || lista.join(', ') === orig) delete todas[pid]._unidades; else todas[pid]._unidades = lista;
    const antes = p.unidades.join(', ');
    salvarFolhas(todas, `mudou as unidades de ${p.nome}: ${antes} -> ${(lista.length ? lista : [orig]).join(', ')}`);
    toast('Unidades salvas');
    render();
  }

  /* =========================================================
   * Aparelhos e bloqueio (versão 2.11)
   * ========================================================= */
  /** A mesma conta da central para as senhas: sha256(sal:senha) e 20 mil voltas de HMAC. Confere a senha de
      desbloqueio aqui mesmo, para funcionar até longe da usina. */
  function resumoDaSenha(pin, sal) {
    let h = Cifra.sha256(Cifra.utf8(sal + ':' + pin));
    const p = Cifra.utf8(String(pin));
    for (let i = 0; i < 20000; i++) h = Cifra.hmac(h, p);
    return Cifra.hex(h);
  }

  /* Nome, fabricante, modelo e Android deste aparelho: vão para a central, que mostra em Aparelhos.
     No aplicativo vem do Android; no navegador, do que o navegador conta. */
  let infoAparelho = null;
  async function lerInfoDoAparelho() {
    if (NO_APK && pluginCentral && pluginCentral.infoDoAparelho) {
      try { infoAparelho = await pluginCentral.infoDoAparelho(); return; } catch (e) { /* segue com o do navegador */ }
    }
    const ua = navigator.userAgent || '';
    const android = (ua.match(/Android ([\d.]+)/) || [])[1] || '';
    const modelo = android ? ((ua.match(/Android [\d.]+; ([^;)]+)/) || [])[1] || '').replace(/ Build.*$/, '').trim() : '';
    const navegador = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
    const sistema = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
    infoAparelho = { modelo: android ? (modelo === 'K' ? '' : modelo) : sistema ? `Computador (${sistema})` : '', android, navegador };
  }

  /** A central (ou a nuvem) disse que este aparelho está bloqueado. Quem chama já acertou de qual central é
      (conhecerCentralDoBloqueio): a revisão só se compara dentro da mesma central. */
  function aplicarBloqueio(b) {
    if (!b || !b.em || DEMO_IMG) return;
    // cada bloqueio tem a sua revisão (número da central que só sobe): é ela que diz se é o mesmo bloqueio
    const rev = Number(b.rev) || 0;
    const central = cfg.blqGeracao || '';
    if (cfg.liberacao && (cfg.liberacao.rev || 0) === rev && cfg.liberacao.em === b.em && (cfg.liberacao.geracao || '') === central) return; // já foi liberado com a senha aqui; a central fica sabendo na próxima conversa
    // resposta atrasada (da central ou da nuvem): bloqueio já coberto por uma liberação, ou mais velho que o daqui, não vale
    if (rev <= (cfg.revLiberada || 0)) return;
    const daqui = cfg.bloqueio && (cfg.bloqueio.geracao || '') === central;
    if (daqui && rev < (cfg.bloqueio.rev || 0)) return;
    const igual = daqui && (cfg.bloqueio.rev || 0) === rev && cfg.bloqueio.em === b.em;
    const novo = !igual || cfg.bloqueio.modo !== b.modo;
    // a nuvem não manda a senha de desbloqueio: se é o mesmo bloqueio, fica a que veio da central
    const mesmo = igual ? cfg.bloqueio : {};
    cfg.bloqueio = { em: b.em, rev, geracao: central, modo: b.modo === 'senha' ? 'senha' : 'trava', apagar: !!b.apagar, sal: b.sal || mesmo.sal || '', resumo: b.resumo || mesmo.resumo || '' };
    // apaga uma vez por bloqueio (pela revisão: dois bloqueios podem ter a mesma hora)
    if (b.apagar && cfg.apagouRev !== rev + ':' + b.em) { apagarTudoDoAparelho(); cfg.apagouRev = rev + ':' + b.em; }
    salvarCfg();
    if (novo) { fecharModalAberto(); render(true); }
  }
  /** Bloqueio com "apagar": some tudo que o aparelho guarda (o que já chegou na central continua lá). */
  function apagarTudoDoAparelho() {
    Object.keys(registros).forEach((id) => delete registros[id]);
    salvarRegistros();
    errosGuardados.splice(0, errosGuardados.length); LS.set('erros', errosGuardados);
    cfg.operadores = {}; cfg.op = null; cfg.ultimoSeq = 0; cfg.corteSync = 0;
    rascunho = null; ed.alvoId = null;
    Object.keys(lembrar).forEach((k) => delete lembrar[k]);
  }
  function liberarAparelho(msg, revLivre) {
    if (!cfg.bloqueio) return;
    // lembra até onde está livre (na central de blqGeracao): uma resposta da nuvem que ainda estava no caminho, com
    // bloqueio igual ou mais velho, não trava de novo
    cfg.revLiberada = Math.max(cfg.revLiberada || 0, Number(revLivre) || 0);
    cfg.bloqueio = null;
    salvarCfg();
    pilha = [telaInicial()];
    if (cfg.papel && !ehCentral() && !operadorAtual()) pilha.push({ tela: 'operador' });
    render(true);
    toast(msg);
    sincronizarLogo();
  }
  /* De qual central (geração) é o que o aparelho sabe dos bloqueios: a revisão é um contador de cada central e recomeça
     numa central nova. Mudou a central: o que sabia não vale mais. */
  function conhecerCentralDoBloqueio(geracao) {
    if (!geracao || geracao === cfg.blqGeracao) return;
    cfg.blqGeracao = geracao; cfg.revLiberada = 0;
  }
  function fecharModalAberto() { const f = document.querySelector('#modal-root .fundo-modal'); if (f) f.remove(); }

  /* Longe da usina, sem a central, com internet: o aparelho pergunta na nuvem se foi bloqueado.
     O endereço da nuvem vem da central (na sincronização). No máximo a cada 10 minutos. */
  let ultimaConsultaNuvem = 0;
  async function conferirNaNuvem(agora) {
    if (cfg.demo || DEMO_IMG || !cfg.nuvemUrl || !cfg.chave) return;
    if (!agora && Date.now() - ultimaConsultaNuvem < 10 * 60000) return;
    ultimaConsultaNuvem = Date.now();
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(`${cfg.nuvemUrl.replace(/\/+$/, '')}/aparelho/${encodeURIComponent(cfg.deviceId)}`, { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) return;
      const d = await r.json();
      // a nuvem pode estar atrasada em relação à central: resposta mais velha que o bloqueio daqui não vale
      // (a central bloqueou agora e ainda não mandou para a nuvem, ou a nuvem tem um bloqueio antigo).
      // Compara pela revisão da central (só sobe), não pelo relógio.
      // a lista é de outra central (ou de nenhuma que este aparelho conheça): não vale para ele
      if (!d.geracao || d.geracao !== cfg.blqGeracao) return;
      const revisao = Number(d.revisao) || 0;
      const revAqui = cfg.bloqueio ? cfg.bloqueio.rev || 0 : 0;
      const revNuvem = d.bloqueio ? Number(d.bloqueio.rev) || 0 : 0;
      if (d.bloqueio) { if (revNuvem > (cfg.revLiberada || 0) && (!cfg.bloqueio || revNuvem >= revAqui)) aplicarBloqueio(d.bloqueio); }
      else if (cfg.bloqueio) { if (sync.modo !== 'online' && revisao > revAqui) liberarAparelho('O administrador liberou este aparelho.', revisao); }
      else if (revisao > (cfg.revLiberada || 0)) { cfg.revLiberada = revisao; salvarCfg(); } // livre: lembra até onde a lista confirma
    } catch (e) { /* sem internet: confere de novo depois */ }
  }

  /* ---------- Tela do aparelho bloqueado ---------- */
  const dataHora = (ms) => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  function telaBloqueioAdm() {
    const b = cfg.bloqueio || {};
    return `${cabecalho('Pranchetas digitais', 'Aparelho bloqueado', false)}
      <main><div class="tela-aviso"><div class="grande-ico">${ico('cadeado')}</div>
        <h1>Aparelho bloqueado</h1>
        <p>O administrador bloqueou este aparelho${b.em ? ` em ${dataHora(b.em)}` : ''}. ${b.apagar ? 'As anotações que estavam guardadas nele foram apagadas.' : 'As anotações guardadas nele continuam aqui e vão para a central quando ele for liberado.'}</p>
        <p>${b.modo !== 'senha' ? 'Fale com o escritório para liberar.' : b.resumo ? 'Para usar de novo, digite a senha de desbloqueio.' : 'Para usar a senha de desbloqueio, conecte este aparelho no Wi-Fi da usina.'}</p>
        ${b.modo === 'senha' ? `<button class="btn primario largo" data-a="liberar-senha" style="margin-top:12px">${ico('teclado')} Digitar a senha de desbloqueio</button>` : ''}
        <button class="btn largo" data-a="conferir-bloqueio" style="margin-top:12px">${ico('wifi')} Conferir de novo</button>
        <p class="sub" style="margin-top:16px">Este aparelho: ${esc(cfg.deviceId)}</p>
      </div></main>`;
  }
  /* ---------- Aparelhos: quem está usando, o nome no Android, o modelo e o endereço ---------- */
  const tempoCurto = (min) => (min == null ? '' : min < 60 ? `${Math.max(1, min)} min` : min < 1440 ? `${Math.round(min / 60)} h` : contar(Math.round(min / 1440), 'dia', 'dias'));
  const quemUsa = (a) => (a.papel === 'central' ? a.pessoa || 'Ninguém entrou' : a.operador || 'Ninguém no turno');
  const funcaoDoAparelho = (a) => a.nome || (a.papel === 'central' ? nomeDoChefe() : (setorPorId(a.papel) || {}).nome || 'sem setor');
  function modeloDoAparelho(a) {
    const i = a.info || {};
    const fab = i.fabricante ? i.fabricante.charAt(0).toUpperCase() + i.fabricante.slice(1) : '';
    const modelo = i.modelo || '';
    return [fab && !modelo.toLowerCase().startsWith(fab.toLowerCase()) ? fab : '', modelo].filter(Boolean).join(' ');
  }
  const situacaoDoAparelho = (a) => (a.bloqueio ? 'Bloqueado' : a.online ? 'Ligado' : a.minutos == null ? 'Sem sinal' : `Sem sinal há ${tempoCurto(a.minutos)}`);
  function linhaDoAparelho(a) {
    const nomeAndroid = (a.info && a.info.nome) || '';
    const modelo = modeloDoAparelho(a);
    return `<div class="aparelho-linha ${a.bloqueio ? 'bloqueado' : ''}">
      <span class="conexao ${a.bloqueio ? 'bloq' : a.online ? 'ok' : 'off'}"><i></i>${esc(situacaoDoAparelho(a))}</span>
      <div class="aparelho-texto"><b>${esc(quemUsa(a))}</b><small>${esc([nomeAndroid, funcaoDoAparelho(a)].filter(Boolean).join(' · '))}</small>${modelo && modelo !== nomeAndroid ? `<small>${esc(modelo)}</small>` : ''}</div>
      <button class="btn pequeno mais-info" data-a="aparelho-info" data-id="${esc(a.id)}" aria-label="Mais sobre ${esc(funcaoDoAparelho(a))}">${ico('mais')}</button>
    </div>`;
  }
  function telaAparelhos() {
    const lista = (sync.status && sync.status.aparelhos) || [];
    const ligados = lista.filter((a) => a.online).length;
    return `${topo('Aparelhos', `${contar(ligados, 'ligado agora', 'ligados agora')}`, true)}
      <main class="config tela-aparelhos">
        <p class="sub">Em cima, quem está usando; embaixo, o nome do aparelho no Android e a função dele. Toque no + para ver o modelo, o endereço na rede e para bloquear.</p>
        <div class="lista-aparelhos">${lista.map(linhaDoAparelho).join('') || '<p class="sub">Nenhum aparelho falou com a central ainda.</p>'}</div>
      </main>`;
  }
  async function verAparelho(id) {
    const a = ((sync.status && sync.status.aparelhos) || []).find((x) => x.id === id);
    if (!a) return;
    const i = a.info || {};
    const linhas = [
      ['Quem está usando', quemUsa(a)],
      ['Nome no Android', i.nome || 'não informado (aparelho com versão antiga ou navegador)'],
      ['Modelo', modeloDoAparelho(a) || 'não informado'],
      ['Sistema', i.android ? `Android ${i.android}` : i.navegador ? `Navegador ${i.navegador}` : 'não informado'],
      ['Função', funcaoDoAparelho(a)],
      ['Aplicativo', a.versao ? `versão ${a.versao}${a.versao !== VERSAO ? ' (falta atualizar)' : ''}` : 'versão antiga'],
      ['Endereço na rede (IP)', a.ip || 'não informado'],
      ['Situação', a.bloqueio ? `Bloqueado em ${dataHora(a.bloqueio.em)}${a.bloqueio.por ? ` por ${a.bloqueio.por}` : ''} (${a.bloqueio.modo === 'senha' ? 'pede a senha de desbloqueio' : 'travado de vez'})` : a.online ? 'Ligado agora' : a.minutos == null ? 'Sem sinal' : `Sem sinal há ${tempoCurto(a.minutos)}`],
      ['Conectou a primeira vez', a.desde ? dataHora(a.desde) : 'não informado'],
      ['Identificador', a.id],
    ];
    const admin = pode('pessoas');
    const esteAqui = a.id === cfg.deviceId;
    const acoes = !admin ? '<p class="sub" style="margin:8px 0 0">Só o administrador bloqueia e desbloqueia aparelhos.</p>'
      : esteAqui ? '<p class="sub" style="margin:8px 0 0">Este é o aparelho que você está usando.</p>'
        : `<div class="linha-botoes" style="margin-top:10px">${a.bloqueio ? `<button class="btn" data-k="desbloquear">${ico('certo')} Desbloquear</button>` : `<button class="btn perigo" data-k="bloquear">${ico('cadeado')} Bloquear este aparelho</button>`}</div>`;
    const resp = await abrirModal(`<h3>${esc(i.nome || funcaoDoAparelho(a))}</h3><p class="dica">${esc(funcaoDoAparelho(a))}</p>
      <div class="form-pessoa"><dl class="ficha">${linhas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <p class="sub" style="margin:0">O endereço MAC não aparece: o Android não mostra para os aplicativos.</p>
      ${acoes}</div>
      <div class="acoes-modal um"><button class="btn" data-k="x">Fechar</button></div>`, (k, b, fechar) => fechar(k), { classe: 'largo com-form' });
    if (resp === 'bloquear') return bloquearAparelho(a);
    if (resp === 'desbloquear') return desbloquearAparelho(a);
  }
  async function bloquearAparelho(a) {
    const estado = { modo: 'senha', apagar: false };
    const desenhar = (f) => {
      f.querySelectorAll('[data-k^="m:"]').forEach((b) => b.classList.toggle('sel', b.dataset.k === 'm:' + estado.modo));
      f.querySelector('#area-senha').hidden = estado.modo !== 'senha';
      const ap = f.querySelector('[data-k="apagar"]');
      ap.classList.toggle('sel', estado.apagar);
      ap.innerHTML = `${ico(estado.apagar ? 'certo' : 'fechar')} Apagar as anotações guardadas nele`;
    };
    const resp = await abrirModal(`<h3>Bloquear ${esc(funcaoDoAparelho(a))}</h3>
      <p class="dica">Na usina ele trava na hora. Longe da usina, trava quando abrir o aplicativo com internet (precisa da nuvem ligada).</p>
      <div class="form-pessoa">
        <div class="segmentos"><button data-k="m:senha">Pede senha para liberar</button><button data-k="m:trava">Trava de vez</button></div>
        <label id="area-senha">Senha de desbloqueio (4 a 8 números) <small>quem souber esta senha libera o aparelho; pode ser diferente da sua</small><input id="b-senha" inputmode="numeric" maxlength="8" autocomplete="off"></label>
        <div class="chips"><button class="chip-liga" data-k="apagar"></button></div>
        <p class="sub" style="margin:0">Apagando, o que já chegou na central continua lá; o que ainda não tinha chegado se perde.</p>
      </div>
      <div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn perigo" data-k="ok">${ico('cadeado')} Bloquear</button></div>`,
    (k, b, fechar, f) => {
      if (k === 'x') return fechar(undefined);
      if (k.startsWith('m:')) { estado.modo = k.slice(2); return desenhar(f); }
      if (k === 'apagar') { estado.apagar = !estado.apagar; return desenhar(f); }
      if (k !== 'ok') return;
      const codigo = f.querySelector('#b-senha').value.trim();
      if (estado.modo === 'senha' && !/^\d{4,8}$/.test(codigo)) return toast('A senha de desbloqueio tem de 4 a 8 números', 'erro');
      fechar({ modo: estado.modo, apagar: estado.apagar, codigo });
    }, { classe: 'largo com-form', aoAbrir: desenhar });
    if (!resp) return;
    const r = await postJson('api/aparelhos', Object.assign({ acao: 'bloquear', id: a.id }, resp), 10000).catch(() => null);
    if (!r) return toast('Não consegui falar com a central', 'erro');
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return toast(d.erro || 'A central recusou', 'erro');
    if (sync.status && d.aparelhos) sync.status.aparelhos = d.aparelhos;
    toast(`${funcaoDoAparelho(a)} bloqueado`);
    render();
  }
  async function desbloquearAparelho(a) {
    if (!(await confirmar(`Desbloquear ${funcaoDoAparelho(a)}?`, 'Ele volta a funcionar na próxima vez que falar com a central (ou com a nuvem, se estiver longe).', 'Desbloquear'))) return;
    const r = await postJson('api/aparelhos', { acao: 'desbloquear', id: a.id }, 10000).catch(() => null);
    if (!r) return toast('Não consegui falar com a central', 'erro');
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return toast(d.erro || 'A central recusou', 'erro');
    if (sync.status && d.aparelhos) sync.status.aparelhos = d.aparelhos;
    toast(`${funcaoDoAparelho(a)} desbloqueado`);
    render();
  }
  /** Demonstração (imagens e auditoria das telas): aparelhos de exemplo. */
  function statusDeExemplo() {
    const agora = Date.now();
    return {
      seq: 0, total: 0, codigo: '504140', enderecos: [], apk: true,
      aparelhos: [
        { id: cfg.deviceId, papel: 'central', operador: '', pessoa: 'Guilherme', ip: '127.0.0.1', versao: VERSAO, nome: 'Tablet do escritório', online: true, minutos: 0, info: { nome: 'Galaxy Tab S6 de Guilherme', fabricante: 'samsung', modelo: 'SM-T865', android: '13' }, desde: agora - 40 * 86400000, bloqueio: null },
        { id: 'ap-hid001', papel: 'hidrolise', operador: 'Felipe', pessoa: '', ip: '192.168.0.31', versao: VERSAO, nome: 'Tablet da Hidrólise', online: true, minutos: 0, info: { nome: 'Galaxy Tab A11+ da Hidrólise', fabricante: 'samsung', modelo: 'SM-X230', android: '15' }, desde: agora - 30 * 86400000, bloqueio: null },
        { id: 'ap-cal002', papel: 'caldeira', operador: 'Alberto', pessoa: '', ip: '192.168.0.32', versao: '2.10.0', nome: 'Tablet da Caldeira', online: false, minutos: 12, info: { nome: 'moto g54 de Alberto', fabricante: 'motorola', modelo: 'moto g54 5G', android: '14' }, desde: agora - 20 * 86400000, bloqueio: null },
        { id: 'ap-vel003', papel: 'ralo', operador: '', pessoa: '', ip: '192.168.0.40', versao: '2.8.0', nome: 'Tablet do Ralo / Pesagem', online: false, minutos: 3000, info: { nome: 'S23 de Diego', fabricante: 'samsung', modelo: 'SM-S911B', android: '14' }, desde: agora - 60 * 86400000, bloqueio: { em: agora - 2 * 3600000, modo: 'senha', apagar: true, por: 'Guilherme' } },
      ],
    };
  }

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
    const desenhar = (f) => { f.querySelector('.visor').innerHTML = s ? s.replace(/./g, '•') : '<small>Digite a senha</small>'; };
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
      <input type="${o.tipo || 'text'}" id="txt" maxlength="${o.max || 80}" value="${esc(o.valor || '')}" ${o.tipo === 'tel' ? 'inputmode="numeric"' : o.decimal ? 'inputmode="decimal"' : ''} autocapitalize="off" spellcheck="false">
      <div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn primario" data-k="ok">Salvar</button></div>`,
    (k, b, fechar, f) => { if (k === 'x') fechar(undefined); if (k === 'ok') fechar(f.querySelector('#txt').value.trim()); },
    { aoAbrir: (f) => setTimeout(() => f.querySelector('#txt').focus(), 50) });
  }
  function confirmar(titulo, dica, textoSim = 'Sim', perigo = false) {
    return abrirModal(`<h3>${esc(titulo)}</h3><p class="dica">${esc(dica || '')}</p>
      <div class="acoes-modal"><button class="btn" data-k="nao">Não</button><button class="btn ${perigo ? 'perigo' : 'primario'}" data-k="sim">${esc(textoSim)}</button></div>`,
    (k, b, fechar) => fechar(k === 'sim')).then((v) => !!v);
  }
  /* Enviar, guardar ou imprimir (versão 2.13): uma folha que sobe de baixo (puxa para baixo para fechar, ou tela inteira),
     com as áreas, os turnos, um dia ou um período e o formato. Resolve { formato, setores, turnos, dias, somar } ou undefined.
     soSetores: para imprimir (sem formato). */
  function escolherEnvio(titulo, data, soSetores) {
    const todos = setores();
    const marcados = new Set(todos.map((s) => s.id));
    const turnos = new Set(C.turnos.map((t) => t.id));
    const hoje = dataProducao();
    let modo = 'dia', dia = data || hoje, de = somarDias(dia, -6), ate = dia, somar = true;
    const chip = (k, sel, icone, nome) => `<button data-k="${k}" class="${sel ? 'sel' : ''}">${ico(sel ? 'certo' : icone)}<span>${esc(nome)}</span></button>`;
    const desenhar = (f) => {
      f.querySelector('.setores-envio').innerHTML = todos.map((s) => chip(`s:${s.id}`, marcados.has(s.id), s.icone, s.nome)).join('');
      f.querySelector('.turnos-envio').innerHTML = C.turnos.map((t) => chip(`t:${t.id}`, turnos.has(t.id), 'relogio', `${t.nome}, ${faixaTurno(t)}`)).join('');
      f.querySelectorAll('[data-k^="m:"]').forEach((b) => b.classList.toggle('sel', b.dataset.k === 'm:' + modo));
      f.querySelector('.dia-envio').innerHTML = modo === 'dia'
        ? `<div class="nav-data"><button class="btn" data-k="d:-1" aria-label="Dia anterior">${ico('voltar')}</button><div class="data-grande"><b>${fmtData(dia)}</b><span>${dia === hoje ? 'hoje' : diaSemana(dia)}</span></div><button class="btn" data-k="d:1" aria-label="Próximo dia" ${dia >= hoje ? 'disabled' : ''}>${ico('seta')}</button></div>`
        : `<div class="periodo-envio"><label>De <input type="date" id="env-de" value="${de}" max="${hoje}"></label><label>Até <input type="date" id="env-ate" value="${ate}" max="${hoje}"></label></div>
           <button class="chip-liga ${somar ? 'sel' : ''}" data-k="somar">${ico(somar ? 'certo' : 'fechar')} Somar as folhas do período (vai no Excel e no Resumo)</button>`;
    };
    const lerPeriodo = (f) => {
      if (modo === 'dia') return [dia];
      const a = (f.querySelector('#env-de') || {}).value || de, b = (f.querySelector('#env-ate') || {}).value || ate;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b) || a > b) { toast('Confira o período: a primeira data vem antes da segunda', 'erro'); return null; }
      const lista = [];
      for (let d = a; d <= b && lista.length <= 62; d = somarDias(d, 1)) lista.push(d);
      if (lista.length > 62) { toast('Escolha no máximo 62 dias', 'erro'); return null; }
      return lista;
    };
    const formatos = soSetores
      ? `<div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn primario" data-k="f:imprimir">${ico('imprimir')} Imprimir</button></div>`
      : `<h4>Formato</h4><div class="escolhas formatos-envio">
        <button data-k="f:pdf"><span class="escolha-ico">${ico('documento')}</span><b>PDF</b><small>Uma página para cada folha, igual ao papel</small></button>
        <button data-k="f:xlsx"><span class="escolha-ico">${ico('planilha')}</span><b>Excel</b><small>Uma aba para cada folha, igual ao papel</small></button>
        <button data-k="f:xml"><span class="escolha-ico">${ico('codigo')}</span><b>XML</b><small>Para o sistema do escritório</small></button>
        <button data-k="f:texto"><span class="escolha-ico">${ico('nota')}</span><b>Resumo</b><small>Mensagem com os totais de cada insumo, somados</small></button>
      </div>`;
    const acoes = soSetores ? '' : '<div class="acoes-modal um"><button class="btn" data-k="x">Cancelar</button></div>';
    // o meio rola dentro da folha; o puxador, o título e os botões de baixo ficam sempre à vista
    return abrirModal(`<div class="puxador" aria-hidden="true"><i></i></div>
      <div class="folha-baixo-cab"><h3>${esc(titulo)}</h3><button class="btn pequeno" data-k="tamanho">${ico('telaCheia')} <span>Tela inteira</span></button></div>
      <div class="folha-baixo-corpo">
        <h4>Áreas</h4><div class="chips-escolha setores-envio"></div>
        <h4>Turnos</h4><div class="chips-escolha turnos-envio"></div>
        <h4>Dia</h4><div class="segmentos quebra"><button data-k="m:dia">Um dia</button><button data-k="m:periodo">Período</button></div>
        <div class="dia-envio"></div>
        ${soSetores ? '' : formatos}
      </div>${soSetores ? formatos : acoes}`,
    (k, b, fechar, f) => {
      if (k === 'x') return fechar(undefined);
      if (k === 'tamanho') { const m = f.querySelector('.modal'); m.classList.toggle('cheia'); b.querySelector('span').textContent = m.classList.contains('cheia') ? 'Metade' : 'Tela inteira'; return; }
      if (k.startsWith('s:')) { const id = k.slice(2); if (marcados.has(id)) marcados.delete(id); else marcados.add(id); }
      if (k.startsWith('t:')) { const id = Number(k.slice(2)); if (turnos.has(id)) turnos.delete(id); else turnos.add(id); }
      if (k.startsWith('m:')) {
        if (modo === 'periodo') { de = (f.querySelector('#env-de') || {}).value || de; ate = (f.querySelector('#env-ate') || {}).value || ate; }
        modo = k.slice(2);
      }
      if (k.startsWith('d:')) { const d = somarDias(dia, Number(k.slice(2))); if (d <= hoje) dia = d; }
      if (k === 'somar') { de = (f.querySelector('#env-de') || {}).value || de; ate = (f.querySelector('#env-ate') || {}).value || ate; somar = !somar; }
      if (k.startsWith('f:')) {
        if (!marcados.size) return toast('Escolha pelo menos uma área', 'erro');
        if (!turnos.size) return toast('Escolha pelo menos um turno', 'erro');
        const dias = lerPeriodo(f);
        if (!dias) return;
        return fechar({ formato: k.slice(2), setores: todos.filter((s) => marcados.has(s.id)).map((s) => s.id), turnos: [...turnos], dias, somar: modo === 'periodo' && somar });
      }
      desenhar(f);
    }, { classe: 'largo folha-baixo', fundo: 'de-baixo', aoAbrir: (f) => { desenhar(f); puxarParaFechar(f); } });
  }
  /** Folha que sobe de baixo: puxando o puxador (ou o título) para baixo, ela fecha. */
  function puxarParaFechar(f) {
    const m = f.querySelector('.modal');
    const alca = f.querySelectorAll('.puxador, .folha-baixo-cab h3');
    let y0 = null;
    alca.forEach((el) => el.addEventListener('pointerdown', (e) => { y0 = e.clientY; m.style.transition = 'none'; el.setPointerCapture(e.pointerId); }));
    alca.forEach((el) => el.addEventListener('pointermove', (e) => { if (y0 === null) return; m.style.transform = `translateY(${Math.max(0, e.clientY - y0)}px)`; }));
    alca.forEach((el) => el.addEventListener('pointerup', (e) => {
      if (y0 === null) return;
      const dy = e.clientY - y0; y0 = null; m.style.transition = ''; m.style.transform = '';
      if (dy > 110) { const x = f.querySelector('[data-k="x"]'); if (x) x.click(); }
    }));
  }
  /* Turnos escolhidos no envio (versão 2.13): só para montar o arquivo. Linha de hora (folhas hora a hora e insumos) e
     dorna (pela hora de início) entram se a hora for de um turno marcado; o que não tem hora vai sempre. */
  let turnosDoEnvio = null;
  function noTurnoDoEnvio(r) {
    if (!turnosDoEnvio) return true;
    const p = prancheta(r.prancheta) || {};
    let h = null;
    if ((p.tipo === 'grade' || p.tipo === 'insumo') && /^\d+$/.test(r.chave)) h = Number(r.chave) % 24;
    else if (p.tipo === 'grade' && /^obs\d+$/.test(r.chave)) return turnosDoEnvio.has(Number(r.chave.slice(3)));
    else if (p.tipo === 'dornas') { const hora = (r.valores || {})[(p.envio || {}).inicio] || (r.valores || {}).inicio || (r.valores || {}).horario; if (/^\d{1,2}:\d{2}$/.test(hora || '')) h = Number(hora.split(':')[0]); }
    if (h === null) return true;
    const t = C.turnos.find((x) => h >= x.inicio && h < x.fim) || C.turnos[0];
    return turnosDoEnvio.has(t.id);
  }
  const listarPapel = (data, pid) => listar(data, pid).filter(noTurnoDoEnvio);
  /** Monta o arquivo (ou o resumo) do que foi escolhido. Vários dias: uma folha de cada dia, na ordem. */
  async function montarEnvio(escolha) {
    for (const d of escolha.dias) await buscarDia(d); // dia antigo: as anotações vêm da central antes
    turnosDoEnvio = escolha.turnos.length < C.turnos.length ? new Set(escolha.turnos) : null;
    try {
      if (escolha.formato === 'texto') return { texto: resumoDoEnvio(escolha) };
      if (escolha.formato === 'pdf') return { arquivo: await gerarPdf(escolha.dias, escolha.setores) };
      return { arquivo: gerarArquivo(escolha.formato, escolha.dias, escolha.setores, escolha.somar) };
    } finally { turnosDoEnvio = null; }
  }
  /** Os totais de cada insumo, somados nos dias (e turnos) escolhidos. */
  function totaisDoEnvio(dias, setorIds) {
    const soma = new Map();
    dias.forEach((d) => totaisDoDia(d, listarPapel).forEach((x) => {
      if (setorIds && !setorIds.includes((setores().find((s) => s.nome === x.setor) || {}).id)) return;
      const k = `${x.setor}|${x.insumo}|${x.unidade}`;
      const a = soma.get(k) || { setor: x.setor, insumo: x.insumo, unidade: x.unidade, quantidade: 0 };
      a.quantidade = Math.round((a.quantidade + x.quantidade) * 100) / 100;
      soma.set(k, a);
    }));
    return [...soma.values()];
  }
  function resumoDoEnvio(escolha) {
    const nomesTurnos = escolha.turnos.length < C.turnos.length ? ` · turnos: ${C.turnos.filter((t) => escolha.turnos.includes(t.id)).map((t) => t.nome).join(', ')}` : '';
    if (escolha.dias.length === 1) return resumoDoDia(escolha.dias[0], escolha.setores) + (nomesTurnos ? `\n\n(${nomesTurnos.slice(3)})` : '');
    const de = escolha.dias[0], ate = escolha.dias[escolha.dias.length - 1];
    const linhas = ['*PRANCHETAS UBIRÁLCOOL*', `Período de ${fmtData(de)} a ${fmtData(ate)} (${escolha.dias.length} dias)${nomesTurnos}`, '', '*TOTAIS DO PERÍODO (insumos)*'];
    let setorAtual = '';
    totaisDoEnvio(escolha.dias, escolha.setores).forEach((x) => {
      if (x.setor !== setorAtual) { setorAtual = x.setor; linhas.push('', `*${x.setor.toUpperCase()}*`); }
      linhas.push(`• ${x.insumo}: ${x.quantidade ? `${fmtNum(x.quantidade)} ${x.unidade}` : 'nada adicionado'}`);
    });
    return linhas.join('\n');
  }
  /** Imprimir: escolhe os setores e abre a impressão (dia antigo é buscado na central antes). */
  async function imprimirEscolhendo(data) {
    const escolha = await escolherEnvio('Imprimir as folhas', data, true);
    if (!escolha) return;
    for (const d of escolha.dias) await buscarDia(d);
    turnosDoEnvio = escolha.turnos.length < C.turnos.length ? new Set(escolha.turnos) : null;
    try { return await imprimirFolhas(escolha.dias, escolha.setores); } finally { turnosDoEnvio = null; }
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
  /* ---------- Lembrete de anotar a cada hora (versão 2.13) ----------
     Ligado por setor no tablet chefe (Configurações da usina). Na virada da hora, se a linha daquela hora de uma folha
     hora a hora do setor está vazia: faixa no alto da tela e um apito tranquilo. Passou das :30 sem anotar: apito chato,
     que só para quando a linha for anotada. */
  let lembrete = { id: null, avisou: false, apito: null };
  let lembreteUrgente = false; // só na demonstração
  function horaPendente() {
    if (!cfg.papel || ehCentral() || !setorPorId(cfg.papel) || !operadorAtual() || !(configSistema().lembretes || {})[cfg.papel]) return null;
    const h = new Date().getHours();
    const data = dataProducao();
    const falta = pranchetasDo(cfg.papel).filter((pid) => prancheta(pid).tipo === 'grade' && !pegar(data, pid, h));
    return falta.length ? { id: `${data}|${h}`, h, falta } : null;
  }
  function tocar(freq, tipo, vezes, volume) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      for (let i = 0; i < vezes; i++) {
        const t = i * 0.32;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = tipo; o.frequency.value = freq; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.26);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.28);
      }
      setTimeout(() => ctx.close().catch(() => {}), vezes * 320 + 400);
    } catch (e) { /* sem som */ }
  }
  const apitoTranquilo = () => tocar(660, 'sine', 2, 0.18);
  const apitoChato = () => { tocar(1200, 'square', 3, 0.35); try { if (navigator.vibrate) navigator.vibrate([400, 150, 400]); } catch (e) { /* sem vibração */ } };
  function faixaLembrete(p, urgente) {
    let el = document.getElementById('lembrete');
    if (!el) {
      el = Object.assign(document.createElement('div'), { id: 'lembrete', className: 'lembrete' });
      el.setAttribute('role', 'alert');
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pid]');
        if (b && !modalAberto()) ir({ tela: 'prancheta', pid: b.dataset.pid, chave: Number(b.dataset.h) });
      });
      document.body.appendChild(el);
    }
    if (!p) { el.hidden = true; return; }
    const nomes = p.falta.map((pid) => prancheta(pid).nome).join(' e ');
    el.hidden = false;
    el.classList.toggle('urgente', !!urgente);
    el.innerHTML = `${ico(urgente ? 'alerta' : 'relogio')}<span><b>${urgente ? 'Ainda falta anotar' : 'Hora de anotar'} as ${pad2(p.h)}:00</b> ${esc(nomes)}</span>
      <button class="btn" data-pid="${p.falta[0]}" data-h="${p.h}">Anotar agora</button>`;
  }
  function verificarLembrete() {
    const p = horaPendente();
    if (!p || lembrete.id !== p.id) { if (lembrete.apito) clearInterval(lembrete.apito); lembrete = { id: p ? p.id : null, avisou: false, apito: null }; }
    if (!p) return faixaLembrete(null);
    const urgente = lembreteUrgente || new Date().getMinutes() >= 30;
    faixaLembrete(p, urgente);
    if (!lembrete.avisou) { lembrete.avisou = true; apitoTranquilo(); }
    if (urgente && !lembrete.apito) { apitoChato(); lembrete.apito = setInterval(apitoChato, 2500); }
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
  let aoAtualizarEdicao = null; // o que mais a tela atualiza ao teclar (ex.: total do volume de vinho)
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
      ${a.calculo && a.calculo() ? `<p class="calc-painel">Volume: <b>${esc(a.calculo())}</b></p>` : ''}
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
    const cls = ['campo', vazio(v) ? '' : 'preenchido', nivel, ativo ? 'ativo' : '', a.largo ? 'largo' : '', a.calculo ? 'com-calc' : ''].join(' ');
    const u = a.unidade || (a.getUnidade ? a.getUnidade() : '');
    let mostra;
    if (vazio(v)) mostra = `<span class="val vazio">${esc(a.vazioTexto || (a.type === 'check' ? 'Toque para marcar' : a.type === 'choice' ? 'Toque para escolher' : 'Toque para anotar'))}</span>`;
    else if (a.type === 'check') mostra = `<span class="val marca">${ico('certo')} ${esc(v)}</span>`;
    else if (a.type === 'text' || a.type === 'choice') mostra = `<span class="val texto">${esc(v)}</span>`;
    // o aviso (pH baixo, Brix alto) fica do lado do número, curto: a caixa não muda de tamanho
    else mostra = `<span class="val">${esc(fmtCampo(a, v))}${u ? `<small>${esc(u)}</small>` : ''}</span>`;
    // nome curto ("B") só vale com o título do bloco à vista ("Colunas"); com os títulos escondidos (tela baixa), vai o nome inteiro
    const rotulo = curto && a.labelCurto && a.labelCurto !== a.label
      ? `<span class="rot-curto">${esc(a.labelCurto).replace(/ Nº (\d+)$/, '<span class="rot-n"> Nº</span> $1')}</span><span class="rot-longo">${esc(a.label)}</span>` : esc(a.label);
    // o aviso (pH baixo) e o que sai da conta (volume da dorna) ficam na linha do nome, do lado:
    // o número continua grande e numa linha só, e todos os quadros ficam do mesmo tamanho
    const calc = !avisos.length && a.calculo ? a.calculo() : '';
    const selo = avisos.length ? `<em class="tag-aviso">${esc(avisos[0].curto)}</em>` : calc ? `<em class="tag-calc">${esc(calc)}</em>` : '';
    return `<button class="${cls}" data-quadro="${esc(a.id)}"><span class="rot"><span class="rot-txt">${rotulo}</span>${selo}</span>${mostra}</button>`;
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
      g.innerHTML = htmlQuadros(alvos.filter((a) => ids.includes(a.id)), g.dataset.curto === '1');
      refeitos.push(g);
    });
    const p = document.getElementById('painel');
    if (p) { p.innerHTML = htmlPainel(); refeitos.push(p); apertarPainel(); }
    const ativo = document.querySelector('.campo.ativo');
    // depois que o teclado abriu e a tela se ajeitou
    if (ativo && ed.alvoId !== ed.rolouPara) requestAnimationFrame(() => { const el = document.querySelector('.campo.ativo'); if (el) el.scrollIntoView({ block: 'nearest' }); });
    ed.rolouPara = ativo ? ed.alvoId : null;
    if (aoAtualizarEdicao) aoAtualizarEdicao();
    if (trocouPainel) arrumarQuadros();
    agendarCaber(tudo ? null : refeitos);
  }
  /* Os blocos de quadros ocupam a tela inteira: em linhas equilibradas (3 + 2, e não 4 + 1), esticando até a largura
     toda (cada bloco divide a linha pelo número de quadros), e com os quadros da altura que couber, para nada ficar
     escondido atrás do botão de salvar. Se nem no tamanho mínimo couber, a lista rola. */
  // o espaço da tela muda depois de desenhar (letra das abas ajustada, teclado, celular virado): arruma de novo
  const observarEspaco = typeof ResizeObserver === 'function' ? new ResizeObserver(() => requestAnimationFrame(() => arrumarQuadros())) : null;
  let espacoObservado = null;
  /** Painel do teclado sem rolar (versão 2.13): se não couber, sai a dica e o visor diminui; se ainda não couber, as teclas encolhem. */
  function apertarPainel() {
    const p = document.getElementById('painel');
    if (!p || !p.offsetHeight) return;
    p.classList.remove('apertado', 'muito-apertado');
    if (p.scrollHeight <= p.clientHeight + 1) return;
    p.classList.add('apertado');
    if (p.scrollHeight > p.clientHeight + 1) p.classList.add('muito-apertado');
  }
  function arrumarQuadros(semTitulos) {
    if (!semTitulos) apertarPainel();
    const caixa = app.querySelector('.edicao main .grupos');
    if (!caixa) return;
    const main = caixa.closest('main');
    if (observarEspaco && espacoObservado !== main) { observarEspaco.disconnect(); observarEspaco.observe(main); espacoObservado = main; }
    // pouco espaço (teclado aberto no tablet deitado): os títulos dos blocos saem, cada quadro já diz o que é.
    // Só se assim couber tudo; se nem assim couber, os títulos ficam e a lista rola.
    caixa.classList.toggle('compacto', semTitulos === 'tentar');
    caixa.querySelectorAll(':scope > .quebra').forEach((q) => q.remove());
    const blocos = [...caixa.children].filter((b) => b.classList.contains('grupo'));
    if (!blocos.length || !caixa.clientWidth) return;
    const est = getComputedStyle(caixa);
    const num = (nome, padrao) => parseFloat(est.getPropertyValue(nome)) || padrao;
    const gap = parseFloat(est.columnGap) || 8;
    const largura = caixa.clientWidth;
    const quadros = blocos.map((b) => Number(b.dataset.n) || 1);
    // quantos quadros cabem numa linha: a largura mínima de cada um, mais o espaço entre eles e a borda de cada bloco
    const par0 = blocos[0].querySelector('.par');
    const gapQ = par0 ? parseFloat(getComputedStyle(par0).columnGap) || 8 : 8;
    const borda = blocos.reduce((s, b) => s + b.offsetWidth - (b.querySelector('.par') || b).clientWidth, 0) / blocos.length;
    const porBloco = Math.max(1, quadros.reduce((s, n) => s + n, 0) / blocos.length);
    const umax = Math.max(1, Math.floor((largura + gap + gapQ) / (num('--q-largura-min', 140) + gapQ + (borda + gap) / porBloco)));
    // bloco com mais quadros que a linha (ou o quadro largo, como a observação) ocupa a linha inteira
    const unidades = blocos.map((b, i) => (b.classList.contains('grupo-largo') ? umax : Math.min(quadros[i], umax)));
    const encher = (cabe) => {
      const linhas = [];
      unidades.forEach((u, i) => { const l = linhas[linhas.length - 1]; if (!l || l.soma + u > cabe) linhas.push({ soma: u, itens: [i] }); else { l.soma += u; l.itens.push(i); } });
      return linhas;
    };
    let melhor = null;
    for (let cabe = umax; cabe >= Math.max(...unidades); cabe--) {
      const linhas = encher(cabe);
      const somas = linhas.map((l) => l.soma);
      const nota = linhas.length * 1000 + Math.max(...somas) - Math.min(...somas);
      if (!melhor || nota < melhor.nota) melhor = { nota, linhas };
    }
    blocos.forEach((b, i) => {
      // bloco que não cabe numa linha se divide por igual: 4 quadros ficam 2 e 2 (não 3 e 1), 5 ficam 3 e 2
      const colunas = b.classList.contains('grupo-largo') ? 1 : quadros[i] <= umax ? quadros[i] : Math.ceil(quadros[i] / Math.ceil(quadros[i] / umax));
      b.style.flex = `${unidades[i]} 1 0px`;
      b.style.setProperty('--colunas', colunas);
      b.dataset.fileiras = Math.ceil(quadros[i] / colunas);
    });
    melhor.linhas.slice(0, -1).forEach((l) => blocos[l.itens[l.itens.length - 1]].after(Object.assign(document.createElement('i'), { className: 'quebra' })));
    // altura: o espaço que sobra na tela dividido pelas fileiras de quadros (tirando títulos e bordas dos blocos)
    const q0 = caixa.querySelector('.campo');
    if (!q0) return;
    const atual = q0.offsetHeight;
    let fileiras = 0, sobra = 0;
    melhor.linhas.forEach((l) => {
      const f = Math.max(...l.itens.map((i) => Number(blocos[i].dataset.fileiras)));
      fileiras += f;
      sobra += Math.max(...l.itens.map((i) => blocos[i].offsetHeight - Number(blocos[i].dataset.fileiras) * atual - (Number(blocos[i].dataset.fileiras) - 1) * gapQ)) + (f - 1) * gapQ;
    });
    const estMain = getComputedStyle(main);
    const acima = caixa.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - parseFloat(estMain.paddingTop);
    const livre = main.clientHeight - parseFloat(estMain.paddingTop) - parseFloat(estMain.paddingBottom) - acima - sobra - melhor.linhas.length * num('--gap-linha', 8) - 2;
    const naoCabe = livre / fileiras < num('--q-min', 72);
    if (naoCabe && !semTitulos && caixa.querySelector(':scope > .grupo > h3')) return arrumarQuadros('tentar');
    if (naoCabe && semTitulos === 'tentar') return arrumarQuadros('manter');
    const q = Math.max(num('--q-min', 72), Math.min(num('--q-max', 170), Math.floor(livre / fileiras)));
    caixa.style.setProperty('--q', q + 'px');
    caixa.classList.add('arrumados');
  }

  function grupoQuadros(lista) { return `<div class="campos" data-grupo="${lista.map((a) => esc(a.id)).join(',')}">${htmlQuadros(lista)}</div>`; }

  /** Quadros em blocos: o que anda junto fica junto (hora início e fim, Brix e BHX...).
      Quadros sem bloco viram um bloco sem título; o quadro largo (observação) fica numa linha só dele.
      Quem arruma os blocos na tela é o arrumarQuadros. */
  function blocosDeQuadros(grupos, lista) {
    const bloco = (titulo, doBloco, largo) => `<section class="grupo ${titulo ? '' : 'sem-titulo'} ${largo ? 'grupo-largo' : ''}" data-n="${doBloco.length}">${titulo ? `<h3>${esc(titulo)}</h3>` : ''}
        <div class="par" ${titulo ? 'data-curto="1"' : ''} data-grupo="${doBloco.map((a) => esc(a.id)).join(',')}">${htmlQuadros(doBloco, !!titulo)}</div></section>`;
    const emGrupo = new Set((grupos || []).flatMap((g) => g.campos));
    const soltos = lista.filter((a) => !emGrupo.has(a.id));
    const blocos = (grupos || []).map((g) => {
      const doGrupo = g.campos.map((id) => lista.find((a) => a.id === id)).filter(Boolean);
      return doGrupo.length ? bloco(g.titulo, doGrupo) : '';
    });
    const normais = soltos.filter((a) => !a.largo);
    if (normais.length) blocos.push(bloco('', normais));
    soltos.filter((a) => a.largo).forEach((a) => blocos.push(bloco('', [a], true)));
    return `<div class="grupos">${blocos.join('')}</div>`;
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
  async function voltar() {
    if (modalAberto()) return modalFixo ? undefined : fecharModalAtual();
    if (pilha.length > 1 && view().sujo && !(await confirmar('Sair sem salvar?', 'O que foi mudado nesta tela se perde.', 'Sair sem salvar', true))) return;
    if (painelVisivel()) { ed.oculto = true; return atualizarEdicao(); }
    if (rascunhoSujo()) salvarRascunho(true);
    if (pilha.length > 1) { pilha.pop(); rascunho = null; ed.alvoId = null; render(true); }
  }
  if (!DEMO_IMG) {
    history.pushState({ app: 1 }, '');
    window.addEventListener('popstate', () => { history.pushState({ app: 1 }, ''); voltar(); });
    window.voltarDoAndroid = voltar;
  }
  function telaInicial() {
    if (!cfg.chave && !cfg.demo) return { tela: 'conectar' };
    if (!cfg.papel) return { tela: 'configurar' };
    if (ehCentral()) return { tela: 'central', data: dataProducao() };
    if (ehEscritorio()) return { tela: 'escritorio', data: cfg.demo ? dataProducao() : diaFechado() };
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
        ${atualizacao.nova ? `<button class="tema atualizar" data-a="atualizacao" aria-label="Atualizar o aplicativo para a versão ${esc(atualizacao.nova.versao)}">${ico('instalar')}<span>Atualizar</span></button>` : ''}
        ${configurado && (view() || {}).tela !== 'admin' ? `<button class="tema" data-a="admin" aria-label="Ajustes do aparelho">${ico('ajustes')}<span>Ajustes</span></button>` : ''}
        <button class="tema" data-a="tema" aria-label="${escuro ? 'Mudar para tela clara' : 'Mudar para tela escura'}">${ico(escuro ? 'sol' : 'lua')}<span>${escuro ? 'Claro' : 'Escuro'}</span></button>
      </header>`;
  }
  function atalhosOperador() {
    const op = operadorAtual();
    const v = view();
    const p = ehCentral() ? pessoaAtual() : null;
    return `${!ehCentral() ? `<button class="atalho ${op ? '' : 'alerta'}" data-a="trocar-operador">${ico('pessoa')}<span>${esc(op || 'Seu nome')}</span></button>`
      : `<button class="atalho pessoa-chefe ${p ? '' : 'alerta'}" data-a="pessoa" aria-label="${p ? `${esc(p.nome)}: toque para sair` : 'Entrar com a sua senha'}">${ico('pessoa')}<span>${esc(p ? p.nome : 'Entrar')}</span></button>`}
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
    aoAtualizarEdicao = null;
    aplicarFolhas(); // mudança nas folhas que chegou do tablet chefe
    let v = view();
    if (cfg.bloqueio && !DEMO_IMG) v = { tela: 'bloqueado-adm' };
    else if (foraDaRede() && v.tela !== 'bloqueado') v = { tela: 'bloqueado' };
    const telas = {
      conectar: telaConectar, preparando: telaPreparando, bloqueado: telaBloqueado, configurar: telaConfigurar, operador: telaOperador,
      inicio: telaInicio, prancheta: telaPrancheta, central: telaCentral, relatorios: telaRelatorios, leitura: telaLeitura, config: telaConfig, admin: telaAdmin, avisos: telaAvisos,
      pessoas: telaPessoas, registro: telaRegistro, graficos: telaGraficos, folhas: telaFolhas,
      aparelhos: telaAparelhos, 'bloqueado-adm': telaBloqueioAdm,
      escritorio: telaEscritorio, 'esc-calculos': telaEscCalculos, 'esc-rastreamento': telaEscRastreamento,
    };
    const chaveTela = JSON.stringify([v.tela, v.pid, v.data, v.monitor]);
    const outraTela = chaveTela !== ultimaChaveTela;
    const mesmaTela = !trocouDeTela && !outraTela;
    // a atualização que vem da central (a cada 5 s) não pode mudar onde a pessoa está: guarda e volta cada rolagem
    const ROLAM = '.abas, .seletor, .tabela-wrap, .cabecalho-form, .chips-escolha, .lista-avisos, main';
    const rolagens = mesmaTela ? [...app.querySelectorAll(ROLAM)].map((el) => [el.scrollLeft, el.scrollTop]) : [];
    alvos = [];
    // a animação de entrada é só de quem trocou de tela: o redesenho que vem da central (a cada 5 s) não pode piscar
    app.classList.remove('troca', 'troca-linha');
    app.innerHTML = (telas[v.tela] || telaInicio)(v);
    ultimaChaveTela = chaveTela;
    if (mesmaTela) app.querySelectorAll(ROLAM).forEach((el, i) => { if (rolagens[i]) { el.scrollLeft = rolagens[i][0]; el.scrollTop = rolagens[i][1]; } });
    else rolarDepois = true; // abriu a tela ou trocou a linha: a escolhida vai para o meio
    if (v.tela === 'central') desenharQr();
    if (v.tela === 'conectar' && NO_APK && pluginCentral && !procura.feita && !conexaoForm.endereco) setTimeout(procurarCentral, 300);
    if (v.tela === 'relatorios' && !v.carregado) carregarRelatorios();
    if (v.data) buscarDia(v.data);
    if (trocouDeTela) app.classList.add(outraTela ? 'troca' : 'troca-linha');
    arrumarQuadros();
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
  /** Nome que vai nas anotações. No tablet chefe (que não escolhe operador) vai o nome dele. */
  const quemAnota = () => operadorAtual() || (ehCentral() ? (pessoaAtual() || {}).nome || nomeDoChefe() : null);
  const ehDoChefe = (nome) => nome === 'escritório' || nome === 'Tablet chefe' || nome === 'Painel do escritório';
  /** Folha que só o tablet chefe anota (área Vinho e Fermentação): lá o chefe tem os mesmos botões que o tablet do setor teria. */
  const soDoChefe = (pid) => !!(setorDaPrancheta(pid) || {}).soChefe;
  const anotaComoSetor = (pid) => !ehCentral() || soDoChefe(pid);
  const detalheDoChefe = () => 'Acompanha todos os setores, manda avisos e relatórios';
  function gradePapeis() {
    return `<div class="papeis">
      ${todosSetores.filter((s) => !s.soChefe).map((s) => cartaoPapel(s.id, s.icone, s.nome, pranchetasDo(s.id).map((pid) => prancheta(pid).nome).join(', '), cfg.papel === s.id)).join('')}
      ${cartaoPapel('central', 'escritorio', nomeDoChefe(), detalheDoChefe(), ehCentral())}
      ${cartaoPapel('escritorio', 'documento', 'Escritório', 'Cálculos da produção, rastreamento de lotes e etiqueta das bombonas', ehEscritorio())}
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
    if (p.tipo === 'medicao') {
      const m = medicaoDoDia(data);
      if (!m.medidas) return { texto: hoje ? 'Nenhuma medição hoje' : 'Nenhuma medição neste dia' };
      return { texto: `${m.medidas} de ${m.total} dornas medidas${m.hora ? ` (${m.hora})` : ''}. Vinho da produção: ${litros(m.producao, true)}`, estado: 'feito' };
    }
    if (p.tipo === 'fermentacao') {
      if (!hoje) {
        const enchidas = dornasDeFermentacao().filter(({ n }) => (ciclosPorDorna().get(n) || []).some((r) => r.data === data)).length;
        return enchidas ? { texto: `${contar(enchidas, 'dorna enchida', 'dornas enchidas')} neste dia`, estado: 'feito' } : { texto: 'Nenhuma dorna enchida neste dia' };
      }
      const et = dornasDeFermentacao().map(({ n }) => ({ n, et: etapaFerm(cicloAtual(n)) }));
      const por = (e) => et.filter((x) => x.et === e).map((x) => x.n);
      const vol = naVolante();
      const partes = [];
      if (vol.length) partes.push(`Volante: Nº ${listaE(vol.map((s) => s.n))} desde ${vol[0].inicio}`);
      if (por('enchendo').length) partes.push(`Enchendo: Nº ${listaE(por('enchendo'))}`);
      if (por('fermentando').length) partes.push(`Fermentando: Nº ${listaE(por('fermentando'))}`);
      if (!partes.length) return { texto: 'Nenhuma dorna com vinho' };
      return { texto: partes.join('. ') + '.', estado: vol.length || por('enchendo').length ? 'andamento' : 'feito' };
    }
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
  const iconeDaPrancheta = (pid) => { const p = prancheta(pid); if (p.tipo === 'medicao') return 'regua'; if (p.tipo === 'fermentacao') return 'tanque'; return p.tipo === 'insumo' || p.tipo === 'juntas' ? 'balanca' : p.tipo === 'grade' ? 'relogio' : setorDaPrancheta(pid).icone; };

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
    // volume de vinho: o primeiro grupo que ainda não foi medido hoje
    if (p.tipo === 'medicao') return (gruposDaMedicao().find((g) => !pegar(data, pid, g.id)) || gruposDaMedicao()[0]).id;
    // fermentação: a dorna que está indo para a volante, senão a que está enchendo
    if (p.tipo === 'fermentacao') {
      const l = dornasDeFermentacao();
      const et = (n) => etapaFerm(cicloAtual(n));
      return (l.find((x) => et(x.n) === 'volante') || l.find((x) => et(x.n) === 'enchendo') || l[0] || {}).n;
    }
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

  /** Quando foi mexida a anotação que está na linha (0 se ainda não tem). */
  function fonteDaFolha(p, pid, data, chave) {
    if (p.tipo === 'fermentacao') { const c = cicloAtual(chave); return c ? c.atualizadoEm || 0 : 0; }
    if (p.tipo === 'juntas') return p.partes.map((pt) => (pegar(data, pt.prancheta, chave) || {}).atualizadoEm || 0).join(',');
    return (pegar(data, pid, chave) || {}).atualizadoEm || 0;
  }

  function prepararRascunho(v) {
    const p = prancheta(v.pid);
    const data = dataDaView(v);
    const chave = v.chave != null ? v.chave : chavePadrao(p, v.pid, data);
    // fermentação: o rascunho é do enchimento que está na dorna (outro aparelho começou um novo: recomeça)
    const cicloDaTela = p.tipo === 'fermentacao' ? cicloAtual(chave) : null;
    const chaveView = `${data}|${v.pid}|${chave}${cicloDaTela ? '|' + cicloDaTela.id : ''}`;
    // se outro aparelho mandar a anotação desta linha enquanto a pessoa só olha, a tela mostra a nova
    const fonte = fonteDaFolha(p, v.pid, data, chave);
    if (rascunho && rascunho.chaveView === chaveView && (rascunho.fonte === fonte || rascunhoSujo())) return { p, data, chave };
    const extras = { operador: '' };
    let valores = {};
    let novo = true;
    let origem = '';
    let horaAuto = [];
    let ciclo = null;

    if (p.tipo === 'medicao') {
      const r = pegar(data, v.pid, chave);
      novo = !r;
      valores = r ? Object.assign({}, r.valores) : {};
      extras.operador = r ? r.operador || '' : '';
      // hora da medição: acompanha o relógio até a pessoa mudar
      if (!r && chave !== 'param') { valores.hora = horaAgora(); horaAuto.push('hora'); }
    } else if (p.tipo === 'fermentacao') {
      const aberto = cicloDaTela && etapaFerm(cicloDaTela) !== 'vazia';
      valores = { enche_inicio: '', enche_fim: '', brix_inicial: '' };
      if (aberto) { p.campos.forEach((c) => { valores[c.id] = cicloDaTela.valores[c.id] || ''; }); ciclo = { data: cicloDaTela.data, chave: cicloDaTela.chave }; }
      novo = !aberto;
      extras.operador = aberto ? cicloDaTela.operador || '' : '';
    } else if (p.tipo === 'juntas') {
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
    rascunho = { chaveView, fonte, chave, data, operador: operadorAtual(), novo, origem, valores, extras, horaAuto, ciclo, tocados: {}, original: JSON.parse(JSON.stringify(valores)), originalExtras: JSON.stringify(extras) };
    return { p, data, chave };
  }

  function montarAlvos(p, chave) {
    const val = rascunho.valores;
    const dia = rascunho.data || dataProducao();
    // versão 2.12: a unidade é a do dia da folha (a troca vale a partir do dia em que foi feita)
    const campo = (c) => Object.assign({}, c, { unidade: window.Folhas.unidadeNoDia(c, dia) || undefined, opcoes: c.type === 'choice' ? opcoesDe(c) : c.opcoes, get: () => val[c.id], set: (x) => { val[c.id] = x; } });
    // o quadro que o dono escondeu do operador não aparece no tablet do setor (o tablet chefe vê)
    const visivel = (c) => !c.arquivado && (ehCentral() || !c.oculto);
    if (p.tipo === 'fermentacao') return p.campos.filter(visivel).map(campo);
    if (p.tipo === 'medicao') {
      if (chave === 'param') return p.parametros.filter(visivel).map(campo);
      const g = grupoDaMedicao(chave);
      if (!g) return [];
      const lista = [{ id: 'hora', label: 'Hora da medição', labelCurto: 'Hora', type: 'time', get: () => val.hora, set: (x) => { val.hora = x; } }];
      const num = (x) => fmtNum(String(x));
      g.dornas.forEach((d) => {
        const idF = d.id + '_folga';
        // o número da dorna vai em cada quadro ("Folga Nº 7"), para saber de qual dorna é olhando um quadro só
        const n = /^Dorna (\d+)$/.exec(d.nome);
        const marca = n ? ` Nº ${n[1]}` : '';
        lista.push({
          id: idF, dornaId: d.id, label: `${d.nome}: folga`, labelCurto: 'Folga' + marca, type: 'num', dec: 2, unidade: 'm', min: 0,
          avisos: temMedida(d) ? [{ quando: '>', valor: Number(d.altura), nivel: 'alerta', texto: `Folga maior que a altura da dorna (${num(d.altura)} m)`, curto: 'Maior que a dorna' }] : [],
          dica: temMedida(d) ? `${d.nome}: altura ${num(d.altura)} m, base ${num(d.area)} m². Volume = (altura − folga) × base${emM3(g) ? ', em m³' : ' × 1000'}.` : `${d.nome} está sem medida: o escritório cadastra em Configurações da usina.`,
          // o volume aparece do lado da folga, na hora
          calculo: () => { const vol = volumeDe(d, val[idF], g); return vol != null ? volumeTexto(vol, g, true) : !vazio(val[idF]) && !temMedida(d) ? 'sem medida' : ''; },
          get: () => val[idF], set: (x) => { val[idF] = x; },
        });
        if (g.brix) lista.push({ id: d.id + '_brix', dornaId: d.id, label: `${d.nome}: Brix`, labelCurto: 'Brix' + marca, type: 'num', dec: 1, min: 0, max: 40, get: () => val[d.id + '_brix'], set: (x) => { val[d.id + '_brix'] = x; } });
        if (g.fermentando) lista.push({ id: d.id + '_ferm', dornaId: d.id, label: `${d.nome}: fermentando?`, labelCurto: 'Fermentando' + marca, type: 'choice', opcoes: ['Sim', 'Não'], get: () => val[d.id + '_ferm'], set: (x) => { val[d.id + '_ferm'] = x; } });
      });
      return lista;
    }
    if (p.tipo === 'dornas') {
      const ordem = p.grupos ? p.grupos.flatMap((g) => g.campos) : p.campos.map((c) => c.id);
      return ordem.map((id) => p.campos.find((c) => c.id === id)).filter(Boolean).filter(visivel).map(campo);
    }
    if (p.tipo === 'grade') {
      const t = turnoDaHora(chave);
      return [...p.itens.filter(visivel).map(campo), { id: 'obs', label: `Observação do ${t.nome}`, type: 'text', largo: true, get: () => rascunho.extras.obs, set: (x) => { rascunho.extras.obs = x; } }];
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
    (p.camposOperador || []).filter(visivel).forEach((c) => {
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

  /* ---------- Volume de vinho: a folha do dia e os totais ---------- */
  function totaisMedicaoHtml(data, chave) {
    const med = medicaoDoDia(data, chave !== 'param' && rascunho ? { grupo: chave, valores: rascunho.valores } : null);
    const x = med.grupos.find((y) => y.g.id === chave);
    const parte = x && !x.g.soma ? `${esc(x.g.nome)}: <b>${volumeTexto(x.subtotal, x.g)}</b>` : x ? `Subtotal: <b>${litros(x.subtotal)}</b>` : '';
    return `${parte ? `<span class="par-total">${parte}</span>` : ''}<span class="par-total">Vinho da produção: <b>${litros(med.producao)}</b></span>`;
  }
  function folhaMedicaoHtml(p, data, chave) {
    const med = medicaoDoDia(data);
    const num = (x) => (vazio(x) ? '' : esc(fmtNum(x)));
    return `<div class="folha">${cabecalhoFolha(p, data)}<div class="tabela-wrap"><table class="papel medicao">
      <thead><tr><th>Dornas</th><th>Folga (m)</th><th>Volume</th><th>Brix</th><th>Fermentando</th></tr></thead>
      <tbody>${med.grupos.map((x) => `<tr class="grupo-linha clicavel ${x.g.id === chave ? 'sel' : ''}" data-a="linha" data-chave="${x.g.id}"><td colspan="5"><b>${esc(x.g.nome)}</b>${x.hora && x.medidas ? ` <span>medido às ${esc(x.hora)}${x.operador ? ` por ${esc(x.operador)}` : ''}</span>` : ''}</td></tr>
        ${x.linhas.map((l) => `<tr class="clicavel" data-a="linha" data-chave="${x.g.id}"><td>${esc(l.d.nome)}</td><td>${num(l.folga)}</td><td><b>${l.volume == null ? (vazio(l.folga) || temMedida(l.d) ? '' : 'sem medida') : esc(volumeTexto(l.volume, x.g))}</b></td><td>${x.g.brix ? num(l.brix) : ''}</td><td>${x.g.fermentando ? esc(l.ferm || '') : ''}</td></tr>`).join('')}
        <tr class="subtotal"><td>Subtotal</td><td></td><td><b>${esc(volumeTexto(x.subtotal, x.g))}</b></td><td colspan="2"></td></tr>`).join('')}
        <tr class="total"><td>Total geral de vinho da produção</td><td></td><td><b>${esc(litros(med.producao))}</b></td><td colspan="2"></td></tr>
        <tr class="total"><td>Total nos tanques de álcool</td><td></td><td><b>${esc(volumeTexto(med.tanques, gruposDaMedicao().find((y) => !y.soma)))}</b></td><td colspan="2"></td></tr></tbody>
    </table></div></div>
    <div class="folha" style="margin-top:12px"><div class="folha-cab"><div><b>Parâmetros da produção</b><span>Favor verificar e anotar diariamente</span></div></div><div class="tabela-wrap"><table class="papel">
      <thead><tr><th></th><th>Brix</th><th>Horário</th></tr></thead>
      <tbody>${[['Brix no ralo', 'brix_ralo', 'hora_ralo'], ['Brix na hidrólise', 'brix_hid', 'hora_hid'], ['Brix na fermentação', 'brix_ferm', 'hora_ferm']].map(([rot, b, h]) => `<tr class="clicavel" data-a="linha" data-chave="param"><td>${rot}</td><td>${num(med.param[b])}</td><td>${esc(med.param[h] || '')}</td></tr>`).join('')}</tbody>
    </table></div></div>`;
  }

  /* ---------- Dornas de fermentação: o cartão da dorna e a folha do dia ---------- */
  const diaCurto = (iso) => fmtData(iso).slice(0, 5);
  function cartaoDaDorna(n, r) {
    const et = etapaFerm(r);
    const partes = [];
    if (et !== 'vazia') {
      const v = r.valores;
      partes.push(`<p>${ico('tanque')} Enchida em <b>${diaCurto(r.data)}</b>${r.operador ? ` por <b>${esc(r.operador)}</b>` : ''}${v.enche_inicio ? `, das ${esc(v.enche_inicio)}${v.enche_fim ? ` às ${esc(v.enche_fim)}` : ' (ainda enchendo)'}` : ''}. Brix inicial <b>${vazio(v.brix_inicial) ? 'não anotado' : esc(fmtNum(v.brix_inicial))}</b>.</p>`);
      const m = medicaoDaDorna(n, r);
      partes.push(m ? `<p>${ico('regua')} ${m.data === dataProducao() ? 'Hoje' : `Em ${diaCurto(m.data)}`}${m.hora ? `, ${esc(m.hora)}` : ''}: Brix <b>${vazio(m.brix) ? 'não anotado' : esc(fmtNum(m.brix))}</b> · <b>${m.volume == null ? 'volume não medido' : litros(m.volume, true)}</b>${m.ferm ? ` · Fermentando: <b>${esc(m.ferm)}</b>` : ''}</p>`
        : `<p class="apagado">${ico('regua')} Ainda não foi medida depois de encher. A medição da manhã é na folha Volume de vinho.</p>`);
      const vol = v.volante || [];
      if (vol.length) partes.push(`<p>${ico('enviar')} Volante: ${vol.map((s) => `${diaCurto(s.data)} das ${esc(s.inicio)}${s.fim ? ` às ${esc(s.fim)}` : ' até agora'}${s.operador ? ` (${esc(s.operador)})` : ''}`).join('; ')}</p>`);
    } else {
      const ult = r && r.valores.esvaziada;
      partes.push(`<p>${ico('tanque')} Dorna vazia.${ult ? ` Esvaziou em ${diaCurto(ult.data)} às ${esc(ult.hora)}.` : ''}${ehCentral() ? '' : ' Quando começar a encher, toque em Começar a encher.'}</p>`);
    }
    return `<section class="cartao-dorna etapa-${et.replace(' ', '-')}"><h3>Dorna Nº ${n} <em>${esc(NOME_ETAPA[et])}</em></h3>${partes.join('')}</section>`;
  }
  function folhaFermentacaoHtml(p, data, chave) {
    const linhas = fermentacaoDoDia(data);
    return `<div class="folha">${cabecalhoFolha(p, data)}<div class="tabela-wrap"><table class="papel">
      <thead><tr><th>Dorna</th><th>Enchida</th><th>Início</th><th>Fim</th><th>Brix inicial</th><th>Operador</th><th>Medição</th><th>Brix</th><th>Volume (L)</th><th>Fermentando</th><th>Volante no dia</th><th>Esvaziou</th></tr></thead>
      <tbody>${linhas.map((l) => {
        const m = l.medicao;
        return `<tr class="clicavel ${l.n === chave ? 'sel' : ''}" data-a="linha" data-chave="${l.n}"><td><b>${l.n}</b></td>
          ${l.ciclo ? `<td>${diaCurto(l.enchidaEm)}</td><td>${esc(l.inicio)}</td><td>${esc(l.fim) || '<span class="aberta">enchendo</span>'}</td><td>${esc(fmtNum(l.brixInicial))}</td><td>${esc(l.operador)}</td>
          <td>${m ? `${diaCurto(m.data)} ${esc(m.hora)}` : ''}</td><td>${m ? esc(fmtNum(m.brix)) : ''}</td><td>${m && m.volume != null ? esc(litros(m.volume).replace(' L', '')) : ''}</td><td>${m ? esc(m.ferm || '') : ''}</td>` : '<td colspan="9" class="dorna-vazia">vazia</td>'}
          <td>${esc(l.volante.map((s) => `${s.inicio}-${s.fim || '...'}${s.operador ? ' ' + s.operador : ''}`).join('; '))}</td>
          <td>${l.esvaziou ? `${diaCurto(l.esvaziou.data)} ${esc(l.esvaziou.hora)}` : ''}</td></tr>`;
      }).join('')}</tbody>
    </table></div></div>`;
  }

  function telaPrancheta(v) {
    aoAtualizarEdicao = null;
    const { p, data, chave } = prepararRascunho(v);
    const hoje = data === dataProducao();
    const hAgora = new Date().getHours();
    alvos = montarAlvos(p, chave);
    // a folha do dia (tabela do monitoramento) só é montada quando alguém abre o monitoramento
    let seletor = '', cabecalhoForm = '', folha = () => '', rotuloSalvar = '', grupos = p.grupos, etapa = '', antesDosQuadros = '';
    const origem = rascunho.novo && rascunho.origem ? `<span class="aviso">${esc(rascunho.origem)}</span>` : '';

    if (p.tipo === 'medicao') {
      const med = medicaoDoDia(data);
      const g = grupoDaMedicao(chave);
      contextoEdicao = chave === 'param' ? 'Brix da produção' : g ? g.nome : '';
      const chips = [...med.grupos.map((x) => ({ id: x.g.id, nome: x.g.nome, leg: x.medidas ? `${x.medidas} de ${x.g.dornas.length}` : '' })),
        { id: 'param', nome: 'Brix da produção', leg: pegar(data, v.pid, 'param') ? 'anotado' : '' }];
      seletor = `<div class="seletor">${chips.map((x) => `<button data-a="linha" data-chave="${x.id}" class="${x.id === chave ? 'sel' : x.leg ? 'feita' : ''}" ${x.id === chave ? 'data-rolar-para' : ''}>${esc(x.nome)}<small>${esc(x.leg)}</small></button>`).join('')}</div>`;
      const reg = pegar(data, v.pid, chave);
      cabecalhoForm = `${reg ? `<span class="aviso ok">${ico('certo')} Anotado por ${esc(reg.operador || 'sem nome')}</span>` : `<span class="aviso">${chave === 'param' ? 'Anote o Brix e o horário' : 'Digite a folga medida com a trena: o volume aparece na hora'}</span>`}
        <span class="aviso info" id="totais-medicao">${totaisMedicaoHtml(data, chave)}</span>`;
      aoAtualizarEdicao = () => { const el = document.getElementById('totais-medicao'); if (el) el.innerHTML = totaisMedicaoHtml(data, chave); };
      grupos = chave === 'param'
        ? [{ titulo: 'Ralo', campos: ['brix_ralo', 'hora_ralo'] }, { titulo: 'Hidrólise', campos: ['brix_hid', 'hora_hid'] }, { titulo: 'Fermentação', campos: ['brix_ferm', 'hora_ferm'] }]
        : [{ titulo: 'Hora da medição', campos: ['hora'] }, ...(g ? g.dornas : []).map((d) => ({ titulo: d.nome, campos: alvos.filter((a) => a.dornaId === d.id).map((a) => a.id) }))];
      rotuloSalvar = `Salvar ${contextoEdicao}`;
      folha = () => folhaMedicaoHtml(p, data, chave);
    } else if (p.tipo === 'fermentacao') {
      const r = cicloAtual(chave);
      etapa = etapaFerm(r);
      contextoEdicao = `dorna Nº ${chave}`;
      seletor = `<div class="seletor">${dornasDeFermentacao().map(({ n }) => {
        const et = etapaFerm(cicloAtual(n));
        return `<button data-a="linha" data-chave="${n}" class="${n === chave ? 'sel' : et === 'enchendo' || et === 'volante' ? 'atual' : et === 'vazia' ? '' : 'feita'}" ${n === chave ? 'data-rolar-para' : ''}>Nº ${n}<small>${esc(NOME_ETAPA[et])}</small></button>`;
      }).join('')}</div>`;
      const vol = naVolante();
      const status = {
        vazia: `<span class="aviso">Nº ${chave} vazia</span>`,
        enchendo: `<span class="aviso atencao">${ico('tanque')} Enchendo desde ${esc((r && r.valores.enche_inicio) || '')}${r && r.operador ? ` · ${esc(r.operador)}` : ''}</span>`,
        fermentando: `<span class="aviso ok">${ico('certo')} Fermentando</span>`,
        volante: `<span class="aviso info">${ico('enviar')} Mandando para a volante</span>`,
        'com vinho': `<span class="aviso ok">${ico('certo')} Com vinho (já mandou uma parte)</span>`,
      }[etapa];
      cabecalhoForm = `${status}<span class="aviso ${vol.length ? 'info' : ''}" id="volante-agora">Volante: ${vol.length ? esc(vol.map((s) => `Nº ${s.n} desde ${s.inicio}${s.operador ? ` (${s.operador})` : ''}`).join(', ')) : 'parada'}</span>
        ${etapa === 'com vinho' && anotaComoSetor(v.pid) ? `<button class="btn pequeno" data-a="ferm-esvaziou">${ico('certo')} Dorna vazia</button>` : ''}
        ${r && etapa !== 'vazia' ? `<button class="btn pequeno perigo" data-a="ferm-apagar">${ico('lixeira')} Apagar este enchimento</button>` : ''}`;
      grupos = [{ titulo: 'Enchimento', campos: ['enche_inicio', 'enche_fim'] }, { titulo: 'Brix', campos: ['brix_inicial'] }];
      rotuloSalvar = `Salvar dorna Nº ${chave}`;
      antesDosQuadros = cartaoDaDorna(chave, r);
      folha = () => folhaFermentacaoHtml(p, data, chave);
    } else if (p.tipo === 'dornas') {
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
      // versão 2.13: dia anterior e próximo; no tablet do setor, dia anterior é só para consultar
      const diaHoje = dataProducao();
      const navDia = `<div class="nav-data nav-monitor"><button class="btn" data-a="monitor-dia" data-n="-1" aria-label="Dia anterior">${ico('voltar')}</button>
        <div class="data-grande"><b>${fmtData(data).slice(0, 5)}</b><span>${data === diaHoje ? 'hoje' : diaSemana(data)}</span></div>
        <button class="btn" data-a="monitor-dia" data-n="1" aria-label="Próximo dia" ${data >= diaHoje ? 'disabled' : ''}>${ico('seta')}</button></div>`;
      return `${cabecalho(p.nome, subtituloTopo, false, atalhosOperador())}
        <div class="edicao"><div class="coluna"><div class="barra-trabalho"><div class="linha-monitor">${abasDoSetor(v)}${navDia}</div></div><main>
          <p class="sub" style="margin:2px 0 10px">${hoje || ehCentral() ? 'Toque em uma linha para abrir e corrigir.' : `Folha de ${fmtData(data)}: só para consultar.`}</p>
          ${folha()}</main>
        <div class="rodape"><button class="btn primario" data-a="monitor">${ico('voltar')} Voltar para anotar</button></div></div></div>`;
    }

    const fixoTopo = `${abasDoSetor(v)}${seletor}${cabecalhoForm ? `<div class="cabecalho-form">${cabecalhoForm}</div>` : ''}`;
    let quadros = blocosDeQuadros(grupos, alvos);
    // medição: cada dorna tem folga, Brix e fermentando lado a lado, então o bloco precisa de mais largura
    if (p.tipo === 'medicao') quadros = quadros.replace('<div class="grupos">', '<div class="grupos grupos-largos">');
    const conteudo = antesDosQuadros + quadros;
    lembrar[`${data}|${v.pid}`] = chave;
    let rodape = `<button class="btn primario" data-a="salvar">${ico('certo')} ${esc(rotuloSalvar)}</button>`;
    if (p.tipo === 'fermentacao' && anotaComoSetor(v.pid)) {
      const [acao, icone, texto] = {
        vazia: ['ferm-encher', 'tanque', `Começar a encher Nº ${chave}`], enchendo: ['ferm-terminou', 'fim', 'Terminou de encher'],
        fermentando: ['ferm-volante', 'enviar', 'Mandar para a volante'], 'com vinho': ['ferm-volante', 'enviar', 'Mandar para a volante'], volante: ['ferm-parar', 'fim', 'Parou de mandar'],
      }[etapa];
      rodape = `<button class="btn" data-a="salvar">${ico('certo')} Salvar</button><button class="btn primario" data-a="${acao}">${ico(icone)} ${esc(texto)}</button>`;
    }
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
    // folhas só do tablet chefe (Vinho e Fermentação): quem anota é o escritório; a mudança fica no registro
    if (!ehCentral() || !rascunho || v.tela !== 'prancheta' || soDoChefe(v.pid)) return [];
    const p = prancheta(v.pid);
    const { data, chave } = rascunho;
    const mudou = (a, b) => JSON.stringify(a == null ? '' : a) !== JSON.stringify(b == null ? '' : b);
    const nomes = new Set();
    if (p.tipo === 'fermentacao') {
      const existente = rascunho.ciclo ? pegar(rascunho.ciclo.data, PID_FERMENTACAO, rascunho.ciclo.chave) : null;
      if (existente && existente.operador && p.campos.some((c) => mudou(rascunho.valores[c.id], rascunho.original[c.id]))) nomes.add(existente.operador);
    } else if (p.tipo === 'juntas') {
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
    return [...nomes].filter((n) => n && !ehDoChefe(n));
  }
  /** Pede a senha de cada operador (ou do encarregado). Resolve true se todas estão certas. */
  async function autorizar(nomes) {
    const setor = setorDaPrancheta(view().pid);
    for (const nome of nomes) {
      const op = setor ? operadorPorNome(setor.id, nome) : null;
      const comSenha = !!(op && op.senha);
      if (!comSenha && pode('corrigir')) continue; // operador sem senha: quem entrou no tablet chefe autoriza (fica no registro)
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
    // folha que só o tablet chefe anota (Vinho e Fermentação): vai o nome do tablet chefe
    const quem = ehCentral() ? (soDoChefe(v.pid) ? (pessoaAtual() || {}).nome || nomeDoChefe() : '') : operadorAtual() || (automatico ? rascunho.operador : null);
    if (!ehCentral() && !quem) { if (!automatico) exigeOperador(); return false; }
    // tablet chefe mudando o que um operador anotou: só com a senha dele (salvar sozinho, ao sair da tela, não vale)
    const precisaAutorizar = ehCentral() ? quemPrecisaAutorizar() : [];
    if (precisaAutorizar.length && !opcoes.autorizado) {
      toast(`A alteração não foi salva: para mudar o que ${listaE(precisaAutorizar)} anotou, toque em Salvar e digite a senha.`, 'erro');
      return false;
    }
    const marcaAlteracao = precisaAutorizar.length ? { alteradoPeloEscritorio: { em: Date.now(), autorizadoPor: precisaAutorizar, por: (pessoaAtual() || {}).nome || '' } } : {};
    const novoAntes = !!rascunho.novo;
    const p = prancheta(v.pid);
    const data = rascunho.data;
    const chave = rascunho.chave;

    if (p.tipo === 'medicao') {
      const existente = pegar(data, v.pid, chave);
      const g = grupoDaMedicao(chave);
      // o volume vai junto (se a medida da dorna mudar depois, o que já foi medido continua igual)
      if (g) g.dornas.forEach((d) => { const vol = volumeDe(d, rascunho.valores[d.id + '_folga'], g); rascunho.valores[d.id + '_vol'] = vol == null ? '' : vol.toFixed(emM3(g) ? 3 : 2); });
      const temAlgo = Object.entries(rascunho.valores).some(([k, x]) => k !== 'hora' && !/_vol$/.test(k) && !vazio(x));
      // no tablet chefe vale o nome de quem anotou antes; folha só do chefe (Vinho e Fermentação) leva o nome do tablet chefe
      const operador = ehCentral() ? (existente && existente.operador) || quem || '' : (existente && existente.operador) || quem;
      if (temAlgo) gravar(data, v.pid, chave, rascunho.valores, Object.assign({ operador }, marcaAlteracao));
      else if (existente) apagar(data, v.pid, chave);
      else if (!automatico) { toast(chave === 'param' ? 'Anote pelo menos um Brix antes de salvar' : 'Anote pelo menos uma folga antes de salvar', 'erro'); return false; }
      if (!opcoes.silencioso && (temAlgo || existente)) toast(`${chave === 'param' ? 'Brix da produção' : g.nome} salvo`);
    } else if (p.tipo === 'fermentacao') {
      const val = {}; p.campos.forEach((c) => { val[c.id] = rascunho.valores[c.id] || ''; });
      const temAlgo = Object.values(val).some((x) => !vazio(x));
      const existente = rascunho.ciclo ? pegar(rascunho.ciclo.data, PID_FERMENTACAO, rascunho.ciclo.chave) : null;
      if (existente) mudarCiclo(existente, val, Object.assign({ operador: existente.operador || quem || '' }, marcaAlteracao));
      else if (temAlgo) { const novo = novoCiclo(chave, val, quem || ''); rascunho.ciclo = { data: novo.data, chave: novo.chave }; }
      else if (!automatico) { toast('Anote pelo menos um quadro antes de salvar', 'erro'); return false; }
      if (!opcoes.silencioso && (existente || temAlgo)) toast(`Dorna Nº ${chave} salva`);
    } else if (p.tipo === 'juntas') {
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
    const mudou = mudancasDoRascunho();
    if (mudou.length) {
      const linha = p.tipo === 'medicao' ? ((grupoDaMedicao(chave) || {}).nome || 'Brix da produção') : p.tipo === 'fermentacao' || p.tipo === 'dornas' ? `Nº ${chave}` : `das ${rotuloHoraPapel(chave)}`;
      const todosVazios = mudou.every((m) => m.antes === '(vazio)');
      registrar('anotacao', `${quemEstaAqui()} ${novoAntes || todosVazios ? 'anotou' : 'mudou'} ${p.nome} ${linha}${precisaAutorizar.length ? ` (o que ${listaE(precisaAutorizar)} tinha anotado)` : ''}`, mudou);
    }
    rascunho.original = JSON.parse(JSON.stringify(rascunho.valores));
    rascunho.originalExtras = JSON.stringify(rascunho.extras);
    rascunho.fonte = fonteDaFolha(p, v.pid, data, chave); // o que acabou de salvar não conta como anotação de fora
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
    const p = pessoaAtual();
    return `<button class="atalho pessoa-chefe ${p ? '' : 'alerta'}" data-a="pessoa" aria-label="${p ? `${esc(p.nome)}: toque para sair` : 'Entrar com a sua senha'}">${ico('pessoa')}<span>${esc(p ? p.nome : 'Entrar')}</span></button>
      <button class="atalho" data-a="avisos" aria-label="Avisos${abertos ? `, ${abertos} esperando` : ''}">${ico('sino')}<span>Avisos</span>${abertos ? `<em class="contador">${abertos}</em>` : ''}</button>
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
            <button class="numero-botao" data-a="aparelhos"><b>${cfg.demo && !st ? '-' : ligados}</b><span>aparelhos ligados</span></button>
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
              const aparelho = cfg.demo ? '' : disp ? (disp.bloqueio ? 'Bloqueado' : disp.online ? `Ligado${disp.operador ? `, ${disp.operador}` : ''}` : situacaoDoAparelho(disp)) : 'Tablet não conectado';
              const sinal = cfg.demo ? '' : disp && disp.online ? 'ok' : disp ? 'off' : '';
              return `<button class="setor-cartao ${pends.length ? 'pendente' : andando.length ? 'andamento' : regs.length ? 'feito' : ''}" data-a="abrir-setor" data-id="${s.id}">
                <span class="desenho">${ico(s.icone)}</span>
                <span class="texto"><b>${esc(s.nome)}</b>${aparelho ? `<span class="conexao ${sinal}"><i></i>${esc(aparelho)}</span>` : ''}
                <span class="situacao">${esc(situacao)}</span></span><span class="seta">${ico('seta')}</span></button>`;
            }).join('')}</div>
            ${htmlGraficosDoPainel(data)}
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
  /* =========================================================
   * Escritório (versão 2.13): cálculos da produção, rastreamento de lotes (POP 03 - FOR 011) e etiqueta das bombonas.
   * É um aparelho à parte (papel 'escritorio'). Entra quem tem a função Escritório, com a senha conferida na central;
   * depois de 10 minutos sem mexer pede a senha de novo (a central também só aceita a folha dentro desses 10 minutos).
   * Os números vêm das anotações dos setores (rastreamento.js); o que for digitado aqui vale por cima.
   * ========================================================= */
  const PID_RASTREIO = 'rastreamento';
  const MINUTOS_ESCRITORIO = 10;
  const escritorioAberto = () => cfg.demo || !!(cfg.escritorio && Date.now() < cfg.escritorio.ate);
  const diaFechado = () => somarDias(dataProducao(), -1);
  const numBr = (n) => (n === '' || n == null || !Number.isFinite(Number(n)) ? '' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(Number(n)) >= 1000 ? 1 : 2 }));
  const pegarCaminho = (o, c) => c.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
  const dataBr = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? fmtData(d) : d || '');
  function renovarEscritorio() { if (cfg.escritorio) { cfg.escritorio.ate = Date.now() + MINUTOS_ESCRITORIO * 60000; salvarCfg(); } }
  async function entrarNoEscritorio() {
    const pin = await pedirSenhaModal('Senha do Escritório', 'Quem tem a função Escritório (cálculos, rastreamento de lotes e etiqueta).');
    if (pin === undefined) return false;
    let nome = 'Demonstração';
    if (!cfg.demo) {
      const r = await postJson('api/pessoas', { acao: 'verificar', pin }, 6000).catch(() => null);
      if (!r) { toast('Sem a central: o Escritório precisa dela para conferir a senha', 'erro'); return false; }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.erro || 'Senha errada', 'erro'); return false; }
      const funcoes = Array.isArray(d.funcoes) ? new Set(d.funcoes) : funcoesDe(d.pessoa);
      if (!funcoes.has('escritorio')) { toast(`${d.pessoa.nome} não tem a função Escritório`, 'erro'); return false; }
      nome = d.pessoa.nome;
    }
    cfg.escritorio = { nome, ate: Date.now() + MINUTOS_ESCRITORIO * 60000, conferidoEm: Date.now() }; salvarCfg();
    registrar('entrada', `${nome} entrou no Escritório`);
    // o que a central não aceitou por falta da senha vai de novo
    let guardadas = 0;
    Object.values(registros).forEach((r) => { if (r.esperaEntrar) { delete r.esperaEntrar; guardadas += 1; } });
    if (guardadas) { salvarRegistros(); sincronizarLogo(); }
    return true;
  }
  /** Antes de salvar: a central só aceita a folha até 10 minutos depois da senha (renovados a cada folha salva). */
  async function garantirEscritorio() {
    if (cfg.demo) return true;
    if (cfg.escritorio && Date.now() - (cfg.escritorio.conferidoEm || 0) < 8 * 60000) return true;
    return entrarNoEscritorio();
  }
  /** As anotações de um dia de produção (de todos os setores) que este aparelho tem. */
  const anotacoesDoDia = (dia) => Object.values(registros).filter((r) => r.data === dia && !r.apagado);
  const rastreioGuardado = (dia) => pegar(dia, PID_RASTREIO, 'dia');
  /** O que aparece na tela: o que foi salvo, ou a conta feita agora com as anotações. Listas com linhas para digitar. */
  function valoresDoDia(dia) {
    const salvo = rastreioGuardado(dia);
    return prepararValores(salvo ? copia(salvo.valores) : window.Rastreamento.calcular(C, dia, anotacoesDoDia(dia)));
  }
  function prepararValores(v) {
    v.origem = v.origem || {};
    while (v.mp.length < 3) v.mp.push({ produto: '', kg: '', fornecedor: '', nf: '' });
    while (v.lenha.length < 2) v.lenha.push({ tipo: '', m3: '', fornecedor: '' });
    if (Array.isArray(v.operadores)) v.operadores = v.operadores.join(' - ');
    return v;
  }
  const valoresDaTela = (v) => v.valores || (v.valores = valoresDoDia(v.data));
  function navDiaEscritorio(dia) {
    return `<div class="nav-data"><button class="btn" data-a="esc-dia" data-n="-1" aria-label="Dia anterior">${ico('voltar')}</button>
      <div class="data-grande"><b>${fmtData(somarDias(dia, 1))}</b><span>fechou às 07:00 · produção desde ${fmtData(dia).slice(0, 5)} 07:00</span></div>
      <button class="btn" data-a="esc-dia" data-n="1" aria-label="Próximo dia" ${dia >= dataProducao() ? 'disabled' : ''}>${ico('seta')}</button></div>`;
  }
  function telaEscritorio(v) {
    if (!escritorioAberto()) {
      return `${cabecalho('Escritório', 'Cálculos, rastreamento de lotes e etiqueta', false)}
        <main><div class="tela-aviso"><div class="grande-ico">${ico('cadeado')}</div><h1>Escritório</h1>
          <p>Entre com a sua senha. Só quem tem a função Escritório usa esta parte.</p>
          <div class="linha-botoes"><button class="btn primario" data-a="esc-entrar">${ico('cadeado')} Entrar com a senha</button></div></div></main>`;
    }
    const dia = v.data;
    const salvo = rastreioGuardado(dia);
    const lote = window.Rastreamento.lote(C, somarDias(dia, 1));
    const quando = salvo && salvo.valores.salvoEm ? new Date(salvo.valores.salvoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    return `${cabecalho('Escritório', cfg.escritorio ? `${cfg.escritorio.nome} · cálculos, rastreamento e etiqueta` : 'Cálculos, rastreamento e etiqueta', false, `<button class="atalho" data-a="esc-sair">${ico('cadeado')}<span>Sair</span></button>`)}
      <main class="escritorio">
        <div class="barra-dia">${navDiaEscritorio(dia)}<div class="lote-dia"><small>Lote do dia</small><b>${esc(lote)}</b></div></div>
        <div class="papeis">
          <button class="papel-cartao" data-a="esc-abrir" data-t="esc-calculos"><span class="escolha-ico">${ico('grafico')}</span><b>Cálculos da produção</b><small>Matéria-prima, hidrolisado, vinho, álcool e vinhaça</small></button>
          <button class="papel-cartao" data-a="esc-abrir" data-t="esc-rastreamento"><span class="escolha-ico">${ico('documento')}</span><b>Rastreamento de lotes e etiqueta</b><small>Folha POP 03 - FOR 011 e o adesivo das bombonas</small></button>
        </div>
        <p class="sub">${salvo ? `Salvo por ${esc(salvo.valores.salvoPor || '')}${quando ? ` em ${quando}` : ''}. Os números ficam como foram salvos.` : 'Ainda não foi salvo: os números vêm das anotações dos setores e mudam se alguém corrigir uma folha.'}</p>
      </main>`;
  }
  /** Uma linha de número: nome, de onde veio e o botão de mudar. */
  function linhaEsc(x, c, rotulo, unidade, resultado) {
    const val = pegarCaminho(x, c);
    const origem = x.origem[c] || (val === '' || val == null ? 'falta' : '');
    return `<div class="linha-config linha-esc ${resultado ? 'resultado' : ''}"><div><b>${esc(rotulo)}</b><small class="${origem === 'falta' ? 'falta' : ''}">${esc(origem).replace(/-/g, '‑')}</small></div>
      <span class="num-esc">${val === '' || val == null ? '—' : esc(numBr(val))}${unidade && val !== '' ? ` <small>${esc(unidade)}</small>` : ''}</span>
      <button class="btn pequeno" data-a="esc-campo" data-c="${c}" data-r="${esc(rotulo)}">Mudar</button></div>`;
  }
  const atalhosEsc = (v, extra = '') => `<button class="atalho ${v.sujo ? 'destaque' : ''}" data-a="esc-salvar">${ico('certo')}<span>Salvar</span></button>${extra}`;
  function telaEscCalculos(v) {
    const x = valoresDaTela(v);
    return `${cabecalho('Cálculos da produção', `Lote ${x.lote} · ${fmtData(x.fechamento)} 07:00`, true, atalhosEsc(v))}
      <main class="escritorio">
        <section class="bloco"><h2>${ico('tanque')} Hidrolisado e vinho</h2>
          <p class="sub">Conta do Lucas: hidrolisado = matéria‑prima ÷ fator; vinho = hidrolisado × Brix inicial ÷ Brix final.</p>
          ${linhaEsc(x, 'calculo.mpKg', 'Matéria‑prima do dia', 'kg')}${linhaEsc(x, 'calculo.fator', 'Fator da matéria‑prima', '')}
          ${linhaEsc(x, 'calculo.brixInicial', 'Brix inicial (Hidrólise)', '°Bx')}${linhaEsc(x, 'calculo.brixFinal', 'Brix final (diluído)', '°Bx')}
          ${linhaEsc(x, 'pi.hidrolise', 'Produção de hidrólise', 'L', true)}${linhaEsc(x, 'pi.vinho', 'Produção de vinho', 'L', true)}</section>
        <section class="bloco"><h2>${ico('coluna')} Álcool e vinhaça</h2>
          <p class="sub">Vinhaça = volume destilado − produção de álcool.</p>
          ${linhaEsc(x, 'calculo.alcoolDestilaria', 'Álcool da Destilaria', 'L')}${linhaEsc(x, 'calculo.alcoolNova', 'Álcool da Nova Destilaria', 'L')}
          ${linhaEsc(x, 'alcool.producao', 'Produção de álcool', 'L', true)}${linhaEsc(x, 'volumeDestilado', 'Volume destilado', 'L')}
          ${linhaEsc(x, 'vinhaca.producao', 'Produção de vinhaça', 'L', true)}</section>
        <div class="linha-botoes"><button class="btn" data-a="esc-recalcular">${ico('relogio')} Refazer com as anotações de agora</button>
          <button class="btn primario" data-a="esc-salvar">${ico('certo')} Salvar</button></div>
      </main>`;
  }
  /** Célula da folha: mostra o valor e abre para mudar. */
  function celEsc(x, c, rotulo, num) {
    const val = pegarCaminho(x, c);
    const txt = val === '' || val == null ? '' : num ? numBr(val) : /validade$/.test(c) ? dataBr(val) : String(val);
    return `<button class="cel-esc ${txt ? '' : 'vazia'} ${(x.origem[c] || '').startsWith('digitado') ? 'digitada' : ''}" data-a="esc-campo" data-c="${c}" data-r="${esc(rotulo)}">${esc(txt) || '—'}</button>`;
  }
  function telaEscRastreamento(v) {
    const x = valoresDaTela(v);
    const R = C.rastreamento;
    const par = (lista, grupo, titulo) => `<table class="tabela-esc"><thead><tr><th>${esc(titulo)}</th><th>Faixa</th><th>Resultado</th></tr></thead><tbody>
      ${lista.map(([id, nome, faixa]) => `<tr><td>${esc(nome)}</td><td>${esc(faixa)}</td><td>${celEsc(x, `${grupo}.${id}`, nome, true)}</td></tr>`).join('')}</tbody></table>`;
    const tanques = R.tanques.map((g) => `<h3>${esc(g.titulo)}</h3><div class="tabela-wrap"><table class="tabela-esc"><thead><tr><th>Resultado</th>${g.lista.map(([, nome]) => `<th>${esc(nome)}</th>`).join('')}</tr></thead><tbody>
      ${[['brix', 'BRIX'], ['ph', 'PH'], ['folga', 'FOLGA']].map(([k, t]) => `<tr><td>${t}</td>${g.lista.map(([id, nome]) => `<td>${celEsc(x, `tanques.${id}.${k}`, `${t} ${nome}`, true)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('');
    const insumos = (lista, titulo) => `<h3>${esc(titulo)}</h3><div class="tabela-wrap"><table class="tabela-esc"><thead><tr><th>Insumo</th><th>KGS/LTS</th><th>Lote</th><th>Validade</th><th>Nº NF</th><th>Fornecedor</th></tr></thead><tbody>
      ${lista.map(([id, nome]) => { const i = x.insumos[id] || {}; return `<tr><td>${esc(nome)}${i.unidade ? ` <small>${esc(i.unidade)}</small>` : ''}</td><td>${celEsc(x, `insumos.${id}.qtd`, nome, true)}</td>
        ${['lote', 'validade', 'nf', 'fornecedor'].map((k) => `<td>${celEsc(x, `insumos.${id}.${k}`, `${nome}: ${k}`)}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>`;
    return `${cabecalho('Rastreamento', `POP 03 - FOR 011 · lote ${x.lote}`, true, atalhosEsc(v))}
      <main class="escritorio">
        <section class="bloco"><h2>Produtos do dia</h2>
          <p class="sub">Início 07:00 de ${fmtData(v.data)} · final 07:00 de ${fmtData(x.fechamento)}. Toque num número para mudar.</p>
          <div class="tabela-wrap"><table class="tabela-esc"><thead><tr><th>Produto</th><th>Produção (L)</th><th>Nº do lote</th><th>Validade</th></tr></thead><tbody>
            <tr><td>ÁLCOOL-PA</td><td>${celEsc(x, 'alcool.producao', 'Produção de álcool', true)}</td><td>${celEsc(x, 'alcool.lote', 'Lote do álcool')}</td><td>${celEsc(x, 'alcool.validade', 'Validade do álcool')}</td></tr>
            <tr><td>VINHAÇA</td><td>${celEsc(x, 'vinhaca.producao', 'Produção de vinhaça', true)}</td><td>${celEsc(x, 'vinhaca.lote', 'Lote da vinhaça')}</td><td>${celEsc(x, 'vinhaca.validade', 'Validade da vinhaça')}</td></tr>
            <tr><td>VOLUME DESTILADO</td><td>${celEsc(x, 'volumeDestilado', 'Volume destilado', true)}</td><td></td><td></td></tr>
            <tr><td>(PI) HIDRÓLISE</td><td>${celEsc(x, 'pi.hidrolise', 'Produção de hidrólise', true)}</td><td colspan="2"><small>matéria-prima ÷ ${esc(numBr(x.calculo.fator))}</small></td></tr>
            <tr><td>(PI) VINHO</td><td>${celEsc(x, 'pi.vinho', 'Produção de vinho', true)}</td><td colspan="2"><small>× Brix inicial ÷ Brix final</small></td></tr>
          </tbody></table></div></section>
        <section class="bloco"><h2>Parâmetros</h2><div class="duas-tabelas">${par(R.parametros.hidrolise, 'hidrolise', 'Hidrólise')}${par(R.parametros.alcool, 'alcoolParam', 'Produção de álcool')}</div></section>
        <section class="bloco"><h2>Tanques</h2>${tanques}</section>
        <section class="bloco"><h2>Insumos utilizados</h2>${insumos(R.insumos, 'Insumos')}${insumos(R.tratamentoAgua, 'Tratamento de água')}${insumos(R.higienizacao, 'Higienização de equipamentos')}</section>
        <section class="bloco"><h2>Matéria-prima e lenha</h2>
          <div class="tabela-wrap"><table class="tabela-esc"><thead><tr><th>Moagem de matéria-prima</th><th>kg</th><th>Fornecedor</th><th>Nº NF</th></tr></thead><tbody>
            ${x.mp.map((m, i) => `<tr><td>${celEsc(x, `mp.${i}.produto`, 'Produto')}</td><td>${celEsc(x, `mp.${i}.kg`, 'Matéria-prima (kg)', true)}</td><td>${celEsc(x, `mp.${i}.fornecedor`, 'Fornecedor')}</td><td>${celEsc(x, `mp.${i}.nf`, 'Nº NF')}</td></tr>`).join('')}</tbody></table></div>
          <div class="tabela-wrap"><table class="tabela-esc"><thead><tr><th>Tipo de lenha</th><th>m³</th><th>Fornecedor</th></tr></thead><tbody>
            ${x.lenha.map((l, i) => `<tr><td>${celEsc(x, `lenha.${i}.tipo`, 'Tipo de lenha')}</td><td>${celEsc(x, `lenha.${i}.m3`, 'Lenha (m³)', true)}</td><td>${celEsc(x, `lenha.${i}.fornecedor`, 'Fornecedor da lenha')}</td></tr>`).join('')}</tbody></table></div></section>
        <section class="bloco"><h2>Operadores e encarregado</h2>
          <div class="linha-config"><div><b>Operadores</b><small>${esc(x.operadores || '—')}</small></div><button class="btn pequeno" data-a="esc-campo" data-c="operadores" data-r="Operadores">Mudar</button></div>
          <div class="linha-config"><div><b>Encarregado</b><small>${esc(x.encarregado || '—')}</small></div><button class="btn pequeno" data-a="esc-campo" data-c="encarregado" data-r="Encarregado">Mudar</button></div>
          <p class="sub">${esc(R.aviso)}</p></section>
        <div class="linha-botoes"><button class="btn" data-a="esc-recalcular">${ico('relogio')} Refazer com as anotações de agora</button>
          <button class="btn" data-a="esc-arquivo">${ico('enviar')} Enviar (PDF, Excel ou XML)</button>
          <button class="btn" data-a="esc-folha">${ico('imprimir')} Imprimir a folha</button>
          <button class="btn" data-a="esc-etiqueta">${ico('documento')} Etiqueta das bombonas</button>
          <button class="btn primario" data-a="esc-salvar">${ico('certo')} Salvar</button></div>
      </main>`;
  }
  /** Muda um campo: número com vírgula, data no calendário, ou texto. */
  async function mudarCampoEsc(v, c, rotulo) {
    const x = valoresDaTela(v);
    const atual = pegarCaminho(x, c);
    const numero = /^(volumeDestilado|calculo\.[^.]+|pi\.[^.]+|(?:alcool|vinhaca)\.producao|hidrolise\.[^.]+|alcoolParam\.[^.]+|tanques\.[^.]+\.[^.]+|insumos\.[^.]+\.qtd|mp\.\d+\.kg|lenha\.\d+\.m3)$/.test(c);
    const data = /^(alcool|vinhaca)\.validade$/.test(c);
    const txt = await textoLivre({ titulo: rotulo, dica: numero ? 'Use vírgula para as casas (ex.: 95,5). Vazio apaga.' : data ? 'Escolha a data.' : '', valor: atual === '' || atual == null ? '' : numero ? String(atual).replace('.', ',') : String(atual), tipo: data ? 'date' : 'text', decimal: numero, max: 120 });
    if (txt === undefined) return;
    if (numero && txt !== '' && !Number.isFinite(Number(txt.replace(/\./g, '').replace(',', '.')))) return toast('Número inválido', 'erro');
    const valor = numero && txt !== '' ? txt.replace(/\./g, '').replace(',', '.') : txt;
    if (c === 'operadores' || c === 'encarregado') { x[c] = valor; x.origem[c] = 'digitado no Escritório'; }
    else window.Rastreamento.recalcular(x, { campo: c, valor });
    v.sujo = true; renovarEscritorio(); render();
  }
  async function salvarEsc(v) {
    if (!(await garantirEscritorio())) return false;
    const x = copia(valoresDaTela(v));
    if (typeof x.operadores === 'string') x.operadores = x.operadores.split(/\s*-\s*|\s*,\s*/).filter(Boolean);
    x.salvoPor = cfg.escritorio ? cfg.escritorio.nome : ''; x.salvoEm = Date.now();
    gravar(v.data, PID_RASTREIO, 'dia', x, { operador: x.salvoPor });
    registrar('anotacao', `${x.salvoPor} salvou o rastreamento de lotes de ${fmtData(x.fechamento)} (lote ${x.lote})`);
    if (cfg.escritorio) cfg.escritorio.conferidoEm = Date.now(); // a central renova os 10 minutos a cada folha aceita
    v.sujo = false; v.valores = null; renovarEscritorio();
    toast(`Rastreamento salvo: lote ${x.lote}`, 'ok');
    render();
    return true;
  }
  /** Folha igual ao papel: imprime ou monta o arquivo com o que está salvo (salva antes, se mudou). */
  async function arquivoEsc(v, formato) {
    if ((v.sujo || !rastreioGuardado(v.data)) && !(await salvarEsc(v))) return null;
    const nome = `Rastreamento_${somarDias(v.data, 1)}`;
    if (formato === 'xml') return new File([gerarXml(v.data, [PID_RASTREIO])], nome + '.xml', { type: MIME.xml });
    if (formato === 'pdf') { const pecas = await pecasPdf(); return new File([window.criarPdf([papel().folha(PID_RASTREIO, v.data)], Object.assign({ fmtNum, titulo: nome }, pecas))], nome + '.pdf', { type: MIME.pdf }); }
    return new File([window.criarXlsx([planilhaDaPrancheta(PID_RASTREIO, v.data)], LOGO_PNG)], nome + '.xlsx', { type: MIME.xlsx });
  }
  async function enviarRastreamento(v) {
    const formato = await abrirModal(`<h3>Rastreamento de ${fmtData(somarDias(v.data, 1))}</h3><p class="dica">Qual arquivo?</p>
      <div class="escolhas"><button data-k="pdf"><span class="escolha-ico">${ico('documento')}</span><b>PDF</b><small>Igual ao papel</small></button>
        <button data-k="xlsx"><span class="escolha-ico">${ico('planilha')}</span><b>Excel</b><small>Igual ao papel</small></button>
        <button data-k="xml"><span class="escolha-ico">${ico('codigo')}</span><b>XML</b><small>Para outro sistema</small></button></div>
      <div class="acoes-modal um"><button class="btn" data-k="x">Cancelar</button></div>`, (k, b, fechar) => fechar(k === 'x' ? undefined : k));
    if (!formato) return;
    const arquivo = await arquivoEsc(v, formato).catch(() => null);
    if (!arquivo) return;
    const destino = await abrirModal(`<h3>${esc(arquivo.name)}</h3><p class="dica">Para onde?</p>
      <div class="escolhas"><button data-k="escritorio"><span class="escolha-ico">${ico('enviar')}</span><b>Escritório</b><small>WhatsApp ou e-mail cadastrado</small></button>
        <button data-k="whatsapp"><span class="escolha-ico">${ico('whatsapp')}</span><b>WhatsApp</b><small>Escolher a conversa</small></button>
        <button data-k="email"><span class="escolha-ico">${ico('email')}</span><b>E-mail</b><small>Com o arquivo anexado</small></button>
        <button data-k="outros"><span class="escolha-ico">${ico('compartilhar')}</span><b>Outros apps</b><small>Drive, Bluetooth e outros</small></button>
        <button data-k="baixar"><span class="escolha-ico">${ico('pasta')}</span><b>Guardar</b><small>Neste aparelho</small></button></div>
      <div class="acoes-modal um"><button class="btn" data-k="x">Cancelar</button></div>`, (k, b, fechar) => fechar(k === 'x' ? undefined : k));
    if (destino) compartilhar(destino, somarDias(v.data, 1), arquivo);
  }
  async function imprimirFolhaEsc(v) {
    if ((v.sujo || !rastreioGuardado(v.data)) && !(await salvarEsc(v))) return;
    imprimirHtml(window.ModelosPapel.paraHtml(papel().folha(PID_RASTREIO, v.data), 'icons/logo.png', fmtNum), `Rastreamento ${fmtData(somarDias(v.data, 1))}`);
  }

  /* ---------- Etiqueta das bombonas (igual ao adesivo de 01/10/2026) ---------- */
  const PICTO_CHAMA = '<path d="M12 3c1.4 3 4.6 4.6 4.6 8.6a4.6 4.6 0 0 1-9.2 0c0-1.9 1-3.2 2-4.3.2 1.6 1.1 2.6 2.2 3C11.5 8.2 11 5.6 12 3z" fill="#000"/><rect x="6" y="17.6" width="12" height="1.6" fill="#000"/>';
  const pictograma = (miolo) => `<svg class="picto" viewBox="0 0 24 24"><path d="M12 .8L23.2 12 12 23.2.8 12z" fill="#fff" stroke="#d00" stroke-width="1.6"/><g transform="translate(5.4 5.2) scale(.55)">${miolo}</g></svg>`;
  const PICTO_EXCLAMA = '<rect x="10.4" y="3" width="3.2" height="11" rx="1" fill="#000"/><circle cx="12" cy="18.2" r="1.9" fill="#000"/>';
  function etiquetaHtml(x, volume) {
    const e = C.rastreamento.etiqueta;
    const p = window.Rastreamento.etiqueta(C, volume);
    const kg = (n) => (n === '' ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    return `<div class="etiqueta">
      <div class="et-esq">
        <div class="et-marca"><img src="icons/logo.png" alt=""><div><b>UBIRÁLCOOL</b><small>ÁLCOOL DE CEREAIS</small></div></div>
        <div class="et-pictos">${pictograma(PICTO_CHAMA)}${pictograma(PICTO_EXCLAMA)}</div>
        <p class="et-prec"><b>Frases de precaução:</b> ${esc(e.precaucao)}</p>
        <p class="et-ficha">${esc(e.ficha)}</p>
        <div class="et-peso"><b>VOLUME: ${esc(numBr(p.volume))} lts</b><b>PESO LÍQUIDO: ${kg(p.pesoLiquido)} kgs</b><b>PESO BRUTO: ${kg(p.pesoBruto)} kgs</b><b>VALIDADE: ${esc(String(C.rastreamento.validadeAlcoolMeses))} meses</b></div>
      </div>
      <div class="et-meio">
        <p class="et-empresa"><b>${esc(e.empresa)}</b><br>${esc(e.endereco)}<br>Telefone: ${esc(e.telefone)} - <b>Emergências: ${esc(e.emergencia)}</b></p>
        <p class="et-produto">${esc(e.produto)}</p>
        <div class="et-onu">ONU ${esc(e.onu)}</div>
        <p class="et-dados"><b>Nome apropriado para embarque:</b> ${esc(e.nomeEmbarque)}<br><b>Classe ou subclasse de risco:</b> ${esc(e.classeRisco)}<br><b>Grupo de embalagem:</b> ${esc(e.grupoEmbalagem)}<br><b>Número de risco:</b> ${esc(e.numeroRisco)}</p>
        <div class="et-lote"><b>LOTE: ${esc(x.lote)}</b><small>DATA FABRICAÇÃO: ${esc(dataBr(x.fechamento))}</small><small>VALIDADE: ${esc(dataBr(x.alcool.validade))}</small></div>
      </div>
      <div class="et-dir">
        <p><b>Composição Química:</b> ${esc(e.composicao)}<br><b>Responsável técnico:</b> ${esc(e.responsavel)}<br>${esc(e.registro)}</p>
        <p class="et-perigo">PERIGO</p><p>${esc(e.perigo)}</p>
        <svg class="et-placa" viewBox="0 0 100 100"><path d="M50 2L98 50 50 98 2 50z" fill="#d22" stroke="#fff" stroke-width="2"/><path d="M50 8L92 50 50 92 8 50z" fill="none" stroke="#fff" stroke-width="1.5"/>
          <g transform="translate(36 14) scale(1.15)"><path d="M12 3c1.4 3 4.6 4.6 4.6 8.6a4.6 4.6 0 0 1-9.2 0c0-1.9 1-3.2 2-4.3.2 1.6 1.1 2.6 2.2 3C11.5 8.2 11 5.6 12 3z" fill="#fff"/></g>
          <text x="50" y="57" text-anchor="middle" font-size="7.5" font-weight="700" fill="#fff" font-family="Arial">LÍQUIDO</text><text x="50" y="66" text-anchor="middle" font-size="7.5" font-weight="700" fill="#fff" font-family="Arial">INFLAMÁVEL</text>
          <text x="50" y="86" text-anchor="middle" font-size="13" font-weight="700" fill="#fff" font-family="Arial">3</text></svg>
      </div></div>`;
  }
  async function etiquetaEsc(v) {
    if ((v.sujo || !rastreioGuardado(v.data)) && !(await salvarEsc(v))) return;
    const x = valoresDoDia(v.data);
    const volumes = C.rastreamento.etiqueta.volumes;
    let volume = volumes[0], qtd = 1;
    const desenhar = (f) => {
      f.querySelector('#et-previa').innerHTML = etiquetaHtml(x, volume);
      f.querySelector('#et-qtd').textContent = qtd;
      f.querySelectorAll('[data-k^="vol:"]').forEach((b) => b.classList.toggle('sel', Number(b.dataset.k.slice(4)) === volume));
    };
    const ok = await abrirModal(`<h3>Etiqueta das bombonas</h3><p class="dica">Lote ${esc(x.lote)}, fabricação ${esc(dataBr(x.fechamento))}. Duas etiquetas por folha A4.</p>
      <div class="segmentos">${volumes.map((n) => `<button data-k="vol:${n}">${n} L</button>`).join('')}</div>
      <div class="qtd-etiquetas"><span>Quantas etiquetas?</span><button class="btn" data-k="menos" aria-label="Menos uma">−</button><b id="et-qtd"></b><button class="btn" data-k="mais">${ico('mais')}</button></div>
      <div class="et-previa" id="et-previa"></div>
      <div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn primario" data-k="ok">${ico('imprimir')} Imprimir</button></div>`,
    (k, b, fechar, f) => {
      if (k === 'x') return fechar(false);
      if (k === 'ok') return fechar(true);
      if (k.startsWith('vol:')) volume = Number(k.slice(4));
      if (k === 'menos') qtd = Math.max(1, qtd - 1);
      if (k === 'mais') qtd = Math.min(60, qtd + 1);
      desenhar(f);
    }, { classe: 'largo', aoAbrir: desenhar });
    if (!ok) return;
    imprimirHtml(`<div class="folha-etiquetas">${Array.from({ length: qtd }, () => etiquetaHtml(x, volume)).join('')}</div>`, `Etiqueta ${x.lote}`);
    registrar('anotacao', `${cfg.escritorio ? cfg.escritorio.nome : ''} imprimiu ${qtd} etiqueta${qtd > 1 ? 's' : ''} do lote ${x.lote}`);
  }

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
    registrar('anotacao', `${quemEstaAqui()} salvou ${contar(n, 'linha lida', 'linhas lidas')} da folha de papel (${(prancheta(v.pid) || {}).nome || ''})`);
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
        ${pode('pessoas') || pode('registro') || pode('folhas') ? `<div class="linha-botoes" style="margin:0 0 10px">${pode('pessoas') ? `<button class="btn pequeno" data-a="pessoas">${ico('pessoas')} Pessoas e permissões</button>` : ''}${pode('registro') ? `<button class="btn pequeno" data-a="registro">${ico('planilha')} Registro do sistema</button>` : ''}${pode('folhas') ? `<button class="btn pequeno" data-a="folhas">${ico('lapis')} Folhas e avisos</button>` : ''}</div>` : ''}
        <div class="config-grade">
          <section class="bloco">
            <h2>${ico('enviar')} Enviar para o escritório</h2>
            <p class="sub">O botão "Enviar para o escritório" manda direto para o WhatsApp. Sem número, usa o e-mail.</p>
            <div class="linha-config"><span class="escolha-ico">${ico('whatsapp')}</span><div><b>WhatsApp</b><small>${esc(cs.whatsapp ? formatarTelefone(cs.whatsapp) : 'não cadastrado')}</small></div>
              <button class="btn pequeno" data-a="contato" data-campo="whatsapp">${cs.whatsapp ? 'Trocar' : 'Cadastrar'}</button></div>
            <div class="linha-config"><span class="escolha-ico">${ico('email')}</span><div><b>E-mail</b><small>${esc(cs.email || 'não cadastrado')}</small></div>
              <button class="btn pequeno" data-a="contato" data-campo="email">${cs.email ? 'Trocar' : 'Cadastrar'}</button></div>
          </section>
          <section class="bloco" id="bloco-medidas">
            <h2>${ico('regua')} Medidas das dornas</h2>
            <p class="sub" style="margin:0 0 6px">Para o volume de vinho: volume = (altura − folga) × base × 1000, em litros. Nos tanques de álcool fica em m³, sem o × 1000. Começou com as medidas da planilha CONTROLE LTS.</p>
            ${gruposDaMedicao().map((g) => {
              const semMedida = g.dornas.filter((d) => !temMedida(d)).length;
              const iguais = g.dornas.every((d) => d.altura === g.dornas[0].altura && d.area === g.dornas[0].area);
              const txt = iguais && temMedida(g.dornas[0]) ? `${contar(g.dornas.length, 'dorna', 'dornas')}: altura ${fmtNum(String(g.dornas[0].altura))} m, base ${fmtNum(String(g.dornas[0].area))} m²` : `${contar(g.dornas.length, 'dorna', 'dornas')} com medidas diferentes`;
              return `<div class="linha-config"><span class="escolha-ico">${ico(g.fermentando ? 'tanque' : 'regua')}</span><div><b>${esc(g.nome)}</b><small>${esc(txt)}${semMedida ? ` · ${contar(semMedida, 'sem medida', 'sem medida')}` : ''}</small></div>
                <button class="btn pequeno" data-a="medida-grupo" data-grupo="${g.id}">Trocar</button></div>`;
            }).join('')}
            ${cs.medicao ? `<div class="linha-botoes"><button class="btn pequeno" data-a="medidas-planilha">Voltar para as medidas da planilha</button></div>` : ''}
          </section>
          <section class="bloco" id="bloco-base44">
            <h2>${ico('escritorio')} Totais do dia no Base44</h2>
            ${htmlBase44()}
          </section>
          <section class="bloco" id="bloco-nuvem">
            <h2>${ico('servidor')} Nuvem (internet)</h2>
            ${htmlNuvem()}
          </section>
          <section class="bloco">
            <h2>${ico('balanca')} Listas do ralo</h2>
            <h3>Tipos de produto</h3>${lista('produtos', 'produto')}
            <h3 style="margin-top:14px">Fornecedores</h3>${lista('fornecedores', 'fornecedor')}
          </section>
          <section class="bloco">
            <h2>${ico('wifi')} Aparelhos conectados</h2>
            ${htmlAparelhos()}
            <div class="linha-botoes"><button class="btn pequeno" data-a="aparelhos">${ico('wifi')} Ver todos os aparelhos</button><button class="btn pequeno" data-a="ver-erros">${ico('alerta')} Ver erros dos aparelhos</button></div>
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
              ${!s.soChefe && s.pranchetas.some((pid) => prancheta(pid).tipo === 'grade') ? `<div class="linha-config lembrete-config"><div><b>Lembrete de anotar a cada hora</b><small>Apito tranquilo na virada da hora. Às :30, se a linha ainda estiver vazia, apito chato até anotar.</small></div>
                <button class="interruptor ${(configSistema().lembretes || {})[s.id] ? 'ligado' : ''}" data-a="lembrete-liga" data-id="${s.id}" aria-label="Lembrete da ${esc(s.nome)}"><i></i><span>${(configSistema().lembretes || {})[s.id] ? 'Ligado' : 'Desligado'}</span></button></div>` : ''}
              ${s.soChefe ? '<p class="sub" style="margin:10px 0 0">Só o tablet chefe anota estas folhas. Nenhum tablet de setor fica com elas.</p>' : `<h3 style="margin-top:14px">Operadores <small>${ops.length}</small></h3>
              <div class="pessoas">${visiveis.map((o) => {
                const i = ops.indexOf(o);
                return `<div><span class="nome">${ico('pessoa')} <b>${esc(o.nome)}</b><small class="${o.senha ? '' : 'sem-senha'}">${o.senha ? 'com senha' : 'sem senha'}</small></span>
                <span class="acoes"><button class="btn pequeno" data-a="op-senha" data-setor="${s.id}" data-i="${i}">Senha</button>
                <button class="btn pequeno perigo" data-a="op-remove" data-setor="${s.id}" data-i="${i}" aria-label="Remover ${esc(o.nome)}">${ico('lixeira')}</button></span></div>`;
              }).join('') || '<div class="vazio">Nenhum operador cadastrado</div>'}</div>
              <div class="linha-botoes">
                ${ops.length > LIMITE_NOMES ? `<button class="btn pequeno" data-a="mostrar-mais" data-setor="${s.id}">${aberto ? 'Mostrar menos' : `Mostrar mais (${ops.length - LIMITE_NOMES})`}</button>` : ''}
                <button class="btn pequeno" data-a="op-add" data-setor="${s.id}">${ico('mais')} Cadastrar operador</button></div>`}` : '<p class="sub" style="margin:8px 0 0">Setor desligado. O tablet dele mostra um aviso e não deixa anotar.</p>'}
          </section>`;
        }).join('')}</div>
      </main>`;
  }
  function htmlAparelhos() {
    const st = sync.status;
    if (cfg.demo) return '<p class="sub" style="margin:0">Na demonstração não há outros aparelhos.</p>';
    const lista = st && st.aparelhos ? st.aparelhos : [];
    if (!lista.length) return '<p class="sub" style="margin:0">Nenhum aparelho mandou nada desde que a central ligou.</p>';
    return `<div class="lista-aparelhos">${lista.slice(0, 6).map(linhaDoAparelho).join('')}</div>${lista.length > 6 ? `<p class="sub" style="margin:6px 0 0">E mais ${lista.length - 6} em Ver todos os aparelhos.</p>` : ''}`;
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
    C, prancheta, setorDaPrancheta, listar: listarPapel, pegar, fmtData, fmtNum, rotuloHoraPapel, HORAS, linhasDeHora, totalInsumo, extrasOperador, somarDias,
    medicaoDoDia: (data) => medicaoDoDia(data), fermentacaoDoDia,
  }));
  function planilhaDaPrancheta(pid, data) {
    return window.ModelosPapel.paraPlanilha(papel().folha(pid, data));
  }
  const listaDeDias = (dias) => (Array.isArray(dias) ? dias : [dias]);
  const nomeDosDias = (dias) => { const l = listaDeDias(dias); return l.length > 1 ? `${l[0]}_a_${l[l.length - 1]}` : l[0]; };
  function gerarXml(dias, pids) {
    const X = window.xmlEscape;
    const l = listaDeDias(dias);
    const partes = ['<?xml version="1.0" encoding="UTF-8"?>', `<pranchetas empresa="${X(C.empresa)}" data="${l[0]}"${l.length > 1 ? ` ate="${l[l.length - 1]}"` : ''} gerado="${new Date().toISOString()}">`];
    l.forEach((data) => pids.forEach((pid) => partes.push(window.ModelosPapel.paraXml(papel().folha(pid, data), data, X))));
    partes.push('</pranchetas>');
    return new Blob([partes.join('\n')], { type: 'application/xml' });
  }
  /** Imprime as folhas do dia iguais ao papel (no Android abre a impressão do sistema, que também salva em PDF). */
  async function imprimirFolhas(dias, setorIds) {
    const pids = folhasDosSetores(setorIds);
    const l = listaDeDias(dias);
    return imprimirHtml(l.flatMap((data) => pids.map((pid) => window.ModelosPapel.paraHtml(papel().folha(pid, data), 'icons/logo.png', fmtNum))).join(''), `Pranchetas ${fmtData(l[0])}`);
  }
  /** Imprime um pedaço de HTML (folhas, etiquetas). No Android abre a impressão do sistema, que também salva em PDF. */
  async function imprimirHtml(html, nome) {
    let area = document.getElementById('impressao');
    if (!area) { area = document.createElement('div'); area.id = 'impressao'; document.body.appendChild(area); }
    area.innerHTML = html;
    // a primeira página já nasce no tamanho da primeira folha (sem página em branco antes de uma folha deitada)
    const primeira = area.querySelector('.folha-imp');
    area.style.page = document.body.style.page = primeira && primeira.classList.contains('paisagem') ? 'paisagem' : 'retrato';
    document.body.classList.add('imprimindo');
    await Promise.all([...area.querySelectorAll('img')].map((im) => (im.complete ? 0 : new Promise((ok) => { im.onload = ok; im.onerror = ok; }))));
    if (NO_APK && pluginCentral && pluginCentral.imprimir) {
      // a folha fica escondida na tela; o Android desenha a impressão quando a pessoa escolhe a impressora
      try { await pluginCentral.imprimir({ nome }); } catch (e) { toast('Não consegui abrir a impressão', 'erro'); }
      return;
    }
    window.addEventListener('afterprint', () => { document.body.classList.remove('imprimindo'); area.innerHTML = ''; }, { once: true });
    window.print();
  }
  const folhasDosSetores = (setorIds) => setores().filter((s) => setorIds.includes(s.id)).flatMap((s) => s.pranchetas.flatMap(folhasDe));
  const MIME = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xml: 'application/xml', pdf: 'application/pdf' };
  function gerarArquivo(formato, dias, setorIds, somar) {
    const pids = folhasDosSetores(setorIds);
    const l = listaDeDias(dias);
    // o relatório do dia (todos os setores) tem sempre o mesmo nome: um por dia; só alguns setores ganham o nome deles
    const parcial = setorIds.length < setores().length;
    const nome = `Pranchetas_${nomeDosDias(l)}${parcial ? '_' + setorIds.join('-') : ''}`;
    if (formato === 'xml') return new File([gerarXml(l, pids)], nome + '.xml', { type: MIME.xml });
    // vários dias: uma aba por folha de cada dia (o nome da aba leva o dia); "somar" põe a aba com os totais no começo
    const abas = l.flatMap((data) => pids.map((pid) => { const a = planilhaDaPrancheta(pid, data); if (l.length > 1) a.name = `${String(a.name || pid).slice(0, 24)} ${data.slice(8, 10)}-${data.slice(5, 7)}`; return a; }));
    if (somar) {
      const cel = (v, b) => ({ v, st: { borda: true, b: !!b } });
      const linhas = [[cel(`Totais de ${fmtData(l[0])} a ${fmtData(l[l.length - 1])}`, true), '', '', ''], [cel('Setor', true), cel('Insumo', true), cel('Quantidade', true), cel('Unidade', true)],
        ...totaisDoEnvio(l, setorIds).map((x) => [cel(x.setor), cel(x.insumo), cel(x.quantidade), cel(x.unidade)])];
      abas.unshift({ name: 'Totais do período', rows: linhas, widths: [24, 30, 14, 10], heights: {}, merges: ['A1:D1'], paisagem: false });
    }
    return new File([window.criarXlsx(abas, LOGO_PNG)], nome + '.xlsx', { type: MIME.xlsx });
  }
  /** PDF das folhas (pdf.js): uma página para cada folha de papel. A letra e o logo são buscados uma vez só. */
  let pecasDoPdf = null;
  async function pecasPdf() {
    if (pecasDoPdf) return pecasDoPdf;
    const fonte = (n) => fetch(`fonts/atkinson-pdf-${n}.ttf`).then((r) => { if (!r.ok) throw new Error('fonte'); return r.arrayBuffer(); });
    const [normal, negrito] = await Promise.all([fonte(400), fonte(700)]);
    let logo = null;
    try {
      const im = new Image();
      im.src = 'icons/logo.png';
      await im.decode();
      const cv = document.createElement('canvas');
      cv.width = im.naturalWidth; cv.height = im.naturalHeight;
      const cx = cv.getContext('2d');
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0);
      const b64 = cv.toDataURL('image/jpeg', 0.92).split(',')[1];
      logo = { jpeg: Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)), largura: cv.width, altura: cv.height };
    } catch (e) { /* sem o logo, o PDF sai do mesmo jeito */ }
    pecasDoPdf = { fontes: [normal, negrito], logo };
    return pecasDoPdf;
  }
  async function gerarPdf(dias, setorIds) {
    const pids = folhasDosSetores(setorIds);
    const l = listaDeDias(dias);
    const parcial = setorIds.length < setores().length;
    const nome = `Pranchetas_${nomeDosDias(l)}${parcial ? '_' + setorIds.join('-') : ''}`;
    const pecas = await pecasPdf();
    const bytes = window.criarPdf(l.flatMap((data) => pids.map((pid) => papel().folha(pid, data))), Object.assign({ fmtNum, titulo: `Pranchetas Ubirálcool ${fmtData(l[0])}` }, pecas));
    return new File([bytes], nome + '.pdf', { type: MIME.pdf });
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
      insumos.forEach((pid) => linhas.push(`• ${prancheta(pid).nome}: ${totalInsumo(linhasDeHora(listarPapel(data, pid))) || 'nada adicionado'}`));
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
  function totaisDoDia(data, ler = listar) {
    const itens = [];
    setores().forEach((s) => s.pranchetas.flatMap(folhasDe).filter((pid) => prancheta(pid).tipo === 'insumo').forEach((pid) => {
      const p = prancheta(pid);
      const soma = {};
      linhasDeHora(ler(data, pid)).forEach((r) => {
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
  /* Nuvem das Pranchetas (versão 2.8): a central manda uma cópia das anotações para a internet.
     O endereço e a senha ficam só na central; aqui o tablet chefe cadastra e vê se está indo. */
  let nuvemInfo = null;
  async function carregarNuvem() {
    try {
      const r = await postJson('api/nuvem', { acao: 'estado' }, 8000);
      if (r.ok) { nuvemInfo = await r.json(); if (view().tela === 'config' && podeRedesenhar()) render(); }
    } catch (e) { /* mostra o que veio na sincronização */ }
  }
  function htmlNuvem() {
    const n = Object.assign({}, sync.status && sync.status.nuvem, nuvemInfo);
    if (cfg.demo && !nuvemInfo) return '<p class="sub" style="margin:0">Na demonstração não há central para mandar para a nuvem.</p>';
    const quando = (ms) => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');
    const situacao = !n.ligada ? 'Desligada' : n.erro ? `Erro: ${n.erro}` : n.ultimoEnvio ? `Último envio ${quando(n.ultimoEnvio)}. ${n.faltam ? `Faltam ${contar(n.faltam, 'anotação', 'anotações')}.` : 'Tudo na nuvem.'}` : 'Ainda não mandou';
    return `<p class="sub" style="margin:0 0 6px">A central manda uma cópia das anotações para a internet. De lá saem a API do sistema do escritório e as atualizações do aplicativo. Sem internet, a usina continua funcionando e a cópia vai quando a internet voltar.</p>
      <div class="linha-config"><span class="escolha-ico">${ico('servidor')}</span><div><b>Endereço da nuvem</b><small>${esc(n.url ? enderecoCurto(n.url) : 'não cadastrado')}</small></div>
        <button class="btn pequeno" data-a="nuvem-url">${n.url ? 'Trocar' : 'Cadastrar'}</button></div>
      <div class="linha-config"><span class="escolha-ico">${ico('codigo')}</span><div><b>Senha da central</b><small>${n.temSegredo ? 'cadastrada (não aparece aqui)' : 'não cadastrada'}</small></div>
        <button class="btn pequeno" data-a="nuvem-segredo">${n.temSegredo ? 'Trocar' : 'Cadastrar'}</button></div>
      <div class="linha-config" id="nuvem-situacao"><span class="escolha-ico">${ico('enviar')}</span><div><b>Situação</b><small>${esc(situacao)}</small></div>
        <button class="btn pequeno" data-a="nuvem-enviar" ${n.ligada ? '' : 'disabled'}>Mandar agora</button></div>`;
  }
  async function configurarNuvem(mudanca) {
    const r = await postJson('api/nuvem', Object.assign({ acao: 'configurar', url: (nuvemInfo && nuvemInfo.url) || '', forms: C }, mudanca), 8000).catch(() => null);
    if (!r || !r.ok) { toast(r ? ((await r.json().catch(() => ({}))).erro || 'A central recusou') : 'Não consegui falar com a central', 'erro'); return false; }
    nuvemInfo = await r.json(); if (sync.status) sync.status.nuvem = Object.assign({}, nuvemInfo); sync.statusJson = '';
    return true;
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
    let formato = arquivo ? (/\.xml$/i.test(arquivo.name) ? 'xml' : /\.pdf$/i.test(arquivo.name) ? 'pdf' : 'xlsx') : null;
    let escolhidos = setores().map((s) => s.id);
    let completo = true, resumo = '';
    if (!arquivo) {
      const escolha = await escolherEnvio(destino === 'escritorio' ? `Enviar para o escritório (${alvo === 'whatsapp' ? 'WhatsApp' : 'e-mail'})` : nomes[alvo], data);
      if (!escolha) return;
      formato = escolha.formato; escolhidos = escolha.setores;
      completo = escolha.dias.length === 1 && escolha.dias[0] === data && escolha.turnos.length === C.turnos.length;
      data = escolha.dias[0];
      try { const m = await montarEnvio(escolha); arquivo = m.arquivo || null; resumo = m.texto || ''; } catch (e) { return toast('Não consegui montar o arquivo', 'erro'); }
    }
    const texto = formato === 'texto' ? resumo : `Pranchetas Ubirálcool, folha de ${fmtData(data)}`;
    const assunto = `Pranchetas Ubirálcool - ${fmtData(data)}`;
    // só o relatório com todos os setores fica guardado (um por dia, na pasta RelatoriosUsina)
    if (arquivo && !arquivoPronto && completo && formato !== 'pdf' && escolhidos.length === setores().length) guardarNaCentral(data, [arquivo]);

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
              <dt>Relógio</dt><dd>${esc(cfg.demo ? 'demonstração' : textoRelogio())}</dd></dl>
            <div class="linha-botoes">${centralNoTablet()
              ? `<button class="btn pequeno perigo" data-a="desligar-servidor">${ico('servidor')} Desligar o servidor deste aparelho</button>`
              : `${NO_APK && pluginCentral ? `<button class="btn pequeno" data-a="virar-central">${ico('servidor')} Usar este aparelho como servidor</button>` : ''}<button class="btn pequeno perigo" data-a="desconectar">${ico('wifi')} Desconectar da central</button>`}</div>
          </section>
          <section class="bloco">
            <h2>${ico('instalar')} Aplicativo</h2>
            <dl class="kv"><dt>Versão</dt><dd>${VERSAO}</dd>${atualizacao.nova ? `<dt>Versão nova</dt><dd><b>${esc(atualizacao.nova.versao)}</b></dd>` : ''}</dl>
            <div class="linha-botoes">
              ${atualizacao.nova ? `<button class="btn pequeno primario" data-a="atualizacao">${ico('instalar')} Atualizar para a ${esc(atualizacao.nova.versao)}</button>` : podeAtualizar() ? `<button class="btn pequeno" data-a="procurar-atualizacao">Procurar atualização</button>` : ''}
              <button class="btn pequeno" data-a="novidades">Novidades desta versão</button></div>
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
    // volume de vinho (os números da planilha do escritório) e as dornas de fermentação
    const med = (grupo, valores) => { const g = grupoDaMedicao(grupo); g.dornas.forEach((d) => { const vol = volumeDe(d, valores[d.id + '_folga'], g); if (vol != null) valores[d.id + '_vol'] = vol.toFixed(emM3(g) ? 3 : 2); }); ex(PID_MEDICAO, grupo, Object.assign({ hora: '07:30' }, valores), 'Mateus'); };
    med('sac', { sac1_folga: '0.15', sac1_brix: '18', sac2_folga: '0.2', sac2_brix: '18', sac4_folga: '0.14', sac4_brix: '19' });
    med('fer', { fer7_folga: '0.9', fer7_brix: '5', fer7_ferm: 'Sim', fer8_folga: '0.15', fer8_brix: '7', fer8_ferm: 'Sim', fer9_folga: '1.1', fer9_brix: '1', fer9_ferm: 'Não', fer11_folga: '0.16', fer11_brix: '7', fer11_ferm: 'Sim' });
    med('dsc', { dsc2_folga: '0.15', dsc2_brix: '7', dsc10_folga: '0.16', dsc10_brix: '7', dsc11_folga: '4', dsc11_brix: '10' });
    med('tq', { tq_inox1_folga: '1', tq_abast3_folga: '2.1' });
    ex(PID_MEDICAO, 'param', { brix_ralo: '18', hora_ralo: '09:30', brix_hid: '18', hora_hid: '09:30' }, 'Mateus');
    if (!ciclosPorDorna().size) {
      const ontem = somarDias(data, -1);
      const ciclo = (dia, n, v, op) => gravar(dia, PID_FERMENTACAO, `${n}-exemplo`, Object.assign({ dorna: n, enche_inicio: '', enche_fim: '', brix_inicial: '', volante: [], esvaziada: null, inicioEm: momentoDe(dia, v.enche_inicio) }, v), { operador: op });
      ciclo(ontem, 7, { enche_inicio: '08:10', enche_fim: '10:40', brix_inicial: '8' }, 'Mateus');
      ciclo(ontem, 8, { enche_inicio: '11:00', enche_fim: '13:25', brix_inicial: '9' }, 'Mateus');
      ciclo(ontem, 9, { enche_inicio: '02:15', enche_fim: '04:50', brix_inicial: '8', volante: [{ data, inicio: '09:12', fim: '', operador: 'Mateus' }] }, 'Mateus');
      ciclo(ontem, 11, { enche_inicio: '14:00', enche_fim: '16:30', brix_inicial: '8' }, 'Mateus');
      ciclo(data, 12, { enche_inicio: '10:05' }, 'Mateus');
    }
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

  /** Ações do tablet chefe e a função que cada uma precisa ("folha": anotar nas folhas do chefe ou corrigir as dos setores). */
  const PRECISA = {
    salvar: 'folha', 'enviar-dorna': 'folha', 'terminar-dorna': 'folha', 'copiar-vemde': 'folha', 'apagar-linha': 'folha',
    'ferm-encher': 'anotar', 'ferm-terminou': 'anotar', 'ferm-volante': 'anotar', 'ferm-parar': 'anotar', 'ferm-esvaziou': 'anotar', 'ferm-apagar': 'anotar',
    compartilhar: 'relatorios', relatorios: 'relatorios', 'relatorio-enviar': 'relatorios', 'relatorio-apagar': 'relatorios', 'gerar-hoje': 'relatorios', imprimir: 'relatorios',
    'aviso-enviar': 'avisos', 'aviso-cancelar': 'avisos', 'ler-folha': 'ler_folha', 'leitura-salvar': 'ler_folha',
    config: 'usina', 'medida-grupo': 'usina', 'medidas-planilha': 'usina', contato: 'usina', 'lista-add': 'usina', 'lista-remove': 'usina',
    'setor-liga': 'usina', 'prancheta-liga': 'usina', 'lembrete-liga': 'usina', 'op-add': 'usina', 'op-senha': 'usina', 'op-remove': 'usina',
    'nuvem-url': 'integracoes', 'nuvem-segredo': 'integracoes', 'nuvem-enviar': 'integracoes', 'base44-url': 'integracoes', 'base44-segredo': 'integracoes', 'base44-enviar': 'integracoes',
    'novo-codigo': 'conexao',
    graficos: 'relatorios', folhas: 'folhas', 'folha-campo': 'folhas', 'folha-unidades': 'folhas',
  };
  app.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]');
    if (!b || modalAberto()) return;
    const a = b.dataset.a;
    const v = view();
    // tablet chefe: confere se quem está usando pode fazer isso (e pede a senha se ninguém entrou)
    if (ehCentral() && PRECISA[a]) {
      const f = PRECISA[a] === 'folha' ? (soDoChefe(v.pid) ? 'anotar' : 'corrigir') : PRECISA[a];
      if (!(await exigir(f))) return;
    }
    switch (a) {
      case 'pessoa': {
        if (!pessoaAtual()) return entrarNoChefe();
        const p = pessoaAtual();
        const opcoes = [pode('pessoas') ? '<button class="btn" data-k="pessoas">Pessoas e permissões</button>' : '', pode('registro') ? '<button class="btn" data-k="registro">Registro do sistema</button>' : '', pode('folhas') ? '<button class="btn" data-k="folhas">Folhas e avisos</button>' : ''].join('');
        const resp = await abrirModal(`<h3>${esc(p.nome)}</h3><p class="dica">${esc((C.niveis[p.nivel] || {}).nome || p.nivel)} neste tablet chefe.</p>
          ${opcoes ? `<div class="linha-botoes">${opcoes}</div>` : ''}
          <div class="acoes-modal"><button class="btn" data-k="x">Fechar</button><button class="btn primario" data-k="sair">${ico('voltar')} Sair</button></div>`, (k, b2, fechar) => fechar(k), {});
        if (resp === 'sair') { sairDoChefe(); toast('Saiu. O painel continua à vista.'); }
        if (resp === 'pessoas') return ir({ tela: 'pessoas' });
        if (resp === 'registro') return ir({ tela: 'registro', data: dataProducao() });
        if (resp === 'folhas') return ir({ tela: 'folhas' });
        return;
      }
      case 'pessoas': if (!(await exigir('pessoas'))) return; return ir({ tela: 'pessoas' });
      case 'registro': if (!(await exigir('registro'))) return; return ir({ tela: 'registro', data: dataProducao() });
      case 'registro-dia': { const d = somarDias(v.data, Number(b.dataset.n)); if (d > dataProducao()) return; pilha[pilha.length - 1] = { tela: 'registro', data: d, tipo: v.tipo }; return render(); }
      case 'registro-tipo': v.tipo = b.dataset.tipo || ''; return render();
      case 'pessoa-nova': return editarPessoa(v, '');
      case 'pessoa-editar': return editarPessoa(v, b.dataset.id);
      case 'aparelho-chefe': return editarAparelhoChefe(v, b.dataset.id);
      case 'aparelhos': return ir({ tela: 'aparelhos' });
      case 'aparelho-info': return verAparelho(b.dataset.id);
      case 'conferir-bloqueio': sincronizar(); conferirNaNuvem(true); return toast('Conferindo...');
      case 'liberar-senha': {
        const blq = cfg.bloqueio;
        if (!blq || blq.modo !== 'senha') return;
        if (Date.now() < (cfg.esperaLiberar || 0)) return toast('Muitas senhas erradas. Espere um minuto.', 'erro');
        // o bloqueio chegou só pela nuvem (sem a senha): quem confere é a central, no Wi-Fi da usina
        if (!blq.resumo) return toast('Para usar a senha de desbloqueio, conecte este aparelho no Wi-Fi da usina.', 'erro');
        const pin = await pedirSenhaModal('Senha de desbloqueio', 'A senha que o administrador escolheu ao bloquear este aparelho.');
        if (pin === undefined) return;
        if (!/^\d{4,8}$/.test(pin) || resumoDaSenha(pin, blq.sal) !== blq.resumo) {
          cfg.errosLiberar = (cfg.errosLiberar || 0) + 1;
          if (cfg.errosLiberar >= 5) { cfg.errosLiberar = 0; cfg.esperaLiberar = Date.now() + 60000; }
          salvarCfg();
          return toast('Senha errada', 'erro');
        }
        cfg.errosLiberar = 0;
        cfg.liberacao = { em: blq.em, rev: blq.rev || 0, geracao: cfg.blqGeracao || '', codigo: pin }; // a central fica sabendo na próxima conversa
        salvarCfg();
        return liberarAparelho('Aparelho liberado. Pode usar.', blq.rev || 0);
      }
      case 'graficos': return ir({ tela: 'graficos', data: v.data || dataProducao(), setor: b.dataset.setor || '' });
      case 'graficos-dia': { const d = somarDias(v.data, Number(b.dataset.n)); if (d > dataProducao()) return; pilha[pilha.length - 1] = Object.assign({}, v, { data: d }); return render(true); }
      case 'graficos-setor': v.setor = b.dataset.setor || ''; return render();
      case 'folhas': return ir({ tela: 'folhas' });
      case 'folha-campo': return editarCampoDaFolha(b.dataset.pid, b.dataset.id);
      case 'folha-unidades': return editarUnidadesDaFolha(b.dataset.pid);
      case 'folha-estrutura': return editarEstruturaDaFolha(b.dataset.pid);
      case 'voltar': return voltar();
      case 'tema':
        cfg.tema = cfg.tema === 'escuro' ? 'claro' : 'escuro'; salvarCfg(); aplicarTema();
        return render();
      case 'tema-fixo': cfg.tema = b.dataset.valor; salvarCfg(); aplicarTema(); return render();
      case 'escala': cfg.escala = b.dataset.valor; salvarCfg(); ajustarEscala(); return render();
      case 'conectar': return conectar();
      case 'procurar-central': return procurarCentral();
      case 'atualizacao': return oferecerAtualizacao();
      case 'procurar-atualizacao': return procurarAtualizacao(true);
      case 'novidades': return mostrarNovidades();
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
      case 'esc-entrar': if (await entrarNoEscritorio()) render(true); return;
      case 'esc-sair': cfg.escritorio = null; salvarCfg(); pilha = [telaInicial()]; return render(true);
      case 'esc-dia': {
        const d = somarDias(v.data, Number(b.dataset.n));
        if (d > dataProducao()) return;
        buscarDia(d); renovarEscritorio();
        pilha[pilha.length - 1] = Object.assign({}, v, { data: d }); return render();
      }
      case 'esc-abrir': renovarEscritorio(); buscarDia(v.data); return ir({ tela: b.dataset.t, data: v.data });
      case 'esc-campo': return mudarCampoEsc(v, b.dataset.c, b.dataset.r);
      case 'esc-salvar': return salvarEsc(v);
      case 'esc-recalcular': {
        if (!(await confirmar('Refazer com as anotações de agora?', 'Os números voltam a ser os das folhas dos setores. O que foi digitado aqui se perde (até salvar, nada muda no que já está salvo).', 'Refazer'))) return;
        v.valores = prepararValores(window.Rastreamento.calcular(C, v.data, anotacoesDoDia(v.data))); v.sujo = true; return render();
      }
      case 'esc-arquivo': return enviarRastreamento(v);
      case 'esc-etiqueta': return etiquetaEsc(v);
      case 'esc-folha': return imprimirFolhaEsc(v);
      case 'papel': {
        if (b.dataset.id === 'central' && !cfg.demo && cfg.chave && !centralNoTablet() && !(await garantirLiberacaoDeChefe())) return;
        cfg.papel = b.dataset.id; salvarCfg();
        pilha = [telaInicial()];
        if (!ehCentral() && !ehEscritorio() && !operadorAtual()) pilha.push({ tela: 'operador' });
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
            if (!(await verificarNoSetor('ajustes', 'Senha do encarregado', `Liberar ${nome} neste turno.`))) return;
          }
        }
        definirOperador(nome); toast(`Bom trabalho, ${nome}`);
        if (pilha.length > 1) pilha.pop(); else pilha = [telaInicial()];
        rascunho = null; render(true);
        setTimeout(verificarAvisos, 700); // aviso guardado para esta pessoa aparece logo que ela entra
        return;
      }
      case 'admin': {
        if (!(await (ehCentral() ? exigir('ajustes') : verificarNoSetor('ajustes')))) return;
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
      // saindo do Monitorar num dia anterior, o tablet do setor volta para a folha de hoje
      case 'monitor': return ir(Object.assign({}, v, { monitor: !v.monitor }, v.monitor && !ehCentral() ? { data: undefined, chave: undefined } : {}), true);
      case 'monitor-dia': {
        const d = somarDias(dataDaView(v), Number(b.dataset.n));
        if (d > dataProducao()) return;
        buscarDia(d);
        return ir(Object.assign({}, v, { data: d === dataProducao() && !ehCentral() ? undefined : d, chave: undefined }), true);
      }
      case 'inicio-setor': return ir({ tela: 'inicio' }, true);
      case 'painel': return ir({ tela: 'central', data: v.data || dataProducao() }, true);
      case 'linha': {
        const chave = /^\d+$/.test(b.dataset.chave) ? Number(b.dataset.chave) : b.dataset.chave;
        if (rascunho && rascunho.chave === chave && !v.monitor) return;
        // tablet do setor olhando um dia anterior no Monitorar: só consulta
        if (v.monitor && !ehCentral() && dataDaView(v) !== dataProducao()) return;
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
          registrar('anotacao', `${quemEstaAqui()} apagou ${prancheta(v.pid).nome} Nº ${k}`);
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
        registrar('anotacao', `${quemEstaAqui()} mandou um aviso para ${f.nome || 'quem estiver'} na ${(setorPorId(f.setor) || {}).nome || f.setor}: "${texto.slice(0, 120)}"`);
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
        // mexe no número do escritório, operadores e setores de todos os tablets: a permissão foi conferida antes (PRECISA)
        carregarBase44(); carregarNuvem();
        return ir({ tela: 'config' });
      }
      case 'nuvem-url': {
        const valor = await textoLivre({ titulo: 'Endereço da nuvem', dica: 'O endereço que apareceu no fim do publicar.ps1, como https://pranchetas-nuvem.seu-nome.workers.dev. Deixe em branco para parar de mandar.', valor: (nuvemInfo && nuvemInfo.url) || '', tipo: 'url', max: 300 });
        if (valor === undefined) return;
        if (valor && !/^https:\/\/\S+\.\S+$/i.test(valor)) return toast('Endereço incompleto. Ele começa com https://', 'erro');
        if (!(await configurarNuvem({ url: valor }))) return;
        toast(valor ? 'Endereço salvo. A cópia vai sozinha.' : 'Cópia na nuvem desligada');
        return render();
      }
      case 'nuvem-segredo': {
        const valor = await textoLivre({ titulo: 'Senha da central', dica: 'A senha da central que apareceu no fim do publicar.ps1 (SEGREDO_CENTRAL).', tipo: 'text', max: 200 });
        if (!valor) return;
        if (!(await configurarNuvem({ segredo: valor }))) return;
        toast('Senha salva');
        return render();
      }
      case 'nuvem-enviar': {
        toast('Mandando para a nuvem...');
        const r = await postJson('api/nuvem', { acao: 'enviar' }, 60000).catch(() => null);
        if (!r || !r.ok) return toast(r ? ((await r.json().catch(() => ({}))).erro || 'A central recusou') : 'Não consegui falar com a central', 'erro');
        nuvemInfo = await r.json(); if (sync.status) sync.status.nuvem = Object.assign({}, nuvemInfo); sync.statusJson = '';
        toast(nuvemInfo.erro ? 'Não foi: ' + nuvemInfo.erro : nuvemInfo.faltam ? `Mandou. Faltam ${nuvemInfo.faltam}` : 'Tudo na nuvem', nuvemInfo.erro ? 'erro' : 'ok');
        return render();
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
      case 'ferm-encher': {
        if (!exigeOperador() || !rascunho) return;
        const n = rascunho.chave;
        const r = cicloAtual(n);
        if (r && etapaFerm(r) !== 'vazia' && !(await confirmar(`A Nº ${n} ainda tem vinho`, `Ela foi enchida em ${fmtData(r.data)} e não foi marcada como vazia. Começar um enchimento novo mesmo assim?`, 'Começar'))) return;
        const val = { enche_inicio: rascunho.valores.enche_inicio || horaAgora(), enche_fim: rascunho.valores.enche_fim || '', brix_inicial: rascunho.valores.brix_inicial || '' };
        novoCiclo(n, val, quemAnota());
        rascunho = null; ed.alvoId = null;
        registrar('anotacao', `${quemEstaAqui()}: dorna Nº ${n} começou a encher às ${val.enche_inicio}`);
        toast(`Nº ${n} enchendo desde ${val.enche_inicio}`);
        return render();
      }
      case 'ferm-terminou': {
        if (!exigeOperador() || !rascunho) return;
        const n = rascunho.chave;
        const r = cicloAtual(n);
        if (!r || etapaFerm(r) === 'vazia') return;
        const brix = rascunho.valores.brix_inicial;
        mudarCiclo(r, { enche_inicio: rascunho.valores.enche_inicio || r.valores.enche_inicio, enche_fim: rascunho.valores.enche_fim || horaAgora(), brix_inicial: brix || '' });
        rascunho = null; ed.alvoId = null;
        render();
        // falta o Brix inicial: já abre o teclado nele
        if (vazio(brix)) { selecionar('brix_inicial'); toast('Nº ' + n + ' cheia. Anote o Brix inicial e toque em Salvar.'); } else toast(`Nº ${n} cheia. Fermentando.`);
        return;
      }
      case 'ferm-volante': {
        if (!exigeOperador() || !rascunho) return;
        const n = rascunho.chave;
        if (rascunhoSujo()) salvarRascunho(true, { silencioso: true });
        const outras = naVolante().filter((s) => s.n !== n);
        if (outras.length && !(await confirmar('A volante já está recebendo', `${outras.map((s) => `A Nº ${s.n} está mandando desde ${s.inicio}`).join('. ')}. Mandar a Nº ${n} junto?`, 'Mandar junto'))) return;
        const r = cicloAtual(n);
        if (!r || etapaFerm(r) === 'vazia') return;
        const hora = horaAgora();
        mudarCiclo(r, { volante: [...(r.valores.volante || []), { data: dataProducao(), inicio: hora, fim: '', operador: quemAnota(), inicioEm: Date.now() }] });
        rascunho = null; ed.alvoId = null;
        registrar('anotacao', `${quemEstaAqui()}: dorna Nº ${n} começou a mandar para a volante às ${hora}`);
        toast(`Nº ${n} mandando para a volante desde ${hora}`);
        return render();
      }
      case 'ferm-parar': {
        if (!exigeOperador() || !rascunho) return;
        const n = rascunho.chave;
        const r = cicloAtual(n);
        if (!r || etapaFerm(r) !== 'volante') return;
        const resp = await abrirModal(`<h3>Parou de mandar a Nº ${n}</h3><p class="dica">A dorna esvaziou?</p>
          <div class="acoes-modal"><button class="btn" data-k="nao">Não, ainda tem vinho</button><button class="btn primario" data-k="sim">${ico('certo')} Sim, esvaziou</button></div>
          <div class="acoes-modal um"><button class="btn" data-k="x">Cancelar</button></div>`, (k, b2, fechar) => fechar(k));
        if (resp !== 'sim' && resp !== 'nao') return;
        const hora = horaAgora();
        const vol = (r.valores.volante || []).map((s) => (s.fim ? s : Object.assign({}, s, { fim: hora, fimEm: Date.now(), operadorFim: operadorAtual() })));
        mudarCiclo(r, Object.assign({ volante: vol }, resp === 'sim' ? { esvaziada: { data: dataProducao(), hora, em: Date.now(), operador: quemAnota() } } : {}));
        rascunho = null; ed.alvoId = null;
        registrar('anotacao', `${quemEstaAqui()}: dorna Nº ${n} parou de mandar para a volante às ${hora}${resp === 'sim' ? ' e ficou vazia' : ', ainda com vinho'}`);
        toast(resp === 'sim' ? `Nº ${n} vazia` : `Nº ${n} parou de mandar às ${hora}`);
        return render();
      }
      case 'ferm-esvaziou': {
        if (!exigeOperador() || !rascunho) return;
        const n = rascunho.chave;
        const r = cicloAtual(n);
        if (!r || etapaFerm(r) === 'vazia') return;
        if (!(await confirmar(`A Nº ${n} está vazia?`, 'Marca que não sobrou vinho nela. O próximo passo é Começar a encher.', 'Está vazia'))) return;
        mudarCiclo(r, { esvaziada: { data: dataProducao(), hora: horaAgora(), em: Date.now(), operador: quemAnota() } });
        rascunho = null; ed.alvoId = null;
        registrar('anotacao', `${quemEstaAqui()}: dorna Nº ${n} ficou vazia`);
        toast(`Nº ${n} vazia`);
        return render();
      }
      case 'ferm-apagar': {
        if (!rascunho) return;
        const n = rascunho.chave;
        const r = cicloAtual(n);
        if (!r) return;
        if (!(await confirmar(`Apagar o enchimento da Nº ${n}?`, `O enchimento de ${fmtData(r.data)}${r.valores.enche_inicio ? ` (começou às ${r.valores.enche_inicio})` : ''} sai da folha. Use só se foi anotado por engano.`, 'Apagar', true))) return;
        if (ehCentral() && r.operador && !ehDoChefe(r.operador) && !(await autorizar([r.operador]))) return;
        apagar(r.data, PID_FERMENTACAO, r.chave);
        rascunho = null; ed.alvoId = null;
        registrar('anotacao', `${quemEstaAqui()} apagou o enchimento da dorna Nº ${n}`);
        toast(`Enchimento da Nº ${n} apagado`);
        return render();
      }
      case 'medida-grupo': {
        const g = grupoDaMedicao(b.dataset.grupo);
        if (!g) return;
        const num = (x) => (x == null || x === '' ? '' : String(x).replace('.', ','));
        const resp = await abrirModal(`<h3>Medidas: ${esc(g.nome)}</h3><p class="dica">Altura da dorna e área da base, em metros. Volume = (altura − folga) × base${emM3(g) ? ', em m³' : ' × 1000, em litros'}.</p>
          <div class="medidas-form"><div class="medidas-cab"><span></span><span>Altura (m)</span><span>Base (m²)</span></div>
          ${g.dornas.map((d, i) => `<label><span>${esc(d.nome)}</span><input id="alt${i}" inputmode="decimal" autocomplete="off" value="${esc(num(d.altura))}"><input id="area${i}" inputmode="decimal" autocomplete="off" value="${esc(num(d.area))}"></label>`).join('')}</div>
          <div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn primario" data-k="ok">Salvar</button></div>`,
        (k, b2, fechar, f) => {
          if (k === 'x') return fechar(undefined);
          if (k !== 'ok') return;
          const ler = (id) => { const t = f.querySelector('#' + id).value.trim().replace(',', '.'); return t === '' ? null : Number(t); };
          const novas = g.dornas.map((d, i) => ({ altura: ler('alt' + i), area: ler('area' + i) }));
          const ruim = novas.findIndex((x) => [x.altura, x.area].some((y) => y != null && !(y > 0 && y < 100)));
          if (ruim >= 0) { toast(`${g.dornas[ruim].nome}: medida errada. Use números como 2,7`, 'erro'); return; }
          fechar(novas);
        }, { classe: 'largo' });
        if (!resp) return;
        const med = JSON.parse(JSON.stringify(medidasDasDornas()));
        const gg = med.grupos.find((x) => x.id === g.id);
        gg.dornas.forEach((d, i) => { d.altura = resp[i].altura; d.area = resp[i].area; });
        salvarConfigSistema({ medicao: med });
        toast(`Medidas de ${g.nome} salvas`);
        return render();
      }
      case 'medidas-planilha': {
        if (!(await confirmar('Voltar para as medidas da planilha?', 'As medidas trocadas aqui voltam a ser as da planilha CONTROLE LTS. As medições já salvas continuam com o volume que tinham.', 'Voltar'))) return;
        salvarConfigSistema({ medicao: null });
        toast('Medidas da planilha de volta');
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
      case 'lembrete-liga': {
        const m = Object.assign({}, configSistema().lembretes || {});
        m[b.dataset.id] = !m[b.dataset.id];
        salvarConfigSistema({ lembretes: m });
        return render();
      }
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
  window.addEventListener('resize', () => { ajustarEscala(); rolarDepois = true; arrumarQuadros(); agendarCaber(); });

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
  const cabe = (el) => {
    // nome do quadro com o selo do lado (aviso ou volume): precisa sobrar um pouco, senão a última letra do selo encosta na borda
    if (el.children.length > 1 && el.matches('.campo .rot')) {
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      const soma = [...el.children].reduce((s, c) => s + c.offsetWidth, 0) + gap * (el.children.length - 1);
      if (soma > el.clientWidth - 2) return false;
    }
    return el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1;
  };
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
    raiz.querySelectorAll('.campo.apertado').forEach((q) => q.classList.remove('apertado'));
    // primeiro só mede (sem mexer), para a tela não recalcular a cada elemento
    const apertados = lista.filter((el) => el.clientWidth > 0 && !cabe(el)).map((el) => ({ el, base: parseFloat(getComputedStyle(el).fontSize) }));
    // nome embaixo do ícone na barra do alto (celular com letra Maior: "Guilherme", "Relatórios"): pode ir até 11,6 px na tela, já com o zoom
    const zoom = parseFloat(document.body.style.zoom) || 1;
    apertados.forEach(({ el, base }) => {
      const minimo = el.matches('.campo .val:not(.vazio), .campo .rot') ? Math.min(base, Math.max(13, base * 0.45))
        : el.matches('.topo .atalho span') ? Math.min(base, 11.6 / zoom)
          : Math.min(base, Math.max(13, base * 0.6));
      let t = base;
      while (t > minimo && !cabe(el)) { t = Math.max(minimo, t * 0.92); el.style.fontSize = t.toFixed(1) + 'px'; }
      // nem assim coube: vai para a linha de baixo, sempre entre uma palavra e outra
      // (menos o número e o nome do quadro: eles ficam numa linha só, para os quadros ficarem do mesmo tamanho)
      if (!cabe(el) && !el.matches('.campo .val:not(.vazio), .campo .rot')) el.style.whiteSpace = 'normal';
      // nome do quadro com o volume do lado que nem na letra mínima cabe: "Folga Nº 2" vira "Folga 2"
      if (!cabe(el) && el.matches('.campo .rot') && el.querySelector('.rot-n')) el.closest('.campo').classList.add('apertado');
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
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { arrumarQuadros(); agendarCaber(); });

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
    if (redesenharDepois && podeRedesenhar()) { redesenharDepois = false; if (['central', 'inicio', 'prancheta', 'config', 'aparelhos'].includes(view().tela)) render(); }
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
      if (cfg.papel && !ehCentral() && !ehEscritorio()) pilha.push({ tela: 'operador' });
      if (!DEMO_IMG) podar();
      render(true); toast(`Nova folha começou: ${fmtData(d)}`);
      return;
    }
    if (t !== ultimoTurno) {
      ultimoTurno = t;
      if (cfg.papel && !ehCentral() && !ehEscritorio() && podeRedesenhar()) { pilha = [telaInicial(), { tela: 'operador' }]; rascunho = null; render(true); }
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
    // &atualizacao=2.8.0 : como fica o alto da tela quando tem versão nova
    if (params.get('atualizacao')) atualizacao.nova = { tipo: params.get('rapida') ? 'telas' : 'apk', base: '/telas/', versao: params.get('atualizacao'), tamanho: 9751234, url: '/apk/pranchetas.apk', novidades: [{ versao: params.get('atualizacao'), itens: (window.NOVIDADES || [{}])[0].itens || [] }] };
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
      else if (tela === 'config' || tela === 'admin' || tela === 'relatorios' || tela === 'pessoas' || tela === 'registro' || tela === 'folhas') pilha.push({ tela });
      else if (tela === 'graficos') pilha.push({ tela, data: dataProducao(), setor: params.get('setor') || '' });
      else if (tela === 'aparelhos') pilha.push({ tela });
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
        if (params.get('chave')) pv.chave = /^\d+$/.test(params.get('chave')) ? Number(params.get('chave')) : params.get('chave');
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
    if (params.get('modal') === 'atualizacao') oferecerAtualizacao();
    if (params.get('modal') === 'novidades') mostrarNovidades('2.6.0');
    if (params.get('ninguem')) { demoSemPessoa = true; render(true); }
    // aparelhos e bloqueio de exemplo (versão 2.11)
    if (ehCentral()) { sync.status = statusDeExemplo(); render(true); }
    if (params.get('bloqueio')) { cfg.bloqueio = { em: Date.now() - 3600000, modo: params.get('bloqueio'), apagar: params.get('apagar') === '1', sal: '', resumo: '' }; pilha = [{ tela: 'bloqueado-adm' }]; render(true); }
    if (params.get('aparelho')) verAparelho(params.get('aparelho'));
    if (params.get('modal') === 'entrar') entrarNoChefe();
    if (params.get('modal') === 'liberar') liberarEsteAparelho();
    // lembrete de anotar (versão 2.13): ?demo&papel=destilaria&op=Mateus&lembrete=1 (ou =urgente, como se fosse depois das :30)
    if (params.get('lembrete') && cfg.papel) { lembreteUrgente = params.get('lembrete') === 'urgente'; salvarConfigSistema({ lembretes: { [cfg.papel]: true } }); verificarLembrete(); }
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
    // o servidor do tablet chefe (Java) não lê o forms.js: o aplicativo manda as folhas para ele montar a API na nuvem
    if (centralNoTablet()) ligarCentralDoTablet().then(() => { sincronizar(); postJson('api/nuvem', { acao: 'forms', forms: C }, 8000).catch(() => {}); });
    // não é mais o servidor, mas ele ficou ligado (ligou sozinho ao religar): desliga
    else if (NO_APK && pluginCentral && pluginCentral.estado) pluginCentral.estado().then((r) => { if (r && r.rodando) pluginCentral.parar().catch(() => {}); }).catch(() => {});
    // no aplicativo, quem guarda se a tela cheia está ligada é o Android
    if (NO_APK && pluginCentral && pluginCentral.telaCheia) pluginCentral.telaCheia({}).then((r) => { if (!!r.ligada !== !!cfg.telaCheia) { cfg.telaCheia = !!r.ligada; salvarCfg(); document.documentElement.toggleAttribute('data-cheia', cfg.telaCheia); } }).catch(() => {});
    podar();
    pilha = [telaInicial()];
    if (cfg.papel && (cfg.chave || cfg.demo) && !ehCentral() && !ehEscritorio() && !operadorAtual()) pilha.push({ tela: 'operador' });
    render(true);
    lerInfoDoAparelho().finally(sincronizar);
    setTimeout(() => conferirNaNuvem(true), 4000);
    setTimeout(verificarAvisos, 800); // aviso que já estava guardado neste aparelho
    conferirNovidades();
    // versão nova na central (ou na nuvem): procura logo depois de abrir e a cada 30 minutos
    if (podeAtualizar()) { setTimeout(procurarAtualizacao, 15000); setInterval(procurarAtualizacao, 30 * 60000); setInterval(avisarAtualizacao, 60000); }
    // atualização rápida: a tela abriu, então as telas novas ficam (sem isso, na terceira vez o Android volta para as de antes)
    if (podeAtualizar() && pluginCentral.telasOk) setTimeout(() => pluginCentral.telasOk().then((r) => { if (r && r.voltou) toast(`A versão ${r.voltou} não abriu direito. Voltei para a anterior.`, 'erro'); }).catch(() => {}), 5000);
    // todos os aparelhos sincronizam a cada 5 segundos
    setInterval(sincronizar, 5000);
    setInterval(verificarLembrete, 10000);
    setInterval(() => { if (foraDaRede() && view().tela !== 'bloqueado' && !modalAberto()) render(); }, 60000);
    app.addEventListener('pointerdown', function primeira() { entrarTelaCheia(); app.removeEventListener('pointerdown', primeira); });
    if (!NO_APK && 'serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
