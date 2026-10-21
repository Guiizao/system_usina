/* Pranchetas Ubirálcool - teclado fixo
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

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
