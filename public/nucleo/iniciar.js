/* Pranchetas Ubirálcool - início do aplicativo
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Início
   * ========================================================= */
  function iniciarImagens() {
    // ?demo&papel=hidrolise&op=Guilherme&tela=prancheta&pid=hid_anexo1&chave=9&campo=brix&teclas=18
    cfg.papel = params.get('papel') || null;
    if (params.get('tema')) { cfg.tema = params.get('tema'); aplicarTema(); }
    if (params.get('escala')) { cfg.escala = params.get('escala'); ajustarEscala(); }
    if (params.get('op')) definirOperador(params.get('op'));
    // &atualizacao=2.8.0 : como fica o alto da tela quando tem versão nova
    if (params.get('atualizacao')) atualizacao.nova = { tipo: params.get('rapida') ? 'telas' : 'apk', base: '/telas/', versao: params.get('atualizacao'), tamanho: 9751234, url: '/apk/pranchetas.apk', novidades: [{ versao: params.get('atualizacao'), itens: (window.NOVIDADES || [{}])[0].itens || [] }] };
    if (params.get('nomesLongos') && cfg.papel) cfg.operadores[cfg.papel] = ['Romenique', 'Maximiliano Aparecido', 'Carlindo Ferreira Júnior', 'Cleber', 'Guilherme', 'Wellington'];
    // demonstração da seção do Base44 (para conferir a tela)
    if (params.get('base44')) {
      const d = (n) => somarDias(dataProducao(), -n);
      base44Info = { ligado: true, temSegredo: true, url: 'https://sistema-do-escritorio-ubiralcool-7f3a9c.base44.app/functions/receberTotaisPranchetas', desde: d(5),
        enviados: { [d(1)]: { ok: true, em: Date.now() - 3600000, hash: 'a' }, [d(2)]: { ok: false, em: Date.now() - 600000, erro: 'Sem internet na central (ou endereço errado)' }, [d(3)]: { ok: true, em: Date.now() - 2 * 86400000, hash: 'b' } } };
    }
    preencherExemplo();
    Object.values(registros).forEach((r) => { r.sincronizado = true; });
    const tela = params.get('tela');
    sync.modo = 'online';
    if (tela === 'conectar') { cfg.demo = false; pilha = [{ tela: 'conectar' }]; }
    else if (tela === 'preparando') {
      pilha = [{ tela: 'preparando', fim: params.get('fim') === '1', passos: [
        { texto: 'Criando as pastas ServidorUsina, RelatoriosUsina e BackupUsina', estado: 'ok', detalhe: 'No aparelho e em Documentos/Usina' },
        { texto: 'Ligando o servidor na rede, porta 8080', estado: 'ok', detalhe: 'Servidor ligado' },
        { texto: 'Mantendo o servidor ligado com a tela apagada', estado: 'ok', detalhe: 'Aparece um aviso fixo na barra de notificações' },
        { texto: 'Procurando o endereço deste tablet no Wi-Fi', estado: params.get('fim') === '1' ? 'ok' : 'fazendo', detalhe: params.get('fim') === '1' ? 'http://192.168.0.20:8080' : '' },
      ].concat(params.get('fim') === '1' ? [{ texto: 'Testando o servidor', estado: 'ok', detalhe: 'Respondendo' }, { texto: 'Gerando o código de conexão dos tablets', estado: 'ok', detalhe: 'Código 504 140' }] : []) }];
    } else {
      pilha = [telaInicial()];
      if (tela === 'operador') { cfg.op = null; pilha.push({ tela: 'operador' }); }
      else if (tela === 'config' || tela === 'admin' || tela === 'relatorios' || tela === 'pessoas' || tela === 'registro' || tela === 'folhas') pilha.push({ tela });
      else if (tela === 'graficos') pilha.push({ tela, data: dataProducao(), setor: params.get('setor') || '' });
      else if (tela === 'aparelhos') pilha.push({ tela });
      else if (tela === 'avisos') {
        // exemplos: um lido, um na tela e um esperando
        const a1 = enviarAviso('hidrolise', 'Guilherme', 'Passe no escritório antes de sair, por favor.');
        gravar(dataProducao(), PID_RECIBO, a1, { mostradoEm: Date.now() - 600000, mostradoPara: 'Guilherme', lidoEm: Date.now() - 540000, lidoPor: 'Guilherme' }, { operador: 'Guilherme' });
        const a2 = enviarAviso('caldeira', 'Alberto', 'O técnico da caldeira chega às 14h. Acompanhe ele, por favor.');
        gravar(dataProducao(), PID_RECIBO, a2, { mostradoEm: Date.now() - 120000, mostradoPara: 'Alberto' }, { operador: 'Alberto' });
        enviarAviso('destilaria', '', 'Ligue para o escritório.');
        pilha.push({ tela: 'avisos', form: { setor: 'hidrolise', nome: 'Felipe', texto: 'Amanhã o turno começa mais cedo, às 6h.' } });
      }
      else if (tela === 'prancheta') {
        const pv = { tela, pid: params.get('pid') };
        if (params.get('chave')) pv.chave = /^\d+$/.test(params.get('chave')) ? Number(params.get('chave')) : params.get('chave');
        if (params.get('monitor')) pv.monitor = true;
        if (ehCentral()) pv.data = dataProducao();
        pilha.push(pv);
      }
    }
    render(true);
    if (params.get('campo')) {
      selecionar(params.get('campo'));
      (params.get('teclas') || '').split('|').filter(Boolean).forEach((k) => tecla(k));
    }
    if (params.get('modal') === 'formato') compartilhar('whatsapp', dataProducao());
    if (params.get('modal') === 'atualizacao') oferecerAtualizacao();
    if (params.get('modal') === 'novidades') mostrarNovidades('2.6.0');
    if (params.get('ninguem')) { demoSemPessoa = true; render(true); }
    if (params.get('funcoes')) { demoFuncoes = params.get('funcoes').split(','); render(true); }
    // aparelhos e bloqueio de exemplo (versão 2.11)
    if (ehCentral()) { sync.status = statusDeExemplo(); render(true); }
    if (params.get('bloqueio')) { cfg.bloqueio = { em: Date.now() - 3600000, modo: params.get('bloqueio'), apagar: params.get('apagar') === '1', sal: '', resumo: '' }; pilha = [{ tela: 'bloqueado-adm' }]; render(true); }
    if (params.get('aparelho')) verAparelho(params.get('aparelho'));
    if (params.get('modal') === 'entrar') entrarNoChefe();
    if (params.get('modal') === 'liberar') liberarEsteAparelho();
    // turnos de 12 horas (2.13.4): &turnos=12h (no tablet chefe, na Nova Destilaria); o operador continua no turno novo
    if (params.get('turnos') === '12h' && cfg.papel) {
      salvarConfigSistema({ turnosSetor: { [ehCentral() ? 'nova_destilaria' : cfg.papel]: '12h' } });
      if (params.get('op')) definirOperador(params.get('op'));
      render(true);
    }
    // lembrete de anotar (versão 2.13): ?demo&papel=destilaria&op=Mateus&lembrete=1 (=urgente: como se fosse depois das :30;
    // =fora: fora do horário do setor). No tablet chefe, &lembrete=1 mostra o horário nas Configurações da usina.
    if (params.get('lembrete') && cfg.papel) {
      const h = new Date().getHours();
      if (ehCentral()) salvarConfigSistema({ lembretes: { destilaria: { de: 7, ate: 19 } } });
      else {
        lembreteUrgente = params.get('lembrete') === 'urgente';
        // a linha da hora atual fica vazia, seja qual for a hora em que a demonstração abriu
        pranchetasDo(cfg.papel).forEach((pid) => delete registros[`${dataProducao()}|${pid}|${h}`]);
        // =fora: o horário do setor deixa de fora só a hora atual
        salvarConfigSistema({ lembretes: { [cfg.papel]: params.get('lembrete') === 'fora' ? { de: (h + 1) % 24, ate: h } : true } });
      }
      render(); verificarLembrete();
    }
    if (params.get('modal') === 'lembrete-horario') escolherHorarioLembrete('destilaria');
    if (params.get('modal') === 'conexao') verConexao();
    if (params.get('modal') === 'codigo-trocado') avisarCodigoTrocado({ id: 'demo', em: Date.now() - 40 * 60000, quem: 'Fernando', aparelho: 'Tablet do escritório' });
    if (params.get('modal') === 'nivel') editarNivelChefe(1);
    if (params.get('aviso') && cfg.papel && !ehCentral() && operadorAtual()) {
      enviarAviso(cfg.papel, operadorAtual(), 'Passe no escritório antes de sair, por favor. O encarregado quer falar sobre a troca de turno de amanhã.');
      verificarAvisos();
    }
    if (params.get('lerfoto')) {
      // ?demo&papel=central&lerfoto=teste.jpg&pid=hid_anexo2 : lê uma foto de teste sem abrir a câmera
      fetch(params.get('lerfoto')).then((r) => r.blob()).then((b) => lerFolhaDeArquivo(params.get('pid'), dataProducao(), new File([b], 'folha.jpg', { type: b.type })));
    }
    if (params.get('folhas')) {
      // ?demo&papel=central&folhas=hid_anexo1,ins_lphera  (ou folhas=todas): mostra as folhas iguais ao papel
      const escolha = params.get('folhas');
      const pids = escolha === 'todas' ? folhasDosSetores(setores().map((x) => x.id)) : escolha.split(',');
      const area = document.createElement('div'); area.id = 'impressao'; document.body.appendChild(area);
      area.innerHTML = pids.map((pid) => window.ModelosPapel.paraHtml(papel().folha(pid, dataProducao()), 'icons/logo.png', fmtNum)).join('');
      const primeira = area.querySelector('.folha-imp');
      area.style.page = document.body.style.page = primeira && primeira.classList.contains('paisagem') ? 'paisagem' : 'retrato';
      document.body.classList.add('ver-folhas');
    }
  }

  aplicarTema();
  ajustarEscala();
  document.documentElement.toggleAttribute('data-cheia', !!cfg.telaCheia);
  // lembrete de anotar: também na demonstração, para a faixa sumir e voltar como no aparelho de verdade
  setInterval(verificarLembrete, 10000);
  if (DEMO_IMG) iniciarImagens();
  else {
    if (NO_APK && pluginCentral && cfg.servidor === undefined && ehCentral()) { cfg.servidor = true; salvarCfg(); }
    // o servidor do tablet chefe (Java) não lê o forms.js: o aplicativo manda as folhas para ele montar a API na nuvem
    if (centralNoTablet()) ligarCentralDoTablet().then(() => { sincronizar(); postJson('api/nuvem', { acao: 'forms', forms: C }, 8000).catch(() => {}); });
    // não é mais o servidor, mas ele ficou ligado (ligou sozinho ao religar): desliga
    else if (NO_APK && pluginCentral && pluginCentral.estado) pluginCentral.estado().then((r) => { if (r && r.rodando) pluginCentral.parar().catch(() => {}); }).catch(() => {});
    // no aplicativo, quem guarda se a tela cheia está ligada é o Android
    if (NO_APK && pluginCentral && pluginCentral.telaCheia) pluginCentral.telaCheia({}).then((r) => { if (!!r.ligada !== !!cfg.telaCheia) { cfg.telaCheia = !!r.ligada; salvarCfg(); document.documentElement.toggleAttribute('data-cheia', cfg.telaCheia); } }).catch(() => {});
    if (cfg.papel === 'escritorio') { cfg.papel = 'central'; cfg.escritorio = null; salvarCfg(); }
    podar();
    pilha = [telaInicial()];
    if (cfg.papel && (cfg.chave || cfg.demo) && !ehCentral() && !ehEscritorio() && !operadorAtual()) pilha.push({ tela: 'operador' });
    render(true);
    lerInfoDoAparelho().finally(sincronizar);
    setTimeout(() => conferirNaNuvem(true), 4000);
    setTimeout(verificarAvisos, 800); // aviso que já estava guardado neste aparelho
    conferirNovidades();
    // versão nova na central (ou na nuvem): procura logo depois de abrir e a cada 30 minutos
    if (podeAtualizar()) { setTimeout(procurarAtualizacao, 15000); setInterval(procurarAtualizacao, 30 * 60000); setInterval(avisarAtualizacao, 60000); }
    // atualização rápida: a tela abriu, então as telas novas ficam (sem isso, na terceira vez o Android volta para as de antes)
    if (podeAtualizar() && pluginCentral.telasOk) setTimeout(() => pluginCentral.telasOk().then((r) => { if (r && r.voltou) toast(`A versão ${r.voltou} não abriu direito. Voltei para a anterior.`, 'erro'); }).catch(() => {}), 5000);
    // todos os aparelhos sincronizam a cada 5 segundos
    setInterval(sincronizar, 5000);
    // a luz da nuvem no botão Conexão: o aparelho confere sozinho se alcança a nuvem
    setInterval(() => conferirNaNuvem(), 120000);
    app.addEventListener('pointerdown', function primeira() { entrarTelaCheia(); app.removeEventListener('pointerdown', primeira); });
    if (!NO_APK && 'serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});
    conectarNoComputador();
  }
