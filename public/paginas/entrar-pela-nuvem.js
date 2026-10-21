/* Pranchetas Ubirálcool - entrar pela nuvem (computador e celular fora da usina)
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Entrar pela nuvem (2.16, pedido do Guilherme): o computador do escritório (o programa do Windows) e um celular fora
   * da usina entram com a senha de uma pessoa cadastrada no tablet chefe, sem o IP e sem o código. A nuvem confere a
   * senha (a central manda para ela as pessoas e uma conferência leve da senha, nunca a senha) e devolve o que a pessoa
   * pode fazer. Pela nuvem é só ver: o painel, os relatórios e o escritório; corrigir continua no tablet chefe.
   * As anotações chegam pela sincronização da nuvem que a versão 2.14 já usa (cfg.nuvemUrl e cfg.nuvemToken).
   * ========================================================= */
  const FUNCOES_NA_NUVEM = ['relatorios', 'escritorio'];
  const nuvemForm = { url: '' };

  function telaNuvemEntrar() {
    if (!nuvemForm.url) nuvemForm.url = cfg.nuvemUrl || C.nuvemPadrao || '';
    alvos = [{ id: 'nuvem-url', label: 'Endereço da nuvem', type: 'text', get: () => nuvemForm.url, set: (x) => { nuvemForm.url = x.trim(); } }];
    contextoEdicao = 'entrar pela nuvem';
    const conteudo = `<div class="boas-vindas conectar">
        <header><div><h1>Entrar pela nuvem</h1>
        <p>Use a mesma senha do tablet chefe. Pela nuvem você vê o painel, os relatórios e o escritório; corrigir as folhas continua no tablet chefe.</p></div></header>
        ${grupoQuadros(alvos)}
        <div class="linha-botoes">
          <button class="btn primario" data-a="nuvem-entrar">${ico('cadeado')} Entrar com a minha senha</button>
          ${params.get('nuvem') ? '' : `<button class="btn" data-a="voltar-conectar">${ico('wifi')} Conectar na rede da usina</button>`}
        </div>
        <p class="sub">Depois de atualizar o tablet chefe, cada pessoa entra uma vez nele: é aí que a senha passa a valer pela nuvem.</p>
        <p class="autoria">Pranchetas Digitais ${VERSAO} · ${esc(AUTORIA)}</p>
      </div>`;
    return `${cabecalho('Pranchetas digitais', 'Painel pela nuvem', false)}${telaEdicao(conteudo)}`;
  }

  async function entrarPelaNuvem() {
    const url = nuvemForm.url.replace(/\/+$/, '');
    if (!/^https:\/\/[^\s/]+/.test(url)) return toast('Confira o endereço da nuvem (começa com https://)', 'erro');
    const pin = await pedirSenhaModal('Sua senha', 'A mesma que você usa no tablet chefe.');
    if (!pin) return;
    let r, d = {};
    try {
      r = await fetch(url + '/aparelho/entrar', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aparelho: cfg.deviceId, pin }) });
      d = await r.json().catch(() => ({}));
    } catch (e) { return toast('Sem internet ou endereço errado: não achei a nuvem.', 'erro'); }
    if (r.status === 429) return toast(d.erro || 'Muitas senhas erradas. Espere um pouco e tente de novo.', 'erro');
    if (r.status === 423) return toast('Este aparelho está bloqueado pelo administrador.', 'erro');
    if (!r.ok || !d.token || !d.pessoa) return toast(r.status === 401 ? 'Senha não confere. Se você acabou de ganhar a senha, entre uma vez no tablet chefe.' : (d.erro || 'A nuvem recusou a entrada'), 'erro');
    const funcoes = (d.pessoa.funcoes || []).filter((f) => FUNCOES_NA_NUVEM.includes(f));
    Object.assign(cfg, {
      soNuvem: true, nuvemUrl: url, nuvemToken: d.token, papel: 'central', chave: null, demo: false,
      pessoa: Object.assign({}, d.pessoa, { funcoes }), pessoaTurno: turnoDaPessoa(),
      nuvemSeq: null, nuvemOrdem: 0, geracao: d.geracao || cfg.geracao || '',
    });
    salvarCfg();
    toast(`${d.pessoa.nome} entrou pela nuvem`);
    ed.alvoId = null; pilha = [telaInicial()]; render(true);
    sincronizarNuvem();
  }

  /** Sair pela nuvem: volta para a tela de entrar (o que já chegou continua guardado neste aparelho). */
  function sairDaNuvem() {
    cfg.pessoa = null; cfg.nuvemToken = ''; cfg.soNuvem = true; salvarCfg();
    pilha = [{ tela: 'nuvem-entrar' }]; render(true);
  }
