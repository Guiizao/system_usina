/* Pranchetas Ubirálcool - navegação e botão voltar
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Navegação (o botão voltar do Android fica dentro do app)
   * ========================================================= */
  let pilha = [];
  let rascunho = null;
  const rascunhoSujo = () => !!rascunho && (JSON.stringify(rascunho.valores) !== JSON.stringify(rascunho.original) || JSON.stringify(rascunho.extras) !== rascunho.originalExtras);
  const view = () => pilha[pilha.length - 1];
  // enquanto a pessoa arrasta ou rola (tabela do monitoramento, lista), a tela não é redesenhada: senão a rolagem pula
  let dedosNaTela = 0, ultimoToque = 0, ultimaRolagem = 0, redesenharDepois = false;
  document.addEventListener('pointerdown', () => { dedosNaTela += 1; ultimoToque = Date.now(); }, { passive: true, capture: true });
  ['pointerup', 'pointercancel'].forEach((ev) => document.addEventListener(ev, () => { dedosNaTela = Math.max(0, dedosNaTela - 1); ultimaRolagem = Date.now(); }, { passive: true, capture: true }));
  document.addEventListener('scroll', () => { ultimaRolagem = Date.now(); }, { passive: true, capture: true });
  const mexendoNaTela = () => {
    // o Android às vezes não avisa que o dedo saiu: depois de 20 segundos parado, a tela volta a se atualizar
    if (dedosNaTela > 0 && Date.now() - ultimoToque > 20000) dedosNaTela = 0;
    return dedosNaTela > 0 || Date.now() - ultimaRolagem < 1500;
  };
  const podeRedesenhar = () => !modalAberto() && !rascunhoSujo() && !painelVisivel() && !mexendoNaTela();

  function ir(v, substituir = false) {
    if (rascunhoSujo()) salvarRascunho(true);
    if (substituir) pilha[pilha.length - 1] = v; else pilha.push(v);
    rascunho = null; ed.alvoId = null;
    render(true);
  }
  async function voltar() {
    if (modalAberto()) return modalFixo ? undefined : fecharModalAtual();
    if (pilha.length > 1 && view().sujo && !(await confirmar('Sair sem salvar?', 'O que foi mudado nesta tela se perde.', 'Sair sem salvar', true))) return;
    if (painelVisivel()) { ed.oculto = true; return atualizarEdicao(); }
    if (rascunhoSujo()) salvarRascunho(true);
    if (pilha.length > 1) { pilha.pop(); rascunho = null; ed.alvoId = null; render(true); }
  }
  if (!DEMO_IMG) {
    history.pushState({ app: 1 }, '');
    window.addEventListener('popstate', () => { history.pushState({ app: 1 }, ''); voltar(); });
    window.voltarDoAndroid = voltar;
  }
  function telaInicial() {
    if (!cfg.chave && !cfg.demo) return { tela: 'conectar' };
    if (!cfg.papel) return { tela: 'configurar' };
    if (ehCentral()) return { tela: 'central', data: dataProducao() };
    if (ehEscritorio()) return { tela: 'escritorio', data: cfg.demo ? dataProducao() : diaFechado() };
    return { tela: 'inicio' };
  }
