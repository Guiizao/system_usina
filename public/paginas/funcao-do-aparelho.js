/* Pranchetas Ubirálcool - tela da função do aparelho
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Tela: onde este aparelho vai ficar
   * ========================================================= */
  function cartaoPapel(id, icone, nome, detalhe, atual) {
    return `<button class="papel-cartao ${atual ? 'sel' : ''}" data-a="papel" data-id="${id}">
      <span class="escolha-ico">${ico(icone)}</span><b>${esc(nome)}</b><small>${esc(detalhe)}</small>${atual ? `<em>${ico('certo')} Este aparelho</em>` : ''}</button>`;
  }
  const nomeDoChefe = () => (pluginCentral ? 'Tablet chefe' : 'Painel do escritório');
  /** Nome que vai nas anotações. No tablet chefe (que não escolhe operador) vai o nome dele. */
  const quemAnota = () => operadorAtual() || (ehCentral() ? (pessoaAtual() || {}).nome || nomeDoChefe() : null);
  const ehDoChefe = (nome) => nome === 'escritório' || nome === 'Tablet chefe' || nome === 'Painel do escritório';
  /** Folha que só o tablet chefe anota (área Vinho e Fermentação): lá o chefe tem os mesmos botões que o tablet do setor teria. */
  const soDoChefe = (pid) => !!(setorDaPrancheta(pid) || {}).soChefe;
  const anotaComoSetor = (pid) => !ehCentral() || soDoChefe(pid);
  const detalheDoChefe = () => 'Acompanha todos os setores, manda avisos e relatórios';
  function gradePapeis() {
    return `<div class="papeis">
      ${todosSetores.filter((s) => !s.soChefe).map((s) => cartaoPapel(s.id, s.icone, s.nome, pranchetasDo(s.id).map((pid) => prancheta(pid).nome).join(', '), cfg.papel === s.id)).join('')}
      ${cartaoPapel('central', 'escritorio', nomeDoChefe(), detalheDoChefe(), ehCentral())}
    </div>`;
  }
  function telaConfigurar() {
    return `${topo('Pranchetas digitais', 'Configuração do aparelho', false)}
      <main><div class="boas-vindas">
        <header><div><h1>Onde este aparelho vai ficar?</h1><p>Toque no setor. Depois só o encarregado muda, com a senha.</p></div></header>
        ${gradePapeis()}
      </div></main>`;
  }

  function telaOperador(v) {
    const s = setorPorId(cfg.papel);
    const t = turnoAtual();
    return `${topo('Quem está trabalhando?', s.nome, !!operadorAtual())}
      <main>
        <h2>${esc(t.nome)}, das ${faixaTurno(t)}</h2>
        ${v && v.travado
          ? `<p class="sub"><span class="aviso atencao">${ico('alerta')} O tablet ficou ${Math.round(C.minutosSemMexer)} minutos sem ninguém mexer. Toque no seu nome e digite a senha para continuar. O que já estava anotado foi salvo.</span></p>`
          : '<p class="sub">Toque no seu nome. Ele vai como responsável em tudo que você anotar neste turno.</p>'}
        <div class="opcoes nomes">${operadoresDo(cfg.papel).map((o) => `<button data-a="escolher-operador" data-nome="${esc(o.nome)}" class="${o.nome === operadorAtual() ? 'sel' : ''}">${ico('pessoa')}<span class="nome-op"><b>${esc(o.nome)}</b>${o.senha ? '' : '<small class="sem-senha">sem senha</small>'}</span></button>`).join('')}</div>
        <p class="sub" style="margin-top:24px">Cada um entra com a sua senha de 4 números. Esqueceu? Chame o encarregado. Nome novo, também é com ele.</p>
      </main>`;
  }
