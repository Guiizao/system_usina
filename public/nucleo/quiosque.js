/* Pranchetas Ubirálcool - tela cheia e tela acesa
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

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
