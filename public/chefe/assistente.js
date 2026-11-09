/* Pranchetas Ubirálcool - assistente (3.1): a conversa. Quem confere permissão e faz as contas é o servidor (nuvem/src/assistente.js).
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  const ia = { aberto: false, entrando: false, msgs: [], ocupado: false, rascunho: '', dono: '' };
  const iaPessoa = () => { const p = pessoaAtual(); return p ? p.id || p.nome : ''; };
  /** Trocou a pessoa neste aparelho: a conversa da anterior não aparece para a próxima. */
  function iaDaPessoaAtual() { const q = iaPessoa(); if (ia.dono !== q) Object.assign(ia, { dono: q, msgs: [], rascunho: '', ocupado: false }); }
  const iaDisponivel = () => cfg.demo || (!!cfg.soNuvem && !soVer());
  function iaRespostaHtml(m, i) {
    if (m.de === 'eu') return `<div class="ia-eu">${esc(m.texto)}</div>`;
    const max = Math.max(1, ...(m.serie || []).map((p) => Number(p.y) || 0));
    return `<section class="ia-resp">${m.titulo ? `<b>${esc(m.titulo)}</b>` : ''}<p>${esc(m.texto)}</p>
      ${m.linhas && m.linhas.length ? `<div class="ia-dados"><table>${m.linhas.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(typeof b === 'number' ? pnNum(b, 2) : b)}</td></tr>`).join('')}</table>${m.serie && m.serie.length ? `<div class="pn-barras">${m.serie.map((p) => `<div><i style="height:${Math.max(4, (Number(p.y) || 0) / max * 100)}%"></i></div>`).join('')}</div>` : ''}</div>` : ''}
      ${m.acao ? `<div class="ia-conf"><b>${m.acao.tipo === 'imprimir' ? 'Abrir a impressão?' : m.acao.tipo === 'enviar' ? 'Abrir o envio?' : 'Abrir o aviso?'}</b><p>${esc(m.acao.resumo || '')}</p><div class="linha-botoes"><button class="btn primario pequeno" data-a="ia-acao" data-i="${i}">Abrir</button><button class="btn pequeno" data-a="ia-cancelar" data-i="${i}">Cancelar</button></div></div>` : ''}</section>`;
  }
  function htmlConversa() {
    if (!iaDisponivel()) return '<main class="ia-conversa"><p class="sub pn-vazio">O assistente funciona para quem entrou pela nuvem.</p></main>';
    return `<main class="ia-conversa" id="ia-conversa">${ia.msgs.length ? ia.msgs.map(iaRespostaHtml).join('') : '<p class="sub pn-vazio">Pergunte sobre produção, folhas, avisos ou relatórios. Responde só o que você pode ver.</p>'}${ia.ocupado ? '<section class="ia-resp ia-esperando" aria-label="Pensando"><i></i><i></i><i></i></section>' : ''}</main>
      <div class="ia-campo"><input id="ia-texto" type="text" maxlength="500" autocomplete="off" placeholder="Escreva sua pergunta" aria-label="Sua pergunta" value="${esc(ia.rascunho)}"><button class="btn primario" data-a="ia-enviar" aria-label="Enviar" ${ia.ocupado ? 'disabled' : ''}>${ico('enviar')}</button></div>`;
  }
  const telaAssistente = () => { iaDaPessoaAtual(); return `${cabecalho('Assistente', 'Só o que você pode ver e fazer', true)}${htmlConversa()}`; };
  const gavetaAssistente = () => (iaDaPessoaAtual(), ia.aberto && painelNovoPc() ? `<aside class="ia-gaveta ${ia.entrando ? 'entrando' : ''}" aria-label="Assistente"><header><b>${ico('brilho')} Assistente</b><small>responde só o que você pode ver</small><button class="pn-ic" data-a="ia-fechar" aria-label="Fechar">${ico('fechar')}</button></header>${htmlConversa()}</aside>` : '');
  function abrirAssistente() {
    // a gaveta desliza só ao abrir: o redesenho de 5 em 5 segundos não pode repetir
    if (painelNovoPc()) { ia.aberto = ia.entrando = true; render(); ia.entrando = false; return; }
    return ir({ tela: 'assistente' });
  }
  function iaRolar() { requestAnimationFrame(() => { const c = document.getElementById('ia-conversa'); if (c) c.scrollTop = c.scrollHeight; }); }
  async function iaEnviar() {
    const pergunta = ia.rascunho.trim();
    if (!pergunta || ia.ocupado) return;
    const dono = ia.dono;
    const historico = ia.msgs.slice(-6).map((m) => ({ de: m.de, texto: m.texto }));
    ia.msgs.push({ de: 'eu', texto: pergunta }); ia.rascunho = ''; ia.ocupado = true;
    render(); iaRolar();
    let resposta;
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 30000);
    try {
      if (cfg.demo) resposta = { texto: 'Na demonstração o assistente não consulta o banco.' };
      else {
        const r = await fetch(`${cfg.nuvemUrl.replace(/\/+$/, '')}/banco/assistente`, { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.nuvemToken, 'X-Aparelho': cfg.deviceId }, body: JSON.stringify({ pergunta, historico }) });
        resposta = r.ok ? await r.json() : { texto: r.status === 429 ? 'Muitas perguntas nesta hora. Tente de novo mais tarde.' : r.status === 401 ? 'Sua entrada venceu. Entre de novo.' : 'O assistente não respondeu agora.' };
      }
    } catch (e) { resposta = { texto: 'Sem conexão com o assistente agora.' }; }
    finally { clearTimeout(t); }
    if (iaPessoa() !== dono) return; // trocou de pessoa enquanto esperava: a resposta era da anterior
    ia.msgs.push(Object.assign({ de: 'ia', texto: '' }, resposta)); ia.ocupado = false;
    render(); iaRolar();
  }
  function iaConfirmar(i) {
    const m = ia.msgs[i], a = m && m.acao;
    if (!a) return;
    m.acao = null;
    const dados = a.dados || {}, data = dados.data || dados.de || dataProducao();
    if (a.tipo === 'imprimir') return imprimirEscolhendo(data);
    if (a.tipo === 'enviar') return compartilhar('escritorio', data);
    // o aviso abre preenchido: quem confere e manda é a pessoa, na tela de sempre
    ia.aberto = false;
    return ir({ tela: 'avisos', form: { setor: dados.setor || (setores()[0] || {}).id, nome: dados.nome || '', texto: dados.texto || '' } });
  }
  document.addEventListener('input', (e) => { if (e.target.id === 'ia-texto') ia.rascunho = e.target.value; });
  document.addEventListener('keydown', (e) => { if (e.target.id === 'ia-texto' && e.key === 'Enter') { e.preventDefault(); iaEnviar(); } });
