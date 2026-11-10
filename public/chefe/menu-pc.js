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
    // 3.1.8: Pessoas e Aparelhos ficam dentro de Configurações; no menu só para quem não abre Configurações
    const config = FUNCOES_DA_USINA.some(veNoChefe);
    const administrar = [quem && quem.dono ? item('sala', 'servidor', 'Sala de controle', naTela('sala')) : '',
      !config && (veNoChefe('chefes') || veNoChefe('conexao')) ? item('aparelhos', 'wifi', 'Aparelhos', naTela('aparelhos')) : '',
      !config && veNoChefe('pessoas') ? item('pessoas', 'pessoas', 'Pessoas', naTela('pessoas')) : '',
      veNoChefe('registro') ? item('registro', 'nota', 'Registro', naTela('registro')) : '',
      config ? item('config', 'ajustes', 'Configurações', naTela('config', 'folhas', 'pessoas', 'aparelhos')) : ''].join('');
    // 3.1.7: rastreamento e etiqueta abrem de dentro da Produção (coluna da direita): um item só para o escritório
    return `<nav class="menu-pc" aria-label="Menu do painel">
      <div class="menu-marca"><img src="icons/logo-u.svg" alt=""><div><b>Pranchetas</b><small>${soVer() ? 'Painel pela nuvem' : 'Painel do escritório'}</small></div></div>
      ${item('abrir-painel', 'casa', 'Visão geral', naTela('central'))}
      ${veNoChefe('corrigir') || veNoChefe('relatorios') ? `<p class="menu-titulo">Setores</p>
        ${setores().map((s) => item('abrir-setor', s.icone, esc(s.nome), setorAberto === s.id, `data-id="${s.id}"`)).join('')}` : ''}
      <p class="menu-titulo">Acompanhar</p>
      ${veNoChefe('escritorio') ? item('esc-abrir', 'grafico', 'Produção e rastreio', naTela('esc-calculos', 'esc-rastreamento', 'escritorio'), `data-t="esc-calculos" data-dia="${diaDoEscritorio(view().data)}"`) : ''}
      ${veNoChefe('relatorios') ? item('graficos', 'grafico', 'Gráficos', naTela('graficos')) : ''}
      ${veNoChefe('relatorios') ? item('relatorios', 'pasta', 'Relatórios', naTela('relatorios')) : ''}
      ${veNoChefe('avisos') && !soVer() ? item('avisos', 'sino', `Avisos${abertos ? ` <em class="contador">${abertos}</em>` : ''}`, naTela('avisos')) : ''}
      ${veNoChefe('ler_folha') && lerFolhaLigada() ? item('ler-folha', 'camera', 'Ler folha', naTela('leitura')) : ''}
      ${soVer() || !administrar ? '' : `<p class="menu-titulo">Administrar</p>${administrar}`}
      <button class="menu-pe botao" data-a="pessoa" aria-label="${quem ? 'Entrar com outra pessoa' : 'Entrar com a sua senha'}">${quem ? `<b>${esc(quem.nome)}</b><small>${soVer() ? 'pela nuvem · só ver' : cfg.soNuvem ? 'pelo banco' : 'neste turno'}</small>` : '<small>Ninguém entrou</small>'}</button>
    </nav>`;
  }
