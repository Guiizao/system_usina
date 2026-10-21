/* Pranchetas Ubirálcool - relógio, virada do dia e do turno
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Relógio: troca de folha às 07:00 e de turno
   * ========================================================= */
  /** Todo dia, pouco depois das 07:00, o tablet chefe guarda o Excel e o XML do dia que fechou. */
  let fechamentoTentado = 0;
  function fechamentoDoDia(dataHoje) {
    if (!ehCentral() || cfg.demo || !cfg.chave || sync.modo !== 'online') return;
    if (Date.now() - fechamentoTentado < 60000) return; // não deu: tenta de novo daqui a um minuto (até as 07:59)
    const agora = new Date();
    if (agora.getHours() !== C.inicioDoDia || agora.getMinutes() < 5) return;
    const ontem = somarDias(dataHoje, -1);
    if (cfg.ultimoFechamento === ontem) return;
    cfg.ultimoFechamento = ontem; salvarCfg();
    const todos = setores().map((s) => s.id);
    guardarNaCentral(ontem, [gerarArquivo('xlsx', ontem, todos), gerarArquivo('xml', ontem, todos)])
      .then((ok) => {
        if (ok) return toast(`Folha de ${fmtData(ontem)} guardada em RelatoriosUsina`);
        fechamentoTentado = Date.now(); cfg.ultimoFechamento = null; salvarCfg();
      });
  }

  let ultimaData = dataProducao(), ultimoTurno = turnoAtual().id, ultimaHora = new Date().getHours();
  setInterval(() => {
    const rel = document.getElementById('relogio');
    if (rel) rel.textContent = horaAgora();
    const tt = document.getElementById('turno-topo');
    if (tt && tt.textContent !== turnoAtual().nome) tt.textContent = turnoAtual().nome;
    // chegou anotação nova enquanto a pessoa rolava: redesenha quando ela soltar
    if (redesenharDepois && podeRedesenhar()) { redesenharDepois = false; if (['central', 'inicio', 'prancheta', 'config', 'aparelhos'].includes(view().tela)) render(); }
    // hora da linha nova acompanha o relógio até a pessoa mudar
    if (rascunho && rascunho.horaAuto && rascunho.horaAuto.length && view().tela === 'prancheta') {
      let mudou = false;
      rascunho.horaAuto.forEach((id) => {
        if (rascunho.tocados[id] || rascunho.valores[id] === horaAgora()) return;
        rascunho.valores[id] = horaAgora(); rascunho.original[id] = horaAgora(); mudou = true;
      });
      if (mudou) atualizarEdicao();
    }
    const d = dataProducao(), t = turnoAtual().id, h = new Date().getHours();
    fechamentoDoDia(d);
    travarPorInatividade();
    if (d !== ultimaData) {
      if (rascunhoSujo()) salvarRascunho(true);
      ultimaData = d; ultimoTurno = t; ultimaHora = h;
      if (modalAberto()) fecharModalAtual();
      pilha = [telaInicial()]; rascunho = null; ed.alvoId = null;
      if (cfg.papel && !ehCentral() && !ehEscritorio()) pilha.push({ tela: 'operador' });
      if (!DEMO_IMG) podar();
      render(true); toast(`Nova folha começou: ${fmtData(d)}`);
      return;
    }
    if (t !== ultimoTurno) {
      ultimoTurno = t;
      if (cfg.papel && !ehCentral() && !ehEscritorio() && podeRedesenhar()) { pilha = [telaInicial(), { tela: 'operador' }]; rascunho = null; render(true); }
    } else if (h !== ultimaHora && podeRedesenhar() && ['inicio', 'central'].includes(view().tela)) render();
    ultimaHora = h;
  }, 1000);
