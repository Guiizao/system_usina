/* Pranchetas Ubirálcool - ajustes do aparelho
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Ajustes deste aparelho (com a senha do encarregado)
   * ========================================================= */
  /** 2.18: ajustes do computador pela nuvem (o programa do Windows atualiza as telas sozinho pela nuvem). */
  /** 3.1: a chave do painel novo, neste aparelho. */
  function blocoPainelNovo() {
    const seg = (a, atual, ops) => `<div class="segmentos">${ops.map(([x, rot]) => `<button class="${atual === x ? 'sel' : ''}" data-a="${a}" data-valor="${x}">${rot}</button>`).join('')}</div>`;
    return `<h3 style="margin-top:14px">Painel novo</h3>${seg('painel-novo', cfg.painelNovo ? '1' : '0', [['0', 'Desligado'], ['1', 'Ligado']])}
      ${cfg.painelNovo ? `<h3 style="margin-top:14px">Sons do painel</h3>${seg('som-painel', cfg.somDesligado ? '0' : '1', [['1', 'Ligados'], ['0', 'Desligados']])}` : ''}`;
  }
  function telaAjustesNuvem(v) {
    const seg = (a, atual, ops) => `<div class="segmentos">${ops.map(([x, rot]) => `<button class="${atual === x ? 'sel' : ''}" data-a="${a}" data-valor="${x}">${rot}</button>`).join('')}</div>`;
    const sub = 'Deste computador';
    if (v.cat === 'tela') return telaDaParte('Tela', sub, `<section class="bloco">
          <h3>Tamanho das letras e botões</h3>${seg('escala', cfg.escala || 'normal', [['menor', 'Menor'], ['normal', 'Normal'], ['maior', 'Maior']])}
          <h3 style="margin-top:14px">Cores</h3>${seg('tema-fixo', cfg.tema === 'escuro' ? 'escuro' : 'claro', [['claro', `${ico('sol')} Claro`], ['escuro', `${ico('lua')} Escuro`]])}
          ${blocoPainelNovo()}
        </section>`);
    if (v.cat === 'aplicativo') return telaDaParte('Aplicativo', sub, `<section class="bloco">
          <dl class="kv"><dt>Versão</dt><dd>${VERSAO}</dd></dl>
          <p class="sub">O programa do Windows pega as telas novas sozinho pela nuvem quando abre.</p>
          <div class="linha-botoes"><button class="btn pequeno" data-a="novidades">Novidades desta versão</button></div>
        </section>`);
    if (v.cat === 'servidor') return telaDaParte('Servidor e cópia', sub, `<section class="bloco">
          <dl class="kv"><dt>Banco de dados</dt><dd><span class="conexao ${sync.viaBanco ? 'ok' : 'off'}"><i></i>${sync.viaBanco ? (sync.aoVivo ? 'Ligado, em tempo real' : 'Ligado') : 'Sem conexão'}</span></dd>
            <dt>Endereço</dt><dd>${esc(cfg.nuvemUrl || '')}</dd><dt>Este computador</dt><dd>Não é o banco: fala com ele e guarda uma cópia</dd>
            <dt>Entrou como</dt><dd>${esc((cfg.pessoa || {}).nome || '')}</dd></dl>
          <p class="sub">Para trocar de servidor, saia e escreva o endereço novo na tela de entrar.</p>
          <div class="linha-botoes">${pode('pessoas') ? `<button class="btn pequeno" data-a="pessoas">${ico('pessoas')} Pessoas e níveis dos tablets</button>` : ''}<button class="btn pequeno" data-a="baixar-copia">${ico('baixar')} Baixar a cópia deste computador</button><button class="btn pequeno" data-a="sair-nuvem">${ico('voltar')} Sair</button></div>
        </section>`);
    return telaDeQuadros('Ajustes', sub, [
      { cat: 'tela', icone: 'tamanho', nome: 'Tela', resumo: 'Tamanho das letras e cores' },
      { cat: 'aplicativo', icone: 'instalar', nome: 'Aplicativo', resumo: 'Versão e novidades' },
      { cat: 'servidor', icone: 'servidor', nome: 'Servidor e cópia', resumo: 'Banco de dados, cópia deste computador e sair' },
    ]);
  }
  function telaAdmin(v) {
    if (cfg.soNuvem) return telaAjustesNuvem(v);
    const s = setorPorId(cfg.papel);
    const sub = 'Ajustes do aparelho';
    const papelAtual = ehCentral() ? nomeDoChefe() : s ? s.nome : 'não escolhido';
    if (v.cat === 'funcao') return telaDaParte('Este aparelho', sub, `<section class="bloco">
            <p class="papel-atual"><span class="escolha-ico">${ico(ehCentral() ? 'escritorio' : s ? s.icone : 'ajustes')}</span><b>${esc(papelAtual)}</b></p>
            <p class="sub">Para trocar, toque em outra função:</p>
            ${gradePapeis()}
          </section>`);
    if (v.cat === 'tela') return telaDaParte('Tela', sub, `<section class="bloco">
            <h3>Tamanho das letras e botões</h3>
            <div class="segmentos">${['menor', 'normal', 'maior'].map((x) => `<button class="${cfg.escala === x ? 'sel' : ''}" data-a="escala" data-valor="${x}">${x === 'menor' ? 'Menor' : x === 'normal' ? 'Normal' : 'Maior'}</button>`).join('')}</div>
            <h3 style="margin-top:14px">Cores</h3>
            <div class="segmentos"><button class="${cfg.tema !== 'escuro' ? 'sel' : ''}" data-a="tema-fixo" data-valor="claro">${ico('sol')} Claro</button><button class="${cfg.tema === 'escuro' ? 'sel' : ''}" data-a="tema-fixo" data-valor="escuro">${ico('lua')} Escuro</button></div>
            <h3 style="margin-top:14px">Tela cheia</h3>
            <p class="sub" style="margin:0 0 8px">Ligada, some a barra de cima com bateria e hora. Para ver a barra, arraste o dedo da borda da tela.</p>
            <div class="segmentos"><button class="${!cfg.telaCheia ? 'sel' : ''}" data-a="tela-cheia" data-valor="0">Desligada</button><button class="${cfg.telaCheia ? 'sel' : ''}" data-a="tela-cheia" data-valor="1">${ico('telaCheia')} Ligada</button></div>
            ${ehCentral() ? blocoPainelNovo() : ''}
            ${NO_APK ? '' : `<div class="linha-botoes"><button class="btn pequeno" data-a="instalar">${ico('instalar')} Instalar na tela inicial</button></div>`}
          </section>`);
    if (v.cat === 'operadores' && s) return telaDaParte('Operadores', sub, blocoOperadores(s, v));
    if (v.cat === 'rede') return telaDaParte('Conexão', sub, `<section class="bloco">
            <dl class="kv"><dt>Situação</dt><dd><span class="conexao ${classeConexao()}"><i></i>${esc(textoConexao())}</span></dd>
              <dt>Servidor</dt><dd>${esc(cfg.demo ? 'demonstração' : centralNoTablet() ? 'este próprio aparelho' : cfg.central || location.host)}</dd>
              <dt>Código do aparelho</dt><dd>${esc(cfg.deviceId)}</dd><dt>Esperando envio</dt><dd>${pendentes()}</dd>
              <dt>Relógio</dt><dd>${esc(cfg.demo ? 'demonstração' : textoRelogio())}</dd>
              <dt>Banco de dados</dt><dd>${esc(cfg.demo ? 'demonstração' : sync.viaBanco ? (sync.aoVivo ? 'Ligado, em tempo real' : 'Ligado') : cfg.nuvemToken ? 'Sem conexão: vai pelo Wi-Fi da usina' : 'Só pelo Wi-Fi da usina')}</dd></dl>
            <div class="linha-botoes">${centralNoTablet()
              ? `<button class="btn pequeno perigo" data-a="desligar-servidor">${ico('servidor')} Desligar o servidor deste aparelho</button>`
              : `${NO_APK && pluginCentral ? `<button class="btn pequeno" data-a="virar-central">${ico('servidor')} Usar este aparelho como servidor</button>` : ''}<button class="btn pequeno perigo" data-a="desconectar">${ico('wifi')} Desconectar da central</button>`}</div>
          </section>`);
    if (v.cat === 'aplicativo') return telaDaParte('Aplicativo', sub, `<section class="bloco">
            <dl class="kv"><dt>Versão</dt><dd>${VERSAO}</dd>${atualizacao.nova ? `<dt>Versão nova</dt><dd><b>${esc(atualizacao.nova.versao)}</b></dd>` : ''}</dl>
            <div class="linha-botoes">
              ${atualizacao.nova ? `<button class="btn pequeno primario" data-a="atualizacao">${ico('instalar')} Atualizar para a ${esc(atualizacao.nova.versao)}</button>` : podeAtualizar() ? `<button class="btn pequeno" data-a="procurar-atualizacao">Procurar atualização</button>` : ''}
              <button class="btn pequeno" data-a="novidades">Novidades desta versão</button></div>
          </section><p class="autoria">Pranchetas Digitais ${VERSAO} · ${esc(AUTORIA)}</p>`);
    if (v.cat === 'dados') return telaDaParte('Dados deste aparelho', sub, `<section class="bloco">
            <p class="sub" style="margin:0 0 8px">Apagar os dados deste aparelho tira daqui as anotações e a função dele (para usar em outro setor, por exemplo). O que já foi enviado continua na central.</p>
            <div class="linha-botoes">
              <button class="btn pequeno" data-a="baixar-copia">${ico('baixar')} Guardar uma cópia deste aparelho</button>
              <button class="btn pequeno" data-a="compartilhar" data-destino="outros">${ico('compartilhar')} Compartilhar folhas de hoje</button>
              ${cfg.demo ? '<button class="btn pequeno" data-a="exemplo">Preencher com dados de exemplo</button>' : ''}
              <button class="btn pequeno perigo" data-a="limpar-tudo">${ico('lixeira')} Apagar dados deste aparelho</button></div>
          </section>`);
    return telaDeQuadros('Ajustes do aparelho', 'Protegido pela senha do encarregado', [
      { cat: 'funcao', icone: ehCentral() ? 'escritorio' : s ? s.icone : 'ajustes', nome: 'Este aparelho', resumo: `Agora: ${papelAtual}. Trocar de função` },
      { cat: 'tela', icone: 'tamanho', nome: 'Tela', resumo: 'Tamanho das letras, cores e tela cheia' },
      s && { cat: 'operadores', icone: 'pessoas', nome: 'Operadores', resumo: `Quem anota na ${s.nome} e as senhas` },
      { cat: 'rede', icone: 'wifi', nome: 'Conexão', resumo: 'Wi-Fi, servidor e banco de dados' },
      { cat: 'aplicativo', icone: 'instalar', nome: 'Aplicativo', resumo: 'Versão, atualização e novidades' },
      { cat: 'dados', icone: 'planilha', nome: 'Dados deste aparelho', resumo: 'Cópia, compartilhar e apagar' },
    ].filter(Boolean));
  }
