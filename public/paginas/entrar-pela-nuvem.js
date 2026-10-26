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
  // 2.17: entra escolhendo o nome (a lista vem da nuvem) e digitando a senha; o endereço fica na aba Servidor
  const nuvemForm = { url: '', pessoas: null, erro: '', buscando: false };

  /** Os nomes de quem pode entrar pela nuvem (só id e nome). Sem achar a nuvem, a tela diz por quê. */
  async function carregarNomesDaNuvem() {
    const url = nuvemForm.url.replace(/\/+$/, '');
    nuvemForm.buscando = true; nuvemForm.erro = '';
    try {
      if (!enderecoNuvemSeguro(url)) throw new Error('endereço');
      const r = await fetch(url + '/aparelho/pessoas', { cache: 'no-store', redirect: 'error' });
      const d = await r.json();
      if (!r.ok || !Array.isArray(d.pessoas)) throw new Error('resposta');
      nuvemForm.pessoas = d.pessoas;
    } catch (e) {
      nuvemForm.pessoas = null;
      nuvemForm.erro = enderecoNuvemSeguro(url) ? 'Sem internet: não achei a nuvem.' : 'Confira o endereço do servidor (começa com https://).';
    }
    nuvemForm.buscando = false;
    if (view().tela === 'nuvem-entrar') render(true);
  }

  function telaNuvemEntrar() {
    if (!nuvemForm.url) nuvemForm.url = cfg.nuvemUrl || C.nuvemPadrao || '';
    if (!nuvemForm.pessoas && !nuvemForm.erro && !nuvemForm.buscando) carregarNomesDaNuvem();
    alvos = []; ed.alvoId = null;
    const lista = nuvemForm.pessoas || [], sem = !lista.length;
    const vazio = nuvemForm.buscando ? 'Buscando os nomes…' : nuvemForm.erro || 'Ninguém entra pela nuvem ainda';
    return `${cabecalho('Pranchetas digitais', 'Painel pela nuvem', false)}
      <main class="tela-entrar-nuvem"><form class="entrar-cartao" data-form="nuvem-entrar">
        <div class="entrar-topo"><img class="entrar-logo" src="icons/logo.png" alt="">
          <button type="button" class="btn pequeno" data-a="nuvem-servidor">${ico('servidor')} Servidor</button></div>
        <h1>Entrar</h1>
        <p class="sub">Painel da usina pela nuvem, com a mesma senha do tablet chefe.</p>
        <label>Nome<select id="nuvem-nome" ${sem ? 'disabled' : ''}>${sem ? `<option>${esc(vazio)}</option>`
          : `<option value="">Escolha o seu nome</option>${lista.map((p) => `<option value="${esc(p.id)}" ${p.id === cfg.ultimaPessoaNuvem ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}`}</select></label>
        ${nuvemForm.erro ? `<p class="aviso-entrar">${ico('alerta')} <span>${esc(nuvemForm.erro)}</span> <button type="button" class="btn pequeno" data-a="nuvem-nomes">Tentar de novo</button></p>` : ''}
        <label>Senha<input id="nuvem-senha" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password" ${sem ? 'disabled' : ''}></label>
        <button class="btn primario largo" type="submit" ${sem ? 'disabled' : ''}>${ico('cadeado')} Entrar</button>
        ${params.get('nuvem') ? '' : `<button type="button" class="btn largo" data-a="voltar-conectar">${ico('wifi')} Conectar na rede da usina</button>`}
        <p class="sub">Pela nuvem você vê o painel, os relatórios e o escritório; corrigir as folhas continua no tablet chefe.</p>
      </form>
      <p class="autoria">Pranchetas Digitais ${VERSAO} · ${esc(AUTORIA)}</p></main>`;
  }
  /** Aba Servidor: o endereço da nuvem (já vem preenchido; só muda se o Guilherme pedir). */
  async function servidorDaNuvem() {
    const url = await textoLivre({ titulo: 'Servidor (nuvem)', dica: 'Já vem preenchido. Só mude se o responsável pelo sistema pedir.', valor: nuvemForm.url, tipo: 'url', max: 300 });
    if (url === undefined || !url) return;
    nuvemForm.url = url.trim(); nuvemForm.pessoas = null; nuvemForm.erro = '';
    carregarNomesDaNuvem();
  }
  // Enter no campo da senha também entra
  document.addEventListener('submit', (e) => { if (e.target.matches('[data-form="nuvem-entrar"]')) { e.preventDefault(); entrarPelaNuvem(); } });

  async function entrarPelaNuvem() {
    const url = nuvemForm.url.replace(/\/+$/, '');
    // https, ou a nuvem de teste neste mesmo computador (http://127.0.0.1)
    if (!enderecoNuvemSeguro(url)) return toast('Confira o endereço do servidor (começa com https://)', 'erro');
    const pessoa = (document.getElementById('nuvem-nome') || {}).value || '';
    const pin = ((document.getElementById('nuvem-senha') || {}).value || '').trim();
    if (!pessoa) return toast('Escolha o seu nome', 'aviso');
    if (!/^\d{4,8}$/.test(pin)) return toast('A senha tem de 4 a 8 números', 'aviso');
    let r, d = {};
    try {
      r = await fetch(url + '/aparelho/entrar', { method: 'POST', cache: 'no-store', redirect: 'error', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aparelho: cfg.deviceId, pin, pessoa }) });
      d = await r.json().catch(() => ({}));
    } catch (e) { return toast('Sem internet ou endereço errado: não achei a nuvem.', 'erro'); }
    if (r.status === 429) return toast(d.erro || 'Muitas senhas erradas. Espere um pouco e tente de novo.', 'erro');
    if (r.status === 423) return toast('Este aparelho está bloqueado pelo administrador.', 'erro');
    if (!r.ok || !d.token || !d.pessoa) {
      const s = document.getElementById('nuvem-senha'); if (s) { s.value = ''; s.focus(); }
      return toast(r.status === 401 ? 'Senha não confere. Se você acabou de ganhar a senha, entre uma vez no tablet chefe.' : (d.erro || 'A nuvem recusou a entrada'), 'erro');
    }
    const funcoes = (d.pessoa.funcoes || []).filter((f) => FUNCOES_NA_NUVEM.includes(f));
    Object.assign(cfg, {
      soNuvem: true, nuvemUrl: url, nuvemToken: d.token, papel: 'central', chave: null, demo: false,
      pessoa: Object.assign({}, d.pessoa, { funcoes }), pessoaTurno: turnoDaPessoa(),
      nuvemSeq: null, nuvemOrdem: 0, geracao: d.geracao || cfg.geracao || '', ultimaPessoaNuvem: pessoa,
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
