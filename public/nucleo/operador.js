/* Pranchetas Ubirálcool - operador do turno e trava por inatividade
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Operador do turno e trava por inatividade
   * ========================================================= */
  let ultimaAtividade = Date.now();
  const marcarAtividade = () => { ultimaAtividade = Date.now(); };
  document.addEventListener('pointerdown', marcarAtividade, { passive: true });
  document.addEventListener('keydown', marcarAtividade, { passive: true });
  function travarPorInatividade() {
    if (ehEscritorio()) {
      if (cfg.escritorio && Date.now() >= cfg.escritorio.ate) {
        cfg.escritorio = null; salvarCfg();
        if (modalAberto()) fecharModalAtual();
        pilha = [telaInicial()]; render(true); toast('Ficou 10 minutos sem mexer: entre de novo com a senha');
      }
      return;
    }
    if (ehCentral()) {
      if (cfg.pessoa && !cfg.demo) {
        if (cfg.pessoaTurno !== turnoDaPessoa()) sairDoChefe('o turno acabou');
      }
      return;
    }
    if (!cfg.papel || !operadorAtual()) return;
    if (Date.now() - ultimaAtividade < (C.minutosSemMexer || 30) * 60000) return;
    if (modalAberto()) fecharModalAtual();
    if (rascunhoSujo()) salvarRascunho(true);
    registrar('entrada', `${operadorAtual()} saiu do ${nomeDesteAparelho()} (ficou ${C.minutosSemMexer || 30} minutos sem mexer)`);
    cfg.op = null; salvarCfg();
    rascunho = null; ed.alvoId = null;
    pilha = [telaInicial(), { tela: 'operador', travado: true }];
    render();
    marcarAtividade();
  }
  const chaveTurno = () => `${dataProducao()}-${turnoAtual().id}`;
  const operadorAtual = () => (cfg.op && cfg.op.chave === chaveTurno() ? cfg.op.nome : null);
  function definirOperador(nome) {
    const antes = operadorAtual();
    cfg.op = { nome, chave: chaveTurno() }; salvarCfg();
    if (antes !== nome && !cfg.demo && typeof registrar === 'function') registrar('entrada', `${nome} entrou no ${nomeDesteAparelho()}${antes ? ` (no lugar de ${antes})` : ''}`);
  }
