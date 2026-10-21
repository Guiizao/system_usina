/* Pranchetas Ubirálcool - ajustes do aparelho
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Ajustes deste aparelho (com a senha do encarregado)
   * ========================================================= */
  function telaAdmin(v) {
    const s = setorPorId(cfg.papel);
    const ops = s ? operadoresDo(s.id) : [];
    const aberto = v.abertos && s && v.abertos[s.id];
    const visiveis = aberto ? ops : ops.slice(0, LIMITE_NOMES);
    const papelAtual = ehCentral() ? nomeDoChefe() : s ? s.nome : 'não escolhido';
    return `${topo('Ajustes do aparelho', 'Protegido pela senha do encarregado', true)}
      <main class="config">
        <div class="config-grade">
          <section class="bloco">
            <h2>${ico('instalar')} Este aparelho é</h2>
            <p class="papel-atual"><span class="escolha-ico">${ico(ehCentral() ? 'escritorio' : s ? s.icone : 'ajustes')}</span><b>${esc(papelAtual)}</b></p>
            <p class="sub">Para trocar, toque em outra função:</p>
            ${gradePapeis()}
          </section>
          <section class="bloco">
            <h2>${ico('tamanho')} Tela</h2>
            <h3>Tamanho das letras e botões</h3>
            <div class="segmentos">${['menor', 'normal', 'maior'].map((x) => `<button class="${cfg.escala === x ? 'sel' : ''}" data-a="escala" data-valor="${x}">${x === 'menor' ? 'Menor' : x === 'normal' ? 'Normal' : 'Maior'}</button>`).join('')}</div>
            <h3 style="margin-top:14px">Cores</h3>
            <div class="segmentos"><button class="${cfg.tema !== 'escuro' ? 'sel' : ''}" data-a="tema-fixo" data-valor="claro">${ico('sol')} Claro</button><button class="${cfg.tema === 'escuro' ? 'sel' : ''}" data-a="tema-fixo" data-valor="escuro">${ico('lua')} Escuro</button></div>
            <h3 style="margin-top:14px">Tela cheia</h3>
            <p class="sub" style="margin:0 0 8px">Ligada, some a barra de cima com bateria e hora. Para ver a barra, arraste o dedo da borda da tela.</p>
            <div class="segmentos"><button class="${!cfg.telaCheia ? 'sel' : ''}" data-a="tela-cheia" data-valor="0">Desligada</button><button class="${cfg.telaCheia ? 'sel' : ''}" data-a="tela-cheia" data-valor="1">${ico('telaCheia')} Ligada</button></div>
            ${NO_APK ? '' : `<div class="linha-botoes"><button class="btn pequeno" data-a="instalar">${ico('instalar')} Instalar na tela inicial</button></div>`}
          </section>
          ${s ? `<section class="bloco">
            <h2>${ico('pessoas')} Operadores da ${esc(s.nome)} <small>${ops.length}</small></h2>
            <div class="pessoas">${visiveis.map((o) => {
              const i = ops.indexOf(o);
              return `<div><span class="nome">${ico('pessoa')} <b>${esc(o.nome)}</b><small class="${o.senha ? '' : 'sem-senha'}">${o.senha ? 'com senha' : 'sem senha'}</small></span>
              <span class="acoes"><button class="btn pequeno" data-a="op-senha" data-setor="${s.id}" data-i="${i}">Senha</button>
              <button class="btn pequeno perigo" data-a="op-remove" data-setor="${s.id}" data-i="${i}" aria-label="Remover ${esc(o.nome)}">${ico('lixeira')}</button></span></div>`;
            }).join('') || '<div class="vazio">Nenhum operador cadastrado</div>'}</div>
            <div class="linha-botoes">
              ${ops.length > LIMITE_NOMES ? `<button class="btn pequeno" data-a="mostrar-mais" data-setor="${s.id}">${aberto ? 'Mostrar menos' : `Mostrar mais (${ops.length - LIMITE_NOMES})`}</button>` : ''}
              <button class="btn pequeno" data-a="op-add" data-setor="${s.id}">${ico('mais')} Cadastrar operador</button></div>
          </section>` : ''}
          <section class="bloco">
            <h2>${ico('wifi')} Rede</h2>
            <dl class="kv"><dt>Situação</dt><dd><span class="conexao ${classeConexao()}"><i></i>${esc(textoConexao())}</span></dd>
              <dt>Servidor</dt><dd>${esc(cfg.demo ? 'demonstração' : centralNoTablet() ? 'este próprio aparelho' : cfg.central || location.host)}</dd>
              <dt>Código do aparelho</dt><dd>${esc(cfg.deviceId)}</dd><dt>Esperando envio</dt><dd>${pendentes()}</dd>
              <dt>Relógio</dt><dd>${esc(cfg.demo ? 'demonstração' : textoRelogio())}</dd></dl>
            <div class="linha-botoes">${centralNoTablet()
              ? `<button class="btn pequeno perigo" data-a="desligar-servidor">${ico('servidor')} Desligar o servidor deste aparelho</button>`
              : `${NO_APK && pluginCentral ? `<button class="btn pequeno" data-a="virar-central">${ico('servidor')} Usar este aparelho como servidor</button>` : ''}<button class="btn pequeno perigo" data-a="desconectar">${ico('wifi')} Desconectar da central</button>`}</div>
          </section>
          <section class="bloco">
            <h2>${ico('instalar')} Aplicativo</h2>
            <dl class="kv"><dt>Versão</dt><dd>${VERSAO}</dd>${atualizacao.nova ? `<dt>Versão nova</dt><dd><b>${esc(atualizacao.nova.versao)}</b></dd>` : ''}</dl>
            <div class="linha-botoes">
              ${atualizacao.nova ? `<button class="btn pequeno primario" data-a="atualizacao">${ico('instalar')} Atualizar para a ${esc(atualizacao.nova.versao)}</button>` : podeAtualizar() ? `<button class="btn pequeno" data-a="procurar-atualizacao">Procurar atualização</button>` : ''}
              <button class="btn pequeno" data-a="novidades">Novidades desta versão</button></div>
          </section>
          <section class="bloco">
            <h2>${ico('planilha')} Dados</h2>
            <p class="sub" style="margin:0 0 8px">Apagar os dados deste aparelho tira daqui as anotações e a função dele (para usar em outro setor, por exemplo). O que já foi enviado continua na central.</p>
            <div class="linha-botoes">
              <button class="btn pequeno" data-a="compartilhar" data-destino="outros">${ico('compartilhar')} Compartilhar folhas de hoje</button>
              <button class="btn pequeno" data-a="exemplo">Preencher com dados de exemplo</button>
              <button class="btn pequeno perigo" data-a="limpar-tudo">${ico('lixeira')} Apagar dados deste aparelho</button></div>
          </section>
        </div>
        <p class="autoria">Pranchetas Digitais ${VERSAO} · ${esc(AUTORIA)}</p>
      </main>`;
  }
