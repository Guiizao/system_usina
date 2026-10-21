/* Pranchetas Ubirálcool - totais do dia no Base44
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  let turnosInfo = null;
  async function carregarEnvioTurnos() {
    if (!pode('integracoes')) return;
    try {
      const r = await postJson('api/turnos', { acao: 'estado' }, 8000);
      if (r.ok) { turnosInfo = await r.json(); if (view().tela === 'config') { if (podeRedesenhar()) render(); else redesenharDepois = true; } }
    } catch (e) { /* a tela informa que não foi possível carregar */ }
  }
  // 2.16.1 (21/10): o sistema do Evandro só busca pela API (GET /api/v1/totais). Sem nada cadastrado, as seções que mandam
  // os totais dizem que não precisa preencher e mostram só o botão (para outro sistema que peça para a central mandar)
  const naoPrecisa = (acao) => `<p class="sub" style="margin:0 0 8px">Não precisa preencher: o sistema do Evandro busca os totais sozinho pela API da nuvem. Use só se outro sistema pedir para a central mandar.</p>
    <button class="btn pequeno" data-a="${acao}">Cadastrar um endereço</button>`;
  function htmlEnvioTurnos() {
    const b = turnosInfo || { enviados: {} };
    const quando = (ms) => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const explica = '<p class="sub">Ao terminar cada turno, a central manda os totais acumulados do dia para o sistema do Evandro. Usa os horários de cada setor e tenta de novo a cada 10 minutos se houver erro. Corrigiu uma folha dos últimos 7 dias, manda de novo.</p>';
    // como as outras seções: na demonstração, uma linha só (sem central, não há o que cadastrar)
    if (cfg.demo && !turnosInfo) return explica + '<p class="sub" style="margin:0">Na demonstração não há central para mandar os totais do turno.</p>';
    if (turnosInfo && !b.url && !b.ligado) return naoPrecisa('turnos-url');
    return `${explica}
      <div class="linha-config"><div><b>Endereço de destino</b><small>${esc(b.url ? enderecoCurto(b.url) : 'não cadastrado')}</small></div><button class="btn pequeno" data-a="turnos-url">${b.url ? 'Trocar' : 'Cadastrar'}</button></div>
      <div class="linha-config"><div><b>Segredo</b><small>${b.temSegredo ? 'cadastrado (não aparece aqui)' : 'não cadastrado'}</small></div><button class="btn pequeno" data-a="turnos-segredo">${b.temSegredo ? 'Trocar' : 'Cadastrar'}</button></div>
      <div class="linha-config"><div><b>Envio automático</b><small>${b.ligado ? `Ligado desde ${fmtData(b.desde)}` : 'Desligado'}</small></div><button class="btn pequeno" data-a="turnos-ligar" aria-pressed="${!!b.ligado}">${b.ligado ? 'Desligar' : 'Ligar'}</button></div>
      <div class="linha-config"><div><b>Situação</b><small>${turnosInfo ? 'Só envia turnos encerrados desde que foi ligado.' : cfg.demo ? 'Na demonstração não há central.' : 'Carregue a situação para consultar os envios.'}</small></div><button class="btn pequeno" data-a="turnos-atualizar">Atualizar</button></div>
      ${Object.values(b.enviados).slice(0, 5).map((e) => `<div class="linha-config base44-dia ${e.ok ? 'ok' : 'erro'}"><div><b>${fmtData(e.data)} · ${esc(e.turno.nome)}</b><small>${pad2(e.turno.inicio)}h–${pad2(e.turno.fim)}h · ${e.ok ? 'Enviado' : esc(e.erro)} · ${quando(e.em)}</small></div></div>`).join('')}
      <button class="btn" data-a="turnos-enviar" ${b.ligado ? '' : 'disabled'}>Mandar agora</button>`;
  }
  async function acaoEnvioTurnos(acao, botao) {
    if (acao === 'turnos-atualizar') return carregarEnvioTurnos();
    if (!turnosInfo) await carregarEnvioTurnos();
    if (!turnosInfo) return toast('Não consegui falar com a central', 'erro');
    let mudanca = {};
    if (acao === 'turnos-url') {
      const url = await textoLivre({ titulo: 'Endereço do sistema do Evandro', dica: 'O endereço que recebe os totais por POST. Começa com https://.', valor: turnosInfo.url || '', tipo: 'url', max: 2000 });
      if (url === undefined) return;
      mudanca = { url, ...(!url ? { ligado: false } : {}) };
    } else if (acao === 'turnos-segredo') {
      const segredo = await textoLivre({ titulo: 'Segredo do envio por turno', dica: 'Use o mesmo segredo cadastrado no destino. Em branco, a central cria um e mostra uma única vez.', tipo: 'text', max: 200 });
      if (segredo === undefined) return;
      mudanca = { segredo };
    } else if (acao === 'turnos-ligar') mudanca = { ligado: !turnosInfo.ligado };
    const enviar = acao === 'turnos-enviar';
    botao.disabled = true;
    if (enviar) toast('Mandando os totais dos turnos encerrados...');
    try {
      const r = await postJson('api/turnos', enviar ? { acao: 'enviar' } : { acao: 'configurar', forms: C, ...mudanca }, enviar ? 60000 : 8000);
      const d = await r.json();
      if (!r.ok || d.ok === false) return toast(d.erro || 'A central recusou', 'erro');
      if (!enviar) {
        const { segredoCriado, ...estado } = d;
        turnosInfo = estado;
        if (segredoCriado) await abrirModal(`<h3>Segredo criado</h3><p class="dica">Passe este segredo para o Evandro configurar o recebimento. Ele não aparece de novo aqui.</p><p class="segredo-grande">${esc(segredoCriado)}</p><div class="acoes-modal um"><button class="btn primario" data-k="x">Anotei</button></div>`, (k, b, fechar) => fechar());
      }
      toast(enviar ? d.quantidade ? `${d.quantidade} envio(s) concluído(s)` : 'Nenhum turno encerrado com totais novos' : 'Configuração salva');
    } catch (e) { toast('Não consegui falar com a central. Consulte a situação.', 'erro'); }
    finally { botao.disabled = false; await carregarEnvioTurnos(); render(); }
  }

  /* =========================================================
   * Totais do dia no Base44 (o sistema do escritório onde o Lucas lança os totais)
   * Quando o dia fecha (07:00), o tablet chefe soma cada insumo e a central manda pela internet.
   * Se alguém corrigir a folha depois, os totais mudam e vão de novo. O endereço e o segredo ficam só na central.
   * ========================================================= */
  const DIAS_BASE44 = 7;
  let base44Info = null;       // estado completo (endereço, erros), buscado ao abrir as configurações
  const base44Avisado = {};    // dia -> já avisou do erro (avisa uma vez só)
  let base44Ocupado = false;
  let base44Visto = 0;
  function totaisDoDia(data, ler = listar) {
    const itens = [];
    setores().forEach((s) => s.pranchetas.flatMap(folhasDe).filter((pid) => prancheta(pid).tipo === 'insumo').forEach((pid) => {
      const p = prancheta(pid);
      const soma = {};
      linhasDeHora(ler(data, pid)).forEach((r) => {
        const n = parseFloat(r.valores.qtd);
        if (isNaN(n)) return;
        const u = r.valores.unidade || p.unidade || '';
        soma[u] = (soma[u] || 0) + n;
      });
      const unidades = Object.keys(soma);
      if (!unidades.length) itens.push({ setor: s.nome, insumo: p.nome, folha: pid, quantidade: 0, unidade: p.unidade || '' });
      unidades.forEach((u) => itens.push({ setor: s.nome, insumo: p.nome, folha: pid, quantidade: Math.round(soma[u] * 100) / 100, unidade: u }));
    }));
    return itens;
  }
  async function enviarBase44(data, forcar) {
    await buscarDia(data);
    const itens = totaisDoDia(data);
    const hash = Cifra.hex(Cifra.sha256(Cifra.utf8(JSON.stringify({ data, itens })))).slice(0, 16);
    const dados = { origem: 'Pranchetas Ubirálcool', data, dataBr: fmtData(data), itens, resumo: resumoDoDia(data), enviadoEm: new Date().toISOString() };
    try {
      const r = await postJson('api/base44', { acao: 'enviar', data, hash, dados, forcar: !!forcar }, 30000);
      const d = await r.json().catch(() => ({}));
      return r.ok ? d : { ok: false, erro: d.erro || 'A central recusou' };
    } catch (e) { return { ok: false, erro: 'Não consegui falar com a central' }; }
  }
  /** Dias fechados que ainda não foram (ou mudaram depois que foram). Só dias depois de ligar o envio:
      os anteriores o escritório já lançou à mão (dá para mandar um por um nas configurações). */
  function diasParaBase44(b) {
    const hoje = dataProducao();
    const comDados = new Set();
    Object.values(registros).forEach((r) => { if (!r.apagado && /^\d{4}-\d{2}-\d{2}$/.test(r.data)) comDados.add(r.data); });
    const dias = [];
    for (let i = DIAS_BASE44; i >= 1; i--) {
      const d = somarDias(hoje, -i);
      if (b.desde && d < b.desde) continue;
      if (comDados.has(d)) dias.push(d);
    }
    return dias;
  }
  async function verificarBase44() {
    const b = sync.status && sync.status.base44;
    if (!ehCentral() || cfg.demo || !b || !b.ligado || base44Ocupado || Date.now() - base44Visto < 60000) return;
    base44Visto = Date.now();
    base44Ocupado = true;
    try {
      for (const d of diasParaBase44(b)) {
        const e = (b.enviados || {})[d];
        const itens = totaisDoDia(d);
        const hash = Cifra.hex(Cifra.sha256(Cifra.utf8(JSON.stringify({ data: d, itens })))).slice(0, 16);
        if (e && e.ok && e.hash === hash) continue;
        if (e && !e.ok && Date.now() - e.em < 10 * 60000) continue; // deu erro há pouco: tenta de novo daqui a 10 minutos
        const r = await enviarBase44(d);
        if (!r.ok && !base44Avisado[d]) { base44Avisado[d] = true; toast(`Não consegui mandar os totais de ${fmtData(d)} para o Base44: ${r.erro}. Tento de novo a cada 10 minutos.`, 'erro'); }
        sync.statusJson = ''; // pega o estado novo na próxima sincronização
        break; // um dia por vez, para não pesar
      }
    } finally { base44Ocupado = false; }
  }
  /* Nuvem das Pranchetas (versão 2.8): a central manda uma cópia das anotações para a internet.
     O endereço e a senha ficam só na central; aqui o tablet chefe cadastra e vê se está indo. */
  let nuvemInfo = null;
  async function carregarNuvem() {
    try {
      const r = await postJson('api/nuvem', { acao: 'estado' }, 8000);
      if (r.ok) { nuvemInfo = await r.json(); if (view().tela === 'config') { if (podeRedesenhar()) render(); else redesenharDepois = true; } }
    } catch (e) { /* mostra o que veio na sincronização */ }
  }
  function htmlNuvem() {
    const n = Object.assign({}, sync.status && sync.status.nuvem, nuvemInfo);
    if (cfg.demo && !nuvemInfo) return '<p class="sub" style="margin:0">Na demonstração não há central para mandar para a nuvem.</p>';
    const quando = (ms) => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');
    const situacao = !n.ligada ? 'Desligada' : n.erro ? `Erro: ${n.erro}` : n.ultimoEnvio ? `Último envio ${quando(n.ultimoEnvio)}. ${n.faltam ? `Faltam ${contar(n.faltam, 'anotação', 'anotações')}.` : 'Tudo na nuvem.'}` : 'Ainda não mandou';
    return `<p class="sub" style="margin:0 0 6px">A central manda uma cópia das anotações para a internet. De lá saem a API do sistema do escritório e as atualizações do aplicativo. Sem internet, a usina continua funcionando e a cópia vai quando a internet voltar.</p>
      <div class="linha-config"><span class="escolha-ico">${ico('servidor')}</span><div><b>Endereço da nuvem</b><small>${esc(n.url ? enderecoCurto(n.url) : 'não cadastrado')}</small></div>
        <button class="btn pequeno" data-a="nuvem-url">${n.url ? 'Trocar' : 'Cadastrar'}</button></div>
      <div class="linha-config"><span class="escolha-ico">${ico('codigo')}</span><div><b>Senha da central</b><small>${n.temSegredo ? 'cadastrada (não aparece aqui)' : 'não cadastrada'}</small></div>
        <button class="btn pequeno" data-a="nuvem-segredo">${n.temSegredo ? 'Trocar' : 'Cadastrar'}</button></div>
      <div class="linha-config" id="nuvem-situacao"><span class="escolha-ico">${ico('enviar')}</span><div><b>Situação</b><small>${esc(situacao)}</small></div>
        <button class="btn pequeno" data-a="nuvem-enviar" ${n.ligada ? '' : 'disabled'}>Mandar agora</button></div>`;
  }
  async function configurarNuvem(mudanca) {
    const r = await postJson('api/nuvem', Object.assign({ acao: 'configurar', url: (nuvemInfo && nuvemInfo.url) || '', forms: C }, mudanca), 8000).catch(() => null);
    if (!r || !r.ok) { toast(r ? ((await r.json().catch(() => ({}))).erro || 'A central recusou') : 'Não consegui falar com a central', 'erro'); return false; }
    nuvemInfo = await r.json(); if (sync.status) sync.status.nuvem = Object.assign({}, nuvemInfo); sync.statusJson = '';
    return true;
  }

  async function carregarBase44() {
    try {
      const r = await postJson('api/base44', { acao: 'estado' }, 8000);
      if (r.ok) { base44Info = await r.json(); if (sync.status) sync.status.base44 = Object.assign({}, base44Info); if (view().tela === 'config') { if (podeRedesenhar()) render(); else redesenharDepois = true; } }
    } catch (e) { /* mostra o que veio na sincronização */ }
  }
  /** O endereço inteiro não cabe no celular: mostra o começo e o fim do nome do site (o inteiro aparece ao tocar em Trocar). */
  function enderecoCurto(u) {
    let host = u;
    try { host = new URL(u).hostname; } catch (e) { /* mostra como veio */ }
    return host.length <= 20 ? host : `${host.slice(0, 10)}…${host.split('.').slice(-2).join('.')}`;
  }
  function htmlBase44() {
    // o que muda (dias enviados) vem da sincronização; o endereço só vem ao abrir as configurações
    const b = Object.assign({ enviados: {} }, base44Info, sync.status && sync.status.base44);
    if (base44Info) b.url = base44Info.url;
    if (cfg.demo && !base44Info) return '<p class="sub" style="margin:0">Na demonstração não há central para mandar os totais.</p>';
    if (base44Info && !b.url && !b.ligado && !b.temSegredo) return naoPrecisa('base44-url');
    const hoje = dataProducao();
    const quando = (ms) => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');
    const dias = [];
    for (let i = 1; i <= DIAS_BASE44; i++) dias.push(somarDias(hoje, -i));
    const linhas = dias.map((d) => {
      const e = (b.enviados || {})[d];
      const texto = !e ? (b.desde && d >= b.desde ? 'Ainda não foi' : 'Não enviado (lançado à mão)') : e.ok ? `Enviado ${quando(e.em)}` : `Erro: ${e.erro || 'não foi'}`;
      return `<div class="linha-config base44-dia ${e ? (e.ok ? 'ok' : 'erro') : ''}"><div><b>${fmtData(d).slice(0, 5)} <small class="dia-semana">${esc(diaSemana(d))}</small></b><small>${esc(texto)}</small></div>
        <button class="btn pequeno" data-a="base44-enviar" data-data="${d}" ${b.ligado ? '' : 'disabled'}>${e && e.ok ? 'De novo' : 'Enviar'}</button></div>`;
    }).join('');
    return `<p class="sub" style="margin:0 0 6px">Quando o dia fecha, às ${pad2(C.inicioDoDia)}:00, os totais de cada insumo vão sozinhos para o sistema do escritório. Se alguém corrigir a folha depois, vão de novo. Precisa de internet no servidor da usina.</p>
      <div class="linha-config"><span class="escolha-ico">${ico('escritorio')}</span><div><b>Endereço no Base44</b><small>${esc(b.url ? enderecoCurto(b.url) : b.ligado ? 'cadastrado' : 'não cadastrado')}</small></div>
        <button class="btn pequeno" data-a="base44-url">${b.ligado ? 'Trocar' : 'Cadastrar'}</button></div>
      <div class="linha-config"><span class="escolha-ico">${ico('codigo')}</span><div><b>Segredo</b><small>${b.temSegredo ? 'cadastrado (não aparece aqui)' : 'não cadastrado'}</small></div>
        <button class="btn pequeno" data-a="base44-segredo">${b.temSegredo ? 'Trocar' : 'Cadastrar'}</button></div>
      ${b.ligado ? `<h3 style="margin-top:12px">Últimos dias</h3>${linhas}` : ''}`;
  }

  /**
   * Compartilhar. destino: escritorio | whatsapp | email | outros | baixar
   * No aplicativo o arquivo vai direto para o WhatsApp ou para o e-mail.
   * No navegador usa o que o aparelho permitir.
   */
  async function compartilhar(destino, data, arquivoPronto) {
    const cs = configSistema();
    let alvo = destino;
    if (destino === 'escritorio') {
      alvo = cs.whatsapp ? 'whatsapp' : cs.email ? 'email' : '';
      if (!alvo) {
        if (await confirmar('Falta o contato do escritório', 'Cadastre o WhatsApp ou o e-mail do escritório em Configurações da usina.', 'Abrir configurações')) ir({ tela: 'config' });
        return;
      }
    }
    const nomes = { whatsapp: 'Enviar pelo WhatsApp', email: 'Enviar por e-mail', outros: 'Compartilhar com outro aplicativo', baixar: 'Guardar no servidor e no aparelho' };
    let arquivo = arquivoPronto;
    let formato = arquivo ? (/\.xml$/i.test(arquivo.name) ? 'xml' : /\.pdf$/i.test(arquivo.name) ? 'pdf' : 'xlsx') : null;
    let escolhidos = setores().map((s) => s.id);
    let completo = true, resumo = '';
    if (!arquivo) {
      const escolha = await escolherEnvio(destino === 'escritorio' ? `Enviar para o escritório (${alvo === 'whatsapp' ? 'WhatsApp' : 'e-mail'})` : nomes[alvo], data);
      if (!escolha) return;
      formato = escolha.formato; escolhidos = escolha.setores;
      completo = escolha.dias.length === 1 && escolha.dias[0] === data && escolha.turnos.length === (escolha.totalTurnos || C.turnos.length);
      data = escolha.dias[0];
      try { const m = await montarEnvio(escolha); arquivo = m.arquivo || null; resumo = m.texto || ''; } catch (e) { return toast('Não consegui montar o arquivo', 'erro'); }
    }
    const texto = formato === 'texto' ? resumo : `Pranchetas Ubirálcool, folha de ${fmtData(data)}`;
    const assunto = `Pranchetas Ubirálcool - ${fmtData(data)}`;
    // só o relatório com todos os setores fica guardado (um por dia, na pasta RelatoriosUsina)
    if (arquivo && !arquivoPronto && completo && formato !== 'pdf' && escolhidos.length === setores().length) guardarNaCentral(data, [arquivo]);

    if (alvo === 'baixar') {
      if (!arquivo) return;
      if (NO_APK && pluginCentral) {
        try { const r = await pluginCentral.guardarDocumento({ nome: arquivo.name, mime: arquivo.type, base64: await paraBase64(arquivo), data }); return toast(`Guardado em ${r.caminho}`); } catch (e) { /* segue */ }
      }
      return baixar(arquivo);
    }

    const numero = alvo === 'whatsapp' && destino === 'escritorio' ? telefoneInternacional(cs.whatsapp) : '';
    const email = alvo === 'email' && destino === 'escritorio' ? cs.email : '';

    if (NO_APK && pluginCentral) {
      try {
        await pluginCentral.compartilhar({
          destino: alvo, numero, email, assunto, texto,
          nome: arquivo ? arquivo.name : '', mime: arquivo ? arquivo.type : 'text/plain', base64: arquivo ? await paraBase64(arquivo) : '',
        });
        return;
      } catch (e) {
        toast(e && e.message ? e.message : 'Não consegui abrir o aplicativo', 'erro');
        return;
      }
    }

    // navegador
    if (!arquivo && alvo === 'whatsapp') { window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener'); return; }
    if (arquivo && navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      try { await navigator.share({ files: [arquivo], title: assunto, text: texto }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    if (arquivo) baixar(arquivo);
    if (alvo === 'whatsapp') window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto + (arquivo ? '\n(o arquivo foi baixado no aparelho, anexe na conversa)' : ''))}`, '_blank', 'noopener');
    else if (alvo === 'email') location.href = `mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto + '\n\nO arquivo foi baixado no aparelho. Anexe antes de enviar.')}`;
    else if (!arquivo) toast('Este aparelho não compartilha arquivos', 'erro');
  }
  function baixar(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast(`Arquivo ${file.name} baixado`);
  }
  /** Enviar ou imprimir as folhas de um dia (o arquivo é montado na hora, com as últimas correções). */
  async function enviarDia(data) {
    const destino = await abrirModal(`<h3>Folhas de ${fmtData(data)}</h3><p class="dica">Para onde?</p>
      <div class="escolhas">
        <button data-k="escritorio"><span class="escolha-ico">${ico('enviar')}</span><b>Escritório</b><small>Usa o WhatsApp ou o e-mail cadastrado</small></button>
        <button data-k="whatsapp"><span class="escolha-ico">${ico('whatsapp')}</span><b>WhatsApp</b><small>Escolher a conversa</small></button>
        <button data-k="email"><span class="escolha-ico">${ico('email')}</span><b>E-mail</b><small>Com o arquivo anexado</small></button>
        <button data-k="outros"><span class="escolha-ico">${ico('compartilhar')}</span><b>Outros apps</b><small>Drive, Bluetooth e outros</small></button>
        <button data-k="baixar"><span class="escolha-ico">${ico('baixar')}</span><b>Guardar</b><small>No servidor e neste aparelho</small></button>
        <button data-k="imprimir"><span class="escolha-ico">${ico('imprimir')}</span><b>Imprimir</b><small>Ou salvar em PDF</small></button>
      </div><div class="acoes-modal um"><button class="btn" data-k="x">Cancelar</button></div>`,
    (k, b, fechar) => fechar(k === 'x' ? undefined : k), { classe: 'largo' });
    if (!destino) return;
    if (destino === 'imprimir') return imprimirEscolhendo(data);
    return compartilhar(destino, data);
  }
