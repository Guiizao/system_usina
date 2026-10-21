/* Pranchetas Ubirálcool - ícones de linha
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

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
