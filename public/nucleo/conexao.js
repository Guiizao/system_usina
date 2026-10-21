/* Pranchetas Ubirálcool - conexão com a central e com a nuvem
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Central: conexão pela rede da usina
   * ========================================================= */
  const sync = { modo: 'verificando', ocupado: false, status: null, statusJson: '' };

  const pluginCentral = NO_APK && window.Capacitor.Plugins ? window.Capacitor.Plugins.Central : null;
  /* O servidor da usina roda neste aparelho? (é separado de ser o tablet chefe: o tablet chefe pode usar um servidor
     que está em outro aparelho, e o servidor pode ficar num aparelho que não é o tablet chefe) */
  const centralNoTablet = () => NO_APK && !!cfg.servidor && !!pluginCentral;
  async function ligarCentralDoTablet() {
    if (!centralNoTablet()) return false;
    try {
      await garantirRedeLocal(true);
      await pluginCentral.criarPastas();
      const r = await pluginCentral.iniciar({ porta: C.portaCentral });
      pluginCentral.manterLigado().catch(() => {});
      cfg.central = `http://127.0.0.1:${C.portaCentral}`;
      usarChaveDaRede(r.chave);
      cfg.demo = false;
      cfg.ultimoContato = Date.now();
      salvarCfg();
      return true;
    } catch (e) {
      toast('Não consegui ligar o servidor neste tablet', 'erro');
      return false;
    }
  }
  /* Android 16 e 17 podem bloquear a rede local (permissão "Dispositivos por perto" ou "Rede local").
     Sem ela, o tablet não acha o tablet chefe e o tablet chefe não recebe ninguém, mesmo no mesmo Wi-Fi. */
  let jaExpliqueiRede = false;
  async function garantirRedeLocal(pedir = true) {
    if (!NO_APK || !pluginCentral || !pluginCentral.permissaoRede) return true;
    try {
      const r = await pluginCentral.permissaoRede({ pedir });
      if (r.estado === 'livre' || r.estado === 'concedida') return true;
      if (pedir || !jaExpliqueiRede) await explicarRedeBloqueada();
      return false;
    } catch (e) { return true; }
  }
  async function explicarRedeBloqueada() {
    if (modalAberto()) return;
    jaExpliqueiRede = true;
    const abrir = await confirmar('O Android bloqueou a rede local',
      'Sem essa permissão o aplicativo não acha os outros tablets no Wi-Fi. Toque em Abrir ajustes, depois em Permissões, e deixe "Dispositivos por perto" (ou "Rede local") em Permitir.', 'Abrir ajustes');
    if (abrir && pluginCentral.abrirAjustesDoApp) pluginCentral.abrirAjustesDoApp().catch(() => {});
  }
  const baseCentral = () => (cfg.central ? cfg.central.replace(/\/$/, '') + '/' : '');

  /* Tudo que vai para a central passa embaralhado com a chave deste aparelho (public/cifra.js).
     Só o "ping" (a central está aí?) e o pedido de conexão vão abertos, e neles não há anotação nem chave. */
  let desvioCentral = 0; // diferença entre o relógio da central e o deste aparelho (a central só aceita pedido recente)
  async function pedirCifrado(base, caminho, opcoes = {}, ms = 4000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      for (let vez = 0; vez < 2; vez++) {
        const { corpo, iv } = await Cifra.pedido(cfg.chave, cfg.deviceId, opcoes.method || 'GET', caminho, opcoes.body || '', Date.now() + desvioCentral);
        const r = await fetch(`${base}api/c?a=${encodeURIComponent(cfg.deviceId)}`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: corpo, signal: ctrl.signal, cache: 'no-store' });
        if (r.status === 409 && vez === 0) {
          // o relógio deste aparelho está longe do da central: acerta a diferença e pede de novo
          const d = await r.json().catch(() => ({}));
          if (d.agora) { desvioCentral = d.agora - Date.now(); continue; }
        }
        if (r.status !== 200) return r; // 401: a chave não vale mais (o código de conexão foi trocado)
        const resp = await Cifra.resposta(cfg.chave, iv, new Uint8Array(await r.arrayBuffer()));
        return new Response(resp.texto, { status: resp.status, headers: { 'Content-Type': 'application/json' } });
      }
      throw new Error('relógio');
    } finally { clearTimeout(t); }
  }
  async function buscar(caminho, opcoes = {}, ms = 4000) {
    if (cfg.chave && caminho !== 'api/ping' && caminho !== 'api/parear') {
      const r = await pedirCifrado(baseCentral(), caminho, opcoes, ms);
      // aparelho bloqueado pelo administrador (423): a tela trava
      if (r.status === 423) {
        const d = await r.clone().json().catch(() => ({}));
        conhecerCentralDoBloqueio(d.geracao);
        aplicarBloqueio(d.bloqueio);
      }
      return r;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try { return await fetch(baseCentral() + caminho, Object.assign({}, opcoes, { signal: ctrl.signal, cache: 'no-store' })); } finally { clearTimeout(t); }
  }
  const avisarCentralAntiga = () => toast(`O servidor da usina está com o aplicativo antigo. Atualize o servidor (tablet chefe ou computador) para a versão ${VERSAO}.`, 'erro');
  const postJson = (caminho, corpo, ms) => buscar(caminho, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }, ms);

  async function sincronizar() {
    if (cfg.soNuvem) return cfg.pessoa ? sincronizarNuvem() : undefined; // 2.16: pela nuvem, sem central
    if (cfg.demo || !cfg.chave || sync.ocupado) return;
    sync.ocupado = true;
    try {
      const r0 = await buscar('api/ping');
      const info = r0.ok ? await r0.json() : null;
      if (!info || info.app !== 'pranchetas') throw new Error('sem central');
      if (!info.cifra) {
        // central ainda na versão antiga (sem a conexão embaralhada): espera ela ser atualizada, sem apagar nada
        if (Date.now() - (sync.avisoAntiga || 0) > 10 * 60000) { sync.avisoAntiga = Date.now(); avisarCentralAntiga(); }
        throw new Error('central antiga');
      }
      if (info.agora) desvioCentral = info.agora - Date.now();
      cfg.ultimoContato = Date.now(); salvarCfg();
      sync.modo = 'online'; sync.falhas = 0;

      // liberado aqui com a senha de desbloqueio: a central fica sabendo (e confere a senha de novo)
      if (cfg.liberacao) {
        const rl = await postJson('api/liberar', { codigo: cfg.liberacao.codigo, em: cfg.liberacao.em, rev: cfg.liberacao.rev || 0, geracao: cfg.liberacao.geracao || '' }, 10000);
        if (rl.ok) { cfg.liberacao = null; salvarCfg(); }
        else if (rl.status === 403) { const d = await rl.json().catch(() => ({})); cfg.liberacao = null; conhecerCentralDoBloqueio(d.geracao); salvarCfg(); aplicarBloqueio(d.bloqueio); return; }
        else if (rl.status === 423) { cfg.liberacao = null; salvarCfg(); return; }
      }
      // em lotes: um aparelho que ficou muito tempo sem Wi-Fi não manda tudo de uma vez
      const envio = Object.values(registros).filter((r) => !r.sincronizado && !r.esperaEntrar).slice(0, LOTE_ENVIO)
        // a configuração vai com a revisão que este aparelho conhece (a central recusa se outro tablet mudou antes)
        .map((r) => (r.data === 'config' ? Object.assign({}, r, { base: r.rev || 0 }) : r));
      const erros = errosGuardados.slice();
      const antesDoEnvio = Date.now();
      const r1 = await postJson('api/sync', { aparelho: cfg.deviceId, papel: cfg.papel, nome: nomeDesteAparelho(), info: infoAparelho, operador: operadorAtual(), versao: VERSAO, geracao: cfg.geracao || '', novaConexao: !!cfg.novaConexao, registros: envio, erros }, 15000);
      if (r1.status === 401) {
        // o servidor está neste aparelho: pega a chave nova com ele (o código de conexão foi trocado)
        if (centralNoTablet()) { try { const e = await pluginCentral.estado(); if (e && e.chave) { usarChaveDaRede(e.chave); salvarCfg(); } } catch (x) { /* tenta de novo */ } return; }
        return desconectar('O código de conexão mudou (ou a central foi trocada). Digite o código novo que aparece no tablet chefe.');
      }
      if (r1.status === 423) return; // a tela já travou (buscar)
      const resp1 = r1.ok ? await r1.clone().json().catch(() => ({})) : {};
      if (resp1.codigoTrocado) avisarCodigoTrocado(resp1.codigoTrocado);
      versaoNaSincronizacao(resp1.atualizacao); // 2.16: versão nova chega em segundos
      if (r1.ok && resp1.geracao && !resp1.zerar) {
        // a central aceitou: "este aparelho está livre até a revisão X" (da central dela)
        const revCentral = Number(resp1.bloqueiosRev) || 0;
        const mesmaCentral = resp1.geracao === cfg.blqGeracao;
        conhecerCentralDoBloqueio(resp1.geracao);
        // um bloqueio daqui mais novo que X (veio da nuvem enquanto esta resposta vinha) continua
        if (cfg.bloqueio && (!mesmaCentral || revCentral >= (cfg.bloqueio.rev || 0))) liberarAparelho('O administrador liberou este aparelho.', revCentral);
        if (revCentral > (cfg.revLiberada || 0)) { cfg.revLiberada = revCentral; salvarCfg(); }
      }
      // o escritório zerou as anotações de teste: limpa as deste aparelho e começa de novo
      if (resp1.zerar) { zerarLocal(resp1.geracao); toast('O escritório zerou as anotações. Este aparelho começou do zero.'); render(true); return; }
      if (r1.ok && resp1.geracao && resp1.geracao !== cfg.geracao) {
        // conectou numa central nova (tablet chefe trocado ou reinstalado): manda de novo o que este aparelho guarda,
        // para a central não começar vazia
        const outraCentral = !!cfg.geracao;
        cfg.geracao = resp1.geracao; cfg.ultimoSeq = 0; cfg.nuvemSeq = null; cfg.nuvemOrdem = 0;
        if (outraCentral) { Object.values(registros).forEach((r) => { if (!envio.includes(r)) r.sincronizado = false; }); salvarRegistros(); }
        salvarCfg();
      }
      if (r1.ok && cfg.novaConexao) { cfg.novaConexao = false; salvarCfg(); }
      if (r1.ok && envio.length) {
        // o que a central recusou (versão 2.12) volta a ser como está na central, e a pessoa fica sabendo
        const recusados = Array.isArray(resp1.recusados) ? resp1.recusados : [];
        const ids = new Set(recusados.map((x) => x.id));
        let semSessao = false;
        recusados.forEach((x) => {
          // anotação recusada no tablet chefe (ninguém dentro, ou quem está não pode): não se perde. Fica guardada aqui
          // e vai de novo quando alguém entrar neste aparelho
          const local = registros[x.id];
          if (local && local.data !== 'config' && x.motivo !== 'invalido') { local.esperaEntrar = true; semSessao = semSessao || x.motivo === 'sem_sessao'; return; }
          if (x.atual) registros[x.id] = Object.assign({}, x.atual, { sincronizado: true });
          else delete registros[x.id];
        });
        if (recusados.length) avisarRecusa(recusados);
        // a central não tem mais ninguém dentro deste aparelho (o nível mudou, a pessoa saiu de outro jeito): entra de novo
        if (semSessao && cfg.pessoa) { cfg.pessoa = null; salvarCfg(); render(); }
        envio.forEach((e) => { const atual = registros[e.id]; if (!ids.has(e.id) && atual && atual.atualizadoEm === e.atualizadoEm) { atual.sincronizado = true; delete atual.esperaEntrar; } });
        // a revisão nova da configuração aceita (a próxima mudança vai com ela)
        Object.entries(resp1.revs || {}).forEach(([id, rev]) => { if (registros[id]) registros[id].rev = rev; });
        salvarRegistros();
        if (recusados.length) render(true);
      }
      if (r1.ok) {
        const resp = await r1.json().catch(() => ({}));
        if (erros.length) { errosGuardados.splice(0, erros.length); LS.set('erros', errosGuardados); }
        if (resp.agora) conferirRelogio(resp.agora - (antesDoEnvio + Date.now()) / 2);
        // longe da usina, o aparelho pergunta na nuvem se foi bloqueado
        if (typeof resp.nuvem === 'string' && resp.nuvem !== (cfg.nuvemUrl || '')) { cfg.nuvemUrl = resp.nuvem; salvarCfg(); }
        // a chave deste aparelho para a fila da nuvem (versão 2.13), para quando estiver longe da central
        if (typeof resp.nuvemToken === 'string' && resp.nuvemToken !== (cfg.nuvemToken || '')) { cfg.nuvemToken = resp.nuvemToken; salvarCfg(); }
        sync.avisouNuvem = false;
        // tablet chefe (versão 2.12): de minuto em minuto confere com a central quem está aqui e o que pode
        if (ehCentral() && cfg.pessoa && Date.now() - (sync.quemEm || 0) > 60000) { sync.quemEm = Date.now(); conferirSessao(); }
      }
      let mudou = false;
      // o aparelho passou a guardar mais dias (virou tablet chefe): busca de novo, desde o começo
      const corte = primeiroDiaGuardado();
      if (cfg.corteSync && corte < cfg.corteSync) cfg.ultimoSeq = 0;
      const r2 = await buscar(`api/registros?desde=${cfg.ultimoSeq || 0}&aPartirDe=${corte}`, {}, 15000);
      if (r2.ok) {
        const dados = await r2.json();
        for (const rec of dados.registros) {
          const local = registros[rec.id];
          // anotação guardada esperando alguém entrar não é trocada pela da central (ela ainda vai subir)
          if (!local || (!local.esperaEntrar && rec.atualizadoEm > local.atualizadoEm)) { registros[rec.id] = Object.assign({}, rec, { sincronizado: true }); mudou = true; }
        }
        cfg.ultimoSeq = dados.seq; cfg.corteSync = corte; salvarCfg();
        if (mudou) { podar(); salvarRegistros(); }
      }
      if (ehCentral()) {
        const r3 = await buscar('api/status');
        if (r3.ok) {
          const texto = await r3.text();
          // só redesenha se algo mudou de verdade, para não pular a tela de quem está olhando
          if (texto !== sync.statusJson) { sync.statusJson = texto; sync.status = JSON.parse(texto); mudou = true; }
          verificarBase44();
        }
      }
      if (mudou && ['central', 'inicio', 'prancheta', 'config', 'aparelhos'].includes(view().tela)) {
        if (podeRedesenhar()) render(); else redesenharDepois = true;
      }
      if (mudou && view().tela === 'avisos') atualizarTelaAvisos();
      revisarAvisoNaTela();
      verificarAvisos();
      if (envio.length === LOTE_ENVIO) sincronizarLogo(); // ainda tem anotação esperando: manda o próximo lote
    } catch (e) {
      sync.modo = 'offline';
      sync.falhas = (sync.falhas || 0) + 1;
      conferirNaNuvem();
      sincronizarNuvem();
      // no aplicativo: depois de umas falhas seguidas, procura o tablet chefe no Wi-Fi (no máximo a cada 3 minutos)
      if (NO_APK && sync.falhas >= 3 && Date.now() - (sync.ultimaBusca || 0) > 180000) { sync.ultimaBusca = Date.now(); setTimeout(reencontrarCentral, 0); }
    } finally {
      sync.ocupado = false;
      atualizarConexao();
    }
  }
  /* Longe da central (outra rede, 4G), versão 2.13: depois de 2 minutos sem achar a central, o que ainda não subiu vai
     para a fila da nuvem. A central puxa a fila e confere tudo como se o aparelho tivesse sincronizado (a mais nova vale).
     A anotação continua esperando a central: quando ela voltar, sobe direto também (repetida não muda nada). */
  /* Sem a central (desligada ou em outra rede), versão 2.14: o aparelho troca as anotações direto com a nuvem.
     Manda o que falta e puxa o que os outros fizeram: o que a central publicou (pelo seq dela, que a nuvem guarda igual)
     e o que os outros aparelhos longe da central mandaram (pela ordem da nuvem). A mais nova vale, como na central, e o
     que espera alguém entrar não é trocado. Quando a central volta, ela confere tudo e desfaz o que não podia.
     Nuvem ainda sem a rota nova (publicar.ps1 não rodou): usa a fila da 2.13. */
  function enderecoNuvemSeguro(endereco) {
    try {
      const u = new URL(endereco);
      return !u.username && !u.password && !u.search && !u.hash
        && (u.protocol === 'https:' || (u.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(u.hostname)));
    } catch { return false; }
  }
  async function sincronizarNuvem() {
    if (cfg.demo || !enderecoNuvemSeguro(cfg.nuvemUrl) || !cfg.nuvemToken || sync.enviandoNuvem) return;
    if (Date.now() - (cfg.ultimoContato || 0) < 2 * 60000 || Date.now() - (sync.nuvemEm || 0) < 20000) return;
    if (sync.nuvemAntiga) return mandarParaNuvem();
    sync.enviandoNuvem = true; sync.nuvemEm = Date.now();
    const token = cfg.nuvemToken, url = cfg.nuvemUrl;
    let mudou = false;
    try {
      if (cfg.nuvemSeq == null) cfg.nuvemSeq = cfg.ultimoSeq || 0; // começa de onde parou com a central
      for (let volta = 0; volta < 6; volta++) {
        const lista = Object.values(registros).filter((r) => !r.sincronizado && !r.esperaEntrar && r.naNuvem !== r.atualizadoEm).slice(0, 200);
        const corpo = lista.map(({ sincronizado, naNuvem, esperaEntrar, ...r }) => (r.data === 'config' ? Object.assign(r, { base: r.rev || 0 }) : r));
        const r = await fetch(`${cfg.nuvemUrl.replace(/\/+$/, '')}/aparelho/sync`, {
          method: 'POST', cache: 'no-store', redirect: 'error',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.nuvemToken, 'X-Aparelho': cfg.deviceId },
          body: JSON.stringify({ registros: corpo, geracao: cfg.geracao || '', desdeSeq: cfg.nuvemSeq || 0, desdeOrdem: cfg.nuvemOrdem || 0, desdeDia: primeiroDiaGuardado() }),
        });
        if (cfg.nuvemToken !== token || cfg.nuvemUrl !== url) return;
        marcarNuvem(r.status < 500);
        if (r.status === 404) { sync.nuvemAntiga = true; sync.enviandoNuvem = false; sync.nuvemEm = 0; return mandarParaNuvem(); }
        if (r.status === 423) { conferirNaNuvem(true); return; } // bloqueado: a nuvem diz como
        // 2.16: pela nuvem, a senha mudou, a pessoa foi desativada ou perdeu Relatórios e Escritório: entra de novo
        if (r.status === 401 && cfg.soNuvem) { sairDaNuvem(); toast('O acesso pela nuvem acabou (a senha mudou ou a permissão foi tirada). Entre de novo.', 'erro'); return; }
        if (!r.ok) return; // 409: a nuvem é de outra central (zerada ou trocada); espera falar com a central
        const d = await r.json();
        if (cfg.nuvemToken !== token || cfg.nuvemUrl !== url) return;
        versaoNaSincronizacao(d.telas); // 2.16: sem a central, quem avisa da versão nova é a nuvem
        lista.forEach((x) => { const local = registros[x.id]; if (local && local.atualizadoEm === x.atualizadoEm) local.naNuvem = x.atualizadoEm; });
        for (const rec of d.registros || []) {
          const local = registros[rec.id];
          if (!local || (!local.esperaEntrar && rec.atualizadoEm > local.atualizadoEm)) { registros[rec.id] = Object.assign({}, rec, { sincronizado: true }); mudou = true; }
        }
        cfg.nuvemSeq = Math.max(cfg.nuvemSeq || 0, Number(d.seq) || 0);
        cfg.nuvemOrdem = Math.max(cfg.nuvemOrdem || 0, Number(d.ordem) || 0);
        salvarRegistros(); salvarCfg();
        if (lista.length && !sync.avisouNuvem) { sync.avisouNuvem = true; toast('Sem a central: as anotações vão pela nuvem e as dos outros chegam por ela.', 'ok'); }
        if (!d.mais) break;
      }
      if (mudou) { podar(); salvarRegistros(); }
    } catch (e) { marcarNuvem(false); /* sem internet: tenta de novo depois */ } finally { sync.enviandoNuvem = false; }
    if (mudou && ['central', 'inicio', 'prancheta', 'aparelhos'].includes(view().tela)) { if (podeRedesenhar()) render(); else redesenharDepois = true; }
    atualizarConexao();
  }
  async function mandarParaNuvem() {
    if (cfg.demo || !enderecoNuvemSeguro(cfg.nuvemUrl) || !cfg.nuvemToken || sync.enviandoNuvem) return;
    if (Date.now() - (cfg.ultimoContato || 0) < 2 * 60000 || Date.now() - (sync.nuvemEm || 0) < 60000) return;
    const lista = Object.values(registros).filter((r) => !r.sincronizado && !r.esperaEntrar && r.naNuvem !== r.atualizadoEm).slice(0, 200);
    if (!lista.length) return;
    sync.enviandoNuvem = true; sync.nuvemEm = Date.now();
    const token = cfg.nuvemToken, url = cfg.nuvemUrl;
    try {
      const corpo = lista.map(({ sincronizado, naNuvem, esperaEntrar, ...r }) => (r.data === 'config' ? Object.assign(r, { base: r.rev || 0 }) : r));
      const r = await fetch(`${cfg.nuvemUrl.replace(/\/+$/, '')}/fila`, {
        method: 'POST', cache: 'no-store', redirect: 'error',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.nuvemToken, 'X-Aparelho': cfg.deviceId },
        body: JSON.stringify({ registros: corpo, geracao: cfg.geracao || '' }),
      });
      if (cfg.nuvemToken !== token || cfg.nuvemUrl !== url) return;
      marcarNuvem(r.status < 500);
      if (r.status === 401 && cfg.soNuvem) { sairDaNuvem(); return; }
      if (!r.ok) return;
      lista.forEach((x) => { const local = registros[x.id]; if (local && local.atualizadoEm === x.atualizadoEm) local.naNuvem = x.atualizadoEm; });
      salvarRegistros();
      if (!sync.avisouNuvem) { sync.avisouNuvem = true; toast('Sem a central: as anotações foram pela internet. A central pega quando puder.', 'ok'); }
    } catch (e) { /* sem internet também: tenta de novo daqui a um minuto */ } finally { sync.enviandoNuvem = false; }
  }
  /* A hora de cada anotação vem do relógio do aparelho. Se ele estiver muito diferente da central,
     avisa (a folha do dia e o turno dependem da hora certa). */
  function conferirRelogio(diferenca) {
    sync.relogio = diferenca;
    const minutos = Math.round(diferenca / 60000);
    if (Math.abs(minutos) < 5) { sync.avisoRelogio = 0; return; }
    if (Date.now() - (sync.avisoRelogio || 0) < 30 * 60000) return;
    sync.avisoRelogio = Date.now();
    toast(`O relógio deste aparelho está ${Math.abs(minutos)} min ${minutos > 0 ? 'atrasado' : 'adiantado'}. Acerte a hora nos ajustes do Android.`, 'erro');
  }
  const textoRelogio = () => {
    if (sync.relogio == null) return 'ainda não conferido';
    const m = Math.round(sync.relogio / 60000);
    return Math.abs(m) < 2 ? 'certo' : `${Math.abs(m)} min ${m > 0 ? 'atrasado' : 'adiantado'}`;
  };
  const LOTE_ENVIO = 300;
  let syncTimer = null;
  function sincronizarLogo() { clearTimeout(syncTimer); syncTimer = setTimeout(sincronizar, 400); atualizarConexao(); }
  /** Apaga as anotações guardadas neste aparelho (a configuração da usina fica). */
  function zerarLocal(geracao) {
    Object.keys(registros).forEach((id) => { if (registros[id].data !== 'config') delete registros[id]; });
    salvarRegistros();
    cfg.ultimoSeq = 0; cfg.geracao = geracao || ''; salvarCfg();
    rascunho = null; ed.alvoId = null;
    Object.keys(lembrar).forEach((k) => delete lembrar[k]);
    pilha = [telaInicial()];
    if (cfg.papel && !ehCentral() && !operadorAtual()) pilha.push({ tela: 'operador' });
  }
  /** Tablet chefe abrindo um dia que não está mais guardado nele: busca as anotações na central.
      Devolve uma promessa: quem vai gerar o relatório de um dia antigo espera ele chegar. */
  const promessasDoDia = new Map();
  function buscarDia(data) {
    if (cfg.demo || !cfg.chave || !/^\d{4}-\d{2}-\d{2}$/.test(data || '') || data >= primeiroDiaGuardado()) return Promise.resolve();
    if (promessasDoDia.has(data)) return promessasDoDia.get(data);
    const promessa = (async () => {
      diasAbertos.add(data); diasBuscando.add(data);
      try {
        const r = await buscar('api/registros?dia=' + data, {}, 20000);
        if (!r.ok) throw new Error('central');
        const dados = await r.json();
        (dados.registros || []).forEach((rec) => {
          const local = registros[rec.id];
          if (!local || (!local.esperaEntrar && rec.atualizadoEm > local.atualizadoEm)) registros[rec.id] = Object.assign({}, rec, { sincronizado: true });
        });
        salvarRegistros();
      } catch (e) {
        diasAbertos.delete(data); promessasDoDia.delete(data); // na próxima vez tenta de novo
        toast(`Não consegui buscar a folha de ${fmtData(data)} na central`, 'erro');
      }
      diasBuscando.delete(data);
      if (podeRedesenhar()) render(); else redesenharDepois = true;
    })();
    promessasDoDia.set(data, promessa);
    return promessa;
  }
  function desconectar(msg) { cfg.chave = null; salvarCfg(); pilha = [{ tela: 'conectar' }]; render(); toast(msg, 'erro'); }

  function textoConexao() {
    const p = pendentes();
    if (cfg.demo) return 'Demonstração, dados só neste aparelho';
    if (sync.modo === 'online') return p ? `Enviando ${contar(p, 'anotação', 'anotações')}` : 'Tudo enviado para a central';
    if (nuvemLeva()) { const n = faltamNaNuvem(); return n ? `Sem a central. Enviando ${contar(n, 'anotação', 'anotações')} pela nuvem` : 'Sem a central. Tudo enviado pela nuvem'; }
    if (sync.modo === 'offline') return p ? `Sem conexão. ${contar(p, 'anotação guardada', 'anotações guardadas')} aqui` : 'Sem conexão. Pode anotar: fica guardado aqui';
    return 'Procurando a central';
  }
  const classeConexao = () => (cfg.demo ? '' : sync.modo === 'online' || nuvemLeva() ? 'ok' : sync.modo === 'offline' ? 'off' : '');
  const subtituloDaFolha = (data) => `Folha de ${fmtData(data)}, ${cfg.demo ? 'demonstração' : sync.modo === 'online' ? (pendentes() ? 'enviando para a central' : 'tudo enviado para a central') : sync.modo === 'offline' ? 'guardando no aparelho' : 'procurando a central'}`;
  function atualizarConexao() {
    const el = document.getElementById('conexao');
    if (el) { el.className = `conexao ${classeConexao()}`; el.innerHTML = `<i></i>${esc(textoConexao())}`; }
    const st = document.getElementById('status-con');
    if (st) st.innerHTML = luzesConexao();
    const sub = document.getElementById('subtitulo-topo');
    const v = view();
    if (sub && v && v.tela === 'prancheta') sub.textContent = subtituloDaFolha(dataDaView(v));
  }
