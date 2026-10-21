/* Pranchetas Ubirálcool - partes comuns das telas
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Partes comuns
   * ========================================================= */
  const topo = (titulo, subtitulo, podeVoltar, atalhos) => cabecalho(titulo, subtitulo, podeVoltar, atalhos) + faixa();
  /** Barra de cima. Leva título, atalhos, relógio e, no canto, os ajustes e o botão claro/escuro. */
  function cabecalho(titulo, subtitulo, podeVoltar, atalhos) {
    const escuro = cfg.tema === 'escuro';
    const configurado = cfg.papel && (cfg.chave || cfg.demo);
    return `<header class="topo">
        ${podeVoltar ? `<button class="voltar" data-a="voltar">${ico('voltar')}<span>Voltar</span></button>` : '<img class="logo" src="icons/logo.png" alt="Ubirálcool">'}
        <div class="titulo ${String(titulo).length > 17 ? 'longo' : ''}"><div class="titulo-linha"><b>${esc(titulo)}</b><em class="turno-topo" id="turno-topo">${esc(turnoAtual().nome)}</em></div>${subtitulo ? `<span id="subtitulo-topo">${esc(subtitulo)}</span>` : ''}</div>
        ${atalhos ? `<div class="atalhos">${atalhos}</div>` : ''}
        <div class="relogio"><b id="relogio">${horaAgora()}</b></div>
        ${atualizacao.nova ? `<button class="tema atualizar" data-a="atualizacao" aria-label="Atualizar o aplicativo para a versão ${esc(atualizacao.nova.versao)}">${ico('instalar')}<span>Atualizar</span></button>` : ''}
        ${configurado ? `<button class="tema status-con" id="status-con" data-a="status-con" aria-label="Conexão: central e nuvem">${luzesConexao()}</button>` : ''}
        ${configurado && (view() || {}).tela !== 'admin' ? `<button class="tema" data-a="admin" aria-label="Ajustes do aparelho">${ico('ajustes')}<span>Ajustes</span></button>` : ''}
        <button class="tema" data-a="tema" aria-label="${escuro ? 'Mudar para tela clara' : 'Mudar para tela escura'}">${ico(escuro ? 'sol' : 'lua')}<span>${escuro ? 'Claro' : 'Escuro'}</span></button>
      </header>`;
  }
  function atalhosOperador() {
    const op = operadorAtual();
    const v = view();
    const p = ehCentral() ? pessoaAtual() : null;
    return `${!ehCentral() ? `<button class="atalho ${op ? '' : 'alerta'}" data-a="trocar-operador">${ico('pessoa')}<span>${esc(op || 'Seu nome')}</span></button>`
      : `<button class="atalho pessoa-chefe ${p ? '' : 'alerta'}" data-a="pessoa" aria-label="${p ? `${esc(p.nome)}: toque para sair` : 'Entrar com a sua senha'}">${ico('pessoa')}<span>${esc(p ? p.nome : 'Entrar')}</span></button>`}
      ${v && v.tela === 'prancheta' && !soConsulta() ? `<button class="atalho ${v.monitor ? 'sel' : ''}" data-a="monitor">${ico('planilha')}<span>${v.monitor ? 'Anotar' : 'Monitorar'}</span></button>` : ''}`;
  }
  function aplicarTema() {
    document.documentElement.dataset.tema = cfg.tema === 'escuro' ? 'escuro' : 'claro';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', cfg.tema === 'escuro' ? '#0d0f10' : '#2e3431');
  }
  function faixa() {
    const op = operadorAtual();
    const configurado = cfg.papel && (cfg.chave || cfg.demo);
    if (!configurado || ehCentral()) return '';
    const escolhendo = (view() || {}).tela === 'operador'; // já está na tela de escolher o nome: não repete o botão
    return `<div class="faixa">
        <span class="data">Folha de ${fmtData(dataProducao())}</span>
        <span id="conexao" class="conexao ${classeConexao()}"><i></i>${esc(textoConexao())}</span>
        <span class="espaco"></span>
        ${escolhendo ? '' : `<button class="chip ${op ? '' : 'alerta'}" data-a="trocar-operador">${ico('pessoa')} ${op ? `Operador: <b>${esc(op)}</b>` : 'Toque aqui e escolha seu nome'}</button>`}
      </div>`;
  }

  const app = document.getElementById('app');
  let ultimaChaveTela = '';
  /** Redesenha a tela. Mantém a posição da rolagem quando continua na mesma tela. */
  function render(trocouDeTela) {
    aoAtualizarEdicao = null;
    aplicarFolhas(); // mudança nas folhas que chegou do tablet chefe
    let v = view();
    if (cfg.bloqueio && !DEMO_IMG) v = { tela: 'bloqueado-adm' };
    const telas = {
      conectar: telaConectar, preparando: telaPreparando, configurar: telaConfigurar, operador: telaOperador,
      inicio: telaInicio, prancheta: telaPrancheta, central: telaCentral, relatorios: telaRelatorios, leitura: telaLeitura, config: telaConfig, admin: telaAdmin, avisos: telaAvisos,
      pessoas: telaPessoas, registro: telaRegistro, graficos: telaGraficos, folhas: telaFolhas,
      aparelhos: telaAparelhos, 'bloqueado-adm': telaBloqueioAdm,
      escritorio: telaEscritorio, 'esc-calculos': telaEscCalculos, 'esc-rastreamento': telaEscRastreamento,
    };
    const chaveTela = JSON.stringify([v.tela, v.pid, v.data, v.monitor]);
    const outraTela = chaveTela !== ultimaChaveTela;
    const mesmaTela = !trocouDeTela && !outraTela;
    // a atualização que vem da central (a cada 5 s) não pode mudar onde a pessoa está: guarda e volta cada rolagem
    const ROLAM = '.abas, .seletor, .tabela-wrap, .cabecalho-form, .chips-escolha, .lista-avisos, main';
    const rolagens = mesmaTela ? [...app.querySelectorAll(ROLAM)].map((el) => [el.scrollLeft, el.scrollTop]) : [];
    alvos = [];
    // a animação de entrada é só de quem trocou de tela: o redesenho que vem da central (a cada 5 s) não pode piscar
    app.classList.remove('troca', 'troca-linha');
    app.innerHTML = (telas[v.tela] || telaInicio)(v);
    ultimaChaveTela = chaveTela;
    if (mesmaTela) app.querySelectorAll(ROLAM).forEach((el, i) => { if (rolagens[i]) { el.scrollLeft = rolagens[i][0]; el.scrollTop = rolagens[i][1]; } });
    else rolarDepois = true; // abriu a tela ou trocou a linha: a escolhida vai para o meio
    if (v.tela === 'central') desenharQr();
    if (v.tela === 'conectar' && NO_APK && pluginCentral && !procura.feita && !conexaoForm.endereco) setTimeout(procurarCentral, 300);
    if (v.tela === 'relatorios' && !v.carregado) carregarRelatorios();
    if (v.data) buscarDia(v.data);
    if (trocouDeTela) app.classList.add(outraTela ? 'troca' : 'troca-linha');
    arrumarQuadros();
    agendarCaber();
    requestAnimationFrame(caberFolhas); // folha inteira na tela (monitoramento)
  }
