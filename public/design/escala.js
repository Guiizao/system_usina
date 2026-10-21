/* Pranchetas Ubirálcool - escala da tela (todos os aparelhos com a mesma cara)
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

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
    // computador (o ponteiro principal é o mouse), versão 2.15: sem aumentar; a tela grande mostra mais coisa em vez de
    // tudo maior. Tablet e celular dizem ponteiro grosso e sem hover (o notebook com tela de toque conta como computador)
    const pc = !celular && window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
    document.documentElement.dataset.pc = pc ? '1' : '';
    // 2.16: no computador, escala de painel administrativo (tudo menor, mais coisa na tela)
    let z = celular ? 0.94 : pc ? 0.9 : Math.max(1, Math.min(w >= h ? Math.min(w / 1100, h / 690) : Math.min(w / 690, h / 1100), 1.8));
    z *= { menor: 0.88, normal: 1, maior: 1.14 }[cfg.escala] || 1;
    z = Math.round(z * 100) / 100;
    document.documentElement.style.setProperty('--escala', z);
    document.documentElement.dataset.escala = cfg.escala || 'normal';
    document.body.style.zoom = z;
  }
  window.addEventListener('resize', () => { ajustarEscala(); rolarDepois = true; arrumarQuadros(); agendarCaber(); });
