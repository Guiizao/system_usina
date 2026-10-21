/* Pranchetas Ubirálcool - texto que não cabe diminui a letra
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Texto que não cabe: diminui a letra em vez de quebrar a palavra no meio
   * (nome comprido de operador, quadro estreito, botão do celular...)
   * ========================================================= */
  const CABER = [
    '.opcoes.nomes .nome-op b', '.campo .rot', '.campo .val', '.item .texto b', '.setor-cartao .texto b', '.papel-cartao b',
    '.abas button', '.seletor button', '.rodape .btn', '.painel-nav .btn', '.chip', '.topo .titulo b', '.topo .titulo span', '.topo .atalho span',
    '.chips-escolha button span', '.escolhas button b', '.cabecalho-form .aviso', '.cabecalho-form .btn', '.opcoes-painel button',
    '.linha-botoes .btn', '.acoes-modal .btn', '.btn.largo', '.aviso-item-cab b', '.aparelho b', '.data-grande b', '.boas-vindas h1', '.visor',
  ].join(', ');
  const cabe = (el) => {
    // nome do quadro com o selo do lado (aviso ou volume): precisa sobrar um pouco, senão a última letra do selo encosta na borda
    if (el.children.length > 1 && el.matches('.campo .rot')) {
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      const soma = [...el.children].reduce((s, c) => s + c.offsetWidth, 0) + gap * (el.children.length - 1);
      if (soma > el.clientWidth - 2) return false;
    }
    // visor do teclado: o número encosta na direita e o que passa some pela esquerda (o scrollWidth não vê): mede o texto
    if (el.matches('.visor')) {
      const r = document.createRange(); r.selectNodeContents(el);
      const est = getComputedStyle(el);
      const escala = el.offsetWidth ? el.getBoundingClientRect().width / el.offsetWidth : 1; // com o zoom, o texto vem medido na tela
      return r.getBoundingClientRect().width <= (el.clientWidth - parseFloat(est.paddingLeft) - parseFloat(est.paddingRight)) * escala + 1;
    }
    // sem folga na largura: com o zoom da tela, 1 px a mais já corta a última letra ("107,0 °C", "Romenique")
    return el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight + 1;
  };
  function caberTextos(raiz = document, apertado = false) {
    const topo = raiz.classList && raiz.classList.contains('topo') ? raiz : raiz.querySelector('.topo');
    if (topo && !apertado) topo.classList.remove('apertado');
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
    igualarVizinhos(lista);
    // nem com a letra menor o nome da tela coube (o botão Conexão tirou lugar): os botões do alto ficam só com o ícone
    // e o Voltar só com a seta, e o nome é medido de novo. Não coube = passou da largura (aqui sem a folga de 1 px do
    // cabe(): com o zoom, 1 px a mais já corta a última letra), sobrou uma linha escondida (os 2 px da perna do "p"
    // não contam) ou o nome curto quebrou em duas linhas ("Matéria-/prima").
    const nome = topo && topo.querySelector('.titulo b');
    const linhas = (el) => { const r = document.createRange(); r.selectNodeContents(el); return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size; };
    // (o nome que encolheu até sumir também não coube: largura zero com texto dentro)
    const naoCabe = nome && nome.getClientRects().length && (nome.scrollWidth > nome.clientWidth || nome.scrollHeight > nome.clientHeight + 6
      || (!nome.closest('.titulo.longo') && linhas(nome) > 1));
    if (!apertado && naoCabe) { topo.classList.add('apertado'); caberTextos(topo, true); }
  }
  /* 2.16: caixas iguais lado a lado ficam com a mesma letra, a menor delas (um botão da linha não fica com letra maior
     que o vizinho, um nome de quadro não fica maior que o do lado). Cada par: o que iguala e dentro de onde.
     O número do quadro iguala só dentro do bloco (o peso do ralo, que é maior, fica no bloco dele). */
  const VIZINHOS = [
    ['.campo .rot', '.campos'], ['.campo .val:not(.vazio)', '.campos'], ['.linha-botoes .btn', '.linha-botoes'],
    ['.acoes-modal .btn', '.acoes-modal'], ['.abas button', '.abas'], ['.seletor button', '.seletor'], ['.rodape .btn', '.rodape'],
    ['.painel-nav .btn', '.painel-nav'], ['.item .texto b', 'main'], ['.setor-cartao .texto b', 'main'], ['.papel-cartao b', 'main'],
    ['.escolhas button b', '.escolhas'], ['.chips-escolha button span', '.chips-escolha'], ['.opcoes-painel button', '.opcoes-painel'],
    ['.opcoes.nomes .nome-op b', '.opcoes'], ['.topo .atalho span', '.topo'], ['.chip', '.chips, .linha-chips'],
  ];
  function igualarVizinhos(lista) {
    VIZINHOS.forEach(([sel, dentro]) => {
      const caixas = new Set(lista.filter((el) => el.matches(sel)).map((el) => el.closest(dentro) || el.parentElement));
      caixas.forEach((caixa) => igualarGrupo(caixa, sel));
    });
  }
  function igualarGrupo(caixa, sel) {
    // junto com os que não foram medidos agora (ao teclar só o quadro é medido; os vizinhos guardam a letra de antes)
    const grupo = [...caixa.querySelectorAll(sel)].filter((x) => x.clientWidth > 0);
    if (grupo.length < 2 || !grupo.some((x) => x.style.fontSize)) return;
    const tam = grupo.map((x) => parseFloat(getComputedStyle(x).fontSize));
    const menor = Math.min(...tam);
    grupo.forEach((x, i) => { if (tam[i] > menor + 0.05) x.style.fontSize = menor.toFixed(1) + 'px'; });
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
