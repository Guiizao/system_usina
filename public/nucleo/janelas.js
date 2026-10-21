/* Pranchetas Ubirálcool - janelas por cima da tela
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

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
    // turnos (2.13.4): com todos os setores no mesmo modelo, cada botão mostra o horário; misturados, só o nome
    const modelosT = [...new Set(todos.map((s) => turnosDoSetor(s.id)))];
    const listaT = modelosT.length === 1 ? modelosT[0] : C.turnos;
    const turnos = new Set(listaT.map((t) => t.id));
    const hoje = dataProducao();
    let modo = 'dia', dia = data || hoje, de = somarDias(dia, -6), ate = dia, somar = true;
    const chip = (k, sel, icone, nome) => `<button data-k="${k}" class="${sel ? 'sel' : ''}">${ico(sel ? 'certo' : icone)}<span>${esc(nome)}</span></button>`;
    const desenhar = (f) => {
      f.querySelector('.setores-envio').innerHTML = todos.map((s) => chip(`s:${s.id}`, marcados.has(s.id), s.icone, s.nome)).join('');
      f.querySelector('.turnos-envio').innerHTML = listaT.map((t) => chip(`t:${t.id}`, turnos.has(t.id), 'relogio', modelosT.length === 1 ? `${t.nome}, ${faixaTurno(t)}` : t.nome)).join('');
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
        return fechar({ formato: k.slice(2), setores: todos.filter((s) => marcados.has(s.id)).map((s) => s.id), turnos: [...turnos], totalTurnos: listaT.length, dias, somar: modo === 'periodo' && somar });
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
    return turnosDoEnvio.has(turnoDaHora(h, turnosDaPrancheta(r.prancheta)).id);
  }
  const listarPapel = (data, pid) => listar(data, pid).filter(noTurnoDoEnvio);
  /** Monta o arquivo (ou o resumo) do que foi escolhido. Vários dias: uma folha de cada dia, na ordem. */
  async function montarEnvio(escolha) {
    for (const d of escolha.dias) await buscarDia(d); // dia antigo: as anotações vêm da central antes
    turnosDoEnvio = escolha.turnos.length < (escolha.totalTurnos || C.turnos.length) ? new Set(escolha.turnos) : null;
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
    const nomesTurnos = escolha.turnos.length < (escolha.totalTurnos || C.turnos.length) ? ` · turnos: ${C.turnos.filter((t) => escolha.turnos.includes(t.id)).map((t) => t.nome).join(', ')}` : '';
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
    turnosDoEnvio = escolha.turnos.length < (escolha.totalTurnos || C.turnos.length) ? new Set(escolha.turnos) : null;
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
