/* Pranchetas Ubirálcool - aparelhos e bloqueio
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

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
    if (!agora && Date.now() - ultimaConsultaNuvem < 110000) return;
    ultimaConsultaNuvem = Date.now();
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(`${cfg.nuvemUrl.replace(/\/+$/, '')}/aparelho/${encodeURIComponent(cfg.deviceId)}`, { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(t);
      marcarNuvem(r.status < 500);
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
    } catch (e) { marcarNuvem(false); /* sem internet: confere de novo depois */ }
  }
  /* Luzes do botão Conexão (versão 2.13.5): a central e a nuvem. O aplicativo funciona com as duas desligadas:
     tudo fica guardado aqui e vai sozinho quando uma delas voltar. */
  function marcarNuvem(ok) {
    sync.nuvem = { ok, em: ok ? Date.now() : (sync.nuvem && sync.nuvem.em) || 0 };
    atualizarConexao();
  }
  const centralLigada = () => sync.modo === 'online';
  const nuvemLigada = () => !!(sync.nuvem && sync.nuvem.ok);
  // sem a central, a nuvem só leva as anotações depois que o aparelho pegou a chave dela com a central (2.13)
  const nuvemLeva = () => !centralLigada() && nuvemLigada() && !!cfg.nuvemToken;
  const faltamNaNuvem = () => Object.values(registros).filter((r) => !r.sincronizado && !r.esperaEntrar && r.naNuvem !== r.atualizadoEm).length;
  function luzesConexao() {
    const c = cfg.demo ? '' : centralLigada() ? 'ok' : 'off';
    const n = cfg.demo || !cfg.nuvemUrl ? '' : nuvemLigada() ? 'ok' : 'off';
    return `<b class="luzes" aria-hidden="true"><i class="${c}"></i><i class="${n}"></i></b><span>Conexão</span>`;
  }
  function verConexao() {
    const desde = (ms) => (ms ? `último contato ${dataHora(ms)}` : 'ainda sem contato');
    const c = centralLigada(), n = nuvemLigada(), p = pendentes();
    const linha = (ok, nome, det) => `<div class="status-linha ${ok ? 'ok' : 'off'}"><i></i><div><b>${nome}: ${ok ? 'ligada' : 'desligada'}</b><small>${esc(det)}</small></div></div>`;
    abrirModal(`<h3>Conexão deste aparelho</h3>
      <div class="status-linhas">
        ${linha(c, 'Central', cfg.demo ? 'demonstração' : desde(cfg.ultimoContato))}
        ${cfg.nuvemUrl ? linha(n, 'Nuvem (internet)', desde(sync.nuvem && sync.nuvem.em)) : '<div class="status-linha"><i></i><div><b>Nuvem (internet): sem endereço</b><small>Ligue este aparelho uma vez no Wi-Fi da central para ele receber o endereço da nuvem.</small></div></div>'}
      </div>
      <p class="dica">${p ? `${contar(p, 'anotação esperando', 'anotações esperando')} a central${nuvemLeva() ? `; ${contar(faltamNaNuvem(), 'falta', 'faltam')} subir para a nuvem` : ''}.` : 'Nenhuma anotação esperando.'} Pode anotar com as duas desligadas: fica guardado aqui e vai sozinho quando uma delas voltar.</p>
      <div class="acoes-modal"><button class="btn" data-k="conferir">Conferir agora</button><button class="btn primario" data-k="ok">Entendi</button></div>`,
    (k, b, fechar) => { if (k === 'conferir') { sincronizar(); conferirNaNuvem(true); toast('Conferindo...'); } fechar(); });
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
