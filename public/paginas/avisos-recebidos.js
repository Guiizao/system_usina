/* Pranchetas Ubirálcool - avisos do escritório na tela de quem trabalha
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

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
     Ligado por setor no tablet chefe (Configurações da usina), com o horário de trabalho do setor (2.13.3): fora dele
     não toca, porque o celular da firma vai para casa com a pessoa. Na virada da hora, se a linha daquela hora de uma folha
     hora a hora do setor está vazia: faixa no alto da tela e um apito tranquilo. Passou das :30 sem anotar: apito chato,
     que para quando a linha for anotada ou quando a pessoa tocar em "Anotar agora" (aí só volta na hora seguinte). */
  let lembrete = { id: null, avisou: false, apito: null };
  let lembreteUrgente = false; // só na demonstração
  /** Horário do lembrete do setor: { de, ate } em horas cheias; de = ate é o dia todo. Desligado: null (true é o dia todo). */
  const comoHorario = (l) => (l ? (l === true ? { de: 7, ate: 7 } : l) : null);
  const horarioLembrete = (id) => comoHorario((configSistema().lembretes || {})[id]);
  const dentroDoHorario = (hor, h) => hor.de === hor.ate || (hor.de < hor.ate ? h >= hor.de && h < hor.ate : h >= hor.de || h < hor.ate);
  const textoHorario = (hor) => (hor.de === hor.ate ? 'o dia todo' : `das ${pad2(hor.de)}h às ${pad2(hor.ate)}h`);
  function horaPendente() {
    const hor = cfg.papel ? horarioLembrete(cfg.papel) : null;
    if (!hor || ehCentral() || !setorPorId(cfg.papel) || !operadorAtual()) return null;
    const h = new Date().getHours();
    if (!dentroDoHorario(hor, h)) return null; // fora do horário de trabalho do setor
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
        if (!b || modalAberto()) return;
        // "Anotar agora": o apito para e a faixa some até a próxima hora
        if (lembrete.apito) clearInterval(lembrete.apito);
        Object.assign(lembrete, { atendido: true, apito: null });
        el.hidden = true;
        ir({ tela: 'prancheta', pid: b.dataset.pid, chave: Number(b.dataset.h) });
      });
      document.body.appendChild(el);
    }
    if (!p) { el.hidden = true; return; }
    const nomes = p.falta.map((pid) => prancheta(pid).nome).join(' e ');
    el.hidden = false;
    el.classList.toggle('urgente', !!urgente);
    el.innerHTML = `${ico(urgente ? 'alerta' : 'relogio')}<span><b>${urgente ? 'Ainda falta a leitura' : 'Hora de anotar a leitura'} das ${pad2(p.h)}:00</b> ${esc(nomes)}</span>
      <button class="btn" data-pid="${p.falta[0]}" data-h="${p.h}">Anotar agora</button>`;
  }
  function verificarLembrete() {
    const p = horaPendente();
    if (!p || lembrete.id !== p.id) { if (lembrete.apito) clearInterval(lembrete.apito); lembrete = { id: p ? p.id : null, avisou: false, apito: null }; }
    if (!p || lembrete.atendido) return faixaLembrete(null);
    const urgente = lembreteUrgente || new Date().getMinutes() >= 30;
    faixaLembrete(p, urgente);
    if (!lembrete.avisou) { lembrete.avisou = true; apitoTranquilo(); }
    if (urgente && !lembrete.apito) { apitoChato(); lembrete.apito = setInterval(apitoChato, 2500); }
  }
  /** Linha do lembrete nas Configurações da usina: liga e desliga, e o horário de trabalho do setor. */
  function linhaLembrete(s) {
    const hor = horarioLembrete(s.id);
    return `<div class="linha-config lembrete-config"><div><b>Lembrete de anotar a cada hora</b><small>Apito tranquilo na virada da hora. Às :30, se a linha ainda estiver vazia, apito chato até anotar ou tocar em Anotar agora. Fora do horário do setor não toca.</small></div>
      <span class="lembrete-controles"><button class="interruptor ${hor ? 'ligado' : ''}" data-a="lembrete-liga" data-id="${s.id}" aria-label="Lembrete da ${esc(s.nome)}"><i></i><span>${hor ? 'Ligado' : 'Desligado'}</span></button>
      ${hor ? `<button class="btn" data-a="lembrete-horario" data-id="${s.id}" aria-label="Horário do lembrete: ${textoHorario(hor)}">${ico('relogio')} ${hor.de === hor.ate ? 'O dia todo' : `${pad2(hor.de)}h às ${pad2(hor.ate)}h`}</button>` : ''}</span></div>`;
  }
  /** Turnos do setor nas Configurações da usina (2.13.4): os 3 de sempre ou 2 de 12 horas. */
  function linhaTurnos(s) {
    const doze = turnosDoSetor(s.id) === C.turnos12h;
    const opcao = (modelo, sel, texto) => `<button class="chip-liga ${sel ? 'sel' : ''}" data-a="turnos-setor" data-id="${s.id}" data-modelo="${modelo}">${sel ? ico('certo') : ico('relogio')} ${texto}</button>`;
    return `<div class="linha-config turnos-config"><div><b>Turnos</b><small>${turnosDoSetor(s.id).map((t) => `${t.nome}: ${faixaTurno(t)}`).join(' · ')}</small></div>
      <span class="lembrete-controles">${opcao('padrao', !doze, '3 turnos')}${opcao('12h', doze, '2 de 12 horas')}</span></div>`;
  }
  async function mudarTurnosDoSetor(id, doze) {
    if ((turnosDoSetor(id) === C.turnos12h) === doze || !C.turnos12h) return;
    const lista = doze ? C.turnos12h : C.turnos;
    if (!(await confirmar(doze ? 'Usar 2 turnos de 12 horas?' : 'Voltar para os 3 turnos?', `${(setorPorId(id) || {}).nome}: ${lista.map((t) => `${t.nome} das ${faixaTurno(t)}`).join(', ')}. Vale a partir de agora, inclusive na folha de hoje; quem estiver anotando escolhe o nome de novo se o turno mudar.`, 'Mudar'))) return;
    const m = Object.assign({}, configSistema().turnosSetor || {});
    if (doze) m[id] = '12h'; else delete m[id];
    salvarConfigSistema({ turnosSetor: m });
    render();
  }
  async function escolherHorarioLembrete(id) {
    const hor = horarioLembrete(id) || { de: 7, ate: 7 };
    const horas = (sel) => Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === sel ? 'selected' : ''}>${pad2(h)}h</option>`).join('');
    const resp = await abrirModal(`<h3>Horário do lembrete</h3><p class="dica">${esc((setorPorId(id) || {}).nome || id)}</p>
      <p class="sub">O lembrete só toca dentro deste horário. Com os dois iguais (07h e 07h), toca o dia todo; de 19h às 07h, toca à noite.</p>
      <div class="linha-horario"><label>Das <select id="lh-de">${horas(hor.de)}</select></label><label>às <select id="lh-ate">${horas(hor.ate)}</select></label></div>
      <div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn primario" data-k="ok">Salvar</button></div>`,
    (k, b, fechar, f) => { if (k === 'x') fechar(null); else if (k === 'ok') fechar({ de: Number(f.querySelector('#lh-de').value), ate: Number(f.querySelector('#lh-ate').value) }); });
    if (!resp) return;
    salvarConfigSistema({ lembretes: Object.assign({}, configSistema().lembretes || {}, { [id]: resp }) });
    render();
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
