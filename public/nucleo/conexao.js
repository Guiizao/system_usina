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
  /* 3.0: o banco é a fonte de tudo. Quem tem a chave dele fala direto com ele, pelas mesmas rotas da central; a central
     (ponte do Wi-Fi) entra quando não há internet. A anotação fica primeiro aqui no aparelho: nada se perde se os dois caírem. */
  const NO_BANCO = /^api\/(sync|registros|registro|status|pessoas|chefes|aparelhos|liberar)(\?|$)/;
  // computador pela nuvem numa nuvem de antes da 3.0 (ainda sem o banco): só vê
  const soVer = () => cfg.soNuvem && !!sync.bancoAntigo;
  const usarBanco = () => !cfg.demo && !sync.bancoAntigo && enderecoNuvemSeguro(cfg.nuvemUrl) && !!cfg.nuvemToken && !(sync.bancoForaAte > Date.now());
  async function pedirAoBanco(caminho, opcoes = {}, ms = 4000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(`${cfg.nuvemUrl.replace(/\/+$/, '')}/banco/${caminho}`, Object.assign({}, opcoes, {
        cache: 'no-store', redirect: 'error', signal: ctrl.signal,
        headers: Object.assign({}, opcoes.headers, { Authorization: 'Bearer ' + cfg.nuvemToken, 'X-Aparelho': cfg.deviceId }),
      }));
      marcarNuvem(r.status < 500);
      if (r.status === 423) {
        const d = await r.clone().json().catch(() => ({}));
        conhecerCentralDoBloqueio(d.geracao);
        aplicarBloqueio(d.bloqueio);
      }
      return r;
    } finally { clearTimeout(t); }
  }
  // entrar e sair valem também na ponte, para ela saber quem está no aparelho quando a internet cair
  const TAMBEM_NA_PONTE = /"acao":"(entrar|sair|liberar)"/;
  async function buscar(caminho, opcoes = {}, ms = 4000) {
    if (NO_BANCO.test(caminho) && usarBanco()) {
      try {
        const r = await pedirAoBanco(caminho, opcoes, ms);
        if (r.status === 404) sync.bancoAntigo = true;
        else if (r.status < 500) {
          if (r.ok && cfg.chave && TAMBEM_NA_PONTE.test(opcoes.body || '')) pedirCifrado(baseCentral(), caminho, opcoes, 4000).catch(() => {});
          return r;
        } else if (r.status !== 501) sync.bancoForaAte = Date.now() + 30000;
      } catch (e) { sync.bancoForaAte = Date.now() + 30000; marcarNuvem(false); }
    }
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
    if (cfg.soNuvem && !cfg.pessoa) return; // 2.16: pela nuvem, só depois de entrar
    if (cfg.demo || (!cfg.chave && !cfg.soNuvem) || sync.ocupado) return;
    const viaBanco = usarBanco();
    if (cfg.soNuvem && !viaBanco) return sincronizarNuvem();
    // 3.0: o banco só é chamado com motivo (o plano grátis conta os pedidos): algo para mandar, um aviso ou um tempo sem falar
    if (viaBanco && !bancoPrecisa()) return;
    const pedir = viaBanco ? pedirAoBanco : buscar;
    const cursor = viaBanco ? 'bancoSeq' : 'ultimoSeq';
    sync.ocupado = true;
    try {
      if (viaBanco) {
        sync.temNovidade = false; sync.bancoEm = Date.now();
        if (baseCentral() && Date.now() - (sync.centralEm || 0) > 30000) {
          sync.centralEm = Date.now();
          buscar('api/ping', {}, 1500).then((r) => r.json()).then((d) => { sync.centralOk = d.app === 'pranchetas'; }).catch(() => { sync.centralOk = false; }).finally(atualizarConexao);
        }
      } else {
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
      }

      // liberado aqui com a senha de desbloqueio: a central fica sabendo (e confere a senha de novo)
      if (cfg.liberacao) {
        const rl = await pedir('api/liberar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: cfg.liberacao.codigo, em: cfg.liberacao.em, rev: cfg.liberacao.rev || 0, geracao: cfg.liberacao.geracao || '' }) }, 10000);
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
      const r1 = await pedir('api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aparelho: cfg.deviceId, papel: cfg.papel, nome: nomeDesteAparelho(), info: infoAparelho, tipo: tipoParaSincronia(), rede: (navigator.connection || {}).type || '', operador: operadorAtual(), versao: VERSAO, geracao: cfg.geracao || '', novaConexao: !!cfg.novaConexao, registros: envio, erros }) }, 15000);
      if (viaBanco) {
        if (r1.status === 401) {
          // a chave do banco não vale mais: pela nuvem, entra de novo; com a ponte do Wi-Fi, continua por ela
          if (cfg.soNuvem) { sairDaNuvem(); toast('O acesso pela nuvem acabou (a senha mudou ou a permissão foi tirada). Entre de novo.', 'erro'); return; }
          cfg.nuvemToken = ''; salvarCfg();
          sync.nuvemErro = 'A nuvem recusou a chave deste aparelho: ligue-o uma vez no Wi-Fi da central';
          return;
        }
        if (r1.status === 404) { sync.bancoAntigo = true; return; }
        if (r1.status >= 500) throw new Error('banco fora');
        sync.modo = 'online'; sync.falhas = 0; sync.viaBanco = true; sync.nuvemErro = '';
        cfg.ultimoContato = Date.now(); salvarCfg();
        ligarAoVivo();
      } else sync.viaBanco = false;
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
      if (resp1.zerar) {
        if (!resp1.zerada) {
          if (!sync.avisoZerarAntiga) { sync.avisoZerarAntiga = true; avisarCentralAntiga(); }
          return;
        }
        try { zerarLocal(resp1.geracao); } catch (e) { return; }
        toast('O escritório zerou as anotações. Este aparelho começou do zero.'); render(true); return;
      }
      if (r1.ok && resp1.geracao && resp1.geracao !== cfg.geracao) {
        // conectou numa central nova (tablet chefe trocado ou reinstalado): manda de novo o que este aparelho guarda,
        // para a central não começar vazia
        const outraCentral = !!cfg.geracao;
        cfg.geracao = resp1.geracao; cfg.ultimoSeq = 0; cfg.bancoSeq = 0; cfg.nuvemSeq = null; cfg.nuvemOrdem = 0;
        if (outraCentral) {
          // o que é de outro setor a central recusaria daqui: ele vai pelo api/devolver, junto com a pasta
          Object.values(registros).forEach((r) => { if (!envio.includes(r) && (ehCentral() || r.data === 'config' || (setorDaPrancheta(r.prancheta) || { id: cfg.papel }).id === cfg.papel)) r.sincronizado = false; });
          salvarRegistros();
          cfg.copiaSeq = 0;
          if (!viaBanco) cfg.devolverPendente = true;
        }
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
          else if (local && local.data === 'config') local.sincronizado = true; // 3.0: recusar nunca apaga a configuração que só este aparelho tem
          else delete registros[x.id];
        });
        if (recusados.length) avisarRecusa(recusados);
        // a central não tem mais ninguém dentro deste aparelho (o nível mudou, a pessoa saiu de outro jeito): entra de novo
        if (semSessao && cfg.pessoa) { cfg.pessoa = null; salvarCfg(); render(); }
        envio.forEach((e) => { const atual = registros[e.id]; if (!ids.has(e.id) && atual && atual.atualizadoEm === e.atualizadoEm && atual.valores === e.valores) { atual.sincronizado = true; delete atual.esperaEntrar; } });
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
        if (typeof resp.nuvem === 'string' && resp.nuvem !== (cfg.nuvemUrl || '') && (resp.nuvem || !cfg.ativadoNoBanco)) { cfg.nuvemUrl = resp.nuvem; salvarCfg(); }
        // a chave deste aparelho para a fila da nuvem (versão 2.13), para quando estiver longe da central
        if (typeof resp.nuvemToken === 'string' && resp.nuvemToken !== (cfg.nuvemToken || '')) { cfg.nuvemToken = resp.nuvemToken; salvarCfg(); }
        sync.avisouNuvem = false;
        // tablet chefe (versão 2.12): de minuto em minuto confere com a central quem está aqui e o que pode
        if (ehCentral() && cfg.pessoa && Date.now() - (sync.quemEm || 0) > 60000) { sync.quemEm = Date.now(); conferirSessao(); }
      }
      let mudou = false;
      // o aparelho passou a guardar mais dias (virou tablet chefe): busca de novo, desde o começo
      const corte = primeiroDiaGuardado();
      if (cfg.corteSync && corte < cfg.corteSync) { cfg.ultimoSeq = 0; cfg.bancoSeq = 0; }
      const r2 = await pedir(`api/registros?desde=${cfg[cursor] || 0}&aPartirDe=${corte}`, {}, 15000);
      if (r2.ok) {
        const dados = await r2.json();
        for (const rec of dados.registros) {
          if (receberRegistro(rec)) mudou = true;
        }
        cfg[cursor] = dados.seq; cfg.corteSync = corte; salvarCfg();
        if (dados.mais) { sync.temNovidade = true; sincronizarLogo(); } // ainda tem: o banco manda em páginas
        if (mudou) { podar(); salvarRegistros(); }
      }
      if (ehCentral()) {
        const r3 = await pedir('api/status');
        if (r3.ok) {
          let texto = await r3.text();
          // com o servidor neste aparelho, o painel também mostra o que só ele sabe (pastas, endereços, código)
          if (viaBanco && centralNoTablet()) {
            const lan = await pedirCifrado(baseCentral(), 'api/status', {}, 3000).catch(() => null);
            const local = lan && lan.ok ? await lan.json().catch(() => null) : null;
            if (local) texto = JSON.stringify(Object.assign(local, { aparelhos: JSON.parse(texto).aparelhos }));
          }
          // só redesenha se algo mudou de verdade, para não pular a tela de quem está olhando
          if (texto !== sync.statusJson) { sync.statusJson = texto; sync.status = JSON.parse(texto); mudou = true; }
          verificarBase44();
        }
      }
      if (mudou && ['central', 'inicio', 'prancheta', 'config', 'aparelhos', 'configurar', 'trocar-funcao'].includes(view().tela)) {
        if (podeRedesenhar()) render(); else redesenharDepois = true;
      }
      if (mudou && view().tela === 'avisos') atualizarTelaAvisos();
      revisarAvisoNaTela();
      verificarAvisos();
      if (envio.length === LOTE_ENVIO) sincronizarLogo(); // ainda tem anotação esperando: manda o próximo lote
      if (cfg.devolverPendente && !viaBanco) devolverCopias();
    } catch (e) {
      if (viaBanco) {
        // o banco não respondeu: na próxima volta vai pela ponte do Wi-Fi (ou fica guardado aqui)
        sync.bancoForaAte = Date.now() + 30000; sync.viaBanco = false; marcarNuvem(false);
        if (cfg.soNuvem) sync.modo = 'offline';
        return;
      }
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
  async function sincronizarNuvem(forcar) {
    // 3.0: esta troca (2.14) só continua para falar com uma nuvem que ainda não tem o banco
    if (!sync.bancoAntigo) return;
    if (cfg.demo || !enderecoNuvemSeguro(cfg.nuvemUrl) || !cfg.nuvemToken || sync.enviandoNuvem) return;
    if (!forcar && (Date.now() - (cfg.ultimoContato || 0) < 2 * 60000 || Date.now() - (sync.nuvemEm || 0) < 20000)) return;
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
        // 2.18: a janela Conexão diz por que a nuvem não troca (antes só a luz, que ficava acesa com a chave recusada)
        sync.nuvemErro = r.ok ? '' : r.status === 401 ? 'A nuvem recusou a chave deste aparelho: ligue-o uma vez no Wi-Fi da central' : `A nuvem respondeu ${r.status}`;
        marcarNuvem(r.status < 500);
        if (r.status === 404) { sync.nuvemAntiga = true; sync.enviandoNuvem = false; sync.nuvemEm = 0; return mandarParaNuvem(); }
        if (r.status === 423) { conferirNaNuvem(true); return; } // bloqueado: a nuvem diz como
        // 2.16: pela nuvem, a senha mudou, a pessoa foi desativada ou perdeu Relatórios e Escritório: entra de novo
        if (r.status === 401 && cfg.soNuvem) { sairDaNuvem(); toast('O acesso pela nuvem acabou (a senha mudou ou a permissão foi tirada). Entre de novo.', 'erro'); return; }
        if (!r.ok) return; // 409: a nuvem é de outra central (zerada ou trocada); espera falar com a central
        const d = await r.json();
        if (cfg.nuvemToken !== token || cfg.nuvemUrl !== url) return;
        // 2.17: quem entrou pela nuvem recebe a lista dos aparelhos da usina (o painel do PC mostra quem está ligado)
        if (Array.isArray(d.aparelhos)) {
          const j = JSON.stringify([d.aparelhos, d.aparelhosEm]);
          if (j !== sync.aparelhosNuvemJson) { sync.aparelhosNuvemJson = j; sync.aparelhosNuvem = d.aparelhos; sync.aparelhosNuvemEm = Number(d.aparelhosEm) || 0; mudou = true; }
        }
        versaoNaSincronizacao(d.telas); // 2.16: sem a central, quem avisa da versão nova é a nuvem
        lista.forEach((x) => { const local = registros[x.id]; if (local && local.atualizadoEm === x.atualizadoEm && local.valores === x.valores) local.naNuvem = x.atualizadoEm; });
        for (const rec of d.registros || []) {
          if (receberRegistro(rec)) mudou = true;
        }
        cfg.nuvemSeq = Math.max(cfg.nuvemSeq || 0, Number(d.seq) || 0);
        cfg.nuvemOrdem = Math.max(cfg.nuvemOrdem || 0, Number(d.ordem) || 0);
        salvarRegistros(); salvarCfg();
        if (lista.length && !sync.avisouNuvem) { sync.avisouNuvem = true; toast('Sem a central: as anotações vão pela nuvem e as dos outros chegam por ela.', 'info'); }
        if (!d.mais) break;
      }
      if (mudou) { podar(); salvarRegistros(); }
    } catch (e) { sync.nuvemErro = 'Sem internet ou a nuvem não respondeu'; marcarNuvem(false); /* tenta de novo depois */ } finally { sync.enviandoNuvem = false; }
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
      lista.forEach((x) => { const local = registros[x.id]; if (local && local.atualizadoEm === x.atualizadoEm && local.valores === x.valores) local.naNuvem = x.atualizadoEm; });
      salvarRegistros();
      if (!sync.avisouNuvem) { sync.avisouNuvem = true; toast('Sem a central: as anotações foram pela internet. A central pega quando puder.', 'info'); }
    } catch (e) { /* sem internet também: tenta de novo daqui a um minuto */ } finally { sync.enviandoNuvem = false; }
  }
  /* A hora de cada anotação vem do relógio do aparelho. Se ele estiver muito diferente da central,
     avisa (a folha do dia e o turno dependem da hora certa). */
  function conferirRelogio(diferenca) {
    sync.relogio = diferenca;
    // 3.0: "o mais novo ganha" vale pela hora do servidor, não pela deste aparelho (fica guardado: ele pode reabrir sem rede)
    const desvio = Math.abs(diferenca) < 5000 ? 0 : Math.round(diferenca);
    if (desvio !== (cfg.desvioRelogio || 0)) { cfg.desvioRelogio = desvio; salvarCfg(); }
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
  const tipoParaSincronia = () => (document.documentElement.dataset.pc === '1' ? 'computador' : Math.min(screen.width || 0, screen.height || 0) < 600 ? 'celular' : 'tablet');
  /** O banco é chamado se há o que mandar, se ele avisou que mudou algo, ou depois de um tempo sem falar. */
  function bancoPrecisa() {
    if (sync.temNovidade || !sync.bancoEm) return true;
    if (Object.values(registros).some((r) => !r.sincronizado && !r.esperaEntrar)) return Date.now() - sync.bancoEm >= 800;
    return Date.now() - sync.bancoEm >= (sync.aoVivo ? 60000 : 15000);
  }
  /* A sala do banco: uma conexão aberta que avisa na hora quando outro aparelho muda algo. Se cair, o aparelho pergunta de 15 em 15 segundos. */
  let aoVivo = null, esperaAoVivo = 2000, pingAoVivo = null;
  function ligarAoVivo() {
    if (aoVivo || typeof WebSocket === 'undefined' || !usarBanco() || (cfg.soNuvem && !cfg.pessoa)) return;
    let ws;
    try { ws = new WebSocket(`${cfg.nuvemUrl.replace(/\/+$/, '').replace(/^http/, 'ws')}/banco/aovivo?a=${encodeURIComponent(cfg.deviceId)}`, ['pranchetas', cfg.nuvemToken]); } catch (e) { return; }
    aoVivo = ws;
    ws.onopen = () => {
      sync.aoVivo = true; esperaAoVivo = 2000;
      clearInterval(pingAoVivo);
      pingAoVivo = setInterval(() => { try { ws.send('ping'); } catch (e) { /* o onclose cuida */ } }, 45000);
      atualizarConexao();
    };
    ws.onmessage = (e) => {
      if (e.data === 'pong') return;
      let d = null;
      try { d = JSON.parse(e.data); } catch (x) { return; }
      if (d.tipo === 'rascunho') return receberRascunho(d);
      if (d.tipo === 'estado') sync.quemEm = 0;
      if (d.tipo === 'estado' || (d.de !== cfg.deviceId && Number(d.seq) > (cfg.bancoSeq || 0))) { sync.temNovidade = true; sincronizarLogo(); }
    };
    ws.onclose = () => {
      sync.aoVivo = false; aoVivo = null;
      clearInterval(pingAoVivo);
      setTimeout(ligarAoVivo, esperaAoVivo);
      esperaAoVivo = Math.min(60000, esperaAoVivo * 2);
      atualizarConexao();
    };
    ws.onerror = () => { try { ws.close(); } catch (e) { /* já fechou */ } };
  }
  /* 3.0: o que outro aparelho está digitando chega de segundo em segundo pela sala, sem passar pelo banco: ainda não é
     anotação e some se ele não salvar. Com internet passa pela sala do banco; só no Wi-Fi, pela central, de 2 em 2 segundos. */
  const rascunhosDeOutros = new Map();
  const RASCUNHO_VALE_MS = 15000;
  function receberRascunho(d) {
    const id = `${d.data}|${d.pid}|${d.chave}`;
    if (d.valores) rascunhosDeOutros.set(id, { quem: d.quem || 'Outro aparelho', chave: d.chave, valores: d.valores, em: Date.now(), peloWifi: !!d.peloWifi });
    else rascunhosDeOutros.delete(id);
    mostrarRascunhoDeOutro();
  }
  function mostrarRascunhoDeOutro() {
    const v = view(), agora = Date.now();
    rascunhosDeOutros.forEach((x, id) => { if (agora - x.em > RASCUNHO_VALE_MS) rascunhosDeOutros.delete(id); });
    const prefixo = v && v.tela === 'prancheta' ? `${dataDaView(v)}|${v.pid}|` : null;
    const achado = prefixo && [...rascunhosDeOutros].find(([id]) => id.startsWith(prefixo));
    let el = document.getElementById('rascunho-outro');
    if (!achado) { if (el) el.remove(); return; }
    const x = achado[1];
    const nomes = alvos.filter((a) => a.id in x.valores && typeof x.valores[a.id] !== 'object' && x.valores[a.id] !== '').slice(0, 4).map((a) => `${a.labelCurto || a.label}: ${fmtNum(String(x.valores[a.id]))}`);
    const texto = `${x.quem} está anotando a linha ${x.chave}, ainda não salvo${nomes.length ? `: ${nomes.join(', ')}` : ''}`;
    const main = document.querySelector('main');
    if (!main) return;
    if (!el) { el = document.createElement('p'); el.id = 'rascunho-outro'; el.className = 'aviso atencao rascunho-outro'; main.prepend(el); }
    if (el.textContent !== texto) el.textContent = texto;
  }
  let rascunhoMandado = null, rascunhoWifiEm = 0, rascunhoWifiOcupado = false;
  async function rascunhoPeloWifi(agora, naFolha) {
    if (cfg.demo || cfg.soNuvem || !cfg.chave || sync.modo !== 'online' || rascunhoWifiOcupado || Date.now() - rascunhoWifiEm < 2000) return;
    if (!naFolha && !rascunhoMandado) return; // fora da folha não precisa ficar perguntando
    rascunhoWifiEm = Date.now(); rascunhoWifiOcupado = true;
    try {
      const r = await postJson('api/rascunho', { rascunho: agora && JSON.stringify(agora).length <= 7000 ? agora : null }, 1800);
      if (!r.ok) return;
      rascunhoMandado = agora;
      const vieram = (await r.json()).rascunhos || [], ids = new Set(vieram.map((x) => `${x.data}|${x.pid}|${x.chave}`));
      rascunhosDeOutros.forEach((x, id) => { if (x.peloWifi && !ids.has(id)) rascunhosDeOutros.delete(id); });
      vieram.forEach((x) => receberRascunho(Object.assign(x, { peloWifi: true })));
      mostrarRascunhoDeOutro();
    } catch (e) { /* a central não respondeu: o sincronizar cuida do aviso */ } finally { rascunhoWifiOcupado = false; }
  }
  function mandarRascunho() {
    if (rascunhosDeOutros.size) mostrarRascunhoDeOutro();
    const v = view();
    const agora = v && v.tela === 'prancheta' && rascunhoSujo() ? { tipo: 'rascunho', pid: v.pid, data: dataDaView(v), chave: String(rascunho.chave), quem: quemEstaAqui(), valores: rascunho.valores } : null;
    if (!aoVivo || aoVivo.readyState !== 1) return rascunhoPeloWifi(agora, !!v && v.tela === 'prancheta');
    if (JSON.stringify(agora) === JSON.stringify(rascunhoMandado)) return;
    // salvou ou desistiu: avisa uma vez, para o aviso sumir na hora nos outros
    const texto = JSON.stringify(agora || Object.assign({}, rascunhoMandado, { valores: null }));
    if (texto.length <= 7000) { try { aoVivo.send(texto); } catch (e) { /* o onclose cuida */ } }
    rascunhoMandado = agora;
  }
  if (!DEMO_IMG) setInterval(mandarRascunho, 1000);

  /* 3.0: todo aparelho guarda uma cópia em Documentos/Usina/BackupUsina. No APK vai pelo plugin; no programa do Windows, pela ponte da janela.
     São dois arquivos: copia-<aparelho>.json, com o que está na memória dele (inclusive o que ainda não subiu), e um por dia, com o dia inteiro de todos os setores. */
  const temPastaDeCopia = () => !cfg.demo && !DEMO_IMG && (!!window.pranchetasPC || (NO_APK && !!pluginCentral && !!pluginCentral.guardarCopia));
  const gravarNaPasta = (nome, texto) => (window.pranchetasPC ? window.pranchetasPC.guardarCopia(nome, texto) : pluginCentral.guardarCopia({ nome, texto }));
  /** O que o arquivo daquele dia tem. Sem o arquivo, ou num aplicativo que ainda não sabe ler: nada. */
  async function lerDaPasta(nome) {
    try {
      const r = window.pranchetasPC ? await window.pranchetasPC.lerCopia(nome) : await pluginCentral.lerCopia({ nome });
      const lista = JSON.parse((typeof r === 'string' ? r : r && r.texto) || '[]');
      return Array.isArray(lista) ? lista.filter((x) => x && x.id && (x.atualizadoEm || 0) >= (cfg.zeradoEm || 0)) : [];
    } catch (e) { return []; }
  }
  /** Falta de dado nunca apaga: o arquivo fica com o que já tinha, e em cada linha ganha a mais nova (um banco ou uma central vazia não esvazia a cópia). */
  async function juntarComAPasta(nome, novos) {
    const porId = new Map((await lerDaPasta(nome)).map((x) => [x.id, x]));
    novos.forEach((x) => {
      const a = porId.get(x.id), junto = Juncao.juntar(a, x);
      if (junto) porId.set(x.id, junto); else if (!a || (x.atualizadoEm || 0) >= (a.atualizadoEm || 0)) porId.set(x.id, x);
    });
    return [...porId.values()];
  }
  function copiaDoAparelho() {
    const lista = Object.values(registros).map((r) => {
      if (r.data !== 'config' || !r.valores || !r.valores.operadores) return r;
      // sem as senhas dos operadores: o arquivo fica numa pasta que outros aplicativos podem ler
      const operadores = Object.fromEntries(Object.entries(r.valores.operadores).map(([s, l]) => [s, (l || []).map((o) => comoOperador(o).nome)]));
      return Object.assign({}, r, { valores: Object.assign({}, r.valores, { operadores }) });
    });
    return JSON.stringify({ versao: VERSAO, em: Date.now(), aparelho: cfg.deviceId, papel: cfg.papel || '', registros: lista });
  }
  let copiaGuardada = -1;
  async function guardarCopia(mesmoSemMudar) {
    if (!temPastaDeCopia()) return false;
    if (!mesmoSemMudar && versaoRegistros === copiaGuardada) return false;
    copiaGuardada = versaoRegistros;
    try { await gravarNaPasta(`copia-${cfg.deviceId}.json`, copiaDoAparelho()); return true; } catch (e) { guardarErro('Não consegui guardar a cópia', e.message); return false; }
  }
  if (!DEMO_IMG) setInterval(guardarCopia, 10 * 60000);
  /* Puxa do banco (só no Wi-Fi, da central) os dias que mudaram e guarda inteiros, no formato do BackupUsina da central. O tablet de setor só
     mantém 3 dias na memória: é isto que deixa os dados em todo aparelho. A central no tablet já guarda os dela. */
  const DIAS_NA_PASTA = 730; // 2 anos: um arquivo por dia, dezenas de KB cada
  let copiandoDias = false;
  async function guardarDias() {
    if (!temPastaDeCopia() || copiandoDias || centralNoTablet() || (cfg.soNuvem && !cfg.pessoa)) return 0;
    const viaBanco = usarBanco();
    if (!viaBanco && (cfg.soNuvem || !cfg.chave)) return 0;
    const pedir = viaBanco ? pedirAoBanco : buscar, cursor = viaBanco ? 'copiaBancoSeq' : 'copiaSeq', desde = somarDias(dataProducao(), -DIAS_NA_PASTA);
    let dias = 0;
    copiandoDias = true;
    try {
      for (let volta = 0; volta < 50; volta++) {
        const r = await pedir(`api/registros?desde=${cfg[cursor] || 0}&aPartirDe=${desde}`, {}, 20000);
        if (!r.ok) return dias;
        const d = await r.json();
        for (const dia of new Set((d.registros || []).map((x) => x.data).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x) && x >= desde))) {
          const rd = await pedir(`api/registros?dia=${dia}`, {}, 20000);
          if (!rd.ok) return dias;
          await gravarNaPasta(`${dia}.json`, JSON.stringify(await juntarComAPasta(`${dia}.json`, (await rd.json()).registros || [])));
          dias++;
        }
        cfg[cursor] = d.seq; salvarCfg();
        if (!d.mais) break;
      }
    } catch (e) { /* sem conexão agora: na próxima volta continua de onde parou */ } finally { copiandoDias = false; }
    return dias;
  }
  if (!DEMO_IMG) { setTimeout(guardarDias, 60000); setInterval(guardarDias, 10 * 60000); }
  /* 3.0: conectou numa central nova (trocada, reinstalada, ou este aparelho virou servidor) com a nuvem fora: devolve o que guarda, da memória e da pasta.
     A central só pega o que não tem. Se cair no meio, tenta de novo na próxima sincronização. Com a nuvem ligada não precisa: a central baixa do banco. */
  let devolvendo = false;
  async function devolverCopias() {
    if (devolvendo || cfg.soNuvem || !cfg.chave) return 0;
    devolvendo = true;
    let aceitos = 0;
    const mandar = async (lista) => {
      const limpos = lista.filter((r) => r && r.data !== 'config' && (r.atualizadoEm || 0) >= (cfg.zeradoEm || 0)).map(({ sincronizado, naNuvem, esperaEntrar, doBanco, ...r }) => r);
      for (let i = 0; i < limpos.length; i += 300) {
        const r = await postJson('api/devolver', { registros: limpos.slice(i, i + 300) }, 20000);
        if (!r.ok) throw new Error('a central respondeu ' + r.status);
        aceitos += (await r.json()).aceitos || 0;
      }
    };
    try {
      await mandar(Object.values(registros));
      const pasta = !temPastaDeCopia() ? null : window.pranchetasPC || pluginCentral;
      if (pasta && pasta.listarCopias) {
        const r = await pasta.listarCopias();
        const desde = somarDias(dataProducao(), -DIAS_NA_PASTA);
        for (const nome of (r && r.nomes) || []) if (nome.slice(0, 10) >= desde) await mandar(await lerDaPasta(nome));
      }
      cfg.devolverPendente = false; salvarCfg();
      if (aceitos) { registrar('anotacao', `${nomeDesteAparelho()} devolveu ${contar(aceitos, 'anotação', 'anotações')} para a central nova`); toast(`Este aparelho devolveu ${contar(aceitos, 'anotação', 'anotações')} para a central nova`); }
    } catch (e) { guardarErro('Não consegui devolver as anotações à central', e.message); } finally { devolvendo = false; }
    return aceitos;
  }
  async function baixarCopia() {
    if (temPastaDeCopia()) return toast((await guardarCopia(true)) ? 'Cópia guardada em Documentos/Usina/BackupUsina' : 'Não consegui guardar a cópia', 'aviso');
    baixar(new File([copiaDoAparelho()], `copia-${cfg.deviceId}.json`, { type: 'application/json' }));
  }

  const LOTE_ENVIO = 300;
  let syncTimer = null;
  function sincronizarLogo() { clearTimeout(syncTimer); syncTimer = setTimeout(sincronizar, 400); atualizarConexao(); }
  /** Apaga as anotações guardadas neste aparelho (a configuração da usina fica). */
  function zerarLocal(geracao) {
    try {
      // LS.set esconde falhas de escrita; a cópia precisa estar gravada antes de apagar.
      localStorage.setItem('usina.antesDeZerar', JSON.stringify({ geracao: cfg.geracao || '', quando: Date.now(), registros }));
    } catch (e) {
      guardarErro('Não consegui guardar a cópia antes de zerar', e.message);
      toast('Não consegui guardar a cópia. As anotações continuam neste aparelho.', 'erro');
      throw e;
    }
    Object.keys(registros).forEach((id) => { if (registros[id].data !== 'config') delete registros[id]; });
    salvarRegistros();
    // zerar de propósito também vale para a pasta: o que era de antes não volta nem é devolvido a uma central nova
    cfg.ultimoSeq = 0; cfg.geracao = geracao || ''; cfg.copiaSeq = 0; cfg.copiaBancoSeq = 0; cfg.zeradoEm = Date.now(); cfg.devolverPendente = false; salvarCfg();
    rascunho = null; ed.alvoId = null;
    Object.keys(lembrar).forEach((k) => delete lembrar[k]);
    pilha = [telaInicial()];
    if (cfg.papel && !ehCentral() && !operadorAtual()) pilha.push({ tela: 'operador' });
  }
  /** Tablet chefe abrindo um dia que não está mais guardado nele: busca as anotações na central.
      Devolve uma promessa: quem vai gerar o relatório de um dia antigo espera ele chegar. */
  const promessasDoDia = new Map();
  function buscarDia(data) {
    if (cfg.demo || (!cfg.chave && !cfg.soNuvem) || !/^\d{4}-\d{2}-\d{2}$/.test(data || '') || data >= primeiroDiaGuardado()) return Promise.resolve();
    if (promessasDoDia.has(data)) return promessasDoDia.get(data);
    const promessa = (async () => {
      diasAbertos.add(data); diasBuscando.add(data);
      try {
        const r = await buscar('api/registros?dia=' + data, {}, 20000);
        if (!r.ok) throw new Error('central');
        const dados = await r.json();
        (dados.registros || []).forEach((rec) => {
          receberRegistro(rec);
        });
        salvarRegistros();
      } catch (e) {
        promessasDoDia.delete(data); // na próxima vez tenta de novo
        // sem banco e sem central: o dia pode estar na cópia deste aparelho
        const daCopia = temPastaDeCopia() ? await lerDaPasta(`${data}.json`) : [];
        if (daCopia.length) { daCopia.forEach((rec) => receberRegistro(rec)); salvarRegistros(); } else {
          diasAbertos.delete(data);
          toast(`Não consegui buscar a folha de ${fmtData(data)} na central`, 'erro');
        }
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
    if (sync.modo === 'online' && sync.viaBanco) return p ? `Enviando ${contar(p, 'anotação', 'anotações')}` : 'Tudo enviado para o banco';
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
