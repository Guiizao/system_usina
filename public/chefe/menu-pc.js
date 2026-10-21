/* Pranchetas Ubirálcool - computador: painel administrativo com menu fixo
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Computador (2.16, pedido do Guilherme): o tablet chefe no computador não é a tela do tablet maior; é um painel
   * administrativo, com o menu fixo à esquerda (as seções e os setores), a escala de computador e a barra de cima
   * enxuta. As funções são as mesmas; o menu mostra só o que a pessoa pode usar. O estilo fica em chefe/menu-pc.css.
   * ========================================================= */
  const TELAS_SEM_MENU = ['conectar', 'preparando', 'configurar', 'bloqueado-adm', 'nuvem-entrar'];
  const comMenuPc = () => document.documentElement.dataset.pc === '1' && ehCentral() && !!(cfg.chave || cfg.demo || cfg.soNuvem)
    && !TELAS_SEM_MENU.includes(view().tela);

  function menuPc(v) {
    const naTela = (...telas) => telas.includes(v.tela);
    const setorAberto = v.tela === 'prancheta' && v.pid ? (setorDaPrancheta(v.pid) || {}).id : '';
    const item = (a, icone, texto, ativo, extra = '') => `<button class="menu-item ${ativo ? 'ativo' : ''}" data-a="${a}" ${extra}>${ico(icone)}<span>${texto}</span></button>`;
    const abertos = veNoChefe('avisos') ? avisosEmAberto().length : 0;
    const quem = pessoaAtual();
    return `<nav class="menu-pc" aria-label="Menu do painel">
      <div class="menu-marca"><img src="icons/logo.png" alt=""><div><b>Pranchetas</b><small>${cfg.soNuvem ? 'Painel pela nuvem' : 'Painel do escritório'}</small></div></div>
      ${item('abrir-painel', 'casa', 'Visão geral', naTela('central'))}
      ${veNoChefe('corrigir') || veNoChefe('relatorios') ? `<p class="menu-titulo">Setores</p>
        ${setores().map((s) => item('abrir-setor', s.icone, esc(s.nome), setorAberto === s.id, `data-id="${s.id}"`)).join('')}` : ''}
      <p class="menu-titulo">Acompanhar</p>
      ${veNoChefe('relatorios') ? item('graficos', 'grafico', 'Gráficos', naTela('graficos')) : ''}
      ${veNoChefe('relatorios') ? item('relatorios', 'pasta', 'Relatórios', naTela('relatorios')) : ''}
      ${veNoChefe('escritorio') ? item('esc-abrir', 'escritorio', 'Escritório', naTela('escritorio', 'esc-calculos', 'esc-rastreamento'), `data-t="escritorio" data-dia="${diaFechado()}"`) : ''}
      ${veNoChefe('avisos') && !cfg.soNuvem ? item('avisos', 'sino', `Avisos${abertos ? ` <em class="contador">${abertos}</em>` : ''}`, naTela('avisos')) : ''}
      ${cfg.soNuvem ? '' : `<p class="menu-titulo">Administrar</p>
        ${item('aparelhos', 'wifi', 'Aparelhos', naTela('aparelhos'))}
        ${veNoChefe('pessoas') ? item('pessoas', 'pessoas', 'Pessoas', naTela('pessoas')) : ''}
        ${veNoChefe('registro') ? item('registro', 'nota', 'Registro', naTela('registro')) : ''}
        ${FUNCOES_DA_USINA.some(veNoChefe) ? item('config', 'ajustes', 'Usina', naTela('config', 'folhas')) : ''}`}
      <div class="menu-pe">${quem ? `<b>${esc(quem.nome)}</b><small>${cfg.soNuvem ? 'pela nuvem · só ver' : 'neste turno'}</small>` : '<small>Ninguém entrou</small>'}</div>
    </nav>`;
  }
