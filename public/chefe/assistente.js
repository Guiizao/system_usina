/* Pranchetas Ubirálcool - assistente (3.1): a conversa. Quem confere permissão e faz as contas é o servidor (nuvem/src/assistente.js).
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  const ia = { aberto: false, entrando: false, msgs: [], ocupado: false, rascunho: '', dono: '' };
  const iaPessoa = () => { const p = pessoaAtual(); return p ? p.id || p.nome : ''; };
  /** Trocou a pessoa neste aparelho: a conversa da anterior não aparece para a próxima. */
  function iaDaPessoaAtual() { const q = iaPessoa(); if (ia.dono !== q) Object.assign(ia, { dono: q, msgs: [], rascunho: '', ocupado: false }); }
  const iaDisponivel = () => cfg.demo || (!!cfg.soNuvem && !soVer());
  const iaPeriodo = (m) => { const { de, ate } = m.consulta; return de === ate ? fmtData(de) : `${fmtData(de)} a ${fmtData(ate)}`; };
  const iaRotulo = (x) => { const [d, h] = String(x).split(' '), p = d.split('-'); return h && /^\d/.test(h) ? h : p.length === 3 ? `${p[2]}/${p[1]}` : String(x); };
  /** O gráfico é um desenho só: na conversa segue o tema; no arquivo sai sempre claro, com título, para quem recebe entender sozinho. */
  function iaGrafico(m, arquivo) {
    const cor = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const c = arquivo ? { fundo: cor('--ia-img-fundo'), tinta: cor('--ia-img-tinta'), fraca: cor('--ia-img-tinta-2'), linha: cor('--ia-img-linha'), barra: cor('--ia-img-barra') }
      : { fundo: 'none', tinta: 'var(--tinta)', fraca: 'var(--tinta-2)', linha: 'var(--linha-clara)', barra: 'var(--verde)' };
    const L = arquivo ? 640 : 420, A = arquivo ? 300 : 210, topo = arquivo ? 66 : 12, esq = 54, dir = 8, base = 26, pts = m.serie;
    const max = Math.max(1, ...pts.map((p) => Number(p.y) || 0)), passo = (L - esq - dir) / pts.length, larg = Math.min(44, passo * 0.72), cada = Math.ceil(pts.length / (arquivo ? 12 : 7));
    const Y = (v) => topo + (A - topo - base) * (1 - v / max);
    const txt = (x, y, t, st) => `<text x="${x}" y="${y}" style="font-family:'Segoe UI',Roboto,Arial,sans-serif;${st}">${esc(t)}</text>`;
    const grade = [0, 0.5, 1].map((f) => `<line x1="${esq}" x2="${L - dir}" y1="${Y(max * f).toFixed(1)}" y2="${Y(max * f).toFixed(1)}" style="stroke:${c.linha}"/>${txt(esq - 6, Y(max * f) + 4, pnNum(max * f, 1), `font-size:12px;text-anchor:end;fill:${c.fraca}`)}`).join('');
    const barras = pts.map((p, i) => { const x = esq + passo * i + (passo - larg) / 2, y = Y(Number(p.y) || 0), r = (pts.length - 1 - i) % cada ? '' : iaRotulo(p.x);
      return `${p.y == null ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${larg.toFixed(1)}" height="${(A - base - y).toFixed(1)}" rx="3" style="fill:${c.barra}"/>`}${pts.length <= 10 && p.y != null ? txt(x + larg / 2, y - 4, pnNum(p.y, 1), `font-size:11px;text-anchor:middle;fill:${c.tinta}`) : ''}${r ? txt(x + larg / 2, A - 8, r, `font-size:12px;text-anchor:middle;fill:${c.fraca}`) : ''}`; }).join('');
    const cab = arquivo ? `${txt(14, 26, m.titulo, `font-size:19px;font-weight:700;fill:${c.tinta}`)}${txt(14, 47, `${iaPeriodo(m)}. ${m.linhas.map(([a, b]) => `${a}: ${typeof b === 'number' ? pnNum(b, 2) : b}`).join('. ')}`, `font-size:13px;fill:${c.fraca}`)}` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L} ${A}" ${arquivo ? `width="${L * 2}" height="${A * 2}"` : `role="img" aria-label="${esc(m.titulo)}"`}><rect width="${L}" height="${A}" style="fill:${c.fundo}"/>${cab}${grade}${barras}</svg>`;
  }
  async function iaImagem(m) {
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iaGrafico(m, true));
    await img.decode();
    const tela = Object.assign(document.createElement('canvas'), { width: img.naturalWidth, height: img.naturalHeight });
    tela.getContext('2d').drawImage(img, 0, 0);
    const blob = await new Promise((ok) => tela.toBlob(ok, 'image/png'));
    return new File([blob], `${m.arquivo.nome}.png`, { type: 'image/png' });
  }
  async function iaPdf(m) {
    const coluna = { hora: 'Hora', dia: 'Dia', total: 'Período' }[m.consulta.por] || 'Item', un = m.unidade ? ` (${m.unidade})` : '';
    const folha = window.ModelosPapel.folhaDeTabela({ nome: m.titulo, titulo: m.titulo, secoes: [{ titulo: iaPeriodo(m), colunas: [coluna, `Valor${un}`], linhas: m.serie.map((p) => [m.consulta.por === 'total' ? iaPeriodo(m) : iaRotulo(p.x), p.y == null ? '-' : p.y]) }], rodape: m.linhas.map(([a, b]) => `${a}: ${typeof b === 'number' ? pnNum(b, 2) : b}`) });
    return new File([window.criarPdf([folha], Object.assign({ fmtNum, titulo: m.titulo }, await pecasPdf()))], `${m.arquivo.nome}.pdf`, { type: MIME.pdf });
  }
  /** Salvar e WhatsApp são os mesmos do envio de relatório; o gráfico só entra como arquivo pronto. */
  async function iaArquivo(i, tipo) {
    const m = ia.msgs[i];
    if (!m || !m.arquivo) return;
    try {
      const arq = tipo === 'pdf' ? await iaPdf(m) : await iaImagem(m);
      return compartilhar(tipo === 'whatsapp' ? 'whatsapp' : 'baixar', m.consulta.de, arq, `${m.titulo}, ${iaPeriodo(m)}`);
    } catch (e) { toast('Não consegui montar o arquivo', 'erro'); }
  }
  function iaRespostaHtml(m, i) {
    if (m.de === 'eu') return `<div class="ia-eu">${esc(m.texto)}</div>`;
    const max = Math.max(1, ...(m.serie || []).map((p) => Number(p.y) || 0));
    return `<section class="ia-resp">${m.titulo ? `<b>${esc(m.titulo)}</b>` : ''}<p>${esc(m.texto)}</p>
      ${m.linhas && m.linhas.length ? `<div class="ia-dados"><table>${m.linhas.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(typeof b === 'number' ? pnNum(b, 2) : b)}</td></tr>`).join('')}</table>${m.serie && m.serie.length && !m.arquivo ? `<div class="pn-barras">${m.serie.map((p) => `<div><i style="height:${Math.max(4, (Number(p.y) || 0) / max * 100)}%"></i></div>`).join('')}</div>` : ''}</div>` : ''}
      ${m.arquivo && m.serie.length > 1 ? `<div class="ia-grafico">${iaGrafico(m)}</div>` : ''}
      ${m.arquivo ? `<div class="linha-botoes ia-arq"><button class="btn pequeno" data-a="ia-arquivo" data-i="${i}" data-t="imagem">${ico('baixar')} Imagem</button><button class="btn pequeno" data-a="ia-arquivo" data-i="${i}" data-t="pdf">${ico('baixar')} PDF</button><button class="btn primario pequeno" data-a="ia-arquivo" data-i="${i}" data-t="whatsapp">${ico('whatsapp')} WhatsApp</button></div>` : ''}
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
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 60000); // o modelo às vezes pensa por mais de 40 s
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
