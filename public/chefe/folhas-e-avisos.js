/* Pranchetas Ubirálcool - folhas e avisos
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

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
    // os turnos de cada setor (2.13.4) vão junto no forms que a central do tablet manda para a API da nuvem
    const ts = configSistema().turnosSetor || {};
    const json = JSON.stringify([f, ts]);
    if (json === folhasAplicadas) return false;
    const primeira = !folhasAplicadas;
    folhasAplicadas = json;
    window.Folhas.aplicar(C, f, ORIGINAIS_FOLHAS);
    C.turnosSetor = ts;
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
