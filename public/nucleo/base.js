/* Pranchetas Ubirálcool - constantes, memória do aparelho e configuração
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  const C = window.USINA;
  const VERSAO = '2.16.0'; // aparece nos ajustes e vai junto com cada envio para a central
  const AUTORIA = '© 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor.';
  const params = new URLSearchParams(location.search);
  const DEMO_IMG = params.has('demo'); // usado só para gerar imagens de apresentação
  const NO_APK = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());


  /* =========================================================
   * Armazenamento local
   * ========================================================= */
  const LS = {
    get(k, padrao) { try { const v = localStorage.getItem('usina.' + k); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; } },
    set(k, v) { try { localStorage.setItem('usina.' + k, JSON.stringify(v)); } catch (e) { toast('A memória do aparelho está cheia. Chame o encarregado.', 'erro'); } },
  };
  const cfg = Object.assign({
    papel: null,          // id do setor ou 'central'
    deviceId: 'ap-' + Math.random().toString(36).slice(2, 8),
    op: null,             // { nome, chave } operador do turno
    operadores: {},       // nomes cadastrados neste aparelho (quando não há central)
    tema: 'claro',        // claro ou escuro, escolhido no botão do topo
    escala: 'normal',     // menor, normal ou maior (tamanho da tela)
    telaCheia: false,     // esconde a barra de bateria e hora do Android (liga nos ajustes do aparelho)
    central: '',          // endereço da central (vazio = o próprio site)
    chave: null,          // chave deste aparelho, recebida ao conectar na central (tudo vai embaralhado com ela)
    demo: false,          // modo demonstração, sem central
    ultimoContato: 0,
    ultimoSeq: 0,
  }, DEMO_IMG ? {} : LS.get('cfg', {}));
  const salvarCfg = () => { if (!DEMO_IMG) LS.set('cfg', cfg); };
  if (DEMO_IMG) cfg.demo = true;
  /* Até a versão 2.4 o aparelho guardava a chave da rede, que passava aberta no Wi-Fi.
     Agora cada aparelho usa a sua, tirada da chave da rede (public/cifra.js). */
  const usarChaveDaRede = (chaveRede) => { cfg.chave = Cifra.chaveDoAparelho(chaveRede, cfg.deviceId); cfg.cifra = 1; };
  if (cfg.chave && !cfg.cifra) usarChaveDaRede(cfg.chave);
  salvarCfg();

  let registros = DEMO_IMG ? {} : LS.get('registros', {});
  // toda mudança nas anotações passa por aqui (grava na memória do aparelho e avisa o índice abaixo)
  let versaoRegistros = 0;
  const salvarRegistros = () => { versaoRegistros++; if (!DEMO_IMG) LS.set('registros', registros); };

  /* Erros inesperados ficam guardados e vão para a central na próxima sincronização
     (pasta ServidorUsina, arquivo erros.log). Assim dá para descobrir o que aconteceu num tablet da área. */
  const errosGuardados = DEMO_IMG ? [] : LS.get('erros', []);
  function guardarErro(msg, detalhe) {
    try {
      if (errosGuardados.length >= 30) errosGuardados.shift();
      const tela = typeof pilha !== 'undefined' && pilha.length ? pilha[pilha.length - 1].tela : '';
      errosGuardados.push({ quando: Date.now(), versao: VERSAO, papel: cfg.papel, tela, msg: String(msg || '').slice(0, 300), detalhe: String(detalhe || '').slice(0, 900) });
      if (!DEMO_IMG) LS.set('erros', errosGuardados);
    } catch (e) { /* nunca deixa um erro no registro de erros travar o app */ }
  }
  window.addEventListener('error', (e) => guardarErro(e.message, `${e.filename || ''}:${e.lineno || ''}:${e.colno || ''} ${e.error && e.error.stack ? e.error.stack : ''}`));
  window.addEventListener('unhandledrejection', (e) => guardarErro('promessa: ' + (e.reason && e.reason.message ? e.reason.message : e.reason), e.reason && e.reason.stack));
