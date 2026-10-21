/* Pranchetas Ubirálcool - atualização do aplicativo
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Atualização do aplicativo (versões 2.7 e 2.8). Dois jeitos:
   *  - rápida (telas): só o HTML, o CSS e o JavaScript mudaram. O pacote das telas vem da central (telas/)
   *    ou da nuvem, assinado no computador do Guilherme. O aplicativo baixa só o que mudou, mostra a barra
   *    e abre de novo sozinho, sem janela do Android. Se a versão nova não abrir, volta para a de antes.
   *  - APK: a parte em Java mudou (o pacote pede um APK mais novo que o deste tablet). O APK desce pelo
   *    Wi-Fi e o Android pergunta se pode instalar.
   * Achou versão nova: abre a janela (quando ninguém está anotando) e deixa o botão Atualizar no alto.
   * As anotações deste aparelho continuam nos dois jeitos.
   * ========================================================= */
  const atualizacao = { nova: null, procurando: false, avisada: '', nativa: '' };
  /** '2.7.0' vira 20700, para comparar versões. É também o número de versão do APK (versionCode). */
  const numeroDaVersao = (v) => { const p = String(v || '').split('.').map((x) => parseInt(x, 10) || 0); return (p[0] || 0) * 10000 + (p[1] || 0) * 100 + (p[2] || 0); };
  const podeAtualizar = () => NO_APK && !!pluginCentral && !!pluginCentral.atualizar;
  async function lerJson(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try { const r = await fetch(url, { cache: 'no-store', signal: ctrl.signal }); return r.ok ? await r.json() : null; } catch (e) { return null; } finally { clearTimeout(t); }
  }
  async function procurarAtualizacao(avisar) {
    if (!podeAtualizar() || atualizacao.procurando || cfg.demo) return;
    atualizacao.procurando = true;
    try {
      if (!atualizacao.nativa && pluginCentral.versaoInstalada) atualizacao.nativa = ((await pluginCentral.versaoInstalada().catch(() => null)) || {}).versao || '';
      const nativa = atualizacao.nativa || VERSAO;
      // de onde: a central (para os tablets dos setores) e a nuvem (para o tablet chefe, quando ela estiver ligada)
      const bases = [];
      if (cfg.central && !centralNoTablet()) bases.push({ apk: baseCentral() + 'api/versao', telas: baseCentral() + 'telas/' });
      const nuvem = sync.status && sync.status.nuvem && sync.status.nuvem.ligada ? sync.status.nuvem.url : '';
      const online = C.atualizacaoOnline ? C.atualizacaoOnline.replace(/\/?$/, '/') : centralNoTablet() && nuvem ? nuvem + '/atualizacao/' : '';
      if (online) bases.push({ apk: online + 'versao.json', telas: new URL('../telas/', online).href });
      // a mais nova ganha; na mesma versão, a rápida (sem janela do Android)
      let melhor = null;
      const considerar = (c) => {
        const ref = melhor ? melhor.versao : VERSAO;
        if (numeroDaVersao(c.versao) > numeroDaVersao(ref) || (melhor && c.versao === melhor.versao && c.tipo === 'telas' && melhor.tipo === 'apk')) melhor = c;
      };
      for (const b of bases) {
        const t = await lerJson(b.telas + 'pacote.json');
        // o pacote pede um APK mais novo que o deste tablet: esse vem pelo APK
        if (t && t.versao && numeroDaVersao(t.apkMinimo) <= numeroDaVersao(nativa)) considerar({ tipo: 'telas', versao: t.versao, novidades: t.novidades, base: b.telas });
        const v = await lerJson(b.apk);
        if (v && v.versao) considerar(Object.assign({}, v, { tipo: 'apk', url: new URL(v.url || 'pranchetas.apk', b.apk).href }));
      }
      const mudou = (melhor && melhor.versao) !== (atualizacao.nova && atualizacao.nova.versao);
      atualizacao.nova = melhor;
      if (mudou && !modalAberto()) render();
      if (avisar) toast(melhor ? `Tem a versão ${melhor.versao} para instalar` : `Este aparelho já está com a versão mais nova (${VERSAO})`);
      else avisarAtualizacao();
    } finally {
      atualizacao.procurando = false;
    }
  }
  /** 2.16: a central (ou a nuvem) diz a versão mais nova em toda sincronização, a cada 5 s. Mais nova que a deste
      aparelho: procura na hora, sem esperar os 30 minutos. */
  let versaoDaCentral = '';
  function versaoNaSincronizacao(info) {
    const v = info && info.versao;
    if (!v || v === versaoDaCentral) return;
    versaoDaCentral = v;
    if (numeroDaVersao(v) > numeroDaVersao(VERSAO)) procurarAtualizacao();
  }
  /** 2.16: a rápida (só as telas, sem janela do Android) instala sozinha quando ninguém mexe no aparelho há um minuto:
      sem senha e sem ir de aparelho em aparelho. O rascunho e o operador continuam depois de abrir de novo. */
  async function instalarSozinho(n) {
    if (atualizacao.instalando || modalAberto() || Date.now() - ultimaAtividade < 60000) return;
    atualizacao.instalando = true;
    toast(`Atualizando o aplicativo para a versão ${n.versao}...`);
    try { await pluginCentral.atualizarTelas({ base: n.base, versao: n.versao }); } // abre de novo sozinho
    catch (e) { atualizacao.instalando = false; }
  }
  /** Achou versão nova: a rápida instala sozinha; a do APK abre a janela uma vez (o Android pergunta se pode instalar).
      Se alguém estiver anotando, espera (tenta de novo a cada minuto). */
  function avisarAtualizacao() {
    const n = atualizacao.nova;
    if (!n || !podeRedesenhar()) return;
    if (n.tipo === 'telas') return instalarSozinho(n);
    if (atualizacao.avisada === n.versao) return;
    atualizacao.avisada = n.versao;
    oferecerAtualizacao();
  }
  /** Novidades das versões depois de "de" até esta. Sem "de": só as desta versão. */
  const novidadesDesde = (de) => (window.NOVIDADES || []).filter((n) => (de ? numeroDaVersao(n.versao) > numeroDaVersao(de) && numeroDaVersao(n.versao) <= numeroDaVersao(VERSAO) : n.versao === VERSAO));
  const htmlNovidades = (lista) => `<div class="novidades-lista">${lista.map((n) => `${lista.length > 1 ? `<h4>Versão ${esc(n.versao)}</h4>` : ''}<ul>${(n.itens || []).map((i) => `<li>${esc(i).replace(/-/g, '\u2011')}</li>`).join('')}</ul>`).join('')}</div>`;
  function mostrarNovidades(de) {
    const lista = novidadesDesde(de);
    if (!lista.length) return;
    if (modalAberto()) { setTimeout(() => mostrarNovidades(de), 3000); return; } // espera fechar a janela que está aberta (aviso do escritório)
    abrirModal(`<h3>${de ? `Aplicativo atualizado: versão ${esc(VERSAO)}` : `Novidades da versão ${esc(VERSAO)}`}</h3>
      ${de ? '<p class="dica">O que mudou:</p>' : ''}${htmlNovidades(lista)}
      <div class="acoes-modal um"><button class="btn primario" data-k="ok">Entendi</button></div>`, (k, b, fechar) => { if (k === 'ok') fechar(true); }, { classe: 'largo com-novidades' });
  }
  /** Abriu numa versão nova: mostra uma vez o que mudou. Aparelho que ainda não tem função escolhida não precisa. */
  function conferirNovidades() {
    const antes = cfg.versaoVista || (cfg.papel ? '2.6.0' : VERSAO); // a 2.6 não guardava a versão vista
    if (cfg.versaoVista !== VERSAO) { cfg.versaoVista = VERSAO; salvarCfg(); }
    if (numeroDaVersao(antes) < numeroDaVersao(VERSAO)) setTimeout(() => mostrarNovidades(antes), 900);
  }
  /** Janela da versão nova: o que mudou, a barra do download e o botão Atualizar agora. */
  async function oferecerAtualizacao() {
    const n = atualizacao.nova;
    if (!n) return;
    const rapida = n.tipo === 'telas';
    const lista = Array.isArray(n.novidades) ? n.novidades.filter((x) => numeroDaVersao(x.versao) > numeroDaVersao(VERSAO)) : [];
    const mb = !rapida && n.tamanho ? ` (${(n.tamanho / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB)` : '';
    let baixando = false, pronto = false;
    await abrirModal(`<h3>Versão nova: ${esc(n.versao)}</h3>
      <p class="dica">Este aparelho está com a ${esc(VERSAO)}. As anotações daqui não se perdem.</p>
      ${lista.length ? htmlNovidades(lista) : ''}
      <div class="barra-progresso" id="barra-atualizacao" hidden><i></i></div>
      <p class="dica passo-atualizacao" id="passo-atualizacao">${rapida ? 'Toque em Atualizar agora: o aplicativo baixa só o que mudou e abre de novo sozinho.' : `Toque em Atualizar agora e confirme na janela do Android${mb}.`}</p>
      <div class="acoes-modal"><button class="btn" data-k="x">Depois</button><button class="btn primario" data-k="ok">${ico('instalar')} Atualizar agora</button></div>`,
    async (k, b, fechar, f) => {
      if (k === 'x') return baixando || pronto ? undefined : fechar(undefined);
      if (k !== 'ok' || baixando || pronto) return;
      baixando = true; b.disabled = true;
      const passo = f.querySelector('#passo-atualizacao');
      const barra = f.querySelector('#barra-atualizacao');
      const mostrar = (feito, total) => {
        if (!total) return;
        const pc = Math.min(100, Math.floor((feito * 100) / total));
        barra.hidden = false; barra.firstElementChild.style.width = pc + '%';
        passo.textContent = `Baixando: ${pc}%`;
      };
      passo.textContent = 'Baixando...';
      let ouvinte = null;
      try {
        ouvinte = await pluginCentral.addListener(rapida ? 'progressoTelas' : 'progressoAtualizacao', (p) => { if (p) mostrar(rapida ? p.feito : p.baixado, p.total); });
      } catch (e) { /* sem a barra, baixa do mesmo jeito */ }
      try {
        if (rapida) {
          await pluginCentral.atualizarTelas({ base: n.base, versao: n.versao });
          pronto = true;
          mostrar(1, 1);
          passo.textContent = 'Pronto. Abrindo a versão nova...'; // o aplicativo recarrega sozinho e mostra as novidades
          return;
        }
        const r = await pluginCentral.atualizar({ url: n.url, sha256: n.sha256 || '', tamanho: n.tamanho || 0 });
        if (r && r.precisaPermissao) {
          passo.textContent = 'Falta uma permissão. Na tela que abriu, ligue "Permitir desta fonte", volte para cá e toque em Atualizar agora de novo.';
        } else {
          fechar(true);
          toast('Agora toque em Atualizar na janela do Android');
        }
      } catch (e) {
        passo.textContent = `Não deu certo: ${(e && e.message) || e}. Confira o Wi-Fi e tente de novo.`;
      } finally {
        baixando = false;
        if (!pronto) b.disabled = false;
        if (ouvinte && ouvinte.remove) ouvinte.remove();
      }
    }, { classe: 'largo com-novidades' });
  }
